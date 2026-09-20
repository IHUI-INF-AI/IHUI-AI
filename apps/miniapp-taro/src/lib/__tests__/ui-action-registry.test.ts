// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端 AI UI 控制注册表单测(2026-09-21 立)。
 *
 * 环境是 vitest node(见 vitest.config.ts),因此 @tarojs/taro 与 @/lib/theme 全部 mock:
 * 断言的是"调了哪个导航 API、参数是什么、失败回执是什么错误码",不依赖真机路由栈。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AppUiSnapshot } from '@ihui/types'

interface MockRouter {
  path: string
  params?: Record<string, unknown>
}

const mocks = vi.hoisted(() => ({
  navigateTo: vi.fn(() => Promise.resolve({})),
  // switchTab / pageScrollTo 带形参类型:断言时才能从 mock.calls 读出实参
  switchTab: vi.fn((arg: { url: string }) => Promise.resolve(arg)),
  reLaunch: vi.fn(() => Promise.resolve({})),
  pageScrollTo: vi.fn((arg: { scrollTop: number; duration: number }) => Promise.resolve(arg)),
  // 页面栈:栈顶 = 带 query 的分包页,专门验证 read/describe 的取值与打码
  stack: [] as unknown[],
  // 页面栈为空时的回落来源(Taro.getCurrentInstance().router),由用例按需注入
  router: undefined as { path: string; params?: Record<string, unknown> } | undefined,
  setThemePreference: vi.fn((preference: string) => (preference === 'auto' ? 'light' : preference)),
}))

vi.mock('@tarojs/taro', () => {
  const Taro = {
    navigateTo: mocks.navigateTo,
    switchTab: mocks.switchTab,
    reLaunch: mocks.reLaunch,
    pageScrollTo: mocks.pageScrollTo,
    getCurrentPages: () => mocks.stack,
    getCurrentInstance: (): { router?: MockRouter } => ({ router: mocks.router }),
    eventCenter: { trigger: vi.fn(), on: vi.fn(), off: vi.fn() },
  }
  return { default: Taro, ...Taro }
})

vi.mock('@/lib/theme', () => ({
  setThemePreference: mocks.setThemePreference,
}))

import {
  buildTaroUiSnapshot,
  configureTaroUiBridge,
  executeTaroUiAction,
  maskParams,
  normalizeRoutePath,
  readCurrentPage,
  resetTaroUiBridge,
} from '../ui-action-registry'
import { TARO_UI_ROUTES } from '@/constants/ui-routes.generated'

const TAB_PAGE = '/pages/user/index'
const PLAIN_PAGE = '/pages/login/login'
const SUB_PACKAGE_PAGE = '/pkg-ai/ai/chat'

function routeOf(path: string) {
  const route = TARO_UI_ROUTES.find((item) => item.path === path)
  if (!route) throw new Error(`生成清单缺少页面 ${path},先跑 pnpm gen:ui-routes`)
  return route
}

function setStackTop(route: string, options?: Record<string, unknown>): void {
  mocks.stack.length = 0
  mocks.stack.push({ route, options: options ?? {} })
}

beforeEach(() => {
  vi.clearAllMocks()
  setStackTop(PLAIN_PAGE)
  mocks.router = undefined
  configureTaroUiBridge({ isAuthed: () => true })
})

