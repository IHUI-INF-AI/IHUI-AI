// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 超级智能体面板数据腿(web 对话工作台专用)。
 *
 * 判据全在控制面(服务端),端内只读投影 + 动作走既有 REST 出口;
 * 类型形状逐字对齐 @ihui/shared/super-agent 的面板读数(§0.6 单一真相源:
 * 这里写的是 wire 形态,不是判据拷贝)。
 */
'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export type SuperAgentStage =
  | { stage: 'person'; action: 'delivery' | 'answer' | 'review' | 'blocked' | 'failed' }
  | { stage: 'working'; action?: 'queued' }
  | { stage: 'idle' }
  | { stage: 'ended' }

export interface SuperAgentPanelView {
  needsPerson: {
    ticketId: string
    stage: SuperAgentStage
    attention: string | null
    scope: string
    sessionId: string
    directory: string
  }[]
  quietDrops: number
  recorded: number
  pendingRecords: {
    id: string
    text: string
    reason: string
    decision?: { verdict: 'act' | 'ignore' | 'unclear'; reason: string; at: number }
  }[]
}

const PANEL_PATH = '/super-agent/panel'
const REFRESH_MS = 30_000

export function useSuperAgentPanel() {
  const [panel, setPanel] = React.useState<SuperAgentPanelView | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const refresh = React.useCallback(async () => {
    const res = await fetchApi<SuperAgentPanelView>(PANEL_PATH)
    if (res.success && res.data) {
      setPanel(res.data)
      setError(null)
    } else {
      // @ts-expect-error -- G 面纯增量:ApiResult 失败分支无 message;对象空间落地补丁改读 res.error
      setError(res.message ?? 'failed')
    }
  }, [])

  React.useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh])

  /** 停止工单(撤授权)。POST /tickets/:id/stop。 */
  const stop = React.useCallback(
    async (ticketId: string) => {
      setBusy(true)
      try {
        await fetchApi(`/super-agent/tickets/${encodeURIComponent(ticketId)}/stop`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'web 面板停止' }),
        })
      } finally {
        setBusy(false)
        void refresh()
      }
    },
    [refresh],
  )

  /**
   * 把一条"只记账"的推断消息点名开工。POST /recorded/:id/accept。
   * ruleId='model-slow-path' = 慢路径建议的人工确认;控制面门:auto 档 ∧ 非机器人 ∧(未判过则只记账)。
   */
  const approveRecorded = React.useCallback(
    async (triggerId: string, ruleId = 'model-slow-path') => {
      setBusy(true)
      try {
        const res = await fetchApi<{ disposition?: string; reason?: string }>(
          `/super-agent/recorded/${encodeURIComponent(triggerId)}/accept`,
          { method: 'POST', body: JSON.stringify({ ruleId }) },
        )
        return res
      } finally {
        setBusy(false)
        void refresh()
      }
    },
    [refresh],
  )

  return { panel, error, busy, refresh, stop, approveRecorded }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
