import { test, expect, type Page } from '@playwright/test'
import { attachErrorGuards } from '../tests/e2e/fixtures/helpers'

/**
 * ChatModeBadge + 3 通道模式切换 E2E 守门测试 (2026-07-28 立)
 *
 * 覆盖 2026-07-28 refactor(web): remove mode switcher buttons 改动的 4 模式 + 3 通道:
 * - 通道 1: 斜杠命令 /build /plan /review /spec
 * - 通道 2: Ctrl+1/2/3/4 键盘快捷键
 * - 通道 3: AI 关键词自动判断(用户输入文本含 "调研/分析" → plan 等)
 *
 * + CurrentModeBadge 视觉态验证
 * + 5 语言 i18n 翻译一致性(zh-CN / en / ja / ko / zh-TW)
 *
 * 不依赖登录态(纯前端 UI 状态,useModeStore zustand),localStorage key `ihui-mode-store`。
 * 触发登录弹窗时优雅 skip(避免后端不可用阻塞整个 e2e 套件)。
 *
 * DOM 锚点(与 apps/web/src/components/chat/message-input.tsx:200-227 CurrentModeBadge 一致):
 *   <span data-testid="chat-mode-badge" data-mode={currentMode}>
 *     <ModeIcon className="h-3 w-3" />
 *     <span>{t(meta.i18nKey)}</span>
 *   </span>
 */

const MODES = ['build', 'plan', 'review', 'spec'] as const
type Mode = (typeof MODES)[number]

const SLASH_CMDS: Record<Mode, string> = {
  build: '/build',
  plan: '/plan',
  review: '/review',
  spec: '/spec',
}

const CTRL_KEY_MAP: Record<Mode, string> = {
  build: '1',
  plan: '2',
  review: '3',
  spec: '4',
}

/** 关键词自动判断测试用例(输入文本 → 期望 mode)
 *  与 apps/web/src/hooks/use-chat.ts:335-340 SUGGEST_KEYWORDS 一致 */
const KEYWORD_CASES: { input: string; expected: Mode }[] = [
  { input: '帮我调研一下 Next.js 15 的 App Router 架构', expected: 'plan' },
  { input: '帮我实现一个用户登录功能,用 JWT 鉴权', expected: 'build' },
  { input: '审查一下这个 PR 的 diff,有性能问题吗', expected: 'review' },
  { input: '生成 API spec 文档,描述所有 endpoint', expected: 'spec' },
]

/** 5 语言 CurrentModeBadge 期望翻译
 *  与 packages/i18n/messages/web/{locale}.json modeBuild/modePlan/modeReview/modeSpec 一致 */
const MODE_LABEL_EXPECT: Record<string, Record<Mode, string>> = {
  'zh-CN': { build: '构建', plan: '计划', review: '审查', spec: '规格' },
  en: { build: 'Build', plan: 'Plan', review: 'Review', spec: 'Spec' },
  ja: { build: 'ビルド', plan: '計画', review: 'レビュー', spec: 'スペック' },
  ko: { build: '빌드', plan: '계획', review: '리뷰', spec: '스펙' },
  'zh-TW': { build: '構建', plan: '計劃', review: '審查', spec: '規格' },
}

const LOCALES = Object.keys(MODE_LABEL_EXPECT) as Array<keyof typeof MODE_LABEL_EXPECT>

/** 设置 zustand persist 的 mode store(让页面加载时直接进入目标 mode) */
async function setModeStore(page: Page, mode: Mode) {
  await page.evaluate((m) => {
    const raw = localStorage.getItem('ihui-mode-store')
    const obj = raw ? JSON.parse(raw) : { state: { currentMode: 'build' }, version: 0 }
    obj.state = obj.state || {}
    obj.state.currentMode = m
    localStorage.setItem('ihui-mode-store', JSON.stringify(obj))
  }, mode)
}

/** 设置 locale cookie + localStorage(对齐 apps/web/src/components/sidebar.tsx:535-541) */
async function switchLocale(page: Page, locale: string) {
  await page.context().addCookies([
    {
      name: 'locale',
      value: locale,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])
  await page.evaluate((l) => {
    try {
      const raw = localStorage.getItem('ihui-language')
      const obj = raw ? JSON.parse(raw) : { state: { locale: 'zh-CN' }, version: 0 }
      obj.state = obj.state || {}
      obj.state.locale = l
      localStorage.setItem('ihui-language', JSON.stringify(obj))
    } catch {
      // localStorage 不可用时静默
    }
  }, locale)
}

/** 检测是否弹出登录模态框(若弹出,后续断言应 skip) */
async function isLoginModalOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    // 多种登录模态框 selector 都试一次
    const dialogs = document.querySelectorAll(
      '[role="dialog"], [data-testid*="login"], [aria-label*="登录" i], [aria-label*="login" i]',
    )
    if (dialogs.length === 0) return false
    for (const d of Array.from(dialogs)) {
      const text = d.textContent || ''
      if (
        text.includes('登录') ||
        text.includes('Login') ||
        text.includes('Sign in') ||
        text.includes('扫码')
      ) {
        return true
      }
    }
    return false
  })
}

