export type EnvironmentName = 'dev' | 'stage' | 'prod';

export type EnvironmentConfig = {
  name: EnvironmentName;
  region: string;
  plannedWebDomains: {
    condoOps: string;
    goldenBearsPlayerPortal: string;
  };
  bootstrapAdminEmail: string;
  allowAuthenticatedReads: boolean;
};

const defaultBootstrapAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL ?? '';

export const platformEnvironments: Record<EnvironmentName, EnvironmentConfig> = {
  dev: {
    name: 'dev',
    region: 'us-east-1',
    plannedWebDomains: {
      condoOps: 'dev-condo.wasikowski.com',
      goldenBearsPlayerPortal: 'dev-goldenbears.wasikowski.com',
    },
    bootstrapAdminEmail: defaultBootstrapAdminEmail,
    allowAuthenticatedReads: true,
  },
  stage: {
    name: 'stage',
    region: 'us-east-1',
    plannedWebDomains: {
      condoOps: 'stage-condo.wasikowski.com',
      goldenBearsPlayerPortal: 'stage-goldenbears.wasikowski.com',
    },
    bootstrapAdminEmail: defaultBootstrapAdminEmail,
    allowAuthenticatedReads: true,
  },
  prod: {
    name: 'prod',
    region: 'us-east-1',
    plannedWebDomains: {
      condoOps: 'condo.wasikowski.com',
      goldenBearsPlayerPortal: 'portal.ncgoldenbears.com',
    },
    bootstrapAdminEmail: defaultBootstrapAdminEmail,
    allowAuthenticatedReads: false,
  },
};
