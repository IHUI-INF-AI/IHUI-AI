// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
/* 客户端族归一(观测面)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 族表只新增、不动上面三张原表:上面三表同时喂 `calculateBehaviorScore` 与风控拦截,
 * 改它们的取值 = 改拦截语义(2026-09-24 首方误判成爬虫的事故就出在词表上)。
 * 本区只做"自称是什么"的归类,不产出分数、不参与放行。
 */
const FIRST_PARTY_KEYWORDS = ['ihui-', 'ihuiai-'] as const

const WEBHOOK_KEYWORDS = [
  'github-hookshot',
  'gitee-webhook',
  'gitlab-webhook',
  '-webhook',
  'webhook/',
] as const

const MONITOR_KEYWORDS = [
  'uptimerobot',
  'pingdom',
  'monitis',
  'statuspal',
  'uptime-kuma',
  'site24x7',
  'solarwinds',
  'newrelicpinger',
  'blackbox-exporter',
] as const

/** AI 编程工具与自主 agent —— 机主要问的"有没有 AI 来访问"主要落这一族。 */
const AI_TOOL_KEYWORDS = [
  'qoder',
  'traecn',
  'trae-cn',
  'workbuddy',
  'cursor',
  'windsurf',
  'copilot',
  'claude-code',
  'claude-cli',
  'codex-cli',
  'aider',
  'openclaw',
  'agentwebmap',
  'langchain',
  'autogen',
  'browser-use',
  'gemini-cli',
  'opencode',
  'cline',
  'swe-agent',
] as const

/** AI 厂商的抓取/引用客户端。'claude' 会同时命中 claude-code,靠判定次序排在 AI_TOOL 之后。 */
const AI_CRAWLER_KEYWORDS = [
  'gptbot',
  'chatgpt',
  'oai-searchbot',
  'claude',
  'anthropic-ai',
  'perplexitybot',
  'perplexity-user',
  'grokbot',
  'moonshotbot',
  'duckassistbot',
  'meta-externalagent',
  'meta-externalindexer',
  'google-extended',
  'googleother',
  'google-other',
  'applebot-extended',
  'cohere-training',
  'imagesift',
  'tencentyuxiang',
  'seekport',
] as const

const CLI_KEYWORDS = [
  'curl',
  'wget',
  'httpie',
  'powershell',
  'invoke-webrequest',
  'invoke-restmethod',
  'postman',
  'insomnia',
  'apifox',
  'swagger-codegen',
  'vegeta',
  'wrk',
] as const

/** 原表 CURL_LIKE_KEYWORDS 之外的库型客户端;裸 'node' 是 undici 默认不发 UA 时部分运行时的实形态。 */
const SDK_KEYWORDS = ['undici', 'node', 'reqwest', 'hyper', 'superagent', 'got/', 'fetch/'] as const

const BROWSER_PLATFORM_KEYWORDS = [
  'windows nt',
  'macintosh',
  'x11; linux',
  'android',
  'iphone',
  'ipad',
] as const

const BROWSER_ENGINE_KEYWORDS = [
  'chrome',
  'safari',
  'firefox',
  'edg',
  'opr',
  'samsungbrowser',
] as const

/**
 * 客户端族封闭枚举。UA 原文不得进指标标签(基数无界),只能按族折叠;
 * 数组次序即判定优先级 —— 首方与 AI 工具必须排在通用浏览器形态之前,
 * 否则 `QoderCN/0.4.8 Chrome/150` 这类会被读成真人浏览器。
 */
export const CLIENT_FAMILIES = [
  'first-party',
  'webhook',
  'monitor',
  'agent-tool',
  'ai-crawler',
  'headless',
  'search-crawler',
  'cli',
  'sdk',
  'human-browser',
  'no-ua',
  'unknown',
] as const

export type ClientFamily = (typeof CLIENT_FAMILIES)[number]

/**
 * 视为「真人」的族:首方自有端 + 人浏览器形态。**这是全仓唯一一份真人口径**
 * —— 大屏"真人 PV / 机器人 PV"两格(`routes/admin-ops-wallboard.ts`)、指标族折叠
 * (`services/traffic-stats-service.ts`)与 Grafana 的 `client_family=~"human-browser|first-party"`
 * 三处必须同一把尺子,任何一处自己另写 `new Set([...])` 就是第二份判据(§0.6)。
 * 注意:这是**形态判定**的上界,不辨真伪 —— 伪装成浏览器的脚本仍计入真人侧。
 */
export const HUMAN_CLIENT_FAMILIES: ReadonlySet<ClientFamily> = new Set<ClientFamily>([
  'first-party',
  'human-browser',
])

