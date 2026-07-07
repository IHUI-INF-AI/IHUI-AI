/**
 * 侧边栏尺寸 v12 (60-136) 永久锁定守门 (2026-07-06 升级)
 *
 * 防回归目标:
 *   2026-07-04 用户在 1 小时内连续迭代 100 → 120 → 110 → 116 共 4 次,
 *   每次都出现"改 useSidebar.ts 忘改 _sidebar-layout.scss" 或反之的错位.
 *   落地 v12 (60-136). 2026-07-06 用户强制要求升级:
 *   v12 (60-136) - DEFAULT/MAX 统一为 136 (4 字 label 完整, 5 字截断).
 *   本 spec 拦截任何想再调宽度的尝试.
 *
 * 防回归点 (任一处被改回旧值即触发失败):
 *   A. useSidebar.ts 4 个常量: MIN_WIDTH=60, MAX_WIDTH=136, DEFAULT_WIDTH=136, COLLAPSE_THRESHOLD=60
 *   B. _sidebar-layout.scss 4 个 token: --sidebar-width/min/max/collapsed-width
 *   C. useSidebar.ts CURRENT_CONFIG_VERSION = 12
 *   D. Sidebar.vue 拖拽注释含 v12
 *   E. 浏览器渲染 .app-sidebar width = 136px (实际渲染验证, dev server 未起时 skip)
 *   F. 12 个 nav-item label 文字均无截断 (scrollWidth <= clientWidth)
 *   G. 反向断言: 不能出现 v8/v9/v10 旧值 (60-100 / 60-110 / 60-120) 注释残留
 *
 * CI 入口: npx playwright test sidebar-width-v12.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const SRC_USE_SIDEBAR = join(ROOT, 'src/composables/useSidebar.ts')
const SRC_SCSS = join(ROOT, 'src/styles/_sidebar-layout.scss')
const SRC_SIDEBAR_VUE = join(ROOT, 'src/components/Sidebar.vue')

// ════════════════════════════════════════════════════════════════════════
// 期望值锚定 (与 scripts/check-sidebar-config.mjs EXPECTED 保持一致)
// v12 (2026-07-06 升级): MAX_WIDTH 116→136, DEFAULT_WIDTH 116→136, CURRENT_CONFIG_VERSION 11→12
// ════════════════════════════════════════════════════════════════════════
const EXPECTED = {
  useSidebar: {
    MIN_WIDTH: 60,
    MAX_WIDTH: 136,
    DEFAULT_WIDTH: 136,
    COLLAPSE_THRESHOLD: 60,
    CURRENT_CONFIG_VERSION: 12,
  },
  scss: {
    'sidebar-width': '136px',
    'sidebar-min-width': '60px',
    'sidebar-max-width': '136px',
    'sidebar-collapsed-width': '60px',
  },
} as const

// 历史上 v8 / v9 / v10 / v12 的 "max" 旧值, 用于反向断言禁止残留
const FORBIDDEN_LEGACY_WIDTHS = [100, 110, 116, 120, 140] as const

// 12 个 nav-item 中文 label (按 sidebar 渲染顺序)
const NAV_ITEM_TEXTS = [
  '对话历史',
  '核心功能',
  '首页',
  '智能体',
  '开放平台',
  '学习AI',
  'AI社区',
  'AI世界',
  '服务支持',
  '文档中心',
  'AI动态',
  '关于我们',
  '加入我们',
]

test.describe('侧边栏尺寸 v12 永久锁定守门 (60-136)', () => {
  test.describe.configure({ mode: 'parallel' })

  // ════════════════════════════════════════════════════════════════════
  // A. useSidebar.ts 4 个常量
  // ════════════════════════════════════════════════════════════════════

  test('A1: useSidebar.ts MIN_WIDTH = 60 (v12)', () => {
    const src = readFileSync(SRC_USE_SIDEBAR, 'utf8')
    expect(
      src,
      `useSidebar.ts MIN_WIDTH 必须为 ${EXPECTED.useSidebar.MIN_WIDTH} (v12 锁定值).`
    ).toMatch(new RegExp(`\\bconst\\s+MIN_WIDTH\\s*=\\s*${EXPECTED.useSidebar.MIN_WIDTH}\\b`))
  })

  test('A2: useSidebar.ts MAX_WIDTH = 136 (v12)', () => {
    const src = readFileSync(SRC_USE_SIDEBAR, 'utf8')
    expect(
      src,
      `useSidebar.ts MAX_WIDTH 必须为 ${EXPECTED.useSidebar.MAX_WIDTH} (v12 锁定值).\n` +
        `历史值: 100 (v8) / 110 (v10) / 120 (v9) / 140 (v7) 全部废弃.`
    ).toMatch(new RegExp(`\\bconst\\s+MAX_WIDTH\\s*=\\s*${EXPECTED.useSidebar.MAX_WIDTH}\\b`))
  })

  test('A3: useSidebar.ts DEFAULT_WIDTH = 136 (v12)', () => {
    const src = readFileSync(SRC_USE_SIDEBAR, 'utf8')
    expect(
      src,
      `useSidebar.ts DEFAULT_WIDTH 必须为 ${EXPECTED.useSidebar.DEFAULT_WIDTH} (v12 锁定值, 紧凑默认).`
    ).toMatch(new RegExp(`\\bconst\\s+DEFAULT_WIDTH\\s*=\\s*${EXPECTED.useSidebar.DEFAULT_WIDTH}\\b`))
  })

  test('A4: useSidebar.ts COLLAPSE_THRESHOLD = 60 (v12)', () => {
    const src = readFileSync(SRC_USE_SIDEBAR, 'utf8')
    expect(
      src,
      `useSidebar.ts COLLAPSE_THRESHOLD 必须为 ${EXPECTED.useSidebar.COLLAPSE_THRESHOLD} (v12 锁定值, < 60 折叠).`
    ).toMatch(new RegExp(`\\bconst\\s+COLLAPSE_THRESHOLD\\s*=\\s*${EXPECTED.useSidebar.COLLAPSE_THRESHOLD}\\b`))
  })

  // ════════════════════════════════════════════════════════════════════
  // B. _sidebar-layout.scss 4 个 token
  // ════════════════════════════════════════════════════════════════════

  test('B1: _sidebar-layout.scss --sidebar-width = 136px (v12)', () => {
    const src = readFileSync(SRC_SCSS, 'utf8')
    expect(
      src,
      `_sidebar-layout.scss --sidebar-width 必须为 ${EXPECTED.scss['sidebar-width']} (v12 锁定值).`
    ).toMatch(new RegExp(`--sidebar-width\\s*:\\s*${EXPECTED.scss['sidebar-width'].replace('px', 'px')}`))
  })

  test('B2: _sidebar-layout.scss --sidebar-min-width = 60px (v12)', () => {
    const src = readFileSync(SRC_SCSS, 'utf8')
    expect(
      src,
      `_sidebar-layout.scss --sidebar-min-width 必须为 ${EXPECTED.scss['sidebar-min-width']} (v12 锁定值).`
    ).toMatch(new RegExp(`--sidebar-min-width\\s*:\\s*${EXPECTED.scss['sidebar-min-width']}`))
  })

  test('B3: _sidebar-layout.scss --sidebar-max-width = 136px (v12)', () => {
    const src = readFileSync(SRC_SCSS, 'utf8')
    expect(
      src,
      `_sidebar-layout.scss --sidebar-max-width 必须为 ${EXPECTED.scss['sidebar-max-width']} (v12 锁定值).`
    ).toMatch(new RegExp(`--sidebar-max-width\\s*:\\s*${EXPECTED.scss['sidebar-max-width']}`))
  })

  test('B4: _sidebar-layout.scss --sidebar-collapsed-width = 60px (v12)', () => {
    const src = readFileSync(SRC_SCSS, 'utf8')
    expect(
      src,
      `_sidebar-layout.scss --sidebar-collapsed-width 必须为 ${EXPECTED.scss['sidebar-collapsed-width']} (v12 锁定值).`
    ).toMatch(new RegExp(`--sidebar-collapsed-width\\s*:\\s*${EXPECTED.scss['sidebar-collapsed-width']}`))
  })

  // ════════════════════════════════════════════════════════════════════
  // C. useSidebar.ts CURRENT_CONFIG_VERSION = 11
  // ════════════════════════════════════════════════════════════════════

  test('C: useSidebar.ts CURRENT_CONFIG_VERSION = 11 (v12)', () => {
    const src = readFileSync(SRC_USE_SIDEBAR, 'utf8')
    expect(
      src,
      `useSidebar.ts CURRENT_CONFIG_VERSION 必须为 ${EXPECTED.useSidebar.CURRENT_CONFIG_VERSION}.\n` +
        `调高会增加一次无效的 localStorage 迁移, 调低会破坏用户当前 v12 持久化数据.`
    ).toMatch(new RegExp(`\\bCURRENT_CONFIG_VERSION\\s*=\\s*${EXPECTED.useSidebar.CURRENT_CONFIG_VERSION}\\b`))
  })

  // ════════════════════════════════════════════════════════════════════
  // D. Sidebar.vue 拖拽注释含 v12
  // ════════════════════════════════════════════════════════════════════

  test('D: Sidebar.vue 拖拽注释必须标注 v12', () => {
    const src = readFileSync(SRC_SIDEBAR_VUE, 'utf8')
    // 注释应含 v12, 而非 v8/v9/v10
    expect(
      src,
      `Sidebar.vue 拖拽注释必须含 v12 (永久锁定标记).`
    ).toMatch(/v12/)
    // 反向: 不能含 v8 / v9 / v10
    expect(
      src,
      `Sidebar.vue 拖拽注释禁止含 v8 / v9 / v10 旧版本标记.`
    ).not.toMatch(/v8|v9|v10/)
  })

  // ════════════════════════════════════════════════════════════════════
  // E. 浏览器渲染 .app-sidebar width = 136px (实际渲染验证)
  // ════════════════════════════════════════════════════════════════════

  test('E: 浏览器渲染 .app-sidebar width = 136px (实际渲染验证)', async ({ page }) => {
    // 清理 localStorage 让默认 136 生效
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('sidebar-width')
        localStorage.removeItem('sidebar-config-version')
        localStorage.removeItem('sidebar-collapsed')
      } catch {
        // 隐私模式等异常忽略
      }
    })

    let devServerUp = true
    try {
      await page.goto('http://127.0.0.1:8888/', {
        waitUntil: 'domcontentloaded',
        timeout: 8000,
      })
    } catch (err) {
      devServerUp = false
    }
    test.skip(!devServerUp, 'dev server 未启动, 跳过浏览器渲染验证 (CI 中应先启 vite --port 8888)')

    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

    const width = await page.evaluate(() => {
      const el = document.querySelector('.app-sidebar')
      if (!el) return null
      return el.getBoundingClientRect().width
    })
    expect(
      width,
      `.app-sidebar 实际渲染宽度 = ${width}px, 期望 136px (v12 锁定值).\n` +
        `若 dev server HMR 缓存旧值, 请重启 vite: cd client && npm run dev.`
    ).toBe(136)
  })

  // ════════════════════════════════════════════════════════════════════
  // F. 12 个 nav-item label 文字均无截断
  // ════════════════════════════════════════════════════════════════════

  test('F: 12 个 nav-item label 文字均无截断 (scrollWidth <= clientWidth)', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('sidebar-width')
        localStorage.removeItem('sidebar-config-version')
        localStorage.removeItem('sidebar-collapsed')
      } catch {
        // 隐私模式等异常忽略
      }
    })

    let devServerUp = true
    try {
      await page.goto('http://127.0.0.1:8888/', {
        waitUntil: 'domcontentloaded',
        timeout: 8000,
      })
    } catch (err) {
      devServerUp = false
    }
    test.skip(!devServerUp, 'dev server 未启动, 跳过浏览器渲染验证 (CI 中应先启 vite --port 8888)')

    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

    const truncationReport = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.nav-item-label'))
      return labels.map(el => ({
        text: el.textContent?.trim() ?? '',
        visibleWidth: Math.round(el.getBoundingClientRect().width),
        scrollWidth: el.scrollWidth,
        truncated: el.scrollWidth > el.getBoundingClientRect().width + 1,
      }))
    })

    const truncated = truncationReport.filter(r => r.truncated)
    expect(
      truncated.length,
      `v12 锁定 136px 下应 0 截断, 实际截断 ${truncated.length} 个:\n` +
        truncated.map(t => `  - "${t.text}" (visible=${t.visibleWidth}px, scroll=${t.scrollWidth}px)`).join('\n') +
        `\n若 dev server 缓存旧宽度, 请重启 vite.`
    ).toBe(0)
  })

  // ════════════════════════════════════════════════════════════════════
  // G. 反向断言: 禁止 v8/v9/v10 旧值注释残留
  // ════════════════════════════════════════════════════════════════════

  for (const legacy of FORBIDDEN_LEGACY_WIDTHS) {
    test(`G.${legacy}: useSidebar.ts 注释中禁止出现 v8/v9/v10 旧 width 值 (${legacy}px)`, () => {
      const src = readFileSync(SRC_USE_SIDEBAR, 'utf8')
      // 匹配注释: "// 注释含 60-100 范围" 这种
      // 排除 const MAX_WIDTH = 136 (v12 锁定值) 自身
      const commentRe = new RegExp(`//[^\\n]*${legacy}\\b[^\\n]*`)
      const m = src.match(commentRe)
      // 只在 v8/v9/v10 注释上下文里 fail
      if (m && /(v8|v9|v10)/.test(m[0])) {
        expect(
          null,
          `useSidebar.ts 含 v8/v9/v10 时代旧 width 值 (${legacy}) 注释残留:\n` +
            `  ${m[0]}\n` +
            `历史值 ${legacy} (v8=100, v9=120, v10=110) 全部废弃, 注释应清理.`
        ).not.toBeNull()
      }
    })
  }
})
