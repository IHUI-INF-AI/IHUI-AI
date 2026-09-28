# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""报表/汇报文档生成工具 —— PROJECT_PLAN #81「MTC 工作面」最小一环(2026-09-28)。

票面判据:一种产物模板在**真会话**里产出**可用文件**而非仅提示。选型为「报表」类
(五类:文档/数据表/报表/演示/竞品调研中,它与既有 generate_chart 共用同一套
产物基础设施,端到端只差"生成器"这一段):

- 落盘目录 tmp/artifacts 已在 routers/artifacts.py 的 _ARTIFACT_DIRS 白名单内;
- 产物归属 sidecar(<file>.owner)复用 chart_tools 立的授权模式(签发 token 时校验);
- 返回 relative_path 的取值形态(tmp/artifacts/xxx.html)落在前端 tool-call-card.tsx
  的既有前缀白名单内 → 会话卡片自动换 token 渲染 iframe,零前端改动。

零依赖:纯字符串拼接生成独立 HTML(同 chart_tools 的既定路线),不引入模板引擎。
安全:所有正文 html.escape;sections JSON 解析失败/字段缺失/超限均返回结构化错误,
不抛异常;output_dir 必须落在项目根内(拒绝路径逃逸)。
"""

from __future__ import annotations

import html
import json
import logging
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, TypedDict

logger = logging.getLogger(__name__)


class _Section(TypedDict):
    """归一后的报表节:标题 + 条目列表(mypy strict 下的异构字典)。"""

    heading: str
    items: list[str]

# 项目根 = 仓库根(app/tools -> app -> ai-service -> apps -> IHUI-AI,与 chart_tools 同构)
_PROJECT_ROOT = Path(__file__).resolve().parents[4]
# 默认输出目录:tmp/artifacts(routers/artifacts.py 白名单目录之一)
_DEFAULT_OUTPUT_DIR = _PROJECT_ROOT / "tmp" / "artifacts"

# 输入规模上限:防单文件膨胀(模型产出的报表应在这些量级内)
_MAX_TITLE_LEN = 200
_MAX_SUMMARY_LEN = 4000
_MAX_SECTIONS = 30
_MAX_ITEMS_PER_SECTION = 50
_MAX_ITEM_LEN = 2000


def _slugify(text: str, max_len: int = 24) -> str:
    """标题转文件名安全片段:保留中英文/数字/连字符,其余替换为下划线(同 chart_tools)。"""
    slug = re.sub(r"[^\w\u4e00-\u9fff-]+", "_", text, flags=re.UNICODE)
    slug = re.sub(r"_+", "_", slug).strip("_-")
    if not slug:
        slug = "report"
    return slug[:max_len]


def _resolve_output_dir(output_dir: str) -> Path:
    """解析输出目录并校验必须落在项目根内,防止路径逃逸。

    Raises:
        ValueError: 输出目录不在项目根下
    """
    root = _PROJECT_ROOT.resolve()
    target = Path(output_dir).expanduser()
    if not target.is_absolute():
        target = root / target
    target = target.resolve()
    try:
        target.relative_to(root)
    except ValueError:
        raise ValueError(
            f"output_dir 必须位于项目根({_PROJECT_ROOT})内,拒绝: {output_dir}"
        ) from None
    return target


def _parse_and_validate_sections(raw: str) -> list[_Section]:
    """校验并归一 sections 参数:[{"heading": str, "items": [str, ...]}, ...]。

    Raises:
        ValueError: 结构非法/超限(由调用方转成结构化错误)
    """
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        raise ValueError(f"sections 必须是合法 JSON 字符串: {exc}") from None
    if not isinstance(payload, list) or not payload:
        raise ValueError('sections 必须是非空数组,如 [{"heading":"本周进展","items":["..."]}]')
    if len(payload) > _MAX_SECTIONS:
        raise ValueError(f"sections 数量超限(最多 {_MAX_SECTIONS} 节)")

    sections: list[_Section] = []
    for idx, sec in enumerate(payload):
        if not isinstance(sec, dict):
            raise ValueError(f"sections[{idx}] 必须是对象,含 heading 与 items")
        heading = sec.get("heading")
        if not isinstance(heading, str) or not heading.strip():
            raise ValueError(f"sections[{idx}].heading 必须是非空字符串")
        items = sec.get("items")
        if not isinstance(items, list) or not items:
            raise ValueError(f"sections[{idx}].items 必须是非空字符串数组")
        if len(items) > _MAX_ITEMS_PER_SECTION:
            raise ValueError(f"sections[{idx}].items 数量超限(最多 {_MAX_ITEMS_PER_SECTION} 条)")
        lines: list[str] = []
        for j, item in enumerate(items):
            if not isinstance(item, str) or not item.strip():
                raise ValueError(f"sections[{idx}].items[{j}] 必须是非空字符串")
            if len(item) > _MAX_ITEM_LEN:
                raise ValueError(f"sections[{idx}].items[{j}] 超长(最多 {_MAX_ITEM_LEN} 字)")
            lines.append(item.strip())
        sections.append({"heading": heading.strip(), "items": lines})
    return sections


def _render_html(
    title: str,
    period: str | None,
    summary: str | None,
    sections: list[_Section],
) -> str:
    """渲染独立 HTML 报表(纯字符串拼接,所有插值一律 html.escape)。"""
    safe_title = html.escape(title)
    period_html = (
        f'<p class="period">{html.escape(period)}</p>' if period else ""
    )
    summary_html = (
        f'<section class="summary"><h2>摘要</h2><p>{html.escape(summary)}</p></section>'
        if summary
        else ""
    )
    body_parts: list[str] = []
    for sec in sections:
        lis = "\n".join(f"<li>{html.escape(item)}</li>" for item in sec["items"])
        body_parts.append(
            f'<section>\n<h2>{html.escape(sec["heading"])}</h2>\n<ul>\n{lis}\n</ul>\n</section>'
        )
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{safe_title}</title>
<style>
body {{ margin:0; padding:24px; background:#fff; color:#1f2328;
  font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif; line-height:1.7; }}
main {{ max-width:820px; margin:0 auto; }}
h1 {{ font-size:22px; margin:0 0 4px; }}
.period {{ color:#57606a; margin:0 0 20px; font-size:14px; }}
.summary {{ background:#f6f8fa; padding:12px 16px; margin:0 0 20px; }}
.summary h2 {{ font-size:15px; margin:0 0 6px; }}
h2 {{ font-size:17px; margin:24px 0 8px; }}
ul {{ margin:0; padding-left:22px; }}
li {{ margin:4px 0; }}
footer {{ margin-top:32px; color:#57606a; font-size:12px; }}
</style>
</head>
<body>
<main>
<h1>{safe_title}</h1>
{period_html}
{summary_html}
{chr(10).join(body_parts)}
<footer>由 IHUI AI 会话生成 · {generated_at}</footer>
</main>
</body>
</html>
"""


