# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D31 设计稿转码服务: Figma Frame/组件 → 可运行 React+Tailwind 代码(对标 Trae 设计还原)。

链路(取数 → 裁剪 → 模型 → 产出 → 护栏):
1. 输入 Figma file key + node id(或粘贴 Figma URL),走 Figma REST API 取节点树 + 导出图;
2. 节点树裁剪(纯函数 `prune_node_tree`):去 hidden/无限深/超量,只保留布局与样式相关字段;
3. 构造给视觉模型的转码提示(`build_transcode_prompt`),复用 `llm_gateway.complete`
   (与 `services/vision_helper.py` 同一份 LLM 出口,不新建调用栈);
4. 产出代码先过 §4 前端约束的静态护栏(`lint_generated_code` 纯函数:
   不得含 `!important`、不得用 emoji 当图标、圆角必须取档位类);
5. Figma 令牌缺失 **fail-closed**:抛/返回明确错误码 `FIGMA_TOKEN_MISSING`,
   绝不在拿不到真实设计数据时回退假数据(失败必须响,不得静默产出"看起来成功"的码)。

错误码清单(全部显式,不冒绿):
- FIGMA_TOKEN_MISSING / FIGMA_URL_INVALID / FIGMA_NODE_ID_INVALID
- FIGMA_UNAUTHORIZED / FIGMA_NOT_FOUND / FIGMA_RATE_LIMITED / FIGMA_FETCH_FAILED / FIGMA_BAD_PAYLOAD
- LLM_FAILED / LLM_BAD_OUTPUT / TRANSCODE_INTERNAL

测试隔离(§5 铁律):本模块所有真实网络与 LLM 调用只经两个接缝
`_http_json()` / `_llm_complete()`,单测一律 monkeypatch 这两个模块属性,
零真实 Figma / LLM / PG / Redis 触达。
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, cast
from urllib.parse import urlparse

import httpx

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

FIGMA_API_BASE = "https://api.figma.com/v1"
# 令牌唯一来源 = 服务端环境变量(§5d:密钥不入仓、不入聊天)。多候选按优先级取第一个非空。
TOKEN_ENV_KEYS: tuple[str, ...] = ("FIGMA_TOKEN", "FIGMA_ACCESS_TOKEN")

# 裁剪默认预算:视觉模型上下文有限,深树按 BFS 序截断并如实标 truncated(不静默丢)。
DEFAULT_MAX_DEPTH = 12
DEFAULT_MAX_NODES = 400


class FigmaTranscodeError(Exception):
    """预期内的转码失败:携带稳定错误码,路由层直接透出,不折成 500。"""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


# ---------------------------------------------------------------------------
# 输入解析:URL / file key / node id
# ---------------------------------------------------------------------------

_FILE_KEY_RE = re.compile(r"^[A-Za-z0-9]{10,}$")
_NODE_ID_RE = re.compile(r"^\d+:\d+$")


def normalize_node_id(raw: str) -> str:
    """Figma 节点 id 归一:`123-456` → `123:456`;非法即抛 FIGMA_NODE_ID_INVALID。"""
    candidate = (raw or "").strip().replace("-", ":")
    if not _NODE_ID_RE.match(candidate):
        raise FigmaTranscodeError(
            "FIGMA_NODE_ID_INVALID",
            f"node id 非法(期望形如 '123:456' 或 '123-456'): {raw!r}",
        )
    return candidate


def parse_figma_url(url: str) -> tuple[str, str | None]:
    """从粘贴的 Figma URL 解析 (file_key, node_id|None)。

    支持 https://www.figma.com/{file|design|proto}/<key>/<name>...,
    节点取自 query 的 node-id / nodeId(`1-23` 与 `1:23` 两形态都归一)。
    """
    parsed = urlparse((url or "").strip())
    if parsed.scheme not in ("http", "https") or "figma.com" not in parsed.netloc:
        raise FigmaTranscodeError("FIGMA_URL_INVALID", f"不是合法的 Figma URL: {url!r}")
    segments = [s for s in parsed.path.split("/") if s]
    # 期望 [file|design|proto, key, name?]
    if len(segments) < 2 or segments[0] not in ("file", "design", "proto"):
        raise FigmaTranscodeError("FIGMA_URL_INVALID", f"Figma URL 路径缺少 file key: {url!r}")
    file_key = segments[1]
    if not _FILE_KEY_RE.match(file_key):
        raise FigmaTranscodeError("FIGMA_URL_INVALID", f"Figma URL 中的 file key 非法: {file_key!r}")
    node_id: str | None = None
    query = parsed.query
    m = re.search(r"(?:^|&)node[-_]?id=([^&]+)", query, re.IGNORECASE)
    if m:
        raw = m.group(1)
        if "-" in raw or ":" in raw:
            node_id = normalize_node_id(raw)
    return file_key, node_id


