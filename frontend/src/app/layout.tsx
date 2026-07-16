'use client';

import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import { configureAmplify } from '@/lib/amplify';

import '@aws-amplify/ui-react/styles.css';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

configureAmplify();

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
