# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""服务端限流指示优先于本地退避曲线 —— provider 重试族唯一纯函数层(A24/A25 收口)。

为什么要这一层(2026-09-26,MECHANISM-SPEC-6 A24/A25):
429 的语义是"请等到这个时刻再来"。此前全仓 21 个 provider 没有一个真正解析
`Retry-After`(token6688 只在注释里提到,实际写死 429→5s / 5xx→3s),中心退避
`responses_retry.backoff()` 虽有 server_retry_delay 优先位,却无任何生产者喂值。
后果不是"多等一会儿",而是限流窗口内请求量反而上升(越限流越重试越糟)。
本模块把"听服务端的"收成唯一一处实现,消费面经 ProviderError 携带的指示接入。

三层优先级(resolve_retry_delay_s 是唯一裁决出口,消费方不得各写各的):
  1. provider 明示"不要再试"(x-should-retry: false)→ 返回 None = 不重试;
  2. 服务端指示等待 → 解析 retry-after-ms(非标准毫秒头)→ Retry-After
     (先试秒、再试 HTTP-date)→ 响应体 retry_after 秒数,取第一个有效值,
     夹到 [0, MAX_SERVER_RETRY_DELAY_S](尊重指示可把等待放大到分钟级,
     与工具超时同批的风险由封顶兜住;时钟偏移算出的负数夹到 0);
  3. 无服务端指示 → 本地退避曲线**逐字节透传**(本模块不改曲线形状)。

A24 纪律("无上限"档只放宽一条判据 + 序列化哨兵):
- 哨兵 UNLIMITED_ATTEMPTS 显式命名,**不占用合法计数值域**(合法尝试数是非负
  int,哨兵是 str),可 JSON 序列化往返(既不是 Infinity 也不是 -1)。
- "无上限"只放宽两个表达式:may_attempt_again(放弃条件)与
  loop_should_continue(循环继续条件)。**以下判据逐条不因该档改变**:
  退避曲线、抖动、服务端指示优先(含"明示不要再试")、失败分类、
  已向用户播报后再重试的抑制、尝试数换算(+1 只出现在 retry_budget_to_attempts)。
- 本票只落"哨兵 + 三表达式"的地基与纪律,**不开启**面向模型调用的无上限档
  (开档属产品决策,且必须先有 A25 的服务端指示优先 —— 地基已随本票就位)。

"次数 vs 尝试数"两种词汇的换算只发生在本文件 retry_budget_to_attempts 一处
(env/provider_caps 暴露的是"重试次数"不含首次;内部循环用"含首次的尝试数")。
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Final, Literal

# --- 头名与值域常量(唯一声明处,消费方 import,不得另抄字面量)----------------
RETRY_AFTER_MS_HEADER: Final = "retry-after-ms"  # 非标准毫秒版,优先于秒版
RETRY_AFTER_HEADER: Final = "retry-after"  # RFC 9110:秒数 或 HTTP-date
SHOULD_RETRY_HEADER: Final = "x-should-retry"  # OpenAI 系事实标准:true/false
RETRY_AFTER_BODY_FIELD: Final = "retry_after"  # 响应体秒数(token6688 官方协议)

MAX_SERVER_RETRY_DELAY_S: Final = 60.0  # 服务端指示封顶,防分钟级静默挂死

# 无上限哨兵:str 型,结构上不占用非负 int 的合法尝试数值域,且 JSON 可往返。
UNLIMITED_ATTEMPTS: Final = "unlimited"
AttemptBudget = Literal["unlimited"] | int


@dataclass(frozen=True)
class ServerRetryHint:
    """一次上游响应里"服务端告诉我们的重试信息"(纯数据)。

    should_retry=False 仅在响应明示"不要再试"时出现;头缺失时为 True
    (缺省语义 = 不干预,由本地曲线/预算决定)。
    retry_after_s = None 表示服务端没有给出可用的等待指示。
    """

    should_retry: bool = True
    retry_after_s: float | None = None


# --- "次数 vs 尝试数"唯一换算点 -------------------------------------------------
def retry_budget_to_attempts(retry_budget: int) -> int:
    """重试次数(不含首次)→ 尝试数(含首次)。全仓 **+1 只允许出现在这一处**。

    为什么要换算:LLM provider SDK(含 LiteLLM)与 provider_caps 的
    request_max_retries/num_retries 语义是"失败后再试几次"(不含首次),
    而内部 for 循环计数的是"一共打了几发"(含首次)。两处算同一个数必须
    共用本函数(AGENTS"两处算同一 key 必须共用一份实现")。
    """
    return retry_budget + 1


# --- A24:无上限档的三个表达式(只有前两个被该档放宽)---------------------------
def may_attempt_again(budget: AttemptBudget, attempts_used: int) -> bool:
    """放弃条件:预算内是否还可以再打一发。attempts_used 为已消耗尝试数(含首次)。"""
    if budget == UNLIMITED_ATTEMPTS:
        return True
    return attempts_used < retry_budget_to_attempts(budget)


def loop_should_continue(budget: AttemptBudget, attempts_used: int) -> bool:
    """循环继续条件:for/while 驱动侧使用。与放弃条件同判据但独立成表达式,
    使"无上限"档的放宽被限制在这两个函数体内,而不是散落到调用方 if 里。
    """
    if budget == UNLIMITED_ATTEMPTS:
        return True
    return attempts_used < retry_budget_to_attempts(budget)


