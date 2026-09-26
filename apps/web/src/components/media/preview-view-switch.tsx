// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Code, Eye } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

/**
 * PreviewViewSwitch — 产物预览的「渲染视图 ↔ 原始文本/源码视图」切换(D41 最后一格,2026-09-26 立)。
 *
 * 为什么单独成文件:office-preview(docx/xlsx/pptx)与 message-file-preview(pdf/csv)是两套
 * 宿主、两套取数路径,但"同一产物两视图可切"这一格契约必须只有一个实现 —— 各写一份就会
 * 出现"office 能切、CSV 切不了"这种按端分叉(同 §4「改了 web 手机上没改」那一族)。
 *
 * 三条不可动摇的形态约束:
 *  1. **降级不隐藏**:源码档不可用时按钮仍在 Tab 序里(aria-pressed + disabled),并在同行给出
 *     原因文案。隐藏等于把"这一档存在但此刻拿不到"这件事从可发现面上抹掉。
 *  2. **切视图 = 零取数**:本组件只负责 mode 与可用性,源码文本一律由调用方从**已在手里的**
 *     内容派生(见 office-preview 的 extractOfficeSourceText / CSV 的 raw),这里不出现 fetch。
 *  3. **缺词不喷键名**:取词走"有键取键、无键回落内联文案"(与 preview-degradation-copy 同一条
 *     规矩)—— 票面禁止本会话改 `packages/i18n/messages/**`,新键在主会话入词表之前界面必须
 *     仍是可读文案,而不是 `previewViewSource` 这种内部标识。
 */

export const PREVIEW_VIEW_NAMESPACE = 'chat' as const

export type PreviewViewMode = 'preview' | 'source'

export type PreviewViewCopyKey =
  | 'previewViewGroupLabel'
  | 'previewViewPreview'
  | 'previewViewSource'
  | 'previewSourceExtracting'
  | 'previewSourceExtractFailed'
  | 'previewSourceTruncated'
  | 'previewSourceUnavailableLoad'
  | 'previewSourceUnavailableTooLarge'
  | 'previewSourceUnavailableExpired'
  | 'previewSourceUnavailableUnsupported'
  | 'previewSourceUnavailableBinary'

/** 源码档不可用的原因键(是 PreviewViewCopyKey 的子集,别处不得自造新串)。 */
export type PreviewSourceUnavailableReason = Extract<
  PreviewViewCopyKey,
  | 'previewSourceUnavailableLoad'
  | 'previewSourceUnavailableTooLarge'
  | 'previewSourceUnavailableExpired'
  | 'previewSourceUnavailableUnsupported'
  | 'previewSourceUnavailableBinary'
>

/** 源码档可用性:available=false 时必须带 reason —— 没有"静默禁用"这一档。 */
export type PreviewSourceAvailability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: PreviewSourceUnavailableReason }

/** 已派生出的源码文本。 */
export interface PreviewSourceText {
  readonly text: string
  readonly truncated: boolean
}

/** 源码视图默认字符上限(超出即截断并如实说明,不静默变短)。 */
export const PREVIEW_SOURCE_MAX_CHARS = 200_000

/**
 * 内联兜底文案:与 `.ihui-agent/tmp/i18n-d41.json` 里建议入表的键值逐字一致。
 * 主会话入词表后本表退化为缺词兜底,取词点不改(每行标注 next-intl 是为了让守门 70
 * 把这批译文表按 i18n 数据放过 —— 删掉就等于把兜底也删了)。
 */
const PREVIEW_VIEW_COPY: Record<PreviewViewCopyKey, { readonly zh: string; readonly en: string }> =
  {
    previewViewGroupLabel: { zh: '预览视图切换', en: 'Preview view' }, // next-intl 缺词兜底
    previewViewPreview: { zh: '预览', en: 'Preview' }, // next-intl 缺词兜底
    previewViewSource: { zh: '源码', en: 'Source' }, // next-intl 缺词兜底
    previewSourceExtracting: { zh: '正在解析原始文本…', en: 'Reading raw text…' }, // next-intl 缺词兜底
    previewSourceExtractFailed: {
      zh: '无法从该文件解析出原始文本。', // next-intl 缺词兜底
      en: "This file's raw text can't be extracted.",
    },
    previewSourceTruncated: {
      zh: '内容过长，仅显示前 {chars} 个字符。', // next-intl 缺词兜底
      en: 'Content too long — showing the first {chars} characters.',
    },
    previewSourceUnavailableLoad: {
      zh: '加载完成后可查看原始文本。', // next-intl 缺词兜底
      en: 'Raw text is available once the file is loaded.',
    },
    previewSourceUnavailableTooLarge: {
      zh: '文件过大，内容未取回，原始文本不可用。', // next-intl 缺词兜底
      en: 'File too large — content was not fetched, so no raw text.',
    },
    previewSourceUnavailableExpired: {
      zh: '链接已失效，原始文本不可用。', // next-intl 缺词兜底
      en: 'Link expired — raw text unavailable.',
    },
    previewSourceUnavailableUnsupported: {
      zh: '该格式没有原始文本可显示。', // next-intl 缺词兜底
      en: 'This format has no raw text to show.',
    },
    previewSourceUnavailableBinary: {
      zh: 'PDF 由内嵌查看器渲染；取原始文本需要重新下载，这里不提供。', // next-intl 缺词兜底
      en: 'PDF renders in the embedded viewer; raw text would need a new download.',
    },
  }

export type PreviewViewValues = Record<string, string | number>
export type PreviewViewTranslator = (key: string, values?: PreviewViewValues) => string

