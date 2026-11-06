// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 镜像 packages/app/src/features/study-record/StudyRecordScreen.tsx

import Taro, { useReachBottom } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n, useTt } from '@/i18n'
import { useTheme } from '@/rn-compat/theme'
import { useUserStore } from '@/stores/user'
import { get, getStudyRecords, type StudyRecord } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import { onToast } from '@/host/on-toast'
import { StudyRecordScreen as SharedStudyRecordScreen } from '@ihui/rn-app/features/study-record/StudyRecordScreen'
import type {
  StudyRecordItem,
  StudyRecordStats,
  StudyRecordStatus,
} from '@ihui/types'

const PAGE_SIZE = 20

/**
 * 三态派生:与 RN 共享屏 statusLabel 三档同义(RN LearnRecord 自带 status;
 * 小程序端 GET /study/records 仅回 progress => 统一由 progress 派生)。
 */
function statusOf(progress: number): StudyRecordStatus {
  if (progress >= 100) return 'completed'
  if (progress > 0) return 'in_progress'
  return 'paused'
}

/**
 * 小程序壳承载 study-record 共享屏:布局 / 统计卡 / 记录卡列表 / 下拉刷新 / 空态全部由
 * packages/app/src/features/study-record/StudyRecordScreen.tsx 负责;本页只出本端事实 ——
 * 取词(useI18n,共享键 studyRecord.* / common.back 本端词典已齐备,无需 TEXT 映射)、
 * 主题档(resolvedTheme)、鉴权门控(useAuthReadyGate)、分页(useReachBottom)、
 * Taro 平台能力(navigateBack / navigateTo)与轻提示(onToast)。
 * 共享屏不自带 onEndReached,分页由本页 useReachBottom 注入并累加到 records。
 */
export default function StudyRecordPage() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  const { waitUntilReady } = useAuthReadyGate()
  const user = useUserStore((s) => s.user)

  const [records, setRecords] = useState<StudyRecordItem[]>([])
  const [stats, setStats] = useState<StudyRecordStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const totalRef = useRef(0)
  const loadingRef = useRef(false)

  const userNickname = user?.nickname || user?.username || ''

  const loadStats = useCallback(async () => {
    try {
      const data = await get<Partial<StudyRecordStats>>('/study/statistics')
      setStats({
        totalDuration: Number(data.totalDuration ?? 0),
        totalCourses: Number(data.totalCourses ?? 0),
        completedCourses: Number(data.completedCourses ?? 0),
        totalLessons: Number(data.totalLessons ?? 0),
        completedLessons: Number(data.completedLessons ?? 0),
        continuousDays: Number(data.continuousDays ?? 0),
      })
    } catch {
      /* 统计卡降级为空,不阻塞列表 */
    }
  }, [])

  const fetchPage = useCallback(
    async (mode: 'initial' | 'refresh' | 'more') => {
      if (loadingRef.current) return
      const reset = mode === 'initial' || mode === 'refresh'
      if (reset) {
        pageRef.current = 1
        hasMoreRef.current = true
        setError('')
      }
      if (!hasMoreRef.current) return
      loadingRef.current = true
      if (mode === 'initial') setLoading(true)
      if (mode === 'refresh') setRefreshing(true)
      try {
        const res = await getStudyRecords({ page: pageRef.current, pageSize: PAGE_SIZE })
        const rows = (res.list || []) as Array<StudyRecord & { lessonTitle?: string }>
        const mapped: StudyRecordItem[] = rows.map((r) => ({
          id: r.id,
          courseTitle: r.courseTitle || null,
          lessonTitle: r.lessonTitle ?? null,
          status: statusOf(r.progress),
          duration: r.duration,
          progress: r.progress,
          lastStudyAt: r.time,
        }))
        setRecords((prev) => (reset ? mapped : [...prev, ...mapped]))
        const total = res.total ?? (reset ? mapped.length : totalRef.current)
        hasMoreRef.current = pageRef.current * PAGE_SIZE < total
        totalRef.current = total
        pageRef.current++
      } catch {
        const msg = tt('common.failed', '加载失败')
        setError(msg)
        onToast(msg, { kind: 'error' })
      } finally {
        loadingRef.current = false
        if (mode === 'initial') setLoading(false)
        if (mode === 'refresh') setRefreshing(false)
      }
    },
    [tt],
  )

  // G-933 冷启动抢跑门控:GET /study/records 与 GET /study/statistics 均鉴权 => 整块挡到门后
  useEffect(() => {
    return waitUntilReady(() => {
      void loadStats()
      void fetchPage('initial')
    })
  }, [waitUntilReady, loadStats, fetchPage])

  const handleRefresh = useCallback(() => {
    void loadStats()
    void fetchPage('refresh')
  }, [loadStats, fetchPage])

  useReachBottom(() => {
    void fetchPage('more')
  })

  const handleBack = useCallback(() => {
    void Taro.navigateBack({ delta: 1 })
  }, [])

  const handleNavigate = useCallback((target: string) => {
    void Taro.navigateTo({ url: target })
  }, [])

  return (
    <ThemeRoot>
      <SharedStudyRecordScreen
        t={t}
        records={records}
        stats={stats}
        userNickname={userNickname}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={handleRefresh}
        onBack={handleBack}
        colorScheme={resolvedTheme}
        onNavigate={handleNavigate}
        onToast={onToast}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
