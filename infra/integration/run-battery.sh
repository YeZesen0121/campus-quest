#!/usr/bin/env bash
# Invoked inside launch.sh's common lock. Tests supply local argv vectors.
set -uo pipefail
if [ "$#" -lt 6 ]; then exit 2; fi
output=$1
report_source=$2
shift 2
if [ "${1:-}" != --browser ]; then exit 2; fi
shift
browser=()
while [ "$#" -gt 0 ] && [ "$1" != --guard ]; do browser+=("$1"); shift; done
if [ "${1:-}" != --guard ]; then exit 2; fi
shift
guard=("$@")
if [ "${#browser[@]}" -eq 0 ] || [ "${#guard[@]}" -eq 0 ]; then exit 2; fi

python3 - "$output" "$report_source" <<'PY'
from pathlib import Path
import sys
runtime = Path('/workspace/infra/integration/.runtime').resolve()
output, source = (Path(value).resolve() for value in sys.argv[1:])
if not output.is_relative_to(runtime) or output.exists():
    raise SystemExit('Refusing reused or foreign battery output')
allowed = source.is_relative_to(runtime) or source.is_relative_to(Path('/workspace/frontend/test-results'))
if not allowed or not source.name.endswith('report.json'):
    raise SystemExit('Refusing a report outside the integration workspace')
output.mkdir(parents=True)
source.parent.mkdir(parents=True, exist_ok=True)
source.unlink(missing_ok=True)
PY
preflight=$?
if [ "$preflight" -ne 0 ]; then exit "$preflight"; fi
start=$(date -u +%Y-%m-%dT%H:%M:%SZ)
"${browser[@]}" >"$output/browser.log" 2>&1
browser_exit=$?
fresh=0
if [ -f "$report_source" ]; then
    cp -- "$report_source" "$output/report.json" || exit 1
    fresh=1
fi
"${guard[@]}" >"$output/guard.log" 2>&1
guard_exit=$?
cat "$output/browser.log"
cat "$output/guard.log"

python3 - "$output" "$report_source" "$browser_exit" "$guard_exit" "$fresh" "$start" <<'PY'
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sys
directory, source = map(Path, sys.argv[1:3])
browser, guard, fresh = int(sys.argv[3]), int(sys.argv[4]), sys.argv[5] == '1'
hash_ = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
report_hash = hash_(directory / 'report.json') if fresh else None
unchanged = fresh and source.is_file() and hash_(source) == report_hash
result = {'run_id': directory.name, 'head': os.environ.get('CQ_INTEGRATION_HEAD', 'unbound-selfproof'),
          'world': 'standard', 'start': sys.argv[6], 'end': dt.datetime.now(dt.timezone.utc).isoformat(),
          'browser_exit': browser, 'guard_exit': guard, 'fresh_report': fresh,
          'report_sha256': report_hash, 'report_unchanged_through_guard': unchanged,
          'browser_log_sha256': hash_(directory / 'browser.log'), 'guard_log_sha256': hash_(directory / 'guard.log')}
(directory / 'result.json').write_text(json.dumps(result, indent=2))
print('INTEGRATION_BATTERY_RESULT=' + json.dumps(result), flush=True)
raise SystemExit(browser or guard or (0 if fresh and unchanged else 1))
PY
exit $?
