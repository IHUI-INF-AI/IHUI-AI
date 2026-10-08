// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// L4006 常驻锁:全屏播放器窗口在位时,状态栏带位不得是"第二层浅色"。
//
// 现场(真机可见,2026-10-02 定位):`VideoPlayerScreen` / 任意路由挂起的 `<VideoPlayer>` 进入
// 全屏后是纯黑画面,其上方横一条约 34dp 浅灰带。画那条带的**不是屏幕内容**,而是
// `apps/mobile-rn/App.tsx` 那枚根 View 的 backgroundColor —— react-native-video 的 Android 全屏
// 是 `Dialog(context, Theme_Black_NoTitleBar)` 这个另一个窗口
// (node_modules/react-native-video/android/src/main/java/com/brentvatne/exoplayer/FullScreenPlayerView.kt:27),
// 该主题不覆盖状态栏带;端内写法够不到这条带,已由 PROJECT_PLAN「实测钉死一条边界」的装机像素
// 量反证(负 margin 只移动布局盒,不移动裁剪边界)。枚 2ef1c2978 把底色按**聚焦路由名**条件化,
// 只覆盖了 `VideoPlayer` 这一条路由;同一只播放器从别的路由发起全屏(今天已知一站是
// `ProfileScreen` 的 `VideoPlayerModal`)带位仍是浅色 —— 因不是路由名,是"有全屏窗口正盖着本窗口"。
//
// 本文件钉四条:
//  ① 沉浸态信号本身(令牌集合语义:第二个 holder 未退出时不得提前关掉);
//  ② 带位仍由 App 根 View 单点绘制 —— 非播放器路由 + 全屏在位 ⇒ 翻黑,退出 ⇒ 逐字翻回原值;
//  ③ 接线:渲染**真的** `<VideoPlayer>`,由它把原生全屏事件接到该信号(不是让测试替 store 说话);
//  ④ 三条反向锁:信号模块不得成为第二个色源/顶距取值口、`SafeAreaView edges={['top']}` 单点
//     必须在位(守门 97 S1)、端内不得回到已被真机证伪的负 margin/paddingTop 凑带位。
// 断言读的是**落到根 div 元素上的实算 backgroundColor**(同 app-root-background-focused-route 取证法),
// 不是读 styles 对象。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const env = vi.hoisted(() => {
  // App.tsx 模块求值期有 `if (__DEV__)`(jsdom 无此全局,不定义即 ReferenceError)
  ;(globalThis as Record<string, unknown>).__DEV__ = false
  return {
    /** 模拟当前聚焦路由名(null = 导航器未就绪) */
    route: 'Home' as string | null,
    ready: true,
    /** navigation-ref.addListener 的替身登记表:[事件名, 回调] */
    listeners: [] as Array<{ event: string; cb: () => void }>,
    /** react-native-video 替身收到的 props(每次渲染 push 一条,取末条即最新一次) */
    videoProps: [] as Array<Record<string, unknown>>,
    /** 替身挂到 ref.current 上的命令式句柄(真身即以此暴露 present/dismiss) */
    imperative: {} as Record<string, () => void>,
  }
})

vi.mock('react-native', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    AppRegistry: { registerComponent: vi.fn(), runApplication: vi.fn() },
    LogBox: { ignoreAllLogs: vi.fn() },
  }
})

// react-native-video 是原生包:测试环境替身为"只记 props、不渲染"的函数组件
// (组件头注自述的测试口径)。ref 按 React 19 的 props 形态接住并挂上命令式句柄。
vi.mock('react-native-video', () => ({
  default: (props: Record<string, unknown>) => {
    env.videoProps.push(props)
    const ref = props.ref as { current: unknown } | null
    if (ref && typeof ref === 'object') ref.current = env.imperative
    return null
  },
}))

vi.mock('@ihui/ui-native', () => ({
  Loading: () => createElement('div', null, 'loading'),
}))

