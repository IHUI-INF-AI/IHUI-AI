'use client'

import * as React from 'react'
import { FileText, Plus, Sparkles, Package } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { INPUT_ATTACHMENT_BAR_BTN_BASE } from '@/lib/nav-styles'
import { Popover } from '@/components/feedback'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { SkillLibrary } from '@/components/chat/skill-library'
import type { PromptTemplate } from '@/hooks/use-slash-action'

/**
 * "添加"下拉菜单 Popover(2026-07-25 终极整合,2026-07-30 提取自 message-input.tsx)
 *
 * 收纳 5 类动作,内部按 mode 切换 content:
 * - menu:5 项主菜单(模板 / 引用 / Skill 库 / 附件 / 插件)
 * - prompt:PromptTemplates 弹层
 * - skill:SkillLibrary 弹层
 *
 * 避免嵌套弹层,trigger 始终是"添加"按钮,焦点 / 坐标 / ESC 行为统一。
 *
 * 行为零变更(与提取前 message-input.tsx 完全一致):
 * - 关闭时重置为 menu 态(下次打开从 menu 开始)
 * - "添加引用"在流式中或输入框为空时禁用
 * - "添加附件"在流式中禁用
 * - 所有动作执行后关闭 Popover + 重置 mode 为 menu(除 prompt / skill 子层切换外)
 */
export function AddMenuPopover(props: {
  open: boolean
  onOpenChange: (next: boolean) => void
  mode: 'menu' | 'prompt' | 'skill'
  onModeChange: (mode: 'menu' | 'prompt' | 'skill') => void
  isStreaming: boolean
  /** 当前输入框文本(用于"添加引用" disabled 判定) */
  inputValue: string
  promptTemplates: PromptTemplate[]
  /** PromptTemplates 选中回调(主组件负责 fillInput + 关闭 + 重置 mode) */
  onTemplateSelect: (content: string) => void
  /** SkillLibrary 选中回调(主组件负责 fillInput + 关闭 + 重置 mode) */
  onSkillSelect: (template: string) => void
  /** SkillLibrary 关闭回调(主组件负责关闭 + 重置 mode) */
  onSkillClose: () => void
  /** SkillLibrary 发送到聊天回调(将 AI Skill 结果内容发送到对话输入框) */
  onSkillSendToChat?: (content: string) => void
  /** "添加附件"回调(主组件负责关闭 + 重置 mode + 触发 file input click) */
  onAddFile: () => void
  /** "添加引用"回调(主组件负责关闭 + 重置 mode + addTextReference + 清空 + resize) */
  onAddTextReference: () => void
  /** "插件市场"回调(主组件负责关闭 + 重置 mode + 跳转 /plugins) */
  onOpenPluginMarket: () => void
}): React.JSX.Element {
  const t = useTranslations('chat')
  const tA11y = useTranslations('a11y')
  const tNav = useTranslations('nav')
  const {
    open,
    onOpenChange,
    mode,
    onModeChange,
    isStreaming,
    inputValue,
    promptTemplates,
    onTemplateSelect,
    onSkillSelect,
    onSkillClose,
    onSkillSendToChat,
    onAddFile,
    onAddTextReference,
    onOpenPluginMarket,
  } = props

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        // 关闭时重置为菜单态,下次打开从 menu 开始
        if (!next) onModeChange('menu')
      }}
      content={
        mode === 'prompt' ? (
          <div className="w-72">
            <PromptTemplates
              templates={promptTemplates}
              onSelect={(content) => {
                onTemplateSelect(content)
              }}
            />
          </div>
        ) : mode === 'skill' ? (
          <SkillLibrary
            onSelect={(template) => {
              onSkillSelect(template)
            }}
            onClose={() => {
              onSkillClose()
            }}
            onSendToChat={onSkillSendToChat}
          />
        ) : (
          <div
            role="menu"
            aria-label={t('addMenuDesc')}
            className="flex w-60 flex-col gap-0.5"
          >
            <button
              type="button"
              role="menuitem"
              disabled={isStreaming}
              onClick={() => {
                onModeChange('prompt')
              }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{t('promptTemplate')}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/60">→</span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={isStreaming || !inputValue.trim()}
              onClick={() => {
                if (!inputValue.trim()) return
                onAddTextReference()
              }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{t('addContextReference')}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={isStreaming}
              onClick={() => {
                onModeChange('skill')
              }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{t('skillLibrary.title')}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/60">→</span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={isStreaming}
              onClick={() => {
                onAddFile()
              }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{tA11y('addAttachment')}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={isStreaming}
              onClick={() => {
                onOpenPluginMarket()
              }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{tNav('pluginMarket')}</span>
            </button>
          </div>
        )
      }
      position="bottom"
      trigger="click"
      portal
      align="start"
      tooltip={open ? undefined : t('addMenuLabel')}
    >
      <button
        type="button"
        aria-label={t('addMenuLabel')}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isStreaming}
        className={cn(
          // 2026-08-07 修:基础规格提取到 INPUT_ATTACHMENT_BAR_BTN_BASE(h-7 + leading-none + whitespace-nowrap + shrink-0),
          // 从原 py-1(无 h-,靠 padding + 文字行高 ≈ 22-26px)提到 h-7(28px),与权限/历史按钮严丝合缝对齐,
          // 根治三个 button 高度参差问题(最大差 10px)
          INPUT_ATTACHMENT_BAR_BTN_BASE,
          // 保留原 hover:-translate-y-px 微动效(2026-07-25 立的差异化)
          'hover:-translate-y-px',
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        <span>{t('addMenuLabel')}</span>
      </button>
    </Popover>
  )
}
