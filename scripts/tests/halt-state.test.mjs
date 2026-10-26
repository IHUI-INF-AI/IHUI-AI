// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * halt-state 镜像测试(§22c:import 源脚本 __test__,禁止复制判据)。
 *
 * 刻意钉住的几件事:
 *   - 停机是**终态**而不是"失败后继续重试"的中间态:running 上不许 resume、resuming 上不许 enter;
 *   - 幂等只在 halted 上成立,且只追加 attempt —— 不得偷偷多写一条转移;
 *   - 缺证据的恢复一律拒(§0.10 失效方向 = 多要一次定向说明);
 *   - 坏文件三型(坏 JSON / 未知状态 / 未登记边)与目录当文件 ⇒ 未判定,绝不回落 running;
 *   - 读操作不得写盘(两次读状态不回退 / 文件字节不变)。
 *
 * 全部夹具落在 .ihui-agent/tmp/halt/(§15),用后即删;不碰真实 .ihui-agent/state/halt.json。
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { __test__ as CLI } from '../haltctl.mjs'
import { __test__ as H } from '../lib/halt-state.mjs'

const TMP_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '.ihui-agent',
  'tmp',
  'halt',
)

function newStateFile(t) {
  mkdirSync(TMP_ROOT, { recursive: true })
  const dir = mkdtempSync(join(TMP_ROOT, 'test-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return { dir, file: join(dir, 'halt.json') }
}

const LONG_REASON = '上游连续三次超时,按预案进入安全停机'

test('转移表封闭:三态四边,每条边两端都在枚举内', () => {
  assert.deepEqual([...H.HALT_STATES].sort(), ['halted', 'resuming', 'running'])
  const events = Object.keys(H.HALT_TRANSITIONS)
  assert.deepEqual(events.sort(), ['abort', 'enter', 'resume', 'settle'])
  for (const event of events) {
    const edge = H.HALT_TRANSITIONS[event]
    assert.ok(H.HALT_STATES.includes(edge.from), `${event}.from 在枚举内`)
    assert.ok(H.HALT_STATES.includes(edge.to), `${event}.to 在枚举内`)
    assert.ok(H.isLegalTransition(edge.from, edge.to), `${event} 是登记边`)
  }
  // 反向牙:"halted 直接回 running"没有登记边,不允许存在这种捷径。
  assert.equal(H.isLegalTransition('halted', 'running'), false)
  assert.equal(H.edgeOf('no-such-event'), null)
})

test('文件不存在 ⇒ 初始态 running(不是未判定,也不是 halted)', (t) => {
  const { file } = newStateFile(t)
  const doc = H.readHaltState({ file })
  assert.equal(doc.state, 'running')
  assert.equal(doc.persisted, false)
  assert.equal(doc.transitions.length, 0)
  assert.equal(doc.attempts.length, 0)
})

test('enter:running -> halted 落盘,转移记录六字段齐全', (t) => {
  const { file } = newStateFile(t)
  const result = H.enterHalt(LONG_REASON, '守护日志现读连续 3 次 ECONNRESET', { file, by: 'test' })
  assert.equal(result.changed, true)
  assert.equal(result.state, 'halted')
  const doc = H.readHaltState({ file })
  assert.equal(doc.state, 'halted')
  assert.equal(doc.persisted, true)
  assert.equal(doc.transitions.length, 1)
  const tr = doc.transitions[0]
  for (const key of ['at', 'from', 'to', 'reason', 'by', 'evidence']) {
    assert.equal(typeof tr[key], 'string', `转移记录必须有 ${key}`)
  }
  assert.equal(tr.from, 'running')
  assert.equal(tr.to, 'halted')
  assert.equal(tr.reason, LONG_REASON)
  assert.ok(!Number.isNaN(Date.parse(tr.at)))
})

test('幂等:已 halted 再进只追加 attempt,状态与转移条数不变', (t) => {
  const { file } = newStateFile(t)
  H.enterHalt(LONG_REASON, '', { file, by: 'test' })
  const second = H.enterHalt('第二次进入:重复告警,状态应保持不变', '', { file, by: 'test' })
  assert.equal(second.changed, false)
  assert.equal(second.state, 'halted')
  const doc = H.readHaltState({ file })
  assert.equal(doc.state, 'halted')
  assert.equal(doc.transitions.length, 1)
  assert.equal(doc.attempts.length, 1)
  assert.equal(doc.attempts[0].state, 'halted')
})

test('幂等两次后 attempt 累积两条,但转移仍是一条', (t) => {
  const { file } = newStateFile(t)
  H.enterHalt(LONG_REASON, '', { file })
  H.enterHalt('重复进入第一次:只记账不改状态', '', { file })
  H.enterHalt('重复进入第二次:只记账不改状态', '', { file })
  const doc = H.readHaltState({ file })
  assert.equal(doc.attempts.length, 2)
  assert.equal(doc.transitions.length, 1)
})

test('reason 少于 10 字拒;恰好 10 字放行(边界)', (t) => {
  const { file } = newStateFile(t)
  assert.throws(() => H.enterHalt('停'.repeat(9), '', { file }), H.HaltTransitionError)
  assert.equal(H.readHaltState({ file }).state, 'running', '被拒的调用不得改动状态')
  H.enterHalt('停'.repeat(10), '', { file })
  assert.equal(H.readHaltState({ file }).state, 'halted')
})

test('resume 缺 evidence 拒(空串/未传都算缺)', (t) => {
  const { file } = newStateFile(t)
  H.enterHalt(LONG_REASON, '', { file })
  assert.throws(() => H.resumeHalt(LONG_REASON, undefined, { file }), H.HaltTransitionError)
  assert.throws(() => H.resumeHalt(LONG_REASON, '   ', { file }), H.HaltTransitionError)
  assert.equal(H.readHaltState({ file }).state, 'halted', '缺证据不得把状态推到 resuming')
})

test('resume 的 evidence 过短(9 字)拒,10 字放行', (t) => {
  const { file } = newStateFile(t)
  H.enterHalt(LONG_REASON, '', { file })
  assert.throws(() => H.resumeHalt(LONG_REASON, '证'.repeat(9), { file }), H.HaltTransitionError)
  H.resumeHalt(LONG_REASON, '证'.repeat(10), { file })
  assert.equal(H.readHaltState({ file }).state, 'running')
})

test('running 上 resume 属非法转移,拒并点名合法事件', (t) => {
  const { file } = newStateFile(t)
  let err = null
  try {
    H.resumeHalt('运行中恢复无意义,必须拒', '证据足够长但状态不对', { file })
  } catch (e) {
    err = e
  }
  assert.ok(err instanceof H.HaltTransitionError, '必须抛 HaltTransitionError')
  assert.deepEqual(err.detail.allowed, ['enter'])
  assert.equal(H.readHaltState({ file }).state, 'running')
})

test('resume 两跳:halted -> resuming -> running,累计 3 条转移', (t) => {
  const { file } = newStateFile(t)
  H.enterHalt(LONG_REASON, '', { file })
  const result = H.resumeHalt('异常已消除,人工确认可恢复', '健康探针连续 10 次通过', { file })
  assert.equal(result.state, 'running')
  assert.deepEqual(
    result.transitions.map((tr) => `${tr.from}>${tr.to}`),
    ['halted>resuming', 'resuming>running'],
  )
  const doc = H.readHaltState({ file })
  assert.equal(doc.transitions.length, 3)
  assert.equal(doc.state, 'running')
})

test('两次读状态不回退(读操作不写盘,文件字节不变)', (t) => {
  const { file } = newStateFile(t)
  H.enterHalt(LONG_REASON, '', { file })
  const before = readFileSync(file, 'utf8')
  const first = H.readHaltState({ file })
  const second = H.readHaltState({ file })
  assert.equal(first.state, 'halted')
  assert.equal(second.state, 'halted')
  assert.equal(readFileSync(file, 'utf8'), before, '读不该改写状态文件')
  H.resumeHalt('异常已消除,人工确认可恢复', '健康探针连续 10 次通过', { file })
  assert.equal(H.readHaltState({ file }).state, 'running')
})

test('settle=false 停在 resuming;resuming 上 enter 拒;abort 收口回 halted', (t) => {
  const { file } = newStateFile(t)
  H.enterHalt(LONG_REASON, '', { file })
  H.resumeHalt('先停在恢复中,等外部探针', '外部探针尚未回读,分步恢复', { file, settle: false })
  assert.equal(H.readHaltState({ file }).state, 'resuming')
  assert.throws(() => H.enterHalt('恢复中重复进入应拒', '', { file }), H.HaltTransitionError)
  const aborted = H.abortResume('外部探针仍红,恢复中止', '探针连续 3 次返回 500', { file })
  assert.equal(aborted.state, 'halted')
  assert.equal(H.readHaltState({ file }).state, 'halted')
})

test('未登记事件与 halt 上 settle 都拒(转移表是封闭枚举)', (t) => {
  const { file } = newStateFile(t)
  H.enterHalt(LONG_REASON, '', { file })
  assert.equal(H.legalEventsFrom('halted').includes('settle'), false)
  assert.throws(
    () => H.abortResume('halted 上 abort 非法', '证据足够长但状态不对', { file }),
    H.HaltTransitionError,
  )
})

test('坏 JSON ⇒ 未判定(HaltStateUnjudgedError),不回落 running', (t) => {
  const { file } = newStateFile(t)
  writeFileSync(file, '{ not json', 'utf8')
  assert.throws(() => H.readHaltState({ file }), H.HaltStateUnjudgedError)
})

test('状态值不在枚举 ⇒ 未判定', (t) => {
  const { file } = newStateFile(t)
  writeFileSync(
    file,
    JSON.stringify({ schema: 1, state: 'paused', updatedAt: '', transitions: [], attempts: [] }),
  )
  assert.throws(() => H.readHaltState({ file }), H.HaltStateUnjudgedError)
})

test('历史里出现未登记的边 ⇒ 未判定(手改过的文件不许被读成某个态)', (t) => {
  const { file } = newStateFile(t)
  writeFileSync(
    file,
    JSON.stringify({
      schema: 1,
      state: 'running',
      updatedAt: '',
      transitions: [
        {
          at: new Date().toISOString(),
          from: 'halted',
          to: 'running',
          reason: '手改一条非法捷径',
          by: 'manual',
          evidence: '',
        },
      ],
      attempts: [],
    }),
  )
  assert.throws(() => H.readHaltState({ file }), H.HaltStateUnjudgedError)
})

test('state 与最后一条转移自相矛盾 ⇒ 未判定', (t) => {
  const { file } = newStateFile(t)
  writeFileSync(
    file,
    JSON.stringify({
      schema: 1,
      state: 'running',
      updatedAt: '',
      transitions: [
        {
          at: new Date().toISOString(),
          from: 'running',
          to: 'halted',
          reason: LONG_REASON,
          by: 'x',
          evidence: '',
        },
      ],
      attempts: [],
    }),
  )
  assert.throws(() => H.readHaltState({ file }), H.HaltStateUnjudgedError)
})

test('schema 版本不符 / 路径是目录 ⇒ 未判定', (t) => {
  const { file, dir } = newStateFile(t)
  writeFileSync(
    file,
    JSON.stringify({ schema: 99, state: 'running', updatedAt: '', transitions: [], attempts: [] }),
  )
  assert.throws(() => H.readHaltState({ file }), H.HaltStateUnjudgedError)
  assert.throws(() => H.readHaltState({ file: dir }), H.HaltStateUnjudgedError)
})

test('通知模板只给收件入口与内容,不含自发信动作(§5e 单通道)', (t) => {
  const { file } = newStateFile(t)
  H.enterHalt(LONG_REASON, '守护日志现读连续 3 次 ECONNRESET', { file })
  const notice = H.humanNoticeFor(H.readHaltState({ file }))
  assert.match(notice, /notify-deploy-failure\.ts/)
  assert.match(notice, /subject: \[IHUI-AI\]\[halt\]/)
  assert.match(notice, /安全停机不是硬失败/)
  assert.match(notice, /--resume/)
})

test('CLI 参数解析:动作冲突与取值缺失都拒(不静默当空串)', () => {
  assert.throws(() => CLI.parseArgv(['--enter', '原因', '--resume', '原因']), H.HaltTransitionError)
  assert.throws(() => CLI.parseArgv(['--enter', '--json']), H.HaltTransitionError)
  assert.throws(() => CLI.parseArgv(['--unknown-flag']), H.HaltTransitionError)
  const parsed = CLI.parseArgv([
    '--resume',
    '异常已消除可恢复',
    '--evidence',
    '健康探针十次通过',
    '--json',
  ])
  assert.equal(parsed.action, 'resume')
  assert.equal(parsed.evidence, '健康探针十次通过')
  assert.equal(parsed.json, true)
  assert.equal(CLI.parseArgv([]).action, 'status', '默认动作是 status')
})

test('自检本体可跑且例数与状态机版本一致(不复制第二份判据)', () => {
  const result = CLI.runSelfTest()
  assert.equal(result.ok, true)
  assert.ok(result.passed >= 20, `自检例数 ${result.passed}`)
  assert.equal(CLI.HALT_STATES.length, 3)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
