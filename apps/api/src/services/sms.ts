// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 短信验证码服务。
 * 发送策略:按 SMS_PROVIDER 声明的优先级在已配置通道里逐档回落(缺省 auto = 阿里云 → 代理)。
 * 号码限速:60s 1 次 / 1h 5 次 / 24h 20 次;另有 IP/设备二维档与「手机号+IP」取码配额。
 * 验证码存储已迁 Redis(共享,部署不掉码),Redis 不可用时回退进程内 Map(见 code-store.ts)。
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
import { tryConsumeWindows, refundWindows, type WindowSpec } from '../utils/window-counter.js'
// G-192 同一判据的复用(2026-10-27 短信安全审计):sendSmsCode 原来只靠号码三档 + IP/设备
// 二维,缺「手机号+IP」取码配额;auth.ts 的端点是直连 consumeSendQuota 的,两条路径必须同闸。
import { consumeSendQuota, refundSendQuota } from '../utils/code-echo-guard.js'
import { parsePositiveInt } from '../utils/positive-int.js'
import { logger } from '../utils/logger.js'
import { config } from '../config/index.js'
import {
  isTencentSmsConfigured,
  sendViaTencent,
  sendViaTencentTemplate,
  pickTencentNoticeTemplateId,
  pickTencentMarketingTemplateId,
  TENCENT_NOTICE_TEMPLATE_ENV_KEYS,
  TENCENT_MARKETING_TEMPLATE_ENV_KEYS,
} from './sms-tencent.js'
import {
  hasSmsDeliveryForBiz,
  isPhoneUnsubscribed,
  recordSmsDelivery,
  type SmsDeliveryLogEntry,
} from './sms-compliance.js'
import {
  SMS_MARKETING_TEMPLATE_KEYS,
  SMS_NOTICE_TEMPLATE_KEYS,
  type SendCodeResult,
  type SmsDeliveryResult,
  type SmsMarketingTemplateKey,
  type SmsNoticeTemplateKey,
  type SmsProvider,
  type SmsScene,
  type SmsTemplateKey,
  type TemplatedSmsOptions,
  type TemplatedSmsResult,
} from './sms-types.js'

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

/** 三档限速的键位。抽成函数是为了「先消费、发失败再退回」时两边用的是同一批 key,
 *  而不是各自拼一份字符串(拼错就退不回去,且测试看不出来)。 */
function rateLimitSpecs(phone: string): WindowSpec[] {
  return RATE_LIMIT_WINDOWS.map((w) => ({
    key: `sms:rl:${w.windowMs}:${phone}`,
    windowMs: w.windowMs,
    max: w.max,
  }))
}

async function checkRateLimit(phone: string): Promise<{ ok: boolean; msg: string }> {
  const blocked = await tryConsumeWindows(rateLimitSpecs(phone))
  if (blocked > 0) return { ok: false, msg: RATE_LIMIT_WINDOWS[blocked - 1]?.msg ?? '发送过于频繁' }
  return { ok: true, msg: '' }
}

/** 验证码请求的调用方标识。号码维度之外的第二、三道闸:
 *  单号频控拦得住"盯一个号刷",拦不住"换号轰炸"和"一台设备刷一批号"。 */
export interface SmsSendGuard {
  ip?: string
  deviceId?: string
}

/** IP / 设备指纹二维频控。阈值比单号宽,但足以挡住脚本批量换号。
 *  两个维度都拿不到(单测/内网调用)时不拦,保持既有行为可测。 */
const SEND_GUARD_WINDOWS = {
  ip: [
    { windowMs: 3_600_000, max: 20 },
    { windowMs: 86_400_000, max: 50 },
  ],
  device: [
    { windowMs: 3_600_000, max: 10 },
    { windowMs: 86_400_000, max: 30 },
  ],
} as const

/** IP / 设备指纹两维的键位。与 rateLimitSpecs 同理,消费与退还共用同一份。 */
function sendGuardSpecs(guard?: SmsSendGuard): WindowSpec[] {
  const ip = guard?.ip
  const deviceId = guard?.deviceId
  if (!ip && !deviceId) return []
  return [
    ...(ip
      ? SEND_GUARD_WINDOWS.ip.map((w) => ({
          key: `sms:guard:ip:${w.windowMs}:${ip}`,
          windowMs: w.windowMs,
          max: w.max,
        }))
      : []),
    ...(deviceId
      ? SEND_GUARD_WINDOWS.device.map((w) => ({
          key: `sms:guard:dev:${w.windowMs}:${deviceId}`,
          windowMs: w.windowMs,
          max: w.max,
        }))
      : []),
  ]
}

