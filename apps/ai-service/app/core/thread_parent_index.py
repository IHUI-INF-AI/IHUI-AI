# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""线程父子级联索引 + 中断沿后代传播 —— 复现 Codex 26.1111 steering 范式。

来源：Codex Desktop 26.1111.2228.0，`app/resources/app.asar` 主包
`early-bootstrap-331-*.js`（观察取证，2026-11-15）。对侧原文语义：

```js
// 线程父子索引 threadParentIndex（TP 类）
getChildren(e)    { return Array.from(this.childrenByParent.get(e) ?? []) }
getDescendants(e) { let t = new Set([e]);
                    for (let x of t) for (let r of this.childrenByParent.get(x) ?? []) t.add(r);
                    t.delete(e); return Array.from(t) }        // BFS 收集后代，排除自身
update(e, t, r)   { /* 维护 childrenByParent：子父变更时逐边增删 */ }

// 中断沿后代级联
interruptConversation(id, "user-stop", outcome)  // 原因分级
interruptConversationWithOutcome(id, t)          // → {status:"accepted", interruptedTurnId}
stopThread(id)
```

对侧要点：
1. **线程有父子关系**（主线程派生子线程/子代理）；
2. **中断可沿后代递归传播**：停一个线程时，它的全部后代一并停（BFS）；
3. **中断原因分级**（`user-stop` 等），不同原因走不同补偿路径；
4. `getDescendants` **排除自身**，调用方据需决定是否把发起者一并纳入。

本模块复现**纯逻辑层**：只做线程父子索引的维护 + 后代级联集合计算 + 中断级联计划。
**不做实际中断执行**（不碰 agent_loop / 不起任何线程）—— 真正的中断调用留给
`agent_loop_v2.py` 的属主接线（他席在飞文件，本模块不依赖、不修改）。
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from enum import StrEnum


class InterruptReason(StrEnum):
    """中断原因分级（对侧 `interruptConversation(id, reason, outcome)` 的 reason 维）。

    对侧至少出现 `user-stop`；本仓按语义补全常用档，供调用方路由补偿路径。
    """

    # 用户主动停止
    USER_STOP = "user-stop"
    # 系统取消（超时 / 上游错误 / 资源回收）
    SYSTEM_CANCEL = "system-cancel"
    # 父线程级联停（由祖先中断传播而来，非用户直发）
    ANCESTOR_STOP = "ancestor-stop"


@dataclass(frozen=True)
class StopTarget:
    """级联停计划里的一个待停线程。

    root=True 表示它是中断的发起者（用户直发的那个），
    root=False 表示它是被级联波及的后代（原因改判为 ANCESTOR_STOP）。
    """

    thread_id: str
    root: bool
    depth: int  # 距发起者的 BFS 层级；发起者为 0


