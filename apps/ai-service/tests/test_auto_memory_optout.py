# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""auto_memory_optout:「不自动写入长期记忆」读取闸(2026-10-03 合规整改)。

覆盖:
1. resolve()  —— 三态判定链纯函数(缺省 / 显式 true / 显式 false、新键 vs 旧键
   优先级、per-user vs 全局 env)
2. is_auto_memory_enabled() —— 读库路径(含降级方向)
3. TestUserIdUnavailable —— userId 拿不到时的降级(必须为"按默认开启")
4. TestExtractionGates —— 三个提取入口的闸门是否真的**在 LLM 调用之前**短路
   (不是"照常提取但不入库")

为什么第 4 组是本文件的核心:前 3 组只证明"判定算得对",第 4 组才证明
"开关真的接到了提取入口上"。一个算对但接错位置的闸门 == 假开关。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import auto_memory_optout as amo
from app.services.auto_memory_optout import (
    ENV_GLOBAL_DEFAULT,
    is_auto_memory_enabled,
    resolve,
)

# =============================================================================
# helpers
# =============================================================================


class FakeRecord:
    """模拟 asyncpg.Record。"""

    def __init__(self, value: str | None) -> None:
        self._value = value

    def __getitem__(self, key: str):
        assert key == "value"
        return self._value


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """每个用例都从"env 未设置"出发,避免开发者本机的 IHUI_AUTO_MEMORY 污染。"""
    monkeypatch.delenv(ENV_GLOBAL_DEFAULT, raising=False)


def _patch_stub(monkeypatch, value: bool) -> None:
    """置 LLMGateway._is_stub_mode。

    必须 patch 在 `app.core.llm_gateway.LLMGateway` 上(定义处):`consolidate`
    里是函数内 `from ..core.llm_gateway import LLMGateway` 现取,patch
    `app.services.memory_service.LLMGateway` 会报 "not a package"。
    """
    from app.core.llm_gateway import LLMGateway

    monkeypatch.setattr(LLMGateway, "_is_stub_mode", lambda: value)


def _pool_returning(opt_out: str | None, legacy: str | None) -> MagicMock:
    """构造一个按 key 返回不同行的 mock pool。"""
    conn = MagicMock()

    async def _fetchrow(_sql, _uid, _group, key, *args):
        if key == amo.KEY_AUTO_MEMORY_OPT_OUT:
            return FakeRecord(opt_out)
        if key == amo.KEY_AUTO_MEMORY_LEGACY:
            return FakeRecord(legacy)
        raise AssertionError(f"意外查询的 key: {key}")

    conn.fetchrow = AsyncMock(side_effect=_fetchrow)
    pool = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    return pool


# =============================================================================
# 1. resolve():三态判定链
# =============================================================================


class TestResolveNewKey:
    """新键 autoMemoryOptOut(opt-out 语义:'true' = 已关闭)。"""

    def test_default_absent_all(self):
        """两个键都无记录 + 无全局覆盖 → 开启(= 改动前行为)。"""
        assert resolve(opt_out_value=None, legacy_value=None) == (True, "global_default")

    def test_explicit_true_means_opted_out(self):
        """隐私页开关打开('true')→ 关闭。"""
        assert resolve(opt_out_value="true", legacy_value=None) == (False, "opt_out_key")

    def test_explicit_true_case_insensitive(self):
        """'TRUE' / 'True' 同样识别(前端写的是 String(boolean),但 DB 可能被手改)。"""
        for raw in ("TRUE", "True", " true "):
            enabled, reason = resolve(opt_out_value=raw, legacy_value=None)
            assert enabled is False, raw
            assert reason == "opt_out_key"

    def test_explicit_false_means_enabled(self):
        """'false' = 用户在隐私页明确选了"不阻止" → 开启。"""
        assert resolve(opt_out_value="false", legacy_value=None) == (True, "opt_out_key")