vi.mock('expo-font', () => ({ useFonts: () => [true] }))
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }))
vi.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: unknown }) => children,
  DarkTheme: {},
  DefaultTheme: {},
}))
vi.mock('../src/navigation/RootNavigator', () => ({ RootNavigator: () => null }))
vi.mock('../src/navigation/linking', () => ({ linking: {} }))
vi.mock('../src/navigation/navigation-ref', () => ({
  navigationRef: {
    isReady: () => env.ready,
    getCurrentRoute: () => (env.route ? { name: env.route } : undefined),
    addListener: (event: string, cb: () => void) => {
      env.listeners.push({ event, cb })
      return () => {
        const i = env.listeners.findIndex((l) => l.cb === cb)
        if (i >= 0) env.listeners.splice(i, 1)
      }
    },
  },
  navigateTo: vi.fn(),
}))
vi.mock('../src/lib/wechat', () => ({ registerWechat: async () => {} }))
vi.mock('../src/lib/oauth-deeplink', () => ({
  subscribeOAuthDeepLink: () => () => {},
  getInitialOAuthDeepLink: async () => null,
}))
vi.mock('../src/stores/auth-store', () => ({
  rnAuthStore: { getState: () => ({ token: null }) },
}))
vi.mock('../src/components/GlobalFloatBox', () => ({ GlobalFloatBox: () => null }))
vi.mock('../src/components/PrivacyPolicyModal', () => ({ PrivacyPolicyModal: () => null }))
vi.mock('../src/components/OfflineBanner', () => ({ OfflineBanner: () => null }))
vi.mock('../src/components/DevErrorToast', () => ({ DevErrorToast: () => null }))
vi.mock('../src/context/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: unknown }) => children,
  useTheme: () => ({ resolvedTheme: 'light' }),
}))
vi.mock('../src/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
}))
vi.mock('../src/context/NetworkContext', () => ({
  NetworkProvider: ({ children }: { children: unknown }) => children,
  useNetwork: () => ({ isOnline: true }),
}))

import App from '../App'
import { tokens } from '../src/theme/active-tokens'
import { VideoPlayer } from '../src/components/VideoPlayer'
import { I18nProvider } from '../src/i18n'
import {
  acquireVideoImmersive,
  releaseVideoImmersive,
  isVideoImmersive,
  subscribeVideoImmersive,
} from '../src/lib/video-immersive'

/** jsdom 会把样式值归一化成 rgb();把 token 原值走同一条归一化再比,避免手写色值漂移 */
function css(hex: string): string {
  const probe = document.createElement('div')
  probe.style.color = hex
  const out = probe.style.color
  if (!out) throw new Error(`token 色值 ${hex} 无法被 jsdom 解析,断言前提不成立`)
  return out
}

/** 带位画在 App 根 View 上 = 渲染容器的第一个子元素;读**落到元素上**的实算底色 */
function rootBackgroundOf(container: HTMLElement): string {
  const root = container.firstElementChild as HTMLElement | null
  if (!root) throw new Error('App 根 View 未渲染(容器为空)')
  return root.style.backgroundColor
}

function lastVideoProps(): Record<string, unknown> {
  const props = env.videoProps.at(-1)
  if (!props) throw new Error('react-native-video 替身未收到 props ⇒ <VideoPlayer> 没真的渲染')
  return props
}

function fireImmersiveEvent(name: string): void {
  const handler = lastVideoProps()[name]
  if (typeof handler !== 'function') {
    throw new Error(`react-native-video 未收到 ${name} ⇒ 全屏事件没接到沉浸态(接线被摘)`)
  }
  act(() => {
    ;(handler as () => void)()
  })
}

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

/** 本文件自己 acquire 的令牌,逐条登记、afterEach 释放 —— 不让一处失败把沉浸态漏给后面的用例 */
const held: string[] = []
function hold(): string {
  const token = acquireVideoImmersive()
  held.push(token)
  return token
}

/**
 * 源码面取材的路径解析。
 *
 * 为什么不写死绝对路径、也不能只靠 `process.cwd()`:vitest(vite-node)给测试模块的
 * `import.meta.url` 不一定是 `file:` scheme(本项目实测是 `/@fs/G:/...` 形态),
 * 而 `fileURLToPath` 对非 file: 直接抛 `TypeError: The URL must be of scheme file`;
 * 靠 cwd 的话,换一种调用入口(`--root` vs 端内 `pnpm test`)结论就跟着挪(守门 70 记过的那一型)。
 * 两种形态都试,并且**逐个断文件真的存在** —— 拿不到源码就当"判过了"是绝不接受的:
 * 这一族的结论只能来自读到的文本。
 */
