// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  bigint,
  boolean,
  timestamp,
  text,
  jsonb,
  index,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users.js'

/**
 * 中转站 Key 池表 (ai_relay_key_pool)。
 *
 * P0-5c(2026-07-29 立):同 provider 多 key 负载均衡/故障转移。
 * - 关联 ai_model_config 的 providerCode(不直接 FK,允许灵活引用)
 * - apiKeyEnc:加密存储的上游 API Key(同 aiModelConfig.apiKeyEnc 模式)
 * - priority:优先级(越小越优先),weight:权重(同优先级内加权随机)
 * - healthStatus:unknown/healthy/degraded/down,healthCheckedAt 最近检查时间
 * - isEnabled:启用/禁用开关
 */
export const aiRelayKeyPool = pgTable(
  'ai_relay_key_pool',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 关联 ai_model_config.provider_code(同 provider 的多 key 池) */
    providerCode: varchar('provider_code', { length: 64 }).notNull(),
    /** Key 名称(admin 识别用,如 "StepFun 主账号 #1") */
    name: varchar('name', { length: 128 }).notNull(),
    /** 加密的上游 API Key(同 aiModelConfig.apiKeyEnc 模式) */
    apiKeyEnc: text('api_key_enc').notNull(),
    /** Key 公开前缀(用于 UI 显示,如 "sk-***...***3a2f") */
    keyPrefix: varchar('key_prefix', { length: 32 }),
    /** 优先级(越小越优先,0 = 最高) */
    priority: integer('priority').default(0).notNull(),
    /** 权重(同优先级内加权随机,默认 1) */
    weight: integer('weight').default(1).notNull(),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    /** 健康状态:unknown / healthy / degraded / down */
    healthStatus: varchar('health_status', { length: 16 }).default('unknown').notNull(),
    // ── 调度精细控制(2026-09-16 立,深度对标补强 Y,对标竞品 temp-unschedulable 等)──
    /** 临时不可调度(admin 手动摘除,区别于 isEnabled 永久停用;选路时跳过) */
    tempUnschedulable: boolean('temp_unschedulable').default(false).notNull(),
    /** 账号级速率倍率(乘进该 Key 的有效权重,0.5 = 半速;null = 用全局) */
    rateMultiplier: numeric('rate_multiplier', { precision: 6, scale: 2 }),
    /** 账号级 RPM 覆盖(null = 用 group/global 配置;0 = 暂停) */
    rpmOverride: integer('rpm_override'),
    // ── 渠道配额(2026-08-01 立,迁移 20260801010050_add_channel_quota_fields.sql)──
    // 4 个上限全部可空(NULL = 无限),读写走 apps/api/src/services/channel-quota-service.ts
    /** 每日调用次数上限(null=无限) */
    dailyCallLimit: integer('daily_call_limit'),
    /** 每月调用次数上限(null=无限) */
    monthlyCallLimit: integer('monthly_call_limit'),
    /** 每日 token 上限(null=无限) */
    dailyTokenLimit: bigint('daily_token_limit', { mode: 'number' }),
    /** 每月 token 上限(null=无限) */
    monthlyTokenLimit: bigint('monthly_token_limit', { mode: 'number' }),
    healthCheckedAt: timestamp('health_checked_at', { withTimezone: true }),
    lastErrorMessage: text('last_error_message'),
    /** 额度信息(可选,从上游拉取或 admin 手填,单位:分,-1=无限) */
    balanceCents: numeric('balance_cents', { precision: 18, scale: 6, mode: 'number' }).default(-1),
    /** 备注 */
    remark: text('remark'),
    extraMetadata: jsonb('extra_metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerIdx: index('ai_relay_key_pool_provider_idx').on(t.providerCode),
    enabledIdx: index('ai_relay_key_pool_enabled_idx').on(t.isEnabled),
    priorityIdx: index('ai_relay_key_pool_priority_idx').on(t.priority),
  }),
)

