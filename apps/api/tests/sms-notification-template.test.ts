// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'node:process'
import { sendSmsMessage } from '../src/services/sms.js'

/**
 * 通知短信（非验证码）的配置判定契约 —— 立票理由：
 * `sendSmsMessage` 曾在"有阿里云凭据、但没配通知模板"时**回落到验证码模板**
 * （占位符 `{code}` vs `{content}` 不匹配，必被阿里云拒发），更在缺签名 / SDK 不可用时
 * 返回 `success: true`。两个调用方（`routes/notifications.ts:609`、
 * `workers/notification-dispatch-worker.ts:60`）把它记成 `status='sent'` 落 `notification_logs`
 * —— 也就是"根本没发出去的一条短信，在留痕里是已发送"。本文件把这条钉死：
 * 没配通知模板 ⇒ 判"未配置"，且**不得发起任何网络请求**（拿注定被拒发的模板去撞云侧，
 * 留痕里只会是一行看不懂原因的报错）。
 */
describe('sendSmsMessage：通知类短信的凭据/模板判定', () => {
  const KEYS = [
    'ALI_SMS_ACCESS_KEY_ID',
    'ALI_SMS_ACCESS_KEY_SECRET',
    'ALI_SMS_SIGN_NAME',
    'ALI_SMS_TEMPLATE_CODE',
    'ALI_SMS_NOTIFY_TEMPLATE_CODE',
    'SMS_API_BASE_URL',
  ] as const
  const saved: Record<string, string | undefined> = {}
  for (const k of KEYS) saved[k] = env[k]

  afterEach(() => {
    for (const k of KEYS) {
      const v = saved[k]
      if (v === undefined) delete env[k]
      else env[k] = v
    }
    vi.restoreAllMocks()
  })

  it('有凭据但未配通知模板 ⇒ 判未配置、不记为已发送，且不碰验证码模板、不发任何请求', async () => {
    env.ALI_SMS_ACCESS_KEY_ID = 'ak-test'
    env.ALI_SMS_ACCESS_KEY_SECRET = 'sk-test'
    env.ALI_SMS_SIGN_NAME = '测试签名'
    env.ALI_SMS_TEMPLATE_CODE = 'SMS_VERIFY_ONLY' // 验证码模板：绝不可被通知腿借用
    delete env.ALI_SMS_NOTIFY_TEMPLATE_CODE

    const fetchSpy = vi.fn(() => Promise.reject(new Error('不该发出网络请求')))
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch)

    const r = await sendSmsMessage('13800000002', '这是一条通用通知正文')
    expect(r.success).toBe(false)
    expect(r.error).toContain('not_configured')
    expect(r.error).toContain('ALI_SMS_NOTIFY_TEMPLATE_CODE')
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('完全没有阿里云凭据、也没配代理 ⇒ 维持 dev console 降级（行为一字未改，仍是 success）', async () => {
    for (const k of KEYS) delete env[k]
    const r = await sendSmsMessage('13800000003', 'dev 环境通知')
    expect(r.success).toBe(true)
    expect(r.error ?? '').toBe('')
  })

  it('有凭据与通知模板但缺签名 ⇒ 判未配置（旧写法会 return success:true ⇒ 留痕记成已发送）', async () => {
    env.ALI_SMS_ACCESS_KEY_ID = 'ak-test'
    env.ALI_SMS_ACCESS_KEY_SECRET = 'sk-test'
    env.ALI_SMS_NOTIFY_TEMPLATE_CODE = 'SMS_512575533'
    delete env.ALI_SMS_SIGN_NAME
    const fetchSpy = vi.fn(() => Promise.reject(new Error('不该发出网络请求')))
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch)

    const r = await sendSmsMessage('13800000004', '缺签名的通知')
    expect(r.success).toBe(false)
    expect(r.error).toContain('not_configured')
    expect(r.error).toContain('ALI_SMS_SIGN_NAME')
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
