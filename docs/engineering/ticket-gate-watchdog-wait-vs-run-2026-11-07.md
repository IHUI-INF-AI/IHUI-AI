<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 票：单门看门狗把「等锁」算进 300s 执行预算（2026-11-07）

状态：待办（执行器计时口径缺陷，非内容错误）
开票：2026-11-07 · `wt-api-defect-mining-1107` 线
实现落点：**主仓工作树** `D:\IHUI-AI\scripts\lib\gate-phase-watchdog.mjs`（已存在，2026-11-07 14:11；本分支与 `origin/main` 都还没有这份文件，**本分支不另写实现**，避免两份分叉）。

## 一、现象（本次实测原文）

推送票据提交时，`[T1]` 被判「跑不起来（未判定）」，push 被 `exit 2` 阻止：

```
[typecheck:full] 锁判据: holderPid=18180 holderPidStart=未知 holderAlive=true verdict=unverifiable waitedMs=289541 limitMs=600000 (身份无法核实:锁里没记录启动时间,按活锁保守处理)
  ▸   1/7  14%  FAIL [T1] 300065ms
```

- `waitMs = 289541ms`（等机器级 typecheck 锁，锁侧排队上限 `limitMs = 600000` **没到**）
- `runMs ≈ 300065 - 289541 ≈ 10.5s`（看门狗落刀时，全量 typecheck 还没真正开始跑）
- 批次总耗时 505.9s；等锁期间持有者从 pid 31196 换到 18180（另一棵 worktree 连续跑了两次全量）。
- 注：`waitMs/runMs` 四数行只在 `limitSource=env-override` 时打印；本次是默认档，只能从锁判据行 + 门的 `300065ms` 还原，这本身也是可观测性缺口。

## 二、根因

执行器对每道门只保留**一个** 300s 预算，且从子进程启动即开始计时 —— 等锁时间被算进「行驶时间」。而锁侧为了对齐门的排队上限，已经允许等到 600000ms（`GATE_QUEUE_WAIT_MS`）。两个上限不同源，于是：

- 锁还在合法排队（`waitedMs < 600000`）时，门先被 300s 砍掉 ⇒ `undetermined` ⇒ 推送被拦；
- 这不是「T1 跑不完」：同门空载实测 `runMs=105742`，负载下 `runMs=205394`，都远低于 300s；
- 同一批次其他门佐证「等锁被算进门耗时」不止 T1：`299 waitMs=465602 / runMs=17303`、`300 waitMs=482907 / runMs=5564`（这两门当时有 600000 覆盖，所以没死，但账面上已经把排队记成了门耗时）。

## 三、修法（不是调大 300s）

落在主仓的 `scripts/lib/gate-phase-watchdog.mjs`（它已实现阶段协议），执行器只做两件事：

1. **子门侧**：`[T1]` 在**真正取得锁之后**输出 `#ihui-gate-phase:run-start`；等锁期间按心跳输出
   `#ihui-gate-phase:wait-lock pid=<pid> ts=<ms> staleMs=<ms>`（三字段缺一不算证据）。
2. **执行器侧**：给 `[T1]` 登记 `phaseProtocol: true`，并传两个独立上限：
   - `runLimitMs = 300000`（真跑预算，维持现状）；
   - `waitLimitMs = 600000`（排队预算，**与锁侧同一来源常量**，不许另抄一个数）。

结局分两码，都继续 `exit 2`、都继续阻止推送，但归因不同：

| 码 | 含义 | 可重试 | 触发 |
| --- | --- | --- | --- |
| `ETIMEDOUT` | 执行真超时 / 卡死 | 否（先查机器） | `runMs > 300000`，或排队到点但没有可验证的持锁证据（fail-closed） |
| `BLOCKED_BY_CONCURRENCY` | 排队等锁超限 | 是 | `waitMs > 600000` 且 wait-lock 三字段齐全、pid 存活、心跳未过期 |

