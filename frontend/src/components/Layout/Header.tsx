'use client';

import { LogOut, Menu } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { getCurrentUser, signOut } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onToggleSidebar?: () => void;
  rightSlot?: ReactNode;
}

export function Header({ onToggleSidebar, rightSlot }: HeaderProps) {
  const [email, setEmail] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void getCurrentUser().then((user) => {
      if (!isMounted) {
        return;
      }

      setEmail(user?.signInDetails?.loginId ?? user?.username ?? '');
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const initials = useMemo(() => {
    if (!email) {
      return 'BR';
    }

    return email.slice(0, 2).toUpperCase();
  }, [email]);

  const handleSignOut = async (): Promise<void> => {
    setIsSigningOut(true);

    try {
      await signOut();
      window.location.reload();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-primary-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur dark:border-primary-800 dark:bg-primary-950/90 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open conversations"
          className="inline-flex rounded-xl border border-primary-200 p-2 text-primary-600 md:hidden dark:border-primary-800 dark:text-primary-300"
          onClick={onToggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-600 text-sm font-bold text-white">
            BR
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-primary-950 dark:text-primary-50">Bedrock RAG Assistant</h1>
            <p className="truncate text-sm text-primary-500 dark:text-primary-400">Enterprise knowledge grounded answers</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {rightSlot}
        <div className="hidden items-center gap-3 rounded-2xl border border-primary-200 px-3 py-2 sm:flex dark:border-primary-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-900 text-xs font-semibold text-white dark:bg-primary-100 dark:text-primary-900">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="max-w-48 truncate text-sm font-medium text-primary-950 dark:text-primary-50">{email || 'Authenticated user'}</p>
            <p className="text-xs text-primary-500 dark:text-primary-400">Secure session</p>
          </div>
        </div>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border border-primary-200 px-3 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-100 dark:border-primary-800 dark:text-primary-200 dark:hover:bg-primary-900',
            isSigningOut && 'cursor-not-allowed opacity-70',
          )}
          disabled={isSigningOut}
          onClick={() => {
            void handleSignOut();
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </header>
  );
}
