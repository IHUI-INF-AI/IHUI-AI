# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""腿1(2026-10-31 接线):供应商不支持 original 时,原图档必须降档,不得静默发出去。

一手现读(接线前):`app/core/responses_headers.py` 的 `can_request_original_image_detail` /
`normalize_output_image_detail` / `sanitize_original_image_detail` 三枚判据**零生产调用方**
(只有 tests/test_responses_headers_58.py 在调),而同模块的 `build_responses_headers` 早已在
`llm_gateway._apply_responses_headers` 装车 ⇒ 票面那句"不支持就降级/拒绝"从未生效,
detail=original 照原样发给厂商(上游 400 或自行重采样,而账面以为有闸)。

本文件钉住接线后的四格:
  ① 不支持的厂商 ⇒ **发往厂商的 kwargs 里不再带 original 档**(逐条降为 DEFAULT_IMAGE_DETAIL);
  ② 支持的厂商 ⇒ 逐字节原样(不多降一档、不写新键);
  ③ 判定实现仍只有一份(网关只做取值与留痕,不复写判据;§0.6);
  ④ 降档坏了不拖请求(异常隔离),同一路径的 header 注入照常。

测试隔离(AGENTS §5):纯函数 + 直接调网关装配函数,不连 PG/Redis、不发任何上游请求。
"""

from __future__ import annotations

import pathlib
from functools import lru_cache
from typing import Any

import pytest

from app.core import llm_gateway as gw
from app.core.responses_headers import (
    DEFAULT_IMAGE_DETAIL,
    ORIGINAL_IMAGE_DETAIL,
    can_request_original_image_detail,
    normalize_output_image_detail,
    provider_supports_original_image_detail,
    sanitize_messages_original_image_detail,
    sanitize_original_image_detail,
)

# 名单内厂商(唯一清单 ORIGINAL_IMAGE_DETAIL_PROVIDERS 里登记的那一枚)
SUPPORTED_PROVIDER = "openai"
# 名单外厂商:本仓真实 provider_code(前缀 stepfun/,不支持 original)
UNSUPPORTED_PROVIDER = "stepfun"


@lru_cache(maxsize=1)
def _gateway_source() -> str:
    """网关源码现读(只读,不执行)—— 给两条形状锁用。"""
    return pathlib.Path(gw.__file__).read_text(encoding="utf-8")


def _vision_messages(detail: str) -> list[dict[str, Any]]:
    """chat.completions 线格式(网关实际发往厂商的那一种)的一图一文消息。"""
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "看图"},
                {
                    "type": "image_url",
                    "image_url": {"url": "data:image/png;base64,AAAA"},
                    "detail": detail,
                },
            ],
        }
    ]


class TestJudgeSingleSource:
    """判据面:能力闸的四种取值,全部只经 responses_headers 这一份实现。"""

    def test_unsupported_provider_downgrades_image_url_part(self) -> None:
        messages = _vision_messages(ORIGINAL_IMAGE_DETAIL)
        downgraded = sanitize_messages_original_image_detail(messages, UNSUPPORTED_PROVIDER)
        assert downgraded == 1
        # 发往厂商的 kwargs 里不再带 original 档 —— 这一格是本次接线的正题
        assert messages[0]["content"][1]["detail"] == DEFAULT_IMAGE_DETAIL

    def test_supported_provider_keeps_original_untouched(self) -> None:
        messages = _vision_messages(ORIGINAL_IMAGE_DETAIL)
        before = [dict(part) for part in messages[0]["content"]]
        assert sanitize_messages_original_image_detail(messages, SUPPORTED_PROVIDER) == 0
        assert messages[0]["content"][1]["detail"] == ORIGINAL_IMAGE_DETAIL
        assert messages[0]["content"] == before  # 逐字节原样,不多降一档

    def test_unattributed_provider_fails_closed(self) -> None:
        """provider 归因不到(空串)⇒ 名单外 ⇒ 降档。

        失效方向必须是"少发一档画质",不能是"少发一次判定"(§0.10)。
        """
        messages = _vision_messages(ORIGINAL_IMAGE_DETAIL)
        assert provider_supports_original_image_detail("") is False
        assert sanitize_messages_original_image_detail(messages, "") == 1
        assert messages[0]["content"][1]["detail"] == DEFAULT_IMAGE_DETAIL

    @pytest.mark.parametrize("tier", ["auto", "low", "high"])
    def test_non_original_tiers_never_touched(self, tier: str) -> None:
        messages = _vision_messages(tier)
        assert sanitize_messages_original_image_detail(messages, UNSUPPORTED_PROVIDER) == 0
        assert messages[0]["content"][1]["detail"] == tier

    def test_no_detail_key_and_string_content_produce_no_new_keys(self) -> None:
        """没写档位的图像 part 与字符串 content 都不被造出一个 detail 键。"""
        messages: list[dict[str, Any]] = [
            {"role": "user", "content": "纯文本"},
            {"role": "user", "content": [{"type": "image_url", "image_url": {"url": "x"}}]},
        ]
        assert sanitize_messages_original_image_detail(messages, UNSUPPORTED_PROVIDER) == 0
        assert "detail" not in messages[1]["content"][0]
        assert messages[0]["content"] == "纯文本"

    def test_responses_side_input_image_shape_still_covered(self) -> None:
        """Responses 面 input_image 形态(批58 原始形状)依旧被同一条判据覆盖。"""
        items = [
            {"type": "input_image", "detail": ORIGINAL_IMAGE_DETAIL},
            {"type": "input_text", "text": "hi"},
        ]
        out = sanitize_original_image_detail(
            can_request_original_image_detail(False), items
        )
        assert out[0]["detail"] == DEFAULT_IMAGE_DETAIL
        assert out[1] == {"type": "input_text", "text": "hi"}

    def test_downgrade_value_goes_through_normalize(self) -> None:
        """降档值经 normalize_output_image_detail 归一(不支持 ⇒ None ⇒ 默认档)。"""
        assert normalize_output_image_detail(False, ORIGINAL_IMAGE_DETAIL) is None
        assert DEFAULT_IMAGE_DETAIL == "auto"

    def test_idempotent_second_pass_changes_nothing(self) -> None:
        messages = _vision_messages(ORIGINAL_IMAGE_DETAIL)
        assert sanitize_messages_original_image_detail(messages, UNSUPPORTED_PROVIDER) == 1
        # 第二次过(同一批对象)不再有任何 original ⇒ 0,且档位不回跳
        assert sanitize_messages_original_image_detail(messages, UNSUPPORTED_PROVIDER) == 0
        assert messages[0]["content"][1]["detail"] == DEFAULT_IMAGE_DETAIL

    def test_tool_message_parts_are_in_scope_too(self) -> None:
        """工具输出里的图像 part 同样过闸(docstring 里"工具输出图像条目"那一格)。"""
        messages: list[dict[str, Any]] = [
            {
                "role": "tool",
                "tool_call_id": "t1",
                "content": [{"type": "image_url", "image_url": {"url": "u"}, "detail": "original"}],
            }
        ]
        assert sanitize_messages_original_image_detail(messages, UNSUPPORTED_PROVIDER) == 1
        assert messages[0]["content"][0]["detail"] == DEFAULT_IMAGE_DETAIL


class TestGatewayAssemblyWiring:
    """接线面:两枚零调用方判据现在真被出站装配路径调用。"""

    def test_unsupported_provider_kwargs_no_longer_carry_original(self) -> None:
        """不支持厂商:网关装配后的 kwargs(即发往厂商的那一份)不再带 original 档。"""
        call_kwargs: dict[str, Any] = {
            "model": f"{UNSUPPORTED_PROVIDER}/step-3",
            "messages": _vision_messages(ORIGINAL_IMAGE_DETAIL),
        }
        gw._apply_responses_headers(call_kwargs)
        parts = call_kwargs["messages"][0]["content"]
        assert all(part.get("detail") != ORIGINAL_IMAGE_DETAIL for part in parts)
        assert parts[1]["detail"] == DEFAULT_IMAGE_DETAIL
        # 未开 responses 开关时不造头(与 test_gateway_wiring_58b 的 off 零差异同律)
        assert "extra_headers" not in call_kwargs

    def test_supported_kwargs_headers_and_detail_kept(self, monkeypatch) -> None:
        """支持厂商 + 开关 on:原图档原样,header 注入照常(两格互不干扰)。"""
        monkeypatch.setenv("LLM_RESPONSES_HEADERS_ENABLED", "1")
        monkeypatch.setenv("LLM_CODEX_BETA_FEATURES", "vision_original")
        call_kwargs: dict[str, Any] = {
            "model": f"{SUPPORTED_PROVIDER}/gpt-4o",
            "messages": _vision_messages(ORIGINAL_IMAGE_DETAIL),
            "extra_headers": {"X-Keep": "v"},
        }
        gw._apply_responses_headers(call_kwargs)
        assert call_kwargs["messages"][0]["content"][1]["detail"] == ORIGINAL_IMAGE_DETAIL
        headers = call_kwargs["extra_headers"]
        assert headers["X-Keep"] == "v"
        assert headers["x-codex-beta-features"] == "vision_original"

    def test_downgrade_failure_does_not_break_request(self, monkeypatch) -> None:
        """判据模块抛异常 ⇒ 装配降级跳过,绝不阻塞请求、绝不冒坏头。"""
        import app.core.responses_headers as rh

        monkeypatch.setenv("LLM_RESPONSES_HEADERS_ENABLED", "1")
        monkeypatch.setenv("LLM_CODEX_TURN_STATE", "ts-1")

        def boom(*a: Any, **k: Any) -> int:
            raise RuntimeError("降档判据炸了")

        monkeypatch.setattr(rh, "sanitize_messages_original_image_detail", boom)
        call_kwargs: dict[str, Any] = {
            "model": f"{UNSUPPORTED_PROVIDER}/step-3",
            "messages": _vision_messages(ORIGINAL_IMAGE_DETAIL),
        }
        gw._apply_responses_headers(call_kwargs)  # 不得抛出
        # 原图档没被降下来(降级方向 = 现状),但请求照样发得出去,头照样注入
        assert call_kwargs["messages"][0]["content"][1]["detail"] == ORIGINAL_IMAGE_DETAIL
        assert call_kwargs["extra_headers"]["x-codex-turn-state"] == "ts-1"

    def test_header_injection_failure_does_not_skip_downgrade(self, monkeypatch) -> None:
        """头注入坏了也不连累降档(两格各自独立 try,坏一边不等于另一边也没跑)。"""
        import app.core.responses_headers as rh

        monkeypatch.setattr(
            rh,
            "build_responses_headers",
            lambda **kw: (_ for _ in ()).throw(RuntimeError("头坏了")),
        )
        call_kwargs: dict[str, Any] = {
            "model": f"{UNSUPPORTED_PROVIDER}/step-3",
            "messages": _vision_messages(ORIGINAL_IMAGE_DETAIL),
        }
        gw._apply_responses_headers(call_kwargs)
        assert call_kwargs["messages"][0]["content"][1]["detail"] == DEFAULT_IMAGE_DETAIL

    def test_no_second_judge_in_gateway(self) -> None:
        """§0.6 形状锁:网关不复写判据,只调用那一份实现。"""
        module_src = _gateway_source().split("def _apply_responses_headers")[1].split(
            "def _apply_responses_stream_options"
        )[0]
        assert "sanitize_messages_original_image_detail" in module_src
        # 降档判定不写在网关自己的代码里(不得出现第二份 original→auto 赋值)
        assert f'= "{ORIGINAL_IMAGE_DETAIL}"' not in module_src
        assert f'= "{DEFAULT_IMAGE_DETAIL}"' not in module_src

    def test_both_production_call_sites_route_through_the_gate(self) -> None:
        """complete 与 astream 两条出站路径都经 `_apply_responses_headers`(唯一接线点)。"""
        assert _gateway_source().count("_apply_responses_headers(call_kwargs)") == 2

    def test_run_twice_same_result(self) -> None:
        """跑两次同结果(§5 隔离:无跨轮状态)。"""
        outcomes = []
        for _ in range(2):
            call_kwargs: dict[str, Any] = {
                "model": f"{UNSUPPORTED_PROVIDER}/step-3",
                "messages": _vision_messages(ORIGINAL_IMAGE_DETAIL),
            }
            gw._apply_responses_headers(call_kwargs)
            outcomes.append(call_kwargs["messages"][0]["content"][1]["detail"])
        assert outcomes == [DEFAULT_IMAGE_DETAIL, DEFAULT_IMAGE_DETAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
