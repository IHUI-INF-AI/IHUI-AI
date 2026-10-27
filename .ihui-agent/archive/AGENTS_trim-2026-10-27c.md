<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS 摘除留痕(2026-10-27 第三刀,守门 207 体积清偿)

> 摘除前 103625 字节 → 摘除后 97247 字节(clean 面,未含水印)。
> 摘除的每一段都是**重复登记副本**(门 89 R4② 家族回潮 / git 网络与推送 stub 家族回潮 /
> 水印三档第三份 / §1 完成即删与速查区 380 行同物 / R4⑦ 内嵌整段 check-ruff / R4⑥ 空壳)。
> 族内保留的都是最全现行版;本文件逐字留档被摘原文(删副本不删证据惯例)。
## §1完成即删副本(行34,速查区380行为最全版)

- **完成即删要有器物(2026-10-20 立,2026-10-21 补 H4)**:① 门 229(`check-plan-closed-stock.mjs`,blocking,stagedTriggers=PROJECT_PLAN.md):S1 拦「跨枚滞留」= 被审面某已勾登记行的**复合主键在父提交面也是已勾** ⇒ 红;刚翻勾那一枚不拦(守门 71 头注 (c) 要的 closed 配平凭据);S2 全量档只报数。② 兜底清扫器 `strip-stale-closed-rows.mjs`(判据 import 门 229)走 `object-space-land` 摘滞留行并自带推送腿;H1 未勾行逐字节同序 / H2 行数差==清扫数 / H3 摘后滞留集==本轮跳过集(基线 HEAD^)/ H4 摘前先借门 71 的 historyMarkers+missingFrom 问"摘了会不会被按未勾还原",仍保护的一律跳过并点名;结论 `SWEEP-RESULT state=clean|stripped|all-held|refused|undetermined`,all-held 落 exit 3;`--apply` 由 guardian 每 **5 分钟**派发(2026-10-23 由 30 分钟下调,理由见下条),单批 ≤400 条;应急 `HUSKY_SKIP_PLAN_CLOSED_STOCK=1` + `..._REASON`。

## R4漏点名补记②重复副本(行368)

- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:下面四枚是**只读尺子/自检器**,接线面分别是 `scripts/git-guardian.mjs` 巡检轮派发与根 `package.json` 的 npm script,**均不进提交链**(§12e,判机器状态或产出台账)——`check-gate-rot.mjs`(守门判据腐烂自检:只吃注册表 `script:` 与 `scripts/lib/judgement-libs.json` 两处权威清单,判"清单点名而盘上不存在",三态 clean/rot/undetermined,未判定不冒绿;`--ratchet` 只喊相对基线**新增**,`--suggest` 给修法,`--self-test` 取证;派发点 = git-guardian 巡检轮) `check-plan-truncated-rows.mjs`(`check:plan-truncated-rows`;台账残行只读尺 + 基线棘轮:R1 空正文 / R2 截断收尾两型互斥,识别逻辑单源 import `check-plan-fragment-rows.mjs` 不写第二份正则,基线 `scripts/check-plan-truncated-rows-baseline.json`,只有身份不在基线的命中判红;`--self-test`) `check-web-rn-screen-parity.mjs`(`check:web-rn-parity`;web→RN 功能覆盖账本,判定权在登记表 `scripts/data/web-rn-screen-map.jsonl`,未登记的 web 路由 = unmapped 缺口候选,登记腐烂(指向不存在的文件/键不在路由集/豁免缺 reason)逐条点名;只读报表 exit 0、取不到面 exit 2) `check-miniapp-mirror-fidelity.mjs`(`check:mirror-fidelity`;小程序镜像页还原度对账:共享屏业务 i18n 键集为分母、镜像页实消费键集为分子,差集 = 声明了却没还原的文案键,`t()` 直调与 `PAIR_KEYS`/`SINGLE_KEYS` 两通道并集防"刚生成即恒 0") `check-analytics-page-coverage.mjs`(`check:analytics-coverage`;埋点覆盖面只读尺:分母=仓内声明页面清单 —— web 路由文件 / 小程序 app.config 主包+分包 / RN 屏名 / 插件侧栏路由,分子=visit_logs 去重 url,按端报 zeroVisit 与清单外;判据层 `scripts/lib/analytics-coverage.mjs`,镜像 `scripts/tests/analytics-coverage.test.mjs`;连不到库 ⇒ exit 2 未判定,绝不把"没判"读成"零缺口";**零访问 ≠ 未埋点**(四端都是单点挂载),它回答的是"声明面与观测面谁更宽")。**退役口径**:任一枚退役时须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 会变成跑不通的出路(§8 文档不得写跑不通的出路)。

