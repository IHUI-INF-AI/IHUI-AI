// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Playwright globalSetup:在所有测试开始前自动 seed test@aizhs.top 用户。
 *
 * 触发时机:Playwright 启动时(globalSetup 阶段),早于 webServer 就绪后跑第一个 spec。
 * 与 global-teardown.ts 配对:setup seed → 测试运行 → teardown cleanup,保证数据库
 * 默认只有 admin,跑 E2E 时自动 seed + cleanup,无需手动干预,CI 也能跑通。
 *
 * 环境变量开关:
 * - E2E_SKIP_SEED=1:跳过 seed(本地开发可复用已 seed 的数据库,加快迭代)
 * - E2E_DATABASE_URL:seed 定向到隔离库(如 ihui_e2e)。设置后覆盖传给 seed 脚本的
 *   DATABASE_URL,不再兜底读 apps/api/.env 的默认库;与 web/api 侧
 *   IHUI_API_PROXY_TARGET 隔离反代配套,让 e2e 全栈走独立库不碰他席开发库。
 *
 * 失败策略:只 warn 不 throw,与 fixtures.ts 的 ensureStorageState 兜底逻辑兼容
 * (seed 失败时 E2E 以 graceful skip 模式运行,不会阻塞测试报告生成)。
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_SKIP_SEED === '1') {
    // B67(2026-10-24):teardown 每轮清库(test 用户被删),本分支整体 return 会让
    // knowledge/notifications 断链、依赖它们的 spec(实测 esc-overlay-stack ①③)在
    // SKIP 路径下必败 —— 采样矩阵:带 seed 三次 3 passed / SKIP 三次 2 failed 零反例。
    // 本 warning 不断言、不改行为:SKIP 的语义是「复用已 seed 库」,使用者须自证库内
    // 种子仍在(或改跑不带 SKIP 的全量路径,幂等 seed 总耗时 ~30s)。
    console.warn(
      '[e2e:global-setup] ⚠️ E2E_SKIP_SEED=1:teardown 每轮清库 ⇒ 请自证库内种子(test/e2e_admin/knowledge/notifications)仍在,' +
        '否则 knowledge/notifications/esc 依赖型 spec 会以缺数据形态失败;安全跑法=去掉本变量走幂等 seed 全量路径(~30s)。',
    )
    return
  }

  const repoRoot = path.resolve(__dirname, '../../..')
  // E2E_DATABASE_URL ⇒ seed 一律写隔离库;未设则沿用 seed 脚本自身 dotenv 兜底(默认行为不变)。
  const seedEnv: NodeJS.ProcessEnv = { ...process.env }
  if (process.env.E2E_DATABASE_URL) {
    seedEnv.DATABASE_URL = process.env.E2E_DATABASE_URL
    console.log(
      '[e2e:global-setup] E2E_DATABASE_URL 已设置 ⇒ seed 定向隔离库(不写 apps/api/.env 默认库)',
    )
  }
  console.log('[e2e:global-setup] 开始 seed test@aizhs.top 用户...')

  try {
    execSync('pnpm --filter @ihui/api run seed:test-users', {
      cwd: repoRoot,
      stdio: 'inherit',
      env: seedEnv,
      timeout: 30000,
      windowsHide: true,
    })
    console.log('[e2e:global-setup] seed 完成')
  } catch (err) {
    console.warn(
      '[e2e:global-setup] seed 失败,E2E 将以 graceful skip 模式运行:',
      err instanceof Error ? err.message : err,
    )
  }

  // knowledge-base.spec 依赖 /api/knowledge 非空列表,隔离库重建后 knowledge_base 为空,
  // 同机制 seed 公开知识条目(幂等,失败只 warn 不阻塞)
  try {
    execSync('pnpm --filter @ihui/api run seed:e2e-knowledge', {
      cwd: repoRoot,
      stdio: 'inherit',
      env: seedEnv,
      timeout: 30000,
      windowsHide: true,
    })
    console.log('[e2e:global-setup] knowledge seed 完成')
  } catch (err) {
    console.warn(
      '[e2e:global-setup] knowledge seed 失败,knowledge-base 相关用例可能失败:',
      err instanceof Error ? err.message : err,
    )
  }

  // notification-archive.spec(D195 真 e2e)需要 test@aizhs.top 名下两条确定形状的通知
  //(active 1 / archived 1),同机制 seed(幂等只重置种子行,失败只 warn 不阻塞)
  try {
    execSync('pnpm --filter @ihui/api run seed:e2e-notifications', {
      cwd: repoRoot,
      stdio: 'inherit',
      env: seedEnv,
      timeout: 30000,
      windowsHide: true,
    })
    console.log('[e2e:global-setup] notifications seed 完成')
  } catch (err) {
    console.warn(
      '[e2e:global-setup] notifications seed 失败,notification-archive 相关用例可能失败:',
      err instanceof Error ? err.message : err,
    )
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