def attempts_reported(budget: AttemptBudget, attempts_used: int) -> int | str:
    """写进状态事件的"数":无上限档写哨兵本身,而不是 Infinity/-1/0。

    合法尝试数(含 0)原样返回 —— 反向对照:attempts_used==0 不得被写成哨兵。
    """
    if budget == UNLIMITED_ATTEMPTS:
        return UNLIMITED_ATTEMPTS
    return attempts_used


# --- Retry-After 解析(坏值一律回落 None,不抛)--------------------------------
def parse_retry_after_seconds(raw: object) -> float | None:
    """解析 Retry-After 头的**秒数**形态;负数秒视为坏值回落 None。

    先试数值(整数/浮点秒),失败再试 HTTP-date(RFC 9110 IMF-fixdate)。
    HTTP-date 遇时钟偏移算出过去时刻 → 夹到 0.0(立即重试,不是负等待)。
    """
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        return float(raw) if raw >= 0 else None
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if not text:
        return None
    try:
        seconds = float(text)
    except ValueError:
        return _parse_http_date_seconds(text)
    if seconds != seconds or seconds < 0:  # NaN / 负数 = 坏值
        return None
    return seconds


def _parse_http_date_seconds(text: str) -> float | None:
    """HTTP-date → 距今秒数;不可解析回落 None;过去时刻夹 0。"""
    try:
        when = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        return None
    if when is None:
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    delta = (when - datetime.now(UTC)).total_seconds()
    return max(delta, 0.0)


def parse_retry_after_ms(raw: object) -> float | None:
    """解析非标准毫秒头(retry-after-ms)→ 秒;负数/坏值回落 None。"""
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        seconds = float(raw) / 1000.0
    elif isinstance(raw, str):
        text = raw.strip()
        if not text:
            return None
        try:
            value = float(text)
        except ValueError:
            return None
        seconds = value / 1000.0
    else:
        return None
    if seconds != seconds or seconds < 0:  # NaN / 负数 = 坏值
        return None
    return seconds


def parse_should_retry(raw: object) -> bool | None:
    """x-should-retry 三态:缺失/坏值 = None(不干预),true/false 各归其值。"""
    if raw is None:
        return None
    if isinstance(raw, bool):
        return raw
    if not isinstance(raw, str):
        return None
    text = raw.strip().lower()
    if text == "true":
        return True
    if text == "false":
        return False
    return None


def _lookup(headers: Mapping[str, object] | None, name: str) -> object:
    """大小写不敏感取头值:httpx.Headers 原生不敏感,普通 dict 不保证 → 归一化。"""
    if headers is None:
        return None
    try:
        return headers[name]
    except KeyError:
        pass
    lowered = name.lower()
    for key, value in headers.items():
        if key.lower() == lowered:
            return value
    return None


def extract_server_retry_hint(
    headers: Mapping[str, object] | None = None,
    body: Mapping[str, object] | None = None,
) -> ServerRetryHint:
    """从响应头 + 响应体提取服务端重试指示(三层里第 1/2 层的全部来源)。

    秒数解析顺序(规格原文"先试毫秒级非标准头,再试秒,再试 HTTP-date"):
    retry-after-ms → Retry-After(秒或 date,由 parse_retry_after_seconds 内部
    先秒后 date)→ 响应体 retry_after 秒数。坏值逐段回落,绝不抛。
    """
    should_retry = parse_should_retry(_lookup(headers, SHOULD_RETRY_HEADER))
    delay = parse_retry_after_ms(_lookup(headers, RETRY_AFTER_MS_HEADER))
    if delay is None:
        delay = parse_retry_after_seconds(_lookup(headers, RETRY_AFTER_HEADER))
    if delay is None and body is not None:
        raw_body = body.get(RETRY_AFTER_BODY_FIELD)
        if isinstance(raw_body, (int, float, str)) and not isinstance(raw_body, bool):
            delay = parse_retry_after_seconds(raw_body)
    return ServerRetryHint(
        should_retry=should_retry if should_retry is not None else True,
        retry_after_s=delay,
    )


def hint_from_error(exc: BaseException) -> ServerRetryHint | None:
    """从异常对象上鸭子读取重试指示(ProviderError 等携带面的统一入口)。

    不 import providers —— 保持 core → providers 零依赖(守门 103 D1 方向);
    异常未携带任何相关属性时返回 None(调用方走本地曲线,行为零变化)。
    """
    raw_delay = getattr(exc, "retry_after_s", None)
    raw_should = getattr(exc, "should_retry", None)
    if raw_delay is None and raw_should is None:
        return None
    delay: float | None = None
    if isinstance(raw_delay, (int, float)) and not isinstance(raw_delay, bool):
        parsed = parse_retry_after_seconds(float(raw_delay))
        delay = parsed
    should_retry = parse_should_retry(raw_should)
    return ServerRetryHint(
        should_retry=should_retry if should_retry is not None else True,
        retry_after_s=delay,
    )


def resolve_retry_delay_s(
    hint: ServerRetryHint | None,
    local_delay_s: float,
) -> float | None:
    """三层优先级唯一裁决:明示不重试 → None;服务端秒数 → 夹 [0, cap];否则本地曲线透传。

    返回 None 表示"不要重试"(仅第 1 层能产出);返回数值即"等多久再打"。
    无 hint / hint 无秒数时,local_delay_s **原值返回**(反向对照钉死:
    无相关头时既有退避逐字节不变)。
    """
    if hint is not None and not hint.should_retry:
        return None
    if hint is not None and hint.retry_after_s is not None:
        return min(max(hint.retry_after_s, 0.0), MAX_SERVER_RETRY_DELAY_S)
    return local_delay_s
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
