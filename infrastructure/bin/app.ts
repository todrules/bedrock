#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BedrockChatStack } from '../stacks/BedrockChatStack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

new BedrockChatStack(app, 'BedrockChatStack', {
  env,
  stackName: 'bedrock-rag-chatbot',
  description: 'Enterprise RAG Chatbot using Amazon Bedrock',
  tags: {
    Project: 'BedrockRagChatbot',
    Environment: process.env.ENVIRONMENT ?? 'dev',
    ManagedBy: 'CDK',
  },
});
