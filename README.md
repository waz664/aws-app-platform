# AWS App Platform

This repo is the reusable AWS baseline for low-cost web applications under `waz664`, and it now includes the first real starter app:

- `Condo Ops`: a Myrtle Beach vacation rental operations dashboard for finances, bookings, and maintenance activity

## Platform Shape

- Frontend: React + Vite
- Auth: shared Amazon Cognito user pool across the app ecosystem
- Authorization: per-app access and roles in DynamoDB
- API: API Gateway HTTP API + Lambda
- Data: DynamoDB on-demand
- Hosting: S3 + CloudFront
- Infrastructure: AWS CDK in TypeScript
- Deployments: GitHub Actions with AWS OIDC

## Why Node Is In This Stack

Node is the best default foundation for this repo, even if you personally prefer Python, because:

- modern frontend builds depend on the Node ecosystem
- AWS CDK is very strong in TypeScript for reusable infrastructure
- one toolchain keeps the platform easier to automate and maintain

That does not lock us out of Python. If a future Lambda or data-processing workflow is a better fit for Python, we can add it without changing the platform structure.

## Current Starter App

The starter app lives here:

- [`apps/condo-ops-web/README.md`](C:\Projects\AWS\aws-app-platform\apps\condo-ops-web\README.md)
- [`services/condo-ops-api/src/index.ts`](C:\Projects\AWS\aws-app-platform\services\condo-ops-api\src\index.ts)
- [`infra/lib/shared-identity-stack.ts`](C:\Projects\AWS\aws-app-platform\infra\lib\shared-identity-stack.ts)
- [`infra/lib/condo-ops-stack.ts`](C:\Projects\AWS\aws-app-platform\infra\lib\condo-ops-stack.ts)

Local development starts in demo mode. The deployed stack writes a `runtime-config.json` file so the same static frontend can switch into live AWS mode without a rebuild tied to one machine.

## Commands

- `npm install`
- `npm run dev:web`
- `npm run lint`
- `npm run build`
- `npm run infra:synth`
- `npm run deploy:dev`

## Repo Layout

- [`docs/decisions.md`](C:\Projects\AWS\aws-app-platform\docs\decisions.md)
- [`docs/architecture.md`](C:\Projects\AWS\aws-app-platform\docs\architecture.md)
- [`docs/cost-model.md`](C:\Projects\AWS\aws-app-platform\docs\cost-model.md)
- [`docs/operating-model.md`](C:\Projects\AWS\aws-app-platform\docs\operating-model.md)
- [`docs/account-setup.md`](C:\Projects\AWS\aws-app-platform\docs\account-setup.md)
- [`infra/README.md`](C:\Projects\AWS\aws-app-platform\infra\README.md)
- [`templates/github-oidc-trust-policy.json`](C:\Projects\AWS\aws-app-platform\templates\github-oidc-trust-policy.json)
- [`templates/github-deploy-policy.json`](C:\Projects\AWS\aws-app-platform\templates\github-deploy-policy.json)
- [`templates/app-intake.md`](C:\Projects\AWS\aws-app-platform\templates\app-intake.md)

## Current Status

As of April 8, 2026, this repo has:

- a working responsive starter frontend
- a starter Lambda API with app-level access checks
- a shared Cognito + authorization-table CDK stack
- successful local `lint`, `build`, and `cdk synth`

What it does not have yet:

- GitHub auth on this machine
- AWS credentials configured locally
- a live deployment into your AWS account

