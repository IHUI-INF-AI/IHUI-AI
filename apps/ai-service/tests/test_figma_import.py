# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D31 设计稿转码测试(figma_importer + figma_import router)。

覆盖:
1. FIGMA_API_TOKEN 未配置 → fail-closed(FIGMA_NOT_CONFIGURED),零网络请求;
2. fetch + 节点树简化 → IR 关键字段(相对坐标/fills→CSS/圆角/文本/图片引用/auto-layout);
3. LLM 成功 → 返回生成代码(degraded=false);
4. LLM 失败 → 确定性降级 HTML+内联样式骨架(degraded=true);
5. 超深节点树不爆栈(max_depth 护栏截断);
6. 路由层:鉴权后 200 / 未配 token 503 / 非法 target 422。

httpx.AsyncClient 注入式:httpx.MockTransport 构造 fake transport 塞进构造函数。
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from app.services.figma_importer import (
    FIGMA_TOKEN_ENV,
    MAX_DEPTH,
    FigmaImporter,
    FigmaImportError,
    render_skeleton_html,
    simplify_to_ir,
)

NODE_ID = "1:2"


def _figma_payload() -> dict[str, Any]:
    """Figma files/nodes API 响应夹具:Frame(白色卡片,纵向 auto-layout)+ 文本 + 图片填充。"""
    return {
        "nodes": {
            NODE_ID: {
                "document": {
                    "id": NODE_ID,
                    "name": "Card",
                    "type": "FRAME",
                    "absoluteBoundingBox": {"x": 100, "y": 200, "width": 300, "height": 200},
                    "layoutMode": "VERTICAL",
                    "itemSpacing": 12,
                    "paddingTop": 16,
                    "paddingRight": 16,
                    "paddingBottom": 16,
                    "paddingLeft": 16,
                    "cornerRadius": 8,
                    "fills": [{"type": "SOLID", "color": {"r": 1, "g": 1, "b": 1, "a": 1}}],
                    "children": [
                        {
                            "id": "1:3",
                            "name": "Title",
                            "type": "TEXT",
                            "absoluteBoundingBox": {"x": 116, "y": 216, "width": 200, "height": 24},
                            "characters": "你好设计稿",
                            "style": {"fontFamily": "Inter", "fontSize": 16, "fontWeight": 700},
                            "fontName": {"family": "Inter", "style": "Bold"},
                            "fills": [{"type": "SOLID", "color": {"r": 0.1, "g": 0.2, "b": 0.3, "a": 1}}],
                        },
                        {
                            "id": "1:4",
                            "name": "Banner",
                            "type": "RECTANGLE",
                            "absoluteBoundingBox": {"x": 116, "y": 252, "width": 268, "height": 100},
                            "fills": [{"type": "IMAGE", "imageRef": "img-ref-abc", "scaleMode": "FILL"}],
                        },
                        {
                            "id": "1:5",
                            "name": "Hidden",
                            "type": "RECTANGLE",
                            "visible": False,
                            "absoluteBoundingBox": {"x": 0, "y": 0, "width": 10, "height": 10},
                            "fills": [],
                        },
                    ],
                }
            }
        }
    }


def _mock_transport(calls: list[httpx.Request], payload: dict[str, Any] | None = None, status: int = 200):
    """fake transport:记录请求并可断言(不发真实网络)。"""

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(status, json=payload if payload is not None else {"nodes": {}})

    return httpx.MockTransport(handler)


# ---------------------------------------------------------------------------
# 1) token 门控:未配置 fail-closed,零网络
# ---------------------------------------------------------------------------


async def test_token_missing_fail_closed_no_network(monkeypatch):
    """未配置 FIGMA_API_TOKEN → FIGMA_NOT_CONFIGURED,且 transport 记录到 0 个请求。"""
    monkeypatch.delenv(FIGMA_TOKEN_ENV, raising=False)
    calls: list[httpx.Request] = []
    importer = FigmaImporter(
        client=httpx.AsyncClient(transport=_mock_transport(calls)),
        token=None,  # 显式 None = 走 env 门控(与生产一致)
    )
    with pytest.raises(FigmaImportError) as exc_info:
        await importer.fetch_figma_node("filekey", NODE_ID)
    assert exc_info.value.code == "FIGMA_NOT_CONFIGURED"
    assert calls == []  # 绝不发网络


async def test_token_missing_no_half_product(monkeypatch):
    """门控在整条管线最前:import_design 未配 token 也直接抛错,无半成品响应。"""
    monkeypatch.delenv(FIGMA_TOKEN_ENV, raising=False)
    importer = FigmaImporter(token=None)
    with pytest.raises(FigmaImportError) as exc_info:
        await importer.import_design("filekey", NODE_ID, "react")
    assert exc_info.value.code == "FIGMA_NOT_CONFIGURED"


