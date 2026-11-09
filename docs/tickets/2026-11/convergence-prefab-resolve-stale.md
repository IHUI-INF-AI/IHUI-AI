<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 原路径: D:\IHUI-AI\.ihui-agent\tmp\TICKET-20261107-prefab-resolve-stale.md
> 生成时间: 2026-11-07 13:48:41
> 所属工作线: 收敛线（预制解析件）

# TICKET-20261107 · 预制解析件陈旧导致「丢对侧独有行」

- 状态：待评审（本文只为票面，不含任何代码改动）
- 生成时间：2026-11-07
- 证据来源：只读核对（进程、reflog、blob、`git log -S`、闸判据源码）
- 触发现场：`git-sync-converge --branch main` → `union-converge --apply --theirs 12037d4f7a…`

---

## 1. 事故摘要

| 项 | 读数 |
|---|---|
| 收敛启动 | `git-sync-converge` PID 38332 @ 13:17:09；`union-converge` PID 17736 @ 13:17:31 |
| 三方锚点 | base `29cb27dc5fa` / ours `1291b6989a3` / theirs `12037d4f7a8` |
| 声明面 | 109 条 `--take-theirs / --take-ours / --union-capped / --resolve / --fold-keep` |
| 自败时刻 | **13:33:15**，`exit=1`：`❌ 合并冲突,且 union-converge 亦判需人工(落地闸不过 4 处 / 需人工 0 项 / exit=1)` |
| 主仓结果 | **零推进**：HEAD 仍 `1291b6989a`（三次采样 + 收尾复测全同）、`status --porcelain` 仍 281 项、本地 `refs/heads/main` 未动、`origin/main` 仍 `12037d4f7a` |
| 未发生的动作 | 无合并提交、无 `update-ref`、无 push、无 `heal-worktree-tracked --align-drift` |
| 被拦下的 4 处 | `README.en.md` / `README.ja.md` / `README.ko.md` / `scripts/guardian-runner.mjs`，告警文案均为「人工归并结果丢对侧独有行」 |

union 自报统计（原文）：
`[union-converge] APPLY base=29cb27dc5fa ours=1291b6989a3 theirs=12037d4f7a8 / 取对侧 2336 路径 / 活文档整份取对侧 0 / 两侧同改三方归并 130 / 需人工 0 / 对侧删除不传播 1 / 删除随合并传播 23 / 影子 .js 随合并删掉 0 / 影子 .js 未恢复 0 / 活文档行 union`

---

## 2. 两种丢，分开写

### 2.1 丢法 A —— README 三份：一处文案行，重复三种语言

- 丢失行（对侧原文，`len=359`）：
  `| AI service        | \`apps/ai-service\`   | FastAPI + LangGraph + LiteLLM + MCP … not supply network access or secrets |`
- 本侧同一行是 `len=155` 的旧版（只到 `… gateway, agent engine, RAG, workflows`）。
- 引入提交：**`ba28ac4d1e`** ｜ `2026-11-07 12:38:55 +0800` ｜ 智汇AGI社区 ｜ `docs: 在四份 README 写上沙箱生命周期的用法`
  - `--stat`：`README.en.md 2 +-`、`README.ja.md 2 +-`、`README.ko.md 2 +-`、`README.md 2 +-` → 4 files changed, 4 insertions(+), 4 deletions(-)
  - 在对侧历史内（`merge-base --is-ancestor ba28ac4d1e 12037d4f7a` rc=0）
- 三份预制件的 mtime 相差 **< 1 秒**（`13:38:44.899` / `13:38:45.744` / `13:38:46.591`）⇒ 同一批生成。
- 性质：**同一处丢**，只是语言变体重复三次；根 `README.md` 同样被该提交改过，但**未**出现在闸的 4 条里。

### 2.2 丢法 B —— `scripts/guardian-runner.mjs`：门射程被收窄

- 涉事门：**门 `24a`「📏 侧边栏宽度一致性」**（`script: check-sidebar-width-consistency.mjs`，`mode: blocking`）
- 对侧（theirs）7 项：
  ```js
  stagedTriggers: ["packages/design-tokens/", "apps/web/src/styles/design-tokens.css", "apps/web/src/components/sidebar.tsx", "apps/web/src/components/sidebar/", "apps/web/src/components/layout/GlobalShell.tsx", "apps/web/app/globals.css", "apps/web/app/layout.tsx"]
  ```
- 本侧（ours）= 基底（base）3 项：
  ```js
  stagedTriggers: ["packages/design-tokens/", "apps/web/src/styles/design-tokens.css", "apps/web/src/components/sidebar.tsx"]
  ```
