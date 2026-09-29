// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 推理强度第三轴的**挂载层**(D130,2026-09-30 立)—— 把纯展示件 `reasoning-effort-axis`
// 接到 web 的三个真相源上:档位状态、置灰依据、后端回落通知。
//
// 为什么单独一层:`reasoning-effort-axis.tsx` 是**无状态展示件**(值域来自 @ihui/types,
// 判灰来自唯一出口 reasoningEffortSelectable),它不该知道 conversationId 从哪来、
// 档位存在哪、通知是谁写的。把这三件事写在同一层,输入区那侧就只剩一行挂载 ——
// 而"这一行被摘掉"正是本票反向对照要抓的那一型(组件在、判据对、无人调用)。
//
// 三条落点选择(都不是随手,换了就要连带换判据):
// ① 档位状态住 `useSamplingParamsStore` —— 它是本仓「会话级请求参数 → 发送时一次性快照 →
//    随请求下发」的既有唯一通道(send-message.ts 已在此读 temperature/topP)。
//    另起一个 store 就是第二套快照时机:流式途中用户改档,一套读快照一套读实时值,
//    同一轮请求里两种档位。
// ② 置灰依据 = 当前模型的 `capabilities`,数据源仍是 `fetchSelectorModels()`(与模型选择器
//    同一个出口,不新建第四份能力表)。取不到 / 模型不在列表 / 'auto' ⇒ capabilities 为
//    undefined ⇒ 走 `reasoningEffortSelectable` 的"未知不误藏",轴照常可用。
// ③ 回落通知读 `useChatStore.reasoningEffortNotice`(由 send-message.ts 的
//    onReasoningEffortNotice 写入)。通知**不在本层清空**:它的生命周期属于"那一轮",
//    清空点只有两处 —— 新一轮发起前(sendMessage 体)与新建对话(clearMessages)。

'use client'

import * as React from 'react'

import type { ModelCapabilities, ReasoningEffort } from '@ihui/types'

import ReasoningEffortAxis from '@/components/chat/reasoning-effort-axis'
import { fetchSelectorModels } from '@/lib/models-api'
import { resolveSamplingParams, useSamplingParamsStore } from '@/stores/sampling-params'
import { useChatStore } from '@/stores/chat'

export interface ReasoningEffortInputAxisProps {
  /** 当前选中的模型 ID(驱动 capabilities 判灰;'auto' 与查不到的模型一律按"未知"处理) */
  model: string
  /** 外部禁用(流式生成中),与工具栏其余控件同一口径 */
  disabled?: boolean
}

export function ReasoningEffortInputAxis({ model, disabled }: ReasoningEffortInputAxisProps) {
  const conversationId = useChatStore((s) => s.conversationId)
  const defaults = useSamplingParamsStore((s) => s.defaults)
  const byConversation = useSamplingParamsStore((s) => s.byConversation)
  const setParam = useSamplingParamsStore((s) => s.setParam)
  const notice = useChatStore((s) => s.reasoningEffortNotice)

  const params = React.useMemo(
    () => resolveSamplingParams(defaults, byConversation, conversationId),
    [byConversation, conversationId, defaults],
  )

  // 当前模型的能力位。'auto' 是路由档(后端替用户挑模型),对它谈"这个模型支不支持"没有意义
  // ⇒ 按未知处理、不置灰,与 model-tier-utils 的 filterByCapabilities 同一语义。
  const [capabilities, setCapabilities] = React.useState<ModelCapabilities | undefined>(undefined)
  React.useEffect(() => {
    if (!model || model === 'auto') {
      setCapabilities(undefined)
      return
    }
    let cancelled = false
    // 复用模型选择器那一个出口;失败/空返回 [] ⇒ capabilities 停在 undefined(未知),
    // 轴**不会**因为拉不到列表就把档位藏起来。
    fetchSelectorModels()
      .then((models) => {
        if (cancelled) return
        setCapabilities(models.find((m) => m.id === model)?.capabilities)
      })
      .catch(() => {
        if (!cancelled) setCapabilities(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [model])

  return (
    <ReasoningEffortAxis
      value={params.reasoningEffort}
      capabilities={capabilities}
      notice={notice}
      disabled={disabled}
      onChange={(next?: ReasoningEffort) => setParam(conversationId, 'reasoningEffort', next)}
    />
  )
}

export default ReasoningEffortInputAxis
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
