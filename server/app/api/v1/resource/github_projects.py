"""资源体系 - GitHub 开源项目库 CRUD"""

from fastapi import APIRouter, Query
from loguru import logger

from app.database import get_session
from app.models.resource_ext_models import ResourceGithubProject
from app.schemas.common import error, success

router = APIRouter()


def _proj_to_dict(p: ResourceGithubProject) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "url": p.url,
        "stars": p.stars,
        "category": p.category,
        "description": p.description,
        "language": p.language,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/list", summary="GitHub项目列表")
async def list_github_projects(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    category: str | None = None,
    language: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ResourceGithubProject)
            if keyword:
                q = q.filter(ResourceGithubProject.name.like(f"%{keyword}%"))
            if category:
                q = q.filter(ResourceGithubProject.category == category)
            if language:
                q = q.filter(ResourceGithubProject.language == language)
            total = q.count()
            items = (
                q.order_by(ResourceGithubProject.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success([_proj_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"resource github projects list error: {e}")
            return error(str(e))


@router.get("/{pid}", summary="GitHub项目详情")
async def get_github_project(pid: int):
    with get_session() as db:
        try:
            p = db.query(ResourceGithubProject).filter(ResourceGithubProject.id == pid).first()
            if not p:
                return error("项目不存在", "404")
            return success(_proj_to_dict(p))
        except Exception as e:
            logger.error(f"resource github projects get error: {e}")
            return error(str(e))


@router.post("", summary="创建GitHub项目")
async def create_github_project(
    name: str = Query(..., min_length=1, max_length=200),
    url: str = Query(..., min_length=1, max_length=500),
    stars: int | None = None,
    category: str | None = None,
    description: str | None = None,
    language: str | None = None,
):
    with get_session() as db:
        try:
            p = ResourceGithubProject(
                name=name,
                url=url,
                stars=stars,
                category=category,
                description=description,
                language=language,
            )
            db.add(p)
            db.flush()
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"resource github projects create error: {e}")
            return error(str(e))


@router.put("/{pid}", summary="修改GitHub项目")
async def update_github_project(
    pid: int,
    name: str | None = None,
    url: str | None = None,
    stars: int | None = None,
    category: str | None = None,
    description: str | None = None,
    language: str | None = None,
):
    with get_session() as db:
        try:
            p = db.query(ResourceGithubProject).filter(ResourceGithubProject.id == pid).first()
            if not p:
                return error("项目不存在", "404")
            if name is not None:
                p.name = name
            if url is not None:
                p.url = url
            if stars is not None:
                p.stars = stars
            if category is not None:
                p.category = category
            if description is not None:
                p.description = description
            if language is not None:
                p.language = language
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"resource github projects update error: {e}")
            return error(str(e))


@router.delete("/{pid}", summary="删除GitHub项目")
async def delete_github_project(pid: int):
    with get_session() as db:
        try:
            p = db.query(ResourceGithubProject).filter(ResourceGithubProject.id == pid).first()
            if not p:
                return error("项目不存在", "404")
            db.delete(p)
            return success()
        except Exception as e:
            logger.error(f"resource github projects delete error: {e}")
            return error(str(e))