- **少的四项（逐条）**：
  1. `apps/web/src/components/sidebar/`
  2. `apps/web/src/components/layout/GlobalShell.tsx`
  3. `apps/web/app/globals.css`
  4. `apps/web/app/layout.tsx`
- 引入提交：**`bf19e6174a`** ｜ `2026-11-07 12:28:37 +0800` ｜ 作者 `t` ｜ `fix(cross-end): 侧栏/抽屉宽度三端同源收口——几何档立 sidebarMaxWidth/sidebarCollapsedWidth,drawerWidth 250→160`
  - 在对侧历史内（`merge-base --is-ancestor bf19e6174a 12037d4f7a` rc=0）
  - 附注：该提交同时是 302p 提交 `152455bd30` 的父提交。
- 性质：**另一种丢** —— 不是文案，是**执行条件被收窄**。

---

## 3. 危害定性（本节为票面核心）

### 3.1 「整行缺字段」= 全跑，属安全方向

`scripts/lib/guardian-executor.mjs` 执行循环（L877）：

```js
if (check.stagedTriggers && passStaged && !stagedPathsTouch(check.stagedTriggers)) {
```

- `stagedTriggers` 为 `undefined` ⇒ 整个条件为假 ⇒ 该门在**每一次提交**都执行。
- 无报错路径：`normalizeTriggers(check.stagedTriggers)` 只在 truthy 分支内被调用（L887 / L890），不存在因缺字段而抛错或空转的代码路径。
- 代价只是变慢（多跑一道 blocking 门），覆盖率是变宽。**所以「删字段」不是危险方向。**

### 3.2 「保留字段但只留 3 项」= 静默收窄，这才是危险方向

- `stagedTriggers` 非空 ⇒ 条件仍然生效 ⇒ 门只在**暂存区触及这 3 个前缀**时才跑。
- 于是：**任何只改下列四个路径的提交，都会跳过门 24a**
  - `apps/web/src/components/sidebar/`
  - `apps/web/src/components/layout/GlobalShell.tsx`
  - `apps/web/app/globals.css`
  - `apps/web/app/layout.tsx`
- 而这四项**恰好就是 `bf19e6174a` 新增的那批「侧栏/抽屉宽度三端同源收口」改动所落的文件** —— 也就是这条射程本次要守的新面。射程被削掉的，正是该门要守的路径。
- 跳过时的行为（L884-891）：
  ```js
  skipped++
  notTriggeredGates.push({ id, label, triggers: normalizeTriggers(check.stagedTriggers) })
  console.info(`⏭  [${id}] ${label}(暂存区未触及:…,跳过)`)
  ```
  即：**只打印 `⏭`、只记账，不判红、不失败、不进红清单**。日志不读 = 完全不可见。
- 后果链条：改 `globals.css`/`layout.tsx`/`GlobalShell.tsx` 引入侧栏宽度回归 ⇒ 门 24a 不跑 ⇒ 回归以「绿」通过 ⇒ 跨端几何再次漂移（正是 302p / bf19e6174a 这一族要收口的问题）。
- 影响面不止当次：这份 3 项数组一旦被合进 HEAD，就成为**后续所有提交**的执行条件，收窄是**永久生效**的，直到有人手工加回。

### 3.3 两档定性对照

| 形态 | 门 24a 行为 | 是否红 | 方向 |
|---|---|---|---|
| 整行删除 `stagedTriggers` | 每次提交都跑 | 否（全跑） | 安全（变慢） |
| 保留 7 项 | 触及 7 类路径即跑 | — | 设计意图 |
| **保留 3 项（本次形态）** | **只触及 3 类路径才跑** | **否** | **危险（静默收窄）** |
| 保留 3 项 + 改 `scripts/` | 触及 `scripts/` 时会跑（门 24a 不在 `scripts/`） | 否 | 仍不覆盖被削的 4 项 |

---

## 4. 为什么元门没拦住

元门 = **门 262**「📌 门注册表射程声明完备性」（`scripts/check-gate-triggers.mjs`，blocking）。判据在 `judgeTriggers`：

```js
// L136
const hasTriggers = (e) => Array.isArray(e.stagedTriggers) && e.stagedTriggers.length > 0
```

```js
// L153-159
const sameGate = a && a.script === e.script
let verdict
if (mode === 'info') verdict = 'exempt-info'
else if (hasTriggers(e)) verdict = 'ok'
else if (!sameGate) verdict = 'new-no-trigger'
else if (hasTriggers(a)) verdict = 'regressed'
else verdict = 'existing'
```

