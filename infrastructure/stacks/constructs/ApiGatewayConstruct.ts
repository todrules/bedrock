import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiGatewayConstructProps {
  readonly chatFunction: lambda.IFunction;
  readonly conversationsFunction: lambda.IFunction;
  readonly healthFunction: lambda.IFunction;
  readonly userPool: cognito.IUserPool;
}

export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;

  public constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    const accessLogs = new logs.LogGroup(this, 'ApiAccessLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'bedrock-rag-api',
      deployOptions: {
        stageName: 'v1',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogs),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: false,
        }),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'DELETE'],
      },
      cloudWatchRole: true,
    });

    this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: 'bedrock-rag-cognito-authorizer',
    });

    const health = this.api.root.addResource('health');
    health.addMethod('GET', new apigateway.LambdaIntegration(props.healthFunction));

    const chat = this.api.root.addResource('chat');
    chat.addMethod('POST', new apigateway.LambdaIntegration(props.chatFunction), {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: this.authorizer,
    });

    const conversations = this.api.root.addResource('conversations');
    const conversationsIntegration = new apigateway.LambdaIntegration(props.conversationsFunction);
    conversations.addMethod('GET', conversationsIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: this.authorizer,
    });

    const conversationById = conversations.addResource('{id}');
    for (const method of ['GET', 'DELETE']) {
      conversationById.addMethod(method, conversationsIntegration, {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: this.authorizer,
      });
    }
  }
}
