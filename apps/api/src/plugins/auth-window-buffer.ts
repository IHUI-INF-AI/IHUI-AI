// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WebSocket 鉴权窗口消息缓冲(2026-11-12 立,根因级)。
 *
 * 问题:`ws` 库在 socket 上没有 `message` 监听器时**直接丢弃**到达的帧(不排队、不报错)。
 * 而所有 WS 插件的形状都是 `const userId = await wsAuth(socket, token)` 之后才注册正式
 * 处理器 —— `wsAuth` 要验签 + 查用户状态(uuid 校验 + 一次主键查询),这是一个真实的时间窗。
 *
 * 后果不是"偶发丢包",而是**必然丢首帧**:客户端在 `onopen` 立刻发帧(最自然的写法)时,
 * 帧总落在鉴权窗口内。事故形状(本机 8802 实测,2026-11-12):握手成功、收到 `ready`,
 * 然后 **120 秒零帧**,永远等不到 `start`;改成收到 `ready` 再发才 `start → 21 chunk → done`。
 *
 * 本模块把这件事从"客户端纪律"降级为"服务端保证":
 *   1. 鉴权**之前**先把 `sink` 挂上 → 期间到达的帧进缓冲;
 *   2. 鉴权成功后 `handoff(handler)` → 换成正式处理器,并把缓冲**按序**回放;
 *   3. 鉴权失败 / 连接关闭 → `dispose()` 丢弃缓冲,不占内存。
 *
 * 安全边界:未鉴权期间**只做字节搬运,不解析、不执行**(不做 JSON.parse,不触发业务分支);
 * 上限 `maxBuffered` 条,超出即丢(未鉴权连接不配当内存放大器)。回放是同步逐条,顺序与到达
 * 顺序一致 —— `ready` 帧在 handoff 之前发出,故回放产生的 `start`/`chunk` 必然排在 `ready` 之后。
 */
export interface AuthWindowBuffer {
  /** 鉴权前挂到 socket 的 message 监听器:未交接则缓冲,已交接则直通 */
  readonly sink: (raw: Buffer) => void
  /**
   * 鉴权成功后交接:登记正式处理器并按序回放缓冲。
   * 单帧回放抛错被吞掉(不让一帧坏数据阻断其余帧),故调用方无需自包 try。
   */
  readonly handoff: (handler: (raw: Buffer) => void) => void
  /** 鉴权失败 / 连接关闭:丢弃缓冲并解除交接(此后 sink 不再接收) */
  readonly dispose: () => void
  /** 当前缓冲条数(观测与测试用) */
  readonly size: number
  /** 是否已交接(观测与测试用) */
  readonly handedOff: boolean
}

/** 默认缓冲上限:超过 `MAX_INFLIGHT_PER_CONNECTION` 数倍仍属正常突发,再多就是异常 */
export const DEFAULT_AUTH_WINDOW_BUFFER = 16

export function createAuthWindowBuffer(maxBuffered = DEFAULT_AUTH_WINDOW_BUFFER): AuthWindowBuffer {
  const limit = Number.isFinite(maxBuffered) && maxBuffered > 0 ? Math.floor(maxBuffered) : 0
  const pending: Buffer[] = []
  let handler: ((raw: Buffer) => void) | null = null
  let disposed = false

  return {
    sink: (raw: Buffer): void => {
      if (disposed) return
      if (handler) {
        handler(raw)
        return
      }
      if (pending.length < limit) pending.push(raw)
    },
    handoff: (next: (raw: Buffer) => void): void => {
      if (disposed) return
      handler = next
      if (pending.length === 0) return
      const buffered = pending.splice(0, pending.length)
      for (const raw of buffered) {
        try {
          next(raw)
        } catch {
          /* 单帧回放失败不阻断后续帧 —— 与实时路径一致(实时路径的异常由处理器自己兜) */
        }
      }
    },
    dispose: (): void => {
      disposed = true
      handler = null
      pending.length = 0
    },
    get size(): number {
      return pending.length
    },
    get handedOff(): boolean {
      return handler !== null
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
