"""koubo_workflow 综合测试(2026-07-23 立,补齐口播稿 LangGraph workflow 零覆盖)。

覆盖维度(100+ cases):
1. 模块级常量与路径:SKILLS_ROOT / KOUBO_WORKFLOW_DIR / OUTPUT_DIR / HISTORY_DIR + 2 个 PROMPT(5 tests)
2. KouboState TypedDict:total=False / 字段(2 tests)
3. _trace:必填字段 / ISO 时间 / duration_ms / 默认 status / meta 合并 / 覆盖(7 tests)
4. _run_koubo_script:脚本缺失 / 成功 / rc!=0 / returncode None / 超时 kill / 异常 / env 编码 / cwd+exec(8 tests)
5. KouboWorkflowService 初始化:默认 available / ImportError 降级 / 通用 Exception 降级 / 二次重入 / _graph 类型(5 tests)
6. available 属性:True / False(langgraph 缺)/ False(Exception)(2 tests)
7. _parse_json_array:纯数组 / markdown 围栏 / 围栏含换行 / 前后噪音提取 / 非数组抛 ValueError / 空数组 / 过滤非 dict / 非法 JSON / 对象非数组(9 tests)
8. _hot_scan_node:topic_pool 成功→LLM / topic_pool 失败降级 / LLM 异常 / LLM error=True / LLM error 无 message / JSON 解析失败 / 成功填 hot_topics / topic_hint 默认 / model+owner 透传 / temperature+max_tokens(10 tests)
9. _topic_select_node:空 hot_topics / <8 / =8 / >8 取前 8 / int 评分 / dict 评分求和 / str 评分转换 / 非法评分降 0(8 tests)
10. _write_articles_node:空 selected / 1 篇 / 8 篇串行 / LLM 异常 / LLM error / content strip / prev_summaries 取 60 字 / 仅保留 last 3 / article dict 字段 / index 从 1(10 tests)
11. _validate_node:mkdir / 写文件格式 / rc=0 通过 / rc!=0 失败 / output_path / trace ok / trace fail(7 tests)
12. _archive_node:rc=0 ok / rc!=0 warn(仍 done) / 调用参数(3 tests)
13. _error_node:status=error(1 test)
14. _should_archive:validated True/False(2 tests)
15. run():graph 成功 / graph 异常降级 / graph 不可用走 manual / 初始状态字段 / 默认 dry_run=True / 默认 topic="" / dry_run 透传(7 tests)
16. _run_manual:hot_scan 错短路 / topic_select 错短路 / write_articles 错短路 / validate 错短路 / 全成功到 archive(5 tests)
17. stream():node_start/node_end 顺序 / workflow_done / hot_scan 错 workflow_error / topic_select 错 / write_articles 错 / validate 错 / 5 个节点 / state 快照 / 异步迭代器类型(9 tests)
18. koubo_workflow_service 单例:存在 / 类型 / 有 _graph(3 tests)
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import koubo_workflow as kfw_mod
from app.services.koubo_workflow import (
    HISTORY_DIR,
    HOT_SCAN_PROMPT,
    KOUBO_WORKFLOW_DIR,
    OUTPUT_DIR,
    SKILLS_ROOT,
    WRITE_ARTICLE_PROMPT,
    KouboState,
    KouboWorkflowService,
    _run_koubo_script,
    _trace,
    koubo_workflow_service,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_topic(
    title: str = "t1",
    score: int | dict | str = 20,
    angle: str = "a",
    audience: str = "au",
    hook: str = "h",
) -> dict:
    """构造一个选题 dict(含 five_dim_score)。"""
    return {
        "title": title,
        "angle": angle,
        "audience": audience,
        "hook": hook,
        "five_dim_score": score,
    }


def make_topics(n: int = 8, score_base: int = 15) -> list[dict]:
    """构造 n 个选题,分数递增。"""
    return [make_topic(title=f"t{i}", score=score_base + i) for i in range(n)]


def make_article(idx: int = 1, content: str = "正文内容") -> dict:
    return {"index": idx, "topic": make_topic(title=f"t{idx}"), "content": content}


def make_state(
    date: str = "0723",
    topic_hint: str = "",
    hot_topics: list[dict] | None = None,
    selected_topics: list[dict] | None = None,
    articles: list[dict] | None = None,
    validated: bool = False,
    error: str | None = None,
    status: str = "planning",
    output_path: str = "",
    trace: list[dict] | None = None,
    model: str | None = None,
    owner_uuid: str | None = None,
    dry_run: bool = True,
) -> dict:
    """构造 KouboState 字典。"""
    return {
        "date": date,
        "topic_hint": topic_hint,
        "model": model,
        "owner_uuid": owner_uuid,
        "dry_run": dry_run,
        "hot_topics": hot_topics or [],
        "selected_topics": selected_topics or [],
        "articles": articles or [],
        "validated": validated,
        "output_path": output_path,
        "error": error,
        "status": status,
        "trace": trace or [],
    }


def make_subprocess_mock(returncode: int = 0, stdout: bytes = b"out", stderr: bytes = b"err") -> MagicMock:
    """构造 mock subprocess.proc。"""
    proc = MagicMock()
    proc.returncode = returncode
    proc.communicate = AsyncMock(return_value=(stdout, stderr))
    proc.kill = MagicMock()
    proc.wait = AsyncMock()
    return proc


def make_llm_result(content: str = "[]", error: bool = False, error_message: str = "") -> dict:
    return {"content": content, "error": error, "error_message": error_message}


# =============================================================================
# 1. 模块级常量与路径(5 tests)
# =============================================================================


class TestModuleConstants:
    def test_skills_root_resolves_to_app_skills(self):
        """SKILLS_ROOT = app/services/koubo_workflow.py -> app/services -> app -> app/skills。"""
        expected = Path(kfw_mod.__file__).resolve().parent.parent / "skills"
        assert SKILLS_ROOT == expected
        assert SKILLS_ROOT.name == "skills"

    def test_koubo_workflow_dir_under_skills(self):
        assert KOUBO_WORKFLOW_DIR == SKILLS_ROOT / "koubo_workflow"
        assert KOUBO_WORKFLOW_DIR.name == "koubo_workflow"

    def test_output_dir_under_koubo_workflow(self):
        assert OUTPUT_DIR == KOUBO_WORKFLOW_DIR / "Output"
        assert OUTPUT_DIR.name == "Output"

    def test_history_dir_under_koubo_workflow(self):
        assert HISTORY_DIR == KOUBO_WORKFLOW_DIR / "history"
        assert HISTORY_DIR.name == "history"

    def test_prompts_are_non_empty_strings_with_expected_content(self):
        assert isinstance(HOT_SCAN_PROMPT, str) and HOT_SCAN_PROMPT
        assert "选题" in HOT_SCAN_PROMPT
        assert "五维评分" in HOT_SCAN_PROMPT
        assert isinstance(WRITE_ARTICLE_PROMPT, str) and WRITE_ARTICLE_PROMPT
        assert "约束优先" in WRITE_ARTICLE_PROMPT
        assert "跨篇去重" in WRITE_ARTICLE_PROMPT


# =============================================================================
# 2. KouboState TypedDict(2 tests)
# =============================================================================


class TestKouboState:
    def test_construct_full_state(self):
        """total=False 允许全部字段填入。"""
        s: KouboState = {
            "date": "0723",
            "topic_hint": "AI",
            "model": "gpt-4",
            "owner_uuid": "u1",
            "dry_run": True,
            "hot_topics": [],
            "selected_topics": [],
            "articles": [],
            "validated": False,
            "output_path": "",
            "error": None,
            "status": "planning",
            "trace": [],
        }
        assert s["date"] == "0723"
        assert s["dry_run"] is True

    def test_partial_state_allowed_due_to_total_false(self):
        """total=False 允许只填部分字段。"""
        s: KouboState = {"date": "0723"}  # type: ignore[typeddict-item]
        assert s["date"] == "0723"


# =============================================================================
# 3. _trace 函数(7 tests)
# =============================================================================


class TestTrace:
    def test_returns_dict_with_required_fields(self):
        t = _trace("hot_scan", 1000.0, 1000.5)
        assert t["node"] == "hot_scan"
        assert t["start"] == datetime.utcfromtimestamp(1000.0).isoformat() + "Z"
        assert t["end"] == datetime.utcfromtimestamp(1000.5).isoformat() + "Z"
        assert t["duration_ms"] == 500.0
        assert t["status"] == "ok"

    def test_start_end_iso_with_z_suffix(self):
        t = _trace("n", 0.0, 1.0)
        assert t["start"].endswith("Z")
        assert t["end"].endswith("Z")

    def test_duration_ms_rounded_to_two_decimals(self):
        t = _trace("n", 0.0, 0.123456)
        assert t["duration_ms"] == round(0.123456 * 1000, 2)

    def test_default_status_is_ok(self):
        t = _trace("n", 0.0, 1.0)
        assert t["status"] == "ok"

    def test_custom_status(self):
        t = _trace("n", 0.0, 1.0, status="error")
        assert t["status"] == "error"

    def test_meta_kwargs_merged_into_trace(self):
        t = _trace("n", 0.0, 1.0, topics=8, error="boom")
        assert t["topics"] == 8
        assert t["error"] == "boom"

    def test_meta_can_override_computed_keys(self):
        """**meta 在最后展开,可覆盖 duration_ms 等计算字段(node/start/end/status 是显式参数不能被 meta 覆盖)。"""
        t = _trace("n", 0.0, 1.0, duration_ms=999)
        assert t["duration_ms"] == 999


# =============================================================================
# 4. _run_koubo_script(8 tests)
# =============================================================================


class TestRunKouboScript:
    @pytest.mark.asyncio
    async def test_script_not_found_returns_127(self):
        """脚本不存在 → (127, "", "script not found: ...")。"""
        rc, out, err = await _run_koubo_script("definitely_not_exist_xyz.py", [])
        assert rc == 127
        assert out == ""
        assert "script not found" in err
        assert "definitely_not_exist_xyz.py" in err

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.Path.is_file", return_value=True)
    @patch("app.services.koubo_workflow.asyncio.create_subprocess_exec")
    async def test_success_returns_zero_and_decoded_output(self, mock_exec, mock_isfile):
        proc = make_subprocess_mock(returncode=0, stdout=b"hello", stderr=b"warn")
        mock_exec.return_value = proc
        rc, out, err = await _run_koubo_script("topic_pool.py", ["--take", "30"])
        assert rc == 0
        assert out == "hello"
        assert err == "warn"
        mock_exec.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.Path.is_file", return_value=True)
    @patch("app.services.koubo_workflow.asyncio.create_subprocess_exec")
    async def test_nonzero_returncode_propagates(self, mock_exec, mock_isfile):
        proc = make_subprocess_mock(returncode=2, stdout=b"out", stderr=b"e")
        mock_exec.return_value = proc
        rc, out, err = await _run_koubo_script("topic_pool.py", [])
        assert rc == 2
        assert out == "out"
        assert err == "e"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.Path.is_file", return_value=True)
    @patch("app.services.koubo_workflow.asyncio.create_subprocess_exec")
    async def test_returncode_none_falls_back_to_zero(self, mock_exec, mock_isfile):
        """BUG: proc.returncode 为 None 时 `or 0` 兜底为 0(成功),可能掩盖异常。"""
        proc = make_subprocess_mock(returncode=None, stdout=b"out", stderr=b"")
        mock_exec.return_value = proc
        rc, out, err = await _run_koubo_script("topic_pool.py", [])
        assert rc == 0  # 当前实际行为:None → 0
        assert out == "out"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.Path.is_file", return_value=True)
    @patch("app.services.koubo_workflow.asyncio.create_subprocess_exec")
    async def test_timeout_kills_process_and_returns_124(self, mock_exec, mock_isfile):
        proc = make_subprocess_mock(returncode=0, stdout=b"", stderr=b"")
        # communicate 抛 TimeoutError 触发 wait_for 超时
        proc.communicate = AsyncMock(side_effect=asyncio.TimeoutError())
        mock_exec.return_value = proc
        rc, out, err = await _run_koubo_script("topic_pool.py", [], timeout_sec=5)
        assert rc == 124
        assert out == ""
        assert "timeout" in err
        assert "5s" in err
        proc.kill.assert_called_once()
        proc.wait.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.Path.is_file", return_value=True)
    @patch("app.services.koubo_workflow.asyncio.create_subprocess_exec")
    async def test_subprocess_exception_returns_1_with_message(self, mock_exec, mock_isfile):
        mock_exec.side_effect = OSError("spawn failed")
        rc, out, err = await _run_koubo_script("topic_pool.py", [])
        assert rc == 1
        assert out == ""
        assert "OSError" in err
        assert "spawn failed" in err

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.Path.is_file", return_value=True)
    @patch("app.services.koubo_workflow.asyncio.create_subprocess_exec")
    async def test_uses_sys_executable_and_sets_pythonioencoding_env(self, mock_exec, mock_isfile):
        proc = make_subprocess_mock(returncode=0)
        mock_exec.return_value = proc
        await _run_koubo_script("topic_pool.py", ["--take", "30"])
        call_args = mock_exec.call_args
        assert call_args.args[0] == sys.executable
        env = call_args.kwargs.get("env", {})
        assert env.get("PYTHONIOENCODING") == "utf-8"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.Path.is_file", return_value=True)
    @patch("app.services.koubo_workflow.asyncio.create_subprocess_exec")
    async def test_cwd_set_to_tools_dir(self, mock_exec, mock_isfile):
        proc = make_subprocess_mock(returncode=0)
        mock_exec.return_value = proc
        await _run_koubo_script("topic_pool.py", [])
        cwd = mock_exec.call_args.kwargs.get("cwd", "")
        assert cwd == str(KOUBO_WORKFLOW_DIR / "tools")


# =============================================================================
# 5. KouboWorkflowService 初始化(5 tests)
# =============================================================================


class TestServiceInit:
    def test_default_init_calls_init_graph(self):
        """构造时调用 _init_graph(测试环境 langgraph 已装,_available=True)。"""
        svc = KouboWorkflowService()
        assert svc._available is True
        assert svc._graph is not None

    def test_init_graph_import_error_falls_back_to_unavailable(self, monkeypatch):
        """langgraph 导入 ImportError → _available=False, _graph=None。"""
        # 让 from langgraph.graph import ... 抛 ImportError
        monkeypatch.setitem(sys.modules, "langgraph.graph", None)
        svc = KouboWorkflowService()
        assert svc._available is False
        assert svc._graph is None

    def test_init_graph_general_exception_falls_back(self, monkeypatch):
        """StateGraph 构造抛通用 Exception → _available=False(走 except Exception 分支)。"""
        import langgraph.graph as lg

        original_state_graph = lg.StateGraph

        def _boom(*args, **kwargs):
            raise RuntimeError("graph build boom")

        monkeypatch.setattr(lg, "StateGraph", _boom)
        try:
            svc = KouboWorkflowService()
            assert svc._available is False
            assert svc._graph is None
        finally:
            monkeypatch.setattr(lg, "StateGraph", original_state_graph)

    def test_init_graph_idempotent_when_called_twice(self):
        """二次调用 _init_graph 不抛异常(重置 _available/_graph)。"""
        svc = KouboWorkflowService()
        assert svc._available is True
        # 再次调用应正常完成
        svc._init_graph()
        assert svc._available is True
        assert svc._graph is not None

    def test_graph_has_compiled_object_when_available(self):
        svc = KouboWorkflowService()
        if svc._available:
            # compiled graph 对象应具有 ainvoke 方法
            assert hasattr(svc._graph, "ainvoke")


# =============================================================================
# 6. available 属性(2 tests)
# =============================================================================


class TestAvailableProperty:
    def test_available_true_when_graph_built(self):
        svc = KouboWorkflowService()
        assert svc.available is True

    def test_available_false_when_import_error(self, monkeypatch):
        monkeypatch.setitem(sys.modules, "langgraph.graph", None)
        svc = KouboWorkflowService()
        assert svc.available is False
        assert svc._graph is None


# =============================================================================
# 7. _parse_json_array(9 tests)
# =============================================================================


class TestParseJsonArray:
    def test_plain_json_array(self):
        text = '[{"a":1},{"b":2}]'
        assert KouboWorkflowService._parse_json_array(text) == [{"a": 1}, {"b": 2}]

    def test_markdown_fenced_json_array(self):
        text = "```json\n[{\"a\":1}]\n```"
        assert KouboWorkflowService._parse_json_array(text) == [{"a": 1}]

    def test_markdown_fenced_with_leading_newline(self):
        text = "```\n[{\"a\":1}]\n```"
        assert KouboWorkflowService._parse_json_array(text) == [{"a": 1}]

    def test_extracts_first_array_block_from_surrounding_noise(self):
        text = '前缀说明...\n[{"a":1}]\n后缀说明...'
        assert KouboWorkflowService._parse_json_array(text) == [{"a": 1}]

    def test_non_array_json_raises_value_error(self):
        """JSON 对象(非数组)→ raise ValueError("not a JSON array")。"""
        with pytest.raises(ValueError, match="not a JSON array"):
            KouboWorkflowService._parse_json_array('{"a":1}')

    def test_empty_array_returns_empty_list(self):
        assert KouboWorkflowService._parse_json_array("[]") == []

    def test_filters_out_non_dict_items(self):
        """数组中混入非 dict 元素(字符串/数字)→ 被过滤。"""
        text = '[{"a":1}, "str", 42, null, {"b":2}]'
        assert KouboWorkflowService._parse_json_array(text) == [{"a": 1}, {"b": 2}]

    def test_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            KouboWorkflowService._parse_json_array("not json at all [")

    def test_extracted_block_no_closing_bracket_raises(self):
        """有 [ 但无 ] → start>=0 but end<=start → 不提取 → 解析失败。"""
        with pytest.raises(json.JSONDecodeError):
            KouboWorkflowService._parse_json_array("[ broken")


# =============================================================================
# 8. _hot_scan_node(10 tests)
# =============================================================================


class TestHotScanNode:
    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_topic_pool_success_then_llm_called_with_prompt(self, mock_script, mock_llm):
        mock_script.return_value = (0, "热点1\n热点2", "")
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content='[{"title":"t1"}]'))
        svc = KouboWorkflowService()
        state = make_state(date="0723", topic_hint="AI 提示")
        result = await svc._hot_scan_node(state)
        # 验证 LLM 收到 system prompt + user msg
        messages = mock_llm.complete.call_args.args[0]
        assert messages[0]["role"] == "system"
        assert messages[0]["content"] == HOT_SCAN_PROMPT
        assert messages[1]["role"] == "user"
        assert "0723" in messages[1]["content"]
        assert "AI 提示" in messages[1]["content"]
        assert "热点1" in messages[1]["content"]
        assert result["hot_topics"] == [{"title": "t1"}]

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_topic_pool_failure_logs_warn_but_continues_to_llm(self, mock_script, mock_llm):
        """topic_pool.py 返回非 0 → trace warn 但仍调 LLM。"""
        mock_script.return_value = (1, "", "topic_pool error")
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content='[]'))
        svc = KouboWorkflowService()
        state = make_state(date="0723")
        result = await svc._hot_scan_node(state)
        # LLM 仍被调用
        mock_llm.complete.assert_awaited_once()
        # trace 末尾应是 ok(成功),但 trace 倒数第二项应是 warn
        last_trace = result["trace"][-1]
        assert last_trace["status"] == "ok"
        assert any(t.get("status") == "warn" for t in result["trace"])

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_llm_exception_returns_error_state(self, mock_script, mock_llm):
        mock_script.return_value = (0, "热点", "")
        mock_llm.complete = AsyncMock(side_effect=RuntimeError("LLM down"))
        svc = KouboWorkflowService()
        result = await svc._hot_scan_node(make_state())
        assert result["status"] == "error"
        assert "hot_scan LLM 异常" in result["error"]
        assert "LLM down" in result["error"]
        assert result["trace"][-1]["status"] == "error"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_llm_returns_error_true_uses_error_message(self, mock_script, mock_llm):
        mock_script.return_value = (0, "", "")
        mock_llm.complete = AsyncMock(return_value=make_llm_result(error=True, error_message="API broke"))
        svc = KouboWorkflowService()
        result = await svc._hot_scan_node(make_state())
        assert result["status"] == "error"
        assert result["error"] == "API broke"
        assert result["trace"][-1]["status"] == "error"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_llm_error_true_without_message_uses_default(self, mock_script, mock_llm):
        """result.error=True 但无 error_message → 使用默认 'hot_scan LLM 失败'。"""
        mock_script.return_value = (0, "", "")
        mock_llm.complete = AsyncMock(return_value={"content": "", "error": True})
        svc = KouboWorkflowService()
        result = await svc._hot_scan_node(make_state())
        assert result["status"] == "error"
        assert result["error"] == "hot_scan LLM 失败"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_json_parse_failure_returns_error(self, mock_script, mock_llm):
        mock_script.return_value = (0, "", "")
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content="not a json"))
        svc = KouboWorkflowService()
        result = await svc._hot_scan_node(make_state())
        assert result["status"] == "error"
        assert "JSON 解析失败" in result["error"]
        assert result["trace"][-1]["status"] == "error"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_success_populates_hot_topics_and_trace_ok(self, mock_script, mock_llm):
        mock_script.return_value = (0, "热点", "")
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content='[{"title":"a"},{"title":"b"}]'))
        svc = KouboWorkflowService()
        result = await svc._hot_scan_node(make_state())
        assert len(result["hot_topics"]) == 2
        last_trace = result["trace"][-1]
        assert last_trace["status"] == "ok"
        assert last_trace["topics"] == 2

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_topic_hint_missing_uses_default_none_str(self, mock_script, mock_llm):
        """state 无 topic_hint → user_msg 用 '无'。"""
        mock_script.return_value = (0, "", "")
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content="[]"))
        svc = KouboWorkflowService()
        state = make_state()
        state.pop("topic_hint")
        await svc._hot_scan_node(state)
        user_msg = mock_llm.complete.call_args.args[0][1]["content"]
        assert "选题方向提示:无" in user_msg

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_model_and_owner_uuid_passed_to_llm(self, mock_script, mock_llm):
        mock_script.return_value = (0, "", "")
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content="[]"))
        svc = KouboWorkflowService()
        await svc._hot_scan_node(make_state(model="gpt-4", owner_uuid="user-123"))
        kwargs = mock_llm.complete.call_args.kwargs
        assert kwargs.get("model") == "gpt-4"
        assert kwargs.get("owner_uuid") == "user-123"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_temperature_and_max_tokens_passed(self, mock_script, mock_llm):
        mock_script.return_value = (0, "", "")
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content="[]"))
        svc = KouboWorkflowService()
        await svc._hot_scan_node(make_state())
        kwargs = mock_llm.complete.call_args.kwargs
        assert kwargs.get("temperature") == 0.8
        assert kwargs.get("max_tokens") == 2500


# =============================================================================
# 9. _topic_select_node(8 tests)
# =============================================================================


class TestTopicSelectNode:
    @pytest.mark.asyncio
    async def test_empty_hot_topics_returns_error(self):
        svc = KouboWorkflowService()
        result = await svc._topic_select_node(make_state(hot_topics=[]))
        assert result["status"] == "error"
        assert result["error"] == "hot_topics 为空,无法选题"
        assert result["trace"][-1]["status"] == "error"
        assert result["trace"][-1]["error"] == "empty hot_topics"

    @pytest.mark.asyncio
    async def test_less_than_8_topics_returns_error(self):
        svc = KouboWorkflowService()
        result = await svc._topic_select_node(make_state(hot_topics=make_topics(5)))
        assert result["status"] == "error"
        assert "选题不足 8 个" in result["error"]
        assert "5" in result["error"]

    @pytest.mark.asyncio
    async def test_exactly_8_topics_all_selected(self):
        topics = make_topics(8)
        svc = KouboWorkflowService()
        result = await svc._topic_select_node(make_state(hot_topics=topics))
        assert len(result["selected_topics"]) == 8
        assert result["trace"][-1]["selected"] == 8

    @pytest.mark.asyncio
    async def test_more_than_8_topics_takes_top_8_by_score(self):
        """超过 8 个 → 按分数降序取前 8。"""
        topics = make_topics(12, score_base=10)  # 分数 10..21
        svc = KouboWorkflowService()
        result = await svc._topic_select_node(make_state(hot_topics=topics))
        selected = result["selected_topics"]
        assert len(selected) == 8
        # 取分数最高的 8 个(score 13..21,即 t3..t11 不对,实际是分数 21,20,19,18,17,16,15,14)
        # make_topics(12, base=10): t0=10, t1=11, ..., t11=21 → top8 = t11..t4(score 21..14)
        scores = [t["five_dim_score"] for t in selected]
        assert scores == [21, 20, 19, 18, 17, 16, 15, 14]

    @pytest.mark.asyncio
    async def test_int_score_sorts_descending(self):
        """9 个选题,最低分应被淘汰(sorted 降序取前 8)。"""
        topics = [make_topic(title="low", score=5)] + make_topics(8, score_base=20)
        svc = KouboWorkflowService()
        result = await svc._topic_select_node(make_state(hot_topics=topics))
        titles = [t["title"] for t in result["selected_topics"]]
        # 分数最低的 low(5) 应被淘汰(其他 8 个分数 20..27)
        assert "low" not in titles
        assert len(titles) == 8

    @pytest.mark.asyncio
    async def test_dict_score_sums_values(self):
        """five_dim_score 是 dict → 求和作为总分。9 个选题,low 应被淘汰。"""
        topics = [
            make_topic(title="low", score={"a": 1, "b": 2}),  # 3
            *[
                make_topic(title=f"hi{i}", score={"x": 5, "y": 5, "z": 5})  # 15
                for i in range(8)
            ],
        ]
        svc = KouboWorkflowService()
        result = await svc._topic_select_node(make_state(hot_topics=topics))
        assert "low" not in [t["title"] for t in result["selected_topics"]]
        assert len(result["selected_topics"]) == 8

    @pytest.mark.asyncio
    async def test_string_score_converts_to_int(self):
        """9 个选题,str 分数 18 < 其他 8 个 20..27 → 被淘汰。"""
        topics = [make_topic(title="str", score="18")] + make_topics(8, score_base=20)
        svc = KouboWorkflowService()
        result = await svc._topic_select_node(make_state(hot_topics=topics))
        assert "str" not in [t["title"] for t in result["selected_topics"]]

    @pytest.mark.asyncio
    async def test_invalid_score_defaults_to_zero(self):
        """score 不可转 int(如 list)→ try/except 返回 0。9 个选题,invalid 应被淘汰。"""
        topics = [
            *make_topics(8, score_base=20),
            make_topic(title="invalid", score=[1, 2, 3]),  # int() 失败 → 0
        ]
        svc = KouboWorkflowService()
        result = await svc._topic_select_node(make_state(hot_topics=topics))
        assert "invalid" not in [t["title"] for t in result["selected_topics"]]


# =============================================================================
# 10. _write_articles_node(10 tests)
# =============================================================================


class TestWriteArticlesNode:
    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    async def test_empty_selected_topics_returns_empty_articles(self, mock_llm):
        """无选题 → 不调 LLM,articles=[],trace ok with total=0。"""
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content="正文"))
        svc = KouboWorkflowService()
        result = await svc._write_articles_node(make_state(selected_topics=[]))
        assert result["articles"] == []
        assert result["trace"][-1]["total"] == 0
        mock_llm.complete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    async def test_single_topic_calls_llm_once(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content="正文1"))
        svc = KouboWorkflowService()
        result = await svc._write_articles_node(make_state(selected_topics=[make_topic()]))
        assert len(result["articles"]) == 1
        mock_llm.complete.assert_awaited_once()
        assert result["articles"][0]["content"] == "正文1"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    async def test_eight_topics_serial_calls_llm_eight_times(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content="正文"))
        svc = KouboWorkflowService()
        result = await svc._write_articles_node(make_state(selected_topics=make_topics(8)))
        assert len(result["articles"]) == 8
        assert mock_llm.complete.await_count == 8

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    async def test_llm_exception_returns_error_with_article_index(self, mock_llm):
        mock_llm.complete = AsyncMock(side_effect=RuntimeError("LLM boom"))
        svc = KouboWorkflowService()
        result = await svc._write_articles_node(make_state(selected_topics=make_topics(8)))
        assert result["status"] == "error"
        assert "第 1 篇 LLM 异常" in result["error"]
        assert "LLM boom" in result["error"]
        assert result["trace"][-1]["article"] == 1

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    async def test_llm_error_true_returns_error_with_article_index(self, mock_llm):
        mock_llm.complete = AsyncMock(
            return_value=make_llm_result(error=True, error_message="API broke")
        )
        svc = KouboWorkflowService()
        result = await svc._write_articles_node(make_state(selected_topics=make_topics(8)))
        assert result["status"] == "error"
        assert "第 1 篇 LLM 失败" in result["error"]
        assert "API broke" in result["error"]

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    async def test_content_is_stripped(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content="  正文带空格  \n"))
        svc = KouboWorkflowService()
        result = await svc._write_articles_node(make_state(selected_topics=[make_topic()]))
        assert result["articles"][0]["content"] == "正文带空格"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    async def test_prev_summaries_uses_first_60_chars(self, mock_llm):
        long_content = "x" * 100  # 100 字
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content=long_content))
        svc = KouboWorkflowService()
        # 写 2 篇,第 2 篇的 user_msg 应包含第 1 篇摘要前 60 字
        result = await svc._write_articles_node(make_state(selected_topics=make_topics(2)))
        # 检查第 2 次调用的 user_msg
        second_call = mock_llm.complete.call_args_list[1]
        user_msg = second_call.args[0][1]["content"]
        assert "x" * 60 in user_msg
        assert "x" * 61 not in user_msg  # 不超过 60

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    async def test_prev_summaries_keeps_only_last_3(self, mock_llm):
        """前序摘要只保留最后 3 篇(避免 prompt 过长)。"""
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content="正文"))
        svc = KouboWorkflowService()
        # 写 5 篇,第 5 篇的 user_msg 应只含第 2/3/4 篇摘要(prev_summaries[-3:])
        await svc._write_articles_node(make_state(selected_topics=make_topics(5)))
        fifth_call = mock_llm.complete.call_args_list[4]
        user_msg = fifth_call.args[0][1]["content"]
        # prev_summaries[-3:] = [篇2, 篇3, 篇4] 的摘要,用 chr(10).join
        # 每篇摘要都是 "正文"[:60] = "正文"
        # 期望出现 3 个 "正文" 通过换行连接
        assert "正文\n正文\n正文" in user_msg

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    async def test_article_dict_has_index_topic_content(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content="正文"))
        topic = make_topic(title="mytopic")
        svc = KouboWorkflowService()
        result = await svc._write_articles_node(make_state(selected_topics=[topic]))
        art = result["articles"][0]
        assert art["index"] == 1
        assert art["topic"] == topic
        assert art["content"] == "正文"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow.llm_gateway")
    async def test_article_index_starts_at_one(self, mock_llm):
        """i 从 0 开始,index = i+1。"""
        mock_llm.complete = AsyncMock(return_value=make_llm_result(content="正文"))
        svc = KouboWorkflowService()
        result = await svc._write_articles_node(make_state(selected_topics=make_topics(3)))
        indices = [a["index"] for a in result["articles"]]
        assert indices == [1, 2, 3]
        # 写作 trace 也用 i+1
        write_traces = [t for t in result["trace"] if t["node"] == "write_article"]
        assert [t["article"] for t in write_traces] == [1, 2, 3]


# =============================================================================
# 11. _validate_node(7 tests)
# =============================================================================


class TestValidateNode:
    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_mkdir_called_with_parents_exist_ok(self, mock_script, tmp_path):
        mock_script.return_value = (0, "ok", "")
        svc = KouboWorkflowService()
        out_dir = tmp_path / "Output"
        with patch("app.services.koubo_workflow.OUTPUT_DIR", out_dir):
            await svc._validate_node(make_state(date="0723", articles=[make_article(1, "内容")]))
        assert out_dir.is_dir()
        assert (out_dir / "0723.txt").is_file()

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_output_file_format(self, mock_script, tmp_path):
        mock_script.return_value = (0, "ok", "")
        svc = KouboWorkflowService()
        out_dir = tmp_path / "Output"
        with patch("app.services.koubo_workflow.OUTPUT_DIR", out_dir):
            await svc._validate_node(
                make_state(date="0723", articles=[
                    make_article(1, "正文1"),
                    make_article(2, "正文2"),
                ])
            )
        content = (out_dir / "0723.txt").read_text(encoding="utf-8")
        assert content.startswith("# 0723")
        assert "## 第 1 篇\n正文1" in content
        assert "## 第 2 篇\n正文2" in content

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_pre_publish_check_rc_zero_marks_validated(self, mock_script, tmp_path):
        mock_script.return_value = (0, "all checks pass", "")
        svc = KouboWorkflowService()
        with patch("app.services.koubo_workflow.OUTPUT_DIR", tmp_path):
            result = await svc._validate_node(make_state(date="0723", articles=[make_article()]))
        assert result["validated"] is True
        assert result["status"] == "done"
        assert result["error"] is None
        assert result["trace"][-1]["status"] == "ok"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_pre_publish_check_rc_nonzero_marks_failed(self, mock_script, tmp_path):
        mock_script.return_value = (3, "out", "有违规词")
        svc = KouboWorkflowService()
        with patch("app.services.koubo_workflow.OUTPUT_DIR", tmp_path):
            result = await svc._validate_node(make_state(date="0723", articles=[make_article()]))
        assert result["validated"] is False
        assert result["status"] == "error"
        assert "门禁失败" in result["error"]
        assert "rc=3" in result["error"]
        assert "有违规词" in result["error"]
        assert result["trace"][-1]["status"] == "fail"

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_output_path_set_to_str(self, mock_script, tmp_path):
        mock_script.return_value = (0, "", "")
        svc = KouboWorkflowService()
        with patch("app.services.koubo_workflow.OUTPUT_DIR", tmp_path):
            result = await svc._validate_node(make_state(date="0723", articles=[make_article()]))
        assert result["output_path"] == str(tmp_path / "0723.txt")

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_trace_ok_when_validated(self, mock_script, tmp_path):
        mock_script.return_value = (0, "stdout_data", "")
        svc = KouboWorkflowService()
        with patch("app.services.koubo_workflow.OUTPUT_DIR", tmp_path):
            result = await svc._validate_node(make_state(date="0723", articles=[make_article()]))
        last = result["trace"][-1]
        assert last["node"] == "validate"
        assert last["status"] == "ok"
        assert last["rc"] == 0
        assert last["stdout_tail"] == "stdout_data"[-200:]

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_trace_fail_when_not_validated(self, mock_script, tmp_path):
        mock_script.return_value = (1, "out too long " * 50, "err")
        svc = KouboWorkflowService()
        with patch("app.services.koubo_workflow.OUTPUT_DIR", tmp_path):
            result = await svc._validate_node(make_state(date="0723", articles=[make_article()]))
        last = result["trace"][-1]
        assert last["status"] == "fail"
        assert last["rc"] == 1
        # stdout_tail 截取最后 200 字符
        assert len(last["stdout_tail"]) <= 200


# =============================================================================
# 12. _archive_node(3 tests)
# =============================================================================


class TestArchiveNode:
    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_rc_zero_returns_done_with_ok_trace(self, mock_script):
        mock_script.return_value = (0, "archived", "")
        svc = KouboWorkflowService()
        result = await svc._archive_node(make_state(output_path="/tmp/0723.txt"))
        assert result["status"] == "done"
        assert result["trace"][-1]["status"] == "ok"
        assert result["trace"][-1]["error"] is None

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_rc_nonzero_returns_done_with_warn_trace(self, mock_script):
        """BUG:归档失败时 status 仍设为 'done'(仅 trace 标 warn),不抛错。"""
        mock_script.return_value = (1, "out", "archive boom")
        svc = KouboWorkflowService()
        result = await svc._archive_node(make_state(output_path="/tmp/0723.txt"))
        # 注意:即使 rc!=0,status 仍是 done
        assert result["status"] == "done"
        assert result["trace"][-1]["status"] == "warn"
        assert result["trace"][-1]["rc"] == 1
        assert "archive boom" in result["trace"][-1]["error"]

    @pytest.mark.asyncio
    @patch("app.services.koubo_workflow._run_koubo_script", new_callable=AsyncMock)
    async def test_calls_archive_daily_with_finalize_and_output_path(self, mock_script):
        mock_script.return_value = (0, "", "")
        svc = KouboWorkflowService()
        await svc._archive_node(make_state(output_path="/path/0723.txt"))
        # 验证脚本名 + 位置参数(timeout_sec 是 keyword)
        args = mock_script.call_args.args
        kwargs = mock_script.call_args.kwargs
        assert args[0] == "archive_daily.py"
        assert args[1] == ["--finalize", "/path/0723.txt"]
        # timeout_sec 作为 keyword 传入
        assert kwargs.get("timeout_sec") == 30


# =============================================================================
# 13. _error_node(1 test)
# =============================================================================


class TestErrorNode:
    @pytest.mark.asyncio
    async def test_error_node_sets_status_error(self):
        svc = KouboWorkflowService()
        state = make_state(status="validating")
        result = await svc._error_node(state)
        assert result["status"] == "error"


# =============================================================================
# 14. _should_archive(2 tests)
# =============================================================================


class TestShouldArchive:
    def test_validated_true_returns_archive(self):
        svc = KouboWorkflowService()
        assert svc._should_archive(make_state(validated=True)) == "archive"

    def test_validated_false_returns_error(self):
        svc = KouboWorkflowService()
        assert svc._should_archive(make_state(validated=False)) == "error"
        # validated 缺失也走 error
        assert svc._should_archive({"date": "0723"}) == "error"


# =============================================================================
# 15. run()(7 tests)
# =============================================================================


class TestRun:
    @pytest.mark.asyncio
    async def test_graph_available_calls_ainvoke(self):
        svc = KouboWorkflowService()
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(return_value={"status": "done", "date": "0723"})
        svc._graph = mock_graph
        svc._available = True
        result = await svc.run("0723")
        mock_graph.ainvoke.assert_awaited_once()
        assert result == {"status": "done", "date": "0723"}

    @pytest.mark.asyncio
    async def test_graph_ainvoke_raises_falls_back_to_manual(self):
        svc = KouboWorkflowService()
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock(side_effect=RuntimeError("graph boom"))
        svc._graph = mock_graph
        svc._available = True
        # mock _run_manual 避免实际跑节点
        svc._run_manual = AsyncMock(return_value={"status": "done", "fallback": True})
        result = await svc.run("0723")
        svc._run_manual.assert_awaited_once()
        assert result == {"status": "done", "fallback": True}

    @pytest.mark.asyncio
    async def test_graph_unavailable_calls_run_manual(self):
        svc = KouboWorkflowService()
        svc._available = False
        svc._graph = None
        svc._run_manual = AsyncMock(return_value={"status": "done", "via": "manual"})
        result = await svc.run("0723")
        svc._run_manual.assert_awaited_once()
        assert result["via"] == "manual"

    @pytest.mark.asyncio
    async def test_initial_state_has_correct_fields(self):
        svc = KouboWorkflowService()
        captured = {}

        async def fake_invoke(initial):
            captured.update(initial)
            return {"status": "done"}

        mock_graph = MagicMock()
        mock_graph.ainvoke = fake_invoke
        svc._graph = mock_graph
        svc._available = True
        await svc.run("0723", topic="AI", model="gpt-4", owner_uuid="u1", dry_run=False)
        assert captured["date"] == "0723"
        assert captured["topic_hint"] == "AI"
        assert captured["model"] == "gpt-4"
        assert captured["owner_uuid"] == "u1"
        assert captured["dry_run"] is False

    @pytest.mark.asyncio
    async def test_initial_state_has_empty_collections(self):
        svc = KouboWorkflowService()
        captured = {}

        async def fake_invoke(initial):
            captured.update(initial)
            return {"status": "done"}

        mock_graph = MagicMock()
        mock_graph.ainvoke = fake_invoke
        svc._graph = mock_graph
        svc._available = True
        await svc.run("0723")
        assert captured["hot_topics"] == []
        assert captured["selected_topics"] == []
        assert captured["articles"] == []
        assert captured["trace"] == []

    @pytest.mark.asyncio
    async def test_default_dry_run_is_true(self):
        svc = KouboWorkflowService()
        captured = {}

        async def fake_invoke(initial):
            captured.update(initial)
            return {"status": "done"}

        mock_graph = MagicMock()
        mock_graph.ainvoke = fake_invoke
        svc._graph = mock_graph
        svc._available = True
        await svc.run("0723")
        assert captured["dry_run"] is True

    @pytest.mark.asyncio
    async def test_default_topic_is_empty_string(self):
        svc = KouboWorkflowService()
        captured = {}

        async def fake_invoke(initial):
            captured.update(initial)
            return {"status": "done"}

        mock_graph = MagicMock()
        mock_graph.ainvoke = fake_invoke
        svc._graph = mock_graph
        svc._available = True
        await svc.run("0723")
        assert captured["topic_hint"] == ""
        assert captured["status"] == "planning"
        assert captured["validated"] is False


# =============================================================================
# 16. _run_manual(5 tests)
# =============================================================================


class TestRunManual:
    @pytest.mark.asyncio
    async def test_hot_scan_error_short_circuits(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "error", "error": "boom"})
        svc._topic_select_node = AsyncMock()
        svc._write_articles_node = AsyncMock()
        svc._validate_node = AsyncMock()
        svc._archive_node = AsyncMock()
        result = await svc._run_manual(make_state())
        assert result["status"] == "error"
        svc._topic_select_node.assert_not_awaited()
        svc._archive_node.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_topic_select_error_short_circuits(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "writing"})
        svc._topic_select_node = AsyncMock(return_value={"status": "error", "error": "select boom"})
        svc._write_articles_node = AsyncMock()
        svc._validate_node = AsyncMock()
        svc._archive_node = AsyncMock()
        result = await svc._run_manual(make_state())
        assert result["error"] == "select boom"
        svc._write_articles_node.assert_not_awaited()
        svc._archive_node.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_write_articles_error_short_circuits(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "writing"})
        svc._topic_select_node = AsyncMock(return_value={"status": "writing"})
        svc._write_articles_node = AsyncMock(return_value={"status": "error", "error": "write boom"})
        svc._validate_node = AsyncMock()
        svc._archive_node = AsyncMock()
        result = await svc._run_manual(make_state())
        assert result["error"] == "write boom"
        svc._validate_node.assert_not_awaited()
        svc._archive_node.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_validate_error_short_circuits(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "writing"})
        svc._topic_select_node = AsyncMock(return_value={"status": "writing"})
        svc._write_articles_node = AsyncMock(return_value={"status": "validating"})
        svc._validate_node = AsyncMock(return_value={"status": "error", "error": "validate boom"})
        svc._archive_node = AsyncMock()
        result = await svc._run_manual(make_state())
        assert result["error"] == "validate boom"
        svc._archive_node.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_all_success_calls_archive(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "writing"})
        svc._topic_select_node = AsyncMock(return_value={"status": "writing"})
        svc._write_articles_node = AsyncMock(return_value={"status": "validating"})
        svc._validate_node = AsyncMock(return_value={"status": "done", "validated": True})
        svc._archive_node = AsyncMock(return_value={"status": "done", "archived": True})
        result = await svc._run_manual(make_state())
        assert result["archived"] is True
        svc._archive_node.assert_awaited_once()


# =============================================================================
# 17. stream()(9 tests)
# =============================================================================


class TestStream:
    @pytest.mark.asyncio
    async def test_yields_node_start_and_node_end_for_each_node(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "writing"})
        svc._topic_select_node = AsyncMock(return_value={"status": "writing"})
        svc._write_articles_node = AsyncMock(return_value={"status": "validating"})
        svc._validate_node = AsyncMock(return_value={"status": "done", "validated": True})
        svc._archive_node = AsyncMock(return_value={"status": "done"})
        events = [e async for e in svc.stream("0723")]
        # 5 个 node_start + 5 个 node_end + 1 个 workflow_done = 11
        starts = [e for e in events if e["event"] == "node_start"]
        ends = [e for e in events if e["event"] == "node_end"]
        dones = [e for e in events if e["event"] == "workflow_done"]
        assert len(starts) == 5
        assert len(ends) == 5
        assert len(dones) == 1
        assert [s["node"] for s in starts] == [
            "hot_scan", "topic_select", "write_articles", "validate", "archive",
        ]

    @pytest.mark.asyncio
    async def test_workflow_done_at_end(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "done"})
        svc._topic_select_node = AsyncMock(return_value={"status": "done"})
        svc._write_articles_node = AsyncMock(return_value={"status": "done"})
        svc._validate_node = AsyncMock(return_value={"status": "done", "validated": True})
        svc._archive_node = AsyncMock(return_value={"status": "done", "final": True})
        events = [e async for e in svc.stream("0723")]
        assert events[-1]["event"] == "workflow_done"
        assert events[-1]["state"]["final"] is True

    @pytest.mark.asyncio
    async def test_hot_scan_error_emits_workflow_error_and_stops(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "error", "error": "hs boom"})
        svc._topic_select_node = AsyncMock()
        svc._write_articles_node = AsyncMock()
        svc._validate_node = AsyncMock()
        svc._archive_node = AsyncMock()
        events = [e async for e in svc.stream("0723")]
        # hot_scan node_start + node_end + workflow_error = 3
        assert len(events) == 3
        assert events[0]["event"] == "node_start"
        assert events[0]["node"] == "hot_scan"
        assert events[1]["event"] == "node_end"
        assert events[2]["event"] == "workflow_error"
        assert events[2]["error"] == "hs boom"
        svc._topic_select_node.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_topic_select_error_emits_workflow_error(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "writing"})
        svc._topic_select_node = AsyncMock(return_value={"status": "error", "error": "ts boom"})
        svc._write_articles_node = AsyncMock()
        svc._validate_node = AsyncMock()
        svc._archive_node = AsyncMock()
        events = [e async for e in svc.stream("0723")]
        last = events[-1]
        assert last["event"] == "workflow_error"
        assert last["error"] == "ts boom"
        svc._write_articles_node.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_write_articles_error_emits_workflow_error(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "writing"})
        svc._topic_select_node = AsyncMock(return_value={"status": "writing"})
        svc._write_articles_node = AsyncMock(return_value={"status": "error", "error": "wa boom"})
        svc._validate_node = AsyncMock()
        svc._archive_node = AsyncMock()
        events = [e async for e in svc.stream("0723")]
        assert events[-1]["event"] == "workflow_error"
        assert events[-1]["error"] == "wa boom"
        svc._validate_node.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_validate_error_emits_workflow_error(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "writing"})
        svc._topic_select_node = AsyncMock(return_value={"status": "writing"})
        svc._write_articles_node = AsyncMock(return_value={"status": "validating"})
        svc._validate_node = AsyncMock(return_value={"status": "error", "error": "v boom"})
        svc._archive_node = AsyncMock()
        events = [e async for e in svc.stream("0723")]
        assert events[-1]["event"] == "workflow_error"
        assert events[-1]["error"] == "v boom"
        svc._archive_node.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_five_nodes_iterated_in_order(self):
        """确认 5 个节点函数按顺序被调用。"""
        svc = KouboWorkflowService()
        call_order = []

        async def make_fn(name, ret):
            async def _fn(state):
                call_order.append(name)
                return ret
            return _fn

        svc._hot_scan_node = await make_fn("hot_scan", {"status": "writing"})
        svc._topic_select_node = await make_fn("topic_select", {"status": "writing"})
        svc._write_articles_node = await make_fn("write_articles", {"status": "validating"})
        svc._validate_node = await make_fn("validate", {"status": "done", "validated": True})
        svc._archive_node = await make_fn("archive", {"status": "done"})
        _ = [e async for e in svc.stream("0723")]
        assert call_order == ["hot_scan", "topic_select", "write_articles", "validate", "archive"]

    @pytest.mark.asyncio
    async def test_node_start_carries_state_snapshot_before_node(self):
        svc = KouboWorkflowService()
        # hot_scan 收到的 state 应是 initial(node_start 时还未被节点修改)
        captured = {}

        async def hot_scan(state):
            captured["state_at_hot_scan"] = dict(state)
            return {**state, "hot_topics": [{"t": 1}]}

        svc._hot_scan_node = hot_scan
        svc._topic_select_node = AsyncMock(return_value={"status": "writing"})
        svc._write_articles_node = AsyncMock(return_value={"status": "validating"})
        svc._validate_node = AsyncMock(return_value={"status": "done", "validated": True})
        svc._archive_node = AsyncMock(return_value={"status": "done"})
        events = [e async for e in svc.stream("0723", topic="AI")]
        first_start = events[0]
        assert first_start["event"] == "node_start"
        assert first_start["state"]["topic_hint"] == "AI"
        # 节点内拿到的 state 也应包含 topic_hint
        assert captured["state_at_hot_scan"]["topic_hint"] == "AI"

    @pytest.mark.asyncio
    async def test_stream_returns_async_iterator(self):
        svc = KouboWorkflowService()
        svc._hot_scan_node = AsyncMock(return_value={"status": "done"})
        svc._topic_select_node = AsyncMock(return_value={"status": "done"})
        svc._write_articles_node = AsyncMock(return_value={"status": "done"})
        svc._validate_node = AsyncMock(return_value={"status": "done", "validated": True})
        svc._archive_node = AsyncMock(return_value={"status": "done"})
        gen = svc.stream("0723")
        # 异步迭代器协议:有 __aiter__ 和 __anext__
        assert hasattr(gen, "__aiter__")
        assert hasattr(gen, "__anext__")


# =============================================================================
# 18. koubo_workflow_service 单例(3 tests)
# =============================================================================


class TestSingleton:
    def test_singleton_exists(self):
        assert koubo_workflow_service is not None

    def test_singleton_is_service_instance(self):
        assert isinstance(koubo_workflow_service, KouboWorkflowService)

    def test_singleton_has_graph_attribute(self):
        assert hasattr(koubo_workflow_service, "_graph")
        # _graph 要么是编译对象(available) 要么是 None
        assert koubo_workflow_service._graph is None or hasattr(koubo_workflow_service._graph, "ainvoke")
