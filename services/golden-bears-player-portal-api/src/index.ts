import { randomUUID } from 'node:crypto';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import PDFDocument from 'pdfkit';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
type ReportDocument = InstanceType<typeof PDFDocument>;

const ORGANIZATION_ID = 'nc-golden-bears';
const APP_KEY = process.env.APP_KEY ?? 'golden-bears-player-portal';
const APP_DATA_TABLE_NAME = process.env.APP_DATA_TABLE_NAME ?? '';
const APP_ACCESS_TABLE_NAME = process.env.APP_ACCESS_TABLE_NAME ?? '';
const BOOTSTRAP_ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase();

const defaultOrganization = {
  id: ORGANIZATION_ID,
  name: 'North Carolina Golden Bears',
  shortName: 'NC Golden Bears',
  website: 'https://www.ncgoldenbears.com',
  logoUrl:
    'https://crossbar.s3.amazonaws.com/organizations/405/uploads/bab3717b-3442-4868-86c1-30477aa79791.png?versionId=bx8Qi4fv9_5fzSrFRlOTPPoRMXnlQX1v',
  primaryColor: '#184d3b',
  secondaryColor: '#b8952f',
  tryoutWindowLabel: 'May 1-3, 2026',
  tryoutWindowStart: '2026-05-01',
  tryoutWindowEnd: '2026-05-03',
  tryoutBirthYearYoungest: '2017',
  tryoutBirthYearOldest: '2008',
  intakeIntro:
    'Please complete the brief form below. Responses are intended to help staff understand what type of environment may best accelerate the player\'s growth, along with coaching and learning preferences and any practical considerations ahead of tryouts. There are no "right" answers, and responses do not determine placement. This is not a scored part of tryouts and does not replace on-ice evaluation. The goal is simply better information in service of better development.',
} as const;

const TRYOUT_TEAM_COLOR_PRESETS = [
  { value: '#1F3D7A', aliases: ['navy'] },
  { value: '#2D6CDF', aliases: ['blue'] },
  { value: '#C63B34', aliases: ['red'] },
  { value: '#E67E22', aliases: ['orange'] },
  { value: '#D6A129', aliases: ['gold', 'yellow'] },
  { value: '#2E8B57', aliases: ['green'] },
  { value: '#1F2328', aliases: ['black'] },
  { value: '#F6F7F8', aliases: ['white'] },
  { value: '#8A949F', aliases: ['gray', 'grey', 'silver'] },
  { value: '#7059A6', aliases: ['purple'] },
] as const;

const DEFAULT_TRYOUT_TEAM_COLOR = TRYOUT_TEAM_COLOR_PRESETS[0].value;

type UserRole = 'parent' | 'player';
type PrimaryRole = UserRole | 'staff';
type AppRole = PrimaryRole | 'coach' | 'manager' | 'club-admin' | 'platform-admin';
type AccountStatus = 'ACTIVE' | 'DISABLED';
type IntakeStatus = 'not-started' | 'draft' | 'submitted';
type InviteStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

type OrganizationOverview = {
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
  tryoutBirthYearYoungest: string;
  tryoutBirthYearOldest: string;
  intakeIntro: string;
};

type OrganizationItem = {
  pk: string;
  sk: 'PROFILE';
  entityType: 'Organization';
  organizationId: string;
  name: string;
  shortName: string;
  website: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  tryoutWindowLabel: string;
  tryoutWindowStart: string;
  tryoutWindowEnd: string;
  tryoutBirthYearYoungest: string;
  tryoutBirthYearOldest: string;
  intakeIntro: string;
  createdAt: string;
  updatedAt: string;
  updatedByUserId: string;
};

type EvaluationCriterion = {
  id: string;
  title: string;
  weight: number;
  score1Description: string;
  score3Description: string;
  score5Description: string;
};

type EvaluationTemplateItem = {
  pk: string;
  sk: string;
  entityType: 'EvaluationTemplate';
  organizationId: string;
  templateId: string;
  name: string;
  criteria: EvaluationCriterion[];
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
};

type TryoutGender = 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say';

type TryoutGroup = {
  id: string;
  name: string;
  allowedBirthYears: string[];
  allowedGenders: TryoutGender[];
};

type TryoutTeam = {
  id: string;
  groupId: string;
  name: string;
  jerseyColor: string;
};

type TryoutSession = {
  id: string;
  name: string;
  teamIds: string[];
  evaluationTemplateId: string | null;
};

type TryoutPlayerAssignmentMode = 'default' | 'manual' | 'unassigned';

type TryoutPlayerOverride = {
  playerId: string;
  assignmentMode: TryoutPlayerAssignmentMode;
  groupId: string | null;
  teamId: string | null;
  jerseyNumber: string;
};

type TryoutSeasonItem = {
  pk: string;
  sk: string;
  entityType: 'TryoutSeason';
  organizationId: string;
  seasonId: string;
  name: string;
  groups: TryoutGroup[];
  teams: TryoutTeam[];
  sessions: TryoutSession[];
  playerOverrides: TryoutPlayerOverride[];
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
};

type EvaluationScoreValue = 1 | 2 | 3 | 4 | 5;

type EvaluationNote = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

type EvaluationRecordItem = {
  pk: string;
  sk: string;
  entityType: 'PlayerEvaluation';
  organizationId: string;
  seasonId: string;
  sessionId: string;
  playerId: string;
  evaluatorUserId: string;
  evaluatorName: string;
  templateId: string;
  scores: Record<string, EvaluationScoreValue | null>;
  notes: EvaluationNote[];
  createdAt: string;
  updatedAt: string;
  gsi1pk: string;
  gsi1sk: string;
};

type PlayerProfileInput = {
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
  completedBy: 'Player' | 'Parent / Guardian' | 'Player and Parent together';
  bestContactEmail: string;
  phoneNumber: string;
  smsOptIn: boolean;
  teamHistory: PlayerTeamHistoryEntry[];
  latestHeightFeet: string;
  latestHeightInches: string;
  latestWeightPounds: string;
  physicalHistory: PlayerPhysicalEntry[];
};

type PlayerTeamHistoryEntry = {
  id: string;
  seasonLabel: string;
  teamName: string;
  positionPlayed: string;
};

type PlayerPhysicalEntry = {
  id: string;
  recordedAt: string;
  heightFeet: string;
  heightInches: string;
  weightPounds: string;
};

type IntakeAnswers = {
  nextSeasonOutcome: string;
  developmentSetting: string;
  preferredRole: string;
  coachingStyle: string;
  participationConsiderations: string;
  participationConsiderationsNote: string;
  additionalInsight: string;
};

type IntakeRecord = {
  status: IntakeStatus;
  updatedAt: string | null;
  submittedAt: string | null;
  answers: IntakeAnswers;
};

