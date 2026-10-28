// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 签到助手契约类型测试:镜像 apps/ai-service/app/services/checkin_store.py 的
 * _account_row / _record_row 序列化形态,锁定两条不变量:
 *   1. CheckinAccount 的键集合里绝不允许出现 jwt / jwt_enc(脱敏纪律);
 *   2. 记录/积分流水字段与后端行序列化逐键对齐(ok 可空、credits_delta 可空等)。
 */
import { describe, it, expect } from 'vitest'
import type {
  CheckinAccount,
  CheckinRecord,
  CheckinCreditsHistoryItem,
  CreateCheckinAccountIn,
  CheckinAccountsResponse,
  CheckinRecordsResponse,
  CheckinCreditsHistoryResponse,
} from '../src/checkin.js'

describe('checkin 契约 · 脱敏不变量', () => {
  it('CheckinAccount 样例对象不得含 jwt / jwt_enc 键', () => {
    const account: CheckinAccount = {
      id: 1,
      name: '主账号',
      device_map: { device_id: 'abc' },
      enabled: true,
      created_at: '2026-10-03T00:00:00+00:00',
      updated_at: '2026-10-03T00:00:00+00:00',
      last_record: {
        ok: true,
        action: 'checkin',
        message: 'ok',
        credits: 120,
        created_at: '2026-10-03T08:00:00+00:00',
      },
    }
    const keys = Object.keys(account)
    expect(keys).not.toContain('jwt')
    expect(keys).not.toContain('jwt_enc')
    expect(account.last_record?.credits).toBe(120)
  })

  it('录入请求类型必须显式携带 jwt(唯一允许出现 jwt 的契约面)', () => {
    const input: CreateCheckinAccountIn = { name: '主账号', jwt: 'eyJhbGciOi...' }
    expect(input.device_map).toBeUndefined()
    expect(typeof input.jwt).toBe('string')
  })
})

describe('checkin 契约 · 记录/流水形态对齐后端 _record_row', () => {
  it('CheckinRecord 的 ok / classified_error / credits_delta 允许为 null(请求未完成)', () => {
    const record: CheckinRecord = {
      id: 7,
      account_id: 1,
      ok: null,
      action: null,
      http_status: null,
      code: null,
      message: '网络超时',
      classified_error: null,
      cooldown_until: null,
      credits: null,
      credits_delta: null,
      created_at: '2026-10-03T08:00:00+00:00',
    }
    expect(record.ok).toBeNull()
    expect(record.credits_delta).toBeNull()
  })

  it('积分流水项 credits_delta 为必填数值(聚合时已过滤 null)', () => {
    const item: CheckinCreditsHistoryItem = {
      id: 7,
      account_id: 1,
      ok: true,
      action: 'checkin',
      credits: 125,
      credits_delta: 5,
      created_at: '2026-10-03T08:00:00+00:00',
    }
    expect(item.credits_delta).toBe(5)
  })

  it('列表响应包裹形态:{accounts|records|history, count, total_credits_delta?}', () => {
    const accountsRes: CheckinAccountsResponse = { accounts: [], count: 0 }
    const recordsRes: CheckinRecordsResponse = { records: [], count: 0 }
    const creditsRes: CheckinCreditsHistoryResponse = {
      history: [],
      count: 0,
      total_credits_delta: 0,
    }
    expect(accountsRes.count).toBe(0)
    expect(recordsRes.count).toBe(0)
    expect(creditsRes.total_credits_delta).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
