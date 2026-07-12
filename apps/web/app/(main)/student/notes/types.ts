export interface Note {
  id: string
  lessonId: string | null
  userId: string
  title: string
  content: string
  isPublic: boolean
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
}
