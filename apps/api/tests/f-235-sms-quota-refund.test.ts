// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as WindowCounter from '../src/utils/window-counter.js'
import { env } from 'node:process'

/**
 * F-235 回归锁(2026-11-13)。
 *
 * 病灶:sendTemplatedSms 先扣单号小时/日窗口与营销全局日上限,通道全部返回 sent:false 时
 * 只落审计、从不 refundWindows —— 一次通道故障就把用户当日通知额度扣光,
 * 营销全局 100 条/日额度也能被 100 次注定失败的请求空转掉;并发去重命中(一条都没发)
 * 同样白烧额度。
 *
 * 本文件锁:
 *   ① 发送失败 ⇒ 本次已扣窗口原样退还;
 *   ② 发送成功 ⇒ 不退还(成功路径行为不变);
 *   ③ 去重命中(in-flight)⇒ 不扣不减,配额判定必须排在扣减之后不存在;
 *   ④ 通道抛错 ⇒ 同样退还,且错误原样上抛;
 *   ⑤ 营销失败 ⇒ 单号两档与全局日额度一起退还。
 *
 * 只 mock 配额计数 / 短信通道 / 合规落库,不连真实 PG、Redis、短信网关。
 */

const quota = vi.hoisted(() => ({
  tryConsumeWindows: vi.fn(),
  refundWindows: vi.fn(),
}))

const compliance = vi.hoisted(() => ({
  hasSmsDeliveryForBiz: vi.fn(),
  isPhoneUnsubscribed: vi.fn(),
  recordSmsDelivery: vi.fn(),
}))

const tencent = vi.hoisted(() => ({
  sendViaTencentTemplate: vi.fn(),
}))

vi.mock('../src/utils/window-counter.js', async (importOriginal) => {
  const actual = await importOriginal<typeof WindowCounter>()
  return {
    ...actual,
    tryConsumeWindows: quota.tryConsumeWindows,
    refundWindows: quota.refundWindows,
  }
})

vi.mock('../src/services/sms-compliance.js', () => ({
  hasSmsDeliveryForBiz: compliance.hasSmsDeliveryForBiz,
  isPhoneUnsubscribed: compliance.isPhoneUnsubscribed,
  recordSmsDelivery: compliance.recordSmsDelivery,
}))

vi.mock('../src/services/sms-tencent.js', () => {
  const templateEnvKeys = (): Record<string, string> =>
    new Proxy({}, { get: () => 'TENCENT_SMS_TEMPLATE_FIXTURE' })
  return {
    isTencentSmsConfigured: () => true,
    sendViaTencent: vi.fn(async () => ({ sent: false, reason: 'not_used_in_this_test' })),
    sendViaTencentTemplate: tencent.sendViaTencentTemplate,
    pickTencentNoticeTemplateId: () => 'tp-notice-fixture',
    pickTencentMarketingTemplateId: () => 'tp-marketing-fixture',
    TENCENT_NOTICE_TEMPLATE_ENV_KEYS: templateEnvKeys(),
    TENCENT_MARKETING_TEMPLATE_ENV_KEYS: templateEnvKeys(),
  }
})

import { sendTemplatedSms } from '../src/services/sms.js'
import type { SmsDeliveryResult } from '../src/services/sms-types.js'
import type { WindowSpec } from '../src/utils/window-counter.js'

const PHONE = '13800138235'
const ENV_KEYS = [
  'SMS_PROVIDER',
  'SMS_API_BASE_URL',
  'ALI_SMS_ACCESS_KEY_ID',
  'ALI_SMS_ACCESS_KEY_SECRET',
  'ALI_SMS_SIGN_NAME',
  'SMS_MARKETING_SEND_WINDOW',
  'SMS_MARKETING_GLOBAL_DAILY_CAP',
] as const
const saved: Record<string, string | undefined> = {}
for (const k of ENV_KEYS) saved[k] = env[k]

const NOTICE_OPTS = {
  category: 'notice',
  templateKey: 'new-device',
  bizType: 'f235',
  bizId: 'case-1',
} as const

beforeEach(() => {
  // 只留腾讯通道:阿里云凭据与代理地址都清掉,换道时无第二档可退(不触达真实网关)
  env.SMS_PROVIDER = 'tencent'
  delete env.SMS_API_BASE_URL
  delete env.ALI_SMS_ACCESS_KEY_ID
  delete env.ALI_SMS_ACCESS_KEY_SECRET
  delete env.ALI_SMS_SIGN_NAME
  env.SMS_MARKETING_SEND_WINDOW = '00:00-24:00'
  delete env.SMS_MARKETING_GLOBAL_DAILY_CAP

  quota.tryConsumeWindows.mockReset()
  quota.tryConsumeWindows.mockResolvedValue(0)
  quota.refundWindows.mockReset()
  quota.refundWindows.mockResolvedValue(undefined)
  compliance.hasSmsDeliveryForBiz.mockReset()
  compliance.hasSmsDeliveryForBiz.mockResolvedValue(false)
  compliance.isPhoneUnsubscribed.mockReset()
  compliance.isPhoneUnsubscribed.mockResolvedValue({ known: true, unsubscribed: false })
  compliance.recordSmsDelivery.mockReset()
  compliance.recordSmsDelivery.mockResolvedValue(undefined)
  tencent.sendViaTencentTemplate.mockReset()
  tencent.sendViaTencentTemplate.mockResolvedValue({ sent: true })
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    const v = saved[k]
    if (v === undefined) delete env[k]
    else env[k] = v
  }
})

