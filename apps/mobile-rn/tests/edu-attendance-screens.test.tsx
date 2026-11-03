// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤三屏(mobile-rn 端)行为用例。立因:该三屏此前零用例,RN 侧「只能看不能操作」从未被钉住。
 *
 * 钉的五格:
 *  ① 挂载只发一次取列表,且路径 + 查询参数逐字正确(含「业务日按 UTC+8 切」那一格);
 *  ② 签到/签退/自签/扫码各打各的端点,失败把后端 message 原样上屏(appAlert),不静默;
 *  ③ 学生本人页只取自己的考勤:即使调用方塞进 studentId 也不得当查询依据、客户端不送身份
 *     (AGENTS §5「认证不等于授权」);
 *  ④ 写操作成功后重新取列表,不做本地乐观更新(以服务端回读为准);
 *  ⑤ 2026-11 契约收口:写接口 payload **不含 status**(状态由服务端按该班规则现算)、
 *     代签只发当日业务日(跨日行当场拒发,不发注定 400 的请求)、
 *     早退(early)自此真会由服务端产出 ⇒ 色档/文案五档齐备且四屏同源。
 *
 * 机制照抄本仓既有 RN 用例(tests/security-ip-panel.test.tsx 与 tests/session-expiry-navigation.test.ts):
 * 局部 vi.mock 替掉宿主(RN/图标/相机/共享控制台屏/底部弹层),取词走**真词包** ⇒ 断言的是文案本身。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
// @typescript-eslint/consistent-type-imports 禁止内联 import() 类型 ⇒ 顶层 type 别名
import type * as I18nModule from '../src/i18n'
import { translate } from '@ihui/i18n/loader'
import { messages } from '../src/i18n'

type FetchInit = { method?: string; body?: string }
type ApiResult =
  { success: true; data: unknown } | { success: false; error: string; status?: number }
type AlertButton = { text?: string; onPress?: () => void; style?: string }
type LocalRowView = { id: string; cells: Record<string, string>; badgeTone?: string }

const ok = (data: unknown): ApiResult => ({ success: true, data })
const fail = (error: string, status?: number): ApiResult => ({ success: false, error, status })
/**
 * 「当日业务日」用**独立算法**量:直接问 Intl 要 Asia/Shanghai 的年月日,
 * 不抄屏内那句 `Date.now()+8*3600_000`(抄同一把尺子就量不出它弯了,AGENTS §22c)。
 */
const shanghaiDay = (at: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
const todayShanghai = (): string => shanghaiDay(new Date())
/** 上一个业务日:跨日行用例的输入(必须与当日不同,且逐字是 YYYY-MM-DD) */
const yesterdayShanghai = (): string => shanghaiDay(new Date(Date.now() - 24 * 3600_000))

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const api = vi.hoisted(() => ({
  fetchApi: vi.fn(async (_url: string, _init?: FetchInit): Promise<unknown> => ({
    success: true as const,
    data: { list: [] },
  })),
}))

/** 替身捕获面:断言只读这些记录,不读组件内部状态。 */
const h = vi.hoisted(() => ({
  alerts: [] as Array<{
    title: string
    message?: string
    buttons?: Array<Record<string, unknown>>
  }>,
  tables: [] as Array<Record<string, unknown>>,
  camera: undefined as Record<string, unknown> | undefined,
  navigations: [] as string[],
  goBackCalls: 0,
  permission: { granted: true, status: 'granted', canAskAgain: true } as Record<string, unknown>,
  authUser: { user: { id: 'stu-own' } as { id: string } | null },
  authed: true,
}))

vi.mock('@ihui/api-client', () => ({ fetchApi: api.fetchApi }))

// ---- 宿主替身 -----------------------------------------------------------------
vi.mock('react-native', () => {
  const mk = (tag: string) => {
    function HostElement(props: {
      children?: ReactNode
      onPress?: () => void
      [k: string]: unknown
    }) {
      const { style, onPress, children, ...rest } = props
      const flat = (v: unknown): unknown =>
        Array.isArray(v) ? Object.assign({}, ...v.filter(Boolean).map(flat)) : v
      return createElement(tag, { ...rest, onClick: onPress, style: flat(style) }, children)
    }
    return HostElement
  }
  return {
    Appearance: { getColorScheme: () => 'light', addChangeListener: () => ({ remove() {} }) },
    useColorScheme: () => 'light',
    View: mk('div'),
    Text: mk('span'),
    Pressable: mk('button'),
    TouchableOpacity: mk('button'),
    ActivityIndicator: () => createElement('div', null, 'loading'),
    ScrollView: mk('div'),
    Linking: { openSettings: vi.fn(async () => undefined) },
    StyleSheet: {
      create: <T extends object>(s: T) => s,
      flatten: (s: unknown) => s,
      absoluteFill: {},
    },
  }
})

vi.mock('lucide-react-native', () => ({
  QrCode: () => createElement('i', { 'data-icon': 'qr' }),
  ScanLine: () => createElement('i', { 'data-icon': 'scan' }),
  ChevronLeft: () => createElement('i', { 'data-icon': 'chevron' }),
  RefreshCw: () => createElement('i', { 'data-icon': 'refresh' }),
}))

vi.mock('react-native-qrcode-svg', () => ({
  default: (props: { value?: string }) =>
    createElement('div', { 'data-testid': 'qr-code', 'data-value': props.value ?? '' }),
}))

vi.mock('expo-camera', () => ({
  CameraView: (props: Record<string, unknown>) => {
    h.camera = props
    return createElement('div', { 'data-testid': 'camera' })
  },
  useCameraPermissions: () => [h.permission, vi.fn(async () => h.permission)],
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: (name: string) => h.navigations.push(name),
    goBack: () => {
      h.goBackCalls += 1
    },
    addListener: () => () => undefined,
  }),
  // 孩子考勤屏按 route.params.childId 取数 ⇒ 替身给出稳定的那一个
  useRoute: () => ({ params: { childId: 'child-1' } }),
}))