describe('navigate —— 必须按页面类型选对 Taro 导航 API', () => {
  it('tabBar 页走 switchTab,绝不 navigateTo(navigateTo 打 tab 页必然失败)', async () => {
    const result = await executeTaroUiAction('navigate', { name: TAB_PAGE })
    expect(result.ok).toBe(true)
    expect(mocks.switchTab).toHaveBeenCalledWith({ url: TAB_PAGE })
    expect(mocks.navigateTo).not.toHaveBeenCalled()
    expect(result.data?.via).toBe('switchTab')
  })

  it('普通页走 navigateTo,并把 args 拼成 query', async () => {
    const result = await executeTaroUiAction('navigate', {
      name: '/pkg-about/about/help',
      args: { from: 'ai', n: 1 },
    })
    expect(result.ok).toBe(true)
    expect(mocks.navigateTo).toHaveBeenCalledWith({
      url: '/pkg-about/about/help?from=ai&n=1',
    })
    expect(mocks.switchTab).not.toHaveBeenCalled()
  })

  it('name 不带前导斜杠也认(Taro 两种写法都合法)', async () => {
    const result = await executeTaroUiAction('navigate', { name: 'pages/login/login' })
    expect(result.ok).toBe(true)
    expect(mocks.navigateTo).toHaveBeenCalledWith({ url: PLAIN_PAGE })
  })

  it('未命中白名单 → ROUTE_NOT_ALLOWED,且不触发任何导航', async () => {
    const result = await executeTaroUiAction('navigate', { name: '/pages/../../etc/passwd' })
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('ROUTE_NOT_ALLOWED')
    expect(mocks.navigateTo).not.toHaveBeenCalled()
    expect(mocks.switchTab).not.toHaveBeenCalled()
    expect(mocks.reLaunch).not.toHaveBeenCalled()
  })

  it('缺少 name / 空 name → ROUTE_NOT_ALLOWED', async () => {
    expect((await executeTaroUiAction('navigate', {})).errorCode).toBe('ROUTE_NOT_ALLOWED')
    expect((await executeTaroUiAction('navigate', { name: '  ' })).errorCode).toBe(
      'ROUTE_NOT_ALLOWED',
    )
  })

  it('分包页必须用全路径才能命中(root + page)', async () => {
    expect(routeOf(SUB_PACKAGE_PAGE).subPackageRoot).toBe('pkg-ai')
    const full = await executeTaroUiAction('navigate', { name: SUB_PACKAGE_PAGE })
    expect(full.ok).toBe(true)
    expect(mocks.navigateTo).toHaveBeenCalledWith({ url: SUB_PACKAGE_PAGE })
    // 只给分包内的相对页 → 不在白名单
    const short = await executeTaroUiAction('navigate', { name: '/ai/chat' })
    expect(short.errorCode).toBe('ROUTE_NOT_ALLOWED')
  })

  it('switchTab 不收 query:name 自带的 query 被丢弃并如实回传 droppedQuery', async () => {
    const result = await executeTaroUiAction('navigate', { name: `${TAB_PAGE}?tab=1` })
    expect(result.ok).toBe(true)
    expect(mocks.switchTab).toHaveBeenCalledWith({ url: TAB_PAGE })
    expect(result.data?.droppedQuery).toBe('tab=1')
  })

  it('restart=true → reLaunch(需要重启页面栈的场景)', async () => {
    const result = await executeTaroUiAction('navigate', { name: TAB_PAGE, restart: true })
    expect(result.ok).toBe(true)
    expect(mocks.reLaunch).toHaveBeenCalledWith({ url: TAB_PAGE })
    expect(mocks.switchTab).not.toHaveBeenCalled()
    expect(result.data?.via).toBe('reLaunch')
  })

  it('导航失败如实回执 EXECUTION_FAILED + 平台 errMsg,不做静默重定向', async () => {
    mocks.navigateTo.mockRejectedValueOnce({ errMsg: 'navigateTo:fail page limit' })
    const result = await executeTaroUiAction('navigate', { name: PLAIN_PAGE })
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('EXECUTION_FAILED')
    expect(result.error).toContain('navigateTo:fail page limit')
  })
})

describe('describe —— data.registry 复用 AppUiSnapshot 结构', () => {
  it('routes 与生成清单同集合,tab/requiresParams 字段照实反映', async () => {
    const result = await executeTaroUiAction('describe', {})
    const registry = result.data?.registry as AppUiSnapshot | undefined
    expect(registry).toBeDefined()
    expect(registry?.version).toBe(1)
    expect(registry?.routes).toHaveLength(TARO_UI_ROUTES.length)
    expect(registry?.routes.find((r) => r.name === TAB_PAGE)).toEqual({
      name: TAB_PAGE,
      requiresParams: routeOf(TAB_PAGE).requiresParams,
      tab: true,
    })
    expect(registry?.routes.find((r) => r.name === SUB_PACKAGE_PAGE)?.tab).toBe(false)
    expect(registry?.screen.name).toBe(PLAIN_PAGE)
    expect(registry?.authed).toBe(true)
  })

  it('未注入 isAuthed(桥层未起)时 authed=false,不谎报可用面', () => {
    resetTaroUiBridge()
    expect(buildTaroUiSnapshot().authed).toBe(false)
  })

  it('快照里不出现 token / 手机号等敏感值', () => {
    setStackTop(SUB_PACKAGE_PAGE, {
      id: '42',
      token: 'eyJrealaccesstoken',
      auth_code: 'sms123456',
      phone: '13800138000',
    })
    const json = JSON.stringify(buildTaroUiSnapshot())
    expect(json).not.toContain('eyJrealaccesstoken')
    expect(json).not.toContain('13800138000')
    expect(json).not.toContain('sms123456')
    expect(json).toContain('"id":"42"')
  })
})

