// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'node:process'
import {
  attemptSmsChannels,
  configuredSmsOrder,
  judgeSmsFailover,
  pickConfiguredSmsChannel,
  resolveTemplatedSmsChannel,
  sendTemplatedSms,
  withFallbackMark,
  __test__ as sms,
} from '../src/services/sms.js'

/**
 * G-20(2026-10-31)「主通道失败 → 第二通道」的回归锁。
 *
 * 立票理由(现读代码实测):腾讯云第二通道**接线了但从不参与降级** ——
 *   `dispatchSms` / `sendTemplatedSms` 都只在发送前按"配置存在性"挑一档,挑中后只发一次;
 *   主通道被云侧拒收(欠费停机 isv.OUT_OF_SERVICE / 模板未过审)时,第二通道一次都没被碰过。
 *   "接了第二通道"与"主通道挂了还能发"是两件事,本文件钉后者。
 *
 * 判据边界(与生产同一份 judgeSmsFailover,不在用例里另抄):
 *   - 云侧**明确没收到** ⇒ 换道安全(not_configured / *_rejected / sdk_unavailable);
 *   - 超时 / 回包认不出 / 网关报错 ⇒ **停手**(请求可能已被受理,再发一条就是重复短信)。
 *
 * 第二档用**自建代理**而不是阿里云:两条腿都走全局 fetch,能真正端到端(第二档的成功/失败/
 * 是否被调用)断言住;阿里云的响应判定已被 sms-delivery-verdict.test.ts 单独钉住,
 * 换道骨架与具体厂商无关。
 */

const ENV_KEYS = [
  'SMS_PROVIDER',
  'SMS_VERIFY_ENDPOINT',
  'SMS_API_BASE_URL',
  'TENCENT_SMS_SECRET_ID',
  'TENCENT_SMS_SECRET_KEY',
  'TENCENT_SMS_SDK_APP_ID',
  'TENCENT_SMS_SIGN_NAME',
  'TENCENT_SMS_TEMPLATE_CODE',
  'TENCENT_SMS_TEMPLATE_CODE_LOGIN',
  'TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE',
  'ALI_SMS_ACCESS_KEY_ID',
  'ALI_SMS_ACCESS_KEY_SECRET',
  'ALI_SMS_SIGN_NAME',
  'ALI_SMS_TEMPLATE_CODE',
  'ALI_SMS_NOTIFY_TEMPLATE_CODE',
] as const

const saved: Record<string, string | undefined> = {}
for (const k of ENV_KEYS) saved[k] = env[k]

function restoreEnv(): void {
  for (const k of ENV_KEYS) {
    const v = saved[k]
    if (v === undefined) delete env[k]
    else env[k] = v
  }
}

/** 第一档=腾讯云,第二档=自建代理;阿里云刻意留空(否则会排在代理之前)。 */
function configureTencentThenProxy(): void {
  env.SMS_PROVIDER = 'tencent'
  env.TENCENT_SMS_SECRET_ID = 'tx-id-fixture'
  env.TENCENT_SMS_SECRET_KEY = 'tx-key-fixture'
  env.TENCENT_SMS_SDK_APP_ID = '1400000000'
  env.TENCENT_SMS_SIGN_NAME = '测试签名'
  env.TENCENT_SMS_TEMPLATE_CODE = '1234567'
  delete env.TENCENT_SMS_TEMPLATE_CODE_LOGIN
  delete env.ALI_SMS_ACCESS_KEY_ID
  delete env.ALI_SMS_ACCESS_KEY_SECRET
  env.SMS_API_BASE_URL = 'http://proxy.fixture'
  env.SMS_VERIFY_ENDPOINT = '/sms/verify'
}

const REJECTED = {
  Response: {
    Error: { Code: 'FailedOperation.TemplateUnapprovedOrNotExist', Message: '模板未审批' },
    RequestId: 'tx-rejected',
  },
}
const OK_BODY = {
  Response: { SendStatusSet: [{ Code: 'Ok', SerialNo: 'sn-1' }], RequestId: 'tx-ok' },
}

/** 代理侧行为(每个用例前重置)。 */
const proxy = vi.hoisted(() => ({ status: 200, calls: 0 }))

