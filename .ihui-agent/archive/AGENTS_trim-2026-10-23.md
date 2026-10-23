<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md 压缩存档 2026-10-23(逐字移出原文,删副本不删证据)

> 来源 = AGENTS.md @c04a01c3a5b85f6357e82a3f2179629bcbbb8e0f(main)
> 立因:门 207 现读 HEAD 面 96,531 字节 > 预算 96,000 判红;速查区同一份清单登记 2–3 份且已漂移(见下)。规则条款本体全部留在 AGENTS.md,本件只收被移出的副本与取证叙述原文。

## 速查区「计划/台账」索引 副本之二(粘连坏行)

- 计划/台账: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs` `check-agents-doc-size.mjs` `check-plan-id-pool.mjs` `check-plan-closed-stock.mjs` `check-plan-claims-vs-head.mjs` `check-live-doc-archive-reinflation.mjs`(门体已造、尚未纳入 runner 注册表) `check-task-claims.mjs `check-plan-fields.mjs`

## 速查区「计划/台账」索引 副本之三

- 计划/台账: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs` `check-agents-doc-size.mjs` `check-plan-id-pool.mjs` `check-plan-closed-stock.mjs` `check-plan-claims-vs-head.mjs` `check-live-doc-archive-reinflation.mjs`(门体已造、尚未纳入 runner 注册表) `check-task-claims.mjs` `check-sweeper-liveness.mjs`(2026-10-23 立:清扫背离巡检只读探针——派发在动 ∧ 留痕静默 >2h ∧ 可清存量 >0 ⇒ 器物空转;不走提交链,派发层 = git-guardian 的 `auditSweeperLiveness`)

## 速查区「常驻工具」清单 副本之二

- 常驻工具(不在 runner,勿当没装车): `watermark.mjs` `guardian-runner.mjs` `safe-commit.mjs` `git-guardian.mjs` `git-lock.mjs` `deploy-lock.mjs` `union-converge.mjs` `merge-live-doc.mjs` `live-doc-edit.mjs` `object-space-land.mjs` `gate-registry-insert.mjs` `plan-tasks.mjs` `plan-tasks-merge.mjs` `plan-pointer-purge.mjs` `plan-task-index.mjs` `plan-fields.mjs` `plan-field-line.mjs` `plan-row-conservation.mjs` `plan-fields-extract.mjs` `plan-line-age.mjs` `bypass-git.mjs` `face-reader.mjs` `code-mask.mjs` `scratch-dir.mjs` `key-dir.mjs` `secret-path.mjs` `seal-c-root-stray.mjs` `scrub-temp-fixtures.mjs` `c-disk-breakdown.mjs` `plan-union-merge.mjs` `run-evidence.mjs` `visible-window-probe.mjs` `install-console-window-hook.mjs` `audit-pane-store-addressing.mjs` `commit-gate-attribution.mjs` `plan-bypass-ledger-report.mjs` `alert-volume-report.mjs` `provenance-ledger.mjs` `module-context.mjs` `desktop-build.mjs` `msvc-env.mjs` `desktop-unsigned-config.mjs` `desktop-build-saas.mjs` `desktop-dev-saas.mjs` `gen-line-icons.mjs` `post-commit-hook.js` `release-desktop-local.mjs` `notify-deploy-failure.ts` `start-dev.ps1` `hook-run-hidden.vbs` `ensure-silent-tasks.mjs`

## 「认领即租约」速查区副本

- **认领即租约**:开始任务在 `- [ ]` 后追加 `（进行中@YYYY-MM-DD/持有者短名）`,三要素齐备才算认领(裸 `（进行中）` 自 2026-10-22 定档起**新增即拦** = CL4,HEAD 已欠着的只报数;年龄 >72h 判红 = CL1;守门 109 四档同用 HEAD 存量棘轮,只拦本次带进来的);完成翻勾并摘牌;**提交链上的门绝不代摘任何人的认领**,而超龄牌由兜底器物 `scripts/strip-stale-claim-marks.mjs` 代摘(器物自带派发层 `sweepStaleClaimMarks`,2026-10-22 补建;判据 import 守门 109 的 `claimMarkOf`+`resolveTtlHours`,本层零复算;只摘「完整租约 ∧ 超龄」——正在干活的席位会续租,天然落在射程外;落地走 `object-space-land` 并把旧形态逐行写进 `removed` ⇒ 活文档行 union 不得再从对侧取回这一型;裸标记由器物**默认代摘**(依据不是口头状态,而是同批的 CL4:新增已在提交链被拦住,而器物只读 HEAD 面 ⇒ 别人刚写下还没提交的牌进不了射程),机主原话写进留痕条目的 `ruling` 字段(`IHUI_CLAIM_STRIP_LEGACY_RULING="<原话>"`),行内只留 `#seq` 指针(实测注记最长 52 字),原牌日期/持有者/超龄量/摘除前后整行/基线与落地枚 sha 逐条落仓外留痕 `.ihui-agent/state/stale-claim-strip.jsonl`(90 天窗口老化,被裁条数必报,取不到判未判定)—— 注记本身会被活文档归并洗掉(实测一轮 64 枚只剩 6 枚),所以可追责的真相源是留痕 + 提交信息,不是台账行)。派单前先扫进行中项:`node scripts/check-task-claims.mjs`。**挂牌判据单源 = `scripts/lib/plan-task-index.mjs` 的 `claimMarkOf`**(2026-10-22 收三口径漂移:① 复选框后可带空白、② 带 `@日期/持有者` 的完整租约形写在行尾也算、③ 反引号码段内的裸标记属叙述不算;两把尺子曾各自读出 31 与 59,差值同时是"真牌隐身⇒两席领同一张票"和"叙述锁死真票⇒派单面虚低"两个方向的失真)。

