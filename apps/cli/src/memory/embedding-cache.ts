// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 持久化 embedding 缓存（记忆语义通道的生产化底座）。
 *
 * 背景：`VectorSearch` 之前的 entries 是**进程内数组**，`/memory search` 每次都把
 * MEMORY.md 的全部 chunk 重新 embedding 一遍 —— 进程退出即丢，重启后等于没有语义记忆。
 * 本模块把「文本 → 向量」按内容哈希落盘，重启后同一个 chunk 直接命中，零网络调用。
 *
 * 存储形态：追加式 JSONL（每行一条），不是整份 JSON 重写。理由：
 *   - 记忆条目通常几十到几千条，全量重写在每次搜索都会产生 10-30MB 写放大；
 *   - 追加写只新增一行，崩溃最多丢最后一行；坏行在加载时跳过，不拖垮整个索引；
 *   - 超过预算时一次性压实（compaction）成「每哈希只留最新一条」，不会无限膨胀。
 *
 * 纪律：
 *   - 模型名按行存。换 embedding 模型（如 text-embedding-3-small → bge-m3）后旧向量
 *     维度不同、空间不可比，加载时按 `model` 过滤，绝不把两个模型的向量混在一个余弦里。
 *   - 缓存读写失败不阻断检索：读失败按空缓存处理，写失败只记一次告警（检索仍返回结果）。
 *   - 关闭开关 `IHUI_EMBEDDING_CACHE=0` 时退化为直连 provider，行为与未接缓存一致。
 */

import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import type { EmbeddingProvider } from './embedding.js'
import { writeFileAtomicSync } from '../util/atomic-write.js'

const CACHE_VERSION = 1
const DEFAULT_MAX_ENTRIES = 10_000
const DEFAULT_TTL_DAYS = 180
/** 单次 provider 调用的批量上限：太大容易被上游 413/超时，太小则往返次数多 */
const EMBED_BATCH_SIZE = 64
/** 压实阈值：行数超过 maxEntries×2 或文件超过 64MB 时重写一次 */
const COMPACT_BYTES = 64 * 1024 * 1024
const BYTES_PER_ENTRY_ESTIMATE = 2048

export interface EmbeddingCacheOptions {
  /** 缓存文件路径；默认 `~/.ihui/memory/embeddings-cache.jsonl` */
  cachePath?: string
  /** 最多保留多少个不同文本的向量；默认 10000 */
  maxEntries?: number
  /** 超过多少天未命中即淘汰；默认 180 天，0 = 不按时间淘汰 */
  ttlDays?: number
  /** 显式关闭缓存（等价 IHUI_EMBEDDING_CACHE=0） */
  enabled?: boolean
  /** 时钟注入（测试用） */
  now?: () => number
  /** 写盘注入（测试用；默认 writeFileAtomicSync） */
  writeFile?: (absPath: string, content: string) => void
  /** 追加写注入（测试用；默认 fs.appendFileSync） */
  appendFile?: (absPath: string, line: string) => void
}

interface CacheLine {
  v: number
  h: string
  m: string
  d: number
  /** base64(Float32Array) —— 比 JSON 数字数组小 4-6 倍 */
  e: string
  at: number
}

export interface CacheStats {
  hits: number
  misses: number
  writes: number
  entries: number
  loadError: string | null
}

function defaultCachePath(): string {
  return path.join(os.homedir(), '.ihui', 'memory', 'embeddings-cache.jsonl')
}

function isCacheEnabled(opts: EmbeddingCacheOptions): boolean {
  if (opts.enabled === false) return false
  return process.env.IHUI_EMBEDDING_CACHE !== '0'
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function encodeVector(vec: readonly number[]): string {
  // Float32 保真：cosine 排序对 1e-7 级误差不敏感，但维度/量纲必须一致
  const f32 = new Float32Array(vec.length)
  for (let i = 0; i < vec.length; i++) f32[i] = vec[i]!
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength).toString('base64')
}

