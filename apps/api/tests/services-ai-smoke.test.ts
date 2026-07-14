import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }),
        orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  aiCapabilities: {
    id: 'id',
    name: 'name',
    displayName: 'display_name',
    category: 'category',
    provider: 'provider',
    version: 'version',
    description: 'description',
    status: 'status',
    capabilitySchema: 'capability_schema',
    inputExample: 'input_example',
    outputExample: 'output_example',
    avgLatencyMs: 'avg_latency_ms',
    avgCostUsd: 'avg_cost_usd',
    qualityScore: 'quality_score',
    enabled: 'enabled',
    authorId: 'author_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  aiCapabilityTemplates: {
    id: 'id',
    name: 'name',
    category: 'category',
    description: 'description',
    templateSchema: 'template_schema',
    defaultPayload: 'default_payload',
    tags: 'tags',
    isBuiltin: 'is_builtin',
    useCount: 'use_count',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    getJob: vi.fn().mockResolvedValue(null),
    getJobs: vi.fn().mockResolvedValue([]),
    getJobCounts: vi
      .fn()
      .mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
    obliterate: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://localhost:6379', NODE_ENV: 'test' },
}))

import {
  scoreCapability,
  getAllStats,
  getStats,
  leaderboard,
  listToOptimize,
  updateMetrics,
  avgScoreByCategory,
} from '../src/services/ai/ai-capability-analytics.js'
import {
  registerProviderEndpoint,
  pingProvider,
  pingAllProviders,
  listDiscovered,
  groupByProvider,
  groupByCategory,
  refreshHealth,
  findByName,
} from '../src/services/ai/ai-capability-discovery.js'
import {
  generateDoc,
  getDoc,
  listDocVersions,
  generateAllDocs,
  searchDocs,
} from '../src/services/ai/ai-capability-documentation.js'
import {
  searchMarket,
  getMarketHomepage,
  publishToMarket,
  unpublishFromMarket,
  addFavorite,
  removeFavorite,
  listFavorites,
  isFavorite,
  getTopDownloaded,
} from '../src/services/ai/ai-capability-marketplace.js'
import {
  createTemplate,
  getTemplate,
  listTemplates,
  listPopular,
  instantiateTemplate,
  updateTemplate,
  deleteTemplate,
  seedBuiltinTemplates,
} from '../src/services/ai/ai-capability-templates.js'
import {
  registerExecutor,
  generateTestCases,
  runTestCase,
  runTests,
  runBatchTests,
  smokeTestAll,
} from '../src/services/ai/ai-capability-testing.js'
import {
  enqueue,
  getStatus,
  cancel,
  listByUser,
  closeQueue,
  getQueueStats,
} from '../src/services/ai/generation-queue-service.js'

