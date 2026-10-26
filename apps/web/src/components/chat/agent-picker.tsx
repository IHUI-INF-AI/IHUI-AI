// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Loader2, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { fetchPersonaCatalog } from '@/lib/personas-api'
import { usePaneChatStore } from '@/stores/chat-pane-context'

/**
 * AgentPicker — 对话内 Agent(专家)选择器(票 D01 / G-228,2026-10-25 立)
 *
 * 对标 WorkBuddy「点击专家即切换」:输入区模型选择器**旁边**加一枚胶囊,
 * 列出 ai-service `PERSONAS_CONTRACTS` 的 persona(经 GET /api/llm/personas 拉取)
 * + 各自工具白名单摘要;选中后写 chat store `selectedAgentId`,
 * 由 send-message.ts 随请求上行(personaId → 传输槽 agentId),
 * ai-service 侧把该 persona 的契约摘要并入 system、工具白名单并集进本轮工具。
 *
 * 边界(D01 票面):
 *  - 与 D12 expert-packs 市场管理面共用同一 persona 数据面,这里**不写死名单**、
 *    **不定义第二份 persona/工具映射**,只消费 `name/description/tools` 投影。
 *  - 不新造下拉体系:复用 `@/components/ui/dropdown-menu`(与 ModelSelector/ModeSwitcher 同族)。
 *  - 胶囊形态与 ModelSelector 触发键同规格(h-8 / rounded-sm / border-input / text-sm),
 *    保证底栏单行时两枚控件视觉同权。
 */
export function AgentPicker() {
  const t = useTranslations('chat')
  const chatStore = usePaneChatStore()
  const selectedAgentId = chatStore((s) => s.selectedAgentId)
  const setSelectedAgentId = chatStore((s) => s.setSelectedAgentId)

  // 目录拉取失败 → 空数组(降级为仅"默认专家"一项,输入区不因后端抖动而空掉)
  const { data: personas = [], isLoading } = useQuery({
    queryKey: ['chat-persona-catalog'],
    queryFn: fetchPersonaCatalog,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  // 胶囊文案直接用 persona id(与后端注册表同名,不做前端别名映射 —— 避免第二份命名表)
  const selectedLabel = selectedAgentId ?? t('agentPicker.default')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isLoading}
          aria-label={t('agentPicker.triggerAria')}
          data-testid="agent-picker-trigger"
          data-selected-agent={selectedAgentId ?? ''}
          className={cn(
            'inline-flex h-8 min-w-0 items-center gap-1 rounded-sm border border-input bg-card px-2 text-sm font-medium transition-colors',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
            // 选中专家时主色描边,让"当前不是默认助手"在底栏一眼可见
            selectedAgentId && 'border-primary/50 text-primary',
          )}
        >
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <span className="min-w-0 max-w-[6rem] truncate">{selectedLabel}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className={cn(
          'z-popover max-h-[60vh] w-fit max-w-[320px] overflow-y-auto rounded-lg border bg-card p-1 text-card-foreground shadow-md',
          '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30',
        )}
      >
        <DropdownMenuItem
          onSelect={() => setSelectedAgentId(null)}
          data-testid="agent-picker-item-default"
          className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
        >
          <Check
            className={cn(
              'h-4 w-4 shrink-0',
              selectedAgentId === null ? 'opacity-100' : 'opacity-0',
            )}
          />
          <span className="flex-1 truncate font-medium">{t('agentPicker.default')}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {t('agentPicker.defaultDesc')}
          </span>
        </DropdownMenuItem>
        {personas.length > 0 && <DropdownMenuSeparator className="my-1 h-px bg-border/60" />}
        {personas.length > 0 && (
          <DropdownMenuLabel className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('agentPicker.groupTitle')}
          </DropdownMenuLabel>
        )}
        {personas.map((p) => {
          const active = p.name === selectedAgentId
          return (
            <DropdownMenuItem
              key={p.name}
              onSelect={() => setSelectedAgentId(p.name)}
              data-testid={`agent-picker-item-${p.name}`}
              data-active={active ? 'true' : 'false'}
              className="flex cursor-pointer select-none items-start gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
            >
              <Check
                className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{p.name}</span>
                {p.description && (
                  <span className="truncate text-[11px] font-normal text-muted-foreground">
                    {p.description}
                  </span>
                )}
                {p.tools.length > 0 && (
                  <span
                    className="truncate text-[10px] font-normal text-muted-foreground/70"
                    data-testid={`agent-picker-tools-${p.name}`}
                  >
                    {t('agentPicker.toolsSummary', { tools: p.tools.join(' · ') })}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default AgentPicker
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
