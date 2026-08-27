import { describe, it, expect, beforeEach } from 'vitest'
import {
  createTelegramProvider,
  generateTelegramAuthToken,
  type TelegramProviderConfig,
} from '../src/providers/telegram'
import type { TelegramUser } from '../src/providers/index'

const telegramUser: TelegramUser = {
  id: 123456789,
  first_name: 'Li',
  last_name: 'Si',
  username: 'lisi',
}

const TTL_MS = 5 * 60 * 1000

/** 可控时钟(测试注入,模拟时间推进) */
let clockNow = 1_000_000
const clock = (): number => clockNow

function makeProvider(ttlMs?: number) {
  const config: TelegramProviderConfig = {
    botToken: 'test-bot-token',
    botUsername: 'test_bot',
    now: clock,
  }
  if (ttlMs !== undefined) config.authTokenTtlMs = ttlMs
  return createTelegramProvider(config)
}

describe('telegram provider — token 时效与重放防护', () => {
  beforeEach(() => {
    clockNow = 1_000_000
    makeProvider()
  })

  describe('时效校验(防截获 token 重放窗口过大)', () => {
    it('新鲜 authToken:TTL 内 verifyAuth 成功返回用户信息', async () => {
      const provider = makeProvider()
      const token = generateTelegramAuthToken()
      await provider.saveAuthResult(token, telegramUser)
      clockNow += TTL_MS - 1 // 距过期还差 1ms
      const result = await provider.verifyAuth(token)
      expect(result).not.toBeNull()
      expect(result?.openId).toBe('123456789')
      expect(result?.nickname).toBe('Li Si')
    })

    it('过期 authToken:超过 TTL 后 verifyAuth 拒绝(返回 null)', async () => {
      const provider = makeProvider()
      const token = generateTelegramAuthToken()
      await provider.saveAuthResult(token, telegramUser)
      clockNow += TTL_MS + 1
      expect(await provider.verifyAuth(token)).toBeNull()
    })

    it('边界值:now === expiresAt 仍有效,now = expiresAt + 1 拒绝', async () => {
      const provider = makeProvider()
      const tokenA = generateTelegramAuthToken()
      const tokenB = generateTelegramAuthToken()
      await provider.saveAuthResult(tokenA, telegramUser)
      await provider.saveAuthResult(tokenB, telegramUser)
      clockNow += TTL_MS // 恰好到 expiresAt
      expect(await provider.verifyAuth(tokenA)).not.toBeNull()
      clockNow += 1
      expect(await provider.verifyAuth(tokenB)).toBeNull()
    })

    it('TTL 可通过 authTokenTtlMs 配置(自定义 10 分钟窗口)', async () => {
      const provider = makeProvider(10 * 60 * 1000)
      const token = generateTelegramAuthToken()
      await provider.saveAuthResult(token, telegramUser)
      clockNow += 5 * 60 * 1000 + 1 // 超过默认 5min 但在自定义 10min 内
      expect(await provider.verifyAuth(token)).not.toBeNull()
    })

    it('未知 authToken 返回 null', async () => {
      const provider = makeProvider()
      expect(await provider.verifyAuth(generateTelegramAuthToken())).toBeNull()
    })
  })

  describe('一次性使用(防 token 重放)', () => {
    it('verifyAuth 首次成功后,同一 token 再次 verify 返回 null', async () => {
      const provider = makeProvider()
      const token = generateTelegramAuthToken()
      await provider.saveAuthResult(token, telegramUser)
      expect(await provider.verifyAuth(token)).not.toBeNull()
      // 重放(时间未推进,TTL 仍在)也必须被拒绝
      expect(await provider.verifyAuth(token)).toBeNull()
    })

    it('已消费 token 不能通过 saveAuthResult 重放复活', async () => {
      const provider = makeProvider()
      const token = generateTelegramAuthToken()
      await provider.saveAuthResult(token, telegramUser)
      expect(await provider.verifyAuth(token)).not.toBeNull()
      // 攻击者重放 /start 命令重新写入 → 静默拒绝
      await provider.saveAuthResult(token, telegramUser)
      expect(await provider.verifyAuth(token)).toBeNull()
    })

    it('重放 /start(saveAuthResult 重写)不延长 TTL', async () => {
      const provider = makeProvider()
      const token = generateTelegramAuthToken()
      await provider.saveAuthResult(token, telegramUser)
      clockNow += TTL_MS - 60_000 // 剩余 1min 时重放 /start
      await provider.saveAuthResult(token, telegramUser)
      clockNow += 60_000 + 1 // 到达原 expiresAt + 1
      expect(await provider.verifyAuth(token)).toBeNull()
    })

    it('跨 provider 实例共享 store(模拟 Bot 写入与前端轮询分属不同请求)', async () => {
      const token = generateTelegramAuthToken()
      await makeProvider().saveAuthResult(token, telegramUser) // Bot webhook 实例
      const result = await makeProvider().verifyAuth(token) // 前端轮询实例
      expect(result).not.toBeNull()
      expect(result?.openId).toBe('123456789')
    })
  })
})
