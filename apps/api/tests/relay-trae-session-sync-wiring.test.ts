// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 回灌定时接线锁(2026-10-24 立)。
 *
 * 锁 worker.ts 的四个接线事实 —— "文件里出现过"不等于"这条链上会跑"
 * (§22c 镜像纪律;源码形状锁,不做网络/DB):
 *   ① 定时注册:upsertJobScheduler 注册 trae-session-sync 且带 cron;
 *   ② 处理器分支:job.name === 'trae-session-sync' 有真实分支(不是 unknown-job 兜底);
 *   ③ spawn 目标:指向 scripts/sync-trae-client-session.mjs,且显式 stdio 三段 +
 *      windowsHide(§12g);
 *   ④ 未判定(退出码 2)不进失败重试:走 warn 而不是 throw。
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

test('① 定时注册:trae-session-sync 走 upsertJobScheduler 且带 cron', () => {
  assert.match(WORKER_SRC, /upsertJobScheduler\(\s*'trae-session-sync-cron'/)
  assert.match(WORKER_SRC, /TRAE_SYNC_CRON_PATTERN\s*=\s*'?\*?\/10/)
  assert.match(WORKER_SRC, /name:\s*'trae-session-sync'/)
})

test('② 处理器分支先于 unknown-job 兜底', () => {
  const branch = WORKER_SRC.indexOf("job.name === 'trae-session-sync'")
  const fallback = WORKER_SRC.indexOf("job.name !== 'sweep'")
  assert.ok(branch > 0, '缺少 trae-session-sync 处理分支')
  assert.ok(fallback > branch, 'trae-session-sync 分支必须排在 unknown-job 兜底之前')
})

test('③ spawn 指向编排脚本且显式 stdio + windowsHide', () => {
  assert.match(WORKER_SRC, /sync-trae-client-session\.mjs/)
  const spawnBlock = WORKER_SRC.slice(WORKER_SRC.indexOf('function runClientSessionSync'))
  assert.match(
    spawnBlock,
    /stdio:\s*\['ignore',\s*'pipe',\s*'pipe'\]/,
    'spawn 必须显式接管 stdio(§12g)',
  )
  assert.match(spawnBlock, /windowsHide:\s*true/)
  assert.match(spawnBlock, /timeout|setTimeout/, '必须有超时,防子进程挂死拖住 worker')
})

test('④ 退出码 2(未判定)走 warn 不 throw —— 不许把常态当失败重试', () => {
  const branch = WORKER_SRC.slice(
    WORKER_SRC.indexOf("job.name === 'trae-session-sync'"),
    WORKER_SRC.indexOf("if (job.name !== 'sweep'"),
  )
  assert.match(branch, /outcome\.code === 2[\s\S]*?warn/)
  assert.doesNotMatch(branch, /throw new Error\(/, '分支内不许 throw(throw 会进 BullMQ 失败重试)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
