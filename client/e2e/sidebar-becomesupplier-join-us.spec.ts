/**
 * 侧边栏 nav span 文字"加入我们"防回归守门 (2026-07-03)
 *
 * 背景: 2026-07-02 用户在 sidebar nav 上看到 "成为供应商" 文字, 希望改为更亲切的
 *       "加入我们". 修改范围涉及 6 语言 × 4 处 i18n 文件 (navigation / routes /
 *       aboutUs / core) + Sidebar.vue + HeaderNavigation.vue 模板 + useSidebar
 *       注释 + useSidebar 测试 + README 导航说明. 任一处遗漏都会让用户在不同语言
 *       或不同入口看到 "成为供应商" 旧值, 形成视觉不一致.
 *
 * 本 spec 在源码级别锁定:
 *   1) 6 语言 navigation.becomeSupplier 必须是"加入我们"族 (sidebar/header dropdown 共用)
 *   2) 6 语言 routes.becomeSupplier 必须是"加入我们"族 (MobileMenu 菜单 + 路由 document.title)
 *   3) 6 语言 aboutUs.quickNav.becomeSupplier 必须是"加入我们"族 (about 页面快捷链接)
 *   4) 6 语言 core.aboutUs.becomeSupplier 必须是"加入我们"族 (核心模块快捷入口)
 *   5) Sidebar.vue 渲染的 span 必须 t('navigation.becomeSupplier') 而非硬编码
 *   6) HeaderNavigation.vue 渲染的 label 必须 t('navigation.becomeSupplier')
 *   7) useSidebar.ts 注释中 4 字 label 案例使用"加入我们"
 *   8) useSidebar.test.ts 注释与实现一致
 *   9) README.md 导航列表含"加入我们"作为示例文案
 *
 * 该 spec 跑通 = 6 语言 4 入口全部统一为"加入我们"族; 任一断言失败 = 某处又改回了"成为供应商"
 * 或某种语言的"成為供應商"/"サプライヤーになる"/"공급업체가 되기"/"Become a Supplier".
 *
 * 注: becomeSupplier.json 的 title 字段是页面 h1 标题 (成为供应商 / Become a Supplier)
 *     保留不变, 不在本 spec 范围内.
 */

import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const LOCALES = ['zh-CN', 'en', 'en-US', 'zh-TW', 'ja', 'ko'] as const

// "加入我们"族精确值 (与本轮 commit 锁定的 6 语言版本一一对应)
//   - navigation / routes / aboutUs.quickNav / core.aboutUs 共用同一族
//   - 任何修改这 4 个 i18n 键的 PR 必须同时更新本表, 否则本 spec 必失败
const EXPECTED_JOIN_US: Record<typeof LOCALES[number], string> = {
  'zh-CN': '加入我们',
  en: 'Join Us',
  'en-US': 'Join Us',
  'zh-TW': '加入我們',
  ja: '参加する',
  ko: '참여하기',
}

const NAVIGATION_FILES = LOCALES.map(loc => join(ROOT, `src/locales/modules/${loc}/navigation.json`))
const ROUTES_FILES = LOCALES.map(loc => join(ROOT, `src/locales/modules/${loc}/routes.json`))
const ABOUT_US_FILES = LOCALES.map(loc => join(ROOT, `src/locales/modules/${loc}/aboutUs.json`))
const CORE_FILES = LOCALES.map(loc => join(ROOT, `src/locales/modules/${loc}/core.json`))

const SIDEBAR_VUE = join(ROOT, 'src/components/Sidebar.vue')
const HEADER_NAV_VUE = join(ROOT, 'src/components/header/HeaderNavigation.vue')
const USE_SIDEBAR_TS = join(ROOT, 'src/composables/useSidebar.ts')
const USE_SIDEBAR_TEST = join(ROOT, 'src/composables/__tests__/useSidebar.test.ts')
const README = join(ROOT, '../README.md')

// 工具: 从 JSON 字符串中提取 `key: "value"` 形式 (顶层 + quickNav 嵌套)
function extractFieldValue(src: string, key: string): string | null {
  // 顶层 "key": "value"
  const top = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`)
  const m1 = src.match(top)
  if (m1) return m1[1]
  // 嵌套 "quickNav": { ... "key": "value" ... }
  const nested = new RegExp(`"quickNav"[\\s\\S]*?"${key}"\\s*:\\s*"([^"]*)"`)
  const m2 = src.match(nested)
  if (m2) return m2[1]
  return null
}