# ---------------------------------------------------------------------------
# 2) fetch + IR 关键字段
# ---------------------------------------------------------------------------


async def test_fetch_and_simplify_ir_fields(monkeypatch):
    """注入 fake transport:校验请求头/URL + IR 相对坐标/背景/文本/图片引用/auto-layout。"""
    calls: list[httpx.Request] = []
    client = httpx.AsyncClient(transport=_mock_transport(calls, _figma_payload()))
    importer = FigmaImporter(client=client, token="tok-test")
    document = await importer.fetch_figma_node("filekey1", NODE_ID)

    # 请求契约:GET https://api.figma.com/v1/files/{file_key}/nodes?ids={node_id} + X-Figma-Token
    # (httpx 对 node_id 中的冒号做百分号编码 1%3A2,Figma API 两种形态都接受)
    assert len(calls) == 1
    req = calls[0]
    assert str(req.url) == "https://api.figma.com/v1/files/filekey1/nodes?ids=1%3A2"
    assert req.headers["x-figma-token"] == "tok-test"

    ir, warnings, stats = simplify_to_ir(document)
    # 根节点:相对坐标归零、尺寸、背景、圆角、auto-layout
    assert ir.type == "frame"
    assert (ir.x, ir.y) == (0, 0)
    assert (ir.width, ir.height) == (300, 200)
    assert ir.background == "#ffffff"
    assert ir.border_radius == 8
    assert ir.flex_direction == "column"
    assert ir.gap == 12
    assert ir.padding == [16, 16, 16, 16]
    # 文本节点:相对父坐标 +16/+16,文字/字号/字重/颜色
    text_node = ir.children[0]
    assert text_node.type == "text"
    assert (text_node.x, text_node.y) == (16, 16)
    assert text_node.text == "你好设计稿"
    assert text_node.font_size == 16
    assert text_node.font_weight == 700
    assert text_node.color == "#1a334c"  # (0.1,0.2,0.3)*255(round 半数取偶:0.3*255=76.5→76)
    # 图片填充:只记引用不下载
    img_node = ir.children[1]
    assert img_node.type == "image"
    assert img_node.image_ref == "img-ref-abc"
    # visible=False 子节点被剔除
    assert len(ir.children) == 2
    assert stats["image_refs"] == 1
    assert stats["text_nodes"] == 1
    assert stats["visited"] == 4


async def test_fetch_node_not_found(monkeypatch):
    """响应无该 node_id → FIGMA_NODE_NOT_FOUND。"""
    calls: list[httpx.Request] = []
    client = httpx.AsyncClient(
        transport=_mock_transport(calls, {"nodes": {"9:9": {"document": {}}}})
    )
    importer = FigmaImporter(client=client, token="tok-test")
    with pytest.raises(FigmaImportError) as exc_info:
        await importer.fetch_figma_node("filekey", NODE_ID)
    assert exc_info.value.code == "FIGMA_NODE_NOT_FOUND"


async def test_fetch_bad_param_rejected(monkeypatch):
    """fileKey/nodeId 白名单外 → FIGMA_BAD_PARAM,不发网络。"""
    calls: list[httpx.Request] = []
    importer = FigmaImporter(client=httpx.AsyncClient(transport=_mock_transport(calls)), token="tok")
    with pytest.raises(FigmaImportError) as exc_info:
        await importer.fetch_figma_node("../etc/passwd", NODE_ID)
    assert exc_info.value.code == "FIGMA_BAD_PARAM"
    assert calls == []


# ---------------------------------------------------------------------------
# 3) LLM 成功 / 4) 失败降级
# ---------------------------------------------------------------------------


def _small_ir():
    ir, _, _ = simplify_to_ir(_figma_payload()["nodes"][NODE_ID]["document"])
    return ir


async def test_llm_success_returns_code(monkeypatch):
    """LLM 成功:剥掉 markdown 围栏返回代码,degraded=False,language=tsx。"""
    from app.core import llm_gateway as gw

    captured: dict[str, Any] = {}

    async def fake_complete(messages, model=None, **kwargs):
        captured["messages"] = messages
        return {"content": "```tsx\nexport default function Card() { return <div/> }\n```"}

    monkeypatch.setattr(gw.llm_gateway, "complete", fake_complete)
    importer = FigmaImporter(token="tok-test")
    warnings: list[str] = []
    result = await importer.generate_code_from_ir(_small_ir(), "react", warnings)

    assert result["degraded"] is False
    assert result["language"] == "tsx"
    assert result["code"].startswith("export default function Card")
    assert warnings == []
    # 提示词契约:system 约束 React+Tailwind,IR JSON 内嵌
    assert "React" in captured["messages"][0]["content"]
    assert "taro" in captured["messages"][0]["content"]
    ir_in_prompt = json.loads(captured["messages"][1]["content"].split("IR:\n", 1)[1])
    assert ir_in_prompt["name"] == "Card"


