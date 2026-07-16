import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface BedrockKnowledgeBaseProps {
  readonly documentsBucket: s3.IBucket;
}

export class BedrockKnowledgeBase extends Construct {
  public readonly knowledgeBaseId: string;
  public readonly knowledgeBaseRole: iam.Role;
  public readonly createKnowledgeBaseParameter: cdk.CfnParameter;

  public constructor(scope: Construct, id: string, props: BedrockKnowledgeBaseProps) {
    super(scope, id);

    this.createKnowledgeBaseParameter = new cdk.CfnParameter(this, 'CreateKnowledgeBase', {
      type: 'String',
      default: 'false',
      allowedValues: ['true', 'false'],
      description: 'Set to true after provisioning an OpenSearch Serverless vector store for the Bedrock knowledge base.',
    });

    const openSearchCollectionArn = new cdk.CfnParameter(this, 'OpenSearchCollectionArn', {
      type: 'String',
      default: 'arn:aws:aoss:us-east-1:111111111111:collection/placeholder',
      description: 'Existing OpenSearch Serverless collection ARN used by the Bedrock knowledge base vector store.',
    });

    const openSearchVectorIndexName = new cdk.CfnParameter(this, 'OpenSearchVectorIndexName', {
      type: 'String',
      default: 'bedrock-rag-index',
      description: 'Existing OpenSearch Serverless vector index name used by the Bedrock knowledge base.',
    });

    const shouldCreateKnowledgeBase = new cdk.CfnCondition(this, 'ShouldCreateKnowledgeBase', {
      expression: cdk.Fn.conditionEquals(this.createKnowledgeBaseParameter.valueAsString, 'true'),
    });

    this.knowledgeBaseRole = new iam.Role(this, 'KnowledgeBaseRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Service role assumed by Amazon Bedrock Knowledge Bases.',
    });

    props.documentsBucket.grantRead(this.knowledgeBaseRole);
    this.knowledgeBaseRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:${cdk.Aws.PARTITION}:bedrock:${cdk.Aws.REGION}::foundation-model/amazon.titan-embed-text-v2:0`,
        ],
      }),
    );
    this.knowledgeBaseRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['aoss:APIAccessAll'],
        resources: [openSearchCollectionArn.valueAsString],
      }),
    );

    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
      name: 'bedrock-rag-knowledge-base',
      description: 'Enterprise RAG knowledge base for the Bedrock chatbot. Requires a pre-created OpenSearch Serverless vector store.',
      roleArn: this.knowledgeBaseRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:${cdk.Aws.PARTITION}:bedrock:${cdk.Aws.REGION}::foundation-model/amazon.titan-embed-text-v2:0`,
        },
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: openSearchCollectionArn.valueAsString,
          vectorIndexName: openSearchVectorIndexName.valueAsString,
          fieldMapping: {
            metadataField: 'metadata',
            textField: 'text',
            vectorField: 'embedding',
          },
        },
      },
    });

    knowledgeBase.cfnOptions.condition = shouldCreateKnowledgeBase;
    knowledgeBase.addMetadata('Notes', [
      'Provision the OpenSearch Serverless collection and vector index separately before enabling CreateKnowledgeBase.',
      'Replace the default OpenSearchCollectionArn and OpenSearchVectorIndexName parameter values during deployment.',
    ]);

    const dataSource = new bedrock.CfnDataSource(this, 'KnowledgeBaseDataSource', {
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      name: 'bedrock-rag-documents',
      description: 'S3 documents for the Bedrock RAG chatbot knowledge base.',
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: props.documentsBucket.bucketArn,
        },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: 'FIXED_SIZE',
          fixedSizeChunkingConfiguration: {
            maxTokens: 300,
            overlapPercentage: 20,
          },
        },
      },
    });
    dataSource.cfnOptions.condition = shouldCreateKnowledgeBase;

    this.knowledgeBaseId = cdk.Token.asString(
      cdk.Fn.conditionIf(
        shouldCreateKnowledgeBase.logicalId,
        knowledgeBase.attrKnowledgeBaseId,
        'MANUAL_CONFIGURATION_REQUIRED',
      ),
    );
  }
}
