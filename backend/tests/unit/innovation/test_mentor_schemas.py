"""R5 validation derives from the confirmed consent boundaries."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.innovation.mentor_schemas import (
    MentorConfirmCommand,
    MentorFields,
    MentorScopeCommand,
)


def test_publication_requires_real_decision_information_but_not_achievements():
    fields = MentorFields(
        name="模拟导师",
        unit="模拟学院",
        introduction="演示",
        directions="AI",
        project_types="学习实践",
    )
    fields.validate_publication()
    with pytest.raises(ValueError):
        fields.model_copy(update={"directions": ""}).validate_publication()


def test_mentor_must_explicitly_confirm_profile():
    with pytest.raises(ValidationError):
        MentorConfirmCommand(
            request_id=uuid4(),
            version=1,
            confirm_profile=False,
            contact_channels=[],
            authorized_fields=[],
            accepting_contact=False,
        )


@pytest.mark.parametrize(
    "field", ["name", "unit", "contacts", "accepting_contact", "user_id"]
)
def test_maintenance_scope_cannot_grant_identity_contact_or_account_changes(field):
    with pytest.raises(ValidationError):
        MentorScopeCommand(request_id=uuid4(), version=1, authorized_fields=[field])


def test_duplicate_contacts_and_grants_are_not_silent():
    with pytest.raises(ValidationError):
        MentorFields(contacts=[{"channel": "EMAIL", "value": "a@example.com"}] * 2)
    with pytest.raises(ValidationError):
        MentorScopeCommand(
            request_id=uuid4(), version=1, authorized_fields=["directions"] * 2
        )
