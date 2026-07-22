# 数据库设计(IHUI-AI)

> IHUI-AI 数据库 schema、迁移管理、RLS 行级安全、种子数据、备份恢复的完整参考。系统级数据库架构、连接配置、多租户业务设计见 [architecture.md §2](./architecture.md#2-数据库架构)与 [architecture.md §12](./architecture.md#12-多租户架构原-server-docsmulti_tenantmd2026-07-22-整合),本文档聚焦 schema 层实现与运维操作。

---

## 0. 总览

| 维度 | 值 |
|------|-----|
| 数据库 | PostgreSQL 15 |
| 库名 | `ihui`(单库,通过 `public` schema 隔离业务域) |
| 连接驱动 | postgres-js 3.4(`packages/database/src/client.ts`) |
| ORM | Drizzle ORM 0.38 |
| 连接池 | 默认 `max=10`(单库)/ `max=20`(读写分离主库)/ `max=10`(每租户分库) |
| Schema 文件 | `packages/database/src/schema/`(160+ 文件,339 表) |
| 迁移文件 | `packages/database/drizzle/`(144+ SQL 文件) |
| 种子数据 | `packages/database/seed/`(9 步幂等 seed 流程) |
| 多租户隔离 | RLS 行级安全 + `tenant_id` 列 + `app.tenant_id` 会话变量 |
| 默认租户 UUID | `00000000-0000-0000-0000-000000000000` |
| 向量扩展 | pgvector(`0123_pgvector_embedding.sql` + `0129_codebase_embedding.sql`) |

> **表数差异说明**:[architecture.md §2](./architecture.md#2-数据库架构)记录"96 表 / 34 文件"是 2026-07-19 早期快照,后续 P0~P3 深度层开发新增大量模块,目前实际为 339 表 / 160+ schema 文件(本表数据基于 `packages/database/src/schema/` 目录实际盘点)。

---

## 1. ORM 栈

### 1.1 包结构(`@ihui/database`)

```
packages/database/
├── drizzle/                  # 迁移 SQL 文件(144+) + meta/(journal + snapshots)
│   ├── 0000_naive_barracuda.sql
│   ├── ...
│   ├── 0130_two_factor.sql
│   ├── 20260720120000_add_missing_fields.sql    # 日期前缀迁移(2026-07 起)
│   └── 20260722190000_model_leaderboard.sql
├── seed/                     # 种子数据(9 步幂等)
│   ├── _utils/upsert-by-unique.ts
│   ├── index.ts              # seed 主入口(支持 --only / --skip 过滤)
│   ├── users.ts              # 默认 test / admin 账号
│   ├── permissions.ts        # 214 条 RBAC 权限码
│   ├── ai-categories.ts      # AI 行业分类
│   ├── lessons.ts            # 课程数据
│   ├── ai-tutorials.ts       # AI 教学资源
│   ├── ai-fresh-2026.ts      # 2026-07 真实 AI 资讯
│   ├── seed-cross-domain.ts  # 8 领域 80 条跨域数据
│   ├── ai-feed-sources.ts    # 17 条 AI 资讯信源
│   └── leaderboard-seed.ts   # 89 条 arena.ai 排行榜数据
├── scripts/                  # 迁移补丁应用器(历史 RLS 迁移)
├── src/
│   ├── schema/               # Drizzle schema 定义(160+ 文件)
│   ├── client.ts             # createDb(url) 单库
│   ├── read-replica.ts       # createReadWriteDb(config) 读写分离 + 故障转移
│   ├── rls.ts                # withTenant / withBypassRls
│   ├── tenant-router.ts      # 多租户分库路由(per-tenant DATABASE_URL)
│   └── index.ts              # 统一导出
├── drizzle.config.ts         # drizzle-kit 配置
├── package.json              # @ihui/database
└── setup-admin-account.mjs   # 管理员账号初始化
```

### 1.2 关键依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `drizzle-orm` | ^0.38.2 | ORM 核心 |
| `postgres` | ^3.4.5 | postgres-js 驱动 |
| `drizzle-kit` | ^0.31.10 | 迁移生成 / migrate / studio / check |
| `tsx` | ^4.19.2 | seed 脚本执行器 |
| `vitest` | ^2.1.8 | schema 完整性 + RLS 测试 |

### 1.3 客户端创建

```typescript
// packages/database/src/client.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

export function createDb(url: string) {
  const client = postgres(url, { max: 10, prepare: false })
  return drizzle(client, { schema })
}

export type Database = ReturnType<typeof createDb>
```

`apps/api` 在启动时通过 `apps/api/src/db/index.ts` 创建默认 `db` + `dbRead`(读写分离),并调用 `setDefaultDatabase(db)` 注入到 `tenant-router.ts` 作为 fallback。

---

## 2. Schema 模块覆盖(160+ 文件,339 表)

按业务域归类,每类列代表 schema 文件与代表表。完整表清单见 `packages/database/src/schema/index.ts` 的 re-export。

### 2.1 用户与认证(users / auth / identity / user-auth-info)

| 文件 | 代表表 | 说明 |
|------|--------|------|
| `users.ts` | `users` / `refresh_tokens` | 用户主表 + refresh token family |
| `identity.ts` | `oauth_accounts` / `third_party_bindings` | OAuth 第三方账号绑定 |
| `auth-identity.ts` | `realname_verifications` | 实名认证 |
| `user-auth-info.ts` | `user_auth_infos` | 用户认证信息 |
| `user-preferences.ts` | `user_preferences` | 用户偏好(key-value) |
| `user-addresses.ts` | `user_addresses` | 用户收货地址 |
| `user-memory.ts` | `user_memories` | 用户记忆(P0-3 三端同步) |
| `user-chat-skills.ts` | `user_chat_skills` | 用户自定义对话技能 |
| `rbac.ts` | `roles` / `permissions` / `role_permissions` / `user_roles` | RBAC 权限模型 |
| `admin-sys.ts` | `sys_depts` / `sys_posts` / `sys_dict` / `sys_operlog` | 系统管理(迁移自 RuoYi) |

### 2.2 计费与电商(billing / order / payment / wallet / fund / vip / commission / refund-audit / wechat-pay-contracts)

| 文件 | 代表表 |
|------|--------|
| `billing.ts` | `plans` / `orders` / `payments` / `ai_pricing` |
| `wallet.ts` | `wallets` / `wallet_transactions` |
| `funds.ts` | `fund_accounts` / `fund_transactions` |
| `vip.ts` | `vip_levels` / `vip_subscriptions` |
| `commission.ts` | `commissions` / `commission_rules` |
| `refund-audit.ts` | `refund_audits` |
| `payment-callbacks.ts` | `payment_callbacks` |
| `wechat-pay-contracts.ts` | `wechat_pay_contracts`(周期扣款签约) |

### 2.3 AI 能力与配置(ai-capabilities / ai-config / ai-vendor-configs / ai-cost / ai-feed / ai-world / agents-extended / agent-tasks / agent-context / agent-reviews / agent-rule / agent-commerce / agent-billings / clawdbot / crew)

| 文件 | 代表表 |
|------|--------|
| `ai-capabilities.ts` | `ai_capabilities` |
| `ai-config.ts` | `ai_model_config` / `ai_model_groups` |
| `ai-vendor-configs.ts` | `ai_vendor_configs` |
| `ai-cost.ts` | `ai_cost_records` / `ai_token_budgets` |
| `ai-feed.ts` / `ai-feed-posts.ts` | AI 资讯信源 + 文章 |
| `ai-world-items.ts` | AI World 项目 |
| `ai-education.ts` | AI 教育 5 张表(policy/teacher-cert/aigc-tool/k12/university) |
| `agents-extended.ts` | `agents`(智能体主表) |
| `agent-tasks.ts` | `agent_tasks`(智能体任务) |
| `agent-context.ts` | `agent_contexts` |
| `agent-reviews.ts` | `agent_reviews` |
| `agent-rule.ts` | `agent_rules` |
| `agent-commerce.ts` | `agent_commerce`(智能体购买) |
| `agent-billings.ts` | `agent_billings`(智能体结算) |
| `clawdbot.ts` | `clawdbot_*` |
| `crew.ts` | 多智能体 Crew 会话 / 任务 / Artifacts |
| `model-leaderboard.ts` | `model_leaderboard`(大模型排行榜) |
| `llm-call-logs.ts` | `llm_call_logs` |

### 2.4 聊天与对话(chat / coze-chat-history / message / message-templates / notifications / email-logs)

| 文件 | 代表表 |
|------|--------|
| `chat.ts` | `chat_conversations` / `chat_messages` / `chat_favorites` |
| `coze-chat-history.ts` | `coze_chat_history` |
| `message.ts` | `messages`(站内信) |
| `message-templates.ts` | `message_templates` |
| `notifications.ts` | `notifications` |
| `email-logs.ts` | `email_logs` |

### 2.5 内容与学习(content / learn / learn-extended / learn-record / learn-homework / exam / exam-extended / news / topic / articles / certificate / education-platform / zhs-full / course-recommend-supplement / question-bank-supplement)

| 文件 | 代表表 |
|------|--------|
| `content.ts` | `articles` / `announcements` / `help_docs` |
| `learn.ts` / `learn-extended.ts` / `learn-extra-extended.ts` / `learn-record.ts` / `learn-homework.ts` | 课程 / 章节 / 课时 / 学习记录 / 作业 |
| `exam.ts` / `exam-extended.ts` | 试卷 / 试题 / 考试记录 / 错题 |
| `news.ts` / `news-crawler.ts` | 资讯 + 爬虫源 |
| `topic.ts` | `topics`(专题) |
| `articles.ts` | 文章 |
| `certificate.ts` | 证书 + 模板 |
| `education-platform.ts` | 教育平台同步 |
| `zhs-full.ts` | ZHS 课程 / 组织 / 班级 |
| `course-recommend-supplement.ts` | 课程推荐 |
| `question-bank-supplement.ts` | 题库补充 |

### 2.6 社交与社区(social / social-supplement / community / circle-extra / comments / promotions / gamification / ask-extra)

| 文件 | 代表表 |
|------|--------|
| `social.ts` / `social-supplement.ts` | follows / favorites / subscriptions / tags |
| `community.ts` / `circle-extra.ts` | circles / asks |
| `comments.ts` | comments / comment_likes |
| `promotions.ts` | invitations / activities / coupons |
| `gamification.ts` | points / levels / sign_in_records / leaderboard |
| `ask-extra.ts` | ask 扩展(回答编辑 / 点赞 / 评论 / 分类) |

### 2.7 团队与工作区(teams / workspace-permissions / workspace-ai-tasks / groups / schedule)

| 文件 | 代表表 |
|------|--------|
| `teams.ts` | teams / team_members |
| `workspace-permissions.ts` | workspace_permissions |
| `workspace-ai-tasks.ts` | workspace_ai_tasks |
| `groups.ts` | user_groups |
| `schedule.ts` | scheduled_tasks |

### 2.8 知识库与记忆(knowledge-base / knowledge-base-categories / knowledge-graph / knowledge-rag / memory / codebase-index / mcp-servers)

| 文件 | 代表表 |
|------|--------|
| `knowledge-base.ts` / `knowledge-base-categories.ts` | 知识库 + 分类 |
| `knowledge-graph.ts` | `knowledge_graph_nodes` / `knowledge_graph_edges`(`0125_knowledge_graph.sql`) |
| `knowledge-rag.ts` | 知识库 RAG 文档 + chunks + 向量 |
| `memory.ts` | 四层记忆系统 |
| `codebase-index.ts` | 代码库语义索引(`0129_codebase_embedding.sql`) |
| `mcp-servers.ts` | MCP 服务器配置 |

### 2.9 系统与运维(system / setting / audit / behavior / visit-tracking / oss / monitor / statistics / security / security-logs / sensitive-words / app-version / canary / themes / tour / site-categories / gen-table / id-mapping / zone)

| 文件 | 代表表 |
|------|--------|
| `system.ts` | system_configs / integrations / api_logs / system_events |
| `setting.ts` | edu_settings / oss_drivers(凭证 AES-256-GCM 加密) |
| `audit.ts` | `audit_logs`(0060 迁移按月分区) |
| `behavior.ts` | user_behaviors |
| `visit-tracking.ts` | visit_records |
| `oss.ts` | oss_objects / oss_buckets |
| `monitor.ts` | monitor_metrics |
| `statistics.ts` | statistics_snapshots |
| `security.ts` / `security-logs.ts` | security_events / security_logs |
| `sensitive-words.ts` | sensitive_words |
| `app-version.ts` | app_versions |
| `canary.ts` | canary_configs / canary_audits |
| `themes.ts` | themes |
| `tour.ts` | tours |
| `site-categories.ts` | site_categories |
| `gen-table.ts` | gen_tables(代码生成器) |
| `id-mapping.ts` | id_mappings(0083 迁移) |
| `zone.ts` | zones(区域) |

### 2.10 直播与媒体(live / live-extended / live-supplement / srs / remote-device / transcode / miniprogram / bot-sites / publish-platform / self-media)

| 文件 | 代表表 |
|------|--------|
| `live.ts` / `live-extended.ts` / `live-supplement.ts` | 直播 + 订阅 + 试卷 |
| `srs.ts` | SRS 媒体服务器 |
| `remote-device.ts` | 远程设备 + 任务 |
| `transcode.ts` | 转码任务 |
| `miniprogram.ts` | 小程序配置 |
| `bot-sites.ts` | bot 站点 |
| `publish-platform.ts` | 多平台发布账号 / 任务 / 历史 |
| `self-media.ts` | 自媒体文章 + 口播稿 |

### 2.11 资源与文件(files / files-extra / file-versions(在 schema/files.ts) / resource / resource-download / resource-likes / upload-sessions / search-contents / search-hot-words / carousels / faq / agreements / export-tasks / plugin-events / customer-service / service-appointments / business-cards / developer / developer-api-keys / sdks / tools / skills / projects / image-gen-favorites / openclaw-items / ab-tests / demand-square / captcha / email-logs / notes / product-identity / relation-tables / stock / trader / tbox-extended / admin-extended / misc-extended / misc-extended-2 / edu-extended / edu-full / certificate / tour / school-org-supplement / tenant)

剩余业务域文件按命名直观对应,完整索引见 `packages/database/src/schema/index.ts`。

---

## 3. 关键表设计示例

### 3.1 users(用户主表)

来源:`packages/database/src/schema/users.ts`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK, default random | 用户 UUID |
| `phone` | varchar(20) | UNIQUE | 手机号 |
| `email` | varchar(255) | UNIQUE | 邮箱 |
| `username` | varchar(64) | UNIQUE | 用户名 |
| `password_hash` | text | | bcryptjs 哈希(member 表 SHA256 兼容旧 Java 数据) |
| `nickname` | varchar(64) | | 昵称 |
| `avatar` | text | | 头像 URL |
| `bio` | text | | 个人简介 |
| `gender` | integer | NOT NULL, default 0 | 0=未知 1=男 2=女 |
| `birthday` | date | | 生日 |
| `family_id` | uuid | | 家族 ID(token-family + 共享账号) |
| `role_id` | integer | default 0 | 角色 ID(0=普通,>=1=管理员) |
| `dept_id` | integer | FK → sys_depts, ON DELETE SET NULL | 部门 |
| `status` | integer | NOT NULL, default 1 | 0=禁用 1=正常 3=注销 |
| `is_vip` | integer | NOT NULL, default 0 | -1=游客 0=普通 1=VIP 2=操盘手 |
| `level` | integer | NOT NULL, default 0 | 0=普通 1=白银 2=黄金 3=钻石 |
| `is_system_admin` | boolean | NOT NULL, default false | 系统内置管理员(DB 触发器 + 应用层双重锁) |
| `invite_code` | varchar(32) | UNIQUE | 邀请码 |
| `parent_id` | uuid | | 推荐人(分销关系链,不自引用 FK) |
| `two_factor_secret` | bytea | | TOTP 密钥(AES-256-GCM 加密后 Buffer) |
| `two_factor_enabled` | boolean | NOT NULL, default false | 是否启用 2FA |
| `two_factor_backup_codes` | jsonb | NOT NULL, default [] | sha256 hash 数组(明文不存) |
| `two_factor_enabled_at` | timestamptz | | 2FA 启用时间 |
| `created_at` / `updated_at` | timestamptz | default now() | 时间戳 |

**索引**:`users_invite_code_unique`(unique on invite_code)、`users_tenant_id_idx`(RLS 迁移 0066)、`users_search_vector_idx`(GIN 全文索引,迁移 0010)、`idx_users_two_factor_enabled`(部分索引,迁移 0130)。

**RLS**:迁移 0066 启用 `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`,策略 `USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`。

### 3.2 refresh_tokens(refresh token family)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | |
| `user_id` | uuid | FK → users, ON DELETE CASCADE | 用户(0073 迁移改 cascade) |
| `token` | text | UNIQUE | refresh token 字符串 |
| `family_id` | uuid | | family 标识(reuse 检测) |
| `expires_at` | timestamptz | | 过期时间 |
| `revoked_at` | timestamptz | | 撤销时间(NULL=未撤销) |
| `created_at` | timestamptz | default now() | |

### 3.3 agent_tasks(智能体任务)

来源:`packages/database/src/schema/agent-tasks.ts`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | |
| `agent_id` | uuid | FK → agents, ON DELETE CASCADE | 所属智能体 |
| `rule_id` | uuid | FK → agent_rules, ON DELETE SET NULL | 关联规则 |
| `name` | varchar(200) | NOT NULL | 任务名 |
| `description` | text | | 描述 |
| `status` | varchar(20) | NOT NULL, default 'pending' | pending/running/completed/failed |
| `priority` | integer | NOT NULL, default 0 | 优先级 |
| `payload` | jsonb | NOT NULL, default {} | 任务载荷 |
| `result` | jsonb | | 任务结果 |
| `scheduled_at` | timestamptz | | 计划执行时间 |
| `started_at` / `completed_at` | timestamptz | | 实际开始 / 完成 |
| `error_message` | text | | 错误信息 |
| `created_by` | uuid | FK → users, ON DELETE SET NULL | 创建者(G13 审计) |
| `updated_by` | uuid | FK → users, ON DELETE SET NULL | 更新者(G10 审计) |
| `created_at` / `updated_at` | timestamptz | NOT NULL, default now() | |

**索引**:`agent_tasks_agent_idx`(on agent_id)、`agent_tasks_status_idx`(on status)。

### 3.4 orders(订单)

来源:`packages/database/src/schema/billing.ts`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | |
| `order_no` | varchar(64) | NOT NULL, UNIQUE | 订单号 |
| `user_id` | uuid | FK → users, ON DELETE SET NULL | 用户(删除时保留财务凭证) |
| `plan_id` | uuid | FK → plans | 订阅方案 |
| `amount` | integer | NOT NULL | 金额(分,避免浮点) |
| `currency` | varchar(8) | NOT NULL, default 'CNY' | 货币 |
| `status` | varchar(16) | NOT NULL, default 'pending' | pending/paid/cancelled/refunded |
| `payment_method` | varchar(16) | | wechat/alipay/stripe/usdc |
| `order_type` | integer | NOT NULL, default 0 | 1=membership 2=token 3=activity 4=identity |
| `product_id` | varchar(64) | | 商品 ID |
| `paid_at` | timestamptz | | 支付时间 |
| `expires_at` | timestamptz | | 过期时间 |
| `created_by` / `updated_by` | uuid | FK → users, ON DELETE SET NULL | 审计(G10/G13) |
| `created_at` / `updated_at` | timestamptz | NOT NULL, default now() | |

**RLS**:迁移 0066 启用,`tenant_id` 列 + `orders_tenant_id_idx`。

### 3.5 chat_conversations / chat_messages(对话)

来源:`packages/database/src/schema/chat.ts`

`chat_conversations`:`id` / `user_id`(FK cascade) / `title`(default '新对话') / `model`(default 'gpt-4o-mini') / `system_prompt` / `metadata` / `last_message_at` / `archived_at` / `compressed_at` / `compressed_context`。

`chat_messages`:`id` / `conversation_id`(FK cascade) / `role`(user/assistant/system) / `content` / `tokens` / `metadata`。

`chat_favorites`:`(user_id, conversation_id)` UNIQUE。

---

## 4. 迁移管理

### 4.1 迁移目录与命名规则

迁移目录:`packages/database/drizzle/`。

**命名规则**:

- 早期(drizzle-kit 自动生成):`0000_< marvel_codename >.sql`,如 `0000_naive_barracuda.sql`、`0043_neat_the_spike.sql`。codename 由 drizzle-kit 随机生成,与内容无关。
- 业务模块批量:`00XX_<module>_module.sql`,如 `0014_community_module.sql`、`0017_member_module.sql`。
- 描述性后缀:`00XX_<description>.sql`,如 `0010_fulltext_search_indexes.sql`、`0066_rls_tenant_isolation.sql`、`0130_two_factor.sql`。
- 日期前缀(2026-07 起):`YYYYMMDDHHMMSS_<description>.sql`,如 `20260722190000_model_leaderboard.sql`,便于按时间排序与归档。
- RLS 专题:`0066_rls_tenant_isolation.sql` / `0068_rls_policies.sql` / `0072_drop_0066_rls_policies.sql` / `0074_reapply_tenant_rls.sql`(RLS 启用 / 策略 / 撤销 / 重新应用历史)。

### 4.2 Journal 与 snapshot

- `drizzle/meta/_journal.json`:追踪全部迁移记录(顺序 + 文件名 + hash),drizzle-kit migrate 据此判断未执行迁移。
- `drizzle/meta/0000_snapshot.json` ~ `0127_snapshot.json`:每个迁移后的 schema 快照(用于 generate 时计算 diff)。
- 部分迁移无 snapshot(手动增量),journal 仍记录。

### 4.3 drizzle-kit 三件套

| 命令 | 用途 | 调用 |
|------|------|------|
| `db:generate` | 对比 TS schema 与上一次 snapshot,生成新迁移 SQL | `pnpm --filter @ihui/database db:generate` |
| `db:migrate` | 执行未应用的迁移(读 `_journal.json` 顺序执行) | `pnpm --filter @ihui/database db:migrate` |
| `db:check` | 校验 TS schema 与已生成迁移的一致性(无漂移) | `pnpm --filter @ihui/database db:check` |
| `db:push` | 直接 push schema 到 DB(无迁移记录,开发用) | `pnpm --filter @ihui/database db:push` |
| `db:studio` | 启动 Drizzle Studio(web GUI 查询) | `pnpm --filter @ihui/database db:studio` |
| `seed` | 执行种子数据(9 步幂等) | `pnpm --filter @ihui/database seed` |

配置见 `packages/database/drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui',
  },
  verbose: true,
  strict: true,
})
```

### 4.4 历史迁移补丁应用器

`packages/database/scripts/` 与 `apps/api/scripts/` 下保留历史 RLS 迁移补丁应用器(已合并到 drizzle,留作存档):

- `apply-all-migrations.mjs` / `apply-migration.mjs` / `apply-migration-h3.mjs`
- `rls-prod-dryrun.mjs`(生产 RLS 预演)
- `verify-migration-h3.mjs`
- `apps/api/scripts/apply-0060.mjs` / `apply-0066.mjs` / `apply-0067.mjs` / `apply-0068.mjs` / `apply-0071.mjs` / `apply-0072.mjs`
- `apps/api/scripts/verify-0066.mjs` / `verify-rls.mjs`

### 4.5 迁移编号体系示例

| 编号 | 文件 | 内容 |
|------|------|------|
| 0000-0006 | 初始 schema | 用户 / 项目 / 文件 / 通知等基础表 |
| 0007 | `levels_seed.sql` | 等级种子 |
| 0010 | `fulltext_search_indexes.sql` | GIN 全文索引(users/projects/files) |
| 0012-0028 | 业务模块批量 | learn/exam/community/order/live/member/resource/point/usercenter/schedule/statistics/message/topic/behavior/visit-tracking/oss/setting |
| 0036 | `oauth_third_party.sql` | OAuth 第三方登录 |
| 0060 | `r70_audit_logs_partition.sql` | audit_logs 按月分区 |
| 0066 | `rls_tenant_isolation.sql` | 启用 RLS(6 表)+ tenant_id 列 |
| 0068 | `rls_policies.sql` | RLS 策略 |
| 0072 | `drop_0066_rls_policies.sql` | 撤销 0066 策略(回滚) |
| 0073 | `refresh_tokens_cascade.sql` | refresh_tokens ON DELETE CASCADE |
| 0074 | `reapply_tenant_rls.sql` | 重新应用租户 RLS |
| 0095-0097 | P1 schema batch | P1 深度层表 |
| 0100 | `light_sleeper.sql` | 索引优化 |
| 0108 | `r83_supplement_27_tables.sql` | R83 补建 27 表 |
| 0123 | `pgvector_embedding.sql` | pgvector 向量扩展 |
| 0125 | `knowledge_graph.sql` | 知识图谱 |
| 0129 | `codebase_embedding.sql` | 代码库语义索引 |
| 0130 | `two_factor.sql` | 2FA/MFA 字段 |
| 20260722180000 | `llm_config_models_and_groups.sql` | LLM 配置模型与分组 |
| 20260722190000 | `model_leaderboard.sql` | 大模型排行榜 |

---

## 5. RLS 行级安全

### 5.1 实现栈

| 文件 | 职责 |
|------|------|
| `packages/database/src/rls.ts` | `withTenant(db, tenantId, fn)` + `withBypassRls(db, reason, fn)` |
| `packages/database/src/tenant-router.ts` | 多租户分库路由(per-tenant DATABASE_URL) |
| `apps/api/src/plugins/tenant.ts` | 从 header/subdomain 解析 tenantId,装饰 request.tenantId |
| `apps/api/src/plugins/rls-context.ts` | 每请求设置 PG 会话变量 `app.tenant_id` |
| `apps/api/src/plugins/tenant-db-isolation.ts` | per-tenant schema + AsyncLocalStorage 上下文 |
| `apps/api/src/plugins/tenant-db.ts` | per-tenant DATABASE_URL 物理 分库 |
| `apps/api/src/utils/idor-guard.ts` | 资源归属租户校验(IDOR 防护) |

### 5.2 withTenant 事务上下文

```typescript
// packages/database/src/rls.ts
export async function withTenant<T>(
  db: Database,
  tenantId: string,
  fn: (tx) => Promise<T>,
): Promise<T> {
  if (!isValidTenantId(tenantId)) {
    throw new Error(`[rls] invalid tenant id: ${tenantId}`)
  }
  return db.transaction(async (tx) => {
    // set_config 第三参数 true = local(等同 SET LOCAL,事务结束自动失效)
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`)
    return fn(tx)
  })
}
```

**安全要点**:
- `set_config($1, $2, true)` 参数化绑定,防 SQL 注入(PostgreSQL `SET LOCAL` 不支持参数绑定,但 `set_config()` 函数支持)。
- `isValidTenantId` UUID 白名单作为深度防御(不再是唯一防线)。
- 事务结束(commit/rollback)后 `SET LOCAL` 自动失效,无需手动清理。

### 5.3 withBypassRls(系统/迁移专用)

```typescript
export async function withBypassRls<T>(
  db: Database,
  reason: string,  // 'migration' | 'seed' | 'cleanup' | 'test-cleanup'
  fn: (tx) => Promise<T>,
): Promise<T>
```

**强制约束**:
- `reason` 必填,白名单 4 个值,非白名单抛错。
- 生产环境禁止 `test-cleanup` reason。
- 每次调用写审计日志(warn 级别,含 reason + 调用栈前 5 行)。

### 5.4 RLS 启用 / 禁用历史

| 迁移 | 操作 |
|------|------|
| 0066 `rls_tenant_isolation.sql` | 启用 RLS(users/orders/payments/chat_messages/chat_favorites/comment_likes 6 表)+ tenant_id 列 + 索引 + FORCE ROW LEVEL SECURITY |
| 0068 `rls_policies.sql` | 创建 RLS 策略(USING tenant_id = current_setting) |
| 0070 `rls_safe_tenant_id.sql` | 安全的 tenant_id 默认值 |
| 0072 `drop_0066_rls_policies.sql` | 撤销 0066 策略(回滚 0066 风险) |
| 0074 `reapply_tenant_rls.sql` | 重新应用租户 RLS(修复 0072 误撤销) |

### 5.5 多租户分库路由

`packages/database/src/tenant-router.ts` 实现"物理分库":

- 连接池 `Map<tenantId, Database>`,懒加载。
- 租户 DB URL 从 env `TENANT_${TENANT_ID}_DATABASE_URL` 读取(tenantId 归一化为大写下划线)。
- 未配置租户专用 URL → fallback 到默认 Database(单租户兼容)。
- 每租户连接池 `max=10`。
- 租户 DB 创建失败 → console.warn + 降级到默认库。
- `closeAllTenantDatabases()` 进程退出时调用。

### 5.6 读副本与故障转移

`packages/database/src/read-replica.ts` 的 `createReadWriteDb(config)`:

- 主库 `dbWriter` + 多读副本 `replicaDbs`(含优先级)。
- `getReader()` 自动返回优先级最高的健康副本。
- `reportReplicaHealth(id, ok, lagSec)` 驱动故障转移:连续失败 ≥3 次标记不健康,复制延迟 >10s 标记不健康。
- 全部不健康时回退到主库。

---

## 6. 种子数据(9 步幂等)

### 6.1 seed 流程

`packages/database/seed/index.ts` 定义 9 步幂等 seed,支持 `--only=1,3,5` 与 `--skip=2,4` 过滤。

| 步 | 名称 | 文件 | critical |
|----|------|------|----------|
| 1 | AI 行业分类 | `ai-categories.ts` | 否 |
| 2 | 课程数据 | `lessons.ts` | 否 |
| 3 | AI 教学资源 | `ai-tutorials.ts` | 否 |
| 4 | 2026-07 真实 AI 资讯 | `ai-fresh-2026.ts` | 否 |
| 5 | 跨领域数据(8 领域 80 条) | `seed-cross-domain.ts` | 否 |
| 6 | RBAC 权限点(214 条 + admin 绑定) | `permissions.ts` | ✅ |
| 7 | 默认登录用户(test / admin) | `users.ts` | ✅ |
| 8 | AI 资讯信源(17 条) | `ai-feed-sources.ts` | 否 |
| 9 | 大模型排行榜(89 条 arena.ai) | `leaderboard-seed.ts` | 否 |

**critical 步骤**:失败时整个 seed 进程退出码 1(仅 `seedUsers` + `seedPermissions`)。其余步骤失败仅记录,不影响整体流程。

### 6.2 upsert-by-unique 工具

`packages/database/seed/_utils/upsert-by-unique.ts` 提供幂等 upsert:

```typescript
// 按唯一键 upsert,重复执行不报错不重复插入
import { upsertByUnique } from '../_utils/upsert-by-unique.js'

