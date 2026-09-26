# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D31 Figma 设计稿转码链路单测(§5 测试隔离铁律:零真实网络 / 零 PG / 零 Redis)。

monkeypatch 覆盖点清单(证明"零真实网络"的唯一 I/O 面):
- figma_transcoder._http_json            → 所有 Figma REST GET 的单一接缝(nodes/images),
  替换为本地夹具;任何未替换路径走到它即 AssertionError(不静默放行)。
- figma_transcoder.download_image_data_uri → 导出图下载(第二网络路径,内部直接用 httpx),
  替换为固定 data URI。
- figma_transcoder._llm_complete         → LiteLLM 网关(llm_gateway.complete)接缝,
  替换为固定 tsx 输出。
- 令牌经 monkeypatch.setenv/delenv 控制,不读任何 .env。
测试内不 import app.main、不触发 lifespan,路由用最小 FastAPI + dependency_overrides。
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import figma as figma_api
from app.core.jwt_auth import require_request_user_id
from app.services import figma_transcoder as ft

VALID_KEY = "AbCd1234EfGh5678"
DESIGN_URL = f"https://www.figma.com/design/{VALID_KEY}/My%20Page?node-id=12-34&t=xx"


def _doc() -> dict[str, Any]:
    """一份形态贴近 Figma REST 的 document 夹具。"""
    return {
        "id": "12:34",
        "name": "Frame/Card",
        "type": "FRAME",
        "absoluteBoundingBox": {"x": 0, "y": 0, "width": 320, "height": 120},
        "layoutMode": "HORIZONTAL",
        "itemSpacing": 12,
        "paddingLeft": 16,
        "cornerRadius": 12,
        "fills": [{"type": "SOLID", "color": {"r": 1, "g": 1, "b": 1}}],
        "children": [
            {
                "id": "12:35",
                "name": "hidden one",
                "type": "RECTANGLE",
                "visible": False,
            },
            {
                "id": "12:36",
                "name": "Title",
                "type": "TEXT",
                "characters": "你好世界",
                "fontSize": 16,
                "fills": [{"type": "SOLID", "color": {"r": 0, "g": 0, "b": 0}, "opacity": 0.6}],
            },
        ],
    }


# ---------------------------------------------------------------------------
# URL / node id 解析
# ---------------------------------------------------------------------------


class TestUrlParsing:
    def test_design_url_with_node_id(self) -> None:
        key, node = ft.parse_figma_url(DESIGN_URL)
        assert key == VALID_KEY
        assert node == "12:34"

    def test_url_without_node_id_returns_none(self) -> None:
        key, node = ft.parse_figma_url(f"https://www.figma.com/file/{VALID_KEY}/name")
        assert key == VALID_KEY
        assert node is None

    def test_non_figma_host_rejected(self) -> None:
        with pytest.raises(ft.FigmaTranscodeError) as e:
            ft.parse_figma_url("https://example.com/design/xxx")
        assert e.value.code == "FIGMA_URL_INVALID"

    def test_missing_key_segment_rejected(self) -> None:
        with pytest.raises(ft.FigmaTranscodeError) as e:
            ft.parse_figma_url("https://www.figma.com/design")
        assert e.value.code == "FIGMA_URL_INVALID"

    def test_normalize_node_id_dash_and_colon(self) -> None:
        assert ft.normalize_node_id("1-23") == "1:23"
        assert ft.normalize_node_id("1:23") == "1:23"

    def test_normalize_node_id_invalid(self) -> None:
        with pytest.raises(ft.FigmaTranscodeError) as e:
            ft.normalize_node_id("not-a-node")
        assert e.value.code == "FIGMA_NODE_ID_INVALID"


# ---------------------------------------------------------------------------
# 令牌缺失 fail-closed(不得回退假数据)
# ---------------------------------------------------------------------------


