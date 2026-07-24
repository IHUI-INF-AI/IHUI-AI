import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom, useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { logger } from '@/utils/logger'
import { getAgentList } from '@/api'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background pb-[60rpx] box-border">
      {/* Banner */}
      <View className="relative m-[24rpx] p-[32rpx] rounded-[16rpx] overflow-hidden bg-card">
        <View
          className="absolute top-0 left-0 right-0 bottom-0 z-0"
          style={{ background: 'linear-gradient(135deg, rgba(0, 242, 255, 0.18), rgba(99, 102, 241, 0.12))' }}
        />
        <View className="relative z-10">
          <Text className="block text-[38rpx] font-bold text-foreground leading-[1.4]">
            {tt('ai.special.bannerTitle', 'AI 专题聚合')}
          </Text>
          <Text className="block mt-[12rpx] text-[24rpx] text-muted-foreground leading-[1.5]">
            {tt(
              'ai.special.bannerDesc',
              '一站式聚合 AI 对话/绘图/视频/语音/智能体/模型广场,精选推荐能力即时使用',
            )}
          </Text>
        </View>
        <View
          className="relative z-10 inline-flex items-center gap-[8rpx] mt-[24rpx] py-[12rpx] px-[20rpx] bg-[rgba(0,242,255,0.12)] border-[2rpx] border-[rgba(0,242,255,0.35)] rounded-[10rpx]"
          onClick={goHistory}
        >
          <Text className="text-[26rpx]">🕘</Text>
          <Text className="text-[24rpx] text-primary">
            {tt('ai.special.history', '我的使用记录')}
          </Text>
        </View>
      </View>

      {/* 精选推荐 */}
      {featured.length > 0 ? (
        <View className="mx-[24rpx] mb-[24rpx]">
          <Text className="block text-[30rpx] font-semibold text-foreground mb-[16rpx]">
            {tt('ai.special.featured', '精选推荐')}
          </Text>
          <ScrollView scrollX className="whitespace-nowrap w-full" enhanced showScrollbar={false}>
            {featured.map((m) => (
              <View
                key={`f-${m.key}`}
                className="inline-flex flex-col items-center w-[200rpx] mr-[16rpx] py-[24rpx] px-[16rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.12)] rounded-[12rpx] align-top"
                onClick={() => onEnter(m)}
              >
                <View className="w-[80rpx] h-[80rpx] flex items-center justify-center bg-background rounded-[12rpx] text-[40rpx]">
                  <Text>{m.icon}</Text>
                </View>
                <Text className="block mt-[12rpx] text-[26rpx] text-foreground font-medium max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                  {m.name}
                </Text>
                <Text className="block mt-[4rpx] text-[22rpx] text-muted-foreground">
                  {tt('ai.special.useCount', '{n} 次使用', { n: m.uses })}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* 分类 Tab */}
      <ScrollView scrollX className="whitespace-nowrap px-[24rpx] mb-[16rpx]" enhanced showScrollbar={false}>
        {categories.map((c) => {
          const active = activeCategory === c.key
          return (
            <View
              key={c.key}
              className={`inline-flex items-center gap-[6rpx] h-[64rpx] px-[24rpx] mr-[12rpx] bg-card border-[2rpx] rounded-[10rpx] align-middle ${active ? 'bg-[rgba(0,242,255,0.12)] border-primary' : 'border-[rgba(0,242,255,0.1)]'}`}
              onClick={() => setActiveCategory(c.key)}
            >
              <Text className="text-[26rpx]">{c.icon}</Text>
              <Text
                className={`text-[26rpx] ${active ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
              >
                {c.label}
              </Text>
            </View>
          )
        })}
      </ScrollView>

      {/* 应用列表 */}
      {filtered.length > 0 ? (
        <View className="px-[24rpx] flex flex-col gap-[16rpx]">
          {filtered.map((m) => (
            <View
              key={m.key}
              className="flex p-[24rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[12rpx]"
            >
              <View className="w-[96rpx] h-[96rpx] flex items-center justify-center bg-background rounded-[12rpx] text-[44rpx] flex-shrink-0">
                <Text>{m.icon}</Text>
              </View>
              <View className="flex-1 min-w-0 ml-[20rpx] flex flex-col">
                <View className="flex items-center justify-between gap-[12rpx]">
                  <Text className="text-[30rpx] font-semibold text-foreground flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {m.name}
                  </Text>
                  <Text className="text-[22rpx] text-primary flex-shrink-0">
                    {tt('ai.special.useCount', '{n} 次使用', { n: m.uses })}
                  </Text>
                </View>
                <Text className="block mt-[8rpx] text-[24rpx] text-muted-foreground leading-[1.4]">
                  {m.desc}
                </Text>
                <View
                  className="self-start mt-[16rpx] py-[10rpx] px-[28rpx] bg-[rgba(0,242,255,0.14)] border-[2rpx] border-[rgba(0,242,255,0.4)] rounded-[8rpx]"
                  onClick={() => onEnter(m)}
                >
                  <Text className="text-[24rpx] text-primary font-semibold">
                    {tt('ai.special.useBtn', '立即使用')}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* 状态 */}
      {!loading && filtered.length === 0 && !error ? (
        <View className="flex flex-col items-center py-[80rpx] text-[26rpx] text-muted-foreground">
          <Text className="text-[56rpx] mb-[16rpx]">📭</Text>
          <Text className="text-[26rpx] text-muted-foreground">
            {tt('ai.special.empty', '暂无内容')}
          </Text>
        </View>
      ) : null}

      {error && !loading ? (
        <View
          className="flex flex-col items-center py-[80rpx] text-[26rpx] text-muted-foreground"
          onClick={() => void load(true)}
        >
          <Text className="text-[56rpx] mb-[16rpx]">⚠️</Text>
          <Text className="text-[26rpx] text-muted-foreground">
            {tt('ai.special.error', '加载失败')}
          </Text>
          <Text className="mt-[12rpx] text-[26rpx] text-primary">
            {tt('common.retry', '重试')}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View className="flex flex-col items-center py-[80rpx] text-[26rpx] text-muted-foreground">
          <Text>{tt('common.loading', '加载中…')}</Text>
        </View>
      ) : null}

      {!loading && !hasMore && filtered.length > 0 ? (
        <View className="flex flex-col items-center py-[80rpx] text-[26rpx] text-muted-foreground">
          <Text>{tt('common.noMore', '没有更多了')}</Text>
        </View>
      ) : null}
    </View>
  )
}