/**
 * 第三方 AI IDE 平台账号池表 (ai_relay_account_pool)。
 *
 * 2026-10-22 立:对标并超越码道网关(CodeArtsGateway)的「平台账号池 + 反代」子系统。
 * 与 ai_relay_key_pool 的区别:key_pool 存的是上游 API Key(Bearer 直连),
 * 本表存的是「完整账号会话凭证」(access token + refreshToken + cookies + 设备指纹),
 * 需要平台适配器负责 token 临期自动刷新、401 自愈与指纹头伪装。
 *
 * - providerCode: 'trae' | 'workbuddy' | 'codearts' | 'qoder'(与 ai_relay_key_pool.provider_code 同命名空间,独立表)
 * - uid: 上游账号唯一标识(导入时从凭证解析,如 Trae JWT payload.data.id;同 provider 内唯一去重)
 * - tokenEnc/refreshTokenEnc/cookiesEnc: AES-256-GCM 字段级加密(同 encryptField 模式)
 * - tokenExpiresAt: access token 过期时刻(导入时解析 JWT exp,刷新后更新;调度器据此临期刷新)
 * - deviceId/machineId: 客户端设备指纹(明文存储,上游会话与设备绑定校验用)
 * - healthStatus/lastRefreshAt/refreshFailureCount/consecutiveFailures: 健康检查与自愈状态
 * - priority/weight/tempUnschedulable/isEnabled: 轮转调度(与 ai_relay_key_pool 同语义)
 * - proxyUrl: 账号级出口代理(对标 workbuddy-manager WB_HTTP_PROXY,每账号独立出口 IP 降风控)
 */
