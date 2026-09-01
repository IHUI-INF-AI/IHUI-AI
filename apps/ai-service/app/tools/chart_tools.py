# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""图表生成工具 — 让 LLM 通过工具调用生成 ECharts 图表。

零依赖方案:纯字符串拼接生成独立 HTML 文件,内嵌 echarts.min.js(CDN 引入),
无需任何第三方 Python 包(若本机装有 matplotlib 也不依赖,仅作可选项)。

支持图表类型:
- line/bar:  xAxis category + 多系列 series
- pie:       series pie + data(名称/数值)
- scatter:   单系列 points 或多系列 series.points

安全性:
- chart_type 白名单校验
- data JSON 解析失败/缺字段/数值非法均返回结构化错误,不抛异常
- output_dir 必须落在项目根下(os.path.abspath 校验,拒绝路径逃逸)
"""

from __future__ import annotations

import html
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 项目根 = G:/IHUI-AI (app/tools -> app -> ai-service -> apps -> IHUI-AI)
_PROJECT_ROOT = Path(__file__).resolve().parents[4]
# 默认输出目录(相对项目根)
_DEFAULT_OUTPUT_DIR = _PROJECT_ROOT / "tmp" / "charts"

# 支持的图表类型白名单
_ALLOWED_CHART_TYPES = {"line", "bar", "pie", "scatter"}

# ECharts CDN 引用(国内环境可替换为本地 echarts.min.js)
_ECHARTS_CDN = "https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"

# 图表容器高度
_CHART_HEIGHT_PX = 520


def _to_float(value: Any) -> tuple[float | None, str | None]:
    """把任意值尝试转为 float;失败返回错误信息(显式拒绝 bool)。"""
    if isinstance(value, bool):
        return None, "布尔值不能作为数值"
    try:
        return float(value), None
    except (TypeError, ValueError):
        return None, f"无法转为数值: {value!r}"


def _slugify(text: str, max_len: int = 24) -> str:
    """标题转文件名安全片段:保留中英文/数字/连字符,其余替换为下划线。"""
    slug = re.sub(r"[^\w\u4e00-\u9fff-]+", "_", text, flags=re.UNICODE)
    slug = re.sub(r"_+", "_", slug).strip("_-")
    if not slug:
        slug = "chart"
    return slug[:max_len]


def _resolve_output_dir(output_dir: str) -> Path:
    """解析输出目录并校验必须落在项目根内,防止路径逃逸。

    Raises:
        ValueError: 输出目录不在项目根下
    """
    root = _PROJECT_ROOT.resolve()
    target = Path(output_dir).expanduser()
    if not target.is_absolute():
        # 相对路径一律按"相对项目根"解析
        target = root / target
    target = target.resolve()
    try:
        target.relative_to(root)
    except ValueError:
        raise ValueError(
            f"output_dir 必须位于项目根({_PROJECT_ROOT})内,拒绝: {output_dir}"
        ) from None
    return target


def _validate_xy(payload: Any) -> dict[str, Any]:
    """校验 line/bar 数据: {x: [...], series: [{name, values}, ...]}。"""
    if not isinstance(payload, dict):
        raise ValueError("line/bar 的 data 必须是对象,包含 x 与 series")
    x = payload.get("x")
    if not isinstance(x, list) or not x:
        raise ValueError("line/bar 的 data.x 必须是非空数组")
    series = payload.get("series")
    if not isinstance(series, list) or not series:
        raise ValueError("line/bar 的 data.series 必须是非空数组")

    x_labels = [str(item) for item in x]
    norm_series: list[dict[str, Any]] = []
    for idx, item in enumerate(series):
        if not isinstance(item, dict):
            raise ValueError(f"series[{idx}] 必须是对象")
        name = item.get("name")
        if not isinstance(name, str) or not name:
            raise ValueError(f"series[{idx}].name 必须是非空字符串")
        values = item.get("values")
        if not isinstance(values, list):
            raise ValueError(f"series[{idx}].values 必须是非空数组")
        nums: list[float] = []
        for j, v in enumerate(values):
            num, err = _to_float(v)
            if err:
                raise ValueError(f"series[{idx}].values 第 {j + 1} 个值{err}")
            nums.append(num)
        if len(nums) != len(x_labels):
            raise ValueError(
                f"series[{idx}].values 长度({len(nums)})与 x 长度({len(x_labels)})不一致"
            )
        norm_series.append({"name": name, "data": nums})
    return {"x": x_labels, "series": norm_series}


def _validate_pie(payload: Any) -> dict[str, Any]:
    """校验 pie 数据: [{name, value}, ...]。"""
    if not isinstance(payload, list) or not payload:
        raise ValueError("pie 的 data 必须是非空数组,如 [{name, value}, ...]")
    items: list[dict[str, Any]] = []
    for idx, item in enumerate(payload):
        if not isinstance(item, dict):
            raise ValueError(f"data[{idx}] 必须是对象")
        name = item.get("name")
        if not isinstance(name, str) or not name:
            raise ValueError(f"data[{idx}].name 必须是非空字符串")
        value, err = _to_float(item.get("value"))
        if err:
            raise ValueError(f"data[{idx}].value{err}")
        items.append({"name": name, "value": value})
    return {"data": items}


def _check_points(points: Any) -> list[list[float]]:
    """校验散点坐标数组: [[x, y], ...],每个点两个坐标均可转 float。"""
    if not isinstance(points, list) or not points:
        raise ValueError("points 必须是非空数组")
    norm: list[list[float]] = []
    for i, pt in enumerate(points):
        if not isinstance(pt, (list, tuple)) or len(pt) != 2:
            raise ValueError(f"points 第 {i + 1} 个点必须是 [x, y] 二元数组")
        x, err_x = _to_float(pt[0])
        y, err_y = _to_float(pt[1])
        if err_x or err_y:
            raise ValueError(f"points 第 {i + 1} 个点的坐标{err_x or err_y}")
        norm.append([x, y])
    return norm


def _validate_scatter(payload: Any) -> dict[str, Any]:
    """校验 scatter 数据: {points: [[x,y],...]} 或 {series: [{name, points}, ...]}。"""
    if not isinstance(payload, dict):
        raise ValueError("scatter 的 data 必须是对象,包含 points 或 series")
    if "points" in payload:
        return {"series": [{"name": "散点", "data": _check_points(payload["points"])}]}
    series = payload.get("series")
    if not isinstance(series, list) or not series:
        raise ValueError("scatter 的 data 必须包含非空的 points 或 series")
    norm_series: list[dict[str, Any]] = []
    for idx, item in enumerate(series):
        if not isinstance(item, dict):
            raise ValueError(f"series[{idx}] 必须是对象")
        name = item.get("name")
        if not isinstance(name, str) or not name:
            raise ValueError(f"series[{idx}].name 必须是非空字符串")
        norm_series.append({"name": name, "data": _check_points(item.get("points"))})
    return {"series": norm_series}


def _parse_and_validate(chart_type: str, data: str) -> dict[str, Any]:
    """解析 data JSON 并按图表类型校验结构,返回规范化数据。

    Raises:
        ValueError: JSON 非法或数据结构不满足要求
    """
    try:
        payload = json.loads(data)
    except json.JSONDecodeError as exc:
        raise ValueError(f"data 不是合法 JSON: {exc}") from exc
    if chart_type in ("line", "bar"):
        return _validate_xy(payload)
    if chart_type == "pie":
        return _validate_pie(payload)
    return _validate_scatter(payload)


def _build_option(chart_type: str, title: str, payload: dict[str, Any]) -> dict[str, Any]:
    """按图表类型构建 ECharts option(数据已通过校验)。"""
    option: dict[str, Any] = {
        "title": {"text": title, "left": "center"},
        "tooltip": {},
    }
    if chart_type in ("line", "bar"):
        option["xAxis"] = {"type": "category", "data": payload["x"]}
        option["yAxis"] = {"type": "value"}
        option["series"] = [
            {
                "name": s["name"],
                "type": chart_type,
                "data": s["data"],
                "smooth": chart_type == "line",
                "symbolSize": 6,
            }
            for s in payload["series"]
        ]
    elif chart_type == "pie":
        option["tooltip"] = {"trigger": "item", "formatter": "{b}: {c} ({d}%)"}
        option["legend"] = {"bottom": 0}
        option["series"] = [
            {
                "name": title,
                "type": "pie",
                "radius": "60%",
                "center": ["50%", "45%"],
                "data": payload["data"],
            }
        ]
    else:  # scatter
        option["xAxis"] = {"type": "value"}
        option["yAxis"] = {"type": "value"}
        option["series"] = [
            {"name": s["name"], "type": "scatter", "data": s["data"], "symbolSize": 8}
            for s in payload["series"]
        ]
    return option


def _render_html(title: str, option: dict[str, Any]) -> str:
    """渲染为完整独立 ECharts HTML 文件(纯字符串生成,零依赖)。"""
    option_json = json.dumps(option, ensure_ascii=False)
    safe_title = html.escape(title)
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{safe_title}</title>
<!-- 国内环境可替换为本地 echarts.min.js -->
<script src="{_ECHARTS_CDN}"></script>
</head>
<body style="margin:0;padding:16px;background:#fff;font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif;">
<div id="chart" style="width:100%;height:{_CHART_HEIGHT_PX}px"></div>
<script>
var chart = echarts.init(document.getElementById('chart'));
var option = {option_json};
chart.setOption(option);
window.addEventListener('resize', function () {{ chart.resize(); }});
</script>
</body>
</html>
"""


