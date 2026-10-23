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

## 并发同题压缩叠加后的族归并(2026-10-23 第三批,被删/被改原行逐字)

### 原 L30(2350 字节)— 原行(改写前)

- **认领即租约**:开始任务在 `- [ ]` 后追加 `（进行中@YYYY-MM-DD/持有者短名）`,三要素齐备才算认领(裸 `（进行中）` 自 2026-10-22 定档起**新增即拦** = CL4,HEAD 已欠着的只报数;年龄 >72h 判红 = CL1;守门 109 四档同用 HEAD 存量棘轮,只拦本次带进来的);完成翻勾并摘牌。**提交链上的门绝不代摘任何人的认领**,超龄牌由兜底器物 `scripts/strip-stale-claim-marks.mjs` 代摘(器物自带派发层 `sweepStaleClaimMarks`,guardian 每 5 分钟派发;判据 import 守门 109 的 `claimMarkOf`+`resolveTtlHours`,本层零复算;只摘「完整租约 ∧ 超龄」——正在干活的席位会续租,天然落在射程外;裸标记由器物**默认代摘**,依据是同批的 CL4 已在提交链拦住新增、而器物只读 HEAD 面 ⇒ 别人刚写下还没提交的牌进不了射程)。落地走 `object-space-land` 并把旧形态逐行写进 `removed` ⇒ 活文档行 union 不得再从对侧取回这一型;机主原话写进留痕条目的 `ruling` 字段(`IHUI_CLAIM_STRIP_LEGACY_RULING="<原话>"`),行内只留 `#seq` 指针;原牌日期/持有者/超龄量/摘除前后整行/基线与落地枚 sha 逐条落仓外留痕 `.ihui-agent/state/stale-claim-strip.jsonl`(90 天窗口老化,被裁条数必报,取不到判未判定)——注记本身会被活文档归并洗掉,所以可追责的真相源是留痕 + 提交信息,不是台账行。**护栏只认"本批旧形态行被别席就地改写"这一件事**(2026-10-23 收窄):工作树副本常年不净不构成整批让路——取材面是 HEAD、落地有行级复活守卫、滞后回潮由 `scrub-declared-removals` 与 `union-converge` 的 `declaredDropCaps` 两条通道兜;让路只让被改写那几枚、其余照摘,让路行走 `planSweep` 的 `skipLines` 移入 held 并在结论行补 `deferred=` 报数;工作树副本读不到 ⇒ 仍让路(未判定不猜)。接线锁 `scripts/tests/strip-stale-claim-marks.test.mjs`(护栏③ 三条 + 原 `planFaceClean` 已退役的形状锁)。派单前先扫进行中项:`node scripts/check-task-claims.mjs`。**挂牌判据单源 = `scripts/lib/plan-task-index.mjs` 的 `claimMarkOf`**(① 复选框后可带空白、② 带 `@日期/持有者` 的完整租约形写在行尾也算、③ 反引号码段内的裸标记属叙述不算)。

### 原 L34(790 字节)— 原行(改写前)

- **未带指针而整行逐字节相同的未勾登记行,唯一合法摘除通道 = `node scripts/plan-tasks-merge.mjs --fold-identical-open-rows [--commit]`**(2026-10-16 立,承台账票「台账"同一件事的多份逐字相同待办"没有任何一条合法摘除通道」方向①):同文两份在派单清单里是两行 ⇒ 两个会话各领同一张票,这就是"打架重复做"的机器成因;该档把多重集折到 1,**不加任何注记**(机主 2026-10-13 明令),断言为「claimable 一枚不动 ∧ F4+F4b 副本计数恰好减去删除份数 ∧ 注记枚数不增」,任一不过即整批不落。同题不同号而正文已漂开的副本**不归它**(机器折半即有损,交人工),带指针的那一族仍走 `--dedupe-open-rows`;两面旗同给当场 exit 2。

### 原 L35(1025 字节)— 原行(改写前)

- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么、要么带新鲜日期;三样皆无 = 无交代,提交链差值棘轮只拦本次带进来的(守门 130 F7/F8)。 **结构化侧车记录是第四种交代(2026-10-22 立,P1)**:侧车 = `scripts/data/plan-fields.jsonl`(键 = 编号 + 标题前缀逐字),写它只有 `node scripts/plan-fields-extract.mjs --apply` 一条出口(只搬说辞、一个台账行都不改;抽取前后每行归属桶零变化才放行,任一漂移整批不落);行内 `〔归:…｜等:…〕` 标头是**投影**、人不手写,渲染与对账的唯一实现 = `scripts/lib/plan-field-line.mjs`,机读判据 = `scripts/check-plan-fields.mjs`(blocking,档位只挂差值维:仅本次新增未勾行缺侧车 / 标头≠投影才红,存量缺侧车只报数不拦提交,§12e)。整行改写必须过的三维守恒(勾选态 ∧ 认领租约 ∧ 归属桶)实现位置 = `scripts/lib/plan-row-conservation.mjs`,调用方 import 它,不接受口头保证。

### 原 L37(1615 字节)— 原行(改写前)

