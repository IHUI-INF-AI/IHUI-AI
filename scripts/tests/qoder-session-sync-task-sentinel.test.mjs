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
import {
  classifyLogSegment,
  scopeOfUnjudgedReason,
  unjudgedLogLine,
} from '../lib/client-sync-verdict.mjs'

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

test('S5 单轮瞬时失败不计(上一轮成功⇒unjudged),连续失败才 breach', () => {
  const segFail = '❌ 同步失败(未判定): 信号 SIGTERM\n'
  // 单轮瞬时失败:上一段成功,最后一段失败 ⇒ 自愈型,不喊人
  const single = S.judgeDims({
    taskQuery: { ok: true },
    xml: XML_OK,
    wrapperExists: true,
    logStat: { exists: true, mtimeMs: NOW - 60_000 },
    segment: segFail,
    hasMarker: true,
    prevSegment: SEGMENT_OK,
    now: NOW,
  })
  assert.equal(single.log_verdict.verdict, 'unjudged')
  assert.match(single.log_verdict.reason, /瞬时/)

  // 连续失败:上一段也失败 ⇒ 真故障,breach
  const consec = S.judgeDims({
    taskQuery: { ok: true },
    xml: XML_OK,
    wrapperExists: true,
    logStat: { exists: true, mtimeMs: NOW - 60_000 },
    segment: segFail,
    hasMarker: true,
    prevSegment: segFail,
    now: NOW,
  })
  assert.equal(consec.log_verdict.verdict, 'breach')
  assert.match(consec.log_verdict.reason, /连续/)

  // 无历史段(只有一段失败)⇒ 退化为旧行为 breach(不漏首跑失败)
  const noPrev = S.judgeDims({
    taskQuery: { ok: true },
    xml: XML_OK,
    wrapperExists: true,
    logStat: { exists: true, mtimeMs: NOW - 60_000 },
    segment: segFail,
    hasMarker: true,
    now: NOW,
  })
  assert.equal(noPrev.log_verdict.verdict, 'breach')
})

// 2026-11-15 根因:WorkBuddy 客户端没开时,回灌脚本按 §0.3 写「❌ 回灌未判定」并 exit 2,
// 但尺子的 hasFailureMark 只认 ❌,连续两轮即判 breach ⇒ 每 12h 一封「保活腿失效」误报
// (11-02/07/08/10/11/12/13/14 台账共 10 封)。下面四条钉死:环境未就绪归未判定、真故障仍红。
const WB_NOT_READY =
  '❌ 回灌未判定: ❌ 提取本机 WorkBuddy 会话失败(未判定):' +
  '未发现运行中的 WorkBuddy 主进程(探测面=WorkBuddy.exe/WorkBuddyAI.exe);请先启动并登录 WorkBuddy\n'
const HARD_FAIL = '❌ 写库失败: connection refused\n'

function judgeSeg(segment, prevSegment) {
  return S.judgeDims({
    taskQuery: { ok: true },
    xml: XML_OK,
    wrapperExists: true,
    logStat: { exists: true, mtimeMs: NOW - 60_000 },
    segment,
    hasMarker: true,
    prevSegment,
    now: NOW,
  })
}

test('S6 客户端未就绪型未判定(连续两轮)⇒ unjudged,派发层不发信', () => {
  assert.equal(typeof S.isClientNotReady, 'function')
  const dims = judgeSeg(WB_NOT_READY, WB_NOT_READY)
  assert.equal(dims.log_verdict.verdict, 'unjudged')
  assert.match(dims.log_verdict.reason, /环境未就绪|未判定/)
  assert.equal(S.judgeOverall(dims), 'unjudged')
  const { calls } = runDispatch(
    JSON.stringify({ overall: 'unjudged', dims }),
    {},
    auditWorkbuddySessionSyncTask,
  )
  assert.equal(calls.length, 0)
})

