// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:check-line-split-parity(G-415 A9 的跨语言口径尺子)
 *
 * 与源脚本的关系:本文件 `import { __test__ }`(§22d isDirectRun 保证 import 无副作用),
 * **不复制判据实现** —— 两份真相是登记在案的漂移源。语料、evaluate、decide 全取源脚本那一份。
 *
 * 覆盖面:
 *   T1 定级/接线方向锁(没接进提交链 ⇒ 头注必须自称没接;接了 ⇒ 条目必须成套)—— 读 HEAD 面 runner
 *   T2 取材面形状锁(被审内容必须走 face-reader 的 catBatch;不得散写 git show / readFileSync 取正文)
 *   T3 evaluate 三态:同值 / 漂移 / 未判定 各一条,且"少一种换行码位"必须翻红并点名
 *   T4 端到端阳性对照:真模块 ⇒ 两侧跑到且零漂移;把真模块的三枚码位删掉 ⇒ 必须判红
 *      —— 注入**确实命中**由"变异文本必须与原文件不同"证明;两臂都报 0 等于没测(AGENTS 门 147 那一课)
 *   T5 decide 优先级:未判定压过漂移(2 不得被读成 1)
 *   T6 一例都没判到 ⇒ 判死,不记通过
 *   T7 CLI 面旗矛盾 ⇒ exit 2,不冒红也不记绿
 *   T8 面一致性:被审面取不到实现时 CLI 必须 rc 2 并点名该路径,绝不 rc 0
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-line-split-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-line-split-parity.mjs')
const RUNNER = 'scripts/guardian-runner.mjs'

