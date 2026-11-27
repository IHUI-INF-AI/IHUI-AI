# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · 运行账本客户端（P2-04/V2-04 / 01 §7.4）。

写路径只有一条：
    业务代码 → RunLedgerSession.append() → 本地 outbox（JSONL，先落盘）
              → flush() → POST /api/internal/agent-registry/runs/:id/events

这样 API 短暂不可用时不会丢事件；outbox 上限 1000 条，超限先丢低优先级
`step`，保留 `status/error/artifact/steer/checkpoint/approval`。重试 1/2/4/8/16 秒，
第 5 次仍失败把队列文件改名 `.orphan`，控制台能看见“账本缺失”，不假装成功。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC
from pathlib import Path
from typing import Any

import httpx

from ..core.internal_ticket import (
    InternalServiceCredentialError,
    internal_service_headers,
)

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 15.0
_MAX_OUTBOX_EVENTS = 1000
_HIGH_PRIORITY_TYPES = frozenset({"status", "error", "artifact", "steer", "checkpoint", "approval"})
_RETRY_DELAYS = (1.0, 2.0, 4.0, 8.0, 16.0)


def _api_base_url() -> str:
    override = os.environ.get("API_INTERNAL_BASE_URL", "").strip()
    if override:
        return override.rstrip("/")
    from ..core.config import settings

    return str(getattr(settings, "api_service_url", "http://localhost:8802")).rstrip("/")


def _legacy_secret() -> str:
    return (
        os.environ.get("AI_CALLBACK_SECRET", "").strip()
        or os.environ.get("INTERNAL_SERVICE_TOKEN", "").strip()
    )


