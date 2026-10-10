# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D158(用户 2026-09-28 批"按预填上"):主对话流审批的第四档「批准并生成放行规则」。

三件事,每件都先红后绿:
1. 回传端点接受正交扩展 `grant_rule={kind:'exec_prefix', tokens:N}`(三档 scope 语义一字不动);
2. 工具循环里,带 grant_rule 的 approve 对 run_command 落一条**前缀**放行规则
   (normalize_exec_key 规范化、approval_persistence.grant 持久层),不是按工具名整放;
3. 命中判定:同一会话里下一次同前缀 run_command **免弹窗**(经持久层匹配,与
   mcp_server._matches_exec_prefix 同一匹配键空间)。
"""

from __future__ import annotations

import asyncio
import importlib

import pytest


@pytest.fixture()
def loop(monkeypatch):
    mod = importlib.import_module("app.routers.llm")
    monkeypatch.setattr(mod, "_tool_approval_grants", {})
    monkeypatch.setattr(mod, "_approval_sessions", {})
    yield mod


async def _submit(loop_mod, session_id: str, approval_id: str, decision: str, scope: str = "once", grant_rule=None):
    body: dict = {"approval_id": approval_id, "decision": decision, "scope": scope}
    if grant_rule:
        body["grant_rule"] = grant_rule
    return await loop_mod.post_tool_approval_response(session_id, body)


async def test_端点接受grant_rule扩展并原样入entry(loop):
    sid, aid = "s-g1", "a-g1"
    loop._approval_sessions[sid] = {aid: {"event": asyncio.Event(), "tool_name": "run_command"}}
    r = await _submit(loop, sid, aid, "approve", "once", {"kind": "exec_prefix", "tokens": 2})
    assert r["ok"] is True
    entry = loop._approval_sessions[sid][aid]
    assert entry["grant_rule"] == {"kind": "exec_prefix", "tokens": 2}
    # 三档 scope 语义不被替换:仍是 once/session/always,非法值照旧收敛 once
    r2 = await _submit(loop, "s-g2", "a-g2", "approve", "bogus")
    assert r2["ok"] is False


async def test_带grant_rule的approve落前缀放行规则_非run_command不落(loop):
    from app.services import approval_persistence as ap

    sid, aid = "s-g3", "a-g3"
    argv = ["git", "push"]
    loop._approval_sessions[sid] = {
        aid: {"event": asyncio.Event(), "tool_name": "run_command", "argv": argv},
    }
    await _submit(loop, sid, aid, "approve", "once", {"kind": "exec_prefix", "tokens": 2})
    # D158 owner-binding(2026-09-29 同步):落规则必须带令牌主体,键 = 主体+归一前缀
    loop._persist_grant_rule(
        loop._approval_sessions[sid][aid], "run_command", sid, "user-g3"
    )
    key = ap.scoped_cache_key("user-g3", ap.normalize_exec_key(argv))
    assert ap.check(key, "exec_prefix"), "approve+grant_rule 应已把主体绑定的前缀规则写进持久层"


async def test_非run_command的grant_rule不落规则(loop):
    from app.services import approval_persistence as ap

    sid, aid = "s-g4", "a-g4"
    loop._approval_sessions[sid] = {aid: {"event": asyncio.Event(), "tool_name": "read_file"}}
    await _submit(loop, sid, aid, "approve", "always", {"kind": "exec_prefix", "tokens": 2})
    keys = ap.list_keys("exec_prefix")
    assert "read_file" not in keys


async def test_同前缀下一次免弹窗_不同前缀仍弹(loop):
    from app.routers import llm as llm_mod
    from app.services import approval_persistence as ap

    sid, aid = "s-g5", "a-g5"
    loop._approval_sessions[sid] = {
        aid: {"event": asyncio.Event(), "tool_name": "run_command", "argv": ["git", "push"]},
    }
    await _submit(loop, sid, aid, "approve", "once", {"kind": "exec_prefix", "tokens": 2})
    loop._persist_grant_rule(
        loop._approval_sessions[sid][aid], "run_command", sid, "user-g5"
    )
    key = ap.scoped_cache_key("user-g5", ap.normalize_exec_key(["git", "push"]))
    assert ap.check(key, "exec_prefix") is not None
    # 命中判定出口(D158 owner-binding 同步):同主体同前缀 ⇒ 免弹窗;
    # 换主体 ⇒ 不放行(旧语义"A 批准 B 免弹"是敞口,已随主体绑定修复作废);
    # 换前缀(不同命令)⇒ 仍需要
    assert llm_mod._exec_prefix_grant_hits(["git", "push", "--force"], "user-g5") is True
    assert llm_mod._exec_prefix_grant_hits(["git", "push", "--force"], "user-other") is False
    assert llm_mod._exec_prefix_grant_hits(["rm", "-rf", "/"], "user-g5") is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