type UserProfileItem = {
  pk: string;
  sk: 'PROFILE';
  entityType: 'UserProfile';
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  contactEmail?: string;
  phoneNumber?: string;
  smsOptIn?: boolean;
  primaryRole: PrimaryRole | null;
  accountStatus?: AccountStatus;
  disabledAt?: string | null;
  disabledByUserId?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type UserPlayerLinkItem = {
  pk: string;
  sk: string;
  entityType: 'UserPlayerLink';
  userId: string;
  playerId: string;
  relationship: UserRole;
  playerName: string;
  gsi1pk: string;
  gsi1sk: string;
};

type PlayerItem = {
  pk: string;
  sk: 'PROFILE';
  entityType: 'Player';
  playerId: string;
  organizationId: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  profile: PlayerProfileInput;
  intake: IntakeRecord;
};

type InviteItem = {
  pk: string;
  sk: 'PROFILE';
  entityType: 'Invite';
  inviteId: string;
  organizationId: string;
  playerId: string;
  playerName: string;
  invitedEmail: string;
  invitedEmailLower: string;
  invitedRole: UserRole;
  invitedByUserId: string;
  invitedByLabel: string;
  status: InviteStatus;
  createdAt: string;
  acceptedAt: string | null;
  gsi1pk: string;
  gsi1sk: string;
  gsi2pk: string;
  gsi2sk: string;
};

type AppAccessItem = {
  userId: string;
  appKey: string;
  roles: AppRole[];
  organizationMemberships?: {
    organizationId: string;
    roles: AppRole[];
  }[];
  status: AccountStatus;
  grantedAt: string;
  grantedBy: string;
};

type ResolvedAccess = {
  currentRoles: AppRole[];
  organizationMemberships: {
    organizationId: string;
    roles: AppRole[];
  }[];
};

type SerializedInvite = {
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

type SerializedPlayer = {
  id: string;
  relationship: UserRole;
  profile: PlayerProfileInput;
  intake: IntakeRecord;
  createdAt: string;
  updatedAt: string;
  sentInvites: SerializedInvite[];
};

type OrganizationAdminSummary = {
  totalPlayers: number;
  submittedIntakes: number;
  draftIntakes: number;
  pendingInvites: number;
};

type OrganizationSettingsInput = {
  name?: string;
  shortName?: string;
  website?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  tryoutWindowLabel?: string;
  tryoutWindowStart?: string;
  tryoutWindowEnd?: string;
  tryoutBirthYearYoungest?: string;
  tryoutBirthYearOldest?: string;
  intakeIntro?: string;
};

type EvaluationTemplateCreateInput = {
  name?: string;
  sourceTemplateId?: string;
  useDefaultCriteria?: boolean;
};

type EvaluationTemplateUpdateInput = {
  name?: string;
  criteria?: EvaluationCriterion[];
};

type TryoutSeasonCreateInput = {
  name?: string;
};

type TryoutSeasonUpdateInput = {
  name?: string;
  groups?: TryoutGroup[];
  teams?: TryoutTeam[];
  sessions?: TryoutSession[];
  playerOverrides?: TryoutPlayerOverride[];
};

type EvaluationRecordUpdateInput = {
  scores?: Record<string, unknown>;
  notes?: unknown;
};

type UserProfileUpdateInput = {
  primaryRole?: PrimaryRole | null;
  firstName?: string;
  lastName?: string;
  contactEmail?: string;
  phoneNumber?: string;
  smsOptIn?: boolean;
  accountStatus?: AccountStatus;
  disabledAt?: string | null;
  disabledByUserId?: string | null;
};

type AdminRoleUpdateInput = {
  primaryRole: PrimaryRole;
  organizationRoles: Array<'club-admin' | 'coach'>;
  accountStatus: AccountStatus;
};

type AdminUserDirectoryEntry = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  phoneNumber: string;
  smsOptIn: boolean;
  primaryRole: PrimaryRole | null;
  organizationRoles: Array<'club-admin' | 'coach'>;
  assignedRoles: AppRole[];
  accountStatus: AccountStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

type AdminUsersResponse = {
  users: AdminUserDirectoryEntry[];
  nextCursor: string | null;
};

type SerializedEvaluationTemplate = {
  id: string;
  name: string;
  criteria: EvaluationCriterion[];
  createdAt: string;
  updatedAt: string;
};

type SerializedTryoutPlayerSummary = {
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

type SerializedEvaluationNote = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

type SerializedPlayerEvaluationRecord = {
  playerId: string;
  seasonId: string;
  sessionId: string;
  evaluatorUserId: string;
  evaluatorName: string;
  templateId: string;
  scores: Record<string, EvaluationScoreValue | null>;
  notes: SerializedEvaluationNote[];
  createdAt: string;
  updatedAt: string;
};

type SerializedEvaluationSessionPlayer = {
  playerId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jerseyNumber: string;
  groupId: string;
  groupName: string;
  teamId: string;
  teamName: string;
  jerseyColor: string;
  birthYear: string;
  lastTeamName: string;
  position: string;
  heightDisplay: string;
  weightDisplay: string;
  yearsPlaying: number | null;
  completedBy: PlayerProfileInput['completedBy'];
  intake: IntakeAnswers;
};

type SerializedEvaluationSessionTeam = {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  jerseyColor: string;
  players: SerializedEvaluationSessionPlayer[];
};

type SerializedEvaluationSessionContext = {
  seasonId: string;
  seasonName: string;
  session: TryoutSession;
  template: SerializedEvaluationTemplate;
  teams: SerializedEvaluationSessionTeam[];
  records: SerializedPlayerEvaluationRecord[];
  evaluator: {
    userId: string;
    displayName: string;
  };
};

type SerializedTryoutSeason = {
  id: string;
  name: string;
  groups: TryoutGroup[];
  teams: TryoutTeam[];
  sessions: TryoutSession[];
  playerOverrides: TryoutPlayerOverride[];
  players: SerializedTryoutPlayerSummary[];
  createdAt: string;
  updatedAt: string;
};

type TryoutSeasonReportSession = {
  session: TryoutSession;
  template: EvaluationTemplateItem | null;
  records: EvaluationRecordItem[];
  teamNames: string[];
};

type TryoutSeasonReportPlayer = {
  summary: SerializedTryoutPlayerSummary;
  player: PlayerItem;
  groupName: string;
  teamName: string;
  sessionEntries: TryoutSeasonReportSession[];
};

type TryoutSeasonReportSessionSummary = {
  session: TryoutSession;
  template: EvaluationTemplateItem | null;
  rosterCount: number;
  evaluatedPlayerCount: number;
  evaluationCount: number;
  evaluatorCount: number;
  teamNames: string[];
};

type TryoutSeasonReportData = {
  organization: OrganizationOverview;
  season: SerializedTryoutSeason;
  players: TryoutSeasonReportPlayer[];
  sessionSummaries: TryoutSeasonReportSessionSummary[];
  totalEvaluationCount: number;
};

type BootstrapResponse = {
  organization: OrganizationOverview;
  access: {
    email: string;
    roles: AppRole[];
    mode: 'aws';
    activeOrganizationId: string;
    organizations: {
      organizationId: string;
      name: string;
      shortName: string;
      roles: AppRole[];
    }[];
    linkedOrganizations: string[];
    canManageOrganization: boolean;
    canManagePlatform: boolean;
  };
  user: {
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
  players: SerializedPlayer[];
  receivedInvites: SerializedInvite[];
  admin: {
    canClaimOrganizationAdmin: boolean;
    hasOrganizationAdmin: boolean;
    summary: OrganizationAdminSummary | null;
  };
};

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method;
  const path = event.rawPath || '/';

  if (method === 'GET' && path === '/health') {
    return json(200, { status: 'ok', service: 'golden-bears-player-portal-api', timestamp: new Date().toISOString() });
  }

  const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
  const userId = claim(claims.sub);
  const email = claim(claims.email) || claim(claims['cognito:username']);
  if (!userId || !email) return json(401, { message: 'Authentication is required.' });

  try {
    if (method === 'GET' && path === '/bootstrap') return json(200, await buildBootstrapResponse(userId, email));
    await assertUserIsActive(userId);
    if (method === 'PUT' && path === '/profile') return json(200, await updateProfile(userId, email, event.body));
    if (method === 'PUT' && path === '/organization') return json(200, await updateOrganizationResponse(userId, email, event.body));
    if (method === 'POST' && path === '/access/claim-admin') return json(200, await claimAdminResponse(userId, email));
    if (method === 'GET' && path === '/admin/users') {
      return json(200, await listAdminUsersResponse(userId, event.queryStringParameters ?? {}));
    }
    if (method === 'PUT' && /^\/admin\/users\/[^/]+$/.test(path)) {
      return json(
        200,
        await updateAdminUserResponse(
          userId,
          email,
          decodeURIComponent(path.split('/')[3]),
          event.body,
        ),
      );
    }
    if (method === 'GET' && path === '/admin/evaluation-templates') {
      return json(200, await listEvaluationTemplatesResponse(userId));
    }
    if (method === 'POST' && path === '/admin/evaluation-templates') {
      return json(200, await createEvaluationTemplateResponse(userId, event.body));
    }
    if (method === 'PUT' && /^\/admin\/evaluation-templates\/[^/]+$/.test(path)) {
      return json(
        200,
        await updateEvaluationTemplateResponse(
          userId,
          decodeURIComponent(path.split('/')[3]),
          event.body,
        ),
      );
    }
    if (method === 'DELETE' && /^\/admin\/evaluation-templates\/[^/]+$/.test(path)) {
      return json(
        200,
        await deleteEvaluationTemplateResponse(
          userId,
          decodeURIComponent(path.split('/')[3]),
        ),
      );
    }
    if (method === 'GET' && path === '/tryout-seasons') {
      return json(200, await listTryoutSeasonsResponse(userId));
    }
    if (method === 'POST' && path === '/tryout-seasons') {
      return json(200, await createTryoutSeasonResponse(userId, event.body));
    }
    if (method === 'PUT' && /^\/tryout-seasons\/[^/]+$/.test(path)) {
      return json(
        200,
        await updateTryoutSeasonResponse(
          userId,
          decodeURIComponent(path.split('/')[2]),
          event.body,
        ),
      );
    }
    if (method === 'DELETE' && /^\/tryout-seasons\/[^/]+$/.test(path)) {
      return json(
        200,
        await deleteTryoutSeasonResponse(
          userId,
          decodeURIComponent(path.split('/')[2]),
        ),
      );
    }
    if (method === 'GET' && /^\/tryout-seasons\/[^/]+\/report$/.test(path)) {
      return await getTryoutSeasonReportResponse(
        userId,
        decodeURIComponent(path.split('/')[2]),
      );
    }
    if (
      method === 'GET' &&
      /^\/tryout-seasons\/[^/]+\/sessions\/[^/]+\/evaluation$/.test(path)
    ) {
      return json(
        200,
        await getEvaluationSessionContextResponse(
          userId,
          decodeURIComponent(path.split('/')[2]),
          decodeURIComponent(path.split('/')[4]),
        ),
      );
    }
    if (
      method === 'PUT' &&
      /^\/tryout-seasons\/[^/]+\/sessions\/[^/]+\/players\/[^/]+\/evaluation$/.test(path)
    ) {
      return json(
        200,
        await updatePlayerEvaluationRecordResponse(
          userId,
          decodeURIComponent(path.split('/')[2]),
          decodeURIComponent(path.split('/')[4]),
          decodeURIComponent(path.split('/')[6]),
          event.body,
        ),
      );
    }
    if (method === 'POST' && path === '/players') return json(200, await createPlayerResponse(userId, email, event.body));
    if (method === 'PATCH' && /^\/players\/[^/]+$/.test(path)) return json(200, await updatePlayerResponse(userId, email, decodeURIComponent(path.split('/')[2]), event.body));
    if (method === 'POST' && /^\/players\/[^/]+\/invites$/.test(path)) return json(200, await createInviteResponse(userId, email, decodeURIComponent(path.split('/')[2]), event.body));
    if (method === 'POST' && /^\/invites\/[^/]+\/accept$/.test(path)) return json(200, await acceptInviteResponse(userId, email, decodeURIComponent(path.split('/')[2])));
    if (method === 'POST' && /^\/invites\/[^/]+\/decline$/.test(path)) return json(200, await declineInviteResponse(userId, email, decodeURIComponent(path.split('/')[2])));
    if (method === 'POST' && /^\/invites\/[^/]+\/revoke$/.test(path)) return json(200, await revokeInviteResponse(userId, email, decodeURIComponent(path.split('/')[2])));
  } catch (error) {
    return handleError(error);
  }

  return json(404, { message: `No route defined for ${method} ${path}.` });
}

async function buildBootstrapResponse(userId: string, email: string): Promise<BootstrapResponse> {
  const [accessItem, userProfile, userLinks, receivedInvites, organization] = await Promise.all([
    getAccessItem(userId),
    ensureUserProfile(userId, email),
    listUserPlayerLinks(userId),
    listReceivedInvites(email),
    getOrganizationOverview(),
  ]);
  const resolvedAccess = normalizeAccessItem(accessItem ?? undefined);
  const admin = await buildOrganizationAdminContext(email, resolvedAccess.currentRoles);
  const playerMap = await getPlayers(userLinks.map((link) => link.playerId));
  const players = await Promise.all(
    userLinks.map(async (link) => {
      const player = playerMap.get(link.playerId);
      if (!player) return null;
      return serializePlayer(link, player, await listPlayerInvites(link.playerId));
    }),
  );
  const distinctRoles = [...new Set(resolvedAccess.currentRoles)];
  const organizations =
    resolvedAccess.organizationMemberships.length > 0
      ? resolvedAccess.organizationMemberships.map((membership) => ({
          organizationId: membership.organizationId,
          name: membership.organizationId === organization.id ? organization.name : membership.organizationId,
          shortName: membership.organizationId === organization.id ? organization.shortName : membership.organizationId,
          roles: membership.roles,
        }))
      : [
          {
            organizationId: organization.id,
            name: organization.name,
            shortName: organization.shortName,
            roles: distinctRoles,
          },
        ];

  return {
    organization,
    access: {
      email,
      roles: distinctRoles,
      mode: 'aws',
      activeOrganizationId: organization.id,
      organizations,
      linkedOrganizations: [organization.name],
      canManageOrganization: distinctRoles.includes('club-admin') || distinctRoles.includes('platform-admin'),
      canManagePlatform: distinctRoles.includes('platform-admin'),
    },
    user: {
      userId,
      email: userProfile.email || email,
      firstName: userProfile.firstName ?? '',
      lastName: userProfile.lastName ?? '',
      contactEmail: userProfile.contactEmail ?? '',
      phoneNumber: userProfile.phoneNumber ?? '',
      smsOptIn: userProfile.smsOptIn ?? false,
      primaryRole: userProfile.primaryRole ?? null,
      accountStatus: userProfile.accountStatus ?? accessItem?.status ?? 'ACTIVE',
      createdAt: userProfile.createdAt ?? null,
      updatedAt: userProfile.updatedAt ?? null,
    },
    players: players.filter((player): player is SerializedPlayer => Boolean(player)),
    receivedInvites: receivedInvites.map(serializeInvite),
    admin,
  };
}

async function updateProfile(userId: string, email: string, body: string | undefined): Promise<BootstrapResponse> {
  const payload = parseJsonBody<{
    role?: PrimaryRole;
    firstName?: string;
    lastName?: string;
    contactEmail?: string;
    phoneNumber?: string;
    smsOptIn?: boolean;
  }>(body);

  if (
    payload.role &&
    payload.role !== 'parent' &&
    payload.role !== 'player' &&
    payload.role !== 'staff'
  ) {
    throw badRequest('Role must be parent, player, or staff.');
  }

  await saveUserProfile(userId, email, {
    primaryRole: payload.role,
    firstName: payload.firstName,
    lastName: payload.lastName,
    contactEmail: payload.contactEmail,
    phoneNumber: payload.phoneNumber,
    smsOptIn: payload.smsOptIn,
  });

  const updatedProfile = await getUserProfile(userId);
  if (payload.role === 'parent' || payload.role === 'player') {
    await ensureAppAccessRole(userId, payload.role);
  }

  if (
    updatedProfile?.primaryRole === 'player' &&
    (
      payload.firstName !== undefined ||
      payload.lastName !== undefined ||
      payload.contactEmail !== undefined ||
      payload.phoneNumber !== undefined ||
      payload.smsOptIn !== undefined
    )
  ) {
    await syncSelfPlayerProfileFromUserProfile(userId, updatedProfile);
  }

  return buildBootstrapResponse(userId, email);
}

async function updateOrganizationResponse(userId: string, email: string, body: string | undefined): Promise<BootstrapResponse> {
  const resolvedAccess = await resolveAccess(userId);
  if (!resolvedAccess.currentRoles.includes('club-admin') && !resolvedAccess.currentRoles.includes('platform-admin')) {
    throw forbidden('Only organization admins can update organization settings.');
  }

  const payload = parseJsonBody<OrganizationSettingsInput>(body);
  await saveOrganizationSettings(userId, payload);
  return buildBootstrapResponse(userId, email);
}

async function listAdminUsersResponse(
  userId: string,
  query: Record<string, string | undefined>,
): Promise<AdminUsersResponse> {
  await assertCanManageOrganization(userId);

  const pageSize = clampPageSize(Number(query.pageSize ?? '12'));
  const offset = decodeCursor(query.cursor);
  const searchQuery = (query.query ?? '').trim().toLowerCase();
  const primaryRole = normalizePrimaryRoleFilter(query.primaryRole);
  const accountStatus = normalizeAccountStatusFilter(query.accountStatus);
  const assignedRole = normalizeAssignedRoleFilter(query.assignedRole);
  const profileItems = await scanAll<UserProfileItem>('UserProfile');
  const accessMap = await getAccessMap(profileItems.map((profile) => profile.userId));
  const users = profileItems
    .map((profile) => serializeAdminUser(profile, accessMap.get(profile.userId)))
    .filter((entry) =>
      matchesAdminUserFilters(entry, {
        searchQuery,
        primaryRole,
        accountStatus,
        assignedRole,
      }),
    )
    .sort(compareAdminUsers);
  const safeOffset = Math.max(0, Math.min(offset, users.length));

  return {
    users: users.slice(safeOffset, safeOffset + pageSize),
    nextCursor:
      safeOffset + pageSize < users.length
        ? encodeCursor(safeOffset + pageSize)
        : null,
  };
}

async function updateAdminUserResponse(
  actorUserId: string,
  actorEmail: string,
  targetUserId: string,
  body: string | undefined,
): Promise<AdminUserDirectoryEntry> {
  await assertCanManageOrganization(actorUserId);
  const actorAccess = await resolveAccess(actorUserId);

  const payload = parseJsonBody<AdminRoleUpdateInput>(body);
  const nextPrimaryRole = payload.primaryRole;
  if (nextPrimaryRole !== 'parent' && nextPrimaryRole !== 'player' && nextPrimaryRole !== 'staff') {
    throw badRequest('Primary role must be parent, player, or staff.');
  }

  const nextOrganizationRoles = normalizeAdminOrganizationRoles(payload.organizationRoles);
  const nextAccountStatus = normalizeAccountStatus(payload.accountStatus);
  const [existingProfile, existingAccess] = await Promise.all([
    getUserProfile(targetUserId),
    getAccessItem(targetUserId),
  ]);
  if (!existingProfile) throw notFound('User profile not found.');
  if (
    extractStoredCurrentRoles(existingAccess ?? undefined).includes('platform-admin') &&
    !actorAccess.currentRoles.includes('platform-admin')
  ) {
    throw forbidden('Only platform admins can manage platform-admin accounts.');
  }
  await reconcileUserLinksForPrimaryRole(targetUserId, nextPrimaryRole);
  const existingAssignedRoles = getAssignedRolesForDirectory(
    existingProfile,
    existingAccess ?? undefined,
  );
  const nextAssignedRoles = getManagedAccessRoles(
    existingAccess ?? undefined,
    nextPrimaryRole,
    nextOrganizationRoles,
  );
  await ensureOrganizationAdminCoverage(
    targetUserId,
    existingProfile.accountStatus ?? existingAccess?.status ?? 'ACTIVE',
    existingAssignedRoles,
    nextAssignedRoles,
    nextAccountStatus,
  );
  const disabledAt =
    nextAccountStatus === 'DISABLED'
      ? existingProfile.disabledAt ?? new Date().toISOString()
      : null;
  const disabledByUserId =
    nextAccountStatus === 'DISABLED'
      ? existingProfile.disabledByUserId ?? actorUserId
      : null;

  await saveUserProfile(targetUserId, existingProfile.email, {
    primaryRole: nextPrimaryRole,
    accountStatus: nextAccountStatus,
    disabledAt,
    disabledByUserId,
  });

  await saveManagedAccessRoles(
    targetUserId,
    actorEmail,
    nextPrimaryRole,
    nextOrganizationRoles,
    nextAccountStatus,
  );

  const [updatedProfile, updatedAccess] = await Promise.all([
    getUserProfile(targetUserId),
    getAccessItem(targetUserId),
  ]);
  if (!updatedProfile) throw notFound('Updated user profile not found.');
  return serializeAdminUser(updatedProfile, updatedAccess);
}

async function listEvaluationTemplatesResponse(
  userId: string,
): Promise<SerializedEvaluationTemplate[]> {
  await assertCanManageTryouts(userId);
  const templates = await listEvaluationTemplateItems();
  return templates.map(serializeEvaluationTemplate);
}

async function createEvaluationTemplateResponse(
  userId: string,
  body: string | undefined,
): Promise<SerializedEvaluationTemplate> {
  await assertCanManageOrganization(userId);
  const payload = parseJsonBody<EvaluationTemplateCreateInput>(body);

  if (payload.useDefaultCriteria && payload.sourceTemplateId) {
    throw badRequest('Choose either default criteria or a source template copy, not both.');
  }

  let criteria: EvaluationCriterion[];
  let fallbackName: string;

  if (payload.sourceTemplateId) {
    const sourceTemplate = await getEvaluationTemplateItem(payload.sourceTemplateId);
    if (!sourceTemplate) throw notFound('Source evaluation template not found.');
    criteria = sourceTemplate.criteria.map((criterion) => ({
      ...criterion,
      id: randomUUID(),
    }));
    fallbackName = `${sourceTemplate.name} Copy`;
  } else if (payload.useDefaultCriteria) {
    criteria = buildDefaultEvaluationCriteria();
    fallbackName = 'Core tryout evaluation template';
  } else {
    criteria = [buildBlankEvaluationCriterion()];
    fallbackName = 'New evaluation template';
  }

  const now = new Date().toISOString();
  const templateId = randomUUID();
  const templateItem: EvaluationTemplateItem = {
    pk: organizationKey(ORGANIZATION_ID),
    sk: evaluationTemplateKey(templateId),
    entityType: 'EvaluationTemplate',
    organizationId: ORGANIZATION_ID,
    templateId,
    name: sanitizeRequiredText(payload.name, fallbackName, 'Template name'),
    criteria,
    createdAt: now,
    updatedAt: now,
    createdByUserId: userId,
    updatedByUserId: userId,
  };

  await saveEvaluationTemplateItem(templateItem);
  return serializeEvaluationTemplate(templateItem);
}

async function updateEvaluationTemplateResponse(
  userId: string,
  templateId: string,
  body: string | undefined,
): Promise<SerializedEvaluationTemplate> {
  await assertCanManageOrganization(userId);
  const existingTemplate = await getEvaluationTemplateItem(templateId);
  if (!existingTemplate) throw notFound('Evaluation template not found.');

  const payload = parseJsonBody<EvaluationTemplateUpdateInput>(body);
  const updatedTemplate: EvaluationTemplateItem = {
    ...existingTemplate,
    name: sanitizeRequiredText(payload.name, existingTemplate.name, 'Template name'),
    criteria: sanitizeEvaluationCriteria(payload.criteria, existingTemplate.criteria),
    updatedAt: new Date().toISOString(),
    updatedByUserId: userId,
  };

  await saveEvaluationTemplateItem(updatedTemplate);
  return serializeEvaluationTemplate(updatedTemplate);
}

async function deleteEvaluationTemplateResponse(
  userId: string,
  templateId: string,
): Promise<{ deletedTemplateId: string }> {
  await assertCanManageOrganization(userId);
  const existingTemplate = await getEvaluationTemplateItem(templateId);
  if (!existingTemplate) throw notFound('Evaluation template not found.');
  const tryoutSeasons = await listTryoutSeasonItems();
  const linkedSession = tryoutSeasons
    .flatMap((season) =>
      sanitizeTryoutSessions(
        season.sessions,
        sanitizeTryoutTeams(season.teams, sanitizeTryoutGroups(season.groups)),
      ).map((session) => ({
        seasonName: season.name,
        sessionName: session.name,
        evaluationTemplateId: session.evaluationTemplateId,
      })),
    )
    .find((session) => session.evaluationTemplateId === templateId);
  if (linkedSession) {
    throw conflict(
      `This template is currently assigned to ${linkedSession.sessionName} in ${linkedSession.seasonName}. Remove it from that session before deleting the template.`,
    );
  }

  await dynamo.send(
    new DeleteCommand({
      TableName: APP_DATA_TABLE_NAME,
      Key: {
        pk: organizationKey(ORGANIZATION_ID),
        sk: evaluationTemplateKey(templateId),
      },
    }),
  );

  return { deletedTemplateId: templateId };
}

async function listTryoutSeasonsResponse(
  userId: string,
): Promise<SerializedTryoutSeason[]> {
  await assertCanManageTryouts(userId);
  const [organization, seasons] = await Promise.all([
    getOrganizationOverview(),
    listTryoutSeasonItems(),
  ]);
  if (seasons.length === 0) return [];

  const allowedTryoutBirthYears = buildTryoutBirthYearOptions(
    organization.tryoutBirthYearYoungest,
    organization.tryoutBirthYearOldest,
  );
  const players = await scanAll<PlayerItem>('Player');
  return seasons.map((season) =>
    serializeTryoutSeason(season, players, allowedTryoutBirthYears),
  );
}

async function createTryoutSeasonResponse(
  userId: string,
  body: string | undefined,
): Promise<SerializedTryoutSeason> {
  await assertCanManageTryouts(userId);
  const payload = parseJsonBody<TryoutSeasonCreateInput>(body);
  const now = new Date().toISOString();
  const seasonId = randomUUID();
  const seasonItem: TryoutSeasonItem = {
    pk: organizationKey(ORGANIZATION_ID),
    sk: tryoutSeasonKey(seasonId),
    entityType: 'TryoutSeason',
    organizationId: ORGANIZATION_ID,
    seasonId,
    name: sanitizeRequiredText(payload.name, '', 'Tryout season name'),
    groups: [],
    teams: [],
    sessions: [],
    playerOverrides: [],
    createdAt: now,
    updatedAt: now,
    createdByUserId: userId,
    updatedByUserId: userId,
  };

  await saveTryoutSeasonItem(seasonItem);
  const [organization, players] = await Promise.all([
    getOrganizationOverview(),
    scanAll<PlayerItem>('Player'),
  ]);
  const allowedTryoutBirthYears = buildTryoutBirthYearOptions(
    organization.tryoutBirthYearYoungest,
    organization.tryoutBirthYearOldest,
  );
  return serializeTryoutSeason(seasonItem, players, allowedTryoutBirthYears);
}

async function updateTryoutSeasonResponse(
  userId: string,
  seasonId: string,
  body: string | undefined,
): Promise<SerializedTryoutSeason> {
  await assertCanManageTryouts(userId);
  const existingSeason = await getTryoutSeasonItem(seasonId);
  if (!existingSeason) throw notFound('Tryout season not found.');

  const payload = parseJsonBody<TryoutSeasonUpdateInput>(body);
  const organization = await getOrganizationOverview();
  const allowedTryoutBirthYears = buildTryoutBirthYearOptions(
    organization.tryoutBirthYearYoungest,
    organization.tryoutBirthYearOldest,
  );
  const sanitizedGroups = sanitizeTryoutGroups(
    payload.groups,
    existingSeason.groups,
    new Set(allowedTryoutBirthYears),
  );
  const sanitizedTeams = sanitizeTryoutTeams(payload.teams, sanitizedGroups, existingSeason.teams);
  const sanitizedSessions = sanitizeTryoutSessions(
    payload.sessions,
    sanitizedTeams,
    existingSeason.sessions,
  );
  await assertTryoutSessionTemplatesExist(sanitizedSessions);
  const players = await scanAll<PlayerItem>('Player');
  const playerIdSet = new Set(
    players.map((player) => player.playerId),
  );
  const sanitizedOverrides = sanitizeTryoutPlayerOverrides(
    payload.playerOverrides,
    playerIdSet,
    sanitizedGroups,
    sanitizedTeams,
    existingSeason.playerOverrides,
  );

  const updatedSeason: TryoutSeasonItem = {
    ...existingSeason,
    name: sanitizeRequiredText(payload.name, existingSeason.name, 'Tryout season name'),
    groups: sanitizedGroups,
    teams: sanitizedTeams,
    sessions: sanitizedSessions,
    playerOverrides: sanitizedOverrides,
    updatedAt: new Date().toISOString(),
    updatedByUserId: userId,
  };

  await saveTryoutSeasonItem(updatedSeason);
  return serializeTryoutSeason(updatedSeason, players, allowedTryoutBirthYears);
}

async function deleteTryoutSeasonResponse(
  userId: string,
  seasonId: string,
): Promise<{ deletedSeasonId: string }> {
  await assertCanManageTryouts(userId);
  const existingSeason = await getTryoutSeasonItem(seasonId);
  if (!existingSeason) throw notFound('Tryout season not found.');
  const linkedEvaluations = (await scanAll<EvaluationRecordItem>('PlayerEvaluation')).filter(
    (record) => record.seasonId === seasonId,
  );

  await Promise.all([
    dynamo.send(
      new DeleteCommand({
        TableName: APP_DATA_TABLE_NAME,
        Key: {
          pk: organizationKey(ORGANIZATION_ID),
          sk: tryoutSeasonKey(seasonId),
        },
      }),
    ),
    ...linkedEvaluations.map((record) =>
      dynamo.send(
        new DeleteCommand({
          TableName: APP_DATA_TABLE_NAME,
          Key: {
            pk: record.pk,
            sk: record.sk,
          },
        }),
      ),
    ),
  ]);

  return { deletedSeasonId: seasonId };
}

async function getTryoutSeasonReportResponse(
  userId: string,
  seasonId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  await assertCanManageTryouts(userId);
  const report = await buildTryoutSeasonReportData(seasonId);
  const pdfBuffer = await buildTryoutSeasonReportPdf(report);
  return pdf(
    200,
    pdfBuffer,
    `${buildReportFileName(report.season.name) || 'tryout-season'}-report.pdf`,
  );
}

async function buildTryoutSeasonReportData(
  seasonId: string,
): Promise<TryoutSeasonReportData> {
  const [organization, season, players] = await Promise.all([
    getOrganizationOverview(),
    getTryoutSeasonItem(seasonId),
    scanAll<PlayerItem>('Player'),
  ]);

  if (!season) throw notFound('Tryout season not found.');

  const seasonPlayers = players.filter(
    (player) => player.organizationId === ORGANIZATION_ID,
  );
  const allowedTryoutBirthYears = buildTryoutBirthYearOptions(
    organization.tryoutBirthYearYoungest,
    organization.tryoutBirthYearOldest,
  );
  const serializedSeason = serializeTryoutSeason(
    season,
    seasonPlayers,
    allowedTryoutBirthYears,
  );
  const teamMap = new Map(serializedSeason.teams.map((team) => [team.id, team]));
  const groupMap = new Map(serializedSeason.groups.map((group) => [group.id, group]));
  const playerMap = new Map(seasonPlayers.map((player) => [player.playerId, player]));

  const sessionRecordEntries = await Promise.all(
    serializedSeason.sessions.map(async (session) => [
      session.id,
      await listEvaluationRecordsForSession(serializedSeason.id, session.id),
    ] as const),
  );
  const sessionRecordsMap = new Map(sessionRecordEntries);
  const templateIds = [
    ...new Set(
      serializedSeason.sessions
        .map((session) => session.evaluationTemplateId)
        .filter((templateId): templateId is string => Boolean(templateId)),
    ),
  ];
  const templates = await Promise.all(
    templateIds.map((templateId) => getEvaluationTemplateItem(templateId)),
  );
  const templateMap = new Map(
    templates
      .filter((template): template is EvaluationTemplateItem => Boolean(template))
      .map((template) => [template.templateId, template]),
  );

  const reportPlayers = serializedSeason.players
    .map((summary) => {
      const player = playerMap.get(summary.playerId);
      if (!player) throw notFound('Player data for the tryout report was unavailable.');

      const groupName = summary.effectiveGroupId
        ? groupMap.get(summary.effectiveGroupId)?.name ?? 'Unknown group'
        : 'Unassigned Pool';
      const teamName = summary.teamId
        ? teamMap.get(summary.teamId)?.name ?? 'Unknown team'
        : 'Unassigned';
      const sessionEntries = serializedSeason.sessions
        .map((session) => {
          const records =
            (sessionRecordsMap.get(session.id) ?? []).filter(
              (record) => record.playerId === summary.playerId,
            );
          const isRosteredForSession =
            summary.teamId !== null && session.teamIds.includes(summary.teamId);
          if (!isRosteredForSession && records.length === 0) return null;

          return {
            session,
            template: session.evaluationTemplateId
              ? templateMap.get(session.evaluationTemplateId) ?? null
              : null,
            records: [...records].sort((left, right) => {
              const evaluatorComparison = left.evaluatorName.localeCompare(right.evaluatorName);
              if (evaluatorComparison !== 0) return evaluatorComparison;
              return left.updatedAt.localeCompare(right.updatedAt);
            }),
            teamNames: session.teamIds.map(
              (teamId) => teamMap.get(teamId)?.name ?? 'Unknown team',
            ),
          } satisfies TryoutSeasonReportSession;
        })
        .filter((entry): entry is TryoutSeasonReportSession => Boolean(entry));

      return {
        summary,
        player,
        groupName,
        teamName,
        sessionEntries,
      } satisfies TryoutSeasonReportPlayer;
    })
    .sort((left, right) => {
      const groupComparison = left.groupName.localeCompare(right.groupName);
      if (groupComparison !== 0) return groupComparison;
      const teamComparison = left.teamName.localeCompare(right.teamName);
      if (teamComparison !== 0) return teamComparison;
      return left.summary.displayName.localeCompare(right.summary.displayName);
    });

  const sessionSummaries = serializedSeason.sessions.map((session) => {
    const records = sessionRecordsMap.get(session.id) ?? [];
    const rosterPlayerIds = new Set(
      serializedSeason.players
        .filter((player) => player.teamId && session.teamIds.includes(player.teamId))
        .map((player) => player.playerId),
    );

    return {
      session,
      template: session.evaluationTemplateId
        ? templateMap.get(session.evaluationTemplateId) ?? null
        : null,
      rosterCount: rosterPlayerIds.size,
      evaluatedPlayerCount: new Set(records.map((record) => record.playerId)).size,
      evaluationCount: records.length,
      evaluatorCount: new Set(records.map((record) => record.evaluatorUserId)).size,
      teamNames: session.teamIds.map(
        (teamId) => teamMap.get(teamId)?.name ?? 'Unknown team',
      ),
    } satisfies TryoutSeasonReportSessionSummary;
  });

  return {
    organization,
    season: serializedSeason,
    players: reportPlayers,
    sessionSummaries,
    totalEvaluationCount: sessionSummaries.reduce(
      (total, sessionSummary) => total + sessionSummary.evaluationCount,
      0,
    ),
  };
}

async function getEvaluationSessionContextResponse(
  userId: string,
  seasonId: string,
  sessionId: string,
): Promise<SerializedEvaluationSessionContext> {
  await assertCanManageTryouts(userId);
  const [organization, season, players, evaluatorProfile] = await Promise.all([
    getOrganizationOverview(),
    getTryoutSeasonItem(seasonId),
    scanAll<PlayerItem>('Player'),
    requireUserProfile(userId),
  ]);

  if (!season) throw notFound('Tryout season not found.');
  const session = sanitizeTryoutSessions(season.sessions, season.teams).find(
    (entry) => entry.id === sessionId,
  );
  if (!session) throw notFound('Evaluation session not found.');
  if (!session.evaluationTemplateId) {
    throw badRequest('Assign an evaluation template to this session before starting evaluation.');
  }

  const allowedTryoutBirthYears = buildTryoutBirthYearOptions(
    organization.tryoutBirthYearYoungest,
    organization.tryoutBirthYearOldest,
  );
  const groups = sanitizeTryoutGroups(
    season.groups,
    [],
    new Set(allowedTryoutBirthYears),
  );
  const teams = sanitizeTryoutTeams(season.teams, groups);
  const template = await getEvaluationTemplateItem(session.evaluationTemplateId);
  if (!template) {
    throw badRequest('The session references an evaluation template that no longer exists.');
  }

  const seasonPlayers = players.filter(
    (player) => player.organizationId === ORGANIZATION_ID,
  );
  const playerSummaries = serializeTryoutSeason(
    season,
    seasonPlayers,
    allowedTryoutBirthYears,
  ).players;
  const playerSummaryMap = new Map(playerSummaries.map((player) => [player.playerId, player]));
  const playerMap = new Map(seasonPlayers.map((player) => [player.playerId, player]));
  const sessionTeamIds = new Set(session.teamIds);

  const serializedTeams = teams
    .filter((team) => sessionTeamIds.has(team.id))
    .map((team) => ({
      id: team.id,
      name: team.name,
      groupId: team.groupId,
      groupName: getTryoutGroupName(team.groupId, groups),
      jerseyColor: team.jerseyColor,
      players: playerSummaries
        .filter((summary) => summary.teamId === team.id)
        .map((summary) => {
          const player = playerMap.get(summary.playerId);
          if (!player) throw notFound('Player data for evaluation session was unavailable.');
          return serializeEvaluationSessionPlayer(summary, player, team, groups);
        })
        .sort(compareEvaluationPlayers),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const currentEvaluatorRecords = await listEvaluationRecordsForEvaluator(
    seasonId,
    sessionId,
    userId,
  );

  const filteredRecords = currentEvaluatorRecords
    .filter((record) => {
      const summary = playerSummaryMap.get(record.playerId);
      return Boolean(summary?.teamId && sessionTeamIds.has(summary.teamId));
    })
    .map(serializeEvaluationRecord);

  return {
    seasonId,
    seasonName: season.name,
    session,
    template: serializeEvaluationTemplate(template),
    teams: serializedTeams,
    records: filteredRecords,
    evaluator: {
      userId,
      displayName: buildUserName(evaluatorProfile.firstName, evaluatorProfile.lastName) || evaluatorProfile.email,
    },
  };
}

async function updatePlayerEvaluationRecordResponse(
  userId: string,
  seasonId: string,
  sessionId: string,
  playerId: string,
  body: string | undefined,
): Promise<{ record: SerializedPlayerEvaluationRecord | null }> {
  await assertCanManageTryouts(userId);
  const payload = parseJsonBody<EvaluationRecordUpdateInput>(body);
  const [organization, season, player, evaluatorProfile] = await Promise.all([
    getOrganizationOverview(),
    getTryoutSeasonItem(seasonId),
    getPlayer(playerId),
    requireUserProfile(userId),
  ]);

  if (!season) throw notFound('Tryout season not found.');
  if (!player || player.organizationId !== ORGANIZATION_ID) {
    throw notFound('Player not found.');
  }

  const allowedTryoutBirthYears = buildTryoutBirthYearOptions(
    organization.tryoutBirthYearYoungest,
    organization.tryoutBirthYearOldest,
  );
  const groups = sanitizeTryoutGroups(
    season.groups,
    [],
    new Set(allowedTryoutBirthYears),
  );
  const teams = sanitizeTryoutTeams(season.teams, groups);
  const session = sanitizeTryoutSessions(season.sessions, teams).find(
    (entry) => entry.id === sessionId,
  );
  if (!session) throw notFound('Evaluation session not found.');
  if (!session.evaluationTemplateId) {
    throw badRequest('Assign an evaluation template to this session before recording evaluations.');
  }

  const template = await getEvaluationTemplateItem(session.evaluationTemplateId);
  if (!template) {
    throw badRequest('The assigned evaluation template no longer exists.');
  }

  const playerSummary = serializeTryoutPlayerSummary(
    player,
    groups,
    new Map(teams.map((team) => [team.id, team])),
    season.playerOverrides.find((override) => override.playerId === playerId),
  );

  if (!playerSummary.teamId || !session.teamIds.includes(playerSummary.teamId)) {
    throw badRequest('This player is not assigned to a team in the selected evaluation session.');
  }

  const existingRecord = await getEvaluationRecord(seasonId, sessionId, userId, playerId);
  const scores = sanitizeEvaluationScores(
    payload.scores,
    template.criteria,
    existingRecord?.scores,
  );
  const notes = sanitizeEvaluationNotes(
    payload.notes,
    existingRecord?.notes,
  );

  if (Object.values(scores).every((score) => score === null) && notes.length === 0) {
    if (existingRecord) {
      await deleteEvaluationRecord(seasonId, sessionId, userId, playerId);
    }
    return { record: null };
  }

  const now = new Date().toISOString();
  const nextRecord: EvaluationRecordItem = {
    pk: evaluationRecordPartitionKey(seasonId, sessionId, userId),
    sk: evaluationRecordSortKey(playerId),
    entityType: 'PlayerEvaluation',
    organizationId: ORGANIZATION_ID,
    seasonId,
    sessionId,
    playerId,
    evaluatorUserId: userId,
    evaluatorName:
      buildUserName(evaluatorProfile.firstName, evaluatorProfile.lastName) ||
      evaluatorProfile.email,
    templateId: template.templateId,
    scores,
    notes,
    createdAt: existingRecord?.createdAt ?? now,
    updatedAt: now,
    gsi1pk: evaluationSessionKey(seasonId, sessionId),
    gsi1sk: `EVALUATOR#${userId}#PLAYER#${playerId}`,
  };

  await saveEvaluationRecord(nextRecord);
  return {
    record: serializeEvaluationRecord(nextRecord),
  };
}

async function createPlayerResponse(userId: string, email: string, body: string | undefined): Promise<{ bootstrap: BootstrapResponse; player: SerializedPlayer }> {
  const payload = parseJsonBody<{ profile?: PlayerProfileInput; intake?: IntakeAnswers; intakeStatus?: IntakeStatus }>(body);
  const player = await createPlayerForUser(userId, email, payload);
  return { bootstrap: await buildBootstrapResponse(userId, email), player };
}

async function updatePlayerResponse(userId: string, email: string, playerId: string, body: string | undefined): Promise<{ bootstrap: BootstrapResponse; player: SerializedPlayer }> {
  const payload = parseJsonBody<{ profile?: PlayerProfileInput; intake?: IntakeAnswers; intakeStatus?: IntakeStatus }>(body);
  const player = await updatePlayerForUser(userId, email, playerId, payload);
  return { bootstrap: await buildBootstrapResponse(userId, email), player };
}

async function createInviteResponse(userId: string, email: string, playerId: string, body: string | undefined): Promise<{ bootstrap: BootstrapResponse; invite: SerializedInvite }> {
  const payload = parseJsonBody<{ invitedEmail?: string; invitedRole?: UserRole }>(body);
  const invite = await createInviteForUser(userId, email, playerId, payload);
  return { bootstrap: await buildBootstrapResponse(userId, email), invite };
}

async function acceptInviteResponse(userId: string, email: string, inviteId: string): Promise<BootstrapResponse> {
  await acceptInviteForUser(userId, email, inviteId);
  return buildBootstrapResponse(userId, email);
}

async function declineInviteResponse(userId: string, email: string, inviteId: string): Promise<BootstrapResponse> {
  await declineInviteForUser(email, inviteId);
  return buildBootstrapResponse(userId, email);
}

async function revokeInviteResponse(userId: string, email: string, inviteId: string): Promise<BootstrapResponse> {
  await revokeInviteForUser(userId, inviteId);
  return buildBootstrapResponse(userId, email);
}

async function claimAdminResponse(userId: string, email: string): Promise<BootstrapResponse> {
  await claimOrganizationAdminForUser(userId, email);
  return buildBootstrapResponse(userId, email);
}

async function createPlayerForUser(
  userId: string,
  email: string,
  payload: { profile?: PlayerProfileInput; intake?: IntakeAnswers; intakeStatus?: IntakeStatus },
): Promise<SerializedPlayer> {
  const userProfile = await requireUserProfile(userId);
  validatePrimaryRole(userProfile.primaryRole);
  const profile = sanitizeProfile(payload.profile, email, userProfile.primaryRole, userProfile);
  const intake = buildIntakeRecord(payload.intake, payload.intakeStatus);
  if (intake.status === 'submitted') ensureSubmissionIsComplete(profile, intake.answers);

  if (userProfile.primaryRole === 'player') {
    const existingLinks = await listUserPlayerLinks(userId);
    if (existingLinks.some((link) => link.relationship === 'player')) throw conflict('A player account can only create one self-owned player record.');
  }

  const now = new Date().toISOString();
  const playerId = randomUUID();
  const playerItem: PlayerItem = {
    pk: playerKey(playerId),
    sk: 'PROFILE',
    entityType: 'Player',
    playerId,
    organizationId: ORGANIZATION_ID,
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    profile,
    intake,
  };
  const linkItem = buildUserPlayerLinkItem(userId, playerId, userProfile.primaryRole, profile.playerName);
  await Promise.all([
    dynamo.send(new PutCommand({ TableName: APP_DATA_TABLE_NAME, Item: playerItem })),
    dynamo.send(new PutCommand({ TableName: APP_DATA_TABLE_NAME, Item: linkItem })),
  ]);

  await syncLinkedPlayerUsersFromPlayerProfile(playerId, profile);
  return serializePlayer(linkItem, playerItem, []);
}

async function updatePlayerForUser(
  userId: string,
  email: string,
  playerId: string,
  payload: { profile?: PlayerProfileInput; intake?: IntakeAnswers; intakeStatus?: IntakeStatus },
): Promise<SerializedPlayer> {
  const association = await getUserPlayerLink(userId, playerId);
  if (!association) throw forbidden('You are not linked to this player record.');
  const existingPlayer = await getPlayer(playerId);
  if (!existingPlayer) throw notFound('Player record not found.');

  const profile = sanitizeProfile(
    payload.profile,
    email,
    association.relationship,
    null,
    existingPlayer.profile,
  );
  const intake = buildIntakeRecord(payload.intake, payload.intakeStatus, existingPlayer.intake);
  if (intake.status === 'submitted') ensureSubmissionIsComplete(profile, intake.answers);

  const updatedPlayer: PlayerItem = { ...existingPlayer, updatedAt: new Date().toISOString(), profile, intake };
  const [links, invites] = await Promise.all([listPlayerLinks(playerId), listPlayerInvites(playerId)]);
  const updatedLinks = links.map((link) => ({ ...link, playerName: profile.playerName }));
  const updatedInvites = invites.map((invite) => ({ ...invite, playerName: profile.playerName }));
  const currentLink = updatedLinks.find((link) => link.userId === userId) ?? buildUserPlayerLinkItem(userId, playerId, association.relationship, profile.playerName);

  await Promise.all([
    dynamo.send(new PutCommand({ TableName: APP_DATA_TABLE_NAME, Item: updatedPlayer })),
    ...updatedLinks.map((link) => dynamo.send(new PutCommand({ TableName: APP_DATA_TABLE_NAME, Item: link }))),
    ...updatedInvites.map((invite) => dynamo.send(new PutCommand({ TableName: APP_DATA_TABLE_NAME, Item: invite }))),
  ]);
  await syncLinkedPlayerUsersFromPlayerProfile(playerId, profile);
  return serializePlayer(currentLink, updatedPlayer, updatedInvites);
}

async function createInviteForUser(
  userId: string,
  email: string,
  playerId: string,
  payload: { invitedEmail?: string; invitedRole?: UserRole },
): Promise<SerializedInvite> {
  const association = await getUserPlayerLink(userId, playerId);
  if (!association) throw forbidden('You are not linked to this player record.');
  const invitedEmail = typeof payload.invitedEmail === 'string' ? payload.invitedEmail.trim() : '';
  const invitedRole = payload.invitedRole;
  if (!invitedEmail) throw badRequest('Invite email is required.');
  if (invitedRole !== 'parent' && invitedRole !== 'player') throw badRequest('Invite role must be parent or player.');
  if (association.relationship === 'parent' && invitedRole !== 'player') throw badRequest('A parent can only invite a player.');
  if (association.relationship === 'player' && invitedRole !== 'parent') throw badRequest('A player can only invite a parent.');
  const normalizedEmail = invitedEmail.toLowerCase();
  if (normalizedEmail === email.toLowerCase()) throw badRequest('Use this account directly instead of inviting the same email address.');

  const player = await getPlayer(playerId);
  if (!player) throw notFound('Player record not found.');
  const existingInvites = await listPlayerInvites(playerId);
  if (existingInvites.some((invite) => invite.status === 'pending' && invite.invitedEmailLower === normalizedEmail && invite.invitedRole === invitedRole)) {
    throw conflict('A pending invite already exists for that email address.');
  }

  const now = new Date().toISOString();
  const inviteId = randomUUID();
  const inviteItem: InviteItem = {
    pk: inviteKey(inviteId),
    sk: 'PROFILE',
    entityType: 'Invite',
    inviteId,
    organizationId: player.organizationId,
    playerId,
    playerName: player.profile.playerName,
    invitedEmail,
    invitedEmailLower: normalizedEmail,
    invitedRole,
    invitedByUserId: userId,
    invitedByLabel: email,
    status: 'pending',
    createdAt: now,
    acceptedAt: null,
    gsi1pk: playerKey(playerId),
    gsi1sk: `INVITE#${now}#${inviteId}`,
    gsi2pk: invitedEmailKey(normalizedEmail),
    gsi2sk: inviteStatusSortKey('pending', now, inviteId),
  };
  await saveInvite(inviteItem);
  return serializeInvite(inviteItem);
}

async function acceptInviteForUser(userId: string, email: string, inviteId: string): Promise<void> {
  const invite = await getInvite(inviteId);
  if (!invite) throw notFound('Invite not found.');
  if (invite.status !== 'pending') throw conflict('This invite is no longer pending.');
  if (invite.invitedEmailLower !== email.toLowerCase()) throw forbidden('This invite was created for a different email address.');

  const userProfile = await getUserProfile(userId);
  if (userProfile?.primaryRole && userProfile.primaryRole !== invite.invitedRole) throw conflict(`This account is already set up as a ${userProfile.primaryRole}.`);
  const currentLinks = await listUserPlayerLinks(userId);
  if (invite.invitedRole === 'player' && currentLinks.some((link) => link.relationship === 'player' && link.playerId !== invite.playerId)) {
    throw conflict('A player account can only be linked to one self-owned player record.');
  }

  const player = await getPlayer(invite.playerId);
  if (!player) throw notFound('The invited player record no longer exists.');
  const acceptedAt = new Date().toISOString();
  const linkItem = buildUserPlayerLinkItem(userId, invite.playerId, invite.invitedRole, player.profile.playerName);
  const normalizedPlayerProfile = normalizePlayerProfile(
    player.profile,
    userProfile?.contactEmail || email,
    invite.invitedRole,
    userProfile,
  );
  const profileUpdate: UserProfileUpdateInput =
    invite.invitedRole === 'player'
      ? {
          primaryRole: invite.invitedRole,
          firstName: normalizedPlayerProfile.firstName,
          lastName: normalizedPlayerProfile.lastName,
          contactEmail: normalizedPlayerProfile.bestContactEmail || email,
          phoneNumber: normalizedPlayerProfile.phoneNumber,
          smsOptIn: normalizedPlayerProfile.smsOptIn,
        }
      : {
          primaryRole: invite.invitedRole,
        };
  await Promise.all([
    saveInvite({ ...invite, status: 'accepted', acceptedAt, gsi2sk: inviteStatusSortKey('accepted', invite.createdAt, invite.inviteId) }),
    saveUserProfile(userId, email, profileUpdate),
    dynamo.send(new PutCommand({ TableName: APP_DATA_TABLE_NAME, Item: linkItem })),
  ]);
  await ensureAppAccessRole(userId, invite.invitedRole);
}

async function declineInviteForUser(email: string, inviteId: string): Promise<void> {
  const invite = await getInvite(inviteId);
  if (!invite) throw notFound('Invite not found.');
  if (invite.status !== 'pending') throw conflict('This invite is no longer pending.');
  if (invite.invitedEmailLower !== email.toLowerCase()) throw forbidden('This invite was created for a different email address.');
  await saveInvite({ ...invite, status: 'declined', acceptedAt: null, gsi2sk: inviteStatusSortKey('declined', invite.createdAt, invite.inviteId) });
}

async function revokeInviteForUser(userId: string, inviteId: string): Promise<void> {
  const invite = await getInvite(inviteId);
  if (!invite) throw notFound('Invite not found.');
  if (invite.status !== 'pending') throw conflict('Only pending invites can be revoked.');
  if (invite.invitedByUserId !== userId) throw forbidden('Only the user who created this invite can revoke it.');
  if (!(await getUserPlayerLink(userId, invite.playerId))) throw forbidden('You are no longer linked to this player record.');
  await saveInvite({ ...invite, status: 'revoked', acceptedAt: null, gsi2sk: inviteStatusSortKey('revoked', invite.createdAt, invite.inviteId) });
}

async function claimOrganizationAdminForUser(userId: string, email: string): Promise<void> {
  const resolvedAccess = await resolveAccess(userId);
  const currentRoles = resolvedAccess.currentRoles;
  if (currentRoles.includes('club-admin') || currentRoles.includes('platform-admin')) return;

  const adminContext = await buildOrganizationAdminContext(email, currentRoles);
  if (!adminContext.canClaimOrganizationAdmin) {
    throw forbidden('Organization admin access is not available for this account.');
  }

  const nextRoles = [...new Set<AppRole>([...currentRoles, 'club-admin'])];
  await dynamo.send(new PutCommand({
    TableName: APP_ACCESS_TABLE_NAME,
    Item: {
      userId,
      appKey: APP_KEY,
      roles: nextRoles,
      organizationMemberships: upsertOrganizationMembership(
        resolvedAccess.organizationMemberships,
        ORGANIZATION_ID,
        nextRoles,
      ),
      status: 'ACTIVE',
      grantedAt: new Date().toISOString(),
      grantedBy: BOOTSTRAP_ADMIN_EMAIL === email.toLowerCase() ? 'bootstrap-admin' : 'self-service-admin',
    } satisfies AppAccessItem,
  }));
}

async function buildOrganizationAdminContext(
  email: string,
  roles: AppRole[],
): Promise<BootstrapResponse['admin']> {
  const hasOrganizationAdmin = await organizationHasAdmin();
  const isAdmin = roles.includes('club-admin') || roles.includes('platform-admin');
  const canClaimOrganizationAdmin =
    !isAdmin && (email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL || !hasOrganizationAdmin);

  return {
    canClaimOrganizationAdmin,
    hasOrganizationAdmin,
    summary: isAdmin ? await buildOrganizationAdminSummary() : null,
  };
}

async function organizationHasAdmin(): Promise<boolean> {
  if (!APP_ACCESS_TABLE_NAME) return false;
  const response = await dynamo.send(new QueryCommand({
    TableName: APP_ACCESS_TABLE_NAME,
    IndexName: 'by-app',
    KeyConditionExpression: 'appKey = :appKey',
    ExpressionAttributeValues: {
      ':appKey': APP_KEY,
    },
  }));

  const items = (response.Items as AppAccessItem[] | undefined) ?? [];
  return items.some((item) => {
    const resolvedAccess = normalizeAccessItem(item);
    return resolvedAccess.currentRoles.some((role) => role === 'club-admin' || role === 'platform-admin');
  });
}

async function buildOrganizationAdminSummary(): Promise<OrganizationAdminSummary> {
  const [players, invites] = await Promise.all([
    scanAll<PlayerItem>('Player'),
    scanAll<InviteItem>('Invite'),
  ]);

  const organizationPlayers = players.filter((player) => player.organizationId === ORGANIZATION_ID);
  const organizationInvites = invites.filter(
    (invite) =>
      invite.status === 'pending' &&
      (invite.organizationId ? invite.organizationId === ORGANIZATION_ID : true),
  );

  return {
    totalPlayers: organizationPlayers.length,
    submittedIntakes: organizationPlayers.filter((player) => player.intake.status === 'submitted').length,
    draftIntakes: organizationPlayers.filter((player) => player.intake.status === 'draft').length,
    pendingInvites: organizationInvites.length,
  };
}

async function resolveAccess(userId: string): Promise<ResolvedAccess> {
  return normalizeAccessItem((await getAccessItem(userId)) ?? undefined);
}

async function getAccessItem(userId: string): Promise<AppAccessItem | null> {
  if (!APP_ACCESS_TABLE_NAME) return null;
  const response = await dynamo.send(
    new GetCommand({ TableName: APP_ACCESS_TABLE_NAME, Key: { userId, appKey: APP_KEY } }),
  );
  return (response.Item as AppAccessItem | undefined) ?? null;
}

async function getAccessMap(
  userIds: string[],
): Promise<Map<string, AppAccessItem | undefined>> {
  const accessMap = new Map<string, AppAccessItem | undefined>();
  const distinctUserIds = [...new Set(userIds.filter(Boolean))];
  if (!APP_ACCESS_TABLE_NAME || distinctUserIds.length === 0) return accessMap;

  for (let index = 0; index < distinctUserIds.length; index += 100) {
    const chunk = distinctUserIds.slice(index, index + 100);
    const response = await dynamo.send(
      new BatchGetCommand({
        RequestItems: {
          [APP_ACCESS_TABLE_NAME]: {
            Keys: chunk.map((targetUserId) => ({ userId: targetUserId, appKey: APP_KEY })),
          },
        },
      }),
    );
    const items = (response.Responses?.[APP_ACCESS_TABLE_NAME] as AppAccessItem[] | undefined) ?? [];
    items.forEach((item) => {
      accessMap.set(item.userId, item);
    });
  }

  distinctUserIds.forEach((targetUserId) => {
    if (!accessMap.has(targetUserId)) accessMap.set(targetUserId, undefined);
  });

  return accessMap;
}

async function ensureAppAccessRole(userId: string, role: UserRole): Promise<void> {
  if (!APP_ACCESS_TABLE_NAME) return;
  const resolvedAccess = await resolveAccess(userId);
  const roles = [...new Set<AppRole>([...resolvedAccess.currentRoles, role])];
  await dynamo.send(new PutCommand({
    TableName: APP_ACCESS_TABLE_NAME,
    Item: {
      userId,
      appKey: APP_KEY,
      roles,
      organizationMemberships: upsertOrganizationMembership(
        resolvedAccess.organizationMemberships,
        ORGANIZATION_ID,
        roles,
      ),
      status: 'ACTIVE',
      grantedAt: new Date().toISOString(),
      grantedBy: 'self-service',
    } satisfies AppAccessItem,
  }));
}

async function getOrganizationOverview(): Promise<OrganizationOverview> {
  const organizationItem = await getOrganizationItem();
  return organizationItem ? serializeOrganization(organizationItem) : defaultOrganization;
}

async function getOrganizationItem(): Promise<OrganizationItem | null> {
  const response = await dynamo.send(new GetCommand({
    TableName: APP_DATA_TABLE_NAME,
    Key: {
      pk: organizationKey(ORGANIZATION_ID),
      sk: 'PROFILE',
    },
  }));

  return (response.Item as OrganizationItem | undefined) ?? null;
}

async function saveOrganizationSettings(
  userId: string,
  payload: OrganizationSettingsInput,
): Promise<void> {
  const existing = await getOrganizationItem();
  const now = new Date().toISOString();
  const organization = sanitizeOrganizationSettings(payload, existing);

  await dynamo.send(new PutCommand({
    TableName: APP_DATA_TABLE_NAME,
    Item: {
      pk: organizationKey(ORGANIZATION_ID),
      sk: 'PROFILE',
      entityType: 'Organization',
      organizationId: ORGANIZATION_ID,
      ...organization,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      updatedByUserId: userId,
    } satisfies OrganizationItem,
  }));
}

async function listEvaluationTemplateItems(): Promise<EvaluationTemplateItem[]> {
  const response = await dynamo.send(
    new QueryCommand({
      TableName: APP_DATA_TABLE_NAME,
      KeyConditionExpression: 'pk = :pk and begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': organizationKey(ORGANIZATION_ID),
        ':sk': 'EVALUATION_TEMPLATE#',
      },
    }),
  );

  const items = (response.Items as EvaluationTemplateItem[] | undefined) ?? [];
  return items.sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt.localeCompare(left.updatedAt);
    }

    return left.name.localeCompare(right.name);
  });
}

async function getEvaluationTemplateItem(
  templateId: string,
): Promise<EvaluationTemplateItem | null> {
  const response = await dynamo.send(
    new GetCommand({
      TableName: APP_DATA_TABLE_NAME,
      Key: {
        pk: organizationKey(ORGANIZATION_ID),
        sk: evaluationTemplateKey(templateId),
      },
    }),
  );

  return (response.Item as EvaluationTemplateItem | undefined) ?? null;
}

async function assertTryoutSessionTemplatesExist(
  sessions: TryoutSession[],
): Promise<void> {
  const templateIds = [...new Set(
    sessions
      .map((session) => session.evaluationTemplateId)
      .filter((templateId): templateId is string => Boolean(templateId)),
  )];

  if (templateIds.length === 0) return;

  const templates = await Promise.all(
    templateIds.map((templateId) => getEvaluationTemplateItem(templateId)),
  );

  const missingTemplateId = templateIds.find((templateId, index) => !templates[index]);
  if (missingTemplateId) {
    throw badRequest(`Evaluation template "${missingTemplateId}" was not found.`);
  }
}

async function saveEvaluationTemplateItem(
  item: EvaluationTemplateItem,
): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: APP_DATA_TABLE_NAME,
      Item: item,
    }),
  );
}

