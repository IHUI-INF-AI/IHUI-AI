// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** web 端 `sag2-lexical.ts` 的同构投影,真相源见该文件头注。 */
import { fetchAiServiceJson } from '../client.js'

const JSON_HEADERS: Record<string, string> = { 'Content-Type': 'application/json' }

/** 抛错版访问:ai-service 通道,统一信封已解包。 */
async function aiOrThrow<T>(
  url: string,
  options: Parameters<typeof fetchAiServiceJson>[1] = {},
): Promise<T> {
  const r = await fetchAiServiceJson<T>(url, options)
  if (!r.success) throw new Error(r.error || 'SAG2 请求失败')
  return r.data
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return aiOrThrow<T>(url, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
}

/** 单个抽取能力的探测结果(后端如实上报,不做美化)。 */
export interface Sag2ExtractorProbe {
  engine: string
  installed: boolean
  reason?: string
}

export interface Sag2Status {
  version: number
  documents: number
  chunks: number
  terms: number
  avg_chunk_length: number
  ready: boolean
  backend: string
  judge_provider: string
  extractors?: {
    asr?: Sag2ExtractorProbe & { model_dir?: string; suffixes?: string[] }
    ocr?: Sag2ExtractorProbe & {
      engines?: string[]
      pdf_rasterizer?: string
      min_score?: number
      max_pages?: number
    }
    pdf_rasterizer?: Sag2ExtractorProbe & {
      version?: string
      max_pages?: number
      max_dpi?: number
    }
  }
}

export interface Sag2Citation {
  path: string
  title: string
  heading: string
  doc_hash: string
  byte_range: [number, number]
  start_line: number
  end_line: number
  passage: string
  score: number
  bm25: number
  hop: number
}

export interface Sag2DocumentOutcome {
  changed: boolean
  reason: string
  doc_hash: string
  chunk_count: number
  version: number
  model_calls: number
}

export interface Sag2RemoveOutcome {
  removed: number
  version: number
}

export interface Sag2SearchItem {
  path: string
  title: string
  snippet: string
  bm25: number
  citation: Sag2Citation
  highlights?: Array<[number, number]>
}

export interface Sag2SearchFilters {
  ext?: string[]
  prefix?: string[]
  contains?: string
}

export interface Sag2SearchResult {
  query: string
  mode: string
  model_calls: number
  total_files: number
  page: number
  per_page: number
  filters?: Sag2SearchFilters
  items: Sag2SearchItem[]
  duration_ms: number
}

export interface Sag2ExpansionTerm {
  term: string
  score: number
  kind: string
}

export interface Sag2TraceHop {
  hop: number
  candidates: string[]
  terms: Sag2ExpansionTerm[]
  evidence: string[]
  pool_size: number
  judge_mode: string
  judge_executed: boolean
  judge_reason: string
}

export interface Sag2ResultRow {
  key: string
  path: string
  content: string
  score: number
  bm25: number
  hop: number
}

export interface Sag2Judge {
  mode: string
  executed: boolean
  reason: string
}

export interface Sag2RetrieveResult {
  query: string
  status: string
  degraded: boolean
  version: number
  duration_ms: number
  results: Sag2ResultRow[]
  source_count: number
  citations: Sag2Citation[]
  trace: Sag2TraceHop[]
  judge: Sag2Judge
  paths: Record<string, unknown>
}

export interface Sag2FusedRow {
  path?: string
  key?: string
  rrf_score?: number
  fused_from?: string
  [field: string]: unknown
}

export interface Sag2FuseResult {
  results: Sag2FusedRow[]
  channels: string[]
  rrf_k: number
}

export interface Sag2RetrieveOptions {
  candidate_k?: number
  seed_k?: number
  expansion_term_limit?: number
  max_hops?: number
  top_k?: number
  file_limit?: number | null
  cross_lingual?: boolean
  bridge_limit?: number
}

export interface Sag2ScanError {
  path: string
  reason: string
}

export interface Sag2ScanStats {
  scanned: number
  changed: number
  unchanged: number
  unsupported: number
  failed: number
  too_large: number
  chunks: number
  duration_ms: number
  errors: Sag2ScanError[]
  buckets_sum: number
}

export interface Sag2ScanResult extends Sag2ScanStats {
  scanned_roots: number
  roots: Array<Sag2ScanStats & { root: string }>
  index: Sag2Status
  reason?: string
}

export interface Sag2Folder {
  root: string
  include: string[]
  exclude: string[]
  recursive: boolean
  added_at: number
  last_scan_at: number
  last_scan: Partial<Sag2ScanStats>
}

export interface Sag2FolderList {
  folders: Sag2Folder[]
  persisted: boolean
  state_path: string
  watching: string[]
  watch_modes?: Record<string, string>
}

export interface Sag2WatchOutcome {
  watching: boolean
  root?: string
  interval_s?: number
  stopped?: boolean
  reason?: string
  mode?: string
  debounce_ms?: number
}

export interface Sag2AddFolderOutcome {
  registered: boolean
  reason?: string
  folder?: Sag2Folder
  persisted?: boolean
  scan: Sag2ScanResult | null
  watch: Sag2WatchOutcome | null
}

export function sag2Status(): Promise<Sag2Status> {
  return aiOrThrow<Sag2Status>('/api/v1/ai/sag2/status')
}

export function sag2AddDocument(input: {
  path: string
  content: string
  title?: string | null
  heading?: string
  chunk_size?: number
  overlap?: number
}): Promise<Sag2DocumentOutcome> {
  return postJson<Sag2DocumentOutcome>('/api/v1/ai/sag2/documents', input)
}

export function sag2RemoveDocument(path: string): Promise<Sag2RemoveOutcome> {
  return aiOrThrow<Sag2RemoveOutcome>('/api/v1/ai/sag2/documents', {
    method: 'DELETE',
    headers: JSON_HEADERS,
    body: JSON.stringify({ path }),
  })
}

export interface Sag2SearchOptions {
  filters?: Sag2SearchFilters
  highlight?: boolean
}

export function sag2Search(
  query: string,
  page = 1,
  perPage = 20,
  options: Sag2SearchOptions = {},
): Promise<Sag2SearchResult> {
  const body: Record<string, unknown> = { query, page, per_page: perPage }
  if (options.filters) body.filters = options.filters
  if (options.highlight !== undefined) body.highlight = options.highlight
  return postJson<Sag2SearchResult>('/api/v1/ai/sag2/search', body)
}

export function sag2Retrieve(
  query: string,
  options: Sag2RetrieveOptions = {},
): Promise<Sag2RetrieveResult> {
  return postJson<Sag2RetrieveResult>('/api/v1/ai/sag2/retrieve', { query, ...options })
}

export function sag2Fuse(
  sag2Results: Sag2ResultRow[],
  ragSources: Array<Record<string, unknown>> = [],
  k = 60,
): Promise<Sag2FuseResult> {
  return postJson<Sag2FuseResult>('/api/v1/ai/sag2/fuse', {
    sag2_results: sag2Results,
    rag_sources: ragSources,
    k,
  })
}

export function sag2ListFolders(): Promise<Sag2FolderList> {
  return aiOrThrow<Sag2FolderList>('/api/v1/ai/sag2/folders')
}

export function sag2AddFolder(input: {
  root: string
  include?: string[] | null
  exclude?: string[] | null
  recursive?: boolean
  scan?: boolean
  watch?: boolean
  watch_interval_s?: number
}): Promise<Sag2AddFolderOutcome> {
  return postJson<Sag2AddFolderOutcome>('/api/v1/ai/sag2/folders', input)
}

export function sag2ScanFolders(root?: string | null, force = false): Promise<Sag2ScanResult> {
  return postJson<Sag2ScanResult>('/api/v1/ai/sag2/folders/scan', { root: root ?? null, force })
}

export function sag2RemoveFolder(root: string): Promise<{
  unregistered: boolean
  removed: number
  reason?: string
}> {
  return aiOrThrow(`/api/v1/ai/sag2/folders?root=${encodeURIComponent(root)}`, { method: 'DELETE' })
}

export function sag2WatchFolder(
  root: string,
  enabled: boolean,
  intervalS = 30,
): Promise<Sag2WatchOutcome> {
  return postJson<Sag2WatchOutcome>('/api/v1/ai/sag2/folders/watch', {
    root,
    enabled,
    interval_s: intervalS,
  })
}
