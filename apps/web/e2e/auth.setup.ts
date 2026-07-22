import { test as setup, expect } from '@playwright/test'
import {
  apiLoginAndSaveStorageState,
  TEST_USER,
  ADMIN_USER,
  USER_STORAGE_STATE,
  ADMIN_STORAGE_STATE,
} from './fixtures'

/**
 * Playwright 全局 setup：在测试前自动登录并写入 storageState 文件。
 *
 * 使用 API 登录（apiLoginAndSaveStorageState）而非 UI 登录：
 * - 更快、更稳定，绕过邮箱登录的图形验证码（CaptchaCanvas）
 * - 与 src/routes/auth.ts 的 /api/auth/login 接口一致
 *
 * 运行方式：
 * - 单独执行 setup：`npx playwright test --project=setup`
 * - CI 中 setup project 作为依赖先行执行（见 playwright.config.ts）
 */

setup('authenticate as user', async ({ request, baseURL }) => {
  await apiLoginAndSaveStorageState(
    request,
    baseURL ?? 'http://localhost:8801',
    TEST_USER,
    USER_STORAGE_STATE,
  )
  // 简单校验文件已生成
  expect(USER_STORAGE_STATE).toBeTruthy()
})

setup('authenticate as admin', async ({ request, baseURL }) => {
  await apiLoginAndSaveStorageState(
    request,
    baseURL ?? 'http://localhost:8801',
    ADMIN_USER,
    ADMIN_STORAGE_STATE,
  )
  expect(ADMIN_STORAGE_STATE).toBeTruthy()
})
