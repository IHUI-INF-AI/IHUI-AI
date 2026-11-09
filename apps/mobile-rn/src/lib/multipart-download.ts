// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * multipart-download.ts — 从 Gitee「多分片」并行下载整包(2026-11-05 立)。
 *
 * 为什么要有它(2026-11-05 同机同网实测,不是推测):
 *   - 站点腿(EdgeOne 免费版)有**套餐吞吐硬顶**:h1 4 连接 4.5–6.4 MB/s,加到 16/24 连接
 *     仍是 ≈4.9 MB/s —— 加并发不再产出任何吞吐,这不是客户端能解的;
 *   - Gitee 单文件**不认 Range**(`Range` 探针回 200 整包 + Content-Length 83310445),
 *     但多连接线性叠加:1/4/8 连接 = 1.92 / 7.23 / 15.36 MB/s,没有 per-IP 封顶;
 *   - 本机出口基准(清华镜像)8 连接 65 MB/s ⇒ 15 MB/s 还远没摸到用户带宽上限。
 * 结论:不花钱想再快,唯一可动的变量是「把一条连接变成 N 条独立连接」。Range 分片做不到
 * (服务端不认),所以在**发布侧把 APK 切成 N 份独立文件**,客户端 8 路并发各拉一份,
 * 用 FileHandle 定位写拼回同一个文件 —— 每份都是一次普通 GET,不需要 Range。
 *
 * 与 ranged-download.ts 的分工(别混):
 *   - ranged-download:单文件 + `Range: bytes=…`,解决的是「单连接慢、但服务端认 Range」;
 *   - 本模块:多文件 + 多连接,解决的是「服务端不认 Range / 套餐把单条连接卡死」。
 *
 * 三条红线(与整包更新同源):
 *   1. **不静默降级**:清单读不到 / 版本不符 / 体积对不上,一律抛错,由 apk-update 退回单文件腿;
 *   2. **不隐瞒速度**:进度回调带 4 秒滚动窗口的 bytesPerSecond,UI 才能说真话;
 *   3. **不留半包**:清单总字节与实际落盘字节不符即报错,绝不把残包交给安装器。
 *
 * 体积口径由**清单**给出,不靠 Content-Length 猜:分片是独立附件,各自长度本来就不同,
 * 只有清单里的 `totalBytes` + 每份 `size` 才能把"拼出来的包"和"服务端要发的包"对齐。
 */

import { File, FileMode } from 'expo-file-system'
import { createSpeedMeter, DownloadCancellation, DownloadCancelledError } from './ranged-download'

/** 8 路是实测档:Gitee 8 连接 15.36 MB/s 已接近本机出口的一半,再堆只增内存峰值。 */
const DEFAULT_PARTS_CONCURRENCY = 8
/** 首字节看门狗:30s 内一个字节都没到货 ⇒ 撤单回退(Gitee 实测 TTFB 0.32s)。 */
const DEFAULT_PARTS_STALL_TIMEOUT_MS = 30_000
/** 分片份数上限:64 份足够覆盖 85–200MB 的包,也防止清单被塞进几千条请求。 */
const MAX_PARTS = 64
const MAX_PART_ATTEMPTS = 3
const RETRY_BASE_MS = 600
const SPEED_WINDOW_MS = 4000
/** 单份重试时的速率下限:按它折算 XHR 超时,低于它就没必要继续等。 */
const FLOOR_BYTES_PER_SECOND = 30 * 1024
/** 官网签名 APK 的体积下限(与 apk-download-legs 的 APK_MIN_BYTES 同源,此处不 import 以保持模块可单测)。 */
const MIN_TOTAL_BYTES = 50 * 1024 * 1024
/**
 * 单片声明上限 64 MiB。XHR 只能拿整片 ArrayBuffer(见 createXhrPartTransport),
 * 单片多大就要先占多大内存;超过这条线不是"慢",而是低端机直接 OOM。
 */
export const MAX_PART_BYTES = 64 * 1024 * 1024
/**
 * 整包声明上限 256 MiB。8 路并发 × 单片上限的理论峰值由它收紧
 * (真实发布包 85–200MB 在界内);超界一律判"清单不可用",退回单文件腿,不落盘、不降级。
 */