- **「重复登记副本」指针注记存量已清零、今后一条也不许再产生**(2026-10-13/14 收口,10-14 二次实测补因):自动档已停产指针注记(F4/F10 只报数);守门 13d 差值棘轮拦注记变多、全量档绝对零容忍;门 71 归档豁免射程已纳入清偿台账——**旁路落地(回捞器/自愈)不跑钩子,防它必须在判据源头接**。**回潮实测到三条通道,逐条都得有器物**:①*推送*——对象空间 CAS 不跑 post-commit ⇒ 自动推送腿不触发 ⇒ origin 仍持有被删行,故清偿器落地后必须自带 `git-push-guard.mjs`(2026-10-14 实测 11:48 清偿 350 → 13:45 带回 1699);②*判据输入集*——守恒断言的输入若依赖它要消的形态就会自锁(`foldTwins` 排除带注记行,而清偿正在剥注记 ⇒ "重复第一次被看见"读成"本轮造出重复"、整批拒落),两侧必须同基准归一化;③*活文档行级 union*——按整行字符串比份数,认不出"对侧改写过而本侧已按台账清掉"的行(实测 21:42 本侧 0 → 21:44 合并带回 9),正解是补回前按**复合主键**再问一次清偿台账,归在册票 G-32;兜底已装车在旁路落地自愈源头 `lib/post-merge-ledger-sync.mjs` 第二步(存量>0 才派生 `plan-pointer-purge --apply`,0 条一次都不派生),归并侧那半格仍未收口。分族键指纹优先(与门 203 同源),不要按复合主键分族。 〔2026-10-15 摘除 2 份并发带回的旧副本,被摘行逐字进 `.ihui-agent/archive/AGENTS_dedup-removed-2026-10-15.md`(照本仓 AGENTS_dedup-removed-* 惯例:删副本不删证据)〕

### 原 L38(746 字节)— 原行(改写前)

- **归档机制(2026-10-16 退役,此行为留痕)**:现行口径见上面「完成即删」——翻勾后整行删除,不留档、不归档、不写占位注释。旧那套两步走连同它的三件器物(自动归档器、13c 那道门、根 package.json 里的 archive 脚本位)已全部从仓里移除,现读 `git ls-files | grep -c archive-completed-tasks` = 0、`node scripts/check-gate-wiring.mjs --strict` 的 R10 亦零缺口 ⇒ **不得再照旧文去跑那些命令**(§0.8:文档不许写跑不通的出路);历史残余见 `backup/archive-removal-2026-10-16` tag。防误删防线:未勾登记行照旧受守门 71 保护(已勾行不进保护集,删之合法);删行自由不豁免其他守门(130/203/71 未勾半照常判)。

### 原 L40(2037 字节)— 原行(改写前)