## 水印三档重复副本(行374)

- 上一条的现行口径(三档,原文留档于归档):①**面**——这两处按 §0.4 同面同轮:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;清单与内容不同形 ⇒ "HEAD 缺载荷、盘上副本已补好但没提交"这一型两面各自都"没问题",悬留替红顶绿。②**退出码**——三档:判出缺口 ⇒ 1,**取不到被审面 ⇒ 2 并显式写「未判定」(不记绿也不冒红)**,判通过 ⇒ 0。③**自愈档**——`git add` 只准发生在 `--staged`(紧接着就 commit);全量档/`--push-gate` 档 inject 后**只写工作区、不动索引**(工作区可回滚而索引不可)。取证:`scripts/tests/check-watermark-coverage.test.mjs` W9(三面分叉正控)/W10(三面一致⇒三档全 0,防恒红)/W11(取不到⇒rc 2)。

## git网络与推送重复stub/旧措辞(行384)

- **git 网络与推送**:规则唯一面 = 速查区「git 网络与推送」那条(2026-10-24 收敛:本文原有三份副本,只留最新最全的一份)。

## R4漏点名补记②重复副本(行398)

- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:下面四枚是**只读尺子/自检器**,接线面分别是 `scripts/git-guardian.mjs` 巡检轮派发与根 `package.json` 的 npm script,**均不进提交链**(§12e,判机器状态或产出台账)——`check-gate-rot.mjs`(守门判据腐烂自检:只吃注册表 `script:` 与 `scripts/lib/judgement-libs.json` 两处权威清单,判"清单点名而盘上不存在",三态 clean/rot/undetermined,未判定不冒绿;`--ratchet` 只喊相对基线**新增**,`--suggest` 给修法,`--self-test` 取证;派发点 = git-guardian 巡检轮) `check-plan-truncated-rows.mjs`(`check:plan-truncated-rows`;台账残行只读尺 + 基线棘轮:R1 空正文 / R2 截断收尾两型互斥,识别逻辑单源 import `check-plan-fragment-rows.mjs` 不写第二份正则,基线 `scripts/check-plan-truncated-rows-baseline.json`,只有身份不在基线的命中判红;`--self-test`) `check-web-rn-screen-parity.mjs`(`check:web-rn-parity`;web→RN 功能覆盖账本,判定权在登记表 `scripts/data/web-rn-screen-map.jsonl`,未登记的 web 路由 = unmapped 缺口候选,登记腐烂(指向不存在的文件/键不在路由集/豁免缺 reason)逐条点名;只读报表 exit 0、取不到面 exit 2) `check-miniapp-mirror-fidelity.mjs`(`check:mirror-fidelity`;小程序镜像页还原度对账:共享屏业务 i18n 键集为分母、镜像页实消费键集为分子,差集 = 声明了却没还原的文案键,`t()` 直调与 `PAIR_KEYS`/`SINGLE_KEYS` 两通道并集防"刚生成即恒 0")。**退役口径**:任一枚退役时须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 会变成跑不通的出路(§8 文档不得写跑不通的出路)。

## git网络与推送重复stub/旧措辞(行403)

- **git 网络与推送**:规则唯一面 = 速查区「git 网络与推送」那条(2026-10-24 收敛:本文原有三份副本,只留最新最全的一份)。**2026-10-26 两条实测补**:① 出网代理腿死(本机 `http.proxy` 端口在听但 20/20 `Recv failure`,摘掉直连可通)⇒ `scripts/lib/face-reader.mjs` 的 `egressFallbackPlan` 只给**网络动词**在传输形态失败时摘代理**多跑一次**,两腿都不通就回吐第一手错误并留痕 `.ihui-agent/state/git-egress-degradation.log`;服务器裁决/竞态/钩子失败各有专档,绝不换腿重试(接线锁 `scripts/tests/git-egress-fallback.test.mjs`)。② `safe-commit` 在本进程取不到 `user.email` 时按唯一出口 `scripts/lib/bypass-git.mjs` 的 `REPO_GIT_IDENTITY_ARGS` 补署名(问不到当作"有身份",绝不伪造作者),且裸 exit 128 不再被当成索引锁争用重跑整条守门链(接线锁 `scripts/tests/safe-commit-failure-triage.test.mjs`)。

