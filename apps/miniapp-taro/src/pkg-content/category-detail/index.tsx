// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 薄壳:渲染全部委托共享屏 packages/app/src/features/category-detail/CategoryDetailScreen.tsx
// 端内保留:① 路由参数 id/categoryId;② getAgentList 取数;③ 三档排序(推荐=接口原序 / 热门=useCount 降序 / 最新=反转);
// ④ 标题取词与三档文案 i18n;⑤ 条目跳转。
// 删除:tags 分支 —— 无数据源(定义在本地 AgentItem,但映射从未赋值;API Agent 契约也无 tags),非漏渲染。
import { useI18n, useTt } from '@/i18n'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import type { Agent } from '@ihui/api-client'
import { getAgentList } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { CategoryDetailScreen } from '@ihui/rn-app/features/category-detail/CategoryDetailScreen'

/** 本地视图模型:id 由 @/api 的 getAgentList 把后端主键 agentId 映射而来(对齐 mobile-rn AgentShopItem.id) */
type AgentItem = Pick<Agent, 'name'> & {
  id: string
  description?: string
  avatar?: string
  useCount?: number
}

/** 取数行 → 共享屏条目;avatar/useCount 在此映射(测试断言这两枚,摘掉即红) */
export function toAgentItem(a: {
  id: string
  name: string
  desc?: string
  avatar?: string
  uses?: number
}): AgentItem {
  return {
    id: a.id,
    name: a.name,
    description: a.desc,
    avatar: a.avatar,
    useCount: a.uses,
  }
}

export function sortItems(list: AgentItem[], tab: string): AgentItem[] {
  if (tab === '热门') return [...list].sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
  if (tab === '最新') return [...list].reverse()
  return list
}

export default function CategoryDetailPage() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  const [list, setList] = useState<AgentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('热门')
  const [categoryId, setCategoryId] = useState('')

  const load = useCallback(async () => {
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    const id = (current?.options?.id || current?.options?.categoryId || '') as string
    setCategoryId(id)
    setLoading(true)
    try {
      const res = await getAgentList()
      const agents: AgentItem[] = (res.list || []).map(toAgentItem)
      setList(sortItems(agents, activeTab))
    } catch {
      // 对齐原页:失败保持空态;重试入口由共享屏 onRetry 提供
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useDidShow(load)

  return (
    <ThemeRoot>
      <CategoryDetailScreen
        t={t}
        items={list}
        activeTab={activeTab}
        title={
          categoryId
            ? t('categoryDetail.categoryId', { id: categoryId })
            : t('categoryDetail.allCategories')
        }
        tabLabels={[
          tt('categoryDetail.recommended', '推荐'),
          t('categoryDetail.hot'),
          t('categoryDetail.new'),
        ]}
        loading={loading}
        hasMore={false}
        error=""
        onTabChange={(tab) => {
          setActiveTab(tab)
          setList((prev) => sortItems(prev, tab))
        }}
        onLoadMore={() => undefined}
        onAgentPress={(id) => Taro.navigateTo({ url: `/pkg-ai/ai/agent-detail?id=${id}` })}
        onBack={() => void Taro.navigateBack()}
        onRetry={() => void load()}
        colorScheme={resolvedTheme}
      />
    </ThemeRoot>
  )
}
