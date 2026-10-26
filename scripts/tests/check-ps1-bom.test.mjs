// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 `check-ps1-bom.mjs`(.ps1/.psm1 必须 UTF-8 with BOM)的**镜像测试**(§22c 第②步)。
 *
 * 立票:该门 2026-10-27 接入提交链时现读 `--self-test` 档在(3 处命中),而
 * `export const __test__` 读 0、`scripts/tests/check-ps1-bom.test.mjs` 读 0 —— 三步里缺第①②步。
 * 本测试**只 import 门体导出的生产判据**(`__test__`),不在这里复制第二份 BOM 常量或判定分支
 * (第③步由守门 191 盯)。判据语义一行未改,改的只有「能否被 import」(§22d 守卫)与「导出口」。
 *
 * 钉死的事(四型 + 变异自证 + 装车锁):
 *   T1 带 BOM ⇒ 合规(ok),含首三字节边界的正反对照;
 *   T2 无 BOM ⇒ 判红并点名(新增缺 / 本次弄掉两支各自点名),并留**存量只报数不判红**的正向对照
 *      (§12e:把存量也拦就是恒红门);
 *   T3 非 .ps1/.psm1 ⇒ **不进判定行**——「没扫到」绝不写成「合规」;
 *   T4 单文件取不到内容 ⇒ 未判定档:逐条点名,退码优先级「有红先红(1),只剩合规 + 未判定才 2」,
 *      既不记绿(0)也不冒充判红;
 *   T5 形状锁:§22d 守卫必须是 pathToFileURL 形态,`__test__` 必须导出真实判定链;
 *   T6 装车锁:CLI 直跑(守门器就是这么派生它的)必须真打印末行 —— 防守卫把主流程一起吞掉变假绿;
 *   MU1/MU2/MU3 变异自证:放宽成恒真、摘掉未判定那一支、收紧成恒假,三支变异后**对应用例必失效**,
 *      而生产面的反向断言把「削牙不可接受」锁在这里(后来者动判据 ⇒ 本文件当场翻红);
 *   G1 已知缺口(只钉事实,不判对错,交另派修法席):整张扫描面取不到时 `git ls-files` 退 0 且零输出
 *      ⇒ `scan` 得空集 ⇒ `report([])` 现读退 **0(绿)**,而 §0.3 要求「枚举到 0 个候选 = 判死,不记绿」;
 *      门里 `listTrackedScripts` 的 `if (!buf) return []` 那一支结构上到不了(空输出是**真值 Buffer**;
 *      git 真失败则因 allowFail=false 直接抛错 ⇒ CLI 退 1,也不是 2)。
 *
 * 刻意不碰的两格(属别票射程):`deploy/**` 的 `.ps1` 不吃 `#requires -Version 7` pragma(§27,
 * 真判据在调用侧),BOM 与目录无关 —— 本门对 deploy/** 没有例外档,测试也不替它新增例外断言。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test, { after, before } from 'node:test'

import { __test__ as gate } from '../check-ps1-bom.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const GATE_PATH = join(import.meta.dirname, '..', 'check-ps1-bom.mjs')
const GATE_SRC = readFileSync(GATE_PATH, 'utf8')
const REPO_ROOT = join(import.meta.dirname, '..', '..')

// BOM 三字节单源取自门体(§22c:测试里再抄一份 [0xef,0xbb,0xbf] 就是第二条真相)。
const BOM = Buffer.from(gate.BOM)
const bomText = (t) => Buffer.concat([BOM, Buffer.from(t, 'utf8')])
const rawText = (t) => Buffer.from(t, 'utf8')

const scratchDirs = []
const mk = (prefix) => {
  const dir = mkScratch(prefix)
  scratchDirs.push(dir)
  return dir
}

function gitRun(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    // §12g:派生 git 必须显式接管 stdio。
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * 一张面把四型全覆盖(门体扫描的是**索引清单 + 工作树内容**,所以红绿两向都得真造出来):
 *   d/good.ps1   带 BOM、已提交                ⇒ ok
 *   d/keep.psm1  带 BOM、已提交                ⇒ ok(证明 .psm1 在射程内)
 *   d/other.ps1  无 BOM、HEAD 也没有           ⇒ existing(存量,只报数)
 *   d/fresh.ps1  无 BOM、不在 HEAD(新入库)   ⇒ new-violation(新增缺)
 *   d/reg.ps1    HEAD 带 BOM、工作树被剥掉     ⇒ regressed(本次弄掉)
 *   d/gone.ps1   索引里有、盘上没了             ⇒ undetermined(取不到内容)
 *   d/note.txt   无 BOM、不是 .ps1/.psm1        ⇒ 不参与判定(T3)
 */
