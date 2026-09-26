# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #47 第三格:工具名别名归一的**单一真相源**回归测试。

背景(实测,2026-09-26 之前):`_TOOL_ALIASES` 曾有两份独立定义 ——
`app/routers/llm.py`(26 条,A 内核 tool loop 消费)与
`app/services/mcp_server.py`(仅 2 条,`_normalize_tool_name` / `call_tool` 消费),
公共 2 条取值相同纯属巧合。同一个模型写的别名在一个入口被归一、在另一个入口
报「未知工具」,且没有任何东西校验第二份。本票把 26 条表搬进 mcp_server.py 作
唯一定义,llm.py 改为 import;守门 check-tool-registry-integrity.mjs 的 J11
对账「全 app 包内模块级定义恰好 1 处」。

本文件钉住四条(与门同判据,但跑在**真实数据**上):
1. 只有一份:``llm._TOOL_ALIASES is mcp_server._TOOL_ALIASES``(同一对象引用,
   ``==`` 会放过多出的第二份内容相同的抄表,``is`` 不会);
2. 值域闭合:每个 value ∈ ``mcp_server._TOOL_HANDLERS``;
3. 键不遮蔽真工具名;键/值都不是 ``_DELEGATE_ONLY_TOOLS`` 成员(门的 J3/J4 同判据);
4. 行为面:``call_tool`` 对旧 2 条表覆盖不到的别名(如 ``grep`` → ``file_search``)
   现在能解析到注册 handler;对**未知且非别名**的名字仍报带 suggestions 的
   「未知工具」—— 归一不得扩成静默改道。

测试隔离(§5 铁律):handler 一律 monkeypatch 打桩,call_tool 尾部会尝试的
media_tasks 持久化也被打桩 —— 全程不触真实 shell / 磁盘 / 网络 / 数据库。
"""

from __future__ import annotations

import inspect

from app.routers import llm as llm_router
from app.services import mcp_server as mcp_mod


class TestSingleSource:
    """「只有一份」的机器判据:同一对象引用,且 llm.py 源码面不再出现定义。"""

    def test_llm_and_mcp_share_the_same_object(self) -> None:
        assert llm_router._TOOL_ALIASES is mcp_mod._TOOL_ALIASES

    def test_llm_source_has_no_module_level_alias_literal(self) -> None:
        src = inspect.getsource(llm_router)
        defining = [
            line for line in src.splitlines() if line.startswith("_TOOL_ALIASES") and "=" in line
        ]
        assert not defining, f"llm.py 仍有模块级别名表定义:{defining}"


class TestValueDomain:
    """门的 J2/J3/J4 同判据,跑在真实表与真实注册表上。"""

    def test_every_alias_target_is_registered(self) -> None:
        aliases = mcp_mod._TOOL_ALIASES
        assert len(aliases) >= 26, "搬表后应至少保留 llm.py 原表的 26 条覆盖面"
        unregistered = sorted(
            f"{alias} -> {target}"
            for alias, target in aliases.items()
            if target not in mcp_mod._TOOL_HANDLERS
        )
        assert not unregistered, f"别名指向未注册工具:{unregistered}"

    def test_alias_keys_do_not_shadow_registered_tools(self) -> None:
        shadowed = sorted(set(mcp_mod._TOOL_ALIASES) & set(mcp_mod._TOOL_HANDLERS))
        assert not shadowed, f"别名键遮蔽真工具名:{shadowed}"

    def test_delegate_only_tools_are_never_alias_key_or_value(self) -> None:
        delegate = llm_router._DELEGATE_ONLY_TOOLS
        aliases = mcp_mod._TOOL_ALIASES
        stolen_keys = sorted(set(aliases) & delegate)
        stolen_values = sorted(set(aliases.values()) & delegate)
        assert not stolen_keys, f"别名键窃取委托语义:{stolen_keys}"
        assert not stolen_values, f"别名值指向委托专有工具:{stolen_values}"


class TestCallToolBehavior:
    """行为面:归一在 call_tool 入口生效,且只对别名生效。"""

    async def test_aliases_outside_the_old_two_entry_table_now_resolve(self, monkeypatch) -> None:
        """旧 2 条表(execute_command/list_directory)覆盖不到的别名如今可解析。

        grep → file_search、cat_file → read_file 都只存在于搬过来的 26 条表里;
        合并前它们经 call_tool 会直接得到「未知工具」。
        """
        seen: list[dict[str, object]] = []

        async def fake_handler(arguments: dict[str, object]) -> dict[str, object]:
            seen.append(arguments)
            return {"ok": True, "result": "stubbed"}

        async def fake_persist(*args: object, **kwargs: object) -> None:
            return None

        monkeypatch.setitem(mcp_mod._TOOL_HANDLERS, "file_search", fake_handler)
        monkeypatch.setitem(mcp_mod._TOOL_HANDLERS, "read_file", fake_handler)
        monkeypatch.setattr("app.services.media_tasks.persist_media_task", fake_persist)

        resp = await mcp_mod.mcp_server.call_tool("grep", {"pattern": "hello"})
        assert resp.get("ok") is True, f"grep 别名未归一到 file_search:{resp}"
        assert seen[0]["pattern"] == "hello"

        resp2 = await mcp_mod.mcp_server.call_tool("cat_file", {"path": "a.txt"})
        assert resp2.get("ok") is True, f"cat_file 别名未归一到 read_file:{resp2}"
        assert seen[1]["path"] == "a.txt"

    async def test_unknown_non_alias_name_still_rejected_with_suggestions(
        self, monkeypatch
    ) -> None:
        """未知且非别名的名字必须仍得到「未知工具」+ suggestions,不得静默改道。"""
        invoked: list[str] = []

        async def spy_handler(arguments: dict[str, object]) -> dict[str, object]:
            invoked.append("file_search")
            return {"ok": True}

        monkeypatch.setitem(mcp_mod._TOOL_HANDLERS, "file_search", spy_handler)

        bogus = "file_searxh"  # 接近 file_search 的笔误,但不是别名键
        assert bogus not in mcp_mod._TOOL_ALIASES
        resp = await mcp_mod.mcp_server.call_tool(bogus, {})
        assert resp.get("ok") is False
        assert "未知工具" in str(resp.get("error", ""))
        assert resp.get("suggestions"), "did-you-mean 建议不得消失"
        assert not invoked, "未知工具名绝不能被静默改道到别的 handler"


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
