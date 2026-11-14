// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


// 镜像 packages/app/src/features/study-record/StudyRecordScreen.tsx
//
// 薄壳(2026-11-14 收敛):视图委托共享屏 `StudyRecordScreen`,本端只保留平台职责:
//   ① 取数 —— GET /study/records(分页)+ GET /study/statistics;
//   ② 生命周期 —— usePullDownRefresh / useReachBottom / 冷启动门控;
//   ③ 端内控件 —— 状态筛选条、记录卡(`./record-card`,含本端独有的今日已学分钟/进度条)。
// 收敛前本页手写 header + 统计卡 + tab + 卡片 + 五态(188 行);现在骨架/空态/错误/加载
// 全部由共享屏承担,本端只留"共享屏没有的本端字段"。
import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { get, getStudyRecords } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useUserStore } from '@/stores/user'
import ThemeRoot from '@/components/ThemeRoot'
import { StudyRecordScreen } from '@ihui/rn-app/features/study-record/StudyRecordScreen'
import type { StudyRecordItem } from '@ihui/types'
import { useAppTheme } from '@/lib/theme'
import type { StudyStats } from './record-stats'
import { RecordCard, statusOf, type RecordStatus, type StudyRecordRow } from './record-card'
import { onToast } from '@/host/on-toast'

type FilterTab = 'all' | RecordStatus

/**
 * 本端 StudyRecordRow → 共享 StudyRecordItem 的投影。
 *
 * 为什么需要这一层:本端 api 的 `time` 字段后端从未给出(真名是 lastStudyAt/createdAt),
 * 共享契约要求 `lastStudyAt`。投影放在本端,共享屏不必认识端内历史命名;
 * 缺失时给空串(共享屏按「无」渲染),不编时间。
 */
function toRecordItem(row: StudyRecordRow): StudyRecordItem {
  return {
    id: row.id,
    courseTitle: row.courseTitle ?? null,
    lessonTitle: row.lessonTitle ?? null,
    status: statusOf(row.progress),
    duration: row.duration,
    progress: row.progress,
    lastStudyAt: row.lastStudyAt ?? row.createdAt ?? row.time ?? '',
  }
}

const PAGE_SIZE = 20

const TAB_BASE =
  'flex-1 flex items-center justify-center h-[96rpx] text-body leading-[normal] rounded-xl text-muted-foreground'
const TAB_ACTIVE = 'bg-cta text-cta-foreground font-semibold'
const STATE_TEXT = 'block text-center text-body leading-[normal] text-muted-foreground py-[96rpx]'

export default function StudyRecord() {
  const tt = useTt()
  const { resolved } = useAppTheme()
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
        onToast(tt('common.failed', '加载失败'), { kind: 'error' })
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
    void load()
  })

  useEffect(() => {
    // G-933 冷启动抢跑门控:GET /api/study/records(user 插件组级 userAuthPreHandler)与
    // GET /api/study/statistics(同插件 authenticate)全需鉴权 ⇒ 整块挡到门后;卸载即注销。
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
    <ThemeRoot>
      <StudyRecordScreen
        t={tt as never}
        records={displayList.map(toRecordItem)}
        stats={stats}
        userNickname={displayName}
        loading={loading}
        refreshing={false}
        error={error ? tt('common.failed', '加载失败') : ''}
        onRefresh={() => {
          void loadStats()
          void load(true)
        }}
        onBack={() => Taro.navigateBack()}
        colorScheme={resolved}
        onNavigate={(url) => Taro.navigateTo({ url })}
        onToast={onToast}
        onEndReached={() => {
          void load()
        }}
        // 筛选条:共享屏 ListHeader 只放统计卡,这里用第二槽位承载页面级 tab
        renderListHeader={() => (
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
        )}
        // 卡片:本端独有的今日已学分钟/进度条由 ./record-card 承载
        renderItem={(item) => {
          const row = displayList.find((r) => r.id === item.id)
          if (!row) return null
          return (
            <ThemeRoot>
              <RecordCard row={row} onOpen={() => goCourse(row.courseId)} />
            </ThemeRoot>
          )
        }}
        renderListFooter={() =>
          !loading && !hasMore && displayList.length > 0 ? (
            <Text className={STATE_TEXT}>{tt('common.noMore', '没有更多了')}</Text>
          ) : null
        }
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
