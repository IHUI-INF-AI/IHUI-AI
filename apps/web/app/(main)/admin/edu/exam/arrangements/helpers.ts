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
