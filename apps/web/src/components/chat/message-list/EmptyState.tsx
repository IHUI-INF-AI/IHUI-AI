// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { PromptTemplates } from '@/components/ai/prompt-templates'

export interface EmptyStateProps {
  isLoading?: boolean
  loadingLabel?: string
  emptyTitle: string
  emptyHint: string
  onTemplateSelect?: (content: string) => void
  t: (key: string) => string
}

/** 空状态:引导模板 + 加载/标题提示(2026-07-28 立)。 */
export function EmptyState({
  isLoading,
  loadingLabel,
  emptyTitle,
  emptyHint,
  onTemplateSelect,
  t,
}: EmptyStateProps) {
  // 空状态引导模板与附加栏 Popover 共用同一组 5 个核心模板(i18n key 一致)。
  // category 字段已废弃(PromptTemplates 不再分组),做减法移除。
  const templates = onTemplateSelect
    ? [
        { id: 'summary', name: t('tplSummary'), content: t('tplSummaryContent') },
        { id: 'translate', name: t('tplTranslate'), content: t('tplTranslateContent') },
        { id: 'explain', name: t('tplExplain'), content: t('tplExplainContent') },
        { id: 'code', name: t('tplCode'), content: t('tplCodeContent') },
        { id: 'polish', name: t('tplPolish'), content: t('tplPolishContent') },
      ]
    : []
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      {/* 与 LoginDialog / 全站统一:纯图标版 logo.png(蝴蝶结 + IHUI INF 弧形,无横向文字),非左上角位置统一资产。
          56px 适配小空状态,加 rounded-xl + select-none + priority + draggable=false 与品牌主视觉一致。 */}
      <Image
        src="/images/logo.png?v=20260719-unify"
        alt="IHUI AI"
        width={56}
        height={56}
        className="h-14 w-14 select-none rounded-xl"
        draggable={false}
        unoptimized
        priority
      />
      {isLoading && <Loader2 className="h-7 w-7 animate-spin" />}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{loadingLabel}</p>
      ) : (
        <div className="space-y-1">
          <p className="text-base font-medium">{emptyTitle}</p>
          <p className="max-w-xs text-sm text-muted-foreground">{emptyHint}</p>
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
