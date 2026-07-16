import {
  fetchAuthSession,
  getCurrentUser as amplifyGetCurrentUser,
  signOut as amplifySignOut,
  type AuthUser,
} from 'aws-amplify/auth';

export type { AuthUser };

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    return await amplifyGetCurrentUser();
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await amplifySignOut();
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch {
    return null;
  }
}
