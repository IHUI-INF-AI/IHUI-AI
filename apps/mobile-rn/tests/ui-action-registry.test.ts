// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端 agent-control 执行注册表单测(2026-09-21 立)。
 *
 * 关注点是"契约面"而非渲染:navigate 白名单、必填参数点名、命令白名单不含破坏性动作、
 * 未知动作回 UNSUPPORTED_ACTION、read/describe 的凭据打码。
 * 真机行为(react-navigation 是否真的换页、主题是否真的翻牌)由单测覆盖不到,见交付报告。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** navigationRef 由 mock 的容器 ref 顶替:可断言调用参数,也可控制"未就绪"分支 */
const nav = vi.hoisted(() => ({
  calls: [] as Array<{ name: string; params?: Record<string, unknown> }>,
  ready: true,
  route: undefined as { name: string; key?: string; params?: Record<string, unknown> } | undefined,
  rootState: undefined as unknown,
}))

vi.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: () => nav.ready,
    getCurrentRoute: () => nav.route,
    getRootState: () => nav.rootState,
    canGoBack: () => true,
    navigate: (name: string, params?: Record<string, unknown>) => {
      nav.calls.push({ name, params })
    },
  }),
}))

import { themeStore } from '../src/context/ThemeContext'
import {
  buildRnUiSnapshot,
  configureRnUiBridge,
  executeRnUiAction,
  maskParams,
  readCurrentRoute,
  readRouteStack,
  resetRnUiBridge,
  resolveRoute,
} from '../src/lib/ui-action-registry'

const destructiveIds = [
  'auth:logout',
  'account:cancel',
  'cache:clear',
  'pay:submit',
  'order:refund',
]

beforeEach(() => {
  nav.calls = []
  nav.ready = true
  nav.route = { name: 'Wallet', key: 'wallet-1' }
  nav.rootState = { routes: [{ name: 'Wallet', key: 'wallet-1' }], index: 0 }
  configureRnUiBridge({ isAuthed: () => true })
})

describe('executeRnUiAction — describe', () => {
  it('返回 AppUiSnapshot 的确切形状(version/screen/routes/commands/authed)', async () => {
    const res = await executeRnUiAction('describe', {})
    expect(res.ok).toBe(true)
    const registry = res.data?.registry as Record<string, unknown>
    expect(registry.version).toBe(1)
    expect(registry.authed).toBe(true)
    expect(Object.keys(registry).sort()).toEqual([
      'authed',
      'commands',
      'routes',
      'screen',
      'version',
    ])
    expect(registry.screen).toMatchObject({ name: 'Wallet', key: 'wallet-1' })
  })

  it('routes 每条只有 name/requiresParams/tab 三字段,且白名单非空', async () => {
    const registry = buildRnUiSnapshot()
    expect(registry.routes.length).toBeGreaterThan(100)
    for (const route of registry.routes) {
      expect(Object.keys(route).sort()).toEqual(['name', 'requiresParams', 'tab'])
      expect(typeof route.name).toBe('string')
    }
    expect(registry.routes.some((r) => r.name === 'Wallet')).toBe(true)
    expect(registry.routes.find((r) => r.name === 'HomeMain')?.tab).toBe(true)
  })

  it('authed=false 时如实告诉模型当前可用面收窄', () => {
    configureRnUiBridge({ isAuthed: () => false })
    expect(buildRnUiSnapshot().authed).toBe(false)
    resetRnUiBridge()
    expect(buildRnUiSnapshot().authed).toBe(false)
  })

  it('动作面只有 describe/navigate/read/invoke,不存在 click/fill/submit', async () => {
    for (const action of ['click', 'fill', 'submit'] as const) {
      const res = await executeRnUiAction(action as 'describe', {})
      expect(res.ok).toBe(false)
      expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
    }
    expect(nav.calls).toHaveLength(0)
  })
})

describe('executeRnUiAction — read', () => {
  it('读出当前激活路径与栈,参数经打码', async () => {
    nav.route = { name: 'CourseDetail', key: 'c-1', params: { id: '9', accessToken: 'secret' } }
    nav.rootState = {
      routes: [{ name: 'CourseDetail', key: 'c-1', params: {} }],
      index: 0,
    }
    const res = await executeRnUiAction('read', {})
    const data = res.data as Record<string, unknown>
    expect(data.stack).toEqual(['CourseDetail'])
    expect(data.url).toBe('CourseDetail')
    expect((data.screen as { params: Record<string, unknown> }).params).toEqual({
      id: '9',
      accessToken: '***',
    })
  })

  it('嵌套容器的栈按 index 逐层取激活路由', () => {
    nav.rootState = {
      routes: [{ name: 'Main', state: { routes: [{ name: 'AiMain' }], index: 0 } }],
      index: 0,
    }
    expect(readRouteStack()).toEqual(['Main', 'AiMain'])
  })

  it('容器未就绪时返回空路由而不是抛错', () => {
    nav.ready = false
    expect(readCurrentRoute()).toEqual({ name: '', key: null, params: {} })
    expect(readRouteStack()).toEqual([])
  })
})

describe('maskParams', () => {
  it('凭据/PII 键打码,对象与回调只回传 [complex],null/undefined 归一为空串', () => {
    const masked = maskParams({
      uuid: 'abc',
      phone: '13800000000',
      title: '张三',
      onPickTopic: () => undefined,
      nested: { a: 1 },
      nothing: null,
    })
    expect(masked.uuid).toBe('***')
    expect(masked.phone).toBe('***')
    expect(masked.title).toBe('张三')
    expect(masked.onPickTopic).toBe('[complex]')
    expect(masked.nested).toBe('[complex]')
    expect(masked.nothing).toBe('')
  })
})

