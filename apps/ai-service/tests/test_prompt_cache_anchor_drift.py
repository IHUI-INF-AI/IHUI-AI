# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""WP-6 提示词缓存断点漂移实测(anthropic_provider P0-①)。

被测假设:
  system 被组装成 block 数组后,cache_control 断点打在**末块**上;若每轮注入的
  动态内容(记忆子图 / 语义检索块)落在这个末块里,断点位置会逐轮漂移,
  Anthropic 前缀缓存第二轮整段 miss。

取证方式(不发外部请求、不碰生产 PG 8810 / Redis 8811):
  走**真实装配代码** —— llm.py 的 system 注入链函数 + AnthropicProvider 的
  payload 组装 —— 只在两个边界打桩:
    ① 数据源:memory_graph 的图库查询(§5 测试隔离铁律禁连生产库);
    ② 传输:BaseProvider._request 的 httpx 出站调用,捕获 body 后返回罐头响应。
  于是被比较的 payload 与真实请求的 payload 同源(同一函数产出)。

连续两轮 = 同一会话的第二次 HTTP 请求(客户端回传完整历史 + 新 user 输入),
与 /llm/complete 每轮重跑注入链的语义一致。
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from app.providers.anthropic_provider import AnthropicProvider
from app.routers.llm import _inject_memory_graph, _inject_workspace_memory, _last_user_text

# 证据落盘目录(§15/§25:项目内、已 gitignore)
EVIDENCE_DIR = Path(__file__).resolve().parents[1] / ".ihui-agent" / "tmp" / "prompt-cache-drift"

BASE_SYSTEM = (
    "你是 IHUI AI Service 的 agent,请协助用户完成任务。\n\n"
    "## 业务代号字典\nD1=数据层 T1=类型安全 SSR=服务端渲染 RAG=检索增强"
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "读取工作区文件内容",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string"}},
                "required": ["path"],
            },
        },
    }
]


# ---------------------------------------------------------------------------
# 桩:数据源(记忆子图按"最后一条 user 查询"命中不同节点)与 HTTP 传输
# ---------------------------------------------------------------------------


def _fake_query_graph_factory() -> Any:
    """按查询词返回不同记忆节点 —— 复刻生产语义(命中集随用户提问变化)。"""

    async def _fake_query_graph(owner_uuid: str, query: str) -> dict[str, Any]:
        del owner_uuid
        if "部署" in query:
            return {"nodes": [{"content": "部署环每 30 分钟跑一次,构建日志用完即删"}], "edges": []}
        return {"nodes": [{"content": "用户偏好紧凑 UI,不要蓝色发光边框"}], "edges": []}

    return _fake_query_graph


class _CapturingResponse:
    status_code = 200
    text = ""

    def json(self) -> dict[str, Any]:
        return {
            "id": "msg_test",
            "model": "claude-sonnet-4-5",
            "content": [{"type": "text", "text": "好的"}],
            "usage": {"input_tokens": 10, "output_tokens": 2},
        }


class _CapturingClient:
    """捕获出站 body 的假 httpx client(绝不发起网络请求)。"""

    def __init__(self) -> None:
        self.bodies: list[dict[str, Any]] = []

    async def request(self, method: str, url: str, **kwargs: Any) -> _CapturingResponse:
        del method, url
        self.bodies.append(dict(kwargs.get("json") or {}))
        return _CapturingResponse()


