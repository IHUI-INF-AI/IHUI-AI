# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""session-import 路由测试(POST /api/session-import/parse)。

parse_conversation_file 由 app.services.importers 提供(可能独立演进),路由对其
做函数内惰性导入;此处用契约同构的假实现替换 sys.modules["app.services.importers"]
(真实包未落盘/已落盘均被临时遮蔽,monkeypatch 结束自动还原),验证路由层的
校验(扩展名/体积)、错误映射(400/413)与响应组装。
"""

import sys
import types
from typing import Any

import pytest

# app 挂载经 conftest 的 `from app.main import app` 导入链生效(client fixture 复用同一实例)

PARSE_URL = "/api/session-import/parse"
# 2026-10-03:wechat 与其余四源同列(此前此处只有 4 个,wechat 走 HTTP 会被本
# fixture 的契约判成非法 source,与真实 SOURCES 不同源,已在 test_wechat_importer
# 钉住 SOURCES 契约;这里同步,免得路由层测试对微信这一路完全失明)。
_VALID_SOURCES = {"claude_code", "codex", "cursor", "aider", "wechat"}


@pytest.fixture
def fake_parse_calls(monkeypatch):
    """注入假 parse_conversation_file(契约同构:非法 source 抛 ValueError)。"""
    calls: list[dict[str, Any]] = []

    def _fake_parse(source: str, filename: str, data: bytes):
        calls.append({"source": source, "filename": filename, "size": len(data)})
        if source not in _VALID_SOURCES:
            raise ValueError(f"不支持的数据源: {source}")
        return (
            {"conversations": [{"id": "conv-1", "source": source, "title": "示例会话"}]},
            ["样本告警"],
            False,
        )

    mod = types.ModuleType("app.services.importers")
    mod.parse_conversation_file = _fake_parse  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "app.services.importers", mod)
    return calls


async def test_parse_ok(client, fake_parse_calls):
    """合法 multipart 请求 → 200 + 统一响应结构。"""
    payload = b'{"type":"session"}\n'
    resp = await client.post(
        PARSE_URL,
        files={"file": ("export.jsonl", payload, "application/octet-stream")},
        data={"source": "claude_code"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["truncated"] is False
    assert body["warnings"] == ["样本告警"]
    assert body["conversations"] == [{"id": "conv-1", "source": "claude_code", "title": "示例会话"}]
    assert fake_parse_calls == [
        {"source": "claude_code", "filename": "export.jsonl", "size": len(payload)}
    ]


async def test_invalid_source_returns_400(client, fake_parse_calls):
    """非法 source(解析器抛 ValueError)→ 400。"""
    resp = await client.post(
        PARSE_URL,
        files={"file": ("export.jsonl", b"data", "application/octet-stream")},
        data={"source": "warp"},
    )
    assert resp.status_code == 400
    assert len(fake_parse_calls) == 1  # 已进到解析层,由 ValueError 映射为 400


async def test_bad_extension_returns_400(client, fake_parse_calls):
    """扩展名不在白名单 → 400,且不进入解析层。

    样本后缀从 .txt 换成 .exe:.txt 于 2026-10-03 入了白名单(微信聊天记录.txt
    直读),继续拿它当反例会只证明「白名单非空」,不再证明「白名单真的在拦」。
    """
    resp = await client.post(
        PARSE_URL,
        files={"file": ("export.exe", b"data", "application/octet-stream")},
        data={"source": "claude_code"},
    )
    assert resp.status_code == 400
    assert fake_parse_calls == []


async def test_wechat_txt_and_zip_pass_extension_gate(client, fake_parse_calls):
    """微信两种载体都必须过白名单闸并进到解析层。

    这是 2026-10-03 补 .txt 的钉子测试:此前 CLI/web/RN 三端都把 .txt 写进
    宣称支持的后缀,而本白名单只有 .zip,用户在 UI 选 .txt 必然吃 400 ——
    前后端口径不一致。两侧同源改齐后,用本测试把该事实钉住,防止再被删回去。
    """
    for filename, source in (("聊天记录.txt", "wechat"), ("合并转发.zip", "wechat")):
        resp = await client.post(
            PARSE_URL,
            files={"file": (filename, b"data", "application/octet-stream")},
            data={"source": source},
        )
        assert resp.status_code == 200, f"{filename} 过了扩展名闸之外还需能进解析层"
    assert [c["filename"] for c in fake_parse_calls] == ["聊天记录.txt", "合并转发.zip"]
    assert all(c["source"] == "wechat" for c in fake_parse_calls)


async def test_oversize_returns_413(client, fake_parse_calls):
    """超过 20MiB → 413,且不进入解析层。"""
    big = b"x" * (20 * 1024 * 1024 + 1)
    resp = await client.post(
        PARSE_URL,
        files={"file": ("export.jsonl", big, "application/octet-stream")},
        data={"source": "claude_code"},
    )
    assert resp.status_code == 413
    assert fake_parse_calls == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
