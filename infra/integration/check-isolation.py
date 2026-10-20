"""Reject foreign resources before Git setup, database access or cleanup."""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

directory = Path('/workspace/infra/integration')
resources = json.loads((directory / 'resources.json').read_text())
owner = json.loads((directory / '.runtime/owner.json').read_text())
ports = resources['ports']


def reject(key: str) -> None:
    raise SystemExit(f'INTEGRATION isolation guard rejected {key}')


if owner['id'] != resources['id'] or os.environ.get('CQ_INTEGRATION_ID') != owner['id']:
    reject('CQ_INTEGRATION_ID')

targets = {
    'DATABASE_URL': ('postgresql+asyncpg', '127.0.0.1', ports['postgres'], '/' + resources['database']),
    'CQ_E2E_DATABASE_URL': ('postgresql+asyncpg', '127.0.0.1', ports['postgres'], '/' + resources['database']),
    'REDIS_URL': ('redis', '127.0.0.1', ports['redis'], '/0'),
    'CQ_E2E_REDIS_URL': ('redis', '127.0.0.1', ports['redis'], '/1'),
    'S3_ENDPOINT_URL': ('http', '127.0.0.1', ports['minio_http'], ''),
    'CQ_E2E_S3_ENDPOINT_URL': ('https', '127.0.0.1', ports['minio_tls'], ''),
    'CQ_E2E_BASE_URL': ('https', 'localhost', ports['web'], ''),
    'CQ_E2E_API_URL': ('http', 'localhost', ports['api'], '/api/v1'),
}
for key, expected in targets.items():
    try:
        parsed = urlsplit(os.environ.get(key, ''))
        actual = (parsed.scheme, parsed.hostname, parsed.port, parsed.path)
        if actual != expected or parsed.query or parsed.fragment:
            reject(key)
        if key.endswith('DATABASE_URL') and parsed.username != resources['database_user']:
            reject(key)
    except ValueError:
        reject(key)
for key in ('S3_BUCKET', 'CQ_E2E_S3_BUCKET'):
    if os.environ.get(key) != resources['bucket']:
        reject(key)
if os.environ.get('CLAMD_HOST') != '127.0.0.1' or os.environ.get('CLAMD_PORT') != str(ports['clamav']):
    reject('CLAMD_HOST/CLAMD_PORT')
if Path(os.environ.get('CQ_E2E_S3_CA_BUNDLE', '')).resolve() != directory / '.runtime/minio-certs/public.crt':
    reject('CQ_E2E_S3_CA_BUNDLE')
