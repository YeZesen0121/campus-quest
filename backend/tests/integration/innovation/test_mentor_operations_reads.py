"""PII-bearing operational reads require durable audit before returning data."""

import httpx
import pytest
from sqlalchemy import select

from app.db.session import get_db_session
from app.main import create_app
from app.modules.audit.models import AuditLog
from app.modules.innovation.mentor_router import get_mentor_service
from app.modules.innovation.mentor_service import MentorService
from tests.integration.innovation.mentor_support import OPS, prepared
from tests.integration.innovation.mentor_support import client as client
from tests.integration.innovation.mentor_support import clock as clock

pytestmark = pytest.mark.integration


async def test_operator_detail_records_pii_read_without_copying_contact_values(
    client, db_session, clock
):
    operator, oh, _, _, _, _, row = await prepared(client, db_session, clock)
    operator_id = operator.id
    response = await client.get(f"{OPS}/{row['id']}", headers=oh)
    assert response.status_code == 200, response.text
    assert "mentor@example.com" in response.text
    logs = list(
        await db_session.scalars(
            select(AuditLog).where(
                AuditLog.actor_user_id == operator_id,
                AuditLog.action == "ie.mentor.read",
            )
        )
    )
    assert len(logs) == 1, "PII-bearing operational detail needs durable read audit"
    assert "mentor@example.com" not in str(logs[0].details)


class UnavailableAudit:
    async def append(self, *args, **kwargs):
        raise RuntimeError("simulated durable audit outage")


async def test_operator_detail_audit_failure_cannot_return_contact_values(
    client, db_session, clock
):
    _, oh, _, _, _, _, row = await prepared(client, db_session, clock)
    app = create_app()

    async def db():
        yield db_session

    app.dependency_overrides[get_db_session] = db
    app.dependency_overrides[get_mentor_service] = lambda: MentorService(
        clock=clock, audit=UnavailableAudit()
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
        base_url="https://localhost",
    ) as failed:
        response = await failed.get(f"{OPS}/{row['id']}", headers=oh)
    assert response.status_code == 500
    assert "mentor@example.com" not in response.text
