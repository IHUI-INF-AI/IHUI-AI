// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池授权会话表 (ai_relay_auth_session)。
 *
 * 2026-11-17 立（对标并超越 qoder2api 系开源网关的「免客户端 OAuth 设备授权入池」那一格）。
 *
 * 为什么要有这一张表，而不是把 device code 塞进内存 Map：
 * - 本仓 api 是多实例（blue/green 部署腿）+ 多会话共仓，进程内 Map 会在切流时静默丢会话，
 *   表现为「用户扫了码，池子里啥也没进来」——这是最难查的一型失效（安静）。
 * - 会话本身即审计对象：谁发起、上游怎么裁决、慢速退避了几次、最终落到哪一行号池，
 *   事后必须查得到（对齐 AGENTS §5e「量到的必须是身份」与 §0.3「没判不许写成判过」）。
 *
 * 安全口径（照 RFC 8628 §1.5 / §5.2 与本仓 utils/crypto 既有纪律）：
 * - device_code / 换到的票都属 **bearer 凭据** ⇒ 一律 encryptField 落 bearer_secret_enc，
 *   密文带 `v0`/`v1` 形态标签（把手与票不会互相冒充为对方的形态），明文只活在一次请求内；
 * - user_code 不是机密（它会出现在屏幕上，也进上游的二次通道），保持明文供对账；
 * - 授权成功换到的票**不在本表长期驻留**：只留 cred_fingerprint（sha256 前 16，不可逆）与
 *   account_id 指针，票据本体走 importAccounts 唯一入池通道（AGENTS §0.6：判据与落库只许一份实现）；
 *   入池失败时票才暂留（authorized），供人重试收尾而无需重新授权一轮。
 */
import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  text,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * 一次授权会话的四种发起形态（kind）与六种终局（status）的唯一声明位。
 *
 * - device_flow: RFC 8628 设备码流（服务端可对任意支持该标准上游发起）
 * - pat: 个人访问令牌直贴（qoder SDK 通路只认 PAT，见 scripts/qoder-sdk-chat-probe.mjs 实证）
 * - redirect_pkce: 授权码 + PKCE 回环（保留档位；接线前置 = 该上游 callback 面已实证）
 * - cookie_exchange: 浏览器 Cookie 换票（网页一键重登已有独立通道，这里是机读预留）
 */
export const AUTH_SESSION_KINDS = [
  'device_flow',
  'pat',
  'redirect_pkce',
  'cookie_exchange',
] as const
export type AuthSessionKind = (typeof AUTH_SESSION_KINDS)[number]

/**
 * 状态语义（每一档都有唯一可达路径，判据住 relay-auth-session-service.ts）：
 * - pending:    已发起，等人在别的设备上授权
 * - authorized: 上游已发票，但票还没成功写进号池（mapper 未就位 / 入池失败都停在这一档，绝不冒 imported）
 * - imported:   终局成功，accountId 已认领号池行
 * - failed:     明确失败（access_denied / mapper 未实证 / 入池被拒…），failureCode 点名是哪一型
 * - expired:    会话寿命到（上游 expired_token，或本表 expiresAt 过点）
 * - cancelled:  人主动撤销（撤销即销毁 device_code 密文）
 */
export const AUTH_SESSION_STATUSES = [
  'pending',
  'authorized',
  'imported',
  'failed',
  'expired',
  'cancelled',
] as const
export type AuthSessionStatus = (typeof AUTH_SESSION_STATUSES)[number]

