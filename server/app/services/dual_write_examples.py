"""双写期方案配置与使用示例.

通过环境变量控制:
- DUAL_WRITE_ENABLED=true/false
- DUAL_WRITE_PRIMARY=H/G  (主盘)
- DUAL_WRITE_READ_FROM=H/G/BOTH  (读盘)
- DUAL_WRITE_RECONCILE=true/false  (是否开启对账)

.env 示例:
    DUAL_WRITE_ENABLED=true
    DUAL_WRITE_PRIMARY=G
    DUAL_WRITE_READ_FROM=G
    DUAL_WRITE_RECONCILE=true
"""
import logging

from app.services.dual_write import (
    DUAL_WRITE_ENABLED,
    DUAL_WRITE_PRIMARY,
    DUAL_WRITE_READ_FROM,
    DUAL_WRITE_RECONCILE,
    SourceDisk,
    dual_read,
    dual_write,
    full_reconcile,
    reconcile_table,
    ReconcileReport,
    DualReadResult,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 业务示例: 会员创建
# ---------------------------------------------------------------------------

def create_member_dual(data: dict) -> dict:
    """双写创建会员 (H 盘 + G 盘).

    注意: 这是示例, 实际业务 service 已存在, 应在 create_edu_member 中
    集成 dual_write 装饰器.
    """
    from app.services.member_service import create_edu_member

    if not DUAL_WRITE_ENABLED:
        return create_edu_member(**data)

    # 简化: 只写 G 盘, H 盘通过 binlog 同步 (实际应调用 H 盘 DAO)
    g_result = create_edu_member(**data)
    # H 盘回写 (异步) - 此处省略实际 H 盘连接
    logger.info(f"[dual] create_member: g_id={g_result.id} h_pending=true")
    return g_result


# ---------------------------------------------------------------------------
# 业务示例: 会员查询 (双读)
# ---------------------------------------------------------------------------

def get_member_dual(member_id: str) -> DualReadResult:
    """双读会员 (H 盘 + G 盘对比)."""
    from app.services.member_service import get_edu_member

    def read_h():
        # 实际应查 H 盘 MySQL
        # return h_member_dao.get_by_id(member_id)
        return None  # 占位

    def read_g():
        return get_edu_member(member_id)

    return dual_read(h_reader=read_h, g_reader=read_g, deep_compare=False)


# ---------------------------------------------------------------------------
# 对账定时任务
# ---------------------------------------------------------------------------

async def run_reconcile_task():
    """定时对账任务 (建议每 6 小时跑一次)."""
    if not DUAL_WRITE_RECONCILE:
        logger.info("[reconcile] DUAL_WRITE_RECONCILE=false, 跳过")
        return

    logger.info("[reconcile] 开始全量对账")
    reports = full_reconcile()

    # 汇总
    total_h = sum(r.h_count for r in reports)
    total_g = sum(r.g_count for r in reports)
    total_inconsistent = sum(r.inconsistent for r in reports)
    balanced = sum(1 for r in reports if r.is_balanced)

    summary = f"[reconcile] 完成: 表数={len(reports)} 平衡={balanced} 不一致={total_inconsistent} H={total_h} G={total_g}"
    logger.info(summary)

    if total_inconsistent > 0:
        logger.warning(f"[reconcile] 存在 {total_inconsistent} 条不一致, 建议人工排查")
        for r in reports:
            if not r.is_balanced:
                logger.warning(
                    f"  {r.table}: H={r.h_count} G={r.g_count} "
                    f"only_h={r.only_in_h} only_g={r.only_in_g} inconsistent={r.inconsistent}"
                )

    return reports


__all__ = [
    "DUAL_WRITE_ENABLED",
    "DUAL_WRITE_PRIMARY",
    "DUAL_WRITE_READ_FROM",
    "DUAL_WRITE_RECONCILE",
    "SourceDisk",
    "dual_write",
    "dual_read",
    "reconcile_table",
    "full_reconcile",
    "ReconcileReport",
    "DualReadResult",
    "create_member_dual",
    "get_member_dual",
    "run_reconcile_task",
]
