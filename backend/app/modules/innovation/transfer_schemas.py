"""Minimal receipts remain readable after management authority ends."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TransferCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    target_ref: UUID
    evidence_ids: list[UUID] = Field(max_length=100)
    allow_preview: bool

    @field_validator("evidence_ids")
    @classmethod
    def unique_sorted(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("证明材料不能重复选择")
        return sorted(value)


class TransferCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    version: int = Field(ge=1)
    confirmation_digest: str = Field(pattern=r"^[a-f0-9]{64}$")


class TransferRelationship(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reference: UUID
    kind: Literal["MANAGER", "MEMBER", "MENTOR"]
    name: str
    division: str | None
    scope: Literal["TEXT_AND_RECRUITMENT", "PUBLIC_NAME_ONLY", "MENTOR_DISPLAY_ONLY"]


class TransferClosingRecruitment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reference: UUID
    role_name: str
    status: Literal["OPEN"]
    deadline_at: datetime | None


class TransferSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str
    summary: str
    direction: str
    stage: str
    team_status: str
    project_version: int
    ownership_generation: int
    achievement_count: int
    manager_count: int
    member_count: int
    mentor_count: int
    open_recruitment_count: int
    state_digest: str
    lifecycle: Literal["ACTIVE", "COMPLETED"] = "ACTIVE"
    # Old immutable proposals did not record these lists. None means unknown,
    # whereas [] in a v2 snapshot means the project really had no such entries.
    snapshot_version: Literal[1, 2] = 1
    relationships: list[TransferRelationship] | None = None
    closing_recruitments: list[TransferClosingRecruitment] | None = None
    introduction_revision: int | None = None


class TransferProof(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    version: int
    sha256: str | None
    size: int
    content_type: str
    state: Literal["PENDING", "CHECKING", "READY", "REJECTED"]
    removed: bool


class TransferResponse(BaseModel):
    id: UUID
    project_id: UUID
    project_title: str
    counterpart_nickname: str
    status: Literal[
        "PENDING", "ACCEPTED", "REJECTED", "CANCELED", "EXPIRED", "INVALIDATED"
    ]
    version: int
    is_target: bool
    expires_at: datetime
    created_at: datetime
    updated_at: datetime
    # Null after any terminal outcome: result recovery never returns private drafts.
    initial_summary: TransferSummary | None = None
    current_summary: TransferSummary | None = None
    confirmation_digest: str | None = None
    evidence: list[TransferProof] = Field(default_factory=list)
    allow_preview: bool = False
    blockers: list[str] = Field(default_factory=list)


class TransferListResponse(BaseModel):
    items: list[TransferResponse]
    total: int
    limit: int
    offset: int


class TransferProofChoice(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    achievement_title: str
    content_type: str
    size: int


class TransferProofChoicesResponse(BaseModel):
    items: list[TransferProofChoice]
    total: int
    limit: int
    offset: int
