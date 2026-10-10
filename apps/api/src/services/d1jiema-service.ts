// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * d1jiema 接码平台客户端(第1解麻,https://www.d1jiema.com/api.html)。
 *
 * 设计要点:
 *  - 全部能力走同一 GET 端点(code=xxx&token=xxx&...),纯文本响应;
 *  - 失败归一:`ERROR:错误信息` 前缀 → 抛 D1jiemaError(截取错误正文);
 *  - 取码未收到:响应含 `[尚未收到]` → 返回 pending 形状(不算错误,前端轮询判定用);
 *  - Token 来自 config.D1JIEMA_TOKEN(C 类可选第三方):空串时消费点显式抛
 *    「未配置」,不阻断服务启动;
 *  - URL 编码由 URLSearchParams 统一完成(keyWord 等中文参数无需调用方预处理);
 *  - 超时 10s(AbortController,仿 coze-oauth-apps.ts 模式);
 *  - 验证码提取:优先匹配「验证码/校验码/code」后跟的 4-8 位数字,兜底取首个 4-8 位数字;
 *  - 取号防脱敏:平台偶发返回脱敏号(如 165****7249)而 getMsg 拒收(手机号格式错误)
 *    → 随机取号遇脱敏号自动释放重取(上限 5 次)。
 */

import { config } from '../config/index.js'

const D1JIEMA_BASE_URL = 'https://api.d1jiema.com/zc/data.php'
// 网页版 trsCode 体系端点(与 API token 体系不同,账密体系):「号码相关短信」全局时间线
const D1JIEMA_WEB_BASE_URL = 'https://www.d1jiema.com/zc/zhicode/basereq/getc.php'
const D1JIEMA_TIMEOUT_MS = 10_000
const PENDING_MARKER = '[尚未收到]'

export class D1jiemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'D1jiemaError'
  }
}

export type CardType = '实卡' | '虚卡' | '全部'

export interface GetPhoneParams {
  /** 短信关键词,一般是短信黑括号里的名字,如【毛竹】验证码9876 → keyWord=毛竹 */
  keyWord?: string
  /** 指定号码(不填随机取号) */
  phone?: string
  /** 省份(可选,名称参照平台 APP) */
  province?: string
  /** 卡类型:实卡/虚卡/全部 */
  cardType?: CardType
}

export type SmsResult =
  | { status: 'received'; code?: string; raw: string }
  | { status: 'pending'; raw: string }

/** 优先级验证码提取:业务词后数字优先,兜底首个 4-8 位数字 */
export function extractVerifyCode(raw: string): string | undefined {
  const patterns = [
    /(?:验证码|校验码|动态码|确认码|码是|code\s*(?:is)?|code)[:：\s]*(\d{4,8})/i,
    /(\d{4,8})/,
  ]
  for (const p of patterns) {
    const m = raw.match(p)
    if (m?.[1]) return m[1]
  }
  return undefined
}

/** 从短信原文提取平台名:取第一个【】内容(如【trae】验证码058967 → trae) */
export function extractPlatform(raw: string): string | undefined {
  const m = raw.match(/【([^】]{1,32})】/)
  return m?.[1]?.trim() || undefined
}

/** 短信用途的词汇表**只在这里定义一次**:分类器产出它、台账列(varchar(16))读回来也归一到它。 */
const SMS_USAGE_KINDS = ['register', 'login', 'other'] as const
export type SmsUsageKind = (typeof SMS_USAGE_KINDS)[number]

/** 短信用途判定:含「注册」=新号注册,含「登录」=该号已注册过(登录码),其余 other */
export function classifySmsUsage(raw: string): SmsUsageKind {
  if (raw.includes('注册')) return 'register'
  if (raw.includes('登录') || raw.includes('登陆')) return 'login'
  return 'other'
}

/**
 * 把库里的 varchar 值收回词汇表。列是自由文本(历史值/手工改库都可能落进别的字符串),
 * 而统计接口的返回类型是联合 —— 不收回就直接 TS2322,收回用 `as` 又是把没验的值当验过。
 */
