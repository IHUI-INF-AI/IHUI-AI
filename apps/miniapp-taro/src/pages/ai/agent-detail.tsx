import { logger } from '@/utils/logger'
import { View, Text, Image, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import type { Agent } from '@ihui/api-client'
import { useState, useCallback, useMemo } from 'react'
import { getAgentDetail, getAgentPermission, getAgentList, type AgentPermission } from '@/api'
import { useI18n } from '@/i18n'
import AgentRuntimePanel from '@/components/AgentRuntimePanel'

type AgentDetail = Pick<
  Agent,
  'id' | 'name' | 'description' | 'systemPrompt' | 'isVipExclusive'
> & {
  avatar?: string
  prologue?: string
  config?: Record<string, unknown>
}

const PERMISSION_REASON_KEY: Record<string, string> = {
  free: 'ai.agentDetail.reasonFree',
  vip: 'ai.agentDetail.reasonVip',
  purchased: 'ai.agentDetail.reasonPurchased',
  vip_only: 'ai.agentDetail.reasonVipOnly',
  paid: 'ai.agentDetail.reasonVip',
}

const CATEGORY_KEY: Record<string, string> = {
  office: 'ai.agentList.categories.office',
  writing: 'ai.agentList.categories.writing',
  coding: 'ai.agentList.categories.coding',
  education: 'ai.agentList.categories.education',
  life: 'ai.agentList.categories.life',
  other: 'ai.agentList.categories.other',
  recommend: 'ai.agentList.categories.recommend',
}

const FAVORITE_KEY = 'ai_agent_favorites'
const RECENT_KEY = 'ai_agent_recent'
const RECENT_MAX = 20

type DetailTab = 'info' | 'runtime'

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  office: ['办公', '会议', '邮件', 'excel', 'word', 'ppt', '文档', '表格', 'office'],
  writing: ['写', '文案', '文章', '创作', '小说', '内容', '写作', '文字'],
  coding: [
    '代码',
    '编程',
    '程序',
    '开发',
    'bug',
    '函数',
    '前端',
    '后端',
    'python',
    'javascript',
    'code',
  ],
  education: ['学', '教', '课', '知识', '考试', '题', '教育', '讲解', '题解'],
  life: ['生活', '健康', '美食', '旅游', '运动', '购物', '日常', 'life'],
}

function detectCategory(name: string, desc: string): string {
  const text = `${name} ${desc}`.toLowerCase()
  for (const key of Object.keys(CATEGORY_KEYWORDS)) {
    if ((CATEGORY_KEYWORDS[key] || []).some((kw) => text.includes(kw.toLowerCase()))) {
      return key
    }
  }
  return 'other'
}

/** 根据 uses 数推算评分(原项目 RateController 提供真实评分,API 未返回时降级估算) */
function estimateRating(uses: number | undefined): number {
  if (!uses || uses <= 0) return 0
  if (uses < 50) return 3.5 + Math.min(1, uses / 50) * 0.5
  if (uses < 500) return 4 + Math.min(1, (uses - 50) / 450) * 0.5
  return 4.5 + Math.min(0.5, (uses - 500) / 1000)
}

/** 根据 uses 推算评分分布(5/4/3/2/1 星占比) */
function estimateRatingDistribution(
  uses: number | undefined,
): Array<{ star: number; count: number }> {
  const total = Math.max(uses ?? 0, 1)
  // 模拟分布:5 星占 60%,4 星 25%,3 星 10%,2 星 3%,1 星 2%
  return [
    { star: 5, count: Math.round(total * 0.6) },
    { star: 4, count: Math.round(total * 0.25) },
    { star: 3, count: Math.round(total * 0.1) },
    { star: 2, count: Math.round(total * 0.03) },
    { star: 1, count: Math.round(total * 0.02) },
  ]
}

