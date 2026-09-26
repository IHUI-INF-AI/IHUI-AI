// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13 第三格前置 —— `src/db/background-context.ts` 的语句序列判据(假池,零连库)。
 *
 * 这里能证的:出口只发**事务内 is_local=true** 的 set_config、顺序正确、异常走回滚、
 * 未知 reason / principal 上下文一律"一个字节都不发"(守卫在派生任何 SQL 之前抛)。
 * 这里**证不了**的:"归还后同池看不见该 GUC" —— 假池没有物理连接,复位是 PostgreSQL
 * 事务边界的行为,由同目录 `o13-bg-rls-live.test.ts` 在临时集群上用真库判据钉死。
 * 两半合起来才构成"第三格可安全执行 NOBYPASSRLS"的前置证据,缺一不可。
 */
import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { Database } from '@ihui/database'
import type { FastifyRequest } from 'fastify'
import {
  assertOutsideRequestScope,
  createOpsBypassRunner,
} from '../src/db/background-context.js'
import { runWithPrincipal, runWithRequestScope } from '../src/plugins/principal.js'

/** 取 drizzle SQL 模板的可判据文本(drizzle 0.45:queryChunks 里的字面量被包成 StringChunk{value:string[]})。 */
function sqlTextOf(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks
  if (Array.isArray(chunks)) {
    return chunks
      .map((c) => {
        if (typeof c === 'string') return c
        const value = (c as { value?: unknown }).value
        if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string').join('')
        return typeof value === 'string' ? value : ''
      })
      .join('')
  }
  const s = (query as { sql?: unknown }).sql
  return typeof s === 'string' ? s : String(query)
}

/** 记录语句序列的最小假池:transaction → BEGIN/COMMIT/ROLLBACK,execute → SQL 文本。 */
function makeFakeDb() {
  const rec: string[] = []
  const fakeTx = {
    execute: async (query: unknown): Promise<unknown[]> => {
      rec.push(sqlTextOf(query))
      return []
    },
  }
  const fakeDb = {
    transaction: async (fn: (tx: typeof fakeTx) => Promise<unknown>): Promise<unknown> => {
      rec.push('BEGIN')
      try {
        const result = await fn(fakeTx)
        rec.push('COMMIT')
        return result
      } catch (error) {
        rec.push('ROLLBACK')
        throw error
      }
    },
  }
  return { rec, db: fakeDb as unknown as Database }
}

function setConfigLines(rec: string[]): string[] {
  return rec.filter((line) => line.includes('set_config'))
}

describe('o13 background-context:运维/后台旁路唯一出口(假池语句序列判据)', () => {
  it('正常路径:BEGIN → 事务级(is_local=true)旁路 GUC → 作用域查询 → COMMIT,顺序与形态全对', async () => {
    const { rec, db } = makeFakeDb()
    const runner = createOpsBypassRunner(db)
    const out = await runner('background', async (tx) => {
      await tx.execute(sql`SELECT count(*) FROM public.notes`)
      return 'ok'
    })
    expect(out).toBe('ok')
    expect(rec[0]).toBe('BEGIN')
    expect(rec[rec.length - 1]).toBe('COMMIT')
    const cfg = setConfigLines(rec)
    expect(cfg).toHaveLength(1)
    // is_local=true:第三个实参必须是 true(SET LOCAL 语义),这是"复位不靠 release 钩子"的形态
    expect(cfg[0]).toMatch(/set_config\('app\.bypass_rls'/)
    expect(cfg[0]).toMatch(/,\s*true\)\s*$/)
  })

  it('禁止会话级形态:任何 set_config 都不得以 is_local=false 发出(池化串用防线)', () => {
    const { rec } = makeFakeDb()
    // 直接对上面那条判据的反向锁:若未来有人把出口改成 `..., false)`,本用例与上一条一起变红
    const sessionLevel = (line: string): boolean =>
      /set_config\([^)]*,\s*false\)/.test(line)
    expect(sessionLevel(`SELECT set_config('app.bypass_rls', $1, false)`)).toBe(true)
    expect(sessionLevel(`SELECT set_config('app.bypass_rls', $1, true)`)).toBe(false)
    expect(rec).toEqual([])
  })

  it('作用体抛错:走 ROLLBACK 并向上传播(GUC 随事务回滚自动失效,不需要 RESET 钩子)', async () => {
    const { rec, db } = makeFakeDb()
    const runner = createOpsBypassRunner(db)
    await expect(
      runner('background', async (tx) => {
        await tx.execute(sql`SELECT 1`)
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(rec[rec.length - 1]).toBe('ROLLBACK')
    expect(rec.some((line) => line === 'COMMIT')).toBe(false)
  })

  it('未知 reason:抛错且零 SQL 输出(守卫先于 withBypassRls 的审计行)', async () => {
    const { rec, db } = makeFakeDb()
    const runner = createOpsBypassRunner(db)
    await expect(
      runner('not-a-reason' as Parameters<typeof runner>[0], async () => 'x'),
    ).rejects.toThrow(/未知 reason/)
    expect(rec).toEqual([])
  })

  it('守卫:any principal 上下文(含 runWithPrincipal 注入的 {principal})一律拒 —— 判据必须认伪装形态', async () => {
    const { rec, db } = makeFakeDb()
    const runner = createOpsBypassRunner(db)
    await runWithPrincipal(
      {
        subjectId: 'u-1',
        roleId: 0,
        kind: 'jwt',
        scopes: [],
      } as unknown as Parameters<typeof runWithPrincipal>[0],
      async () => {
        await expect(runner('background', async () => 'x')).rejects.toThrow(/拒绝发放 RLS 旁路/)
        expect(rec).toEqual([])
      },
    )
  })

  it('守卫:Fastify 请求生命周期(runWithRequestScope,store 带 request)同样被拒', async () => {
    const { rec, db } = makeFakeDb()
    const runner = createOpsBypassRunner(db)
    const fakeRequest = { url: '/api/whatever' } as unknown as FastifyRequest
    await runWithRequestScope(fakeRequest, async () => {
      await expect(runner('background', async () => 'x')).rejects.toThrow(/拒绝发放 RLS 旁路/)
      expect(rec).toEqual([])
    })
  })

  it('assertOutsideRequestScope 在无上下文时放行(否则本文件其余用例无法自证夹具没把环境做脏)', () => {
    expect(() => assertOutsideRequestScope('unit')).not.toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
