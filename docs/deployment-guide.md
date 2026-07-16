# Deployment Guide

This guide covers deploying the Bedrock RAG Chatbot to AWS.

## Architecture Overview

```
User → CloudFront → S3 (Next.js static)
                ↓
User → API Gateway → Lambda (chat/conversations)
                         ↓
                    Bedrock Knowledge Base
                    DynamoDB (chat history)
                    Bedrock LLM (Claude 3.5 Sonnet)
```

## Prerequisites

- AWS Account with Bedrock model access
- AWS CLI configured with deployment credentials
- Node.js ≥ 20 and npm ≥ 10
- GitHub repository with Actions enabled

## Required AWS IAM Permissions

The deployment IAM role needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "lambda:*",
        "apigateway:*",
        "dynamodb:*",
        "cognito-idp:*",
        "bedrock:*",
        "iam:*",
        "logs:*",
        "ssm:*"
      ],
      "Resource": "*"
    }
  ]
}
```

> **Note**: In production, scope these permissions down to specific resources.

## Deployment Steps

### Step 1: Bootstrap CDK

CDK bootstrapping is a one-time operation per AWS account/region.

```bash
cd infrastructure
npm ci
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
```

### Step 2: Deploy Infrastructure

```bash
cd infrastructure
npm run build
npx cdk deploy BedrockChatStack \
  --outputs-file ../cdk-outputs.json \
  --require-approval never
```

This creates:
- S3 bucket for documents
- DynamoDB table for chat history
- Cognito User Pool + Client
- Lambda functions (chat, conversations, health)
- API Gateway REST API with Cognito authorizer
- CloudWatch log groups
- IAM roles and policies

**Save the outputs** – they contain resource IDs for the next steps.

### Step 3: Set Up Bedrock Knowledge Base

#### 3a. Create OpenSearch Serverless Collection

```bash
aws opensearchserverless create-security-policy \
  --name bedrock-rag-encryption \
  --type encryption \
  --policy '{"Rules":[{"Resource":["collection/bedrock-rag*"],"ResourceType":"collection"}],"AWSOwnedKey":true}'

aws opensearchserverless create-security-policy \
  --name bedrock-rag-network \
  --type network \
  --policy '[{"Rules":[{"Resource":["collection/bedrock-rag*"],"ResourceType":"collection"}],"AllowFromPublic":true}]'

aws opensearchserverless create-collection \
  --name bedrock-rag-vectors \
  --type VECTORSEARCH

# Wait for collection to become ACTIVE
aws opensearchserverless batch-get-collection \
  --names bedrock-rag-vectors \
  --query 'collectionDetails[0].status'
```

#### 3b. Create Knowledge Base

```bash
BUCKET_NAME=$(cat cdk-outputs.json | jq -r '.BedrockChatStack.DocumentsBucketName')
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
COLLECTION_ARN=$(aws opensearchserverless batch-get-collection \
  --names bedrock-rag-vectors \
  --query 'collectionDetails[0].arn' --output text)

# Create a role for the Knowledge Base
aws iam create-role \
  --role-name BedrockKnowledgeBaseRole \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Principal":{"Service":"bedrock.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name BedrockKnowledgeBaseRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

aws iam put-role-policy \
  --role-name BedrockKnowledgeBaseRole \
  --policy-name S3AccessPolicy \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Action\":[\"s3:GetObject\",\"s3:ListBucket\"],
      \"Resource\":[
        \"arn:aws:s3:::$BUCKET_NAME\",
        \"arn:aws:s3:::$BUCKET_NAME/*\"
      ]
    }]
  }"

# Create the Knowledge Base
KB_RESPONSE=$(aws bedrock create-knowledge-base \
  --name bedrock-rag-knowledge-base \
  --role-arn "arn:aws:iam::$ACCOUNT_ID:role/BedrockKnowledgeBaseRole" \
  --knowledge-base-configuration '{
    "type":"VECTOR",
    "vectorKnowledgeBaseConfiguration":{
      "embeddingModelArn":"arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
    }
  }' \
  --storage-configuration "{
    \"type\":\"OPENSEARCH_SERVERLESS\",
    \"opensearchServerlessConfiguration\":{
      \"collectionArn\":\"$COLLECTION_ARN\",
      \"vectorIndexName\":\"bedrock-rag-index\",
      \"fieldMapping\":{
        \"vectorField\":\"embedding\",
        \"textField\":\"text\",
        \"metadataField\":\"metadata\"
      }
    }
  }")

KNOWLEDGE_BASE_ID=$(echo $KB_RESPONSE | jq -r '.knowledgeBase.knowledgeBaseId')
echo "Knowledge Base ID: $KNOWLEDGE_BASE_ID"
```

#### 3c. Create Data Source

```bash
DS_RESPONSE=$(aws bedrock create-data-source \
  --knowledge-base-id "$KNOWLEDGE_BASE_ID" \
  --name bedrock-rag-s3-datasource \
  --data-source-configuration "{
    \"type\":\"S3\",
    \"s3Configuration\":{
      \"bucketArn\":\"arn:aws:s3:::$BUCKET_NAME\"
    }
  }")

DATA_SOURCE_ID=$(echo $DS_RESPONSE | jq -r '.dataSource.dataSourceId')
echo "Data Source ID: $DATA_SOURCE_ID"
```

#### 3d. Update Lambda with Knowledge Base ID

```bash
FUNCTION_NAME=$(aws lambda list-functions \
  --query "Functions[?contains(FunctionName,'BedrockChatStack') && contains(FunctionName,'chat')].FunctionName" \
  --output text)

aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --environment "Variables={
    KNOWLEDGE_BASE_ID=$KNOWLEDGE_BASE_ID,
    CONVERSATIONS_TABLE_NAME=bedrock-rag-conversations,
    MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
  }"
