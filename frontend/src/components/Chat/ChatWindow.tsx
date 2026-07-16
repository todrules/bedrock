'use client';

import { Bot } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { ChatInput } from '@/components/Chat/ChatInput';
import { ChatMessage } from '@/components/Chat/ChatMessage';
import type { Message } from '@/types';

interface ChatWindowProps {
  messages: Message[];
  isLoading?: boolean;
  error?: string | null;
  onSendMessage: (content: string) => Promise<void>;
}

export function ChatWindow({ messages, isLoading = false, error = null, onSendMessage }: ChatWindowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col rounded-[1.75rem] border border-primary-200 bg-primary-50/50 shadow-panel dark:border-primary-800 dark:bg-primary-950/60">
      <div ref={scrollContainerRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-3xl border border-dashed border-primary-300 bg-white/70 px-6 py-12 text-center dark:border-primary-700 dark:bg-primary-900/40">
            <div className="rounded-full bg-accent-100 p-4 text-accent-600 dark:bg-accent-950 dark:text-accent-300">
              <Bot className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-primary-950 dark:text-primary-50">Welcome to Bedrock RAG</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-600 dark:text-primary-300">
              Ask questions, inspect cited sources, and continue threaded enterprise conversations with grounded responses.
            </p>
          </div>
        ) : (
          messages.map((message) => <ChatMessage key={message.id} message={message} />)
        )}
        {isLoading ? <ChatMessage isLoading /> : null}
      </div>
      <div className="border-t border-primary-200 p-4 dark:border-primary-800 sm:p-6">
        {error ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}
        <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} />
      </div>
    </section>
  );
}
