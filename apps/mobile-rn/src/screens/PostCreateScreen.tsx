import { useCallback, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { PostCreateScreen as SharedPostCreateScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'PostCreate'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function PostCreateScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { circleId } = route.params ?? { circleId: '' }
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = useCallback(async () => {
    if (!title.trim() || !content.trim()) {
      setError(t('postCreate.required'))
      return
    }
    setSaving(true)
    setError('')
    const res = await fetchApi<{ id: string }>('/api/community/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        content: content.trim(),
        circleId,
        tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    })
    setSaving(false)
    if (res.success && res.data) navigation.replace('PostDetail', { id: res.data.id })
    else if (!res.success) setError(res.error || t('postCreate.saveFailed'))
  }, [title, content, tags, circleId, t, navigation])

  return (
    <SharedPostCreateScreen
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
