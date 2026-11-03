// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 O69 的**派发腿**镜像测试(`sweepLocalDevDbRotation`,2026-11-01)。
 *
 * 与 `scripts/tests/dev-db-rotation-policy.test.mjs` 的分工:那一份钉**纯决定器**
 * (`scripts/lib/dev-db-rotation-policy.mjs` 的 `decideDevDbRotation`),本份钉决定器之外的
 * 全部 IO 动作 —— 登记面怎么读、戳什么时候准写、子进程派生几次、结论行用什么词。
 * 判据一律 import 生产层本体(§22c),本文件不重写任何判定。
 *
 * 钉死九件事:
 *  D1 活服务在场 ⇒ 整轮让路、`--apply` 零派生,且结论行**不得**出现"已轮换/无需轮换/结清"
 *     (§0.3:让路不是"不需要做";写成"不需要"就等于把欠账洗绿)。
 *  D2 登记面无条目 ⇒ 零派生(成对给正向对照:有条目且窗口空闲 ⇒ 恰好派生一次)。
 *  D3 登记面读不动/空 ⇒ `pending-unreadable` 未判定并点名,不猜成"无条目"、不派生。
 *  D4 器物不在位 ⇒ 未判定并点名原因,不记绿也不冒红,**且不写节流戳**
 *     (把"没跑"记成"刚跑过" = 补回器物后还得等一个节律)。
 *  D5 `--apply` rc=1 ⇒ `failed` 不记绿,写冷却锚;冷却(1 小时)内不再派生,过窗即重试。
 *  D6 `--apply` rc=2 ⇒ `device-refused`(器物自己 fail-closed)未判定,**绝不占冷却锚**
 *     —— 否则"窗口在两轮之间出现"会被上一次拒执行锁死 1 小时,正是要治的"靠人盯"。
 *  D7 节流戳只在有结论时写:让路/未判定只写 `probeAt`(探测节律),不写 `attemptAt`;
 *     探测节律窗口内连 netstat 都不点(零子进程)。
 *  D8 rc=0 ⇒ 结清:标记被删(器物没删成时代删)、`attemptAt` 落戳。
 *  D9 装车锁:本腿挂在 main 健康轮次(`!CHECK_ONLY`,与 `sweepExposedCredentialRotation` 同格),
 *     且登记进 `__test__` 出口;派生一律走 `runLegChild`(§12g 显式 stdio + windowsHide),
 *     函数体内不得再出现自写 `execFileSync`/`spawn` 的第二把尺。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import { __test__ as G, sweepLocalDevDbRotation } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')
const T0 = Date.parse('2026-11-01T04:00:00Z')
const MIN = 60 * 1000

/** 造一处独立夹具:tick / pending 都在 scratch,真台账一个字节都不碰。 */
function fixture({ pending = { reason: 'O68:口令前缀曾进会话(本机 dev 库)' } } = {}) {
  const dir = mkScratch('dev-db-rotation-sweep-')
  const tickFile = join(dir, 'dev-db-rotation-last.json')
  const pendingFile = join(dir, 'dev-db-rotation-pending.json')
  if (pending !== null) writeFileSync(pendingFile, JSON.stringify(pending), 'utf8')
  return { dir, tickFile, pendingFile }
}

function logsOf() {
  const logs = []
  return { logs, logger: (m) => logs.push(m) }
}

/** 记录派生次数的假 `--apply`(返回 runLegChild 的形状)。 */
function runnerReturning(status, stdout = 'ROTATE 假输出') {
  const calls = []
  const runner = () => {
    calls.push(status)
    return { status, stdout, stderr: '' }
  }
  return { runner, calls }
}

test('D1 活服务在场 ⇒ 整轮让路、零派生,结论行不得出现"已轮换/无需轮换/结清"', () => {
  const f = fixture()
  const { logs, logger } = logsOf()
  const { runner, calls } = runnerReturning(0)
  const r = sweepLocalDevDbRotation({
    ...f,
    now: T0,
    logger,
    runner,
    livePortsProbe: () => [8801, 8802],
  })
  assert.equal(r.ran, false)
  assert.equal(r.ok, false, '让路记成 ok=true 就是把欠账洗绿')
  assert.equal(r.state, 'window-busy')
  assert.equal(r.spawned, false)
  assert.equal(calls.length, 0, '活服务在场时派生 --apply = 打断别席在跑的 dev 栈')
  const line = logs.join('\n')
  assert.match(line, /dev 库口令轮换:window-busy/)
  assert.match(line, /本轮未派生,不记绿/)
  for (const banned of ['已轮换', '无需轮换', '结清', '已完成']) {
    assert.ok(!line.includes(banned), `让路的结论行出现了「${banned}」—— 不做的动作不许写成做过(§0.3)`)
  }
})