/** 只应答腾讯云与代理两个地址;打到别处一律判失败(防"偷偷发了别的请求")。 */
function stubSmsFetch(tencentHandler: () => { body: unknown } | Error): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (url: string | URL) => {
    const u = String(url)
    if (u.includes('sms.tencentcloudapi.com')) {
      const out = tencentHandler()
      if (out instanceof Error) throw out
      return { json: async () => out.body, ok: true, status: 200 } as unknown as Response
    }
    if (u.startsWith('http://proxy.fixture')) {
      proxy.calls += 1
      return { ok: proxy.status === 200, status: proxy.status } as unknown as Response
    }
    throw new Error(`不该请求这个地址:${u}`)
  })
  vi.stubGlobal('fetch', fn as unknown as typeof fetch)
  return fn
}

function timeoutError(): Error {
  const e = new Error('The operation was aborted due to timeout')
  e.name = 'TimeoutError'
  return e
}

beforeEach(() => {
  restoreEnv()
  proxy.status = 200
  proxy.calls = 0
})

afterEach(() => {
  restoreEnv()
  vi.unstubAllGlobals()
})

describe('judgeSmsFailover：只有"云侧明确没收到"才允许换道', () => {
  it('明确没进队列的失败 ⇒ try_next', () => {
    for (const reason of [
      'not_configured: TENCENT_SMS_SIGN_NAME',
      'aliyun_rejected:isv.OUT_OF_SERVICE',
      'tencent_rejected:FailedOperation.TemplateUnapprovedOrNotExist',
      'proxy_rejected:gateway_error',
      'aliyun_sdk_unavailable',
    ]) {
      expect(judgeSmsFailover(reason), reason).toBe('try_next')
    }
  })

  it('结果不明的失败 ⇒ stop(超时可能已被受理,重发就是重复短信)', () => {
    for (const reason of [
      'tencent_call_failed:TimeoutError',
      'aliyun_call_failed:ETIMEDOUT',
      'tencent_response_unparsable',
      'aliyun_response_unparsable',
      'proxy_http_502',
      'proxy_call_failed',
      'channel_threw:Error',
      '',
      undefined,
    ]) {
      expect(judgeSmsFailover(reason), String(reason)).toBe('stop')
    }
  })

  it('成对反向锁:同一族里两档必须异色,否则判据没有牙', () => {
    expect(judgeSmsFailover('aliyun_rejected:isv.OUT_OF_SERVICE')).not.toBe(
      judgeSmsFailover('aliyun_call_failed:ETIMEDOUT'),
    )
  })
})

describe('withFallbackMark：降级可被 SQL 直接计数', () => {
  it('原始错误码留在最前,后缀点名下一档', () => {
    const r = withFallbackMark('isv.OUT_OF_SERVICE', 'tencent')
    expect(r.startsWith('isv.OUT_OF_SERVICE')).toBe(true)
    expect(r).toContain('fallback_to=tencent')
  })

  it('没有 reason 也要留下可辨识形态,不得写成空串', () => {
    expect(withFallbackMark(undefined, 'aliyun')).toBe('failed | fallback_to=aliyun')
  })

  it('列宽 160 截断,错误码不会被切掉(它在头部)', () => {
    const long = withFallbackMark('x'.repeat(400), 'proxy')
    expect(long.length).toBe(160)
    expect(long.startsWith('xxx')).toBe(true)
  })
})

describe('configuredSmsOrder：候选序单一真相源', () => {
  const all = { tencent: true, aliyun: true, proxy: true }

  it('auto 不含腾讯云(未显式声明就保持历史行为)', () => {
    expect(configuredSmsOrder('auto', all)).toEqual(['aliyun', 'proxy'])
  })

  it('tencent 档且腾讯未配齐 ⇒ 退成阿里云 → 代理', () => {
    expect(configuredSmsOrder('tencent', { ...all, tencent: false })).toEqual(['aliyun', 'proxy'])
  })

  it('tencent 档且全配齐 ⇒ 三档按声明顺序', () => {
    expect(configuredSmsOrder('tencent', all)).toEqual(['tencent', 'aliyun', 'proxy'])
  })

  it('pickConfiguredSmsChannel 恒等于候选序首位(两处不得各拼一份)', () => {
    for (const provider of ['auto', 'tencent', 'aliyun', 'proxy'] as const) {
      for (const cfg of [
        { tencent: true, aliyun: true, proxy: true },
        { tencent: true, aliyun: false, proxy: true },
        { tencent: false, aliyun: false, proxy: false },
      ]) {
        expect(pickConfiguredSmsChannel(provider, cfg)).toBe(
          configuredSmsOrder(provider, cfg)[0] ?? null,
        )
      }
    }
  })
})