function decodeVector(b64: string): number[] | null {
  try {
    const buf = Buffer.from(b64, 'base64')
    if (buf.length === 0 || buf.length % 4 !== 0) return null
    const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
    const out = new Array<number>(f32.length)
    for (let i = 0; i < f32.length; i++) out[i] = f32[i]!
    return out
  } catch {
    return null
  }
}

/**
 * 给任意 EmbeddingProvider 套一层持久缓存。
 *
 * 语义与直连 provider 完全一致：`embedBatch(texts)` 必须返回与输入顺序对齐的向量。
 * 只有「命中缓存」与「写盘统计」是新增的，调用方无感。
 */
export class CachedEmbeddingProvider implements EmbeddingProvider {
  private readonly backing: EmbeddingProvider
  private readonly cachePath: string
  private readonly maxEntries: number
  private readonly ttlMs: number
  private readonly now: () => number
  private readonly writeFile: (absPath: string, content: string) => void
  private readonly appendFile: (absPath: string, line: string) => void

  /** hash → { vec, at } */
  private entries = new Map<string, { vec: number[]; at: number }>()
  private loaded = false
  private lineCount = 0
  private warnedWrite = false
  private stats: CacheStats = { hits: 0, misses: 0, writes: 0, entries: 0, loadError: null }

  constructor(backing: EmbeddingProvider, opts: EmbeddingCacheOptions = {}) {
    this.backing = backing
    this.cachePath = opts.cachePath ?? defaultCachePath()
    this.maxEntries = Math.max(1, opts.maxEntries ?? DEFAULT_MAX_ENTRIES)
    this.ttlMs = (opts.ttlDays ?? DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000
    this.now = opts.now ?? (() => Date.now())
    this.writeFile = opts.writeFile ?? ((absPath, content) => writeFileAtomicSync(absPath, content, { mode: 0o600 }))
    this.appendFile = opts.appendFile ?? ((absPath, line) => {
      fs.mkdirSync(path.dirname(absPath), { recursive: true })
      fs.appendFileSync(absPath, line, { encoding: 'utf-8' })
    })
  }

  modelName(): string {
    return this.backing.modelName()
  }

  /** 只读取被装饰的 provider：诊断/测试用来确认缓存层没有替换掉真实后端。 */
  get backingProvider(): EmbeddingProvider {
    return this.backing
  }

  dimensions(): number {
    return this.backing.dimensions()
  }

  /** 只读统计（测试 / 诊断用） */
  getStats(): CacheStats {
    this.ensureLoaded()
    return { ...this.stats, entries: this.entries.size }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    if (!isCacheEnabled({ cachePath: this.cachePath })) {
      return this.backing.embedBatch(texts)
    }
    this.ensureLoaded()

    const model = this.backing.modelName()
    const dim = this.backing.dimensions()
    const out: (number[] | undefined)[] = new Array(texts.length)
    const misses: Array<{ text: string; hash: string; positions: number[] }> = []
    const missIndex = new Map<string, number>()

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i]!
      const h = hashText(text)
      const hit = this.entries.get(h)
      if (hit && hit.vec.length === dim) {
        this.stats.hits++
        out[i] = hit.vec
        continue
      }
      const existing = missIndex.get(h)
      if (existing !== undefined) {
        misses[existing]!.positions.push(i)
      } else {
        missIndex.set(h, misses.length)
        misses.push({ text, hash: h, positions: [i] })
      }
    }

    if (misses.length > 0) {
      this.stats.misses += misses.length
      for (let start = 0; start < misses.length; start += EMBED_BATCH_SIZE) {
        const group = misses.slice(start, start + EMBED_BATCH_SIZE)
        const vectors = await this.backing.embedBatch(group.map((m) => m.text))
        if (vectors.length !== group.length) {
          throw new Error(`embedding provider 返回数量不符: 期望 ${group.length}，实际 ${vectors.length}`)
        }
        const at = this.now()
        for (let j = 0; j < group.length; j++) {
          const vec = vectors[j]
          if (!vec || vec.length !== dim) {
            throw new Error(`embedding 维度不符: 期望 ${dim}，实际 ${vec?.length ?? 0}`)
          }
          const item = group[j]!
          for (const pos of item.positions) out[pos] = vec
          this.entries.set(item.hash, { vec, at })
          this.appendLine({ v: CACHE_VERSION, h: item.hash, m: model, d: dim, e: encodeVector(vec), at })
        }
      }
      this.pruneIfNeeded()
    }

