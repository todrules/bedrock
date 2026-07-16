'use client';

import { Moon, Sun, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { Header } from '@/components/Layout/Header';

interface AppLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

type Theme = 'light' | 'dark';

export function AppLayout({ sidebar, children }: AppLayoutProps) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const storedTheme = (window.localStorage.getItem('bedrock-theme') as Theme | null) ?? 'dark';
    setTheme(storedTheme);
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');
  }, []);

  const toggleTheme = (): void => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    window.localStorage.setItem('bedrock-theme', nextTheme);
  };

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(to_bottom,_var(--background),_var(--background))] text-primary-950 transition-colors dark:text-primary-50">
      <div className="hidden w-[22rem] flex-shrink-0 p-4 md:block">{sidebar}</div>
      {isSidebarOpen ? (
        <div className="fixed inset-0 z-40 bg-primary-950/45 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      ) : null}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[20rem] p-4 transition-transform duration-200 md:hidden ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative h-full">
          <button
            type="button"
            aria-label="Close conversations"
            className="absolute right-3 top-3 z-10 inline-flex rounded-xl border border-primary-200 bg-white p-2 text-primary-600 dark:border-primary-800 dark:bg-primary-900 dark:text-primary-200"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
          {sidebar}
        </div>
      </div>
      <main className="flex min-h-screen min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6">
        <Header
          onToggleSidebar={() => setIsSidebarOpen(true)}
          rightSlot={
            <button
              type="button"
              aria-label="Toggle theme"
              className="inline-flex items-center justify-center rounded-xl border border-primary-200 p-2 text-primary-700 transition hover:bg-primary-100 dark:border-primary-800 dark:text-primary-200 dark:hover:bg-primary-900"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          }
        />
        <div className="min-h-0 flex-1">{children}</div>
      </main>
    </div>
  );
}
