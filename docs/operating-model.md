# Operating Model

## How We Work

The target workflow is product-manager friendly:

1. You describe a feature in business terms
2. I turn that into implementation tasks, code changes, and deployment changes
3. CI validates the work automatically
4. The change deploys to `stage`
5. You review it there
6. We manually promote the reviewed version to `prod`

This keeps the logistics out of the AWS console and shifts the process into source control and repeatable automation.

## Standard Intake For New Apps

For a new app, I only need:

- app name
- who uses it
- top 3 to 5 screens
- main data objects
- whether users are shared with another app
- whether uploads, email, or payments are needed

If you do not have all of that yet, I can still start from the template and fill in the blanks with sensible defaults.

## Standard Change Flow

- Small UI or logic change: PR, validate, deploy to `stage`, promote to `prod`
- Schema or infrastructure change: PR, validate, deploy to `dev`, then `stage`, then manual prod promotion
- Risky change: keep feature off behind a config flag until reviewed

## Definition Of Done

A change is not done until:

- code is in source control
- the pipeline can deploy it
- the change has been reviewed in `stage`
- rollback path is known

## Release Rules

- Never push directly to `prod` from local machine
- Never rely on manual console edits for long-term settings
- Every repeatable AWS resource should be defined in infrastructure code
- Emergency fixes still go through source control, even if the path is shortened

## Rollback Playbook

If production breaks:

1. redeploy the last known good tag
2. confirm the app and API health
3. inspect the failed change in `stage`
4. ship the corrected version normally

This is much safer than clicking through the console trying to remember what changed.

