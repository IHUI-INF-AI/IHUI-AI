export type NotificationChannel = 'in_app' | 'email' | 'sms'

export type MsgType = 'system' | 'order' | 'project' | 'comment' | 'mention' | 'follow'

export type TargetMode = 'userIds' | 'roleFilter'

export interface DispatchForm {
  title: string
  content: string
  targetMode: TargetMode
  userIdsText: string
  roleFilter: string[]
  channels: NotificationChannel[]
  msgType: MsgType
}

export interface DispatchResult {
  sent: number
  failed: number
  skipped: number
  queued: number
}
