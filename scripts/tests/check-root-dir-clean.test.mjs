// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 44(根目录整洁)的镜像测试 —— 2026-09-27 随 G-268 补建(此前该门**完全没有测试**)。
 *
 * 它钉的不是"能不能发现乱放的根级文件"(那件事跑了两年多,一直好用),而是**归属判定**:
 *   本门的判定面一直是 `readdirSync(根目录)`,而 safe-commit 的差值基线在
 *   `git worktree add --detach` 出来的隔离检出里跑 —— 那里物理上没有未跟踪文件。
 *   两个面不可比,于是"别人留在根的在飞文件"被差分读成"这枚提交把跑绿的东西改红了"。
 *   实测 2026-09-27 10:36~12:08 十二次因此拒绝跳门,而每一次都不是提交者能合法修的
 *   (动别人的文件在本仓算事故),终态只能是脱账的手工提交。
 *
 * 所以每条用例都成对:**索引里有的违规必须仍是 exit 1**(修法不许变成逃逸通道),
 * **未跟踪的违规才是 exit 2**(仍然非零,仍拦得住 §28 的交付判据与 runner),
 * 且全量档的退出码一字未动。夹具走 `--root` 测试通道 —— 加它的理由不是便利,是守门 70
 * 那一型:靠 cwd 定位夹具而脚本按定义忽略 cwd 时,测试其实全在审真仓(13/14 恒红)。
 *
 * 2026-10-27 追加(T 族 + 变异自证②):同一门体把**红**与**未判定**拆成两个码位后,
 * 末行结论必须把三档**分别报数并点名**(折叠=把未判定偷算进红,正是 P8 旧锁撞上的形态,
 * 故 P8 的措辞锚点由"不得出现『存量』二字"换成"逐枚点名行不得出现『已在 HEAD』",牙的方向没变);
 * 全量档不得再出现"打印 ❌ 却 exit 0"那种自相矛盾(T5)。末行的期望值一律由门体导出的判据
 * (`decideOutcome`/`resultLine`/`partitionForReport`/`reportResultLine`)现算,测试不复制格式串。
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// §22c 单一真相源:末行的期望值由**门体导出的判据**算(decideOutcome/resultLine/partitionForReport),
// 测试不复制格式串与退出码表;未判定那一档的自述键也直接取归因层的常量(门与归因层共用一个字面量)。
import { __test__ as G44 } from '../check-root-dir-clean.mjs'
import { GATE_UNDETERMINED_MARK } from '../lib/commit-gate-attribution.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const GATE = join(here, '..', 'check-root-dir-clean.mjs')
const runnerSource = readFileSync(join(here, '..', 'guardian-runner.mjs'), 'utf8')

/** 造一棵最小 git 仓:只有 README.md 被跟踪 */
function makeRepo(name) {
  const dir = mkScratch(name)
  const git = (args) =>
    execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  git(['init', '-q'])
  git(['config', 'user.email', 'test@example.invalid'])
  git(['config', 'user.name', 'test'])
  writeFileSync(join(dir, 'README.md'), '# fixture\n')
  git(['add', 'README.md'])
  git(['commit', '-q', '-m', 'init'])
  return { dir, git }
}

/**
 * 本门把违规**报在 stderr**(退出码 0 与 1 都这样),所以必须用 spawnSync 同时收两侧 ——
 * 用 execFileSync 会在 exit 0 时只拿到 stdout,把"报名"这件事看成没发生(P5 第一版就死在这)。
 * @returns {{code:number|null, text:string}} code=null 表示进程压根没跑起来(脚本自身异常)
 */
function gate(dir, extra = []) {
  const r = spawnSync(process.execPath, [GATE, '--root', dir, ...extra], {
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.error) return { code: null, text: String(r.error.message || r.error) }
  return { code: r.status, text: `${r.stdout || ''}${r.stderr || ''}` }
}

test('P1 索引里有的根级违规:--staged 必须仍判 exit 1 并点名(修法不得变成逃逸通道)', () => {
  const { dir, git } = makeRepo('g44-staged-violation')
  try {
    writeFileSync(join(dir, 'stray.ps1'), '# in my commit\n')
    git(['add', 'stray.ps1'])
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 1, `已进索引的根级文件必须 exit 1,实得 ${r.code}\n${r.text}`)
    assert.match(r.text, /根目录整洁守门失败/)
    assert.ok(r.text.includes('stray.ps1'), '必须点名')
    assert.ok(!/未被 git 跟踪/.test(r.text), '它在索引里 —— 走未跟踪那一档就是归因错了')
  } finally {
    rmScratch(dir)
  }
})