## 「完成即删要有器物」速查区副本(5 分钟现值)

- **完成即删要有器物(2026-10-20 立,2026-10-21 补 H4)**:① 门 229(`check-plan-closed-stock.mjs`,blocking,stagedTriggers=PROJECT_PLAN.md):S1 拦「跨枚滞留」= 被审面某已勾登记行的**复合主键在父提交面也是已勾** ⇒ 红;刚翻勾那一枚不拦(守门 71 头注 (c) 要的 closed 配平凭据);S2 全量档只报数。② 兜底清扫器 `strip-stale-closed-rows.mjs`(判据 import 门 229)走 `object-space-land` 摘滞留行并自带推送腿;H1 未勾行逐字节同序 / H2 行数差==清扫数 / H3 摘后滞留集==本轮跳过集(基线 HEAD^)/ H4 摘前先借门 71 的 historyMarkers+missingFrom 问"摘了会不会被按未勾还原",仍保护的一律跳过并点名;结论 `SWEEP-RESULT state=clean|stripped|all-held|refused|undetermined`,all-held 落 exit 3;`--apply` 由 guardian 每 **5 分钟**派发(2026-10-23 由 30 分钟下调,理由见下条),单批 ≤400 条;应急 `HUSKY_SKIP_PLAN_CLOSED_STOCK=1` + `..._REASON`。

## 「worktree/索引自愈」速查区副本(含删除意图账)

- **worktree/索引自愈**(`heal-worktree-tracked.mjs`,挂 guardian tick):①恢复被外部删除的跟踪文件(索引==HEAD ∧ HEAD 存在)——**先问删除意图账**:该路径最新一条留痕若仍是 `report-only`(摘标未超 TTL,默认 2h,`IHUI_STAGED_INTENT_TTL_HOURS`)则只报数不代裁;超 TTL 而归属会话已不在 ⇒ 回盘并把逐字路径清单写回同一本账(2026-10-23 立,治"护栏天天让路⇒整仓长期验不动",实测曾十小时内 9→46 枚);②对齐幻影漂移(索引==HEAD ∧ 工作区==某祖先版本);③刷新落后索引(逐路径 update-index,绝不全局 reset);**MERGE_HEAD 在 ⇒ 各写索引层整轮让路**。

## 「新登记必须有交代」速查区副本(含侧车第四种交代)

- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么、要么带新鲜日期;三样皆无 = 无交代,提交链差值棘轮只拦本次带进来的(守门 130 F7/F8)。 **结构化侧车记录是第四种交代(2026-10-22 立,P1)**:侧车 = `scripts/data/plan-fields.jsonl`(键 = 编号 + 标题前缀逐字),写它只有 `node scripts/plan-fields-extract.mjs --apply` 一条出口(只搬说辞、一个台账行都不改;抽取前后每行归属桶零变化才放行,任一漂移整批不落);行内 `〔归:…｜等:…〕` 标头是**投影**、人不手写,渲染与对账的唯一实现 = `scripts/lib/plan-field-line.mjs`,机读判据 = `scripts/check-plan-fields.mjs`(blocking,档位只挂差值维:仅本次新增未勾行缺侧车 / 标头≠投影才红,存量缺侧车只报数不拦提交,§12e)。整行改写必须过的三维守恒(勾选态 ∧ 认领租约 ∧ 归属桶)实现位置 = `scripts/lib/plan-row-conservation.mjs`,调用方 import 它,不接受口头保证。

## 「摘了又回来」已根治 全文(取证叙述)

- **「摘了又回来」已根治(2026-10-23 立,机主令"彻底根治 杜绝 以绝后患")**:此前清扫器摘得掉、存量却永远归不了零(实测 03:04 清扫一轮、03:27 已勾行仍 40 条),根因是这套器物**只造了一半**——清扫器 `strip-stale-closed-rows.mjs` 摘完落地却**一行留痕都不写**,于是两条回潮防线同时瞎:`scrub-declared-removals` 的 `declaredRows` 认不出这批行(它只认台账里的整行原文)、`union-converge` 的活文档行 union 只认"对侧相对基底新增" ⇒ 对侧旧基线里那份被当成别人的独有行原样补回 ⇒ 摘一次、回一次。三条补齐:① **留痕**——清扫器落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`(字段 at/seat/file/kind=stale-closed-sweep/commit/baseline),与 `strip-stale-claim-marks` 的 `stale-claim-strip.jsonl` 对等;**凭据是"HEAD 有没有被推进",不是落地器退出码**(实测 CAS 成功推进 HEAD 而落地器因回读未判定返 exit 2,按退出码跳过留痕就成"无凭据摘除");留痕必须排在落地成功之后,先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行。② **union 认台账**——`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 那一维(判据 import `scrub-declared-removals` 的 `declaredRows`,§0.6 单一真相源):台账命中 ∧ **本侧 0 份** ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣(扣了是丢本侧自己的行);台账取不到 ⇒ 一条不扣(失效方向恒为多留一份)。产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,故只在这一处接,与 `yieldedIdCaps`(让号形态)合起来才堵满"本侧处置权已行使"这一整格。③ **节拍**——guardian 派发节流由 30 分钟下调到 **5 分钟**(`sweepStaleClosedRows` 的 `intervalMs`):30 分钟那档跟不上结清提交的速度(03:12/03:14/03:20/03:25 各一枚),而无滞留时清扫器零落地零推送,压到 5 分钟不会刷爆共享仓。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`(9 例:留痕逐字/空集不落盘/留痕必须在落地之后/union 三条判据/两处 import 不许被删)。

## 「护栏③ 收窄」全文(取证叙述)

- **护栏③ 收窄(2026-10-23 立,治"让路变永久停摆")**:`strip-stale-claim-marks`(超龄认领牌代摘器)原护栏判「`git status --porcelain` 对台账非净 ⇒ 整批让路」。本仓多会话共写活文档、工作树副本**常年不净**,于是护栏天天触发、器物天天让路:留痕最后一条停在 2026-10-22 07:45,而派发节流台账显示此后每 30 分钟仍在跑,45 枚超龄牌一枚未摘。之所以"脏"本来就不构成让路条件:取材面是 `git show HEAD:PROJECT_PLAN.md`、落地走 `object-space-land`(blob 档 + CAS + 行级复活守卫,旧形态行逐字进 `LAND_CLASH_SCOPE.removed`)、工作树滞后带来的回潮由 `scrub-declared-removals` 与 `union-converge` 的 `declaredDropCaps` 两条通道兜 —— **脏的是别人的副本,不是判据面**。收窄后:只在本批旧形态行**被别席就地改写**时让路,且**只让路那几枚、其余照摘**(实测 45 枚里 4 枚在飞 ⇒ 摘 41、让路 4;原护栏会把 41 枚一起按住);让路行走 `planSweep` 的 `skipLines` 移入 held(不新写第二份判据),结论行补 `deferred=` 报数。工作树副本读不到 ⇒ 仍让路(未判定不猜)。派发节流同步 30min → **5min**(无滞留即零落地)。接线锁见 `scripts/tests/strip-stale-claim-marks.test.mjs`(护栏③ 三条 + 原 `planFaceClean` 已退役的形状锁)。**2026-10-23 实测**:待摘 45 → 4(剩的正是被别席改写那几枚),摘后借门 71 同一把尺子问"会不会被按未勾还原"点名 **0 ⇒ 0**,该族不会被回捞。

## 旧归档指针注记两枚

> 重复登记副本已归档：见 `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md`「常驻工具清单（重复登记副本之一）」。

## 旧归档指针注记两枚(第二枚)

> 旧口径副本已归档：见 `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md`「完成即删要有器物（副本；其中 --apply 为旧值「每 30 分钟」，现行值见 AGENTS.md §1 同题条目）」。

## 就地改写的原行(逐字留档)

### §1「认领即租约」原行(派节拍旧值 30 分钟)

- **认领即租约**:开始任务在 `- [ ]` 后追加 `（进行中@YYYY-MM-DD/持有者短名）`,三要素齐备才算认领(裸 `（进行中）` 自 2026-10-22 定档起**新增即拦** = CL4,HEAD 已欠着的只报数;年龄 >72h 判红 = CL1;守门 109 四档同用 HEAD 存量棘轮,只拦本次带进来的);完成翻勾并摘牌;**提交链上的门绝不代摘任何人的认领**,而超龄牌由兜底器物 `scripts/strip-stale-claim-marks.mjs` 代摘(guardian 每 30 分钟派发;判据 import 守门 109 的 `claimMarkOf`+`resolveTtlHours`,本层零复算;只摘「完整租约 ∧ 超龄」——正在干活的席位会续租,天然落在射程外;落地走 `object-space-land` 并把旧形态逐行写进 `removed` ⇒ 活文档行 union 不得再从对侧取回这一型;裸标记由器物**默认代摘**(依据不是口头状态,而是同批的 CL4:新增已在提交链被拦住,而器物只读 HEAD 面 ⇒ 别人刚写下还没提交的牌进不了射程),机主原话写进留痕条目的 `ruling` 字段(`IHUI_CLAIM_STRIP_LEGACY_RULING="<原话>"`),行内只留 `#seq` 指针(实测注记最长 52 字),原牌日期/持有者/超龄量/摘除前后整行/基线与落地枚 sha 逐条落仓外留痕 `.ihui-agent/state/stale-claim-strip.jsonl`(90 天窗口老化,被裁条数必报,取不到判未判定)—— 注记本身会被活文档归并洗掉(实测一轮 64 枚只剩 6 枚),所以可追责的真相源是留痕 + 提交信息,不是台账行)。派单前先扫进行中项:`node scripts/check-task-claims.mjs`。**挂牌判据单源 = `scripts/lib/plan-task-index.mjs` 的 `claimMarkOf`**(2026-10-22 收三口径漂移:① 复选框后可带空白、② 带 `@日期/持有者` 的完整租约形写在行尾也算、③ 反引号码段内的裸标记属叙述不算;两把尺子曾各自读出 31 与 59,差值同时是"真牌隐身⇒两席领同一张票"和"叙述锁死真票⇒派单面虚低"两个方向的失真)。

