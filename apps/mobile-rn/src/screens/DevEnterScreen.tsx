/**
 * DevEnterScreen 我的智能体管理页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/dev_enter/index.vue(标题「我的智能体」):
 * - 原页面 = 智能体审核/发布状态管理列表页(非"开发者申请表单"——申请表单语义由 DevEnterCoverScreen 承载)
 * - 一级 Tab(headTypes):待发布(draft) / 审核中(pending) / 已发布(published)
 * - 二级 Tab(tabbarList,仅待发布状态组显示):全部(draft) / 审核失败(rejected) / 已下架(offline)
 * - SearchInput 搜索框(keyword → agent_name 语义,getAgents keyword 参数)
 * - 智能体卡片列表(StateCard):头像 184rpx + 名称(#517BFF 32rpx) + 简介(#414141 24rpx 6 行截断)
 *   - 待发布:右侧「设置」按钮 → ModelEdit(对齐 toDevEdit('edit'))
 *   - 审核中:右侧「审核中」文字
 *   - 已发布:右下「下架」按钮(紫色下划线) → 下架确认弹窗 → PUT /agents/:id status=offline(对齐 deleteZntCharge)
 * - 分页加载(page/pageSize=10)+ 下拉刷新 + 触底加载更多
 * - 空列表:Empty 组件提示
 *
 * 数据源:getAgents({ userId, status, keyword, page, pageSize })(api-client 已有封装,
 * AgentStatus 枚举 draft/pending/published/rejected/offline 与 Uniapp headTypes/tabbarList 一一对应)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getAgents, fetchApi, type Agent, type AgentStatus } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { NavBar } from '../components/NavBar'
import Empty from '../components/common/Empty'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 一级 Tab(对齐 Uniapp headTypes:待发布/审核中/已发布) */
const HEAD_TABS: readonly { id: AgentStatus; label: string }[] = [
  { id: 'draft', label: '待发布' },
  { id: 'pending', label: '审核中' },
  { id: 'published', label: '已发布' },
]

/** 二级 Tab(对齐 Uniapp tabbarList:全部/审核失败/已下架,仅待发布状态组显示) */
const SUB_TABS: readonly { id: AgentStatus; label: string }[] = [
  { id: 'draft', label: '全部' },
  { id: 'rejected', label: '审核失败' },
  { id: 'offline', label: '已下架' },
]

const PAGE_SIZE = 10

/** 状态 → 中文标签(卡片右侧操作文案) */
const STATUS_TEXT: Record<AgentStatus, string> = {
  draft: '待发布',
  pending: '审核中',
  published: '已发布',
  rejected: '审核失败',
  offline: '已下架',
}

