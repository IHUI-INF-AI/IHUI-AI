<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 原路径: 本仓直写(worktree `IHUI-AI-wt-p1-gates-1108`)
> 生成时间: 2026-11-08 13:40
> 所属工作线: P1 缺陷修复(DG-01〜DG-06 收尾后的存量红裁定)

# 票：gate-failure-kind C7/F5 存量红 —— 两条判据的锚点错位(判据缺陷,非被测代码缺陷)

状态：CLOSED(同笔修复，见「处置与取证」)　　开票：2026-11-08　　开票人：P1 修复线

## 现象

```
node --test scripts/tests/gate-failure-kind.test.mjs
→ tests 18 / pass 16 / fail 2
```

两处失败均不在本次 6 条 P1 的改动面内，也不是本笔引入；但在 `origin/main 7d6391158d` 上同样复红（见下），属于长期挂着的存量红。

| 用例 | 失败断言 | 期望 | 实际 |
|---|---|---|---|
| C7 | `gate-failure-kind.test.mjs:120` | `/stdio: \['ignore', 'inherit', 'pipe'\]/` | 执行器无此字面量（并行档是 `['ignore', 'pipe', 'pipe']`） |
| F5 | `gate-failure-kind.test.mjs:275-279` | 首个 `decideGateOutcome({` 调用块内含 `/code: e\?\.code \?\? null/` | 首个出现是 `appendGateProgress` 的观测旁路（`:128-131`），本就不传 `code` |

## 两处原文（改前）

C7（`scripts/tests/gate-failure-kind.test.mjs:111-121`）：

```js
test('C7 stderr 必须仍被吐回上游(改 pipe 之后,"子门的话看得见"靠的是这段代码)', () => {
  const here = resolve(fileURLToPath(import.meta.url), '../../..')
  // 2026-10-16 执行段外置:这段捕获/回吐在 applyGateResult 里,随执行段搬到 executor lib。
  const src = readFileSync(resolve(here, 'scripts/lib/guardian-executor.mjs'), 'utf-8')
  assert.match(src, /process\.stderr\.write\(gateStderr\)/, '没有把捕获到的 stderr 原样写回 ⇒ 判据输出被静默吞掉(比误报更难查)')
  assert.match(src, /stdio: \['ignore', 'inherit', 'pipe'\]/, 'stdio 形态变了要同时回头看那句 write')
})
```

F5（`scripts/tests/gate-failure-kind.test.mjs:258-288`，摘录锚点段）：

```js
  const src = readFileSync(resolve(here, 'scripts/lib/guardian-executor.mjs'), 'utf-8')
  const from = src.indexOf('decideGateOutcome({')
  const to = src.indexOf('})', from)
  assert.ok(from > 0 && to > from, '取不到 decideGateOutcome 调用处(结构变了?)')
  assert.match(src.slice(from, to), /code: e\?\.code \?\? null/, '调用处没传 code ⇒ 兜底弄死仍被读成判红(本次改动的主罪状,回归即红)')
```

## 被测面原文

- `scripts/lib/guardian-executor.mjs:690-695`（并行档派发）：
  `spawn(process.execPath, [...], { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {...} })`
- `scripts/lib/guardian-executor.mjs:893-896`（设计说明，逐字）：
  > 2026-08-19 立的这条注释已过时(原写"stdio:inherit 已把 stderr 透传,无需 silent-skip 检测"):
  > 现在 stderr 是**管道进来的**,由上方 `process.stderr.write(gateStderr)` 负责原样吐回上游 ——
  > 也就是说"子进程的话一定被打印"这件事仍然成立,但**保障它的是这段代码,不是 stdio 模式**。
  > 谁再改 stdio 配置,必须同时回头看那一句 write,否则判据的输出会被静默吞掉(比误报更难查)。
- `scripts/lib/guardian-executor.mjs:128-131`（`appendGateProgress` 的观测旁路调用，无 `code`；
  该支只在 `r?.error` 为空时执行，本来就不该有兜底码）。
- `scripts/lib/guardian-executor.mjs:906-911`（真正的门结论调用）：
  ```js
  const kindPre = decideGateOutcome({
    status: e?.status ?? null,
    signal: e?.signal ?? null,
    code: e?.code ?? null,
    stderr: gateStderr,
  })
  ```

## `origin/main 7d6391158d` 取证

只读取证（未 checkout）：

- `git show origin/main:scripts/lib/guardian-executor.mjs` 中首个 `decideGateOutcome({` 位于字符 6090，
  其后 260 字内无 `code`（HEAD 同形态，首个位于 6271）⇒ F5 在 main 同样红。
- main 版本中不存在 `stdio: ['ignore', 'inherit', 'pipe']` 字面量 ⇒ C7 在 main 同样红。
- main 的该文件与 HEAD 有 `8+/27-` 行差异，但两处被断言的特征在两侧都不成立。

结论：**不是"main 已修好"，而是判据锚点/期望值错位**；这是判据自身缺陷，按"存量红真修"处理。

## 两条判据到底想守什么

- **C7**：守的是"子门 stderr 被捕获后必须原样回吐"这一对约束 —— `stderr: 'pipe'`（捕获）+ `process.stderr.write(gateStderr)`（回吐）。
  用例标题自己写着"改 pipe 之后"，却把期望值钉成 `inherit`：与设计相矛盾，是 2026-08-19 遗留下来的陈旧字面量。
  `inherit` 下根本没有 `gateStderr` 可写，两者不可能同时成立。
- **F5**：守的是"执行器把 `job.error.code` 交进同一把尺子"（否则超时/输出超限的兜底型会被读成判红）。
  `indexOf` 取"首个出现"天然会先撞上观测旁路 `appendGateProgress`；真正的语义点在 `kindPre` 调用块。

## 处置与取证（本笔）

| 项 | 改法 | 是否改判据语义 |
|---|---|---|
| C7 | 锚点改为真的 `spawn(process.execPath` 调用块，断言块内 `stdio: ['ignore', 'pipe', 'pipe']`；`write(gateStderr)` 断言原样保留 | 否（把陈旧期望值改成设计事实，tripwire 保留：改 inherit 或漏 write 仍红） |
| F5 | 锚点改为 `const kindPre = decideGateOutcome({` 之后到首个 `})`，断言块内 `code: e?.code ?? null` | 否（只是把取错调用点的 `indexOf` 收窄到真语义点，断言内容不变） |

未删断言、未放宽、未改被测代码。

取证读数：

```
改前: node --test scripts/tests/gate-failure-kind.test.mjs → tests 18 / pass 16 / fail 2 (C7,F5)
改后: node --test scripts/tests/gate-failure-kind.test.mjs → tests 18 / pass 18 / fail 0
牙齿(摘掉即红): 删 guardian-executor 的 `code: e?.code ?? null` 行 → F5 断言 false
               把 spawn 的 stdio 改回 inherit            → C7 断言 false
```

上述牙齿用同一段切片逻辑对内存文本求值验证（不落临时文件、不改工作树）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