describe('read —— 当前页路由 + navigationBarTitleText 标题', () => {
  it('标题取自页面 config(生成清单),不是猜的', async () => {
    setStackTop('/pkg-user/user/feedback')
    const result = await executeTaroUiAction('read', {})
    const screen = result.data?.screen as Record<string, unknown>
    expect(screen.name).toBe('/pkg-user/user/feedback')
    expect(screen.title).toBe(routeOf('/pkg-user/user/feedback').title)
    expect(screen.title).toBe('意见反馈')
  })

  it('未知路由(理论上不该出现)回落 app window 标题', () => {
    setStackTop('/pages/not-in-manifest/index')
    const page = readCurrentPage()
    expect(page.path).toBe('/pages/not-in-manifest/index')
    expect(page.title).toBe('智汇AI')
  })

  it('参数键含 token/password/secret/code 的值一律打码', async () => {
    setStackTop(SUB_PACKAGE_PAGE, {
      id: '9',
      token: 'T-SECRET',
      password: 'P-SECRET',
      apiSecret: 'S-SECRET',
      smsCode: 'C-SECRET',
      nested: { a: 1 },
      empty: undefined,
    })
    const result = await executeTaroUiAction('read', {})
    const screen = result.data?.screen as { params: Record<string, unknown> }
    expect(screen.params).toEqual({
      id: '9',
      token: '***',
      password: '***',
      apiSecret: '***',
      smsCode: '***',
      nested: '[complex]',
      empty: '',
    })
  })

  it('maskParams 保留原始类型值,并对 PII 键打码', () => {
    expect(maskParams({ page: 2, phone: '13800138000', email: 'a@b.c' })).toEqual({
      page: 2,
      phone: '***',
      email: '***',
    })
  })

  it('页面栈为空时回落 Taro.getCurrentInstance().router', async () => {
    mocks.stack.length = 0
    mocks.router = { path: 'pkg-ai/ai/history', params: { from: 'stack-empty' } }
    const result = await executeTaroUiAction('read', {})
    const screen = result.data?.screen as Record<string, unknown>
    expect(screen.name).toBe('/pkg-ai/ai/history')
    expect(screen.title).toBe('对话历史')
    expect(screen.params).toEqual({ from: 'stack-empty' })
  })
})

