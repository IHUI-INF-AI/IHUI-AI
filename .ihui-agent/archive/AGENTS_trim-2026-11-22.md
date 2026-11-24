<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md 裁剪归档（2026-11-22，门 207 体积清偿）

> 本件由 `AGENTS.md` **整行逐字**移入。移出原因：补全「门名点名(R4)」全量清单需 +7,747 字节，
> 而门 207 的 AGENTS.md 预算 96,000 字节只剩 1,500 余量 —— 只能同批做体积清偿。
> 条款一条未减：原行逐字在此，AGENTS 正文对应位置留一行指针。行号按移出前的 AGENTS.md（HEAD=d7e36415）。

### 原第 34 行

- **「重复登记副本」指针注记存量已清零、今后一条也不许再产生**(2026-10-13/14 收口,10-14 二次实测补因):自动档已停产指针注记(F4/F10 只报数);守门 13d 差值棘轮拦注记变多、全量档绝对零容忍;门 71 归档豁免射程已纳入清偿台账——**旁路落地(回捞器/自愈)不跑钩子,防它必须在判据源头接**。**回潮实测到三条通道,逐条都得有器物**:①*推送*清偿器落地后必须自带 `git-push-guard.mjs`;②*判据输入集*——守恒断言的输入若依赖它要消的形态就会自锁,两侧必须同基准归一化;③*活文档行级 union*——按整行字符串比份数,认不出"对侧改写过而本侧已按台账清掉"的行,正解是补回前按**复合主键**再问一次清偿台账,归在册票 G-32;兜底已装车在旁路落地自愈源头 `lib/post-merge-ledger-sync.mjs` 第二步(存量>0 才派生 `plan-pointer-purge --apply`,0 条一次都不派生),归并侧那半格仍未收口。分族键指纹优先(与门 203 同源),不要按复合主键分族。

### 原第 35 行

- **归档机制已退役(2026-10-16,此行为留痕)**:口径见上「完成即删」——翻勾即整行删,不留档。现读 `git ls-files | grep -c archive-completed-tasks` 必须为 0;≠0 = 退役件被当"本机纯新增在飞件"收编回流(2026-10-21 实测发生)⇒ 只删回流件,**不得恢复旧命令**(其活判据出口已迁户 `scripts/lib/plan-block-partition.mjs`;§0.8 不许写跑不通的出路);历史残余见 `backup/archive-removal-2026-10-16` tag。未勾登记行照旧受守门 71 保护,删已勾行不豁免 130/203/71。〔原行逐字在 `.ihui-agent/archive/AGENTS_trim-2026-11-04c.md`〕

### 原第 38 行

- **护栏③ 收窄(2026-10-23 立,治"让路变永久停摆")**:`strip-stale-claim-marks`(超龄认领牌代摘器)原判「工作树对台账非净 ⇒ 整批让路」,而本仓多会话共写活文档、副本**常年不净**,于是护栏天天触发、器物天天让路。收窄后:只在本批旧形态行**被别席就地改写**时让路,且**只让路那几枚、其余照摘**(让路行走 `planSweep` 的 `skipLines` 移入 held,不新写第二份判据;结论行补 `deferred=` 报数);工作树副本读不到 ⇒ 仍让路(未判定不猜)。派发节流 30min → **5min**。接线锁 `scripts/tests/strip-stale-claim-marks.test.mjs`(含原 `planFaceClean` 已退役的形状锁)。〔原行逐字在 `.ihui-agent/archive/AGENTS_trim-2026-11-04d.md`〕

### 原第 39 行

