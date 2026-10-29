// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * Chromium LevelDB `.log`(WriteBatch 日志)手工编解码(2026-10-28 立,Loomy 写回配方装车)。
 *
 * 仓库无 leveldb 依赖,而 Loomy 的 localStorage 落点(%APPDATA%\Loomy\Local Storage\
 * leveldb\<n>.log)在客户端关闭时只是**一个待重放的日志文件**:LevelDB 打开时把
 * `.log` 里的记录按 (seq 降序, 键) 折进 memtable ⇒ 向活日志**追加一条更高 seq 的
 * WriteBatch** 就是客户端自己的读法(后写为准),不需要 SQLite/独占库/加密。
 *
 * 格式(leveldb-1.20 db/format.cc 口径,Chromium 内嵌同源):
 *   - 块 32768B;记录 = 头 7B(CRC32C-masked u32LE + 长度 u16LE + 类型 u8) + 载荷;
 *   - 类型 1=full 2=first 3=middle 4=last;跨块拆片,块尾不足 7B 零填充跳到块首;
 *   - CRC = mask(CRC32C([type字节] + 载荷)),mask = ((c>>15)|(c<<17)) + **0xa282ead8**
 *     (2026-10-28 按 leveldb-1.20 `util/crc32c.h:24` 改正;旧实现写成 0xa282ead3 差 5 ⇒
 *      本机 74 条真实日志记录**全部**校验不过(解析出 0 条),而我们自己写出的记录真客户端同样会拒收 ——
 *      自证自读两遍全绿、对真机全错)
 *   - WriteBatch 载荷 = seq u64LE + count u32LE + 每条目 [type][varint klen][key][varint vlen][value]
 *     (type 0x01=put 0x00=delete 只有 [varint klen][key];两段长度前缀**各自紧贴**其字节,
 *     判据单源 leveldb-1.20 write_batch.cc Iterate/GetLengthPrefixedSlice)。
 *   - DOM Storage 键 = `_file://` + \0 + \1 + 键名(提取器 anchor 实证);
 *     存储值 = **0x01 + utf8**(2026-10-28 用真实 LevelDB 实现读本机库改正:47 条真键逐条核过 ——
 *     `loomy:thinking-level` = 01 68 69 67 68("high")、`theme-mode` = 01 6C 69 67 68 74("light"),
 *     首位恒为 **0x01 类型标记**,后接原文;此前按"varint 长度前缀"实现,自证自读全绿而对真客户端是坏的)。
 *     元数据键 `META:file://` / `METAACCESS:file://` / `VERSION` 不动。
 *
 * 纯函数、零 IO、零凭据:解析全部按"读不出就如实丢"(坏头跳块、截断批次 parseBatch=null),
 * 与 §0.3「取不到输入不猜」一致。
 */

export const BLOCK_SIZE = 32768
export const HEADER_SIZE = 7
export const TYPE_FULL = 1
export const TYPE_FIRST = 2
export const TYPE_MIDDLE = 3
export const TYPE_LAST = 4

// ── CRC32C(Castagnoli,反射多项式 0x82F63B78,软件表)──────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0x82f63b78 : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

