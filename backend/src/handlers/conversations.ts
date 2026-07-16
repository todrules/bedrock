import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { ApplicationError, ConversationWithMessages } from '../models/conversation';
import { ConversationRepository } from '../repositories/conversationRepository';
import { BedrockService } from '../services/bedrockService';
import { ConversationService } from '../services/conversationService';
import { createLogger } from '../utils/logger';
import { error, success } from '../utils/response';

const logger = createLogger('conversations-handler');
let conversationService: ConversationService | undefined;

const getConversationService = (): ConversationService => {
  if (!conversationService) {
    const tableName = process.env.CONVERSATIONS_TABLE_NAME;
    const knowledgeBaseId = process.env.KNOWLEDGE_BASE_ID;
    const modelId = process.env.BEDROCK_MODEL_ID;

    if (!tableName || !knowledgeBaseId || !modelId) {
      throw new ApplicationError(
        'CONFIGURATION_ERROR',
        'Required backend environment variables are missing.',
        500,
      );
    }

    const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const bedrockClient = new BedrockAgentRuntimeClient({});
    const repository = new ConversationRepository(documentClient, tableName);
    const bedrockService = new BedrockService(bedrockClient, knowledgeBaseId, modelId);

    conversationService = new ConversationService(repository, bedrockService);
  }

  return conversationService;
};

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  logger.info('Received conversation request.', {
    requestId: event.requestContext.requestId,
    path: event.path,
    method: event.httpMethod,
    conversationId: event.pathParameters?.id,
  });

  try {
    const userId = extractUserId(event);
    if (!userId) {
      return error('Unauthorized', 401);
    }

    const service = getConversationService();
    const conversationId = event.pathParameters?.id;

    if (event.httpMethod === 'GET' && !conversationId) {
      const response = await service.listConversations(userId);
      return success(response);
    }

    if (event.httpMethod === 'GET' && conversationId) {
      const conversation = await service.getConversation(conversationId);
      ensureOwnership(conversation, userId);
      return success(conversation);
    }

    if (event.httpMethod === 'DELETE' && conversationId) {
      const conversation = await service.getConversation(conversationId);
      ensureOwnership(conversation, userId);
      await service.deleteConversation(conversationId);
      return success({ deleted: true });
    }

    return error('Route not found.', 404);
  } catch (caughtError: unknown) {
    return handleError(caughtError, event.requestContext.requestId);
  }
};

const ensureOwnership = (conversation: ConversationWithMessages, userId: string): void => {
  if (conversation.userId !== userId) {
    throw new ApplicationError('CONVERSATION_ACCESS_DENIED', 'Conversation access denied.', 403);
  }
};

const extractUserId = (event: APIGatewayProxyEvent): string | null => {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) {
    return null;
  }

  const claims = (authorizer as Record<string, unknown>).claims;
  if (typeof claims !== 'object' || claims === null) {
    return null;
  }

  const subject = (claims as Record<string, unknown>).sub;
  return typeof subject === 'string' && subject.length > 0 ? subject : null;
};

const handleError = (
  caughtError: unknown,
  requestId?: string,
): APIGatewayProxyResult => {
  if (caughtError instanceof ApplicationError) {
    logger.warn('Conversation request failed with application error.', {
      requestId,
      code: caughtError.code,
      details: caughtError.details,
    });

    return error(caughtError.message, caughtError.statusCode, {
      code: caughtError.code,
      details: caughtError.details,
    });
  }

  logger.error('Unhandled conversation request error.', {
    requestId,
    error: caughtError instanceof Error ? caughtError.message : 'Unknown error',
  });

  return error('Internal server error.', 500);
};
