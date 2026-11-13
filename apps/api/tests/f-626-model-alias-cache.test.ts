// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-626 回归锁(2026-11-13)。
 *
 * 病灶:模型别名解析固定读 `dbRead` 只读副本且无缓存 —— 管理端删除/禁用别名写主库,
 * 副本追平前转发器仍命中旧行,下线动作存在复制延迟窗口;同时高 QPS 每请求一次 DB 查询。
 *
 * 本文件锁:
 *   ① 解析走主库 `db`,不碰 `dbRead`;
 *   ② 命中进程内 TTL 缓存后不再查库(正/负结果都缓存);
 *   ③ 删除别名后缓存立即失效,下一次解析立刻读不到(下线即时生效);
 *   ④ 新建别名后负缓存立即失效(新映射马上可见),写路径不吃旧缓存;
 *   ⑤ 查询异常不入缓存(故障不被缓存掩盖,恢复后下次解析即可用)。
 *
 * 只 mock db 模块,不触达真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { dbSelect, dbReadSelect, dbInsert, dbDelete } = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  dbReadSelect: vi.fn(),
  dbInsert: vi.fn(),
  dbDelete: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: (...args: unknown[]) => dbSelect(...args),
    insert: (...args: unknown[]) => dbInsert(...args),
    delete: (...args: unknown[]) => dbDelete(...args),
  },
  dbRead: { select: (...args: unknown[]) => dbReadSelect(...args) },
  dbClient: {},
}))

import {
  resolveModelAlias,
  createModelCatalog,
  deleteModelCatalog,
} from '../src/services/relay-model-catalog.js'

/** select().from().where().limit(1) 链式桩 */
function selectRows(rows: unknown[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
  }
  return chain
}

/** 查询失败桩:limit 直接 reject */
function selectFailure(message: string) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.reject(new Error(message)),
  }
  return chain
}

/** insert().values().returning() 链式桩 */
function insertReturning(rows: unknown[]) {
  const chain = {
    values: () => chain,
    returning: async () => rows,
  }
  return chain
}

/** delete().where().returning() 链式桩 */
function deleteReturning(rows: unknown[]) {
  const chain = {
    where: () => chain,
    returning: async () => rows,
  }
  return chain
}

describe('F-626 别名解析:主库 + TTL 缓存 + 写后失效', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('① 解析走主库连接,不读只读副本', async () => {
    dbSelect.mockReturnValueOnce(selectRows([{ upstreamModel: 'up-primary', displayName: null }]))

    const resolved = await resolveModelAlias('f626-primary', 'alias-primary')

    expect(resolved).toEqual({ upstreamModel: 'up-primary', displayName: 'up-primary' })
    expect(dbSelect).toHaveBeenCalledTimes(1)
    expect(dbReadSelect).not.toHaveBeenCalled()
  })

  it('② 命中缓存后不再查询(正结果与负结果都缓存)', async () => {
    dbSelect.mockReturnValueOnce(
      selectRows([{ upstreamModel: 'up-cache', displayName: '缓存模型' }]),
    )

    const first = await resolveModelAlias('f626-cache', 'alias-hit')
    const second = await resolveModelAlias('f626-cache', 'alias-hit')

    expect(second).toEqual(first)
    expect(dbSelect).toHaveBeenCalledTimes(1)

    dbSelect.mockReturnValueOnce(selectRows([]))
    expect(await resolveModelAlias('f626-cache', 'alias-miss')).toBeNull()
    expect(await resolveModelAlias('f626-cache', 'alias-miss')).toBeNull()
    expect(dbSelect).toHaveBeenCalledTimes(2)
  })

  it('③ 删除别名后缓存立即失效,解析立刻不再命中', async () => {
    dbSelect.mockReturnValueOnce(selectRows([{ upstreamModel: 'up-del', displayName: null }]))
    expect(await resolveModelAlias('f626-del', 'alias-del')).not.toBeNull()

    dbDelete.mockReturnValueOnce(
      deleteReturning([{ id: 'catalog-1', providerCode: 'f626-del', alias: 'alias-del' }]),
    )
    expect(await deleteModelCatalog('catalog-1')).toBe(true)

    dbSelect.mockReturnValueOnce(selectRows([]))
    expect(await resolveModelAlias('f626-del', 'alias-del')).toBeNull()
    expect(dbSelect).toHaveBeenCalledTimes(2)
    expect(dbReadSelect).not.toHaveBeenCalled()
  })

  it('④ 新建别名后负缓存立即失效,新映射马上生效', async () => {
    dbSelect.mockReturnValueOnce(selectRows([]))
    expect(await resolveModelAlias('f626-create', 'alias-new')).toBeNull()

    dbInsert.mockReturnValueOnce(
      insertReturning([
        {
          id: 'catalog-2',
          providerCode: 'f626-create',
          alias: 'alias-new',
          upstreamModel: 'up-new',
        },
      ]),
    )
    await createModelCatalog({
      providerCode: 'f626-create',
      upstreamModel: 'up-new',
      alias: 'alias-new',
    })

    dbSelect.mockReturnValueOnce(selectRows([{ upstreamModel: 'up-new', displayName: null }]))
    expect(await resolveModelAlias('f626-create', 'alias-new')).toEqual({
      upstreamModel: 'up-new',
      displayName: 'up-new',
    })
    expect(dbSelect).toHaveBeenCalledTimes(2)
  })

  it('⑤ 查询异常不入缓存,恢复后立即重新解析', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    dbSelect.mockReturnValueOnce(selectFailure('db down'))
    expect(await resolveModelAlias('f626-error', 'alias-error')).toBeNull()

    dbSelect.mockReturnValueOnce(selectRows([{ upstreamModel: 'up-ok', displayName: null }]))
    expect(await resolveModelAlias('f626-error', 'alias-error')).toEqual({
      upstreamModel: 'up-ok',
      displayName: 'up-ok',
    })
    expect(dbSelect).toHaveBeenCalledTimes(2)

    warn.mockRestore()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
