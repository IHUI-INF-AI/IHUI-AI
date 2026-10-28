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
#
# G-759 依据 —— 为什么这四档没有登记进 i18n 五语言(票面要求"写明依据,不得默认省略"):
# 这四档是**服务端运维诊断字段**,唯一出口是各模块 get_status() 里的 loadState 键,读它是
# 运维看健康度与单测断言,端上没有一处取用。2026-10-04 实测两点:① packages/i18n 五语言包
# 里搜不到任何一档词汇;② web 面命中的 4 个 loadState 标识符(`context-reference-panel`、
# `use-message-references`、`use-react-table`、附件上传用例)是附件/表格自己的加载态,
# 与本模块的取值域同名不同义、数据不贯通。AGENTS §30 那条"新增状态必须同枚补齐五语言词表"
# 约束的是**会渲染进界面**的状态词汇(子智能体六态/后台进程六态那一族),这一族今天不进文案面,
# 所以按票面给的出口写明依据而不是登记空词表。将来任何端要把 loadState 显示给用户,前置是
# 先走 §19 五语言流水线再落地,不得只补一条中文。
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


# ======================================================================
# 崩溃预算(b76-03 票1,吸收 ZCode supervisor/crashBudget 四件套,2026-09-30 立)
# 机制:自愈重启必须有一个"窗口内累计、超限即停"的预算对象 ——
#   窗口 5 分钟、退避表 1/2/4/8/16s 到表尾封顶、第 6 次判 exhausted 且不再重启;
#   预算快照作为状态契约的一等字段随每次生命周期事件落盘;耗尽进入独立终态
#   `crash-loop-stopped`(不复用 crashed/stopped/gave_up),调用方读到该终态
#   立刻抛错上抛,不等满超时。
# 防的是"无限重启把故障伪装成在恢复、且没人知道它已经放弃了"。
# 与上面的加载退避(LOAD_BACKOFF_*)是两套语义,数值不得互借。
# ======================================================================

# (a) 累计窗口时长常量:5 分钟内的崩溃才累计,窗口外归零重开。
CRASH_WINDOW_S = 300.0
# (b) 退避档数上限:5 档,超出表尾封顶取最后一档(与加载退避的"封顶 60s"无关)。
CRASH_BACKOFF_TABLE_S: tuple[float, ...] = (1.0, 2.0, 4.0, 8.0, 16.0)
# 第 6 次崩溃判 exhausted 且不再重启。
CRASH_MAX_RESTARTS = len(CRASH_BACKOFF_TABLE_S) + 1
# (c) 耗尽后的独立终态字符串:绝不与 failed / stopped / gave_up 共用取值。
STATE_CRASH_LOOP_STOPPED = "crash-loop-stopped"

# record_crash 的决策词汇(调用方据此决定"重启不重启、隔多久")。
DECISION_RESTART = "restart"
DECISION_CRASH_EXHAUSTED = "exhausted"


class CrashLoopStoppedError(RuntimeError):
    """调用方读到 `crash-loop-stopped` 终态时立刻抛错上抛(点名 lastExitReason)。"""


@dataclass
class CrashBudget:
    """崩溃预算对象:窗口内累计崩溃次数,超限即停,不再自动重启。

    纯状态容器,零 IO;`record_crash` 的退避档表与耗尽判据只有本模块一份。
    """

    crash_count: int = 0
    window_started_s: float = 0.0
    window_open: bool = False
    last_exit_reason: str | None = None
    exhausted: bool = False

    def record_crash(self, *, now: float, exit_reason: str) -> tuple[str, float]:
        """记一次崩溃,返回 (决策, 距下次重启的退避秒数)。

        - 已 exhausted ⇒ 永远返回 exhausted、退避 0,绝不重启;
        - 崩溃落在窗口外(距窗口起点超过 CRASH_WINDOW_S)⇒ 计数归零重开;
        - 第 CRASH_MAX_RESTARTS 次(默认第 6 次)⇒ 判 exhausted,此后不再重启。
        """
        if self.exhausted:
            return DECISION_CRASH_EXHAUSTED, 0.0
        if not self.window_open or (now - self.window_started_s) > CRASH_WINDOW_S:
            self.window_open = True
            self.window_started_s = now
            self.crash_count = 0
        self.crash_count += 1
        self.last_exit_reason = exit_reason
        if self.crash_count >= CRASH_MAX_RESTARTS:
            self.exhausted = True
            return DECISION_CRASH_EXHAUSTED, 0.0
        delay = CRASH_BACKOFF_TABLE_S[min(self.crash_count, len(CRASH_BACKOFF_TABLE_S)) - 1]
        return DECISION_RESTART, delay

    def snapshot(self, *, now: float) -> dict[str, object]:
        """预算快照:随每次生命周期事件落盘的一等字段。

        - `state` 只在耗尽时取 `crash-loop-stopped`;未耗尽为 None —— 顶层状态
          此时仍由加载/运行词汇描述,快照不冒充;
        - `restartsLeft` 是对外可读的"剩余机会",运维据此区分"还在退避"与
          "已停止自动重试"。
        """
        if self.exhausted:
            state: str | None = STATE_CRASH_LOOP_STOPPED
            window_remaining_s: float = 0.0
        elif self.window_open:
            state = None
            window_remaining_s = max(0.0, CRASH_WINDOW_S - (now - self.window_started_s))
        else:
            state = None
            window_remaining_s = CRASH_WINDOW_S
        return {
            "state": state,
            "crashCount": self.crash_count,
            "exhausted": self.exhausted,
            "restartsLeft": max(0, CRASH_MAX_RESTARTS - self.crash_count),
            "lastExitReason": self.last_exit_reason,
            "windowRemainingS": window_remaining_s,
        }



