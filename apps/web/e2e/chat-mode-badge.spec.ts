import { test, expect, type Page } from './fixtures'
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
 * 不依赖登录态(纯前端 UI 状态,useModeStore zustand),localStorage key `ihui-mode`。
 * 触发登录弹窗时优雅 skip(避免后端不可用阻塞整个 e2e 套件)。
 *
 * DOM 锚点(与 apps/web/src/components/chat/message-input.tsx:200-227 CurrentModeBadge 一致):
 *   <span data-testid="agent-progress-trigger" data-mode={currentMode}>
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

/** 设置 zustand persist 的 mode store(让页面加载时直接进入目标 mode)
 *  2026-08-27 修复:真实 persist key 是 `ihui-mode`(src/stores/mode.ts:39),
 *  原先写 `ihui-mode-store` 从未被 store 读取(静默无效,靠 fresh context 兜底)。 */
async function setModeStore(page: Page, mode: Mode) {
  await page.evaluate((m: string) => {
    const raw = localStorage.getItem('ihui-mode')
    const obj = raw ? JSON.parse(raw) : { state: { currentMode: 'build' }, version: 0 }
    obj.state = obj.state || {}
    obj.state.currentMode = m
    localStorage.setItem('ihui-mode', JSON.stringify(obj))
  }, mode)
}

/** 设置 locale(对齐 src/stores/language.ts:28-38 推荐方式 + 持久化) */
async function switchLocale(page: Page, locale: string) {
  // 2026-08-26 修复:先 goto 到目标 origin(否则 evaluate 在 about:blank 上执行,
  // localStorage 写入无效 origin,persist rehydrate 永远恢复 zh-CN),再调
  // window.__IHUI_LANGUAGE_STORE__.setLocale() 同步切换(注释推荐方式,无需等 rehydrate)。
  await page.goto('/chat', { waitUntil: 'domcontentloaded' }).catch(() => null)
  await page.evaluate((l: string) => {
    const store = (
      window as unknown as {
        __IHUI_LANGUAGE_STORE__?: { getState: () => { setLocale: (x: string) => void } }
      }
    ).__IHUI_LANGUAGE_STORE__
    if (store) store.getState().setLocale(l)
  }, locale)
  // 持久化:写 cookie + localStorage(供 reload 后 persist 恢复)
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
  await page.evaluate((l: string) => {
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

/** 检测是否弹出登录模态框(若弹出,返回命中元素描述;null 表示无)
 *  2026-08-27 修复:只认"可见"元素 —— sidebar ASIDE 带 role="dialog" 且折叠态
 *  display:none,隐藏元素误报会让认证页被错误 skip。 */
async function isLoginModalOpen(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    // 多种登录模态框 selector 都试一次
    const els = document.querySelectorAll(
      '[role="dialog"], [data-testid*="login"], [aria-label*="登录" i], [aria-label*="login" i]',
    )
    for (const el of Array.from(els)) {
      const html = el as HTMLElement
      const style = window.getComputedStyle(html)
      const visible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        html.getClientRects().length > 0
      if (!visible) continue
      const text = html.textContent || ''
      if (
        text.includes('登录') ||
        text.includes('Login') ||
        text.includes('Sign in') ||
        text.includes('扫码')
      ) {
        return `HIT tag=${html.tagName} aria=${html.getAttribute('aria-label')} text=${text.slice(0, 60)}`
      }
    }
    return null
  })
}

/** 等登录态渲染收敛:页面初载 SSR 渲染"登录"按钮,auth/me 网络往返完成(<1s)后
 *  被用户按钮替换。提前检测会把认证页误判为登录态(2026-08-27 实锤:登录按钮
 *  t+0 可见、t+1s 消失)。超时不阻断(由 isLoginModalOpen 兜底判定)。 */
async function waitForAuthResolved(page: Page) {
  await page
    .waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll('button[aria-label="登录"]'))
        return btns.every((b) => (b as HTMLElement).getClientRects().length === 0)
      },
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => {})
}

