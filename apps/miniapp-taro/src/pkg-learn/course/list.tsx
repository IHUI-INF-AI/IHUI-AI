// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 镜像 packages/app/src/features/course-screen/CourseScreen.tsx
//
// 薄壳(2026-11-14 收敛):列表视图委托共享屏 `CourseScreen`,本端只保留平台职责:
//   ① 取数 —— GET /api/content/course/list(点搜索重取 + 触底追加);
//   ② 生命周期 —— usePullDownRefresh / useReachBottom / useShareAppMessage / useShareTimeline;
//   ③ 导航 —— 课程详情。
// 字段映射本端独有(本端 api 层把 instructor→teacher、cover→coverUrl),
// 收敛前这些字段名差异逼得整页手抄一份样式;现在映射只发生在一处,视图只有一份。
import { useI18n } from '@/i18n'
import Taro, {
  usePullDownRefresh,
  useReachBottom,
  useShareAppMessage,
  useShareTimeline,
  useRouter,
} from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getCourseList, type Course } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import { useAppTheme } from '@/lib/theme'
import { CourseScreen } from '@ihui/rn-app/features/course-screen/CourseScreen'
import type { CourseScreenItem } from '@ihui/types'

type CourseRow = Course & { signupCount?: number }

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const
type CourseLevel = (typeof LEVELS)[number]

/** 端内 level 是自由字符串(后端下发值不受控);共享契约是三档枚举,未登记值退回 beginner 而不造新档 */
function toLevel(raw: string | undefined): CourseLevel {
  return LEVELS.includes(raw as CourseLevel) ? (raw as CourseLevel) : 'beginner'
}

/**
 * 本端 Course → 共享 CourseScreenItem 的投影。
 *
 * 为什么需要这一层:本端 api 层的历史命名(coverUrl/teacher/signupCount)与共享契约
 * (cover/instructor/studentCount)不同。投影放在本端,共享屏不必认识端内命名;
 * 缺失值按共享屏同口径兜底(signupCount 缺省 0、price 缺省 0),不造数据。
 */
function toCourseItem(item: CourseRow): CourseScreenItem {
  return {
    id: String(item.id),
    title: item.title,
    cover: item.coverUrl,
    description: item.subtitle || item.description,
    level: toLevel(item.level),
    instructor: item.teacher ?? '',
    studentCount: item.signupCount ?? 0,
    isFree: (item.price ?? 0) <= 0,
    price: item.price ?? 0,
  }
}

export default function CourseList() {
  const { t } = useI18n()
  const { resolved } = useAppTheme()
  const router = useRouter()
  const initialKeyword = router.params.keyword || ''
  const [list, setList] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState(initialKeyword)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)
  const keywordRef = useRef(initialKeyword)

  /** 取数:reset=true 从第 1 页重取,否则追加下一页 */
  const load = useCallback(async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      lenRef.current = 0
      setList([])
    }
    if (!reset && !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getCourseList({
        page: pageRef.current,
        pageSize: 10,
        keyword: keywordRef.current,
      })
      const more = res.list || []
      lenRef.current = reset ? more.length : lenRef.current + more.length
      setList((prev) => (reset ? more : [...prev, ...more]))
      hasMoreRef.current = lenRef.current < res.total
      setPage(pageRef.current)
      setTotalPages(Math.max(1, Math.ceil((res.total || 0) / 10)))
      pageRef.current++
    } catch {
      // 共享屏以空态/既有列表承接;失败不伪造数据
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  /** 点搜索/回车:把输入框当前值定为生效关键字并重取 */
  const onSearch = useCallback(() => {
    keywordRef.current = keyword
    void load(true)
  }, [keyword, load])

  const goDetail = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pkg-learn/course/detail?id=${id}` })
  }, [])

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })
  useReachBottom(() => {
    void load()
  })

  useEffect(() => {
    void load(true)
  }, [load])

  useShareAppMessage(() => ({
    title: t('share.appTitle'),
    path: '/pkg-learn/course/list',
    imageUrl: '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: t('share.timelineTitle'),
    query: '',
  }))

  const items = useMemo(() => list.map(toCourseItem), [list])

  return (
    <ThemeRoot>
      <CourseScreen
        t={t}
        items={items}
        keyword={keyword}
        loading={loading}
        error=""
        page={page}
        totalPages={totalPages}
        onKeywordChange={setKeyword}
        onSearch={onSearch}
        onEndReached={() => {
          void load()
        }}
        onPageChange={(p) => {
          // 共享屏翻页器按页跳转;本端是追加式列表,跳页即从该页重取
          pageRef.current = p
          hasMoreRef.current = true
          lenRef.current = 0
          setList([])
          void load()
        }}
        onPressItem={goDetail}
        colorScheme={resolved}
      />
    </ThemeRoot>
  )
}
