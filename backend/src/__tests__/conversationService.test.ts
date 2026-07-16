import { ChatRequest, Conversation, Message } from '../models/conversation';
import { ConversationRepository } from '../repositories/conversationRepository';
import { BedrockService } from '../services/bedrockService';
import { ConversationService } from '../services/conversationService';

type RepositoryMock = jest.Mocked<
  Pick<
    ConversationRepository,
    | 'createConversation'
    | 'deleteConversation'
    | 'getConversation'
    | 'getMessages'
    | 'listConversations'
    | 'saveMessage'
    | 'updateConversationMetadata'
  >
>;

type BedrockMock = jest.Mocked<Pick<BedrockService, 'retrieveAndGenerate'>>;

describe('ConversationService', () => {
  let repository: RepositoryMock;
  let bedrockService: BedrockMock;
  let service: ConversationService;

  beforeEach(() => {
    repository = {
      createConversation: jest.fn(),
      deleteConversation: jest.fn(),
      getConversation: jest.fn(),
      getMessages: jest.fn(),
      listConversations: jest.fn(),
      saveMessage: jest.fn(),
      updateConversationMetadata: jest.fn(),
    };

    bedrockService = {
      retrieveAndGenerate: jest.fn(),
    };

    service = new ConversationService(
      repository as unknown as ConversationRepository,
      bedrockService as unknown as BedrockService,
    );
  });

  it('chat() creates new conversation on first message', async () => {
    repository.createConversation.mockResolvedValue(undefined);
    repository.saveMessage.mockResolvedValue(undefined);
    repository.updateConversationMetadata.mockResolvedValue(undefined);
    bedrockService.retrieveAndGenerate.mockResolvedValue({
      output: 'Assistant response',
      citations: [],
      sessionId: 'session-1',
    });

    const request: ChatRequest = {
      userId: 'user-1',
      message: 'What is enterprise RAG?',
    };

    const response = await service.chat(request);

    expect(repository.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        title: 'What is enterprise RAG?',
        messageCount: 0,
      }),
    );
    expect(repository.saveMessage).toHaveBeenCalledTimes(2);
    expect(response.content).toBe('Assistant response');
    expect(response.sessionId).toBe('session-1');
  });

  it('chat() continues existing conversation', async () => {
    const existingConversation: Conversation = {
      id: 'conv-1',
      userId: 'user-1',
      title: 'Existing conversation',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:01:00.000Z',
      messageCount: 2,
    };
    const history: Message[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'user',
        content: 'First question',
        timestamp: '2024-01-01T00:00:10.000Z',
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'First answer',
        timestamp: '2024-01-01T00:00:20.000Z',
      },
    ];

    repository.getConversation.mockResolvedValue(existingConversation);
    repository.getMessages.mockResolvedValue(history);
    repository.saveMessage.mockResolvedValue(undefined);
    repository.updateConversationMetadata.mockResolvedValue(undefined);
    bedrockService.retrieveAndGenerate.mockResolvedValue({
      output: 'Follow-up answer',
      citations: [],
      sessionId: 'conv-1',
    });

    const request: ChatRequest = {
      userId: 'user-1',
      conversationId: 'conv-1',
      message: 'Follow-up question',
    };

    const response = await service.chat(request);

    expect(repository.getConversation).toHaveBeenCalledWith('conv-1');
    expect(repository.getMessages).toHaveBeenCalledWith('conv-1', 20);
    expect(bedrockService.retrieveAndGenerate).toHaveBeenCalledWith({
      message: 'Follow-up question',
      sessionId: 'conv-1',
      conversationHistory: history.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
    });
    expect(response.conversationId).toBe('conv-1');
  });

  it('listConversations returns user conversations', async () => {
    const conversations: Conversation[] = [
      {
        id: 'conv-1',
        userId: 'user-1',
        title: 'Conversation 1',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:10.000Z',
        messageCount: 2,
      },
    ];

    repository.listConversations.mockResolvedValue(conversations);

    await expect(service.listConversations('user-1')).resolves.toEqual({ conversations });
  });
});
