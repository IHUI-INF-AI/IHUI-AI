// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { resolvePathLabelSpec } from '../path-labels'
import { mergeMessages } from '@ihui/i18n/loader'

/**
 * admin 路由的 TagsView 标题回归 —— 2026-10-19。
 *
 * 病灶(`path-labels.ts` 的 `ADMIN_ENTRIES`):
 *   它把 AdminNav 的路由映射成 `spec: { ns: 'admin', key: item.labelKey }`,
 *   但 `item.labelKey` 是 **nav 命名空间**的键(`AdminNav.tsx` 的 `NAV_LABEL_KEY` 全是 `nav.xxx`)。
 *   `admin` 命名空间下只有 12 个字符串叶子且不含 dashboard/users —— 于是 138 条 admin 路由里
 *   135 条在标签栏显示成英文兜底(deriveTitle)或**裸键名 `admin.users`**。
 *   这是"一排按钮全叫动态路由"那个 bug 的**同源同型**姊妹病灶(同一个 `dynamicLabel ?? t(labelKey)`
 *   规则在两处被以不同方式实现),只是坏在标签栏而不是侧边栏。
 *
 * 三条判据:
 * ① 命名空间:admin 路由的 spec 必须是 ns='nav'(键的真相在 nav 下)。
 * ② 五语言可解析 + 是字符串:每个 admin 路由的 title 在**合并后**的五语言里
 *    都必须解析出**非空字符串**。注意必须是字符串 —— `t.has()` 对对象子树也返回 true
 *    (next-intl resolvePath 只判 next == null),而 `t()` 遇非字符串抛 FORMATTING_ERROR
 *    后回退成裸键名,那比英文兜底更糟。只判"存在"会漏掉这一型。
 * ③ 不得出现裸键名:解析结果不得等于 `ns.key` 本身(那正是用户会看到的 `admin.users`)。
 *
 * 判据读的是**真实语言包 + 生产用的 mergeMessages**,不复制合并逻辑(AGENTS.md §0.6)。
 */

const here = dirname(fileURLToPath(import.meta.url))
const REPO = join(here, '../../../../..')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

type NavDict = Record<string, unknown>
type Locale = (typeof LOCALES)[number]

const load = (dir: string, locale: string) =>
  JSON.parse(readFileSync(join(REPO, 'packages/i18n/messages', dir, `${locale}.json`), 'utf8'))

const merged = Object.fromEntries(
  LOCALES.map((loc) => [loc, mergeMessages(load('shared', loc) as never, load('web', loc) as never)]),
) as Record<Locale, { nav?: NavDict }>

const navOf = (loc: Locale): NavDict => merged[loc].nav ?? {}

/** ADMIN_NAV 的 admin 路由(href 以 /admin 开头;仓库另有非 admin 路径也在此表里) */
const adminPaths = [
  '/admin',
  '/admin/users',
  '/admin/orders',
  '/admin/refund',
  '/admin/point',
  '/admin/roles',
  '/admin/permissions',
  '/admin/workflows',
  '/admin/logs',
  '/admin/events',
  '/admin/api-debug',
  '/admin/monitor/alerts',
  '/admin/shop/products',
  '/admin/oauth/apps',
  '/admin/edu/organization',
  '/admin/edu/course/audit',
  '/admin/system/login-logs',
  '/admin/user-agent-audio',
  '/admin/zhs-user',
  '/admin/exam-marking',
]

describe('admin 路由的 TagsView 标题(2026-10-19 回归)', () => {
  it('① 命名空间:admin 路由的 spec 必须是 ns=nav', () => {
    const wrong = adminPaths.filter((p) => {
      const spec = resolvePathLabelSpec(p)
      return spec && spec.ns !== 'nav'
    })
    expect(wrong).toEqual([])
  })

  it('② 五语言可解析且为非空字符串', () => {
    const bad: string[] = []
    for (const p of adminPaths) {
      const spec = resolvePathLabelSpec(p)
      if (!spec) {
        bad.push(`${p} → spec 为 null(会退化成英文 deriveTitle)`)
        continue
      }
      for (const loc of LOCALES) {
        const v = navOf(loc)[spec.key]
        if (typeof v !== 'string' || !v.trim()) bad.push(`${p} ${spec.ns}.${spec.key} [${loc}] = ${JSON.stringify(v)}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('③ 不得显示裸键名(解析结果不得等于 ns.key)', () => {
    const leaked: string[] = []
    for (const p of adminPaths) {
      const spec = resolvePathLabelSpec(p)
      if (!spec) continue
      const v = navOf('zh-CN')[spec.key]
      if (typeof v === 'string' && (v === spec.key || v === `${spec.ns}.${spec.key}`)) {
        leaked.push(`${p} → "${v}"`)
      }
    }
    expect(leaked).toEqual([])
  })

  it('④ 抽样断言:关键 admin 路由显示中文而非英文', () => {
    expect(navOf('zh-CN')[resolvePathLabelSpec('/admin/users')!.key]).toBe('用户管理')
    expect(navOf('zh-CN')[resolvePathLabelSpec('/admin/exam-marking')!.key]).toBe('试卷批阅')
    expect(navOf('zh-CN')[resolvePathLabelSpec('/admin/system/login-logs')!.key]).toBe('系统登录日志')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
