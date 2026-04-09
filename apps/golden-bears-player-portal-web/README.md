# Golden Bears Player Portal Web

This is the first frontend build for the NC Golden Bears player and family portal.

It supports two runtime modes:

- `demo`: local-first mode using seeded player, parent, coach, and admin scenarios
- `aws`: deployed mode using Cognito auth plus the Golden Bears portal API

The deployed stack writes `runtime-config.json` during infrastructure deployment, so the static frontend can stay environment-neutral while learning its live API and Cognito settings at runtime.