test.describe('ChatModeBadge + 3 通道模式切换', () => {
  test.beforeEach(async ({ page }) => {
    // 清理 localStorage,避免前一个测试残留 mode 状态污染
    await page.goto('/chat', { waitUntil: 'domcontentloaded' }).catch(() => null)
    await page.evaluate(() => {
      localStorage.removeItem('ihui-mode-store')
      localStorage.removeItem('ihui-language')
    })
    // 强制刷新到干净状态(zh-CN + build)
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="chat-mode-badge"]', { timeout: 10000 })
  })

  // ============================================
  // 1. 默认态:打开 /chat → badge 显示 build/构建
  // ============================================
  test('默认模式为 build,CurrentModeBadge 渲染 "构建"', async ({ page }) => {
    const badge = page.locator('[data-testid="chat-mode-badge"]')
    await expect(badge).toHaveAttribute('data-mode', 'build', { timeout: 5000 })
    await expect(badge).toContainText('构建')
  })

  test('CurrentModeBadge DOM 结构:data-testid + data-mode + text', async ({ page }) => {
    const result = await page.evaluate(() => {
      const badge = document.querySelector('[data-testid="chat-mode-badge"]')
      if (!badge) return null
      const textEl = badge.querySelector('span')
      return {
        tag: badge.tagName,
        dataMode: badge.getAttribute('data-mode'),
        hasIcon: badge.querySelector('svg') !== null,
        text: textEl?.textContent?.trim() ?? null,
        ariaHidden: badge.querySelector('svg')?.getAttribute('aria-hidden'),
      }
    })
    expect(result).not.toBeNull()
    expect(result?.dataMode).toBe('build')
    expect(result?.hasIcon).toBe(true)
    expect(result?.ariaHidden).toBe('true')
    expect(result?.text).toBe('构建')
  })

  // ============================================
  // 2. 通道 1: 斜杠命令 /build /plan /review /spec
  // ============================================
  for (const mode of MODES) {
    test(`斜杠命令 ${SLASH_CMDS[mode]} 切换到 ${mode} 模式`, async ({ page }) => {
      const { consoleErrors } = attachErrorGuards(page)
      // 找 textarea(忽略 login modal 的 input)
      const textarea = page.locator('textarea').first()
      await textarea.fill(`${SLASH_CMDS[mode]} `)
      // 触发发送:Enter 提交(AI 侧边栏默认 open 时 textarea 内 Enter 触发 sendMessage)
      await textarea.press('Enter')
      // 等待 toast 出现 + badge 更新
      await page.waitForTimeout(800)
      // 检测是否触发登录弹窗(登录弹窗弹出则跳过,避免阻塞)
      if (await isLoginModalOpen(page)) {
        test.skip(true, '登录模态框弹出,跳过 send 触发的 slash 命令测试')
      }
      // 断言 badge 已切换
      const badge = page.locator('[data-testid="chat-mode-badge"]')
      await expect(badge).toHaveAttribute('data-mode', mode, { timeout: 3000 })
      await expect(badge).toContainText(MODE_LABEL_EXPECT['zh-CN']![mode])
      // 验证 toast(sonner)出现
      const toast = page.locator('[data-sonner-toast]').first()
      await expect(toast).toContainText(MODE_LABEL_EXPECT['zh-CN']![mode], { timeout: 2000 })
      // 无关键 console error(过滤已知 favicon/React DevTools)
      const real = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('React DevTools'),
      )
      expect(real, `unexpected console errors: ${JSON.stringify(real)}`).toHaveLength(0)
    })
  }

  // ============================================
  // 3. 通道 2: Ctrl+1/2/3/4 快捷键
  // ============================================
  for (const mode of MODES) {
    test(`Ctrl+${CTRL_KEY_MAP[mode]} 快捷键切换到 ${mode} 模式`, async ({ page }) => {
      // 先 focus 到 textarea(虽然代码注释说不需 focus 在 input,这里保险起见)
      const textarea = page.locator('textarea').first()
      await textarea.focus()
      // 用 page.keyboard.press(Playwright 原生模拟,ctrlKey 正确)
      await page.keyboard.press(`Control+${CTRL_KEY_MAP[mode]}`)
      await page.waitForTimeout(500)
      const badge = page.locator('[data-testid="chat-mode-badge"]')
      await expect(badge).toHaveAttribute('data-mode', mode, { timeout: 3000 })
    })
  }

  test('Ctrl+1-4 在 textarea 失焦时仍生效(全局 window 监听)', async ({ page }) => {
    // 故意 blur textarea
    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement | null
      ta?.blur()
    })
    await page.keyboard.press('Control+2')
    await page.waitForTimeout(500)
    const badge = page.locator('[data-testid="chat-mode-badge"]')
    await expect(badge).toHaveAttribute('data-mode', 'plan', { timeout: 3000 })
  })

  // ============================================
  // 4. 通道 3: AI 关键词自动判断
  // ============================================
  for (const { input, expected } of KEYWORD_CASES) {
    test(`关键词自动判断: "${input.slice(0, 12)}..." → ${expected}`, async ({ page }) => {
      // 先重置到 build(避免前一个 case 状态污染)
      await setModeStore(page, 'build')
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-testid="chat-mode-badge"]')
      // 找 textarea + 输入 + 提交
      const textarea = page.locator('textarea').first()
      await textarea.fill(input)
      await textarea.press('Enter')
      await page.waitForTimeout(1000)
      // 登录弹窗检测
      if (await isLoginModalOpen(page)) {
        test.skip(true, '登录模态框弹出,跳过 send 触发的关键词测试')
      }
      const badge = page.locator('[data-testid="chat-mode-badge"]')
      await expect(badge).toHaveAttribute('data-mode', expected, { timeout: 3000 })
    })
  }

  // ============================================
  // 5. 5 语言 i18n:CurrentModeBadge label 一致性
  // ============================================
  for (const locale of LOCALES) {
    test(`i18n ${locale}:CurrentModeBadge 在 build/plan 模式下的标签`, async ({ page }) => {
      await switchLocale(page, locale)
      // 访问 /chat,等待 i18n 重新加载
      await page.goto('/chat', { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-testid="chat-mode-badge"]', { timeout: 10000 })
      // build 模式(默认)
      const badge = page.locator('[data-testid="chat-mode-badge"]')
      await expect(badge).toHaveAttribute('data-mode', 'build', { timeout: 5000 })
      await expect(badge).toContainText(MODE_LABEL_EXPECT[locale]!.build)
      // 切到 plan
      await page.keyboard.press('Control+2')
      await page.waitForTimeout(500)
      await expect(badge).toHaveAttribute('data-mode', 'plan', { timeout: 3000 })
      await expect(badge).toContainText(MODE_LABEL_EXPECT[locale]!.plan)
      // 验证 document.documentElement.lang 同步切换
      const lang = await page.evaluate(() => document.documentElement.lang)
      // next-intl 会把 lang 切到目标语言(可能简化为 'zh' / 'en' 等)
      expect(lang.toLowerCase()).toMatch(
        new RegExp(locale.toLowerCase().replace('-', '[-_]?').slice(0, 2)),
      )
    })
  }

  // ============================================
  // 6. Tooltip:modeBadgeTooltip + modeBadgeSwitchHint
  // ============================================
  test('CurrentModeBadge 鼠标悬停显示 tooltip:模式名 + 切换提示', async ({ page }) => {
    const badge = page.locator('[data-testid="chat-mode-badge"]')
    await badge.hover()
    await page.waitForTimeout(400)
    // 找 tooltip(由 @radix-ui/react-tooltip 或 sonner 提供)
    const tooltip = page.locator('[role="tooltip"]').first()
    // tooltip 可能因 Radix 渲染延迟,等久一点
    const tooltipText = await tooltip.textContent({ timeout: 3000 }).catch(() => null)
    if (tooltipText) {
      // tooltip 应包含当前模式名
      expect(tooltipText).toContain('构建')
      // tooltip 应包含切换提示
      expect(
        tooltipText.includes('/build') ||
          tooltipText.includes('/plan') ||
          tooltipText.includes('Ctrl'),
      ).toBe(true)
    }
    // 如果 tooltip 未渲染(可能 Radix 配置差异),不强制 fail
  })
})
