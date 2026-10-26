// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getAigcToolDetail,
  getAigcTools,
  getEduPolicies,
  getEduPolicyDetail,
  getK12CurriculumDetail,
  getK12Curriculums,
  getTeacherCertificationDetail,
  getTeacherCertifications,
  getUniversityCourseDetail,
  getUniversityCourses,
} from '@ihui/api-client'
import {
  EduAiHubScreen as SharedEduAiHubScreen,
  type EduAiAigcToolRow,
  type EduAiCertRow,
  type EduAiCourseRow,
  type EduAiListState,
  type EduAiPolicyRow,
  type EduAiTab,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

/** 本票五条 Wave2 路由由 manifest 交集成方统一注册(禁改 RootNavigator),本地交叉类型补齐。 */
type ShellParams = RootStackParamList & {
  EduAi: { tab?: EduAiTab } | undefined
}
type NavigationProp = NativeStackNavigationProp<ShellParams>
type HubRoute = RouteProp<ShellParams, 'EduAi'>

/** 与 web 四页同口径:工具库 12/页,其余 10/页(aigc-tools/page.tsx:70、certification/page.tsx:44、courses/page.tsx:82)。 */
const PAGE_SIZE: Record<EduAiTab, number> = { aigc: 12, cert: 10, courses: 10, policy: 10 }

interface PageResult<T> {
  rows: T[]
  total: number
}

interface ListQuery {
  page: number
  pageSize: number
  keyword: string
  filter: string
}

function emptyState<T>(pageSize: number, filter: string): EduAiListState<T> {
  return {
    loading: false,
    error: null,
    rows: [],
    total: 0,
    page: 1,
    pageSize,
    keyword: '',
    filter,
    detail: null,
    detailLoading: false,
    detailError: null,
  }
}

/**
 * 单 tab 的列表状态机:分页/关键词(300ms 防抖)/筛选/刷新/详情抽屉。
 * 每次取数带序号,过期响应一律丢弃(切 tab 或连续输入时后到的旧响应不许覆盖新结果)。
 */
function useListState<T>(
  pageSize: number,
  initialFilter: string,
  enabled: boolean,
  errorText: string,
  fetchPage: (q: ListQuery) => Promise<PageResult<T>>,
  fetchDetail: (id: string, filter: string) => Promise<T>,
) {
  const [state, setState] = useState<EduAiListState<T>>(() =>
    emptyState<T>(pageSize, initialFilter),
  )
  const [reloadKey, setReloadKey] = useState(0)
  const seq = useRef(0)
  const prevKeyword = useRef('')
  const fetchRef = useRef(fetchPage)
  const detailRef = useRef(fetchDetail)
  fetchRef.current = fetchPage
  detailRef.current = fetchDetail

  useEffect(() => {
    if (!enabled) return
    const seqNow = ++seq.current
    const debounce = state.keyword === prevKeyword.current ? 0 : 300
    prevKeyword.current = state.keyword
    const timer = setTimeout(() => {
      setState((p) => ({ ...p, loading: true, error: null }))
      void (async () => {
        try {
          const { rows, total } = await fetchRef.current({
            page: state.page,
            pageSize,
            keyword: state.keyword,
            filter: state.filter,
          })
          if (seqNow !== seq.current) return
          setState((p) => ({ ...p, loading: false, rows, total }))
        } catch {
          if (seqNow !== seq.current) return
          setState((p) => ({ ...p, loading: false, error: errorText, rows: [], total: 0 }))
        }
      })()
    }, debounce)
    return () => clearTimeout(timer)
  }, [enabled, state.page, state.keyword, state.filter, reloadKey, pageSize, errorText])

  const setKeyword = useCallback((keyword: string) => {
    setState((p) => ({ ...p, keyword, page: 1 }))
  }, [])
  const setFilter = useCallback((filter: string) => {
    setState((p) => ({ ...p, filter, page: 1 }))
  }, [])
  const setPage = useCallback((page: number) => {
    setState((p) => ({ ...p, page }))
  }, [])
  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])
  const closeDetail = useCallback(() => {
    setState((p) => ({ ...p, detail: null, detailLoading: false, detailError: null }))
  }, [])
  const openDetail = useCallback(
    (id: string) => {
      setState((p) => ({ ...p, detail: null, detailLoading: true, detailError: null }))
      void (async () => {
        try {
          const detail = await detailRef.current(id, state.filter)
          setState((p) => ({ ...p, detail, detailLoading: false }))
        } catch {
          setState((p) => ({ ...p, detailLoading: false, detailError: errorText }))
        }
      })()
    },
    [state.filter, errorText],
  )

  return { state, setKeyword, setFilter, setPage, refresh, openDetail, closeDetail }
}

