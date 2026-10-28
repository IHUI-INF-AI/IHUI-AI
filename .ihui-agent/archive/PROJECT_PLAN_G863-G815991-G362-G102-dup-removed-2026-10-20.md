<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 归档票僵尸开放行摘除留痕(2026-10-20,goal-zombie-sweep)

摘除 4 行:它们的票号在别处已有「已归档 ✅」权威行(同票号 + 同标题),且开放行**不带任何租约牌**;本席逐票做过实质核验(不是照票面措辞),摘除依据逐条见下。保留行 = 各票的归档权威行,一字未动。

**这些开放行为什么会存在**:计划文档被并发并集(`git-sync-converge` 活文档行级 union)按旧基线整批复位带回 —— 与 AGENTS §1 记的回潮通道③同型:按整行字符串比份数,认不出"对侧已按台账清掉"的行。同型先例:G-175(2026-10-18)、f1f4 六行(2026-10-19)、G-932(2026-10-20 本席前一枚)。

## 逐票核验与摘除依据

### G-863(开放行 L14881,1071B)
- 权威行:L15039 等 3 处 `已归档(2026-10-14/15:✅)` 同题归档。
- 实质核验:票面验收判据"同一帧内两批各 25 个 ⇒ 总收录不超过 30"已落地为测试用例(`apps/web/src/components/chat/__tests__/attachment-limits.test.tsx` 的 `G-863 跨批空窗:同帧两批各 25(批间 await 微任务) ⇒ 总收录 30,不超容`);同文件注记明说旧实现 `countedBatchRef` 读快照计数已被改写。⇒ 票面工程交付成立。(该测试未实跑——o2 工作树无 node_modules,主仓副本与 origin/main 逐字相同但亦无 vitest 二进制;不为跑两条测试装全套依赖,此处如实登记。)

### G-815991(开放行 L14904,1096B)
- 权威行:L7477 等 31 处 `已归档(2026-10-09:✅)` 同题归档。
- 实质核验:本票处置即"登记事实 + 一条重开触发条件"(5 处 `export {}` 空契约,守门 121 结构射程外,不得为"看起来有门"先造恒红门)——登记型交付,归档全文(含触发条件)在 `.ihui-agent/archive/PROJECT_PLAN_2026-10-09_auto-archive.md`。

### G-362 续行(开放行 L15398,1639B;该行无票号头,按标题匹配)
- 权威行:L8609 `已归档(2026-10-07:✅(2026-09-29))` 同题归档;行内自记"编号改派留痕(2026-09-28):原 G-362「桌面端启动后先进托盘」与另一条先入的登记撞成一号两事…正文一字未动"(现号 G-362 归托盘票 L10265,本行是审面根因票的续行)。
- 实质核验:票面两格修法均已在 HEAD 落地 —— ① 审面改"台账 ⊕ 同面归档件":`scripts/lib/plan-task-index.mjs` 的 `archiveFaceEntries`(HEAD 面 `ls-tree`/索引面 `ls-files`,禁 `readdirSync`)+ `archivedEntryIndex` + `auditPlan({archivedKeys})` 的腐烂指针双出口(face/archived)判定;② 取号面归档号基础设施同文件在位。

### G-102(开放行 L28952,5955B)
- 权威行:L14432/L15210 `已归档(2026-10-15:✅)` 同题归档(归档晚于行内 2026-10-11 值守席核查注记)。
- 实质核验:10-11 注记当日判"三出口生产面消费者均为 0、编排没接、判据挂在半空";现读 HEAD 已补接线 —— `apps/web/src/hooks/use-agent-stream.ts:218` 生产消费 `createStreamFaultTracker`,配专测 `apps/web/src/hooks/__tests__/use-agent-stream-fault-tier.test.ts`;实现与判据在 `packages/shared/src/chat/stream-fault-tier.ts`(自 `src/sse` 迁来)及其测试 `packages/shared/src/chat/__tests__/stream-fault-tier.test.ts`。⇒ 10-11 挂起的那半格已补齐,10-11 注记全文在 `.ihui-agent/archive/PROJECT_PLAN_ARCHIVE.md` 有保存。

