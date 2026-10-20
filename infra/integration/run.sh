#!/usr/bin/env bash
# Runs only inside campusquest-integration-runner. The lock prevents test-world overlap.
set -euo pipefail
cd /workspace
export PATH="/opt/cq-noble-venv/bin:$PATH"
export PYTHONPATH=/workspace/backend
export MYPY_CACHE_DIR=/tmp/cq-integration-mypy-cache
export UV_NO_SYNC=1
export CLAMD_HOST=127.0.0.1 CLAMD_PORT=3320
export CQ_S3_SMOKE_ORIGIN=http://localhost:3311

python /workspace/infra/integration/check-isolation.py

mode="${1:-}"
shift || true
# The retained UI/R6/R7 scanners share this WSL VM. Bound only our browser
# compiler processes; test assertions, retries and readiness budgets stay exact.
case "$mode" in
  playwright|visual|battery)
    export RAYON_NUM_THREADS=2
    export NODE_OPTIONS="--max-old-space-size=768"
    export NEXT_TELEMETRY_DISABLED=1
    ;;
esac
case "$mode" in
  backend) cd /workspace/backend; command=(python -m "$@");;
  python) cd /workspace/backend; command=(python "$@");;
  frontend) cd /workspace/frontend; command=(npm "$@");;
  node) cd /workspace/frontend; command=(node "$@");;
  tsx) cd /workspace/frontend; command=(npx --no-install tsx "$@");;
  battery)
    if [ "$#" -ne 0 ] || [ "${CQ_VISUAL:-0}" != 0 ] || [ "${CQ_E2E_MENTOR_WORLD:-0}" != 0 ] || [ "${CQ_E2E_FENCE:-0}" != 0 ] || [ "${CQ_E2E_PROBE:-0}" != 0 ]; then
      printf 'Standard battery requires no filters or special-world flags.\n' >&2
      exit 2
    fi
    cd /workspace/frontend
    export CQ_E2E=1 CQ_E2E_REUSE_EXISTING=0
    battery_root=/workspace/infra/integration/.runtime/batteries
    mkdir -p "$battery_root"
    battery_run="$battery_root/$(date -u +%Y%m%dT%H%M%S)-$$-$RANDOM"
    command=(bash /workspace/infra/integration/run-battery.sh "$battery_run" /workspace/frontend/test-results/report.json
      --browser npm run test:e2e --guard node scripts/assert-e2e-no-skips.mjs)
    ;;
  playwright|visual)
    cd /workspace/frontend
    export CQ_E2E=1 CQ_E2E_REUSE_EXISTING=0
    if [ "$mode" = visual ]; then export CQ_VISUAL=1 CQ_E2E_FIXED_LABELS=1; fi
    command=(npx --no-install playwright test "$@")
    ;;
  *) printf 'Usage: run.sh backend|python|frontend|node|tsx|playwright|visual|battery ARGS...\n' >&2; exit 2;;
esac

mkdir -p /workspace/infra/integration/.runtime/logs
log="/workspace/infra/integration/.runtime/logs/$(date -u +%Y%m%dT%H%M%S)-${mode}-$$.log"
printf 'INTEGRATION_RUN_LOG=%s\n' "$log"
run_command() {
  if [ -n "${CQ_INTEGRATION_GIT_MANIFEST:-}" ]; then
    export GIT_DIR=/tmp/campusquest-integration-git/current
    export GIT_WORK_TREE=/workspace GIT_INDEX_FILE="$GIT_DIR/index"
    export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
    python /workspace/infra/integration/prepare-git.py || return $?
  fi
  "${command[@]}"
}
set +e
run_command >"$log" 2>&1
result=$?
set -e
cat "$log"
printf 'INTEGRATION_RUN_EXIT=%s LOG=%s\n' "$result" "$log"
exit "$result"