export const aiRelayAccountPool = pgTable(
  'ai_relay_account_pool',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /**
     * 池归属:NULL = 运营级全局池(现有行为);非 NULL = 该平台用户的个人号池。
     * 用户个人池只服务本人(转发选号按 owner 过滤、签到同步落到同一 owner),
     * 运营池保持全局兜底。两套唯一性各由部分唯一索引约束(见下方)。
     */
    ownerUserId: varchar('owner_user_id', { length: 64 }),
    /** 平台编码:trae / workbuddy / codearts / qoder */
    providerCode: varchar('provider_code', { length: 64 }).notNull(),
    /** 上游账号唯一 id(导入时解析,同 provider 去重键) */
    uid: varchar('uid', { length: 128 }).notNull(),
    /** 账号展示名(admin 识别用,如导入 JSON 的 name) */
    name: varchar('name', { length: 128 }).notNull(),
    /** 加密的 access token(JWT 或平台等价凭证) */
    tokenEnc: text('token_enc').notNull(),
    /** 加密的 refreshToken(可空:部分平台无续期机制) */
    refreshTokenEnc: text('refresh_token_enc'),
    /** 加密的会话 cookies(JSON 数组,Chrome 导出格式原样保留) */
    cookiesEnc: text('cookies_enc'),
    /** 加密的平台扩展敏感凭证(JSON,如 CodeArts 的 secretAccessKey/DPoP 私钥/PKCE verifier) */
    secretsEnc: text('secrets_enc'),
    /** 设备指纹 device id(明文) */
    deviceId: varchar('device_id', { length: 128 }),
    /** 设备指纹 machine id(明文) */
    machineId: varchar('machine_id', { length: 128 }),
    /** access token 过期时刻(解析 JWT exp 落库,刷新后更新) */
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    /** refreshToken 过期时刻(可空) */
    refreshExpiresAt: timestamp('refresh_expires_at', { withTimezone: true }),
    /** 优先级(越小越优先,0 = 最高) */
    priority: integer('priority').default(0).notNull(),
    /** 权重(同优先级内加权随机,默认 1) */
    weight: integer('weight').default(1).notNull(),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    /** 临时不可调度(admin/系统手动摘除,区别于 isEnabled 永久停用;选路时跳过) */
    tempUnschedulable: boolean('temp_unschedulable').default(false).notNull(),
    /** 健康状态:unknown / healthy / degraded / down */
    healthStatus: varchar('health_status', { length: 16 }).default('unknown').notNull(),
    healthCheckedAt: timestamp('health_checked_at', { withTimezone: true }),
    lastErrorMessage: text('last_error_message'),
    /** 最近一次被转发请求使用的时间(轮转/亲和参考) */
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    /** 最近一次成功刷新 token 的时间 */
    lastRefreshAt: timestamp('last_refresh_at', { withTimezone: true }),
    /** 连续刷新失败次数(达阈值 → healthStatus=down + tempUnschedulable) */
    refreshFailureCount: integer('refresh_failure_count').default(0).notNull(),
    /** 连续转发失败次数(转发层熔断计数,成功即清零) */
    consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
    /** 账号级出口代理(如 http://user:pass@ip:port;null = 直连) */
    proxyUrl: text('proxy_url'),
    // ── 补池认领工作流(2026-10-22 立,迁移 20261022230000_relay_account_usage_ledger.sql)──
    /** 认领状态:unclaimed / claimed(运营认领某账号负责维护) */
    claimStatus: varchar('claim_status', { length: 16 }).default('unclaimed').notNull(),
    /** 认领人(admin 用户 id,明文非敏感) */
    claimedBy: varchar('claimed_by', { length: 128 }),
    /** 认领时刻 */
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    /** 认领备注 */
    claimNote: text('claim_note'),
    /** 累计转发调用次数(号池消耗观测) */
    totalCalls: bigint('total_calls', { mode: 'number' }).default(0).notNull(),
    /** 凭证单调版本(O64 号池↔签到双向同步):每次凭证写入 +1,签到回写 CAS 基准;旧凭证永不覆盖新凭证 */
    credVersion: bigint('cred_version', { mode: 'number' }).default(1).notNull(),
    /** 平台特有附加凭证/元数据(明文,非敏感;敏感一律进 *Enc 字段) */
    extraMetadata: jsonb('extra_metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /** 运营池(owner_user_id IS NULL)内同平台同 uid 唯一 */
    opsProviderUidUniq: uniqueIndex('ai_relay_account_pool_ops_provider_uid_uniq')
      .on(t.providerCode, t.uid)
      .where(sql`${t.ownerUserId} IS NULL`),
    /** 个人池内同一 owner 下同平台同 uid 唯一(不同用户可各自持有同一上游账号) */
    userProviderUidUniq: uniqueIndex('ai_relay_account_pool_user_provider_uid_uniq')
      .on(t.ownerUserId, t.providerCode, t.uid)
      .where(sql`${t.ownerUserId} IS NOT NULL`),
    ownerIdx: index('ai_relay_account_pool_owner_idx').on(t.ownerUserId),
    providerIdx: index('ai_relay_account_pool_provider_idx').on(t.providerCode),
    enabledIdx: index('ai_relay_account_pool_enabled_idx').on(t.isEnabled),
    healthIdx: index('ai_relay_account_pool_health_idx').on(t.healthStatus),
    /** 临期刷新扫描:按 (providerCode, tokenExpiresAt) 建索引,scheduler 轮询用 */
    expiresIdx: index('ai_relay_account_pool_expires_idx').on(t.providerCode, t.tokenExpiresAt),
  }),
)

/**
 * 账号池用量台账表 (ai_relay_account_usage_ledger)。
 *
 * 2026-10-22 立:每次转发调用(成功/失败)落一行,供管理面 24h calls/tokens/failRate 聚合。
 * 写入方 apps/api/src/services/relay-account-usage.ts(fire-and-forget,失败不影响转发)。
 * - accountId:关联 ai_relay_account_pool.id(不加 FK,允许账号删除后台账留档)
 * - ok:本次转发是否成功(熔断/失败计数口径与转发器一致)
 * - ts:调用时刻(聚合窗口判据,索引 (accountId, ts))
 */