function unwrap<T>(res: { success: boolean; data?: T }): T {
  if (!res.success || !res.data) throw new Error('request failed')
  return res.data
}

function listOf<T>(res: {
  success: boolean
  data?: { list?: T[]; total?: number }
}): PageResult<T> {
  const data = unwrap(res)
  return { rows: data.list ?? [], total: data.total ?? 0 }
}

/**
 * RN 端「AI 教育」枢纽薄壳 —— 承载 web /edu-ai/{aigc-tools,certification,courses,policy} 四页。
 * 渲染全部委托共享屏 `packages/app/src/features/edu-ai/EduAiHubScreen.tsx`,本文件只管平台侧:
 * 四个 tab 的取数/分页/关键词防抖/筛选/详情抽屉,分页大小与 web 逐页同值。
 */
export function EduAiHubScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<HubRoute>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<EduAiTab>(route.params?.tab ?? 'aigc')

  const errorText = t('eduAiPage.loadFailed')

  const aigc = useListState<EduAiAigcToolRow>(
    PAGE_SIZE.aigc,
    'all',
    activeTab === 'aigc',
    errorText,
    async (q) =>
      listOf(
        await getAigcTools({
          page: q.page,
          pageSize: q.pageSize,
          keyword: q.keyword || undefined,
          category: q.filter === 'all' ? undefined : q.filter,
        }),
      ),
    async (id) => unwrap(await getAigcToolDetail(id)).tool,
  )

  const cert = useListState<EduAiCertRow>(
    PAGE_SIZE.cert,
    'all',
    activeTab === 'cert',
    errorText,
    async (q) =>
      listOf(
        await getTeacherCertifications({
          page: q.page,
          pageSize: q.pageSize,
          keyword: q.keyword || undefined,
          level: q.filter === 'all' ? undefined : q.filter,
        }),
      ),
    async (id) => unwrap(await getTeacherCertificationDetail(id)).certification,
  )

  const courses = useListState<EduAiCourseRow>(
    PAGE_SIZE.courses,
    'k12',
    activeTab === 'courses',
    errorText,
    async (q) => {
      const query = { page: q.page, pageSize: q.pageSize, keyword: q.keyword || undefined }
      if (q.filter === 'university') return listOf(await getUniversityCourses(query))
      return listOf(await getK12Curriculums(query))
    },
    async (id, filter) =>
      filter === 'university'
        ? unwrap(await getUniversityCourseDetail(id)).course
        : unwrap(await getK12CurriculumDetail(id)).curriculum,
  )

  const policy = useListState<EduAiPolicyRow>(
    PAGE_SIZE.policy,
    'all',
    activeTab === 'policy',
    errorText,
    async (q) =>
      listOf(
        await getEduPolicies({
          page: q.page,
          pageSize: q.pageSize,
          keyword: q.keyword || undefined,
          policyLevel: q.filter === 'all' ? undefined : q.filter,
        }),
      ),
    async (id) => unwrap(await getEduPolicyDetail(id)).policy,
  )

  const ctl = { aigc, cert, courses, policy } as const

  return (
    <SharedEduAiHubScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      activeTab={activeTab}
      tabs={{
        aigc: aigc.state,
        cert: cert.state,
        courses: courses.state,
        policy: policy.state,
      }}
      onTabChange={setActiveTab}
      onKeywordChange={(tab, value) => ctl[tab].setKeyword(value)}
      onFilterChange={(tab, value) => ctl[tab].setFilter(value)}
      onPageChange={(tab, page) => ctl[tab].setPage(page)}
      onOpenDetail={(tab, id) => ctl[tab].openDetail(id)}
      onCloseDetail={(tab) => ctl[tab].closeDetail()}
      onRefresh={(tab) => ctl[tab].refresh()}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
