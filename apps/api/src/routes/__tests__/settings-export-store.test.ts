// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]: F-41 回归夹具。

/**
 * F-41 回归(2026-11-08):导出内容只在「下载时」删当前任务,未下载的过期正文永久驻留内存。
 *
 * 改前必红口径(按内存表里的 key 断言):
 *  - 第一次导出写入 t1,手工把它的 expiresAt 拨到过期;
 *  - 第二次导出写入 t2;
 *  - 旧代码:Map 里同时留着 ['t1','t2'],过期正文无人回收;
 *  - 新代码:写入前清扫过期项,只剩 ['t2']。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(32)
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
  process.env.NODE_ENV = 'test'
})

const { createExportTaskMock } = vi.hoisted(() => ({
  createExportTaskMock: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
  },
}))

vi.mock('../../db/export-tasks-queries.js', () => ({
  createExportTask: createExportTaskMock,
  findLatestExportTask: vi.fn().mockResolvedValue(null),
  completeExportTask: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../db/user-preferences-queries.js', () => ({
  findUserPreferences: vi.fn().mockResolvedValue({ list: [] }),
  upsertUserPreference: vi.fn(),
  deleteUserPreferencesByGroup: vi.fn(),
  deleteUserPreference: vi.fn(),
  USER_PREFERENCE_GROUPS: { notifications: 'notifications', privacy: 'privacy', preferences: 'preferences' },
}))

vi.mock('../../db/learn-queries.js', () => ({
  findMyLessons: vi.fn().mockResolvedValue({ list: [] }),
}))

vi.mock('../../db/queries.js', () => ({
  isSystemAdminUser: vi.fn().mockResolvedValue(false),
  findUserById: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../db/security-logs-queries.js', () => ({ findSecurityLogs: vi.fn().mockResolvedValue({ list: [] }) }))
vi.mock('../../db/authorizations-queries.js', () => ({
  findActiveSessions: vi.fn().mockResolvedValue({ list: [] }),
  revokeSession: vi.fn(),
}))
vi.mock('../../services/purge-user-pii.js', () => ({ purgeUserPii: vi.fn() }))
vi.mock('../../services/sms-notify.js', () => ({ sendNoticeSmsToPhone: vi.fn() }))
vi.mock('../../services/raw-retention-optout.js', () => ({ setRawRetentionOptOut: vi.fn() }))
vi.mock('../../services/code-index-egress-consent.js', () => ({ setCodeIndexEgressOptOut: vi.fn() }))

import settingsRoutes, { exportContentStore } from '../user/settings-routes.js'

describe('F-41 导出正文内存缓存必须随过期回收', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorateRequest('userId', null)
    app.addHook('preHandler', async (request) => {
      request.userId = 'u1'
    })
    await app.register(settingsRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('第二次导出前清理已过期的 t1,Map 里只剩 t2', async () => {
    let seq = 0
    createExportTaskMock.mockImplementation(async () => {
      seq += 1
      return { id: `t${seq}`, status: 'completed' }
    })

    exportContentStore.clear()

    const first = await app.inject({ method: 'POST', url: '/settings/export' })
    expect(first.statusCode).toBe(200)
    expect([...exportContentStore.keys()]).toEqual(['t1'])

    // 拨到过期（模拟 1 小时 TTL 已走完且用户没来下载）
    exportContentStore.get('t1')!.expiresAt = new Date(Date.now() - 1_000)

    const second = await app.inject({ method: 'POST', url: '/settings/export' })
    expect(second.statusCode).toBe(200)
    expect([...exportContentStore.keys()]).toEqual(['t2'])
  })
})
