// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import type { AForm, Arrangement } from './types'

export const PAGE_SIZE = 10

export const EMPTY: AForm = {
  paperId: '',
  startTime: '',
  endTime: '',
  room: '',
  invigilator: '',
  status: 'scheduled',
}

export function arrangementToForm(a: Arrangement): AForm {
  return {
    paperId: a.paperId,
    startTime: a.startTime,
    endTime: a.endTime,
    room: a.room,
    invigilator: a.invigilator,
    status: a.status,
  }
}