vi.mock('@ihui/ui-native', () => ({
  Tappable: (props: { children?: ReactNode; onPress?: () => void; [k: string]: unknown }) => {
    const { children, onPress, style, ...rest } = props
    // style 可能是 RN 的数组形态;react-dom 只认扁平对象,直接下发会抛「set on proxy」
    const flat = (v: unknown): unknown =>
      Array.isArray(v) ? Object.assign({}, ...v.filter(Boolean).map(flat)) : v
    return createElement('button', { ...rest, onClick: onPress, style: flat(style) }, children)
  },
}))

/**
 * 通用控制台列表屏(真身在 packages/app,渲染面由它自己的套件负责)。
 * 这里只捕获 props + 行点击出口 ⇒ 判的是「考勤屏把哪些数据/回调交给了它」。
 */
vi.mock('@ihui/rn-app', () => ({
  getTokens: () => ({
    surface: { bg: '#ffffff', card: '#fafafa' },
    brand: { cta: '#000000', ctaForeground: '#ffffff' },
    text: { primary: '#111111', secondary: '#666666' },
    border: { light: '#eeeeee' },
    error: { text: '#cc0000' },
    gray: { black: '#000000' },
  }),
  ConsoleTableScreen: (props: Record<string, unknown>) => {
    h.tables.push(props)
    const rows = (props.rows as LocalRowView[] | undefined) ?? []
    const onRowPress = props.onRowPress as ((row: LocalRowView) => void) | undefined
    const onRefresh = props.onRefresh as (() => void) | undefined
    const error = props.error as string | null | undefined
    return createElement(
      'div',
      { 'data-testid': 'console-table' },
      createElement('span', null, String(props.title ?? '')),
      error ? createElement('span', { 'data-testid': 'table-error' }, error) : null,
      props.loading ? createElement('span', { 'data-testid': 'table-loading' }, 'loading') : null,
      rows.map((row) =>
        createElement(
          'button',
          { key: row.id, onClick: () => onRowPress?.(row), 'data-row': row.id },
          Object.entries(row.cells).map(([k, v]) =>
            createElement('span', { key: `${row.id}-${k}`, 'data-cell': k }, v),
          ),
        ),
      ),
      createElement(
        'button',
        { onClick: () => onRefresh?.(), 'data-testid': 'console-refresh' },
        'refresh',
      ),
    )
  },
}))

/** 底部弹层:appAlert 是本端唯一「上屏」通道 ⇒ 必须捕获参数,不真渲染。 */
vi.mock('../src/components/BottomPops', () => ({
  appAlert: (title: string, message?: string, buttons?: AlertButton[]) => {
    h.alerts.push({
      title,
      message,
      buttons: buttons as Array<Record<string, unknown>> | undefined,
    })
  },
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' as const }),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: h.authUser.user }),
}))

// 扫码屏的登录态走 store selector 形态 ⇒ 替身保持「选择器真跑」语义
vi.mock('../src/stores/auth-store', () => ({
  selectIsAuthenticated: (s: { authenticated: boolean }) => s.authenticated,
  useAuthStore: (selector: (s: { authenticated: boolean }) => boolean) =>
    selector({ authenticated: h.authed }),
}))

// 真词包取词;t 必须引用稳定(屏内 load=useCallback([t]),每渲染换新对象会重复取列表 ⇒ 假失败)
vi.mock('../src/i18n', async (importOriginal) => {
  const mod = await importOriginal<typeof I18nModule>()
  const { translate: tr } = await import('@ihui/i18n/loader')
  const zh = mod.messages['zh-CN']
  const t = (key: string, params?: Record<string, string | number>) =>
    tr(zh, key, { params, locale: 'zh-CN' })
  const value = { locale: 'zh-CN' as const, setLocale: async () => undefined, t }
  return { ...mod, useI18n: () => value }
})