async function checkSendGuard(guard?: SmsSendGuard): Promise<{ ok: boolean; msg: string }> {
  const windows = sendGuardSpecs(guard)
  if (windows.length === 0) return { ok: true, msg: '' }
  const blocked = await tryConsumeWindows(windows)
  return blocked > 0 ? { ok: false, msg: '请求过于频繁,请稍后再试' } : { ok: true, msg: '' }
}

/** 从请求头推导设备标识:只认前端显式上报的 x-device-id。
 *  **不再用 UA 哈希兜底**(2026-10-26 代码审查改判):同一版本浏览器/小程序 WebView 的 UA
 *  完全相同,共用同一个 `sms:guard:dev:*` 计数器,10 次/时会把一整批正常用户打成 429;
 *  而 UA 本身可任意伪造,拦不住真正的脚本 —— 既误伤又无效。没有显式设备号时只保留 IP 维度。 */
export function extractSmsSendGuard(
  headers: Record<string, unknown>,
  ip: string | undefined,
): SmsSendGuard {
  const raw = headers['x-device-id']
  const header = typeof raw === 'string' ? raw.trim() : ''
  const deviceId = /^[A-Za-z0-9._-]{6,64}$/.test(header) ? header : undefined
  return { ip, deviceId }
}

/** 场景 → 该场景的验证码有效期。必须与云侧模板文案里承诺的时长一致:
 *  注册模板 SMS_491200014 写的是"10分钟内有效"(已过审,改文案要重新报审),
 *  所以这一档实现给 10 分钟;其余三枚模板均写"5分钟",给 5 分钟。
 *  对齐方向只有一个 —— 实现服从已公示的承诺;反过来(把文案压到 5 分钟)是在用户
 *  已经看到的短信上做手脚。新增场景不在这张表里 ⇒ 按最短档给,宁可少给不可多给。 */
export function smsCodeTtlMs(scene?: SmsScene): number {
  return scene === 'register' ? CODE_TTL_REGISTER_MS : CODE_TTL_MS
}

/** 发送短信验证码。`guard` 为 IP/设备维度防刷,拿不到调用方信息时可省略。
 *
 * 2026-10-27 安全审计加固:新增「手机号+IP」取码配额(与 auth.ts 端点同一道
 * consumeSendQuota 闸,5 次/10 分钟)。原来走本函数的公开端点(/public-api/auth-code、
 * /auth/sms/code、/sms-proxy/send、change-phone 两端点)没有这道闸——同一 IP 可在
 * 号码三档的空隙里对**一批不同号码**各打满 20 次/小时;配上后换号轰炸也要过同一道闸。
 * 消费顺序与退款语义:quota 最先消费,任何一步失败都按"没发出去就没次数"逐层退还。 */
export async function sendSmsCode(
  phone: string,
  scene?: SmsScene,
  guard?: SmsSendGuard,
): Promise<SendCodeResult> {
  // ① 「手机号+IP」配额最先消费:它被拒时号码三档/IP档都还没动,直接拒,无需退款。
  //    拿不到 ip(单测/内网)时跳过,与 sendGuardSpecs 的宽容语义一致。
  if (guard?.ip) {
    const quota = await consumeSendQuota(phone, guard.ip)
    if (!quota.allowed) {
      return { success: false, msg: '验证码请求过于频繁,请稍后再试', failure: 'rate_limited' }
    }
  }

  const rl = await checkRateLimit(phone)
  if (!rl.ok) return { success: false, msg: rl.msg, failure: 'rate_limited' }

  const gd = await checkSendGuard(guard)
  if (!gd.ok) {
    // 设备/IP 维度被挡时,号码维度已消费的这次不该留下 —— 没有发出去就没有「次数」
    await refundWindows(rateLimitSpecs(phone))
    return { success: false, msg: gd.msg, failure: 'rate_limited' }
  }

  const code = generateCode()
  const now = Date.now()

  // 检查重发间隔
  const existing = await getCodeEntry(phone)
  if (existing && now - existing.sentAt < CODE_RESEND_INTERVAL_MS) {
    await refundWindows([...rateLimitSpecs(phone), ...sendGuardSpecs(guard)])
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
    // 云侧没发出去:退还本次三档 + 防线计数,否则一次通道抖动就把用户锁 60 秒并吃掉 24h 配额
    await refundWindows([...rateLimitSpecs(phone), ...sendGuardSpecs(guard)])
    if (guard?.ip) await refundSendQuota(phone, guard.ip)
    return { success: false, msg: '验证码发送失败,请稍后重试', failure: 'delivery_failed' }
  }

  return { success: true, msg: '验证码已发送' }
}

