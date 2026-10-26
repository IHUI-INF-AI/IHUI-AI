# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""P0-2 生产接线验收(2026-10-26):污点闸门 + 凭据保险库三连 + 单例接线。

对照验收标准:
- 污点会话出网在 auto(acceptEdits)档被抬升为需批 → ``taint_gate_requires_approval``
- 凭据保险库三连:resolve / redact / filter_env → 经 ``get_session_vault()`` 与
  ``_build_subprocess_env``(run_command 子进程环境过滤)
- 会话污点单例 + 标记 → ``get_session_taint_store().mark``(记忆注入 / 凭据入参)
"""

import asyncio

from app.core.session_taint import SessionTaint, TaintSource
from app.services import mcp_server as mcp
from app.services import session_security as ss
from app.services.session_security import (
    EGRESS_UNKNOWN,
    args_contain_resolvable_vault,
    get_session_taint_store,
    get_session_vault,
    get_vault_store,
    taint_gate_requires_approval,
    tool_egress_target,
)
from app.services.mcp_server import _build_subprocess_env


# ── 单例接线 ────────────────────────────────────────────────────────────
def test_singletons_exist_and_shared():
    assert isinstance(get_session_taint_store(), ss.SessionTaintStore)
    assert isinstance(get_vault_store(), ss.VaultStore)
    assert isinstance(get_session_vault(), ss.SessionVault)
    # 单例身份稳定(同一 worker 内跨调用共享)
    assert get_session_taint_store() is get_session_taint_store()
    assert get_vault_store() is get_vault_store()


# ── 污点闸门纯函数 ──────────────────────────────────────────────────────
def test_tool_egress_target_run_command_url():
    assert tool_egress_target("run_command", {"command": "curl https://x.com/a"}) == "https://x.com/a"
    # 无 URL 的 run_command ⇒ 出网但目标未知(可被污点闸门拦)
    assert tool_egress_target("run_command", {"command": "git status"}) == EGRESS_UNKNOWN
    # 非出网工具 ⇒ None
    assert tool_egress_target("edit_file", {}) is None


def test_tool_egress_target_open_world():
    assert (
        tool_egress_target("mcp_web", {}, mcp_annotations={"open_world_hint": True})
        == EGRESS_UNKNOWN
    )
    assert tool_egress_target("mcp_web", {}, mcp_annotations={"open_world_hint": False}) is None
    assert tool_egress_target("mcp_web", {}) is None


def test_taint_gate_untainted_never_blocks():
    t = SessionTaint()
    assert taint_gate_requires_approval(t, "run_command", {"command": "curl https://x.com"}) is False
    assert taint_gate_requires_approval(t, "run_command", {"command": "git status"}) is False


def test_taint_gate_tainted_egress_blocked():
    t = SessionTaint(tainted=True, sources={TaintSource.PRIVATE_DATA})
    # 带 URL 的出网 ⇒ 拦
    assert taint_gate_requires_approval(t, "run_command", {"command": "curl https://x.com"}) is True
    # 无 URL 的 run_command ⇒ 出网未知 ⇒ 拦
    assert taint_gate_requires_approval(t, "run_command", {"command": "git status"}) is True
    # open_world MCP ⇒ 拦
    assert (
        taint_gate_requires_approval(t, "mcp_web", {}, mcp_annotations={"open_world_hint": True})
        is True
    )
    # network 双轴 ⇒ 拦
    assert taint_gate_requires_approval(t, "mcp_web", {}, network_axis=True) is True
    # 非出网工具 ⇒ 不拦
    assert taint_gate_requires_approval(t, "edit_file", {}) is False


def test_taint_gate_allowlist_bypass():
    t = SessionTaint(
        tainted=True, sources={TaintSource.PRIVATE_DATA}, egress_allowlist={".x.com"}
    )
    # 命中 allowlist ⇒ 不拦
    assert (
        taint_gate_requires_approval(t, "run_command", {"command": "curl https://x.com/a"}) is False
    )
    # 未命中 ⇒ 拦
    assert taint_gate_requires_approval(t, "run_command", {"command": "curl https://y.com"}) is True


# ── 会话污点标记(记忆注入 / 凭据入参) ───────────────────────────────────
def test_mark_private_data_and_vault():
    store = get_session_taint_store()
    sid = "test-session-mark-1"
    store.mark(sid, TaintSource.PRIVATE_DATA)
    assert store.get(sid).tainted is True
    store.mark(sid, TaintSource.VAULT)
    t = store.get(sid)
    assert t.tainted is True
    assert TaintSource.VAULT in t.sources


def test_args_contain_resolvable_vault():
    # 未注入凭据 ⇒ 空
    assert args_contain_resolvable_vault({"command": "echo {{vault:NOPE}}"}) == []
    # 注入凭据后 ⇒ 命中
    get_vault_store().put("API_KEY", "sk-secret-123", env_key="API_KEY")
    assert args_contain_resolvable_vault({"command": "echo {{vault:API_KEY}}"}) == ["API_KEY"]
    assert args_contain_resolvable_vault({"foo": "x {{vault:API_KEY}} y"}) == ["API_KEY"]


# ── 凭据保险库三连(生产接线) ────────────────────────────────────────────
def test_vault_resolve_redact_filter_env():
    vault = get_session_vault()
    get_vault_store().put("DB_PWD", "p@ssw0rd!", env_key="DB_PWD")
    # resolve:占位符 → 真值
    resolved = vault.resolve("connect --pwd {{vault:DB_PWD}}")
    assert resolved == "connect --pwd p@ssw0rd!"
    # redact:真值 → [REDACTED:NAME]
    assert vault.redact("the pwd is p@ssw0rd! ok") == "the pwd is [REDACTED:DB_PWD] ok"
    # filter_env:剔除凭据形环境变量
    env = {"PATH": "/bin", "DB_PWD": "p@ssw0rd!", "USER": "lee"}
    filtered = vault.filter_env(env)
    assert "DB_PWD" not in filtered
    assert filtered["PATH"] == "/bin"
    assert filtered["USER"] == "lee"


def test_build_subprocess_env_filters_vault():
    # _build_subprocess_env 经单例过滤凭据形变量(绝不外带)
    get_vault_store().put("TOKEN_X", "tk-xyz", env_key="TOKEN_X")
    user_env = {"TOKEN_X": "tk-xyz", "MY_VAR": "hello", "PATH": "/evil"}
    built = _build_subprocess_env(user_env)
    assert "TOKEN_X" not in built, "凭据形环境变量不得进入子进程环境"
    assert built.get("MY_VAR") == "hello"
    assert built.get("PATH") != "/evil", "PATH 不被用户 env 覆盖"


def test_run_command_vault_resolve_redact_roundtrip(monkeypatch):
    """run_command 真正接线:占位符解析 + 输出脱敏(真值绝不回传)。"""

    async def _fake_cfg(*_a, **_k):
        class _Cfg:
            exec_policy_mode = "off"

        return _Cfg()

    monkeypatch.setattr(mcp, "resolve_security_config", _fake_cfg)
    monkeypatch.setattr(mcp, "_is_dangerous_command_blocked", lambda: False)

    get_vault_store().put("SECRET_A", "SECRETVAL_A", env_key="SECRET_A")

    res = asyncio.run(mcp._tool_run_command({"command": "echo {{vault:SECRET_A}}"}))
    assert res.get("ok") is True, res
    out = res.get("stdout", "")
    assert "SECRETVAL_A" not in out, "输出不得含凭据真值"
    assert "[REDACTED:SECRET_A]" in out, out
