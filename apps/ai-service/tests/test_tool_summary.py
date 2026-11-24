# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""tool-summary 聚合面(`llm._build_tool_summary`)与工具名单单一真相源的回归测试。

三组判据,各自钉住一类失效型:

① **计数口径**(A 组):新增三键 `directories` / `edits` / `terminalCommands` 的取值必须与
   前端 `deriveToolSummary`(`apps/web/src/components/ai/progress-sections/
   tool-call-summary-card.tsx`)逐条同义 —— 尤其
   "同一目录多个文件 ⇒ directories 计 1"、"同一文件改三次 ⇒ edits 计 3 而 filesModified 计 1"
   这两条最容易写成同一个数,而它们本来就该不同(动作粒度 vs 文件粒度)。

② **名单一致性**(B 组):后端 frozenset 必须**逐成员**等于
   `app/data/tool_name_sets.json`;该 JSON 必须**逐成员**等于 TS 真相源
   (用 `node scripts/gen-tool-name-sets.mjs --json` 现算现比,不比手抄)。
   历史现场(2026-10-29 修掉的那处漂移):后端 `_FILE_MODIFY_TOOLS` 只有
   `{file_edit, write_file}` 两枚,前端 `FILE_MODIFY_TOOLS` 五枚 ⇒ 同一会话两边算出
   两个"改了几个文件",而用户看到的是前端那个。这条测试就是那次漂移的常驻哨兵。

③ **不再长出第二份清单**(C 组):`_build_tool_summary` 的函数体里不得出现任何工具名字面量。
   名单只能来自 `app/core/tool_name_sets.py`。这一条是"漂移的成因",比"当前取值对不对"更重要:
   取值对了但字面量还在,下一次有人改一边就再漂一次。

