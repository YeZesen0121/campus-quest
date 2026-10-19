"""Explicit minimal invitation contracts; never return account identifiers."""

from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.modules.innovation.achievement_schemas import (
    AchievementDraftResponse,
    AchievementDraftUpdate,
)
from app.modules.innovation.schemas import (
    ProjectDraftResponse,
    ProjectDraftUpdate,
    Version,
)

Kind = Literal["MANAGER", "MEMBER"]
Status = Literal["PENDING", "ACCEPTED", "REJECTED", "REVOKED", "EXPIRED"]
PublicName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
]
Division = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
]


class TargetResolveCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account: Annotated[str, StringConstraints(pattern=r"^[0-9]{6,20}$")]


class TargetResponse(BaseModel):
    target_ref: UUID
    nickname: str
    expires_at: datetime


class CollaborationInviteCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    target_ref: UUID
    kind: Kind
    public_name: PublicName | None = None
    division: Division | None = None

    @model_validator(mode="after")
    def purpose_fields(self) -> Self:
        if self.kind == "MEMBER" and (
            self.public_name is None or self.division is None
        ):
            raise ValueError("公开挂名须提供待本人确认的姓名和分工")
        if self.kind == "MANAGER" and (
            self.public_name is not None or self.division is not None
        ):
            raise ValueError("共同管理不包含公开挂名，请单独邀请")
        return self


class CollaborationVersionCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    version: Version


class CollaborationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    project_id: UUID
    project_title: str
    project_summary: str
    project_direction: str
    target_nickname: str
    is_target: bool
    kind: Kind
    status: Status
    public_name: str | None
    division: str | None
    version: int
    expires_at: datetime
    created_at: datetime
    updated_at: datetime


class CollaborationListResponse(BaseModel):
    items: list[CollaborationResponse]
    total: int
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


class ProjectWorkspaceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    draft: ProjectDraftResponse
    role: Literal["OWNER", "MANAGER"]
    can_publish_recruitment: bool
    replayed: bool = False
    applied_version: int | None = None


class CollaborationProjectSaveCommand(ProjectDraftUpdate):
    request_id: UUID


class CollaborationAchievementSaveCommand(AchievementDraftUpdate):
    request_id: UUID


class WorkspaceAchievementSaveResult(BaseModel):
    current: AchievementDraftResponse
    replayed: bool
    applied_version: int


ProjectRole = Literal["OWNER", "MANAGER", "MEMBER"]


class PersonalProjectSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: UUID
    collaboration_id: UUID | None
    role: ProjectRole
    title: str
    summary: str
    direction: str
    public_name: str | None
    division: str | None
    can_edit: bool
    can_publish_recruitment: bool
    can_open_public: bool


class PersonalProjectListResponse(BaseModel):
    items: list[PersonalProjectSummary]
    total: int
    limit: int
    offset: int


class PublicProjectMember(BaseModel):
    model_config = ConfigDict(extra="forbid")
    public_name: str
    division: str


class PublicProjectMembersResponse(BaseModel):
    items: list[PublicProjectMember]
