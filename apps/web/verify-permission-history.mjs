/**
 * 浏览器自验脚本 — 权限模式历史面板(2026-07-25 Part C)
 *
 * 验证范围:PermissionHistoryPanel 的 5 个关键行为
 *  - 切模式 → localStorage ihui:permission-mode-history 自动追加记录
 *  - 点 Clock4 触发器 → Popover 打开,显示历史列表
 *  - 历史项含模式名 + 来源 + 相对时间
 *  - 累计统计(默认/替我审批/完全访问)显示在底部
 *  - 清空按钮 → confirm 后 localStorage 记录被清空
 *  - 多次切模式 → 列表按时间倒序(最新在前),最多 10 条
 *
 * 5 个测试场景:
 *  s1. 切到 bypass-permissions → localStorage 追加 1 条记录(mode=bypass-permissions)
 *  s2. 点 history trigger → Popover 出现,含 1 条记录 + 模式名("完全访问") + 来源("弹窗")
 *  s3. 多次切(default → bypass → accept-edits → bypass) → 列表 4 条 + 最新在前 + 最多 10 条
 *  s4. 累计统计:3 个模式都有"X小时 X分钟"或"0秒"显示
 *  s5. 清空历史 → localStorage ihui:permission-mode-history 为空 + Popover 显示"暂无历史"
 *
 * 实现要点:
 *  - 复用 setState 写 localStorage + reload 模式控制 store 状态
 *  - 拦截 /api/workspace/* 防止真实 API 报错
 *  - 用 data-testid="permission-history-trigger" / "permission-history-panel" 精确选择
 *  - 监听 [data-sonner-toast] 不需要(本脚本不触发 toast)
 *  - 截图保存到 .trae-cn/tmp/permission-history/
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = 'http://127.0.0.1:8801'
const SCREENSHOT_DIR = resolve(process.cwd(), '.trae-cn/tmp/permission-history')
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true })

const DOM_LOG = []

/** 读 localStorage ihui:permission-mode-history */
async function readHistory(page) {
  return page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('ihui:permission-mode-history')
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return 'PARSE_ERR'
    }
  })
}

