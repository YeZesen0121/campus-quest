#!/usr/bin/env bash
# Keep this tiny launcher stable; each run executes a private script snapshot.
set -uo pipefail
snapshot=$(mktemp /tmp/campusquest-integration-run.XXXXXX)
trap 'rm -f -- "$snapshot"' EXIT
cp /workspace/infra/integration/run.sh "$snapshot" || exit 2
printf 'INTEGRATION_RUN_SCRIPT_SHA256=%s\n' "$(sha256sum "$snapshot" | cut -d ' ' -f 1)"
# All modes share the lock: frontend build/typecheck and browser dev servers
# also write/read the same .next tree. --close prevents child inheritance.
flock -x --close /tmp/campusquest-integration-test-world.lock bash "$snapshot" "$@"
result=$?
printf 'INTEGRATION_LAUNCH_EXIT=%s\n' "$result"
exit "$result"