export const MAX_TOTAL_BYTES = 256 * 1024 * 1024
const MANIFEST_TIMEOUT_MS = 10_000
/** 清单协议名:发布脚本写同一串;读到别名或旧格式一律判不可用,不猜。 */
export const PARTS_MANIFEST_SCHEMA = 'ihui-apk-parts/v1'
const PART_NAME_RE = /^ihui-ai-[0-9A-Za-z._+-]+-part-\d{2,3}\.bin$/
const GITEE_ORIGIN = 'https://gitee.com'

/** 清单不可用 / 与本次要下的版本对不上 / 体积自相矛盾。属可降级,不是"下载失败"。 */
export class PartsUnavailableError extends Error {
  /** 机器可判错误码;`ERR_PARTS_OVER_LIMIT` = 声明体积越过内存上限,调用方必须退回单文件腿。 */
  readonly code: string
  constructor(message: string, code = 'ERR_PARTS_UNAVAILABLE') {
    super(message)
    this.name = 'PartsUnavailableError'
    this.code = code
  }
}

/** 分片腿在首字节到货前停滞。与"清单不可用"同属可降级,但原因要分开报,便于排查。 */
class PartsStalledError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PartsStalledError'
  }
}

export interface ApkPart {
  /** 附件名(Gitee Release 直链的最后一段) */
  name: string
  /** 该份字节数(清单声明,下载后逐份对账) */
  size: number
}

export interface ApkPartsManifest {
  version: string
  versionCode: number | null
  totalBytes: number
  parts: ApkPart[]
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0
}

/**
 * 解析并校验清单。**任何一条不满足都抛 PartsUnavailableError**,不返回"差不多能用"的对象:
 * 让残缺清单走到下载层只会拼出校验必挂的包(与桌面端「同名附件冒名旧包」同源教训)。
 */
export function parsePartsManifest(
  raw: string,
  expectedVersion: string,
  minTotalBytes: number = MIN_TOTAL_BYTES,
): ApkPartsManifest {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new PartsUnavailableError('清单不是合法 JSON')
  }
  if (!data || typeof data !== 'object') throw new PartsUnavailableError('清单不是对象')
  const obj = data as Record<string, unknown>
  if (obj.schema !== PARTS_MANIFEST_SCHEMA) {
    throw new PartsUnavailableError(`清单 schema 不是 ${PARTS_MANIFEST_SCHEMA}`)
  }
  const version = typeof obj.version === 'string' ? obj.version.trim() : ''
  if (!version) throw new PartsUnavailableError('清单缺少 version')
  if (version !== expectedVersion) {
    throw new PartsUnavailableError(
      `清单版本 ${version} ≠ 目标版本 ${expectedVersion}(可能是旧包冒名)`,
    )
  }
  const totalBytes = obj.totalBytes
  if (!isPositiveInt(totalBytes) || totalBytes < minTotalBytes) {
    throw new PartsUnavailableError(`清单 totalBytes 非法:${String(totalBytes)}`)
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new PartsUnavailableError(
      `清单 totalBytes ${totalBytes} 超过内存上限 ${MAX_TOTAL_BYTES}(分片腿整片驻留内存)`,
      'ERR_PARTS_OVER_LIMIT',
    )
  }
  const versionCode = obj.versionCode
  if (versionCode !== undefined && versionCode !== null && !isPositiveInt(versionCode)) {
    throw new PartsUnavailableError(`清单 versionCode 非法:${String(versionCode)}`)
  }
  const rawParts = obj.parts
  if (!Array.isArray(rawParts) || rawParts.length === 0 || rawParts.length > MAX_PARTS) {
    throw new PartsUnavailableError('清单 parts 为空或条数越界')
  }
  const parts: ApkPart[] = []
  const seen = new Set<string>()
  let sum = 0
  for (const item of rawParts) {
    if (!item || typeof item !== 'object')
      throw new PartsUnavailableError('清单 parts 条目不是对象')
    const entry = item as Record<string, unknown>
    const name = typeof entry.name === 'string' ? entry.name : ''
    const size = entry.size
    if (!PART_NAME_RE.test(name)) throw new PartsUnavailableError(`分片名非法:${name || '(空)'}`)
    if (seen.has(name)) throw new PartsUnavailableError(`分片名重复:${name}`)
    if (!isPositiveInt(size))
      throw new PartsUnavailableError(`分片 ${name} size 非法:${String(size)}`)
    if (size > MAX_PART_BYTES) {
      throw new PartsUnavailableError(
        `分片 ${name} size ${size} 超过单片内存上限 ${MAX_PART_BYTES}`,
        'ERR_PARTS_OVER_LIMIT',
      )
    }
    seen.add(name)
    parts.push({ name, size })
    sum += size
  }
  if (sum !== totalBytes) {
    throw new PartsUnavailableError(`清单自相矛盾:分片合计 ${sum} ≠ totalBytes ${totalBytes}`)
  }
  return {
    version,
    versionCode: isPositiveInt(versionCode) ? versionCode : null,
    totalBytes,
    parts,
  }
}