class TestResolveKeyPrecedence:
    """新键 vs 旧键:两者极性相反,优先级必须钉死。"""

    def test_new_key_beats_legacy_opt_out(self):
        """新键 'false'(开) + 旧键 'false'(关) → 开启。

        这是"用户在隐私页重新打开"的场景。若这里判成关闭,用户在新界面
        做了决定却被更早的旧键悄悄压回去 —— 界面会显示"已打开"而实际没开。
        """
        enabled, reason = resolve(opt_out_value="false", legacy_value="false")
        assert enabled is True
        assert reason == "opt_out_key"

    def test_new_key_beats_legacy_opt_in(self):
        """新键 'true'(关) + 旧键 'true'(开) → 关闭(关的优先级更高)。"""
        enabled, reason = resolve(opt_out_value="true", legacy_value="true")
        assert enabled is False
        assert reason == "opt_out_key"

    def test_legacy_respected_when_new_key_absent(self):
        """新键无记录时旧键仍生效 —— 不让已关过记忆的用户被这次上线反向恢复。"""
        assert resolve(opt_out_value=None, legacy_value="false") == (False, "legacy_key")

    def test_legacy_true_means_enabled(self):
        """旧键 opt-in 语义:'true' → 开启。"""
        assert resolve(opt_out_value=None, legacy_value="true") == (True, "legacy_key")


class TestResolveGlobalDefault:
    """全局默认(env)与 per-user 的优先级。"""

    def test_global_env_off_applies_when_no_per_user_record(self, monkeypatch):
        """无 per-user 记录 + env 关闭 → 关闭。"""
        monkeypatch.setenv(ENV_GLOBAL_DEFAULT, "0")
        assert resolve(opt_out_value=None, legacy_value=None) == (False, "global_default")

    @pytest.mark.parametrize("raw", ["0", "false", "off", "OFF", " False "])
    def test_global_env_falsey_literals(self, monkeypatch, raw):
        """只有明确的否定字面量才关闭(与本仓其它 env 开关同一口径)。"""
        monkeypatch.setenv(ENV_GLOBAL_DEFAULT, raw)
        assert resolve(opt_out_value=None, legacy_value=None)[0] is False

    @pytest.mark.parametrize("raw", ["1", "true", "on", "yes", "", "anything"])
    def test_global_env_other_values_stay_enabled(self, monkeypatch, raw):
        """其余值(含空串)一律按默认开启 —— 开关上线不改变任何人现状。"""
        monkeypatch.setenv(ENV_GLOBAL_DEFAULT, raw)
        assert resolve(opt_out_value=None, legacy_value=None)[0] is True

    def test_per_user_opt_out_beats_global_on(self, monkeypatch):
        """全局开着,用户显式关闭 → 关闭(per-user 压过全局)。"""
        monkeypatch.setenv(ENV_GLOBAL_DEFAULT, "1")
        assert resolve(opt_out_value="true", legacy_value=None)[0] is False

    def test_per_user_opt_in_beats_global_off(self, monkeypatch):
        """全局关着,用户显式选择开启 → 开启(per-user 压过全局,双向)。"""
        monkeypatch.setenv(ENV_GLOBAL_DEFAULT, "0")
        assert resolve(opt_out_value="false", legacy_value=None)[0] is True

    def test_legacy_beats_global(self, monkeypatch):
        """旧键也压过全局默认。"""
        monkeypatch.setenv(ENV_GLOBAL_DEFAULT, "1")
        assert resolve(opt_out_value=None, legacy_value="false")[0] is False


# =============================================================================
# 2. is_auto_memory_enabled():读库路径
# =============================================================================


