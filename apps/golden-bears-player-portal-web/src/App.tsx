import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import {
  acceptInvite,
  claimOrganizationAdmin,
  createInvite,
  createPlayer,
  declineInvite,
  loadBootstrapData,
  revokeInvite,
  saveUserRole,
  updateCurrentUserProfile,
  updatePlayer,
  updateOrganizationSettings,
} from './lib/data-client';
import { beginSignIn, beginSignOut, restoreAuthSession } from './lib/auth';
import { loadRuntimeConfig } from './lib/runtime-config';
import type {
  AppRole,
  AuthSession,
  BootstrapData,
  CompletedByOption,
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

                {bootstrap.admin.canClaimOrganizationAdmin ? (
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

      {bootstrap.admin.canClaimOrganizationAdmin ? (
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

      {activeRole === 'club-admin' || activeRole === 'platform-admin' ? (
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
      ) : familyRole ? (
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
        {activeRole === 'club-admin' || activeRole === 'platform-admin' ? (
          <section className="workspace-grid">
            <div className="workspace-main">
              <article className="card">
                <div className="card-header">
                  <div>
                    <p className="section-eyebrow">Admin Workspace</p>
                    <h2>Organization operations</h2>
                    <p className="section-copy">
                      This staff-side slice is live and persisted. Organization
                      admins can claim access, monitor intake volume, and move
                      between admin and family experiences from the same
                      account.
                    </p>
                  </div>
                  <span className="status-chip">
                    {ROLE_LABELS[activeRole]}
                  </span>
                </div>

                {organizationDraft ? (
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
              </article>
            </div>

            <div className="workspace-sidebar">
              {userProfileCard}

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
                        organizationAccess.organizationId ===
                        bootstrap.access.activeOrganizationId
                          ? 'stack-card--highlight'
                          : ''
                      }`}
                    >
                      <div>
                        <strong>{organizationAccess.name}</strong>
                        <p>
                          {organizationAccess.roles.length > 0
                            ? organizationAccess.roles
                                .map((role) => ROLE_LABELS[role])
                                .join(', ')
                            : 'No assigned roles yet'}
                        </p>
                      </div>
                    </div>
                  ))}

                  {availableRoles.map((role) => (
                    <button
                      key={role}
                      className={`role-card ${
                        role === activeRole ? 'option-card--selected' : ''
                      }`}
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
                        Organization settings are now persisted, and access data
                        carries organization membership details under the hood.
                      </p>
                    </div>
                  </div>
                  <div className="stack-card">
                    <div>
                      <strong>What this enables next</strong>
                      <p>
                        The same user pool can later support parents or staff
                        linked to multiple clubs, with an organization choice
                        step at sign-in if needed.
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>
        ) : activeRole === 'staff' ? (
          <section className="workspace-grid">
            <div className="workspace-main">
              <article className="card">
                <div className="card-header">
                  <div>
                    <p className="section-eyebrow">Staff Workspace</p>
                    <h2>Staff access is waiting on club assignment</h2>
                    <p className="section-copy">
                      This account is now registered as staff. Update the user
                      profile on the right, and once a club admin assigns coach,
                      manager, or administrator access, those workspaces will
                      appear in the account menu.
                    </p>
                  </div>
                  <span className="status-chip">Awaiting assignment</span>
                </div>

                <div className="stack-list">
                  <div className="stack-card">
                    <div>
                      <strong>What you can do now</strong>
                      <p>
                        Keep your name and contact details current so staff
                        communications can work cleanly from day one.
                      </p>
                    </div>
                  </div>
                  <div className="stack-card">
                    <div>
                      <strong>What unlocks next</strong>
                      <p>
                        Club-admin assignment will enable coach, manager, or
                        organization-admin tools without creating a new login.
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <div className="workspace-sidebar">{userProfileCard}</div>
          </section>
        ) : activeRole === 'coach' || activeRole === 'manager' ? (
          <section className="workspace-grid">
            <div className="workspace-main">
              <article className="card">
                <div className="card-header">
                  <div>
                    <p className="section-eyebrow">Staff Workspace</p>
                    <h2>{ROLE_LABELS[activeRole]} tools are not enabled yet</h2>
                    <p className="section-copy">
                      This account can hold the role, and the portal shell now
                      supports switching into it, but no coach or manager
                      workflow has been activated in this build yet.
                    </p>
                  </div>
                </div>
              </article>
            </div>

            <div className="workspace-sidebar">{userProfileCard}</div>
          </section>
        ) : (
          <section className="workspace-grid">
            <div className="workspace-main">
              {!bootstrap.user.primaryRole ? (
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

              {familyRole && draftPlayer ? (
                <>
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
                        {selectedPlayer
                          ? formatIntakeStatus(selectedPlayer.intake.status)
                          : 'Draft'}
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
                </>
              ) : null}
            </div>

            <div className="workspace-sidebar">
              {userProfileCard}

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
                          <span>
                            {buildPlayerListSummary(player)}
                          </span>
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

              {familyRole ? (
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

              {familyRole ? (
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
    return 'Staff onboarding workspace while awaiting assigned club permissions.';
  }
  if (activeRole === 'coach') return 'Coach workspace for future staff workflows.';
  if (activeRole === 'manager') return 'Manager workspace for future staff workflows.';
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

