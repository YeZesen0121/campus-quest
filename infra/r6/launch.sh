#!/usr/bin/env bash
# Keep this tiny launcher stable; each run executes a private script snapshot.
set -uo pipefail
snapshot=$(mktemp /tmp/campusquest-r6-run.XXXXXX)
trap 'rm -f -- "$snapshot"' EXIT
cp /workspace/infra/r6/run.sh "$snapshot" || exit 2
printf 'R6_RUN_SCRIPT_SHA256=%s\n' "$(sha256sum "$snapshot" | cut -d ' ' -f 1)"
# All modes share the lock: frontend build/typecheck and browser dev servers
# also write/read the same .next tree. --close prevents child inheritance.
flock -x --close /tmp/campusquest-r6-test-world.lock bash "$snapshot" "$@"
result=$?
printf 'R6_LAUNCH_EXIT=%s\n' "$result"
exit "$result"
