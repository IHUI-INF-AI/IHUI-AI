// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import {
  fetchPredictiveEdit,
  usePredictiveEditMetricSettlement,
  type PredictiveEditAction,
} from '@/lib/predictive-edit-api'

/**
 * 编辑器内的预测式编辑(编辑意图预测)状态钩子 —— Trae CUE 的「编辑器内嵌
 * 编辑意图建议」在本仓的对齐面(2026-10-31,goal-b39 取证后接线)。
 *
 * 与聊天输入区(web-input-core)同一后端契约与同一份终点结算器,差异只有两处:
 * - 触发节奏:编辑器 600ms(比输入区 400ms 慢一拍 —— 编辑器单次编辑改动更大,
 *   立即预测的噪声更高);
 * - 消费形态:动作不是整块替换文本,而是交回宿主(CodeEditor)按 Monaco
 *   offset → position 落成 executeEdits,保留撤销栈与光标。
 *
 * 三态纪律与输入区一致:只有 `suggested` 上屏;`no_action` / `undetermined` /
 * `failed` 都不渲染任何东西,预测失败对用户不可见、绝不阻塞编辑。
 */

export const EDITOR_EDIT_INTENT_DEBOUNCE_MS = 600

/** 编辑器侧预测建议:document 是发起预测那一刻的编辑器全文(展示判据的坐标系)。 */
export interface EditorEditIntentPrediction {
  document: string
  actions: PredictiveEditAction[]
  model?: string
  latencyMs?: number
}

export interface UseEditorEditIntentOptions {
  /** 编辑器当前全文(受控 value,单调跟随 onChange)。 */
  text: string
  /** 实时读光标的全文偏移(0 基;由宿主从 Monaco selection/model 取)。 */
  getCursorOffset: () => number
  language: string
  /** false(readOnly / 非受控)时整条链路静默停转。 */
  enabled: boolean
}

export interface UseEditorEditIntentResult {
  prediction: EditorEditIntentPrediction | null
  /** 展示中判据:仅 suggested 且文档未变。建议条渲染与终点结算共用这一份。 */
  predictionVisible: boolean
  /** 忽略当前建议(终点结算自动记 dismissed)。 */
  dismiss: () => void
  /** 「应用」终点上报(宿主在 executeEdits 成功后调用,引用等值才撤销待结算)。 */
  settleAccepted: (payload: EditorEditIntentPrediction) => void
}

export function useEditorEditIntent({
  text,
  getCursorOffset,
  language,
  enabled,
}: UseEditorEditIntentOptions): UseEditorEditIntentResult {
  const [prediction, setPrediction] = React.useState<EditorEditIntentPrediction | null>(null)
  // 实时读取面(光标)跨渲染稳定:effect 闭包只依赖 text/enabled,光标经 ref 取。
  const getCursorOffsetRef = React.useRef(getCursorOffset)
  getCursorOffsetRef.current = getCursorOffset
  const languageRef = React.useRef(language)
  languageRef.current = language

  React.useEffect(() => {
    if (!enabled || !text) {
      setPrediction(null)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const snapshot = text
      void fetchPredictiveEdit(
        { content: snapshot, cursor: getCursorOffsetRef.current(), language: languageRef.current },
        { signal: controller.signal },
      ).then((outcome) => {
        if (controller.signal.aborted) return
        // 三态原样消费:只有 suggested 上屏;其余三档静默(undetermined 不冒充 no_action)。
        if (outcome.status === 'suggested') {
          setPrediction({
            document: snapshot,
            actions: outcome.actions,
            model: outcome.model,
            latencyMs: outcome.latencyMs,
          })
        }
      })
    }, EDITOR_EDIT_INTENT_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text, enabled])

  const predictionVisible = prediction !== null && prediction.document === text
  const settleAccepted = usePredictiveEditMetricSettlement(prediction, predictionVisible)
  const dismiss = React.useCallback(() => setPrediction(null), [])
  return { prediction, predictionVisible, dismiss, settleAccepted }
}

/** 动作起点(文档绝对偏移)→ 1 基行号(建议条逐条标签用,零依赖实现)。 */
export function editIntentLineOf(documentText: string, start: number): number {
  let line = 1
  for (let i = 0; i < start && i < documentText.length; i++) {
    if (documentText.charCodeAt(i) === 10) line++
  }
  return line
}
