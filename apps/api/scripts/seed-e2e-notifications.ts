// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * E2E 通知归档流种子脚本（幂等）。
 *
 * 背景:D195 通知隐藏→归档→恢复流的真机 e2e(notification-archive.spec.ts)需要
 * test@aizhs.top 名下有**确定形状**的通知:一条未归档(供隐藏腿)、一条已归档
 * (供恢复腿)。与 seed-e2e-knowledge 同级,由 web 的 global-setup 自动调用。
 *
 * 用法:
 *   pnpm --filter @ihui/api run seed:e2e-notifications
 *   # 连接目标库由 DATABASE_URL 决定(dotenv 不覆盖已存在的环境变量,外部传入即生效)
 *
 * 行为(按 title 前缀幂等,重跑只重置这两条,不动真实通知):
 * 1. 找 test@aizhs.top 的 userId;找不到 ⇒ 警告后退出 0(seed:test-users 未跑的前置缺失,
 *    与 global-setup「失败只 warn 不 throw」的 graceful 约定一致)
 * 2. 删掉该用户名下 title LIKE 'E2E种子通知%' 的旧种子行
 * 3. 插入两条:E2E种子通知·未归档(archived_at NULL)/ E2E种子通知·已归档(archived_at NOW)
 */
import 'dotenv/config'
import { and, eq, like } from 'drizzle-orm'

import { db } from '../src/db/index.js'
import { notifications, users } from '@ihui/database'

// 生产库防呆(与 seed-e2e-knowledge 同规则):E2E 种子禁止写入名为 ihui_dev 的库。
// 判据取「库名」而非整串——本机开发库 ihui 的口令前缀恰为 ihui_dev_,整串匹配会误杀。
const DATABASE_URL = process.env.DATABASE_URL ?? ''
let prodDbNameMatched: boolean
try {
  prodDbNameMatched = new URL(DATABASE_URL).pathname.replace(/^\//, '') === 'ihui_dev'
} catch {
  prodDbNameMatched = DATABASE_URL.includes('ihui_dev')
}
// 显式本地标记 E2E_ALLOW_LOCAL_DB=1 ⇒ 操作者声明该库为本机库,放行(与 seed-test-users 同规则)
if (prodDbNameMatched && process.env.CI !== 'true' && process.env.E2E_ALLOW_LOCAL_DB !== '1') {
  console.error(
    '[seed-e2e-notifications] 拒绝执行:DATABASE_URL 指向生产库 ihui_dev。' +
      'E2E 种子只允许写入隔离库,请显式传 DATABASE_URL(如 ihui_e2e);CI 环境不受影响。',
  )
  process.exit(1)
}

const TITLE_PREFIX = 'E2E种子通知'
const SEED_TITLE_ACTIVE = `${TITLE_PREFIX}·未归档`
const SEED_TITLE_ARCHIVED = `${TITLE_PREFIX}·已归档`

async function main(): Promise<void> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'test@aizhs.top'))
    .limit(1)
  if (!user) {
    console.warn(
      '[seed-e2e-notifications] test@aizhs.top 不存在(先跑 pnpm --filter @ihui/api run seed:test-users),本轮跳过。',
    )
    return
  }

  // 幂等口径:只重置自己名下的种子行(title 前缀圈定),真实通知一条不碰。
  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, user.id), like(notifications.title, `${TITLE_PREFIX}%`)))

  await db.insert(notifications).values([
    {
      userId: user.id,
      type: 'system',
      title: SEED_TITLE_ACTIVE,
      content: 'D195 e2e:这条在 active 分区,供「隐藏→已归档」腿使用。',
      isRead: false,
    },
    {
      userId: user.id,
      type: 'system',
      title: SEED_TITLE_ARCHIVED,
      content: 'D195 e2e:这条预置在已归档分区,供「恢复→返回动态」腿使用。',
      isRead: true,
      archivedAt: new Date(),
    },
  ])
  console.info(
    `[seed-e2e-notifications] 完成:userId=${user.id} 插入 2 条种子通知(active 1 / archived 1)。`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-e2e-notifications] 失败:', err)
    process.exit(1)
  })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
