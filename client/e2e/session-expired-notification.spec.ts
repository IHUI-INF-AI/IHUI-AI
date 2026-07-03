/**
 * 会话过期"顶部下滑通知 + 重新登录按钮"防回归 (2026-07-03)
 *
 * 背景: 会话过期弹窗原本用 ElMessageBox 居中模态弹窗, 强制打断用户操作。
 *       改版后: ElNotification 从屏幕顶部下滑通知, 嵌"重新登录" + "取消"按钮,
 *       用户主动点"重新登录"才弹模态登录框。
 *
 * 本 spec 在源码级别保证:
 *   - useAppLifecycle.ts 必须用 ElNotification (而非 ElMessageBox 居中模态)
 *   - 必须从屏幕顶部下滑 (position: 'top-right')
 *   - 必须嵌"重新登录"按钮 + "取消"按钮
 *   - 必须不自动关闭 (duration: 0)
 *   - 必须带 customClass 'session-expired-notification' (样式钩子)
 *   - 必须使用 type: 'warning' (警告语义)
 *   - 样式文件 _session-expired-notification.scss 必须存在
 *   - main.ts 必须 import 这个样式
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
  test('1/8 useAppLifecycle.ts 必须用 ElNotification (而非 ElMessageBox 居中模态)', () => {
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

  test('2/8 必须从屏幕顶部下滑 (position: top-right)', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    expect(
      src,
      'useAppLifecycle.ts 缺少 position: top-right (通知不在顶部下滑)',
    ).toMatch(/position:\s*['"]top-right['"]/)
  })

  test('3/8 必须不自动关闭 (duration: 0)', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    expect(
      src,
      'useAppLifecycle.ts 缺少 duration: 0 (通知会自动消失, 用户错过会话过期)',
    ).toMatch(/duration:\s*0/)
  })

  test('4/8 必须使用 type: warning (警告语义)', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    expect(
      src,
      'useAppLifecycle.ts 缺少 type: warning (警告级别错误)',
    ).toMatch(/type:\s*['"]warning['"]/)
  })

  test('5/8 必须带 customClass: session-expired-notification (样式钩子)', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    expect(
      src,
      'useAppLifecycle.ts 缺少 customClass: session-expired-notification (样式无法生效)',
    ).toMatch(/customClass:\s*['"]session-expired-notification['"]/)
  })

  test('6/8 必须嵌"重新登录"按钮', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    expect(
      src,
      'useAppLifecycle.ts 缺少"重新登录"按钮文案 (用户无法快速回到登录)',
    ).toMatch(/relogin/)
  })

  test('7/8 必须嵌"取消"按钮', () => {
    const src = readFileSync(USE_APP_LIFECYCLE, 'utf-8')
    expect(
      src,
      'useAppLifecycle.ts 缺少"取消"按钮 (用户只能重新登录, 无法关闭通知)',
    ).toMatch(/cancel/)
  })

  test('8/8 样式文件 _session-expired-notification.scss 必须存在 + main.ts 必须 import', () => {
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
})