def resolve_figma_token() -> str:
    """fail-closed 取 Figma 个人访问令牌:任何候选环境变量都为空即抛,绝不回退假数据。"""
    for key in TOKEN_ENV_KEYS:
        value = os.environ.get(key, "").strip()
        if value:
            return value
    raise FigmaTranscodeError(
        "FIGMA_TOKEN_MISSING",
        "服务端未配置 Figma 访问令牌(FIGMA_TOKEN / FIGMA_ACCESS_TOKEN 均为空),"
        "转码请求被拒绝;不产出任何占位/模拟设计数据",
    )


# ---------------------------------------------------------------------------
# Figma REST 取数接缝(唯一网络出口,单测 monkeypatch 本函数)
# ---------------------------------------------------------------------------

async def _http_json(
    url: str,
    *,
    headers: dict[str, str],
    params: dict[str, str] | None = None,
    timeout: float = 30.0,
) -> dict[str, Any]:
    """GET 并解析 JSON。非 2xx 折算为带稳定错误码的 FigmaTranscodeError。"""
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers, params=params)
    except httpx.HTTPError as e:
        raise FigmaTranscodeError("FIGMA_FETCH_FAILED", f"Figma REST 网络失败: {type(e).__name__}: {e}") from e
    if resp.status_code in (401, 403):
        raise FigmaTranscodeError(
            "FIGMA_UNAUTHORIZED",
            f"Figma 令牌无效或无该文件权限(HTTP {resp.status_code})",
        )
    if resp.status_code == 404:
        raise FigmaTranscodeError("FIGMA_NOT_FOUND", f"Figma 文件/节点不存在(HTTP 404): {url}")
    if resp.status_code == 429:
        raise FigmaTranscodeError("FIGMA_RATE_LIMITED", "Figma REST 限流(HTTP 429),请稍后重试")
    if resp.status_code >= 400:
        raise FigmaTranscodeError("FIGMA_FETCH_FAILED", f"Figma REST HTTP {resp.status_code}: {url}")
    try:
        payload: Any = resp.json()
    except ValueError as e:
        raise FigmaTranscodeError("FIGMA_BAD_PAYLOAD", f"Figma REST 响应非 JSON: {e}") from e
    if not isinstance(payload, dict):
        raise FigmaTranscodeError("FIGMA_BAD_PAYLOAD", "Figma REST 响应不是对象")
    return cast("dict[str, Any]", payload)


def _auth_headers(token: str) -> dict[str, str]:
    return {"X-Figma-Token": token}


async def fetch_node_document(token: str, file_key: str, node_id: str) -> dict[str, Any]:
    """GET /files/<key>/nodes?ids=<node> 并抽出该节点的 document。"""
    payload = await _http_json(
        f"{FIGMA_API_BASE}/files/{file_key}/nodes",
        headers=_auth_headers(token),
        params={"ids": node_id},
    )
    nodes = payload.get("nodes")
    if not isinstance(nodes, dict) or not nodes:
        raise FigmaTranscodeError("FIGMA_NOT_FOUND", f"Figma 响应无 nodes: file={file_key} node={node_id}")
    entry = next(iter(nodes.values()))
    if not isinstance(entry, dict):
        raise FigmaTranscodeError("FIGMA_BAD_PAYLOAD", "Figma nodes 条目形态异常")
    document = entry.get("document")
    if not isinstance(document, dict):
        raise FigmaTranscodeError("FIGMA_BAD_PAYLOAD", "Figma node 缺少 document 字段")
    return cast("dict[str, Any]", document)


async def fetch_image_url(token: str, file_key: str, node_id: str, scale: int = 2) -> str | None:
    """GET /images/<key>?ids=<node>&format=png → 导出图 URL。失败不致命(返回 None,如实登记)。"""
    try:
        payload = await _http_json(
            f"{FIGMA_API_BASE}/images/{file_key}",
            headers=_auth_headers(token),
            params={"ids": node_id, "format": "png", "scale": str(scale)},
        )
    except FigmaTranscodeError as e:
        logger.warning("[figma] 导出图获取失败(降级为纯结构转码): %s", e.message)
        return None
    meta = payload.get("meta")
    images = meta.get("images") if isinstance(meta, dict) else None
    if not isinstance(images, dict):
        return None
    url = next(iter(images.values()), None)
    return url if isinstance(url, str) and url else None


