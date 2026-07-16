'use client';

import { LoaderCircle, SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void> | void;
  isLoading?: boolean;
  maxLength?: number;
}

export function ChatInput({ onSendMessage, isLoading = false, maxLength = 4000 }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isDisabled = isLoading || value.trim().length === 0 || value.length > maxLength;

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  const handleSubmit = async (): Promise<void> => {
    if (isDisabled) {
      return;
    }

    const nextValue = value.trim();
    setValue('');
    await onSendMessage(nextValue);
    textareaRef.current?.focus();
  };

  return (
    <div
      className="rounded-2xl border border-primary-200 bg-white p-3 shadow-sm dark:border-primary-800 dark:bg-primary-900"
      onKeyDown={(event) => {
        if (event.key !== 'Tab' || !textareaRef.current || !buttonRef.current) {
          return;
        }

        const activeElement = document.activeElement;

        if (event.shiftKey && activeElement === textareaRef.current) {
          event.preventDefault();
          buttonRef.current.focus();
        } else if (!event.shiftKey && activeElement === buttonRef.current) {
          event.preventDefault();
          textareaRef.current.focus();
        }
      }}
    >
      <label className="sr-only" htmlFor="chat-input">
        Message input
      </label>
      <textarea
        id="chat-input"
        ref={textareaRef}
        rows={1}
        value={value}
        disabled={isLoading}
        maxLength={maxLength}
        placeholder="Ask a question about your enterprise knowledge base..."
        className="max-h-52 min-h-[3rem] w-full resize-none border-0 bg-transparent text-sm text-primary-950 outline-none placeholder:text-primary-400 disabled:cursor-not-allowed dark:text-primary-50 dark:placeholder:text-primary-500"
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className={cn('text-xs', value.length > maxLength ? 'text-red-500' : 'text-primary-500 dark:text-primary-400')}>
          {value.length}/{maxLength}
        </p>
        <button
          ref={buttonRef}
          type="button"
          disabled={isDisabled}
          className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:bg-primary-300 disabled:text-primary-100 dark:disabled:bg-primary-700"
          onClick={() => {
            void handleSubmit();
          }}
        >
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
          Send
        </button>
      </div>
    </div>
  );
}
