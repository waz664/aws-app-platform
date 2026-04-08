# Architecture

## Decision Summary

The default architecture for new apps should be:

- Frontend: static SPA served through S3 + CloudFront
- Authentication: Amazon Cognito user pool
- Backend: API Gateway HTTP API + Lambda
- Database: DynamoDB on-demand
- Files: S3 only when needed
- CI/CD: GitHub Actions with AWS OIDC
- Environments: `dev`, `stage`, `prod`

This is the lowest-friction AWS-native pattern that still gives us:

- authentication
- modern multi-page browser UX
- mobile/tablet/desktop responsiveness
- low idle cost
- safe releases
- repeatable deployments

## Why This Over Heavier AWS Options

We intentionally avoid these by default:

- EC2: always-on cost and server patching
- ECS/Fargate: great when needed, but more moving parts than most lightweight apps require
- RDS/Aurora: excellent for relational workloads, but unnecessary cost and operational overhead for simple CRUD apps
- NAT gateways: common hidden cost in "private subnet by default" architectures

The guiding rule is: do not add always-on infrastructure until a real product need forces it.

## Standard App Shape

Each app gets its own stack set:

- web bucket and CDN distribution
- Cognito user pool and app client
- HTTP API
- one or more Lambda functions
- one DynamoDB table, or a very small number of tables
- CloudWatch log groups and alarms

Shared account-level foundation:

- Route 53 hosted zone
- ACM certificates
- GitHub OIDC identity provider and deploy roles
- budget alarms
- optional shared notification topics

## Shared Versus Isolated Auth

Current default for this workspace:

- Use one shared Cognito user pool across the app ecosystem
- Use one app client per application
- Enforce app-level authorization separately from sign-in
- Support role-based access control per app, starting with `admin` and `user`

Why this matches your stated goal:

- users get ecosystem-level sign-in
- each app can still control who is allowed in
- the same person can have different roles in different apps

Implementation recommendation:

- shared identity in Cognito
- app membership and roles in DynamoDB
- API authorization checks on every protected backend route

Why not rely only on Cognito groups:

- groups are useful for coarse global roles
- they are less flexible for per-app role assignments across many apps
- an authorization table scales better for "user has access to App A but not App B"

## Environment Strategy

Use one AWS account first, with isolated stacks for:

- `dev`
- `stage`
- `prod`

This keeps the early setup simple and cheap. If one of the apps becomes business-critical later, we can split production into a separate AWS account without changing the basic app architecture.

Default region for this workspace:

- `us-east-1`

Naming pattern:

- `appname-dev`
- `appname-stage`
- `appname-prod`

Domain pattern:

- `dev.app.example.com`
- `stage.app.example.com`
- `app.example.com`

## Deployment Pattern

Source control is the control plane.

- Pull request: validate only
- `develop` branch: deploy `dev`
- `main` branch: deploy `stage`
- Manual promotion: deploy chosen release to `prod`

This removes the current console copy-paste cycle and makes the system independent from one local machine.

## Rollback Strategy

Primary rollback:

- redeploy the previous Git tag or commit to `prod`

Secondary safeguards:

- CloudFormation rollback for failed infra updates
- versioned frontend artifacts
- DynamoDB point-in-time recovery on important tables

## Frontend Hosting Note

Default recommendation is S3 + CloudFront because it is portable and infrastructure-defined.

If preview URLs for every pull request become more important than lowest ongoing cost, we can move the frontend hosting portion to AWS Amplify Hosting without changing the backend architecture.

## Example Baseline App

For the first proof app, this repo includes a sample concept:

- [`apps/client-notes/README.md`](C:\Projects\AWS\base\apps\client-notes\README.md)

That sample is intentionally simple but exercises sign-in, dashboard, list/detail pages, and light CRUD data.

See also:

- [`docs/decisions.md`](C:\Projects\AWS\base\docs\decisions.md)