/** 投递一枚「调用方自己已经生成并存进 code-store」的验证码。
 *  与 sendSmsCode 的分工:那支自带取码 + 限速 + 重发间隔,适合只管发的端点;
 *  这支只负责"送出去并如实回报",供已在自己作用域内生成/存码的端点复用
 *  (routes/auth.ts 的 /send-code 与 /sms/send —— 它们还要把码交给回显闸,不能另生成一枚)。
 *
 * 2026-10-27 安全审计加固:补上号码三档硬顶(60s/1h 5/24h 20)。原来本函数只有 IP/设备
 * 二维档,而调用方的「手机号+IP」配额(echo:q:phone|ip)换 IP 即重置,同一号码的 24h 上限
 * 实际只剩 60 秒重发间隔在撑 —— 换 IP 轰炸同一手机号理论上限 1440 条/天(条条真实计费)。
 * 补齐后与 sendSmsCode 路径同一号码同一硬顶。 */
export async function deliverSmsCode(
  phone: string,
  code: string,
  scene?: SmsScene,
  guard?: SmsSendGuard,
): Promise<SmsDeliveryResult> {
  const rl = await checkRateLimit(phone)
  if (!rl.ok) return { sent: false, reason: `rate_limited: ${rl.msg}` }
  const gd = await checkSendGuard(guard)
  if (!gd.ok) {
    // IP/设备维度被挡:号码维度刚消费的这一次退回去,没有发出去就没有「次数」
    await refundWindows(rateLimitSpecs(phone))
    return { sent: false, reason: 'rate_limited: 请求过于频繁' }
  }
  const delivery = await dispatchSms(phone, code, scene)
  if (!delivery.sent) {
    await refundWindows([...rateLimitSpecs(phone), ...sendGuardSpecs(guard)])
  }
  return delivery
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
function judgeUnconfiguredDelivery(opts: {
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
  if (channel) {
    const delivery =
      channel === 'tencent'
        ? await sendViaTencent(phone, code, scene)
        : channel === 'aliyun'
          ? await sendViaAliyun(phone, code, scene)
          : await sendViaProxy(phone, code)
    // 验证码也进审计:回执对账同样需要 request_id/serial_no,不能只给营销留流水。
    await recordSmsDelivery({
      provider: channel,
      category: 'code',
      templateKey: scene ?? 'main',
      templateId: delivery.templateId,
      phone,
      status: delivery.sent ? 'accepted' : 'failed',
      reason: delivery.reason,
      requestId: delivery.requestId,
      serialNo: delivery.serialNo,
      bizType: 'sms-code',
    } satisfies SmsDeliveryLogEntry)
    return delivery
  }
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

/** 阿里云通知模板 → env 键。与 TENCENT_NOTICE_TEMPLATE_ENV_KEYS 同构:云侧模板同为
 *  固定正文(无变量),按用途 key 各自寻址,发信不传 templateParam。
 *  未回填的 key 自动落到通用 {content} 结构化模板(ALI_SMS_NOTIFY_TEMPLATE_CODE)或代理。 */
export const ALIYUN_NOTICE_TEMPLATE_ENV_KEYS: Record<SmsNoticeTemplateKey, string> = {
  'binding-success': 'ALI_SMS_TEMPLATE_NOTICE_BINDING_SUCCESS',
  'new-device': 'ALI_SMS_TEMPLATE_NOTICE_NEW_DEVICE',
  'password-changed': 'ALI_SMS_TEMPLATE_NOTICE_PASSWORD_CHANGED',
  maintenance: 'ALI_SMS_TEMPLATE_NOTICE_MAINTENANCE',
  'account-cancel': 'ALI_SMS_TEMPLATE_NOTICE_ACCOUNT_CANCEL',
  'membership-expiry': 'ALI_SMS_TEMPLATE_NOTICE_MEMBERSHIP_EXPIRY',
  'payment-success': 'ALI_SMS_TEMPLATE_NOTICE_PAYMENT_SUCCESS',
  'content-reject': 'ALI_SMS_TEMPLATE_NOTICE_CONTENT_REJECT',
  'security-limit': 'ALI_SMS_TEMPLATE_NOTICE_SECURITY_LIMIT',
  'service-restore': 'ALI_SMS_TEMPLATE_NOTICE_SERVICE_RESTORE',
}

/** 阿里云营销模板 → env 键(与 TENCENT_MARKETING_TEMPLATE_ENV_KEYS 同构)。 */
export const ALIYUN_MARKETING_TEMPLATE_ENV_KEYS: Record<SmsMarketingTemplateKey, string> = {
  'new-feature': 'ALI_SMS_TEMPLATE_MARKETING_NEW_FEATURE',
  promo: 'ALI_SMS_TEMPLATE_MARKETING_PROMO',
}

function pickAliyunTemplatedCode(
  category: 'notice' | 'marketing',
  templateKey: SmsTemplateKey,
): string | undefined {
  const envKey =
    category === 'notice'
      ? ALIYUN_NOTICE_TEMPLATE_ENV_KEYS[templateKey as SmsNoticeTemplateKey]
      : ALIYUN_MARKETING_TEMPLATE_ENV_KEYS[templateKey as SmsMarketingTemplateKey]
  const code = env[envKey]
  return code && code.trim() ? code.trim() : undefined
}

/** 用阿里云任一已过审模板发一条(通知/营销共用底层;验证码另走自己的通道)。 */
async function sendViaAliyunSms(
  phone: string,
  templateCode: string,
  templateParam?: string,
): Promise<SmsDeliveryResult> {
  const signName = env.ALI_SMS_SIGN_NAME
  if (!signName) {
    logger.warn('阿里云短信缺少 ALI_SMS_SIGN_NAME ⇒ 判为未配置,不记为已发送', {
      phone: maskPhone(phone),
    })
    return { sent: false, reason: 'not_configured: 缺少 ALI_SMS_SIGN_NAME' }
  }
  const sdk = await loadAliyunSdk()
  if (!sdk) {
    logger.warn('阿里云短信 SDK 不可用(有凭据却发不出去) ⇒ 如实报失败', {
      phone: maskPhone(phone),
    })
    return { sent: false, reason: 'aliyun_sdk_unavailable' }
  }
  try {
    const sdkConfig = new sdk.Config({
      accessKeyId: env.ALI_SMS_ACCESS_KEY_ID,
      accessKeySecret: env.ALI_SMS_ACCESS_KEY_SECRET,
      endpoint: 'dysmsapi.aliyuncs.com',
    })
    const client = new sdk.Client(sdkConfig)
    const request = new sdk.SendSmsRequest({
      phoneNumbers: phone,
      signName,
      templateCode,
      ...(templateParam ? { templateParam } : {}),
    })
    const verdict = judgeAliyunResponse(await client.sendSms(request))
    if (!verdict.sent) {
      logger.warn('阿里云短信未发出', { phone: maskPhone(phone), reason: verdict.reason })
    }
    return verdict
  } catch (e) {
    const reason = `aliyun_call_failed:${providerErrorCode(e)}`
    logger.warn('阿里云短信调用异常', { phone: maskPhone(phone), reason })
    return { sent: false, reason }
  }
}

/** 用阿里云「通知」模板发一条正文。
 *  与验证码模板严格分开:占位符不同({content} vs {code}),共用必被拒发;
 *  阿里云变量属性上限 35 字符,"整段正文塞单变量"不是长文方案(结构化模板见 sendArrearSms)。 */
async function sendViaAliyunNotify(phone: string, content: string): Promise<SmsDeliveryResult> {
  const notifyTemplateCode = env.ALI_SMS_NOTIFY_TEMPLATE_CODE
  if (!notifyTemplateCode) {
    logger.warn('通知短信未配置 ALI_SMS_NOTIFY_TEMPLATE_CODE ⇒ 判为未配置,不记为已发送', {
      phone: maskPhone(phone),
    })
    return {
      sent: false,
      reason:
        'not_configured: 未配置 ALI_SMS_NOTIFY_TEMPLATE_CODE(通知类需独立结构化模板;验证码模板占位符为 {code},共用必被阿里云拒发)',
    }
  }
  return sendViaAliyunSms(phone, notifyTemplateCode, JSON.stringify({ content }))
}

/** 通知/营销模板走哪条通道:按 SMS_PROVIDER 声明的顺序逐个判"模板 + 凭据 + 兜底正文"。
 *  抽成纯函数是为了让「腾讯模板未过审时回落阿里云」这条有夹具可钉,也供后台状态页复用。 */
export function resolveTemplatedSmsChannel(
  category: 'notice' | 'marketing',
  templateKey: SmsTemplateKey,
  declared: SmsProvider,
  hasFallbackContent: boolean,
): {
  channel: 'tencent' | 'aliyun' | 'proxy' | null
  templateId?: string
  envKey: string
} {
  const isNotice = category === 'notice'
  const templateId = isNotice
    ? pickTencentNoticeTemplateId(templateKey as SmsNoticeTemplateKey)
    : pickTencentMarketingTemplateId(templateKey as SmsMarketingTemplateKey)
  const envKey = isNotice
    ? TENCENT_NOTICE_TEMPLATE_ENV_KEYS[templateKey as SmsNoticeTemplateKey]
    : TENCENT_MARKETING_TEMPLATE_ENV_KEYS[templateKey as SmsMarketingTemplateKey]
  const aliyunTemplateId = pickAliyunTemplatedCode(category, templateKey)
  const aliyunEnvKey = isNotice
    ? ALIYUN_NOTICE_TEMPLATE_ENV_KEYS[templateKey as SmsNoticeTemplateKey]
    : ALIYUN_MARKETING_TEMPLATE_ENV_KEYS[templateKey as SmsMarketingTemplateKey]

  // 结构化模板的 auto 语义:该用途的腾讯模板已回填 ⇒ 优先腾讯;
  // 未回填就按历史顺序回落。验证码通道的 auto 顺序不动(有测试钉着)。
  const order =
    declared === 'auto' && templateId
      ? (['tencent', 'aliyun', 'proxy'] as const)
      : smsProviderOrder(declared)

  for (const p of order) {
    if (p === 'tencent' && isTencentSmsConfigured() && templateId) {
      return { channel: 'tencent', templateId, envKey }
    }
    if (
      p === 'aliyun' &&
      isAliyunSmsConfigured() &&
      (aliyunTemplateId || (env.ALI_SMS_NOTIFY_TEMPLATE_CODE && hasFallbackContent))
    ) {
      return {
        channel: 'aliyun',
        templateId: aliyunTemplateId,
        envKey: aliyunTemplateId ? aliyunEnvKey : envKey,
      }
    }
    if (p === 'proxy' && env.SMS_API_BASE_URL && hasFallbackContent) {
      return { channel: 'proxy', envKey }
    }
  }
  return { channel: null, envKey }
}

/** 营销短信发送时段(北京时间)。运营商对"夜间营销"的投诉最敏感,
 *  默认 08:00–21:00;窗口写成 "HH:MM-HH:MM",跨零点(start > end)也支持。
 *  解析失败按默认窗口判,不放宽。 */
export function isMarketingSendWindow(now: Date = new Date(), raw?: string): boolean {
  const text = (raw ?? env.SMS_MARKETING_SEND_WINDOW ?? '08:00-21:00').trim()
  const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(text)
  const [start, end] = m
    ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])]
    : [8 * 60, 21 * 60]
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const current = hour * 60 + minute
  return start <= end ? current >= start && current < end : current >= start || current < end
}

