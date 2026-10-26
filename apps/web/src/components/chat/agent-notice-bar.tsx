// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FoldableSection } from '@/components/ai/progress-sections/foldable-section'
import { fetchPersonaCatalog } from '@/lib/personas-api'
import { usePaneChatStore } from '@/stores/chat-pane-context'

/**
 * AgentNoticeBar — 输入区「已切换 XX 专家」交代条(票 D01 / G-228,2026-10-25 立)
 *
 * 形态与 SteerNoticeBar / MemoryNoticeBar 同族(FoldableSection:折叠头 + 展开正文),
 * 让"这一轮不是默认助手在答"在会话流里始终可见,不必回想底栏胶囊选了什么。
 *
 * 数据:chat store `selectedAgentId`(唯一真相)+ 与 AgentPicker 同一个
 * ['chat-persona-catalog'] 查询缓存(同 key ⇒ 不重复请求)。
 * 未选专家时整条不渲染(零占位,存量行为逐字节不变)。
 */
export function AgentNoticeBar() {
  const t = useTranslations('chat')
  const chatStore = usePaneChatStore()
  const selectedAgentId = chatStore((s) => s.selectedAgentId)
  const setSelectedAgentId = chatStore((s) => s.setSelectedAgentId)

  // enabled 守门:未选专家时不发请求;queryKey 与 AgentPicker 同源,命中同一缓存
  const { data: personas = [] } = useQuery({
    queryKey: ['chat-persona-catalog'],
    queryFn: fetchPersonaCatalog,
    staleTime: 5 * 60_000,
    enabled: Boolean(selectedAgentId),
  })

  // Hooks 已全部执行,此处才能安全早返回
  if (!selectedAgentId) return null

  const current = personas.find((p) => p.name === selectedAgentId)

  return (
    <FoldableSection
      title={t('agentNoticeBar.title', { agent: selectedAgentId })}
      icon={Users}
      defaultOpen
      data-testid="agent-notice-bar"
    >
      <div className="flex flex-col gap-1 py-0.5">
        <span className="text-[11px] leading-relaxed text-muted-foreground">
          {t('agentNoticeBar.body', { agent: selectedAgentId })}
        </span>
        {current && current.tools.length > 0 && (
          <span
            className="text-[10px] leading-relaxed text-muted-foreground/70"
            data-testid="agent-notice-bar-tools"
          >
            {t('agentPicker.toolsSummary', { tools: current.tools.join(' · ') })}
          </span>
        )}
        {/* 复位入口放在展开体而非 headerExtra:FoldableSection 的头部本身是 <button>,
            内嵌按钮会构成嵌套交互控件(React 会告警、a11y 也不合法)。 */}
        <button
          type="button"
          onClick={() => setSelectedAgentId(null)}
          data-testid="agent-notice-bar-reset"
          className="w-fit rounded-sm text-[11px] font-normal text-primary/80 underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {t('agentNoticeBar.reset')}
        </button>
      </div>
    </FoldableSection>
  )
}

export default AgentNoticeBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