async function listTryoutSeasonItems(): Promise<TryoutSeasonItem[]> {
  const response = await dynamo.send(
    new QueryCommand({
      TableName: APP_DATA_TABLE_NAME,
      KeyConditionExpression: 'pk = :pk and begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': organizationKey(ORGANIZATION_ID),
        ':sk': 'TRYOUT_SEASON#',
      },
    }),
  );

  const items = (response.Items as TryoutSeasonItem[] | undefined) ?? [];
  return items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function getTryoutSeasonItem(
  seasonId: string,
): Promise<TryoutSeasonItem | null> {
  const response = await dynamo.send(
    new GetCommand({
      TableName: APP_DATA_TABLE_NAME,
      Key: {
        pk: organizationKey(ORGANIZATION_ID),
        sk: tryoutSeasonKey(seasonId),
      },
    }),
  );

  return (response.Item as TryoutSeasonItem | undefined) ?? null;
}

async function saveTryoutSeasonItem(
  item: TryoutSeasonItem,
): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: APP_DATA_TABLE_NAME,
      Item: item,
    }),
  );
}

async function listEvaluationRecordsForEvaluator(
  seasonId: string,
  sessionId: string,
  evaluatorUserId: string,
): Promise<EvaluationRecordItem[]> {
  const response = await dynamo.send(
    new QueryCommand({
      TableName: APP_DATA_TABLE_NAME,
      KeyConditionExpression: 'pk = :pk and begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': evaluationRecordPartitionKey(seasonId, sessionId, evaluatorUserId),
        ':sk': 'PLAYER#',
      },
    }),
  );

  return (response.Items as EvaluationRecordItem[] | undefined) ?? [];
}

