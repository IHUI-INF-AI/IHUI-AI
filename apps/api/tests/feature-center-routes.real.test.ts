import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { aiModelConfig, agents, docs, sdks } from '@ihui/database'
import { featureCenterRoutes } from '../src/routes/feature-center.js'

async function createAiModel(data: {
  name: string
  providerCode: string
  baseUrl: string
  apiFormat?: string
  enabled?: boolean
  description?: string
}) {
  const [row] = await db
    .insert(aiModelConfig)
    .values({
      name: data.name,
      providerCode: data.providerCode,
      baseUrl: data.baseUrl,
      apiFormat: data.apiFormat ?? 'openai_chat',
      enabled: data.enabled ?? true,
      description: data.description,
    })
    .returning()
  return row
}

async function createAgent(data: {
  name: string
  description?: string
  status?: string
  agentModel?: string
}) {
  const [row] = await db
    .insert(agents)
    .values({
      name: data.name,
      description: data.description,
      status: data.status ?? 'published',
      agentModel: data.agentModel,
    })
    .returning()
  return row
}

async function createDoc(data: {
  title: string
  slug: string
  content?: string
  category?: string
  status?: string
}) {
  const [row] = await db
    .insert(docs)
    .values({
      title: data.title,
      slug: data.slug,
      content: data.content ?? '正文',
      category: data.category ?? 'guide',
      status: data.status ?? 'published',
    })
    .returning()
  return row
}

async function createSdk(data: {
  name: string
  version: string
  language: string
  status?: string
  description?: string
  downloadUrl?: string
  documentationUrl?: string
}) {
  const [row] = await db
    .insert(sdks)
    .values({
      name: data.name,
      version: data.version,
      language: data.language,
      status: data.status ?? 'active',
      description: data.description,
      downloadUrl: data.downloadUrl,
      documentationUrl: data.documentationUrl,
    })
    .returning()
  return row
}

