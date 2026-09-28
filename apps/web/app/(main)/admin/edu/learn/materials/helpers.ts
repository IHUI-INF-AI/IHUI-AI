// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
