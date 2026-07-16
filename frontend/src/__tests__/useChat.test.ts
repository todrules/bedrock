import { act, renderHook, waitFor } from '@testing-library/react';

import { useChat } from '@/hooks/useChat';
import { apiService } from '@/services/api';

jest.mock('@/services/api', () => ({
  apiService: {
    sendMessage: jest.fn(),
    getConversation: jest.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

const mockedApiService = apiService as jest.Mocked<typeof apiService>;

describe('useChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the initial state', () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.currentConversationId).toBeNull();
  });

  it('sendMessage updates messages', async () => {
    mockedApiService.sendMessage.mockResolvedValue({
      conversation: {
        id: 'conversation-1',
        title: 'New conversation',
        createdAt: '2026-07-16T19:55:47.134Z',
        updatedAt: '2026-07-16T19:55:47.134Z',
      },
      userMessage: {
        id: 'message-user',
        conversationId: 'conversation-1',
        role: 'user',
        content: 'What is Bedrock?',
        createdAt: '2026-07-16T19:55:47.134Z',
      },
      assistantMessage: {
        id: 'message-assistant',
        conversationId: 'conversation-1',
        role: 'assistant',
        content: 'Bedrock is your enterprise knowledge assistant.',
        createdAt: '2026-07-16T19:55:48.134Z',
        citations: [],
      },
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('What is Bedrock?');
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.currentConversationId).toBe('conversation-1');
    expect(result.current.messages[0].content).toBe('What is Bedrock?');
    expect(result.current.messages[1].content).toBe('Bedrock is your enterprise knowledge assistant.');
  });

  it('handles API errors', async () => {
    mockedApiService.sendMessage.mockRejectedValue(new Error('Request failed'));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Failing request');
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Request failed');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Failing request');
  });
});
