# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""有界输出环 + 绝对偏移双游标 + lossy 标记(2026-11-23 P0-5)。

## 立因(真实缺陷,不是"对照件有所以我们也加")

`agent_engine._append_output` 此前的形态是:一个纯字符串 buffer,超限时保留
**头部 4000 + 中间截断标记 + 尾部 16000**;读取方用 `_wait_settled(before)` 按
**旧长度**切增量(`session["buffer"][before:]`)。

一旦触发截断,字符串长度会从 `total` 缩到 `head+tail+标记`。此时旧的 `before`
落在新串的随机位置上:

- `before` 比新长度大 ⇒ `str[before:]` 得到空串 ⇒ **这段输出被静默吞掉**,
  调用方看到"(无新增输出)",没有任何 lossy 标记;
- `before` 落在标记里 ⇒ 回传一段"中间截断 N 字符"的残缺文本,消息面完全错位。

## 本模块给的形状

- **绝对偏移(不随截断回退)**:`total_written` 只增不减,读取一律用绝对区间;
  窗口外的读标 `lossy` 并给 `dropped_chars`,**不报错、不静默**;
- **双游标**:`read(from_offset)` 是纯函数(不移动内部状态),模型侧推进自己的
  游标、观察者按绝对偏移另读,两者互不踩;
- **head 保留**:`head_chars > 0` 时开头永不被丢(与既有"保留头部"语义一致),
  尾部按 `max_chars - head_chars` 滚动;
- **结算 first-wins**:`settle()` 只结算一次,重复调用回第一次的结论并标
  `already_settled=True`(对齐对照件"终端提交只投递一轮");四态
  `ok / truncated / pipe_unavailable / timeout` 逐条可断言。
"""

from __future__ import annotations

from dataclasses import dataclass

DROPPED_MARKER_TEMPLATE = "\n...[中间丢弃 {n} 字符]...\n"


@dataclass(frozen=True)
class RingRead:
    """一次读取的结果。`next_offset` 可直接喂下一次 `read`。"""

    text: str
    from_offset: int
    next_offset: int
    lossy: bool
    dropped_chars: int


@dataclass(frozen=True)
class RingSettlement:
    """结算结论。`status` 是封闭集,不接受调用方自造第四种。"""

    status: str
    dropped_chars: int
    already_settled: bool


_SETTLEMENT_STATUSES = frozenset({"ok", "truncated", "pipe_unavailable", "timeout"})


class OutputRing:
    """字符单位的滚动环。非线程安全:写入方与读取方由调用方串行化(asyncio 单循环内天然满足)。"""

    def __init__(self, max_chars: int, head_chars: int = 0) -> None:
        if max_chars <= 0:
            raise ValueError(f"max_chars 必须为正,收到 {max_chars}")
        if head_chars < 0 or head_chars > max_chars:
            raise ValueError(f"head_chars 必须在 [0, max_chars] 内,收到 {head_chars}")
        self._max_chars = int(max_chars)
        self._head_cap = int(head_chars)
        self._tail_cap = self._max_chars - self._head_cap
        self._head = ""
        self._tail = ""
        self._total = 0
        self._tail_dropped = 0
        self._settlement: RingSettlement | None = None

    # ------------------------------------------------------------------ 读属性
    @property
    def total_written(self) -> int:
        """已写入的绝对字符数(只增不减,截断也不回退)。"""
        return self._total

    @property
    def dropped_chars(self) -> int:
        return self._tail_dropped

    @property
    def earliest_offset(self) -> int:
        """仍可读的最老绝对偏移。

        head 段永久可读 ⇒ 有 head 时从 0 起读仍能拿到开头(中段可能有洞);
        无 head 时就是被丢掉的滚动尾之后。
        """
        head_len = len(self._head)
        return 0 if head_len > 0 else self._tail_dropped

    @property
    def settled(self) -> bool:
        return self._settlement is not None

    # ------------------------------------------------------------------ 写
    def append(self, text: str) -> None:
        if not text:
            return
        self._total += len(text)
        pos = 0
        if len(self._head) < self._head_cap:
            take = min(self._head_cap - len(self._head), len(text))
            self._head += text[:take]
            pos = take
        rest = text[pos:]
        if not rest:
            return
        self._tail += rest
        overflow = len(self._tail) - self._tail_cap
        if overflow > 0:
            self._tail = self._tail[overflow:]
            self._tail_dropped += overflow

    # ------------------------------------------------------------------ 读
    def read(self, from_offset: int = 0, limit: int | None = None) -> RingRead:
        if from_offset < 0:
            raise ValueError(f"from_offset 必须 >= 0,收到 {from_offset}")
        total = self._total
        start = min(from_offset, total)
        head_len = len(self._head)
        tail_start = head_len + self._tail_dropped
        lossy = False
        dropped = 0
        real_start = start
        # 洞 = [head_len, tail_start):head 段之后被环丢掉的那一段
        if self._tail_dropped > 0 and total > head_len:
            if start < head_len:
                # 从 head 段起读:开头拿得到,中段有洞 ⇒ 仍然是"不完整"
                lossy = True
                dropped = self._tail_dropped
            elif start < tail_start:
                lossy = True
                dropped = tail_start - start
                real_start = tail_start
        text = self._slice(real_start, total)
        if limit is not None and limit > 0 and len(text) > limit:
            text = text[:limit]
            next_offset = real_start + limit
        else:
            next_offset = total
        return RingRead(
            text=text,
            from_offset=from_offset,
            next_offset=next_offset,
            lossy=lossy,
            dropped_chars=dropped,
        )

    def snapshot(self) -> str:
        """整窗渲染(截断处带标记):给"当前全部输出"这类展示面用。"""
        return self._slice(self.earliest_offset, self._total)

    # ------------------------------------------------------------------ 结算
    def settle(self, *, pipe_unavailable: bool = False, timed_out: bool = False) -> RingSettlement:
        """结算 first-wins。三个分支:管道不可用 > 超时 > 有丢弃(truncated) > ok。"""
        if self._settlement is not None:
            return RingSettlement(
                status=self._settlement.status,
                dropped_chars=self._settlement.dropped_chars,
                already_settled=True,
            )
        if pipe_unavailable:
            status = "pipe_unavailable"
        elif timed_out:
            status = "timeout"
        elif self._tail_dropped:
            status = "truncated"
        else:
            status = "ok"
        if status not in _SETTLEMENT_STATUSES:  # pragma: no cover - 防御,分支已封闭
            raise AssertionError(f"结算状态越出封闭集: {status}")
        settlement = RingSettlement(
            status=status, dropped_chars=self._tail_dropped, already_settled=False
        )
        self._settlement = settlement
        return settlement

    # ------------------------------------------------------------------ 内部
    def _slice(self, a: int, b: int) -> str:
        if a >= b:
            return ""
        head_len = len(self._head)
        tail_start = head_len + self._tail_dropped
        parts: list[str] = []
        if a < head_len:
            end = min(b, head_len)
            parts.append(self._head[a:end])
            a = end
        if a < tail_start < b:
            parts.append(DROPPED_MARKER_TEMPLATE.format(n=tail_start - a))
            a = tail_start
        if a < b:
            parts.append(self._tail[a - tail_start : b - tail_start])
        return "".join(parts)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