    // 所有位置都应被填充；缺失说明上游返回不全，直接抛错而不是静默返回 undefined
    for (let i = 0; i < out.length; i++) {
      if (!out[i]) throw new Error(`embedding 结果缺失: index=${i}`)
    }
    return out as number[][]
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    let raw = ''
    try {
      raw = fs.readFileSync(this.cachePath, 'utf-8')
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') this.stats.loadError = `读取失败: ${String((e as Error).message ?? e)}`
      return
    }
    const model = this.backing.modelName()
    const dim = this.backing.dimensions()
    const ttl = this.ttlMs > 0 ? this.now() - this.ttlMs : Number.NEGATIVE_INFINITY
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      this.lineCount++
      let parsed: CacheLine
      try {
        parsed = JSON.parse(line) as CacheLine
      } catch {
        continue // 崩溃残留的半行：跳过，不拖垮索引
      }
      if (!parsed || parsed.v !== CACHE_VERSION || parsed.m !== model || parsed.d !== dim) continue
      if (typeof parsed.h !== 'string' || typeof parsed.e !== 'string' || typeof parsed.at !== 'number') continue
      if (parsed.at < ttl) continue
      const vec = decodeVector(parsed.e)
      if (!vec || vec.length !== dim) continue
      // 同一哈希后写覆盖先写（追加日志的天然语义）
      this.entries.set(parsed.h, { vec, at: parsed.at })
    }
    this.stats.entries = this.entries.size
  }

  private appendLine(line: CacheLine): void {
    try {
      this.appendFile(this.cachePath, `${JSON.stringify(line)}\n`)
      this.lineCount++
      this.stats.writes++
    } catch (e) {
      if (!this.warnedWrite) {
        this.warnedWrite = true
        process.stderr.write(`[memory] embedding 缓存写入失败（本轮继续直连 provider）：${String((e as Error).message ?? e)}\n`)
      }
    }
  }

  /** 超出预算时压实：每个哈希只留最新一条，一次性原子替换。 */
  private pruneIfNeeded(): void {
    const overCount = this.entries.size > this.maxEntries
    const overBytes = this.lineCount * BYTES_PER_ENTRY_ESTIMATE > COMPACT_BYTES
    if (!overCount && !overBytes) return
    // 按最近使用时间淘汰；超预算时保留 maxEntries 条
    if (overCount) {
      const sorted = [...this.entries.entries()].sort((a, b) => b[1].at - a[1].at)
      this.entries = new Map(sorted.slice(0, this.maxEntries))
    }
    const lines: string[] = []
    const model = this.backing.modelName()
    const dim = this.backing.dimensions()
    for (const [h, item] of this.entries) {
      lines.push(JSON.stringify({ v: CACHE_VERSION, h, m: model, d: dim, e: encodeVector(item.vec), at: item.at } satisfies CacheLine))
    }
    try {
      this.writeFile(this.cachePath, lines.length > 0 ? `${lines.join('\n')}\n` : '')
      this.lineCount = lines.length
    } catch (e) {
      if (!this.warnedWrite) {
        this.warnedWrite = true
        process.stderr.write(`[memory] embedding 缓存压实失败（不影响检索）：${String((e as Error).message ?? e)}\n`)
      }
    }
  }
}

/** 无配置时的空实现：与直连 provider 完全一致，便于调用方始终拿到一个 provider。 */
export function withEmbeddingCache(provider: EmbeddingProvider, opts: EmbeddingCacheOptions = {}): EmbeddingProvider {
  if (!isCacheEnabled(opts)) return provider
  return new CachedEmbeddingProvider(provider, opts)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
