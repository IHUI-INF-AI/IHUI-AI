import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getN8nWorkflows, type N8nWorkflow } from '@ihui/api-client'
import {
  N8nModelScreen as SharedN8nModelScreen,
  type N8nModelItem,
  type N8nModelTab,
} from '@ihui/rn-app'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import ModelList, { type ModelListGroup, type ModelListItem } from '../components/ModelList'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type ViewMode = 'shared' | 'local'

function toNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function toString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function mapWorkflow(w: N8nWorkflow): N8nModelItem {
  return {
    id: w.id,
    name: w.name,
    desc: w.description ?? '',
    url: toString(w.url),
    status: w.active ? 'running' : 'stopped',
    calls: toNumber(w.calls),
    updatedAt: w.updatedAt ?? w.createdAt ?? '',
    paramsIn: toNumber(w.paramsIn),
    paramsOut: toNumber(w.paramsOut),
  }
}

/** N8nWorkflow → ModelListItem(简化版 ModelList 渲染,固定 1 个 vendor 分组) */
function toModelListItem(w: N8nWorkflow): ModelListItem {
  const isActive = Boolean(w.active)
  return {
    id: w.id,
    name: w.name,
    description: w.description ?? '',
    icon: isActive ? '⚡' : '⏸',
    isFree: true,
  }
}

function buildModelGroup(items: N8nWorkflow[]): ModelListGroup[] {
  return [{ vendor: 'n8n 工作流', models: items.map(toModelListItem) }]
}

export default function N8nModelScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [viewMode, setViewMode] = useState<ViewMode>('shared')
  const [tab, setTab] = useState<N8nModelTab>('all')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<N8nModelItem[]>([])
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getN8nWorkflows()
      if (res.success) {
        const list = res.data?.list ?? []
        setItems(list.map(mapWorkflow))
        setWorkflows(list)
      } else {
        setError(res.error || t('n8nModel.loadFailed'))
      }
    } catch {
      setError(t('n8nModel.loadFailed'))
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

  const handleToggle = (m: N8nModelItem) => {
    Alert.alert(
      m.status === 'running' ? t('n8nModel.toggle.stopTitle') : t('n8nModel.toggle.startTitle'),
      m.status === 'running'
        ? t('n8nModel.toggle.stopMessage', { name: m.name })
        : t('n8nModel.toggle.startMessage', { name: m.name }),
      [
        { text: t('common.cancel') },
        { text: t('common.confirm'), onPress: () => Alert.alert(t('n8nModel.toggle.success')) },
      ],
    )
  }

  const handleEdit = (m: N8nModelItem) => {
    Alert.alert(t('n8nModel.actionEdit'), m.name)
  }

  const handleCreate = () => {
    Alert.alert(t('n8nModel.create'), t('common.comingSoon'))
  }

  const modelGroups = useMemo<ModelListGroup[]>(() => buildModelGroup(workflows), [workflows])

  return (
    <View style={styles.shell}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'shared' && styles.tabActive]}
          onPress={() => setViewMode('shared')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'shared' ? styles.tabTextActive : styles.tabText}>
            工作流
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'local' && styles.tabActive]}
          onPress={() => setViewMode('local')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'local' ? styles.tabTextActive : styles.tabText}>
            列表视图
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.viewport}>
        {viewMode === 'shared' ? (
          <SharedN8nModelScreen
            t={t}
            items={items}
            tab={tab}
            keyword={keyword}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onSelectTab={setTab}
            onKeywordChange={setKeyword}
            onRefresh={onRefresh}
            onRetry={() => void load()}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onCreate={handleCreate}
            onBack={() => navigation.goBack()}
          />
        ) : (
          <ModelList
            groups={modelGroups}
            selectionMode="single"
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
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
