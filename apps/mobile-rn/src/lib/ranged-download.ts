// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ranged-download.ts — 多连接分片下载(2026-11-04 立)。
 *
 * 为什么需要它(2026-11-04 两轮真机实测,后一轮推翻了前一轮的拐点判断):
 *   APK 85MB 从 www.aizhs.top 到国内手机,单连接实测 **10.5~16 KB/s**,TTFB 5.9~14s
 *   (20 秒窗口里首字节就能把窗口吃光)—— 用户看到的就是"几十 B/s、永远卡在 0%"。
 *   同一台手机、4 条并发各取 1MB,25 秒窗口聚合 **94 KB/s**(四条分别 0 / 688K / 1M / 622K),
 *   约为单连接的 9 倍 ⇒ 瓶颈确实在**单连接**(跨境长肥管道 + 小拥塞窗口)。
 *
 *   但**并发不是越多越好**:首版按 8 条 × 2MB 落地,真机埋点显示 8 条请求全部正常发出,
 *   95 秒内无一条返回 onload/onerror(`xhr.timeout` 还设成了 256s ⇒ 用户会盯着 0% 干等四分多钟);
 *   而同机 `curl` 单条取同样 2MB 只要 19.9s。8 条并发 + 每片 2MB 的组合在这条链路上会
 *   **集体饿死**。⇒ 片要小(512KB)、并发要收(4 条)、单片超时要短(75s),
 *   让"首片到货"发生在十几秒内,而不是让用户先熬过一片 2MB 的跨境长尾。
 *   这三层都是纯 JS 参数,走 OTA 热更即可调整,不需要重编原生。
 *
 * 所以这里做的不是"重试得更狠",而是**把一次传输拆成 N 条独立连接**:
 *   1. 先发一条 `Range: bytes=0-0` 探针,拿 `Content-Range: bytes 0-0/<total>`
 *      ——total 是服务端自己报的,不靠猜 Content-Length(302 链上它可能是跳转体长度);
 *   2. 按 512KB 切窗,4 条连接各领一片,彼此不共享 TCP 流;
 *   3. 每片到货就用 `FileHandle.offset = start` + `writeBytes()` **定位写**进同一个文件
 *      (expo-file-system 的原生实现是 `FileChannel.position()+write`,越界写自动补零扩展)
 *      ⇒ 不需要"下完 N 个临时文件再拼",也就不需要把 85MB 读进 JS 内存;
 *   4. 每片独立重试(最多 3 次,600ms 退避),某片 200 而非 206 判定为"服务端不支持 Range",
 *      立刻抛 RangeUnsupportedError 让调用方退回单流 —— **绝不把整包内容写到偏移 0 上**。
 *
 * 三条纪律:
 *   - **不静默降级**:Range 不可用时抛错由上层选腿,不在本模块里偷偷换成单流;
 *   - **不隐瞒速度**:进度回调里带 bytesPerSecond(4 秒滚动窗口),让 UI 能说真话;
 *   - **不留半包**:总字节数与探针值不符即报错,不把残包交给安装器(装到一半失败比重下更糟)。
 */

import { File, FileMode } from 'expo-file-system'

/** 4 条是干净 A/B 里聚合最快的可用档(1 条 10.5 KB/s、4 条 94 KB/s、8 条 × 2MB 集体饿死)。 */
export const DEFAULT_CONCURRENCY = 4
/** 512KB 片:跨境 TTFB 5.9~14s,片再大就会让"首片到货"拖到几分钟,进度条恒 0%。 */
export const DEFAULT_CHUNK_BYTES = 512 * 1024
/** 单片重试上限(含首次)。3 次约覆盖跨境链路的偶发断流,再多就只是拖着用户。 */
const MAX_ATTEMPTS = 3
const RETRY_BASE_MS = 600
/** 速度采样窗口:4 秒足够稳,又不会让"刚提速"读数滞后太久。 */
const SPEED_WINDOW_MS = 4000
/** 单连接速率下限,用于把"这片要下多久"折算成 XHR 总超时(低于它就没必要再等)。 */
const FLOOR_BYTES_PER_SECOND = 8 * 1024
/**
 * 首片看门狗(2026-11-04 真机教训):分片只是"加速尝试",不是唯一可用的腿。
 * RN 的 XHR 在跨境慢链路上可能把每条 Range 请求都挂到读超时(实测 64s 集体 onerror),
 * 此时若还按 3 次重试走完,用户要盯 3 分钟 0% 才等到降级。45s 内 0 字节到货就撤单,
 * 让调用方立刻退回原生单流 —— 慢,但至少有真实进度、不会假装在下载。
 */
export const DEFAULT_STALL_TIMEOUT_MS = 45_000

/** 服务端不支持 Range(或回了 200 整包)。由调用方决定退回哪条腿。 */
export class RangeUnsupportedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RangeUnsupportedError'
  }
}