export function crc32c(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** 掩码常数唯一真值 = leveldb-1.20 util/crc32c.h 的 kMaskDelta(0xa282ead8,不是 …d3) */
export const CRC_MASK_DELTA = 0xa282ead8

export function maskCrc(c) {
  return ((((c >>> 15) | (c << 17)) + CRC_MASK_DELTA) >>> 0)
}

// ── varint(LEB128,无符号)───────────────────────────────────────────────────────
export function varintEnc(n) {
  let x = BigInt(n)
  if (x < 0n) throw new Error('varintEnc: 负数')
  const out = []
  while (x >= 0x80n) {
    out.push(Number(x & 0x7fn) | 0x80)
    x >>= 7n
  }
  out.push(Number(x))
  return Buffer.from(out)
}

/** 解不出(越界/超 64 位/截断)⇒ null,由调用方判"读不出" */
export function decodeVarint(buf, pos) {
  let value = 0n
  let shift = 0n
  let p = pos
  for (;;) {
    if (p >= buf.length) return null
    const b = buf[p++]
    value |= BigInt(b & 0x7f) << shift
    if ((b & 0x80) === 0) break
    shift += 7n
    if (shift > 63n) return null
  }
  return { value, next: p }
}

// ── DOM Storage 键/值编码 ─────────────────────────────────────────────────────
const LS_ANCHOR = Buffer.from('_file://\x00\x01', 'latin1')

/** localStorage 值键:`_file://` + \0 + \1 + 键名(与提取器 anchor 同判据) */
export function lsValueKey(name) {
  return Buffer.concat([LS_ANCHOR, Buffer.from(String(name), 'latin1')])
}

/**
 * 存储值 = 0x01 类型标记 + utf8 原文(Chromium DOM Storage 实测编码,见文件头注)。
 * 首字节就是标记本身,**不带长度**:老实现按 varint 长度前缀写,与本机 47 条真键全不一致。
 */
export const STORED_VALUE_TAG = 0x01

export function encodeStoredValue(str) {
  return Buffer.concat([Buffer.from([STORED_VALUE_TAG]), Buffer.from(String(str), 'utf8')])
}

export function decodeStoredValue(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return null
  if (buf[0] !== STORED_VALUE_TAG) return null // 未知类型标记 ⇒ 未判定,不猜内容
  return buf.subarray(1).toString('utf8')
}

// ── 物理记录:解析(块边界/分片/坏头按"读不出"跳块)────────────────────────────
/**
 * 扫描整份 .log,返回完整逻辑记录(分片已重组)。
 * 判读与 LevelDB reader 同口径:头落在块尾不足 7B ⇒ 跳下一块;全零头 ⇒ 零填充跳块;
 * 头声明长度越出块/文件 ⇒ 视为坏头跳块;CRC 不符 ⇒ 丢在途分片并跳块。
 */
export function parseLogRecords(buf) {
  const records = []
  let frag = null
  let pos = 0
  while (pos + HEADER_SIZE <= buf.length) {
    const blockLeft = BLOCK_SIZE - (pos % BLOCK_SIZE)
    if (blockLeft < HEADER_SIZE) {
      pos += blockLeft
      continue
    }
    const crc = buf.readUInt32LE(pos)
    const len = buf.readUInt16LE(pos + 4)
    const type = buf[pos + 6]
    if (crc === 0 && len === 0 && type === 0) {
      pos += blockLeft
      continue
    }
    if (len + HEADER_SIZE > blockLeft || pos + HEADER_SIZE + len > buf.length) {
      pos += blockLeft
      continue
    }
    const payload = buf.subarray(pos + HEADER_SIZE, pos + HEADER_SIZE + len)
    const check = maskCrc(crc32c(Buffer.concat([Buffer.from([type]), payload])))
    if (check !== crc) {
      frag = null
      pos += HEADER_SIZE + len
      continue
    }
    if (type === TYPE_FULL) {
      records.push({ payload })
    } else if (type === TYPE_FIRST) {
      frag = [payload]
    } else if (type === TYPE_MIDDLE) {
      if (frag) frag.push(payload)
    } else if (type === TYPE_LAST) {
      if (frag) {
        records.push({ payload: Buffer.concat([...frag, payload]) })
        frag = null
      }
    }
    pos += HEADER_SIZE + len
  }
  return records
}

// ── WriteBatch:解/编 ─────────────────────────────────────────────────────────
/** 载荷解不成合法批次(长度不足/类型字节未知/截断)⇒ null,不猜 */
export function parseBatch(payload) {
  if (!Buffer.isBuffer(payload) || payload.length < 12) return null
  const seq = payload.readBigUInt64LE(0)
  const count = payload.readUInt32LE(8)
  let pos = 12
  const entries = []
  for (let i = 0; i < count; i++) {
    if (pos >= payload.length) return null
    const t = payload[pos++]
    const k = decodeVarint(payload, pos)
    if (!k) return null
    pos = k.next
    const klen = Number(k.value)
    if (!Number.isSafeInteger(klen) || pos + klen > payload.length) return null
    const key = payload.subarray(pos, pos + klen)
    pos += klen
    if (t === 0) {
      entries.push({ type: 0, key, value: null })
      continue
    }
    if (t !== 1) return null
    const v = decodeVarint(payload, pos)
    if (!v) return null
    pos = v.next
    const vlen = Number(v.value)
    if (!Number.isSafeInteger(vlen) || pos + vlen > payload.length) return null
    entries.push({ type: 1, key, value: payload.subarray(pos, pos + vlen) })
    pos += vlen
  }
  return { seq, count, entries }
}

/** entries: [{key:Buffer|string, value:Buffer|string|null}] ⇒ 载荷(写回端只用 put) */
export function buildBatch(seq, entries) {
  const parts = [Buffer.alloc(12)]
  parts[0].writeBigUInt64LE(BigInt(seq), 0)
  parts[0].writeUInt32LE(entries.length, 8)
  for (const e of entries) {
    const key = Buffer.isBuffer(e.key) ? e.key : Buffer.from(String(e.key), 'latin1')
    if (e.type === 0 || e.value === null || e.value === undefined) {
      parts.push(Buffer.from([0]), varintEnc(key.length), key)
      continue
    }
    const value = Buffer.isBuffer(e.value) ? e.value : Buffer.from(String(e.value), 'utf8')
    parts.push(Buffer.from([1]), varintEnc(key.length), key, varintEnc(value.length), value)
  }
  return Buffer.concat(parts)
}

function emitRecord(type, payload) {
  const head = Buffer.alloc(HEADER_SIZE)
  head.writeUInt32LE(maskCrc(crc32c(Buffer.concat([Buffer.from([type]), payload]))), 0)
  head.writeUInt16LE(payload.length, 4)
  head[6] = type
  return Buffer.concat([head, payload])
}

/**
 * 把若干逻辑记录追加到既有日志缓冲之后,返回**整份新内容**(调用方负责原子落盘)。
 * 块尾处理与 LevelDB writer 同口径:不足 7B ⇒ 零填充换块;放不下 ⇒ first/middle/last 拆片。
 */
export function appendRecords(buf, payloads) {
  const out = [buf]
  let pos = buf.length
  for (const p of payloads) {
    let left = BLOCK_SIZE - (pos % BLOCK_SIZE)
    if (left < HEADER_SIZE) {
      out.push(Buffer.alloc(left))
      pos += left
      left = BLOCK_SIZE
    }
    if (left >= HEADER_SIZE + p.length) {
      out.push(emitRecord(TYPE_FULL, p))
      pos += HEADER_SIZE + p.length
      continue
    }
    // 跨块拆片
    let frag = p
    let first = true
    for (;;) {
      const avail = left - HEADER_SIZE
      const take = Math.min(avail, frag.length)
      const last = take >= frag.length
      const type = first ? TYPE_FIRST : last ? TYPE_LAST : TYPE_MIDDLE
      out.push(emitRecord(type, frag.subarray(0, take)))
      pos += HEADER_SIZE + take
      frag = frag.subarray(take)
      first = false
      left = BLOCK_SIZE
      if (last) break
    }
  }
  return Buffer.concat(out)
}

/**
 * 按客户端读法取键的最新存储值:重放全部批次,后写为准(删除 ⇒ 清空)。
 * 返回**带 varint 长度前缀**的原始存储字节;键从未出现 ⇒ null。
 */
export function latestStoredValue(buf, keyBuf) {
  let found = null
  for (const r of parseLogRecords(buf)) {
    const b = parseBatch(r.payload)
    if (!b) continue
    for (const e of b.entries) {
      if (!e.key.equals(keyBuf)) continue
      found = e.type === 1 ? e.value : null
    }
  }
  return found
}

/** 现批次流里的最大 seq(空日志 ⇒ 0n);新批次 seq = 此值 + 1 */
export function maxBatchSeq(buf) {
  let max = 0n
  for (const r of parseLogRecords(buf)) {
    const b = parseBatch(r.payload)
    if (b && b.seq > max) max = b.seq
  }
  return max
}

// ── sstable(.ldb)读取:压缩块 ⇒ 只扫日志会"看不见已登录态"(2026-10-28 实测)─────────
/**
 * 立因是现读的缺陷,不是补全:本机 Loomy 库 47 条键里 `loomy-auth-session` 确实在(167 字节),
 * 但它在 `000005.ldb` 的**压缩块**里 —— 明文逐字节扫 .ldb 也搜不到键名 ⇒ 提取器报
 * 「命中 0 条候选键 / 未登录」,而客户端明明登录着。故必须按 sst 格式读:footer → index block
 * → data blocks(块尾 5 字节 trailer:1 类型 + 4 CRC;类型 1 = snappy)。
 * 内部键尾部 8 字节 = (seq << 8) | type(type 1=put 0=delete),读出来的用户键要去掉这 8 字节。
 */
export function snappyDecompress(src) {
  const head = decodeVarint(src, 0)
  if (!head) throw new Error('snappy: 长度头读不出')
  const out = Buffer.alloc(Number(head.value))
  let pos = head.next
  let op = 0
  while (pos < src.length) {
    const tag = src[pos++]
    const t = tag & 0x03
    if (t === 0) {
      let len = tag >>> 2
      if (len < 60) len += 1
      else {
        const extra = len - 59
        len = 0
        for (let i = 0; i < extra; i++) len |= src[pos++] << (8 * i)
        len += 1
      }
      src.copy(out, op, pos, pos + len)
      pos += len
      op += len
      continue
    }
    let len
    let offset
    if (t === 1) {
      len = ((tag >>> 2) & 0x07) + 4
      offset = ((tag >>> 5) << 8) | src[pos++]
    } else if (t === 2) {
      len = (tag >>> 2) + 1
      offset = src[pos] | (src[pos + 1] << 8)
      pos += 2
    } else {
      len = (tag >>> 2) + 1
      offset = src.readUInt32LE(pos)
      pos += 4
    }
    if (offset <= 0 || offset > op) throw new Error(`snappy: 回溯偏移越界(${offset})`)
    for (let i = 0; i < len; i++, op++) out[op] = out[op - offset]
  }
  if (op !== out.length) throw new Error('snappy: 解出长度与头不符')
  return out
}

const SST_MAGIC = 0xdb4775248b80fb57n

function readBlockHandle(buf, pos) {
  const off = decodeVarint(buf, pos)
  if (!off) throw new Error('sst: block handle 偏移读不出')
  const size = decodeVarint(buf, off.next)
  if (!size) throw new Error('sst: block handle 长度读不出')
  return { offset: Number(off.value), size: Number(size.value), next: size.next }
}

function readBlock(buf, { offset, size }) {
  if (offset < 0 || size < 0 || offset + size + 5 > buf.length) throw new Error('sst: 块越界')
  const type = buf[offset + size]
  const raw = buf.subarray(offset, offset + size)
  if (type === 0) return raw
  if (type === 1) return snappyDecompress(raw)
  throw new Error(`sst: 不支持的块压缩类型 ${type}`)
}

/** 块内条目:varint(共享前缀长)+varint(独有长)+varint(值长)+键差+值;尾部是重启点数组 */
function parseBlockEntries(block) {
  if (block.length < 4) return []
  const restarts = block.readUInt32LE(block.length - 4)
  const limit = block.length - 4 - restarts * 4
  if (limit < 0) throw new Error('sst: 重启点数组越界')
  const out = []
  let pos = 0
  let key = Buffer.alloc(0)
  while (pos < limit) {
    const shared = decodeVarint(block, pos)
    if (!shared) throw new Error('sst: 共享前缀长读不出')
    const nonShared = decodeVarint(block, shared.next)
    if (!nonShared) throw new Error('sst: 独有长读不出')
    const vlen = decodeVarint(block, nonShared.next)
    if (!vlen) throw new Error('sst: 值长读不出')
    const s = Number(shared.value)
    const n = Number(nonShared.value)
    const v = Number(vlen.value)
    pos = vlen.next
    if (s > key.length || pos + n + v > block.length) throw new Error('sst: 条目越界')
    key = Buffer.concat([key.subarray(0, s), block.subarray(pos, pos + n)])
    pos += n
    out.push({ key, value: block.subarray(pos, pos + v) })
    pos += v
  }
  return out
}

/** 读一份 .ldb:返回内部键条目 [{key(带 8 字节尾), value}] */
export function readSstable(buf) {
  if (buf.length < 48) throw new Error('sst: 文件过短')
  const footer = buf.subarray(buf.length - 48)
  if (footer.readBigUInt64LE(40) !== SST_MAGIC) throw new Error('sst: 魔数不符')
  // footer = metaindex handle + index handle + 填充 + 魔数;两条 handle 顺序固定
  const meta = readBlockHandle(footer, 0)
  const index = readBlockHandle(footer, meta.next)
  const out = []
  for (const { value } of parseBlockEntries(readBlock(buf, index))) {
    const h = readBlockHandle(value, 0)
    out.push(...parseBlockEntries(readBlock(buf, h)))
  }
  return out
}

/**
 * 读整个 LevelDB 目录的**用户键 ⇒ 值**(后写为准):sst 与 log 按文件号升序叠加,
 * 内部键的 8 字节尾解出 (seq, type),type 0 = 删除。
 * 任何一份文件读不出 ⇒ 只跳过该文件并在 skipped 点名(不猜内容);全读不出 ⇒ 返回空 Map,
 * 由调用方判"未判定"。
 */
export function readLevelDbEntries(dir, fsMod, pathMod) {
  const out = new Map()
  /** 每键当前生效的 seq:sst 块里同键多版本按 seq **降序**排列(内部键序 = 用户键升序,seq 降序),
   *  按块序叠加时后到的旧版本会覆盖新版本 ⇒ 必须比 seq,不能只比先后(2026-10-28 实测:
   *  不比 seq 时 4 个已删键复活、2 个键读成更长的旧值)。 */
  const seqOf = new Map()
  const put = (key, seq, type, value) => {
    const prev = seqOf.get(key)
    if (prev !== undefined && seq < prev) return
    if (prev === seq) return
    seqOf.set(key, seq)
    if (type === 0) out.delete(key)
    else out.set(key, value)
  }
  const skipped = []
  const files = fsMod
    .readdirSync(dir)
    .filter((f) => /^\d+\.(ldb|log)$/.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  for (const f of files) {
    const full = pathMod.join(dir, f)
    if (f.endsWith('.ldb')) {
      let entries
      try {
        entries = readSstable(fsMod.readFileSync(full))
      } catch (e) {
        skipped.push(`${f}: ${e instanceof Error ? e.message : String(e)}`)
        continue
      }
      for (const { key, value } of entries) {
        if (key.length <= 8) continue
        const trailer = key.readBigUInt64LE(key.length - 8)
        put(key.subarray(0, key.length - 8).toString('latin1'), trailer >> 8n, Number(trailer & 0xffn), value)
      }
      continue
    }
    let buf
    try {
      buf = fsMod.readFileSync(full)
    } catch (e) {
      skipped.push(`${f}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    for (const rec of parseLogRecords(buf)) {
      const batch = parseBatch(rec.payload)
      if (!batch) continue
      // 批次里的 seq 逐条递增(leveldb write_batch.cc:seq + i),删除同样占一个序号
      batch.entries.forEach((e, i) => {
        put(e.key.toString('latin1'), batch.seq + BigInt(i), e.type, e.value)
      })
    }
  }
  return { entries: out, skipped }
}