/** 营销短信总开关。`SMS_MARKETING_ENABLED=0/false/off` 时全局熔断,
 *  群发与单发都发不出去 —— 出舆情或欠费时运维只需改一个环境变量,不必逐个接口关。 */
export function isMarketingSmsEnabled(raw?: string): boolean {
  const value = (raw ?? env.SMS_MARKETING_ENABLED ?? '1').trim().toLowerCase()
  return value !== '0' && value !== 'false' && value !== 'off'
}

/** 通知/营销短信的频控上限。营销档比通知档更窄 —— 运营商对营销投诉的容忍度接近于零。
 *  上限与窗口分开写:后台状态页要显示这几个数,从同一常量取才不会出现"页面写 2、实际拦 3"。 */
export const SMS_TEMPLATED_RATE_CAPS = {
  notice: { hourly: 5, daily: 20 },
  marketing: { daily: 2, monthly: 4 },
} as const

const TEMPLATED_RATE_WINDOWS: Record<'notice' | 'marketing', { windowMs: number; max: number }[]> =
  {
    notice: [
      { windowMs: 3_600_000, max: SMS_TEMPLATED_RATE_CAPS.notice.hourly },
      { windowMs: 86_400_000, max: SMS_TEMPLATED_RATE_CAPS.notice.daily },
    ],
    marketing: [
      { windowMs: 86_400_000, max: SMS_TEMPLATED_RATE_CAPS.marketing.daily },
      { windowMs: 30 * 86_400_000, max: SMS_TEMPLATED_RATE_CAPS.marketing.monthly },
    ],
  }

