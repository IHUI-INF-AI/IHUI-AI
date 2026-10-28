// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * findPublishedLessons / findAllLessons 的筛选轴 —— 离线判据。
 *
 * 本机无可连的 PostgreSQL(8810/8810 段零监听,AGENTS §5b「本机是开发机」实测),所以这里
 * **不假装"跑过一次真查询"**:判据是把被审函数交给 Drizzle 自己编译出来的 SQL 拿来看
 * (谓词形态、参数、投影列),与 apps/api/tests/learn/published-video-feed.test.ts 同一取向。
 * 真库端到端(造一行 difficulty='beginner' 再断言只回它)属 `--db` 档,本机不可用。
 *
 * 判据清单(每条都是"新增这根轴真的进了 SQL",不是"函数没抛错"):
 *  F1 默认参数:发布态谓词恒在,且**不**凭空多出 difficulty / is_free / price 谓词
 *  F2 difficulty=beginner → WHERE 含 "difficulty" 且带该参数;发布态谓词不被顶掉
 *  F3 price=free → WHERE 含 is_free ∨ price 两根列(F1/F2 那两处既有语义的并集)
 *  F4 price=paid → 是 F3 的 NOT(补集),两者参数集逐字相同 ⇒ 不存在第三态、也不可能两档都命中
 *  F5 列表与计数用同一个 WHERE 对象(分页与 total 口径一致)
 *  F6 投影带出 difficulty 列(加列同批改 select,否则类型层与 SQL 层各说一套)
 *  F7 admin 列表复用同一份筛选实现,但**不**带发布态谓词(admin 要看未发布行)
 *  F8 空串/undefined 归一后不产生谓词(与 routes 层 lessonsQuerySchema 的归一形态对齐)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { and, eq, not } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { learnCategories, lessons } from '@ihui/database'

interface CapturedCall {
  selectFields: unknown
  from: unknown
  joins: unknown[]
  where: unknown
  limit: unknown
  offset: unknown
}

const calls: CapturedCall[] = []

function makeChain(record: CapturedCall): unknown {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  chain.select = (fields: unknown) => {
    record.selectFields = fields
    return chain
  }
  chain.from = (table: unknown) => {
    record.from = table
    return chain
  }
  chain.leftJoin = (table: unknown) => {
    record.joins.push(table)
    return chain
  }
  chain.innerJoin = (table: unknown) => {
    record.joins.push(table)
    return chain
  }
  chain.where = (cond: unknown) => {
    record.where = cond
    return chain
  }
  chain.orderBy = () => chain
  chain.limit = (n: unknown) => {
    record.limit = n
    return chain
  }
  chain.offset = (n: unknown) => {
    record.offset = n
    return chain
  }
  chain.then = (
    onFulfilled: ((value: unknown[]) => unknown) | undefined,
    onRejected?: ((reason: unknown) => unknown) | undefined,
  ) => Promise.resolve([]).then(onFulfilled, onRejected)
  return chain
}

vi.mock('../../src/db/index.js', () => ({
  db: {
    select(fields: unknown) {
      const record: CapturedCall = {
        selectFields: fields,
        from: null,
        joins: [],
        where: null,
        limit: null,
        offset: null,
      }
      calls.push(record)
      return makeChain(record)
    },
  },
  dbRead: {},
  dbClient: {},
}))

import {
  findPublishedLessons,
  findAllLessons,
  lessonFreeCondition,
} from '../../src/db/learn-queries.js'

/** 把捕获到的 WHERE 交给 Drizzle 编译成 SQL 文本 + 参数(只投 id,免得投影列混进谓词判据) */
function compileWhere(where: unknown): { sql: string; params: unknown[] } {
  const built = new QueryBuilder()
    .select({ id: lessons.id })
    .from(lessons)
    .where(where as SQL)
  return built.toSQL() as unknown as { sql: string; params: unknown[] }
}

/** 把捕获到的 select 形状交给 Drizzle 编译,证明投影里真的有哪一列 */
function compileSelect(fields: unknown): { sql: string } {
  const built = new QueryBuilder()
    .select(fields as Record<string, unknown>)
    .from(lessons)
    .leftJoin(learnCategories, eq(lessons.categoryId, learnCategories.id))
  return built.toSQL() as unknown as { sql: string }
}

const UUID = '33333333-3333-4333-8333-333333333333'

