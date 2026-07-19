/**
 * 测试 fixtures：抽取 admin-crud-flow / i18n-switch-flow / workflow-state-machine
 * 关键路径 spec 共享的辅助函数,避免重复内联。
 *
 * - 不引入新依赖(全部用 @playwright/test 内置)
 * - 复用 e2e/fixtures.ts 提供的 setupTest(已登录页) / 共享凭据
 * - 对后端不可用场景做防御:失败仅 skip,不抛硬错
 */
import { test as baseTest, expect as baseExpect } from '@playwright/test'

// setupTest 是 e2e/fixtures.ts 扩展过的 test(含 authenticatedPage / adminPage fixture)
export { setupTest as test } from '../../../e2e/fixtures'
export { expect } from '@playwright/test'
// 兼容某些 spec 直接用 @playwright/test 的 test(无登录态场景)
export { baseTest, baseExpect }
export {
  TEST_USER,
  ADMIN_USER,
  USER_STORAGE_STATE,
  ADMIN_STORAGE_STATE,
} from '../../../e2e/fixtures'
