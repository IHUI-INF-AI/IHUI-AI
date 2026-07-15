import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    API_LOG_ENABLED: false,
  },
}))
vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {},
  dbClient: {},
}))
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
  requireActiveUser: vi.fn(),
  default: vi.fn(),
}))

import aiCostDefault, {
  getCachedPrompt,
  setCachedPrompt,
  clearPromptCache,
  checkBudget,
  recordAiCost,
} from '../src/plugins/ai-cost.js'
import businessMetricsDefault, { BizTimer } from '../src/plugins/business-metrics.js'
import compressionDefault from '../src/plugins/compression.js'
import logSanitizerDefault from '../src/plugins/log-sanitizer.js'
import apiVersioningDefault from '../src/plugins/api-versioning.js'
import apiLoggerDefault from '../src/plugins/api-logger.js'
import apiLoggerExtendedDefault from '../src/plugins/api-logger-extended.js'
import auditDefault from '../src/plugins/audit.js'
import tenantDefault, { resolveTenantIdentifier, isPublicPath } from '../src/plugins/tenant.js'
import { SCHEDULER_QUEUE_NAME, SCHEDULED_JOBS, scheduler } from '../src/plugins/scheduler.js'

describe('plugins smoke 测试', () => {
  describe('ai-cost — AI 成本与缓存', () => {
    it('导出存在且模块可加载', () => {
      expect(getCachedPrompt).toBeDefined()
      expect(setCachedPrompt).toBeDefined()
      expect(clearPromptCache).toBeDefined()
      expect(checkBudget).toBeDefined()
      expect(recordAiCost).toBeDefined()
      expect(aiCostDefault).toBeDefined()
      expect(typeof getCachedPrompt).toBe('function')
      expect(typeof setCachedPrompt).toBe('function')
      expect(typeof clearPromptCache).toBe('function')
      expect(typeof checkBudget).toBe('function')
      expect(typeof recordAiCost).toBe('function')
      expect(typeof aiCostDefault).toBe('function')
    })

    it('getCachedPrompt 缓存为空时返回 null', () => {
      expect(getCachedPrompt('empty-key')).toBeNull()
    })

    it('setCachedPrompt 不抛错', () => {
      expect(() => setCachedPrompt('test', { data: 1 })).not.toThrow()
    })

    it('getCachedPrompt 命中缓存返回数据', () => {
      setCachedPrompt('hit-key', { data: 1 })
      expect(getCachedPrompt('hit-key')).toEqual({ data: 1 })
    })

    it('clearPromptCache 清空后返回 null', () => {
      setCachedPrompt('clear-key', { data: 2 })
      clearPromptCache()
      expect(getCachedPrompt('clear-key')).toBeNull()
    })
  })

  describe('business-metrics — 业务指标', () => {
    it('导出存在且模块可加载', () => {
      expect(BizTimer).toBeDefined()
      expect(businessMetricsDefault).toBeDefined()
      expect(typeof BizTimer).toBe('function')
      expect(typeof businessMetricsDefault).toBe('function')
    })

    it('BizTimer 实例化不抛错且有 end 方法', () => {
      const timer = new BizTimer('test-job', () => {})
      expect(typeof timer.end).toBe('function')
    })

    it('BizTimer.end 返回耗时秒数', () => {
      const timer = new BizTimer('test-job', () => {})
      const seconds = timer.end()
      expect(typeof seconds).toBe('number')
      expect(seconds).toBeGreaterThanOrEqual(0)
    })

    it('BizTimer.end 重复调用返回 0', () => {
      const timer = new BizTimer('test-job', () => {})
      timer.end()
      expect(timer.end()).toBe(0)
    })
  })

  describe('compression — 压缩插件', () => {
    it('导出存在且模块可加载', () => {
      expect(compressionDefault).toBeDefined()
      expect(typeof compressionDefault).toBe('function')
    })
  })

  describe('log-sanitizer — 日志脱敏', () => {
    it('导出存在且模块可加载', () => {
      expect(logSanitizerDefault).toBeDefined()
      expect(typeof logSanitizerDefault).toBe('function')
    })
  })

  describe('api-versioning — API 版本控制', () => {
    it('导出存在且模块可加载', () => {
      expect(apiVersioningDefault).toBeDefined()
      expect(typeof apiVersioningDefault).toBe('function')
    })
  })

  describe('api-logger — API 日志', () => {
    it('导出存在且模块可加载', () => {
      expect(apiLoggerDefault).toBeDefined()
      expect(typeof apiLoggerDefault).toBe('function')
    })
  })

  describe('api-logger-extended — ELK 结构化日志', () => {
    it('导出存在且模块可加载', () => {
      expect(apiLoggerExtendedDefault).toBeDefined()
      expect(typeof apiLoggerExtendedDefault).toBe('function')
    })
  })

  describe('audit — 审计日志', () => {
    it('导出存在且模块可加载', () => {
      expect(auditDefault).toBeDefined()
      expect(typeof auditDefault).toBe('function')
    })
  })

  describe('tenant — 多租户', () => {
    it('导出存在且模块可加载', () => {
      expect(resolveTenantIdentifier).toBeDefined()
      expect(isPublicPath).toBeDefined()
      expect(tenantDefault).toBeDefined()
      expect(typeof resolveTenantIdentifier).toBe('function')
      expect(typeof isPublicPath).toBe('function')
      expect(typeof tenantDefault).toBe('function')
    })

    it('isPublicPath 返回 boolean', () => {
      expect(typeof isPublicPath('/api/health')).toBe('boolean')
    })

    it('isPublicPath 公开路径返回 true', () => {
      expect(isPublicPath('/api/health')).toBe(true)
    })

    it('isPublicPath 非公开路径返回 false', () => {
      expect(isPublicPath('/api/users')).toBe(false)
    })

    it('resolveTenantIdentifier 无 header 无子域名返回 null', () => {
      const mockReq = { headers: {}, hostname: 'localhost' } as unknown as Parameters<
        typeof resolveTenantIdentifier
      >[0]
      expect(resolveTenantIdentifier(mockReq)).toBeNull()
    })

    it('resolveTenantIdentifier 有 header 返回 header 值', () => {
      const mockReq = {
        headers: { 'x-tenant-id': 'tenant-123' },
        hostname: 'localhost',
      } as unknown as Parameters<typeof resolveTenantIdentifier>[0]
      expect(resolveTenantIdentifier(mockReq)).toBe('tenant-123')
    })
  })

  describe('scheduler — 定时任务调度器', () => {
    it('导出存在且模块可加载', () => {
      expect(SCHEDULER_QUEUE_NAME).toBeDefined()
      expect(SCHEDULED_JOBS).toBeDefined()
      expect(scheduler).toBeDefined()
    })

    it('SCHEDULER_QUEUE_NAME 是字符串 scheduler', () => {
      expect(typeof SCHEDULER_QUEUE_NAME).toBe('string')
      expect(SCHEDULER_QUEUE_NAME).toBe('scheduler')
    })

    it('SCHEDULED_JOBS 是非空数组', () => {
      expect(Array.isArray(SCHEDULED_JOBS)).toBe(true)
      expect(SCHEDULED_JOBS.length).toBeGreaterThan(0)
    })

    it('scheduler 是函数(fp 插件)', () => {
      expect(typeof scheduler).toBe('function')
    })
  })
})