- **完成即删要有器物(2026-10-20 立,10-21 补 H4,10-23 补齐留痕与节拍)**:① 门 229(`check-plan-closed-stock.mjs`,blocking,stagedTriggers=PROJECT_PLAN.md):S1 拦「跨枚滞留」= 被审面某已勾登记行的**复合主键在父提交面也是已勾** ⇒ 红;刚翻勾那一枚不拦(守门 71 头注 (c) 要的 closed 配平凭据);S2 全量档只报数。② 兜底清扫器 `strip-stale-closed-rows.mjs`(判据 import 门 229)走 `object-space-land` 摘滞留行并自带推送腿;H1 未勾行逐字节同序 / H2 行数差==清扫数 / H3 摘后滞留集==本轮跳过集(基线 HEAD^)/ H4 摘前先借门 71 的 historyMarkers+missingFrom 问"摘了会不会被按未勾还原",仍保护的一律跳过并点名;结论 `SWEEP-RESULT state=clean|stripped|all-held|refused|undetermined`,all-held 落 exit 3;`--apply` 由 guardian 派发层 `sweepStaleClosedRows`(`intervalMs`,现读 5 分钟)派发,单批 ≤400 条;应急 `HUSKY_SKIP_PLAN_CLOSED_STOCK=1` + `..._REASON`。③ **摘了必须留痕**,否则两条回潮防线同时瞎、存量永远归不了零:落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`(字段 at/seat/file/kind=stale-closed-sweep/commit/baseline),与认领牌的 `stale-claim-strip.jsonl` 对等;**凭据是"HEAD 有没有被推进",不是落地器退出码**;留痕必须排在落地成功之后(先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行)。④ **union 认台账**:`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 维(判据 import `scrub-declared-removals` 的 `declaredRows`,§0.6 单一真相源)——台账命中 ∧ 本侧 0 份 ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣;台账取不到 ⇒ 一条不扣(失效方向恒为多留一份);产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,与 `yieldedIdCaps`(让号形态)合起来才堵满「本侧处置权已行使」这一整格。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`。

### 原 L41(715 字节)— 原行(改写前)

- **结清行的复洁器物(2026-10-22 立)**:`auto-commit-quiet.mjs` 收编滞后的工作树副本时,会把"已按台账正当摘除的登记行"当成新增带回(实测四枚已结清票整批复活),因为归并档只判不丢行/不重复,判不出"这行已被摘过"。出口 `scripts/scrub-declared-removals.mjs`(由收编器在归并达标后调用,不进提交链)按摘除台账 `.ihui-agent/state/plan-row-drop.jsonl` + `.ihui-agent/state/stale-claim-strip.jsonl` 逐行剔除,三条件同时成立才动:整行逐字在台账 ∧ 当下 HEAD 面已无此行 ∧ 登记行形;任一不成立或取不到输入一律不剔(exit 2 未判定)。镜像 `scripts/tests/scrub-declared-removals.test.mjs`。

### 原 L43(794 字节)— 原行(改写前)

- **自动档写活文档的硬规矩**:底稿一律取被审面(`git show HEAD:<文档>` / `scripts/lib/face-reader.mjs`),落盘走对象空间(临时索引 + `commit-tree` + CAS,不写工作树);落地前自证"父提交里每条 `[x]` 复合主键本次仍为 `[x]`",不成立拒绝落地(实测 18 行翻勾被退回的事故即此型)。**改写整行时还必须断言 `dispositionOf`(归他人/等条件/等拍板/可做)、`claimMarkOf`(租约)、`keyOfRow`(主键) 三维逐行不变,任一变了就整行还原**(2026-10-22 实测:把 161 枚 >400 字长行按本节压到 ≤400,切掉了中段的"归属:…"句子 ⇒ 派单口径 48→100,52 枚别人持有的票变成可领的票;门 71/109/130/203/229/234 当时全绿也照样错——账面要现读,不能只看守门 RC)。

### 原 L97(918 字节)— 原行(改写前)

- **侧边栏可见性三层分治(2026-10-20)**:`adminOnly`/`permission` 判**能不能看**(越权 = 权限漏洞,须与后端对齐);`advancedOnly` 判**要不要给普通人看**(纯降噪,不是鉴权);三者禁止合并成一个字段。`filterNavItemsByRole` + `filterNavItemsByTier` 两层由 `apps/web/src/components/sidebar/use-nav-visibility.ts` 的 `useNavVisibilityFilter` 单点组合,Sidebar 与 `components/layout/DomainHub.tsx` 共用该出口,禁止自行抄过滤;分档状态唯一真相源 `apps/web/src/stores/nav-visibility.ts`(`ALL_NAV_TIERS` + `hiddenTiers`),落 `user_preferences.group='preferences'` 的 `navTiers`,复用通用端点、不新开路由/不加迁移;改名 tier 须同改类型 `NavAdvancedTier` + `ALL_NAV_TIERS` + 设置页卡片;子项继承父项档位,父项要保留时只能逐子项标注;计数由 `__tests__/nav-tier-visibility.test.ts` 实跑钉住(数字现读)。

### 原 L119(902 字节)— 原行(改写前)

- **④落地欠回写层(2026-10-14 立,`alignLandingDebtIndex`,同挂 `--align-drift`)**:`ALIGN_EXEMPT_PATHS` 把活文档从 ①②③ 整体绕行是**对的**(2026-10-12 那次"刷新索引 + 回写工作树"两层接力吃掉 19339 行台账),但旁路落地(`union-converge --apply` 用 commit-tree+CAS 只推进 HEAD)留下的那条**脏索引**从此无人负责——一次不带 pathspec 的提交会把合并成果写回旧态,而 `git merge --ff-only` 被它挡下 ⇒ 停部署。本层**只写索引、绝不写工作树**,判据 = 索引 blob 逐字节等于某枚 `bypass-landing` 留痕自述的前像(∧ 该枚 `landedSha` 是 HEAD 祖先 ∧ 工作区==索引);证明不了的一律 `held`/`undetermined` 逐条点名(§0.3),守护日志必打印。取证:`scripts/tests/heal-worktree-tracked.test.mjs` T9–T17(含形状锁"函数体内不得出现任何写工作树的动作")。

### 原 L126(1239 字节)— 原行(改写前)

- 〔更正@2026-10-15,补上一条的退出码与取材面;上一条原文逐字留档,只作改判留痕读〕:①**面**——这两处自本日起按 §0.4 同面同轮:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱。此前是"清单取索引面(`ls-files`)、内容取磁盘(`readFileSync`)",两面不同形 ⇒ **"HEAD 缺载荷、盘上副本已被补好但没提交"这一型在两面各自都"没问题",悬留替红顶绿**(2026-10-14 实测三枚生成物即此型,门报绿而 CI 必红)。②**退出码**——上一条"均 exit 1"只覆盖"判出缺口"那一支;按 §0.3 现在是三档:判出缺口 ⇒ 1,**取不到被审面 ⇒ 2 并显式写「未判定」(不记绿也不冒红)**,判通过 ⇒ 0。③**自愈档**——`git add` 只准发生在 `--staged`(紧接着就 commit);全量档/`--push-gate` 档 inject 后**只写工作区、不动索引**,因为工作区可回滚而索引不可——pre-push 派的全量档 add 完永不 commit,就是"暂存区里挂着没人提交的东西"的成因。取证:`scripts/tests/check-watermark-coverage.test.mjs` W9(三面分叉正控,摘掉换面即翻绿)/W10(三面一致⇒三档全 0,防恒红)/W11(取不到⇒rc 2)。

### 原 L129(1094 字节)— 原行(改写前)

- **上游工具生成物不进水印覆盖面**(唯一出口 `scripts/data/watermark-tool-generated.json` + 判据 `scripts/lib/tool-generated-roots.mjs`,2026-10-16 立):免的是"必须带载荷"这一项,**不免前提** —— 三条缺一不生效:① 路径落在登记 root 前缀内(逐字节比);② 该文件在**被审面**上自述为工具产物(命中 markerRegex);③ `expires` 未到期。不自述 ⇒ 回到覆盖面按缺载荷判红;台账形状坏 ⇒ 水印层拒绝判定(既不冒绿也不冒红,与第三方台账同一条判序)。接线点在 `watermark.mjs` 的 `scanCoverage` 且**必须在 total++ 之前**(与第三方 excluded 同层,否则覆盖率会被读成暴跌),`list-uncovered` / `check-watermark-coverage` / CI 那一步自动继承。这一档不是行内豁免族,**不进守门 108 的族表**,存活期逐条写在台账里。典型现场:`apps/desktop/src-tauri/permissions/autogenerated/*.toml` 共 89 枚由 tauri 的 Rust build script 每枚重建,inject 进去的载荷会被下一次构建洗掉 —— 按现状判红就是恒红门(§12e)。

### 原 L142(1130 字节)— 原行(改写前)

- **发信量必须量得到,而且量的必须是"身份"(5e-3,2026-10-18 立)**:每一次投递尝试(成功**与**失败)都由发信层追写 `.ihui-agent/state/mail-send-ledger.jsonl`(ASCII 键 + ISO 时刻,身份只存 fp 前缀,收件人只存脱敏形态),量算仪 `alert-volume-report.mjs` 的"①b 发信面之二"按 `(producer, fp)` 数 24h 封数、同身份 60 分钟内 ≥2 封即点名风暴。立因是当天现读的一个**盲区**而不是噪声:该工具判据写死"ASCII 关键字 + 时间戳,中文一律不解码",而 git-guardian 的人到留痕是中文散文行 ⇒ 那天寄出 28 封(其中 18 封是同一场停摆),它账面上 `MAIL=0 封 / 0 个签名` —— **风暴判据结构上打不到最大的发信面,"一直在报警"这件事本身没人看得见**。同一天立守门 224(`check-alert-identity-volatility.mjs`)从源头拦"把 sha/时刻/原始计数/异常原文写进去重身份";量与拦必须同批,只装一边都算没修(只拦 ⇒ 下一种抖动没人识;只量 ⇒ 看见了还是照寄)。取不到台账一律落 `null`/未判定,**不得用 0 冒充"没寄过"**。

### 原 L148(1162 字节)— 原行(改写前)

- **Rust/MSVC 构建环境注入(2026-10-19 立)**:本机 `C:\Program Files\Git\usr\bin` 在系统 PATH 内且带 GNU `link.exe`,而 `apps/desktop/src-tauri/.cargo/config.toml` 的 `linker = "link.exe"` 按 PATH 解析 ⇒ 未加载 MSVC 的 shell 报 `link: missing operand after '\377\376'`,报错不提工具链。唯一真相源 `scripts/lib/msvc-env.mjs`(纯判据零 IO;`vswhere` 返回 `[]` 时用已知安装位兜底;PATH 键大小写不敏感;剔 `<Git>\usr\bin` 并前插 MSVC bin),入口薄壳 `scripts/desktop-build.mjs`(`--debug`/`--dev`/`--no-artifact-check`/`-- <透传>`);取不到工具链 ⇒ 显式「未判定」exit 2,绝不回落裸 env。已接线:`apps/desktop/package.json` 的 `build`/`build:debug`/`dev`/`dev:cdp`、`desktop-build-saas.mjs`、`desktop-dev-saas.mjs`、`release-desktop-local.mjs`;裸 `tauri build`/`tauri dev`/`cargo build` 不注入。**平台闸**:注入只对 win32 成立,macOS/Linux 用 clang/cc;判据单源 `needsMsvcInjection`,三个调用点都要问它(闸必须排在 planBuildEnv 之前);禁反向断言"文件里不许出现 `platform==='win32'`"。取证 `scripts/tests/desktop-build.test.mjs`(38 例)。

### 原 L205(707 字节)— 原行(改写前)

- **12g 派生 git 必须显式接管 stdio(2026-10-03 立,EBUSY 实测)**:本机任何派生 git 必须显式写 `stdio`(不写稳定 EBUSY;`shell:true` 经 cmd.exe 100% 复现;绝对路径不是豁免)。样板:`const stdio = opts.input === undefined ? ['ignore','pipe','pipe'] : ['pipe','pipe','pipe']`(带 input 必须 `['pipe','pipe','pipe']`)。判据门:`check-git-stdio-discipline.mjs`(193,括号配平取整个调用、只判属性名不判取值、禁行内豁免,豁免走具名台账)。反向门 `check-spawn-output-channel.mjs`(199):stdio 丢 stdout 又去读 ⇒ 结论恒 null,拦。任何"这行是否必要"的判断必须 ≥20 次成组对照,单次成功不构成"不需要"的证据。

### 原 L224(1949 字节)— 原行(改写前)

- **15c 工作树内禁止嵌套 git 仓**(守门 208 `check-no-nested-git.mjs`,blocking,`stagedTriggers: ['scripts/']` 把射程收到"能造出该状态的那一面";全量档一律跑):2026-10-14 实测——测试夹具在仓库内 `git init` 且**无任何清理钩子**,中断即永久残留 52 个演练仓,IDE 源代码管理把嵌套仓当独立仓库扫描,聚合出「暂存的更改 10000+(全 D)」幻影计数,而主仓命令行面自始至终干净(机主一度无法判断自己有没有活没交)。需要临时 git 仓的夹具一律走 `mkScratch()`(§15b,工作区外 + 进程退出自动回收)。射程外只有一格:扫根直属一层的 `.worktrees/`(§12d 规定的 worktree 检出落点,linked worktree 天然带 `.git` gitfile,判红就是逼所有人不开 worktree 的恒红门);同名目录出现在更深位置照旧命中。〔补登@2026-10-20〕同一仓**已注册的** linked worktree 不再靠落点位置豁免,改由门按 `gitfile⇄admin 面双向核验`分流并逐条打印(悬空 gitfile / 回指伪造 / 指向他仓 admin / worktree 内再长出 `git init` 夹具 —— 四种照旧红,镜像 ⑦ 钉死);立项凭据是 §15「临时件落 `.ihui-agent/tmp/`」与门 208 头注「worktree 落 `.worktrees/`」互相打脸,同一组路径 10-15→10-20 六轮登记→腐烂回潮;而照其第一条出路重登记必被门 84 判「行级复活」(208⇄84 互斥,票 O508)。故另设第二把载体 `scripts/data/no-nested-git-sites.jsonl`:每处一行、只记意图与归属/到期,**存续由门在判的那一刻现算**,失去命中只 ⚠ 不清红;旧 JSON 台账的语义与腐烂红一字未动(镜像 ⑨⑩ 钉住"未命中免不了任何东西、到期不免、坏行零免")。另 `entryBudget` 定档出处:2026-10-20 现读全树 207,268 条目 / walk 1,274ms ⇒ 原 200,000 必被顶穿 = 恒 `truncated` = 恒红(§12e),已抬到 1,000,000,属只增不减覆盖面的加强档。

### 原 L225(974 字节)— 原行(改写前)

- **15d 盘根写入回归锁**(守门 213 `check-disk-root-write.mjs`,blocking,无 stagedTriggers=任何提交都跑):扫描仓库代码里“往磁盘根(D:/G:/C: 一级,即项目树与 DevEnv 之外)写文件/建目录”的模式,对**本次提交新增**的判红(差值棘轮,锚点 = 该文件 HEAD 自身 W1 数;存量只报数不判红,§12e 恒红门禁令)。与 15b 的**盘上**卫生 `check-disk-root-hygiene.mjs` 互补——那道守“盘上别留垃圾”,本门守“代码别再产新的”(把生产者堵在提交口)。收窄集 = literal 首段 ∈ `{IHUI-AI, DevEnv}`(§15b 批准落点,精确匹配非前缀)不立 W1;已知合法生产者走豁免台账 `scripts/data/disk-root-write-exemptions.json`(`{file, reason, ticket, until}`,到期回队列重裁)。配套影子工具 `scripts/quarantine-disk-root-strays.mjs`(只读预演“将会隔离什么”,未接自愈链)。应急放行 `HUSKY_SKIP_DISK_ROOT_WRITE=1 git commit ...`(不推荐)。

### 原 L260(754 字节)— 原行(改写前)

- 守门 30a `check-commit-loss-guard.mjs`(blocking):reflog 50 步 + 远端 tag 校验 + tag 可达性 + **悬空 commit 30 天窗维**(2026-10-11 立:近 30 天内新产生且无 `lost-commit/*` 备份的悬空 commit 阻塞,须先 `git tag lost-commit/<name> <hash>` 再 commit;超窗只报数 = §29 人工 GC 存量;时刻读不到 ⇒ 保守算窗内照拦;`--window-days 0` 回全量语义,`--strict` 问责存量)。tag 自动同步 + 全命名空间一致性校验:`sync-lost-commit-tags.mjs`(`--check` 比名字 + SHA,覆盖全部命名空间;仅本地/同名 SHA 分歧/备份族仅远端 ⇒ exit 1,非备份族仅远端只告警;本脚本不在提交链注册表,post-commit 只跑 `--auto-push`);永久档案 `docs/lost-commit-archive.md`。

### 原 L380(786 字节)— 原行(改写前)

<!-- 「重复登记副本」指针注记的两版历史原文(2026-10-13 立版 / 2026-10-13/14 收口版)已逐字移入 `.ihui-agent/archive/AGENTS_trim-2026-10-20.md`;2026-10-21 批又逐字移出四段(207 旧档原文 / 常驻工具旧版清单 / 门 193 补登重复副本 / 本条长段副本)到 `.ihui-agent/archive/AGENTS_trim-2026-10-21.md`;2026-10-21 第二批又逐字移出 51 行尾部重复登记副本(§22/§26 旧版、速查区门 89/常驻工具/索引/API 行的重复副本、门 193/出口台账/deprecated-source/Rust-MSVC/chcp/--dev 的尾部互重与已取代旧版;R13 条款、`check-egress-ip-drift`、`desktop-build`/`msvc-env`/`desktop-unsigned-config` 三名与 G-921 括注已就地并入保留行)到同档;规则条款以本节压缩版为准。 -->

### 原 L384(550 字节)— 族内副本(整族摘除)

> **本文件为 2026-10-14 压缩版**:规则条款全部保留;历史叙述、失效原文残留、重复登记副本与超长守门登记整区逐字归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`(出处 HEAD `c7834a8f0388aa006ca746cb1cc4a3006336c23d`,1,261,607 字节)。本文与归档原文冲突时以本文为准;本文未写的历史案例按归档件查。另见 `.ihui-agent/archive/AGENTS_history.md`。2026-10-21 二次压缩:压缩前原文逐字归档于 `.ihui-agent/archive/AGENTS-pre-compress-2026-10-21.md`。

### 原 L385(1961 字节)— 同题副本

- **认领即租约**:开始任务在 `- [ ]` 后追加 `（进行中@YYYY-MM-DD/持有者短名）`,三要素齐备才算认领(裸 `（进行中）` 自 2026-10-22 定档起**新增即拦** = CL4,HEAD 已欠着的只报数;年龄 >72h 判红 = CL1;守门 109 四档同用 HEAD 存量棘轮,只拦本次带进来的);完成翻勾并摘牌;**提交链上的门绝不代摘任何人的认领**,而超龄牌由兜底器物 `scripts/strip-stale-claim-marks.mjs` 代摘(guardian 每 30 分钟派发;判据 import 守门 109 的 `claimMarkOf`+`resolveTtlHours`,本层零复算;只摘「完整租约 ∧ 超龄」——正在干活的席位会续租,天然落在射程外;落地走 `object-space-land` 并把旧形态逐行写进 `removed` ⇒ 活文档行 union 不得再从对侧取回这一型;裸标记由器物**默认代摘**(依据不是口头状态,而是同批的 CL4:新增已在提交链被拦住,而器物只读 HEAD 面 ⇒ 别人刚写下还没提交的牌进不了射程),机主原话写进留痕条目的 `ruling` 字段(`IHUI_CLAIM_STRIP_LEGACY_RULING="<原话>"`),行内只留 `#seq` 指针(实测注记最长 52 字),原牌日期/持有者/超龄量/摘除前后整行/基线与落地枚 sha 逐条落仓外留痕 `.ihui-agent/state/stale-claim-strip.jsonl`(90 天窗口老化,被裁条数必报,取不到判未判定)—— 注记本身会被活文档归并洗掉(实测一轮 64 枚只剩 6 枚),所以可追责的真相源是留痕 + 提交信息,不是台账行)。派单前先扫进行中项:`node scripts/check-task-claims.mjs`。**挂牌判据单源 = `scripts/lib/plan-task-index.mjs` 的 `claimMarkOf`**(2026-10-22 收三口径漂移:① 复选框后可带空白、② 带 `@日期/持有者` 的完整租约形写在行尾也算、③ 反引号码段内的裸标记属叙述不算;两把尺子曾各自读出 31 与 59,差值同时是"真牌隐身⇒两席领同一张票"和"叙述锁死真票⇒派单面虚低"两个方向的失真)。

### 原 L386(204 字节)— 同题副本

- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么、要么带新鲜日期;三样皆无 = 无交代,提交链差值棘轮只拦本次带进来的(守门 130 F7/F8)。

### 原 L387(976 字节)— 同题副本

- **完成即删要有器物(2026-10-20 立,2026-10-21 补 H4)**:① 门 229(`check-plan-closed-stock.mjs`,blocking,stagedTriggers=PROJECT_PLAN.md):S1 拦「跨枚滞留」= 被审面某已勾登记行的**复合主键在父提交面也是已勾** ⇒ 红;刚翻勾那一枚不拦(守门 71 头注 (c) 要的 closed 配平凭据);S2 全量档只报数。② 兜底清扫器 `strip-stale-closed-rows.mjs`(判据 import 门 229)走 `object-space-land` 摘滞留行并自带推送腿;H1 未勾行逐字节同序 / H2 行数差==清扫数 / H3 摘后滞留集==本轮跳过集(基线 HEAD^)/ H4 摘前先借门 71 的 historyMarkers+missingFrom 问"摘了会不会被按未勾还原",仍保护的一律跳过并点名;结论 `SWEEP-RESULT state=clean|stripped|all-held|refused|undetermined`,all-held 落 exit 3;`--apply` 由 guardian 每 **5 分钟**派发(2026-10-23 由 30 分钟下调,理由见下条),单批 ≤400 条;应急 `HUSKY_SKIP_PLAN_CLOSED_STOCK=1` + `..._REASON`。

### 原 L388(1557 字节)— 族内副本(整族摘除)

- **护栏③ 收窄(2026-10-23 立,治"让路变永久停摆")**:`strip-stale-claim-marks`(超龄认领牌代摘器)原护栏判「`git status --porcelain` 对台账非净 ⇒ 整批让路」。本仓多会话共写活文档、工作树副本**常年不净**,于是护栏天天触发、器物天天让路:留痕最后一条停在 2026-10-22 07:45,而派发节流台账显示此后每 30 分钟仍在跑,45 枚超龄牌一枚未摘。之所以"脏"本来就不构成让路条件:取材面是 `git show HEAD:PROJECT_PLAN.md`、落地走 `object-space-land`(blob 档 + CAS + 行级复活守卫,旧形态行逐字进 `LAND_CLASH_SCOPE.removed`)、工作树滞后带来的回潮由 `scrub-declared-removals` 与 `union-converge` 的 `declaredDropCaps` 两条通道兜 —— **脏的是别人的副本,不是判据面**。收窄后:只在本批旧形态行**被别席就地改写**时让路,且**只让路那几枚、其余照摘**(实测 45 枚里 4 枚在飞 ⇒ 摘 41、让路 4;原护栏会把 41 枚一起按住);让路行走 `planSweep` 的 `skipLines` 移入 held(不新写第二份判据),结论行补 `deferred=` 报数。工作树副本读不到 ⇒ 仍让路(未判定不猜)。派发节流同步 30min → **5min**(无滞留即零落地)。接线锁见 `scripts/tests/strip-stale-claim-marks.test.mjs`(护栏③ 三条 + 原 `planFaceClean` 已退役的形状锁)。**2026-10-23 实测**:待摘 45 → 4(剩的正是被别席改写那几枚),摘后借门 71 同一把尺子问"会不会被按未勾还原"点名 **0 ⇒ 0**,该族不会被回捞。

### 原 L389(2220 字节)— 族内副本(整族摘除)

- **「摘了又回来」已根治(2026-10-23 立,机主令"彻底根治 杜绝 以绝后患")**:此前清扫器摘得掉、存量却永远归不了零(实测 03:04 清扫一轮、03:27 已勾行仍 40 条),根因是这套器物**只造了一半**——清扫器 `strip-stale-closed-rows.mjs` 摘完落地却**一行留痕都不写**,于是两条回潮防线同时瞎:`scrub-declared-removals` 的 `declaredRows` 认不出这批行(它只认台账里的整行原文)、`union-converge` 的活文档行 union 只认"对侧相对基底新增" ⇒ 对侧旧基线里那份被当成别人的独有行原样补回 ⇒ 摘一次、回一次。三条补齐:① **留痕**——清扫器落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`(字段 at/seat/file/kind=stale-closed-sweep/commit/baseline),与 `strip-stale-claim-marks` 的 `stale-claim-strip.jsonl` 对等;**凭据是"HEAD 有没有被推进",不是落地器退出码**(实测 CAS 成功推进 HEAD 而落地器因回读未判定返 exit 2,按退出码跳过留痕就成"无凭据摘除");留痕必须排在落地成功之后,先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行。② **union 认台账**——`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 那一维(判据 import `scrub-declared-removals` 的 `declaredRows`,§0.6 单一真相源):台账命中 ∧ **本侧 0 份** ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣(扣了是丢本侧自己的行);台账取不到 ⇒ 一条不扣(失效方向恒为多留一份)。产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,故只在这一处接,与 `yieldedIdCaps`(让号形态)合起来才堵满"本侧处置权已行使"这一整格。③ **节拍**——guardian 派发节流由 30 分钟下调到 **5 分钟**(`sweepStaleClosedRows` 的 `intervalMs`):30 分钟那档跟不上结清提交的速度(03:12/03:14/03:20/03:25 各一枚),而无滞留时清扫器零落地零推送,压到 5 分钟不会刷爆共享仓。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`(9 例:留痕逐字/空集不落盘/留痕必须在落地之后/union 三条判据/两处 import 不许被删)。

### 原 L390(612 字节)— 同题副本

- 计划/台账: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs` `check-agents-doc-size.mjs` `check-plan-id-pool.mjs` `check-plan-closed-stock.mjs` `check-plan-claims-vs-head.mjs` `check-live-doc-archive-reinflation.mjs`(门体已造、尚未纳入 runner 注册表) `check-task-claims.mjs` `check-plan-fields.mjs` `check-sweeper-liveness.mjs`(2026-10-23 立:清扫背离巡检只读探针——派发在动 ∧ 留痕静默 >2h ∧ 可清存量 >0 ⇒ 器物空转;不走提交链,派发层 = git-guardian 的 `auditSweeperLiveness`)

### 原 L391(141 字节)— 族内副本(整族摘除)

> 重复登记副本已归档：见 `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md`「常驻工具清单（重复登记副本之一）」。

### 原 L392(1329 字节)— 同题副本

- 常驻工具(不在 runner,勿当没装车): `watermark.mjs` `guardian-runner.mjs` `safe-commit.mjs` `git-guardian.mjs` `git-lock.mjs` `deploy-lock.mjs` `union-converge.mjs` `merge-live-doc.mjs` `live-doc-edit.mjs` `object-space-land.mjs` `gate-registry-insert.mjs` `plan-tasks.mjs` `plan-tasks-merge.mjs` `plan-pointer-purge.mjs` `plan-task-index.mjs` `plan-fields.mjs` `plan-field-line.mjs` `plan-row-conservation.mjs` `plan-fields-extract.mjs` `plan-line-age.mjs` `bypass-git.mjs` `face-reader.mjs` `code-mask.mjs` `scratch-dir.mjs` `key-dir.mjs` `secret-path.mjs` `seal-c-root-stray.mjs` `scrub-temp-fixtures.mjs` `c-disk-breakdown.mjs` `plan-union-merge.mjs` `run-evidence.mjs` `visible-window-probe.mjs` `install-console-window-hook.mjs` `audit-pane-store-addressing.mjs` `commit-gate-attribution.mjs` `plan-bypass-ledger-report.mjs` `alert-volume-report.mjs` `provenance-ledger.mjs` `module-context.mjs` `desktop-build.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `heal-worktree-tracked.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `msvc-env.mjs` `desktop-unsigned-config.mjs` `desktop-build-saas.mjs` `desktop-dev-saas.mjs` `gen-line-icons.mjs` `post-commit-hook.js` `release-desktop-local.mjs` `notify-deploy-failure.ts` `start-dev.ps1` `hook-run-hidden.vbs` `ensure-silent-tasks.mjs`

### 原 L393(1995 字节)— 同题副本

- **认领即租约**:开始任务在 `- [ ]` 后追加 `（进行中@YYYY-MM-DD/持有者短名）`,三要素齐备才算认领(裸 `（进行中）` 自 2026-10-22 定档起**新增即拦** = CL4,HEAD 已欠着的只报数;年龄 >72h 判红 = CL1;守门 109 四档同用 HEAD 存量棘轮,只拦本次带进来的);完成翻勾并摘牌;**提交链上的门绝不代摘任何人的认领**,而超龄牌由兜底器物 `scripts/strip-stale-claim-marks.mjs` 代摘(器物自带派发层 `sweepStaleClaimMarks`,2026-10-22 补建;判据 import 守门 109 的 `claimMarkOf`+`resolveTtlHours`,本层零复算;只摘「完整租约 ∧ 超龄」——正在干活的席位会续租,天然落在射程外;落地走 `object-space-land` 并把旧形态逐行写进 `removed` ⇒ 活文档行 union 不得再从对侧取回这一型;裸标记由器物**默认代摘**(依据不是口头状态,而是同批的 CL4:新增已在提交链被拦住,而器物只读 HEAD 面 ⇒ 别人刚写下还没提交的牌进不了射程),机主原话写进留痕条目的 `ruling` 字段(`IHUI_CLAIM_STRIP_LEGACY_RULING="<原话>"`),行内只留 `#seq` 指针(实测注记最长 52 字),原牌日期/持有者/超龄量/摘除前后整行/基线与落地枚 sha 逐条落仓外留痕 `.ihui-agent/state/stale-claim-strip.jsonl`(90 天窗口老化,被裁条数必报,取不到判未判定)—— 注记本身会被活文档归并洗掉(实测一轮 64 枚只剩 6 枚),所以可追责的真相源是留痕 + 提交信息,不是台账行)。派单前先扫进行中项:`node scripts/check-task-claims.mjs`。**挂牌判据单源 = `scripts/lib/plan-task-index.mjs` 的 `claimMarkOf`**(2026-10-22 收三口径漂移:① 复选框后可带空白、② 带 `@日期/持有者` 的完整租约形写在行尾也算、③ 反引号码段内的裸标记属叙述不算;两把尺子曾各自读出 31 与 59,差值同时是"真牌隐身⇒两席领同一张票"和"叙述锁死真票⇒派单面虚低"两个方向的失真)。

### 原 L394(214 字节)— 族内副本(整族摘除)

> 旧口径副本已归档：见 `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md`「完成即删要有器物（副本；其中 --apply 为旧值「每 30 分钟」，现行值见 AGENTS.md §1 同题条目）」。

### 原 L395(925 字节)— 同题副本

- **完成即删要有器物(2026-10-20 立,2026-10-21 补 H4)**:① 门 229(`check-plan-closed-stock.mjs`,blocking,stagedTriggers=PROJECT_PLAN.md):S1 拦「跨枚滞留」= 被审面某已勾登记行的**复合主键在父提交面也是已勾** ⇒ 红;刚翻勾那一枚不拦(守门 71 头注 (c) 要的 closed 配平凭据);S2 全量档只报数。② 兜底清扫器 `strip-stale-closed-rows.mjs`(判据 import 门 229)走 `object-space-land` 摘滞留行并自带推送腿;H1 未勾行逐字节同序 / H2 行数差==清扫数 / H3 摘后滞留集==本轮跳过集(基线 HEAD^)/ H4 摘前先借门 71 的 historyMarkers+missingFrom 问"摘了会不会被按未勾还原",仍保护的一律跳过并点名;结论 `SWEEP-RESULT state=clean|stripped|all-held|refused|undetermined`,all-held 落 exit 3;`--apply` 由 guardian 每 30 分钟派发,单批 ≤400 条;应急 `HUSKY_SKIP_PLAN_CLOSED_STOCK=1` + `..._REASON`。

### 原 L396(330 字节)— 同题副本

- **worktree/索引自愈**(`heal-worktree-tracked.mjs`,挂 guardian tick):①恢复被外部删除的跟踪文件(索引==HEAD ∧ HEAD 存在);②对齐幻影漂移(索引==HEAD ∧ 工作区==某祖先版本);③刷新落后索引(逐路径 update-index,绝不全局 reset);**MERGE_HEAD 在 ⇒ 各写索引层整轮让路**。

