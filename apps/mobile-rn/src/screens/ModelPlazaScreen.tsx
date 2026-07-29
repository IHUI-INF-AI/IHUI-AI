import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAiModels, type AiModel } from '@ihui/api-client'
import {
  ModelPlazaScreen as SharedModelPlazaScreen,
  type ModelPlazaItem,
  type ModelPlazaModelType,
  type ModelPlazaProvider,
  type ModelPlazaTypeFilter,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function readModelType(v: unknown): ModelPlazaModelType {
  return v === 'image' || v === 'av' ? v : 'text'
}

function readNumber(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function readStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function mapAiModel(m: AiModel): ModelPlazaItem {
  return {
    id: m.id,
    providerId: m.provider,
    name: m.name,
    type: readModelType(m.type),
    inputPrice: readNumber(m.inputPrice),
    outputPrice: readNumber(m.outputPrice),
    desc: m.description ?? '',
    tags: readStringArray(m.tags),
    payMode: readString(m.payMode),
  }
}

function buildProviders(models: ModelPlazaItem[]): ModelPlazaProvider[] {
  const map = new Map<string, ModelPlazaProvider>()
  for (const m of models) {
    if (!map.has(m.providerId)) {
      map.set(m.providerId, { id: m.providerId, name: m.providerId, total: 0, desc: '' })
    }
    map.get(m.providerId)!.total += 1
  }
  return Array.from(map.values())
}

export default function ModelPlazaScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [models, setModels] = useState<ModelPlazaItem[]>([])
  const [providerId, setProviderId] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<ModelPlazaTypeFilter>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const resp = await getAiModels({ pageSize: 100 })
      if (resp.success) {
        const list = resp.data.list.map(mapAiModel)
        setModels(list)
        setProviderId((prev) => {
          if (prev && list.some((m) => m.providerId === prev)) return prev
          return list[0]?.providerId ?? ''
        })
      } else {
        setError(resp.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const providers = buildProviders(models)

  const handleCompare = () => Alert.alert(t('modelPlaza.compare.title'), t('modelPlaza.compare.message'))
  const handleDetail = (m: ModelPlazaItem) =>
    Alert.alert(t('modelPlaza.detail.title'), t('modelPlaza.detail.message', { name: m.name }))

  return (
    <SharedModelPlazaScreen
      t={t}
      items={models}
      providers={providers}
      providerId={providerId}
      typeFilter={typeFilter}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onSelectProvider={(id) => {
        setProviderId(id)
        setTypeFilter('all')
      }}
      onSelectType={setTypeFilter}
      onRefresh={onRefresh}
      onPressCompare={handleCompare}
      onPressItem={handleDetail}
      onBack={() => navigation.goBack()}
    />
  )
}
