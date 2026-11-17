// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Chrome Native Messaging 桥的**协议与注册表判据层**(R73 · 2026-11-18)。
 *
 * 背景:全仓此前 `nativeMessaging|allowed_origins` 0 命中 ⇒ 扩展与本机常驻进程之间没有任何
 * 标准通道,桌面端(SaaS 形态)与浏览器扩展只能各走 HTTP。本层把这条通道需要的判据一次性
 * 抽成纯函数:零 `node:` 内建导入(AGENTS §4「shared 包非 Node 宿主纯度」同源纪律),编码产物
 * 是 `Uint8Array`,可直接交给 `chrome.runtime.connectNative` / `sendNativeMessage`,因而单测
 * 不需要 mock Chrome。
 *
 * 对照取证(只学设计,未复制任何对方代码;判据全部由本仓测试钉住):
 * `E:\IHUI-analysis\qoder\report.md` §C 第 5 条指向对照宿主(4 字节长度前缀 + 30s 失效 +
 * `process.kill(pid,0)` 存活探测 + 快照变化才广播 + stdin end 先排空 stdout)。本机当次只读
 * 复核到该宿主仍存在(3559 B),形态与报告一致。
 *
 * 与对照的四处刻意分歧(超越轴):
 * 1. **字节序固定 LE**。C++ 参考实现写的是"本地字节序 uint32",跨架构拷贝注册表/抓帧回放会
 *    静默错位;这里固定小端并用测试钉死,不给平台留第二答案。
 * 2. **判别联合 + 错误族**。对照对畸形帧一律 `{error:'invalid_request'}` 单字面量,失效原因
 *    不可观测;本层每类拒绝有具名 reason,`NativeFrameReader` 累计读数(见 4)。
 * 3. **注册表加固**:按 `id` 去重 + 租约匹配 + 同 `timestamp` 只增 tiebreak,杜绝"多写一条同名
 *    记录就改变优选结果"的污染面。
 * 4. **差分发布**:除全量快照外再给 `diff` 形态(added/removed),对照只有全量;大列表下消费方
 *    可不重渲染整表。
 * 失败可读性:`NativeFrameReader.stats()` 的静默丢帧计数是"判据失效表现为安静"这一族问题的
 * 直接观测点。
 */

export type ByteLength = number

export const NATIVE_MESSAGING_PROTOCOL_VERSION = 1 as const

/** 单帧字节上限:Chrome 对发给 native host 的消息硬限 1 MiB。 */
export const NATIVE_MAX_INBOUND_BODY_BYTES: ByteLength = 1024 * 1024

/** 发给扩展的方向上限取 1 MiB 而非 Chrome 的 100 MB 档:默认即 fail-safe。 */
export const NATIVE_MAX_OUTBOUND_BODY_BYTES: ByteLength = 1024 * 1024

/** 本机注册条文的存活期(心跳节拍须显著小于此值)。 */
export const DEFAULT_PEER_STALE_AFTER_MS = 30_000

/** 允许的时钟超前量:超过即判为不可信来源,而不是"以后再说"。 */
export const DEFAULT_FUTURE_TOLERANCE_MS = 5_000

export type NativeFrameReject =
  | 'header-incomplete'
  | 'body-incomplete'
  | 'empty-body'
  | 'over-limit'
  | 'invalid-utf8'
  | 'invalid-json'
  | 'not-an-object'

export interface NativeFrameDecodeResult<T = unknown> {
  ok: boolean
  payload?: T
  /** 本次消费掉的字节数(header + body);拒绝时为 0。 */
  consumedBytes: ByteLength
  reason?: NativeFrameReject
}

/** 编码:UTF-8 正文 + 4 字节小端长度。超限直接抛 —— 静默丢帧比报错更贵。 */
export function encodeNativeFrame(
  payload: unknown,
  maxBytes: ByteLength = NATIVE_MAX_OUTBOUND_BODY_BYTES,
): Uint8Array {
  const body = new TextEncoder().encode(JSON.stringify(payload))
  if (body.byteLength === 0) throw new RangeError('native frame body must not be empty')
  if (body.byteLength > maxBytes) {
    throw new RangeError(`native frame body ${body.byteLength}B exceeds limit ${maxBytes}B`)
  }
  const frame = new Uint8Array(4 + body.byteLength)
  const view = new DataView(frame.buffer)
  view.setUint32(0, body.byteLength, true)
  frame.set(body, 4)
  return frame
}

