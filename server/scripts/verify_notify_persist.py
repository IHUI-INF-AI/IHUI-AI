"""047 站内信持久化 - 集成验证脚本 (用 TestClient 模拟 HTTP).

覆盖:
  1. message 表存在且字段完整
  2. push_notification 写入正常
  3. list_notifications / unread_count / mark_read / mark_all_read 正常
  4. _to_notify_item 字段映射正确
  5. _trim_notify_queue FIFO 淘汰
"""
import asyncio
import sys
from contextlib import suppress

# 强制清理可能存在的旧数据
from app.api.admin_migration import (
    NOTIFY_MAX,
    NOTIFY_RECIPIENT_UUID,
    NotifyItem,
    _to_notify_item,
    _trim_notify_queue,
    push_notification,
)
from app.database import get_session
from fastapi.testclient import TestClient
from sqlalchemy import text

# 必须先 push app
from app.main import app

client = TestClient(app)


def check_table():
    """1. message 表存在 + 字段完整."""
    print("\n=== 1. message 表字段 ===")
    with get_session() as db:
        rows = db.execute(text("PRAGMA table_info(message)")).fetchall()
        cols = {r[1]: r[2] for r in rows}
    needed = ["id", "user_id", "type", "title", "content", "sender_id", "sender_name",
              "is_read", "read_time", "is_top", "created_at"]
    missing = [c for c in needed if c not in cols]
    if missing:
        print(f"  FAIL: 缺字段 {missing}")
        return False
    print(f"  OK: {len(cols)} 个字段齐全")
    return True


def check_push():
    """2. push_notification 写入."""
    print("\n=== 2. push_notification 写入 ===")
    items = []
    for i in range(3):
        item = push_notification(
            title=f"测试通知 {i+1}",
            body=f"body {i+1}",
            level="info" if i % 2 == 0 else "warn",
            source="unit_test",
        )
        items.append(item)
        print(f"  创建 #{i+1}: id={item.id} level={item.level} source={item.source}")
    for it in items:
        assert it.id and it.title and it.body
        assert isinstance(it.id, str), f"id 应为 str, 实际 {type(it.id)}"
    print(f"  OK: 写入 {len(items)} 条 (id 全部为 str)")
    return items


def check_list_api():
    """3. list_notifications 通过 HTTP."""
    print("\n=== 3. list_notifications HTTP ===")
    r = client.get("/api/admin/migration/notify?limit=10")
    assert r.status_code == 200, f"status={r.status_code} body={r.text}"
    body = r.json()
    data = body["data"]
    print(f"  total={data['total']} unread={data['unread_count']}")
    if data["total"] < 3:
        print(f"  FAIL: total 不足 3, 实际 {data['total']}")
        return False
    first = data["items"][0]
    need_keys = {"id", "title", "body", "level", "source", "created_at", "read"}
    if not need_keys.issubset(first.keys()):
        print(f"  FAIL: 缺字段, 现有 {set(first.keys())}")
        return False
    # 校验 id 是 str
    if not isinstance(first["id"], str):
        print(f"  FAIL: id 应为 str, 实际 {type(first['id'])}")
        return False
    print(f"  OK: total={data['total']}, 首条: {first['title']} (level={first['level']})")
    return True


def check_unread_api():
    """4. unread_count API."""
    print("\n=== 4. unread_count HTTP ===")
    r = client.get("/api/admin/migration/notify/unread-count")
    assert r.status_code == 200
    cnt = r.json()["data"]["unread_count"]
    print(f"  unread_count={cnt}")
    if cnt < 3:
        print(f"  FAIL: unread_count 应 >= 3, 实际 {cnt}")
        return False
    print(f"  OK")
    return True


