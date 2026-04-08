import type { RuntimeConfig } from '../types';

const fallbackConfig: RuntimeConfig = {
  mode: 'demo',
  appName: 'Condo Ops',
  appKey: 'condo-ops',
  region: 'us-east-1',
  plannedDomain: 'condo.wasikowski.com',
};

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch('/runtime-config.json', {
      cache: 'no-store',
    });

    if (!response.ok) {
      return fallbackConfig;
    }

    return (await response.json()) as RuntimeConfig;
  } catch {
    return fallbackConfig;
  }
}

export function isAwsConfig(config: RuntimeConfig): config is Extract<RuntimeConfig, { mode: 'aws' }> {
  return config.mode === 'aws';
}

