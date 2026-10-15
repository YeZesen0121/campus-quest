# R5 persistent local demo

This development world is separate from both the UI world and R5's disposable
test world. It is a local demo with simulated identities. Mentor consent and
project display permissions must be exercised through the real UI/API.

| Resource | Persistent dev | R5 tests, unchanged |
| --- | --- | --- |
| Compose project | `campusquest-r5-dev` | `campusquest-r5` |
| Web | `https://127.0.0.1:3306` | `https://localhost:3305` |
| API | `http://127.0.0.1:8306` | `http://localhost:8305` |
| PostgreSQL | `127.0.0.1:16436 / campusquest_r5_dev` | `16435 / campusquest_test_r5` |
| Redis | `127.0.0.1:6476`, DB 5 | `6475`, DB 0/1 |
| MinIO | TLS `127.0.0.1:9107`, bucket `campusquest-r5-dev` | `9105/9106`, test bucket |
| Runner | `campusquest-r5-dev-runner` | `campusquest-r5-runner` |
| Data/dependency volumes | prefix `campusquest-r5-dev_` | prefix `campusquest-r5_` |

Every exposed endpoint binds to loopback. Dev PostgreSQL and Redis are separate
containers as well as separate database names/numbers. Redis persists its data.
The test runner cannot select the dev database, and the dev entrypoint rejects
test database, cache and object-store addresses before opening a connection.

The dev runner mounts a source snapshot under `.runtime/dev-sources/`, its own
Python environment volume, and separate `node_modules` and `.next` volumes.
Next-generated source files, dependency installation and browser development
cannot change the active test checkout. A snapshot records each copied file's
hash and the source checkout's base commit; uncommitted contents are included.
`git ls-files -co --exclude-standard` selects source files, excluding credentials,
logs, runtime directories and caches through the repository ignores.

## Prepare without starting API/Web

From the R5 worktree, with the existing Docker engine available:

```powershell
& ./infra/r5/dev.ps1 Check
& ./infra/r5/dev.ps1 Prepare
& ./infra/r5/dev.ps1 Verify
& ./infra/r5/dev.ps1 Status
```

`Prepare` refuses to refresh a running dev API/Web. It creates a new source
snapshot, starts only its dependencies and runner, installs frozen Python/Node
dependencies, upgrades only `campusquest_r5_dev`, and runs identity seeding.
It never truncates existing demo data or restarts test containers. Logs and
each real command's exit code are saved under `.runtime/dev-logs/`.

After source changes, explicitly `Stop`, `Prepare`, then `Start` to refresh the
running demo; existing dev data persists. A running demo continues using its
prepared snapshot until that refresh. Old snapshots remain available for
inspection.

## Start the persistent demo after source freeze

```powershell
& ./infra/r5/dev.ps1 Start
& ./infra/r5/dev.ps1 Status
# Stop only this dev API/Web, preserving dependencies and all data:
& ./infra/r5/dev.ps1 Stop
```

`Start` starts/recreates only the owned dev API/Web against the prepared
snapshot. HTTPS uses a dedicated self-signed localhost certificate, so the
first browser visit needs the usual local certificate acknowledgement. Use a
separate browser session for this demo: cookies are scoped by host, not port.
The frontend proxies same-origin API requests to port 8306; secure refresh
cookies keep their real application behavior.

The local run on 2026-10-15 completed `Prepare`, `Start`, `Verify` and `Status`.
The API/Web/runner use snapshot `20261015T100115-f78a37`; at 10:11:48 UTC its
574 application/migration/frontend source and configuration hashes matched the
frozen current worktree with no mismatches. Subsequent E2E fixture and evidence
edits do not change that application snapshot. This is a point-in-time comparison.
Logs under `.runtime/dev-logs/` record application creation/start
(`20261015T100336-start-3291fb.log`), resource verification
(`20261015T100347-verify-74a658.log`), running services
(`20261015T100401-status-c8a4cb.log`), and successful operator/mentor/viewer
login-refresh smoke (`login-refresh-final.log`). Windows Web answered 200;
after one initial readiness 503, three fresh checks answered 200 with PostgreSQL
and Redis available (`windows-ready-final.log`). `Verify` itself probes PostgreSQL,
Redis and TLS storage/CORS; it does not test Web/API routes. These startup and
login results do not replace the full mentor journey and release gates.

| Simulated account | Username | Password | Entry |
| --- | --- | --- | --- |
| Operator | `20250001` | `student-demo-2026` | `/login`, then `/innovation/operations/mentors` |
| Campus viewer | `20250002` | `student-demo-2026` | `/login`, then `/innovation/mentors` |
| Mentor | `mentor@campus.example.edu` | `mentor-demo-2026` | `/mentor/login` |
| Project owner applicant | `20250003` | `student-demo-2026` | `/profile/owner-profile`, apply before inviting |
| Administrator | `admin@campus.example.edu` | `admin-demo-2026` | `/staff/login`, fresh demo TOTP required |

For the complete owner application/admin approval path, a read-only command to
generate the current demo TOTP, and publication through an explicitly confirmed
recruitment, follow `docs/qa/r5-mentor-acceptance.md`. Qualification is deliberately
not pre-granted. Withdraw mentor visibility only after the invitation journey;
withdrawn mentors cannot be searched for a new invitation.

The existing demo identity script also seeds its other student and staff
identities. `dev-seed.py` adds only the operator grant and explicit demo labels;
it does not create mentor profiles, publish revisions, confirm consent, grant
project-owner qualification or accept project links. Repeating `Seed` preserves
existing accounts and grants, including a grant later disabled during a demo.
Normal `Verify` checks the mentor identity/role and operator grant exist, while
preserving suspension and revoked grants from the demo. Only `--fresh-seed`
asserts the initial active/enabled state. `test-dev-verify.py` regresses these
states against a freshly seeded, stopped dev world and restores the saved values
in `finally`; run it with the dev runner's Python, never the shared test runner.

This prepared R5 mentor demo has no background worker/Beat or ClamAV service.
Mentor operations are synchronous and do not require them. Attachment scanning
and unrelated background workflows require their own dev services before being
offered as part of a broader demo; the API's scanner currently fails closed.

The helpers expose no `down`, volume-delete or database-reset command. They
never modify the UI checkout or borrow its services.