测试隔离(§5 铁律):本文件不碰网络 / 磁盘写入 / 数据库,只做纯函数调用与只读读文件。
"""

from __future__ import annotations

import inspect
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from app.core import tool_name_sets as tns
from app.routers import llm as llm_router

REPO_ROOT = Path(__file__).resolve().parents[3]
GENERATOR = REPO_ROOT / "scripts" / "gen-tool-name-sets.mjs"
GENERATED_JSON = REPO_ROOT / "apps" / "ai-service" / "app" / "data" / "tool_name_sets.json"


def _call(name: str, args: dict[str, object] | None = None, **extra: object) -> dict[str, object]:
    """造一条 tool_calls_history 条目(与生产侧 `_build_tool_summary` 收的形态同形)。"""
    row: dict[str, object] = {"toolName": name}
    if args is not None:
        row["args"] = args
    row.update(extra)
    return row


def _summary(history: list[dict[str, object]]) -> dict[str, object]:
    out = llm_router._build_tool_summary(history)  # type: ignore[arg-type]
    assert out is not None, "有工具调用时必须返回统计 dict"
    return out


class TestToolSummaryShape:
    """键集与空入参:发帧面与前端 `ToolCallSummary` 必须同集合。"""

    def test_empty_history_returns_none(self) -> None:
        assert llm_router._build_tool_summary([]) is None, "无工具调用不得发无意义统计"

    def test_exactly_the_registered_keys(self) -> None:
        out = _summary([_call("read_file", {"path": "a/b.ts"})])
        assert tuple(out) == llm_router._TOOL_SUMMARY_KEYS, (
            "发帧键集与单一登记处不一致(顺序即 JSON 字段序,漂了会让快照与前端断言两边都难读)"
        )

    def test_all_eleven_keys_present(self) -> None:
        out = _summary([_call("read_file", {"path": "a/b.ts"})])
        assert len(out) == 11, f"应为 11 键(既有 8 + 新增 3),实得 {len(out)}:{sorted(out)}"
        for key in ("directories", "edits", "terminalCommands"):
            assert key in out, f"新增键 {key} 缺席 ⇒ 真实会话里前端只能靠本地补齐"


class TestDirectories:
    """`directories` = 文件类调用路径的**唯一目录**集合大小(与前端 `fileDirname` 同口径)。"""

    def test_same_directory_many_files_counts_once(self) -> None:
        out = _summary(
            [
                _call("read_file", {"path": "apps/web/src/a.ts"}),
                _call("write_file", {"path": "apps/web/src/b.ts"}),
                _call("file_search", {"path": "apps/web/src/c.ts"}),
            ]
        )
        assert out["directories"] == 1, "同一目录三个文件 ⇒ 目录数必须是 1(唯一集合)"

    def test_distinct_directories_counted_separately(self) -> None:
        out = _summary(
            [
                _call("read_file", {"path": "apps/web/src/a.ts"}),
                _call("read_file", {"path": "apps/web/src/components/b.tsx"}),
                _call("read_file", {"path": "packages/shared/src/c.ts"}),
            ]
        )
        assert out["directories"] == 3

    def test_windows_backslashes_normalize_to_same_directory(self) -> None:
        """正反斜杠归一:同一目录的两种写法不得算成两个目录。"""
        out = _summary(
            [
                _call("read_file", {"path": "apps\\web\\src\\a.ts"}),
                _call("read_file", {"path": "apps/web/src/b.ts"}),
            ]
        )
        assert out["directories"] == 1, "反斜杠未归一 ⇒ Windows 会话的目录数会翻倍"

    def test_bare_filename_has_no_directory(self) -> None:
        """裸文件名没有目录(前端 `fileDirname` 明确返回空串,不得补一个 '/' 假值)。"""
        out = _summary([_call("read_file", {"path": "a.ts"})])
        assert out["directories"] == 0, "裸文件名不得被算成根目录"

    def test_drive_root_has_no_directory(self) -> None:
        out = _summary([_call("read_file", {"path": "/a.ts"})])
        assert out["directories"] == 0

    def test_non_file_category_does_not_contribute(self) -> None:
        """命令类/网页类即便带 path 也不进目录维(类目判据是 file_* 前缀)。"""
        out = _summary(
            [
                _call("run_command", {"path": "apps/web/src/a.ts"}),
                _call("web_search", {"path": "apps/web/src/b.ts"}),
            ]
        )
        assert out["directories"] == 0

    def test_path_key_order_follows_shared_declaration(self) -> None:
        """`path` 优先于 `file_path`(与共享层 `pickFilePath` 的键序逐字一致)。

        顺序错了不会报错,只会让"同一入参两侧取到不同文件" —— 那是最难查的一型。
        """
        assert tns.PATH_ARG_KEYS[:2] == ("path", "file_path")
        out = _summary(
            [_call("read_file", {"path": "first/dir/a.ts", "file_path": "second/dir/a.ts"})]
        )
        assert out["directories"] == 1

    def test_blank_first_key_does_not_fall_through(self) -> None:
        """空白串**不回落**到下一个键(与前端 `readStringArg` 同形:先取第一个字符串,再 trim)。

        这一条是刻意的口径钉:若改成"trim 后为空就继续找下一个键",两侧对同一入参
        会取到不同文件,而错的那一方永远不报错。
        """
        out = _summary(
            [
                _call("read_file", {"path": "  ", "file_path": "second/dir/b.ts"}),
                _call("read_file", {"path": "first/dir/a.ts", "file_path": "second/dir/a.ts"}),
            ]
        )
        # 第一条:path 是字符串(空白)⇒ 取它、trim 成空 ⇒ 无目录;第二条:取 path ⇒ first/dir。
        assert out["directories"] == 1


class TestEditsVersusFilesModified:
    """`edits` 是**调用次数**,`filesModified` 是**唯一文件数** —— 两者正交,不得互相顶替。"""

    def test_same_file_written_thrice(self) -> None:
        history = [
            _call("write_file", {"file_path": "a/b.ts", "content": "x\n"}),
            _call("write_file", {"file_path": "a/b.ts", "content": "y\n"}),
            _call("edit_file", {"file_path": "a/b.ts", "new_string": "z\n"}),
        ]
        out = _summary(history)
        assert out["edits"] == 3, "edits 是动作粒度:同一文件三次写入必须计 3"
        assert out["filesModified"] == 1, "filesModified 是文件粒度:同一文件只计 1"

    def test_non_write_tool_not_counted(self) -> None:
        out = _summary(
            [
                _call("read_file", {"file_path": "a/b.ts"}),
                _call("web_search", {"query": "q"}),
                _call("run_command", {"command": "ls"}),
            ]
        )
        assert out["edits"] == 0

    def test_full_write_whitelist_is_counted(self) -> None:
        """写类名单的**每一枚**都必须真的被计到(名单里躺着但判据不认 = 名单是装饰)。"""
        history = [_call(name, {"file_path": f"a/{name}.ts"}) for name in sorted(tns.FILE_WRITE_TOOLS)]
        out = _summary(history)
        assert out["edits"] == len(tns.FILE_WRITE_TOOLS)


class TestTerminalCommands:
    """`terminalCommands` = 类目 `command` 的调用次数(与前端 `resolveToolCategory` 同源)。"""

    def test_command_tools_counted(self) -> None:
        history = [_call(name, {"command": "ls"}) for name in sorted(tns.COMMAND_TOOLS)]
        out = _summary(history)
        assert out["terminalCommands"] == len(tns.COMMAND_TOOLS)
        assert out["terminalCommands"] > 0, "command 名单为空 ⇒ 该档永远显示 0(最坏的失效方向)"

    def test_file_tools_are_not_commands(self) -> None:
        out = _summary([_call("read_file", {"path": "a.ts"}), _call("write_file", {"file_path": "b.ts"})])
        assert out["terminalCommands"] == 0

    def test_category_whitelists_are_pure_projections_of_exact_map(self) -> None:
        """两条派生名单必须是 `categoryToTool` 的**纯投影** —— 不是另一份手写清单。"""
        cat = tns.CATEGORY_BY_TOOL
        assert {k for k, v in cat.items() if v == "command"} == tns.COMMAND_TOOLS
        assert {k for k, v in cat.items() if v.startswith("file_")} == tns.FILE_CATEGORY_TOOLS


class TestSearchCountsAlignWithFrontend:
    """检索两档必须用前端那份更宽的名单(旧后端只有 3/2 枚,前端 4/3 枚)。"""

    def test_every_file_search_member_counted(self) -> None:
        history = [_call(name, {"path": "a/b.ts"}) for name in sorted(tns.FILE_SEARCH_TOOLS)]
        out = _summary(history)
        assert out["filesSearched"] == len(tns.FILE_SEARCH_TOOLS)

    def test_every_web_search_member_counted(self) -> None:
        history = [_call(name, {"query": "q"}) for name in sorted(tns.WEB_SEARCH_TOOLS)]
        out = _summary(history)
        assert out["webSearched"] == len(tns.WEB_SEARCH_TOOLS)


class TestSingleSourceOfTruth:
    """后端集合 ↔ 生成物 JSON ↔ TS 真相源,三面逐成员等值。"""

    def test_generated_json_exists(self) -> None:
        assert GENERATED_JSON.is_file(), (
            f"工具名单生成物不存在:{GENERATED_JSON};修法 = node scripts/gen-tool-name-sets.mjs"
        )

    def test_backend_sets_equal_generated_json(self) -> None:
        data = json.loads(GENERATED_JSON.read_text(encoding="utf-8"))
        pairs = {
            "FILE_WRITE_TOOLS": ("fileWrite", tns.FILE_WRITE_TOOLS),
            "FILE_SEARCH_TOOLS": ("fileSearch", tns.FILE_SEARCH_TOOLS),
            "WEB_SEARCH_TOOLS": ("webSearch", tns.WEB_SEARCH_TOOLS),
            "FILE_MODIFY_TOOLS": ("fileModify", tns.FILE_MODIFY_TOOLS),
            "COMMAND_TOOLS": ("commandTools", tns.COMMAND_TOOLS),
            "FILE_CATEGORY_TOOLS": ("fileCategoryTools", tns.FILE_CATEGORY_TOOLS),
        }
        for const_name, (json_key, actual) in pairs.items():
            expected = set(data[json_key])
            assert actual == expected, (
                f"{const_name} 与生成物 {json_key} 不一致:"
                f"只在后端 {sorted(actual - expected)} / 只在生成物 {sorted(expected - actual)}"
            )
        assert list(tns.PATH_ARG_KEYS) == list(data["pathArgKeys"]), "pathArgKeys 的**顺序**也是判据"

    def _node(self) -> str:
        node = shutil.which("node")
        if not node:
            pytest.fail("PATH 上找不到 node:TS 真相源无法现算,名单一致性判不成(宁红不跳)")
        return node

    def _run_node(self, node: str, *args: str) -> subprocess.CompletedProcess[str]:
        """派生 node 跑生成器。**必须显式 utf-8 解码**。

        生成物的 `_doNotEdit` 等字段是中文,而 Windows 上 `subprocess.run(text=True)` 默认按
        控制台码页(本机 GBK)解码 ⇒ 读到 0xac/0x85 直接 `UnicodeDecodeError`,异常发生在
        读取线程里、被 pytest 收成 warning,而用例表面看是"断言没过"(AGENTS 记过的
        "中文出参被码页吃掉"那一型)。同理给子进程钉 `PYTHONIOENCODING`/`PYTHONUTF8` 无用 ——
        这里是 node,所以解码侧只能在这一处钉死。
        """
        return subprocess.run(
            [node, str(GENERATOR), *args],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )

    def test_generated_json_is_in_sync_with_ts_source(self) -> None:
        """生成物 ↔ TS 源:用生成器**现算**再比,不比手抄(手抄的期望值本身就是第二份真相)。

        `--check` 档比的是字节级序列化;`--json` 档拿对象做深比较 —— 两条都跑,
        前者证"落盘形态也对",后者证"成员与顺序也对"。
        """
        assert GENERATOR.is_file(), f"生成器不存在:{GENERATOR}"
        node = self._node()

        chk = self._run_node(node, "--check")
        assert chk.returncode == 0, (
            "生成物与 TS 真相源不同步(node scripts/gen-tool-name-sets.mjs --check 非 0);"
            f"stdout={chk.stdout.strip()[:400]} stderr={chk.stderr.strip()[:800]}"
        )

        fresh = self._run_node(node, "--json")
        assert fresh.returncode == 0, f"生成器 --json 失败:{fresh.stderr.strip()[:800]}"
        assert json.loads(fresh.stdout) == json.loads(GENERATED_JSON.read_text(encoding="utf-8")), (
            "现算结果与落盘生成物不等(成员或顺序漂了)"
        )

    def test_no_tool_name_literal_inside_build_tool_summary(self) -> None:
        """C 组:`_build_tool_summary` 体内不得出现任何工具名字面量(= 第二份清单)。

        这条判的是**成因**:取值今天对上、字面量还在,下一次有人只改一边就再漂一次。
        """
        src = inspect.getsource(llm_router._build_tool_summary)
        known = (
            set(tns.FILE_WRITE_TOOLS)
            | set(tns.FILE_SEARCH_TOOLS)
            | set(tns.WEB_SEARCH_TOOLS)
            | set(tns.FILE_MODIFY_TOOLS)
            | set(tns.COMMAND_TOOLS)
            | set(tns.FILE_CATEGORY_TOOLS)
        )
        leaked = sorted(name for name in known if f'"{name}"' in src or f"'{name}'" in src)
        assert not leaked, (
            f"_build_tool_summary 里出现了工具名字面量 {leaked};"
            "名单只能来自 app/core/tool_name_sets.py(改名请改 TS 源并重跑生成器)"
        )


class TestLoaderFailsLoud:
    """取不到 / 形态坏 ⇒ 抛错点名,绝不回落硬编码默认值。"""

    def test_missing_file_raises(self, tmp_path: Path) -> None:
        with pytest.raises(tns.ToolNameSetsError):
            tns.load_tool_name_sets(tmp_path / "nope.json")

    def test_unparsable_raises(self, tmp_path: Path) -> None:
        p = tmp_path / "bad.json"
        p.write_text("{oops", encoding="utf-8")
        with pytest.raises(tns.ToolNameSetsError):
            tns.load_tool_name_sets(p)

    def test_missing_key_raises(self, tmp_path: Path) -> None:
        data = json.loads(GENERATED_JSON.read_text(encoding="utf-8"))
        data.pop("fileModify")
        p = tmp_path / "partial.json"
        p.write_text(json.dumps(data), encoding="utf-8")
        with pytest.raises(tns.ToolNameSetsError):
            tns.load_tool_name_sets(p)

    def test_empty_member_raises(self, tmp_path: Path) -> None:
        data = json.loads(GENERATED_JSON.read_text(encoding="utf-8"))
        data["fileWrite"] = [*data["fileWrite"], ""]
        p = tmp_path / "empty-member.json"
        p.write_text(json.dumps(data), encoding="utf-8")
        with pytest.raises(tns.ToolNameSetsError):
            tns.load_tool_name_sets(p)


class TestLineCountStillWorks:
    """既有 8 键的行为不得因这次改动变样(尤其名单从 2 枚扩到 5 枚之后)。"""

    def test_lines_added_and_deleted(self) -> None:
        out = _summary(
            [
                _call(
                    "edit_file",
                    {"file_path": "a/b.ts", "diff": "@@ -1 +1 @@\n-old\n+new\n"},
                )
            ]
        )
        assert out["linesAdded"] == 1
        assert out["linesDeleted"] == 1
        assert out["filesModified"] == 1

    def test_tools_by_category_and_totals(self) -> None:
        history = [
            _call("read_file", {"path": "a/x.ts"}),
            _call("read_file", {"path": "a/y.ts"}),
            _call("run_command", {"command": "ls"}, durationMs=120),
        ]
        out = _summary(history)
        assert out["toolsByCategory"] == {"read_file": 2, "run_command": 1}
        assert out["totalCalls"] == 3
        assert out["totalDurationMs"] == 120
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
