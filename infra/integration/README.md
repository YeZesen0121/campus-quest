# R1–R6 and approved UI integration stack

Source: fixed R6 runner at e20bf06. This stack owns only the resources in
resources.json and ignored .runtime/owner.json. It preserves all source trees,
R7 services and old databases. Web3311 replaces the occupied3310 candidate.

Windows uses Docker in WSL CampusQuest-Dev. Start/Status/Check use stack.ps1;
run.ps1 exposes backend/python/frontend/node/tsx/playwright/visual/battery modes.
Use `& ./infra/integration/run.ps1 battery` without filters or special-world
flags for the complete default browser battery. A single launch.sh flock
covers browser execution, report preservation and the original no-skip guard.
Each invocation rejects an existing output directory and removes only its
owned report source before the browser starts. Separate exit codes and report
hashes live in `.runtime/batteries/<run-id>/result.json`, bound to native HEAD.

Browser modes pin `RAYON_NUM_THREADS=2`, Node's heap to 768 MiB and disable Next
telemetry. The retained source stacks run several independent ClamAV engines
in this WSL VM; the bounds apply only to integration browser processes. They
do not change the installed Next bundler, test timeouts, retries, masks or
assertions. Keep the integration scanner running for complete browser and
scan-dependent acceptance; auth-only diagnostics may pause this owned scanner
and must restore the same container before those gates.

Private random credentials and certificates stay under ignored .runtime/.
Never run the original release/migration scripts against a source database.
Only native Git manages commits; the runner builds a private disposable index.

Run `test-isolation.mjs`, `test-battery-exit.mjs` and `test-runner-lock.mjs`
directly with docker exec, outside the wrapper: they launch child commands and
must not hold the same lock themselves. `test-host-isolation.ps1` checks host
ownership and real mount rejection, restoring the exact private marker bytes.
`test-compose.ps1` and `stack.ps1 Check` validate the actual resource mapping.
Run `test-host-auth-flags.ps1` outside the wrapper to verify explicit
`CQ_E2E_FENCE=1`/`CQ_E2E_PROBE=1` forwarding and standard-battery rejection.
The dedicated fence/probe run uses these flags with the two auth specs; clear
them before the unfiltered standard battery. Its exemptions require separate
actual evidence for all three dedicated cases.
`test-ui-noskip.mjs` runs the original guard against disposable synthetic
reports: the two removed unread/zero-balance prerequisites must be rejected,
and the four R6 visual exemptions must remain registered. This selfproof does
not replace actual dedicated-world/visual executions on the final head.
`test-playwright-env.ts` copies this owned stack's real public CA to a temporary
override path, preserving the fail-closed missing-CA rule while checking that
the server and seeded world use the same storage environment.
The exit-7 probe requires its full argv documented in probe-exit.mjs.

Initial e20bf06 environment acceptance is recorded in the integration
verification document. It does not prove the eventual merged product passes.
Do not regenerate stack.env or rerun the bootstrap while these containers
exist: credentials and owner identity belong to this instance.
