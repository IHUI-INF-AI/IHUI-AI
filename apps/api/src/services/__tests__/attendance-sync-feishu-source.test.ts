// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 飞书目标员工工号来源单测(2026-11-13 立)。
 *
 * 「两者结合」口径:默认读名册全量;配了白名单则取交集收窄。
 * mock db.select 按查询列区分名册(employeeNo)与白名单(value)。
 * 模式同 coupon-claim-by-id.test.ts 的 vi.mock db 范式。
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../db/index.js', () => ({
  db: { select: vi.fn() },
}))

vi.mock('@ihui/database', () => ({
  userProfiles: { employeeNo: 'employee_no' },
  systemConfigs: { key: 'key', value: 'value' },
}))

import { db } from '../../db/index.js'
import { resolveFeishuEmployeeNos } from '../attendance-sync/feishu-employee-source.js'

const mockSelect = db.select as ReturnType<typeof vi.fn>

/** 构造 select 链:where→limit→返回 Promise rows */
function chainSelect(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
        // 名册侧无 limit 调用,兜底 thenable
        then: (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res),
      }),
      then: (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res),
    }),
  }
}

beforeEach(() => {
  mockSelect.mockReset()
})

describe('resolveFeishuEmployeeNos — 两者结合口径', () => {
  it('名册全量,未配白名单 → 返回所有非空工号(去重)', async () => {
    mockSelect.mockImplementation((cols: { employeeNo?: unknown }) => {
      // 名册查询列含 employeeNo
      if ('employeeNo' in cols) {
        return chainSelect([
          { employeeNo: 'E001' },
          { employeeNo: 'E002' },
          { employeeNo: 'E001' }, // 重复
          { employeeNo: '  ' }, // 空白
          { employeeNo: null }, // 空
        ])
      }
      // 白名单查询 → 未配置(null)
      return chainSelect([null])
    })

    const nos = await resolveFeishuEmployeeNos('u1')
    expect(nos.sort()).toEqual(['E001', 'E002'])
  })

  it('配了白名单 → 取名册∩白名单(收窄,白名单多余项忽略)', async () => {
    mockSelect.mockImplementation((cols: { employeeNo?: unknown }) => {
      if ('employeeNo' in cols) {
        return chainSelect([{ employeeNo: 'E001' }, { employeeNo: 'E002' }, { employeeNo: 'E003' }])
      }
      // 白名单只列 E001/E003 → E002 被收窄掉
      return chainSelect([{ value: '["E001","E003","E999"]' }])
    })

    const nos = await resolveFeishuEmployeeNos('u1')
    expect(nos.sort()).toEqual(['E001', 'E003'])
  })

  it('名册为空 → 直接返回 [](不查白名单,provider 返 0 行)', async () => {
    mockSelect.mockImplementation((cols: { employeeNo?: unknown }) => {
      if ('employeeNo' in cols) return chainSelect([{ employeeNo: null }, { employeeNo: ' ' }])
      return chainSelect([null])
    })

    const nos = await resolveFeishuEmployeeNos('u1')
    expect(nos).toEqual([])
  })

  it('白名单 JSON 非法 → 视为不收窄(返回名册全量,不崩溃)', async () => {
    mockSelect.mockImplementation((cols: { employeeNo?: unknown }) => {
      if ('employeeNo' in cols) return chainSelect([{ employeeNo: 'E001' }, { employeeNo: 'E002' }])
      return chainSelect([{ value: 'not-json{{' }])
    })

    const nos = await resolveFeishuEmployeeNos('u1')
    expect(nos.sort()).toEqual(['E001', 'E002'])
  })
})