@dataclass
class ThreadParentIndex:
    """线程父子关系索引 —— 对侧 `threadParentIndex`（TP 类）的纯逻辑复现。

    单一真相源：`_children_by_parent: dict[parent_id, set[child_id]]`。
    只维护"谁是谁的孩子"，不持有线程运行态。
    """

    _children_by_parent: dict[str, set[str]] = field(default_factory=dict)
    # 反向索引：child -> parent，O(1) 判"这个线程的父是谁"，级联改判用
    _parent_of: dict[str, str] = field(default_factory=dict)

    def add(self, thread_id: str, parent_id: str | None) -> None:
        """登记一个线程（可带父）。parent_id=None 表示根线程。

        若该 thread_id 已登记过父，先摘旧边再建新边（对侧 update 的增删语义）。
        """
        old_parent = self._parent_of.get(thread_id)
        if old_parent is not None:
            self._children_by_parent.get(old_parent, set()).discard(thread_id)
        if parent_id is not None:
            self._parent_of[thread_id] = parent_id
            self._children_by_parent.setdefault(parent_id, set()).add(thread_id)
        else:
            self._parent_of.pop(thread_id, None)

    def remove(self, thread_id: str) -> None:
        """摘除一个线程：清掉它作为孩子的边，并递归摘除它的全部后代（它们成孤儿）。"""
        # 先递归摘后代
        for child in list(self.children(thread_id)):
            self.remove(child)
        parent = self._parent_of.pop(thread_id, None)
        if parent is not None:
            self._children_by_parent.get(parent, set()).discard(thread_id)
        # 清掉它作为父的边
        self._children_by_parent.pop(thread_id, None)

    def children(self, thread_id: str) -> list[str]:
        """直接子线程（对侧 getChildren）。"""
        return sorted(self._children_by_parent.get(thread_id, set()))

    def descendants(self, thread_id: str) -> list[str]:
        """全部后代（对侧 getDescendants）：BFS 递归收集，**排除自身**。

        与对侧同序：集合驱动 BFS，结果确定性排序（本仓额外排序保证可断言）。
        """
        seen: set[str] = {thread_id}
        queue: deque[str] = deque([thread_id])
        while queue:
            cur = queue.popleft()
            for child in self._children_by_parent.get(cur, ()):  # 不排序，仅遍历
                if child not in seen:
                    seen.add(child)
                    queue.append(child)
        seen.discard(thread_id)
        return sorted(seen)

    def parent_of(self, thread_id: str) -> str | None:
        """某线程的父（无父/根线程返回 None）。"""
        return self._parent_of.get(thread_id)

    def __len__(self) -> int:
        """已登记线程数（含根与后代）。"""
        return len(self._parent_of) + sum(
            1 for t in self._children_by_parent
            if t not in self._parent_of and t not in _all_children(self._children_by_parent)
        )


def _all_children(children_by_parent: dict[str, set[str]]) -> set[str]:
    """所有"作为孩子出现过"的 id（辅助 __len__，非对侧语义）。"""
    out: set[str] = set()
    for kids in children_by_parent.values():
        out |= kids
    return out


def plan_cascading_stop(
    index: ThreadParentIndex,
    root_id: str,
    reason: InterruptReason = InterruptReason.USER_STOP,
    include_root: bool = True,
) -> list[StopTarget]:
    """生成一次中断的**级联停计划**：发起者 + 其全部后代。

    对侧语义：`interruptConversation(root, reason, outcome)` 停一个线程时，
    它的整棵子树一并停。本函数只产出计划（谁停、是发起者还是被波及、第几层），
    **不执行中断** —— 执行由调用方据计划逐个下发。

    - 发起者 root：`root=True`，`depth=0`，保留调用方传入的 `reason`；
    - 后代：`root=False`，原因统一改判为 `ANCESTOR_STOP`（它们不是用户直发的），
      `depth` 为距发起者的 BFS 层级。

    返回按 (depth, thread_id) 排序的确定性列表，便于断言与逐层下发。
    `include_root=False` 时只返回后代（对侧 getDescendants 排除自身的场景）。
    """
    plan: list[StopTarget] = []
    if include_root:
        plan.append(StopTarget(thread_id=root_id, root=True, depth=0))

    # BFS 分层，记录每个后代的深度
    depth_of: dict[str, int] = {}
    seen: set[str] = {root_id}
    queue: deque[tuple[str, int]] = deque([(root_id, 0)])
    while queue:
        cur, d = queue.popleft()
        for child in index._children_by_parent.get(cur, ()):
            if child not in seen:
                seen.add(child)
                depth_of[child] = d + 1
                queue.append((child, d + 1))

    for tid in sorted(depth_of, key=lambda t: (depth_of[t], t)):
        plan.append(StopTarget(thread_id=tid, root=False, depth=depth_of[tid]))
    # StopTarget 不直接存 reason，调用方据 root 字段决定：
    # root→传入 reason，后代→ANCESTOR_STOP（见 effective_reason）。
    return plan


def effective_reason(target: StopTarget, root_reason: InterruptReason) -> InterruptReason:
    """一个计划条目真正生效的中断原因。

    发起者用 root_reason，被波及的后代一律 ANCESTOR_STOP —— 这是级联与"逐个独立停"
    的本质区别：后代不是用户直发的，补偿路径（如记录、UI 提示）必须区分。
    """
    return root_reason if target.root else InterruptReason.ANCESTOR_STOP
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
