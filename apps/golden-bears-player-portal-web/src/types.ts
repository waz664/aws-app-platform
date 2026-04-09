export type RuntimeMode = 'demo' | 'aws';

export type UserRole = 'parent' | 'player';
export type PrimaryRole = UserRole | 'staff';
export type AccountStatus = 'ACTIVE' | 'DISABLED';
export type AdminOrganizationRole = 'club-admin' | 'coach';

export type AppRole =
  | PrimaryRole
  | 'coach'
  | 'manager'
  | 'club-admin'
  | 'platform-admin';

export type AccessProfile = {
  email: string;
  roles: AppRole[];
  mode: RuntimeMode;
  activeOrganizationId: string;
  organizations: OrganizationMembershipSummary[];
  linkedOrganizations: string[];
  canManageOrganization: boolean;
  canManagePlatform: boolean;
};

export type OrganizationMembershipSummary = {
  organizationId: string;
  name: string;
  shortName: string;
  roles: AppRole[];
};

export type OrganizationOverview = {
  id: string;
  name: string;
  shortName: string;
  website: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  tryoutWindowLabel: string;
  tryoutWindowStart: string;
  tryoutWindowEnd: string;
  intakeIntro: string;
};

export type OrganizationSettingsInput = {
  name: string;
  shortName: string;
  website: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  tryoutWindowLabel: string;
  tryoutWindowStart: string;
  tryoutWindowEnd: string;
  intakeIntro: string;
};

export type UserProfile = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  phoneNumber: string;
  smsOptIn: boolean;
  primaryRole: PrimaryRole | null;
  accountStatus: AccountStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminUserDirectoryEntry = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  phoneNumber: string;
  smsOptIn: boolean;
  primaryRole: PrimaryRole | null;
  organizationRoles: AdminOrganizationRole[];
  assignedRoles: AppRole[];
  accountStatus: AccountStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminUsersResponse = {
  users: AdminUserDirectoryEntry[];
  nextCursor: string | null;
};

export type AdminUserUpdateInput = {
  primaryRole: PrimaryRole;
  organizationRoles: AdminOrganizationRole[];
  accountStatus: AccountStatus;
};

export type EvaluationCriterion = {
  id: string;
  title: string;
  weight: number;
  score1Description: string;
  score3Description: string;
  score5Description: string;
};

export type EvaluationTemplate = {
  id: string;
  name: string;
  criteria: EvaluationCriterion[];
  createdAt: string;
  updatedAt: string;
};

export type EvaluationTemplateCreateInput = {
  name?: string;
  sourceTemplateId?: string;
  useDefaultCriteria?: boolean;
};

export type EvaluationTemplateUpdateInput = {
  name: string;
  criteria: EvaluationCriterion[];
};

export type TryoutGender = 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say';

export type TryoutGroup = {
  id: string;
  name: string;
  allowedBirthYears: string[];
  allowedGenders: TryoutGender[];
};

export type TryoutTeam = {
  id: string;
  groupId: string;
  name: string;
};

export type TryoutSession = {
  id: string;
  name: string;
  teamIds: string[];
  evaluationTemplateId: string | null;
};

export type TryoutPlayerAssignmentMode = 'default' | 'manual' | 'unassigned';

export type TryoutPlayerOverride = {
  playerId: string;
  assignmentMode: TryoutPlayerAssignmentMode;
  groupId: string | null;
  teamId: string | null;
  jerseyNumber: string;
};

export type TryoutPlayerSummary = {
  playerId: string;
  firstName: string;
  lastName: string;
  birthYear: string;
  gender: string;
  displayName: string;
  eligibleGroupIds: string[];
  defaultGroupId: string | null;
  effectiveGroupId: string | null;
  teamId: string | null;
  jerseyNumber: string;
};

export type TryoutSeason = {
  id: string;
  name: string;
  groups: TryoutGroup[];
  teams: TryoutTeam[];
  sessions: TryoutSession[];
  playerOverrides: TryoutPlayerOverride[];
  players: TryoutPlayerSummary[];
  createdAt: string;
  updatedAt: string;
};

export type EvaluationScoreValue = 1 | 2 | 3 | 4 | 5;

export type EvaluationNote = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type PlayerEvaluationRecord = {
  playerId: string;
  seasonId: string;
  sessionId: string;
  evaluatorUserId: string;
  evaluatorName: string;
  templateId: string;
  scores: Record<string, EvaluationScoreValue | null>;
  notes: EvaluationNote[];
  createdAt: string;
  updatedAt: string;
};

