import type { AuthSession, RuntimeConfig } from '../types';
import { isAwsConfig } from './runtime-config';

let configuredClientId = '';

export async function restoreAuthSession(config: RuntimeConfig): Promise<AuthSession> {
  if (!isAwsConfig(config)) {
    return {
      status: 'demo',
      email: 'demo@wasikowski.com',
      idToken: null,
    };
  }

  await configureAmplify(config);

  try {
    const { fetchAuthSession, getCurrentUser } = await import('aws-amplify/auth');
    const [session, user] = await Promise.all([
      fetchAuthSession(),
      getCurrentUser(),
    ]);

    const idToken = session.tokens?.idToken?.toString() ?? null;
    const emailClaim = session.tokens?.idToken?.payload?.email;
    const email = typeof emailClaim === 'string' ? emailClaim : user.username;

    if (!idToken) {
      return {
        status: 'guest',
        email: null,
        idToken: null,
      };
    }

    return {
      status: 'authenticated',
      email,
      idToken,
    };
  } catch {
    return {
      status: 'guest',
      email: null,
      idToken: null,
    };
  }
}

export async function beginSignIn(config: RuntimeConfig): Promise<void> {
  if (!isAwsConfig(config)) {
    return;
  }

  await configureAmplify(config);
  const { signInWithRedirect } = await import('aws-amplify/auth');
  await signInWithRedirect();
}

export async function beginSignOut(config: RuntimeConfig): Promise<void> {
  if (!isAwsConfig(config)) {
    return;
  }

  await configureAmplify(config);
  const { signOut } = await import('aws-amplify/auth');
  await signOut();
}

async function configureAmplify(
  config: Extract<RuntimeConfig, { mode: 'aws' }>,
): Promise<void> {
  if (configuredClientId === config.auth.userPoolClientId) {
    return;
  }

  const { Amplify } = await import('aws-amplify');

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.auth.userPoolId,
        userPoolClientId: config.auth.userPoolClientId,
        loginWith: {
          email: true,
          oauth: {
            domain: config.auth.domain.replace(/^https?:\/\//, ''),
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [config.auth.redirectSignIn],
            redirectSignOut: [config.auth.redirectSignOut],
            responseType: 'code',
          },
        },
      },
    },
  });

  configuredClientId = config.auth.userPoolClientId;
}

