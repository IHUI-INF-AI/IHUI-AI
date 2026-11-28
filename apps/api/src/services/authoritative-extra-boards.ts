// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 新增权威榜单抓取器：HELM、OpenCompass、SuperCLUE、LiveBench、SWE-bench、Epoch ECI。
 *
 * 原则：只从官方页面/官方 JSON/官方 CSV/XLSX 取数，不补不存在的字段，不猜测。
 * 每个平台都保留自己的量纲（HELM 0-1 均分、OpenCompass 0-100、SuperCLUE 0-100、
 * LiveBench 0-100、SWE-bench % resolved、Epoch ECI 抽象分），不做跨榜分数拼接。
 */

import { readFileSync } from 'node:fs'
import { load as loadDom } from 'cheerio'
import * as XLSX from '@e965/xlsx'
import type { AiWorldLeaderboardBoard, AiWorldLeaderboardBoardRow } from '@ihui/types'
import { fetchSource } from './authoritative-leaderboard.js'
import { logger } from '../utils/logger.js'

const HELM_PROJECT_URL = 'https://crfm.stanford.edu/helm/project_metadata.json'
const HELM_DATA_BASE =
  'https://storage.googleapis.com/crfm-helm-public/capabilities/benchmark_output'
const HELM_PAGE_URL = 'https://crfm.stanford.edu/helm/capabilities/latest/'
const SUPERCLUE_PAGE_URL = 'https://www.superclueai.com/generalpage'
const SUPERCLUE_DATA_BASE = 'https://www.superclueai.com/data/generalboard'
const LIVEBENCH_PAGE_URL = 'https://livebench.ai/'
const SWEBENCH_PAGE_URL = 'https://www.swebench.com/'
const EPOCH_ECI_URL = 'https://epoch.ai/data/eci_scores.csv'
const EPOCH_MODELS_URL = 'https://epoch.ai/data/benchmarked_models.csv'

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(/[%,$]/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function text(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function round(value: number, digits = 1): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function formatParams(value: unknown): string | null {
  const raw = text(value)
  if (!raw) return null
  const n = num(raw)
  if (n === null || n <= 0) return raw
  if (n >= 1e12) return `${round(n / 1e12, 2)}T`
  if (n >= 1e9) return `${round(n / 1e9, 1)}B`
  if (n >= 1e6) return `${round(n / 1e6, 1)}M`
  return String(Math.round(n))
}

function excelDate(value: unknown): string | null {
  const raw = text(value)
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const serial = num(raw)
  if (serial !== null && serial > 20000 && serial < 80000) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000
    return new Date(ms).toISOString().slice(0, 10)
  }
  return raw
}

function tagValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'boolean') return value
  const raw = text(value)
  if (!raw || raw === '-' || raw === '—' || raw === 'N/A') return null
  const n = num(raw)
  return n === null ? raw : n
}