import EduAttendanceScreen from '../src/screens/EduAttendanceScreen'
import EduMyAttendanceScreen from '../src/screens/EduMyAttendanceScreen'
import EduChildAttendanceScreen from '../src/screens/EduChildAttendanceScreen'
import {
  EduAttendanceQrScreen,
  EduAttendanceScanScreen,
} from '../src/screens/EduAttendanceQrScreen'

const LIST_URL = '/api/edu-ai-management/attendance'
const LIST_QUERY = `${LIST_URL}?`
const ME_URL = `${LIST_URL}/me`
const CHECK_IN_URL = `${LIST_URL}/check-in`
const CHECK_OUT_URL = `${LIST_URL}/check-out`
const BATCH_URL = `${LIST_URL}/batch-check-in`
const SELF_URL = `${LIST_URL}/self-check-in`
const QR_URL = `${LIST_URL}/qrcode`
const QR_SCAN_URL = `${LIST_URL}/qrcode-check-in`
const CLASS_URL = '/api/edu-ai-management/class'
const CHILD_URL = '/api/edu-ai-management/parent/child/child-1/attendance'

const zhKey = (path: string, params?: Record<string, string | number>): string => {
  const v = translate(messages['zh-CN'], path, { params, locale: 'zh-CN' })
  expect(v, `词包缺 ${path}`).not.toBe(path)
  return v
}

const urls = (): string[] => api.fetchApi.mock.calls.map((c) => String(c[0]))
const callsWith = (url: string): Array<[string, FetchInit | undefined]> =>
  api.fetchApi.mock.calls
    .filter(([u]) => String(u) === url || String(u).startsWith(`${url}?`))
    .map(([u, init]) => [String(u), init as FetchInit | undefined])
/** 列表取数 = 带 query 的那一条;必须与 /attendance/check-in 等写端点严格分开数 */
const listCalls = (): number =>
  api.fetchApi.mock.calls.filter(([u]) => String(u).startsWith(LIST_QUERY)).length
const lastAlert = (): { title: string; message?: string; buttons?: AlertButton[] } => {
  const a = h.alerts.at(-1)
  if (!a) throw new Error('没有任何 appAlert 上屏 ⇒ 尺子失效')
  return a as { title: string; message?: string; buttons?: AlertButton[] }
}
const pressButton = (text: string): void => {
  const btn = lastAlert().buttons?.find((b) => b.text === text)
  if (!btn) throw new Error(`弹层里没有「${text}」按钮:${JSON.stringify(lastAlert().buttons)}`)
  btn.onPress?.()
}
/** 排空一拍微任务 + effect:任何因依赖不稳定而多发的取列表都会在这一拍里现形 */
const settle = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise<void>((r) => queueMicrotask(r))
}
const resetCapture = (): void => {
  h.alerts.length = 0
  h.tables.length = 0
  h.camera = undefined
  h.navigations.length = 0
  h.goBackCalls = 0
  h.authed = true
  h.permission = { granted: true, status: 'granted', canAskAgain: true }
  h.authUser.user = { id: 'stu-own' }
  api.fetchApi.mockReset()
  api.fetchApi.mockImplementation(async () => ok({ list: [] }))
}

/**
 * 教师列表行的默认形态:date = **当前上海业务日**(新契约下代签只认当日),
 * 需要「跨日行」的用例自己覆盖 date ⇒ 每枚行按调用时刻现算,不共用模块加载时的旧读数。
 */
const teacherRow = (over: Record<string, unknown> = {}) => ({
  id: 'rec-1',
  studentId: 'stu-1',
  classId: 'cls-1',
  date: todayShanghai(),
  checkInTime: null,
  checkOutTime: null,
  status: 'absent',
  remark: null,
  ...over,
})
const latestRows = (): LocalRowView[] => (h.tables.at(-1)?.rows as LocalRowView[] | undefined) ?? []
/** 某写端点首次请求的 payload(取不到即尺子失效,不用空对象冒充"没带 status") */
const firstBody = (url: string): Record<string, unknown> => {
  const body = callsWith(url)[0]?.[1]?.body
  if (!body) throw new Error(`${url} 没有请求体 ⇒ 尺子失效`)
  return JSON.parse(body) as Record<string, unknown>
}

