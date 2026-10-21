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
if output.is_relative_to(source.parent):
    raise SystemExit('Refusing an archive nested under its source output')
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
archive_exit=0
if [ -f "$report_source" ]; then
    cp -- "$report_source" "$output/report.json" || exit 1
    fresh=1
    # Snapshot the complete output before another Playwright invocation can
    # clean it. testInfo.outputPath screenshots need not be JSON attachments.
    python3 - "$output" "$report_source" <<'PY'
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

directory, source = map(Path, sys.argv[1:])
for path in source.parent.rglob('*'):
    if path.is_symlink():
        raise SystemExit('Refusing a symlinked browser artifact')
archive = directory / 'test-results'
shutil.copytree(source.parent, archive)

def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()

files = [
    {'path': path.relative_to(archive).as_posix(), 'bytes': path.stat().st_size,
     'sha256': digest(path)}
    for path in sorted(archive.rglob('*')) if path.is_file()
]
manifest = {'head': os.environ.get('CQ_INTEGRATION_HEAD', 'unbound-selfproof'),
            'run_id': directory.name, 'source': str(source.parent),
            'archive': 'test-results', 'files': files,
            'snapshotted_at': dt.datetime.now(dt.timezone.utc).isoformat()}
(directory / 'artifacts-manifest.json').write_text(json.dumps(manifest, indent=2))
print('INTEGRATION_BATTERY_ARTIFACTS=' + json.dumps({'files': len(files)}), flush=True)
PY
    archive_exit=$?
fi
"${guard[@]}" >"$output/guard.log" 2>&1
guard_exit=$?
cat "$output/browser.log"
cat "$output/guard.log"

python3 - "$output" "$report_source" "$browser_exit" "$guard_exit" "$fresh" "$start" "$archive_exit" <<'PY'
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sys
directory, source = map(Path, sys.argv[1:3])
browser, guard, fresh = int(sys.argv[3]), int(sys.argv[4]), sys.argv[5] == '1'
def hash_(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()
report_hash = hash_(directory / 'report.json') if fresh else None
unchanged = fresh and source.is_file() and hash_(source) == report_hash
archive_exit = int(sys.argv[7])
manifest_path = directory / 'artifacts-manifest.json'
preserved = fresh and archive_exit == 0 and manifest_path.is_file()
manifest = json.loads(manifest_path.read_text()) if preserved else None
if manifest is not None:
    preserved = all(
        (directory / 'test-results' / row['path']).is_file()
        and (directory / 'test-results' / row['path']).stat().st_size == row['bytes']
        and hash_(directory / 'test-results' / row['path']) == row['sha256']
        for row in manifest['files']
    )
result = {'run_id': directory.name, 'head': os.environ.get('CQ_INTEGRATION_HEAD', 'unbound-selfproof'),
          'world': 'standard', 'start': sys.argv[6], 'end': dt.datetime.now(dt.timezone.utc).isoformat(),
          'browser_exit': browser, 'guard_exit': guard, 'fresh_report': fresh,
          'report_sha256': report_hash, 'report_unchanged_through_guard': unchanged,
          'archive_exit': archive_exit, 'artifacts_preserved': bool(preserved),
          'artifacts_manifest_sha256': hash_(manifest_path) if manifest is not None else None,
          'browser_log_sha256': hash_(directory / 'browser.log'), 'guard_log_sha256': hash_(directory / 'guard.log')}
(directory / 'result.json').write_text(json.dumps(result, indent=2))
print('INTEGRATION_BATTERY_RESULT=' + json.dumps(result), flush=True)
raise SystemExit(browser or guard or archive_exit or (0 if fresh and unchanged and preserved else 1))
PY
exit $?
