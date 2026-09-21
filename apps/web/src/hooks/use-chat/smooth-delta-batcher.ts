// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * #16 流式平滑渲染(2026-09-15 立):
 * 在 createDeltaBatcher 的 rAF 合并基础上增加「逐帧平滑推进」——
 * delta 入 buffer 后,每帧只追加一小段字符,落后越多追越快(约 2-3 秒内追平),
 * 消除原 batcher 整块蹦字的无平滑观感。对外契约(batch/flush/cancel/pending 语义)
 * 与 createDeltaBatcher 完全一致,onProgress 每帧报告本流累计生成总字符数(供 #21 估算)。
 */
export interface SmoothDeltaBatcherOptions {
  /** 每帧回调,入参为「本流累计收到(模型生成)的总字符数」 */
  onProgress?: (charCount: number) => void
}

export interface SmoothDeltaBatcher {
  /** 喂入增量 delta(与 createDeltaBatcher.batch 同名同语义) */
  batch: (delta: string) => void
  /** 立即追加全部剩余 buffer 并停帧(错误/中止前冲刺) */
  flush: () => void
  /** 丢 buffer 并停帧 */
  cancel: () => void
}

export function createSmoothDeltaBatcher(
  append: (text: string) => void,
  opts?: SmoothDeltaBatcherOptions,
): SmoothDeltaBatcher {
  let pending = ''
  let totalReceived = 0
  let rafId: number | null = null

  const emitProgress = (): void => {
    opts?.onProgress?.(totalReceived)
  }

  const tick = (): void => {
    rafId = null
    const remaining = pending.length
    if (remaining === 0) {
      emitProgress()
      return
    }
    // 落后越多追越快:每帧至少 2 字,最多 ceil(remaining/8),约 2-3 秒追平
    const step = Math.max(2, Math.ceil(remaining / 8))
    const take = pending.slice(0, step)
    pending = pending.slice(step)
    append(take)
    emitProgress()
    if (pending.length > 0) {
      rafId = requestAnimationFrame(tick)
    }
  }

  const batch = (delta: string): void => {
    if (delta.length === 0) return
    pending += delta
    totalReceived += delta.length
    if (rafId === null) {
      rafId = requestAnimationFrame(tick)
    }
  }

  const flush = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (pending) {
      const d = pending
      pending = ''
      append(d)
      emitProgress()
    }
  }

  const cancel = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pending = ''
  }

  return { batch, flush, cancel }
}