async def generate_chart(arguments: dict) -> dict[str, Any]:
    """生成 ECharts 图表 HTML 文件(工具调用入口)。

    输入:
        chart_type: line | bar | pie | scatter(白名单校验)
        title:      图表标题
        data:       JSON 字符串,结构按图表类型区分
        output_dir: 可选,输出目录,默认 tmp/charts(相对项目根)

    返回:
        成功: {"tool": "generate_chart", "ok": True, "file_path": ..., "relative_path": ..., "message": "图表已生成"}
        失败: {"tool": "generate_chart", "ok": False, "errorCode": ..., "message": ...}
    """
    tool_name = "generate_chart"
    try:
        if not isinstance(arguments, dict):
            return {
                "tool": tool_name, "ok": False, "errorCode": "INVALID_ARGS",
                "message": "arguments 必须为 dict",
            }

        chart_type = arguments.get("chart_type")
        title = arguments.get("title")
        data = arguments.get("data")
        output_dir = arguments.get("output_dir")

        # chart_type 白名单校验
        if not isinstance(chart_type, str) or chart_type not in _ALLOWED_CHART_TYPES:
            allowed = "/".join(sorted(_ALLOWED_CHART_TYPES))
            return {
                "tool": tool_name, "ok": False, "errorCode": "INVALID_CHART_TYPE",
                "message": f"chart_type 非法,仅支持: {allowed},收到: {chart_type!r}",
            }
        # title 校验
        if not isinstance(title, str) or not title.strip():
            return {
                "tool": tool_name, "ok": False, "errorCode": "MISSING_TITLE",
                "message": "title 必填且不能为空",
            }
        # data 校验
        if not isinstance(data, str) or not data.strip():
            return {
                "tool": tool_name, "ok": False, "errorCode": "MISSING_DATA",
                "message": "data 必填且不能为空",
            }
        # output_dir 类型校验
        if output_dir is not None and not isinstance(output_dir, str):
            return {
                "tool": tool_name, "ok": False, "errorCode": "INVALID_OUTPUT_DIR",
                "message": "output_dir 必须为字符串",
            }

        try:
            payload = _parse_and_validate(chart_type, data)
            option = _build_option(chart_type, title.strip(), payload)
            out_dir = _resolve_output_dir(output_dir or str(_DEFAULT_OUTPUT_DIR))
        except ValueError as exc:
            return {
                "tool": tool_name, "ok": False, "errorCode": "INVALID_DATA",
                "message": str(exc),
            }

        out_dir.mkdir(parents=True, exist_ok=True)
        html_content = _render_html(title.strip(), option)

        # 文件名: 时间戳 + slug(已存在则追加序号,保证不覆盖)
        ts = datetime.now().strftime("%Y%m%d_%H%M")
        slug = _slugify(title.strip())
        path = out_dir / f"{ts}_{slug}.html"
        seq = 1
        while path.exists():
            path = out_dir / f"{ts}_{slug}_{seq}.html"
            seq += 1

        try:
            path.write_text(html_content, encoding="utf-8")
        except OSError as exc:
            logger.error("图表文件写入失败: %s", exc)
            return {
                "tool": tool_name, "ok": False, "errorCode": "WRITE_FAILED",
                "message": f"图表文件写入失败: {exc}",
            }

        file_path = str(path).replace("\\", "/")
        try:
            relative_path = str(path.relative_to(_PROJECT_ROOT.resolve())).replace("\\", "/")
        except ValueError:
            relative_path = file_path

        logger.info("图表已生成: %s", file_path)
        return {
            "tool": tool_name, "ok": True,
            "file_path": file_path,
            "relative_path": relative_path,
            "message": "图表已生成",
        }
    except Exception as exc:  # 兜底:绝不向上层抛异常
        logger.exception("generate_chart 未预期异常")
        return {
            "tool": tool_name, "ok": False, "errorCode": "INTERNAL_ERROR",
            "message": f"图表生成失败: {exc}",
        }