async function listEvaluationRecordsForSession(
  seasonId: string,
  sessionId: string,
): Promise<EvaluationRecordItem[]> {
  const items: EvaluationRecordItem[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await dynamo.send(
      new QueryCommand({
        TableName: APP_DATA_TABLE_NAME,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk and begins_with(gsi1sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': evaluationSessionKey(seasonId, sessionId),
          ':sk': 'EVALUATOR#',
        },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    items.push(...(((response.Items as EvaluationRecordItem[] | undefined) ?? [])));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return items;
}

async function getEvaluationRecord(
  seasonId: string,
  sessionId: string,
  evaluatorUserId: string,
  playerId: string,
): Promise<EvaluationRecordItem | null> {
  const response = await dynamo.send(
    new GetCommand({
      TableName: APP_DATA_TABLE_NAME,
      Key: {
        pk: evaluationRecordPartitionKey(seasonId, sessionId, evaluatorUserId),
        sk: evaluationRecordSortKey(playerId),
      },
    }),
  );

  return (response.Item as EvaluationRecordItem | undefined) ?? null;
}

async function saveEvaluationRecord(item: EvaluationRecordItem): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: APP_DATA_TABLE_NAME,
      Item: item,
    }),
  );
}

async function deleteEvaluationRecord(
  seasonId: string,
  sessionId: string,
  evaluatorUserId: string,
  playerId: string,
): Promise<void> {
  await dynamo.send(
    new DeleteCommand({
      TableName: APP_DATA_TABLE_NAME,
      Key: {
        pk: evaluationRecordPartitionKey(seasonId, sessionId, evaluatorUserId),
        sk: evaluationRecordSortKey(playerId),
      },
    }),
  );
}

async function getUserProfile(userId: string): Promise<UserProfileItem | null> {
  const response = await dynamo.send(new GetCommand({ TableName: APP_DATA_TABLE_NAME, Key: { pk: userKey(userId), sk: 'PROFILE' } }));
  return (response.Item as UserProfileItem | undefined) ?? null;
}

async function ensureUserProfile(userId: string, email: string): Promise<UserProfileItem> {
  const existingProfile = await getUserProfile(userId);
  if (existingProfile) return existingProfile;

  await saveUserProfile(userId, email, {});
  const createdProfile = await getUserProfile(userId);
  if (!createdProfile) throw new Error('User profile could not be created.');
  return createdProfile;
}

async function requireUserProfile(userId: string): Promise<UserProfileItem> {
  const userProfile = await getUserProfile(userId);
  if (!userProfile) throw badRequest('Choose whether this account starts as parent, player, or staff before continuing.');
  return userProfile;
}

