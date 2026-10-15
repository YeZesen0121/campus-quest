# R5 independent local stack

This stack belongs to the R5 worktree. It does not use the UI checkout,
UI containers, existing databases, Redis, buckets or browser sessions.
Never combine `compose.yml` here with `infra/docker-compose.yml`, and never run
the original `verify-clean-start.sh` or `verify-migrations.sh` against it.

The current local host is Windows with Docker inside WSL `CampusQuest-Dev`.
The Docker engine must already be available. Starting a shared Docker engine
can activate containers with an existing restart policy; the R5 helpers do
not start, stop or change those containers.

## Resources

| Resource | Exclusive R5 address/name |
| --- | --- |
| Compose project | `campusquest-r5` |
| Runner | `campusquest-r5-runner`, current worktree mounted at `/workspace` |
| PostgreSQL | `127.0.0.1:16435`, database `campusquest_test_r5` |
| Redis | `127.0.0.1:6475`; backend tests DB 0, browser world DB 1 |
| MinIO HTTP / TLS | `127.0.0.1:9105` / `127.0.0.1:9106` |
| Object bucket | `campusquest-test-r5` on each dedicated MinIO |
| ClamAV | `127.0.0.1:3315`, container `campusquest-r5-clamav` |
| Browser Web / API | `https://localhost:3305` / `http://localhost:8305/api/v1` |
| Volumes | All start with `campusquest-r5_` |
| Local outputs | `infra/r5/.runtime/` (ignored; includes private dev certificates) |

Web and API start only for Playwright runs. The API remains HTTP behind the
HTTPS frontend, matching the existing secure-cookie test setup. Each
Playwright test uses its own browser context. Port differences alone do not
isolate cookies; do not use the UI browser profile for a manual R5 session.

The runner uses the locally available image `campusquest-r3-runtime:20261011`
as immutable runtime layers. Its writable container, Python environment,
Node dependencies, `.next` output and caches belong only to R5. New hosts
must provide that image or an equivalent pinned Linux browser runtime;
this local helper is not a production deployment artifact.

## Start and inspect

From this worktree in PowerShell:

```powershell
& ./infra/r5/stack.ps1 Check
& ./infra/r5/stack.ps1 Start
& ./infra/r5/stack.ps1 Status
```

`Start` creates only this project and uses `--no-recreate`, so it will not
interrupt an existing R5 test run. `Stop` stops only the ownership-checked
R5 containers and preserves all data. Neither helper exposes a volume
deletion command. Do not stop/recreate the runner while another agent is
testing.

On a newly created runner, prepare dependencies before allowing test calls:

```powershell
wsl.exe -d CampusQuest-Dev --exec docker exec -w /workspace/backend campusquest-r5-runner uv sync --frozen --python /usr/bin/python3
& ./infra/r5/run.ps1 frontend ci
& ./infra/r5/run.ps1 backend alembic upgrade head
```

Dependency preparation is already complete for the current runner. Repeating
`npm ci` during another test would replace its dependencies; coordinate first.

## Run and verify

```powershell
& ./infra/r5/run.ps1 backend pytest tests/unit -q
& ./infra/r5/run.ps1 backend pytest tests/integration/innovation -m integration -q
& ./infra/r5/run.ps1 backend ruff check app tests alembic
& ./infra/r5/run.ps1 backend ruff format --check app tests alembic
& ./infra/r5/run.ps1 backend mypy
& ./infra/r5/run.ps1 python scripts/check_test_matrix.py
& ./infra/r5/run.ps1 frontend run typecheck
& ./infra/r5/run.ps1 frontend run lint
& ./infra/r5/run.ps1 frontend run check:css
& ./infra/r5/run.ps1 frontend run test:unit
& ./infra/r5/run.ps1 frontend run build
& ./infra/r5/run.ps1 tsx --test src/__tests__/auth-api.test.ts src/__tests__/workspace-gate.test.ts
& ./infra/r5/run.ps1 playwright innovation-mentors.spec.ts --project=chromium
& ./infra/r5/run.ps1 visual innovation-talents-visual.spec.ts --project=chromium
```

