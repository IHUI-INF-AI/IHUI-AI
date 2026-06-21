"""
OAuth models (from zhs_center_project).
"""

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


class OAuthApp(TimestampMixin, Base):
    """OAuth application (zhs_center_project.oauth_apps)."""

    __tablename__ = "oauth_apps"

    id = id_column(comment="ID")
    client_id = Column(String(100), unique=True, nullable=False, comment="Client ID")
    client_secret = Column(String(255), nullable=False, comment="Client secret")
    name = Column(String(100), nullable=False, comment="App name")
    redirect_uri = Column(Text, nullable=True, comment="Redirect URI")
    is_active = Column(Integer, default=1, comment="Active status")


class OAuthSession(TimestampMixin, Base):
    """OAuth session (zhs_center_project.oauth_sessions)."""

    __tablename__ = "oauth_sessions"

    id = id_column(comment="ID")
    code = Column(String(100), unique=True, nullable=False, comment="Auth code")
    client_id = Column(String(100), nullable=False, comment="Client ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    expires_at = Column(DateTime, nullable=False, comment="Session expiry")
    state = Column(String(128), nullable=True, comment="CSRF state token")
    is_used = Column(Integer, default=0, comment="Used flag")


class OAuthUser(TimestampMixin, Base):
    """OAuth user mapping (zhs_center_project.oauth_users)."""

    __tablename__ = "oauth_users"

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    provider = Column(String(50), nullable=False, comment="OAuth provider")
    provider_user_id = Column(String(100), nullable=False, comment="Provider user ID")
    access_token = Column(Text, nullable=True, comment="Access token")
    refresh_token = Column(Text, nullable=True, comment="Refresh token")
    expires_at = Column(DateTime, nullable=True, comment="Token expiry")
