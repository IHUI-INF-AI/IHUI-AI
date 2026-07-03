/**
 * 侧边栏暗色色阶源码级守门 (2026-07-03 立, v3 加深)
 *
 * 防回归目标:
 * 2026-07-03 用户反馈"侧边栏在暗色模式下整体背景色太浅", 同时发现对话历史容器
 * .chat-history-body 因 fallback `var(--chat-history-body-bg, #ffffff)` 在 dark 下
 * 显示为刺眼白色. 本批次修复:
 *   1. _sidebar-layout.scss: dark sidebar 色阶整体加深 (v2 → v3)
 *      - v1 → v2: #6a6d77/#5a5d67/#4f5259 → #3a3d47/#2a2d37/#1f2229
 *      - v2 → v3: #3a3d47/#2a2d37/#1f2229 → #2a2d37/#1f2229/#0f1117 (用户反馈 v2 仍偏浅)
 *      - hover #000000 (不变)
 *   2. SidebarChatHistory.vue:
 *      - .chat-history-body fallback 从 #ffffff 改 transparent (消除白色 bug)
 *      - 新增 html.dark .sidebar-chat-history { background-color: #42454f }
 *        (比 sidebar surface 浅 8 单位, 形成"卡片浮起"层次)
 *   3. UniversalLogin.vue html.dark .submit-btn:
 *      - 加 color: #1a1a1a (偏黑文字, 替代 EP 默认白色)
 *      - hover color: #0a0a0a, active color: #1a1a1a
 *      - 对比度 #1a1a1a on #3b82f6 = 4.83:1 (WCAG AA 通过)
 *
 * 防回归点 (任一处被改回旧值即触发失败):
 *   A. _sidebar-layout.scss 必须含 dark mode 4 条 token 覆盖, 值精确匹配 v3 色阶
 *   B. _sidebar-layout.scss 必须用 html.dark (0,0,1) 而非 :where(html.dark) (0,0,0)
 *   C. SidebarChatHistory.vue .chat-history-body fallback 必须为 transparent, 不能是 #ffffff
 *   D. SidebarChatHistory.vue 必须含 html.dark .sidebar-chat-history 深色背景覆盖
 *   E. _theme-tokens.ts / _theme-tokens.scss 的全局 darkSurface 必须保持 #6a6d77 不变
 *   F. 色阶方向: surface > new-chat > active > hover (向 #000 加深)
 *   G. 结构性反向断言: 按 token 名逐个验证 v1/v2 旧值
 *   H. UniversalLogin.vue 暗色模式文字色必须为偏黑色 #1a1a1a, 浅色模式 #ffffff
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
  surface: '#2a2d37',
  newChat: '#1f2229',
  active: '#0f1117',
  hover: '#000',
} as const

const EXPECTED_CHAT_HISTORY_DARK_BG = '#42454f'
const GLOBAL_DARK_SURFACE = '#6a6d77' // 全局 token, 必须保持不变

// 登录按钮暗色文字色 (UniversalLogin.vue html.dark .submit-btn)
const EXPECTED_LOGIN_DARK_TEXT = '#1a1a1a'
const EXPECTED_LOGIN_DARK_TEXT_HOVER = '#0a0a0a'

// ════════════════════════════════════════════════════════════════════════
// A. _sidebar-layout.scss dark mode 4 条 token 覆盖 (源码级)
// ════════════════════════════════════════════════════════════════════════

test.describe('侧边栏暗色色阶源码级守门', () => {
  test.describe.configure({ mode: 'parallel' })

  // ── A1. surface token ──
  test('A1: _sidebar-layout.scss dark surface = #2a2d37 (v3)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_sidebar-layout.scss'), 'utf8')
    // html.dark 块内必须含 --app-sidebar-color-surface: #2a2d37
    expect(
      src,
      `dark mode --app-sidebar-color-surface 必须为 ${EXPECTED_DARK_TIER.surface} (v3 加深版本).\n` +
        `历史值 #6a6d77 / #3a3d47 用户反馈偏浅, 已废弃.\n` +
        `若需改色, 同步更新本 spec 的 EXPECTED_DARK_TIER 锚定值.`
    ).toMatch(
      new RegExp(
        `html\\.dark\\s*\\{[^}]*--app-sidebar-color-surface:\\s*${EXPECTED_DARK_TIER.surface.replace('#', '\\#')}[^}]*\\}`,
        'i'
      )
    )
  })

  // ── A2. new-chat token ──
  test('A2: _sidebar-layout.scss dark new-chat = #1f2229 (v3)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_sidebar-layout.scss'), 'utf8')
    expect(
      src,
      `dark mode --app-sidebar-color-new-chat 必须为 ${EXPECTED_DARK_TIER.newChat} (主操作, 比 surface 深 11 单位).`
    ).toMatch(
      new RegExp(
        `html\\.dark\\s*\\{[^}]*--app-sidebar-color-new-chat:\\s*${EXPECTED_DARK_TIER.newChat.replace('#', '\\#')}[^}]*\\}`,
        'i'
      )
    )
  })

  // ── A3. active token ──
  test('A3: _sidebar-layout.scss dark active = #0f1117 (v3)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_sidebar-layout.scss'), 'utf8')
    expect(
      src,
      `dark mode --app-sidebar-color-active 必须为 ${EXPECTED_DARK_TIER.active} (选中态, 比 surface 深 27 单位, 接近纯黑).`
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
    expect(
      src,
      '.chat-history-body 的 fallback 必须为 transparent.\n' +
        '原值 #ffffff 在 dark mode 下因 --chat-history-body-bg 未定义而 fallback 到白色, ' +
        '导致对话历史容器在暗色模式下显示为刺眼白色 (2026-07-03 用户反馈 bug).'
    ).toMatch(/\.chat-history-body\s*\{[^}]*background-color:\s*var\(--chat-history-body-bg,\s*transparent\)/)

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
    expect(
      src,
      `SidebarChatHistory.vue 必须含 html.dark .sidebar-chat-history { background-color: ${EXPECTED_CHAT_HISTORY_DARK_BG} }.\n` +
        `dark mode 对话历史容器比 sidebar surface (#2a2d37) 浅 27 单位, 形成"卡片浮起"层次.\n` +
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

    // chat-history 容器背景应比 sidebar surface 浅 (形成卡片浮起层次)
    // v3 后 surface=#2a2d37, chat-history=#42454f, 浅 27 单位
    const chatHistoryL = lum(EXPECTED_CHAT_HISTORY_DARK_BG)
    expect(
      chatHistoryL,
      `chat-history 容器 (${EXPECTED_CHAT_HISTORY_DARK_BG}) 应比 sidebar surface (${EXPECTED_DARK_TIER.surface}) 浅, ` +
        '形成"卡片浮起"视觉层次 (与 light 模式容器 #ffffff vs sidebar #f5f5f5 对称)'
    ).toBeGreaterThan(surfaceL)

    // sidebar surface 应比主内容区 #1a1a1a 浅 (容器感, 不撞色)
    const mainContentL = lum('#1a1a1a')
    expect(
      surfaceL,
      `sidebar surface (${EXPECTED_DARK_TIER.surface}) 应比主内容区 (#1a1a1a) 浅, ` +
        '形成"容器感"层次, 而不是"撞色对比"层次 (v3 设计意图)'
    ).toBeGreaterThan(mainContentL)
  })

  // ════════════════════════════════════════════════════════════════════════
  // G. 结构性反向断言: 按 token 名逐个验证当前值不是 v1/v2 旧值
  // ════════════════════════════════════════════════════════════════════════
  test('G: _sidebar-layout.scss dark 覆盖块不能含 v1/v2 旧值 (防回退)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_sidebar-layout.scss'), 'utf8')
    // 提取 html.dark { ... --app-sidebar-color-* ... } 块内容 (限定 dark 块)
    const darkBlockMatch = src.match(/html\.dark\s*\{[^}]*--app-sidebar-color-surface:[^}]*\}/i)
    expect(darkBlockMatch, '必须存在 html.dark 块含 --app-sidebar-color-surface').not.toBeNull()
    const darkBlock = darkBlockMatch![0]

    // 按 token 名逐个验证当前值不是 v1/v2 旧值
    // (不能用"dark 块内不能含某 hex"的简单判断, 因为 v3 surface=#2a2d37
    // 恰好等于 v2 new-chat, 简单包含判断会自相矛盾)
    const tokenHistory: Record<string, string[]> = {
      '--app-sidebar-color-surface': ['#6a6d77', '#3a3d47'], // v1, v2
      '--app-sidebar-color-new-chat': ['#5a5d67', '#2a2d37'], // v1, v2
      '--app-sidebar-color-active':   ['#4f5259', '#1f2229'], // v1, v2
      '--app-sidebar-color-hover':    [], // hover 从未改过
    }
    for (const [name, oldValues] of Object.entries(tokenHistory)) {
      const m = darkBlock.match(new RegExp(`${name}:\\s*([#a-zA-Z0-9]+)`, 'i'))
      if (!m) continue
      const currentVal = m[1].toLowerCase()
      for (const oldVal of oldValues) {
        if (currentVal === oldVal.toLowerCase()) {
          const expectedNow = name === '--app-sidebar-color-surface'
            ? EXPECTED_DARK_TIER.surface
            : name === '--app-sidebar-color-new-chat'
              ? EXPECTED_DARK_TIER.newChat
              : name === '--app-sidebar-color-active'
                ? EXPECTED_DARK_TIER.active
                : EXPECTED_DARK_TIER.hover
          throw new Error(
            `${name} 当前值 ${currentVal} 等于历史旧值 ${oldVal}.\n` +
            `该值已被 v3 升级, 改回旧值 = 回归.\n` +
            `历史: v1 (${oldVal}) → v2 → v3 (${expectedNow})`
          )
        }
      }
    }
  })

  // ════════════════════════════════════════════════════════════════════════
  // H. 登录按钮暗色文字色 (UniversalLogin.vue)
  // ════════════════════════════════════════════════════════════════════════
  test('H1: UniversalLogin.vue html.dark .submit-btn 必须含 color: #1a1a1a (偏黑文字)', () => {
    const src = readFileSync(join(ROOT, 'src/components/login/UniversalLogin.vue'), 'utf8')
    // html.dark .submit-btn 块内必须含 color: #1a1a1a
    // 用 [\s\S]*? (颜色块可能含 } 比如 rgba())
    expect(
      src,
      `html.dark .submit-btn 块内必须显式 color: ${EXPECTED_LOGIN_DARK_TEXT} (偏黑文字).\n` +
        '原代码未设 color, fallback 到 Element Plus 默认 --el-color-white (#ffffff),\n' +
        '在 #3b82f6 蓝底上用户反馈"应该偏黑色". 暗色模式用深色文字与项目设计语言一致.\n' +
        `对比度 ${EXPECTED_LOGIN_DARK_TEXT} on #3b82f6 = 4.83:1 (WCAG AA 通过).`
    ).toMatch(
      new RegExp(
        `html\\.dark[\\s\\S]*?\\.submit-btn\\s*\\{[\\s\\S]*?color:\\s*${EXPECTED_LOGIN_DARK_TEXT.replace('#', '\\#')}`,
        'i'
      )
    )
  })

  test('H2: UniversalLogin.vue html.dark .submit-btn hover 必须含 color: #0a0a0a (更深)', () => {
    const src = readFileSync(join(ROOT, 'src/components/login/UniversalLogin.vue'), 'utf8')
    expect(
      src,
      `.submit-btn:hover 块内必须含 color: ${EXPECTED_LOGIN_DARK_TEXT_HOVER} (比默认更深, hover 反馈更强).`
    ).toMatch(
      new RegExp(
        `\\.submit-btn[\\s\\S]*?:hover[\\s\\S]*?color:\\s*${EXPECTED_LOGIN_DARK_TEXT_HOVER.replace('#', '\\#')}`,
        'i'
      )
    )
  })

  test('H3: UniversalLogin.vue .submit-btn 默认(浅色) 必须 color: #ffffff (蓝底白字)', () => {
    const mixin = readFileSync(join(ROOT, 'src/components/login/_login-tokens.scss'), 'utf8')
    expect(
      mixin,
      '_login-tokens.scss login-btn-primary mixin 必须含 color: #ffffff (浅色模式蓝底白字).'
    ).toMatch(/@mixin\s+login-btn-primary\s*\{[^}]*color:\s*#ffffff/)
  })
})
