// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-74 回归:CLI 导入 preview 必须绑定 owner,阻止跨账号凭据窃取。
 *
 * 缺陷路径:受害者 parse-payload 得到 previewId(缓存 10min,key 只含 previewId)
 * → 攻击者用该 previewId 调 commit(selectedProviderIds: [] 全量)
 * → 受害者明文 apiKey 被加密落库到攻击者账户。
 *
 * 本文件锁:
 *   1) 缓存 key 含 owner,value 内也带 ownerUuid;裸 previewId key 不再写入;
 *   2) 非 owner 读 preview / commit 一律 404,且 commit 不触达 DB;
 *   3) 历史无 owner 数据(旧 key / 裸 value / owner 不符)一律 fail-closed;
 *   4) 合法 owner 的复核与 commit 仍可用,commit 后本人缓存被删除。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const authState = vi.hoisted(() => ({ userId: 'victim-uuid' }))
const redisState = vi.hoisted(() => ({
  store: new Map<string, { value: string; expiresAt: number }>(),
  calls: [] as Array<{ cmd: string; args: unknown[] }>,
  failures: new Set<string>(),
}))
const dbCalls = vi.hoisted(() => ({ inserts: [] as Array<{ table: unknown; value: unknown }> }))

// 鉴权直通:每个请求按 authState.userId 注入身份
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = authState.userId
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    REDIS_URL: 'redis://127.0.0.1:6399',
  },
}))

// 内存替身,断言能直接观察真实 key / value
vi.mock('ioredis', async () => {
  const { makeFakeRedisClass } = await import('../src/testing/fake-redis.js')
  return { default: makeFakeRedisClass(redisState) }
})

vi.mock('drizzle-orm', () => ({
  and: () => ({}),
  desc: () => ({}),
  eq: () => ({}),
}))

vi.mock('../src/db/index.js', () => {
  const db = {
    select: () => {
      const query = {
        from: () => query,
        where: () => query,
        limit: async () => [] as unknown[],
      }
      return query
    },
    insert: (table: unknown) => ({
      values: (value: unknown) => {
        dbCalls.inserts.push({ table, value })
        return { returning: async () => [{ id: 9001 }] }
      },
    }),
    delete: () => ({ where: async () => undefined }),
  }
  return { db }
})

vi.mock('@ihui/database', () => ({
  aiModelConfig: { id: 'ai_model_config.id' },
  aiModelConfigModels: { configId: 'ai_model_config_models.config_id' },
  cliProviderImports: { ownerUuid: 'cli_provider_imports.owner_uuid' },
}))

import { cliImportRoutes } from '../src/routes/cli-import.js'

const SOURCE = 'claude-cli'
const SECRET = 'sk-victim-plaintext-key'

interface PreviewBody {
  code: number
  message: string
  data?: {
    preview?: {
      previewId: string
      providers: Array<{ sourceId: string; apiKey?: string }>
    }
  }
}

interface CommitBody {
  code: number
  message: string
  data?: { imported: number; skipped: number; failed: number }
}

const previewKey = (ownerUuid: string, previewId: string): string =>
  `cli-import:preview:${ownerUuid}:${previewId}`

let app: FastifyInstance

beforeEach(async () => {
  if (!app) {
    app = Fastify({ logger: false })
    await app.register(cliImportRoutes, { prefix: '/api' })
    await app.ready()
  }
  authState.userId = 'victim-uuid'
  redisState.store.clear()
  redisState.calls.length = 0
  dbCalls.inserts.length = 0
})

afterAll(async () => {
  await app?.close()
})

function payload(sourceId = 'p1') {
  return {
    source: SOURCE,
    sourcePath: 'settings.json',
    providers: [
      {
        sourceId,
        name: 'Victim Provider',
        providerCode: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: SECRET,
        apiFormat: 'anthropic_messages',
        isCurrent: true,
      },
    ],
  }
}

/** 受害者本人解析一次,返回 previewId(缓存仅受害者可取)。 */
async function createVictimPreview(sourceId = 'p1'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/cli-import/parse-payload',
    payload: payload(sourceId),
  })
  expect(res.statusCode).toBe(200)
  const body = res.json() as PreviewBody
  return body.data!.preview!.previewId
}