### §1「完成即删要有器物」原行(节拍旧值 30 分钟)

- **完成即删要有器物(2026-10-20 立,2026-10-21 补 H4)**:① 门 229(`check-plan-closed-stock.mjs`,blocking,stagedTriggers=PROJECT_PLAN.md):S1 拦「跨枚滞留」= 被审面某已勾登记行的**复合主键在父提交面也是已勾** ⇒ 红;刚翻勾那一枚不拦(守门 71 头注 (c) 要的 closed 配平凭据);S2 全量档只报数。② 兜底清扫器 `strip-stale-closed-rows.mjs`(判据 import 门 229)走 `object-space-land` 摘滞留行并自带推送腿;H1 未勾行逐字节同序 / H2 行数差==清扫数 / H3 摘后滞留集==本轮跳过集(基线 HEAD^)/ H4 摘前先借门 71 的 historyMarkers+missingFrom 问"摘了会不会被按未勾还原",仍保护的一律跳过并点名;结论 `SWEEP-RESULT state=clean|stripped|all-held|refused|undetermined`,all-held 落 exit 3;`--apply` 由 guardian 每 30 分钟派发,单批 ≤400 条;应急 `HUSKY_SKIP_PLAN_CLOSED_STOCK=1` + `..._REASON`。

### §5b「worktree/索引自愈」原行(无删除意图账)

