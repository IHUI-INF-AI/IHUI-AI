// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815962(2026-10-01)写后必须回读 —— "not found after write" 是一句显式断言。
 *
 * 覆盖三格(每格正反成对):
 *  1. upsertSkillBySlug 复活路径:活行面回读得到 ⇒ 返回回读记录(非 update().returning() 的
 *     输入面回声);回读不到(软删未清干净)⇒ 当场抛错。
 *  2. deleteSkill:tombstone 回读确认;行彻底不在 ⇒ 抛。
 *  3. removeBindingByPlatform:解绑后活行面必须为空;"仍 live after unbind" ⇒ 抛。
 *
 * 全程 mock db,不连任何真实 DB / Redis(§5 测试隔离铁律)。mock 以**调用序**出队:
 * 被测函数的 db 调用次序是固定的,测试按该序排结果;链式 builder 直接可 await。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

/** db 调用按序出队的结果队列;每条用例自排自清(hoisted:vi.mock 工厂在模块求值前执行) */
const { queue } = vi.hoisted(() => ({ queue: [] as unknown[] }))

vi.mock('../src/db/index.js', () => {
  const makeChain = () => {
    const chain: Record<string, unknown> = {}
    const terminal = () => Promise.resolve(queue.shift())
    for (const m of ['set', 'values', 'where', 'from', 'limit', 'offset', 'orderBy']) {
      chain[m] = () => chain
    }
    chain.returning = terminal
    // 支持无 returning() 的直接 await(update/select 顶层)
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown): unknown =>
      terminal().then(res, rej)
    return chain
  }
  return {
    db: {
      select: () => makeChain(),
      update: () => makeChain(),
      insert: () => makeChain(),
      delete: () => makeChain(),
      execute: vi.fn(),
    },
  }
})

import { upsertSkillBySlug, deleteSkill } from '../src/db/skills-queries.js'
import { removeBindingByPlatform } from '../src/db/oauth-queries.js'

const AUTHOR = '7f0f3f2a-1c4b-4a8e-9d21-0a3b5c7e9f01'
const SLUG = 'g815962-readback'

beforeAll(() => {
  queue.length = 0
})

describe('G-815962 写后回读 · skills upsert 复活路径', () => {
  it('复活成功 ⇒ 返回活行面回读到的记录(不是 update().returning() 的回声)', async () => {
    const existing = { id: 'row-1', authorId: AUTHOR, slug: SLUG, deletedAt: new Date('2026-09-01') }
    const echoedByReturning = { ...existing, deletedAt: null, updatedAt: new Date('2026-09-02') }
    // 回读行刻意与 returning() 回声不同字段值:引用等值断言才能证明"返回的是回读行"
    const readBackRow = { ...existing, deletedAt: null, updatedAt: new Date('2026-09-03') }


    console.error('DEBUG-test same-array=', (globalThis as Record<string, unknown>).__g815962q === queue, 'len=', queue.length)
    // 直连 await 的 select 出队必须是数组(调用方做 rows[0] / stillLive.length)
    queue.push([existing], [echoedByReturning], [readBackRow])

    const r = await upsertSkillBySlug({
      slug: SLUG,
      name: 'n',
      content: 'c2',
      contentHash: 'h2',
      authorId: AUTHOR,
    })
    expect(r.action).toBe('updated')
    expect(r.skill).toBe(readBackRow)
    expect(queue).toHaveLength(0)
  })

  it('写成功但活行面看不见(软删未清干净)⇒ 当场抛错,反向对照', async () => {
    const existing = { id: 'row-2', authorId: AUTHOR, slug: SLUG, deletedAt: new Date('2026-09-01') }
    const echoedByReturning = { ...existing, deletedAt: null }
    queue.push([existing], [echoedByReturning], []) // 回读空 ⇒ 复活没生效
    await expect(
      upsertSkillBySlug({
        slug: SLUG,
        name: 'n',
        content: 'c3',
        contentHash: 'h3',
        authorId: AUTHOR,
      }),
    ).rejects.toThrow(/not found after upsert/)
  })
})

describe('G-815962 写后回读 · deleteSkill tombstone 确认', () => {
  it('软删落上 ⇒ 返回回读到的 tombstone 行', async () => {
    const tombstone = { id: 'row-3', authorId: AUTHOR, slug: SLUG, deletedAt: new Date() }
    queue.push(null, [tombstone]) // update 终态(无 returning)→ 回读(直连 await 出队=数组)
    const row = await deleteSkill('row-3')
    expect(row).toBe(tombstone)
    expect(row.deletedAt).not.toBeNull()
  })

  it('行彻底不在 ⇒ 抛 not found after delete,反向对照', async () => {
    queue.push(null, [])
    await expect(deleteSkill('row-missing')).rejects.toThrow(/not found after delete/)
  })
})

describe('G-815962 写后回读 · oauth removeBindingByPlatform', () => {
  it('解绑后活行面为空 ⇒ 回报本次真正改动的那批 id', async () => {
    queue.push([{ id: 'binding-a' }], [])
    const ids = await removeBindingByPlatform(AUTHOR, 'github')
    expect(ids).toEqual(['binding-a'])
    expect(queue).toHaveLength(0)
  })

  it('写"成功"但活行仍在 ⇒ 抛 still live after unbind,反向对照(半解绑不得当成功)', async () => {
    queue.push([{ id: 'binding-b' }], [{ id: 'binding-b' }])
    await expect(removeBindingByPlatform(AUTHOR, 'github')).rejects.toThrow(
      /still live after unbind/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
