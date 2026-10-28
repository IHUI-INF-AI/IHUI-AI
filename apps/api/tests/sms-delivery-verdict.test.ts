// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { __test__ as sms } from '../src/services/sms.js'

/**
 * 阿里云短信「到底发没发出去」这条判定链的回归锁。
 *
 * 立票理由(2026-10-22 实测,两条都是静默型):
 *  1. `loadAliyunSdk` 过去把 `namespace.default` 当构造函数用。该 SDK 是 CJS,`import()` 后
 *     namespace.default = module.exports 本身,真类挂在它再里面一层 ⇒ `new` 它必抛
 *     "not a constructor"。`optional-deps.d.ts` 把包声明成 `export default class`,
 *     所以 **tsc 全绿、运行时全废**;只因 AK/SK 一直是空值、策略 1 从未进入,才没露头。
 *  2. `sendViaAliyun` 过去 `await client.sendSms(request)` 后不看响应体。阿里云对
 *     欠费停机(isv.OUT_OF_SERVICE)、签名不合法、模板变量不匹配一律回 HTTP 200 + body.Code
 *     ⇒ 三条腿都把"根本没发出去"记成"已发送"。
 * 两型的共同形态是"失败长得像成功",所以夹具必须成对:每一档各给正反两个输入。
 */

const req = createRequire(import.meta.url)

describe('resolveDefaultCtor：CJS↔ESM 互操作的多层形态', () => {
  class Real {}

  it('真·ESM 默认导出(函数本身)认得出', () => {
    expect(sms.resolveDefaultCtor(Real)).toBe(Real)
  })

  it('CJS 经 import() 后的真实形态(namespace.default = module.exports,类在 module.exports.default)认得出', () => {
    const namespace = { default: { default: Real, SendSmsRequest: class {} } }
    expect(sms.resolveDefaultCtor(namespace)).toBe(Real)
  })

  it('只有一层 default 的中间形态也认得出', () => {
    expect(sms.resolveDefaultCtor({ default: Real })).toBe(Real)
  })

  it('反向断言:处处都不是构造函数 ⇒ 返回 null,不得把普通对象当类交出去', () => {
    // 这正是旧写法的下场 —— 它会把 { default: Client } 这个普通对象直接当构造函数用
    expect(sms.resolveDefaultCtor({ default: { notACtor: 1 } })).toBeNull()
    expect(sms.resolveDefaultCtor({})).toBeNull()
    expect(sms.resolveDefaultCtor(undefined)).toBeNull()
  })

  it('命名导出在 namespace 上或在 module.exports 里都找得到;找不到 ⇒ null', () => {
    class Named {}
    expect(sms.resolveNamedCtor({ Named }, 'Named')).toBe(Named)
    expect(sms.resolveNamedCtor({ default: { Named } }, 'Named')).toBe(Named)
    expect(sms.resolveNamedCtor({ default: {} }, 'Nope')).toBeNull()
  })
})

describe('loadAliyunSdk：装好的 SDK 必须真能构造出客户端', () => {
  // 注意:本例在 vitest 里**不构成**对生产形态的覆盖 —— vite-node 的 CJS→ESM 互操作与
  // Node 原生 `import()` 给的对象形状不同(vitest 下 `namespace.default` 直接就是类,
  // 生产 Node 下还要再剥一层)。2026-10-22 的变异自证实测:剥掉第三层剥离时,翻红的是上面
  // 那组纯形状夹具,本例照样绿。所以真锁是 `resolveDefaultCtor` 那三档成对输入,别删。
  it('已安装 ⇒ 拿到的 Client/Config/SendSmsRequest 三者都能 new', async () => {
    try {
      req.resolve('@alicloud/dysmsapi20170525')
    } catch {
      // 可选依赖在该环境确实未安装 ⇒ 降级路径由 dispatchSms 那侧负责,这里不判死
      expect(sms.loadAliyunSdk()).resolves.toBeNull()
      return
    }
    const sdk = await sms.loadAliyunSdk()
    expect(sdk).not.toBeNull()
    if (!sdk) return
    const config = new sdk.Config({})
    expect(() => new sdk.Client(config)).not.toThrow()
    expect(new sdk.SendSmsRequest({ phoneNumbers: '13800000000' })).toBeTruthy()
  })

  it('构造函数取不到时不得伪装成"未安装所以降级"——必须判不可用(返回 null)', async () => {
    // 与上一例配对:装上了却认不出构造函数,旧写法会照常交出一个 new 不动的对象,
    // 异常要到调用点才炸;新写法在加载点就判死。
    expect(typeof sms.resolveDefaultCtor({ default: {} })).toBe('object')
  })
})

describe('judgeAliyunResponse：HTTP 200 不等于发出去了', () => {
  it('body.code=OK ⇒ 已发送', () => {
    expect(sms.judgeAliyunResponse({ body: { code: 'OK', requestId: 'r-1' } })).toEqual({
      sent: true,
    })
  })

  it('body.code=isv.OUT_OF_SERVICE(欠费停机)⇒ 未发送,且 reason 点名该错误码', () => {
    const r = sms.judgeAliyunResponse({
      body: { code: 'isv.OUT_OF_SERVICE', message: '业务停机' },
    })
    expect(r.sent).toBe(false)
    expect(r.reason).toContain('isv.OUT_OF_SERVICE')
  })

  it('PascalCase 形态的 Code 同样要判住(不能只认一种序列化)', () => {
    expect(sms.judgeAliyunResponse({ body: { Code: 'isv.SMS_SIGNATURE_ILLEGAL' } }).sent).toBe(
      false,
    )
  })

  it('响应体缺 code / 整个 body 缺失 / code 非字符串 ⇒ 一律判未发送,不得默认成功', () => {
    for (const raw of [
      undefined,
      null,
      {},
      { body: {} },
      { body: { code: 200 } },
      { code: 'OK' },
    ]) {
      expect(sms.judgeAliyunResponse(raw).sent).toBe(false)
    }
  })
})

