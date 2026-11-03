// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const taro = vi.hoisted(() => ({
  showToast: vi.fn(),
  switchTab: vi.fn(),
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  navigateBack: vi.fn(),
  getCurrentPages: vi.fn(() => [{}, {}]),
  getCurrentInstance: vi.fn(() => ({ page: null, router: { path: '', params: {} } })),
}))

// navigation.tsx 只在函数体内取 Taro;这里钉住模块面,顺带证明 import 期不触碰运行时
vi.mock('@tarojs/taro', () => ({
  default: taro,
  useDidShow: vi.fn(),
  useDidHide: vi.fn(),
  useUnload: vi.fn(),
}))

import { RN_ROUTE_MAP } from './route-map.generated'
import { MINI_TAB_PAGE_LIST } from '../constants/tab-bar-pages'
import {
  buildRoutePath,
  createCompatNavigation,
  createFocusEffectController,
  emitNavigationFailure,
  getNavigationState,
  getPageParams,
  MINI_TAB_PATHS,
  onNavigationFailure,
  readCarrierParams,
  releaseCarrierParams,
  resolveNavigationAction,
  setPageParams,
  subscribePageParams,
  switchTabIfNeeded,
  type NavigationFailure,
} from './navigation'

/** 取一条真实登记(生成物第 1 条),避免把测试写死到某个会随生成器漂移的路由名 */
const [ROUTE_NAME, ROUTE_PATH] = Object.entries(RN_ROUTE_MAP)[0] ?? ['', '']

afterEach(() => {
  vi.useRealTimers()
})

describe('buildRoutePath', () => {
  it('未登记路由 ⇒ null(绝不猜目标页)', () => {
    expect(buildRoutePath('NotRegisteredAnywhere')).toBeNull()
  })

  it('无参数 ⇒ 裸路径,不带 ?', () => {
    expect(buildRoutePath(ROUTE_NAME)).toBe(ROUTE_PATH)
    expect(buildRoutePath(ROUTE_NAME, {})).toBe(ROUTE_PATH)
  })

  it('标量进 query:数字/布尔原样,字符串 encode,null/undefined 丢弃', () => {
    const url = buildRoutePath(ROUTE_NAME, {
      id: 42,
      flag: false,
      word: 'a b&c',
      gone: undefined,
      none: null,
    })
    expect(url).not.toBeNull()
    const query = url!.split('?')[1]
    expect(query).toContain('id=42')
    expect(query).toContain('flag=false')
    expect(query).toContain('word=a%20b%26c')
    expect(query).not.toContain('gone')
    expect(query).not.toContain('none')
  })

  it('对象/数组进内存通道($rp),URL 只带令牌', () => {
    const item = { sku: 'k1', tags: ['a', 'b'] }
    const list = [1, 2, 3]
    const url = buildRoutePath(ROUTE_NAME, { id: 9, item, list })
    expect(url).not.toBeNull()
    const query = url!.split('?')[1] ?? ''
    const token = new URLSearchParams(query).get('$rp')
    expect(token).toBeTruthy()
    expect(query).toContain('id=9')
    expect(query).not.toContain('object')
    expect(readCarrierParams(token)).toEqual({ item, list })
  })

  it('readCarrierParams:未知/空/非字符串令牌 ⇒ null(参数不完整由调用方降级)', () => {
    expect(readCarrierParams(undefined)).toBeNull()
    expect(readCarrierParams(null)).toBeNull()
    expect(readCarrierParams('')).toBeNull()
    expect(readCarrierParams(123)).toBeNull()
    expect(readCarrierParams('rp-does-not-exist')).toBeNull()
  })

  it('通道 TTL:超时后令牌失效(不把上一页的参数留在进程里)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const url = buildRoutePath(ROUTE_NAME, { item: { a: 1 } })
    const token = new URLSearchParams(url!.split('?')[1] ?? '').get('$rp')
    expect(readCarrierParams(token)).toEqual({ item: { a: 1 } })
    vi.setSystemTime(new Date(Date.now() + 6 * 60 * 1000))
    expect(readCarrierParams(token)).toBeNull()
  })

  it('releaseCarrierParams:页面 unload 后令牌立即失效,重复释放/非法令牌不抛', () => {
    const url = buildRoutePath(ROUTE_NAME, { item: { a: 1 } })
    const token = new URLSearchParams(url!.split('?')[1] ?? '').get('$rp')
    expect(readCarrierParams(token)).toEqual({ item: { a: 1 } })
    releaseCarrierParams(token)
    expect(readCarrierParams(token)).toBeNull()
    expect(() => releaseCarrierParams(token)).not.toThrow()
    expect(() => releaseCarrierParams(undefined)).not.toThrow()
  })

  it('通道容量:连发 25 条只保留最新 20 条(不随页面数线性增长)', () => {
    const tokens = Array.from({ length: 25 }, (_, i) => {
      const url = buildRoutePath(ROUTE_NAME, { nested: { i } })
      return new URLSearchParams(url!.split('?')[1] ?? '').get('$rp')
    })
    expect(tokens.slice(0, 5).every((token) => readCarrierParams(token) === null)).toBe(true)
    expect(tokens.slice(5).every((token) => readCarrierParams(token) !== null)).toBe(true)
  })
})

