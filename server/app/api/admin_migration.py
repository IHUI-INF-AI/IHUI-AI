"""Admin 迁移管理 API.

提供 ETL 脚本的 Web 化触发:
- 列出所有批次
- 启动/恢复批次
- 校验批次
- 回滚批次
- 实时进度
- id_mapping 查询/注册 (接入 id_mapping_service)
"""
from __future__ import annotations

import logging
import os
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from scripts.etl.checkpoint import MigrationCheckpoint
from scripts.etl.config import BATCHES
from app.config import settings
from app.database import get_session
from app.models.message_models import Message
from app.security import require_login, require_role
from app.services import id_mapping_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/migration", tags=["Admin Migration"])

SERVER_DIR = Path(__file__).resolve().parents[3]  # server/

# 站内信接收方 (admin) UUID, 多副本必须一致.
# 优先级: 环境变量 (运维显式覆盖) > settings.NOTIFY_RECIPIENT_UUID (Pydantic .env) > 默认固定 UUID
NOTIFY_RECIPIENT_UUID = (
    os.getenv("NOTIFY_RECIPIENT_UUID")
    or settings.NOTIFY_RECIPIENT_UUID
    or "00000000-0000-0000-0000-000000000001"
)

# 站内信最大保留数 (FIFO 淘汰).
# 优先级: 环境变量 > settings.NOTIFY_MAX > 默认 1000
NOTIFY_MAX = int(
    os.getenv("NOTIFY_MAX")
    or str(settings.NOTIFY_MAX)
    or "1000"
)


# ---------------------------------------------------------------------------
# Pydantic 模型
# ---------------------------------------------------------------------------

class BatchInfo(BaseModel):
    batch_id: str
    description: str
    depends_on: list[str] = Field(default_factory=list)
    task_count: int
    done_count: int = 0
    running_count: int = 0
    failed_count: int = 0
    total_rows: int = 0
    migrated_rows: int = 0


class MigrateRequest(BaseModel):
    batch_id: str
    task_source_table: str | None = None
    restart: bool = False
    dry_run: bool = False


class VerifyResponse(BaseModel):
    batch_id: str
    tables: list[dict]


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

@router.get("/batches", summary="列出所有迁移批次")
async def list_batches(_: str = Depends(require_role("admin"))) -> list[BatchInfo]:
    out: list[BatchInfo] = []
    for b in BATCHES:
        with get_session() as db:
            ck_rows = (
                db.query(MigrationCheckpoint)
                .filter(MigrationCheckpoint.batch_id.like(f"{b.batch_id}%"))
                .all()
            )
        done = sum(1 for ck in ck_rows if ck.status == "done")
        running = sum(1 for ck in ck_rows if ck.status == "running")
        failed = sum(1 for ck in ck_rows if ck.status == "failed")
        total = sum(ck.total_rows or 0 for ck in ck_rows)
        migrated = sum(ck.migrated_rows or 0 for ck in ck_rows)
        out.append(BatchInfo(
            batch_id=b.batch_id,
            description=b.description,
            depends_on=b.depends_on,
            task_count=len(b.tasks),
            done_count=done,
            running_count=running,
            failed_count=failed,
            total_rows=total,
            migrated_rows=migrated,
        ))
    return out


