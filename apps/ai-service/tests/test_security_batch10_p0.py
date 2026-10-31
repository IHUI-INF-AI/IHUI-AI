# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 10 批回归锁(2026-10-31)。

钉住 ai-service 侧两枚 P0 的修复:
1. generate_test 纳入 _ADMIN_ONLY_TOOLS —— 该工具把 arguments.code 原样落盘为
   可 import 的 source.py 并起 pytest 真执行(pytest 收集时执行模块级代码),
   留在 role 0 可用名单就是任意角色 RCE;子进程 env 也必须消毒(此前完整继承
   服务进程 os.environ,provider API key / JWT_SECRET 随取)。
2. _fire_callback 目标白名单 —— callback_url 是请求体用户可控字段,指向攻击者
   服务器 = X-Internal-Secret(内部共享密钥)整枚外带 + 携带完整推理结果的
   POST SSRF。唯一合法落点 = settings.api_service_url 同源。
"""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest


# =============================================================================
# ① generate_test 权限档
# =============================================================================


class TestGenerateTestAdminOnly:
    def test_generate_test_in_admin_only_tools(self):
        from app.services.mcp_server import _ADMIN_ONLY_TOOLS

        assert "generate_test" in _ADMIN_ONLY_TOOLS

    def test_admin_only_matrix_still_covers_known_dangerous_tools(self):
        from app.services.mcp_server import _ADMIN_ONLY_TOOLS

        for name in ("write_file", "run_command", "db_query", "git_operations"):
            assert name in _ADMIN_ONLY_TOOLS


class TestPytestSubprocessEnvSanitized:
    def test_child_env_strips_injection_and_non_inheritable_vars(self, monkeypatch):
        """_run_pytest_on_generated_test 起的 pytest 子进程不得继承服务进程敏感 env。"""
        from app.services import mcp_server

        probe_secret = "IHUI_TEST_SECRET_DO_NOT_INHERIT"
        monkeypatch.setenv(probe_secret, "top-secret-value")

        captured: dict[str, object] = {}

        class _FakeProc:
            stdout = ""
            stderr = ""
            returncode = 1

        def _fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            captured["env"] = kwargs.get("env")
            return _FakeProc()

        # 空 code/空 test 的假执行:只关心 env 形状,不真跑 pytest
        # (_run_pytest_on_generated_test 内部 `import subprocess as _subprocess`
        # 拿到的是同一模块对象,patch 模块属性即生效)
        with patch("subprocess.run", side_effect=_fake_run):
            mcp_server._run_pytest_on_generated_test("x = 1", "def test_x():\n    assert x\n")

        env = captured.get("env")
        assert env is not None, "pytest 子进程必须显式传 env(修复前完整继承 os.environ)"
        assert probe_secret not in env
        # -I(isolated mode)必须在 argv 里(不读用户 site / PYTHONPATH)
        assert "-I" in captured.get("cmd", [])

    def test_child_env_still_has_path(self, monkeypatch):
        """消毒不削运行必需面:PATH 仍在(正向对照,证明不是把 env 清成空)。"""
        from app.services import mcp_server

        captured: dict[str, object] = {}

        class _FakeProc:
            stdout = ""
            stderr = ""
            returncode = 1

        def _fake_run(cmd, **kwargs):
            captured["env"] = kwargs.get("env")
            return _FakeProc()

        with patch("subprocess.run", side_effect=_fake_run):
            mcp_server._run_pytest_on_generated_test("x = 1", "def test_x():\n    assert x\n")

        env = captured.get("env") or {}
        assert "PATH" in env


# =============================================================================
# ② callback 目标白名单
# =============================================================================


class TestCallbackTargetAllowlist:
    def _self_url(self, path: str = "/api/ai/callback") -> str:
        from app.core.config import settings

        return f"{settings.api_service_url.rstrip('/')}{path}"

    def test_api_service_url_same_origin_allowed(self):
        from app.routers.llm import _is_allowed_callback_target

        assert _is_allowed_callback_target(self._self_url()) is True
        assert _is_allowed_callback_target(self._self_url("/other/path")) is True

    def test_attacker_host_rejected(self):
        from app.routers.llm import _is_allowed_callback_target

        assert _is_allowed_callback_target("https://evil.tld/collect") is False
        assert _is_allowed_callback_target("http://169.254.169.254/latest/meta-data") is False
        assert _is_allowed_callback_target("http://127.0.0.1:8810/x") is False

    def test_non_http_scheme_rejected(self):
        from app.routers.llm import _is_allowed_callback_target

        assert _is_allowed_callback_target("file:///etc/passwd") is False
        assert _is_allowed_callback_target("gopher://internal/x") is False

    def test_malformed_url_rejected(self):
        from app.routers.llm import _is_allowed_callback_target

        assert _is_allowed_callback_target("") is False
        assert _is_allowed_callback_target("not a url") is False

    def test_port_mismatch_rejected(self):
        """同 host 不同端口 = 另一个服务,不在允许集(fail-closed)。"""
        from app.core.config import settings
        from app.routers.llm import _is_allowed_callback_target
        from urllib.parse import urlsplit

        base = urlsplit(settings.api_service_url)
        host = base.hostname or "localhost"
        other_port = 59999 if (base.port or 80) != 59999 else 59998
        assert _is_allowed_callback_target(f"http://{host}:{other_port}/cb") is False


class TestFireCallbackBlocked:
    @pytest.mark.asyncio
    async def test_blocklisted_target_never_sends(self, caplog):
        """非白名单目标:连不带密钥的裸 POST 都不发(推理结果本身是要保护的数据)。"""
        import httpx

        from app.routers import llm

        sent = []

        class _FakeClient:
            def __init__(self, *a, **k):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def post(self, url, **kwargs):
                sent.append(url)
                return httpx.Response(200, request=httpx.Request("POST", url))

        with patch.object(llm.httpx, "AsyncClient", _FakeClient):
            await llm._fire_callback(
                "https://evil.tld/collect",
                {"content": "推理结果正文"},
                {"conversationId": "c1", "userId": "u1"},
            )

        assert sent == [], "非白名单 callback 目标必须零外发"