async def _capture_turn_payloads(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[dict[str, Any], dict[str, Any]]:
    """跑连续两轮,返回两轮"发请求前"的出站 payload。"""
    workspace = tmp_path / "ws"
    workspace.mkdir()
    # 工作区记忆(项目记忆文件)—— 两轮内容完全相同,属稳定段
    (workspace / "AGENTS.md").write_text("# 项目规范\n禁止在端内重新实现共享层功能。\n", encoding="utf-8")

    monkeypatch.setattr(
        "app.services.memory_graph.query_graph", _fake_query_graph_factory(), raising=True
    )

    async def build_messages(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """复刻 /llm/complete 每轮从零重跑的注入链(工作区记忆 → 记忆子图)。"""
        msgs = _inject_workspace_memory(history, str(workspace), None)
        msgs = await _inject_memory_graph(msgs, _last_user_text(msgs), "owner-uuid-1")
        return msgs

    client = _CapturingClient()
    provider = AnthropicProvider(api_key="sk-ant-test")

    turn1_messages = await build_messages(
        [
            {"role": "system", "content": BASE_SYSTEM},
            {"role": "user", "content": "帮我把服务部署到预发环境"},
        ]
    )
    with patch("app.providers.base_provider.get_http_client", return_value=client):
        await provider.complete(turn1_messages, "claude-sonnet-4-5", tools=TOOLS)

    turn2_messages = await build_messages(
        [
            {"role": "system", "content": BASE_SYSTEM},
            {"role": "user", "content": "帮我把服务部署到预发环境"},
            {"role": "assistant", "content": "已确认部署环配置,预发部署完成。"},
            {"role": "user", "content": "那 UI 的按钮样式该怎么调?"},
        ]
    )
    with patch("app.providers.base_provider.get_http_client", return_value=client):
        await provider.complete(turn2_messages, "claude-sonnet-4-5", tools=TOOLS)

    assert len(client.bodies) == 2, f"应捕获两次出站 payload,实际 {len(client.bodies)}"
    return client.bodies[0], client.bodies[1]


# ---------------------------------------------------------------------------
# 断点块指纹工具
# ---------------------------------------------------------------------------


def _anchored_system_blocks(payload: dict[str, Any]) -> list[str]:
    """取出**被打断点**的 system 块内容(带 cache_control 的那些块)。"""
    system = payload.get("system")
    if not isinstance(system, list):
        return []
    return [
        str(block.get("text", ""))
        for block in system
        if isinstance(block, dict) and block.get("cache_control")
    ]


def _all_system_text(payload: dict[str, Any]) -> str:
    system = payload.get("system")
    if isinstance(system, str):
        return system
    if isinstance(system, list):
        return "\n\n".join(str(b.get("text", "")) for b in system if isinstance(b, dict))
    return ""


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _first_diff_offset(a: str, b: str) -> int:
    n = min(len(a), len(b))
    for i in range(n):
        if a[i] != b[i]:
            return i
    return n


# ---------------------------------------------------------------------------
# 实测 1:两轮 payload 落盘 + 差异定位(修复前后都应为真:动态尾段照发)
# ---------------------------------------------------------------------------


async def test_two_turn_payloads_differ_and_are_dumped(tmp_path, monkeypatch) -> None:
    p1, p2 = await _capture_turn_payloads(tmp_path, monkeypatch)
    s1, s2 = _all_system_text(p1), _all_system_text(p2)

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    (EVIDENCE_DIR / "turn1-payload.json").write_text(
        json.dumps(p1, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (EVIDENCE_DIR / "turn2-payload.json").write_text(
        json.dumps(p2, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    diff_at = _first_diff_offset(s1, s2)
    summary = {
        "turn1_system_sha": _sha(s1),
        "turn2_system_sha": _sha(s2),
        "turn1_system_len": len(s1),
        "turn2_system_len": len(s2),
        "first_diff_offset": diff_at,
        "turn1_tail_from_diff": s1[diff_at:],
        "turn2_tail_from_diff": s2[diff_at:],
        "turn1_anchored_block_shas": [_sha(b) for b in _anchored_system_blocks(p1)],
        "turn2_anchored_block_shas": [_sha(b) for b in _anchored_system_blocks(p2)],
    }
    (EVIDENCE_DIR / "fingerprint.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    assert s1 != s2, "两轮 system 全文应有差异(记忆子图按查询命中不同节点),否则取证无效"
    assert diff_at > 0, f"差异应出现在稳定段之后,实际首差偏移 {diff_at}"
    # 稳定前缀(基座提示 + 工作区记忆)逐字不变
    assert s1[:diff_at] == s2[:diff_at]
    assert BASE_SYSTEM in s1 and BASE_SYSTEM in s2


# ---------------------------------------------------------------------------
# 实测 2(回归锁):被打断点的那一块内容必须逐轮恒定
#   —— 修复前必红(断点打在末块 = 含动态尾段的整段 system)
# ---------------------------------------------------------------------------


async def test_anchored_system_block_is_byte_stable_across_turns(
    tmp_path, monkeypatch
) -> None:
    p1, p2 = await _capture_turn_payloads(tmp_path, monkeypatch)
    a1, a2 = _anchored_system_blocks(p1), _anchored_system_blocks(p2)

    assert a1 and a2, "system 必须仍有 ephemeral 断点,否则等于把缓存关了"
    assert _sha("".join(a1)) == _sha("".join(a2)), (
        "连续两轮被打断点的块内容漂移 → 前缀缓存第二轮整段 miss。"
        f"\n  turn1 锚定块指纹={[_sha(b) for b in a1]}"
        f"\n  turn2 锚定块指纹={[_sha(b) for b in a2]}"
        f"\n  turn1 锚定块长度={[len(b) for b in a1]}"
        f"\n  turn2 锚定块长度={[len(b) for b in a2]}"
    )


# ---------------------------------------------------------------------------
# 实测 3(护栏):动态内容必须**仍然**送达模型(只是不进缓存前缀)
# ---------------------------------------------------------------------------


async def test_volatile_tail_still_reaches_the_model(tmp_path, monkeypatch) -> None:
    p1, p2 = await _capture_turn_payloads(tmp_path, monkeypatch)
    for payload, needle in ((p1, "部署环每 30 分钟跑一次"), (p2, "用户偏好紧凑 UI")):
        assert needle in _all_system_text(payload), "动态记忆子图不得被丢掉,只能不进缓存前缀"


# ---------------------------------------------------------------------------
# 实测 4(护栏):完全静态的 system 仍应把断点打在末尾(不因改造掉缓存)
# ---------------------------------------------------------------------------


async def test_static_system_keeps_breakpoint_at_end(
    tmp_path, monkeypatch
) -> None:
    del tmp_path, monkeypatch
    client = _CapturingClient()
    provider = AnthropicProvider(api_key="sk-ant-test")
    messages = [
        {"role": "system", "content": BASE_SYSTEM},
        {"role": "user", "content": "你好"},
    ]
    with patch("app.providers.base_provider.get_http_client", return_value=client):
        await provider.complete(messages, "claude-sonnet-4-5", tools=TOOLS)
    payload = client.bodies[0]
    anchored = _anchored_system_blocks(payload)
    assert anchored, "静态 system 也必须保留缓存断点"
    assert "".join(anchored) == BASE_SYSTEM, "无动态段时断点应覆盖整段 system"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