# ======================================================================
# 不安全加载标记判据(G-758,2026-10-03 立;第五道防线的唯一判定实现)
# ======================================================================
# 背景:G-748 收口了 6 个模块的"读失败也固化 loaded",但那把尺子
# (`git grep -cE "_loaded = True"`)对本族**结构上不完整** —— 集合 add、
# 未读先置真等形态它看不见,报"归零"会把漏读洗成已清。本函数用 AST 把
# 三种"读失败/未读到被记成已加载"的写法钉成**唯一一份**判定实现;
# 守门如需接线必须调用本函数(单向投影),不得再抄第二份正则。
#
# 覆盖的三形态(逐一有现实出处):
#   ① finally 置真      —— G-748 前 ab_test_tracker / G-758 前 audit_log 等
#                          六个文件库的真形:`finally: self._loaded = True`;
#   ② try/except 同块尾随(或 except 体内)置真 —— anti_risk 四件的真形:
#                          异常分支被折成"已加载"哨兵,与成功路径不可判别;
#   ③ 集合 add 记"已加载" —— G-748 落地前 federated_learner / meta_learner 的
#                          真形(`_loaded_users.add(user_id)`),集合表达不了
#                          "试过了但没读到"。
# 刻意不判的(防误报,逐一有现实出处):
#   - 成功路径/权威写入上的置真:reset() 清账后置真(cost_ledger.reset)、
#     测试注入权威数据后置真(routers/cost_ledger._scratch)、元组形态的
#     state_after_success() 固化 —— 都不在"异常兜底块之后无条件置真"的形状里;
#   - 局部变量(非属性):llm_gateway 的 `equivalents_loaded` 是请求内惰性加载
#     游标,另一义;
#   - 名字不含 loaded 的集合 add。

import ast as _ast
import re as _re

_LOADED_NAME_RE = _re.compile(r"loaded")
_LOADED_ATTR_RE = _re.compile(r"_loaded$")


def _assign_mark(node: _ast.stmt) -> str | None:
    """`<obj>.<x>_loaded = True`(字面 True 常量)⇒ 返回属性名;否则 None。"""
    if not isinstance(node, _ast.Assign):
        return None
    if not (isinstance(node.value, _ast.Constant) and node.value.value is True):
        return None
    names = []
    for t in node.targets:
        if isinstance(t, _ast.Attribute) and _LOADED_NAME_RE.search(t.attr):
            names.append(t.attr)
    return names[0] if names else None


def find_unsafe_loaded_marks(source: str) -> list[dict[str, object]]:
    """扫一段 Python 源码,点名三种"没读到被记成已加载"的写法(行号从 1 起)。

    返回元素形状:{"kind": "finally-set" | "except-set" | "tail-set" | "set-add",
    "line": int, "name": str}。判定是纯函数,零 IO,可直接喂构造面验证。
    """
    findings: list[dict[str, object]] = []
    tree = _ast.parse(source)

    def blocks(node: _ast.AST) -> list[list[_ast.stmt]]:
        out: list[list[_ast.stmt]] = []
        for field in ("body", "orelse", "finalbody"):
            v = getattr(node, field, None)
            if isinstance(v, list) and all(isinstance(x, _ast.stmt) for x in v):
                out.append(v)
        if isinstance(node, _ast.Try):
            for h in node.handlers:
                out.append(h.body)
        return out

    for stmt in _ast.walk(tree):
        for blk in blocks(stmt):
            seen_try_with_handler = False
            for child in blk:
                if isinstance(child, _ast.Try) and child.handlers:
                    seen_try_with_handler = True
                    # ① finally 置真
                    for n in child.finalbody:
                        name = _assign_mark(n)
                        if name:
                            findings.append(
                                {"kind": "finally-set", "line": n.lineno, "name": name}
                            )
                    # ② except 体内置真(异常分支折成"已加载"哨兵)
                    for h in child.handlers:
                        for n in h.body:
                            name = _assign_mark(n)
                            if name:
                                findings.append(
                                    {"kind": "except-set", "line": n.lineno, "name": name}
                                )
                # ②b try/except 同块**尾随**置真(anti_risk 旧形):异常兜底块之后
                #    无条件 `self._loaded = True`,与成功路径不可判别
                name = _assign_mark(child)
                if name and seen_try_with_handler:
                    findings.append(
                        {"kind": "tail-set", "line": child.lineno, "name": name}
                    )
                # ③ 集合 add 记"已加载":`X.add(...)` 且 X 名字含 loaded
                if isinstance(child, _ast.Expr) and isinstance(child.value, _ast.Call):
                    fn = child.value.func
                    if isinstance(fn, _ast.Attribute) and fn.attr == "add":
                        base = fn.value
                        base_name = (
                            base.id
                            if isinstance(base, _ast.Name)
                            else base.attr
                            if isinstance(base, _ast.Attribute)
                            else ""
                        )
                        if base_name and _LOADED_NAME_RE.search(base_name):
                            findings.append(
                                {
                                    "kind": "set-add",
                                    "line": child.lineno,
                                    "name": base_name,
                                }
                            )
    return findings

def raise_if_crash_loop_stopped(snapshot: dict[str, object]) -> None:
    """前台/调用方出口:读到 `crash-loop-stopped` 终态立刻抛错上抛,不等满超时。"""
    if snapshot.get("state") == STATE_CRASH_LOOP_STOPPED:
        raise CrashLoopStoppedError(
            "自愈重启预算已耗尽(crash-loop-stopped):"
            f"lastExitReason={snapshot.get('lastExitReason')!r}, "
            f"crashCount={snapshot.get('crashCount')} —— 已放弃自动重启,需人工介入"
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