async function saveUserProfile(
  userId: string,
  email: string,
  primaryRole: UserProfileUpdateInput,
): Promise<void> {
  const existing = await getUserProfile(userId);
  const now = new Date().toISOString();
  const nextPrimaryRole =
    primaryRole.primaryRole === undefined
      ? existing?.primaryRole ?? null
      : primaryRole.primaryRole;
  const firstName = sanitizeFreeText(primaryRole.firstName, existing?.firstName ?? '');
  const lastName = sanitizeFreeText(primaryRole.lastName, existing?.lastName ?? '');
  const contactEmail = sanitizeEmailField(
    primaryRole.contactEmail,
    existing?.contactEmail ?? '',
    'Contact email',
  );
  const phoneNumber = sanitizePhoneNumber(
    primaryRole.phoneNumber,
    existing?.phoneNumber ?? '',
  );
  const smsOptIn = primaryRole.smsOptIn ?? existing?.smsOptIn ?? false;
  const accountStatus = primaryRole.accountStatus ?? existing?.accountStatus ?? 'ACTIVE';
  const disabledAt =
    primaryRole.disabledAt !== undefined
      ? primaryRole.disabledAt
      : accountStatus === 'DISABLED'
        ? existing?.disabledAt ?? now
        : null;
  const disabledByUserId =
    primaryRole.disabledByUserId !== undefined
      ? primaryRole.disabledByUserId
      : accountStatus === 'DISABLED'
        ? existing?.disabledByUserId ?? null
        : null;

  if (smsOptIn && !phoneNumber) {
    throw badRequest('Add a phone number before enabling text notifications.');
  }

  const nextProfile: UserProfileItem = {
    pk: userKey(userId),
    sk: 'PROFILE',
    entityType: 'UserProfile',
    userId,
    email,
    firstName,
    lastName,
    contactEmail,
    phoneNumber,
    smsOptIn,
    primaryRole: nextPrimaryRole,
    accountStatus,
    disabledAt,
    disabledByUserId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await dynamo.send(new PutCommand({
    TableName: APP_DATA_TABLE_NAME,
    Item: nextProfile,
  }));
}

async function listUserPlayerLinks(userId: string): Promise<UserPlayerLinkItem[]> {
  const response = await dynamo.send(new QueryCommand({
    TableName: APP_DATA_TABLE_NAME,
    KeyConditionExpression: 'pk = :pk and begins_with(sk, :sk)',
    ExpressionAttributeValues: { ':pk': userKey(userId), ':sk': 'PLAYER#' },
  }));
  return ((response.Items as UserPlayerLinkItem[] | undefined) ?? []).sort((left, right) => left.playerName.localeCompare(right.playerName));
}

async function getUserPlayerLink(userId: string, playerId: string): Promise<UserPlayerLinkItem | null> {
  const response = await dynamo.send(new GetCommand({ TableName: APP_DATA_TABLE_NAME, Key: { pk: userKey(userId), sk: playerLinkKey(playerId) } }));
  return (response.Item as UserPlayerLinkItem | undefined) ?? null;
}

async function listPlayerLinks(playerId: string): Promise<UserPlayerLinkItem[]> {
  const response = await dynamo.send(new QueryCommand({
    TableName: APP_DATA_TABLE_NAME,
    IndexName: 'gsi1',
    KeyConditionExpression: 'gsi1pk = :pk and begins_with(gsi1sk, :sk)',
    ExpressionAttributeValues: { ':pk': playerKey(playerId), ':sk': 'USER#' },
  }));
  return (response.Items as UserPlayerLinkItem[] | undefined) ?? [];
}

async function getPlayer(playerId: string): Promise<PlayerItem | null> {
  const response = await dynamo.send(new GetCommand({ TableName: APP_DATA_TABLE_NAME, Key: { pk: playerKey(playerId), sk: 'PROFILE' } }));
  return (response.Item as PlayerItem | undefined) ?? null;
}

async function getPlayers(playerIds: string[]): Promise<Map<string, PlayerItem>> {
  if (playerIds.length === 0) return new Map();
  const response = await dynamo.send(new BatchGetCommand({
    RequestItems: { [APP_DATA_TABLE_NAME]: { Keys: playerIds.map((playerId) => ({ pk: playerKey(playerId), sk: 'PROFILE' })) } },
  }));
  const items = (response.Responses?.[APP_DATA_TABLE_NAME] as PlayerItem[] | undefined) ?? [];
  return new Map(items.map((item) => [item.playerId, item]));
}

async function syncLinkedPlayerUsersFromPlayerProfile(
  playerId: string,
  profile: PlayerProfileInput,
): Promise<void> {
  const links = await listPlayerLinks(playerId);
  const playerLinks = links.filter((link) => link.relationship === 'player');

  await Promise.all(
    playerLinks.map(async (link) => {
      const existingProfile = await getUserProfile(link.userId);
      if (!existingProfile) return;

      await saveUserProfile(link.userId, existingProfile.email, {
        primaryRole: existingProfile.primaryRole ?? 'player',
        firstName: profile.firstName,
        lastName: profile.lastName,
        contactEmail: profile.bestContactEmail,
        phoneNumber: profile.phoneNumber,
        smsOptIn: profile.smsOptIn,
      });
    }),
  );
}

async function syncSelfPlayerProfileFromUserProfile(
  userId: string,
  userProfile: UserProfileItem,
): Promise<void> {
  if (userProfile.primaryRole !== 'player') return;

  const links = await listUserPlayerLinks(userId);
  const selfLink = links.find((link) => link.relationship === 'player');
  if (!selfLink) return;

  const player = await getPlayer(selfLink.playerId);
  if (!player) return;

  const normalizedProfile = normalizePlayerProfile(
    player.profile,
    userProfile.contactEmail || userProfile.email,
    'player',
    userProfile,
  );

  const syncedProfile = sanitizeProfile(
    {
      ...normalizedProfile,
      firstName: userProfile.firstName ?? normalizedProfile.firstName,
      lastName: userProfile.lastName ?? normalizedProfile.lastName,
      bestContactEmail:
        userProfile.contactEmail !== undefined
          ? userProfile.contactEmail
          : normalizedProfile.bestContactEmail,
      phoneNumber:
        userProfile.phoneNumber !== undefined
          ? userProfile.phoneNumber
          : normalizedProfile.phoneNumber,
      smsOptIn:
        userProfile.smsOptIn !== undefined
          ? userProfile.smsOptIn
          : normalizedProfile.smsOptIn,
    },
    userProfile.contactEmail || userProfile.email,
    'player',
    userProfile,
    player.profile,
  );

  const updatedPlayer: PlayerItem = {
    ...player,
    updatedAt: new Date().toISOString(),
    profile: syncedProfile,
  };
  const [playerLinks, invites] = await Promise.all([
    listPlayerLinks(player.playerId),
    listPlayerInvites(player.playerId),
  ]);
  const updatedLinks = playerLinks.map((link) => ({
    ...link,
    playerName: syncedProfile.playerName,
  }));
  const updatedInvites = invites.map((invite) => ({
    ...invite,
    playerName: syncedProfile.playerName,
  }));

  await Promise.all([
    dynamo.send(new PutCommand({ TableName: APP_DATA_TABLE_NAME, Item: updatedPlayer })),
    ...updatedLinks.map((link) =>
      dynamo.send(new PutCommand({ TableName: APP_DATA_TABLE_NAME, Item: link })),
    ),
    ...updatedInvites.map((invite) =>
      dynamo.send(new PutCommand({ TableName: APP_DATA_TABLE_NAME, Item: invite })),
    ),
  ]);
}

async function listPlayerInvites(playerId: string): Promise<InviteItem[]> {
  const response = await dynamo.send(new QueryCommand({
    TableName: APP_DATA_TABLE_NAME,
    IndexName: 'gsi1',
    KeyConditionExpression: 'gsi1pk = :pk and begins_with(gsi1sk, :sk)',
    ExpressionAttributeValues: { ':pk': playerKey(playerId), ':sk': 'INVITE#' },
  }));
  return ((response.Items as InviteItem[] | undefined) ?? []).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function listReceivedInvites(email: string): Promise<InviteItem[]> {
  try {
    const response = await dynamo.send(new QueryCommand({
      TableName: APP_DATA_TABLE_NAME,
      IndexName: 'gsi2',
      KeyConditionExpression: 'gsi2pk = :pk and begins_with(gsi2sk, :sk)',
      ExpressionAttributeValues: { ':pk': invitedEmailKey(email.toLowerCase()), ':sk': 'STATUS#pending#' },
    }));
    return ((response.Items as InviteItem[] | undefined) ?? []).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch (error) {
    console.warn('Received invite query skipped.', error);
    return [];
  }
}

async function getInvite(inviteId: string): Promise<InviteItem | null> {
  const response = await dynamo.send(new GetCommand({ TableName: APP_DATA_TABLE_NAME, Key: { pk: inviteKey(inviteId), sk: 'PROFILE' } }));
  return (response.Item as InviteItem | undefined) ?? null;
}

async function saveInvite(invite: InviteItem): Promise<void> {
  await dynamo.send(new PutCommand({ TableName: APP_DATA_TABLE_NAME, Item: invite }));
}

async function scanAll<T>(
  entityType: 'Player' | 'Invite' | 'UserProfile' | 'PlayerEvaluation',
): Promise<T[]> {
  const items: T[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await dynamo.send(new ScanCommand({
      TableName: APP_DATA_TABLE_NAME,
      ExclusiveStartKey: exclusiveStartKey,
      FilterExpression: 'entityType = :entityType',
      ExpressionAttributeValues: {
        ':entityType': entityType,
      },
    }));

    items.push(...(((response.Items as T[] | undefined) ?? [])));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return items;
}

function normalizeAccessItem(item: AppAccessItem | undefined): ResolvedAccess {
  const fallbackRoles = extractCurrentOrganizationRoles(item, true);
  const organizationMemberships = extractOrganizationMemberships(item, true);
  const currentMembership = organizationMemberships.find((membership) => membership.organizationId === ORGANIZATION_ID);

  return {
    currentRoles: currentMembership?.roles ?? fallbackRoles,
    organizationMemberships:
      organizationMemberships.length > 0
        ? organizationMemberships
        : fallbackRoles.length > 0
          ? [{ organizationId: ORGANIZATION_ID, roles: fallbackRoles }]
          : [],
  };
}

function upsertOrganizationMembership(
  memberships: ResolvedAccess['organizationMemberships'],
  organizationId: string,
  roles: AppRole[],
): ResolvedAccess['organizationMemberships'] {
  const nextMembership = {
    organizationId,
    roles: [...new Set<AppRole>(roles)],
  };

  const remainingMemberships = memberships.filter(
    (membership) => membership.organizationId !== organizationId,
  );

  return [...remainingMemberships, nextMembership];
}

function serializeAdminUser(
  profile: UserProfileItem,
  access: AppAccessItem | undefined | null,
): AdminUserDirectoryEntry {
  const storedOrganizationRoles = normalizeAdminOrganizationRoles(
    extractStoredCurrentRoles(access ?? undefined).filter(
      (role): role is 'club-admin' | 'coach' => role === 'club-admin' || role === 'coach',
    ),
  );
  return {
    userId: profile.userId,
    email: profile.email,
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    contactEmail: profile.contactEmail ?? '',
    phoneNumber: profile.phoneNumber ?? '',
    smsOptIn: profile.smsOptIn ?? false,
    primaryRole: profile.primaryRole ?? null,
    organizationRoles: storedOrganizationRoles,
    assignedRoles: getAssignedRolesForDirectory(profile, access ?? undefined),
    accountStatus: profile.accountStatus ?? access?.status ?? 'ACTIVE',
    createdAt: profile.createdAt ?? null,
    updatedAt: profile.updatedAt ?? null,
  };
}

function getAssignedRolesForDirectory(
  profile: UserProfileItem,
  access: AppAccessItem | undefined,
): AppRole[] {
  const primaryRoles = profile.primaryRole ? [profile.primaryRole] : [];
  return [...new Set<AppRole>([...primaryRoles, ...extractStoredCurrentRoles(access)])];
}

function matchesAdminUserFilters(
  entry: AdminUserDirectoryEntry,
  filters: {
    searchQuery: string;
    primaryRole: PrimaryRole | null;
    accountStatus: AccountStatus | null;
    assignedRole: AppRole | null;
  },
): boolean {
  if (filters.primaryRole && entry.primaryRole !== filters.primaryRole) return false;
  if (filters.accountStatus && entry.accountStatus !== filters.accountStatus) return false;
  if (filters.assignedRole && !entry.assignedRoles.includes(filters.assignedRole)) return false;

  if (!filters.searchQuery) return true;

  const haystack = [
    entry.firstName,
    entry.lastName,
    buildPlayerName(entry.firstName, entry.lastName),
    entry.email,
    entry.contactEmail,
    entry.phoneNumber,
    ...entry.assignedRoles.map((role) => ROLE_LABELS_FOR_SEARCH[role]),
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(filters.searchQuery);
}

function compareAdminUsers(left: AdminUserDirectoryEntry, right: AdminUserDirectoryEntry): number {
  if (left.accountStatus !== right.accountStatus) {
    return left.accountStatus === 'ACTIVE' ? -1 : 1;
  }

  const leftName = `${left.lastName} ${left.firstName}`.trim().toLowerCase() || left.email.toLowerCase();
  const rightName = `${right.lastName} ${right.firstName}`.trim().toLowerCase() || right.email.toLowerCase();
  return leftName.localeCompare(rightName);
}

function normalizePrimaryRoleFilter(value: string | undefined): PrimaryRole | null {
  if (value === 'parent' || value === 'player' || value === 'staff') return value;
  return null;
}

function normalizeAssignedRoleFilter(value: string | undefined): AppRole | null {
  if (
    value === 'parent' ||
    value === 'player' ||
    value === 'staff' ||
    value === 'coach' ||
    value === 'club-admin' ||
    value === 'manager' ||
    value === 'platform-admin'
  ) {
    return value;
  }
  return null;
}

function normalizeAccountStatusFilter(value: string | undefined): AccountStatus | null {
  if (value === 'ACTIVE' || value === 'DISABLED') return value;
  return null;
}

function normalizeAdminOrganizationRoles(
  roles: unknown,
): Array<'club-admin' | 'coach'> {
  if (!Array.isArray(roles)) return [];

  const nextRoles = roles.filter(
    (role): role is 'club-admin' | 'coach' => role === 'club-admin' || role === 'coach',
  );
  return [...new Set(nextRoles)];
}

function normalizeAccountStatus(value: unknown): AccountStatus {
  if (value === 'ACTIVE' || value === 'DISABLED') return value;
  throw badRequest('Account status must be ACTIVE or DISABLED.');
}

function clampPageSize(value: number): number {
  if (!Number.isFinite(value)) return 12;
  return Math.min(50, Math.max(5, Math.trunc(value)));
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;

  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      offset?: unknown;
    };
    if (typeof payload.offset !== 'number' || !Number.isFinite(payload.offset) || payload.offset < 0) {
      throw new Error('Invalid cursor');
    }
    return Math.trunc(payload.offset);
  } catch {
    throw badRequest('Cursor is invalid.');
  }
}

async function assertUserIsActive(userId: string): Promise<void> {
  const [profile, access] = await Promise.all([getUserProfile(userId), getAccessItem(userId)]);
  const accountStatus = profile?.accountStatus ?? access?.status ?? 'ACTIVE';
  if (accountStatus === 'DISABLED') {
    throw forbidden('This account has been disabled. Contact a club administrator.');
  }
}

async function assertCanManageOrganization(userId: string): Promise<void> {
  const resolvedAccess = await resolveAccess(userId);
  if (!resolvedAccess.currentRoles.includes('club-admin') && !resolvedAccess.currentRoles.includes('platform-admin')) {
    throw forbidden('Only organization admins can manage portal users.');
  }
}

async function assertCanManageTryouts(userId: string): Promise<void> {
  const [resolvedAccess, userProfile] = await Promise.all([
    resolveAccess(userId),
    getUserProfile(userId),
  ]);

  const canManage =
    resolvedAccess.currentRoles.includes('club-admin') ||
    resolvedAccess.currentRoles.includes('platform-admin') ||
    resolvedAccess.currentRoles.includes('coach') ||
    resolvedAccess.currentRoles.includes('manager') ||
    userProfile?.primaryRole === 'staff';

  if (!canManage) {
    throw forbidden('Only coaching staff can manage tryout planning.');
  }
}

function getManagedAccessRoles(
  existingAccess: AppAccessItem | undefined,
  nextPrimaryRole: PrimaryRole,
  nextOrganizationRoles: Array<'club-admin' | 'coach'>,
): AppRole[] {
  const preservedRoles = extractStoredCurrentRoles(existingAccess).filter(
    (role) => role === 'manager' || role === 'platform-admin',
  );
  const familyRoles =
    nextPrimaryRole === 'parent' || nextPrimaryRole === 'player'
      ? [nextPrimaryRole]
      : [];
  return [...new Set<AppRole>([...preservedRoles, ...familyRoles, ...nextOrganizationRoles])];
}

async function saveManagedAccessRoles(
  userId: string,
  grantedBy: string,
  nextPrimaryRole: PrimaryRole,
  nextOrganizationRoles: Array<'club-admin' | 'coach'>,
  nextAccountStatus: AccountStatus,
): Promise<void> {
  if (!APP_ACCESS_TABLE_NAME) return;

  const existingAccess = await getAccessItem(userId);
  const roles = getManagedAccessRoles(existingAccess ?? undefined, nextPrimaryRole, nextOrganizationRoles);
  const now = new Date().toISOString();

  await dynamo.send(
    new PutCommand({
      TableName: APP_ACCESS_TABLE_NAME,
      Item: {
        userId,
        appKey: APP_KEY,
        roles,
        organizationMemberships: upsertOrganizationMembership(
          extractOrganizationMemberships(existingAccess ?? undefined, false),
          ORGANIZATION_ID,
          roles,
        ),
        status: nextAccountStatus,
        grantedAt: existingAccess?.grantedAt ?? now,
        grantedBy: existingAccess?.grantedBy ?? grantedBy,
      } satisfies AppAccessItem,
    }),
  );
}

async function reconcileUserLinksForPrimaryRole(
  userId: string,
  nextPrimaryRole: PrimaryRole,
): Promise<void> {
  if (nextPrimaryRole !== 'parent' && nextPrimaryRole !== 'player') return;

  const links = await listUserPlayerLinks(userId);
  if (links.length === 0) return;

  if (nextPrimaryRole === 'player') {
    if (links.length > 1) {
      throw conflict('A player account can only be linked to one player record.');
    }

    const currentPlayerLinks = await listPlayerLinks(links[0].playerId);
    if (currentPlayerLinks.some((link) => link.userId !== userId && link.relationship === 'player')) {
      throw conflict('That player record is already linked to a player account.');
    }
  }

  const updatedLinks = links
    .filter((link) => link.relationship !== nextPrimaryRole)
    .map((link) => ({
      ...link,
      relationship: nextPrimaryRole,
    }));

  if (updatedLinks.length === 0) return;

  await Promise.all(
    updatedLinks.map((link) =>
      dynamo.send(new PutCommand({ TableName: APP_DATA_TABLE_NAME, Item: link })),
    ),
  );
}

async function ensureOrganizationAdminCoverage(
  targetUserId: string,
  existingAccountStatus: AccountStatus,
  existingAssignedRoles: AppRole[],
  nextAssignedRoles: AppRole[],
  nextAccountStatus: AccountStatus,
): Promise<void> {
  const currentlyActiveAdmin =
    existingAccountStatus === 'ACTIVE' && hasAdminRole(existingAssignedRoles);
  const remainsActiveAdmin = nextAccountStatus === 'ACTIVE' && hasAdminRole(nextAssignedRoles);

  if (!currentlyActiveAdmin || remainsActiveAdmin) return;
  if (await hasAnotherActiveOrganizationAdmin(targetUserId)) return;

  throw conflict('At least one active organization admin must remain assigned.');
}

async function hasAnotherActiveOrganizationAdmin(excludedUserId: string): Promise<boolean> {
  if (!APP_ACCESS_TABLE_NAME) return false;

  const response = await dynamo.send(
    new QueryCommand({
      TableName: APP_ACCESS_TABLE_NAME,
      IndexName: 'by-app',
      KeyConditionExpression: 'appKey = :appKey',
      ExpressionAttributeValues: {
        ':appKey': APP_KEY,
      },
    }),
  );

  const items = (response.Items as AppAccessItem[] | undefined) ?? [];
  return items.some((item) => {
    if (item.userId === excludedUserId) return false;
    return hasAdminRole(normalizeAccessItem(item).currentRoles);
  });
}

function hasAdminRole(roles: AppRole[]): boolean {
  return roles.includes('club-admin') || roles.includes('platform-admin');
}

function extractOrganizationMemberships(
  item: AppAccessItem | undefined,
  respectStatus: boolean,
): ResolvedAccess['organizationMemberships'] {
  if (!item) return [];
  if (respectStatus && item.status !== 'ACTIVE') return [];
  if (!Array.isArray(item.organizationMemberships)) return [];

  return item.organizationMemberships
    .filter(
      (membership): membership is { organizationId: string; roles: AppRole[] } =>
        Boolean(membership) &&
        typeof membership.organizationId === 'string' &&
        Array.isArray(membership.roles),
    )
    .map((membership) => ({
      organizationId: membership.organizationId,
      roles: membership.roles.filter(
        (role): role is AppRole => typeof role === 'string' && Boolean(role),
      ),
    }));
}

function extractCurrentOrganizationRoles(
  item: AppAccessItem | undefined,
  respectStatus: boolean,
): AppRole[] {
  if (!item) return [];
  if (respectStatus && item.status !== 'ACTIVE') return [];

  const fallbackRoles = Array.isArray(item.roles)
    ? item.roles.filter((role): role is AppRole => typeof role === 'string' && Boolean(role))
    : [];
  const memberships = extractOrganizationMemberships(item, respectStatus);
  const currentMembership = memberships.find((membership) => membership.organizationId === ORGANIZATION_ID);
  return [...new Set<AppRole>(currentMembership?.roles ?? fallbackRoles)];
}

function extractStoredCurrentRoles(item: AppAccessItem | undefined): AppRole[] {
  return extractCurrentOrganizationRoles(item, false);
}

const ROLE_LABELS_FOR_SEARCH: Record<AppRole, string> = {
  parent: 'parent',
  player: 'player',
  staff: 'staff',
  coach: 'coach',
  manager: 'manager',
  'club-admin': 'organization admin',
  'platform-admin': 'platform admin',
};

function serializeOrganization(organization: OrganizationItem): OrganizationOverview {
  return {
    id: organization.organizationId,
    name: organization.name,
    shortName: organization.shortName,
    website: organization.website,
    logoUrl: organization.logoUrl,
    primaryColor: organization.primaryColor,
    secondaryColor: organization.secondaryColor,
    tryoutWindowLabel: organization.tryoutWindowLabel,
    tryoutWindowStart: organization.tryoutWindowStart,
    tryoutWindowEnd: organization.tryoutWindowEnd,
    tryoutBirthYearYoungest:
      organization.tryoutBirthYearYoungest ??
      defaultOrganization.tryoutBirthYearYoungest,
    tryoutBirthYearOldest:
      organization.tryoutBirthYearOldest ??
      defaultOrganization.tryoutBirthYearOldest,
    intakeIntro: organization.intakeIntro,
  };
}

function sanitizeOrganizationSettings(
  payload: OrganizationSettingsInput,
  existing: OrganizationItem | null,
): Omit<OrganizationItem, 'pk' | 'sk' | 'entityType' | 'organizationId' | 'createdAt' | 'updatedAt' | 'updatedByUserId'> {
  const base = existing ? serializeOrganization(existing) : defaultOrganization;
  const tryoutBirthYearRange = sanitizeTryoutBirthYearRange(
    payload.tryoutBirthYearYoungest,
    payload.tryoutBirthYearOldest,
    base.tryoutBirthYearYoungest,
    base.tryoutBirthYearOldest,
  );

  return {
    name: sanitizeRequiredText(payload.name, base.name, 'Organization name'),
    shortName: sanitizeRequiredText(payload.shortName, base.shortName, 'Organization short name'),
    website: sanitizeRequiredText(payload.website, base.website, 'Organization website'),
    logoUrl: sanitizeRequiredText(payload.logoUrl, base.logoUrl, 'Organization logo URL'),
    primaryColor: sanitizeColor(payload.primaryColor, base.primaryColor, 'Primary color'),
    secondaryColor: sanitizeColor(payload.secondaryColor, base.secondaryColor, 'Secondary color'),
    tryoutWindowLabel: sanitizeRequiredText(payload.tryoutWindowLabel, base.tryoutWindowLabel, 'Tryout window label'),
    tryoutWindowStart: sanitizeDate(payload.tryoutWindowStart, base.tryoutWindowStart, 'Tryout window start'),
    tryoutWindowEnd: sanitizeDate(payload.tryoutWindowEnd, base.tryoutWindowEnd, 'Tryout window end'),
    tryoutBirthYearYoungest: tryoutBirthYearRange.youngest,
    tryoutBirthYearOldest: tryoutBirthYearRange.oldest,
    intakeIntro: sanitizeRequiredText(payload.intakeIntro, base.intakeIntro, 'Intake introduction'),
  };
}

function sanitizeEvaluationCriteria(
  criteria: unknown,
  fallback: EvaluationCriterion[] = [],
): EvaluationCriterion[] {
  const sourceCriteria =
    criteria === undefined
      ? fallback
      : Array.isArray(criteria)
        ? criteria
        : null;

  if (!sourceCriteria) {
    throw badRequest('Evaluation criteria must be provided as a list.');
  }

  const sanitizedCriteria = sourceCriteria.map((criterion, index) =>
    sanitizeEvaluationCriterion(criterion, index),
  );

  if (sanitizedCriteria.length === 0) {
    throw badRequest('At least one evaluation criterion is required.');
  }

  return sanitizedCriteria;
}

function sanitizeEvaluationScores(
  value: unknown,
  criteria: EvaluationCriterion[],
  fallback: Record<string, EvaluationScoreValue | null> = {},
): Record<string, EvaluationScoreValue | null> {
  const source = value === undefined ? fallback : asRecord(value);
  const criterionIds = new Set(criteria.map((criterion) => criterion.id));
  const scores: Record<string, EvaluationScoreValue | null> = {};

  criteria.forEach((criterion) => {
    const rawValue = source[criterion.id];
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      scores[criterion.id] = null;
      return;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 5) {
      throw badRequest(`Evaluation score for "${criterion.title}" must be a whole number from 1 to 5.`);
    }

    scores[criterion.id] = parsedValue as EvaluationScoreValue;
  });

  Object.keys(source).forEach((criterionId) => {
    if (!criterionIds.has(criterionId)) {
      throw badRequest(`Unknown evaluation criterion "${criterionId}".`);
    }
  });

  return scores;
}

function sanitizeEvaluationNotes(
  value: unknown,
  fallback: EvaluationNote[] = [],
): EvaluationNote[] {
  const source =
    value === undefined ? fallback : Array.isArray(value) ? value : null;

  if (!source) {
    throw badRequest('Evaluation notes must be provided as a list.');
  }

  const existingNotes = new Map(fallback.map((note) => [note.id, note]));
  const seenIds = new Set<string>();

  return source
    .map((note) => {
      const record = asRecord(note);
      const noteId = sanitizeIdentifier(record.id);
      const text = sanitizeFreeText(record.text);
      if (!text) return null;
      if (seenIds.has(noteId)) {
        throw badRequest('Evaluation notes must have unique ids.');
      }
      seenIds.add(noteId);

      const existing = existingNotes.get(noteId);
      return {
        id: noteId,
        text,
        createdAt: existing?.createdAt ?? sanitizeTimestamp(record.createdAt),
        updatedAt: existing && existing.text === text
          ? existing.updatedAt
          : new Date().toISOString(),
      } satisfies EvaluationNote;
    })
    .filter((note): note is EvaluationNote => Boolean(note))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function sanitizeTryoutGroups(
  groups: unknown,
  fallback: TryoutGroup[] = [],
  allowedBirthYears: ReadonlySet<string> | null = null,
): TryoutGroup[] {
  const sourceGroups =
    groups === undefined ? fallback : Array.isArray(groups) ? groups : null;
  if (!sourceGroups) {
    throw badRequest('Tryout groups must be provided as a list.');
  }

  const seenIds = new Set<string>();
  return sourceGroups.map((group, index) => {
    const record = asRecord(group);
    const sanitizedGroup: TryoutGroup = {
      id: sanitizeIdentifier(record.id),
      name: sanitizeRequiredText(
        typeof record.name === 'string' ? record.name : undefined,
        `Group ${index + 1}`,
        `Tryout group ${index + 1} name`,
      ),
      allowedBirthYears: sanitizeTryoutBirthYears(
        record.allowedBirthYears,
        allowedBirthYears,
      ),
      allowedGenders: sanitizeTryoutGenders(record.allowedGenders),
    };

    if (seenIds.has(sanitizedGroup.id)) {
      throw badRequest('Tryout groups must have unique ids.');
    }
    seenIds.add(sanitizedGroup.id);
    return sanitizedGroup;
  });
}

function sanitizeTryoutBirthYears(
  value: unknown,
  allowedBirthYears: ReadonlySet<string> | null = null,
): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((entry) => sanitizeYearField(entry, '', 'Birth year'))
      .filter((entry) =>
        allowedBirthYears ? allowedBirthYears.has(entry) : true,
      )
      .filter(Boolean),
  )].sort((left, right) => Number(right) - Number(left));
}

