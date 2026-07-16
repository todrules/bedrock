import { v4 as uuidv4 } from 'uuid';

import {
  ApplicationError,
  ChatRequest,
  ChatResponse,
  Conversation,
  ConversationWithMessages,
  ListConversationsResponse,
  Message,
} from '../models/conversation';
import { ConversationRepository } from '../repositories/conversationRepository';
import { BedrockService } from './bedrockService';

export class ConversationService {
  public constructor(
    private readonly repository: ConversationRepository,
    private readonly bedrockService: BedrockService,
  ) {}

  public async chat(request: ChatRequest): Promise<ChatResponse> {
    const message = request.message.trim();
    const now = new Date().toISOString();

    if (message.length === 0) {
      throw new ApplicationError('VALIDATION_ERROR', 'Message must not be empty.', 400);
    }

    const conversation = await this.resolveConversation(request, now);
    const conversationHistory =
      request.conversationId !== undefined
        ? await this.repository.getMessages(conversation.id, 20)
        : [];

    const userMessage: Message = {
      id: uuidv4(),
      conversationId: conversation.id,
      role: 'user',
      content: message,
      timestamp: now,
    };

    await this.repository.saveMessage(userMessage);

    const bedrockResponse = await this.bedrockService.retrieveAndGenerate({
      message,
      sessionId: conversation.id,
      conversationHistory: conversationHistory.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
    });

    const assistantTimestamp = new Date().toISOString();
    const assistantMessage: Message = {
      id: uuidv4(),
      conversationId: conversation.id,
      role: 'assistant',
      content: bedrockResponse.output,
      timestamp: assistantTimestamp,
      citations: bedrockResponse.citations,
    };

    await this.repository.saveMessage(assistantMessage);
    await this.repository.updateConversationMetadata(
      conversation.id,
      conversation.title,
      assistantTimestamp,
    );

    return {
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      content: assistantMessage.content,
      citations: assistantMessage.citations ?? [],
      sessionId: bedrockResponse.sessionId,
    };
  }

  public async listConversations(userId: string): Promise<ListConversationsResponse> {
    return {
      conversations: await this.repository.listConversations(userId),
    };
  }

  public async getConversation(conversationId: string): Promise<ConversationWithMessages> {
    const conversation = await this.repository.getConversation(conversationId);
    if (!conversation) {
      throw new ApplicationError('CONVERSATION_NOT_FOUND', 'Conversation not found.', 404);
    }

    const messages = await this.repository.getMessages(conversationId);
    return {
      ...conversation,
      messages,
    };
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    const existingConversation = await this.repository.getConversation(conversationId);
    if (!existingConversation) {
      throw new ApplicationError('CONVERSATION_NOT_FOUND', 'Conversation not found.', 404);
    }

    await this.repository.deleteConversation(conversationId);
  }

  private async resolveConversation(
    request: ChatRequest,
    timestamp: string,
  ): Promise<Conversation> {
    if (!request.conversationId) {
      const conversation: Conversation = {
        id: uuidv4(),
        userId: request.userId,
        title: this.generateTitle(request.message),
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 0,
      };

      await this.repository.createConversation(conversation);
      return conversation;
    }

    const conversation = await this.repository.getConversation(request.conversationId);
    if (!conversation) {
      throw new ApplicationError('CONVERSATION_NOT_FOUND', 'Conversation not found.', 404);
    }

    if (conversation.userId !== request.userId) {
      throw new ApplicationError('CONVERSATION_ACCESS_DENIED', 'Conversation access denied.', 403);
    }

    return conversation;
  }

  private generateTitle(message: string): string {
    const normalized = message.trim().replace(/\s+/g, ' ');
    if (normalized.length <= 50) {
      return normalized;
    }

    return `${normalized.slice(0, 47).trimEnd()}...`;
  }
}
