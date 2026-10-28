// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterEach } from 'vitest'
import { env } from 'node:process'
import { __test__ as tx } from '../src/services/sms-tencent.js'
import { pickConfiguredSmsChannel, smsProviderOrder } from '../src/services/sms.js'

/**
 * 腾讯云短信通道的判定契约。
 *
 * 立票理由:阿里云那条腿刚踩过两个"失败长得像成功"的坑(构造函数互操作、不看响应体)。
 * 换一家厂商最容易做的事就是把同一个坑再挖一遍 —— 腾讯云恰好也返回 HTTP 200,
 * 而且把真实结果藏在 `Response.SendStatusSet[].Code` 里。所以本文件的核心是:
 * **每一种"没发出去"的形态都必须各有成对夹具,且判不出来时一律算没发出去。**
 *
 * 请求字段名 `SmsSdkAppId`(不是 SdkAppId)与必填集是 2026-10-22 对真 API 打空参探出来的,
 * 不是照文档抄的 —— 腾讯云对缺参的报错会逐个点名下一个必填字段,比记忆可靠。
 */

const KEYS = [
  'TENCENT_SMS_SECRET_ID',
  'TENCENT_SMS_SECRET_KEY',
  'TENCENT_SMS_SDK_APP_ID',
  'TENCENT_SMS_SIGN_NAME',
  'TENCENT_SMS_TEMPLATE_CODE',
  'TENCENT_SMS_TEMPLATE_CODE_LOGIN',
  'TENCENT_SMS_TEMPLATE_CODE_REGISTER',
  'TENCENT_SMS_TEMPLATE_CODE_RESET',
  'TENCENT_SMS_TEMPLATE_CODE_PHONE_BINDING',
] as const

const saved: Record<string, string | undefined> = {}
for (const k of KEYS) saved[k] = env[k]

function setAll(o: Partial<Record<(typeof KEYS)[number], string | undefined>>): void {
  for (const k of KEYS) {
    const v = o[k]
    if (v === undefined) delete env[k]
    else env[k] = v
  }
}
function restore(): void {
  setAll(saved)
}
afterEach(restore)

describe('toTencentPhone：国内号码必须带 +86', () => {
  it('11 位裸号补 +86', () => {
    expect(tx.toTencentPhone('13800138000')).toBe('+8613800138000')
  })
  it('已带 + 前缀的原样保留(不得二次加成 +86+86)', () => {
    expect(tx.toTencentPhone('+8613800138000')).toBe('+8613800138000')
    expect(tx.toTencentPhone('+14155552671')).toBe('+14155552671')
  })
  it('0086 前缀归一到 +86', () => {
    expect(tx.toTencentPhone('008613800138000')).toBe('+8613800138000')
  })
  it('首尾空白吃掉', () => {
    expect(tx.toTencentPhone('  13800138000 ')).toBe('+8613800138000')
  })
})

describe('judgeTencentSendResponse：HTTP 200 有两种"没发出去"', () => {
  it('SendStatusSet[0].Code = Ok ⇒ 已发送', () => {
    const r = tx.judgeTencentSendResponse({
      Response: { SendStatusSet: [{ Code: 'Ok', Message: 'success', SerialNo: 'x' }] },
    })
    expect(r).toEqual({ sent: true })
  })

  it('整单被拒(Response.Error)⇒ 未发送,reason 点名错误码', () => {
    const r = tx.judgeTencentSendResponse({
      Response: {
        Error: { Code: 'FailedOperation.PhoneNumberInBlacklist', Message: '号码在黑名单' },
      },
    })
    expect(r.sent).toBe(false)
    expect(r.reason).toContain('FailedOperation.PhoneNumberInBlacklist')
  })

  it('单号级失败(没有 Error,但 SendStatusSet.Code 不是 Ok)⇒ 未发送', () => {
    const r = tx.judgeTencentSendResponse({
      Response: {
        SendStatusSet: [
          { Code: 'InvalidParameter.TemplateParamIncorrect', Message: '模板参数错误' },
        ],
      },
    })
    expect(r.sent).toBe(false)
    expect(r.reason).toContain('InvalidParameter.TemplateParamIncorrect')
  })

  it('Error 与 SendStatusSet 同时存在 ⇒ 以 Error 为准(整单被拒优先)', () => {
    const r = tx.judgeTencentSendResponse({
      Response: {
        Error: { Code: 'UnauthorizedOperation.UnauthorizedOperation' },
        SendStatusSet: [{ Code: 'Ok' }],
      },
    })
    expect(r.sent).toBe(false)
    expect(r.reason).toContain('UnauthorizedOperation')
  })

  it('判不出来 ⇒ 一律算未发送,绝不默认成功', () => {
    const bad: unknown[] = [
      undefined,
      null,
      {},
      { Response: {} },
      { Response: { SendStatusSet: [] } },
      { Response: { SendStatusSet: [{}] } },
      { Response: { SendStatusSet: [{ Code: 200 }] } },
      { Response: { Error: {} } },
      { response: { SendStatusSet: [{ Code: 'Ok' }] } }, // 大小写错形
    ]
    for (const raw of bad) {
      expect(tx.judgeTencentSendResponse(raw).sent).toBe(false)
    }
  })

  it('reason 里不得出现云侧自由文本正文(守门 67:它会被拼进对外 message)', () => {
    const r = tx.judgeTencentSendResponse({
      Response: { Error: { Code: 'InternalError', Message: '系统错误 请稍后重试 含敏感串 abc' } },
    })
    expect(r.reason).toBe('tencent_rejected:InternalError')
    expect(r.reason ?? '').not.toContain('系统错误')
  })
})