async def download_image_data_uri(url: str, max_bytes: int = 10 * 1024 * 1024) -> str:
    """下载导出图转 base64 data URI(喂给视觉模型;与 vision_helper 同一形态)。"""
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.content
    except httpx.HTTPError as e:
        raise FigmaTranscodeError("FIGMA_FETCH_FAILED", f"导出图下载失败: {type(e).__name__}: {e}") from e
    if len(data) > max_bytes:
        raise FigmaTranscodeError("FIGMA_FETCH_FAILED", f"导出图过大({len(data)} bytes)")
    ctype = resp.headers.get("content-type", "image/png").split(";")[0].strip().lower()
    mime = ctype if ctype.startswith("image/") else "image/png"
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


# ---------------------------------------------------------------------------
# 节点树裁剪(纯函数)
# ---------------------------------------------------------------------------

_COLOR_KEYS = ("fills", "strokes")
_LAYOUT_KEYS = (
    "layoutMode",
    "primaryAxisAlignItems",
    "counterAxisAlignItems",
    "itemSpacing",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "paddingBottom",
    "layoutAlign",
    "layoutGrow",
)
_RADIUS_KEYS = ("cornerRadius", "rectangleCornerRadii", "cornerRadii")
_TYPO_KEYS = ("fontName", "fontSize", "fontWeight", "letterSpacing", "lineHeightPx", "textAlignHorizontal")


def _color_to_hex(color: dict[str, Any], opacity: Any = None) -> str:
    def _ch(v: Any) -> int:
        return max(0, min(255, round(float(v) * 255))) if isinstance(v, (int, float)) else 0

    r, g, b = _ch(color.get("r")), _ch(color.get("g")), _ch(color.get("b"))
    a = 1.0
    if isinstance(opacity, (int, float)):
        a = float(opacity)
    if a >= 0.999:
        return f"#{r:02X}{g:02X}{b:02X}"
    return f"#{r:02X}{g:02X}{b:02X}{max(0, min(255, round(a * 255))):02X}"


def _paint_summary(paints: Any) -> list[str]:
    """fills/strokes → 紧凑描述列表:SOLID 记 hex,其余只记类型(不搬原始大对象)。"""
    if not isinstance(paints, list):
        return []
    out: list[str] = []
    for paint in paints:
        if not isinstance(paint, dict) or paint.get("visible") is False:
            continue
        kind = paint.get("type")
        if kind == "SOLID":
            color = paint.get("color")
            if isinstance(color, dict):
                out.append(_color_to_hex(color, paint.get("opacity")))
        elif isinstance(kind, str):
            out.append(kind.lower())
    return out


def _prune_node(
    node: dict[str, Any],
    depth: int,
    budget: list[int],
    max_depth: int,
    stats: dict[str, int],
) -> dict[str, Any] | None:
    if budget[0] <= 0:
        stats["dropped_by_budget"] += 1
        return None
    if node.get("visible") is False:
        stats["dropped_hidden"] += 1
        return None
    budget[0] -= 1
    pruned: dict[str, Any] = {}
    for key in ("id", "name", "type"):
        value = node.get(key)
        if isinstance(value, str):
            pruned[key] = value
    characters = node.get("characters")
    if isinstance(characters, str):
        pruned["text"] = characters[:500]
    bbox = node.get("absoluteBoundingBox")
    if isinstance(bbox, dict):
        box: dict[str, float] = {}
        for k in ("x", "y", "width", "height"):
            v = bbox.get(k)
            if isinstance(v, (int, float)):
                box[k] = round(float(v), 2)
        if box:
            pruned["box"] = box
    for key in _LAYOUT_KEYS + _RADIUS_KEYS + _TYPO_KEYS:
        value = node.get(key)
        if isinstance(value, (str, int, float)) or key in ("rectangleCornerRadii", "cornerRadii", "fontName"):
            if isinstance(value, (str, int, float, list, dict)):
                pruned[key] = value
    for key in _COLOR_KEYS:
        summary = _paint_summary(node.get(key))
        if summary:
            pruned[key] = summary
    opacity = node.get("opacity")
    if isinstance(opacity, (int, float)) and opacity < 0.999:
        pruned["opacity"] = round(float(opacity), 3)
    children = node.get("children")
    if isinstance(children, list) and children:
        if depth + 1 > max_depth:
            stats["dropped_over_depth"] += len(children)
            pruned["childrenTruncated"] = True
        else:
            kept: list[dict[str, Any]] = []
            for child in children:
                if isinstance(child, dict):
                    pruned_child = _prune_node(child, depth + 1, budget, max_depth, stats)
                    if pruned_child is not None:
                        kept.append(pruned_child)
            if kept:
                pruned["children"] = kept
    return pruned


