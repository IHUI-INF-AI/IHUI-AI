// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/ranking/RankingScreen.tsx(佣金榜 = 排行榜共享屏的金额变体)

import { useTt, useI18n } from '@/i18n'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getDistributionRank } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import {
  RankingScreen as SharedRankingScreen,
  type RankingItem,
} from '@ihui/rn-app/features/ranking/RankingScreen'

/** 佣金榜金额格式(¥);由本端注入,共享屏内零货币符号硬编码 */
const AMOUNT = (value: number) => `¥${value}`

/**
 * 手工迁移(批 4):原 139 行自绘榜单 → 直载 ranking/RankingScreen 共享屏。
 * 缺的只是「佣金 ¥ 格式 + 榜单标题 + 无 range/学习时长」三件 → 共享屏以显式 props 承担
 * (amountFormatter / title / showRanges=false / showStudyHours=false)。
 * 数据腿与本端旧行为逐字同:GET /api/distribution/ranking;条目无 studyHours/isMe ⇒ 不注入不渲染。
 */
export default function DistributionRank() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  const gate = useAuthReadyGate()
  const [items, setItems] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await getDistributionRank()
      setItems(
        (res.list || []).map((u, i) => ({
          id: u.id,
          rank: i + 1,
          nickname: u.nickname,
          avatar: u.avatar ?? null,
          points: u.commission,
        })),
      )
    } catch {
      // 原页静默忽略;空态由共享屏承接
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const refresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  // G-933 冷启动抢跑门控:GET /api/distribution/ranking 由 distributionRoutes 统一
  // preHandler 守(apps/api/src/routes/distribution.ts:24)⇒ 需鉴权。
  useDidShow(() => {
    gate.waitUntilReady(load)
  })

  const top3 = items.slice(0, 3)
  const rest = items.slice(3)

  return (
    <ThemeRoot className="min-h-screen bg-background">
      <SharedRankingScreen
        t={t}
        top3={top3}
        rest={rest}
        range="allTime"
        onSelectRange={() => {}}
        loading={loading}
        refreshing={refreshing}
        error=""
        onRefresh={refresh}
        onBack={() => void Taro.navigateBack()}
        colorScheme={resolvedTheme}
        title={tt('distribution.index.menuRank', '推广排行')}
        amountFormatter={AMOUNT}
        showRanges={false}
        showStudyHours={false}
        emptyText={tt('distribution.rankEmpty', '暂无排行数据')}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
