// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * 考勤 IM 同步 · 审批三类(请假/加班/外出)映射钉子(2026-11-14)。
 *
 * 钉住 design §7.4 的映射边界:
 *   · 飞书三类已放开:mapApprovalDataToRows 把官方响应实例 → SyncRow;
 *     假别(i18n_names.ch)透传不写死,加班/外出未核实字段留 null(不臆造);
 *   · externalId 取 approval_id(幂等键),缺失留 null 不编;
 *   · 钉钉三类仍保持 501 NOT_IMPLEMENTED(审批端点选择 + 表单字段名未取样核实)。
 *
 * 纪律(AGENTS §22c):只测生产实现,不复制实现逻辑;不写死猜测枚举。
 */
import { describe, expect, it } from 'vitest'

import { mapApprovalDataToRows } from '../src/services/attendance-sync/feishu-provider.js'
import { dingtalkProvider } from '../src/services/attendance-sync/dingtalk-provider.js'

describe('飞书审批映射 mapApprovalDataToRows(已核实字段)', () => {
  it('leave:employeeNo=uniq_id,假别取 i18n_names.ch 透传,externalId=approval_id', () => {
    const rows = mapApprovalDataToRows('leave', {
      leaves: [
        {
          approval_id: 'ap-001',
          uniq_id: 'emp-100',
          i18n_names: { ch: '事假', en: 'Personal' },
          start_time: '2026-11-01 09:00:00',
          end_time: '2026-11-01 18:00:00',
          reason: '家中有事',
        },
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.employeeNo).toBe('emp-100')
    // 假别透传中文,不写死枚举(交 normalizeLeaveType 匹配/人工裁决)
    expect(rows[0]!.typeText).toBe('事假')
    expect(rows[0]!.externalId).toBe('ap-001')
    expect(rows[0]!.startDate).toBe('2026-11-01')
    expect(rows[0]!.endDate).toBe('2026-11-01')
    expect(rows[0]!.checkInTime).toBe('09:00')
    expect(rows[0]!.checkOutTime).toBe('18:00')
    expect(rows[0]!.reason).toBe('家中有事')
    // 状态官方字段名未核实 → 留空交人工,不猜测
    expect(rows[0]!.statusText).toBeNull()
  })

  it('overtime:未核实类型/时长字段留 null,仅取已核实 approval_id/uniq_id/起止/事由', () => {
    const rows = mapApprovalDataToRows('overtime', {
      overtimes: [
        {
          approval_id: 'ot-1',
          uniq_id: 'emp-200',
          start_time: '2026-11-02 18:00:00',
          end_time: '2026-11-02 22:00:00',
          reason: '项目上线',
        },
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.employeeNo).toBe('emp-200')
    expect(rows[0]!.typeText).toBeNull()
    expect(rows[0]!.durationText).toBeNull()
    expect(rows[0]!.externalId).toBe('ot-1')
    expect(rows[0]!.checkInTime).toBe('18:00')
    expect(rows[0]!.checkOutTime).toBe('22:00')
  })

  it('outgoing:destination 取官方字段,类型/时长未核实留 null', () => {
    const rows = mapApprovalDataToRows('outgoing', {
      outs: [
        {
          approval_id: 'out-1',
          uniq_id: 'emp-300',
          start_time: '2026-11-03 09:00:00',
          end_time: '2026-11-03 12:00:00',
          destination: '北京客户现场',
          reason: '上门服务',
        },
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.employeeNo).toBe('emp-300')
    expect(rows[0]!.destination).toBe('北京客户现场')
    expect(rows[0]!.typeText).toBeNull()
    expect(rows[0]!.durationText).toBeNull()
    expect(rows[0]!.externalId).toBe('out-1')
  })

  it('leave:i18n_names 无 ch 回落 en;全缺留 null,不编假别', () => {
    const rows = mapApprovalDataToRows('leave', {
      leaves: [
        {
          approval_id: 'ap-2',
          uniq_id: 'emp-101',
          i18n_names: { en: 'Sick' },
          start_time: '2026-11-04 09:00:00',
          end_time: '2026-11-04 18:00:00',
        },
      ],
    })
    expect(rows[0]!.typeText).toBe('Sick')

    const noI18n = mapApprovalDataToRows('leave', {
      leaves: [
        {
          approval_id: 'ap-3',
          uniq_id: 'emp-102',
          start_time: '2026-11-05 09:00:00',
          end_time: '2026-11-05 18:00:00',
        },
      ],
    })
    expect(noI18n[0]!.typeText).toBeNull()
  })

  it('approval_id 缺失 ⇒ externalId 留 null(不编幂等键,交去重/人工裁决处理)', () => {
    const rows = mapApprovalDataToRows('leave', {
      leaves: [
        {
          uniq_id: 'emp-400',
          i18n_names: { ch: '病假' },
          start_time: '2026-11-06 09:00:00',
          end_time: '2026-11-06 18:00:00',
        },
      ],
    })
    expect(rows[0]!.externalId).toBeNull()
    expect(rows[0]!.employeeNo).toBe('emp-400')
  })

  it('kind 与字段错配 ⇒ 不跨类取数(leave 请求不读 outs,反之亦然)', () => {
    // leave 请求只看 leaves
    expect(mapApprovalDataToRows('leave', { outs: [{ uniq_id: 'x', approval_id: 'a' }] })).toHaveLength(0)
    // overtime 请求只看 overtimes
    expect(mapApprovalDataToRows('overtime', { leaves: [{ uniq_id: 'y', approval_id: 'b' }] })).toHaveLength(0)
    // outgoing 请求只看 outs
    expect(mapApprovalDataToRows('outgoing', { overtimes: [{ uniq_id: 'z', approval_id: 'c' }] })).toHaveLength(0)
    // attendance 走打卡 fetch,不经本函数;本函数不产行
    expect(mapApprovalDataToRows('attendance', {})).toHaveLength(0)
  })
})

describe('钉钉审批三类保持 NOT_IMPLEMENTED(501)', () => {
  it('dingtalk.fetchBatch 对 leave/overtime/outgoing 抛 501 SYNC_DINGTALK_APPROVAL_NOT_IMPLEMENTED', async () => {
    for (const kind of ['leave', 'overtime', 'outgoing'] as const) {
      await expect(
        dingtalkProvider.fetchBatch({
          userId: 'u',
          creds: { appId: 'a', appSecret: 's' },
          importKind: kind,
          cursor: null,
          periodMonth: '2026-11',
        }),
      ).rejects.toThrow(/尚未实现/)
    }
  })
})
