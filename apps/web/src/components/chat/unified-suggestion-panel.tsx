// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D68 统一多源建议面板 —— 渲染层。
// 六源(任务/技能/插件/连接器/Agent/文件)聚合于**一个**建议面板,逐源来源标注,
// 部分失败按三句降级(判定全部在 unified-suggestion-panel.ts,本文件只渲染)。
// 「引用标签不新增执行授权」声明以**可见文本**渲染在面板底部(台账 D68 安全澄清,
// 不是 aria-only、不是 tooltip),由用例断言其出现在渲染树里。
// 内边距档位:复合面板(§4 浮动弹层内边距规范第四档)——外层零 padding,行级自带
// px-3 py-*;定位/z-index 全部走 PortalPanel(z-popover 内置),不自创中间值。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Bot,
  Cable,
  FileText,
  ListTodo,
  Loader2,
  Puzzle,
  Sparkles,
  X,
} from 'lucide-react'

import { SearchInput } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { PortalPanel } from '@/components/feedback/portal-panel'

import {
  aggregateUnifiedSuggestions,
  computeDegradationNotice,
  resolveProvenance,
  SUGGESTION_SOURCE_KINDS,
  MAX_PANEL_REFERENCES,
  type PastedReferencePreview,
  type SuggestionProvenance,
  type SuggestionSourceKind,
  type SuggestionSourceState,
  type UnifiedSuggestionItem,
} from './unified-suggestion-sources'

/** 每源固定 lucide 图标(禁止 emoji;顺序与 SUGGESTION_SOURCE_KINDS 同形) */
const SOURCE_ICON: Record<SuggestionSourceKind, React.ComponentType<{ className?: string }>> = {
  task: ListTodo,
  skill: Sparkles,
  plugin: Puzzle,
  connector: Cable,
  agent: Bot,
  file: FileText,
}

/** 源标签 / 来源标注一律 switch + 字面量 t() 键(死 key 扫描按字面量对账,禁动态拼键) */
function sourceLabelKey(kind: SuggestionSourceKind): string {
  switch (kind) {
    case 'task':
      return 'sourceTask'
    case 'skill':
      return 'sourceSkill'
    case 'plugin':
      return 'sourcePlugin'
    case 'connector':
      return 'sourceConnector'
    case 'agent':
      return 'sourceAgent'
    case 'file':
      return 'sourceFile'
  }
}

function provenanceLabelKey(p: SuggestionProvenance): string {
  switch (p) {
    case 'builtin':
      return 'provBuiltin'
    case 'userLocal':
      return 'provUserLocal'
    case 'userRemote':
      return 'provUserRemote'
    case 'project':
      return 'provProject'
    case 'market':
      return 'provMarket'
    case 'pluginProvided':
      return 'provPluginProvided'
  }
}

export interface UnifiedSuggestionPanelProps {
  open: boolean
  /** 锚点(输入区容器),PortalPanel 以它定位(与三浮层同一契约) */
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  /** 六源状态(含 file 源;由 useUnifiedSuggestions + 宿主文件列表合并而来) */
  states: readonly SuggestionSourceState[]
  /** 选中一条建议(宿主负责插入 + 上限判定 + 关闭) */
  onSelect: (item: UnifiedSuggestionItem) => void
  /** 某源取数失败后的重试(宿主把该源状态复位并重新拉取) */
  onRetry?: (source: SuggestionSourceKind) => void
  /** 引用已达上限(宿主 capReferences 判出 rejected 时置 true;拒收必须可见) */
  capRejected?: boolean
}

