// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 智能体广场页 — 薄壳:数据腿 + 导航留在本页,列表 UI 落到共享屏。
 * 列表:`@ihui/rn-app` 共享屏 `AgentScreen`(RN 端 `apps/mobile-rn/src/screens/AgentScreen.tsx:748` 真消费;
 * 分类 chips 与关键词包本就"上移自小程序智能体列表页",见 `AgentScreen.tsx:109-111`)。
 * 本页只留 getAgentList 取数、id→agent-detail 导航、下拉刷新与错误重试;
 * 页内 JSX 两枚开标签(`<ThemeRoot>` + `<SharedAgentScreen>`),零重复 UI 段。
 */
import { useTt, useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useTheme } from '@/rn-compat/theme'
import ThemeRoot from '@/components/ThemeRoot'
import { AgentScreen as SharedAgentScreen } from '@ihui/rn-app/features/agent-screen/AgentScreen'
import type { AgentScreenItem } from '@ihui/rn-app/features/agent-screen/AgentScreen'

/** GET /agents 单行 → 共享屏条目(只映射后端真回的字段;uses=0 不下发,保持"未使用不显示") */
function toItem(raw: Record<string, unknown>): AgentScreenItem {
  const text = (v: unknown): string => (typeof v === 'string' ? v : '')
  const uses = Number(raw.uses ?? raw.useCount ?? 0)
  return {
    id: text(raw.id),
    name: text(raw.name),
    avatar: text(raw.avatar) || '/static/default-agent.png',
    description: text(raw.desc) || text(raw.description),
    isVipExclusive: raw.isVipExclusive === true,
    ...(Number.isFinite(uses) && uses > 0 ? { useCount: uses } : {}),
  }
}

export default function AiGroup() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  const [items, setItems] = useState<AgentScreenItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true)
      else setLoading(true)
      setError(false)
      try {
        const res = (await api.getAgentList()) as { list?: Array<Record<string, unknown>> }
        setItems((res?.list || []).map(toItem))
      } catch (e) {
        logger.error('unknown', t('aigroup.q1'), e)
        setError(true)
      } finally {
        if (mode === 'refresh') setRefreshing(false)
        else setLoading(false)
      }
    },
    [t],
  )

  useDidShow(() => {
    void loadData()
  })

  return (
    <ThemeRoot>
      <SharedAgentScreen
        t={t}
        items={items}
        loading={loading}
        refreshing={refreshing}
        error={error ? tt('aiGroup.loadFailed', '加载失败') : null}
        onRefresh={() => void loadData('refresh')}
        onPressItem={(id) => Taro.navigateTo({ url: `/pkg-ai/ai/agent-detail?id=${id}` })}
        onBack={() => Taro.navigateBack()}
        onRetry={() => void loadData()}
        colorScheme={resolvedTheme}
        onNavigate={(target) => void Taro.navigateTo({ url: target })}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
