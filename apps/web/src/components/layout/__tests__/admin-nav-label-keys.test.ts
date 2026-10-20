// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ADMIN_NAV, ADMIN_NAV_GROUPS } from '@/components/layout/AdminNav'
import { mergeMessages } from '@ihui/i18n/loader'

/**
 * ADMIN_NAV 标签键完整性 —— 2026-10-19「根治」票。
 *
 * 背景(与 `admin-group-item-labels.test.ts` / `admin-path-labels.test.ts` 同族,是它们的**总闸**):
 *   `AdminNav.tsx` 的 `NAV_LABEL_KEY: Record<AdminNavItem['labelKey'], string>` 把每个 labelKey
 *   映到一个**完整 i18n 键**。TypeScript 的 `Record<>` 只保证"表项齐全",**不保证表值指向的键真的存在**
 *   —— 写 `'nav.typo'` 一样编译通过。真跑起来 next-intl 找不到键时:`t.has()` 返回 false(该走英文兜底),
 *   而当键命中**对象子树**时 `t.has()` 反而返回 true(use-intl 的 `resolvePath` 只判 `next == null`),
 *   `t()` 抛 FORMATTING_ERROR 后**回退成裸键名 `admin.xxx`** —— 用户在标签栏直接看到键名。
 *
 *   本仓已因此实际坏过:现读 `NAV_LABEL_KEY` 162 项里有 10 项指向不存在的键(feedbacks/configs/
 *   agentCategories/agentExamine/databaseOptimization/carousel/agentRule/loginLogs + 两个孤儿
 *   systemConfig/saasMetrics),对应 8 条**真实可达**的 admin 路由在 TagsView 上显示英文兜底。
 *
 * 三条判据:
 * ① **无悬空键**:NAV_LABEL_KEY 的每个值在合并后的五语言里都必须解析出**非空字符串**。
 *    必须是字符串而非"存在"—— 对象子树会让 t() 回退成裸键名,那是比英文兜底更糟的形态。
 * ② **无孤儿条目**:NAV_LABEL_KEY 的每个键都必须真被 ADMIN_NAV / ADMIN_NAV_GROUPS 的某项用到。
 *    反向漂移(删了菜单项却留着映射行)同样是债,且会让 ① 的覆盖面虚高。
 * ③ **无死映射**:ADMIN_NAV / ADMIN_NAV_GROUPS 的每个 labelKey 都必须在 NAV_LABEL_KEY 里登记。
 *    这是 `Record<>` 已经保证的一半,这里显式钉住,防有人把 Record 降级成 Partial 后静默漏登记。
 *
 * 判据读**真实语言包 + 生产用的 mergeMessages**,不复制合并逻辑(AGENTS.md §0.6);
 * 解析函数 import `AdminNav` 真模块而非复制其数组(同源,§22c)。
 */

const here = dirname(fileURLToPath(import.meta.url))
const REPO = join(here, '../../../../../..')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
type Locale = (typeof LOCALES)[number]
type NavDict = Record<string, unknown>

const load = (dir: string, locale: string) =>
  JSON.parse(readFileSync(join(REPO, 'packages/i18n/messages', dir, `${locale}.json`), 'utf8'))

const merged = Object.fromEntries(
  LOCALES.map((loc) => [
    loc,
    mergeMessages(load('shared', loc) as never, load('web', loc) as never),
  ]),
) as Record<Locale, { nav?: NavDict }>

const navOf = (loc: Locale): NavDict => merged[loc].nav ?? {}

/** 按点分路径取词条(任意命名空间)。① 与 ② 两处判据共用,避免同一逻辑写两遍(§0.6)。 */
const lookup = (loc: Locale, dottedKey: string): unknown => {
  const parts = dottedKey.split('.')
  let cur: unknown = merged[loc]
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object' || !(part in cur))
      return undefined
    cur = (cur as NavDict)[part]
  }
  return cur
}

