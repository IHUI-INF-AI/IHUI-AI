// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-78 回归锁(P2):会员企业列表分页/总数/筛选三处错位。
 *
 * 病灶(`findMemberCompanies`):
 *   1) limit/offset 作用在 edu_members 会员行上 —— 一页会员可能只聚出 1 家企业(重复/漏企业);
 *   2) total 取当前页聚合出的企业数(companies.size),翻页器永远偏小;
 *   3) name 过滤 edu_members.nickname,按企业名搜索无效。
 *
 * 本文件不连库:整体替身 `src/db/index.js`,select 链按投影形状识别三类查询
 * (企业分页 / count(distinct) 总数 / 本页成员),并用 PgDialect 编译**运行路径捕获的**
 * where/orderBy/统计表达式做形状断言 —— 不是照抄源码字符串。
 * 分页不重不漏由替身按调用方传入的 limit/offset 切片来检验(传错 offset 即重复/漏项)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

interface FakeCompany {
  id: string
  name: string
  sort: number
}

interface FakeMember {
  id: string
  nickname: string | null
  mobile: string | null
  email: string | null
  companyId: string | null
}

type CallKind = 'company-page' | 'company-total' | 'page-members'

interface QueryCall {
  kind?: CallKind
  selectionKeys: string[]
  selectSql?: string
  fromTable?: string
  joinedTables: string[]
  whereArg?: unknown
  limit?: number
  offset?: number
  groupByArgs: unknown[]
  orderByArgs: unknown[]
}

const { state } = vi.hoisted(() => ({
  state: {
    companies: [] as FakeCompany[],
    members: [] as FakeMember[],
    calls: [] as QueryCall[],
  },
}))

