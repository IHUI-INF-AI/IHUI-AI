// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 活动条目 · D81 ④⑤⑥ 的可复用呈现原语(工具活动条上的子组件)。
// 取词统一走 taskStatus 命名空间(双时态词表与 ⑤ 连接器分组标签同源),
// 组件内零硬编码文案。无障碍口径:可折叠元素带 aria-expanded、button 默认键盘可达(H27)。
//
// ②(活动级耗时条)/ ③(搜索查询词)原语已于 2026-09-25 删除,**不是**"还没接",而是
// 渲染取证判定的冗余(`__tests__/d81-redundancy-probe.test.tsx` 用真 ToolCallCard 量到):
//  - 耗时:StreamRow 的 `elapsedMs` ← `useLiveElapsed(...)` 已把后端权威 durationMs 打成
//    `2.4s` / `1m15s` 落在行上,格式化器是 `progress-sections/foldable-section.tsx` 的
//    `formatDuration`(含分档)。② 自带一份 `(ms/1000).toFixed(1)+'s'` 的**第二套时长格式化器**,
//    超过 1 分钟即与现役分叉 —— 留着等于在同一行里养两个真相。
//  - 查询词:共享层 `describeToolCall` 的 subject 已把 args.query 逐字带上行(file_search /
//    search_codebase 两枚都量到)。③ 的差集只剩"查询:"前缀,而其 `title={query}` 违反 §4
//    (禁用原生 title 提示)。
// 要给这两处加措辞,改法是在 StreamRow 上立一档,不得把原语加回来。
'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import type { ConnectorDirection } from '@ihui/shared/chat'
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
  /**
   * 方向档位一律取共享层 `ConnectorDirection`,不得在端内另写 `'read' | 'write'` 字面量联合 ——
   * 那正是 `groupToolActivitiesByConnector` 分组键的另一半,端内自立即两份真相。
   */
  direction: ConnectorDirection
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
