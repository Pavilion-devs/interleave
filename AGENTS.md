# Interleave contributor instructions

Interleave is a WebMCP concurrency assurance lab. Its flagship experience must show a real human action interleaving with a pending agent tool call, identify the exact violated application rule, replay and minimize the witnessed failure, and export a deterministic regression.

## Product priorities

1. Keep `/plane` as the flagship route and make its 60-second proof path obvious.
2. Use native `document.modelContext.registerTool`; never add a fake WebMCP polyfill.
3. Register a small state-aware tool surface. Tool names, titles, descriptions, parameter descriptions, annotations, and outputs are product UX.
4. Keep tool outputs compact. Return evidence receipts and download URLs instead of embedding large patches or session files.
5. Preserve the recorder as a reusable, application-independent package.

## Evidence and safety boundaries

- Plane work is limited to public source, issue `makeplane/plane#9674`, pinned commit `da1a7ab85012d16836459a10dd92ec55eb739c69`, and deterministic local fixtures/tests.
- Do not probe live Plane deployments, accounts, credentials, private infrastructure, or user data.
- Describe the `/plane` experience as a source-verified deterministic reproduction. Do not imply that it runs a live Plane deployment.
- Keep the proposed Plane patch local until the user approves a finished upstream submission. Do not open an issue, pull request, comment, or maintainer message without that approval.
- `public/plane-9674.patch` is a derivative Plane artifact under AGPL-3.0. Interleave source remains MIT.

## Required checks

Run the recorder build, project tests, lint, type checking, and production build before release. Preserve deterministic behavior and test both the reproduced stale write and the guarded result. Keep the public GitHub commit and deployed commit identical.

## Release targets

- Public repository: `https://github.com/Pavilion-devs/interleave`
- Flagship route: `/plane`
- The hosted experience must be accessible to judges without an owner login.
