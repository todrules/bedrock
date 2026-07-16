'use client';

import { useCallback, useState } from 'react';

import { ApiError, apiService } from '@/services/api';
import type { Message } from '@/types';

interface UseChatResult {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  currentConversationId: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearError: () => void;
  startNewConversation: () => void;
  loadConversation: (conversationId: string) => Promise<void>;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setError(null);
  }, []);

  const loadConversation = useCallback(async (conversationId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const conversation = await apiService.getConversation(conversationId);
      setMessages(conversation.messages);
      setCurrentConversationId(conversation.id);
    } catch (caughtError) {
      const nextError = caughtError instanceof Error ? caughtError.message : 'Unable to load conversation.';
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();

      if (!trimmedContent || isLoading) {
        return;
      }

      setIsLoading(true);
      setError(null);

      const optimisticMessage: Message = {
        id: createId('user'),
        conversationId: currentConversationId ?? 'pending',
        role: 'user',
        content: trimmedContent,
        createdAt: new Date().toISOString(),
      };

      setMessages((currentMessages) => [...currentMessages, optimisticMessage]);

      try {
        const response = await apiService.sendMessage({
          content: trimmedContent,
          conversationId: currentConversationId ?? undefined,
        });

        setCurrentConversationId(response.conversation.id);
        setMessages((currentMessages) => {
          const withoutOptimistic = currentMessages.filter((message) => message.id !== optimisticMessage.id);

          return [...withoutOptimistic, response.userMessage, response.assistantMessage];
        });
      } catch (caughtError) {
        const nextError =
          caughtError instanceof ApiError || caughtError instanceof Error
            ? caughtError.message
            : 'Unable to send your message.';
        setError(nextError);
      } finally {
        setIsLoading(false);
      }
    },
    [currentConversationId, isLoading],
  );

  return {
    messages,
    isLoading,
    error,
    currentConversationId,
    sendMessage,
    clearError,
    startNewConversation,
    loadConversation,
  };
}
