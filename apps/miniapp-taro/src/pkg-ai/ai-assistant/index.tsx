// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/ai-assistant/AiAssistantScreen.tsx

/**
 * 「AI 助手」= 智能体列表页(与 RN / web 同一业务对象:选一枚智能体 → 发起对话)。
 *
 * 承载形制 = 直载共享层 + 注入本端事实,与 pkg-about/about-shared、pages/member/coupon
 * 同一条路线(端内既有两例,不另发明第三种):布局与样式的真相源在共享层,经 src/rn-compat
 * 兼容层落到小程序;本页只出三件本端事实 —— 取词、主题档、数据与跳转,不写布局、不写样式、
 * 不自造圆角/间距字面量。要改这一屏的外观与文案,应去改源头,不是改本页。
 *
 * 数据腿取 RN 端宿主同一批接口(GET /agents?status=published + 分类字典),搜索为本地过滤
 * (不新增网络请求);「发起对话」交给本端既有的完整对话页 /pkg-ai/ai/chat(它读
 * router.params.agentId 载智能体),本页不再自带第二套对话实现。
 */
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAgentCategories,
  getAgents,
  type Agent,
  type AgentCategoryItem,
} from '@ihui/api-client'
import { AiAssistantScreen as SharedAiAssistantScreen } from '@ihui/rn-app/features/ai-assistant/AiAssistantScreen'
import { useI18n } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'

/** 「全部」档 id(词包无 aiAssistant.catAll ⇒ 该档文案取 common.all,分类名取后端字典) */
const ALL_ID = 'all'

/** 分类档的本端形状(与共享层契约同字段,不另起名) */
interface CategoryOption {
  id: string
  label: string
}

export default function AiAssistantPage() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [agents, setAgents] = useState<Agent[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([
    { id: ALL_ID, label: t('common.all') },
  ])
  const [category, setCategory] = useState<string>(ALL_ID)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      const [agentsResp, catsResp] = await Promise.all([
        getAgents({ status: 'published' }),
        getAgentCategories().catch(() => null),
      ])
      if (!agentsResp.success) {
        setError(t('common.loadFailed'))
        return
      }
      setAgents(agentsResp.data?.list ?? [])
      const main = catsResp?.success ? (catsResp.data?.agentMainCategory ?? []) : []
      setCategories([
        { id: ALL_ID, label: t('common.all') },
        ...main.map((c: AgentCategoryItem) => ({ id: c.id, label: c.name })),
      ])
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useDidShow(() => {
    void load()
  })

  // 分类字典切换后,当前选中项可能已不在册 ⇒ 退回「全部」(共享层不做这一裁决,由本壳接住)
  useEffect(() => {
    if (!categories.some((c) => c.id === category)) setCategory(ALL_ID)
  }, [categories, category])

  const items = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return agents
      .filter((a) => category === ALL_ID || a.categoryId === category)
      .filter(
        (a) =>
          !kw ||
          (a.name ?? '').toLowerCase().includes(kw) ||
          (a.description ?? '').toLowerCase().includes(kw),
      )
      .map((a) => ({
        id: a.agentId,
        name: a.name,
        description: a.description ?? '',
        tags: [] as string[],
        useCount: a.usageCount ?? 0,
        favoriteCount: a.collectCount ?? 0,
      }))
  }, [agents, category, keyword])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  /** 发起对话:跳到本端既有对话页,参数名与该页读取的 agentId 一致 */
  const onPressItem = useCallback((item: { id: string }) => {
    void Taro.navigateTo({ url: `/pkg-ai/ai/chat?agentId=${encodeURIComponent(item.id)}` })
  }, [])

  return (
    <ThemeRoot>
      <SharedAiAssistantScreen
        t={t}
        items={items}
        categories={categories}
        category={category}
        keyword={keyword}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onCategoryChange={setCategory}
        onKeywordChange={setKeyword}
        onRefresh={onRefresh}
        onPressItem={onPressItem}
        onBack={() => Taro.navigateBack()}
        colorScheme={resolvedTheme}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
