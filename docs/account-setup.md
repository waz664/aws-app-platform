# Account Setup

## What We Need For Phase 2

We can finish the architecture and repo setup without AWS credentials.

To actually deploy, the preferred setup is:

- GitHub repo for source control
- GitHub Actions for CI/CD
- AWS IAM OIDC trust for GitHub
- one deploy role per environment or one tightly-scoped deploy role with environment conditions

This avoids storing long-lived AWS keys in GitHub or on your machine.

## Information I Need From You

- domain name strategy, if any
- GitHub repo name

Current defaults already chosen:

- GitHub owner: `waz664`
- AWS region: `us-east-1`
- Shared login across apps: yes
- Per-app authorization with RBAC: yes

## Recommended Access Method

Preferred:

- GitHub OIDC for automated deploys
- AWS IAM Identity Center or AWS CLI SSO for occasional human admin access

Avoid if possible:

- long-lived IAM user access keys

## Local Tooling

This workspace now has the core local tools installed for implementation work:

- Node.js 22
- npm
- AWS CLI v2
- GitHub CLI

We still need authentication configured before we can push or deploy.

## Bootstrap Checklist

1. Use the GitHub repository under `waz664`
2. Install local tooling if we want direct local validation
3. Add the GitHub OIDC provider in AWS IAM
4. Create deploy role and policy
5. Add GitHub environment variables and protections
6. Bootstrap the infrastructure framework
7. Deploy the sample app to `dev`

## Safety Defaults

- Use branch protection on `main`
- Require review before prod deployment workflow can run
- Keep production deployment as a manual action
- Enable budget alarms early

## Recommended Next Repo

Suggested GitHub repo:

- `waz664/aws-app-platform`

Reason:

- it can hold the reusable platform plus the first application
- future apps can live as folders or packages in the same platform repo until there is a reason to split them

## Immediate Next Steps

1. Log into GitHub locally with `gh auth login`
2. Configure AWS CLI access, ideally with IAM Identity Center or another temporary credential flow
3. Create the GitHub OIDC provider and deploy role in AWS
4. Push this repo to `waz664/aws-app-platform`
5. Bootstrap and deploy `dev`
