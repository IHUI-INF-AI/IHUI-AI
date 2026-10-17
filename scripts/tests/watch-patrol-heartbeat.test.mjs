// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 巡检心跳消费者(`watchPatrolHeartbeat`)的镜像测试。
 *
 * 立因:巡检心跳 `.workbuddy/ops-patrol-last.json` 长期**只有写入者、没有读者** ——
 * 元运维巡检自己停摆时账面没有任何一格会红(它判的是"别的任务没在跑",而"它自己没在跑"
 * 没有任何判据)。本消费者补上这一格。测试钉死四件事:
 *   T1 三态不并桶:缺失 / 坏 JSON / 坏 at 一律「未判定」且**不喊人、不起跳**
 *      (新装机还没跑过第一轮是"没发生",不是"坏了";喊了就是噪音);
 *   T2 新鲜心跳 ⇒ 通过且不起跳(不得每 2 分钟白跑一轮巡检);
 *   T3 超时 ⇒ 起跳**恰好一次**,且日志点名已过多少小时(红了要能答"发生了什么");
 *   T4 冷却窗口内 ⇒ 不重复起跳(6h 冷却,防每 2 分钟拉起);
 *   T5 装车锁:挂点必须在 `!CHECK_ONLY` 分支 —— 挂进 `--check` 路径等于永不执行
 *      (本仓已两次踩过这一型,见 git-guardian.mjs 里的同名注释);
 *   T6 阈值必须来自派发周期而不是另写一个数(3× 周期),否则两处会漂开。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { watchPatrolHeartbeat } from '../git-guardian.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

/** 造一对临时心跳/起跳文件路径。 */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'patrol-hb-'))
  return { heartbeatFile: join(dir, 'hb.json'), kickFile: join(dir, 'kick.ts') }
}

/** `runner` 只用来断言"有没有起跳",被调用即计数。 */
function countingRunner() {
  const state = { calls: 0 }
  state.run = () => {
    state.calls += 1
  }
  return state
}

const refuseToRun = () => {
  throw new Error('这一档不该起跳')
}

test('T1 三态不并桶:缺失 / 坏 JSON / 坏 at 都是"未判定",不喊人也不起跳', () => {
  const f = fixture()
  const logs = []
  const logger = (m) => logs.push(m)

  // ① 文件不存在
  const a = watchPatrolHeartbeat({ ...f, logger, runner: refuseToRun })
  assert.equal(a.ok, false)
  assert.equal(a.why, '心跳未生成')

  // ② 内容不是 JSON
  writeFileSync(f.heartbeatFile, 'not json', 'utf8')
  const b = watchPatrolHeartbeat({ ...f, logger, runner: refuseToRun })
  assert.equal(b.ok, false)
  assert.equal(b.why, '心跳不可解析')

  // ③ at 不是合法时间
  writeFileSync(f.heartbeatFile, JSON.stringify({ at: 'garbage' }), 'utf8')
  const c = watchPatrolHeartbeat({ ...f, logger, runner: refuseToRun })
  assert.equal(c.ok, false)
  assert.equal(c.why, 'at 不可解析')

  // 三档都必须"响了"(写日志点名),且都不得被当成红
  assert.equal(logs.length, 3, '三档未判定各要留一行日志')
  for (const l of logs) assert.match(l, /未判定/, `未判定必须点名:${l}`)
  assert.ok(
    logs.every((l) => !/✅|👌/.test(l)),
    '未判定档不得出现"通过"字样',
  )
})

test('T2 新鲜心跳 ⇒ 通过且不起跳(不得白跑巡检)', () => {
  const f = fixture()
  writeFileSync(f.heartbeatFile, JSON.stringify({ at: new Date().toISOString() }), 'utf8')
  const r = watchPatrolHeartbeat({ ...f, logger: () => {}, runner: refuseToRun })
  assert.equal(r.ok, true)
  assert.ok(!r.kicked)
  assert.ok(Number.isFinite(r.ageMs) && r.ageMs >= 0)
})

test('T3 超时 ⇒ 起跳恰好一次,且日志点名已过多少小时', () => {
  const f = fixture()
  const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  writeFileSync(f.heartbeatFile, JSON.stringify({ at: threeHoursAgo }), 'utf8')
  const runner = countingRunner()
  const logs = []
  const r = watchPatrolHeartbeat({ ...f, logger: (m) => logs.push(m), runner: runner.run })
  assert.equal(r.ok, true)
  assert.equal(r.kicked, true)
  assert.equal(runner.calls, 1, '起跳必须恰好一次')
  assert.ok(
    logs.some((l) => /小时未更新/.test(l)),
    '红了要能答"发生了什么":日志必须点名已过时长',
  )
  assert.ok(
    logs.some((l) => /调度器可能瞎了/.test(l)),
    '日志必须点明这一型故障的语义(不是普通失败)',
  )
})

test('T4 冷却窗口内 ⇒ 不重复起跳', () => {
  const f = fixture()
  writeFileSync(
    f.heartbeatFile,
    JSON.stringify({ at: new Date(Date.now() - 3 * 3600 * 1000).toISOString() }),
    'utf8',
  )
  const runner = countingRunner()
  watchPatrolHeartbeat({ ...f, logger: () => {}, runner: runner.run })
  assert.equal(runner.calls, 1, '第一次该起跳')

  const second = watchPatrolHeartbeat({ ...f, logger: () => {}, runner: runner.run })
  assert.equal(runner.calls, 1, '冷却窗口内的第二次不得再起跳')
  assert.equal(second.ok, false)
  assert.equal(second.why, '冷却窗口内,已起跳过')
})

test('T5 装车锁:挂点必须带 !CHECK_ONLY(挂进 --check 路径等于永不执行)', () => {
  const callLine = SRC.split(/\r?\n/).find((l) => /watchPatrolHeartbeat\(\)/.test(l))
  assert.ok(callLine, '挂点不见了 —— 消费者造好了但没人调度(本仓对这一型的名字叫"造好没装车")')
  assert.match(
    callLine,
    /if\s*\(\s*!\s*CHECK_ONLY\s*\)/,
    `挂点必须写成 if (!CHECK_ONLY) watchPatrolHeartbeat(),实为:${callLine.trim()}`,
  )
})

test('T6 阈值取自派发周期(3×),不得另写一个魔数', () => {
  assert.match(
    SRC,
    /stallMs\s*=\s*OPS_PATROL_INTERVAL_MS\s*\*\s*PATROL_STALL_FACTOR/,
    '超时阈值必须由 OPS_PATROL_INTERVAL_MS 推导 —— 两处各写一个数必然漂开',
  )
  assert.match(SRC, /const PATROL_STALL_FACTOR\s*=\s*3/, '倍数应为 3(避开休眠/夜间空档误报)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
