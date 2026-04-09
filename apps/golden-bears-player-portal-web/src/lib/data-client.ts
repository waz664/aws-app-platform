import { demoData } from '../demo-data';
import type {
  AccountStatus,
  AdminUserDirectoryEntry,
  AdminUserUpdateInput,
  AdminUsersResponse,
  EvaluationSessionContext,
  EvaluationNote,
  EvaluationScoreValue,
  EvaluationTemplate,
  EvaluationTemplateCreateInput,
  EvaluationTemplateUpdateInput,
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
  TryoutSeason,
  TryoutSeasonCreateInput,
  TryoutSeasonUpdateInput,
  UserRole,
} from '../types';
import { isAwsConfig } from './runtime-config';

let demoEvaluationTemplates: EvaluationTemplate[] = [
  {
    id: 'demo-template-default',
    name: 'Core tryout evaluation template',
    criteria: [
      {
        id: 'demo-criterion-1',
        title: 'Skating / mobility',
        weight: 50,
        score1Description: 'Stride, edges, and posture break down under basic pace.',
        score3Description: 'Functional stride and edge control for the level.',
        score5Description: 'Explosive, balanced skating that holds up with or without the puck.',
      },
    ],
    createdAt: '2026-04-09T12:00:00.000Z',
    updatedAt: '2026-04-09T12:00:00.000Z',
  },
];

let demoTryoutSeasons: TryoutSeason[] = [];

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

export async function loadEvaluationTemplates(
  config: RuntimeConfig,
  idToken: string | null,
): Promise<EvaluationTemplate[]> {
  if (!isAwsConfig(config) || !idToken) {
    return demoEvaluationTemplates.map((template) => ({
      ...template,
      criteria: template.criteria.map((criterion) => ({ ...criterion })),
    }));
  }

  return requestJson<EvaluationTemplate[]>(`${config.apiBaseUrl}/admin/evaluation-templates`, {
    idToken,
  });
}

export async function createEvaluationTemplate(
  config: RuntimeConfig,
  idToken: string | null,
  payload: EvaluationTemplateCreateInput,
): Promise<EvaluationTemplate> {
  if (!isAwsConfig(config) || !idToken) {
    const sourceTemplate = payload.sourceTemplateId
      ? demoEvaluationTemplates.find((template) => template.id === payload.sourceTemplateId) ?? null
      : null;
    const now = new Date().toISOString();
    const createdTemplate: EvaluationTemplate = {
      id: crypto.randomUUID(),
      name:
        payload.name?.trim() ||
        (sourceTemplate
          ? `${sourceTemplate.name} Copy`
          : payload.useDefaultCriteria
            ? 'Core tryout evaluation template'
            : 'New evaluation template'),
      criteria: sourceTemplate
        ? sourceTemplate.criteria.map((criterion) => ({
            ...criterion,
            id: crypto.randomUUID(),
          }))
        : [
            {
              id: crypto.randomUUID(),
              title: payload.useDefaultCriteria ? 'Skating / mobility' : 'New criterion',
              weight: 50,
              score1Description: payload.useDefaultCriteria
                ? 'Stride, edges, and posture break down under basic pace.'
                : 'Describe what a score of 1 looks like.',
              score3Description: payload.useDefaultCriteria
                ? 'Functional stride and edge control for the level.'
                : 'Describe what a score of 3 looks like.',
              score5Description: payload.useDefaultCriteria
                ? 'Explosive, balanced skating that holds up with or without the puck.'
                : 'Describe what a score of 5 looks like.',
            },
          ],
      createdAt: now,
      updatedAt: now,
    };
    demoEvaluationTemplates = [createdTemplate, ...demoEvaluationTemplates];
    return {
      ...createdTemplate,
      criteria: createdTemplate.criteria.map((criterion) => ({ ...criterion })),
    };
  }

  return requestJson<EvaluationTemplate>(`${config.apiBaseUrl}/admin/evaluation-templates`, {
    idToken,
    method: 'POST',
    body: payload,
  });
}

export async function updateEvaluationTemplate(
  config: RuntimeConfig,
  idToken: string | null,
  templateId: string,
  payload: EvaluationTemplateUpdateInput,
): Promise<EvaluationTemplate> {
  if (!isAwsConfig(config) || !idToken) {
    const now = new Date().toISOString();
    const nextTemplate: EvaluationTemplate = {
      id: templateId,
      name: payload.name.trim(),
      criteria: payload.criteria.map((criterion) => ({ ...criterion })),
      createdAt:
        demoEvaluationTemplates.find((template) => template.id === templateId)?.createdAt ?? now,
      updatedAt: now,
    };
    demoEvaluationTemplates = demoEvaluationTemplates.map((template) =>
      template.id === templateId ? nextTemplate : template,
    );
    return nextTemplate;
  }

  return requestJson<EvaluationTemplate>(
    `${config.apiBaseUrl}/admin/evaluation-templates/${templateId}`,
    {
      idToken,
      method: 'PUT',
      body: payload,
    },
  );
}

export async function deleteEvaluationTemplate(
  config: RuntimeConfig,
  idToken: string | null,
  templateId: string,
): Promise<{ deletedTemplateId: string }> {
  if (!isAwsConfig(config) || !idToken) {
    demoEvaluationTemplates = demoEvaluationTemplates.filter(
      (template) => template.id !== templateId,
    );
    return { deletedTemplateId: templateId };
  }

  return requestJson<{ deletedTemplateId: string }>(
    `${config.apiBaseUrl}/admin/evaluation-templates/${templateId}`,
    {
      idToken,
      method: 'DELETE',
    },
  );
}

