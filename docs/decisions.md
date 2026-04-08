# Current Decisions

This file records the agreed default platform decisions for this workspace as of April 8, 2026.

## Confirmed Defaults

- GitHub owner: `waz664`
- Preferred AWS region: `us-east-1`
- Environments: `dev`, `stage`, `prod`
- Authentication model: shared sign-in across applications
- Authorization model: per-application authorization with role-based access control
- Default roles: `admin`, `user`

## Region Note

You said "East-US." In AWS terms, the most likely intended default is:

- `us-east-1` for N. Virginia

That is the standard recommendation for this platform because:

- it is a common default region
- many examples and services assume it
- CloudFront certificate workflows already depend on ACM certificates in `us-east-1`

If you actually prefer Ohio, we can switch to:

- `us-east-2`

## Shared Identity Model

The new default is one shared identity system for the app ecosystem.

Recommended baseline:

- one shared Cognito user pool for the ecosystem
- one app client per application
- JWT tokens include global user identity
- app access is enforced in the backend per application
- role assignment is stored in an authorization table, not hardcoded in Cognito groups alone

## Authorization Model

Recommended table concept:

- `UserAppAccess`

Suggested record shape:

- `userId`
- `appKey`
- `roles`
- `status`
- `grantedAt`
- `grantedBy`

This lets one user:

- exist once in the ecosystem
- access some apps but not others
- have different roles in different apps

Example:

- same user is `admin` in App A
- same user is `user` in App B
- same user has no access to App C

## Suggested Platform Repo Name

Recommended repo name:

- `aws-app-platform`

Good alternatives:

- `aws-web-app-base`
- `aws-app-factory`

