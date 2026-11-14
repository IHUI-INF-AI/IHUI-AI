// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-600 回归锁(2026-11-13)。
 *
 * 病灶:多处分页列表只按时间列 `ORDER BY <时间列> DESC`,并列行(批量导入、同秒创建、
 * 同事务 `defaultNow()`)在 PG 里顺序不保证稳定 ⇒ 翻页重复/漏行,访问明细导出可能漏数据。
 *
 * 本文件锁:各查询生成的 orderBy 首键仍是原时间列、末键必须补上主键 `desc(<table>.id)`
 * (只追加、不改变原语义)。adopt 的正确样例是 `topic-queries.ts:40` 的 `desc(id)`。
 *
 * 零连接:db 用链式假桩只采集 orderBy 参数,再交给 PgDialect 渲染成 SQL 文本;
 * 不触达真实 PG,也不执行任何 SQL。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ orderBys: [] as unknown[][] }))

vi.mock('../src/db/index.js', () => {
  function makeApi(): Record<string, unknown> {
    const api: Record<string, unknown> = {
      from: () => api,
      where: () => api,
      leftJoin: () => api,
      orderBy: (...args: unknown[]) => {
        state.orderBys.push(args)
        return api
      },
      limit: () => api,
      offset: () => api,
      groupBy: () => api,
      then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve([]).then(res, rej),
    }
    return api
  }
  return {
    db: { select: () => makeApi() },
    dbRead: { select: () => makeApi() },
  }
})

vi.mock('../src/services/audit-log-service.js', () => ({ recordAuditLog: vi.fn() }))

import { PgDialect } from 'drizzle-orm/pg-core'
import { findAiFeedPosts } from '../src/db/ai-feed-post-queries.js'
import { findMcpServers } from '../src/db/mcp-queries.js'
import { findOpenclawItems } from '../src/db/openclaw-queries.js'
import { findPrivateLettersForAdmin } from '../src/db/private-letters-admin-queries.js'
import { findSecurityLogs } from '../src/db/security-logs-queries.js'
import { findSensitiveWords } from '../src/db/sensitive-words-queries.js'
import { findStatisticsSnapshots, findVisitLogList } from '../src/db/statistics-queries.js'
import { findWorkflows, findInstances, findLogs } from '../src/db/workflow-queries.js'

// drizzle 0.45 的 SQL 片段没有 toSQL(),渲染口径只有一条:交给 PgDialect。
const dialect = new PgDialect()

function render(part: unknown): string {
  const wrapper = part as { getSQL?: () => unknown } | undefined
  if (!wrapper || typeof wrapper.getSQL !== 'function') {
    throw new Error('orderBy 片段取不到 getSQL ⇒ 判据失效方向必须是显式报错而不是静默通过')
  }
  return dialect.sqlToQuery(wrapper.getSQL() as never).sql
}

/** 第 n 次被捕获的 orderBy 渲染成排序键列表(未捕获则显式报错)。 */
function orderKeysAt(n: number): string[] {
  const args = state.orderBys[n]
  if (!args) throw new Error(`没有捕获到第 ${n} 次 orderBy 调用(共 ${state.orderBys.length} 次)`)
  return args.map(render)
}

describe('F-600 分页 orderBy 主键 tiebreaker', () => {
  beforeEach(() => {
    state.orderBys.length = 0
  })

  it('ai-feed-post 列表:created_at DESC 后追加 id DESC', async () => {
    await findAiFeedPosts({ page: 1, pageSize: 20 })
    expect(orderKeysAt(0)).toEqual(['"ai_feed_posts"."created_at" desc', '"ai_feed_posts"."id" desc'])
  })

  it('statistics 访问明细:created_at DESC 后追加 id DESC', async () => {
    await findVisitLogList({ page: 1, pageSize: 20 })
    expect(orderKeysAt(0)).toEqual(['"visit_logs"."created_at" desc', '"visit_logs"."id" desc'])
  })

  it('statistics 快照列表:created_at DESC 后追加 id DESC', async () => {
    await findStatisticsSnapshots({ page: 1, pageSize: 20 })
    expect(orderKeysAt(0)).toEqual([
      '"statistics_snapshots"."created_at" desc',
      '"statistics_snapshots"."id" desc',
    ])
  })

  it('workflow 列表/实例/日志:时间列 DESC 后均追加 id DESC', async () => {
    await findWorkflows({ page: 1, pageSize: 20, userId: '00000000-0000-4000-8000-000000000001' })
    await findInstances({ page: 1, pageSize: 20, userId: '00000000-0000-4000-8000-000000000001' })
    await findLogs('00000000-0000-4000-8000-000000000001', { page: 1, pageSize: 20 })

    expect(orderKeysAt(0)).toEqual(['"workflows"."updated_at" desc', '"workflows"."id" desc'])
    expect(orderKeysAt(1)).toEqual([
      '"workflow_instances"."created_at" desc',
      '"workflow_instances"."id" desc',
    ])
    expect(orderKeysAt(2)).toEqual([
      '"workflow_logs"."created_at" desc',
      '"workflow_logs"."id" desc',
    ])
  })

  it('sensitive-words 列表:created_at DESC 后追加 id DESC', async () => {
    await findSensitiveWords({ page: 1, pageSize: 20 })
    expect(orderKeysAt(0)).toEqual([
      '"sensitive_words"."created_at" desc',
      '"sensitive_words"."id" desc',
    ])
  })

  it('mcp / openclaw / 管理端私信 / 安全日志:四处均补主键末键', async () => {
    await findMcpServers({ page: 1, pageSize: 20 })
    await findOpenclawItems({ page: 1, pageSize: 20 })
    await findPrivateLettersForAdmin({ page: 1, pageSize: 20 })
    await findSecurityLogs('00000000-0000-4000-8000-000000000001', 1, 20)

    expect(orderKeysAt(0)).toEqual(['"mcp_servers"."created_at" desc', '"mcp_servers"."id" desc'])
    expect(orderKeysAt(1)).toEqual([
      '"openclaw_items"."created_at" desc',
      '"openclaw_items"."id" desc',
    ])
    expect(orderKeysAt(2)).toEqual([
      '"message_private_letter"."created_at" desc',
      '"message_private_letter"."id" desc',
    ])
    expect(orderKeysAt(3)).toEqual(['"security_logs"."created_at" desc', '"security_logs"."id" desc'])
  })
})

