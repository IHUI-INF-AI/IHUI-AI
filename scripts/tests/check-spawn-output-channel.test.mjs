// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「派生结论通道对账」(check-spawn-output-channel.mjs)的 §22c 镜像测试。
 *
 * 本门拦的是**反极性**:派生把 stdout 丢掉/直通终端,而同一作用域里又去读它 ⇒ 结论恒为 null,
 * 门把"自己没拿到"写成"机器态未判定"并 exit 0。它的全部危险形态都是**安静**:
 *  ① 门没注册(判据对、无人调度);② 门把判据抄成第二份(与 lib 漂开后照样绿);
 *  ③ 门把"取不到/判不出"折成通过;④ 作用域口径一放宽就产出成批假阳(实测 7 处),
 *     假阳的后果不是"报告难看",是下一个人去改本来正常的代码。
 * 每一臂都配一条反向对照,让"没牙"这件事本身必须红。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { findBlindOutputSpawns } from '../lib/spawn-output-channel.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO = resolve(SCRIPTS_DIR, '..')
const RUNNER = join(SCRIPTS_DIR, 'guardian-runner.mjs')
const GATE_REL = 'check-spawn-output-channel.mjs'
const SRC = join(SCRIPTS_DIR, GATE_REL)
const GIT = process.env.GIT_BIN || 'git'

const gitIn = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

function runGate(dir, args) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', GATE_REL), ...args], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300_000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

/** 临时 git 仓:一份门 + 它的 lib 闭包 + 一个被审脚本,做成可控的两面现场。 */
function makeRepo(dir, targetText, { commit = true } = {}) {
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), ['lib/spawn-output-channel.mjs'])
  const rel = 'scripts/target.mjs'
  mkdirSync(dirname(join(dir, rel)), { recursive: true })
  writeFileSync(join(dir, rel), targetText, 'utf8')
  gitIn(dir, ['init', '-q', '.'])
  gitIn(dir, ['config', 'user.email', 't@example.invalid'])
  gitIn(dir, ['config', 'user.name', 'mirror test'])
  gitIn(dir, ['add', '-A', '--'])
  if (commit) gitIn(dir, ['commit', '-q', '-m', 'base'])
}

const BLIND = "export function f(){\n  const r = spawnSync(py, args, { encoding: 'utf8', stdio: 'ignore' })\n  return JSON.parse(r.stdout)\n}\n"
const CLEAN = "export function f(){\n  const r = spawnSync(py, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })\n  return JSON.parse(r.stdout)\n}\n"
const NO_READ = "export function f(){\n  const r = spawnSync(py, ['--version'], { stdio: 'ignore' })\n  return r.status\n}\n"
const TOPLEVEL = "const r = spawnSync(py, args, { stdio: 'ignore' })\nconsole.log(r.stdout)\n"

test('M1 装车证明:HEAD 面 runner 必须有本门注册块,且 blocking + skipEnv + script 逐字在位', () => {
  const src = gitIn(REPO, ['show', 'HEAD:scripts/guardian-runner.mjs'])
  const at = src.indexOf(`script: '${GATE_REL}'`)
  assert.ok(at > 0, `runner(HEAD 面)里没有 ${GATE_REL} 的注册块 ⇒ 门存在而无人调度,提交链上永远不跑`)
  const block = src.slice(Math.max(0, at - 900), at + 900)
  assert.match(block, /mode:\s*'blocking'/, '定级必须是 blocking(本型没有"只报数"的价值:未判定已经长期冒充通过)')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_SPAWN_OUTPUT_CHANNEL'/, '缺应急跳过变量 = 文档写了跑不通的出路(§16 同型)')
})

test('M2 方向锁:摘掉 script 行后,M1 那种"已装车"结论不得成立', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const at = src.indexOf(`script: '${GATE_REL}'`)
  assert.ok(at > 0, '本臂的前置:runner 里得有本门(与 M1 同一条事实,不另建假设)')
  const removed = src.slice(0, at) + src.slice(at).replace(`script: '${GATE_REL}'`, "script: 'placeholder-not-this-gate.mjs'")
  assert.ok(removed.indexOf(`script: '${GATE_REL}'`) < 0, '替换没命中 ⇒ 这条反向锁没牙')
  assert.ok(!/script:\s*'placeholder-not-this-gate\.mjs'/.test(src), '不得在真 runner 里留下占位名')
})

test('M3 唯一实现锁:门与测试都不得自带第二份通道判据', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/spawn-output-channel\.mjs'/, '判据必须从 lib import')
  assert.ok(!/function findBlindOutputSpawns/.test(src), '门里出现了第二份判据实现')
  const t = readFileSync(join(HERE, 'check-spawn-output-channel.test.mjs'), 'utf8')
  assert.ok(!/function findBlindOutputSpawns/.test(t), '镜像测试里出现了第二份判据(§22c 明令禁止)')
})

test('M4 真仓阳性对照:HEAD 面必须能看见整面(看不见存量不算通过),且当前零命中', () => {
  const r = runGate(REPO, ['--json'])
  assert.equal(r.code, 0, `真仓 HEAD 面不得判红(存量已清 ⇒ 接线不新增恒红面):\n${r.out.slice(0, 800)}`)
  const j = JSON.parse(r.out.slice(r.out.indexOf('{')))
  assert.ok(j.scanned > 500, `扫描面异常小(${j.scanned})⇒ 枚举坏了,"0 命中"就不是结论而是空扫`)
  assert.deepEqual(j.hits, [], `HEAD 面真有命中:${JSON.stringify(j.hits)}`)
  assert.ok(Array.isArray(j.undetermined), '未判定必须是清单(不得被折成一个布尔)')
})

