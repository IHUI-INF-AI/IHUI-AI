// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * updateMenu 幂等写:同值二次提交不得推进 updatedAt(G-998153 落地,2026-10-09 立,不连库:mock db)。
 *
 * 缺陷:apps/api/src/db/admin-sys-queries.ts 的 updateMenu 旧写法是
 *   `.set({ ...data, updatedAt: new Date() })` —— 请求里有什么就写什么,再无条件盖 updatedAt。
 *   该列是增量读的消费源(routes/tasks.ts 的 since 补拉、admin-extended/user-routes.ts:220 的
 *   gte 七日窗口):同值空写会把「没变」伪装成「变过」,WS 重连补拉被假变化污染。
 *
 * 现口径(2026-10-09 起,函数内注释同源):先取现值、按键比较,只有真变化的字段进 set;
 *   无变化 ⇒ 不发 UPDATE、不盖 updatedAt、原记录原样返回;id 不存在 ⇒ 返回 undefined 且不发 UPDATE。
 *
 * 用例设计(六条各守一格,互不重复):
 *   ① 同值二次提交 ⇒ db.update 一次都不被调用,返回值与现值逐毫秒同一(updatedAt 不推进)
 *   ② 真变化 ⇒ update 恰一次,set 只含变化键 + updatedAt(未传键/同值键都不进 set)
 *   ③ id 不存在 ⇒ 返回 undefined,不发 UPDATE
 *   ④ 传显式 undefined 的键 ⇒ 不算变化、不进 set(与旧 drizzle 展开语义一致)
 *   ⑤ 机制锁:select(取现值)必须先于 update —— 否则「先取现值」是摆设,①②可以靠运气绿
 *   ⑥ 同值但带 updateBy 变化 ⇒ 仍发 UPDATE(防「全部同值」判据误伤真实审计字段)
 * 变异自证:把函数内 `if (Object.keys(changed).length === 0) return existing` 摘掉 ⇒ ①③ 必红。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockSelectResult: { rows: Array<Record<string, unknown>> } = { rows: [] }
const mockUpdateSet = vi.fn()
const mockUpdateReturning = vi.fn()

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => {
      const step: Record<string, unknown> = {}
      for (const m of ['from', 'where']) step[m] = vi.fn(() => step)
      step.then = (resolve: (v: unknown) => void) => resolve(mockSelectResult.rows)
      return step
    }),
    update: vi.fn(() => ({
      set: (arg: unknown) => {
        mockUpdateSet(arg)
        return { where: () => ({ returning: mockUpdateReturning }) }
      },
    })),
  },
}))

import { updateMenu } from '../src/db/admin-sys-queries.js'

const ID = '11111111-1111-4111-8111-111111111111'
const T1 = new Date('2026-10-09T00:00:00.000Z')

function existingRow() {
  return {
    id: ID,
    parentId: null,
    menuName: '旧名',
    orderNum: 3,
    path: '/demo',
    component: null,
    query: null,
    isFrame: false,
    isCache: false,
    menuType: 'C',
    visible: '0',
    status: '0',
    perms: null,
    icon: null,
    createBy: 'seeder',
    createdAt: T1,
    updateBy: 'seeder',
    updatedAt: T1,
    remark: null,
  }
}

beforeEach(() => {
  mockSelectResult.rows = [existingRow()]
  mockUpdateSet.mockReset()
  mockUpdateReturning.mockReset()
  mockUpdateReturning.mockResolvedValue([])
})

describe('updateMenu 幂等写:同值二次提交不得推进 updatedAt', () => {
  it('① 同值二次提交 ⇒ 不发 UPDATE,原记录逐毫秒原样返回', async () => {
    const before = await updateMenu(ID, {})
    // 同一请求形态:调用方把「看到的现值」原样交回(管理端常见:打开表单 → 不改 → 保存)
    const again = await updateMenu(ID, {
      menuName: '旧名',
      orderNum: 3,
      path: '/demo',
      isFrame: false,
      menuType: 'C',
    })

    expect(mockUpdateSet).not.toHaveBeenCalled()
    expect(before?.updatedAt).toBe(T1)
    expect(again?.updatedAt).toBe(T1) // 逐毫秒不变:同一 Date 对象,不是 new Date()
    expect(again?.menuName).toBe('旧名')
  })

  it('② 真变化 ⇒ update 恰一次,set 只含变化键 + updatedAt', async () => {
    const next = { ...existingRow(), menuName: '新名', updatedAt: new Date('2026-10-09T01:00:00.000Z') }
    mockUpdateReturning.mockResolvedValue([next])

    const out = await updateMenu(ID, { menuName: '新名', path: '/demo' })

    expect(mockUpdateSet).toHaveBeenCalledTimes(1)
    const arg = mockUpdateSet.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(arg).sort()).toEqual(['menuName', 'updatedAt']) // path 同值不进 set
    expect(arg.menuName).toBe('新名')
    expect(arg.updatedAt).toBeInstanceOf(Date)
    expect(out?.menuName).toBe('新名')
  })

  it('③ id 不存在 ⇒ 返回 undefined 且不发 UPDATE', async () => {
    mockSelectResult.rows = []
    const out = await updateMenu(ID, { menuName: '随便' })

    expect(out).toBeUndefined()
    expect(mockUpdateSet).not.toHaveBeenCalled()
  })

  it('④ 显式 undefined 的键 ⇒ 不算变化、不进 set', async () => {
    const out = await updateMenu(ID, { menuName: '旧名', remark: undefined })

    expect(mockUpdateSet).not.toHaveBeenCalled()
    expect(out?.updatedAt).toBe(T1)
  })

  it('⑤ 机制锁:select(取现值)必须先于 update —— 先取现值不是摆设', async () => {
    const calls: string[] = []
    const dbModule = (await import('../src/db/index.js')) as unknown as {
      db: { select: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
    }
    dbModule.db.select.mockImplementation(() => {
      calls.push('select')
      const step: Record<string, unknown> = {}
      for (const m of ['from', 'where']) step[m] = vi.fn(() => step)
      step.then = (resolve: (v: unknown) => void) => resolve([existingRow()])
      return step
    })
    dbModule.db.update.mockImplementation(() => {
      calls.push('update')
      return {
        set: (arg: unknown) => {
          mockUpdateSet(arg)
          return { where: () => ({ returning: mockUpdateReturning }) }
        },
      }
    })

    await updateMenu(ID, { menuName: '新名' })
    expect(calls[0]).toBe('select')
    expect(calls).toContain('update')
    expect(calls.indexOf('select')).toBeLessThan(calls.indexOf('update'))
  })

  it('⑥ 同值但 updateBy 变化 ⇒ 仍发 UPDATE(审计字段是真变化)', async () => {
    mockUpdateReturning.mockResolvedValue([{ ...existingRow(), updateBy: 'admin2' }])
    const out = await updateMenu(ID, { menuName: '旧名', updateBy: 'admin2' })

    expect(mockUpdateSet).toHaveBeenCalledTimes(1)
    const arg = mockUpdateSet.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(arg).sort()).toEqual(['updateBy', 'updatedAt'])
    expect(out?.updateBy).toBe('admin2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
