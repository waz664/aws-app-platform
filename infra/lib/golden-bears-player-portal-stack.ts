import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config/environments.js';
import { SharedIdentityStack } from './shared-identity-stack.js';

type GoldenBearsPlayerPortalStackProps = StackProps & {
  environmentConfig: EnvironmentConfig;
  sharedIdentity: SharedIdentityStack;
};

export class GoldenBearsPlayerPortalStack extends Stack {
  constructor(scope: Construct, id: string, props: GoldenBearsPlayerPortalStackProps) {
    super(scope, id, props);

    const isProduction = props.environmentConfig.name === 'prod';
    const removalPolicy = isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    const dataTable = new dynamodb.Table(this, 'PlayerPortalDataTable', {
      tableName: `golden-bears-player-portal-data-${props.environmentConfig.name}`,
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: isProduction,
      },
      removalPolicy,
    });

    dataTable.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: {
        name: 'gsi1pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'gsi1sk',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    dataTable.addGlobalSecondaryIndex({
      indexName: 'gsi2',
      partitionKey: {
        name: 'gsi2pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'gsi2sk',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const websiteBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: !isProduction,
      removalPolicy,
    });

    const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(1),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(1),
        },
      ],
    });

    const publicWebUrl = `https://${distribution.distributionDomainName}`;
    const authIssuer = `https://cognito-idp.${this.region}.${Stack.of(this).urlSuffix}/${props.sharedIdentity.userPool.userPoolId}`;

    const userPoolClient = new cognito.UserPoolClient(this, 'PlayerPortalWebClient', {
      userPool: props.sharedIdentity.userPool,
      authFlows: {
        userSrp: true,
      },
      oAuth: {
        callbackUrls: [
          'http://localhost:5173/auth/callback',
          `${publicWebUrl}/auth/callback`,
        ],
        logoutUrls: [
          'http://localhost:5173',
          publicWebUrl,
        ],
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      preventUserExistenceErrors: true,
      refreshTokenValidity: Duration.days(7),
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
    });

    const apiLogGroup = new logs.LogGroup(this, 'PlayerPortalApiLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy,
    });

    const apiHandler = new lambdaNodejs.NodejsFunction(this, 'PlayerPortalApiHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.resolve(process.cwd(), '../services/golden-bears-player-portal-api/src/index.ts'),
      handler: 'handler',
      memorySize: 512,
      timeout: Duration.seconds(10),
      logGroup: apiLogGroup,
      bundling: {
        target: 'node22',
        minify: true,
        sourceMap: true,
      },
      environment: {
        APP_KEY: 'golden-bears-player-portal',
        APP_DATA_TABLE_NAME: dataTable.tableName,
        APP_ACCESS_TABLE_NAME: props.sharedIdentity.appAccessTable.tableName,
        BOOTSTRAP_ADMIN_EMAIL: props.environmentConfig.bootstrapAdminEmail,
        ALLOW_AUTHENTICATED_READS: String(props.environmentConfig.allowAuthenticatedReads),
      },
    });

    dataTable.grantReadWriteData(apiHandler);
    props.sharedIdentity.appAccessTable.grantReadWriteData(apiHandler);

    const httpApi = new apigwv2.HttpApi(this, 'PlayerPortalHttpApi', {
      apiName: `golden-bears-player-portal-${props.environmentConfig.name}`,
      createDefaultStage: true,
      corsPreflight: {
        allowHeaders: [
          'authorization',
          'content-type',
        ],
        allowMethods: [
          apigwv2.CorsHttpMethod.ANY,
        ],
        allowOrigins: ['*'],
      },
    });

    const lambdaIntegration = new apigwv2.CfnIntegration(this, 'LambdaIntegration', {
      apiId: httpApi.apiId,
      integrationType: 'AWS_PROXY',
      integrationUri: apiHandler.functionArn,
      payloadFormatVersion: '2.0',
    });

    const jwtAuthorizer = new apigwv2.CfnAuthorizer(this, 'JwtAuthorizer', {
      apiId: httpApi.apiId,
      authorizerType: 'JWT',
      identitySource: [
        '$request.header.Authorization',
      ],
      name: 'GoldenBearsPlayerPortalJwtAuthorizer',
      jwtConfiguration: {
        audience: [
          userPoolClient.userPoolClientId,
        ],
        issuer: authIssuer,
      },
    });

    new apigwv2.CfnRoute(this, 'HealthRoute', {
      apiId: httpApi.apiId,
      routeKey: 'GET /health',
      target: Fn.join('', ['integrations/', lambdaIntegration.ref]),
    });

    new apigwv2.CfnRoute(this, 'BootstrapRoute', {
      apiId: httpApi.apiId,
      routeKey: 'GET /bootstrap',
      target: Fn.join('', ['integrations/', lambdaIntegration.ref]),
      authorizationType: 'JWT',
      authorizerId: jwtAuthorizer.ref,
    });

    new apigwv2.CfnRoute(this, 'ClaimAdminRoute', {
      apiId: httpApi.apiId,
      routeKey: 'POST /access/claim-admin',
      target: Fn.join('', ['integrations/', lambdaIntegration.ref]),
      authorizationType: 'JWT',
      authorizerId: jwtAuthorizer.ref,
    });

    new apigwv2.CfnRoute(this, 'ProfileGetRoute', {
      apiId: httpApi.apiId,
      routeKey: 'PUT /profile',
      target: Fn.join('', ['integrations/', lambdaIntegration.ref]),
      authorizationType: 'JWT',
      authorizerId: jwtAuthorizer.ref,
    });

    new apigwv2.CfnRoute(this, 'OrganizationUpdateRoute', {
      apiId: httpApi.apiId,
      routeKey: 'PUT /organization',
      target: Fn.join('', ['integrations/', lambdaIntegration.ref]),
      authorizationType: 'JWT',
      authorizerId: jwtAuthorizer.ref,
    });

    new apigwv2.CfnRoute(this, 'PlayersCreateRoute', {
      apiId: httpApi.apiId,
      routeKey: 'POST /players',
      target: Fn.join('', ['integrations/', lambdaIntegration.ref]),
      authorizationType: 'JWT',
      authorizerId: jwtAuthorizer.ref,
    });

    new apigwv2.CfnRoute(this, 'PlayersUpdateRoute', {
      apiId: httpApi.apiId,
      routeKey: 'PATCH /players/{playerId}',
      target: Fn.join('', ['integrations/', lambdaIntegration.ref]),
      authorizationType: 'JWT',
      authorizerId: jwtAuthorizer.ref,
    });

    new apigwv2.CfnRoute(this, 'InvitesCreateRoute', {
      apiId: httpApi.apiId,
      routeKey: 'POST /players/{playerId}/invites',
      target: Fn.join('', ['integrations/', lambdaIntegration.ref]),
      authorizationType: 'JWT',
      authorizerId: jwtAuthorizer.ref,
    });

    new apigwv2.CfnRoute(this, 'InviteAcceptRoute', {
      apiId: httpApi.apiId,
      routeKey: 'POST /invites/{inviteId}/accept',
      target: Fn.join('', ['integrations/', lambdaIntegration.ref]),
      authorizationType: 'JWT',
      authorizerId: jwtAuthorizer.ref,
    });

    new apigwv2.CfnRoute(this, 'InviteDeclineRoute', {
      apiId: httpApi.apiId,
      routeKey: 'POST /invites/{inviteId}/decline',
      target: Fn.join('', ['integrations/', lambdaIntegration.ref]),
      authorizationType: 'JWT',
      authorizerId: jwtAuthorizer.ref,
    });

    new apigwv2.CfnRoute(this, 'InviteRevokeRoute', {
      apiId: httpApi.apiId,
      routeKey: 'POST /invites/{inviteId}/revoke',
      target: Fn.join('', ['integrations/', lambdaIntegration.ref]),
      authorizationType: 'JWT',
      authorizerId: jwtAuthorizer.ref,
    });

    apiHandler.addPermission('AllowHttpApiInvoke', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${httpApi.apiId}/*/*/*`,
    });

    const webBuildPath = path.resolve(process.cwd(), '../apps/golden-bears-player-portal-web/dist');
    const placeholderWebPath = path.resolve(process.cwd(), 'static/placeholder-site');

    const assetPath = fs.existsSync(path.join(webBuildPath, 'index.html'))
      ? webBuildPath
      : placeholderWebPath;

    new s3deploy.BucketDeployment(this, 'DeployWebApp', {
      sources: [
        s3deploy.Source.asset(assetPath),
        s3deploy.Source.jsonData(
          'runtime-config.json',
          {
            mode: 'aws',
            appName: 'Golden Bears Player Portal',
            appKey: 'golden-bears-player-portal',
            region: props.environmentConfig.region,
            plannedDomain: props.environmentConfig.plannedWebDomains.goldenBearsPlayerPortal,
            apiBaseUrl: httpApi.apiEndpoint,
            auth: {
              userPoolId: props.sharedIdentity.userPool.userPoolId,
              userPoolClientId: userPoolClient.userPoolClientId,
              domain: props.sharedIdentity.authDomain.baseUrl(),
              redirectSignIn: `${publicWebUrl}/auth/callback`,
              redirectSignOut: publicWebUrl,
            },
          },
        ),
      ],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    new CfnOutput(this, 'GoldenBearsPlayerPortalWebUrl', {
      value: publicWebUrl,
    });

    new CfnOutput(this, 'GoldenBearsPlayerPortalApiUrl', {
      value: httpApi.apiEndpoint,
    });

    new CfnOutput(this, 'GoldenBearsPlayerPortalUserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    new CfnOutput(this, 'GoldenBearsPlayerPortalDataTableName', {
      value: dataTable.tableName,
    });
  }
}
