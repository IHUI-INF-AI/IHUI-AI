// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { editIntentLineOf, type EditorEditIntentPrediction } from './use-edit-intent'

/**
 * 编辑器内的预测式编辑建议条(Trae CUE 对齐,2026-10-31)。
 *
 * 对齐面:CUE「感知代码变化、理解编辑意图,推荐单个或多个连续相关变更点」
 * (Trae CN 1.107.1 nls E1 逐字),建议条呈现 N 处变更点供审阅后应用。
 *
 * 超越面(相对 Trae CUE 1.107.1 的 all/line/word 三档接受 + prev/next 导航):
 * 1. **逐条选择性应用** —— 每条变更点是独立 checkbox(默认全选),用户勾选任意
 *    子集一次应用;Trae 只能按粒度接受或逐条导航,无法组合挑选。
 * 2. **悬停即预览** —— hover 任意一条,宿主(CodeEditor)立刻把该条区间画成
 *    高亮装饰;Trae 需长按才进入预览,且无法对照多条。
 *
 * 无障碍(H27 四件套,取自 Trae 思考卡无 aria-expanded 的实证缺陷):
 * 容器 role="status" + aria-live="polite",出现/消失可被读屏播报;
 * 关闭钮有 aria-label;禁用原生 title(§4)。
 */

export interface EditIntentBarProps {
  prediction: EditorEditIntentPrediction
  /** 应用勾选的动作子集(索引数组;宿主执行 executeEdits)。 */
  onApplySelected: (indices: number[]) => void
  onDismiss: () => void
  /** 悬停预览的条目索引;null = 停止预览。 */
  onPreviewIndexChange: (index: number | null) => void
  className?: string
}

const KIND_LABEL_KEY = {
  insert: 'predictiveEditInsert',
  replace: 'predictiveEditReplace',
  delete: 'predictiveEditDelete',
} as const

export function EditIntentBar({
  prediction,
  onApplySelected,
  onDismiss,
  onPreviewIndexChange,
  className,
}: EditIntentBarProps) {
  const t = useTranslations('chat')
  const [selected, setSelected] = React.useState<number[]>(() =>
    prediction.actions.map((_, index) => index),
  )
  // 换一条建议(引用不同)时重置为全选:新建议的条目集与旧条目无对应关系。
  React.useEffect(() => {
    setSelected(prediction.actions.map((_, index) => index))
  }, [prediction])
  // 卸载时确保预览装饰被清掉(宿主也兜底,这里显式对称)。
  React.useEffect(() => () => onPreviewIndexChange(null), [onPreviewIndexChange])

  const toggle = (index: number) => {
    setSelected((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index].sort((a, b) => a - b),
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="editor-edit-intent-bar"
      className={cn(
        'absolute right-3 top-2 z-20 flex max-w-[min(420px,calc(100%-1.5rem))] flex-col gap-1 rounded-sm border border-dashed border-border/60 bg-background/95 px-2 py-1.5 text-[11px] shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {t('predictiveEditChanges', { count: prediction.actions.length })}
        </span>
        <button
          type="button"
          onClick={() => onApplySelected(selected)}
          disabled={selected.length === 0}
          className={cn(
            'shrink-0 rounded-sm px-1.5 py-0.5 transition-colors',
            selected.length === 0
              ? 'cursor-not-allowed text-muted-foreground/50'
              : 'text-primary hover:bg-accent',
          )}
        >
          {t('predictiveEditApplySelected')}
        </button>
        <button
          type="button"
          aria-label={t('cancel')}
          onClick={onDismiss}
          className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {prediction.actions.map((action, index) => {
          const checked = selected.includes(index)
          return (
            <li key={`${action.kind}-${action.start}-${index}`}>
              <label
                onMouseEnter={() => onPreviewIndexChange(index)}
                onMouseLeave={() => onPreviewIndexChange(null)}
                onFocus={() => onPreviewIndexChange(index)}
                onBlur={() => onPreviewIndexChange(null)}
                className="flex cursor-pointer items-center gap-1.5 rounded-xs px-1 py-0.5 transition-colors hover:bg-accent/60"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(index)}
                  aria-label={`${t(KIND_LABEL_KEY[action.kind])} ${t('predictiveEditLine', { line: editIntentLineOf(prediction.document, action.start) })}`}
                  className="size-3 shrink-0 accent-[var(--color-primary)]"
                />
                <span
                  className={cn(
                    'shrink-0',
                    checked ? 'text-foreground' : 'text-muted-foreground/60 line-through',
                  )}
                >
                  {t('predictiveEditLine', {
                    line: editIntentLineOf(prediction.document, action.start),
                  })}
                </span>
                <span
                  className={cn(
                    'shrink-0',
                    checked ? 'text-foreground' : 'text-muted-foreground/60',
                  )}
                >
                  {t(KIND_LABEL_KEY[action.kind])}
                </span>
                <span
                  aria-hidden="true"
                  className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground/70"
                >
                  {action.kind === 'delete' ? '' : action.text.trim().slice(0, 60)}
                </span>
                <span className="sr-only">{t('predictiveEditPreview')}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
