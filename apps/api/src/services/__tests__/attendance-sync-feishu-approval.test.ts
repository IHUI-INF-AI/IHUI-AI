// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * 飞书审批映射单测(2026-11-14 立,RP-16)。
 *
 * 钉住:
 *   ① leave 映射:employeeNo=uniq_id,假别取 i18n_names.ch 透传,externalId=approval_id,statusText=null;
 *   ② overtime 映射:外部字段(类型/时长)官方名未核实 → 全 null,externalId 保留 approval_id;
 *   ③ outgoing 映射:destination/reason 透传,externalId 保留 approval_id;
 *   ④ 多语言缺 ch 时回落 en;
 *   ⑤ 时间字符串 → 日期/HH:mm 正确提取;
 *   ⑥ 空响应 → 返回空数组不报错。
 *
 * 全部走 `__test__.mapApprovalDataToRows` 直用生产实现,不 mock fetch/网络。
 */

import { describe, expect, it } from 'vitest'

import { mapApprovalDataToRows } from '../attendance-sync/feishu-provider.js'

describe('飞书审批映射 · leave', () => {
  it('① 基本 leave:字段正确映射', () => {
    const rows = mapApprovalDataToRows('leave', {
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
    })
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
    // 审批状态官方字段未核实 → statusText 留空,交人工裁决
    expect(r.statusText).toBeNull()
  })

  it('④ i18n_names 缺 ch → 回落 en', () => {
    const rows = mapApprovalDataToRows('leave', {
      leaves: [
        { approval_id: 'a-002', uniq_id: 'E002', i18n_names: { en: 'Sick Leave' } },
      ],
    })
    expect(rows[0]!.typeText).toBe('Sick Leave')
  })
})

describe('飞书审批映射 · overtime', () => {
  it('② overtime:外部字段全 null,externalId/approval_id 保留', () => {
    const rows = mapApprovalDataToRows('overtime', {
      overtimes: [
        {
          approval_id: 'ot-001',
          uniq_id: 'E001',
          start_time: '2026-10-20 18:00:00',
          end_time: '2026-10-20 22:00:00',
        },
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.externalId).toBe('ot-001')
    expect(rows[0]!.employeeNo).toBe('E001')
    expect(rows[0]!.date).toBe('2026-10-20')
    // overtime 类型/时长字段名官方未核实 → null
    expect(rows[0]!.typeText).toBeNull()
    expect(rows[0]!.durationText).toBeNull()
  })
})

describe('飞书审批映射 · outgoing', () => {
  it('③ outgoing:destination/reason 透传,externalId 保留', () => {
    const rows = mapApprovalDataToRows('outgoing', {
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
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.destination).toBe('客户现场')
    expect(rows[0]!.reason).toBe('上门服务')
    expect(rows[0]!.externalId).toBe('out-001')
    expect(rows[0]!.checkInTime).toBe('14:00')
    expect(rows[0]!.checkOutTime).toBe('17:30')
  })
})

describe('飞书审批映射 · 边界', () => {
  it('⑤ 时间字符串缺时分 → HH:mm 为 null', () => {
    const rows = mapApprovalDataToRows('leave', {
      leaves: [
        { approval_id: 'a-003', uniq_id: 'E001', start_time: '2026-10-20' },
      ],
    })
    expect(rows[0]?.checkInTime).toBeNull()
    expect(rows[0]?.startDate).toBe('2026-10-20')
  })

  it('⑥ 空响应 → 返回空数组不报错', () => {
    expect(mapApprovalDataToRows('leave', {})).toEqual([])
    expect(mapApprovalDataToRows('overtime', {})).toEqual([])
    expect(mapApprovalDataToRows('outgoing', {})).toEqual([])
  })
})
