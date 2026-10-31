// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 回灌任务存续哨兵 + 到人派发的镜像测试(2026-10-31 立)。
 *
 * 判据全部 import 自源脚本的 `__test__`(§22c:禁止在测试里复制判据);
 * 派发行为用 runner 注入,不派生真 schtasks。
 *
 * 钉死六件事:
 *   S1 任务 XML 解析(缺省 Enabled = 启用;S4U 必须判红 —— 它读不到 DPAPI);
 *   S2 wrapper 缺失/停摆/最后一轮报错 三型必须 breach;
 *   S3 取不到输入(查询异常/刚注册无日志)⇒ unjudged,不冒红也不记绿(§0.3);
 *   D1 breach ⇒ 只喊一次,去重身份只含维名(读数抖动不换身份),正文带幂等重建出路;
 *   D2 ok/unjudged/结论不可解析 ⇒ 不喊人;
 *   W1 装车锁:主健康轮 !CHECK_ONLY 分支真调用、__test__ 出口可 import、默认节流可由 env 覆盖;
 *   W2 不进提交链(guardian-runner 注册表零命中,§12e)。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  auditQoderSessionSyncTask,
  auditWorkbuddySessionSyncTask,
} from '../git-guardian.mjs'
import { __test__ as S } from '../check-qoder-session-sync-task.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// 与 schtasks XML 同语义:StartBoundary 是不带时区的本地时间,基准也按本地解析,
// 否则 UTC 基准会把"刚注册 5 分钟"算成 8 小时(时区差)。
const NOW = Date.parse('2026-10-31T23:00:00')

const XML_OK = `<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Author>Administrator</Author></RegistrationInfo>
  <Triggers><CalendarTrigger><StartBoundary>2026-10-31T22:55:00</StartBoundary><Repetition><Interval>PT10M</Interval></Repetition></CalendarTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>S-1-5-21-1-2-3-500</UserId><LogonType>InteractiveToken</LogonType></Principal></Principals>
  <Settings><Interval>PT10M</Interval></Settings>
  <Actions Context="Author"><Exec><Command>wscript.exe</Command><Arguments>&quot;C:\\Users\\Administrator\\.ihui-silent-guard\\qoder-session-sync-hidden.vbs&quot;</Arguments></Exec></Actions>
</Task>`

const SEGMENT_OK = `提取: 1 条可用会话(uid=01a191f4)
{"ok":true,"dryRun":false,"total":1,"applied":0,"skipped":1,"missing":0,"failed":0,"imported":0}
`

function dimsOf(over = {}) {
  return S.judgeDims({
    taskQuery: { ok: true },
    xml: XML_OK,
    wrapperExists: true,
    logStat: { exists: true, mtimeMs: NOW - 60_000 },
    segment: SEGMENT_OK,
    hasMarker: true,
    now: NOW,
    ...over,
  })
}

test('S1 任务 XML 解析:缺省 Enabled = 启用;S4U 判红', () => {
  const t = S.parseTaskXml(XML_OK)
  assert.equal(t.intervalMinutes, 10)
  assert.equal(t.logonType, 'InteractiveToken')
  assert.match(t.wrapperPath, /qoder-session-sync-hidden\.vbs$/)
  assert.equal(t.enabled, true)
  assert.equal(t.enabledExplicit, false)

  const dims = dimsOf({ xml: XML_OK.replace('InteractiveToken', 'S4U') })
  assert.equal(dims.task_identity.verdict, 'breach')
  assert.match(dims.task_identity.reason, /DPAPI/)

  const disabled = dimsOf({ xml: XML_OK.replace('<Settings>', '<Settings><Enabled>false</Enabled>') })
  assert.equal(disabled.task_registered.verdict, 'breach')
})

test('S2 wrapper 缺失 / 停摆 / 最后一轮报错 三型判红', () => {
  assert.equal(dimsOf({ wrapperExists: false }).task_wrapper.verdict, 'breach')
  const stale = dimsOf({ logStat: { exists: true, mtimeMs: NOW - 3 * 60 * 60 * 1000 } })
  assert.equal(stale.log_fresh.verdict, 'breach')
  const failed = dimsOf({ segment: '❌ 提取失败(未判定): 本机捕获失败\n' })
  assert.equal(failed.log_verdict.verdict, 'breach')
  const partial = dimsOf({ segment: '{"ok":true,"failed":2}' })
  assert.equal(partial.log_verdict.verdict, 'breach')
})

