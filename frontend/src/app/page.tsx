'use client';

import { useEffect } from 'react';

import { AuthWrapper } from '@/components/Auth/AuthWrapper';
import { ChatWindow } from '@/components/Chat/ChatWindow';
import { AppLayout } from '@/components/Layout/AppLayout';
import { ConversationSidebar } from '@/components/Sidebar/ConversationSidebar';
import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';

export default function HomePage() {
  const {
    messages,
    isLoading: isChatLoading,
    error: chatError,
    currentConversationId,
    sendMessage,
    startNewConversation,
    loadConversation,
  } = useChat();
  const {
    conversations,
    isLoading: isConversationsLoading,
    error: conversationsError,
    fetchConversations,
    deleteConversation,
  } = useConversations();

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  const handleSendMessage = async (content: string): Promise<void> => {
    await sendMessage(content);
    await fetchConversations();
  };

  const handleSelectConversation = async (id: string): Promise<void> => {
    await loadConversation(id);
  };

  const handleNewConversation = (): void => {
    startNewConversation();
  };

  const handleDeleteConversation = async (id: string): Promise<void> => {
    await deleteConversation(id);

    if (id === currentConversationId) {
      startNewConversation();
    }
  };

  return (
    <AuthWrapper>
      <AppLayout
        sidebar={
          <ConversationSidebar
            conversations={conversations}
            activeConversationId={currentConversationId}
            isLoading={isConversationsLoading}
            error={conversationsError}
            onSelectConversation={(id) => {
              void handleSelectConversation(id);
            }}
            onNewConversation={handleNewConversation}
            onDeleteConversation={(id) => {
              void handleDeleteConversation(id);
            }}
          />
        }
      >
        <ChatWindow messages={messages} isLoading={isChatLoading} error={chatError} onSendMessage={handleSendMessage} />
      </AppLayout>
    </AuthWrapper>
  );
}