describe('考勤屏 · 教师侧 EduAttendanceScreen', () => {
  beforeEach(() => {
    cleanup()
    resetCapture()
  })

  it('① 挂载只发一次取列表,路径与 date 参数逐字正确(UTC+8 业务日)', async () => {
    api.fetchApi.mockImplementation(async () => ok({ list: [teacherRow()] }))
    render(createElement(EduAttendanceScreen))
    await waitFor(() => expect(screen.getByText('stu-1')).toBeTruthy())
    expect(urls()[0]).toBe(`${LIST_URL}?date=${todayShanghai()}`)
    expect(callsWith(LIST_URL)[0]?.[1], '取列表不该带请求选项(方法/请求体)').toBeUndefined()
    await settle()
    expect(api.fetchApi.mock.calls, '挂载期多发了一次取列表').toHaveLength(1)
    expect(screen.getByText(zhKey('eduAttendance.status.absent'))).toBeTruthy()
    // 阳性对照:同一把尺子在真有条目时确实读到了行(上一条不是恒真)
    expect(latestRows()[0]?.cells['student']).toBe('stu-1')
  })

  it('②④⑤ 行操作「签到」= POST check-in,payload 取自服务端行且不含 status;成功后重取列表', async () => {
    api.fetchApi.mockImplementation(async (url) =>
      url.startsWith(LIST_QUERY) ? ok({ list: [teacherRow()] }) : ok({ id: 'rec-1' }),
    )
    render(createElement(EduAttendanceScreen))
    await waitFor(() => expect(screen.getByText('stu-1')).toBeTruthy())
    fireEvent.click(screen.getByText('stu-1'))
    expect(lastAlert().message, '行操作应先弹「选择操作」').toBe(
      zhKey('eduAttendance.chooseAction'),
    )
    pressButton(zhKey('eduAttendance.checkIn'))
    await waitFor(() => expect(callsWith(CHECK_IN_URL).length, '没发出 check-in 请求').toBe(1))
    const [url, init] = callsWith(CHECK_IN_URL)[0]!
    expect(url).toBe(CHECK_IN_URL)
    expect(init?.method).toBe('POST')
    expect(firstBody(CHECK_IN_URL)).toEqual({
      studentId: 'stu-1',
      classId: 'cls-1',
      date: todayShanghai(),
    })
    expect(
      Object.keys(firstBody(CHECK_IN_URL)),
      '状态由服务端按该班规则现算 ⇒ 代签 payload 不得再自报 status',
    ).not.toContain('status')
    expect(lastAlert().message).toBe(zhKey('eduAttendance.actionDone'))
    await waitFor(() => expect(listCalls(), '签到成功后没回读列表').toBe(2))
    expect(callsWith(CHECK_OUT_URL), '签到不该顺带发签退').toHaveLength(0)
  })

  it('②⑤ 签退 = PUT check-out(date 是记录定位键、payload 不含 status);被服务端拒时后端 message 上屏且不重取列表', async () => {
    const reason = '该学生今天还没有签到记录'
    api.fetchApi.mockImplementation(async (url) =>
      url.startsWith(LIST_QUERY) ? ok({ list: [teacherRow()] }) : fail(reason, 400),
    )
    render(createElement(EduAttendanceScreen))
    await waitFor(() => expect(screen.getByText('stu-1')).toBeTruthy())
    fireEvent.click(screen.getByText('stu-1'))
    pressButton(zhKey('eduAttendance.checkOut'))
    await waitFor(() => expect(callsWith(CHECK_OUT_URL).length).toBe(1))
    expect(callsWith(CHECK_OUT_URL)[0]?.[1]?.method).toBe('PUT')
    expect(firstBody(CHECK_OUT_URL)).toEqual({
      studentId: 'stu-1',
      classId: 'cls-1',
      date: todayShanghai(),
    })
    expect(
      Object.keys(firstBody(CHECK_OUT_URL)),
      '签退后状态由服务端重判 ⇒ 端上不得自报 status',
    ).not.toContain('status')
    expect(lastAlert().message, '失败必须把后端 message 原样上屏').toContain(reason)
    expect(lastAlert().message).toContain(zhKey('eduAttendance.actionFailed'))
    expect(listCalls(), '失败不得顺手重取列表冒充刷新').toBe(1)
    // 界面仍是服务端上一次回读的值(没被本地改成「已签退」)
    expect(latestRows()[0]?.cells['status']).toBe(zhKey('eduAttendance.status.absent'))
  })

  it('⑤ 跨日行:代签当场点名并拒发 check-in,同一行的签退照发且带行自己的 date', async () => {
    const stale = yesterdayShanghai()
    api.fetchApi.mockImplementation(async (url) =>
      url.startsWith(LIST_QUERY)
        ? ok({ list: [teacherRow({ date: stale })] })
        : ok({ id: 'rec-1' }),
    )
    render(createElement(EduAttendanceScreen))
    await waitFor(() => expect(screen.getByText('stu-1')).toBeTruthy())
    fireEvent.click(screen.getByText('stu-1'))
    pressButton(zhKey('eduAttendance.checkIn'))
    expect(lastAlert().message).toBe(zhKey('eduAttendance.onlyTodayCheckIn'))
    expect(callsWith(CHECK_IN_URL), '非当日行却发出了代签请求(新契约下必 400)').toHaveLength(0)
    expect(listCalls()).toBe(1)
    // 阳性对照:同一实例上「签退」这一腿没被同一条护栏误伤 ⇒ 上一条的 0 不是恒真
    fireEvent.click(screen.getByText('stu-1'))
    pressButton(zhKey('eduAttendance.checkOut'))
    await waitFor(() => expect(callsWith(CHECK_OUT_URL).length).toBe(1))
    expect(firstBody(CHECK_OUT_URL)).toEqual({
      studentId: 'stu-1',
      classId: 'cls-1',
      date: stale,
    })
  })

  it('⑤ 早退(early)有独立文案与色档:服务端签退重判自此真会产出它', async () => {
    const order = ['present', 'late', 'early', 'absent', 'leave'] as const
    // 期望档位在测试里逐条写死(不 import 屏内映射,否则改成什么它都跟着绿)
    const tones: Record<(typeof order)[number], string> = {
      present: 'ok',
      late: 'warn',
      early: 'warn',
      absent: 'danger',
      leave: 'muted',
    }
    api.fetchApi.mockImplementation(async () =>
      ok({
        list: order.map((s, i) => teacherRow({ id: `rec-${i}`, studentId: `stu-${i}`, status: s })),
      }),
    )
    render(createElement(EduAttendanceScreen))
    await waitFor(() => expect(screen.getByText('stu-2')).toBeTruthy())
    const byId = new Map(latestRows().map((r) => [r.id, r]))
    for (const [i, s] of order.entries()) {
      const row = byId.get(`rec-${i}`)
      if (!row) throw new Error(`第 ${i} 行没被渲染 ⇒ 尺子失效`)
      expect(row.cells['status'], `${s} 未取到词表文案(落回原始协议码)`).toBe(
        zhKey(`eduAttendance.status.${s}`),
      )
      expect(row.badgeTone, `${s} 的色档不是登记的那一档`).toBe(tones[s])
    }
    // 阳性对照:早退与"未知状态"必须不同名(缺词表时它会退化成 'early' 原文)
    expect(zhKey('eduAttendance.status.early')).not.toBe('early')
  })

  it('② 缺 classId 的行:当场点名缺班级并拒发请求(副作用没发生)', async () => {
    api.fetchApi.mockImplementation(async () => ok({ list: [teacherRow({ classId: null })] }))
    render(createElement(EduAttendanceScreen))
    await waitFor(() => expect(screen.getByText('stu-1')).toBeTruthy())
    fireEvent.click(screen.getByText('stu-1'))
    pressButton(zhKey('eduAttendance.checkIn'))
    expect(lastAlert().message).toBe(zhKey('eduAttendance.needClassId'))
    expect(callsWith(CHECK_IN_URL), '缺班级却发出了代签请求').toHaveLength(0)
    expect(listCalls()).toBe(1)
  })

  it('②④⑤ 整班点名成功后重新取列表,回读到达前界面仍是旧值(无乐观更新)', async () => {
    const second = deferred<unknown>()
    let hits = 0
    api.fetchApi.mockImplementation(async (url) => {
      if (url.startsWith(BATCH_URL)) return ok({ created: 1, skipped: 0, missedIds: [] })
      if (url.startsWith(LIST_QUERY)) {
        hits += 1
        return hits === 1 ? ok({ list: [teacherRow()] }) : second.promise
      }
      return ok(null)
    })
    render(createElement(EduAttendanceScreen))
    await waitFor(() => expect(screen.getByText('stu-1')).toBeTruthy())
    fireEvent.click(screen.getByText(zhKey('eduAttendance.batchTitle')))
    pressButton('cls-1')
    await waitFor(() => expect(callsWith(BATCH_URL).length).toBe(1))
    expect(JSON.parse(callsWith(BATCH_URL)[0]![1]?.body ?? '{}')).toEqual({
      classId: 'cls-1',
      date: todayShanghai(),
    })
    expect(
      Object.keys(firstBody(BATCH_URL)),
      '点名状态由服务端现算 ⇒ payload 不得带 status',
    ).not.toContain('status')
    await waitFor(() => expect(listCalls(), '点名后没重新取列表').toBe(2))
    // 第二次取列表尚未回读 ⇒ 界面必须仍是旧状态(本地乐观改状态会在这里翻红)
    expect(latestRows()[0]?.cells['status']).toBe(zhKey('eduAttendance.status.absent'))
    expect(lastAlert().message).toBe(
      zhKey('eduAttendance.batchResult', { created: 1, skipped: 0, missed: 0 }),
    )
    second.resolve(ok({ list: [teacherRow({ status: 'present' })] }))
    await waitFor(() =>
      expect(latestRows()[0]?.cells['status']).toBe(zhKey('eduAttendance.status.present')),
    )
    expect(listCalls()).toBe(2)
  })

  it('④ 无可选班级时拒发点名请求并当场点名(而不是发一个空 classId)', async () => {
    api.fetchApi.mockImplementation(async () => ok({ list: [] }))
    render(createElement(EduAttendanceScreen))
    await waitFor(() => expect(listCalls()).toBe(1))
    fireEvent.click(screen.getByText(zhKey('eduAttendance.batchTitle')))
    expect(lastAlert().message).toBe(zhKey('eduAttendance.noClass'))
    expect(callsWith(BATCH_URL)).toHaveLength(0)
  })

  it('① 二维码入口只做导航,挂载不因它多发请求', async () => {
    api.fetchApi.mockImplementation(async () => ok({ list: [] }))
    render(createElement(EduAttendanceScreen))
    await waitFor(() => expect(listCalls()).toBe(1))
    fireEvent.click(screen.getByText(zhKey('eduAttendance.qrEntry')))
    expect(h.navigations).toEqual(['EduAttendanceQr'])
    expect(api.fetchApi.mock.calls).toHaveLength(1)
  })
})

