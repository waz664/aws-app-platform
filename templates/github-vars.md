# GitHub Variables And Secrets

Recommended GitHub environments:

- `dev`
- `stage`
- `prod`

Recommended environment variables:

- `AWS_REGION`
- `DEPLOY_ROLE_ARN`
- `APP_NAME`

Recommended protections:

- `prod` requires manual approval
- `main` is branch protected
- workflow runs on `prod` limited to maintainers

Prefer variables over secrets for non-sensitive values.

With OIDC, the deploy role ARN is the only AWS-specific value the workflow needs. Do not store long-lived AWS access keys in GitHub.

