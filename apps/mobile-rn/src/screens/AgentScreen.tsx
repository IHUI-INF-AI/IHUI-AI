import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAgents, getAiModels, type Agent, type AiModel } from '@ihui/api-client'
import { AgentScreen as SharedAgentScreen, type AgentScreenItem } from '@ihui/rn-app'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import ModelList, { type ModelListGroup, type ModelListItem } from '../components/ModelList'
import Carousel from '../components/Carousel'
import RecentAgents, { type RecentAgentItem } from '../components/RecentAgents'
import type { CarouselItem } from '@ihui/ui-native'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type ViewMode = 'shared' | 'local'

function mapToItem(a: Agent): AgentScreenItem {
  return {
    id: a.id,
    name: a.name,
    avatar: a.avatar ?? undefined,
    description: a.description,
    isVipExclusive: a.isVipExclusive,
    useCount: a.useCount,
    rating: a.rating,
  }
}

function readNumber(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null
}

function readModelType(v: unknown): 'image' | 'av' | 'text' {
  return v === 'image' || v === 'av' ? v : 'text'
}

function modelIcon(type: 'image' | 'av' | 'text' | string | undefined): string {
  if (type === 'image') return '🎨'
  if (type === 'av') return '🎬'
  return '🤖'
}

function toModelListItem(m: AiModel): ModelListItem {
  const inputPrice = readNumber(m.inputPrice) ?? 0
  const outputPrice = readNumber(m.outputPrice) ?? 0
  return {
    id: m.id,
    name: m.name,
    description: m.description ?? '',
    icon: modelIcon(readModelType(m.type)),
    isFree: inputPrice === 0 && outputPrice === 0,
  }
}

function buildModelGroups(models: AiModel[]): ModelListGroup[] {
  const map = new Map<string, ModelListItem[]>()
  for (const m of models) {
    const provider = m.provider || '其他'
    const list = map.get(provider) ?? []
    list.push(toModelListItem(m))
    map.set(provider, list)
  }
  const groups: ModelListGroup[] = []
  for (const [vendor, list] of map) {
    groups.push({ vendor, models: list })
  }
  return groups
}

export function AgentScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [viewMode, setViewMode] = useState<ViewMode>('shared')
  const [items, setItems] = useState<AgentScreenItem[]>([])
  const [aiModels, setAiModels] = useState<AiModel[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  // 顶部轮播图(对齐 Uniapp banner_carousel,空数组占位待 API 接入)
  const [banners] = useState<CarouselItem[]>([])
  // 最近使用智能体(对齐 Uniapp RecentAgents,空数组占位待 API 接入)
  const [recentAgents] = useState<RecentAgentItem[]>([])

  const loadAgents = useCallback(async () => {
    const res = await getAgents({ status: 'published', pageSize: 50 })
    if (res.success) setItems((res.data.list ?? []).map(mapToItem))
    else setError(res.error || t('agentScreen.loadFailed'))
  }, [t])

  const loadModels = useCallback(async () => {
    const res = await getAiModels({ pageSize: 100 })
    if (res.success) setAiModels(res.data.list ?? [])
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      await Promise.all([loadAgents(), loadModels()])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('agentScreen.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadAgents, loadModels, t])

  useEffect(() => {
    void load()
  }, [load])

  const modelGroups = useMemo<ModelListGroup[]>(() => buildModelGroups(aiModels), [aiModels])

  // Agent 卡片点击 → 登录校验 → AiAssistant(对齐 Uniapp ai_assistant?agentId=xxx)
  const handleItemClick = useCallback(
    (id: string) => {
      if (!token) {
        Alert.alert(t('common.hint'), '请先登录', [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.login'), onPress: () => navigation.navigate('Login') },
        ])
        return
      }
      // TODO: 付费判断(需要 getAgentPermission API + item.isVipExclusive)
      // TODO: n8n 分流(需要 item.type 和 item.source 字段)
      const agent = items.find((a) => a.id === id)
      navigation.navigate('AiAssistant', { agentId: id, title: agent?.name })
    },
    [token, t, navigation, items],
  )

  return (
    <View style={styles.shell}>
      {banners.length > 0 ? (
        <View style={styles.carouselWrap}>
          <Carousel banner={banners} onItemPress={(item) => { void item }} />
        </View>
      ) : null}
      {recentAgents.length > 0 ? (
        <RecentAgents
          items={recentAgents}
          onItemClick={(item) => handleItemClick(item.id)}
        />
      ) : null}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'shared' && styles.tabActive]}
          onPress={() => setViewMode('shared')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'shared' ? styles.tabTextActive : styles.tabText}>
            智能体
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'local' && styles.tabActive]}
          onPress={() => setViewMode('local')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'local' ? styles.tabTextActive : styles.tabText}>
            模型选择
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.viewport}>
        {viewMode === 'shared' ? (
          <SharedAgentScreen
            t={t}
            items={items}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onRefresh={() => {
              setRefreshing(true)
              void load()
            }}
            onPressItem={(id) => handleItemClick(id)}
            onBack={() => navigation.goBack()}
          />
        ) : (
          <ModelList
            groups={modelGroups}
            selectionMode="single"
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
  carouselWrap: {
    marginTop: 48,
    marginHorizontal: 12,
    borderRadius: 8,
    overflow: 'hidden',
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
