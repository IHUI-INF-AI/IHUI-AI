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
  AiWorldLeaderboardAaRow,
  AiWorldLeaderboardCrossRow,
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

interface LmarenaParquetRow {
  model_name?: string
  model?: string
  organization?: string
  license?: string
  rating?: number
  rating_lower?: number
  rating_upper?: number
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
}

export interface LmarenaSourceData {
  asOf: string
  overall: LmarenaEntry[]
  chinese: LmarenaEntry[]
  overallVotes: number
  chineseVotes: number
  overallCount: number
  chineseCount: number
}

export interface AaRawModel {
  name?: string
  modelCreatorName?: string
  intelligenceIndex?: number | null
  isOpenWeights?: boolean
  deprecated?: boolean
  release?: { slug?: string; name?: string }
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
  const rows: Array<LmarenaEntry & { category: string; date: string }> = []
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
    if (!model || !date || !Number.isFinite(rank) || rank <= 0) continue
    if (category !== 'overall' && category !== 'chinese') continue
    if (!Number.isFinite(score) || !Number.isFinite(votes)) continue
    const license = String(r.license ?? 'Unknown')
    const upper = Number(r.rating_upper)
    const ci = Number.isFinite(upper) ? Math.max(0, upper - score) : 0
    rows.push({
      model,
      vendor: vendorLabel(r.organization),
      score,
      ci,
      votes,
      license,
      open: license !== 'Proprietary' && license !== 'Unknown',
      category,
      date,
      rank,
    })
  }
  const latestDate = rows.reduce((max, row) => (row.date > max ? row.date : max), '')
  if (!latestDate) throw new Error('LMArena 数据集没有可用的发布日期')

  const overall = rows
    .filter((row) => row.date === latestDate && row.category === 'overall')
    .sort((a, b) => a.rank - b.rank)
  const chinese = rows
    .filter((row) => row.date === latestDate && row.category === 'chinese')
    .sort((a, b) => a.rank - b.rank)
  if (overall.length < 100) throw new Error(`LMArena 总榜行数异常: ${overall.length}`)

  return {
    asOf: latestDate,
    overall,
    chinese,
    overallVotes: overall.reduce((sum, row) => sum + row.votes, 0),
    chineseVotes: chinese.reduce((sum, row) => sum + row.votes, 0),
    overallCount: overall.length,
    chineseCount: chinese.length,
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
}

interface LmFamily {
  rank: number
  sourceRank: number
  model: string
  vendor: string
  vendorKey: string
  score: number
  ci: number
  votes: number
  license: string
  open: boolean
  cn: boolean
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
    }
    const existing = map.get(key)
    if (!existing || candidate.score > existing.score) map.set(key, candidate)
  }
  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1 }))
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
  }))

  const lmOverall = buildLmFamilies(bundle.lmarena.overall)
  const lmChinese = buildLmFamilies(bundle.lmarena.chinese)
  if (lmOverall.rows.length < 20)
    throw new Error(`LMArena 总榜有效模型不足: ${lmOverall.rows.length}`)

  const lmByKey = new Map(lmOverall.families.map((row) => [normalizeModel(row.model), row]))
  const aaByKey = new Map(aaFamilies.map((row) => [normalizeModel(row.model), row]))
  const orByKey = new Map(bundle.openrouter.rows.map((row) => [normalizeModel(row.model), row]))

  const candidateKeys = new Set<string>()
  for (const row of aaList.slice(0, 30)) candidateKeys.add(normalizeModel(row.model))
  for (const row of lmOverall.rows.slice(0, 30)) candidateKeys.add(normalizeModel(row.model))
  for (const row of bundle.openrouter.rows.slice(0, 30))
    candidateKeys.add(normalizeModel(row.model))

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

  const orRows = bundle.openrouter.rows.slice(0, 15)
  const sources: AiWorldLeaderboardSource[] = [
    {
      id: 'aa',
      name: 'Artificial Analysis',
      metric: 'Intelligence Index v5.0.2',
      url: AA_URL,
      asOf: bundle.aa.asOf,
      boardSize: aaList.length,
      note: `读取官方榜单页面内嵌数据；同一模型家族取最高档位，去重后 ${aaList.length} 个模型。指数由 AA-Briefcase、Terminal-Bench 4.1、FrontierCode-AA 2.0、HLE-Diamond 等多项评测合成。`,
    },
    {
      id: 'lmarena',
      name: 'LMArena',
      metric: 'Text Arena Score (Elo)',
      url: 'https://arena.ai/leaderboard/text',
      dataset: 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset',
      asOf: bundle.lmarena.asOf,
      boardSize: bundle.lmarena.overallCount,
      note: `官方 HuggingFace 数据集 text/latest，发布日期 ${bundle.lmarena.asOf}。总榜 ${bundle.lmarena.overallCount} 个模型、${formatWan(bundle.lmarena.overallVotes)}票；中文榜 ${bundle.lmarena.chineseCount} 个模型、${formatWan(bundle.lmarena.chineseVotes)}票。Arena Score 为盲测人类偏好分，不是正确率。`,
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
    schemaVersion: 1,
    generatedAt,
    title: '全球模型权威榜',
    subtitle: 'LMArena · Artificial Analysis · OpenRouter 三榜聚合，不做自建评测',
    sources,
    methodology:
      '综合位次先按覆盖榜单数（3/3 优先于 2/3），再按各榜百分位均值降序；百分位 = 1 - (名次-1)/(该榜模型数-1)。只展示覆盖至少两个榜单的模型。同名模型不同档位/构建在各榜分别取最佳名次，因此是模型家族级对照，不是同配置横评。',
    cross: ranked.slice(0, 20),
    aa: aaList.slice(0, 20),
    lmarena: {
      overall: lmOverall.rows.slice(0, 20),
      chinese: lmChinese.rows.slice(0, 15),
      overallVotes: bundle.lmarena.overallVotes,
      chineseVotes: bundle.lmarena.chineseVotes,
      overallCount: bundle.lmarena.overallCount,
      chineseCount: bundle.lmarena.chineseCount,
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
