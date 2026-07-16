# Local Development Guide

This guide walks you through setting up and running the Bedrock RAG Chatbot locally.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 10 | bundled with Node.js |
| AWS CLI | ≥ 2 | [aws.amazon.com/cli](https://aws.amazon.com/cli) |
| AWS CDK | ≥ 2.147 | `npm install -g aws-cdk` |

## Repository Structure

```
bedrock-rag-chatbot/
├── frontend/          # Next.js 14 + React 19 frontend
├── backend/           # AWS Lambda functions (TypeScript)
├── infrastructure/    # AWS CDK stacks
├── docs/              # Documentation
└── .github/workflows/ # CI/CD pipelines
```

## 1. Clone & Install

```bash
git clone https://github.com/todrules/bedrock.git
cd bedrock

# Install all workspace dependencies
npm install
```

## 2. AWS Configuration

### Configure AWS credentials

```bash
aws configure
# Or use AWS SSO:
aws configure sso
```

Ensure your AWS profile has permissions for:
- Amazon Bedrock (model invocation, knowledge base)
- DynamoDB (read/write)
- Lambda (invoke)
- API Gateway (invoke)
- Cognito (user management)

### Enable Bedrock model access

1. Open the [AWS Console → Bedrock → Model access](https://console.aws.amazon.com/bedrock/home#/modelaccess)
2. Request access for:
   - **Anthropic Claude 3.5 Sonnet** (`anthropic.claude-3-5-sonnet-20241022-v2:0`)
   - **Amazon Titan Embeddings V2** (`amazon.titan-embed-text-v2:0`)

## 3. Deploy Infrastructure (Required for Backend)

```bash
cd infrastructure
npm ci
npm run build

# Bootstrap CDK (one-time per account/region)
npx cdk bootstrap

# Deploy all stacks
npx cdk deploy BedrockChatStack --outputs-file ../cdk-outputs.json
```

Note the outputs – you'll need them for the frontend environment variables.

## 4. Create a Knowledge Base

After deploying infrastructure, set up the Knowledge Base:

### Option A: AWS Console

1. Navigate to **Bedrock → Knowledge Bases**
2. Click **Create knowledge base**
3. Name: `bedrock-rag-knowledge-base`
4. Data source: Select the S3 bucket created by CDK (output: `DocumentsBucketName`)
5. Embedding model: **Amazon Titan Embeddings V2**
6. Vector store: **Amazon OpenSearch Serverless** (create new)
7. Complete creation and note the **Knowledge Base ID**

### Option B: AWS CLI

```bash
# Get the S3 bucket name from CDK outputs
BUCKET_NAME=$(cat cdk-outputs.json | jq -r '.BedrockChatStack.DocumentsBucketName')

# Create Knowledge Base (adjust roleArn)
aws bedrock create-knowledge-base \
  --name bedrock-rag-knowledge-base \
  --role-arn arn:aws:iam::YOUR_ACCOUNT:role/BedrockKnowledgeBaseRole \
  --knowledge-base-configuration '{"type":"VECTOR","vectorKnowledgeBaseConfiguration":{"embeddingModelArn":"arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"}}' \
  --storage-configuration '{"type":"OPENSEARCH_SERVERLESS","opensearchServerlessConfiguration":{"collectionArn":"YOUR_COLLECTION_ARN","vectorIndexName":"bedrock-rag-index","fieldMapping":{"vectorField":"embedding","textField":"text","metadataField":"metadata"}}}'
```

### Update Lambda environment variables

After obtaining the Knowledge Base ID:

```bash
KNOWLEDGE_BASE_ID="your-kb-id"
FUNCTION_NAME=$(aws lambda list-functions --query "Functions[?starts_with(FunctionName,'BedrockChatStack-chat')].FunctionName" --output text)

aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --environment "Variables={KNOWLEDGE_BASE_ID=$KNOWLEDGE_BASE_ID,CONVERSATIONS_TABLE_NAME=bedrock-rag-conversations,MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0}"
```

## 5. Upload Documents to S3

```bash
BUCKET_NAME=$(cat cdk-outputs.json | jq -r '.BedrockChatStack.DocumentsBucketName')

# Upload your PDF, TXT, or DOCX files
aws s3 cp ./my-document.pdf s3://$BUCKET_NAME/documents/

# Sync a directory
aws s3 sync ./documents/ s3://$BUCKET_NAME/documents/
```

Then trigger a Knowledge Base sync:

```bash
aws bedrock start-ingestion-job \
  --knowledge-base-id "$KNOWLEDGE_BASE_ID" \
  --data-source-id YOUR_DATA_SOURCE_ID
```

## 6. Backend – Local Development

For local Lambda testing, you can invoke functions using SAM or directly with the CLI.

```bash
cd backend
npm ci
npm run build
npm run test
```

To test a handler locally with a mock event:

```bash
# Create a test event
cat > /tmp/event.json <<EOF
{
  "httpMethod": "POST",
  "body": "{\"message\": \"What is this document about?\"}",
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "test-user-id",
        "email": "test@example.com"
      }
    }
  }
}
EOF

# Invoke via AWS CLI (requires deployed Lambda)
FUNCTION_NAME=$(aws lambda list-functions --query "Functions[?starts_with(FunctionName,'BedrockChatStack-chat')].FunctionName" --output text)
aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload file:///tmp/event.json \
  --cli-binary-format raw-in-base64-out \
  /tmp/response.json
cat /tmp/response.json
```

## 7. Frontend – Local Development

```bash
cd frontend
npm ci

# Create environment file
cat > .env.local <<EOF
NEXT_PUBLIC_API_URL=$(cat ../cdk-outputs.json | jq -r '.BedrockChatStack.ApiUrl')
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$(cat ../cdk-outputs.json | jq -r '.BedrockChatStack.UserPoolId')
NEXT_PUBLIC_COGNITO_CLIENT_ID=$(cat ../cdk-outputs.json | jq -r '.BedrockChatStack.UserPoolClientId')
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_DOMAIN=your-cognito-domain.auth.us-east-1.amazoncognito.com
EOF

npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000).

## 8. Running Tests

```bash
# All workspaces
npm run test

# Backend only
cd backend && npm run test:coverage

# Frontend only
cd frontend && npm run test:coverage

# Infrastructure only
cd infrastructure && npm run test
```

## 9. Linting

```bash
# All workspaces
npm run lint

# Auto-fix
cd backend && npm run lint:fix
cd frontend && npm run lint -- --fix
```

## Troubleshooting

### "Bedrock model not found"
Ensure model access has been granted in the Bedrock console for your region.

### "Knowledge Base not found"
Update the `KNOWLEDGE_BASE_ID` Lambda environment variable.

### CORS errors from frontend
Ensure the API Gateway has CORS enabled (it does by default with our CDK setup) and that the `NEXT_PUBLIC_API_URL` does not have a trailing slash.

### Cognito authentication fails
Verify `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and `NEXT_PUBLIC_COGNITO_CLIENT_ID` match the CDK stack outputs.

### DynamoDB throttling
The table uses PAY_PER_REQUEST billing – no throttling should occur in normal use.
