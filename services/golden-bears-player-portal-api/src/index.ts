import { randomUUID } from 'node:crypto';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

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
  intakeIntro:
    'Please complete the brief form below. Responses are intended to help staff understand what type of environment may best accelerate the player\'s growth, along with coaching and learning preferences and any practical considerations ahead of tryouts. There are no "right" answers, and responses do not determine placement. This is not a scored part of tryouts and does not replace on-ice evaluation. The goal is simply better information in service of better development.',
} as const;

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
  intakeIntro: string;
  createdAt: string;
  updatedAt: string;
  updatedByUserId: string;
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
  intakeIntro?: string;
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

async function scanAll<T>(entityType: 'Player' | 'Invite' | 'UserProfile'): Promise<T[]> {
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
    intakeIntro: organization.intakeIntro,
  };
}

function sanitizeOrganizationSettings(
  payload: OrganizationSettingsInput,
  existing: OrganizationItem | null,
): Omit<OrganizationItem, 'pk' | 'sk' | 'entityType' | 'organizationId' | 'createdAt' | 'updatedAt' | 'updatedByUserId'> {
  const base = existing ? serializeOrganization(existing) : defaultOrganization;

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
    intakeIntro: sanitizeRequiredText(payload.intakeIntro, base.intakeIntro, 'Intake introduction'),
  };
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
  return nextValue;
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

function sanitizeTimestamp(value: unknown): string {
  const nextValue = sanitizeFreeText(value);
  return nextValue || new Date().toISOString();
}

function buildPlayerName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
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

function parseJsonBody<T>(body: string | undefined): T {
  if (!body) return {} as T;
  return JSON.parse(body) as T;
}

function userKey(userId: string): string { return `USER#${userId}`; }
function organizationKey(organizationId: string): string { return `ORGANIZATION#${organizationId}`; }
function playerKey(playerId: string): string { return `PLAYER#${playerId}`; }
function playerLinkKey(playerId: string): string { return `PLAYER#${playerId}`; }
function inviteKey(inviteId: string): string { return `INVITE#${inviteId}`; }
function invitedEmailKey(email: string): string { return `INVITED_EMAIL#${email}`; }
function inviteStatusSortKey(status: InviteStatus, createdAt: string, inviteId: string): string { return `STATUS#${status}#${createdAt}#${inviteId}`; }

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
