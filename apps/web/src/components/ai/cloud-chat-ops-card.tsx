// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​​‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D97 云端聊天互操作活动卡(G-133) —— 对话流内活动条(纯展示)。
//
// 形状:**「动作 × 三态」矩阵**(`@ihui/shared/chat/cloud-chat-ops` 的映射表是唯一矩阵定义处,
// 15 格 = 五动作 × active/completed/following)。**不取数**:数据/动作一律经 props 注入,
// 本组件不发起任何传输调用 —— 跨端操作复用 D50 多端遥控的既有通道
// (/api/task-messages 投递 + W2 abort 中止),与 D103 AgentActionsCard 同构、不另建渲染范式。
// 含 following 态 → 渲染「等待上游动作」提示位(可审计:等待不伪装成进行中)。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  CLOUD_CHAT_OPS,
  CLOUD_CHAT_OPS_ARIA_KEY,
  CLOUD_CHAT_OPS_TITLE_KEY,
  CLOUD_CHAT_OPS_WAITING_KEY,
  cloudChatOpKeys,
  cloudChatOpLabelKey,
  cloudChatOpsView,
  type CloudChatOp,
  type CloudChatOpEntry,
  type CloudChatOpPhase,
} from '@ihui/shared/chat/cloud-chat-ops'

export type { CloudChatOpEntry }

export interface CloudChatOpsCardProps {
  entries: readonly CloudChatOpEntry[]
  className?: string
  'data-testid'?: string
}

const PHASE_TONE: Record<CloudChatOpPhase, string> = {
  active: 'text-muted-foreground',
  completed: 'text-emerald-600 dark:text-emerald-500',
  following: 'text-amber-600 dark:text-amber-500',
}

export function CloudChatOpsCard({
  entries,
  className,
  'data-testid': testId,
}: CloudChatOpsCardProps) {
  const t = useTranslations('ai.pane.cloudChatOps')

  // 聚合判定在共享层(单一真相源):空 → null;following 计数 → 提示位
  const view = cloudChatOpsView(entries)

  // 动作名(zh-CN 逐字取任务原文:附加云端聊天 / 创建云端聊天 / …)
  const opLabel = React.useMemo(() => {
    const map = {} as Record<CloudChatOp, string>
    for (const op of CLOUD_CHAT_OPS) map[op] = t(cloudChatOpLabelKey(op))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  if (!view || view.rows.length === 0) return null

  // 按动作分组渲染活动条(与 D103 AgentActionsCard 同构)
  const groups = new Map<CloudChatOp, CloudChatOpEntry[]>()
  for (const row of view.rows) {
    const list = groups.get(row.op)
    if (list) list.push(row)
    else groups.set(row.op, [row])
  }

  return (
    <div
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      aria-label={t(CLOUD_CHAT_OPS_ARIA_KEY)}
      data-cloud-chat-ops-groups={groups.size}
      data-cloud-chat-ops-waiting={view.waitingOpCount}
    >
      <span className="text-xs font-medium text-foreground">{t(CLOUD_CHAT_OPS_TITLE_KEY)}</span>
      {[...groups.entries()].map(([op, rows]) => (
        <div key={op} className="flex flex-col gap-1" data-cloud-chat-op-group={op}>
          <span className="text-[11px] font-medium text-foreground">{opLabel[op]}</span>
          <ul className="flex flex-col gap-0.5">
            {rows.map((row, index) => {
              const cell = cloudChatOpKeys(row.op, row.phase)
              return (
                <li
                  key={`${row.phase}-${row.target ?? ''}-${index}`}
                  className="flex flex-wrap items-center gap-1.5 text-[11px]"
                  aria-label={t(cell.ariaKey)}
                >
                  <span
                    className={cn(PHASE_TONE[row.phase])}
                    data-cloud-chat-phase={row.phase}
                  >
                    {t(cell.labelKey)}
                  </span>
                  {row.target ? (
                    <span className="truncate text-muted-foreground" data-cloud-chat-target>
                      {row.target}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {view.waitingOpCount > 0 ? (
        <span className="text-[11px] text-amber-600 dark:text-amber-500" data-cloud-chat-waiting>
          {t(CLOUD_CHAT_OPS_WAITING_KEY)}
        </span>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​​‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