async function fetchText(url: string, timeoutMs = 60_000): Promise<string> {
  const res = await fetchSource(url, timeoutMs)
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`)
  return res.text()
}

async function fetchJson<T>(url: string, timeoutMs = 60_000): Promise<T> {
  return JSON.parse(await fetchText(url, timeoutMs)) as T
}

function makeBoard(
  input: Omit<AiWorldLeaderboardBoard, 'boardSize'> & { rows: AiWorldLeaderboardBoardRow[] },
): AiWorldLeaderboardBoard {
  return { ...input, boardSize: input.rows.length }
}

function sortByScore(
  rows: AiWorldLeaderboardBoardRow[],
  key: string,
): AiWorldLeaderboardBoardRow[] {
  return rows
    .sort((a, b) => {
      const av = num(a.values[key])
      const bv = num(b.values[key])
      return (bv ?? -Infinity) - (av ?? -Infinity)
    })
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

/* ------------------------------------------------------------------ HELM */

interface HelmHeader {
  value: string
  description?: string
  metadata?: Record<string, unknown>
}

interface HelmGroup {
  title: string
  header: HelmHeader[]
  rows: Array<Array<{ value?: unknown; description?: string; markdown?: boolean }>>
}

interface HelmSchemaModel {
  name?: string
  display_name?: string
  short_display_name?: string
  creator_organization?: string
  release_date?: string
  num_parameters?: number | string
  access?: string
}

interface HelmProject {
  id: string
  releases: string[]
}

export async function fetchHelmBoard(): Promise<AiWorldLeaderboardBoard> {
  const projects = await fetchJson<HelmProject[]>(HELM_PROJECT_URL)
  const project = projects.find((item) => item.id === 'capabilities')
  const release = project?.releases?.[0]
  if (!release) throw new Error('HELM 没有 capabilities 发布版本')
  const base = `${HELM_DATA_BASE}/releases/${release}`
  const [summary, schema, groups] = await Promise.all([
    fetchJson<{ release: string; date: string }>(`${base}/summary.json`),
    fetchJson<{ models?: HelmSchemaModel[] }>(`${base}/schema.json`),
    fetchJson<HelmGroup[]>(`${base}/groups/core_scenarios.json`),
  ])
  const accuracy = groups.find((group) => group.title === 'Accuracy')
  const efficiency = groups.find((group) => group.title === 'Efficiency')
  const general = groups.find((group) => group.title === 'General information')
  if (!accuracy || !accuracy.rows.length) throw new Error('HELM Accuracy 表为空')

  const modelMeta = new Map<string, HelmSchemaModel>()
  for (const model of schema.models ?? []) {
    for (const key of [model.display_name, model.short_display_name, model.name]) {
      if (key) modelMeta.set(text(key), model)
    }
  }
  const effMap = new Map<string, number | null>()
  if (efficiency) {
    for (const row of efficiency.rows) {
      const name = text(row[0]?.value)
      const mean = num(row[1]?.value)
      if (name) effMap.set(name, mean)
    }
  }
  const generalMap = new Map<string, Record<string, number | null>>()
  if (general) {
    const headers = general.header.map((h) => text(h.value))
    for (const row of general.rows) {
      const name = text(row[0]?.value)
      if (!name) continue
      const v: Record<string, number | null> = {}
      for (let i = 0; i < headers.length; i += 1) {
        const head = headers[i] ?? ''
        if (head.includes('MMLU-Pro') && head.includes('# eval')) v.evalCount = num(row[i]?.value)
        if (head.includes('MMLU-Pro') && head.includes('# prompt tokens'))
          v.promptTokens = num(row[i]?.value)
        if (head.includes('MMLU-Pro') && head.includes('# output tokens'))
          v.outputTokens = num(row[i]?.value)
      }
      generalMap.set(name, v)
    }
  }

  const rows: AiWorldLeaderboardBoardRow[] = []
  for (const row of accuracy.rows) {
    const name = text(row[0]?.value)
    const mean = num(row[1]?.value)
    if (!name || mean === null) continue
    const meta = modelMeta.get(name)
    const values: Record<string, string | number | boolean | null> = {
      mean: round(mean * 100, 1),
      mmluPro: tagValue(row[2]?.value),
      gpqa: tagValue(row[3]?.value),
      ifeval: tagValue(row[4]?.value),
      wildbench: tagValue(row[5]?.value),
      omniMath: tagValue(row[6]?.value),
      inferenceSeconds: effMap.get(name) ?? null,
      evalCount: generalMap.get(name)?.evalCount ?? null,
      promptTokens: generalMap.get(name)?.promptTokens ?? null,
      outputTokens: generalMap.get(name)?.outputTokens ?? null,
      releaseDate: meta?.release_date ?? null,
      params: formatParams(meta?.num_parameters),
      access: text(meta?.access) || null,
      organization: text(meta?.creator_organization) || null,
    }
    for (const key of ['mmluPro', 'gpqa', 'ifeval', 'wildbench', 'omniMath']) {
      const v = num(values[key])
      if (v !== null) values[key] = round(v * 100, 1)
    }
    const params = (values.params as string | null) ?? null
    rows.push({
      rank: 0,
      model: name,
      vendor: text(meta?.creator_organization) || 'HELM',
      openWeights: meta?.access === 'open' ? true : meta?.access === 'limited' ? false : null,
      params,
      values,
      score: round(mean * 100, 1),
    })
  }
  if (!rows.length) throw new Error('HELM 解析后没有模型行')
  return makeBoard({
    id: 'helm',
    sourceId: 'helm',
    name: 'Stanford HELM',
    shortName: 'HELM',
    metric: 'HELM Capabilities Mean score',
    description:
      'Stanford CRFM 的 HELM Capabilities 榜，覆盖 MMLU-Pro、GPQA、IFEval、WildBench、Omni-MATH 五个场景，官方 0-1 均分与耗时、token 规模。',
    url: HELM_PAGE_URL,
    dataset: `${HELM_DATA_BASE}/releases/${release}/groups/core_scenarios.json`,
    asOf: summary.date,
    live: true,
    note: `官方 release ${release}；${rows.length} 个模型，不是只截前 10。表中分数已从 0-1 乘 100 展示，仍保留 HELM 原始口径；Efficiency 为五场景平均推理耗时；参数量/可得性来自官方 schema，未公开的留空。`,
    columns: [
      { key: 'mean', label: 'Mean score', kind: 'score' },
      { key: 'mmluPro', label: 'MMLU-Pro', kind: 'score' },
      { key: 'gpqa', label: 'GPQA', kind: 'score' },
      { key: 'ifeval', label: 'IFEval', kind: 'score' },
      { key: 'wildbench', label: 'WildBench', kind: 'score' },
      { key: 'omniMath', label: 'Omni-MATH', kind: 'score' },
      { key: 'inferenceSeconds', label: '平均耗时', kind: 'seconds' },
      { key: 'evalCount', label: 'MMLU-Pro 题数', kind: 'int' },
      { key: 'promptTokens', label: 'MMLU-Pro 输入 tok', kind: 'tokens' },
      { key: 'outputTokens', label: 'MMLU-Pro 输出 tok', kind: 'tokens' },
      { key: 'params', label: '参数量', kind: 'text' },
      { key: 'access', label: '可得性', kind: 'text' },
      { key: 'releaseDate', label: '模型发布', kind: 'date' },
    ],
    rows: sortByScore(rows, 'mean'),
  })
}

/* ------------------------------------------------------------ OpenCompass */

interface OpenCompassSnapshot {
  board: AiWorldLeaderboardBoard
}

export async function fetchOpenCompassBoard(): Promise<AiWorldLeaderboardBoard> {
  // 官方榜单页是 SPA，公开接口只返回前 10 名；页面快照保留官方可见的全量 27 行，
  // 并明确标注 live=false，不伪装成实时接口。
  const raw = readFileSync(new URL('../data/opencompass-snapshot.json', import.meta.url), 'utf8')
  const parsed = JSON.parse(raw) as OpenCompassSnapshot | AiWorldLeaderboardBoard
  const board = 'board' in parsed ? parsed.board : parsed
  if (!Array.isArray(board.rows) || board.rows.length < 10) {
    throw new Error('OpenCompass 快照数据不完整')
  }
  return { ...board, boardSize: board.rows.length, live: false }
}

/* -------------------------------------------------------------- SuperCLUE */

interface SuperClueRow {
  [key: string]: unknown
}

function firstAvailableMonth(js: string): string | null {
  const match = js.match(/availableDates:\[(.*?)\]/s)
  if (!match) return null
  const months = [...(match[1] ?? '').matchAll(/"([^"]+)"/g)]
    .map((m) => m[1])
    .filter(Boolean) as string[]
  return months[0] ?? null
}

export async function fetchSuperclueBoard(): Promise<AiWorldLeaderboardBoard> {
  const page = await fetchText(SUPERCLUE_PAGE_URL)
  const scriptUrl = page.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1]
  let month: string | null = null
  if (scriptUrl) {
    const js = await fetchText(`https://www.superclueai.com${scriptUrl}`)
    month = firstAvailableMonth(js)
  }
  month = month || '2026年11月'
  const url = `${SUPERCLUE_DATA_BASE}/${encodeURIComponent(month)}.xlsx`
  const res = await fetchSource(url, 60_000)
  if (!res.ok) throw new Error(`SuperCLUE ${url} HTTP ${res.status}`)
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0] ?? '']
  if (!sheet) throw new Error('SuperCLUE Excel 没有工作表')
  const rawRows = XLSX.utils.sheet_to_json<SuperClueRow>(sheet, { defval: '' })
  const rows: AiWorldLeaderboardBoardRow[] = []
  for (const raw of rawRows) {
    const name = text(raw['模型名称'] ?? raw['模型'] ?? raw.model)
    if (!name) continue
    const total = num(raw['总分'])
    if (total === null) continue
    const values: Record<string, string | number | boolean | null> = {
      total: round(total, 2),
      agenticCoding: num(raw['智能体编程']),
      mathReasoning: num(raw['数理推理']),
      hallucination: num(raw['幻觉控制']),
      instructionFollowing: num(raw['精确指令遵循']),
      longContext: num(raw['超长上下文']),
      params: formatParams(raw['总参数量']),
      activeParams: formatParams(raw['激活参数']),
      license: text(raw['开/闭源']) || null,
    }
    rows.push({
      rank: 0,
      model: name,
      vendor: text(raw['机构']) || 'SuperCLUE',
      openWeights: values.license === '开源' ? true : values.license === '闭源' ? false : null,
      params: (values.params as string | null) ?? null,
      score: round(total, 2),
      values,
    })
  }
  if (!rows.length) throw new Error('SuperCLUE 解析后没有模型行')
  const asOf = month.replace(/年/, '-').replace(/月/, '').padStart(7, '0')
  return makeBoard({
    id: 'superclue',
    sourceId: 'superclue',
    name: 'SuperCLUE',
    shortName: 'SuperCLUE',
    metric: '中文通用大模型总分',
    description:
      '中文大模型测评基准 SuperCLUE 通用榜，官方 Excel 全量行，含智能体编程、数理推理、幻觉控制、精确指令遵循、超长上下文与总/激活参数量。',
    url: SUPERCLUE_PAGE_URL,
    dataset: url,
    asOf,
    live: true,
    note: `官方 ${month} 通用榜 Excel；${rows.length} 个模型。总参数量/激活参数按官方原值展示，开源/闭源按官方列。分数为 SuperCLUE 总分，不是 MMLU 正确率。`,
    columns: [
      { key: 'total', label: '总分', kind: 'score' },
      { key: 'agenticCoding', label: '智能体编程', kind: 'score' },
      { key: 'mathReasoning', label: '数理推理', kind: 'score' },
      { key: 'hallucination', label: '幻觉控制', kind: 'score' },
      { key: 'instructionFollowing', label: '指令遵循', kind: 'score' },
      { key: 'longContext', label: '长上下文', kind: 'score' },
      { key: 'params', label: '总参数', kind: 'text' },
      { key: 'activeParams', label: '激活参数', kind: 'text' },
      { key: 'license', label: '开/闭源', kind: 'text' },
    ],
    rows: sortByScore(rows, 'total'),
  })
}