/** 时间格式化(YYYY-MM-DD HH:mm) */
function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function DevEnterScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { user } = useAuth()

  const [headTab, setHeadTab] = useState<AgentStatus>('draft')
  const [subTab, setSubTab] = useState<AgentStatus>('draft')
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [list, setList] = useState<Agent[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)
  // 下架确认弹窗(对齐 Uniapp prompt_dialog)
  const [offlineTarget, setOfflineTarget] = useState<Agent | null>(null)
  const [offlining, setOfflining] = useState(false)

  /** 当前生效状态:已发布/审核中直接映射;待发布组走二级 Tab 映射 */
  const activeStatus: AgentStatus =
    headTab === 'published' ? 'published' : headTab === 'pending' ? 'pending' : subTab

  const load = useCallback(
    async (pageNum: number, replace: boolean, showRefresh: boolean): Promise<void> => {
      if (showRefresh) setLoading(true)
      try {
        const res = await getAgents({
          userId: user?.id ?? undefined,
          status: activeStatus,
          keyword: keyword.trim() || undefined,
          page: pageNum,
          pageSize: PAGE_SIZE,
        })
        if (res.success) {
          const items = res.data?.list ?? []
          setList((prev) => (replace ? items : [...prev, ...items]))
          setTotal(res.data?.total ?? items.length)
          setHasMore(items.length >= PAGE_SIZE)
          setPage(pageNum)
        } else {
          Alert.alert(t('common.hint'), res.error || '加载失败，请重试')
        }
      } catch {
        Alert.alert(t('common.hint'), '加载失败，请检查网络')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [activeStatus, keyword, t, user?.id],
  )

  // 状态/搜索变化 → 重置并加载第一页
  useEffect(() => {
    setList([])
    setPage(1)
    setHasMore(true)
    void load(1, true, true)
  }, [activeStatus, load])

  const onRefresh = useCallback((): void => {
    setRefreshing(true)
    void load(1, true, false)
  }, [load])

  const onLoadMore = useCallback((): void => {
    if (loading || refreshing || !hasMore) return
    void load(page + 1, false, false)
  }, [loading, refreshing, hasMore, load, page])

  const handleSearch = useCallback((): void => {
    setKeyword(searchInput.trim())
  }, [searchInput])

  /** 下架确认(对齐 Uniapp showWindow → deleteZntCharge:PUT /agents/:id status=offline) */
  const confirmOffline = useCallback(async (): Promise<void> => {
    if (!offlineTarget) return
    setOfflining(true)
    try {
      const res = await fetchApi<Agent>(`/agents/${offlineTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'offline' }),
      })
      if (res.success) {
        setList((prev) => prev.filter((a) => a.id !== offlineTarget.id))
        setTotal((n) => Math.max(0, n - 1))
        setOfflineTarget(null)
      } else {
        Alert.alert(t('common.hint'), res.error || '下架失败，请重试')
      }
    } catch {
      Alert.alert(t('common.hint'), '下架失败，请检查网络')
    } finally {
      setOfflining(false)
    }
  }, [offlineTarget, t])

  const renderCard = useCallback(
    ({ item }: { item: Agent }) => {
      const isPublished = item.status === 'published'
      const isPending = item.status === 'pending'
      return (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.avatarWrap}>
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>{item.name.slice(0, 1)}</Text>
                </View>
              )}
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description || '暂无简介'}
              </Text>
              <View style={styles.cardFooter}>
                {isPublished ? (
                  <TouchableOpacity onPress={() => setOfflineTarget(item)} activeOpacity={0.7}>
                    <Text style={styles.offlineBtn}>下架</Text>
                  </TouchableOpacity>
                ) : isPending ? (
                  <Text style={styles.statusText}>审核中</Text>
                ) : (
                  <>
                    {item.status === 'draft' ? (
                      <TouchableOpacity
                        onPress={() => navigation.navigate('ModelEdit')}
                        activeOpacity={0.7}
                        style={styles.setBtn}
                      >
                        <Text style={styles.setBtnText}>设置</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.statusText}>{STATUS_TEXT[item.status]}</Text>
                    )}
                  </>
                )}
              </View>
            </View>
          </View>
          {isPublished ? (
            <View style={styles.publishedMeta}>
              <Text style={styles.metaLine}>所属类别：{item.category || '未分类'}</Text>
              <Text style={styles.metaLine}>上架时间：{formatTime(item.createdAt) || '—'}</Text>
            </View>
          ) : null}
        </View>
      )
    },
    [navigation],
  )

  const items = useMemo(() => list, [list])

  return (
    <View style={styles.shell}>
      <NavBar title="我的智能体" onBack={() => navigation.goBack()} />

      {/* 一级 Tab(对齐 Uniapp models_bar headTypes) */}
      <View style={styles.headTabBar}>
        {HEAD_TABS.map((tab) => {
          const active = headTab === tab.id
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.headTab, active ? styles.headTabActive : null]}
              onPress={() => setHeadTab(tab.id)}
              activeOpacity={0.8}
            >
              <Text style={active ? styles.headTabTextActive : styles.headTabText}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* SearchInput 搜索框(对齐 Uniapp SearchInput → searchChange) */}
      <View style={styles.searchRow}>
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="搜索智能体名称"
          placeholderTextColor={tokens.text.tertiary}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.8}>
          <Text style={styles.searchBtnText}>搜索</Text>
        </TouchableOpacity>
      </View>

      {/* 二级 Tab(仅待发布组显示,对齐 Uniapp models_bar2 tabbarList) */}
      {headTab === 'draft' ? (
        <View style={styles.subTabBar}>
          {SUB_TABS.map((tab) => {
            const active = subTab === tab.id
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.subTab, active ? styles.subTabActive : null]}
                onPress={() => setSubTab(tab.id)}
                activeOpacity={0.8}
              >
                <Text style={active ? styles.subTabTextActive : styles.subTabText}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReachedThreshold={0.3}
        onEndReached={onLoadMore}
        ListEmptyComponent={
          loading ? null : <Empty text={keyword ? '未找到匹配的智能体' : '暂无智能体'} />
        }
        ListFooterComponent={
          list.length > 0 ? (
            <Text style={styles.footerText}>
              {loading ? '加载中...' : hasMore ? '' : `共 ${total} 条，已全部加载`}
            </Text>
          ) : null
        }
      />

      {/* 下架确认弹窗(对齐 Uniapp prompt_dialog:是否确定下架此智能体) */}
      <Modal
        visible={offlineTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOfflineTarget(null)}
      >
        <View style={styles.mask}>
          <View style={styles.promptDialog}>
            <Text style={styles.promptContent}>是否确定下架此智能体？</Text>
            <View style={styles.promptFooter}>
              <Pressable
                style={[styles.promptBtn, styles.promptCancel]}
                onPress={() => setOfflineTarget(null)}
                disabled={offlining}
              >
                <Text style={styles.promptCancelText}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.promptBtn, styles.promptConfirm]}
                onPress={() => void confirmOffline()}
                disabled={offlining}
              >
                <Text style={styles.promptConfirmText}>{offlining ? '处理中...' : '确定'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  } as ViewStyle,
  headTabBar: {
    flexDirection: 'row',
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(16),
    gap: rpx(16),
  } as ViewStyle,
  headTab: {
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(10),
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  headTabActive: {
    backgroundColor: tokens.brand.DEFAULT,
  } as ViewStyle,
  headTabText: {
    fontSize: 14,
    color: tokens.text.secondary,
  } as TextStyle,
  headTabTextActive: {
    fontSize: 14,
    color: tokens.surface.light,
    fontWeight: '600',
  } as TextStyle,
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(12),
    paddingHorizontal: rpx(20),
    paddingBottom: rpx(8),
  } as ViewStyle,
  searchInput: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    paddingHorizontal: rpx(16),
    fontSize: 14,
    color: tokens.text.primary,
  } as TextStyle,
  searchBtn: {
    height: 38,
    paddingHorizontal: rpx(20),
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  searchBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  } as TextStyle,
  subTabBar: {
    flexDirection: 'row',
    paddingHorizontal: rpx(20),
    paddingBottom: rpx(12),
    gap: rpx(12),
  } as ViewStyle,
  subTab: {
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(6),
    borderRadius: 6,
  } as ViewStyle,
  subTabActive: {
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  subTabText: {
    fontSize: 13,
    color: tokens.text.secondary,
  } as TextStyle,
  subTabTextActive: {
    fontSize: 13,
    color: tokens.brand.DEFAULT,
    fontWeight: '600',
  } as TextStyle,
  listContent: {
    paddingHorizontal: rpx(20),
    paddingBottom: rpx(32),
    flexGrow: 1,
  } as ViewStyle,
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DADADA',
    borderRadius: 15,
    marginTop: rpx(18),
    backgroundColor: tokens.surface.card,
    padding: rpx(20),
  } as ViewStyle,
  cardTop: {
    flexDirection: 'row',
  } as ViewStyle,
  avatarWrap: {
    marginRight: rpx(18),
  } as ViewStyle,
  avatar: {
    width: rpx(184) / 2,
    height: rpx(184) / 2,
    borderRadius: 8,
  } as ImageStyle,
  avatarFallback: {
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  avatarFallbackText: {
    fontSize: 24,
    fontWeight: '600',
    color: tokens.text.secondary,
  } as TextStyle,
  cardContent: {
    flex: 1,
  } as ViewStyle,
  cardTitle: {
    fontSize: 16,
    color: '#517BFF',
  } as TextStyle,
  cardDesc: {
    fontSize: 12,
    color: '#414141',
    lineHeight: 18,
    marginTop: 4,
  } as TextStyle,
  cardFooter: {
    marginTop: rpx(10),
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  } as ViewStyle,
  setBtn: {
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(6),
    borderRadius: 6,
    backgroundColor: tokens.brand.DEFAULT,
  } as ViewStyle,
  setBtnText: {
    fontSize: 12,
    color: tokens.surface.light,
    fontWeight: '500',
  } as TextStyle,
  statusText: {
    fontSize: 13,
    color: tokens.text.secondary,
  } as TextStyle,
  offlineBtn: {
    fontSize: 14,
    color: '#7B61FF',
    fontWeight: '500',
    textDecorationLine: 'underline',
  } as TextStyle,
  publishedMeta: {
    marginTop: rpx(16),
    paddingTop: rpx(14),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D8D8D8',
    gap: rpx(6),
  } as ViewStyle,
  metaLine: {
    fontSize: 12,
    color: '#3D3D3D',
  } as TextStyle,
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: tokens.text.tertiary,
    paddingVertical: rpx(16),
  } as TextStyle,
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  promptDialog: {
    width: rpx(431) / 2,
    borderRadius: 10,
    backgroundColor: '#F5F7FA',
    paddingVertical: rpx(36),
    paddingHorizontal: rpx(24),
    alignItems: 'center',
  } as ViewStyle,
  promptContent: {
    fontSize: 13,
    fontWeight: '500',
    color: '#B0AEFA',
    letterSpacing: 1,
    textAlign: 'center',
  } as TextStyle,
  promptFooter: {
    flexDirection: 'row',
    marginTop: rpx(28),
    gap: rpx(24),
  } as ViewStyle,
  promptBtn: {
    width: rpx(143) / 2,
    height: rpx(54) / 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  promptCancel: {
    backgroundColor: '#FFFFFF',
  } as ViewStyle,
  promptConfirm: {
    backgroundColor: '#CFCEFF',
  } as ViewStyle,
  promptCancelText: {
    fontSize: 12,
    color: '#3D3D3D',
  } as TextStyle,
  promptConfirmText: {
    fontSize: 12,
    color: '#FFFFFF',
  } as TextStyle,
})

export { DevEnterScreen }