export type EvaluationSessionPlayer = {
  playerId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jerseyNumber: string;
  groupId: string;
  groupName: string;
  teamId: string;
  teamName: string;
  birthYear: string;
  lastTeamName: string;
  position: string;
  heightDisplay: string;
  weightDisplay: string;
  yearsPlaying: number | null;
  completedBy: CompletedByOption;
  intake: IntakeAnswers;
};

export type EvaluationSessionTeam = {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  players: EvaluationSessionPlayer[];
};

export type EvaluationSessionContext = {
  seasonId: string;
  seasonName: string;
  session: TryoutSession;
  template: EvaluationTemplate;
  teams: EvaluationSessionTeam[];
  records: PlayerEvaluationRecord[];
  evaluator: {
    userId: string;
    displayName: string;
  };
};

export type TryoutSeasonCreateInput = {
  name: string;
};

export type TryoutSeasonUpdateInput = {
  name: string;
  groups: TryoutGroup[];
  teams: TryoutTeam[];
  sessions: TryoutSession[];
  playerOverrides: TryoutPlayerOverride[];
};

export type PlayerTeamHistoryEntry = {
  id: string;
  seasonLabel: string;
  teamName: string;
  positionPlayed: string;
};

export type PlayerPhysicalEntry = {
  id: string;
  recordedAt: string;
  heightFeet: string;
  heightInches: string;
  weightPounds: string;
};

export type CompletedByOption =
  | 'Player'
  | 'Parent / Guardian'
  | 'Player and Parent together';

export type PlayerProfileInput = {
  playerName: string;
  firstName: string;
  lastName: string;
  birthYear: string;
  gender: string;
  primaryPosition: string;
  handedness: string;
  firstYearPlayingHockey: string;
  currentTeam: string;
  positions: string;
  completedBy: CompletedByOption;
  bestContactEmail: string;
  phoneNumber: string;
  smsOptIn: boolean;
  teamHistory: PlayerTeamHistoryEntry[];
  latestHeightFeet: string;
  latestHeightInches: string;
  latestWeightPounds: string;
  physicalHistory: PlayerPhysicalEntry[];
};

export type IntakeAnswers = {
  nextSeasonOutcome: string;
  developmentSetting: string;
  preferredRole: string;
  coachingStyle: string;
  participationConsiderations: string;
  participationConsiderationsNote: string;
  additionalInsight: string;
};

export type IntakeStatus = 'not-started' | 'draft' | 'submitted';

export type IntakeRecord = {
  status: IntakeStatus;
  updatedAt: string | null;
  submittedAt: string | null;
  answers: IntakeAnswers;
};

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export type InviteRecord = {
  id: string;
  playerId: string;
  playerName: string;
  invitedEmail: string;
  invitedRole: UserRole;
  invitedByUserId: string;
  invitedByLabel: string;
  status: InviteStatus;
  createdAt: string;
  acceptedAt: string | null;
};

export type PlayerRecord = {
  id: string;
  relationship: UserRole;
  profile: PlayerProfileInput;
  intake: IntakeRecord;
  createdAt: string;
  updatedAt: string;
  sentInvites: InviteRecord[];
};

export type OrganizationAdminSummary = {
  totalPlayers: number;
  submittedIntakes: number;
  draftIntakes: number;
  pendingInvites: number;
};

export type OrganizationAdminContext = {
  canClaimOrganizationAdmin: boolean;
  hasOrganizationAdmin: boolean;
  summary: OrganizationAdminSummary | null;
};

export type BootstrapData = {
  organization: OrganizationOverview;
  access: AccessProfile;
  user: UserProfile;
  players: PlayerRecord[];
  receivedInvites: InviteRecord[];
  admin: OrganizationAdminContext;
};

export type DemoRuntimeConfig = {
  mode: 'demo';
  appName: string;
  appKey: string;
  region: string;
  plannedDomain?: string;
};

export type AwsRuntimeConfig = {
  mode: 'aws';
  appName: string;
  appKey: string;
  region: string;
  apiBaseUrl: string;
  plannedDomain?: string;
  auth: {
    userPoolId: string;
    userPoolClientId: string;
    domain: string;
    redirectSignIn: string;
    redirectSignOut: string;
  };
};

export type RuntimeConfig = DemoRuntimeConfig | AwsRuntimeConfig;

export type AuthSession = {
  status: 'demo' | 'guest' | 'authenticated';
  email: string | null;
  idToken: string | null;
};