describe('invoke —— 白名单 = 外观 + tab 导航 + 页面命令,破坏性动作永不暴露', () => {
  it('theme:light/dark/auto 分别调 setThemePreference', async () => {
    for (const [id, preference] of [
      ['theme:light', 'light'],
      ['theme:dark', 'dark'],
      ['theme:auto', 'auto'],
    ] as const) {
      mocks.setThemePreference.mockClear()
      const result = await executeTaroUiAction('invoke', { name: id })
      expect(result.ok).toBe(true)
      expect(mocks.setThemePreference).toHaveBeenCalledWith(preference)
      expect(result.data?.invoked).toBe(id)
    }
  })

  it('主题必须走 setThemePreference(内部同步原生导航栏/tabBar 配色)', async () => {
    await executeTaroUiAction('invoke', { name: 'theme:dark' })
    expect(mocks.setThemePreference).toHaveBeenCalledTimes(1)
  })

  it('每个 tab 命令都走 switchTab 且 url 不带 query(navigateTo 打 tab 页必然失败)', async () => {
    const tabCommands = ['tab:home', 'tab:agent', 'tab:square', 'tab:mine', 'tab:share']
    for (const id of tabCommands) {
      mocks.switchTab.mockClear()
      mocks.navigateTo.mockClear()
      mocks.reLaunch.mockClear()
      const result = await executeTaroUiAction('invoke', { name: id })
      expect(result.ok, id).toBe(true)
      expect(mocks.switchTab, id).toHaveBeenCalledTimes(1)
      expect(mocks.navigateTo, id).not.toHaveBeenCalled()
      expect(mocks.reLaunch, id).not.toHaveBeenCalled()
      const lastCall = mocks.switchTab.mock.calls.at(0)
      expect(lastCall, `${id} 未触发 switchTab`).toBeDefined()
      const url = lastCall?.[0].url ?? ''
      expect(url.startsWith('/'), id).toBe(true)
      expect(url.includes('?'), id).toBe(false)
      // 命令必须落在真 tab 页上:app.config.ts 一变(不再是 tab)这里就会红
      const route = TARO_UI_ROUTES.find((item) => item.path === url)
      expect(route?.tab, `${id} → ${url} 不是 tab 页`).toBe(true)
      expect(result.data?.invoked).toBe(id)
      expect(result.data?.via).toBe('switchTab')
    }
  })

  it('tab 命令幂等:连续两次切同一 tab 只是重复 switchTab,不叠页面栈', async () => {
    await executeTaroUiAction('invoke', { name: 'tab:mine' })
    await executeTaroUiAction('invoke', { name: 'tab:mine' })
    expect(mocks.switchTab).toHaveBeenCalledTimes(2)
    expect(mocks.navigateTo).not.toHaveBeenCalled()
  })

  it('page:top 调 Taro.pageScrollTo 滚回顶部', async () => {
    const result = await executeTaroUiAction('invoke', { name: 'page:top' })
    expect(result.ok).toBe(true)
    expect(mocks.pageScrollTo).toHaveBeenCalledWith(expect.objectContaining({ scrollTop: 0 }))
    expect(result.data?.scrolledTo).toBe('top')
  })

  it('平台 API 失败必须如实回执 EXECUTION_FAILED(await 生效,不得报假成功)', async () => {
    mocks.switchTab.mockRejectedValueOnce({ errMsg: 'switchTab:fail can not find page' })
    const result = await executeTaroUiAction('invoke', { name: 'tab:square' })
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('EXECUTION_FAILED')
    expect(result.error).toContain('switchTab:fail can not find page')

    mocks.pageScrollTo.mockRejectedValueOnce({ errMsg: 'pageScrollTo:fail' })
    const scrolled = await executeTaroUiAction('invoke', { name: 'page:top' })
    expect(scrolled.errorCode).toBe('EXECUTION_FAILED')
  })

  it('不在白名单 → UNSUPPORTED_ACTION,且回执列出可用项', async () => {
    const result = await executeTaroUiAction('invoke', { name: 'cache:clear' })
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('UNSUPPORTED_ACTION')
    expect(result.error).toContain('theme:light')
    expect(result.error).toContain('tab:home')
    expect(result.error).toContain('page:top')
  })

  it('退出登录 / 注销 / 清缓存一类不可逆命令一律不可调用', async () => {
    for (const name of [
      'logout',
      'auth:logout',
      'cmd:logout',
      'account-cancel',
      'account:cancel',
      'cache:clear',
      'pay:confirm',
      'withdraw',
      'lang:en',
      'locale:en',
      'language:switch',
    ]) {
      const result = await executeTaroUiAction('invoke', { name })
      expect(result.errorCode, name).toBe('UNSUPPORTED_ACTION')
    }
    // 语言切换刻意不进白名单(setLocale 只在 I18nProvider 内生效,模块级调用是假成功)
    expect(mocks.setThemePreference).not.toHaveBeenCalled()
  })

  it('describe 的 commands 与实际可调用集合一致,且不含登出/注销语义', () => {
    const snapshot = buildTaroUiSnapshot()
    expect(snapshot.commands.map((c) => c.id)).toEqual([
      'theme:light',
      'theme:dark',
      'theme:auto',
      'tab:home',
      'tab:agent',
      'tab:square',
      'tab:mine',
      'tab:share',
      'page:top',
    ])
    for (const command of snapshot.commands) {
      expect(command.label, command.id).toBeTruthy()
      expect(['appearance', 'navigation', 'page'], command.id).toContain(command.group)
    }
    const json = JSON.stringify(snapshot.commands).toLowerCase()
    expect(json).not.toMatch(/logout|sign-?out|注销|退出登录|cancel-account/)
  })

  it('命令自带 args 时明确告知被忽略(不假装执行了参数)', async () => {
    const result = await executeTaroUiAction('invoke', {
      name: 'theme:dark',
      args: { level: 3 },
    })
    expect(result.ok).toBe(true)
    expect(result.data?.argsIgnored).toBe(true)
  })
})

describe('未知 action 与异常兜底', () => {
  it('协议外动作 → UNSUPPORTED_ACTION(不抛给桥层)', async () => {
    const result = await executeTaroUiAction('click' as never, { target: 'btn' })
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('UNSUPPORTED_ACTION')
  })

  it('注册表内部抛错 → EXECUTION_FAILED(桥层拿到的永远是结构化结果)', async () => {
    mocks.switchTab.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const result = await executeTaroUiAction('navigate', { name: TAB_PAGE })
    expect(result.errorCode).toBe('EXECUTION_FAILED')
    expect(result.error).toContain('boom')
  })
})

describe('normalizeRoutePath', () => {
  it('补前导斜杠 + 去首尾空白,空串仍为空', () => {
    expect(normalizeRoutePath('pages/index/index')).toBe('/pages/index/index')
    expect(normalizeRoutePath('  /pages/index/index  ')).toBe('/pages/index/index')
    expect(normalizeRoutePath('')).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
