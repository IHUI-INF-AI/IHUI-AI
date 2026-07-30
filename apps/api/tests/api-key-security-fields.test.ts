/**
 * P0-7 API Key 安全粒度字段测试(2026-07-31 立)。
 *
 * 覆盖 4 个检查函数:
 * - checkExpiresAt:null 通过 / 未来通过 / 过期拒绝
 * - checkAllowedIps:null 通过 / 空数组通过 / IP 匹配通过 / IP 不匹配拒绝 / CIDR 前缀匹配
 * - checkAllowedModels:null 通过 / 空数组通过 / 精确匹配 / 通配符 gpt-* 匹配 / 不匹配拒绝
 * - checkMaxTokensPerReq:null 通过 / 超限拒绝 / 未超限通过
 */
import { describe, it, expect, vi } from 'vitest'

// Mock 依赖模块(避免实际 DB 连接)
vi.mock('../src/db/index.js', () => ({
  db: { update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ catch: vi.fn() })) })) })) },
  dbRead: { select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => []) })) })) })) },
}))

vi.mock('@ihui/database', () => ({
  developerApiKeys: {
    id: 'id',
    key: 'key',
    status: 'status',
    secret: 'secret',
    userId: 'user_id',
    permissions: 'permissions',
    rateLimit: 'rate_limit',
    expiresAt: 'expires_at',
    allowedIps: 'allowed_ips',
    allowedModels: 'allowed_models',
    maxTokensPerReq: 'max_tokens_per_req',
    lastUsedAt: 'last_used_at',
  },
}))

vi.mock('../src/utils/api-key-hash.js', () => ({
  verifySecret: vi.fn(() => true),
  generateApiKey: vi.fn(() => ({ key: 'ihui_test', secret: 'sk_test' })),
  hashSecret: vi.fn(() => 'hashed'),
}))

vi.mock('../src/utils/api-key-quota.js', () => ({
  ApiKeyQuota: vi.fn(() => ({
    checkAndConsume: vi.fn(() => ({ allowed: true, resetAt: new Date() })),
  })),
  DEFAULT_HOURLY_LIMIT: 1000,
  DEFAULT_DAILY_LIMIT: 10000,
}))

import {
  checkExpiresAt,
  checkAllowedIps,
  checkAllowedModels,
  checkMaxTokensPerReq,
  ipInList,
  modelInList,
} from '../src/plugins/api-key-auth.js'

