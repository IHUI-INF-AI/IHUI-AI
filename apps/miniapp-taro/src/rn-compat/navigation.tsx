// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/navigation.ts —— `@react-navigation/native` 在小程序端的等价实现。
 *
 * RN 壳用 `useNavigation().navigate('CourseDetail', {id})` 这类**路由名**跳转,小程序只有路径。
 * 名字→路径的映射不靠猜:由 `scripts/gen-rn-compat.mjs` 从
 *   ① RN 导航器登记的路由名 ↔ 该路由承载的共享屏
 *   ② 跨端登记表(scripts/data/cross-end-screen-registry.json)里该共享屏的小程序页路由
 * 两条现读事实 join 出来,产出 route-map.generated.ts。
 * 映射不到时**显式点名并停在原地**,绝不静默跳到别的页(错跳比不跳更难查)。
 */
import Taro, { useDidHide, useDidShow, useUnload } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { MINI_TAB_PAGE_LIST } from '../constants/tab-bar-pages'
import { RN_ROUTE_MAP } from './route-map.generated'
import { onToast } from '@/host/on-toast'

export type RouteParams = Record<string, unknown>

/**
 * 参数通道:URL query 只能承载标量,对象/数组经 String(v) 会拼成 '[object Object]'。
 * 旧实现直接丢弃非标量 ⇒ navigate('RankingDetail', {id, item}) 的 item 丢失。
 * 现在把非标量放进进程内通道,URL 只带内部令牌 `$rp`;`$` 前缀同时会被
 * utils/share 的 currentPageShareQuery 跳过,不会把令牌带进分享链接。
 * 通道有 TTL + LRU 上限:页面卸载后最多驻留 5 分钟 / 20 条,不随页面数线性增长。
 * 边界(登记差异):跨进程/外部深链仍只有标量,通道只在同一个 JS 运行时内有效。
 */
const CARRIER_QUERY_KEY = '$rp'
const CARRIER_MAX = 20
const CARRIER_TTL_MS = 5 * 60 * 1000
interface CarrierEntry {
  params: RouteParams
  at: number
}
const carriers = new Map<string, CarrierEntry>()
let carrierSeq = 0
const EMPTY_PARAMS: RouteParams = {}

function pruneCarriers(now = Date.now()): void {
  for (const [token, entry] of carriers) {
    if (now - entry.at > CARRIER_TTL_MS) carriers.delete(token)
  }
  while (carriers.size > CARRIER_MAX) {
    const oldest = carriers.keys().next().value
    if (typeof oldest !== 'string') break
    carriers.delete(oldest)
  }
}

function putCarrierParams(params: RouteParams): string {
  const token = `rp${++carrierSeq}`
  carriers.set(token, { params, at: Date.now() })
  pruneCarriers()
  return token
}

/** 供 useRoute 与单测读取通道;令牌过期/不存在返回 null(参数不完整,由调用方决定降级) */
export function readCarrierParams(token: unknown): RouteParams | null {
  if (typeof token !== 'string' || token === '') return null
  const entry = carriers.get(token)
  if (!entry) return null
  if (Date.now() - entry.at > CARRIER_TTL_MS) {
    carriers.delete(token)
    return null
  }
  return entry.params
}

/** 页面 unload 时释放令牌(幂等):不再等 TTL,避免页面栈反复进出把通道占满 */
export function releaseCarrierParams(token: unknown): void {
  if (typeof token !== 'string' || token === '') return
  carriers.delete(token)
}

function isScalar(v: unknown): boolean {
  return (
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    typeof v === 'bigint'
  )
}

/** 路由名 → 小程序路径(标量进 query、非标量进内存通道);未登记返回 null(绝不猜目标页) */
export function buildRoutePath(name: string, params: RouteParams = {}): string | null {
  const path = RN_ROUTE_MAP[name]
  if (!path) return null
  const query: string[] = []
  const nonScalars: RouteParams = {}
  let hasNonScalar = false
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (isScalar(value)) {
      query.push(`${key}=${encodeURIComponent(String(value))}`)
    } else {
      nonScalars[key] = value
      hasNonScalar = true
    }
  }
  if (hasNonScalar) {
    query.push(`${CARRIER_QUERY_KEY}=${encodeURIComponent(putCarrierParams(nonScalars))}`)
  }
  return query.length > 0 ? `${path}?${query.join('&')}` : path
}

/**
 * tabBar 名单与真实配置同源:`app.config.ts` / `custom-tab-bar` / 本文件三处都从
 * `constants/tab-bar-pages.ts` 派生。旧正则把 message/mine 当代号、漏了 user/share
 * ⇒ 去「我的」会误走 navigateTo 而失败。单测钉住名单。
 */