export async function loadTryoutSeasons(
  config: RuntimeConfig,
  idToken: string | null,
): Promise<TryoutSeason[]> {
  if (!isAwsConfig(config) || !idToken) {
    return demoTryoutSeasons.map(cloneTryoutSeason);
  }

  return requestJson<TryoutSeason[]>(`${config.apiBaseUrl}/tryout-seasons`, {
    idToken,
  });
}

export async function createTryoutSeason(
  config: RuntimeConfig,
  idToken: string | null,
  payload: TryoutSeasonCreateInput,
): Promise<TryoutSeason> {
  if (!isAwsConfig(config) || !idToken) {
    const now = new Date().toISOString();
    const createdSeason: TryoutSeason = {
      id: crypto.randomUUID(),
      name: payload.name.trim(),
      groups: [],
      teams: [],
      sessions: [],
      playerOverrides: [],
      players: [],
      createdAt: now,
      updatedAt: now,
    };
    demoTryoutSeasons = [createdSeason, ...demoTryoutSeasons];
    return cloneTryoutSeason(createdSeason);
  }

  return requestJson<TryoutSeason>(`${config.apiBaseUrl}/tryout-seasons`, {
    idToken,
    method: 'POST',
    body: payload,
  });
}

export async function updateTryoutSeason(
  config: RuntimeConfig,
  idToken: string | null,
  seasonId: string,
  payload: TryoutSeasonUpdateInput,
): Promise<TryoutSeason> {
  if (!isAwsConfig(config) || !idToken) {
    const existingSeason =
      demoTryoutSeasons.find((season) => season.id === seasonId) ?? null;
    const updatedSeason: TryoutSeason = {
      id: seasonId,
      name: payload.name.trim(),
      groups: payload.groups.map((group) => ({ ...group, allowedBirthYears: [...group.allowedBirthYears], allowedGenders: [...group.allowedGenders] })),
      teams: payload.teams.map((team) => ({ ...team })),
      sessions: payload.sessions.map((session) => ({
        ...session,
        teamIds: [...session.teamIds],
        evaluationTemplateId: session.evaluationTemplateId ?? null,
      })),
      playerOverrides: payload.playerOverrides.map((override) => ({ ...override })),
      players: existingSeason ? cloneTryoutSeason(existingSeason).players : [],
      createdAt: existingSeason?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoTryoutSeasons = demoTryoutSeasons.map((season) =>
      season.id === seasonId ? updatedSeason : season,
    );
    return cloneTryoutSeason(updatedSeason);
  }

  return requestJson<TryoutSeason>(`${config.apiBaseUrl}/tryout-seasons/${seasonId}`, {
    idToken,
    method: 'PUT',
    body: payload,
  });
}

export async function deleteTryoutSeason(
  config: RuntimeConfig,
  idToken: string | null,
  seasonId: string,
): Promise<{ deletedSeasonId: string }> {
  if (!isAwsConfig(config) || !idToken) {
    demoTryoutSeasons = demoTryoutSeasons.filter((season) => season.id !== seasonId);
    return { deletedSeasonId: seasonId };
  }

  return requestJson<{ deletedSeasonId: string }>(
    `${config.apiBaseUrl}/tryout-seasons/${seasonId}`,
    {
      idToken,
      method: 'DELETE',
    },
  );
}

export async function downloadTryoutSeasonReport(
  config: RuntimeConfig,
  idToken: string | null,
  seasonId: string,
  seasonName: string,
): Promise<{ fileName: string }> {
  if (!isAwsConfig(config) || !idToken) {
    throw new Error('Tryout report downloads in demo mode are not implemented.');
  }

  const fileName = `${slugifyFileName(seasonName) || 'tryout-season'}-report.pdf`;
  const blob = await requestBlob(
    `${config.apiBaseUrl}/tryout-seasons/${seasonId}/report`,
    {
      idToken,
    },
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1_000);

  return { fileName };
}

function cloneTryoutSeason(season: TryoutSeason): TryoutSeason {
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

export async function loadEvaluationSessionContext(
  config: RuntimeConfig,
  idToken: string | null,
  seasonId: string,
  sessionId: string,
): Promise<EvaluationSessionContext> {
  if (!isAwsConfig(config) || !idToken) {
    throw new Error('Evaluation mode in demo mode is not implemented.');
  }

  return requestJson<EvaluationSessionContext>(
    `${config.apiBaseUrl}/tryout-seasons/${seasonId}/sessions/${sessionId}/evaluation`,
    {
      idToken,
    },
  );
}

export async function updatePlayerEvaluationRecord(
  config: RuntimeConfig,
  idToken: string | null,
  seasonId: string,
  sessionId: string,
  playerId: string,
  payload: {
    scores: Record<string, EvaluationScoreValue | null>;
    notes: EvaluationNote[];
  },
): Promise<{ record: EvaluationSessionContext['records'][number] | null }> {
  if (!isAwsConfig(config) || !idToken) {
    throw new Error('Evaluation mode in demo mode is not implemented.');
  }

  return requestJson<{ record: EvaluationSessionContext['records'][number] | null }>(
    `${config.apiBaseUrl}/tryout-seasons/${seasonId}/sessions/${sessionId}/players/${playerId}/evaluation`,
    {
      idToken,
      method: 'PUT',
      body: payload,
    },
  );
}

async function requestJson<T>(
  url: string,
  options: {
    idToken: string;
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
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

async function requestBlob(
  url: string,
  options: {
    idToken: string;
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
  },
): Promise<Blob> {
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

  return response.blob();
}

function slugifyFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
