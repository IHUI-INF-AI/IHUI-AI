<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# typecheck 锁：跨版本格式的判定口径（2026-11-07）

机器级锁 `join(os.tmpdir(), 'ihui-typecheck-full.lock')` 是全机共享的，不同 worktree 可能跑在不同版本的代码上：
新版本写 `{pid, pidStart, repo, role, startedAt, host, token}`，老版本只写 `{pid, ts}`。本文固定两者相遇时的判定口径，
避免下一个人把「保守等待」误读成 bug、或反过来把「保守」改成「放行」。

判据实现：`scripts/lib/typecheck-lock.mjs` 的 `judgeLock()`；身份三态：`scripts/lib/proc-identity.mjs`。

## 一、判定路径（`judgeLock` 的实际分支顺序）

```
statSync(dir) 失败            → absent（verdict=null）
meta 缺失且未过宽限           → unreadable（verdict=unverifiable，等，不抢）
meta 缺失且已过宽限           → incomplete-stale（verdict=stale）
pidAlive(meta.pid) === false  → dead（verdict=stale，**不调用 verify**）
pidAlive === true 且 verify=mismatch → reused（verdict=stale，pid 被复用）
pidAlive === true 且 verify=match    → held（verdict=live）
pidAlive === true 且 verify 无结论   → held（verdict=unverifiable，保守等待）
```

## 二、三条结论

1. **`pid` 不存在 ⇒ 一律 `verdict=stale`，直接认领，与 `pidStart` 无关。**
   进程已经不在，就不存在 pid 复用问题；`pidStart` 的意义只在于「进程还活着时」区分是不是同一个。
   所以老格式锁（只有 `{pid,ts}`）在新判定器眼里**不是永远偷不到**——只要持有进程已退出，第一档就判死。
   （`scripts/lib/typecheck-lock.mjs`：`if (!holderAlive) return { state: 'dead', ..., verdict: 'stale' }`）

2. **`pid` 还在、但没有 `pidStart` ⇒ `verdict=unverifiable`，保守等待，不偷。**
   这是**正确的活锁**，不是判据 bug：身份无法核实就不该抢，抢错的代价是两场全量 typecheck 同时跑。
   「新版本读老锁」的代价上限 = 等对方跑完，而不是永久等待，因为对方一退出就落回第 1 条。

3. **`ts` 本身不能判死。**
   `ts` 没有心跳，只能证明「写锁的时刻」，无法区分「长跑」与「进程已死但 pid 还在」。它只能用于可读日志，
   不得参与 stale 判定——判定只用 `pidAlive` 与 `pidStart/verify` 两档。
   （用 `pid` + `ts` 的组合能判死，是因为其中的 `pid` 不在；`ts` 本身不提供这个信息。）

本次实测两条原文（探针：老格式 `{"pid":999999,"ts":<now-5000>}`，`pidAlive` 注入）：

```
dead : {"state":"dead","verdict":"stale","holderAlive":false,"pidStart":null}
alive: {"state":"held","verdict":"unverifiable","holderAlive":true,"pidStart":null}
```

上面 `alive` 一行对应当前机器上真实发生过的情形：`wt-web-deep-audit-1107` 的 `typecheck-full.mjs`
（pid 36868）持有老格式锁，本线看到的正是 `holderAlive=true / verdict=unverifiable / pidStart=null`，
于是等待而不是抢占。

## 三、`holderPidStart` 允许为「未知」——这是设计，不是判据缺失

跨版本场景下 `holderPidStart` 永远是空的。六件套日志因此显式接受这个值：

```
holderPid=(?:\d+|未知) holderPidStart=(?:\d+|未知) holderAlive=(?:true|false|未知)
verdict=(?:stale|live|unverifiable|未知) waitedMs=\d+ limitMs=\d+
```

`scripts/tests/typecheck-lock.test.mjs` 的 L2 断言里，`holderPidStart=(?:\d+|未知)` 表示**值可以为「未知」**。
所谓「六件套缺一个就红」，指的是**字段或行缺失**，不是「值必须非空」。看到 `holderPidStart=未知` 时：

- 正确做法：照常按 `verdict` 分流（`unverifiable` 就是保守等待）。
- 错误做法：把它当成判据缺失去「修」——例如为了消掉这个空值而把 `unverifiable` 改成 `stale`，
  那等于把上面第 2 条推翻，直接回到三棵 worktree 互锁、每棵都报未判定的状态。

写侧的义务仍然在：新版本在写入那一刻就落 `pidStart`（探针读不到才写 `null`），老锁只影响读取侧的容忍度，
不影响新锁往后能否被精确判定。

## 四、不要做的两件事

- 不要把 `unverifiable` 改成 `stale`：方向是「少抢一把」，抢错代价是并发全量 typecheck。
- 不要用 `ts` 或 `mtime` 推算死活：无心跳的单一时间戳无法区分长跑与死亡，且时间戳精度/取整会引入假红。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
