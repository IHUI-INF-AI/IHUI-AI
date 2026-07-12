import type { Remind, RForm } from './types'

export const PAGE_SIZE = 10

export const EMPTY: RForm = {
  title: '',
  userId: '',
  content: '',
  remindAt: '',
  type: 'study',
  isRead: false,
}

export const TYPE_MAP: Record<string, string> = {
  study: '学习提醒',
  exam: '考试提醒',
  homework: '作业提醒',
  live: '直播提醒',
  system: '系统通知',
}

export function remindToForm(r: Remind): RForm {
  return {
    title: r.title,
    userId: r.userId,
    content: r.content ?? '',
    remindAt: r.remindAt,
    type: r.type,
    isRead: r.isRead,
  }
}
