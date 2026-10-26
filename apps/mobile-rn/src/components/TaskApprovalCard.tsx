// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text, TouchableOpacity } from 'react-native'
import { Check, X, ShieldCheck, Smartphone, Monitor, Clock } from 'lucide-react-native'
import { rnTokens as tokens } from '@ihui/design-tokens'
import type { DelegationApprovalState, TaskDispatch } from '@ihui/shared/tasks/dispatch'
import { delegationApprovalAudienceOf } from '@ihui/shared/tasks/delegation-approval'

/**
 * 跨设备委派审批卡(mobile-rn 端,对标 web 的 task-receiver 审批区)。
 *
 * 审批跟人语义(与 nanoMuse 对比出的 P0-1):
 *  - 这张卡只会推到提问方(origin)与执行方(target)两台设备;
 *  - 只有 `awaiting` 且本设备在 audience 内时才显示放行/拒绝按钮;
 *  - 先答者胜由服务端裁定,本端只负责把 decision 提交上去,不本地乐观改状态。
 */

const STATE_META: Record<
  DelegationApprovalState,
  { label: string; badge: string; text: string; iconColor: string; icon: typeof Check }
> = {
  awaiting: {
    label: '待审批',
    badge: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
    iconColor: tokens.warning.amberText,
    icon: Clock,
  },
  approved: {
    label: '已放行',
    badge: 'bg-emerald-100 dark:bg-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    iconColor: tokens.success.deepText,
    icon: Check,
  },
  denied: {
    label: '已拒绝',
    badge: 'bg-rose-100 dark:bg-rose-900/40',
    text: 'text-rose-700 dark:text-rose-300',
    iconColor: tokens.danger.DEFAULT,
    icon: X,
  },
  stopped: {
    label: '已停止',
    badge: 'bg-neutral-200 dark:bg-neutral-700',
    text: 'text-neutral-600 dark:text-neutral-300',
    iconColor: tokens.gray[600],
    icon: X,
  },
  expired: {
    label: '已过期',
    badge: 'bg-neutral-200 dark:bg-neutral-700',
    text: 'text-neutral-600 dark:text-neutral-300',
    iconColor: tokens.gray[600],
    icon: Clock,
  },
}

export interface TaskApprovalCardProps {
  task: TaskDispatch
  /** 本机持久化 deviceId(用于判断是否为 audience 与是否可答) */
  deviceId: string
  /** 提交一次审批决定(放行/拒绝);异步执行,按钮的禁用态由 `busy` 控制 */
  onAnswer: (taskId: string, decision: boolean) => void
  /** 该卡正在提交中(禁用按钮,避免双端连点) */
  busy?: boolean
}

export function TaskApprovalCard({ task, deviceId, onAnswer, busy }: TaskApprovalCardProps) {
  const approval = task.approval
  if (!approval) return null

  const isAudience = delegationApprovalAudienceOf(approval).includes(deviceId)
  const canAnswer = approval.state === 'awaiting' && isAudience
  const meta = STATE_META[approval.state]
  const StateIcon = meta.icon

  return (
    <View className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3.5 mb-2.5">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-1.5">
          <ShieldCheck size={16} color={tokens.brandAccent.deep} />
          <Text className="text-[13px] font-semibold text-gray-900 dark:text-neutral-100">
            跨设备委派审批
          </Text>
        </View>
        <View className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full ${meta.badge}`}>
          <StateIcon size={12} color={meta.iconColor} />
          <Text className={`text-[11px] font-medium ${meta.text}`}>{meta.label}</Text>
        </View>
      </View>

      <Text
        className="text-[14px] leading-5 text-gray-800 dark:text-neutral-200 mb-2"
        numberOfLines={6}
      >
        {task.command}
      </Text>

      <View className="flex-row items-center gap-4 mb-2.5">
        <View className="flex-row items-center gap-1">
          <Smartphone size={13} color={tokens.text.secondary} />
          <Text className="text-[12px] text-gray-500 dark:text-neutral-400">
            发起 {task.fromDevice}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Monitor size={13} color={tokens.text.secondary} />
          <Text className="text-[12px] text-gray-500 dark:text-neutral-400">
            执行 {task.toDevice}
          </Text>
        </View>
      </View>

      {approval.state !== 'awaiting' && approval.answeredBy ? (
        <Text className="text-[11px] text-gray-400 dark:text-neutral-500">
          已由 {approval.answeredBy} 裁定
        </Text>
      ) : null}

      {canAnswer ? (
        <View className="flex-row gap-2.5 mt-1">
          <TouchableOpacity
            disabled={busy}
            onPress={() => onAnswer(task.id, true)}
            className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 ${busy ? 'opacity-50' : 'active:bg-emerald-700'}`}
          >
            <Check size={16} color={tokens.surface.light} />
            <Text className="text-[14px] font-semibold text-white">放行</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={busy}
            onPress={() => onAnswer(task.id, false)}
            className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-600 ${busy ? 'opacity-50' : 'active:bg-rose-700'}`}
          >
            <X size={16} color={tokens.surface.light} />
            <Text className="text-[14px] font-semibold text-white">拒绝</Text>
          </TouchableOpacity>
        </View>
      ) : approval.state === 'awaiting' && !isAudience ? (
        <Text className="text-[11px] text-gray-400 dark:text-neutral-500 mt-1">
          审批权归发起方与执行方,本机仅可见
        </Text>
      ) : null}
    </View>
  )
}

export interface TaskApprovalSectionProps {
  tasks: TaskDispatch[]
  deviceId: string
  onAnswer: (taskId: string, decision: boolean) => void
  /** 正在提交中的任务 ID(用于禁用对应按钮) */
  busyTaskId?: string | null
}

/** 审批卡列表容器:把 pendingApprovals 映射成一列卡片,无任务时整体不渲染。 */
export function TaskApprovalSection({
  tasks,
  deviceId,
  onAnswer,
  busyTaskId,
}: TaskApprovalSectionProps) {
  if (!tasks.length) return null
  return (
    <View className="mt-1">
      {tasks.map((t) => (
        <TaskApprovalCard
          key={t.id}
          task={t}
          deviceId={deviceId}
          onAnswer={onAnswer}
          busy={busyTaskId === t.id}
        />
      ))}
    </View>
  )
}
