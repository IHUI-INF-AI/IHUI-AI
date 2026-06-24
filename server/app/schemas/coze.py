from typing import Any

from pydantic import BaseModel, Field


class ReviewUpdateReq(BaseModel):
    bot_id: str
    connector_id: str
    audit_status: int
    reason: str | None = None


class ReviewUpdateResp(BaseModel):
    success: bool
    message: str
    data: dict[str, Any] | None = None


class ConvListReq(BaseModel):
    bot_id: str
    user_id: str
    limit: int | None = Field(default=10, ge=1, le=100)
    offset: int | None = Field(default=0, ge=0)


class MsgListReq(BaseModel):
    conversation_id: str
    limit: int | None = Field(default=10, ge=1, le=100)
    offset: int | None = Field(default=0, ge=0)


class FeedbackReq(BaseModel):
    message_id: str
    conversation_id: str
    feedback_type: str
    content: str | None = ""


class DatasetCreateReq(BaseModel):
    name: str
    description: str | None = None
    space_id: str


class DuplicateTemplateReq(BaseModel):
    template_id: str
    workspace_id: str
    name: str


class WorkspaceMembersReq(BaseModel):
    workspace_id: str
    members: list[dict[str, Any]]


class DeleteMembersReq(BaseModel):
    workspace_id: str
    member_ids: list[str]


class CreateVariableReq(BaseModel):
    connector_id: str
    keyword: str
    value: str
    type: str | None = "string"


class UpdateVariableReq(BaseModel):
    connector_id: str
    variable_id: str
    value: str


class DeleteVariableReq(BaseModel):
    connector_id: str
    variable_id: str
