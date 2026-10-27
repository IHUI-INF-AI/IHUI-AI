// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 短信合规与回调判据的纯函数夹具(2026-10-26)。
 *
 * 这几条一旦放宽,后果不是"多发一条",而是:
 *  - 任意号码被写进退订黑名单(回调无鉴权时);
 *  - 失败回执被记成已送达(照抄云侧原文当结果);
 *  - 营销短信发给已退订用户(投诉一次封通道)。
 * 因此每条判据都成对钉:成功侧 + 失败侧。
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  isUnsubscribeReply,
  normalizeSmsPhone,
  hashSmsPhone,
  maskSmsPhone,
} from '../src/services/sms-compliance.js'
import {
  classifyTencentCallback,
  coerceCallbackBody,
  isSmsCallbackAuthorized,
  judgeTencentReport,
  parseTencentCallback,
} from '../src/services/sms-callback-parse.js'
import { pickTencentNoticeTemplateId } from '../src/services/sms-tencent.js'
import {
  extractSmsSendGuard,
  isMarketingSendWindow,
  isMarketingSmsEnabled,
  resolveTemplatedSmsChannel,
} from '../src/services/sms.js'

const ENV_KEYS = [
  'SMS_PROVIDER',
  'TENCENT_SMS_SECRET_ID',
  'TENCENT_SMS_SECRET_KEY',
  'TENCENT_SMS_SDK_APP_ID',
  'TENCENT_SMS_SIGN_NAME',
  'TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE',
  'TENCENT_SMS_TEMPLATE_MARKETING_NEW_FEATURE',
  'ALI_SMS_ACCESS_KEY_ID',
  'ALI_SMS_ACCESS_KEY_SECRET',
  'ALI_SMS_SIGN_NAME',
  'ALI_SMS_NOTIFY_TEMPLATE_CODE',
  'SMS_API_BASE_URL',
] as const

const originals = new Map<string, string | undefined>()

function setEnv(key: string, value: string): void {
  if (!originals.has(key)) originals.set(key, process.env[key])
  process.env[key] = value
}

function clearEnv(key: string): void {
  if (!originals.has(key)) originals.set(key, process.env[key])
  delete process.env[key]
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = originals.get(key)
    if (original === undefined) delete process.env[key]
    else process.env[key] = original
  }
  originals.clear()
})

describe('号码归一', () => {
  it('把 +86 / 0086 / 86 前缀都归一成 11 位裸号', () => {
    expect(normalizeSmsPhone('+8613800138000')).toBe('13800138000')
    expect(normalizeSmsPhone('008613800138000')).toBe('13800138000')
    expect(normalizeSmsPhone('8613800138000')).toBe('13800138000')
    expect(normalizeSmsPhone(' 138-0013-8000 ')).toBe('13800138000')
  })
})

describe('退订回复判定', () => {
  it('认明确拒收表达', () => {
    for (const content of ['R', 'r', 'TD', 'T', '退订', '退订回T', '拒收', '取消订阅', 'STOP']) {
      expect(isUnsubscribeReply(content), content).toBe(true)
    }
  })

  it('不把正常回复误判成退订', () => {
    for (const content of ['', '你好', 'RMB', '我要退订你们']) {
      expect(isUnsubscribeReply(content), content).toBe(false)
    }
  })
})

