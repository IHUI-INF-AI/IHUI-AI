// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/study-record/StudyRecordScreen.tsx
import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { get, getStudyRecords } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useUserStore } from '@/stores/user'
import ThemeRoot from '@/components/ThemeRoot'
import { EmptyState, ErrorState, ScreenSkeleton } from '@/components/ScreenStates.taro'
import { RecordStats, type StudyStats } from './record-stats'
import { RecordCard, statusOf, type RecordStatus, type StudyRecordRow } from './record-card'

type FilterTab = 'all' | RecordStatus

const PAGE_SIZE = 20

const TAB_BASE =
  'flex-1 flex items-center justify-center h-[96rpx] text-[length:28rpx] rounded-xl text-muted-foreground'
const TAB_ACTIVE = 'bg-cta text-cta-foreground font-semibold'
const STATE_TEXT = 'block text-center text-[length:28rpx] text-muted-foreground py-[96rpx]'

export default function StudyRecord() {
  const tt = useTt()
  const { waitUntilReady } = useAuthReadyGate()
  const user = useUserStore((s) => s.user)

  const [stats, setStats] = useState<StudyStats | null>(null)
  const [rawList, setRawList] = useState<StudyRecordRow[]>([])
  const [displayList, setDisplayList] = useState<StudyRecordRow[]>([])
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const totalRef = useRef(0)

  const load = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return
      if (reset) {
        pageRef.current = 1
        hasMoreRef.current = true
        setHasMore(true)
        setError(false)
      }
      if (!hasMoreRef.current) return
      loadingRef.current = true
      setLoading(true)
      try {
        const res = await getStudyRecords({ page: pageRef.current, pageSize: PAGE_SIZE })
        const rows = (res.list || []) as StudyRecordRow[]
        setRawList((prev) => (reset ? rows : [...prev, ...rows]))
        totalRef.current = res.total ?? (reset ? rows.length : totalRef.current)
        const more = pageRef.current * PAGE_SIZE < totalRef.current
        hasMoreRef.current = more
        setHasMore(more)
        pageRef.current++
      } catch {
        setError(true)
        Taro.showToast({ title: tt('common.failed', '加载失败'), icon: 'none' })
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [tt],
  )

  // 统计卡数据源 = GET /study/statistics(RN 容器 getStudyStatistics 的同一个聚合端点),
  // 与列表各自降级:统计取不到不阻塞记录列表。
  const loadStats = useCallback(async () => {
    try {
      const data = await get<StudyStats>('/study/statistics')
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

  usePullDownRefresh(() => {
    Promise.all([loadStats(), load(true)]).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    load()
  })

  useEffect(() => {
    // G-933 冷启动抢跑门控:GET /api/study/records(user 插件组级 userAuthPreHandler)与
    // GET /api/study/statistics(同插件 authenticate)全需鉴权 ⇒ 整块挡到门后;卸载即注销,不留悬空订阅。
    return waitUntilReady(() => {
      void loadStats()
      void load(true)
    })
  }, [waitUntilReady, load, loadStats])

  // 客户端筛选:三态与 RN 共享屏同义(completed / in_progress / paused)
  useEffect(() => {
    setDisplayList(
      activeTab === 'all' ? rawList : rawList.filter((r) => statusOf(r.progress) === activeTab),
    )
  }, [rawList, activeTab])

  const goCourse = useCallback((courseId: string) => {
    if (courseId) Taro.navigateTo({ url: `/pkg-learn/course/detail?id=${courseId}` })
  }, [])

  const tabs: Array<{ key: FilterTab; label: string }> = [
    { key: 'all', label: tt('study.recordPage.tabAll', '全部') },
    { key: 'in_progress', label: tt('studyRecord.statusInProgress', '进行中') },
    { key: 'completed', label: tt('studyRecord.statusCompleted', '已完成') },
    { key: 'paused', label: tt('studyRecord.statusPaused', '已暂停') },
  ]

  // 副标题取登录用户昵称(RN 容器同源:user?.nickname ?? user?.username)
  const displayName = user?.nickname || user?.username || ''

  return (
    // 对齐 RN StudyRecordScreen(共享屏):容器 bg surface.bg,listBody p14dp→28rpx/pb32dp→64rpx
    <View className="min-h-screen bg-background px-[28rpx] pt-[28rpx] pb-[64rpx] box-border">
      {/* 对齐 RN header:标题由原生导航栏承担(record.config.ts),副标题「{昵称} 的学习记录」留在页内 */}
      <Text className="block text-label text-muted-foreground mb-[20rpx]">
        {tt('studyRecord.subtitle', '{name} 的学习记录', { name: displayName })}
      </Text>

      {/* 学习统计卡对齐 RN statsCard:6 指标 2 行(累计时长/课程总数/已完成课程/课时总数/已完成课时/连续天数) */}
      <RecordStats stats={stats} />

      {/* 状态筛选 tab(业务保留):视觉对齐 RN tab 语言,激活 bg brand + 对比字 */}
      <View className="flex gap-[12rpx] mb-[24rpx]">
        {tabs.map((tb) => (
          <View
            key={tb.key}
            className={`${TAB_BASE} ${activeTab === tb.key ? TAB_ACTIVE : 'bg-card'}`}
            hoverClass="opacity-60"
            onClick={() => setActiveTab(tb.key)}
          >
            <Text>{tb.label}</Text>
          </View>
        ))}
      </View>

      {/* 记录卡片对齐 RN card:p14dp→28rpx / radius 12dp→24rpx / border light;标题 16dp→32rpx/700,进度 fill 对齐 RN success */}
      {displayList.length > 0 && (
        <View className="flex flex-col gap-[16rpx]">
          {displayList.map((r) => (
            <ThemeRoot key={r.id}>
              <RecordCard row={r} onOpen={() => goCourse(r.courseId)} />
            </ThemeRoot>
          ))}
        </View>
      )}

      {/* 状态文案 */}
      {displayList.length === 0 && !loading && !error && (
        <EmptyState title={tt('studyRecord.empty', '暂无学习记录')} />
      )}
      {error && !loading && (
        <ErrorState
          message={tt('common.failed', '加载失败')}
          onRetry={() => load(true)}
          retryLabel={tt('common.retry', '点击重试')}
        />
      )}
      {loading && <ScreenSkeleton variant="list" count={4} />}
      {!loading && !hasMore && displayList.length > 0 && (
        <Text className={STATE_TEXT}>{tt('common.noMore', '没有更多了')}</Text>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
