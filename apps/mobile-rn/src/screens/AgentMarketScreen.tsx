// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { AgentMarketScreen as SharedAgentMarketScreen, type AgentMarketItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AgentMarketScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [agents, setAgents] = useState<AgentMarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  // 搜索/重试可并发触发 load;用单调递增的请求序号只认最后一次回包,
  // 并用 aliveRef 拦住卸载后的 setState。
  const reqSeqRef = useRef(0)
  const aliveRef = useRef(true)

  useEffect(
    () => () => {
      aliveRef.current = false
    },
    [],
  )

  const load = async (kw: string) => {
    const seq = ++reqSeqRef.current
    setLoading(true)
    setError('')
    // 后端 GET /agents 回 success({list,total,page,pageSize})，而这里曾把整个信封当数组用
    // ⇒ 市场页永远空列表（与 HistoryScreen / ExamHistoryScreen 同一型，没有任何一层会红）。
    // 目录一次取全:本屏是市场全量页且用 FlatList(有虚拟化),不带 pageSize 会吃服务端默认 20
    // ⇒ 124 枚只见 20(2026-10-21 审计)。
    const PAGE = 'pageSize=200'
    const url = kw ? `/api/agents?keyword=${encodeURIComponent(kw)}&${PAGE}` : `/api/agents?${PAGE}`
    // 后端 GET /agents(handleListAgents,与 web /agents/list 同一 handler)对公开面
    // 经 PUBLIC_AGENT_KEYS 逐键重建:只给 agentId/name/description/categoryId/
    // usageCount/isFree...,没有 id/rating/category。显式投影成共享屏 AgentMarketItem:
    //  · id ← agentId(否则 key/跳转全 undefined)
    //  · uses ← usageCount;rating 公开面无来源 → 不投影(共享屏渲染 '—')
    //  · category 只有 categoryId(uuid),不当分类名展示 → 不投影
    type PublicAgentRow = {
      agentId: string
      name?: string
      description?: string
      usageCount?: number
      isFree?: boolean
    }
    const res = await fetchApi<{ list: PublicAgentRow[] }>(url)
    // 只认最后一次请求的回包;卸载后一律不写 state(旧回包覆盖新结果是真实竞态)
    if (!aliveRef.current || seq !== reqSeqRef.current) return
    if (res.success)
      setAgents(
        (res.data?.list ?? []).map((row) => ({
          id: row.agentId,
          name: row.name ?? '',
          description: row.description ?? '',
          uses: row.usageCount ?? 0,
          isFree: row.isFree ?? false,
        })),
      )
    else setError(apiFailureToText(res, t('agentMarket.loadFailed')))
    setLoading(false)
  }

  useEffect(() => {
    void load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SharedAgentMarketScreen
      t={t}
      items={agents}
      keyword={keyword}
      loading={loading}
      error={error}
      onKeywordChange={setKeyword}
      onSearch={() => load(keyword)}
      onRetry={() => {
        void load(keyword)
      }}
      onPressItem={(id) => navigation.navigate('AgentDetail', { id })}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
