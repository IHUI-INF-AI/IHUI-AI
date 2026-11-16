# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WFP 隔离拓扑纯逻辑层 — 统一实现 沙箱 Windows Filtering Platform 取证。

设计依据
--------
``内部规格`` 四个只读探针(wfp_probe/enum_filter/
verify_layer/layer_map.c)实测的 Codex 沙箱 WFP 拓扑常量::

    provider  = {2E31D31C-3948-4753-9117-E5D1A6496F41}
    sublayer  = {E65054FD-4D32-4C7C-95EF-621F0CF6431A}   # 12 条 filter 共用
    filter-layer(独立分析) = {9EFF6C8C-C97F-9282-A186-72CB0A338ADA}
    layer_map.c 识别的 4 个 ALE 标准层 GUID

设计边界
--------
本模块只做**拓扑纯逻辑**: GUID 格式化/解析、action 分类、filter→layer 归类、
独立分析预测与实测比对。不做 IO、不调 WFP 引擎(那需 Windows + fwpuclnt)。
C 探针是装机取证工具; 本模块是其判定逻辑的可移植、可单测版本。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum

__all__ = [
    "CODEX_PROVIDER_GUID",
    "CODEX_SUBLAYER_GUID",
    "REVERSE_ENGINEERED_LAYER_GUID",
    "ALE_LAYER_GUIDS",
    "FilterAction",
    "WfpFilter",
    "guid_to_str",
    "guid_from_str",
    "action_of",
    "layer_name_of",
    "filter_matches_codex",
    "reconcile_reverse_prediction",
    "is_standard_well_known_layer",
]


# ---------------------------------------------------------------------------
# 取证确证的拓扑常量
# ---------------------------------------------------------------------------
CODEX_PROVIDER_GUID = "2E31D31C-3948-4753-9117-E5D1A6496F41"
CODEX_SUBLAYER_GUID = "E65054FD-4D32-4C7C-95EF-621F0CF6431A"
# 独立分析得到的自定义 layer GUID(12 条 filter 是否共用它 = U3/U4 验证点)
REVERSE_ENGINEERED_LAYER_GUID = "9EFF6C8C-C97F-9282-A186-72CB0A338ADA"

# wfp_layer_map.c 识别的 4 个 ALE 标准层
ALE_LAYER_GUIDS: dict[str, str] = {
    "c38d57d1-05a7-4c33-904f-7fbceee60e82": "ALE_AUTH_CONNECT_V4",
    "4a72393b-319f-44bc-84c3-ba54dcb3b6b4": "ALE_AUTH_CONNECT_V6",
    "1247d66d-0b60-4a15-8d44-7155d0f53a0c": "ALE_RESOURCE_ASSIGN_V4",
    "55a650e1-5f0a-4eca-a653-88f53b26aa8c": "ALE_RESOURCE_ASSIGN_V6",
}


# ---------------------------------------------------------------------------
# GUID 处理
# ---------------------------------------------------------------------------
_GUID_RE = re.compile(
    r"^\{?([0-9A-Fa-f]{8})-([0-9A-Fa-f]{4})-([0-9A-Fa-f]{4})"
    r"-([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})"
    r"-([0-9A-Fa-f]{12})\}?$"
)


def guid_from_str(text: str) -> str | None:
    """校验并规范化 GUID 为大写标准形; 非法返回 None。"""
    m = _GUID_RE.match(text.strip())
    if not m:
        return None
    p1, p2, p3, p4, p5, p6 = m.groups()
    return f"{p1.upper()}-{p2.upper()}-{p3.upper()}-{p4.upper()}{p5.upper()}-{p6.upper()}"


def guid_to_str(guid: str) -> str:
    """输出 C 探针 printf 形态 ``{XXXXXXXX-...}``(大写带花括号)。"""
    return "{" + guid_from_str(guid).upper() + "}" if guid_from_str(guid) else ""


# ---------------------------------------------------------------------------
# Filter action 分类
# ---------------------------------------------------------------------------
class FilterAction(StrEnum):
    BLOCK = "BLOCK"
    PERMIT = "PERMIT"
    OTHER = "OTHER"


