"""Contact (about us) CRUD endpoints.

Ported from P2 AiContactController.java
Fixed: SQL injection vulnerability in batch delete.
"""


from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import text

from app.database import SessionFactory2
from app.schemas.common import success, error
from app.schemas.error_codes import ErrorCode
from app.security import require_role

router = APIRouter(prefix="/contact", tags=["Contact (About Us)"])


class ContactIn(BaseModel):
    title: str | None = None
    content: str | None = None
    sort_order: int | None = 0
    status: str | None = "0"
    remark: str | None = None


@router.get("/list")
async def contact_list(pageNum: int = 1, pageSize: int = 10):  # noqa: 42
    """List contacts with pagination."""
    db = SessionFactory2()
    try:
        total = db.execute(text("SELECT COUNT(*) FROM ai_contact")).scalar()
        offset = (pageNum - 1) * pageSize
        rows = db.execute(
            text("SELECT * FROM ai_contact ORDER BY sort_order ASC LIMIT :limit OFFSET :offset"),
            {"limit": pageSize, "offset": offset},
        ).fetchall()
        data = [dict(r._mapping) for r in rows]
        return success({"rows": data, "total": total})
    except Exception as e:
        logger.error("contact list error: " + str(e))
        return error(str(e), ErrorCode.INTERNAL_ERROR)
    finally:
        db.close()


@router.get("/{item_id}")
async def contact_get_info(item_id: int):
    """Get contact detail by ID."""
    db = SessionFactory2()
    try:
        row = db.execute(text("SELECT * FROM ai_contact WHERE id = :id"), {"id": item_id}).fetchone()
        if row:
            return success(dict(row._mapping))
        return error("Not found", ErrorCode.NOT_FOUND)
    except Exception as e:
        logger.error(f"contact get error: {e}")
        return error(str(e), ErrorCode.INTERNAL_ERROR)
    finally:
        db.close()


@router.post("")
async def contact_add(item: ContactIn, user_uuid: str = Depends(require_role("admin"))):
    """Create new contact."""
    db = SessionFactory2()
    try:
        db.execute(
            text(
                "INSERT INTO ai_contact (title, content, sort_order, status, remark) "
                "VALUES (:title, :content, :sort_order, :status, :remark)"
            ),
            {
                "title": item.title,
                "content": item.content,
                "sort_order": item.sort_order,
                "status": item.status,
                "remark": item.remark,
            },
        )
        db.commit()
        return success(None, "Created")
    except Exception as e:
        db.rollback()
        logger.error(f"contact add error: {e}")
        return error(str(e), ErrorCode.INTERNAL_ERROR)
    finally:
        db.close()


@router.put("")
async def contact_edit(
    item: ContactIn, item_id: int = Query(..., alias="id"), user_uuid: str = Depends(require_role("admin"))
):
    """Update contact."""
    db = SessionFactory2()
    try:
        db.execute(
            text(
                "UPDATE ai_contact SET title=:title, content=:content, "
                "sort_order=:sort_order, status=:status, remark=:remark WHERE id=:id"
            ),
            {
                "title": item.title,
                "content": item.content,
                "sort_order": item.sort_order,
                "status": item.status,
                "remark": item.remark,
                "id": item_id,
            },
        )
        db.commit()
        return success(None, "Updated")
    except Exception as e:
        db.rollback()
        logger.error(f"contact edit error: {e}")
        return error(str(e), ErrorCode.INTERNAL_ERROR)
    finally:
        db.close()


@router.delete("/{item_ids}")
async def contact_remove(item_ids: str, user_uuid: str = Depends(require_role("admin"))):
    """Delete contacts by comma-separated IDs.

    Fixed: Use parameterized queries to prevent SQL injection.
    IDs are validated as integers before use.
    """
    db = SessionFactory2()
    try:
        raw_ids = [x.strip() for x in item_ids.split(",") if x.strip()]
        ids = []
        for x in raw_ids:
            try:
                ids.append(int(x))
            except ValueError:
                logger.warning(f"Invalid ID in batch delete: {x}")
                continue

        if not ids:
            return error("No valid IDs", ErrorCode.BAD_REQUEST)

        params = {f"id_{i}": id_val for i, id_val in enumerate(ids)}
        placeholders = ", ".join(f":id_{i}" for i in range(len(ids)))

        db.execute(text(f"DELETE FROM ai_contact WHERE id IN ({placeholders})"), params)
        db.commit()
        return success(None, f"Deleted {len(ids)} items")
    except Exception as e:
        db.rollback()
        logger.error(f"contact delete error: {e}")
        return error(str(e), ErrorCode.INTERNAL_ERROR)
    finally:
        db.close()