## R4⑥空壳行(行408)

- **R4 漏点名补记 ⑥(2026-10-27)**:

## R4⑦内嵌ruff重复段(行409)

`check-ruff-python.mjs`(254,blocking,射程 `apps/ai-service/`,跳过 `HUSKY_SKIP_RUFF=1`):把 Python lint 从「只挂 CI」接进提交链 —— 旁路落地与 `chore(auto)` 收编不跑钩子,欠账能在 HEAD 面静默积累(2026-10-27 净面实测 4 条真红,引入者均为收编提交)。判定面照门 35 同口径(HEAD/索引/磁盘),外部工具只看得见磁盘 ⇒ 先经 `face-reader` 取材 + `scratch-dir` 物化;pin 唯一源 `apps/ai-service/pyproject.toml`(解析不硬编码);uvx 缺失/pin 坏/面取不到 ⇒ exit 2 未判定且优先于红。自检 11 例、镜像 `scripts/tests/check-ruff-python.test.mjs` 11 例、接线锁 `check-ruff-gate-wiring.test.mjs`(装车证明读 HEAD + 反向对照逐维翻假)。

---

# 第二批(R4 点名行压缩 + §1 四段历史叙述整段迁出;同日同门清偿)

> 迁出原则:R4 判据只要求器物名在文内,细节/例数/实证以本件为唯一详账;
> §1 四段保留规则单行(义务不丢),实证流水整段逐字在本件。

## - **「重复登记副本」指针注记存量已清零 …(原行全文)

- **「重复登记副本」指针注记存量已清零、今后一条也不许再产生**(2026-10-13/14 收口,10-14 二次实测补因):自动档已停产指针注记(F4/F10 只报数);守门 13d 差值棘轮拦注记变多、全量档绝对零容忍;门 71 归档豁免射程已纳入清偿台账——**旁路落地(回捞器/自愈)不跑钩子,防它必须在判据源头接**。**回潮实测到三条通道,逐条都得有器物**:①*推送*——对象空间 CAS 不跑 post-commit ⇒ 自动推送腿不触发 ⇒ origin 仍持有被删行,故清偿器落地后必须自带 `git-push-guard.mjs`(2026-10-14 实测 11:48 清偿 350 → 13:45 带回 1699);②*判据输入集*——守恒断言的输入若依赖它要消的形态就会自锁(`foldTwins` 排除带注记行,而清偿正在剥注记 ⇒ "重复第一次被看见"读成"本轮造出重复"、整批拒落),两侧必须同基准归一化;③*活文档行级 union*——按整行字符串比份数,认不出"对侧改写过而本侧已按台账清掉"的行(实测 21:42 本侧 0 → 21:44 合并带回 9),正解是补回前按**复合主键**再问一次清偿台账,归在册票 G-32;兜底已装车在旁路落地自愈源头 `lib/post-merge-ledger-sync.mjs` 第二步(存量>0 才派生 `plan-pointer-purge --apply`,0 条一次都不派生),归并侧那半格仍未收口。分族键指纹优先(与门 203 同源),不要按复合主键分族。 〔2026-10-15 摘除 2 份并发带回的旧副本,被摘行逐字进 `.ihui-agent/archive/AGENTS_dedup-removed-2026-10-15.md`(照本仓 AGENTS_dedup-removed-* 惯例:删副本不删证据)〕

## - **护栏③ 收窄(2026-10-23 …(原行全文)