test('M5 端到端双向锁:索引注入必红 / 只写进注释必绿 / 不吃输出的 ignore 必绿', () => {
  const dir = mkScratch('soc-e2e-')
  try {
    makeRepo(dir, CLEAN)
    // 注入真违规到索引(不动工作树 ⇒ 证明判据读的是被审面而非磁盘)
    writeFileSync(join(dir, 'scripts/target.mjs'), BLIND, 'utf8')
    gitIn(dir, ['add', '--', 'scripts/target.mjs'])
    const red = runGate(dir, ['--staged'])
    assert.equal(red.code, 1, `索引面注入违规必须判红:\n${red.out}`)
    assert.ok(/scripts\/target\.mjs/.test(red.out), '红必须点名被注入的文件')
    // 同一形态只写进注释 ⇒ 必须不红(遮罩改松就是假阳的来源)
    writeFileSync(join(dir, 'scripts/target.mjs'), `// ${BLIND}`, 'utf8')
    gitIn(dir, ['add', '--', 'scripts/target.mjs'])
    const green = runGate(dir, ['--staged'])
    assert.equal(green.code, 0, `注释里的该形态不得计入(门不得给自己立项的叙述判红):\n${green.out}`)
    // `stdio:'ignore'` 且没人读输出 ⇒ 正当写法,归反极性那道门管,本门必须放过
    writeFileSync(join(dir, 'scripts/target.mjs'), NO_READ, 'utf8')
    gitIn(dir, ['add', '--', 'scripts/target.mjs'])
    const ok = runGate(dir, ['--staged'])
    assert.equal(ok.code, 0, `不吃输出的 stdio:'ignore' 是正当写法,判红就会逼人 --no-verify:\n${ok.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('M6 未判定不得记绿也不得记红:顶层作用域界不定 ⇒ 逐条点名,--strict 拒绝出合格证', () => {
  const dir = mkScratch('soc-und-')
  try {
    makeRepo(dir, TOPLEVEL)
    const r = runGate(dir, ['--json'])
    assert.equal(r.code, 0, `默认档不得因"判不出"判红(恒红门唯一结局是跳门):\n${r.out}`)
    const j = JSON.parse(r.out.slice(r.out.indexOf('{')))
    assert.deepEqual(j.hits, [], '顶层调用必须落未判定而不是命中')
    assert.ok(j.undetermined.some((s) => /作用域/.test(String(s))), `未判定必须点名原因:${JSON.stringify(j.undetermined)}`)
    assert.equal(runGate(dir, ['--strict']).code, 2, '--strict 下有未判定必须 exit 2(拒绝出具合格证)')
  } finally {
    rmScratch(dir)
  }
})

test('M7 判死边界:两面旗同给 exit 2;空枚举 exit 2(不得读成通过)', () => {
  const both = runGate(REPO, ['--staged', '--worktree'])
  assert.equal(both.code, 2, `两面旗同给必须 exit 2:\n${both.out}`)
  const dir = mkScratch('soc-empty-')
  try {
    // 只拷门与 lib,不放任何被审脚本 ⇒ 枚举到 0 个必须判死
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), ['lib/spawn-output-channel.mjs'])
    gitIn(dir, ['init', '-q', '.'])
    gitIn(dir, ['config', 'user.email', 't@example.invalid'])
    gitIn(dir, ['config', 'user.name', 'mirror test'])
    gitIn(dir, ['add', '-A', '--'])
    gitIn(dir, ['commit', '-q', '-m', 'base'])
    const empty = runGate(dir, [])
    assert.equal(empty.code, 2, `枚举到 0 个脚本必须判死,不得报"零命中"就 exit 0:\n${empty.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('M8 无豁免通道:这一型只有"改回管道"一条正解', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.ok(!/exempt/i.test(src), '门里出现了豁免通道 ⇒ 本型禁止"标一下跳过"')
  assert.ok(!/baseline/i.test(src), '门里出现了基线台账 ⇒ 存量已在 M4 证明为零,留台账就是给腐烂留门')
})

test('M9 形状判据有牙:同一函数体内三个通道写法各判一次(构造面,不依赖仓库瞬时状态)', () => {
  assert.equal(findBlindOutputSpawns(BLIND).hits.length, 1, "标量 'ignore' 必须命中")
  assert.equal(findBlindOutputSpawns(CLEAN).hits.length, 0, '数组第二格 pipe 必须放过')
  assert.equal(findBlindOutputSpawns(NO_READ).hits.length, 0, '没人读输出必须放过')
  // 同名变量分处两个函数 ⇒ 不得互顶(整文件找 r.stdout 的假阳型,实测曾产出 7 处)
  const twin = `function a(){\n  const r = spawnSync(x, y, { stdio: 'ignore' })\n  return r.status\n}\nfunction b(){\n  const r = spawnSync(x, y, { stdio: ['ignore', 'pipe', 'pipe'] })\n  return JSON.parse(r.stdout)\n}\n`
  assert.equal(findBlindOutputSpawns(twin).hits.length, 0, '两个同名 r 互顶 ⇒ 假阳会把正当写法判红')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
