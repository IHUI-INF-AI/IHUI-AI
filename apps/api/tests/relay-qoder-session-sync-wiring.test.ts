// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 回灌定时接线锁(2026-10-28 立,镜像 relay-trae-session-sync-wiring)。
 *
 * 锁 worker.ts 的四个接线事实 —— "文件里出现过"不等于"这条链上会跑"：
 *   ① 定时注册:upsertJobScheduler 注册 qoder-session-sync 且带 cron;
 *   ② 处理器分支:job.name === 'qoder-session-sync' 有真实分支(排在 unknown-job 兜底前);
 *   ③ spawn 目标:指向 apps/api/scripts/relay-qoder-session-sync.ts,显式 stdio 三段 +
 *      windowsHide + 超时(§12g);
 *   ④ 未判定(退出码 2)走 warn 不 throw —— 不许把常态当失败重试。
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKER_SRC = readFileSync(
  resolve(HERE, '../src/workers/relay-account-pool-worker.ts'),
  'utf8',
)

test('① 定时注册:qoder-session-sync 走 upsertJobScheduler 且带 cron', () => {
  assert.match(WORKER_SRC, /upsertJobScheduler\(\s*'qoder-session-sync-cron'/)
  assert.match(WORKER_SRC, /QODER_SYNC_CRON_PATTERN\s*=\s*'\*\/10 \* \* \* \*'/)
  assert.match(WORKER_SRC, /name:\s*'qoder-session-sync'/)
})

test('② 处理器分支先于 unknown-job 兜底', () => {
  const branch = WORKER_SRC.indexOf("job.name === 'qoder-session-sync'")
  const fallback = WORKER_SRC.indexOf("job.name !== 'sweep'")
  assert.ok(branch > 0, '缺少 qoder-session-sync 处理分支')
  assert.ok(fallback > branch, 'qoder-session-sync 分支必须排在 unknown-job 兜底之前')
})

test('③ spawn 指向回灌脚本且显式 stdio + windowsHide', () => {
  assert.match(WORKER_SRC, /'sync-qoder-client-session\.mjs'/)
  // 2026-10-29 重锚:spawn 收进 runClientSessionSync 助手,脚本名按 isQoder 三目传入
  const spawnBlock = WORKER_SRC.slice(
    WORKER_SRC.indexOf('async function runClientSessionSync'),
    WORKER_SRC.indexOf('const worker = new Worker('),
  )
  assert.match(
    spawnBlock,
    /stdio:\s*\['ignore',\s*'pipe',\s*'pipe'\]/,
    'spawn 必须显式接管 stdio(§12g)',
  )
  assert.match(spawnBlock, /windowsHide:\s*true/)
  assert.match(spawnBlock, /timeout:\s*\d/, '必须有超时,防子进程挂死拖住 worker')
})

test('④ 退出码 2(未判定)走 warn 不 throw —— 不许把常态当失败重试', () => {
  const branch = WORKER_SRC.slice(
    WORKER_SRC.indexOf("job.name === 'qoder-session-sync'"),
    WORKER_SRC.indexOf("if (job.name !== 'sweep'"),
  )
  assert.match(branch, /outcome\.code === 2[\s\S]*?warn/)
  assert.doesNotMatch(branch, /throw new Error\(/, '分支内不许 throw(throw 会进 BullMQ 失败重试)')
})

test('⑤ 回灌只写凭证/设备列,绝不碰健康字段(防"回灌把 down 洗成 unknown")', () => {
  const SRC = readFileSync(resolve(HERE, '../scripts/relay-qoder-session-sync.ts'), 'utf8')
  // 锚在 credVersion 附近取 update 的 .set({...}) 块(首个 .where( 属于 select,不能当右界)
  const anchor = SRC.indexOf('credVersion: sql`')
  const setBlock = SRC.slice(SRC.lastIndexOf('.set({', anchor), SRC.indexOf('.where(', anchor))
  for (const forbidden of [
    'healthStatus',
    'tempUnschedulable',
    'refreshFailureCount',
    'lastErrorMessage',
  ]) {
    assert.ok(!setBlock.includes(forbidden), `回灌不许写 ${forbidden}`)
  }
  assert.match(setBlock, /tokenEnc:/)
  assert.match(setBlock, /credVersion:\s*sql`/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
