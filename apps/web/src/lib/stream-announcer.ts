// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流式播报文案(P3 #34 屏幕阅读器对话全流程 e2e,2026-09-16 立)。
 *
 * 纯函数产出播报文本,渲染层把文本放进 aria-live="polite" 的 visually-hidden
 * 区域即可。**不要逐 token 播报**——屏幕阅读器会疯掉;节流策略见
 * STREAM_ANNOUNCE_INTERVAL_MS(默认 3s,进度播报只报字数不报内容,
 * 完成时才报总字数;内容本身由用户用阅读光标自行浏览)。
 */

/** 进度播报节流间隔(ms)。 */
export const STREAM_ANNOUNCE_INTERVAL_MS = 3000

export type StreamAnnouncePhase = 'start' | 'streaming' | 'done'

/**
 * 生成播报文本。
 *
 * @param phase start=开始回复 / streaming=输出中(报当前字数) / done=完成(报总字数)
 * @param charCount 当前 assistant 内容字符数
 */
export function buildStreamAnnouncement(
  phase: StreamAnnouncePhase,
  charCount: number,
  t: (key: string, params?: Record<string, number>) => string,
): string {
  switch (phase) {
    case 'start':
      return t('streamAnnounceStart')
    case 'streaming':
      return t('streamAnnounceProgress', { n: charCount })
    case 'done':
      return t('streamAnnounceDone', { n: charCount })
  }
}

/**
 * 节流决策(纯函数,便于单测):给定距上次播报的毫秒数与字符数增量,
 * 判断本次 tick 是否应该播报。
 *
 * 规则:距上次 ≥ 间隔 且 字符数有增长 → 播报;字符数无变化不重复播报。
 */
export function shouldAnnounceProgress(
  elapsedMs: number,
  charDelta: number,
  intervalMs = STREAM_ANNOUNCE_INTERVAL_MS,
): boolean {
  return elapsedMs >= intervalMs && charDelta > 0
}
