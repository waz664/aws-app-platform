import {
  CfnOutput,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config/environments.js';

type SharedIdentityStackProps = StackProps & {
  environmentConfig: EnvironmentConfig;
};

export class SharedIdentityStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly appAccessTable: dynamodb.Table;
  public readonly authDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: SharedIdentityStackProps) {
    super(scope, id, props);

    const isProduction = props.environmentConfig.name === 'prod';
    const removalPolicy = isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    this.userPool = new cognito.UserPool(this, 'PlatformUserPool', {
      userPoolName: `platform-users-${props.environmentConfig.name}`,
      selfSignUpEnabled: !isProduction,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
      },
      removalPolicy,
    });

    this.authDomain = this.userPool.addDomain('PlatformHostedUiDomain', {
      cognitoDomain: {
        domainPrefix: `waz664-platform-${props.environmentConfig.name}`,
      },
    });

    this.appAccessTable = new dynamodb.Table(this, 'UserAppAccessTable', {
      tableName: `user-app-access-${props.environmentConfig.name}`,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'appKey',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: isProduction,
      },
      removalPolicy,
    });

    this.appAccessTable.addGlobalSecondaryIndex({
      indexName: 'by-app',
      partitionKey: {
        name: 'appKey',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
    });

    new CfnOutput(this, 'SharedUserPoolId', {
      value: this.userPool.userPoolId,
    });

    new CfnOutput(this, 'SharedUserPoolDomain', {
      value: this.authDomain.baseUrl(),
    });

    new CfnOutput(this, 'UserAppAccessTableName', {
      value: this.appAccessTable.tableName,
    });
  }
}