def _fail(tool_name: str, code: str, message: str) -> dict[str, Any]:
    return {"tool": tool_name, "ok": False, "errorCode": code, "message": message}


async def generate_report(arguments: dict[str, Any]) -> dict[str, Any]:
    """生成报表/汇报文档 HTML 文件(工具调用入口,真会话产物落盘)。

    输入:
        title:      报表标题(必填)
        sections:   JSON 字符串(必填),[{"heading":"节标题","items":["条目",...]}, ...]
        period:     可选,统计周期/日期范围(如 "2026-W39" / "2026-09")
        summary:    可选,顶部摘要段
        output_dir: 可选,输出目录,默认 tmp/artifacts(相对项目根)

    返回:
        成功: {"tool":"generate_report","ok":True,"file_path":...,"relative_path":...,"message":"报表已生成"}
        失败: {"tool":"generate_report","ok":False,"errorCode":...,"message":...}
    """
    tool_name = "generate_report"
    try:
        if not isinstance(arguments, dict):
            return _fail(tool_name, "INVALID_ARGS", "arguments 必须为 dict")

        title = arguments.get("title")
        sections_raw = arguments.get("sections")
        period = arguments.get("period")
        summary = arguments.get("summary")
        output_dir = arguments.get("output_dir")

        if not isinstance(title, str) or not title.strip():
            return _fail(tool_name, "MISSING_TITLE", "title 必填且不能为空")
        title = title.strip()
        if len(title) > _MAX_TITLE_LEN:
            return _fail(
                tool_name, "INVALID_TITLE", f"title 超长(最多 {_MAX_TITLE_LEN} 字)"
            )
        if not isinstance(sections_raw, str) or not sections_raw.strip():
            return _fail(tool_name, "MISSING_SECTIONS", "sections 必填(JSON 字符串)")
        if output_dir is not None and not isinstance(output_dir, str):
            return _fail(tool_name, "INVALID_OUTPUT_DIR", "output_dir 必须为字符串")
        for key, val in (("period", period), ("summary", summary)):
            if val is not None and not isinstance(val, str):
                return _fail(tool_name, f"INVALID_{key.upper()}", f"{key} 必须为字符串")
        if isinstance(summary, str) and len(summary) > _MAX_SUMMARY_LEN:
            return _fail(
                tool_name,
                "INVALID_SUMMARY",
                f"summary 超长(最多 {_MAX_SUMMARY_LEN} 字)",
            )

        try:
            sections = _parse_and_validate_sections(sections_raw)
            out_dir = _resolve_output_dir(output_dir or str(_DEFAULT_OUTPUT_DIR))
        except ValueError as exc:
            return _fail(tool_name, "INVALID_SECTIONS", str(exc))

        out_dir.mkdir(parents=True, exist_ok=True)
        html_content = _render_html(
            title,
            period.strip() if isinstance(period, str) and period.strip() else None,
            summary.strip() if isinstance(summary, str) and summary.strip() else None,
            sections,
        )

        # 文件名:时间戳+slug+随机段(与 chart_tools 同规则,不可枚举、不覆盖)
        ts = datetime.now().strftime("%Y%m%d_%H%M")
        rand = uuid.uuid4().hex[:8]
        path = out_dir / f"{ts}_{_slugify(title)}_{rand}.html"
        seq = 1
        while path.exists():
            path = out_dir / f"{ts}_{_slugify(title)}_{rand}_{seq}.html"
            seq += 1

        try:
            path.write_text(html_content, encoding="utf-8")
        except OSError as exc:
            logger.error("报表文件写入失败: %s", exc)
            return _fail(
                tool_name, "WRITE_FAILED", f"报表文件写入失败: {exc}"
            )

        # 归属 sidecar:与 generate_chart 同一授权契约(artifacts/token 签发时校验,
        # 非本人 403)。__user_id 由 mcp_server.call_tool 注入,LLM 不可控。
        user_id = str(arguments.get("__user_id") or "").strip()
        if user_id:
            try:
                sidecar = Path(str(path) + ".owner")
                sidecar.write_text(
                    json.dumps({"user_id": user_id}, ensure_ascii=False),
                    encoding="utf-8",
                )
            except OSError as exc:
                logger.warning("报表归属 sidecar 写入失败(不阻断): %s", exc)

        file_path = str(path).replace("\\", "/")
        try:
            relative_path = str(path.relative_to(_PROJECT_ROOT.resolve())).replace(
                "\\", "/"
            )
        except ValueError:
            relative_path = file_path

        logger.info("报表已生成: %s", file_path)
        return {
            "tool": tool_name,
            "ok": True,
            "file_path": file_path,
            "relative_path": relative_path,
            "message": "报表已生成",
        }
    except Exception as exc:  # 兜底:绝不向上层抛异常(与 chart_tools 同规)
        logger.exception("generate_report 未预期异常")
        return _fail(tool_name, "INTERNAL_ERROR", f"报表生成失败: {exc}")