function testFileDir(): string {
  const url = import.meta.url
  const candidates: string[] = []
  if (url.startsWith('file:')) candidates.push(fileURLToPath(url))
  const viaFsPrefix = url.match(/\/@fs\/(.+)$/)?.[1]
  if (viaFsPrefix) candidates.push(viaFsPrefix)
  candidates.push(url.replace(/^https?:\/\/[^/]*\/?/, ''))
  for (const c of candidates) {
    const clean = c.replace(/\?.*$/, '')
    if (clean.endsWith('video-immersive-band.test.tsx')) return dirname(clean)
  }
  throw new Error(`无法从 import.meta.url 定位测试文件自身目录(读到 ${url})⇒ 源码面断言无取材面`)
}

const SRC_DIR = testFileDir()
const SRC = {
  app: resolve(SRC_DIR, '../App.tsx'),
  player: resolve(SRC_DIR, '../src/components/VideoPlayer.tsx'),
  signal: resolve(SRC_DIR, '../src/lib/video-immersive.ts'),
}
for (const [key, path] of Object.entries(SRC)) {
  if (!existsSync(path)) {
    throw new Error(`源码面取材落空:${key} → ${path} 不存在 ⇒ 该组断言一条也不该被记为通过`)
  }
}
function sourceOf(key: keyof typeof SRC): string {
  return readFileSync(SRC[key], 'utf8')
}

beforeEach(() => {
  env.listeners.length = 0
  env.videoProps.length = 0
  env.route = 'Home'
  env.ready = true
  env.imperative.presentFullscreenPlayer = vi.fn()
  env.imperative.dismissFullscreenPlayer = vi.fn()
})

afterEach(() => {
  while (held.length > 0) releaseVideoImmersive(held.pop() as string)
})

describe('① 全屏沉浸态信号(令牌集合,不含色值)', () => {
  it('acquire ⇒ 订阅者收到 true,release ⇒ 收到 false', () => {
    const seen: boolean[] = []
    const unsub = subscribeVideoImmersive((v) => seen.push(v))
    expect(isVideoImmersive()).toBe(false)
    const token = acquireVideoImmersive()
    expect(isVideoImmersive()).toBe(true)
    releaseVideoImmersive(token)
    expect(isVideoImmersive()).toBe(false)
    unsub()
    expect(seen).toEqual([true, false])
  })

  it('第二个 holder 未退出时不得提前关掉(集合语义,不是被最后写覆盖的布尔)', () => {
    const a = acquireVideoImmersive()
    const b = acquireVideoImmersive()
    releaseVideoImmersive(a)
    expect(isVideoImmersive()).toBe(true)
    releaseVideoImmersive(b)
    expect(isVideoImmersive()).toBe(false)
  })

  it('释放未知令牌无副作用,也不惊动订阅者', () => {
    const seen: boolean[] = []
    const unsub = subscribeVideoImmersive((v) => seen.push(v))
    releaseVideoImmersive('video-immersive-never-existed')
    expect(seen).toEqual([])
    unsub()
  })
})

describe('② 带位仍由 App 根 View 单点绘制(全屏态不得有第二层浅色带)', () => {
  it('非播放器路由 + 全屏窗口在位 ⇒ 带位翻黑(这条带的浅色来源被掐断)', () => {
    env.route = 'Profile'
    hold()
    const { container } = render(<App />)
    expect(rootBackgroundOf(container)).toBe(css(tokens.gray.black))
    expect(css(tokens.gray.black)).toBe('rgb(0, 0, 0)')
  })

  it('全屏窗口在位而 App **挂载之后**才呈现 ⇒ 由订阅翻黑,退出后逐字翻回原值', () => {
    env.route = 'Settings'
    const { container } = render(<App />)
    const before = rootBackgroundOf(container)
    expect(before).toBe(css(tokens.surface.bg))

    // setState 由订阅回调驱动(不在 React 事件里),翻转必须整个包在 act 内 ——
    // 只在断言前 `act(() => undefined)` 冲不掉一次已经排队的并发更新,读数会停在旧值。
    let token = ''
    act(() => {
      token = hold()
    })
    expect(rootBackgroundOf(container)).toBe(css(tokens.gray.black))

    act(() => {
      releaseVideoImmersive(token)
    })
    expect(rootBackgroundOf(container)).toBe(before)
  })

  it('其余路由且不在全屏态 ⇒ 底色一格未动(非全屏页面外观不得被顺手改掉)', () => {
    expect(css(tokens.surface.bg)).toBe('rgb(245, 245, 245)')
    expect(css(tokens.surface.card)).toBe('rgb(255, 255, 255)')
    // 权威取色表是 App.tsx 的 ROUTE_ROOT_BG(2026-10-07 用户点名「登录页状态栏露出一截浅灰」后
    // 按路由分档:Login 页面底取 surface.card,不是 surface.bg;该表未导出,逐路由真实值另由
    // app-root-background-focused-route.test.tsx 钉住)。本用例锁的是"非全屏态 ⇒ 底色等于该路由
    // 自己那一档",所以不得整片回落到 surface.bg —— 那会把 10-07 那次修复当成缺陷改回去。
    const EXPECTED_ROOT_BG: Record<string, string> = { Login: css(tokens.surface.card) }
    for (const route of ['Home', 'Profile', 'Settings', 'Login', 'Chat', 'CourseDetail']) {
      env.route = route
      const { container } = render(<App />)
      expect(rootBackgroundOf(container)).toBe(EXPECTED_ROOT_BG[route] ?? css(tokens.surface.bg))
    }
  })

  it('VideoPlayer 路由仍翻黑(枚 2ef1c2978 的行为不回退)', () => {
    env.route = 'VideoPlayer'
    const { container } = render(<App />)
    expect(rootBackgroundOf(container)).toBe(css(tokens.gray.black))
  })
})