export interface PartPlacement extends ApkPart {
  /** 该份在整包里的起始偏移(写入时 FileHandle.offset) */
  start: number
}

/** 按清单顺序累加偏移。分片必须**按声明的顺序**拼,名字里的序号只是给人看的。 */
export function planPartLayout(parts: ApkPart[]): PartPlacement[] {
  let start = 0
  return parts.map((part) => {
    const at = start
    start += part.size
    return { name: part.name, size: part.size, start: at }
  })
}

interface PartResponse {
  status: number
  body: ArrayBuffer
}

/** 单份下载的传输层接口:单测注入假传输,不去碰 jsdom 的真网络。 */
export interface PartTransport {
  get(
    url: string,
    timeoutMs: number,
    cancellation: DownloadCancellation,
    onBytes: (delta: number) => void,
  ): Promise<PartResponse>
}

/** 清单读取层接口(回归测试用;生产走 XHR)。 */
export interface ManifestTransport {
  get(url: string, timeoutMs: number, cancellation: DownloadCancellation): Promise<string>
}

function isAllowedPartUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.origin === GITEE_ORIGIN
  } catch {
    return false
  }
}

function partTimeoutMs(size: number): number {
  const raw = (size / FLOOR_BYTES_PER_SECOND) * 1000
  return Math.min(240_000, Math.max(45_000, Math.round(raw)))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 真机传输层:XHR + `responseType='arraybuffer'`。
 * 与 ranged-download 同因:RN 的 fetch 拿不到裸字节流,而 XHR 在 Android 上稳定且 onprogress
 * 能给出**真实到货字节**(进度条不必等整份下完才跳一格)。
 */
function createXhrPartTransport(): PartTransport {
  return {
    get(url, timeoutMs, cancellation, onBytes) {
      return new Promise<PartResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        let settled = false
        let reported = 0
        // 先占位再赋值:令牌若在进入本函数前就已取消,onCancel 会**同步**回调,
        // 此时 settle 里读 off 会撞 TDZ(ReferenceError 而非取消)。
        let off: () => void = () => {}
        const settle = (fn: () => void): void => {
          if (settled) return
          settled = true
          off()
          fn()
        }
        off = cancellation.onCancel(() => {
          try {
            xhr.abort()
          } catch {
            // abort 在已结束时可能抛,忽略即可
          }
          settle(() => reject(new DownloadCancelledError()))
        })
        xhr.open('GET', url, true)
        xhr.responseType = 'arraybuffer'
        xhr.timeout = Math.max(1000, Math.floor(timeoutMs))
        xhr.onprogress = (e) => {
          const loaded = Number(e?.loaded)
          if (!Number.isFinite(loaded) || loaded <= reported) return
          onBytes(loaded - reported)
          reported = loaded
        }
        xhr.onload = () => {
          const body = xhr.response instanceof ArrayBuffer ? xhr.response : new ArrayBuffer(0)
          if (body.byteLength > reported) {
            onBytes(body.byteLength - reported)
            reported = body.byteLength
          }
          settle(() => resolve({ status: xhr.status, body }))
        }
        xhr.onerror = () => settle(() => reject(new Error('网络错误')))
        xhr.ontimeout = () => settle(() => reject(new Error('请求超时')))
        xhr.onabort = () => settle(() => reject(new DownloadCancelledError()))
        try {
          xhr.send()
        } catch (e) {
          settle(() => reject(e instanceof Error ? e : new Error(String(e))))
        }
      })
    },
  }
}

