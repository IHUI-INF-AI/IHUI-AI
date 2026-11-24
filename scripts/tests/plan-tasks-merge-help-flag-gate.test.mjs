// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-RP91 2026-11-05

/**
 * RP-91 镜像测试:旁路器物 plan-tasks-merge 的「未知旗标 ⇒ 用法错 exit 2 并打印用法」+
 * 「--help/-h ⇒ 只打印用法 rc=0」两条路径的**零副作用**钉子。
 *
 * 立因(票面原话):同族风险面 `union-converge` / `plan-tasks-merge` 等只认已知旗标的旁路器物,
 * 凡"未知旗标被静默忽略并按默认动作执行"都同型(git-sync-converge 2026-10-30 实测踩过:
 * 为"查用法"敲 `--help` ⇒ 被当默认档直接开跑真实索引层收敛,崩前留 16 项 index≠HEAD 中间态)。
 * 失效方向恒定 = 多要一次定向说明(§0.10),绝不静默执行仓库级动作。
 *
 * 本文件钉四件事:
 *   ① `--help` 与 `-h` ⇒ rc=0、打印用法、**绝不**打出任何动作档口的结论;
 *   ② `--definitely-not-a-flag` ⇒ rc=2、原样点名该旗标、给出用法;
 *   ③ 零副作用:两条路径跑完,夹具仓 HEAD/索引/工作区三面逐字节不变,且**真仓 HEAD 逐字不变**、
 *      夹具目录里没多出任何被写出来的文件;
 *   ④ 已知旗标行为不回退(§22c:判据一律 import 源文件出口,本文件零复算)。
 *
 * 真仓的**索引/工作区脏面不作断言** —— 这是多席共写的共享工作区,别席每几分钟就 add/commit 一次;
 * 拿别席的写入当"本器副作用"= 恒红门(§12e),与 scripts/tests/union-converge-arg-guard.test.mjs
 * 用例⑨/⑩ 同一口径。与别席无关、且本器结构上碰不到的面(夹具仓三面 + 真仓 HEAD)在这里判全。
 *
 * ⚠️ 本文件**只走** help/未知旗两条"必须无副作用"的路径,**绝不去跑本器的默认档或任何写档**
 * (本器默认档只出报告不写盘,但 `--commit` 系会走对象空间落地 —— 那是台账红线,不赌)。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { inspectArgs, KNOWN_FLAGS, VALUE_FLAGS } from '../plan-tasks-merge.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'plan-tasks-merge.mjs')

/** 未知旗标夹具:故意长得不像任何已登记旗,免得哪天本器真加了同名旗把这条钉成假绿。 */
const UNKNOWN_FLAG = '--definitely-not-a-flag'

const gitIn = (cwd, args) =>
  spawnSync('git', ['--no-optional-locks', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    // §12g:本机派生 git 必须显式 stdio,否则 EBUSY。
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  })

const gitOut = (cwd, args) => {
  const r = gitIn(cwd, args)
  // 取不到输入 ⇒ 直接抛(§0.3:未判定不得冒充"干净"让零副作用断言假绿)。
  assert.equal(r.status, 0, `git ${args.join(' ')} 取不到(rc=${r.status}):${r.stderr}`)
  return String(r.stdout)
}

const runCli = (cwd, args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })

const out = (r) => `${r.stderr || ''}${r.stdout || ''}`

function assertRan(r) {
  assert.equal(r.error, undefined, `spawn 失败:${r.error?.message ?? ''}`)
  assert.equal(r.signal, null, `被子进程信号打断(${r.signal})`)
  assert.equal(typeof r.status, 'number', '没拿到退出码')
}

/** 建一枚夹具 git 仓(带一枚提交),返回三面快照所需的目录。 */
function makeFixture(label) {
  const dir = mkScratch(label)
  assert.equal(gitIn(dir, ['init', '-q', '-b', 'main']).status, 0, '夹具 git init 失败')
  gitIn(dir, ['config', 'user.email', 'rp91@example.invalid'])
  gitIn(dir, ['config', 'user.name', 'rp91-guard'])
  writeFileSync(join(dir, 'a.txt'), 'seed\n', 'utf8')
  assert.equal(gitIn(dir, ['add', '-A']).status, 0, '夹具 add 失败')
  assert.equal(gitIn(dir, ['commit', '-q', '-m', 'seed']).status, 0, '夹具 seed 提交失败')
  return dir
}