describe('isTencentSmsConfigured：四件齐备才算可用', () => {
  const FULL = {
    TENCENT_SMS_SECRET_ID: 'sid',
    TENCENT_SMS_SECRET_KEY: 'sk',
    TENCENT_SMS_SDK_APP_ID: '1400000000',
    TENCENT_SMS_SIGN_NAME: '测试签名',
  }
  it('四件齐备 ⇒ true', () => {
    setAll(FULL)
    expect(tx.isTencentSmsConfigured()).toBe(true)
  })
  it('逐件缺失都 ⇒ false(缺一即不可用,不得半配就发)', () => {
    for (const k of Object.keys(FULL) as (typeof KEYS)[number][]) {
      setAll({ ...FULL, [k]: undefined })
      expect(tx.isTencentSmsConfigured()).toBe(false)
    }
  })
  it('空串不等于已配', () => {
    setAll({ ...FULL, TENCENT_SMS_SDK_APP_ID: '' })
    expect(tx.isTencentSmsConfigured()).toBe(false)
  })
})

describe('pickTencentTemplateId：场景优先,缺配回落主模板', () => {
  it('四个场景各有独立 env 键且互不相同', () => {
    const values = Object.values(tx.TENCENT_SCENE_TEMPLATE_ENV_KEYS)
    expect(values).toHaveLength(4)
    expect(new Set(values).size).toBe(4)
  })
  it('场景专用键已配 ⇒ 用它', () => {
    setAll({ TENCENT_SMS_TEMPLATE_CODE: 'TPL_MAIN', TENCENT_SMS_TEMPLATE_CODE_REGISTER: 'TPL_REG' })
    expect(tx.pickTencentTemplateId('register')).toBe('TPL_REG')
  })
  it('场景专用键没配 ⇒ 回落主模板,不判失败', () => {
    setAll({ TENCENT_SMS_TEMPLATE_CODE: 'TPL_MAIN' })
    expect(tx.pickTencentTemplateId('reset')).toBe('TPL_MAIN')
  })
  it('空串按未配处理(否则四场景全发空模板 ID)', () => {
    setAll({ TENCENT_SMS_TEMPLATE_CODE: 'TPL_MAIN', TENCENT_SMS_TEMPLATE_CODE_LOGIN: '' })
    expect(tx.pickTencentTemplateId('login')).toBe('TPL_MAIN')
  })
  it('主模板也空 ⇒ undefined,交给调用方判未配置', () => {
    setAll({})
    expect(tx.pickTencentTemplateId('login')).toBeUndefined()
    expect(tx.pickTencentTemplateId()).toBeUndefined()
  })
})

describe('通道优先级与 fallback', () => {
  it('auto(缺省)= 阿里云 → 代理,与接入腾讯云之前的行为一字不差', () => {
    expect(smsProviderOrder('auto')).toEqual(['aliyun', 'proxy'])
    expect(smsProviderOrder('aliyun')).toEqual(['aliyun', 'proxy'])
  })
  it('tencent 档把腾讯云提到第一,后面仍留阿里云与代理', () => {
    expect(smsProviderOrder('tencent')).toEqual(['tencent', 'aliyun', 'proxy'])
  })
  it('proxy 档只认代理(显式指定就不该偷偷回落到云厂商)', () => {
    expect(smsProviderOrder('proxy')).toEqual(['proxy'])
  })
  it('档位名拼错 ⇒ 落回 auto,不得静默变成"没有通道"', () => {
    expect(smsProviderOrder('nonsense' as 'auto')).toEqual(['aliyun', 'proxy'])
  })

  it('腾讯云没配齐时自动落回阿里云(报审那 7~10 个工作日就靠这条不断档)', () => {
    expect(pickConfiguredSmsChannel('tencent', { tencent: false, aliyun: true, proxy: true })).toBe(
      'aliyun',
    )
  })
  it('腾讯云配齐时优先走腾讯云', () => {
    expect(pickConfiguredSmsChannel('tencent', { tencent: true, aliyun: true, proxy: true })).toBe(
      'tencent',
    )
  })
  it('auto 档即使腾讯云配齐也不走它(未显式声明就保持历史行为)', () => {
    expect(pickConfiguredSmsChannel('auto', { tencent: true, aliyun: true, proxy: false })).toBe(
      'aliyun',
    )
  })
  it('proxy 档在代理未配时不得越级用云厂商', () => {
    expect(
      pickConfiguredSmsChannel('proxy', { tencent: true, aliyun: true, proxy: false }),
    ).toBeNull()
  })
  it('全未配置 ⇒ null(由 dispatchSms 落到"生产档判失败")', () => {
    expect(
      pickConfiguredSmsChannel('tencent', { tencent: false, aliyun: false, proxy: false }),
    ).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