export const aiRelayAccountUsageLedger = pgTable(
  'ai_relay_account_usage_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 关联 ai_relay_account_pool.id(冗余存 providerCode 免回表) */
    accountId: uuid('account_id').notNull(),
    /** 平台编码(冗余自账号行,聚合/排查免 JOIN) */
    providerCode: varchar('provider_code', { length: 64 }).notNull(),
    /** 本次请求使用的模型名(别名解析前的对外名) */
    model: varchar('model', { length: 128 }).notNull(),
    promptTokens: integer('prompt_tokens').default(0).notNull(),
    completionTokens: integer('completion_tokens').default(0).notNull(),
    /** 推理 token(Trae reasoning_tokens / OpenAI completion_tokens_details;completion 已含它,只作拆分展示) */
    reasoningTokens: integer('reasoning_tokens').default(0).notNull(),
    /** 命中缓存的前缀 token(Trae cache_creation_input_tokens / OpenAI prompt_tokens_details.cached_tokens) */
    cachedTokens: integer('cached_tokens').default(0).notNull(),
    /** 本次转发是否成功 */
    ok: boolean('ok').notNull(),
    /** 端到端耗时(毫秒) */
    latencyMs: integer('latency_ms').default(0).notNull(),
    /** 调用时刻 */
    ts: timestamp('ts', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountTsIdx: index('ai_relay_account_usage_ledger_account_ts_idx').on(t.accountId, t.ts),
  }),
)

/**
 * 中转模型目录/别名表 (ai_relay_model_catalog)。
 *
 * 2026-10-22 立:账号池 provider(trae/workbuddy/codearts)对外模型名 → 上游真实模型名映射。
 * 转发器经 apps/api/src/services/relay-model-catalog.ts resolveModelAlias 解析,
 * 无映射时调用方原样透传。
 * - alias:对外暴露的模型名(同 provider 内唯一)
 * - upstreamModel:上游真实模型 id
 * - enabled:false 时不参与解析(软下线)
 */
export const aiRelayModelCatalog = pgTable(
  'ai_relay_model_catalog',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 平台编码:trae / workbuddy / codearts(与账号池同命名空间) */
    providerCode: varchar('provider_code', { length: 64 }).notNull(),
    /** 上游真实模型 id(如 'kimi-k2-0905-preview') */
    upstreamModel: varchar('upstream_model', { length: 128 }).notNull(),
    /** 展示名(管理面/目录回显,可空) */
    displayName: varchar('display_name', { length: 256 }),
    /** 对外别名(调用方请求的 model 名,同 provider 唯一) */
    alias: varchar('alias', { length: 128 }).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerAliasUniq: unique('ai_relay_model_catalog_provider_alias_unique').on(
      t.providerCode,
      t.alias,
    ),
    providerIdx: index('ai_relay_model_catalog_provider_idx').on(t.providerCode),
  }),
)

/**
 * 出口代理池表 (ai_relay_proxy_pool)。
 *
 * 2026-10-22 立:共享代理轮换池,账号自带 proxyUrl 优先,否则由
 * apps/api/src/services/relay-proxy-pool.ts pickProxyForAccount 从池轮换取 active 代理。
 * - status:active(可用)/ exhausted(失败超限暂冷)/ dead(人工/检测判死)
 * - failCount:连续失败计数,reportProxyFailure 累计,达阈值转 exhausted
 * - boundAccountId:绑定账号(非空则该代理只服务该账号;null = 共享)
 * - lastPickedAt:轮换游标(最久未用优先)
 */
export const aiRelayProxyPool = pgTable(
  'ai_relay_proxy_pool',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 代理地址(如 http://user:pass@ip:port,全池唯一) */
    proxyUrl: text('proxy_url').notNull(),
    /** 限定平台(可空 = 不限平台共享) */
    providerCode: varchar('provider_code', { length: 64 }),
    /** 状态:active / exhausted / dead */
    status: varchar('status', { length: 16 }).default('active').notNull(),
    /** 连续失败次数(成功即清零,达阈值 → exhausted) */
    failCount: integer('fail_count').default(0).notNull(),
    /** 最近一次活性检测/失败上报时刻(活性检测留接口,不强制外网探测) */
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    /** 绑定账号(非空则该代理仅供该账号;null = 共享轮换) */
    boundAccountId: uuid('bound_account_id'),
    /** 轮换游标(取用最久未用,避免单代理打爆) */
    lastPickedAt: timestamp('last_picked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    proxyUrlUniq: unique('ai_relay_proxy_pool_proxy_url_unique').on(t.proxyUrl),
    statusIdx: index('ai_relay_proxy_pool_status_idx').on(t.status),
  }),
)

