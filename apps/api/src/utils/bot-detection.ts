/**
 * 机器人 / 自动化客户端检测启发式工具。
 *
 * 设计原则:
 * 1. 所有 UserAgent 字符串匹配走常量时间比较 (timing-safe),防止攻击者通过计时差异
 *    反推检测规则关键词 (timing attack on detection)。
 * 2. 行为指纹基于请求模式统计 (间隔标准差 / 事件缺失 / Referer 异常),无外部依赖。
 * 3. 启发式有误报,只产出 0-100 分数,最终决策由调用方 (anomaly-detector / anti-automation) 综合。
 */

import { logger } from './logger.js'

/* -------------------------------------------------------------------------- */
/* 常量时间字节比较原语                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 常量时间字节相等判断:相等返回 1,否则返回 0。不产生分支,不提前返回。
 * 输入限定 0-255 字节值,diff ∈ [0,255],(diff-1)>>>31 在 diff===0 时为 1,否则为 0。
 */
function ctByteEqual(a: number, b: number): number {
  const diff = (a ^ b) | 0
  return ((diff - 1) >>> 31) & 1
}

/**
 * 常量时间子串包含判断:haystack 中是否包含 needle。
 *
 * 遍历所有起点 + 所有字符,无提前返回,耗时仅取决于两个字符串长度,
 * 与是否命中及命中位置无关。用于 UA 关键词检测,防止通过计时反推关键词。
 */
function timingSafeContains(haystack: string, needle: string): boolean {
  if (needle.length === 0) return false
  const h = Buffer.from(haystack.toLowerCase(), 'utf8')
  const n = Buffer.from(needle.toLowerCase(), 'utf8')
  if (h.length < n.length) return false
  let found = 0
  for (let i = 0; i <= h.length - n.length; i++) {
    let match = 1
    for (let j = 0; j < n.length; j++) {
      const a = h[i + j] ?? 0
      const b = n[j] ?? 0
      match &= ctByteEqual(a, b)
    }
    found |= match
  }
  return found === 1
}

/** 常量时间:haystack 是否包含 needles 中任一关键词(遍历全部关键词,无提前返回)。 */
function timingSafeContainsAny(haystack: string, needles: readonly string[]): boolean {
  let hit = 0
  for (const needle of needles) {
    if (timingSafeContains(haystack, needle)) hit = 1
  }
  return hit === 1
}

/* -------------------------------------------------------------------------- */
/* 关键词表                                                                    */
/* -------------------------------------------------------------------------- */

const BOT_KEYWORDS = [
  'bot',
  'crawler',
  'spider',
  'scraper',
  'slurp',
  'googlebot',
  'bingbot',
  'yandexbot',
  'baiduspider',
  'duckduckbot',
  'semrush',
  'ahrefs',
  'mj12',
  'petalbot',
  'applebot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'telegrambot',
  'discordbot',
  'whatsapp',
] as const

const CURL_LIKE_KEYWORDS = [
  'curl',
  'wget',
  'python-requests',
  'python-urllib',
  'httpx',
  'axios',
  'go-http-client',
  'okhttp',
  'node-fetch',
  'aiohttp',
  'scrapy',
  'httpclient',
  'java/',
  'guzzlehttp',
] as const

const HEADLESS_KEYWORDS = [
  'headlesschrome',
  'phantomjs',
  'selenium',
  'playwright',
  'puppeteer',
  'webdriver',
  'electron',
  'chrome-lighthouse',
  'wbox',
  'nightmare',
  'htmlunit',
] as const

/* -------------------------------------------------------------------------- */
/* UA 启发式                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 检测 UA 是否为已知 bot / crawler / spider / scraper。
 * 空字符串视为非 bot(由调用方按"缺失 UA"单独处理),此处只做关键词匹配。
 */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.length === 0) return false
  return timingSafeContainsAny(ua, BOT_KEYWORDS)
}

/** 检测 UA 是否为 curl / wget / python-requests / httpx / axios 等命令行 HTTP 客户端。 */
export function isCurlLike(ua: string | null | undefined): boolean {
  if (!ua || ua.length === 0) return false
  return timingSafeContainsAny(ua, CURL_LIKE_KEYWORDS)
}

