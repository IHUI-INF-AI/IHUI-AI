// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-O69 2026-11-01

/**
 * check-dev-db-rotation-window.test.mjs — 票 O69 窗口判定器的镜像测试(2026-11-01)。
 *
 * 钉的是**判据本身有没有牙**,不是"代码跑得动":
 *   ① 端口有占用 ⇒ `deferred` 且**点名是哪个口**(变"删掉端口判定" ⇒ 本例必须红);
 *   ② 超期 + 端口全空 ⇒ `due`,stdout 含 `would run`,且**一个字都没 spawn**(巡检默认不许真换口令);
 *   ③ 未超期 ⇒ `skip`(变"超期判定恒真" ⇒ 本例必须红);
 *   ④ 留痕缺失 / 坏行 ⇒ `undetermined`,**exit 0**(取不到输入不许给绿灯,但也不许拦提交);
 *   ⑤ 反向例两条:直接改判据源码再跑同一批夹具,证明 ①③ 的红是判据挣来的,不是断言写死的。
 *
 * 端口占用纪律:占口只在**一个 test 内**且 `finally` 立刻 close();口号一律由 `listen(0)` 现取,
 * 不写死本机端口 —— 本机 8801 被生产 WEB-ROUTER 真实占用(绑定时 Windows 给 EACCES 而非 EADDRINUSE),
 * 写死会让本测试依赖本机服务状态。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(dirname(HERE))
const SCRIPT = join(ROOT, 'scripts', 'check-dev-db-rotation-window.mjs')
const GEN = await import(pathToFileURL(SCRIPT).href)
const { probeWindow, readLastRotation, decideWindow, runWindowCheck } = GEN

const DAY = 86400000
const NOW = Date.parse('2026-11-01T12:00:00.000Z')
const tmpDir = mkdtempSync(join(tmpdir(), 'ihui-devdb-window-'))
test.after(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    /* 临时目录清不掉不影响判据 */
  }
})

/** 造一份留痕(末条 ts = now - days 天),返回路径。字段形与器物 --apply 的 append 同形。 */
function ledgerWith(days, name) {
  const p = join(tmpDir, `${name}.jsonl`)
  const row = {
    ts: new Date(NOW - days * DAY).toISOString(),
    kind: 'local-dev-db-password',
    db: 'localhost:5432/ihui',
    user: 'ihui',
    oldFp: 'aaaaaaaaaaaa',
    newFp: 'bbbbbbbbbbbb',
    consumers: ['.env'],
    backupDir: '.ihui-agent/state/dev-db-rotation-x',
    verify: { oldRejected: true, newAccepted: true },
    reason: 'fixture',
  }
  writeFileSync(p, `${JSON.stringify(row)}\n`, 'utf8')
  return p
}

/** 起一个临时监听(:0 由内核分配),返回实际口号;不写死本机端口,与任何服务状态无关。 */
async function occupy() {
  return await new Promise((resolve, reject) => {
    const srv = createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }))
  })
}

// ① 端口有占用 ⇒ deferred,且点名端口
test('① 端口有占用 ⇒ deferred 且点名该端口', async () => {
  const held = await occupy()
  try {
    const win = await probeWindow({ ports: [held.port] })
    assert.deepEqual(win.live, [held.port], '占住的口必须被探成 live')
    assert.deepEqual(win.unknown, [], '同机占口不应落 unknown')
    const v = decideWindow({ ledger: { state: 'ok', ts: NOW - 40 * DAY, ageDays: 40 }, window: win, nowMs: NOW })
    assert.equal(v.state, 'deferred')
    assert.ok(v.why.includes(String(held.port)), `结论须点名端口,实得:${v.why}`)
  } finally {
    await new Promise((r) => held.srv.close(r))
  }
})

// ② 超期 + 端口全空 ⇒ due;stdout 含 would run;一个都不 spawn;留痕零新增行
test('② 超期 + 端口全空 ⇒ due + would run,且绝不 spawn、不写留痕', async () => {
  const ledger = ledgerWith(40, 'due')
  const before = readFileSync(ledger, 'utf8')
  const lines = []
  let spawnCalls = 0
  const r = await runWindowCheck({
    ledgerFile: ledger,
    nowMs: NOW,
    probe: async () => ({ live: [], unknown: [] }),
    reader: (f, n) => readLastRotation(f, n),
    spawn: () => {
      spawnCalls += 1
      return { status: 0 }
    },
    logger: (m) => lines.push(String(m)),
  })
  assert.equal(r.state, 'due')
  assert.equal(r.spawned, false)
  assert.equal(spawnCalls, 0, '默认档不许真动作:spawn 一次都不该发生')
  assert.ok(lines.some((l) => l.includes('would run: node scripts/rotate-local-dev-db-password.mjs --apply')), `缺 would run 行:${lines.join(' | ')}`)
  assert.equal(readFileSync(ledger, 'utf8'), before, '判定不许往留痕里追加任何行')
})

// ②b 只有显式开关才真派生(否则"默认不换"只是注释)
test('②b --trigger 档才派生,且下游 rc 不改变本器 exit 0 语义', async () => {
  const ledger = ledgerWith(40, 'trigger')
  let spawnCalls = 0
  const r = await runWindowCheck({
    ledgerFile: ledger,
    nowMs: NOW,
    trigger: true,
    probe: async () => ({ live: [], unknown: [] }),
    spawn: () => {
      spawnCalls += 1
      return { status: 2 } // 器物 fail-closed(窗口变化/输入取不到)
    },
    logger: () => {},
  })
  assert.equal(spawnCalls, 1)
  assert.equal(r.spawned, true)
  assert.equal(r.rc, 2)
})