**为什么不调大 300s**：调大只是把等锁塞进更大的一格，锁一忙仍会砍在同一个桶里；且会同时掩盖真正的执行卡死。分开两个上限后，300s 继续只对「跑」负责，600s 只对「等」负责。

## 四、失效触发条件（任何一条成立，本票问题原样复现）

1. `[T1]` 不打 `run-start` 标记，或执行器没登记 `phaseProtocol` ⇒ `timing()` 回落老语义（`waitMs=0`，全程算 `runMs`）。
2. `run-start` 打早了（取锁之前）= 等锁重新算进 `runMs`，与未修改等价。
3. wait-lock 心跳不刷新 ⇒ 排队到点时证据过期，降级为 `ETIMEDOUT`（这是有意的 fail-closed，不是 bug）。
4. `waitLimitMs` 与锁侧 `GATE_QUEUE_WAIT_MS` 各自写死 ⇒ 两个数再次分叉（必须同源取值）。

## 五、夹具（三条，均可在**没有真实锁竞争**的情况下构造）

夹具方式：`createGatePhaseWatchdog({ phase: true, runLimitMs: 300000, waitLimitMs: 600000, now, setTimer, clearTimer, isPidAlive })`，
用假时钟 + 手工定时器队列推进；`isPidAlive` 注入桩。不需要真锁、不需要真跑 typecheck。

### F1 等锁 289s 后真跑 10s ⇒ **通过**

```
t=0         start()                        // 武装 waitTimer(600000)
t=289000    observe(`wait-lock pid=1234 ts=288000 staleMs=120000`)  // 心跳新鲜
t=289000    observe(`run-start`)           // 清 waitTimer，arm runTimer(300000)
t=299000    finish(); timing(299000)
断言：无 onExpire；timing = { waitMs: 289000, runMs: 10000 }
```

### F2 真跑 310s ⇒ **失败（ETIMEDOUT）**

```
t=0         start(); observe(`run-start`)
t=300000    runTimer 到期 ⇒ onExpire.code = 'ETIMEDOUT'
断言：code 严格等于 ETIMEDOUT；不得是 BLOCKED_BY_CONCURRENCY
```

### F3 等锁 700s ⇒ **按排队上限失败（BLOCKED_BY_CONCURRENCY，不是门预算）**

```
t=0         start()
…          每 ≤staleMs 观察一次 wait-lock（心跳必须刷新）
t=599000    observe(`wait-lock pid=1234 ts=599000 staleMs=120000`)
t=600000    waitTimer 到期，verifyWaitEvidence 通过 ⇒ code = 'BLOCKED_BY_CONCURRENCY'
t=600000    finish()
断言：code 严格等于 BLOCKED_BY_CONCURRENCY；timing().runMs === 0
```

### F3b（负向对照）等锁 700s 但无可验证持锁证据 ⇒ **ETIMEDOUT（fail-closed）**

```
t=0         start()；从不喂 wait-lock（或喂 ts 过期 / pid 已死 / 三字段残缺）
t=600000    waitTimer 到期 ⇒ code = 'ETIMEDOUT'
断言：不得把"拿不出证据"写成 BLOCKED_BY_CONCURRENCY（否则等于发免责牌）
```

## 六、验收口径

- F1/F2/F3/F3b 四条在**主仓**的 `gate-phase-watchdog` 测试里跑绿，且执行器侧另有一条接线断言：`[T1]` 注册里 `phaseProtocol: true` 且 `waitLimitMs` 与锁侧常量同源（数值相等，不写死两份）。
- 真机复核：下一次撞锁推送的日志必须出现 `waitMs/runMs` 分开的四数行，且 `limitSource=default` 也要打印（本票顺带要求：四数行不应只在 `env-override` 时出现）。
- 不动的边界：仍然 `exit 2`、仍然阻止推送；`BLOCKED_BY_CONCURRENCY` 只表示「可原样重跑」，绝不放行。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
