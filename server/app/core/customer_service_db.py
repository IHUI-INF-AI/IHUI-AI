"""
客服与工单 SQLite 持久化,供 run_customer_service 使用.
不依赖 api.* / services.*,可被独立加载.
"""
import json
import logging
import os
import sqlite3

logger = logging.getLogger(__name__)

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "customer_service.db")


def _ensure_dir():
    os.makedirs(DB_DIR, exist_ok=True)


def init_db():
    _ensure_dir()
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                messages TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS ticket_replies (
                id TEXT PRIMARY KEY,
                ticket_id TEXT NOT NULL,
                data TEXT NOT NULL,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id)
            );
        """)
        conn.commit()
    finally:
        conn.close()
    logger.info("SQLite 持久化已初始化: %s", DB_PATH)


def load_conversations() -> dict[str, list[dict]]:
    """返回 conversationId -> [messages]"""
    out = {}
    try:
        conn = sqlite3.connect(DB_PATH)
        try:
            for row in conn.execute("SELECT id, messages FROM conversations"):
                try:
                    out[row[0]] = json.loads(row[1]) if row[1] else []
                except (TypeError, json.JSONDecodeError):
                    out[row[0]] = []
        finally:
            conn.close()
    except Exception as e:
        logger.warning("加载 conversations 失败: %s", e)
    return out


def save_conversations(data: dict[str, list[dict]]):
    try:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute("DELETE FROM conversations")
            for cid, messages in data.items():
                conn.execute(
                    "INSERT INTO conversations (id, messages) VALUES (?, ?)",
                    (cid, json.dumps(messages, ensure_ascii=False)),
                )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.warning("保存 conversations 失败: %s", e)


def load_tickets() -> tuple[dict[str, dict], dict[str, list[dict]]]:
    """返回 (tickets dict, replies dict)"""
    tickets = {}
    replies = {}
    try:
        conn = sqlite3.connect(DB_PATH)
        try:
            for row in conn.execute("SELECT id, data FROM tickets"):
                try:
                    tickets[row[0]] = json.loads(row[1])
                except (TypeError, json.JSONDecodeError):
                    continue
            for row in conn.execute(
                "SELECT id, ticket_id, data FROM ticket_replies ORDER BY ticket_id, id"
            ):
                try:
                    tid, data = row[1], json.loads(row[2])
                    replies.setdefault(tid, []).append(data)
                except (TypeError, json.JSONDecodeError, IndexError):
                    continue
            # 保证 replies 中每条与 tickets 的 id 对应
            for tid in list(replies.keys()):
                if tid not in tickets:
                    del replies[tid]
        finally:
            conn.close()
    except Exception as e:
        logger.warning("加载 tickets 失败: %s", e)
    return tickets, replies


def save_tickets(tickets: dict[str, dict], ticket_replies: dict[str, list[dict]]):
    try:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute("DELETE FROM ticket_replies")
            conn.execute("DELETE FROM tickets")
            for tid, t in tickets.items():
                conn.execute(
                    "INSERT INTO tickets (id, data) VALUES (?, ?)",
                    (tid, json.dumps(t, ensure_ascii=False)),
                )
            for tid, list_replies in ticket_replies.items():
                for i, r in enumerate(list_replies):
                    rid = r.get("id") or f"{tid}_r{i}"
                    conn.execute(
                        "INSERT OR REPLACE INTO ticket_replies (id, ticket_id, data) VALUES (?, ?, ?)",
                        (rid, tid, json.dumps(r, ensure_ascii=False)),
                    )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.warning("保存 tickets 失败: %s", e)