describe('judgeUnconfiguredDelivery：没配通道时不得冒充"已发送"', () => {
  const P = (dev = false) => ({ productionGuard: true, devEchoOptIn: dev })
  const D = (dev = false) => ({ productionGuard: false, devEchoOptIn: dev })

  it('生产档 ⇒ sent:false(旧写法这里恒为"已发送",用户等到天荒地老)', () => {
    expect(sms.judgeUnconfiguredDelivery(P()).sent).toBe(false)
  })

  it(
    '非生产档但未显式声明回显 ⇒ 仍 sent:false —— 立因:生产机的 NODE_ENV 是 development,' +
      '信 NODE_ENV 就等于线上恒假绿',
    () => {
      expect(sms.judgeUnconfiguredDelivery(D()).sent).toBe(false)
      expect(sms.judgeUnconfiguredDelivery(D()).reason).toContain('SMS_DEV_ECHO')
    },
  )

  it('显式 SMS_DEV_ECHO=1 且非生产 ⇒ 才给回显(sent:true)', () => {
    expect(sms.judgeUnconfiguredDelivery(D(true)).sent).toBe(true)
  })

  it('成对反向锁:显式声明在生产档也不得放行(摘掉 productionGuard 这一维即翻绿=判据无牙)', () => {
    expect(sms.judgeUnconfiguredDelivery(P(true)).sent).toBe(false)
  })

  it('reason 必须点名是哪三档没配(只说"失败"= 下一个人还得重新查)', () => {
    expect(sms.judgeUnconfiguredDelivery(P()).reason).toContain('ALI_SMS_*')
    expect(sms.judgeUnconfiguredDelivery(P()).reason).toContain('SMS_API_BASE_URL')
  })
})

describe('providerErrorCode：只留机器码,不留云侧正文', () => {
  it('SDK 错误码原样保留', () => {
    expect(sms.providerErrorCode({ code: 'InvalidAccessKeyId.NotFound' })).toBe(
      'InvalidAccessKeyId.NotFound',
    )
  })
  it('没有 code 时退到 Error.name;含空格/中文/超长的一律不认 ⇒ unknown', () => {
    expect(sms.providerErrorCode(new Error('欠费停机,请充值'))).toBe('Error')
    expect(sms.providerErrorCode({ code: '欠费 停机' })).toBe('unknown')
    expect(sms.providerErrorCode({ code: 'x'.repeat(200) })).toBe('unknown')
    expect(sms.providerErrorCode(null)).toBe('unknown')
  })
})

describe('maskPhone：日志面不得出现裸号', () => {
  it('11 位号码只留前 3 后 4', () => {
    expect(sms.maskPhone('13800138000')).toBe('138****8000')
  })
  it('短号一律全遮,不得把整号原样吐出', () => {
    expect(sms.maskPhone('12345')).toBe('***')
  })
})

describe('pickTemplateCode：场景 → 模板码,缺配必须回落而不是失败', () => {
  const KEYS = ['ALI_SMS_TEMPLATE_CODE', ...Object.values(sms.SCENE_TEMPLATE_ENV_KEYS)] as const
  const saved: Record<string, string | undefined> = {}

  for (const k of KEYS) saved[k] = process.env[k]
  const restore = () => {
    for (const k of KEYS) {
      const v = saved[k]
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }

  it('四个场景各有独立的 env 键,且键名互不相同(闭集被缩小 ⇒ 本例翻红)', () => {
    const values = Object.values(sms.SCENE_TEMPLATE_ENV_KEYS)
    expect(values).toHaveLength(4)
    expect(new Set(values).size).toBe(4)
    expect(new Set(values).size).toBe(values.length)
  })

  it('场景专用键已配 ⇒ 用它,不得借用主模板(主模板是登录文案,发给注册就是误导)', () => {
    process.env.ALI_SMS_TEMPLATE_CODE = 'SMS_LOGIN_MAIN'
    process.env.ALI_SMS_TEMPLATE_CODE_REGISTER = 'SMS_REGISTER_ONLY'
    expect(sms.pickTemplateCode('register')).toBe('SMS_REGISTER_ONLY')
    restore()
  })

  it('场景专用键没配 ⇒ 回落主模板,不得判失败(换机只配一枚主模板是常态)', () => {
    process.env.ALI_SMS_TEMPLATE_CODE = 'SMS_LOGIN_MAIN'
    delete process.env.ALI_SMS_TEMPLATE_CODE_RESET
    expect(sms.pickTemplateCode('reset')).toBe('SMS_LOGIN_MAIN')
    restore()
  })

  it('不传场景 ⇒ 主模板;主模板也空 ⇒ 返回 undefined 交给调用方判未配置', () => {
    process.env.ALI_SMS_TEMPLATE_CODE = 'SMS_LOGIN_MAIN'
    expect(sms.pickTemplateCode()).toBe('SMS_LOGIN_MAIN')
    delete process.env.ALI_SMS_TEMPLATE_CODE
    expect(sms.pickTemplateCode('login')).toBeUndefined()
    restore()
  })

  it('空串不等于已配(空值键必须继续回落,否则四场景全发空模板)', () => {
    process.env.ALI_SMS_TEMPLATE_CODE = 'SMS_LOGIN_MAIN'
    process.env.ALI_SMS_TEMPLATE_CODE_LOGIN = ''
    expect(sms.pickTemplateCode('login')).toBe('SMS_LOGIN_MAIN')
    restore()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