describe('executeRnUiAction — navigate', () => {
  it('白名单外的目标一律 ROUTE_NOT_ALLOWED', async () => {
    const res = await executeRnUiAction('navigate', { name: 'NopeScreen' })
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('ROUTE_NOT_ALLOWED')
    expect(nav.calls).toHaveLength(0)
  })

  it('缺 name / 空串也按 ROUTE_NOT_ALLOWED 回,不去猜', async () => {
    expect((await executeRnUiAction('navigate', {})).errorCode).toBe('ROUTE_NOT_ALLOWED')
    expect((await executeRnUiAction('navigate', { name: '   ' })).errorCode).toBe(
      'ROUTE_NOT_ALLOWED',
    )
  })

  it('容忍模型按 web 习惯写成 /wallet 或 wallet(大小写与首斜杠不改变语义)', async () => {
    await executeRnUiAction('navigate', { name: '/wallet' })
    await executeRnUiAction('navigate', { name: 'WALLET' })
    expect(nav.calls.map((c) => c.name)).toEqual(['Wallet', 'Wallet'])
  })

  it('必填参数页缺参数时点名缺哪个键', async () => {
    const res = await executeRnUiAction('navigate', { name: 'CourseDetail' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('CourseDetail')
    expect(res.error).toContain('id')
    expect(nav.calls).toHaveLength(0)
  })

  it('补齐 args 后按 navigate(name, args) 执行', async () => {
    const res = await executeRnUiAction('navigate', {
      name: 'CourseDetail',
      args: { id: '9' },
    })
    expect(res.ok).toBe(true)
    expect(nav.calls).toEqual([{ name: 'CourseDetail', params: { id: '9' } }])
    expect((res.data as Record<string, unknown>).navigatedTo).toBe('CourseDetail')
  })

  it('tab 子路由走 Main 嵌套参数,而不是在 RootStack 上另开一份', async () => {
    const res = await executeRnUiAction('navigate', { name: 'HomeMain' })
    expect(res.ok).toBe(true)
    expect(nav.calls).toEqual([{ name: 'Main', params: { screen: 'HomeMain' } }])
    expect((res.data as Record<string, unknown>).via).toBe('Main.nested')
  })

  it('无参页面不传 params(undefined 而非空对象,避免污染路由参数)', async () => {
    await executeRnUiAction('navigate', { name: 'Wallet' })
    expect(nav.calls).toEqual([{ name: 'Wallet', params: undefined }])
  })

  it('容器未就绪时如实 EXECUTION_FAILED,不回假成功', async () => {
    nav.ready = false
    const res = await executeRnUiAction('navigate', { name: 'Wallet' })
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('EXECUTION_FAILED')
    expect(nav.calls).toHaveLength(0)
  })
})

describe('executeRnUiAction — invoke', () => {
  it('只调已登记命令,未登记的回 UNSUPPORTED_ACTION 并列出可用项', async () => {
    const res = await executeRnUiAction('invoke', { name: 'theme:nope' })
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
    expect(res.error).toContain('theme:light')
  })

  it('主题三档真的落到 themeStore', async () => {
    const spy = vi.spyOn(themeStore.getState(), 'setTheme')
    for (const [id, theme] of [
      ['theme:light', 'light'],
      ['theme:dark', 'dark'],
      ['theme:system', 'system'],
    ] as const) {
      spy.mockClear()
      const res = await executeRnUiAction('invoke', { name: id })
      expect(res.ok).toBe(true)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(theme)
      expect((res.data as Record<string, unknown>).invoked).toBe(id)
    }
  })

  it('nav:home 用 Main/HomeMain 嵌套跳转兜住"回首页"的坑', async () => {
    const res = await executeRnUiAction('invoke', { name: 'nav:home' })
    expect(res.ok).toBe(true)
    expect(nav.calls).toEqual([{ name: 'Main', params: { screen: 'HomeMain' } }])
  })

  it('破坏性动作一律不在白名单内(退出登录/注销/支付/清缓存)', async () => {
    const ids = buildRnUiSnapshot().commands.map((c) => c.id)
    for (const destructive of destructiveIds) {
      expect(ids).not.toContain(destructive)
      expect((await executeRnUiAction('invoke', { name: destructive })).errorCode).toBe(
        'UNSUPPORTED_ACTION',
      )
    }
  })

  it('命令不吃参数:传了 args 也只回 argsIgnored,不静默解释', async () => {
    const res = await executeRnUiAction('invoke', {
      name: 'theme:dark',
      args: { mode: 'light' },
    })
    expect((res.data as Record<string, unknown>).argsIgnored).toBe(true)
    expect((res.data as Record<string, unknown>).theme).toBe('dark')
  })

  it('describe 的 commands 与实际可调用集合一致', async () => {
    const described = buildRnUiSnapshot()
      .commands.map((c) => c.id)
      .sort()
    expect(described).toEqual(['nav:home', 'theme:dark', 'theme:light', 'theme:system'])
  })
})

describe('resolveRoute', () => {
  it('白名单命中返回条目本身,未命中返回 null', () => {
    expect(resolveRoute('Wallet')?.name).toBe('Wallet')
    expect(resolveRoute('')).toBeNull()
    expect(resolveRoute('../../etc/passwd')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
