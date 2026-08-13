/**
 * KnowledgePlanetScreen 知识星球页面(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/coursePlanet/index.vue + KnowledgePlanet 组件:
 * - 顶部 NavBar(标题「知识星球」+ 返回)
 * - 数据加载:fetchApi 拉取 /resource/getKnowledgePlanet?type=1(官方资讯)
 * - 下拉刷新 / 错误态 / 空态
 * - 包裹 KnowledgePlanet 组件,点击条目跳转资讯详情(AnnouncementDetail)
 * - 浅色优雅风,rnLightTokens;圆角守门;无分割线
 */
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { KnowledgePlanet, type KnowledgePlanetItem } from '../components/KnowledgePlanet'
import { NavBar } from '../components/NavBar'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 历史项目 /resource/getKnowledgePlanet 返回的原始条目结构(字段名对齐 Uniapp 用法) */
interface KnowledgePlanetRawItem {
  id: string | number
  title: string
  img?: string
  time?: string | number
  classification?: string
  NumberOfVisitors?: number
  NumberOfForwarding?: number
}

const API_PATH = '/resource/getKnowledgePlanet?type=1'

/** 将原始 time 字段统一为毫秒时间戳 */
function toTimestamp(time: string | number | undefined): number {
  if (time === undefined || time === null) return Date.now()
  if (typeof time === 'number') {
    return time < 1e12 ? time * 1000 : time
  }
  const parsed = Date.parse(time)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

/** 原始条目 → 组件条目 */
function toItem(raw: KnowledgePlanetRawItem): KnowledgePlanetItem {
  return {
    id: String(raw.id),
    title: raw.title,
    cover: raw.img,
    summary: raw.classification,
    createdAt: toTimestamp(raw.time),
  }
}

export function KnowledgePlanetScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<KnowledgePlanetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<KnowledgePlanetRawItem[]>(API_PATH)
      if (!res.success) throw new Error()
      const rawList = res.data ?? []
      setItems(rawList.map(toItem))
    } catch {
      setError('加载失败,请下拉刷新重试')
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

  const onItemClick = (id: string) => {
    navigation.navigate('AnnouncementDetail', { id })
  }

  return (
    <View style={styles.container}>
      <NavBar title="知识星球" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="small" color={tokens.text.secondary} />
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <View style={styles.flex}>
          <KnowledgePlanet
            items={items}
            onItemClick={onItemClick}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  } as ViewStyle,
  flex: {
    flex: 1,
  } as ViewStyle,
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  } as ViewStyle,
  errorText: {
    fontSize: 14,
    lineHeight: 18,
    color: tokens.error.text,
    textAlign: 'center',
  } as TextStyle,
})

export default KnowledgePlanetScreen