function buildFixture() {
  const dir = mk('ps1bom-fx-')
  gitRun(dir, ['init', '-q'])
  gitRun(dir, ['config', 'user.email', 'fixture@invalid'])
  gitRun(dir, ['config', 'user.name', 'fixture'])
  mkdirSync(join(dir, 'd'), { recursive: true })
  writeFileSync(join(dir, 'd/good.ps1'), bomText('Write-Output 1\n'))
  writeFileSync(join(dir, 'd/keep.psm1'), bomText('Write-Output 2\n'))
  writeFileSync(join(dir, 'd/other.ps1'), rawText('Write-Output 3\n'))
  writeFileSync(join(dir, 'd/reg.ps1'), bomText('Write-Output 4\n'))
  writeFileSync(join(dir, 'd/gone.ps1'), bomText('Write-Output 5\n'))
  writeFileSync(join(dir, 'd/note.txt'), rawText('no bom, out of scope\n'))
  gitRun(dir, ['add', '-A'])
  gitRun(dir, ['commit', '-q', '-m', 'base'])
  // 新增件:不在 HEAD,已进索引,盘上无 BOM。
  writeFileSync(join(dir, 'd/fresh.ps1'), rawText('Write-Output 6\n'))
  gitRun(dir, ['add', 'd/fresh.ps1'])
  // 本次把 BOM 弄掉。
  writeFileSync(join(dir, 'd/reg.ps1'), rawText('Write-Output 4\n'))
  // 取不到内容:索引仍列它,工作树副本删掉。
  rmSync(join(dir, 'd/gone.ps1'))
  return dir
}

let fx
before(() => {
  fx = buildFixture()
})
after(() => {
  for (const d of scratchDirs) rmScratch(d, { bestEffort: true })
})

/** 跑一次 report 并回收它打印的每一行(参数 = 判定链出口对象:生产 gate 或变异体 __test__)。 */
function runReport(api, rows, opts = {}) {
  const lines = []
  const orig = console.log
  console.log = (...a) => lines.push(a.join(' '))
  let exit
  try {
    exit = api.report(rows, opts)
  } finally {
    console.log = orig
  }
  return { exit, lines }
}

/** 从捕获行里拆出 --json 档的对象与末行读数(JSON.stringify(…,null,2) 是一次多行打印)。 */
function parseJsonRun(run) {
  const flat = run.lines
    .join('\n')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
  const start = flat.findIndex((l) => l.trim() === '{')
  assert.ok(start >= 0, 'report({json:true}) 没打印 JSON ⇒ 点名面无从核对')
  let end = -1
  for (let i = flat.length - 1; i > start; i--) {
    if (flat[i].trim() === '}') {
      end = i
      break
    }
  }
  assert.ok(end > start, 'JSON 块没有收口花括号 ⇒ 输出形态变了,先看门体')
  return {
    json: JSON.parse(flat.slice(start, end + 1).join('\n')),
    tail: flat[flat.length - 1],
    all: flat,
  }
}

const verdicts = (rows) => Object.fromEntries(rows.map((r) => [r.path, r.verdict]))