describe('腾讯云回调解析', () => {
  it('状态回执与上行回复能分类', () => {
    expect(
      classifyTencentCallback({ result: 0, phone_number: '+8613800138000', serial_no: 's1' }),
    ).toBe('status')
    expect(classifyTencentCallback({ phone_number: '+8613800138000', content: 'R' })).toBe('reply')
    expect(classifyTencentCallback({ foo: 'bar' })).toBe('unknown')
  })

  it('取号/对账字段兼容多种命名', () => {
    const meta = parseTencentCallback({
      phone_number: '+8613800138000',
      requestId: 'req-1',
      serialNo: 'serial-1',
      content: 'R',
    })
    expect(meta).toMatchObject({
      phone: '+8613800138000',
      requestId: 'req-1',
      serialNo: 'serial-1',
      content: 'R',
    })
    expect(parseTencentCallback({ request_id: 'no-phone' })).toBeNull()
  })

  it('result=0 / DELIVRD 算送达,其余一律算失败', () => {
    expect(judgeTencentReport({ result: 0 })).toEqual({ delivered: true, code: 'OK' })
    expect(judgeTencentReport({ error_code: 'DELIVRD' })).toEqual({
      delivered: true,
      code: 'DELIVRD',
    })
    expect(judgeTencentReport({ result: 2 }).delivered).toBe(false)
    expect(judgeTencentReport({ status: 'UNDELIV' })).toEqual({
      delivered: false,
      code: 'UNDELIV',
    })
    expect(judgeTencentReport(null)).toEqual({ delivered: false, code: 'unparsable' })
  })

  it('字符串形态的回调体能解析,坏 JSON 判空', () => {
    expect(coerceCallbackBody('{"result":0}')).toEqual({ result: 0 })
    expect(coerceCallbackBody('not-json')).toBeNull()
  })
})

describe('回调鉴权两道闸', () => {
  it('token 必须完全一致', () => {
    expect(
      isSmsCallbackAuthorized({ providedToken: 'abc', expectedToken: 'abc', ip: '1.2.3.4' }),
    ).toBe(true)
    expect(
      isSmsCallbackAuthorized({ providedToken: 'abd', expectedToken: 'abc', ip: '1.2.3.4' }),
    ).toBe(false)
    expect(isSmsCallbackAuthorized({ expectedToken: 'abc', ip: '1.2.3.4' })).toBe(false)
  })

  it('IP 白名单兼容 ::ffff: 前缀', () => {
    expect(isSmsCallbackAuthorized({ ip: '::ffff:1.2.3.4', allowlist: '1.2.3.4, 5.6.7.8' })).toBe(
      true,
    )
    expect(isSmsCallbackAuthorized({ ip: '9.9.9.9', allowlist: '1.2.3.4' })).toBe(false)
  })

  it('两道都没配时放行,交由调用方做发送记录兜底', () => {
    expect(isSmsCallbackAuthorized({ ip: '9.9.9.9' })).toBe(true)
  })
})

describe('营销发送时段(北京时间)', () => {
  it('08:00–21:00 内放行,窗口外拦截', () => {
    // 2026-10-26T02:00:00Z = 10:00 北京时间
    expect(isMarketingSendWindow(new Date('2026-10-26T02:00:00Z'), '08:00-21:00')).toBe(true)
    // 2026-10-26T14:00:00Z = 22:00 北京时间
    expect(isMarketingSendWindow(new Date('2026-10-26T14:00:00Z'), '08:00-21:00')).toBe(false)
    // 2026-10-25T23:30:00Z = 07:30 北京时间
    expect(isMarketingSendWindow(new Date('2026-10-25T23:30:00Z'), '08:00-21:00')).toBe(false)
  })

  it('跨零点窗口也能判', () => {
    // 23:00 落在 22:00-06:00 窗口内
    expect(isMarketingSendWindow(new Date('2026-10-26T15:00:00Z'), '22:00-06:00')).toBe(true)
    // 12:00 落在窗口外
    expect(isMarketingSendWindow(new Date('2026-10-26T04:00:00Z'), '22:00-06:00')).toBe(false)
  })
})