/**
 * 中转站动态发现待审批表 (ai_relay_discovery)。
 *
 * P0-5c(2026-07-29 立):从上游 provider 拉取新模型 → 待审批 → 入库上架。
 * - status: pending(待审批)/ approved(已通过,已写入 aiModelConfigModels)/ rejected(已驳回)/ discovered(刚发现,等待人工触发审批)
 * - upstreamPrice:上游定价快照(JSON,如 { input: 0.5, output: 1.5, currency: 'CNY' })
 * - reviewedBy:审批人 user id(可空,系统自动通过时为 NULL)
 */
export const aiRelayDiscovery = pgTable(
  'ai_relay_discovery',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 来源 provider 编码(如 'stepfun' / 'openrouter') */
    providerCode: varchar('provider_code', { length: 64 }).notNull(),
    /** 上游模型 id(原始 model id,如 'step-3.7-flash') */
    modelId: varchar('model_id', { length: 128 }).notNull(),
    /** 模型展示名(上游返回的 name) */
    modelName: varchar('model_name', { length: 256 }),
    /** 上下文长度(上游返回) */
    contextLength: integer('context_length'),
    /** 上游定价快照(JSON,如 { input: 0.5, output: 1.5, currency: 'CNY' }) */
    upstreamPrice: jsonb('upstream_price'),
    /** 上游返回的能力标签(JSON array,如 ['chat', 'vision', 'tools']) */
    capabilities: jsonb('capabilities').default([]),
    /** 上游返回的描述 */
    description: text('description'),
    /** 状态:discovered / pending / approved / rejected */
    status: varchar('status', { length: 16 }).default('discovered').notNull(),
    /** 审批人 user id(可空) */
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    /** 驳回原因 / 审批备注 */
    reviewNote: text('review_note'),
    /** 审批通过后写入 aiModelConfigModels 的 id(关联追溯) */
    approvedModelRowId: bigint('approved_model_row_id', { mode: 'number' }),
    /** 原始上游 metadata(完整保留,用于审批参考) */
    rawMetadata: jsonb('raw_metadata').default({}),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerIdx: index('ai_relay_discovery_provider_idx').on(t.providerCode),
    statusIdx: index('ai_relay_discovery_status_idx').on(t.status),
    providerModelUniq: unique('ai_relay_discovery_provider_model_unique').on(
      t.providerCode,
      t.modelId,
    ),
  }),
)

export type AiRelayKeyPool = typeof aiRelayKeyPool.$inferSelect
export type NewAiRelayKeyPool = typeof aiRelayKeyPool.$inferInsert
export type AiRelayAccountPool = typeof aiRelayAccountPool.$inferSelect
export type NewAiRelayAccountPool = typeof aiRelayAccountPool.$inferInsert
export type AiRelayAccountUsageLedger = typeof aiRelayAccountUsageLedger.$inferSelect
export type NewAiRelayAccountUsageLedger = typeof aiRelayAccountUsageLedger.$inferInsert
export type AiRelayModelCatalog = typeof aiRelayModelCatalog.$inferSelect
export type NewAiRelayModelCatalog = typeof aiRelayModelCatalog.$inferInsert
export type AiRelayProxyPool = typeof aiRelayProxyPool.$inferSelect
export type NewAiRelayProxyPool = typeof aiRelayProxyPool.$inferInsert
export type AiRelayDiscovery = typeof aiRelayDiscovery.$inferSelect
export type NewAiRelayDiscovery = typeof aiRelayDiscovery.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