/** 一把跑完:返回 { exit, json, tail, all },免得把 run 与 parsed 两层对象混用。 */
function reportJson(api, rows, extra = {}) {
  const run = runReport(api, rows, { json: true, ...extra })
  return { ...parseJsonRun(run), exit: run.exit }
}

test('T1 带 BOM ⇒ 合规(ok),并含首三字节边界的正反对照', () => {
  const rows = gate.scan({ cwd: fx })
  const v = verdicts(rows)
  assert.equal(v['d/good.ps1'], 'ok')
  assert.equal(v['d/keep.psm1'], 'ok')
  // 生产 hasBom 的边界:恰好 3 字节、不足 3 字节、前缀错位。
  assert.equal(gate.hasBom(BOM), true)
  assert.equal(gate.hasBom(Buffer.from([BOM[0], BOM[1]])), false)
  assert.equal(gate.hasBom(Buffer.alloc(0)), false)
  assert.equal(gate.hasBom(rawText('Write-Output')), false)
  assert.equal(gate.classify({ worktreeBom: true, headBom: undefined }), 'ok')
})

test('T2 无 BOM ⇒ 判红并点名(新增缺 / 本次弄掉两支),存量那支只报数不判红', () => {
  const rows = gate.scan({ cwd: fx })
  const v = verdicts(rows)
  assert.equal(v['d/fresh.ps1'], 'new-violation')
  assert.equal(v['d/reg.ps1'], 'regressed')
  assert.equal(v['d/other.ps1'], 'existing')

  const red = reportJson(gate, rows)
  assert.equal(red.exit, 1)
  assert.deepEqual(
    red.json.added.map((r) => r.path),
    ['d/fresh.ps1'],
  )
  assert.deepEqual(
    red.json.regressed.map((r) => r.path),
    ['d/reg.ps1'],
  )
  // 末行读数与分桶同源:新增缺 = 弄掉 + 新增。
  assert.match(red.tail, /新增缺=2 未判定=1 档=ratchet exit=1$/)
  // 点名必须带首三字节读数(修的人靠它判断是被剥了还是压根没写);读数出自生产出口,不重算。
  assert.equal(red.json.added[0].first3, gate.firstBytes(rawText('Write-Output 6\n')))
  assert.notEqual(red.json.added[0].first3, Buffer.from(gate.BOM).toString('hex'))

  // 文本档也必须逐条点名(不是只报一个数)。
  const txt = runReport(gate, rows, {})
  assert.ok(
    txt.lines.some((l) => l.includes('新增 .ps1 没有 BOM')),
    '文本档缺新增点名行',
  )
  assert.ok(
    txt.lines.some((l) => l.includes('本次改动把 BOM 弄掉了')),
    '文本档缺回退点名行',
  )
  assert.ok(txt.lines.some((l) => l.includes('d/fresh.ps1')))
  assert.ok(txt.lines.some((l) => l.includes('d/reg.ps1')))

  // 正向对照:同一批行里只留存量(HEAD 也没有)时**必须 0**——否则本门就是恒红门(§12e)。
  const onlyExisting = rows.filter((r) => r.verdict === 'existing')
  assert.equal(onlyExisting.length, 1)
  const g = reportJson(gate, onlyExisting)
  assert.equal(g.exit, 0, '存量缺 BOM 被判红 = 恒红门')
  assert.equal(g.json.existingCount, 1)
  // 只有把档位切到 strict(存量归零后才允许升的那一档)才该因存量红。
  assert.equal(reportJson(gate, onlyExisting, { strict: true }).exit, 1)
})

