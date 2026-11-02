// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * S-STATS 残余 R1「option a」隔离锁:findAgentTasksByAgentId 的 createdBy 过滤谓词。
 *
 * 本文件直接调真函数 `findAgentTasksByAgentId`(来自 src/db/agent-queries.js),
 * 用 chainable mock 截获其 `.where(...)` 谓词,再用 `PgDialect.sqlToQuery` 把谓词
 * 渲染成最终 SQL(纯 SQL 生成,不连库 —— 本环境无测试库,见文件尾说明)。
 *
 * 验证三档行级语义(谓词层面):
 *   (a) 行 createdBy = A,查看者 B ⇒ 谓词为 `created_by = B OR created_by IS NULL`,
 *       A 既不等于 B 也不为 NULL ⇒ 该行被排除(跨租户不可见);
 *   (b) 行 createdBy = NULL,任意查看者 ⇒ 谓词含 `created_by IS NULL` 分支 ⇒ 该行命中(未标注可见);
 *   (c) 行 createdBy = B,查看者 B ⇒ 谓词含 `created_by = B` 分支 ⇒ 该行命中(本人可见)。
 *
 * 另验:不传 viewerUserId 时退化为仅 `agent_id =` 过滤(历史 ALL 可见行为不变)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const { captured } = vi.hoisted(() => ({ captured: { where: null as unknown } }))

// 截获 findAgentTasksByAgentId 内部 `.where(predicate)` 的谓词。
// chainable 末端 await 时解析为 [] ⇒ 函数返回 [];我们只关心谓词本身。
vi.mock('../src/db/index.js', () => {
  const makeChain = () =>
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then')
            return (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
          if (prop === 'where')
            return (w: unknown) => {
              captured.where = w
              return makeChain()
            }
          return () => makeChain()
        },
      },
    )
  const dbRead = { select: () => makeChain() }
  return { db: { select: vi.fn() }, dbRead, dbClient: {} }
})

// 提供与真实 agent_tasks 同形的最小列集合(仅函数用到的 agentId/createdBy/createdAt),
// 让谓词引用的是可序列化的真实 drizzle 列(否则 eq/isNull 无法渲染)。
vi.mock('@ihui/database', async () => {
  const { pgTable, uuid, timestamp } = await import('drizzle-orm/pg-core')
  const agentTasks = pgTable('agent_tasks', {
    agentId: uuid('agent_id'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }),
  })
  return { agentTasks }
})

import { findAgentTasksByAgentId } from '../src/db/agent-queries.js'

const dialect = new PgDialect()

/** 调真函数并返回其生成的 WHERE 谓词渲染结果 */
async function renderWhere(agentId: string, limit: number, viewerUserId?: string) {
  captured.where = null
  await findAgentTasksByAgentId(agentId, limit, viewerUserId)
  if (!captured.where) throw new Error('findAgentTasksByAgentId 未调用 .where()')
  return dialect.sqlToQuery(captured.where as never)
}

const A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'

describe('S-STATS R1 option a:findAgentTasksByAgentId 的 createdBy 隔离谓词', () => {
  beforeEach(() => {
    captured.where = null
  })

  it('(c) 行 createdBy=B, viewer=B ⇒ 谓词含 `created_by = B` 分支,本人可见', async () => {
    const q = await renderWhere('agent-1', 50, B)
    // 绑定参数顺序:agentId 之后是 viewer
    expect(q.params).toContain(B)
    expect(q.sql).toContain('"created_by" = $')
    expect(q.sql).toContain('"created_by" is null')
  })

  it('(a) 行 createdBy=A, viewer=B ⇒ 谓词只引用 B 与 IS NULL,绝不引用 A(跨租户被排除)', async () => {
    const q = await renderWhere('agent-1', 50, B)
    // 关键反证:谓词里不得出现 A 这个租户,否则就是泄漏面
    expect(q.params).not.toContain(A)
    expect(q.sql).not.toContain(A)
    // 仍保留 IS NULL 分支(历史 NULL 行可见)
    expect(q.sql).toContain('"created_by" is null')
  })

  it('(b) 行 createdBy=NULL,任意 viewer ⇒ 谓词含 `created_by IS NULL` 分支,未标注可见', async () => {
    const q = await renderWhere('agent-1', 50, 'any-viewer-id')
    expect(q.sql).toContain('"created_by" is null')
  })

  it('不传 viewerUserId ⇒ 退化成仅 `agent_id =` 过滤(历史 ALL 可见行为不变)', async () => {
    const q = await renderWhere('agent-1', 50)
    expect(q.sql).toContain('"agent_id" = $')
    expect(q.sql).not.toContain('created_by')
    expect(q.params).toEqual(['agent-1'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
