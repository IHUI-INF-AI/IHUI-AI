import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { AgentCreateScreen as SharedAgentCreateScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AgentCreateScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [category, setCategory] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    if (!name.trim()) {
      setError(t('agentCreate.nameRequired'))
      return
    }
    setSaving(true)
    setError('')
    const res = await fetchApi<{ id: string }>('/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        category: category.trim() || 'general',
        isPublic,
      }),
    })
    setSaving(false)
    if (res.success && res.data) {
      navigation.replace('AgentDetail', { id: res.data.id })
    } else if (!res.success) {
      setError(res.error || t('agentCreate.saveFailed'))
    }
  }

  return (
    <SharedAgentCreateScreen
      t={t}
      name={name}
      description={description}
      systemPrompt={systemPrompt}
      category={category}
      isPublic={isPublic}
      saving={saving}
      error={error}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      onSystemPromptChange={setSystemPrompt}
      onCategoryChange={setCategory}
      onTogglePublic={() => setIsPublic(!isPublic)}
      onSubmit={onSubmit}
      onBack={() => navigation.goBack()}
    />
  )
}
