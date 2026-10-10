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
const GATE_REL = 'check-spawn-output-channel.mjs'
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

/* ---------------------------- 唯一实现与接线 ---------------------------- */

test('M2 方向锁:摘掉 script 行后,M1 那种"已装车"结论不得成立', () => {
  // 与 M1 同侧取材:注册块是旁路落地进 HEAD 的,共享工作树那份常年滞后(按磁盘判就把"已装车"读成"没装")。
  const src = gitIn(REPO, ['show', 'HEAD:scripts/guardian-runner.mjs'])
  const at = src.indexOf(`script: '${GATE_REL}'`)
  assert.ok(at > 0, '本臂的前置:HEAD 面 runner 里得有本门(与 M1 同一条事实,不另建假设)')
  const removed = src.slice(0, at) + src.slice(at).replace(`script: '${GATE_REL}'`, `script: '${GATE_REL.replace('check-', 'check-ZZ-')}'`)
  assert.ok(removed.indexOf(`script: '${GATE_REL}'`) < 0, '替换没命中 ⇒ 这条反向锁没牙')
})

test('M3 唯一实现锁:门与测试都不得自带第二份通道判据', () => {
  const src = gitIn(REPO, ['show', `HEAD:scripts/${GATE_REL}`])
  assert.match(src, /from '\.\/lib\/spawn-output-channel\.mjs'/, '判据必须从 lib import')
  // 断言里的"函数声明"形态要**拼出来**:直接写 `function findBlindOutputSpawns` 会让本文件
  // 成为自己判据的命中点(§22c 那条"说明性文字也带执行性字符"同型)。
  const decl = new RegExp('function\\s+' + 'findBlind' + 'OutputSpawns\\s*\\(')
  assert.ok(!decl.test(src), '门里出现了第二份判据实现')
  const t = readFileSync(join(HERE, 'check-spawn-output-channel.test.mjs'), 'utf8')
  assert.ok(!decl.test(t), '镜像测试里出现了第二份判据(§22c 明令禁止)')
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
    // 同一形态**整份**写进注释 ⇒ 必须不红(遮罩改松就是假阳的来源)。
    // 逐行加前缀是必须的:`// ` 只盖第一行时,其余三行是真代码 ⇒ 这一臂会"因为别的原因"而绿/红,
    // 而测的其实是"注释遮不遮得住"。上一版就是踩在这一格上(它绿的原因是顶层那处当时判不出,不是遮住了)。
    writeFileSync(join(dir, 'scripts/target.mjs'), BLIND.split('\n').map((l) => `// ${l}`).join('\n'), 'utf8')
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

test('M6 未判定不得记绿也不得记红:取值在同文件追溯不到的 stdio ⇒ 逐条点名,--strict 拒绝出合格证', () => {
  const dir = mkScratch('soc-und-')
  try {
    // `stdio` 是简写属性而**本文件根本没有这个声明** ⇒ 判不出。这一格必须既不冒红也不记绿:
    // 默认档 exit 0 但逐条点名,--strict exit 2(拒绝出具合格证)。
    // (2026-10-10 票 G-1111918 档②落地后,夹具改掉了"同文件有声明"那一种 —— 那种现在判得出,
    //  由 M6c 钉住;留着它就会变成"要求门判不出它已经判得出的东西",与恒红门同罪。)
    makeRepo(dir, "function f(){\n  const r = spawnSync(py, args, { stdio })\n  return JSON.parse(r.stdout)\n}\n")
    const r = runGate(dir, ['--json'])
    assert.equal(r.code, 0, `默认档不得因"判不出"判红(恒红门唯一结局是跳门):\n${r.out}`)
    const j = JSON.parse(r.out.slice(r.out.indexOf('{')))
    assert.deepEqual(j.hits, [], '取值判不出的调用不得被当成命中')
    assert.ok(j.undetermined.length >= 1, `未判定必须逐条点名:\n${JSON.stringify(j.undetermined)}`)
    assert.equal(runGate(dir, ['--strict']).code, 2, '--strict 下有未判定必须 exit 2(拒绝出具合格证)')
  } finally {
    rmScratch(dir)
  }
})

test('M6c 简写属性能追溯到唯一字面量声明 ⇒ 判得出就判(档②的装车证明,不得退回未判定)', () => {
  const mk = (body) => {
    const dir = mkScratch('soc-trace-')
    try {
      makeRepo(dir, body)
      return runGate(dir, ['--json'])
    } finally {
      rmScratch(dir)
    }
  }
  const bad = mk("function f(){\n  const stdio = 'ignore'\n  const r = spawnSync(py, args, { stdio })\n  return JSON.parse(r.stdout)\n}\n")
  assert.equal(bad.code, 1, `简写属性回溯到坏通道必须判红:\n${bad.out}`)
  const good = mk("function f(){\n  const stdio = ['ignore', 'pipe', 'pipe']\n  const r = spawnSync(py, args, { stdio })\n  return JSON.parse(r.stdout)\n}\n")
  assert.equal(good.code, 0, `回溯到合规值必须放过,且不得留下未判定:\n${good.out}`)
  const gj = JSON.parse(good.out.slice(good.out.indexOf('{')))
  assert.deepEqual(gj.undetermined, [], '合规回溯不得仍挂未判定(挂上就是"把已判写成没判"的反向)')
})

test('M6b 顶层调用现在判得出:活区右界生效 ⇒ 命中判红,同名再赋值之后的读取不得借来定罪', () => {
  const dir = mkScratch('soc-top-')
  try {
    // ① 顶层那处 `stdio:'ignore'` 之后紧跟 `r.stdout` ⇒ 有右界就有结论,必须红(旧口径在这里挂"未判定",
    //    把 22 处本可判定的站点长期留在判不出档)。
    makeRepo(dir, TOPLEVEL)
    const red = runGate(dir, [])
    assert.equal(red.code, 1, `顶层调用 + 活区内读取必须判红:\n${red.out}`)
    // ② 读取点在同名再赋值**之后** ⇒ 属于后一次绑定,前一处的坏通道不能被它定罪。
    const dir2 = mkScratch('soc-top2-')
    try {
      makeRepo(dir2, "let r = spawnSync(py, args, { stdio: 'ignore' })\nr = spawnSync(py, args, { stdio: ['ignore', 'pipe', 'pipe'] })\nconsole.log(JSON.parse(r.stdout))\n")
      const g = runGate(dir2, ['--json'])
      const j = JSON.parse(g.out.slice(g.out.indexOf('{')))
      assert.deepEqual(j.hits, [], `越过活区右界的读取不得定罪:\n${g.out}`)
      assert.deepEqual(j.undetermined, [], '这一格是"判过了且干净",不得伪装成未判定,也不得反过来判红')
    } finally {
      rmScratch(dir2)
    }
  } finally {
    rmScratch(dir)
  }
})

test('M6d 夹具字符串里的假调用(含配不平的括号)整条不进射程 ⇒ 零命中零未判定(票 G-1111918 档①装车证明)', () => {
  const dir = mkScratch('soc-strmask-')
  try {
    // 文档字符串里写着一句假调用与半截括号;真代码那一处是合规的。旧口径按原文配平
    // ⇒ 那半句让整文件落"未判定",于是 --strict 恒 rc=2 变成一台**拒绝出合格证却没有可清偿路径**
    // 的尺子(票面①的立因)。结构遍改走"连字符串也遮"那一档后,它必须既不命中也不报名。
    const doc = 'const doc = "const r = spawnSync(a, b, { stdio: \'ignore\' }) \\n"\n'
    const good = "function f(){\n  const r = spawnSync(py, args, { stdio: ['ignore', 'pipe', 'pipe'] })\n  return JSON.parse(r.stdout)\n}\n"
    makeRepo(dir, doc + good)
    const r = runGate(dir, ['--strict'])
    assert.equal(r.code, 0, `字符串里的假调用不得进任何一档(既不算命中也不算未判定):\n${r.out}`)
    // 反向:同一文件里若真有一处坏通道,仍然必须红(遮罩不得把判据一起遮掉)。
    const dir2 = mkScratch('soc-strmask2-')
    try {
      const bad = "function f(){\n  const rr = spawnSync(py, args, { stdio: 'ignore' })\n  return JSON.parse(rr.stdout)\n}\n"
      makeRepo(dir2, doc + bad)
      assert.equal(runGate(dir2, []).code, 1, '真代码里的坏通道必须仍然判红(否则遮罩就是把判据遮掉)')
    } finally {
      rmScratch(dir2)
    }
  } finally {
    rmScratch(dir)
  }
})

test('M7 判死边界:两面旗同给 exit 2;枚举到 0 个源码脚本 exit 2(不得读成通过)', () => {
  const both = runGate(REPO, ['--staged', '--worktree'])
  assert.equal(both.code, 2, `两面旗同给必须 exit 2:\n${both.out}`)
  const dir = mkScratch('soc-empty-')
  try {
    // 门与 lib 拷进临时仓但**不提交**;提交里只有一份非源码文件 ⇒
    // 被审面(HEAD 树)枚举到 0 个源码脚本。空扫必须判死,不得报"零命中"就 exit 0。
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), ['lib/spawn-output-channel.mjs'])
    writeFileSync(join(dir, 'scripts', 'note.md'), '# 只占位,不是源码\n', 'utf8')
    gitIn(dir, ['init', '-q', '.'])
    gitIn(dir, ['config', 'user.email', 't@example.invalid'])
    gitIn(dir, ['config', 'user.name', 'mirror test'])
    gitIn(dir, ['add', '--', 'scripts/note.md'])
    gitIn(dir, ['commit', '-q', '-m', 'base'])
    const empty = runGate(dir, [])
    assert.equal(empty.code, 2, `HEAD 面枚举到 0 个源码脚本必须判死:\n${empty.out}`)
    assert.match(empty.out, /判死/, '必须喊出"判死"而不是静默 0')
  } finally {
    rmScratch(dir)
  }
})

test('M8 无豁免通道:这一型只有"改回管道"一条正解', () => {
  const src = gitIn(REPO, ['show', `HEAD:scripts/${GATE_REL}`])
  // 注意区分:**自豁免门自身文件**(判据必含违例形态的文本,否则门给自己立项那一型判红)
  // 与"给站点留跳过通道"是两件事。后者在本型里禁止。
  assert.ok(!/[\w-]-exempt/.test(src), '门里出现了行内豁免标记 ⇒ 本型禁止"标一下跳过"')
  assert.ok(!/exemptions?\.(json|js)\b/.test(src), '门里出现了豁免/基线台账读取')
  assert.ok(!/baseline/i.test(src), '门里出现了基线台账字样 ⇒ 存量已在 M4 证明为零,留台账就是给腐烂留门')
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
