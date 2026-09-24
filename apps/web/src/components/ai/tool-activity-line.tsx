// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 活动条目 · D81 ②~⑥ 的可复用呈现原语(工具活动条上的子组件)。
// 取词统一走 taskStatus 命名空间(双时态词表与 ⑤ 连接器分组标签同源),
// 组件内零硬编码文案。无障碍口径:可折叠元素带 aria-expanded、button 默认键盘可达(H27)。
'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/** 长输出代码块:默认折叠,点击"展开全部/收起"后完整内容可达(D81 第④项,正面解 G-69/D33 截断即丢) */
export function ActivityCodeBlock({
  content,
  maxCollapsed = 240,
  testId = 'activity-codeblock',
}: {
  content: string
  maxCollapsed?: number
  testId?: string
}): React.JSX.Element {
  const t = useTranslations('taskStatus')
  const [expanded, setExpanded] = React.useState(false)
  const isLong = content.length > maxCollapsed
  const shown = !isLong || expanded ? content : `${content.slice(0, maxCollapsed)}…`
  return (
    <div className="space-y-1">
      <pre
        data-testid={testId}
        className={cn(
          'overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/60 p-1 font-mono text-[11px] text-muted-foreground/90',
          !expanded && isLong && 'max-h-24',
        )}
      >
        <code>{shown}</code>
      </pre>
      {isLong && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          data-testid={`${testId}-toggle`}
          className="rounded-sm px-1 text-[11px] text-primary/80 hover:bg-primary/10"
        >
          {expanded ? t('hideLines') : t('showAllLines')}
        </button>
      )}
    </div>
  )
}

/** 活动级耗时条(D81 第②项 workedForDuration,与 D1 消息级耗时正交) */
export function ActivityDuration({
  durationMs,
  testId = 'activity-duration',
}: {
  durationMs: number
  testId?: string
}): React.JSX.Element {
  const t = useTranslations('taskStatus')
  const seconds = durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`
  return (
    <span
      data-testid={testId}
      className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70"
    >
      {t('workedForDuration', { duration: seconds })}
    </span>
  )
}

/** 搜索查询词直接显示在活动条上(D81 第③项 searchWithQuery) */
export function ActivitySearchQuery({
  query,
  testId = 'activity-search-query',
}: {
  query: string
  testId?: string
}): React.JSX.Element | null {
  const t = useTranslations('taskStatus')
  if (!query) return null
  return (
    <span
      data-testid={testId}
      className="flex-1 truncate font-mono text-[11px] text-muted-foreground/80"
      title={query}
    >
      {t('searchWithQuery', { query })}
    </span>
  )
}

/** 来源按钮(D81 第⑤项 sourcesButton) */
export function ActivitySourcesButton({
  count,
  onClick,
  testId = 'activity-sources',
}: {
  count?: number
  onClick?: () => void
  testId?: string
}): React.JSX.Element {
  const t = useTranslations('taskStatus')
  const label = count && count > 0 ? `${t('sourcesButton')} (${count})` : t('sourcesButton')
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="rounded-sm px-1 text-[11px] text-primary/80 hover:bg-primary/10"
    >
      {label}
    </button>
  )
}

/** 取消态条目:被取消的动作在流里留可辨识标签,不得静默消失(D81 第⑥项 canceledItemLabel) */
export function ActivityCanceledLabel({
  name,
  testId = 'activity-canceled',
}: {
  name: string
  testId?: string
}): React.JSX.Element {
  const t = useTranslations('taskStatus')
  return (
    <span
      data-testid={testId}
      className="shrink-0 rounded-sm bg-muted px-1 text-[10px] text-muted-foreground"
    >
      {t('canceledItemLabel', { name })}
    </span>
  )
}

/** 连接器分组标签(D81 第⑤项 readingConnector / writingConnector) */
export function ActivityConnectorGroupLabel({
  connector,
  direction,
  testId = 'activity-connector-group',
}: {
  connector: string
  direction: 'read' | 'write'
  testId?: string
}): React.JSX.Element {
  const t = useTranslations('taskStatus')
  const key = direction === 'write' ? 'writingConnector' : 'readingConnector'
  return (
    <span
      data-testid={testId}
      data-direction={direction}
      className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70"
    >
      {t(key, { connector })}
    </span>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