test('T3 非 .ps1/.psm1 ⇒ 根本不进判定行(没扫到绝不写成合规)', () => {
  const rows = gate.scan({ cwd: fx })
  const paths = rows.map((r) => r.path)
  assert.ok(!paths.includes('d/note.txt'), '射程外的 .txt 被扫进来了')
  assert.ok(rows.every((r) => /\.(ps1|psm1)$/.test(r.path)))
  // 「没扫到」不等于「合规」:note.txt 无 BOM,而 ok 桶里也没有它。
  const okPaths = gate
    .scan({ cwd: fx })
    .filter((r) => r.verdict === 'ok')
    .map((r) => r.path)
  assert.ok(!okPaths.includes('d/note.txt'))
  // 清单面确实少收了它:索引里的跟踪文件比判定行多(多出来的就是射程外文件)。
  const tracked = gitRun(fx, ['ls-files']).trim().split(/\r?\n/).length
  assert.equal(rows.length, 6) // 5 枚 .ps1 + 1 枚 .psm1
  assert.equal(tracked, 7) // 多出来的那一枚就是 d/note.txt
  assert.ok(rows.length < tracked)
  // 清单本身也由生产出口给(不在测试里重述 pathspec)。
  assert.deepEqual(gate.listTrackedScripts(fx).sort(), [
    'd/fresh.ps1',
    'd/gone.ps1',
    'd/good.ps1',
    'd/keep.psm1',
    'd/other.ps1',
    'd/reg.ps1',
  ])
})

test('T4 取不到内容 ⇒ 未判定档:exit 2、点名、既不记绿也不冒红(§0.3)', () => {
  const rows = gate.scan({ cwd: fx })
  const v = verdicts(rows)
  assert.equal(v['d/gone.ps1'], 'undetermined')
  const run = reportJson(gate, rows)
  assert.deepEqual(run.json.undetermined, ['d/gone.ps1'])
  // 退码优先级:同一批行里既有红又有未判定时,**红优先**(退 1)—— 这格也得钉住,否则
  // 「未判定」会被读成已通过或被读成判红,两种都是 §0.3 禁的写法。
  assert.equal(run.exit, 1)
  // 只剩合规 + 未判定 ⇒ 必须是 2:不记绿(0)也不冒红(1)。
  const onlyUndetermined = rows.filter((r) => r.verdict === 'undetermined' || r.verdict === 'ok')
  const u = reportJson(gate, onlyUndetermined)
  assert.equal(u.exit, 2)
  assert.equal(u.json.undetermined.length, 1)
  assert.match(u.tail, /未判定=1 档=ratchet exit=2$/)
  // 未判定必须逐条点名(§0.3「显式未判定并点名原因」)。
  const txt = runReport(gate, onlyUndetermined, {})
  assert.ok(txt.lines.some((l) => l.includes('读不到内容、判不了') && l.includes('未判定')))
  assert.ok(
    txt.lines.some((l) => l.includes('d/gone.ps1')),
    '未判定没点名 = 把判不了藏进总数里',
  )

  // 纯判据面:取不到时不得回落成任何一种猜测。
  assert.equal(gate.classify({ worktreeBom: null, headBom: true }), 'undetermined')
  assert.equal(gate.classify({ worktreeBom: null, headBom: false }), 'undetermined')
  assert.equal(gate.classify({ worktreeBom: null, headBom: undefined }), 'undetermined')
  // 读不到 ⇒ null,不是 false(把「没读到」当「没 BOM」就是拿猜测定判红)。
  assert.equal(gate.readSurface(fx, 'd/not-there.ps1', 'worktree'), null)
  assert.equal(gate.readSurface(fx, 'd/good.ps1', 'worktree') !== null, true)
  // HEAD 面的三态:null≠undefined —— 新增件与「HEAD 里也没有」必须分得开。
  assert.equal(gate.readHead(fx, 'd/fresh.ps1'), undefined)
  assert.equal(gate.readHead(fx, 'd/other.ps1'), false)
  assert.equal(gate.readHead(fx, 'd/good.ps1'), true)
})

