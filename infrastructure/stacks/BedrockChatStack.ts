import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ApiGatewayConstruct } from './constructs/ApiGatewayConstruct';
import { BedrockKnowledgeBase } from './constructs/BedrockKnowledgeBase';

export class BedrockChatStack extends cdk.Stack {
  public constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const frontendDomain = new cdk.CfnParameter(this, 'FrontendDomain', {
      type: 'String',
      default: 'app.example.com',
      description: 'Frontend domain used for the Cognito OAuth callback URL.',
    });

    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: undefined,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.HEAD],
          allowedOrigins: ['http://localhost:3000', `https://${frontendDomain.valueAsString}`],
          allowedHeaders: ['*'],
        },
      ],
      autoDeleteObjects: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    const conversationsTable = new dynamodb.Table(this, 'ConversationsTable', {
      tableName: 'bedrock-rag-conversations',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    conversationsTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      autoVerify: {
        email: true,
      },
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = userPool.addClient('UserPoolClient', {
      userPoolClientName: 'bedrock-rag-client',
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          implicitCodeGrant: true,
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: ['http://localhost:3000/callback', `https://${frontendDomain.valueAsString}/callback`],
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(1),
    });

    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Shared execution role for the Bedrock RAG chatbot Lambda functions.',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query', 'dynamodb:DeleteItem', 'dynamodb:UpdateItem'],
        resources: [conversationsTable.tableArn, `${conversationsTable.tableArn}/index/*`],
      }),
    );
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock-agent-runtime:RetrieveAndGenerate'],
        resources: ['*'],
      }),
    );
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:ListBucket'],
        resources: [documentsBucket.bucketArn, documentsBucket.arnForObjects('*')],
      }),
    );

    const backendDistPath = path.resolve(__dirname, '..', '..', 'backend', 'dist');
    const fallbackAssetPath = path.resolve(__dirname, '..', 'assets', 'lambda-placeholder');
    const lambdaAssetPath = fs.existsSync(backendDistPath) ? backendDistPath : fallbackAssetPath;

    const knowledgeBase = new BedrockKnowledgeBase(this, 'BedrockKnowledgeBase', {
      documentsBucket,
    });

    const commonEnvironment = {
      CONVERSATIONS_TABLE_NAME: conversationsTable.tableName,
      KNOWLEDGE_BASE_ID: knowledgeBase.knowledgeBaseId,
      MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
    };

    const chatLogGroup = new logs.LogGroup(this, 'ChatFunctionLogGroup', {
      logGroupName: '/aws/lambda/bedrock-rag-chat',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const conversationsLogGroup = new logs.LogGroup(this, 'ConversationsFunctionLogGroup', {
      logGroupName: '/aws/lambda/bedrock-rag-conversations',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const healthLogGroup = new logs.LogGroup(this, 'HealthFunctionLogGroup', {
      logGroupName: '/aws/lambda/bedrock-rag-health',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const chatFunction = new lambda.Function(this, 'ChatFunction', {
      functionName: 'bedrock-rag-chat',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(lambdaAssetPath),
      handler: 'handlers/chat.handler',
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: commonEnvironment,
      description: 'Handles chat completion requests for the Bedrock RAG chatbot.',
    });

    const conversationsFunction = new lambda.Function(this, 'ConversationsFunction', {
      functionName: 'bedrock-rag-conversations',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(lambdaAssetPath),
      handler: 'handlers/conversations.handler',
      role: lambdaRole,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: commonEnvironment,
      description: 'Retrieves and deletes conversation history for the Bedrock RAG chatbot.',
    });

    const healthFunction = new lambda.Function(this, 'HealthFunction', {
      functionName: 'bedrock-rag-health',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(lambdaAssetPath),
      handler: 'handlers/health.handler',
      role: lambdaRole,
      timeout: cdk.Duration.seconds(5),
      memorySize: 128,
      description: 'Responds to health checks for the Bedrock RAG chatbot API.',
    });

    chatFunction.node.addDependency(chatLogGroup);
    conversationsFunction.node.addDependency(conversationsLogGroup);
    healthFunction.node.addDependency(healthLogGroup);

    const apiConstruct = new ApiGatewayConstruct(this, 'ApiGateway', {
      chatFunction,
      conversationsFunction,
      healthFunction,
      userPool,
    });

    new ssm.StringParameter(this, 'KnowledgeBaseIdParameter', {
      parameterName: `/bedrock-rag/${this.stackName}/knowledge-base-id`,
      stringValue: knowledgeBase.knowledgeBaseId,
      description: 'Knowledge base identifier consumed by the Bedrock RAG chatbot runtime. Update after manual knowledge base provisioning if required.',
      tier: ssm.ParameterTier.STANDARD,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: apiConstruct.api.url,
      description: 'Base URL for the Bedrock RAG API Gateway stage.',
    });
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Amazon Cognito User Pool ID.',
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Amazon Cognito User Pool Client ID.',
    });
    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: documentsBucket.bucketName,
      description: 'S3 bucket for RAG source documents.',
    });
    new cdk.CfnOutput(this, 'ConversationsTableName', {
      value: conversationsTable.tableName,
      description: 'DynamoDB table for conversation history.',
    });
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: knowledgeBase.knowledgeBaseId,
      description: 'Knowledge base identifier or MANUAL_CONFIGURATION_REQUIRED placeholder.',
    });
  }
}