async def test_llm_failure_degrades_to_skeleton(monkeypatch):
    """LLM 抛错 → 确定性降级 HTML+内联样式骨架,degraded=True,永不白屏。"""
    from app.core import llm_gateway as gw

    async def boom(messages, model=None, **kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(gw.llm_gateway, "complete", boom)
    importer = FigmaImporter(token="tok-test")
    warnings: list[str] = []
    result = await importer.generate_code_from_ir(_small_ir(), "taro", warnings)

    assert result["degraded"] is True
    assert result["language"] == "html"
    assert '<div style="position: absolute' in result["code"]
    assert "background: #ffffff" in result["code"]
    assert "你好设计稿" in result["code"]
    assert 'data-image-ref="img-ref-abc"' in result["code"]
    assert any("已降级为确定性 HTML 骨架" in w for w in warnings)


def test_skeleton_deterministic():
    """降级骨架确定性:同 IR 同输出。"""
    ir = _small_ir()
    assert render_skeleton_html(ir) == render_skeleton_html(ir)


# ---------------------------------------------------------------------------
# 5) 超深节点树不爆栈
# ---------------------------------------------------------------------------


def test_deep_tree_no_recursion_error():
    """5000 层深节点树:深度护栏截断,不抛 RecursionError,且告警。"""
    deep: dict[str, Any] = {
        "id": "leaf",
        "name": "leaf",
        "type": "RECTANGLE",
        "absoluteBoundingBox": {"x": 0, "y": 0, "width": 10, "height": 10},
        "fills": [],
    }
    for _ in range(5000):
        deep = {
            "id": "n",
            "name": "n",
            "type": "FRAME",
            "absoluteBoundingBox": {"x": 0, "y": 0, "width": 10, "height": 10},
            "fills": [],
            "children": [deep],
        }
    ir, warnings, stats = simplify_to_ir(deep)  # 不应 RecursionError
    assert stats["max_depth_reached"] <= MAX_DEPTH
    assert "节点树超过最大深度,超出部分已截断" in warnings
    assert ir.children  # 根下第一层正常解析


# ---------------------------------------------------------------------------
# 6) 路由层
# ---------------------------------------------------------------------------


@pytest.fixture
async def figma_client():
    """路由测试用最小 app:只挂 figma_import router(不经 app.main 全链导入)。

    原因:并行会话正在重构 app/services/sandbox/(在途 WIP),app.main 的导入链
    当前被其 break(与 D31 无关);路由层鉴权 require_request_user_id 在
    development + 空 jwt_secret 下回落 dev-anonymous,无需中间件即可测。
    """
    from fastapi import FastAPI

    from app.routers import figma_import as figma_router_mod

    app = FastAPI()
    app.include_router(figma_router_mod.router, prefix="/api")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_router_not_configured_returns_503(figma_client, monkeypatch):
    """未配 token:503 + FIGMA_NOT_CONFIGURED(detail 内确定性错误码)。"""
    monkeypatch.delenv(FIGMA_TOKEN_ENV, raising=False)
    resp = await figma_client.post(
        "/api/figma/import",
        json={"fileKey": "fk", "nodeId": "1:2", "target": "react"},
    )
    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail["code"] == "FIGMA_NOT_CONFIGURED"


async def test_router_success_with_fake_importer(figma_client, monkeypatch):
    """路由层契约:200 → {code, language, irSummary, warnings, degraded}。"""
    # 路由在调用期从 services 模块惰性取 FigmaImporter,故 patch 源头
    import app.services.figma_importer as service_mod

    class FakeImporter:
        async def import_design(self, file_key, node_id, target):
            assert (file_key, node_id, target) == ("fk", "1:2", "react")
            return {
                "code": "export default function A() {}",
                "language": "tsx",
                "ir": {"type": "frame", "name": "Card"},
                "irSummary": {"name": "Card", "nodeCount": 3},
                "warnings": ["样本告警"],
                "degraded": False,
            }

    monkeypatch.setattr(service_mod, "FigmaImporter", FakeImporter)
    resp = await figma_client.post(
        "/api/figma/import", json={"fileKey": "fk", "nodeId": "1:2", "target": "react"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "export default function A() {}"
    assert body["language"] == "tsx"
    assert body["irSummary"]["name"] == "Card"
    assert body["warnings"] == ["样本告警"]
    assert body["degraded"] is False


async def test_router_bad_target_returns_422(figma_client, monkeypatch):
    """target 不在 react/taro → 422(不进入服务层)。"""
    monkeypatch.delenv(FIGMA_TOKEN_ENV, raising=False)
    resp = await figma_client.post(
        "/api/figma/import",
        json={"fileKey": "fk", "nodeId": "1:2", "target": "vue"},
    )
    assert resp.status_code == 422
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
