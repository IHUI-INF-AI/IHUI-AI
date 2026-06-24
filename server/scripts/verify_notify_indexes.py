"""047 站内信索引补跑验证脚本 (生产 PG 部署后执行).

用法:
    cd g:\IHUI-AI\server
    set ALEMBIC_DATABASE=ai   # 或 center / course
    python -m scripts.verify_notify_indexes

校验:
  1. alembic head == 047_notify_persist
  2. message 表存在 idx_msg_user_unread / idx_msg_user_created / idx_msg_user_type 三个索引
  3. message 表能正常 insert (NotNull 约束没坏)
  4. push_notification 走 DB 路径可用
"""
import sys

from sqlalchemy import text

from app.api.admin_migration import (
    NOTIFY_RECIPIENT_UUID,
    _to_notify_item,
    push_notification,
)
from app.database import engine1, get_session
from app.models.message_models import Message


def _get_engine():
    import os
    choice = os.environ.get("ALEMBIC_DATABASE", "ai").lower()
    from app.database import engine1, engine2, engine3
    return {"ai": engine1, "center": engine2, "course": engine3}.get(choice, engine1)


def check_head():
    """1. alembic head."""
    print("\n=== 1. Alembic Head ===")
    eng = _get_engine()
    with eng.connect() as conn:
        v = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    print(f"  alembic_version = {v}")
    if v != "047_notify_persist":
        print(f"  FAIL: 期望 047_notify_persist, 实际 {v}")
        return False
    print(f"  OK")
    return True


def check_indexes():
    """2. 三个索引存在."""
    print("\n=== 2. message 索引 ===")
    eng = _get_engine()
    with eng.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = 'message'
                ORDER BY indexname
                """
            )
        ).fetchall()
    idx_names = [r[0] for r in rows]
    print(f"  现有索引: {idx_names}")
    needed = ["idx_msg_user_unread", "idx_msg_user_created", "idx_msg_user_type"]
    missing = [n for n in needed if n not in idx_names]
    if missing:
        print(f"  FAIL: 缺索引 {missing}")
        print(f"  解决: cd server && alembic upgrade head")
        return False
    print(f"  OK: 3 个索引齐全")
    # 打印索引定义
    for n, d in rows:
        if n in needed:
            print(f"    {n}: {d[:120]}")
    return True


def check_insert():
    """3. message 表 insert 正常."""
    print("\n=== 3. message 表 insert ===")
    item = push_notification(
        title="[verify] 047 索引验证",
        body="deploy-time check",
        level="info",
        source="verify",
    )
    assert item.id, "push_notification 未返回 id"
    print(f"  插入成功 id={item.id} level={item.level}")
    # 验证能读出
    with get_session() as db:
        nid = int(item.id)
        m = db.query(Message).filter(Message.id == nid).first()
        if not m:
            print(f"  FAIL: 读不出 id={nid}")
            return False
        item2 = _to_notify_item(m)
        assert item2.title == "[verify] 047 索引验证"
    print(f"  OK: 读出并 _to_notify_item 转换正常")
    return True


def check_explain():
    """4. EXPLAIN 看 PG 优化器是否用上 idx_msg_user_unread."""
    print("\n=== 4. EXPLAIN 用上未读索引 ===")
    eng = _get_engine()
    with eng.connect() as conn:
        rows = conn.execute(
            text(
                """
                EXPLAIN
                SELECT count(*) FROM message
                WHERE user_id = :uid AND is_read = false
                """
            ),
            {"uid": NOTIFY_RECIPIENT_UUID},
        ).fetchall()
    plan = "\n".join(r[0] for r in rows)
    print(f"  查询计划:\n    " + plan.replace("\n", "\n    "))
    if "idx_msg_user_unread" in plan:
        print(f"  OK: 用上 idx_msg_user_unread")
        return True
    print(f"  WARN: 未命中 idx_msg_user_unread, 可能因表数据太少")
    return True  # 仅警告, 不算 fail


def main():
    # 校验当前是 PG
    eng = _get_engine()
    if eng.dialect.name != "postgresql":
        print(f"  FAIL: 此脚本仅适用于 PG, 当前是 {eng.dialect.name}")
        print(f"  请在生产 PG 上执行 (或 alembic 配置注入 PG URL 后再跑)")
        return 1

    funcs = [check_head, check_indexes, check_insert, check_explain]
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
    print(f"\n=== 结果: {passed} passed, {failed} failed ===")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