# FWP_ACTION_* 语义(R11 实测确证, 06-wfp-filter-fields.md §六纠错):
#   FWP_ACTION_BLOCK  = 0x00000001 | FWP_ACTION_FLAG_TERMINATING(0x1000) = 0x1001
#   FWP_ACTION_PERMIT = 0x00000002 | FWP_ACTION_FLAG_TERMINATING(0x1000) = 0x1002
# 判定须用基础动作位掩码, 不能比裸值(实测 filter 写入 0x1001)。
_FWP_ACTION_FLAG_TERMINATING = 0x00001000
_FWP_ACTION_BASE_MASK = 0x0000FFFF & ~_FWP_ACTION_FLAG_TERMINATING
_FWP_ACTION_BLOCK = 0x00000001
_FWP_ACTION_PERMIT = 0x00000002


def action_of(raw: int) -> FilterAction:
    """把 FWP_ACTION_* 原始值分类为 BLOCK/PERMIT/OTHER。

    R11 实测: 真实 filter 的 ``action.type`` = 0x1001(= BLOCK | 终止标志),
    故须先掩掉终止标志取基础动作位。裸 0x1 与带标志 0x1001 均判 BLOCK。
    """
    base = raw & _FWP_ACTION_BASE_MASK
    if base == _FWP_ACTION_BLOCK:
        return FilterAction.BLOCK
    if base == _FWP_ACTION_PERMIT:
        return FilterAction.PERMIT
    return FilterAction.OTHER


def layer_name_of(layer_guid: str) -> str:
    """把 layer GUID 映射为可读名; 未知返回 UNKNOWN。"""
    norm = guid_from_str(layer_guid)
    if norm is None:
        return "UNKNOWN"
    return ALE_LAYER_GUIDS.get(norm.lower(), "UNKNOWN")


# ---------------------------------------------------------------------------
# Filter 模型 + 归属判定
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class WfpFilter:
    """一条 WFP filter 的取证快照(纯数据, 由探针枚举产出)。"""

    name: str
    filter_key: str
    sublayer_key: str
    layer_key: str
    action: FilterAction
    num_conditions: int = 0
    flags: int = 0


def filter_matches_codex(f: WfpFilter) -> bool:
    """判断 filter 是否属 Codex 沙箱(按 sublayer 归属, 探针的过滤逻辑)。"""
    norm = guid_from_str(f.sublayer_key)
    return norm is not None and norm == CODEX_SUBLAYER_GUID


# ---------------------------------------------------------------------------
# 独立分析预测比对(U3/U4 验证逻辑)
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class ReconcileVerdict:
    """独立分析 layer GUID 预测 vs 实测 filter 集的比对结论。"""

    codex_filter_count: int
    layer_match_count: int
    prediction_holds: bool
    summary: str


def reconcile_reverse_prediction(
    filters: list[WfpFilter],
    predicted_layer_guid: str = REVERSE_ENGINEERED_LAYER_GUID,
) -> ReconcileVerdict:
    """比对: 属 Codex 的 filter 是否都落在预测 layer 上。

    - 全部匹配且 >0 → 预测成立(共用同一 layer)
    - 全不匹配 → 预测不成立, 需重审
    - 部分匹配 → 部分成立

    注: R11 实测已推翻"12 条共用自定义 layer {9EFF6C8C}"的静态预测 —— 实际
    12 条落在标准 well-known layer。此函数保留通用比对能力; 传标准 layer GUID
    即可验证实测结论。
    """
    predicted = guid_from_str(predicted_layer_guid)
    codex = [f for f in filters if filter_matches_codex(f)]
    matched = 0
    if predicted is not None:
        matched = sum(1 for f in codex if guid_from_str(f.layer_key) == predicted)
    count = len(codex)
    if count > 0 and matched == count:
        ok, summary = True, f"{matched}/{count} 共用同一 layer → 预测成立"
    elif matched == 0:
        ok, summary = False, f"0/{count} 匹配预测 layer → 预测不成立, 需重审"
    else:
        ok, summary = False, f"{matched}/{count} 部分匹配预测 layer"
    return ReconcileVerdict(count, matched, ok, summary)


# ---------------------------------------------------------------------------
# R11 实测验证: 标准 well-known layer 归属判定
# ---------------------------------------------------------------------------
def is_standard_well_known_layer(layer_guid: str) -> bool:
    """判断 layer GUID 是否为 ALE 标准 well-known layer(R11 实测结论)。

    R11 实测: Codex 12 条 filter 的 layerKey 全是标准 well-known layer,
    0/12 匹配被推翻的自定义 GUID {9EFF6C8C}。
    """
    norm = guid_from_str(layer_guid)
    return norm is not None and norm.lower() in ALE_LAYER_GUIDS
