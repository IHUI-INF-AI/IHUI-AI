// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 权威榜单聚合服务。
 *
 * 输入只有三家官方公开数据：
 * - LMArena 官方 HuggingFace 数据集 text/latest parquet（Bradley-Terry 人类偏好分）
 * - Artificial Analysis 官方 models 榜单页内嵌 JSON（Intelligence Index）
 * - OpenRouter 官方 rankings-daily CSV（真实 token 用量）
 *
 * 输出是模型家族级对照：同一模型不同档位/构建在各榜分别取最佳名次；
 * 综合位次先按覆盖榜数降序，再按各榜百分位均值降序。这里不做任何自建评测，
 * 也不生成新的能力分。
 */

import { parquetReadObjects } from 'hyparquet'
import { fetch as undiciFetch, ProxyAgent, type RequestInit as UndiciRequestInit } from 'undici'
import type {
  AiWorldAuthoritativeLeaderboard,
  AiWorldLeaderboardAaBenchmark,
  AiWorldLeaderboardAaRow,
  AiWorldLeaderboardCrossRow,
  AiWorldLeaderboardLmCategory,
  AiWorldLeaderboardLmRow,
  AiWorldLeaderboardOrRow,
  AiWorldLeaderboardRefresh,
  AiWorldLeaderboardSource,
} from '@ihui/types'
import { logger } from '../utils/logger.js'

const USER_AGENT = 'IHUI-AI/1.0 Authoritative-Leaderboard'
const LMARENA_PARQUET_URLS = [
  'https://hf-mirror.com/api/datasets/lmarena-ai/leaderboard-dataset/parquet/text/latest/0.parquet',
  'https://huggingface.co/api/datasets/lmarena-ai/leaderboard-dataset/parquet/text/latest/0.parquet',
]
const AA_URL = 'https://artificialanalysis.ai/leaderboards/models'
const OPENROUTER_CSV_URL = 'https://openrouter.ai/api/v1/datasets/exports/rankings-daily/latest.csv'
const OPENROUTER_BOARD_SIZE = 50
export const AUTHORITATIVE_REFRESH_CRON =
  process.env.AUTHORITATIVE_LEADERBOARD_CRON || '17 */6 * * *'
export const AUTHORITATIVE_REFRESH_TIMEZONE = 'Asia/Shanghai'
export const AUTHORITATIVE_LEADERBOARD_SCHEMA_VERSION = 2

/** LMArena 官方分类的展示名；键顺序即页面下拉顺序。 */
const LMARENA_CATEGORY_LABELS: Record<string, string> = {
  overall: '总榜',
  chinese: '中文',
  english: '英文',
  coding: '编程',
  math: '数学',
  creative_writing: '创意写作',
  instruction_following: '指令遵循',
  hard_prompts: '高难题',
  hard_prompts_english: '英文高难题',
  multi_turn: '多轮对话',
  longer_query: '长查询',
  expert: '专家',
  non_english: '非英文',
  russian: '俄语',
  german: '德语',
  spanish: '西班牙语',
  french: '法语',
  korean: '韩语',
  japanese: '日语',
  polish: '波兰语',
  industry_software_and_it_services: '软件与 IT 服务',
  industry_writing_and_literature_and_language: '写作、文学与语言',
  industry_entertainment_and_sports_and_media: '娱乐、体育与媒体',
  industry_life_and_physical_and_social_science: '生命、物理与社会科学',
  industry_business_and_management_and_financial_operations: '商业、管理与金融',
  industry_mathematical: '数学行业',
  industry_legal_and_government: '法律与政府',
  industry_medicine_and_healthcare: '医疗健康',
  exclude_ties: '总榜（不计平局）',
}

