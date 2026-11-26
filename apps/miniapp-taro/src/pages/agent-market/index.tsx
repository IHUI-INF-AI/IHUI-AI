// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-11-25:由「套 RN 容器(@rn-shells/AgentMarketScreen)」改为「端内数据层 + shared 纯 UI 屏」。
 *
 * 为什么换:mobile-rn 那个容器为了做导航,import 了 @react-navigation/native +
 * @react-navigation/native-stack + RootNavigator 的类型 —— 这棵导航树在小程序端零用途,
 * 却整棵落进主包。A/B 实测:把本页换成极简占位后主包从 2,134,547 B 降到 2,103,812 B,
 * 即该壳占 30,735 B,是超微信硬上限 37,395 B 的 82%(见 docs/engineering/mobile-page-audit-2026-11-24.md §9)。
 *
 * 现在:UI 仍是 packages/app/src/features/agent-market/AgentMarketScreen.tsx 同一份(单源不变),
 * 数据层落在端内 —— tab 页本来就该自己取数,壳只是把 RN 的导航习惯带过来了。
 *
 * showBack={false}:根 tab 无处可返,不该画返回键。
 */
import { useCallback, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'

import { fetchApi } from '@ihui/api-client'
import { AgentMarketScreen as SharedAgentMarketScreen } from '@ihui/rn-app/features/agent-market/AgentMarketScreen'
import { apiFailureToText } from '@ihui/shared/utils'

import ThemeRoot from '@/components/ThemeRoot'
import { useTt } from '@/i18n'
import { useTheme } from '@/rn-compat/theme'

type ScreenProps = Parameters<typeof SharedAgentMarketScreen>[0]
type MarketItem = ScreenProps['items'][number]

/** 目录一次取全:本屏是市场全量页且用 FlatList(有虚拟化),不带 pageSize 会吃服务端默认 20 ⇒ 只见 20 枚。 */
const PAGE_QUERY = 'pageSize=200'

/** 后端 GET /agents(handleListAgents)对公开面经 PUBLIC_AGENT_KEYS 逐键重建:
 *  只有 agentId/name/description/usageCount/isFree,没有 id/rating/category。
 *  所以显式投影:id ← agentId(否则 key 与跳转全 undefined);rating/category 公开面无来源 → 不投影。 */
type PublicAgentRow = {
  agentId: string
  name?: string
  description?: string
  usageCount?: number
  isFree?: boolean
}

export default function AgentMarketPage() {
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  const [items, setItems] = useState<MarketItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(
    async (kw: string) => {
      setLoading(true)
      setError('')
      const qs = kw ? `keyword=${encodeURIComponent(kw)}&${PAGE_QUERY}` : PAGE_QUERY
      try {
        const res = await fetchApi<{ list?: PublicAgentRow[] }>(`/api/agents?${qs}`)
        if (res.success) {
          setItems(
            (res.data?.list ?? []).map((row) => ({
              id: row.agentId,
              name: row.name ?? '',
              description: row.description ?? '',
              uses: row.usageCount ?? 0,
              isFree: row.isFree ?? false,
            })),
          )
        } else {
          setError(apiFailureToText(res, tt('agentMarket.loadFailed', '加载失败，请重试')))
        }
      } catch {
        setError(tt('agentMarket.loadFailed', '加载失败，请重试'))
      } finally {
        setLoading(false)
      }
    },
    [tt],
  )

  useLoad(() => {
    void load('')
  })

  return (
    <ThemeRoot>
      <SharedAgentMarketScreen
        t={(key: string) => tt(key, key)}
        items={items}
        keyword={keyword}
        loading={loading}
        error={error}
        onKeywordChange={setKeyword}
        onSearch={() => void load(keyword)}
        onRetry={() => void load(keyword)}
        onPressItem={(id) => {
          void Taro.navigateTo({ url: `/pkg-ai/ai/agent-detail?id=${encodeURIComponent(id)}` })
        }}
        onBack={() => void Taro.navigateBack()}
        colorScheme={resolvedTheme}
        showBack={false}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
