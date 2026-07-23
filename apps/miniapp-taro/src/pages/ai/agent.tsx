import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { getAgentList } from '@/api'
import {
  SearchBar,
  ModelTypeButtonGroup,
  ModelConfigDialog,
  BottomActionBar,
  EmptyState,
  type AgentInfo as AgentItem,
  type ModelConfig,
  type ModelType,
} from '@/components'
import { useI18n } from '@/i18n'
import './agent.css'

type CategoryKey = 'recommend' | 'office' | 'writing' | 'coding' | 'education' | 'life'
type SortKey = 'hot' | 'newest' | 'uses'
type QuickTabKey = 'all' | 'favorites' | 'recent'

const CATEGORY_KEYWORDS: Record<Exclude<CategoryKey, 'recommend'>, string[]> = {
  office: ['办公', '会议', '邮件', 'excel', 'word', 'ppt', '文档', '表格', 'office'],
  writing: ['写', '文案', '文章', '创作', '小说', '内容', '写作', '文字'],
  coding: ['代码', '编程', '程序', '开发', 'bug', '函数', '前端', '后端', 'python', 'javascript', 'code'],
  education: ['学', '教', '课', '知识', '考试', '题', '教育', '讲解', '题解'],
  life: ['生活', '健康', '美食', '旅游', '运动', '购物', '日常', 'life'],
}

function detectCategory(name: string, desc: string): string {
  const text = `${name} ${desc}`.toLowerCase()
  for (const key of Object.keys(CATEGORY_KEYWORDS) as Array<Exclude<CategoryKey, 'recommend'>>) {
    if (CATEGORY_KEYWORDS[key].some((kw) => text.includes(kw.toLowerCase()))) {
      return key
    }
  }
  return 'other'
}

/** 智能体收藏本地存储 key(与 agent-detail.tsx 共享) */
const FAVORITE_KEY = 'ai_agent_favorites'
/** 智能体最近使用本地存储 key(按时间倒序,最多 20 条) */
const RECENT_KEY = 'ai_agent_recent'

/** 根据 uses 数推算评分(原项目 RateController 提供真实评分,API 未返回时降级估算) */
function estimateRating(uses: number | undefined): number {
  if (!uses || uses <= 0) return 0
  if (uses < 50) return 3.5 + Math.min(1, uses / 50) * 0.5
  if (uses < 500) return 4 + Math.min(1, (uses - 50) / 450) * 0.5
  return 4.5 + Math.min(0.5, (uses - 500) / 1000)
}

