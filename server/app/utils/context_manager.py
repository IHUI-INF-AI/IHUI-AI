"""会话上下文管理器.

迁移自 coze_zhs_py/utils/context_manager.py.
统一管理对话 ID 和对话内容的保存与查询.
"""

import contextlib
import time
import uuid
from datetime import datetime, timedelta
from typing import Any

from loguru import logger
from sqlalchemy import text

from app.database import get_session


class ConversationIdManager:
    """会话 ID 管理器:负责 zhs_chat_detail 表的操作."""

    @staticmethod
    def get_conversation_id(user_id: str, bot_id: str) -> str:
        """根据 user_id 和 bot_id 查询 conversation_id."""
        if not user_id or not bot_id:
            return ""
        with get_session() as db:
            try:
                row = db.execute(
                    text("""
                        SELECT conversation_id
                        FROM zhs_chat_detail
                        WHERE uuid = :user_id AND bot_id = :bot_id
                        ORDER BY Id DESC
                        LIMIT 1
                    """),
                    {"user_id": user_id, "bot_id": bot_id},
                ).fetchone()
                if row and row[0]:
                    return str(row[0])
                return ""
            except Exception as e:
                logger.error(f"查询 conversation_id 失败: {e}")
                return ""

    @staticmethod
    def save_conversation_id(user_id: str, bot_id: str, conversation_id: str) -> bool:
        """保存 conversation_id:存在则更新有效值,否则插入."""
        if not user_id or not bot_id or not conversation_id:
            return False
        with get_session() as db:
            try:
                row = db.execute(
                    text("SELECT Id, conversation_id FROM zhs_chat_detail WHERE uuid = :user_id AND bot_id = :bot_id"),
                    {"user_id": user_id, "bot_id": bot_id},
                ).fetchone()
                if row:
                    existing = row[1]
                    has_valid = existing is not None and str(existing).strip() != "" and str(existing).strip().lower() != "null"
                    if has_valid:
                        return True
                    db.execute(
                        text("UPDATE zhs_chat_detail SET conversation_id = :conversation_id WHERE uuid = :user_id AND bot_id = :bot_id"),
                        {"conversation_id": conversation_id, "user_id": user_id, "bot_id": bot_id},
                    )
                else:
                    db.execute(
                        text("INSERT INTO zhs_chat_detail (uuid, bot_id, conversation_id) VALUES (:user_id, :bot_id, :conversation_id)"),
                        {"user_id": user_id, "bot_id": bot_id, "conversation_id": conversation_id},
                    )
                db.commit()
                return True
            except Exception as e:
                logger.error(f"保存 conversation_id 失败: {e}")
                db.rollback()
                return False

    @staticmethod
    def update_conversation_id(user_id: str, bot_id: str, conversation_id: str) -> bool:
        """强制更新 conversation_id."""
        if not user_id or not bot_id or not conversation_id:
            return False
        with get_session() as db:
            try:
                row = db.execute(
                    text("SELECT Id FROM zhs_chat_detail WHERE uuid = :user_id AND bot_id = :bot_id"),
                    {"user_id": user_id, "bot_id": bot_id},
                ).fetchone()
                if row:
                    db.execute(
                        text("UPDATE zhs_chat_detail SET conversation_id = :conversation_id WHERE uuid = :user_id AND bot_id = :bot_id"),
                        {"conversation_id": conversation_id, "user_id": user_id, "bot_id": bot_id},
                    )
                else:
                    db.execute(
                        text("INSERT INTO zhs_chat_detail (uuid, bot_id, conversation_id) VALUES (:user_id, :bot_id, :conversation_id)"),
                        {"user_id": user_id, "bot_id": bot_id, "conversation_id": conversation_id},
                    )
                db.commit()
                return True
            except Exception as e:
                logger.error(f"更新 conversation_id 失败: {e}")
                db.rollback()
                return False