export const MINI_TAB_PATHS: readonly string[] = MINI_TAB_PAGE_LIST.map((path) => `/${path}`)

export function switchTabIfNeeded(path: string): boolean {
  const bare = path.split('?')[0] ?? path
  return (MINI_TAB_PATHS as readonly string[]).includes(bare)
}

/** switchTab 不接受 query(带了就整跳失败),这里只留路径部分 */
function barePath(path: string): string {
  const index = path.indexOf('?')
  return index === -1 ? path : path.slice(0, index)
}

/**
 * setParams 的页面级覆盖:以页面实例对象为 WeakMap 键(同名页在栈里有多份时互不串),
 * 无实例(测试/非页上下文)回退到 path 键。
 */
const overridesByPage = new WeakMap<object, RouteParams>()
const overridesByPath = new Map<string, RouteParams>()
const listenersByPage = new WeakMap<object, Set<() => void>>()
const listenersByPath = new Map<string, Set<() => void>>()

function readOverrides(page: object | null, path: string): RouteParams {
  if (page) return overridesByPage.get(page) ?? EMPTY_PARAMS
  return overridesByPath.get(path) ?? EMPTY_PARAMS
}

function shallowEqual(a: RouteParams, b: RouteParams): boolean {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  return ak.every((key) => Object.prototype.hasOwnProperty.call(b, key) && a[key] === b[key])
}

export function getPageParams(page: object | null, path: string): RouteParams {
  return readOverrides(page, path)
}

export function setPageParams(page: object | null, path: string, patch: RouteParams): void {
  const prev = readOverrides(page, path)
  const next = { ...prev, ...patch }
  if (shallowEqual(prev, next)) return
  let listeners: Set<() => void> | undefined
  if (page) {
    overridesByPage.set(page, next)
    listeners = listenersByPage.get(page)
  } else {
    overridesByPath.set(path, next)
    listeners = listenersByPath.get(path)
  }
  listeners?.forEach((listener) => listener())
}

export function subscribePageParams(
  page: object | null,
  path: string,
  listener: () => void,
): () => void {
  let set: Set<() => void> | undefined
  if (page) {
    set = listenersByPage.get(page)
    if (!set) {
      set = new Set()
      listenersByPage.set(page, set)
    }
    set.add(listener)
    return () => set?.delete(listener)
  }
  set = listenersByPath.get(path)
  if (!set) {
    set = new Set()
    listenersByPath.set(path, set)
  }
  set.add(listener)
  return () => set?.delete(listener)
}

/** 未知路由/非法 action 的可观测出口:页面或自检工具可订阅,不再只有 console.warn */
export type NavigationFailureReason =
  'unmapped' | 'tab-params-dropped' | 'tab-mismatch' | 'unknown-action' | 'carrier-miss'
export interface NavigationFailure {
  name?: string
  reason: NavigationFailureReason
  detail?: string
}
const failureListeners = new Set<(failure: NavigationFailure) => void>()
export function onNavigationFailure(listener: (failure: NavigationFailure) => void): () => void {
  failureListeners.add(listener)
  return () => failureListeners.delete(listener)
}
export function emitNavigationFailure(failure: NavigationFailure): void {
  failureListeners.forEach((listener) => listener(failure))
}

/**
 * dispatch 的 action → 操作描述。两种形状都要接:
 *  ① React Navigation: `{ type: 'NAVIGATE', payload: { name, params } }`
 *  ② 本仓 CommonActions/StackActions: `{ type: 'navigate', name, params }`(无 payload)
 * 非法/未知一律落到 invalid,由调用方走失败通道(不再静默)。
 */
export type NavigationOperation =
  | { kind: 'navigate'; name: string; params?: RouteParams }
  | { kind: 'push'; name: string; params?: RouteParams }
  | { kind: 'replace'; name: string; params?: RouteParams }
  | { kind: 'back'; delta?: number }
  | { kind: 'set-params'; params: RouteParams }
  | { kind: 'invalid'; detail: string; name?: string }