@dataclass
class OutboxItem:
    run_id: str
    seq: int
    type: str
    payload: dict[str, Any]
    attempt: int = 0
    created_at: str = ""

    def to_json(self) -> str:
        return json.dumps(
            {
                "runId": self.run_id,
                "seq": self.seq,
                "type": self.type,
                "payload": self.payload,
                "attempt": self.attempt,
                "createdAt": self.created_at,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )


class RunOutbox:
    """每个 run 一个 JSONL；先落盘再发，进程重启也能重放。"""

    def __init__(
        self,
        run_id: str,
        *,
        root: str | os.PathLike[str] | None = None,
        max_events: int = _MAX_OUTBOX_EVENTS,
    ) -> None:
        base = Path(root or "data/agent-run-outbox")
        self._path = base / f"{run_id}.jsonl"
        self._orphan_path = base / f"{run_id}.orphan"
        self._run_id = run_id
        self._max_events = max_events

    @property
    def path(self) -> Path:
        return self._path

    def enqueue(self, seq: int, event_type: str, payload: dict[str, Any]) -> bool:
        """返回 False 表示低优先级事件因超限被丢弃。"""
        existing = self._read_items()
        if len(existing) >= self._max_events:
            if event_type not in _HIGH_PRIORITY_TYPES:
                logger.warning(
                    "[run-ledger] outbox 已满(%s)，丢弃低优先级事件 run=%s seq=%s type=%s",
                    self._max_events,
                    self._run_id,
                    seq,
                    event_type,
                )
                return False
            existing = [item for item in existing if item.type in _HIGH_PRIORITY_TYPES]
            if len(existing) >= self._max_events:
                logger.warning(
                    "[run-ledger] outbox 已满且高优先级也满了，仍保留本次高优先级 run=%s seq=%s",
                    self._run_id,
                    seq,
                )
            self.rewrite(existing)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        item = OutboxItem(
            run_id=self._run_id,
            seq=seq,
            type=event_type,
            payload=payload,
            created_at=_now_iso(),
        )
        with self._path.open("a", encoding="utf-8") as handle:
            handle.write(item.to_json() + "\n")
        try:
            os.chmod(self._path, 0o600)
        except OSError:
            pass
        return True

    def pending(self) -> list[OutboxItem]:
        return self._read_items()

    def rewrite(self, items: list[OutboxItem]) -> None:
        if not items:
            self._path.unlink(missing_ok=True)
            return
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp.write_text(
            "\n".join(item.to_json() for item in items) + "\n",
            encoding="utf-8",
        )
        os.replace(tmp, self._path)

    def mark_orphan(self) -> None:
        if not self._path.exists():
            return
        self._orphan_path.parent.mkdir(parents=True, exist_ok=True)
        os.replace(self._path, self._orphan_path)

    def _read_items(self) -> list[OutboxItem]:
        if not self._path.exists():
            return []
        items: list[OutboxItem] = []
        try:
            for line in self._path.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                raw = json.loads(line)
                items.append(
                    OutboxItem(
                        run_id=str(raw.get("runId") or self._run_id),
                        seq=int(raw["seq"]),
                        type=str(raw["type"]),
                        payload=dict(raw.get("payload") or {}),
                        attempt=int(raw.get("attempt") or 0),
                        created_at=str(raw.get("createdAt") or ""),
                    )
                )
        except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
            logger.warning("[run-ledger] outbox 读取失败 %s: %s", self._path, exc)
        return items


class RunLedgerClient:
    """HTTP 客户端；所有请求使用内部票，身份来自 user_id。"""

    def __init__(
        self,
        *,
        user_id: str,
        base_url: str | None = None,
        outbox_root: str | os.PathLike[str] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Callable[[float], Awaitable[None]] | None = None,
    ) -> None:
        self._user_id = user_id
        self._base_url = (base_url or _api_base_url()).rstrip("/")
        self._outbox_root = outbox_root
        self._transport = transport
        self._sleep = sleep or asyncio.sleep

    def session(self, run_id: str, *, start_seq: int = 1) -> RunLedgerSession:
        return RunLedgerSession(self, run_id, start_seq=start_seq)

    async def create_run(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = await self._request("POST", "/api/internal/agent-registry/runs", json=payload)
        return data

    async def update_run(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        data = await self._request(
            "PATCH", f"/api/internal/agent-registry/runs/{run_id}", json=payload
        )
        return data

    async def append_event(
        self,
        run_id: str,
        seq: int,
        event_type: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await self._request(
            "POST",
            f"/api/internal/agent-registry/runs/{run_id}/events",
            json={"seq": seq, "type": event_type, "payload": payload or {}},
        )

    async def audit(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", "/api/internal/agent-registry/audit", json=payload)

    def outbox(self, run_id: str) -> RunOutbox:
        return RunOutbox(run_id, root=self._outbox_root)

    async def flush_outbox(self, run_id: str) -> int:
        """把 outbox 逐条发掉；返回成功发送条数。失败条目留盘，重试后仍失败标 orphan。"""
        outbox = self.outbox(run_id)
        sent = 0
        items = outbox.pending()
        for index, item in enumerate(items):
            delivered = False
            while item.attempt < len(_RETRY_DELAYS):
                try:
                    await self.append_event(item.run_id, item.seq, item.type, item.payload)
                    delivered = True
                    break
                except (httpx.HTTPError, InternalServiceCredentialError, ValueError) as exc:
                    item.attempt += 1
                    if item.attempt >= len(_RETRY_DELAYS):
                        logger.error(
                            "[run-ledger] outbox 事件重试耗尽，标记 orphan run=%s seq=%s type=%s: %s",
                            item.run_id,
                            item.seq,
                            item.type,
                            exc,
                        )
                        break
                    delay = _RETRY_DELAYS[item.attempt - 1]
                    logger.warning(
                        "[run-ledger] 事件发送失败，%.1fs 后重试 run=%s seq=%s attempt=%s: %s",
                        delay,
                        item.run_id,
                        item.seq,
                        item.attempt,
                        exc,
                    )
                    await self._sleep(delay)
            if delivered:
                sent += 1
                continue
            outbox.rewrite(items[index:])
            outbox.mark_orphan()
            return sent
        outbox.rewrite([])
        return sent

    async def _request(self, method: str, path: str, *, json: dict[str, Any]) -> dict[str, Any]:
        headers = internal_service_headers(
            self._user_id,
            "agent-registry",
            legacy_token=_legacy_secret(),
        )
        async with httpx.AsyncClient(
            timeout=_DEFAULT_TIMEOUT,
            transport=self._transport,
        ) as client:
            response = await client.request(
                method,
                f"{self._base_url}{path}",
                headers=headers,
                json=json,
            )
            response.raise_for_status()
            body = response.json()
        if not isinstance(body, dict) or body.get("code") != 0:
            raise ValueError(f"账本响应不是 {{code:0}}: {body!r}")
        data = body.get("data")
        return data if isinstance(data, dict) else {}


class RunLedgerSession:
    """单个 run 的序号分配器；每次 append 先落 outbox 再尝试 flush。"""

    def __init__(self, client: RunLedgerClient, run_id: str, *, start_seq: int = 1) -> None:
        self._client = client
        self.run_id = run_id
        self._next_seq = max(1, int(start_seq))

    @property
    def next_seq(self) -> int:
        return self._next_seq

    async def append(
        self, event_type: str, payload: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        seq = self._next_seq
        self._next_seq += 1
        accepted = self._client.outbox(self.run_id).enqueue(seq, event_type, payload or {})
        if not accepted:
            # 低优先级事件被丢弃时不推进 seq 会重复；仍推进，调用方看到 accepted=False。
            return {"accepted": False, "seq": seq}
        await self._client.flush_outbox(self.run_id)
        return {"accepted": True, "seq": seq}

    async def status(
        self,
        status: str,
        *,
        error_code: str | None = None,
        error_message: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"status": status}
        if error_code:
            payload["errorCode"] = error_code
        if error_message:
            payload["errorMessage"] = error_message
        return await self.append("status", payload)


def _now_iso() -> str:
    from datetime import datetime

    return datetime.now(UTC).isoformat()
