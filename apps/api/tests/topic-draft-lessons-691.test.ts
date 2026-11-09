// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-691:专题详情(findTopicDetail)的关联课程只过滤 status=1,未过滤 isPublished,
 * 导致公开 GET /topics/:id 会把 lessonIds 里挂着的草稿课程(isPublished=false)对外返回。
 *
 * 离线夹具:db 用替身,但 where 谓词按真实 SQL 语义执行 —— 谓词先交 PgDialect 编译,
 * 再从渲染结果里抽出 `"col" = $n` / `"col" in ($n,...)` 参与匹配。所以:
 *  - 修复前(draft 不在 where 里)替身会如实把草稿行返回 ⇒ 用例 a) 红;
 *  - 修复后(is_published=true 进 where)草稿被挡 ⇒ 绿。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  topics: [] as Array<Record<string, unknown>>,
  lessons: [] as Array<Record<string, unknown>>,
  lessonWhereCalls: [] as unknown[],
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const schema = await import('@ihui/database')
  const dialect = new PgDialect()

  const TABLE_KEYS = new Map<unknown, 'topics' | 'lessons'>([
    [schema.eduLessonTopics, 'topics'],
    [schema.lessons, 'lessons'],
  ])

  const camel = (col: string) => col.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())

  function tableKey(table: unknown): 'topics' | 'lessons' {
    const key = TABLE_KEYS.get(table)
    if (!key) throw new Error('fake-db: 未识别的表')
    return key
  }

  function rowsOf(key: 'topics' | 'lessons'): Array<Record<string, unknown>> {
    return key === 'topics' ? harness.topics : harness.lessons
  }

  /** 只支持本用例出现的谓词形态:`col = $n` 与 `col in ($n, ...)`(and 连接)。 */
  function matches(row: Record<string, unknown>, cond: unknown): boolean {
    if (cond === undefined) return true
    const rendered = dialect.sqlToQuery(cond as never)
    const params = rendered.params as unknown[]
    const eqPairs = [...rendered.sql.matchAll(/"([a-z_]+)"\s*=\s*\$(\d+)/g)]
    const inGroups = [...rendered.sql.matchAll(/"([a-z_]+)"\s+in\s*\(([^)]*)\)/g)]
    if (eqPairs.length === 0 && inGroups.length === 0) {
      throw new Error(`fake-db: 无法解析 where ${rendered.sql}`)
    }
    const eqOk = eqPairs.every(
      ([, col, idx]) => row[camel(col!)] === params[Number(idx) - 1],
    )
    const inOk = inGroups.every(([, col, group]) => {
      const values = [...(group ?? '').matchAll(/\$(\d+)/g)].map(
        (m) => params[Number(m[1]) - 1],
      )
      return values.includes(row[camel(col!)])
    })
    return eqOk && inOk
  }

  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: (cond: unknown) => {
            const key = tableKey(table)
            if (key === 'lessons') harness.lessonWhereCalls.push(cond)
            const rows = rowsOf(key).filter((row) => matches(row, cond))
            return {
              limit: async (n: number) => rows.slice(0, n),
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                Promise.resolve(rows).then(resolve, reject),
            }
          },
        }),
      }),
    },
  }
})

const { findTopicDetail } = await import('../src/db/topic-queries.js')
const { PgDialect } = await import('drizzle-orm/pg-core')

const TOPIC_ID = '11111111-1111-4111-8111-111111111111'
const DRAFT_LESSON_ID = '22222222-2222-4222-8222-222222222222'
const PUBLISHED_LESSON_ID = '33333333-3333-4333-8333-333333333333'

function lessonRow(id: string, title: string, isPublished: boolean) {
  return {
    id,
    title,
    isPublished,
    status: 1,
    coverImage: null,
    intro: null,
    price: '0',
    originalPrice: null,
    isFree: false,
    lessonCount: 0,
    viewCount: 0,
    signupCount: 0,
  }
}

function primeFixtures() {
  harness.topics.push({
    id: TOPIC_ID,
    lessonIds: [DRAFT_LESSON_ID, PUBLISHED_LESSON_ID],
    isPublished: true,
    status: 1,
  })
  harness.lessons.push(
    lessonRow(DRAFT_LESSON_ID, '草稿课程', false),
    lessonRow(PUBLISHED_LESSON_ID, '已发布课程', true),
  )
}

describe('F-691 专题详情不得对外返回草稿课程', () => {
  beforeEach(() => {
    harness.topics = []
    harness.lessons = []
    harness.lessonWhereCalls = []
  })

  it('a) lesson_ids 含草稿与已发布时,返回的 lessons 只含已发布', async () => {
    primeFixtures()
    const detail = await findTopicDetail(TOPIC_ID)
    expect(detail?.lessons.map((l) => l.title)).toEqual(['已发布课程'])
  })

  it('b) 关联课程查询的 where 必须含 is_published 谓词', async () => {
    primeFixtures()
    await findTopicDetail(TOPIC_ID)
    expect(harness.lessonWhereCalls).toHaveLength(1)
    const rendered = new PgDialect().sqlToQuery(harness.lessonWhereCalls[0] as never)
    expect(rendered.sql).toContain('"is_published"')
  })

  it('c) 管理员预览 includeUnpublished=true 仍可见草稿课时', async () => {
    primeFixtures()
    const detail = await findTopicDetail(TOPIC_ID, { includeUnpublished: true })
    expect(detail?.lessons.map((l) => l.title)).toEqual(['草稿课程', '已发布课程'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