class ConversationContextManager:
    """对话内容管理器:负责 zhs_user_agent_context 表的操作."""

    @staticmethod
    def save_conversation(
        user_uuid: str,
        model_name: str,
        problem: str,
        answer: str,
        chat_id: str | None = None,
        agent_id: str | None = None,
        agent_url: str | None = None,
        user_url: str | None = None,
        field1: str | None = None,
        video_ratio: str | None = None,
        send_time: int | None = None,
        cost_info: dict | None = None,
        summary: str | None = None,
    ) -> bool:
        """保存对话内容到数据库."""
        try:
            with get_session() as db:
                record_id = str(uuid.uuid4())
                current_time = int(time.time()) if send_time is None else send_time
                db.execute(
                    text("""
                        INSERT INTO zhs_user_agent_context
                        (id, user_uuid, model_name, problem, answer, agent_id, agent_url, user_url, send_time, field1, chat_id, video_ratio, summary)
                        VALUES
                        (:id, :user_uuid, :model_name, :problem, :answer, :agent_id, :agent_url, :user_url, :send_time, :field1, :chat_id, :video_ratio, :summary)
                    """),
                    {
                        "id": record_id,
                        "user_uuid": user_uuid,
                        "model_name": model_name,
                        "problem": problem,
                        "answer": answer,
                        "agent_id": agent_id,
                        "agent_url": agent_url,
                        "user_url": user_url,
                        "send_time": current_time,
                        "field1": field1,
                        "chat_id": chat_id,
                        "video_ratio": video_ratio,
                        "summary": summary,
                    },
                )
                db.commit()
                if cost_info:
                    logger.info(
                        f"计费: 输入={cost_info.get('input_length')} 输出={cost_info.get('output_length')} 费用={cost_info.get('price')}"
                    )
                return True
        except Exception as e:
            logger.error(f"保存对话记录失败: {e}")
            return False

    @staticmethod
    def get_conversation_history(
        user_uuid: str,
        model_name: str,
        chat_id: str | None = None,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """获取用户历史对话记录."""
        try:
            with get_session() as db:
                where = "WHERE user_uuid = :user_uuid AND model_name = :model_name"
                params: dict[str, Any] = {"user_uuid": user_uuid, "model_name": model_name, "limit": limit}
                if chat_id:
                    where += " AND chat_id = :chat_id"
                    params["chat_id"] = chat_id
                rows = db.execute(
                    text(f"""
                        SELECT problem, answer, chat_id, agent_url, field1, video_ratio
                        FROM zhs_user_agent_context
                        {where}
                        ORDER BY send_time DESC
                        LIMIT :limit
                    """),
                    params,
                ).mappings().all()
                messages = []
                for row in rows:
                    if row.get("problem"):
                        messages.append({"role": "user", "content": row["problem"], "chat_id": row.get("chat_id"), "agent_url": row.get("agent_url")})
                    if row.get("answer"):
                        messages.append({
                            "role": "assistant",
                            "content": row["answer"],
                            "chat_id": row.get("chat_id"),
                            "agent_url": row.get("agent_url"),
                            "total_tokens": row.get("field1"),
                            "video_ratio": row.get("video_ratio"),
                        })
                return list(reversed(messages))
        except Exception as e:
            logger.error(f"获取对话历史失败: {e}")
            return []

    @staticmethod
    def get_user_history(
        user_uuid: str,
        time_type: str = "w",
        page: int = 1,
        page_size: int = 10,
    ) -> dict[str, Any]:
        """获取用户使用历史记录."""
        try:
            now = datetime.now()
            start_time = 0
            if time_type == "w":
                start_time = int((now - timedelta(days=7)).timestamp())
            elif time_type == "m":
                start_time = int((now - timedelta(days=30)).timestamp())
            elif time_type == "y":
                start_time = int((now - timedelta(days=365)).timestamp())

            with get_session() as db:
                base_sql = """
                    SELECT a.id, a.agent_id, a.problem, a.answer, a.user_url, a.agent_url,
                           a.send_time as create_at, a.model_name, a.chat_id, a.field1 as token,
                           b.source AS agentName
                    FROM zhs_user_agent_context a
                    LEFT JOIN zhs_ai_model_info b ON a.model_name = b.name
                    WHERE a.user_uuid = :user_uuid
                """
                params: dict[str, Any] = {"user_uuid": user_uuid}
                if time_type != "a":
                    base_sql += " AND a.send_time >= :start_time"
                    params["start_time"] = start_time
                count_sql = "SELECT COUNT(*) FROM zhs_user_agent_context a WHERE a.user_uuid = :user_uuid"
                if time_type != "a":
                    count_sql += " AND a.send_time >= :start_time"
                total = db.execute(text(count_sql), params).scalar_one_or_none() or 0
                base_sql += " ORDER BY a.send_time DESC LIMIT :limit OFFSET :offset"
                params["limit"] = page_size
                params["offset"] = (page - 1) * page_size
                rows = db.execute(text(base_sql), params).mappings().all()
                result_data = []
                for row in rows:
                    d = dict(row)
                    if d.get("create_at"):
                        with contextlib.suppress(ValueError, TypeError):
                            d["create_at"] = datetime.fromtimestamp(int(d["create_at"])).strftime("%Y-%m-%d %H:%M:%S")
                    result_data.append(d)
                return {
                    "code": 0,
                    "message": "ok",
                    "data": result_data,
                    "pagination": {"total": total, "page": page, "page_size": page_size},
                }
        except Exception as e:
            logger.error(f"查询历史记录失败: {e}")
            return {
                "code": 1,
                "message": f"查询错误: {e}",
                "data": [],
                "pagination": {"total": 0, "page": page, "page_size": page_size},
            }


class ContextFormatter:
    """上下文格式化器."""

    @staticmethod
    def format_context_for_model(
        messages: list[dict[str, Any]],
        max_tokens: int | None = None,
        model_name: str | None = None,
    ) -> list[dict[str, Any]]:
        """格式化历史对话为模型可接受的格式."""
        if model_name:
            mn = model_name.lower()
            if "qwen" in mn or "gpt" in mn or "claude" in mn:
                return ContextFormatter._default_format(messages, max_tokens)
        return ContextFormatter._default_format(messages, max_tokens)

    @staticmethod
    def _default_format(messages: list[dict[str, Any]], max_tokens: int | None = None) -> list[dict[str, Any]]:
        formatted = []
        for msg in messages:
            content = msg.get("content", "")
            if not content:
                continue
            formatted.append({"role": msg.get("role", ""), "content": content})
        if max_tokens:
            formatted = ContextFormatter._truncate_by_tokens(formatted, max_tokens)
        return formatted

    @staticmethod
    def _truncate_by_tokens(messages: list[dict[str, Any]], max_tokens: int) -> list[dict[str, Any]]:
        total_chars = 0
        result = []
        for msg in reversed(messages):
            content = msg.get("content", "")
            chars = len(content)
            if total_chars + chars > max_tokens * 2:
                break
            total_chars += chars
            result.insert(0, msg)
        return result
