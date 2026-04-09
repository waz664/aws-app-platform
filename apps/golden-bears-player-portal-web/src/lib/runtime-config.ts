import type { RuntimeConfig } from '../types';

const fallbackConfig: RuntimeConfig = {
  mode: 'demo',
  appName: 'Golden Bears Player Portal',
  appKey: 'golden-bears-player-portal',
  region: 'us-east-1',
  plannedDomain: 'goldenbears.wasikowski.com',
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
