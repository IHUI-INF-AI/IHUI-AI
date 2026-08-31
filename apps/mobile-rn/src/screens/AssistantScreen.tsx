// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { getAgents, type Agent } from '@ihui/api-client'
import {
  AssistantScreen as SharedAssistantScreen,
  type AssistantItem,
  type AssistantStatus,
  type AssistantSubTab,
  type AssistantTab,
} from '@ihui/rn-app'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import MaterialList, { type MaterialItem } from '../components/MaterialList'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { rpx } from '../utils/rpx'

type ViewMode = 'shared' | 'local'

export default function AssistantScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<ViewMode>('shared')
  const [tab, setTab] = useState<AssistantTab>('draft')
  const [subTab, setSubTab] = useState<AssistantSubTab>('all')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<AssistantItem[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [materialCategory, setMaterialCategory] = useState<string>('all')

  const load = useCallback(async () => {
    setError('')
    try {
      const resp = await getAgents({ pageSize: 100 })
      if (!resp.success) throw new Error(resp.error)
      const list: Agent[] = resp.data.list ?? []
      setAgents(list)
      const mapped: AssistantItem[] = list.map((a: Agent) => ({
        id: a.id,
        name: a.name,
        prologue: a.description,
        status: (a.status === 'pending' ? 'reviewing' : a.status) as AssistantStatus,
        category: a.category || a.tags.join(','),
        price: 0,
        cycle: '',
        audience: a.isVipExclusive ? t('assistant.audienceVip') : t('assistant.audienceAll'),
        publishTime: a.createdAt ? a.createdAt.slice(0, 10) : '-',
      }))
      setItems(mapped)
    } catch {
      setError(t('assistant.loadFailed'))
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

  // 编辑智能体 → ModelEdit 页(对齐原项目 dev_enter/model_edit.vue 编辑弹层升级为独立页)
  // 弹确认占位并复用 assistant.edit.title/message(设置售卖配置),确认后进入编辑。
  const handleEdit = (a: AssistantItem) => {
    Alert.alert(t('assistant.edit.title'), t('assistant.edit.message', { name: a.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: () => navigation.navigate('ModelEdit') },
    ])
  }

  const handleOffline = (a: AssistantItem) =>
    Alert.alert(t('assistant.offline.title'), t('assistant.offline.message', { name: a.name }), [
      { text: t('common.cancel') },
      {
        text: t('assistant.offline.confirmBtn'),
        style: 'destructive',
        onPress: () => Alert.alert(t('assistant.offline.done')),
      },
    ])

  // 派生 MaterialList 数据(每个 Agent 作为一条 doc 类素材)
  const materialItems = useMemo<MaterialItem[]>(
    () =>
      agents.map((a) => ({
        id: a.id,
        title: a.name,
        type: 'doc' as const,
        createdAt: a.createdAt ? a.createdAt.slice(0, 10) : undefined,
      })),
    [agents],
  )

  const filteredMaterialItems = useMemo<MaterialItem[]>(
    () =>
      materialCategory === 'all'
        ? materialItems
        : materialItems.filter((m) => m.type === materialCategory),
    [materialItems, materialCategory],
  )

  return (
    <View style={styles.shell}>
      <NavBar title="智能体助手" onBack={() => navigation.goBack()} />
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'shared' && styles.tabActive]}
          onPress={() => setViewMode('shared')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'shared' ? styles.tabTextActive : styles.tabText}>
            助手管理
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'local' && styles.tabActive]}
          onPress={() => setViewMode('local')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'local' ? styles.tabTextActive : styles.tabText}>AI 素材</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.viewport}>
        {viewMode === 'shared' ? (
          <SharedAssistantScreen
            t={t}
            items={items}
            tab={tab}
            subTab={subTab}
            keyword={keyword}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onTabChange={setTab}
            onSubTabChange={setSubTab}
            onKeywordChange={setKeyword}
            onRefresh={onRefresh}
            onEdit={handleEdit}
            onOffline={handleOffline}
          />
        ) : (
          <MaterialList
            categories={[
              { key: 'all', label: '全部' },
              { key: 'doc', label: 'AI 助手素材' },
            ]}
            activeCategory={materialCategory}
            onCategoryChange={setMaterialCategory}
            items={filteredMaterialItems}
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
    paddingHorizontal: rpx(24),
    paddingTop: rpx(96),
    paddingBottom: rpx(16),
    gap: rpx(16),
    backgroundColor: tokens.surface.bg,
  },
  tab: {
    paddingHorizontal: rpx(28),
    paddingVertical: rpx(12),
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