describe('③ 接线:真的 <VideoPlayer> 把原生全屏事件接到沉浸态与带位', () => {
  it('didPresent ⇒ 带位翻黑;didDismiss ⇒ 翻回浅色;非播放器路由上同样成立', () => {
    env.route = 'Profile'
    const app = render(<App />)
    expect(rootBackgroundOf(app.container)).toBe(css(tokens.surface.bg))

    const player = render(<VideoPlayer url="https://example.com/a.mp4" />, { wrapper })
    expect(lastVideoProps()).toBeTruthy()

    fireImmersiveEvent('onFullscreenPlayerDidPresent')
    expect(isVideoImmersive()).toBe(true)
    expect(rootBackgroundOf(app.container)).toBe(css(tokens.gray.black))

    fireImmersiveEvent('onFullscreenPlayerDidDismiss')
    expect(isVideoImmersive()).toBe(false)
    expect(rootBackgroundOf(app.container)).toBe(css(tokens.surface.bg))

    player.unmount()
  })

  it('组件卸载即释放令牌(路由被弹出而原生窗口未收回时,带色不会停在黑)', () => {
    env.route = 'Profile'
    const player = render(<VideoPlayer url="https://example.com/a.mp4" />, { wrapper })
    fireImmersiveEvent('onFullscreenPlayerDidPresent')
    expect(isVideoImmersive()).toBe(true)
    player.unmount()
    expect(isVideoImmersive()).toBe(false)
  })

  it('present 之前不染色:只有窗口真的在位才翻黑(全屏没成功 ⇒ 页面外观不变)', () => {
    env.route = 'Course'
    const app = render(<App />)
    render(<VideoPlayer url="https://example.com/a.mp4" />, { wrapper })
    expect(isVideoImmersive()).toBe(false)
    expect(rootBackgroundOf(app.container)).toBe(css(tokens.surface.bg))
  })
})

/**
 * 只遮注释、**保留字符串**的源码面(与守门 131/134/135 同一取向:判据看代码面,
 * 而注释里的逐字引用不得被读成站点)。
 * 之所以不直接引 `scripts/lib/code-mask.mjs`:那是根工具层、不属于本端依赖面。
 * 两条构造面自证见下方「codeFace 自身的形状锁」—— 遮多了会让"不存在型"断言空转通过,
 * 遮少了会红;两种都必须能被机器看见。
 */