vi.mock('../src/db/index.js', async () => {
  const { getTableName } = await import('drizzle-orm')
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()

  const paramValues = (arg: unknown): unknown[] => {
    if (!arg) return []
    try {
      return dialect.sqlToQuery(arg as SQL).params
    } catch {
      return []
    }
  }

  /** ilike 的 %kw% 参数 → kw;无 name 过滤时为 undefined */
  const likeParam = (arg: unknown): string | undefined => {
    const hit = paramValues(arg).find(
      (v): v is string => typeof v === 'string' && v.startsWith('%') && v.endsWith('%'),
    )
    return hit?.slice(1, -1)
  }

  const matchesName = (name: string, needle: string | undefined) =>
    !needle || name.toLowerCase().includes(needle.toLowerCase())

  const run = (call: QueryCall, selection: Record<string, unknown> | undefined) => {
    const keys = Object.keys(selection ?? {})
    if (keys.includes('count')) {
      // count(distinct edu_members.company_id):只统计确有会员且命中 name 的企业
      call.kind = 'company-total'
      const needle = likeParam(call.whereArg)
      const ids = new Set(
        state.members
          .map((m) => m.companyId)
          .filter((id): id is string => typeof id === 'string')
          .filter((id) => {
            const company = state.companies.find((c) => c.id === id)
            return !!company && matchesName(company.name, needle)
          }),
      )
      return [{ count: ids.size }]
    }
    if (keys.includes('nickname')) {
      // 本页成员:where 为 company_id IN (本页企业 id)
      call.kind = 'page-members'
      const ids = paramValues(call.whereArg)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .filter((v): v is string => typeof v === 'string')
      return state.members
        .filter((m) => m.companyId !== null && ids.includes(m.companyId))
        .sort(
          (a, b) =>
            (a.companyId! < b.companyId! ? -1 : a.companyId! > b.companyId! ? 1 : 0) ||
            (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
        )
        .map((m) => ({
          id: m.id,
          nickname: m.nickname,
          mobile: m.mobile,
          email: m.email,
          companyId: m.companyId,
        }))
    }
    // 企业分页:主表 edu_companies join edu_members 去重,按 sort/id 排序后切片
    call.kind = 'company-page'
    const needle = likeParam(call.whereArg)
    const companies = state.companies
      .filter((c) => state.members.some((m) => m.companyId === c.id))
      .filter((c) => matchesName(c.name, needle))
      .sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const start = call.offset ?? 0
    const end = start + (call.limit ?? companies.length)
    return companies.slice(start, end).map((c) => ({ id: c.id }))
  }

  const select = (selection?: Record<string, unknown>) => {
    const call: QueryCall = {
      selectionKeys: Object.keys(selection ?? {}),
      joinedTables: [],
      groupByArgs: [],
      orderByArgs: [],
    }
    if (selection && typeof selection.count !== 'undefined') {
      call.selectSql = dialect.sqlToQuery(selection.count as SQL).sql
    }
    state.calls.push(call)
    const chain: Record<string, unknown> = {
      from: (table: unknown) => {
        call.fromTable = getTableName(table as Parameters<typeof getTableName>[0])
        return chain
      },
      innerJoin: (table: unknown) => {
        call.joinedTables.push(getTableName(table as Parameters<typeof getTableName>[0]))
        return chain
      },
      where: (arg: unknown) => {
        call.whereArg = arg
        return chain
      },
      groupBy: (...args: unknown[]) => {
        call.groupByArgs = args
        return chain
      },
      orderBy: (...args: unknown[]) => {
        call.orderByArgs = args
        return chain
      },
      limit: (n: number) => {
        call.limit = n
        return chain
      },
      offset: (n: number) => {
        call.offset = n
        return chain
      },
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(run(call, selection)).then(resolve, reject),
    }
    return chain
  }

  const db = { select, selectDistinct: select }
  return { db, dbRead: db }
})

import { findMemberCompanies } from '../src/db/member-queries.js'

const dialect = new PgDialect()

function member(id: string, companyId: string | null, nickname: string): FakeMember {
  return { id, nickname, mobile: `1380000${id}`, email: `${id}@example.com`, companyId }
}

/**
 * 5 家企业(含 sort 并列,用于检验 id 并列打破键)+ 9 个会员(c1 有 3 个,c2 的昵称含 Corp
 * 但企业名不含 Corp —— 用来证明 name 不再过滤 nickname)。
 */
function seed(): void {
  state.companies = [
    { id: 'c1', name: 'Acme Corp', sort: 0 },
    { id: 'c2', name: 'Beta Ltd', sort: 0 },
    { id: 'c3', name: 'Gamma Corp', sort: 1 },
    { id: 'c4', name: 'Delta Inc', sort: 1 },
    { id: 'c5', name: 'Epsilon', sort: 2 },
  ]
  state.members = [
    member('m1', 'c1', 'Alice'),
    member('m2', 'c1', 'Bob'),
    member('m3', 'c1', 'Carol'),
    member('m4', 'c2', 'Corp Fan'),
    member('m5', 'c3', 'Dave'),
    member('m6', 'c3', 'Eve'),
    member('m7', 'c4', 'Frank'),
    member('m8', 'c5', 'Grace'),
    member('m9', null, 'NoCompany'),
  ]
}

function callsOf(kind: CallKind): QueryCall[] {
  return state.calls.filter((c) => c.kind === kind)
}

function lastCall(kind: CallKind): QueryCall {
  const calls = callsOf(kind)
  const call = calls[calls.length - 1]
  expect(call).toBeTruthy()
  return call!
}

beforeEach(() => {
  state.companies = []
  state.members = []
  state.calls = []
  seed()
})

describe('F-78 会员企业列表:企业级分页 / 去重总数 / 企业名筛选', () => {
  it('分页作用在企业上,逐页取不重不漏(与 limit/offset 一致)', async () => {
    const page1 = await findMemberCompanies({ page: 1, pageSize: 2 })
    const page2 = await findMemberCompanies({ page: 2, pageSize: 2 })
    const page3 = await findMemberCompanies({ page: 3, pageSize: 2 })

    expect(page1.list.map((c) => c.companyId)).toEqual(['c1', 'c2'])
    expect(page2.list.map((c) => c.companyId)).toEqual(['c3', 'c4'])
    expect(page3.list.map((c) => c.companyId)).toEqual(['c5'])

    const seen = [...page1.list, ...page2.list, ...page3.list].map((c) => c.companyId)
    expect(seen).toHaveLength(5)
    expect(new Set(seen).size).toBe(5) // 不重

    // 每页只按页内企业拉成员(inArray 参数即本页企业 id),成员查询不再分页
    const memberParams = callsOf('page-members').map(
      (c) => dialect.sqlToQuery(c.whereArg as SQL).params,
    )
    expect(memberParams[0]).toEqual(['c1', 'c2'])
    expect(memberParams[1]).toEqual(['c3', 'c4'])
    expect(memberParams[2]).toEqual(['c5'])
    for (const call of callsOf('page-members')) {
      expect(call.limit).toBeUndefined()
      expect(call.offset).toBeUndefined()
    }

    // 分页参数落在企业查询上
    expect(callsOf('company-page').map((c) => [c.limit, c.offset])).toEqual([
      [2, 0],
      [2, 2],
      [2, 4],
    ])
  })

  it('企业页查询以 edu_companies 为主表,排序含 sort + company id 并列打破键', async () => {
    await findMemberCompanies({ page: 1, pageSize: 2 })
    const call = lastCall('company-page')

    expect(call.fromTable).toBe('edu_companies')
    expect(call.joinedTables).toEqual(['edu_members'])
    expect(call.groupByArgs.length).toBeGreaterThan(0)

    const orderSql = call.orderByArgs.map((arg) => dialect.sqlToQuery(arg as SQL).sql).join(', ')
    expect(orderSql).toContain('"edu_companies"."sort"')
    expect(orderSql).toContain('"edu_companies"."id"')
  })

  it('total 为去重企业总数(与分页同口径),不是当前页聚合数', async () => {
    const page = await findMemberCompanies({ page: 1, pageSize: 2 })
    expect(page.list).toHaveLength(2)
    expect(page.total).toBe(5) // 5 家企业,不是本页 2 家

    const totalCall = lastCall('company-total')
    expect(totalCall.fromTable).toBe('edu_members')
    expect(totalCall.joinedTables).toEqual(['edu_companies'])
    expect(totalCall.selectSql?.toLowerCase()).toContain('count(distinct')
    expect(totalCall.selectSql).toContain('"edu_members"."company_id"')

    // 超出末页:list 空但 total 仍是全量企业数
    const overflow = await findMemberCompanies({ page: 9, pageSize: 2 })
    expect(overflow.list).toEqual([])
    expect(overflow.total).toBe(5)
  })

  it('name 按企业名过滤:命中 Acme Corp/Gamma Corp,昵称含 Corp 的 Beta Ltd 不命中', async () => {
    const r = await findMemberCompanies({ page: 1, pageSize: 10, name: 'Corp' })
    expect(r.list.map((c) => c.companyId)).toEqual(['c1', 'c3'])
    expect(r.total).toBe(2)
    expect(r.list.some((c) => c.companyId === 'c2')).toBe(false)

    const call = lastCall('company-page')
    const where = dialect.sqlToQuery(call.whereArg as SQL)
    expect(where.sql).toContain('"edu_companies"."name"')
    expect(where.sql.toLowerCase()).toContain('ilike')
    expect(where.params).toEqual(['%Corp%'])
    expect(where.sql).not.toContain('nickname')
  })

  it('返回结构与旧契约同形:企业项 companyId/memberCount/members,成员项四个字段', async () => {
    const r = await findMemberCompanies({ page: 1, pageSize: 1 })
    expect(r.page).toBe(1)
    expect(r.pageSize).toBe(1)

    const item = r.list[0]!
    expect(Object.keys(item).sort()).toEqual(['companyId', 'memberCount', 'members'])
    expect(item.companyId).toBe('c1')
    expect(item.memberCount).toBe(3)
    expect(item.members.map((m) => m.id)).toEqual(['m3', 'm2', 'm1']) // id desc
    expect(Object.keys(item.members[0]!).sort()).toEqual(['email', 'id', 'mobile', 'nickname'])

    // 本页企业的成员全量返回(不因企业分页而截断成员)
    expect(callsOf('page-members')[0]?.limit).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