export function toSmsUsageKind(value: string): SmsUsageKind {
  return (SMS_USAGE_KINDS as readonly string[]).includes(value)
    ? (value as SmsUsageKind)
    : 'other'
}

/** 统一平台调用:返回纯文本正文(已 trim),ERROR: 前缀归一为 D1jiemaError */
async function callD1jiema(
  action: string,
  params: Record<string, string | undefined> = {},
): Promise<string> {
  const token = config.D1JIEMA_TOKEN
  if (!token) {
    throw new D1jiemaError('短信接码服务未配置(D1JIEMA_TOKEN 为空,请在 apps/api/.env 填入平台 API Token)')
  }
  const url = new URL(D1JIEMA_BASE_URL)
  url.searchParams.set('code', action)
  url.searchParams.set('token', token)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), D1JIEMA_TIMEOUT_MS)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    const text = (await resp.text()).trim()
    if (text.startsWith('ERROR:')) {
      throw new D1jiemaError(text.slice('ERROR:'.length).trim() || '接码平台返回未知错误')
    }
    return text
  } catch (e) {
    if (e instanceof D1jiemaError) throw e
    if (e instanceof Error && e.name === 'AbortError') {
      throw new D1jiemaError(`接码平台请求超时(${D1JIEMA_TIMEOUT_MS / 1000}s)`)
    }
    throw new D1jiemaError(`接码平台调用失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    clearTimeout(timer)
  }
}

/** 查询余额 → 平台原样返回余额数字文本 */
export async function getBalance(): Promise<string> {
  return callD1jiema('leftAmount')
}

/** 取号 → 返回手机号文本;随机取号遇脱敏号(平台偶发,如 165****7249)自动释放重取 */
export async function getPhone(p: GetPhoneParams): Promise<string> {
  const GET_PHONE_MAX_TRIES = 5
  const baseParams = {
    keyWord: p.keyWord,
    province: p.province,
    cardType: p.cardType && p.cardType !== '全部' ? p.cardType : undefined,
  }
  // 指定号码不做脱敏重试(重试返回同号,无意义)
  if (p.phone) return callD1jiema('getPhone', { ...baseParams, phone: p.phone })
  let lastMasked = ''
  for (let i = 0; i < GET_PHONE_MAX_TRIES; i++) {
    const phone = await callD1jiema('getPhone', baseParams)
    if (!phone.includes('*')) return phone
    lastMasked = phone
    // 脱敏号无法取码(getMsg 报「手机号格式错误」),顺手释放回池(失败不阻断重取)
    await releasePhone(phone).catch(() => undefined)
  }
  throw new D1jiemaError(
    `连续 ${GET_PHONE_MAX_TRIES} 次取号均返回脱敏号(如 ${lastMasked}),请稍后重试或指定号码`,
  )
}

/** 取码:含 [尚未收到] → pending;否则 received 并尝试提取验证码 */
export async function getMsg(phone: string, keyWord: string): Promise<SmsResult> {
  const raw = await callD1jiema('getMsg', { phone, keyWord })
  if (raw.includes(PENDING_MARKER)) {
    return { status: 'pending', raw }
  }
  return { status: 'received', code: extractVerifyCode(raw), raw }
}

/** 释放号码 → 返回释放结果文本(平台备注:失败跳过即可,勿重复释放) */
export async function releasePhone(phone: string): Promise<string> {
  return callD1jiema('release', { phone })
}

/** 拉黑号码 → 返回拉黑结果文本 */
export async function blockPhone(phone: string): Promise<string> {
  return callD1jiema('block', { phone })
}

/** 发送短信(phone 号码向 toPhone 发送 content;不能向个人手机号发送,发垃圾信息平台封号) */
export async function sendSms(phone: string, toPhone: string, content: string): Promise<string> {
  return callD1jiema('send', { phone, toPhone, content })
}

/** 查询历史记录(平台限频 1 次/分钟,返回最近 24h 最多 100 条,\n 分割) */
async function queryUsed(): Promise<string[]> {
  const raw = await callD1jiema('queryUsed')
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/** queryUsed 单条记录解析项(平台行格式实测 2026-10-09:号码\t扣费\t短信原文) */
export interface UsedRecord {
  phone: string
  /** 平台扣费金额(原样字符串,如 0.45) */
  fee: string
  /** 从短信原文【】提取的平台名(extractPlatform) */
  platform?: string
  /** 短信用途分类(classifySmsUsage):register=新号 / login=已注册过 / other */
  usageKind: 'register' | 'login' | 'other'
  /** 短信原文(完整,未打码——queryUsed 是本账号自己的流水) */
  text: string
}

/** 解析单行「号码\t扣费\t短信原文」;格式不合(空段/缺段)返回 null 跳过 */
function parseUsedLine(line: string): UsedRecord | null {
  const idx1 = line.indexOf('\t')
  if (idx1 <= 0) return null
  const phone = line.slice(0, idx1)
  const rest = line.slice(idx1 + 1)
  const idx2 = rest.indexOf('\t')
  if (idx2 < 0) return null
  const fee = rest.slice(0, idx2)
  const text = rest.slice(idx2 + 1)
  if (!phone || !fee || !text) return null
  return { phone, fee, platform: extractPlatform(text), usageKind: classifySmsUsage(text), text }
}

/** 查询历史并结构化解析(本账号 24h 流水,短信原文未打码 → 可精确判定注册状态) */
export async function queryUsedDetailed(): Promise<UsedRecord[]> {
  return (await queryUsed())
    .map(parseUsedLine)
    .filter((r): r is UsedRecord => r !== null)
}

/** 「号码相关短信」全局时间线记录项(内容对非收取者打码,只透出时间与标记) */
export interface RelatedMsgRecord {
  /** 记录时间(HH:MM,平台时间线原样,无日期) */
  time: string
  /** 平台可见性标记(Y/N,语义未公开,原样透传) */
  flag: string
}

/**
 * 平台网页版「号码相关短信」全局时间线(trsCode=relatedMsgs,2026-10-09 探针实证):
 * 返回该号码在平台被所有买家收码的记录(时间+标记,内容打码),全局号码维度、
 * 免费、无需登录态 —— 自动筛新号热度过滤的数据源(近期被高频流转的超热门号
 * 已被他人注册过目标平台的概率更高)。
 * 请求 p = phoneNo\nacct\npassword(网页版账密体系,复用 D1JIEMA_ACCT/D1JIEMA_PASSWORD)。
 */
export async function getRelatedMsgs(phone: string): Promise<RelatedMsgRecord[]> {
  const acct = config.D1JIEMA_ACCT
  const password = config.D1JIEMA_PASSWORD
  if (!acct || !password) {
    throw new D1jiemaError(
      '热度查询未配置(D1JIEMA_ACCT/D1JIEMA_PASSWORD 为空,请在 apps/api/.env 填入平台网页版账密)',
    )
  }
  const url = new URL(D1JIEMA_WEB_BASE_URL)
  url.searchParams.set('trsCode', 'relatedMsgs')
  url.searchParams.set('p', [phone, acct, password].join('\n'))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), D1JIEMA_TIMEOUT_MS)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    const text = (await resp.text()).trim()
    if (text.startsWith('ERROR:')) {
      throw new D1jiemaError(text.slice('ERROR:'.length).trim() || '接码平台返回未知错误')
    }
    return parseRelatedMsgs(text)
  } catch (e) {
    if (e instanceof D1jiemaError) throw e
    if (e instanceof Error && e.name === 'AbortError') {
      throw new D1jiemaError(`接码平台请求超时(${D1JIEMA_TIMEOUT_MS / 1000}s)`)
    }
    throw new D1jiemaError(`接码平台调用失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 解析时间线流式文本,形如「HH:MM N ***内容打码*** HH:MM Y ***内容打码*** …」。
 * 分隔符不固定(空格/换行/制表符均可),按「时刻 + 单独 Y/N 标记」锚定每条记录;
 * 无匹配(处女号/空响应)返回空数组。
 */
function parseRelatedMsgs(text: string): RelatedMsgRecord[] {
  const records: RelatedMsgRecord[] = []
  const re = /(\d{1,2}:\d{2})\s+([YN])(?=\s|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const time = m[1]
    const flag = m[2]
    if (time && flag) records.push({ time, flag })
  }
  return records
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
