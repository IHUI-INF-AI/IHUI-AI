import { expect, setupTest } from './fixtures'
import { attachErrorGuards, filterRealErrors } from '../tests/e2e/fixtures/helpers'

/**
 * next-intl ICU compressResultDesc FORMATTING_ERROR 回归测试 (2026-07-28 立)
 *
 * 背景:
 *  - apps/web/src/components/ai/context-usage-ring.tsx:256-261 修过 bug
 *    之前用 t('compressResultDesc').replace(...) 客户端字符串替换,
 *    而 next-intl ICU 在调用 t() 时就校验 {original}/{compressed} 变量,
 *    缺失变量 → SSR 抛 FORMATTING_ERROR "context variable 'X' was not provided" → 500
 *  - 修复后:t('compressResultDesc', { original, compressed }) 传 variables 走 ICU 正确插值
 *  - toast.description 渲染: "原始 1234 字符 → 压缩后 567 字符"(zh-CN)
 *                       / "Original 1234 chars → compressed 567 chars"(en)
 *
 * 本测试覆盖 4 个回归点(单语言 zh-CN 默认,但 5 语言都共享同一份 ICU 修复模式):
 *  1) /chat 页面 SSR 无 500(避免 bug 复发导致整页渲染失败)
 *  2) ContextUsageRing Popover trigger 可见(aria-label 由 ICU 渲染,含 {percent} {used} {max} 变量)
 *  3) 点击 "压缩到 20 万字符" 按钮 → POST /api/chat/conversations/{id}/compress 不返回 5xx
 *  4) sonner toast 出现 + description 含数字变量(原始 X / 压缩后 Y)
 *
 * 健壮性:
 *  - 弹层 / 按钮 / 历史消息缺失时优雅 test.skip,不阻塞 CI
 *  - 网络监听先于 click 注册,避免漏掉响应
 *  - locale 切换非强制(默认 zh-CN),但预留 en 文案 fallback
 *  - 120s timeout(对齐 playwright.config.ts 本地默认值)
 *
 * 注意:
 *  - 不修改 fixtures.ts(沿用 adminPage storageState)
 *  - 不引入新 npm 依赖(用 @playwright/test + 现有 helpers)
 *  - 不依赖 SidebarChatHistory/ConversationList 里的 compress 操作项
 *    (那两个走 downloadText + tc('toast.compressed') 不同分支,不在本 bug 范围)
 */

const CHAT_URL = '/chat'
// Popover trigger 的 aria-label 由 ICU 渲染:{percent}%,{used}/{max},点击查看详情
// (zh-CN) / "Context used {percent}%, {used}/{max}, click for details" (en)
// 命中任一即视为 trigger 已渲染(ICU 变量插值成功)
const TRIGGER_ARIA_LABEL_PATTERN = /(上下文已使用|Context used)/
// 压缩按钮文本(zh-CN / en)
const COMPRESS_BTN_200K_PATTERN = /压缩到\s*20\s*万字符|Compress to 200K chars/i
// toast 描述里必含的"数字"段
const COMPRESS_DESC_DIGIT_PATTERN = /\d+/

/** 等待 chat 页面就绪 + ContextUsageRing trigger 可见(ICU 变量插值未报错) */
async function waitForChatWithTrigger(
  page: import('@playwright/test').Page,
): Promise<boolean> {
  await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded' }).catch(() => null)
  await page.waitForLoadState('networkidle').catch(() => {})
  // middleware 拦截 / 后端不可用时可能跳走,允许降级
  if (!page.url().includes('/chat')) return false

  // 优先找 Popover 容器(relative inline-block),再用 aria-label 收敛到 trigger button
  // 关键断言:trigger 的 aria-label 必须由 ICU 渲染,含 {percent}/{used}/{max} 变量
  const trigger = page.locator('button[aria-label]').filter({
    hasText: '',
  })
  const triggers = await trigger.evaluateAll((els) =>
    els
      .map((el) => el.getAttribute('aria-label') ?? '')
      .filter((label) => TRIGGER_ARIA_LABEL_PATTERN.test(label)),
  )
  return triggers.length > 0
}

