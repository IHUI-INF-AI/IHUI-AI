import { View, Text, Image } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getStudyRecords, getStudyInfo, type StudyRecord } from '@/api'
import { useI18n } from '@/i18n'
import './record.css'

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
    if (s === 'completed') return 'record-status record-status-done'
    if (s === 'abandoned') return 'record-status record-status-abandon'
    return 'record-status'
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
    <View className="record-page">
      {/* 学习统计卡 */}
      <View className="record-stats">
        {stats.map((s) => (
          <View key={s.key} className="record-stat-item">
            <View className="record-stat-num-wrap">
              <Text className="record-stat-num">{s.num}</Text>
              {s.unit && <Text className="record-stat-unit">{s.unit}</Text>}
            </View>
            <Text className="record-stat-label">{s.label}</Text>
          </View>
        ))}
      </View>

      {/* 状态筛选 tab */}
      <View className="record-tabs">
        {tabs.map((tb) => (
          <View
            key={tb.key}
            className={`record-tab ${activeTab === tb.key ? 'record-tab-active' : ''}`}
            onClick={() => setActiveTab(tb.key)}
          >
            <Text>{tb.label}</Text>
          </View>
        ))}
      </View>

      {/* 学习记录列表 */}
      {displayList.length > 0 && (
        <View className="record-list">
          {displayList.map((r) => {
            const st = deriveStatus(r.progress)
            return (
              <View key={r.id} className="record-card" onClick={() => goCourse(r.courseId)}>
                {r.coverUrl ? (
                  <Image className="record-cover" src={r.coverUrl} mode="aspectFill" />
                ) : (
                  <View className="record-cover record-cover-fallback">
                    <Text>{tt('study.recordPage.coverFallback', '课程')}</Text>
                  </View>
                )}
                <View className="record-body">
                  <Text className="record-title">{r.courseTitle}</Text>
                  <View className="record-progress-wrap">
                    <View className="record-progress-track">
                      <View
                        className="record-progress-fill"
                        style={{ width: `${Math.min(100, Math.max(0, r.progress))}%` }}
                      />
                    </View>
                  </View>
                  <View className="record-meta">
                    <Text className="record-time">
                      {tt('study.recordPage.lastTime', '上次学习')}: {r.time}
                    </Text>
                    <Text className={statusClass(st)}>{statusLabel(st)}</Text>
                  </View>
                  <Text className="record-continue">
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
        <Text className="record-empty">{tt('study.recordPage.empty', '暂无学习记录')}</Text>
      )}
      {error && !loading && (
        <View className="record-error" onClick={() => load(true)}>
          <Text className="record-error-text">{tt('common.failed', '加载失败')}</Text>
          <Text className="record-error-retry">{tt('common.retry', '点击重试')}</Text>
        </View>
      )}
      {loading && <Text className="record-loading">{tt('common.loading', '加载中...')}</Text>}
      {!loading && !hasMore && displayList.length > 0 && (
        <Text className="record-no-more">{tt('common.noMore', '没有更多了')}</Text>
      )}
    </View>
  )
}
