"""Crew orchestration models (placeholder for crew agent framework)."""

from sqlalchemy import Column, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


class CrewSession(TimestampMixin, Base):
    """Crew agent session."""

    __tablename__ = "crew_session"

    id = id_column()
    session_id = Column(String(64), unique=True, nullable=False, comment="Session UUID")
    status = Column(Integer, default=0, comment="0=pending, 1=running, 2=done, 3=error")
    result = Column(Text, nullable=True, comment="Final result text")


class CrewTask(TimestampMixin, Base):
    """Crew agent task within a session."""

    __tablename__ = "crew_task"

    id = id_column()
    session_id = Column(String(64), nullable=False, index=True, comment="Session UUID")
    task_name = Column(String(200), nullable=True)
    status = Column(Integer, default=0, comment="0=pending, 1=running, 2=done, 3=error")
    output = Column(Text, nullable=True)


class CrewMessage(TimestampMixin, Base):
    """Crew agent message log."""

    __tablename__ = "crew_message"

    id = id_column()
    session_id = Column(String(64), nullable=False, index=True, comment="Session UUID")
    role = Column(String(20), nullable=False, comment="user/assistant/system")
    content = Column(Text, nullable=True)