test('D2 登记面无条目 ⇒ 零派生零探测;成对正向对照:有条目且窗口空闲 ⇒ 恰好派生一次', () => {
  const f = fixture({ pending: null })
  const { logs, logger } = logsOf()
  const { runner, calls } = runnerReturning(0)
  let probes = 0
  const r = sweepLocalDevDbRotation({
    ...f,
    now: T0,
    logger,
    runner,
    livePortsProbe: () => {
      probes += 1
      return []
    },
  })
  assert.equal(r.state, 'no-pending')
  assert.equal(r.spawned, false)
  assert.equal(calls.length, 0)
  assert.equal(probes, 0, '无欠账还要点一次 netstat = 每轮白派一个子进程')
  assert.equal(existsSync(f.tickFile), false, '无条目那档不该留下任何写盘痕迹')

  // 正向对照:同一个夹具补上登记条目 ⇒ 必须真派生一次(否则本腿等于没接线)
  writeFileSync(f.pendingFile, JSON.stringify({ reason: 'O68' }), 'utf8')
  const ok = sweepLocalDevDbRotation({
    ...f,
    now: T0 + MIN,
    logger,
    runner,
    livePortsProbe: () => [],
  })
  assert.equal(ok.ran, true)
  assert.equal(calls.length, 1, '有条目却不派生 ⇒ 这条线是死的')
})

test('D3 登记面读不动/空 ⇒ pending-unreadable 未判定并点名,不猜成"无条目"、零派生', () => {
  for (const body of ['', '   ', '{坏 JSON', 'null', '{}', '[]']) {
    const f = fixture({ pending: null })
    writeFileSync(f.pendingFile, body, 'utf8')
    const { logs, logger } = logsOf()
    const { runner, calls } = runnerReturning(0)
    const r = sweepLocalDevDbRotation({
      ...f,
      now: T0,
      logger,
      runner,
      livePortsProbe: () => [],
    })
    assert.equal(r.ok, false, `登记面内容「${body || '(空)'}」被当成了已判定`)
    assert.equal(r.state, 'pending-unreadable')
    assert.equal(calls.length, 0, '读不到条目就派生 --apply 是拿猜测当输入')
    assert.match(logs.join('\n'), /pending-unreadable/, '未判定必须点名,不能静默返回')
  }
})

test('D4 器物不在位 ⇒ 未判定并点名原因,不写节流戳(补回器物后下一轮立刻能动)', () => {
  const f = fixture()
  const { logs, logger } = logsOf()
  const { runner, calls } = runnerReturning(0)
  const r = sweepLocalDevDbRotation({
    ...f,
    now: T0,
    root: join(mkScratch('dev-db-rotation-no-script-'), 'nope'),
    logger,
    runner,
    livePortsProbe: () => [],
  })
  assert.equal(r.ran, false)
  assert.equal(r.ok, false)
  assert.equal(r.state, 'no-script')
  assert.match(String(r.why), /器物不在位/)
  assert.match(logs.join('\n'), /器物不在位[\s\S]*不记绿也不记红/)
  assert.equal(calls.length, 0)
  assert.equal(existsSync(f.tickFile), false, '没跑过就写戳 = 把"没跑"记成"刚跑过"')
})

