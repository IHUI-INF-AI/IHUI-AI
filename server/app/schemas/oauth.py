"""OAuth schemas."""


from pydantic import BaseModel


class OAuthAppCreate(BaseModel):
    client_id: str
    client_secret: str
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
    response_type: str = "code"
    scope: str | None = None
    state: str | None = None


class OAuthTokenRequest(BaseModel):
    grant_type: str = "authorization_code"
    code: str
    client_id: str
    client_secret: str
    redirect_uri: str
