// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 国家网信办「算法/模型备案」公开清单导入服务。
 *
 * 数据源(均为官方、免登录可下载):
 * - 算法推荐:主公告页 https://www.cac.gov.cn/2022-08/12/c_1661927474338504.htm
 *   (内含 19 个批次的 downloadfile.jsp 附件，页面更新即自动发现新批次)
 * - 深度合成:每批一个独立公告页，种子与发现源见 ./algorithm-record-seeds.ts
 *
 * 解析:docx 用 mammoth 转 HTML 后用 cheerio 抽取最大表格行/列；
 * 两套清单统一 8 列，按列名(序号/算法名称/算法类别|角色/主体名称/应用产品/主要用途/备案编号/备注)定位。
 * 落库以 record_no(备案编号) 为去重键 upsert。
 */
import mammoth from 'mammoth'
import { load as loadDom } from 'cheerio'
import { algorithmRecord } from '@ihui/database'
import { desc, or, and, ilike, eq, isNotNull, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import {
  DEEP_SYNTHESIS_BATCH_SEEDS,
  DEEP_SYNTHESIS_DISCOVERY_URL,
} from './algorithm-record-seeds.js'

export const ALGORITHM_RECOMMEND_KIND = 'algorithm_recommend'
export const DEEP_SYNTHESIS_KIND = 'deep_synthesis'
export type RecordKind = typeof ALGORITHM_RECOMMEND_KIND | typeof DEEP_SYNTHESIS_KIND

const ALGORITHM_RECOMMEND_SOURCE_URL = 'https://www.cac.gov.cn/2022-08/12/c_1661927474338504.htm'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`)
  return res.text()
}

async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

/** 从公告页 HTML 提取所有 downloadfile.jsp 附件完整 URL。 */
export function extractDownloadLinks(html: string): string[] {
  const out = new Set<string>()
  const re = /(?:href|src)=["']([^"']*downloadfile\.jsp\?filepath=[^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    let url = (m[1] ?? '').replace(/&amp;/g, '&')
    if (url.startsWith('//')) url = 'https:' + url
    else if (url.startsWith('/')) url = 'https://www.cac.gov.cn' + url
    else if (!/^https?:/.test(url)) url = 'https://www.cac.gov.cn/' + url
    out.add(url)
  }
  return [...out]
}

/** 从附件文件名(URL 编码)提取批次，如 "……（2026年7月）" → "2026-07"。 */
export function extractBatchFromText(text: string): string | null {
  const m = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/)
  if (!m) return null
  return `${m[1] ?? ''}-${String(+(m[2] ?? 0)).padStart(2, '0')}`
}

interface ParseOut {
  header: string[]
  rows: string[][]
}

/** 解析 docx 为表格：取行数最多的那个 table(清单主体)。 */
export async function parseDocx(buffer: Buffer): Promise<ParseOut> {
  const r = await mammoth.convertToHtml({ buffer })
  const $ = loadDom(r.value)
  const tables = $('table').toArray()
  if (tables.length === 0) return { header: [], rows: [] }
  // 取行数最多的表格(清单主体);用 any 规避 cheerio 泛型在闭包收窄下的 never 类型
  let bestEl: unknown = tables[0]
  let bestLen = 0
  for (const el of tables) {
    const n = $(el).find('tr').length
    if (n > bestLen) {
      bestLen = n
      bestEl = el
    }
  }
  const $best = $(bestEl as any)
  const rows: string[][] = []
  $best.find('tr').each((_, tr) => {
    rows.push(
      $(tr)
        .find('th,td')
        .map((_, c) => $(c).text().trim())
        .get(),
    )
  })
  return { header: rows[0] ?? [], rows: rows.slice(1) }
}

function findIdx(header: string[], names: string[]): number {
  for (const h of names) {
    const norm = h.replace(/\s+/g, '')
    const i = header.findIndex((x) => {
      const xn = x.replace(/\s+/g, '')
      return xn.includes(norm) || norm.includes(xn)
    })
    if (i >= 0) return i
  }
  return -1
}

function mapRow(
  header: string[],
  row: string[],
  kind: RecordKind,
  batch: string | null,
  sourceUrl: string,
) {
  const id = kind === DEEP_SYNTHESIS_KIND ? ['角色'] : ['算法类别']
  const idx = {
    name: findIdx(header, ['算法名称']),
    category: findIdx(header, id),
    provider: findIdx(header, ['主体名称', '备案服务提供者']),
    product: findIdx(header, ['应用产品', '服务形式']),
    purpose: findIdx(header, ['主要用途', '算法原理', '简要说明']),
    no: findIdx(header, ['备案编号']),
    seq: findIdx(header, ['序号']),
  }
  const get = (i: number) => (i >= 0 ? row[i] ?? '' : '')
  const recordNo = get(idx.no).trim()
  if (!recordNo) return null // 无备案编号的数据行跳过
  return {
    kind,
    algName: get(idx.name).trim(),
    category: get(idx.category).trim() || null,
    provider: get(idx.provider).trim(),
    product: get(idx.product).trim() || null,
    purpose: get(idx.purpose).trim() || null,
    recordNo,
    batch,
    sourceUrl,
    rowNo: get(idx.seq) ? Number(get(idx.seq)) || null : null,
  }
}

export interface ImportStats {
  kind: RecordKind
  files: number
  inserted: number
  updated: number
  skipped: number
}

interface DocxImport {
  kind: RecordKind
  batch: string | null
  sourceUrl: string
  buffer: Buffer
}

/** 将一份已下载的清单 docx 全量 upsert 入库。 */
export async function importOneDocx({ kind, batch, sourceUrl, buffer }: DocxImport): Promise<ImportStats> {
  const { header, rows } = await parseDocx(buffer)
  const values = []
  let skipped = 0
  for (const row of rows) {
    const mapped = mapRow(header, row, kind, batch, sourceUrl)
    if (!mapped) {
      skipped++
      continue
    }
    if (!mapped.algName || !mapped.provider) {
      skipped++
      continue
    }
    values.push(mapped)
  }
  if (values.length > 0) {
    // 全部以备案编号 record_no 为去重键 upsert：既有则更新、新出现则插入，
    // 因此 values.length 即为“本次真正写入(含更新)的行数”。
    await db
      .insert(algorithmRecord)
      .values(values)
      .onConflictDoUpdate({
        target: algorithmRecord.recordNo,
        set: {
          kind: sql`excluded.kind`,
          algName: sql`excluded.alg_name`,
          category: sql`excluded.category`,
          provider: sql`excluded.provider`,
          product: sql`excluded.product`,
          purpose: sql`excluded.purpose`,
          batch: sql`excluded.batch`,
          sourceUrl: sql`excluded.source_url`,
          updatedAt: sql`now()`,
        },
      })
    return { kind, files: 1, inserted: values.length, updated: 0, skipped }
  }
  return { kind, files: 1, inserted: 0, updated: 0, skipped }
}

/** 抓取并导入一个官方公告页(downloadfile 附件可为多个，逐个导入)。 */
async function importFromPage(
  kind: RecordKind,
  pageUrl: string,
  fallbackBatch: string | null,
  log: Pick<Console, 'info' | 'warn' | 'error'>,
): Promise<ImportStats[]> {
  const html = await fetchText(pageUrl)
  const links = extractDownloadLinks(html)
  if (links.length === 0) {
    log.warn(`[algorithm-record] ${pageUrl} 未发现 downloadfile 附件`)
    return []
  }
  const stats: ImportStats[] = []
  for (const link of links) {
    try {
      const buf = await fetchBytes(link)
      const batch = fallbackBatch ?? extractBatchFromText(decodeURIComponent(link))
      const s = await importOneDocx({ kind, batch, sourceUrl: link, buffer: buf })
      log.info(
        `[algorithm-record] ${kind} ${batch ?? '?'} 导入完成: 写入${s.inserted} 更新${s.updated} 跳过${s.skipped}`,
      )
      stats.push(s)
    } catch (e) {
      log.error(
        `[algorithm-record] ${kind} 附件导入失败 ${link}: ${(e as Error).message}`,
      )
    }
  }
  return stats
}

export interface SyncOptions {
  log?: Pick<Console, 'info' | 'warn' | 'error'>
  kinds?: RecordKind[]
}

/** 全量同步:算法推荐(主公告页自动发现全部批次) + 深度合成(种子批次) + 深度合成发现源。 */
export async function syncAlgorithmRecords(opts: SyncOptions = {}): Promise<ImportStats[]> {
  const log = opts.log ?? console
  const kinds = opts.kinds ?? [ALGORITHM_RECOMMEND_KIND, DEEP_SYNTHESIS_KIND]
  const all: ImportStats[] = []

  if (kinds.includes(ALGORITHM_RECOMMEND_KIND)) {
    try {
      log.info('[algorithm-record] 开始同步 算法推荐 清单...')
      const s = await importFromPage(
        ALGORITHM_RECOMMEND_KIND,
        ALGORITHM_RECOMMEND_SOURCE_URL,
        null,
        log,
      )
      all.push(...s)
    } catch (e) {
      log.error(`[algorithm-record] 算法推荐同步失败: ${(e as Error).message}`)
    }
  }

  if (kinds.includes(DEEP_SYNTHESIS_KIND)) {
    log.info('[algorithm-record] 开始同步 深度合成 清单...')
    // ① 深度合成种子批次(逐公告页)
    for (const seed of DEEP_SYNTHESIS_BATCH_SEEDS) {
      try {
        const found = await importFromPage(
          DEEP_SYNTHESIS_KIND,
          seed.sourceUrl,
          seed.batch ?? null,
          log,
        )
        all.push(...found)
      } catch (e) {
        log.error(`[algorithm-record] 深度合成批次 ${seed.batch ?? seed.sourceUrl} 失败: ${(e as Error).message}`)
      }
    }
    // ② 深度合成发现源(beian 系统公告列表,自动发现未列入种子的新批次)
    try {
      const res = await fetch(DEEP_SYNTHESIS_DISCOVERY_URL, { headers: { 'User-Agent': UA } })
      if (res.ok) {
        const json = (await res.json()) as { datas?: { title?: string; content?: string }[] }
        const pages = (json.datas ?? [])
          .filter((n) => n.title?.includes('深度合成服务算法备案') && /www\.cac\.gov\.cn/.test(n.content ?? ''))
          .map((n) => (n.content ?? '').trim())
        const seen = new Set<string>()
        for (const p of pages) {
          const key = p.split('/c_')[1]?.slice(0, 12) ?? p
          if (seen.has(key)) continue
          seen.add(key)
          try {
            const found = await importFromPage(DEEP_SYNTHESIS_KIND, p, null, log)
            all.push(...found)
          } catch (e) {
            log.error(`[algorithm-record] 深度合成发现源页面失败 ${p}: ${(e as Error).message}`)
          }
        }
      } else {
        log.warn(`[algorithm-record] 深度合成发现源返回 ${res.status}`)
      }
    } catch (e) {
      log.warn(`[algorithm-record] 深度合成发现源不可用: ${(e as Error).message}`)
    }
  }

  return all
}

// =============================================================================
// 定时刷新(每 6 小时一次,与数据源采集节奏对齐;ENABLE_ALGORITHM_RECORD_SYNC=false 禁用)
// =============================================================================
let syncTimer: ReturnType<typeof setInterval> | null = null
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000

export function startAlgorithmRecordScheduler(): void {
  if (syncTimer) return
  syncTimer = setInterval(() => {
    syncAlgorithmRecords().catch((e) => console.error('[algorithm-record] 定时同步失败', e))
  }, SYNC_INTERVAL_MS)
  syncTimer.unref()
}

export function stopAlgorithmRecordScheduler(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

// =============================================================================
// 查询(供 /api/algorithm-record/search 使用)
// =============================================================================
export interface RecordQueryFilters {
  kind?: RecordKind
  batch?: string
  category?: string
}

export interface RecordQuery extends RecordQueryFilters {
  q?: string
  page?: number
  pageSize?: number
}

export interface KindCount {
  kind: string
  count: number
}

export interface CategoryCount {
  category: string | null
  count: number
}

export interface RecordQueryResult {
  items: Array<{
    id: string
    kind: string
    algName: string
    category: string | null
    provider: string
    product: string | null
    purpose: string | null
    recordNo: string
    batch: string | null
    sourceUrl: string | null
  }>
  total: number
  stats: { totalAll: number; updatedAt: string | null }
  kindCounts: KindCount[]
  batches: string[]
}

export async function searchAlgorithmRecords(query: RecordQuery): Promise<RecordQueryResult> {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, query.pageSize ?? 20))
  const conditions = []
  if (query.kind) conditions.push(eq(algorithmRecord.kind, query.kind))
  if (query.batch) conditions.push(eq(algorithmRecord.batch, query.batch))
  if (query.category) conditions.push(eq(algorithmRecord.category, query.category))
  const q = query.q?.trim()
  if (q) {
    const like = `%${q.replace(/[%_]/g, '')}%`
    conditions.push(
      or(
        ilike(algorithmRecord.algName, like),
        ilike(algorithmRecord.provider, like),
        ilike(algorithmRecord.recordNo, like),
        ilike(algorithmRecord.category, like),
        ilike(algorithmRecord.product, like),
      ),
    )
  }
  const cond = conditions.length ? and(...conditions) : undefined
  const [rows, countRows, totalAllRows, updatedAtRows, kindCountRows, distinctBatchRows] =
    await Promise.all([
      dbRead
        .select({
          id: algorithmRecord.id,
          kind: algorithmRecord.kind,
          algName: algorithmRecord.algName,
          category: algorithmRecord.category,
          provider: algorithmRecord.provider,
          product: algorithmRecord.product,
          purpose: algorithmRecord.purpose,
          recordNo: algorithmRecord.recordNo,
          batch: algorithmRecord.batch,
          sourceUrl: algorithmRecord.sourceUrl,
        })
        .from(algorithmRecord)
        .where(cond)
        .orderBy(desc(algorithmRecord.batch), algorithmRecord.algName)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      dbRead.select({ n: sql<number>`count(*)::int` }).from(algorithmRecord).where(cond),
      dbRead.select({ n: sql<number>`count(*)::int` }).from(algorithmRecord),
      dbRead.select({ m: sql<string>`max(updated_at)` }).from(algorithmRecord),
      dbRead
        .select({ kind: algorithmRecord.kind, n: sql<number>`count(*)::int` })
        .from(algorithmRecord)
        .groupBy(algorithmRecord.kind),
      dbRead
        .select({ batch: algorithmRecord.batch })
        .from(algorithmRecord)
        .where(isNotNull(algorithmRecord.batch)),
    ])
  const maxRaw = updatedAtRows[0]?.m
  const updatedAt = maxRaw ? new Date(maxRaw).toISOString() : null
  const batches = [
    ...new Set(
      distinctBatchRows
        .map((r) => r.batch)
        .filter((b): b is string => !!b),
    ),
  ]
    .sort((a, b) => a.localeCompare(b))
    .reverse()
  return {
    items: rows,
    total: countRows[0]?.n ?? 0,
    stats: {
      totalAll: totalAllRows[0]?.n ?? 0,
      updatedAt,
    },
    kindCounts: kindCountRows.map((r) => ({ kind: r.kind, count: Number(r.n) })),
    batches,
  }
}