/** 分片腿在首片到货前停滞。与"服务端不认 Range"同属可降级,但原因要分开报,便于排查。 */
export class RangeStalledError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RangeStalledError'
  }
}

/** 用户主动取消。与"失败"分开:取消不进错误态,也不该触发浏览器降级。 */
export class DownloadCancelledError extends Error {
  constructor() {
    super('下载已取消')
    this.name = 'DownloadCancelledError'
  }
}

export interface ContentRange {
  /** 首字节偏移(含) */
  start: number
  /** 末字节偏移(含) */
  end: number
  /** 资源总字节数;`*` 时为 null */
  total: number | null
}

/**
 * 解析 `Content-Range: bytes 0-1023/84915649`。
 * 认三种真实形态:`/<total>`、`/*`(总长未知)、以及缺失/畸形时返回 null。
 */
export function parseContentRange(value: string | null | undefined): ContentRange | null {
  if (!value) return null
  const m = /^\s*bytes\s+(\d+)-(\d+)\/(\d+|\*)\s*$/i.exec(value)
  if (!m) return null
  const start = Number(m[1])
  const end = Number(m[2])
  const total = m[3] === '*' ? null : Number(m[3])
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  if (total !== null && (!Number.isFinite(total) || total <= end)) return null
  return { start, end, total }
}

export interface ByteRange {
  /** 首字节偏移(含) */
  start: number
  /** 末字节偏移(含)—— 直接喂给 `Range: bytes=start-end`,不用再减一 */
  end: number
}

/** 把总量切成等长窗口。末片截断到剩余长度,不留空片。 */
export function planRanges(totalBytes: number, chunkBytes: number): ByteRange[] {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return []
  const step = Math.max(1, Math.floor(chunkBytes))
  const out: ByteRange[] = []
  for (let start = 0; start < totalBytes; start += step) {
    out.push({ start, end: Math.min(start + step, totalBytes) - 1 })
  }
  return out
}

/**
 * 并发数要同时受"片数"和"请求上限"约束:3 片资源开 8 条只会空转 5 条。
 * 返回至少 1,绝不返回 0(0 条 = 永远等不到完成)。
 */
export function normalizeConcurrency(
  totalBytes: number,
  chunkBytes: number,
  requested: number,
): number {
  const chunks = planRanges(totalBytes, chunkBytes).length
  const want = Math.floor(requested)
  const cap = Number.isFinite(want) && want > 0 ? want : DEFAULT_CONCURRENCY
  return Math.max(1, Math.min(chunks || 1, cap))
}

export interface SpeedMeter {
  /** 记入一次到货字节 */
  push(bytes: number, at?: number): void
  /** 当前滚动窗口内的平均速率(字节/秒);窗口内样本不足时按实际跨度折算 */
  bytesPerSecond(at?: number): number
  /** 窗口内累计字节(测试与 ETA 用) */
  totalBytes(): number
}

/** 滚动窗口速率表:只保留最近 `SPEED_WINDOW_MS` 的样本。 */
export function createSpeedMeter(windowMs = SPEED_WINDOW_MS): SpeedMeter {
  const samples: Array<{ at: number; bytes: number }> = []
  let sum = 0
  const trim = (now: number): void => {
    for (;;) {
      const head = samples[0]
      if (!head || now - head.at <= windowMs) break
      samples.shift()
      sum -= head.bytes
    }
  }
  return {
    push(bytes, at = Date.now()) {
      if (!Number.isFinite(bytes) || bytes <= 0) return
      samples.push({ at, bytes })
      sum += bytes
      trim(at)
    },
    bytesPerSecond(at = Date.now()) {
      trim(at)
      if (sum <= 0) return 0
      const first = samples[0]
      const span = first ? Math.max(1, at - first.at) : 1
      return Math.round((sum / span) * 1000)
    },
    totalBytes() {
      return sum
    },
  }
}

/** 取消令牌:比 AbortController 更小,避免在 RN 里引入额外 polyfill。 */
export class DownloadCancellation {
  private cancelled = false
  private handlers = new Set<() => void>()

  get isCancelled(): boolean {
    return this.cancelled
  }

  /** 注册取消回调;已取消时立即执行一次(不留"注册晚了一步"的缝隙)。 */
  onCancel(fn: () => void): () => void {
    if (this.cancelled) {
      fn()
      return () => {}
    }
    this.handlers.add(fn)
    return () => {
      this.handlers.delete(fn)
    }
  }

  cancel(): void {
    if (this.cancelled) return
    this.cancelled = true
    for (const fn of this.handlers) {
      try {
        fn()
      } catch {
        // 单个回调抛错不能阻断其余在飞请求的取消
      }
    }
    this.handlers.clear()
  }
}