test('D5 --apply 失败(rc=1) ⇒ 不记绿、落冷却锚;冷却内不再派生,过 1 小时重试', () => {
  const f = fixture()
  const { logger } = logsOf()
  const { runner, calls } = runnerReturning(1, '❌ 验证不过(旧拒=false 新通=true)已回滚')
  const first = sweepLocalDevDbRotation({
    ...f,
    now: T0,
    logger,
    runner,
    livePortsProbe: () => [],
  })
  assert.equal(first.ran, true)
  assert.equal(first.ok, false, 'rc=1 记成通过就是"只换不验"那一型')
  assert.equal(first.state, 'failed')
  assert.equal(calls.length, 1)
  // 标记必须还在:失败不等于结清
  assert.equal(existsSync(f.pendingFile), true)
  const tick = JSON.parse(readFileSync(f.tickFile, 'utf8'))
  assert.equal(Date.parse(tick.attemptAt), T0, '失败必须落冷却锚')

  const within = sweepLocalDevDbRotation({
    ...f,
    now: T0 + 59 * MIN,
    logger,
    runner,
    livePortsProbe: () => [],
  })
  assert.equal(within.state, 'throttled')
  assert.equal(calls.length, 1, '1 小时冷却内再派生 = 硬试')

  const after = sweepLocalDevDbRotation({
    ...f,
    now: T0 + 61 * MIN,
    logger,
    runner,
    livePortsProbe: () => [],
  })
  assert.equal(after.ran, true)
  assert.equal(calls.length, 2, '过冷却必须重试,否则欠账永远挂在第一次失败上')
})

