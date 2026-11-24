# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具调用能力实证(2026-11-08)。

立因:上游元数据 `supports_tool_call` 只代表厂商"声称"支持,实测端点可以完全不返回
原生 `tool_calls`,而把工具调用当正文吐出来(例如
`<tool_call><function=run_command>...` 或"我来执行 pwd...执行结果:/home/user")。
该端点被标 true 后,配额故障转移一旦落到它,worker 就会"零工具执行却 completed"。

本模块是这条判据的唯一实现处:
- 痕迹识别(`detect_pseudo_tool_trace`):只认带伪调用痕迹的"应调未调",
  模型合法地不需要工具(纯文本回答、无痕迹)不判失败。
- 判据版本(`TOOL_TRACE_CRITERION_VERSION`):落库时一并记录,判据升级可区分历史结论。
- 实证落库(`record_tool_capability_verdict`):写
  `ai_model_config_models.tool_call_empirical / tool_call_verified_at`,并 append 一条
  `ai_model_tool_call_verifications` 审计行(model/provider/判据版本/时间/痕迹类型)。
- 实证查询(`is_empirically_tool_capable`):带 tools 的故障转移只允许落到实证通过的模型。

同步脚本(model_sync)不得写这两个实证字段 —— 断言在 model_sync.py 里,不靠注释。
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

from .db_pool import get_shared_pool

logger = logging.getLogger(__name__)

# 判据版本:痕迹规则或判据语义变化时递增,历史审计行因此可区分
TOOL_TRACE_CRITERION_VERSION = "tool-trace/v1"

# 伪工具调用痕迹(仅这三类,不做"无 tool_calls 即失败"的泛化判定)
_TRACE_TOOL_CALL_TAG = re.compile(r"<tool_call\s*>", re.IGNORECASE)
_TRACE_FUNCTION_TAG = re.compile(r"<function\s*=", re.IGNORECASE)
_CLAIM_EXECUTED = re.compile(
    r"(已执行|已经执行|执行结果|运行结果|命令输出|已运行|"
    r"executed|execution result|command output|ran successfully)",
    re.IGNORECASE,
)
_CODE_BLOCK = re.compile(r"```")
_PATH_HINT = re.compile(
    r"(/home/|/tmp/|/Users/|C:\\|exitCode|exit_code|exit code)",
    re.IGNORECASE,
)

# 实证查询缓存:(provider_code, bare_model) -> (bool, expires_at)
_VERIFIED_CACHE: dict[tuple[str, str], tuple[bool, float]] = {}
_VERIFIED_CACHE_TTL = 30.0
_VERIFIED_CACHE_MAX = 2000


def _bare_model_id(model_id: str) -> str:
    """去掉厂商路由前缀:`nvidia_nim/stepfun-ai/step-5-preview` → `stepfun-ai/step-5-preview`。

    DB 里 model_id 就是裸模型名(可能自身还带一层 vendor 路径),与既有
    `_find_quota_alternate_channels` 的 bare_model 口径一致。
    """
    return model_id.split("/", 1)[-1] if "/" in model_id else model_id


def detect_pseudo_tool_trace(content: str) -> str | None:
    """返回命中的痕迹类型;未命中返回 None。

    三类判据(2026-11-08 立):
    1. `<tool_call>` 文本块;
    2. `<function=` 文本块;
    3. 声称已执行,且同文给出代码块或运行路径/退出码 —— 只有"声称"没有运行证据
       不单独判失败,避免把正常叙述(如"我将执行…")误伤。
    """
    if not content:
        return None
    if _TRACE_TOOL_CALL_TAG.search(content):
        return "tool_call_tag"
    if _TRACE_FUNCTION_TAG.search(content):
        return "function_tag"
    if _CLAIM_EXECUTED.search(content):
        if _CODE_BLOCK.search(content):
            return "claimed_execution+code_block"
        if _PATH_HINT.search(content):
            return "claimed_execution+path"
    return None