await upsertByUnique(db, users, { phone: '13800138000', ... }, 'phone')
```

### 6.3 权限种子数据

`packages/database/seed/permissions-seed.json` 包含 214 条权限码,`permissions.ts` 将其 upsert 到 `permissions` 表并绑定到 `admin` 角色(`roleId=1` → 通配符 `*:*:*`)。

### 6.4 执行 seed

```bash
# 完整 seed
pnpm --filter @ihui/database seed

# 只跑权限 + 用户(快速恢复默认账号)
pnpm --filter @ihui/database seed -- --only=6,7

# 跳过资讯信源
pnpm --filter @ihui/database seed -- --skip=8
```

---

## 7. 多租户隔离(schema 层实现)

业务设计见 [architecture.md §12](./architecture.md#12-多租户架构原-server-docsmulti_tenantmd2026-07-22-整合),本节聚焦 schema 层。

### 7.1 tenant_id 列约定

- 所有多租户表必须定义 `tenant_id` 列(uuid,NOT NULL,默认 `00000000-0000-0000-0000-000000000000`)。
- 必须建索引:`CREATE INDEX <table>_tenant_id_idx ON <table>(tenant_id)`。
- 迁移 0066 在 6 个核心表(users/orders/payments/chat_messages/chat_favorites/comment_likes)示范了完整模式。

### 7.2 RLS 策略模板

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table> FORCE ROW LEVEL SECURITY;

CREATE POLICY <table>_tenant_isolation ON <table>
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

`current_setting` 第二参数 `true` 表示缺失时返回 NULL(不抛错),后端服务必须在每次事务开头执行 `SET LOCAL app.tenant_id = '<uuid>'`(由 `withTenant` 自动完成)。

### 7.3 应用层注入链路

```
请求 → tenant.ts(解析 X-Tenant-ID / subdomain)→ request.tenantId
     → rls-context.ts(每请求 SET LOCAL app.tenant_id)
     → 查询层 withTenant(db, tenantId, fn)
     → RLS 策略自动过滤 WHERE tenant_id = current_setting