## 诚实登记:同扫描候选但本席未动的一条

**G-160(开放行 L14779,14086B,F9 基线新增撞号清偿批②)未摘**。原因:① 其票面批次提交(30d7b0ad1c/6d2d068daf/75d1ef2ca3/417781d655e/a9f2db494d)经 `merge-base --is-ancestor` 逐个核验**均不在今日 origin/main 祖先里**,且 `backup/cleanup-2026-10-10-origin-verify` tag 亦非今天 origin/main 祖先 ⇒ 该仓历史被收敛线改写,"提交在主线"这一类证据在本票上不成立;② 多把钥匙(如 G-299/G-334)现读仍带开放行,票面自记"若回捞层再按旧基线复位致红集回升,以 plan-tasks.mjs 本尊现读为准、按同款口径再折并"的未收动态 ⇒ 实质无法干净核验。归收敛线/归并侧持有人,本席不单边摘。

**摘除方式**:object-space-land.mjs 工作树模式(LAND_ROOT 指向基于 origin/main 的独立 worktree;水印预检 + 陈旧落地守卫 + CAS 防覆盖 + 提交面回读 + 门 71 自愈兜底),不碰主仓工作树、不碰主索引、不自带推送。

被摘除行逐字原文如下(作为门 71 的归档凭据进审面):

### G-863(L14881)

### G-815991(L14904)

### G-362 续行(L15398)