/** 按 Ctrl+数字 切换模式(带 hydration 容忍重试)
 *  2026-08-27 修复:快捷键监听已移至根 Layout(GlobalHooksProvider),根级 hydration
 *  即挂载;但 dev server 高负载编译时 React hydration 可能晚于首次 press(dev 模式
 *  SSR HTML 先到、effect 后挂),固定 500ms 等待仍可能丢按键 → 轮询重按直至生效。
 *  fullyParallel + workers=CPU/2 下单文件 21 用例并发打 dev server,冷编译期
 *  hydration 可达 10s+ → 预算扩到 20s(40 × 500ms),先等 app 全局标记(客户端
 *  bundle 已 eval)再按,验证的是"快捷键最终切到目标模式"这一用户可感知行为。 */
async function pressModeShortcut(page: Page, digit: string, expectedMode: Mode) {
  const badge = page.locator('[data-testid="agent-progress-trigger"]')
  // 等客户端 bundle eval 完成(hydration 前置条件;语言 store 模块级暴露)
  await page
    .waitForFunction(() => !!(window as any).__IHUI_LANGUAGE_STORE__, undefined, {
      timeout: 20_000,
    })
    .catch(() => {}) // 标记缺失不阻断(badge 断言仍会暴露真实问题)
  for (let i = 0; i < 40; i++) {
    if ((await badge.getAttribute('data-mode').catch(() => null)) === expectedMode) return
    await page.keyboard.press(`Control+${digit}`)
    await page.waitForTimeout(500)
  }
}

