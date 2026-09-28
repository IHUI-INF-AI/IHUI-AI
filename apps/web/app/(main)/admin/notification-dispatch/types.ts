// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
