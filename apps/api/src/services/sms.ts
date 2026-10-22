// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 短信验证码服务。
 * 发送策略优先级：阿里云（配置密钥）→ 代理（SMS_API_BASE_URL）→ dev console（日志）。
 * 限速：60s 1 次 / 1h 5 次 / 24h 20 次。
 * 验证码存储复用 code-store.ts（内存 Map，生产应迁移 Redis）。
 */

import { env } from 'node:process'
import {
  generateCode,
  getCodeEntry,
  putCodeEntry,
  CODE_TTL_MS,
  CODE_TTL_REGISTER_MS,
  CODE_RESEND_INTERVAL_MS,
} from '../utils/code-store.js'
import { tryConsumeWindows } from '../utils/window-counter.js'
import { logger } from '../utils/logger.js'
import { config } from '../config/index.js'
import { isTencentSmsConfigured, sendViaTencent } from './sms-tencent.js'
import type { SendCodeResult, SmsDeliveryResult, SmsProvider, SmsScene } from './sms-types.js'

const FETCH_TIMEOUT_MS = 10_000

// 通道共享类型住在 ./sms-types.ts(两家厂商都要用,放任何一家里都会让另一家反向引用它)

/** 手机号脱敏:仅留前 3 后 4。日志面一律走它,不得写裸号。 */
function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '***'
}

