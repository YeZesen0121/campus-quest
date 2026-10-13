"""A new card sentence is required for writes, with legacy reads preserved."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.innovation.talent_schemas import TalentFields, TalentSaveCommand


@pytest.mark.parametrize("value", [None, "", " \n\t "])
def test_save_requires_headline_even_for_an_incomplete_draft(value):
    fields = {} if value is None else {"headline": value}
    with pytest.raises(ValidationError):
        TalentSaveCommand(request_id=uuid4(), version=0, fields=fields)


@pytest.mark.parametrize("character", ["字", "a", "🌱"])
def test_headline_counts_unicode_at_40_codepoints(character):
    command = TalentSaveCommand(
        request_id=uuid4(), version=0, fields={"headline": character * 40}
    )
    assert command.fields.headline == character * 40
    with pytest.raises(ValidationError):
        TalentSaveCommand(
            request_id=uuid4(), version=0, fields={"headline": character * 41}
        )


def test_legacy_read_is_empty_without_inventing_a_sentence():
    fields = TalentFields(introduction="原介绍", advantages="原优势")
    assert fields.headline == ""


def test_headline_only_is_enough_for_a_private_draft():
    command = TalentSaveCommand(
        request_id=uuid4(), version=0, fields={"headline": "  想尝试校园产品实践  "}
    )
    assert command.fields.headline == "想尝试校园产品实践"
    assert command.fields.name == ""
