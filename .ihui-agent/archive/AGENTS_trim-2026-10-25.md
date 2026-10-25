<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md trim 2026-10-25 — 速查区「计划/台账」「API/后端/DB」旧副本整行逐字留档(新版 L405/L406 为唯一面;本批未删任何唯一来源行)

- 计划/台账: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs` `check-agents-doc-size.mjs` `check-plan-id-pool.mjs` `check-plan-closed-stock.mjs` `check-plan-claims-vs-head.mjs` `check-live-doc-archive-reinflation.mjs`(门体已造、尚未纳入 runner 注册表) `check-task-claims.mjs` `check-plan-fields.mjs` `check-sweeper-liveness.mjs`(2026-10-23 立:清扫背离巡检只读探针——派发在动 ∧ 留痕静默 >2h ∧ 可清存量 >0 ⇒ 器物空转;不走提交链,派发层 = git-guardian 的 `auditSweeperLiveness`)
- API/后端/DB: `check-credential-leak-in-message.mjs` `check-egress-ip-drift.mjs` `check-credential-presence-bypass.mjs` `check-principal-consumed.mjs` `check-public-exposure-list.mjs` `check-capability-field-not-client-supplied.mjs` `check-authorization-column-isolation.mjs` `check-migration-immutable.mjs` `check-db-blind-updatedat-set.mjs` `check-sequence-lag.mjs` `check-error-code-not-text-matching.mjs` `check-error-attribution-single-source.mjs` `check-error-message-bounded.mjs` `check-inbound-schema-strict.mjs` `check-nested-additional-properties.mjs` `check-enum-default-widening.mjs` `check-enum-fallback-terminal.mjs` `check-txn-cancel-boundary.mjs` `check-dockerfile-copy-paths.mjs` `check-edu-arrears-single-source.mjs` `check-sse-frame-watermark.mjs` `check-python-import-landed.mjs` `check-python-import-resolvable.mjs` `check-mode-permission-matrix.mjs` `check-subagent-permission-inherited.mjs` `check-csrf-exemption-shape.mjs` `check-batch-write-count-honesty.mjs` `check-prod-bundle-shadow.mjs` `check-env-drift.mjs`
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
## 24. 新增功能须用户确认强制规则(强制)


触发 = 引入 PROJECT_PLAN 清单之外的新能力。强制动作:暂停 → `AskUserQuestion` 确认(目标/范围/是否入 PLAN 及优先级)→ 显式同意后才开发 → 补登记 PLAN → `feat:` 前缀。红线:禁止未确认直接开发、禁止伪装成修复绕过、禁止"写完了你看下要不要"代替事前确认。豁免:用户本轮明确要求、goal 目标内含、纯修复/重构/测试/文档、PLAN 已有条目细化。


## git-guardian.mjs 压缩前注释原文(2026-10-25,门 103 C1 超行清偿)
    // ⚠ 2026-10-04 复核改判:本条原先登记为 auto 且理由写「派发时已带 --apply」——
    //   **与代码事实相反**。全文件 `union-converge` 零处 execFileSync/spawnSync 派发,
    //   auditMergeAdditionLoss(:1717)只派 `[script, '--all-new']`,而 :1539 的设计注释
    //   白纸黑字写着「**只判不修**:自动重做合并的风险远大于收益;出口是
    //   `scripts/union-converge.mjs --apply`(**人来点**)」⇒ 该格真实形态是「只喊人 + 人来点」。
    //   这次错判能溜过,是因为台账的测试只校验**已登记项的形状**,不与代码对账
    //   (见 test 里 why 的正则:写得"对"而"错"的文案完全合规)。已同时补上对账测试。

## git-guardian.mjs 压缩前注释原文(2026-10-25,门 103 C1 超行清偿)
        // 2026-10-04 复核补:原写 `{ alertName: … }`,而 notifyGuardRed 的 opts 解构里
        // **没有 alertName 这个键**(见其签名:severity/now/dispatch/stateFile/undFile/
        // windowMs/failCooldownMs/dedupKey/force/logger)⇒ 该值被**静默丢弃**,这一格
        // 实际只吃了默认的内容指纹去重。症状:同一个"服务 A 重启失败"与"服务 B 重启失败"
        // 归成同一身份,B 恢复了 A 还在失败时,B 的新事实被压成旧指纹不重报。
        // 改传 dedupKey(那才是真正被消费的字段),身份取"哪些服务"集合、有序无关。
        // 2026-10-04 复核补:原实现只在 `h.healed` 为真时写 healNote,于是**熔断/节流**
        // (decideAlignHeal 返回 healed:false,why=「自愈已用满 3/3 次 ⇒ 熔断,转人工」/
        //  「距上次自愈 N 分钟 < 节流 M 分钟」)这两档的 why 被整段丢弃 ——
        // 收信人看到的是一条「从没说有人试过」的告警,与本文件头注
        // 「收信人第一眼就要知道机器已经自己试过几次」**方向相反**。
        // 而熔断恰恰是**最该让人看见**的一档:它意味着"自动修已经停手,等人"。
        // 附带修掉一个静默区间:节流档(fails=1..2 时达不倒告警阈值)原先既不修也不喊,
        // 现在至少把"为什么这次没修"写进日志与正文,不再是一个无声的静默重试。
    // 21 封全部落在 4h 窗口之外一点(实测间隔 4.00~4.62h,均值 4.05h)⇒ 指纹其实**稳定**
    // (exit 码已被数字归一),这一格是"稳定指纹 × 零有效出口":出口那条命令本身不含
    // 任何创建备份的代码,重跑 = 同一段代码重跑同一个失败(2026-10-03 审计)。
    // 身份带上出口形态,便于将来判据换出口时能分辨"还是那个故障"vs "换了个出口"。
    // 身份带上**已持续档**(2026-10-17):这一格是"稳定指纹 × 零有效出口",原形态是每 4 小时
    // 平铺一封同样的话(实测 21 封,间隔均值 4.05h)——既不打扰到新人,也不告诉收信人"已经拖多久了"。
    // 带档之后:6h / 24h / 72h 各升级一次(跨档即新身份 ⇒ 立即到人),同档内由窗口压住。
    // 起点件在追平成功时清除,不会拿上一场故障的账续命。
  // 2026-10-04 复核补节流:本函数**每轮都跑**,而收敛对齐的自愈(healConvergeAlignStall →
  // git-sync-converge.mjs --align-only → heal-worktree-tracked.mjs --align-drift --json)
  // 在**同一轮 tick 里排在本函数之后**,两者写的是同一个索引、跑的是同一个脚本
  // (复核实测:本函数 :1324 与收敛器 :1391 派同一组参数)。
  // 无节流时:一轮跑两遍写索引动作 ⇒ 抢 index.lock + 白白多花一次 40–51 秒。
  // 判据用"对齐层跑过的窗口"而不是随便加个时间戳 —— 节流必须对齐真实动作面。
    // ⚠ 2026-10-04 复核改判:本条原先登记为 auto 且理由写「派发时已带 --apply」——
    //   **与代码事实相反**。全文件 `union-converge` 零处 execFileSync/spawnSync 派发,
    //   auditMergeAdditionLoss(:1717)只派 `[script, '--all-new']`,而 :1539 的设计注释
    //   白纸黑字写着「**只判不修**:自动重做合并的风险远大于收益;出口是
    //   `scripts/union-converge.mjs --apply`(**人来点**)」⇒ 该格真实形态是「只喊人 + 人来点」。
    //   这次错判能溜过,是因为台账的测试只校验**已登记项的形状**,不与代码对账
    //   (见 test 里 why 的正则:写得"对"而"错"的文案完全合规)。已同时补上对账测试。
// —— 自动修复的节流与熔断(2026-10-04 立,回应"要自动修复而不是等人提")——
//
// 立因是实测的一次真停摆:10-03 07:41 失败后 **24.8 小时零动作**,而这段代码
// 原本只负责"喊人"。更糟的是告警文案给的唯一出路在结构上解不掉它
// (`alignWorktreeAfterHeadMove` 只在真推进 HEAD 后才调 ⇒ 本地已同步时跑收敛是空转,
// 台账永不归零)。也就是**这一格既不自愈、给出的出路也不自愈**,只剩人在中间。
//
// 修法是把它接进本守护已有的自愈链(与 heal*/healRefs 同挂点、同分支),顺序固定为
// **先自己修 → 修不好才喊**,且两道护栏:
//   ① 节流 `ALIGN_HEAL_THROTTLE_MS`:对齐器本机实测 40–51 秒(真仓),本守护每 2 分钟一轮,
//      不节流会在一次长故障里反复派生对齐器,把"修"本身变成新的负载源。
//   ② 熔断 `ALIGN_HEAL_MAX_ATTEMPTS`:自愈本身失败也要有上限,否则就是每轮重试一次的
//      无限循环 —— 那与"只喊人"只是换了个更吵的形态。
// 两道都可用 env 调;设 ALIGN_HEAL_DISABLED=1 可整体关掉自愈(回到纯喊人),便于取证对照。
