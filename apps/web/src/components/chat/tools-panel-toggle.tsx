// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { useTranslations } from 'next-intl'
import { Check, Wrench } from 'lucide-react'
import { usePaneAiToolsPanelStore } from '@/stores/ai-tools-panel'
import { cn } from '@/lib/utils'
import {
  COMPOSER_MENU_ROW_CLASS,
  COMPOSER_MENU_ROW_ICON_CLASS,
  COMPOSER_MENU_ROW_VALUE_CLASS,
} from '@/lib/composer-menu-row'

/**
 * 「+」菜单里的工具面板开关行(2026-11-16 立)。
 *
 * 背景:ChatMode 手动切换器整体删除后,原本藏在 ModeSwitcher 下拉菜单里的
 * 「工具面板」入口一并消失 —— 而 AiSidePanelTools(Plan/Memory/Checkpoints/
 * Best-of/Hooks/RepoWiki 等面板)依赖它作为唯一开关。这里把该入口提为 + 菜单
 * 第一层的独立设置行,保留原 testid(menu-tools-panel)与窗格寻址语义
 * (usePaneAiToolsPanelStore,与 ai-side-panel-tools.tsx 的面板体同源)。
 */
export function ToolsPanelToggle({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations('chat')
  const tTools = useTranslations('aiToolsPanel')
  // 票60 普查批:按窗格寻址(Provider 外回落根单例 ⇒ 单窗格形态逐字不变)
  const toolsPanelStore = usePaneAiToolsPanelStore()
  const toolsPanelOpen = toolsPanelStore((s) => s.open)
  const toggleToolsPanel = toolsPanelStore((s) => s.toggle)

  return (
    <button
      type="button"
      disabled={disabled}
      data-testid="menu-tools-panel"
      data-panel-open={toolsPanelOpen}
      aria-pressed={toolsPanelOpen}
      onClick={() => toggleToolsPanel()}
      className={cn(COMPOSER_MENU_ROW_CLASS, toolsPanelOpen && 'bg-accent text-accent-foreground')}
    >
      <Wrench className={COMPOSER_MENU_ROW_ICON_CLASS} />
      <span className="min-w-0 flex-1 truncate">{tTools('title')}</span>
      <span className={COMPOSER_MENU_ROW_VALUE_CLASS}>
        {toolsPanelOpen ? t('toolsPanelClose') : t('toolsPanelOpen')}
      </span>
      {toolsPanelOpen && <Check className="h-3.5 w-3.5 shrink-0" />}
    </button>
  )
}
