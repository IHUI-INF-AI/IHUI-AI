// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-388 回归:条目列表的关键词过滤必须下沉到 SQL。
 *
 * 病灶:原实现先 `limit/offset` 取一页,再在内存 `filter`。命中稀疏时该页不足甚至为空,
 * 翻页出现空洞,调用方按返回长度算出的总数与实际不符。
 *
 * 四条判据:
 * ① 关键词出现在 SQL where 里(title / plain_text / tags 三列都覆盖),返回结果不再被二次过滤;
 * ② `%` / `_` / `\` 被转义成字面量,不产生宽匹配;
 * ③ 计数与列表共用同一 where 装配,渲染出的 SQL 与参数完全一致;
 * ④ 无关键词时 where 不变(不生成 ilike),防误伤。
 *
 * 铁律:全程 mock db,不连任何真实数据库(§5 测试隔离)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

// ---------------------------------------------------------------- mock 面

const USER_ALICE = '00000000-0000-4000-8000-0000000000a1'
const SPACE_ID = '00000000-0000-4000-8000-00000000a001'
const TEAM_ID = '00000000-0000-4000-8000-00000000c001'

/** 按调用顺序出牌;空队列 ⇒ 空数组(即"查不到") */
let scripted: unknown[][] = []
/** 最近一次 `.where()` 收到的条件 —— 列表与计数各取一次比对 */
let lastWhere: unknown

function nextResult(): unknown[] {
  return scripted.shift() ?? []
}

function makeChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(nextResult()).then(resolve),
  }
  for (const m of ['from', 'orderBy', 'limit', 'offset', 'groupBy', 'leftJoin']) {
    chain[m] = () => chain
  }
  chain['where'] = (arg: unknown) => {
    lastWhere = arg
    return chain
  }
  chain['values'] = () => chain
  chain['set'] = () => chain
  chain['returning'] = () => chain
  chain['onConflictDoUpdate'] = () => chain
  return chain
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
    execute: vi.fn(async () => []),
  },
  dbRead: { select: vi.fn(() => makeChain()) },
}))

import { countItems, listItems } from '../src/services/knowledge-team-service.js'

// ---------------------------------------------------------------- 夹具

const dialect = new PgDialect()

function render(cond: unknown): { sql: string; params: unknown[] } {
  expect(cond, 'where 条件缺失:关键词没有进入 SQL').toBeDefined()
  return dialect.sqlToQuery(cond as SQL)
}

function spaceRow() {
  return {
    id: SPACE_ID,
    teamId: TEAM_ID,
    name: '后端规范',
    settings: {},
    visibility: 'team',
    status: 'active',
    createdBy: USER_ALICE,
    updatedBy: USER_ALICE,
    createdAt: new Date('2026-11-13T00:00:00.000Z'),
    updatedAt: new Date('2026-11-13T00:00:00.000Z'),
  }
}

function itemRow(over: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-00000000b001',
    spaceId: SPACE_ID,
    kind: 'memory',
    title: '分页约定',
    content: { rule: 'cursor' },
    plainText: '列表接口一律用 cursor',
    tags: ['api'],
    status: 'draft',
    revision: 1,
    sourceRef: null,
    createdBy: USER_ALICE,
    updatedBy: USER_ALICE,
    createdAt: new Date('2026-11-13T00:00:00.000Z'),
    updatedAt: new Date('2026-11-13T00:00:00.000Z'),
    ...over,
  }
}

/** 空间权限判定三连(取空间 / 空间成员 / 团队成员),之后才是业务查询 */
function stubAccess(): void {
  scripted = [[spaceRow()], [{ role: 'editor' }], [{ role: 'member' }]]
}

const ACTOR = { userId: USER_ALICE }

afterEach(() => {
  scripted = []
  lastWhere = undefined
})

// ---------------------------------------------------------------- ① 关键词进 SQL

describe('关键词下沉:过滤发生在 SQL,不在取回之后', () => {
  it('where 里出现 ilike 且覆盖 title / plain_text / tags 三列', async () => {
    stubAccess()
    scripted.push([itemRow()])
    await listItems(ACTOR, { spaceId: SPACE_ID, keyword: '部署' })
    const { sql, params } = render(lastWhere)
    expect(sql).toContain('ilike')
    expect(sql).toContain('"team_knowledge_items"."title"')
    expect(sql).toContain('"team_knowledge_items"."plain_text"')
    expect(sql).toContain('jsonb_array_elements_text')
    expect(params).toContain('%部署%')
  })

  it('不再做内存二次过滤:SQL 返回的行原样返回(即便标题不含关键词)', async () => {
    stubAccess()
    scripted.push([
      itemRow({ id: 'b001', title: '完全无关', plainText: 'aaa', tags: [] }),
      itemRow({ id: 'b002', title: '也无关', plainText: 'bbb', tags: [] }),
    ])
    const rows = await listItems(ACTOR, { spaceId: SPACE_ID, keyword: '部署' })
    // 若仍在内存 filter,这两行都会被筛掉 ⇒ 这条立刻红
    expect(rows).toHaveLength(2)
  })
})

// ---------------------------------------------------------------- ② 通配符转义

describe('转义:通配符按字面量匹配,不放大命中集', () => {
  it('% / _ / \\ 全部转义,三个 ilike 参数都是同一份转义模式', async () => {
    stubAccess()
    scripted.push([])
    await listItems(ACTOR, { spaceId: SPACE_ID, keyword: '100%_a\\b' })
    const { params } = render(lastWhere)
    const patterns = params.filter((p) => p === '%100\\%\\_a\\\\b%')
    expect(patterns).toHaveLength(3)
    // 去掉合法转义对之后不得残留任何元字符(= 没有裸 % 或 _ 被当通配符)
    const inner = String(patterns[0]).slice(1, -1)
    expect(inner.replace(/\\[\\%_]/g, '')).not.toMatch(/[%_\\]/)
    // 宽匹配模式不得出现
    expect(params).not.toContain('%100%_a\\b%')
  })
})

// ---------------------------------------------------------------- ③ 计数与列表同条件

describe('总数:count 与 list 共用同一 where 装配', () => {
  it('同一筛选条件下,两条查询渲染出的 SQL 与参数逐字相同', async () => {
    const filter = { spaceId: SPACE_ID, kind: 'memory' as const, keyword: '分页' }

    stubAccess()
    scripted.push([itemRow()])
    await listItems(ACTOR, filter)
    const listRender = render(lastWhere)

    stubAccess()
    scripted.push([{ total: 3 }])
    const total = await countItems(ACTOR, filter)
    const countRender = render(lastWhere)

    expect(total).toBe(3)
    expect(countRender.sql).toBe(listRender.sql)
    expect(countRender.params).toEqual(listRender.params)
  })
})

// ---------------------------------------------------------------- ④ 无关键词不变

describe('无关键词:where 保持原形,防误伤', () => {
  it('不生成 ilike,参数只有 spaceId,结果原样返回', async () => {
    stubAccess()
    scripted.push([itemRow({ title: '甲' }), itemRow({ id: 'b002', title: '乙' })])
    const rows = await listItems(ACTOR, { spaceId: SPACE_ID })
    const { sql, params } = render(lastWhere)
    expect(sql).not.toContain('ilike')
    expect(params).toEqual([SPACE_ID])
    expect(rows).toHaveLength(2)
  })

  it('纯空白关键词等同未传(trim 后为空)', async () => {
    stubAccess()
    scripted.push([])
    await listItems(ACTOR, { spaceId: SPACE_ID, keyword: '   ' })
    const { sql } = render(lastWhere)
    expect(sql).not.toContain('ilike')
  })
})
