# Infrastructure

The current CDK app already synthesizes two stacks for each environment:

- `PlatformIdentity-<env>`
- `CondoOps-<env>`

Current responsibilities:

- shared Cognito user pool
- shared `UserAppAccess` DynamoDB table
- app-specific web hosting bucket and CloudFront distribution
- app-specific Lambda API and API Gateway HTTP API
- starter DynamoDB app data table
- runtime config generation for the static frontend

Useful commands from the repo root:

- `npm run build:infra`
- `npm run infra:synth`
- `npm run bootstrap:dev`
- `npm run deploy:dev`

Near-term follow-up work:

- custom domain wiring for `wasikowski.com`
- admin UI for assigning app access and roles
- real DynamoDB-backed CRUD instead of seeded starter data
- GitHub Actions deployment using the OIDC templates in [`templates`](C:\Projects\AWS\aws-app-platform\templates)
