# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 10 批 R4 回归锁(2026-10-31)。

钉住 /api/sandbox/run 的两枚修复:
1. admin 收敛 —— 本端点等价"以服务身份起进程"(档位只限资源,不限网络与
   文件系统:Windows Job Object 无法限网/限文件 ACL),对 role=0 开放即任意
   登录账号拿登记工作区里的 .venv python 起 -c payload = 服务身份代码执行。
   角色判定走 jwt_auth.resolve_request_role_id 单源(fail-closed)。
2. WinJobBackend 受限令牌失败 fail-closed —— 原实现回退原始令牌重试(仅
   stderr 标记 token_degraded):令牌降权是档位声明的安全边界,降权后跑不起
   来就按未降权身份跑 = 沙箱失效静默降级。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

from app.core.jwt_auth import resolve_request_role_id
from app.routers import sandbox_exec
from app.routers.sandbox_exec import SandboxRunRequest


# =============================================================================
# ① 路由 admin 闸
# =============================================================================


class _FakeRequest:
    """resolve_request_role_id 只读 request.state.role_id。"""

    def __init__(self, role_id: int | None) -> None:
        self.state = SimpleNamespace(role_id=role_id, user_id="u1")


class TestSandboxRunAdminGate:
    def test_non_admin_rejected_403(self) -> None:
        body = SandboxRunRequest(cmd="echo hi")
        with pytest.raises(HTTPException) as exc:
            sandbox_exec.sandbox_run(
                body,
                _FakeRequest(role_id=0),  # type: ignore[arg-type]
                user_id="u1",
            )
        assert exc.value.status_code == 403

    def test_missing_role_fails_closed_403(self) -> None:
        """role_id 缺失(None)→ 按 0 处理 → 403(fail-closed)。"""
        body = SandboxRunRequest(cmd="echo hi")
        with pytest.raises(HTTPException) as exc:
            sandbox_exec.sandbox_run(
                body,
                _FakeRequest(role_id=None),  # type: ignore[arg-type]
                user_id="u1",
            )
        assert exc.value.status_code == 403

    def test_resolve_role_id_missing_state_is_zero(self) -> None:
        assert resolve_request_role_id(SimpleNamespace(state=SimpleNamespace())) == 0  # type: ignore[arg-type]

    def test_admin_passes_gate_reaches_policy_layer(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """正向对照:admin 越过角色闸后走既有档位管线(此处策略非法即 400,
        证明请求已进入策略层而非被角色闸拦截)。"""
        body = SandboxRunRequest(
            cmd="echo hi",
            policy={"network": True},  # 档位外字段 → PolicyError → 400
        )
        with pytest.raises(HTTPException) as exc:
            sandbox_exec.sandbox_run(
                body,
                _FakeRequest(role_id=1),  # type: ignore[arg-type]
                user_id="admin1",
            )
        assert exc.value.status_code == 400


# =============================================================================
# ② WinJob 受限令牌 fail-closed(平台逻辑,以单元级 mock 钉分支)
# =============================================================================


class TestRestrictedTokenFailClosed:
    def test_restricted_token_spawn_failure_raises_without_fallback(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """受限令牌下 _spawn 失败 ⇒ 抛错,绝不以原始令牌(token=0)重试。"""
        from app.services import os_sandbox as oss

        spawn_calls: list[int] = []

        class _FakeBackend(oss.WinJobBackend):
            def __init__(self) -> None:  # 绕开平台检查
                self.policy = SimpleNamespace(
                    restrict_token=True,
                    timeout_s=5,
                    memory_mb=64,
                    cpu_seconds=2,
                    max_processes=4,
                    denied_paths=(),
                    readable_paths=(),
                    writable_paths=(),
                    allow_network=False,
                    backend_name="win_job",
                    # 路径 ACL 判据不在本用例靶面(只验证令牌分支):放行一切
                    can_read=lambda p: True,
                    can_write=lambda p: True,
                    is_denied=lambda p: False,
                    env_whitelist=(),
                )
                self.backend_name = "win_job"

            def _spawn(self, cmd: Any, cwd: str, env: dict, fds: tuple, token: int) -> tuple:
                spawn_calls.append(token)
                if token:
                    return 0, 0, 0  # 受限令牌下启动失败
                return 0, 0, 0  # 若回退原始令牌也会"成功"——正好证明是否回退

        monkeypatch.setattr(oss, "create_restricted_token", lambda: 424242)
        monkeypatch.setattr(
            oss, "_kernel32", lambda: SimpleNamespace(CloseHandle=lambda h: 1)
        )
        # 平台交互替身:Job 对象与 fd 全部无害化,只验证控制流,不碰真实 Win32
        monkeypatch.setattr(oss.WinJob, "create", staticmethod(lambda: SimpleNamespace(
            set_limits=lambda *a, **k: None, assign=lambda h: None, close=lambda: None,
        )))
        # fd 替身:open/close 都收编,文件读写走真实 tmpdir(最终 _read_file 用
        # open() 读路径,落到空文件即可)
        import os as _os
        import tempfile as _tf

        tmp = _tf.mkdtemp(prefix="ihui_r4_")
        for name in ("stdout.bin", "stderr.bin"):
            with open(_os.path.join(tmp, name), "wb"):
                pass

        real_open = _os.open

        def _fake_open(path: Any, flags: int, mode: int = 0o666) -> int:
            if path == _os.devnull:
                return real_open(_os.devnull, flags)
            return real_open(
                _os.path.join(tmp, _os.path.basename(str(path))), flags | _os.O_CREAT, mode
            )

        monkeypatch.setattr(oss.os, "open", _fake_open)
        monkeypatch.setattr(oss.os, "close", lambda fd: None)
        monkeypatch.setattr(oss.os, "read", lambda fd, n: b"")

        backend = _FakeBackend()
        with pytest.raises(oss.WinApiError) as exc:
            backend.run("echo hi", cwd=tmp)

        assert "fail-closed" in str(exc.value)
        assert spawn_calls == [424242], "只能有一次受限令牌尝试,不得回退原始令牌"
