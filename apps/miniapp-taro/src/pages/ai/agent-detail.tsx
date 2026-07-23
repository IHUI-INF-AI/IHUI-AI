import { logger } from '@/utils/logger'
import { View, Text, Image, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import {
  getAgentDetail,
  getAgentPermission,
  getAgentList,
  type AgentPermission,
} from '@/api'
import { useI18n } from '@/i18n'
import AgentRuntimePanel from '@/components/AgentRuntimePanel'

interface AgentDetail {
  id: string
  name: string
  desc: string
  avatar?: string
  prompt: string
  prologue?: string
  config?: Record<string, unknown>
  isVipExclusive?: boolean
}

const PERMISSION_REASON_KEY: Record<string, string> = {
  free: 'ai.agentDetail.reasonFree',
  vip: 'ai.agentDetail.reasonVip',
  purchased: 'ai.agentDetail.reasonPurchased',
  vip_only: 'ai.agentDetail.reasonVipOnly',
  paid: 'ai.agentDetail.reasonVip',
}

const FAVORITE_KEY = 'ai_agent_favorites'

type DetailTab = 'info' | 'runtime'

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  office: ['办公', '会议', '邮件', 'excel', 'word', 'ppt', '文档', '表格', 'office'],
  writing: ['写', '文案', '文章', '创作', '小说', '内容', '写作', '文字'],
  coding: ['代码', '编程', '程序', '开发', 'bug', '函数', '前端', '后端', 'python', 'javascript', 'code'],
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

interface RelatedAgent {
  id: string
  name: string
  avatar?: string
  desc?: string
  category: string
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
        desc: a.desc,
        avatar: a.avatar,
        prompt: a.prompt,
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
            desc: x.desc,
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
    return t(`ai.agentList.categories.${category}`)
  }, [category, t])

  return (
    <View className="min-h-screen bg-background">
      <View className="flex bg-card border-b border-border">
        <View
          className={`flex-1 py-3 text-center ${tab === 'info' ? 'border-b-2 border-[var(--color-primary)]' : ''}`}
          onClick={() => setTab('info')}
        >
          <Text
            className={`text-sm ${tab === 'info' ? 'text-[var(--color-primary)] font-medium' : 'text-muted-foreground'}`}
          >
            {t('ai.agentDetail.promptLabel')}
          </Text>
        </View>
        <View
          className={`flex-1 py-3 text-center ${tab === 'runtime' ? 'border-b-2 border-[var(--color-primary)]' : ''}`}
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
            <View className="mx-[12px] my-[12px] bg-card rounded-[8px] p-[16px]">
              <View className="flex items-center">
                <Image
                  className="w-[80px] h-[80px] rounded-md bg-muted"
                  src={agent.avatar || '/static/default-agent.png'}
                  mode="aspectFill"
                />
                <View className="ml-[12px] flex-1">
                  <View className="flex items-center">
                    <Text className="text-[18px] text-foreground font-bold">{agent.name}</Text>
                    {agent.isVipExclusive && (
                      <Text className="ml-[8px] text-[11px] px-[6px] py-[2px] rounded bg-amber-50 text-amber-600">
                        {t('ai.agentDetail.vipExclusive')}
                      </Text>
                    )}
                  </View>
                  <Text className="block text-[14px] text-muted-foreground mt-[4px]">{agent.desc}</Text>
                  <View className="flex items-center mt-[6px]">
                    {categoryLabel && (
                      <Text className="text-[11px] px-[6px] py-[2px] mr-[8px] rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        {categoryLabel}
                      </Text>
                    )}
                    {useCount !== undefined && (
                      <Text className="text-[11px] text-muted-foreground">
                        {t('ai.agentDetail.useCount', { n: useCount })}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              {permLoading ? (
                <View className="mt-[12px] py-[8px] px-[10px] rounded bg-muted">
                  <Text className="text-[12px] text-muted-foreground">
                    {t('ai.agentDetail.permissionLoading')}
                  </Text>
                </View>
              ) : permission ? (
                <View
                  className={`mt-[12px] py-[8px] px-[10px] rounded ${
                    permission.hasPermission ? 'bg-emerald-50' : 'bg-amber-50'
                  }`}
                >
                  <Text
                    className={`text-[12px] ${
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
            <View className="mx-[12px] mb-[12px] bg-muted rounded-[8px] p-[16px]">
              <Text className="text-[14px] text-foreground font-semibold mb-[8px] block">
                {t('ai.agentDetail.prologue')}
              </Text>
              <Text className="text-[14px] text-muted-foreground leading-[22px]">{agent.prologue}</Text>
            </View>
          )}
          {agent?.prompt && (
            <View className="mx-[12px] mb-[12px] bg-muted rounded-[8px] p-[16px]">
              <Text className="text-[14px] text-foreground font-semibold mb-[8px] block">
                {t('ai.agentDetail.promptLabel')}
              </Text>
              <Text className="text-[14px] text-muted-foreground leading-[22px]">{agent.prompt}</Text>
            </View>
          )}
          {agent && (
            <View className="mx-[12px] my-[12px] flex gap-[12px]">
              <Button
                className="flex-1 bg-[var(--color-primary)] text-white text-[16px] rounded-[8px] h-[44px] leading-[44px]"
                onClick={onChat}
              >
                {t('ai.agentDetail.startChat')}
              </Button>
              <Button
                className={`px-[20px] text-[14px] rounded-[8px] h-[44px] leading-[44px] ${favorited ? 'bg-amber-50 text-amber-600' : 'bg-muted text-muted-foreground'}`}
                onClick={onToggleFavorite}
              >
                {favorited ? t('ai.agentDetail.favorited') : t('ai.agentDetail.favoriteAgent')}
              </Button>
            </View>
          )}
          {related.length > 0 && (
            <View className="mb-[24px]">
              <Text className="block text-[15px] text-foreground font-semibold mx-[12px] mb-[12px]">
                {t('ai.agentDetail.relatedAgents')}
              </Text>
              <ScrollView scrollX enhanced showScrollbar={false} className="whitespace-nowrap px-[12px]">
                {related.map((r) => (
                  <View
                    key={r.id}
                    className="inline-block w-[200rpx] bg-card rounded-[8px] p-[12px] mr-[12px] align-top"
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
                    {r.desc && (
                      <Text className="block text-[22rpx] text-muted-foreground mt-[4rpx] truncate">
                        {r.desc}
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
        <View className="mx-[12px] my-[12px]">
          <AgentRuntimePanel />
        </View>
      )}
    </View>
  )
}
