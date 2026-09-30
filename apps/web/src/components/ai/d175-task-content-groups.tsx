// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D175 任务内容聚合分组视图(2026-09-30 立,对标竞品 chatSession.highlights.group/emptyGroup)。
//
// 票面:整个任务全程产出的「产出 / 网页查阅 / 来源」持续汇总为三组清单 + 各组空态 + 汇总描述。
// 取数一律走 `aggregateTaskContent`(apps/web/src/lib/d175-task-content.ts)—— 本组件不取数、
// 不发请求、不建第二份采集链,只把既有 toolCalls / citations 抽出的三组呈现出来。
//
// 挂载位(D52 既有四区之内,不新开面板):由 `task-monitor-sections.tsx` 在 results
// 「结果与来源」区内、区内 Tab 子导航之前渲染。取该区的依据是区名本身(该区即"产出物、对照与
// 出处",见 TASK_MONITOR_ZONES 注释),而"挂成 Tab"这条路需要动 `ai-side-panel-tools.tsx` 的
// ToolTabKey 联合 + renderTab 分支(不在本票射程),故走区内分区这一条加法通道。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import {
  TASK_CONTENT_GROUPS,
  aggregateTaskContent,
  type TaskContentGroupKey,
  type TaskContentItem,
  type TaskContentMessageLike,
} from '@/lib/d175-task-content'

interface TaskContentGroupsViewProps {
  /** 整个任务的会话消息(调用方传 chat store 的 messages,本组件不订阅 store) */
  messages: readonly TaskContentMessageLike[]
}

/** 单条内容:路径/URL 取等宽,可跳转的给 a 标签;重复出现给次数 */
function ContentRow({ item }: { item: TaskContentItem }): React.JSX.Element {
  const countSuffix = item.count > 1 ? ` (${item.count})` : ''
  return (
    <li className="flex min-w-0 items-baseline gap-1 py-0.5">
      {item.href ? (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 break-all font-mono text-[11px] text-primary/90 hover:underline"
        >
          {item.label}
          {countSuffix}
        </a>
      ) : (
        <span className="min-w-0 break-all font-mono text-[11px] text-foreground/90">
          {item.label}
          {countSuffix}
        </span>
      )}
    </li>
  )
}

/**
 * TaskContentGroupsView — 任务内容聚合三分组。
 *
 * 三组恒在(空态也是内容的一部分,竞品空列表照样给「暂无…数据 :)」);
 * 三组全空时补一条总空态与汇总描述(empty / emptyDescription)。
 */
export function TaskContentGroupsView({
  messages,
}: TaskContentGroupsViewProps): React.JSX.Element {
  const tm = useTranslations('taskMonitor')
  const groups = React.useMemo(() => aggregateTaskContent(messages), [messages])
  const totalCount =
    groups.artifact.length + groups.browser.length + groups.source.length

  return (
    <section
      data-testid="task-content-groups"
      aria-label={tm('sections.results')}
      className="border-b px-3 pb-2 pt-1.5"
    >
      {totalCount === 0 && (
        <div data-testid="task-content-empty" className="pb-1.5">
          <p className="text-xs font-medium text-foreground/80">{tm('empty')}</p>
          <p className="pt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {tm('emptyDescription')}
          </p>
        </div>
      )}
      {TASK_CONTENT_GROUPS.map((key: TaskContentGroupKey) => {
        const items = groups[key]
        return (
          <div key={key} data-testid={`task-content-group-${key}`}>
            <p className="flex items-center gap-1.5 pt-1 text-[11px] font-medium text-foreground/80">
              <span>{tm(`group.${key}`)}</span>
              <span className="text-[10px] font-normal text-muted-foreground">{items.length}</span>
            </p>
            {items.length === 0 ? (
              <p
                data-testid={`task-content-group-empty-${key}`}
                className="py-0.5 text-[11px] text-muted-foreground"
              >
                {tm(`emptyGroup.${key}`)}
              </p>
            ) : (
              <ul data-testid={`task-content-group-list-${key}`} className="min-w-0 py-0.5">
                {items.map((item) => (
                  <ContentRow key={item.key} item={item} />
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </section>
  )
}

export default TaskContentGroupsView
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
