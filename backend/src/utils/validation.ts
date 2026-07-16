import { validate as validateUuid } from 'uuid';

import { ApplicationError, ChatRequest } from '../models/conversation';

export function validateRequired(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApplicationError(
      'VALIDATION_ERROR',
      `${fieldName} is required and must be a non-empty string.`,
      400,
    );
  }
}

export function isValidUUID(value: string): boolean {
  return validateUuid(value);
}

export function validateChatRequest(body: unknown): ChatRequest {
  if (typeof body !== 'object' || body === null) {
    throw new ApplicationError('VALIDATION_ERROR', 'Request body must be a JSON object.', 400);
  }

  const candidate = body as Record<string, unknown>;
  const message = candidate.message;
  const userId = candidate.userId;
  const conversationId = candidate.conversationId;

  validateRequired(message, 'message');
  validateRequired(userId, 'userId');

  if (typeof conversationId !== 'undefined') {
    validateRequired(conversationId, 'conversationId');
    if (!isValidUUID(conversationId)) {
      throw new ApplicationError('VALIDATION_ERROR', 'conversationId must be a valid UUID.', 400);
    }
  }

  return {
    conversationId: typeof conversationId === 'string' ? conversationId : undefined,
    message: message.trim(),
    userId: userId.trim(),
  };
}
