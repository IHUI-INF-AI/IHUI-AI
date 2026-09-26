// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * findPublishedVideoFeed — 公开视频流取数出口的离线判据。
 *
 * 本机无可连的 PostgreSQL(8810 无监听),所以这里不假装"跑过一次真查询":
 * 判据是**把被测函数交给 Drizzle 自己编译出来的 SQL 拿来看**,而不是看返回行 ——
 * 「未发布的读不到」在这种门上的可证形式只有一种:发布态谓词必须出现在 WHERE 里,
 * 且函数签名上不存在任何能让调用方关掉它的口子。
 * 真库端到端(造一行 isPublished=false 再断言读不到)属 `pnpm --filter @ihui/api test:real`,本机不可用。
 *
 * 三条判据:
 *  Q1 WHERE 恒含 lessons.is_published = true ∧ lessons.status = 1(默认参数下也在)
 *  Q2 投影里不得出现 lessonChapterSections.videoUrl / content —— 播放地址与正文的唯一
 *     出口是 routes/learn/get-lesson-video.ts(它做报名/免费判定),列表端点顺带回显即绕过
 *  Q3 search / categoryId 只在传入时才加谓词,且不得替换掉 Q1 的两条发布态谓词
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { lessonChapters, lessonChapterSections, lessons, users } from '@ihui/database'

interface CapturedCall {
  selectFields: Record<string, unknown>
  from: unknown
  joins: unknown[]
  where: unknown
}

const calls: CapturedCall[] = []

function makeChain(record: CapturedCall): unknown {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  chain.select = (fields: unknown) => {
    record.selectFields = (fields ?? {}) as Record<string, unknown>
    return chain
  }
  chain.from = (table: unknown) => {
    record.from = table
    return chain
  }
  chain.innerJoin = (table: unknown) => {
    record.joins.push(table)
    return chain
  }
  chain.leftJoin = (table: unknown) => {
    record.joins.push(table)
    return chain
  }
  chain.where = (cond: unknown) => {
    record.where = cond
    return chain
  }
  chain.orderBy = () => chain
  chain.limit = () => chain
  chain.offset = () => chain
  chain.then = (
    onFulfilled: ((value: unknown[]) => unknown) | undefined,
    onRejected?: ((reason: unknown) => unknown) | undefined,
  ) => Promise.resolve([]).then(onFulfilled, onRejected)
  return chain
}

vi.mock('../../src/db/index.js', () => ({
  db: {
    select(fields: Record<string, unknown>) {
      const record: CapturedCall = {
        selectFields: fields ?? {},
        from: null,
        joins: [],
        where: null,
      }
      calls.push(record)
      return makeChain(record)
    },
  },
  dbRead: {},
  dbClient: {},
}))

import { findPublishedVideoFeed } from '../../src/db/learn-queries.js'

/** 把捕获到的 WHERE 交给 Drizzle 编译成 SQL 文本 + 参数 */
function compileWhere(where: unknown): { sql: string; params: unknown[] } {
  const built = new QueryBuilder()
    .select({ id: lessonChapterSections.id })
    .from(lessonChapterSections)
    .where(where as SQL)
  return built.toSQL() as unknown as { sql: string; params: unknown[] }
}

/** 投影里出现过的数据库列名(值必须是 Column 实例才有 .name) */
function projectedColumnNames(fields: Record<string, unknown>): string[] {
  return Object.values(fields)
    .map((v) => (v as { name?: unknown }).name)
    .filter((n): n is string => typeof n === 'string')
}

describe('findPublishedVideoFeed — 发布态谓词与投影', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('Q1 默认(无 search / 无 category)WHERE 已含两条发布态谓词', async () => {
    await findPublishedVideoFeed({ page: 1, pageSize: 10 })
    expect(calls.length).toBeGreaterThan(0)
    const compiled = compileWhere(calls[0]?.where)
    expect(compiled.sql).toContain('"is_published"')
    expect(compiled.sql).toContain('"status"')
    expect(compiled.params).toContain(true)
    expect(compiled.params).toContain(1)
  })

  it('Q1b 列表与计数两条查询用的是同一个 WHERE(分页与总数口径一致)', async () => {
    await findPublishedVideoFeed({ page: 2, pageSize: 10, search: '起号' })
    expect(calls.length).toBe(2)
    expect(calls[0]?.where).toBe(calls[1]?.where)
    const compiled = compileWhere(calls[1]?.where)
    expect(compiled.sql).toContain('ilike')
    expect(compiled.params).toContain('%起号%')
  })

  it('Q2 投影不含 videoUrl / content,只带回展示字段', async () => {
    await findPublishedVideoFeed({ page: 1, pageSize: 10 })
    const names = projectedColumnNames(calls[0]?.selectFields ?? {})
    expect(names).not.toContain('video_url')
    expect(names).not.toContain('content')
    // 阳性对照:同一把尺子必须看得见投影里真在用的列,否则 Q2 是在读空气
    expect(names).toContain('cover_image')
    expect(names).toContain('lecturer_name')
  })

  it('Q2b 列表查询的字段名集合就是公开契约的字段名', async () => {
    await findPublishedVideoFeed({ page: 1, pageSize: 10 })
    expect(Object.keys(calls[0]?.selectFields ?? {}).sort()).toEqual(
      [
        'avatar',
        'cover',
        'courseId',
        'courseTitle',
        'createdAt',
        'duration',
        'id',
        'lecturerName',
        'nickname',
        'title',
      ].sort(),
    )
  })

  it('Q3 传 categoryId 时追加分类谓词,且不顶掉发布态谓词', async () => {
    await findPublishedVideoFeed({
      page: 1,
      pageSize: 10,
      categoryId: '33333333-3333-4333-8333-333333333333',
    })
    const compiled = compileWhere(calls[0]?.where)
    expect(compiled.sql).toContain('"category_id"')
    expect(compiled.params).toContain('33333333-3333-4333-8333-333333333333')
    expect(compiled.sql).toContain('"is_published"')
    expect(compiled.sql).toContain('"status"')
  })

  it('Q3b 不传可选参数时 WHERE 里没有 ilike / category_id(不凭空加条件)', async () => {
    await findPublishedVideoFeed({ page: 1, pageSize: 10 })
    const compiled = compileWhere(calls[0]?.where)
    // 判据大小写必须与 Q1b 的阳性对照同形:Drizzle 渲染的是小写 `ilike`,
    // 写成大写 'ILIKE' 会让这条反向断言恒真(= 没有判据)。
    expect(compiled.sql).not.toContain('ilike')
    expect(compiled.sql).not.toContain('ILIKE')
    expect(compiled.sql).not.toContain('"category_id"')
  })

  it('Q4 取数出口挂在小节表上,并串起 章节 → 课程 → 讲师账号', async () => {
    await findPublishedVideoFeed({ page: 1, pageSize: 10 })
    const list = calls[0]
    expect(list?.from).toBe(lessonChapterSections)
    expect(list?.joins).toContain(lessonChapters)
    expect(list?.joins).toContain(lessons)
    expect(list?.joins).toContain(users)
  })

  it('Q5 函数返回 { list, total, page, pageSize } 信封字段(list 由空结果映射为空数组)', async () => {
    const result = await findPublishedVideoFeed({ page: 3, pageSize: 7 })
    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(7)
    expect(result.list).toEqual([])
    // 计数查询返回 [] → 没有行时 total 兜到 0,不得是 undefined(NaN 分页的入口)
    expect(result.total).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
