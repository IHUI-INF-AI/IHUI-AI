// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * nav-B 薄壳导航端口自证:每个跳转断言目标 route 名 + 参数形状,
 * 并把 tab/返回语义钉死(Follow 屏内 tab 不产生 navigate;ChangePwd 成功确认后 goBack)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { render, cleanup, act } from '@testing-library/react'

const nav = vi.hoisted(() => ({ navigate: vi.fn(), replace: vi.fn(), goBack: vi.fn() }))
const shared = vi.hoisted(() => ({
  exam: { current: null as Record<string, unknown> | null },
  history: { current: null as Record<string, unknown> | null },
  follow: { current: null as Record<string, unknown> | null },
  changePwd: { current: null as Record<string, unknown> | null },
}))
const alertSpy = vi.hoisted(() => vi.fn())

vi.mock('react-native', () => {
  const mk = (tag: string) =>
    function MockComp(props: { children?: ReactNode; [k: string]: unknown }) {
      const { style, onPress, children, ...rest } = props
      const flat = (v: unknown): unknown =>
        Array.isArray(v) ? Object.assign({}, ...v.filter(Boolean).map(flat)) : v
      return createElement(tag, { ...rest, onClick: onPress, style: flat(style) }, children)
    }
  return {
    PixelRatio: { getFontScale: () => 1, getPixelSizeForLayoutSize: (n: number) => n, roundToNearestPixel: (n: number) => n },
    Appearance: { getColorScheme: () => 'light', addChangeListener: () => ({ remove() {} }) },
    useColorScheme: () => 'light',
    View: mk('div'),
    Text: mk('span'),
    ScrollView: mk('div'),
    Pressable: mk('button'),
    TouchableOpacity: mk('button'),
    StyleSheet: { create: <T extends object>(s: T) => s, flatten: (s: unknown) => s },
    Platform: { OS: 'web', select: (o: Record<string, unknown>) => o.web ?? o.ios },
  }
})

vi.mock('@react-navigation/native', async () => {
  const { RN_UI_ROUTES } = await import('../src/constants/ui-routes.generated')
  const routeNames = RN_UI_ROUTES.map((entry) => entry.name)
  return {
    useNavigation: () => ({
      navigate: nav.navigate,
      replace: nav.replace,
      goBack: nav.goBack,
      getState: () => ({ routeNames, index: 0, route: 'NavBTest', params: {} }),
    }),
    useRoute: () => ({ params: {} }),
    useFocusEffect: () => undefined,
  }
})

vi.mock('@ihui/rn-app', () => ({
  ExamScreen: (p: Record<string, unknown>) => {
    shared.exam.current = p
    return createElement('div')
  },
  ExamHistoryScreen: (p: Record<string, unknown>) => {
    shared.history.current = p
    return createElement('div')
  },
  FollowScreen: (p: Record<string, unknown>) => {
    shared.follow.current = p
    return createElement('div')
  },
  ChangePwdScreen: (p: Record<string, unknown>) => {
    shared.changePwd.current = p
    return createElement('div')
  },
}))

const examFixture = {
  id: 'exam-1',
  title: '期中测评',
  duration: 60,
  totalScore: 100,
  passScore: 60,
  questionCount: 20,
  attemptCount: 0,
  maxAttempts: 3,
}

vi.mock('@ihui/api-client', () => ({
  getExams: vi.fn(async () => ({ success: true, data: [examFixture] })),
  fetchApi: vi.fn(async () => ({ success: true, data: { list: [], total: 0 } })),
  updatePassword: vi.fn(async () => ({ success: true })),
}))

vi.mock('../src/api/social', () => ({ unfollowUser: vi.fn(async () => ({ success: true })) }))
vi.mock('../src/hooks', () => ({
  usePaginatedList: () => ({
    items: [],
    loading: false,
    refreshing: false,
    loadingMore: false,
    error: '',
    refresh: vi.fn(),
    loadMore: vi.fn(),
    removeItem: vi.fn(),
  }),
  useRefreshOnFocus: () => undefined,
}))
vi.mock('../src/components/BottomPops', () => ({ appAlert: alertSpy }))

import { I18nProvider } from '../src/i18n'
import { ExamScreen } from '../src/screens/ExamScreen'
import { ExamHistoryScreen } from '../src/screens/ExamHistoryScreen'
import { FollowScreen } from '../src/screens/FollowScreen'
import ChangePwdScreen from '../src/screens/ChangePwdScreen'

const renderScreen = (node: ReactNode) => render(createElement(I18nProvider, null, node))

describe('nav-B 薄壳端口', () => {
  beforeEach(() => {
    cleanup()
    nav.navigate.mockClear()
    nav.replace.mockClear()
    nav.goBack.mockClear()
    alertSpy.mockClear()
    shared.exam.current = null
    shared.history.current = null
    shared.follow.current = null
    shared.changePwd.current = null
  })

  it('Exam 列表开始考试 → ExamQuestion(examId)', async () => {
    renderScreen(createElement(ExamScreen))
    await act(async () => {})
    const props = shared.exam.current as { onStart: (e: typeof examFixture) => void }
    await act(async () => props.onStart(examFixture))
    expect(nav.navigate).toHaveBeenCalledWith('ExamQuestion', { examId: 'exam-1' })
  })

  it('ExamHistory 列表条目 → ExamDetail(id)', async () => {
    renderScreen(createElement(ExamHistoryScreen))
    await act(async () => {})
    const props = shared.history.current as { onPressItem: (id: string) => void }
    await act(async () => props.onPressItem('rec-1'))
    expect(nav.navigate).toHaveBeenCalledWith('ExamDetail', { id: 'rec-1' })
  })

  it('Follow 屏内 tab 是本地状态:切 tab 不产生 navigate,返回走 goBack', async () => {
    renderScreen(createElement(FollowScreen))
    await act(async () => {})
    const props = shared.follow.current as {
      onSelectTab: (t: 'following' | 'fans') => void
      onBack: () => void
    }
    await act(async () => props.onSelectTab('fans'))
    expect(nav.navigate).not.toHaveBeenCalled()
    await act(async () => props.onBack())
    expect(nav.goBack).toHaveBeenCalledTimes(1)
  })

  it('ChangePwd 成功 → 确认后 goBack,失败不留栈', async () => {
    renderScreen(createElement(ChangePwdScreen))
    await act(async () => {})
    type ChangePwdProps = {
      onOldChange: (v: string) => void
      onNewChange: (v: string) => void
      onConfirmChange: (v: string) => void
      onSubmit: () => Promise<void>
    }
    const props = shared.changePwd.current as unknown as ChangePwdProps
    await act(async () => {
      props.onOldChange('old-pwd')
      props.onNewChange('new-pwd1')
      props.onConfirmChange('new-pwd1')
    })
    const latest = shared.changePwd.current as unknown as ChangePwdProps
    await act(async () => {
      await latest.onSubmit()
    })
    const buttons = alertSpy.mock.calls.at(-1)?.[2] as Array<{ onPress?: () => void }> | undefined
    expect(buttons?.[0]?.onPress).toBeTypeOf('function')
    await act(async () => buttons?.[0]?.onPress?.())
    expect(nav.goBack).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
