"""知识库数据模型.

定义两张表:
  - zhs_knowledge_doc    知识文档
  - zhs_knowledge_chunk  文档切片 (含向量)
"""

from sqlalchemy import Column, Float, Index, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


class KnowledgeDoc(TimestampMixin, Base):
    """知识文档."""

    __tablename__ = "zhs_knowledge_doc"
    __table_args__ = (
        Index("ix_knowledge_doc_owner", "owner_uuid"),
        Index("ix_knowledge_doc_collection", "collection_name"),
    )

    id = id_column(comment="文档ID")
    owner_uuid = Column(String(64), nullable=False, comment="所有者UUID")
    collection_name = Column(String(100), nullable=False, default="default", comment="集合名")
    title = Column(String(255), nullable=False, comment="文档标题")
    source_type = Column(String(20), nullable=False, default="text", comment="来源类型: text/file/url")
    source_path = Column(String(500), nullable=True, comment="原始文件路径")
    content_hash = Column(String(64), nullable=True, comment="内容哈希")
    chunk_count = Column(Integer, default=0, comment="切片数量")
    status = Column(String(20), nullable=False, default="active", comment="active/deleted")
    metadata_json = Column(Text, nullable=True, comment="元数据JSON")


class KnowledgeChunk(TimestampMixin, Base):
    """文档切片 (含向量)."""

    __tablename__ = "zhs_knowledge_chunk"
    __table_args__ = (
        Index("ix_knowledge_chunk_doc_id", "doc_id"),
        Index("ix_knowledge_chunk_collection", "collection_name"),
    )

    id = id_column(comment="切片ID")
    doc_id = Column(Integer, nullable=False, comment="所属文档ID")
    collection_name = Column(String(100), nullable=False, default="default", comment="集合名")
    owner_uuid = Column(String(64), nullable=False, comment="所有者UUID")
    chunk_index = Column(Integer, nullable=False, comment="切片序号")
    content = Column(Text, nullable=False, comment="切片内容")
    embedding = Column(Text, nullable=True, comment="向量JSON")
    similarity_score = Column(Float, default=0.0, comment="相似度分数 (0-1, 非金额)")