```js
// L172-173
const newViolations = pick('new-no-trigger').concat(pick('regressed'))
const red = strict ? newViolations.concat(pick('existing')) : newViolations
```

结论（按代码原文，不按印象）：

1. **「摘掉整条」其实是判红的**：锚点有射程、现在没有 ⇒ `regressed` ⇒ 进 `newViolations` ⇒ 红（与门是新增还是存量无关）。
2. **存量缺射程只报数**：`existing` 只在 `--strict` 下入红（L173），默认档只打印「存量缺=」计数。
3. **真正的洞在判据粒度，不在新旧**：`hasTriggers` **只判「数组是否非空」，不判「元素是否变少」**。7 项 → 3 项仍是 `length > 0` ⇒ `verdict = 'ok'` ⇒ **新增门和存量门一律绿**。
   - 即：元门能守「有没有射程」，守不住「射程够不够」。
   - 本次 3 项数组携带的正是这条判据的盲区。

补充：该门的 `stagedTriggers: ['scripts/']` ⇒ 只有当提交涉及 `scripts/` 时它自己才会跑；一次只改 README/前端的合并若没带 `scripts/`，连这条元门本身也不会被触发。

> **结论：门只问「你有没有声明射程」，不问「你说的射程是不是比原来小」。删光会红、留一点就不管，连新增门被削射程也拦不住。**

---

## 5. 为何无法复原现场

| 事实 | 读数 |
|---|---|
| 闸判红时刻 | `13:33:15` |
| 四份预制件 mtime（**最新**） | `README.en.md 13:38:44.899` / `README.ja.md 13:38:45.744` / `README.ko.md 13:38:46.591` / `scripts/guardian-runner.mjs 13:39:01.092` |
| 时间关系 | 预制件 **晚于判红 5 分 29 秒 ~ 5 分 46 秒** ⇒ 判红当时那一版已被重写覆盖 |
| 原文件备份 | **无**。`D:/DevEnv/Temp/resolve/` 不在 git 内，未做快照 |
| 现版 blob | `f3e0a45cfbf2…` / `b42146bc2f6f…` / `f63c1ad09473…` / `cb87fcbef71a…` |
| 三方树（ours `1291b6989a` / theirs `12037d4f7a` / base `29cb27dc5fa`） | 上述 4 个 blob **一个都不存在** ⇒ 现版既非任一侧原样拷贝，也非基底拷贝，是人工/并集产物 |
| 现版重算结果 | 按闸的同一判据（`counter` 多重集 + `removedByOther` 修正）重算，**四处丢失条数全为 0** |

因此：**能证明「现象」和「门当时的行为」，不能证明「13:33 那版错在哪一行、由谁在何时生成」。**

- 可证：13:33 时闸读到的 `finalText` 缺对侧独有行（否则不会判红）；`ba28ac4d1e`(12:38:55) 与 `bf19e6174a`(12:28:37) 均早于收敛启动 13:17 ⇒ 提交不晚于预制件被使用 ⇒ 属「预制件未跟上对侧」。
- 不可证 / 读不到：预制件**最初生成时刻**（已被覆盖）、生成者身份、生成时依据的 sha、当时究竟缺几行（闸只打印前 1~3 条）。
- 唯一能证明「现在对」：现版 4 个文件已补齐（README 三份含 359 字长行，guardian L351 含 7 项）。

---

## 6. 四条修法（只写判断，不写实现）

| 优先级 | 修法 | 判断要点 |
|---|---|---|
| ① | **预制件必须带 `base/ours/theirs` 三个 sha 水印**，落地前比对当前三方 sha，任一不符即重算或判红 | 本次两笔对侧提交（12:28:37 / 12:38:55）都发生在预制件被使用前，但文件没有任何自证「我对应哪个 theirs」⇒ 陈旧完全静默。水印是把「陈旧」变成可判定的唯一低成本手段 |
| ② | 把「对侧独有行对账」从**事后判红**前移为**预制件准入校验** | 现有闸确实拦住了（这是它的功劳），但拦住时合并已经算完、人工已经判完，代价是一整轮 16 分钟。前移后失败发生在动手之前 |
| ③ | `stagedTriggers` 这类**射程配置**单独一条「只许增不许减」对账，**存量门也要管**（收窄需显式理由，否则红） | 元门 `hasTriggers` 只判有无（L136/L156），7→3 一律绿；且存量缺射程默认只报数。射程收窄是永久生效的静默降级，必须由显式理由换取 |
| ④ | **不靠人的记忆重算** | 收敛期间对侧仍在前进（12:28/12:38 两笔都落在同一天上午），13:17 到 13:33 之间无人能逐笔跟踪。这个责任必须由脚本对 sha 负责 |

