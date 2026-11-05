// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/ranking/RankingScreen.tsx(学习榜 = 排行榜共享屏的分钟变体)

import { useI18n } from '@/i18n'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getStudyRank } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import {
  RankingScreen as SharedRankingScreen,
  type RankingItem,
} from '@ihui/rn-app/features/ranking/RankingScreen'

/**
 * 手工迁移:原 151 行自绘榜单 → 直载 ranking/RankingScreen 共享屏。
 * 缺的只是「分钟文案 + 标题/副标题/空态 + 无 range/学习时长 + 2-1-3 领奖台顺序」四件
 * → 共享屏以显式 props 承担(amountFormatter / title / subtitle / emptyText /
 * showRanges=false / showStudyHours=false;top3 按 2-1-3 重排传入)。
 * 数据腿与本端旧行为逐字同:GET /api/study/rank;条目无 studyHours/isMe ⇒ 不注入不渲染。
 */
export default function StudyRank() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const gate = useAuthReadyGate()
  const [items, setItems] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await getStudyRank()
      setItems(
        (res.list || []).map((u, i) => ({
          id: u.id,
          rank: i + 1,
          nickname: u.nickname,
          avatar: u.avatar ?? null,
          points: u.minutes,
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

  // G-933 冷启动抢跑门控:GET /api/study/rank 由 `miniapp-compat-routes.ts:2483`
  // 的 inline checkAuth 守 ⇒ 需鉴权,挡到门后(加载态/空态由共享屏承接)。
  useDidShow(() => {
    gate.waitUntilReady(load)
  })

  const top3 = items.length >= 3 ? [items[1]!, items[0]!, items[2]!] : items.slice(0, 3)
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
        title={t('study.rankPage.title')}
        subtitle={t('study.rankPage.subtitle')}
        emptyText={t('study.rankPage.empty')}
        amountFormatter={(value: number) => t('study.rankPage.minutes', { n: value })}
        showRanges={false}
        showStudyHours={false}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
