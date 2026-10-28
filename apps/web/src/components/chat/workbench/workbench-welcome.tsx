// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 工作台欢迎面(2026-10-28 片D):新任务态的"能干清单"。
 *
 * 三层结构,组件与词汇全部接现成出口:
 *  - 标题/引导语:chat.workbenchHeroTitle/Hint(五语系在位键);
 *  - 快捷指令卡:模式(/plan /build)、上下文(@)、斜杠命令(/)四卡 ——
 *    取词走 chat ns 现成键(modePlanDesc/modeBuildDesc/addContextHint/placeholder),
 *    点击 = 把触发文本回填**本窗格草稿**(draftInput),与 ChatPaneBody 的
 *    onTemplateSelect 同一回填机制,不旁路 setText、不劫持输入框内部;
 *  - 模板 chips:内核件 PromptTemplates(variant='chips',数据构造与 EmptyState 同口径五键)。
 * 真实消息一出现即由宿主切回 MessageList,本件只活在新任务态。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AtSign, Compass, Layers, Hammer, Slash } from 'lucide-react'

import { PromptTemplates } from '@/components/ai/prompt-templates'
import { cn } from '@/lib/utils'

export interface WorkbenchWelcomeProps {
  /** 回填本窗格草稿(draftInput)的统一出口,宿主用 chatStore.setState 实现 */
  onPrefill: (text: string) => void
}

export function WorkbenchWelcome({ onPrefill }: WorkbenchWelcomeProps) {
  const t = useTranslations('chat')
  const cards = React.useMemo(
    () => [
      {
        id: 'plan',
        icon: Compass,
        label: t('modePlan'),
        desc: t('modePlanDesc'),
        text: '/plan ',
      },
      {
        id: 'build',
        icon: Hammer,
        label: t('modeBuild'),
        desc: t('modeBuildDesc'),
        text: '/build ',
      },
      {
        id: 'context',
        icon: AtSign,
        label: t('addContextReference'),
        desc: t('addContextHint'),
        text: '@',
      },
      {
        id: 'slash',
        icon: Slash,
        label: t('slashCommand'),
        desc: t('placeholder'),
        text: '/',
      },
    ],
    [t],
  )
  // 模板五件套与 EmptyState(内核空态)同一构造口径与同一组词键,不留第二份数据源语义
  const templates = React.useMemo(
    () => [
      { id: 'summary', name: t('tplSummary'), content: t('tplSummaryContent') },
      { id: 'translate', name: t('tplTranslate'), content: t('tplTranslateContent') },
      { id: 'explain', name: t('tplExplain'), content: t('tplExplainContent') },
      { id: 'code', name: t('tplCode'), content: t('tplCodeContent') },
      { id: 'polish', name: t('tplPolish'), content: t('tplPolishContent') },
    ],
    [t],
  )

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 py-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Layers className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{t('workbenchHeroTitle')}</h2>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {t('workbenchHeroHint')}
        </p>
      </div>

      <div className="w-full max-w-xl">
        <h3 className="px-1 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          {t('workbenchQuickStart')}
        </h3>
        {/* 4 张快捷卡是原生 button,不再冒充 list/listitem:
            jsx-a11y/no-interactive-element-to-noninteractive-role 明确禁止交互元素赋非交互 role。
            button 自身的语义已足够,grid 仅负责视觉排布。 */}
        <div className="grid grid-cols-2 gap-2">
          {cards.map((c) => (
            <button
              key={c.id}
              type="button"
              draggable={false}
              onClick={() => onPrefill(c.text)}
              className={cn(
                'group flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 text-left',
                'transition-colors hover:border-primary/40 hover:bg-accent/60',
                'motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <c.icon
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{c.label}</span>
                <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                  {c.desc}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-xl pt-1">
        <PromptTemplates templates={templates} onSelect={onPrefill} variant="chips" />
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
