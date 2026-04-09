import { demoData } from '../demo-data';
import type {
  AccountStatus,
  AdminUserDirectoryEntry,
  AdminUserUpdateInput,
  AdminUsersResponse,
  AppRole,
  BootstrapData,
  IntakeAnswers,
  IntakeStatus,
  InviteRecord,
  OrganizationSettingsInput,
  PlayerRecord,
  PlayerProfileInput,
  PrimaryRole,
  RuntimeConfig,
  UserRole,
} from '../types';
import { isAwsConfig } from './runtime-config';

export async function loadBootstrapData(
  config: RuntimeConfig,
  idToken: string | null,
): Promise<BootstrapData> {
  if (!isAwsConfig(config) || !idToken) {
    return demoData;
  }

  return requestJson<BootstrapData>(`${config.apiBaseUrl}/bootstrap`, {
    idToken,
  });
}

export async function saveUserRole(
  config: RuntimeConfig,
  idToken: string | null,
  role: PrimaryRole,
): Promise<BootstrapData> {
  if (!isAwsConfig(config) || !idToken) {
    const nextAccessRoles =
      role === 'staff' ? [] : [role];
    return {
      ...demoData,
      user: {
        ...demoData.user,
        primaryRole: role,
      },
      access: {
        ...demoData.access,
        roles: nextAccessRoles,
        organizations: demoData.access.organizations.map((organization) => ({
          ...organization,
          roles: nextAccessRoles,
        })),
      },
    };
  }

  return requestJson<BootstrapData>(`${config.apiBaseUrl}/profile`, {
    idToken,
    method: 'PUT',
    body: {
      role,
    },
  });
}

export async function updateCurrentUserProfile(
  config: RuntimeConfig,
  idToken: string | null,
  payload: {
    firstName: string;
    lastName: string;
    contactEmail: string;
    phoneNumber: string;
    smsOptIn: boolean;
  },
): Promise<BootstrapData> {
  if (!isAwsConfig(config) || !idToken) {
    return {
      ...demoData,
      user: {
        ...demoData.user,
        ...payload,
      },
    };
  }

  return requestJson<BootstrapData>(`${config.apiBaseUrl}/profile`, {
    idToken,
    method: 'PUT',
    body: payload,
  });
}

export async function createPlayer(
  config: RuntimeConfig,
  idToken: string | null,
  payload: {
    profile: PlayerProfileInput;
    intake: IntakeAnswers;
    intakeStatus: IntakeStatus;
  },
): Promise<{ bootstrap: BootstrapData; player: PlayerRecord }> {
  if (!isAwsConfig(config) || !idToken) {
    throw new Error('Player creation in demo mode is not implemented.');
  }

  return requestJson<{ bootstrap: BootstrapData; player: PlayerRecord }>(`${config.apiBaseUrl}/players`, {
    idToken,
    method: 'POST',
    body: payload,
  });
}

export async function updatePlayer(
  config: RuntimeConfig,
  idToken: string | null,
  playerId: string,
  payload: {
    profile: PlayerProfileInput;
    intake: IntakeAnswers;
    intakeStatus: IntakeStatus;
  },
): Promise<{ bootstrap: BootstrapData; player: PlayerRecord }> {
  if (!isAwsConfig(config) || !idToken) {
    throw new Error('Player updates in demo mode are not implemented.');
  }

  return requestJson<{ bootstrap: BootstrapData; player: PlayerRecord }>(`${config.apiBaseUrl}/players/${playerId}`, {
    idToken,
    method: 'PATCH',
    body: payload,
  });
}

export async function createInvite(
  config: RuntimeConfig,
  idToken: string | null,
  playerId: string,
  payload: {
    invitedEmail: string;
    invitedRole: UserRole;
  },
): Promise<{ bootstrap: BootstrapData; invite: InviteRecord }> {
  if (!isAwsConfig(config) || !idToken) {
    throw new Error('Invites in demo mode are not implemented.');
  }

  return requestJson<{ bootstrap: BootstrapData; invite: InviteRecord }>(`${config.apiBaseUrl}/players/${playerId}/invites`, {
    idToken,
    method: 'POST',
    body: payload,
  });
}

export async function acceptInvite(
  config: RuntimeConfig,
  idToken: string | null,
  inviteId: string,
): Promise<BootstrapData> {
  if (!isAwsConfig(config) || !idToken) {
    throw new Error('Invite acceptance in demo mode is not implemented.');
  }

  return requestJson<BootstrapData>(`${config.apiBaseUrl}/invites/${inviteId}/accept`, {
    idToken,
    method: 'POST',
  });
}

export async function declineInvite(
  config: RuntimeConfig,
  idToken: string | null,
  inviteId: string,
): Promise<BootstrapData> {
  if (!isAwsConfig(config) || !idToken) {
    throw new Error('Invite decline in demo mode is not implemented.');
  }

  return requestJson<BootstrapData>(`${config.apiBaseUrl}/invites/${inviteId}/decline`, {
    idToken,
    method: 'POST',
  });
}

