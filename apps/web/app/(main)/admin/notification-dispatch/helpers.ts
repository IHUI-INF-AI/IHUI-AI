import type { DispatchForm, MsgType, NotificationChannel, TargetMode } from './types'

export const ROLES = ['admin', 'teacher', 'student', 'user'] as const
export const CHANNELS: NotificationChannel[] = ['in_app', 'email', 'sms']
export const MSG_TYPES: MsgType[] = ['system', 'order', 'project', 'comment', 'mention', 'follow']

export const EMPTY_FORM: DispatchForm = {
  title: '',
  content: '',
  targetMode: 'roleFilter',
  userIdsText: '',
  roleFilter: [],
  channels: ['in_app'],
  msgType: 'system',
}

export const textareaCls =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const parseUserIds = (text: string): string[] =>
  text
    .split(/[\n,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

export const TARGET_MODES: TargetMode[] = ['userIds', 'roleFilter']

/** i18n 静态映射表 — 用于消除 `t(`nd.${var}_${var}`)` 动态拼接 */
export const TARGET_MODE_KEY: Record<TargetMode, string> = {
  userIds: 'nd.targetMode_userIds',
  roleFilter: 'nd.targetMode_roleFilter',
}

export const CHANNEL_KEY: Record<NotificationChannel, string> = {
  in_app: 'nd.channel_in_app',
  email: 'nd.channel_email',
  sms: 'nd.channel_sms',
}

export const MSG_TYPE_KEY: Record<MsgType, string> = {
  system: 'nd.msgType_system',
  order: 'nd.msgType_order',
  project: 'nd.msgType_project',
  comment: 'nd.msgType_comment',
  mention: 'nd.msgType_mention',
  follow: 'nd.msgType_follow',
}

export const RESULT_KEY: Record<'sent' | 'failed' | 'skipped' | 'queued', string> = {
  sent: 'nd.result_sent',
  failed: 'nd.result_failed',
  skipped: 'nd.result_skipped',
  queued: 'nd.result_queued',
}
