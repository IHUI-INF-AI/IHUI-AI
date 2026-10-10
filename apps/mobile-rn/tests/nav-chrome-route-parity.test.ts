// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 顶栏 chrome 的**结构锁**:凡是渲染 <NavBar> 的屏,它的每一个注册路由名都必须在
// App.tsx 的 ROUTE_ROOT_BG 里拿到**同一档** tokens.surface.chrome。
//
// 为什么要有它:状态栏 inset 带由 App.tsx 那枚根 View 画,导航行由屏自己用 <NavChrome> 画,
// 两处各写各的 ⇒ 只要有一屏加了顶栏而忘了往路由表里加一行(或反过来),同一屏就露出两截色。
// 2026-10-10 用户实拍「顶部这个区域为什么是灰色的,怎么还有个灰色带呢」正是这个形态,
// 而当时靠的是"人记得两张表都要改"。本用例把"记得改"换成"改漏就红":
//  ① 屏清单**现读源码**(grep <NavBar),不是手抄名单 —— 名单必然腐烂(AGENTS §4 对
//     RN_ONLY_BRAND_KEYS 记过同一条教训);
//  ② 路由名从 RootNavigator 的 name=/component= 注册对现读,一屏多名(Home/HomeMain、
//     Agent/AiMain)必须**每个名**都在表里;
//  ③ 两侧取值必须同为 surface.chrome:NavChrome 那侧与 ROUTE_ROOT_BG 那侧任何一侧换档即红;
//  ④ 例外表是台账不是后门:每条必须带 reason,且指向的屏**此刻确实渲染 NavBar**
//     (屏不再渲染 NavBar 了还挂着例外 ⇒ 清单腐烂,判红)。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const SCREENS_DIR = join(ROOT, 'src/screens')
const CHROME_TIER = 'surface.chrome'

/**
 * 刻意不收口的屏:顶色是各自的定档,套 chrome 会把它们推给白档。
 * 每条必须带理由,且由本用例反向核"它今天还在渲染 NavBar" —— 不在了就是腐烂。
 */
const DECLARED_EXCEPTIONS: Record<string, string> = {
  CoursePlanetScreen:
    'ROUTE_ROOT_BG 给的是课程星球渐变定档(2026-09 定稿),导航行透出的是渐变而不是 chrome',
  MoreCourseScreen: '同上:更多课程顶色走自己的渐变定档,不得被 chrome 一刀切',
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
  // 简写形态 `Route: (t) => t.surface.chrome,` 已被上面覆盖;三元形态单独收
  const reTernary =
    /^\s*([A-Za-z][\w]*):\s*\(t,\s*\w+\)\s*=>\s*\([^)]*\)\s*\?\s*t\.(\w+)\.(\w+)\s*:\s*t\.(\w+)\.(\w+)/gm
  while ((m = reTernary.exec(body)) !== null) {
    if (m[1] && m[3] && m[5]) out[m[1]] = 'ternary:' + m[3] + '|' + m[5]
  }
  return out
}

describe('顶栏 chrome 结构锁(AGENTS §4「判据必须覆盖门自己产出的形态」同族)', () => {
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

  it('这些屏的每一个注册路由名,在 App.tsx 里都取 surface.chrome', () => {
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
        if (tiers[n] !== CHROME_TIER)
          offenders.push(`${screen} → ${n} 取的是 ${tiers[n] ?? '(表里没有这一行)'}`)
      }
    }
    expect(
      unregistered,
      '这些屏在 RootNavigator 里找不到注册名(改名/搬家?):\n' + unregistered.join('\n'),
    ).toEqual([])
    expect(offenders, '带色表与顶栏档不一致:\n' + offenders.join('\n')).toEqual([])
  })

  it('NavChrome 与 ROUTE_ROOT_BG 读的是同一档(任何一侧换档即红)', () => {
    const chromeSrc = read(join(ROOT, 'src/components/NavChrome.tsx'))
    expect(chromeSrc, 'NavChrome 不再取 tokens.surface.chrome ⇒ 与带色表分叉').toMatch(
      /backgroundColor:\s*tokens\.surface\.chrome/,
    )
    expect(Object.values(tiers).filter((v) => v === CHROME_TIER).length).toBeGreaterThan(0)
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
