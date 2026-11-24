// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * createStoreAccount 单元测试(纯 mock,不连库)。
 * 锁定应用上架平台账号的「永久保活」登记位:extraMetadata.keepAliveForever 必须为 true,
 * 且与 AI 客户端号同口径;同时确认它不被调度命中(tempUnschedulable=true / sharedToOps=false)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { dbMock, captured } = vi.hoisted(() => {
  const captured: { values?: Record<string, unknown> } = {}
  function makeValuesChain(result: unknown) {
    const chain: Record<string, unknown> = {}
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
    chain.values = () => chain
    chain.onConflictDoNothing = () => chain
    chain.returning = () => chain
    return chain
  }
  const dbMock = {
    insert: vi.fn(() => {
      const vc = makeValuesChain([{ id: '00000000-0000-4000-8000-000000000000' }])
      const realValues = vc.values as (v: unknown) => unknown
      vc.values = (v: unknown) => {
        captured.values = v as Record<string, unknown>
        return realValues(v)
      }
      return vc
    }),
  }
  return { dbMock, captured }
})

vi.mock('../../src/db/index.js', () => ({ db: dbMock }))
vi.mock('../../src/utils/crypto.js', () => ({ encryptField: () => '__enc__' }))

import { createStoreAccount } from '../../src/services/relay-store-accounts.js'

describe('createStoreAccount 永久保活登记', () => {
  beforeEach(() => {
    captured.values = undefined
    dbMock.insert.mockClear()
  })

  it('把 keepAliveForever:true 写进 extraMetadata(与 AI 客户端号同口径)', async () => {
    const res = await createStoreAccount({
      providerCode: 'huawei-agc',
      name: '华为AGC',
      uid: '186******08',
    })
    expect(res.created).toBe(true)
    expect(captured.values).toBeDefined()
    const meta = (captured.values!.extraMetadata ?? {}) as Record<string, unknown>
    expect(meta.storePlatform).toBe(true)
    expect(meta.keepAliveForever).toBe(true)
    expect(captured.values!.tempUnschedulable).toBe(true)
    expect(captured.values!.sharedToOps).toBe(false)
  })

  it('未知平台直接抛错(不写库)', async () => {
    await expect(
      createStoreAccount({ providerCode: 'not-a-platform', name: 'x', uid: 'y' }),
    ).rejects.toThrow()
    expect(dbMock.insert).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
