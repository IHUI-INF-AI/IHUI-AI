import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { appVersions } from '@ihui/database'
import appVersionRoutes from '../src/routes/app-version.js'

async function createVersion(data: {
  version: string
  platform: string
  buildNumber: number
  status?: string
  downloadUrl?: string
  forceUpdate?: boolean
  releaseNotes?: string
}) {
  const [row] = await db
    .insert(appVersions)
    .values({
      version: data.version,
      platform: data.platform,
      buildNumber: data.buildNumber,
      status: data.status ?? 'history',
      downloadUrl: data.downloadUrl,
      forceUpdate: data.forceUpdate ?? false,
      releaseNotes: data.releaseNotes,
    })
    .returning()
  return row
}

describe('app-version-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(appVersionRoutes, { prefix: '/api/app-version' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM app_versions`)
  })

  it('GET /api/app-version/latest — 空表返回 latest=undefined', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/app-version/latest' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.latest).toBeUndefined()
  })

  it('GET /api/app-version/latest — 仅返回 status=latest 的版本', async () => {
    await createVersion({
      version: '1.0.0',
      platform: 'ios',
      buildNumber: 1,
      status: 'history',
    })
    await createVersion({
      version: '2.0.0',
      platform: 'ios',
      buildNumber: 2,
      status: 'latest',
    })
    const res = await server.inject({ method: 'GET', url: '/api/app-version/latest' })
    const body = res.json()
    expect(body.data.latest.version).toBe('2.0.0')
    expect(body.data.latest.buildNumber).toBe(2)
  })

  it('GET /api/app-version/latest — 按 platform 筛选', async () => {
    await createVersion({
      version: '2.0.0',
      platform: 'ios',
      buildNumber: 2,
      status: 'latest',
    })
    await createVersion({
      version: '1.5.0',
      platform: 'android',
      buildNumber: 5,
      status: 'latest',
    })
    const res = await server.inject({
      method: 'GET',
      url: '/api/app-version/latest?platform=android',
    })
    const body = res.json()
    expect(body.data.latest.version).toBe('1.5.0')
    expect(body.data.latest.platform).toBe('android')
  })

  it('GET /api/app-version/latest — 多个 latest 时取 buildNumber 最大者', async () => {
    await createVersion({
      version: '1.0.0',
      platform: 'ios',
      buildNumber: 10,
      status: 'latest',
    })
    await createVersion({
      version: '2.0.0',
      platform: 'ios',
      buildNumber: 20,
      status: 'latest',
    })
    const res = await server.inject({ method: 'GET', url: '/api/app-version/latest' })
    const body = res.json()
    expect(body.data.latest.buildNumber).toBe(20)
  })

  it('GET /api/app-version/latest — 非法 platform 返回 400', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/app-version/latest?platform=windows',
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
  })

  it('GET /api/app-version/check-update — 缺 platform 返回 400', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?version=1.0.0',
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/app-version/check-update — 缺 version 返回 400', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?platform=ios',
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/app-version/check-update — 无 latest 版本时 hasUpdate=false', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?platform=ios&version=1.0.0',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.hasUpdate).toBe(false)
    expect(body.data.latestVersion).toBe('1.0.0')
    expect(body.data.forceUpdate).toBe(false)
    expect(body.data.downloadUrl).toBeNull()
  })

  it('GET /api/app-version/check-update — 当前版本落后时 hasUpdate=true', async () => {
    await createVersion({
      version: '1.0.0',
      platform: 'ios',
      buildNumber: 10,
      status: 'history',
    })
    await createVersion({
      version: '2.0.0',
      platform: 'ios',
      buildNumber: 20,
      status: 'latest',
      forceUpdate: true,
      downloadUrl: 'https://example.com/v2.ipa',
      releaseNotes: '修复若干问题',
    })
    const res = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?platform=ios&version=1.0.0',
    })
    const body = res.json()
    expect(body.data.hasUpdate).toBe(true)
    expect(body.data.latestVersion).toBe('2.0.0')
    expect(body.data.forceUpdate).toBe(true)
    expect(body.data.downloadUrl).toBe('https://example.com/v2.ipa')
    expect(body.data.releaseNotes).toBe('修复若干问题')
  })

  it('GET /api/app-version/check-update — 当前版本已最新时 hasUpdate=false', async () => {
    await createVersion({
      version: '2.0.0',
      platform: 'ios',
      buildNumber: 20,
      status: 'latest',
      forceUpdate: true,
    })
    const res = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?platform=ios&version=2.0.0',
    })
    const body = res.json()
    expect(body.data.hasUpdate).toBe(false)
    expect(body.data.forceUpdate).toBe(false)
  })

  it('GET /api/app-version/check-update — 当前版本未在表中记录时按 buildNumber=0 处理', async () => {
    await createVersion({
      version: '2.0.0',
      platform: 'ios',
      buildNumber: 1,
      status: 'latest',
    })
    const res = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?platform=ios&version=999.0.0',
    })
    const body = res.json()
    expect(body.data.hasUpdate).toBe(true)
    expect(body.data.latestVersion).toBe('2.0.0')
  })

  it('GET /api/app-version/check-update — 跨平台不互通', async () => {
    await createVersion({
      version: '2.0.0',
      platform: 'ios',
      buildNumber: 20,
      status: 'latest',
    })
    const res = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?platform=android&version=1.0.0',
    })
    const body = res.json()
    expect(body.data.hasUpdate).toBe(false)
  })
})
