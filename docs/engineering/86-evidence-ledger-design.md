<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 86 · 证据级可追溯执行流水 — 表设计与保留方案

> 台账号 86（PROJECT_PLAN.md 持有行 L8598 附近，拍板注记 2026-10-07）。
> 票面：每次工具调用带 invocation id + 输入/输出哈希 + 权限决策 + 操作者身份，导出签名 ledger。
> 2026-09-27 机主拍板：**做，落库并可导出**；2026-10-07 机主拍板保留策略：**落库保留 180 天，
> 仅机主可导出/删除，agent 无删权；先出表设计与保留方案而非写迁移** —— 本文档就是那"第一步"。
> 本文只做设计与现状登记，不写迁移、不改任何门。

## 1. 现状总览（86 家族子票 ↔ 代码落点）

| 子票 | 内容 | 状态 | 代码锚点 |
| --- | --- | --- | --- |
| 86A | tool ledger 写入器（invocation id/哈希/权限决策/操作者身份） | 已落地 | `apps/api/src/services/audit-log-service.ts` |
| 86A2 | HTTP 摄入路由 | 已落地 | `apps/api/src/routes/` audit 摄入面 |
| 86B | 入参摘要（tool-args digest） | **未落地（缺口，见 §6）** | — |
| 86C | 导出信封非对称签名 | 已落地 | `apps/api/src/services/siem-exporter.ts`（`buildSignedAuditExport`/`verifySignedAuditExport`，`AUDIT_EXPORT_SIGNATURE_ALGORITHM='RSA-SHA256'`） |
| 86D | 保留任务 + 墓碑重链 | 已落地 | `apps/api/src/jobs/audit-evidence-retention.ts` |
| 86F | 链锚（完整性报告） | 已落地 | `auditEvidenceIntegrityReport`（纯函数） |
| 86G-1 | 导出公钥面（匿名可交审计方） | 已落地 | `apps/api/src/routes/audit-evidence-export.ts` + `audit-export-key-registry.ts` |
| 86G-2 | 保留天数单一真相源 | 已落地 | `apps/api/src/services/audit-export-key-registry.ts:107` `AUDIT_ENVELOPE_RETENTION_DAYS_DEFAULT = 180` |

## 2. 表设计（已入库：`packages/database/src/schema/audit-chain.ts`）

`audit_logs_chain` —— 独立于现有 `audit_logs` 表的**链式**审计证据表：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid PK | 行标识 |
| `timestamp` | timestamptz NOT NULL | 事件时间 |
| `user_id` | uuid FK→users **ON DELETE SET NULL** | 操作者；用户被删时记录保留、归属置空（审计不随用户消失） |
| `action` | varchar(64) NOT NULL | 动作名 |
| `resource_type` / `resource_id` | varchar(64) | 资源面 |
| `ip` / `user_agent` | varchar(64)/(512) | 来源面 |
| `result` | varchar(32) | 结果档 |
| `metadata` | jsonb DEFAULT {} | 证据载荷（见 §4 两层保留） |
| `prev_hash` | char(64) NOT NULL | 上一行 `current_hash`（创世行除外） |
| `current_hash` | char(64) NOT NULL | 本行哈希 |

索引：`idx_audit_chain_ts`（timestamp）/ `idx_audit_chain_user`（user_id）/ `idx_audit_chain_act`（action）。

**哈希语义**：`current_hash = HMAC-SHA256(链密钥, 规范化输入集)`，输入集**包含 `metadata` 在内**的行内全部证据字段。
推论：① 事后改动任何字段（含 metadata）都会使本行 `current_hash` 对不上 ⇒ 断链可检测；
② 物理删除任意中间行会使后继行的 `prev_hash` 悬空 ⇒ 同样可检测。
链密钥属服务端密钥面，与导出签名密钥（86C/86G-1 的 registry）分置，不入库、不进导出体。

## 3. 保留方案（拍板：180 天 / 仅机主可导出删除 / agent 无删权）

**两层保留结构**（`jobs/audit-evidence-retention.ts` `resolveAuditEvidencePolicy`，env 口径照抄 `pii-retention-cleanup.ts`）：

1. **原文证据层（raw）**：`RAW_EVIDENCE_METADATA_FIELDS = ['body','params','query']` —— 请求/工具调用的原文级字段。
   `AUDIT_EVIDENCE_RAW_RETENTION_DAYS` 默认 **0** ⇒ 原文默认不落库，与"入参摘要走 86B、落地前不落敏感原文"的隐私口径（`tool-approval-audit.ts:18`）同一条禁令。