/** 读取本地收藏 id 列表 */
function readFavorites(): string[] {
  try {
    const raw = Taro.getStorageSync(FAVORITE_KEY)
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

/** 读取本地最近使用 id 列表(已按时间倒序) */
function readRecent(): string[] {
  try {
    const raw = Taro.getStorageSync(RECENT_KEY)
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export default function AgentPage() {
  const { t } = useI18n()
  const [list, setList] = useState<AgentItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<ModelType | ''>('')
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('recommend')
  const [showConfig, setShowConfig] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('hot')
  const [quickTab, setQuickTab] = useState<QuickTabKey>('all')
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [config, setConfig] = useState<ModelConfig>({
    temperature: 0.7,
    maxTokens: 2048,
    streamEnabled: true,
  })

  const filtered = useMemo(() => {
    let arr = list
    // 快捷 Tab 筛选(收藏 / 最近使用)
    if (quickTab === 'favorites') {
      const favSet = new Set(favoriteIds)
      arr = arr.filter((a) => favSet.has(a.id))
    } else if (quickTab === 'recent') {
      const recSet = new Set(recentIds)
      arr = arr.filter((a) => recSet.has(a.id))
      // 最近使用按最近使用顺序排序
      const orderMap = new Map(recentIds.map((id, idx) => [id, idx]))
      arr = arr.slice().sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
      return arr
    }
    // 模型类型筛选
    if (activeType) {
      arr = arr.filter((a) => (a.category || '').toLowerCase().includes(activeType))
    }
    // 分类筛选
    if (activeCategory !== 'recommend') {
      arr = arr.filter((a) => (a.category || '') === activeCategory)
    }
    // 关键词筛选
    if (keyword) {
      const kw = keyword.toLowerCase()
      arr = arr.filter(
        (a) =>
          (a.name || '').toLowerCase().includes(kw) || (a.desc || '').toLowerCase().includes(kw),
      )
    }
    // 排序
    if (sortKey === 'uses') {
      arr = arr.slice().sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0))
    } else if (sortKey === 'newest') {
      // 原项目按 createdAt 倒序,API 未返回时按列表顺序倒序近似
      arr = arr.slice().reverse()
    } else {
      // hot:综合 uses + 评分
      arr = arr.slice().sort(
        (a, b) => (b.uses ?? 0) + estimateRating(b.uses) * 10 - ((a.uses ?? 0) + estimateRating(a.uses) * 10),
      )
    }
    return arr
  }, [list, keyword, activeType, activeCategory, sortKey, quickTab, favoriteIds, recentIds])

  /** 顶部热门推荐横向 Banner,取 uses 最高的前 5 个智能体 */
  const hotBanner = useMemo(() => {
    if (quickTab !== 'all' || keyword || activeType || activeCategory !== 'recommend') return []
    return list
      .slice()
      .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0))
      .slice(0, 5)
  }, [list, quickTab, keyword, activeType, activeCategory])

  const load = useCallback(async () => {
    try {
      const res = await getAgentList()
      const arr = (res.list || []).map((a) => ({
        id: String(a.id),
        name: a.name,
        desc: a.desc,
        avatar: a.avatar,
        category: detectCategory(a.name || '', a.desc || ''),
        uses: a.uses,
        isVipExclusive: a.isVipExclusive,
      })) as AgentItem[]
      setList(arr)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
    // 同步本地收藏 / 最近使用
    setFavoriteIds(readFavorites())
    setRecentIds(readRecent())
  }, [])

  const goDetail = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/ai/agent-detail?id=${id}` })
  }, [])

  const onSendQuery = useCallback(() => {
    if (!keyword.trim()) return
    Taro.navigateTo({ url: `/pages/ai/chat?prompt=${encodeURIComponent(keyword)}` })
  }, [keyword])

  /** 跳转开发者中心创建智能体(原项目 dev_enter 入口) */
  const onCreateAgent = useCallback(() => {
    Taro.navigateTo({ url: '/pages/dev-enter/cover/index' })
  }, [])

  /** 切换收藏快捷 Tab */
  const onSwitchQuickTab = useCallback((key: QuickTabKey) => {
    setQuickTab(key)
    // 切到收藏/最近使用时,重置分类与模型类型筛选
    if (key !== 'all') {
      setActiveCategory('recommend')
      setActiveType('')
    }
  }, [])

  useDidShow(load)

  const categories: Array<{ key: CategoryKey; label: string }> = [
    { key: 'recommend', label: t('ai.agentList.categories.recommend') },
    { key: 'office', label: t('ai.agentList.categories.office') },
    { key: 'writing', label: t('ai.agentList.categories.writing') },
    { key: 'coding', label: t('ai.agentList.categories.coding') },
    { key: 'education', label: t('ai.agentList.categories.education') },
    { key: 'life', label: t('ai.agentList.categories.life') },
  ]

  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: 'hot', label: t('ai.agentList.sortHot') },
    { key: 'newest', label: t('ai.agentList.sortNewest') },
    { key: 'uses', label: t('ai.agentList.sortUses') },
  ]

  const quickTabs: Array<{ key: QuickTabKey; label: string }> = [
    { key: 'all', label: t('ai.agentList.tabAll') },
    { key: 'favorites', label: t('ai.agentList.tabFavorites') },
    { key: 'recent', label: t('ai.agentList.tabRecent') },
  ]

  const hasFilter = !!(keyword || activeType || activeCategory !== 'recommend' || quickTab !== 'all')

  return (
    <View className="page">
      <View className="bg-card pb-2 sticky top-0 z-10">
        <SearchBar
          value={keyword}
          placeholder={t('ai.agent.searchPlaceholder')}
          onInput={setKeyword}
          onSearch={onSendQuery}
          onClear={() => setKeyword('')}
        />
        {/* 快捷 Tab:全部 / 我的收藏 / 最近使用 */}
        <View className="flex items-center px-3 pt-2">
          {quickTabs.map((tb) => {
            const active = quickTab === tb.key
            const badge =
              tb.key === 'favorites'
                ? favoriteIds.length
                : tb.key === 'recent'
                  ? recentIds.length
                  : 0
            return (
              <View
                key={tb.key}
                className={`flex-1 py-2 text-center text-sm ${active ? 'text-[var(--color-primary)] font-semibold' : 'text-muted-foreground'}`}
                onClick={() => onSwitchQuickTab(tb.key)}
              >
                <Text>{tb.label}</Text>
                {badge > 0 && (
                  <Text className="ml-1 text-[20rpx] px-[6rpx] py-[1rpx] rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    {badge}
                  </Text>
                )}
              </View>
            )
          })}
        </View>
        {quickTab === 'all' && (
          <>
            <ModelTypeButtonGroup activeType={activeType} onSelect={(tp) => setActiveType(tp)} />
            <ScrollView scrollX enhanced showScrollbar={false} className="whitespace-nowrap px-3 pt-1">
              {categories.map((cat) => {
                const active = activeCategory === cat.key
                return (
                  <View
                    key={cat.key}
                    className={`inline-block px-4 py-2 mr-2 rounded-lg text-sm ${active ? 'bg-[var(--color-primary)] text-white' : 'bg-muted text-muted-foreground'}`}
                    onClick={() => setActiveCategory(cat.key)}
                  >
                    <Text>{cat.label}</Text>
                  </View>
                )
              })}
            </ScrollView>
            {/* 排序选项 */}
            <View className="flex items-center px-3 pt-2 pb-1">
              <Text className="text-[22rpx] text-muted-foreground mr-2">
                {t('ai.agentList.sortBy')}
              </Text>
              {sortOptions.map((opt) => {
                const active = sortKey === opt.key
                return (
                  <View
                    key={opt.key}
                    className={`mr-3 text-[22rpx] ${active ? 'text-[var(--color-primary)] font-medium' : 'text-muted-foreground'}`}
                    onClick={() => setSortKey(opt.key)}
                  >
                    <Text>{opt.label}</Text>
                  </View>
                )
              })}
            </View>
          </>
        )}
      </View>

      {/* 顶部热门推荐 Banner(仅全部 Tab + 无筛选时显示) */}
      {hotBanner.length > 0 && (
        <View className="px-3 pt-3">
          <View className="flex items-center justify-between mb-2">
            <Text className="text-[28rpx] text-foreground font-semibold">
              {t('ai.agentList.hotRecommend')}
            </Text>
            <Text className="text-[22rpx] text-muted-foreground">{t('ai.agentList.hot')}</Text>
          </View>
          <ScrollView scrollX enhanced showScrollbar={false} className="whitespace-nowrap">
            {hotBanner.map((agent, idx) => (
              <View
                key={agent.id}
                className="inline-flex flex-col items-center bg-card rounded-lg p-3 mr-3 align-top"
                style={{ width: '200rpx' }}
                onClick={() => goDetail(agent.id)}
              >
                <View className="relative">
                  <Image
                    className="rounded-lg bg-muted"
                    style={{ width: '120rpx', height: '120rpx' }}
                    src={agent.avatar || '/static/default-agent.png'}
                    mode="aspectFill"
                  />
                  <View className="absolute top-0 left-0 px-[6rpx] py-[1rpx] rounded bg-amber-500 text-white text-[20rpx]">
                    <Text>NO.{idx + 1}</Text>
                  </View>
                </View>
                <Text className="block text-[26rpx] text-foreground font-medium mt-2 truncate w-full text-center">
                  {agent.name}
                </Text>
                {agent.uses !== undefined && (
                  <Text className="block text-[22rpx] text-[var(--color-primary)] mt-1">
                    {t('ai.agentList.useCount', { n: agent.uses })}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <EmptyState text={t('common.loading')} />
      ) : filtered.length === 0 ? (
        <EmptyState
          text={
            quickTab === 'favorites'
              ? t('ai.agentList.emptyFavorites')
              : quickTab === 'recent'
                ? t('ai.agentList.emptyRecent')
                : hasFilter
                  ? t('ai.agentList.noResult')
                  : t('ai.agent.empty')
          }
        />
      ) : (
        <View className="px-3 py-2">
          <Text className="block text-xs text-muted-foreground mb-2">
            {t('ai.agent.count', { n: filtered.length })}
          </Text>
          {filtered.map((agent) => {
            const rating = estimateRating(agent.uses)
            return (
              <View
                key={agent.id}
                className="flex items-center bg-card rounded-lg p-3 mb-3"
                onClick={() => goDetail(agent.id)}
              >
                <Image
                  className="w-[100rpx] h-[100rpx] rounded-lg bg-muted"
                  src={agent.avatar || '/static/default-agent.png'}
                  mode="aspectFill"
                />
                <View className="flex-1 ml-3 min-w-0">
                  <View className="flex items-center">
                    <Text className="text-[30rpx] text-foreground font-semibold truncate">
                      {agent.name}
                    </Text>
                    {agent.isVipExclusive && (
                      <Text className="ml-2 text-[20rpx] px-[8rpx] py-[2rpx] rounded bg-amber-50 text-amber-600">
                        VIP
                      </Text>
                    )}
                  </View>
                  {agent.desc && (
                    <Text className="block text-[24rpx] text-muted-foreground mt-1 truncate">
                      {agent.desc}
                    </Text>
                  )}
                  <View className="flex items-center mt-1">
                    {agent.category && agent.category !== 'other' && (
                      <Text className="text-[20rpx] px-[8rpx] py-[2rpx] mr-2 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        {t(`ai.agentList.categories.${agent.category}`)}
                      </Text>
                    )}
                    {rating > 0 && (
                      <Text className="text-[22rpx] text-amber-500 mr-2">
                        ★ {rating.toFixed(1)}
                      </Text>
                    )}
                    {agent.uses !== undefined && (
                      <Text className="text-[22rpx] text-muted-foreground">
                        {t('ai.agentList.useCount', { n: agent.uses })}
                      </Text>
                    )}
                  </View>
                </View>
                <Text className="text-muted-foreground ml-2">›</Text>
              </View>
            )
          })}
        </View>
      )}

      <View className="h-20" />

      {/* 创建智能体悬浮按钮(对标原项目 dev_enter 入口) */}
      <View
        className="fixed right-4 bg-[var(--color-primary)] text-white rounded-lg px-3 py-2 shadow-lg"
        style={{ bottom: '140rpx' }}
        onClick={onCreateAgent}
      >
        <Text className="text-[24rpx]">+ {t('ai.agentList.createAgent')}</Text>
      </View>

      <View className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <BottomActionBar
          value={keyword}
          onInput={setKeyword}
          onSend={onSendQuery}
          onAttach={() => setShowConfig(true)}
          placeholder={t('ai.agent.inputPlaceholder')}
        />
      </View>

      <ModelConfigDialog
        visible={showConfig}
        config={config}
        onChange={setConfig}
        onClose={() => setShowConfig(false)}
      />
    </View>
  )
}