describe('switchTabIfNeeded', () => {
  it('tabBar 五页走 switchTab(带 query 也识别)', () => {
    for (const path of MINI_TAB_PATHS) {
      expect(switchTabIfNeeded(path)).toBe(true)
      expect(switchTabIfNeeded(`${path}?from=share`)).toBe(true)
    }
  })

  it('非 tab 页 / 形似 tab 的路径不误判', () => {
    expect(switchTabIfNeeded('/pkg-shop/cart/index')).toBe(false)
    expect(switchTabIfNeeded('/pages/mine/index')).toBe(false)
    expect(switchTabIfNeeded('/pages/user/detail/index')).toBe(false)
  })
})

describe('setParams 页面级覆盖', () => {
  it('合并写入 / 同值不通知 / 退订后不再通知', () => {
    const path = '/pages/probe/params'
    const notified: number[] = []
    const off = subscribePageParams(null, path, () => notified.push(1))

    expect(getPageParams(null, path)).toEqual({})
    setPageParams(null, path, { a: 1 })
    expect(getPageParams(null, path)).toEqual({ a: 1 })
    expect(notified).toHaveLength(1)

    // 同值写入不重渲染(否则 setParams 每次导航都会白刷一屏)
    setPageParams(null, path, { a: 1 })
    expect(notified).toHaveLength(1)

    setPageParams(null, path, { a: 2, b: { deep: true } })
    expect(getPageParams(null, path)).toEqual({ a: 2, b: { deep: true } })
    expect(notified).toHaveLength(2)

    off()
    setPageParams(null, path, { a: 3 })
    expect(getPageParams(null, path)).toEqual({ a: 3, b: { deep: true } })
    expect(notified).toHaveLength(2)
  })

  it('页面实例为键:同名页在栈里两份时参数互不串', () => {
    const path = '/pages/probe/two-instances'
    const pageA = {}
    const pageB = {}
    setPageParams(pageA, path, { a: 1 })
    expect(getPageParams(pageA, path)).toEqual({ a: 1 })
    expect(getPageParams(pageB, path)).toEqual({})
  })
})

describe('navigation 失败通道', () => {
  it('订阅能收到;退订后不再收到', () => {
    const seen: NavigationFailure[] = []
    const off = onNavigationFailure((failure) => seen.push(failure))
    emitNavigationFailure({ name: 'Ghost', reason: 'unmapped' })
    expect(seen).toEqual([{ name: 'Ghost', reason: 'unmapped' }])
    off()
    emitNavigationFailure({ name: 'Ghost2', reason: 'unmapped' })
    expect(seen).toHaveLength(1)
  })
})