/** 同进程在途业务键。DB 幂等是"先查后发",两个并发请求可能都查到"未发过";
 *  生产为单实例部署(NSSM 只跑一个 IHUI-API),这个集合足以覆盖并发窗口。
 *  **部署约束**:多实例扩容前必须换成分布式锁(Redis SET NX),否则跨实例并发会重复发送;
 *  `/api/health` 已暴露 redis 状态,内存频控兜底同样只在 Redis down + 单实例时安全。 */
const inflightTemplatedBiz = new Set<string>()

/** 结构化模板发送(通知/营销)。验证码仍走 sendSmsCode —— 两者模板、频控、退订规则都不同。 */
export async function sendTemplatedSms(
  phone: string,
  options: TemplatedSmsOptions,
): Promise<TemplatedSmsResult> {
  const { category, templateKey } = options
  const noticeKeys = SMS_NOTICE_TEMPLATE_KEYS as readonly string[]
  const marketingKeys = SMS_MARKETING_TEMPLATE_KEYS as readonly string[]
  const keyValid =
    category === 'notice' ? noticeKeys.includes(templateKey) : marketingKeys.includes(templateKey)
  if (!keyValid) {
    return { success: false, error: `invalid_template_key: ${category}/${templateKey}` }
  }

  const declared = (env.SMS_PROVIDER ?? 'auto') as SmsProvider
  const resolved = resolveTemplatedSmsChannel(
    category,
    templateKey,
    declared,
    Boolean(options.fallbackContent),
  )

  // dryRun 只解析通道,不碰黑名单/频控计数器,也不发网络请求。
  if (options.dryRun) {
    return {
      success: false,
      error: `dry_run: ${resolved.channel ?? 'not_configured'}`,
      provider: resolved.channel ?? undefined,
      templateId: resolved.templateId,
    }
  }

  // 营销总开关:放在所有营销判据最前面。关闭时即使通道就绪、时段合法也一律不发。
  if (category === 'marketing' && !isMarketingSmsEnabled()) {
    logger.warn('营销总开关已关闭 ⇒ 拦截', { phone: maskPhone(phone) })
    await recordSmsDelivery({
      provider: resolved.channel ?? 'none',
      category,
      templateKey,
      templateId: resolved.templateId,
      phone,
      status: 'suppressed',
      reason: 'marketing_disabled',
      bizType: options.bizType,
      bizId: options.bizId,
    } satisfies SmsDeliveryLogEntry)
    return { success: false, error: 'marketing_disabled' }
  }

  // 幂等:同一业务事件(bizType+bizId)已成功发过就不再发第二条。
  // 命中仍返回 success —— 对调用方来说"这条通知已经送达"就是目标达成,
  // 回失败会诱导业务侧重试,反而制造重复短信。
  if (options.bizType && options.bizId) {
    const duplicated = await hasSmsDeliveryForBiz(phone, options.bizType, options.bizId)
    if (duplicated) {
      await recordSmsDelivery({
        provider: resolved.channel ?? 'none',
        category,
        templateKey,
        templateId: resolved.templateId,
        phone,
        status: 'suppressed',
        reason: 'duplicate',
        bizType: options.bizType,
        bizId: options.bizId,
      } satisfies SmsDeliveryLogEntry)
      return {
        success: true,
        error: 'duplicate',
        deduplicated: true,
        provider: resolved.channel ?? undefined,
        templateId: resolved.templateId,
      }
    }
  }

  if (!resolved.channel) {
    const error =
      `not_configured: ${resolved.envKey}(对应厂商模板未过审或未回填) 且 ` +
      `ALI_SMS_NOTIFY_TEMPLATE_CODE / SMS_API_BASE_URL 未配置`
    logger.warn('通知/营销短信没有可用通道 ⇒ 判未配置', { phone: maskPhone(phone), error })
    await recordSmsDelivery({
      provider: 'none',
      category,
      templateKey,
      phone,
      status: 'failed',
      reason: 'not_configured',
      bizType: options.bizType,
      bizId: options.bizId,
    } satisfies SmsDeliveryLogEntry)
    return { success: false, error }
  }

  // 营销类先过时段闸:北京时间 08:00–21:00 之外不发(运营商夜间营销投诉最敏感)。
  if (category === 'marketing' && !isMarketingSendWindow()) {
    const error = 'outside_marketing_window'
    logger.warn('营销短信不在发送时段 ⇒ 拦截', { phone: maskPhone(phone), error })
    await recordSmsDelivery({
      provider: resolved.channel,
      category,
      templateKey,
      templateId: resolved.templateId,
      phone,
      status: 'suppressed',
      reason: error,
      bizType: options.bizType,
      bizId: options.bizId,
    } satisfies SmsDeliveryLogEntry)
    return { success: false, error }
  }

  // 营销类必须先过退订黑名单。查不到存储时默认拒绝(fail-closed):
  // 「可能已经退订」和「确认没退订」不是一回事,后者才允许发。
  if (category === 'marketing') {
    const state = await isPhoneUnsubscribed(phone)
    if (state.unsubscribed) {
      await recordSmsDelivery({
        provider: resolved.channel ?? 'none',
        category,
        templateKey,
        templateId: resolved.templateId,
        phone,
        status: 'suppressed',
        reason: 'suppressed_unsubscribed',
        bizType: options.bizType,
        bizId: options.bizId,
      } satisfies SmsDeliveryLogEntry)
      return { success: false, error: 'suppressed_unsubscribed' }
    }
    if (!state.known && env.SMS_UNSUBSCRIBE_FAIL_CLOSED !== '0') {
      return { success: false, error: 'unsubscribe_check_unavailable' }
    }
  }

  if (!options.skipRateLimit) {
    const blocked = await tryConsumeWindows(
      TEMPLATED_RATE_WINDOWS[category].map((w) => ({
        key: `sms:${category}:${w.windowMs}:${phone}`,
        windowMs: w.windowMs,
        max: w.max,
      })),
    )
    if (blocked > 0) {
      await recordSmsDelivery({
        provider: resolved.channel ?? 'none',
        category,
        templateKey,
        templateId: resolved.templateId,
        phone,
        status: 'suppressed',
        reason: `rate_limited:${TEMPLATED_RATE_WINDOWS[category][blocked - 1]?.windowMs ?? ''}`,
        bizType: options.bizType,
        bizId: options.bizId,
      } satisfies SmsDeliveryLogEntry)
      return { success: false, error: 'rate_limited' }
    }
  }

  // 全局日上限放在最后一道:单号频控/黑名单已经挡掉的请求不消耗全局额度,
  // 否则 200 个已退订号码就能把当天的营销额度全部空转掉。
  if (category === 'marketing') {
    // 解析失败必须回落默认值,不能反过来把上限关掉 —— 这一档是费用/合规兜底
    const cap = parsePositiveInt(
      env.SMS_MARKETING_GLOBAL_DAILY_CAP,
      100,
      'SMS_MARKETING_GLOBAL_DAILY_CAP',
    )
    const blocked = await tryConsumeWindows([
      { key: 'sms:marketing:global', windowMs: 86_400_000, max: cap },
    ])
    if (blocked > 0) {
      logger.warn('营销短信触发全局日上限 ⇒ 拦截', { cap })
      await recordSmsDelivery({
        provider: resolved.channel ?? 'none',
        category,
        templateKey,
        templateId: resolved.templateId,
        phone,
        status: 'suppressed',
        reason: 'global_daily_cap',
        bizType: options.bizType,
        bizId: options.bizId,
      } satisfies SmsDeliveryLogEntry)
      return { success: false, error: 'global_daily_cap' }
    }
  }

  // 并发去重:同一 bizType+bizId 正在发送途中时,后来的请求直接按"已发"处理,
  // 不再等它落库(否则两个请求都会穿过上面的 hasSmsDeliveryForBiz 检查)。
  const bizKey = options.bizType && options.bizId ? `${options.bizType}\u0000${options.bizId}` : ''
  if (bizKey && inflightTemplatedBiz.has(bizKey)) {
    await recordSmsDelivery({
      provider: resolved.channel,
      category,
      templateKey,
      templateId: resolved.templateId,
      phone,
      status: 'suppressed',
      reason: 'duplicate',
      bizType: options.bizType,
      bizId: options.bizId,
    } satisfies SmsDeliveryLogEntry)
    return {
      success: true,
      error: 'duplicate',
      deduplicated: true,
      provider: resolved.channel,
      templateId: resolved.templateId,
    }
  }
  if (bizKey) inflightTemplatedBiz.add(bizKey)
  try {
    let delivery: SmsDeliveryResult
    if (resolved.channel === 'tencent') {
      delivery = await sendViaTencentTemplate(phone, resolved.templateId!, [])
    } else if (resolved.channel === 'aliyun') {
      delivery = resolved.templateId
        ? await sendViaAliyunSms(phone, resolved.templateId)
        : await sendViaAliyunNotify(phone, options.fallbackContent!)
    } else {
      const base = env.SMS_API_BASE_URL!
      try {
        const res = await fetchWithTimeout(`${base}/sms/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, content: options.fallbackContent }),
        })
        delivery = res.ok ? { sent: true } : { sent: false, reason: `proxy_http_${res.status}` }
      } catch (e) {
        delivery = { sent: false, reason: `proxy_call_failed:${providerErrorCode(e)}` }
      }
    }

    await recordSmsDelivery({
      provider: resolved.channel,
      category,
      templateKey,
      templateId: resolved.templateId ?? delivery.templateId,
      phone,
      status: delivery.sent ? 'accepted' : 'failed',
      reason: delivery.reason,
      requestId: delivery.requestId,
      serialNo: delivery.serialNo,
      bizType: options.bizType,
      bizId: options.bizId,
    } satisfies SmsDeliveryLogEntry)

    return {
      success: delivery.sent,
      error: delivery.reason,
      provider: resolved.channel,
      requestId: delivery.requestId,
      templateId: resolved.templateId ?? delivery.templateId,
    }
  } finally {
    if (bizKey) inflightTemplatedBiz.delete(bizKey)
  }
}

/** 发送通用短信通知（非验证码）。
 *  带 `templateKey` 时走结构化模板(腾讯优先/阿里云兜底),不带时保持历史 `{content}` 行为。
 *  注意:阿里云变量属性有 35 字符上限(2026-09-30 API 校验实锤),"整段正文塞单变量"不可行 ——
 *  通知类应尽量走结构化模板;本函数的历史分支保留给存量调用方。 */
export async function sendSmsMessage(
  phone: string,
  content: string,
  options?: Omit<TemplatedSmsOptions, 'fallbackContent' | 'category' | 'templateKey'> & {
    category: 'notice' | 'marketing'
    templateKey: SmsTemplateKey
  },
): Promise<{ success: boolean; error?: string }> {
  if (options?.templateKey) {
    const r = await sendTemplatedSms(phone, { ...options, fallbackContent: content })
    return { success: r.success, error: r.error }
  }
  try {
    if (isAliyunSmsConfigured()) {
      const verdict = await sendViaAliyunNotify(phone, content)
      return verdict.sent ? { success: true } : { success: false, error: verdict.reason }
    }
    if (env.SMS_API_BASE_URL) {
      const base = env.SMS_API_BASE_URL!
      const res = await fetchWithTimeout(`${base}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, content }),
      })
      if (!res.ok) return { success: false, error: `proxy_http_${res.status}` }
      return { success: true }
    }
    // 历史分支不再无条件假成功:生产档必须判失败,只有显式 SMS_DEV_ECHO=1 且非生产档才允许 console 降级。
    // 否则调用方会把"一条都没发出去"记成 notification_logs.status='sent'(2026-10-26 审查实锤)。
    logger.warn('SMS 未配置任何通道（历史分支）', { phone: maskPhone(phone) })
    const verdict = judgeUnconfiguredDelivery({
      productionGuard: config.isProductionGuard ?? config.NODE_ENV === 'production',
      devEchoOptIn: env.SMS_DEV_ECHO === '1',
    })
    return verdict.sent ? { success: true } : { success: false, error: verdict.reason }
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
      logger.warn('阿里云短信 SDK 不可用,催缴短信未发送', { phone: maskPhone(phone) })
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