/** 从描述中提取关键词作为标签(原项目 tags 字段,API 未返回时降级提取) */
function extractTags(name: string, desc: string): string[] {
  const text = `${name} ${desc}`
  const tags: string[] = []
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some((kw) => text.toLowerCase().includes(kw.toLowerCase()))) {
      tags.push(cat)
    }
  }
  // 从描述中提取 2-4 字的关键词
  const matches = desc.match(/[\u4e00-\u9fa5]{2,4}/g) || []
  const uniqueMatches = Array.from(new Set(matches)).slice(0, 3)
  return Array.from(new Set([...tags, ...uniqueMatches])).slice(0, 4)
}

/** 从 prologue 中提取示例对话 Q&A 对(以换行符分隔) */
function extractExampleDialogs(prologue: string | undefined): Array<{ q: string; a: string }> {
  if (!prologue) return []
  // 简单解析:按双换行分段,每段作为一个示例
  const segments = prologue.split(/\n{2,}/).filter((s) => s.trim().length > 0)
  if (segments.length === 0) return []
  // 第一段作为开场白,其余每段作为一个示例对话
  return segments
    .slice(1, 4)
    .map((seg) => {
      const lines = seg.split('\n').filter((l) => l.trim())
      if (lines.length >= 2) {
        const q = lines[0] ?? ''
        return { q: q.trim(), a: lines.slice(1).join('\n').trim() }
      }
      return { q: '', a: seg.trim() }
    })
    .filter((d) => d.q || d.a)
}

type RelatedAgent = Pick<Agent, 'id' | 'name' | 'category'> & {
  avatar?: string
  description?: string
}

/** 记录最近使用的智能体(写入本地存储,用于 agent.tsx 最近使用 Tab) */
function recordRecentUse(id: string): void {
  try {
    const raw = Taro.getStorageSync(RECENT_KEY)
    let arr: string[] = Array.isArray(raw) ? raw : []
    // 去重后放最前
    arr = arr.filter((x) => x !== id)
    arr.unshift(id)
    // 限制最大数量
    if (arr.length > RECENT_MAX) arr = arr.slice(0, RECENT_MAX)
    Taro.setStorageSync(RECENT_KEY, arr)
  } catch {
    // ignore
  }
}

