import { useCallback, useEffect, useState } from 'react'
import { fetchApi } from '@ihui/api-client'
import { NoteScreen as SharedNoteScreen, type NoteItem } from '@ihui/rn-app'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { formatDateByTemplate } from '../utils/date-utils'

function mapNote(raw: NoteItem): NoteItem {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    updatedAt: formatDateByTemplate(raw.updatedAt, 'YYYY-MM-DD HH:mm'),
  }
}

export function NoteScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<NoteItem | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await fetchApi<NoteItem[]>('/api/notes')
      if (res.success) {
        setNotes((res.data ?? []).map(mapNote))
      } else {
        setError(res.error || t('note.loadFailed'))
      }
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setTitle('')
    setContent('')
    setModalVisible(true)
  }

  const openEdit = (note: NoteItem) => {
    setEditing(note)
    setTitle(note.title)
    setContent(note.content)
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setToast(t('note.titleRequired'))
      return
    }
    setSaving(true)
    setToast('')
    const body = { title: title.trim(), content: content.trim() }
    const res = editing
      ? await fetchApi<NoteItem>(`/api/notes/${encodeURIComponent(editing.id)}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      : await fetchApi<NoteItem>('/api/notes', {
          method: 'POST',
          body: JSON.stringify(body),
        })
    setSaving(false)
    if (res.success) {
      setModalVisible(false)
      setToast(t('note.saved'))
      void load()
    } else {
      setToast(res.error || t('note.saveFailed'))
    }
  }

  const handleDelete = async (note: NoteItem) => {
    const res = await fetchApi<void>(`/api/notes/${encodeURIComponent(note.id)}`, {
      method: 'DELETE',
    })
    if (res.success) {
      setToast(t('note.deleted'))
      void load()
    } else {
      setToast(res.error || t('note.deleteFailed'))
    }
  }

  return (
    <SharedNoteScreen
      t={t}
      userLabel={user?.nickname ?? user?.username ?? ''}
      notes={notes}
      loading={loading}
      refreshing={refreshing}
      error={error}
      toast={toast}
      modalVisible={modalVisible}
      editing={editing}
      title={title}
      content={content}
      saving={saving}
      onRefresh={() => load(true)}
      onBack={() => {
        /* NoteScreen 为主屏,无返回 */
      }}
      onOpenCreate={openCreate}
      onOpenEdit={openEdit}
      onTitleChange={setTitle}
      onContentChange={setContent}
      onSave={handleSave}
      onDelete={handleDelete}
      onCloseModal={() => setModalVisible(false)}
    />
  )
}
