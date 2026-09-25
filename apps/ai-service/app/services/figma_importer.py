# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D31 设计稿转码:Figma Frame/组件 → 中间表示(IR) → 可运行前端代码。

对标 Trae 设计还原。三段式管线(2026-09-26 立):

1. **fetch_figma_node**:GET https://api.figma.com/v1/files/{file_key}/nodes?ids={node_id}
   (X-Figma-Token 头)。`FIGMA_API_TOKEN` env 门控:**未配置时 fail-closed**——
   抛 FIGMA_NOT_CONFIGURED 确定性错误码,绝不发网络请求、绝不产出半成品。
2. **节点树简化(simplify_to_ir)**:递归提取 layout(相对父节点的 x/y/w/h)、
   fills(纯色/渐变 → CSS)、cornerRadius、文本(字符/字号/字重/颜色)、
   图片引用(只记 imageRef,不下载资源)、auto-layout 轴向(row/column/gap/padding)
   → 中间表示 IR(IRNode dataclass)。带 MAX_DEPTH + MAX_NODES 双防爆栈护栏。
3. **generate_code_from_ir**:target ∈ {react, taro}。系统提示词约束 LLM 生成
   React+Tailwind(或 Taro)组件代码,调 llm_gateway.complete。
   LLM 失败/超时 → **确定性降级**:由 IR 直接渲染 HTML+内联样式骨架
   (仍然可用,不白屏),响应带 degraded=true 与降级告警。

httpx.AsyncClient 注入式(构造函数参数,测试可注入 fake transport);
未注入时按需创建并在使用后关闭。无新增第三方依赖(httpx 已有)。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from dataclasses import asdict, dataclass, field
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 常量与门控
# ---------------------------------------------------------------------------

FIGMA_TOKEN_ENV = "FIGMA_API_TOKEN"
FIGMA_API_BASE = "https://api.figma.com/v1"
FETCH_TIMEOUT_SECONDS = 30.0  # 任务书:超时 30s
LLM_TIMEOUT_SECONDS = 60.0    # LLM 生成超时,超时走确定性降级

# 防爆栈/防提示词爆炸双护栏:深度超限截断(不发网络后仍是纯本地计算,防
# Python 递归栈爆 + 万级节点把 LLM 提示词撑爆)
MAX_DEPTH = 24
MAX_NODES = 4000

# IR JSON 进提示词的预算(字符数);超出截断并告警,避免超长上下文拖垮 LLM
IR_PROMPT_BUDGET_CHARS = 24000

# file_key / node_id 白名单校验(防 URL 注入;node_id 形如 "1:2" 允许冒号)
_FILE_KEY_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_NODE_ID_RE = re.compile(r"^[A-Za-z0-9:_-]{1,128}$")

# 支持的产物目标
SUPPORTED_TARGETS = ("react", "taro")


class FigmaImportError(Exception):
    """确定性错误码异常:路由层映射为 HTTP 状态码 + code,不暴露堆栈。"""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _get_token_from_env() -> str:
    """读 FIGMA_API_TOKEN;未配置 → FIGMA_NOT_CONFIGURED(fail-closed,零网络)。"""
    token = (os.environ.get(FIGMA_TOKEN_ENV) or "").strip()
    if not token:
        raise FigmaImportError(
            "FIGMA_NOT_CONFIGURED",
            "未配置 FIGMA_API_TOKEN,设计稿转码不可用;请在环境变量中配置 Figma Personal Access Token 后重试",
        )
    return token


# ---------------------------------------------------------------------------
# 中间表示(IR)
# ---------------------------------------------------------------------------


@dataclass
class IRNode:
    """设计稿节点的中间表示。字段即 LLM 提示词与降级骨架共用的布局语义。"""

    type: str  # frame | text | rect | group | image | other
    name: str = ""
    x: float = 0.0  # 相对父节点的坐标(Figma absoluteBoundingBox 差值)
    y: float = 0.0
    width: float = 0.0
    height: float = 0.0
    opacity: float = 1.0
    background: str | None = None  # CSS background(纯色/渐变近似)
    border_radius: float | None = None
    flex_direction: str | None = None  # auto-layout: row | column
    gap: float | None = None
    padding: list[float] | None = None  # [上, 右, 下, 左]
    text: str | None = None  # type=text 时的字符内容
    font_size: float | None = None
    font_weight: int | None = None
    color: str | None = None  # 文字颜色(CSS)
    image_ref: str | None = None  # 图片填充仅记引用,不下载资源
    children: list[IRNode] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["children"] = [c.to_dict() for c in self.children]
        # None 字段不进提示词,压缩 token
        return {k: v for k, v in d.items() if v is not None}