export function resolveNavigationAction(action: unknown): NavigationOperation {
  if (!action || typeof action !== 'object') {
    return { kind: 'invalid', detail: 'navigation.dispatch 收到非对象 action,本次未执行。' }
  }
  const record = action as {
    type?: unknown
    payload?: unknown
    name?: unknown
    params?: RouteParams
  }
  const type = typeof record.type === 'string' ? record.type : ''
  const payload = (
    record.payload && typeof record.payload === 'object' ? record.payload : record
  ) as {
    name?: unknown
    params?: RouteParams
  }
  const name = typeof payload.name === 'string' ? payload.name : ''
  switch (type) {
    case 'NAVIGATE':
    case 'navigate':
      return name
        ? { kind: 'navigate', name, params: payload.params }
        : { kind: 'invalid', detail: 'navigate action 缺少 name。' }
    case 'PUSH':
    case 'push':
      return name
        ? { kind: 'push', name, params: payload.params }
        : { kind: 'invalid', detail: 'push action 缺少 name。' }
    case 'REPLACE':
    case 'replace':
      return name
        ? { kind: 'replace', name, params: payload.params }
        : { kind: 'invalid', detail: 'replace action 缺少 name。' }
    case 'POP':
    case 'pop':
    case 'GO_BACK':
    case 'goBack':
      return { kind: 'back' }
    case 'POP_TO_TOP':
    case 'popToTop':
      return { kind: 'back', delta: 10 }
    case 'SET_PARAMS':
    case 'setParams':
      return { kind: 'set-params', params: payload.params ?? {} }
    default:
      return {
        kind: 'invalid',
        name: name || undefined,
        detail: `未知 navigation action type「${type || '(empty)'}」,本次未执行。`,
      }
  }
}

function currentScope(): { page: object | null; path: string } {
  const instance = Taro.getCurrentInstance()
  const page = ((instance as unknown as { page?: object }).page ?? null) as object | null
  return { page, path: instance.router?.path ?? '' }
}

/**
 * `useNavigation().getState()` 的形状:React Navigation 的 state 字段
 * (`routeNames` / `index`) + 小程序当前页的 `route` / `params`。
 *
 * 宿主端口 `useHostPorts` 会读 `getState()?.routeNames` 做 target 白名单校验;
 * 缺这个方法会让任何薄壳调用 onNavigate 直接 TypeError,故它是端口等价层的必需面。
 * `index` 取页面栈深度(小程序没有 RN 的 navigator state,栈深是等价语义);
 * `route` 是当前页路径,`params` 与 useRoute 同口径(内存通道 ⊕ URL 标量 ⊕ setParams 覆盖)。
 */
export interface CompatNavigationState {
  routeNames: string[]
  index: number
  route: string
  params: RouteParams
}

export function getNavigationState(): CompatNavigationState {
  const instance = Taro.getCurrentInstance()
  const rawParams = (instance.router?.params ?? {}) as RouteParams
  const { page, path } = currentScope()
  const carried = readCarrierParams(rawParams[CARRIER_QUERY_KEY])
  const scalars: RouteParams = {}
  for (const [key, value] of Object.entries(rawParams)) {
    if (key === CARRIER_QUERY_KEY) continue
    if (value === undefined || value === null) continue
    scalars[key] = value
  }
  const params = { ...(carried ?? {}), ...scalars, ...getPageParams(page, path) }
  const pages =
    typeof Taro.getCurrentPages === 'function' ? Taro.getCurrentPages() : ([] as unknown[])
  return {
    routeNames: Object.keys(RN_ROUTE_MAP),
    index: Math.max(0, pages.length - 1),
    route: path,
    params,
  }
}

/**
 * 焦点 effect 的纯控制器(可脱离 React 单测):
 * run 幂等(同一可见周期只执行一次)、stop 幂等、卸载/异常/重入都有确定终态。
 */
export interface FocusEffectController {
  run: () => void
  stop: () => void
  setEffect: (effect: (() => (() => void) | undefined) | null) => void
  isFocused: () => boolean
}

export function createFocusEffectController(): FocusEffectController {
  let effect: (() => (() => void) | undefined) | null = null
  let cleanup: (() => void) | null = null
  let focused = false
  return {
    run: () => {
      if (focused || !effect) return
      focused = true
      try {
        const result = effect()
        cleanup = typeof result === 'function' ? result : null
      } catch (error) {
        // 抛错不吞:把状态退回去,下一次 didShow 可重试,且不会在同一周期内无限重入
        focused = false
        cleanup = null
        throw error
      }
    },
    stop: () => {
      if (!focused) return
      focused = false
      const pending = cleanup
      cleanup = null
      pending?.()
    },
    setEffect: (next) => {
      effect = next
    },
    isFocused: () => focused,
  }
}

