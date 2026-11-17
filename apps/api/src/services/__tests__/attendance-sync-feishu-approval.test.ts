// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 飞书审批映射单测(2026-11-14 立;2026-11-17 按官方文档改容器结构,RP-16)。
 *
 * 钉住(全部来自 open.feishu.cn 官方文档,2026-11-17 核实):
 *   ① 响应容器结构:data.user_approvals[].{leaves|overtimes|outs}[];
 *   ② leave:假别取 i18n_names.ch 透传,externalId=approval_id;
 *   ③ employeeNo 取 uniq_id,缺失回落 entry.user_id;
 *   ④ status 数字枚举 → 中文(0/1/2/3/4),未知 → null;
 *   ⑤ statusText 由调用方按请求 status 传入,不读响应中未证实字段;
 *   ⑥ 30 天窗口切片:31 天月两片,30 天月一片,2 月一片;
 *   ⑦ 多语言缺 ch 时回落 en;时间字符串缺时分 → HH:mm 为 null;空容器 → 空数组。
 *
 * 全部走 `__test__.mapApprovalEntriesToRows` 等生产实现,不 mock fetch/网络。
 */

import { describe, expect, it } from 'vitest'

import {
  approvalDateSlices,
  feishuApprovalStatusText,
  FEISHU_APPROVAL_STATUS_TEXT,
  mapApprovalEntriesToRows,
} from '../attendance-sync/feishu-provider.js'

describe('飞书审批映射 · 容器结构', () => {
  it('① leave:从 user_approvals[] 容器取 leaves[]', () => {
    const rows = mapApprovalEntriesToRows('leave', [
      {
        user_id: 'E001',
        date: '20261020',
        leaves: [
          {
            approval_id: 'a-001',
            uniq_id: 'E001',
            i18n_names: { ch: '事假', en: 'Personal' },
            start_time: '2026-10-20 09:00:00',
            end_time: '2026-10-21 18:00:00',
            reason: '家中有事',
          },
        ],
      },
    ])
    expect(rows).toHaveLength(1)
    const r = rows[0]!
    expect(r.employeeNo).toBe('E001')
    expect(r.typeText).toBe('事假')
    expect(r.startDate).toBe('2026-10-20')
    expect(r.endDate).toBe('2026-10-21')
    expect(r.checkInTime).toBe('09:00')
    expect(r.checkOutTime).toBe('18:00')
    expect(r.reason).toBe('家中有事')
    expect(r.externalId).toBe('a-001')
  })

  it('③ uniq_id 缺失 → 回落 entry.user_id', () => {
    const rows = mapApprovalEntriesToRows('leave', [
      { user_id: 'E009', leaves: [{ approval_id: 'a-009', start_time: '2026-10-20 09:00:00' }] },
    ])
    expect(rows[0]!.employeeNo).toBe('E009')
  })

  it('② overtime:取 overtimes[],类型/时长官方字段未明示 → null', () => {
    const rows = mapApprovalEntriesToRows('overtime', [
      {
        user_id: 'E001',
        overtimes: [
          {
            approval_id: 'ot-001',
            uniq_id: 'E001',
            start_time: '2026-10-20 18:00:00',
            end_time: '2026-10-20 22:00:00',
          },
        ],
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.externalId).toBe('ot-001')
    expect(rows[0]!.date).toBe('2026-10-20')
    expect(rows[0]!.typeText).toBeNull()
    expect(rows[0]!.durationText).toBeNull()
  })

  it('② outgoing:取 outs[],destination/reason 透传', () => {
    const rows = mapApprovalEntriesToRows('outgoing', [
      {
        user_id: 'E003',
        outs: [
          {
            approval_id: 'out-001',
            uniq_id: 'E003',
            destination: '客户现场',
            reason: '上门服务',
            start_time: '2026-10-20 14:00:00',
            end_time: '2026-10-20 17:30:00',
          },
        ],
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.destination).toBe('客户现场')
    expect(rows[0]!.reason).toBe('上门服务')
    expect(rows[0]!.checkInTime).toBe('14:00')
    expect(rows[0]!.checkOutTime).toBe('17:30')
  })

  it('typeText 只对 leave 生效(overtime 行不留假别)', () => {
    const rows = mapApprovalEntriesToRows('overtime', [
      { overtimes: [{ approval_id: 'ot-2', start_time: '2026-10-20 18:00:00' }] },
    ])
    expect(rows[0]!.typeText).toBeNull()
  })
})

describe('飞书审批状态 · 数字枚举', () => {
  it('④ 0/1/2/3/4 全部映射为中文', () => {
    expect(FEISHU_APPROVAL_STATUS_TEXT[0]).toBe('待审批')
    expect(FEISHU_APPROVAL_STATUS_TEXT[1]).toBe('未通过')
    expect(FEISHU_APPROVAL_STATUS_TEXT[2]).toBe('已通过')
    expect(FEISHU_APPROVAL_STATUS_TEXT[3]).toBe('已撤回')
    expect(FEISHU_APPROVAL_STATUS_TEXT[4]).toBe('已撤销')
  })

  it('未知状态 → null(不臆造)', () => {
    expect(feishuApprovalStatusText(99)).toBeNull()
  })

  it('⑤ statusText 由调用方传入,行上如实落', () => {
    const rows = mapApprovalEntriesToRows(
      'leave',
      [{ leaves: [{ approval_id: 'a-3', start_time: '2026-10-20 09:00:00' }] }],
      feishuApprovalStatusText(3),
    )
    expect(rows[0]!.statusText).toBe('已撤回')
  })
})

describe('飞书审批窗口 · 30 天切片', () => {
  it('⑥ 31 天月 → 两片,每片跨度 ≤30 天', () => {
    const slices = approvalDateSlices('2026-01')
    expect(slices).toEqual([
      { from: 20260101, to: 20260130 },
      { from: 20260131, to: 20260131 },
    ])
  })

  it('⑥ 30 天月 → 一片', () => {
    expect(approvalDateSlices('2026-11')).toEqual([{ from: 20261101, to: 20261130 }])
  })

  it('⑥ 2 月 → 一片', () => {
    expect(approvalDateSlices('2026-02')).toEqual([{ from: 20260201, to: 20260228 }])
  })
})

describe('飞书审批映射 · 边界', () => {
    it('⑦ 多语言缺 ch → 回落 en', () => {
    const rows = mapApprovalEntriesToRows('leave', [
      { leaves: [{ approval_id: 'a-002', i18n_names: { en: 'Sick Leave' } }] },
    ])
    expect(rows[0]!.typeText).toBe('Sick Leave')
  })

  it('⑦ 时间字符串缺时分 → HH:mm 为 null', () => {
    const rows = mapApprovalEntriesToRows('leave', [
      { leaves: [{ approval_id: 'a-003', start_time: '2026-10-20' }] },
    ])
    expect(rows[0]?.checkInTime).toBeNull()
    expect(rows[0]?.startDate).toBe('2026-10-20')
  })

  it('⑦ 空容器 → 返回空数组不报错', () => {
    expect(mapApprovalEntriesToRows('leave', [])).toEqual([])
    expect(mapApprovalEntriesToRows('overtime', [])).toEqual([])
    expect(mapApprovalEntriesToRows('outgoing', [])).toEqual([])
    expect(mapApprovalEntriesToRows('leave', [{}])).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