@dataclass
class PruneResult:
    """裁剪结果:树 + 如实统计(truncated 必须可见,不得静默丢节点)。"""

    tree: dict[str, Any]
    kept_nodes: int
    dropped_hidden: int
    dropped_over_depth: int
    dropped_by_budget: int

    @property
    def truncated(self) -> bool:
        return (self.dropped_over_depth + self.dropped_by_budget) > 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "keptNodes": self.kept_nodes,
            "droppedHidden": self.dropped_hidden,
            "droppedOverDepth": self.dropped_over_depth,
            "droppedByBudget": self.dropped_by_budget,
            "truncated": self.truncated,
        }


def count_nodes(node: dict[str, Any]) -> int:
    total = 1
    children = node.get("children")
    if isinstance(children, list):
        for child in children:
            if isinstance(child, dict):
                total += count_nodes(child)
    return total


def prune_node_tree(
    document: dict[str, Any],
    *,
    max_depth: int = DEFAULT_MAX_DEPTH,
    max_nodes: int = DEFAULT_MAX_NODES,
) -> PruneResult:
    """裁剪 Figma document:去 hidden、限深度与总量,只留布局/样式相关字段。"""
    stats = {"dropped_hidden": 0, "dropped_over_depth": 0, "dropped_by_budget": 0}
    budget = [max_nodes]
    tree = _prune_node(document, 0, budget, max_depth, stats)
    if tree is None:
        raise FigmaTranscodeError("FIGMA_BAD_PAYLOAD", "节点树裁剪后为空(根节点不可见或预算为 0)")
    return PruneResult(
        tree=tree,
        kept_nodes=count_nodes(tree),
        dropped_hidden=stats["dropped_hidden"],
        dropped_over_depth=stats["dropped_over_depth"],
        dropped_by_budget=stats["dropped_by_budget"],
    )


# ---------------------------------------------------------------------------
# 转码提示构造
# ---------------------------------------------------------------------------

# §4 前端 UI 约束的模型侧投影:产出必须自带档位化写法,出口再有一道 lint 护栏兜底。
_SYSTEM_PROMPT = """你是资深前端工程师,把 Figma 设计稿节点树还原为可运行的 React + Tailwind 组件代码。
硬性约束(违反即废):
1. 样式只用 Tailwind 类名;圆角只允许档位 rounded-xs/sm/md/lg/xl/2xl/full(真圆头像可 rounded-full),禁止 rounded-[任意值] 与内联 borderRadius 数字。
2. 禁止 !important;禁止 emoji 当图标 —— 图标一律 import { X } from 'lucide-react' 渲染 <X className="h-4 w-4" />。
3. 颜色尽量映射到语义类(bg-card/bg-background/text-foreground/border-border 等),取不到语义档时才用十六进制任意值。
4. 禁止单边 border-t/b/l/r 当分割线,用间距或背景对比;禁止 mask-image/linear-gradient 边缘淡出。
5. 尺寸参考节点 box(px):w-[Npx]/h-[Npx]/p-[Npx] 这类任意值允许,优先贴近 spacing 档位。
6. 输出单个默认导出的函数组件,附最少必要的 props 类型;代码放在一个 ```tsx 围栏内,不要输出解释文字。"""