class TestTokenFailClosed:
    def test_resolve_raises_when_env_empty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("FIGMA_TOKEN", raising=False)
        monkeypatch.delenv("FIGMA_ACCESS_TOKEN", raising=False)
        monkeypatch.setenv("FIGMA_TOKEN", "  ")
        with pytest.raises(ft.FigmaTranscodeError) as e:
            ft.resolve_figma_token()
        assert e.value.code == "FIGMA_TOKEN_MISSING"

    def test_transcode_never_touches_network_without_token(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("FIGMA_TOKEN", raising=False)
        monkeypatch.delenv("FIGMA_ACCESS_TOKEN", raising=False)

        async def _forbidden(*a: Any, **k: Any) -> dict[str, Any]:
            raise AssertionError("令牌缺失时不得发出任何 Figma 请求")

        monkeypatch.setattr(ft, "_http_json", _forbidden)
        with pytest.raises(ft.FigmaTranscodeError) as e:
            asyncio.run(ft.transcode_figma(VALID_KEY, "12:34"))
        assert e.value.code == "FIGMA_TOKEN_MISSING"


# ---------------------------------------------------------------------------
# 节点树裁剪(纯函数)
# ---------------------------------------------------------------------------


class TestPrune:
    def test_hidden_dropped_and_style_kept(self) -> None:
        result = ft.prune_node_tree(_doc())
        assert result.dropped_hidden == 1
        assert result.kept_nodes == 2  # 根 + Title
        tree = result.tree
        assert tree["cornerRadius"] == 12
        assert tree["fills"] == ["#FFFFFF"]
        child = tree["children"][0]
        assert child["text"] == "你好世界"
        assert child["fills"] == ["#00000099"]  # opacity 0.6 → 带 alpha 通道
        assert not result.truncated

    def test_depth_cap_marks_truncated(self) -> None:
        deep: dict[str, Any] = {"id": "0:0", "type": "FRAME", "name": "root"}
        node = deep
        for i in range(6):
            child: dict[str, Any] = {"id": f"0:{i}", "type": "FRAME", "name": f"n{i}", "children": []}
            node["children"] = [child]
            node = child
        result = ft.prune_node_tree(deep, max_depth=2)
        assert result.truncated
        assert result.dropped_over_depth >= 1

    def test_node_budget_cap(self) -> None:
        result = ft.prune_node_tree(_doc(), max_nodes=1)
        assert result.truncated
        assert result.dropped_by_budget >= 1
        assert result.kept_nodes == 1

    def test_invisible_root_raises(self) -> None:
        with pytest.raises(ft.FigmaTranscodeError) as e:
            ft.prune_node_tree({"id": "1:1", "type": "FRAME", "visible": False})
        assert e.value.code == "FIGMA_BAD_PAYLOAD"


# ---------------------------------------------------------------------------
# 输出侧护栏(§4:!important / emoji 图标 / 圆角档位)正反例
# ---------------------------------------------------------------------------

CLEAN_CODE = """import { Trophy } from 'lucide-react'

export default function ProfileCard({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-card p-4 border border-border">
      <Trophy className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-semibold">{name}</span>
    </div>
  )
}
"""


class TestLint:
    def test_clean_code_passes(self) -> None:
        assert ft.lint_generated_code(CLEAN_CODE) == []

    def test_important_flagged(self) -> None:
        violations = ft.lint_generated_code("const css = 'padding: 4px !important;'")
        assert any(v.rule == "NO_IMPORTANT" for v in violations)
        assert ft.lint_generated_code("const css = 'padding: 4px'") == []

    def test_emoji_icon_flagged(self) -> None:
        code = CLEAN_CODE.replace("<Trophy", "<span>🏆</span><TrophyHidden")
        violations = ft.lint_generated_code(code)
        assert any(v.rule == "NO_EMOJI_ICON" for v in violations)

    def test_arbitrary_radius_flagged(self) -> None:
        code = CLEAN_CODE.replace("rounded-lg", "rounded-[13px]")
        violations = ft.lint_generated_code(code)
        assert any(v.rule == "RADIUS_STEP" for v in violations)

    def test_inline_radius_number_flagged(self) -> None:
        code = CLEAN_CODE.replace("rounded-lg", "") + "\nconst st = { borderRadius: 13 }"
        violations = ft.lint_generated_code(code)
        assert any(v.rule == "RADIUS_STEP" for v in violations)

    def test_allowed_steps_and_bare_rounded_pass(self) -> None:
        for cls in ("rounded", "rounded-xs", "rounded-2xl", "rounded-full", "rounded-t-lg"):
            code = CLEAN_CODE.replace("rounded-lg", cls)
            assert ft.lint_generated_code(code) == [], cls

    def test_comments_are_not_judged(self) -> None:
        # 注释里出现 emoji / !important 不算违规(判的是实际代码面)
        code = CLEAN_CODE + "\n// 旧稿用了 🏆 和 !important,已废弃\n/* rounded-[99px] 也不该判 */"
        assert ft.lint_generated_code(code) == []

    def test_icon_string_without_lucide_flagged(self) -> None:
        code = 'export default function T() { return <Tab icon="home" /> }'
        violations = ft.lint_generated_code(code)
        assert any(v.rule == "NO_EMOJI_ICON" for v in violations)


class TestExtractCode:
    def test_fenced_tsx(self) -> None:
        assert ft.extract_code("说明\n```tsx\nconst a = 1\n```") == "const a = 1"

    def test_no_fence_returns_all(self) -> None:
        assert ft.extract_code("const a = 1") == "const a = 1"

    def test_empty_raises(self) -> None:
        with pytest.raises(ft.FigmaTranscodeError) as e:
            ft.extract_code("   ")
        assert e.value.code == "LLM_BAD_OUTPUT"


# ---------------------------------------------------------------------------
# 全链 mock 下的 transcode_figma(取数→裁剪→模型→产出→护栏)
# ---------------------------------------------------------------------------


def _wire_mocks(
    monkeypatch: pytest.MonkeyPatch,
    *,
    llm_content: str,
    http_calls: list[str],
) -> None:
    monkeypatch.setenv("FIGMA_TOKEN", "figtok")

    async def fake_http_json(url: str, **kw: Any) -> dict[str, Any]:
        http_calls.append(url)
        if url.endswith("/nodes"):
            return {"nodes": {"12:34": {"document": _doc()}}}
        if "/images/" in url:
            return {"meta": {"images": {"12:34": "https://figma-cache.example/x.png"}}}
        raise AssertionError(f"未登记的 URL 不得被请求: {url}")

    async def fake_download(url: str, **kw: Any) -> str:
        assert url.startswith("https://figma-cache.example/")
        return "data:image/png;base64,QUJD"

    async def fake_llm(messages: list[dict[str, Any]], **kw: Any) -> dict[str, Any]:
        user = messages[1]["content"]
        assert isinstance(user, list) and user[0]["type"] == "image_url"  # vision block 在位
        return {"content": f"```tsx\n{llm_content}\n```", "model": "gpt-4o", "stub": False}

    monkeypatch.setattr(ft, "_http_json", fake_http_json)
    monkeypatch.setattr(ft, "download_image_data_uri", fake_download)
    monkeypatch.setattr(ft, "_llm_complete", fake_llm)


class TestTranscodeFlow:
    def test_happy_path_with_vision(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls: list[str] = []
        _wire_mocks(monkeypatch, llm_content=CLEAN_CODE, http_calls=calls)
        result = asyncio.run(ft.transcode_figma(VALID_KEY, "12:34"))
        assert result["ok"] is True
        assert "ProfileCard" in result["code"]
        assert result["visionUsed"] is True
        assert result["guardrailsPassed"] is True
        assert result["guardrails"] == []
        assert result["degraded"] == []
        assert any("/nodes" in u for u in calls) and any("/images/" in u for u in calls)

    def test_guardrail_violations_reported_not_hidden(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls: list[str] = []
        dirty = CLEAN_CODE.replace("rounded-lg", "rounded-[13px]")
        _wire_mocks(monkeypatch, llm_content=dirty, http_calls=calls)
        result = asyncio.run(ft.transcode_figma(VALID_KEY, "12:34"))
        assert result["guardrailsPassed"] is False
        assert any(v["rule"] == "RADIUS_STEP" for v in result["guardrails"])

    def test_llm_error_maps_to_stable_code(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls: list[str] = []
        _wire_mocks(monkeypatch, llm_content=CLEAN_CODE, http_calls=calls)

        async def boom(messages: list[dict[str, Any]], **kw: Any) -> dict[str, Any]:
            raise RuntimeError("gateway down")

        monkeypatch.setattr(ft, "_llm_complete", boom)
        with pytest.raises(ft.FigmaTranscodeError) as e:
            asyncio.run(ft.transcode_figma(VALID_KEY, "12:34"))
        assert e.value.code == "LLM_FAILED"


# ---------------------------------------------------------------------------
# 路由层:POST 提交 / GET 状态 / 属主对齐(认证≠授权收口)
# ---------------------------------------------------------------------------


@pytest.fixture()
def store_reset() -> Iterator[None]:
    ft.reset_task_store()
    yield
    ft.reset_task_store()


@pytest.fixture()
def app_and_principal() -> tuple[FastAPI, dict[str, str]]:
    holder = {"principal": "user-a"}
    app = FastAPI()
    app.include_router(figma_api.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: holder["principal"]
    return app, holder


async def _client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.usefixtures("store_reset")
class TestRoutes:
    async def test_post_412_when_token_missing(self, app_and_principal: Any, monkeypatch: pytest.MonkeyPatch) -> None:
        app, _ = app_and_principal
        monkeypatch.delenv("FIGMA_TOKEN", raising=False)
        monkeypatch.delenv("FIGMA_ACCESS_TOKEN", raising=False)
        calls: list[str] = []

        async def forbidden(*a: Any, **k: Any) -> dict[str, Any]:
            raise AssertionError("412 路径不得发起 Figma 请求")

        monkeypatch.setattr(ft, "_http_json", forbidden)
        async with await _client(app) as c:
            r = await c.post("/api/figma/transcode", json={"figmaUrl": DESIGN_URL})
            body = r.json()
        assert r.status_code == 200  # 业务错误走 {code} 信封(HTTP 层不 500)
        assert body["code"] == 412
        assert body["errorCode"] == "FIGMA_TOKEN_MISSING"
        assert body["data"] is None
        assert calls == []

    async def test_post_400_on_bad_input(self, app_and_principal: Any, monkeypatch: pytest.MonkeyPatch) -> None:
        app, _ = app_and_principal
        monkeypatch.setenv("FIGMA_TOKEN", "figtok")
        async with await _client(app) as c:
            r = await c.post("/api/figma/transcode", json={"fileKey": VALID_KEY})  # 缺 nodeId
            body = r.json()
        assert body["code"] == 400
        assert body["errorCode"] == "FIGMA_NODE_ID_INVALID"

    async def test_post_then_poll_and_owner_binding(
        self, app_and_principal: Any, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        app, holder = app_and_principal
        calls: list[str] = []
        _wire_mocks(monkeypatch, llm_content=CLEAN_CODE, http_calls=calls)
        async with await _client(app) as c:
            r = await c.post("/api/figma/transcode", json={"figmaUrl": DESIGN_URL})
            body = r.json()
            assert body["code"] == 0
            task_id = body["data"]["taskId"]
            assert body["data"]["status"] in ("pending", "running")

            status = ""
            for _ in range(100):
                g = await c.get(f"/api/figma/tasks/{task_id}")
                status = g.json()["data"]["status"]
                if status in ("succeeded", "failed"):
                    break
                await asyncio.sleep(0.02)
            assert status == "succeeded"
            g = await c.get(f"/api/figma/tasks/{task_id}")
            assert g.json()["data"]["result"]["guardrailsPassed"] is True

            # 认证≠授权:换主体读他人任务 → 403(不落 404、不透出内容)
            holder["principal"] = "user-b"
            g2 = await c.get(f"/api/figma/tasks/{task_id}")
            assert g2.status_code == 403

            holder["principal"] = "user-a"
            g3 = await c.get("/api/figma/tasks/ffffffffffffffffffffffffffffffff")
            assert g3.status_code == 404

    def test_task_owner_helper(self) -> None:
        task = ft.TranscodeTask(task_id="t", user_id="user-a", file_key=VALID_KEY, node_id="1:2")
        assert task.to_public()["fileKey"] == VALID_KEY
        assert task.status == "pending"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
