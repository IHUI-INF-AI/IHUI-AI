import type { AttachmentItem } from '@/components/form/AttachmentsUpload'

export interface Note {
  id: string
  lessonId: string | null
  userId: string
  title: string
  content: string
  isPublic: boolean
  attachments: AttachmentItem[]
  createdAt: string
  updatedAt: string
}

export interface NotesData {
  list: Note[]
  total: number
}

export interface NoteForm {
  title: string
  content: string
  isPublic: boolean
  attachments: AttachmentItem[]
}