/** 默认清单传输:XHR 文本。体积极小,不需要 arraybuffer。 */
function createXhrManifestTransport(): ManifestTransport {
  return {
    get(url, timeoutMs, cancellation) {
      return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        let settled = false
        // 同上:onCancel 可能在赋值前同步回调,off 必须先有初值。
        let off: () => void = () => {}
        const settle = (fn: () => void): void => {
          if (settled) return
          settled = true
          off()
          fn()
        }
        off = cancellation.onCancel(() => {
          try {
            xhr.abort()
          } catch {
            // 同上
          }
          settle(() => reject(new DownloadCancelledError()))
        })
        xhr.open('GET', url, true)
        xhr.timeout = Math.max(1000, Math.floor(timeoutMs))
        xhr.onload = () => {
          if (xhr.status !== 200) {
            settle(() => reject(new PartsUnavailableError(`清单请求非 200(实际 ${xhr.status})`)))
            return
          }
          settle(() => resolve(String(xhr.responseText ?? '')))
        }
        xhr.onerror = () => settle(() => reject(new Error('清单网络错误')))
        xhr.ontimeout = () => settle(() => reject(new Error('清单请求超时')))
        xhr.onabort = () => settle(() => reject(new DownloadCancelledError()))
        try {
          xhr.send()
        } catch (e) {
          settle(() => reject(e instanceof Error ? e : new Error(String(e))))
        }
      })
    },
  }
}

interface PartsProgress {
  downloadedBytes: number
  totalBytes: number
  bytesPerSecond: number
  connections: number
}

export interface PartsDownloadOptions {
  /** 清单直链(固定 tag 下的固定附件名) */
  manifestUrl: string
  /** 服务端下发的目标版本号;清单 version 必须与它逐字相等 */
  expectedVersion: string
  /** 目标文件 uri(已存在会被截断重写) */
  uri: string
  /** 整包体积下限,默认 50MB;调用方传 APK_MIN_BYTES 保持单源(单测注入小值) */
  minTotalBytes?: number
  concurrency?: number
  cancellation?: DownloadCancellation
  onProgress?: (p: PartsProgress) => void
  transport?: PartTransport
  manifestTransport?: ManifestTransport
  stallTimeoutMs?: number
  progressIntervalMs?: number
}

export interface PartsDownloadResult {
  uri: string
  bytes: number
  connections: number
}

/**
 * 主入口:读清单 → N 路并发拉每一份 → 按偏移定位写。
 *
 * 抛错口径:
 *   - `DownloadCancelledError` ⇒ 用户取消;
 *   - `PartsUnavailableError` / `PartsStalledError` / 其它 ⇒ 可降级,调用方退回单文件腿。
 */