def _rgba_to_css(color: dict[str, Any] | None, opacity: float = 1.0) -> str | None:
    """Figma color {r,g,b,a}(0..1)→ CSS 颜色。"""
    if not color:
        return None
    r = round(float(color.get("r", 0)) * 255)
    g = round(float(color.get("g", 0)) * 255)
    b = round(float(color.get("b", 0)) * 255)
    a = float(color.get("a", 1)) * float(opacity)
    if a >= 0.999:
        return f"#{r:02x}{g:02x}{b:02x}"
    return f"rgba({r}, {g}, {b}, {round(a, 3)})"


def _fills_to_background(fills: list[dict[str, Any]], opacity: float) -> tuple[str | None, str | None]:
    """fills → (CSS background, imageRef)。纯色直出;渐变近似为 linear-gradient;
    图片填充只记 imageRef 引用(不下载资源)。只取第一个可见填充。"""
    for paint in fills or []:
        if paint.get("visible") is False:
            continue
        ptype = paint.get("type", "")
        if ptype == "SOLID":
            css = _rgba_to_css(paint.get("color"), opacity)
            if css:
                return css, None
        elif ptype.startswith("GRADIENT_"):
            stops = paint.get("gradientStops") or []
            # 渐变角度按 90deg 近似(gradientTransform 矩阵到角度的精确换算
            # 对生成代码收益有限),色标逐个转 CSS,误差记录在告警里
            colors = [c for c in (_rgba_to_css(s.get("color")) for s in stops) if c]
            if colors:
                return f"linear-gradient(90deg, {', '.join(colors)})", None
        elif ptype == "IMAGE":
            # 只记引用不下载:下游可按需走 Figma images API 取真图
            return None, paint.get("imageRef") or None
    return None, None


_FONT_WEIGHT_BY_STYLE = {
    "thin": 100, "extralight": 200, "light": 300, "regular": 400,
    "medium": 500, "semibold": 600, "bold": 700, "extrabold": 800, "black": 900,
}


def _text_font_weight(node: dict[str, Any]) -> int | None:
    """字重:style.fontWeight 数值优先,否则按 fontName.style 名称启发式映射。"""
    style = node.get("style") or {}
    w = style.get("fontWeight")
    if isinstance(w, (int, float)) and 100 <= w <= 900:
        return int(w)
    font_style = str(((node.get("fontName") or {}).get("style")) or "").strip().lower()
    return _FONT_WEIGHT_BY_STYLE.get(font_style)