describe('考勤屏 · 学生本人 EduMyAttendanceScreen', () => {
  beforeEach(() => {
    cleanup()
    resetCapture()
  })

  it('①③ 挂载只发一次 attendance/me;调用方塞进来的 studentId 既不当依据也不上送', async () => {
    api.fetchApi.mockImplementation(async () =>
      ok({ list: [{ ...teacherRow(), studentId: 'stu-own', status: 'present' }] }),
    )
    // 以「调用方能传参」的形态渲染:组件本身不收 props,任何被用掉的 studentId 都会出现在请求里
    const Loose = EduMyAttendanceScreen as unknown as (p: { studentId?: string }) => ReactNode
    render(createElement(Loose, { studentId: 'other-stu-999' }))
    await waitFor(() => expect(callsWith(ME_URL).length).toBe(1))
    expect(urls()[0]).toBe(`${ME_URL}?date=${todayShanghai()}`)
    await settle()
    expect(api.fetchApi.mock.calls, '挂载期多发了一次取列表').toHaveLength(1)
    const wire = JSON.stringify(api.fetchApi.mock.calls)
    expect(wire, '客户端把 studentId 当查询依据 ⇒ 越权面').not.toContain('studentId')
    expect(wire).not.toContain('other-stu-999')
    expect(wire, '身份不得由客户端自报').not.toContain('stu-own')
    // 阳性对照:本人页确实拿到并渲染了服务端回读的行(上一条的 0 不是恒真)
    expect(latestRows()[0]?.cells['status']).toBe(zhKey('eduAttendance.status.present'))
  })

  it('②④⑤ 自签 = POST self-check-in,body 只有当日 date(无 status);成功后回读列表', async () => {
    api.fetchApi.mockImplementation(async (url) =>
      url.startsWith(ME_URL) ? ok({ list: [] }) : ok({ classId: 'cls-1', status: 'late' }),
    )
    render(createElement(EduMyAttendanceScreen))
    await waitFor(() => expect(callsWith(ME_URL).length).toBe(1))
    fireEvent.click(screen.getByText(zhKey('eduMyAttendance.selfCheckIn')))
    await waitFor(() => expect(callsWith(SELF_URL).length).toBe(1))
    expect(callsWith(SELF_URL)[0]?.[1]?.method).toBe('POST')
    expect(firstBody(SELF_URL)).toEqual({ date: todayShanghai() })
    expect(
      Object.keys(firstBody(SELF_URL)),
      '自签状态由服务端现算 ⇒ payload 不得带 status',
    ).not.toContain('status')
    expect(lastAlert().message).toContain(zhKey('eduAttendance.actionDone'))
    expect(lastAlert().message).toContain(zhKey('eduAttendance.status.late'))
    await waitFor(() => expect(callsWith(ME_URL).length, '自签成功后必须回读列表').toBe(2))
  })

  it('⑤ 本人页渲染早退档:与教师屏同一色档、同一词表(不各写一份映射)', async () => {
    api.fetchApi.mockImplementation(async () =>
      ok({ list: [{ ...teacherRow(), studentId: 'stu-own', status: 'early' }] }),
    )
    render(createElement(EduMyAttendanceScreen))
    await waitFor(() => expect(callsWith(ME_URL).length).toBe(1))
    expect(latestRows()[0]?.cells['status']).toBe(zhKey('eduAttendance.status.early'))
    expect(latestRows()[0]?.badgeTone, '早退落到默认档 = 与未知状态同色').toBe('warn')
  })

  it('③ 未登录:一次请求都不发,点自签也不发(而不是拿空身份去试)', async () => {
    h.authUser.user = null
    render(createElement(EduMyAttendanceScreen))
    await waitFor(() => expect(screen.getByText(zhKey('eduMyAttendance.notLoggedIn'))).toBeTruthy())
    expect(api.fetchApi.mock.calls, '未登录仍发了取列表请求').toHaveLength(0)
    fireEvent.click(screen.getByText(zhKey('eduMyAttendance.selfCheckIn')))
    expect(callsWith(SELF_URL)).toHaveLength(0)
    expect(lastAlert().message).toBe(zhKey('eduMyAttendance.notLoggedIn'))
  })

  it('② 学籍取不到(409)时后端 reason 上屏,不静默、不假装成功', async () => {
    const reason = '未找到你在该班的在册学籍'
    api.fetchApi.mockImplementation(async (url) =>
      url.startsWith(ME_URL) ? ok({ list: [] }) : fail(reason, 409),
    )
    render(createElement(EduMyAttendanceScreen))
    await waitFor(() => expect(callsWith(ME_URL).length).toBe(1))
    fireEvent.click(screen.getByText(zhKey('eduMyAttendance.selfCheckIn')))
    await waitFor(() => expect(lastAlert().message).toContain(reason))
    expect(lastAlert().message).toContain(zhKey('eduAttendance.actionFailed'))
    expect(callsWith(ME_URL).length, '失败不得伪装成刷新').toBe(1)
    // 行内容仍是服务端回读的空列表(没被本地塞进一条「已签到」)
    expect(latestRows()).toHaveLength(0)
  })
})

