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
   * H20 ②(2026-11-04 收口):提交节拍 + 帧预算切批。
   *
   * 第一版只做「每帧 ≤24 字 + 8ms 预算」,CI 首跑仍有 148ms/56ms 两枚长任务:
   * 帧预算压住了单次追加字数,但**提交频率仍是一帧一次**(60 次/秒),
   * 流式消息的 markdown 活跃块与列表容器被反复提交,总渲染工作量没有下降。
   *
   * 收口版把「消费积压」与「提交 DOM」拆开:
   * - 每 COMMIT_INTERVAL_MS 才提交一次(≈25fps),其余帧只保留积压、不触发 React 更新;
   * - 单次提交仍受 8ms 硬预算与 MAX_CHARS_PER_COMMIT 约束,积压大也不放大单帧;
   * - 首帧立即提交(lastCommitAt 从 0 起算),可见延迟上限≈一个提交间隔,不牺牲首字观感。
   */
  const RENDER_BUDGET_MS = 8
  const COMMIT_INTERVAL_MS = 40
  const MAX_CHARS_PER_COMMIT = 120
  let lastCommitAt = 0

  const tick = (): void => {
    rafId = null
    if (pending.length === 0) {
      emitProgress()
      return
    }
    const now = performance.now()
    // 未到提交节拍:本帧只等待,不制造一次 React 提交(积压留在 pending)
    if (now - lastCommitAt < COMMIT_INTERVAL_MS) {
      rafId = requestAnimationFrame(tick)
      return
    }
    const startedAt = now
    let taken = 0
    while (pending.length > 0 && taken < MAX_CHARS_PER_COMMIT) {
      const room = MAX_CHARS_PER_COMMIT - taken
      const take = pending.slice(0, room)
      pending = pending.slice(room)
      append(take)
      taken += take.length
      // 硬预算:本帧已花满 8ms 就停手,剩余积压顺延到下一帧
      if (performance.now() - startedAt >= RENDER_BUDGET_MS) break
    }
    lastCommitAt = performance.now()
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