/** UA 是否形如真实浏览器(Mozilla/5.0 + 平台 + 引擎三者齐备)。只看形态,不验真。 */
function isBrowserShape(ua: string): boolean {
  if (!ua.startsWith('Mozilla/5.0')) return false
  return (
    timingSafeContainsAny(ua, BROWSER_PLATFORM_KEYWORDS) &&
    timingSafeContainsAny(ua, BROWSER_ENGINE_KEYWORDS)
  )
}

/* -------------------------------------------------------------------------- */
/* 探测形态归一(观测面)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 恶意路径形态封闭枚举。2026-10-23 从 api_logs 现读的探测载荷里取,不自创档位。
 * 只收"无论本司有没有实现该路由都属恶意形态"的五档:
 * `graphql-probe`、`llms-txt-probe` 这类**取决于本站是否实现**的一律不收 ——
 * 今天 api 无 graphql 路由所以它是探测,明天接了 GraphQL 它就变成正常流量,
 * 判据会随功能演进而静默失真(§12f:判据的失效方向必须是"多要一次说明",不是"多放一次")。
 */
export const SCAN_PROBE_KINDS = [
  'dotenv-probe',
  'path-traversal',
  'proc-self-read',
  'get-log-file-abuse',
  'admin-console-probe',
] as const

export type ScanProbeKind = (typeof SCAN_PROBE_KINDS)[number]

/** 判定次序即优先级:先具体后泛化。实测载荷同时命中三档,必须给出唯一确定答案。 */
const SCAN_PROBE_PATTERNS: ReadonlyArray<readonly [ScanProbeKind, readonly string[]]> = [
  ['proc-self-read', ['proc/self/', 'proc/self/environ']],
  ['path-traversal', ['../', '..;/', '%2e%2e/', '%2e%2e%2f']],
  ['get-log-file-abuse', ['get_log_file', 'get-log-file']],
  ['dotenv-probe', ['.env']],
  [
    'admin-console-probe',
    ['console/api_server', 'manager/html', 'phpmyadmin', 'wp-login', 'admin/oauth'],
  ],
]

/**
 * 把请求路径归一成探测形态;非探测返回 null。
 * 走同一套常量时间比较:命中与否一旦参与拦截(anti-automation 已吃这张表),
 * 计时差异就成了攻击者"试探我的规则集"的 oracle,这里不留。
 */
export function classifyScanProbe(path: string | null | undefined): ScanProbeKind | null {
  if (!path || path.length === 0) return null
  for (const [kind, needles] of SCAN_PROBE_PATTERNS) {
    if (timingSafeContainsAny(path, needles)) return kind
  }
  return null
}

/**
 * 把 UA 归一成有界客户端族。
 *
 * 各表都跑完再按优先级选,不在单次匹配里提前返回 —— 沿用本文件的常量时间纪律,
 * 让"命中哪一族"不从计时上可被反推。
 * 注意:这是**自述**分类。扫描器会伪装成 Googlebot/GitHub-Hookshot(2026-10-23 实测
 * 腾讯云海外段成批用 AI 爬虫 UA 打 path-traversal),族面按 UA 如实记自述,
 * 真伪由路径命中那一族去判,不在这里混。
 */
export function classifyClientFamily(ua: string | null | undefined): ClientFamily {
  if (!ua || ua.length === 0) return 'no-ua'

  const hitFirstParty = timingSafeContainsAny(ua, FIRST_PARTY_KEYWORDS)
  const hitWebhook = timingSafeContainsAny(ua, WEBHOOK_KEYWORDS)
  const hitMonitor = timingSafeContainsAny(ua, MONITOR_KEYWORDS)
  const hitAiTool = timingSafeContainsAny(ua, AI_TOOL_KEYWORDS)
  const hitAiCrawler = timingSafeContainsAny(ua, AI_CRAWLER_KEYWORDS)
  const hitHeadless = isHeadlessBrowser(ua)
  const hitSearchCrawler = isBotUserAgent(ua)
  const hitCli = timingSafeContainsAny(ua, CLI_KEYWORDS)
  const hitSdk = isCurlLike(ua) || timingSafeContainsAny(ua, SDK_KEYWORDS)
  const hitBrowser = isBrowserShape(ua)

  if (hitFirstParty) return 'first-party'
  if (hitWebhook) return 'webhook'
  if (hitMonitor) return 'monitor'
  if (hitAiTool) return 'agent-tool'
  if (hitAiCrawler) return 'ai-crawler'
  if (hitHeadless) return 'headless'
  if (hitSearchCrawler) return 'search-crawler'
  if (hitCli) return 'cli'
  if (hitSdk) return 'sdk'
  if (hitBrowser) return 'human-browser'
  return 'unknown'
}

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
      if (cv < 0.05)
        score += 45 // 极规律,几乎确定是脚本
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
