import { useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { NoteCreateScreen as SharedNoteCreateScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'NoteCreate'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function NoteCreateScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { courseId } = route.params ?? { courseId: '' }
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      setError(t('noteCreate.required'))
      return
    }
    setSaving(true)
    setError('')
    const res = await fetchApi<{ id: string }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        content: content.trim(),
        courseId,
        isPublic,
        tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    })
    setSaving(false)
    if (res.success && res.data) navigation.replace('NoteDetail', { id: res.data.id })
    else if (!res.success) setError(res.error || t('noteCreate.saveFailed'))
  }

  return (
    <SharedNoteCreateScreen
      t={t}
      title={title}
      content={content}
      tags={tags}
      isPublic={isPublic}
      saving={saving}
      error={error}
      onTitleChange={setTitle}
      onContentChange={setContent}
      onTagsChange={setTags}
      onTogglePublic={() => setIsPublic(!isPublic)}
      onSubmit={onSubmit}
      onBack={() => navigation.goBack()}
    />
  )
}