补充判断（不属于四条，但同源）：预制件目前是「人工整份回灌」的产物（现版 4 个 blob 三方皆无），**人工产物与「零损失断言」之间缺一层机器可验的对应关系** —— ①②③ 都是在补这一层。

---

## 7. 待决（只列问题，不替你决定）

1. **归属线**：①（水印+sha 校验）归属 `union-converge` / `git-sync-converge` 这条收敛器线，还是独立巡检线？②（准入校验前移）是改 `union-converge` 的 `--resolve/--union-capped` 入口，还是新开一道门？③（射程只增不减）是改门 262 的判据，还是新开一道门？
2. **`[IG] immutable-exempt`**：②③ 改的都是「门自己的判据面」（`union-converge` 的零损失断言、`check-gate-triggers` 的 `hasTriggers`）。这类改动是否必须走 `[IG]` 的 `immutable-exempt`？若走，需要谁签、留什么证据？
3. **前移后的出口**：②前移后，若预制件确实需要人工取舍（例如对侧的行本身有问题），要不要保留一个「显式接受陈旧/显式接受丢失」的声明出口，避免把人工逼回裸 git 手术？该出口的证据形态是什么？
4. **「显式理由」的载体**：③ 中「收窄可以但要理由」，理由落在提交说明、声明文件、还是台账？存量门的一次性基线怎么建（当前「存量缺射程」的准确道数需现读，本文未取）？
5. **人工回灌的边界**：是否要求 `--resolve/--union-capped` 的输入必须由脚本按当前 theirs 现场生成、禁止人工整份回灌？若禁止，与「人已判过」的设计语义如何并存（人只判冲突点、不产出整份文件）？
6. **重算时机**：水印校验放在 `union-converge` 读文件的那一刻，还是放在 `git-sync-converge` 派发之前？差别是「错在多早被发现」以及是否需要重跑前序步骤。

---

## 8. 这条洞的判据草案（只写判断，不实现）

- **对账对象**：`stagedTriggers` 数组按**集合**比（不看顺序、去重）；基线取同一门在**上一个含该字段的版本**。
- **判红条件**：`cur ⊄ prev`（有旧项消失）且**没有显式收窄声明**。
- **收窄声明形态**：与 `immutable-exempt` 同族，写进**本次提交信息**（因为射程是判据面的一部分），必须含「删了哪项 / 为什么 / 那份路径现在由谁守」。
- **已知边界（必须写出）**：射程重命名（路径搬家）会表现为「删一项 + 加一项」，需按「路径是否存在」再判一次，否则会误红。

---

## 9. 这次事件的三个「差一点」

1. 差一点：`check.stagedTriggers` 缺失时是**全跑**（安全方向），所以若当初那版是整条删掉，反而不危险 —— 危险的是它恰好留下了 3 项。
2. 差一点：那道闸如果判的是「文件内容是否等于某一侧」，4 处都会放过（预制件是超集，三方树里都没有这个 blob）。
3. 差一点：预制件 mtime 只比判红晚五分钟，决定了我们还能不能复原现场 —— 现在不能。

---

## 附录 · 证据命令（均可复跑，只读）

```powershell
# 三方锚点与句柄
git -C D:\IHUI-AI rev-parse 1291b6989a 12037d4f7a 29cb27dc5fa
# 丢行引入提交（必须从对侧 sha 起算：本地 main 落后 origin/main 1267）
git -C D:\IHUI-AI log 12037d4f7a -S 'Sandbox lifecycle' --format='%h %ci %an %s' -- README.en.md
git -C D:\IHUI-AI log 12037d4f7a -S '"apps/web/src/components/sidebar/"' --format='%h %ci %an %s' -- scripts/guardian-runner.mjs
# 预制件 blob 与三方比对
git -C D:\IHUI-AI hash-object -- D:\DevEnv\Temp\resolve\README.en.md
git -C D:\IHUI-AI rev-parse 1291b6989a:README.en.md 12037d4f7a:README.en.md 29cb27dc5fa:README.en.md
# 元门判据
Select-String -Path D:\IHUI-AI\scripts\check-gate-triggers.mjs -Pattern 'hasTriggers'
# 执行循环消费点
Select-String -Path D:\IHUI-AI\scripts\lib\guardian-executor.mjs -Pattern 'stagedTriggers'
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
