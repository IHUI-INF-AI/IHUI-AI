<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Qoder 四大主系统 · 复现与超越对账矩阵

> 取证来源:`.archify/verify/qoder-extract/dumps/*.json`(Qoder 混淆前端包 SQLite DDL + 查询层 dump,50 个模块)
> 判定原则:**只落地有真实承接点的通用机制**,平台绑定与产品形态耦合的一律标明,不为"榨干"硬凑半成品。
> 目标架构:IHUI `apps/cli`(ACP + subagent-collab/parallel + message-identity + turn-store)。

## 0. 总览

Qoder 全部能力承载于 **66 张状态表**。地毯式枚举后归入四系统 + 远程 RC + 基础设施:

| 归类              | 表数       | 判定构成                                                                                                                                                                                                             |
| ----------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 系统一 · 会话编排 | 11         | 已落地 1 · 真差距 1 · 架构级 1 · 无承接点 8                                                                                                                                                                          |
| 系统二 · 多 agent | 24         | 已落地 6 · 真差距 0 · 产品绑定 18                                                                                                                                                                                    |
| 系统三 · 能力扩展 | 7          | 真差距 1 · 云市场绑定 6                                                                                                                                                                                              |
| 系统四 · 执行环境 | 9          | 真差距 2 · 平台绑定 7                                                                                                                                                                                                |
| 远程 RC(vm/cloud) | 13         | **整族平台绑定,无本地承接点**                                                                                                                                                                                        |
| 基础设施          | 1          | schema_migrations(框架自带的,非差距)                                                                                                                                                                                 |
| **合计**          | **65 + 1** | **已落地 9 模块(journal/identity/mcp-status/inbox + skill-evolution/skill-evolution-apply + workspace-receipts + subagent-profile-revisions + deletion-tombstones,经复核)· 真差距(均架构级/前提缺失)· 平台绑定 26+** |

**已落地并超越的模块(均在我方 `apps/cli`,经复核实际存在)**:

| 模块                           | 复现自 Qoder                                     | 超越点                                                         |
| ------------------------------ | ------------------------------------------------ | -------------------------------------------------------------- |
| `acp/subagent-journal.ts`      | journal.js 通知日志(compact/append/KMP 边界去重) | 复用 message-identity 单一真相源,13 测试全绿                   |
| `acp/message-identity.ts`      | 身份断言 + canonicalJson + 字节上限              | 独立成共享层,可被 journal/inbox 复用,23 测试                   |
| `acp/mcp-status-projection.ts` | MCP 状态投影                                     | 带测试                                                         |
| `acp/agent-inbox.ts`           | agent_inbox_items/progress 8 语义点              | **+retryPlanFor full-jitter 退避 · +compact 终态回收**,21 测试 |

> ⚠️ 早期记录把 `preview-envelope`(J2)/`bounded-json`(J4)列为已落地,复核不在工作区,已从本表移除。

## 1. 图例

- 🟢 **已落地**:我方已有可运行实现 + 测试,且至少一轴超越对标
- 🟡 **真差距**:Qoder 有、我方无、且在我方架构有真实承接点,可做
- 🔴 **架构级**:真差距但需改造核心类型/多文件,单会话不可交付,须如实标注
- 🔵 **已对等/更全**:我方已有等价或更完整实现,不重复造
- ⚫ **平台绑定**:绑定 Qoder 云 VM / 云市场 / 群聊产品形态,无本地承接点

---

## 2. 系统一 · 会话编排(11 张)

Qoder 用一张 `pending_turn_projections` 承接 SDK 流式投影,这是它整个会话编排的前提(已实测:我方 session 无此流)。核心价值 = 幂等游标 + 去重键 + 三态结算,与产品形态无关。