/* ---------------------------------------------------------------- LiveBench */

interface LiveBenchMeta {
  displayName?: string
  organization?: string
  openweight?: boolean
}

function parseLiveBenchMeta(js: string): Map<string, LiveBenchMeta> {
  const map = new Map<string, LiveBenchMeta>()
  const block = js.match(/gn=\{(.*?)\},\s*\w+=/s)?.[1] ?? ''
  if (!block) return map
  for (const match of block.matchAll(/"([^"]+)":\{([^{}]*)\}/g)) {
    const slug = match[1]
    const body = match[2]
    if (!slug || !body) continue
    map.set(slug, {
      displayName: body.match(/displayName:"([^"]+)"/)?.[1],
      organization: body.match(/organization:"([^"]+)"/)?.[1],
      openweight: /openweight:!0/.test(body),
    })
  }
  return map
}

function liveBenchOverall(values: Record<string, number | null>): number | null {
  const keys = [
    'long_agentic',
    'reasoning',
    'coding',
    'browser',
    'data_analysis',
    'research',
    'design',
  ]
  const nums = keys.map((key) => values[key]).filter((v): v is number => v !== null)
  return nums.length ? round(nums.reduce((sum, n) => sum + n, 0) / nums.length, 1) : null
}

export async function fetchLivebenchBoard(): Promise<AiWorldLeaderboardBoard> {
  const page = await fetchText(LIVEBENCH_PAGE_URL)
  const scriptUrl = page.match(/src="(\.\/static\/js\/main\.[^"]+\.js)"/)?.[1]
  const release = page.match(/data\/(\d{8})\//)?.[1] ?? ''
  if (!scriptUrl) throw new Error('LiveBench 页面缺少主脚本')
  const js = await fetchText(`https://livebench.ai/${scriptUrl.replace(/^\.\//, '')}`)
  const releaseBlock = js.match(/Yt=\[([^\]]+)\]/)?.[1] ?? ''
  const releaseFromJs =
    [...releaseBlock.matchAll(/"(\d{8})"/g)].at(-1)?.[1] ??
    js.match(/data\/(\d{8})/)?.[1] ??
    release
  if (!releaseFromJs) throw new Error('LiveBench 页面缺少 release 日期')
  const dataBase = `https://livebench.ai/data/${releaseFromJs}`
  const [tableCsv, costCsv, meta] = await Promise.all([
    fetchText(`${dataBase}/table.csv`),
    fetchText(`${dataBase}/cost.csv`).catch(() => ''),
    Promise.resolve(parseLiveBenchMeta(js)),
  ])
  const tableWb = XLSX.read(tableCsv, { type: 'string' })
  const tableSheet = tableWb.Sheets[tableWb.SheetNames[0] ?? '']
  if (!tableSheet) throw new Error('LiveBench table.csv 没有工作表')
  const tableRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(tableSheet, { defval: '' })
  const costWb = costCsv ? XLSX.read(costCsv, { type: 'string' }) : null
  const costSheet = costWb ? costWb.Sheets[costWb.SheetNames[0] ?? ''] : null
  const costRows = costSheet
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(costSheet, { defval: '' })
    : []
  const costMap = new Map(costRows.map((row) => [text(row.model), row]))
  const rows: AiWorldLeaderboardBoardRow[] = []
  for (const raw of tableRows) {
    const slug = text(raw.model)
    if (!slug) continue
    const values: Record<string, number | null> = {
      long_agentic: num(raw.long_agentic),
      reasoning: num(raw.reasoning),
      coding: num(raw.coding),
      browser: num(raw.browser),
      data_analysis: num(raw.data_analysis),
      research: num(raw.research),
      design: num(raw.design),
    }
    const overall = liveBenchOverall(values)
    if (overall === null) continue
    const info = meta.get(slug)
    const cost = costMap.get(slug)
    const costValues = [
      'design',
      'research',
      'browser',
      'coding',
      'long_agentic',
      'data_analysis',
      'reasoning',
    ]
      .map((key) => num(cost?.[key]))
      .filter((v): v is number => v !== null)
    const extra: Record<string, string | number | boolean | null> = {
      overall,
      avgInputTokens: num(cost?.avg_input_tokens),
      avgOutputTokens: num(cost?.avg_output_tokens),
      inputPrice: num(cost?.input_price_per_million),
      outputPrice: num(cost?.output_price_per_million),
      avgTaskCost: costValues.length
        ? round(costValues.reduce((sum, n) => sum + n, 0) / costValues.length, 2)
        : null,
    }
    rows.push({
      rank: 0,
      model: text(info?.displayName) || slug,
      vendor: text(info?.organization) || 'LiveBench',
      openWeights: info?.openweight ?? null,
      score: overall,
      values: { ...values, ...extra },
    })
  }
  if (!rows.length) throw new Error('LiveBench 解析后没有模型行')
  return makeBoard({
    id: 'livebench',
    sourceId: 'livebench',
    name: 'LiveBench 2.0',
    shortName: 'LiveBench',
    metric: 'Overall（七类平均）',
    description:
      'LiveBench 2.0 官方 table.csv + cost.csv，覆盖长程智能体、推理、编程、浏览器、数据分析、研究、设计七类；含平均输入/输出 token 与单价。',
    url: LIVEBENCH_PAGE_URL,
    dataset: `${dataBase}/table.csv`,
    asOf: `${releaseFromJs.slice(0, 4)}-${releaseFromJs.slice(4, 6)}-${releaseFromJs.slice(6, 8)}`,
    live: true,
    note: `官方 release ${releaseFromJs}；${rows.length} 个模型、7 个类别，Overall 为七类均值。Cost.csv 的单价是官方按每百万 token 的模型价，不是本站估算；不是所有模型都有全部类别成绩。`,
    columns: [
      { key: 'overall', label: 'Overall', kind: 'score' },
      { key: 'long_agentic', label: 'Agentic', kind: 'score' },
      { key: 'reasoning', label: 'Reasoning', kind: 'score' },
      { key: 'coding', label: 'Coding', kind: 'score' },
      { key: 'browser', label: 'Browser', kind: 'score' },
      { key: 'data_analysis', label: 'Data Analysis', kind: 'score' },
      { key: 'research', label: 'Research', kind: 'score' },
      { key: 'design', label: 'Design', kind: 'score' },
      { key: 'avgInputTokens', label: '平均输入 tok', kind: 'tokens' },
      { key: 'avgOutputTokens', label: '平均输出 tok', kind: 'tokens' },
      { key: 'inputPrice', label: '输入 $/M', kind: 'usd' },
      { key: 'outputPrice', label: '输出 $/M', kind: 'usd' },
      { key: 'avgTaskCost', label: '平均任务成本', kind: 'usd' },
    ],
    rows: sortByScore(rows, 'overall'),
  })
}

