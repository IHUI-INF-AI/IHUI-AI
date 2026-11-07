// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A11-carrier-round 的行为锁 + 结构锁(2026-11-07 立,票 RP-75 ③)。
 *
 * 立因:2026-11-07 之前,A8 连着多日把 10 条腿报成 dark,而逐条查下去 —— 归属函数在位、
 * env 开关没关、节流戳齐备。真问题在**共同上游**:本机唯一执行体是计划任务单轮,一轮
 * 实测跨 1 小时以上(2026-11-06T22:29:39Z 之后整轮静默 2h24m,同期调度器 72 趟全被
 * "多实例"拒掉)。十片叶子同时黄,根只有一个,而当时**没有任何一把尺子在量这个根**。
 *
 * 本文件钉两件事,缺一件这维就退化成"又一个说得好听的描述":
 *   ① 行为:五种"停在段中间"的形态必须被判成不同结论(进行中 / 静默死 / 卡死 / 未判定 / 异常终止)
 *      —— 判错方向的后果是"把静默死读成进行中",那比不判更坏;
 *   ② 结构:`git-guardian.mjs` 必须真的在这三个位置留下证据,且 `--check` 不许冒充跑完。
 *      每条结构断言都带**变异自证**(把那一处删掉,断言必须转红)—— 只断言"字符串在不在"
 *      而不验"删掉它会红"的锁,和没有锁是一回事(§0.9:判据必须在真跑它的那一刻才成立)。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  judgeCarrierRoundFace,
  LOCK_REL,
  ROUND_CURSOR_REL,
  CRASH_LAST_REL,
  ROUND_HEARTBEAT_STALE_MS,
  ROUND_HEARTBEAT_MS,
} from '../check-autonomy-leg-health.mjs'

const REPO = join(fileURLToPath(import.meta.url), '..', '..', '..')
const GUARDIAN_SRC = join(REPO, 'scripts', 'git-guardian.mjs')
const MIN = 60_000

/** 造一个只有 state 目录的临时仓库根;`lockAgeMs` 用来把锁 mtime 拨到过去(测心跳停滞)。 */
function mkRoot({ cursor, crash, lockPid, lockAgeMs = 0 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'a11-round-'))
  const dir = join(root, '.ihui-agent', 'state')
  mkdirSync(dir, { recursive: true })
  if (cursor) writeFileSync(join(dir, 'guardian-round-cursor.json'), JSON.stringify(cursor), 'utf8')
  if (crash) writeFileSync(join(dir, 'guardian-crash-last.json'), JSON.stringify(crash), 'utf8')
  if (lockPid !== undefined) {
    const p = join(dir, 'git-guardian.lock')
    writeFileSync(p, `pid=${lockPid}\ntoken=${lockPid}-t\nat=2026-11-07T00:00:00.000Z\n`, 'utf8')
    if (lockAgeMs) {
      // 用绝对时刻把 mtime 拨到 `NOW - lockAgeMs`(不是相对真实时钟):判定用的 now 是固定的
      // 测试基准时刻,若 mtime 取 Date.now(),两者基准不同就会让"心跳新鲜/停滞"这两档互相串味。
      const t = (NOW - lockAgeMs) / 1000
      utimesSync(p, t, t)
    }
  }
  return root
}

const NOW = Date.parse('2026-11-07T02:00:00.000Z')

