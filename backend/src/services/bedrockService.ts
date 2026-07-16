import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { v4 as uuidv4 } from 'uuid';

import { ApplicationError, Citation } from '../models/conversation';

interface RetrieveAndGenerateParams {
  message: string;
  sessionId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

interface RetrieveAndGenerateResult {
  output: string;
  citations: Citation[];
  sessionId: string;
}

export class BedrockService {
  public constructor(
    private readonly client: BedrockAgentRuntimeClient,
    private readonly knowledgeBaseId: string,
    private readonly modelId: string,
  ) {}

  public async retrieveAndGenerate(
    params: RetrieveAndGenerateParams,
  ): Promise<RetrieveAndGenerateResult> {
    try {
      const response = await this.client.send(
        new RetrieveAndGenerateCommand({
          input: {
            text: this.buildPrompt(params.message, params.conversationHistory),
          },
          sessionId: params.sessionId,
          retrieveAndGenerateConfiguration: {
            type: 'KNOWLEDGE_BASE',
            knowledgeBaseConfiguration: {
              knowledgeBaseId: this.knowledgeBaseId,
              modelArn: this.modelId,
            },
          },
        }),
      );

      const output = response.output?.text;
      if (typeof output !== 'string' || output.trim().length === 0) {
        throw new ApplicationError(
          'BEDROCK_INVALID_RESPONSE',
          'Bedrock returned an empty response.',
          502,
          response,
        );
      }

      return {
        output,
        citations: this.mapCitations(response.citations),
        sessionId: response.sessionId ?? params.sessionId ?? uuidv4(),
      };
    } catch (error: unknown) {
      if (error instanceof ApplicationError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new ApplicationError(
          'BEDROCK_RETRIEVE_FAILED',
          'Failed to retrieve and generate a Bedrock response.',
          502,
          { cause: error.message },
        );
      }

      throw new ApplicationError(
        'BEDROCK_RETRIEVE_FAILED',
        'Failed to retrieve and generate a Bedrock response.',
        502,
      );
    }
  }

  private buildPrompt(
    message: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ): string {
    const trimmedMessage = message.trim();
    const normalizedHistory = conversationHistory
      ?.filter((entry) => entry.content.trim().length > 0)
      .slice(-10)
      .map((entry) => `${entry.role}: ${entry.content.trim()}`)
      .join('\n');

    if (!normalizedHistory) {
      return trimmedMessage;
    }

    return [
      'Use the following conversation history to answer the latest user request.',
      'Conversation history:',
      normalizedHistory,
      'Latest user request:',
      trimmedMessage,
    ].join('\n\n');
  }

  private mapCitations(citations: unknown): Citation[] {
    if (!Array.isArray(citations)) {
      return [];
    }

    return citations.flatMap((citation) => this.mapCitationEntry(citation));
  }

  private mapCitationEntry(citation: unknown): Citation[] {
    if (!this.isRecord(citation)) {
      return [];
    }

    const references = citation.retrievedReferences;
    if (!Array.isArray(references)) {
      return [];
    }

    return references.flatMap((reference) => this.mapReference(reference));
  }

  private mapReference(reference: unknown): Citation[] {
    if (!this.isRecord(reference)) {
      return [];
    }

    const metadata = this.asRecord(reference.metadata);
    const content = this.asRecord(reference.content);
    const location = this.asRecord(reference.location);

    const documentId =
      this.readString(metadata, 'x-amz-bedrock-kb-document-id') ??
      this.readString(metadata, 'documentId') ??
      this.extractLocation(location) ??
      uuidv4();
    const documentTitle =
      this.readString(metadata, 'title') ??
      this.readString(metadata, 'documentTitle') ??
      documentId;
    const excerpt = this.readString(content, 'text') ?? '';

    return [
      {
        documentId,
        documentTitle,
        excerpt,
        location: this.extractLocation(location),
      },
    ];
  }

  private extractLocation(location: Record<string, unknown> | null): string | undefined {
    if (!location) {
      return undefined;
    }

    for (const value of Object.values(location)) {
      if (!this.isRecord(value)) {
        continue;
      }

      const uri = value.uri;
      if (typeof uri === 'string') {
        return uri;
      }
    }

    const type = location.type;
    if (typeof type === 'string') {
      return type;
    }

    return undefined;
  }

  private readString(record: Record<string, unknown> | null, key: string): string | undefined {
    if (!record) {
      return undefined;
    }

    const value = record[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return this.isRecord(value) ? value : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
