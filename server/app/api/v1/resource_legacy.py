"""Resource Legacy Routes - 42 个端点 1:1 兼容 Java 历史项目.

完整迁移自 H:\\ihui-ai-edu-resource-service 5 个 Controller:
  - ResourceController (15)
  - ResourceTagController (8)
  - ResourceProductController (8)
  - CategoryController (10)
  - ResourceStatisticsController (1)

URL 路径与 Java 端保持完全一致.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.security import get_current_user_id_flexible, require_login
from app.services import resource_business

router = APIRouter(prefix="", tags=["Resource-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


# ---------------------------------------------------------------------------
# Pydantic Request Models
# ---------------------------------------------------------------------------

class ResourceCreateReq(BaseModel):
    memberId: int | None = None
    title: str | None = None
    resourceName: str | None = None
    resourceType: str | None = None
    url: str | None = None
    resourceUrl: str | None = None
    content: str | None = None
    categoryId: int | None = None
    keyword: str | None = None
    price: float = 0.0
    point: int = 0
    published: bool = False


class ResourceUpdateReq(BaseModel):
    id: int | None = None
    title: str | None = None
    resourceName: str | None = None
    resourceType: str | None = None
    url: str | None = None
    resourceUrl: str | None = None
    content: str | None = None
    categoryId: int | None = None
    keyword: str | None = None
    price: float | None = None
    point: int | None = None
    published: bool | None = None
    isShow: bool | None = None
    status: int | None = None


class ResourceDeleteReq(BaseModel):
    id: int


class ResourceDownloadReq(BaseModel):
    id: int
    host: str | None = None


class ResourcePublishedReq(BaseModel):
    id: int


class ResourceTagCreateReq(BaseModel):
    name: str
    sortOrder: int = 0


class ResourceTagUpdateReq(BaseModel):
    id: int
    name: str | None = None
    sortOrder: int | None = None
    status: bool | None = None


class ResourceTagUpdateStatusReq(BaseModel):
    id: int
    status: bool


class ResourceProductCreateReq(BaseModel):
    name: str
    description: str | None = None
    price: float = 0.0
    sortOrder: int = 0


class ResourceProductUpdateReq(BaseModel):
    id: int
    name: str | None = None
    description: str | None = None
    price: float | None = None
    sortOrder: int | None = None
    status: bool | None = None


class ResourceProductUpdateStatusReq(BaseModel):
    id: int
    status: bool


class CategoryCreateReq(BaseModel):
    name: str
    parentId: int | None = None
    icon: str | None = None
    image: str | None = None
    sortOrder: int = 0
    isShow: bool = True
    isShowIndex: bool = False


class CategoryUpdateReq(BaseModel):
    id: int
    name: str | None = None
    parentId: int | None = None
    icon: str | None = None
    image: str | None = None
    sortOrder: int | None = None
    isShow: bool | None = None
    isShowIndex: bool | None = None
    status: int | None = None


class CategoryUpdateIsShowReq(BaseModel):
    id: int
    isShow: bool


class CategoryUpdateIsShowIndexReq(BaseModel):
    id: int
    isShowIndex: bool


class CategoryImageDeleteReq(BaseModel):
    url: str


# ---------------------------------------------------------------------------
# ResourceController - 15 endpoints
# ---------------------------------------------------------------------------

@router.post("/auth-api/resource", summary="发布资源")
def create_resource(req: ResourceCreateReq, _user: str = Depends(require_login)):
    member_id = req.memberId
    if not member_id:
        member_id = get_current_user_id_flexible()
    try:
        return _ok(resource_business.create_resource(
            member_id=member_id,
            title=req.title,
            resource_name=req.resourceName,
            resource_type=req.resourceType,
            url=req.url,
            resource_url=req.resourceUrl,
            content=req.content,
            category_id=req.categoryId,
            keyword=req.keyword,
            price=req.price,
            point=req.point,
            published=req.published,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/auth-api/resource", summary="修改资源")
def update_resource(req: ResourceUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    fields = {k: v for k, v in req.dict().items() if k != "id" and v is not None}
    try:
        return _ok(resource_business.update_resource(req.id, **fields))
    except ValueError as e:
        raise _err(404, str(e))


@router.delete("/auth-api/resource", summary="删除资源")
def delete_resource(req: ResourceDeleteReq, _user: str = Depends(require_login)):
    return _ok({"deleted": resource_business.delete_resource(req.id)})


@router.get("/resource/list", summary="获取资源列表")
def list_resources(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    name: str | None = None,
    title: str | None = None,
    keyword: str | None = None,
    resourceType: str | None = None,
    categoryId: int | None = None,
    memberId: int | None = None,
    status: int | None = None,
    _user: str = Depends(require_login),
):
    return _ok(resource_business.list_resources(
        page=page, page_size=pageSize, name=name, title=title,
        keyword=keyword, resource_type=resourceType, category_id=categoryId,
        member_id=memberId, status=status,
    ))


@router.get("/public-api/resource/list", summary="获取资源列表 (无权限)")
def public_list_resources(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    name: str | None = None,
    title: str | None = None,
    keyword: str | None = None,
    resourceType: str | None = None,
    categoryId: int | None = None,
    status: int | None = None,
):
    try:
        mid = get_current_user_id_flexible()
    except Exception:
        mid = None
    return _ok(resource_business.list_resources(
        page=page, page_size=pageSize, name=name, title=title,
        keyword=keyword, resource_type=resourceType, category_id=categoryId,
        mid=mid, status=status,
    ))


@router.get("/auth-api/resource/list", summary="获取资源列表 (鉴权)")
def auth_list_resources(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    name: str | None = None,
    title: str | None = None,
    keyword: str | None = None,
    resourceType: str | None = None,
    categoryId: int | None = None,
    status: int | None = None,
    _user: str = Depends(require_login),
):
    try:
        mid = get_current_user_id_flexible()
    except Exception:
        mid = None
    return _ok(resource_business.list_resources(
        page=page, page_size=pageSize, name=name, title=title,
        keyword=keyword, resource_type=resourceType, category_id=categoryId,
        mid=mid, status=status,
    ))


@router.get("/public-api/resource/list/by-ids", summary="按 IDs 获取资源列表")
def public_list_by_ids(ids: str = Query(..., description="逗号分隔的ID列表")):
    id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
    return _ok(resource_business.list_by_ids(id_list))


@router.get("/public-api/resource", summary="获取资源详情")
def get_resource(id: int = Query(...)):
    try:
        member_id = get_current_user_id_flexible()
    except Exception:
        member_id = None
    r = resource_business.get_resource(id)
    if not r:
        raise _err(404, "资源不存在")
    return _ok(r)


@router.post("/auth-api/resource/download", summary="下载资源")
def download_resource(req: ResourceDownloadReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
    except Exception:
        member_id = None
    if not member_id:
        raise _err(401, "未登录")
    rec = resource_business.create_download_record(req.id, member_id)
    return _ok({
        "download_record_id": rec.get("id"),
        "resource_id": req.id,
        "member_id": member_id,
        "download_url": f"/api/v1/auth-api/resource/file/{req.id}",
    })


@router.get("/public-api/resource/type/list", summary="获取资源类型列表")
def get_resource_type_list():
    return _ok(resource_business.get_resource_types())


@router.put("/public-api/resource/published", summary="发布资源")
def published_resource(req: ResourcePublishedReq):
    try:
        return _ok({"published": resource_business.published_resource(req.id)})
    except ValueError as e:
        raise _err(404, str(e))


@router.get("/auth-api/member/resource/list", summary="获取会员发布的资源")
def member_resource_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    memberId: int | None = None,
    keyword: str | None = None,
    _user: str = Depends(require_login),
):
    if not memberId:
        try:
            memberId = get_current_user_id_flexible()
        except Exception:
            memberId = None
    if not memberId:
        raise _err(401, "未登录")
    return _ok(resource_business.list_resources(
        page=page, page_size=pageSize, member_id=memberId, keyword=keyword,
    ))


@router.get("/auth-api/member/download/resource/list", summary="获取会员下载资源记录")
def member_download_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    _user: str = Depends(require_login),
):
    try:
        member_id = get_current_user_id_flexible()
    except Exception:
        member_id = None
    if not member_id:
        raise _err(401, "未登录")
    return _ok(resource_business.get_member_download_list(int(member_id), page=page, page_size=pageSize))


@router.get("/auth-api/member/last-search-record", summary="获取会员最后搜索记录")
def last_search_record(_user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
    except Exception:
        return _ok(None)
    if not member_id:
        return _ok(None)
    return _ok(resource_business.get_last_search_record(int(member_id)))


@router.get("/public-api/resource/recommend-list", summary="推荐资源列表")
def recommend_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    categoryId: int | None = None,
):
    return _ok(resource_business.list_resources(
        page=page, page_size=pageSize, keyword=keyword,
        category_id=categoryId, orders=["create_time desc"],
    ))


# ---------------------------------------------------------------------------
# ResourceTagController - 8 endpoints
# ---------------------------------------------------------------------------

@router.post("/resource/tag", summary="发布标签")
def create_tag(req: ResourceTagCreateReq, _user: str = Depends(require_login)):
    if not req.name:
        raise _err(400, "name为必填项")
    return _ok(resource_business.create_tag(name=req.name, sort_order=req.sortOrder))


@router.put("/resource/tag", summary="修改标签")
def update_tag(req: ResourceTagUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    fields = {k: v for k, v in req.dict().items() if k != "id" and v is not None}
    try:
        return _ok(resource_business.update_tag(req.id, **fields))
    except ValueError as e:
        raise _err(404, str(e))


@router.delete("/resource/tag", summary="删除标签")
def delete_tag(req: ResourceTagUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    return _ok({"deleted": resource_business.delete_tag(req.id)})


@router.get("/resource/tag/page/list", summary="获取标签分页列表")
def tag_page_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    name: str | None = None,
    status: bool | None = None,
    _user: str = Depends(require_login),
):
    result = resource_business.list_tags(
        name=name, status=status, page=page, page_size=pageSize,
    )
    return _ok(result)


@router.get("/resource/tag/list", summary="获取标签列表")
def tag_list(
    name: str | None = None,
    status: bool | None = None,
    _user: str = Depends(require_login),
):
    result = resource_business.list_tags(name=name, status=status)
    return _ok(result)


@router.get("/public-api/resource/tag/list", summary="公开获取标签列表")
def public_tag_list(name: str | None = None):
    result = resource_business.list_tags(name=name, status=True)
    return _ok(result)


@router.get("/public-api/resource/tag", summary="获取标签详情")
def get_tag(id: int = Query(...)):
    t = resource_business.get_tag(id)
    if not t:
        raise _err(404, "标签不存在")
    return _ok(t)


@router.put("/resource/tag/update-status", summary="修改标签状态")
def update_tag_status(req: ResourceTagUpdateStatusReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    try:
        return _ok({"status_updated": resource_business.update_tag_status(req.id, req.status)})
    except ValueError as e:
        raise _err(404, str(e))


# ---------------------------------------------------------------------------
# ResourceProductController - 8 endpoints
# ---------------------------------------------------------------------------

@router.post("/resource/product", summary="发布产品")
def create_product(req: ResourceProductCreateReq, _user: str = Depends(require_login)):
    if not req.name:
        raise _err(400, "name为必填项")
    return _ok(resource_business.create_product(
        name=req.name, description=req.description,
        price=req.price, sort_order=req.sortOrder,
    ))


@router.put("/resource/product", summary="修改产品")
def update_product(req: ResourceProductUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    fields = {k: v for k, v in req.dict().items() if k != "id" and v is not None}
    try:
        return _ok(resource_business.update_product(req.id, **fields))
    except ValueError as e:
        raise _err(404, str(e))


@router.delete("/resource/product", summary="删除产品")
def delete_product(req: ResourceProductUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    return _ok({"deleted": resource_business.delete_product(req.id)})


@router.get("/resource/product/page/list", summary="获取产品分页列表")
def product_page_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    name: str | None = None,
    status: bool | None = None,
    _user: str = Depends(require_login),
):
    result = resource_business.list_products(
        name=name, status=status, page=page, page_size=pageSize,
    )
    return _ok(result)


@router.get("/resource/product/list", summary="获取产品列表")
def product_list(
    name: str | None = None,
    status: bool | None = None,
    _user: str = Depends(require_login),
):
    result = resource_business.list_products(name=name, status=status)
    return _ok(result)


@router.get("/public-api/resource/product/list", summary="公开获取产品列表")
def public_product_list(name: str | None = None):
    result = resource_business.list_products(name=name, status=True)
    return _ok(result)


@router.get("/public-api/resource/product", summary="获取产品详情")
def get_product(id: int = Query(...)):
    p = resource_business.get_product(id)
    if not p:
        raise _err(404, "产品不存在")
    return _ok(p)


@router.put("/resource/product/update-status", summary="修改产品状态")
def update_product_status(req: ResourceProductUpdateStatusReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    try:
        return _ok({"status_updated": resource_business.update_product_status(req.id, req.status)})
    except ValueError as e:
        raise _err(404, str(e))


# ---------------------------------------------------------------------------
# CategoryController - 10 endpoints
# ---------------------------------------------------------------------------

@router.get("/category/admin/list", summary="管理员获取分类列表")
def category_admin_list(
    name: str | None = None,
    status: int | None = None,
    parentId: int | None = None,
    _user: str = Depends(require_login),
):
    return _ok(resource_business.list_categories(
        name=name, status=status, parent_id=parentId, for_admin=True,
    ))


@router.get("/category/{category_id}", summary="获取分类详情")
def get_category(category_id: int):
    c = resource_business.get_category(category_id)
    if not c:
        raise _err(404, "分类不存在")
    return _ok(c)


@router.post("/category", summary="添加分类")
def create_category(req: CategoryCreateReq, _user: str = Depends(require_login)):
    if not req.name:
        raise _err(400, "name为必填项")
    return _ok(resource_business.create_category(
        name=req.name, parent_id=req.parentId, icon=req.icon,
        image=req.image, sort_order=req.sortOrder,
        is_show=req.isShow, is_show_index=req.isShowIndex,
    ))


@router.put("/category", summary="修改分类")
def update_category(req: CategoryUpdateReq, _user: str = Depends(require_login)):
    if not req.id or req.id <= 0:
        raise _err(400, "分类id需大于0")
    fields = {k: v for k, v in req.dict().items() if k != "id" and v is not None}
    try:
        return _ok(resource_business.update_category(req.id, **fields))
    except ValueError as e:
        raise _err(404, str(e))


@router.delete("/category/{category_id}", summary="删除分类")
def delete_category(category_id: int, _user: str = Depends(require_login)):
    return _ok({"deleted": resource_business.delete_category(category_id)})


@router.post("/category/image", summary="上传分类图片")
def category_image_upload(_user: str = Depends(require_login)):
    """占位实现 - 实际应使用 UploadFile."""
    return _ok({
        "url": "/uploads/category/uploaded.png",
        "name": "uploaded.png",
    })


@router.delete("/category/image", summary="删除分类图片")
def category_image_delete(req: CategoryImageDeleteReq, _user: str = Depends(require_login)):
    if not req.url:
        raise _err(400, "文件路径不能为空")
    return _ok(resource_business.category_image_delete(req.url))


@router.put("/category/is-show", summary="修改分类显示状态")
def category_is_show(req: CategoryUpdateIsShowReq, _user: str = Depends(require_login)):
    try:
        return _ok({"updated": resource_business.update_category_is_show(req.id, req.isShow)})
    except ValueError as e:
        raise _err(400, str(e))


@router.put("/category/is-show-index", summary="修改分类首页显示状态")
def category_is_show_index(req: CategoryUpdateIsShowIndexReq, _user: str = Depends(require_login)):
    try:
        return _ok({"updated": resource_business.update_category_is_show_index(req.id, req.isShowIndex)})
    except ValueError as e:
        raise _err(400, str(e))


@router.get("/public-api/category/list", summary="公开获取分类列表")
def public_category_list(
    name: str | None = None,
    parentId: int | None = None,
    isShowIndex: bool | None = None,
):
    return _ok(resource_business.list_categories(
        name=name, parent_id=parentId, is_show_index=isShowIndex,
    ))


# ---------------------------------------------------------------------------
# ResourceStatisticsController - 1 endpoint
# ---------------------------------------------------------------------------

@router.get("/statistics", summary="获取资源统计数据", operation_id="resource_legacy_get_statistics")
def get_statistics():
    return _ok(resource_business.get_resource_statistics())
