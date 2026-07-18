/**
 * P44-3 String Interner(arena-based,0 依赖)。
 *
 * 灵感来源:参考 xai-codebase-graph/src/interner.rs(全文 305 行)
 * 简化策略(做减法):
 *   - 0 依赖:用 64-bit FNV-1a hash 替代 rustc_hash::FxHasher
 *   - arena:连续 Uint8Array 存所有字符串字节
 *   - offsets:Uint32Array(start) + Uint16Array(len) 二元组紧凑
 *   - collision chain:每个 hash bucket 是 id 数组(常见 0-1 碰撞,数组复用)
 *   - from_parts/to_parts:支持持久化(可写到 JSON)
 *
 * 使用场景:
 *   - codegraph/index.ts:把 symbol/path 字符串驻留,O(1) 比较代替字符串比较
 *   - 大量重复 token 的 LLM 输出解析(函数名/类名高频重复)
 *   - 大型 monorepo 索引(>10k 文件,内存可省 30-60%)
 */

const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK_64 = 0xffffffffffffffffn

/**
 * 64-bit FNV-1a hash(碰撞率比 32-bit 低 4×,与 StringId u32 hash bucket 配合良好)。
 */
function fnv1a64(bytes: Uint8Array): bigint {
  let h = FNV_OFFSET
  for (let i = 0; i < bytes.length; i++) {
    h = (h ^ BigInt(bytes[i]!)) & MASK_64
    h = (h * FNV_PRIME) & MASK_64
  }
  return h
}

function encodeUtf8(s: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(s)
  }
  // 兜底:Node 20+ 都有 TextEncoder,这里仅做类型完整性
  const out: number[] = []
  for (let i = 0; i < s.length; i++) {
    let cp = s.charCodeAt(i)
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < s.length) {
      const low = s.charCodeAt(i + 1)
      if (low >= 0xdc00 && low <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00)
        i += 1
      }
    }
    if (cp < 0x80) {
      out.push(cp)
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      )
    }
  }
  return new Uint8Array(out)
}

/** Intern 后的字符串 id(只读数值,不可跨实例复用) */
export class StringId {
  constructor(public readonly value: number) {}

  toString(): string {
    return `#${this.value}`
  }

  equals(other: StringId): boolean {
    return this.value === other.value
  }
}

interface BucketEntry {
  hashHi: number // bigint 高 32 位(用作 Map key)
  hashLo: number
  ids: number[]
}

/**
 * Arena-based string interner。
 * - intern:返回 id,O(1) 均摊(常见 0-1 碰撞)
 * - getBytes:按 id 取 UTF-8 字节,O(1)
 * - getString:按 id 取 string(解码 UTF-8)
 * - getId:不 intern 直接查 O(1) 命中
 *
 * 内存:每个 id 8 字节(4+4);arena 按需追加;bucket 数组按碰撞数伸缩
 */
export class StringInterner {
  private arena: number[] = []
  private arenaLen = 0
  /** (start, len) 二元组 */
  private offsets: Array<[number, number]> = []
  /** Map<hashHi * 2^32 + hashLo, BucketEntry>;Map 接受 number key */
  private lookup = new Map<number, BucketEntry>()

  /** 驻留一个 string,返回 id(同 string 同 id) */
  intern(s: string): StringId {
    const bytes = encodeUtf8(s)
    return this.internBytes(bytes)
  }

  /** 驻留一段 UTF-8 字节(允许非字符串字节,如路径/二进制) */
  internBytes(bytes: Uint8Array): StringId {
    const hash = fnv1a64(bytes)
    const hashHi = Number((hash >> 32n) & 0xffffffffn)
    const hashLo = Number(hash & 0xffffffffn)
    const bucketKey = hashHi * 0x100000000 + hashLo

    const existing = this.lookup.get(bucketKey)
    if (existing) {
      // 碰撞:全字符串比较
      for (const id of existing.ids) {
        if (this.bytesEqualAt(id, bytes)) {
          return new StringId(id)
        }
      }
    }
    // 未命中:追加到 arena
    const start = this.arenaLen
    for (let i = 0; i < bytes.length; i++) {
      this.arena.push(bytes[i]!)
    }
    this.arenaLen = start + bytes.length
    const id = this.offsets.length
    this.offsets.push([start, bytes.length])
    if (existing) {
      existing.ids.push(id)
    } else {
      this.lookup.set(bucketKey, { hashHi, hashLo, ids: [id] })
    }
    return new StringId(id)
  }

  /** 不驻留,直接查(命中返回 id,未命中返回 null) */
  getId(s: string): StringId | null {
    return this.getBytesId(encodeUtf8(s))
  }

  getBytesId(bytes: Uint8Array): StringId | null {
    const hash = fnv1a64(bytes)
    const hashHi = Number((hash >> 32n) & 0xffffffffn)
    const hashLo = Number(hash & 0xffffffffn)
    const bucketKey = hashHi * 0x100000000 + hashLo
    const existing = this.lookup.get(bucketKey)
    if (!existing) return null
    for (const id of existing.ids) {
      if (this.bytesEqualAt(id, bytes)) return new StringId(id)
    }
    return null
  }

  /** 按 id 取 UTF-8 字节(拷贝视图;arena 是 number[] 不能零拷贝) */
  getBytes(id: StringId): Uint8Array | null {
    const off = this.offsets[id.value]
    if (!off) return null
    return new Uint8Array(this.arena.slice(off[0], off[0] + off[1]))
  }

  /** 按 id 取 string(解码 UTF-8) */
  getString(id: StringId): string | null {
    const bytes = this.getBytes(id)
    if (!bytes) return null
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  }

  /** 当前驻留条目数 */
  size(): number {
    return this.offsets.length
  }

  /** 当前 arena 字节数 */
  byteSize(): number {
    return this.arenaLen
  }

  /** 序列化(给 from_parts 用) */
  toParts(): { arena: Uint8Array; offsets: Array<[number, number]> } {
    return {
      arena: new Uint8Array(this.arena),
      offsets: this.offsets.map(([s, l]) => [s, l] as [number, number]),
    }
  }

  /** 从序列化部分重建(lookup 重建是 O(n) — 重新计算 hash) */
  static fromParts(parts: { arena: Uint8Array; offsets: Array<[number, number]> }): StringInterner {
    const i = new StringInterner()
    i.arena = Array.from(parts.arena)
    i.arenaLen = parts.arena.length
    i.offsets = parts.offsets.map(([s, l]) => [s, l] as [number, number])
    // 重建 lookup
    for (let id = 0; id < i.offsets.length; id++) {
      const [start, len] = i.offsets[id]!
      const bytes = new Uint8Array(parts.arena.buffer, start, len)
      const hash = fnv1a64(bytes)
      const hashHi = Number((hash >> 32n) & 0xffffffffn)
      const hashLo = Number(hash & 0xffffffffn)
      const bucketKey = hashHi * 0x100000000 + hashLo
      const existing = i.lookup.get(bucketKey)
      if (existing) {
        existing.ids.push(id)
      } else {
        i.lookup.set(bucketKey, { hashHi, hashLo, ids: [id] })
      }
    }
    return i
  }

  private bytesEqualAt(id: number, other: Uint8Array): boolean {
    const [start, len] = this.offsets[id]!
    if (len !== other.length) return false
    for (let i = 0; i < len; i++) {
      if (this.arena[start + i] !== other[i]) return false
    }
    return true
  }
}
