"""Mentor identity cannot enter task-only permission families."""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.errors import BusinessError
from app.modules.identity import dependencies
from app.modules.identity.enums import Role, UserStatus


async def test_mentor_is_denied_submission_download_guard(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Authentication is outside this permission predicate; all resolved account
    # state is supplied, so this catches the former non-staff => student branch.
    async def resolved(*args: object) -> SimpleNamespace:
        return SimpleNamespace(id=uuid4(), role=Role.MENTOR, status=UserStatus.ACTIVE)

    monkeypatch.setattr(dependencies, "_resolve_user", resolved)
    with pytest.raises(BusinessError) as denied:
        await dependencies.require_active_student_or_staff_management_actor(
            None, None, None, None
        )
    assert denied.value.code == "PERMISSION_DENIED"
