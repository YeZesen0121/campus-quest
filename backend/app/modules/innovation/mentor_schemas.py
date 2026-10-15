"""Explicit mentor consent commands and contact-free public representations."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StringConstraints,
    model_validator,
)

from app.modules.innovation.recruitment_schemas import ContactChannel, ContactInput

MaintenanceField = Literal[
    "introduction", "directions", "achievements", "project_types"
]
ConfirmationState = Literal["PENDING", "CONFIRMED", "REJECTED"]
Visibility = Literal["HIDDEN", "VISIBLE"]
Moderation = Literal["NORMAL", "TAKEN_DOWN"]
LinkStatus = Literal["PENDING", "ACCEPTED", "REJECTED", "REVOKED"]


class MentorContent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] = ""
    unit: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] = ""
    introduction: Annotated[
        str, StringConstraints(strip_whitespace=True, max_length=2000)
    ] = ""
    directions: Annotated[
        str, StringConstraints(strip_whitespace=True, max_length=1000)
    ] = ""
    achievements: Annotated[
        str, StringConstraints(strip_whitespace=True, max_length=3000)
    ] = ""
    project_types: Annotated[
        str, StringConstraints(strip_whitespace=True, max_length=1000)
    ] = ""


class MentorFields(MentorContent):
    contacts: list[ContactInput] = Field(default_factory=list, max_length=4)

    @model_validator(mode="after")
    def unique_contacts(self) -> "MentorFields":
        if len({c.channel for c in self.contacts}) != len(self.contacts):
            raise ValueError("每种联系渠道只能填写一次")
        return self

    def validate_publication(self) -> None:
        if not all(
            (
                self.name,
                self.unit,
                self.introduction,
                self.directions,
                self.project_types,
            )
        ):
            raise ValueError("请完善姓名、单位、简介、方向及愿意指导的项目类型")


class MentorCreateCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    mentor_username: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
    fields: MentorFields


class MentorVersionCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    version: Annotated[int, Field(strict=True, ge=1)]


class MentorSaveCommand(MentorVersionCommand):
    fields: MentorFields


class MentorScopeCommand(MentorVersionCommand):
    authorized_fields: list[MaintenanceField] = Field(max_length=4)

    @model_validator(mode="after")
    def unique_scope(self) -> "MentorScopeCommand":
        if len(set(self.authorized_fields)) != len(self.authorized_fields):
            raise ValueError("维护授权字段不能重复")
        return self


class MentorConfirmCommand(MentorScopeCommand):
    confirm_profile: StrictBool
    contact_channels: list[ContactChannel] = Field(max_length=4)
    accepting_contact: StrictBool

    @model_validator(mode="after")
    def explicit_confirmation(self) -> "MentorConfirmCommand":
        if not self.confirm_profile:
            raise ValueError("请本人确认公开资料")
        if len(set(self.contact_channels)) != len(self.contact_channels):
            raise ValueError("联系渠道不能重复")
        if self.accepting_contact and not self.contact_channels:
            raise ValueError("接受联系时请至少授权一种渠道，或选择暂停联系")
        return self


class MentorContactStateCommand(MentorVersionCommand):
    accepting_contact: StrictBool


class MentorRevokeContactCommand(MentorVersionCommand):
    channel: ContactChannel


class MentorProfileResponse(BaseModel):
    id: UUID
    fields: MentorFields
    version: int
    confirmation_state: ConfirmationState
    visibility: Visibility
    moderation_state: Moderation
    accepting_contact: bool
    authorized_fields: list[MaintenanceField]
    public_version: int
    public_content: MentorContent | None
    public_contact_channels: list[ContactChannel]
    updated_at: datetime


class MentorProfileReadResponse(BaseModel):
    profile: MentorProfileResponse | None


class MentorActionResult(BaseModel):
    action: str
    replayed: bool
    applied_version: int
    current: MentorProfileResponse


class MentorOperationsSummary(BaseModel):
    id: UUID
    name: str
    unit: str
    version: int
    confirmation_state: ConfirmationState
    visibility: Visibility
    moderation_state: Moderation
    updated_at: datetime


class MentorOperationsListResponse(BaseModel):
    items: list[MentorOperationsSummary]
    total: int
    limit: int
    offset: int


class PublicMentorSummary(MentorContent):
    id: UUID
    accepting_contact: bool
    public_version: int


class PublicMentorResponse(BaseModel):
    id: UUID
    content: MentorContent
    accepting_contact: bool
    contact_channels: list[ContactChannel]
    public_version: int
    published_at: datetime


class PublicMentorListResponse(BaseModel):
    items: list[PublicMentorSummary]
    total: int
    limit: int
    offset: int


class MentorQuery(BaseModel):
    q: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] = ""
    direction: Annotated[
        str, StringConstraints(strip_whitespace=True, max_length=100)
    ] = ""
    accepting_contact: bool | None = None
    limit: int = Field(default=20, ge=1, le=50)
    offset: int = Field(default=0, ge=0)


class MentorContactReadCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_public_version: Annotated[int, Field(strict=True, ge=1)]


class MentorContactsResponse(BaseModel):
    public_version: int
    contacts: list[ContactInput]


class ProjectMentorCreateCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    mentor_id: UUID


class ProjectMentorResponse(BaseModel):
    id: UUID
    project_id: UUID
    mentor_id: UUID
    mentor_name: str
    project_title: str
    project_summary: str
    project_direction: str
    status: LinkStatus
    version: int
    created_at: datetime


class ProjectMentorListResponse(BaseModel):
    items: list[ProjectMentorResponse]
    total: int
    limit: int
    offset: int


class PublicProjectMentorsResponse(BaseModel):
    items: list[PublicMentorSummary]
