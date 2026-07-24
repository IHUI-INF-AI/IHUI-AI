import { useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { Input, Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CircleCreateScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    if (!name.trim()) { setError(t('circleCreate.nameRequired')); return }
    setSaving(true); setError('')
    const res = await fetchApi<{ id: string }>('/api/circles', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), description: description.trim(), category: category.trim() || 'general', isPublic }),
    })
    setSaving(false)
    if (res.success && res.data) navigation.replace('CircleDetail', { id: res.data.id })
    else if (!res.success) setError(res.error || t('circleCreate.saveFailed'))
  }

  if (saving) return (
    <View className="flex-1 items-center justify-center bg-card p-4">
      <Loading />
      <Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text>
    </View>
  )
  return (
    <ScrollView className="flex-1 bg-card px-4 pb-8 pt-12" keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
      <Text className="mb-3 mt-2 text-[22px] font-semibold text-foreground">{t('circleCreate.title')}</Text>
      {error ? <Text className="mb-2 text-[13px] text-destructive">{error}</Text> : null}
      <Text className="mt-3 text-xs text-muted-foreground">{t('circleCreate.name')}</Text>
      <Input className="mt-1" value={name} onChangeText={setName} placeholder={t('circleCreate.namePlaceholder')} />
      <Text className="mt-3 text-xs text-muted-foreground">{t('circleCreate.category')}</Text>
      <Input className="mt-1" value={category} onChangeText={setCategory} placeholder={t('circleCreate.categoryPlaceholder')} />
      <Text className="mt-3 text-xs text-muted-foreground">{t('circleCreate.description')}</Text>
      <Input
        className="mt-1 min-h-[80px]"
        value={description}
        onChangeText={setDescription}
        placeholder={t('circleCreate.descPlaceholder')}
        multiline
        textAlignVertical="top"
      />
      <TouchableOpacity
        className="mt-4 flex-row items-center justify-between rounded-md border border-border p-3"
        onPress={() => setIsPublic(!isPublic)}
      >
        <Text className="text-sm text-foreground">{t('circleCreate.isPublic')}</Text>
        <Text className="text-[13px] font-semibold text-primary">
          {isPublic ? t('circleCreate.public') : t('circleCreate.private')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        className={`mt-5 items-center rounded-md py-3 ${saving ? 'bg-muted-foreground' : 'bg-primary'}`}
        onPress={onSubmit}
        disabled={saving}
      >
        <Text className="text-[15px] font-semibold text-primary-foreground">{t('circleCreate.submit')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