function pickFallbackLocale(): 'zh' | 'en' {
  if (typeof navigator === 'undefined') return 'zh'
  const tag = typeof navigator.language === 'string' ? navigator.language.toLowerCase() : ''
  return tag.startsWith('zh') ? 'zh' : 'en'
}

function interpolate(text: string, values?: PreviewViewValues): string {
  if (!values) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole,
  )
}

/** 取词结果是否可信(排除喷键名、next-intl 的 MISSING_MESSAGE、空串)。 */
function isUsableTranslation(out: unknown, key: string): out is string {
  if (typeof out !== 'string') return false
  const trimmed = out.trim()
  if (trimmed === '' || trimmed === key) return false
  if (trimmed.includes('MISSING_MESSAGE') || trimmed.includes(`[${key}]`)) return false
  return true
}

export function previewViewCopyText(
  t: PreviewViewTranslator | undefined,
  key: PreviewViewCopyKey,
  values?: PreviewViewValues,
): string {
  if (t) {
    try {
      const out = t(key, values)
      if (isUsableTranslation(out, key)) return out
    } catch {
      // next-intl 缺键会抛 MISSING_MESSAGE —— 属预期路径,回落内联文案而非喷键名
    }
  }
  const entry = PREVIEW_VIEW_COPY[key]
  return interpolate(entry[pickFallbackLocale()], values)
}

/** 组件侧取词适配器:调用点只需一个 copy(key[, values])。 */
export function usePreviewViewCopy(): (
  key: PreviewViewCopyKey,
  values?: PreviewViewValues,
) => string {
  const t = useTranslations(PREVIEW_VIEW_NAMESPACE) as PreviewViewTranslator
  return React.useCallback(
    (key: PreviewViewCopyKey, values?: PreviewViewValues) => previewViewCopyText(t, key, values),
    [t],
  )
}

export interface PreviewViewSwitchProps {
  readonly mode: PreviewViewMode
  readonly onModeChange: (mode: PreviewViewMode) => void
  readonly source: PreviewSourceAvailability
  readonly className?: string
}

/**
 * 两枚 toggle 按钮(同一 role="group",键盘逐档可达)。
 * 源码档不可用时**不隐藏**:disabled + 同行原因,是这一格唯一的降级形态。
 */
export function PreviewViewSwitch({
  mode,
  onModeChange,
  source,
  className,
}: PreviewViewSwitchProps): React.ReactElement {
  const copy = usePreviewViewCopy()
  const sourceDisabled = !source.available
  const reasonId = React.useId()
  return (
    <div
      data-testid="preview-view-switch"
      data-source-available={sourceDisabled ? 'false' : 'true'}
      className={cn('flex shrink-0 flex-col items-end gap-0.5', className)}
    >
      <span
        role="group"
        aria-label={copy('previewViewGroupLabel')}
        className="flex items-center gap-1"
      >
        <Button
          size="xs"
          variant={mode === 'preview' ? 'secondary' : 'ghost'}
          className="px-1.5 text-[10px]"
          aria-pressed={mode === 'preview'}
          data-testid="preview-view-preview"
          onClick={() => onModeChange('preview')}
        >
          <Eye className="h-3 w-3" />
          <span>{copy('previewViewPreview')}</span>
        </Button>
        <Button
          size="xs"
          variant={mode === 'source' ? 'secondary' : 'ghost'}
          className="px-1.5 text-[10px]"
          aria-pressed={mode === 'source'}
          disabled={sourceDisabled}
          aria-describedby={sourceDisabled ? reasonId : undefined}
          data-testid="preview-view-source"
          onClick={() => onModeChange('source')}
        >
          <Code className="h-3 w-3" />
          <span>{copy('previewViewSource')}</span>
        </Button>
      </span>
      {sourceDisabled && (
        <span
          id={reasonId}
          role="note"
          data-testid="preview-view-source-reason"
          className="max-w-[240px] text-right text-[10px] leading-tight text-muted-foreground"
        >
          {copy(source.reason)}
        </span>
      )}
    </div>
  )
}

export interface PreviewSourceTextProps {
  readonly status: 'extracting' | 'failed' | 'ready'
  readonly text: string
  readonly truncated: boolean
  /** 截断阈值,写进如实说明的文案里。 */
  readonly maxChars?: number
  readonly className?: string
  readonly testId?: string
}

/**
 * 源码视图正文:解析中 / 解析失败 / 已出文本三态**各有可见文案**,不存在空白档。
 */
export function PreviewSourceText({
  status,
  text,
  truncated,
  maxChars = PREVIEW_SOURCE_MAX_CHARS,
  className,
  testId = 'preview-source-text',
}: PreviewSourceTextProps): React.ReactElement {
  const copy = usePreviewViewCopy()
  if (status === 'extracting') {
    return (
      <p
        data-testid={testId}
        data-source-state="extracting"
        className="p-3 text-xs text-muted-foreground"
      >
        {copy('previewSourceExtracting')}
      </p>
    )
  }
  if (status === 'failed') {
    return (
      <p
        data-testid={testId}
        data-source-state="failed"
        role="status"
        className="p-3 text-xs text-muted-foreground"
      >
        {copy('previewSourceExtractFailed')}
      </p>
    )
  }
  return (
    <div data-testid={testId} data-source-state="ready" className="overflow-hidden">
      {truncated && (
        <p className="px-3 pt-1 text-[10px] leading-tight text-muted-foreground">
          {copy('previewSourceTruncated', { chars: maxChars })}
        </p>
      )}
      <pre
        className={cn(
          'max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs',
          className,
        )}
      >
        {text}
      </pre>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
