import { View, Text, Image } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getStudyRecords, getStudyInfo, type StudyRecord } from '@/api'
import { useI18n } from '@/i18n'

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

const STATUS_BASE = 'text-[22rpx] py-[2rpx] px-[12rpx] rounded-[6rpx]'
const TAB_BASE = 'flex-1 flex items-center justify-center h-[60rpx] text-[26rpx] text-muted-foreground rounded-[8rpx]'
const TAB_ACTIVE = 'text-white bg-primary font-semibold'
const STATE_TEXT = 'block text-center text-[26rpx] text-muted-foreground py-[80rpx]'

/** 学习记录派生状态:基于 progress 推断 */
const deriveStatus = (progress: number): FilterTab => {
  if (progress >= 100) return 'completed'
  if (progress > 0) return 'learning'
  return 'abandoned'
}

export default function StudyRecord() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

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

  const load = useCallback(async (reset = false) => {
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
  }, [tt])

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
    Promise.all([loadInfo(), load(true)])
      .finally(() => Taro.stopPullDownRefresh())
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
    if (courseId) Taro.navigateTo({ url: `/pages/course/detail?id=${courseId}` })
  }, [])

  const statusLabel = (s: FilterTab): string => {
    if (s === 'completed') return tt('study.recordPage.statusDone', '已完成')
    if (s === 'learning') return tt('study.recordPage.statusLearning', '学习中')
    return tt('study.recordPage.statusAbandon', '已放弃')
  }

  const statusClass = (s: FilterTab): string => {
    if (s === 'completed') return `${STATUS_BASE} bg-[rgba(76,175,80,0.12)] text-[#4caf50]`
    if (s === 'abandoned') return `${STATUS_BASE} bg-[rgba(158,158,158,0.12)] text-[#9e9e9e]`
    return `${STATUS_BASE} bg-[rgba(0,242,255,0.1)] text-primary`
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
    <View className="min-h-screen bg-background p-[24rpx] pb-[60rpx] box-border">
      {/* 学习统计卡 */}
      <View className="flex bg-card border-[2rpx] border-[rgba(0,242,255,0.12)] rounded-[16rpx] py-[28rpx] px-[16rpx] gap-[12rpx]">
        {stats.map((s) => (
          <View key={s.key} className="flex-1 flex flex-col items-center">
            <View className="flex items-baseline justify-center">
              <Text className="text-[40rpx] font-bold text-primary leading-[1.2]">{s.num}</Text>
              {s.unit && <Text className="text-[22rpx] text-muted-foreground ml-[4rpx] font-normal">{s.unit}</Text>}
            </View>
            <Text className="mt-[8rpx] text-[22rpx] text-muted-foreground">{s.label}</Text>
          </View>
        ))}
      </View>

      {/* 状态筛选 tab */}
      <View className="flex mt-[24rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[12rpx] p-[6rpx]">
        {tabs.map((tb) => (
          <View
            key={tb.key}
            className={`${TAB_BASE} ${activeTab === tb.key ? TAB_ACTIVE : ''}`}
            onClick={() => setActiveTab(tb.key)}
          >
            <Text>{tb.label}</Text>
          </View>
        ))}
      </View>

      {/* 学习记录列表 */}
      {displayList.length > 0 && (
        <View className="mt-[24rpx] flex flex-col gap-[16rpx]">
          {displayList.map((r) => {
            const st = deriveStatus(r.progress)
            return (
              <View key={r.id} className="flex bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[12rpx] p-[20rpx]" onClick={() => goCourse(r.courseId)}>
                {r.coverUrl ? (
                  <Image className="w-[160rpx] h-[120rpx] rounded-[10rpx] bg-muted flex-shrink-0" src={r.coverUrl} mode="aspectFill" />
                ) : (
                  <View className="w-[160rpx] h-[120rpx] rounded-[10rpx] bg-muted flex-shrink-0 flex items-center justify-center text-[22rpx] text-muted-foreground">
                    <Text>{tt('study.recordPage.coverFallback', '课程')}</Text>
                  </View>
                )}
                <View className="flex-1 min-w-0 ml-[20rpx] flex flex-col">
                  <Text className="text-[28rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{r.courseTitle}</Text>
                  <View className="mt-[12rpx]">
                    <View className="h-[8rpx] bg-muted rounded-[4rpx] overflow-hidden">
                      <View
                        className="h-full bg-primary rounded-[4rpx]"
                        style={{ width: `${Math.min(100, Math.max(0, r.progress))}%` }}
                      />
                    </View>
                  </View>
                  <View className="mt-[10rpx] flex items-center justify-between">
                    <Text className="text-[22rpx] text-muted-foreground">
                      {tt('study.recordPage.lastTime', '上次学习')}: {r.time}
                    </Text>
                    <Text className={statusClass(st)}>{statusLabel(st)}</Text>
                  </View>
                  <Text className="mt-[12rpx] self-end py-[8rpx] px-[24rpx] text-[24rpx] text-primary bg-[rgba(0,242,255,0.1)] border-[2rpx] border-[rgba(0,242,255,0.3)] rounded-[8rpx] leading-[1.4]">
                    {tt('study.recordPage.continue', '继续学习')}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {/* 状态文案 */}
      {displayList.length === 0 && !loading && !error && (
        <Text className={STATE_TEXT}>{tt('study.recordPage.empty', '暂无学习记录')}</Text>
      )}
      {error && !loading && (
        <View className="flex flex-col items-center py-[60rpx]" onClick={() => load(true)}>
          <Text className="text-[26rpx] text-destructive">{tt('common.failed', '加载失败')}</Text>
          <Text className="text-[26rpx] text-primary mt-[12rpx]">{tt('common.retry', '点击重试')}</Text>
        </View>
      )}
      {loading && <Text className={STATE_TEXT}>{tt('common.loading', '加载中...')}</Text>}
      {!loading && !hasMore && displayList.length > 0 && (
        <Text className={STATE_TEXT}>{tt('common.noMore', '没有更多了')}</Text>
      )}
    </View>
  )
}