R5's mentor world is opt-in so existing visual fixtures retain their original
account set. Set `$env:CQ_E2E_MENTOR_WORLD='1'` before running mentor browser
specs; clear it before existing visual suites unless that suite explicitly
requires the mentor fixture.

For gated backend suites, set the flags in the calling PowerShell process.
`run.ps1` forwards only these Boolean test flags, never database/storage
addresses from the host shell:

```powershell
$env:CQ_E2E='1'
$env:CQ_S3_SMOKE='1'
$env:CQ_COMPOSITION_SMOKE='1'
$env:CQ_EVIDENCE_SCAN_SMOKE='1'
& ./infra/r5/run.ps1 backend pytest tests/integration -m integration -q
& ./infra/r5/run.ps1 backend pytest tests/e2e -q
```

The wrapper verifies the source mount and R5 addresses. Every runner mode
shares an exclusive lock, including frontend builds/typechecks and browser
runs because they share `.next`. Pass the mode positionally; arguments such
as pytest/alembic `-m`, pytest `-k`, and values containing spaces are forwarded
unchanged instead of being interpreted as PowerShell parameter abbreviations.
The launcher snapshots
the implementation script before execution, so later source edits cannot
change an active shell's read offset. `flock --close` prevents server child
processes from inheriting the lock. Logs preserve all stdout/stderr, and
`R5_RUN_EXIT`, `R5_LAUNCH_EXIT`, and `R5_DOCKER_EXEC_EXIT` report each layer's
actual exit code. Do not pipe these gates through output-truncation commands.

The worktree's `.git` file points to a Windows path which the Linux container
cannot resolve. Before each call, the wrapper reads the native worktree's
tracked filenames (`git ls-files -z`) without modifying its index. Inside the
runner lock, `prepare-git.py` updates private metadata and an index under
`/tmp/campusquest-r5-git/current`, using those files' current working contents.
`GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` let unchanged gates such as
`check:css` scan the same tracked source, including newly staged R5 files.
Stage new files with native Windows Git before these gates; untracked files
are intentionally not promoted into the gate index. Deleted paths disappear.
The per-call inventory is preserved under `.runtime/git-manifests/`.

This private context has no commit history. Use native Windows Git for head,
branch, review, staging and commits. Neither the shared repository metadata nor
the worktree's `.git` pointer is mounted into or rewritten by this workaround.

Smoke and infrastructure checks:

```powershell
& ./infra/r5/run.ps1 tsx --test ../infra/r5/test-playwright-env.ts
& ./infra/r5/run.ps1 node ../infra/r5/test-git-context.mjs
& ./infra/r5/run.ps1 python ../infra/r5/smoke-runtime.py
& ./infra/r5/run.ps1 node ../infra/r5/smoke-browser.mjs
& ./infra/r5/run.ps1 python ../infra/r5/verify-migrations.py
```

The runner serialization self-test must run outside the wrapper (it launches
two wrapper children and must not hold their lock itself):

```powershell
wsl.exe -d CampusQuest-Dev --exec docker exec campusquest-r5-runner node /workspace/infra/r5/test-runner-lock.mjs
```

`smoke-runtime.py` verifies PostgreSQL/Redis, actual HTTP/TLS object read/write,
certificate trust, R5 origin CORS acceptance, and rejection of the UI's
port-3000 origin. `probe-exit.mjs` is an intentional exit-7 probe for argument
and exit-code preservation, not a passing feature test.

The existing backend object-storage smoke accepts `CQ_S3_SMOKE_ORIGIN`
(default `http://localhost:3000` for the original/CI stack). This runner pins
it to its own HTTP MinIO origin `http://localhost:3305`; the MinIO allowlist
continues rejecting the UI origin instead of borrowing its CORS permission.

The migration probe creates a unique temporary database only inside the R5
PostgreSQL, exercises upgrade/check/downgrade/re-upgrade/check, and drops
only that invocation's database. Coordinate migration-file ownership first.
It does not run the original script that targets another compose project.

New R5 feature gates and the shared test-infrastructure changes still require
the applicable complete browser/visual/no-skip/coverage/audit evidence at the
final feature head. Runtime smoke success does not stand in for that evidence.