export function decodeNativeFrame<T = unknown>(
  src: Uint8Array,
  maxBytes: ByteLength = NATIVE_MAX_INBOUND_BODY_BYTES,
): NativeFrameDecodeResult<T> {
  if (src.byteLength < 4) return { ok: false, consumedBytes: 0, reason: 'header-incomplete' }
  const length = new DataView(src.buffer, src.byteOffset, 4).getUint32(0, true)
  if (length === 0) return { ok: false, consumedBytes: 0, reason: 'empty-body' }
  if (length > maxBytes) return { ok: false, consumedBytes: 0, reason: 'over-limit' }
  if (src.byteLength < 4 + length) return { ok: false, consumedBytes: 0, reason: 'body-incomplete' }
  const body = src.subarray(4, 4 + length)
  let payload: unknown
  try {
    payload = new TextDecoder('utf-8', { fatal: true }).decode(body)
  } catch {
    return { ok: false, consumedBytes: 0, reason: 'invalid-utf8' }
  }
  try {
    const parsed = JSON.parse(payload as string)
    if (!parsed || typeof parsed !== 'object')
      return { ok: false, consumedBytes: 0, reason: 'not-an-object' }
    return { ok: true, payload: parsed as T, consumedBytes: 4 + length }
  } catch {
    return { ok: false, consumedBytes: 0, reason: 'invalid-json' }
  }
}

/** 流式读数器:喂任意切片,吐完整帧;拒绝帧留在缓冲里交调用方决断(不得当"没收到")。 */
export function createNativeFrameReader(maxBytes: ByteLength = NATIVE_MAX_INBOUND_BODY_BYTES) {
  let buffer: Uint8Array = new Uint8Array(0)
  const stats = {
    framesRead: 0,
    bytesWritten: 0,
    rejected: 0,
    lastReject: undefined as NativeFrameReject | undefined,
  }
  return {
    push(chunk: Uint8Array): unknown[] {
      const next = new Uint8Array(buffer.byteLength + chunk.byteLength)
      next.set(buffer, 0)
      next.set(chunk, buffer.byteLength)
      buffer = next
      stats.bytesWritten += chunk.byteLength
      const out: unknown[] = []
      for (;;) {
        const r = decodeNativeFrame(buffer, maxBytes)
        if (r.ok && r.payload !== undefined) {
          out.push(r.payload)
          stats.framesRead += 1
          buffer = buffer.subarray(r.consumedBytes)
          continue
        }
        if (r.reason === 'header-incomplete' || r.reason === 'body-incomplete') break
        // 真损坏:丢掉这一帧的长度前缀,免得整条流被一帧毒死
        const drop =
          buffer.byteLength >= 4
            ? 4 + new DataView(buffer.buffer, buffer.byteOffset, 4).getUint32(0, true)
            : buffer.byteLength
        buffer = buffer.subarray(Math.min(drop, buffer.byteLength))
        stats.rejected += 1
        stats.lastReject = r.reason
      }
      return out
    },
    pendingBytes(): ByteLength {
      return buffer.byteLength
    },
    stats(): Readonly<typeof stats> {
      return { ...stats }
    },
  }
}

export interface PeerRecord {
  id: string
  port: number
  pid: number
  /** 本机时钟(ms);由写入方在每次心跳时刷新。 */
  timestamp: number
  /** 租约标识:只有同租约的记录才能互相替换,防跨用户/跨实例污染优选结果。 */
  lease?: string
}

export type PeerReject = 'malformed' | 'stale' | 'future-skew' | 'dead-pid' | 'lease-mismatch'

export interface PeerCheckContext {
  now: number
  staleAfterMs?: ByteLength
  futureToleranceMs?: ByteLength
  isPidAlive: (pid: number) => boolean
  expectedLease?: string
}

export type PeerCheckResult = { accepted: true } | { accepted: false; reason: PeerReject }