def _simplify_node(
    node: dict[str, Any],
    parent_bbox: dict[str, float] | None,
    depth: int,
    warnings: list[str],
    stats: dict[str, int],
) -> IRNode | None:
    """递归简化单个 Figma 节点 → IRNode。

    防爆栈:depth >= MAX_DEPTH 即截断(不再递归);visited 超过 MAX_NODES 截断。
    """
    stats["visited"] += 1
    if depth > stats["max_depth_reached"]:
        stats["max_depth_reached"] = depth
    if stats["visited"] > MAX_NODES:
        if "节点数超过上限,已截断部分子树" not in warnings:
            warnings.append("节点数超过上限,已截断部分子树")
        return None
    if depth >= MAX_DEPTH:
        if "节点树超过最大深度,超出部分已截断" not in warnings:
            warnings.append("节点树超过最大深度,超出部分已截断")
        return None
    if node.get("visible") is False:
        return None

    bbox = node.get("absoluteBoundingBox") or {}
    ntype = str(node.get("type", "")).upper()
    width = float(bbox.get("width") or 0)
    height = float(bbox.get("height") or 0)
    # 相对父节点坐标(根节点自己就是原点)
    x = float(bbox.get("x") or 0) - float((parent_bbox or {}).get("x") or 0)
    y = float(bbox.get("y") or 0) - float((parent_bbox or {}).get("y") or 0)

    opacity = float(node.get("opacity", 1) if node.get("opacity") is not None else 1)
    fills = node.get("fills") or []
    background, image_ref = _fills_to_background(fills, opacity)

    corner_radius = node.get("cornerRadius")
    if corner_radius is None and node.get("rectangleCornerRadii"):
        corner_radius = max(node["rectangleCornerRadii"])

    # auto-layout 轴向 → flex 语义
    layout_mode = str(node.get("layoutMode") or "").upper()
    flex_direction = {"HORIZONTAL": "row", "VERTICAL": "column"}.get(layout_mode)
    gap = node.get("itemSpacing") if flex_direction else None
    padding = None
    if flex_direction and any(
        node.get(k) for k in ("paddingTop", "paddingRight", "paddingBottom", "paddingLeft")
    ):
        padding = [
            float(node.get("paddingTop") or 0),
            float(node.get("paddingRight") or 0),
            float(node.get("paddingBottom") or 0),
            float(node.get("paddingLeft") or 0),
        ]

    # 类型归一:TEXT 优先;有图片引用记 image;其余按语义粗分
    if ntype == "TEXT":
        ir_type = "text"
    elif image_ref:
        ir_type = "image"
    elif ntype in ("RECTANGLE", "ELLIPSE", "LINE", "VECTOR"):
        ir_type = "rect"
    elif ntype in ("FRAME", "COMPONENT", "INSTANCE", "SECTION"):
        ir_type = "frame"
    else:
        ir_type = "group"

    ir = IRNode(
        type=ir_type,
        name=str(node.get("name") or "")[:120],
        x=round(x, 2),
        y=round(y, 2),
        width=round(width, 2),
        height=round(height, 2),
        opacity=round(opacity, 3),
        background=background,
        border_radius=float(corner_radius) if corner_radius is not None else None,
        flex_direction=flex_direction,
        gap=float(gap) if gap is not None else None,
        padding=padding,
        text=str(node.get("characters"))[:2000] if ntype == "TEXT" else None,
        font_size=float(style) if (style := (node.get("style") or {}).get("fontSize")) else None,
        font_weight=_text_font_weight(node) if ntype == "TEXT" else None,
        color=next(
            (c for c in (_rgba_to_css(p.get("color")) for p in fills if p.get("visible") is not False) if c),
            None,
        ) if ntype == "TEXT" else None,
        image_ref=image_ref,
    )
    if image_ref:
        stats["image_refs"] += 1
    if ntype == "TEXT":
        stats["text_nodes"] += 1

    for child in node.get("children") or []:
        child_ir = _simplify_node(child, bbox, depth + 1, warnings, stats)
        if child_ir is not None:
            ir.children.append(child_ir)
    return ir


def simplify_to_ir(document: dict[str, Any]) -> tuple[IRNode, list[str], dict[str, int]]:
    """Figma 文件 API 返回的 document 节点 → (IR 根节点, warnings, 统计)。"""
    warnings: list[str] = []
    # 深度统计只在 MAX_DEPTH 护栏内的递归里记(_simplify_node 内),
    # 刻意不预先遍历全树——万级深度的树会在护栏生效前就爆掉 Python 递归栈
    stats = {"visited": 0, "image_refs": 0, "text_nodes": 0, "max_depth_reached": 0}
    # 根节点以自身 bbox 为原点(相对坐标归零)
    root = _simplify_node(document, document.get("absoluteBoundingBox"), 0, warnings, stats)
    if root is None:
        # 仅在极端情况(首个节点就超限/不可见)发生;给个空壳保住响应结构
        root = IRNode(type="frame", name=str(document.get("name") or "root"))
        warnings.append("根节点未能解析为 IR,已输出空骨架")
    return root, warnings, stats


def ir_summary(ir: IRNode, stats: dict[str, int]) -> dict[str, Any]:
    """响应用的 IR 摘要(不含完整树,控制响应体积)。"""
    return {
        "name": ir.name,
        "type": ir.type,
        "width": ir.width,
        "height": ir.height,
        "nodeCount": stats["visited"],
        "textCount": stats["text_nodes"],
        "imageRefCount": stats["image_refs"],
        "maxDepthReached": min(stats["max_depth_reached"], MAX_DEPTH),
    }


# ---------------------------------------------------------------------------
# FigmaImporter(httpx client 注入式)
# ---------------------------------------------------------------------------