@router.post("/run", summary="启动迁移批次 (异步)")
async def run_migration(req: MigrateRequest) -> dict:
    """触发 ETL migrate.py 执行 (后台子进程)."""
    cmd = [
        sys.executable, "-m", "scripts.migrate",
        "--batch", req.batch_id,
    ]
    if req.task_source_table:
        cmd += ["--task", req.task_source_table]
    if req.restart:
        cmd += ["--restart"]
    if req.dry_run:
        cmd += ["--dry-run"]

    log_path = SERVER_DIR / "logs" / f"migrate_trigger_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(log_path, "w", encoding="utf-8") as logf:
            process = subprocess.Popen(
                cmd,
                cwd=str(SERVER_DIR),
                stdout=logf,
                stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
    except Exception as e:
        logger.exception("启动迁移失败")
        raise HTTPException(status_code=500, detail=f"启动失败: {e}")

    return {
        "code": 0,
        "msg": "已启动",
        "data": {
            "pid": process.pid,
            "batch_id": req.batch_id,
            "log_file": str(log_path),
            "started_at": datetime.utcnow().isoformat(),
        },
    }


@router.get("/verify/{batch_id}", summary="校验批次行数")
async def verify_batch(batch_id: str) -> VerifyResponse:
    """对比 H 盘 vs G 盘行数 + 抽样校验."""
    from scripts.etl.config import get_batch
    from scripts.etl.extractor import extract_count
    from sqlalchemy import text

    batch = next((b for b in BATCHES if b.batch_id == batch_id), None)
    if not batch:
        raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")

    tables = []
    for task in batch.tasks:
        # H 盘
        try:
            h_count = extract_count(task)
        except Exception as e:
            h_count = -1
            logger.warning(f"extract_count failed for {task.source_table}: {e}")

        # G 盘
        try:
            with get_session() as db:
                g_count = db.execute(text(f"SELECT COUNT(*) FROM {task.target_table}")).scalar()
        except Exception:
            g_count = 0

        ratio = (g_count / h_count * 100) if h_count and h_count > 0 else 0
        tables.append({
            "source_table": task.source_table,
            "target_table": task.target_table,
            "h_count": h_count,
            "g_count": g_count,
            "ratio": round(ratio, 2),
            "ok": ratio >= 99.0,
        })

    return VerifyResponse(batch_id=batch_id, tables=tables)


@router.post("/rollback/{batch_id}", summary="回滚批次 (需 --confirm)")
async def rollback_batch(batch_id: str, confirm: bool = False) -> dict:
    """通过 ETL rollback.py 回滚 (子进程, 不会阻塞 API)."""
    if not confirm:
        raise HTTPException(status_code=400, detail="必须显式 confirm=true 才执行回滚")

    cmd = [sys.executable, "-m", "scripts.rollback", "--batch", batch_id, "--confirm"]
    log_path = SERVER_DIR / "logs" / f"rollback_trigger_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(log_path, "w", encoding="utf-8") as logf:
            process = subprocess.Popen(
                cmd,
                cwd=str(SERVER_DIR),
                stdout=logf,
                stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"回滚失败: {e}")

    return {
        "code": 0,
        "msg": "回滚已启动",
        "data": {
            "pid": process.pid,
            "batch_id": batch_id,
            "log_file": str(log_path),
        },
    }


@router.get("/checkpoints/{batch_id}", summary="查询批次内所有 checkpoint")
async def list_checkpoints(batch_id: str, _: str = Depends(require_role("admin"))) -> list[dict]:
    with get_session() as db:
        rows = (
            db.query(MigrationCheckpoint)
            .filter(MigrationCheckpoint.batch_id == batch_id)
            .order_by(MigrationCheckpoint.source_table)
            .all()
        )
        return [
            {
                "source_table": r.source_table,
                "target_table": r.target_table,
                "status": r.status,
                "last_pk": r.last_pk,
                "total_rows": r.total_rows,
                "migrated_rows": r.migrated_rows,
                "error_msg": r.error_msg,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]


@router.get("/health", summary="迁移系统健康检查")
async def health() -> dict:
    """检查 H 盘 MySQL / G 盘 PG / id_mapping 状态."""
    from sqlalchemy import text
    from scripts.etl.extractor import H_SOURCES

    g_health = {"ok": True, "engines": {}}
    for name, eng in [("ai", None), ("center", None), ("course", None)]:
        try:
            with get_session() as db:
                db.execute(text("SELECT 1"))
            g_health["engines"][name] = "ok"
        except Exception as e:
            g_health["ok"] = False
            g_health["engines"][name] = f"error: {e}"

    h_health = {}
    for db_key in ["ihui-ai-edu-member-service", "ihui-ai-edu-learn-service"]:
        try:
            from scripts.etl.extractor import get_h_engine
            eng = get_h_engine(db_key)
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            h_health[db_key] = "ok"
        except Exception as e:
            h_health[db_key] = f"error: {e}"

    with get_session() as db:
        mapping_count = db.execute(text("SELECT COUNT(*) FROM id_mapping")).scalar()
        checkpoint_count = db.execute(text("SELECT COUNT(*) FROM migration_checkpoint")).scalar()

    return {
        "g_disk": g_health,
        "h_disk": h_health,
        "id_mapping_count": mapping_count,
        "checkpoint_count": checkpoint_count,
    }


# ---------------------------------------------------------------------------
# id_mapping 端点 (接入 id_mapping_service)
# ---------------------------------------------------------------------------

class RegisterMappingReq(BaseModel):
    source_table: str
    old_id: int
    migration_batch: str
    new_uuid: str | None = None
    remark: str | None = None


class BatchResolveReq(BaseModel):
    source_table: str
    old_ids: list[int]
    migration_batch: str


@router.get("/id-mapping/lookup", summary="按 H 盘老主键查 G 盘 UUID")
async def lookup_id_mapping(
    source_table: str = Query(..., description="H 盘表名, 如 t_member"),
    old_id: int = Query(..., description="H 盘 Long 主键"),
    _: str = Depends(require_role("admin")),
):
    new_uuid = id_mapping_service.get_new_id(source_table, old_id)
    if not new_uuid:
        raise HTTPException(status_code=404, detail=f"{source_table}:{old_id} 无映射")
    return {"code": 0, "data": {"source_table": source_table, "old_id": str(old_id), "new_uuid": new_uuid}, "msg": "ok"}


@router.get("/id-mapping/reverse", summary="按 G 盘 UUID 反查 H 盘老主键")
async def reverse_id_mapping(
    source_table: str = Query(..., description="H 盘表名"),
    new_uuid: str = Query(..., description="G 盘 String(64) UUID"),
):
    old_id = id_mapping_service.get_old_id(source_table, new_uuid)
    if old_id is None:
        raise HTTPException(status_code=404, detail=f"{source_table} 找不到 {new_uuid}")
    return {"code": 0, "data": {"source_table": source_table, "new_uuid": new_uuid, "old_id": old_id}, "msg": "ok"}


@router.post("/id-mapping/register", summary="注册一条主键映射 (重复则返回已有)")
async def register_id_mapping(req: RegisterMappingReq):
    new_uuid = id_mapping_service.batch_register(
        source_table=req.source_table,
        old_id=req.old_id,
        migration_batch=req.migration_batch,
        new_uuid=req.new_uuid,
        remark=req.remark,
    )
    return {"code": 0, "data": {"new_uuid": new_uuid}, "msg": "ok"}


@router.post("/id-mapping/batch-resolve", summary="批量查询/生成映射")
async def batch_resolve_id_mapping(req: BatchResolveReq):
    result = id_mapping_service.batch_resolve(
        source_table=req.source_table,
        old_ids=req.old_ids,
        migration_batch=req.migration_batch,
    )
    # 把 int 键转 str (JSON 不允许 int 键)
    return {
        "code": 0,
        "data": {"mapping": {str(k): v for k, v in result.items()}},
        "msg": "ok",
    }


@router.get("/id-mapping/stats", summary="按批次汇总映射统计")
async def get_migration_stats(_: str = Depends(require_role("admin"))) -> list[dict[str, Any]]:
    return id_mapping_service.get_migration_stats()


# ---------------------------------------------------------------------------
# 站内信: 对账 / 迁移告警 (P1.6 + 047 持久化)
# ---------------------------------------------------------------------------
# 047 迁移后改为 DB 持久化 (复用 message 表, user_id 指向 admin 接收方 UUID).
# 重启 / 多 worker / 多 pod 全共享, 解决之前 deque 内存方案的数据丢失问题.
#
# 容量控制: 1000 条 (FIFO 淘汰), 用 SQL 删除最旧的多余记录.
# 接收方: NOTIFY_RECIPIENT_UUID (环境变量可覆盖, 默认固定 admin UUID).


@dataclass
class NotifyItem:
    """站内信数据传输对象 (与 Message 表一一对应, 序列化用)."""
    id: str = ""  # Message.id 是 BigInteger, 序列化为 str 避免前端 JS 大数溢出
    title: str = ""
    body: str = ""
    level: Literal["info", "warn", "error"] = "info"
    source: str = "migration"  # migration / reconcile / dual_write
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    read: bool = False
    read_time: str | None = None


def _to_notify_item(m: Message) -> NotifyItem:
    """Message ORM → NotifyItem 转换. content 即 body, sender_name 存 source."""
    return NotifyItem(
        id=str(m.id) if m.id is not None else "",
        title=m.title or "",
        body=m.content or "",
        level=(m.sender_id or "info") if m.sender_id in ("info", "warn", "error") else "info",
        source=m.sender_name or "migration",
        created_at=(m.created_at or datetime.utcnow()).isoformat()
        if isinstance(m.created_at, datetime) else str(m.created_at),
        read=bool(m.is_read),
        read_time=m.read_time.isoformat() if m.read_time else None,
    )


def _trim_notify_queue() -> None:
    """站内信总数超 NOTIFY_MAX 时, 删最旧的非置顶条目 (FIFO 淘汰)."""
    with get_session() as db:
        # 统计当前条数 (只算站内信, type=system_notice)
        total = (
            db.query(Message)
            .filter(Message.user_id == NOTIFY_RECIPIENT_UUID)
            .filter(Message.type == "system_notice")
            .count()
        )
        if total <= NOTIFY_MAX:
            return
        # 取超出部分最旧的 id, 删除 (非置顶优先)
        overflow = total - NOTIFY_MAX
        oldest = (
            db.query(Message)
            .filter(Message.user_id == NOTIFY_RECIPIENT_UUID)
            .filter(Message.type == "system_notice")
            .filter(Message.is_top.is_(False))
            .order_by(Message.created_at.asc())
            .limit(overflow)
            .all()
        )
        for m in oldest:
            db.delete(m)


def push_notification(
    title: str,
    body: str,
    level: Literal["info", "warn", "error"] = "info",
    source: str = "migration",
) -> NotifyItem:
    """写入一条告警到 message 表 (供后端内部调用, 如 run_reconcile_task).

    容量超限自动 FIFO 淘汰, 保证表不会无限增长.
    """
    with get_session() as db:
        m = Message(
            user_id=NOTIFY_RECIPIENT_UUID,
            type="system_notice",
            title=title,
            content=body,
            sender_id=level,  # 复用 sender_id 存 level (info/warn/error)
            sender_name=source,  # 复用 sender_name 存 source (migration/reconcile/...)
            is_read=False,
            is_top=(level == "error"),  # error 级别置顶
        )
        db.add(m)
        db.flush()
        item = _to_notify_item(m)
    # 容量控制: 提交后单独 session 删 (避免 session 内删除的并发问题)
    try:
        _trim_notify_queue()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"push_notification: FIFO 淘汰失败: {e}")
    return item


class PushNotifyReq(BaseModel):
    title: str
    body: str
    level: Literal["info", "warn", "error"] = "info"
    source: str = "migration"


@router.get("/notify", summary="查询站内信列表 (新→旧)")
async def list_notifications(
    only_unread: bool = Query(False, description="只返回未读"),
    limit: int = Query(50, ge=1, le=200),
    _: str = Depends(require_login),
) -> dict[str, Any]:
    with get_session() as db:
        q = (
            db.query(Message)
            .filter(Message.user_id == NOTIFY_RECIPIENT_UUID)
            .filter(Message.type == "system_notice")
        )
        if only_unread:
            q = q.filter(Message.is_read.is_(False))
        # 置顶优先, 然后时间倒序
        q = q.order_by(Message.is_top.desc(), Message.created_at.desc())
        msgs = q.limit(limit).all()
        items = [_to_notify_item(m) for m in msgs]
        # 未读总数
        unread = (
            db.query(Message)
            .filter(Message.user_id == NOTIFY_RECIPIENT_UUID)
            .filter(Message.type == "system_notice")
            .filter(Message.is_read.is_(False))
            .count()
        )
    return {
        "code": 0,
        "data": {
            "items": [asdict(n) for n in items],
            "total": len(items),
            "unread_count": unread,
        },
        "msg": "ok",
    }


@router.get("/notify/unread-count", summary="未读条数 (供菜单红点)")
async def unread_count(_: str = Depends(require_login)) -> dict[str, Any]:
    with get_session() as db:
        unread = (
            db.query(Message)
            .filter(Message.user_id == NOTIFY_RECIPIENT_UUID)
            .filter(Message.type == "system_notice")
            .filter(Message.is_read.is_(False))
            .count()
        )
    return {"code": 0, "data": {"unread_count": unread}, "msg": "ok"}


@router.post("/notify/{notify_id}/read", summary="标记单条已读")
async def mark_read(notify_id: str, _: str = Depends(require_login)) -> dict[str, Any]:
    """notify_id 是 Message.id (BigInteger) 的 str 表示."""
    try:
        nid = int(notify_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"notify_id 格式错误: {notify_id}")
    with get_session() as db:
        m = (
            db.query(Message)
            .filter(Message.id == nid)
            .filter(Message.user_id == NOTIFY_RECIPIENT_UUID)
            .filter(Message.type == "system_notice")
            .first()
        )
        if m is None:
            raise HTTPException(status_code=404, detail="通知不存在")
        if not m.is_read:
            m.is_read = True
            m.read_time = datetime.utcnow()
    return {"code": 0, "msg": "ok"}


@router.post("/notify/read-all", summary="全部标记已读")
async def mark_all_read(_: str = Depends(require_login)) -> dict[str, Any]:
    with get_session() as db:
        # 一次 UPDATE 批量标记, 比逐条 SET 性能好
        from sqlalchemy import update  # 局部 import 避免污染顶部

        result = (
            db.execute(
                update(Message)
                .where(Message.user_id == NOTIFY_RECIPIENT_UUID)
                .where(Message.type == "system_notice")
                .where(Message.is_read.is_(False))
                .values(is_read=True, read_time=datetime.utcnow())
            )
        )
        marked = result.rowcount or 0
    return {"code": 0, "data": {"marked": marked}, "msg": "ok"}


@router.post("/notify", summary="手动创建一条告警 (供运维 / 任务回调使用)")
async def create_notification(req: PushNotifyReq, _: str = Depends(require_role("admin"))) -> dict[str, Any]:
    item = push_notification(req.title, req.body, req.level, req.source)
    return {"code": 0, "data": asdict(item), "msg": "ok"}