function sanitizeTryoutGenders(value: unknown): TryoutGender[] {
  if (!Array.isArray(value)) return [];
  const genders = value.filter(
    (entry): entry is TryoutGender =>
      entry === 'Male' ||
      entry === 'Female' ||
      entry === 'Non-binary' ||
      entry === 'Prefer not to say',
  );
  return [...new Set(genders)];
}

function sanitizeTryoutTeams(
  teams: unknown,
  groups: TryoutGroup[],
  fallback: TryoutTeam[] = [],
): TryoutTeam[] {
  const sourceTeams =
    teams === undefined ? fallback : Array.isArray(teams) ? teams : null;
  if (!sourceTeams) {
    throw badRequest('Tryout teams must be provided as a list.');
  }

  const validGroupIds = new Set(groups.map((group) => group.id));
  const seenIds = new Set<string>();

  return sourceTeams.map((team, index) => {
    const record = asRecord(team);
    const fallbackColor = normalizeTryoutTeamColor(
      fallback[index]?.jerseyColor,
      getDefaultTryoutTeamColor(
        typeof record.name === 'string' ? record.name : fallback[index]?.name ?? '',
        index,
      ),
    );
    const sanitizedTeam: TryoutTeam = {
      id: sanitizeIdentifier(record.id),
      groupId: sanitizeFreeText(record.groupId),
      name: sanitizeRequiredText(
        typeof record.name === 'string' ? record.name : undefined,
        `Team ${index + 1}`,
        `Tryout team ${index + 1} name`,
      ),
      jerseyColor: sanitizeColor(
        typeof record.jerseyColor === 'string' ? record.jerseyColor : undefined,
        fallbackColor,
        `Tryout team ${index + 1} jersey color`,
      ),
    };

    if (!validGroupIds.has(sanitizedTeam.groupId)) {
      throw badRequest(`Tryout team "${sanitizedTeam.name}" must belong to a valid group.`);
    }
    if (seenIds.has(sanitizedTeam.id)) {
      throw badRequest('Tryout teams must have unique ids.');
    }
    seenIds.add(sanitizedTeam.id);
    return sanitizedTeam;
  });
}

function sanitizeTryoutSessions(
  sessions: unknown,
  teams: TryoutTeam[],
  fallback: TryoutSession[] = [],
): TryoutSession[] {
  const sourceSessions =
    sessions === undefined ? fallback : Array.isArray(sessions) ? sessions : null;
  if (!sourceSessions) {
    throw badRequest('Tryout sessions must be provided as a list.');
  }

  const validTeamIds = new Set(teams.map((team) => team.id));
  const seenIds = new Set<string>();

  return sourceSessions.map((session, index) => {
    const record = asRecord(session);
    const teamIds = Array.isArray(record.teamIds)
      ? [...new Set(
          record.teamIds
            .map((teamId) => sanitizeFreeText(teamId))
            .filter((teamId) => validTeamIds.has(teamId)),
        )]
      : [];

    const sanitizedSession: TryoutSession = {
      id: sanitizeIdentifier(record.id),
      name: sanitizeRequiredText(
        typeof record.name === 'string' ? record.name : undefined,
        `Session ${index + 1}`,
        `Tryout session ${index + 1} name`,
      ),
      teamIds,
      evaluationTemplateId: sanitizeOptionalIdentifier(record.evaluationTemplateId),
    };

    if (seenIds.has(sanitizedSession.id)) {
      throw badRequest('Tryout sessions must have unique ids.');
    }
    seenIds.add(sanitizedSession.id);
    return sanitizedSession;
  });
}

function sanitizeTryoutPlayerOverrides(
  overrides: unknown,
  validPlayerIds: Set<string>,
  groups: TryoutGroup[],
  teams: TryoutTeam[],
  fallback: TryoutPlayerOverride[] = [],
): TryoutPlayerOverride[] {
  const sourceOverrides =
    overrides === undefined ? fallback : Array.isArray(overrides) ? overrides : null;
  if (!sourceOverrides) {
    throw badRequest('Tryout player overrides must be provided as a list.');
  }

  const validGroupIds = new Set(groups.map((group) => group.id));
  const validTeamIds = new Set(teams.map((team) => team.id));
  const seenPlayerIds = new Set<string>();

  return sourceOverrides
    .map((override) => {
      const record = asRecord(override);
      const playerId = sanitizeFreeText(record.playerId);
      if (!playerId || !validPlayerIds.has(playerId) || seenPlayerIds.has(playerId)) {
        return null;
      }
      seenPlayerIds.add(playerId);

      const assignmentMode = sanitizeTryoutAssignmentMode(record.assignmentMode);
      const groupId = sanitizeFreeText(record.groupId) || null;
      const teamId = sanitizeFreeText(record.teamId) || null;

      if (assignmentMode === 'manual' && (!groupId || !validGroupIds.has(groupId))) {
        throw badRequest('Manual player assignments must reference a valid tryout group.');
      }

      return {
        playerId,
        assignmentMode,
        groupId:
          assignmentMode === 'manual' && groupId && validGroupIds.has(groupId)
            ? groupId
            : null,
        teamId: teamId && validTeamIds.has(teamId) ? teamId : null,
        jerseyNumber: sanitizeFreeText(record.jerseyNumber),
      } satisfies TryoutPlayerOverride;
    })
    .filter((override): override is TryoutPlayerOverride => {
      if (!override) return false;
      return override.assignmentMode !== 'default' ||
        override.groupId !== null ||
        override.teamId !== null ||
        override.jerseyNumber !== '';
    });
}

function sanitizeTryoutAssignmentMode(value: unknown): TryoutPlayerAssignmentMode {
  if (value === 'manual' || value === 'unassigned') return value;
  return 'default';
}

function sanitizeEvaluationCriterion(
  value: unknown,
  index: number,
): EvaluationCriterion {
  const record = asRecord(value);
  const criterionNumber = index + 1;

  return {
    id: sanitizeIdentifier(record.id),
    title: sanitizeRequiredText(
      typeof record.title === 'string' ? record.title : undefined,
      `Criterion ${criterionNumber}`,
      `Criterion ${criterionNumber} title`,
    ),
    weight: sanitizeCriterionWeight(record.weight, 50),
    score1Description: sanitizeRequiredText(
      typeof record.score1Description === 'string' ? record.score1Description : undefined,
      'Describe what a score of 1 looks like.',
      `Criterion ${criterionNumber} score 1 description`,
    ),
    score3Description: sanitizeRequiredText(
      typeof record.score3Description === 'string' ? record.score3Description : undefined,
      'Describe what a score of 3 looks like.',
      `Criterion ${criterionNumber} score 3 description`,
    ),
    score5Description: sanitizeRequiredText(
      typeof record.score5Description === 'string' ? record.score5Description : undefined,
      'Describe what a score of 5 looks like.',
      `Criterion ${criterionNumber} score 5 description`,
    ),
  };
}

function sanitizeCriterionWeight(value: unknown, fallback: number): number {
  const nextValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : fallback;

  if (!Number.isFinite(nextValue)) {
    throw badRequest('Criterion weight must be a number between 1 and 100.');
  }

  const normalizedWeight = Math.trunc(nextValue);
  if (normalizedWeight < 1 || normalizedWeight > 100) {
    throw badRequest('Criterion weight must be a whole number between 1 and 100.');
  }

  return normalizedWeight;
}

function sanitizeProfile(
  profile: PlayerProfileInput | undefined,
  fallbackEmail: string,
  currentRole: UserRole,
  userProfile: UserProfileItem | null = null,
  existingProfile?: PlayerProfileInput,
): PlayerProfileInput {
  const normalizedExisting = existingProfile
    ? normalizePlayerProfile(
        existingProfile,
        userProfile?.contactEmail || fallbackEmail,
        currentRole,
        userProfile,
      )
    : null;
  const normalizedInput = normalizePlayerProfile(
    profile,
    userProfile?.contactEmail || fallbackEmail,
    currentRole,
    userProfile,
  );

  const firstName = normalizedInput.firstName || normalizedExisting?.firstName || '';
  const lastName = normalizedInput.lastName || normalizedExisting?.lastName || '';
  const teamHistory = sortTeamHistory(
    normalizeTeamHistory(
      normalizedInput.teamHistory.length > 0
        ? normalizedInput.teamHistory
        : normalizedExisting?.teamHistory ?? [],
    ),
  );
  const latestTeamEntry = getMostRecentTeamHistoryEntry(teamHistory);
  const primaryPosition =
    normalizedInput.primaryPosition || normalizedExisting?.primaryPosition || '';
  const currentTeam = sanitizeFreeText(
    normalizedInput.currentTeam,
    normalizedExisting?.currentTeam || latestTeamEntry?.teamName || '',
  );
  const positions = sanitizeFreeText(
    normalizedInput.positions,
    normalizedExisting?.positions || primaryPosition,
  );
  const bestContactEmail = sanitizeEmailField(
    normalizedInput.bestContactEmail,
    normalizedExisting?.bestContactEmail || userProfile?.contactEmail || fallbackEmail,
    'Player contact email',
  );
  const phoneNumber = sanitizePhoneNumber(
    normalizedInput.phoneNumber,
    normalizedExisting?.phoneNumber || '',
  );
  const smsOptIn =
    normalizedInput.smsOptIn ?? normalizedExisting?.smsOptIn ?? false;

  if (smsOptIn && !phoneNumber) {
    throw badRequest('Add a phone number before enabling text notifications.');
  }

  const physicalHistory = normalizePhysicalHistory(
    normalizedInput.physicalHistory.length > 0
      ? normalizedInput.physicalHistory
      : normalizedExisting?.physicalHistory ?? [],
    {
      heightFeet:
        normalizedInput.latestHeightFeet || normalizedExisting?.latestHeightFeet || '',
      heightInches:
        normalizedInput.latestHeightInches || normalizedExisting?.latestHeightInches || '',
      weightPounds:
        normalizedInput.latestWeightPounds || normalizedExisting?.latestWeightPounds || '',
    },
  );
  const latestPhysical = physicalHistory[physicalHistory.length - 1];
  const playerName =
    buildPlayerName(firstName, lastName) ||
    normalizedInput.playerName ||
    normalizedExisting?.playerName ||
    '';

  return {
    playerName,
    firstName,
    lastName,
    birthYear: sanitizeYearField(
      normalizedInput.birthYear,
      normalizedExisting?.birthYear || '',
      'Birth year',
    ),
    gender: sanitizeFreeText(normalizedInput.gender, normalizedExisting?.gender || ''),
    primaryPosition,
    handedness: sanitizeFreeText(
      normalizedInput.handedness,
      normalizedExisting?.handedness || '',
    ),
    firstYearPlayingHockey: sanitizeYearField(
      normalizedInput.firstYearPlayingHockey,
      normalizedExisting?.firstYearPlayingHockey || '',
      'First year playing hockey',
    ),
    currentTeam,
    positions,
    completedBy: sanitizeCompletedBy(
      normalizedInput.completedBy || normalizedExisting?.completedBy,
      currentRole,
    ),
    bestContactEmail,
    phoneNumber,
    smsOptIn,
    teamHistory,
    latestHeightFeet: latestPhysical?.heightFeet || '',
    latestHeightInches: latestPhysical?.heightInches || '',
    latestWeightPounds: latestPhysical?.weightPounds || '',
    physicalHistory,
  };
}

function normalizePlayerProfile(
  profile: unknown,
  fallbackEmail: string,
  currentRole: UserRole = 'parent',
  userProfile: UserProfileItem | null = null,
): PlayerProfileInput {
  const record = asRecord(profile);
  const firstName = sanitizeFreeText(record.firstName, userProfile?.firstName ?? '');
  const lastName = sanitizeFreeText(record.lastName, userProfile?.lastName ?? '');
  const primaryPosition = sanitizeFreeText(
    record.primaryPosition,
    sanitizeFreeText(record.positions),
  );
  const teamHistory = sortTeamHistory(normalizeTeamHistory(record.teamHistory));
  const latestTeamEntry = getMostRecentTeamHistoryEntry(teamHistory);
  const physicalHistory = normalizePhysicalHistory(record.physicalHistory, {
    heightFeet: sanitizeFreeText(record.latestHeightFeet),
    heightInches: sanitizeFreeText(record.latestHeightInches),
    weightPounds: sanitizeFreeText(record.latestWeightPounds),
  });
  const latestPhysical = physicalHistory[physicalHistory.length - 1];

  return {
    playerName: sanitizeFreeText(
      record.playerName,
      buildPlayerName(firstName, lastName),
    ),
    firstName,
    lastName,
    birthYear: sanitizeFreeText(record.birthYear),
    gender: sanitizeFreeText(record.gender),
    primaryPosition,
    handedness: sanitizeFreeText(record.handedness),
    firstYearPlayingHockey: sanitizeFreeText(record.firstYearPlayingHockey),
    currentTeam: sanitizeFreeText(record.currentTeam, latestTeamEntry?.teamName ?? ''),
    positions: sanitizeFreeText(record.positions, primaryPosition),
    completedBy: sanitizeCompletedBy(
      record.completedBy as PlayerProfileInput['completedBy'] | undefined,
      currentRole,
    ),
    bestContactEmail: sanitizeFreeText(
      record.bestContactEmail,
      userProfile?.contactEmail || fallbackEmail,
    ),
    phoneNumber: sanitizeFreeText(record.phoneNumber, userProfile?.phoneNumber ?? ''),
    smsOptIn: typeof record.smsOptIn === 'boolean' ? record.smsOptIn : userProfile?.smsOptIn ?? false,
    teamHistory,
    latestHeightFeet: sanitizeFreeText(record.latestHeightFeet, latestPhysical?.heightFeet ?? ''),
    latestHeightInches: sanitizeFreeText(record.latestHeightInches, latestPhysical?.heightInches ?? ''),
    latestWeightPounds: sanitizeFreeText(record.latestWeightPounds, latestPhysical?.weightPounds ?? ''),
    physicalHistory,
  };
}

function normalizeTeamHistory(history: unknown): PlayerTeamHistoryEntry[] {
  if (!Array.isArray(history)) return [];

  return history
    .map((entry) => {
      const record = asRecord(entry);
      const seasonLabel = sanitizeSeasonLabel(record.seasonLabel);
      const teamName = sanitizeFreeText(record.teamName);
      const positionPlayed = sanitizeFreeText(record.positionPlayed);

      if (!seasonLabel && !teamName && !positionPlayed) return null;

      return {
        id: sanitizeIdentifier(record.id),
        seasonLabel,
        teamName,
        positionPlayed,
      } satisfies PlayerTeamHistoryEntry;
    })
    .filter((entry): entry is PlayerTeamHistoryEntry => Boolean(entry));
}

function sortTeamHistory(
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

function getMostRecentTeamHistoryEntry(
  entries: PlayerTeamHistoryEntry[],
): PlayerTeamHistoryEntry | null {
  return [...entries]
    .filter((entry) => parseSeasonStartYear(entry.seasonLabel) !== Number.MAX_SAFE_INTEGER)
    .sort(
      (left, right) =>
        parseSeasonStartYear(right.seasonLabel) - parseSeasonStartYear(left.seasonLabel),
    )[0] ?? null;
}

function normalizePhysicalHistory(
  history: unknown,
  latest: {
    heightFeet: string;
    heightInches: string;
    weightPounds: string;
  },
): PlayerPhysicalEntry[] {
  const existingEntries = Array.isArray(history)
    ? history
        .map((entry) => {
          const record = asRecord(entry);
          const heightFeet = sanitizeMeasurement(record.heightFeet);
          const heightInches = sanitizeMeasurement(record.heightInches);
          const weightPounds = sanitizeMeasurement(record.weightPounds);

          if (!heightFeet && !heightInches && !weightPounds) return null;

          return {
            id: sanitizeIdentifier(record.id),
            recordedAt: sanitizeTimestamp(record.recordedAt),
            heightFeet,
            heightInches,
            weightPounds,
          } satisfies PlayerPhysicalEntry;
        })
        .filter((entry): entry is PlayerPhysicalEntry => Boolean(entry))
        .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt))
    : [];

  const nextHeightFeet = sanitizeMeasurement(latest.heightFeet);
  const nextHeightInches = sanitizeMeasurement(latest.heightInches);
  const nextWeightPounds = sanitizeMeasurement(latest.weightPounds);
  const hasLatestMeasurement = Boolean(
    nextHeightFeet || nextHeightInches || nextWeightPounds,
  );

  if (!hasLatestMeasurement) {
    return existingEntries;
  }

  const latestExisting = existingEntries[existingEntries.length - 1];
  const hasChanged =
    !latestExisting ||
    latestExisting.heightFeet !== nextHeightFeet ||
    latestExisting.heightInches !== nextHeightInches ||
    latestExisting.weightPounds !== nextWeightPounds;

  if (!hasChanged) {
    return existingEntries;
  }

  return [
    ...existingEntries,
    {
      id: randomUUID(),
      recordedAt: new Date().toISOString(),
      heightFeet: nextHeightFeet,
      heightInches: nextHeightInches,
      weightPounds: nextWeightPounds,
    },
  ];
}

