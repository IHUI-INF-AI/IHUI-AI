import type { MForm, Material } from './types'

export const PAGE_SIZE = 10

export const EMPTY: MForm = { title: '', type: 'pdf', fileUrl: '', lessonId: '' }

export const TYPE_MAP: Record<string, string> = {
  pdf: 'typePdf',
  video: 'typeVideo',
  audio: 'typeAudio',
  doc: 'typeDoc',
  image: 'typeImage',
  other: 'typeOther',
}

export function materialToForm(m: Material): MForm {
  return { title: m.title, type: m.type, fileUrl: m.fileUrl ?? '', lessonId: '' }
}