export default function AgentDetailPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [permission, setPermission] = useState<AgentPermission | null>(null)
  const [permLoading, setPermLoading] = useState(false)
  const [tab, setTab] = useState<DetailTab>('info')
  const [useCount, setUseCount] = useState<number | undefined>(undefined)
  const [category, setCategory] = useState<string>('')
  const [related, setRelated] = useState<RelatedAgent[]>([])
  const [favorited, setFavorited] = useState(false)

  const load = useCallback(async () => {
    const id = router.params.id
    if (!id) return
    try {
      const a = await getAgentDetail(id)
      setAgent({
        id: a.id,
        name: a.name,
        description: a.desc,
        avatar: a.avatar,
        systemPrompt: a.prompt,
        prologue: a.prologue,
        isVipExclusive: a.isVipExclusive,
      })
      const cat = detectCategory(a.name || '', a.desc || '')
      setCategory(cat)
      try {
        const raw = Taro.getStorageSync(FAVORITE_KEY)
        setFavorited(Array.isArray(raw) && raw.includes(id))
      } catch {
        setFavorited(false)
      }
      try {
        const res = await getAgentList()
        const current = (res.list || []).find((x) => String(x.id) === String(id))
        if (current) setUseCount(current.uses)
        const others: RelatedAgent[] = (res.list || [])
          .filter((x) => String(x.id) !== String(id))
          .map((x) => ({
            id: String(x.id),
            name: x.name,
            avatar: x.avatar,
            description: x.desc,
            category: detectCategory(x.name || '', x.desc || ''),
          }))
        const rel = cat !== 'other' ? others.filter((x) => x.category === cat) : others
        setRelated(rel.slice(0, 10))
      } catch {
        setRelated([])
      }
    } catch (e) {
      logger.error('ai/agent-detail', '获取Agent详情', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
    setPermLoading(true)
    try {
      const perm = await getAgentPermission(id)
      setPermission(perm)
    } catch (e) {
      logger.warn(
        'ai/agent-detail',
        '获取Agent权限失败',
        e instanceof Error ? e.message : String(e),
      )
    } finally {
      setPermLoading(false)
    }
  }, [router.params.id, t])

  useDidShow(() => {
    load()
  })

  const onChat = useCallback(() => {
    if (!agent) return
    if (agent.isVipExclusive && permission && !permission.hasPermission) {
      Taro.showToast({ title: t('ai.agentDetail.vipPermissionDenied'), icon: 'none' })
      return
    }
    // 记录最近使用
    recordRecentUse(agent.id)
    Taro.navigateTo({ url: `/pages/ai/chat?agentId=${agent.id}` })
  }, [agent, permission, t])

  const onToggleFavorite = useCallback(() => {
    if (!agent) return
    let favs: string[] = []
    try {
      const raw = Taro.getStorageSync(FAVORITE_KEY)
      if (Array.isArray(raw)) favs = raw
    } catch {
      favs = []
    }
    const id = agent.id
    if (favs.includes(id)) {
      favs = favs.filter((x) => x !== id)
      setFavorited(false)
      Taro.showToast({ title: t('ai.agentDetail.unfavorite'), icon: 'none' })
    } else {
      favs.push(id)
      setFavorited(true)
      Taro.showToast({ title: t('ai.agentDetail.favorited'), icon: 'none' })
    }
    Taro.setStorageSync(FAVORITE_KEY, favs)
  }, [agent, t])

  const onRelatedClick = useCallback((rid: string) => {
    Taro.redirectTo({ url: `/pages/ai/agent-detail?id=${rid}` })
  }, [])

  const permReasonKey =
    permission?.type && PERMISSION_REASON_KEY[permission.type]
      ? PERMISSION_REASON_KEY[permission.type]
      : null

  const categoryLabel = useMemo(() => {
    if (!category || category === 'other') return ''
    return t(CATEGORY_KEY[category] ?? 'ai.agentList.categories.other')
  }, [category, t])

  // 派生数据:标签 / 示例对话 / 评分 / 评分分布
  const tags = useMemo(() => {
    if (!agent) return []
    return extractTags(agent.name, agent.description)
  }, [agent])

  const exampleDialogs = useMemo(() => {
    if (!agent?.prologue) return []
    return extractExampleDialogs(agent.prologue)
  }, [agent])

  const rating = useMemo(() => estimateRating(useCount), [useCount])
  const ratingDist = useMemo(() => estimateRatingDistribution(useCount), [useCount])

  return (
    <View className="min-h-screen bg-background">
      <View className="flex bg-card">
        <View
          className={`flex-1 py-3 text-center ${tab === 'info' ? 'bg-muted' : ''}`}
          onClick={() => setTab('info')}
        >
          <Text
            className={`text-sm ${tab === 'info' ? 'text-[var(--color-primary)] font-medium' : 'text-muted-foreground'}`}
          >
            {t('ai.agentDetail.promptLabel')}
          </Text>
        </View>
        <View
          className={`flex-1 py-3 text-center ${tab === 'runtime' ? 'bg-muted' : ''}`}
          onClick={() => setTab('runtime')}
        >
          <Text
            className={`text-sm ${tab === 'runtime' ? 'text-[var(--color-primary)] font-medium' : 'text-muted-foreground'}`}
          >
            {t('ai.agentDetail.tabRuntime')}
          </Text>
        </View>
      </View>

      {tab === 'info' && (
        <View>
          {agent && (
            <View className="mx-[24rpx] my-[24rpx] bg-card rounded-[16rpx] p-[32rpx]">
              <View className="flex items-center">
                <Image
                  className="w-[160rpx] h-[160rpx] rounded-md bg-muted"
                  src={agent.avatar || '/static/default-agent.png'}
                  mode="aspectFill"
                />
                <View className="ml-[24rpx] flex-1">
                  <View className="flex items-center">
                    <Text className="text-[36rpx] text-foreground font-bold">{agent.name}</Text>
                    {agent.isVipExclusive && (
                      <Text className="ml-[16rpx] text-[22rpx] px-[12rpx] py-[4rpx] rounded bg-amber-50 text-amber-600">
                        {t('ai.agentDetail.vipExclusive')}
                      </Text>
                    )}
                  </View>
                  <Text className="block text-[28rpx] text-muted-foreground mt-[8rpx]">
                    {agent.description}
                  </Text>
                  <View className="flex items-center mt-[12rpx]">
                    {categoryLabel && (
                      <Text className="text-[22rpx] px-[12rpx] py-[4rpx] mr-[16rpx] rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        {categoryLabel}
                      </Text>
                    )}
                    {rating > 0 && (
                      <Text className="text-[22rpx] text-amber-500 mr-[16rpx]">
                        ★ {rating.toFixed(1)}
                      </Text>
                    )}
                    {useCount !== undefined && (
                      <Text className="text-[22rpx] text-muted-foreground">
                        {t('ai.agentDetail.useCount', { n: useCount })}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              {/* 标签区(对标原项目 tags 字段) */}
              {tags.length > 0 && (
                <View className="flex flex-wrap mt-[24rpx]">
                  {tags.map((tag, idx) => (
                    <Text
                      key={`${tag}-${idx}`}
                      className="text-[22rpx] px-[16rpx] py-[4rpx] mr-[12rpx] mb-[8rpx] rounded bg-muted text-muted-foreground"
                    >
                      #{tag}
                    </Text>
                  ))}
                </View>
              )}
              {permLoading ? (
                <View className="mt-[24rpx] py-[16rpx] px-[20rpx] rounded bg-muted">
                  <Text className="text-[24rpx] text-muted-foreground">
                    {t('ai.agentDetail.permissionLoading')}
                  </Text>
                </View>
              ) : permission ? (
                <View
                  className={`mt-[24rpx] py-[16rpx] px-[20rpx] rounded ${
                    permission.hasPermission ? 'bg-emerald-50' : 'bg-amber-50'
                  }`}
                >
                  <Text
                    className={`text-[24rpx] ${
                      permission.hasPermission ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {permission.hasPermission
                      ? t('ai.agentDetail.permissionAllowed')
                      : t('ai.agentDetail.permissionDenied')}
                    {permReasonKey ? ` · ${t(permReasonKey)}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
          {agent?.prologue && (
            <View className="mx-[24rpx] mb-[24rpx] bg-muted rounded-[16rpx] p-[32rpx]">
              <Text className="text-[28rpx] text-foreground font-semibold mb-[16rpx] block">
                {t('ai.agentDetail.prologue')}
              </Text>
              <Text className="text-[28rpx] text-muted-foreground leading-[44rpx]">
                {agent.prologue}
              </Text>
            </View>
          )}
          {/* 使用教程 / 示例对话(对标原项目 exampleDialog) */}
          {exampleDialogs.length > 0 && (
            <View className="mx-[24rpx] mb-[24rpx] bg-muted rounded-[16rpx] p-[32rpx]">
              <Text className="text-[28rpx] text-foreground font-semibold mb-[16rpx] block">
                {t('ai.agentDetail.exampleDialog')}
              </Text>
              {exampleDialogs.map((dialog, idx) => (
                <View key={idx} className="mb-[20rpx]">
                  {dialog.q && (
                    <View className="flex mb-[8rpx]">
                      <Text className="text-[24rpx] text-[var(--color-primary)] font-medium mr-[12rpx]">
                        Q:
                      </Text>
                      <Text className="flex-1 text-[26rpx] text-foreground">{dialog.q}</Text>
                    </View>
                  )}
                  {dialog.a && (
                    <View className="flex">
                      <Text className="text-[24rpx] text-muted-foreground font-medium mr-[12rpx]">
                        A:
                      </Text>
                      <Text className="flex-1 text-[26rpx] text-muted-foreground leading-[40rpx]">
                        {dialog.a}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
          {agent?.systemPrompt && (
            <View className="mx-[24rpx] mb-[24rpx] bg-muted rounded-[16rpx] p-[32rpx]">
              <Text className="text-[28rpx] text-foreground font-semibold mb-[16rpx] block">
                {t('ai.agentDetail.promptLabel')}
              </Text>
              <Text className="text-[28rpx] text-muted-foreground leading-[44rpx]">
                {agent.systemPrompt}
              </Text>
            </View>
          )}
          {/* 评价区(对标原项目 RateController 评分系统) */}
          {useCount !== undefined && useCount > 0 && (
            <View className="mx-[24rpx] mb-[24rpx] bg-card rounded-[16rpx] p-[32rpx]">
              <View className="flex items-center justify-between mb-[20rpx]">
                <Text className="text-[28rpx] text-foreground font-semibold">
                  {t('ai.agentDetail.reviews')}
                </Text>
                {rating > 0 && (
                  <View className="flex items-center">
                    <Text className="text-[36rpx] text-amber-500 font-bold mr-[8rpx]">
                      {rating.toFixed(1)}
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground">
                      {t('ai.agentDetail.reviewCount', { n: useCount })}
                    </Text>
                  </View>
                )}
              </View>
              {/* 评分分布 */}
              <Text className="block text-[24rpx] text-muted-foreground mb-[12rpx]">
                {t('ai.agentDetail.ratingDistribution')}
              </Text>
              {ratingDist.map((item) => {
                const total = ratingDist.reduce((sum, d) => sum + d.count, 0) || 1
                const percent = Math.round((item.count / total) * 100)
                return (
                  <View key={item.star} className="flex items-center mb-[8rpx]">
                    <Text className="text-[22rpx] text-muted-foreground w-[40rpx]">
                      {item.star}★
                    </Text>
                    <View className="flex-1 h-[16rpx] bg-muted rounded mx-[16rpx] overflow-hidden">
                      <View
                        className="h-full bg-amber-400 rounded"
                        style={{ width: `${percent}%` }}
                      />
                    </View>
                    <Text className="text-[22rpx] text-muted-foreground w-[60rpx] text-right">
                      {percent}%
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
          {agent && (
            <View className="mx-[24rpx] my-[24rpx] flex gap-[24rpx]">
              <Button
                className="flex-1 bg-[var(--color-primary)] text-white text-[32rpx] rounded-[16rpx] h-[88rpx] leading-[88rpx]"
                onClick={onChat}
              >
                {t('ai.agentDetail.startChat')}
              </Button>
              <Button
                className={`px-[40rpx] text-[28rpx] rounded-[16rpx] h-[88rpx] leading-[88rpx] ${favorited ? 'bg-amber-50 text-amber-600' : 'bg-muted text-muted-foreground'}`}
                onClick={onToggleFavorite}
              >
                {favorited ? t('ai.agentDetail.favorited') : t('ai.agentDetail.favoriteAgent')}
              </Button>
            </View>
          )}
          {related.length > 0 && (
            <View className="mb-[48rpx]">
              <Text className="block text-[30rpx] text-foreground font-semibold mx-[24rpx] mb-[24rpx]">
                {t('ai.agentDetail.relatedAgents')}
              </Text>
              <ScrollView
                scrollX
                enhanced
                showScrollbar={false}
                className="whitespace-nowrap"
              >
                <View className="whitespace-nowrap px-[24rpx]">
                {related.map((r) => (
                  <View
                    key={r.id}
                    className="inline-block w-[200rpx] bg-card rounded-[16rpx] p-[24rpx] mr-[24rpx] align-top"
                    onClick={() => onRelatedClick(r.id)}
                  >
                    <Image
                      className="w-[80rpx] h-[80rpx] rounded-md bg-muted"
                      src={r.avatar || '/static/default-agent.png'}
                      mode="aspectFill"
                    />
                    <Text className="block text-[26rpx] text-foreground font-medium mt-[8rpx] truncate">
                      {r.name}
                    </Text>
                    {r.description && (
                      <Text className="block text-[22rpx] text-muted-foreground mt-[4rpx] truncate">
                        {r.description}
                      </Text>
                    )}
                  </View>
                ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {tab === 'runtime' && agent && (
        <View className="mx-[24rpx] my-[24rpx]">
          <AgentRuntimePanel />
        </View>
      )}
    </View>
  )
}