def build_transcode_prompt(
    tree: dict[str, Any],
    prune_stats: dict[str, Any],
    image_data_uri: str | None,
    *,
    extra_requirements: str | None = None,
) -> list[dict[str, Any]]:
    """构造 OpenAI 形态 messages:有导出图则带 vision block,无图如实降级为纯结构转码。"""
    structure = json.dumps(tree, ensure_ascii=False, separators=(",", ":"))
    notes = (
        f"节点裁剪统计: {json.dumps(prune_stats, ensure_ascii=False)}"
        + ("(树被截断,被丢子树按同名模式合理外推)" if prune_stats.get("truncated") else "")
    )
    requirement = f"\n补充需求: {extra_requirements}" if extra_requirements else ""
    text = (
        "Figma 设计稿节点树(JSON,含 box 尺寸/fills 颜色 hex/布局字段):\n"
        f"{structure}\n\n{notes}{requirement}"
    )
    content: list[dict[str, Any]] = [{"type": "text", "text": text}]
    if image_data_uri:
        content.insert(0, {"type": "image_url", "image_url": {"url": image_data_uri}})
    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": content},
    ]


_FENCE_RE = re.compile(r"```(?:tsx|jsx|typescript|javascript)?\s*\n(.*?)```", re.DOTALL)


def extract_code(text: str) -> str:
    """从模型输出提取 ```tsx 围栏内代码;无围栏取全文。空输出抛 LLM_BAD_OUTPUT。"""
    stripped = (text or "").strip()
    if not stripped:
        raise FigmaTranscodeError("LLM_BAD_OUTPUT", "模型输出为空")
    m = _FENCE_RE.search(stripped)
    code = m.group(1) if m else stripped
    if not code.strip():
        raise FigmaTranscodeError("LLM_BAD_OUTPUT", "模型输出中无有效代码")
    return code.strip()


# ---------------------------------------------------------------------------
# 输出侧静态护栏(§4 约束,纯函数)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class GuardrailViolation:
    rule: str
    detail: str

    def to_dict(self) -> dict[str, str]:
        return {"rule": self.rule, "detail": self.detail}


RADIUS_STEP_CLASSES: frozenset[str] = frozenset(
    {"xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full"}
)
_SIDE_VARIANTS: frozenset[str] = frozenset({"t", "b", "l", "r", "tl", "tr", "bl", "br", "ss", "se", "es", "ee"})

_ROUNDED_CLASS_RE = re.compile(r"\brounded(-([a-z0-9]+))*\b")
_EMOJI_RANGES: tuple[tuple[int, int], ...] = (
    (0x1F000, 0x1FAFF),
    (0x2600, 0x27BF),
    (0x2B00, 0x2BFF),
    (0xFE0F, 0xFE0F),
    (0x1F1E6, 0x1F1FF),
)
_IMPORTANT_RE = re.compile(r"-\w+\s*:\s*[^;}\n]*!important|!important")
_INLINE_RADIUS_RE = re.compile(r"borderRadius\s*:\s*['\"`]?\s*\d")
_CSS_RADIUS_RE = re.compile(r"border-radius\s*:\s*['\"`]?\s*\d")
_IMPORT_LUCIDE_RE = re.compile(r"from\s+['\"]lucide-react['\"]")


def strip_js_comments(code: str) -> str:
    """剥 // 行注释与 /* */ 块注释,保留字符串内容(护栏判的是实际产出的代码)。"""
    out: list[str] = []
    i = 0
    n = len(code)
    state: str = "code"  # code | line | block | squote | dquote | backtick
    while i < n:
        ch = code[i]
        nxt = code[i + 1] if i + 1 < n else ""
        if state == "code":
            if ch == "/" and nxt == "/":
                state = "line"
                i += 2
                continue
            if ch == "/" and nxt == "*":
                state = "block"
                i += 2
                continue
            if ch == "'":
                state = "squote"
            elif ch == '"':
                state = "dquote"
            elif ch == "`":
                state = "backtick"
            out.append(ch)
            i += 1
        elif state == "line":
            if ch == "\n":
                state = "code"
                out.append(ch)
            i += 1
        elif state == "block":
            if ch == "*" and nxt == "/":
                state = "code"
                i += 2
                continue
            if ch == "\n":
                out.append(ch)
            i += 1
        else:  # 字符串态:保留内容,只处理转义与闭合
            quote = {"squote": "'", "dquote": '"', "backtick": "`"}[state]
            if ch == "\\":
                out.append(ch)
                if i + 1 < n:
                    out.append(code[i + 1])
                i += 2
                continue
            out.append(ch)
            if ch == quote:
                state = "code"
            elif ch == "$" and state == "backtick" and nxt == "{":
                # 模板字符串插值段:内部按代码态继续(保守:整段仍按 backtick 跟踪会漏,
                # 但插值内出现 !important/emoji 的形态极罕见,宁窄不误)
                out.append(nxt)
                i += 2
                continue
            i += 1
    return "".join(out)


