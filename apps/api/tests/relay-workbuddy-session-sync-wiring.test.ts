// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 回灌定时接线锁(2026-10-29 立)。
 *
 * 立因:落库脚本与服务层注释都写着"worker cron 每 10 分钟经 relay-workbuddy-session-sync
 * 回灌",而 worker 实际只注册了 trae/qoder —— 判据造好了没装车(§0.9)。本锁把"第三条腿
 * 真的在提交链上跑"钉住,形态摘掉即翻红。
 * 判据面与 relay-{trae,qoder}-session-sync-wiring.test.ts 同构(§22c:读同一把尺子)。
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
const ORCHESTRATOR_SRC = readFileSync(
  resolve(HERE, '../../../scripts/sync-workbuddy-client-session.mjs'),
  'utf8',
)

test('① 定时注册:workbuddy-session-sync 走 upsertJobScheduler 且每 10 分钟', () => {
  assert.match(WORKER_SRC, /upsertJobScheduler\(\s*'workbuddy-session-sync-cron'/)
  assert.match(WORKER_SRC, /WORKBUDDY_SYNC_CRON_PATTERN\s*=\s*'\*\/10 \* \* \* \*'/)
  assert.match(WORKER_SRC, /name:\s*'workbuddy-session-sync'/)
})

test('② 处理器分支先于 unknown-job 兜底,且点名本 job', () => {
  const branch = WORKER_SRC.indexOf("job.name === 'workbuddy-session-sync'")
  const fallback = WORKER_SRC.indexOf("job.name !== 'sweep'")
  assert.ok(branch > 0, '缺少 workbuddy-session-sync 处理分支')
  assert.ok(fallback > branch, '分支必须排在 unknown-job 兜底之前')
})

test('③ 手动触发口按名交出,且编排脚本名在位(任务中心 import 的是名字,不是路径)', () => {
  assert.match(
    WORKER_SRC,
    /export const runWorkbuddySessionSync[\s\S]{0,120}'sync-workbuddy-client-session\.mjs'/,
  )
})

test('④ 编排件不复制判据:只起 tsx 跑落库脚本,并显式接管 stdio(§12g)', () => {
  assert.match(ORCHESTRATOR_SRC, /relay-workbuddy-session-sync\.ts/)
  assert.match(ORCHESTRATOR_SRC, /stdio: \['ignore', 'pipe', 'pipe'\]/)
  assert.match(ORCHESTRATOR_SRC, /windowsHide: true/)
  assert.match(ORCHESTRATOR_SRC, /timeout:/)
  assert.doesNotMatch(
    ORCHESTRATOR_SRC,
    /secretsEnc|\.update\(|aiRelayAccountPool/,
    '编排件不该出现落库面(列名/UPDATE/表引用)—— 判据单源在 ts 脚本,§0.6',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