describe('考勤屏 · 家长侧 EduChildAttendanceScreen', () => {
  beforeEach(() => {
    cleanup()
    resetCapture()
  })

  it('①⑤ 取数只按 route 上的 childId;早退档与教师屏同一色档同一词表(四屏同源)', async () => {
    api.fetchApi.mockImplementation(async () =>
      ok({
        list: [
          {
            id: 'rec-1',
            date: '2020-01-02T00:00:00.000Z',
            status: 'early',
            checkInTime: '2020-01-02T01:30:00.000Z',
            checkOutTime: '2020-01-02T06:00:00.000Z',
          },
        ],
      }),
    )
    render(createElement(EduChildAttendanceScreen))
    await waitFor(() => expect(callsWith(CHILD_URL).length).toBe(1))
    expect(urls()[0]).toBe(CHILD_URL)
    await settle()
    expect(api.fetchApi.mock.calls, '挂载期多发了一次请求').toHaveLength(1)
    expect(latestRows()[0]?.cells['date']).toBe('2020-01-02')
    expect(latestRows()[0]?.cells['status']).toBe(zhKey('eduAttendance.status.early'))
    expect(latestRows()[0]?.badgeTone, '早退落到默认档 = 与未知状态同色').toBe('warn')
    expect(latestRows()[0]?.cells['checkOut']).toBe('06:00')
  })
})