test('S7 反向牙:真失败 / tsx 缺失 / 连续 SIGTERM 仍 breach(降噪不得吞真故障)', () => {
  assert.equal(judgeSeg(HARD_FAIL, HARD_FAIL).log_verdict.verdict, 'breach')
  assert.equal(dimsOf({ segment: '{"ok":false,"failed":1}' }).log_verdict.verdict, 'breach')
  const tsx = '❌ 回灌未判定: 未找到 tsx(apps/api/node_modules/tsx 或仓根)\n'
  assert.equal(judgeSeg(tsx, tsx).log_verdict.verdict, 'breach')
  const sigterm = '❌ 同步失败(未判定): 信号 SIGTERM\n'
  assert.equal(judgeSeg(sigterm, sigterm).log_verdict.verdict, 'breach')
  // 装车锁:未判定判据确实接在 judgeDims 上,不是只导出没用
  assert.equal(S.isClientNotReady(WB_NOT_READY), true)
  assert.equal(S.isClientNotReady(HARD_FAIL), false)
})

test('S8 上一轮环境未就绪、本轮真失败 ⇒ 单轮瞬时,不按连续失败喊人', () => {
  const dims = judgeSeg(HARD_FAIL, WB_NOT_READY)
  assert.equal(dims.log_verdict.verdict, 'unjudged')
  assert.match(dims.log_verdict.reason, /瞬时/)
})

test('S9 计划任务 XML 取不到输入 ⇒ wrapper/identity 也 unjudged;任务确实不存在仍红', () => {
  const dims = dimsOf({ taskQuery: { ok: false, error: 'spawn:EPERM' } })
  assert.equal(dims.task_registered.verdict, 'unjudged')
  assert.equal(dims.task_wrapper.verdict, 'unjudged')
  assert.equal(dims.task_identity.verdict, 'unjudged')
  assert.equal(S.judgeOverall(dims), 'unjudged')
  const missing = dimsOf({ taskQuery: { ok: false, error: 'not-found' } })
  assert.equal(missing.task_registered.verdict, 'breach')
  assert.equal(missing.task_wrapper.verdict, 'unjudged')
})