2. **结构信封层（envelope）**：证据结构行保留 **180 天**。
   单一真相源 = `audit-export-key-registry.ts:107` `AUDIT_ENVELOPE_RETENTION_DAYS_DEFAULT = 180`（注释明示"86D 拍板值"）；
   env 变量名 `AUDIT_EVIDENCE_STRUCT_RETENTION_DAYS` 由 registry 与保留作业**读同一个常量**（`ENVELOPE_RETENTION_ENV`）⇒ env 真值只有一份，硬编码 `180` 或另写变量名即红。

**删除语义 = 墓碑，无 DELETE**（86D，镜像测试钉住全文件零 `DELETE` 语句）：

- 到期行不物理删除，而是改写为**墓碑行**：`metadata.purge` 写入 `EvidencePurgeTombstone`，含擦除前锚点 `prevCurrentHash`（擦除前的 `current_hash`）；
- 链式关系保持连续：墓碑写入后**重算后继链**，读端重放永远绿；
- **可分辨性**（本票立论）：被合规删除（带墓碑、有前锚点、有策略依据）与被人篡改删行（链断）在读端完全可分辨；
- 安全阀：apply 档需 `AUDIT_EVIDENCE_RETENTION_APPLY=true`（默认 dry-run，先核对数字再开闸）；
  规模闸 `AUDIT_EVIDENCE_MAX_PURGE` 默认 **200**，到期候选超过即**整轮拒跑**（删除类操作红线，参照 check-watermark-coverage 先例）。

**agent 无删权**：唯一删除类通道是 86D 保留任务（服务端调度、apply 需显式 env 开闸、规模闸兜底）；
agent 运行时上下文没有任何路径触达该任务；导出面（§5）requireAdmin 守卫，agent 同样不可达。

## 4. 导出与签名（86C / 86G-1）

- 导出格式：CEF / LEEF / JSON（`siem-exporter.ts` `formatLog`），流式出口 `streamExport`/`streamExportRows`；
- 签名信封：`buildSignedAuditExport` / `verifySignedAuditExport`，算法 `RSA-SHA256`（`AUDIT_EXPORT_SIGNATURE_ALGORITHM`）；
- 密钥面：`audit-export-key-registry.ts` —— `AUDIT_EXPORT_SIGN_PUBLIC_KEY` / `AUDIT_EXPORT_SIGN_PUBLIC_KEY_PATH` / `AUDIT_EXPORT_SIGN_KEY_ID`，registry 条目带 `active/retired/bootstrap` 状态与轮换期判定（含 `R5_ENTRY_PAST_RETENTION` 等判据位）；
- 路由守卫：`audit-evidence-export.ts` 现为 `requireAdmin`；公钥的匿名可交付面是刻意设计——
  网络分段 `network.allowExternal:false` 使 admin 前缀下的公钥到不了外部审计方，把公钥交给审计方走线下通道。

## 5. 与拍板的差值登记（如实，不宣称已满足）

| 拍板 | 现状 | 差值 |
| --- | --- | --- |
| 落库保留 180 天 | envelope 180 天单源已落地（§3） | **无差值** |
| 仅机主可导出 | 导出面 `requireAdmin`（roleId≥1） | **未收紧到"机主个体"**。后续项：导出入口加机主身份断言（owner 用户/角色）后再宣称"仅机主"；在落地前，本票的"仅机主可导出"一格按"差值已登记、未关闭"如实挂账 |
| 仅机主可删除 | 无 DELETE；删除=86D 墓碑（服务端调度） | 机主个体触发的手动清理入口未建；同上挂账 |
| agent 无删权 | agent 上下文无删除路径；导出面 requireAdmin | **已满足**（结构性：无通道即无权限） |

## 6. 86B 缺口登记（入参摘要）

- `audit-log-service.ts:267` 自述：跨流辨认靠 fingerprint 指纹；**入参摘要的唯一出口在 86B 建设，落地前**（现状即无摘要）；
- 隐私红线（`tool-approval-audit.ts:18`）：与 86B 同一条禁令 —— 敏感入参**不得全文入链**，只落摘要/哈希；
- 86B 落地时的验收判据（预登记）：摘要函数单向（哈希或定长截断）、原文不落 `metadata`、跨流 fingerprint 与摘要并存不互替。

## 7. 演进顺序（本票交付物 = 本文档；迁移与代码不在本轮）

已落地：86A / 86A2 / 86C / 86D / 86F / 86G-1 / 86G-2（§1）。
后续登记项（各有归属，不在本票范围内执行）：① 86B 入参摘要（§6）；② 导出/删除面"仅机主"收紧（§5）；③ 86D 首次真实超期数据演练（默认 dry-run，待生产有真到期行时按规模闸流程开闸）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