/* --------------------------------------------------------------- SWE-bench */

interface SweRow {
  name?: string
  model_display?: string
  model_org?: string
  agent?: string
  agent_org?: string
  resolved?: number
  instance_cost?: number | null
  cost?: number | null
  instance_calls?: number | null
  date?: string
  mini_swe_agent_version?: string
  tags?: string[]
}

export async function fetchSwebenchBoard(): Promise<AiWorldLeaderboardBoard> {
  const html = await fetchText(SWEBENCH_PAGE_URL, 90_000)
  const $ = loadDom(html)
  const raw = $('#leaderboard-data').text()
  if (!raw) throw new Error('SWE-bench 页面缺少 leaderboard-data')
  const groups = JSON.parse(raw) as Array<{ name?: string; results?: SweRow[] }>
  const rows: AiWorldLeaderboardBoardRow[] = []
  for (const group of groups) {
    const subset = text(group.name) || 'Verified'
    const list = (group.results ?? []).filter((row) => typeof row.resolved === 'number')
    list.sort((a, b) => Number(b.resolved) - Number(a.resolved))
    for (const [index, row] of list.entries()) {
      const model = text(row.model_display) || text(row.name)
      if (!model) continue
      rows.push({
        rank: index + 1,
        model,
        vendor: text(row.model_org) || text(row.agent_org) || 'SWE-bench',
        score: num(row.resolved),
        values: {
          subset,
          resolved: num(row.resolved),
          agent: text(row.agent) || null,
          avgCost: num(row.instance_cost),
          totalCost: num(row.cost),
          avgCalls: num(row.instance_calls),
          org: text(row.model_org) || text(row.agent_org) || null,
          date: text(row.date) || null,
          release: text(row.mini_swe_agent_version) || null,
        },
      })
    }
  }
  if (!rows.length) throw new Error('SWE-bench 解析后没有模型行')
  const asOf =
    rows
      .map((row) => String(row.values.date ?? ''))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .at(-1) ?? ''
  return {
    id: 'swebench',
    sourceId: 'swebench',
    name: 'SWE-bench',
    shortName: 'SWE-bench',
    metric: '% Resolved（各 subset 内）',
    description:
      'SWE-bench 官方 leaderboards 页面内嵌 JSON，覆盖 Verified、Full、Lite、Multilingual、Multimodal 五个 subset；含 agent、解决率、单题/总成本、平均调用、提交日期、release。',
    url: SWEBENCH_PAGE_URL,
    dataset: 'https://www.swebench.com/ (leaderboard-data JSON)',
    asOf,
    live: true,
    note: `官方页面内嵌 leaderboard-data；${rows.length} 行 = 五个 subset 的全部提交，不是只取 Verified 前 10。不同 subset 的题目集不同，不能把 72% 和 60% 直接横比；每行排名只在所属 subset 内计算。`,
    columns: [
      { key: 'subset', label: 'Subset', kind: 'text' },
      { key: 'resolved', label: '% Resolved', kind: 'percent' },
      { key: 'agent', label: 'Agent', kind: 'text' },
      { key: 'avgCost', label: '单题 $', kind: 'usd' },
      { key: 'totalCost', label: '总 $', kind: 'usd' },
      { key: 'avgCalls', label: '平均调用', kind: 'int' },
      { key: 'org', label: 'Org', kind: 'text' },
      { key: 'date', label: '提交日期', kind: 'date' },
      { key: 'release', label: 'Release', kind: 'text' },
    ],
    rows,
    boardSize: rows.length,
  }
}

