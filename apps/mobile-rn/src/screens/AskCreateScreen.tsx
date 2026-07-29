import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { AskCreateScreen as SharedAskCreateScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AskCreateScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    if (!title.trim()) { setError(t('askCreate.titleRequired')); return }
    setSaving(true); setError('')
    const res = await fetchApi<{ id: string }>('/api/asks', {
      method: 'POST',
      body: JSON.stringify({ title: title.trim(), content: content.trim(), tags: tags.split(',').map((s) => s.trim()).filter(Boolean) }),
    })
    setSaving(false)
    if (res.success && res.data) navigation.replace('AskDetail', { id: res.data.id })
    else if (!res.success) setError(res.error || t('askCreate.saveFailed'))
  }

  return (
    <SharedAskCreateScreen
      t={t}
      title={title}
      content={content}
      tags={tags}
      saving={saving}
      error={error}
      onTitleChange={setTitle}
      onContentChange={setContent}
      onTagsChange={setTags}
      onSubmit={onSubmit}
      onBack={() => navigation.goBack()}
    />
  )
}
