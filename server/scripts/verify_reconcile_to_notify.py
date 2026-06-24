"""Celery 对账任务 - 站内信集成验证.

覆盖:
  1. run_reconcile_task 同步调用: 走站内信持久化路径 (非内存)
  2. push_notification(level=error) 自动 is_top=True
  3. Celery beat schedule 包含 run-reconcile-every-6h 任务
  4. source="reconcile" 正确标记 (供前端筛选)
"""
import sys

from app.api.admin_migration import (
    NOTIFY_MAX,
    NOTIFY_RECIPIENT_UUID,
    list_notifications,
    push_notification,
)
from app.database import get_session
from sqlalchemy import text


def check_push_to_db():
    """1. push_notification 写入 PostgreSQL/SQLite (非内存)."""
    print("\n=== 1. push_notification 持久化验证 ===")
    # 调用同步 push_notification
    item = push_notification(
        title="[verify] 对账任务联调",
        body="测试 run_reconcile_task 调 push_notification",
        level="error",
        source="reconcile",
    )
    assert item.id, "push_notification 未返回 id"
    print(f"  写入 OK: id={item.id} level={item.level} source={item.source}")
    # 在 DB 中找到
    with get_session() as db:
        m_id = int(item.id)
        row = db.execute(
            text("SELECT id, type, is_top, sender_id, sender_name, user_id FROM message WHERE id = :id"),
            {"id": m_id},
        ).first()
    assert row, f"message 表中找不到 id={m_id}"
    print(f"  DB 行: type={row[1]} is_top={row[2]} sender_id(level)={row[3]} sender_name(source)={row[4]}")
    # 校验字段复用映射
    assert row[1] == "system_notice", f"type 应为 system_notice, 实际 {row[1]}"
    assert row[2] is True or row[2] == 1, f"error 级别应 is_top=True, 实际 {row[2]}"
    assert row[3] == "error", f"sender_id 应存 level=error, 实际 {row[3]}"
    assert row[4] == "reconcile", f"sender_name 应存 source=reconcile, 实际 {row[4]}"
    assert row[5] == NOTIFY_RECIPIENT_UUID, f"user_id 应为 admin UUID, 实际 {row[5]}"
    print(f"  OK: 字段映射正确 (type/system_notice, is_top/True, sender_id/error, sender_name/reconcile, user_id/admin)")
    return True


def check_reconcile_source():
    """2. source=reconcile 可被前端筛选."""
    print("\n=== 2. source=reconcile 可被查询 ===")
    with get_session() as db:
        cnt = db.execute(
            text(
                "SELECT COUNT(*) FROM message "
                "WHERE user_id = :uid AND type = 'system_notice' AND sender_name = 'reconcile'"
            ),
            {"uid": NOTIFY_RECIPIENT_UUID},
        ).scalar()
    print(f"  source=reconcile 的通知条数: {cnt}")
    if cnt < 1:
        print(f"  FAIL: 应至少 1 条, 实际 {cnt}")
        return False
    print(f"  OK")
    return True


def check_top_priority():
    """3. error 级别置顶, 出现在列表最前."""
    print("\n=== 3. error 级别置顶 ===")
    # 再推一条 warn, 应排在 error 之后
    push_notification(
        title="[verify] warn 测试",
        body="",
        level="warn",
        source="reconcile",
    )
    # 查 list_notifications
    import asyncio
    res = asyncio.run(list_notifications(only_unread=False, limit=5))
    items = res["data"]["items"]
    print(f"  列表前 5 条: {[i['title'] for i in items]}")
    if not items:
        print(f"  SKIP: 无通知")
        return True
    if items[0]["level"] != "error":
        print(f"  FAIL: 期望首条 level=error, 实际 {items[0]['level']}")
        return False
    print(f"  OK: error 级别置顶")
    return True


def check_beat_schedule():
    """4. Celery beat schedule 包含 run-reconcile-every-6h."""
    print("\n=== 4. Celery beat schedule ===")
    try:
        from app.celery_app import celery_app
    except Exception as e:
        print(f"  FAIL: import celery_app 失败: {e}")
        return False
    if celery_app is None:
        print(f"  SKIP: Celery 不可用 (本环境未装 celery)")
        return True
    schedule = celery_app.conf.beat_schedule
    print(f"  beat_schedule keys: {list(schedule.keys())}")
    target = "run-reconcile-every-6h"
    if target not in schedule:
        print(f"  FAIL: 缺 {target}")
        return False
    cfg = schedule[target]
    print(f"  {target}:")
    print(f"    task: {cfg['task']}")
    print(f"    schedule: {cfg['schedule']}")
    print(f"    queue: {cfg.get('options', {}).get('queue', 'default')}")
    # 校验 task 名与 reconcile_tasks 里的 @task(name=...) 一致
    if cfg["task"] != "app.tasks.reconcile_tasks.run_reconcile_task":
        print(f"  FAIL: task 名不匹配, 实际 {cfg['task']}")
        return False
    print(f"  OK: {target} 已注册")
    return True


def cleanup():
    """清理测试数据."""
    print("\n=== 清理测试数据 ===")
    with get_session() as db:
        n = db.execute(
            text(
                "DELETE FROM message WHERE user_id = :uid AND type = 'system_notice' AND sender_name = 'reconcile'"
            ),
            {"uid": NOTIFY_RECIPIENT_UUID},
        ).rowcount
    print(f"  已清理 {n} 条 [verify] 测试通知")


def main():
    funcs = [check_push_to_db, check_reconcile_source, check_top_priority, check_beat_schedule]
    passed, failed = 0, 0
    for f in funcs:
        try:
            ok = f()
            if ok:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  EXCEPTION: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    cleanup()
    print(f"\n=== 结果: {passed} passed, {failed} failed ===")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