export interface CompatNavigation {
  navigate: (name: string, params?: RouteParams, options?: { tab?: boolean }) => void
  push: (name: string, params?: RouteParams) => void
  replace: (name: string, params?: RouteParams) => void
  goBack: () => void
  pop: () => void
  popToTop: () => void
  setParams: (params: RouteParams) => void
  canGoBack: () => boolean
  addListener: (event?: string, cb?: () => void) => { remove: () => void }
  isFocused: () => boolean
  dispatch: (action: unknown) => void
  /** 与 React Navigation 同名的 state 读取口(宿主端口白名单校验依赖它) */
  getState: () => CompatNavigationState
}

let lastParams: RouteParams = {}

/** 供 useRoute 用:router.params ⊕ 内存通道 ⊕ setParams 覆盖,同一参数版本返回稳定对象 */
export function useRoute() {
  const instance = Taro.getCurrentInstance()
  const rawParams = (instance.router?.params ?? {}) as RouteParams
  const path = instance.router?.path ?? ''
  const page = ((instance as unknown as { page?: object }).page ?? null) as object | null
  const [, setVersion] = useState(0)

  useEffect(() => subscribePageParams(page, path, () => setVersion((v) => v + 1)), [page, path])

  // 页面 unload 释放 $rp 令牌:参数随页面生命周期走,不再驻留到 TTL 上限
  useUnload(() => releaseCarrierParams(rawParams[CARRIER_QUERY_KEY]))

  const carried = readCarrierParams(rawParams[CARRIER_QUERY_KEY])
  const overrides = getPageParams(page, path)
  const cacheRef = useRef<{
    raw: RouteParams
    carried: RouteParams | null
    overrides: RouteParams
    route: { key: string; name: string; params: RouteParams }
  } | null>(null)

  const cache = cacheRef.current
  if (
    cache &&
    cache.raw === rawParams &&
    cache.carried === carried &&
    cache.overrides === overrides
  ) {
    lastParams = cache.route.params
    return cache.route
  }

  const scalars: RouteParams = {}
  for (const [key, value] of Object.entries(rawParams)) {
    if (key === CARRIER_QUERY_KEY) continue
    if (value === undefined || value === null) continue
    scalars[key] = value
  }
  const params = { ...(carried ?? {}), ...scalars, ...overrides }
  const route = { key: 'mini', name: path, params }
  cacheRef.current = { raw: rawParams, carried, overrides, route }
  lastParams = params
  return route
}

export interface CompatNavigationDeps {
  fail: (name: string, reason: NavigationFailureReason, detail?: string) => void
  focusListeners: Set<() => void>
  blurListeners: Set<() => void>
}

/**
 * 纯函数版导航器(不依赖 React):薄壳与单测可直接构造,用来验证 getState / replace 真跳。
 * `useNavigation` 只是把页面级焦点集合与失败出口注入进来。
 */
export function createCompatNavigation(deps: CompatNavigationDeps): CompatNavigation {
  const { fail, focusListeners, blurListeners } = deps
  const navigate = (name: string, params?: RouteParams, options?: { tab?: boolean }) => {
    const path = buildRoutePath(name, params)
    if (!path) return fail(name, 'unmapped')
    const isTab = switchTabIfNeeded(path)
    if (options?.tab && !isTab) {
      return fail(
        name,
        'tab-mismatch',
        `「${name}」声明为 tab 跳转,但不在 tabBar 名单内 ⇒ 本次未执行。`,
      )
    }
    if (isTab) {
      if (path.includes('?')) emitNavigationFailure({ name, reason: 'tab-params-dropped' })
      void Taro.switchTab({ url: barePath(path) })
    } else {
      void Taro.navigateTo({ url: path })
    }
  }

  const push = (name: string, params?: RouteParams) => {
    const path = buildRoutePath(name, params)
    if (!path) return fail(name, 'unmapped')
    if (switchTabIfNeeded(path)) {
      return fail(name, 'tab-params-dropped', `tab 页「${name}」只能 switchTab,本次 push 未执行。`)
    }
    void Taro.navigateTo({ url: path })
  }

  // replace 必须真走 redirectTo:不静默降级成 navigateTo(那会把返回栈保留下来)。
  const replace = (name: string, params?: RouteParams) => {
    const path = buildRoutePath(name, params)
    if (!path) return fail(name, 'unmapped')
    if (switchTabIfNeeded(path)) {
      void Taro.switchTab({ url: barePath(path) })
      return
    }
    void Taro.redirectTo({ url: path })
  }

  const setParams = (params: RouteParams) => {
    const scope = currentScope()
    setPageParams(scope.page, scope.path, params)
  }

  const addListener = (event?: string, cb?: () => void) => {
    if (!cb || (event !== 'focus' && event !== 'blur')) return { remove() {} }
    const set = event === 'focus' ? focusListeners : blurListeners
    set.add(cb)
    return {
      remove: () => {
        set.delete(cb)
      },
    }
  }

  const dispatch = (action: unknown) => {
    const op = resolveNavigationAction(action)
    switch (op.kind) {
      case 'navigate':
        return navigate(op.name, op.params)
      case 'push':
        return push(op.name, op.params)
      case 'replace':
        return replace(op.name, op.params)
      case 'back':
        return void Taro.navigateBack(op.delta ? { delta: op.delta } : undefined)
      case 'set-params':
        return setParams(op.params)
      case 'invalid':
        return fail(op.name || 'dispatch', 'unknown-action', op.detail)
    }
  }

  return {
    navigate,
    push,
    replace,
    goBack: () => void Taro.navigateBack(),
    pop: () => void Taro.navigateBack(),
    popToTop: () => void Taro.navigateBack({ delta: 10 }),
    setParams,
    canGoBack: () => Taro.getCurrentPages().length > 1,
    addListener,
    isFocused: () => true,
    dispatch,
    getState: getNavigationState,
  }
}