- **「摘了又回来」已根治(2026-10-23 立,机主令"彻底根治 杜绝 以绝后患")**:三条补齐:① **留痕**——清扫器落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`,**凭据是"HEAD 有没有被推进",不是落地器退出码**;留痕必须排在落地成功之后,先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行。② **union 认台账**——`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 那一维(判据 import `scrub-declared-removals` 的 `declaredRows`,§0.6 单一真相源):台账命中 ∧ **本侧 0 份** ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣(扣了是丢本侧自己的行);台账取不到 ⇒ 一条不扣(失效方向恒为多留一份)。③ **节拍**——guardian 派发节流由 30 分钟下调到 **5 分钟**(`sweepStaleClosedRows` 的 `intervalMs`)。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`。

### 原第 40 行

- **结清行的复洁器物(2026-10-22 立)**:`auto-commit-quiet.mjs` 收编滞后的工作树副本时,会把"已按台账正当摘除的登记行"当成新增带回,因为归并档只判不丢行/不重复,判不出"这行已被摘过"。出口 `scripts/scrub-declared-removals.mjs`(由收编器在归并达标后调用,不进提交链)按摘除台账 `.ihui-agent/state/plan-row-drop.jsonl` + `.ihui-agent/state/stale-claim-strip.jsonl` 逐行剔除,三条件同时成立才动:整行逐字在台账 ∧ 当下 HEAD 面已无此行 ∧ 登记行形;任一不成立或取不到输入一律不剔(exit 2 未判定)。镜像 `scripts/tests/scrub-declared-removals.test.mjs`。

### 原第 99 行

- **④落地欠回写层(2026-10-14 立,`alignLandingDebtIndex`,同挂 `--align-drift`)**:`ALIGN_EXEMPT_PATHS` 把活文档从 ①②③ 整体绕行是**对的**,但旁路落地(`union-converge --apply` 用 commit-tree+CAS 只推进 HEAD)留下的那条**脏索引**从此无人负责——本层**只写索引、绝不写工作树**,判据 = 索引 blob 逐字节等于某枚 `bypass-landing` 留痕自述的前像(∧ 该枚 `landedSha` 是 HEAD 祖先 ∧ 工作区==索引);证明不了的一律 `held`/`undetermined` 逐条点名(§0.3),守护日志必打印。取证:`scripts/tests/heal-worktree-tracked.test.mjs` T9–T17(含形状锁"函数体内不得出现任何写工作树的动作")。

### 原第 143 行

- **冷跑(缓存全 miss)只加资源预算,不改判据**:27 包并发 × 每包 vitest 默认 `maxWorkers`(=核数) 会把 12C 机器超订到 130+ 进程,纯 import / 全仓扫描类用例被判超时(判据没错,是资源)。已按实测抬预算:`packages/database` 15→30s、`apps/extension` 15→45s(+`hookTimeout`)、`packages/app` 设 `maxWorkers: 4`(`tests/text-field.test.tsx` 曾跑到 260900ms)、`apps/extension/tests/background.test.ts` 单例 20→60s。**定性顺序**:先单跑该包(A/B 两个数字:单跑绿=资源争用⇒抬预算;单跑红=真缺陷⇒修代码),不得用抬预算掩盖真缺陷。

### 原第 145 行

- **`turbo.json` 的 `test.inputs` 必须含 `app/**`(2026-11-22 补,防假命中)**:`apps/web` 有 55 个测试文件与它们的被测页面源码住在 `app/**`(Next App Router,如 `app/(main)/admin/monitor/wallboard/__tests__/page-relay-pool.test.tsx` 测同目录 `page.tsx`),而 `src/**` 覆盖不到。缺 `app/**` 时改这些文件 turbo 会**复用旧缓存判绿**(比慢更危险,形状同"没判写成判过")。实测补后 `--dry=json` 的 web#test hash 纳入 2516 个 `app/` 下文件(补前 0)。删 inputs 任一条前先问"被测文件在哪"。

### 原第 146 行

- **测试里"逐文件派 git"必须批量成一次进程(2026-11-22 立,实测 57×)**:任何用例若对枚举出的 N 个文件各 spawn 一次 `git show`,在 Windows 上每次 ≈300ms,几十个候选就是 30–100s,**冷跑并发下会撞穿单例 timeout 判红**(`packages/app/tests/text-field.test.tsx` 的裸 TextInput 普查锁实测单例 104245ms 被 90s 档砍掉)。正解:`git cat-file --batch` 一次喂 `<rev>:<path>` 多行、按 `<oid> blob <size>\n<content>\n` 逐条切(缺对象回 `<rev> missing` ⇒ 计 unreadable/未判定,不当通过);同一份普查被多个用例读时 `beforeAll` 扫一次共享。改完实测 244s → 4.30s。判据与取值面一字不改(仍是 HEAD blob),只改取值方式。

### 原第 170 行

- **12d worktree 隔离规范 —— 已停用(2026-11-12,机主定案)**:本项目**禁止**用 git worktree 做并行开发隔离,理由是"隔离完还要合并"的收尾成本大于收益。判据:**禁止新建任何开发用 worktree**(仓内 `agent-worktree.mjs --create`、仓外 `worktree-isolate.mjs new` 两出口均在脚本内拒绝创建);**历史检出按 §12h 收敛**(能合即合、不能合先 tag 保活再回收);**清理与自愈层照旧保留**(`heal-worktree-tracked` / `git-guardian-worktree-reap` / 守门 208 / 守门 281)——停用针对"新建并开发",不是拆掉清扫历史遗留的器物。**例外(逐条点名,不静默)**:`safe-commit` / `sync-cross-end-cascade` / `close-merge-reconcile` 为判据对拍/跨端级联建的**临时派生检出**(`git worktree add --detach` 到 scratch,用完即 prune)不属"开发用 worktree",保留。**防回归守门**:`check-worktree-dev-banned.mjs`(门 316,blocking)静态校验两出口仍处拒绝态,改回可真建检出即红。

### 原第 177 行

### 12h. worktree 生命周期(2026-10-21 立;**2026-11-12 起停用新建,机主定案见 §12d**)

### 原第 178 行

> **本节现状 = 只管历史检出的收敛与清理,不再新建开发用 worktree**(停用判据见 §12d)。下列收尾五步与保活规则对**现存历史检出**继续有效,直至清零。

### 原第 179 行

- 落点 = 根直属 `.worktrees/`;收尾五步:①合并/裁决 → ②提交并推送 → ③回收检出 → ④删已并入分支 → ⑤`git worktree prune`。未合并的检出**不得静默删**:先打 `lost-commit/worktree-<名>-<sha7>` 标签保活;**合并与否由 agent 依证据自主裁决并执行**(能合即按五步合并→提交→推送,不能合则保活并在提交信息里写清理由),不再归人拍板。**新建出口已封**:见 §12d。

### 原第 182 行

- **临时派生检出寿命闸 Y-71（门体 `check-temp-worktree-lifetime.mjs`,warn 档 §12e）**:只读哨兵,绝不自动 prune/remove。射程 = `git worktree list` 里路径落 scratch/、`D:\DevEnv\Temp\`、os.tmpdir() 的派生检出;双维度老化 silentMs(最新文件 mtime)≥24h 或 ageMs(目录 birthtime)≥48h 点名(path/branch/HEAD/时长),目录不存在但 `git worktree list` 仍有条目 = orphan 单列。取材统一走判面层 `gitBinary()`。用法 `node scripts/check-temp-worktree-lifetime.mjs [--json]`,exit 0=ok / 1=stale|orphan|mixed(warn 不阻塞) / 2=未判定。三腿载体 git-guardian daemon 的存活另有独立哨兵 `check-guardian-leg-health.mjs`(Y-72)。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