/** 从异常里只取机器可读的错误码(SDK 的 `code` 或 Error 的 `name`),丢弃自由文本正文。 */
function providerErrorCode(e: unknown): string {
  const code = (e as { code?: unknown })?.code
  if (typeof code === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(code)) return code
  const name = (e as Error)?.name
  return typeof name === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(name) ? name : 'unknown'
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

interface AliyunSmsModules {
  Client: new (config: unknown) => { sendSms(request: unknown): Promise<unknown> }
  SendSmsRequest: new (input: Record<string, unknown>) => unknown
  Config: new (input: Record<string, unknown>) => unknown
}

type Ctor = new (input: never) => unknown

function asCtor(v: unknown): Ctor | null {
  return typeof v === 'function' ? (v as Ctor) : null
}

/** 剥掉 CJS↔ESM 互操作多出来的那一层。
 *  `optional-deps.d.ts` 把 SDK 声明成 `export default class`,所以 tsc 眼里 `mod.default` 就是
 *  构造函数;但运行时该包是 CJS —— `import()` 给的 namespace.default 是 module.exports 本身,
 *  真正的类挂在 `module.exports.default` 上,少剥一层拿到的是普通对象,`new` 它必抛
 *  "not a constructor"。2026-10-22 实测:这条阿里云腿从写进仓库那天起就没构造成功过,
 *  只因 AK/SK 一直为空、策略 1 从未进入,异常也就从没露头。三种形态都认,不再赌一种。 */
function resolveDefaultCtor(mod: unknown): Ctor | null {
  const one = (mod as { default?: unknown } | undefined)?.default
  const two = (one as { default?: unknown } | undefined)?.default
  return asCtor(mod) ?? asCtor(one) ?? asCtor(two)
}

/** 命名导出同样可能在 module.exports 那一层,两面都找。 */
function resolveNamedCtor(mod: unknown, name: string): Ctor | null {
  const bag = mod as Record<string, unknown> | undefined
  const nested = (mod as { default?: Record<string, unknown> } | undefined)?.default
  return asCtor(bag?.[name]) ?? asCtor(nested?.[name])
}

let aliyunSdkCache: AliyunSmsModules | null | undefined

async function loadAliyunSdk(): Promise<AliyunSmsModules | null> {
  if (aliyunSdkCache !== undefined) return aliyunSdkCache
  try {
    // 阿里云短信 SDK 为可选依赖,取不到构造函数时降级为日志输出
    const sdkRaw: unknown = await import('@alicloud/dysmsapi20170525')
    const openApiRaw: unknown = await import('@alicloud/openapi-client')
    const Client = resolveDefaultCtor(sdkRaw)
    const SendSmsRequest = resolveNamedCtor(sdkRaw, 'SendSmsRequest')
    const Config = resolveNamedCtor(openApiRaw, 'Config')
    if (!Client || !SendSmsRequest || !Config) {
      // 装上了却认不出构造函数 ⇒ 必须点名,不能再伪装成"未安装所以降级"这种无害形态
      logger.error('阿里云短信 SDK 已加载但取不到构造函数 ⇒ 判不可用,不记为已发送', {
        client: Boolean(Client),
        sendSmsRequest: Boolean(SendSmsRequest),
        config: Boolean(Config),
      })
      aliyunSdkCache = null
      return null
    }
    aliyunSdkCache = {
      Client: Client as AliyunSmsModules['Client'],
      SendSmsRequest: SendSmsRequest as AliyunSmsModules['SendSmsRequest'],
      Config: Config as AliyunSmsModules['Config'],
    }
    return aliyunSdkCache
  } catch (e) {
    logger.warn('阿里云短信 SDK 未安装或加载失败,降级为日志输出', {
      error: (e as Error).message,
    })
    aliyunSdkCache = null
    return null
  }
}

/** 三档限速的档位表。max 与窗口都写在这里,不再散在判据函数体内 ——
 *  24h 档的上限直接对应云侧那 100~200 条免费额度,改数必须连带改注释里的理由。 */
const RATE_LIMIT_WINDOWS = [
  { windowMs: 60_000, max: 1, msg: '验证码已发送,请稍候' },
  { windowMs: 3_600_000, max: 5, msg: '一小时内发送次数过多' },
  { windowMs: 86_400_000, max: 20, msg: '今日发送次数过多' },
] as const

async function checkRateLimit(phone: string): Promise<{ ok: boolean; msg: string }> {
  const blocked = await tryConsumeWindows(
    RATE_LIMIT_WINDOWS.map((w) => ({
      key: `sms:rl:${w.windowMs}:${phone}`,
      windowMs: w.windowMs,
      max: w.max,
    })),
  )
  if (blocked > 0) return { ok: false, msg: RATE_LIMIT_WINDOWS[blocked - 1]?.msg ?? '发送过于频繁' }
  return { ok: true, msg: '' }
}

/** 场景 → 该场景的验证码有效期。必须与云侧模板文案里承诺的时长一致:
 *  注册模板 SMS_491200014 写的是"10分钟内有效"(已过审,改文案要重新报审),
 *  所以这一档实现给 10 分钟;其余三枚模板均写"5分钟",给 5 分钟。
 *  对齐方向只有一个 —— 实现服从已公示的承诺;反过来(把文案压到 5 分钟)是在用户
 *  已经看到的短信上做手脚。新增场景不在这张表里 ⇒ 按最短档给,宁可少给不可多给。 */
export function smsCodeTtlMs(scene?: SmsScene): number {
  return scene === 'register' ? CODE_TTL_REGISTER_MS : CODE_TTL_MS
}

/** 发送短信验证码 */
export async function sendSmsCode(phone: string, scene?: SmsScene): Promise<SendCodeResult> {
  const rl = await checkRateLimit(phone)
  if (!rl.ok) return { success: false, msg: rl.msg, failure: 'rate_limited' }

  const code = generateCode()
  const now = Date.now()

  // 检查重发间隔
  const existing = await getCodeEntry(phone)
  if (existing && now - existing.sentAt < CODE_RESEND_INTERVAL_MS) {
    return { success: false, msg: '验证码已发送,请稍候', failure: 'rate_limited' }
  }

  // 存储验证码
  await putCodeEntry(phone, {
    code,
    expiresAt: now + smsCodeTtlMs(scene),
    sentAt: now,
  })

  // 实际发送
  const delivery = await dispatchSms(phone, code, scene)
  if (!delivery.sent) {
    return { success: false, msg: '验证码发送失败,请稍后重试', failure: 'delivery_failed' }
  }

  return { success: true, msg: '验证码已发送' }
}

/** 投递一枚「调用方自己已经生成并存进 code-store」的验证码。
 *  与 sendSmsCode 的分工:那支自带取码 + 限速 + 重发间隔,适合只管发的端点;
 *  这支只负责"送出去并如实回报",供已在自己作用域内生成/存码的端点复用
 *  (routes/auth.ts 的 /send-code 与 /sms/send —— 它们还要把码交给回显闸,不能另生成一枚)。 */
export function deliverSmsCode(
  phone: string,
  code: string,
  scene?: SmsScene,
): Promise<SmsDeliveryResult> {
  return dispatchSms(phone, code, scene)
}

/** 无凭据也无代理时,这一轮到底算不算"发出去了"。
 *
 * 生产档必须算失败:记成成功 ⇒ 响应写"验证码已发送"而用户永远等不到那条短信,
 * 而"降级"这件事只留下一行 warn,没人会去查。
 *
 * **开发档的回显不再由 NODE_ENV 推断**(2026-10-22 实测改判)。原写法信 `NODE_ENV==='production'`,
 * 而这台机器就是生产机、它跑的 api 却是 `NODE_ENV=development`(生产签出那份 `.env` 第 1 行),
 * 于是"三档通道全未配置"被读成"开发态,可以假发" ⇒ 线上发码接口恒返回 `sent:true`,
 * 而短信一条都没出。实测读数:`POST /api/auth/sms/send` 返
 * `{"code":0,"data":{"sent":true,"expiresIn":300}}`,同轮 Redis 里 `code:*` 有键、厂商侧零发送。
 * 失效方向按 §0.10 只能是"多要一次显式声明",不能是"多放一次假绿":
 * 要拿到回显码必须显式设 `SMS_DEV_ECHO=1`,缺省一律 fail-closed。
 *
 * 抽成纯函数是为了让每一档各有成对夹具可钉(§feedback-fix-must-carry-mutation-proof):
 * 摘掉 `devEchoOptIn` 这一维,显式声明那一档必须翻红,而不是两档同色。 */
export function judgeUnconfiguredDelivery(opts: {
  productionGuard: boolean
  devEchoOptIn: boolean
}): SmsDeliveryResult {
  if (opts.devEchoOptIn && !opts.productionGuard) {
    return { sent: true, reason: 'dev_console_opt_in' }
  }
  return {
    sent: false,
    reason:
      'not_configured: ALI_SMS_* / TENCENT_SMS_* / SMS_API_BASE_URL 三档全未配置' +
      (opts.productionGuard ? '' : '(非生产档也不回显:要回显请显式设 SMS_DEV_ECHO=1)'),
  }
}

function isAliyunSmsConfigured(): boolean {
  return Boolean(env.ALI_SMS_ACCESS_KEY_ID && env.ALI_SMS_ACCESS_KEY_SECRET)
}

/** 通道优先级。`auto`(缺省)= 历史行为,已配环境一行不变。
 *  `tencent` 把腾讯云提到第一档,但**没配齐就逐档往下退** —— 签名/模板报审要 7~10 个工作日,
 *  这期间腾讯云必然处于未配置态,自动落回阿里云才不会把功能停在那儿等审批。 */
export function smsProviderOrder(provider: SmsProvider): Array<'tencent' | 'aliyun' | 'proxy'> {
  switch (provider) {
    case 'tencent':
      return ['tencent', 'aliyun', 'proxy']
    case 'aliyun':
      return ['aliyun', 'proxy']
    case 'proxy':
      return ['proxy']
    case 'auto':
    default:
      return ['aliyun', 'proxy']
  }
}

/** 在声明的优先级里挑第一个"确实配齐"的通道;全都没配 ⇒ null。
 *  抽成纯函数是为了让"腾讯云没配齐要自动落回阿里云"这条 fallback 有夹具可钉 ——
 *  它住在 dispatchSms 里就得真发一次网络请求才测得到。 */
export function pickConfiguredSmsChannel(
  provider: SmsProvider,
  configured: { tencent: boolean; aliyun: boolean; proxy: boolean },
): 'tencent' | 'aliyun' | 'proxy' | null {
  for (const p of smsProviderOrder(provider)) {
    if (configured[p]) return p
  }
  return null
}

async function dispatchSms(
  phone: string,
  code: string,
  scene?: SmsScene,
): Promise<SmsDeliveryResult> {
  const declared = (env.SMS_PROVIDER ?? 'auto') as SmsProvider
  const channel = pickConfiguredSmsChannel(declared, {
    tencent: isTencentSmsConfigured(),
    aliyun: isAliyunSmsConfigured(),
    proxy: Boolean(env.SMS_API_BASE_URL),
  })
  if (channel === 'tencent') return sendViaTencent(phone, code, scene)
  if (channel === 'aliyun') return sendViaAliyun(phone, code, scene)
  if (channel === 'proxy') return sendViaProxy(phone, code)
  // 三档通道全未配置 ⇒ 这一轮没有真发送,必须让它响。
  logger.warn('SMS 没有任何已配置的发送通道 ⇒ 本轮没有真发送', {
    phone: maskPhone(phone),
    provider: declared,
  })
  // 旗标读法随仓内既有 7 处(挂在 config 对象上,不是具名导出 —— 具名导入在只 mock
  // `config` 的测试里会在请求期才炸,表现为 500 而不是"档位不对")。
  // 真实 config 一定带这个键,退回 NODE_ENV 只为兼容没铺全的 mock。
  return judgeUnconfiguredDelivery({
    productionGuard: config.isProductionGuard ?? config.NODE_ENV === 'production',
    devEchoOptIn: env.SMS_DEV_ECHO === '1',
  })
}

/** 场景 → 该场景专用模板码的 env 键。四枚模板在阿里云侧均已过审。 */
const SCENE_TEMPLATE_ENV_KEYS: Record<SmsScene, string> = {
  register: 'ALI_SMS_TEMPLATE_CODE_REGISTER',
  login: 'ALI_SMS_TEMPLATE_CODE_LOGIN',
  reset: 'ALI_SMS_TEMPLATE_CODE_RESET',
  'phone-binding': 'ALI_SMS_TEMPLATE_CODE_PHONE_BINDING',
}

/** 按场景取模板码;该场景没单独配 ⇒ 回落 ALI_SMS_TEMPLATE_CODE。
 *  回落不是偷懒:换机/换环境时只配一枚主模板是常态,把"没逐场景配齐"当失败会让这些环境
 *  直接发不出码 —— 而那正是 §12e 说的"判据把出路堵死"。 */
function pickTemplateCode(scene?: SmsScene): string | undefined {
  const scoped = scene ? env[SCENE_TEMPLATE_ENV_KEYS[scene]] : undefined
  return scoped || env.ALI_SMS_TEMPLATE_CODE
}

/** 阿里云 SendSms 的响应判定。HTTP 200 ≠ 发出去了:签名不合法、账户欠费(isv.OUT_OF_SERVICE)、
 *  模板变量不匹配这些业务失败云侧一律回 200 + body.Code。只看 Promise 没抛错,会把它们全读成
 *  "已发送" —— 而留痕里再不会有一条线索指向真正的原因。 */
function judgeAliyunResponse(raw: unknown): SmsDeliveryResult {
  const body = (raw as { body?: Record<string, unknown> } | null | undefined)?.body
  const pick = (k: string) => (typeof body?.[k] === 'string' ? (body[k] as string) : '')
  // SDK 模型实例上是 camelCase(`code`),toMap()/裸 JSON 上是 PascalCase(`Code`),两面都认
  const code = pick('code') || pick('Code')
  if (!code) return { sent: false, reason: 'aliyun_response_unparsable' }
  return code === 'OK' ? { sent: true } : { sent: false, reason: `aliyun_rejected:${code}` }
}

async function sendViaAliyun(
  phone: string,
  code: string,
  scene?: SmsScene,
): Promise<SmsDeliveryResult> {
  const signName = env.ALI_SMS_SIGN_NAME
  const templateCode = pickTemplateCode(scene)
  if (!signName || !templateCode) {
    const missing = !signName
      ? 'ALI_SMS_SIGN_NAME'
      : `ALI_SMS_TEMPLATE_CODE${scene ? `(或场景专用 ${SCENE_TEMPLATE_ENV_KEYS[scene]})` : ''}`
    logger.warn('阿里云短信配置不齐 ⇒ 判未配置,不记为已发送', {
      phone: maskPhone(phone),
      reason: `not_configured: ${missing}`,
    })
    return { sent: false, reason: `not_configured: ${missing}` }
  }

  const sdk = await loadAliyunSdk()
  if (!sdk) {
    // 走到这里说明凭据与模板都在位、本应真发,却加载不了 SDK ⇒ 这是失败,不是"降级即成功"
    logger.warn('阿里云短信 SDK 不可用(有凭据却发不出去) ⇒ 如实报失败', { phone: maskPhone(phone) })
    return { sent: false, reason: 'aliyun_sdk_unavailable' }
  }

  try {
    const config = new sdk.Config({
      accessKeyId: env.ALI_SMS_ACCESS_KEY_ID,
      accessKeySecret: env.ALI_SMS_ACCESS_KEY_SECRET,
      endpoint: 'dysmsapi.aliyuncs.com',
    })
    const client = new sdk.Client(config)
    const request = new sdk.SendSmsRequest({
      phoneNumbers: phone,
      signName,
      templateCode,
      templateParam: JSON.stringify({ code }),
    })
    const result = judgeAliyunResponse(await client.sendSms(request))
    if (!result.sent) {
      logger.warn('阿里云短信未发出', { phone: maskPhone(phone), reason: result.reason })
    }
    return result
  } catch (e) {
    const reason = `aliyun_call_failed:${providerErrorCode(e)}`
    logger.warn('阿里云短信调用异常', { phone: maskPhone(phone), reason })
    return { sent: false, reason }
  }
}

async function sendViaProxy(phone: string, code: string): Promise<SmsDeliveryResult> {
  const base = env.SMS_API_BASE_URL!
  const endpoint = env.SMS_VERIFY_ENDPOINT ?? '/ai/login/pwd/smsVerify'
  try {
    const res = await fetchWithTimeout(`${base}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    })
    if (!res.ok) {
      logger.warn('短信代理返回非 2xx ⇒ 不记为已发送', {
        phone: maskPhone(phone),
        reason: `proxy_http_${res.status}`,
      })
      return { sent: false, reason: `proxy_http_${res.status}` }
    }
    return { sent: true }
  } catch (e) {
    logger.warn('短信代理调用异常 ⇒ 不记为已发送', {
      phone: maskPhone(phone),
      reason: providerErrorCode(e),
    })
    return { sent: false, reason: 'proxy_call_failed' }
  }
}

/** 发送通用短信通知（非验证码）。复用 dispatchSms 的发送策略：阿里云 → 代理 → dev console。
 * 注意:阿里云变量属性有 35 字符上限(2026-09-30 API 校验实锤),"整段正文塞单变量"不可行 ——
 * 通知类要走结构化模板,请参照 sendArrearSms 的模式按模板变量传参;本函数保留给历史调用方。 */
export async function sendSmsMessage(
  phone: string,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (env.ALI_SMS_ACCESS_KEY_ID && env.ALI_SMS_ACCESS_KEY_SECRET) {
      const signName = env.ALI_SMS_SIGN_NAME
      // 2026-09-30:通用通知与验证码的模板占位符不同(验证码 {code} / 通知 {content}),共用
      // 一个 ALI_SMS_TEMPLATE_CODE 必被阿里云拒发;而阿里云变量属性上限 35 字符,"整段正文
      // 塞单变量"此路不通(结构化模板见 sendArrearSms)。**因此不再回落到验证码模板**:拿一个
      // 注定被拒发的模板去发,留痕里只剩一行云侧报错,运营看不出真正的原因是这台机没配通知模板。
      const notifyTemplateCode = env.ALI_SMS_NOTIFY_TEMPLATE_CODE
      if (!notifyTemplateCode) {
        logger.warn('通知短信未配置 ALI_SMS_NOTIFY_TEMPLATE_CODE ⇒ 判为未配置,不记为已发送', {
          phone,
        })
        return {
          success: false,
          error:
            'not_configured: 未配置 ALI_SMS_NOTIFY_TEMPLATE_CODE(通知类需独立结构化模板;验证码模板占位符为 {code},共用必被阿里云拒发)',
        }
      }
      if (!signName) {
        logger.warn('通知短信缺少 ALI_SMS_SIGN_NAME ⇒ 判为未配置,不记为已发送', { phone })
        return { success: false, error: 'not_configured: 缺少 ALI_SMS_SIGN_NAME' }
      }
      const sdk = await loadAliyunSdk()
      if (!sdk) {
        // 走到这里说明凭据与模板都在位、本应真发,却加载不了 SDK ⇒ 这是失败,不是"降级即成功"
        logger.warn('阿里云短信 SDK 不可用(有凭据却发不出去) ⇒ 如实报失败', { phone })
        return { success: false, error: 'aliyun_sdk_unavailable' }
      }
      const templateCode = notifyTemplateCode
      const config = new sdk.Config({
        accessKeyId: env.ALI_SMS_ACCESS_KEY_ID,
        accessKeySecret: env.ALI_SMS_ACCESS_KEY_SECRET,
        endpoint: 'dysmsapi.aliyuncs.com',
      })
      const client = new sdk.Client(config)
      const request = new sdk.SendSmsRequest({
        phoneNumbers: phone,
        signName,
        templateCode,
        templateParam: JSON.stringify({ content }),
      })
      const verdict = judgeAliyunResponse(await client.sendSms(request))
      if (!verdict.sent) {
        logger.warn('通知短信未发出', { phone: maskPhone(phone), reason: verdict.reason })
        return { success: false, error: verdict.reason }
      }
      return { success: true }
    }
    if (env.SMS_API_BASE_URL) {
      const base = env.SMS_API_BASE_URL!
      await fetchWithTimeout(`${base}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, content }),
      })
      return { success: true }
    }
    logger.warn('SMS 降级为 console 输出（未配置阿里云/代理）', { phone })
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** 短信发送通道可用性:三家(腾讯云 / 阿里云 / 自建代理)任一配齐即算可用。
 *  原注释写的是"邮箱验证码发送(复用 email-service)",与本函数无关 —— 那是复制粘贴留下的
 *  错标,读的人会以为这里在判邮件通道。 */
