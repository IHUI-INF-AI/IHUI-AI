// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 顶栏透明后的**结构锁**(2026-11-24 起):凡是渲染 <NavBar> 的屏,它的每一个注册路由名
// 都必须在 App.tsx 的 ROUTE_ROOT_BG 里拿到**页面同档** tokens.surface.bg。
//
// 为什么要有它:状态栏 inset 带由 App.tsx 那枚根 View 画,导航行由屏内透明 <NavChrome> 透出页面底;
// 两处各写各的 ⇒ 只要有一屏加了顶栏而忘了往路由表里加一行(或反过来),同一屏仍会露出两截色
// (2026-10-10 用户实拍「顶部这个区域为什么是灰色的,怎么还有个灰色带呢」就是这一形态)。
// 2026-11-24 用户再定「整条顶部栏跟底部菜单栏同一套样式 token,改一处双方都生效」:
// NavChrome 与 TabBar.container 都 spread `theme/glass-bar-surface.ts` 的 GLASS_BAR_SURFACE,
// 页面底仍由 route 表给 surface.bg(玻璃半透时下面透出的就是这一档)。
//  ① 屏清单**现读源码**(grep <NavBar),不是手抄名单 —— 名单必然腐烂(AGENTS §4 对
//     RN_ONLY_BRAND_KEYS 记过同一条教训);
//  ② 路由名从 RootNavigator 的 name=/component= 注册对现读,一屏多名(Home/HomeMain、
//     Agent/AiMain)必须**每个名**都在表里;
//  ③ 页面底仍须为 surface.bg,避免玻璃顶栏背后透出两截页底色;
//  ④ 顶栏/底栏必须共用同一枚 surface,端内不得各自再写背景/描边/圆角/阴影;
//  ⑤ 例外表是台账不是后门:每条必须带 reason,且指向的屏**此刻确实渲染 NavBar**
//     (屏不再渲染 NavBar 了还挂着例外 ⇒ 清单腐烂,判红)。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const SCREENS_DIR = join(ROOT, 'src/screens')
const PAGE_TIER = 'surface.bg'

/**
 * 刻意不收口的屏:顶色是各自的定档,套页面底会把它们推平。
 * 每条必须带理由,且由本用例反向核"它今天还在渲染 NavBar" —— 不在了就是腐烂。
 */
const DECLARED_EXCEPTIONS: Record<string, string> = {
  // 2026-11-03:CoursePlanet/MoreCourse 改共享屏薄壳后不再渲染 NavBar,原两条渐变例外已摘除。
}

function read(p: string): string {
  return readFileSync(p, 'utf8')
}

/** 去掉行注释与块注释,避免"注释里提到 <NavBar"被当成渲染点 */
function codeFace(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function screensRenderingNavBar(): string[] {
  return readdirSync(SCREENS_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => /<NavBar[\s/>]/.test(codeFace(read(join(SCREENS_DIR, f)))))
    .map((f) => f.replace(/\.tsx$/, ''))
}

/** RootNavigator 现读:组件名 → 它注册到的全部路由名 */
function routeNamesByComponent(): Record<string, string[]> {
  const src = read(join(ROOT, 'src/navigation/RootNavigator.tsx'))
  const map: Record<string, string[]> = {}
  const re = /<\w+\.Screen\s+name="([^"]+)"(?:\s+component=\{(\w+)\})?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const comp = m[2]
    const routeName = m[1]
    if (!comp || !routeName) continue
    ;(map[comp] ??= []).push(routeName)
  }
  return map
}

/** App.tsx 的 ROUTE_ROOT_BG:路由名 → 它取的 token 路径(取 `t.surface.X` / `t.gray.X` 末两段) */
function routeRootBgTier(): Record<string, string> {
  const src = read(join(ROOT, 'App.tsx'))
  const start = src.indexOf('const ROUTE_ROOT_BG')
  expect(start, 'App.tsx 里找不到 ROUTE_ROOT_BG(改名即视为锁失效)').toBeGreaterThan(-1)
  const body = src.slice(
    start,
    src.indexOf('\n}', start) > 0 ? src.indexOf('\n};', start) : src.length,
  )
  const out: Record<string, string> = {}
  const re =
    /^\s*([A-Za-z][\w]*):\s*\(?[^)]*?\)?\s*=>\s*t\.(surface|gray|brand|background)\.(\w+)/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    if (m[1] && m[2] && m[3]) out[m[1]] = m[2] + '.' + m[3]
  }
  // 简写形态 `Route: (t) => t.surface.bg,` 已被上面覆盖;三元形态单独收
  const reTernary =
    /^\s*([A-Za-z][\w]*):\s*\(t,\s*\w+\)\s*=>\s*\([^)]*\)\s*\?\s*t\.(\w+)\.(\w+)\s*:\s*t\.(\w+)\.(\w+)/gm
  while ((m = reTernary.exec(body)) !== null) {
    if (m[1] && m[3] && m[5]) out[m[1]] = 'ternary:' + m[3] + '|' + m[5]
  }
  return out
}