export interface RangeResponse {
  status: number
  body: ArrayBuffer
  contentRange: string | null
}

/** HTTP 取片这一层抽成接口:单测注入假传输,不去碰 jsdom 的真网络。 */
export interface RangeTransport {
  get(
    url: string,
    headers: Record<string, string>,
    timeoutMs: number,
    cancellation: DownloadCancellation,
  ): Promise<RangeResponse>
}

/**
 * 真机传输层:XHR + `responseType='arraybuffer'`。
 * 为什么不走 fetch:RN 的 fetch 拿不到裸字节流(`response.body` 不可靠),
 * 而 XHR 的 arraybuffer 在 Android/iOS 上都稳定,且能拿到 `Content-Range` 头。
 */
export function createXhrTransport(): RangeTransport {
  return {
    get(url, headers, timeoutMs, cancellation) {
      return new Promise<RangeResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        let settled = false
        const settle = (fn: () => void): void => {
          if (settled) return
          settled = true
          off()
          fn()
        }
        const off = cancellation.onCancel(() => {
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
        for (const [key, value] of Object.entries(headers)) {
          try {
            xhr.setRequestHeader(key, value)
          } catch {
            // 个别头在 RN 上被禁止设置(如 Host),跳过而不是整单失败
          }
        }
        xhr.onload = () => {
          const body = xhr.response instanceof ArrayBuffer ? xhr.response : new ArrayBuffer(0)
          settle(() =>
            resolve({
              status: xhr.status,
              body,
              contentRange: xhr.getResponseHeader('Content-Range'),
            }),
          )
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

export interface RangedProgress {
  downloadedBytes: number
  totalBytes: number
  /** 4 秒滚动窗口速率;刚开始时为 0,UI 不要把它当成"卡住" */
  bytesPerSecond: number
  connections: number
}

export interface RangedDownloadOptions {
  url: string
  /** 目标文件 uri(已存在会被截断重写) */
  uri: string
  headers?: Record<string, string>
  concurrency?: number
  chunkBytes?: number
  onProgress?: (p: RangedProgress) => void
  cancellation?: DownloadCancellation
  transport?: RangeTransport
  /** 进度节流(默认 250ms),避免每片都 setState 打爆渲染 */
  progressIntervalMs?: number
  /** 首片看门狗(默认 45s):这段时间里 0 字节到货 ⇒ 撤掉分片腿,让上层退回原生单流 */
  stallTimeoutMs?: number
}

export interface RangedDownloadResult {
  uri: string
  bytes: number
  connections: number
}

function chunkTimeoutMs(chunkBytes: number): number {
  const raw = (chunkBytes / FLOOR_BYTES_PER_SECOND) * 1000
  // 上限 75s:首版给 2MB 片算到 256s,真机上 8 条集体挂起时用户要干等四分多钟才看到一次重试,
  // 等于把"卡死"伪装成"正在下载"。宁可早超时早重试,也不能拿超长超时粉饰停滞。
  return Math.min(75_000, Math.max(30_000, Math.round(raw)))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 探针:只取首字节,读 `Content-Range` 的总长与"服务端认不认 Range"。 */
async function probeTotal(
  opts: RangedDownloadOptions,
  transport: RangeTransport,
  cancellation: DownloadCancellation,
): Promise<number> {
  const res = await transport.get(
    opts.url,
    { ...(opts.headers ?? {}), Range: 'bytes=0-0' },
    chunkTimeoutMs(1),
    cancellation,
  )
  if (cancellation.isCancelled) throw new DownloadCancelledError()
  if (res.status !== 206) {
    throw new RangeUnsupportedError(`服务端未返回 206(Range),实际 ${res.status}`)
  }
  const parsed = parseContentRange(res.contentRange)
  if (!parsed || parsed.total === null || parsed.total <= 0) {
    throw new RangeUnsupportedError('响应缺少可用的 Content-Range 总长')
  }
  return parsed.total
}

/**
 * 主入口:分片下载到 `opts.uri`。
 *
 * 抛错口径:
 *   - `RangeUnsupportedError` ⇒ 服务端/链路不支持分片,调用方退回单流;
 *   - `DownloadCancelledError` ⇒ 用户取消;
 *   - 其它 ⇒ 真失败(重试已用尽 / 字节数对不上 / 写盘失败)。
 */
export async function downloadRanged(opts: RangedDownloadOptions): Promise<RangedDownloadResult> {
  const transport = opts.transport ?? createXhrTransport()
  const cancellation = opts.cancellation ?? new DownloadCancellation()
  const chunkBytes = Math.max(64 * 1024, Math.floor(opts.chunkBytes ?? DEFAULT_CHUNK_BYTES))
  const totalBytes = await probeTotal(opts, transport, cancellation)
  const ranges = planRanges(totalBytes, chunkBytes)
  const connections = normalizeConcurrency(
    totalBytes,
    chunkBytes,
    opts.concurrency ?? DEFAULT_CONCURRENCY,
  )

  const file = new File(opts.uri)
  // Truncate:整包重下,绝不在旧残包上续写(残包 + 新包 = 签名校验必挂)
  const handle = file.open(FileMode.Truncate)
  const meter = createSpeedMeter()
  const interval = Math.max(50, opts.progressIntervalMs ?? 250)
  let lastEmit = 0
  let downloaded = 0

  const emit = (force: boolean): void => {
    const now = Date.now()
    if (!force && now - lastEmit < interval) return
    lastEmit = now
    opts.onProgress?.({
      downloadedBytes: downloaded,
      totalBytes,
      bytesPerSecond: meter.bytesPerSecond(now),
      connections,
    })
  }

  let cursor = 0
  const takeRange = (): ByteRange | null => {
    const next = ranges[cursor]
    if (!next) return null
    cursor += 1
    return next
  }

  const fetchChunk = async (range: ByteRange): Promise<ArrayBuffer> => {
    const expected = range.end - range.start + 1
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      if (cancellation.isCancelled) throw new DownloadCancelledError()
      try {
        const res = await transport.get(
          opts.url,
          { ...(opts.headers ?? {}), Range: `bytes=${range.start}-${range.end}` },
          chunkTimeoutMs(expected),
          cancellation,
        )
        if (cancellation.isCancelled) throw new DownloadCancelledError()
        // 200 = 服务端无视了 Range 并把整包塞过来。此时绝不能用它写偏移,
        // 否则每一片都会把整包覆盖到自己的起点上,拼出一个必然校验失败的怪物文件。
        if (res.status !== 206) {
          throw new RangeUnsupportedError(`分片请求未返回 206,实际 ${res.status}`)
        }
        if (res.body.byteLength !== expected) {
          throw new Error(`分片长度不符:期望 ${expected},实际 ${res.body.byteLength}`)
        }
        return res.body
      } catch (e) {
        if (e instanceof DownloadCancelledError) throw e
        if (e instanceof RangeUnsupportedError) throw e
        // 取消可能发生在请求抛错的同一拍(abort 让 XHR 报网络错误而不是 abort 事件),
        // 必须先认令牌再判重试,否则取消会被当成"偶发失败"再拖 600ms。
        if (cancellation.isCancelled) throw new DownloadCancelledError()
        lastError = e instanceof Error ? e : new Error(String(e))
        if (attempt < MAX_ATTEMPTS) await delay(RETRY_BASE_MS * attempt)
      }
    }
    throw lastError ?? new Error('分片下载失败')
  }

  const worker = async (): Promise<void> => {
    for (;;) {
      if (cancellation.isCancelled) throw new DownloadCancelledError()
      const range = takeRange()
      if (!range) return
      const body = await fetchChunk(range)
      if (cancellation.isCancelled) throw new DownloadCancelledError()
      // 定位写:FileChannel.position 后 write,越界自动补零扩展
      handle.offset = range.start
      handle.writeBytes(new Uint8Array(body))
      downloaded += body.byteLength
      meter.push(body.byteLength)
      emit(false)
    }
  }

  const stallMs = Math.max(1000, opts.stallTimeoutMs ?? DEFAULT_STALL_TIMEOUT_MS)
  let rejectStall: ((e: Error) => void) | null = null
  // 与 workers 赛跑,而不是等它们:真实 XHR 被 abort 后会 settle,但替身/极端网络下
  // 一条永不回调的请求不能把"撤单"也一起卡死。allSettled 永不 reject ⇒ 不会留下
  // unhandled rejection,输掉这一侧是安全的。
  const stallPromise = new Promise<never>((_, reject) => {
    rejectStall = reject
  })
  const watchdog = setTimeout(() => {
    if (downloaded > 0) return
    cancellation.cancel()
    rejectStall?.(new RangeStalledError(`分片腿 ${Math.round(stallMs / 1000)}s 内 0 字节到货`))
  }, stallMs)

  try {
    emit(true)
    const results = await Promise.race([
      Promise.allSettled(Array.from({ length: connections }, () => worker())),
      stallPromise,
    ])
    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failure) throw failure.reason
    if (cancellation.isCancelled) throw new DownloadCancelledError()
    const written = handle.size
    if (written === null || written !== totalBytes) {
      throw new Error(`下载不完整:期望 ${totalBytes} 字节,落地 ${written ?? 0} 字节`)
    }
    emit(true)
    return { uri: opts.uri, bytes: totalBytes, connections }
  } finally {
    clearTimeout(watchdog)
    try {
      handle.close()
    } catch {
      // 关闭失败不影响结论(文件句柄随 GC 释放),但绝不能因此掩盖真正的错误
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
