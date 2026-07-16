'use client';

import { MessageSquarePlus } from 'lucide-react';

import { ConversationItem } from '@/components/Sidebar/ConversationItem';
import type { Conversation } from '@/types';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading?: boolean;
  error?: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  isLoading = false,
  error = null,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ConversationSidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col rounded-[1.5rem] border border-primary-200 bg-primary-50/80 p-4 dark:border-primary-800 dark:bg-primary-950/70">
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-500"
        onClick={onNewConversation}
      >
        <MessageSquarePlus className="h-4 w-4" />
        New conversation
      </button>
      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}
      <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-2xl border border-primary-200 bg-white p-4 dark:border-primary-800 dark:bg-primary-900">
                <div className="h-4 w-2/3 rounded bg-primary-200 dark:bg-primary-700" />
                <div className="mt-2 h-3 w-1/3 rounded bg-primary-200 dark:bg-primary-700" />
              </div>
            ))}
          </div>
        ) : conversations.length ? (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeConversationId}
              onSelect={onSelectConversation}
              onDelete={onDeleteConversation}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-primary-300 px-4 py-6 text-sm text-primary-500 dark:border-primary-700 dark:text-primary-400">
            No conversations yet. Start a new chat to create one.
          </div>
        )}
      </div>
    </aside>
  );
}