export async function revokeInvite(
  config: RuntimeConfig,
  idToken: string | null,
  inviteId: string,
): Promise<BootstrapData> {
  if (!isAwsConfig(config) || !idToken) {
    throw new Error('Invite revocation in demo mode is not implemented.');
  }

  return requestJson<BootstrapData>(`${config.apiBaseUrl}/invites/${inviteId}/revoke`, {
    idToken,
    method: 'POST',
  });
}

export async function claimOrganizationAdmin(
  config: RuntimeConfig,
  idToken: string | null,
): Promise<BootstrapData> {
  if (!isAwsConfig(config) || !idToken) {
    return {
      ...demoData,
      access: {
        ...demoData.access,
        roles: [...new Set<AppRole>([...demoData.access.roles, 'club-admin'])],
        organizations: demoData.access.organizations.map((organization) =>
          organization.organizationId === demoData.organization.id
            ? {
                ...organization,
                roles: [...new Set<AppRole>([...organization.roles, 'club-admin'])],
              }
            : organization,
        ),
        canManageOrganization: true,
      },
      admin: {
        ...demoData.admin,
        canClaimOrganizationAdmin: false,
        hasOrganizationAdmin: true,
      },
    };
  }

  return requestJson<BootstrapData>(`${config.apiBaseUrl}/access/claim-admin`, {
    idToken,
    method: 'POST',
  });
}

export async function updateOrganizationSettings(
  config: RuntimeConfig,
  idToken: string | null,
  payload: OrganizationSettingsInput,
): Promise<BootstrapData> {
  if (!isAwsConfig(config) || !idToken) {
    return {
      ...demoData,
      organization: {
        ...demoData.organization,
        ...payload,
      },
    };
  }

  return requestJson<BootstrapData>(`${config.apiBaseUrl}/organization`, {
    idToken,
    method: 'PUT',
    body: payload,
  });
}

export async function loadAdminUsers(
  config: RuntimeConfig,
  idToken: string | null,
  filters: {
    query: string;
    primaryRole: PrimaryRole | 'all';
    accountStatus: AccountStatus | 'all';
    assignedRole: AppRole | 'all';
    cursor: string | null;
    pageSize: number;
  },
): Promise<AdminUsersResponse> {
  if (!isAwsConfig(config) || !idToken) {
    const demoEntry: AdminUserDirectoryEntry = {
      userId: demoData.user.userId,
      email: demoData.user.email,
      firstName: demoData.user.firstName,
      lastName: demoData.user.lastName,
      contactEmail: demoData.user.contactEmail,
      phoneNumber: demoData.user.phoneNumber,
      smsOptIn: demoData.user.smsOptIn,
      primaryRole: demoData.user.primaryRole,
      organizationRoles: [],
      assignedRoles: demoData.user.primaryRole ? [demoData.user.primaryRole] : [],
      accountStatus: demoData.user.accountStatus,
      createdAt: demoData.user.createdAt,
      updatedAt: demoData.user.updatedAt,
    };
    return {
      users: [demoEntry],
      nextCursor: null,
    };
  }

  const searchParams = new URLSearchParams();
  if (filters.query.trim()) searchParams.set('query', filters.query.trim());
  if (filters.primaryRole !== 'all') searchParams.set('primaryRole', filters.primaryRole);
  if (filters.accountStatus !== 'all') searchParams.set('accountStatus', filters.accountStatus);
  if (filters.assignedRole !== 'all') searchParams.set('assignedRole', filters.assignedRole);
  if (filters.cursor) searchParams.set('cursor', filters.cursor);
  searchParams.set('pageSize', String(filters.pageSize));

  return requestJson<AdminUsersResponse>(
    `${config.apiBaseUrl}/admin/users?${searchParams.toString()}`,
    {
      idToken,
    },
  );
}

export async function updateAdminUser(
  config: RuntimeConfig,
  idToken: string | null,
  userId: string,
  payload: AdminUserUpdateInput,
): Promise<AdminUserDirectoryEntry> {
  if (!isAwsConfig(config) || !idToken) {
    return {
      userId: demoData.user.userId,
      email: demoData.user.email,
      firstName: demoData.user.firstName,
      lastName: demoData.user.lastName,
      contactEmail: demoData.user.contactEmail,
      phoneNumber: demoData.user.phoneNumber,
      smsOptIn: demoData.user.smsOptIn,
      primaryRole: payload.primaryRole,
      organizationRoles: payload.organizationRoles,
      assignedRoles: [...new Set<AppRole>([
        payload.primaryRole,
        ...payload.organizationRoles,
      ])],
      accountStatus: payload.accountStatus,
      createdAt: demoData.user.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  return requestJson<AdminUserDirectoryEntry>(`${config.apiBaseUrl}/admin/users/${userId}`, {
    idToken,
    method: 'PUT',
    body: payload,
  });
}

async function requestJson<T>(
  url: string,
  options: {
    idToken: string;
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT';
    body?: unknown;
  },
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      authorization: `Bearer ${options.idToken}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed for ${url}: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}
