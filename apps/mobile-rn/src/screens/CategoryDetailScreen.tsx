/**
 * CategoryDetailScreen AI Agent 分类详情 (mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp category-detail.vue(分类筛选 + agent 列表 + 分页 + 收藏):
 * - NavBar(title 从路由参数)
 * - 分类标签横滚(从 getCategories 拉取,当前分类高亮,切换重新加载)
 * - agent 列表(复用 AgentList 组件):头像/名称/描述/操作按钮(收藏)
 * - 分页:首次加载 + 底部"加载更多"按钮(AgentList 未暴露 onEndReached,用按钮触发)
 * - 数据:getAgents({ categoryId, page, pageSize })
 * - 收藏:onItemAction 走 Alert 占位(api-client 暂无收藏 API)
 * 路由参数:{ categoryId: string; title: string }
 * 类型零 any;颜色走 rnLightTokens;圆角仅 12/8/6;无分割线。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAgents, getCategories, type Agent, type Category } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import AgentList, { type AgentListItem } from '../components/AgentList'
import Empty from '../components/common/Empty'
import { NavBar } from '../components/NavBar'
import type { RootStackParamList } from '../navigation/RootNavigator'

type CategoryDetailParams = {
  CategoryDetail: { categoryId: string; title: string }
}
type Route = RouteProp<CategoryDetailParams, 'CategoryDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

function toAgentListItem(a: Agent): AgentListItem {
  return {
    id: a.id,
    name: a.name,
    avatar: a.avatar ?? undefined,
    description: a.description,
    category: a.category,
  }
}

export default function CategoryDetailScreen() {
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { categoryId, title } = route.params
  const [categories, setCategories] = useState<Category[]>([])
  const [activeId, setActiveId] = useState(categoryId)
  const [items, setItems] = useState<AgentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // 加载分类标签
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getCategories()
      if (!cancelled && res.success && res.data) setCategories(res.data)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadAgents = useCallback(async (catId: string, nextPage: number, append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    const res = await getAgents({ categoryId: catId, page: nextPage, pageSize: PAGE_SIZE })
    if (res.success && res.data) {
      const list = res.data.list.map(toAgentListItem)
      setItems((prev) => (append ? [...prev, ...list] : list))
      setHasMore(list.length >= PAGE_SIZE)
      setPage(nextPage)
    } else if (!append) {
      setItems([])
      setHasMore(false)
    }
    setLoading(false)
    setLoadingMore(false)
  }, [])

  useEffect(() => {
    void loadAgents(activeId, 1, false)
  }, [activeId, loadAgents])

  const onSelectCategory = (id: string) => {
    if (id === activeId) return
    setActiveId(id)
  }

  const onItemClick = (id: string) => navigation.navigate('AgentDetail', { id })
  const onItemAction = (_id: string) => Alert.alert('收藏', '收藏功能即将上线,敬请期待')

  const onLoadMore = () => {
    if (hasMore && !loadingMore && !loading) void loadAgents(activeId, page + 1, true)
  }

  return (
    <View style={styles.container}>
      <NavBar title={title} onBack={() => navigation.goBack()} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}
      >
        {categories.map((c) => {
          const active = String(c.id) === activeId
          return (
            <TouchableOpacity
              key={String(c.id)}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.7}
              onPress={() => onSelectCategory(String(c.id))}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      <View style={styles.listFlex}>
        {loading ? (
          <ActivityIndicator style={styles.center} color={tokens.text.secondary} />
        ) : items.length === 0 ? (
          <Empty text="该分类下暂无 Agent" />
        ) : (
          <AgentList
            items={items}
            onItemClick={onItemClick}
            onItemAction={onItemAction}
            emptyText="该分类下暂无 Agent"
          />
        )}
      </View>
      {!loading && items.length > 0 ? (
        <TouchableOpacity
          style={styles.footer}
          onPress={onLoadMore}
          disabled={!hasMore || loadingMore}
          activeOpacity={0.7}
        >
          <Text style={styles.footerText}>
            {loadingMore ? '加载中...' : hasMore ? '加载更多' : '没有更多了'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  tabs: { maxHeight: 48 },
  tabsContent: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: tokens.surface.card,
  },
  tabActive: { backgroundColor: tokens.brand.DEFAULT },
  tabText: { fontSize: 13, color: tokens.text.primary },
  tabTextActive: { color: tokens.surface.light, fontWeight: '600' },
  listFlex: { flex: 1, padding: 12 },
  center: { marginTop: 40 },
  footer: { paddingVertical: 12, alignItems: 'center' },
  footerText: { fontSize: 12, color: tokens.text.tertiary },
})