describe('findPublishedLessons 筛选轴(F1–F6)', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('F1 默认参数:发布态谓词在,且没有凭空多出的三根新轴', async () => {
    await findPublishedLessons({ page: 1, pageSize: 20 })
    expect(calls.length).toBe(2)
    const compiled = compileWhere(calls[0]?.where)
    expect(compiled.sql).toContain('"is_published"')
    expect(compiled.sql).toContain('"status"')
    expect(compiled.params).toContain(true)
    expect(compiled.params).toContain(1)
    // 判据大小写与 Drizzle 渲染形态一致;写成读空气的常量断言等于没有判据
    expect(compiled.sql).not.toContain('"difficulty"')
    expect(compiled.sql).not.toContain('"is_free"')
    expect(compiled.sql).not.toMatch(/"price"\s*(<=|>=|=)/)
  })

  it('F2 difficulty 进 WHERE,且不顶掉发布态谓词', async () => {
    await findPublishedLessons({ page: 1, pageSize: 20, difficulty: 'beginner' })
    const compiled = compileWhere(calls[0]?.where)
    expect(compiled.sql).toContain('"difficulty"')
    expect(compiled.params).toContain('beginner')
    expect(compiled.sql).toContain('"is_published"')
    expect(compiled.sql).toContain('"status"')
  })

  it('F2b 既有 categoryId / search 两根轴不受影响(扩轴不得把旧轴顶掉)', async () => {
    await findPublishedLessons({ page: 1, pageSize: 20, categoryId: UUID, search: '运营' })
    const compiled = compileWhere(calls[0]?.where)
    expect(compiled.sql).toContain('"category_id"')
    expect(compiled.params).toContain(UUID)
    expect(compiled.sql.toLowerCase()).toContain('ilike')
    expect(compiled.params).toContain('%运营%')
  })

  it('F3 price=free → 谓词同时引用 is_free 与 price(两列的并集,不是只看一列)', async () => {
    await findPublishedLessons({ page: 1, pageSize: 20, price: 'free' })
    const compiled = compileWhere(calls[0]?.where)
    expect(compiled.sql).toContain('"is_free"')
    expect(compiled.sql).toContain('"price"')
    expect(compiled.params).toContain('0')
    // 并集形态:两列之间必须是 OR(写成 AND 就把"isFree=true 但标价 99"的课程筛没了)。
    // 判据形态必须是 Drizzle 真实渲染的小写 `or` —— 与 published-video-feed 那条评论同一条坑:
    // 断言写成大写 `||`/`OR` 时,判据要么恒假(误红)要么在改形后静默失效。
    expect(compiled.sql).toMatch(/\bor\b/)
  })

  it('F4 price=paid 是 price=free 的补集:同一份条件的 NOT,参数集逐字相同', async () => {
    await findPublishedLessons({ page: 1, pageSize: 20, price: 'free' })
    const free = compileWhere(calls[0]?.where)
    calls.length = 0
    await findPublishedLessons({ page: 1, pageSize: 20, price: 'paid' })
    const paid = compileWhere(calls[0]?.where)
    expect(paid.sql).toMatch(/\bnot \(/)
    expect(paid.sql).toContain('"is_free"')
    expect(paid.sql).toContain('"price"')
    // 补集不是"另一套判据":两档的参数集必须完全相同,只差那层 NOT
    expect(paid.params).toEqual(free.params)
  })

  it('F4b 同一行不可能既 free 又 paid(导出判据的自洽性)', () => {
    const free = compileWhere(and(lessonFreeCondition()))
    const paid = compileWhere(not(lessonFreeCondition()))
    expect(free.params).toEqual(paid.params)
    expect(paid.sql).toMatch(/\bnot \(/)
    // 阳性对照:这把尺子看得见 OR 与两列,否则"补集"是空话
    expect(free.sql).toMatch(/\bor\b/)
    expect(free.sql).toContain('"is_free"')
  })

  it('F5 列表与计数共用同一个 WHERE 对象(不再各算一遍)', async () => {
    await findPublishedLessons({ page: 2, pageSize: 5, difficulty: 'advanced', price: 'paid' })
    expect(calls.length).toBe(2)
    expect(calls[0]?.where).toBe(calls[1]?.where)
    expect(calls[0]?.limit).toBe(5)
    expect(calls[0]?.offset).toBe(5)
    const compiled = compileWhere(calls[1]?.where)
    expect(compiled.sql).toContain('"difficulty"')
    expect(compiled.sql).toMatch(/\bnot \(/)
  })

  it('F6 投影真的带出 difficulty 列(加列同批改 select)', async () => {
    await findPublishedLessons({ page: 1, pageSize: 20 })
    const compiled = compileSelect(calls[0]?.selectFields)
    expect(compiled.sql).toContain('"difficulty"')
    // 反向对照:同一把尺子在整表投影里也看得见既有列,否则看不见 = 尺子失效
    expect(compiled.sql).toContain('"lecturer_name"')
    expect(compiled.sql).toContain('"is_free"')
  })

  it('F8 空串与 undefined 都不产生谓词(与 routes 层的归一形态对齐)', async () => {
    await findPublishedLessons({
      page: 1,
      pageSize: 20,
      // 路由层已把空串归一为 undefined;这里再喂一次空串,验证查询层也不会把它当条件
      difficulty: '' as unknown as undefined,
      price: '' as unknown as undefined,
      categoryId: '' as unknown as undefined,
      search: '' as unknown as undefined,
    })
    const compiled = compileWhere(calls[0]?.where)
    expect(compiled.sql).not.toContain('"difficulty"')
    expect(compiled.sql).not.toContain('"is_free"')
    expect(compiled.sql).not.toContain('"category_id"')
    expect(compiled.sql.toLowerCase()).not.toContain('ilike')
    expect(compiled.sql).toContain('"is_published"')
  })
})

describe('findAllLessons(admin 列表)与公开列表共用一份筛选实现(F7)', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('F7a 同样的三根轴在 admin 面产生同样的谓词', async () => {
    await findAllLessons({ page: 1, pageSize: 20, difficulty: 'intermediate', price: 'free' })
    const compiled = compileWhere(calls[0]?.where)
    expect(compiled.sql).toContain('"difficulty"')
    expect(compiled.params).toContain('intermediate')
    expect(compiled.sql).toContain('"is_free"')
  })

  it('F7b admin 面不带发布态谓词(它要看未发布行),公开面必须带 —— 两侧不得同形', async () => {
    await findAllLessons({ page: 1, pageSize: 20 })
    const admin = compileWhere(calls[0]?.where)
    expect(admin.sql).not.toContain('"is_published"')
    calls.length = 0
    await findPublishedLessons({ page: 1, pageSize: 20 })
    const pub = compileWhere(calls[0]?.where)
    expect(pub.sql).toContain('"is_published"')
  })

  it('F7c 无任何筛选时 admin 不构造 WHERE(不是把空 and() 塞进去)', async () => {
    await findAllLessons({ page: 1, pageSize: 20 })
    expect(calls[0]?.where).toBeUndefined()
    expect(calls[1]?.where).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