def _contains_emoji(text: str) -> str | None:
    for ch in text:
        cp = ord(ch)
        for lo, hi in _EMOJI_RANGES:
            if lo <= cp <= hi:
                return ch
    return None


def _check_rounded_class(code: str) -> list[GuardrailViolation]:
    violations: list[GuardrailViolation] = []
    for m in re.finditer(r"rounded(?:-\[[^\]]*\])?(?:-[a-z0-9]+)*", code):
        token = m.group(0)
        if "[ " in token or token.endswith("]") or "-[" in token:
            violations.append(
                GuardrailViolation("RADIUS_STEP", f"圆角用了任意值类 `{token}`,必须取 rounded-* 档位")
            )
            continue
        parts = token.split("-")  # ["rounded"] 或 ["rounded", ...] 或 ["rounded","t","lg"]
        sizes = [p for p in parts[1:] if p not in _SIDE_VARIANTS]
        if not sizes:
            continue  # 裸 rounded(8px,全端统一档)允许
        for size in sizes:
            if size not in RADIUS_STEP_CLASSES:
                violations.append(
                    GuardrailViolation("RADIUS_STEP", f"`{token}` 的档位 `{size}` 不在允许集合(仅 rounded-xs/sm/md/lg/xl/2xl/full)")
                )
    return violations


def lint_generated_code(code: str) -> list[GuardrailViolation]:
    """对产出代码跑 §4 静态护栏。返回违规清单(空 = 通过)。纯函数,正反例均有单测。"""
    effective = strip_js_comments(code)
    violations: list[GuardrailViolation] = []
    if _IMPORTANT_RE.search(effective):
        violations.append(GuardrailViolation("NO_IMPORTANT", "代码含 !important(AGENTS §4 禁止)"))
    emoji = _contains_emoji(effective)
    if emoji is not None:
        violations.append(
            GuardrailViolation("NO_EMOJI_ICON", f"代码含 emoji 字符 `{emoji}` —— UI 图标必须用 lucide-react 矢量图标")
        )
    if _INLINE_RADIUS_RE.search(effective):
        violations.append(GuardrailViolation("RADIUS_STEP", "内联样式 borderRadius 写了数字字面量"))
    if _CSS_RADIUS_RE.search(effective):
        violations.append(GuardrailViolation("RADIUS_STEP", "生成的 CSS 文本里 border-radius 写了 px 字面量"))
    violations.extend(_check_rounded_class(effective))
    if re.search(r"<\s*[A-Za-z][\w.]*\b[^>]*\bicon\s*=\s*['\"]", effective) and not _IMPORT_LUCIDE_RE.search(
        effective
    ):
        violations.append(GuardrailViolation("NO_EMOJI_ICON", "icon 属性传了字符串却未 import lucide-react 图标组件"))
    return violations


# ---------------------------------------------------------------------------
# 任务编排(内存态,进程级;与 dag.py 的 _executions 同形态)
# ---------------------------------------------------------------------------

TASK_TTL_SECONDS = 3600.0
MAX_TRACKED_TASKS = 200

LLMComplete = Callable[..., Awaitable[dict[str, Any]]]


