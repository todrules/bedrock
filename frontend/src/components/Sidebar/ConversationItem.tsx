import { formatDistanceToNow } from 'date-fns';
import { Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Conversation } from '@/types';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationItem({ conversation, isActive, onSelect, onDelete }: ConversationItemProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-2xl border px-3 py-3 transition',
        isActive
          ? 'border-accent-500 bg-accent-50 text-accent-950 dark:bg-accent-950/40 dark:text-accent-50'
          : 'border-transparent bg-transparent hover:border-primary-200 hover:bg-white dark:hover:border-primary-800 dark:hover:bg-primary-900',
      )}
    >
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(conversation.id)}>
        <p className="truncate text-sm font-medium">{conversation.title}</p>
        <p className="mt-1 text-xs text-primary-500 dark:text-primary-400">
          {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
        </p>
      </button>
      <button
        type="button"
        aria-label={`Delete ${conversation.title}`}
        className="rounded-lg p-2 text-primary-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(conversation.id);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
