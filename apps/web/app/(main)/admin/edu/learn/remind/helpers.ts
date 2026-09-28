// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
  study: 'type.study',
  exam: 'type.exam',
  homework: 'type.homework',
  live: 'type.live',
  system: 'type.system',
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
