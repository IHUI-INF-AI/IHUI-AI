#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型上下文窗口解析(V3 #55,2026-09-26 立)。

背景:AgentLoopV2 的自动压缩由两道闸共同决定 —— 灰度开关
(`AGENT_COMPACTION_MODE`,off/ratio/full + canary 放量,见 compaction_canary.py)
与压缩上限 `compaction_context_limit`(env `AGENT_COMPACTION_CONTEXT_LIMIT`,
默认 0=未配置=永不压缩)。放量基础设施(灰度桶/指标/回退)自 2026-09-12 起齐备,
但 **limit 只能配一个全局静态值** —— 对 1M 窗口的模型过小(过早压缩),
对 32K 的模型过大(永不触发直到上游 400)。这是压缩"代码完整但线上不跑"的
最后一缺工程件。

本模块把上限缺省值改为**按请求模型动态解析**:
- 与 TS 侧 `packages/api-client/src/model-context-capacity.ts` 同源(该表注释
  自述"为 88% 自动压缩而建",兜底同为 128K,原因亦同:2026 主流模型 ≥128K,
  32K 兜底会让自动压缩误触发);
- 只列 **低于 128K 的例外**(TS 表 56 条中筛出 22 条),其余模型一律兜底值 ——
  未知模型上"过晚压缩"的失败方向是上游显式报错(fail-visible),优于静默丢上下文;
- env 显式配置(`AGENT_COMPACTION_CONTEXT_LIMIT` > 0)永远优先于本解析,
  运维覆盖能力不变。

双端同步:TS 表增删条目时须同步 `LOW_WINDOW_OVERRIDES`(暂无自动对账门,
登记于 PROJECT_PLAN.md V3 #55 条目)。
"""

from __future__ import annotations

import os

# 兜底窗口(与 TS DEFAULT_CONTEXT_CAPACITY 同值同因,勿单方面改动)
DEFAULT_CONTEXT_WINDOW = 128_000

# 低于兜底值的模型例外表(条目逐字取自 TS 侧 EXACT_CAPACITY < 128_000 的子集,
# 2026-09-26 对齐快照;TS 侧更新时同步这里)。
LOW_WINDOW_OVERRIDES: dict[str, int] = {
    # === Google ===
    "gemma-2-27b-it": 8_192,
    "gemma-2-9b-it": 8_192,
    # === DeepSeek ===
    "deepseek-chat": 64_000,
    "deepseek-reasoner": 64_000,
    "deepseek-v3": 64_000,
    # === 阿里 ===
    "qwen-max": 32_768,
    # === 月之暗面 ===
    "moonshot-v1-8k": 8_000,
    "moonshot-v1-32k": 32_000,
    # === 字节 ===
    "doubao-1-6-pro": 32_000,
    "doubao-pro-32k": 32_000,
    # === 阶跃 ===
    "stepfun/step-3.7-flash": 8_000,
    "stepfun/step-3.5-flash": 8_000,
    "stepfun/step-router-v1": 8_000,
    # === 腾讯 ===
    "hunyuan-pro": 32_000,
    "hunyuan-turbo": 32_000,
    # === 百度 ===
    "ernie-4.0-turbo-8k": 8_000,
    # === 其他国内 ===
    "baichuan-4-turbo": 32_000,
    "spark-v4": 8_000,
    "yi-large": 32_000,
    "sensenova-5": 32_000,
    "skywork-4": 32_000,
    "internlm2.5-20b": 32_000,
}


def resolve_compaction_context_limit(model: str | None) -> int:
    """按模型解析压缩用的上下文上限(tokens)。

    规则:
    - 精确命中 ``LOW_WINDOW_OVERRIDES`` → 该值;
    - 其余(None/空/未知模型)→ ``DEFAULT_CONTEXT_WINDOW``;
    - env ``AGENT_COMPACTION_CONTEXT_LIMIT`` > 0 时由调用方优先采用(env 覆盖),
      本函数不读 env —— 保持"解析纯函数",env 语义留在 AgentLoopV2 原有链路。
    """
    if not model:
        return DEFAULT_CONTEXT_WINDOW
    normalized = model.strip().lower()
    if not normalized:
        return DEFAULT_CONTEXT_WINDOW
    return LOW_WINDOW_OVERRIDES.get(normalized, DEFAULT_CONTEXT_WINDOW)


def resolve_with_env_priority(model: str | None) -> int:
    """带 env 优先级的完整解析(供 AgentLoopV2 构造点直接使用)。

    ``AGENT_COMPACTION_CONTEXT_LIMIT`` 显式配置(>0)优先 —— 运维覆盖能力不变;
    未配置(0/缺省)时按模型动态解析。**注意语义变化**:env 未配置时不再等价
    "不压缩",而是按模型窗口启用压缩;要彻底关闭请用
    ``AGENT_COMPACTION_MODE=off``(灰度总闸,语义正确且可放量)。
    """
    try:
        env_limit = max(0, int(os.environ.get("AGENT_COMPACTION_CONTEXT_LIMIT", "0")))
    except ValueError:
        env_limit = 0
    if env_limit > 0:
        return env_limit
    return resolve_compaction_context_limit(model)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