- **护栏③ 收窄(2026-10-23 立,治"让路变永久停摆")**:`strip-stale-claim-marks`(超龄认领牌代摘器)原护栏判「`git status --porcelain` 对台账非净 ⇒ 整批让路」。本仓多会话共写活文档、工作树副本**常年不净**,于是护栏天天触发、器物天天让路:留痕最后一条停在 2026-10-22 07:45,而派发节流台账显示此后每 30 分钟仍在跑,45 枚超龄牌一枚未摘。之所以"脏"本来就不构成让路条件:取材面是 `git show HEAD:PROJECT_PLAN.md`、落地走 `object-space-land`(blob 档 + CAS + 行级复活守卫,旧形态行逐字进 `LAND_CLASH_SCOPE.removed`)、工作树滞后带来的回潮由 `scrub-declared-removals` 与 `union-converge` 的 `declaredDropCaps` 两条通道兜 —— **脏的是别人的副本,不是判据面**。收窄后:只在本批旧形态行**被别席就地改写**时让路,且**只让路那几枚、其余照摘**(实测 45 枚里 4 枚在飞 ⇒ 摘 41、让路 4;原护栏会把 41 枚一起按住);让路行走 `planSweep` 的 `skipLines` 移入 held(不新写第二份判据),结论行补 `deferred=` 报数。工作树副本读不到 ⇒ 仍让路(未判定不猜)。派发节流同步 30min → **5min**(无滞留即零落地)。接线锁见 `scripts/tests/strip-stale-claim-marks.test.mjs`(护栏③ 三条 + 原 `planFaceClean` 已退役的形状锁)。**2026-10-23 实测**:待摘 45 → 4(剩的正是被别席改写那几枚),摘后借门 71 同一把尺子问"会不会被按未勾还原"点名 **0 ⇒ 0**,该族不会被回捞。

## - **「摘了又回来」已根治 …(原行全文)

