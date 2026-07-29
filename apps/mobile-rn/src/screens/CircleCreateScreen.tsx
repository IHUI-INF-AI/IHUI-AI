import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { CircleCreateScreen as SharedCircleCreateScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CircleCreateScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    if (!name.trim()) {
      setError(t('circleCreate.nameRequired'))
      return
    }
    setSaving(true)
    setError('')
    const res = await fetchApi<{ id: string }>('/api/circles', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        category: 'general',
        isPublic: true,
      }),
    })
    setSaving(false)
    if (res.success && res.data) {
      navigation.replace('CircleDetail', { id: res.data.id })
    } else if (!res.success) {
      setError(res.error || t('circleCreate.saveFailed'))
    }
  }

  return (
    <SharedCircleCreateScreen
      t={t}
      name={name}
      description={description}
      saving={saving}
      error={error}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      onSubmit={onSubmit}
      onBack={() => navigation.goBack()}
    />
  )
}
