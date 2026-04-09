import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import {
  acceptInvite,
  claimOrganizationAdmin,
  createEvaluationTemplate,
  createInvite,
  createPlayer,
  createTryoutSeason,
  deleteEvaluationTemplate,
  deleteTryoutSeason,
  declineInvite,
  loadAdminUsers,
  loadBootstrapData,
  loadEvaluationTemplates,
  loadTryoutSeasons,
  revokeInvite,
  saveUserRole,
  updateAdminUser,
  updateCurrentUserProfile,
  updateEvaluationTemplate,
  updatePlayer,
  updateOrganizationSettings,
  updateTryoutSeason,
} from './lib/data-client';
import { beginSignIn, beginSignOut, restoreAuthSession } from './lib/auth';
import { loadRuntimeConfig } from './lib/runtime-config';
import type {
  AccountStatus,
  AdminOrganizationRole,
  AdminUserDirectoryEntry,
  AppRole,
  AuthSession,
  BootstrapData,
  CompletedByOption,
  EvaluationCriterion,
  EvaluationTemplate,
  IntakeAnswers,
  IntakeStatus,
  InviteRecord,
  OrganizationSettingsInput,
  OrganizationOverview,
  PlayerPhysicalEntry,
  PlayerProfileInput,
  PlayerRecord,
  PlayerTeamHistoryEntry,
  PrimaryRole,
  RuntimeConfig,
  TryoutGender,
  TryoutPlayerAssignmentMode,
  TryoutPlayerOverride,
  TryoutPlayerSummary,
  TryoutSeason,
  UserProfile,
  UserRole,
} from './types';

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
};

type EditableUserProfileState = {
  firstName: string;
  lastName: string;
  contactEmail: string;
  phoneNumber: string;
  smsOptIn: boolean;
};

type EditablePlayerState = {
  id: string | null;
  profile: PlayerProfileInput;
  intake: IntakeAnswers;
  intakeStatus: IntakeStatus;
};

type EditableEvaluationTemplateState = {
  name: string;
  criteria: EvaluationCriterion[];
};

type AdminWorkspaceView =
  | 'overview'
  | 'organization'
  | 'tryouts'
  | 'templates'
  | 'users'
  | 'profile'
  | 'access'
  | 'architecture';

type AdminUserFiltersState = {
  query: string;
  primaryRole: PrimaryRole | 'all';
  assignedRole: AppRole | 'all';
  accountStatus: AccountStatus | 'all';
};

type EditableAdminUserState = {
  primaryRole: PrimaryRole;
  organizationRoles: AdminOrganizationRole[];
  accountStatus: AccountStatus;
};

type UserWorkspaceView =
  | 'setup'
  | 'overview'
  | 'tryouts'
  | 'profile'
  | 'player'
  | 'intake'
  | 'invites';

type TryoutSetupCardProps = {
  roleLabel: string;
  seasons: TryoutSeason[];
  draft: TryoutSeason | null;
  loaded: boolean;
  loading: boolean;
  newSeasonName: string;
  busyAction: string | null;
  draggingPlayerId: string | null;
  onNewSeasonNameChange: (value: string) => void;
  onCreateSeason: () => void;
  onSelectSeason: (seasonId: string) => void;
  onDeleteSeason: () => void;
  onSeasonNameChange: (value: string) => void;
  onSaveSeason: () => void;
  onAddGroup: () => void;
  onUpdateGroupName: (groupId: string, value: string) => void;
  onToggleGroupBirthYear: (groupId: string, birthYear: string, checked: boolean) => void;
  onToggleGroupGender: (groupId: string, gender: TryoutGender, checked: boolean) => void;
  onRemoveGroup: (groupId: string) => void;
  onSetPlayerAssignment: (
    playerId: string,
    assignmentMode: TryoutPlayerAssignmentMode,
    groupId: string | null,
  ) => void;
  onAddTeam: (groupId: string) => void;
  onUpdateTeamName: (teamId: string, value: string) => void;
  onRemoveTeam: (teamId: string) => void;
  onAssignPlayerToTeam: (playerId: string, teamId: string | null) => void;
  onUpdatePlayerJersey: (playerId: string, value: string) => void;
  onAddSession: () => void;
  onUpdateSessionName: (sessionId: string, value: string) => void;
  onToggleSessionTeam: (sessionId: string, teamId: string, checked: boolean) => void;
  onRemoveSession: (sessionId: string) => void;
  onStartPlayerDrag: (playerId: string | null) => void;
};

type UserProfileFieldKey = Exclude<keyof EditableUserProfileState, 'smsOptIn'>;

type ChoiceOption = {
  value: string;
  description: string;
};

type QuestionBlockProps = {
  title: string;
  fieldName: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
};

type UserProfileCardProps = {
  signInEmail: string;
  userDraft: EditableUserProfileState;
  busyAction: string | null;
  onFieldChange: (field: UserProfileFieldKey, value: string) => void;
  onSmsOptInChange: (value: boolean) => void;
  onSave: () => void;
};

const ROLE_ORDER: AppRole[] = [
  'platform-admin',
  'club-admin',
  'manager',
  'coach',
  'staff',
  'parent',
  'player',
];

const ROLE_LABELS: Record<AppRole, string> = {
  parent: 'Parent',
  player: 'Player',
  staff: 'Staff',
  coach: 'Coach',
  manager: 'Manager',
  'club-admin': 'Organization Admin',
  'platform-admin': 'Platform Admin',
};

const completedByOptions: CompletedByOption[] = [
  'Player',
  'Parent / Guardian',
  'Player and Parent together',
];

const TRYOUT_GENDERS: TryoutGender[] = [
  'Male',
  'Female',
  'Non-binary',
  'Prefer not to say',
];

const nextSeasonOptions: ChoiceOption[] = [
  {
    value: 'Strongest daily competition',
    description:
      'The player is most motivated by a highly challenging environment.',
  },
  {
    value: 'Expanded team responsibility',
    description:
      'A larger role and more in-game responsibility matter most.',
  },
  {
    value: 'Skill development',
    description: 'Improving technical execution is the primary focus.',
  },
  {
    value: 'Physical development',
    description:
      'Strength, pace, durability, and athletic growth are the top priority.',
  },
  {
    value: 'Exposure / advancement',
    description: 'Long-term pathway and visibility are the main focus.',
  },
  {
    value: 'Confidence and consistency',
    description:
      'The best environment is one that helps build trust, rhythm, and confidence.',
  },
];

const developmentSettingOptions: ChoiceOption[] = [
  {
    value: 'Challenge-forward setting',
    description:
      'The player develops best when stretched by the most demanding environment available.',
  },
  {
    value: 'Balanced-growth setting',
    description:
      'A well-matched environment with steady responsibility is likely the best fit.',
  },
  {
    value: 'Responsibility-forward setting',
    description:
      'The player develops best with an expanded role and more opportunities to drive play.',
  },
  {
    value: 'Open to staff recommendation',
    description:
      "The family is open to the club's judgment on the most effective development setting.",
  },
];

const preferredRoleOptions: ChoiceOption[] = [
  {
    value: 'Any role in the most challenging setting',
    description: 'Level of challenge matters more than role size.',
  },
  {
    value: 'Consistent regular role',
    description: 'The player values steady usage on the best-fit team.',
  },
  {
    value: 'Expanded responsibility',
    description:
      'The player most values additional responsibility and opportunity.',
  },
  {
    value: 'Open to staff recommendation',
    description:
      'The family trusts staff to identify the role that best supports development.',
  },
];

const coachingStyleOptions: ChoiceOption[] = [
  {
    value: 'Clear standards and direct feedback',
    description:
      'The player responds best to straightforward correction and high accountability.',
  },
  {
    value: 'Teaching and detail oriented',
    description:
      'The player learns best when concepts are explained and reinforced clearly.',
  },
  {
    value: 'Confidence-building and encouragement',
    description:
      'The player performs best when feedback supports confidence and momentum.',
  },
  {
    value: 'Balanced mix',
    description:
      'The player benefits from a blend of accountability, teaching, and encouragement.',
  },
];

const participationOptions: ChoiceOption[] = [
  {
    value: 'No known conflicts',
    description: 'Full expected participation.',
  },
  {
    value: 'Minor scheduling considerations',
    description: 'A few manageable conflicts are already known.',
  },
  {
    value: 'Significant constraints',
    description:
      'There are meaningful schedule or availability limitations to discuss.',
  },
  {
    value: 'Prefer to discuss directly',
    description:
      'The family would rather explain any important constraints in conversation.',
  },
];

const formatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const ADMIN_USERS_PAGE_SIZE = 12;

