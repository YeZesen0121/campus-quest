#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/cq-r5-dev-venv/bin:$PATH"
export PYTHONPATH=/workspace/backend
unset CQ_E2E CQ_E2E_MENTOR_WORLD CQ_VISUAL CQ_S3_SMOKE CQ_COMPOSITION_SMOKE CQ_EVIDENCE_SCAN_SMOKE
/usr/bin/python3 - <<'PY'
import os
from urllib.parse import urlsplit
expected = {
    "DATABASE_URL": ("127.0.0.1", 16436, "/campusquest_r5_dev"),
    "REDIS_URL": ("127.0.0.1", 6476, "/5"),
    "S3_ENDPOINT_URL": ("127.0.0.1", 9107, ""),
}
for name, target in expected.items():
    url = urlsplit(os.environ[name])
    if (url.hostname, url.port, url.path) != target:
        raise SystemExit(f"R5_DEV_GUARD_REJECTED={name}")
if os.environ["S3_BUCKET"] != "campusquest-r5-dev":
    raise SystemExit("R5_DEV_GUARD_REJECTED=S3_BUCKET")
print("R5_DEV_RESOURCE_GUARD=PASS", flush=True)
PY
case "${1:-}" in
  prepare)
    cd /workspace/backend
    uv sync --frozen --python /usr/bin/python3
    cd /workspace/frontend
    npm ci
    cd /workspace/backend
    python -m alembic upgrade head
    python /workspace/infra/r5/dev-seed.py
    ;;
  seed)
    cd /workspace/backend
    python /workspace/infra/r5/dev-seed.py
    ;;
  verify)
    cd /workspace/backend
    python /workspace/infra/r5/dev-verify.py
    ;;
  api)
    cd /workspace/backend
    exec python -m uvicorn app.main:app --host 127.0.0.1 --port 8306
    ;;
  web)
    cd /workspace/frontend
    exec node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3306 \
      --experimental-https --experimental-https-key /opt/cq-r5-dev-certs/private.key \
      --experimental-https-cert /opt/cq-r5-dev-certs/public.crt
    ;;
  *) printf 'Usage: dev-process.sh prepare|seed|verify|api|web\n' >&2; exit 2;;
esac
