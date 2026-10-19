"""Public-introduction fields never include people, contacts or attachments."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.innovation.schemas import Direction, Stage, Summary, Title, Version


class IntroductionFields(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title
    summary: Summary
    direction: Direction
    stage: Stage


class LifecycleCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    version: Version
    confirmation_digest: str = Field(pattern=r"^[a-f0-9]{64}$")


class IntroductionPreviewCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Version
    fields: IntroductionFields


class IntroductionPublishCommand(IntroductionPreviewCommand):
    request_id: UUID
    preview_digest: str = Field(pattern=r"^[a-f0-9]{64}$")


class ClosingRecruitment(BaseModel):
    id: UUID
    role_name: str
    version: int


class LifecycleStateResponse(BaseModel):
    project_id: UUID
    lifecycle: Literal["ACTIVE", "COMPLETED"]
    version: int
    introduction_revision: int | None
    closing_recruitments: list[ClosingRecruitment]
    public_consequence: Literal["RETAIN_PRIOR_PUBLIC", "PRIVATE", "SOURCE_RESTRICTED"]
    can_transition: bool
    confirmation_digest: str


class LifecycleResult(BaseModel):
    project_id: UUID
    lifecycle: Literal["ACTIVE", "COMPLETED"]
    version: int
    introduction_revision: int | None
    replayed: bool
    applied_version: int


class IntroductionPreviewResponse(BaseModel):
    project_id: UUID
    version: int
    fields: IntroductionFields
    source_kind: Literal["ACHIEVEMENT", "RECRUITMENT"]
    next_revision: int
    can_publish: bool
    preview_digest: str
