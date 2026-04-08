# Cost Model

## Cost Posture

The baseline stack is designed so that most costs scale with usage instead of existing just because the app is deployed.

Main idea:

- prefer serverless services
- avoid always-on compute
- avoid managed networking components with fixed monthly charges
- keep environments small and identical

## Cost-Efficient Defaults

Use these defaults unless the app proves it needs more:

- API Gateway HTTP API instead of REST API
- Lambda instead of containers
- DynamoDB on-demand instead of provisioned capacity
- no VPC for Lambdas unless there is a hard requirement
- no NAT gateways
- no RDS
- no WAF at first for tiny internal or low-risk apps

## Current AWS Pricing Signals To Design Around

The following current pricing details are why this baseline is attractive for low-volume apps:

- API Gateway HTTP APIs include 1 million free calls per month for new AWS customers for 12 months, then pay per call
- Lambda includes 1 million free requests and 400,000 GB-seconds per month
- DynamoDB on-demand charges per request and includes 25 GB of free storage in the free tier
- Cognito Lite and Essentials include 10,000 monthly active users free per month on direct sign-in
- CodeBuild includes a free tier each month
- CodePipeline V1 includes one free active pipeline per month

Pricing changes over time, so we should verify before production rollouts or when traffic changes materially.

## Hidden Costs We Intentionally Avoid

The architecture is specifically designed to avoid these early:

- NAT gateway hourly charges
- idle container tasks
- idle database instances
- multi-AZ relational databases for simple apps
- VPC endpoint sprawl

## When Costs Usually Increase

Most apps will stay inexpensive until one of these happens:

- high traffic to frontend assets
- large file uploads or downloads
- heavy Lambda execution time
- DynamoDB hot partitions or very high write volume
- SMS-based MFA or phone verification in Cognito

If usage grows, we can optimize per app instead of paying high baseline cost across all apps.

## Frontend Hosting Tradeoff

Two viable hosting modes:

- S3 + CloudFront: more control and portable infrastructure
- Amplify Hosting: easier Git-connected previews, but evaluate hosting traffic costs carefully

For the repeatable base, I recommend we standardize on S3 + CloudFront and treat Amplify Hosting as an optional mode when preview environments are especially valuable.

