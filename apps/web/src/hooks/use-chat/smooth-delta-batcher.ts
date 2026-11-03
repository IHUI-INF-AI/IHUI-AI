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

  /**
   * H20 ②(2026-11-04 立):帧预算切批。
   *
   * 原实现 `step = max(2, ceil(backlog/8))` 在积压时**放大单帧工作量** —— mock 以
   * 生产同量级(16ms/帧)推流时,积压越大单帧追加越多,渲染提交随之变重,CI 实测
   * 流式窗口出现 56ms/53ms 两枚 >50ms 长任务(LoAF 归因 FrameRequestCallback)。
   *
   * 现改为:每帧最多追加固定字数(不随 backlog 放大),并叠加 8ms 硬预算 ——
   * 追加循环一旦用满渲染预算就立即让出主线程,剩余积压留到下一帧。
   * 追平速度由「每帧字数 × 帧率」给出恒定上限,不再出现"积压大 ⇒ 单帧重"的放大。
   */
  const RENDER_BUDGET_MS = 8
  const MAX_CHARS_PER_FRAME = 24

  const tick = (): void => {
    rafId = null
    if (pending.length === 0) {
      emitProgress()
      return
    }
    const startedAt = performance.now()
    let taken = 0
    while (pending.length > 0 && taken < MAX_CHARS_PER_FRAME) {
      const room = MAX_CHARS_PER_FRAME - taken
      const take = pending.slice(0, room)
      pending = pending.slice(room)
      append(take)
      taken += take.length
      // 硬预算:本帧已花满 8ms 就停手,剩余积压顺延到下一帧
      if (performance.now() - startedAt >= RENDER_BUDGET_MS) break
    }
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