export function useNavigation(): CompatNavigation {
  const warnedRef = useRef<Set<string>>(new Set())
  const focusRef = useRef<Set<() => void>>(new Set())
  const blurRef = useRef<Set<() => void>>(new Set())

  // 页面级焦点事件:嵌套组件可通过 PageContext 注册到所属页面(见 Taro createTaroHook)
  useDidShow(() => {
    focusRef.current.forEach((listener) => listener())
  })
  useDidHide(() => {
    blurRef.current.forEach((listener) => listener())
  })

  const fail = useCallback((name: string, reason: NavigationFailureReason, detail?: string) => {
    console.warn(
      `[rn-compat] ${
        detail ??
        `路由名「${name}」在 route-map.generated.ts 里没有登记 ⇒ 本次跳转未执行(不猜目标页)。`
      }`,
    )
    emitNavigationFailure({ name, reason, detail })
    if (!warnedRef.current.has(name)) {
      warnedRef.current.add(name)
      void onToast('该页面暂未支持', { kind: 'error' })
    }
  }, [])

  return useMemo(
    () =>
      createCompatNavigation({
        fail,
        focusListeners: focusRef.current,
        blurListeners: blurRef.current,
      }),
    [fail],
  )
}

export function useIsFocused() {
  return true
}

/**
 * RN 语义:`useFocusEffect` = 进入前台执行、离开清理、再次进入重跑。
 * 小程序侧桥接 useDidShow/useDidHide;首屏挂载先执行一次,随后的 didShow 由控制器去重,
 * 避免「挂载 + onShow」双跑(那会让 21 个 useRefreshOnFocus 屏首进发两次请求)。
 */
export function useFocusEffect(effect: () => () => void | undefined) {
  const controllerRef = useRef<FocusEffectController | null>(null)
  if (!controllerRef.current) controllerRef.current = createFocusEffectController()
  const controller = controllerRef.current
  controller.setEffect(effect)

  useDidShow(() => controller.run())
  useDidHide(() => controller.stop())

  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      controller.run()
      return
    }
    // effect 身份变化且页面可见:旧 cleanup → 新 effect(与 RN 语义一致)
    if (controller.isFocused()) {
      controller.stop()
      controller.run()
    }
  }, [effect, controller])

  useEffect(() => () => controller.stop(), [controller])
}

export function usePreventRemove() {}

export const CommonActions = {
  navigate: (name: string, params?: RouteParams) => ({ type: 'navigate', name, params }),
  goBack: () => ({ type: 'goBack' }),
  setParams: (params: RouteParams) => ({ type: 'setParams', params }),
}

export const StackActions = {
  push: (name: string, params?: RouteParams) => ({ type: 'push', name, params }),
  replace: (name: string, params?: RouteParams) => ({ type: 'replace', name, params }),
  pop: () => ({ type: 'pop' }),
  popToTop: () => ({ type: 'popToTop' }),
}

export function NavigationContainer({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function createNativeStackNavigator() {
  return {
    Navigator: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Screen: ({
      component: Component,
    }: {
      component?: (p: unknown) => ReactNode
      name?: string
      params?: RouteParams
    }) => (Component ? <>{Component({})}</> : null),
    Group: ({ children }: { children?: ReactNode }) => <>{children}</>,
  }
}

export function createStackNavigator() {
  return createNativeStackNavigator()
}

export function useTheme() {
  return { dark: false, colors: {} as Record<string, string> }
}

export function useScrollToTop() {
  useEffect(() => {}, [])
}

export const paramsOf = () => lastParams
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