describe('P0-7 API Key 安全粒度字段', () => {
  // ===== checkExpiresAt =====
  describe('checkExpiresAt — 过期检查', () => {
    it('null(永不过期)通过', () => {
      const result = checkExpiresAt(null)
      expect(result.ok).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('未来时间通过', () => {
      const future = new Date(Date.now() + 3600_000) // 1 小时后
      const result = checkExpiresAt(future)
      expect(result.ok).toBe(true)
    })

    it('已过期拒绝', () => {
      const past = new Date(Date.now() - 3600_000) // 1 小时前
      const result = checkExpiresAt(past)
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('API Key 已过期')
    })

    it('注入 now 参数便于测试边界', () => {
      const expiresAt = new Date('2026-12-31T23:59:59Z')
      const beforeExpiry = new Date('2026-06-01T00:00:00Z')
      const afterExpiry = new Date('2027-01-01T00:00:00Z')
      expect(checkExpiresAt(expiresAt, beforeExpiry).ok).toBe(true)
      expect(checkExpiresAt(expiresAt, afterExpiry).ok).toBe(false)
    })
  })

  // ===== checkAllowedIps =====
  describe('checkAllowedIps — IP 白名单检查', () => {
    it('null(不限制)通过', () => {
      expect(checkAllowedIps(null, '1.2.3.4').ok).toBe(true)
    })

    it('空数组(不限制)通过', () => {
      expect(checkAllowedIps([], '1.2.3.4').ok).toBe(true)
    })

    it('精确 IP 匹配通过', () => {
      expect(checkAllowedIps(['192.168.1.1'], '192.168.1.1').ok).toBe(true)
    })

    it('IP 不匹配拒绝', () => {
      const result = checkAllowedIps(['192.168.1.1'], '10.0.0.1')
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('IP 不在白名单')
    })

    it('前缀匹配(尾点)通过', () => {
      expect(checkAllowedIps(['192.168.'], '192.168.1.100').ok).toBe(true)
      expect(checkAllowedIps(['192.168.'], '192.168.0.50').ok).toBe(true)
    })

    it('CIDR /24 匹配通过', () => {
      expect(checkAllowedIps(['10.0.0.0/24'], '10.0.0.100').ok).toBe(true)
      expect(checkAllowedIps(['10.0.0.0/24'], '10.0.0.255').ok).toBe(true)
    })

    it('CIDR /24 不匹配拒绝', () => {
      expect(checkAllowedIps(['10.0.0.0/24'], '10.0.1.1').ok).toBe(false)
    })

    it('CIDR /16 匹配通过', () => {
      expect(checkAllowedIps(['172.16.0.0/16'], '172.16.5.10').ok).toBe(true)
      expect(checkAllowedIps(['172.16.0.0/16'], '172.17.5.10').ok).toBe(false)
    })

    it('多 IP 白名单任一匹配通过', () => {
      expect(checkAllowedIps(['192.168.1.1', '10.0.0.0/8'], '10.1.2.3').ok).toBe(true)
    })
  })

  // ===== checkAllowedModels =====
  describe('checkAllowedModels — 模型白名单检查', () => {
    it('null(不限制)通过', () => {
      expect(checkAllowedModels(null, 'gpt-4').ok).toBe(true)
    })

    it('空数组(不限制)通过', () => {
      expect(checkAllowedModels([], 'gpt-4').ok).toBe(true)
    })

    it('精确匹配通过', () => {
      expect(checkAllowedModels(['gpt-4o'], 'gpt-4o').ok).toBe(true)
    })

    it('通配符 gpt-* 匹配 gpt-4 通过', () => {
      expect(checkAllowedModels(['gpt-*'], 'gpt-4').ok).toBe(true)
    })

    it('通配符 gpt-* 匹配 gpt-4o-mini 通过', () => {
      expect(checkAllowedModels(['gpt-*'], 'gpt-4o-mini').ok).toBe(true)
    })

    it('通配符 gpt-* 匹配 gpt-3.5-turbo 通过', () => {
      expect(checkAllowedModels(['gpt-*'], 'gpt-3.5-turbo').ok).toBe(true)
    })

    it('不匹配拒绝', () => {
      const result = checkAllowedModels(['gpt-*'], 'claude-3-opus')
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('模型不在白名单')
    })

    it('body 无 model(undefined)跳过检查通过', () => {
      expect(checkAllowedModels(['gpt-*'], undefined).ok).toBe(true)
    })

    it('多模型白名单精确+通配符混合', () => {
      const allowed = ['gpt-4', 'claude-*', 'gemini-1.5-pro']
      expect(checkAllowedModels(allowed, 'gpt-4').ok).toBe(true)
      expect(checkAllowedModels(allowed, 'claude-3-opus').ok).toBe(true)
      expect(checkAllowedModels(allowed, 'gemini-1.5-pro').ok).toBe(true)
      expect(checkAllowedModels(allowed, 'llama-3').ok).toBe(false)
    })
  })

  // ===== checkMaxTokensPerReq =====
  describe('checkMaxTokensPerReq — 单次请求 token 上限检查', () => {
    it('null(不限制)通过', () => {
      expect(checkMaxTokensPerReq(null, 999999).ok).toBe(true)
    })

    it('超限拒绝', () => {
      const result = checkMaxTokensPerReq(4096, 8192)
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('超过单次请求 token 上限')
    })

    it('未超限通过', () => {
      expect(checkMaxTokensPerReq(8192, 4096).ok).toBe(true)
    })

    it('恰好等于上限通过', () => {
      expect(checkMaxTokensPerReq(4096, 4096).ok).toBe(true)
    })
  })

  // ===== 辅助函数直接测试 =====
  describe('ipInList — IP 匹配辅助函数', () => {
    it('精确匹配', () => {
      expect(ipInList('1.1.1.1', ['1.1.1.1'])).toBe(true)
      expect(ipInList('1.1.1.1', ['2.2.2.2'])).toBe(false)
    })

    it('前缀匹配(尾点)', () => {
      expect(ipInList('192.168.1.1', ['192.168.'])).toBe(true)
      expect(ipInList('192.169.1.1', ['192.168.'])).toBe(false)
    })

    it('CIDR /32 等价于精确匹配', () => {
      expect(ipInList('10.0.0.1', ['10.0.0.1/32'])).toBe(true)
      expect(ipInList('10.0.0.2', ['10.0.0.1/32'])).toBe(false)
    })

    it('CIDR /8 匹配整个 A 类网段', () => {
      expect(ipInList('10.255.255.255', ['10.0.0.0/8'])).toBe(true)
      expect(ipInList('11.0.0.1', ['10.0.0.0/8'])).toBe(false)
    })
  })

  describe('modelInList — 模型匹配辅助函数', () => {
    it('精确匹配', () => {
      expect(modelInList('gpt-4', ['gpt-4'])).toBe(true)
      expect(modelInList('gpt-4o', ['gpt-4'])).toBe(false)
    })

    it('通配符后缀匹配', () => {
      expect(modelInList('gpt-4o-mini', ['gpt-*'])).toBe(true)
      expect(modelInList('gpt-3.5-turbo', ['gpt-*'])).toBe(true)
      expect(modelInList('claude-3', ['gpt-*'])).toBe(false)
    })

    it('通配符匹配中间段', () => {
      expect(modelInList('gpt-4-0613', ['gpt-4*'])).toBe(true)
      expect(modelInList('gpt-4o', ['gpt-4*'])).toBe(true)
    })
  })
})