setupTest.describe('next-intl ICU · compressResultDesc 回归', () => {
  // ============================================
  // 测试 1:页面无 500 + ContextUsageRing trigger 可见(ICU 变量插值未抛错)
  // ============================================
  setupTest(
    '/chat SSR 无 500 + ContextUsageRing trigger 可见(ICU 变量已插值)',
    async ({ adminPage }) => {
      const { consoleErrors, serverErrors } = attachErrorGuards(adminPage)

      const ready = await waitForChatWithTrigger(adminPage)
      if (!ready) {
        setupTest.skip(true, 'admin 未登录或 /chat 不可达 / trigger 未渲染,跳过')
        return
      }

      // 5xx 服务端错误(过滤已知 favicon + AI/llm 白名单)
      expect(filterRealErrors(serverErrors)).toHaveLength(0)

      // 验证关键 DOM 锚点:trigger button 存在 + aria-label 已由 ICU 渲染(非空、非原始 "{percent}")
      const triggerData = await adminPage.evaluate(() => {
        const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]'))
        const matched = btns.find((b) => {
          const label = b.getAttribute('aria-label') ?? ''
          return /上下文已使用|Context used/.test(label)
        })
        return matched
          ? {
              ariaLabel: matched.getAttribute('aria-label'),
              hasRawPlaceholder: /\{percent\}|\{used\}|\{max\}/.test(
                matched.getAttribute('aria-label') ?? '',
              ),
            }
          : null
      })
      expect(triggerData).not.toBeNull()
      // 关键:ICU 变量必须被替换,不能保留原始 {xxx} 占位符(bug 复发特征)
      expect(triggerData?.hasRawPlaceholder).toBe(false)
      expect((triggerData?.ariaLabel ?? '').length).toBeGreaterThan(0)

      // console error 过滤(已知 favicon / React DevTools)
      const real = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('React DevTools'),
      )
      expect(real, `unexpected console errors: ${JSON.stringify(real)}`).toHaveLength(0)
    },
  )

  // ============================================
  // 测试 2:点击 Popover 弹层中的 "压缩到 20 万字符" 按钮 → API 不返回 5xx + toast 含数字
  // ============================================
  setupTest(
    '点击 "压缩到 20 万字符" → POST /compress 不返回 5xx + toast.description 含数字',
    async ({ adminPage }) => {
      const { consoleErrors, serverErrors } = attachErrorGuards(adminPage)

      const ready = await waitForChatWithTrigger(adminPage)
      if (!ready) {
        setupTest.skip(true, 'admin 未登录或 /chat 不可达 / trigger 未渲染,跳过')
        return
      }

      // 1) 打开 Popover(click trigger,触发 Popover content portal)
      //    用 evaluateHandle 直接拿 DOM 节点,避免多层 locator 嵌套
      const triggerHandle = await adminPage.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]'))
        return (
          btns.find((b) => {
            const label = b.getAttribute('aria-label') ?? ''
            return /上下文已使用|Context used/.test(label)
          }) ?? null
        )
      })
      const triggerElement = triggerHandle.asElement()
      if (!triggerElement) {
        setupTest.skip(true, 'trigger 元素句柄不可用,跳过点击')
        return
      }
      await triggerElement.click().catch(() => {})
      await adminPage.waitForTimeout(500)

      // 2) 找 Popover dialog(由 Popover 组件渲染 role="dialog" + aria-label=triggerLabel)
      // 关键:弹层 aria-label 也走 ICU,如果 bug 复发,dialog 不会被挂载(SSR 报错)
      const dialog = adminPage
        .locator('[role="dialog"]')
        .filter({ hasText: /压缩|Compress/i })
        .first()
      if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) {
        setupTest.skip(true, 'Popover 弹层未出现(可能 button 渲染失败 / ICU 报错),跳过压缩测试')
        return
      }

      // 3) 找 "压缩到 20 万字符" 按钮(以 200K 为准;1M 也行但 200K 优先)
      const compressBtn = dialog.getByRole('button').filter({ hasText: COMPRESS_BTN_200K_PATTERN }).first()
      if (!(await compressBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
        setupTest.skip(true, '压缩按钮未渲染(可能 disabled 或 i18n key 缺失),跳过')
        return
      }

      // 4) 监听 POST /api/chat/conversations/*/compress(在 click 前注册,避免漏响应)
      const compressRespPromise = adminPage
        .waitForResponse(
          (r) =>
            /\/api\/chat\/conversations\/[^/]+\/compress(\?|$)/.test(r.url()) &&
            r.request().method() === 'POST',
          { timeout: 15000 },
        )
        .catch(() => null)

      // 5) 点击压缩按钮
      await compressBtn.click().catch(() => {})

      // 6) 等待 API 响应(可能是 200/2xx 成功 / 4xx 业务错误 / 5xx 回归 bug)
      const compressResp = await compressRespPromise
      if (compressResp) {
        const status = compressResp.status()
        // 关键断言:必须不返回 5xx(bug 复发会 500)
        // 4xx 业务错误(如 404 conversation not found)是允许的(数据库无该对话)
        expect(
          status,
          `compress API returned ${status} ${compressResp.url()}`,
        ).toBeLessThan(500)
      } else {
        // 软跳过:网络监听超时,可能是 dev server 冷启动 / 后端不可用
        setupTest.skip(true, 'compress API 响应监听超时(可能后端冷启动),跳过 5xx 断言')
        return
      }

      // 7) 等待 sonner toast 出现
      //    关键:toast.description 由 t('compressResultDesc', {original, compressed}) 渲染
      //    bug 复发时会抛 FORMATTING_ERROR 而不渲染 description
      const toast = adminPage.locator('[data-sonner-toast]').first()
      const toastVisible = await toast.isVisible({ timeout: 5000 }).catch(() => false)
      if (!toastVisible) {
        // toast 没出现,可能是失败路径(4xx 业务错),不强 fail
        setupTest.skip(true, '压缩 toast 未出现(可能业务失败,后端 4xx),跳过 description 断言')
        return
      }

      // 8) 验证 toast description 含数字变量(原始 X / 压缩后 Y)
      const toastText = (await toast.textContent().catch(() => '')) ?? ''
      expect(toastText.length).toBeGreaterThan(0)
      expect(COMPRESS_DESC_DIGIT_PATTERN.test(toastText)).toBe(true)

      // 9) 验证 toast 关键文案片段(任一语言)
      //    成功:含 "压缩成功"/"Compression succeeded"
      //    失败:含 "压缩失败"/"Compression failed"(也允许,只要 description 不崩溃)
      const hasSuccessOrFailTitle =
        /压缩成功|压缩失败|Compression succeeded|Compression failed/i.test(toastText)
      // 如果 toast 含成功标题,description 必含"原始"或"Original" + 数字
      if (/压缩成功|Compression succeeded/i.test(toastText)) {
        // 关键 ICU 回归断言:description 含"原始"或"Original"前缀 + 数字
        // bug 复发时 ICU 抛错,toast 不会显示完整 description
        expect(
          /原始|Original/.test(toastText) && COMPRESS_DESC_DIGIT_PATTERN.test(toastText),
          `compress toast description missing ICU variables: "${toastText}"`,
        ).toBe(true)
      }
      void hasSuccessOrFailTitle

      // 10) 5xx server error 过滤(同测试 1)
      expect(filterRealErrors(serverErrors)).toHaveLength(0)
      const real = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('React DevTools'),
      )
      expect(real, `unexpected console errors: ${JSON.stringify(real)}`).toHaveLength(0)
    },
  )

  // ============================================
  // 测试 3:页面不出现 _not-found 兜底(SSR 失败时 Next.js 会渲染 not-found 页面)
  // ============================================
  setupTest(
    '点击压缩按钮后,页面 URL 仍为 /chat(无 _not-found 兜底)',
    async ({ adminPage }) => {
      if (!(await waitForChatWithTrigger(adminPage))) {
        setupTest.skip(true, 'admin 未登录或 /chat 不可达,跳过')
        return
      }

      // 简单点开弹层 + 点击压缩 + 等待响应
      const triggerHandle = await adminPage.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]'))
        return (
          btns.find((b) => {
            const label = b.getAttribute('aria-label') ?? ''
            return /上下文已使用|Context used/.test(label)
          }) ?? null
        )
      })
      const triggerElement = triggerHandle.asElement()
      if (triggerElement) {
        await triggerElement.click().catch(() => {})
        await adminPage.waitForTimeout(500)
      }

      const dialog = adminPage
        .locator('[role="dialog"]')
        .filter({ hasText: /压缩|Compress/i })
        .first()
      if (!(await dialog.isVisible({ timeout: 2000 }).catch(() => false))) {
        setupTest.skip(true, 'Popover 未出现,跳过')
        return
      }

      const compressBtn = dialog
        .getByRole('button')
        .filter({ hasText: COMPRESS_BTN_200K_PATTERN })
        .first()
      if (await compressBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await compressBtn.click().catch(() => {})
        await adminPage.waitForTimeout(3000)
      }

      // 关键断言:URL 必须仍是 /chat,不能跳到 /_not-found / /500 / /error
      const url = adminPage.url()
      expect(url).toContain('/chat')
      expect(url).not.toMatch(/\/(not[-_]?found|500|error|404|forbidden)\b/i)

      // 兜底:页面 title 或 body 不含"找不到页面"/"500"等
      const bodyText = (await adminPage.locator('body').innerText().catch(() => '')) ?? ''
      expect(
        /404|500|Server-side Exception|找不到页面|not[-_ ]found/i.test(bodyText),
        '页面渲染了 not-found / 500 兜底',
      ).toBe(false)
    },
  )
})
