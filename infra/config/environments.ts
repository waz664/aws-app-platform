export type EnvironmentName = 'dev' | 'stage' | 'prod';

export type EnvironmentConfig = {
  name: EnvironmentName;
  region: string;
  plannedWebDomain: string;
  bootstrapAdminEmail: string;
  allowAuthenticatedReads: boolean;
};

const defaultBootstrapAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL ?? '';

export const platformEnvironments: Record<EnvironmentName, EnvironmentConfig> = {
  dev: {
    name: 'dev',
    region: 'us-east-1',
    plannedWebDomain: 'dev-condo.wasikowski.com',
    bootstrapAdminEmail: defaultBootstrapAdminEmail,
    allowAuthenticatedReads: true,
  },
  stage: {
    name: 'stage',
    region: 'us-east-1',
    plannedWebDomain: 'stage-condo.wasikowski.com',
    bootstrapAdminEmail: defaultBootstrapAdminEmail,
    allowAuthenticatedReads: true,
  },
  prod: {
    name: 'prod',
    region: 'us-east-1',
    plannedWebDomain: 'condo.wasikowski.com',
    bootstrapAdminEmail: defaultBootstrapAdminEmail,
    allowAuthenticatedReads: false,
  },
};

