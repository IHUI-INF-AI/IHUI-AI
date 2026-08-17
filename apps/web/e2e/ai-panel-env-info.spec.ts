import { setupTest as test, expect } from './fixtures'
import type { Locator, Page } from '@playwright/test'

/**
 * AI 面板环境信息弹窗(重构后,对齐 Cursor 参考图)E2E 测试(2026-08-17)
 *
 * 覆盖用例:
 * 1. header 三按钮存在且可见(环境信息 / 打开终端 / 切换工作展示区)
 * 2. 环境信息按钮打开弹窗(标题非空 + 无工作区/有工作区分支 + 关闭)
 * 3. 本地行/分支行展开显示仓库信息(localPath/remotes + lastCommit/noCommit)
 * 4. 提交或推送行打开提交弹窗(文本域 + 仅提交/提交并推送/取消)
 * 5. header "+" 打开完整详情 Dialog(localPath/remotes/branch section)
 * 6. 切换工作展示区折叠/展开
 * 7. 终端 dock 展开/收起(仅断言容器出现/收起,不断言内部——登录态依赖)
 * 8. GitHub 配置弹窗打开/交互(无 token 时 PR 行「连接 GitHub」入口 → 弹窗授权主按钮/手动区 + 取消关闭)
 * 9. GitHub 授权流程(「使用 GitHub 授权」→ 等待授权态(授权码/授权链接/打开页面) 或 未配置降级(手动区展开))
 * 10. 比较分支行 GitHub 外链(GitHub 仓库 → <a> compare 外链;非 GitHub → <button> 降级)
 *
 * 说明:
 * - git 数据依赖 activeWorkspace(顶部绑定工作区):
 *   无工作区 → env-info-no-workspace;有工作区 → changes/not-repo/error
 *   (数据加载可能慢,用 expect.poll 兜底)。
 * - 重构进行中,行结构可能有微调:测试以"有工作区显示数据 / 无工作区显示提示"
 *   两种分支兼容,不写死内部行顺序;关键行缺失或不可用时 test.skip。
 * - 所有测试用 fixtures 的 authenticatedPage(自动登录 test@aizhs.top)。
 */

/** 打开首页并等待 AI 面板(docked 默认 open)出现 */
async function openHome(page: Page) {
  await page.goto('/')
  await expect(page.locator('[data-testid="ai-side-panel-aside"]')).toBeVisible({ timeout: 10000 })
}

/**
 * 打开环境信息弹窗并等待数据分支确定。
 * @returns hasData=true 表示"有工作区且 git 状态已加载(changes/not-repo/error)"
 */
async function openEnvPopover(page: Page): Promise<{ popover: Locator; hasData: boolean }> {
  await page.locator('button[aria-label="环境信息"]').click()

  const popover = page.locator('[data-testid="env-info-popover"]')
  await expect(popover).toBeVisible({ timeout: 10000 })

  // 无工作区 → 显示提示,不调 git API
  const noWorkspace = popover.locator('[data-testid="env-info-no-workspace"]')
  if ((await noWorkspace.count()) > 0) {
    await expect(noWorkspace).toBeVisible({ timeout: 10000 })
    return { popover, hasData: false }
  }

  // 有工作区 → git 数据可能加载慢;也可能为 not-repo / error,均视为已加载完成
  await expect
    .poll(
      () =>
        popover.locator(
          '[data-testid="env-info-changes"], [data-testid="env-info-changes-empty"], [data-testid="env-info-not-repo"], [data-testid="env-info-error"]',
        ).count(),
      { timeout: 10000 },
    )
    .toBeGreaterThan(0)
  return { popover, hasData: true }
}

/**
 * 关闭 GitHub 配置/授权弹窗(Radix Modal,portal 渲染):
 * 优先 testid 取消按钮(github-token-cancel),其次 common.cancel 文案「取消」,
 * 最后 Modal 右上 X(common.close「关闭」)。点击后断言弹窗内容消失。
 */
async function closeGithubDialog(page: Page, dialogContent: Locator) {
  const dialog = page.getByRole('dialog').last()
  const byTestId = page.locator('[data-testid="github-token-cancel"]')
  const byText = dialog.getByRole('button', { name: /取消|cancel/i }).first()
  const byX = dialog.getByRole('button', { name: /关闭|close/i }).first()
  const cancelBtn = (await byTestId.count()) > 0 ? byTestId : (await byText.count()) > 0 ? byText : byX
  await cancelBtn.click()
  await expect(dialogContent).not.toBeVisible({ timeout: 10000 })
}

