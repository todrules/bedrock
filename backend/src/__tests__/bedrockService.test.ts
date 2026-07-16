import 'aws-sdk-client-mock-jest';

import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { mockClient } from 'aws-sdk-client-mock';

import { ApplicationError } from '../models/conversation';
import { BedrockService } from '../services/bedrockService';

const bedrockMock = mockClient(BedrockAgentRuntimeClient);

describe('BedrockService', () => {
  beforeEach(() => {
    bedrockMock.reset();
  });

  it('successful retrieval and generation with citations', async () => {
    bedrockMock.on(RetrieveAndGenerateCommand).resolves({
      output: { text: 'Generated answer' },
      sessionId: 'session-123',
      citations: [
        {
          retrievedReferences: [
            {
              content: { text: 'Important source excerpt' },
              location: { s3Location: { uri: 's3://docs/source.pdf' } },
              metadata: {
                'x-amz-bedrock-kb-document-id': 'doc-1',
                title: 'Source Document',
              },
            },
          ],
        },
      ],
    } as never);

    const service = new BedrockService(
      new BedrockAgentRuntimeClient({}),
      'kb-123',
      'arn:aws:bedrock:us-east-1::foundation-model/test-model',
    );

    const response = await service.retrieveAndGenerate({ message: 'What is RAG?' });

    expect(response).toEqual({
      output: 'Generated answer',
      sessionId: 'session-123',
      citations: [
        {
          documentId: 'doc-1',
          documentTitle: 'Source Document',
          excerpt: 'Important source excerpt',
          location: 's3://docs/source.pdf',
        },
      ],
    });
    expect(bedrockMock).toHaveReceivedCommandTimes(RetrieveAndGenerateCommand, 1);
  });

  it('handles when no citations are returned', async () => {
    bedrockMock.on(RetrieveAndGenerateCommand).resolves({
      output: { text: 'Generated answer without citations' },
      sessionId: 'session-123',
    } as never);

    const service = new BedrockService(
      new BedrockAgentRuntimeClient({}),
      'kb-123',
      'arn:aws:bedrock:us-east-1::foundation-model/test-model',
    );

    const response = await service.retrieveAndGenerate({ message: 'Summarize this.' });

    expect(response.citations).toEqual([]);
    expect(response.output).toBe('Generated answer without citations');
  });

  it('handles errors when the Bedrock API fails', async () => {
    bedrockMock.on(RetrieveAndGenerateCommand).rejects(new Error('Bedrock unavailable'));

    const service = new BedrockService(
      new BedrockAgentRuntimeClient({}),
      'kb-123',
      'arn:aws:bedrock:us-east-1::foundation-model/test-model',
    );

    await expect(service.retrieveAndGenerate({ message: 'Hello' })).rejects.toMatchObject<
      Partial<ApplicationError>
    >({
      code: 'BEDROCK_RETRIEVE_FAILED',
      statusCode: 502,
    });
  });
});
