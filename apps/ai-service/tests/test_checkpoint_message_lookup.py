# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B2-11 消息定点反查的判据测试(2026-11-27)。

钉住三件事:

  1. 合成 id 可逆且形状判据严格(非法形状一律 `None`,不吞成"最小可用");
  2. 端点存在且**判序**正确:身份/归属在数据之前(先 authorize,后 load_checkpoint);
  3. 越界与跨会话各自走不同出口(404 vs 400),不把两种情况混成一个 500。

不跑 TestClient:本仓的路由测试一律用"纯函数 + 源码锚"两段式,起一整套 app 依赖
会把单测变成集成测试,改一个路由就会连带失败一片无关断言。
"""

from __future__ import annotations

from pathlib import Path

from app.routers.checkpoint_rewind import compose_message_id, split_message_id

REPO_ROOT = Path(__file__).resolve().parents[3]
ROUTER_SRC = REPO_ROOT / "apps" / "ai-service" / "app" / "routers" / "checkpoint_rewind.py"


def test_compose_and_split_roundtrip() -> None:
    for checkpoint_id in ("cp-1", "9f8e7d6c-5b4a-3210-fedc-ba9876543210"):
        for index in (0, 7, 1000):
            message_id = compose_message_id(checkpoint_id, index)
            assert split_message_id(message_id) == (checkpoint_id, index)


def test_split_supports_separator_inside_checkpoint_id() -> None:
    # 按最后一个分隔符切:前段整体当 id,后段必须是十进制下标。
    assert split_message_id("a#b#3") == ("a#b", 3)


def test_split_rejects_malformed_shapes() -> None:
    for bad in ("", "#", "#3", "cp-1#", "cp-1#x", "cp-1#-1", "cp-1#3.0", "cp-1"):
        assert split_message_id(bad) is None, bad


def test_router_exposes_message_lookup_endpoint() -> None:
    text = ROUTER_SRC.read_text(encoding="utf-8")
    assert '@router.get("/messages/{message_id}"' in text


def test_authorization_precedes_data_load() -> None:
    text = ROUTER_SRC.read_text(encoding="utf-8")
    start = text.index('@router.get("/messages/{message_id}"')
    body = text[start:]
    authorize_at = body.index("_authorize_session(request, session_id)")
    load_at = body.index("manager.load_checkpoint(checkpoint_id)")
    # 身份必须先于数据:反过来就是"知道 id 就能跨会话读到别人对话"。
    assert authorize_at < load_at


def test_cross_session_and_out_of_range_use_distinct_exits() -> None:
    text = ROUTER_SRC.read_text(encoding="utf-8")
    start = text.index('@router.get("/messages/{message_id}"')
    body = text[start:]
    mismatch_at = body.index("cp.session_id != session_id")
    range_at = body.index("index >= len(cp.messages)")
    assert mismatch_at < range_at
    mismatch_block = body[mismatch_at:range_at]
    # 跨会话 ⇒ 400(不是 404:404 会让人以为"再猜一次 id 就能读到")。
    assert "status_code=400" in mismatch_block
    range_block = body[range_at : range_at + 400]
    # 越界 ⇒ 404。
    assert "status_code=404" in range_block


def test_lookup_returns_single_message_only() -> None:
    text = ROUTER_SRC.read_text(encoding="utf-8")
    # 响应模型只带单条消息体 + 总数,不得夹带整段 messages。
    model_section = text[text.index("class MessageLookupResponse") :][:400]
    assert "messages:" not in model_section
    assert "total_in_checkpoint: int" in model_section
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