describe('考勤屏 · 扫码(EduAttendanceQrScreen / EduAttendanceScanScreen)', () => {
  beforeEach(() => {
    cleanup()
    resetCapture()
  })

  it('① 出码屏挂载只取一次班级清单,未选班绝不预取出码', async () => {
    const payload = JSON.stringify({ type: 'edu-attendance-checkin', token: 'tk-1' })
    api.fetchApi.mockImplementation(async (url) =>
      url === CLASS_URL
        ? ok({ list: [{ id: 'cls-1', name: '一年级', grade: '1 班' }] })
        : url.startsWith(QR_URL)
          ? ok({
              payload,
              classId: 'cls-1',
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              ttlMs: 60_000,
            })
          : ok(null),
    )
    render(createElement(EduAttendanceQrScreen))
    await waitFor(() => expect(callsWith(CLASS_URL).length).toBe(1))
    await settle()
    expect(api.fetchApi.mock.calls, '挂载期多发了一次请求').toHaveLength(1)
    expect(callsWith(QR_URL), '没选班就发了出码请求').toHaveLength(0)
    fireEvent.click(screen.getByText('一年级·1 班'))
    await waitFor(() => expect(callsWith(QR_URL).length).toBe(1))
    expect(urls()[1]).toBe(`${QR_URL}?classId=cls-1`)
    expect(screen.getByTestId('qr-code').getAttribute('data-value')).toBe(payload)
  })

  it('② 出码被拒(400)时后端 message + 下一步原样上屏', async () => {
    const reason = '该班未配置启用中的考勤规则或未设置扫码密钥(qrSecret)'
    api.fetchApi.mockImplementation(async (url) =>
      url === CLASS_URL ? ok({ list: [{ id: 'cls-1', name: '一年级' }] }) : fail(reason, 400),
    )
    render(createElement(EduAttendanceQrScreen))
    await waitFor(() => expect(callsWith(CLASS_URL).length).toBe(1))
    fireEvent.click(screen.getByText('一年级'))
    await waitFor(() => expect(screen.getByText(reason)).toBeTruthy())
    expect(screen.getByText(zhKey('eduAttendanceQr.nextStepHint'))).toBeTruthy()
    expect(screen.queryByTestId('qr-code'), '出码失败却画出了二维码').toBeNull()
  })

  it('①② 扫码屏:非本系统码零上送;有效码只 POST {token},失败 message 上屏', async () => {
    // 失败档:有效码也必须把后端 message 上屏,且不退屏冒充成功
    api.fetchApi.mockImplementation(async () => fail('二维码已过期', 410))
    render(createElement(EduAttendanceScanScreen))
    await waitFor(() => expect(screen.getByTestId('camera')).toBeTruthy())
    const scan1 = h.camera?.onBarcodeScanned as ((d: { data: string }) => void) | undefined
    if (!scan1) throw new Error('相机层没接上 onBarcodeScanned ⇒ 尺子失效')
    scan1({ data: JSON.stringify({ type: 'other-system', token: 'x' }) })
    expect(lastAlert().message).toBe(zhKey('eduAttendanceQr.scanInvalidCode'))
    expect(callsWith(QR_SCAN_URL), '非签到码却被上送 ⇒ 前端替后端做了判定').toHaveLength(0)
    expect(h.goBackCalls).toBe(0)
    // 阳性对照:同一实例点掉提示后,有效码必须真的发出 POST ⇒ 上一条的 0 不是恒真
    pressButton(zhKey('common.confirm'))
    api.fetchApi.mockImplementation(async () => ok({ classId: 'cls-1', status: 'present' }))
    scan1({ data: JSON.stringify({ type: 'edu-attendance-checkin', token: 'tk-9' }) })
    await waitFor(() => expect(callsWith(QR_SCAN_URL).length).toBe(1))
    expect(callsWith(QR_SCAN_URL)[0]?.[1]?.method).toBe('POST')
    expect(JSON.parse(callsWith(QR_SCAN_URL)[0]![1]?.body ?? '{}')).toEqual({ token: 'tk-9' })
    expect(lastAlert().message).toBe(zhKey('eduAttendanceQr.scanDone'))
    expect(h.goBackCalls, '扫码成功后应回上一屏(列表刷新交给 focus 腿)').toBe(1)
    // 后端拒签:换一屏实例重扫,失败 message 必须响
    cleanup()
    h.alerts.length = 0
    h.goBackCalls = 0
    api.fetchApi.mockReset()
    api.fetchApi.mockImplementation(async () => fail('二维码已过期', 410))
    render(createElement(EduAttendanceScanScreen))
    await waitFor(() => expect(h.camera?.onBarcodeScanned).toBeTypeOf('function'))
    ;(h.camera?.onBarcodeScanned as (d: { data: string }) => void)({
      data: JSON.stringify({ type: 'edu-attendance-checkin', token: 'tk-8' }),
    })
    await waitFor(() => expect(lastAlert().message).toContain('二维码已过期'))
    expect(lastAlert().message).toContain(zhKey('eduAttendanceQr.scanFailed'))
    expect(h.goBackCalls, '失败不得当成成功退出相机').toBe(0)
  })

  it('① 扫码屏未登录时不开相机、不发任何请求', async () => {
    h.authed = false
    render(createElement(EduAttendanceScanScreen))
    await waitFor(() => expect(screen.getByText(zhKey('eduAttendanceQr.needLogin'))).toBeTruthy())
    expect(api.fetchApi.mock.calls).toHaveLength(0)
    expect(screen.queryByTestId('camera')).toBeNull()
  })
})

describe('考勤屏 · 导航登记', () => {
  it('四屏在 RootNavigator 各登记一次(名字与组件逐字对得上)', () => {
    // 路径推导照抄既有机制(session-expiry-navigation / agent-collect-thumbs-paths):
    // 由本文件位置推导,不硬编码绝对路径、不信 cwd
    const src = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        'src',
        'navigation',
        'RootNavigator.tsx',
      ),
      'utf8',
    )
    for (const [name, comp] of [
      ['EduAttendance', 'EduAttendanceScreen'],
      ['EduMyAttendance', 'EduMyAttendanceScreen'],
      ['EduAttendanceQr', 'EduAttendanceQrScreen'],
      ['EduAttendanceScan', 'EduAttendanceScanScreen'],
    ]) {
      const hits = src.match(
        new RegExp(`<RootStack\\.Screen name="${name}" component={${comp}} />`, 'g'),
      )
      expect(hits ?? [], `${name} 应恰好登记一次`).toHaveLength(1)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