test('P2 未跟踪的根级违规:--staged 判 exit 2 且照点名(非零仍拦得住,只是不再定责)', () => {
  const { dir } = makeRepo('g44-untracked-violation')
  try {
    writeFileSync(join(dir, 'stray.ps1'), '# someone else in-flight file\n')
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 2, `未跟踪必须落 exit 2(而非 1),实得 ${r.code}\n${r.text}`)
    assert.match(r.text, /未被 git 跟踪/)
    assert.ok(r.text.includes('stray.ps1'), '不点名就没人能去找物主')
    assert.ok(!/根目录整洁守门失败/.test(r.text), '不得与 P1 那一档混在同一条结论里')
  } finally {
    rmScratch(dir)
  }
})

test('P3 干净根目录:exit 0 且**不得**出现"无法判定"(证明 P2 的 2 来自发现,不是恒 2)', () => {
  const { dir } = makeRepo('g44-clean')
  try {
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 0, r.text)
    assert.ok(
      !/无法判定|未判定/.test(r.text),
      `绿的时候喊"未判定"就成了一个永不结论的门:\n${r.text}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('P4 git 问不到索引面时退回全量拦截(失效方向必须是"多要一次定向说明")', () => {
  const dir = mkScratch('g44-no-git')
  try {
    writeFileSync(join(dir, 'README.md'), '# not a repo\n')
    writeFileSync(join(dir, 'stray.ps1'), '# x\n')
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 1, `索引取不到 ⇒ 一律算本次的红,实得 ${r.code}\n${r.text}`)
    assert.match(r.text, /退回全量拦截/)
  } finally {
    rmScratch(dir)
  }
})

test('P5 全量档退出码一字未改(本票修的是归属,不是顺手把报告档改成 blocking)', () => {
  const { dir } = makeRepo('g44-fullmode')
  try {
    writeFileSync(join(dir, 'stray.ps1'), '# x\n')
    const r = gate(dir, [])
    assert.equal(r.code, 0, `全量档历史上就是报告档 exit 0 —— 改它属另一件事,实得 ${r.code}`)
    assert.ok(r.text.includes('stray.ps1'), '报告档仍要报名')
  } finally {
    rmScratch(dir)
  }
})

test('P6 --root 缺参数必须判死,不得静默退回真仓', () => {
  let code = 0
  let text = ''
  try {
    execFileSync(process.execPath, [GATE, '--root'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    code = typeof e.status === 'number' ? e.status : -1
    text = `${e?.stdout || ''}${e?.stderr || ''}${e?.message || ''}`
  }
  assert.notEqual(code, 0, '--root 不给目录就退出 0 ⇒ 测试通道会变成"审真仓还自称审夹具"')
  assert.match(text, /--root|目录/, `报错要点名是参数问题,实得:${text.slice(0, 200)}`)
})

test('P7 存量不判红(2026-10-19 恒红根因):已在 HEAD 里的白名单外目录,--staged 必须 exit 0 且照点名', () => {
  const { dir, git } = makeRepo('g44-preexisting-dir')
  try {
    // 造一枚"早就入库"的运行态目录:提交它,之后不再动它(= 本次提交内容与它无关)
    mkdirSync(join(dir, '.stray-state'), { recursive: true })
    writeFileSync(join(dir, '.stray-state', 'last-sha'), 'abc\n')
    git(['add', '.stray-state/last-sha'])
    git(['commit', '-q', '-m', 'automation state lands'])
    const r = gate(dir, ['--staged'])
    assert.equal(
      r.code,
      0,
      `白名单外但早在 HEAD 的目录不该让每次提交必红(§12e 恒红门),实得 ${r.code}\n${r.text}`,
    )
    assert.match(r.text, /存量/, '必须如实报数并写明是存量,不得静默当干净')
    assert.ok(r.text.includes('.stray-state'), '存量也要点名(找得到物主才有出路)')
    assert.ok(!/根目录整洁守门失败/.test(r.text), '存量那一档不得下"本次失败"的结论')
  } finally {
    rmScratch(dir)
  }
})

test('P8 阳性对照:同一目录改成"本次才入库",--staged 必须翻回 exit 1(棘轮不是逃逸通道)', () => {
  const { dir, git } = makeRepo('g44-newly-tracked-dir')
  try {
    mkdirSync(join(dir, '.stray-state'), { recursive: true })
    writeFileSync(join(dir, '.stray-state', 'last-sha'), 'abc\n')
    git(['add', '.stray-state/last-sha'])
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 1, `本次新入库的根级目录必须 exit 1,实得 ${r.code}\n${r.text}`)
    assert.match(r.text, /根目录整洁守门失败/)
    // 2026-10-27 措辞锚点更新:末行结论三档**一律分别报数**(`存量只报数=0(点名:无)`),
    // 所以"不得出现 存量 二字"这条旧锁结构上已不可能成立 —— 折叠三档才是本票要杀的形态。
    // 牙不换方向:改成核**逐枚点名行**里不得出现存量那一族的定位字样。
    assert.ok(
      !/已在 HEAD/.test(r.text),
      `它不在 HEAD 里 ⇒ 不得被点名成存量(逐枚点名行出现"已在 HEAD"就是归错了):\n${r.text}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('装车证明:本门在 runner 里仍是 blocking,且测试通道不进生产调用', () => {
  const at = runnerSource.indexOf("script: 'check-root-dir-clean.mjs'")
  assert.ok(at > 0, '未注册 ⇒ 这一门无人调度')
  const block = runnerSource.slice(at - 600, at + 600)
  assert.match(block, /mode:\s*'blocking'/, '本门一直是 blocking,本次不改定级')
  assert.doesNotMatch(block, /--root/, 'runner 不得带测试通道(带了就等于给自己造第二个根)')
})

test('反向锁:白名单之外的既有豁免层不得被"归属分流"顺手删掉', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /getIgnoredEntries\(/, '忽略产物告警层(2026-09-23 立)必须还在')
  assert.match(src, /getWorktreeDirNames\(/, 'worktree 精确豁免(§12d 鼓励并行隔离)必须还在')
  assert.match(src, /ignoredJunk/, '被忽略的根级临时产物仍要告警')
  assert.match(
    src,
    /return null/,
    '索引"问不到"必须与"真没有"可分,否则 git 一坏就把我的垃圾归给别人',
  )
})

test('变异自证:三档退出码不得被折回"一律 exit 1",也不得丢掉 HEAD 锚点', () => {
  const src = readFileSync(GATE, 'utf8')
  // 2026-10-27 锚点搬家(不是拆牙):退出码的**唯一出口**改成 `process.exit(outcome.code)`,
  // 因为本票要的正是"红优先但两档分别报数"——把 1/2 硬编码回分支里就是把未判定折进红。
  // 每一档的码位仍然逐档钉死(少一条就翻红),锚点从"语句形状"换成"档位表"。
  assert.match(
    src,
    /process\.exit\(outcome\.code\)/,
    '退出码必须只有一个出口(= decideOutcome 的档位表);散回 if/exit 就是重新折叠',
  )
  assert.match(src, /name: 'red', code: 1/, '红档必须仍是 exit 1 —— 找不到就说明 P1/P8 的牙被磨掉')
  assert.match(
    src,
    /name: 'red\+undetermined', code: 1/,
    '两档同时在场必须是"红优先 + 未折叠"的独立档位名,不得复用 red 那一档把未判定抹掉',
  )
  assert.match(
    src,
    /name: 'undetermined', code: 2/,
    '未跟踪 ⇒ exit 2 这一码位不得被抹平(既不折进红,也不折成绿)',
  )
  assert.match(src, /process\.exit\(2\)/, '取不到被审面必须显式 exit 2(§0.3),不得裸 throw 冒充红')
  assert.match(
    src,
    /indexed\.has\(v\.name\) && !headNames\.has\(v\.name\)/,
    'owned 的判据必须是"索引有 ∧ HEAD 无"(差值棘轮);改回单面 ls-files 就是那枚恒红根因复发',
  )
})

test('变异自证②(2026-10-27 双形态入口):判据必须经 __test__ 暴露,顶层不得执行', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(
    src,
    /export const __test__ = \{/,
    '没有 __test__ 出口 ⇒ 镜像测试只能复制判据(§22c 禁止,守门 191 专拦)',
  )
  for (const key of ['partitionByFace', 'decideOutcome', 'resultLine', 'reportResultLine']) {
    assert.match(
      src,
      new RegExp(`export const __test__ = \\{[\\s\\S]*?\\b${key},`),
      `__test__ 里少了 ${key} ⇒ 本文件的逐字对照会变成测试自己算的第二份判据`,
    )
  }
  assert.match(
    src,
    /pathToFileURL\(process\.argv\[1\]\)/,
    '§22d:isDirectRun 必须用 pathToFileURL(手拼 file:/// 在 Windows 永不匹配)',
  )
  assert.match(src, /if \(isDirectRun\) \{/, '守卫必须在顶层,否则 import 就把真仓扫一遍并退出')
})

// ─────────────────────────────────────────────────────────────────────────────
//  2026-10-27 本票主修法:**红**与**未判定**拆成两个码位,两档同时在场不得折叠
//  四例逐例点名(票面交付物 B 段要求):只红⇒1 / 只未判定⇒2 / 两者同在⇒点名两档不折叠 /
//  两面同形⇒不红。末行的期望值一律由**门体导出的判据**算出,测试不抄格式串。
// ─────────────────────────────────────────────────────────────────────────────

const mkViolations = (...names) => names.map((n) => ({ name: n, kind: '文件' }))

test('T1 只红(索引有 ∧ HEAD 无 ∧ 无未跟踪)⇒ exit 1,末行按 red 档逐字等于门体判据', () => {
  const { dir, git } = makeRepo('g44-t1-red-only')
  try {
    writeFileSync(join(dir, 'stray.ps1'), '# in my commit\n')
    git(['add', 'stray.ps1'])
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 1, `只红必须 exit 1,实得 ${r.code}\n${r.text}`)
    assert.match(r.text, /^ {2}结论\[red\] exit=1/m, '末行必须是 red 档')
    assert.ok(r.text.includes('未判定=0(点名:无)'), '红档也要把未判定那一档的数报出来(0 也是数)')
    // 判据单源逐字对照:末行由门体导出的 decideOutcome+resultLine 算,测试不复制格式串
    const v = mkViolations('stray.ps1')
    const part = G44.partitionByFace(v, new Set(['stray.ps1']), new Set(['README.md']))
    const expect = G44.resultLine(G44.decideOutcome(part), part)
    assert.ok(
      r.text.includes(expect.trimEnd()),
      `末行必须逐字等于判据出口,期望:${expect}\n实得:${r.text}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T2 只未判定(白名单外条目未被跟踪)⇒ exit 2,末行带门侧自述键', () => {
  const { dir } = makeRepo('g44-t2-undetermined-only')
  try {
    writeFileSync(join(dir, 'stray.ps1'), '# in-flight of another seat\n')
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 2, `只未判定必须 exit 2,实得 ${r.code}\n${r.text}`)
    assert.match(r.text, /^ {2}结论\[undetermined\] exit=2/m)
    assert.ok(
      r.text.includes(GATE_UNDETERMINED_MARK),
      `未判定那一档必须打门侧自述键 ${GATE_UNDETERMINED_MARK}(归因层认键不认词面),实得:${r.text}`,
    )
    assert.ok(!/❌/.test(r.text), `未判定不得冒红(不许出现 ❌),实得:${r.text}`)
    assert.ok(!/根目录整洁守门失败/.test(r.text), '未判定那一档不得下"本次失败"的结论')
  } finally {
    rmScratch(dir)
  }
})

test('T3 两档同时在场 ⇒ 红优先 exit 1,末行**分别报数且点名**(绝不折叠)', () => {
  const { dir, git } = makeRepo('g44-t3-both-faces')
  try {
    writeFileSync(join(dir, 'mine-in-index.ps1'), '# 本枚新入库 ⇒ 红\n')
    git(['add', 'mine-in-index.ps1'])
    writeFileSync(join(dir, 'theirs-on-disk.ps1'), '# 别人挂在盘上的未跟踪件 ⇒ 未判定\n')
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 1, `红优先 ⇒ exit 1,实得 ${r.code}\n${r.text}`)
    assert.match(
      r.text,
      /结论\[red\+undetermined\] exit=1/,
      '两档同时在场必须是独立档位名(不是 red)',
    )
    assert.match(r.text, /本次新入库红=1\(点名:mine-in-index\.ps1\)/)
    assert.match(r.text, /未判定=1\(点名:theirs-on-disk\.ps1\)/)
    assert.ok(/根目录整洁守门失败/.test(r.text), '红档照旧点名(本次要修的是折叠,不是放松)')
    assert.ok(/未被 git 跟踪/.test(r.text), '未判定档照旧点名,席位才找得到物主')
    assert.ok(
      /未折叠/.test(r.text),
      `末行必须明写"未折叠",否则读起来又像把未判定算进了红:\n${r.text}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T4 两面同形(索引 ∧ HEAD 都有 ∧ 无未跟踪)⇒ 不红:exit 0、只报数、档位是 stock-only', () => {
  const { dir, git } = makeRepo('g44-t4-two-faces-same')
  try {
    writeFileSync(join(dir, 'landed-long-ago.ps1'), '# 早在 HEAD 里\n')
    git(['add', 'landed-long-ago.ps1'])
    git(['commit', '-q', '-m', 'lands it'])
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 0, `两面同形(索引==HEAD)必须不红,实得 ${r.code}\n${r.text}`)
    assert.match(r.text, /结论\[stock-only\] exit=0/)
    assert.ok(!/根目录整洁守门失败/.test(r.text), '§12e:存量不得冒充本次的红')
    assert.ok(r.text.includes('landed-long-ago.ps1'), '存量仍然点名(找得到物主才有出路)')
  } finally {
    rmScratch(dir)
  }
})

test('T5 全量档不得再"打印 ❌ 却 exit 0"(报了什么与退出码说什么不许相反)', () => {
  const { dir } = makeRepo('g44-t5-report-mode')
  try {
    writeFileSync(join(dir, 'stray.ps1'), '# x\n')
    writeFileSync(join(dir, 'README.md'), '# fixture\n')
    const r = gate(dir, [])
    assert.equal(r.code, 0, `全量档仍是报告档,实得 ${r.code}\n${r.text}`)
    assert.ok(!/❌/.test(r.text), `报告档无权出现 ❌ 字样,实得:${r.text}`)
    assert.ok(!/守门失败/.test(r.text), `报告档无权下"失败"结论(要红请跑 --staged),实得:${r.text}`)
    assert.ok(r.text.includes('stray.ps1'), '只报数≠不报名')
    assert.match(r.text, /结论\[report-only\] exit=0/)
    // 判据单源:报告档末行同样由门体导出的 reportResultLine 算
    const part = G44.partitionForReport(mkViolations('stray.ps1'), new Set(['README.md']))
    assert.ok(
      r.text.includes(G44.reportResultLine(part).trimEnd()),
      `报告档末行必须逐字等于判据出口:\n${r.text}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T6 索引面枚举到 0 条与问不到同档(§0.3 枚举到 0 不读成"这里没有我要拦的东西")', () => {
  const v = mkViolations('stray.ps1')
  const emptyIndex = G44.partitionByFace(v, new Set(), new Set(['README.md']))
  const noIndex = G44.partitionByFace(v, null, new Set(['README.md']))
  assert.equal(emptyIndex.owned.length, 1, '空索引面必须退回全量拦截(不得把违规归成"别人的")')
  assert.equal(noIndex.owned.length, 1, '问不到时同样退回全量拦截')
  assert.match(emptyIndex.why, /退回全量拦截/)
  assert.match(noIndex.why, /退回全量拦截/)
  assert.equal(G44.decideOutcome(emptyIndex).code, 1, '退回全量拦截那一档的码位必须是红(1)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('SEAL1 封口链接(2026-10-28):指向批准落点的 junction 放行;实体目录与指向别处的链接照旧判红', async (t) => {
  const { mkdirSync, symlinkSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { mkScratch, rmScratch } = await import('../lib/scratch-dir.mjs')
  const dir = mkScratch('seal-link-')
  t.after(() => rmScratch(dir, { bestEffort: true }))
  const solid = join(dir, 'solid')
  mkdirSync(solid)
  assert.equal(G44.isSealedLink(solid), false, '实体目录必须判红(封口只认链接)')
  const elsewhere = join(dir, 'elsewhere')
  mkdirSync(elsewhere)
  const wrongLink = join(dir, 'wrong-link')
  symlinkSync(elsewhere, wrongLink, 'junction')
  assert.equal(G44.isSealedLink(wrongLink), false, '指向非批准落点的链接必须判红')
  const approvedLink = join(dir, 'approved-link')
  try {
    symlinkSync('D:/DevEnv/Temp', approvedLink, 'junction')
  } catch {
    t.skip('本机无 D:/DevEnv/Temp,跳过正例')
    return
  }
  assert.equal(G44.isSealedLink(approvedLink), true, '指向批准落点的 junction 必须放行')
})