function codeFace(src: string): string {
  const out: string[] = []
  let i = 0
  let mode: 'code' | 'line' | 'block' | 'string' | 'template' = 'code'
  while (i < src.length) {
    // noUncheckedIndexedAccess:下标读到的都是 string | undefined,而循环条件保证有值
    const ch = src[i] as string
    const next = src[i + 1] ?? ''
    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        mode = 'line'
        out.push('  ')
        i += 2
        continue
      }
      if (ch === '/' && next === '*') {
        mode = 'block'
        out.push('  ')
        i += 2
        continue
      }
      if (ch === '"' || ch === "'") mode = 'string'
      else if (ch === '`') mode = 'template'
      out.push(ch)
      i += 1
      continue
    }
    if (mode === 'line') {
      if (ch === '\n') {
        mode = 'code'
        out.push('\n')
      } else out.push(' ')
      i += 1
      continue
    }
    if (mode === 'block') {
      if (ch === '*' && next === '/') {
        mode = 'code'
        out.push('  ')
        i += 2
        continue
      }
      out.push(ch === '\n' ? '\n' : ' ')
      i += 1
      continue
    }
    // 字符串 / 模板:逐字保留(判据要判的形态就可能住在字符串邻行),只处理转义与结束引号
    out.push(ch)
    if (ch === '\\') {
      out.push(next ?? '')
      i += 2
      continue
    }
    if (mode === 'string' && (ch === '"' || ch === "'")) mode = 'code'
    else if (mode === 'template' && ch === '`') mode = 'code'
    i += 1
  }
  return out.join('')
}

describe('④ 反向锁(判据失效的表现永远是安静,这三格只能用源码面证明)', () => {
  it('codeFace 自身的形状锁:注释形态必须被遮掉,字符串形态必须留着', () => {
    const lineComment = '// paddingTop: 12\nconst a = 1'
    const blockComment = '/* marginTop: -34 */\nconst b = 2'
    const maskedLine = codeFace(lineComment)
    const maskedBlock = codeFace(blockComment)
    // 注释里的该形态不得留在判据面上(否则"不存在型"断言会被自己的解释文字判红)
    expect(maskedLine).not.toContain('paddingTop')
    expect(maskedBlock).not.toContain('marginTop')
    // 而代码位必须原样留着
    expect(maskedLine).toContain('const a = 1')
    expect(maskedBlock).toContain('const b = 2')
    // 等长:行号与列位直通,断言读到的位置才等于源码位置(本仓遮罩的既有口径)
    expect(maskedLine.length).toBe(lineComment.length)
    expect(maskedBlock.length).toBe(blockComment.length)
    // 字符串里的同类字样**不得**被当成注释遮掉 —— 遮多了,"不存在型"断言会空转通过
    expect(codeFace("const s = 'paddingTop: 8'")).toBe("const s = 'paddingTop: 8'")
  })

  it('信号模块不得成为第二个色源/顶距取值口', () => {
    const src = codeFace(sourceOf('signal'))
    // 十六进制色值 / 函数式颜色
    expect(/#[0-9a-fA-F]{3,8}\b/.test(src)).toBe(false)
    expect(/rgba?\(/.test(src)).toBe(false)
    // 任何 token 取色(色值仍只有 App.tsx 一处取用点)
    expect(/tokens|getTokens|design-tokens/.test(src)).toBe(false)
    // 顶距第二取值口(守门 97 S2)
    expect(/statusBarHeight|currentHeight|insets\.top|paddingTop/.test(src)).toBe(false)
  })

  it('App.tsx 的状态栏避让单点必须在位,且带色只有一处取用点(守门 97 S1)', () => {
    const src = codeFace(sourceOf('app'))
    expect(/<SafeAreaView\s+edges=\{\['top'\]\}/.test(src)).toBe(true)
    // 底色判定只出现在 rootBackground 那一行:整份文件的代码面里 backgroundColor 只被用它一次
    const painted = src.match(/backgroundColor:/g)?.length ?? 0
    expect(painted).toBe(1)
    expect(/rootBackground[\s\S]{0,160}gray\.black[\s\S]{0,160}surface\.bg/.test(src)).toBe(true)
  })

  it('端内不得回到已被真机证伪的负 margin / paddingTop 凑带位', () => {
    const src = codeFace(sourceOf('player'))
    expect(/marginTop\s*:\s*-/.test(src)).toBe(false)
    expect(/paddingTop/.test(src)).toBe(false)
    expect(/statusBarHeight|currentHeight|insets\.top/.test(src)).toBe(false)
    // 而接线的确凿证据必须在代码位:两个全屏事件真的喂给了 <Video>
    expect(/onFullscreenPlayerDidPresent=\{handleFullscreenDidPresent\}/.test(src)).toBe(true)
    expect(/onFullscreenPlayerDidDismiss=\{handleFullscreenDidDismiss\}/.test(src)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
