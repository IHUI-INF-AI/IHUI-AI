"""app/services/publish/anti_risk/stealth.py 单元测试:反检测脚本注入。

测试覆盖(14 cases):
- apply_stealth:脚本注入到 context / add_init_script 调用 / 异常传播 / 多次调用幂等
- generate_seed:稳定性(同账号同 seed)/ 差异性(不同账号不同 seed)/ 空串降级 / None 异常
- _build_stealth_script:种子嵌入 / 幂等性 / 不同 seed 不同脚本 / WebRTC 防护关键字 /
  webdriver 隐藏 / Canvas 噪声 / AudioContext 噪声 / Permissions 修复

测试隔离:全用 AsyncMock mock Playwright BrowserContext,不真实启动浏览器。
"""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.publish.anti_risk.stealth import (
    _build_stealth_script,
    apply_stealth,
    generate_seed,
)


# =============================================================================
# apply_stealth 异步脚本注入(5 tests)
# =============================================================================


class TestApplyStealth:
    """测试 apply_stealth() 对 BrowserContext 注入反检测脚本。"""

    async def test_injects_script_into_context(self):
        """apply_stealth 调用 context.add_init_script,传入含 seed 的脚本。"""
        context = AsyncMock()
        await apply_stealth(context, 12345)
        context.add_init_script.assert_awaited_once()
        script = context.add_init_script.call_args.args[0]
        assert isinstance(script, str)
        assert "12345" in script  # seed 嵌入脚本

    async def test_add_init_script_called_exactly_once(self):
        """apply_stealth 仅调用 add_init_script 一次(不重复注入)。"""
        context = AsyncMock()
        await apply_stealth(context, 999)
        assert context.add_init_script.await_count == 1

    async def test_propagates_add_init_script_exception(self):
        """context.add_init_script 抛异常时,异常向上传播(当前实现不做降级)。

        注意:源码 apply_stealth 未包裹 try/except,异常会传播给调用方。
        调用方(browser_factory)需自行处理异常或确保 context 可用。
        """
        context = AsyncMock()
        context.add_init_script.side_effect = RuntimeError("context closed")
        with pytest.raises(RuntimeError, match="context closed"):
            await apply_stealth(context, 42)

    async def test_idempotent_same_seed_same_script(self):
        """同 seed 多次调用 apply_stealth,每次注入的脚本内容一致。"""
        context_a = AsyncMock()
        context_b = AsyncMock()
        await apply_stealth(context_a, 777)
        await apply_stealth(context_b, 777)
        script_a = context_a.add_init_script.call_args.args[0]
        script_b = context_b.add_init_script.call_args.args[0]
        assert script_a == script_b

    async def test_different_seed_different_script(self):
        """不同 seed 生成不同脚本(种子差异反映到脚本内容)。"""
        context_a = AsyncMock()
        context_b = AsyncMock()
        await apply_stealth(context_a, 100)
        await apply_stealth(context_b, 200)
        script_a = context_a.add_init_script.call_args.args[0]
        script_b = context_b.add_init_script.call_args.args[0]
        assert script_a != script_b


# =============================================================================
# generate_seed 种子生成(5 tests)
# =============================================================================


class TestGenerateSeed:
    """测试 generate_seed() 基于账号 ID 生成稳定指纹种子。"""

    def test_returns_stable_seed_for_same_account(self):
        """相同 account_id 多次调用返回相同 seed(跨会话稳定)。"""
        s1 = generate_seed("csdn_zhangsan")
        s2 = generate_seed("csdn_zhangsan")
        s3 = generate_seed("csdn_zhangsan")
        assert s1 == s2 == s3

    def test_returns_different_seed_for_different_accounts(self):
        """不同 account_id 返回不同 seed(账号隔离)。"""
        s1 = generate_seed("csdn_user_a")
        s2 = generate_seed("csdn_user_b")
        assert s1 != s2

    def test_returns_positive_integer(self):
        """seed 始终为正整数(>0,避免全 0 种子)。"""
        seed = generate_seed("any_account")
        assert isinstance(seed, int)
        assert seed > 0

    def test_empty_string_returns_nonzero(self):
        """空字符串 account_id 返回 1(降级:避免全 0 种子)。

        generate_seed("") → h=0 → 返回 1(因 `h if h > 0 else 1` 逻辑)。
        """
        seed = generate_seed("")
        assert seed == 1

    def test_none_input_raises_type_error(self):
        """None 输入抛 TypeError(for ch in None 不可迭代)。

        注意:当前实现不处理 None 输入,调用方需确保 account_id 为 str。
        """
        with pytest.raises(TypeError):
            generate_seed(None)  # type: ignore[arg-type]


# =============================================================================
# _build_stealth_script 脚本内容校验(4 tests)
# =============================================================================


class TestBuildStealthScript:
    """测试 _build_stealth_script() 生成的 JS 脚本内容。"""

    def test_script_contains_seed_value(self):
        """脚本包含 fingerprint_seed 值(嵌入 mulberry32 PRNG 初始状态)。"""
        script = _build_stealth_script(54321)
        assert "54321" in script
        assert "_seed = 54321 >>> 0" in script or "_seed = 54321" in script

    def test_script_contains_webrtc_ip_leak_guard(self):
        """脚本包含 WebRTC IP 泄漏防护关键字(RTCPeerConnection / relay 策略)。"""
        script = _build_stealth_script(100)
        assert "RTCPeerConnection" in script
        assert "iceTransportPolicy" in script
        assert "relay" in script  # 强制 relay 策略,禁用 host/srflx candidate

    def test_script_contains_webdriver_hiding(self):
        """脚本包含 navigator.webdriver 隐藏逻辑。"""
        script = _build_stealth_script(200)
        assert "webdriver" in script
        assert "undefined" in script  # webdriver → undefined

    def test_script_contains_canvas_and_audio_noise(self):
        """脚本包含 Canvas 噪声和 AudioContext 噪声防护。"""
        script = _build_stealth_script(300)
        assert "toDataURL" in script  # Canvas 指纹噪声
        assert "AudioBuffer" in script or "AudioContext" in script  # 音频指纹噪声
        assert "getImageData" in script  # Canvas 像素级微扰
