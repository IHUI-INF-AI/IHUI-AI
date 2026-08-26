/**
 * Telegram Bot Provider(非标准 OAuth2,走 Bot deeplink 模式)。
 *
 * 流程:
 * 1. 前端 POST /auth/oauth/telegram/start → 后端生成 authToken(CSPRNG,5min TTL)
 * 2. 后端返回 deeplink `https://t.me/<bot_username>?start=<authToken>`
 * 3. 用户在 Telegram 中点击 deeplink → Bot 收到 /start <authToken> 命令
 * 4. Bot 调 Telegram API 获取用户信息 → 调 saveAuthResult 写入 authToken → 用户映射
 * 5. 前端轮询 POST /auth/oauth/telegram/verify → 拿到用户信息 → 登录/建用户 → 颁发 token
 *
 * 存储方案:进程内 Map + TTL(同 auth-extended.ts 的 deviceCodeStore 模式)。
 * 主 agent 后续如需多实例部署,迁移到 Redis(key: `telegram:auth:<authToken>`)。
 *
 * ⚠️ Bot webhook 集成由主 agent 后续完成:接收 /start <authToken> 命令后,
 *    调 getTelegramBotInfo(authToken) 拿到 Bot 信息,再调 saveAuthResult 写入映射。
 *
 * 重放防护(2026-08-26 安全修复):
 * - 时效校验:authToken 写入后仅 authTokenTtlMs(默认 5min,早于行业建议的 10min 上限)
 *   内有效,过期即拒绝 —— 截获的 token 重放窗口被限制在 TTL 内。
 * - 一次性使用:verifyAuth 首次成功即消费 token 并进入已用去重缓存(consumedAuthTokens),
 *   后续重放一律返回 null;saveAuthResult 对已消费 token 静默拒绝(不复活)。
 * - TTL 不可刷新:saveAuthResult 重放同一 token 不延长 expiresAt(取首次写入时间),
 *   防止攻击者通过重放 /start 命令无限续期重放窗口。
 */

import { randomBytes } from 'node:crypto'
import type { TelegramAuthResult, TelegramBotProvider, TelegramUser } from './index.js'

export interface TelegramProviderConfig {
  botToken: string
  botUsername: string
  /** authToken 有效期(毫秒),默认 5 分钟。到期后拒绝校验(防重放窗口过大)。 */
  authTokenTtlMs?: number
  /** 时钟注入(默认 Date.now,测试用,便于模拟时间推进验证时效边界)。 */
  now?: () => number
}

/** authToken → TelegramUser 映射(进程内,TTL 由 authTokenTtlMs 决定) */
const telegramAuthStore = new Map<string, { telegramUser: TelegramUser; expiresAt: number }>()

/** 已消费 authToken → 过期时间(一次性使用去重缓存,防止 verifyAuth 重放) */
const consumedAuthTokens = new Map<string, number>()

const TELEGRAM_AUTH_TTL_MS = 5 * 60 * 1000

/**
 * 模块级配置:apps/api 每个请求都 createTelegramProvider 新实例,
 * 但 saveAuthResult(Bot webhook)与 verifyAuth(前端轮询)跨请求共享同一 store,
 * 因此 TTL 与时钟必须是模块级单例。
 */
let authTokenTtlMs = TELEGRAM_AUTH_TTL_MS
let nowFn: () => number = Date.now

/** 定期清理过期项(同 deviceCodeStore 的惰性清理模式) */
function cleanupExpired(): void {
  const now = nowFn()
  for (const [key, value] of telegramAuthStore) {
    if (now > value.expiresAt) telegramAuthStore.delete(key)
  }
  for (const [key, expiresAt] of consumedAuthTokens) {
    if (now > expiresAt) consumedAuthTokens.delete(key)
  }
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME)
}

export function createTelegramProvider(config: TelegramProviderConfig): TelegramBotProvider {
  authTokenTtlMs = config.authTokenTtlMs ?? TELEGRAM_AUTH_TTL_MS
  nowFn = config.now ?? Date.now

  return {
    name: 'telegram',
    botToken: config.botToken,
    botUsername: config.botUsername,

    getBotAuthUrl(authToken: string): string {
      return `https://t.me/${config.botUsername}?start=${authToken}`
    },

    async saveAuthResult(authToken: string, telegramUser: TelegramUser): Promise<void> {
      cleanupExpired()
      // 已消费 token 静默拒绝:verifyAuth 已用过的 token 不允许通过重放 /start 复活
      if (consumedAuthTokens.has(authToken)) return
      const existing = telegramAuthStore.get(authToken)
      telegramAuthStore.set(authToken, {
        telegramUser,
        // 保留首次写入的 expiresAt:重放 /start 不得延长重放窗口
        expiresAt: existing?.expiresAt ?? nowFn() + authTokenTtlMs,
      })
    },

    async verifyAuth(authToken: string): Promise<TelegramAuthResult | null> {
      cleanupExpired()
      // 一次性使用:已消费 token 直接拒绝(防截获 token 在 TTL 内重放登录)
      if (consumedAuthTokens.has(authToken)) return null
      const entry = telegramAuthStore.get(authToken)
      if (!entry) return null
      if (nowFn() > entry.expiresAt) {
        telegramAuthStore.delete(authToken)
        return null
      }
      // 消费 token:移出待验证 store,进入已用去重缓存(缓存至原 expiresAt)
      telegramAuthStore.delete(authToken)
      consumedAuthTokens.set(authToken, entry.expiresAt)
      const u = entry.telegramUser
      const nickname = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username
      return {
        telegramUser: u,
        openId: String(u.id),
        nickname: nickname || `Telegram用户${String(u.id).slice(-4)}`,
        avatar: u.photo_url,
      }
    },
  }
}

/**
 * 生成 Telegram 登录 authToken(CSPRNG 32 字节 hex,5min TTL)。
 * 由 /auth/oauth/telegram/start 端点调用。
 */
export function generateTelegramAuthToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * 调用 Telegram Bot API 获取用户信息(Bot 接收 /start 命令时使用)。
 * 主 agent 后续在 Bot webhook 集成中调用此函数。
 *
 * @param botToken Bot Token(从 TELEGRAM_BOT_TOKEN 读取)
 * @param fromId Telegram 用户 ID(由 /start 命令的 message.from.id 提供)
 */
export async function fetchTelegramUser(
  botToken: string,
  fromId: number,
): Promise<TelegramUser | null> {
  // Telegram Bot API: getChat 仅适用于已与 Bot 交互过的用户
  // /start 命令本身就是用户与 Bot 的首次交互,message.from 已包含用户信息
  // 此函数作为辅助工具,主 agent 后续集成时可直接用 message.from 而无需额外 API 调用
  void botToken
  void fromId
  return null
}