```

### 7.4 租户配额

`tenant_quotas` 表(`packages/database/src/schema/tenant.ts`)跟踪每租户配额:

| 字段 | 说明 |
|------|------|
| `api_calls_used` / `api_calls_limit` | API 调用计数(默认 10000/天) |
| `storage_used_mb` / `storage_limit_mb` | 存储配额(默认 10GB) |
| `user_count` / `user_limit` | 用户数配额 |

`apps/api/src/plugins/tenant.ts` 在 `onResponse` 钩子异步自增 `api_calls_used`,超额抛 429。

---

## 8. 索引策略

### 8.1 全文索引(0010)

`packages/database/drizzle/0010_fulltext_search_indexes.sql` 在 users/projects/files 表创建 GIN tsvector 索引:

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
CREATE INDEX IF NOT EXISTS "users_search_vector_idx" ON "users" USING GIN ("search_vector");
CREATE TRIGGER search_vector_users_trigger BEFORE INSERT OR UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger("search_vector", 'pg_catalog.simple', "nickname", "email");
```

projects(name+description)、files(name)同模式。查询时 `WHERE search_vector @@ to_tsquery('simple', '关键词')`。

### 8.2 唯一索引

- `users.phone` / `users.email` / `users.username` / `users.invite_code`
- `refresh_tokens.token`
- `orders.order_no`
- `chat_favorites(user_id, conversation_id)` 复合唯一
- `role_permissions(role_id, permission_id)` 复合唯一
- `user_roles(user_id, role_id)` 复合唯一

