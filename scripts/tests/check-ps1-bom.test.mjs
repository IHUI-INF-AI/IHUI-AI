// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 `check-ps1-bom.mjs`(.ps1/.psm1 必须 UTF-8 with BOM)的**镜像测试**(§22c 第②步)。
 *
 * 立票:该门 2026-10-27 接入提交链时现读 `--self-test` 档在,而 `__test__` 导出口与镜像测试缺失
 * —— 由上一席补齐(只补 §22c 第①②步、不改判据语义)。**本席是判据修法席**:上一席现读出四处
 * 判据本身的问题(① 整面取不到退 0 绿;② 未判定与红并存时未判定不进退出码;③ 门体 selfTest
 * 夹具落 os.tmpdir()+git init;④ 头注静态存量数字),本文件随之把语义从「红优先 1」翻到
 * 「**未判定优先 2**」—— 这是**改被钉的语义并逐条重钉**,不是为转绿删断言:每一处原断言都在
 * 新语义下给出了更强的对应断言(红行照必须逐条点名、红档 1 必须仍可达、恒真变异必须仍失效)。
 *
 * 钉死的事(例数以 `node --test` 末行现读为准):
 *   T1 带 BOM ⇒ 合规(ok),含首三字节边界的正反对照;
 *   T2 无 BOM ⇒ 判红并点名(新增缺 / 本次弄掉两支各自点名),并留**存量只报数不判红**的正向对照
 *      (§12e:把存量也拦就是恒红门);修法席②后:混合面上 exit=2,但**去掉未判定维的同一批红
 *      必须仍 exit=1** —— 红档没被排序洗掉;
 *   T3 非 .ps1/.psm1 ⇒ **不进判定行**——「没扫到」绝不写成「合规」;readTrackedList 三态的
 *      「清单非空 ⇒ 面 ok」也在这里钉;
 *   T4 单文件取不到内容 ⇒ 未判定档:逐条点名(stdout **与 stderr** 两面都要有,runner 侧
 *      detectUndetermined 只读 stderr),修法席②:与红并存 ⇒ exit 2(旧版退 1 把「有一维没量到」
 *      藏进退出码;红行在报告面一条不少);
 *   T5 形状锁:§22d 守卫形态、__test__ 导出真实判定链(新增 readTrackedList)、修法席③的夹具
 *      落点锁(门体源码不得再出现 mkdtempSync(/tmpdir(,必须 import scratch-dir)、
 *      修法席①②的排序锁(`unjudged > 0 ? 2 : red ? 1 : 0` 在源码里,旧恒空分支 `if (!buf)` 不得回潮);
 *   T6 装车锁:CLI 直跑必须真打印末行,且三个读数与 JSON 桶同源(未判定读数 = 单枚 + 面维);
 *   MU1/MU2/MU3 变异自证:放宽成恒真、摘掉未判定那一支、收紧成恒假,三支变异后**对应用例必失效**;
 *      MU1 的生产反向锁「恒真不可接受」原样保留(红切片必须 exit 1,变异体必须 exit 0);
 *   G1 修法席①已闭合:整张面取不到(两把清单都枚举到 0)⇒ **exit 2 并点名是哪张面、为什么**,
 *      不再退 0 绿(§0.3);反恒红对照:有效面 + 真零 .ps1 ⇒ 必须 0(§12e,干净仓不许被空扫判死);
 *   FT-B 干净且有 BOM ⇒ exit 0(绿向真跑,不是装饰);
 *   FT-C 有新增缺 ⇒ exit 1(红向真跑,面上每一维都量到时红档可达);
 *   FT-E 子进程实证:与执行器同形的「spawn node 跑门体并读 status/stderr」——exit 2 那一次
 *      子进程 stderr 必须自带「未判定」字样(gate-failure-kind 第五档的取信面)。
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
import { maskComments } from '../lib/code-mask.mjs'

const GATE_PATH = join(import.meta.dirname, '..', 'check-ps1-bom.mjs')
const GATE_SRC = readFileSync(GATE_PATH, 'utf8')
// 判"源码里还有没有某形态"必须剥注释(§0 遮罩纪律:判代码结构的门注释与字符串都遮),
// 否则一句"旧版走 os.tmpdir()"的履历注记就把它自己判红 —— 那是尺子读错面,不是回潮。
const GATE_CODE = maskComments(GATE_SRC)
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

/**
 * 跑一次 report 并**分别**回收 stdout 与 stderr(参数 = 判定链出口对象:生产 gate 或变异体)。
 * 修法席②之后 stderr 不是可选装饰:执行器侧 detectUndetermined 只读 stderr,
 * 未判定的自我声明若没落 stderr,exit 2 会被读成「判据判红(exit 2)」= 把"没判"写成"判过"。
 */
function runReport(api, result, opts = {}) {
  const lines = []
  const errLines = []
  const orig = console.log
  const origErr = process.stderr.write
  console.log = (...a) => lines.push(a.join(' '))
  process.stderr.write = (chunk) => {
    errLines.push(String(chunk))
    return true
  }
  let exit
  try {
    exit = api.report(result, opts)
  } finally {
    console.log = orig
    process.stderr.write = origErr
  }
  return { exit, lines, errLines }
}

/** 从捕获的 stdout 行里拆出 --json 档的对象与末行读数(JSON.stringify(…,null,2) 是一次多行打印)。 */
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

/** 一把跑完:返回 { exit, json, tail, all, errLines },免得把 run 与 parsed 两层对象混用。 */
function reportJson(api, result, extra = {}) {
  const run = runReport(api, result, { json: true, ...extra })
  return { ...parseJsonRun(run), exit: run.exit, errLines: run.errLines }
}

test('T1 带 BOM ⇒ 合规(ok),并含首三字节边界的正反对照', () => {
  const { rows } = gate.scan({ cwd: fx })
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

test('T2 无 BOM ⇒ 判红并点名(新增缺 / 本次弄掉两支),存量只报数;混合面 exit=2、红切片 exit=1(修法席②)', () => {
  const result = gate.scan({ cwd: fx })
  const rows = result.rows
  const v = verdicts(rows)
  assert.equal(v['d/fresh.ps1'], 'new-violation')
  assert.equal(v['d/reg.ps1'], 'regressed')
  assert.equal(v['d/other.ps1'], 'existing')

  // 完整面(含 undetermined 那一枚):按新排序 exit=2,但**红两条必须照点名**。
  const red = reportJson(gate, result)
  assert.equal(red.exit, 2)
  assert.deepEqual(
    red.json.added.map((r) => r.path),
    ['d/fresh.ps1'],
  )
  assert.deepEqual(
    red.json.regressed.map((r) => r.path),
    ['d/reg.ps1'],
  )
  assert.match(red.tail, /面状态=ok.*新增缺=2 未判定=1 档=ratchet exit=2$/)
  // 点名必须带首三字节读数(修的人靠它判断是被剥了还是压根没写);读数出自生产出口,不重算。
  assert.equal(red.json.added[0].first3, gate.firstBytes(rawText('Write-Output 6\n')))
  assert.notEqual(red.json.added[0].first3, Buffer.from(gate.BOM).toString('hex'))

  // 红档 1 没被排序洗掉:去掉未判定维,同一批红必须 exit=1(排序锁的反向半边)。
  const redOnly = rows.filter((r) => r.verdict !== 'undetermined')
  const rOnly = reportJson(gate, redOnly)
  assert.equal(rOnly.exit, 1)
  assert.match(rOnly.tail, /新增缺=2 未判定=0 档=ratchet exit=1$/)

  // 文本档也必须逐条点名(不是只报一个数),未判定并存时红行一条不少。
  const txt = runReport(gate, result, {})
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

test('T3 非 .ps1/.psm1 ⇒ 根本不进判定行;清单非空时 readTrackedList 判面 ok(修法席①的正向半边)', () => {
  const { rows } = gate.scan({ cwd: fx })
  const paths = rows.map((r) => r.path)
  assert.ok(!paths.includes('d/note.txt'), '射程外的 .txt 被扫进来了')
  assert.ok(rows.every((r) => /\.(ps1|psm1)$/.test(r.path)))
  // 「没扫到」不等于「合规」:note.txt 无 BOM,而 ok 桶里也没有它。
  const okPaths = gate
    .scan({ cwd: fx })
    .rows.filter((r) => r.verdict === 'ok')
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
  // readTrackedList 的三态之一:射程清单非空 ⇒ 面 ok,listed = 枚数(不需要问全量)。
  const det = gate.readTrackedList(fx)
  assert.equal(det.face.ok, true)
  assert.equal(det.face.listed, 6)
  assert.equal(det.face.total, null)
})

test('T4 取不到内容 ⇒ 未判定档:与红并存也退 2(修法席②排序翻转,红照点名),stdout+stderr 双向点名(§0.3)', () => {
  const result = gate.scan({ cwd: fx })
  const rows = result.rows
  const v = verdicts(rows)
  assert.equal(v['d/gone.ps1'], 'undetermined')
  const run = reportJson(gate, result)
  assert.deepEqual(run.json.undetermined, ['d/gone.ps1'])
  // 修法席②(2026-10-27):既有红又有未判定时 **2 优先**(旧版红优先退 1,
  // 「有一维根本没量到」在退出码上不可见)。红没被洗:added/regressed 两条照点名(T2 同源钉)。
  assert.equal(run.exit, 2)
  // 排序翻转的另一半边:只剩合规 + 未判定 ⇒ 同样是 2(这一支旧版就成立,保持)。
  const onlyUndetermined = rows.filter((r) => r.verdict === 'undetermined' || r.verdict === 'ok')
  const u = reportJson(gate, onlyUndetermined)
  assert.equal(u.exit, 2)
  assert.equal(u.json.undetermined.length, 1)
  assert.match(u.tail, /未判定=1 档=ratchet exit=2$/)
  // 未判定必须逐条点名(§0.3「显式未判定并点名原因」),且 stderr 也得有(执行器只读 stderr)。
  const txt = runReport(gate, onlyUndetermined, {})
  assert.ok(txt.lines.some((l) => l.includes('读不到内容、判不了') && l.includes('未判定')))
  assert.ok(
    txt.lines.some((l) => l.includes('d/gone.ps1')),
    '未判定没点名 = 把判不了藏进总数里',
  )
  assert.ok(
    txt.errLines.some((l) => l.includes('未判定') && l.includes('d/gone.ps1')),
    'exit 2 的未判定声明没落 stderr ⇒ 会被执行器读成「判据判红(exit 2)」(§0.3 把没判写成判过)',
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

test('T5 形状锁:§22d 守卫 + __test__ 导出真实判定链 + 修法席①②③的源码形态锁', () => {
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
    'readTrackedList',
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
  assert.equal(gate.readTrackedList.name, 'readTrackedList')
  // firstBytes 也是生产出口给(点名读数不在测试里重算)。
  assert.equal(gate.firstBytes(bomText('x')), Buffer.from(gate.BOM).toString('hex'))
  assert.equal(gate.firstBytes(Buffer.alloc(0)), '(空)')
  // 修法席③夹具落点锁:门体源码不得再出现进程 TEMP 落点(§15b/§26 唯一出口)。
  assert.ok(!GATE_CODE.includes('mkdtempSync('), 'mkdtempSync 回潮 = 绕开 §15b 唯一落点')
  assert.ok(!GATE_CODE.includes('tmpdir('), 'tmpdir( 回潮 = 选址交给进程 TEMP')
  assert.ok(!GATE_CODE.includes("from 'node:os'"), "node:os import 必须随 tmpdir 一起摘掉")
  assert.match(GATE_CODE, /from '\.\/lib\/scratch-dir\.mjs'/)
  // 修法席①②的排序与空集判死锁:摘掉任何一支,对应用例(G1/T2/T4)必失效。
  assert.match(GATE_SRC, /unjudged > 0 \? 2 : red \? 1 : 0/)
  assert.ok(!GATE_CODE.includes('if (!buf) return []'), '旧"结构上到不了"的恒空分支不得回潮(修法席①)')
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
    /^\[ps1-bom\] 末行:面=(text|json) 面状态=(ok|未判定) 扫描=\d+ 带BOM=\d+ 存量缺=\d+ 新增缺=\d+ 未判定=\d+ 档=(ratchet|strict) exit=[012]$/,
  )
  // 真仓面必须健康:HEAD 就在、77 枚在册 ⇒ 面状态=ok(不写第四个数,也不允许取不到)。
  assert.match(tail, /面状态=ok/)
  // 内部一致性:末行读数必须等于 JSON 桶(读数与分桶不得出自两套账);
  // 未判定读数 = 单枚取不到 + 面维取不到(修法席①后两者合并在同一格报数)。
  const body = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)
  const json = JSON.parse(body)
  const m = tail.match(/扫描=(\d+) 带BOM=(\d+) 存量缺=(\d+) 新增缺=(\d+) 未判定=(\d+)/)
  assert.equal(Number(m[1]), json.scanned)
  assert.equal(Number(m[2]), json.ok)
  assert.equal(Number(m[3]), json.existingCount)
  assert.equal(Number(m[4]), json.regressed.length + json.added.length)
  assert.equal(
    Number(m[5]),
    json.undetermined.length + (json.face && json.face.ok === false ? 1 : 0),
  )
  assert.equal(json.face.ok, true, 'ROOT 面取不到时本锁就该翻红,而不是放行')
})

// ── 变异自证:把生产判据逐支削掉,对应用例必须失效 ──────────────────────────

let mutantSeq = 0
/** 用**门体源码**做一次定向变异,落 scratch(绝不落仓库树,门 208),再 import 那一份的判定链。 */
async function mutant(from, to, label) {
  assert.ok(
    GATE_SRC.includes(from),
    `变异锚点在门体源码里找不到(「${label}」):判据已被改写,变异自证会退化成假证,先修测试再谈别的`,
  )
  // 变异件落 scratch 后,门体里对 `./lib/scratch-dir.mjs` 的相对 import 会指向 scratch 的
  // 影子路径(目录不存在 ⇒ ERR_MODULE_NOT_FOUND,变异自证退化成"夹具坏了")。改写为真仓绝对
  // URL:测的仍是**生产判据本体**,只是把它的依赖钉回装车位置。
  const SCRATCH_IMPORT = "from './lib/scratch-dir.mjs'"
  const scratchAbs = `from '${pathToFileURL(join(REPO_ROOT, 'scripts', 'lib', 'scratch-dir.mjs')).href}'`
  const text = GATE_SRC.split(SCRATCH_IMPORT)
    .join(scratchAbs)
    .replace(from, to)
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

test('MU1 变异「BOM 判定放宽成恒真」⇒ 无 BOM 的新增件不再红(恒真不可接受,由生产面反向断言锁死)', async () => {
  const rows = gate.scan({ cwd: fx }).rows
  // 生产面(锁):红切片必须 exit 1 —— 这一支被谁放宽,本行当场翻红(排序不影响这条锁)。
  const redOnly = rows.filter((r) => r.verdict !== 'undetermined')
  const prod = reportJson(gate, redOnly)
  assert.equal(prod.exit, 1)
  assert.equal(prod.json.added.length, 1)
  assert.equal(verdicts(rows)['d/fresh.ps1'], 'new-violation')

  const api = await mutant(HASBOM_BODY, 'return buf.length >= 0', 'always-true')
  const mRows = api.scan({ cwd: fx }).rows
  const v = verdicts(mRows)
  assert.equal(v['d/fresh.ps1'], 'ok', '变异体反而还判红 ⇒ 变异没生效,自证是空的')
  assert.equal(v['d/reg.ps1'], 'ok')
  const m = reportJson(api, mRows.filter((r) => r.verdict !== 'undetermined'))
  assert.equal(m.exit, 0)
  assert.equal(m.json.added.length + m.json.regressed.length, 0)
})

test('MU2 变异「摘掉 worktreeBom===null 那一支」⇒ 未判定档消失(T4 用例必失效)', async () => {
  const api = await mutant(UNDET_BRANCH, '', 'no-undetermined')
  const mRows = api.scan({ cwd: fx }).rows
  const v = verdicts(mRows)
  // 生产面(锁):取不到内容就是未判定。
  assert.equal(verdicts(gate.scan({ cwd: fx }).rows)['d/gone.ps1'], 'undetermined')
  assert.notEqual(v['d/gone.ps1'], 'undetermined')
  assert.ok(
    ['regressed', 'existing', 'new-violation', 'ok'].includes(v['d/gone.ps1']),
    `未判定被读成了「${v['d/gone.ps1']}」= 拿猜测定判红/判绿(§0.3)`,
  )
  // 且未判定档整体消失:读数与退码都冒充"全都量到了"(排序 2 优先也救不回被摘的那一支)。
  const m = reportJson(api, api.scan({ cwd: fx }))
  assert.notEqual(m.exit, 2)
  assert.deepEqual(m.json.undetermined, [])
})

test('MU3 变异「收紧成恒假(一律当无 BOM)」⇒ 合规用例翻红,本门变恒红门(§12e)', async () => {
  const api = await mutant(HASBOM_BODY, 'return false', 'always-false')
  const rows = api.scan({ cwd: fx }).rows
  const v = verdicts(rows)
  // 生产面(锁):带 BOM 的两枚必须 ok。
  assert.equal(verdicts(gate.scan({ cwd: fx }).rows)['d/good.ps1'], 'ok')
  assert.notEqual(v['d/good.ps1'], 'ok')
  const m = reportJson(api, rows.filter((r) => r.verdict !== 'undetermined'))
  assert.equal(m.json.ok, 0)
  assert.equal(m.exit, 1)
})

test('G1(修法席①已闭合@2026-10-27)面取不到 ⇒ exit 2 并点名,不再退 0 绿;有效面真零 .ps1 ⇒ 仍 0(§12e 反恒红)', () => {
  // 面取不到的落点:裸 mkScratch 目录(.DevEnv 坏 gitfile 边界 ⇒ 不是 git 面,
  // 而 `git ls-files` 在这种面上退 0 且零输出 —— 改前正是这一支把 report 打成 0 绿的)。
  const bare = mk('ps1bom-nogit-')
  assert.deepEqual(gate.listTrackedScripts(bare), [])
  const res = gate.scan({ cwd: bare })
  assert.deepEqual(res.rows, [])
  assert.equal(res.face.ok, false, '两把清单都枚举到 0 ⇒ 必须判"面取不到",不得默认 ok')
  assert.ok(res.face.why, '未判定必须带原因(§0.3 点名)')
  const run = runReport(gate, res, {})
  assert.equal(run.exit, 2)
  assert.ok(
    run.lines.some((l) => l.includes('被审面取不到') && l.includes('未判定')),
    '面取不到没有点名"问的是哪张面、为什么"',
  )
  assert.ok(run.lines.some((l) => l.includes('未判定=1')), '末行的未判定读数没把面维计进去')
  assert.ok(
    run.errLines.some((l) => l.includes('未判定')),
    '面未判定没落 stderr ⇒ 执行器 detectUndetermined 读不到,exit 2 会被写成「判据判红」',
  )
  // 反恒红对照(§12e):有效面(有跟踪文件、只是没有 .ps1)必须 0 —— 空清单 ≠ 面取不到。
  const noPs = mk('ps1bom-nops-')
  gitRun(noPs, ['init', '-q'])
  gitRun(noPs, ['config', 'user.email', 'fixture@invalid'])
  gitRun(noPs, ['config', 'user.name', 'fixture'])
  writeFileSync(join(noPs, 'README.md'), '# 没有 PowerShell\n')
  gitRun(noPs, ['add', '-A'])
  gitRun(noPs, ['commit', '-q', '-m', 'base'])
  const res2 = gate.scan({ cwd: noPs })
  assert.equal(res2.face.ok, true)
  assert.equal(res2.face.total, 1)
  assert.equal(res2.rows.length, 0)
  assert.equal(reportJson(gate, res2).exit, 0, '干净仓 + 真零 .ps1 被拦 = 恒红门(§12e)')
})

test('FT-B 干净且有 BOM 的仓 ⇒ exit 0(绿向必须真出现,不是恒红装饰)', () => {
  const dir = mk('ps1bom-clean-')
  gitRun(dir, ['init', '-q'])
  gitRun(dir, ['config', 'user.email', 'fixture@invalid'])
  gitRun(dir, ['config', 'user.name', 'fixture'])
  writeFileSync(join(dir, 'a.ps1'), bomText('Write-Output 1\n'))
  writeFileSync(join(dir, 'b.psm1'), bomText('Write-Output 2\n'))
  gitRun(dir, ['add', '-A'])
  gitRun(dir, ['commit', '-q', '-m', 'base'])
  const res = gate.scan({ cwd: dir })
  assert.equal(res.face.ok, true)
  assert.equal(res.rows.length, 2)
  assert.ok(res.rows.every((r) => r.verdict === 'ok'))
  const run = reportJson(gate, res)
  assert.equal(run.exit, 0)
  assert.match(run.tail, /面状态=ok 扫描=2 带BOM=2 存量缺=0 新增缺=0 未判定=0 档=ratchet exit=0$/)
})

test('FT-C 有新增缺(且每一维都量得到)⇒ exit 1(红档在 2-优先排序下仍可达)', () => {
  const dir = mk('ps1bom-red-')
  gitRun(dir, ['init', '-q'])
  gitRun(dir, ['config', 'user.email', 'fixture@invalid'])
  gitRun(dir, ['config', 'user.name', 'fixture'])
  writeFileSync(join(dir, 'good.ps1'), bomText('Write-Output 1\n'))
  gitRun(dir, ['add', '-A'])
  gitRun(dir, ['commit', '-q', '-m', 'base'])
  writeFileSync(join(dir, 'fresh.ps1'), rawText('Write-Output 2\n'))
  gitRun(dir, ['add', 'fresh.ps1'])
  const res = gate.scan({ cwd: dir })
  assert.equal(res.face.ok, true)
  const v = verdicts(res.rows)
  assert.equal(v['good.ps1'], 'ok')
  assert.equal(v['fresh.ps1'], 'new-violation')
  const run = reportJson(gate, res)
  assert.equal(run.exit, 1)
  assert.match(run.tail, /新增缺=1 未判定=0 档=ratchet exit=1$/)
  assert.deepEqual(
    run.json.added.map((r) => r.path),
    ['fresh.ps1'],
  )
})

test('FT-E 子进程实证:门按执行器同形被 spawn 时,exit 2 那一次子进程 stderr 必须自带「未判定」字样', () => {
  // gate-failure-kind 第五档(detectUndetermined)读的是**子进程 stderr**——
  // 同进程里 monkey-patch 抓到的写法证明不了跨进程那一跳,必须真 spawn 一次。
  const script = [
    "const m = await import('./scripts/check-ps1-bom.mjs')",
    "const s = await import('./scripts/lib/scratch-dir.mjs')",
    "const d = s.mkScratch('ps1bom-fte-')",
    "const rc = m.__test__.report(m.__test__.scan({ cwd: d }), {})",
    "s.rmScratch(d, { bestEffort: true })",
    'process.exit(rc)',
  ].join('\n')
  let res
  try {
    res = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    res = { status: 0, stdout: res, stderr: '' }
  } catch (e) {
    res = { status: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') }
  }
  assert.equal(res.status, 2, `面取不到必须退 2,现读 ${res.status}(0=旧假绿回潮,1=判红冒充未判定)`)
  assert.match(res.stderr, /未判定/, 'stderr 没有「未判定」声明 ⇒ 执行器会把它读成「判据判红(exit 2)」(§0.3)')
  assert.match(res.stdout, /面状态=未判定.*exit=2\s*$/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
