import 'aws-sdk-client-mock-jest';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

import { ConversationRepository } from '../repositories/conversationRepository';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('ConversationRepository', () => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const repository = new ConversationRepository(client, 'conversations');

  beforeEach(() => {
    ddbMock.reset();
  });

  it('saveMessage', async () => {
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(UpdateCommand).resolves({});

    await repository.saveMessage({
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hello',
      timestamp: '2024-01-01T00:00:00.000Z',
    });

    expect(ddbMock).toHaveReceivedCommandTimes(PutCommand, 1);
    expect(ddbMock).toHaveReceivedCommandTimes(UpdateCommand, 1);
  });

  it('getMessages ordered by timestamp', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Second',
          timestamp: '2024-01-01T00:00:02.000Z',
        },
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: 'First',
          timestamp: '2024-01-01T00:00:01.000Z',
        },
      ],
    });

    const messages = await repository.getMessages('conv-1');

    expect(messages.map((message) => message.id)).toEqual(['msg-1', 'msg-2']);
  });

  it('createConversation', async () => {
    ddbMock.on(PutCommand).resolves({});

    await repository.createConversation({
      id: 'conv-1',
      userId: 'user-1',
      title: 'New conversation',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      messageCount: 0,
    });

    expect(ddbMock).toHaveReceivedCommandTimes(PutCommand, 1);
  });

  it('listConversations for a user', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          id: 'conv-2',
          userId: 'user-1',
          title: 'Most recent',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          messageCount: 4,
        },
        {
          id: 'conv-1',
          userId: 'user-1',
          title: 'Older conversation',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          messageCount: 2,
        },
      ],
    });

    const conversations = await repository.listConversations('user-1');

    expect(conversations).toHaveLength(2);
    expect(conversations[0]?.id).toBe('conv-2');
  });
});
