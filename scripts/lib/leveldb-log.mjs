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
 *   - CRC = mask(CRC32C([type字节] + 载荷)),mask = ((c>>15)|(c<<17)) + 0xa282ead3;
 *   - WriteBatch 载荷 = seq u64LE + count u32LE + 每条目 [type][varint klen][key][varint vlen][value]
 *     (type 0x01=put 0x00=delete 只有 [varint klen][key];两段长度前缀**各自紧贴**其字节,
 *     判据单源 leveldb-1.20 write_batch.cc Iterate/GetLengthPrefixedSlice)。
 *   - DOM Storage 键 = `_file://` + \0 + \1 + 键名(提取器 anchor 实证);
 *     存储值 = varint(字节长) + utf8。元数据键 `_file://\0\0`(origin 总大小)不动。
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

export function maskCrc(c) {
  return ((((c >>> 15) | (c << 17)) + 0xa282ead3) >>> 0)
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

/** 存储值 = varint(字节长) + utf8 */
export function encodeStoredValue(str) {
  const s = String(str)
  const utf = Buffer.from(s, 'utf8')
  return Buffer.concat([varintEnc(utf.length), utf])
}

export function decodeStoredValue(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return null
  const len = decodeVarint(buf, 0)
  if (!len) return null
  const start = len.next
  const n = Number(len.value)
  if (!Number.isSafeInteger(n) || start + n > buf.length) return null
  return buf.subarray(start, start + n).toString('utf8')
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