describe('顶栏/底栏共用玻璃面 + 页面底结构锁(AGENTS §4「判据必须覆盖门自己产出的形态」同族)', () => {
  const navBarScreens = screensRenderingNavBar()
  const namesByComponent = routeNamesByComponent()
  const tiers = routeRootBgTier()

  it('现读必须有屏渲染 NavBar,且清单非空(空清单 = 尺子失效,不是"都已收口")', () => {
    expect(
      navBarScreens.length,
      'src/screens 里一个 <NavBar> 渲染点都没读到 ⇒ 判据失明',
    ).toBeGreaterThan(0)
    expect(Object.keys(namesByComponent).length).toBeGreaterThan(0)
    expect(Object.keys(tiers).length).toBeGreaterThan(0)
  })

  it('每个渲染 NavBar 的屏都真的用 <NavChrome> 包(例外须进台账并带理由)', () => {
    const unwrapped = navBarScreens.filter(
      (s) =>
        !/<NavChrome>/.test(codeFace(read(join(SCREENS_DIR, `${s}.tsx`)))) &&
        !(s in DECLARED_EXCEPTIONS),
    )
    expect(unwrapped, '这些屏把导航行裸放在 shell 上:\n' + unwrapped.join('\n')).toEqual([])
  })

  it('这些屏的每一个注册路由名,在 App.tsx 里都取 surface.bg', () => {
    const offenders: string[] = []
    const unregistered: string[] = []
    for (const screen of navBarScreens) {
      if (screen in DECLARED_EXCEPTIONS) continue
      const names = namesByComponent[screen]
      if (!names?.length) {
        unregistered.push(screen)
        continue
      }
      for (const n of names) {
        if (tiers[n] !== PAGE_TIER)
          offenders.push(`${screen} → ${n} 取的是 ${tiers[n] ?? '(表里没有这一行)'}`)
      }
    }
    expect(
      unregistered,
      '这些屏在 RootNavigator 里找不到注册名(改名/搬家?):\n' + unregistered.join('\n'),
    ).toEqual([])
    expect(offenders, '带色表与顶栏档不一致:\n' + offenders.join('\n')).toEqual([])
  })

  it('顶栏与底栏共用同一枚玻璃面,端内不得各自重写背景/描边/圆角/阴影', () => {
    const chromeSrc = read(join(ROOT, 'src/components/NavChrome.tsx'))
    const tabSrc = read(join(ROOT, 'src/components/TabBar.styles.ts'))
    const surfaceSrc = read(join(ROOT, 'src/theme/glass-bar-surface.ts'))

    // 两侧都只 spread 单一源,不再各自铺色
    expect(chromeSrc, 'NavChrome 没接 GLASS_BAR_SURFACE ⇒ 顶栏与底栏分叉').toMatch(
      /\.\.\.GLASS_BAR_SURFACE/,
    )
    expect(tabSrc, 'TabBar.container 没接 GLASS_BAR_SURFACE ⇒ 底栏与顶栏分叉').toMatch(
      /\.\.\.GLASS_BAR_SURFACE/,
    )
    expect(tabSrc, 'TabBar 又在端内写了一份 glass 背景 ⇒ 改一处不会双方生效').not.toMatch(
      /backgroundColor:\s*tk\.glass\.bg/,
    )
    expect(chromeSrc, 'NavChrome 又铺回 transparent ⇒ 整条顶栏没有玻璃面').not.toMatch(
      /backgroundColor:\s*'transparent'/,
    )

    // 单一源自身必须取这两条共同 token(缺一条就等于某一侧被悄悄改档)
    expect(surfaceSrc, '玻璃面没取 glass.bg').toMatch(/backgroundColor:\s*tk\.glass\.bg/)
    expect(surfaceSrc, '玻璃面没取 border.light').toMatch(/borderColor:\s*tk\.border\.light/)
    expect(surfaceSrc, '玻璃面没取 rnRadius.xl').toMatch(/borderRadius:\s*rnRadius\.xl/)
    expect(surfaceSrc, '玻璃面没取 ELEVATION_STEPS.lg').toMatch(/ELEVATION_STEPS\.lg/)
    expect(surfaceSrc, '玻璃面没取底部同一条模糊半径').toMatch(/TAB_BAR_GLASS_BLUR_PX/)

    expect(Object.values(tiers).filter((v) => v === PAGE_TIER).length).toBeGreaterThan(0)
  })

  it('例外台账不得腐烂:每条指向的屏此刻确实还在渲染 NavBar', () => {
    const stale = Object.keys(DECLARED_EXCEPTIONS).filter((s) => !navBarScreens.includes(s))
    expect(stale, '这些例外指向的屏已经不渲染 NavBar 了,应删行:\n' + stale.join('\n')).toEqual([])
    for (const [screen, reason] of Object.entries(DECLARED_EXCEPTIONS)) {
      expect(reason.trim().length, `${screen} 的例外必须带理由`).toBeGreaterThan(10)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