describe('resolveNavigationAction', () => {
  it('非对象 action ⇒ invalid(不再静默)', () => {
    expect(resolveNavigationAction(null).kind).toBe('invalid')
    expect(resolveNavigationAction('NAVIGATE').kind).toBe('invalid')
  })

  it('React Navigation 形状:大写 type + payload', () => {
    const op = resolveNavigationAction({
      type: 'NAVIGATE',
      payload: { name: ROUTE_NAME, params: { id: 1 } },
    })
    expect(op).toEqual({ kind: 'navigate', name: ROUTE_NAME, params: { id: 1 } })

    expect(resolveNavigationAction({ type: 'PUSH', payload: { name: 'X' } }).kind).toBe('push')
    expect(resolveNavigationAction({ type: 'REPLACE', payload: { name: 'X' } }).kind).toBe(
      'replace',
    )
  })

  it('CommonActions 形状:小写 type + 顶层 name/params(无 payload)', () => {
    const op = resolveNavigationAction({ type: 'navigate', name: ROUTE_NAME, params: { id: 2 } })
    expect(op).toEqual({ kind: 'navigate', name: ROUTE_NAME, params: { id: 2 } })
  })

  it('缺少 name ⇒ invalid(带上原因,由调用方点名)', () => {
    const op = resolveNavigationAction({ type: 'navigate' })
    expect(op.kind).toBe('invalid')
    expect(op.kind === 'invalid' && op.detail).toContain('name')
  })

  it('返回/回顶/setParams 映射', () => {
    expect(resolveNavigationAction({ type: 'GO_BACK' })).toEqual({ kind: 'back' })
    expect(resolveNavigationAction({ type: 'POP' })).toEqual({ kind: 'back' })
    expect(resolveNavigationAction({ type: 'POP_TO_TOP' })).toEqual({ kind: 'back', delta: 10 })
    expect(resolveNavigationAction({ type: 'SET_PARAMS', payload: { params: { a: 1 } } })).toEqual({
      kind: 'set-params',
      params: { a: 1 },
    })
  })

  it('未知 type ⇒ invalid 且原因里带原值', () => {
    const op = resolveNavigationAction({ type: 'RESET' })
    expect(op.kind).toBe('invalid')
    expect(op.kind === 'invalid' && op.detail).toContain('RESET')
  })
})

