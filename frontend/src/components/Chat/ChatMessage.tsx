import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { Citations } from '@/components/Chat/Citations';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';

interface ChatMessageProps {
  message?: Message;
  isLoading?: boolean;
}

function getRelativeTimestamp(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 'just now';
  }

  return formatDistanceToNow(date, { addSuffix: true });
}

export function ChatMessage({ message, isLoading = false }: ChatMessageProps) {
  if (isLoading) {
    return (
      <div className="flex justify-start" data-testid="chat-message-loading">
        <div className="w-full max-w-3xl rounded-2xl border border-primary-200 bg-white p-4 shadow-sm dark:border-primary-800 dark:bg-primary-900">
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-24 rounded bg-primary-200 dark:bg-primary-700" />
            <div className="h-4 w-full rounded bg-primary-200 dark:bg-primary-700" />
            <div className="h-4 w-5/6 rounded bg-primary-200 dark:bg-primary-700" />
          </div>
        </div>
      </div>
    );
  }

  if (!message) {
    throw new Error('ChatMessage requires a message when not loading.');
  }

  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <article
        className={cn(
          'w-full max-w-3xl rounded-2xl px-4 py-3 shadow-sm',
          isUser
            ? 'bg-accent-600 text-white'
            : 'border border-primary-200 bg-white text-primary-900 dark:border-primary-800 dark:bg-primary-900 dark:text-primary-50',
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className={cn('text-xs font-semibold uppercase tracking-[0.2em]', isUser ? 'text-accent-100' : 'text-primary-500 dark:text-primary-300')}>
            {isUser ? 'You' : 'Assistant'}
          </span>
          <time className={cn('text-xs', isUser ? 'text-accent-100/90' : 'text-primary-500 dark:text-primary-400')}>
            {getRelativeTimestamp(message.createdAt)}
          </time>
        </div>
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-code:text-accent-500 dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {!isUser && message.citations?.length ? <Citations citations={message.citations} /> : null}
      </article>
    </div>
  );
}
