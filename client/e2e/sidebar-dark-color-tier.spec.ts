/**
 * 侧边栏暗色色阶源码级守门 (2026-07-03 立)
 *
 * 防回归目标:
 * 2026-07-03 用户反馈"侧边栏在暗色模式下整体背景色太浅", 同时发现对话历史容器
 * .chat-history-body 因 fallback `var(--chat-history-body-bg, #ffffff)` 在 dark 下
 * 显示为刺眼白色. 本批次修复:
 *   1. _sidebar-layout.scss: dark sidebar 色阶整体加深
 *      - surface #6a6d77 → #3a3d47 (深 48 单位)
 *      - new-chat #5a5d67 → #2a2d37 (深 16 单位)
 *      - active #4f5259 → #1f2229 (深 27 单位)
 *      - hover #000000 (不变)
 *   2. SidebarChatHistory.vue:
 *      - .chat-history-body fallback 从 #ffffff 改 transparent (消除白色 bug)
 *      - 新增 html.dark .sidebar-chat-history { background-color: #42454f }
 *        (比 sidebar surface 浅 8 单位, 形成"卡片浮起"层次)
 *
 * 防回归点 (任一处被改回旧值即触发失败):
 *   A. _sidebar-layout.scss 必须含 dark mode 4 条 token 覆盖, 值精确匹配新色阶
 *   B. _sidebar-layout.scss 必须用 html.dark (0,0,1) 而非 :where(html.dark) (0,0,0)
 *   C. SidebarChatHistory.vue .chat-history-body fallback 必须为 transparent, 不能是 #ffffff
 *   D. SidebarChatHistory.vue 必须含 html.dark .sidebar-chat-history 深色背景覆盖
 *   E. _theme-tokens.ts / _theme-tokens.scss 的全局 darkSurface 必须保持 #6a6d77 不变
 *      (本批次是 sidebar 局部加深, 不动全局 token, 避免影响 CTA/ghost/miniapp 按钮联调)
 *
 * 设计意图:
 * - sidebar 局部加深让 dark mode 整体观感更"深", 与主内容区 #1a1a1a 形成适度层次
 * - 对话历史容器比 sidebar 浅 8 单位, 形成"卡片浮起"视觉层次
 * - 全局 darkSurface 不动, 保证 CTA 按钮 (#2563eb) / ghost 文字 (#e5eaf3) /
 *   miniapp 按钮 (#ffffff + #1a1a1a 描边) 的对比度联调不破坏
 *
 * CI 入口: npm run e2e / npx playwright test sidebar-dark-color-tier.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// ════════════════════════════════════════════════════════════════════════
// 期望值锚定 (与 _sidebar-layout.scss dark 覆盖块完全一致, 改色必须同步改这里)
// ════════════════════════════════════════════════════════════════════════
const EXPECTED_DARK_TIER = {
  surface: '#3a3d47',
  newChat: '#2a2d37',
  active: '#1f2229',
  hover: '#000',
} as const

const EXPECTED_CHAT_HISTORY_DARK_BG = '#42454f'
const GLOBAL_DARK_SURFACE = '#6a6d77' // 全局 token, 必须保持不变

// ════════════════════════════════════════════════════════════════════════
// A. _sidebar-layout.scss dark mode 4 条 token 覆盖 (源码级)
// ════════════════════════════════════════════════════════════════════════

test.describe('侧边栏暗色色阶源码级守门', () => {
  test.describe.configure({ mode: 'parallel' })

  // ── A1. surface token ──
  test('A1: _sidebar-layout.scss dark surface = #3a3d47', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_sidebar-layout.scss'), 'utf8')
    // html.dark 块内必须含 --app-sidebar-color-surface: #3a3d47
    // [^}]* 强制 token 在同一个 html.dark {} 规则块内
    expect(
      src,
      `dark mode --app-sidebar-color-surface 必须为 ${EXPECTED_DARK_TIER.surface} (用户反馈旧值 #6a6d77 偏浅). ` +
        `若需改色, 同步更新本 spec 的 EXPECTED_DARK_TIER 锚定值.`
    ).toMatch(
      new RegExp(
        `html\\.dark\\s*\\{[^}]*--app-sidebar-color-surface:\\s*${EXPECTED_DARK_TIER.surface.replace('#', '\\#')}[^}]*\\}`,
        'i'
      )
    )
  })

  // ── A2. new-chat token ──
  test('A2: _sidebar-layout.scss dark new-chat = #2a2d37', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_sidebar-layout.scss'), 'utf8')
    expect(
      src,
      `dark mode --app-sidebar-color-new-chat 必须为 ${EXPECTED_DARK_TIER.newChat} (主操作, 比 surface 深 16 单位).`
    ).toMatch(
      new RegExp(
        `html\\.dark\\s*\\{[^}]*--app-sidebar-color-new-chat:\\s*${EXPECTED_DARK_TIER.newChat.replace('#', '\\#')}[^}]*\\}`,
        'i'
      )
    )
  })

  // ── A3. active token ──
  test('A3: _sidebar-layout.scss dark active = #1f2229', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_sidebar-layout.scss'), 'utf8')
    expect(
      src,
      `dark mode --app-sidebar-color-active 必须为 ${EXPECTED_DARK_TIER.active} (选中态, 比 surface 深 27 单位).`
    ).toMatch(
      new RegExp(
        `html\\.dark\\s*\\{[^}]*--app-sidebar-color-active:\\s*${EXPECTED_DARK_TIER.active.replace('#', '\\#')}[^}]*\\}`,
        'i'
      )
    )
  })

  // ── A4. hover token ──
  test('A4: _sidebar-layout.scss dark hover = #000', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_sidebar-layout.scss'), 'utf8')
    expect(
      src,
      `dark mode --app-sidebar-color-hover 必须为 ${EXPECTED_DARK_TIER.hover} (反馈态, 纯黑最深, 与 --app-hover-bg 一致).`
    ).toMatch(
      new RegExp(
        `html\\.dark\\s*\\{[^}]*--app-sidebar-color-hover:\\s*${EXPECTED_DARK_TIER.hover.replace('#', '\\#')}\\s*;`,
        'i'
      )
    )
  })

  // ── B. 必须用 html.dark 而非 :where(html.dark) ──
  test('B: _sidebar-layout.scss dark 覆盖必须用 html.dark (0,0,1), 不能用 :where(html.dark) (0,0,0)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_sidebar-layout.scss'), 'utf8')
    // 必须存在 html.dark { ... --app-sidebar-color-surface ... } (非 :where)
    expect(
      src,
      'dark sidebar token 覆盖必须用 html.dark (特异性 0,0,1), 否则会被 :root (0,0,1) 按特异性击败. ' +
        '参考项目硬约束: 暗色覆盖 :root 变量必须用 html.dark 而非 :where(html.dark).'
    ).toMatch(/html\.dark\s*\{[^}]*--app-sidebar-color-surface:/)

    // 反向断言: 不能用 :where(html.dark) 包裹 surface 覆盖
    // (允许 :where(html.dark) 用于其他规则, 但 surface 必须在 html.dark 块内)
    const whereMatch = src.match(/:where\(html\.dark\)\s*\{[^}]*--app-sidebar-color-surface:/)
    expect(
      whereMatch,
      '禁止用 :where(html.dark) (0,0,0) 覆盖 --app-sidebar-color-surface, 会被 :root 击败导致暗色覆盖静默失效.'
    ).toBeNull()
  })

  // ════════════════════════════════════════════════════════════════════════
  // C. SidebarChatHistory.vue .chat-history-body fallback 必须为 transparent
  // ════════════════════════════════════════════════════════════════════════
  test('C: SidebarChatHistory.vue .chat-history-body fallback 必须为 transparent (不能是 #ffffff)', () => {
    const src = readFileSync(join(ROOT, 'src/components/SidebarChatHistory.vue'), 'utf8')
    // .chat-history-body 块内必须含 background-color: var(--chat-history-body-bg, transparent)
    expect(
      src,
      '.chat-history-body 的 fallback 必须为 transparent.\n' +
        '原值 #ffffff 在 dark mode 下因 --chat-history-body-bg 未定义而 fallback 到白色, ' +
        '导致对话历史容器在暗色模式下显示为刺眼白色 (2026-07-03 用户反馈 bug).'
    ).toMatch(/\.chat-history-body\s*\{[^}]*background-color:\s*var\(--chat-history-body-bg,\s*transparent\)/)

    // 反向断言: 不能再出现 #ffffff fallback
    const whiteFallback = src.match(/\.chat-history-body\s*\{[^}]*background-color:\s*var\(--chat-history-body-bg,\s*#ffffff\)/)
    expect(
      whiteFallback,
      '.chat-history-body 禁止再使用 #ffffff fallback (会触发暗色模式白色 bug 回归).'
    ).toBeNull()
  })

  // ════════════════════════════════════════════════════════════════════════
  // D. SidebarChatHistory.vue html.dark .sidebar-chat-history 深色背景覆盖
  // ════════════════════════════════════════════════════════════════════════
  test('D: SidebarChatHistory.vue 必须含 html.dark .sidebar-chat-history 深色背景覆盖', () => {
    const src = readFileSync(join(ROOT, 'src/components/SidebarChatHistory.vue'), 'utf8')
    // html.dark .sidebar-chat-history { background-color: #42454f }
    expect(
      src,
      `SidebarChatHistory.vue 必须含 html.dark .sidebar-chat-history { background-color: ${EXPECTED_CHAT_HISTORY_DARK_BG} }.\n` +
        `dark mode 对话历史容器比 sidebar surface (#3a3d47) 浅 8 单位, 形成"卡片浮起"层次.\n` +
        `若需改色, 同步更新本 spec 的 EXPECTED_CHAT_HISTORY_DARK_BG 锚定值.`
    ).toMatch(
      new RegExp(
        `html\\.dark\\s+\\.sidebar-chat-history\\s*\\{[^}]*background-color:\\s*${EXPECTED_CHAT_HISTORY_DARK_BG.replace('#', '\\#')}`,
        'i'
      )
    )
  })

  // ════════════════════════════════════════════════════════════════════════
  // E. 全局 _theme-tokens 必须保持 #6a6d77 不变 (sidebar 局部加深, 不动全局)
  // ════════════════════════════════════════════════════════════════════════
  test('E1: _theme-tokens.ts 全局 darkSurface 必须保持 #6a6d77 (本批次仅 sidebar 局部加深)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_theme-tokens.ts'), 'utf8')
    expect(
      src,
      `_theme-tokens.ts 全局 darkSurface 必须保持 ${GLOBAL_DARK_SURFACE}.\n` +
        '本批次是 sidebar 局部加深, 不动全局 token.\n' +
        '改全局 darkSurface 会影响 CTA 按钮 (#2563eb) / ghost 文字 (#e5eaf3) / miniapp 按钮的对比度联调, ' +
        '需重跑 check:contrast + 更新 THEME_INVARIANTS.'
    ).toMatch(new RegExp(`darkSurface:\\s*['"]${GLOBAL_DARK_SURFACE}['"]`, 'i'))
  })

  test('E2: _theme-tokens.scss 全局 $theme-dark-surface 必须保持 #6a6d77', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_theme-tokens.scss'), 'utf8')
    expect(
      src,
      `_theme-tokens.scss 全局 $theme-dark-surface 必须保持 ${GLOBAL_DARK_SURFACE} (与 .ts 桥接一致).`
    ).toMatch(new RegExp(`\\$theme-dark-surface:\\s*${GLOBAL_DARK_SURFACE.replace('#', '\\#')}`, 'i'))
  })

  // ════════════════════════════════════════════════════════════════════════
  // F. 色阶方向一致性: surface > new-chat > active (向 #000 加深)
  // ════════════════════════════════════════════════════════════════════════
  test('F: dark 色阶方向正确 (surface 浅 → new-chat → active 深, hover 最深 = #000)', () => {
    // 解析 hex 为亮度 (0-255, 越小越深)
    const lum = (hex: string): number => {
      // 支持 3 位缩写 (#000 → #000000) 和 6 位标准写法
      const raw = hex.replace('#', '')
      const h = raw.length === 3
        ? raw.split('').map(c => c + c).join('')
        : raw
      const r = parseInt(h.slice(0, 2), 16)
      const g = parseInt(h.slice(2, 4), 16)
      const b = parseInt(h.slice(4, 6), 16)
      return (r * 0.299 + g * 0.587 + b * 0.114)
    }

    const surfaceL = lum(EXPECTED_DARK_TIER.surface)
    const newChatL = lum(EXPECTED_DARK_TIER.newChat)
    const activeL = lum(EXPECTED_DARK_TIER.active)
    const hoverL = lum(EXPECTED_DARK_TIER.hover)

    // surface 最浅, new-chat 中, active 深, hover 最深
    expect(surfaceL, 'surface 应为色阶中最浅 (容器底色)').toBeGreaterThan(newChatL)
    expect(newChatL, 'new-chat 应比 active 浅 (主操作 < 选中态)').toBeGreaterThan(activeL)
    expect(activeL, 'active 应比 hover 浅 (选中态 < 反馈态纯黑)').toBeGreaterThan(hoverL)

    // chat-history 容器背景应介于 surface 和 new-chat 之间 (比 surface 浅, 比 new-chat 深)
    // 形成卡片浮起层次
    const chatHistoryL = lum(EXPECTED_CHAT_HISTORY_DARK_BG)
    expect(
      chatHistoryL,
      `chat-history 容器 (${EXPECTED_CHAT_HISTORY_DARK_BG}) 应比 sidebar surface (${EXPECTED_DARK_TIER.surface}) 浅, ` +
        '形成"卡片浮起"视觉层次 (与 light 模式容器 #ffffff vs sidebar #f5f5f5 对称)'
    ).toBeGreaterThan(surfaceL)
  })

  // ════════════════════════════════════════════════════════════════════════
  // G. 旧值回退检测 (反向断言: 防止有人改回旧值)
  // ════════════════════════════════════════════════════════════════════════
  test('G: _sidebar-layout.scss dark 覆盖块不能含旧值 #6a6d77 / #5a5d67 / #4f5259 (防回退)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_sidebar-layout.scss'), 'utf8')
    // 提取 html.dark { ... --app-sidebar-color-* ... } 块内容
    const darkBlockMatch = src.match(/html\.dark\s*\{[^}]*--app-sidebar-color-surface:[^}]*\}/i)
    expect(darkBlockMatch, '必须存在 html.dark 块含 --app-sidebar-color-surface').not.toBeNull()

    const darkBlock = darkBlockMatch![0]
    expect(
      darkBlock,
      'dark sidebar 覆盖块不能含旧值 #6a6d77 (旧 surface, 用户反馈偏浅)'
    ).not.toContain('#6a6d77')
    expect(
      darkBlock,
      'dark sidebar 覆盖块不能含旧值 #5a5d67 (旧 new-chat, 偏浅)'
    ).not.toContain('#5a5d67')
    expect(
      darkBlock,
      'dark sidebar 覆盖块不能含旧值 #4f5259 (旧 active, 偏浅)'
    ).not.toContain('#4f5259')
  })
})