describe('attemptSmsChannels：逐档尝试的骨架', () => {
  it('主档被拒 → 次档接住:两次都落账,失败档点名 fallbackTo', async () => {
    const sends: string[] = []
    const records: Array<{ channel: string; ok: boolean; fallbackTo?: string }> = []
    const fallbacks: string[] = []

    const out = await attemptSmsChannels({
      candidates: ['tencent', 'aliyun'],
      send: async (ch) => {
        sends.push(ch)
        return ch === 'tencent'
          ? {
              sent: false,
              reason: 'tencent_rejected:FailedOperation.TemplateUnapprovedOrNotExist',
            }
          : { sent: true }
      },
      record: (a) =>
        void records.push({ channel: a.channel, ok: a.delivery.sent, fallbackTo: a.fallbackTo }),
      onFallback: (from, to, reason) => void fallbacks.push(`${from}->${to}:${reason}`),
    })

    expect(sends).toEqual(['tencent', 'aliyun'])
    expect(records).toEqual([
      { channel: 'tencent', ok: false, fallbackTo: 'aliyun' },
      { channel: 'aliyun', ok: true, fallbackTo: undefined },
    ])
    expect(fallbacks).toEqual([
      'tencent->aliyun:tencent_rejected:FailedOperation.TemplateUnapprovedOrNotExist',
    ])
    expect(out.channel).toBe('aliyun')
    expect(out.delivery.sent).toBe(true)
    expect(out.attempts).toHaveLength(2)
  })

  it('结果不明(超时)⇒ 停手,次档一次都不许碰(防重复短信)', async () => {
    const sends: string[] = []
    const out = await attemptSmsChannels({
      candidates: ['tencent', 'aliyun'],
      send: async (ch) => {
        sends.push(ch)
        return { sent: false, reason: 'tencent_call_failed:TimeoutError' }
      },
      record: () => {},
    })
    expect(sends).toEqual(['tencent'])
    expect(out.channel).toBe('tencent')
    expect(out.delivery.sent).toBe(false)
    expect(out.delivery.reason).toContain('TimeoutError')
  })

  it('两侧都不可用 ⇒ 判失败(UNDELIVERED):两档各一行 failed,末行不带 fallbackTo', async () => {
    const records: Array<{ channel: string; ok: boolean; fallbackTo?: string }> = []
    const out = await attemptSmsChannels({
      candidates: ['tencent', 'aliyun'],
      send: async (ch) => ({ sent: false, reason: `${ch}_rejected:isv.OUT_OF_SERVICE` }),
      record: (a) =>
        void records.push({ channel: a.channel, ok: a.delivery.sent, fallbackTo: a.fallbackTo }),
    })
    expect(records).toEqual([
      { channel: 'tencent', ok: false, fallbackTo: 'aliyun' },
      { channel: 'aliyun', ok: false, fallbackTo: undefined },
    ])
    expect(out.delivery.sent).toBe(false)
    expect(out.delivery.reason).toContain('OUT_OF_SERVICE')
    expect(out.channel).toBe('aliyun')
  })

  it('第一档就成功 ⇒ 只尝试一次、不触发降级回调', async () => {
    let sends = 0
    let fallbacks = 0
    const out = await attemptSmsChannels({
      candidates: ['tencent', 'aliyun'],
      send: async () => {
        sends += 1
        return { sent: true }
      },
      record: () => {},
      onFallback: () => {
        fallbacks += 1
      },
    })
    expect(sends).toBe(1)
    expect(fallbacks).toBe(0)
    expect(out.channel).toBe('tencent')
    expect(out.attempts).toHaveLength(1)
  })

  it('一个候选都没有 ⇒ 不发送、reason 明确指出没有通道', async () => {
    let sends = 0
    const out = await attemptSmsChannels({
      candidates: [],
      send: async () => {
        sends += 1
        return { sent: true }
      },
      record: () => {},
    })
    expect(sends).toBe(0)
    expect(out.channel).toBeNull()
    expect(out.delivery).toEqual({ sent: false, reason: 'no_configured_channel' })
  })

  it('发送器漏抛异常 ⇒ 按"结果不明"停手,不换道', async () => {
    const sends: string[] = []
    const out = await attemptSmsChannels({
      candidates: ['tencent', 'aliyun'],
      send: async (ch) => {
        sends.push(ch)
        throw Object.assign(new Error('boom'), { code: 'ECONNRESET' })
      },
      record: () => {},
    })
    expect(sends).toEqual(['tencent'])
    expect(out.delivery.sent).toBe(false)
    expect(out.delivery.reason).toContain('ECONNRESET')
  })
})

