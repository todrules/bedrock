import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { ApplicationError } from '../models/conversation';
import { ConversationRepository } from '../repositories/conversationRepository';
import { BedrockService } from '../services/bedrockService';
import { ConversationService } from '../services/conversationService';
import { createLogger } from '../utils/logger';
import { error, success } from '../utils/response';
import { validateChatRequest } from '../utils/validation';

const logger = createLogger('chat-handler');
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
  logger.info('Received chat request.', {
    requestId: event.requestContext.requestId,
    path: event.path,
    method: event.httpMethod,
  });

  try {
    const userId = extractUserId(event);
    if (!userId) {
      return error('Unauthorized', 401);
    }

    const parsedBody = parseBody(event.body);
    const request = validateChatRequest({
      ...(parsedBody ?? {}),
      userId,
    });

    const response = await getConversationService().chat(request);
    logger.info('Chat request completed successfully.', {
      requestId: event.requestContext.requestId,
      conversationId: response.conversationId,
      messageId: response.messageId,
    });

    return success(response);
  } catch (caughtError: unknown) {
    return handleError(caughtError, event.requestContext.requestId);
  }
};

const parseBody = (body: string | null): Record<string, unknown> | null => {
  if (!body) {
    return null;
  }

  const parsed = JSON.parse(body) as unknown;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new ApplicationError('VALIDATION_ERROR', 'Request body must be a JSON object.', 400);
  }

  return parsed as Record<string, unknown>;
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
    logger.warn('Chat request failed with application error.', {
      requestId,
      code: caughtError.code,
      details: caughtError.details,
    });

    return error(caughtError.message, caughtError.statusCode, {
      code: caughtError.code,
      details: caughtError.details,
    });
  }

  if (caughtError instanceof SyntaxError) {
    logger.warn('Chat request body could not be parsed.', { requestId, error: caughtError.message });
    return error('Request body must contain valid JSON.', 400);
  }

  logger.error('Unhandled chat request error.', {
    requestId,
    error: caughtError instanceof Error ? caughtError.message : 'Unknown error',
  });

  return error('Internal server error.', 500);
};
