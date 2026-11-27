# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""precheck_content 合规自检工具测试（2026-11-27 立）。

覆盖：标题 #/长度/缺失、正文区间、话题词数量与格式、绝对化/医疗承诺、
硬引导、占位符、AI 标识、参数校验、MCP 注册与清单可见。
"""

from __future__ import annotations

from typing import Any

from app.tools.content_compliance_tools import precheck_content

_TITLE_16 = "AI时代普通人如何做好内容的变现"
_HASHTAGS_5 = ["#AI", "#人工智能", "#内容创作", "#普通人副业", "#AI工具"]


def _args(**overrides: Any) -> dict[str, Any]:
    base = {
        "content": "字" * 480,
        "title": _TITLE_16,
        "hashtags": list(_HASHTAGS_5),
        "platform": "douyin",
        "min_chars": 470,
        "max_chars": 490,
        "title_length": 16,
        "hashtag_count": 5,
    }
    base.update(overrides)
    return base


class TestHappyPath:
    async def test_valid_content_passes(self):
        res = await precheck_content(_args())
        assert res["ok"] is True
        assert res["blocking"] == 0
        assert res["warnings"] == 0
        assert res["score"] == 100
        assert res["stats"] == {"charCount": 480, "titleLength": 16, "hashtagCount": 5}
        assert len(res["contentHash"]) == 16

    async def test_hash_is_deterministic(self):
        first = await precheck_content(_args())
        second = await precheck_content(_args())
        assert first["contentHash"] == second["contentHash"]


class TestTitle:
    async def test_title_with_hash_blocks(self):
        res = await precheck_content(_args(title="#AI时代普通人如何做好内容的变现"))
        assert res["ok"] is False
        assert any(item["id"] == "title.hash" for item in res["checks"])

    async def test_title_length_mismatch_blocks(self):
        short_title = "AI时代普通人如何做好内容"
        res = await precheck_content(_args(title=short_title))
        assert res["ok"] is False
        item = next(item for item in res["checks"] if item["id"] == "title.length")
        assert "16" in item["message"] and str(len(short_title)) in item["message"]

    async def test_missing_title_blocks_by_default(self):
        res = await precheck_content(_args(title=""))
        assert res["ok"] is False
        assert any(item["id"] == "title.missing" for item in res["checks"])

    async def test_missing_title_allowed_when_not_required(self):
        res = await precheck_content(_args(title="", require_title=False, title_length=0))
        assert res["ok"] is True

    async def test_title_prefix_warns(self):
        res = await precheck_content(_args(title="标题：" + _TITLE_16, title_length=0))
        assert res["ok"] is True
        assert any(item["id"] == "title.prefix" for item in res["checks"])


class TestBody:
    async def test_below_min_blocks(self):
        res = await precheck_content(_args(content="字" * 469))
        assert res["ok"] is False
        assert any(item["id"] == "body.range" for item in res["checks"])

    async def test_above_max_blocks(self):
        res = await precheck_content(_args(content="字" * 491))
        assert res["ok"] is False
        assert any(item["id"] == "body.range" for item in res["checks"])

    async def test_no_range_check_when_zero(self):
        res = await precheck_content(_args(content="字" * 20, min_chars=0, max_chars=0))
        assert res["ok"] is True

    async def test_placeholder_warns(self):
        res = await precheck_content(_args(content="字" * 470 + "TODO"))
        assert res["ok"] is True
        assert any(item["id"] == "body.placeholder" for item in res["checks"])

    async def test_empty_content_errors(self):
        res = await precheck_content(_args(content="   "))
        assert res["ok"] is False
        assert res["errorCode"] == "MISSING_CONTENT"


class TestClaims:
    async def test_absolute_claim_blocks(self):
        res = await precheck_content(_args(content="全网第一的AI工具" + "字" * 470, min_chars=0, max_chars=0))
        assert res["ok"] is False
        item = next(item for item in res["checks"] if item["id"] == "claim.block")
        assert "全网第一" in item["evidence"]

    async def test_medical_claim_blocks(self):
        res = await precheck_content(_args(content="这套方法能根治你的焦虑" + "字" * 470, min_chars=0, max_chars=0))
        assert res["ok"] is False
        assert any(item["id"] == "claim.block" for item in res["checks"])

    async def test_claim_in_title_blocks(self):
        res = await precheck_content(_args(title="全网第一的AI工具", title_length=0))
        assert res["ok"] is False
        assert any(item["id"] == "claim.block" for item in res["checks"])

    async def test_soft_claim_warns_only(self):
        res = await precheck_content(_args(content="这是目前最好的办法" + "字" * 470, min_chars=0, max_chars=0))
        assert res["ok"] is True
        assert any(item["id"] == "claim.warn" for item in res["checks"])


class TestCtaAndDisclosure:
    async def test_hard_cta_warns_only(self):
        res = await precheck_content(_args(content="关注我，下期继续" + "字" * 470, min_chars=0, max_chars=0))
        assert res["ok"] is True
        assert any(item["id"] == "cta.hard" for item in res["checks"])

    async def test_ai_disclosure_warns_when_required(self):
        res = await precheck_content(_args(require_ai_disclosure=True))
        assert res["ok"] is True
        assert any(item["id"] == "ai.disclosure" for item in res["checks"])

    async def test_ai_disclosure_passes_when_present(self):
        res = await precheck_content(
            _args(content="本内容由AI生成，仅供学习" + "字" * 470, min_chars=0, max_chars=0, require_ai_disclosure=True)
        )
        assert not any(item["id"] == "ai.disclosure" for item in res["checks"])


class TestHashtags:
    async def test_count_mismatch_blocks(self):
        res = await precheck_content(_args(hashtags=["#AI", "#人工智能", "#内容创作", "#普通人副业"]))
        assert res["ok"] is False
        assert any(item["id"] == "hashtag.count" for item in res["checks"])

    async def test_tag_without_hash_warns(self):
        res = await precheck_content(_args(hashtags=["#AI", "#人工智能", "#内容创作", "#普通人副业", "AI工具"]))
        assert res["ok"] is True
        assert any(item["id"] == "hashtag.format" for item in res["checks"])

    async def test_duplicate_tags_warn(self):
        res = await precheck_content(_args(hashtags=["#AI", "#AI", "#内容创作", "#普通人副业", "#AI工具"]))
        assert res["ok"] is True
        assert any(item["id"] == "hashtag.duplicate" for item in res["checks"])

    async def test_string_hashtags_are_split(self):
        res = await precheck_content(_args(hashtags="#AI #人工智能 #内容创作 #普通人副业 #AI工具"))
        assert res["ok"] is True
        assert res["stats"]["hashtagCount"] == 5


class TestProfiles:
    async def test_ihui_koubo_profile_applies_all_standards(self):
        res = await precheck_content(
            {
                "content": "字" * 480,
                "title": _TITLE_16,
                "hashtags": list(_HASHTAGS_5),
                "profile": "ihui_koubo",
            }
        )
        assert res["ok"] is True
        assert res["profile"] == "ihui_koubo"
        assert res["stats"] == {"charCount": 480, "titleLength": 16, "hashtagCount": 5}

    async def test_ihui_koubo_profile_blocks_out_of_range(self):
        res = await precheck_content(
            {
                "content": "字" * 469,
                "title": _TITLE_16,
                "hashtags": list(_HASHTAGS_5),
                "profile": "ihui_koubo",
            }
        )
        assert res["ok"] is False
        assert any(item["id"] == "body.range" for item in res["checks"])

    async def test_unknown_profile_errors(self):
        res = await precheck_content({**_args(), "profile": "unknown"})
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_PROFILE"


class TestRegistry:
    def test_registered_in_mcp_registry(self):
        from app.services.mcp_server import _TOOL_HANDLERS, _TOOLS

        assert any(tool.name == "precheck_content" for tool in _TOOLS)
        assert "precheck_content" in _TOOL_HANDLERS

    def test_list_tools_exposes_precheck_content(self):
        from app.services.mcp_server import mcp_server

        names = [tool.name for tool in mcp_server.list_tools()]
        assert "precheck_content" in names
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