### 8.3 复合索引

- `agent_tasks_agent_idx`(on agent_id)
- `agent_tasks_status_idx`(on status)
- `ai_pricing_model_idx`(on model_id)
- `ai_pricing_effective_idx`(on effective_at)

### 8.4 部分索引

- `idx_users_two_factor_enabled`(0130):仅对 `two_factor_enabled = TRUE` 的行建索引,加速登录时 2FA 校验路径。
- `0100_light_sleeper.sql`:索引优化(命名 marvel codename)。

### 8.5 向量索引

- `0123_pgvector_embedding.sql`:启用 pgvector 扩展,知识库 RAG 向量列。
- `0129_codebase_embedding.sql`:代码库语义索引。

---

## 9. 备份恢复

完整部署 / 备份 / 恢复 runbook 见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md),本节仅列脚本入口。

### 9.1 备份脚本

| 脚本 | 用途 |
|------|------|
| `apps/api/scripts/pg-backup.mjs` | Node.js PostgreSQL 备份(pg_dump 封装) |
| `deploy/scripts/backup-db.sh` | Shell 备份(生产 cron 调用) |
| `apps/api/scripts/check-db.mjs` | DB 连接 + 关键表存在性检查 |
| `apps/api/scripts/check-db-state.mjs` | DB 状态深度检查 |
| `apps/api/scripts/check-user-fks.mjs` | 用户表外键完整性 |

