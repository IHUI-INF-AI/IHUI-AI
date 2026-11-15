// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-529 回归锁(2026-11-13)。
 *
 * 病灶:repo-wiki 生成忽略请求 model,始终用 env AI_REPO_WIKI_MODEL 默认模型
 * ⇒ 用户选型无效,且可能按错误模型计费。
 *
 * 本文件锁:
 *   ① 请求 model 原样透传到 LLM 调用(出站 body.model);
 *   ② 未传 model 才回落默认(AI_REPO_WIKI_MODEL / gpt-4o-mini,运行期读取);
 *   ③ 非法 model(退役 provider)显式 400,且不发起任何 LLM 调用;
 *   ④ 落库/计费记录的 model 用实际生效模型(上游回报优先,缺省回落本次 model)。
 *
 * 只 mock authenticate / db / aiServiceFetch / logger,不触达真实 ai-service、PG。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_REPO_WIKI_MODEL = 'env-default-model'
  return {
    inserted: [] as Array<Record<string, unknown>>,
    llmBodies: [] as Array<Record<string, unknown>>,
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = 'f529-user'
  },
}))

vi.mock('@ihui/database', () => ({
  repoWikiDocs: {
    id: 'id',
    repoName: 'repoName',
    kind: 'kind',
    modulePath: 'modulePath',
    title: 'title',
    model: 'model',
    fileCount: 'fileCount',
    generatedAt: 'generatedAt',
    userId: 'userId',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: () => ({
      values: (rows: Array<Record<string, unknown>>) => {
        h.inserted.push(...rows)
        return {
          returning: async () =>
            rows.map((row, index) => ({
              id: `doc-${index}`,
              kind: row.kind,
              title: row.title,
              modulePath: row.modulePath,
            })),
        }
      },
    }),
  },
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: async (
    _request: unknown,
    path: string,
    init: { body?: string } = {},
  ): Promise<Response> => {
    const body = JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>
    h.llmBodies.push({ path, ...body })
    return new Response(JSON.stringify({ content: '生成的正文', model: body.model }), {
      status: 200,
    })
  },
}))

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}))

import { generateRepoWiki, type WikiLlmCaller } from '../src/services/repo-wiki-service.js'
import { repoWikiRoutes } from '../src/routes/repo-wiki.js'

const FILES = [{ path: 'src/index.ts', content: 'export const x = 1' }]

describe('F-529 generateRepoWiki — model 透传', () => {
  beforeEach(() => {
    h.inserted.length = 0
    h.llmBodies.length = 0
    process.env.AI_REPO_WIKI_MODEL = 'env-default-model'
  })

  it('① 请求 model 原样透传到 overview 与模块 LLM 调用', async () => {
    await generateRepoWiki({ userId: 'u1', repoName: 'demo', model: 'gpt-4o', files: FILES })
    expect(h.llmBodies.length).toBeGreaterThan(1)
    expect(h.llmBodies.every((body) => body.path === '/api/llm/complete')).toBe(true)
    expect(h.llmBodies.every((body) => body.model === 'gpt-4o')).toBe(true)
  })

  it('② 未传 model 才回落默认,且默认值按运行期 env 读取', async () => {
    await generateRepoWiki({ userId: 'u1', repoName: 'demo', files: FILES })
    expect(h.llmBodies[0]?.model).toBe('env-default-model')

    h.llmBodies.length = 0
    process.env.AI_REPO_WIKI_MODEL = 'env-default-model-2'
    await generateRepoWiki({ userId: 'u1', repoName: 'demo', files: FILES })
    expect(h.llmBodies[0]?.model).toBe('env-default-model-2')

    h.llmBodies.length = 0
    delete process.env.AI_REPO_WIKI_MODEL
    await generateRepoWiki({ userId: 'u1', repoName: 'demo', files: FILES })
    expect(h.llmBodies[0]?.model).toBe('gpt-4o-mini')
  })

  it('③ 非法 model(退役 provider)显式 400,且不发起 LLM 调用', async () => {
    await expect(
      generateRepoWiki({
        userId: 'u1',
        repoName: 'demo',
        model: 'stepfun/step-1',
        files: FILES,
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(h.llmBodies).toEqual([])
    expect(h.inserted).toEqual([])
  })

  it('④ 落库/计费记录的 model 用实际生效模型(上游回报优先)', async () => {
    const seenModels: string[] = []
    let calls = 0
    const callLlm: WikiLlmCaller = async (_systemPrompt, _userContent, model) => {
      calls++
      seenModels.push(model)
      return calls === 1
        ? { content: '# 总览', model: 'upstream-actual' }
        : { content: '# 模块', model: null }
    }
    await generateRepoWiki(
      { userId: 'u1', repoName: 'demo', model: 'gpt-4o', files: FILES },
      { callLlm },
    )
    // 每次调用都收到请求指定的 model
    expect(seenModels).toEqual(['gpt-4o', 'gpt-4o'])
    // 上游回报优先;缺省回落本次 model(而非 env 默认)
    expect(h.inserted.find((row) => row.kind === 'overview')?.model).toBe('upstream-actual')
    expect(h.inserted.find((row) => row.kind === 'module')?.model).toBe('gpt-4o')
  })
})

describe('F-529 POST /api/repo-wiki/generate — 非法 model 400', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(repoWikiRoutes, { prefix: '/api/repo-wiki' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    h.inserted.length = 0
    h.llmBodies.length = 0
  })

  it('非法 model 返回 400 而非 502,且不发起 LLM 调用', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/repo-wiki/generate',
      payload: { repoName: 'demo', model: 'stepfun/step-1', files: FILES },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 400 })
    expect((res.json() as { message: string }).message).toContain('不支持的模型')
    expect(h.llmBodies).toEqual([])
  })
})
