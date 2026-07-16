export interface Citation {
  id: string;
  title: string;
  excerpt: string;
  url?: string;
  source?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  citations?: Citation[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  content: string;
  conversationId?: string;
}

export interface ChatResponse {
  conversation: Conversation;
  userMessage: Message;
  assistantMessage: Message;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}
