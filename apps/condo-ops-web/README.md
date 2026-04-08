# Condo Ops Web

This is the starter frontend for the Myrtle Beach condo operations app.

It supports two runtime modes:

- `demo`: local-first mode using seeded sample data
- `aws`: deployed mode using Cognito auth plus the condo API

The deployed stack writes `runtime-config.json` during infrastructure deployment, so the web app can stay static while still learning where the API and Cognito resources live.