export const aiRelayAuthSession = pgTable(
  'ai_relay_auth_session',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 与号池同命名空间的 provider 编码（trae/workbuddy/qoder/codearts…） */
    providerCode: varchar('provider_code', { length: 64 }).notNull(),
    /** 发起形态（见 AUTH_SESSION_KINDS 注） */
    kind: varchar('kind', { length: 24 }).$type<AuthSessionKind>().notNull(),
    status: varchar('status', {
      length: 16,
    })
      .$type<AuthSessionStatus>()
      .default('pending')
      .notNull(),
    /**
     * 会话当前持有的 bearer 把手（RFC 8628 §1.5 / §5.2 ⇒ AES-256-GCM 密文）。
     * 两种形态自带前缀标签，绝不会被混读：
     *   `v0\u0000<device_code>`（pending）/ `v1\u0000<access_token>\u0000<refresh_token 可空>`（authorized）。
     * 终局（imported / cancelled / expired / access_denied）一律置 NULL 并记 credential_scrubbed。
     */
    bearerSecretEnc: text('bearer_secret_enc'),
    /** 给人念/输的短码（明文，非机密；RFC 8628 §1.5 的 user_code） */
    userCode: varchar('user_code', { length: 64 }),
    /** 验证入口（用户要打开的站点） */
    verificationUri: text('verification_uri'),
    /** 已带 user_code 的完整链接，能一键打开就用它（上游没给则为 NULL，由前端按 RFC 拼） */
    verificationUriComplete: text('verification_uri_complete'),
    /** 上游建议的轮询间隔（秒）；slow_down 时按 +5s 递增并回写（RFC 8628 §3.5） */
    intervalSeconds: integer('interval_seconds').default(5).notNull(),
    /** 下一次允许轮询的最早时刻（退避闸门，防止把上游打出 authorization_pending 洪水） */
    nextPollAt: timestamp('next_poll_at', { withTimezone: true }),
    /** 累计轮询次数（观测上游耐心与异常重试风暴） */
    pollAttempts: integer('poll_attempts').default(0).notNull(),
    /** 会话寿命截止（取上游 expires_in，缺省 15 分钟）；过期后轮询一律 expired，不再打上游 */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** 失败归因（access_denied / expired_token / slow_down / mapper_unverified / import_rejected…） */
    failureCode: varchar('failure_code', { length: 64 }),
    /** 失败说明（人话，**恒不含** device_code / 票明文） */
    failureMessage: text('failure_message'),
    /** 号池归属：NULL = 运营池（与 ai_relay_account_pool.owner_user_id 同语义） */
    ownerUserId: varchar('owner_user_id', { length: 64 }),
    /** 发起人（admin user id，明文非敏感；系统发起 = NULL） */
    requestedBy: varchar('requested_by', { length: 128 }),
    /** 发起面（admin-pool / ops-cli / api / scheduler…），审计用 */
    scene: varchar('scene', { length: 64 }),
    /** 终局指向的号池行（ai_relay_account_pool.id），**刻意不做外键**：号池行可被删，审计行不能跟着消失 */
    accountId: uuid('account_id'),
    /** sha256(凭证) 前 16 位：事后「这把票是不是那把票」可对账，凭据本身不出库 */
    credFingerprint: varchar('cred_fingerprint', { length: 16 }),
    /** 上游返回的非敏感声明（scope / 登录账号掩码等），仅审计展示 */
    upstreamMetadata: jsonb('upstream_metadata'),
    /** 终局已销毁 device_code 密文（撤销/失败即 scrub，防事后拖库拿到活把手） */
    credentialScrubbed: boolean('credential_scrubbed').default(false).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerStatusIdx: index('ai_relay_auth_session_provider_status_idx').on(
      t.providerCode,
      t.status,
    ),
    /** 轮询扫描腿唯一取数面：只认「还在等 + 到点了」的行，绝不全表拉 */
    pendingPollIdx: index('ai_relay_auth_session_pending_poll_idx')
      .on(t.status, t.nextPollAt)
      .where(sql`${t.status} = 'pending'`),
    accountIdx: index('ai_relay_auth_session_account_idx').on(t.accountId),
    expiresIdx: index('ai_relay_auth_session_expires_idx').on(t.expiresAt),
  }),
)

export type AiRelayAuthSession = typeof aiRelayAuthSession.$inferSelect
export type NewAiRelayAuthSession = typeof aiRelayAuthSession.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
