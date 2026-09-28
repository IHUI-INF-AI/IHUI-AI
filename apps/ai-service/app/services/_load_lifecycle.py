# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""加载生命周期:把"读不到"与"权威的空"分开的**唯一一份**判定实现(G-748,2026-09-29 立)。

来历:G-702 先收口了 ab_test_tracker 与 agent_card 两处"读失败也把对象标记成
已加载"的写法(`finally` 里无条件置 loaded)。那次逐行复查还留了同族 4 处
(federated_learner / meta_learner / memory_decay / user_profile),语义完全一致:
一次瞬时 DB 故障 ⇒ 本进程余生不再重试 ⇒ 内存里那份"空"其实是"没读到",
而账面显示"已加载"。G-748 把这 4 处收到同一份判据上。

**为什么住在单独模块而不是各自抄一遍**:本仓记过最多次的失败型就是"两处算同一件
事必漂移"——退避底数、封顶、放弃阈值、状态词汇一旦有第二份实现,下一次只会改一处。
所以:
- 数值常量只有本模块一份(ab_test_tracker 以别名引用,名字保持不变是因为既有
  单测按 `att_mod._LOAD_BACKOFF_BASE_S` 这类名字取值与替换);
- 状态词汇(`loaded` / `never_tried` / `retry_backoff` / `gave_up`)只有本模块一份;
- 各模块只负责"怎么读"(各自的 `_try_*` 二元组出口)和"日志写什么"。

语义铁律(与 G-702 逐字一致,不得顺手改数值):
1. 读到成功(含读到空表/空结果集)⇒ 置 loaded,此后不再打 DB —— 权威的空允许固化;
2. 读失败 ⇒ **不置 loaded**,按指数退避重试(底 1s、封顶 60s);
3. 连续失败达 LOAD_MAX_CONSECUTIVE_FAILURES ⇒ 停止自动重试(有界,防每次调用打爆
   IO),但 loaded 仍为 False —— "试了 N 次都失败"不等于"没有数据"。

本模块自身零 DB / 零 IO 依赖,可被单测直接喂构造面验证。
"""

from __future__ import annotations

import time
from dataclasses import dataclass

# 退避参数:逐字取自 ab_test_tracker 的 G-702 实现,不得在此调整。
LOAD_BACKOFF_BASE_S = 1.0
LOAD_BACKOFF_MAX_S = 60.0
LOAD_MAX_CONSECUTIVE_FAILURES = 5

# 判读词汇(loadState 的取值域;消费方 = get_status / 单测 / 运维看状态)。
STATE_LOADED = "loaded"  # 含"读到空表"——权威的空
STATE_NEVER_TRIED = "never_tried"
STATE_RETRY_BACKOFF = "retry_backoff"  # 读不到,退避中
STATE_GAVE_UP = "gave_up"  # 读不到,且已停止自动重试

# decide_attempt 的返回值域(调用方据此决定"打不打 DB"与"要不要喊一次")。
DECISION_LOADED = "loaded"
DECISION_BACKOFF = "backoff"
DECISION_GAVE_UP = "gave_up"
DECISION_ATTEMPT = "attempt"


def monotonic() -> float:
    """单调钟唯一取用点。

    各模块以 `from ... import monotonic as _monotonic` 的形式持有自己的别名绑定 ——
    那是单测的替换缝(模拟退避窗口流逝,不真 sleep),不是第二份实现:函数体只有一处。
    """
    return time.monotonic()


def decide_attempt(
    *,
    loaded: bool,
    failures: int,
    next_attempt_s: float,
    now: float,
) -> str:
    """本次调用该不该打 DB。纯函数,不改状态,便于直接喂构造面验证。

    返回 DECISION_*:
    - LOADED   ⇒ 已固化,直接返回;
    - GAVE_UP  ⇒ 连续失败到上限,停自动重试(**loaded 仍 False**),调用方负责喊一次;
    - BACKOFF  ⇒ 退避窗口内,本次不打 DB(有界,防打爆 IO);
    - ATTEMPT  ⇒ 可以打 DB。
    """
    if loaded:
        return DECISION_LOADED
    if failures >= LOAD_MAX_CONSECUTIVE_FAILURES:
        return DECISION_GAVE_UP
    if now < next_attempt_s:
        return DECISION_BACKOFF
    return DECISION_ATTEMPT


def state_after_success() -> tuple[bool, int, float]:
    """读成功(含空结果)后的 (loaded, failures, next_attempt_s)。"""
    return True, 0, 0.0


def state_after_failure(failures: int, now: float) -> tuple[int, float]:
    """读失败后的 (新失败次数, 下次可尝试的单调时刻)。

    指数退避 `base * 2**(failures-1)`,封顶 LOAD_BACKOFF_MAX_S —— 与 G-702 那份
    实现逐字同形(先自增、再以自增后的值取指数)。
    """
    nxt = int(failures) + 1
    delay = min(LOAD_BACKOFF_BASE_S * (2 ** (nxt - 1)), LOAD_BACKOFF_MAX_S)
    return nxt, now + delay


def state_label(*, loaded: bool, failures: int) -> str:
    """把两维(loaded / failures)折成单一可判读字段。

    三态互不冒充:loaded=True 是"权威的空或有数据",never_tried 是"还没试过",
    retry_backoff / gave_up 都是**读不到**,绝不等于空。
    """
    if loaded:
        return STATE_LOADED
    if failures == 0:
        return STATE_NEVER_TRIED
    if failures >= LOAD_MAX_CONSECUTIVE_FAILURES:
        return STATE_GAVE_UP
    return STATE_RETRY_BACKOFF


@dataclass
class LoadRecord:
    """按 key(如 user_id)各持一份的加载状态容器。

    全局单例型(federated_learner / meta_learner / ab_test_tracker)可以继续用
    自己的实例属性,判定同样走上面的纯函数;只有"一个进程里要跟 N 个 key"的模块
    需要这个容器 —— 它不引入第二份判据,方法体只是转发。
    """

    loaded: bool = False
    failures: int = 0
    next_attempt_s: float = 0.0
    give_up_logged: bool = False

    def decide(self, now: float) -> str:
        return decide_attempt(
            loaded=self.loaded,
            failures=self.failures,
            next_attempt_s=self.next_attempt_s,
            now=now,
        )

    def apply_success(self) -> None:
        self.loaded, self.failures, self.next_attempt_s = state_after_success()

    def apply_failure(self, now: float) -> None:
        self.failures, self.next_attempt_s = state_after_failure(self.failures, now)

    def mark_loaded(self) -> None:
        """缓存被就地重建/刷新后的"确实拿到了新数据"(非读失败路径)。"""
        self.loaded, self.failures, self.next_attempt_s = state_after_success()

    def state_label(self) -> str:
        return state_label(loaded=self.loaded, failures=self.failures)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
