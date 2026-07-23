import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom, useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { logger } from '@/utils/logger'
import { getAgentList } from '@/api'
import { useI18n } from '@/i18n'
import './special.css'

type CategoryKey = 'chat' | 'image' | 'video' | 'voice' | 'agent' | 'plaza'

interface ModelEntry {
  key: string
  name: string
  desc: string
  icon: string
  category: CategoryKey
  uses: number
  route?: string
  featured?: boolean
}

/** 本地默认模型入口(对标原项目 pages/table/tools/index.vue 的特殊模型聚合) */
const DEFAULT_MODELS: ModelEntry[] = [
  {
    key: 'gemini-flash',
    name: 'Gemini-2.5-flash',
    desc: 'Google Gemini 2.5 Flash 文本模型,快速响应、多模态输入',
    icon: '⚡',
    category: 'chat',
    uses: 2300,
    route: '/pages/ai/chat?model=gemini-2.5-flash',
    featured: true,
  },
  {
    key: 'httpmodel',
    name: 'HttpModel',
    desc: '通用 HTTP 模型代理,支持自定义模型接入',
    icon: '🔌',
    category: 'chat',
    uses: 540,
    route: '/pages/ai/chat',
  },
  {
    key: 'nanobanana',
    name: 'NanoBanana',
    desc: 'Google 图片编辑模型,支持自然语言指令编辑图片',
    icon: '🍌',
    category: 'image',
    uses: 1280,
    route: '/pages/ai/image',
    featured: true,
  },
  {
    key: 'veo3',
    name: 'Veo3',
    desc: 'Google 视频生成模型,支持高质量文生视频',
    icon: '🎬',
    category: 'video',
    uses: 860,
    route: '/pages/ai/video',
    featured: true,
  },
  {
    key: 'tts',
    name: 'AI 语音',
    desc: '文本转语音,支持多语种自然发音',
    icon: '🎙️',
    category: 'voice',
    uses: 420,
    route: '/pages/ai/voice',
  },
  {
    key: 'agent',
    name: '智能体广场',
    desc: '多场景智能体:办公/写作/编程/教育/生活',
    icon: '🤖',
    category: 'agent',
    uses: 3100,
    route: '/pages/ai/agent',
    featured: true,
  },
  {
    key: 'plaza',
    name: '模型广场',
    desc: '探索更多 AI 模型与厂商能力',
    icon: '🛒',
    category: 'plaza',
    uses: 780,
    route: '/pages/plaza/index',
  },
]

