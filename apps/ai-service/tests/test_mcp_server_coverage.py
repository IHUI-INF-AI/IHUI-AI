"""mcp_server.py 覆盖率补强测试(2026-07-26 立)。

补强 test_mcp_server.py 未覆盖的 mcp_server.py 关键路径:
- _tool_agent_control(完全未测试):fail-closed 密钥校验 + httpx 转发 + 超时/异常分支
- _tool_screenshot_url(MCP 入口未测试):参数校验 + take_screenshot 转发 + 异常降级
- _tool_file_edit(test_mcp_server.py 未覆盖):INVALID_ARGUMENT / PATH_NOT_ALLOWED /
  NOT_FOUND / AMBIGUOUS_MATCH / replace_all / happy_path(含 .bak 副作用)
- SamplingHandler(完全未测试):5 层护栏(rate_limit / model_whitelist / max_tool_rounds /
  timeout / audit_log)+ 默认配置
- MCPServer Sampling API(完全未测试):list_sampling_capabilities / call_sampling 委托 /
  read_resource("sampling://handler")

每个测试断言 3 维度:返回值结构 + 错误处理 + 副作用。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx

from app.services.mcp_server import (
    MCPServer,
    SamplingHandler,
    _tool_agent_control,
    _tool_file_edit,
    _tool_screenshot_url,
    mcp_server,
    sampling_handler,
)

# =============================================================================
# 共享辅助:fake httpx.AsyncClient(对齐 test_mcp_server.py 风格)
# =============================================================================


class _FakeHttpxResponse:
    """httpx.Response 桩:支持 status_code/text/json/raise_for_status。"""

    def __init__(
        self,
        status_code: int = 200,
        text: str = "",
        json_data: dict | None = None,
        headers: dict | None = None,
    ):
        self.status_code = status_code
        self.text = text
        self._json_data = json_data
        self.headers = headers if headers is not None else {"content-type": "application/json"}

    def json(self):
        if self._json_data is not None:
            return self._json_data
        import json as _json
        return _json.loads(self.text) if self.text else {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(f"{self.status_code}", request=None, response=self)


def _make_fake_httpx_client(handler, exc=None):
    """构造 fake httpx.AsyncClient 类,handler(method, url) -> _FakeHttpxResponse。

    exc: 若提供,post() 抛出该异常(用于测试 timeout / 通用异常分支)。
    """

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc_info):
            return False

        async def post(self, url, **kwargs):
            if exc is not None:
                raise exc
            return handler("POST", url)

    return _FakeAsyncClient


# =============================================================================
# _tool_agent_control(完全未测试)
# =============================================================================


class TestMcpServerCoverageAgentControl:
    """_tool_agent_control 覆盖率补强:fail-closed + httpx 转发 + 异常分支。"""

    async def test_no_secret_returns_missing_secret_fail_closed(self, monkeypatch):
        """AGENT_CONTROL_INTERNAL_SECRET 未配置 → ok=False + MISSING_SECRET + 不发 HTTP。"""
        # 结构:隔离 .env 真实 secret(env + settings 双通道清空)
        monkeypatch.delenv("AGENT_CONTROL_INTERNAL_SECRET", raising=False)
        from app.core.config import settings
        monkeypatch.setattr(settings, "agent_control_internal_secret", "")

        post_calls: list = []
        monkeypatch.setattr(
            "httpx.AsyncClient",
            _make_fake_httpx_client(lambda m, u: post_calls.append((m, u)) or _FakeHttpxResponse()),
        )

        out = await _tool_agent_control("browser", "screenshot", {"url": "https://x.com"})

        # 返回值结构
        assert out["tool"] == "browser_screenshot"
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "MISSING_SECRET"
        assert "fail-closed" in out["error"]
        # 副作用:httpx 未发送任何请求
        assert post_calls == []

    async def test_success_returns_ok_with_result_data(self, monkeypatch):
        """secret 已配置 + api 返回 success=True → ok=True + 透传 result data。"""
        from app.core.config import settings
        monkeypatch.setattr(settings, "agent_control_internal_secret", "test-secret-xyz")

        captured: dict = {}

        def handler(method, url):
            captured["method"] = method
            captured["url"] = url
            captured["auth"] = None  # 将在下面断言 headers
            return _FakeHttpxResponse(
                status_code=200,
                json_data={
                    "code": 0,
                    "message": "ok",
                    "data": {"success": True, "screenshot": "base64-data", "area": "viewport"},
                },
            )

        captured_headers: dict = {}

        class _CapturingClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc_info):
                return False

            async def post(self, url, json=None, headers=None, **kwargs):
                captured_headers.update(headers or {})
                captured["url"] = url
                captured["json"] = json
                return handler("POST", url)

        monkeypatch.setattr("httpx.AsyncClient", _CapturingClient)

        out = await _tool_agent_control(
            "browser", "click_element", {"selector": "#btn", "timeout": 5000}
        )

        # 返回值结构
        assert out["tool"] == "browser_click_element"
        assert out["ok"] is True
        assert out["action"] == "click_element"
        assert out["category"] == "browser"
        assert out["result"]["screenshot"] == "base64-data"
        # 错误处理:无 error 字段
        assert "error" not in out
        # 副作用:Authorization header 带 Bearer + 透传 requestId/category/action/params/timeout
        assert captured_headers["Authorization"] == "Bearer test-secret-xyz"
        assert captured["json"]["category"] == "browser"
        assert captured["json"]["action"] == "click_element"
        assert captured["json"]["params"] == {"selector": "#btn"}
        assert captured["json"]["timeout"] == 5000
        assert captured["json"]["requestId"].startswith("mcp-")

    async def test_http_timeout_returns_timeout_error_code(self, monkeypatch):
        """httpx.TimeoutException → ok=False + errorCode=TIMEOUT + 错误信息含毫秒数。"""
        from app.core.config import settings
        monkeypatch.setattr(settings, "agent_control_internal_secret", "s")

        monkeypatch.setattr(
            "httpx.AsyncClient",
            _make_fake_httpx_client(
                lambda m, u: _FakeHttpxResponse(),
                exc=httpx.TimeoutException("read timeout"),
            ),
        )

        out = await _tool_agent_control(
            "computer", "mouse_move", {"x": 10, "y": 20, "timeout": 8000}
        )

        # 返回值结构
        assert out["tool"] == "computer_mouse_move"
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "TIMEOUT"
        assert "8000ms" in out["error"]
        # 副作用:无 result 字段(超时分支不构造 result)
        assert "result" not in out

    async def test_generic_exception_returns_execution_failed(self, monkeypatch):
        """httpx 抛通用异常 → ok=False + errorCode=EXECUTION_FAILED + 错误类型名。"""
        from app.core.config import settings
        monkeypatch.setattr(settings, "agent_control_internal_secret", "s")

        monkeypatch.setattr(
            "httpx.AsyncClient",
            _make_fake_httpx_client(
                lambda m, u: _FakeHttpxResponse(),
                exc=ConnectionError("refused"),
            ),
        )

        out = await _tool_agent_control("browser", "navigate", {"url": "https://x.com"})

        # 返回值结构
        assert out["tool"] == "browser_navigate"
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "EXECUTION_FAILED"
        assert "ConnectionError" in out["message"]
        assert "refused" in out["error"]
        # 副作用:错误信息被截断到 200 字符
        assert len(out["error"]) <= 200

    async def test_api_returns_success_false_propagates_ok_false(self, monkeypatch):
        """api 返回 data.success=False → ok=False(extension 端执行失败透传)。"""
        from app.core.config import settings
        monkeypatch.setattr(settings, "agent_control_internal_secret", "s")

        monkeypatch.setattr(
            "httpx.AsyncClient",
            _make_fake_httpx_client(
                lambda m, u: _FakeHttpxResponse(
                    status_code=200,
                    json_data={"data": {"success": False, "error": "element not found"}},
                )
            ),
        )

        out = await _tool_agent_control("browser", "click_element", {"selector": "#missing"})

        # 返回值结构
        assert out["tool"] == "browser_click_element"
        assert out["ok"] is False
        # 错误处理:handler 不构造 error 字段(由 data.success 决定 ok),result 透传
        assert out["result"]["success"] is False
        assert out["result"]["error"] == "element not found"
        # 副作用:仍透传 action/category
        assert out["action"] == "click_element"
        assert out["category"] == "browser"


# =============================================================================
# _tool_screenshot_url(MCP 入口未测试)
# =============================================================================


class TestMcpServerCoverageScreenshotUrl:
    """_tool_screenshot_url 覆盖率补强:参数校验 + 转发 + 异常降级。"""

    async def test_missing_url_returns_error_no_call(self, monkeypatch):
        """缺 url 参数 → ok=False + 不调 take_screenshot。"""
        take_calls: list = []
        async def _no_call(*a, **kw):
            take_calls.append((a, kw))
            return {
                "url": "x", "title": "t", "can_embed": True,
                "screenshot": "x", "captured_at": "x",
            }
        monkeypatch.setattr("app.services.screenshot_service.take_screenshot", _no_call)

        out = await _tool_screenshot_url({})

        # 返回值结构
        assert out["tool"] == "screenshot_url"
        assert out["ok"] is False
        # 错误处理
        assert "缺少 url" in out["error"]
        # 副作用:take_screenshot 未被调用
        assert take_calls == []

    async def test_success_returns_metadata_no_base64_leak(self, monkeypatch):
        """take_screenshot 成功 → ok=True + 元数据 + 不直接返回 base64。"""
        async def _ok(url, **kw):
            return {
                "url": url,
                "title": "Test Page",
                "can_embed": True,
                "screenshot": "base64-" + "x" * 500,
                "captured_at": "2026-07-26T00:00:00Z",
            }
        monkeypatch.setattr("app.services.screenshot_service.take_screenshot", _ok)

        captured_kwargs: dict = {}
        async def _capturing(url, **kw):
            captured_kwargs.update(kw)
            return await _ok(url, **kw)
        monkeypatch.setattr("app.services.screenshot_service.take_screenshot", _capturing)

        out = await _tool_screenshot_url({
            "url": "https://example.com",
            "width": 1024,
            "height": 768,
            "full_page": True,
            "wait_until": "networkidle",
            "timeout": 20000,
        })

        # 返回值结构
        assert out["tool"] == "screenshot_url"
        assert out["ok"] is True
        assert out["url"] == "https://example.com"
        assert out["title"] == "Test Page"
        assert out["can_embed"] is True
        assert out["captured_at"] == "2026-07-26T00:00:00Z"
        # 错误处理:无 error 字段
        assert "error" not in out
        # 副作用:参数透传 + screenshot_length 反映 base64 长度 + 不直接返回 base64 字段
        assert captured_kwargs["width"] == 1024
        assert captured_kwargs["height"] == 768
        assert captured_kwargs["full_page"] is True
        assert captured_kwargs["wait_until"] == "networkidle"
        assert captured_kwargs["timeout"] == 20000
        assert out["screenshot_length"] == 507  # len("base64-" + "x"*500) = 7 + 500
        assert "screenshot" not in out  # 不直接返回 base64(防响应过大)

    async def test_take_screenshot_raises_returns_screenshot_failed(self, monkeypatch):
        """take_screenshot 抛 RuntimeError → ok=False + SCREENSHOT_FAILED + 类型名。"""
        async def _boom(url, **kw):
            raise RuntimeError("playwright not installed")
        monkeypatch.setattr("app.services.screenshot_service.take_screenshot", _boom)

        out = await _tool_screenshot_url({"url": "https://example.com"})

        # 返回值结构
        assert out["tool"] == "screenshot_url"
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "SCREENSHOT_FAILED"
        assert "RuntimeError" in out["message"]
        assert "playwright not installed" in out["error"]
        # 副作用:错误信息截断到 200 字符
        assert len(out["error"]) <= 200

    async def test_default_dimensions_applied_when_omitted(self, monkeypatch):
        """不传 width/height/full_page/wait_until/timeout → 用默认值。"""
        captured: dict = {}
        async def _capture(url, **kw):
            captured.update(kw)
            return {
                "url": url, "title": "t", "can_embed": True,
                "screenshot": "x", "captured_at": "x",
            }
        monkeypatch.setattr("app.services.screenshot_service.take_screenshot", _capture)

        out = await _tool_screenshot_url({"url": "https://example.com"})

        # 返回值结构
        assert out["ok"] is True
        # 错误处理:无 error
        assert "error" not in out
        # 副作用:默认值透传(1280x720 / full_page=False / wait_until=load / timeout=15000)
        assert captured["width"] == 1280
        assert captured["height"] == 720
        assert captured["full_page"] is False
        assert captured["wait_until"] == "load"
        assert captured["timeout"] == 15000


# =============================================================================
# _tool_file_edit(test_mcp_server.py 未覆盖,补强 happy path + 错误分支)
# =============================================================================


class TestMcpServerCoverageFileEdit:
    """_tool_file_edit 覆盖率补强:参数/路径/匹配/替换/副作用(.bak)。"""

    async def test_empty_old_string_returns_invalid_argument(self):
        """old_string 为空 → ok=False + INVALID_ARGUMENT + 不查文件。"""
        out = await _tool_file_edit({"file_path": "/tmp/x", "old_string": "", "new_string": "y"})

        # 返回值结构
        assert out["tool"] == "file_edit"
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "INVALID_ARGUMENT"
        assert "old_string" in out["error"]
        # 副作用:file_path 透传(未走到 _validate_path_in_workspace)
        assert out["file_path"] == "/tmp/x"

    async def test_path_outside_workspace_returns_path_not_allowed(self, monkeypatch):
        """路径不在白名单 → ok=False + PATH_NOT_ALLOWED + 不读文件。"""
        isfile_calls: list = []
        monkeypatch.setattr(
            "app.services.mcp_server._validate_path_in_workspace",
            lambda p: (False, "路径不在工作区白名单内"),
        )
        monkeypatch.setattr(
            "os.path.isfile", lambda p: isfile_calls.append(p) or False
        )

        out = await _tool_file_edit({
            "file_path": "/etc/passwd",
            "old_string": "x",
            "new_string": "y",
        })

        # 返回值结构
        assert out["tool"] == "file_edit"
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "PATH_NOT_ALLOWED"
        assert "白名单" in out["error"]
        # 副作用:os.path.isfile 未被调用(校验失败前置拦截)
        assert isfile_calls == []

    async def test_file_not_found_returns_not_found(self, monkeypatch, tmp_path):
        """文件不存在 → ok=False + FILE_NOT_FOUND。"""
        target = tmp_path / "missing.py"
        monkeypatch.setattr(
            "app.services.mcp_server._validate_path_in_workspace",
            lambda p: (True, str(target)),
        )

        out = await _tool_file_edit({
            "file_path": str(target),
            "old_string": "x",
            "new_string": "y",
        })

        # 返回值结构
        assert out["tool"] == "file_edit"
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "FILE_NOT_FOUND"
        # 副作用:file_path 是 resolved 路径
        assert out["file_path"] == str(target)

    async def test_ambiguous_match_returns_error_with_count(self, monkeypatch, tmp_path):
        """2 处匹配且未指定 replace_all → ok=False + AMBIGUOUS_MATCH + match_count=2。"""
        target = tmp_path / "a.py"
        target.write_text("foo\nfoo\nbar\n", encoding="utf-8")
        monkeypatch.setattr(
            "app.services.mcp_server._validate_path_in_workspace",
            lambda p: (True, str(target)),
        )

        out = await _tool_file_edit({
            "file_path": str(target),
            "old_string": "foo",
            "new_string": "baz",
        })

        # 返回值结构
        assert out["tool"] == "file_edit"
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "AMBIGUOUS_MATCH"
        assert out["match_count"] == 2
        # 副作用:原文件未被修改(回滚或不写入)
        assert target.read_text(encoding="utf-8") == "foo\nfoo\nbar\n"

    async def test_not_found_returns_not_found_with_zero_count(self, monkeypatch, tmp_path):
        """0 处匹配 → ok=False + NOT_FOUND + match_count=0。"""
        target = tmp_path / "a.py"
        target.write_text("hello world\n", encoding="utf-8")
        monkeypatch.setattr(
            "app.services.mcp_server._validate_path_in_workspace",
            lambda p: (True, str(target)),
        )

        out = await _tool_file_edit({
            "file_path": str(target),
            "old_string": "nonexistent_str",
            "new_string": "x",
        })

        # 返回值结构
        assert out["tool"] == "file_edit"
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "NOT_FOUND"
        assert out["match_count"] == 0
        # 副作用:文件内容未变
        assert target.read_text(encoding="utf-8") == "hello world\n"

    async def test_happy_path_replaces_and_creates_backup(self, monkeypatch, tmp_path):
        """单匹配 → ok=True + replaced_count=1 + .bak 备份 + 内容已更新 + diff_preview。"""
        target = tmp_path / "a.py"
        # 用 write_bytes 避免 Windows 换行符翻译(\n → \r\n),保证 raw 备份可断言
        target.write_bytes(b"def foo():\n    return 1\n")
        monkeypatch.setattr(
            "app.services.mcp_server._validate_path_in_workspace",
            lambda p: (True, str(target)),
        )

        out = await _tool_file_edit({
            "file_path": str(target),
            "old_string": "return 1",
            "new_string": "return 2",
        })

        # 返回值结构
        assert out["tool"] == "file_edit"
        assert out["ok"] is True
        assert out["replaced_count"] == 1
        # 错误处理:无 error 字段
        assert "error" not in out
        # 副作用:文件内容已替换 + .bak 备份已创建 + diff_preview 含变更
        assert target.read_bytes() == b"def foo():\n    return 2\n"
        backup = target.parent / "a.py.bak"
        assert backup.exists()
        assert backup.read_bytes() == b"def foo():\n    return 1\n"
        assert "return 2" in out["diff_preview"]
        assert "return 1" in out["diff_preview"]

    async def test_replace_all_replaces_all_occurrences(self, monkeypatch, tmp_path):
        """replace_all=True + 多匹配 → replaced_count=count + 全部替换。"""
        target = tmp_path / "a.py"
        # 用 write_bytes 避免 Windows 换行符翻译,保证 raw 备份可断言
        target.write_bytes(b"foo\nfoo\nfoo\n")
        monkeypatch.setattr(
            "app.services.mcp_server._validate_path_in_workspace",
            lambda p: (True, str(target)),
        )

        out = await _tool_file_edit({
            "file_path": str(target),
            "old_string": "foo",
            "new_string": "bar",
            "replace_all": True,
        })

        # 返回值结构
        assert out["tool"] == "file_edit"
        assert out["ok"] is True
        # 错误处理:无 error
        assert "error" not in out
        # 副作用:3 处全部替换 + 备份是原始内容
        assert out["replaced_count"] == 3
        assert target.read_bytes() == b"bar\nbar\nbar\n"
        backup = target.parent / "a.py.bak"
        assert backup.read_bytes() == b"foo\nfoo\nfoo\n"

    async def test_binary_file_with_nul_byte_rejected(self, monkeypatch, tmp_path):
        """文件含 NUL 字节 → ok=False + BINARY_FILE。"""
        target = tmp_path / "a.bin"
        target.write_bytes(b"\x00\x01\x02foo\x00")
        monkeypatch.setattr(
            "app.services.mcp_server._validate_path_in_workspace",
            lambda p: (True, str(target)),
        )

        out = await _tool_file_edit({
            "file_path": str(target),
            "old_string": "foo",
            "new_string": "bar",
        })

        # 返回值结构
        assert out["tool"] == "file_edit"
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "BINARY_FILE"
        assert "NUL" in out["error"]
        # 副作用:文件内容未修改
        assert target.read_bytes() == b"\x00\x01\x02foo\x00"


# =============================================================================
# SamplingHandler(完全未测试)
# =============================================================================


class TestMcpServerCoverageSamplingHandler:
    """SamplingHandler 5 层护栏覆盖率补强。"""

    def test_default_guardrails_set_on_construction(self):
        """无参数构造 → DEFAULT_GUARDRAILS 全部就位 + 内部状态空。"""
        h = SamplingHandler()

        # 返回值结构:get_stats 返回 total_calls/blocked_calls/guardrails 三字段
        stats = h.get_stats()
        assert set(stats.keys()) == {"total_calls", "blocked_calls", "guardrails"}
        # 错误处理:默认值符合契约
        g = stats["guardrails"]
        assert g["rate_limit_rpm"] == 10
        assert g["model_whitelist"] == []
        assert g["max_tool_rounds"] == 5
        assert g["timeout_seconds"] == 30
        assert g["audit_log"] is True
        # 副作用:初始状态 0 调用
        assert stats["total_calls"] == 0
        assert stats["blocked_calls"] == 0
        assert h.get_audit_logs() == []

    def test_custom_guardrails_override_defaults(self):
        """自定义 guardrails 覆盖默认值(部分覆盖,其余保留)。"""
        h = SamplingHandler(guardrails={"rate_limit_rpm": 2, "timeout_seconds": 5})
        g = h.get_stats()["guardrails"]
        # 返回值结构:自定义值生效
        assert g["rate_limit_rpm"] == 2
        assert g["timeout_seconds"] == 5
        # 错误处理:未覆盖的保留默认
        assert g["max_tool_rounds"] == 5
        assert g["model_whitelist"] == []
        # 副作用:audit_log 字段仍在
        assert g["audit_log"] is True

    async def test_rate_limit_exceeded_returns_blocked(self):
        """调用次数 ≥ rate_limit_rpm → blocked=True + rate_limit_exceeded。"""
        h = SamplingHandler(guardrails={"rate_limit_rpm": 1, "audit_log": False})
        # 预填一个时间戳(模拟已有 1 次调用)
        import time
        h._call_timestamps.append(time.monotonic())

        out = await h.handle_sampling({
            "callerTool": "t1",
            "messages": [{"role": "user", "content": "hi"}],
            "model": "gpt-4o",
        })

        # 返回值结构
        assert out["blocked"] is True
        assert out["content"] == ""
        assert out["usage"] is None
        # 错误处理
        assert out["blockedReason"] == "rate_limit_exceeded"
        # 副作用:audit_log 关闭,不记录
        assert h.get_audit_logs() == []

    async def test_model_not_whitelisted_returns_blocked(self):
        """whitelist 非空 + model 不在白名单 → blocked=True + model_not_whitelisted。"""
        h = SamplingHandler(guardrails={
            "rate_limit_rpm": 10,
            "model_whitelist": ["allowed-model"],
            "audit_log": False,
        })

        out = await h.handle_sampling({
            "callerTool": "t1",
            "messages": [],
            "model": "blocked-model",
        })

        # 返回值结构
        assert out["blocked"] is True
        assert out["model"] == "blocked-model"
        # 错误处理
        assert out["blockedReason"] == "model_not_whitelisted"
        # 副作用:未调用 LLM(无 audit log)
        assert h.get_audit_logs() == []

    async def test_max_tool_rounds_exceeded_returns_blocked(self):
        """callerTool 成功调用次数 ≥ max_tool_rounds → blocked + max_tool_rounds_exceeded。"""
        h = SamplingHandler(guardrails={
            "rate_limit_rpm": 100,
            "max_tool_rounds": 2,
            "audit_log": True,
        })
        # 预填 2 条成功调用记录(模拟 callerTool=cli 已用满额度)
        h._audit_logs = [
            {
                "callerTool": "cli", "model": "m",
                "blocked": False, "timestamp": "2026-07-26T00:00:00",
            },
            {
                "callerTool": "cli", "model": "m",
                "blocked": False, "timestamp": "2026-07-26T00:00:01",
            },
        ]

        out = await h.handle_sampling({
            "callerTool": "cli",
            "messages": [],
            "model": "m",
        })

        # 返回值结构
        assert out["blocked"] is True
        assert out["model"] == "m"
        # 错误处理
        assert out["blockedReason"] == "max_tool_rounds_exceeded"
        # 副作用:rate_limit 通过(未加时间戳),audit_logs 未新增
        assert len(h._call_timestamps) == 0
        assert len(h.get_audit_logs()) == 2  # 未新增

    async def test_successful_call_returns_content_and_logs_audit(self):
        """正常调用 → content/model/usage 透传 + audit_logs 新增 1 条。"""
        h = SamplingHandler(guardrails={"rate_limit_rpm": 10, "audit_log": True})
        fake_result = {"content": "LLM response", "model": "gpt-4o", "usage": {"prompt_tokens": 5}}
        with patch("app.core.llm_gateway.llm_gateway") as gw_mock:
            gw_mock.complete = AsyncMock(return_value=fake_result)
            out = await h.handle_sampling({
                "callerTool": "tool_x",
                "messages": [{"role": "user", "content": "hi"}],
                "model": "gpt-4o",
                "context": "ctx-xyz",
            })

        # 返回值结构
        assert out["blocked"] is False
        assert out["content"] == "LLM response"
        assert out["model"] == "gpt-4o"
        assert out["usage"] == {"prompt_tokens": 5}
        # 错误处理:无 blockedReason
        assert "blockedReason" not in out
        # 副作用:audit_logs 新增 1 条 + 时间戳记录 + stats total_calls=1
        logs = h.get_audit_logs()
        assert len(logs) == 1
        assert logs[0]["callerTool"] == "tool_x"
        assert logs[0]["model"] == "gpt-4o"
        assert logs[0]["blocked"] is False
        assert "ctx-xyz" in logs[0]["context"]
        assert len(h._call_timestamps) == 1
        stats = h.get_stats()
        assert stats["total_calls"] == 1
        assert stats["blocked_calls"] == 0

    async def test_llm_timeout_returns_blocked_with_audit(self):
        """llm_gateway.complete 超时 → blocked=True + timeout + audit_logs 记录 blocked。"""
        import asyncio
        h = SamplingHandler(guardrails={
            "rate_limit_rpm": 10,
            "timeout_seconds": 0.01,  # 极短超时,必触发
            "audit_log": True,
        })
        async def _slow_complete(messages, model=None):
            await asyncio.sleep(1)  # 远超 0.01s 超时
            return {"content": "x"}
        with patch("app.core.llm_gateway.llm_gateway") as gw_mock:
            gw_mock.complete = _slow_complete
            out = await h.handle_sampling({
                "callerTool": "t",
                "messages": [],
                "model": "m",
            })

        # 返回值结构
        assert out["blocked"] is True
        assert out["content"] == ""
        assert out["usage"] is None
        # 错误处理
        assert out["blockedReason"] == "timeout"
        # 副作用:audit_logs 记录 blocked=True
        logs = h.get_audit_logs()
        assert len(logs) == 1
        assert logs[0]["blocked"] is True
        assert logs[0]["blockedReason"] == "timeout"
        assert h.get_stats()["blocked_calls"] == 1

    async def test_llm_exception_returns_blocked_with_error_reason(self):
        """llm_gateway.complete 抛通用异常 → blocked=True + blockedReason 含 error。"""
        h = SamplingHandler(guardrails={"rate_limit_rpm": 10, "audit_log": False})
        with patch("app.core.llm_gateway.llm_gateway") as gw_mock:
            gw_mock.complete = AsyncMock(side_effect=RuntimeError("api down"))
            out = await h.handle_sampling({
                "callerTool": "t",
                "messages": [],
                "model": "m",
            })

        # 返回值结构
        assert out["blocked"] is True
        assert out["model"] == "m"
        # 错误处理:blockedReason 含 "error:" 前缀 + 异常信息
        assert out["blockedReason"].startswith("error:")
        assert "api down" in out["blockedReason"]
        # 副作用:audit_log 关闭 → 不记录
        assert h.get_audit_logs() == []

    async def test_empty_model_skips_whitelist_check(self):
        """request.model 为空 → 跳过白名单校验(空白名单=允许所有,空 model=允许)。"""
        h = SamplingHandler(guardrails={
            "rate_limit_rpm": 10,
            "model_whitelist": ["only-this"],
            "audit_log": False,
        })
        with patch("app.core.llm_gateway.llm_gateway") as gw_mock:
            gw_mock.complete = AsyncMock(return_value={"content": "ok", "model": "default"})
            out = await h.handle_sampling({
                "callerTool": "t",
                "messages": [],
                # 不传 model
            })

        # 返回值结构:成功调用,未触发 whitelist 拦截
        assert out["blocked"] is False
        assert out["content"] == "ok"
        # 错误处理:无 blockedReason
        assert "blockedReason" not in out
        # 副作用:llm_gateway 被调用
        gw_mock.complete.assert_awaited_once()


# =============================================================================
# MCPServer Sampling API(完全未测试)
# =============================================================================


class TestMcpServerCoverageSamplingApi:
    """MCPServer.call_sampling / list_sampling_capabilities / read_resource 覆盖率。"""

    def test_list_sampling_capabilities_returns_uri_and_guardrails(self):
        """list_sampling_capabilities 返回 uri/name/description/guardrails 4 字段。"""
        out = mcp_server.list_sampling_capabilities()

        # 返回值结构
        assert out["uri"] == "sampling://handler"
        assert out["name"] == "sampling_handler"
        assert isinstance(out["description"], str)
        assert len(out["description"]) > 0
        # 错误处理:guardrails 字段存在(从 sampling_handler.get_stats 透传)
        assert "guardrails" in out
        assert "rate_limit_rpm" in out["guardrails"]
        # 副作用:不影响全局 sampling_handler 状态
        assert mcp_server.list_sampling_capabilities() == out  # 幂等

    async def test_call_sampling_delegates_to_handle_sampling(self):
        """call_sampling 委托给 sampling_handler.handle_sampling + 透传 request。"""
        captured: dict = {}
        async def _fake_handle(req):
            captured.update(req)
            return {"content": "resp", "model": "m", "usage": None, "blocked": False}
        original = sampling_handler.handle_sampling
        sampling_handler.handle_sampling = _fake_handle
        try:
            out = await mcp_server.call_sampling({
                "callerTool": "my_tool",
                "messages": [{"role": "user", "content": "hi"}],
                "model": "gpt-4o",
                "maxTokens": 100,
            })
        finally:
            sampling_handler.handle_sampling = original

        # 返回值结构
        assert out["blocked"] is False
        assert out["content"] == "resp"
        assert out["model"] == "m"
        # 错误处理:无 blockedReason
        assert "blockedReason" not in out
        # 副作用:request 完整透传到 handle_sampling
        assert captured["callerTool"] == "my_tool"
        assert captured["model"] == "gpt-4o"
        assert captured["maxTokens"] == 100
        assert len(captured["messages"]) == 1

    async def test_read_resource_sampling_handler_returns_stats(self):
        """read_resource('sampling://handler') → ok=True + content=get_stats()。"""
        out = await mcp_server.read_resource("sampling://handler")

        # 返回值结构
        assert out["ok"] is True
        assert out["uri"] == "sampling://handler"
        assert isinstance(out["content"], dict)
        # 错误处理:无 error
        assert "error" not in out
        # 副作用:content 含 total_calls/blocked_calls/guardrails(sampling_handler.get_stats 输出)
        assert "total_calls" in out["content"]
        assert "blocked_calls" in out["content"]
        assert "guardrails" in out["content"]

    def test_independent_mcp_server_instance_has_sampling_api(self):
        """独立 MCPServer 实例的 sampling API 可用(不依赖全局 mcp_server 单例)。"""
        s = MCPServer()
        # 返回值结构
        out = s.list_sampling_capabilities()
        assert out["uri"] == "sampling://handler"
        # 错误处理:独立实例的 guardrails 与全局一致(共用 sampling_handler 单例)
        assert out["guardrails"]["rate_limit_rpm"] == 10
        # 副作用:不影响全局 mcp_server
        assert mcp_server.list_sampling_capabilities()["uri"] == "sampling://handler"


# =============================================================================
# admin 权限矩阵补强(file_edit / screenshot_url / configure_automation_task)
# =============================================================================


class TestMcpServerCoverageAdminPermissions:
    """admin 专属工具普通用户调用 → PERMISSION_DENIED(补强未覆盖的工具)。"""

    async def test_file_edit_denied_for_normal_user(self):
        """file_edit 是 admin 专属,普通用户(user_role=0)调用 → PERMISSION_DENIED。"""
        out = await mcp_server.call_tool(
            "file_edit",
            {"file_path": "/tmp/x", "old_string": "a", "new_string": "b"},
            user_role=0,
        )

        # 返回值结构
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "PERMISSION_DENIED"
        assert "file_edit" in out["error"]
        assert "role >= 1" in out["error"]
        # 副作用:handler 未被执行(无 file_path 透传 / 无 io 副作用)
        assert "replaced_count" not in out
        assert "diff_preview" not in out

    async def test_screenshot_url_denied_for_normal_user(self):
        """screenshot_url 是 admin 专属(SSRF 入口),普通用户 → PERMISSION_DENIED。"""
        out = await mcp_server.call_tool(
            "screenshot_url",
            {"url": "https://example.com"},
            user_role=0,
        )

        # 返回值结构
        assert out["ok"] is False
        # 错误处理
        assert out["errorCode"] == "PERMISSION_DENIED"
        # 副作用:take_screenshot 未被调用
        assert "screenshot_length" not in out

    async def test_admin_user_passes_permission_check(self, monkeypatch):
        """admin(user_role=1)调用 screenshot_url → 通过权限检查(后续由 handler 决定 ok)。"""
        async def _ok_screenshot(url, **kw):
            return {
                "url": url, "title": "t", "can_embed": True,
                "screenshot": "x", "captured_at": "x",
            }
        monkeypatch.setattr("app.services.screenshot_service.take_screenshot", _ok_screenshot)

        out = await mcp_server.call_tool(
            "screenshot_url",
            {"url": "https://example.com"},
            user_role=1,
        )

        # 返回值结构:通过权限 + handler 成功
        assert out["tool"] == "screenshot_url"
        assert out["ok"] is True
        # 错误处理:无 PERMISSION_DENIED
        assert out.get("errorCode") != "PERMISSION_DENIED"
        # 副作用:screenshot_length 字段存在(证明 handler 被执行)
        assert "screenshot_length" in out