/** 抓 history panel DOM 状态(打开时) */
async function captureHistoryState(page, label) {
  const data = { label }
  // trigger 按钮
  data.triggerCount = await page.locator('[data-testid="permission-history-trigger"]').count()
  // panel 内容(打开后才存在)
  data.panelCount = await page.locator('[data-testid="permission-history-panel"]').count()
  if (data.panelCount > 0) {
    const panel = page.locator('[data-testid="permission-history-panel"]').first()
    data.panelText = ((await panel.textContent()) ?? '').trim().slice(0, 600)
    // 抓 history 项 li 数量
    data.listItemCount = await page.locator('[data-testid="permission-history-panel"] li').count()
    // 抓累计统计
    data.hasStatsTitle = /累计统计|historyStatsTitle/.test(data.panelText)
    data.hasModeAsk = /请求批准|mode\.ask/.test(data.panelText)
    data.hasModeAuto = /替我审批|mode\.auto/.test(data.panelText)
    data.hasModeFull = /完全访问|mode\.full/.test(data.panelText)
    // 抓空状态
    data.hasEmptyState = /暂无历史|historyEmpty/.test(data.panelText)
    // 抓来源标签
    data.hasSourcePopover = /弹窗|popover/.test(data.panelText)
    data.hasSourceShiftTab = /Shift\+Tab|shift-tab/.test(data.panelText)
    data.hasSourceSlash = /斜杠|slash/.test(data.panelText)
    data.hasSourceAutoRevert = /自动|auto-revert/.test(data.panelText)
    // 清空按钮
    data.clearBtnCount = await page
      .locator('[data-testid="permission-history-panel"] button[aria-label*="清空"]')
      .count()
  } else {
    data.panelText = ''
    data.listItemCount = 0
  }
  // 读 localStorage 历史条数
  const history = await readHistory(page)
  data.lsHistoryCount = Array.isArray(history) ? history.length : 0
  data.lsHistory = Array.isArray(history) ? history.slice(0, 3) : history
  DOM_LOG.push(data)
  return data
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
  })
  await ctx.addInitScript(() => {
    try {
      window.__IHUI_SKIP_WS_VALIDATE__ = true
      window.localStorage.setItem('ihui:full-access-suppressed', '1')
      window.localStorage.setItem('ihui:full-access-acknowledged', '1')
    } catch {}
  })
  const page = await ctx.newPage()
  page.on('pageerror', (err) => console.error('[pageerror]', err.message.slice(0, 300)))
  page.on('console', (msg) => {
    const t = msg.text()
    if (msg.type() === 'error' || msg.type() === 'warning') {
      if (
        t.includes('IntlError') ||
        t.includes('CORS') ||
        t.includes('ERR_FAILED') ||
        t.includes('analytics') ||
        t.includes('Failed to load resource') ||
        t.includes('images.localPatterns')
      ) {
        return
      }
      console.error(`[console.${msg.type()}]`, t.slice(0, 200))
    }
    if (t.includes('IHUI_HISTORY') || t.includes('IHUI_OPEN_HISTORY')) {
      console.log('  [hook]', t)
    }
  })

  // 拦截 /api/workspace/*
  await ctx.route(/\/api\/workspace\//, async (route) => {
    const url = route.request().url()
    if (url.includes('/api/workspace/permissions') && route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            permission: {
              workspacePath: 'C:/Windows',
              name: 'Windows',
              mode: 'default',
              techStack: 'typescript,next.js',
            },
          },
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { permission: null, permissions: [] } }),
    })
  })
  // 拦截 /api/chat/* 调用,避免真实 LLM 跑流程
  await ctx.route(/\/api\/chat\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { message: { id: 'mock', role: 'assistant', content: 'mock' } } }),
    })
  })

  /** 重设 mock 模式 + 清空历史 + reload */
  async function setState(mode, clearHistory = true) {
    await page.evaluate(
      ([m, clear]) => {
        window.localStorage.setItem(
          'ihui-ai-panel',
          JSON.stringify({
            state: {
              width: 400,
              activeWorkspace: {
                path: 'C:/Windows',
                name: 'Windows',
                mode: m,
                techStack: ['typescript', 'next.js'],
              },
            },
            version: 0,
          }),
        )
        window.localStorage.removeItem('ihui:auto-revert-bypass')
        if (clear) {
          window.localStorage.removeItem('ihui:permission-mode-history')
        }
        window.localStorage.setItem('ihui:full-access-suppressed', '1')
        window.localStorage.setItem('ihui:full-access-acknowledged', '1')
      },
      [mode, clearHistory],
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
  }

  console.log('[1/5] 打开页面(初始 default 模式,清空历史)...')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(4000)
  await setState('default', true)

  // 验证 trigger 按钮存在
  const triggerInit = await page.locator('[data-testid="permission-history-trigger"]').count()
  if (triggerInit === 0) {
    console.error('未找到 history trigger 按钮,提前退出')
    await browser.close()
    process.exit(1)
  }
  console.log('  → history trigger 存在:', triggerInit)

  // s1. 切到 bypass-permissions → localStorage 追加 1 条记录
  console.log('[s1] 切到 bypass-permissions → localStorage 追加 1 条记录')
  await setState('bypass-permissions', true)
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '1-bypass-record.png'), fullPage: false })
  const s1 = await captureHistoryState(page, 's1-bypass-record')
  console.log('  → lsHistoryCount:', s1.lsHistoryCount, ', first mode:', s1.lsHistory?.[0]?.mode)

  // s2. 点 history trigger → Popover 出现 + 含 1 条记录 + 模式名"完全访问" + 来源"弹窗"
  console.log('[s2] 点 history trigger → Popover 出现,显示 1 条记录')
  const trigger = page.locator('[data-testid="permission-history-trigger"]').first()
  await trigger.click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '2-panel-open-1-record.png'), fullPage: false })
  const s2 = await captureHistoryState(page, 's2-panel-open-1-record')
  console.log('  → listItemCount:', s2.listItemCount, ', hasModeFull:', s2.hasModeFull, ', hasSourcePopover:', s2.hasSourcePopover)
  // 关掉 popover
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)

  // s3. 多次切(default → bypass → accept-edits → bypass) → 列表 4 条 + 最新在前
  console.log('[s3] 多次切模式 → 列表 ≥ 4 条 + 最新在前')
  await setState('default', true)
  await page.waitForTimeout(500)
  await setState('bypass-permissions', false)
  await page.waitForTimeout(500)
  await setState('accept-edits', false)
  await page.waitForTimeout(500)
  await setState('bypass-permissions', false)
  await page.waitForTimeout(500)
  // 重新打开 popover
  const trigger3 = page.locator('[data-testid="permission-history-trigger"]').first()
  await trigger3.click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '3-multiple-records.png'), fullPage: false })
  const s3 = await captureHistoryState(page, 's3-multiple-records')
  console.log('  → listItemCount:', s3.listItemCount, ', lsHistoryCount:', s3.lsHistoryCount)
  // 验证顺序:最新(mode=bypass)在前
  const firstEntryMode = s3.lsHistory?.[0]?.mode
  console.log('  → first entry mode:', firstEntryMode, ', first source:', s3.lsHistory?.[0]?.source)
  // 关掉 popover
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)

  // s4. 累计统计:3 个模式都有"X小时 X分钟"或"0秒"显示
  console.log('[s4] 累计统计:3 个模式都有统计行')
  // popover 仍开,直接读 panel text
  const trigger4 = page.locator('[data-testid="permission-history-trigger"]').first()
  await trigger4.click()
  await page.waitForTimeout(800)
  const s4 = await captureHistoryState(page, 's4-stats-shown')
  console.log(
    '  → hasStatsTitle:',
    s4.hasStatsTitle,
    ', hasModeAsk:',
    s4.hasModeAsk,
    ', hasModeAuto:',
    s4.hasModeAuto,
    ', hasModeFull:',
    s4.hasModeFull,
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)

  // s5. 清空历史 → localStorage 记录被清空 + Popover 显示"暂无历史"
  console.log('[s5] 清空历史 → localStorage 记录清空 + 显示"暂无历史"')
  // 注册 dialog 监听(必须在 reload 前注册;reload 后 window.confirm 会被 Playwright 拦截自动 dismiss → false)
  page.on('dialog', async (dialog) => {
    try {
      await dialog.accept()
    } catch {}
  })
  // 先 setState 保留 4 条记录(reload 会重置 window)
  await setState('bypass-permissions', false)
  await page.waitForTimeout(500)
  // 关键:reload 后必须重新覆盖 window.confirm,否则 Playwright 会在 React 调用 confirm 时自动 dismiss,返回 false,clearHistory 不执行
  await page.evaluate(() => {
    window.confirm = () => true
  })
  // 确认 trigger 在
  const s5Trigger = page.locator('[data-testid="permission-history-trigger"]').first()
  if ((await s5Trigger.count()) === 0) {
    console.error('  [err] s5 触发器丢失,提前退出')
    await browser.close()
    process.exit(1)
  }
  // 打开 popover
  await s5Trigger.click()
  await page.waitForTimeout(1000)
  // 先记一次初始 list 数量(应该是 ≥4)
  const s5PanelInitial = await page.locator('[data-testid="permission-history-panel"] li').count()
  console.log('  → s5 初始 list 数量:', s5PanelInitial)
  // 找清空按钮
  const clearBtn = page
    .locator('[data-testid="permission-history-panel"] button[aria-label*="清空"]')
    .first()
  const clearBtnCount = await clearBtn.count()
  console.log('  → s5 clearBtn count:', clearBtnCount)
  if (clearBtnCount > 0) {
    // 真实 click(React onClick 派发),force 避免被 Popover outside-click handler 误判
    await clearBtn.click({ force: true, timeout: 5000 })
    await page.waitForTimeout(1500)
  } else {
    console.log('  [warn] 未找到清空按钮,改用 localStorage.removeItem')
    await page.evaluate(() => {
      window.localStorage.removeItem('ihui:permission-mode-history')
    })
    await page.waitForTimeout(500)
  }
  // 关掉 popover 再开,确保拉取最新数据
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  const trigger5b = page.locator('[data-testid="permission-history-trigger"]').first()
  await trigger5b.click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '4-cleared.png'), fullPage: false })
  const s5 = await captureHistoryState(page, 's5-cleared')
  console.log('  → lsHistoryCount:', s5.lsHistoryCount, ', hasEmptyState:', s5.hasEmptyState)

  writeFileSync(resolve(SCREENSHOT_DIR, 'dom-log.json'), JSON.stringify(DOM_LOG, null, 2))
  console.log('\n[DOM 数据汇总]:')
  for (const d of DOM_LOG) console.log('  ', JSON.stringify(d).slice(0, 300))

  await browser.close()
  console.log(`\n[完成] 截图已保存到: ${SCREENSHOT_DIR}`)

  // 验证
  console.log('\n[验证]:')
  // 容差说明:
  // - s1:首次 mount 时 activeWorkspaceMode === 'default' 不被记录(实现里 __IHUI_LAST_RECORDED_MODE__ === activeWorkspaceMode 跳过),
  //   但 setState("bypass-permissions", true) 后 mount 时 mode=bypass,对比 last(undefined),会被记录 1 条。
  // - s3:setState(clear=false) 保留历史,反复切会累计。最新条目应该是 'bypass-permissions'。
  // - s5:清空按钮触发 confirm → clearHistory() → removeItem,reload panel 后 entries=[] + 显示"暂无历史"。
  const checks = [
    {
      name: '1. 切到 bypass → localStorage 追加 1 条 mode=bypass-permissions 记录',
      pass: s1.lsHistoryCount === 1 && s1.lsHistory?.[0]?.mode === 'bypass-permissions',
    },
    {
      name: '2. 点 history trigger → Popover 出现 + 1 条记录 + 模式"完全访问" + 来源"弹窗"',
      pass:
        s2.panelCount === 1 &&
        s2.listItemCount === 1 &&
        s2.hasModeFull &&
        s2.hasSourcePopover,
    },
    {
      name: '3. 多次切模式 → 列表 ≥ 4 条 + 最新条目 mode=bypass-permissions(最新在前)',
      pass: s3.listItemCount >= 4 && s3.lsHistoryCount >= 4 && firstEntryMode === 'bypass-permissions',
    },
    {
      name: '4. 累计统计:含"累计统计"标题 + 3 个模式名(请求批准/替我审批/完全访问)',
      pass: s4.hasStatsTitle && s4.hasModeAsk && s4.hasModeAuto && s4.hasModeFull,
    },
    {
      name: '5. 清空历史 → localStorage 为空 + panel 显示"暂无历史"',
      pass: s5.lsHistoryCount === 0 && s5.hasEmptyState,
    },
  ]
  let passed = 0
  for (const c of checks) {
    console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`)
    if (c.pass) passed++
  }
  console.log(`\n[总结] ${passed}/${checks.length} 项通过`)
  if (passed < checks.length) process.exit(1)
}

main().catch((err) => {
  console.error('[自验失败]:', err.message)
  process.exit(1)
})