/* ------------------------------------------------------------------ Epoch */

export async function fetchEpochBoard(): Promise<AiWorldLeaderboardBoard> {
  const [scoresCsv, modelsCsv] = await Promise.all([
    fetchText(EPOCH_ECI_URL, 60_000),
    fetchText(EPOCH_MODELS_URL, 90_000).catch(() => ''),
  ])
  const scoreWb = XLSX.read(scoresCsv, { type: 'string' })
  const scoreSheet = scoreWb.Sheets[scoreWb.SheetNames[0] ?? '']
  if (!scoreSheet) throw new Error('Epoch ECI CSV 没有工作表')
  const scores = XLSX.utils.sheet_to_json<Record<string, unknown>>(scoreSheet, { defval: '' })
  const models = new Map<string, Record<string, unknown>>()
  if (modelsCsv) {
    const wb = XLSX.read(modelsCsv, { type: 'string' })
    const sheet = wb.Sheets[wb.SheetNames[0] ?? '']
    if (sheet) {
      for (const row of XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })) {
        const keys = [text(row.Model), text(row['Display name']), text(row['Unique display name'])]
        for (const key of keys) if (key) models.set(key, row)
      }
    }
  }
  const rows: AiWorldLeaderboardBoardRow[] = []
  for (const raw of scores) {
    const name = text(raw['Display name']) || text(raw.Model)
    const eci = num(raw.eci)
    if (!name || eci === null) continue
    const meta = models.get(text(raw.Model)) ?? models.get(name) ?? {}
    const params = formatParams(meta.Parameters)
    rows.push({
      rank: 0,
      model: name,
      vendor: text(raw.Organization) || text(meta.Organization) || 'Epoch AI',
      params,
      score: round(eci, 2),
      values: {
        eci: round(eci, 2),
        ciLow: num(raw.eci_ci_low),
        ciHigh: num(raw.eci_ci_high),
        releaseDate: excelDate(raw.date),
        organization: text(raw.Organization) || null,
        access: text(raw['Model accessibility']) || null,
        params,
        inputPrice: num(meta['Input price']),
        outputPrice: num(meta['Output price']),
        trainingCompute: text(meta['Training compute (FLOP)']) || null,
        country: text(raw['Country (of organization)']) || null,
      },
    })
  }
  if (!rows.length) throw new Error('Epoch ECI 解析后没有模型行')
  const asOf =
    rows
      .map((row) => String(row.values.releaseDate ?? ''))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .at(-1) ?? ''
  return makeBoard({
    id: 'epoch',
    sourceId: 'epoch',
    name: 'Epoch AI ECI',
    shortName: 'Epoch ECI',
    metric: 'Epoch Capabilities Index',
    description:
      'Epoch AI 官方 ECI 分数与模型元数据，综合 50+ 基准的抽象能力分；另带 90% 置信区间、参数量、输入/输出价格、训练算力与可得性。',
    url: 'https://epoch.ai/eci',
    dataset: EPOCH_ECI_URL,
    asOf,
    live: true,
    note: `官方 eci_scores.csv + benchmarked_models.csv；${rows.length} 个模型。ECI 是抽象分（Claude 3.5 Sonnet=130、GPT-5=150 校准），不是正确率；90% CI 为官方区间。参数量/价格/训练算力来自官方模型表，部分模型没有公开值。`,
    columns: [
      { key: 'eci', label: 'ECI', kind: 'score' },
      { key: 'ciLow', label: '90% CI 低', kind: 'score' },
      { key: 'ciHigh', label: '90% CI 高', kind: 'score' },
      { key: 'params', label: '参数量', kind: 'text' },
      { key: 'inputPrice', label: '输入 $/M', kind: 'usd' },
      { key: 'outputPrice', label: '输出 $/M', kind: 'usd' },
      { key: 'trainingCompute', label: '训练算力 FLOP', kind: 'text' },
      { key: 'releaseDate', label: '发布', kind: 'date' },
      { key: 'access', label: '可得性', kind: 'text' },
      { key: 'country', label: '国家/地区', kind: 'text' },
    ],
    rows: sortByScore(rows, 'eci'),
  })
}