class FigmaImporter:
    """Figma 拉取 → IR → 代码生成。

    Args:
        client: 注入式 httpx.AsyncClient(测试塞 fake transport);None 则按需创建。
        token: 显式 token(测试用);None 则读 FIGMA_API_TOKEN env。
    """

    def __init__(
        self,
        client: httpx.AsyncClient | None = None,
        token: str | None = None,
    ) -> None:
        self._client = client
        self._token = token

    async def fetch_figma_node(self, file_key: str, node_id: str) -> dict[str, Any]:
        """拉取 Figma 节点原始 JSON。token 门控在最先:未配置 → 零网络直接抛错。"""
        # 1) 门控(fail-closed:无 token 绝不发网络、绝不半成品)
        token = self._token if self._token is not None else _get_token_from_env()
        # 2) 入参白名单(防 URL 注入)
        if not _FILE_KEY_RE.match(file_key or ""):
            raise FigmaImportError("FIGMA_BAD_PARAM", "fileKey 格式非法")
        if not _NODE_ID_RE.match(node_id or ""):
            raise FigmaImportError("FIGMA_BAD_PARAM", "nodeId 格式非法")
        # 3) 网络
        url = f"{FIGMA_API_BASE}/files/{file_key}/nodes"
        headers = {"X-Figma-Token": token}
        try:
            if self._client is not None:
                resp = await self._client.get(url, params={"ids": node_id}, headers=headers)
            else:
                async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
                    resp = await client.get(url, params={"ids": node_id}, headers=headers)
        except FigmaImportError:
            raise
        except Exception as exc:  # 网络错误/超时 → 确定性错误码
            logger.warning("figma fetch failed: %s", exc)
            raise FigmaImportError("FIGMA_FETCH_FAILED", f"请求 Figma API 失败: {exc}") from exc

        if resp.status_code == 403 or resp.status_code == 401:
            raise FigmaImportError("FIGMA_AUTH_FAILED", "Figma token 无效或无权访问该文件")
        if resp.status_code == 404:
            raise FigmaImportError("FIGMA_NODE_NOT_FOUND", "Figma 文件或节点不存在")
        if resp.status_code != 200:
            raise FigmaImportError("FIGMA_API_ERROR", f"Figma API 返回 {resp.status_code}")

        try:
            data = resp.json()
        except ValueError as exc:
            raise FigmaImportError("FIGMA_API_ERROR", "Figma API 返回非 JSON 响应") from exc
        nodes: dict[str, Any] = data.get("nodes") or {}
        doc: dict[str, Any] | None = (nodes.get(node_id) or {}).get("document")
        if doc is None:
            raise FigmaImportError("FIGMA_NODE_NOT_FOUND", f"节点 {node_id} 不存在或已删除")
        return doc

    # ------------------------------------------------------------------
    # 代码生成(LLM + 确定性降级)
    # ------------------------------------------------------------------

    async def generate_code_from_ir(self, ir: IRNode, target: str, warnings: list[str]) -> dict[str, Any]:
        """IR → 代码。LLM 成功返回 {code, language, degraded:False};失败/超时
        确定性降级为 HTML+内联样式骨架,degraded=True,永不白屏。"""
        if target not in SUPPORTED_TARGETS:
            raise FigmaImportError("FIGMA_BAD_TARGET", f"不支持的目标: {target}(可选 react/taro)")

        ir_json = json.dumps(ir.to_dict(), ensure_ascii=False)
        if len(ir_json) > IR_PROMPT_BUDGET_CHARS:
            ir_json = ir_json[:IR_PROMPT_BUDGET_CHARS]
            warnings.append("IR 超出提示词预算,已截断(生成结果可能不完整)")

        system_prompt = (
            "你是资深前端工程师。根据用户提供的 Figma 节点中间表示(IR)JSON,生成可运行的前端组件代码。\n"
            "- target=react:输出单个 React 函数组件(TSX + Tailwind CSS 类),export default;\n"
            "- target=taro:输出单个 Taro 组件(TSX,使用 @tarojs/components 的 View/Text/Image,样式内联),export default;\n"
            "- 保持 IR 中的布局语义:节点坐标/尺寸用绝对定位或 auto-layout(flex row/column + gap/padding)还原;\n"
            "- 颜色/圆角/字号/字重/文字内容逐字段对照 IR,不要杜撰;\n"
            "- image_ref 是 Figma 图片引用(尚未下载),用占位元素并保留 data-image-ref 属性;\n"
            "- 只输出代码本身,不要解释、不要 markdown 代码围栏以外的内容。"
        )
        user_prompt = f"target={target}\nIR:\n{ir_json}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            # 惰性导入:避免模块加载期拖起整个 LLM 网关依赖链
            from ..core.llm_gateway import llm_gateway

            result = await asyncio.wait_for(
                llm_gateway.complete(messages, model=None), timeout=LLM_TIMEOUT_SECONDS
            )
            content = str((result or {}).get("content") or "").strip()
            code = _strip_code_fences(content)
            if not code:
                raise ValueError("LLM 返回空内容")
            language = "tsx"
            return {"code": code, "language": language, "degraded": False}
        except Exception as exc:
            logger.warning("figma LLM 生成失败,确定性降级: %s", exc)
            warnings.append(f"LLM 生成失败,已降级为确定性 HTML 骨架({type(exc).__name__})")
            return {
                "code": render_skeleton_html(ir),
                "language": "html",
                "degraded": True,
            }

    async def import_design(self, file_key: str, node_id: str, target: str) -> dict[str, Any]:
        """完整管线:门控 → 拉取 → IR → 生成。返回:
        {code, language, ir, irSummary, warnings, degraded}。"""
        warnings: list[str] = []
        document = await self.fetch_figma_node(file_key, node_id)
        ir, simplify_warnings, stats = simplify_to_ir(document)
        warnings.extend(simplify_warnings)
        if stats["image_refs"] > 0:
            warnings.append(
                f"检测到 {stats['image_refs']} 处图片填充,仅记录 imageRef 引用,未下载资源"
            )
        generated = await self.generate_code_from_ir(ir, target, warnings)
        return {
            **generated,
            "ir": ir.to_dict(),
            "irSummary": ir_summary(ir, stats),
            "warnings": warnings,
        }