/** AA 官方评测项展示名；未列出的键自动从 key 生成可读名。 */
const AA_BENCHMARK_LABELS: Record<string, string> = {
  'aa-briefcase': 'AA Briefcase',
  'aa-analyst-agent': 'AA Analyst Agent',
  'aa-3d': 'AA 3D',
  'apex-agents-aa': 'Apex Agents AA',
  'artificial-analysis-long-context-reasoning': 'AA 长上下文推理',
  'automationbench-aa': 'AutomationBench AA',
  'aime-2025': 'AIME 2025',
  'code2video-aa': 'Code2Video AA',
  critpt: 'CritPT',
  'critpt-v2-hard': 'CritPT v2 Hard',
  'enterprise-ops-gym-aa': 'Enterprise Ops Gym AA',
  'frontiercode': 'FrontierCode',
  'frontiercode-2-0': 'FrontierCode 2.0',
  frontierphysics: 'FrontierPhysics',
  'gdp-pdf': 'GDP-PDF',
  'gdpval-aa-normalized': 'GDPval AA',
  'gpqa-diamond': 'GPQA Diamond',
  'harvey-lab-aa': 'Harvey Lab AA',
  healthbench: 'HealthBench',
  'healthbench-professional': 'HealthBench Professional',
  'hle-diamond': 'HLE Diamond',
  "humanitys-last-exam": "Humanity's Last Exam",
  ifbench: 'IFBench',
  'itbench-aa': 'ITBench AA',
  'livecodebench': 'LiveCodeBench',
  mka: 'MKA',
  'mlcr-aa': 'MLCR AA',
  'mmmu-pro': 'MMMU-Pro',
  'omniscience-accuracy': '通识准确率',
  'omniscience-non-hallucination': '通识不幻觉',
  scicode: 'SciCode',
  'tau2-bench': 'τ²-Bench',
  'tau3-banking': 'τ³-Banking',
  'terminal-bench-science': 'Terminal-Bench Science',
  'terminalbench-2-1': 'Terminal-Bench 2.1',
  'terminalbench-4-0': 'Terminal-Bench 4.0',
  'terminalbench-4-1': 'Terminal-Bench 4.1',
  'terminalbench-hard': 'Terminal-Bench Hard',
  'vials-aa': 'Vials AA',
}

interface LmarenaParquetRow {
  model_name?: string
  model?: string
  organization?: string
  license?: string
  rating?: number
  rating_lower?: number
  rating_upper?: number
  variance?: number
  vote_count?: number
  rank?: number
  category?: string
  leaderboard_publish_date?: string
}

export interface LmarenaEntry {
  model: string
  vendor: string
  score: number
  ci: number
  votes: number
  license: string
  open: boolean
  rank: number
  ciLow: number
  ciHigh: number
  variance: number
  category: string
  date: string
}

export interface LmarenaCategoryData {
  id: string
  label: string
  rows: LmarenaEntry[]
  votes: number
  count: number
}

export interface LmarenaSourceData {
  asOf: string
  overall: LmarenaEntry[]
  chinese: LmarenaEntry[]
  overallVotes: number
  chineseVotes: number
  overallCount: number
  chineseCount: number
  categories: LmarenaCategoryData[]
}

export interface AaRawModel {
  name?: string
  modelCreatorName?: string
  intelligenceIndex?: number | null
  omniscience?: number | null
  isOpenWeights?: boolean
  isReasoning?: boolean
  deprecated?: boolean
  contextWindowTokens?: number | null
  price1mInputTokens?: number | null
  price1mOutputTokens?: number | null
  cacheHitPrice?: number | null
  cacheWritePrice?: number | null
  outputSpeed?: number | null
  timeToFirstToken?: number | null
  timeToFirstAnswerToken?: number | null
  intelligenceIndexCostPerTask?: number | null
  intelligenceIndexTimePerTask?: number | null
  paramClass?: string | null
  priceClass?: string | null
  release?: { slug?: string; name?: string }
  scores?: Record<string, number | null>
}

export interface AaSourceData {
  asOf: string
  models: AaRawModel[]
}

export interface OpenRouterSourceData {
  asOf: string
  startDate: string
  endDate: string
  totalTokens: number
  otherShare: number
  rows: AiWorldLeaderboardOrRow[]
}

export interface AuthoritativeSourceBundle {
  lmarena: LmarenaSourceData
  aa: AaSourceData
  openrouter: OpenRouterSourceData
}

let syncProxyAgent: ProxyAgent | null | undefined
let syncProxyUrl: string | undefined

function resolveSyncProxyUrl(): string {
  const explicit = process.env.SYNC_PROXY_URL?.trim()
  if (explicit) return explicit
  // 生产 API 服务已配置标准 HTTPS_PROXY（本地隧道）；未显式配 SYNC_PROXY_URL 时复用，
  // 避免定时抓取在 Node 侧直连被墙的源站。
  return process.env.HTTPS_PROXY?.trim() || process.env.HTTP_PROXY?.trim() || ''
}

function getProxyDispatcher(url: string): ProxyAgent | null {
  const proxyUrl = resolveSyncProxyUrl()
  if (!proxyUrl) return null
  if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/i.test(url)) return null
  if (syncProxyAgent === undefined || syncProxyUrl !== proxyUrl) {
    syncProxyUrl = proxyUrl
    try {
      syncProxyAgent = new ProxyAgent(proxyUrl)
    } catch (err) {
      logger.warn('[authoritative-leaderboard] SYNC_PROXY_URL 无效，忽略代理', { err })
      syncProxyAgent = null
    }
  }
  return syncProxyAgent
}