describe('createFocusEffectController(useFocusEffect 的纯内核)', () => {
  it('run 幂等:同一可见周期只执行一次(避免 onShow + 挂载双跑)', () => {
    const effect = vi.fn(() => vi.fn())
    const controller = createFocusEffectController()
    controller.setEffect(effect)
    expect(controller.run()).toBeUndefined()
    expect(effect).toHaveBeenCalledTimes(1)
    controller.run()
    expect(effect).toHaveBeenCalledTimes(1)
    expect(controller.isFocused()).toBe(true)
  })

  it('hide ⇒ 执行 cleanup,且 stop 幂等(cleanup 只跑一次)', () => {
    const cleanup = vi.fn()
    const effect = vi.fn(() => cleanup)
    const controller = createFocusEffectController()
    controller.setEffect(effect)
    controller.run()
    controller.stop()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(controller.isFocused()).toBe(false)
    controller.stop()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('回屏重跑:stop 之后 run 再执行一次(useFocusEffect 的本来语义)', () => {
    const cleanup = vi.fn()
    const effect = vi.fn(() => cleanup)
    const controller = createFocusEffectController()
    controller.setEffect(effect)
    controller.run()
    controller.stop()
    controller.run()
    expect(effect).toHaveBeenCalledTimes(2)
    expect(controller.isFocused()).toBe(true)
  })

  it('effect 不返回 cleanup(undefined)时不抛;回屏照旧重跑', () => {
    const effect = vi.fn(() => undefined)
    const controller = createFocusEffectController()
    controller.setEffect(effect)
    controller.run()
    controller.stop()
    controller.run()
    expect(effect).toHaveBeenCalledTimes(2)
  })

  it('effect 抛错 ⇒ 原样抛出,状态复位可重试(不永久卡死在该页)', () => {
    const controller = createFocusEffectController()
    controller.setEffect(() => {
      throw new Error('boom')
    })
    expect(() => controller.run()).toThrow('boom')
    expect(controller.isFocused()).toBe(false)

    const ok = vi.fn(() => vi.fn())
    controller.setEffect(ok)
    expect(() => controller.run()).not.toThrow()
    expect(ok).toHaveBeenCalledTimes(1)
  })

  it('setEffect(null) 后 run 不执行(卸载路径)', () => {
    const effect = vi.fn(() => vi.fn())
    const controller = createFocusEffectController()
    controller.setEffect(effect)
    controller.setEffect(null)
    controller.run()
    expect(effect).not.toHaveBeenCalled()
  })
})

describe('createCompatNavigation 端口等价面', () => {
  function makeNav() {
    const failures: NavigationFailure[] = []
    const nav = createCompatNavigation({
      fail: (name, reason, detail) => failures.push({ name, reason, detail }),
      focusListeners: new Set(),
      blurListeners: new Set(),
    })
    return { nav, failures }
  }

  it('getState() 不再 TypeError,形状为 { routeNames, index, route, params }', () => {
    taro.getCurrentInstance.mockReturnValue({
      page: null,
      router: { path: '/pkg-about/about/index', params: { id: '7', gone: null } },
    })
    taro.getCurrentPages.mockReturnValue([{}, {}, {}])

    const state = getNavigationState()
    expect(Object.keys(state).sort()).toEqual(['index', 'params', 'route', 'routeNames'])
    expect(state.routeNames).toEqual(Object.keys(RN_ROUTE_MAP))
    expect(state.index).toBe(2)
    expect(state.route).toBe('/pkg-about/about/index')
    expect(state.params).toEqual({ id: '7' })
  })

  it('薄壳经 createCompatNavigation().getState() 读到同一份路由表(不抛 TypeError)', () => {
    const { nav } = makeNav()
    const state = nav.getState()
    expect(state.routeNames).toContain(ROUTE_NAME)
    expect(state.routeNames.length).toBe(Object.keys(RN_ROUTE_MAP).length)
  })

  it('replace 真走 redirectTo,不降级成 navigateTo', () => {
    taro.navigateTo.mockClear()
    taro.redirectTo.mockClear()
    const { nav } = makeNav()
    nav.replace(ROUTE_NAME, { id: 1 })

    expect(taro.redirectTo).toHaveBeenCalledTimes(1)
    expect(String(taro.redirectTo.mock.calls[0]?.[0]?.url)).toContain(ROUTE_PATH)
    expect(taro.navigateTo).not.toHaveBeenCalled()
  })

  it('options.tab 经 switchTabIfNeeded 判定:命中走 switchTab,不命中显式失败', () => {
    taro.switchTab.mockClear()
    taro.navigateTo.mockClear()
    const { nav, failures } = makeNav()
    const tabRouteName = Object.entries(RN_ROUTE_MAP).find(([, path]) =>
      MINI_TAB_PATHS.includes(path),
    )?.[0]

    if (tabRouteName) {
      nav.navigate(tabRouteName, {}, { tab: true })
      expect(taro.switchTab).toHaveBeenCalledTimes(1)
      expect(taro.navigateTo).not.toHaveBeenCalled()
    }

    nav.navigate(ROUTE_NAME, {}, { tab: true })
    expect(failures.at(-1)?.reason).toBe('tab-mismatch')
    expect(taro.navigateTo).not.toHaveBeenCalled()
  })

  it('tab 名单与 app.config 同源:MINI_TAB_PATHS 由 MINI_TAB_PAGE_LIST 派生且仍是 5 页', () => {
    expect(MINI_TAB_PATHS).toEqual(MINI_TAB_PAGE_LIST.map((path) => `/${path}`))
    expect(MINI_TAB_PATHS).toHaveLength(5)
    expect(MINI_TAB_PATHS).toContain('/pages/user/index')
    expect(MINI_TAB_PATHS).toContain('/pages/share/index')
  })

  it('逐字比对 app.config.ts tabBar.list:配置与 MINI_TAB_PAGE_LIST 任一漂移即红', () => {
    // app.config 不能 import TS 常量(Taro 配置加载器不支持),故用配置文本做契约钉死。
    const source = readFileSync(new URL('../app.config.ts', import.meta.url), 'utf8')
    const configured = [...source.matchAll(/pagePath:\s*'([^']+)'/g)].map((match) => match[1])
    expect(configured).toEqual([...MINI_TAB_PAGE_LIST])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