export function isSmsConfigured(): boolean {
  return Boolean(
    isTencentSmsConfigured() ||
    (env.ALI_SMS_ACCESS_KEY_ID && env.ALI_SMS_ACCESS_KEY_SECRET) ||
    env.SMS_API_BASE_URL,
  )
}

/** 催缴短信通道可用性:阿里云 AK/SK + 催缴专用模板码齐备才算配置完成。
 * 与 isSmsConfigured 分开 —— 验证码能发 ≠ 催缴模板已申请/已过审。 */
export function isArrearSmsConfigured(): boolean {
  return Boolean(
    env.ALI_SMS_ACCESS_KEY_ID && env.ALI_SMS_ACCESS_KEY_SECRET && env.ALI_SMS_ARREAR_TEMPLATE_CODE,
  )
}

/** 催缴短信(专用结构化模板,env.ALI_SMS_ARREAR_TEMPLATE_CODE,2026-09-30 API 申请:
 * "学费催缴提醒：${name}您好，学员${student}尚有${money}元学费未缴，请尽快完成缴费。如有疑问请联系机构老师。")。
 * 变量属性:name/student=user_nick(≤20字符,不支持空格),money=money(纯数字,单位"元"固定在模板文案里)。
 * 不走 sendSmsMessage:那支是 ${content} 整段占位,与结构化模板占位符不匹配必被拒发。 */
