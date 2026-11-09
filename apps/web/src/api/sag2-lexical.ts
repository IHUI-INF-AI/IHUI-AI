// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SAG2 词法多跳检索通道 · web API 封装（本仓自有实现）。
 *
 * 能力面对齐对照程序 SAG Wiki：索引状态、文档登记/移除、离线 BM25 快速搜索、
 * 查询时多跳检索、以及与本仓既有 rag.py 向量/关键词通道的 RRF 融合。
 *
 * 后端统一信封 {code,message,data} 由 apiOrThrow 解包；任何失败都抛错，
 * 不把「空结果」伪装成「已判定」，与后端的诚实降级约定保持一致。
 */

import { apiOrThrow } from '@/lib/api'

export interface Sag2Status {
  version: number
  documents: number
  chunks: number
  terms: number
  avg_chunk_length: number
  ready: boolean
  backend: string
  judge_provider: string
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
}

export interface Sag2SearchResult {
  query: string
  mode: string
  model_calls: number
  total_files: number
  page: number
  per_page: number
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
}

/** 单个文件落桶的具名原因（unsupported / missing-dep / binary / parse-error / too-large）。 */
export interface Sag2ScanError {
  path: string
  reason: string
}

/** 一轮扫描的算术自证：changed + unchanged + unsupported + failed + too_large = scanned。 */
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
}

export interface Sag2WatchOutcome {
  watching: boolean
  root?: string
  interval_s?: number
  stopped?: boolean
  reason?: string
}

export interface Sag2AddFolderOutcome {
  registered: boolean
  reason?: string
  folder?: Sag2Folder
  persisted?: boolean
  scan: Sag2ScanResult | null
  watch: Sag2WatchOutcome | null
}

const JSON_HEADERS: HeadersInit = { 'Content-Type': 'application/json' }

function postJson<T>(url: string, body: unknown): Promise<T> {
  return apiOrThrow<T>(url, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

export function sag2Status(): Promise<Sag2Status> {
  return apiOrThrow<Sag2Status>('/api/v1/ai/sag2/status')
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
  return apiOrThrow<Sag2RemoveOutcome>('/api/v1/ai/sag2/documents', {
    method: 'DELETE',
    headers: JSON_HEADERS,
    body: JSON.stringify({ path }),
  })
}

export function sag2Search(query: string, page = 1, perPage = 20): Promise<Sag2SearchResult> {
  return postJson<Sag2SearchResult>('/api/v1/ai/sag2/search', {
    query,
    page,
    per_page: perPage,
  })
}

export function sag2Retrieve(
  query: string,
  options: Sag2RetrieveOptions = {},
): Promise<Sag2RetrieveResult> {
  return postJson<Sag2RetrieveResult>('/api/v1/ai/sag2/retrieve', {
    query,
    ...options,
  })
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

// -- 本地文件夹登记 / 增量扫描（对照的「Add a local folder」） ----------------

export function sag2ListFolders(): Promise<Sag2FolderList> {
  return apiOrThrow<Sag2FolderList>('/api/v1/ai/sag2/folders')
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
  return postJson<Sag2ScanResult>('/api/v1/ai/sag2/folders/scan', {
    root: root ?? null,
    force,
  })
}

export function sag2RemoveFolder(root: string): Promise<{
  unregistered: boolean
  removed: number
  reason?: string
}> {
  return apiOrThrow(`/api/v1/ai/sag2/folders?root=${encodeURIComponent(root)}`, {
    method: 'DELETE',
  })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
