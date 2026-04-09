# Golden Bears Player Portal

## First Iteration Scope

The first build focuses on the core player lifecycle:

- tryout intake
- staff evaluation workflow
- team assignment handoff
- player development plan tracking
- season-to-season player history

The initial experience is intentionally read-first and workflow-first. It is meant to validate the portal shape, language, access model, and information architecture before CRUD-heavy tooling is layered in.

## User Model

The current UI and API account for these personas:

- `player`
- `parent`
- `coach`
- `manager`
- `club-admin`
- `platform-admin`

Important relationship rules already represented in the data model:

- one parent can be linked to multiple players
- a player and parent have separate logins tied to the same player record
- coaches and managers can span multiple teams
- club admins configure organization-level workflows

## Multi-Organization Direction

NC Golden Bears is the first concrete organization, but the platform design keeps room for future organizations such as Raleigh Raptors.

Recommended tenancy shape:

- shared Cognito user pool across the platform
- one top-level `organizationId` on all organization-owned records
- app-level roles stored in the shared `UserAppAccess` table
- organization-specific roles and memberships stored inside the portal domain model

That approach preserves a shared parent identity across clubs while keeping organization data isolated.

## Near-Term Build Priorities

- move tryout intake from seeded data into DynamoDB-backed records
- add coach/admin editing for evaluation criteria and development plans
- add team assignment publishing workflow
- add resource/document management for parents and players
- define the canonical player evaluation criteria schema with club-editable weights and descriptors
