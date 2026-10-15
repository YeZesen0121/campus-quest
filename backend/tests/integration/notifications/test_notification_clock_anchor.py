"""Collection-time ordering samples must not age newly issued API sessions."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from tests.integration.notifications import test_notification_api as notification_api
from tests.integration.notifications.test_notification_api import api_app as api_app
from tests.integration.notifications.test_notification_api import api_clock as api_clock
from tests.integration.notifications.test_notification_api import client as client

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def old_collection_anchor(monkeypatch: pytest.MonkeyPatch) -> None:
    # Function-scoped autouse fixtures run before the original API fixtures.
    # Model a long collection-to-execution delay without sleeping or altering
    # the real JWT verifier, its TTL, or the application's business clock.
    monkeypatch.setattr(notification_api, "_T0", datetime.now(UTC) - timedelta(hours=1))


async def test_new_notification_session_survives_an_old_collection_anchor(
    client: httpx.AsyncClient,
    db_session: AsyncSession,
    api_clock: notification_api.StepClock,
) -> None:
    student = await notification_api._seed_user(
        db_session, username=f"clock-{uuid4().hex}"
    )
    headers = await notification_api._session_tokens(db_session, api_clock, student)
    response = await client.get("/api/v1/notifications", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}