### 9.2 恢复脚本

| 脚本 | 用途 |
|------|------|
| `deploy/scripts/restore-db.sh` | 从备份文件恢复 |
| `deploy/scripts/rollback.sh` | 应用回滚(DB + 镜像 tag) |

### 9.3 RLS 验证

| 脚本 | 用途 |
|------|------|
| `apps/api/scripts/verify-rls.mjs` | RLS 策略完整性验证 |
| `apps/api/scripts/verify-0066.mjs` | 0066 迁移应用验证 |
| `apps/api/scripts/verify-system-admin.mjs` | 系统管理员账号验证 |

### 9.4 管理员账号初始化

- `packages/database/setup-admin-account.mjs`:首次部署后初始化系统管理员。
- `apps/api/setup-admin-account.mjs`:同上(API 包入口)。
- `scripts/grant-ihui-superuser.mjs`:数据库 superuser 授权。

---

## 10. Schema 漂移检测

`scripts/check-db-schema-drift.mjs`(pre-commit 第 3 项,阻塞)防止 TS schema 与 migration 不一致:

### 10.1 检测维度

| 维度 | 含义 | 严重性 |
|------|------|--------|
| migration 缺失 | TS schema 定义了表 X,但所有 migration SQL 中没有 `CREATE TABLE X` | 阻塞(risk: 运行时崩溃) |
| 死 migration | migration 中 `CREATE TABLE X`,但 TS schema 中已无定义 | 警告(risk: 死迁移) |
| DROP 后未重建 | migration 中 `DROP TABLE X`,但后续没有 `CREATE` | 警告(risk: 误删) |