const runCli = (args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
    cwd: ROOT,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** 把一份 TS 源文本装成可 import 的模块(落进 scratch,与门自己的做法同形)。 */
async function importModuleFromText(text, prefix) {
  const scratch = mkScratch(prefix)
  try {
    mkdirSync(scratch, { recursive: true })
    writeFileSync(join(scratch, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8')
    const file = join(scratch, 'py-line-count.ts')
    writeFileSync(file, text, 'utf8')
    return await import(pathToFileURL(file).href)
  } finally {
    rmScratch(scratch)
  }
}

const splitImplOf = (mod) => mod.pySplitLines
const pyRowsFrom = (splitFn) =>
  gate.splitCorpus().map(([name, text]) => ({ name, py: splitFn(text).length }))

test('T1 定级/接线方向锁:未进提交链时头注必须自称没进;进了则条目成套(读 HEAD 面 runner)', () => {
  const headRunner = runCli(['--help']) // 只为确认 CLI 可用,不取面
  assert.equal(headRunner.status, 0, `--help 必须 0,实得 ${headRunner.status}`)

  // runner 的装车证明一律读 HEAD 面,不读磁盘(磁盘那份常年滞后 ⇒ 把刚落地的注册判成"未装")
  const show = spawnSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${RUNNER}`], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    cwd: ROOT,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const runnerText = show.status === 0 ? show.stdout : ''
  const wired = runnerText.includes('check-line-split-parity')

  const src = readFileSync(SCRIPT, 'utf8')
  if (!wired) {
    // 没接线 ⇒ 头注不得自称已接(自称已接而无人调度 = 守门 89 R1/R2 那一型假绿)
    assert.ok(
      /刻意没有接进提交链|不在提交链/.test(src),
      '未注册进门链时,头注必须明说它不在提交链上',
    )
    assert.ok(
      !/已接进 ?pre-commit|挂在 ?guardian/.test(src),
      '头注不得自称已接进提交链',
    )
  } else {
    const entry = new RegExp(
      "id:\\s*'[0-9A-Za-z]+',\\s*\\n[\\s\\S]{0,600}?script:\\s*'scripts/check-line-split-parity\\.mjs'",
    )
    assert.ok(entry.test(runnerText), '既已注册,必须能取出本门的注册项')
    const block = runnerText.slice(runnerText.indexOf('check-line-split-parity') - 400, runnerText.indexOf('check-line-split-parity') + 400)
    assert.ok(/mode:\s*'blocking'/.test(block), '接线后条目必须是 blocking(不得静默降级成 warn 而账面自称守住了)')
    assert.ok(/skipEnv:/.test(block), '接线后条目必须声明应急跳过变量')
  }
})

test('T2 取材面形状锁:内容走 catBatch,不得散写 git show / readFileSync 取被审正文', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.ok(/catBatch\(/.test(src), '必须真调用 face-reader 的读取入口(引了层却自己取 = 半接线)')
  assert.ok(/readWorktreeFile\(/.test(src), 'worktree 档必须走层的 readWorktreeFile')
  assert.ok(!/git show/.test(src), '不得散写 git show 取被审内容')
  assert.ok(!/readFileSync\(/.test(src), '被审正文不得按磁盘 readFileSync 取')
  assert.ok(/selectFace\(/.test(src), '面旗必须走层的 selectFace(两面旗同给判死这条不许各写一遍)')
})

test('T3 evaluate 三态:同值绿 / 少一种换行码位必须红并点名 / 缺对照必须未判定', () => {
  const good = (s) => {
    const p = s.split(/\r\n|\r|\n|\u000B|\u000C|\u001C|\u001D|\u001E|\u0085|\u2028|\u2029/)
    if (p.length > 0 && p[p.length - 1] === '') p.pop()
    return p
  }
  // A9 那个 bug 的形状:少抄 \x1c \x1d \x1e
  const buggy = (s) => {
    const p = s.split(/\r\n|\r|\n|\u000B|\u000C|\u0085|\u2028|\u2029/)
    if (p.length > 0 && p[p.length - 1] === '') p.pop()
    return p
  }
  const mod = (splitFn) => ({
    pySplitLines: splitFn,
    pyLineCount: (s) => splitFn(s).length,
    calculateAddedLines: () => 0,
    calculateDeletedLines: () => 0,
  })
  const flags = { calculate_added_lines: true, calculate_deleted_lines: true }
  const py = {
    errors: [],
    extracted: flags,
    splits: pyRowsFrom(good),
    added: gate.argsCorpus().map((c) => ({ name: c.name, added: 0, deleted: 0 })),
    deleted: gate.argsCorpus().map((c) => ({ name: c.name, added: 0, deleted: 0 })),
  }

  const okRes = gate.evaluate({ tsModule: mod(good), py, tsLoadError: null, pyFuncFlags: flags })
  assert.equal(gate.decide(okRes).rc, 0, '同值必须绿')
  assert.ok(okRes.checkedSplits === gate.splitCorpus().length, '绿的前提是每例都判到了')

  const badRes = gate.evaluate({ tsModule: mod(buggy), py, tsLoadError: null, pyFuncFlags: flags })
  assert.equal(gate.decide(badRes).rc, 1, '少码位必须红')
  const named = badRes.drifts.filter((x) => /FS|GS|RS|多字节/.test(x.name))
  assert.ok(named.length >= 5, `必须点名码位相关的例,实得 ${named.length}`)

  const und = gate.evaluate({ tsModule: null, py: null, tsLoadError: 'gone', pyFuncFlags: null })
  assert.equal(gate.decide(und).rc, 2, '取不到实现 ⇒ 未判定,既不记绿也不冒红')
})

test('T4 端到端阳性对照:真模块两侧都跑到且零漂移;删掉三枚码位的变异必须翻红', async () => {
  const rel = gate.TS_REL
  const realText = readFileSync(join(ROOT, rel), 'utf8')
  const mutated = realText.replace('\\u001C|\\u001D|\\u001E|', '')
  // 注入确实命中这条前置必须有:少了这一步,"变异臂其实是同一份文件"会让两臂同报 0(AGENTS 门 147 那一课)
  assert.notEqual(mutated, realText, '变异注入必须确实改动了源文本,否则本例什么都没测')
  assert.ok(!mutated.includes('\\u001C'), '变异后不应再含 \\u001C')

  const pyExe = gate.pythonCandidates(ROOT, process.env, (p) => existsSync(p))[0]
  if (!pyExe) {
    // 本机没有对照解释器 ⇒ 门必须明说"未判定",绝不允许读成"通过"
    const cli = runCli(['--worktree'])
    assert.equal(cli.status, 2, `取不到 Python 时 CLI 必须 rc 2,实得 ${cli.status}`)
    assert.match(cli.stdout + cli.stderr, /未判定|取不到 Python/)
    return
  }

  const goodMod = await importModuleFromText(realText, 'linesplit-good')
  const badMod = await importModuleFromText(mutated, 'linesplit-bad')
  const scratch = mkScratch('linesplit-mirror')
  try {
    const pyText = readFileSync(join(ROOT, gate.PY_REL), 'utf8')
    const py = gate.runPythonSide(pyExe, pyText, scratch)
    assert.ok(!py.undetermined, `Python 侧必须跑到,实得:${py.undetermined}`)
    const flags = { calculate_added_lines: true, calculate_deleted_lines: true }

    const r1 = gate.evaluate({ tsModule: goodMod, py: py.json, tsLoadError: null, pyFuncFlags: flags })
    assert.equal(gate.decide(r1).rc, 0, `真模块必须零漂移,实得 ${JSON.stringify(r1.drifts.slice(0, 3))}`)

    const r2 = gate.evaluate({ tsModule: badMod, py: py.json, tsLoadError: null, pyFuncFlags: flags })
    assert.equal(gate.decide(r2).rc, 1, '变异模块必须被同一把尺子判红')
    assert.ok(r2.drifts.some((x) => /FS/.test(x.name)), '且点名到 FS 那一族')
  } finally {
    rmScratch(scratch)
  }
})

test('T5 decide 优先级:未判定压过漂移(2 不得被读成 1)', () => {
  const d = gate.decide({
    drifts: [{ dim: 'P1 行切分', name: 'x', ts: 1, py: 2 }],
    undetermined: ['解释器取不到'],
    checkedSplits: 3,
    checkedArgs: 0,
  })
  assert.equal(d.rc, 2)
  assert.equal(d.verdict, 'undetermined')
})

test('T6 空枚举判死:一例都没判到不得冒充通过', () => {
  const d = gate.decide({ drifts: [], undetermined: [], checkedSplits: 0, checkedArgs: 0 })
  assert.equal(d.rc, 2)
  assert.equal(d.verdict, 'empty-enumeration')
})

test('T7 CLI 面旗矛盾 ⇒ exit 2,不冒红也不记绿', () => {
  const cli = runCli(['--staged', '--worktree'])
  assert.equal(cli.status, 2, `实得 ${cli.status}:${cli.stdout.slice(0, 200)}`)
  assert.match(cli.stderr, /不得同用/)
})

test('T8 面一致性:被审面取不到实现时 CLI 必须 rc 2 并点名路径,绝不 rc 0', () => {
  const headHas = runCli(['--json'])
  let parsed = null
  try {
    parsed = JSON.parse(headHas.stdout)
  } catch {
    assert.fail(`--json 必须可 parse,实得:${String(headHas.stdout).slice(0, 200)}`)
  }
  // 自证:结论必须与"那一面到底有没有这份实现"一致 —— 不一致就是"把没判写成判过了"
  const show = spawnSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${gate.TS_REL}`], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    cwd: ROOT,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const present = show.status === 0
  if (!present) {
    assert.equal(parsed.rc, 2, `HEAD 面上没有 ${gate.TS_REL} 时不得记通过`)
    assert.ok(
      parsed.undetermined.some((x) => x.includes(gate.TS_REL)),
      '未判定必须点名是哪个路径取不到',
    )
  } else {
    assert.ok(parsed.rc === 0 || parsed.rc === 1, `实现已在 HEAD 面 ⇒ 必须给出可判结论,实得 ${parsed.rc}`)
    assert.ok(parsed.checkedSplits > 0, '判到了例数必须 > 0')
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
