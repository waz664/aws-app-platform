export type RuntimeMode = 'demo' | 'aws';

export type UserRole = 'parent' | 'player';
export type PrimaryRole = UserRole | 'staff';

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
  createdAt: string | null;
  updatedAt: string | null;
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
