import { describe, it, expect } from 'vitest'
import {
  PAGE_LIMITS,
  buildCursorPage,
  cursorBinding,
  readPageQuery,
} from '../src/services/cursor-pagination.js'
import { CURSOR_PREFIX, type PageRequest } from '../src/utils/cursor-page.js'

/**
 * O10④ 游标分页规范层。编解码内核在 `utils/cursor-page.ts`(已有,本票复用),
 * 这里验的是规范层新增的三件事:档位唯一、绑定隔离、信封形状,
 * 以及一条最容易被写坏的语义 —— **追加新数据后旧游标仍返回稳定页**。
 */

const SECRET = 'unit-cursor-secret'
interface Row {
  id: string
  seq: number
}
const rows = (from: number, to: number): Row[] =>
  Array.from({ length: to - from + 1 }, (_unused, idx) => ({ id: `r${from + idx}`, seq: from + idx }))
const head = (limit: number, afterId: string | null): PageRequest => ({ limit, afterId })
const bindingFor = (user: number) => cursorBinding(`user:${user}`)

function page(items: readonly Row[], request: PageRequest, user = 1) {
  return buildCursorPage<Row>({
    items,
    request,
    idOf: (row) => row.id,
    binding: bindingFor(user),
    secret: SECRET,
  })
}

describe('档位与解析', () => {
  it('默认与上限只有一处定义,且 limit 越界是夹紧不是报错', () => {
    expect(PAGE_LIMITS).toEqual({ def: 20, max: 100 })
    const parsed = readPageQuery({
      query: { limit: '9999' },
      binding: bindingFor(1),
      secret: SECRET,
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error('unreachable')
    expect(parsed.request.limit).toBe(PAGE_LIMITS.max)

    const garbage = readPageQuery({
      query: { limit: 'abc' },
      binding: bindingFor(1),
      secret: SECRET,
    })
    expect(garbage.ok && garbage.request.limit).toBe(PAGE_LIMITS.def)
  })

  it('非法游标 → 解析失败(路由据此回 400,绝不静默返回首页)', () => {
    const parsed = readPageQuery({
      query: { after: `${CURSOR_PREFIX}_tampered.sig` },
      binding: bindingFor(1),
      secret: SECRET,
    })
    expect(parsed).toEqual({ ok: false, message: 'Invalid or expired cursor' })
  })

  it('游标跨用户不可复用(foreign-scope 也一律 400)', () => {
    const issued = page(rows(1, 5), head(2, null), 1)
    const cursor = issued.envelope.data.next_cursor
    expect(typeof cursor).toBe('string')
    const stolen = readPageQuery({
      query: { after: cursor },
      binding: bindingFor(2),
      secret: SECRET,
    })
    expect(stolen.ok).toBe(false)
  })
})

describe('buildCursorPage', () => {
  it('信封形状是本仓 {code,message,data},data 带 items/has_more/next_cursor', () => {
    const res = page(rows(1, 5), head(2, null))
    expect(res.anchorMissing).toBe(false)
    expect(res.envelope.code).toBe(0)
    expect(res.envelope.message).toBe('success')
    expect(Object.keys(res.envelope.data).sort()).toEqual([
      'has_more',
      'items',
      'next_cursor',
    ])
    expect(res.envelope.data.items.map((row) => row.id)).toEqual(['r1', 'r2'])
    expect(res.envelope.data.has_more).toBe(true)
  })

  it('顺着 next_cursor 翻到底:并集恰好等于全集,不重不漏', () => {
    const items = rows(1, 5)
    let cursor: string | null = null
    const seen: string[] = []
    for (let guard = 0; guard < 10; guard += 1) {
      const parsed = readPageQuery({
        query: cursor === null ? { limit: 2 } : { limit: 2, after: cursor },
        binding: bindingFor(1),
        secret: SECRET,
      })
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) throw new Error('unreachable')
      const res = page(items, parsed.request)
      expect(res.anchorMissing).toBe(false)
      seen.push(...res.envelope.data.items.map((row) => row.id))
      cursor = res.envelope.data.next_cursor
      if (cursor === null) {
        expect(res.envelope.data.has_more).toBe(false)
        break
      }
    }
    expect(seen).toEqual(['r1', 'r2', 'r3', 'r4', 'r5'])
  })

  it('追加新数据后,旧游标仍指向同一处:已交付的不重发、新增的排其后', () => {
    const before = rows(1, 4)
    const first = page(before, head(2, null))
    const cursor = first.envelope.data.next_cursor
    expect(first.envelope.data.items.map((row) => row.id)).toEqual(['r1', 'r2'])

    const parsed = readPageQuery({
      query: { limit: 2, after: cursor },
      binding: bindingFor(1),
      secret: SECRET,
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error('unreachable')

    const page2Before = page(before, parsed.request)
    expect(page2Before.envelope.data.items.map((row) => row.id)).toEqual(['r3', 'r4'])

    // 取回第 2 页期间有人追加了一条:旧游标不得把 r1/r2 再发一遍
    const page2After = page(rows(1, 5), parsed.request)
    const ids = page2After.envelope.data.items.map((row) => row.id)
    expect(ids[0]).toBe('r3')
    expect(ids).toEqual(['r3', 'r4'])
    expect(ids).not.toContain('r1')
    expect(page2After.envelope.data.has_more).toBe(true)
    expect(page2After.envelope.data.next_cursor).toBe(
      page(rows(1, 5), head(2, 'r4')).envelope.data.next_cursor,
    )
  })

  it('锚点已消失 → anchorMissing=true(内核按旧语义从头取,新面必须改判)', () => {
    const res = page(rows(3, 5), head(2, 'r1'))
    expect(res.anchorMissing).toBe(true)
  })

  it('空集合:has_more=false,next_cursor=null,items=[]', () => {
    const res = page([], head(2, null))
    expect(res.envelope.data).toEqual({ items: [], has_more: false, next_cursor: null })
    expect(res.anchorMissing).toBe(false)
  })
})