async function fetchSource(url: string, timeoutMs: number): Promise<Response> {
  const init: UndiciRequestInit = {
    headers: {
      'user-agent': USER_AGENT,
      accept: '*/*',
    },
    signal: AbortSignal.timeout(timeoutMs),
  }
  const dispatcher = getProxyDispatcher(url)
  if (dispatcher) {
    ;(init as UndiciRequestInit & { dispatcher?: ProxyAgent }).dispatcher = dispatcher
  }
  return undiciFetch(url, init)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < attempts) {
        logger.warn('[authoritative-leaderboard] 抓取失败，准备重试', { err, attempt, label })
        await sleep(1000 * attempt)
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} 抓取失败: ${String(lastError)}`)
}

function todayInShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AUTHORITATIVE_REFRESH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatWan(n: number): string {
  return `${(n / 10000).toFixed(1)}万`
}

function formatTokens(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  return n.toLocaleString('en-US')
}

function vendorKey(name: string | undefined): string {
  const raw = (name ?? '').trim().toLowerCase()
  if (!raw) return 'unknown'
  if (/anthropic|claude/.test(raw)) return 'anthropic'
  if (/openai|gpt/.test(raw)) return 'openai'
  if (/google|gemini/.test(raw)) return 'google'
  if (/meta|llama/.test(raw)) return 'meta'
  if (/moonshot|kimi/.test(raw)) return 'moonshot'
  if (/alibaba|qwen|tongyi/.test(raw)) return 'alibaba'
  if (/deepseek/.test(raw)) return 'deepseek'
  if (/z\.ai|zhipu|glm/.test(raw)) return 'zai'
  if (/tencent|hunyuan|\bhy\d/.test(raw)) return 'tencent'
  if (/baidu|ernie/.test(raw)) return 'baidu'
  if (/xiaomi|mimo/.test(raw)) return 'xiaomi'
  if (/minimax/.test(raw)) return 'minimax'
  if (/nvidia|nemotron/.test(raw)) return 'nvidia'
  if (/stepfun|\bstep[- ]/.test(raw)) return 'stepfun'
  if (/thinking machines|inkling/.test(raw)) return 'thinkingmachines'
  if (/xai|grok/.test(raw)) return 'xai'
  if (/mistral/.test(raw)) return 'mistral'
  if (/microsoft|phi-/.test(raw)) return 'microsoft'
  if (/amazon|nova/.test(raw)) return 'amazon'
  return raw.split(/[\s,/]+/)[0] || 'unknown'
}

function vendorLabel(name: string | undefined): string {
  const key = vendorKey(name)
  const labels: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    meta: 'Meta',
    moonshot: 'Moonshot AI',
    alibaba: 'Alibaba',
    deepseek: 'DeepSeek',
    zai: 'Z.ai',
    tencent: 'Tencent',
    baidu: 'Baidu',
    xiaomi: 'Xiaomi',
    minimax: 'MiniMax',
    nvidia: 'NVIDIA',
    stepfun: 'StepFun',
    thinkingmachines: 'Thinking Machines',
    xai: 'xAI',
    mistral: 'Mistral AI',
    microsoft: 'Microsoft',
    amazon: 'Amazon',
  }
  return labels[key] ?? (name?.trim() || 'Unknown')
}

function isCnVendor(key: string): boolean {
  return [
    'moonshot',
    'alibaba',
    'deepseek',
    'zai',
    'tencent',
    'baidu',
    'xiaomi',
    'minimax',
    'stepfun',
  ].includes(key)
}

function normalizeModel(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d{8}\b/g, ' ')
    .replace(/\b\d{4}\b/g, ' ')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function baseName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/(?:\s|-)+\d{8}\s*$/, '')
    .replace(/(?:\s|-)+\d{4}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function percentile(rank: number, total: number): number {
  if (total <= 1) return 0.5
  return 1 - (rank - 1) / (total - 1)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export function parseLmarenaRows(rawRows: unknown[]): LmarenaSourceData {
  const rows: LmarenaEntry[] = []
  for (const raw of rawRows) {
    const r = raw as LmarenaParquetRow
    const model = (r.model_name || r.model || '').trim()
    const date = String(r.leaderboard_publish_date ?? '').slice(0, 10)
    const category = String(r.category ?? '')
      .trim()
      .toLowerCase()
    const rank = Number(r.rank)
    const score = Number(r.rating)
    const votes = Number(r.vote_count)
    if (!model || !date || !category || !Number.isFinite(rank) || rank <= 0) continue
    if (!Number.isFinite(score) || !Number.isFinite(votes)) continue
    const license = String(r.license ?? 'Unknown')
    const lower = Number(r.rating_lower)
    const upper = Number(r.rating_upper)
    const variance = Number(r.variance)
    const ciLow = Number.isFinite(lower) ? lower : score
    const ciHigh = Number.isFinite(upper) ? upper : score
    const ci = Math.max(0, (ciHigh - ciLow) / 2)
    rows.push({
      model,
      vendor: vendorLabel(r.organization),
      score,
      ci,
      votes,
      license,
      open: license !== 'Proprietary' && license !== 'Unknown',
      rank,
      ciLow,
      ciHigh,
      variance: Number.isFinite(variance) ? variance : 0,
      category,
      date,
    })
  }
  const latestDate = rows.reduce((max, row) => (row.date > max ? row.date : max), '')
  if (!latestDate) throw new Error('LMArena 数据集没有可用的发布日期')

  const grouped = new Map<string, LmarenaEntry[]>()
  for (const row of rows) {
    if (row.date !== latestDate) continue
    const list = grouped.get(row.category) ?? []
    list.push(row)
    grouped.set(row.category, list)
  }
  const categories: LmarenaCategoryData[] = [...grouped.entries()]
    .map(([id, list]) => ({
      id,
      label: LMARENA_CATEGORY_LABELS[id] ?? id.replace(/_/g, ' '),
      rows: list.sort((a, b) => a.rank - b.rank),
      votes: list.reduce((sum, row) => sum + row.votes, 0),
      count: list.length,
    }))
    .sort((a, b) => {
      const order = Object.keys(LMARENA_CATEGORY_LABELS)
      const ai = order.indexOf(a.id)
      const bi = order.indexOf(b.id)
      if (ai >= 0 && bi >= 0) return ai - bi
      if (ai >= 0) return -1
      if (bi >= 0) return 1
      return a.id.localeCompare(b.id)
    })

  const overall = categories.find((c) => c.id === 'overall')?.rows ?? []
  const chinese = categories.find((c) => c.id === 'chinese')?.rows ?? []
  if (overall.length < 100) throw new Error(`LMArena 总榜行数异常: ${overall.length}`)

  return {
    asOf: latestDate,
    overall,
    chinese,
    overallVotes: overall.reduce((sum, row) => sum + row.votes, 0),
    chineseVotes: chinese.reduce((sum, row) => sum + row.votes, 0),
    overallCount: overall.length,
    chineseCount: chinese.length,
    categories,
  }
}

export function parseAaModels(html: string): AaRawModel[] {
  const marker = html.indexOf('initialModels')
  if (marker < 0) throw new Error('AA 页面缺少 initialModels')
  const start = html.indexOf('[', marker)
  if (start < 0) throw new Error('AA initialModels 缺少数组起始')
  const manifest = html.indexOf('\\"manifest\\"', start)
  const end = html.lastIndexOf(']', manifest >= 0 ? manifest : undefined)
  if (end <= start) throw new Error('AA initialModels 缺少数组结束')
  const decoded = html
    .slice(start, end + 1)
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\')
  const parsed = JSON.parse(decoded) as unknown
  if (!Array.isArray(parsed)) throw new Error('AA initialModels 不是数组')
  return parsed as AaRawModel[]
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (ch === ',' && !quoted) {
      values.push(current)
      current = ''
      continue
    }
    current += ch
  }
  values.push(current)
  return values
}

function dateMinusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function prettySlug(value: string): string {
  const special: Record<string, string> = {
    gpt: 'GPT',
    glm: 'GLM',
    ai: 'AI',
    deepseek: 'DeepSeek',
    claude: 'Claude',
    gemini: 'Gemini',
    kimi: 'Kimi',
    qwen: 'Qwen',
    llama: 'Llama',
    mistral: 'Mistral',
    minimax: 'MiniMax',
    mimo: 'MiMo',
    nemotron: 'Nemotron',
    inkling: 'Inkling',
    hy: 'Hy',
    step: 'Step',
    hunyuan: 'Hunyuan',
    flash: 'Flash',
    pro: 'Pro',
    preview: 'Preview',
    ultra: 'Ultra',
    max: 'Max',
  }
  return value
    .split('-')
    .filter(Boolean)
    .map(
      (token) =>
        special[token] ??
        (token.startsWith('v') && /^\d/.test(token.slice(1))
          ? `V${token.slice(1)}`
          : token.charAt(0).toUpperCase() + token.slice(1)),
    )
    .join(' ')
}

function openRouterMeta(
  slug: string,
): { model: string; vendor: string; key: string; build: string | null; free: boolean } | null {
  if (!slug || slug === 'other') return null
  const parts = slug.split('/')
  if (parts.length < 2) return null
  const provider = parts[0] ?? ''
  const rawModel = parts.slice(1).join('/')
  const buildMatch = rawModel.match(/-(\d{8})(?=$|:)/)
  const build = buildMatch?.[1] ?? null
  const clean = rawModel.replace(/-?\d{8}(?=$|:)/, '')
  const model = prettySlug(clean)
  return {
    model,
    vendor: vendorLabel(provider),
    key: normalizeModel(model),
    build,
    free: /(?:^|-)free(?:-|$)/.test(clean),
  }
}

export function parseOpenRouterCsv(csv: string): OpenRouterSourceData {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const header = parseCsvLine(lines[0] ?? '')
  const required = ['date', 'model_permaslug', 'rank', 'total_tokens', 'share_of_daily_tokens']
  for (const field of required) {
    if (!header.includes(field)) throw new Error(`OpenRouter CSV 缺少字段 ${field}`)
  }
  const idx = Object.fromEntries(header.map((name, index) => [name, index])) as Record<
    string,
    number
  >
  const daily: Array<{ date: string; slug: string; tokens: number; share: number }> = []
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line)
    const date = cells[idx.date ?? 0] ?? ''
    const slug = cells[idx.model_permaslug ?? 1] ?? ''
    const tokens = Number(cells[idx.total_tokens ?? 3])
    const share = Number(cells[idx.share_of_daily_tokens ?? 4])
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !slug) continue
    if (!Number.isFinite(tokens) || tokens <= 0) continue
    daily.push({ date, slug, tokens, share: Number.isFinite(share) ? share : 0 })
  }
  if (!daily.length) throw new Error('OpenRouter CSV 没有可用数据')
  const endDate = daily.reduce((max, row) => (row.date > max ? row.date : max), '')
  const startDate = dateMinusDays(endDate, 6)
  const windowRows = daily.filter((row) => row.date >= startDate && row.date <= endDate)
  const totalTokens = windowRows.reduce((sum, row) => sum + row.tokens, 0)
  if (totalTokens <= 0) throw new Error('OpenRouter 近 7 天 tokens 为 0')

  const familyMap = new Map<
    string,
    {
      model: string
      vendor: string
      key: string
      tokens: number
      share: number
      slug: string
      build: string | null
      free: boolean
    }
  >()
  for (const row of windowRows) {
    const meta = openRouterMeta(row.slug)
    if (!meta) continue
    const existing = familyMap.get(meta.key)
    if (!existing || row.tokens > existing.tokens) {
      familyMap.set(meta.key, {
        ...meta,
        tokens: row.tokens,
        share: totalTokens > 0 ? row.tokens / totalTokens : 0,
        slug: row.slug,
      })
    }
  }
  const rows = [...familyMap.values()]
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, OPENROUTER_BOARD_SIZE)
    .map((row, index): AiWorldLeaderboardOrRow => ({
      rank: index + 1,
      model: row.model,
      vendor: row.vendor,
      tokens: row.tokens,
      share: round4(totalTokens > 0 ? row.tokens / totalTokens : 0),
      slug: row.slug,
      build: row.build,
      free: row.free,
    }))
  const otherTokens = windowRows
    .filter((row) => row.slug === 'other')
    .reduce((sum, row) => sum + row.tokens, 0)
  return {
    asOf: endDate,
    startDate,
    endDate,
    totalTokens,
    otherShare: round4(totalTokens > 0 ? otherTokens / totalTokens : 0),
    rows,
  }
}

export async function fetchLmarenaSource(): Promise<LmarenaSourceData> {
  let lastError: unknown
  for (const url of LMARENA_PARQUET_URLS) {
    try {
      return await withRetry('LMArena parquet', async () => {
        const res = await fetchSource(url, 120_000)
        if (!res.ok) throw new Error(`LMArena HTTP ${res.status}`)
        const arrayBuffer = await res.arrayBuffer()
        const rawRows = (await parquetReadObjects({ file: arrayBuffer })) as unknown[]
        if (!rawRows.length) throw new Error('LMArena parquet 为空')
        return parseLmarenaRows(rawRows)
      })
    } catch (err) {
      lastError = err
      logger.warn('[authoritative-leaderboard] LMArena 镜像失败，尝试下一地址', { err, url })
    }
  }
  throw lastError instanceof Error ? lastError : new Error('LMArena 全部地址失败')
}

export async function fetchAaSource(): Promise<AaSourceData> {
  return withRetry('Artificial Analysis', async () => {
    const res = await fetchSource(AA_URL, 60_000)
    if (!res.ok) throw new Error(`AA HTTP ${res.status}`)
    const html = await res.text()
    const models = parseAaModels(html)
    if (models.length < 50) throw new Error(`AA 模型数异常: ${models.length}`)
    return { asOf: todayInShanghai(), models }
  })
}

export async function fetchOpenRouterSource(): Promise<OpenRouterSourceData> {
  return withRetry('OpenRouter CSV', async () => {
    const res = await fetchSource(OPENROUTER_CSV_URL, 60_000)
    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`)
    const csv = await res.text()
    return parseOpenRouterCsv(csv)
  })
}

