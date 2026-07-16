import { Amplify } from 'aws-amplify';

let isConfigured = false;

export function configureAmplify(): void {
  if (isConfigured) {
    return;
  }

  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const region = process.env.NEXT_PUBLIC_AWS_REGION;
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;

  if (!userPoolId || !userPoolClientId || !region) {
    return;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          email: true,
          ...(domain
            ? {
                oauth: {
                  domain,
                  scopes: ['openid', 'email', 'profile'],
                  redirectSignIn: [origin],
                  redirectSignOut: [origin],
                  responseType: 'code',
                },
              }
            : {}),
        },
      },
    },
  });

  isConfigured = true;
}
