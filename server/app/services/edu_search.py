"""edu_search service - Search (migrated from ihui-ai-edu-search-service).

Uses Elasticsearch (from storage/edu-assets/elasticsearch-7.17.16/) for full-text search.
"""

from __future__ import annotations
from sqlalchemy import and_, desc, or_, select
from app.models.edu_models import EduSearchIndex
from app.services.edu_base import EduValidationError, paginate


def index_entity(
    db: Session, entity_type: str, entity_id: int, title: str,
    content: Optional[str] = None, tags: Optional[str] = None,
    boost: float = 1.0,
) -> EduSearchIndex:
    """Index or re-index an entity for search.

    2026-06-25 字段对齐修复: entity_type/entity_id→target_type/target_id,
    boost→weight, 移除 indexed_at (真实模型无此字段, 由 TimestampMixin 提供时间戳).
    """
    if entity_type not in ("course", "article", "question", "user"):
        raise EduValidationError("entity_type must be course/article/question/user")
    existing = db.execute(
        select(EduSearchIndex).where(
            and_(EduSearchIndex.target_type == entity_type, EduSearchIndex.target_id == entity_id)
        )
    ).scalar_one_or_none()
    if existing:
        existing.title = title
        existing.content = content
        existing.tags = tags
        existing.weight = boost
        db.flush()
        db.refresh(existing)
        return existing
    idx = EduSearchIndex(
        target_type=entity_type, target_id=entity_id,
        title=title, content=content, tags=tags, weight=boost,
    )
    db.add(idx)
    db.flush()
    db.refresh(idx)
    return idx


def search(
    db: Session, q: str, entity_type: Optional[str] = None,
    page: int = 1, size: int = 20,
) -> Tuple[List[EduSearchIndex], int]:
    """Full-text search across indexed entities.

    2026-06-25 字段对齐修复: entity_type→target_type, boost→weight.
    """
    if not q:
        raise EduValidationError("q (query) required")
    filters = [or_(
        EduSearchIndex.title.ilike(f"%{q}%"),
        EduSearchIndex.content.ilike(f"%{q}%"),
        EduSearchIndex.tags.ilike(f"%{q}%"),
    )]
    if entity_type:
        filters.append(EduSearchIndex.target_type == entity_type)
    return paginate(db, EduSearchIndex, page=page, size=size, filters=filters,
                    order_by=desc(EduSearchIndex.weight))


def delete_index(db: Session, entity_type: str, entity_id: int) -> bool:
    """Delete an index entry by entity type and id.

    2026-06-25 字段对齐修复: entity_type/entity_id→target_type/target_id.
    """
    idx = db.execute(
        select(EduSearchIndex).where(
            and_(EduSearchIndex.target_type == entity_type, EduSearchIndex.target_id == entity_id)
        )
    ).scalar_one_or_none()
    if not idx:
        return False
    db.delete(idx)
    db.flush()
    return True
