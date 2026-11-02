// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type {
  ActionSheetItem,
  ConfirmOptions,
  KvPort,
  ListPort,
  MediaAsset,
  MediaPort,
  NavParams,
  OnNavigate,
  OnToast,
  PayResult,
  ScreenParams,
  SessionPort,
  ToastKind,
  UiPort,
  ViewerInfo,
} from '@ihui/types'
import {
  CAPABILITY_OFF,
  assertRequiredPort,
  isCapabilityOff,
  isPortErrorState,
  resolveOptionalPort,
} from '../ports'

describe('宿主端口类型契约', () => {
  it('导航参数只收标量,OnNavigate 参数/返回形态固定', () => {
    expectTypeOf<NavParams>().toEqualTypeOf<
      Readonly<Record<string, string | number | boolean | null | undefined>>
    >()
    expectTypeOf<OnNavigate>().parameter(0).toEqualTypeOf<string>()
    expectTypeOf<OnNavigate>().returns.toEqualTypeOf<void>()
    expectTypeOf<OnNavigate>().parameter(1).toEqualTypeOf<NavParams | undefined>()
  })

  it('OnToast 首参为字符串、kind 为封闭联合', () => {
    expectTypeOf<OnToast>().parameter(0).toEqualTypeOf<string>()
    expectTypeOf<ToastKind>().toEqualTypeOf<'success' | 'error' | 'info'>()
    expectTypeOf<OnToast>().returns.toEqualTypeOf<void>()
  })

  it('SessionPort.ensureLogin 只 resolve 布尔,不 reject 出别的载荷', () => {
    expectTypeOf<SessionPort['ensureLogin']>().returns.toEqualTypeOf<Promise<boolean>>()
    expectTypeOf<ViewerInfo['userId']>().toEqualTypeOf<string>()
  })

  it('KvPort / MediaPort / UiPort / ListPort 关键签形固定', () => {
    expectTypeOf<KvPort['get']>().parameter(0).toEqualTypeOf<string>()
    expectTypeOf<MediaPort['pickImage']>().returns.toEqualTypeOf<Promise<MediaAsset | null>>()
    expectTypeOf<UiPort['actionSheet']>().returns.toEqualTypeOf<Promise<number | null>>()
    expectTypeOf<UiPort['confirm']>().parameter(0).toEqualTypeOf<ConfirmOptions>()
    expectTypeOf<ActionSheetItem['label']>().toEqualTypeOf<string>()
    expectTypeOf<ListPort['onLoadMore']>().toEqualTypeOf<(() => void) | undefined>()
    expectTypeOf<ScreenParams>().toEqualTypeOf<Readonly<Record<string, string | undefined>>>()
    expectTypeOf<PayResult['status']>().toEqualTypeOf<'success' | 'cancelled' | 'failed'>()
  })

  it('负例:必填端口缺失 / ViewerInfo 缺 userId 必须在编译期报错', () => {
    type NavHost = { onNavigate: OnNavigate }

    // @ts-expect-error 必填端口 onNavigate 缺失必须编译期报错
    const missingNav: NavHost = {}
    // @ts-expect-error ViewerInfo.userId 必填
    const badViewer: ViewerInfo = { nickname: 'x' }
    // @ts-expect-error ToastKind 是封闭联合,不收任意字符串
    const badKind: ToastKind = 'warning'

    void missingNav
    void badViewer
    void badKind
  })
})

describe('assertRequiredPort 运行时闸', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('dev(非 production)缺必填端口直接抛 [host-port] missing <name>', () => {
    expect(() => assertRequiredPort('onNavigate', undefined)).toThrowError(
      '[host-port] missing onNavigate',
    )
    expect(() => assertRequiredPort('onToast', null)).toThrowError('[host-port] missing onToast')
  })

  it('有值时原样返回,不因 falsy 误判', () => {
    const nav = (target: string) => target
    expect(assertRequiredPort('onNavigate', nav)).toBe(nav)
    expect(assertRequiredPort('kv', 0)).toBe(0)
    expect(assertRequiredPort('flag', false)).toBe(false)
  })

  it('已知空实现黑名单:noop 不得冒充必填端口', () => {
    expect(() => assertRequiredPort('onNavigate', () => {})).toThrowError(
      '[host-port] empty implementation onNavigate',
    )
    expect(() => assertRequiredPort('onBack', () => undefined)).toThrowError(
      '[host-port] empty implementation onBack',
    )
  })

  it('prod 缺必填端口返回错误态标记,同名只 console.error 一次', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const first = assertRequiredPort('prodPortOnce', undefined)
    const second = assertRequiredPort('prodPortOnce', undefined)

    expect(isPortErrorState(first)).toBe(true)
    expect(isPortErrorState(second)).toBe(true)
    if (isPortErrorState(first)) {
      expect(first.name).toBe('prodPortOnce')
      expect(first.message).toBe('[host-port] missing prodPortOnce')
    }
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('[host-port] missing prodPortOnce')
  })

  it('prod 有值时仍是原值,不进入错误态', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const port = { isLoggedIn: () => true, ensureLogin: async () => true }
    expect(assertRequiredPort('session', port)).toBe(port)
  })
})

describe('resolveOptionalPort 可选端口归一', () => {
  it('undefined / null ⇒ capability-off 哨兵,不是 noop', () => {
    expect(resolveOptionalPort(undefined)).toBe(CAPABILITY_OFF)
    expect(resolveOptionalPort(null)).toBe(CAPABILITY_OFF)
    expect(isCapabilityOff(resolveOptionalPort(undefined))).toBe(true)
  })

  it('有值时原样返回', () => {
    const haptic = () => {}
    expect(resolveOptionalPort(haptic)).toBe(haptic)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