describe('结构化模板通道解析', () => {
  it('腾讯模板已回填时 auto 优先腾讯', () => {
    setEnv('SMS_PROVIDER', 'auto')
    setEnv('TENCENT_SMS_SECRET_ID', 'id')
    setEnv('TENCENT_SMS_SECRET_KEY', 'key')
    setEnv('TENCENT_SMS_SDK_APP_ID', '1400000000')
    setEnv('TENCENT_SMS_SIGN_NAME', '签名')
    setEnv('TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE', '2759148')

    expect(pickTencentNoticeTemplateId('new-device')).toBe('2759148')
    expect(resolveTemplatedSmsChannel('notice', 'new-device', 'auto', false)).toEqual({
      channel: 'tencent',
      templateId: '2759148',
      envKey: 'TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE',
    })
  })

  it('腾讯模板未回填时回落到阿里云通知模板', () => {
    setEnv('SMS_PROVIDER', 'auto')
    setEnv('TENCENT_SMS_SECRET_ID', 'id')
    setEnv('TENCENT_SMS_SECRET_KEY', 'key')
    setEnv('TENCENT_SMS_SDK_APP_ID', '1400000000')
    setEnv('TENCENT_SMS_SIGN_NAME', '签名')
    clearEnv('TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE')
    setEnv('ALI_SMS_ACCESS_KEY_ID', 'ak')
    setEnv('ALI_SMS_ACCESS_KEY_SECRET', 'sk')
    setEnv('ALI_SMS_SIGN_NAME', '阿里签名')
    setEnv('ALI_SMS_NOTIFY_TEMPLATE_CODE', 'SMS_1')
    clearEnv('SMS_API_BASE_URL')

    expect(resolveTemplatedSmsChannel('notice', 'new-device', 'auto', true)).toMatchObject({
      channel: 'aliyun',
    })
    // 没有兜底正文时,阿里云通知模板也用不了 ⇒ 无通道
    expect(resolveTemplatedSmsChannel('notice', 'new-device', 'auto', false).channel).toBeNull()
  })

  it('营销模板走独立 env 键,不与通知模板串用', () => {
    setEnv('SMS_PROVIDER', 'tencent')
    setEnv('TENCENT_SMS_SECRET_ID', 'id')
    setEnv('TENCENT_SMS_SECRET_KEY', 'key')
    setEnv('TENCENT_SMS_SDK_APP_ID', '1400000000')
    setEnv('TENCENT_SMS_SIGN_NAME', '签名')
    clearEnv('TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE')
    setEnv('TENCENT_SMS_TEMPLATE_MARKETING_NEW_FEATURE', '2759152')

    expect(resolveTemplatedSmsChannel('marketing', 'new-feature', 'tencent', false)).toEqual({
      channel: 'tencent',
      templateId: '2759152',
      envKey: 'TENCENT_SMS_TEMPLATE_MARKETING_NEW_FEATURE',
    })
  })
})

describe('营销总开关(A5)', () => {
  it('缺省开启;0/false/off 关闭(大小写不敏感)', () => {
    expect(isMarketingSmsEnabled(undefined)).toBe(true)
    expect(isMarketingSmsEnabled('1')).toBe(true)
    expect(isMarketingSmsEnabled('0')).toBe(false)
    expect(isMarketingSmsEnabled('FALSE')).toBe(false)
    expect(isMarketingSmsEnabled(' off ')).toBe(false)
  })
})

describe('验证码 IP/设备防刷(A4)', () => {
  it('只认显式 x-device-id;非法/缺失时不拿 UA 哈希兜底', () => {
    const withHeader = extractSmsSendGuard({ 'x-device-id': 'dev-abc-123' }, '1.2.3.4')
    expect(withHeader).toEqual({ ip: '1.2.3.4', deviceId: 'dev-abc-123' })

    // 同一版本浏览器的 UA 完全相同,若拿它当设备键会把整批正常用户打成 429。
    const illegal = extractSmsSendGuard(
      { 'x-device-id': 'bad id!', 'user-agent': 'UA-1' },
      '1.2.3.4',
    )
    expect(illegal).toEqual({ ip: '1.2.3.4', deviceId: undefined })

    const missing = extractSmsSendGuard({ 'user-agent': 'UA-1' }, undefined)
    expect(missing).toEqual({ ip: undefined, deviceId: undefined })
  })
})

describe('号码哈希与掩码(A6)', () => {
  it('同一号码稳定同值,不同号码不同值,输出 64 位十六进制', () => {
    const a = hashSmsPhone('13800138000')
    expect(a).toBe(hashSmsPhone('+8613800138000'))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(hashSmsPhone('13800138001'))
  })

  it('掩码只留前 3 后 4,短号统一 ***', () => {
    expect(maskSmsPhone('13800138000')).toBe('138****8000')
    expect(maskSmsPhone('123')).toBe('***')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