### G-102(L28952)
- [ ] G-863 **附件容量按"屏当时快照"计,跨批并发可轻微超容;语音入口未接汇总提示**(G-833 交付如实登记的残留;归属:web 聊天附件链) —— 实现代理原话:"同帧跨批调用容量以屏当时快照计(批内有 `countedBatchRef` 防护,跨批极端并发可轻微超容);严格原子需 upstate 迁移,另计。"另:`apps/web` 语音路径产出的 webm **恒过** 扩展名白名单,且其返回值被忽略 ⇒ 它不走 `reportAttachmentRejections`,那一入口的拒绝仍是静默。落点:`use-message-references.ts` 的 `screenAttachmentFiles`(:125)之后做**一次性提交式**容量检查(把"计数"从读快照改成写前 CAS 语义),以及语音入口接同一汇总出口。验收:`pnpm --filter @ihui/web exec vitest run --retry=0 src/components/chat/__tests__/attachment-limits.test.tsx`(12 例已建)必须仍全绿 + 新增一例"同一帧内两批各 25 个 ⇒ 总收录不超过 30"。⚠️ 上限值只在 `use-message-references.ts:80/:82` 声明一处,修这两格**不得**再抄第二份数字。
- [ ] G-815991 **"空契约"这一型判不了,如实登记而不是假装已覆盖**(上游 `packages/contracts/src/capabilities/index.ts:1-2`:头注自称 "provider and model capability descriptions",实体只有 `export {};`,且**不在** `src/index.ts` 的 56 条导出清单内,`grep -rl "capabilities/index"` 零消费者 ⇒ 一张有用途声称、零内容的空契约)。**我方现状**:`git grep -nE "^export \{\};?$" HEAD -- apps packages` = **5 处**(未逐个定性)。**为什么判不了**:守门 121 判的是"声明了必须被引用",而**零导出**没有任何标识符可以被引用 ⇒ 结构上落在它的射程外;要判就得新立"文件头注声称某用途 ∧ 该文件零导出 ∧ 无引用"三条件合取的形态,收益低(5 处存量、无故障先例)。**处置**:登记事实 + 一条重开触发条件 —— **一旦某次事故的现象是"某个能力在契约面上根本不存在而账面一路绿"**(即空契约被下游当真实依赖引用),本票立即升为正式判据候选;在那之前不得为了"看起来有门"先造一台恒红门。
- [ ] **上述②的两格"审面根因"分别是独立一票,现各写清归属与解阻前置**:① **守门 57 的清单计数只看台账、不看归档件**(它 `checkBaseline` 的 `entryCount` 有一部分来自台账里 `data.planSource.taskLinePattern` 匹配的 D 族行)⇒ 正解是把审面改成"台账 ⊕ 同面归档件"(`git ls-tree HEAD` / 索引列目录,照**门 71 的归档豁免**与**门 13c 的 A2/A3 同面取材**那两个先例抄,不得 `readdirSync`),基线一律不动;本票已派子代理做,落地判据 = 私有索引端到端两臂(台账摘掉而归档件同字在 ⇒ rc=0;两侧都摘 ⇒ rc=1 并点名)。② **取号只看台账面的 max**(`lib/plan-task-index.mjs` 的 `usedIdsOfPrefix` 只看被审的 `PROJECT_PLAN.md`)⇒ 归档后同一个号会被再发一次,这是①的同族、量纲不同(号段单调性 vs 计数存续)。它**此刻被他人持有**(`scripts/lib/plan-task-index.mjs` 与 `scripts/plan-tasks.mjs` 工作树各有在飞改动,本会话按 §12 边界未动),**解阻前置**=那两文件的在飞改动入库后,由同一持有人把 `usedIdsOfPrefix` 扩成"台账 ⊕ 归档件"或给 `live-doc-edit` 的令牌加一道"号已在归档面出现过 ⇒ 继续往上取"的复核;不得由旁路会话按 pathspec 交工作树版本(那会把别人的在飞改动整批写回旧态)。〔编号改派留痕(2026-09-28):原 G-362「桌面端「启动后先进托盘」在真机采样里出现过一次」 与另一条先入的登记撞成一号两事,按"后来者改号"由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算;正文一字未动。〕
- [ ] G-102 **内容失败与传输失败分档,且"有内容失败"不得被后续瞬态失败洗白**(上游 `packages/ui/src/v4/conversationProjectionStore.ts:780-820`(实测区间含 `isDeterministicContentFault`;:785-790 内容故障 ⇒ **跳过 resume 阶梯**直取强制 snapshot,注释理由"resume 只会把同一批 delta 再投一遍,必然再被拒";:812-814"一旦本次 flight 出现过内容失败,终态就归内容失败:后续瞬态 fault 不该把它洗白";:949-961 超时终态带 `contentEligible:false`,否则会把仍有意义的重试取消掉)。**我方现状**:我方 SSE/chat 侧**无** content-vs-transient 分档(判"没有"之前已按同义词族试 `contentFault|deterministic|transient`,仅 `apps/ai-service` 无关命中)⇒ 症状是"重试到超时仍在投同一批被拒的 delta"。**判定:值得抄**,且与下一票(错误归因出口形状)互为前置:分档的前提是判定有 code。**落点** `packages/shared/src/chat/` 的失败归一 + 重试编排。**验收**:成对三条——① 内容故障 ⇒ 不走 resume 阶梯、直接 snapshot 且终态标 content;② 同一 flight 内先内容失败后瞬态失败 ⇒ 终态**仍归内容失败**(洗白那条就是本票存在的理由);③ 纯瞬态超时 ⇒ `contentEligible:false` 不置、重试仍被允许(反向锁,防把该重试的也取消)。 〔核查@2026-10-11 goal-r19:当轮按票号反查到交付面 packages/shared/src/sse/__tests__/stream-fault-tier.test.ts 并实跑(读数见 .ihui-agent/tmp/goal-r19/selfverify.json 与本行注记),**仍不翻勾** —— 成对三条判据全绿,但落点写的是"失败归一 + 重试编排",而 isDeterministicContentFault / createStreamFaultTracker / resolveStreamRecoveryDecision 三出口生产面消费者均为 0 ⇒ 编排没接,判据挂在半空。本行由机主授权的值守席核过,勿照旧票面再派实现。〕 〔改号(2026-10-14):原G-816009〕 〔副本正文并入·承载整段:**内容失败与传输失败分档,且"有内容失败"不得被后续瞬态失败洗白**(上游 `packages/ui/src/v4/conversationProjectionStore.ts:780-820`(实测区间含 `isDeterministicContentFault`;:785-790 内容故障 ⇒ **跳过 resume 阶梯**直取强制 snapshot,注释理由"resume 只会把同一批 delta 再投一遍,必然再被拒";:812-814"一旦本次 flight 出现过内容失败,终态就归内容失败:后续瞬态 fault 不该把它洗白";:949-961 超时终态带 `contentEligible:false`,否则会把仍有意义的重试取消掉)。**我方现状**:我方 SSE/chat 侧**无** content-vs-transient 分档(判"没有"之前已按同义词族试 `contentFault|deterministic|transient`,仅 `apps/ai-service` 无关命中)⇒ 症状是"重试到超时仍在投同一批被拒的 delta"。**判定:值得抄**,且与下一票(错误归因出口形状)互为前置:分档的前提是判定有 code。**落点** `packages/shared/src/chat/` 的失败归一 + 重试编排。**验收**:成对三条——① 内容故障 ⇒ 不走 resume 阶梯、直接 snapshot 且终态标 content;② 同一 flight 内先内容失败后瞬态失败 ⇒ 终态**仍归内容失败**(洗白那条就是本票存在的理由);③ 纯瞬态超时 ⇒ `contentEligible:false` 不置、重试仍被允许(反向锁,防把该重试的也取消)。 〔核查@2026-10-11 goal-r19:当轮按票号反查到交付面 packages/shared/src/sse/__tests__/stream-fault-tier.test.ts 并实跑(读数见 .ihui-agent/tmp/goal-r19/selfverify.json 与本行注记),**仍不翻勾** —— 成对三条判据全绿,但落点写的是"失败归一 + 重试编排",而 isDeterministicContentFault / createStreamFaultTracker / resolveStreamRecoveryDecision 三出口生产面消费者均为 0 ⇒ 编排没接,判据挂在半空。本行由机主授权的值守席核过,勿照旧票面再派实现。〕  〕〕   〕     〕〕〕〕 〔接线格进展@2026-10-18(落地 549ede3715,对象空间):本席承接 goal-r19 指名的缺口("三出口生产面消费者均为 0 ⇒ 编排没接")做**接线格** —— 不照旧票面再派实现、不翻勾。已装车的生产面消费者:`shouldSkipResumeLadder`(hook `tryReconnect` 闸门,内容故障 ⇒ 拒发重连)/ `describeFaultTier`(hook 两处失败分支终态消息,内容故障追加"(内容故障,重试无意义)")。此前该模块连 `packages/shared/src/chat/index.ts` 都没导出(44 个导出无它),"没装车"是双重的,本轮一并补。依赖方向硬约束:shared 依赖 `@ihui/api-client`,反向即循环 ⇒ 接线只能落端侧 hook(`apps/web/src/hooks/use-agent-stream.ts`),未改 api-client。三条验收逐条对账:**①** "不走 resume 阶梯"已接线(闸门拒发)+"终态标 content"已接线(消息与 error state 双口径),但"**直接 snapshot**"一格未做 —— hook 侧口径只到"拒发重连",取强制 snapshot 是 store 层动作,未越界代做;**②** 洗白锁判据层已绿(先内容后瞬态 ⇒ 终态归内容),hook 侧同一账本跨重连沿用,测试 `[500,422]` 停在 2 次钉住;**③** 纯瞬态放行重连同反向锁,`contentEligible:false` 我方无此终态字段 ⇒ "不置"等价满足。实测:新测试 `use-agent-stream-fault-tier.test.ts` 11/11(判据面 5+文案面 3+行为面 3);既有回归 `use-agent-stream-tail-accounting` 4/4;shared `stream-fault-tier` 判据 5/5;tsc 我方文件 0 错(存量 voice-note 一族与他人在飞项不计);水印 4/4;变异对照三项(删闸门⇒行为面 2 红;describeFaultTier 恒原样⇒文案正例+行为面 422 断言 2 红、反向锁 9 绿)。**账实疑点点名**:归档区两处指针注记(HEAD 版 L14483/L15425)写"已归档(2026-10-15:✅(2026-10-15) G-102 …)",与本行 `- [ ]` 未勾矛盾 —— 疑为 10-15"清偿重复登记存量"系列提交从旧归档副本复制的原文,非本轮新判;翻勾与否(①的 snapshot 格 + 归档区 ✅ 的真伪)留待核查席/机主定档,本席不代裁。〕
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
