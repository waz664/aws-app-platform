#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { platformEnvironments } from '../config/environments.js';
import { CondoOpsStack } from '../lib/condo-ops-stack.js';
import { SharedIdentityStack } from '../lib/shared-identity-stack.js';

const app = new cdk.App();
const environmentName = (app.node.tryGetContext('env') ?? 'dev') as keyof typeof platformEnvironments;
const environmentConfig = platformEnvironments[environmentName];

if (!environmentConfig) {
  throw new Error(
    `Unknown environment "${environmentName}". Expected one of: ${Object.keys(platformEnvironments).join(', ')}`,
  );
}

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: environmentConfig.region,
};

const sharedIdentityStack = new SharedIdentityStack(
  app,
  `PlatformIdentity-${environmentName}`,
  {
    env,
    environmentConfig,
  },
);

new CondoOpsStack(app, `CondoOps-${environmentName}`, {
  env,
  environmentConfig,
  sharedIdentity: sharedIdentityStack,
});