export async function sendArrearSms(
  phone: string,
  vars: { name: string; student: string; money: string },
): Promise<{ success: boolean; error?: string }> {
  const templateCode = env.ALI_SMS_ARREAR_TEMPLATE_CODE
  const signName = env.ALI_SMS_SIGN_NAME
  if (!env.ALI_SMS_ACCESS_KEY_ID || !env.ALI_SMS_ACCESS_KEY_SECRET || !templateCode || !signName) {
    const maskedPhone = phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '***'
    logger.warn('催缴短信未配置(AK/SK 或 ALI_SMS_ARREAR_TEMPLATE_CODE 缺失)', {
      phone: maskedPhone,
    })
    return { success: false, error: 'not_configured' }
  }
  try {
    const sdk = await loadAliyunSdk()
    if (!sdk) {
      logger.warn('阿里云短信 SDK 不可用,催缴短信未发送', { phone })
      return { success: false, error: 'sdk_unavailable' }
    }
    const config = new sdk.Config({
      accessKeyId: env.ALI_SMS_ACCESS_KEY_ID,
      accessKeySecret: env.ALI_SMS_ACCESS_KEY_SECRET,
      endpoint: 'dysmsapi.aliyuncs.com',
    })
    const client = new sdk.Client(config)
    const request = new sdk.SendSmsRequest({
      phoneNumbers: phone,
      signName,
      templateCode,
      templateParam: JSON.stringify(vars),
    })
    const verdict = judgeAliyunResponse(await client.sendSms(request))
    if (!verdict.sent) {
      logger.warn('催缴短信未发出', { phone: maskPhone(phone), reason: verdict.reason })
      return { success: false, error: verdict.reason }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** 测试出口(§22c):镜像测试直接用生产判据,不得在测试里复制一份。
 *  这里暴露的三样都是"错了不会喊"的静默型判据 —— 少剥一层 interop ⇒ 抛 not a constructor;
 *  不判响应体 ⇒ 欠费停机在账面上是"已发送";不判降级方向 ⇒ 生产档把没发出去记成成功。 */
export const __test__ = {
  resolveDefaultCtor,
  resolveNamedCtor,
  judgeAliyunResponse,
  judgeUnconfiguredDelivery,
  providerErrorCode,
  maskPhone,
  loadAliyunSdk,
  pickTemplateCode,
  SCENE_TEMPLATE_ENV_KEYS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
