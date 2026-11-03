// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// P
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTheme } from '../context/ThemeContext'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { appAlert } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAiModels, getModelContextCapacity, type AiModel } from '@ihui/api-client'
import { FALLBACK_MODELS } from '@ihui/shared/constants'
import {
  ModelPlazaScreen as SharedModelPlazaScreen,
  type ModelPlazaItem,
  type ModelPlazaModelType,
  type ModelPlazaProvider,
  type ModelPlazaTypeFilter,
} from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import ModelList, { type ModelListGroup, type ModelListItem } from '../components/ModelList'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'
import { Bot, Film, Palette, type LucideIcon } from 'lucide-react-native'

import { rnRadius } from '@ihui/design-tokens'

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

/** 容量 tag(2026-10-31 恢复:转壳承载时丢的维)—— 单一出口 getModelContextCapacity,
 * 广场是用户直接看到"128K/32K"这类字样的地方,写死一个数 = 对一半以上的模型报错误规格 */
function capacityTagFromK(k: number): string {
  const label = '上下文'
  return k >= 1000 ? `${k / 1000}M${label}` : `${k}K${label}`
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
    tags: [capacityTagFromK(getModelContextCapacity(m.id) / 1000), ...readStringArray(m.tags)],
    payMode: readString(m.payMode),
  }
}

/** 已验证兜底模型(仅后端 /ai/models 不可达或返回空时降级,映射自共享 FALLBACK_MODELS;
 *  容量走同一出口,形状锁 fallback-capacity-single-source 的取材点随壳承载迁到这里) */
function fallbackItems(): ModelPlazaItem[] {
  return FALLBACK_MODELS.map((f) => ({
    id: f.value,
    providerId: f.vendor,
    name: f.label,
    type: 'text' as ModelPlazaModelType,
    inputPrice: 0,
    outputPrice: 0,
    desc: '',
    tags: [capacityTagFromK(getModelContextCapacity(f.value) / 1000)],
    payMode: 'free',
  }))
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
function modelIcon(type: ModelPlazaModelType | string | undefined): LucideIcon | string {
  if (type === 'image') return Palette
  if (type === 'av') return Film
  return Bot
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
  const { resolvedTheme } = useTheme()
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
      if (resp.success && resp.data.list.length > 0) {
        const list = resp.data.list.map(mapAiModel)
        setModels(list)
        setProviderId((prev) => {
          if (prev && list.some((m) => m.providerId === prev)) return prev
          return list[0]?.providerId ?? ''
        })
      } else {
        // 后端不可达/返回空 ⇒ 降级到已验证兜底组(旧端内版同语义,转壳时且回)。
        // 不 setError:降级列表是可用内容,挂错误横幅反而挡住它。
        const list = fallbackItems()
        setModels(list)
        setProviderId((prev) => {
          if (prev && list.some((m) => m.providerId === prev)) return prev
          return list[0]?.providerId ?? ''
        })
      }
    } catch {
      const list = fallbackItems()
      setModels(list)
      setProviderId((prev) => {
        if (prev && list.some((m) => m.providerId === prev)) return prev
        return list[0]?.providerId ?? ''
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const providers = buildProviders(models)
  const modelGroups = useMemo<ModelListGroup[]>(() => buildModelGroups(models), [models])

  const handleCompare = () =>
    appAlert(t('modelPlaza.compare.title'), t('modelPlaza.compare.message'))
  const handleDetail = (m: ModelPlazaItem) =>
    appAlert(t('modelPlaza.detail.title'), t('modelPlaza.detail.message', { name: m.name }))

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
            {t('modelPlaza.groupBrowse')}
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
            colorScheme={resolvedTheme}
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
    paddingHorizontal: rpx(24),
    paddingTop: rpx(96),
    paddingBottom: rpx(16),
    gap: rpx(16),
    backgroundColor: tokens.surface.bg,
  },
  tab: {
    paddingHorizontal: rpx(28),
    paddingVertical: rpx(12),
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.muted,
  },
  tabActive: {
    backgroundColor: tokens.brand.cta,
  },
  tabText: {
    fontSize: 13,
    color: tokens.text.secondary,
  },
  tabTextActive: {
    fontSize: 13,
    color: tokens.brand.ctaForeground,
    fontWeight: '600',
  },
  viewport: {
    flex: 1,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