export async function fetchAuthoritativeSources(): Promise<AuthoritativeSourceBundle> {
  const [lmarena, aa, openrouter] = await Promise.all([
    fetchLmarenaSource(),
    fetchAaSource(),
    fetchOpenRouterSource(),
  ])
  return { lmarena, aa, openrouter }
}

interface AaFamily {
  rank: number
  model: string
  vendor: string
  vendorKey: string
  score: number
  openWeights: boolean
  cn: boolean
  reasoning: boolean
  contextWindow: number | null
  inputPrice: number | null
  outputPrice: number | null
  cacheHitPrice: number | null
  cacheWritePrice: number | null
  outputSpeed: number | null
  ttft: number | null
  ttfa: number | null
  omniscience: number | null
  costPerTask: number | null
  timePerTask: number | null
  paramClass: string | null
  priceClass: string | null
  release: string | null
  benchmarks: AiWorldLeaderboardAaBenchmark[]
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function aaBenchmarkLabel(key: string): string {
  return (
    AA_BENCHMARK_LABELS[key] ??
    key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

function toAaBenchmarks(scores: AaRawModel['scores']): AiWorldLeaderboardAaBenchmark[] {
  if (!scores) return []
  return Object.entries(scores)
    .filter(([, value]) => Number.isFinite(Number(value)))
    .map(([key, value]) => {
      const raw = Number(value)
      // AA 官方单项分大多数是 0-1；AA Briefcase / GDPval / AA-3D 等是 Elo 原始分。
      // 不能把 1623 Elo 也乘 100；只对 0-1 的分数归一到百分比。
      const normalized = raw <= 1 ? raw * 100 : raw
      return {
        key,
        label: aaBenchmarkLabel(key),
        score: round1(normalized),
        unit: raw <= 1 ? ('percent' as const) : ('raw' as const),
      }
    })
    .sort((a, b) => b.score - a.score)
}

function buildAaFamilies(models: AaRawModel[]): AaFamily[] {
  const map = new Map<string, Omit<AaFamily, 'rank'>>()
  for (const raw of models) {
    if (raw.deprecated) continue
    if (raw.intelligenceIndex === null || raw.intelligenceIndex === undefined) continue
    const score = Number(raw.intelligenceIndex)
    if (!Number.isFinite(score)) continue
    const rawName = (raw.name || raw.release?.name || '').trim()
    if (!rawName) continue
    const model = baseName(rawName)
    const key = normalizeModel(model)
    if (!key) continue
    const vKey = vendorKey(raw.modelCreatorName)
    const candidate: Omit<AaFamily, 'rank'> = {
      model,
      vendor: vendorLabel(raw.modelCreatorName),
      vendorKey: vKey,
      score: round1(score),
      openWeights: Boolean(raw.isOpenWeights),
      cn: isCnVendor(vKey),
      reasoning: Boolean(raw.isReasoning),
      contextWindow: finiteOrNull(raw.contextWindowTokens),
      inputPrice: finiteOrNull(raw.price1mInputTokens),
      outputPrice: finiteOrNull(raw.price1mOutputTokens),
      cacheHitPrice: finiteOrNull(raw.cacheHitPrice),
      cacheWritePrice: finiteOrNull(raw.cacheWritePrice),
      outputSpeed: finiteOrNull(raw.outputSpeed),
      ttft: finiteOrNull(raw.timeToFirstToken),
      ttfa: finiteOrNull(raw.timeToFirstAnswerToken),
      omniscience: finiteOrNull(raw.omniscience),
      costPerTask: finiteOrNull(raw.intelligenceIndexCostPerTask),
      timePerTask: finiteOrNull(raw.intelligenceIndexTimePerTask),
      paramClass: raw.paramClass ?? null,
      priceClass: raw.priceClass ?? null,
      release: raw.release?.slug ?? null,
      benchmarks: toAaBenchmarks(raw.scores),
    }
    const existing = map.get(key)
    // 同一模型家族保留智能指数最高的一档，所有附属字段都来自这一档，避免混档。
    if (!existing || candidate.score > existing.score) map.set(key, candidate)
  }
  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

interface LmFamily {
  rank: number
  sourceRank: number
  model: string
  vendor: string
  vendorKey: string
  score: number
  ci: number
  ciLow: number
  ciHigh: number
  variance: number
  votes: number
  license: string
  open: boolean
  cn: boolean
}

function buildLmFamilies(rows: LmarenaEntry[]): {
  families: LmFamily[]
  rows: AiWorldLeaderboardLmRow[]
} {
  const map = new Map<string, Omit<LmFamily, 'rank'>>()
  for (const raw of rows) {
    const model = baseName(raw.model)
    const key = normalizeModel(model)
    if (!key) continue
    const vKey = vendorKey(raw.vendor)
    const candidate: Omit<LmFamily, 'rank'> = {
      sourceRank: raw.rank,
      model,
      vendor: raw.vendor,
      vendorKey: vKey,
      score: round1(raw.score),
      ci: round2(raw.ci),
      ciLow: round1(raw.ciLow),
      ciHigh: round1(raw.ciHigh),
      variance: round1(raw.variance),
      votes: raw.votes,
      license: raw.license,
      open: raw.open,
      cn: isCnVendor(vKey),
    }
    const existing = map.get(key)
    if (!existing || candidate.sourceRank < existing.sourceRank) map.set(key, candidate)
  }
  const sorted = [...map.values()]
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1 }))
  return {
    families: sorted,
    rows: sorted.map((row): AiWorldLeaderboardLmRow => ({
      rank: row.rank,
      model: row.model,
      vendor: row.vendor,
      score: row.score,
      ci: row.ci,
      ciLow: row.ciLow,
      ciHigh: row.ciHigh,
      variance: row.variance,
      votes: row.votes,
      license: row.license,
      open: row.open,
    })),
  }
}

export function buildAuthoritativeLeaderboard(
  bundle: AuthoritativeSourceBundle,
  options: { generatedAt?: string; refresh?: AiWorldLeaderboardRefresh } = {},
): AiWorldAuthoritativeLeaderboard {
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const aaFamilies = buildAaFamilies(bundle.aa.models)
  if (aaFamilies.length < 20) throw new Error(`AA 有效模型不足: ${aaFamilies.length}`)
  const aaList: AiWorldLeaderboardAaRow[] = aaFamilies.map((row, index) => ({
    rank: index + 1,
    model: row.model,
    vendor: row.vendor,
    score: row.score,
    openWeights: row.openWeights,
    cn: row.cn,
    reasoning: row.reasoning,
    contextWindow: row.contextWindow,
    inputPrice: row.inputPrice,
    outputPrice: row.outputPrice,
    cacheHitPrice: row.cacheHitPrice,
    cacheWritePrice: row.cacheWritePrice,
    outputSpeed: row.outputSpeed,
    ttft: row.ttft,
    ttfa: row.ttfa,
    omniscience: row.omniscience,
    costPerTask: row.costPerTask,
    timePerTask: row.timePerTask,
    paramClass: row.paramClass,
    priceClass: row.priceClass,
    release: row.release,
    benchmarks: row.benchmarks,
  }))

  const lmOverall = buildLmFamilies(bundle.lmarena.overall)
  const lmChinese = buildLmFamilies(bundle.lmarena.chinese)
  if (lmOverall.rows.length < 20)
    throw new Error(`LMArena 总榜有效模型不足: ${lmOverall.rows.length}`)

  const lmCategories: AiWorldLeaderboardLmCategory[] = bundle.lmarena.categories.map((cat) => {
    const built = buildLmFamilies(cat.rows)
    return {
      id: cat.id,
      label: cat.label,
      count: cat.count,
      votes: cat.votes,
      rows: built.rows.slice(0, 50),
    }
  })

  const lmByKey = new Map(lmOverall.families.map((row) => [normalizeModel(row.model), row]))
  const aaByKey = new Map(aaFamilies.map((row) => [normalizeModel(row.model), row]))
  const orByKey = new Map(bundle.openrouter.rows.map((row) => [normalizeModel(row.model), row]))

  const candidateKeys = new Set<string>()
  for (const row of aaList) candidateKeys.add(normalizeModel(row.model))
  for (const row of lmOverall.rows.slice(0, 50)) candidateKeys.add(normalizeModel(row.model))
  for (const row of bundle.openrouter.rows) candidateKeys.add(normalizeModel(row.model))

  const cross: AiWorldLeaderboardCrossRow[] = []
  for (const key of candidateKeys) {
    const aa = aaByKey.get(key)
    const lm = lmByKey.get(key)
    const or = orByKey.get(key)
    const coverage = (aa ? 1 : 0) + (lm ? 1 : 0) + (or ? 1 : 0)
    if (coverage < 2) continue
    const anchor = aa ?? lm ?? or
    if (!anchor) continue
    const model = baseName(anchor.model)
    const vKey = aa?.vendorKey ?? lm?.vendorKey ?? vendorKey(or?.vendor)
    cross.push({
      rank: 0,
      key,
      model,
      vendor: aa?.vendor ?? lm?.vendor ?? or?.vendor ?? 'Unknown',
      cn: isCnVendor(vKey),
      openWeights: aa?.openWeights ?? lm?.open ?? false,
      coverage,
      aa: aa ? { rank: aa.rank, score: aa.score } : null,
      lm: lm ? { rank: lm.sourceRank, score: lm.score } : null,
      or: or ? { rank: or.rank, tokens: or.tokens, share: or.share } : null,
    })
  }
  const ranked = [...cross].sort((a, b) => {
    if (b.coverage !== a.coverage) return b.coverage - a.coverage
    const avg = (row: AiWorldLeaderboardCrossRow): number => {
      const vals = [
        row.aa ? percentile(row.aa.rank, aaList.length) : null,
        row.lm ? percentile(row.lm.rank, bundle.lmarena.overallCount) : null,
        row.or ? percentile(row.or.rank, OPENROUTER_BOARD_SIZE) : null,
      ].filter((v): v is number => v !== null && v !== undefined)
      return vals.reduce((sum, v) => sum + v, 0) / vals.length
    }
    return avg(b) - avg(a)
  })
  ranked.forEach((row, index) => {
    row.rank = index + 1
  })

  const orRows = bundle.openrouter.rows.slice(0, OPENROUTER_BOARD_SIZE)
  const sources: AiWorldLeaderboardSource[] = [
    {
      id: 'aa',
      name: 'Artificial Analysis',
      metric: 'Intelligence Index v5.0.2',
      url: AA_URL,
      asOf: bundle.aa.asOf,
      boardSize: aaList.length,
      note: `读取官方榜单页面内嵌数据；同一模型家族取最高档位，去重后 ${aaList.length} 个模型。指数由 AA-Briefcase、Terminal-Bench 4.1、FrontierCode-AA 2.0、HLE-Diamond 等多项评测合成。页面详情同时展示上下文、输入/输出价格、缓存价、输出速度、TTFT、单任务成本与全部单项分；AA 公开数据只提供 small/medium/large 参数档位，没有逐模型精确参数量，本站不编造。`,
    },
    {
      id: 'lmarena',
      name: 'LMArena',
      metric: 'Text Arena Score (Elo)',
      url: 'https://arena.ai/leaderboard/text',
      dataset: 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset',
      asOf: bundle.lmarena.asOf,
      boardSize: bundle.lmarena.overallCount,
      note: `官方 HuggingFace 数据集 text/latest，发布日期 ${bundle.lmarena.asOf}。已接入全部 ${bundle.lmarena.categories.length} 个分类榜：总榜 ${bundle.lmarena.overallCount} 个模型、${formatWan(bundle.lmarena.overallVotes)}票；中文榜 ${bundle.lmarena.chineseCount} 个模型、${formatWan(bundle.lmarena.chineseVotes)}票；每个分类页展示前 50 名并保留全量模型数/票数。Arena Score 为盲测人类偏好分，不是正确率。`,
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      metric: '周 tokens',
      url: 'https://openrouter.ai/rankings',
      dataset: OPENROUTER_CSV_URL,
      asOf: bundle.openrouter.asOf,
      boardSize: OPENROUTER_BOARD_SIZE,
      note: `官方公开日榜 CSV，${bundle.openrouter.startDate} 至 ${bundle.openrouter.endDate} 七天累计，共 ${formatTokens(bundle.openrouter.totalTokens)} tokens；仅覆盖平台前 50 名，other 占 ${(bundle.openrouter.otherShare * 100).toFixed(1)}%。用量不等于能力。数据 CC BY 4.0，署名 OpenRouter。`,
    },
  ]

  return {
    schemaVersion: AUTHORITATIVE_LEADERBOARD_SCHEMA_VERSION,
    generatedAt,
    title: '全球模型权威榜',
    subtitle: 'LMArena · Artificial Analysis · OpenRouter 三榜聚合，不做自建评测',
    sources,
    methodology:
      '综合位次先按覆盖榜单数（3/3 优先于 2/3），再按各榜百分位均值降序；百分位 = 1 - (名次-1)/(该榜模型数-1)。只展示覆盖至少两个榜单的模型。同名模型不同档位/构建在各榜分别取最佳名次，因此是模型家族级对照，不是同配置横评。AA 详情里的单项评测来自官方原始分，归一到 0-100；LMArena 按官方 29 个分类分榜展示，每榜页显示前 50 名；OpenRouter 日榜只有日期、模型、名次、tokens、占比五列，没有价格和上下文，不能凭空补。',
    cross: ranked,
    aa: aaList,
    lmarena: {
      overall: lmOverall.rows.slice(0, 100),
      chinese: lmChinese.rows.slice(0, 50),
      overallVotes: bundle.lmarena.overallVotes,
      chineseVotes: bundle.lmarena.chineseVotes,
      overallCount: bundle.lmarena.overallCount,
      chineseCount: bundle.lmarena.chineseCount,
      categories: lmCategories,
    },
    openrouter: orRows,
    refresh: options.refresh ?? {
      mode: 'auto',
      schedule: AUTHORITATIVE_REFRESH_CRON,
      timezone: AUTHORITATIVE_REFRESH_TIMEZONE,
      lastSuccessAt: generatedAt,
      stale: false,
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
