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
