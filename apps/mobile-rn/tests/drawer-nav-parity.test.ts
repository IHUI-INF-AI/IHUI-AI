// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DRAWER_AUTOMATION_ITEM,
  DRAWER_HOME_ITEM,
  DRAWER_NAV_GROUPS,
  DRAWER_NAV_SECTIONS,
  type DrawerNavItem,
} from '../src/navigation/drawer-nav'
import { DOMAIN_HUBS } from '../src/navigation/domain-hub'

/**
 * 抽屉导航单源的**结构锁**(2026-10-20 立)。
 *
 * 立因:RN 抽屉与 web 侧边栏此前各写一份清单,漂移到"两端差距太大"才被发现。
 * 迁出单源(`navigation/drawer-nav.ts`)只解决了"只有一份",没解决"这份会不会烂":
 *  - 填一个不存在的 i18n 键 → 抽屉显示裸 key(不报错、只有用户看得见);
 *  - 填一个未注册的路由名 → 点击即崩(RN navigate 到未注册屏);
 *  - 同一路由登记两次 → 双条目 / React key 冲突(web nav-data 里已有同型病的注记)。
 * 这三种都不是类型错误,tsc 一律放行,只能靠本锁钉住。
 *
 * 判据全部读**真源**(五语言包 + RootNavigator 源码),不复制清单 —— 复制即漂移。
 */

const APP = process.cwd()
const I18N_DIR = join(APP, '../../packages/i18n/messages/mobile-rn')
// 运行时是 shared ⊕ mobile-rn 深合并(见 src/i18n/index.tsx),判据必须同口径:
// 只查端包会把 `nav.home` / `help.title` 这类住在 shared 的键误报成缺键。
const SHARED_DIR = join(APP, '../../packages/i18n/messages/shared')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

function flatten(items: readonly DrawerNavItem[]): DrawerNavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flatten(item.children) : [])])
}

/** 抽屉里实际会渲染出来的行:各组条目 + 首页行 + 快捷区自动化任务 */
const renderedItems = [
  ...DRAWER_NAV_GROUPS.flatMap((group) => flatten(group.items)),
  DRAWER_HOME_ITEM,
  DRAWER_AUTOMATION_ITEM,
]

function lookup(pack: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, seg) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[seg] : undefined,
      pack,
    )
}

describe('抽屉导航单源(对齐 web 侧边栏)', () => {
  it('竖排序列引用的分组与域都真实存在', () => {
    const groupKeys = new Set(DRAWER_NAV_GROUPS.map((group) => group.key))
    for (const section of DRAWER_NAV_SECTIONS) {
      if (section.kind === 'group') {
        expect(groupKeys.has(section.key), `序列引用了不存在的分组: ${section.key}`).toBe(true)
      } else {
        expect(DOMAIN_HUBS[section.domain], `序列引用了不存在的域: ${section.domain}`).toBeTruthy()
      }
    }
  })

  it('域入口顺序对齐 web:教育 → 内容 → 交易', () => {
    const domains = DRAWER_NAV_SECTIONS.flatMap((section) =>
      section.kind === 'domain' ? [section.domain] : [],
    )
    expect(domains.slice(0, 3)).toEqual(['edu', 'content', 'trade'])
  })

  it('每个条目的 labelKey 五语言齐全(裸 key 只有用户看得见)', () => {
    const packs = LOCALES.map((locale) => ({
      locale,
      end: JSON.parse(readFileSync(join(I18N_DIR, `${locale}.json`), 'utf-8')) as unknown,
      shared: JSON.parse(readFileSync(join(SHARED_DIR, `${locale}.json`), 'utf-8')) as unknown,
    }))
    for (const item of renderedItems) {
      for (const { locale, end, shared } of packs) {
        const value = lookup(end, item.labelKey) ?? lookup(shared, item.labelKey)
        expect(typeof value, `${locale} 缺键 ${item.labelKey}`).toBe('string')
      }
    }
  })

  it('每个条目的目标路由都在 RootNavigator 注册(不放假入口)', () => {
    const src = readFileSync(join(APP, 'src/navigation/RootNavigator.tsx'), 'utf-8')
    for (const item of renderedItems) {
      if (!item.route) continue
      // Main Tab 容器不是根栈路由(HomeMain/ProfileMain 由 Main 栈承载)
      if (item.route === 'HomeMain' || item.route === 'ProfileMain') continue
      expect(src.includes(`name="${item.route}"`), `未注册路由: ${item.route}`).toBe(true)
    }
  })

  it('同一层级内路由不重复登记(避免双条目 / key 冲突)', () => {
    const assertUnique = (items: readonly DrawerNavItem[], where: string) => {
      const routes = items.map((item) => item.route).filter((r): r is string => Boolean(r))
      expect(new Set(routes).size, `${where} 有重复路由: ${routes.join(', ')}`).toBe(routes.length)
      for (const item of items) {
        if (item.children) assertUnique(item.children, `${where}/${item.labelKey}`)
      }
    }
    // 顶层 = 各组条目 + 快捷区自动化任务(首页行走 Main Tab 容器,不参与)
    assertUnique(
      [...DRAWER_NAV_GROUPS.flatMap((group) => group.items), DRAWER_AUTOMATION_ITEM],
      '顶层',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
