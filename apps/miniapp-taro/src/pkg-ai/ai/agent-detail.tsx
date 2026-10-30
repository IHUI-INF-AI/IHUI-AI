// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 镜像 packages/app/src/features/agent-detail/AgentDetailScreen.tsx

// 对齐目标(RN 共享屏): packages/app/src/features/agent-detail/AgentDetailScreen.tsx
import { useTt, useI18n, type TtFn, t } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import type { Agent } from '@ihui/api-client'
import { useState, useCallback, useMemo } from 'react'
import { get, getAgentDetail, getAgentPermission, getAgentList, type AgentPermission } from '@/api'
import AgentRuntimePanel from '@/components/AgentRuntimePanel'
import { ErrorState } from '@/components/ScreenStates.taro'
import AgentDetailMeta from './agent-detail-meta'

/**
 * 本地视图模型(非 api-client Agent 直投):
 * - id 由 @/api 的 getAgentDetail 把后端主键 agentId 映射而来(对齐 mobile-rn AgentShopItem.id)
 * - systemPrompt 取后端 agentPrompt(@/api 映射为 prompt);契约 Agent 从未含此字段
 */
type AgentDetail = Pick<Agent, 'name' | 'description' | 'isVipExclusive'> & {
  id: string
  systemPrompt: string
  avatar?: string
  prologue?: string
  config?: Record<string, unknown>
  /** 评分(对齐共享屏 AgentDetailScreen.rating):后端返回 rating 时渲染,无则不显示,绝不用 uses 反推假分 */
  rating?: number
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

const CATEGORY_KEYWORDS = (tt: TtFn): Record<string, string[]> => ({
  office: [
    tt('ai.agentList.categories.office', '办公'),
    tt('aiAgent.d1', '会议'),
    tt('aiAgent.d2', '邮件'),
    'excel',
    'word',
    'ppt',
    tt('messageInput.document', '文档'),
    tt('aiAgent.d3', '表格'),
    'office',
  ],
  writing: [
    tt('aiAgent.d4', '写'),
    tt('aigcPublish.typeText', '文案'),
    tt('bookmark.type.article', '文章'),
    tt('aiAgent.d5', '创作'),
    tt('aiAgent.d6', '小说'),
    tt('feedback.content', '内容'),
    tt('ai.agentList.categories.writing', '写作'),
    tt('aiAgent.d7', '文字'),
  ],
  coding: [
    t('aiAgent.r1'),
    t('ai.agentList.categories.coding'),
    t('aiAgent.r2'),
    t('pagesindexindex.d5'),
    'bug',
    t('aiAgent.r3'),
    t('aiAgent.r4'),
    t('aiAgent.r5'),
    'python',
    'javascript',
    'code',
  ],
  education: [
    tt('aiAgent.d8', '学'),
    tt('aiAgent.d9', '教'),
    tt('aiAgent.d10', '课'),
    tt('aiAgent.d11', '知识'),
    tt('aiAgent.d12', '考试'),
    tt('aiAgent.d13', '题'),
    tt('ai.agentList.categories.education', '教育'),
    tt('aiAgent.d14', '讲解'),
    tt('aiAgent.d15', '题解'),
  ],
  life: [
    tt('ai.agentList.categories.life', '生活'),
    tt('aiAgent.d16', '健康'),
    tt('aiAgent.d17', '美食'),
    tt('aiAgent.d18', '旅游'),
    tt('aiAgent.d19', '运动'),
    tt('aiAgent.d20', '购物'),
    tt('aiAgent.d21', '日常'),
    'life',
  ],
})

function detectCategory(name: string, desc: string, keywords: Record<string, string[]>): string {
  const text = `${name} ${desc}`.toLowerCase()
  for (const [key, kws] of Object.entries(keywords)) {
    if ((kws || []).some((kw) => text.includes(kw.toLowerCase()))) {
      return key
    }
  }
  return 'other'
}

/** 从描述中提取关键词作为标签(原项目 tags 字段,API 未返回时降级提取) */
function extractTags(name: string, desc: string, keywords: Record<string, string[]>): string[] {
  const text = `${name} ${desc}`
  const tags: string[] = []
  for (const [cat, kws] of Object.entries(keywords)) {
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

/** 本地视图模型:category 是 detectCategory 的本地判定结果,契约侧对应字段是 categoryId */
type RelatedAgent = Pick<Agent, 'name'> & {
  id: string
  category: string
  avatar?: string
  description?: string
}

/** GET /agents/:id 原始行里的定价/归属字段(api 层 getAgentDetail 的映射不带出这三项) */
interface AgentRawPricing {
  userName?: string | null
  /** agents.price 是整数「元」列(web 端 `¥${agent.price}`、共享屏 `¥${item.price.toFixed(2)}` 同口径) */
  price?: number | null
  isFree?: boolean | null
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
  const tt = useTt()
  const router = useRouter()
  const { t } = useI18n()
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [permission, setPermission] = useState<AgentPermission | null>(null)
  const [permLoading, setPermLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [pricing, setPricing] = useState<{
    creator: string
    price: number | null
    isFree: boolean | null
  } | null>(null)
  const [tab, setTab] = useState<DetailTab>('info')
  const [useCount, setUseCount] = useState<number | undefined>(undefined)
  const [category, setCategory] = useState<string>('')
  const [related, setRelated] = useState<RelatedAgent[]>([])
  const [favorited, setFavorited] = useState(false)

  const load = useCallback(async () => {
    const id = router.params.id
    if (!id) return
    setLoadFailed(false)
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
      // 创建者/定价:同一 GET /agents/:id 的原始行里有(userName/price/isFree),api 层映射未带出 ⇒ 单独取一次
      const rawPricing = await get<AgentRawPricing>(`/agents/${encodeURIComponent(id)}`).catch(
        () => null,
      )
      // 字段取不到一律留 null:把「没这个数」渲染成 ¥0.00 / 收费 是假断言,只报「—」
      setPricing(
        rawPricing
          ? {
              creator: typeof rawPricing.userName === 'string' ? rawPricing.userName : '',
              price: typeof rawPricing.price === 'number' ? rawPricing.price : null,
              isFree: typeof rawPricing.isFree === 'boolean' ? rawPricing.isFree : null,
            }
          : null,
      )
      const cat = detectCategory(a.name || '', a.desc || '', CATEGORY_KEYWORDS(tt))
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
            category: detectCategory(x.name || '', x.desc || '', CATEGORY_KEYWORDS(tt)),
          }))
        const rel = cat !== 'other' ? others.filter((x) => x.category === cat) : others
        setRelated(rel.slice(0, 10))
      } catch {
        setRelated([])
      }
    } catch (e) {
      logger.error('ai/agent-detail', tt('aiAgentdetail.q1', '获取Agent详情'), e)
      // 详情取不到 ⇒ 由 ErrorState 常驻呈现(agentDetail.loadFailed),不只留一次性 toast 后白屏
      setLoadFailed(true)
    }
    setPermLoading(true)
    try {
      const perm = await getAgentPermission(id)
      setPermission(perm)
    } catch (e) {
      logger.warn(
        'ai/agent-detail',
        tt('aiAgentdetail.r6', '获取Agent权限失败'),
        e instanceof Error ? e.message : String(e),
      )
    } finally {
      setPermLoading(false)
    }
  }, [router.params.id, tt])

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
    Taro.navigateTo({ url: `/pkg-ai/ai/chat?agentId=${agent.id}` })
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
    Taro.redirectTo({ url: `/pkg-ai/ai/agent-detail?id=${rid}` })
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
    return extractTags(agent.name, agent.description, CATEGORY_KEYWORDS(tt))
  }, [agent, tt])

  const exampleDialogs = useMemo(() => {
    if (!agent?.prologue) return []
    return extractExampleDialogs(agent.prologue)
  }, [agent])

  // 评分(对齐共享屏 AgentDetailScreen.rating):后端若返回 rating 则渲染星级+分;
  // agents 表无评分列(现读 packages/database/src/schema/agents-extended.ts),
  // 后端唯一评分出口是 /agent-reviews(只看"我自己名下智能体"收到的评价,
  // apps/api/src/routes/agent-reviews.ts 的 where eq(agents.userId, userId))⇒ 访客取不到
  // 别人智能体的评分,故 rating 默认 undefined、本端不渲染,也绝不用 uses 反推假分上屏(逐键表见交付)。

  const onEdit = useCallback(() => {
    if (!agent) return
    // 编辑入口对齐共享屏头右侧编辑键;端内编辑页 = pkg-user/agent-edit(壳承载 AgentEditScreen)
    Taro.navigateTo({ url: `/pkg-user/agent-edit/index?id=${encodeURIComponent(agent.id)}` })
  }, [agent])

  // 详情取不到 ⇒ 整屏错误态(对齐共享屏 ErrorState:重试重发详情请求)
  if (loadFailed && !agent) {
    return (
      <View className="min-h-screen bg-background px-[20rpx] pt-[24rpx]">
        <ErrorState
          message={t('agentDetail.loadFailed')}
          onRetry={() => {
            void load()
          }}
          retryLabel={t('common.retry')}
        />
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="flex bg-card">
        <View
          className={`flex-1 py-3 text-center ${tab === 'info' ? 'bg-muted' : ''}`}
          onClick={() => setTab('info')}
          hoverClass="opacity-60"
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
          hoverClass="opacity-60"
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
          {/* 已有旧数据时重取失败:常驻提示(不静默把旧内容当真) */}
          {agent && loadFailed && (
            <View className="mx-[20rpx] mt-[24rpx] px-[20rpx] py-[16rpx] rounded-sm bg-[var(--color-warning-amber-light)]">
              <Text className="text-[length:24rpx] text-[var(--color-warning-amber-text)]">
                {t('agentDetail.loadFailed')}
              </Text>
            </View>
          )}
          {agent && (
            <View className="mx-[20rpx] my-[24rpx] bg-card rounded-lg border border-border p-[28rpx]">
              <View className="flex items-center">
                <Image
                  className="w-[160rpx] h-[160rpx] rounded-xl bg-muted"
                  src={agent.avatar || '/static/default-agent.png'}
                  mode="aspectFill"
                />
                <View className="ml-[24rpx] flex-1">
                  <View className="flex items-center justify-between">
                    <View className="flex items-center flex-1">
                      <Text className="text-[length:48rpx] text-foreground font-bold">
                        {agent.name}
                      </Text>
                      {agent.isVipExclusive && (
                        <Text className="ml-[16rpx] text-[length:20rpx] px-[12rpx] py-[8rpx] rounded-sm bg-[var(--color-warning-amber)] text-[var(--color-surface-light)] font-semibold">
                          {t('ai.agentDetail.vipExclusive')}
                        </Text>
                      )}
                    </View>
                    {/* 编辑入口 — 对齐共享屏头右侧编辑键(后端 PUT 归属校验兜,前端不另判) */}
                    <Text
                      className="flex-shrink-0 ml-[16rpx] px-[20rpx] py-[8rpx] text-[length:24rpx] text-foreground border border-border rounded-sm"
                      onClick={onEdit}
                    >
                      {t('agentEdit.entry')}
                    </Text>
                  </View>
                  <Text className="block text-[length:22rpx] text-muted-foreground mt-[12rpx]">
                    {t('agentDetail.description')}
                  </Text>
                  <Text className="block text-[length:32rpx] text-foreground mt-[4rpx]">
                    {agent.description || '—'}
                  </Text>
                  <View className="flex items-center mt-[12rpx]">
                    {categoryLabel && (
                      <Text className="text-[length:28rpx] text-[var(--color-primary)] mr-[16rpx]">
                        {categoryLabel}
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
                      className="text-[length:22rpx] px-[16rpx] py-[4rpx] mr-[12rpx] mb-[8rpx] rounded-sm bg-muted text-muted-foreground"
                    >
                      #{tag}
                    </Text>
                  ))}
                </View>
              )}
              {permLoading ? (
                <View className="mt-[24rpx] py-[16rpx] px-[20rpx] rounded-sm bg-muted">
                  <Text className="text-[length:24rpx] text-muted-foreground">
                    {t('ai.agentDetail.permissionLoading')}
                  </Text>
                </View>
              ) : permission ? (
                <View
                  className={`mt-[24rpx] py-[16rpx] px-[20rpx] rounded-sm ${
                    permission.hasPermission
                      ? 'bg-[var(--color-success-light)]'
                      : 'bg-[var(--color-warning-amber-light)]'
                  }`}
                >
                  <Text
                    className={`text-[length:24rpx] ${
                      permission.hasPermission
                        ? 'text-[var(--color-success-deep-text)]'
                        : 'text-[var(--color-warning-amber-text)]'
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
          {agent && (
            <AgentDetailMeta
              creator={pricing?.creator ?? ''}
              uses={useCount ?? null}
              isFree={pricing ? pricing.isFree : null}
              price={pricing ? pricing.price : null}
            />
          )}
          {agent?.prologue && (
            <View className="mx-[20rpx] mb-[24rpx] bg-card rounded-lg border border-border p-[28rpx]">
              <Text className="text-[length:22rpx] text-muted-foreground mb-[16rpx] block">
                {t('ai.agentDetail.prologue')}
              </Text>
              <Text className="text-[length:32rpx] text-foreground leading-[44rpx]">
                {agent.prologue}
              </Text>
            </View>
          )}
          {/* 使用教程 / 示例对话(对标原项目 exampleDialog) */}
          {exampleDialogs.length > 0 && (
            <View className="mx-[20rpx] mb-[24rpx] bg-card rounded-lg border border-border p-[28rpx]">
              <Text className="text-[length:22rpx] text-muted-foreground mb-[16rpx] block">
                {t('ai.agentDetail.exampleDialog')}
              </Text>
              {exampleDialogs.map((dialog, idx) => (
                <View key={idx} className="mb-[20rpx]">
                  {dialog.q && (
                    <View className="flex mb-[8rpx]">
                      <Text className="text-[length:24rpx] text-[var(--color-primary)] font-medium mr-[12rpx]">
                        Q:
                      </Text>
                      <Text className="flex-1 text-[length:32rpx] text-foreground">{dialog.q}</Text>
                    </View>
                  )}
                  {dialog.a && (
                    <View className="flex">
                      <Text className="text-[length:24rpx] text-muted-foreground font-medium mr-[12rpx]">
                        A:
                      </Text>
                      <Text className="flex-1 text-[length:32rpx] text-muted-foreground leading-[40rpx]">
                        {dialog.a}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
          {agent?.systemPrompt && (
            <View className="mx-[20rpx] mb-[24rpx] bg-card rounded-lg border border-border p-[28rpx]">
              <Text className="text-[length:22rpx] text-muted-foreground mb-[16rpx] block">
                {t('ai.agentDetail.promptLabel')}
              </Text>
              <Text className="text-[length:32rpx] text-foreground leading-[44rpx]">
                {agent.systemPrompt}
              </Text>
            </View>
          )}
          {/* 评价区已整块撤除(2026-10-30 逐键可达性取证):原实现把 uses 反推成"4.6 分"
              并按 60/25/10/3/2% 模拟五档分布,再把 usageCount 当"评价人数"上屏 —— 三个数全是假的。
              后端出口现读只有 /agent-reviews(限"我自己名下智能体"收到的评价),访客取不到本智能体的评分,
              故本端不渲染评价区;真要做需后端补 per-agent 评分/评价列表出口(交台账)。 */}
          {agent && (
            <View className="mx-[20rpx] my-[24rpx] flex gap-[24rpx]">
              <Button
                className="flex-1 bg-[var(--color-primary)] text-[var(--color-surface-light)] text-[length:32rpx] font-semibold rounded-sm h-[100rpx] leading-[100rpx]"
                onClick={onChat}
              >
                {t('ai.agentDetail.startChat')}
              </Button>
              <Button
                className={`px-[40rpx] text-[length:28rpx] rounded-sm h-[100rpx] leading-[100rpx] ${favorited ? 'bg-[var(--color-warning-amber-light)] text-[var(--color-warning-amber-text)]' : 'bg-muted text-muted-foreground'}`}
                onClick={onToggleFavorite}
              >
                {favorited ? t('ai.agentDetail.favorited') : t('ai.agentDetail.favoriteAgent')}
              </Button>
            </View>
          )}
          {related.length > 0 && (
            <View className="mb-[48rpx]">
              <Text className="block text-[length:32rpx] text-foreground font-semibold mx-[20rpx] mb-[24rpx]">
                {t('ai.agentDetail.relatedAgents')}
              </Text>
              <ScrollView
                scrollX
                enhanced
                showScrollbar={false}
                className="whitespace-nowrap px-[20rpx]"
              >
                {related.map((r) => (
                  <View
                    key={r.id}
                    className="inline-block w-[200rpx] bg-card rounded-lg border border-border p-[28rpx] mr-[24rpx] align-top"
                    onClick={() => onRelatedClick(r.id)}
                    hoverClass="opacity-60"
                  >
                    <Image
                      className="w-[80rpx] h-[80rpx] rounded-xl bg-muted"
                      src={r.avatar || '/static/default-agent.png'}
                      mode="aspectFill"
                    />
                    <Text className="block text-[length:26rpx] text-foreground font-medium mt-[8rpx] truncate">
                      {r.name}
                    </Text>
                    {r.description && (
                      <Text className="block text-[length:22rpx] text-muted-foreground mt-[4rpx] truncate">
                        {r.description}
                      </Text>
                    )}
                  </View>
                ))}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
