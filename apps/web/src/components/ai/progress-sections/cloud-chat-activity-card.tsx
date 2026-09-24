// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D97 云端聊天互操作活动卡(G-133) —— 对话流渲染位。
//
// 形状是**「动作 × 三态」矩阵**:五动作(attach/create/list/readTurns/sendMessage)
// × 三相位(active/completed/following)。动作与相位词表**唯一定义在本文件**,
// 卡与 timeline-event 的类型守卫共同消费。数据面(D28 多端 + /api/task-messages +
// W2 abort 通道)已有,本卡只做呈现 —— 把"跨端操作"呈现成可审计活动条,不取数、
// 不建第二套传输(与 D50 多端遥控合并设计)。
//
// 三态配色与时间线语义同源:completed 用 emerald(同 STATUS_CLS.done 绿)、
// active 用 Loader2 + animate-spin + muted(同 running)、following 用 muted 弱化
// (同 pending),无蓝光边框。上下文字段(会话名/轮次数)由载荷携带,缺失不渲染、
// 不猜不补;非法条目在 extractCloudChatEntries 处整条丢弃。

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

/** 五动作词表(矩阵唯一定义处,消费方只读) */
export const CLOUD_CHAT_ACTIONS = ['attach', 'create', 'list', 'readTurns', 'sendMessage'] as const
export type CloudChatAction = (typeof CLOUD_CHAT_ACTIONS)[number]

/** 三相位词表(active 进行中 / completed 已完成 / following 等待中) */
export const CLOUD_CHAT_PHASES = ['active', 'completed', 'following'] as const
export type CloudChatPhase = (typeof CLOUD_CHAT_PHASES)[number]

export function isCloudChatAction(v: unknown): v is CloudChatAction {
  return typeof v === 'string' && (CLOUD_CHAT_ACTIONS as readonly string[]).includes(v)
}

export function isCloudChatPhase(v: unknown): v is CloudChatPhase {
  return typeof v === 'string' && (CLOUD_CHAT_PHASES as readonly string[]).includes(v)
}

export interface CloudChatEntry {
  /** 动作(五动作之一) */
  action: CloudChatAction
  /** 该次动作的相位(三态) */
  phase: CloudChatPhase
  /** 目标会话名(展示用,可选;载荷缺失则不渲染) */
  session?: string
  /** 轮次数(展示用,可选;载荷缺失则不渲染) */
  turns?: number
}

export interface CloudChatActivityCardProps {
  entries: readonly CloudChatEntry[]
  className?: string
  'data-testid'?: string
}

/** 三态配色(following 弱化不抢眼,与 timeline-event 的 STATUS_CLS.pending 同源) */
const PHASE_TONE: Record<CloudChatPhase, string> = {
  active: 'text-muted-foreground',
  completed: 'text-emerald-600 dark:text-emerald-500',
  following: 'text-muted-foreground/50',
}

export function CloudChatActivityCard({
  entries,
  className,
  'data-testid': testId,
}: CloudChatActivityCardProps) {
  const t = useTranslations('cloudChat')

  // 15 格逐格静态取词(next-intl 类型检查可过;键名五语言词包语义对齐)
  const actionLabel: Record<CloudChatAction, string> = {
    attach: t('action.attach.label'),
    create: t('action.create.label'),
    list: t('action.list.label'),
    readTurns: t('action.readTurns.label'),
    sendMessage: t('action.sendMessage.label'),
  }
  const phaseText: Record<CloudChatAction, Record<CloudChatPhase, string>> = {
    attach: {
      active: t('action.attach.active'),
      completed: t('action.attach.completed'),
      following: t('action.attach.following'),
    },
    create: {
      active: t('action.create.active'),
      completed: t('action.create.completed'),
      following: t('action.create.following'),
    },
    list: {
      active: t('action.list.active'),
      completed: t('action.list.completed'),
      following: t('action.list.following'),
    },
    readTurns: {
      active: t('action.readTurns.active'),
      completed: t('action.readTurns.completed'),
      following: t('action.readTurns.following'),
    },
    sendMessage: {
      active: t('action.sendMessage.active'),
      completed: t('action.sendMessage.completed'),
      following: t('action.sendMessage.following'),
    },
  }

  // 按动作分组(每个动作族一行/组)
  const groups = React.useMemo(() => {
    const map = new Map<CloudChatAction, CloudChatEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.action)
      if (list) list.push(entry)
      else map.set(entry.action, [entry])
    }
    return [...map.entries()]
  }, [entries])

  // 组合式标题动词:组内相位一致 → 该相位文案;混合 → 动作名
  const titleVerb = (action: CloudChatAction, group: readonly CloudChatEntry[]): string => {
    const first = group[0]?.phase
    if (first !== undefined && group.every((e) => e.phase === first)) {
      return phaseText[action][first]
    }
    return actionLabel[action]
  }

  // 标题宾语:组内会话名唯一 → {name};否则 {count} 走 ICU plural
  const titleObject = (group: readonly CloudChatEntry[]): string => {
    const session = group[0]?.session
    if (session && group.every((e) => e.session === session)) {
      return t('header.target', { name: session })
    }
    return t('header.count', { count: group.length })
  }

  if (entries.length === 0) return null

  return (
    <div
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-cloud-chat-groups={groups.length}
    >
      {groups.map(([action, group]) => (
        <div key={action} className="flex flex-col gap-1" data-action-group={action}>
          <span
            className="text-xs font-medium text-foreground"
            data-testid={testId ? `${testId}-title` : 'cloud-chat-activity-title'}
          >
            {titleVerb(action, group)} {titleObject(group)}
          </span>
          <ul className="flex flex-col gap-0.5">
            {group.map((entry, index) => (
              <li
                key={`${entry.session ?? ''}-${entry.phase}-${index}`}
                className="flex items-center gap-1.5 text-[11px]"
              >
                {entry.phase === 'active' && (
                  <Loader2
                    className="h-3 w-3 shrink-0 animate-spin text-muted-foreground"
                    aria-hidden
                  />
                )}
                <span className={cn(PHASE_TONE[entry.phase])} data-action-phase={entry.phase}>
                  {phaseText[action][entry.phase]}
                </span>
                {entry.session && (
                  <span className="truncate text-muted-foreground">{entry.session}</span>
                )}
                {entry.turns !== undefined && (
                  <span className="shrink-0 tabular-nums text-muted-foreground/60">
                    {t('turns', { turns: entry.turns })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default CloudChatActivityCard
