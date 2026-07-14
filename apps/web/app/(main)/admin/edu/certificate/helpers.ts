import type { CForm } from './types'

export const EMPTY: CForm = {
  userId: '',
  title: '',
  recipientName: '',
  source: 'manual',
  templateId: '',
  issuedAt: '',
}

export const PAGE_SIZE = 10

export const SOURCE_MAP: Record<string, string> = { manual: 'manual', exam: 'exam', learn: 'learn' }
