# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""号池 / 直连双引擎所有权边界守门(2026-11-24 立)。

根因:model_sync(本服务,物理删除)与 apps/api relay-models-sync(软下架/复活)
都按 provider_code 命中同一 ai_model_config 父行。交集三家 qoder/minimax/doubao
若无仲裁,本服务每轮会把 relay 自动登记的模型物理删掉、并覆盖其私有公开状态,
导致「自动上架看似配了却不生效」。本文件钉死:

1. Python 跳过名单 RELAY_OWNED_PROVIDER_CODES 与 TS RELAY_PROVIDERS 严格一致
   (跨语言守门:任一边加新平台而对边没跟,立即红);
2. 号池平台在选取层被跳过、单厂同步入口被拒绝(反向用例:改绿不算数);
3. 直连厂商不受影响(判据不得反向误杀)。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest

from app.services.model_sync import (
    RELAY_OWNED_PROVIDER_CODES,
    ModelSyncService,
    is_relay_owned_provider,
)

_API_ROOT = Path(__file__).resolve().parents[2] / "api" / "src" / "services"
_TS_FORMAT_FILE = _API_ROOT / "relay-account-format.ts"


def _ts_relay_providers() -> set[str]:
    """从 TS 单一真相源解析 RELAY_PROVIDERS 数组字面量(零 IO 依赖,只读文本)。"""
    text = _TS_FORMAT_FILE.read_text(encoding="utf-8")
    match = re.search(r"export\s+const\s+RELAY_PROVIDERS\s*=\s*\[(.*?)\]", text, re.DOTALL)
    assert match, f"未能在 {_TS_FORMAT_FILE} 找到 RELAY_PROVIDERS 数组"
    return set(re.findall(r"'([a-z0-9_]+)'", match.group(1)))


class TestRelayOwnershipParity:
    """跨语言一致性:两份名单必须逐字相等,漂移即红。"""

    def test_python_set_matches_ts_single_source(self) -> None:
        assert RELAY_OWNED_PROVIDER_CODES == _ts_relay_providers(), (
            "Python RELAY_OWNED_PROVIDER_CODES 与 TS RELAY_PROVIDERS 不一致 —— "
            "新增号池平台必须两边同步,否则该平台会被 model_sync 物理删除 relay 行"
        )

    def test_intersection_with_python_registry_covered(self) -> None:
        """Python registry 里真实存在的三家交集必须都被跳过(证明守门非空的反例锁)。"""
        from app.services.free_provider_registry import free_provider_registry

        registry_codes = {p.provider_code for p in free_provider_registry.list_all()}
        intersection = registry_codes & RELAY_OWNED_PROVIDER_CODES
        assert {"qoder", "minimax", "doubao"}.issubset(intersection), (
            f"预期 qoder/minimax/doubao 同时在两边 registry,实际交集={sorted(intersection)}"
        )


class TestRelayOwnedSkipBehavior:
    """反向用例:判据真的会跳过,不是只写了个常量。"""

    def test_predicate_matrix(self) -> None:
        for code in ("qoder", "minimax", "doubao", "trae", "cursor"):
            assert is_relay_owned_provider(code) is True, code
        for code in ("openai", "anthropic", "stepfun", "token6688", "huggingface"):
            assert is_relay_owned_provider(code) is False, code

    def test_selection_source_has_skip_guard(self) -> None:
        import inspect

        src = inspect.getsource(ModelSyncService._get_configured_providers)
        assert "is_relay_owned_provider(code)" in src

    @pytest.mark.asyncio
    async def test_relay_provider_dropped_from_selection(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """即便配了真实 key,qoder 也不得进入本服务的同步清单。"""
        import app.services.model_sync as ms_mod

        class _Cfg:
            api_key = "sk-real-qoder-key"
            api_base = "https://api.qoder.ai/v1"

        class _Settings:
            def get_provider_config(self, name: str) -> Any:
                return _Cfg()

        monkeypatch.setattr(ms_mod, "settings", _Settings())

        async def _no_db_key(self: ModelSyncService, code: str) -> str | None:
            return None

        monkeypatch.setattr(ModelSyncService, "_db_api_key_for", _no_db_key)
        result = await ModelSyncService()._get_configured_providers()
        codes = {c for c, _b, _k in result}
        assert "qoder" not in codes
        assert "minimax" not in codes
        assert "doubao" not in codes

    @pytest.mark.asyncio
    async def test_single_provider_sync_rejects_relay_code(self) -> None:
        """手动单厂同步号池平台必须 ValueError,且不得把 is_syncing 卡在 True。"""
        svc = ModelSyncService()
        with pytest.raises(ValueError, match="号池反代平台"):
            await svc.sync_single_provider("qoder")
        assert svc.get_status()["is_syncing"] is False
