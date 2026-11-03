// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 回灌接线锁(2026-10-29 立;2026-11-03 定时腿撤除后改向)。
 *
 * 立因(原):落库脚本与服务层注释都写着"worker cron 每 10 分钟经 relay-workbuddy-session-sync
 * 回灌",而 worker 实际只注册了 trae/qoder —— 判据造好了没装车(§0.9)。
 *
 * 2026-11-03 改向:API 进程以 LocalSystem 身份运行,结构上读不到交互用户的 auth 文件,
 * 该腿每 10 分钟必然失败一次,属纯噪声;WorkBuddy 续期本就由服务端 sweep 负责(server 策略),
 * 故撤除定时注册。本锁改为钉住「不再被误加回来」:
 * ① worker 注册表不再有 upsert / cron 常量 / job 名;
 * ② 不再按 job.name 派发该腿;
 * ③ 遗留 Redis scheduler 必须显式移除(删代码不会自动清理);
 * ④ 脚本与手动触发口保留为一次性工具。
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

test('① 定时注册已撤除:worker 注册表里不再存在 workbuddy-session-sync', () => {
  assert.doesNotMatch(
    WORKER_SRC,
    /upsertJobScheduler\(\s*'workbuddy-session-sync-cron'/,
    'workbuddy 定时注册不得加回(服务身份读不到交互用户 auth 文件,该腿必然失败)',
  )
  assert.doesNotMatch(WORKER_SRC, /WORKBUDDY_SYNC_CRON_PATTERN/)
  assert.doesNotMatch(WORKER_SRC, /name:\s*'workbuddy-session-sync'/)
})

test('② 处理分支已撤除:不再按 job.name 派发该腿', () => {
  assert.doesNotMatch(WORKER_SRC, /job\.name === 'workbuddy-session-sync'/)
})

test('②b 遗留 Redis scheduler 显式移除(删代码不会自动清理注册)', () => {
  assert.match(WORKER_SRC, /RETIRED_WORKBUDDY_SCHEDULER_ID/)
  assert.match(WORKER_SRC, /removeJobScheduler\(RETIRED_WORKBUDDY_SCHEDULER_ID\)/)
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