/** 检测 UA 是否为 HeadlessChrome / PhantomJS / Selenium / playwright / puppeteer 等无头浏览器。 */
export function isHeadlessBrowser(ua: string | null | undefined): boolean {
  if (!ua || ua.length === 0) return false
  return timingSafeContainsAny(ua, HEADLESS_KEYWORDS)
}

/** UA 是否缺失或过短(正常浏览器 UA 一般 > 30 字符)。 */
export function isMissingOrShortUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true
  return ua.length < 10
}

/* -------------------------------------------------------------------------- */
/* 行为指纹                                                                    */
/* -------------------------------------------------------------------------- */

export interface BehaviorContext {
  /** 客户端 User-Agent */
  userAgent?: string | null
  /** 最近若干次请求之间的间隔(毫秒),按时间顺序 */
  requestIntervals?: number[]
  /** Referer 头(可能为空) */
  referer?: string | null
  /** 是否携带 Cookie */
  hasCookie?: boolean
  /** 客户端上报的鼠标事件数(可选,需前端配合) */
  mouseEvents?: number
  /** 客户端上报的键盘事件数(可选) */
  keyboardEvents?: number
  /** 客户端上报的触摸事件数(可选) */
  touchEvents?: number
}

/** 计算数组均值与样本标准差。空数组返回 { mean: 0, stddev: 0 }。 */
function meanStddev(values: number[]): { mean: number; stddev: number } {
  if (values.length === 0) return { mean: 0, stddev: 0 }
  let sum = 0
  for (const v of values) sum += v
  const mean = sum / values.length
  let sqSum = 0
  for (const v of values) {
    const d = v - mean
    sqSum += d * d
  }
  const variance = sqSum / values.length
  return { mean, stddev: Math.sqrt(variance) }
}

/**
 * 基于请求模式计算自动化分数 (0-100,越高越像机器人)。
 *
 * 评估维度:
 * 1. 请求间隔标准差过小(机器人节奏固定,human 节奏随机)
 * 2. 鼠标 / 键盘 / 触摸事件缺失(有 Cookie 但零交互事件)
 * 3. Referer 异常(无 Referer 但有 Cookie,典型脚本直发)
 * 4. UA 特征(bot / curl / headless / 缺失)
 *
 * 各维度累加后截断到 [0,100]。
 */
export function calculateBehaviorScore(ctx: BehaviorContext): number {
  let score = 0

  // 1. 间隔规律性:节奏越固定越可疑
  const intervals = ctx.requestIntervals ?? []
  if (intervals.length >= 5) {
    const { mean, stddev } = meanStddev(intervals)
    if (mean > 0) {
      const cv = stddev / mean // 变异系数
      if (cv < 0.05) score += 45 // 极规律,几乎确定是脚本
      else if (cv < 0.1) score += 35
      else if (cv < 0.2) score += 20
    }
  }

  // 2. 交互事件缺失:有 Cookie(说明应有过浏览) 却零交互
  const mouse = ctx.mouseEvents ?? 0
  const keyboard = ctx.keyboardEvents ?? 0
  const touch = ctx.touchEvents ?? 0
  if (ctx.hasCookie && mouse === 0 && keyboard === 0 && touch === 0) {
    score += 25
  }

  // 3. Referer 异常:无 Referer 但有 Cookie
  if (ctx.hasCookie && (!ctx.referer || ctx.referer.length === 0)) {
    score += 15
  }

  // 4. UA 特征
  const ua = ctx.userAgent
  if (isMissingOrShortUserAgent(ua)) {
    score += 25
  } else if (isHeadlessBrowser(ua)) {
    score += 60
  } else if (isCurlLike(ua)) {
    score += 50
  } else if (isBotUserAgent(ua)) {
    score += 40
  }

  if (score > 100) score = 100
  if (score < 0) score = 0
  return score
}

/**
 * 批量评估:对一组上下文计算分数,返回最高分(用于 IP 维度聚合判断)。
 * 仅做日志记录,不抛错。
 */
export function maxBehaviorScore(contexts: BehaviorContext[]): number {
  let max = 0
  for (const c of contexts) {
    try {
      const s = calculateBehaviorScore(c)
      if (s > max) max = s
    } catch (e) {
      logger.warn('bot-detection: calculateBehaviorScore failed', { err: e })
    }
  }
  return max
}