// ③ 未超期 ⇒ skip
test('③ 未超期 ⇒ skip', async () => {
  const ledger = ledgerWith(3, 'skip')
  const r = await runWindowCheck({
    ledgerFile: ledger,
    nowMs: NOW,
    probe: async () => ({ live: [], unknown: [] }),
    logger: () => {},
  })
  assert.equal(r.state, 'skip')
  assert.equal(r.spawned, false)
  assert.ok(r.why.includes('3.0 天'), `应报出实际天数,实得:${r.why}`)
})

// ④ 留痕缺失 / 坏行 ⇒ undetermined,exit 0
test('④ 留痕缺失 ⇒ undetermined 且 exit 0', () => {
  const missing = join(tmpDir, 'nope.jsonl')
  const r = spawnSync(process.execPath, [SCRIPT, '--ledger', missing], { encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0, '未判定也不许拦(恒 0)')
  assert.match(`${r.stdout}${r.stderr}`, /state=undetermined/)
  assert.doesNotMatch(`${r.stdout}${r.stderr}`, /would run:/, '未判定绝不许报 would run')
})

test('④b 留痕坏行 ⇒ undetermined 且 exit 0', () => {
  const bad = join(tmpDir, 'bad.jsonl')
  writeFileSync(bad, `${JSON.stringify({ ts: new Date(NOW - 40 * DAY).toISOString() })}\n{not json\n`, 'utf8')
  const r = spawnSync(process.execPath, [SCRIPT, '--ledger', bad], { encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0)
  assert.match(`${r.stdout}`, /state=undetermined/)
  assert.match(`${r.stdout}`, /第 2 行/, '坏行要点名行号')
})

// ⑤ 反向例:直接改判据源码,证明 ③ / ① 的红是判据挣来的
function mutate(replacements, tag) {
  let src = readFileSync(SCRIPT, 'utf8')
  for (const [from, to] of replacements) {
    assert.ok(src.includes(from), `变异锚点不在源码里(${tag}):${from}`)
    src = src.split(from).join(to)
  }
  const p = join(tmpDir, `mutant-${tag}.mjs`)
  writeFileSync(p, src, 'utf8')
  return p
}

test('⑤ 变异【超期判定恒真】⇒ ③ 的 skip 必须变 due(判据有牙)', async () => {
  const p = mutate([['const overdue = ageDays >= overdueDays', 'const overdue = true /* 变异 */']], 'overdue')
  const M = await import(pathToFileURL(p).href)
  const ledger = { state: 'ok', ts: NOW - 3 * DAY, ageDays: 3 }
  assert.equal(decideWindow({ ledger, window: { live: [], unknown: [] }, nowMs: NOW }).state, 'skip')
  const mutated = M.decideWindow({ ledger, window: { live: [], unknown: [] }, nowMs: NOW })
  assert.equal(mutated.state, 'due', `变异体应误判 due ⇒ ③ 会红;实得 ${mutated.state}`)
  assert.equal(mutated.state === 'skip', false)
})

test('⑤b 变异【删掉端口判定】⇒ ① 的 deferred 必须变 due(判据有牙)', async () => {
  const p = mutate([['const busyPorts = live.length > 0', 'const busyPorts = false /* 变异:删掉端口判定 */']], 'ports')
  const M = await import(pathToFileURL(p).href)
  const ledger = { state: 'ok', ts: NOW - 40 * DAY, ageDays: 40 }
  const win = { live: [8802], unknown: [] }
  assert.equal(decideWindow({ ledger, window: win, nowMs: NOW }).state, 'deferred')
  assert.equal(M.decideWindow({ ledger, window: win, nowMs: NOW }).state, 'due', '变异体丢掉 deferred ⇒ ① 会红')
})

// ⑥ 真·CLI 三态冒烟:用现盘留痕(缺失时落 undetermined),永远 exit 0
test('⑥ CLI 冒烟:现盘/临时留痕任一情形都 exit 0', () => {
  const ledger = ledgerWith(1, 'smoke')
  const r = spawnSync(process.execPath, [SCRIPT, '--ledger', ledger], { encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /\[dev-db-rotation-window\] state=skip/)
  assert.ok(existsSync(SCRIPT))
})
// ⑦ 结构锁:本文件不得再写死 8801 的绑定/URL(端口必须由 listen(0) 现取)
test('⑦ 结构锁:不得再写死 8801 绑定/URL,且检测器本身有牙', () => {
  const PORT = '88' + '01'
  const needles = [`:${PORT}`, `listen(${PORT}`, `listen( ${PORT}`, `port: ${PORT}`, `ports: [${PORT}]`]
  const hitsIn = (src) => needles.filter((n) => src.includes(n))
  // 检测器自检:合成样本必须命中;若这条自检被删/改坏,锁就退化成空转
  assert.deepEqual(hitsIn(`srv.listen(${PORT}, '127.0.0.1')\nconst u = 'http://127.0.0.1:${PORT}/api'`), [`:${PORT}`, `listen(${PORT}`], '检测器失灵')
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.deepEqual(hitsIn(src), [], `端口须由 listen(0) 现取,实得命中:${hitsIn(src).join(' | ')}`)
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