describe('AI 服务 smoke 测试', () => {
  describe('ai-capability-analytics 能力分析', () => {
    it('模块可加载且导出存在', () => {
      expect(scoreCapability).toBeDefined()
      expect(getAllStats).toBeDefined()
      expect(getStats).toBeDefined()
      expect(leaderboard).toBeDefined()
      expect(listToOptimize).toBeDefined()
      expect(updateMetrics).toBeDefined()
      expect(avgScoreByCategory).toBeDefined()
    })

    it('scoreCapability 计算综合评分', () => {
      const result = scoreCapability({ avgLatencyMs: 100, avgCostUsd: 0, qualityScore: 0.9 })
      expect(result).toHaveProperty('latency')
      expect(result).toHaveProperty('cost')
      expect(result).toHaveProperty('quality')
      expect(result).toHaveProperty('overall')
      expect(result.overall).toBeGreaterThanOrEqual(0)
      expect(result.overall).toBeLessThanOrEqual(100)
      expect(result.overall).toBe(96)
    })

    it('scoreCapability 处理 null 值', () => {
      const result = scoreCapability({ avgLatencyMs: null, avgCostUsd: null, qualityScore: null })
      expect(result.overall).toBeGreaterThanOrEqual(0)
      expect(result.overall).toBeLessThanOrEqual(100)
    })
  })

  describe('ai-capability-discovery 能力发现', () => {
    it('模块可加载且导出存在', () => {
      expect(registerProviderEndpoint).toBeDefined()
      expect(pingProvider).toBeDefined()
      expect(pingAllProviders).toBeDefined()
      expect(listDiscovered).toBeDefined()
      expect(groupByProvider).toBeDefined()
      expect(groupByCategory).toBeDefined()
      expect(refreshHealth).toBeDefined()
      expect(findByName).toBeDefined()
    })

    it('registerProviderEndpoint 注册端点不抛错', () => {
      expect(() => registerProviderEndpoint('openai', 'https://api.openai.com')).not.toThrow()
    })
  })

  describe('ai-capability-documentation 能力文档', () => {
    it('模块可加载且导出存在', () => {
      expect(generateDoc).toBeDefined()
      expect(getDoc).toBeDefined()
      expect(listDocVersions).toBeDefined()
      expect(generateAllDocs).toBeDefined()
      expect(searchDocs).toBeDefined()
    })

    it('listDocVersions 返回空数组', () => {
      const result = listDocVersions('nonexistent')
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual([])
    })
  })

  describe('ai-capability-marketplace 能力市场', () => {
    it('模块可加载且导出存在', () => {
      expect(searchMarket).toBeDefined()
      expect(getMarketHomepage).toBeDefined()
      expect(publishToMarket).toBeDefined()
      expect(unpublishFromMarket).toBeDefined()
      expect(addFavorite).toBeDefined()
      expect(removeFavorite).toBeDefined()
      expect(listFavorites).toBeDefined()
      expect(isFavorite).toBeDefined()
      expect(getTopDownloaded).toBeDefined()
    })

    it('addFavorite 收藏不抛错', () => {
      expect(() => addFavorite('user1', 'cap1')).not.toThrow()
    })

    it('isFavorite 返回 boolean', () => {
      expect(typeof isFavorite('user1', 'cap1')).toBe('boolean')
      expect(isFavorite('user1', 'cap1')).toBe(true)
    })

    it('isFavorite 未收藏返回 false', () => {
      expect(isFavorite('user1', 'cap-not-favorited')).toBe(false)
    })
  })

  describe('ai-capability-templates 能力模板', () => {
    it('模块可加载且导出存在', () => {
      expect(createTemplate).toBeDefined()
      expect(getTemplate).toBeDefined()
      expect(listTemplates).toBeDefined()
      expect(listPopular).toBeDefined()
      expect(instantiateTemplate).toBeDefined()
      expect(updateTemplate).toBeDefined()
      expect(deleteTemplate).toBeDefined()
      expect(seedBuiltinTemplates).toBeDefined()
    })
  })

  describe('ai-capability-testing 能力测试', () => {
    it('模块可加载且导出存在', () => {
      expect(registerExecutor).toBeDefined()
      expect(generateTestCases).toBeDefined()
      expect(runTestCase).toBeDefined()
      expect(runTests).toBeDefined()
      expect(runBatchTests).toBeDefined()
      expect(smokeTestAll).toBeDefined()
    })

    it('registerExecutor 注册执行器不抛错', () => {
      expect(() => registerExecutor('cap1', async () => 'ok')).not.toThrow()
    })
  })

  describe('generation-queue-service 生成队列', () => {
    it('模块可加载且导出存在', () => {
      expect(enqueue).toBeDefined()
      expect(getStatus).toBeDefined()
      expect(cancel).toBeDefined()
      expect(listByUser).toBeDefined()
      expect(closeQueue).toBeDefined()
      expect(getQueueStats).toBeDefined()
    })

    it('所有导出为函数', () => {
      expect(typeof enqueue).toBe('function')
      expect(typeof getStatus).toBe('function')
      expect(typeof cancel).toBe('function')
      expect(typeof listByUser).toBe('function')
      expect(typeof closeQueue).toBe('function')
      expect(typeof getQueueStats).toBe('function')
    })
  })
})