const defaultAdminUserFilters: AdminUserFiltersState = {
  query: '',
  primaryRole: 'all',
  assignedRole: 'all',
  accountStatus: 'all',
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [userDraft, setUserDraft] = useState<EditableUserProfileState | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | 'new' | null>(
    null,
  );
  const [draftPlayer, setDraftPlayer] = useState<EditablePlayerState | null>(null);
  const [organizationDraft, setOrganizationDraft] = useState<OrganizationSettingsInput | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [activeAdminSection, setActiveAdminSection] = useState<AdminWorkspaceView>('overview');
  const [activeUserSection, setActiveUserSection] = useState<UserWorkspaceView>('overview');
  const [adminUserFilters, setAdminUserFilters] = useState<AdminUserFiltersState>(
    defaultAdminUserFilters,
  );
  const [appliedAdminUserFilters, setAppliedAdminUserFilters] = useState<AdminUserFiltersState>(
    defaultAdminUserFilters,
  );
  const [adminUsers, setAdminUsers] = useState<AdminUserDirectoryEntry[]>([]);
  const [adminUsersCursor, setAdminUsersCursor] = useState<string | null>(null);
  const [adminUsersNextCursor, setAdminUsersNextCursor] = useState<string | null>(null);
  const [adminUsersHistory, setAdminUsersHistory] = useState<Array<string | null>>([]);
  const [adminUsersLoaded, setAdminUsersLoaded] = useState(false);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string | null>(null);
  const [adminUserDraft, setAdminUserDraft] = useState<EditableAdminUserState | null>(null);
  const [evaluationTemplates, setEvaluationTemplates] = useState<EvaluationTemplate[]>([]);
  const [evaluationTemplatesLoaded, setEvaluationTemplatesLoaded] = useState(false);
  const [evaluationTemplatesLoading, setEvaluationTemplatesLoading] = useState(false);
  const [selectedEvaluationTemplateId, setSelectedEvaluationTemplateId] = useState<string | null>(
    null,
  );
  const [evaluationTemplateDraft, setEvaluationTemplateDraft] =
    useState<EditableEvaluationTemplateState | null>(null);
  const [tryoutSeasons, setTryoutSeasons] = useState<TryoutSeason[]>([]);
  const [tryoutSeasonsLoaded, setTryoutSeasonsLoaded] = useState(false);
  const [tryoutSeasonsLoading, setTryoutSeasonsLoading] = useState(false);
  const [selectedTryoutSeasonId, setSelectedTryoutSeasonId] = useState<string | null>(null);
  const [tryoutSeasonDraft, setTryoutSeasonDraft] = useState<TryoutSeason | null>(null);
  const [newTryoutSeasonName, setNewTryoutSeasonName] = useState('');
  const [draggingTryoutPlayerId, setDraggingTryoutPlayerId] = useState<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const nextRuntimeConfig = await loadRuntimeConfig();
        if (cancelled) return;
        setRuntimeConfig(nextRuntimeConfig);

        const nextAuthSession = await restoreAuthSession(nextRuntimeConfig);
        if (cancelled) return;
        setAuthSession(nextAuthSession);

        if (nextAuthSession.status === 'guest') {
          setBootstrap(null);
          setIsLoading(false);
          return;
        }

        const nextBootstrap = await loadBootstrapData(
          nextRuntimeConfig,
          nextAuthSession.idToken,
        );
        if (cancelled) return;
        setBootstrap(nextBootstrap);
      } catch (error) {
        if (cancelled) return;
        setFeedback({
          tone: 'error',
          message: getErrorMessage(error),
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!authSession) return;
    if (!isAuthCallbackPath(location.pathname)) return;
    if (authSession.status === 'guest') return;

    navigate('/', { replace: true });
  }, [authSession, location.pathname, navigate]);

  useEffect(() => {
    if (!bootstrap) return;
    const availableRoles = getAvailableRoles(bootstrap);
    if (activeRole && availableRoles.includes(activeRole)) {
      return;
    }

    const storedRole = readStoredRole(bootstrap.user.userId);
    const preferredRole =
      (storedRole && availableRoles.includes(storedRole) && storedRole) ||
      (bootstrap.user.primaryRole &&
        availableRoles.includes(bootstrap.user.primaryRole) &&
        bootstrap.user.primaryRole) ||
      availableRoles[0] ||
      null;

    if (preferredRole !== activeRole) {
      setActiveRole(preferredRole);
    }
  }, [activeRole, bootstrap]);

  useEffect(() => {
    if (!bootstrap || !activeRole) return;
    writeStoredRole(bootstrap.user.userId, activeRole);
  }, [activeRole, bootstrap]);

  useEffect(() => {
    if (!bootstrap) return;
    setUserDraft(buildUserProfileDraft(bootstrap.user));
  }, [bootstrap]);

  useEffect(() => {
    if (!bootstrap) return;
    setOrganizationDraft(buildOrganizationSettingsDraft(bootstrap.organization));
  }, [bootstrap]);

  useEffect(() => {
    if (activeRole === 'club-admin' || activeRole === 'platform-admin') return;

    setActiveAdminSection('overview');
    setAdminUsers([]);
    setAdminUsersCursor(null);
    setAdminUsersNextCursor(null);
    setAdminUsersHistory([]);
    setAdminUsersLoaded(false);
    setSelectedAdminUserId(null);
    setAdminUserDraft(null);
    setEvaluationTemplates([]);
    setEvaluationTemplatesLoaded(false);
    setSelectedEvaluationTemplateId(null);
    setEvaluationTemplateDraft(null);
  }, [activeRole]);

  useEffect(() => {
    const canManageTryouts =
      activeRole === 'club-admin' ||
      activeRole === 'platform-admin' ||
      activeRole === 'staff' ||
      activeRole === 'coach' ||
      activeRole === 'manager';

    if (canManageTryouts) return;

    setTryoutSeasons([]);
    setTryoutSeasonsLoaded(false);
    setSelectedTryoutSeasonId(null);
    setTryoutSeasonDraft(null);
    setNewTryoutSeasonName('');
    setDraggingTryoutPlayerId(null);
  }, [activeRole]);

  useEffect(() => {
    if (!bootstrap) return;
    const familyRole = resolveFamilyRole(activeRole, bootstrap.user.primaryRole);

    if (!familyRole) {
      if (selectedPlayerId !== null) setSelectedPlayerId(null);
      return;
    }

    const hasExistingSelection =
      typeof selectedPlayerId === 'string' &&
      selectedPlayerId !== 'new' &&
      bootstrap.players.some((player) => player.id === selectedPlayerId);

    const nextSelectedPlayerId =
      selectedPlayerId === 'new'
        ? 'new'
        : hasExistingSelection
          ? selectedPlayerId
          : bootstrap.players[0]?.id || 'new';

    if (nextSelectedPlayerId !== selectedPlayerId) {
      setSelectedPlayerId(nextSelectedPlayerId);
    }
  }, [activeRole, bootstrap, selectedPlayerId]);

  useEffect(() => {
    if (!bootstrap) return;
    const familyRole = resolveFamilyRole(activeRole, bootstrap.user.primaryRole);

    if (!familyRole) {
      setDraftPlayer(null);
      return;
    }

    const selectedPlayer =
      selectedPlayerId && selectedPlayerId !== 'new'
        ? bootstrap.players.find((player) => player.id === selectedPlayerId) || null
        : null;

    setDraftPlayer(
      selectedPlayer
        ? buildEditablePlayerState(selectedPlayer)
        : buildEmptyPlayerState(bootstrap.user, familyRole),
    );
    setInviteEmail('');
  }, [activeRole, bootstrap, selectedPlayerId]);

  useEffect(() => {
    if (!bootstrap) return;

    const nextSections = getUserWorkspaceSections(activeRole, bootstrap.user.primaryRole);
    if (nextSections.length === 0) return;
    if (nextSections.some((section) => section.id === activeUserSection)) return;

    setActiveUserSection(nextSections[0].id);
  }, [activeRole, activeUserSection, bootstrap]);

  useEffect(() => {
    if (
      activeRole !== 'club-admin' &&
      activeRole !== 'platform-admin'
    ) {
      return;
    }
    if (activeAdminSection !== 'users') return;
    if (!runtimeConfig || authSession?.status !== 'authenticated') return;
    const currentRuntimeConfig = runtimeConfig;
    const currentIdToken = authSession.idToken;

    let cancelled = false;

    async function loadDirectory() {
      setAdminUsersLoading(true);

      try {
        const response = await loadAdminUsers(currentRuntimeConfig, currentIdToken, {
          ...appliedAdminUserFilters,
          cursor: adminUsersCursor,
          pageSize: ADMIN_USERS_PAGE_SIZE,
        });
        if (cancelled) return;

        setAdminUsers(response.users);
        setAdminUsersNextCursor(response.nextCursor);
        setAdminUsersLoaded(true);
        setSelectedAdminUserId((currentValue) =>
          response.users.some((user) => user.userId === currentValue)
            ? currentValue
            : response.users[0]?.userId ?? null,
        );
      } catch (error) {
        if (cancelled) return;
        setFeedback({
          tone: 'error',
          message: getErrorMessage(error),
        });
      } finally {
        if (!cancelled) setAdminUsersLoading(false);
      }
    }

    void loadDirectory();

    return () => {
      cancelled = true;
    };
  }, [
    activeAdminSection,
    activeRole,
    adminUsersCursor,
    appliedAdminUserFilters,
    authSession,
    runtimeConfig,
  ]);

  useEffect(() => {
    const selectedUser =
      selectedAdminUserId
        ? adminUsers.find((user) => user.userId === selectedAdminUserId) ?? null
        : null;

    setAdminUserDraft(
      selectedUser ? buildEditableAdminUserState(selectedUser) : null,
    );
  }, [adminUsers, selectedAdminUserId]);

  useEffect(() => {
    if (
      activeRole !== 'club-admin' &&
      activeRole !== 'platform-admin'
    ) {
      return;
    }
    if (activeAdminSection !== 'templates') return;
    if (!runtimeConfig || authSession?.status !== 'authenticated') return;

    const currentRuntimeConfig = runtimeConfig;
    const currentIdToken = authSession.idToken;
    let cancelled = false;

    async function loadTemplates() {
      setEvaluationTemplatesLoading(true);

      try {
        const templates = await loadEvaluationTemplates(
          currentRuntimeConfig,
          currentIdToken,
        );
        if (cancelled) return;

        setEvaluationTemplates(templates);
        setEvaluationTemplatesLoaded(true);
        setSelectedEvaluationTemplateId((currentValue) =>
          currentValue && templates.some((template) => template.id === currentValue)
            ? currentValue
            : templates[0]?.id ?? null,
        );
      } catch (error) {
        if (cancelled) return;
        setFeedback({
          tone: 'error',
          message: getErrorMessage(error),
        });
      } finally {
        if (!cancelled) setEvaluationTemplatesLoading(false);
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [activeAdminSection, activeRole, authSession, runtimeConfig]);

  useEffect(() => {
    const selectedTemplate =
      selectedEvaluationTemplateId
        ? evaluationTemplates.find((template) => template.id === selectedEvaluationTemplateId) ??
          null
        : null;

    setEvaluationTemplateDraft(
      selectedTemplate ? buildEditableEvaluationTemplateState(selectedTemplate) : null,
    );
  }, [evaluationTemplates, selectedEvaluationTemplateId]);

  useEffect(() => {
    const shouldLoadTryoutSeasons =
      ((activeRole === 'club-admin' || activeRole === 'platform-admin') &&
        activeAdminSection === 'tryouts') ||
      ((activeRole === 'staff' ||
        activeRole === 'coach' ||
        activeRole === 'manager') &&
        activeUserSection === 'tryouts');

    if (!shouldLoadTryoutSeasons) return;
    if (!runtimeConfig || authSession?.status !== 'authenticated') return;

    const currentRuntimeConfig = runtimeConfig;
    const currentIdToken = authSession.idToken;
    let cancelled = false;

    async function loadSeasons() {
      setTryoutSeasonsLoading(true);

      try {
        const seasons = await loadTryoutSeasons(
          currentRuntimeConfig,
          currentIdToken,
        );
        if (cancelled) return;

        setTryoutSeasons(seasons);
        setTryoutSeasonsLoaded(true);
        setSelectedTryoutSeasonId((currentValue) =>
          currentValue && seasons.some((season) => season.id === currentValue)
            ? currentValue
            : seasons[0]?.id ?? null,
        );
      } catch (error) {
        if (cancelled) return;
        setFeedback({
          tone: 'error',
          message: getErrorMessage(error),
        });
      } finally {
        if (!cancelled) setTryoutSeasonsLoading(false);
      }
    }

    void loadSeasons();

    return () => {
      cancelled = true;
    };
  }, [
    activeAdminSection,
    activeRole,
    activeUserSection,
    authSession,
    runtimeConfig,
  ]);

  useEffect(() => {
    const selectedSeason =
      selectedTryoutSeasonId
        ? tryoutSeasons.find((season) => season.id === selectedTryoutSeasonId) ?? null
        : null;

    setTryoutSeasonDraft(
      selectedSeason ? cloneTryoutSeasonState(selectedSeason) : null,
    );
  }, [selectedTryoutSeasonId, tryoutSeasons]);

  async function runAction(
    actionKey: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    setBusyAction(actionKey);
    setFeedback(null);

    try {
      await operation();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: getErrorMessage(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSignIn(): Promise<void> {
    if (!runtimeConfig) return;

    await runAction('sign-in', async () => {
      await beginSignIn(runtimeConfig);
    });
  }

  async function handleSignOut(): Promise<void> {
    if (!runtimeConfig) return;

    await runAction('sign-out', async () => {
      await beginSignOut(runtimeConfig);
      setAccountMenuOpen(false);
    });
  }

  async function handleSavePrimaryRole(role: PrimaryRole): Promise<void> {
    if (!runtimeConfig || !authSession) return;

    await runAction(`save-role-${role}`, async () => {
      const nextBootstrap = await saveUserRole(
        runtimeConfig,
        authSession.idToken,
        role,
      );
      setBootstrap(nextBootstrap);
      setActiveRole(role);
      setSelectedPlayerId(nextBootstrap.players[0]?.id || 'new');
      setFeedback({
        tone: 'success',
        message: `This account is now set up as ${ROLE_LABELS[role].toLowerCase()}.`,
      });
    });
  }

  function updateUserDraftField(
    field: UserProfileFieldKey,
    value: string,
  ): void {
    setUserDraft((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            [field]: value,
          }
        : currentValue,
    );
  }

  function updateDraftPlayerProfileField<K extends keyof PlayerProfileInput>(
    field: K,
    value: PlayerProfileInput[K],
  ): void {
    setDraftPlayer((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            profile: {
              ...currentValue.profile,
              [field]: value,
            },
          }
        : currentValue,
    );
  }

  function updateDraftPlayerNames(
    field: 'firstName' | 'lastName',
    value: string,
  ): void {
    setDraftPlayer((currentValue) => {
      if (!currentValue) return currentValue;

      const nextProfile = {
        ...currentValue.profile,
        [field]: value,
      };

      return {
        ...currentValue,
        profile: {
          ...nextProfile,
          playerName: buildPlayerName(nextProfile.firstName, nextProfile.lastName),
        },
      };
    });
  }

  function updateDraftPlayerIntakeField<K extends keyof IntakeAnswers>(
    field: K,
    value: IntakeAnswers[K],
  ): void {
    setDraftPlayer((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            intake: {
              ...currentValue.intake,
              [field]: value,
            },
          }
        : currentValue,
    );
  }

  function addTeamHistoryEntry(): void {
    setDraftPlayer((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            profile: {
              ...currentValue.profile,
              teamHistory: [
                ...currentValue.profile.teamHistory,
                buildEmptyTeamHistoryEntry(),
              ],
            },
          }
        : currentValue,
    );
  }

  function updateTeamHistoryEntry(
    entryId: string,
    field: keyof Omit<PlayerTeamHistoryEntry, 'id'>,
    value: string,
  ): void {
    setDraftPlayer((currentValue) => {
      if (!currentValue) return currentValue;

      const nextTeamHistory = sortTeamHistoryEntries(
        currentValue.profile.teamHistory.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                [field]: value,
              }
            : entry,
        ),
      );

      return {
        ...currentValue,
        profile: {
          ...currentValue.profile,
          teamHistory: nextTeamHistory,
        },
      };
    });
  }

  function removeTeamHistoryEntry(entryId: string): void {
    setDraftPlayer((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            profile: {
              ...currentValue.profile,
              teamHistory: currentValue.profile.teamHistory.filter(
                (entry) => entry.id !== entryId,
              ),
            },
          }
        : currentValue,
    );
  }

  async function handleSaveCurrentUser(): Promise<void> {
    if (!runtimeConfig || !authSession || !userDraft) return;

    const firstName = userDraft.firstName.trim();
    const lastName = userDraft.lastName.trim();

    if (!firstName || !lastName) {
      setFeedback({
        tone: 'error',
        message: 'First name and last name are required to save your profile.',
      });
      return;
    }

    await runAction('save-user-profile', async () => {
      const nextBootstrap = await updateCurrentUserProfile(
        runtimeConfig,
        authSession.idToken,
        {
          firstName,
          lastName,
          contactEmail: userDraft.contactEmail.trim(),
          phoneNumber: userDraft.phoneNumber.trim(),
          smsOptIn: userDraft.smsOptIn,
        },
      );

      setBootstrap(nextBootstrap);
      setFeedback({
        tone: 'success',
        message: 'Your profile has been updated.',
      });
    });
  }

  async function handleClaimAdmin(): Promise<void> {
    if (!runtimeConfig || !authSession) return;

    await runAction('claim-admin', async () => {
      const nextBootstrap = await claimOrganizationAdmin(
        runtimeConfig,
        authSession.idToken,
      );
      setBootstrap(nextBootstrap);
      setActiveRole('club-admin');
      setAccountMenuOpen(false);
      setFeedback({
        tone: 'success',
        message: 'Organization admin access is now assigned to this account.',
      });
    });
  }

  async function handleSaveOrganization(): Promise<void> {
    if (!runtimeConfig || !authSession || !organizationDraft) return;

    await runAction('save-organization', async () => {
      const nextBootstrap = await updateOrganizationSettings(
        runtimeConfig,
        authSession.idToken,
        organizationDraft,
      );
      setBootstrap(nextBootstrap);
      setOrganizationDraft(buildOrganizationSettingsDraft(nextBootstrap.organization));
      setFeedback({
        tone: 'success',
        message: 'Organization settings have been updated.',
      });
    });
  }

  async function refreshEvaluationTemplateDirectory(
    currentRuntimeConfig: RuntimeConfig,
    currentIdToken: string | null,
    preferredTemplateId?: string | null,
  ): Promise<void> {
    const templates = await loadEvaluationTemplates(currentRuntimeConfig, currentIdToken);
    setEvaluationTemplates(templates);
    setEvaluationTemplatesLoaded(true);
    setSelectedEvaluationTemplateId((currentValue) => {
      const requestedId =
        preferredTemplateId === undefined ? currentValue : preferredTemplateId;

      if (requestedId && templates.some((template) => template.id === requestedId)) {
        return requestedId;
      }

      if (currentValue && templates.some((template) => template.id === currentValue)) {
        return currentValue;
      }

      return templates[0]?.id ?? null;
    });
  }

  function applyAdminUserFilters(nextFilters: AdminUserFiltersState): void {
    setAppliedAdminUserFilters(nextFilters);
    setAdminUsersCursor(null);
    setAdminUsersNextCursor(null);
    setAdminUsersHistory([]);
    setAdminUsersLoaded(false);
    setSelectedAdminUserId(null);
  }

  async function handleSaveAdminUser(): Promise<void> {
    if (
      !runtimeConfig ||
      authSession?.status !== 'authenticated' ||
      !adminUserDraft ||
      !selectedAdminUserId ||
      !bootstrap
    ) {
      return;
    }

    await runAction(`save-admin-user-${selectedAdminUserId}`, async () => {
      const updatedUser = await updateAdminUser(
        runtimeConfig,
        authSession.idToken,
        selectedAdminUserId,
        adminUserDraft,
      );

      const isSelfUpdate = selectedAdminUserId === bootstrap.user.userId;
      let nextBootstrap = bootstrap;

      if (isSelfUpdate) {
        nextBootstrap = await loadBootstrapData(runtimeConfig, authSession.idToken);
        setBootstrap(nextBootstrap);
      }

      if (
        !isSelfUpdate ||
        (
          nextBootstrap.user.accountStatus === 'ACTIVE' &&
          nextBootstrap.access.canManageOrganization
        )
      ) {
        const refreshedUsers = await loadAdminUsers(runtimeConfig, authSession.idToken, {
          ...appliedAdminUserFilters,
          cursor: adminUsersCursor,
          pageSize: ADMIN_USERS_PAGE_SIZE,
        });
        setAdminUsers(refreshedUsers.users);
        setAdminUsersNextCursor(refreshedUsers.nextCursor);
        setSelectedAdminUserId((currentValue) =>
          refreshedUsers.users.some((user) => user.userId === currentValue)
            ? currentValue
            : refreshedUsers.users.find((user) => user.userId === updatedUser.userId)?.userId ??
              refreshedUsers.users[0]?.userId ??
              null,
        );
      }

      setFeedback({
        tone: 'success',
        message:
          updatedUser.accountStatus === 'DISABLED'
            ? 'User access has been disabled.'
            : 'User access and role settings have been updated.',
      });
    });
  }

  function updateEvaluationTemplateName(value: string): void {
    setEvaluationTemplateDraft((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            name: value,
          }
        : currentValue,
    );
  }

  function updateEvaluationCriterionField(
    criterionId: string,
    field: 'title' | 'score1Description' | 'score3Description' | 'score5Description',
    value: string,
  ): void {
    setEvaluationTemplateDraft((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            criteria: currentValue.criteria.map((criterion) =>
              criterion.id === criterionId
                ? {
                    ...criterion,
                    [field]: value,
                  }
                : criterion,
            ),
          }
        : currentValue,
    );
  }

  function updateEvaluationCriterionWeight(
    criterionId: string,
    value: string,
  ): void {
    const nextWeight = normalizeCriterionWeightInput(value);
    setEvaluationTemplateDraft((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            criteria: currentValue.criteria.map((criterion) =>
              criterion.id === criterionId
                ? {
                    ...criterion,
                    weight: nextWeight,
                  }
                : criterion,
            ),
          }
        : currentValue,
    );
  }

  function addEvaluationCriterion(): void {
    setEvaluationTemplateDraft((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            criteria: [...currentValue.criteria, buildBlankEvaluationCriterion()],
          }
        : currentValue,
    );
  }

  function removeEvaluationCriterion(criterionId: string): void {
    setEvaluationTemplateDraft((currentValue) => {
      if (!currentValue || currentValue.criteria.length === 1) return currentValue;

      return {
        ...currentValue,
        criteria: currentValue.criteria.filter(
          (criterion) => criterion.id !== criterionId,
        ),
      };
    });
  }

  async function handleCreateEvaluationTemplate(
    mode: 'blank' | 'default' | 'copy',
  ): Promise<void> {
    if (!runtimeConfig || authSession?.status !== 'authenticated') return;
    if (mode === 'copy' && !selectedEvaluationTemplateId) return;

    await runAction(`create-template-${mode}`, async () => {
      const payload =
        mode === 'default'
          ? { useDefaultCriteria: true }
          : mode === 'copy'
            ? { sourceTemplateId: selectedEvaluationTemplateId ?? undefined }
            : {};
      const createdTemplate = await createEvaluationTemplate(
        runtimeConfig,
        authSession.idToken,
        payload,
      );
      await refreshEvaluationTemplateDirectory(
        runtimeConfig,
        authSession.idToken,
        createdTemplate.id,
      );
      setFeedback({
        tone: 'success',
        message:
          mode === 'default'
            ? 'A default evaluation template has been loaded and saved.'
            : mode === 'copy'
              ? 'A copy of the selected evaluation template is ready to edit.'
              : 'A new blank evaluation template has been created.',
      });
    });
  }

  async function handleSaveEvaluationTemplate(): Promise<void> {
    if (
      !runtimeConfig ||
      authSession?.status !== 'authenticated' ||
      !selectedEvaluationTemplateId ||
      !evaluationTemplateDraft
    ) {
      return;
    }

    await runAction(`save-template-${selectedEvaluationTemplateId}`, async () => {
      const updatedTemplate = await updateEvaluationTemplate(
        runtimeConfig,
        authSession.idToken,
        selectedEvaluationTemplateId,
        {
          name: evaluationTemplateDraft.name,
          criteria: evaluationTemplateDraft.criteria,
        },
      );
      await refreshEvaluationTemplateDirectory(
        runtimeConfig,
        authSession.idToken,
        updatedTemplate.id,
      );
      setFeedback({
        tone: 'success',
        message: 'Evaluation template changes have been saved.',
      });
    });
  }

  async function handleDeleteSelectedEvaluationTemplate(): Promise<void> {
    if (
      !runtimeConfig ||
      authSession?.status !== 'authenticated' ||
      !selectedEvaluationTemplateId ||
      !evaluationTemplates.some((template) => template.id === selectedEvaluationTemplateId)
    ) {
      return;
    }

    const templateToDelete =
      evaluationTemplates.find((template) => template.id === selectedEvaluationTemplateId) ??
      null;
    if (!templateToDelete) return;

    if (
      !window.confirm(
        `Delete "${templateToDelete.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    const fallbackTemplateId =
      evaluationTemplates.find((template) => template.id !== selectedEvaluationTemplateId)?.id ??
      null;

    await runAction(`delete-template-${selectedEvaluationTemplateId}`, async () => {
      await deleteEvaluationTemplate(
        runtimeConfig,
        authSession.idToken,
        selectedEvaluationTemplateId,
      );
      await refreshEvaluationTemplateDirectory(
        runtimeConfig,
        authSession.idToken,
        fallbackTemplateId,
      );
      setFeedback({
        tone: 'success',
        message: 'Evaluation template deleted.',
      });
    });
  }

  async function refreshTryoutSeasonDirectory(
    currentRuntimeConfig: RuntimeConfig,
    currentIdToken: string | null,
    preferredSeasonId?: string | null,
  ): Promise<void> {
    const seasons = await loadTryoutSeasons(currentRuntimeConfig, currentIdToken);
    setTryoutSeasons(seasons);
    setTryoutSeasonsLoaded(true);
    setSelectedTryoutSeasonId((currentValue) => {
      const requestedId =
        preferredSeasonId === undefined ? currentValue : preferredSeasonId;

      if (requestedId && seasons.some((season) => season.id === requestedId)) {
        return requestedId;
      }

      if (currentValue && seasons.some((season) => season.id === currentValue)) {
        return currentValue;
      }

      return seasons[0]?.id ?? null;
    });
  }

  function applyTryoutDraft(
    updater: (draft: TryoutSeason) => TryoutSeason,
  ): void {
    setTryoutSeasonDraft((currentValue) =>
      currentValue
        ? recalculateTryoutSeasonDraft(
            updater(cloneTryoutSeasonState(currentValue)),
          )
        : currentValue,
    );
  }

  async function handleCreateTryoutSeason(): Promise<void> {
    if (!runtimeConfig || authSession?.status !== 'authenticated') return;

    const trimmedName = newTryoutSeasonName.trim();
    if (!trimmedName) {
      setFeedback({
        tone: 'error',
        message: 'Add a tryout season name before creating it.',
      });
      return;
    }

    await runAction('create-tryout-season', async () => {
      const createdSeason = await createTryoutSeason(
        runtimeConfig,
        authSession.idToken,
        {
          name: trimmedName,
        },
      );
      await refreshTryoutSeasonDirectory(
        runtimeConfig,
        authSession.idToken,
        createdSeason.id,
      );
      setNewTryoutSeasonName('');
      setFeedback({
        tone: 'success',
        message: 'Tryout season created.',
      });
    });
  }

  async function handleSaveTryoutSeason(): Promise<void> {
    if (
      !runtimeConfig ||
      authSession?.status !== 'authenticated' ||
      !selectedTryoutSeasonId ||
      !tryoutSeasonDraft
    ) {
      return;
    }

    await runAction(`save-tryout-season-${selectedTryoutSeasonId}`, async () => {
      const updatedSeason = await updateTryoutSeason(
        runtimeConfig,
        authSession.idToken,
        selectedTryoutSeasonId,
        {
          name: tryoutSeasonDraft.name,
          groups: tryoutSeasonDraft.groups,
          teams: tryoutSeasonDraft.teams,
          sessions: tryoutSeasonDraft.sessions,
          playerOverrides: tryoutSeasonDraft.playerOverrides,
        },
      );
      await refreshTryoutSeasonDirectory(
        runtimeConfig,
        authSession.idToken,
        updatedSeason.id,
      );
      setFeedback({
        tone: 'success',
        message: 'Tryout setup changes have been saved.',
      });
    });
  }

  async function handleDeleteSelectedTryoutSeason(): Promise<void> {
    if (
      !runtimeConfig ||
      authSession?.status !== 'authenticated' ||
      !selectedTryoutSeasonId ||
      !tryoutSeasons.some((season) => season.id === selectedTryoutSeasonId)
    ) {
      return;
    }

    const seasonToDelete =
      tryoutSeasons.find((season) => season.id === selectedTryoutSeasonId) ?? null;
    if (!seasonToDelete) return;

    if (
      !window.confirm(
        `Delete "${seasonToDelete.name}"? This removes its groups, teams, and sessions.`,
      )
    ) {
      return;
    }

    const fallbackSeasonId =
      tryoutSeasons.find((season) => season.id !== selectedTryoutSeasonId)?.id ?? null;

    await runAction(`delete-tryout-season-${selectedTryoutSeasonId}`, async () => {
      await deleteTryoutSeason(
        runtimeConfig,
        authSession.idToken,
        selectedTryoutSeasonId,
      );
      await refreshTryoutSeasonDirectory(
        runtimeConfig,
        authSession.idToken,
        fallbackSeasonId,
      );
      setFeedback({
        tone: 'success',
        message: 'Tryout season deleted.',
      });
    });
  }

  function updateTryoutSeasonName(value: string): void {
    setTryoutSeasonDraft((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            name: value,
          }
        : currentValue,
    );
  }

  function addTryoutGroup(): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      groups: [
        ...draft.groups,
        {
          id: crypto.randomUUID(),
          name: `New group ${draft.groups.length + 1}`,
          allowedBirthYears: [],
          allowedGenders: [...TRYOUT_GENDERS],
        },
      ],
    }));
  }

  function updateTryoutGroupName(groupId: string, value: string): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      groups: draft.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              name: value,
            }
          : group,
      ),
    }));
  }

  function toggleTryoutGroupBirthYear(
    groupId: string,
    birthYear: string,
    checked: boolean,
  ): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      groups: draft.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              allowedBirthYears: sortTryoutBirthYears(
                checked
                  ? [...new Set([...group.allowedBirthYears, birthYear])]
                  : group.allowedBirthYears.filter((entry) => entry !== birthYear),
              ),
            }
          : group,
      ),
    }));
  }

  function toggleTryoutGroupGender(
    groupId: string,
    gender: TryoutGender,
    checked: boolean,
  ): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      groups: draft.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              allowedGenders: checked
                ? [...new Set([...group.allowedGenders, gender])]
                : group.allowedGenders.filter((entry) => entry !== gender),
            }
          : group,
      ),
    }));
  }

  function removeTryoutGroup(groupId: string): void {
    applyTryoutDraft((draft) => {
      const removedTeamIds = new Set(
        draft.teams
          .filter((team) => team.groupId === groupId)
          .map((team) => team.id),
      );

      return {
        ...draft,
        groups: draft.groups.filter((group) => group.id !== groupId),
        teams: draft.teams.filter((team) => team.groupId !== groupId),
        sessions: draft.sessions.map((session) => ({
          ...session,
          teamIds: session.teamIds.filter((teamId) => !removedTeamIds.has(teamId)),
        })),
        playerOverrides: draft.playerOverrides.map((override) => ({
          ...override,
          assignmentMode:
            override.assignmentMode === 'manual' && override.groupId === groupId
              ? 'unassigned'
              : override.assignmentMode,
          groupId: override.groupId === groupId ? null : override.groupId,
          teamId:
            override.teamId && removedTeamIds.has(override.teamId)
              ? null
              : override.teamId,
        })),
      };
    });
  }

  function setTryoutPlayerAssignment(
    playerId: string,
    assignmentMode: TryoutPlayerAssignmentMode,
    groupId: string | null,
  ): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      playerOverrides: updateTryoutPlayerOverridesState(
        draft.playerOverrides,
        playerId,
        (override) => ({
          ...override,
          assignmentMode,
          groupId: assignmentMode === 'manual' ? groupId : null,
          teamId:
            assignmentMode === 'manual' &&
            groupId &&
            override.teamId &&
            draft.teams.some(
              (team) => team.id === override.teamId && team.groupId === groupId,
            )
              ? override.teamId
              : null,
        }),
      ),
    }));
  }

  function addTryoutTeam(groupId: string): void {
    applyTryoutDraft((draft) => {
      const nextTeamNumber =
        draft.teams.filter((team) => team.groupId === groupId).length + 1;

      return {
        ...draft,
        teams: [
          ...draft.teams,
          {
            id: crypto.randomUUID(),
            groupId,
            name: `Team ${nextTeamNumber}`,
          },
        ],
      };
    });
  }

  function updateTryoutTeamName(teamId: string, value: string): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      teams: draft.teams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              name: value,
            }
          : team,
      ),
    }));
  }

  function removeTryoutTeam(teamId: string): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      teams: draft.teams.filter((team) => team.id !== teamId),
      sessions: draft.sessions.map((session) => ({
        ...session,
        teamIds: session.teamIds.filter((currentTeamId) => currentTeamId !== teamId),
      })),
      playerOverrides: draft.playerOverrides.map((override) => ({
        ...override,
        teamId: override.teamId === teamId ? null : override.teamId,
      })),
    }));
  }

  function assignTryoutPlayerToTeam(
    playerId: string,
    teamId: string | null,
  ): void {
    applyTryoutDraft((draft) => {
      const player = draft.players.find((entry) => entry.playerId === playerId) ?? null;
      const nextTeam =
        teamId ? draft.teams.find((team) => team.id === teamId) ?? null : null;

      if (teamId && (!player || !nextTeam || nextTeam.groupId !== player.effectiveGroupId)) {
        return draft;
      }

      return {
        ...draft,
        playerOverrides: updateTryoutPlayerOverridesState(
          draft.playerOverrides,
          playerId,
          (override) => ({
            ...override,
            teamId,
          }),
        ),
      };
    });
  }

  function updateTryoutPlayerJersey(
    playerId: string,
    value: string,
  ): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      playerOverrides: updateTryoutPlayerOverridesState(
        draft.playerOverrides,
        playerId,
        (override) => ({
          ...override,
          jerseyNumber: value.trim(),
        }),
      ),
    }));
  }

  function addTryoutSession(): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      sessions: [
        ...draft.sessions,
        {
          id: crypto.randomUUID(),
          name: `Session ${draft.sessions.length + 1}`,
          teamIds: [],
        },
      ],
    }));
  }

  function updateTryoutSessionName(sessionId: string, value: string): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      sessions: draft.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              name: value,
            }
          : session,
      ),
    }));
  }

  function toggleTryoutSessionTeam(
    sessionId: string,
    teamId: string,
    checked: boolean,
  ): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      sessions: draft.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              teamIds: checked
                ? [...new Set([...session.teamIds, teamId])]
                : session.teamIds.filter((entry) => entry !== teamId),
            }
          : session,
      ),
    }));
  }

  function removeTryoutSession(sessionId: string): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      sessions: draft.sessions.filter((session) => session.id !== sessionId),
    }));
  }

  async function handleSavePlayer(nextStatus: IntakeStatus): Promise<void> {
    if (!runtimeConfig || !authSession || !draftPlayer) return;

    const actionKey =
      draftPlayer.id === null ? `create-${nextStatus}` : `update-${nextStatus}`;

    await runAction(actionKey, async () => {
      const payload = {
        profile: draftPlayer.profile,
        intake: draftPlayer.intake,
        intakeStatus: nextStatus,
      };

      const response =
        draftPlayer.id === null
          ? await createPlayer(runtimeConfig, authSession.idToken, payload)
          : await updatePlayer(
              runtimeConfig,
              authSession.idToken,
              draftPlayer.id,
              payload,
            );

      setBootstrap(response.bootstrap);
      setSelectedPlayerId(response.player.id);
      setDraftPlayer(buildEditablePlayerState(response.player));
      setFeedback({
        tone: 'success',
        message:
          nextStatus === 'submitted'
            ? 'The intake form has been submitted.'
            : 'The intake draft has been saved.',
      });
    });
  }

  async function handleCreateInvite(): Promise<void> {
    if (
      !runtimeConfig ||
      !authSession ||
      !inviteEmail.trim() ||
      !selectedPlayerId ||
      selectedPlayerId === 'new'
    ) {
      return;
    }

    const invitedRole = resolveInviteRole(activeRole);
    if (!invitedRole) return;

    await runAction('create-invite', async () => {
      const response = await createInvite(
        runtimeConfig,
        authSession.idToken,
        selectedPlayerId,
        {
          invitedEmail: inviteEmail.trim(),
          invitedRole,
        },
      );
      setBootstrap(response.bootstrap);
      setInviteEmail('');
      setFeedback({
        tone: 'success',
        message: `${ROLE_LABELS[invitedRole]} invite sent to ${response.invite.invitedEmail}.`,
      });
    });
  }

  async function handleAcceptInvite(inviteId: string): Promise<void> {
    if (!runtimeConfig || !authSession) return;

    await runAction(`accept-invite-${inviteId}`, async () => {
      const nextBootstrap = await acceptInvite(
        runtimeConfig,
        authSession.idToken,
        inviteId,
      );
      setBootstrap(nextBootstrap);
      setFeedback({
        tone: 'success',
        message: 'Invite accepted and the player account is now linked.',
      });
    });
  }

  async function handleDeclineInvite(inviteId: string): Promise<void> {
    if (!runtimeConfig || !authSession) return;

    await runAction(`decline-invite-${inviteId}`, async () => {
      const nextBootstrap = await declineInvite(
        runtimeConfig,
        authSession.idToken,
        inviteId,
      );
      setBootstrap(nextBootstrap);
      setFeedback({
        tone: 'success',
        message: 'Invite declined.',
      });
    });
  }

  async function handleRevokeInvite(inviteId: string): Promise<void> {
    if (!runtimeConfig || !authSession) return;

    await runAction(`revoke-invite-${inviteId}`, async () => {
      const nextBootstrap = await revokeInvite(
        runtimeConfig,
        authSession.idToken,
        inviteId,
      );
      setBootstrap(nextBootstrap);
      setFeedback({
        tone: 'success',
        message: 'Invite revoked.',
      });
    });
  }

  if (isLoading || !runtimeConfig || !authSession) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <p className="eyebrow">Golden Bears Player Portal</p>
          <h1>Loading portal</h1>
          <p>
            Restoring the NC Golden Bears workspace and checking your sign-in
            status.
          </p>
        </div>
      </div>
    );
  }

  if (authSession.status === 'guest') {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <p className="eyebrow">Golden Bears Player Portal</p>
          <h1>Sign in to continue</h1>
          <p>
            Create an account or sign in to complete player intake and manage
            linked family access.
          </p>
          <div className="action-row">
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                void handleSignIn();
              }}
              disabled={busyAction === 'sign-in'}
            >
              {busyAction === 'sign-in' ? 'Redirecting...' : 'Sign in or create account'}
            </button>
          </div>
          {feedback ? (
            <div className={`feedback-banner feedback-banner--${feedback.tone}`}>
              {feedback.message}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <p className="eyebrow">Golden Bears Player Portal</p>
          <h1>Portal data was unavailable</h1>
          <p>
            We could not load the current portal session. Try signing out and
            back in, or refresh the page.
          </p>
          {feedback ? (
            <div className={`feedback-banner feedback-banner--${feedback.tone}`}>
              {feedback.message}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const availableRoles = getAvailableRoles(bootstrap);
  const selectedPlayer =
    selectedPlayerId && selectedPlayerId !== 'new'
      ? bootstrap.players.find((player) => player.id === selectedPlayerId) || null
      : null;
  const familyRole = resolveFamilyRole(activeRole, bootstrap.user.primaryRole);
  const currentInviteRole = resolveInviteRole(familyRole);
  const playerCount = bootstrap.players.length;
  const submittedCount = bootstrap.players.filter(
    (player) => player.intake.status === 'submitted',
  ).length;
  const draftCount = bootstrap.players.filter(
    (player) => player.intake.status === 'draft',
  ).length;
  const pendingSentInvites = bootstrap.players.reduce(
    (count, player) =>
      count +
      player.sentInvites.filter((invite) => invite.status === 'pending').length,
    0,
  );
  const recentSeasonOptions = buildRecentSeasonOptions();
  const activeWorkspaceTitle = activeRole ? ROLE_LABELS[activeRole] : 'Select role';
  const activeWorkspaceCopy = describeWorkspace(activeRole, bootstrap.user.primaryRole);
  const accountDisplayName = getUserDisplayName(bootstrap.user);
  const isAdminWorkspace =
    activeRole === 'club-admin' || activeRole === 'platform-admin';
  const isAccountDisabled = bootstrap.user.accountStatus === 'DISABLED';
  const userWorkspaceSections = getUserWorkspaceSections(
    activeRole,
    bootstrap.user.primaryRole,
  );
  const selectedAdminUser =
    selectedAdminUserId
      ? adminUsers.find((user) => user.userId === selectedAdminUserId) ?? null
      : null;
  const selectedEvaluationTemplate =
    selectedEvaluationTemplateId
      ? evaluationTemplates.find((template) => template.id === selectedEvaluationTemplateId) ??
        null
      : null;
  const evaluationTemplateTotalWeight = evaluationTemplateDraft
    ? evaluationTemplateDraft.criteria.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      )
    : 0;
  const tryoutSetupCard = (
    <TryoutSetupCard
      roleLabel={activeWorkspaceTitle}
      seasons={tryoutSeasons}
      draft={tryoutSeasonDraft}
      loaded={tryoutSeasonsLoaded}
      loading={tryoutSeasonsLoading}
      newSeasonName={newTryoutSeasonName}
      busyAction={busyAction}
      draggingPlayerId={draggingTryoutPlayerId}
      onNewSeasonNameChange={setNewTryoutSeasonName}
      onCreateSeason={() => {
        void handleCreateTryoutSeason();
      }}
      onSelectSeason={setSelectedTryoutSeasonId}
      onDeleteSeason={() => {
        void handleDeleteSelectedTryoutSeason();
      }}
      onSeasonNameChange={updateTryoutSeasonName}
      onSaveSeason={() => {
        void handleSaveTryoutSeason();
      }}
      onAddGroup={addTryoutGroup}
      onUpdateGroupName={updateTryoutGroupName}
      onToggleGroupBirthYear={toggleTryoutGroupBirthYear}
      onToggleGroupGender={toggleTryoutGroupGender}
      onRemoveGroup={removeTryoutGroup}
      onSetPlayerAssignment={setTryoutPlayerAssignment}
      onAddTeam={addTryoutTeam}
      onUpdateTeamName={updateTryoutTeamName}
      onRemoveTeam={removeTryoutTeam}
      onAssignPlayerToTeam={assignTryoutPlayerToTeam}
      onUpdatePlayerJersey={updateTryoutPlayerJersey}
      onAddSession={addTryoutSession}
      onUpdateSessionName={updateTryoutSessionName}
      onToggleSessionTeam={toggleTryoutSessionTeam}
      onRemoveSession={removeTryoutSession}
      onStartPlayerDrag={setDraggingTryoutPlayerId}
    />
  );
  const userProfileCard = userDraft ? (
    <UserProfileCard
      signInEmail={bootstrap.user.email}
      userDraft={userDraft}
      busyAction={busyAction}
      onFieldChange={updateUserDraftField}
      onSmsOptInChange={(value) => {
        setUserDraft((currentValue) =>
          currentValue
            ? {
                ...currentValue,
                smsOptIn: value,
              }
            : currentValue,
        );
      }}
      onSave={() => {
        void handleSaveCurrentUser();
      }}
    />
  ) : null;
  const workspaceAccessCard = (
    <article className="card">
      <div className="sidebar-header">
        <div>
          <p className="section-eyebrow">Current Access</p>
          <h3>Available workspaces</h3>
        </div>
      </div>
      <div className="stack-list">
        {bootstrap.access.organizations.map((organizationAccess) => (
          <div
            key={organizationAccess.organizationId}
            className={`stack-card ${
              organizationAccess.organizationId === bootstrap.access.activeOrganizationId
                ? 'stack-card--highlight'
                : ''
            }`}
          >
            <div>
              <strong>{organizationAccess.name}</strong>
              <p>
                {organizationAccess.roles.length > 0
                  ? organizationAccess.roles.map((role) => ROLE_LABELS[role]).join(', ')
                  : 'No assigned roles yet'}
              </p>
            </div>
          </div>
        ))}

        {availableRoles.map((role) => (
          <button
            key={role}
            className={`role-card ${role === activeRole ? 'option-card--selected' : ''}`}
            type="button"
            onClick={() => {
              setActiveRole(role);
            }}
          >
            <strong>{ROLE_LABELS[role]}</strong>
            <span>
              {role === activeRole
                ? 'Currently active in this session.'
                : 'Switch to this workspace.'}
            </span>
          </button>
        ))}
      </div>
    </article>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">
            <img
              src={bootstrap.organization.logoUrl}
              alt={`${bootstrap.organization.shortName} logo`}
            />
          </div>
          <div className="brand-copy">
            <p className="eyebrow">{bootstrap.organization.shortName}</p>
            <h1>Golden Bears Player Portal</h1>
            <p>
              One place for player intake, family access, and staff-side hockey
              operations as the portal grows.
            </p>
            <div className="brand-meta">
              <span className="status-chip">
                Tier 2 tryouts {bootstrap.organization.tryoutWindowLabel}
              </span>
              <a
                className="link-button"
                href={bootstrap.organization.website}
                target="_blank"
                rel="noreferrer"
              >
                Open club website
              </a>
            </div>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="workspace-badge">
            <span className="workspace-badge__label">Workspace</span>
            <strong>{activeWorkspaceTitle}</strong>
          </div>
          <div className="account-menu" ref={accountMenuRef}>
            <button
              className="account-trigger"
              type="button"
              onClick={() => {
                setAccountMenuOpen((currentValue) => !currentValue);
              }}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
            >
              <span className="account-avatar">
                {getInitials(
                  bootstrap.user.firstName,
                  bootstrap.user.lastName,
                  bootstrap.access.email,
                )}
              </span>
              <span className="account-trigger__text">
                <strong>{accountDisplayName || 'Account'}</strong>
                <span>{bootstrap.access.email}</span>
              </span>
            </button>

            {accountMenuOpen ? (
              <div className="account-popover" role="menu">
                <div className="account-popover__section">
                  <p className="section-eyebrow">Signed in</p>
                  <strong>{accountDisplayName || bootstrap.access.email}</strong>
                  <p className="helper-copy">Sign-in email: {bootstrap.access.email}</p>
                  <p className="helper-copy">{activeWorkspaceCopy}</p>
                </div>

                {!isAccountDisabled ? (
                  <div className="account-popover__section">
                    <p className="section-eyebrow">Switch workspace</p>
                    <div className="menu-role-list">
                      {availableRoles.map((role) => (
                        <button
                          key={role}
                          className={`menu-role-button ${
                            role === activeRole ? 'menu-role-button--active' : ''
                          }`}
                          type="button"
                          onClick={() => {
                            setActiveRole(role);
                            setAccountMenuOpen(false);
                          }}
                        >
                          <span>{ROLE_LABELS[role]}</span>
                          {role === activeRole ? <strong>Current</strong> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {bootstrap.admin.canClaimOrganizationAdmin && !isAccountDisabled ? (
                  <div className="account-popover__section">
                    <button
                      className="secondary-button account-action-button"
                      type="button"
                      onClick={() => {
                        void handleClaimAdmin();
                      }}
                      disabled={busyAction === 'claim-admin'}
                    >
                      {busyAction === 'claim-admin'
                        ? 'Assigning admin access...'
                        : 'Assign me as organization admin'}
                    </button>
                  </div>
                ) : null}

                <div className="account-popover__section">
                  <button
                    className="ghost-button account-action-button"
                    type="button"
                    onClick={() => {
                      void handleSignOut();
                    }}
                    disabled={busyAction === 'sign-out'}
                  >
                    {busyAction === 'sign-out' ? 'Signing out...' : 'Log out'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {feedback ? (
        <div className={`feedback-banner feedback-banner--${feedback.tone}`}>
          {feedback.message}
        </div>
      ) : null}

      {bootstrap.admin.canClaimOrganizationAdmin && !isAccountDisabled ? (
        <section className="card card--highlight">
          <div className="card-header">
            <div>
              <p className="section-eyebrow">Organization Administration</p>
              <h2>Assign this account as the first NC Golden Bears admin</h2>
              <p className="section-copy">
                This account is eligible to claim organization admin access for
                the current environment. Once assigned, you can switch between
                family and admin workspaces from the account menu in the upper
                right.
              </p>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                void handleClaimAdmin();
              }}
              disabled={busyAction === 'claim-admin'}
            >
              {busyAction === 'claim-admin'
                ? 'Assigning admin access...'
                : 'Assign me as admin'}
            </button>
          </div>
        </section>
      ) : null}

      {!isAccountDisabled && isAdminWorkspace ? (
        <section className="summary-strip">
          <article className="summary-card">
            <span>Total players</span>
            <strong>{bootstrap.admin.summary?.totalPlayers ?? 0}</strong>
          </article>
          <article className="summary-card">
            <span>Submitted intakes</span>
            <strong>{bootstrap.admin.summary?.submittedIntakes ?? 0}</strong>
          </article>
          <article className="summary-card">
            <span>Draft intakes</span>
            <strong>{bootstrap.admin.summary?.draftIntakes ?? 0}</strong>
          </article>
          <article className="summary-card">
            <span>Pending invites</span>
            <strong>{bootstrap.admin.summary?.pendingInvites ?? 0}</strong>
          </article>
        </section>
      ) : !isAccountDisabled && familyRole ? (
        <section className="summary-strip">
          <article className="summary-card">
            <span>Linked players</span>
            <strong>{playerCount}</strong>
          </article>
          <article className="summary-card">
            <span>Submitted intakes</span>
            <strong>{submittedCount}</strong>
          </article>
          <article className="summary-card">
            <span>Draft intakes</span>
            <strong>{draftCount}</strong>
          </article>
          <article className="summary-card">
            <span>Pending invites</span>
            <strong>{pendingSentInvites + bootstrap.receivedInvites.length}</strong>
          </article>
        </section>
      ) : null}

      <main className="app-content">
        {isAccountDisabled ? (
          <section className="workspace-grid">
            <div className="workspace-main">
              <article className="card">
                <div className="card-header">
                  <div>
                    <p className="section-eyebrow">Account Status</p>
                    <h2>This portal account is currently disabled</h2>
                    <p className="section-copy">
                      Sign-in is still working, but this account cannot use the
                      portal until a club administrator re-enables access.
                      Contact the NC Golden Bears staff if you believe this was
                      done in error.
                    </p>
                  </div>
                  <span className="status-chip status-chip--warning">Disabled</span>
                </div>

                <div className="stack-list">
                  <div className="stack-card stack-card--warning">
                    <div>
                      <strong>What this means</strong>
                      <p>
                        Player, parent, and staff workflows are paused for this
                        login until an organization admin restores access.
                      </p>
                    </div>
                  </div>
                  <div className="stack-card">
                    <div>
                      <strong>Who can help</strong>
                      <p>
                        A current NC Golden Bears organization admin can
                        re-enable the account from the admin user directory.
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <div className="workspace-sidebar">
              <article className="card">
                <div className="card-header">
                  <div>
                    <p className="section-eyebrow">Need Anything Else?</p>
                    <h3>Sign out of this session</h3>
                  </div>
                </div>
                <p className="section-copy">
                  You can safely log out and return after a club administrator
                  has restored access.
                </p>
                <div className="footer-note">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      void handleSignOut();
                    }}
                    disabled={busyAction === 'sign-out'}
                  >
                    {busyAction === 'sign-out' ? 'Signing out...' : 'Log out'}
                  </button>
                </div>
              </article>
            </div>
          </section>
        ) : isAdminWorkspace ? (
          <section className="workspace-grid workspace-grid--single">
            <div className="workspace-main">
              <article className="card">
                <div className="card-header">
                  <div>
                    <p className="section-eyebrow">Admin Workspace</p>
                    <h2>Organization operations</h2>
                    <p className="section-copy">
                      Move between club overview, organization configuration,
                      evaluation templates, user management, and occasional
                      account tools from one vertical admin shell.
                    </p>
                  </div>
                  <span className="status-chip">
                    {ROLE_LABELS[activeRole]}
                  </span>
                </div>

                <div className="admin-nav">
                  {([
                    ['overview', 'Overview'],
                    ['organization', 'Organization'],
                    ['tryouts', 'Tryouts'],
                    ['templates', 'Evaluations'],
                    ['users', 'Users'],
                    ['profile', 'My Profile'],
                    ['access', 'Access'],
                    ['architecture', 'Architecture'],
                  ] as Array<[AdminWorkspaceView, string]>).map(([view, label]) => (
                    <button
                      key={view}
                      className={`admin-nav__button ${
                        activeAdminSection === view ? 'admin-nav__button--active' : ''
                      }`}
                      type="button"
                      onClick={() => {
                        setActiveAdminSection(view);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {activeAdminSection === 'overview' ? (
                  <div className="stack-list admin-overview-grid">
                    <div className="stack-card stack-card--highlight">
                      <div>
                        <strong>Club admin functions are now role-aware</strong>
                        <p>
                          Organization admins can monitor volume, keep club
                          settings current, and manage user access without
                          leaving the portal shell.
                        </p>
                      </div>
                    </div>
                    <div className="stack-card">
                      <div>
                        <strong>User management is live</strong>
                        <p>
                          Review portal users, correct parent versus player
                          onboarding mistakes, assign coach or organization
                          admin access, and disable accounts when needed.
                        </p>
                      </div>
                    </div>
                    <div className="stack-card">
                      <div>
                        <strong>Evaluation templates are live</strong>
                        <p>
                          Club admins can now build weighted score sheets with
                          editable 1, 3, and 5 observable anchors, then copy
                          them forward as tryout needs change by age group.
                        </p>
                      </div>
                    </div>
                    <div className="stack-card">
                      <div>
                        <strong>Shared login still stays intact</strong>
                        <p>
                          The same sign-in can support family and staff
                          workspaces, while organization access remains scoped
                          under the hood for future multi-club growth.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeAdminSection === 'organization' && organizationDraft ? (
                  <>
                    <div className="form-section">
                      <h3>Organization profile</h3>
                      <div className="field-grid">
                        <label className="field">
                          <span>Organization name</span>
                          <input
                            type="text"
                            value={organizationDraft.name}
                            onChange={(event) => {
                              setOrganizationDraft((currentValue) =>
                                currentValue
                                  ? {
                                      ...currentValue,
                                      name: event.target.value,
                                    }
                                  : currentValue,
                              );
                            }}
                          />
                        </label>

                        <label className="field">
                          <span>Short name</span>
                          <input
                            type="text"
                            value={organizationDraft.shortName}
                            onChange={(event) => {
                              setOrganizationDraft((currentValue) =>
                                currentValue
                                  ? {
                                      ...currentValue,
                                      shortName: event.target.value,
                                    }
                                  : currentValue,
                              );
                            }}
                          />
                        </label>

                        <label className="field">
                          <span>Website</span>
                          <input
                            type="url"
                            value={organizationDraft.website}
                            onChange={(event) => {
                              setOrganizationDraft((currentValue) =>
                                currentValue
                                  ? {
                                      ...currentValue,
                                      website: event.target.value,
                                    }
                                  : currentValue,
                              );
                            }}
                          />
                        </label>

                        <label className="field">
                          <span>Logo URL</span>
                          <input
                            type="url"
                            value={organizationDraft.logoUrl}
                            onChange={(event) => {
                              setOrganizationDraft((currentValue) =>
                                currentValue
                                  ? {
                                      ...currentValue,
                                      logoUrl: event.target.value,
                                    }
                                  : currentValue,
                              );
                            }}
                          />
                        </label>

                        <label className="field">
                          <span>Primary color</span>
                          <input
                            type="color"
                            value={organizationDraft.primaryColor}
                            onChange={(event) => {
                              setOrganizationDraft((currentValue) =>
                                currentValue
                                  ? {
                                      ...currentValue,
                                      primaryColor: event.target.value,
                                    }
                                  : currentValue,
                              );
                            }}
                          />
                        </label>

                        <label className="field">
                          <span>Secondary color</span>
                          <input
                            type="color"
                            value={organizationDraft.secondaryColor}
                            onChange={(event) => {
                              setOrganizationDraft((currentValue) =>
                                currentValue
                                  ? {
                                      ...currentValue,
                                      secondaryColor: event.target.value,
                                    }
                                  : currentValue,
                              );
                            }}
                          />
                        </label>

                        <label className="field">
                          <span>Tryout window label</span>
                          <input
                            type="text"
                            value={organizationDraft.tryoutWindowLabel}
                            onChange={(event) => {
                              setOrganizationDraft((currentValue) =>
                                currentValue
                                  ? {
                                      ...currentValue,
                                      tryoutWindowLabel: event.target.value,
                                    }
                                  : currentValue,
                              );
                            }}
                          />
                        </label>

                        <label className="field">
                          <span>Tryout start</span>
                          <input
                            type="date"
                            value={organizationDraft.tryoutWindowStart}
                            onChange={(event) => {
                              setOrganizationDraft((currentValue) =>
                                currentValue
                                  ? {
                                      ...currentValue,
                                      tryoutWindowStart: event.target.value,
                                    }
                                  : currentValue,
                              );
                            }}
                          />
                        </label>

                        <label className="field">
                          <span>Tryout end</span>
                          <input
                            type="date"
                            value={organizationDraft.tryoutWindowEnd}
                            onChange={(event) => {
                              setOrganizationDraft((currentValue) =>
                                currentValue
                                  ? {
                                      ...currentValue,
                                      tryoutWindowEnd: event.target.value,
                                    }
                                  : currentValue,
                              );
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="form-section">
                      <h3>Intake introduction</h3>
                      <label className="field">
                        <span>Parent and player guidance shown on the intake form</span>
                        <textarea
                          value={organizationDraft.intakeIntro}
                          onChange={(event) => {
                            setOrganizationDraft((currentValue) =>
                              currentValue
                                ? {
                                    ...currentValue,
                                    intakeIntro: event.target.value,
                                  }
                                : currentValue,
                            );
                          }}
                        />
                      </label>
                    </div>

                    <div className="footer-note">
                      <div className="action-row">
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() => {
                            void handleSaveOrganization();
                          }}
                          disabled={busyAction === 'save-organization'}
                        >
                          {busyAction === 'save-organization'
                            ? 'Saving organization...'
                            : 'Save organization settings'}
                        </button>
                        <a
                          className="link-button"
                          href={bootstrap.organization.website}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Visit club site
                        </a>
                      </div>
                    </div>
                  </>
                ) : null}

                {activeAdminSection === 'tryouts' ? tryoutSetupCard : null}

                {activeAdminSection === 'templates' ? (
                  <div className="admin-templates-layout">
                    <article className="card">
                      <div className="card-header">
                        <div>
                          <p className="section-eyebrow">Evaluation Templates</p>
                          <h3>Score sheet library</h3>
                          <p className="section-copy">
                            Create club-managed templates, start from the
                            default criteria set, or copy an existing sheet
                            before tuning the weights and observable anchors.
                          </p>
                        </div>
                      </div>

                      <div className="action-row">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            void handleCreateEvaluationTemplate('blank');
                          }}
                          disabled={busyAction === 'create-template-blank'}
                        >
                          {busyAction === 'create-template-blank'
                            ? 'Creating...'
                            : 'New blank template'}
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            void handleCreateEvaluationTemplate('default');
                          }}
                          disabled={busyAction === 'create-template-default'}
                        >
                          {busyAction === 'create-template-default'
                            ? 'Loading defaults...'
                            : 'Load defaults'}
                        </button>
                      </div>

                      <div className="stack-list template-list">
                        {!evaluationTemplatesLoaded && evaluationTemplatesLoading ? (
                          <div className="empty-state-card">
                            <strong>Loading evaluation templates...</strong>
                            <p>
                              Pulling the current score sheet library from the
                              organization settings.
                            </p>
                          </div>
                        ) : evaluationTemplates.length === 0 ? (
                          <div className="empty-state-card">
                            <strong>No templates created yet</strong>
                            <p>
                              Start with a blank template or load the default
                              criteria as a quick starting point.
                            </p>
                          </div>
                        ) : (
                          evaluationTemplates.map((template) => (
                            <button
                              key={template.id}
                              className={`template-list-item ${
                                template.id === selectedEvaluationTemplateId
                                  ? 'template-list-item--active'
                                  : ''
                              }`}
                              type="button"
                              onClick={() => {
                                setSelectedEvaluationTemplateId(template.id);
                              }}
                            >
                              <div className="template-list-item__content">
                                <strong>{template.name}</strong>
                                <p>
                                  {template.criteria.length} criteria - updated{' '}
                                  {formatTimestamp(template.updatedAt)}
                                </p>
                              </div>
                              <span className="status-chip">
                                {template.criteria.reduce(
                                  (total, criterion) => total + criterion.weight,
                                  0,
                                )}{' '}
                                total weight
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </article>

                    <article className="card">
                      <div className="card-header">
                        <div>
                          <p className="section-eyebrow">Template Editor</p>
                          <h3>
                            {evaluationTemplateDraft?.name ||
                              selectedEvaluationTemplate?.name ||
                              'Choose a template'}
                          </h3>
                          <p className="section-copy">
                            Every criterion scores from 1 to 5. The written 1,
                            3, and 5 anchors help evaluators normalize what
                            each score means; 2 and 4 sit between those anchor
                            descriptions.
                          </p>
                        </div>
                        {selectedEvaluationTemplate ? (
                          <span className="status-chip">
                            {evaluationTemplateDraft?.criteria.length ??
                              selectedEvaluationTemplate.criteria.length}{' '}
                            criteria
                          </span>
                        ) : null}
                      </div>

                      {selectedEvaluationTemplate && evaluationTemplateDraft ? (
                        <>
                          <div className="action-row">
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                void handleCreateEvaluationTemplate('copy');
                              }}
                              disabled={busyAction === 'create-template-copy'}
                            >
                              {busyAction === 'create-template-copy'
                                ? 'Copying...'
                                : 'Copy template'}
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => {
                                void handleDeleteSelectedEvaluationTemplate();
                              }}
                              disabled={
                                busyAction ===
                                `delete-template-${selectedEvaluationTemplate.id}`
                              }
                            >
                              {busyAction ===
                              `delete-template-${selectedEvaluationTemplate.id}`
                                ? 'Deleting...'
                                : 'Delete template'}
                            </button>
                          </div>

                          <div className="stack-list template-guidance">
                            <div className="stack-card">
                              <div>
                                <strong>Weights are 1 to 100 per criterion</strong>
                                <p>
                                  Use higher weights for criteria that matter
                                  more at a given age or in a specific
                                  evaluation context. Current total weight:{' '}
                                  {evaluationTemplateTotalWeight}.
                                </p>
                              </div>
                            </div>
                            <div className="stack-card">
                              <div>
                                <strong>Default templates start balanced</strong>
                                <p>
                                  Loading defaults starts every criterion at
                                  weight 50 so the staff can rebalance from an
                                  even baseline instead of starting from zero.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="form-section">
                            <h3>Template details</h3>
                            <div className="field-grid">
                              <label className="field">
                                <span>Template name</span>
                                <input
                                  type="text"
                                  value={evaluationTemplateDraft.name}
                                  onChange={(event) => {
                                    updateEvaluationTemplateName(
                                      event.target.value,
                                    );
                                  }}
                                  placeholder="Example: 2013-14U skater tryouts"
                                />
                              </label>
                            </div>
                          </div>

                          <div className="form-section">
                            <div className="team-history-header">
                              <div>
                                <h3>Criteria and score anchors</h3>
                                <p className="helper-copy">
                                  Keep each criterion and its 1, 3, and 5
                                  anchor descriptions clear enough that
                                  different evaluators can interpret them the
                                  same way.
                                </p>
                              </div>
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={addEvaluationCriterion}
                              >
                                Add criterion
                              </button>
                            </div>

                            <div className="criteria-list">
                              {evaluationTemplateDraft.criteria.map(
                                (criterion, index) => (
                                  <div key={criterion.id} className="criterion-card">
                                    <div className="criterion-card__header">
                                      <div>
                                        <p className="section-eyebrow">
                                          Criterion {index + 1}
                                        </p>
                                        <h3>{criterion.title}</h3>
                                      </div>
                                      <button
                                        className="ghost-button"
                                        type="button"
                                        onClick={() => {
                                          removeEvaluationCriterion(criterion.id);
                                        }}
                                        disabled={
                                          evaluationTemplateDraft.criteria.length === 1
                                        }
                                      >
                                        Remove
                                      </button>
                                    </div>

                                    <div className="criterion-settings-grid">
                                      <label className="field">
                                        <span>Criterion name</span>
                                        <input
                                          type="text"
                                          value={criterion.title}
                                          onChange={(event) => {
                                            updateEvaluationCriterionField(
                                              criterion.id,
                                              'title',
                                              event.target.value,
                                            );
                                          }}
                                        />
                                      </label>

                                      <label className="field">
                                        <span>Weight (1-100)</span>
                                        <input
                                          type="number"
                                          min={1}
                                          max={100}
                                          value={criterion.weight}
                                          onChange={(event) => {
                                            updateEvaluationCriterionWeight(
                                              criterion.id,
                                              event.target.value,
                                            );
                                          }}
                                        />
                                      </label>
                                    </div>

                                    <div className="criterion-anchor-grid">
                                      <label className="field">
                                        <span>Score 1 anchor</span>
                                        <textarea
                                          value={criterion.score1Description}
                                          onChange={(event) => {
                                            updateEvaluationCriterionField(
                                              criterion.id,
                                              'score1Description',
                                              event.target.value,
                                            );
                                          }}
                                        />
                                      </label>

                                      <label className="field">
                                        <span>Score 3 anchor</span>
                                        <textarea
                                          value={criterion.score3Description}
                                          onChange={(event) => {
                                            updateEvaluationCriterionField(
                                              criterion.id,
                                              'score3Description',
                                              event.target.value,
                                            );
                                          }}
                                        />
                                      </label>

                                      <label className="field">
                                        <span>Score 5 anchor</span>
                                        <textarea
                                          value={criterion.score5Description}
                                          onChange={(event) => {
                                            updateEvaluationCriterionField(
                                              criterion.id,
                                              'score5Description',
                                              event.target.value,
                                            );
                                          }}
                                        />
                                      </label>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>

                          <div className="footer-note">
                            <div className="action-row">
                              <button
                                className="primary-button"
                                type="button"
                                onClick={() => {
                                  void handleSaveEvaluationTemplate();
                                }}
                                disabled={
                                  busyAction ===
                                  `save-template-${selectedEvaluationTemplate.id}`
                                }
                              >
                                {busyAction ===
                                `save-template-${selectedEvaluationTemplate.id}`
                                  ? 'Saving template...'
                                  : 'Save template'}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="empty-state-card">
                          <strong>No template selected</strong>
                          <p>
                            Choose a template from the library or create a new
                            one to start defining weighted evaluation criteria.
                          </p>
                        </div>
                      )}
                    </article>
                  </div>
                ) : null}

                {activeAdminSection === 'users' ? (
                  <div className="admin-users-layout">
                    <div className="form-section">
                      <h3>User directory filters</h3>
                      <div className="admin-filter-grid">
                        <label className="field admin-search-field">
                          <span>Search</span>
                          <input
                            type="search"
                            value={adminUserFilters.query}
                            onChange={(event) => {
                              setAdminUserFilters((currentValue) => ({
                                ...currentValue,
                                query: event.target.value,
                              }));
                            }}
                            placeholder="Search name, email, phone, or role"
                          />
                        </label>

                        <label className="field">
                          <span>Primary role</span>
                          <select
                            value={adminUserFilters.primaryRole}
                            onChange={(event) => {
                              setAdminUserFilters((currentValue) => ({
                                ...currentValue,
                                primaryRole: event.target.value as PrimaryRole | 'all',
                              }));
                            }}
                          >
                            <option value="all">All account types</option>
                            <option value="parent">Parent</option>
                            <option value="player">Player</option>
                            <option value="staff">Staff</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>Assigned role</span>
                          <select
                            value={adminUserFilters.assignedRole}
                            onChange={(event) => {
                              setAdminUserFilters((currentValue) => ({
                                ...currentValue,
                                assignedRole: event.target.value as AppRole | 'all',
                              }));
                            }}
                          >
                            <option value="all">All assigned roles</option>
                            <option value="club-admin">Organization Admin</option>
                            <option value="coach">Coach</option>
                            <option value="staff">Staff</option>
                            <option value="parent">Parent</option>
                            <option value="player">Player</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>Account status</span>
                          <select
                            value={adminUserFilters.accountStatus}
                            onChange={(event) => {
                              setAdminUserFilters((currentValue) => ({
                                ...currentValue,
                                accountStatus: event.target.value as AccountStatus | 'all',
                              }));
                            }}
                          >
                            <option value="all">Active and disabled</option>
                            <option value="ACTIVE">Active</option>
                            <option value="DISABLED">Disabled</option>
                          </select>
                        </label>
                      </div>

                      <div className="action-row">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            applyAdminUserFilters(adminUserFilters);
                          }}
                          disabled={adminUsersLoading}
                        >
                          Apply filters
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            setAdminUserFilters(defaultAdminUserFilters);
                            applyAdminUserFilters(defaultAdminUserFilters);
                          }}
                          disabled={adminUsersLoading}
                        >
                          Clear filters
                        </button>
                      </div>
                    </div>

                    <div className="form-section">
                      <div className="card-header card-header--compact">
                        <div>
                          <p className="section-eyebrow">User Directory</p>
                          <h3>Review and manage portal users</h3>
                          <p className="section-copy">
                            Correct onboarding mistakes, assign staff access,
                            and disable or restore accounts as needed.
                          </p>
                        </div>
                        <span className="status-chip">
                          {adminUsersLoading
                            ? 'Loading users...'
                            : `Page ${adminUsersHistory.length + 1}`}
                        </span>
                      </div>

                      {!adminUsersLoaded && adminUsersLoading ? (
                        <p className="section-copy">Loading the user directory...</p>
                      ) : adminUsers.length === 0 ? (
                        <div className="empty-state-card">
                          <strong>No users matched these filters.</strong>
                          <p>
                            Adjust the filters or clear them to review other
                            portal accounts.
                          </p>
                        </div>
                      ) : (
                        <div className="admin-user-list">
                          {adminUsers.map((user) => (
                            <button
                              key={user.userId}
                              className={`admin-user-row ${
                                user.userId === selectedAdminUserId
                                  ? 'admin-user-row--active'
                                  : ''
                              }`}
                              type="button"
                              onClick={() => {
                                setSelectedAdminUserId(user.userId);
                              }}
                            >
                              <div className="admin-user-row__content">
                                <div>
                                  <strong>{getDirectoryUserName(user)}</strong>
                                  <p>{user.email}</p>
                                </div>
                                <div className="role-pill-row">
                                  {(user.assignedRoles.length > 0
                                    ? user.assignedRoles
                                    : (['staff'] as AppRole[])
                                  ).map((role) => (
                                    <span key={`${user.userId}-${role}`} className="role-pill">
                                      {ROLE_LABELS[role]}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <span
                                className={`status-chip ${
                                  user.accountStatus === 'DISABLED'
                                    ? 'status-chip--warning'
                                    : ''
                                }`}
                              >
                                {formatAccountStatus(user.accountStatus)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="admin-pagination">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            const previousCursor =
                              adminUsersHistory[adminUsersHistory.length - 1] ?? null;
                            setAdminUsersHistory((currentValue) =>
                              currentValue.slice(0, -1),
                            );
                            setAdminUsersCursor(previousCursor);
                          }}
                          disabled={adminUsersLoading || adminUsersHistory.length === 0}
                        >
                          Previous
                        </button>
                        <p className="helper-copy">
                          Showing up to {ADMIN_USERS_PAGE_SIZE} users at a time.
                        </p>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            if (!adminUsersNextCursor) return;
                            setAdminUsersHistory((currentValue) => [
                              ...currentValue,
                              adminUsersCursor,
                            ]);
                            setAdminUsersCursor(adminUsersNextCursor);
                          }}
                          disabled={adminUsersLoading || !adminUsersNextCursor}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            </div>

            {activeAdminSection === 'users' ? (
              <article className="card">
                <div className="card-header">
                  <div>
                    <p className="section-eyebrow">User Access</p>
                    <h3>
                      {selectedAdminUser
                        ? getDirectoryUserName(selectedAdminUser)
                        : 'Select a user'}
                    </h3>
                    <p className="section-copy">
                      {selectedAdminUser
                        ? selectedAdminUser.email
                        : 'Choose a user from the directory to review or update access.'}
                    </p>
                  </div>
                  {selectedAdminUser ? (
                    <span
                      className={`status-chip ${
                        selectedAdminUser.accountStatus === 'DISABLED'
                          ? 'status-chip--warning'
                          : ''
                      }`}
                    >
                      {formatAccountStatus(selectedAdminUser.accountStatus)}
                    </span>
                  ) : null}
                </div>

                {selectedAdminUser && adminUserDraft ? (
                  <>
                    <div className="form-section">
                      <h3>Account type</h3>
                      <label className="field">
                        <span>Primary role</span>
                        <select
                          value={adminUserDraft.primaryRole}
                          onChange={(event) => {
                            setAdminUserDraft((currentValue) =>
                              currentValue
                                ? {
                                    ...currentValue,
                                    primaryRole: event.target.value as PrimaryRole,
                                  }
                                : currentValue,
                            );
                          }}
                        >
                          <option value="parent">Parent</option>
                          <option value="player">Player</option>
                          <option value="staff">Staff</option>
                        </select>
                      </label>
                      <p className="helper-copy">
                        Use this when a user selected the wrong starting role
                        during first login.
                      </p>
                    </div>

                    <div className="form-section">
                      <h3>Organization access</h3>
                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={adminUserDraft.organizationRoles.includes('club-admin')}
                          onChange={(event) => {
                            setAdminUserDraft((currentValue) =>
                              currentValue
                                ? {
                                    ...currentValue,
                                    organizationRoles: toggleOrganizationRole(
                                      currentValue.organizationRoles,
                                      'club-admin',
                                      event.target.checked,
                                    ),
                                  }
                                : currentValue,
                            );
                          }}
                        />
                        <div>
                          <strong>Organization Admin</strong>
                          <p className="helper-copy">
                            Grants club settings and user-management access.
                          </p>
                        </div>
                      </label>

                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={adminUserDraft.organizationRoles.includes('coach')}
                          onChange={(event) => {
                            setAdminUserDraft((currentValue) =>
                              currentValue
                                ? {
                                    ...currentValue,
                                    organizationRoles: toggleOrganizationRole(
                                      currentValue.organizationRoles,
                                      'coach',
                                      event.target.checked,
                                    ),
                                  }
                                : currentValue,
                            );
                          }}
                        />
                        <div>
                          <strong>Coach</strong>
                          <p className="helper-copy">
                            Prepares the account for coach-specific staff
                            workflows as they come online.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="form-section">
                      <h3>Account status</h3>
                      <label className="field">
                        <span>Status</span>
                        <select
                          value={adminUserDraft.accountStatus}
                          onChange={(event) => {
                            setAdminUserDraft((currentValue) =>
                              currentValue
                                ? {
                                    ...currentValue,
                                    accountStatus: event.target.value as AccountStatus,
                                  }
                                : currentValue,
                            );
                          }}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="DISABLED">Disabled</option>
                        </select>
                      </label>
                      <p className="helper-copy">
                        Disabled users can still authenticate, but the portal
                        blocks all non-bootstrap actions until re-enabled.
                      </p>
                    </div>

                    <div className="stack-list">
                      <div className="stack-card">
                        <div>
                          <strong>Contact details</strong>
                          <p>
                            {selectedAdminUser.contactEmail || 'No contact email added yet'}
                            {selectedAdminUser.phoneNumber
                              ? ` - ${selectedAdminUser.phoneNumber}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <div className="stack-card">
                        <div>
                          <strong>Profile activity</strong>
                          <p>
                            Created {formatTimestamp(selectedAdminUser.createdAt)}.
                            Updated {formatTimestamp(selectedAdminUser.updatedAt)}.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="footer-note">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => {
                          void handleSaveAdminUser();
                        }}
                        disabled={busyAction === `save-admin-user-${selectedAdminUser.userId}`}
                      >
                        {busyAction === `save-admin-user-${selectedAdminUser.userId}`
                          ? 'Saving user access...'
                          : 'Save user access'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="empty-state-card">
                    <strong>No user selected</strong>
                    <p>
                      Pick a user from the list to change their account type,
                      organization access, or account status.
                    </p>
                  </div>
                )}
              </article>
            ) : null}

            {activeAdminSection === 'profile' ? userProfileCard : null}

            {activeAdminSection === 'access' ? workspaceAccessCard : null}

            {activeAdminSection === 'architecture' ? (
              <article className="card">
                <div className="sidebar-header">
                  <div>
                    <p className="section-eyebrow">Architecture Direction</p>
                    <h3>Shared login, org-aware access</h3>
                  </div>
                </div>
                <div className="stack-list">
                  <div className="stack-card">
                    <div>
                      <strong>What is live now</strong>
                      <p>
                        Organization settings, evaluation templates, and
                        staff-side user access are persisted, and access data
                        already carries organization membership details.
                      </p>
                    </div>
                  </div>
                  <div className="stack-card">
                    <div>
                      <strong>What this enables next</strong>
                      <p>
                        The same user pool can later support parents or staff
                        linked to multiple clubs, with an organization-choice
                        step at sign-in if needed.
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ) : null}
          </section>
        ) : activeRole === 'staff' ? (
          <section className="workspace-grid workspace-grid--single">
            <div className="workspace-main">
              <article className="card">
                <div className="card-header">
                  <div>
                    <p className="section-eyebrow">Staff Workspace</p>
                    <h2>Navigate your staff functions</h2>
                    <p className="section-copy">
                      Staff accounts can manage tryout planning, review their
                      current access, and keep their own profile current from
                      one vertical workspace shell.
                    </p>
                  </div>
                  <span className="status-chip">Staff</span>
                </div>

                <div className="admin-nav">
                  {userWorkspaceSections.map((section) => (
                    <button
                      key={section.id}
                      className={`admin-nav__button ${
                        activeUserSection === section.id
                          ? 'admin-nav__button--active'
                          : ''
                      }`}
                      type="button"
                      onClick={() => {
                        setActiveUserSection(section.id);
                      }}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </article>

              {activeUserSection === 'overview' ? (
                <article className="card">
                  <div className="card-header">
                    <div>
                      <p className="section-eyebrow">Staff Workspace</p>
                      <h2>Staff can plan tryouts from this workspace</h2>
                      <p className="section-copy">
                        Staff accounts can set up tryout seasons, groups,
                        teams, and sessions here. Additional coach or admin
                        roles still expand the account menu as those functions
                        come online.
                      </p>
                    </div>
                    <span className="status-chip">Live</span>
                  </div>

                  <div className="stack-list">
                    <div className="stack-card">
                      <div>
                        <strong>What is ready now</strong>
                        <p>
                          Build the structure coaches need before evaluations:
                          seasons, groups, teams, jersey numbers, and sessions.
                        </p>
                      </div>
                    </div>
                    <div className="stack-card">
                      <div>
                        <strong>What still expands later</strong>
                        <p>
                          Club-admin assignment still controls organization
                          settings and user management without creating a new
                          login.
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              ) : null}

              {activeUserSection === 'tryouts' ? tryoutSetupCard : null}
              {activeUserSection === 'profile' ? userProfileCard : null}
              {workspaceAccessCard}
            </div>
          </section>
        ) : activeRole === 'coach' || activeRole === 'manager' ? (
          <section className="workspace-grid workspace-grid--single">
            <div className="workspace-main">
              <article className="card">
                <div className="card-header">
                  <div>
                    <p className="section-eyebrow">Staff Workspace</p>
                    <h2>Navigate your {ROLE_LABELS[activeRole].toLowerCase()} workspace</h2>
                    <p className="section-copy">
                      Tryout setup is live here now, alongside your profile and
                      current access details.
                    </p>
                  </div>
                  <span className="status-chip">{ROLE_LABELS[activeRole]}</span>
                </div>

                <div className="admin-nav">
                  {userWorkspaceSections.map((section) => (
                    <button
                      key={section.id}
                      className={`admin-nav__button ${
                        activeUserSection === section.id
                          ? 'admin-nav__button--active'
                          : ''
                      }`}
                      type="button"
                      onClick={() => {
                        setActiveUserSection(section.id);
                      }}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </article>

              {activeUserSection === 'overview' ? (
                <article className="card">
                  <div className="card-header">
                    <div>
                      <p className="section-eyebrow">Staff Workspace</p>
                      <h2>{ROLE_LABELS[activeRole]} tryout planning is live</h2>
                      <p className="section-copy">
                        Use this workspace to build the tryout structure that
                        feeds future on-ice evaluation workflows.
                      </p>
                    </div>
                  </div>
                </article>
              ) : null}

              {activeUserSection === 'tryouts' ? tryoutSetupCard : null}
              {activeUserSection === 'profile' ? userProfileCard : null}
              {workspaceAccessCard}
            </div>
          </section>
        ) : (
          <section className="workspace-grid workspace-grid--single">
            <div className="workspace-main">
              <article className="card">
                <div className="card-header">
                  <div>
                    <p className="section-eyebrow">
                      {familyRole ? 'Family Workspace' : 'Account Setup'}
                    </p>
                    <h2>
                      {familyRole
                        ? 'Navigate your portal functions'
                        : 'Finish setting up this account'}
                    </h2>
                    <p className="section-copy">
                      {familyRole
                        ? 'Move between player profile, tryout intake, linked access, and your own profile from one navigation bar.'
                        : 'Choose how this login should start, or update your own user profile before continuing.'}
                    </p>
                  </div>
                  {familyRole ? (
                    <span className="status-chip">{ROLE_LABELS[familyRole]}</span>
                  ) : null}
                </div>

                <div className="admin-nav">
                  {userWorkspaceSections.map((section) => (
                    <button
                      key={section.id}
                      className={`admin-nav__button ${
                        activeUserSection === section.id
                          ? 'admin-nav__button--active'
                          : ''
                      }`}
                      type="button"
                      onClick={() => {
                        setActiveUserSection(section.id);
                      }}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </article>

              {!bootstrap.user.primaryRole && activeUserSection === 'setup' ? (
                <article className="card">
                  <div className="card-header">
                    <div>
                      <p className="section-eyebrow">Account Setup</p>
                      <h2>Choose how this account will start</h2>
                      <p className="section-copy">
                        Choose how this account should start. Parent and player
                        accounts can move right into player setup and intake,
                        while staff accounts can update their profile and then
                        wait for club-admin assignment.
                      </p>
                    </div>
                  </div>

                  <div className="role-grid">
                    {(['parent', 'player', 'staff'] as PrimaryRole[]).map((role) => (
                      <button
                        key={role}
                        className="role-card"
                        type="button"
                        onClick={() => {
                          void handleSavePrimaryRole(role);
                        }}
                        disabled={busyAction === `save-role-${role}`}
                      >
                        <strong>{ROLE_LABELS[role]}</strong>
                        <span>
                          {role === 'parent'
                            ? 'Add one or more players, complete intake forms, and invite players to connect their own account.'
                            : role === 'player'
                              ? 'Create your own player record, complete intake, and invite a parent to connect.'
                              : 'Set up a staff account, update your profile, and wait for a club admin to assign coach, manager, or administrator access.'}
                        </span>
                      </button>
                    ))}
                  </div>
                </article>
              ) : null}

              {activeUserSection === 'profile' ? userProfileCard : null}

              {familyRole ? (
                <article className="card">
                  <div className="sidebar-header">
                    <div>
                      <p className="section-eyebrow">Players</p>
                      <h3>
                        {familyRole === 'parent'
                          ? 'Your player records'
                          : 'Your player profile'}
                      </h3>
                    </div>
                    {familyRole === 'parent' ? (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setSelectedPlayerId('new');
                        }}
                      >
                        Add player
                      </button>
                    ) : null}
                  </div>

                  <div className="stack-list">
                    {bootstrap.players.map((player) => (
                      <button
                        key={player.id}
                        className={`player-list-item ${
                          player.id === selectedPlayerId
                            ? 'player-list-item--active'
                            : ''
                        }`}
                        type="button"
                        onClick={() => {
                          setSelectedPlayerId(player.id);
                        }}
                      >
                        <div>
                          <strong>{getPlayerDisplayName(player.profile)}</strong>
                          <span>{buildPlayerListSummary(player)}</span>
                        </div>
                        <span className="status-chip">
                          {ROLE_LABELS[player.relationship]}
                        </span>
                      </button>
                    ))}

                    {bootstrap.players.length === 0 ? (
                      <div className="stack-card">
                        <div>
                          <strong>No player record yet</strong>
                          <p>
                            {familyRole === 'parent'
                              ? 'Add your first player to start the intake process.'
                              : 'Create your player profile to start the intake process.'}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {familyRole === 'parent' && selectedPlayerId === 'new' ? (
                      <div className="stack-card stack-card--highlight">
                        <div>
                          <strong>New player draft</strong>
                          <p>
                            Complete the player profile, then save a draft or
                            submit the intake form.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              ) : null}

              {familyRole && draftPlayer && activeUserSection === 'player' ? (
                  <article className="card">
                    <div className="card-header">
                      <div>
                        <p className="section-eyebrow">Player Profile</p>
                        <h2>
                          {draftPlayer.id
                            ? getPlayerDisplayName(draftPlayer.profile) || 'Player profile'
                            : 'Create player profile'}
                        </h2>
                        <p className="section-copy">
                          Player profile details are managed separately from the
                          intake form so linked parents and players can keep this
                          record current over time.
                        </p>
                      </div>
                      <span className="status-chip">
                        {draftPlayer.id ? 'Saved record' : 'New player'}
                      </span>
                    </div>

                    <div className="form-section">
                      <h3>Basic details</h3>
                      <div className="field-grid">
                        <label className="field">
                          <span>First name</span>
                          <input
                            type="text"
                            value={draftPlayer.profile.firstName}
                            onChange={(event) => {
                              updateDraftPlayerNames('firstName', event.target.value);
                            }}
                            placeholder="First name"
                          />
                        </label>

                        <label className="field">
                          <span>Last name</span>
                          <input
                            type="text"
                            value={draftPlayer.profile.lastName}
                            onChange={(event) => {
                              updateDraftPlayerNames('lastName', event.target.value);
                            }}
                            placeholder="Last name"
                          />
                        </label>

                        <label className="field">
                          <span>Birth year</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={draftPlayer.profile.birthYear}
                            onChange={(event) => {
                              updateDraftPlayerProfileField(
                                'birthYear',
                                event.target.value,
                              );
                            }}
                            placeholder="e.g. 2011"
                          />
                        </label>

                        <label className="field">
                          <span>Gender</span>
                          <select
                            value={draftPlayer.profile.gender}
                            onChange={(event) => {
                              updateDraftPlayerProfileField('gender', event.target.value);
                            }}
                          >
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Non-binary">Non-binary</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>Primary position</span>
                          <select
                            value={draftPlayer.profile.primaryPosition}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              updateDraftPlayerProfileField(
                                'primaryPosition',
                                nextValue,
                              );
                              updateDraftPlayerProfileField('positions', nextValue);
                            }}
                          >
                            <option value="">Select</option>
                            <option value="Forward">Forward</option>
                            <option value="Center">Center</option>
                            <option value="Wing">Wing</option>
                            <option value="Defense">Defense</option>
                            <option value="Goalie">Goalie</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>Handedness</span>
                          <select
                            value={draftPlayer.profile.handedness}
                            onChange={(event) => {
                              updateDraftPlayerProfileField(
                                'handedness',
                                event.target.value,
                              );
                            }}
                          >
                            <option value="">Select</option>
                            <option value="Left">Left</option>
                            <option value="Right">Right</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>First year playing hockey</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={draftPlayer.profile.firstYearPlayingHockey}
                            onChange={(event) => {
                              updateDraftPlayerProfileField(
                                'firstYearPlayingHockey',
                                event.target.value,
                              );
                            }}
                            placeholder="e.g. 2018"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="form-section">
                      <h3>Contact and notifications</h3>
                      <div className="field-grid">
                        <label className="field">
                          <span>Player contact email</span>
                          <input
                            type="email"
                            value={draftPlayer.profile.bestContactEmail}
                            onChange={(event) => {
                              updateDraftPlayerProfileField(
                                'bestContactEmail',
                                event.target.value,
                              );
                            }}
                            placeholder="name@example.com"
                          />
                        </label>

                        <label className="field">
                          <span>Player phone number</span>
                          <input
                            type="tel"
                            value={draftPlayer.profile.phoneNumber}
                            onChange={(event) => {
                              updateDraftPlayerProfileField(
                                'phoneNumber',
                                event.target.value,
                              );
                            }}
                            placeholder="Optional"
                          />
                        </label>
                      </div>

                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={draftPlayer.profile.smsOptIn}
                          onChange={(event) => {
                            updateDraftPlayerProfileField(
                              'smsOptIn',
                              event.target.checked,
                            );
                          }}
                        />
                        <div>
                          <strong>Allow text message notifications</strong>
                          <p className="helper-copy">
                            Turn this on only if a phone number has been added.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="form-section">
                      <h3>Latest height and weight</h3>
                      <div className="measure-grid">
                        <label className="field">
                          <span>Height (ft)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={draftPlayer.profile.latestHeightFeet}
                            onChange={(event) => {
                              updateDraftPlayerProfileField(
                                'latestHeightFeet',
                                event.target.value,
                              );
                            }}
                            placeholder="5"
                          />
                        </label>

                        <label className="field">
                          <span>Height (in)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={draftPlayer.profile.latestHeightInches}
                            onChange={(event) => {
                              updateDraftPlayerProfileField(
                                'latestHeightInches',
                                event.target.value,
                              );
                            }}
                            placeholder="6"
                          />
                        </label>

                        <label className="field">
                          <span>Weight (lb)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={draftPlayer.profile.latestWeightPounds}
                            onChange={(event) => {
                              updateDraftPlayerProfileField(
                                'latestWeightPounds',
                                event.target.value,
                              );
                            }}
                            placeholder="140"
                          />
                        </label>
                      </div>

                      {draftPlayer.profile.physicalHistory.length > 0 ? (
                        <p className="helper-copy">
                          Latest measurement recorded{' '}
                          {formatTimestamp(
                            getLatestPhysicalEntry(draftPlayer.profile.physicalHistory)
                              ?.recordedAt ?? null,
                          )}
                          . Prior entries stay stored for future growth history.
                        </p>
                      ) : null}
                    </div>

                    <div className="form-section">
                      <div className="team-history-header">
                        <div>
                          <h3>Previous teams</h3>
                          <p className="helper-copy">
                            Add as many entries as needed. Use season labels like
                            2025-26 or 2026-27.
                          </p>
                        </div>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={addTeamHistoryEntry}
                        >
                          Add team
                        </button>
                      </div>

                      <datalist id="season-options">
                        {recentSeasonOptions.map((seasonLabel) => (
                          <option key={seasonLabel} value={seasonLabel} />
                        ))}
                      </datalist>

                      <div className="team-history-list">
                        {draftPlayer.profile.teamHistory.length === 0 ? (
                          <div className="stack-card">
                            <div>
                              <strong>No team history added yet</strong>
                              <p>
                                Add one or more recent teams, including spring,
                                summer, or tournament teams in the same season
                                when needed.
                              </p>
                            </div>
                          </div>
                        ) : (
                          draftPlayer.profile.teamHistory.map((entry) => (
                            <div key={entry.id} className="team-history-row">
                              <label className="field">
                                <span>Season</span>
                                <input
                                  type="text"
                                  list="season-options"
                                  value={entry.seasonLabel}
                                  onChange={(event) => {
                                    updateTeamHistoryEntry(
                                      entry.id,
                                      'seasonLabel',
                                      event.target.value,
                                    );
                                  }}
                                  placeholder="2026-27"
                                />
                              </label>

                              <label className="field">
                                <span>Team name</span>
                                <input
                                  type="text"
                                  value={entry.teamName}
                                  onChange={(event) => {
                                    updateTeamHistoryEntry(
                                      entry.id,
                                      'teamName',
                                      event.target.value,
                                    );
                                  }}
                                  placeholder="NC Golden Bears 14U AA"
                                />
                              </label>

                              <label className="field">
                                <span>Position played</span>
                                <input
                                  type="text"
                                  value={entry.positionPlayed}
                                  onChange={(event) => {
                                    updateTeamHistoryEntry(
                                      entry.id,
                                      'positionPlayed',
                                      event.target.value,
                                    );
                                  }}
                                  placeholder="Forward"
                                />
                              </label>

                              <div className="team-history-actions">
                                <button
                                  className="ghost-button"
                                  type="button"
                                  onClick={() => {
                                    removeTeamHistoryEntry(entry.id);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="footer-note">
                      <p className="helper-copy">
                        Save the player profile any time. Intake submission stays
                        separate below.
                      </p>
                      <div className="action-row">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            void handleSavePlayer(
                              selectedPlayer?.intake.status === 'submitted'
                                ? 'submitted'
                                : 'draft',
                            );
                          }}
                          disabled={
                            busyAction === 'create-draft' ||
                            busyAction === 'update-draft' ||
                            busyAction === 'create-submitted' ||
                            busyAction === 'update-submitted'
                          }
                        >
                          {busyAction === 'create-draft' ||
                          busyAction === 'update-draft' ||
                          busyAction === 'create-submitted' ||
                          busyAction === 'update-submitted'
                            ? 'Saving...'
                            : 'Save player profile'}
                        </button>
                      </div>
                    </div>
                  </article>

              ) : null}

              {familyRole && draftPlayer && activeUserSection === 'intake' ? (
                <article className="card">
                  <div className="card-header">
                    <div>
                      <p className="section-eyebrow">Tryout Intake</p>
                      <h2>
                        {draftPlayer.id ? 'Pre-tryout intake form' : 'Complete tryout intake'}
                      </h2>
                      <p className="section-copy">
                        {bootstrap.organization.intakeIntro}
                      </p>
                    </div>
                    <span className="status-chip">
                      {selectedPlayer ? formatIntakeStatus(selectedPlayer.intake.status) : 'Draft'}
                    </span>
                  </div>

                  <div className="form-section">
                    <h3>Intake details</h3>
                    <div className="field-grid">
                      <label className="field">
                        <span>Completed by</span>
                        <select
                          value={draftPlayer.profile.completedBy}
                          onChange={(event) => {
                            updateDraftPlayerProfileField(
                              'completedBy',
                              event.target.value as PlayerProfileInput['completedBy'],
                            );
                          }}
                        >
                          {completedByOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="form-section">
                    <h3>Development priorities</h3>

                    <QuestionBlock
                      title="1) Which outcome matters most for next season?"
                      fieldName="next-season-outcome"
                      value={draftPlayer.intake.nextSeasonOutcome}
                      options={nextSeasonOptions}
                      onChange={(value) => {
                        updateDraftPlayerIntakeField('nextSeasonOutcome', value);
                      }}
                    />

                    <QuestionBlock
                      title="2) Which development setting would help the player most right now?"
                      fieldName="development-setting"
                      value={draftPlayer.intake.developmentSetting}
                      options={developmentSettingOptions}
                      onChange={(value) => {
                        updateDraftPlayerIntakeField('developmentSetting', value);
                      }}
                    />

                    <QuestionBlock
                      title="3) Which role would the player most value next season, assuming all options are developmentally appropriate?"
                      fieldName="preferred-role"
                      value={draftPlayer.intake.preferredRole}
                      options={preferredRoleOptions}
                      onChange={(value) => {
                        updateDraftPlayerIntakeField('preferredRole', value);
                      }}
                    />

                    <QuestionBlock
                      title="4) What coaching and learning style helps the player most?"
                      fieldName="coaching-style"
                      value={draftPlayer.intake.coachingStyle}
                      options={coachingStyleOptions}
                      onChange={(value) => {
                        updateDraftPlayerIntakeField('coachingStyle', value);
                      }}
                    />

                    <QuestionBlock
                      title="5) Are there any known participation considerations staff should keep in mind?"
                      fieldName="participation-considerations"
                      value={draftPlayer.intake.participationConsiderations}
                      options={participationOptions}
                      onChange={(value) => {
                        updateDraftPlayerIntakeField(
                          'participationConsiderations',
                          value,
                        );
                      }}
                    />

                    <label className="field">
                      <span>If helpful, brief note</span>
                      <input
                        type="text"
                        value={draftPlayer.intake.participationConsiderationsNote}
                        onChange={(event) => {
                          updateDraftPlayerIntakeField(
                            'participationConsiderationsNote',
                            event.target.value,
                          );
                        }}
                        maxLength={120}
                        placeholder="Example: one fall weekend unavailable due to family event"
                      />
                    </label>

                    <label className="field">
                      <span>
                        6) Is there one thing you want staff to understand about
                        the player's development fit?
                      </span>
                      <textarea
                        value={draftPlayer.intake.additionalInsight}
                        onChange={(event) => {
                          updateDraftPlayerIntakeField(
                            'additionalInsight',
                            event.target.value,
                          );
                        }}
                        placeholder="Optional - one clear insight only"
                      />
                    </label>
                  </div>

                  <div className="footer-note">
                    <p className="helper-copy">
                      {selectedPlayer?.intake.updatedAt
                        ? `Last updated ${formatTimestamp(
                            selectedPlayer.intake.updatedAt,
                          )}.`
                        : 'Save a draft whenever you need to pause and come back.'}
                    </p>
                    <div className="action-row">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          void handleSavePlayer('draft');
                        }}
                        disabled={
                          busyAction === 'create-draft' ||
                          busyAction === 'update-draft' ||
                          busyAction === 'create-submitted' ||
                          busyAction === 'update-submitted'
                        }
                      >
                        {busyAction === 'create-draft' ||
                        busyAction === 'update-draft'
                          ? 'Saving draft...'
                          : 'Save draft'}
                      </button>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => {
                          void handleSavePlayer('submitted');
                        }}
                        disabled={
                          busyAction === 'create-draft' ||
                          busyAction === 'update-draft' ||
                          busyAction === 'create-submitted' ||
                          busyAction === 'update-submitted'
                        }
                      >
                        {busyAction === 'create-submitted' ||
                        busyAction === 'update-submitted'
                          ? 'Submitting...'
                          : selectedPlayer?.intake.status === 'submitted'
                            ? 'Save submitted form'
                            : 'Submit form'}
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {familyRole && activeUserSection === 'invites' ? (
                <article className="card">
                  <div className="card-header">
                    <div>
                      <p className="section-eyebrow">Linked Access</p>
                      <h2>Manage parent and player connections</h2>
                      <p className="section-copy">
                        Use this section to invite the linked parent or player
                        account for the selected record, review sent invites,
                        and respond to invites that were sent to this login.
                      </p>
                    </div>
                    <span className="status-chip">
                      {selectedPlayer
                        ? `${selectedPlayer.sentInvites.length} sent`
                        : `${bootstrap.receivedInvites.length} received`}
                    </span>
                  </div>

                  <div className="stack-list">
                    <div className="stack-card">
                      <div>
                        <strong>Selected player</strong>
                        <p>
                          {selectedPlayer
                            ? getPlayerDisplayName(selectedPlayer.profile)
                            : 'Save or choose a player record to enable linked access tools.'}
                        </p>
                      </div>
                    </div>
                    <div className="stack-card">
                      <div>
                        <strong>What is managed here</strong>
                        <p>
                          Linked access stays attached to the player record, so
                          the right parent and player logins remain connected
                          over time.
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              ) : null}
              {familyRole && activeUserSection === 'invites' ? (
                <article className="card">
                  <div className="sidebar-header">
                    <div>
                      <p className="section-eyebrow">Linked Access</p>
                      <h3>Parents and players</h3>
                    </div>
                  </div>

                  {selectedPlayer ? (
                    <>
                      <p className="helper-copy">
                        {familyRole === 'parent'
                          ? 'Invite the player to connect their own login to this player record.'
                          : 'Invite a parent or guardian to connect their own login to this player record.'}
                      </p>

                      <div className="invite-form">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(event) => {
                            setInviteEmail(event.target.value);
                          }}
                          placeholder={
                            currentInviteRole === 'player'
                              ? 'player@example.com'
                              : 'parent@example.com'
                          }
                        />
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() => {
                            void handleCreateInvite();
                          }}
                          disabled={
                            !currentInviteRole ||
                            !inviteEmail.trim() ||
                            busyAction === 'create-invite'
                          }
                        >
                          {busyAction === 'create-invite'
                            ? 'Sending...'
                            : `Invite ${currentInviteRole ? ROLE_LABELS[currentInviteRole] : 'User'}`}
                        </button>
                      </div>

                      <div className="stack-list invite-panel">
                        {selectedPlayer.sentInvites.length === 0 ? (
                          <div className="stack-card">
                            <div>
                              <strong>No invites sent yet</strong>
                              <p>
                                Invites stay attached to this player record until
                                they are accepted, declined, or revoked.
                              </p>
                            </div>
                          </div>
                        ) : (
                          selectedPlayer.sentInvites.map((invite) => (
                            <div key={invite.id} className="stack-card">
                              <div>
                                <strong>{invite.invitedEmail}</strong>
                                <p>
                                  {ROLE_LABELS[invite.invitedRole]} invite -{' '}
                                  {formatInviteStatus(invite.status)} - created{' '}
                                  {formatTimestamp(invite.createdAt)}
                                </p>
                              </div>
                              {invite.status === 'pending' ? (
                                <div className="stack-card-actions">
                                  <button
                                    className="ghost-button"
                                    type="button"
                                    onClick={() => {
                                      void handleRevokeInvite(invite.id);
                                    }}
                                    disabled={
                                      busyAction === `revoke-invite-${invite.id}`
                                    }
                                  >
                                    {busyAction === `revoke-invite-${invite.id}`
                                      ? 'Revoking...'
                                      : 'Revoke'}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="helper-copy">
                      Save the player record first, then invite the linked parent
                      or player account.
                    </p>
                  )}
                </article>
              ) : null}

              {familyRole && activeUserSection === 'invites' ? (
                <article className="card">
                  <div className="sidebar-header">
                    <div>
                      <p className="section-eyebrow">Received Invites</p>
                      <h3>Invitations sent to this login</h3>
                    </div>
                  </div>

                  <div className="stack-list">
                    {bootstrap.receivedInvites.length === 0 ? (
                      <div className="stack-card">
                        <div>
                          <strong>No received invites</strong>
                          <p>
                            Any player or parent invite sent to {bootstrap.access.email}{' '}
                            will appear here.
                          </p>
                        </div>
                      </div>
                    ) : (
                      bootstrap.receivedInvites.map((invite) => (
                        <div key={invite.id} className="stack-card">
                          <div>
                            <strong>{invite.playerName}</strong>
                            <p>
                              {ROLE_LABELS[invite.invitedRole]} invite from{' '}
                              {invite.invitedByLabel}
                            </p>
                          </div>
                          <div className="stack-card-actions">
                            <button
                              className="primary-button"
                              type="button"
                              onClick={() => {
                                void handleAcceptInvite(invite.id);
                              }}
                              disabled={busyAction === `accept-invite-${invite.id}`}
                            >
                              {busyAction === `accept-invite-${invite.id}`
                                ? 'Accepting...'
                                : 'Accept'}
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => {
                                void handleDeclineInvite(invite.id);
                              }}
                              disabled={busyAction === `decline-invite-${invite.id}`}
                            >
                              {busyAction === `decline-invite-${invite.id}`
                                ? 'Declining...'
                                : 'Decline'}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              ) : null}

              {!familyRole ? workspaceAccessCard : null}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function QuestionBlock({
  title,
  fieldName,
  value,
  options,
  onChange,
}: QuestionBlockProps) {
  return (
    <div className="question">
      <div className="question-label">{title}</div>
      <div className="option-grid">
        {options.map((option) => {
          const optionId = `${fieldName}-${slugify(option.value)}`;
          return (
            <div key={option.value} className="option">
              <input
                id={optionId}
                checked={value === option.value}
                name={fieldName}
                type="radio"
                onChange={() => {
                  onChange(option.value);
                }}
              />
              <label htmlFor={optionId}>
                <span className="option-title">{option.value}</span>
                <span className="option-desc">{option.description}</span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UserProfileCard({
  signInEmail,
  userDraft,
  busyAction,
  onFieldChange,
  onSmsOptInChange,
  onSave,
}: UserProfileCardProps) {
  return (
    <article className="card">
      <div className="card-header">
        <div>
          <p className="section-eyebrow">Your Profile</p>
          <h3>{getUserDisplayName(userDraft) || 'Account profile'}</h3>
          <p className="section-copy">
            Keep your own contact details current so the portal can feel more
            personal and support future email or text notifications.
          </p>
        </div>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>First name</span>
          <input
            type="text"
            value={userDraft.firstName}
            onChange={(event) => {
              onFieldChange('firstName', event.target.value);
            }}
            placeholder="First name"
          />
        </label>

        <label className="field">
          <span>Last name</span>
          <input
            type="text"
            value={userDraft.lastName}
            onChange={(event) => {
              onFieldChange('lastName', event.target.value);
            }}
            placeholder="Last name"
          />
        </label>

        <label className="field">
          <span>Contact email</span>
          <input
            type="email"
            value={userDraft.contactEmail}
            onChange={(event) => {
              onFieldChange('contactEmail', event.target.value);
            }}
            placeholder="name@example.com"
          />
        </label>

        <label className="field">
          <span>Phone number</span>
          <input
            type="tel"
            value={userDraft.phoneNumber}
            onChange={(event) => {
              onFieldChange('phoneNumber', event.target.value);
            }}
            placeholder="Optional"
          />
        </label>
      </div>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={userDraft.smsOptIn}
          onChange={(event) => {
            onSmsOptInChange(event.target.checked);
          }}
        />
        <div>
          <strong>Allow text message notifications</strong>
          <p className="helper-copy">
            Sign-in email: {signInEmail}. Use contact details above for future
            notifications.
          </p>
        </div>
      </label>

      <div className="footer-note">
        <div className="action-row">
          <button
            className="secondary-button"
            type="button"
            onClick={onSave}
            disabled={busyAction === 'save-user-profile'}
          >
            {busyAction === 'save-user-profile'
              ? 'Saving profile...'
              : 'Save profile'}
          </button>
        </div>
      </div>
    </article>
  );
}

function TryoutSetupCard({
  roleLabel,
  seasons,
  draft,
  loaded,
  loading,
  newSeasonName,
  busyAction,
  draggingPlayerId,
  onNewSeasonNameChange,
  onCreateSeason,
  onSelectSeason,
  onDeleteSeason,
  onSeasonNameChange,
  onSaveSeason,
  onAddGroup,
  onUpdateGroupName,
  onToggleGroupBirthYear,
  onToggleGroupGender,
  onRemoveGroup,
  onSetPlayerAssignment,
  onAddTeam,
  onUpdateTeamName,
  onRemoveTeam,
  onAssignPlayerToTeam,
  onUpdatePlayerJersey,
  onAddSession,
  onUpdateSessionName,
  onToggleSessionTeam,
  onRemoveSession,
  onStartPlayerDrag,
}: TryoutSetupCardProps) {
  const birthYearOptions = buildTryoutBirthYearOptions(draft?.players ?? []);
  const groups = draft?.groups ?? [];
  const teams = draft?.teams ?? [];
  const sessions = draft?.sessions ?? [];
  const unassignedPlayers = draft
    ? draft.players.filter((player) => player.effectiveGroupId === null)
    : [];

  function handleAssignmentChange(
    playerId: string,
    value: string,
  ): void {
    if (value === 'default') {
      onSetPlayerAssignment(playerId, 'default', null);
      return;
    }

    if (value === 'unassigned') {
      onSetPlayerAssignment(playerId, 'unassigned', null);
      return;
    }

    onSetPlayerAssignment(playerId, 'manual', value.replace(/^manual:/, ''));
  }

  function handlePlayerDrop(teamId: string | null): void {
    if (!draggingPlayerId) return;
    onAssignPlayerToTeam(draggingPlayerId, teamId);
    onStartPlayerDrag(null);
  }

  function renderAssignmentPlayerCard(player: TryoutPlayerSummary) {
    return (
      <div key={player.playerId} className="tryout-player-card">
        <div>
          <strong>{player.displayName}</strong>
          <p>
            {player.defaultGroupId
              ? `Default placement: ${getTryoutGroupLabel(player.defaultGroupId, groups)}`
              : 'No automatic group placement'}
          </p>
        </div>
        <label className="field">
          <span>Placement</span>
          <select
            value={getTryoutPlayerAssignmentValue(player)}
            onChange={(event) => {
              handleAssignmentChange(player.playerId, event.target.value);
            }}
          >
            <option value="default">
              {player.defaultGroupId
                ? `Use default: ${getTryoutGroupLabel(player.defaultGroupId, groups)}`
                : 'Use default rules'}
            </option>
            <option value="unassigned">Move to unassigned pool</option>
            {groups.map((group) => (
              <option key={group.id} value={`manual:${group.id}`}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  function renderTeamPlayerCard(
    player: TryoutPlayerSummary,
    groupTeams: TryoutSeason['teams'],
  ) {
    return (
      <div
        key={player.playerId}
        className="tryout-player-card tryout-player-card--draggable"
        draggable
        onDragStart={() => {
          onStartPlayerDrag(player.playerId);
        }}
        onDragEnd={() => {
          onStartPlayerDrag(null);
        }}
      >
        <div>
          <strong>{player.displayName}</strong>
          <p>
            {player.teamId
              ? `Team: ${getTryoutTeamLabel(player.teamId, teams)}`
              : 'Not assigned to a tryout team yet'}
          </p>
        </div>
        <div className="tryout-player-card__controls">
          <label className="field">
            <span>Team</span>
            <select
              value={player.teamId ?? ''}
              onChange={(event) => {
                onAssignPlayerToTeam(player.playerId, event.target.value || null);
              }}
              disabled={!player.effectiveGroupId}
            >
              <option value="">Unassigned</option>
              {groupTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field tryout-player-card__jersey">
            <span>Jersey</span>
            <input
              type="text"
              value={player.jerseyNumber}
              onChange={(event) => {
                onUpdatePlayerJersey(player.playerId, event.target.value);
              }}
              placeholder="NN"
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <article className="card">
      <div className="card-header">
        <div>
          <p className="section-eyebrow">Tryout Setup</p>
          <h2>Build the tryout plan</h2>
          <p className="section-copy">
            Create a season, define groups, place players, split teams, and
            attach those teams to evaluation sessions. This structure becomes
            the source of truth for the future on-ice evaluation workflow.
          </p>
        </div>
        <span className="status-chip">{roleLabel}</span>
      </div>

      <div className="form-section">
        <div className="tryout-toolbar">
          <label className="field tryout-toolbar__field">
            <span>New tryout season</span>
            <input
              type="text"
              value={newSeasonName}
              onChange={(event) => {
                onNewSeasonNameChange(event.target.value);
              }}
              placeholder="Example: 2026-27 Tier II Tryouts"
            />
          </label>
          <button
            className="primary-button"
            type="button"
            onClick={onCreateSeason}
            disabled={busyAction === 'create-tryout-season'}
          >
            {busyAction === 'create-tryout-season'
              ? 'Creating season...'
              : 'Create season'}
          </button>
        </div>
      </div>

      <div className="form-section">
        <h3>Tryout seasons</h3>
        {loading && !loaded ? (
          <div className="empty-state-card">
            <strong>Loading tryout seasons</strong>
            <p>Pulling the current tryout setup library from the portal.</p>
          </div>
        ) : seasons.length === 0 ? (
          <div className="empty-state-card">
            <strong>No tryout season yet</strong>
            <p>
              Create the first season above to start organizing groups, teams,
              and sessions.
            </p>
          </div>
        ) : (
          <div className="tryout-season-list">
            {seasons.map((season) => (
              <button
                key={season.id}
                className={`template-list-item ${
                  draft?.id === season.id ? 'template-list-item--active' : ''
                }`}
                type="button"
                onClick={() => {
                  onSelectSeason(season.id);
                }}
              >
                <div className="template-list-item__content">
                  <strong>{season.name}</strong>
                  <p>
                    {season.groups.length} groups, {season.teams.length} teams,{' '}
                    {season.sessions.length} sessions
                  </p>
                </div>
                <span className="status-chip">{formatTimestamp(season.updatedAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {draft ? (
        <>
          <div className="form-section">
            <div className="card-header card-header--compact">
              <div>
                <h3>Season details</h3>
                <p className="helper-copy">
                  Freeform season naming is fine here. You can keep editing this
                  structure as players move between groups and teams.
                </p>
              </div>
              <div className="action-row">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={onDeleteSeason}
                  disabled={busyAction === `delete-tryout-season-${draft.id}`}
                >
                  {busyAction === `delete-tryout-season-${draft.id}`
                    ? 'Deleting...'
                    : 'Delete season'}
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={onSaveSeason}
                  disabled={busyAction === `save-tryout-season-${draft.id}`}
                >
                  {busyAction === `save-tryout-season-${draft.id}`
                    ? 'Saving...'
                    : 'Save tryout setup'}
                </button>
              </div>
            </div>

            <label className="field">
              <span>Season name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) => {
                  onSeasonNameChange(event.target.value);
                }}
              />
            </label>
          </div>

          <div className="form-section">
            <div className="team-history-header">
              <div>
                <h3>Tryout groups</h3>
                <p className="helper-copy">
                  Create the group names you actually use, then define which
                  birth years and genders belong in each one.
                </p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={onAddGroup}
              >
                Add group
              </button>
            </div>

            <div className="tryout-group-list">
              {groups.length === 0 ? (
                <div className="empty-state-card">
                  <strong>No groups defined yet</strong>
                  <p>
                    Add your first group to start auto-sorting players into the
                    right tryout bucket.
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.id} className="criterion-card">
                    <div className="criterion-card__header">
                      <div>
                        <h3>{group.name}</h3>
                        <p className="helper-copy">
                          {draft.players.filter((player) =>
                            player.eligibleGroupIds.includes(group.id),
                          ).length}{' '}
                          players match this group by age/gender rules.
                        </p>
                      </div>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          onRemoveGroup(group.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="field-grid">
                      <label className="field">
                        <span>Group name</span>
                        <input
                          type="text"
                          value={group.name}
                          onChange={(event) => {
                            onUpdateGroupName(group.id, event.target.value);
                          }}
                        />
                      </label>
                    </div>

                    <div className="form-section">
                      <h3>Allowed birth years</h3>
                      <div className="chip-list">
                        {birthYearOptions.map((birthYear) => (
                          <label key={`${group.id}-${birthYear}`} className="chip-option">
                            <input
                              type="checkbox"
                              checked={group.allowedBirthYears.includes(birthYear)}
                              onChange={(event) => {
                                onToggleGroupBirthYear(
                                  group.id,
                                  birthYear,
                                  event.target.checked,
                                );
                              }}
                            />
                            <span>{birthYear}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="form-section">
                      <h3>Allowed genders</h3>
                      <div className="chip-list">
                        {TRYOUT_GENDERS.map((gender) => (
                          <label key={`${group.id}-${gender}`} className="chip-option">
                            <input
                              type="checkbox"
                              checked={group.allowedGenders.includes(gender)}
                              onChange={(event) => {
                                onToggleGroupGender(
                                  group.id,
                                  gender,
                                  event.target.checked,
                                );
                              }}
                            />
                            <span>{gender}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="form-section">
            <h3>Player placement</h3>
            <p className="helper-copy">
              Players default into a group only when they match exactly one
              group. Everyone else lands in the Unassigned Pool until a coach
              chooses an override.
            </p>

            <div className="tryout-roster-list">
              <div className="criterion-card">
                <div className="criterion-card__header">
                  <div>
                    <h3>Unassigned Pool</h3>
                    <p className="helper-copy">
                      Players without a single automatic placement or players
                      manually moved out of a group.
                    </p>
                  </div>
                  <span className="status-chip">{unassignedPlayers.length}</span>
                </div>

                <div className="stack-list">
                  {unassignedPlayers.length === 0 ? (
                    <div className="stack-card">
                      <div>
                        <strong>No players are currently unassigned</strong>
                        <p>Everyone is either auto-placed or manually assigned.</p>
                      </div>
                    </div>
                  ) : (
                    unassignedPlayers.map(renderAssignmentPlayerCard)
                  )}
                </div>
              </div>

              {groups.map((group) => {
                const groupPlayers = draft.players.filter(
                  (player) => player.effectiveGroupId === group.id,
                );

                return (
                  <div key={`placement-${group.id}`} className="criterion-card">
                    <div className="criterion-card__header">
                      <div>
                        <h3>{group.name}</h3>
                        <p className="helper-copy">
                          {group.allowedBirthYears.join(', ') || 'No birth years selected'}{' '}
                          •{' '}
                          {group.allowedGenders.join(', ') || 'No genders selected'}
                        </p>
                      </div>
                      <span className="status-chip">{groupPlayers.length}</span>
                    </div>

                    <div className="stack-list">
                      {groupPlayers.length === 0 ? (
                        <div className="stack-card">
                          <div>
                            <strong>No players in this group yet</strong>
                            <p>
                              Players will appear here when they qualify
                              automatically or are moved here manually.
                            </p>
                          </div>
                        </div>
                      ) : (
                        groupPlayers.map(renderAssignmentPlayerCard)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-section">
            <h3>Tryout teams</h3>
            <p className="helper-copy">
              Create teams inside each group, then drag players between team
              cards or use the team selector for mobile and bulk jersey entry.
            </p>

            <div className="tryout-team-section-list">
              {groups.length === 0 ? (
                <div className="empty-state-card">
                  <strong>No groups available yet</strong>
                  <p>
                    Define at least one tryout group before building teams
                    inside it.
                  </p>
                </div>
              ) : (
                groups.map((group) => {
                  const groupTeams = teams.filter((team) => team.groupId === group.id);
                  const groupPlayers = draft.players.filter(
                    (player) => player.effectiveGroupId === group.id,
                  );
                  const unteamedPlayers = groupPlayers.filter((player) => !player.teamId);

                  return (
                    <div key={`teams-${group.id}`} className="criterion-card">
                      <div className="criterion-card__header">
                        <div>
                          <h3>{group.name}</h3>
                          <p className="helper-copy">
                            {groupPlayers.length} players currently sit in this group.
                          </p>
                        </div>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            onAddTeam(group.id);
                          }}
                        >
                          Add team
                        </button>
                      </div>

                      <div className="tryout-team-board">
                        <div
                          className="tryout-team-column"
                          onDragOver={(event) => {
                            event.preventDefault();
                          }}
                          onDrop={() => {
                            handlePlayerDrop(null);
                          }}
                        >
                          <div className="tryout-team-column__header">
                            <strong>Available players</strong>
                            <span>{unteamedPlayers.length}</span>
                          </div>
                          <div className="stack-list">
                            {unteamedPlayers.length === 0 ? (
                              <div className="stack-card">
                                <div>
                                  <strong>No players waiting for a team</strong>
                                  <p>Drag a player here to clear their team assignment.</p>
                                </div>
                              </div>
                            ) : (
                              unteamedPlayers.map((player) =>
                                renderTeamPlayerCard(player, groupTeams),
                              )
                            )}
                          </div>
                        </div>

                        {groupTeams.map((team) => {
                          const roster = groupPlayers.filter(
                            (player) => player.teamId === team.id,
                          );

                          return (
                            <div
                              key={team.id}
                              className="tryout-team-column"
                              onDragOver={(event) => {
                                event.preventDefault();
                              }}
                              onDrop={() => {
                                handlePlayerDrop(team.id);
                              }}
                            >
                              <div className="tryout-team-column__header">
                                <div className="field">
                                  <span>Team name</span>
                                  <input
                                    type="text"
                                    value={team.name}
                                    onChange={(event) => {
                                      onUpdateTeamName(team.id, event.target.value);
                                    }}
                                  />
                                </div>
                                <button
                                  className="ghost-button"
                                  type="button"
                                  onClick={() => {
                                    onRemoveTeam(team.id);
                                  }}
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="stack-list">
                                {roster.length === 0 ? (
                                  <div className="stack-card">
                                    <div>
                                      <strong>No players on this team yet</strong>
                                      <p>Drop players here or choose this team from the selector.</p>
                                    </div>
                                  </div>
                                ) : (
                                  roster.map((player) =>
                                    renderTeamPlayerCard(player, groupTeams),
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="form-section">
            <div className="team-history-header">
              <div>
                <h3>Evaluation sessions</h3>
                <p className="helper-copy">
                  Sessions stay freeform. Attach any number of tryout teams to
                  each session so evaluators can load the right player set later.
                </p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={onAddSession}
              >
                Add session
              </button>
            </div>

            <div className="tryout-session-list">
              {sessions.length === 0 ? (
                <div className="empty-state-card">
                  <strong>No sessions created yet</strong>
                  <p>
                    Add sessions after teams are built, or create them now and
                    attach teams later.
                  </p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="criterion-card">
                    <div className="criterion-card__header">
                      <label className="field tryout-session-name-field">
                        <span>Session name</span>
                        <input
                          type="text"
                          value={session.name}
                          onChange={(event) => {
                            onUpdateSessionName(session.id, event.target.value);
                          }}
                        />
                      </label>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          onRemoveSession(session.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="chip-list">
                      {teams.length === 0 ? (
                        <div className="stack-card">
                          <div>
                            <strong>No teams available yet</strong>
                            <p>Create teams first, then attach them to sessions here.</p>
                          </div>
                        </div>
                      ) : (
                        teams.map((team) => (
                          <label key={`${session.id}-${team.id}`} className="chip-option">
                            <input
                              type="checkbox"
                              checked={session.teamIds.includes(team.id)}
                              onChange={(event) => {
                                onToggleSessionTeam(
                                  session.id,
                                  team.id,
                                  event.target.checked,
                                );
                              }}
                            />
                            <span>
                              {team.name} ({getTryoutGroupLabel(team.groupId, groups)})
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </article>
  );
}

function buildEditablePlayerState(player: PlayerRecord): EditablePlayerState {
  return {
    id: player.id,
    profile: {
      ...player.profile,
      teamHistory: sortTeamHistoryEntries(player.profile.teamHistory),
    },
    intake: { ...player.intake.answers },
    intakeStatus: player.intake.status,
  };
}

function buildEmptyPlayerState(
  user: UserProfile,
  role: UserRole,
): EditablePlayerState {
  const defaultContactEmail = user.contactEmail || user.email;
  const defaultPlayerName =
    role === 'player' ? buildPlayerName(user.firstName, user.lastName) : '';

  return {
    id: null,
    profile: {
      playerName: defaultPlayerName,
      firstName: role === 'player' ? user.firstName : '',
      lastName: role === 'player' ? user.lastName : '',
      birthYear: '',
      gender: '',
      primaryPosition: '',
      handedness: '',
      firstYearPlayingHockey: '',
      currentTeam: '',
      positions: '',
      completedBy: role === 'player' ? 'Player' : 'Parent / Guardian',
      bestContactEmail: defaultContactEmail,
      phoneNumber: role === 'player' ? user.phoneNumber : '',
      smsOptIn: role === 'player' ? user.smsOptIn : false,
      teamHistory: [],
      latestHeightFeet: '',
      latestHeightInches: '',
      latestWeightPounds: '',
      physicalHistory: [],
    },
    intake: {
      nextSeasonOutcome: '',
      developmentSetting: '',
      preferredRole: '',
      coachingStyle: '',
      participationConsiderations: '',
      participationConsiderationsNote: '',
      additionalInsight: '',
    },
    intakeStatus: 'draft',
  };
}

function buildUserProfileDraft(user: UserProfile): EditableUserProfileState {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    contactEmail: user.contactEmail,
    phoneNumber: user.phoneNumber,
    smsOptIn: user.smsOptIn,
  };
}

function buildEmptyTeamHistoryEntry(): PlayerTeamHistoryEntry {
  return {
    id: crypto.randomUUID(),
    seasonLabel: '',
    teamName: '',
    positionPlayed: '',
  };
}

function buildOrganizationSettingsDraft(
  organization: OrganizationOverview,
): OrganizationSettingsInput {
  return {
    name: organization.name,
    shortName: organization.shortName,
    website: organization.website,
    logoUrl: organization.logoUrl,
    primaryColor: organization.primaryColor,
    secondaryColor: organization.secondaryColor,
    tryoutWindowLabel: organization.tryoutWindowLabel,
    tryoutWindowStart: organization.tryoutWindowStart,
    tryoutWindowEnd: organization.tryoutWindowEnd,
    intakeIntro: organization.intakeIntro,
  };
}

function buildEditableEvaluationTemplateState(
  template: EvaluationTemplate,
): EditableEvaluationTemplateState {
  return {
    name: template.name,
    criteria: template.criteria.map((criterion) => ({ ...criterion })),
  };
}

function buildBlankEvaluationCriterion(): EvaluationCriterion {
  return {
    id: crypto.randomUUID(),
    title: 'New criterion',
    weight: 50,
    score1Description: 'Describe what a score of 1 looks like.',
    score3Description: 'Describe what a score of 3 looks like.',
    score5Description: 'Describe what a score of 5 looks like.',
  };
}

function buildEditableAdminUserState(
  user: AdminUserDirectoryEntry,
): EditableAdminUserState {
  return {
    primaryRole: user.primaryRole ?? 'staff',
    organizationRoles: [...user.organizationRoles],
    accountStatus: user.accountStatus,
  };
}

function cloneTryoutSeasonState(season: TryoutSeason): TryoutSeason {
  return {
    ...season,
    groups: season.groups.map((group) => ({
      ...group,
      allowedBirthYears: [...group.allowedBirthYears],
      allowedGenders: [...group.allowedGenders],
    })),
    teams: season.teams.map((team) => ({ ...team })),
    sessions: season.sessions.map((session) => ({
      ...session,
      teamIds: [...session.teamIds],
    })),
    playerOverrides: season.playerOverrides.map((override) => ({ ...override })),
    players: season.players.map((player) => ({
      ...player,
      eligibleGroupIds: [...player.eligibleGroupIds],
    })),
  };
}

function recalculateTryoutSeasonDraft(season: TryoutSeason): TryoutSeason {
  const groups = season.groups.map((group) => ({
    ...group,
    allowedBirthYears: sortTryoutBirthYears(group.allowedBirthYears),
    allowedGenders: TRYOUT_GENDERS.filter((gender) =>
      group.allowedGenders.includes(gender),
    ),
  }));
  const validGroupIds = new Set(groups.map((group) => group.id));
  const teams = season.teams.filter((team) => validGroupIds.has(team.groupId));
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const sessions = season.sessions.map((session) => ({
    ...session,
    teamIds: session.teamIds.filter((teamId) => teamMap.has(teamId)),
  }));
  const rawPlayerIdSet = new Set(season.players.map((player) => player.playerId));
  const normalizedOverrides = season.playerOverrides
    .filter((override) => rawPlayerIdSet.has(override.playerId))
    .map((override) => {
      const normalizedOverride = sanitizeTryoutOverrideState(override);

      if (
        normalizedOverride.assignmentMode === 'manual' &&
        normalizedOverride.groupId &&
        !validGroupIds.has(normalizedOverride.groupId)
      ) {
        return {
          ...normalizedOverride,
          assignmentMode: 'unassigned' as const,
          groupId: null,
          teamId: null,
        };
      }

      if (
        normalizedOverride.teamId &&
        !teamMap.has(normalizedOverride.teamId)
      ) {
        return {
          ...normalizedOverride,
          teamId: null,
        };
      }

      return normalizedOverride;
    })
    .filter((override) => !isDefaultTryoutOverrideState(override));
  const players = season.players
    .map((player) =>
      resolveTryoutPlayerSummary(player, groups, teamMap, normalizedOverrides),
    )
    .sort(compareTryoutPlayerSummaries);
  const playerIdSet = new Set(players.map((player) => player.playerId));
  const playerOverrides = normalizedOverrides.filter((override) =>
    playerIdSet.has(override.playerId),
  );

  return {
    ...season,
    groups,
    teams,
    sessions,
    playerOverrides,
    players,
  };
}

function resolveTryoutPlayerSummary(
  player: TryoutPlayerSummary,
  groups: TryoutSeason['groups'],
  teamMap: Map<string, TryoutSeason['teams'][number]>,
  overrides: TryoutPlayerOverride[],
): TryoutPlayerSummary {
  const eligibleGroupIds = groups
    .filter((group) => matchesTryoutPlayerToGroup(player, group))
    .map((group) => group.id);
  const defaultGroupId =
    eligibleGroupIds.length === 1 ? eligibleGroupIds[0] : null;
  const override =
    overrides.find((entry) => entry.playerId === player.playerId) ?? null;
  const effectiveGroupId =
    override?.assignmentMode === 'manual' && override.groupId
      ? override.groupId
      : override?.assignmentMode === 'unassigned'
        ? null
        : defaultGroupId;
  const effectiveTeam =
    override?.teamId ? teamMap.get(override.teamId) ?? null : null;

  return {
    ...player,
    eligibleGroupIds,
    defaultGroupId,
    effectiveGroupId,
    teamId:
      effectiveTeam && effectiveGroupId && effectiveTeam.groupId === effectiveGroupId
        ? effectiveTeam.id
        : null,
    jerseyNumber: override?.jerseyNumber?.trim() ?? '',
  };
}

function matchesTryoutPlayerToGroup(
  player: Pick<TryoutPlayerSummary, 'birthYear' | 'gender'>,
  group: TryoutSeason['groups'][number],
): boolean {
  return (
    group.allowedBirthYears.length > 0 &&
    group.allowedBirthYears.includes(player.birthYear) &&
    group.allowedGenders.length > 0 &&
    group.allowedGenders.includes(player.gender as TryoutGender)
  );
}

function compareTryoutPlayerSummaries(
  left: TryoutPlayerSummary,
  right: TryoutPlayerSummary,
): number {
  const lastNameComparison = left.lastName.localeCompare(right.lastName);
  if (lastNameComparison !== 0) return lastNameComparison;

  const firstNameComparison = left.firstName.localeCompare(right.firstName);
  if (firstNameComparison !== 0) return firstNameComparison;

  if (left.birthYear !== right.birthYear) {
    return left.birthYear.localeCompare(right.birthYear);
  }

  return left.displayName.localeCompare(right.displayName);
}

function updateTryoutPlayerOverridesState(
  overrides: TryoutPlayerOverride[],
  playerId: string,
  updater: (override: TryoutPlayerOverride) => TryoutPlayerOverride,
): TryoutPlayerOverride[] {
  const existingOverride =
    overrides.find((override) => override.playerId === playerId) ?? {
      playerId,
      assignmentMode: 'default' as const,
      groupId: null,
      teamId: null,
      jerseyNumber: '',
    };
  const nextOverride = sanitizeTryoutOverrideState(updater(existingOverride));
  const remainingOverrides = overrides.filter(
    (override) => override.playerId !== playerId,
  );

  return isDefaultTryoutOverrideState(nextOverride)
    ? remainingOverrides
    : [...remainingOverrides, nextOverride];
}

function sanitizeTryoutOverrideState(
  override: TryoutPlayerOverride,
): TryoutPlayerOverride {
  return {
    playerId: override.playerId,
    assignmentMode: override.assignmentMode,
    groupId: override.assignmentMode === 'manual' ? override.groupId ?? null : null,
    teamId: override.assignmentMode === 'unassigned' ? null : override.teamId ?? null,
    jerseyNumber: override.jerseyNumber.trim(),
  };
}

function isDefaultTryoutOverrideState(
  override: TryoutPlayerOverride,
): boolean {
  return (
    override.assignmentMode === 'default' &&
    override.groupId === null &&
    override.teamId === null &&
    override.jerseyNumber === ''
  );
}

function buildTryoutBirthYearOptions(
  players: TryoutPlayerSummary[],
  date = new Date(),
): string[] {
  const years = new Set<string>();
  const currentYear = date.getFullYear();

  for (let year = currentYear - 7; year >= currentYear - 20; year -= 1) {
    years.add(String(year));
  }

  players.forEach((player) => {
    if (/^\d{4}$/.test(player.birthYear)) {
      years.add(player.birthYear);
    }
  });

  return sortTryoutBirthYears([...years]);
}

function sortTryoutBirthYears(values: string[]): string[] {
  return [...new Set(values.filter((value) => /^\d{4}$/.test(value)))]
    .sort((left, right) => Number(right) - Number(left));
}

function getTryoutPlayerAssignmentValue(player: TryoutPlayerSummary): string {
  if (player.effectiveGroupId && player.effectiveGroupId === player.defaultGroupId) {
    return 'default';
  }

  if (player.effectiveGroupId) {
    return `manual:${player.effectiveGroupId}`;
  }

  return player.defaultGroupId ? 'unassigned' : 'unassigned';
}

function getTryoutGroupLabel(
  groupId: string | null,
  groups: TryoutSeason['groups'],
): string {
  if (!groupId) return 'Unassigned Pool';
  return groups.find((group) => group.id === groupId)?.name ?? 'Unknown group';
}

function getTryoutTeamLabel(
  teamId: string | null,
  teams: TryoutSeason['teams'],
): string {
  if (!teamId) return 'Unassigned';
  return teams.find((team) => team.id === teamId)?.name ?? 'Unknown team';
}

function toggleOrganizationRole(
  roles: AdminOrganizationRole[],
  role: AdminOrganizationRole,
  checked: boolean,
): AdminOrganizationRole[] {
  if (checked) return [...new Set<AdminOrganizationRole>([...roles, role])];
  return roles.filter((entry) => entry !== role);
}

function getDirectoryUserName(user: AdminUserDirectoryEntry): string {
  const nextValue = `${user.firstName} ${user.lastName}`.trim();
  return nextValue || user.email;
}

function getUserWorkspaceSections(
  activeRole: AppRole | null,
  primaryRole: PrimaryRole | null,
): Array<{ id: UserWorkspaceView; label: string }> {
  if (activeRole === 'club-admin' || activeRole === 'platform-admin') return [];

  if (activeRole === 'parent' || activeRole === 'player') {
    return [
      {
        id: 'player',
        label: activeRole === 'parent' ? 'Player Profile' : 'My Player Profile',
      },
      { id: 'intake', label: 'Tryout Intake' },
      { id: 'invites', label: 'Linked Access' },
      { id: 'profile', label: 'My Profile' },
    ];
  }

  if (activeRole === 'staff' || activeRole === 'coach' || activeRole === 'manager') {
    return [
      { id: 'overview', label: 'Overview' },
      { id: 'tryouts', label: 'Tryout Setup' },
      { id: 'profile', label: 'My Profile' },
    ];
  }

  if (!primaryRole) {
    return [
      { id: 'setup', label: 'Get Started' },
      { id: 'profile', label: 'My Profile' },
    ];
  }

  if (primaryRole === 'parent' || primaryRole === 'player') {
    return [
      {
        id: 'player',
        label: primaryRole === 'parent' ? 'Player Profile' : 'My Player Profile',
      },
      { id: 'intake', label: 'Tryout Intake' },
      { id: 'invites', label: 'Linked Access' },
      { id: 'profile', label: 'My Profile' },
    ];
  }

  return [
    { id: 'overview', label: 'Overview' },
    { id: 'tryouts', label: 'Tryout Setup' },
    { id: 'profile', label: 'My Profile' },
  ];
}

function resolveInviteRole(role: AppRole | UserRole | null): UserRole | null {
  if (role === 'parent') return 'player';
  if (role === 'player') return 'parent';
  return null;
}

function getAvailableRoles(bootstrap: BootstrapData): AppRole[] {
  const roles = new Set<AppRole>(bootstrap.access.roles);
  if (bootstrap.user.primaryRole) roles.add(bootstrap.user.primaryRole);
  return [...roles].sort(
    (left, right) => ROLE_ORDER.indexOf(left) - ROLE_ORDER.indexOf(right),
  );
}

function readStoredRole(userId: string): AppRole | null {
  try {
    const rawValue = window.localStorage.getItem(storageKey(userId));
    return isAppRole(rawValue) ? rawValue : null;
  } catch {
    return null;
  }
}

function writeStoredRole(userId: string, role: AppRole): void {
  try {
    window.localStorage.setItem(storageKey(userId), role);
  } catch {
    // Ignore local storage failures and keep the session in memory only.
  }
}

function storageKey(userId: string): string {
  return `golden-bears-player-portal:active-role:${userId}`;
}

function isAppRole(value: string | null): value is AppRole {
  return value === 'parent'
    || value === 'player'
    || value === 'staff'
    || value === 'coach'
    || value === 'manager'
    || value === 'club-admin'
    || value === 'platform-admin';
}

function resolveFamilyRole(
  activeRole: AppRole | null,
  primaryRole: PrimaryRole | null,
): UserRole | null {
  if (activeRole === 'parent' || activeRole === 'player') return activeRole;
  if (primaryRole === 'parent' || primaryRole === 'player') return primaryRole;
  return null;
}

function sortTeamHistoryEntries(
  entries: PlayerTeamHistoryEntry[],
): PlayerTeamHistoryEntry[] {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftYear = parseSeasonStartYear(left.entry.seasonLabel);
      const rightYear = parseSeasonStartYear(right.entry.seasonLabel);

      if (leftYear !== rightYear) return leftYear - rightYear;
      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function normalizeCriterionWeightInput(value: string): number {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return 1;
  return Math.max(1, Math.min(100, Math.trunc(parsedValue)));
}

function buildRecentSeasonOptions(date = new Date()): string[] {
  const currentYear = date.getFullYear();
  return Array.from({ length: 6 }, (_, index) =>
    formatSeasonLabel(currentYear - index),
  );
}

function formatSeasonLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

function parseSeasonStartYear(seasonLabel: string): number {
  const match = seasonLabel.match(/^(\d{4})-\d{2}$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function getLatestPhysicalEntry(
  history: PlayerPhysicalEntry[],
): PlayerPhysicalEntry | null {
  if (history.length === 0) return null;
  return [...history].sort((left, right) =>
    left.recordedAt.localeCompare(right.recordedAt),
  )[history.length - 1] ?? null;
}

function buildPlayerName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function getPlayerDisplayName(
  profile: Pick<PlayerProfileInput, 'firstName' | 'lastName' | 'playerName'>,
): string {
  return buildPlayerName(profile.firstName, profile.lastName) || profile.playerName;
}

function buildPlayerListSummary(player: PlayerRecord): string {
  const details = [
    player.profile.birthYear || 'Birth year not set',
    player.profile.primaryPosition || 'Position not set',
    formatIntakeStatus(player.intake.status),
  ];

  return details.join(' - ');
}

function getUserDisplayName(
  user:
    | Pick<UserProfile, 'firstName' | 'lastName'>
    | Pick<EditableUserProfileState, 'firstName' | 'lastName'>,
): string {
  return buildPlayerName(user.firstName, user.lastName);
}

function getInitials(
  firstName: string,
  lastName: string,
  email: string,
): string {
  const nameInitials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`
    .trim()
    .toUpperCase();
  if (nameInitials) return nameInitials;

  const localPart = email.split('@')[0] || 'gb';
  return localPart.slice(0, 2).toUpperCase();
}

function describeWorkspace(
  activeRole: AppRole | null,
  primaryRole: PrimaryRole | null,
): string {
  if (activeRole === 'club-admin') {
    return 'Organization administration tools and summary metrics.';
  }
  if (activeRole === 'platform-admin') {
    return 'Platform administration tools for multi-organization access.';
  }
  if (activeRole === 'staff') {
    return 'Staff workspace with tryout planning and profile tools.';
  }
  if (activeRole === 'coach') return 'Coach workspace with live tryout setup tools.';
  if (activeRole === 'manager') return 'Manager workspace with live tryout setup tools.';
  if (activeRole === 'parent') {
    return 'Family workspace for linked player records and intake forms.';
  }
  if (activeRole === 'player') {
    return 'Player workspace for self-managed intake and linked access.';
  }
  if (primaryRole === 'staff') return 'Primary account type: Staff.';
  if (primaryRole) return `Primary family role: ${ROLE_LABELS[primaryRole]}.`;
  return 'Choose the role that matches this account.';
}

function formatAccountStatus(status: AccountStatus): string {
  return status === 'DISABLED' ? 'Disabled' : 'Active';
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Not available';
  return formatter.format(new Date(value));
}

function formatInviteStatus(status: InviteRecord['status']): string {
  if (status === 'pending') return 'Pending';
  if (status === 'accepted') return 'Accepted';
  if (status === 'declined') return 'Declined';
  return 'Revoked';
}

function formatIntakeStatus(status: IntakeStatus): string {
  if (status === 'submitted') return 'Submitted';
  if (status === 'draft') return 'Draft';
  return 'Not started';
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function isAuthCallbackPath(pathname: string): boolean {
  return pathname === '/auth/callback' || pathname === '/auth/callback/';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const messageMatch = error.message.match(/Request failed for .*?: \d+\s+(.*)$/);
    return messageMatch?.[1] || error.message;
  }
  return 'An unexpected error occurred.';
}

export default App;