export default function SpecialModelsPage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string, params?: Record<string, string | number>) => {
    const v = params ? t(k, params) : t(k)
    if (v !== k) return v
    if (!params) return fb
    return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
  }

  const [models, setModels] = useState<ModelEntry[]>(DEFAULT_MODELS)
  const [activeCategory, setActiveCategory] = useState<CategoryKey | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const loadingRef = useRef(false)
  const hasMoreRef = useRef(false)

  const categories: Array<{ key: CategoryKey | 'all'; label: string; icon: string }> = [
    { key: 'all', label: tt('ai.special.cat.all', '全部'), icon: '🌟' },
    { key: 'chat', label: tt('ai.special.cat.chat', 'AI 对话'), icon: '💬' },
    { key: 'image', label: tt('ai.special.cat.image', 'AI 绘图'), icon: '🎨' },
    { key: 'video', label: tt('ai.special.cat.video', 'AI 视频'), icon: '🎬' },
    { key: 'voice', label: tt('ai.special.cat.voice', 'AI 语音'), icon: '🎙️' },
    { key: 'agent', label: tt('ai.special.cat.agent', '智能体'), icon: '🤖' },
    { key: 'plaza', label: tt('ai.special.cat.plaza', '模型广场'), icon: '🛒' },
  ]

  const load = useCallback(async (reset = false) => {
    if (loadingRef.current) return
    if (!reset && !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    if (reset) {
      setError(false)
      setModels(DEFAULT_MODELS)
      hasMoreRef.current = false
      setHasMore(false)
    }
    try {
      const res = await getAgentList()
      const agentModels: ModelEntry[] = (res.list || []).map((a) => ({
        key: `agent-${a.id}`,
        name: a.name,
        desc: a.desc || '',
        icon: '🤖',
        category: 'agent',
        uses: Number(a.uses ?? 0),
        route: `/pages/ai/agent-detail?id=${a.id}`,
      }))
      setModels((prev) => {
        const existKeys = new Set(prev.map((m) => m.key))
        const merged = [...prev, ...agentModels.filter((m) => !existKeys.has(m.key))]
        return merged
      })
      hasMoreRef.current = false
      setHasMore(false)
    } catch (e) {
      logger.error('ai/special', '加载智能体列表', e)
      setError(true)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    void load(true)
  })

  usePullDownRefresh(() => {
    void load(true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (hasMoreRef.current) void load(false)
  })

  const filtered =
    activeCategory === 'all' ? models : models.filter((m) => m.category === activeCategory)
  const featured = models.filter((m) => m.featured)

  const onEnter = useCallback(
    (m: ModelEntry) => {
      if (m.route) {
        Taro.navigateTo({ url: m.route }).catch((e) => {
          logger.error('ai/special', `跳转 ${m.key}`, e)
          Taro.showToast({ title: tt('ai.special.pageError', '操作失败'), icon: 'none' })
        })
      } else {
        Taro.showToast({ title: tt('ai.special.pageError', '操作失败'), icon: 'none' })
      }
    },
    [tt],
  )

  const goHistory = useCallback(() => {
    Taro.navigateTo({ url: '/pages/ai/history' }).catch(() => {
      Taro.showToast({ title: tt('ai.special.historySoon', '历史记录即将开放'), icon: 'none' })
    })
  }, [tt])

  return (
    <View className="special-page">
      {/* Banner */}
      <View className="special-banner">
        <View className="special-banner-bg" />
        <View className="special-banner-content">
          <Text className="special-banner-title">
            {tt('ai.special.bannerTitle', 'AI 专题聚合')}
          </Text>
          <Text className="special-banner-desc">
            {tt(
              'ai.special.bannerDesc',
              '一站式聚合 AI 对话/绘图/视频/语音/智能体/模型广场,精选推荐能力即时使用',
            )}
          </Text>
        </View>
        <View className="special-banner-history" onClick={goHistory}>
          <Text className="special-banner-history-icon">🕘</Text>
          <Text className="special-banner-history-text">
            {tt('ai.special.history', '我的使用记录')}
          </Text>
        </View>
      </View>

      {/* 精选推荐 */}
      {featured.length > 0 ? (
        <View className="special-featured">
          <Text className="special-section-title">
            {tt('ai.special.featured', '精选推荐')}
          </Text>
          <ScrollView scrollX className="special-featured-scroll" enhanced showScrollbar={false}>
            {featured.map((m) => (
              <View
                key={`f-${m.key}`}
                className="special-featured-card"
                onClick={() => onEnter(m)}
              >
                <View className="special-featured-icon">
                  <Text>{m.icon}</Text>
                </View>
                <Text className="special-featured-name">{m.name}</Text>
                <Text className="special-featured-uses">
                  {tt('ai.special.useCount', '{n} 次使用', { n: m.uses })}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* 分类 Tab */}
      <ScrollView scrollX className="special-tabs" enhanced showScrollbar={false}>
        {categories.map((c) => (
          <View
            key={c.key}
            className={`special-tab${activeCategory === c.key ? ' special-tab-active' : ''}`}
            onClick={() => setActiveCategory(c.key)}
          >
            <Text className="special-tab-icon">{c.icon}</Text>
            <Text className="special-tab-label">{c.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 应用列表 */}
      {filtered.length > 0 ? (
        <View className="special-list">
          {filtered.map((m) => (
            <View key={m.key} className="special-card">
              <View className="special-card-icon">
                <Text>{m.icon}</Text>
              </View>
              <View className="special-card-body">
                <View className="special-card-header">
                  <Text className="special-card-name">{m.name}</Text>
                  <Text className="special-card-uses">
                    {tt('ai.special.useCount', '{n} 次使用', { n: m.uses })}
                  </Text>
                </View>
                <Text className="special-card-desc">{m.desc}</Text>
                <View className="special-card-btn" onClick={() => onEnter(m)}>
                  <Text>{tt('ai.special.useBtn', '立即使用')}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* 状态 */}
      {!loading && filtered.length === 0 && !error ? (
        <View className="special-empty">
          <Text className="special-empty-icon">📭</Text>
          <Text className="special-empty-text">
            {tt('ai.special.empty', '暂无内容')}
          </Text>
        </View>
      ) : null}

      {error && !loading ? (
        <View className="special-empty" onClick={() => void load(true)}>
          <Text className="special-empty-icon">⚠️</Text>
          <Text className="special-empty-text">{tt('ai.special.error', '加载失败')}</Text>
          <Text className="special-retry">{tt('common.retry', '重试')}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="special-loading">
          <Text>{tt('common.loading', '加载中…')}</Text>
        </View>
      ) : null}

      {!loading && !hasMore && filtered.length > 0 ? (
        <View className="special-no-more">
          <Text>{tt('common.noMore', '没有更多了')}</Text>
        </View>
      ) : null}
    </View>
  )
}
