"""SQLAlchemy model for the docs module (migrated from client/backend-docs/Document.java)."""
from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, Index, String, Text
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "admin_document"

    id = Column(String(64), primary_key=True)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, default="general")
    content = Column(Text, nullable=True)
    markdown = Column(Text, nullable=True)
    size_bytes = Column(BigInteger, default=0)
    mime_type = Column(String(100), nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    __table_args__ = (
        Index("idx_document_category", "category"),
        Index("idx_document_created_at", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "filename": self.filename,
            "category": self.category,
            "content": self.content,
            "markdown": self.markdown,
            "sizeBytes": self.size_bytes,
            "mimeType": self.mime_type,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


def get_distinct_categories_query():
    """Return SQLAlchemy select for distinct categories."""
    from sqlalchemy import distinct, select

    return select(distinct(Document.category)).order_by(Document.category)