test('T5 形状锁:§22d 守卫 + __test__ 导出的就是真实判定链', () => {
  // 守卫形态(§22d 红线:手拼 'file:///' + argv[1] 在 Windows 永不成立)。
  assert.match(GATE_SRC, /pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(GATE_SRC, /if \(isDirectRun\) \{/)
  assert.ok(!GATE_SRC.includes("'file:///' + process.argv[1]"))
  // 导出口齐备且指向函数本体(不是包装),否则「摘掉一支」测试不会红 = 自证据是假的。
  for (const key of [
    'BOM',
    'hasBom',
    'classify',
    'scan',
    'report',
    'listTrackedScripts',
    'readSurface',
    'readHead',
    'firstBytes',
  ]) {
    assert.ok(key in gate, `__test__ 缺键 ${key}`)
  }
  assert.equal(gate.classify.name, 'classify')
  assert.equal(gate.hasBom.name, 'hasBom')
  assert.equal(gate.scan.name, 'scan')
  // firstBytes 也是生产出口给(点名读数不在测试里重算)。
  assert.equal(gate.firstBytes(bomText('x')), Buffer.from(gate.BOM).toString('hex'))
  assert.equal(gate.firstBytes(Buffer.alloc(0)), '(空)')
})

test('T6 装车锁:CLI 直跑(守门器的派生形态)必须真打印末行', () => {
  // 守门器按 spawn(process.execPath, ['scripts/<script>']) 相对路径派生;守卫写歪就会
  // 静默什么都不做并退 0 —— 那是假绿,必须用「末行在不在」来量。
  const out = execFileSync(process.execPath, ['scripts/check-ps1-bom.mjs', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const tail = out.trim().split(/\r?\n/).at(-1)
  assert.match(
    tail,
    /^\[ps1-bom\] 末行:.*扫描=\d+ 带BOM=\d+ 存量缺=\d+ 新增缺=\d+ 未判定=\d+ 档=(ratchet|strict) exit=[012]$/,
  )
  // 内部一致性:末行三个读数必须等于 JSON 桶(读数与分桶不得出自两套账)。
  const body = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)
  const json = JSON.parse(body)
  const m = tail.match(/扫描=(\d+) 带BOM=(\d+) 存量缺=(\d+) 新增缺=(\d+) 未判定=(\d+)/)
  assert.equal(Number(m[1]), json.scanned)
  assert.equal(Number(m[2]), json.ok)
  assert.equal(Number(m[3]), json.existingCount)
  assert.equal(Number(m[4]), json.regressed.length + json.added.length)
  assert.equal(Number(m[5]), json.undetermined.length)
})

// ── 变异自证:把生产判据逐支削掉,对应用例必须失效 ──────────────────────────

let mutantSeq = 0
/** 用**门体源码**做一次定向变异,落 scratch(绝不落仓库树,门 208),再 import 那一份的判定链。 */
async function mutant(from, to, label) {
  assert.ok(
    GATE_SRC.includes(from),
    `变异锚点在门体源码里找不到(「${label}」):判据已被改写,变异自证会退化成假证,先修测试再谈别的`,
  )
  const text = GATE_SRC.replace(from, to)
  assert.notEqual(text, GATE_SRC, `变异未落地(「${label}」)= 什么都没测`)
  if (to === '') assert.ok(!text.includes(from), `变异后原判据仍在(「${label}」)`)
  const dir = mk(`ps1bom-mut-${label}-`)
  const file = join(dir, `mutant-${mutantSeq++}.mjs`)
  writeFileSync(file, text)
  const mod = await import(pathToFileURL(file).href)
  return mod.__test__
}

const HASBOM_BODY =
  'return buf.length >= 3 && buf[0] === BOM[0] && buf[1] === BOM[1] && buf[2] === BOM[2]'
const UNDET_BRANCH = "  if (worktreeBom === null) return 'undetermined'\n"

test('MU1 变异「BOM 判定放宽成恒真」⇒ 无 BOM 的新增件不再红(该形态不可接受,由生产面反向断言锁死)', async () => {
  const rows = gate.scan({ cwd: fx })
  // 生产面(锁):这一支被谁放宽,本行当场翻红 —— 「把判定面放宽成恒真 ⇒ 夹具不再红」不可接受。
  const prod = reportJson(gate, rows)
  assert.equal(prod.exit, 1)
  assert.equal(prod.json.added.length, 1)
  assert.equal(verdicts(rows)['d/fresh.ps1'], 'new-violation')

  const api = await mutant(HASBOM_BODY, 'return buf.length >= 0', 'always-true')
  const mRows = api.scan({ cwd: fx })
  const v = verdicts(mRows)
  assert.equal(v['d/fresh.ps1'], 'ok', '变异体反而还判红 ⇒ 变异没生效,自证是空的')
  assert.equal(v['d/reg.ps1'], 'ok')
  const m = reportJson(api, mRows)
  assert.equal(m.json.added.length + m.json.regressed.length, 0)
})

test('MU2 变异「摘掉 worktreeBom===null 那一支」⇒ 未判定档消失(T4 用例必失效)', async () => {
  const api = await mutant(UNDET_BRANCH, '', 'no-undetermined')
  const mRows = api.scan({ cwd: fx })
  const v = verdicts(mRows)
  // 生产面(锁):取不到内容就是未判定。
  assert.equal(verdicts(gate.scan({ cwd: fx }))['d/gone.ps1'], 'undetermined')
  assert.notEqual(v['d/gone.ps1'], 'undetermined')
  assert.ok(
    ['regressed', 'existing', 'new-violation', 'ok'].includes(v['d/gone.ps1']),
    `未判定被读成了「${v['d/gone.ps1']}」= 拿猜测定判红/判绿(§0.3)`,
  )
  // 且退码不再是 2:要么冒充通过(0)要么冒充判红(1)。
  const m = reportJson(api, mRows)
  assert.notEqual(m.exit, 2)
  assert.deepEqual(m.json.undetermined, [])
})

test('MU3 变异「收紧成恒假(一律当无 BOM)」⇒ 合规用例翻红,本门变恒红门(§12e)', async () => {
  const api = await mutant(HASBOM_BODY, 'return false', 'always-false')
  const rows = api.scan({ cwd: fx })
  const v = verdicts(rows)
  // 生产面(锁):带 BOM 的两枚必须 ok。
  assert.equal(verdicts(gate.scan({ cwd: fx }))['d/good.ps1'], 'ok')
  assert.notEqual(v['d/good.ps1'], 'ok')
  const m = reportJson(api, rows)
  assert.equal(m.json.ok, 0)
  assert.equal(m.exit, 1)
})

test('G1 已知缺口(只钉事实、不判对错,交另派修法席):整张面取不到 = 空集 + exit 0,而非 §0.3 的「枚举到 0 判死不记绿」', () => {
  const bare = mk('ps1bom-nogit-') // .DevEnv 的坏 gitfile 边界 ⇒ 这里根本不是 git 面
  assert.deepEqual(gate.listTrackedScripts(bare), [])
  const rows = gate.scan({ cwd: bare })
  assert.deepEqual(rows, [])
  // 现读:零候选 / 面取不到时 report 仍退 0(绿)。git ls-files 在这种面上退 0 且零输出,
  // 而门没有「枚举到 0 ⇒ 未判定」那一档(listTrackedScripts 的 `if (!buf) return []` 是到不了的分支:
  // 空输出是**真值 Buffer**,不是 null;git 真失败则因 allowFail=false 直接抛错 ⇒ CLI 退 1)。
  // 这一格不在本票射程(本票只补 §22c 第①②步、不改判据语义),故只把事实钉在这里。
  const empty = reportJson(gate, rows)
  assert.equal(empty.exit, 0)
  assert.equal(empty.json.scanned, 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