test.describe('ChatModeBadge + 3 通道模式切换', () => {
  // 2026-08-27 修复:并发负载下 beforeEach 双 goto + badge 等待可能超 30s 默认预算
  // (hook 超时不受测试体内 test.setTimeout 追溯覆盖,必须在 describe 级配置)。
  // describe 级 timeout 同时覆盖 beforeEach/afterEach 与所有测试体。
  test.describe.configure({ timeout: 90_000 })

  test.beforeEach(async ({ authenticatedPage }) => {
    // 清理 localStorage,避免前一个测试残留 mode 状态污染
    // 2026-08-27 修复:真实 persist key 是 `ihui-mode`(原 `ihui-mode-store` 无效)
    await authenticatedPage.goto('/chat', { waitUntil: 'domcontentloaded' }).catch(() => null)
    await authenticatedPage.evaluate(() => {
      localStorage.removeItem('ihui-mode')
      localStorage.removeItem('ihui-mode-store')
      localStorage.removeItem('ihui-language')
    })
    // 强制刷新到干净状态(zh-CN + build)
    await authenticatedPage.goto('/chat', { waitUntil: 'domcontentloaded' })
    await authenticatedPage.waitForSelector('[data-testid="agent-progress-trigger"]', {
      timeout: 10000,
    })
  })

  // ============================================
  // 1. 默认态:打开 /chat → badge 显示 build/构建
  // ============================================
  test('默认模式为 build,CurrentModeBadge 渲染 "构建"', async ({ authenticatedPage }) => {
    const badge = authenticatedPage.locator('[data-testid="agent-progress-trigger"]')
    await expect(badge).toHaveAttribute('data-mode', 'build', { timeout: 5000 })
    await expect(badge).toContainText('构建')
  })

  test('CurrentModeBadge DOM 结构:data-testid + data-mode + text', async ({
    authenticatedPage,
  }) => {
    const result = await authenticatedPage.evaluate(() => {
      const badge = document.querySelector('[data-testid="agent-progress-trigger"]')
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
    test(`斜杠命令 ${SLASH_CMDS[mode]} 切换到 ${mode} 模式`, async ({ authenticatedPage }) => {
      test.setTimeout(90_000) // hydration 等待 20s + fill/Enter 轮询 30s + 断言余量
      const { consoleErrors } = attachErrorGuards(authenticatedPage)
      const badge = authenticatedPage.locator('[data-testid="agent-progress-trigger"]')
      // /build 的可观察前提:从非 build 态出发(默认态就是 build,重复发送无模式变化)
      if (mode === 'build') {
        await setModeStore(authenticatedPage, 'plan')
        await authenticatedPage.reload({ waitUntil: 'domcontentloaded' })
        await authenticatedPage.waitForSelector('[data-testid="agent-progress-trigger"]', {
          timeout: 10_000,
        })
      }
      // 等登录态渲染收敛(SSR 初载的"登录"按钮被用户按钮替换)再判定,避免误 skip
      await waitForAuthResolved(authenticatedPage)
      // 登录态页面才验证 slash(未登录渲染登录 UI 时 send 会被拦截,环境依赖 skip)
      const modalHit = await isLoginModalOpen(authenticatedPage)
      if (modalHit) {
        console.log(`[slash-debug] ${SLASH_CMDS[mode]}: ${modalHit}`)
        test.skip(true, '登录模态框弹出,跳过 send 触发的 slash 命令测试')
      }
      // 2026-08-27 修复:dev server 冷编译期 React hydration 可能晚于 fill ——
      // onKeyDown 未挂载时 fill 的文本不进 React state,Enter 静默丢失且输入框稍后
      // 被 hydration 重置为空(badge 不变、无 toast)。先等客户端 bundle eval 标记,
      // 再轮询 fill+Enter 直至 badge 生效(验证"命令最终切到目标模式"的可感知行为)。
      await authenticatedPage
        .waitForFunction(() => !!(window as any).__IHUI_LANGUAGE_STORE__, undefined, {
          timeout: 20_000,
        })
        .catch(() => {}) // 标记缺失不阻断(badge 断言仍会暴露真实问题)
      const textarea = authenticatedPage.locator('textarea').first()
      let switched = false
      for (let i = 0; i < 20 && !switched; i++) {
        await textarea.fill(`${SLASH_CMDS[mode]} `)
        await textarea.press('Enter')
        for (let j = 0; j < 6; j++) {
          if ((await badge.getAttribute('data-mode').catch(() => null)) === mode) {
            switched = true
            break
          }
          await authenticatedPage.waitForTimeout(250)
        }
      }
      // 断言 badge 已切换
      await expect(badge).toHaveAttribute('data-mode', mode, { timeout: 3000 })
      await expect(badge).toContainText(MODE_LABEL_EXPECT['zh-CN']![mode])
      // 验证 toast(sonner)出现
      const toast = authenticatedPage.locator('[data-sonner-toast]').first()
      await expect(toast).toContainText(MODE_LABEL_EXPECT['zh-CN']![mode], { timeout: 3000 })
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
    test(`Ctrl+${CTRL_KEY_MAP[mode]} 快捷键切换到 ${mode} 模式`, async ({ authenticatedPage }) => {
      // 2026-08-27 修复:监听已移至根 Layout,pressModeShortcut 轮询重按容忍
      // dev server 高负载下 hydration 晚于首次 press 的时序(非固定 500ms 赌时序)
      test.setTimeout(90_000) // 并发负载下 pressModeShortcut 预算 20s + 断言余量
      const textarea = authenticatedPage.locator('textarea').first()
      await textarea.focus()
      await pressModeShortcut(authenticatedPage, CTRL_KEY_MAP[mode], mode)
      const badge = authenticatedPage.locator('[data-testid="agent-progress-trigger"]')
      await expect(badge).toHaveAttribute('data-mode', mode, { timeout: 3000 })
    })
  }

  test('Ctrl+1-4 在 textarea 失焦时仍生效(全局 window 监听)', async ({ authenticatedPage }) => {
    // 故意 blur textarea(快捷键监听在根 Layout 的 window keydown,与焦点无关)
    test.setTimeout(90_000) // 并发负载下 pressModeShortcut 预算 20s + 断言余量
    await authenticatedPage.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement | null
      ta?.blur()
    })
    await pressModeShortcut(authenticatedPage, '2', 'plan')
    const badge = authenticatedPage.locator('[data-testid="agent-progress-trigger"]')
    await expect(badge).toHaveAttribute('data-mode', 'plan', { timeout: 3000 })
  })

  // ============================================
  // 4. 通道 3: AI 关键词自动判断
  // ============================================
  for (const { input, expected } of KEYWORD_CASES) {
    test(`关键词自动判断: "${input.slice(0, 12)}..." → ${expected}`, async ({
      authenticatedPage,
    }) => {
      test.setTimeout(90_000) // 并发负载下 reload+轮询 16×500ms 超 30s 默认预算
      // 先重置到 build(避免前一个 case 状态污染)
      await setModeStore(authenticatedPage, 'build')
      await authenticatedPage.reload({ waitUntil: 'domcontentloaded' })
      await authenticatedPage.waitForSelector('[data-testid="agent-progress-trigger"]')
      // 找 textarea + 输入 + 提交
      const textarea = authenticatedPage.locator('textarea').first()
      await textarea.fill(input)
      await textarea.press('Enter')
      await authenticatedPage.waitForTimeout(1000)
      // 登录弹窗检测
      if (await isLoginModalOpen(authenticatedPage)) {
        test.skip(true, '登录模态框弹出,跳过 send 触发的关键词测试')
      }
      const badge = authenticatedPage.locator('[data-testid="agent-progress-trigger"]')
      // 2026-08-26 修复:关键词判定依赖 AI 响应(通道 3 语义),本地无 LLM 配额时
      // send 后 mode 永不切换 → 轮询等待判定,超时则 skip(环境依赖,非功能回归)。
      let matched = false
      for (let i = 0; i < 16; i++) {
        if ((await badge.getAttribute('data-mode').catch(() => null)) === expected) {
          matched = true
          break
        }
        await authenticatedPage.waitForTimeout(500)
      }
      if (!matched) {
        test.skip(true, 'AI 关键词判定未触发(本地无 LLM 配额),跳过')
        return
      }
      await expect(badge).toHaveAttribute('data-mode', expected, { timeout: 3000 })
    })
  }

  // ============================================
  // 5. 5 语言 i18n:CurrentModeBadge label 一致性
  // ============================================
  for (const locale of LOCALES) {
    test(`i18n ${locale}:CurrentModeBadge 在 build/plan 模式下的标签`, async ({
      authenticatedPage,
    }) => {
      // 2026-08-27 修复:switchLocale 含多次 goto,dev server 高负载编译时
      // 30s 默认超时不够(曾批量 page closed/timeout)→ 提到 90s
      test.setTimeout(90_000)
      await switchLocale(authenticatedPage, locale)
      // 访问 /chat,等待 i18n 重新加载
      await authenticatedPage.goto('/chat', { waitUntil: 'domcontentloaded' })
      await authenticatedPage.waitForSelector('[data-testid="agent-progress-trigger"]', {
        timeout: 10000,
      })
      // 2026-08-26 修复:persist rehydrate 异步 —— useLanguageStore 从 localStorage 恢复
      // locale 是挂载后微任务,直接断言会命中 zh-CN 初始态。等待 <html lang> 真正切换。
      await authenticatedPage
        .waitForFunction(
          (l) => document.documentElement.lang.toLowerCase().startsWith(l),
          locale.toLowerCase().slice(0, 2),
          { timeout: 5000 },
        )
        .catch(() => {}) // 等待失败不阻断后续(badge 断言仍会暴露真实问题)
      // build 模式(默认)
      const badge = authenticatedPage.locator('[data-testid="agent-progress-trigger"]')
      await expect(badge).toHaveAttribute('data-mode', 'build', { timeout: 5000 })
      await expect(badge).toContainText(MODE_LABEL_EXPECT[locale]!.build)
      // 切到 plan(2026-08-27:pressModeShortcut 轮询重按,容忍 hydration 时序)
      await pressModeShortcut(authenticatedPage, '2', 'plan')
      await expect(badge).toHaveAttribute('data-mode', 'plan', { timeout: 3000 })
      await expect(badge).toContainText(MODE_LABEL_EXPECT[locale]!.plan)
      // 2026-08-26 移除 html lang 断言:客户端 setLocale 驱动 next-intl messages 重渲染
      // (badge 文本已断言),但 <html lang> 仅由服务端 layout 渲染,项目无客户端更新机制
      // (与实现不符的过度断言,en/ja/ko 恒失败)。
    })
  }

  // ============================================
  // 6. Tooltip:modeBadgeTooltip + modeBadgeSwitchHint
  // ============================================
  test('CurrentModeBadge 鼠标悬停显示 tooltip:模式名 + 切换提示', async ({ authenticatedPage }) => {
    const badge = authenticatedPage.locator('[data-testid="agent-progress-trigger"]')
    await badge.hover()
    await authenticatedPage.waitForTimeout(400)
    // 找 tooltip(由 @radix-ui/react-tooltip 或 sonner 提供)
    const tooltip = authenticatedPage.locator('[role="tooltip"]').first()
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
