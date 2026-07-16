import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { Conversation, Message } from '../models/conversation';

const MESSAGE_PREFIX = 'MSG#';
const METADATA_SK = 'METADATA';
const USER_CREATED_AT_INDEX = 'userId-createdAt-index';

export class ConversationRepository {
  public constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  public async saveMessage(message: Message): Promise<void> {
    const conversationKey = this.buildConversationKey(message.conversationId);

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: conversationKey,
          SK: this.buildMessageSortKey(message.timestamp, message.id),
          entityType: 'MESSAGE',
          ...message,
        },
      }),
    );

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: conversationKey,
          SK: METADATA_SK,
        },
        UpdateExpression: 'SET updatedAt = :updatedAt ADD messageCount :increment',
        ExpressionAttributeValues: {
          ':updatedAt': message.timestamp,
          ':increment': 1,
        },
      }),
    );
  }

  public async getMessages(conversationId: string, limit?: number): Promise<Message[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :messagePrefix)',
        ExpressionAttributeValues: {
          ':pk': this.buildConversationKey(conversationId),
          ':messagePrefix': MESSAGE_PREFIX,
        },
        ScanIndexForward: true,
        Limit: limit,
      }),
    );

    return (response.Items ?? [])
      .map((item) => this.mapMessage(item))
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  public async createConversation(conversation: Conversation): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.buildConversationKey(conversation.id),
          SK: METADATA_SK,
          entityType: 'CONVERSATION',
          ...conversation,
        },
      }),
    );
  }

  public async getConversation(conversationId: string): Promise<Conversation | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: this.buildConversationKey(conversationId),
          SK: METADATA_SK,
        },
      }),
    );

    if (!response.Item) {
      return null;
    }

    return this.mapConversation(response.Item);
  }

  public async listConversations(userId: string): Promise<Conversation[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: USER_CREATED_AT_INDEX,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false,
      }),
    );

    return (response.Items ?? []).map((item) => this.mapConversation(item));
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    const partitionKey = this.buildConversationKey(conversationId);
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': partitionKey,
          },
          ProjectionExpression: 'PK, SK',
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      const items = response.Items ?? [];
      for (const chunk of this.chunk(items, 25)) {
        await this.client.send(
          new BatchWriteCommand({
            RequestItems: {
              [this.tableName]: chunk.map((item) => ({
                DeleteRequest: {
                  Key: {
                    PK: item.PK,
                    SK: item.SK,
                  },
                },
              })),
            },
          }),
        );
      }

      lastEvaluatedKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);
  }

  public async updateConversationMetadata(
    conversationId: string,
    title: string,
    updatedAt: string,
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: this.buildConversationKey(conversationId),
          SK: METADATA_SK,
        },
        UpdateExpression: 'SET title = :title, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':title': title,
          ':updatedAt': updatedAt,
        },
      }),
    );
  }

  private buildConversationKey(conversationId: string): string {
    return `CONV#${conversationId}`;
  }

  private buildMessageSortKey(timestamp: string, messageId: string): string {
    return `${MESSAGE_PREFIX}${timestamp}#${messageId}`;
  }

  private mapMessage(item: Record<string, unknown>): Message {
    return {
      id: this.asString(item.id, 'message.id'),
      conversationId: this.asString(item.conversationId, 'message.conversationId'),
      role: this.asRole(item.role),
      content: this.asString(item.content, 'message.content'),
      timestamp: this.asString(item.timestamp, 'message.timestamp'),
      citations: this.asCitations(item.citations),
    };
  }

  private mapConversation(item: Record<string, unknown>): Conversation {
    return {
      id: this.asString(item.id, 'conversation.id'),
      userId: this.asString(item.userId, 'conversation.userId'),
      title: this.asString(item.title, 'conversation.title'),
      createdAt: this.asString(item.createdAt, 'conversation.createdAt'),
      updatedAt: this.asString(item.updatedAt, 'conversation.updatedAt'),
      messageCount: this.asNumber(item.messageCount, 'conversation.messageCount'),
    };
  }

  private asString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new Error(`Expected ${fieldName} to be a string.`);
    }

    return value;
  }

  private asNumber(value: unknown, fieldName: string): number {
    if (typeof value !== 'number') {
      throw new Error(`Expected ${fieldName} to be a number.`);
    }

    return value;
  }

  private asRole(value: unknown): Message['role'] {
    if (value === 'user' || value === 'assistant') {
      return value;
    }

    throw new Error('Expected message.role to be either user or assistant.');
  }

  private asCitations(value: unknown): Message['citations'] {
    if (typeof value === 'undefined') {
      return undefined;
    }

    if (!Array.isArray(value)) {
      throw new Error('Expected message.citations to be an array when defined.');
    }

    return value.flatMap((entry) => {
      if (!this.isRecord(entry)) {
        return [];
      }

      const documentId = entry.documentId;
      const documentTitle = entry.documentTitle;
      const excerpt = entry.excerpt;
      const location = entry.location;

      if (
        typeof documentId === 'string' &&
        typeof documentTitle === 'string' &&
        typeof excerpt === 'string' &&
        (typeof location === 'string' || typeof location === 'undefined')
      ) {
        return [{ documentId, documentTitle, excerpt, location }];
      }

      return [];
    });
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private chunk(items: Record<string, unknown>[], size: number): Record<string, unknown>[][] {
    const chunks: Record<string, unknown>[][] = [];

    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }
}
