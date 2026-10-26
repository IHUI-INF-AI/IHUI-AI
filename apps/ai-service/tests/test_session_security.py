# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""会话级安全门单测(P0-2 生产接线,2026-10-26)。"""

from app.core.session_taint import TaintSource
from app.core.vault import VaultStore
from app.services.session_security import SessionTaintStore, SessionVault


def _store(redis: object | None = None, memory: "dict | None" = None) -> SessionTaintStore:
    return SessionTaintStore(redis=redis, memory=memory if memory is not None else {})


def test_memory_default_clean() -> None:
    s = _store()
    assert not s.get("sess-1").tainted


def test_mark_persists_in_memory() -> None:
    s = _store()
    t = s.mark("sess-1", TaintSource.SECRET)
    assert t.tainted
    assert s.get("sess-1").tainted
    assert TaintSource.SECRET in s.get("sess-1").sources


def test_allowlist_egress_decision() -> None:
    s = _store()
    s.mark("sess-1", TaintSource.PRIVATE_DATA)
    s.set_allowlist("sess-1", [".github.com"])
    assert not s.requires_egress_approval("sess-1", "https://api.github.com/x")
    assert s.requires_egress_approval("sess-1", "https://evil.example.com/x")


def test_redis_backend_roundtrip() -> None:
    # duck-typed redis 模拟(不依赖 redis 包,覆盖 hgetall/hset/expire 映射逻辑)
    class FakeRedis:
        def __init__(self) -> None:
            self.data: dict[str, dict[str, str]] = {}

        def hgetall(self, k: str) -> dict[str, str]:
            return self.data.get(k, {})

        def hset(self, k: str, mapping: dict[str, str]) -> None:
            merged = dict(self.data.get(k, {}))
            merged.update(mapping)
            self.data[k] = merged

        def expire(self, k: str, t: int) -> None:
            pass

    r = FakeRedis()
    s = _store(redis=r)
    s.mark("sess-r", TaintSource.VAULT)
    assert s.get("sess-r").tainted
    assert TaintSource.VAULT in s.get("sess-r").sources
    assert s.requires_egress_approval("sess-r", "https://evil.example.com/x")


def test_session_vault_apply() -> None:
    vs = VaultStore()
    vs.put("OPENAI_KEY", "sk-REAL", env_key="OPENAI_API_KEY")
    sv = SessionVault(vs)
    assert sv.resolve("k={{vault:OPENAI_KEY}}") == "k=sk-REAL"
    assert "sk-REAL" not in sv.mask("has sk-REAL")
    assert sv.redact("got sk-REAL") == "got [REDACTED:OPENAI_KEY]"
    env = {"OPENAI_API_KEY": "sk-REAL", "PATH": "/x"}
    out = sv.filter_env(env)
    assert "OPENAI_API_KEY" not in out and out["PATH"] == "/x"
