// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getStudyRecords, getStudyInfo, type StudyRecord } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

type FilterTab = 'all' | 'learning' | 'completed' | 'abandoned'

/** 扩展 StudyRecord,兼容后端可能返回的 coverUrl 字段 */
type StudyRecordRow = StudyRecord & { coverUrl?: string }

interface StudyInfo {
  totalMinutes: number
  continuousDays: number
  courses: number
  todayMinutes: number
}

const PAGE_SIZE = 20

const STATUS_BASE = 'text-[20rpx] font-semibold py-[8rpx] px-[16rpx] rounded-[8rpx]'
const TAB_BASE =
  'flex-1 flex items-center justify-center h-[96rpx] text-[28rpx] rounded-[24rpx] text-muted-foreground'
const TAB_ACTIVE = 'bg-primary text-primary-foreground font-semibold'
const STATE_TEXT = 'block text-center text-[28rpx] text-muted-foreground py-[96rpx]'

/** 学习记录派生状态:基于 progress 推断 */
const deriveStatus = (progress: number): FilterTab => {
  if (progress >= 100) return 'completed'
  if (progress > 0) return 'learning'
  return 'abandoned'
}

export default function StudyRecord() {
  const tt = useTt()

  const [info, setInfo] = useState<StudyInfo | null>(null)
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

  const loadInfo = useCallback(async () => {
    try {
      const data = await getStudyInfo()
      setInfo({
        totalMinutes: Number(data.totalMinutes ?? 0),
        continuousDays: Number(data.continuousDays ?? 0),
        courses: Number(data.courses ?? 0),
        todayMinutes: Number(data.todayMinutes ?? 0),
      })
    } catch {
      /* 统计卡降级为空,不阻塞列表 */
    }
  }, [])

  usePullDownRefresh(() => {
    Promise.all([loadInfo(), load(true)]).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    load()
  })

  useEffect(() => {
    loadInfo()
    load(true)
  }, [load, loadInfo])

  // 客户端筛选:基于 progress 派生 status
  useEffect(() => {
    if (activeTab === 'all') {
      setDisplayList(rawList)
    } else {
      setDisplayList(rawList.filter((r) => deriveStatus(r.progress) === activeTab))
    }
  }, [rawList, activeTab])

  const goCourse = useCallback((courseId: string) => {
    if (courseId) Taro.navigateTo({ url: `/pkg-learn/course/detail?id=${courseId}` })
  }, [])

  const statusLabel = (s: FilterTab): string => {
    if (s === 'completed') return tt('study.recordPage.statusDone', '已完成')
    if (s === 'learning') return tt('study.recordPage.statusLearning', '学习中')
    return tt('study.recordPage.statusAbandon', '已放弃')
  }

  const statusClass = (s: FilterTab): string => {
    // 对齐 RN statusStyle:completed=success.light / in_progress=warning.light;abandoned 对应 paused 语义,用 muted 保证可读
    if (s === 'completed') return `${STATUS_BASE} bg-[var(--color-success-light)] text-foreground`
    if (s === 'abandoned') return `${STATUS_BASE} bg-muted text-muted-foreground`
    return `${STATUS_BASE} bg-[var(--color-warning-light)] text-foreground`
  }

  const stats: Array<{ key: string; num: number; label: string; unit?: string }> = [
    {
      key: 'total',
      num: info?.totalMinutes ?? 0,
      label: tt('study.recordPage.statTotal', '累计学习'),
      unit: tt('study.recordPage.unitMin', '分钟'),
    },
    {
      key: 'days',
      num: info?.continuousDays ?? 0,
      label: tt('study.recordPage.statDays', '连续打卡'),
      unit: tt('study.recordPage.unitDay', '天'),
    },
    {
      key: 'courses',
      num: info?.courses ?? 0,
      label: tt('study.recordPage.statCourses', '完成课程'),
      unit: tt('study.recordPage.unitCourse', '门'),
    },
    {
      key: 'points',
      num: (info?.totalMinutes ?? 0) * 10,
      label: tt('study.recordPage.statPoints', '获得积分'),
      unit: tt('study.recordPage.unitPoint', '分'),
    },
  ]

  const tabs: Array<{ key: FilterTab; label: string }> = [
    { key: 'all', label: tt('study.recordPage.tabAll', '全部') },
    { key: 'learning', label: tt('study.recordPage.tabLearning', '学习中') },
    { key: 'completed', label: tt('study.recordPage.tabCompleted', '已完成') },
    { key: 'abandoned', label: tt('study.recordPage.tabAbandoned', '已放弃') },
  ]

  return (
    // 对齐 RN StudyRecordScreen(共享屏):容器 bg surface.bg,listBody p14dp→28rpx/pb32dp→64rpx
    <View className="min-h-screen bg-background px-[28rpx] pt-[28rpx] pb-[64rpx] box-border">
      {/* 学习统计卡对齐 RN statsCard:p14dp→28rpx / radius 12dp→24rpx / border light / bg card;数值 20dp→40rpx/700 text.primary,标签 11dp→22rpx secondary */}
      <View className="flex bg-card border border-border rounded-[24rpx] p-[28rpx] gap-[12rpx] mb-[24rpx]">
        {stats.map((s) => (
          <View key={s.key} className="flex-1 flex flex-col items-center">
            <View className="flex items-baseline justify-center">
              <Text className="text-[40rpx] font-bold text-foreground leading-[1.2]">{s.num}</Text>
              {s.unit && (
                <Text className="text-[22rpx] text-muted-foreground ml-[4rpx] font-normal">
                  {s.unit}
                </Text>
              )}
            </View>
            <Text className="mt-[16rpx] text-[22rpx] text-muted-foreground text-center">
              {s.label}
            </Text>
          </View>
        ))}
      </View>

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

      {/* 记录卡片对齐 RN card:p14dp→28rpx / radius 12dp→24rpx / border light;标题 16dp→32rpx/700;时间 11dp→22rpx text.tertiary;进度 fill 对齐 RN success */}
      {displayList.length > 0 && (
        <View className="flex flex-col gap-[16rpx]">
          {displayList.map((r) => {
            const st = deriveStatus(r.progress)
            return (
              <ThemeRoot key={r.id}>
                <View
                  className="flex bg-card border border-border rounded-[24rpx] p-[28rpx]"
                  hoverClass="opacity-60"
                  onClick={() => goCourse(r.courseId)}
                >
                  {r.coverUrl ? (
                    <Image
                      className="w-[160rpx] h-[120rpx] rounded-[16rpx] bg-muted flex-shrink-0"
                      src={r.coverUrl}
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="w-[160rpx] h-[120rpx] rounded-[16rpx] bg-muted flex-shrink-0 flex items-center justify-center text-[22rpx] text-muted-foreground">
                      <Text>{tt('study.recordPage.coverFallback', '课程')}</Text>
                    </View>
                  )}
                  <View className="flex-1 min-w-0 ml-[20rpx] flex flex-col">
                    <Text className="text-[32rpx] font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                      {r.courseTitle}
                    </Text>
                    <View className="mt-[12rpx]">
                      <View className="h-[8rpx] bg-muted rounded-[4rpx] overflow-hidden">
                        <View
                          className="h-full bg-success rounded-[4rpx]"
                          style={{ width: `${Math.min(100, Math.max(0, r.progress))}%` }}
                        />
                      </View>
                    </View>
                    <View className="mt-[10rpx] flex items-center justify-between">
                      <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                        {tt('study.recordPage.lastTime', '上次学习')}: {r.time}
                      </Text>
                      <Text className={statusClass(st)}>{statusLabel(st)}</Text>
                    </View>
                    <View className="mt-[12rpx] self-end py-[16rpx] px-[32rpx] bg-primary rounded-[24rpx]">
                      <Text className="text-[28rpx] font-semibold text-primary-foreground leading-[1.4]">
                        {tt('study.recordPage.continue', '继续学习')}
                      </Text>
                    </View>
                  </View>
                </View>
              </ThemeRoot>
            )
          })}
        </View>
      )}

      {/* 状态文案 */}
      {displayList.length === 0 && !loading && !error && (
        <Text className={STATE_TEXT}>{tt('study.recordPage.empty', '暂无学习记录')}</Text>
      )}
      {error && !loading && (
        <View
          className="flex flex-col items-center py-[60rpx]"
          hoverClass="opacity-60"
          onClick={() => load(true)}
        >
          <Text className="text-[28rpx] text-[var(--color-danger)]">
            {tt('common.failed', '加载失败')}
          </Text>
          <Text className="text-[28rpx] text-success mt-[16rpx]">
            {tt('common.retry', '点击重试')}
          </Text>
        </View>
      )}
      {loading && <Text className={STATE_TEXT}>{tt('common.loading', '加载中...')}</Text>}
      {!loading && !hasMore && displayList.length > 0 && (
        <Text className={STATE_TEXT}>{tt('common.noMore', '没有更多了')}</Text>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
