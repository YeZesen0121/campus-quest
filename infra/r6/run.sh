#!/usr/bin/env bash
# Runs only inside campusquest-r6-runner. The lock prevents test-world overlap.
set -euo pipefail
cd /workspace
export PATH="/opt/cq-noble-venv/bin:$PATH"
export PYTHONPATH=/workspace/backend
export MYPY_CACHE_DIR=/tmp/cq-r6-mypy-cache
export UV_NO_SYNC=1
export CLAMD_HOST=127.0.0.1 CLAMD_PORT=3318
export CQ_S3_SMOKE_ORIGIN=http://localhost:3308

python - <<'PY'
import os
from urllib.parse import urlsplit

for key, port in (("DATABASE_URL", 16438), ("REDIS_URL", 6478)):
    address = urlsplit(os.environ[key])
    if address.hostname != "127.0.0.1" or address.port != port:
        raise SystemExit(f"R6 isolation guard rejected {key}")
if urlsplit(os.environ["DATABASE_URL"]).path != "/campusquest_test_r6":
    raise SystemExit("R6 isolation guard rejected database name")
PY

mode="${1:-}"
shift || true
case "$mode" in
  backend) cd /workspace/backend; command=(python -m "$@");;
  python) cd /workspace/backend; command=(python "$@");;
  frontend) cd /workspace/frontend; command=(npm "$@");;
  node) cd /workspace/frontend; command=(node "$@");;
  tsx) cd /workspace/frontend; command=(npx --no-install tsx "$@");;
  playwright|visual)
    cd /workspace/frontend
    export CQ_E2E=1 CQ_E2E_REUSE_EXISTING=0
    if [ "$mode" = visual ]; then export CQ_VISUAL=1 CQ_E2E_FIXED_LABELS=1; fi
    command=(npx --no-install playwright test "$@")
    ;;
  *) printf 'Usage: run.sh backend|python|frontend|node|tsx|playwright|visual ARGS...\n' >&2; exit 2;;
esac

mkdir -p /workspace/infra/r6/.runtime/logs
log="/workspace/infra/r6/.runtime/logs/$(date -u +%Y%m%dT%H%M%S)-${mode}-$$.log"
printf 'R6_RUN_LOG=%s\n' "$log"
run_command() {
  if [ -n "${CQ_R6_GIT_MANIFEST:-}" ]; then
    export GIT_DIR=/tmp/campusquest-r6-git/current
    export GIT_WORK_TREE=/workspace GIT_INDEX_FILE="$GIT_DIR/index"
    export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
    python /workspace/infra/r6/prepare-git.py || return $?
  fi
  "${command[@]}"
}
set +e
run_command >"$log" 2>&1
result=$?
set -e
cat "$log"
printf 'R6_RUN_EXIT=%s LOG=%s\n' "$result" "$log"
exit "$result"
