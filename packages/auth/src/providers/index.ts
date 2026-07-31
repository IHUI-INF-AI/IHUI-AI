/**
 * 4 个社交登录 Provider(OIDC + Discord + LinuxDO + Telegram)。
 *
 * 设计目标:补齐 New API 已有但 IHUI-AI 缺失的 4 种登录方式,与现有 8 平台
 * (google/apple/dingtalk/enterpriseWechat/wechat/feishu/github/alipay)并列。
 *
 * 后端集成位置:apps/api/src/routes/auth-extended.ts
 * (主 agent 后续在 routes/index.ts 已注册 auth-extended 自动生效,无需额外注册)
 *
 * 数据库:复用现有 userThirdPartyAccounts 表(oauth-queries.ts 的
 * findThirdPartyAccount/createThirdPartyBinding 已支持任意 platform: string)。
 * 主 agent 后续如需独立 oauth_accounts 表再迁移。
 */

export interface OAuthProviderConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface OAuthTokenResponse {
  accessToken: string
  refreshToken?: string
  tokenType: string
  expiresIn?: number
}

export interface OAuthUserInfo {
  openId: string
  unionId?: string
  nickname?: string
  avatar?: string
  email?: string
}

/**
 * 统一 OAuth2 Provider 接口(OIDC/Discord/LinuxDO 实现)。
 * Telegram 走 Bot 模式,不实现此接口(见 TelegramBotProvider)。
 */
export interface OAuthProvider {
  name: string
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]

  /** 构造授权 URL(含 state CSRF 防护)。返回 Promise 因 OIDC 需异步 discover endpoints */
  getAuthorizationUrl(state: string): Promise<string>
  /** 用授权码换 access_token */
  exchangeCodeForToken(code: string): Promise<OAuthTokenResponse>
  /** 用 access_token 拉取用户信息 */
  fetchUserInfo(accessToken: string): Promise<OAuthUserInfo>
}

// Telegram Bot 模式专用类型 -----------------------------------------------

export interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

/** Telegram Bot 验证结果(由 Bot /start 命令回写,verify 端点读取) */
export interface TelegramAuthResult {
  telegramUser: TelegramUser
  openId: string
  nickname?: string
  avatar?: string
}

/**
 * Telegram Bot Provider 接口。
 *
 * Telegram 不走标准 OAuth2,而是用 Bot deeplink 模式:
 * 1. 前端调 /auth/oauth/telegram/start → 后端生成 authToken(5min JWT/随机串)
 * 2. 后端返回 deeplink `https://t.me/<bot_username>?start=<authToken>`
 * 3. 用户在 Telegram 中点击 deeplink → Bot 收到 /start <authToken> 命令
 * 4. Bot 调 Telegram API 获取用户信息 → 写入 authToken → userId 映射(内存/Redis)
 * 5. 前端轮询 /auth/oauth/telegram/verify → 拿到用户信息 → 登录/建用户 → 颁发 token
 *
 * ⚠️ Bot webhook 集成由主 agent 后续完成(本 provider 提供 saveAuthResult 接口供 Bot 调用)。
 */
export interface TelegramBotProvider {
  name: 'telegram'
  botToken: string
  botUsername: string

  /** 构造 Bot 授权 deeplink */
  getBotAuthUrl(authToken: string): string
  /** Bot 接收到 /start 命令后调用:写入 authToken → 用户信息映射(5min TTL) */
  saveAuthResult(authToken: string, telegramUser: TelegramUser): Promise<void>
  /** 前端轮询:读取 authToken 对应的用户信息(无则返回 null) */
  verifyAuth(authToken: string): Promise<TelegramAuthResult | null>
}

export {
  createOidcProvider,
  isOidcConfigured,
  buildOidcAuthorizationUrl,
  type OidcProviderConfig,
} from './oidc.js'
export {
  createDiscordProvider,
  isDiscordConfigured,
  type DiscordProviderConfig,
} from './discord.js'
export {
  createLinuxdoProvider,
  isLinuxdoConfigured,
  type LinuxdoProviderConfig,
} from './linuxdo.js'
export {
  createTelegramProvider,
  isTelegramConfigured,
  generateTelegramAuthToken,
  type TelegramProviderConfig,
} from './telegram.js'