class TestIsAutoMemoryEnabled:
    async def test_default_true_when_no_rows(self):
        """两键都无记录 → 开启。"""
        with patch("app.services.memory_service._get_pool", return_value=_pool_returning(None, None)):
            assert await is_auto_memory_enabled("u1") is True

    async def test_false_when_opt_out_true(self):
        """隐私页开关打开 → 关闭。"""
        with patch("app.services.memory_service._get_pool", return_value=_pool_returning("true", None)):
            assert await is_auto_memory_enabled("u1") is False

    async def test_legacy_false_still_honored(self):
        """仅旧键 'false' → 关闭(向后兼容)。"""
        with patch("app.services.memory_service._get_pool", return_value=_pool_returning(None, "false")):
            assert await is_auto_memory_enabled("u1") is False

    async def test_degrades_to_enabled_on_db_error(self):
        """读库抛错 → 降级为开启(= 现状行为),不阻断记忆提取。

        降级方向与本仓 fail-closed 闸门相反,理由见 auto_memory_optout 模块
        docstring。此处钉住它,免得被后人"统一口径"改反。
        """
        boom = MagicMock()
        boom.acquire = MagicMock(side_effect=RuntimeError("db down"))
        with patch("app.services.memory_service._get_pool", return_value=boom):
            assert await is_auto_memory_enabled("u1") is True

    async def test_queries_both_keys_in_privacy_group(self):
        """两次查询都带 group='privacy'(该列在表里叫 group,不是 category)。"""
        pool = _pool_returning("true", "false")
        with patch("app.services.memory_service._get_pool", return_value=pool):
            await is_auto_memory_enabled("u1")
        conn = pool.acquire.return_value.__aenter__.return_value
        assert conn.fetchrow.await_count == 2
        for call in conn.fetchrow.await_args_list:
            args = call.args
            assert args[1] == "u1"  # user_id
            assert args[2] == "privacy"  # group
            assert args[3] in (amo.KEY_AUTO_MEMORY_OPT_OUT, amo.KEY_AUTO_MEMORY_LEGACY)


# =============================================================================
# 3. userId 拿不到 ⇒ 降级为"按默认开启"
# =============================================================================


class TestUserIdUnavailable:
    """用户要求:拿不到 userId 的路径必须明确降级为默认开启,且不查库。"""

    @pytest.mark.parametrize("bad", [None, "", "   "])
    async def test_blank_user_id_short_circuits(self, bad):
        """空/空白 userId → 开启,且**完全不查库**(连降级都不必)。"""
        pool = MagicMock()
        with patch("app.services.memory_service._get_pool", return_value=pool) as get_pool:
            assert await is_auto_memory_enabled(bad) is True
        get_pool.assert_not_called()

    async def test_non_uuid_user_id_degrades_to_enabled(self):
        """非 UUID 形态的 userId(如 'alice')→ asyncpg cast 失败 → 降级开启。

        这条同时是"哪些路径拿不到属主"的真实样本:
        `routers/agent_memory.py` 的 uid 来自 JWT,形态受控;但
        `session_handoff` / 内部调用可能传入非 UUID,那些路径按现状开启。
        """
        with patch(
            "app.services.memory_service._get_pool",
            side_effect=RuntimeError("invalid input syntax for type uuid"),
        ):
            assert await is_auto_memory_enabled("alice") is True


# =============================================================================
# 4. 提取入口的闸门位置(核心:证明不是假开关)
# =============================================================================


class TestConsolidateGate:
    """memory_service.consolidate —— LLM 提炼 semantic。"""

    @pytest.fixture
    def svc(self):
        from app.services.memory_service import MemoryService

        gw = AsyncMock()
        gw.complete = AsyncMock(return_value={"content": "用户偏好 Python", "model": "m"})
        return MemoryService(gateway=gw)

    async def test_disabled_skips_before_llm(self, svc, monkeypatch):
        """关闭时:不调 LLM、不写库。

        stub 判定在隐私闸门**之前**(consolidate 既有顺序,未改动),故先把它
        置 False,否则本用例会先命中 stub_mode 而测不到闸门。
        """
        _patch_stub(monkeypatch, False)
        monkeypatch.setattr(
            type(svc), "_is_auto_memory_enabled", AsyncMock(return_value=False)
        )
        result = await svc.consolidate("u1", [{"role": "user", "content": "hi"}])
        assert result == {"status": "skipped", "reason": "user_disabled"}
        svc._gateway.complete.assert_not_called()

    async def test_enabled_still_extracts(self, svc, monkeypatch):
        """开启时:行为与改动前逐字相同(LLM 被调、返回 ok)。"""
        _patch_stub(monkeypatch, False)
        monkeypatch.setattr(
            type(svc), "_is_auto_memory_enabled", AsyncMock(return_value=True)
        )
        svc.add_semantic = AsyncMock(return_value={"id": "sem-1"})
        result = await svc.consolidate("u1", [{"role": "user", "content": "我用 Python"}])
        assert result["status"] == "ok"
        svc._gateway.complete.assert_awaited_once()