describe('dispatchSms(验证码链路):真实 sender 真降级', () => {
  it('腾讯拒收(模板未过审)→ 代理接住', async () => {
    configureTencentThenProxy()
    const fetchMock = stubSmsFetch(() => ({ body: REJECTED }))

    const r = await sms.dispatchSms('13800138000', '123456', 'login')

    expect(r.sent).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(proxy.calls).toBe(1)
  })

  it('两侧都不可用 ⇒ sent:false(调用方据此判 delivery_failed 并退还配额)', async () => {
    configureTencentThenProxy()
    proxy.status = 500
    stubSmsFetch(() => ({ body: REJECTED }))

    const r = await sms.dispatchSms('13800138000', '123456', 'login')

    expect(r.sent).toBe(false)
    expect(r.reason).toContain('proxy_http_500')
    expect(proxy.calls).toBe(1)
  })

  it('腾讯超时 ⇒ 代理一次都不许碰(回包丢了不等于没发出)', async () => {
    configureTencentThenProxy()
    stubSmsFetch(() => timeoutError())

    const r = await sms.dispatchSms('13800138000', '123456', 'login')

    expect(r.sent).toBe(false)
    expect(r.reason).toContain('tencent_call_failed')
    expect(proxy.calls).toBe(0)
  })

  it('腾讯成功 ⇒ 不触发降级', async () => {
    configureTencentThenProxy()
    stubSmsFetch(() => ({ body: OK_BODY }))

    const r = await sms.dispatchSms('13800138000', '123456', 'login')

    expect(r.sent).toBe(true)
    expect(proxy.calls).toBe(0)
  })
})

describe('resolveTemplatedSmsChannel：失败换道用的 exclude', () => {
  it('auto + 腾讯通知模板已回填 ⇒ 默认腾讯;排除腾讯后落到下一档', () => {
    configureTencentThenProxy()
    env.SMS_PROVIDER = 'auto'
    env.TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE = '2759148'

    expect(resolveTemplatedSmsChannel('notice', 'new-device', 'auto', true).channel).toBe('tencent')
    // 阿里云未配,下一档 = 代理
    expect(
      resolveTemplatedSmsChannel('notice', 'new-device', 'auto', true, ['tencent']).channel,
    ).toBe('proxy')
  })

  it('全部排除 ⇒ channel null(不得回头再打一遍同一档)', () => {
    configureTencentThenProxy()
    expect(
      resolveTemplatedSmsChannel('notice', 'new-device', 'tencent', true, [
        'tencent',
        'aliyun',
        'proxy',
      ]).channel,
    ).toBeNull()
  })
})

describe('sendTemplatedSms(通知链路):失败换道', () => {
  const OPTS = {
    category: 'notice' as const,
    templateKey: 'new-device' as const,
    fallbackContent: '您的账号有新设备登录',
    skipRateLimit: true,
  }

  it('腾讯模板被拒 → 代理接住', async () => {
    configureTencentThenProxy()
    env.TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE = '2759148'
    const fetchMock = stubSmsFetch(() => ({ body: REJECTED }))

    const r = await sendTemplatedSms('13800138000', OPTS)

    expect(r.success).toBe(true)
    expect(r.provider).toBe('proxy')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(proxy.calls).toBe(1)
  })

  it('两侧都不可用 ⇒ success:false,provider 点名最后试过的那一档', async () => {
    configureTencentThenProxy()
    env.TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE = '2759148'
    proxy.status = 502
    stubSmsFetch(() => ({ body: REJECTED }))

    const r = await sendTemplatedSms('13800138000', OPTS)

    expect(r.success).toBe(false)
    expect(r.error).toContain('proxy_http_502')
    expect(r.provider).toBe('proxy')
  })

  it('腾讯成功 ⇒ 代理侧零调用', async () => {
    configureTencentThenProxy()
    env.TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE = '2759148'
    stubSmsFetch(() => ({ body: OK_BODY }))

    const r = await sendTemplatedSms('13800138000', OPTS)

    expect(r.success).toBe(true)
    expect(r.provider).toBe('tencent')
    expect(proxy.calls).toBe(0)
  })

  it('腾讯超时 ⇒ 停手,代理侧零调用', async () => {
    configureTencentThenProxy()
    env.TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE = '2759148'
    stubSmsFetch(() => timeoutError())

    const r = await sendTemplatedSms('13800138000', OPTS)

    expect(r.success).toBe(false)
    expect(r.error).toContain('tencent_call_failed')
    expect(proxy.calls).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
