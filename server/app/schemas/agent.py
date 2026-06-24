"""
Agent schemas (Pydantic).
"""


from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    """Create agent."""

    agent_id: str = Field(..., pattern=r"^[a-zA-Z0-9_-]{1,64}$", description="Agent ID")
    agent_name: str = Field(..., max_length=200)
    agent_description: str | None = None
    agent_avatar: str | None = None
    category: str | None = None


class AgentUpdate(BaseModel):
    """Update agent."""

    agent_name: str | None = None
    agent_description: str | None = None
    agent_avatar: str | None = None
    category: str | None = None
    publish_status: int | None = None


class AgentOut(BaseModel):
    """Agent response."""

    agent_id: str
    agent_name: str
    agent_description: str | None = None
    agent_avatar: str | None = None
    category: str | None = None
    publish_status: int = 0
    usage_count: int = 0
    like_count: int = 0
    sort: int = 0

    model_config = {"from_attributes": True}


class AgentListResponse(BaseModel):
    """Paginated agent list."""

    code: str = "200"
    msg: str = "success"
    data: list[AgentOut]
    total: int = 0