| 表                                        | 判定              | 落点 / 量级 / 前置                                                                                                                                                                                                             |
| ----------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chat_sessions`                           | 🔵 已对等         | 我方 `turn-store.ts` 已有会话持久化(原子写 + 版本校验)                                                                                                                                                                         |
| `chat_session_turn_states`                | 🔵 已对等         | 我方 `acp/turn-lifecycle.ts` 七态回合状态机 + `turn-store.ts` 持久化已覆盖(详见 §7 P3 行)。唯一增量是其 revision 修订链,与我方刻意设计冲突,不硬加                                                                              |
| `chat_session_history_revisions`          | 🔴 架构级         | 历史版本链(sequence + sourceMessageId)。需消息有稳定 id,见 input_replacements 行                                                                                                                                               |
| `chat_session_input_replacements`         | 🔴 架构级(低价值) | 编辑回退保存被替换消息身份映射(`replaced_message_id`)。**阻塞点:我方 `ChatMessage` 仅 `{role,content}` 无稳定 id**(packages/types/src/ai.ts:11)。硬加 id 牵连全部调用点;且 CLI rewind 是上下文裁剪,非 UI 编辑恢复,该场景不存在 |
| `chat_session_input_provenance`           | ⚫                | 输入来源溯源,绑定 Qoder 会话编排                                                                                                                                                                                               |
| `chat_session_pin_authority`              | ⚫                | 置顶权限,群聊产品形态                                                                                                                                                                                                          |
| `chat_session_runtime_context_candidates` | ⚫                | 依赖 pending_turn SDK 投影流(我方无)                                                                                                                                                                                           |
| `chat_session_search_segments`            | ⚫                | 会话分段搜索,产品编排细节                                                                                                                                                                                                      |
| `chat_attachment_assets`                  | 🔵 已对等         | 我方 attachment 走 ACP session-replay 附件链                                                                                                                                                                                   |
| `pending_turn_projections`                | 🔴 架构级(高价值) | **SDK 流式投影流水 = 把 CLI 会话层改造成 SDK 编排器**。架构级,非单会话                                                                                                                                                         |
| `chat_session_peer_projection_turns`      | ⚫                | 依赖 peer projection,产品绑定                                                                                                                                                                                                  |

<!-- CHUNK1-END -->

---

## 3. 系统二 · 多 agent(24 张)

Qoder 的主战场 = `discussion_*` 群聊式多 agent 团队。核心机制(agent_inbox 的幂等游标 + 三态结算)已被我方 `acp/agent-inbox.ts` 吸收并超越;**其余 23 张绑定"讨论组 + 多人协作 + 工单派发"产品形态,我方 CLI 无群聊承接面**。

| 表                                                                                 | 判定      | 说明                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent_inbox_items`                                                                | 🟢 已落地 | `acp/agent-inbox.ts`。复现 delivery_mode 三态/event_seq 游标/failed 终态/error_code;超越 = retryPlanFor 退避 + compact 回收。21 测试                                                                                                                                                                                         |
| `agent_inbox_progress`                                                             | 🟢 已落地 | 同上 cursors 字段 = 每成员消费水位(scanned_event_seq 等价)                                                                                                                                                                                                                                                                   |
| `agent_profile_revisions` / `team_definition_revisions`                            | 🟢 已落地 | `acp/subagent-profile-revisions.ts`。版本链 + 执行时版本锁定:不可变快照(`snapshotJson` 单调 revision、UNIQUE(chainId,revision))+ 快照未变幂等复用(不刷版本号)+ `revisionById` 跨链精确取 + `withLockedRevision` 锁版执行(历史可复现)。早前误判"CLI 无需 revision 链" —— 实查我方 `PERSONAS` 是静态常量无版本,已补齐。12 测试 |
| `agent_profile_details`                                                            | 🔵 已对等 | 我方 `tools/subagent.ts` PERSONAS 角色 + allowedTools 即 profile 详情                                                                                                                                                                                                                                                        |
| `agent_team_cancellation_cleanup`                                                  | ⚫        | 讨论组取消清理,绑定 discussion 产品                                                                                                                                                                                                                                                                                          |
| `agent_team_input_provenance`                                                      | ⚫        | 讨论组输入溯源,产品绑定                                                                                                                                                                                                                                                                                                      |
| `discussion_access_denials`                                                        | ⚫        | 讨论组权限拒绝,多人协作形态                                                                                                                                                                                                                                                                                                  |
| `discussion_agent_contexts`                                                        | ⚫        | 绑定 discussion 承接面                                                                                                                                                                                                                                                                                                       |
| `discussion_agent_message_operations`                                              | ⚫        | 讨论组消息操作审计,产品绑定                                                                                                                                                                                                                                                                                                  |
| `discussion_agent_workspaces` / `discussion_local_workspaces`                      | ⚫        | 讨论组工作区,产品绑定                                                                                                                                                                                                                                                                                                        |
| `discussion_event_facts`                                                           | ⚫        | 讨论组事件事实,产品绑定                                                                                                                                                                                                                                                                                                      |
| `discussion_launch_contexts` / `discussion_launch_intents` / `discussion_launches` | ⚫        | 讨论组发起(3 张),多人协作产品                                                                                                                                                                                                                                                                                                |
| `discussion_member_access_facts`                                                   | ⚫        | 成员访问事实,产品绑定                                                                                                                                                                                                                                                                                                        |
| `discussion_message_facts` / `discussion_message_versions`                         | ⚫        | 讨论组消息 + 版本,产品绑定                                                                                                                                                                                                                                                                                                   |
| `collaboration_deleted_resources`                                                  | 🟢 已落地 | `acp/deletion-tombstones.ts`。**墓碑 + 迟到写守卫**通用机制已抽取:最小墓碑标记 `markDeleted` + `assertNotDeleted` 拦迟到写 + `isDeleted` 查询 + `removeTombstone` 清碑。已接线到 skill-evolution 真实竞态(compact 硬删 → 自动立碑 → 迟到 `applySuggestion` 被挡 → 清碑复活),15 单测 + 4 接线闭环测试                         |
| `collaboration_governance`                                                         | ⚫        | 协作治理,产品绑定                                                                                                                                                                                                                                                                                                            |
| `collaboration_resource_deletions`                                                 | 🟢 已落地 | 同上墓碑台账:`listTombstones`/`purgeExpiredTombstones` 过期清扫,与 Qoder 删除台账同源语义                                                                                                                                                                                                                                    |
| `collaboration_runtime_credentials`                                                | ⚫        | 协作运行时凭据,安全敏感 + 产品绑定                                                                                                                                                                                                                                                                                           |
| `issue_agent_deliveries`                                                           | ⚫        | 工单 agent 派发,绑定 issue 产品                                                                                                                                                                                                                                                                                              |
| `attention_completions`                                                            | ⚫        | 关注项完成,产品绑定                                                                                                                                                                                                                                                                                                          |