function sanitizeCompletedBy(value: PlayerProfileInput['completedBy'] | undefined, currentRole: UserRole): PlayerProfileInput['completedBy'] {
  if (value === 'Player' || value === 'Parent / Guardian' || value === 'Player and Parent together') return value;
  return currentRole === 'player' ? 'Player' : 'Parent / Guardian';
}

function sanitizeAnswers(answers: IntakeAnswers | undefined): IntakeAnswers {
  return {
    nextSeasonOutcome: typeof answers?.nextSeasonOutcome === 'string' ? answers.nextSeasonOutcome.trim() : '',
    developmentSetting: typeof answers?.developmentSetting === 'string' ? answers.developmentSetting.trim() : '',
    preferredRole: typeof answers?.preferredRole === 'string' ? answers.preferredRole.trim() : '',
    coachingStyle: typeof answers?.coachingStyle === 'string' ? answers.coachingStyle.trim() : '',
    participationConsiderations: typeof answers?.participationConsiderations === 'string' ? answers.participationConsiderations.trim() : '',
    participationConsiderationsNote: typeof answers?.participationConsiderationsNote === 'string' ? answers.participationConsiderationsNote.trim() : '',
    additionalInsight: typeof answers?.additionalInsight === 'string' ? answers.additionalInsight.trim() : '',
  };
}

function sanitizeRequiredText(value: string | undefined, fallback: string, fieldLabel: string): string {
  const nextValue = typeof value === 'string' ? value.trim() : fallback;
  if (!nextValue) throw badRequest(`${fieldLabel} is required.`);
  return nextValue;
}

function sanitizeDate(value: string | undefined, fallback: string, fieldLabel: string): string {
  const nextValue = sanitizeRequiredText(value, fallback, fieldLabel);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextValue)) {
    throw badRequest(`${fieldLabel} must use YYYY-MM-DD format.`);
  }
  return nextValue;
}

function sanitizeColor(value: string | undefined, fallback: string, fieldLabel: string): string {
  const nextValue = sanitizeRequiredText(value, fallback, fieldLabel);
  if (!/^#[0-9a-fA-F]{6}$/.test(nextValue)) {
    throw badRequest(`${fieldLabel} must be a 6-digit hex color.`);
  }
  return nextValue.toUpperCase();
}

function normalizeTryoutTeamColor(value: string | undefined, fallback: string): string {
  const nextValue = sanitizeFreeText(value).toUpperCase();
  const normalizedFallback = sanitizeFreeText(fallback).toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(nextValue)) return nextValue;
  if (/^#[0-9A-F]{6}$/.test(normalizedFallback)) return normalizedFallback;
  return DEFAULT_TRYOUT_TEAM_COLOR;
}

function getDefaultTryoutTeamColor(teamName: string, index: number): string {
  const normalizedName = teamName.trim().toLowerCase();
  const matchedPreset = TRYOUT_TEAM_COLOR_PRESETS.find((preset) =>
    preset.aliases.some((alias) => normalizedName.includes(alias)),
  );

  return matchedPreset?.value ?? TRYOUT_TEAM_COLOR_PRESETS[index % TRYOUT_TEAM_COLOR_PRESETS.length].value;
}

function sanitizeFreeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function sanitizeEmailField(
  value: unknown,
  fallback = '',
  fieldLabel = 'Email',
): string {
  const nextValue = sanitizeFreeText(value, fallback);

  if (nextValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextValue)) {
    throw badRequest(`${fieldLabel} must be a valid email address.`);
  }

  return nextValue;
}

function sanitizePhoneNumber(value: unknown, fallback = ''): string {
  return sanitizeFreeText(value, fallback);
}

function sanitizeYearField(
  value: unknown,
  fallback = '',
  fieldLabel = 'Year',
): string {
  const nextValue = sanitizeFreeText(value, fallback);

  if (nextValue && !/^\d{4}$/.test(nextValue)) {
    throw badRequest(`${fieldLabel} must use YYYY format.`);
  }

  return nextValue;
}

function sanitizeTryoutBirthYearRange(
  youngestValue: unknown,
  oldestValue: unknown,
  fallbackYoungest: string,
  fallbackOldest: string,
): { youngest: string; oldest: string } {
  const youngest = sanitizeYearField(
    youngestValue,
    fallbackYoungest,
    'Youngest tryout birth year',
  );
  const oldest = sanitizeYearField(
    oldestValue,
    fallbackOldest,
    'Oldest tryout birth year',
  );

  if (!youngest || !oldest) {
    throw badRequest(
      'Youngest and oldest tryout birth years must both be configured.',
    );
  }

  if (Number(youngest) < Number(oldest)) {
    throw badRequest(
      'Youngest tryout birth year must be the same as or later than the oldest tryout birth year.',
    );
  }

  return { youngest, oldest };
}