test('S3 取不到输入 ⇒ unjudged(刚注册无日志),超 3 周期无日志 ⇒ breach', () => {
  const fresh = dimsOf({
    logStat: { exists: false, mtimeMs: null },
    segment: '',
  })
  assert.equal(fresh.log_fresh.verdict, 'unjudged')

  const old = dimsOf({
    logStat: { exists: false, mtimeMs: null },
    segment: '',
    xml: XML_OK.replace('2026-10-31T22:55:00', '2026-10-31T18:00:00'),
  })
  assert.equal(old.log_fresh.verdict, 'breach')
  assert.match(old.log_fresh.reason, /从未跑成功/)

  assert.equal(
    dimsOf({ taskQuery: { ok: false, error: 'not-found' } }).task_registered.verdict,
    'breach',
  )
  assert.equal(
    dimsOf({ taskQuery: { ok: false, error: 'spawn:EACCES' } }).task_registered.verdict,
    'unjudged',
  )
})

test('S4 总体三态优先级:breach > unjudged > ok', () => {
  assert.equal(S.judgeOverall({ a: { verdict: 'ok' }, b: { verdict: 'ok' } }), 'ok')
  assert.equal(S.judgeOverall({ a: { verdict: 'ok' }, b: { verdict: 'unjudged' } }), 'unjudged')
  assert.equal(
    S.judgeOverall({ a: { verdict: 'unjudged' }, b: { verdict: 'breach' } }),
    'breach',
  )
})

function runDispatch(stdout, over = {}, fn = auditQoderSessionSyncTask) {
  const dir = mkScratch('qoder-sync-sentinel-')
  const calls = []
  try {
    const result = fn({
      now: NOW,
      intervalMs: 0,
      tickFile: join(dir, 'tick.iso'),
      lastFile: join(dir, 'last.json'),
      logger: () => {},
      notify: (...args) => calls.push(args),
      runner: () => ({ status: 0, stdout, stderr: '' }),
      ...over,
    })
    return { result, calls }
  } finally {
    rmScratch(dir)
  }
}

test('D1 breach ⇒ 只喊一次,身份只含维名,正文带幂等重建出路', () => {
  const dims = dimsOf({ wrapperExists: false })
  const { result, calls } = runDispatch(JSON.stringify({ overall: 'breach', dims }))
  assert.equal(calls.length, 1)
  assert.equal(result.breaches, 1)
  const [title, body, opts] = calls[0]
  assert.match(title, /Qoder 号池保活腿失效/)
  assert.equal(opts.dedupKey, 'qoder;dims=task_wrapper')
  assert.match(body, /setup-qoder-session-sync-task\.ps1/)
  assert.match(body, /-Kind qoder/)
  assert.match(body, /InteractiveToken/)
})

test('D3 WorkBuddy 腿共用同一判据,身份/出路按腿分开', () => {
  const dims = dimsOf({ wrapperExists: false })
  const { calls } = runDispatch(JSON.stringify({ overall: 'breach', dims }), {}, auditWorkbuddySessionSyncTask)
  assert.equal(calls.length, 1)
  const [title, body, opts] = calls[0]
  assert.match(title, /WorkBuddy 号池保活腿失效/)
  assert.equal(opts.dedupKey, 'workbuddy;dims=task_wrapper')
  assert.match(body, /-Kind workbuddy/)
  assert.match(body, /客户端正在运行|inspector/)
})

test('D2 ok / unjudged / 结论不可解析 ⇒ 都不喊人', () => {
  assert.equal(runDispatch(JSON.stringify({ overall: 'ok', dims: dimsOf() })).calls.length, 0)
  const unj = dimsOf({ logStat: { exists: false, mtimeMs: null }, segment: '' })
  assert.equal(runDispatch(JSON.stringify({ overall: 'unjudged', dims: unj })).calls.length, 0)
  const broken = runDispatch('not-json').result
  assert.equal(broken.judged, false)
  assert.equal(runDispatch('not-json').calls.length, 0)
})

test('W1 装车锁:两条腿都在 !CHECK_ONLY 真调用 + __test__ 可 import + 节流可配', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
  assert.match(src, /if \(!CHECK_ONLY\) auditQoderSessionSyncTask\(\)/)
  assert.match(src, /if \(!CHECK_ONLY\) auditWorkbuddySessionSyncTask\(\)/)
  assert.match(src, /\n\s*auditQoderSessionSyncTask,\n/)
  assert.match(src, /\n\s*auditWorkbuddySessionSyncTask,\n/)
  assert.match(src, /IHUI_CLIENT_SYNC_TASK_INTERVAL_MS/)
  assert.match(src, /IHUI_QODER_SYNC_TASK_INTERVAL_MS/)
})

test('W2 不进提交链:guardian-runner 注册表零命中(§12e)', () => {
  const runner = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.equal(runner.includes('check-qoder-session-sync-task'), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