describe('F-235 模板短信发送失败必须退还本次已扣配额', () => {
  it('① 通知短信发送失败 ⇒ 本次已扣的两档窗口原样退还', async () => {
    tencent.sendViaTencentTemplate.mockResolvedValue({
      sent: false,
      reason: 'tencent_rejected:FailedOperation.InsufficientBalance',
    } satisfies SmsDeliveryResult)

    const r = await sendTemplatedSms(PHONE, NOTICE_OPTS)

    expect(r.success).toBe(false)
    expect(quota.tryConsumeWindows).toHaveBeenCalledTimes(1)
    expect(quota.refundWindows).toHaveBeenCalledTimes(1)
    const refunded = quota.refundWindows.mock.calls[0]![0] as WindowSpec[]
    expect(refunded.map((s) => s.key)).toEqual([
      `sms:notice:3600000:${PHONE}`,
      `sms:notice:86400000:${PHONE}`,
    ])
  })

  it('② 发送成功 ⇒ 不退还(成功路径不消耗退款)', async () => {
    const r = await sendTemplatedSms(PHONE, NOTICE_OPTS)

    expect(r.success).toBe(true)
    expect(quota.tryConsumeWindows).toHaveBeenCalledTimes(1)
    expect(quota.refundWindows).not.toHaveBeenCalled()
  })

  it('③ 并发去重命中 ⇒ 一条都没发,不扣也不退', async () => {
    let release: ((v: SmsDeliveryResult) => void) | undefined
    tencent.sendViaTencentTemplate.mockImplementation(
      () =>
        new Promise<SmsDeliveryResult>((resolve) => {
          release = resolve
        }),
    )

    const first = sendTemplatedSms(PHONE, NOTICE_OPTS)
    // 等第一次调用真正挂到通道上(此时它已扣过配额并登记了在途业务键)
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))

    const second = await sendTemplatedSms(PHONE, NOTICE_OPTS)

    expect(second.success).toBe(true)
    expect(second.deduplicated).toBe(true)
    // 去重分支在扣减之前 ⇒ 第二次没有新增扣减,也没有产生退款
    expect(quota.tryConsumeWindows).toHaveBeenCalledTimes(1)
    expect(quota.refundWindows).not.toHaveBeenCalled()

    release!({ sent: true })
    await expect(first).resolves.toMatchObject({ success: true })
  })

  it('④ 通道抛错 ⇒ 同样退还,且错误如实上抛', async () => {
    tencent.sendViaTencentTemplate.mockRejectedValue(new Error('tencent sdk exploded'))

    await expect(sendTemplatedSms(PHONE, NOTICE_OPTS)).rejects.toThrow('tencent sdk exploded')

    expect(quota.tryConsumeWindows).toHaveBeenCalledTimes(1)
    expect(quota.refundWindows).toHaveBeenCalledTimes(1)
    const refunded = quota.refundWindows.mock.calls[0]![0] as WindowSpec[]
    expect(refunded.map((s) => s.key)).toEqual([
      `sms:notice:3600000:${PHONE}`,
      `sms:notice:86400000:${PHONE}`,
    ])
  })

  it('⑤ 营销发送失败 ⇒ 单号两档与全局日额度一起退还', async () => {
    tencent.sendViaTencentTemplate.mockResolvedValue({
      sent: false,
      reason: 'tencent_rejected:FailedOperation.InsufficientBalance',
    } satisfies SmsDeliveryResult)

    const r = await sendTemplatedSms(PHONE, {
      category: 'marketing',
      templateKey: 'promo',
      fallbackContent: '营销兜底正文',
      bizType: 'f235',
      bizId: 'case-5',
    })

    expect(r.success).toBe(false)
    // 两轮扣减:单号日/月窗口 + 营销全局日上限
    expect(quota.tryConsumeWindows).toHaveBeenCalledTimes(2)
    expect(quota.refundWindows).toHaveBeenCalledTimes(1)
    const refunded = quota.refundWindows.mock.calls[0]![0] as WindowSpec[]
    expect(refunded.map((s) => s.key)).toEqual([
      `sms:marketing:86400000:${PHONE}`,
      `sms:marketing:2592000000:${PHONE}`,
      'sms:marketing:global',
    ])
  })
})
