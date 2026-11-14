// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 考勤同步器最近运行状态单测(2026-11-13 立)。
 * mock db.select/insert/update,验证 upsert:首次插入、再次覆盖、非法 JSON 容错。
 * 模式同 attendance-sync-feishu-source.test.ts 的 vi.mock db 范式。
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}))

vi.mock('@ihui/database', () => ({
  systemConfigs: { id: 'id', key: 'key', value: 'value' },
}))

import { db } from '../../db/index.js'
import { readLastRunStatus, writeLastRunStatus } from '../attendance-sync/sync-status.js'

const mockSelect = db.select as ReturnType<typeof vi.fn>
const mockInsert = db.insert as ReturnType<typeof vi.fn>
const mockUpdate = db.update as ReturnType<typeof vi.fn>

/** select 链:where→limit→Promise rows */
function chainSelect(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({ limit: () => Promise.resolve(rows) }),
    }),
  }
}

/** insert 链 values 函数签名(供类型收窄) */
type ValuesFn = (arg: Record<string, unknown>) => Promise<unknown>

beforeEach(() => {
  mockSelect.mockReset()
  mockInsert.mockReset()
  mockUpdate.mockReset()
})

const SAMPLE = {
  enabled: true,
  scannedUsers: 2,
  attempted: 4,
  syncedBatches: 3,
  skippedNotImplemented: 1,
  errors: ['feishu/leave/user=u1: boom'],
}

describe('sync-status — 最近运行状态 upsert', () => {
  it('从未跑过 → readLastRunStatus 返回 null', async () => {
    mockSelect.mockReturnValue(chainSelect([]))
    expect(await readLastRunStatus()).toBeNull()
  })

  it('首次写 → insert(无 existing)', async () => {
    mockSelect.mockReturnValue(chainSelect([]))
    const values = vi.fn<ValuesFn>(() => Promise.resolve())
    mockInsert.mockReturnValue({ values })

    await writeLastRunStatus(SAMPLE)

    expect(values).toHaveBeenCalledTimes(1)
    const arg = values.mock.calls[0]![0]
    expect(arg.key).toBe('sync:attendance:last-run')
    const parsed = JSON.parse(arg.value as string) as Record<string, unknown>
    expect(parsed.enabled).toBe(true)
    expect(parsed.syncedBatches).toBe(3)
    expect(typeof parsed.finishedAt).toBe('string')
  })

  it('已存在 → update 覆盖(不 insert)', async () => {
    mockSelect.mockReturnValue(chainSelect([{ id: 'cfg-1' }]))
    const set = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }))
    mockUpdate.mockReturnValue({ set })

    await writeLastRunStatus(SAMPLE)

    expect(set).toHaveBeenCalledTimes(1)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('状态 JSON 非法 → readLastRunStatus 容错返回 null,不崩溃', async () => {
    mockSelect.mockReturnValue(chainSelect([{ value: 'not-json{{' }]))
    expect(await readLastRunStatus()).toBeNull()
  })

  it('读回合法状态 → 字段完整', async () => {
    const stored = { ...SAMPLE, finishedAt: '2026-11-13T02:00:00.000Z' }
    mockSelect.mockReturnValue(chainSelect([{ value: JSON.stringify(stored) }]))

    const s = await readLastRunStatus()
    expect(s).not.toBeNull()
    expect(s!.enabled).toBe(true)
    expect(s!.scannedUsers).toBe(2)
    expect(s!.errors).toEqual(['feishu/leave/user=u1: boom'])
    expect(s!.finishedAt).toBe('2026-11-13T02:00:00.000Z')
  })
})