export async function downloadApkParts(opts: PartsDownloadOptions): Promise<PartsDownloadResult> {
  const external = opts.cancellation ?? new DownloadCancellation()
  const stop = new DownloadCancellation()
  const unlinkCancel = external.onCancel(() => stop.cancel())
  const transport = opts.transport ?? createXhrPartTransport()
  const manifestTransport = opts.manifestTransport ?? createXhrManifestTransport()
  const progressInterval = Math.max(50, opts.progressIntervalMs ?? 250)
  const stallMs = Math.max(1000, opts.stallTimeoutMs ?? DEFAULT_PARTS_STALL_TIMEOUT_MS)

  let handle: ReturnType<File['open']> | null = null
  try {
    if (!isAllowedPartUrl(opts.manifestUrl)) {
      throw new PartsUnavailableError('清单不在允许域(gitee.com)')
    }
    const raw = await manifestTransport.get(opts.manifestUrl, MANIFEST_TIMEOUT_MS, stop)
    const manifest = parsePartsManifest(
      raw,
      opts.expectedVersion,
      opts.minTotalBytes ?? MIN_TOTAL_BYTES,
    )
    const baseDir = opts.manifestUrl.slice(0, opts.manifestUrl.lastIndexOf('/'))
    const placements = planPartLayout(manifest.parts)
    const partUrls = placements.map((p) => `${baseDir}/${p.name}`)
    for (const url of partUrls) {
      if (!isAllowedPartUrl(url)) throw new PartsUnavailableError(`分片地址不在允许域:${url}`)
    }

    const concurrency = Math.max(
      1,
      Math.min(
        placements.length,
        Math.floor(opts.concurrency ?? DEFAULT_PARTS_CONCURRENCY) || DEFAULT_PARTS_CONCURRENCY,
      ),
    )

    const meter = createSpeedMeter(SPEED_WINDOW_MS)
    let downloaded = 0
    let lastEmit = 0
    const emit = (force: boolean): void => {
      const now = Date.now()
      if (!force && now - lastEmit < progressInterval) return
      lastEmit = now
      opts.onProgress?.({
        downloadedBytes: downloaded,
        totalBytes: manifest.totalBytes,
        bytesPerSecond: meter.bytesPerSecond(now),
        connections: concurrency,
      })
    }
    /** 到货计账:成功与失败都要能加减,否则失败重试会把进度算重。 */
    const account = (delta: number, refund = false): void => {
      downloaded += refund ? -delta : delta
      if (downloaded < 0) downloaded = 0
      if (!refund) meter.push(delta)
      emit(false)
    }

    handle = new File(opts.uri).open(FileMode.Truncate)

    let cursor = 0
    const takePart = (): { placement: PartPlacement; url: string } | null => {
      if (cursor >= placements.length) return null
      const index = cursor
      cursor += 1
      const placement = placements[index]
      const url = partUrls[index]
      // 游标永远落在 [0, length) 内,但 noUncheckedIndexedAccess 下 TS 不认,显式收口
      return placement && url ? { placement, url } : null
    }

    const fetchPart = async (placement: PartPlacement, url: string): Promise<void> => {
      let lastError: Error | null = null
      for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS; attempt += 1) {
        if (stop.isCancelled) throw new DownloadCancelledError()
        let reported = 0
        try {
          const res = await transport.get(url, partTimeoutMs(placement.size), stop, (delta) => {
            if (delta <= 0) return
            reported += delta
            account(delta)
          })
          if (stop.isCancelled) throw new DownloadCancelledError()
          if (res.status !== 200 && res.status !== 206) {
            throw new Error(`分片 ${placement.name} 返回 ${res.status}`)
          }
          if (res.body.byteLength !== placement.size) {
            throw new Error(
              `分片 ${placement.name} 长度不符:期望 ${placement.size},实际 ${res.body.byteLength}`,
            )
          }
          const writable = handle
          if (!writable) throw new Error('文件句柄未就绪')
          // 定位写:FileChannel.position()+write,越界自动补零扩展
          writable.offset = placement.start
          writable.writeBytes(new Uint8Array(res.body))
          return
        } catch (e) {
          if (e instanceof DownloadCancelledError) throw e
          if (stop.isCancelled) throw new DownloadCancelledError()
          // 这一趟已计入的字节要退回,否则重试会让 downloaded > totalBytes,进度条越界
          if (reported > 0) account(reported, true)
          lastError = e instanceof Error ? e : new Error(String(e))
          if (attempt < MAX_PART_ATTEMPTS) await delay(RETRY_BASE_MS * attempt)
        }
      }
      throw lastError ?? new Error(`分片 ${placement.name} 下载失败`)
    }

    const worker = async (): Promise<void> => {
      for (;;) {
        if (stop.isCancelled) throw new DownloadCancelledError()
        const next = takePart()
        if (!next) return
        await fetchPart(next.placement, next.url)
      }
    }

    let rejectStall: ((e: Error) => void) | null = null
    const stallPromise = new Promise<never>((_, reject) => {
      rejectStall = reject
    })
    const watchdog = setTimeout(() => {
      if (downloaded > 0) return
      stop.cancel()
      rejectStall?.(new PartsStalledError(`分片腿 ${Math.round(stallMs / 1000)}s 内 0 字节到货`))
    }, stallMs)

    try {
      emit(true)
      // 与 workers 赛跑:替身/极端网络下一条永不回调的请求不能把"撤单"也一起卡死。
      const results = await Promise.race([
        Promise.allSettled(Array.from({ length: concurrency }, () => worker())),
        stallPromise,
      ])
      const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failure) throw failure.reason
      if (stop.isCancelled) throw new DownloadCancelledError()
      const written = handle.size
      if (written === null || written !== manifest.totalBytes) {
        throw new Error(`下载不完整:期望 ${manifest.totalBytes} 字节,落地 ${written ?? 0} 字节`)
      }
      emit(true)
      return { uri: opts.uri, bytes: manifest.totalBytes, connections: concurrency }
    } finally {
      clearTimeout(watchdog)
    }
  } finally {
    unlinkCancel()
    try {
      handle?.close()
    } catch {
      // 关闭失败不影响结论(句柄随 GC 释放),但绝不能因此掩盖真正的错误
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
