// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Loader2 } from 'lucide-react'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { Xiaofang } from '@/components/brand/Xiaofang'

export interface EmptyStateProps {
  isLoading?: boolean
  loadingLabel?: string
  emptyTitle: string
  emptyHint: string
  /** 深链锚点失败等场景置 false:只显示空态文案,不渲染「开始新任务」模板。 */
  showTemplates?: boolean
  onTemplateSelect?: (content: string) => void
  t: (key: string) => string
}

/** 空状态:引导模板 + 加载/标题提示(2026-07-28 立)。 */
export function EmptyState({
  isLoading,
  loadingLabel,
  emptyTitle,
  emptyHint,
  showTemplates = true,
  onTemplateSelect,
  t,
}: EmptyStateProps) {
  // 空状态引导模板与附加栏 Popover 共用同一组 5 个核心模板(i18n key 一致)。
  // category 字段已废弃(PromptTemplates 不再分组),做减法移除。
  const templates =
    showTemplates && onTemplateSelect
      ? [
          { id: 'summary', name: t('tplSummary'), content: t('tplSummaryContent') },
          { id: 'translate', name: t('tplTranslate'), content: t('tplTranslateContent') },
          { id: 'explain', name: t('tplExplain'), content: t('tplExplainContent') },
          { id: 'code', name: t('tplCode'), content: t('tplCodeContent') },
          { id: 'polish', name: t('tplPolish'), content: t('tplPolishContent') },
        ]
      : []
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-3 text-center">
      {/* 品牌吉祥物「小方」接入空态(2026-11-15):AI 对话的"在场者"由品牌角色承担,
          替代此前的纯图标版 logo.png。这里用原始「招手」动图,空态是唯一需要"打招呼"的位;
          其余位置用矢量化静态版。alt="" —— 下方标题+提示已是同一信息的可读文本。 */}
      <Xiaofang variant="wave" size={144} alt="" priority />
      {isLoading && <Loader2 className="h-7 w-7 animate-spin" />}
      {isLoading ? (
        <p className="text-body text-muted-foreground">{loadingLabel}</p>
      ) : (
        <div className="space-y-1">
          <p className="text-base font-medium">{emptyTitle}</p>
          <p className="max-w-xs text-body text-muted-foreground">{emptyHint}</p>
        </div>
      )}
      {!isLoading && templates.length > 0 && (
        // 空状态使用 chips variant:水平胶囊按钮,与附加栏 Popover 视觉风格协调。
        <div className="w-full max-w-2xl">
          <PromptTemplates templates={templates} onSelect={onTemplateSelect!} variant="chips" />
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