describe('F-74 preview 归属绑定', () => {
  it('① 缓存 key 含 owner,value 带 ownerUuid;不再写裸 previewId key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cli-import/parse-payload',
      payload: payload(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as PreviewBody
    const previewId = body.data!.preview!.previewId

    // 响应已脱敏
    expect(body.data!.preview!.providers[0]!.apiKey).toBeUndefined()

    // 裸 key 不存在(旧漏洞形状)
    expect(redisState.store.has(`cli-import:preview:${previewId}`)).toBe(false)

    const key = previewKey('victim-uuid', previewId)
    const row = redisState.store.get(key)
    expect(row).toBeTruthy()
    const cached = JSON.parse(row!.value) as {
      ownerUuid: string
      preview: { providers: Array<{ apiKey?: string }> }
    }
    expect(cached.ownerUuid).toBe('victim-uuid')
    // commit 需要明文 key 落库,缓存内保持原值(仅 owner 可读)
    expect(cached.preview.providers[0]!.apiKey).toBe(SECRET)
  })

  it('② 攻击者用他人 previewId 复核 → 404;本人复核 → 200 且 apiKey 已脱敏', async () => {
    const previewId = await createVictimPreview()

    authState.userId = 'attacker-uuid'
    const attackerRes = await app.inject({
      method: 'GET',
      url: `/api/cli-import/preview/${previewId}`,
    })
    expect(attackerRes.statusCode).toBe(404)

    authState.userId = 'victim-uuid'
    const ownerRes = await app.inject({
      method: 'GET',
      url: `/api/cli-import/preview/${previewId}`,
    })
    expect(ownerRes.statusCode).toBe(200)
    const ownerBody = ownerRes.json() as PreviewBody
    expect(ownerBody.data!.preview!.providers[0]!.apiKey).toBeUndefined()
  })

  it('③ 攻击者用他人 previewId commit → 404,且不触达数据库', async () => {
    const previewId = await createVictimPreview()

    authState.userId = 'attacker-uuid'
    const res = await app.inject({
      method: 'POST',
      url: '/api/cli-import/commit',
      payload: { previewId, selectedProviderIds: [], conflictStrategy: 'overwrite' },
    })
    expect(res.statusCode).toBe(404)
    expect((res.json() as CommitBody).message).toContain('preview 已过期或不存在')
    // 跨账号导入一次都没发生
    expect(dbCalls.inserts).toHaveLength(0)
  })

  it('④ 历史无 owner 数据 fail-closed:旧 key / 裸 value / owner 不符均不可读', async () => {
    const legacyPreview = {
      previewId: 'legacy-preview',
      source: SOURCE,
      sourcePath: 'settings.json',
      detectedAt: new Date().toISOString(),
      providers: [
        {
          sourceId: 'legacy-p1',
          name: 'Legacy',
          providerCode: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: SECRET,
          apiFormat: 'anthropic_messages',
          isCurrent: true,
          warnings: [],
        },
      ],
      globalWarnings: [],
    }
    const put = (key: string, value: unknown): void => {
      redisState.store.set(key, { value: JSON.stringify(value), expiresAt: 0 })
    }

    // (a) 旧 key:cli-import:preview:<previewId>,value 为裸 ImportPreview
    put('cli-import:preview:legacy-preview', legacyPreview)
    // (b) 新 key 但 value 仍是裸对象(无 ownerUuid)
    put(previewKey('victim-uuid', 'legacy-preview'), legacyPreview)
    // (c) 新 key + 信封 owner 与请求者不一致
    put(previewKey('victim-uuid', 'forged-preview'), {
      ownerUuid: 'attacker-uuid',
      preview: { ...legacyPreview, previewId: 'forged-preview' },
    })

    for (const id of ['legacy-preview', 'forged-preview']) {
      const res = await app.inject({ method: 'GET', url: `/api/cli-import/preview/${id}` })
      expect(res.statusCode).toBe(404)
      const commitRes = await app.inject({
        method: 'POST',
        url: '/api/cli-import/commit',
        payload: { previewId: id, selectedProviderIds: [], conflictStrategy: 'skip' },
      })
      expect(commitRes.statusCode).toBe(404)
    }
    expect(dbCalls.inserts).toHaveLength(0)
  })

  it('⑤ 合法 owner 仍可 commit,且提交后本人缓存被删除', async () => {
    const previewId = await createVictimPreview('p-owner')

    const res = await app.inject({
      method: 'POST',
      url: '/api/cli-import/commit',
      payload: { previewId, selectedProviderIds: [], conflictStrategy: 'skip' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as CommitBody
    expect(body.data!.imported).toBe(1)
    expect(body.data!.failed).toBe(0)

    // ai_model_config 与历史各写一条;导入的 apiKey 经加密
    expect(dbCalls.inserts.length).toBeGreaterThanOrEqual(2)
    const configInsert = dbCalls.inserts[0]!.value as { apiKeyEnc?: string | null }
    expect(configInsert.apiKeyEnc).toBeTruthy()
    expect(configInsert.apiKeyEnc).not.toContain(SECRET)

    expect(redisState.store.has(previewKey('victim-uuid', previewId))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