async def record_tool_capability_verdict(
    *,
    model_id: str,
    provider_code: str,
    verdict: str,
    trace_kind: str | None,
    source: str,
) -> None:
    """落一条实证结论(尽力而为:DB 不可用不影响主流程)。

    verdict:
      - `supported`:真实拿到原生 tool_calls;
      - `failed`:tool_calls 为空且命中伪调用痕迹;
      - `no_tool_calls`:为空但无痕迹(不更新 empirical 列,保持 null=未实证)。
    source:`probe`(主动探针)/ `runtime`(线上请求判据)。
    """
    bare = _bare_model_id(model_id)
    empirical: bool | None
    if verdict == "supported":
        empirical = True
    elif verdict == "failed":
        empirical = False
    else:
        empirical = None
    try:
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    """INSERT INTO ai_model_tool_call_verifications
                       (model_id, provider_code, verdict, criterion_version,
                        trace_kind, source, observed_at)
                       VALUES ($1, $2, $3, $4, $5, $6, now())""",
                    bare,
                    provider_code or "",
                    verdict,
                    TOOL_TRACE_CRITERION_VERSION,
                    trace_kind,
                    source,
                )
                if empirical is not None:
                    await conn.execute(
                        """UPDATE ai_model_config_models m
                           SET tool_call_empirical = $3,
                               tool_call_verified_at = now(),
                               updated_at = now()
                           FROM ai_model_config c
                           WHERE m.config_id = c.id
                             AND c.provider_code = $2
                             AND (m.model_id = $1 OR m.model_id LIKE '%/' || $1)""",
                        bare,
                        provider_code or "",
                        empirical,
                    )
                    _VERIFIED_CACHE.pop((provider_code or "", bare), None)
    except Exception as e:  # noqa: BLE001 - 审计落库失败不得拖垮请求
        logger.warning(
            "[tool-capability] 落库失败(model=%s, provider=%s, verdict=%s): %s",
            model_id, provider_code, verdict, e,
        )


async def is_empirically_tool_capable(model_id: str, provider_code: str) -> bool:
    """该端点是否被实证支持工具调用(DB `tool_call_empirical = true`)。

    未实证(null)一律按"不支持"处理 —— 带 tools 的故障转移宁可不换,也不换到
    一个只会把工具调用写成文本的端点(那正是本缺陷的发生方式)。
    """
    bare = _bare_model_id(model_id)
    key = (provider_code or "", bare)
    cached = _VERIFIED_CACHE.get(key)
    now = time.time()
    if cached and cached[1] > now:
        return cached[0]
    result = False
    try:
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT 1
                   FROM ai_model_config_models m
                   JOIN ai_model_config c ON m.config_id = c.id
                   WHERE m.enabled = true AND c.enabled = true AND c.owner_uuid IS NULL
                     AND m.tool_call_empirical = true
                     AND c.provider_code = $1
                     AND (m.model_id = $2 OR m.model_id LIKE '%/' || $2)
                   LIMIT 1""",
                provider_code or "",
                bare,
            )
            result = row is not None
    except Exception as e:  # noqa: BLE001 - 查询失败按未实证处理(fail-closed)
        logger.warning(
            "[tool-capability] 实证查询失败(model=%s, provider=%s): %s",
            model_id, provider_code, e,
        )
    if len(_VERIFIED_CACHE) >= _VERIFIED_CACHE_MAX:
        _VERIFIED_CACHE.clear()
    _VERIFIED_CACHE[key] = (result, now + _VERIFIED_CACHE_TTL)
    return result


def count_tool_calls(result: dict[str, Any]) -> int:
    """数一次 LLM 响应里的原生 tool_calls 条数(缺失/非列表 = 0)。"""
    tool_calls = result.get("tool_calls")
    return len(tool_calls) if isinstance(tool_calls, list) else 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
