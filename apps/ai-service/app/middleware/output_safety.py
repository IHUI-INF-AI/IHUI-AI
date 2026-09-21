# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""生成内容输出安全检查器 + "AI 生成"标识(2026-09-06 合规新增)。

背景与合规依据:
- 中国《生成式人工智能服务管理暂行办法》第 12 条要求生成内容不得含违法、涉政、暴恐、
  色情、暴力等法律法规禁止内容;第 17 条要求提供具有舆论属性或社会动员能力生成服务的
  应当对生成内容进行标识。
- 本模块作为"输出侧"第二道防线(输入侧已有 input_sanitizer.py / Gemini safety_settings):
  对 LLM 原始输出做关键词/正则分类命中检测,并按风险等级执行免责/降级/阻断。

策略:
- 高风险命中(违法/涉政/暴恐/色情/暴力)→ 阻断或加免责前缀(高风险违禁 → 不直接原样透传);
- 低风险命中(医疗/金融等疑似误导性表述)→ 追加"仅供参考,不构成专业建议";
- 所有生成内容输出统一打 "AI 生成" 标识(接口字段 is_ai_generated=True + 可见展示语)。

扩展点:如需接入内容安全分类 API,可在 `_classify_by_api` 中调用,命中则与关键词结果合并。
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# =============================================================================
# 分类规则(关键词/正则分类器)
# =============================================================================

# 高风险违禁类别 → 阻断或加免责前缀,不原样透传
HIGH_RISK_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    "illegal": [
        re.compile(r"贩毒|制毒|吸毒|买卖毒品|走私毒品|洗钱|洗黑钱|网络赌博|在线赌博|"
                   r"武器走私|贩卖人口|拐卖妇女|拐卖儿童|制假售假|伪造货币|制售假币", re.IGNORECASE),
    ],
    "political": [
        re.compile(r"颠覆国家政权|煽动分裂国家|破坏国家统一|宣扬分裂|颠覆政权|"
                   r"勾连境外势力|危害国家安全|非法集会游行", re.IGNORECASE),
    ],
    "terrorism": [
        re.compile(r"恐怖袭击|恐怖组织|人体炸弹|制爆|制作炸弹|爆炸物配方|"
                   r"劫持.*(飞机|航班|列车)|恐吓袭警", re.IGNORECASE),
    ],
    "porn": [
        re.compile(r"性侵|猥亵儿童|儿童色情|性暴力|卖淫.*(介绍|组织)|强迫*(卖淫|色情)", re.IGNORECASE),
    ],
    "violence": [
        re.compile(r"教唆自杀|自杀.*(方法|诀窍|教程)|虐杀|肢解|活体解剖|"
                   r"校园枪击.*(教程|攻略)|杀人.*(教程|工具)", re.IGNORECASE),
    ],
}

# 低风险疑似误导(医疗/金融等) → 追加"仅供参考,不构成专业建议"
LOW_RISK_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    "medical_misleading": [
        re.compile(r"包治百病|药到病除|保证治愈|一定根治|100%治愈|不反弹|"
                   r"祖传秘方|特效药", re.IGNORECASE),
    ],
    "financial_misleading": [
        re.compile(r"稳赚不赔|保本高收益|必涨|100%盈利|内部消息.*(荐股|拉抬)|"
                   r"无风险.*(理财|投资|收益)|跟单.*(稳盈|暴利)", re.IGNORECASE),
    ],
}

# 触发免责提示语
DISCLAIMER_HIGH = (
    "\n\n⚠️【内容提示】以上内容包含需要警惕的表述,仅作合规提示展示;"
    "请勿据此进行任何违反法律法规的行为。"
)
DISCLAIMER_LOW = (
    "\n\n【内容提示】以上内容由 AI 生成,其中可能涉及医疗/金融等专业领域表述,"
    "仅供参考,不构成专业建议,请以权威信息为准。"
)
# 《生成式人工智能服务管理暂行办法》要求的生成内容标识展示语
AI_GENERATED_LABEL = "本文/本条内容由 AI 生成,请注意甄别。"


@dataclass
class OutputCheck:
    """一次输出安全检查的结果。"""

    risk: str = "none"  # "high" | "low" | "none"
    categories: set[str] = field(default_factory=set)
    hits: list[str] = field(default_factory=list)

    @property
    def blocked(self) -> bool:
        return self.risk == "high"


def _match_patterns(text: str, table: dict[str, list[re.Pattern[str]]]) -> tuple[bool, set[str], list[str]]:
    hit = False
    categories: set[str] = set()
    hits: list[str] = []
    for cat, patterns in table.items():
        for p in patterns:
            m = p.search(text)
            if m:
                hit = True
                categories.add(cat)
                hits.append(m.group(0)[:40])
    return hit, categories, hits


def scan_output(text: str) -> OutputCheck:
    """扫描 LLM 原始输出,返回风险等级与命中信息。"""
    if not text:
        return OutputCheck()
    high_hit, high_cats, high_hits = _match_patterns(text, HIGH_RISK_PATTERNS)
    low_hit, low_cats, low_hits = _match_patterns(text, LOW_RISK_PATTERNS)
    if high_hit:
        return OutputCheck(risk="high", categories=high_cats, hits=high_hits)
    if low_hit:
        return OutputCheck(risk="low", categories=low_cats, hits=low_hits)
    return OutputCheck()


async def classify_by_api(text: str) -> OutputCheck:
    """(扩展点)可选的安全分类 API 调用,与关键词结果合并。

    当前暂不强制接入外部 API(避免增加外部依赖与延迟);如接外部内容安全服务,
    在此调用并 merge 到关键词结果即可。
    """
    return scan_output(text)


def apply_disclaimers(text: str, check: OutputCheck) -> str:
    """按风险等级追加免责/提示语。

    - 高风险:前置免责提示(避免把高风险内容原样作为权威结果透传);
    - 低风险:后缀"仅供参考,不构成专业建议"。
    """
    if not text:
        return text
    if check.risk == "high":
        return DISCLAIMER_HIGH + "\n\n" + text
    if check.risk == "low":
        return text + DISCLAIMER_LOW
    return text


def build_ai_generation_annotation() -> dict[str, Any]:
    """生成"AI 生成内容"标注字段(接口返回用)。"""
    return {
        "is_ai_generated": True,
        "ai_generated_disclaimer": AI_GENERATED_LABEL,
    }


def annotate_ai_generated(payload: dict[str, Any]) -> dict[str, Any]:
    """把 AI 生成标识写入响应 payload(浅合并,不覆盖已有键)。

    前端渲染点说明:
    - chat 页面:在回复气泡/内容顶部展示 payload["ai_generated_disclaimer"];
    - deep-research 页面:在报告标题或正文开头展示同字段标识。
    """
    return {
        **payload,
        **({k: v for k, v in build_ai_generation_annotation().items() if k not in payload}),
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
