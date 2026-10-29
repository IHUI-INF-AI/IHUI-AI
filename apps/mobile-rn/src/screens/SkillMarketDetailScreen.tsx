// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  SkillMarketDetailScreen as SharedSkillMarketDetailScreen,
  type SkillMarketEntryView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'SkillMarketDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 裸条目形状见宿主列表屏的同名注释(Redis JSON 累积写入 ⇒ 全字段按 unknown 读) */
interface RawMarketEntry {
  name?: unknown
  description?: unknown
  tags?: unknown
  author?: unknown
  version?: unknown
  license?: unknown
  installCount?: unknown
  rating?: unknown
  ratingCount?: unknown
  updatedAt?: unknown
}

interface MarketListPayload {
  items?: RawMarketEntry[] | null
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function toEntry(raw: RawMarketEntry): SkillMarketEntryView {
  return {
    name: toText(raw.name),
    description: toText(raw.description),
    tags: toTextArray(raw.tags),
    author: toText(raw.author),
    version: toText(raw.version),
    license: toText(raw.license),
    installCount: toNumber(raw.installCount),
    rating: toNumber(raw.rating),
    ratingCount: toNumber(raw.ratingCount),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  }
}

/**
 * 技能市场详情 —— RN 宿主壳,对齐 web `/skills-market/[id]`。
 *
 * **反查口径与 web 逐字同源**(apps/web/app/(main)/skills-market/PageClient.tsx:102-111):
 * 走既有的 `GET /api/skills/market`,用 `q` 精确匹配 `name`,**不新增第二个详情端点**。
 * 服务端的 `q` 是 `name OR description` 的子串匹配(skills.ts:759-764),所以本地必须再
 * `find(it => it.name === name)` 收一遍 —— 否则搜「writer」会把描述里含 writer 的条目
 * 当成命中。`pageSize` 取上限 100(`marketQuerySchema` 的 max 是 100),尽量一次取全。
 *
 * 「查不到」与「已下架」在这里是同一个结果:列表端点对非 owner 隐藏 `enabled === false`
 * 的条目,所以反查为空既可能是从没有过、也可能是被上架者下架 —— 共享屏统一渲染
 * notFound 态并回显这条 name,不做"已下架"的伪区分(服务端没给这个信息,编不出来)。
 *
 * 取数与导航在此,渲染全在共享屏 `@ihui/rn-app` 的 SkillMarketDetailScreen。
 */
export function SkillMarketDetailScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { name } = route.params

  const [entry, setEntry] = useState<SkillMarketEntryView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = `q=${encodeURIComponent(name)}&page=1&pageSize=100`
      const res = await fetchApi<MarketListPayload>(`/api/skills/market?${query}`)
      if (!res.success) {
        setEntry(null)
        setError(apiFailureToText(res, t('skillsMarket.loadFailed')))
        return
      }
      const list = Array.isArray(res.data?.items) ? res.data.items : []
      const hit = list.map(toEntry).find((item) => item.name === name) ?? null
      setEntry(hit)
    } catch {
      setEntry(null)
      setError(t('skillsMarket.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [name, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedSkillMarketDetailScreen
      t={t}
      name={name}
      entry={entry}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
      onRetry={() => void load()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
