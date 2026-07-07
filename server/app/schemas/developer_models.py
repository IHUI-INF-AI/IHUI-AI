"""
Pydantic schemas for custom model provider configuration (developer module).

Key design: ``apiKey`` appears ONLY in write schemas (Create/Update/TestRequest).
Read schemas return a masked ``apiKey`` (e.g. ``sk-****3456``) — the raw key
never leaves the server.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

ApiFormat = Literal["openai_chat", "anthropic_messages", "openai_responses"]
TestMode = Literal["connect", "list", "chat"]
TestStatus = Literal["operational", "degraded", "failed"]
ErrorType = Literal["auth", "endpoint", "network", "format", "unknown"]


# ---------------------------------------------------------------------------
# Write schemas (apiKey in plaintext, write-only)
# ---------------------------------------------------------------------------


class AiModelConfigCreate(BaseModel):
    """Request body for creating a new provider config."""

    name: str = Field(..., max_length=100, description="Display name")
    providerCode: str = Field(..., max_length=64, description="Provider identifier")
    baseUrl: str = Field(..., max_length=500, description="API base URL")
    apiFormat: ApiFormat = Field("openai_chat", description="API format")
    apiKey: str = Field("", description="API key (plaintext, will be encrypted at rest)")
    modelIdForTest: Optional[str] = Field(None, max_length=100, description="Model ID for testing")
    enabled: bool = Field(True, description="Enabled")
    description: Optional[str] = Field(None, description="Description")
    sortOrder: int = Field(0, description="Sort order")
    extraConfig: Optional[str] = Field(None, description="JSON extra config")


class AiModelConfigUpdate(BaseModel):
    """Request body for updating a provider config. All fields optional."""

    name: Optional[str] = Field(None, max_length=100)
    providerCode: Optional[str] = Field(None, max_length=64)
    baseUrl: Optional[str] = Field(None, max_length=500)
    apiFormat: Optional[ApiFormat] = None
    apiKey: Optional[str] = Field(
        None,
        description="New API key (empty string = clear key, None = keep existing)",
    )
    modelIdForTest: Optional[str] = Field(None, max_length=100)
    enabled: Optional[bool] = None
    description: Optional[str] = None
    sortOrder: Optional[int] = None
    extraConfig: Optional[str] = None


class AiModelToggleRequest(BaseModel):
    """Request body for enable/disable toggle."""

    enabled: bool


class AiModelTestRequest(BaseModel):
    """Request body for ad-hoc connection test (before saving)."""

    baseUrl: str = Field(..., max_length=500, description="API base URL")
    apiKey: str = Field("", description="API key (plaintext, never stored)")
    apiFormat: ApiFormat = Field("openai_chat", description="API format")
    modelIdForTest: Optional[str] = Field(None, max_length=100, description="Model ID for test")
    mode: TestMode = Field("chat", description="Test mode: connect / list / chat")


# ---------------------------------------------------------------------------
# Read schemas (apiKey is masked)
# ---------------------------------------------------------------------------


class AiModelConfigOut(BaseModel):
    """Provider config response — apiKey is masked."""

    id: int
    name: str
    providerCode: str
    isBuiltin: bool = False
    baseUrl: str
    apiFormat: str
    apiKey: str = Field("", description="Masked API key (e.g. sk-****3456)")
    hasApiKey: bool = Field(False, description="Whether an API key is set")
    modelIdForTest: Optional[str] = None
    enabled: bool = True
    description: Optional[str] = None
    sortOrder: int = 0
    ownerUuid: Optional[str] = None
    lastTestStatus: Optional[str] = None
    lastTestResponseMs: Optional[int] = None
    lastTestedAt: Optional[str] = None
    lastTestError: Optional[str] = None
    extraConfig: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class AiModelConfigListOut(BaseModel):
    """Paginated list response."""

    list: list[AiModelConfigOut]
    total: int = 0
    page: int = 1
    pageSize: int = 50


# ---------------------------------------------------------------------------
# Test result
# ---------------------------------------------------------------------------


class TestResult(BaseModel):
    """Connection test result — cc-switch / echobird inspired three-state design."""

    status: TestStatus = Field(..., description="operational / degraded / failed")
    success: bool = Field(..., description="Whether the test succeeded")
    responseMs: int = Field(0, description="Response time in milliseconds")
    mode: TestMode = Field(..., description="Test mode used")
    message: str = Field("", description="Human-readable summary")
    detail: Optional[str] = Field(None, description="Error detail (sanitized)")
    errorType: Optional[ErrorType] = Field(None, description="Error classification")
    models: Optional[list[str]] = Field(None, description="Discovered model IDs (mode=list)")


# ---------------------------------------------------------------------------
# API format metadata
# ---------------------------------------------------------------------------


class ApiFormatInfo(BaseModel):
    """Metadata about a supported API format."""

    value: str
    label: str
    endpoint: str
    description: str
