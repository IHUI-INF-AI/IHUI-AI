import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
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
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import ModelList, { type ModelListGroup, type ModelListItem } from '../components/ModelList'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type ViewMode = 'shared' | 'local'

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

/** 按 model.type 分配 vendor 分组图标(平台/路由 adapter 仅做简单分发) */
function modelIcon(type: ModelPlazaModelType | string | undefined): string {
  if (type === 'image') return '🎨'
  if (type === 'av') return '🎬'
  return '🤖'
}

function toModelListItem(m: ModelPlazaItem): ModelListItem {
  const isFree = (m.inputPrice ?? 0) === 0 && (m.outputPrice ?? 0) === 0
  return {
    id: m.id,
    name: m.name,
    description: m.desc || m.tags.join(' · '),
    icon: modelIcon(m.type),
    isFree,
  }
}

function buildModelGroups(models: ModelPlazaItem[]): ModelListGroup[] {
  const grouped = new Map<string, ModelListItem[]>()
  for (const m of models) {
    const list = grouped.get(m.providerId) ?? []
    list.push(toModelListItem(m))
    grouped.set(m.providerId, list)
  }
  const groups: ModelListGroup[] = []
  for (const [vendor, list] of grouped) {
    groups.push({ vendor, models: list })
  }
  return groups
}

export default function ModelPlazaScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [viewMode, setViewMode] = useState<ViewMode>('shared')
  const [models, setModels] = useState<ModelPlazaItem[]>([])
  const [providerId, setProviderId] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<ModelPlazaTypeFilter>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])

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
  const modelGroups = useMemo<ModelListGroup[]>(() => buildModelGroups(models), [models])

  const handleCompare = () => Alert.alert(t('modelPlaza.compare.title'), t('modelPlaza.compare.message'))
  const handleDetail = (m: ModelPlazaItem) =>
    Alert.alert(t('modelPlaza.detail.title'), t('modelPlaza.detail.message', { name: m.name }))

  return (
    <View style={styles.shell}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'shared' && styles.tabActive]}
          onPress={() => setViewMode('shared')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'shared' ? styles.tabTextActive : styles.tabText}>
            模型广场
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'local' && styles.tabActive]}
          onPress={() => setViewMode('local')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'local' ? styles.tabTextActive : styles.tabText}>
            分组浏览
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.viewport}>
        {viewMode === 'shared' ? (
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
        ) : (
          <ModelList
            groups={modelGroups}
            selectionMode="multiple"
            selectedIds={selectedModelIds}
            onSelectChange={setSelectedModelIds}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 48,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: tokens.surface.bg,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
  },
  tabActive: {
    backgroundColor: tokens.brand.DEFAULT,
  },
  tabText: {
    fontSize: 13,
    color: tokens.text.secondary,
  },
  tabTextActive: {
    fontSize: 13,
    color: tokens.surface.light,
    fontWeight: '600',
  },
  viewport: {
    flex: 1,
  },
})