export function UnifiedSuggestionPanel({
  open,
  anchorRef,
  onClose,
  states,
  onSelect,
  onRetry,
  capRejected = false,
}: UnifiedSuggestionPanelProps) {
  const t = useTranslations('unifiedSuggestion')
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const sections = React.useMemo(
    () => aggregateUnifiedSuggestions(states, query),
    [states, query],
  )
  // 只渲染"有内容可说"的分节:ready+有条目 / loading / failed;
  // 六源聚合的完整性由 aggregateUnifiedSuggestions + 用例守住,不靠渲染层凑数。
  const visibleSections = React.useMemo(
    () =>
      sections.filter(
        (s) => s.status === 'loading' || s.status === 'failed' || s.items.length > 0,
      ),
    [sections],
  )
  const flatItems = React.useMemo(
    () => visibleSections.flatMap((s) => s.items.map((item) => ({ section: s, item }))),
    [visibleSections],
  )
  const degradation = React.useMemo(() => computeDegradationNotice(states), [states])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const count = flatItems.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (count === 0 ? 0 : Math.min(prev + 1, count - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const current = flatItems[activeIndex]
      if (current) {
        onSelect(current.item)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const renderDegradation = (): React.ReactNode => {
    if (degradation.kind === 'none') return null
    const joinKinds = (kinds: SuggestionSourceKind[]) =>
      kinds.map((k) => t(sourceLabelKey(k))).join('、')
    let text = ''
    switch (degradation.kind) {
      case 'single':
        text = t('degradeSingle', { failed: t(sourceLabelKey(degradation.failed)) })
        break
      case 'partial':
        text = t('degradePartial', {
          failed: joinKinds(degradation.failed),
          ok: joinKinds(degradation.usable),
        })
        break
      case 'all':
        text = t('degradeAll')
        break
    }
    return (
      <p
        data-testid="unified-suggestion-degradation"
        data-degradation-kind={degradation.kind}
        className="bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
      >
        {text}
      </p>
    )
  }

  return (
    <PortalPanel
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      side="top"
      align="start"
      gap={8}
      testId="unified-suggestion-panel"
      className="flex w-96 flex-col overflow-hidden rounded-md border border-border bg-popover shadow-md"
    >
      <SearchInput
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('searchPlaceholder')}
        clearable
        clearAriaLabel={t('clearAriaLabel')}
        wrapperClassName="p-1.5"
      />
      {renderDegradation()}
      {capRejected && (
        <p
          data-testid="unified-suggestion-cap-notice"
          className="bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
        >
          {t('referenceCapFull', { max: MAX_PANEL_REFERENCES })}
        </p>
      )}
      {/* 键盘导航只挂在搜索输入上(焦点打开即落此处;与 FileMentionPopover 同姿势,
          容器不接 onKeyDown 以免触发 jsx-a11y 非原生交互元素告警) */}
      <div ref={listRef} className="thin-scroll max-h-72 min-h-0 flex-1 overflow-y-auto p-1.5">
        {flatItems.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-8 text-center text-sm text-muted-foreground">
            {t('noMatch')}
          </div>
        )}
        {visibleSections.map((section) => {
          const Icon = SOURCE_ICON[section.source]
          return (
            <div
              key={section.source}
              data-testid={`unified-suggestion-section-${section.source}`}
              className="mb-1 last:mb-0"
            >
              <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
                <Icon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {t(sourceLabelKey(section.source))}
                </span>
                {section.status === 'loading' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/60" />
                    <span className="text-[10px] text-muted-foreground/60">
                      {t('loadingLabel')}
                    </span>
                  </>
                )}
                {section.status === 'failed' && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {t('sourceFailedTag')}
                    </span>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={() => onRetry(section.source)}
                        className="rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <span>{t('retryLabel')}</span>
                      </button>
                    )}
                  </span>
                )}
              </div>
              {section.items.map((item) => {
                const idx = flatItems.findIndex((f) => f.item.id === item.id)
                const isActive = idx === activeIndex
                const prov = resolveProvenance(item)
                const ItemIcon = SOURCE_ICON[item.source]
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-idx={idx}
                    data-testid={`unified-suggestion-item-${item.id}`}
                    onClick={() => onSelect(item)}
                    onMouseEnter={() => idx >= 0 && setActiveIndex(idx)}
                    className={cn(
                      'relative flex w-full items-start gap-2.5 rounded-md px-3 py-1.5 text-left transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/50',
                    )}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-sm bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <ItemIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium leading-tight">
                        {item.label}
                      </span>
                      {item.detail && (
                        <span className="truncate font-mono text-[10px] leading-snug text-muted-foreground">
                          {item.detail}
                        </span>
                      )}
                    </div>
                    {/* 逐源来源标注(封闭词表六档,渲染为可见文本徽章) */}
                    <span
                      data-testid={`unified-suggestion-provenance-${prov}`}
                      className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground"
                    >
                      {t(provenanceLabelKey(prov))}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      {/* 底部:键盘提示行 + 引用计数 + 「引用标签不新增执行授权」安全声明(可见文本,非 aria-only)。 */}
      <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            ↑↓
          </kbd>
          {t('hintSelect')}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            Enter
          </kbd>
          {t('hintConfirm')}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            ESC
          </kbd>
          {t('hintClose')}
        </span>
        <span className="ml-auto text-muted-foreground/60">
          {t('referenceCount', { n: flatItems.length, max: MAX_PANEL_REFERENCES })}
        </span>
      </div>
      <p
        data-testid="unified-suggestion-authorization-notice"
        className="bg-muted/20 px-3 pb-2 text-[10px] leading-snug text-muted-foreground"
      >
        {t('authorizationNotice')}
      </p>
    </PortalPanel>
  )
}

export interface UnifiedPasteReferencePreviewProps {
  previews: readonly PastedReferencePreview[]
  onDismiss: () => void
}

/**
 * 粘贴引用有效性预览条(台账 D68「粘贴引用有效性预览」):粘贴内容里出现的
 * @token / `path` 与当前已知引用集逐一比对,有效/未识别两种状态**可见**呈现。
 * 空集不渲染(不占位、不闪现)。
 */
export function UnifiedPasteReferencePreview({
  previews,
  onDismiss,
}: UnifiedPasteReferencePreviewProps) {
  const t = useTranslations('unifiedSuggestion')
  if (previews.length === 0) return null
  return (
    <div
      data-testid="unified-paste-reference-preview"
      className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/40 px-3 py-1.5"
    >
      <span className="text-[10px] font-medium text-muted-foreground">
        {t('pastePreviewTitle')}
      </span>
      {previews.map((p) => (
        <span
          key={p.raw}
          data-testid={`unified-paste-ref-${p.recognized ? 'valid' : 'unknown'}`}
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] leading-none',
            p.recognized ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
          )}
        >
          <span className="truncate">{p.raw}</span>
          <span className="font-sans">{p.recognized ? t('pasteValid') : t('pasteUnknown')}</span>
        </span>
      ))}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('pastePreviewDismiss')}
        className="ml-auto rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

// 顺序断言辅助:渲染层与用例共用同一份六源顺序,防两边各写各的
export { SUGGESTION_SOURCE_KINDS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
