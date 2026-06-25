"""实时服务目录 - 服务注册与发现"""

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Boolean, Column, DateTime, Index, Integer, String, Text

from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success
from app.utils.datetime_helper import utcnow


class ServiceNode(TimestampMixin, Base):
    """服务节点"""

    __tablename__ = "service_node"
    __table_args__ = (
        Index("idx_sn_code", "code"),
        Index("idx_sn_status", "status"),
        {"extend_existing": True},
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    code = Column(String(50), nullable=False, comment="服务编码")
    name = Column(String(100), nullable=False, comment="服务名称")
    type = Column(String(20), default="api", comment="api/mcp/agent/tool")
    host = Column(String(200), nullable=True, comment="服务地址")
    port = Column(Integer, default=0, comment="端口")
    path = Column(String(200), default="/", comment="路径")
    version = Column(String(20), default="1.0.0", comment="版本")
    description = Column(Text, nullable=True)
    group = Column(String(50), default="default", comment="分组")
    tags = Column(String(500), nullable=True)
    status = Column(Integer, default=1, comment="0=下线 1=上线 2=维护")
    is_healthy = Column(Boolean, default=True, comment="是否健康")
    health_url = Column(String(500), nullable=True)
    weight = Column(Integer, default=1, comment="权重")
    load_count = Column(BigInteger, default=0, comment="调用次数")
    error_count = Column(BigInteger, default=0, comment="错误次数")
    last_heartbeat = Column(DateTime, nullable=True)
    config = Column(Text, nullable=True, comment="配置JSON")


class ServiceCallLog(TimestampMixin, Base):
    """服务调用日志"""

    __tablename__ = "service_call_log"
    __table_args__ = (
        Index("idx_scl_service", "service_code"),
        Index("idx_scl_time", "created_at"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    service_code = Column(String(50), nullable=False)
    node_id = Column(BigInteger, nullable=True)
    method = Column(String(10), nullable=True)
    path = Column(String(500), nullable=True)
    request = Column(Text, nullable=True)
    response = Column(Text, nullable=True)
    status = Column(Integer, default=1, comment="0=失败 1=成功")
    cost_time = Column(Integer, default=0, comment="耗时(毫秒)")
    error_msg = Column(String(500), nullable=True)
    user_id = Column(String(64), nullable=True)


router = APIRouter()


@router.get("/list", summary="服务列表")
async def service_list(
    group: str | None = None, type: str | None = None, status: int | None = None, keyword: str | None = None
):
    with get_session() as db:
        try:
            q = db.query(ServiceNode)
            if group:
                q = q.filter(ServiceNode.group == group)
            if type:
                q = q.filter(ServiceNode.type == type)
            if status is not None:
                q = q.filter(ServiceNode.status == status)
            if keyword:
                q = q.filter(ServiceNode.name.like(f"%{keyword}%"))
            items = q.order_by(ServiceNode.id.asc()).all()
            return success(
                [
                    {
                        "id": s.id,
                        "code": s.code,
                        "name": s.name,
                        "type": s.type,
                        "host": s.host,
                        "port": s.port,
                        "path": s.path,
                        "version": s.version,
                        "description": s.description,
                        "group": s.group,
                        "tags": s.tags,
                        "status": s.status,
                        "is_healthy": s.is_healthy,
                        "load_count": s.load_count,
                        "error_count": s.error_count,
                        "last_heartbeat": s.last_heartbeat.isoformat() if s.last_heartbeat else None,
                    }
                    for s in items
                ]
            )
        except Exception as e:
            logger.error(f"service list error: {e}")
            return error(str(e))


@router.get("/{sid}", summary="服务详情")
async def get_service(sid: int):
    with get_session() as db:
        try:
            s = db.query(ServiceNode).filter(ServiceNode.id == sid).first()
            if not s:
                return error("服务不存在", "404")
            return success(
                {
                    "id": s.id,
                    "code": s.code,
                    "name": s.name,
                    "type": s.type,
                    "host": s.host,
                    "port": s.port,
                    "path": s.path,
                    "version": s.version,
                    "description": s.description,
                    "group": s.group,
                    "tags": s.tags,
                    "status": s.status,
                    "is_healthy": s.is_healthy,
                    "config": s.config,
                    "weight": s.weight,
                }
            )
        except Exception as e:
            logger.error(f"service get error: {e}")
            return error(str(e))


@router.post("", summary="注册服务")
async def register(
    code: str = Query(...),
    name: str = Query(...),
    type: str = "api",
    host: str | None = None,
    port: int = 0,
    path: str = "/",
    version: str = "1.0.0",
    description: str | None = None,
    group: str = "default",
    tags: str | None = None,
    health_url: str | None = None,
    weight: int = 1,
    config: str | None = None,
):
    with get_session() as db:
        try:
            s = ServiceNode(
                code=code,
                name=name,
                type=type,
                host=host,
                port=port,
                path=path,
                version=version,
                description=description,
                group=group,
                tags=tags,
                status=1,
                is_healthy=True,
                health_url=health_url,
                weight=weight,
                config=config,
                last_heartbeat=utcnow(),
            )
            db.add(s)
            db.flush()
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"service register error: {e}")
            return error(str(e))


@router.put("/{sid}", summary="更新服务")
async def update_service(
    sid: int,
    name: str | None = None,
    host: str | None = None,
    port: int | None = None,
    status: int | None = None,
    weight: int | None = None,
    config: str | None = None,
):
    with get_session() as db:
        try:
            s = db.query(ServiceNode).filter(ServiceNode.id == sid).first()
            if not s:
                return error("服务不存在", "404")
            if name:
                s.name = name
            if host:
                s.host = host
            if port is not None:
                s.port = port
            if status is not None:
                s.status = status
            if weight is not None:
                s.weight = weight
            if config:
                s.config = config
            return success()
        except Exception as e:
            logger.error(f"service update error: {e}")
            return error(str(e))


@router.delete("/{sid}", summary="下线服务")
async def delete_service(sid: int):
    with get_session() as db:
        try:
            s = db.query(ServiceNode).filter(ServiceNode.id == sid).first()
            if not s:
                return error("服务不存在", "404")
            s.status = 0
            return success()
        except Exception as e:
            logger.error(f"service delete error: {e}")
            return error(str(e))


@router.post("/{sid}/heartbeat", summary="心跳上报")
async def heartbeat(sid: int, is_healthy: bool = True, error_msg: str | None = None):
    with get_session() as db:
        try:
            s = db.query(ServiceNode).filter(ServiceNode.id == sid).first()
            if not s:
                return error("服务不存在", "404")
            s.last_heartbeat = utcnow()
            s.is_healthy = is_healthy
            if not is_healthy:
                s.error_count = (s.error_count or 0) + 1
            return success()
        except Exception as e:
            logger.error(f"service heartbeat error: {e}")
            return error(str(e))


@router.get("/log/list", summary="服务调用日志")
async def call_log_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    service_code: str | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ServiceCallLog)
            if service_code:
                q = q.filter(ServiceCallLog.service_code == service_code)
            if status is not None:
                q = q.filter(ServiceCallLog.status == status)
            total = q.count()
            items = q.order_by(ServiceCallLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": l.id,
                        "service_code": l.service_code,
                        "node_id": l.node_id,
                        "method": l.method,
                        "path": l.path,
                        "status": l.status,
                        "cost_time": l.cost_time,
                        "error_msg": l.error_msg,
                        "user_id": l.user_id,
                        "create_time": l.created_at.isoformat() if l.created_at else None,
                    }
                    for l in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"service call log error: {e}")
            return error(str(e))