const adminNavSrc = readFileSync(join(REPO, 'apps/web/src/components/layout/AdminNav.tsx'), 'utf8')
const tableBlock = adminNavSrc.slice(
  adminNavSrc.indexOf('const NAV_LABEL_KEY'),
  adminNavSrc.indexOf('\n}', adminNavSrc.indexOf('const NAV_LABEL_KEY')),
)
const TABLE: { key: string; i18nKey: string }[] = [
  ...tableBlock.matchAll(/(\w+):\s*'([\w.]+)'/g),
].map(
  // matchAll 的组在类型上是 `string | undefined`(noUncheckedIndexedAccess),此处模式已保证捕获
  (m) => ({ key: m[1] ?? '', i18nKey: m[2] ?? '' }),
)

const USED = new Set<string>([
  ...ADMIN_NAV.map((i) => i.labelKey),
  ...ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.labelKey)),
])

describe('ADMIN_NAV 标签键完整性(2026-10-19 根治)', () => {
  it('① 无悬空键:每个映射值在五语言都解析出非空字符串', () => {
    // 取材非空自证:空表恒绿
    expect(TABLE.length).toBeGreaterThan(100)

    const bad: string[] = []
    for (const { key, i18nKey } of TABLE) {
      for (const loc of LOCALES) {
        const v = lookup(loc, i18nKey)
        if (typeof v !== 'string' || !v.trim())
          bad.push(`${key} -> ${i18nKey} [${loc}] = ${JSON.stringify(v)}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('② 无孤儿条目:每个映射行都被真实菜单项用到(或被显式登记为观察期隐藏)', () => {
    // 例外机制(2026-10-19 加):`ADMIN_NAV` 里有**被注释掉**的菜单行 —— 2026-10-17 收敛决策把
    // monitoring-dashboard / backend-health / monitor-dashboard 三个"与 Grafana 重复约 85%"的
    // 页面**观察期隐藏**,注释里明写"恢复 = 取消注释"。
    //
    // 那三条的 labelKey 仍在联合类型与映射表里(必须留:取消注释时要能编译通过),若把判据写成
    // "表项必须被真模块用到",就会把它们判红 —— 而那是**把有意的可逆决策判成缺陷**,逼人删映射
    // 或取消注释,正是 §12e 恒红门的成因。故显式登记这三条为合法例外,并要求**它们的 i18n 键仍存在**
    // (否则将来真恢复时会立刻坏掉,而那天没人记得补词条)。
    const OBSERVATION_HIDDEN = ['backendHealth', 'monitoringDashboard', 'monitorDashboard']

    const orphans = TABLE.filter(
      (t) => !USED.has(t.key) && !OBSERVATION_HIDDEN.includes(t.key),
    ).map((t) => `${t.key} -> ${t.i18nKey}`)
    expect(orphans).toEqual([])

    // 例外项自身的词条必须齐 —— 登记是"暂缓"不是"豁免"
    for (const key of OBSERVATION_HIDDEN) {
      const row = TABLE.find((t) => t.key === key)
      expect(row, `${key} 不在映射表里`).toBeDefined()
      if (!row) continue
      for (const loc of LOCALES) {
        expect(typeof lookup(loc, row.i18nKey), `${key} [${loc}] 词条缺失,恢复时会显示键名`).toBe(
          'string',
        )
      }
    }
  })

  it('③ 无死映射:每个菜单项的 labelKey 都已登记', () => {
    const tableKeys = new Set(TABLE.map((t) => t.key))
    const missing = [...USED].filter((k) => !tableKeys.has(k))
    expect(missing).toEqual([])
  })

  it('④ 兜底键本身必须存在(AdminNav.tsx 的 t(...) ?? "nav.unknown")', () => {
    // 兜底键不存在 = 任何漏登记都会退化成"显示 unknown 这个词",比英文兜底更莫名其妙
    for (const loc of LOCALES) {
      expect(typeof navOf(loc).unknown).toBe('string')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