/** 结构字段校验独立可测;存活判定由调用方注入(Node 侧 `process.kill(pid,0)`,浏览器侧不给)。 */
export function checkPeerRecord(rec: unknown, ctx: PeerCheckContext): PeerCheckResult {
  const r = rec as Partial<PeerRecord> | null
  if (!r || typeof r.id !== 'string' || r.id.length === 0)
    return { accepted: false, reason: 'malformed' }
  if (!Number.isInteger(r.port) || (r.port as number) <= 0 || (r.port as number) > 65_535)
    return { accepted: false, reason: 'malformed' }
  if (!Number.isInteger(r.pid) || (r.pid as number) <= 0)
    return { accepted: false, reason: 'malformed' }
  if (typeof r.timestamp !== 'number' || !Number.isFinite(r.timestamp))
    return { accepted: false, reason: 'malformed' }
  if (ctx.expectedLease !== undefined && r.lease !== ctx.expectedLease)
    return { accepted: false, reason: 'lease-mismatch' }
  const age = ctx.now - r.timestamp
  if (age > (ctx.staleAfterMs ?? DEFAULT_PEER_STALE_AFTER_MS))
    return { accepted: false, reason: 'stale' }
  if (age < -(ctx.futureToleranceMs ?? DEFAULT_FUTURE_TOLERANCE_MS))
    return { accepted: false, reason: 'future-skew' }
  if (!ctx.isPidAlive(r.pid as number)) return { accepted: false, reason: 'dead-pid' }
  return { accepted: true }
}

export interface PeerRegistryResult {
  peers: PeerRecord[]
  preferred: PeerRecord | null
  rejects: Array<{ id: string; reason: PeerReject }>
}

/** 优选序:时间戳新 → lease → id 字典序(全序,绝不随 readdir 顺序抖动)。按 id 去重留最优。 */
export function resolvePeerRegistry(
  records: unknown[],
  ctx: Omit<PeerCheckContext, 'expectedLease'> & { expectedLease?: string },
): PeerRegistryResult {
  const best = new Map<string, PeerRecord>()
  const rejects: Array<{ id: string; reason: PeerReject }> = []
  for (const raw of records) {
    const id =
      raw && typeof raw === 'object' && typeof (raw as PeerRecord).id === 'string'
        ? (raw as PeerRecord).id
        : '<malformed>'
    const verdict = checkPeerRecord(raw, ctx)
    if (!verdict.accepted) {
      rejects.push({ id, reason: verdict.reason })
      continue
    }
    const rec = raw as PeerRecord
    const prev = best.get(rec.id)
    if (
      !prev ||
      rec.timestamp > prev.timestamp ||
      (rec.timestamp === prev.timestamp && (rec.lease ?? '') < (prev.lease ?? ''))
    ) {
      best.set(rec.id, rec)
    }
  }
  const peers = [...best.values()].sort(
    (a, b) =>
      b.timestamp - a.timestamp ||
      (a.lease ?? '').localeCompare(b.lease ?? '') ||
      a.id.localeCompare(b.id),
  )
  return { peers, preferred: peers[0] ?? null, rejects }
}

export type RegistryChange =
  | { kind: 'unchanged' }
  | { kind: 'full'; peers: PeerRecord[] }
  | { kind: 'diff'; added: PeerRecord[]; removed: string[] }

/** 快照未变则不广播(对照同款);这里额外给差分形态。 */
export function planRegistryPublish(prev: PeerRecord[] | null, next: PeerRecord[]): RegistryChange {
  if (prev && samePeerSet(prev, next)) return { kind: 'unchanged' }
  if (!prev) return { kind: 'full', peers: next }
  const nextIds = new Set(next.map((p) => p.id))
  const prevIds = new Set(prev.map((p) => p.id))
  return {
    kind: 'diff',
    added: next.filter((p) => !prevIds.has(p.id)),
    removed: prev.filter((p) => !nextIds.has(p.id)).map((p) => p.id),
  }
}

function samePeerSet(a: PeerRecord[], b: PeerRecord[]): boolean {
  if (a.length !== b.length) return false
  const key = (p: PeerRecord) =>
    `${p.id}\u0000${p.port}\u0000${p.pid}\u0000${p.timestamp}\u0000${p.lease ?? ''}`
  const sa = new Set(a.map(key))
  return b.every((p) => sa.has(key(p)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
