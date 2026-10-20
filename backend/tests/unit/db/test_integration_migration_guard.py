"""Reject source/production targets before any migration connection is made."""

import runpy
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[4] / "infra/integration/verify-migrations.py"


@pytest.fixture
def validate():
    return runpy.run_path(str(SCRIPT))["validate_source"]


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+asyncpg://test:unused@127.0.0.1:15432/campusquest_test",
        "postgresql+asyncpg://test:unused@127.0.0.1:16438/campusquest_test_r6",
        "postgresql+asyncpg://test:unused@127.0.0.1:16440/campusquest",
        "postgresql+asyncpg://test:unused@database.example:16440/campusquest_test_integration",
        "https://test:unused@127.0.0.1:16440/campusquest_test_integration",
        "postgresql+asyncpg://admin:unused@127.0.0.1:16440/campusquest_test_integration",
    ],
)
def test_rejects_nonowned_target_before_connect(validate, url):
    with pytest.raises(SystemExit, match="isolated integration PostgreSQL"):
        validate(url)


def test_accepts_only_the_local_owned_target(validate):
    parsed = validate(
        "postgresql+asyncpg://test:unused@127.0.0.1:16440/campusquest_test_integration"
    )
    assert parsed.path == "/campusquest_test_integration"


def test_ci_target_requires_explicit_github_job_contract(validate, monkeypatch):
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    url = "postgresql+asyncpg://test:unused@localhost:15432/campusquest_test"
    with pytest.raises(SystemExit):
        validate(url, ci=True)
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("CQ_INTEGRATION_CI", "1")
    monkeypatch.setenv("CQ_INTEGRATION_PG_PORT", "15432")
    monkeypatch.setenv("CQ_INTEGRATION_DATABASE", "campusquest_test")
    assert validate(url, ci=True).hostname == "localhost"
    with pytest.raises(SystemExit):
        validate(url.replace("/campusquest_test", "/production"), ci=True)
    with pytest.raises(SystemExit):
        validate(url.replace(":15432", ":5432"), ci=True)


def test_base_failure_requires_the_same_upstream_operation_and_error():
    script = runpy.run_path(str(SCRIPT))
    compare = script["compare_downgrade_failures"]
    original = """INFO Running downgrade 0025 -> 0024, document types.
sqlalchemy.exc.IntegrityError: check constraint ck_tasks_allowed_file_types violated
[SQL: ALTER TABLE tasks ADD CONSTRAINT ck_tasks_allowed_file_types CHECK (...)]
"""
    assert compare(original, original)[0] == "0025 -> 0024"
    with pytest.raises(AssertionError, match="differs from pure upstream"):
        compare(original.replace("0025 -> 0024", "ie_0030 -> ie_0029"), original)
    with pytest.raises(AssertionError, match="differs from pure upstream"):
        compare(original.replace("IntegrityError", "OperationalError"), original)
    with pytest.raises(AssertionError, match="failure evidence"):
        compare("database unavailable", "database unavailable")