- **「摘了又回来」已根治(2026-10-23 立,机主令"彻底根治 杜绝 以绝后患")**:此前清扫器摘得掉、存量却永远归不了零(实测 03:04 清扫一轮、03:27 已勾行仍 40 条),根因是这套器物**只造了一半**——清扫器 `strip-stale-closed-rows.mjs` 摘完落地却**一行留痕都不写**,于是两条回潮防线同时瞎:`scrub-declared-removals` 的 `declaredRows` 认不出这批行(它只认台账里的整行原文)、`union-converge` 的活文档行 union 只认"对侧相对基底新增" ⇒ 对侧旧基线里那份被当成别人的独有行原样补回 ⇒ 摘一次、回一次。三条补齐:① **留痕**——清扫器落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`(字段 at/seat/file/kind=stale-closed-sweep/commit/baseline),与 `strip-stale-claim-marks` 的 `stale-claim-strip.jsonl` 对等;**凭据是"HEAD 有没有被推进",不是落地器退出码**(实测 CAS 成功推进 HEAD 而落地器因回读未判定返 exit 2,按退出码跳过留痕就成"无凭据摘除");留痕必须排在落地成功之后,先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行。② **union 认台账**——`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 那一维(判据 import `scrub-declared-removals` 的 `declaredRows`,§0.6 单一真相源):台账命中 ∧ **本侧 0 份** ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣(扣了是丢本侧自己的行);台账取不到 ⇒ 一条不扣(失效方向恒为多留一份)。产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,故只在这一处接,与 `yieldedIdCaps`(让号形态)合起来才堵满"本侧处置权已行使"这一整格。③ **节拍**——guardian 派发节流由 30 分钟下调到 **5 分钟**(`sweepStaleClosedRows` 的 `intervalMs`):30 分钟那档跟不上结清提交的速度(03:12/03:14/03:20/03:25 各一枚),而无滞留时清扫器零落地零推送,压到 5 分钟不会刷爆共享仓。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`(9 例:留痕逐字/空集不落盘/留痕必须在落地之后/union 三条判据/两处 import 不许被删)。

## - **结清行的复洁器物(2026-10-22 …(原行全文)

- **结清行的复洁器物(2026-10-22 立)**:`auto-commit-quiet.mjs` 收编滞后的工作树副本时,会把"已按台账正当摘除的登记行"当成新增带回(实测四枚已结清票整批复活),因为归并档只判不丢行/不重复,判不出"这行已被摘过"。出口 `scripts/scrub-declared-removals.mjs`(由收编器在归并达标后调用,不进提交链)按摘除台账 `.ihui-agent/state/plan-row-drop.jsonl` + `.ihui-agent/state/stale-claim-strip.jsonl` 逐行剔除,三条件同时成立才动:整行逐字在台账 ∧ 当下 HEAD 面已无此行 ∧ 登记行形;任一不成立或取不到输入一律不剔(exit 2 未判定)。镜像 `scripts/tests/scrub-declared-removals.test.mjs`。

## R4 漏点名补记 ③(2026-10-26 …(原行全文)

- **R4 漏点名补记 ③(2026-10-26,E2E 自动补测·缺口发现门)**:`check-e2e-coverage-gap.mjs`(runner id 250,**warn 档**):判「射程内源码模块没有任何按命名约定的对应测试」,差值棘轮只拦**本次新增**;射程清单 `scripts/data/e2e-coverage-gap-scope.json`(3 根,reviewBy 2027-01-31)、判据层 `scripts/lib/e2e-coverage-gap.mjs`、补测骨架 `scripts/e2e-autofill.mjs --propose`;跳过 `HUSKY_SKIP_E2E_COVERAGE_GAP=1`。升 blocking 前置 = 存量缺口(HEAD 面 4009 个模块)归零。

## R4 漏点名补记 ②(2026-10-26 …(原行全文)

- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:下面四枚是**只读尺子/自检器**,接线面分别是 `scripts/git-guardian.mjs` 巡检轮派发与根 `package.json` 的 npm script,**均不进提交链**(§12e,判机器状态或产出台账)——`check-gate-rot.mjs`(守门判据腐烂自检:只吃注册表 `script:` 与 `scripts/lib/judgement-libs.json` 两处权威清单,判"清单点名而盘上不存在",三态 clean/rot/undetermined,未判定不冒绿;`--ratchet` 只喊相对基线**新增**,`--suggest` 给修法,`--self-test` 取证;派发点 = git-guardian 巡检轮) `check-plan-truncated-rows.mjs`(`check:plan-truncated-rows`;台账残行只读尺 + 基线棘轮:R1 空正文 / R2 截断收尾两型互斥,识别逻辑单源 import `check-plan-fragment-rows.mjs` 不写第二份正则,基线 `scripts/check-plan-truncated-rows-baseline.json`,只有身份不在基线的命中判红;`--self-test`) `check-web-rn-screen-parity.mjs`(`check:web-rn-parity`;web→RN 功能覆盖账本,判定权在登记表 `scripts/data/web-rn-screen-map.jsonl`,未登记的 web 路由 = unmapped 缺口候选,登记腐烂(指向不存在的文件/键不在路由集/豁免缺 reason)逐条点名;只读报表 exit 0、取不到面 exit 2) `check-miniapp-mirror-fidelity.mjs`(`check:mirror-fidelity`;小程序镜像页还原度对账:共享屏业务 i18n 键集为分母、镜像页实消费键集为分子,差集 = 声明了却没还原的文案键,`t()` 直调与 `PAIR_KEYS`/`SINGLE_KEYS` 两通道并集防"刚生成即恒 0";**CI 问责腿(2026-10-26 补)**= ci-monorepo build 矩阵 miniapp-taro 档 `mirror-fidelity` 步直跑 `--base=<基线>`(PR 判 base.sha、push 判 HEAD^1;只拦倒退、存量只报数,同 artifact-budget 的"只在 CI 问责"先例——三档面在干净检出上全部退化,不走 --base 即假接线) `check-analytics-page-coverage.mjs`(`check:analytics-coverage`;埋点覆盖面只读尺:分母=仓内声明页面清单 —— web 路由文件 / 小程序 app.config 主包+分包 / RN 屏名 / 插件侧栏路由,分子=visit_logs 去重 url,按端报 zeroVisit 与清单外;判据层 `scripts/lib/analytics-coverage.mjs`,镜像 `scripts/tests/analytics-coverage.test.mjs`;连不到库 ⇒ exit 2 未判定,绝不把"没判"读成"零缺口";**零访问 ≠ 未埋点**(四端都是单点挂载),它回答的是"声明面与观测面谁更宽")。**退役口径**:任一枚退役时须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 会变成跑不通的出路(§8 文档不得写跑不通的出路)。

## R4 漏点名补记 ④(2026-10-27 …(原行全文)

- **R4 漏点名补记 ④(2026-10-27,守门 89 R4 清偿)**:两枚**只读、不进提交链**(§12e)——`scripts/dispatch-board.mjs`(接线 = 根 `package.json` 的 `check:dispatch-board`;派单口径单入口 + `extractRefs` + `claimMarkOf`,做最大不相交子集切席与空转归因;exit 0/1/2;自检 24/24、镜像 17 例;磁盘容量是第 0 步前置判据)`scripts/check-lint-staged-stdio-pin.mjs`(只读盯针门,判 `patch-lint-staged-stdio.mjs` 三针是否还在 `node_modules`;判据住被 spawn 的脚本、本器零复制;exit 0/1/2;接线 = 根 `package.json` 的 `check:lint-staged-pin`,runner 注册现读 0 命中;自检 pass 11/fail 0、镜像 7 例;退役口径同 README 索引节)。

## R4 漏点名补记 ⑤(2026-10-27 …(原行全文)

- **R4 漏点名补记 ⑤(2026-10-27,守门 89 R4 清偿)**:`check-gate-triggers.mjs`(253,blocking,射程 `scripts/`,跳过 `HUSKY_SKIP_GATE_TRIGGERS=1`):判「注册表登记门没声明 `stagedTriggers` 射程」—— 同一份缺省在提交通道被读成「任何提交都跑」(§15d)、在落地通道被 `selectAffectedGates` 读成「永不复跑」,两通道反义 ⇒ 「落地后 N 臂全绿」可以是盲绿(2026-10-27 实证:门 193 缺射程,一笔落地往 `check-ps1-bom.mjs` 写进两处裸派生 git 后落地器报 19 臂全绿,唯一能咬住它的臂没跑)。差值棘轮锚点 = HEAD^:新增门缺射程 ⇒ 红;摘射程 ⇒ 红;存量只报数(--strict 全量;现读 152 道);info 档免判。**缺省判 HEAD 面不是索引**(索引常挂他人暂存面,判索引 ⇒ 全仓恒红;`--staged` 才判索引);JSON 档计数/清单分键(`counts.*` / `existingList`)。自检判据九例 + 端到端七例、镜像 `scripts/tests/check-gate-triggers.test.mjs` 4 例;同批 `land-gate-rerun.mjs` 补 `countUntriggered` 并把从未被打印的 notes 真打出来(旧绿行写「点名 N 条(见上)」全仓无一 print,§0.3 同族),绿行末尾自报「未声明射程未复跑 K 道」。

## R4 漏点名补记 ⑥(2026-10-27 …(原行全文)

- **R4 漏点名补记 ⑥(2026-10-27)**:`check-ruff-python.mjs`(254,blocking,射程 `apps/ai-service/`,跳过 `HUSKY_SKIP_RUFF=1`):把 Python lint 从「只挂 CI」接进提交链 —— 旁路落地与 `chore(auto)` 收编不跑钩子,欠账能在 HEAD 面静默积累(2026-10-27 净面实测 4 条真红,引入者均为收编提交)。判定面照门 35 同口径(HEAD/索引/磁盘),外部工具只看得见磁盘 ⇒ 先经 `face-reader` 取材 + `scratch-dir` 物化;pin 唯一源 `apps/ai-service/pyproject.toml`(解析不硬编码);uvx 缺失/pin 坏/面取不到 ⇒ exit 2 未判定且优先于红。自检 11 例、镜像 `scripts/tests/check-ruff-python.test.mjs` 11 例、接线锁 `check-ruff-gate-wiring.test.mjs`(装车证明读 HEAD + 反向对照逐维翻假)。

## R4 漏点名补记 ⑦(2026-10-27 …(原行全文)

- **R4 漏点名补记 ⑦(2026-10-27,守门 89 R4 清偿)**:`check-cross-end-spec-coverage.mjs`(256,blocking,args=`--ratchet`,射程 `packages/shared/src/ui/`、`packages/ui-react/src/components/`、`packages/ui-native/src/`、`apps/web/src/components/data/`、`scripts/check-cross-end-spec-coverage.mjs`、`scripts/data/cross-end-spec-baseline.json`,跳过 `HUSKY_SKIP_CROSS_END_SPEC_COVERAGE=1`):跨端视觉原子 spec 覆盖率棘轮 —— 阶段1/2 把 card/input/badge/tabs/dialog/tooltip/vip-badge/switch/sheet/avatar 双端消费 spec,阶段3 把「覆盖率不退化」接进提交链与 CI(同 `sheet-flex-contract` 独立 job);口径见脚本头注与 `cross-end-spec-baseline.json`(11 项含 button,collapsible 为 EXEMPT 不计分母)。退化(某原子 spec 在却某端不再消费)才红,涨不拦。<!-- ⑦内嵌的 check-ruff-python 重复段已摘,单源点名行=R4⑥;逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md -->
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
