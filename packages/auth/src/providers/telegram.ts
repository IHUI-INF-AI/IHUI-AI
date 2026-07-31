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
 */

import { randomBytes } from 'node:crypto'
import type { TelegramAuthResult, TelegramBotProvider, TelegramUser } from './index.js'

export interface TelegramProviderConfig {
  botToken: string
  botUsername: string
}

/** authToken → TelegramUser 映射(进程内,5min TTL) */
const telegramAuthStore = new Map<string, { telegramUser: TelegramUser; expiresAt: number }>()

const TELEGRAM_AUTH_TTL_MS = 5 * 60 * 1000

/** 定期清理过期项(同 deviceCodeStore 的惰性清理模式) */
function cleanupExpired(): void {
  const now = Date.now()
  for (const [key, value] of telegramAuthStore) {
    if (now > value.expiresAt) telegramAuthStore.delete(key)
  }
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME)
}

export function createTelegramProvider(config: TelegramProviderConfig): TelegramBotProvider {
  return {
    name: 'telegram',
    botToken: config.botToken,
    botUsername: config.botUsername,

    getBotAuthUrl(authToken: string): string {
      return `https://t.me/${config.botUsername}?start=${authToken}`
    },

    async saveAuthResult(authToken: string, telegramUser: TelegramUser): Promise<void> {
      cleanupExpired()
      telegramAuthStore.set(authToken, {
        telegramUser,
        expiresAt: Date.now() + TELEGRAM_AUTH_TTL_MS,
      })
    },

    async verifyAuth(authToken: string): Promise<TelegramAuthResult | null> {
      cleanupExpired()
      const entry = telegramAuthStore.get(authToken)
      if (!entry) return null
      if (Date.now() > entry.expiresAt) {
        telegramAuthStore.delete(authToken)
        return null
      }
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