def check_mark_read():
    """5. mark_read / mark_all_read HTTP."""
    print("\n=== 5. mark_read / mark_all_read HTTP ===")
    # 拿一条未读
    r = client.get("/api/admin/migration/notify?only_unread=true&limit=1")
    items = r.json()["data"]["items"]
    if not items:
        print("  SKIP: 无未读")
        return True
    target_id = items[0]["id"]
    r = client.post(f"/api/admin/migration/notify/{target_id}/read")
    assert r.status_code == 200, f"mark_read status={r.status_code} body={r.text}"
    print(f"  mark_read OK: {target_id}")
    # mark_all_read
    r = client.post("/api/admin/migration/notify/read-all")
    assert r.status_code == 200
    marked = r.json()["data"]["marked"]
    print(f"  mark_all_read OK: marked={marked}")
    # 再次查 unread
    r = client.get("/api/admin/migration/notify/unread-count")
    if r.json()["data"]["unread_count"] != 0:
        print(f"  FAIL: mark_all_read 后 unread={r.json()['data']['unread_count']}")
        return False
    print(f"  OK: mark_all_read 后 unread=0")
    return True


def check_to_notify_item():
    """6. _to_notify_item 字段映射."""
    print("\n=== 6. _to_notify_item ===")
    from app.models.message_models import Message
    captured: dict = {}
    with get_session() as db:
        m = (
            db.query(Message)
            .filter(Message.user_id == NOTIFY_RECIPIENT_UUID)
            .first()
        )
        if m is None:
            print("  SKIP: 无消息")
            return True
        # 在 session 内完成转换并捕获字段
        item = _to_notify_item(m)
        captured["item"] = item
        captured["m_id"] = m.id
        captured["m_title"] = m.title
        captured["m_content"] = m.content
    item = captured["item"]
    m_id = captured["m_id"]
    m_title = captured["m_title"]
    m_content = captured["m_content"]
    assert isinstance(item, NotifyItem)
    assert item.id == str(m_id), f"id 不匹配: {item.id} vs str({m_id})"
    assert isinstance(item.id, str)
    assert item.title == (m_title or "")
    assert item.body == (m_content or "")
    print(f"  OK: 转换正常 id={item.id} level={item.level} source={item.source}")
    return True


def check_trim():
    """7. _trim_notify_queue FIFO 淘汰."""
    print("\n=== 7. _trim_notify_queue FIFO 淘汰 ===")
    import os
    save = os.environ.get("NOTIFY_MAX")
    os.environ["NOTIFY_MAX"] = "3"
    import app.api.admin_migration as mod
    mod.NOTIFY_MAX = 3
    for i in range(5):
        push_notification(title=f"trim test {i}", body="b", level="info", source="trim_test")
    _trim_notify_queue()
    with get_session() as db:
        from app.models.message_models import Message
        cnt = (
            db.query(Message)
            .filter(Message.user_id == NOTIFY_RECIPIENT_UUID)
            .filter(Message.type == "system_notice")
            .filter(Message.sender_name == "trim_test")
            .count()
        )
    print(f"  trim_test 源剩余: {cnt}")
    if cnt > 3:
        print(f"  FAIL: 期望 <=3, 实际 {cnt}")
        return False
    if save:
        os.environ["NOTIFY_MAX"] = save
    mod.NOTIFY_MAX = int(save) if save else 1000
    print(f"  OK: FIFO 淘汰生效 (留 {cnt} 条)")
    return True


def check_create_notify_api():
    """8. POST /api/admin/migration/notify (运维手动推送)."""
    print("\n=== 8. POST /notify 手动推送 ===")
    r = client.post(
        "/api/admin/migration/notify",
        json={"title": "运维告警", "body": "测试 body", "level": "error", "source": "ops"},
    )
    assert r.status_code == 200, f"status={r.status_code} body={r.text}"
    body = r.json()
    assert body["code"] == 0
    item = body["data"]
    print(f"  创建: id={item['id']} level={item['level']} is_top(error 应置顶)")
    # error 级别应置顶
    r = client.get("/api/admin/migration/notify?limit=1")
    top = r.json()["data"]["items"][0]
    if top["level"] != "error":
        print(f"  FAIL: error 应置顶, 但首条是 {top['level']}")
        return False
    print(f"  OK: error 级别置顶")
    return True


def main():
    funcs = [
        check_table,
        check_push,
        check_list_api,
        check_unread_api,
        check_mark_read,
        check_to_notify_item,
        check_trim,
        check_create_notify_api,
    ]
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