test('A11 · 游标缺失 ⇒ unjudged(绝不读成"轮次正常")', () => {
  const root = mkRoot({ lockPid: 111 })
  try {
    const d = judgeCarrierRoundFace({ root, now: NOW })
    assert.equal(d.dim, 'A11-carrier-round')
    assert.equal(d.state, 'unjudged', '没有游标就无从判"跑完没";记绿等于把没判写成判过')
    assert.match(d.readout, /游标取不到/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('A11 · 游标走到 round-done ⇒ ok,并报出总耗时', () => {
  const root = mkRoot({
    cursor: { stage: 'main:round-done', atMs: NOW - 5 * MIN, elapsedMs: 72 * MIN, pid: 111 },
    lockPid: 111,
    lockAgeMs: 30_000,
  })
  try {
    const d = judgeCarrierRoundFace({ root, now: NOW })
    assert.equal(d.state, 'ok')
    assert.match(d.readout, /跑完/)
    assert.match(d.readout, /72 分钟/, '总耗时必须来自游标,不能在本层重算')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('A11 · 停在段中间但锁心跳新鲜、且锁就是写游标那个 pid ⇒ ok「进行中」', () => {
  const root = mkRoot({
    cursor: { stage: 'main:pre-dispatch', atMs: NOW - 20 * MIN, elapsedMs: 40 * MIN, pid: 111 },
    lockPid: 111,
    lockAgeMs: 30_000,
  })
  try {
    const d = judgeCarrierRoundFace({ root, now: NOW })
    assert.equal(d.state, 'ok', '心跳新鲜 + 同一 pid = 这一轮还活着,只是当前段长;判红就是假红')
    assert.match(d.readout, /进行中/)
    assert.match(d.readout, /心跳 30s 前/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('A11 · 停在段中间而锁已被另一个 pid 接手 ⇒ drift(静默死,点名死在哪一段)', () => {
  const root = mkRoot({
    cursor: { stage: 'main:post-feedback-loop', atMs: NOW - 90 * MIN, elapsedMs: 95 * MIN, pid: 111 },
    lockPid: 222,
    lockAgeMs: 30_000,
  })
  try {
    const d = judgeCarrierRoundFace({ root, now: NOW })
    assert.equal(d.state, 'drift', '写游标的轮次已不在持锁、又没走到 round-done ⇒ 它静默死了')
    assert.match(d.readout, /main:post-feedback-loop/)
    assert.match(d.readout, /停止|终止/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('A11 · 同一 pid 持锁但心跳停了 ⇒ drift(事件循环被长步骤占满)', () => {
  const root = mkRoot({
    cursor: { stage: 'main:post-rn-shell', atMs: NOW - 40 * MIN, elapsedMs: 80 * MIN, pid: 111 },
    lockPid: 111,
    lockAgeMs: ROUND_HEARTBEAT_STALE_MS + 5 * MIN,
  })
  try {
    const d = judgeCarrierRoundFace({ root, now: NOW })
    assert.equal(d.state, 'drift')
    assert.match(d.readout, /心跳停了/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('A11 · 崩溃现场比游标新 ⇒ drift(异常终止优先于一切"停在中间"的解释)', () => {
  const root = mkRoot({
    cursor: { stage: 'main:pre-round-close', atMs: NOW - 10 * MIN, elapsedMs: 60 * MIN, pid: 111 },
    crash: { kind: 'uncaughtException', at: new Date(NOW - 5 * MIN).toISOString(), stage: 'main:pre-round-close', message: 'boom', stack: 'x' },
    lockPid: 111,
    lockAgeMs: 30_000,
  })
  try {
    const d = judgeCarrierRoundFace({ root, now: NOW })
    assert.equal(d.state, 'drift')
    assert.match(d.readout, /uncaughtException/)
    assert.match(d.readout, /main:pre-round-close/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('A11 · 跑完后超过心跳消失线没有新游标 ⇒ drift(调度器可能已停,不是腿的问题)', () => {
  const root = mkRoot({
    cursor: { stage: 'main:round-done', atMs: NOW - (ROUND_HEARTBEAT_MS + MIN), elapsedMs: 70 * MIN, pid: 111 },
    lockPid: 111,
    lockAgeMs: 30_000,
  })
  try {
    assert.equal(judgeCarrierRoundFace({ root, now: NOW }).state, 'drift')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// —— 结构锁(带变异自证) ——
const src = readFileSync(GUARDIAN_SRC, 'utf8')

/** 口径必须与生产同源:常量从被审模块 import,不在本文件抄第二份路径。 */
test('结构 · 游标/现场路径常量与守护写盘点一致', () => {
  assert.ok(ROUND_CURSOR_REL.endsWith('guardian-round-cursor.json'))
  assert.ok(CRASH_LAST_REL.endsWith('guardian-crash-last.json'))
  assert.ok(LOCK_REL.endsWith('git-guardian.lock'))
  assert.ok(src.includes('guardian-round-cursor.json'), '守护侧必须写同一份游标文件')
  assert.ok(src.includes('guardian-crash-last.json'), '守护侧必须落同一份现场件')
})

const STAGES = [
  'main:block-enter',
  'main:post-feedback-loop',
  'main:post-self-audit',
  'main:pre-dispatch',
  'main:post-rn-shell',
  'main:pre-round-close',
  'main:round-done',
]

test('结构 · 七个段界检查点齐全(含 2026-11-06 那轮的真实死亡点)', () => {
  for (const s of STAGES) {
    assert.ok(src.includes(`markRoundStage('${s}')`), `缺检查点 ${s}:游标就断在那一段之前,静默死无法定位`)
  }
})

test('结构 · 变异自证:删掉任一段界检查点,上面的断言必须转红', () => {
  for (const s of STAGES) {
    const mutated = src.replace(`markRoundStage('${s}')`, '/* removed */')
    assert.notEqual(mutated, src, `变异未生效:${s} 的写法与断言口径不一致`)
    assert.equal(
      mutated.includes(`markRoundStage('${s}')`),
      false,
      `删掉 ${s} 之后本断言仍为真 ⇒ 这道锁量不到它`,
    )
  }
})

test('结构 · 三条异常出口都接到 crashExit(此前 stderr 落在 VBS 隐藏窗口里,零痕迹)', () => {
  for (const hook of ['uncaughtException', 'unhandledRejection']) {
    assert.ok(src.includes(`process.on('${hook}', crashExit(`), `${hook} 未接线 ⇒ 该型异常仍然无声`)
    const mutated = src.replace(`process.on('${hook}', crashExit(`, '/* removed */')
    assert.equal(mutated.includes(`process.on('${hook}', crashExit(`), false)
  }
  assert.ok(src.includes(".catch(crashExit('main-rejected'))"), 'main() 的 rejection 未接 crashExit')
  assert.equal(src.replace(".catch(crashExit('main-rejected'))", '.catch(() => {})').includes('.catch(crashExit('), false)
})

test('结构 · crashExit 必须真的落盘再退:缺 writeFileSync(CRASH_LAST 就等于只换个地方 console.error', () => {
  const body = src.slice(src.indexOf('const crashExit ='), src.indexOf("process.on('uncaughtException'"))
  assert.ok(body.includes('writeFileSync(') && body.includes('CRASH_LAST'), '现场件未落盘')
  assert.ok(body.includes('releaseGuardianLock()'), '异常退出必须释放轮级锁,否则下一趟要等 staleMs')
  assert.ok(body.includes('process.exit(1)'), '异常必须终止本轮:吞掉继续跑等于把故障洗成静默')
})

test('结构 · --check / --status 不许写游标(只读态冒充"跑完"是本维最不能出的假绿)', () => {
  const body = src.slice(src.indexOf('export function markRoundStage'), src.indexOf('// —— git 可执行文件解析'))
  assert.ok(body.includes('if (CHECK_ONLY || STATUS_ONLY) return'), '缺只读态短路')
  const mutated = body.replace('if (CHECK_ONLY || STATUS_ONLY) return', '/* removed */')
  assert.equal(mutated.includes('if (CHECK_ONLY || STATUS_ONLY) return'), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
