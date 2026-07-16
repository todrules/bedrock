'use client';

import { useCallback, useState } from 'react';

import { apiService } from '@/services/api';
import type { Conversation } from '@/types';

interface UseConversationsResult {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  fetchConversations: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
}

export function useConversations(): UseConversationsResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const items = await apiService.listConversations();
      setConversations(
        [...items].sort(
          (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        ),
      );
    } catch (caughtError) {
      const nextError = caughtError instanceof Error ? caughtError.message : 'Unable to fetch conversations.';
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    setError(null);

    try {
      await apiService.deleteConversation(id);
      setConversations((currentConversations) =>
        currentConversations.filter((conversation) => conversation.id !== id),
      );
    } catch (caughtError) {
      const nextError = caughtError instanceof Error ? caughtError.message : 'Unable to delete conversation.';
      setError(nextError);
    }
  }, []);

  return {
    conversations,
    isLoading,
    error,
    fetchConversations,
    deleteConversation,
  };
}