def _strip_code_fences(content: str) -> str:
    """剥掉 LLM 常见的 ```lang ... ``` 围栏;无围栏原样返回。"""
    m = re.search(r"```[a-zA-Z]*\s*\n(.*?)```", content, re.DOTALL)
    if m:
        return m.group(1).strip()
    return content.strip()


# ---------------------------------------------------------------------------
# 确定性降级:IR → HTML+内联样式骨架(不依赖 LLM,永不白屏)
# ---------------------------------------------------------------------------


def render_skeleton_html(ir: IRNode) -> str:
    """由 IR 直接渲染 HTML+内联样式骨架。确定性(同 IR 同输出)。"""
    parts: list[str] = []
    _render_node(ir, parts, indent=2)
    return "\n".join(parts)


def _render_node(node: IRNode, parts: list[str], indent: int) -> None:
    pad = " " * indent
    styles = [
        "position: absolute",
        f"left: {node.x}px",
        f"top: {node.y}px",
        f"width: {max(0.0, node.width)}px",
        f"height: {max(0.0, node.height)}px",
    ]
    if node.opacity < 1:
        styles.append(f"opacity: {node.opacity}")
    if node.background:
        styles.append(f"background: {node.background}")
    if node.border_radius is not None:
        styles.append(f"border-radius: {node.border_radius}px")
    if node.flex_direction:
        styles.append("display: flex")
        styles.append(f"flex-direction: {node.flex_direction}")
        if node.gap is not None:
            styles.append(f"gap: {node.gap}px")
        if node.padding:
            p = node.padding
            styles.append(f"padding: {p[0]}px {p[1]}px {p[2]}px {p[3]}px")

    if node.type == "text" or node.text is not None:
        if node.font_size:
            styles.append(f"font-size: {node.font_size}px")
        if node.font_weight:
            styles.append(f"font-weight: {node.font_weight}")
        if node.color:
            styles.append(f"color: {node.color}")
        text = (node.text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        parts.append(f'{pad}<div style="{"; ".join(styles)}">{text}</div>')
        return
    if node.image_ref:
        parts.append(
            f'{pad}<div style="{"; ".join(styles)}" data-image-ref="{node.image_ref}" '
            f'data-name="{_esc_attr(node.name)}"><!-- 图片占位:待按 imageRef 下载 --></div>'
        )
        return

    parts.append(f'{pad}<div style="{"; ".join(styles)}" data-name="{_esc_attr(node.name)}">')
    for child in node.children:
        _render_node(child, parts, indent + 2)
    parts.append(f"{pad}</div>")


def _esc_attr(text: str) -> str:
    return text.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


__all__ = [
    "FIGMA_TOKEN_ENV",
    "FigmaImportError",
    "FigmaImporter",
    "IRNode",
    "MAX_DEPTH",
    "MAX_NODES",
    "render_skeleton_html",
    "simplify_to_ir",
    "ir_summary",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