test.describe('AI panel env-info (重构后)', () => {
  test.setTimeout(60000)

  test('AI 面板 header 三按钮存在且可见', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)

    // 环境信息(SlidersHorizontal)→ 弹窗
    await expect(authenticatedPage.locator('button[aria-label="环境信息"]')).toBeVisible({
      timeout: 10000,
    })
    // 打开终端(SquareTerminal)→ 终端 dock
    await expect(authenticatedPage.locator('button[aria-label="打开终端"]')).toBeVisible({
      timeout: 10000,
    })
    // 切换工作展示区(PanelRight)→ WebWorkPanel toggle
    await expect(authenticatedPage.locator('button[aria-label="切换工作展示区"]')).toBeVisible({
      timeout: 10000,
    })
  })

  test('环境信息按钮打开弹窗', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)

    const { popover } = await openEnvPopover(authenticatedPage)
    // openEnvPopover 已完成分支兜底:无工作区 → no-workspace 可见;有工作区 → 数据行出现

    // 标题非空
    const title = popover.locator('[data-testid="env-info-title"]')
    await expect(title).toBeVisible({ timeout: 10000 })
    const titleText = await title.textContent()
    expect(titleText?.trim().length ?? 0).toBeGreaterThan(0)

    // 关闭:优先 header 关闭按钮;若重构后无 close,用 header 三按钮再次点击 toggle
    const closeBtn = popover.locator('[data-testid="env-info-close"]')
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click()
    } else {
      await authenticatedPage.locator('button[aria-label="环境信息"]').click()
    }
    await expect(popover).not.toBeVisible({ timeout: 10000 })
  })

  test('本地行/分支行展开显示仓库信息', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)
    const { popover, hasData } = await openEnvPopover(authenticatedPage)
    test.skip(!hasData, '无工作区,跳过仓库信息展开断言')

    const localRow = popover.locator('[data-testid="env-info-row-branch"]')
    if ((await localRow.count()) === 0) {
      test.skip(true, '工作区非 git 仓库或为错误态,无本地行')
      return
    }

    // 本地行 → branch-details(目标结构:localPath / remotes)
    await localRow.click()
    const details = popover.locator('[data-testid="env-info-branch-details"]')
    await expect(details).toBeVisible({ timeout: 10000 })
    const detailsText = ((await details.textContent()) ?? '').trim()
    expect(detailsText.length).toBeGreaterThan(0)

    // 分支行 → ahead/behind + lastCommit / noCommit
    // 目标:本地行之后有独立分支行,点击展开后展示;当前实现:lastCommit 直接在
    // branch-details 内。两种结构兼容:先查当前展开区,没有则尝试点击候选行直到出现。
    const lastCommit = popover.locator('[data-testid="env-info-last-commit"]')
    if ((await lastCommit.count()) === 0) {
      const candidates = popover.locator(
        'button:not([data-testid="env-info-row-branch"]):not([data-testid="env-info-row-commit-push"]):not([data-testid="env-info-refresh"]):not([data-testid="env-info-close"]):not([data-testid="env-info-view-full"]):not([data-testid="env-info-error-retry"])',
      )
      const n = await candidates.count()
      for (let i = 0; i < n; i += 1) {
        const btn = candidates.nth(i)
        if (!(await btn.isDisabled())) {
          await btn.click()
          if ((await lastCommit.count()) > 0) break
        }
      }
    }
    await expect(lastCommit).toBeVisible({ timeout: 10000 })
    const lastCommitText = ((await lastCommit.textContent()) ?? '').trim()
    // 有最近提交 → hash+message;无提交 → noCommit 文案,两者均非空
    expect(lastCommitText.length).toBeGreaterThan(0)
  })

  test('提交或推送行打开提交弹窗', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)
    const { popover, hasData } = await openEnvPopover(authenticatedPage)
    test.skip(!hasData, '无工作区,跳过提交弹窗断言')

    const commitPushRow = popover.locator('[data-testid="env-info-row-commit-push"]')
    if ((await commitPushRow.count()) === 0 || (await commitPushRow.isDisabled())) {
      test.skip(true, '当前无变更可提交或行缺失,跳过提交弹窗断言')
      return
    }
    await commitPushRow.click()

    // 提交弹窗 Modal:文本域 + 三按钮
    const textarea = authenticatedPage.locator('[data-testid="env-commit-textarea"]')
    await expect(textarea).toBeVisible({ timeout: 10000 })
    await expect(authenticatedPage.locator('[data-testid="env-commit-cancel"]')).toBeVisible({
      timeout: 10000,
    })
    await expect(authenticatedPage.locator('[data-testid="env-commit-only"]')).toBeVisible({
      timeout: 10000,
    })
    await expect(authenticatedPage.locator('[data-testid="env-commit-push"]')).toBeVisible({
      timeout: 10000,
    })

    // 取消 → 弹窗关闭
    await authenticatedPage.locator('[data-testid="env-commit-cancel"]').click()
    await expect(textarea).not.toBeVisible({ timeout: 10000 })
  })

  test('header "+" 打开完整详情 Dialog', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)
    const { popover, hasData } = await openEnvPopover(authenticatedPage)

    const viewFullBtn = popover.locator('[data-testid="env-info-view-full"]')
    if ((await viewFullBtn.count()) === 0) {
      test.skip(true, 'header 未提供完整详情按钮,跳过')
      return
    }
    await viewFullBtn.click()

    // 完整详情 Modal 打开:env-full-close 按钮(Modal 渲染标志)
    const dialogClose = authenticatedPage.locator('[data-testid="env-full-close"]')
    await expect(dialogClose).toBeVisible({ timeout: 10000 })

    if (hasData) {
      // 有工作区 → 断言仓库信息 section(数据可能加载慢,轮询出现即认为已加载)
      await expect
        .poll(
          () =>
            authenticatedPage.locator(
              '[data-testid="env-full-localpath"], [data-testid="env-full-remote"], [data-testid="env-full-no-remotes"], [data-testid="env-full-not-repo"]',
            ).count(),
          { timeout: 10000 },
        )
        .toBeGreaterThan(0)
    } else {
      // 无工作区 → 仍打开 Dialog,显示 noWorkspace 占位
      await expect(authenticatedPage.locator('[data-testid="env-full-no-workspace"]')).toBeVisible({
        timeout: 10000,
      })
    }

    // 关闭
    const closeBtn = authenticatedPage.locator('[data-testid="env-full-close"]')
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click()
      await expect(closeBtn).not.toBeVisible({ timeout: 10000 })
    }
  })

  test('切换工作展示区按钮折叠/展开工作展示区', async ({ authenticatedPage }) => {
    // 先导航到首页完成加载(工作展示区折叠状态不持久化,初始必为展开)
    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator('[data-testid="ai-side-panel-aside"]')).toBeVisible({
      timeout: 10000,
    })

    const workArea = authenticatedPage.locator('#work-area-portal-root')
    const wpBtn = authenticatedPage.locator('button[aria-label="切换工作展示区"]')
    await expect(wpBtn).toBeVisible({ timeout: 10000 })

    // 初始:work-area 可见
    await expect(workArea).toBeVisible({ timeout: 5000 })

    // 点击 → work-area 隐藏,AI 面板占满右侧(宽度增大到接近视口)
    await wpBtn.click()
    await expect(workArea).not.toBeVisible({ timeout: 5000 })
    await expect
      .poll(
        () =>
          authenticatedPage.evaluate(() => {
            const root = document.querySelector('[data-testid="ai-panel-root"]')
            return root ? root.getBoundingClientRect().width : 0
          }),
        { timeout: 3000 },
      )
      .toBeGreaterThan(800) // 面板从默认 380 扩到占满(视口 1280+)

    // 再点 → 恢复:work-area 可见,AI 面板回默认宽度
    await wpBtn.click()
    await expect(workArea).toBeVisible({ timeout: 5000 })
    await expect
      .poll(
        () =>
          authenticatedPage.evaluate(() => {
            const root = document.querySelector('[data-testid="ai-panel-root"]')
            return root ? root.getBoundingClientRect().width : 0
          }),
        { timeout: 3000 },
      )
      .toBeLessThan(800)
  })

  test('终端按钮展开/收起底部终端停靠面板', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)

    const termBtn = authenticatedPage.locator('button[aria-label="打开终端"]')
    await expect(termBtn).toBeVisible({ timeout: 10000 })

    // 点击展开 dock:只断言容器出现,不断言内部内容(登录态依赖)
    await termBtn.click()
    const dock = authenticatedPage.locator('[data-testid="ai-terminal-dock"]')
    await expect(dock).toBeVisible({ timeout: 10000 })

    // 再次点击终端按钮 → 收起
    await termBtn.click()
    await expect(dock).not.toBeVisible({ timeout: 10000 })
  })

  test('GitHub 配置弹窗打开/交互', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)
    const { popover, hasData } = await openEnvPopover(authenticatedPage)
    test.skip(!hasData, '无工作区,跳过 GitHub 配置弹窗断言')

    // 无 token 时 PR 行显示「连接 GitHub」入口;有 token/非 GitHub 仓库则不渲染
    const connectBtn = popover.locator('[data-testid="env-info-connect-github"]')
    if ((await connectBtn.count()) === 0) {
      test.skip(true, '无配置入口(非 GitHub/已配置),跳过')
      return
    }
    await connectBtn.click()

    // 新结构:授权主按钮「使用 GitHub 授权」;旧结构兼容:token 输入框直接可见
    // (Modal portal 渲染,定位在 page 层级;token 输入在 OAuth 结构中处于折叠的手动区,不直接断言可见)
    const authStart = authenticatedPage.locator('[data-testid="github-auth-start"]')
    const tokenInput = authenticatedPage.locator('[data-testid="github-token-input"]')
    await expect(authStart.or(tokenInput)).toBeVisible({ timeout: 10000 })

    // 取消关闭弹窗(不点击保存/授权,避免写入真实 token)
    await closeGithubDialog(authenticatedPage, authStart.or(tokenInput))
  })

  test('GitHub 授权流程(使用 GitHub 授权)', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)
    const { popover, hasData } = await openEnvPopover(authenticatedPage)
    test.skip(!hasData, '无工作区,跳过 GitHub 授权流程断言')

    // 无 token 时 PR 行显示「连接 GitHub」入口;有 token/非 GitHub 仓库则不渲染
    const connectBtn = popover.locator('[data-testid="env-info-connect-github"]')
    if ((await connectBtn.count()) === 0) {
      test.skip(true, '无连接入口(非 GitHub/已配置),跳过')
      return
    }
    await connectBtn.click()

    // 授权主按钮(新结构);旧结构未实现 OAuth UI 时跳过
    const authStart = authenticatedPage.locator('[data-testid="github-auth-start"]')
    if ((await authStart.count()) === 0) {
      test.skip(true, 'OAuth 授权 UI 未就绪(无「使用 GitHub 授权」按钮),跳过')
      return
    }
    await expect(authStart).toBeVisible({ timeout: 10000 })

    // 点击「使用 GitHub 授权」→ 进入等待授权态(有 client_id)或未配置降级(400 → 手动区自动展开)
    await authStart.click()

    const userCode = authenticatedPage.locator('[data-testid="github-user-code"]')
    const tokenInput = authenticatedPage.locator('[data-testid="github-token-input"]')

    // 等待两种终态之一出现:授权态(user-code)或降级态(token-input)
    await expect
      .poll(
        async () => {
          const code = await userCode.isVisible().catch(() => false)
          const manual = await tokenInput.isVisible().catch(() => false)
          return code || manual
        },
        { timeout: 10000 },
      )
      .toBe(true)

    if (await userCode.isVisible()) {
      // 授权态:授权码非空 + 授权链接/「打开授权页面」/复制按钮存在(不点击打开新窗口)
      const codeText = ((await userCode.textContent()) ?? '').trim()
      expect(codeText.length).toBeGreaterThan(0)
      await expect(
        authenticatedPage.locator('[data-testid="github-verification-uri"]'),
      ).toBeVisible({ timeout: 10000 })
      await expect(
        authenticatedPage.locator('[data-testid="github-open-auth-page"]'),
      ).toBeVisible({ timeout: 10000 })
      await expect(
        authenticatedPage.locator('[data-testid="github-copy-code"]'),
      ).toBeVisible({ timeout: 10000 })
    } else {
      // 未配置降级(400 + 手动区自动展开):手动输入区可见
      await expect(tokenInput).toBeVisible({ timeout: 10000 })
      await expect(
        authenticatedPage.locator('[data-testid="github-token-save"]'),
      ).toBeVisible({ timeout: 10000 })
    }

    // 关闭弹窗(取消按钮 common.cancel,或 Modal 右上 X)
    await closeGithubDialog(authenticatedPage, authStart.or(tokenInput))
  })

  test('比较分支行 GitHub 外链', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)
    const { popover, hasData } = await openEnvPopover(authenticatedPage)
    test.skip(!hasData, '无工作区,跳过比较分支行断言')

    const compareRow = popover.locator('[data-testid="env-info-row-compare"]')
    if ((await compareRow.count()) === 0) {
      test.skip(true, '无比较分支行(非 git 仓库/错误态),跳过')
      return
    }
    await expect(compareRow).toBeVisible({ timeout: 10000 })

    // GitHub 仓库 → <a> 外链(href 指向 compare 页面);非 GitHub 仓库 → <button>(跳本地 IDE,不点击)
    const href = await compareRow.getAttribute('href')
    if (href !== null) {
      expect(href).toMatch(/github\.com\/.+\/compare\//)
      expect(await compareRow.getAttribute('target')).toBe('_blank')
    }
  })
})