class TestSaveInsightsGate:
    """memory_service.save_insights_from_conversation —— LLM 提炼三类记忆。

    这条路径在本次整改前**完全没有闸门**,是"关掉开关仍然落库"的直接原因。
    """

    @pytest.fixture
    def svc(self):
        from app.services.memory_service import MemoryService

        gw = AsyncMock()
        gw.complete = AsyncMock(return_value={"content": '[{"type":"preference","text":"x"}]'})
        return MemoryService(gateway=gw)

    async def test_disabled_skips_before_llm(self, svc, monkeypatch):
        """关闭时:不调 LLM、不发任何 HTTP。"""
        monkeypatch.setattr(
            type(svc), "_is_auto_memory_enabled", AsyncMock(return_value=False)
        )
        await svc.save_insights_from_conversation("u1", [{"role": "user", "content": "hi"}])
        svc._gateway.complete.assert_not_called()

    async def test_enabled_proceeds(self, svc, monkeypatch):
        """开启时:LLM 被调(后续 HTTP 由 httpx 层负责,此处只验闸门放行)。"""
        monkeypatch.setattr(
            type(svc), "_is_auto_memory_enabled", AsyncMock(return_value=True)
        )
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        client_cm = MagicMock()
        client_cm.__aenter__ = AsyncMock(return_value=MagicMock(post=AsyncMock(return_value=resp)))
        with patch("httpx.AsyncClient", return_value=client_cm):
            await svc.save_insights_from_conversation(
                "u1", [{"role": "user", "content": "我喜欢 Python"}]
            )
        svc._gateway.complete.assert_awaited_once()


class TestAddWithExtractionGate:
    """memory.MemorySystem.add_with_extraction —— MemoryExtractor(LLM)+ 向量库 + 画像。

    闸门必须在第 1 步(原始消息落 MemoryStore)之后、提取之前:
    拦掉第 1 步会连带改掉对话回放行为,那是另一个保留期链路的职责。
    """

    @pytest.fixture
    def ms(self):
        from app.services import memory as memory_mod

        m = memory_mod.MemorySystem()
        m._store = MagicMock()
        m._store.add = AsyncMock()
        m._client = MagicMock()
        m._client.get_entries = AsyncMock(return_value=[])
        m._client.add_entry = AsyncMock()
        return m

    async def test_disabled_skips_extraction_but_keeps_message_write(self, ms, monkeypatch):
        """关闭时:零 LLM、零向量写入,但第 1 步的原始消息仍落库。"""
        # `_ensure_services()` 在闸门之前就装配好了提取器(它是纯本地 lazy import,
        # 不发任何请求),所以这里断言的是"提取器没被**调用**",不是"_extractor 是 None"。
        extractor = MagicMock()
        extractor.extract = AsyncMock(return_value={"extracted": [{"text": "x", "type": "fact"}]})
        ms._extractor = extractor
        with patch(
            "app.services.auto_memory_optout.is_auto_memory_enabled",
            AsyncMock(return_value=False),
        ):
            result = await ms.add_with_extraction(
                "u1", [{"role": "user", "content": "hi"}], persist_messages=True
            )
        assert result["count"] == 0
        assert result["skipped"] == "user_disabled"
        extractor.extract.assert_not_called()
        ms._client.add_entry.assert_not_called()
        # 第 1 步照旧:原始消息仍写入 MemoryStore
        ms._store.add.assert_awaited()

    async def test_enabled_runs_extraction(self, ms, monkeypatch):
        """开启时:提取器被调用,行为与改动前一致。"""
        extractor = MagicMock()
        extractor.extract = AsyncMock(return_value={"extracted": []})
        ms._extractor = extractor
        ms._vector_store = MagicMock()
        ms._profile_builder = MagicMock()
        with patch(
            "app.services.auto_memory_optout.is_auto_memory_enabled",
            AsyncMock(return_value=True),
        ):
            result = await ms.add_with_extraction(
                "u1", [{"role": "user", "content": "hi"}], persist_messages=False
            )
        extractor.extract.assert_awaited_once()
        assert result["count"] == 0  # extracted 为空
        assert "skipped" not in result


