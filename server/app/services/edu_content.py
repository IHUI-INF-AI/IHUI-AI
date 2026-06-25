"""edu_content service - Content/article (migrated from ihui-ai-edu-content-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-content-service\\
"""

from __future__ import annotations

from app.utils.datetime_helper import utcnow

from sqlalchemy import desc, or_

from app.models.edu_models import EduContentArticle
from app.services.edu_base import EduPermissionError, EduValidationError, paginate, get_or_404


def create_article(
    db: Session, author_id: int, title: str, content: str, **fields
) -> EduContentArticle:
    if not title or not content:
        raise EduValidationError("title and content required")
    a = EduContentArticle(
        author_id=author_id, title=title, content=content,
        summary=fields.get("summary"), cover=fields.get("cover"),
        category_id=fields.get("category_id"),
        tags=fields.get("tags"),
        is_published=False,
        view_count=0, like_count=0, comment_count=0,
    )
    db.add(a)
    db.flush()
    db.refresh(a)
    return a


def publish_article(db: Session, article_id: int, author_id: int) -> EduContentArticle:
    a = get_or_404(db, EduContentArticle, article_id, "article")
    if a.author_id != author_id:
        raise EduPermissionError("only the author can publish")
    a.is_published = True
    a.published_at = utcnow()
    db.flush()
    db.refresh(a)
    return a


def increment_view(db: Session, article_id: int) -> EduContentArticle:
    a = get_or_404(db, EduContentArticle, article_id, "article")
    a.view_count = (a.view_count or 0) + 1
    db.flush()
    db.refresh(a)
    return a


def like_article(db: Session, article_id: int) -> EduContentArticle:
    a = get_or_404(db, EduContentArticle, article_id, "article")
    a.like_count = (a.like_count or 0) + 1
    db.flush()
    db.refresh(a)
    return a


def list_articles(
    db: Session, page: int = 1, size: int = 20,
    author_id: Optional[int] = None, category_id: Optional[int] = None,
    is_published: Optional[bool] = None, keyword: Optional[str] = None,
    order_by: str = "latest",
) -> Tuple[List[EduContentArticle], int]:
    filters = []
    if author_id is not None:
        filters.append(EduContentArticle.author_id == author_id)
    if category_id is not None:
        filters.append(EduContentArticle.category_id == category_id)
    if is_published is not None:
        filters.append(EduContentArticle.is_published == is_published)
    if keyword:
        kw = f"%{keyword}%"
        filters.append(or_(EduContentArticle.title.ilike(kw), EduContentArticle.summary.ilike(kw), EduContentArticle.content.ilike(kw)))
    if order_by == "hot":
        order = desc(EduContentArticle.watch_num + EduContentArticle.like_num * 3)
    else:
        order = desc(EduContentArticle.created_at)
    return paginate(db, EduContentArticle, page=page, size=size, filters=filters, order_by=order)


def get_article(db: Session, article_id: int) -> EduContentArticle:
    return get_or_404(db, EduContentArticle, article_id, "article")
