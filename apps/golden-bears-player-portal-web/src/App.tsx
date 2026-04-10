import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
  downloadTryoutSeasonReport,
  loadAdminUsers,
  loadEvaluationSessionContext,
  loadBootstrapData,
  loadEvaluationTemplates,
  loadTryoutSeasons,
  revokeInvite,
  saveUserRole,
  updateAdminUser,
  updateCurrentUserProfile,
  updatePlayerEvaluationRecord,
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
  EvaluationNote,
  EvaluationScoreValue,
  EvaluationSessionContext,
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
  | 'design-lab'
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

type DesignLabView = 'family-hub' | 'profile-inline' | 'ops-command';

type DesignLabPanel = 'actions' | 'players' | 'updates';

type DesignLabDensity = 'comfortable' | 'compact';

type DesignLabProfileField =
  | 'firstName'
  | 'lastName'
  | 'contactEmail'
  | 'phoneNumber'
  | 'birthYear'
  | 'primaryPosition'
  | 'handedness'
  | 'firstYearPlayingHockey';

type DesignLabPlayerPreview = {
  id: string;
  displayName: string;
  birthYear: string;
  position: string;
  relationshipLabel: string;
  intakeStatus: string;
  currentFocus: string;
  summary: string;
};

type DesignLabActionPreview = {
  id: string;
  title: string;
  detail: string;
  buttonLabel: string;
  playerId: string;
};

type DesignLabUpdatePreview = {
  id: string;
  title: string;
  detail: string;
  timestampLabel: string;
  playerId: string;
};

type DesignLabProfileState = {
  firstName: string;
  lastName: string;
  contactEmail: string;
  phoneNumber: string;
  birthYear: string;
  gender: string;
  primaryPosition: string;
  handedness: string;
  firstYearPlayingHockey: string;
  height: string;
  weight: string;
};

type DesignLabTeamHistoryEntry = {
  id: string;
  seasonLabel: string;
  teamName: string;
  positionPlayed: string;
  note: string;
};

type DesignLabRosterEntry = {
  id: string;
  displayName: string;
  groupName: string;
  teamName: string;
  jerseyNumber: string;
  sessionName: string;
  assignmentStatus: 'Default' | 'Override' | 'Unassigned';
  note: string;
};

type FamilySummaryPanel = 'actions' | 'players' | 'updates';

type FamilyActionItem = {
  id: string;
  title: string;
  detail: string;
  targetSection: UserWorkspaceView;
  playerId: string | 'new' | null;
};

type FamilyUpdateItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  targetSection: UserWorkspaceView;
  playerId: string | 'new' | null;
};

type TryoutSetupCardProps = {
  roleLabel: string;
  seasons: TryoutSeason[];
  draft: TryoutSeason | null;
  birthYearOptions: string[];
  loaded: boolean;
  loading: boolean;
  evaluationTemplates: EvaluationTemplate[];
  newSeasonName: string;
  busyAction: string | null;
  draggingPlayerId: string | null;
  onNewSeasonNameChange: (value: string) => void;
  onCreateSeason: () => void;
  onSelectSeason: (seasonId: string) => void;
  onDeleteSeason: () => void;
  onDownloadReport: () => void;
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
  onUpdateTeamColor: (teamId: string, value: string) => void;
  onRemoveTeam: (teamId: string) => void;
  onAssignPlayerToTeam: (playerId: string, teamId: string | null) => void;
  onUpdatePlayerJersey: (playerId: string, value: string) => void;
  onAddSession: () => void;
  onUpdateSessionName: (sessionId: string, value: string) => void;
  onUpdateSessionTemplate: (sessionId: string, templateId: string | null) => void;
  onToggleSessionTeam: (sessionId: string, teamId: string, checked: boolean) => void;
  onRemoveSession: (sessionId: string) => void;
  onStartEvaluation: (sessionId: string) => void;
  onStartPlayerDrag: (playerId: string | null) => void;
};

type EvaluationSaveIndicator = {
  state: 'idle' | 'saving' | 'saved' | 'error';
  message: string;
};

type EvaluationWorkspaceProps = {
  context: EvaluationSessionContext | null;
  loading: boolean;
  feedback: FeedbackState | null;
  saveIndicators: Record<string, EvaluationSaveIndicator>;
  onExit: () => void;
  onSavePlayerRecord: (
    playerId: string,
    payload: {
      scores: Record<string, EvaluationScoreValue | null>;
      notes: EvaluationNote[];
    },
  ) => void;
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
  onFieldCommit: (field: UserProfileFieldKey, value: string) => void;
  onSmsOptInCommit: (value: boolean) => void;
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

const TRYOUT_TEAM_COLOR_PRESETS = [
  { label: 'Navy', value: '#1F3D7A', aliases: ['navy'] },
  { label: 'Blue', value: '#2D6CDF', aliases: ['blue'] },
  { label: 'Red', value: '#C63B34', aliases: ['red'] },
  { label: 'Orange', value: '#E67E22', aliases: ['orange'] },
  { label: 'Gold', value: '#D6A129', aliases: ['gold', 'yellow'] },
  { label: 'Green', value: '#2E8B57', aliases: ['green'] },
  { label: 'Black', value: '#1F2328', aliases: ['black'] },
  { label: 'White', value: '#F6F7F8', aliases: ['white'] },
  { label: 'Gray', value: '#8A949F', aliases: ['gray', 'grey', 'silver'] },
  { label: 'Purple', value: '#7059A6', aliases: ['purple'] },
] as const;

const DEFAULT_TRYOUT_TEAM_COLOR = TRYOUT_TEAM_COLOR_PRESETS[0].value;
const TRYOUT_TEAM_PANEL_SURFACE = '#FBFCFD';

const playerGenderOptions = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Non-binary', label: 'Non-binary' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
];

const playerPositionOptions = [
  { value: 'Forward', label: 'Forward' },
  { value: 'Center', label: 'Center' },
  { value: 'Wing', label: 'Wing' },
  { value: 'Defense', label: 'Defense' },
  { value: 'Goalie', label: 'Goalie' },
];

