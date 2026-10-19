// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ADMIN_NAV_GROUPS } from '@/components/layout/AdminNav'
import { NAV_GROUPS } from '../nav-data'
import { mergeMessages } from '@ihui/i18n/loader'
import type { NavItem } from '../types'

/**
 * admin 分组菜单项取名回归 —— 2026-10-19「一排按钮全叫『动态路由』」的锁。
 *
 * 病灶(单一真相在渲染侧的取名规则 `dynamicLabel ?? t(labelKey)`):
 *   `nav-data.ts` 的 `adminGroupToNavItem` 曾把子项 `labelKey` **硬编码成 'adminDynamic'**
 *   (= "动态路由"),把 `item.labelKey` 整个盖掉。于是任何**缺 dynamicLabel** 的分组项
 *   都 fallback 到同一句占位符 —— 现读 76 项里 22 项中招(aiAgent 组 20 + saas 组 2),
 *   表现为一排同名按钮。
 *
 * 三条判据,少一条就是没牙:
 *  ① **透传锁**:adminGroupToNavItem 不得再把子项 labelKey 写成常量。
 *     这是病灶本体,判源码;后两条判后果。正向对照用 group item 的 labelKey 全集:
 *     一旦又有人写死,②③ 必然随之变红,但① 先把病灶点出来。
 *  ② **无占位符后果锁**:每个分组项最终取到的名字都不得等于 `nav.adminDynamic`
 *     (动态路由 / Dynamic Routes / 動的ルート / 동적 라우트 / 動態路由)。
 *     真正该显示占位符的场景不存在 —— 兜底也该是各自 i18n。
 *  ③ **五语言可解析锁**:每个分组项的 labelKey 在 shared+web 合并后的五语言里
 *     都必须存在且非空(§19:新增状态词必须同批补齐五语言)。
 *     这条抓的是"改完透传,但忘了补词条" —— 那种情况下 t() 返回 key 路径,
 *     侧边栏会出现 `saasTenants` 这种裸键名,同样是坏体验。
 *
 * 为什么必须读真实语言包:判据的输入若与被修的源码不同源,就会自锁/漏判
 * (AGENTS.md §0.6 单一真相源)。这里直接 import 生产用的 `mergeMessages`,
 * 不复制一份合并逻辑。
 */

const here = dirname(fileURLToPath(import.meta.url))
const REPO = join(here, '../../../../../..')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

const load = (dir: string, locale: string) =>
  JSON.parse(readFileSync(join(REPO, 'packages/i18n/messages', dir, `${locale}.json`), 'utf8'))

type NavDict = Record<string, unknown>
const merged = Object.fromEntries(
  LOCALES.map((loc) => [
    loc,
    mergeMessages(load('shared', loc) as never, load('web', loc) as never),
  ]),
) as Record<(typeof LOCALES)[number], { nav?: NavDict }>

const navOf = (loc: (typeof LOCALES)[number]): NavDict => merged[loc].nav ?? {}

/** 占位符的**全部**五语言取值 —— 判"fallback 到了占位符"必须五语言同时认,否则换个语言就漏判 */
const PLACEHOLDER = new Set(LOCALES.map((loc) => String(navOf(loc).adminDynamic)))

/**
 * **渲染产物**:Sidebar 真正拿去渲染的那棵树(Sidebar.tsx 的 visibleGroups 源自此)。
 *
 * 为什么必须判它而不是判 ADMIN_NAV_GROUPS 源数据 —— 这是本测试第一版的真实缺陷:
 * 阳性对照把 nav-data.ts 退回病灶态(硬编码 'adminDynamic')后,只有①翻红,
 * ②③④ 全绿 —— 因为那三条读的是**转换之前**的源数据,而病灶发生在**转换之中**。
 * 判据输入与被修的对象不同源 ⇒ 后果锁根本不锁后果(AGENTS.md §22c/§0.6)。
 * 判据必须打在病灶真正发生的那一层。
 */
const renderedItems = NAV_GROUPS.flatMap((g) =>
  (g.items.flatMap((item) => (item.children?.length ? item.children : [item])) as NavItem[]).map(
    (item) => ({ group: g.label, ...item }),
  ),
).filter((item) => ADMIN_NAV_GROUPS.some((g) => g.items.some((src) => src.href === item.href)))

describe('admin 分组菜单项取名(2026-10-19 回归)', () => {
  it('① 透传锁:adminGroupToNavItem 不得把子项 labelKey 写死成常量', () => {
    const src = readFileSync(join(here, '../nav-data.ts'), 'utf8')
    const fn = src.slice(src.indexOf('function adminGroupToNavItem'))
    // 只取 children 的 map 回调块:父级那一行是 `labelKey: `adminGroup.${…}`` 模板字符串,
    // 本来就该是动态的,把它算进来会误伤(判据缺陷,不是代码缺陷)。
    const start = fn.indexOf('children: group.items.map(')
    expect(start).toBeGreaterThan(-1)
    const childrenBlock = fn.slice(start, fn.indexOf('})', start))
    expect(childrenBlock).toMatch(/labelKey:\s*item\.labelKey/)
    expect(childrenBlock).not.toMatch(/labelKey:\s*['"`]/)
  })

  it('② 无占位符后果锁:渲染产物里没有一项会显示成「动态路由」', () => {
    const offenders = renderedItems
      .filter((i) => PLACEHOLDER.has(i.dynamicLabel ?? ''))
      .map((i) => `${i.group} ${i.href}`)
    expect(offenders).toEqual([])
  })

  it('③ 五语言可解析锁:缺 dynamicLabel 的项,其 labelKey 五语言都存在且非空', () => {
    // 只判**会真正走到 t()** 的项。渲染规则是 `dynamicLabel ?? t(labelKey)`:
    // 带 dynamicLabel 的项(AdminNav 里大量 `labelKey: 'dashboard'` + 中文 dynamicLabel)
    // 根本不会解析 labelKey,而 `nav.dashboard` 全五语言都不存在 —— 那不是缺陷,是短路。
    // 把它们算进来会把本判据变成恒红门(§12e)。
    const needsI18n = renderedItems.filter((i) => i.dynamicLabel === undefined)
    expect(needsI18n.length).toBeGreaterThan(0)
    const bad: string[] = []
    for (const item of needsI18n) {
      for (const loc of LOCALES) {
        const v = navOf(loc)[item.labelKey]
        if (typeof v !== 'string' || !v.trim())
          bad.push(`${item.group} ${item.href} ${item.labelKey} [${loc}]`)
      }
    }
    expect(bad).toEqual([])
  })

  it('④ 取名唯一性:分组项之间不得出现重复显示名(用户报障的原话是"同名按钮")', () => {
    const seen = new Map<string, string[]>()
    for (const item of renderedItems) {
      // 与渲染侧同规则:dynamicLabel 优先,否则取 zh-CN 翻译
      const label = item.dynamicLabel ?? String(navOf('zh-CN')[item.labelKey] ?? item.labelKey)
      seen.set(label, [...(seen.get(label) ?? []), `${item.group} ${item.href}`])
    }
    const dup = [...seen.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([k, v]) => `${k} <- ${v.join(', ')}`)
    expect(dup).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