```

### Step 4: Upload Documents

```bash
# Upload documents to S3
aws s3 cp ./my-document.pdf s3://$BUCKET_NAME/documents/
aws s3 sync ./my-documents/ s3://$BUCKET_NAME/documents/

# Trigger Knowledge Base sync
aws bedrock start-ingestion-job \
  --knowledge-base-id "$KNOWLEDGE_BASE_ID" \
  --data-source-id "$DATA_SOURCE_ID"

# Wait for ingestion to complete
aws bedrock get-ingestion-job \
  --knowledge-base-id "$KNOWLEDGE_BASE_ID" \
  --data-source-id "$DATA_SOURCE_ID" \
  --ingestion-job-id $(aws bedrock list-ingestion-jobs \
    --knowledge-base-id "$KNOWLEDGE_BASE_ID" \
    --data-source-id "$DATA_SOURCE_ID" \
    --query 'ingestionJobSummaries[0].ingestionJobId' --output text) \
  --query 'ingestionJob.status'
```

### Step 5: Deploy Frontend

#### Option A: Vercel (Recommended for simplicity)

1. Import the repository to [Vercel](https://vercel.com)
2. Set root directory to `frontend`
3. Add environment variables from CDK outputs
4. Deploy

#### Option B: S3 + CloudFront

```bash
cd frontend

# Build with environment variables
NEXT_PUBLIC_API_URL=$(cat ../cdk-outputs.json | jq -r '.BedrockChatStack.ApiUrl')
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$(cat ../cdk-outputs.json | jq -r '.BedrockChatStack.UserPoolId')
NEXT_PUBLIC_COGNITO_CLIENT_ID=$(cat ../cdk-outputs.json | jq -r '.BedrockChatStack.UserPoolClientId')

cat > .env.production <<EOF
NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$NEXT_PUBLIC_COGNITO_USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$NEXT_PUBLIC_COGNITO_CLIENT_ID
NEXT_PUBLIC_AWS_REGION=us-east-1
EOF

npm run build

# Create S3 bucket for frontend
FRONTEND_BUCKET="bedrock-rag-frontend-$ACCOUNT_ID"
aws s3 mb s3://$FRONTEND_BUCKET

# Deploy to S3
aws s3 sync out/ s3://$FRONTEND_BUCKET/ --delete

# Create CloudFront distribution (or update existing)
```

## GitHub Actions CI/CD Setup

### 1. Create AWS OIDC Provider

```bash
aws iam create-openid-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. Create GitHub Actions Role

```bash
GITHUB_ORG="todrules"
REPO_NAME="bedrock"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Principal\":{
        \"Federated\":\"arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com\"
      },
      \"Action\":\"sts:AssumeRoleWithWebIdentity\",
      \"Condition\":{
        \"StringEquals\":{
          \"token.actions.githubusercontent.com:aud\":\"sts.amazonaws.com\"
        },
        \"StringLike\":{
          \"token.actions.githubusercontent.com:sub\":\"repo:$GITHUB_ORG/$REPO_NAME:*\"
        }
      }
    }]
  }"

# Attach deployment permissions (scope down in production)
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

### 3. Add GitHub Secrets

In your GitHub repository settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::ACCOUNT:role/GitHubActionsDeployRole` |
| `AWS_ACCOUNT_ID` | Your AWS account ID |
| `COGNITO_DOMAIN` | Your Cognito domain |
| `FRONTEND_BUCKET_NAME` | Your frontend S3 bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` | Your CloudFront distribution ID |

### 4. Trigger Deployment

Push to `main` to trigger the deployment pipeline, or use the manual workflow dispatch.

## Monitoring

### CloudWatch Dashboards

Navigate to CloudWatch → Dashboards → Create dashboard

Add widgets for:
- Lambda invocations and errors
- API Gateway 4xx/5xx rates
- DynamoDB read/write capacity
- Bedrock API calls

### Alarms

```bash
# Lambda error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name bedrock-rag-lambda-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 60 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:$ACCOUNT_ID:alerts
```

## Cost Estimation

Approximate monthly costs for moderate usage (1,000 users, 10,000 chat messages):

| Service | Estimated Cost |
|---------|---------------|
| Bedrock (Claude 3.5 Sonnet) | ~$30-100 |
| Bedrock Knowledge Base (Titan embeddings) | ~$5-15 |
| OpenSearch Serverless | ~$90-150 (minimum) |
| Lambda | < $1 |
| API Gateway | ~$3-5 |
| DynamoDB | < $1 |
| S3 | < $1 |
| CloudFront | ~$1-5 |
| **Total** | **~$130-280/month** |

> OpenSearch Serverless has a minimum OCU billing. For dev/test, consider deleting the collection when not in use.

## Security Considerations

1. **Cognito MFA**: Enable MFA for all users in production
2. **API Gateway throttling**: Configure usage plans and throttling limits
3. **Lambda VPC**: Consider placing Lambda in a VPC for additional isolation
4. **S3 encryption**: Documents bucket uses SSE-S3 by default; upgrade to SSE-KMS for compliance
5. **DynamoDB encryption**: Uses AWS-managed keys; upgrade to CMK for compliance
6. **IAM least privilege**: Review and tighten IAM policies before production deployment
7. **CloudTrail**: Enable CloudTrail for audit logging

## Rollback

To roll back to a previous deployment:

```bash
cd infrastructure

# List CloudFormation stacks and events
aws cloudformation describe-stack-events \
  --stack-name bedrock-rag-chatbot \
  --query 'StackEvents[0:5]'

# Roll back via CDK (deploy previous version)
git checkout <previous-commit>
npm run build
npx cdk deploy BedrockChatStack --require-approval never
```