function buildTryoutBirthYearOptions(
  youngestBirthYear: string,
  oldestBirthYear: string,
): string[] {
  if (
    !/^\d{4}$/.test(youngestBirthYear) ||
    !/^\d{4}$/.test(oldestBirthYear)
  ) {
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

function sanitizeSeasonLabel(value: unknown): string {
  const nextValue = sanitizeFreeText(value);

  if (nextValue && !/^\d{4}-\d{2}$/.test(nextValue)) {
    throw badRequest('Season must use YYYY-YY format.');
  }

  return nextValue;
}

function sanitizeMeasurement(value: unknown): string {
  return sanitizeFreeText(value);
}

function sanitizeIdentifier(value: unknown): string {
  const nextValue = sanitizeFreeText(value);
  return nextValue || randomUUID();
}

function sanitizeOptionalIdentifier(value: unknown): string | null {
  const nextValue = sanitizeFreeText(value);
  return nextValue || null;
}

function sanitizeTimestamp(value: unknown): string {
  const nextValue = sanitizeFreeText(value);
  return nextValue || new Date().toISOString();
}

function buildPlayerName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function buildUserName(firstName: string | undefined, lastName: string | undefined): string {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}

function parseSeasonStartYear(seasonLabel: string): number {
  const match = seasonLabel.match(/^(\d{4})-\d{2}$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function buildIntakeRecord(answers: IntakeAnswers | undefined, requestedStatus: IntakeStatus | undefined, existing?: IntakeRecord): IntakeRecord {
  const nextAnswers = sanitizeAnswers(answers ?? existing?.answers);
  const requestedNextStatus = requestedStatus === 'submitted' || requestedStatus === 'draft' || requestedStatus === 'not-started' ? requestedStatus : existing?.status ?? 'draft';
  const wasSubmitted = existing?.status === 'submitted' || Boolean(existing?.submittedAt);
  const nextStatus = wasSubmitted && requestedNextStatus !== 'submitted' ? 'submitted' : requestedNextStatus;
  const updatedAt = new Date().toISOString();
  return { status: nextStatus, updatedAt, submittedAt: nextStatus === 'submitted' ? existing?.submittedAt ?? updatedAt : existing?.submittedAt ?? null, answers: nextAnswers };
}

function ensureSubmissionIsComplete(profile: PlayerProfileInput, answers: IntakeAnswers): void {
  if (!profile.firstName || !profile.lastName || !profile.birthYear) {
    throw badRequest('Player first name, last name, and birth year are required before submitting the intake.');
  }
  if (!answers.nextSeasonOutcome || !answers.developmentSetting || !answers.preferredRole || !answers.coachingStyle || !answers.participationConsiderations) throw badRequest('Questions 1 through 5 are required before submitting the intake.');
}

function validatePrimaryRole(role: PrimaryRole | null): asserts role is UserRole {
  if (role !== 'parent' && role !== 'player') {
    throw badRequest('Only parent or player accounts can create or manage player records.');
  }
}

function buildUserPlayerLinkItem(userId: string, playerId: string, relationship: UserRole, playerName: string): UserPlayerLinkItem {
  return { pk: userKey(userId), sk: playerLinkKey(playerId), entityType: 'UserPlayerLink', userId, playerId, relationship, playerName, gsi1pk: playerKey(playerId), gsi1sk: `USER#${userId}` };
}

function serializePlayer(link: UserPlayerLinkItem, player: PlayerItem, invites: InviteItem[]): SerializedPlayer {
  return {
    id: player.playerId,
    relationship: link.relationship,
    profile: normalizePlayerProfile(player.profile, '', link.relationship),
    intake: player.intake,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
    sentInvites: invites.map(serializeInvite),
  };
}

function serializeInvite(invite: InviteItem): SerializedInvite {
  return { id: invite.inviteId, playerId: invite.playerId, playerName: invite.playerName, invitedEmail: invite.invitedEmail, invitedRole: invite.invitedRole, invitedByUserId: invite.invitedByUserId, invitedByLabel: invite.invitedByLabel, status: invite.status, createdAt: invite.createdAt, acceptedAt: invite.acceptedAt };
}

function serializeEvaluationTemplate(
  template: EvaluationTemplateItem,
): SerializedEvaluationTemplate {
  return {
    id: template.templateId,
    name: template.name,
    criteria: sanitizeEvaluationCriteria(template.criteria),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function serializeEvaluationRecord(
  record: EvaluationRecordItem,
): SerializedPlayerEvaluationRecord {
  return {
    playerId: record.playerId,
    seasonId: record.seasonId,
    sessionId: record.sessionId,
    evaluatorUserId: record.evaluatorUserId,
    evaluatorName: record.evaluatorName,
    templateId: record.templateId,
    scores: { ...record.scores },
    notes: record.notes.map((note) => ({ ...note })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function serializeEvaluationSessionPlayer(
  summary: SerializedTryoutPlayerSummary,
  player: PlayerItem,
  team: TryoutTeam,
  groups: TryoutGroup[],
): SerializedEvaluationSessionPlayer {
  const profile = normalizePlayerProfile(player.profile, '', 'player');
  const latestTeam = getMostRecentTeamHistoryEntry(profile.teamHistory);

  return {
    playerId: player.playerId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    displayName: summary.displayName,
    jerseyNumber: summary.jerseyNumber,
    groupId: team.groupId,
    groupName: getTryoutGroupName(team.groupId, groups),
    teamId: team.id,
    teamName: team.name,
    jerseyColor: team.jerseyColor,
    birthYear: profile.birthYear,
    lastTeamName: latestTeam?.teamName || profile.currentTeam,
    position: profile.primaryPosition || profile.positions,
    heightDisplay: formatHeightDisplay(profile.latestHeightFeet, profile.latestHeightInches),
    weightDisplay: formatWeightDisplay(profile.latestWeightPounds),
    yearsPlaying: calculateYearsPlaying(profile.firstYearPlayingHockey),
    completedBy: profile.completedBy,
    intake: sanitizeAnswers(player.intake.answers),
  };
}

function serializeTryoutSeason(
  season: TryoutSeasonItem,
  players: PlayerItem[],
  allowedTryoutBirthYears: string[] = [],
): SerializedTryoutSeason {
  const seasonPlayers = players.filter(
    (player) => player.organizationId === ORGANIZATION_ID,
  );
  const groups = sanitizeTryoutGroups(
    season.groups,
    [],
    allowedTryoutBirthYears.length > 0
      ? new Set(allowedTryoutBirthYears)
      : null,
  );
  const teams = sanitizeTryoutTeams(season.teams, groups);
  const sessions = sanitizeTryoutSessions(season.sessions, teams);
  const playerOverrides = sanitizeTryoutPlayerOverrides(
    season.playerOverrides,
    new Set(seasonPlayers.map((player) => player.playerId)),
    groups,
    teams,
  );
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const overrideMap = new Map(
    playerOverrides.map((override) => [override.playerId, override]),
  );

  const serializedPlayers = seasonPlayers
    .map((player) =>
      serializeTryoutPlayerSummary(player, groups, teamMap, overrideMap.get(player.playerId)),
    )
    .sort(compareTryoutPlayers);

  return {
    id: season.seasonId,
    name: season.name,
    groups,
    teams,
    sessions,
    playerOverrides,
    players: serializedPlayers,
    createdAt: season.createdAt,
    updatedAt: season.updatedAt,
  };
}

function serializeTryoutPlayerSummary(
  player: PlayerItem,
  groups: TryoutGroup[],
  teamMap: Map<string, TryoutTeam>,
  override: TryoutPlayerOverride | undefined,
): SerializedTryoutPlayerSummary {
  const profile = normalizePlayerProfile(player.profile, '', 'player');
  const eligibleGroupIds = groups
    .filter((group) => matchesTryoutGroup(profile, group))
    .map((group) => group.id);
  const defaultGroupId =
    eligibleGroupIds.length === 1 ? eligibleGroupIds[0] : null;

  const effectiveGroupId =
    override?.assignmentMode === 'manual' && override.groupId
      ? override.groupId
      : override?.assignmentMode === 'unassigned'
        ? null
        : defaultGroupId;

  const resolvedTeam =
    override?.teamId ? teamMap.get(override.teamId) : undefined;
  const effectiveTeamId =
    resolvedTeam && effectiveGroupId && resolvedTeam.groupId === effectiveGroupId
      ? resolvedTeam.id
      : null;

  const playerLabel =
    buildPlayerName(profile.firstName, profile.lastName) ||
    profile.playerName ||
    'Unnamed player';
  const birthYearSuffix =
    /^\d{4}$/.test(profile.birthYear) ? ` (${profile.birthYear.slice(-2)})` : '';

  return {
    playerId: player.playerId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    birthYear: profile.birthYear,
    gender: profile.gender,
    displayName: `${playerLabel}${birthYearSuffix}`,
    eligibleGroupIds,
    defaultGroupId,
    effectiveGroupId,
    teamId: effectiveTeamId,
    jerseyNumber: sanitizeFreeText(override?.jerseyNumber),
  };
}

function matchesTryoutGroup(
  profile: PlayerProfileInput,
  group: TryoutGroup,
): boolean {
  const birthYear = sanitizeFreeText(profile.birthYear);
  const gender = sanitizeFreeText(profile.gender);

  const matchesBirthYear =
    group.allowedBirthYears.length > 0 &&
    Boolean(birthYear) &&
    group.allowedBirthYears.includes(birthYear);
  const matchesGender =
    group.allowedGenders.length > 0 &&
    Boolean(gender) &&
    group.allowedGenders.includes(gender as TryoutGender);

  return matchesBirthYear && matchesGender;
}

function getTryoutGroupName(groupId: string, groups: TryoutGroup[]): string {
  return groups.find((group) => group.id === groupId)?.name ?? 'Unknown group';
}

function compareEvaluationPlayers(
  left: SerializedEvaluationSessionPlayer,
  right: SerializedEvaluationSessionPlayer,
): number {
  const leftJersey = Number(left.jerseyNumber);
  const rightJersey = Number(right.jerseyNumber);

  if (Number.isFinite(leftJersey) && Number.isFinite(rightJersey) && leftJersey !== rightJersey) {
    return leftJersey - rightJersey;
  }

  if (left.jerseyNumber !== right.jerseyNumber) {
    return left.jerseyNumber.localeCompare(right.jerseyNumber);
  }

  return left.displayName.localeCompare(right.displayName);
}

function formatHeightDisplay(heightFeet: string, heightInches: string): string {
  const feet = sanitizeFreeText(heightFeet);
  const inches = sanitizeFreeText(heightInches);
  if (!feet && !inches) return 'Not added';
  if (feet && inches) return `${feet}'${inches}"`;
  if (feet) return `${feet}'`;
  return `${inches}"`;
}

function formatWeightDisplay(weightPounds: string): string {
  const value = sanitizeFreeText(weightPounds);
  return value ? `${value} lb` : 'Not added';
}

function calculateYearsPlaying(firstYearPlayingHockey: string, date = new Date()): number | null {
  const year = Number(firstYearPlayingHockey);
  if (!Number.isInteger(year) || year < 1900 || year > date.getFullYear()) return null;
  return Math.max(0, date.getFullYear() - year);
}

function evaluationRecordPartitionKey(
  seasonId: string,
  sessionId: string,
  evaluatorUserId: string,
): string {
  return `EVALUATOR_SESSION#${seasonId}#${sessionId}#${evaluatorUserId}`;
}

function evaluationRecordSortKey(playerId: string): string {
  return `PLAYER#${playerId}`;
}

function evaluationSessionKey(seasonId: string, sessionId: string): string {
  return `EVALUATION_SESSION#${seasonId}#${sessionId}`;
}

function compareTryoutPlayers(
  left: SerializedTryoutPlayerSummary,
  right: SerializedTryoutPlayerSummary,
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

function parseJsonBody<T>(body: string | undefined): T {
  if (!body) return {} as T;
  return JSON.parse(body) as T;
}

function userKey(userId: string): string { return `USER#${userId}`; }
function organizationKey(organizationId: string): string { return `ORGANIZATION#${organizationId}`; }
function playerKey(playerId: string): string { return `PLAYER#${playerId}`; }
function playerLinkKey(playerId: string): string { return `PLAYER#${playerId}`; }
function inviteKey(inviteId: string): string { return `INVITE#${inviteId}`; }
function evaluationTemplateKey(templateId: string): string { return `EVALUATION_TEMPLATE#${templateId}`; }
function tryoutSeasonKey(seasonId: string): string { return `TRYOUT_SEASON#${seasonId}`; }
function invitedEmailKey(email: string): string { return `INVITED_EMAIL#${email}`; }
function inviteStatusSortKey(status: InviteStatus, createdAt: string, inviteId: string): string { return `STATUS#${status}#${createdAt}#${inviteId}`; }

function buildBlankEvaluationCriterion(): EvaluationCriterion {
  return {
    id: randomUUID(),
    title: 'New criterion',
    weight: 50,
    score1Description: 'Describe what a score of 1 looks like.',
    score3Description: 'Describe what a score of 3 looks like.',
    score5Description: 'Describe what a score of 5 looks like.',
  };
}

function buildDefaultEvaluationCriteria(): EvaluationCriterion[] {
  return [
    {
      id: randomUUID(),
      title: 'Skating / mobility',
      weight: 50,
      score1Description: 'Edge control and posture break down under basic pace; first few steps are slow and recoveries after pivots or turns are late; skating with the puck noticeably reduces speed or balance.',
      score3Description: 'Functional stride and edge use for the level; can turn, stop, and transition both ways at normal game pace; can move with or without the puck but does not consistently separate or close space.',
      score5Description: 'Efficient, balanced skater with strong edges and posture; explosive first steps and quick recovery through pivots, cutbacks, and direction changes; maintains speed, control, and timing whether supporting, defending, or carrying the puck.',
    },
    {
      id: randomUUID(),
      title: 'Puck execution',
      weight: 50,
      score1Description: 'Routine passes and receptions are inconsistent even with time and space; puck touches are noisy and require extra corrections; forehand/backhand execution deteriorates quickly once pressure arrives.',
      score3Description: 'Completes routine passes and receptions at team pace; can carry and handle in open ice and basic traffic; can execute simple forehand/backhand plays but accuracy and speed drop under heavier pressure.',
      score5Description: 'First touch is clean and sets up the next play; executes forehand/backhand plays, touch plays, and traffic plays at speed; can receive, protect, and move the puck quickly enough to create an advantage rather than just survive the touch.',
    },
    {
      id: randomUUID(),
      title: 'Puck management / decision quality',
      weight: 50,
      score1Description: 'Forces pucks into traffic, throws pucks away, or makes plays before scanning options; risk-reward choices are poor; possessions end quickly after touches because the player does not protect or extend the play.',
      score3Description: 'Usually identifies the simple option after a look; will chip to space, regroup, or protect the puck when pressure is obvious; decision quality is acceptable at normal pace but slips when the game speeds up or support disappears.',
      score5Description: 'Scans early and often, manages pressure, and chooses possession-preserving options; changes pace, angle, or point of attack to buy time and improve odds; consistently turns touches into controlled exits, entries, or extended-zone time.',
    },
    {
      id: randomUUID(),
      title: 'Hockey sense and off-puck support',
      weight: 50,
      score1Description: 'Watches the puck and arrives late to support or cover; off-puck routes rarely create passing options, layers, or defensive insurance; reads turnovers and transitions slowly and is often outside the next play.',
      score3Description: 'Usually finds usable support spots and stays connected to the play; reads common breakout, rush, forecheck, and defensive triggers; contributes away from the puck but is more reactive than anticipatory.',
      score5Description: 'Anticipates the next layer before the puck arrives; times support to create outlets, middle-lane options, second-wave attack, or defensive cover; consistently improves teammates\' decisions by being in the right place early and available.',
    },
    {
      id: randomUUID(),
      title: '1-on-1 compete / battle habits',
      weight: 50,
      score1Description: 'Enters battles upright, late, or without leverage; stick detail is weak and body position is easily lost; tends to avoid contact, concede inside ice, or exit battles too early.',
      score3Description: 'Will engage and hold position through initial contact; uses acceptable stick and body habits in contested situations; compete level is present but not consistently shift-driving or possession-winning.',
      score5Description: 'Gets low early, wins inside body position, and uses edges and leverage effectively; defends and attacks through legal stick-on-puck habits instead of reaching or hoping; repeatedly turns battles into regained pucks, extended possession, or broken opposing plays.',
    },
    {
      id: randomUUID(),
      title: 'Defensive reliability / transition detail',
      weight: 50,
      score1Description: 'Coverage awareness is late or confused; loses middle ice, arrives underneath too late, or fails to sort threats; retrievals and transition touches are rushed and often become blind clears or turnovers.',
      score3Description: 'Usually protects the middle, tracks back, and handles basic assignments; 1-on-1 containment and stick positioning are adequate at team pace; can make routine retrieval-to-outlet or breakout plays when the first read is clean.',
      score5Description: 'Identifies threats early, stays on the defensive side with purpose, and closes plays with angle/stick detail; disrupts entries, supports quickly after turnovers, and reloads consistently; transition details are dependable both ways, including retrievals, escapes, first pass, and supporting the next play.',
    },
    {
      id: randomUUID(),
      title: 'Physical readiness',
      weight: 50,
      score1Description: 'Pace, posture, and power fall off quickly; balance/coordination limitations show up in races, contact, and repeated efforts; player struggles to hold ground or repeat quality shifts for the level.',
      score3Description: 'Has enough engine, balance, and strength for the current level; can repeat normal shifts without major drop-off; handles ordinary contact and pace demands but is not a physical driver of play.',
      score5Description: 'Repeats high-tempo efforts with little decline across sessions, periods, or games; balance, coordination, and core control hold up under contact and fatigue; physical tools consistently support execution by winning races, holding lines, and staying effective late in shifts.',
    },
    {
      id: randomUUID(),
      title: 'Coachability / mental consistency / team fit',
      weight: 50,
      score1Description: 'Feedback does not stick, or the response is defensive, distracted, or short-lived; mistakes trigger poor body language, frustration, or loss of task focus; team behaviors are inconsistent enough that the player becomes a drag on structure or culture.',
      score3Description: 'Takes correction respectfully and usually attempts the adjustment; emotional control and reset after mistakes are adequate; generally dependable with teammates, role expectations, and day-to-day behavior.',
      score5Description: 'Seeks clarity, applies feedback quickly, and self-corrects between reps or shifts; stays composed under pressure and rebounds fast after errors; reliable team player who communicates well, accepts role, supports teammates, and makes the group more functional.',
    },
  ];
}

async function buildTryoutSeasonReportPdf(
  report: TryoutSeasonReportData,
): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 40,
      info: {
        Title: `${report.season.name} Tryout Report`,
        Author: 'Golden Bears Player Portal',
        Subject: 'Tryout report',
      },
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);

    renderTryoutSeasonReport(doc, report);
    doc.end();
  });
}

function renderTryoutSeasonReport(
  doc: ReportDocument,
  report: TryoutSeasonReportData,
): void {
  renderTryoutSeasonReportCover(doc, report);
  renderTryoutSeasonReportOverview(doc, report);
  renderTryoutSeasonReportSessionSummary(doc, report);

  report.players.forEach((player, index) => {
    doc.addPage();
    renderTryoutSeasonReportPlayer(doc, report, player, index + 1);
  });
}

function renderTryoutSeasonReportCover(
  doc: ReportDocument,
  report: TryoutSeasonReportData,
): void {
  doc.fillColor('#184d3b');
  doc.font('Helvetica-Bold').fontSize(12).text(report.organization.shortName);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(24).text('Tryout Report');
  doc.moveDown(0.1);
  doc.font('Helvetica').fontSize(16).fillColor('#173428').text(report.season.name);
  doc.moveDown(0.6);

  doc.font('Helvetica').fontSize(10).fillColor('#476457');
  doc.text(`Generated ${formatReportDateTime(new Date().toISOString())}`);
  doc.text(`Tryout window ${report.organization.tryoutWindowLabel}`);
  doc.text(`Club ${report.organization.name}`);
  doc.moveDown(1);

  renderReportSectionHeading(
    doc,
    'Season Summary',
    'This report includes the full tryout structure, player profile and intake details, plus every saved evaluation record for the selected season.',
  );

  writeReportMetricLine(doc, 'Players', String(report.season.players.length));
  writeReportMetricLine(doc, 'Groups', String(report.season.groups.length));
  writeReportMetricLine(doc, 'Teams', String(report.season.teams.length));
  writeReportMetricLine(doc, 'Sessions', String(report.season.sessions.length));
  writeReportMetricLine(doc, 'Saved evaluations', String(report.totalEvaluationCount));
}

function renderTryoutSeasonReportOverview(
  doc: ReportDocument,
  report: TryoutSeasonReportData,
): void {
  renderReportSectionHeading(
    doc,
    'Roster Structure',
    'Players are grouped by the current tryout configuration so staff can review the same structure used in the live portal.',
  );

  if (report.season.groups.length === 0) {
    writeReportParagraph(doc, 'No tryout groups are configured for this season.');
    return;
  }

  report.season.groups.forEach((group) => {
    ensureReportSpace(doc, 60);
    const groupPlayers = report.players.filter(
      (player) => player.summary.effectiveGroupId === group.id,
    );
    const groupTeams = report.season.teams.filter((team) => team.groupId === group.id);

    renderReportSubheading(doc, group.name);
    writeLabelValueLine(
      doc,
      'Eligible birth years',
      group.allowedBirthYears.join(', ') || 'Not configured',
    );
    writeLabelValueLine(
      doc,
      'Allowed genders',
      group.allowedGenders.join(', ') || 'Not configured',
    );
    writeLabelValueLine(doc, 'Players currently assigned', String(groupPlayers.length));

    if (groupTeams.length === 0) {
      writeReportParagraph(doc, 'No tryout teams are configured inside this group yet.');
    } else {
      groupTeams.forEach((team) => {
        const roster = report.players.filter((player) => player.summary.teamId === team.id);
        writeBulletLine(
          doc,
          `${team.name}: ${roster.length} player${roster.length === 1 ? '' : 's'}`,
        );
      });
    }
  });

  const unassignedPlayers = report.players.filter(
    (player) => player.summary.effectiveGroupId === null,
  );
  if (unassignedPlayers.length > 0) {
    renderReportSubheading(doc, 'Unassigned Pool');
    writeReportParagraph(
      doc,
      `${unassignedPlayers.length} player${unassignedPlayers.length === 1 ? '' : 's'} currently sit outside a configured tryout group.`,
    );
    unassignedPlayers.forEach((player) => {
      writeBulletLine(doc, buildReportPlayerLine(player.summary.displayName, player.summary.jerseyNumber));
    });
  }
}

function renderTryoutSeasonReportSessionSummary(
  doc: ReportDocument,
  report: TryoutSeasonReportData,
): void {
  renderReportSectionHeading(
    doc,
    'Session Coverage',
    'Each session below shows roster coverage and how many saved evaluator records exist for the players attached to that session.',
  );

  if (report.sessionSummaries.length === 0) {
    writeReportParagraph(doc, 'No evaluation sessions are configured for this season.');
    return;
  }

  report.sessionSummaries.forEach((sessionSummary) => {
    ensureReportSpace(doc, 74);
    renderReportSubheading(doc, sessionSummary.session.name);
    writeLabelValueLine(
      doc,
      'Template',
      sessionSummary.template?.name ?? 'No evaluation template assigned',
    );
    writeLabelValueLine(
      doc,
      'Teams',
      sessionSummary.teamNames.join(', ') || 'No teams attached',
    );
    writeLabelValueLine(
      doc,
      'Roster coverage',
      `${sessionSummary.evaluatedPlayerCount} of ${sessionSummary.rosterCount} players have saved evaluation data`,
    );
    writeLabelValueLine(
      doc,
      'Records',
      `${sessionSummary.evaluationCount} evaluation record${sessionSummary.evaluationCount === 1 ? '' : 's'} from ${sessionSummary.evaluatorCount} evaluator${sessionSummary.evaluatorCount === 1 ? '' : 's'}`,
    );
  });
}

function renderTryoutSeasonReportPlayer(
  doc: ReportDocument,
  report: TryoutSeasonReportData,
  reportPlayer: TryoutSeasonReportPlayer,
  index: number,
): void {
  const profile = normalizePlayerProfile(reportPlayer.player.profile, '', 'player');
  const intake = sanitizeAnswers(reportPlayer.player.intake.answers);
  const lastTeamHistory = [...profile.teamHistory].sort((left, right) =>
    right.seasonLabel.localeCompare(left.seasonLabel),
  );
  const measurementHistory = [...profile.physicalHistory].sort((left, right) =>
    right.recordedAt.localeCompare(left.recordedAt),
  );

  doc.fillColor('#184d3b');
  doc.font('Helvetica-Bold').fontSize(11).text(`Player ${index} of ${report.players.length}`);
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#173428').text(
    buildReportPlayerLine(reportPlayer.summary.displayName, reportPlayer.summary.jerseyNumber),
  );
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(10).fillColor('#476457');
  doc.text(`${reportPlayer.groupName} | ${reportPlayer.teamName}`);
  doc.moveDown(0.8);

  renderReportSectionHeading(doc, 'Player Profile');
  writeLabelValueLine(doc, 'Player name', profile.playerName || 'Not added');
  writeLabelValueLine(doc, 'First name', profile.firstName || 'Not added');
  writeLabelValueLine(doc, 'Last name', profile.lastName || 'Not added');
  writeLabelValueLine(doc, 'Birth year', profile.birthYear || 'Not added');
  writeLabelValueLine(doc, 'Gender', profile.gender || 'Not added');
  writeLabelValueLine(doc, 'Primary position', profile.primaryPosition || 'Not added');
  writeLabelValueLine(doc, 'Additional positions', profile.positions || 'Not added');
  writeLabelValueLine(doc, 'Handedness', profile.handedness || 'Not added');
  writeLabelValueLine(doc, 'First year playing hockey', profile.firstYearPlayingHockey || 'Not added');
  writeLabelValueLine(
    doc,
    'Years playing hockey',
    stringifyNullableNumber(calculateYearsPlaying(profile.firstYearPlayingHockey)),
  );
  writeLabelValueLine(doc, 'Current team', profile.currentTeam || 'Not added');
  writeLabelValueLine(doc, 'Latest height', formatHeightDisplay(profile.latestHeightFeet, profile.latestHeightInches));
  writeLabelValueLine(doc, 'Latest weight', formatWeightDisplay(profile.latestWeightPounds));
  writeLabelValueLine(doc, 'Completed by', profile.completedBy || 'Not added');
  writeLabelValueLine(doc, 'Contact email', profile.bestContactEmail || 'Not added');
  writeLabelValueLine(doc, 'Phone number', profile.phoneNumber || 'Not added');
  writeLabelValueLine(doc, 'Text notifications', profile.smsOptIn ? 'Enabled' : 'Not enabled');

  renderReportSubheading(doc, 'Team History');
  if (lastTeamHistory.length === 0) {
    writeReportParagraph(doc, 'No team history entries were added.');
  } else {
    lastTeamHistory.forEach((entry) => {
      writeBulletLine(
        doc,
        `${entry.seasonLabel} | ${entry.teamName || 'Unnamed team'}${
          entry.positionPlayed ? ` | ${entry.positionPlayed}` : ''
        }`,
      );
    });
  }

  renderReportSubheading(doc, 'Height / Weight History');
  if (measurementHistory.length === 0) {
    writeReportParagraph(doc, 'No height or weight history entries were added.');
  } else {
    measurementHistory.forEach((entry) => {
      writeBulletLine(
        doc,
        `${formatReportDate(entry.recordedAt)} | ${formatHeightDisplay(entry.heightFeet, entry.heightInches)} | ${formatWeightDisplay(entry.weightPounds)}`,
      );
    });
  }

  renderReportSubheading(doc, 'Tryout Intake');
  writeLabelValueLine(doc, 'Completed by', profile.completedBy || 'Not added');
  writeLabelValueLine(doc, 'Next season outcome', intake.nextSeasonOutcome || 'Not answered');
  writeLabelValueLine(doc, 'Development setting', intake.developmentSetting || 'Not answered');
  writeLabelValueLine(doc, 'Preferred role', intake.preferredRole || 'Not answered');
  writeLabelValueLine(doc, 'Coaching style', intake.coachingStyle || 'Not answered');
  writeLabelValueLine(
    doc,
    'Participation considerations',
    intake.participationConsiderations || 'Not answered',
  );
  writeLabelValueLine(
    doc,
    'Participation note',
    intake.participationConsiderationsNote || 'Not answered',
  );
  writeLabelValueLine(doc, 'Additional insight', intake.additionalInsight || 'Not answered');

  renderReportSubheading(doc, 'Evaluation Records');
  if (reportPlayer.sessionEntries.length === 0) {
    writeReportParagraph(
      doc,
      'This player is not attached to any tryout evaluation session and has no saved evaluation records yet.',
    );
    return;
  }

  reportPlayer.sessionEntries.forEach((entry) => {
    ensureReportSpace(doc, 90);
    renderReportSubheading(doc, entry.session.name);
    writeLabelValueLine(doc, 'Teams', entry.teamNames.join(', ') || 'No teams attached');
    writeLabelValueLine(
      doc,
      'Template',
      entry.template?.name ?? 'No evaluation template assigned',
    );
    writeLabelValueLine(
      doc,
      'Saved records',
      `${entry.records.length} evaluation record${entry.records.length === 1 ? '' : 's'}`,
    );

    if (entry.records.length === 0) {
      writeReportParagraph(doc, 'No evaluation records were saved for this player in this session.');
      return;
    }

    if (entry.template) {
      renderReportSubheading(doc, 'Session criterion averages');
      buildSessionCriterionAverages(entry.records, entry.template).forEach((average) => {
        writeBulletLine(
          doc,
          `${average.title} (W${average.weight}) | ${
            average.count > 0 ? `${average.average.toFixed(2)} across ${average.count}` : 'No saved scores'
          }`,
        );
      });
    }

    renderReportSubheading(doc, 'Evaluator detail');
    entry.records.forEach((record) => {
      ensureReportSpace(doc, 60);
      writeLabelValueLine(
        doc,
        'Evaluator',
        `${record.evaluatorName} | Updated ${formatReportDateTime(record.updatedAt)}`,
      );
      if (entry.template) {
        const scoreLine = entry.template.criteria
          .map((criterion) => {
            const score = record.scores[criterion.id];
            return `${criterion.title}: ${score ?? '-'}`;
          })
          .join(' | ');
        writeLabelValueLine(doc, 'Scores', scoreLine || 'No scores saved');
      }

      if (record.notes.length === 0) {
        writeLabelValueLine(doc, 'Notes', 'No notes saved');
      } else {
        writeLabelValueLine(doc, 'Notes', `${record.notes.length} note${record.notes.length === 1 ? '' : 's'}`);
        record.notes.forEach((note) => {
          writeBulletLine(
            doc,
            `${formatReportDateTime(note.updatedAt)} | ${note.text}`,
          );
        });
      }
    });
  });
}

function buildSessionCriterionAverages(
  records: EvaluationRecordItem[],
  template: EvaluationTemplateItem,
): Array<{ title: string; weight: number; average: number; count: number }> {
  return template.criteria.map((criterion) => {
    const values = records
      .map((record) => record.scores[criterion.id])
      .filter((score): score is EvaluationScoreValue => score !== null);

    return {
      title: criterion.title,
      weight: criterion.weight,
      average:
        values.length > 0
          ? values.reduce((total, value) => total + value, 0) / values.length
          : 0,
      count: values.length,
    };
  });
}

function renderReportSectionHeading(
  doc: ReportDocument,
  title: string,
  description?: string,
): void {
  ensureReportSpace(doc, description ? 58 : 34);
  if (doc.y > doc.page.margins.top) doc.moveDown(0.7);
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#184d3b').text(title);
  if (description) {
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(9.5).fillColor('#476457').text(description);
  }
  doc.moveDown(0.35);
}

function renderReportSubheading(
  doc: ReportDocument,
  title: string,
): void {
  ensureReportSpace(doc, 28);
  if (doc.y > doc.page.margins.top + 4) doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#173428').text(title);
  doc.moveDown(0.1);
}

function writeReportMetricLine(
  doc: ReportDocument,
  label: string,
  value: string,
): void {
  writeLabelValueLine(doc, label, value);
}

function writeLabelValueLine(
  doc: ReportDocument,
  label: string,
  value: string,
): void {
  ensureReportSpace(doc, 24);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#173428').text(`${label}: `, {
    continued: true,
  });
  doc.font('Helvetica').fontSize(9.5).fillColor('#2f4d40').text(value || 'Not added');
}

function writeReportParagraph(
  doc: ReportDocument,
  value: string,
): void {
  ensureReportSpace(doc, 24);
  doc.font('Helvetica').fontSize(9.5).fillColor('#2f4d40').text(value);
}

function writeBulletLine(
  doc: ReportDocument,
  value: string,
): void {
  ensureReportSpace(doc, 22);
  doc.font('Helvetica').fontSize(9.25).fillColor('#2f4d40').text(`- ${value}`);
}

function ensureReportSpace(
  doc: ReportDocument,
  minimumHeight: number,
): void {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + minimumHeight > bottomLimit) {
    doc.addPage();
  }
}

function buildReportPlayerLine(displayName: string, jerseyNumber: string): string {
  const baseName = displayName.replace(/\s+\(\d{2}\)$/, '');
  return `${baseName} #${jerseyNumber || '--'}`;
}

function stringifyNullableNumber(value: number | null): string {
  return value === null ? 'Not added' : String(value);
}

function formatReportDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatReportDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function buildReportFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

class ApiError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}

function badRequest(message: string): ApiError { return new ApiError(400, message); }
function forbidden(message: string): ApiError { return new ApiError(403, message); }
function notFound(message: string): ApiError { return new ApiError(404, message); }
function conflict(message: string): ApiError { return new ApiError(409, message); }

function handleError(error: unknown): APIGatewayProxyStructuredResultV2 {
  if (error instanceof ApiError) return json(error.statusCode, { message: error.message });
  console.error(error);
  return json(500, { message: 'Internal server error.' });
}

function claim(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

function pdf(
  statusCode: number,
  body: Buffer,
  fileName: string,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    isBase64Encoded: true,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'no-store',
    },
    body: body.toString('base64'),
  };
}