- **worktree/索引自愈**(`heal-worktree-tracked.mjs`,挂 guardian tick):①恢复被外部删除的跟踪文件(索引==HEAD ∧ HEAD 存在);②对齐幻影漂移(索引==HEAD ∧ 工作区==某祖先版本);③刷新落后索引(逐路径 update-index,绝不全局 reset);**MERGE_HEAD 在 ⇒ 各写索引层整轮让路**。

### §1「新登记必须有交代」原行(无侧车交代)

- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么、要么带新鲜日期;三样皆无 = 无交代,提交链差值棘轮只拦本次带进来的(守门 130 F7/F8)。

### 速查区「计划/台账」索引 基准行(并入前原文)

- 计划/台账: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs` `check-agents-doc-size.mjs` `check-plan-id-pool.mjs` `check-plan-closed-stock.mjs` `check-plan-claims-vs-head.mjs` `check-live-doc-archive-reinflation.mjs`(门体已造、尚未纳入 runner 注册表) `check-task-claims.mjs`

### 速查区「常驻工具」基准行(并入前原文)

- 常驻工具(非守门,勿因"不在 runner"当没装车): `watermark.mjs` `guardian-runner.mjs` `safe-commit.mjs` `git-guardian.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `heal-worktree-tracked.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `git-lock.mjs` `deploy-lock.mjs` `union-converge.mjs` `merge-live-doc.mjs` `live-doc-edit.mjs` `object-space-land.mjs` `gate-registry-insert.mjs` `plan-tasks.mjs` `plan-tasks-merge.mjs` `plan-pointer-purge.mjs` `plan-task-index.mjs` `plan-line-age.mjs` `bypass-git.mjs` `face-reader.mjs` `code-mask.mjs` `scratch-dir.mjs` `key-dir.mjs` `secret-path.mjs` `seal-c-root-stray.mjs` `scrub-temp-fixtures.mjs` `c-disk-breakdown.mjs` `plan-union-merge.mjs` `run-evidence.mjs` `visible-window-probe.mjs` `install-console-window-hook.mjs` `audit-pane-store-addressing.mjs` `commit-gate-attribution.mjs` `plan-bypass-ledger-report.mjs` `alert-volume-report.mjs` `provenance-ledger.mjs` `module-context.mjs` `notify-deploy-failure.ts` `desktop-build.mjs` `msvc-env.mjs` `desktop-unsigned-config.mjs`

## 收敛期由对侧滞后副本带回的旧口径指针行(2026-10-23 二次摘除,整行原文)

> **本文件为 2026-10-14 压缩版**:规则条款全部保留;历史叙述、失效原文残留、重复登记副本与超长守门登记整区逐字归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`(出处 HEAD `c7834a8f0388aa006ca746cb1cc4a3006336c23d`,1,261,607 字节)。本文与归档原文冲突时以本文为准;本文未写的历史案例按归档件查。另见 `.ihui-agent/archive/AGENTS_history.md`。2026-10-21 二次压缩:压缩前原文逐字归档于 `.ihui-agent/archive/AGENTS-pre-compress-2026-10-21.md`。

> 摘除依据:本文头部另有一枚修正版逐条否证了它引用的三处出路(`AGENTS_history.md` 与 `AGENTS-pre-compress-2026-10-21.md` 从未进过 git;`c7834a8f0388` 与 1,261,607 字节两条登记均不成立)。同一份文档里两版压缩说明并存 = §0.6 重复登记,且旧版给出的命令在 HEAD 面上跑不通 = §0.8。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
