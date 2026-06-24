"""OAuth schemas."""

from typing import Literal

from pydantic import BaseModel, Field


class OAuthAppCreate(BaseModel):
    client_id: str
    client_secret: str = Field(..., min_length=8)
    name: str
    redirect_uri: str


class OAuthAppOut(BaseModel):
    client_id: str
    name: str
    redirect_uri: str
    model_config = {"from_attributes": True}


class OAuthAuthorizeRequest(BaseModel):
    client_id: str
    redirect_uri: str
    response_type: Literal["code"] = "code"
    scope: str | None = None
    state: str | None = None


class OAuthTokenRequest(BaseModel):
    grant_type: Literal["authorization_code", "refresh_token"] = "authorization_code"
    code: str
    client_id: str
    client_secret: str = Field(..., min_length=8)
    redirect_uri: str
