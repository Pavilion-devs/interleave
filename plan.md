# Interleave winning build plan

## Product thesis

WebMCP makes websites callable. Interleave makes concurrent human and agent actions trustworthy.

The flagship proof uses Plane issue `makeplane/plane#9674`: an agent queues a metadata crawl, a person saves newer metadata while that operation is pending, and the delayed worker silently overwrites the newer value. Interleave records the interleaving, names the violated preservation rule, replays and minimizes the failure, exports a regression, and supplies a tested upstream patch.

## Build status

- [x] Source-verified Plane reproduction pinned to `da1a7ab85012d16836459a10dd92ec55eb739c69`
- [x] Real pending browser operation with a later human edit
- [x] Exact expected-versus-actual verdict and event receipts
- [x] Deterministic replay, current-versus-patched comparison, and delta reduction
- [x] Regression and upstream patch exports
- [x] Proposed Plane patch with 13 new cases and 37/37 relevant Plane tests passing
- [x] Reusable recorder package plus Reservation and TodoMVC adapters
- [x] State-aware Plane WebMCP surface with compact evidence receipts
- [x] Shared product navigation and a visible five-step proof path
- [x] Browser-level acceptance recording in a WebMCP-capable judge flow
- [x] Clean landing page and dedicated Incident, Session tracker, and Patch proof views
- [x] Cross-route continuity from a witnessed failure to its saved session and guarded replay
- [x] Public recorder adoption page with a tested downloadable package
- [x] One-command 50-test release gate
- [x] Exact six-take Screen Studio capture plan for the final two-minute film
- [ ] Final deployment with the public GitHub commit and hosted commit identical
- [ ] Native WebMCP acceptance rerun against the final deployed interface
- [ ] Screen Studio product footage captured from the final deployment
- [ ] Public demo video under three minutes with narration
- [ ] Final Devpost submission package

## Release gate

The local release gate is `npm run check`: lint, type checking, all 50 tests, recorder compilation, and the production build. The submission release is ready when the public GitHub commit matches the deployed commit; `/plane`, `/plane/tracker`, `/plane/proof`, and `/integrate` are publicly accessible; and the native browser sequence completes Record → Interrupt → Inspect → Minimize → Export without manual recovery.

## Demo spine

1. State the risk: a successful human edit can be lost while an agent is still working.
2. Ask the agent to start the delayed Plane crawl.
3. Save `Human verified runbook` while the tool call is pending.
4. Complete the worker and show the red expected-versus-actual verdict.
5. Open Session tracker and inspect the just-recorded five-entry session.
6. Open Patch proof, compare modes, and reduce the session to its minimal sequence.
7. Replay the same recording with the proposed guard and show PASS.
8. Export the regression and the tested Plane patch.

The video should spend its time on the live interleaving and proof artifacts. The developer page establishes that the recorder is adoptable. Reservation and TodoMVC establish generality in the repository and do not need screen time unless the final cut has room.
