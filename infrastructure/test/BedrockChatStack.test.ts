import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { BedrockChatStack } from '../stacks/BedrockChatStack';

describe('BedrockChatStack', () => {
  const app = new cdk.App();
  const stack = new BedrockChatStack(app, 'TestBedrockChatStack');
  const template = Template.fromStack(stack);

  test('creates a versioned documents bucket', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: {
        Status: 'Enabled',
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
    });
  });

  test('creates the conversations table with the expected keys and gsi', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'bedrock-rag-conversations',
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'userId-createdAt-index',
          KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' },
            { AttributeName: 'createdAt', KeyType: 'RANGE' },
          ],
        }),
      ]),
    });
  });

  test('creates a cognito user pool', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AutoVerifiedAttributes: ['email'],
      MfaConfiguration: 'OPTIONAL',
      Policies: {
        PasswordPolicy: Match.objectLike({
          MinimumLength: 8,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
          RequireUppercase: true,
        }),
      },
    });
  });

  test('creates the lambda functions', () => {
    template.resourceCountIs('AWS::Lambda::Function', 3);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
      Handler: 'handlers/chat.handler',
      Timeout: 30,
      MemorySize: 512,
    });
  });

  test('creates the api gateway resources', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'bedrock-rag-api',
    });
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'v1',
    });
  });
});