test('D6 --apply 返回 rc=2(器物 fail-closed)⇒ 未判定,且绝不占冷却锚', () => {
  const f = fixture()
  const { logs, logger } = logsOf()
  const { runner, calls } = runnerReturning(2, '⏳ 窗口未到:8801 有活服务在听')
  const r = sweepLocalDevDbRotation({
    ...f,
    now: T0,
    logger,
    runner,
    livePortsProbe: () => [],
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, false)
  assert.equal(r.state, 'device-refused')
  assert.match(logs.join('\n'), /未判定[\s\S]*不记绿也不记红/)
  const tick = JSON.parse(readFileSync(f.tickFile, 'utf8'))
  assert.ok(!tick.attemptAt, '拒执行占住冷却锚 ⇒ 窗口随后出现也要再等 1 小时(= 靠人盯复发)')
  assert.equal(existsSync(f.pendingFile), true)

  // 下一轮窗口真空闲:必须立刻派生(不被上一轮的 rc=2 拖住)
  const next = sweepLocalDevDbRotation({
    ...f,
    now: T0 + 6 * MIN,
    logger,
    runner,
    livePortsProbe: () => [],
  })
  assert.equal(next.ran, true)
  assert.equal(calls.length, 2)
})

test('D7 节流戳只在有结论时写;让路只落探测节律,节律窗口内连窗口都不再探', () => {
  const f = fixture()
  const { logger } = logsOf()
  const { runner, calls } = runnerReturning(0)
  let probes = 0
  const probe = () => {
    probes += 1
    return [8803]
  }
  const first = sweepLocalDevDbRotation({ ...f, now: T0, logger, runner, livePortsProbe: probe })
  assert.equal(first.state, 'window-busy')
  assert.equal(probes, 1)
  let tick = JSON.parse(readFileSync(f.tickFile, 'utf8'))
  assert.ok(tick.probeAt, '让路要留探测节律,否则每 2 分钟点一次 netstat')
  assert.ok(!tick.attemptAt, '让路写 attemptAt = 把没做的事记成做过')

  const second = sweepLocalDevDbRotation({
    ...f,
    now: T0 + 4 * MIN,
    logger,
    runner,
    livePortsProbe: probe,
  })
  assert.equal(second.state, 'probe-throttled')
  assert.equal(probes, 1, '未到探测节律还点 netstat = 巡检腿自己变成子进程风暴')
  assert.equal(calls.length, 0)

  const third = sweepLocalDevDbRotation({
    ...f,
    now: T0 + 6 * MIN,
    logger,
    runner,
    livePortsProbe: probe,
  })
  assert.equal(third.state, 'window-busy')
  assert.equal(probes, 2, '过探测节律必须重新量一次窗口(空闲窗口随时可能出现)')
  tick = JSON.parse(readFileSync(f.tickFile, 'utf8'))
  assert.ok(!tick.attemptAt)
})

test('D8 rc=0 ⇒ 结清:标记删除、attemptAt 落戳;器物没删成时本腿代删', () => {
  const f = fixture()
  const { logs, logger } = logsOf()
  const { runner, calls } = runnerReturning(0, '✅ 轮换完成:旧值拒收=true 新值通过=true')
  const r = sweepLocalDevDbRotation({
    ...f,
    now: T0,
    logger,
    runner,
    livePortsProbe: () => [],
  })
  assert.equal(r.ok, true)
  assert.equal(r.state, 'applied')
  assert.equal(calls.length, 1)
  assert.equal(existsSync(f.pendingFile), false, '成功后标记还在 ⇒ 下一轮把已结清的欠账再派一次')
  const tick = JSON.parse(readFileSync(f.tickFile, 'utf8'))
  assert.equal(tick.state, 'applied')
  assert.equal(tick.rc, 0)
  assert.ok(tick.attemptAt)
  // 结清的说法只来自器物交回的 rc 与输出,本腿不替它宣布"已轮换"细节
  assert.match(logs.join('\n'), /rc=0/)
})

test('D9 装车锁:挂点在健康轮次且与同族腿同格、已登记进 __test__、派生只走 runLegChild', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
  const call = 'if (!CHECK_ONLY) sweepLocalDevDbRotation()'
  const at = src.indexOf(call)
  assert.ok(at > 0, '巡检腿没挂进健康轮次 ⇒ 等于没接线(§0.9)')
  const exposedAt = src.indexOf('if (!CHECK_ONLY) sweepExposedCredentialRotation()')
  assert.ok(exposedAt > 0 && Math.abs(exposedAt - at) < 400, '与凭据轮换腿必须同格,否则挂在长任务串之后永不执行')
  assert.match(src.slice(at - 120, at), /CHECK_ONLY/, '挂点必须在 !CHECK_ONLY 分支内(--check 档保持零副作用)')
  const exported = src.slice(src.indexOf('export const __test__'))
  assert.match(exported, /sweepLocalDevDbRotation,/, '未进 __test__ 出口 ⇒ 镜像只能读源码字符串,钉不住行为')
  assert.equal(G.sweepLocalDevDbRotation, sweepLocalDevDbRotation, '__test__ 出口与本函数必须是同一个实现')
  // 函数体内只许经 runLegChild 派生(§12g:显式 stdio + windowsHide 一把尺管住)
  const body = src.slice(src.indexOf('export function sweepLocalDevDbRotation'))
  const end = body.indexOf('\n}\n')
  const fnBody = body.slice(0, end < 0 ? body.length : end)
  assert.ok(!/execFileSync|spawnSync|\bspawn\(/.test(fnBody), '本腿内自写第二把派生尺 ⇒ stdio 纪律迟早漂移(§12g)')
  assert.match(fnBody, /runLegChild\(script, \['--apply'\]/, '派生动作必须经 runLegChild')
  assert.match(fnBody, /liveServicePorts\(\)/, '窗口判据必须吃器物自己的探测函数(§0.6 单一真相源)')
})

test('D10 决定器判据不在本层复算:三态输入直接来自生产层策略', () => {
  // 反向锁:镜像件只 import 生产本体,不在这里复制第二份判定(§22c);
  // 这一条同时钉住"窗口取不到 ⇒ null"的取材形状(器物 netstat 失败时返回 {ok:false,live:[]},
  // 若按 live 直取会读成"空闲"——正是 §0.3 禁的那一型)。
  const src = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
  const body = src.slice(src.indexOf('export function sweepLocalDevDbRotation'))
  assert.match(
    body,
    /probe\?\.ok === true && Array\.isArray\(probe\.live\) \? probe\.live : null/,
    '器物取不到窗口必须落成 null(未判定),不能被 [] 冒充"空闲"',
  )
  // 决定器只在 guardian 里 import 一次,且本文件零复算(§0.6/§22c:第二份必然漂移)
  const importLines = src.split(/\r?\n/).filter((l) => l.includes("from './lib/dev-db-rotation-policy.mjs'"))
  assert.equal(importLines.length, 1, '决定器单源的 import 必须恰好一条')
  assert.match(importLines[0], /decideDevDbRotation/)
  assert.equal(
    (src.match(/function decideDevDbRotation/g) ?? []).length,
    0,
    'guardian 内出现第二份 decideDevDbRotation 实现 ⇒ 判据开始漂移',
  )
  assert.equal(typeof sweepLocalDevDbRotation, 'function')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