describe('feature-center-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(featureCenterRoutes, { prefix: '/api/feature-center' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM ai_model_config`)
    await db.execute(sql`DELETE FROM agents`)
    await db.execute(sql`DELETE FROM docs`)
    await db.execute(sql`DELETE FROM sdks`)
  })

  it('GET /api/feature-center/stats — 空表返回全 0', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/feature-center/stats' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data).toEqual({
      apiCount: 0,
      agentCount: 0,
      documentCount: 0,
      modelCount: 0,
      sdkCount: 0,
    })
  })

  it('GET /api/feature-center/stats — 有数据时返回正确计数', async () => {
    await createAiModel({
      name: 'GPT-4',
      providerCode: 'openai',
      baseUrl: 'https://api.openai.com',
    })
    await createAgent({ name: '助手A', status: 'published' })
    await createAgent({ name: '助手B', status: 'draft' })
    await createDoc({ title: '文档1', slug: 'doc-1', status: 'published' })
    await createSdk({ name: 'TS SDK', version: '1.0.0', language: 'typescript', status: 'active' })
    await createSdk({ name: 'Py SDK', version: '2.0.0', language: 'python', status: 'deprecated' })

    const res = await server.inject({ method: 'GET', url: '/api/feature-center/stats' })
    const body = res.json()
    expect(body.data.agentCount).toBe(1)
    expect(body.data.documentCount).toBe(1)
    expect(body.data.modelCount).toBe(1)
    expect(body.data.sdkCount).toBe(1)
  })

  it('GET /api/feature-center/stats — 仅统计 enabled=true 的模型', async () => {
    await createAiModel({ name: '启用', providerCode: 'openai', baseUrl: 'x', enabled: true })
    await createAiModel({ name: '禁用', providerCode: 'openai', baseUrl: 'x', enabled: false })
    const res = await server.inject({ method: 'GET', url: '/api/feature-center/stats' })
    const body = res.json()
    expect(body.data.modelCount).toBe(1)
  })

  it('GET /api/feature-center/apis — 返回 enabled=true 的模型列表', async () => {
    await createAiModel({
      name: 'GPT-4',
      providerCode: 'openai',
      baseUrl: 'https://api.openai.com',
      enabled: true,
      description: 'OpenAI 旗舰模型',
    })
    await createAiModel({ name: 'Disabled', providerCode: 'x', baseUrl: 'x', enabled: false })
    const res = await server.inject({ method: 'GET', url: '/api/feature-center/apis' })
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('GPT-4')
    expect(body.data[0].version).toBe('openai')
    expect(body.data[0].category).toBe('openai_chat')
    expect(body.data[0].endpoints).toEqual([])
  })

  it('GET /api/feature-center/agents — 返回 status=published 的 agent', async () => {
    await createAgent({ name: '已发布', status: 'published', agentModel: '对话', description: 'A' })
    await createAgent({ name: '草稿', status: 'draft' })
    const res = await server.inject({ method: 'GET', url: '/api/feature-center/agents' })
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('已发布')
    expect(body.data[0].category).toBe('对话')
    expect(body.data[0].capabilities).toEqual(['对话'])
  })

  it('GET /api/feature-center/documents — 返回 status=published 的文档', async () => {
    await createDoc({ title: 'API 文档', slug: 'api-doc', status: 'published', category: 'api' })
    await createDoc({ title: '草稿', slug: 'draft', status: 'draft' })
    const res = await server.inject({ method: 'GET', url: '/api/feature-center/documents' })
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('API 文档')
    expect(body.data[0].category).toBe('api')
    expect(body.data[0].format).toBe('markdown')
    expect(body.data[0].url).toBe('/docs/api-doc')
  })

  it('GET /api/feature-center/models — 返回 enabled=true 的模型', async () => {
    await createAiModel({
      name: 'Claude',
      providerCode: 'anthropic',
      baseUrl: 'x',
      enabled: true,
      description: 'Anthropic 模型',
    })
    await createAiModel({ name: 'Disabled', providerCode: 'x', baseUrl: 'x', enabled: false })
    const res = await server.inject({ method: 'GET', url: '/api/feature-center/models' })
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('Claude')
    expect(body.data[0].provider).toBe('anthropic')
    expect(body.data[0].description).toBe('Anthropic 模型')
  })

  it('GET /api/feature-center/sdks — 返回 status=active 的 SDK', async () => {
    await createSdk({
      name: 'TS SDK',
      version: '1.2.0',
      language: 'typescript',
      status: 'active',
      description: 'TypeScript SDK',
      downloadUrl: 'https://example.com/ts.tgz',
      documentationUrl: 'https://example.com/docs/ts',
    })
    await createSdk({
      name: 'Deprecated',
      version: '0.1',
      language: 'python',
      status: 'deprecated',
    })
    const res = await server.inject({ method: 'GET', url: '/api/feature-center/sdks' })
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('TS SDK')
    expect(body.data[0].language).toBe('typescript')
    expect(body.data[0].version).toBe('1.2.0')
    expect(body.data[0].downloadUrl).toBe('https://example.com/ts.tgz')
    expect(body.data[0].docsUrl).toBe('https://example.com/docs/ts')
  })

  it('所有端点响应格式符合 { code, message, data } 规范', async () => {
    const urls = [
      '/api/feature-center/stats',
      '/api/feature-center/apis',
      '/api/feature-center/agents',
      '/api/feature-center/documents',
      '/api/feature-center/models',
      '/api/feature-center/sdks',
    ]
    for (const url of urls) {
      const res = await server.inject({ method: 'GET', url })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('data')
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
    }
  })

  it('空表时所有列表端点返回空数组', async () => {
    const urls = [
      '/api/feature-center/apis',
      '/api/feature-center/agents',
      '/api/feature-center/documents',
      '/api/feature-center/models',
      '/api/feature-center/sdks',
    ]
    for (const url of urls) {
      const res = await server.inject({ method: 'GET', url })
      const body = res.json()
      expect(body.data).toEqual([])
    }
  })
})