### 10.2 工作原理

1. 正则匹配 `packages/database/src/schema/*.ts` 中所有 `pgTable('table_name',` 提取 TS 表名集合。
2. 正则匹配 `packages/database/drizzle/*.sql` 中所有 `CREATE TABLE` / `DROP TABLE` 提取 migration 表名集合。
3. 对比两集合,输出差异。

### 10.3 用法

```bash
# 全量扫描(无问题 exit 0,有 migration 缺失 exit 1)
node scripts/check-db-schema-drift.mjs

# pre-commit 模式(schema drift 是全局问题,--staged 与无参数行为一致)
node scripts/check-db-schema-drift.mjs --staged
```

### 10.4 其他相关守门

- `apps/api/scripts/check-db.mjs`:运行时 DB 连接 + 关键表存在性检查(部署后冒烟)。
- `scripts/check-stale-dist.mjs`(pre-commit 第 4 项):packages 陈旧 dist 检测(防止 `@ihui/database` dist 与 src 不一致)。
- `scripts/check-dist-encoding.mjs`(pre-commit 第 4b 项):packages/*/dist UTF-8 BOM 守门。
- `packages/database/tests/schema-integrity.test.ts`:Vitest schema 完整性测试(FK / unique / NOT NULL 约束验证)。
- `packages/database/tests/rls.test.ts`:Vitest RLS 策略测试(withTenant / withBypassRls 行为验证)。

---

## 11. 常用运维命令

| 命令 | 用途 | 调用入口 |
|------|------|---------|
| 生成迁移 | 对比 schema 生成新 SQL | `pnpm --filter @ihui/database db:generate` |
| 执行迁移 | 应用未执行迁移 | `pnpm --filter @ihui/database db:migrate` |
| 校验漂移 | schema 与迁移一致性 | `pnpm --filter @ihui/database db:check` |
| 推送 schema | 开发期直接 push(无迁移记录) | `pnpm --filter @ihui/database db:push` |
| Drizzle Studio | web GUI 查询 DB | `pnpm --filter @ihui/database db:studio` |
| 执行 seed | 9 步幂等种子 | `pnpm --filter @ihui/database seed` |
| 类型检查 | TS schema 类型安全 | `pnpm --filter @ihui/database typecheck` |
| 构建包 | tsc 输出 dist | `pnpm --filter @ihui/database build` |
| 测试 | schema-integrity + rls 测试 | `pnpm --filter @ihui/database test` |
| DB 连接检查 | 部署后冒烟 | `node apps/api/scripts/check-db.mjs` |
| DB 备份 | 生产 cron | `bash deploy/scripts/backup-db.sh` |
| DB 恢复 | 灾难恢复 | `bash deploy/scripts/restore-db.sh` |
| Schema drift 检测 | pre-commit 守门 | `node scripts/check-db-schema-drift.mjs` |
| RLS 验证 | 生产 RLS 完整性 | `node apps/api/scripts/verify-rls.mjs` |
| 管理员初始化 | 首次部署 | `node packages/database/setup-admin-account.mjs` |
| 厂商配置初始化 | AI 厂商 LLM 配置 | `node apps/api/scripts/init-vendor-configs.ts` |
| 测试用户种子 | 集成测试 | `tsx apps/api/scripts/seed-test-users.ts` |
| 测试用户清理 | 集成测试后 | `node apps/api/scripts/cleanup-test-users.mjs` |
| 表外键完整性 | 数据完整性审计 | `node apps/api/scripts/check-user-fks.mjs` |
| DB 状态深度检查 | 运维巡检 | `node apps/api/scripts/check-db-state.mjs` |

### Docker migrate 服务

生产部署用独立 migrate 容器(`deploy/docker/Dockerfile.migrate`),执行 `drizzle-kit migrate` 后退出:

```bash
docker compose run --rm migrate
# 等价于 pnpm --filter @ihui/database db:migrate
# 容器内:cd packages/database && drizzle-kit migrate
```

---

## 12. 参考

- [architecture.md §2](./architecture.md#2-数据库架构) — 数据库架构总览
- [architecture.md §12](./architecture.md#12-多租户架构原-server-docsmulti_tenantmd2026-07-22-整合) — 多租户业务设计
- [API_REFERENCE.md](./API_REFERENCE.md) — API 端点参考
- [AUTHENTICATION.md](./AUTHENTICATION.md) — 认证授权(JWT / RBAC / data-scope)
- [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) — 部署 / 备份 / 恢复完整 runbook
- [DEVELOPMENT.md](./DEVELOPMENT.md) — 开发环境搭建
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — 常见问题排查
- `packages/database/src/schema/index.ts` — schema 统一导出
- `packages/database/drizzle/meta/_journal.json` — 迁移 journal
- `packages/database/drizzle.config.ts` — drizzle-kit 配置