test.describe('侧边栏 nav span 文字"加入我们"防回归 (6 语言 × 4 入口)', () => {
  // ─────────────────────────────────────────────────────────────────────
  // 1) 源码级: 6 语言 navigation.becomeSupplier 必须是"加入我们"族
  //    影响: Sidebar.vue:905 + HeaderNavigation.vue:563,565
  // ─────────────────────────────────────────────────────────────────────
  for (let i = 0; i < LOCALES.length; i++) {
    const loc = LOCALES[i]
    const file = NAVIGATION_FILES[i]
    test(`源码级 1/4 [${loc}]: navigation.becomeSupplier = "${EXPECTED_JOIN_US[loc]}"`, () => {
      const src = readFileSync(file, 'utf-8')
      const value = extractFieldValue(src, 'becomeSupplier')
      expect(
        value,
        `${loc}/navigation.json: becomeSupplier 应是 "${EXPECTED_JOIN_US[loc]}" 而非 "${value}" (回归到"成为供应商"?)`,
      ).toBe(EXPECTED_JOIN_US[loc])
    })
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2) 源码级: 6 语言 routes.becomeSupplier 必须是"加入我们"族
  //    影响: MobileMenu.vue:100 (mobile 菜单) + router/modules/community.ts:441 (document.title)
  // ─────────────────────────────────────────────────────────────────────
  for (let i = 0; i < LOCALES.length; i++) {
    const loc = LOCALES[i]
    const file = ROUTES_FILES[i]
    test(`源码级 2/4 [${loc}]: routes.becomeSupplier = "${EXPECTED_JOIN_US[loc]}"`, () => {
      const src = readFileSync(file, 'utf-8')
      const value = extractFieldValue(src, 'becomeSupplier')
      expect(
        value,
        `${loc}/routes.json: becomeSupplier 应是 "${EXPECTED_JOIN_US[loc]}" 而非 "${value}" (mobile 菜单/document.title 仍是"成为供应商"?)`,
      ).toBe(EXPECTED_JOIN_US[loc])
    })
  }

  // ─────────────────────────────────────────────────────────────────────
  // 3) 源码级: 6 语言 aboutUs.quickNav.becomeSupplier 必须是"加入我们"族
  //    影响: /about 页面快捷导航区
  // ─────────────────────────────────────────────────────────────────────
  for (let i = 0; i < LOCALES.length; i++) {
    const loc = LOCALES[i]
    const file = ABOUT_US_FILES[i]
    test(`源码级 3/4 [${loc}]: aboutUs.quickNav.becomeSupplier = "${EXPECTED_JOIN_US[loc]}"`, () => {
      const src = readFileSync(file, 'utf-8')
      const value = extractFieldValue(src, 'becomeSupplier')
      expect(
        value,
        `${loc}/aboutUs.json: quickNav.becomeSupplier 应是 "${EXPECTED_JOIN_US[loc]}" 而非 "${value}"`,
      ).toBe(EXPECTED_JOIN_US[loc])
    })
  }

  // ─────────────────────────────────────────────────────────────────────
  // 4) 源码级: 6 语言 core.json 至少有一处 becomeSupplier = "加入我们"族
  //    影响: 全局 core 模块的 aboutUs 区快捷入口
  // ─────────────────────────────────────────────────────────────────────
  for (let i = 0; i < LOCALES.length; i++) {
    const loc = LOCALES[i]
    const file = CORE_FILES[i]
    test(`源码级 4/4 [${loc}]: core.aboutUs.becomeSupplier = "${EXPECTED_JOIN_US[loc]}"`, () => {
      const src = readFileSync(file, 'utf-8')
      // core.json 内有 2 处 becomeSupplier, 至少 1 处必须是"加入我们"族
      const matches = src.match(/"becomeSupplier"\s*:\s*"([^"]*)"/g) || []
      const values = matches.map(m => {
        const v = m.match(/"becomeSupplier"\s*:\s*"([^"]*)"/)
        return v ? v[1] : ''
      })
      expect(
        values.length,
        `${loc}/core.json 至少应有 1 处 becomeSupplier 字段`,
      ).toBeGreaterThanOrEqual(1)
      expect(
        values.some(v => v === EXPECTED_JOIN_US[loc]),
        `${loc}/core.json 所有 becomeSupplier 值 (${JSON.stringify(values)}) 都应至少含一处 "${EXPECTED_JOIN_US[loc]}"`,
      ).toBe(true)
    })
  }

  // ─────────────────────────────────────────────────────────────────────
  // 5) 模板源码级: Sidebar.vue 用 t('navigation.becomeSupplier') 而非硬编码"成为供应商"
  // ─────────────────────────────────────────────────────────────────────
  test('模板 1/3: Sidebar.vue 渲染 t("navigation.becomeSupplier") 不硬编码', () => {
    const src = readFileSync(SIDEBAR_VUE, 'utf-8')
    expect(
      src,
      'Sidebar.vue 仍引用 t("navigation.becomeSupplier") (侧边栏 nav 标签)',
    ).toMatch(/t\(\s*['"]navigation\.becomeSupplier['"]\s*\)/)
    expect(
      src,
      'Sidebar.vue 不应硬编码"成为供应商"中文 (回归到字面量?)',
    ).not.toMatch(/成为供应商|成為供應商|成为供應商|成為供應商/)
  })

  // ─────────────────────────────────────────────────────────────────────
  // 6) 模板源码级: HeaderNavigation.vue 用 t('navigation.becomeSupplier')
  // ─────────────────────────────────────────────────────────────────────
  test('模板 2/3: HeaderNavigation.vue 渲染 t("navigation.becomeSupplier") 不硬编码', () => {
    const src = readFileSync(HEADER_NAV_VUE, 'utf-8')
    expect(
      src,
      'HeaderNavigation.vue 仍引用 t("navigation.becomeSupplier") (header dropdown 标签)',
    ).toMatch(/t\(\s*['"]navigation\.becomeSupplier['"]\s*\)/)
    expect(
      src,
      'HeaderNavigation.vue 不应硬编码"成为供应商"中文 (回归到字面量?)',
    ).not.toMatch(/成为供应商|成為供應商|成为供應商|成為供應商/)
  })

  // ─────────────────────────────────────────────────────────────────────
  // 7) 注释源码级: useSidebar.ts 注释的 4 字 label 案例使用"加入我们"
  // ─────────────────────────────────────────────────────────────────────
  test('注释 1/2: useSidebar.ts 注释 4 字 label 案例 = "加入我们"', () => {
    const src = readFileSync(USE_SIDEBAR_TS, 'utf-8')
    expect(
      src,
      'useSidebar.ts 注释应使用"加入我们"作为 4 字 label 完整显示案例',
    ).toMatch(/加入我们|加入我們/)
    expect(
      src,
      'useSidebar.ts 注释不应再用"成为供应商"作为案例 (5 字截断案例, 已过时)',
    ).not.toMatch(/成为供应商|成為供應商/)
  })

  // ─────────────────────────────────────────────────────────────────────
  // 8) 注释源码级: useSidebar.test.ts 注释与实现一致
  // ─────────────────────────────────────────────────────────────────────
  test('注释 2/2: useSidebar.test.ts 设计目标注释含"加入我们"', () => {
    const src = readFileSync(USE_SIDEBAR_TEST, 'utf-8')
    expect(
      src,
      'useSidebar.test.ts 设计目标注释应含"加入我们"作为 4 字 label 案例',
    ).toMatch(/加入我们|加入我們/)
    expect(
      src,
      'useSidebar.test.ts 注释不应再用"成为供应商"作为 5 字截断案例 (已过时)',
    ).not.toMatch(/成为供应商|成為供應商/)
  })

  // ─────────────────────────────────────────────────────────────────────
  // 9) 文档源码级: README.md 导航列表含"加入我们"作为示例
  // ─────────────────────────────────────────────────────────────────────
  test('文档: README.md 导航列表含"加入我们"作为示例文案', () => {
    const src = readFileSync(README, 'utf-8')
    expect(
      src,
      'README.md 导航章节应含"加入我们"作为 sidebar 入口示例',
    ).toMatch(/加入我们/)
    // 旧文案"成为供应商"仅在描述 Supplier Application 业务时使用, 不应在导航示例中出现
    // 这里仅检查导航章节: "关于-新闻中心" 这一行
    const navLine = src.match(/- 关于-[^\n]*加入我们/)
    expect(
      navLine,
      'README.md 导航章节 "关于-..." 一行应以"加入我们"结尾 (而非"成为供应商")',
    ).not.toBeNull()
  })

  // ─────────────────────────────────────────────────────────────────────
  // 10) 反向断言: navigation 段 6 语言 i18n 文件不含旧值"成为供应商"族
  //     这是补充防御: 即使 EXPECTED_JOIN_US 检查通过, 也要确保没有
  //     "成为供应商" 残留 (e.g. JSON 末尾的脏数据)
  // ─────────────────────────────────────────────────────────────────────
  test('反向断言: 6 语言 navigation.json 不含"成为供应商"旧值', () => {
    for (const file of NAVIGATION_FILES) {
      const src = readFileSync(file, 'utf-8')
      expect(
        src,
        `${file} 不应再含"成为供应商"族旧值 (成为供应商/成為供應商/サプライヤーになる/공급업체가 되기/Become a Supplier)`,
      ).not.toMatch(/成为供应商|成為供應商|サプライヤーになる|공급업체가 되기|Become a Supplier/)
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // 11) 反向断言: routes 段 6 语言 i18n 文件不含旧值
  // ─────────────────────────────────────────────────────────────────────
  test('反向断言: 6 语言 routes.json 不含"成为供应商"旧值', () => {
    for (const file of ROUTES_FILES) {
      const src = readFileSync(file, 'utf-8')
      expect(
        src,
        `${file} 不应再含"成为供应商"族旧值 (mobile menu/document.title 仍残留?)`,
      ).not.toMatch(/成为供应商|成為供應商|サプライヤーになる|공급업체가 되기|Become a Supplier/)
    }
  })
})