async def _llm_complete(messages: list[dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
    """LLM 唯一接缝:默认走既有 `llm_gateway.complete`(不新建调用栈)。"""
    return await llm_gateway.complete(messages, **kwargs)


@dataclass
class TranscodeTask:
    task_id: str
    user_id: str
    file_key: str
    node_id: str
    status: str = "pending"  # pending | running | succeeded | failed
    created_at: float = field(default_factory=time.time)
    result: dict[str, Any] | None = None
    error_code: str | None = None
    error_message: str | None = None

    def to_public(self) -> dict[str, Any]:
        return {
            "taskId": self.task_id,
            "fileKey": self.file_key,
            "nodeId": self.node_id,
            "status": self.status,
            "createdAt": self.created_at,
            "errorCode": self.error_code,
            "errorMessage": self.error_message,
            "result": self.result,
        }


_tasks: dict[str, TranscodeTask] = {}
_bg_tasks: set[asyncio.Task[None]] = set()


def _prune_store(now: float) -> None:
    expired = [tid for tid, t in _tasks.items() if now - t.created_at > TASK_TTL_SECONDS]
    for tid in expired:
        _tasks.pop(tid, None)
    while len(_tasks) > MAX_TRACKED_TASKS:
        oldest = min(_tasks.values(), key=lambda t: t.created_at).task_id
        _tasks.pop(oldest, None)


def get_task(task_id: str) -> TranscodeTask | None:
    return _tasks.get(task_id)


def reset_task_store() -> None:
    """测试专用:清空任务表,避免用例间串状态。"""
    _tasks.clear()


async def transcode_figma(
    file_key: str,
    node_id: str,
    *,
    extra_requirements: str | None = None,
    model: str | None = None,
    include_image: bool = True,
) -> dict[str, Any]:
    """执行一次完整转码(取数→裁剪→模型→产出→护栏)。失败抛 FigmaTranscodeError。

    返回 {ok, code(生成代码), guardrails(违规清单), prune(裁剪统计), model, stub, degraded}。
    护栏不通过**如实返回违规**(交调用方决定是否回炉),不静默放行也不伪造"通过"。
    """
    token = resolve_figma_token()  # fail-closed:缺令牌直接抛,不发任何网络请求
    document = await fetch_node_document(token, file_key, node_id)
    prune_result = prune_node_tree(document)

    degraded: list[str] = []
    image_uri: str | None = None
    if include_image:
        image_url = await fetch_image_url(token, file_key, node_id)
        if image_url:
            try:
                image_uri = await download_image_data_uri(image_url)
            except FigmaTranscodeError as e:
                degraded.append(f"image_skipped:{e.code}")
                logger.warning("[figma] 导出图不可用,降级纯结构转码: %s", e.message)
        else:
            degraded.append("image_skipped:FIGMA_IMAGE_UNAVAILABLE")

    messages = build_transcode_prompt(prune_result.tree, prune_result.to_dict(), image_uri, extra_requirements=extra_requirements)
    try:
        llm_result = await _llm_complete(messages, model=model, max_tokens=8000)
    except Exception as e:  # noqa: BLE001 — 网关侧异常形态不固定,统一折算稳定错误码
        raise FigmaTranscodeError("LLM_FAILED", f"{type(e).__name__}: {str(e)[:200]}") from e
    if not isinstance(llm_result, dict) or llm_result.get("error"):
        message = ""
        if isinstance(llm_result, dict):
            message = str(llm_result.get("error_message") or llm_result.get("errorCode") or "llm error")[:300]
        raise FigmaTranscodeError("LLM_FAILED", message or "llm error")
    content = llm_result.get("content")
    raw_code = content if isinstance(content, str) else ""
    code = extract_code(raw_code)
    violations = lint_generated_code(code)
    return {
        "ok": True,
        "code": code,
        "guardrails": [v.to_dict() for v in violations],
        "guardrailsPassed": not violations,
        "prune": prune_result.to_dict(),
        "model": llm_result.get("model", model or ""),
        "stub": bool(llm_result.get("stub", False)),
        "visionUsed": image_uri is not None,
        "degraded": degraded,
    }


async def _execute_task(task: TranscodeTask, extra_requirements: str | None) -> None:
    task.status = "running"
    try:
        task.result = await transcode_figma(task.file_key, task.node_id, extra_requirements=extra_requirements)
        task.status = "succeeded"
    except FigmaTranscodeError as e:
        task.status = "failed"
        task.error_code = e.code
        task.error_message = e.message
        logger.warning("[figma] 转码任务 %s 失败: %s %s", task.task_id, e.code, e.message)
    except Exception as e:  # noqa: BLE001 — 后台任务未捕获异常只会静默消失,必须落状态
        task.status = "failed"
        task.error_code = "TRANSCODE_INTERNAL"
        task.error_message = f"{type(e).__name__}: {str(e)[:200]}"
        logger.exception("[figma] 转码任务 %s 内部异常", task.task_id)


def start_transcode_task(user_id: str, file_key: str, node_id: str, *, extra_requirements: str | None = None) -> TranscodeTask:
    """创建并异步启动转码任务,立即返回记录(状态经 GET /figma/tasks/<id> 查询)。"""
    _prune_store(time.time())
    task = TranscodeTask(
        task_id=uuid.uuid4().hex,
        user_id=user_id,
        file_key=file_key,
        node_id=node_id,
    )
    _tasks[task.task_id] = task
    bg = asyncio.create_task(_execute_task(task, extra_requirements))
    _bg_tasks.add(bg)
    bg.add_done_callback(_bg_tasks.discard)
    return task