class TestLongtermExtractEndpointGate:
    """routers/agent_memory.extract_import —— 五类长期记忆条目的唯一自动入口。"""

    @pytest.fixture
    def api(self, monkeypatch, tmp_path):
        from fastapi import FastAPI

        from app.core.jwt_auth import get_current_user_id
        from app.routers import agent_memory as am
        from app.services.agent_longterm_memory import AgentLongTermMemory

        mem = AgentLongTermMemory(file_path=tmp_path / "mem.json")
        monkeypatch.setattr(am, "agent_longterm_memory", mem)
        app = FastAPI()
        app.include_router(am.router, prefix="/api")
        app.dependency_overrides[get_current_user_id] = lambda: "alice"
        return app, mem

    @staticmethod
    def _messages() -> list[dict[str, str]]:
        return [
            {"role": "user", "content": "以后统一用单引号，不要再混用双引号"},
            {"role": "assistant", "content": "好的，今后全项目统一单引号。"},
        ]

    async def test_disabled_writes_nothing(self, api, monkeypatch):
        """关闭时:不产出候选、不落盘,响应带 skipped 标记。"""
        from httpx import ASGITransport, AsyncClient

        app, mem = api
        with patch(
            "app.services.auto_memory_optout.is_auto_memory_enabled",
            AsyncMock(return_value=False),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://t"
            ) as c:
                res = await c.post(
                    "/api/longterm-memory/extract",
                    json={"messages": self._messages(), "source_session_id": "s1"},
                )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["imported"] == 0
        assert data["candidates"] == []
        assert data["skipped"] == "user_disabled"
        # 存储层确实一条都没写
        assert mem.search("alice", limit=100) == []

    async def test_enabled_writes_as_before(self, api, monkeypatch):
        """开启时:与改动前行为一致(导入候选、列表可见)。"""
        from httpx import ASGITransport, AsyncClient

        app, mem = api
        with patch(
            "app.services.auto_memory_optout.is_auto_memory_enabled",
            AsyncMock(return_value=True),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://t"
            ) as c:
                res = await c.post(
                    "/api/longterm-memory/extract",
                    json={"messages": self._messages(), "source_session_id": "s1"},
                )
                listing = (await c.get("/api/longterm-memory/entries")).json()["data"]
        assert res.status_code == 200
        assert res.json()["data"]["imported"] >= 1
        assert listing["total"] >= 1

    async def test_manual_create_not_gated(self, api, monkeypatch):
        """手工新增单条**不**受此闸门约束:那是用户主动录入,不是"自动提炼"。"""
        from httpx import ASGITransport, AsyncClient

        app, mem = api
        with patch(
            "app.services.auto_memory_optout.is_auto_memory_enabled",
            AsyncMock(return_value=False),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://t"
            ) as c:
                res = await c.post(
                    "/api/longterm-memory/entries",
                    json={"type": "goal", "content": "把登录页重写一遍"},
                )
        assert res.status_code == 200
        assert mem.search("alice", limit=10)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
