// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-515 / F-517 夹具(legacy-learn.ts)。
 *
 * F-515: `/learn/stats/*` 三个端点的 userId 原先全部取自 query 且不与 JWT 主体比对
 *   ⇒ 任意登录用户可读他人学习时长/排名(IDOR)。
 *   ​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​Fixed 后: 显式传他人 ⇒ 403(不静默改写);未传 ⇒ 用 request.userId。
 * F-517: `GET /learn/topics/:id` 详情不过滤 status;`GET /learn/topics/:id/lessons`
 *   不过滤 `lessons.is_published` ⇒ 草稿专题/草稿课程对外可见。
 *
 * 数据库替身按**被测 SQL 的形状**回应,而不是恒返回一份固定数据:
 *  - `db.select().from().where().orderBy()` 是 thenable,`where` 里解析 drizzle SQL
 *    的 queryChunks,只有条件里真的含 'published' 才按发布态过滤 ⇒ 改前(只按 id)
 *    会把草稿行原样吐回,改后取不到任何行。
 *  - `db.execute(sql…)` 同理:SQL 文本里真的含 `is_published` 才按发布态过滤课时。
 * 这样"红→绿"来自被测实现,而不是替身把缺陷抹平。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'

const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444'
const TOPIC_ID = '77777777-7777-4777-8777-777777777777'
const DRAFT_TOPIC_ID = '88888888-8888-4888-8888-888888888888'

interface TopicRow {
  id: string
  title: string
  status: string
}

interface LessonRow {
  id: string
  title: string
  is_published: boolean
}

const TOPIC_ROWS: TopicRow[] = [
  { id: TOPIC_ID, title: '已发布专题', status: 'published' },
  { id: DRAFT_TOPIC_ID, title: '草稿专题', status: 'draft' },
]

const LESSON_ROWS: LessonRow[] = [
  { id: 'lesson-published', title: '已发布课时', is_published: true },
  { id: 'lesson-draft', title: '草稿课时', is_published: false },
]

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  dbExecute: vi.fn(),
  dbSelect: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({ authenticate: mocks.authenticate }))
vi.mock('../src/db/index.js', () => ({
  db: { execute: mocks.dbExecute, select: mocks.dbSelect },
}))

import { legacyLearnRoutes } from '../src/routes/legacy-learn.js'

/** 把 drizzle SQL / SQL 模板里的文本与绑定参数摊平出来。 */
function collectSql(node: unknown, out = { text: '', params: [] as unknown[] }): typeof out {
  // `sql\`…\`` 直接把插值原样塞进 queryChunks(裸字符串),SQL 段则包成 StringChunk。
  // 所以 queryChunks 里的裸字符串是**绑定值**,不是 SQL 文本。
  if (typeof node === 'string') {
    out.params.push(node)
    return out
  }
  if (Array.isArray(node)) {
    for (const n of node) collectSql(n, out)
    return out
  }
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if ('queryChunks' in rec) {
      collectSql(rec.queryChunks, out)
      return out
    }
    // Column 有 name;StringChunk.value 是字符串数组;Param.value 是标量。
    if (typeof rec.name === 'string') {
      out.text += rec.name
      return out
    }
    if (Array.isArray(rec.value) && rec.value.every((v) => typeof v === 'string')) {
      out.text += (rec.value as string[]).join('')
      return out
    }
    if ('value' in rec) {
      out.params.push(rec.value)
      return out
    }
  }
  return out
}

/** 按 where 里是否真的带 'published' 与 id 绑定值过滤专题行。 */
function selectChain(rows: TopicRow[]): Record<string, unknown> {
  let result = rows
  const chain: Record<string, unknown> = {}
  chain.from = () => chain
  chain.orderBy = () => chain
  chain.where = (cond: unknown) => {
    const { text, params } = collectSql(cond)
    const wantsPublished = text.includes('published') || params.includes('published')
    const idParams = params.filter((p): p is string => typeof p === 'string' && p !== 'published')
    result = rows.filter(
      (r) =>
        (idParams.length === 0 || idParams.includes(r.id)) &&
        (!wantsPublished || r.status === 'published'),
    )
    return chain
  }
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve)
  return chain
}

function defaultExecute(query: unknown): unknown[] {
  const { text } = collectSql(query)
  if (text.includes('learn_record')) {
    if (text.includes('PERCENT_RANK')) return [{ pct: 0.42 }]
    if (text.includes('CURRENT_DATE')) return [{ today_seconds: 600 }]
    return [{ total_seconds: 600 }]
  }
  if (text.includes('lessons')) {
    const onlyPublished = text.includes('is_published')
    return LESSON_ROWS.filter((l) => !onlyPublished || l.is_published)
  }
  return []
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.setErrorHandler((err: FastifyError, _request, reply) => {
    const statusCode =
      err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
    reply.status(statusCode).send({
      code: statusCode,
      message: statusCode >= 500 ? '服务器错误' : err.message,
    })
  })
  await app.register(legacyLearnRoutes, { prefix: '/api/legacy' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authenticate.mockImplementation(async (request: { userId?: string }) => {
    request.userId = AUTH_USER_ID
  })
  mocks.dbExecute.mockImplementation(defaultExecute)
  mocks.dbSelect.mockImplementation(() => selectChain(TOPIC_ROWS))
})

describe('F-515 学习统计归属只认 JWT 主体', () => {
  it('显式传他人 userId:三个统计端点一律 403 且零查询', async () => {
    for (const endpoint of ['total-time', 'today-time', 'rank-percent']) {
      mocks.dbExecute.mockClear()
      const res = await app.inject({
        method: 'GET',
        url: `/api/legacy/learn/stats/${endpoint}?userId=${OTHER_USER_ID}`,
      })
      expect(res.statusCode, endpoint).toBe(403)
      expect(res.json().code, endpoint).toBe(403)
      expect(mocks.dbExecute, endpoint).not.toHaveBeenCalled()
    }
  })

  it('不传 userId:200 且 SQL 绑定的是 request.userId', async () => {
    for (const endpoint of ['total-time', 'today-time', 'rank-percent']) {
      mocks.dbExecute.mockClear()
      const res = await app.inject({
        method: 'GET',
        url: `/api/legacy/learn/stats/${endpoint}`,
      })
      expect(res.statusCode, endpoint).toBe(200)
      const query = mocks.dbExecute.mock.calls[0]?.[0]
      const { params } = collectSql(query)
      expect(params, endpoint).toContain(AUTH_USER_ID)
      expect(params, endpoint).not.toContain(OTHER_USER_ID)
    }
  })
})

describe('F-517 专题/课时只暴露已发布内容', () => {
  it('草稿专题详情不可见:不再只按 id 命中', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/legacy/learn/topics/${DRAFT_TOPIC_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBeUndefined()
    expect(body.error).toBe('专题不存在')
  })

  it('草稿课时不出现在 /lessons 列表', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/legacy/learn/topics/${TOPIC_ID}/lessons`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().list.map((l: LessonRow) => l.id)).toEqual(['lesson-published'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