// 2026-11-15 §杜绝复发:反复误报的结构根因是三态语义跨层断裂(上游写自由文本、下游正则猜)。
// 下面四条钉死「生产者与消费者共用同一份契约」这件事本身,而不只是某一次的判定结果。
test('S10 契约单一真相源:尺子不得复制第二份正则,两腿不得再自拼未判定句式', () => {
  const ruler = readFileSync(join(ROOT, 'scripts/check-qoder-session-sync-task.mjs'), 'utf8')
  assert.match(ruler, /from '\.\/lib\/client-sync-verdict\.mjs'/, '尺子必须 import 共享契约')
  assert.doesNotMatch(ruler, /export const CLIENT_NOT_READY_RE/, '尺子里不得再留第二份正则')
  assert.doesNotMatch(ruler, /未发现运行中的\[/, '尺子里不得内联同一条正则字面量')
  for (const name of ['sync-workbuddy-client-session.mjs', 'sync-qoder-client-session.mjs']) {
    const src = readFileSync(join(ROOT, 'scripts', name), 'utf8')
    assert.match(src, /unjudgedLogLine\(/, `${name} 必须走唯一出口`)
    assert.doesNotMatch(src, /write\(`❌ 回灌未判定/, `${name} 不得自拼旧句式`)
  }
})

test('S11 结构化标记优先:上游改文案不再让尺子失配(旧正则命不中也照样 unjudged)', () => {
  const line = unjudgedLogLine('全新的探测失败文案 V2,不含任何旧关键词', 'client-not-ready')
  assert.equal(classifyLogSegment(line).kind, 'client-not-ready')
  assert.equal(classifyLogSegment(line).source, 'marker')
  assert.equal(S.isClientNotReady(line), true)
  const dims = judgeSeg(line, line)
  assert.equal(dims.log_verdict.verdict, 'unjudged')
  assert.equal(S.judgeOverall(dims), 'unjudged')
  const { calls } = runDispatch(
    JSON.stringify({ overall: 'unjudged', dims }),
    {},
    auditWorkbuddySessionSyncTask,
  )
  assert.equal(calls.length, 0)
})

test('S12 反向牙:非环境缺席的未判定 / 混段硬失败汇总不得被标记吞掉', () => {
  assert.equal(scopeOfUnjudgedReason('未发现运行中的 WorkBuddy 主进程'), 'client-not-ready')
  assert.equal(scopeOfUnjudgedReason('未找到 Qoder 数据目录'), 'client-not-ready')
  assert.equal(scopeOfUnjudgedReason('信号 SIGTERM,180000ms 超时'), 'undetermined')
  assert.equal(scopeOfUnjudgedReason('未找到 tsx'), 'undetermined')
  const tsx = unjudgedLogLine('未找到 tsx(apps/api/node_modules/tsx 或仓根)')
  assert.equal(classifyLogSegment(tsx).kind, 'undetermined')
  assert.equal(judgeSeg(tsx, tsx).log_verdict.verdict, 'breach')
  const mixed = `${unjudgedLogLine('未发现运行中的 WorkBuddy 主进程')}\n{"ok":false,"failed":1}`
  assert.equal(classifyLogSegment(mixed).kind, 'hard-failure')
  assert.equal(S.isClientNotReady(mixed), false)
  assert.equal(dimsOf({ segment: mixed }).log_verdict.verdict, 'breach')
})

test('S13 历史回放:三种真实日志形态在契约下仍分别判 unjudged / 保留真故障', () => {
  const legacyNotReady =
    '❌ 回灌未判定: ❌ 提取本机 WorkBuddy 会话失败(未判定):' +
    '未发现运行中的 WorkBuddy 主进程;请先启动并登录 WorkBuddy\n'
  const legacyTsx = '❌ 回灌未判定: 未找到 tsx(apps/api/node_modules/tsx 或仓根);先在仓根 pnpm install\n'
  const legacySigterm = '❌ 回灌未判定: 退出码 ?(信号 SIGTERM,180000ms 窗口超时被杀,本轮未判定)\n'
  for (const seg of [legacyNotReady, legacyTsx, legacySigterm]) {
    assert.equal(S.hasFailureMark(seg), true, '降噪不得抹掉原始证据')
  }
  assert.equal(classifyLogSegment(legacyNotReady).source, 'legacy-text')
  assert.equal(judgeSeg(legacyNotReady, legacyNotReady).log_verdict.verdict, 'unjudged')
  assert.equal(judgeSeg(legacyTsx, legacyTsx).log_verdict.verdict, 'breach')
  assert.equal(judgeSeg(legacySigterm, legacySigterm).log_verdict.verdict, 'breach')
})

test('S14 旧日志混段反向牙:环境未就绪与 tsx 缺失同段 ⇒ 不降噪(仍按真故障)', () => {
  const mixedLegacy = `${WB_NOT_READY}❌ 回灌未判定: 未找到 tsx(apps/api/node_modules/tsx 或仓根)\n`
  assert.equal(classifyLogSegment(mixedLegacy).kind, 'undetermined')
  assert.equal(S.isClientNotReady(mixedLegacy), false)
  assert.equal(judgeSeg(mixedLegacy, mixedLegacy).log_verdict.verdict, 'breach')
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
  // 行尾不由本测试决定:多会话下工作树可能被整体转成 CRLF,而 HEAD 面恒为 LF。
  // 断言意图是「导出装车」,不该因合法行尾差异假红 ⇒ 两种行尾都吃(反向牙仍是导出必须存在)。
  assert.match(src, /\r?\n\s*auditQoderSessionSyncTask,\r?\n/)
  assert.match(src, /\r?\n\s*auditWorkbuddySessionSyncTask,\r?\n/)
  assert.match(src, /IHUI_CLIENT_SYNC_TASK_INTERVAL_MS/)
  assert.match(src, /IHUI_QODER_SYNC_TASK_INTERVAL_MS/)
})

test('W2 不进提交链:guardian-runner 注册表零命中(§12e)', () => {
  const runner = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.equal(runner.includes('check-qoder-session-sync-task'), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
