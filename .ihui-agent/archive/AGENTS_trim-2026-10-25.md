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