/* --------------------------------------------------------------- 总入口 */

export interface ExtraBoardsResult {
  boards: AiWorldLeaderboardBoard[]
  status: Partial<
    Record<
      'helm' | 'opencompass' | 'superclue' | 'livebench' | 'swebench' | 'epoch',
      'ok' | 'failed'
    >
  >
}

export async function fetchExtraBoards(): Promise<ExtraBoardsResult> {
  const jobs = [
    ['helm', fetchHelmBoard] as const,
    ['opencompass', fetchOpenCompassBoard] as const,
    ['superclue', fetchSuperclueBoard] as const,
    ['livebench', fetchLivebenchBoard] as const,
    ['swebench', fetchSwebenchBoard] as const,
    ['epoch', fetchEpochBoard] as const,
  ]
  const settled = await Promise.allSettled(jobs.map(([, fn]) => fn()))
  const boards: AiWorldLeaderboardBoard[] = []
  const status: ExtraBoardsResult['status'] = {}
  settled.forEach((result, index) => {
    const id = jobs[index]?.[0]
    if (!id) return
    if (result.status === 'fulfilled') {
      boards.push(result.value)
      status[id] = 'ok'
    } else {
      status[id] = 'failed'
      logger.warn('[authoritative-leaderboard] 新增平台抓取失败', {
        source: id,
        err: result.reason,
      })
    }
  })
  return { boards, status }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
