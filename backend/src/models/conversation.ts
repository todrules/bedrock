export type MessageRole = 'user' | 'assistant';

export interface Citation {
  documentId: string;
  documentTitle: string;
  excerpt: string;
  location?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  citations?: Citation[];
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface CreateMessageRequest {
  conversationId: string;
  message: string;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  userId: string;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  content: string;
  citations: Citation[];
  sessionId?: string;
}

export interface ListConversationsResponse {
  conversations: Conversation[];
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApplicationError extends Error implements ApiError {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  public constructor(code: string, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
