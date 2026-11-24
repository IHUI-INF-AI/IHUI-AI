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
import { fetchPoolChatModels } from '@ihui/api-client'

import ReasoningEffortAxis from '@/components/chat/reasoning-effort-axis'
import { fetchSelectorModels } from '@/lib/models-api'
import { resolveSamplingParams, useSamplingParamsStore } from '@/stores/sampling-params'
import { usePaneChatStore } from '@/stores/chat-pane-context'

export interface ReasoningEffortInputAxisProps {
  /** 当前选中的模型 ID(驱动 capabilities 判灰;'auto' 与查不到的模型一律按"未知"处理) */
  model: string
  /** 外部禁用(流式生成中),与工具栏其余控件同一口径 */
  disabled?: boolean
  /** auto 档下宿主解析出的实际模型 ID(2026-11-20):只用来把展示名换成列表里的可读名,
   *  **不参与置灰**(auto 的能力仍是"未知") */
  resolvedModel?: string
  /** 卡片头行左侧的展示名(2026-11-20 用户附图样式要求卡面写明当前模型);缺省由展示件回退到轴标题 */
  modelName?: string
  /** 卡片头行右侧圆钮 = 刷新模型列表(2026-11-21 用户定档);由模型弹层自己提供 */
  onRefreshModels?: () => void
  /** 刷新进行中(钮转圈) */
  refreshingModels?: boolean
}

export function ReasoningEffortInputAxis({
  model,
  disabled,
  resolvedModel,
  modelName,
  onRefreshModels,
  refreshingModels,
}: ReasoningEffortInputAxisProps) {
  // 票60 步序四:窗格寻址。根窗格无 Provider ⇒ 单例;非根窗格读各自实例。
  const chatStore = usePaneChatStore()
  const conversationId = chatStore((s) => s.conversationId)
  const defaults = useSamplingParamsStore((s) => s.defaults)
  const byConversation = useSamplingParamsStore((s) => s.byConversation)
  const setParam = useSamplingParamsStore((s) => s.setParam)
  const notice = chatStore((s) => s.reasoningEffortNotice)

  const params = React.useMemo(
    () => resolveSamplingParams(defaults, byConversation, conversationId),
    [byConversation, conversationId, defaults],
  )

  // 当前模型的能力位 + 展示名。'auto' 是路由档(后端替用户挑模型),对它谈"这个模型支不支持"
  // 没有意义 ⇒ 按未知处理、不置灰,与 model-tier-utils 的 filterByCapabilities 同一语义。
  // 展示名(2026-11-20 用户附图样式要求卡面写明模型)与能力位取自**同一次**列表拉取,
  // 不新增第三个出口;拉不到 name 时展示件回退到轴标题。
  const [meta, setMeta] = React.useState<{
    capabilities?: ModelCapabilities
    name?: string
    /** 该模型上游声明的档位子集(未声明 = undefined,轴按通用档呈现) */
    efforts?: ReasoningEffort[]
  }>({})
  React.useEffect(() => {
    // auto 档:能力位保持"未知"(不置灰),但若宿主给了实际模型 ID,仍去列表换一个可读名
    const lookupId = model === 'auto' ? resolvedModel : model
    if (!lookupId || lookupId === 'auto') {
      setMeta({})
      return
    }
    let cancelled = false
    // 复用模型选择器那一个出口;失败/空返回 [] ⇒ capabilities 停在 undefined(未知),
    // 轴**不会**因为拉不到列表就把档位藏起来。
    fetchSelectorModels()
      .then(async (models) => {
        if (cancelled) return
        const hit = models.find((m) => m.id === lookupId)
        let efforts: ReasoningEffort[] | undefined =
          model === 'auto'
            ? undefined
            : Array.isArray(hit?.reasoning_efforts)
              ? (hit?.reasoning_efforts as ReasoningEffort[])
              : undefined
        // 号池私有别名模型(hy4std 这类)不在平台模型清单里,档位只能来自
        // GET /api/account-pool/models 下发的**实测**结果(2026-11-21)。
        if (!efforts && model !== 'auto') {
          const pool = await fetchPoolChatModels()
          if (cancelled) return
          const poolHit = pool.find((m) => m.id === lookupId)
          efforts = Array.isArray(poolHit?.reasoning_efforts)
            ? (poolHit?.reasoning_efforts as ReasoningEffort[])
            : undefined
        }
        if (cancelled) return
        setMeta({
          capabilities: model === 'auto' ? undefined : hit?.capabilities,
          name: hit?.name,
          // 声明面与能力位同一来源(2026-11-21 D136):auto 档不采用,同样是"未知"
          efforts,
        })
      })
      .catch(() => {
        if (!cancelled) setMeta({})
      })
    return () => {
      cancelled = true
    }
  }, [model, resolvedModel])

  return (
    <ReasoningEffortAxis
      value={params.reasoningEffort}
      capabilities={meta.capabilities}
      efforts={meta.efforts}
      notice={notice}
      disabled={disabled}
      modelName={modelName ?? meta.name ?? (model === 'auto' ? undefined : model)}
      onRefreshModels={onRefreshModels}
      refreshingModels={refreshingModels}
      onChange={(next?: ReasoningEffort) => setParam(conversationId, 'reasoningEffort', next)}
    />
  )
}

export default ReasoningEffortInputAxis
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