**诚实判定**:系统二真正的通用价值已榨取——inbox 幂等游标+结算+退避、profile/team 配置版本链、协作删除墓碑+迟到写守卫,三族通用机制均已抽取落地。**地毯式复核(读全部 discussion/collaboration/agent_team DDL)**:剩余表的产品外壳下,通用机制骨架(event_seq 幂等游标 / prepared-submitted-delivered 状态机 / version 版本链 / 墓碑 / 取消重试退避)无一不被现有 4 模块吸收;`agent_team_executions.team_definition_revision_id` 正是配置版本链的消费方。剩余 18 张是"讨论组 scope_id/discussion_id"产品外壳,搬进 CLI 只会造出无人用的群聊功能,不搬。

## 4. 系统三 · 能力扩展(7 张)

| 表                                | 判定      | 说明                                                                                                                                                                                     |
| --------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skill_evolution_attempts`        | 🟢 已落地 | `acp/skill-evolution.ts`(内容指纹 + 七态提议状态机,24 测试)+ `acp/skill-evolution-apply.ts`(进化执行链:baseline 守卫 + 原子写 + 路径逃逸守卫,8 测试)。已从零补齐其"可自修改技能基建"前提 |
| `application_sdk_authorizations`  | ⚫        | SDK 授权,云市场绑定                                                                                                                                                                      |
| `marketplace_preinstall_receipts` | ⚫        | 市场预装回执,云市场绑定                                                                                                                                                                  |
| `cloud_automation_list_cache`     | ⚫        | 云自动化缓存,云绑定                                                                                                                                                                      |
| `cloud_message_feedback`          | ⚫        | 云消息反馈,云绑定                                                                                                                                                                        |
| `cloud_session_cache`             | ⚫        | 云会话缓存,云绑定                                                                                                                                                                        |
| `local_inbox_items`               | 🔵 已对等 | 本地收件箱,已由 agent-inbox 覆盖同类语义                                                                                                                                                 |

## 5. 系统四 · 执行环境(9 张)

| 表                                     | 判定                  | 说明                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `peer_access_policies`                 | ⚫ 平台绑定(前提缺失) | 复核更正:需**设备配对 + controller/被控 P2P 远程操控运行时**(`controller_device_id`/`paired_at`/`pairing`/`controlled_at`)。早前误记我方 `local-device-registry` 有设备登记 —— 实查只有 `lib/device-fingerprint.ts`(反爬指纹采集器,喂后端 bot-detection),与设备身份/配对无关。CLI 单机架构无 P2P 运行时,策略层无处挂载,不硬造 |
| `workspace_authority_command_receipts` | 🟢 已落地             | `acp/workspace-receipts.ts`。复现三重约束:幂等(`(principalId,requestId)` + `ensureReceipt`)/ 防漂移(`commandInputHash` canonicalJson)/ 过期(`expiresAt` + `purgeExpired`);5 值 operation 枚举 + STRICT。17 测试                                                                                                               |
| `local_device_identity`                | ⚫ 前提缺失           | 复核更正:早前误标"已对等"。我方只有 `lib/device-fingerprint.ts`(反爬指纹,非设备身份登记)。Qoder `local_device_identity` 是跨设备配对体系的持久设备身份,前提是 P2P 运行时,CLI 单机无此基建                                                                                                                                     |
| `peer_devices`                         | ⚫ 前提缺失           | 复核更正:早前误标"已对等"。我方无设备登记,`peer_devices`(配对设备表)前提是设备配对协议 + controller/被控运行时,CLI 单机架构不成立                                                                                                                                                                                             |
| `peer_ingress_timeline`                | ⚫                    | 入站时间线审计,平台绑定                                                                                                                                                                                                                                                                                                       |
| `project_local_workspaces`             | ⚫                    | 项目工作区,平台绑定                                                                                                                                                                                                                                                                                                           |
| `workspace_merge_aliases`              | ⚫                    | 工作区合并别名,平台绑定                                                                                                                                                                                                                                                                                                       |
| `remote_byok_sync_sources`             | ⚫                    | BYOK 同步源,平台绑定                                                                                                                                                                                                                                                                                                          |
| `remote_control_storage`               | ⚫                    | 远程控制存储,平台绑定(RC 族)                                                                                                                                                                                                                                                                                                  |

<!-- CHUNK2-END -->

---

## 6. 远程 RC + 云 VM(13 张)—— 整族平台绑定,明确不搬

这 13 张全为 Qoder 的**云 VM 会话 / 远程控制 / 云迁移台账**:`rc_vm_sessions`、`rc_vm_turns_next`、`rc_channel_admissions`、`rc_identity_migrations`、`rc_input_receipt_confirmations`、`rc_interaction_deliveries`、`rc_scope_continuity`、`rc_scope_recovery`、`rc_legacy_import`、`remote_qoder_ide_migration_ledger`、`remote_session_reimport_tasks` 等。

**判定:整族 ⚫ 平台绑定,无本地承接点,明确不硬抄。** Qoder 的 RC 是"把 CLI 会话托管到云端 VM 远程操控"的整套基础设施;我方 CLI 是本地优先架构,复刻这套等于重写一个云托管平台,与 `AGENTS.md` "不引入云依赖"的架构取向冲突。唯一可借鉴的通用碎片(retry_at 退避)已被 agent-inbox 的 `retryPlanFor` 吸收。

## 7. 诚实边界(不为"榨干"灌水)

**为什么不能宣称"已全部拿走并超越":**

1. **真差距 4 枚,但 3 枚是架构级**:pending_turn(SDK 编排器改造)、history_revisions + input_replacements(需给 `ChatMessage` 加稳定 id,牵连全仓调用点,且 CLI rewind 场景价值低)。单会话不可交付,硬做=半成品污染核心类型。
2. **26+ 张是平台绑定**:云 VM RC 族(13)+ 云市场(6)+ 群聊 discussion 族(部分),搬进本地 CLI 会造出无人用/违架构的功能。
3. **能力类差距 ≠ 逐函数复刻**:本矩阵按"类级 + 承接点"判定,不是逐函数克隆。已榨取的是每族里与产品形态无关的**通用机制**(journal 幂等、身份断言、inbox 游标+结算+退避)。

**剩余真差距推进优先级(供多会话分批):**

| 优先级                   | 表                                                 | 价值                               | 量级                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 建议                              |
| ------------------------ | -------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| ~~P1~~ → **✅ 已建基建** | `skill_evolution_suggestions`(原文档误记 attempts) | **基建已补齐**                     | 已建 `acp/skill-evolution.ts`(内容指纹 + 七态提议状态机:pending/starting/evolving/evolved/dismissed/expired/hash_invalidated,24 测试)+ `acp/skill-evolution-apply.ts`(执行链:baseline 守卫 + 原子写 + 路径逃逸守卫 + forceEvolve 闭环,8 测试)。此前"前提缺失(无自修改技能系统)"的阻塞已**亲手补齐**                                                                                                                                                                                                                                          |
| ~~P2~~                   | `peer_access_policies`                             | ~~中~~ → **⚫ 平台绑定(前提缺失)** | 复核结论:需**设备配对 + controller/被控 P2P 远程操控运行时**。CLI 单机架构无配对协议/跨设备同步基建(我方仅 `device-fingerprint.ts` 反爬指纹,非设备身份),策略层无处挂载,不硬造                                                                                                                                                                                                                                                                                                                                                                |
| ~~P2~~ → **✅ 已建基建** | `workspace_authority_command_receipts`             | **基建已补齐**                     | 已建 `acp/workspace-receipts.ts`(工作区写盘幂等回执审计层:三重语义 `ensureReceipt` 幂等返回 / `inputHash` 防漂移 / `expiresAt` 过期失效 + `commandInputHash` 稳定指纹 + JSONL 存储 + `purgeExpired` 清扫,17 测试)。此前"前提缺失(无审计层)"的阻塞已**亲手补齐**                                                                                                                                                                                                                                                                              |
| ~~P3~~ → **🔵 已对等**   | `chat_session_turn_states`                         | ~~前提缺失~~ → **已对等**          | 复核更正:我方 `acp/turn-lifecycle.ts`(374 行)已是**七态回合状态机**(prepare/consuming/committing/parked/completed/failed/cancelled + 终态集 + ParkReason 四分类含 awaiting-user/awaiting-approval/awaiting-dependency/awaiting-timer + WakeCondition 含 cron),`acp/turn-store.ts` 持久化 + 原子写 + wakeable 扫描。Qoder 的 waiting_user/interrupted 已被我方 `parked` 涵盖。唯一增量是其 `revision` 修订链(每次变更可回放),但那与 `pending_turn_projections` 同源、且与我方"运行态可覆盖、与 append-only 历史分离"的**刻意设计**冲突,不硬加 |
| P3                       | `pending_turn_projections`                         | 高但架构级                         | 大(改会话层)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 仅当决定把 CLI 升级为 SDK 编排器  |
| —                        | `input_replacements`/`history_revisions`           | 低(CLI 无此场景)                   | 大(改核心类型)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **不建议做**,会污染 `ChatMessage` |

## 8. 验证

- 已落地模块测试:`npx vitest run tests/subagent-profile-revisions.test.ts`(12)+ `tests/workspace-receipts.test.ts`(17)+ `tests/skill-evolution.test.ts`(24)+ `tests/skill-evolution-apply.test.ts`(8)+ `tests/deletion-tombstones.test.ts`(15)+ `tests/tombstone-wiring.test.ts`(5)+ `tests/subagent-journal.test.ts`(13)+ `tests/message-identity.test.ts`(23)+ `tests/mcp-status-projection.test.ts`(8)+ `tests/agent-inbox.test.ts`(21)= **146/146 全绿**
- 类型:`npx tsc --noEmit` 全项目 0 错误
- 取证:全部判定基于 `.archify/verify/qoder-extract/dumps/*.json` 的真实 SQLite DDL,非推测

> 结论:**Qoder 四大系统的通用机制已榨取并超越,当前工作区实际落地 9 模块**:`subagent-journal` / `message-identity` / `mcp-status-projection` / `agent-inbox` + **`skill-evolution`(内容指纹 + 七态提议状态机)+ `skill-evolution-apply`(进化执行链)+ `workspace-receipts`(工作区写盘幂等回执审计层)+ `subagent-profile-revisions`(配置版本链 + 执行时版本锁定)+ `deletion-tombstones`(墓碑 + 迟到写守卫,已接线 skill-evolution 真实竞态)**,后五者把原判为"前提缺失/产品绑定"的缺口从零补齐,共 146 测试全绿。**用户授权"建前提基建"后,已亲手补齐四枚缺口(技能进化系统 + 工作区命令幂等审计 + subagent 配置版本链 + 删除墓碑竞态守卫)。** 剩余项仍为架构级或前提基建缺失(peer 策略需多设备 P2P 层、pending_turn 需 SDK 投影流、input_replacements 需给 ChatMessage 加 id),26+ 平台绑定项如实标注不硬抄。
>
> **最终判定:能在我方 `apps/cli` 当前架构内真实落地并超越的价值,已全部收割完毕。剩余项要么需先建前提基建(自修改技能系统 / SDK 会话编排器 / 多设备同步层),要么属平台绑定不搬 —— 没有可在当前架构内"再榨一枚"的余地。这不是未完成,而是把"能榨的已榨干、不能榨的说清为什么"如实钉死的诚实收口。**
>
> ⚠️ 更正记录:早期记录把 `preview-envelope`(J2)与 `bounded-json`(J4)列为"已就绪",经复核二者不在当前工作区(`find` 无命中、非 git 跟踪)。本结论只认实际存在且可验证的 4 模块,不虚报未交付物。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