const handednessOptions = [
  { value: 'Left', label: 'Left' },
  { value: 'Right', label: 'Right' },
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

const DESIGN_LAB_PLAYERS: DesignLabPlayerPreview[] = [
  {
    id: 'avery',
    displayName: 'Avery Morgan (11)',
    birthYear: '2011',
    position: 'Defense',
    relationshipLabel: 'Parent linked',
    intakeStatus: 'Submitted',
    currentFocus: 'Player invite still pending for Avery.',
    summary: '16U eligible / Development intake submitted / Right defense',
  },
  {
    id: 'luca',
    displayName: 'Luca Morgan (13)',
    birthYear: '2013',
    position: 'Center',
    relationshipLabel: 'Parent owner',
    intakeStatus: 'Draft',
    currentFocus: 'Luca still needs two intake questions finished.',
    summary: '14U eligible / Draft intake / Center-forward profile',
  },
];

const DESIGN_LAB_ACTIONS: DesignLabActionPreview[] = [
  {
    id: 'finish-intake',
    title: 'Finish Luca intake draft',
    detail: 'Two unanswered tryout questions are holding back final submission.',
    buttonLabel: 'Open intake draft',
    playerId: 'luca',
  },
  {
    id: 'accept-invite',
    title: 'Resolve Avery linked access',
    detail: 'A player invite is still waiting for Avery to accept from their own login.',
    buttonLabel: 'Review invite',
    playerId: 'avery',
  },
  {
    id: 'update-contact',
    title: 'Confirm text notification number',
    detail: 'The parent account added a phone number but has not confirmed SMS preferences for tryout updates.',
    buttonLabel: 'Open profile',
    playerId: 'luca',
  },
];

const DESIGN_LAB_UPDATES: DesignLabUpdatePreview[] = [
  {
    id: 'update-1',
    title: 'Avery profile was updated',
    detail: 'Height and weight were refreshed after spring training.',
    timestampLabel: 'Today at 7:12 PM',
    playerId: 'avery',
  },
  {
    id: 'update-2',
    title: 'Luca draft was saved',
    detail: 'The player profile is complete, but the intake questions are still in progress.',
    timestampLabel: 'Yesterday at 8:41 PM',
    playerId: 'luca',
  },
  {
    id: 'update-3',
    title: 'Tryout window is now published',
    detail: 'North Carolina Tier 2 tryouts are scheduled for May 1-3, 2026.',
    timestampLabel: 'Apr 5 at 10:05 AM',
    playerId: 'avery',
  },
];

const DESIGN_LAB_PROFILE_INITIAL: DesignLabProfileState = {
  firstName: 'Avery',
  lastName: 'Morgan',
  contactEmail: 'morganfamily@example.com',
  phoneNumber: '(919) 555-0134',
  birthYear: '2011',
  gender: 'Female',
  primaryPosition: 'Defense',
  handedness: 'Right',
  firstYearPlayingHockey: '2017',
  height: `5'5"`,
  weight: '122 lbs',
};

const DESIGN_LAB_TEAM_HISTORY: DesignLabTeamHistoryEntry[] = [
  {
    id: 'team-1',
    seasonLabel: '2026-27',
    teamName: 'NC Golden Bears 16U',
    positionPlayed: 'Defense',
    note: 'Primary fall and winter team',
  },
  {
    id: 'team-2',
    seasonLabel: '2025-26',
    teamName: 'Triangle Elite Spring',
    positionPlayed: 'Defense',
    note: 'Spring showcase roster',
  },
  {
    id: 'team-3',
    seasonLabel: '2025-26',
    teamName: 'NC Golden Bears 14U',
    positionPlayed: 'Defense',
    note: 'Previous regular season team',
  },
];

const DESIGN_LAB_ROSTER: DesignLabRosterEntry[] = [
  {
    id: 'roster-1',
    displayName: 'Avery Morgan (11)',
    groupName: '16U Tier II',
    teamName: 'Blue',
    jerseyNumber: '17',
    sessionName: 'Friday ID Skate',
    assignmentStatus: 'Default',
    note: 'Auto-placed from birth year rule',
  },
  {
    id: 'roster-2',
    displayName: 'Chase Ramirez (11)',
    groupName: '16U Tier II',
    teamName: 'Orange',
    jerseyNumber: '9',
    sessionName: 'Friday ID Skate',
    assignmentStatus: 'Default',
    note: 'Ready for coach evaluation load',
  },
  {
    id: 'roster-3',
    displayName: 'Luca Morgan (13)',
    groupName: '15U Invite',
    teamName: 'Black',
    jerseyNumber: '22',
    sessionName: 'Saturday Pace Session',
    assignmentStatus: 'Override',
    note: 'Coach override into a higher-age look',
  },
  {
    id: 'roster-4',
    displayName: 'Parker Lee (12)',
    groupName: 'Unassigned Pool',
    teamName: 'Unassigned',
    jerseyNumber: '',
    sessionName: 'No sessions yet',
    assignmentStatus: 'Unassigned',
    note: 'Still waiting on a final placement call',
  },
];

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const evaluationSearchParams = new URLSearchParams(location.search);
  const isEvaluationRoute = location.pathname === '/evaluation';
  const evaluationSeasonId = evaluationSearchParams.get('seasonId');
  const evaluationSessionId = evaluationSearchParams.get('sessionId');
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
  const [activeFamilySummaryPanel, setActiveFamilySummaryPanel] =
    useState<FamilySummaryPanel>('actions');
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
  const [evaluationSessionContext, setEvaluationSessionContext] =
    useState<EvaluationSessionContext | null>(null);
  const [evaluationSessionLoading, setEvaluationSessionLoading] = useState(false);
  const [evaluationSaveIndicators, setEvaluationSaveIndicators] = useState<
    Record<string, EvaluationSaveIndicator>
  >({});
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const evaluationSaveVersionRef = useRef<Record<string, number>>({});

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
    const canAccessStaffTools =
      activeRole === 'club-admin' ||
      activeRole === 'platform-admin' ||
      activeRole === 'staff' ||
      activeRole === 'coach' ||
      activeRole === 'manager';

    if (canAccessStaffTools) return;

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
    if (!familyRole) return;

    setActiveFamilySummaryPanel((currentValue) =>
      currentValue === 'actions' || currentValue === 'players' || currentValue === 'updates'
        ? currentValue
        : 'actions',
    );
  }, [activeRole, bootstrap]);

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
    const canAccessEvaluationTemplates =
      activeRole === 'club-admin' ||
      activeRole === 'platform-admin' ||
      activeRole === 'staff' ||
      activeRole === 'coach' ||
      activeRole === 'manager';

    if (!canAccessEvaluationTemplates) {
      return;
    }

    const shouldLoadEvaluationTemplates =
      activeAdminSection === 'templates' ||
      (((activeRole === 'club-admin' || activeRole === 'platform-admin') &&
        activeAdminSection === 'tryouts') ||
        ((activeRole === 'staff' ||
          activeRole === 'coach' ||
          activeRole === 'manager') &&
          activeUserSection === 'tryouts')) ||
      isEvaluationRoute;

    if (!shouldLoadEvaluationTemplates) return;
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
        setFeedback((currentValue) =>
          currentValue?.tone === 'error' &&
          currentValue.message.toLowerCase().includes('unauthorized')
            ? null
            : currentValue,
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
  }, [
    activeAdminSection,
    activeRole,
    activeUserSection,
    authSession,
    isEvaluationRoute,
    runtimeConfig,
  ]);

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
        setFeedback((currentValue) =>
          currentValue?.tone === 'error' &&
          currentValue.message.toLowerCase().includes('unauthorized')
            ? null
            : currentValue,
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

  useEffect(() => {
    if (!isEvaluationRoute) {
      setEvaluationSessionContext(null);
      setEvaluationSessionLoading(false);
      setEvaluationSaveIndicators({});
      evaluationSaveVersionRef.current = {};
      return;
    }

    if (!runtimeConfig || authSession?.status !== 'authenticated') return;
    if (!evaluationSeasonId || !evaluationSessionId) {
      setEvaluationSessionContext(null);
      return;
    }

    const currentRuntimeConfig = runtimeConfig;
    const currentIdToken = authSession.idToken;
    const currentSeasonId = evaluationSeasonId;
    const currentSessionId = evaluationSessionId;
    let cancelled = false;

    async function loadEvaluationContext() {
      setEvaluationSessionLoading(true);

      try {
        const nextContext = await loadEvaluationSessionContext(
          currentRuntimeConfig,
          currentIdToken,
          currentSeasonId,
          currentSessionId,
        );
        if (cancelled) return;
        setEvaluationSessionContext(nextContext);
        setEvaluationSaveIndicators({});
        evaluationSaveVersionRef.current = {};
      } catch (error) {
        if (cancelled) return;
        setEvaluationSessionContext(null);
        setFeedback({
          tone: 'error',
          message: getErrorMessage(error),
        });
      } finally {
        if (!cancelled) setEvaluationSessionLoading(false);
      }
    }

    void loadEvaluationContext();

    return () => {
      cancelled = true;
    };
  }, [
    authSession,
    evaluationSeasonId,
    evaluationSessionId,
    isEvaluationRoute,
    runtimeConfig,
  ]);

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

  async function runSilentAction(
    actionKey: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    setBusyAction(actionKey);

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

  async function saveCurrentUserDraft(
    nextDraft: EditableUserProfileState,
    options?: { silent?: boolean },
  ): Promise<void> {
    if (!runtimeConfig || !authSession) return;

    const firstName = nextDraft.firstName.trim();
    const lastName = nextDraft.lastName.trim();

    if (!firstName || !lastName) {
      setFeedback({
        tone: 'error',
        message: 'First name and last name are required to save your profile.',
      });
      return;
    }

    const execute = options?.silent ? runSilentAction : runAction;

    await execute('save-user-profile', async () => {
      setUserDraft(nextDraft);

      const nextBootstrap = await updateCurrentUserProfile(
        runtimeConfig,
        authSession.idToken,
        {
          firstName,
          lastName,
          contactEmail: nextDraft.contactEmail.trim(),
          phoneNumber: nextDraft.phoneNumber.trim(),
          smsOptIn: nextDraft.smsOptIn,
        },
      );

      setBootstrap(nextBootstrap);

      if (!options?.silent) {
        setFeedback({
          tone: 'success',
          message: 'Your profile has been updated.',
        });
      }
    });
  }

  async function savePlayerDraft(
    nextDraft: EditablePlayerState,
    nextStatus: IntakeStatus,
    options?: { silent?: boolean; successMessage?: string },
  ): Promise<void> {
    if (!runtimeConfig || !authSession) return;

    const actionKey =
      nextDraft.id === null
        ? `create-${options?.silent ? 'profile' : nextStatus}`
        : `update-${options?.silent ? 'profile' : nextStatus}`;

    const execute = options?.silent ? runSilentAction : runAction;

    await execute(actionKey, async () => {
      setDraftPlayer(nextDraft);

      const payload = {
        profile: nextDraft.profile,
        intake: nextDraft.intake,
        intakeStatus: nextStatus,
      };

      const response =
        nextDraft.id === null
          ? await createPlayer(runtimeConfig, authSession.idToken, payload)
          : await updatePlayer(
              runtimeConfig,
              authSession.idToken,
              nextDraft.id,
              payload,
            );

      setBootstrap(response.bootstrap);
      setSelectedPlayerId(response.player.id);
      setDraftPlayer(buildEditablePlayerState(response.player));

      if (!options?.silent) {
        setFeedback({
          tone: 'success',
          message:
            options?.successMessage ??
            (nextStatus === 'submitted'
              ? 'The intake form has been submitted.'
              : 'The intake draft has been saved.'),
        });
      }
    });
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

  function commitCurrentUserField(
    field: UserProfileFieldKey,
    value: string,
  ): void {
    if (!userDraft) return;

    const nextDraft = {
      ...userDraft,
      [field]: value,
    };

    void saveCurrentUserDraft(nextDraft, { silent: true });
  }

  function commitCurrentUserSmsOptIn(value: boolean): void {
    if (!userDraft) return;

    const nextDraft = {
      ...userDraft,
      smsOptIn: value,
    };

    void saveCurrentUserDraft(nextDraft, { silent: true });
  }

  function commitExistingPlayerProfile(
    buildNextDraft: (currentValue: EditablePlayerState) => EditablePlayerState,
  ): void {
    if (!draftPlayer || draftPlayer.id === null) return;

    const nextDraft = buildNextDraft(draftPlayer);
    void savePlayerDraft(nextDraft, draftPlayer.intakeStatus, { silent: true });
  }

  function commitExistingPlayerName(
    field: 'firstName' | 'lastName',
    value: string,
  ): void {
    commitExistingPlayerProfile((currentValue) => {
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

  function commitExistingPlayerProfileField<K extends keyof PlayerProfileInput>(
    field: K,
    value: PlayerProfileInput[K],
  ): void {
    commitExistingPlayerProfile((currentValue) => ({
      ...currentValue,
      profile: {
        ...currentValue.profile,
        [field]: value,
      },
    }));
  }

  function commitExistingPlayerPrimaryPosition(value: string): void {
    commitExistingPlayerProfile((currentValue) => ({
      ...currentValue,
      profile: {
        ...currentValue.profile,
        primaryPosition: value,
        positions: value,
      },
    }));
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
            tryoutBirthYearOptions,
          )
        : currentValue,
    );
  }

  const tryoutBirthYearOptions = buildTryoutBirthYearOptions(
    organizationDraft?.tryoutBirthYearYoungest ??
      bootstrap?.organization.tryoutBirthYearYoungest ??
      '',
    organizationDraft?.tryoutBirthYearOldest ??
      bootstrap?.organization.tryoutBirthYearOldest ??
      '',
  );
  const tryoutBirthYearOptionsKey = tryoutBirthYearOptions.join('|');

  useEffect(() => {
    if (!tryoutBirthYearOptionsKey) return;
    setTryoutSeasonDraft((currentValue) =>
      currentValue
        ? recalculateTryoutSeasonDraft(
            cloneTryoutSeasonState(currentValue),
            tryoutBirthYearOptionsKey.split('|'),
          )
        : currentValue,
    );
  }, [tryoutBirthYearOptionsKey]);

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
      setFeedback(null);
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

  async function handleDownloadTryoutSeasonReport(): Promise<void> {
    if (
      !runtimeConfig ||
      authSession?.status !== 'authenticated' ||
      !selectedTryoutSeasonId ||
      !tryoutSeasonDraft
    ) {
      return;
    }

    await runAction(`download-tryout-season-report-${selectedTryoutSeasonId}`, async () => {
      const response = await downloadTryoutSeasonReport(
        runtimeConfig,
        authSession.idToken,
        selectedTryoutSeasonId,
        tryoutSeasonDraft.name,
      );
      setFeedback({
        tone: 'success',
        message: `${response.fileName} downloaded.`,
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
      const nextGroupTeamCount = draft.teams.filter((team) => team.groupId === groupId).length;
      const nextTeamNumber = nextGroupTeamCount + 1;
      const teamName = `Team ${nextTeamNumber}`;

      return {
        ...draft,
        teams: [
          ...draft.teams,
          {
            id: crypto.randomUUID(),
            groupId,
            name: teamName,
            jerseyColor: getDefaultTryoutTeamColor(teamName, nextGroupTeamCount),
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

  function updateTryoutTeamColor(teamId: string, value: string): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      teams: draft.teams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              jerseyColor: normalizeHexColor(value, team.jerseyColor),
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
          evaluationTemplateId: null,
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

  function updateTryoutSessionTemplate(
    sessionId: string,
    templateId: string | null,
  ): void {
    applyTryoutDraft((draft) => ({
      ...draft,
      sessions: draft.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              evaluationTemplateId: templateId,
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

  function handleStartEvaluation(sessionId: string): void {
    if (!tryoutSeasonDraft) return;

    const targetSession =
      tryoutSeasonDraft.sessions.find((session) => session.id === sessionId) ?? null;
    if (!targetSession) return;

    if (!targetSession.evaluationTemplateId) {
      setFeedback({
        tone: 'error',
        message: 'Assign an evaluation template to this session before starting evaluation.',
      });
      return;
    }

    if (targetSession.teamIds.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'Attach at least one tryout team to this session before starting evaluation.',
      });
      return;
    }

    navigate(
      `/evaluation?seasonId=${encodeURIComponent(
        tryoutSeasonDraft.id,
      )}&sessionId=${encodeURIComponent(sessionId)}`,
    );
  }

  function handleExitEvaluation(): void {
    if (activeRole === 'club-admin' || activeRole === 'platform-admin') {
      setActiveAdminSection('tryouts');
    } else {
      setActiveUserSection('tryouts');
    }

    navigate('/');
  }

  function handleSaveEvaluationPlayerRecord(
    playerId: string,
    payload: {
      scores: Record<string, EvaluationScoreValue | null>;
      notes: EvaluationNote[];
    },
  ): void {
    if (
      !runtimeConfig ||
      authSession?.status !== 'authenticated' ||
      !evaluationSessionContext
    ) {
      return;
    }

    const previousRecord =
      evaluationSessionContext.records.find((record) => record.playerId === playerId) ?? null;
    const nextVersion =
      (evaluationSaveVersionRef.current[playerId] ?? 0) + 1;
    evaluationSaveVersionRef.current[playerId] = nextVersion;

    const optimisticRecord = buildOptimisticEvaluationRecord(
      evaluationSessionContext,
      playerId,
      payload.scores,
      payload.notes,
      previousRecord,
    );

    setEvaluationSessionContext((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            records: upsertEvaluationRecordState(
              currentValue.records,
              playerId,
              optimisticRecord,
            ),
          }
        : currentValue,
    );
    setEvaluationSaveIndicators((currentValue) => ({
      ...currentValue,
      [playerId]: {
        state: 'saving',
        message: 'Saving...',
      },
    }));

    void updatePlayerEvaluationRecord(
      runtimeConfig,
      authSession.idToken,
      evaluationSessionContext.seasonId,
      evaluationSessionContext.session.id,
      playerId,
      payload,
    )
      .then((response) => {
        if ((evaluationSaveVersionRef.current[playerId] ?? 0) !== nextVersion) return;

        setEvaluationSessionContext((currentValue) =>
          currentValue
            ? {
                ...currentValue,
                records: upsertEvaluationRecordState(
                  currentValue.records,
                  playerId,
                  response.record,
                ),
              }
            : currentValue,
        );
        setEvaluationSaveIndicators((currentValue) => ({
          ...currentValue,
          [playerId]: {
            state: 'saved',
            message: 'Saved',
          },
        }));
      })
      .catch((error) => {
        if ((evaluationSaveVersionRef.current[playerId] ?? 0) !== nextVersion) return;

        setEvaluationSessionContext((currentValue) =>
          currentValue
            ? {
                ...currentValue,
                records: upsertEvaluationRecordState(
                  currentValue.records,
                  playerId,
                  previousRecord,
                ),
              }
            : currentValue,
        );
        setEvaluationSaveIndicators((currentValue) => ({
          ...currentValue,
          [playerId]: {
            state: 'error',
            message: getErrorMessage(error),
          },
        }));
      });
  }

  async function handleSavePlayer(nextStatus: IntakeStatus): Promise<void> {
    if (!draftPlayer) return;
    await savePlayerDraft(draftPlayer, nextStatus);
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
  const familyActionItems = familyRole
    ? buildFamilyActionItems(bootstrap.players, bootstrap.receivedInvites)
    : [];
  const familyUpdateItems = familyRole
    ? buildFamilyUpdateItems(bootstrap.players, bootstrap.receivedInvites)
    : [];
  const nextEventLabel = buildNextEventLabel(bootstrap.organization);
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

  if (isEvaluationRoute) {
    return (
      <EvaluationWorkspace
        context={evaluationSessionContext}
        loading={evaluationSessionLoading}
        feedback={feedback}
        saveIndicators={evaluationSaveIndicators}
        onExit={handleExitEvaluation}
        onSavePlayerRecord={handleSaveEvaluationPlayerRecord}
      />
    );
  }

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
      birthYearOptions={tryoutBirthYearOptions}
      loaded={tryoutSeasonsLoaded}
      loading={tryoutSeasonsLoading}
      evaluationTemplates={evaluationTemplates}
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
      onDownloadReport={() => {
        void handleDownloadTryoutSeasonReport();
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
      onUpdateTeamColor={updateTryoutTeamColor}
      onRemoveTeam={removeTryoutTeam}
      onAssignPlayerToTeam={assignTryoutPlayerToTeam}
      onUpdatePlayerJersey={updateTryoutPlayerJersey}
      onAddSession={addTryoutSession}
      onUpdateSessionName={updateTryoutSessionName}
      onUpdateSessionTemplate={updateTryoutSessionTemplate}
      onToggleSessionTeam={toggleTryoutSessionTeam}
      onRemoveSession={removeTryoutSession}
      onStartEvaluation={handleStartEvaluation}
      onStartPlayerDrag={setDraggingTryoutPlayerId}
    />
  );
  const userProfileCard = userDraft ? (
    <UserProfileCard
      signInEmail={bootstrap.user.email}
      userDraft={userDraft}
      busyAction={busyAction}
      onFieldCommit={commitCurrentUserField}
      onSmsOptInCommit={commitCurrentUserSmsOptIn}
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
        <>
          <section className="action-dock">
            <button
              className={`action-dock__chip ${
                activeFamilySummaryPanel === 'actions'
                  ? 'action-dock__chip--active'
                  : ''
              }`}
              type="button"
              onClick={() => {
                setActiveFamilySummaryPanel('actions');
              }}
            >
              <span>Required actions</span>
              <strong>{familyActionItems.length}</strong>
            </button>
            <button
              className={`action-dock__chip ${
                activeFamilySummaryPanel === 'players'
                  ? 'action-dock__chip--active'
                  : ''
              }`}
              type="button"
              onClick={() => {
                setActiveFamilySummaryPanel('players');
              }}
            >
              <span>Linked players</span>
              <strong>{playerCount}</strong>
            </button>
            <button
              className={`action-dock__chip ${
                activeFamilySummaryPanel === 'updates'
                  ? 'action-dock__chip--active'
                  : ''
              }`}
              type="button"
              onClick={() => {
                setActiveFamilySummaryPanel('updates');
              }}
            >
              <span>Recent updates</span>
              <strong>{familyUpdateItems.length}</strong>
            </button>
            <button
              className="action-dock__chip action-dock__chip--static"
              type="button"
              onClick={() => {
                setActiveUserSection('intake');
              }}
            >
              <span>Next event</span>
              <strong>{nextEventLabel}</strong>
            </button>
          </section>

          <section className="action-panel">
            {activeFamilySummaryPanel === 'actions' ? (
              familyActionItems.length === 0 ? (
                <div className="stack-card">
                  <div>
                    <strong>No required actions right now</strong>
                    <p>
                      Player records, intake work, and linked access are all in
                      a good state for this login.
                    </p>
                  </div>
                </div>
              ) : (
                familyActionItems.map((item) => (
                  <button
                    key={item.id}
                    className="action-panel__item"
                    type="button"
                    onClick={() => {
                      if (item.playerId) setSelectedPlayerId(item.playerId);
                      setActiveUserSection(item.targetSection);
                    }}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <span className="status-chip">{sectionLabel(item.targetSection)}</span>
                  </button>
                ))
              )
            ) : null}

            {activeFamilySummaryPanel === 'players' ? (
              bootstrap.players.length === 0 ? (
                <div className="stack-card">
                  <div>
                    <strong>No linked player records yet</strong>
                    <p>
                      Add a player record to start the intake and linked-access
                      workflow.
                    </p>
                  </div>
                </div>
              ) : (
                bootstrap.players.map((player) => (
                  <button
                    key={player.id}
                    className="action-panel__item"
                    type="button"
                    onClick={() => {
                      setSelectedPlayerId(player.id);
                      setActiveUserSection('player');
                    }}
                  >
                    <div>
                      <strong>{getPlayerDisplayName(player.profile)}</strong>
                      <p>{buildPlayerListSummary(player)}</p>
                    </div>
                    <span className="status-chip">
                      {formatIntakeStatus(player.intake.status)}
                    </span>
                  </button>
                ))
              )
            ) : null}

            {activeFamilySummaryPanel === 'updates' ? (
              familyUpdateItems.length === 0 ? (
                <div className="stack-card">
                  <div>
                    <strong>No recent updates yet</strong>
                    <p>
                      Activity on player records, intake progress, and invites
                      will show up here.
                    </p>
                  </div>
                </div>
              ) : (
                familyUpdateItems.map((item) => (
                  <button
                    key={item.id}
                    className="action-panel__item"
                    type="button"
                    onClick={() => {
                      if (item.playerId) setSelectedPlayerId(item.playerId);
                      setActiveUserSection(item.targetSection);
                    }}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <span className="status-chip">{formatTimestamp(item.timestamp)}</span>
                  </button>
                ))
              )
            ) : null}
          </section>
        </>
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
                    ['design-lab', 'Design Lab'],
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

                        <label className="field">
                          <span>Youngest tryout birth year</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1900"
                            max="2099"
                            step="1"
                            value={organizationDraft.tryoutBirthYearYoungest}
                            onChange={(event) => {
                              setOrganizationDraft((currentValue) =>
                                currentValue
                                  ? {
                                      ...currentValue,
                                      tryoutBirthYearYoungest: event.target.value,
                                    }
                                  : currentValue,
                              );
                            }}
                          />
                        </label>

                        <label className="field">
                          <span>Oldest tryout birth year</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1900"
                            max="2099"
                            step="1"
                            value={organizationDraft.tryoutBirthYearOldest}
                            onChange={(event) => {
                              setOrganizationDraft((currentValue) =>
                                currentValue
                                  ? {
                                      ...currentValue,
                                      tryoutBirthYearOldest: event.target.value,
                                    }
                                  : currentValue,
                              );
                            }}
                          />
                        </label>
                      </div>
                      <p className="helper-copy">
                        This range powers the birth-year chips in tryout group
                        setup, ordered youngest to oldest.
                      </p>
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
                        <IconLabelActionButton
                          label={
                            busyAction === 'save-organization'
                              ? 'Saving organization...'
                              : 'Save organization'
                          }
                          icon="save"
                          onClick={() => {
                            void handleSaveOrganization();
                          }}
                          disabled={busyAction === 'save-organization'}
                        />
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
                        <IconLabelActionButton
                          label={
                            busyAction === 'create-template-blank'
                              ? 'Creating template...'
                              : 'New template'
                          }
                          icon="add"
                          onClick={() => {
                            void handleCreateEvaluationTemplate('blank');
                          }}
                          disabled={busyAction === 'create-template-blank'}
                        />
                        <IconLabelActionButton
                          label={
                            busyAction === 'create-template-default'
                              ? 'Loading defaults...'
                              : 'Load defaults'
                          }
                          icon="save"
                          onClick={() => {
                            void handleCreateEvaluationTemplate('default');
                          }}
                          disabled={busyAction === 'create-template-default'}
                        />
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
                            <IconLabelActionButton
                              label={
                                busyAction === 'create-template-copy'
                                  ? 'Copying template...'
                                  : 'Copy template'
                              }
                              icon="add"
                              onClick={() => {
                                void handleCreateEvaluationTemplate('copy');
                              }}
                              disabled={busyAction === 'create-template-copy'}
                            />
                            <IconLabelActionButton
                              label={
                                busyAction ===
                                `delete-template-${selectedEvaluationTemplate.id}`
                                  ? 'Deleting template...'
                                  : 'Delete template'
                              }
                              icon="delete"
                              onClick={() => {
                                void handleDeleteSelectedEvaluationTemplate();
                              }}
                              disabled={
                                busyAction ===
                                `delete-template-${selectedEvaluationTemplate.id}`
                              }
                            />
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
                              <IconLabelActionButton
                                label="Add criterion"
                                icon="add"
                                onClick={addEvaluationCriterion}
                              />
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
                                      <IconActionButton
                                        label="Remove criterion"
                                        icon="delete"
                                        danger
                                        onClick={() => {
                                          removeEvaluationCriterion(criterion.id);
                                        }}
                                        disabled={
                                          evaluationTemplateDraft.criteria.length === 1
                                        }
                                      />
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
                              <IconLabelActionButton
                                label={
                                  busyAction ===
                                  `save-template-${selectedEvaluationTemplate.id}`
                                    ? 'Saving template...'
                                    : 'Save template'
                                }
                                icon="save"
                                onClick={() => {
                                  void handleSaveEvaluationTemplate();
                                }}
                                disabled={
                                  busyAction ===
                                  `save-template-${selectedEvaluationTemplate.id}`
                                }
                              />
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

            {activeAdminSection === 'design-lab' ? <DesignLab /> : null}

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
                      <IconActionButton
                        label="Add player"
                        icon="add"
                        onClick={() => {
                          setSelectedPlayerId('new');
                        }}
                      />
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
                <PlayerProfileCard
                  draftPlayer={draftPlayer}
                  busyAction={busyAction}
                  recentSeasonOptions={recentSeasonOptions}
                  onNameChange={updateDraftPlayerNames}
                  onProfileFieldChange={updateDraftPlayerProfileField}
                  onCommitName={commitExistingPlayerName}
                  onCommitField={commitExistingPlayerProfileField}
                  onCommitPrimaryPosition={commitExistingPlayerPrimaryPosition}
                  onAddTeamHistoryEntry={addTeamHistoryEntry}
                  onUpdateTeamHistoryEntry={updateTeamHistoryEntry}
                  onRemoveTeamHistoryEntry={removeTeamHistoryEntry}
                  onSaveProfile={() => {
                    void savePlayerDraft(
                      draftPlayer,
                      draftPlayer.intakeStatus,
                      {
                        successMessage: 'The player profile has been saved.',
                      },
                    );
                  }}
                />
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

function InlineEditableField({
  editId,
  label,
  value,
  placeholder = 'Not set yet',
  displayValue,
  inputType = 'text',
  inputMode,
  options,
  activeEditId,
  onStartEditing,
  onStopEditing,
  onCommit,
}: {
  editId: string;
  label: string;
  value: string;
  placeholder?: string;
  displayValue?: string;
  inputType?: 'text' | 'email' | 'tel';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  options?: Array<{ value: string; label: string }>;
  activeEditId: string | null;
  onStartEditing: (editId: string) => void;
  onStopEditing: () => void;
  onCommit: (value: string) => void;
}) {
  const isEditing = activeEditId === editId;
  const [draftValue, setDraftValue] = useState(value);

  function beginEditing(): void {
    setDraftValue(value);
    onStartEditing(editId);
  }

  function commitValue(): void {
    const nextValue = draftValue.trim();
    onStopEditing();
    if (nextValue === value.trim()) return;
    onCommit(nextValue);
  }

  const presentedValue =
    displayValue
    ?? options?.find((option) => option.value === value)?.label
    ?? value
    ?? '';

  return (
    <div
      className={`inline-field ${isEditing ? 'inline-field--editing' : ''}`}
      role={isEditing ? undefined : 'button'}
      tabIndex={isEditing ? -1 : 0}
      onClick={() => {
        if (!isEditing) beginEditing();
      }}
      onKeyDown={(event) => {
        if (isEditing) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          beginEditing();
        }
      }}
    >
      <span className="inline-field__label">{label}</span>
      {isEditing ? (
        options ? (
          <select
            autoFocus
            value={draftValue}
            onChange={(event) => {
              setDraftValue(event.target.value);
            }}
            onBlur={commitValue}
          >
            <option value="">Select</option>
            {options.map((option) => (
              <option key={`${editId}-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            type={inputType}
            inputMode={inputMode}
            value={draftValue}
            onChange={(event) => {
              setDraftValue(event.target.value);
            }}
            onBlur={commitValue}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }

              if (event.key === 'Escape') {
                setDraftValue(value);
                onStopEditing();
              }
            }}
          />
        )
      ) : (
        <strong>{presentedValue || placeholder}</strong>
      )}
    </div>
  );
}

function UserProfileCard({
  signInEmail,
  userDraft,
  busyAction,
  onFieldCommit,
  onSmsOptInCommit,
}: UserProfileCardProps) {
  const [activeEditId, setActiveEditId] = useState<string | null>(null);

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
        <span className="status-chip">
          {busyAction === 'save-user-profile' ? 'Saving...' : 'Inline autosave'}
        </span>
      </div>

      <div className="inline-field-grid">
        <InlineEditableField
          editId="user-first-name"
          label="First name"
          value={userDraft.firstName}
          placeholder="First name"
          activeEditId={activeEditId}
          onStartEditing={setActiveEditId}
          onStopEditing={() => {
            setActiveEditId(null);
          }}
          onCommit={(value) => {
            onFieldCommit('firstName', value);
          }}
        />
        <InlineEditableField
          editId="user-last-name"
          label="Last name"
          value={userDraft.lastName}
          placeholder="Last name"
          activeEditId={activeEditId}
          onStartEditing={setActiveEditId}
          onStopEditing={() => {
            setActiveEditId(null);
          }}
          onCommit={(value) => {
            onFieldCommit('lastName', value);
          }}
        />
        <InlineEditableField
          editId="user-contact-email"
          label="Contact email"
          value={userDraft.contactEmail}
          placeholder="name@example.com"
          inputType="email"
          activeEditId={activeEditId}
          onStartEditing={setActiveEditId}
          onStopEditing={() => {
            setActiveEditId(null);
          }}
          onCommit={(value) => {
            onFieldCommit('contactEmail', value);
          }}
        />
        <InlineEditableField
          editId="user-phone"
          label="Phone number"
          value={userDraft.phoneNumber}
          placeholder="Optional"
          inputType="tel"
          activeEditId={activeEditId}
          onStartEditing={setActiveEditId}
          onStopEditing={() => {
            setActiveEditId(null);
          }}
          onCommit={(value) => {
            onFieldCommit('phoneNumber', value);
          }}
        />
        <div className="inline-field inline-field--readonly">
          <span className="inline-field__label">Sign-in email</span>
          <strong>{signInEmail}</strong>
        </div>
        <label className="inline-toggle">
          <input
            type="checkbox"
            checked={userDraft.smsOptIn}
            onChange={(event) => {
              onSmsOptInCommit(event.target.checked);
            }}
          />
          <div>
            <span className="inline-field__label">Text notifications</span>
            <strong>{userDraft.smsOptIn ? 'Enabled' : 'Not enabled'}</strong>
          </div>
        </label>
      </div>
    </article>
  );
}

function IconGlyph({ name }: { name: 'edit' | 'add' | 'delete' | 'save' }) {
  if (name === 'edit') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M13.9 3.1a1.9 1.9 0 0 1 2.7 2.7l-8.8 8.8-3.4.7.7-3.4 8.8-8.8Z" />
        <path d="m12.8 4.2 3 3" />
      </svg>
    );
  }

  if (name === 'add') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M10 4.5v11" />
        <path d="M4.5 10h11" />
      </svg>
    );
  }

  if (name === 'delete') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M5.5 5.5 14.5 14.5" />
        <path d="M14.5 5.5 5.5 14.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="m4.5 10 3.4 3.4 7.6-7.8" />
    </svg>
  );
}

function IconActionButton({
  label,
  icon,
  danger = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon: 'edit' | 'add' | 'delete' | 'save';
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`icon-action-button ${danger ? 'icon-action-button--danger' : ''}`}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <IconGlyph name={icon} />
    </button>
  );
}

function IconLabelActionButton({
  label,
  icon,
  disabled = false,
  onClick,
}: {
  label: string;
  icon: 'edit' | 'add' | 'delete' | 'save';
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="icon-label-button"
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <IconGlyph name={icon} />
      <span>{label}</span>
    </button>
  );
}

function PlayerProfileCard({
  draftPlayer,
  busyAction,
  recentSeasonOptions,
  onNameChange,
  onProfileFieldChange,
  onCommitName,
  onCommitField,
  onCommitPrimaryPosition,
  onAddTeamHistoryEntry,
  onUpdateTeamHistoryEntry,
  onRemoveTeamHistoryEntry,
  onSaveProfile,
}: {
  draftPlayer: EditablePlayerState;
  busyAction: string | null;
  recentSeasonOptions: string[];
  onNameChange: (field: 'firstName' | 'lastName', value: string) => void;
  onProfileFieldChange: <K extends keyof PlayerProfileInput>(
    field: K,
    value: PlayerProfileInput[K],
  ) => void;
  onCommitName: (field: 'firstName' | 'lastName', value: string) => void;
  onCommitField: <K extends keyof PlayerProfileInput>(
    field: K,
    value: PlayerProfileInput[K],
  ) => void;
  onCommitPrimaryPosition: (value: string) => void;
  onAddTeamHistoryEntry: () => void;
  onUpdateTeamHistoryEntry: (
    entryId: string,
    field: keyof Omit<PlayerTeamHistoryEntry, 'id'>,
    value: string,
  ) => void;
  onRemoveTeamHistoryEntry: (entryId: string) => void;
  onSaveProfile: () => void;
}) {
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const isSavedRecord = draftPlayer.id !== null;
  const latestPhysicalEntry = getLatestPhysicalEntry(draftPlayer.profile.physicalHistory);
  const isSavingProfile =
    busyAction === 'create-not-started'
    || busyAction === 'create-draft'
    || busyAction === 'update-not-started'
    || busyAction === 'update-draft'
    || busyAction === 'update-submitted'
    || busyAction === 'create-profile'
    || busyAction === 'update-profile';

  return (
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
            Player profile details stay separate from the intake form so linked
            parents and players can keep this record current over time.
          </p>
        </div>
        <span className="status-chip">
          {isSavedRecord
            ? isSavingProfile
              ? 'Saving...'
              : 'Inline autosave'
            : 'New player'}
        </span>
      </div>

      {isSavedRecord ? (
        <>
          <div className="inline-field-grid">
            <InlineEditableField
              editId="player-first-name"
              label="First name"
              value={draftPlayer.profile.firstName}
              placeholder="First name"
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitName('firstName', value);
              }}
            />
            <InlineEditableField
              editId="player-last-name"
              label="Last name"
              value={draftPlayer.profile.lastName}
              placeholder="Last name"
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitName('lastName', value);
              }}
            />
            <InlineEditableField
              editId="player-birth-year"
              label="Birth year"
              value={draftPlayer.profile.birthYear}
              placeholder="e.g. 2011"
              inputMode="numeric"
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitField('birthYear', value);
              }}
            />
            <InlineEditableField
              editId="player-gender"
              label="Gender"
              value={draftPlayer.profile.gender}
              options={playerGenderOptions}
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitField('gender', value);
              }}
            />
            <InlineEditableField
              editId="player-position"
              label="Primary position"
              value={draftPlayer.profile.primaryPosition}
              options={playerPositionOptions}
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitPrimaryPosition(value);
              }}
            />
            <InlineEditableField
              editId="player-handedness"
              label="Handedness"
              value={draftPlayer.profile.handedness}
              options={handednessOptions}
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitField('handedness', value);
              }}
            />
            <InlineEditableField
              editId="player-first-year"
              label="First year playing hockey"
              value={draftPlayer.profile.firstYearPlayingHockey}
              placeholder="e.g. 2018"
              inputMode="numeric"
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitField('firstYearPlayingHockey', value);
              }}
            />
            <InlineEditableField
              editId="player-contact-email"
              label="Player contact email"
              value={draftPlayer.profile.bestContactEmail}
              placeholder="name@example.com"
              inputType="email"
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitField('bestContactEmail', value);
              }}
            />
            <InlineEditableField
              editId="player-phone-number"
              label="Player phone number"
              value={draftPlayer.profile.phoneNumber}
              placeholder="Optional"
              inputType="tel"
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitField('phoneNumber', value);
              }}
            />
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={draftPlayer.profile.smsOptIn}
                onChange={(event) => {
                  onCommitField('smsOptIn', event.target.checked);
                }}
              />
              <div>
                <span className="inline-field__label">Text notifications</span>
                <strong>{draftPlayer.profile.smsOptIn ? 'Enabled' : 'Not enabled'}</strong>
              </div>
            </label>
          </div>

          <div className="metric-card-grid">
            <InlineEditableField
              editId="player-height-feet"
              label="Height (ft)"
              value={draftPlayer.profile.latestHeightFeet}
              placeholder="5"
              inputMode="numeric"
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitField('latestHeightFeet', value);
              }}
            />
            <InlineEditableField
              editId="player-height-inches"
              label="Height (in)"
              value={draftPlayer.profile.latestHeightInches}
              placeholder="6"
              inputMode="numeric"
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitField('latestHeightInches', value);
              }}
            />
            <InlineEditableField
              editId="player-weight"
              label="Weight (lb)"
              value={draftPlayer.profile.latestWeightPounds}
              placeholder="140"
              inputMode="numeric"
              activeEditId={activeEditId}
              onStartEditing={setActiveEditId}
              onStopEditing={() => {
                setActiveEditId(null);
              }}
              onCommit={(value) => {
                onCommitField('latestWeightPounds', value);
              }}
            />
          </div>

          {latestPhysicalEntry ? (
            <p className="helper-copy profile-footnote">
              Latest measurement recorded {formatTimestamp(latestPhysicalEntry.recordedAt)}.
              Prior entries stay stored for future growth history.
            </p>
          ) : null}
        </>
      ) : (
        <div className="form-section">
          <h3>Basic details</h3>
          <div className="field-grid">
            <label className="field">
              <span>First name</span>
              <input
                type="text"
                value={draftPlayer.profile.firstName}
                onChange={(event) => {
                  onNameChange('firstName', event.target.value);
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
                  onNameChange('lastName', event.target.value);
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
                  onProfileFieldChange('birthYear', event.target.value);
                }}
                placeholder="e.g. 2011"
              />
            </label>

            <label className="field">
              <span>Gender</span>
              <select
                value={draftPlayer.profile.gender}
                onChange={(event) => {
                  onProfileFieldChange('gender', event.target.value);
                }}
              >
                <option value="">Select</option>
                {playerGenderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Primary position</span>
              <select
                value={draftPlayer.profile.primaryPosition}
                onChange={(event) => {
                  onProfileFieldChange('primaryPosition', event.target.value);
                  onProfileFieldChange('positions', event.target.value);
                }}
              >
                <option value="">Select</option>
                {playerPositionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Handedness</span>
              <select
                value={draftPlayer.profile.handedness}
                onChange={(event) => {
                  onProfileFieldChange('handedness', event.target.value);
                }}
              >
                <option value="">Select</option>
                {handednessOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>First year playing hockey</span>
              <input
                type="text"
                inputMode="numeric"
                value={draftPlayer.profile.firstYearPlayingHockey}
                onChange={(event) => {
                  onProfileFieldChange('firstYearPlayingHockey', event.target.value);
                }}
                placeholder="e.g. 2018"
              />
            </label>

            <label className="field">
              <span>Player contact email</span>
              <input
                type="email"
                value={draftPlayer.profile.bestContactEmail}
                onChange={(event) => {
                  onProfileFieldChange('bestContactEmail', event.target.value);
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
                  onProfileFieldChange('phoneNumber', event.target.value);
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
                onProfileFieldChange('smsOptIn', event.target.checked);
              }}
            />
            <div>
              <strong>Allow text message notifications</strong>
              <p className="helper-copy">Turn this on only if a phone number has been added.</p>
            </div>
          </label>

          <div className="measure-grid">
            <label className="field">
              <span>Height (ft)</span>
              <input
                type="text"
                inputMode="numeric"
                value={draftPlayer.profile.latestHeightFeet}
                onChange={(event) => {
                  onProfileFieldChange('latestHeightFeet', event.target.value);
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
                  onProfileFieldChange('latestHeightInches', event.target.value);
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
                  onProfileFieldChange('latestWeightPounds', event.target.value);
                }}
                placeholder="140"
              />
            </label>
          </div>
        </div>
      )}

      <div className="form-section">
        <div className="team-history-header">
          <div>
            <h3>Previous teams</h3>
            <p className="helper-copy">
              Add as many entries as needed. Use season labels like 2025-26 or 2026-27.
            </p>
          </div>
          <div className="icon-action-row">
            <IconActionButton
              label="Add team history entry"
              icon="add"
              onClick={onAddTeamHistoryEntry}
            />
          </div>
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
                  Add one or more recent teams, including spring, summer, or
                  tournament teams in the same season when needed.
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
                      onUpdateTeamHistoryEntry(
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
                      onUpdateTeamHistoryEntry(entry.id, 'teamName', event.target.value);
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
                      onUpdateTeamHistoryEntry(
                        entry.id,
                        'positionPlayed',
                        event.target.value,
                      );
                    }}
                    placeholder="Forward"
                  />
                </label>

                <div className="team-history-actions">
                  <IconActionButton
                    label="Delete team history entry"
                    icon="delete"
                    danger
                    onClick={() => {
                      onRemoveTeamHistoryEntry(entry.id);
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="footer-note">
        <div className="footer-actions footer-actions--compact">
          <button
            className="icon-label-button"
            type="button"
            onClick={onSaveProfile}
            disabled={isSavingProfile}
          >
            <IconGlyph name="save" />
            <span>{isSavingProfile ? 'Saving...' : 'Save profile changes'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function DesignLab() {
  const [activeView, setActiveView] = useState<DesignLabView>('family-hub');
  const [activePanel, setActivePanel] = useState<DesignLabPanel>('actions');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    DESIGN_LAB_PLAYERS[0]?.id ?? '',
  );
  const [profileDraft, setProfileDraft] = useState<DesignLabProfileState>({
    ...DESIGN_LAB_PROFILE_INITIAL,
  });
  const [editingField, setEditingField] = useState<DesignLabProfileField | null>(
    null,
  );
  const [autosaveMessage, setAutosaveMessage] = useState(
    'Preview autosave is on for single-value fields.',
  );
  const [opsDensity, setOpsDensity] = useState<DesignLabDensity>('compact');
  const [opsGroupFilter, setOpsGroupFilter] = useState<string>('all');

  const selectedPlayer =
    DESIGN_LAB_PLAYERS.find((player) => player.id === selectedPlayerId)
    ?? DESIGN_LAB_PLAYERS[0];

  const visibleRoster = DESIGN_LAB_ROSTER.filter((entry) =>
    opsGroupFilter === 'all' ? true : entry.groupName === opsGroupFilter,
  );

  const opsGroupOptions = ['all', ...new Set(DESIGN_LAB_ROSTER.map((entry) => entry.groupName))];

  function handleSelectPlayer(playerId: string, nextView?: DesignLabView): void {
    setSelectedPlayerId(playerId);
    if (nextView) setActiveView(nextView);
  }

  function handleInlineFieldChange(
    field: DesignLabProfileField,
    value: string,
  ): void {
    setProfileDraft((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  function handleInlineFieldBlur(
    field: DesignLabProfileField,
    label: string,
  ): void {
    setEditingField((currentValue) => (currentValue === field ? null : currentValue));
    setAutosaveMessage(`${label} autosaved in preview.`);
  }

  function renderInlineField(
    field: DesignLabProfileField,
    label: string,
  ) {
    const isEditing = editingField === field;
    const value = profileDraft[field];

    return (
      <div
        key={field}
        className={`design-inline-cell ${
          isEditing ? 'design-inline-cell--editing' : ''
        }`}
        role={isEditing ? undefined : 'button'}
        tabIndex={isEditing ? -1 : 0}
        onClick={() => {
          if (!isEditing) setEditingField(field);
        }}
        onKeyDown={(event) => {
          if (isEditing) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setEditingField(field);
          }
        }}
      >
        <span className="design-inline-cell__label">{label}</span>
        {isEditing ? (
          <div className="design-inline-cell__editor">
            <input
              autoFocus
              type="text"
              value={value}
              onChange={(event) => {
                handleInlineFieldChange(field, event.target.value);
              }}
              onBlur={() => {
                handleInlineFieldBlur(field, label);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }

                if (event.key === 'Escape') {
                  setEditingField(null);
                }
              }}
            />
          </div>
        ) : (
          <strong>{value || 'Not set yet'}</strong>
        )}
      </div>
    );
  }

  return (
    <article className="card design-lab-shell">
      <div className="card-header">
        <div>
          <p className="section-eyebrow">Design Lab</p>
          <h3>Premium workflow previews</h3>
          <p className="section-copy">
            Synthetic data only. Use these mockups to choose the interaction
            model we should bring into the live portal next.
          </p>
        </div>
        <span className="status-chip">Preview only</span>
      </div>

      <div className="design-lab-nav">
        {([
          [
            'family-hub',
            'Pattern A',
            'Action dock + quick-open player navigation for parents and players',
          ],
          [
            'profile-inline',
            'Pattern B',
            'Read-first profile rows with inline auto-save for simple fields',
          ],
          [
            'ops-command',
            'Pattern C',
            'Compact command center for dense tryout and staff operations',
          ],
        ] as Array<[DesignLabView, string, string]>).map(([view, label, description]) => (
          <button
            key={view}
            className={`design-lab-nav__button ${
              activeView === view ? 'design-lab-nav__button--active' : ''
            }`}
            type="button"
            onClick={() => {
              setActiveView(view);
            }}
          >
            <strong>{label}</strong>
            <span>{description}</span>
          </button>
        ))}
      </div>

      {activeView === 'family-hub' ? (
        <div className="design-canvas">
          <section className="design-hero">
            <div>
              <p className="design-hero__eyebrow">Pattern A / Family hub</p>
              <h4>Replace low-value counters with actionable summary controls</h4>
              <p>
                The summary strip becomes a compact dock. Each chip opens the
                next useful thing, and linked players become direct quick-open
                records instead of static totals.
              </p>
            </div>
            <div className="design-pattern-row">
              <span className="design-pattern-chip">Control pack: Action dock</span>
              <span className="design-pattern-chip">Control pack: Player quick-open</span>
              <span className="design-pattern-chip">Control pack: Required actions</span>
            </div>
          </section>

          <div className="design-summary-dock">
            <button
              className={`design-summary-chip ${
                activePanel === 'actions' ? 'design-summary-chip--active' : ''
              }`}
              type="button"
              onClick={() => {
                setActivePanel('actions');
              }}
            >
              <span>Required actions</span>
              <strong>{DESIGN_LAB_ACTIONS.length}</strong>
            </button>
            <button
              className={`design-summary-chip ${
                activePanel === 'players' ? 'design-summary-chip--active' : ''
              }`}
              type="button"
              onClick={() => {
                setActivePanel('players');
              }}
            >
              <span>Linked players</span>
              <strong>{DESIGN_LAB_PLAYERS.length}</strong>
            </button>
            <button
              className={`design-summary-chip ${
                activePanel === 'updates' ? 'design-summary-chip--active' : ''
              }`}
              type="button"
              onClick={() => {
                setActivePanel('updates');
              }}
            >
              <span>Recent updates</span>
              <strong>{DESIGN_LAB_UPDATES.length}</strong>
            </button>
            <div className="design-summary-chip design-summary-chip--static">
              <span>Next event</span>
              <strong>Tryout check-in</strong>
            </div>
          </div>

          <section className="design-stack">
            {activePanel === 'actions' ? (
              <div className="design-panel-list">
                {DESIGN_LAB_ACTIONS.map((action) => (
                  <article key={action.id} className="design-panel-card">
                    <div>
                      <strong>{action.title}</strong>
                      <p>{action.detail}</p>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        handleSelectPlayer(
                          action.playerId,
                          action.id === 'update-contact' ? 'profile-inline' : 'family-hub',
                        );
                      }}
                    >
                      {action.buttonLabel}
                    </button>
                  </article>
                ))}
              </div>
            ) : null}

            {activePanel === 'players' ? (
              <div className="design-panel-list">
                {DESIGN_LAB_PLAYERS.map((player) => (
                  <button
                    key={player.id}
                    className={`design-player-quick-card ${
                      selectedPlayer.id === player.id
                        ? 'design-player-quick-card--active'
                        : ''
                    }`}
                    type="button"
                    onClick={() => {
                      handleSelectPlayer(player.id);
                    }}
                  >
                    <div>
                      <strong>{player.displayName}</strong>
                      <p>{player.summary}</p>
                    </div>
                    <span className="status-chip">{player.intakeStatus}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {activePanel === 'updates' ? (
              <div className="design-panel-list">
                {DESIGN_LAB_UPDATES.map((update) => (
                  <button
                    key={update.id}
                    className="design-update-row"
                    type="button"
                    onClick={() => {
                      handleSelectPlayer(update.playerId);
                    }}
                  >
                    <div>
                      <strong>{update.title}</strong>
                      <p>{update.detail}</p>
                    </div>
                    <span>{update.timestampLabel}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="design-player-spotlight">
            <div className="design-player-spotlight__header">
              <div>
                <p className="design-spotlight__eyebrow">Selected record</p>
                <h4>{selectedPlayer.displayName}</h4>
                <p>{selectedPlayer.summary}</p>
              </div>
              <span className="status-chip">{selectedPlayer.relationshipLabel}</span>
            </div>

            <div className="design-kpi-row">
              <div className="design-kpi-card">
                <span>Current focus</span>
                <strong>{selectedPlayer.currentFocus}</strong>
              </div>
              <div className="design-kpi-card">
                <span>Tryout status</span>
                <strong>{selectedPlayer.intakeStatus}</strong>
              </div>
              <div className="design-kpi-card">
                <span>Quick jump</span>
                <div className="design-kpi-card__actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setActiveView('profile-inline');
                    }}
                  >
                    Open profile pattern
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeView === 'profile-inline' ? (
        <div className="design-canvas">
          <section className="design-hero design-hero--soft">
            <div>
              <p className="design-hero__eyebrow">Pattern B / Read-first record</p>
              <h4>Let saved data look like a polished profile first</h4>
              <p>
                Stable values stay in view mode until the user explicitly taps
                them. Multi-entry collections keep stronger CRUD controls so the
                user never loses track of history.
              </p>
            </div>
            <div className="design-pattern-row">
              <span className="design-pattern-chip">Control pack: Inline row edit</span>
              <span className="design-pattern-chip">Control pack: Auto-save on blur</span>
              <span className="design-pattern-chip">Control pack: Collection editor</span>
            </div>
          </section>

          <section className="design-profile-stack">
            <article className="design-surface-card">
              <div className="design-surface-card__header">
                <div>
                  <p className="section-eyebrow">Editable identity</p>
                  <h4>Avery player record</h4>
                  <p className="section-copy">
                    Click any saved value to edit it. Leaving the field saves
                    the latest value automatically.
                  </p>
                </div>
                <span className="status-chip">Inline autosave</span>
              </div>

              <div className="design-inline-grid">
                {renderInlineField('firstName', 'First name')}
                {renderInlineField('lastName', 'Last name')}
                {renderInlineField('contactEmail', 'Contact email')}
                {renderInlineField('phoneNumber', 'Phone number')}
                {renderInlineField('birthYear', 'Birth year')}
                {renderInlineField('primaryPosition', 'Primary position')}
                {renderInlineField('handedness', 'Handedness')}
                {renderInlineField('firstYearPlayingHockey', 'First year playing hockey')}
              </div>

              <div className="design-inline-status">
                <strong>{autosaveMessage}</strong>
                <span>Best for names, contact info, eligibility data, and other latest-value fields.</span>
              </div>
            </article>

            <article className="design-surface-card">
              <div className="design-surface-card__header">
                <div>
                  <p className="section-eyebrow">Collection editor</p>
                  <h4>Keep history visible without making it noisy</h4>
                  <p className="section-copy">
                    Multi-entry data stays list-based with explicit add, edit,
                    and delete controls. This is a stronger fit than inline
                    autosave for records like prior teams or growth history.
                  </p>
                </div>
                <div className="icon-action-row" aria-label="Collection controls">
                  <IconActionButton label="Add season entry" icon="add" />
                  <IconActionButton label="Save collection changes" icon="save" />
                </div>
              </div>

              <div className="design-metric-grid">
                <div className="design-metric-card">
                  <span>Latest height</span>
                  <strong>{profileDraft.height}</strong>
                  <p>Stored with prior measurements for future graphing</p>
                </div>
                <div className="design-metric-card">
                  <span>Latest weight</span>
                  <strong>{profileDraft.weight}</strong>
                  <p>Last recorded Apr 7, 2026</p>
                </div>
              </div>

              <div className="design-team-history-list">
                {DESIGN_LAB_TEAM_HISTORY.map((entry) => (
                  <article key={entry.id} className="design-team-history-item">
                    <div>
                      <span className="design-season-pill">{entry.seasonLabel}</span>
                      <strong>{entry.teamName}</strong>
                      <p>
                        {entry.positionPlayed} / {entry.note}
                      </p>
                    </div>
                    <div className="icon-action-row" aria-label="Entry actions">
                      <IconActionButton label="Edit season entry" icon="edit" />
                      <IconActionButton
                        label="Delete season entry"
                        icon="delete"
                        danger
                      />
                    </div>
                  </article>
                ))}
              </div>

              <details className="design-history-details">
                <summary>Show stored physical history</summary>
                <div className="stack-list">
                  <div className="stack-card">
                    <div>
                      <strong>Apr 7, 2026</strong>
                      <p>5'5" / 122 lbs</p>
                    </div>
                  </div>
                  <div className="stack-card">
                    <div>
                      <strong>Nov 12, 2025</strong>
                      <p>5'4" / 118 lbs</p>
                    </div>
                  </div>
                </div>
              </details>
            </article>
          </section>
        </div>
      ) : null}

      {activeView === 'ops-command' ? (
        <div className="design-canvas">
          <section className="design-hero design-hero--ops">
            <div>
              <p className="design-hero__eyebrow">Pattern C / Staff command center</p>
              <h4>Use density intentionally where the job is scanning and assignment</h4>
              <p>
                This shows the tryout planner as an operations screen: less card
                nesting, more row-based scanning, and a density switch for staff
                who need more roster information on screen.
              </p>
            </div>
            <div className="design-pattern-row">
              <span className="design-pattern-chip">Control pack: Density toggle</span>
              <span className="design-pattern-chip">Control pack: Compact roster table</span>
              <span className="design-pattern-chip">Control pack: Session cards</span>
            </div>
          </section>

          <section className="design-toolbar">
            <div className="design-toggle-group">
              {(['comfortable', 'compact'] as DesignLabDensity[]).map((density) => (
                <button
                  key={density}
                  className={`design-toggle-button ${
                    opsDensity === density ? 'design-toggle-button--active' : ''
                  }`}
                  type="button"
                  onClick={() => {
                    setOpsDensity(density);
                  }}
                >
                  {density === 'compact' ? 'Compact' : 'Comfortable'}
                </button>
              ))}
            </div>

            <div className="design-filter-row">
              {opsGroupOptions.map((groupName) => (
                <button
                  key={groupName}
                  className={`design-filter-button ${
                    opsGroupFilter === groupName ? 'design-filter-button--active' : ''
                  }`}
                  type="button"
                  onClick={() => {
                    setOpsGroupFilter(groupName);
                  }}
                >
                  {groupName === 'all' ? 'All groups' : groupName}
                </button>
              ))}
            </div>
          </section>

          <section className={`design-ops-shell design-ops-shell--${opsDensity}`}>
            <article className="design-surface-card">
              <div className="design-surface-card__header">
                <div>
                  <p className="section-eyebrow">Roster board</p>
                  <h4>Dense table for group, team, jersey, and session visibility</h4>
                  <p className="section-copy">
                    This replaces stacks of cards with one scan-friendly view
                    for the operational fields coaches care about most.
                  </p>
                </div>
                <span className="status-chip">{visibleRoster.length} players shown</span>
              </div>

              <div className="design-roster-table">
                <div className="design-roster-table__head">
                  <span>Player</span>
                  <span>Group</span>
                  <span>Team</span>
                  <span>Jersey</span>
                  <span>Session</span>
                  <span>Notes</span>
                </div>
                {visibleRoster.map((entry) => (
                  <div
                    key={entry.id}
                    className={`design-roster-table__row design-roster-table__row--${entry.assignmentStatus.toLowerCase()}`}
                  >
                    <div className="design-roster-primary">
                      <strong>{entry.displayName}</strong>
                      <span>{entry.assignmentStatus}</span>
                    </div>
                    <span>{entry.groupName}</span>
                    <span>{entry.teamName}</span>
                    <span>{entry.jerseyNumber || 'Open'}</span>
                    <span>{entry.sessionName}</span>
                    <span>{entry.note}</span>
                  </div>
                ))}
              </div>
            </article>

            <div className="design-session-grid">
              {[
                {
                  id: 'session-a',
                  name: 'Friday ID Skate',
                  detail: 'Blue and Orange teams loaded with baseline skating and puck execution criteria.',
                  badge: '2 teams',
                },
                {
                  id: 'session-b',
                  name: 'Saturday Pace Session',
                  detail: 'Black team plus manual overrides for cross-age looks and battle detail.',
                  badge: '1 team',
                },
              ].map((session) => (
                <article key={session.id} className="design-session-card">
                  <div className="design-session-card__header">
                    <strong>{session.name}</strong>
                    <span className="status-chip">{session.badge}</span>
                  </div>
                  <p>{session.detail}</p>
                  <div className="action-row">
                    <button className="ghost-button" type="button">
                      Open roster
                    </button>
                    <button className="ghost-button" type="button">
                      Bulk jerseys
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <div className="footer-note">
        <div className="stack-card stack-card--highlight">
          <div>
            <strong>How to use this lab</strong>
            <p>
              Tell me which pattern pieces feel premium, which feel too dense,
              and which should become the default portal shell. I can then
              rewire the live views in smaller, safer slices.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function TryoutSetupCard({
  roleLabel,
  seasons,
  draft,
  birthYearOptions,
  loaded,
  loading,
  evaluationTemplates,
  newSeasonName,
  busyAction,
  draggingPlayerId,
  onNewSeasonNameChange,
  onCreateSeason,
  onSelectSeason,
  onDeleteSeason,
  onDownloadReport,
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
  onUpdateTeamColor,
  onRemoveTeam,
  onAssignPlayerToTeam,
  onUpdatePlayerJersey,
  onAddSession,
  onUpdateSessionName,
  onUpdateSessionTemplate,
  onToggleSessionTeam,
  onRemoveSession,
  onStartEvaluation,
  onStartPlayerDrag,
}: TryoutSetupCardProps) {
  const groups = draft?.groups ?? [];
  const teams = draft?.teams ?? [];
  const sessions = draft?.sessions ?? [];
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const birthYearRangeLabel =
    birthYearOptions.length > 0
      ? `${birthYearOptions[0]} to ${
          birthYearOptions[birthYearOptions.length - 1]
        }`
      : 'No birth years configured yet.';
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
    const selectedTeam = player.teamId ? teamMap.get(player.teamId) ?? null : null;

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
          <p className="tryout-player-card__team-note">
            {selectedTeam ? (
              <>
                <span
                  className="team-color-dot"
                  style={buildTeamDotStyle(selectedTeam.jerseyColor)}
                  aria-hidden="true"
                />
                Team: {selectedTeam.name}
              </>
            ) : (
              'Not assigned to a tryout team yet'
            )}
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
                <IconLabelActionButton
                  label={
                    busyAction === `download-tryout-season-report-${draft.id}`
                      ? 'Building report...'
                      : 'Download report'
                  }
                  icon="save"
                  onClick={onDownloadReport}
                  disabled={busyAction === `download-tryout-season-report-${draft.id}`}
                />
                <IconLabelActionButton
                  label={
                    busyAction === `delete-tryout-season-${draft.id}`
                      ? 'Deleting season...'
                      : 'Delete season'
                  }
                  icon="delete"
                  onClick={onDeleteSeason}
                  disabled={busyAction === `delete-tryout-season-${draft.id}`}
                />
                <IconLabelActionButton
                  label={
                    busyAction === `save-tryout-season-${draft.id}`
                      ? 'Saving tryout...'
                      : 'Save tryout'
                  }
                  icon="save"
                  onClick={onSaveSeason}
                  disabled={busyAction === `save-tryout-season-${draft.id}`}
                />
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
              <IconLabelActionButton label="Add group" icon="add" onClick={onAddGroup} />
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
                      <IconActionButton
                        label="Remove group"
                        icon="delete"
                        danger
                        onClick={() => {
                          onRemoveGroup(group.id);
                        }}
                      />
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
                      <p className="helper-copy">
                        Club settings currently allow {birthYearRangeLabel}.
                      </p>
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
                        <IconLabelActionButton
                          label="Add team"
                          icon="add"
                          onClick={() => {
                            onAddTeam(group.id);
                          }}
                        />
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
                          const teamColor = normalizeHexColor(
                            team.jerseyColor,
                            getDefaultTryoutTeamColor(team.name, groupTeams.indexOf(team)),
                          );

                          return (
                            <div
                              key={team.id}
                              className="tryout-team-column tryout-team-column--team"
                              style={buildTryoutTeamColumnStyle(teamColor)}
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
                                <IconActionButton
                                  label="Remove team"
                                  icon="delete"
                                  danger
                                  onClick={() => {
                                    onRemoveTeam(team.id);
                                  }}
                                />
                              </div>

                              <div className="tryout-team-column__meta">
                                <div className="tryout-team-column__color-row">
                                  <label className="field tryout-team-color-field">
                                    <span>Jersey color</span>
                                    <input
                                      type="color"
                                      value={teamColor}
                                      onChange={(event) => {
                                        onUpdateTeamColor(team.id, event.target.value);
                                      }}
                                      aria-label={`Choose jersey color for ${team.name}`}
                                    />
                                  </label>
                                  <div className="tryout-team-color-presets">
                                    {TRYOUT_TEAM_COLOR_PRESETS.map((preset) => (
                                      <button
                                        key={`${team.id}-${preset.value}`}
                                        className="team-color-preset"
                                        type="button"
                                        style={buildTeamColorPresetStyle(
                                          preset.value,
                                          teamColor === preset.value,
                                        )}
                                        aria-label={`${preset.label} jersey color`}
                                        aria-pressed={teamColor === preset.value}
                                        title={preset.label}
                                        onClick={() => {
                                          onUpdateTeamColor(team.id, preset.value);
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>

                                <div className="tryout-team-column__summary">
                                  <span
                                    className="status-chip"
                                    style={buildSoftTeamChipStyle(teamColor)}
                                  >
                                    <span
                                      className="team-color-dot"
                                      style={buildTeamDotStyle(teamColor)}
                                      aria-hidden="true"
                                    />
                                    {formatTryoutTeamColorLabel(teamColor)}
                                  </span>
                                  <span
                                    className="status-chip"
                                    style={buildSoftTeamChipStyle(teamColor)}
                                  >
                                    {roster.length} player{roster.length === 1 ? '' : 's'}
                                  </span>
                                </div>
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
              <IconLabelActionButton
                label="Add session"
                icon="add"
                onClick={onAddSession}
              />
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
                      <IconActionButton
                        label="Remove session"
                        icon="delete"
                        danger
                        onClick={() => {
                          onRemoveSession(session.id);
                        }}
                      />
                    </div>

                    <div className="criterion-settings-grid">
                      <label className="field">
                        <span>Evaluation template</span>
                        <select
                          value={session.evaluationTemplateId ?? ''}
                          onChange={(event) => {
                            onUpdateSessionTemplate(
                              session.id,
                              event.target.value || null,
                            );
                          }}
                        >
                          <option value="">Select template</option>
                          {evaluationTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="tryout-session-actions">
                        <span className="status-chip">
                          {session.teamIds.length} team{session.teamIds.length === 1 ? '' : 's'}
                        </span>
                        <IconLabelActionButton
                          label="Start evaluation"
                          icon="save"
                          onClick={() => {
                            onStartEvaluation(session.id);
                          }}
                          disabled={
                            !session.evaluationTemplateId || session.teamIds.length === 0
                          }
                        />
                      </div>
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
                            <span
                              className="tryout-team-session-chip"
                              style={buildTryoutSessionTeamChipStyle(
                                team.jerseyColor,
                                session.teamIds.includes(team.id),
                              )}
                            >
                              <span
                                className="team-color-dot"
                                style={buildTeamDotStyle(team.jerseyColor)}
                                aria-hidden="true"
                              />
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

function EvaluationWorkspace({
  context,
  loading,
  feedback,
  saveIndicators,
  onExit,
  onSavePlayerRecord,
}: EvaluationWorkspaceProps) {
  const teams = context?.teams ?? [];
  const players = teams.flatMap((team) => team.players);
  const evaluatedPlayerIds = new Set(
    (context?.records ?? [])
      .filter((record) => hasEvaluationRecordContent(record.scores, record.notes))
      .map((record) => record.playerId),
  );
  const [selectedPlayerIdState, setSelectedPlayerIdState] = useState<string | null>(null);
  const selectedPlayerId = players.some((player) => player.playerId === selectedPlayerIdState)
    ? selectedPlayerIdState
    : players[0]?.playerId ?? null;

  const selectedPlayer =
    selectedPlayerId
      ? players.find((player) => player.playerId === selectedPlayerId) ?? null
      : null;
  const selectedRecord =
    context && selectedPlayer
      ? context.records.find((record) => record.playerId === selectedPlayer.playerId) ??
        buildEmptyEvaluationRecordState(context, selectedPlayer.playerId)
      : null;
  const selectedSaveIndicator =
    selectedPlayerId ? saveIndicators[selectedPlayerId] ?? null : null;

  function handleScoreChange(
    criterionId: string,
    value: EvaluationScoreValue,
  ): void {
    if (!selectedPlayer || !selectedRecord) return;

    onSavePlayerRecord(selectedPlayer.playerId, {
      scores: {
        ...selectedRecord.scores,
        [criterionId]:
          selectedRecord.scores[criterionId] === value ? null : value,
      },
      notes: selectedRecord.notes,
    });
  }

  return (
    <div className="evaluation-shell">
      {feedback?.tone === 'error' ? (
        <div className={`feedback-banner feedback-banner--${feedback.tone}`}>
          {feedback.message}
        </div>
      ) : null}

      {loading ? (
        <div className="evaluation-empty-state">
          <strong>Loading evaluation session...</strong>
          <p>Pulling the roster, player snapshots, and the assigned score sheet.</p>
        </div>
      ) : !context ? (
        <div className="evaluation-empty-state">
          <strong>Evaluation session unavailable</strong>
          <p>
            Return to tryout setup, confirm the session exists, and make sure it
            has an evaluation template assigned.
          </p>
        </div>
      ) : players.length === 0 ? (
        <div className="evaluation-empty-state">
          <strong>No players are loaded into this session</strong>
          <p>
            Attach teams with rostered players to the session before starting
            evaluation mode.
          </p>
        </div>
      ) : (
        <div className="evaluation-shell__layout">
          <aside className="evaluation-roster">
            <div className="evaluation-roster__scroll">
              {teams.map((team) => (
                <EvaluationRosterTeam
                  key={team.id}
                  team={team}
                  selectedPlayerId={selectedPlayerId}
                  evaluatedPlayerIds={evaluatedPlayerIds}
                  onSelectPlayer={(playerId) => {
                    setSelectedPlayerIdState(playerId);
                  }}
                />
              ))}
            </div>
            <div className="evaluation-roster__footer">
              <div className="evaluation-roster__meta">
                <span className="status-chip">{context.session.name}</span>
                <span className="status-chip">{context.template.name}</span>
                {selectedSaveIndicator ? (
                  <span
                    className={`status-chip ${
                      selectedSaveIndicator.state === 'error'
                        ? 'status-chip--warning'
                        : ''
                    }`}
                  >
                    {selectedSaveIndicator.message}
                  </span>
                ) : null}
              </div>
              <button className="ghost-button evaluation-exit-button" type="button" onClick={onExit}>
                Exit evaluation
              </button>
            </div>
          </aside>

          <section className="evaluation-panel">
            {selectedPlayer && selectedRecord ? (
              <>
                <EvaluationPlayerHeader
                  key={`${context.session.id}-${selectedPlayer.playerId}`}
                  player={selectedPlayer}
                  record={selectedRecord}
                />

                <div className="evaluation-criteria-list">
                  {context.template.criteria.map((criterion) => (
                    <EvaluationCriterionRow
                      key={criterion.id}
                      criterion={criterion}
                      value={selectedRecord.scores[criterion.id] ?? null}
                      onChange={(value) => {
                        handleScoreChange(criterion.id, value);
                      }}
                    />
                  ))}
                </div>

                <div className="evaluation-notes">
                  <EvaluationNotesPanel
                    key={`${context.session.id}-${selectedPlayer.playerId}`}
                    record={selectedRecord}
                    onSave={(notes) => {
                      onSavePlayerRecord(selectedPlayer.playerId, {
                        scores: selectedRecord.scores,
                        notes,
                      });
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="evaluation-empty-state evaluation-empty-state--panel">
                <strong>Select a jersey number to begin</strong>
                <p>
                  The roster stays on the left so evaluators can move between
                  players without leaving the scoring surface.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function EvaluationRosterTeam({
  team,
  selectedPlayerId,
  evaluatedPlayerIds,
  onSelectPlayer,
}: {
  team: EvaluationSessionContext['teams'][number];
  selectedPlayerId: string | null;
  evaluatedPlayerIds: Set<string>;
  onSelectPlayer: (playerId: string) => void;
}) {
  const pendingPlayers = team.players.filter(
    (player) => !evaluatedPlayerIds.has(player.playerId),
  );
  const completedPlayers = team.players.filter((player) =>
    evaluatedPlayerIds.has(player.playerId),
  );
  const teamColor = normalizeHexColor(team.jerseyColor, DEFAULT_TRYOUT_TEAM_COLOR);

  function renderPlayerButton(
    player: EvaluationSessionContext['teams'][number]['players'][number],
  ) {
    const isSelected = player.playerId === selectedPlayerId;

    return (
      <button
        key={player.playerId}
        className={`evaluation-jersey-button ${
          isSelected ? 'evaluation-jersey-button--active' : ''
        }`}
        style={buildEvaluationJerseyButtonStyle(player.jerseyColor, isSelected)}
        type="button"
        onClick={() => {
          onSelectPlayer(player.playerId);
        }}
        aria-label={`${player.displayName}, jersey ${player.jerseyNumber || 'unset'}`}
        title={player.displayName}
      >
        {player.jerseyNumber || '--'}
      </button>
    );
  }

  return (
    <section
      className="evaluation-roster__team"
      style={buildEvaluationTeamColumnStyle(teamColor)}
    >
      <div className="evaluation-roster__team-header">
        <div className="evaluation-roster__team-title">
          <span
            className="team-color-dot team-color-dot--strong"
            style={buildTeamDotStyle(teamColor)}
            aria-hidden="true"
          />
          <div>
            <strong>{team.name}</strong>
            <span>{team.groupName}</span>
          </div>
        </div>
        <span className="status-chip" style={buildSoftTeamChipStyle(teamColor)}>
          {team.players.length}
        </span>
      </div>

      {pendingPlayers.length > 0 ? (
        <div className="evaluation-roster__grid">
          {pendingPlayers.map(renderPlayerButton)}
        </div>
      ) : null}

      {completedPlayers.length > 0 ? (
        <>
          <div className="evaluation-roster__divider" aria-hidden="true" />
          <div className="evaluation-roster__grid evaluation-roster__grid--completed">
            {completedPlayers.map(renderPlayerButton)}
          </div>
        </>
      ) : null}
    </section>
  );
}

function EvaluationScoreSlider({
  value,
  onChange,
}: {
  value: EvaluationScoreValue | null;
  onChange: (value: EvaluationScoreValue) => void;
}) {
  return (
    <div className="evaluation-score-slider" role="group" aria-label="Evaluation score">
      {([1, 2, 3, 4, 5] as EvaluationScoreValue[]).map((score) => (
        <button
          key={score}
          className={`evaluation-score-slider__step ${
            value === score ? 'evaluation-score-slider__step--active' : ''
          }`}
          type="button"
          onClick={() => {
            onChange(score);
          }}
          aria-label={`Score ${score}${value === score ? ', selected' : ''}`}
        >
          <span className="evaluation-score-slider__dot" />
        </button>
      ))}
    </div>
  );
}

function EvaluationPlayerHeader({
  player,
  record,
}: {
  player: EvaluationSessionContext['teams'][number]['players'][number];
  record: EvaluationSessionContext['records'][number];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const playerItems = buildEvaluationPlayerDetailItems(player);
  const intakeItems = buildEvaluationIntakeDetailItems(player.intake);
  const headerName = getEvaluationPlayerHeading(player);

  return (
    <div className="evaluation-player-sticky">
      <button
        className={`evaluation-player-bar ${
          isOpen ? 'evaluation-player-bar--open' : ''
        }`}
        type="button"
        onClick={() => {
          setIsOpen((currentValue) => !currentValue);
        }}
        aria-expanded={isOpen}
      >
        <div className="evaluation-player-bar__identity">
          <h2>{headerName}</h2>
          <div className="evaluation-player-bar__chips">
            <span className="status-chip">{player.groupName}</span>
            <span className="status-chip" style={buildSoftTeamChipStyle(player.jerseyColor)}>
              <span
                className="team-color-dot"
                style={buildTeamDotStyle(player.jerseyColor)}
                aria-hidden="true"
              />
              {player.teamName}
            </span>
            <span className="status-chip">
              {record.notes.length} note{record.notes.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <span className="evaluation-player-bar__toggle" aria-hidden="true">
          {isOpen ? 'v' : '>'}
        </span>
      </button>

      {isOpen ? (
        <div className="evaluation-player-drawer">
          <div className="evaluation-player-drawer__section">
            <div className="evaluation-player-drawer__grid">
              {playerItems.map((item) => (
                <div
                  key={item.label}
                  className="evaluation-player-drawer__item"
                  title={item.value}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>

          {intakeItems.length > 0 ? (
            <div className="evaluation-player-drawer__section">
              <div className="evaluation-player-drawer__grid">
                {intakeItems.map((item) => (
                  <div
                    key={item.label}
                    className="evaluation-player-drawer__item"
                    title={item.value}
                  >
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EvaluationCriterionRow({
  criterion,
  value,
  onChange,
}: {
  criterion: EvaluationCriterion;
  value: EvaluationScoreValue | null;
  onChange: (value: EvaluationScoreValue) => void;
}) {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <article className="evaluation-criterion-card">
      <div className="evaluation-criterion-row">
        <button
          className={`evaluation-criterion-title ${
            guideOpen ? 'evaluation-criterion-title--open' : ''
          }`}
          type="button"
          onClick={() => {
            setGuideOpen((currentValue) => !currentValue);
          }}
          aria-expanded={guideOpen}
        >
          {criterion.title}
        </button>

        <EvaluationScoreSlider value={value} onChange={onChange} />

        <span className="status-chip">W {criterion.weight}</span>
      </div>

      {guideOpen ? (
        <div className="evaluation-criterion-guide">
          <div className="evaluation-criterion-guide__grid">
            <div>
              <span>1</span>
              <p>{criterion.score1Description}</p>
            </div>
            <div>
              <span>3</span>
              <p>{criterion.score3Description}</p>
            </div>
            <div>
              <span>5</span>
              <p>{criterion.score5Description}</p>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function EvaluationNotesPanel({
  record,
  onSave,
}: {
  record: EvaluationSessionContext['records'][number];
  onSave: (notes: EvaluationNote[]) => void;
}) {
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  function handleAddNote(): void {
    const trimmedText = newNoteText.trim();
    if (!trimmedText) return;

    const now = new Date().toISOString();
    onSave([
      ...record.notes,
      {
        id: crypto.randomUUID(),
        text: trimmedText,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    setNewNoteText('');
  }

  function handleDeleteNote(noteId: string): void {
    onSave(record.notes.filter((note) => note.id !== noteId));

    if (editingNoteId === noteId) {
      setEditingNoteId(null);
      setEditingNoteText('');
    }
  }

  function commitEditedNote(): void {
    if (!editingNoteId) return;
    const trimmedText = editingNoteText.trim();

    if (!trimmedText) {
      handleDeleteNote(editingNoteId);
      return;
    }

    onSave(
      record.notes.map((note) =>
        note.id === editingNoteId
          ? {
              ...note,
              text: trimmedText,
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
    );
    setEditingNoteId(null);
    setEditingNoteText('');
  }

  return (
    <>
      <div className="evaluation-note-entry">
        <input
          type="text"
          value={newNoteText}
          onChange={(event) => {
            setNewNoteText(event.target.value);
          }}
          placeholder="Add a quick observation for this player"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAddNote();
            }
          }}
        />
        <IconActionButton
          label="Save note"
          icon="save"
          onClick={handleAddNote}
          disabled={!newNoteText.trim()}
        />
      </div>

      <div className="evaluation-note-list">
        {record.notes.length === 0 ? (
          <div className="stack-card">
            <div>
              <strong>No notes yet</strong>
              <p>
                Quick note entry stays available here while scores save
                instantly above.
              </p>
            </div>
          </div>
        ) : (
          record.notes.map((note) => (
            <div key={note.id} className="evaluation-note-row">
              {editingNoteId === note.id ? (
                <input
                  className="evaluation-note-row__input"
                  type="text"
                  value={editingNoteText}
                  autoFocus
                  onChange={(event) => {
                    setEditingNoteText(event.target.value);
                  }}
                  onBlur={() => {
                    commitEditedNote();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitEditedNote();
                    }
                    if (event.key === 'Escape') {
                      setEditingNoteId(null);
                      setEditingNoteText('');
                    }
                  }}
                />
              ) : (
                <button
                  className="evaluation-note-row__text"
                  type="button"
                  onClick={() => {
                    setEditingNoteId(note.id);
                    setEditingNoteText(note.text);
                  }}
                >
                  {note.text}
                </button>
              )}
              <IconActionButton
                label="Delete note"
                icon="delete"
                danger
                onClick={() => {
                  handleDeleteNote(note.id);
                }}
              />
            </div>
          ))
        )}
      </div>
    </>
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
    tryoutBirthYearYoungest: organization.tryoutBirthYearYoungest,
    tryoutBirthYearOldest: organization.tryoutBirthYearOldest,
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
      evaluationTemplateId: session.evaluationTemplateId ?? null,
    })),
    playerOverrides: season.playerOverrides.map((override) => ({ ...override })),
    players: season.players.map((player) => ({
      ...player,
      eligibleGroupIds: [...player.eligibleGroupIds],
    })),
  };
}

function recalculateTryoutSeasonDraft(
  season: TryoutSeason,
  birthYearOptions: string[] = [],
): TryoutSeason {
  const allowedBirthYearSet =
    birthYearOptions.length > 0 ? new Set(birthYearOptions) : null;
  const groups = season.groups.map((group) => ({
    ...group,
    allowedBirthYears: sortTryoutBirthYears(
      allowedBirthYearSet
        ? group.allowedBirthYears.filter((birthYear) =>
            allowedBirthYearSet.has(birthYear),
          )
        : group.allowedBirthYears,
    ),
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
    evaluationTemplateId: session.evaluationTemplateId ?? null,
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
  youngestBirthYear: string,
  oldestBirthYear: string,
): string[] {
  if (!/^\d{4}$/.test(youngestBirthYear) || !/^\d{4}$/.test(oldestBirthYear)) {
    return [];
  }

  const startYear = Math.max(
    Number(youngestBirthYear),
    Number(oldestBirthYear),
  );
  const endYear = Math.min(
    Number(youngestBirthYear),
    Number(oldestBirthYear),
  );
  const years: string[] = [];

  for (let year = startYear; year >= endYear; year -= 1) {
    years.push(String(year));
  }

  return years;
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

function getDefaultTryoutTeamColor(teamName: string, index: number): string {
  const normalizedName = teamName.trim().toLowerCase();
  const matchedPreset = TRYOUT_TEAM_COLOR_PRESETS.find((preset) =>
    preset.aliases.some((alias) => normalizedName.includes(alias)),
  );

  return matchedPreset?.value ?? TRYOUT_TEAM_COLOR_PRESETS[index % TRYOUT_TEAM_COLOR_PRESETS.length].value;
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  const nextValue = (value ?? '').trim().toUpperCase();
  const normalizedFallback = fallback.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(nextValue)) return nextValue;
  if (/^#[0-9A-F]{6}$/.test(normalizedFallback)) return normalizedFallback;
  return DEFAULT_TRYOUT_TEAM_COLOR;
}

function parseHexColor(value: string): { red: number; green: number; blue: number } {
  const normalized = normalizeHexColor(value, DEFAULT_TRYOUT_TEAM_COLOR);
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function mixHexColors(primary: string, secondary: string, primaryWeight: number): string {
  const safeWeight = Math.min(1, Math.max(0, primaryWeight));
  const secondaryWeight = 1 - safeWeight;
  const primaryColor = parseHexColor(primary);
  const secondaryColor = parseHexColor(secondary);
  const channelToHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

  return `#${channelToHex(primaryColor.red * safeWeight + secondaryColor.red * secondaryWeight)}${channelToHex(primaryColor.green * safeWeight + secondaryColor.green * secondaryWeight)}${channelToHex(primaryColor.blue * safeWeight + secondaryColor.blue * secondaryWeight)}`.toUpperCase();
}

function getReadableTextColor(backgroundColor: string): string {
  const { red, green, blue } = parseHexColor(backgroundColor);
  const srgb = [red, green, blue].map((channel) => channel / 255).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = srgb[0] * 0.2126 + srgb[1] * 0.7152 + srgb[2] * 0.0722;
  return luminance >= 0.45 ? '#173428' : '#FFFFFF';
}

function formatTryoutTeamColorLabel(teamColor: string): string {
  const normalized = normalizeHexColor(teamColor, DEFAULT_TRYOUT_TEAM_COLOR);
  return (
    TRYOUT_TEAM_COLOR_PRESETS.find((preset) => preset.value === normalized)?.label ??
    normalized
  );
}

function buildTeamDotStyle(teamColor: string): CSSProperties {
  return {
    backgroundColor: normalizeHexColor(teamColor, DEFAULT_TRYOUT_TEAM_COLOR),
  };
}

function buildSoftTeamChipStyle(teamColor: string): CSSProperties {
  const normalized = normalizeHexColor(teamColor, DEFAULT_TRYOUT_TEAM_COLOR);

  return {
    backgroundColor: mixHexColors(normalized, '#FFFFFF', 0.14),
    boxShadow: `inset 0 0 0 1px ${mixHexColors(normalized, '#173428', 0.5)}`,
    color: '#173428',
  };
}

function buildTeamColorPresetStyle(teamColor: string, isSelected: boolean): CSSProperties {
  const normalized = normalizeHexColor(teamColor, DEFAULT_TRYOUT_TEAM_COLOR);

  return {
    backgroundColor: normalized,
    borderColor: mixHexColors(normalized, '#173428', isSelected ? 0.72 : 0.42),
    boxShadow: isSelected
      ? `0 0 0 3px ${mixHexColors(normalized, '#FFFFFF', 0.28)}`
      : undefined,
  };
}

function buildTryoutTeamColumnStyle(teamColor: string): CSSProperties {
  const normalized = normalizeHexColor(teamColor, DEFAULT_TRYOUT_TEAM_COLOR);

  return {
    borderColor: mixHexColors(normalized, '#173428', 0.68),
    backgroundColor: TRYOUT_TEAM_PANEL_SURFACE,
    boxShadow: `inset 0 0 0 1px ${mixHexColors(normalized, '#FFFFFF', 0.12)}`,
  };
}

function buildTryoutSessionTeamChipStyle(
  teamColor: string,
  isSelected: boolean,
): CSSProperties {
  if (!isSelected) return {};

  const normalized = normalizeHexColor(teamColor, DEFAULT_TRYOUT_TEAM_COLOR);
  return {
    backgroundColor: mixHexColors(normalized, '#FFFFFF', 0.12),
    borderColor: mixHexColors(normalized, '#173428', 0.56),
    color: '#173428',
  };
}

function buildEvaluationTeamColumnStyle(teamColor: string): CSSProperties {
  const normalized = normalizeHexColor(teamColor, DEFAULT_TRYOUT_TEAM_COLOR);

  return {
    borderColor: mixHexColors(normalized, '#173428', 0.72),
    backgroundColor: TRYOUT_TEAM_PANEL_SURFACE,
    boxShadow: `inset 0 0 0 1px ${mixHexColors(normalized, '#FFFFFF', 0.12)}`,
  };
}

function buildEvaluationJerseyButtonStyle(
  teamColor: string,
  isSelected: boolean,
): CSSProperties {
  const normalized = normalizeHexColor(teamColor, DEFAULT_TRYOUT_TEAM_COLOR);

  return {
    backgroundColor: normalized,
    color: getReadableTextColor(normalized),
    borderColor: mixHexColors(normalized, '#173428', isSelected ? 0.78 : 0.64),
    boxShadow: isSelected
      ? `0 0 0 3px ${mixHexColors(normalized, '#FFFFFF', 0.34)}, 0 10px 18px rgba(23, 52, 40, 0.12)`
      : undefined,
  };
}

function buildEmptyEvaluationRecordState(
  context: EvaluationSessionContext,
  playerId: string,
): EvaluationSessionContext['records'][number] {
  return {
    playerId,
    seasonId: context.seasonId,
    sessionId: context.session.id,
    evaluatorUserId: context.evaluator.userId,
    evaluatorName: context.evaluator.displayName,
    templateId: context.template.id,
    scores: Object.fromEntries(
      context.template.criteria.map((criterion) => [criterion.id, null]),
    ) as Record<string, EvaluationScoreValue | null>,
    notes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildOptimisticEvaluationRecord(
  context: EvaluationSessionContext,
  playerId: string,
  scores: Record<string, EvaluationScoreValue | null>,
  notes: EvaluationNote[],
  existingRecord: EvaluationSessionContext['records'][number] | null,
): EvaluationSessionContext['records'][number] | null {
  if (!hasEvaluationRecordContent(scores, notes)) {
    return null;
  }

  const baseRecord =
    existingRecord ?? buildEmptyEvaluationRecordState(context, playerId);
  const now = new Date().toISOString();

  return {
    ...baseRecord,
    scores: { ...scores },
    notes: notes.map((note) => ({ ...note })),
    updatedAt: now,
  };
}

function upsertEvaluationRecordState(
  records: EvaluationSessionContext['records'],
  playerId: string,
  nextRecord: EvaluationSessionContext['records'][number] | null,
): EvaluationSessionContext['records'] {
  const remainingRecords = records.filter((record) => record.playerId !== playerId);
  return nextRecord ? [...remainingRecords, nextRecord] : remainingRecords;
}

function hasEvaluationRecordContent(
  scores: Record<string, EvaluationScoreValue | null>,
  notes: EvaluationNote[],
): boolean {
  return Object.values(scores).some((score) => score !== null) || notes.length > 0;
}

function buildEvaluationPlayerDetailItems(
  player: EvaluationSessionContext['teams'][number]['players'][number],
): Array<{ label: string; value: string }> {
  return [
    ['Last team', player.lastTeamName || 'Not added'],
    ['Pos', player.position || 'Not added'],
    ['Ht', player.heightDisplay],
    ['Wt', player.weightDisplay],
    [
      'Years',
      player.yearsPlaying === null ? 'Not added' : String(player.yearsPlaying),
    ],
    ['Completed', player.completedBy],
    ['Birth', player.birthYear || 'Not added'],
  ]
    .filter(([, value]) => Boolean(value.trim()))
    .map(([label, value]) => ({
      label,
      value,
    }));
}

function getEvaluationPlayerHeading(
  player: EvaluationSessionContext['teams'][number]['players'][number],
): string {
  const birthYearSuffix =
    player.birthYear && player.birthYear.length >= 2
      ? ` (${player.birthYear.slice(-2)})`
      : '';
  const baseName = birthYearSuffix && player.displayName.endsWith(birthYearSuffix)
    ? player.displayName.slice(0, -birthYearSuffix.length)
    : player.displayName.replace(/\s+\(\d{2}\)$/, '');
  return `${baseName} #${player.jerseyNumber || '--'}`;
}

function buildEvaluationIntakeDetailItems(
  intake: IntakeAnswers,
): Array<{ label: string; value: string }> {
  return [
    ['Next', intake.nextSeasonOutcome],
    ['Setting', intake.developmentSetting],
    ['Role', intake.preferredRole],
    ['Style', intake.coachingStyle],
    ['Consider', intake.participationConsiderations],
    ['Insight', intake.additionalInsight],
  ]
    .filter(([, value]) => Boolean(value.trim()))
    .map(([label, value]) => ({
      label,
      value,
    }));
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

function buildFamilyActionItems(
  players: PlayerRecord[],
  receivedInvites: InviteRecord[],
): FamilyActionItem[] {
  const items: FamilyActionItem[] = [];

  if (players.length === 0) {
    items.push({
      id: 'add-first-player',
      title: 'Add your first player record',
      detail: 'Create a player record to start the intake and linked-access workflow.',
      targetSection: 'player',
      playerId: 'new',
    });
  }

  players.forEach((player) => {
    if (player.intake.status !== 'submitted') {
      items.push({
        id: `intake-${player.id}`,
        title: `Finish intake for ${getPlayerDisplayName(player.profile)}`,
        detail:
          player.intake.status === 'draft'
            ? 'This tryout intake is saved as a draft and still needs submission.'
            : 'This player still needs the intake questions completed and submitted.',
        targetSection: 'intake',
        playerId: player.id,
      });
    }

    player.sentInvites
      .filter((invite) => invite.status === 'pending')
      .forEach((invite) => {
        items.push({
          id: `invite-${invite.id}`,
          title: `Resolve linked access for ${getPlayerDisplayName(player.profile)}`,
          detail: `${ROLE_LABELS[invite.invitedRole]} invite to ${invite.invitedEmail} is still pending.`,
          targetSection: 'invites',
          playerId: player.id,
        });
      });
  });

  receivedInvites
    .filter((invite) => invite.status === 'pending')
    .forEach((invite) => {
      items.push({
        id: `received-${invite.id}`,
        title: `Respond to invite for ${invite.playerName}`,
        detail: `${ROLE_LABELS[invite.invitedRole]} access is waiting for your response.`,
        targetSection: 'invites',
        playerId: invite.playerId,
      });
    });

  return items;
}

function buildFamilyUpdateItems(
  players: PlayerRecord[],
  receivedInvites: InviteRecord[],
): FamilyUpdateItem[] {
  const items: FamilyUpdateItem[] = [];

  players.forEach((player) => {
    if (player.updatedAt) {
      items.push({
        id: `player-update-${player.id}`,
        title: `${getPlayerDisplayName(player.profile)} profile updated`,
        detail: buildPlayerListSummary(player),
        timestamp: player.updatedAt,
        targetSection: 'player',
        playerId: player.id,
      });
    }

    if (player.intake.updatedAt) {
      items.push({
        id: `intake-update-${player.id}`,
        title: `${getPlayerDisplayName(player.profile)} intake ${formatIntakeStatus(
          player.intake.status,
        ).toLowerCase()}`,
        detail:
          player.intake.status === 'submitted'
            ? 'The intake has been submitted and is ready for staff review.'
            : 'The intake is still in progress.',
        timestamp: player.intake.updatedAt,
        targetSection: 'intake',
        playerId: player.id,
      });
    }

    player.sentInvites.forEach((invite) => {
      items.push({
        id: `sent-invite-${invite.id}`,
        title: `${getPlayerDisplayName(player.profile)} linked access`,
        detail: `${ROLE_LABELS[invite.invitedRole]} invite ${formatInviteStatus(invite.status).toLowerCase()}.`,
        timestamp: invite.createdAt,
        targetSection: 'invites',
        playerId: player.id,
      });
    });
  });

  receivedInvites.forEach((invite) => {
    items.push({
      id: `received-invite-${invite.id}`,
      title: `Invite received for ${invite.playerName}`,
      detail: `${ROLE_LABELS[invite.invitedRole]} access from ${invite.invitedByLabel}.`,
      timestamp: invite.createdAt,
      targetSection: 'invites',
      playerId: invite.playerId,
    });
  });

  return items
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 4);
}

function buildNextEventLabel(organization: OrganizationOverview): string {
  return organization.tryoutWindowLabel || 'Tryout schedule';
}

function sectionLabel(section: UserWorkspaceView): string {
  if (section === 'player') return 'Player Profile';
  if (section === 'intake') return 'Tryout Intake';
  if (section === 'invites') return 'Linked Access';
  if (section === 'profile') return 'My Profile';
  if (section === 'tryouts') return 'Tryout Setup';
  if (section === 'overview') return 'Overview';
  return 'Portal';
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

