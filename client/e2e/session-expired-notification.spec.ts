/**
 * 会话过期"顶部下滑通知 + 重新登录按钮"防回归 (2026-07-03)
 *
 * 背景: 会话过期弹窗原本用 ElMessageBox 居中模态弹窗, 强制打断用户操作。
 *       改版后: ElNotification 从屏幕顶部下滑通知, 嵌"重新登录" + "取消"按钮,
 *       用户主动点"重新登录"才弹模态登录框。
 *       自动关闭时长: 8s (给用户足够时间看清并操作, 不会因忘记关闭而长期遮挡屏幕)
 *
 * 本 spec 在源码级别保证:
 *   - useAppLifecycle.ts 必须用 ElNotification (而非 ElMessageBox 居中模态)
 *   - 必须从屏幕顶部居中下滑 (position: top-left + scss left: 50% 覆盖)
 *   - 必须自动关闭 (duration 4000-15000, 防止通知永久挂起遮挡屏幕)
 *   - 必须带 customClass 'session-expired-notification' (样式钩子)
 *   - 必须使用 type: 'warning' (警告语义)
 *   - 样式文件 _session-expired-notification.scss 必须存在
 *   - main.ts 必须 import 这个样式
 *   - 必须带 onClick 回调 (点击通知本体也能弹登录框, 提升可达性)
 *   - scss 必须含 left: 50% 居中覆盖 (防止 scss 丢失导致通知回退到左侧)
 *
 * 任一断言失败 = 会话过期弹窗退回到 ElMessageBox 居中模态 = 立即回滚。
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const USE_APP_LIFECYCLE = join(ROOT, 'src/composables/useAppLifecycle.ts')
const SESSION_EXPIRED_STYLE = join(ROOT, 'src/styles/_session-expired-notification.scss')
const MAIN_TS = join(ROOT, 'src/main.ts')

test.describe('会话过期顶部下滑通知 + 重新登录按钮防回归', () => {
  test('1/10 useAppLifecycle.ts 必须用 ElNotification (而非 ElMessageBox 居中模态)', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    // 必须有 ElNotification 调用
    expect(
      src,
      'useAppLifecycle.ts 缺少 ElNotification 调用 (会话过期通知改版丢失)',
    ).toMatch(/ElNotification\s*\(/)
    // 必须没有 ElMessageBox 居中模态弹窗 (防回退到旧实现)
    expect(
      src,
      'useAppLifecycle.ts 仍包含 ElMessageBox 调用 (会话过期通知回退到居中模态)',
    ).not.toMatch(/ElMessageBox\s*\(/)
  })

  test('2/10 必须从屏幕顶部居中下滑 (position: top-left + CSS 居中覆盖)', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    // Element Plus ElNotification 不支持 top-center (notify.mjs:8-13 仅 4 个 key:
    // top-left/top-right/bottom-left/bottom-right)。本项目用 top-left + scss 覆盖实现视觉居中。
    expect(
      src,
      'useAppLifecycle.ts 缺少 position: top-left (Element Plus ElNotification 不支持 top-center, 必须用 top-left + CSS 居中覆盖)',
    ).toMatch(/position:\s*['"]top-left['"]/)
    // 守卫: 不能回退到 top-right (会回退到原来的右上角 bug)
    expect(
      src,
      'useAppLifecycle.ts 仍在使用 top-right (会话过期通知应居中, 不应回退到右上角)',
    ).not.toMatch(/position:\s*['"]top-right['"]/)
    // 守卫: 不能直接用 top-center (会触发 'Cannot read properties of undefined (reading forEach)')
    expect(
      src,
      'useAppLifecycle.ts 使用 top-center 会触发 Element Plus notify.mjs:21 forEach 错误, 通知将无法出现',
    ).not.toMatch(/position:\s*['"]top-center['"]/)
  })

  test('3/10 scss 必须包含 left: 50% 居中覆盖 (防止 scss 丢失导致通知回退到左侧)', () => {
    const scss = readFileSync(SESSION_EXPIRED_STYLE, 'utf-8')
    // scss 必须把 .el-notification.left { left: 16px } 覆盖为 left: 50% + margin-left: -165px
    // 否则通知会落到屏幕左边 (left: 16px), 不是用户预期的居中
    expect(
      scss,
      '_session-expired-notification.scss 缺少 left: 50% 居中覆盖 (通知会落到屏幕左边, 视觉不一致)',
    ).toMatch(/left:\s*50%/)
    expect(
      scss,
      '_session-expired-notification.scss 缺少 margin-left: -165px 居中偏移 (通知宽度 330px 的一半, 用于精确居中)',
    ).toMatch(/margin-left:\s*-165px/)
  })

  test('4/10 必须自动关闭 (duration 4000-15000ms, 防止通知永久挂起遮挡屏幕)', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    // 必须锚定到 ElNotification 块 (position: top-left 之后), 避免误匹配 Alt+T 的 ElMessage (duration: 1500)
    const blockMatch = src.match(/position:\s*['"]top-left['"][\s\S]{0,300}?duration:\s*([A-Z_0-9]+|\d+)/)
    expect(
      blockMatch,
      'useAppLifecycle.ts ElNotification 块缺少合法 duration (通知会永久挂起遮挡屏幕)',
    ).not.toBeNull()
    if (!blockMatch) return

    let numV: number
    const raw = blockMatch[1]
    if (/^\d+$/.test(raw)) {
      // 字面量
      numV = Number(raw)
    } else {
      // 变量引用, 追溯 const SESSION_EXPIRED_DURATION_MS = 8000
      const varMatch = src.match(new RegExp(`const\\s+${raw}\\s*=\\s*(\\d+)`))
      expect(
        varMatch,
        `useAppLifecycle.ts 变量 ${raw} 未在源码中定义 (duration 解析失败)`,
      ).not.toBeNull()
      if (!varMatch) return
      numV = Number(varMatch[1])
    }
    // duration 必须在 4000-15000ms 合理区间, 防止:
    //   - duration: 0 = 永久显示, 遮挡屏幕
    //   - duration: <4000 = 太快用户来不及反应
    //   - duration: >15000 = 太久, 实际等于半永久挂起
    expect(numV).toBeGreaterThanOrEqual(4000)
    expect(numV).toBeLessThanOrEqual(15000)
  })

  test('5/10 必须使用 type: warning (警告语义)', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    expect(
      src,
      'useAppLifecycle.ts 缺少 type: warning (警告级别错误)',
    ).toMatch(/type:\s*['"]warning['"]/)
  })

  test('6/10 必须带 customClass: session-expired-notification (样式钩子)', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    expect(
      src,
      'useAppLifecycle.ts 缺少 customClass: session-expired-notification (样式无法生效)',
    ).toMatch(/customClass:\s*['"]session-expired-notification['"]/)
  })

  test('7/10 必须嵌"重新登录"按钮', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    expect(
      src,
      'useAppLifecycle.ts 缺少"重新登录"按钮文案 (用户无法快速回到登录)',
    ).toMatch(/relogin/)
  })

  test('8/10 必须嵌"取消"按钮', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    expect(
      src,
      'useAppLifecycle.ts 缺少"取消"按钮 (用户只能重新登录, 无法关闭通知)',
    ).toMatch(/cancel/)
  })

  test('9/10 样式文件 _session-expired-notification.scss 必须存在 + main.ts 必须 import', () => {
    expect(
      existsSync(SESSION_EXPIRED_STYLE),
      '_session-expired-notification.scss 样式文件不存在 (顶部下滑通知无样式)',
    ).toBe(true)
    const mainSrc = readFileSync(MAIN_TS, 'utf-8')
    expect(
      mainSrc,
      'main.ts 缺少 _session-expired-notification.scss 的 import (样式未挂载)',
    ).toMatch(/['"]\.\/styles\/_session-expired-notification\.scss['"]/)
  })

  test('10/10 必须带 onClick 回调 (点击通知本体也能弹登录框)', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    // 必须有 onClick 配置项
    expect(
      src,
      'useAppLifecycle.ts 缺少 onClick 回调 (点击通知本体无法弹登录框, 可达性不足)',
    ).toMatch(/onClick:\s*\(e\?:\s*MouseEvent\)/)
    // 必须排除按钮点击 (避免与按钮自身 onClick 重复触发)
    expect(
      src,
      'useAppLifecycle.ts onClick 未排除 .el-button 点击 (会与按钮自身 onClick 重复触发)',
    ).toMatch(/target\.closest\(['"]\.el-button['"]\)/)
    // 必须排除关闭按钮点击 (Element Plus 自带, 不应弹登录框)
    expect(
      src,
      'useAppLifecycle.ts onClick 未排除 .el-notification__closeBtn 点击 (点关闭按钮会误弹登录框)',
    ).toMatch(/target\.closest\(['"]\.el-notification__closeBtn['"]\)/)
    // onClick 内必须调 useLoginDialog().open('login') (点击通知本体弹登录框)
    expect(
      src,
      'useAppLifecycle.ts onClick 未调用 useLoginDialog().open(login) (点击通知本体无效果)',
    ).toMatch(/onClick[\s\S]*?useLoginDialog\(\)\.open\(['"]login['"]\)/)
  })
})