/** 三面快照:HEAD、索引(暂存面逐条 mode/blob/-stage)、工作区+未跟踪面(porcelain)。 */
function snapshotThreeFaces(dir) {
  return {
    head: gitOut(dir, ['rev-parse', 'HEAD']),
    index: gitOut(dir, ['ls-files', '-s']),
    porcelain: gitOut(dir, ['status', '--porcelain']),
  }
}

// 动作档的**输出特征**(不是文档说明词):帮助文本合理地会"提到"落地/commit-tree,拒绝文案里
// 还引用过 `"✅ 通过"` 这个格式举例 —— 拿说明词/引文当特征=自己造假红。只认真开跑动作档才会
// 出现的**行首**结论符、判定面读数头与拟改动计数行。
const HELP_MARKERS = /plan-tasks-merge\.mjs/
const ACTION_TELLTALES = /(?:^|\n)✅|判定面:|拟折 \d+ 族|拟删 \d+ 行/

test('① --help / -h 是纯查询:rc=0、打印用法,绝不打出任何动作档口的结论', () => {
  const dir = makeFixture('rp91-help')
  const before = snapshotThreeFaces(dir)
  const realHeadBefore = gitOut(REPO, ['rev-parse', 'HEAD'])
  try {
    for (const flag of ['--help', '-h']) {
      const r = runCli(dir, [flag])
      assertRan(r)
      assert.equal(r.status, 0, `${flag} 必须 rc=0(实得 ${r.status});输出:${out(r).slice(0, 200)}`)
      assert.match(r.stdout, HELP_MARKERS, `${flag} 必须打印本器用法`)
      assert.match(r.stdout, /退出码/, `${flag} 的用法必须写明退出口径(未知旗落 2 要看得见)`)
      assert.doesNotMatch(out(r), ACTION_TELLTALES, `${flag} 绝不允许开跑归并/落地并打出动作档结论`)
      const after = snapshotThreeFaces(dir)
      assert.equal(after.head, before.head, `${flag} 不得推进夹具仓 HEAD`)
      assert.equal(after.index, before.index, `${flag} 不得写索引(票面:帮助路径不得留中间态)`)
      assert.equal(after.porcelain, before.porcelain, `${flag} 不得写工作区/不得新造未跟踪文件`)
      assert.equal(gitOut(REPO, ['rev-parse', 'HEAD']), realHeadBefore, `${flag} 不得推进真仓 HEAD`)
    }
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('② 未知旗标 ⇒ rc=2、原样点名该旗标、给出用法(不得静默落进默认档)', () => {
  const dir = makeFixture('rp91-unknown')
  const before = snapshotThreeFaces(dir)
  const realHeadBefore = gitOut(REPO, ['rev-parse', 'HEAD'])
  try {
    const r = runCli(dir, [UNKNOWN_FLAG])
    assertRan(r)
    assert.equal(r.status, 2, `未知旗必须 rc=2(实得 ${r.status});输出:${out(r).slice(0, 200)}`)
    assert.match(out(r), /未识别的参数/, '必须点名是用法错,不许裸栈或静默')
    assert.ok(out(r).includes(UNKNOWN_FLAG), `必须原样点名收到的 token ${UNKNOWN_FLAG}`)
    assert.match(out(r), /可用旗标/, '用法错必须给出旗标清单出口(唯一出路不许跑不通,§0.8)')
    assert.doesNotMatch(out(r), ACTION_TELLTALES, '拒绝那一趟绝不许同时开出动作档并打出结论')
    const after = snapshotThreeFaces(dir)
    assert.equal(after.head, before.head, '未知旗这一趟绝不许推进夹具仓 HEAD')
    assert.equal(after.index, before.index, '未知旗这一趟绝不许留索引中间态(病根就是 index≠HEAD 残留)')
    assert.equal(after.porcelain, before.porcelain, '未知旗这一趟不得写工作区/不得新造文件')
    assert.equal(gitOut(REPO, ['rev-parse', 'HEAD']), realHeadBefore, '未知旗不得推进真仓 HEAD')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('③ 已知旗标行为不回退(判据 import 源出口,§22c 零复算):逐枚放行 + 带值形 + 组合链', () => {
  assert.ok(Array.isArray(KNOWN_FLAGS) && KNOWN_FLAGS.length > 0, 'KNOWN_FLAGS 出口不可取')
  // '-h' 必须与 '--help' 成套(同族口径:union-converge / git-sync-converge 都放行 -h)
  assert.ok(KNOWN_FLAGS.includes('-h'), '-h 未进 KNOWN_FLAGS ⇒ 会被 inspectArgs 拒成未知参数')
  assert.ok(KNOWN_FLAGS.includes('--help'), '--help 必须在白名单里')
  for (const f of KNOWN_FLAGS) {
    assert.deepEqual(inspectArgs([f]).unknown, [], `已登记旗 ${f} 必须被放行(拦死正当用法=恒红同罪)`)
  }
  for (const f of VALUE_FLAGS) {
    assert.ok(KNOWN_FLAGS.includes(f), `值旗 ${f} 必须同时在 KNOWN_FLAGS 里(两份清单各自演进必漂)`)
    assert.deepEqual(inspectArgs([f, 'x']).unknown, [], `值旗 ${f} 必须吃掉紧邻值 'x'`)
  }
  // 真实调用串组合(取自票面与本器头注的既有出口形态)
  assert.deepEqual(inspectArgs(['--fold-identical-open-rows', '--commit']).unknown, [])
  assert.deepEqual(inspectArgs(['--dedupe-open-rows', '--match', '某段原文锚点', '--commit']).unknown, [])
  assert.deepEqual(inspectArgs(['--heal', '--max-rows', '25', '--rounds', '60', '--commit']).unknown, [])
  assert.deepEqual(inspectArgs(['--write-to', 'cand.json', '2026-09-28']).unknown, [])
  // 反向对照(尺子必须有牙):未登记旗与裸错位位置参数仍必须被拒
  assert.deepEqual(inspectArgs([UNKNOWN_FLAG]).unknown, [UNKNOWN_FLAG])
  assert.ok(inspectArgs(['--staged', 'oops.json']).unknown.includes('oops.json'))
})

test('④ 成套性反向锁:--help 印出的每一枚 --旗都必须在 KNOWN_FLAGS 里(文档不承诺不存在的动作,§0.8)', () => {
  const r = runCli(REPO, ['--help'])
  assertRan(r)
  assert.equal(r.status, 0, `--help 必须 rc=0(实得 ${r.status})`)
  const printed = new Set(r.stdout.match(/--[a-z][a-z0-9-]*/g) || [])
  assert.ok(printed.size >= 10, `--help 只认出 ${printed.size} 枚旗 ⇒ 帮助文本形状变了,本用例失去意义`)
  const ghost = [...printed].filter((f) => !KNOWN_FLAGS.includes(f))
  assert.deepEqual(ghost, [], `帮助文本印了却不被 inspectArgs 认识的旗:${ghost.join(' ')}`)
  assert.match(r.stdout, /--help\/-h/, '帮助文本必须把 -h 短形印出来(否则用户从文档学不到它可用)')
})

test('⑤ 装车锁:闸排在 main 的一切动作之前;清单/闸体全仓只有一份;help 分支真接上 -h', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  const iGate = src.indexOf('const { unknown, notes } = inspectArgs(argv)')
  assert.ok(iGate > 0, 'main 里没接闸 ⇒ 清单只是注释(§0.9 造好没装车 = 没有)')
  for (const [name, needle] of [
    ['--self-test 分支', "if (has('--self-test'))"],
    ['--help 分支', "if (has('--help') || has('-h'))"],
    ['首个动作档(--audit-pointers)', "if (has('--audit-pointers'))"],
    ['拒绝出口 return 2', 'return 2'],
  ]) {
    const i = src.indexOf(needle, iGate)
    assert.ok(i > iGate, `找不到「${name}」在闸之后 ⇒ 锚点腐烂,本用例不得记绿`)
  }
  const iUnknown = src.indexOf('if (unknown.length)')
  assert.ok(iUnknown > iGate && iUnknown < src.indexOf("if (has('--self-test'))"), '未知旗拒绝必须排在动作分支之前')
  assert.equal(
    [...src.matchAll(/export (const KNOWN_FLAGS|function inspectArgs)/g)].length,
    2,
    '清单与闸体各只许一份 export(第二份必然漂移,§0.6)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
