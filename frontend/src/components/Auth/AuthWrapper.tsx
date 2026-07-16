'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import type { ReactNode } from 'react';

interface AuthWrapperProps {
  children: ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <Authenticator
      hideSignUp
      loginMechanisms={['email']}
      className="min-h-screen"
      components={{
        Header() {
          return (
            <div className="px-6 pt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-600 text-xl font-bold text-white">
                BR
              </div>
              <h1 className="mt-5 text-2xl font-semibold text-primary-950 dark:text-primary-50">Welcome back</h1>
              <p className="mt-2 text-sm text-primary-500 dark:text-primary-400">Sign in to access your enterprise RAG workspace.</p>
            </div>
          );
        },
      }}
    >
      {() => <>{children}</>}
    </Authenticator>
  );
}
