// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// scripts/check-doom-loop-parity.mjs 的 §22c 镜像测试(V3 #54)。
//
// 判据一律 import 源文件的 __test__ 导出,不在测试里复制解析/判定逻辑
// (§22c:镜像常量 = 两份真相,源改判据测试仍绿正是本条要杀的假绿)。
//
// 分工:
//   门内 --self-test = 构造面注入,证明"函数会给答案";
//   本文件 = 真 git 临时仓端到端 + runner 装配对账,证明"有人问它、问的是哪一面、
//            且它没有被冒充成已装车"。
//
// 三条方向性对照(AGENTS 反复登记):
//   T1 runner 里没有本门时,**不得**被判定为已装车(反向锁);注册后必须成套
//      (blocking + skipEnv + 编号唯一)。
//   T2 取材面纪律形状锁:必须走 face-reader(catBatch),不得 readFileSync 被审内容。
//   T3/T4 阳性对照:把一侧阈值改掉 ⇒ 必红;且红点出现在**被改的那一面**(索引脏而
//      HEAD 干净 ⇒ staged 红、head 绿),证明判据真在看被审面而不是磁盘。

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../check-doom-loop-parity.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE_REL = 'scripts/check-doom-loop-parity.mjs'
const GIT_BIN = process.env.GIT_BIN || 'git'

function git(dir, args) {
  return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
}

function runGate(args, cwd = REPO) {
  const r = spawnSync(process.execPath, [path.join(REPO, GATE_REL), ...args], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    timeout: 120000,
  })
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

/** 把门夹具的六份内容按真实路径布局装进一棵树(与真仓相对路径一致)。 */
function materialize(dir, contents) {
  for (const [rel, text] of Object.entries(contents)) {
    const abs = path.join(dir, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
}

test('T1 装配对账:未注册时不得冒充已装车;注册后必须成套(blocking+skipEnv+编号唯一)', () => {
  const runnerPath = path.join(REPO, 'scripts', 'guardian-runner.mjs')
  const runner = readFileSync(runnerPath, 'utf8')
  const wired = runner.includes('check-doom-loop-parity.mjs')
  const gateSrc = readFileSync(path.join(REPO, GATE_REL), 'utf8')
  if (!wired) {
    // 本镜像测试存在的当下,主会话尚未注册 ⇒ 门自身不得声称已接线(R1/R2 反装型)
    assert.ok(
      !/已接\s*pre-commit|已接入\s*pre-commit|guardian-runner.*已注册/s.test(gateSrc),
      '未注册的门脚本不得自称已接提交链(守门 89 R1 同型)',
    )
    assert.ok(
      gateSrc.includes('尚未') && gateSrc.includes('接线'),
      '未注册状态必须在门头注如实写明(现状:头注缺"尚未接线"字样)',
    )
    return
  }
  // 注册后:条目必须成套。按脚本名定位注册块(不硬写编号 —— 编号以 runner 现值为准)
  // 判"注册条目唯一",不判"脚本文本出现一次":runner 的 onFailHint 里必然再提一次门的名字,
  // 拿文本次数当撞号判据会把**正常注册**判成红(本仓 §22c:镜像测试只复读实现就是复读机)。
  const registrations = runner.match(/script:\s*'[^']*check-doom-loop-parity\.mjs'/g) ?? []
  assert.equal(registrations.length, 1, `本门在 runner 中的注册条目必须恰好一条(现 ${registrations.length} 条)`)
  const at = runner.search(/script:\s*'[^']*check-doom-loop-parity\.mjs'/)
  assert.ok(at >= 0, 'runner 注册块缺 script 字段(仅路径字符串不构成装车)')
  const block = runner.slice(Math.max(0, at - 1200), at + 1200)
  assert.match(block, /mode:\s*'blocking'/, '本门注册必须是 blocking')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_DOOM_LOOP_PARITY'/, 'skipEnv 必须成套(否则摘线无出口)')
  const idMatch = block.match(/id:\s*'([^']+)'/)
  assert.ok(idMatch, '注册块缺 id 字段')
  const idCount = (runner.match(new RegExp(`id: '${idMatch[1]}'`, 'g')) ?? []).length
  assert.equal(idCount, 1, `编号 ${idMatch[1]} 在 runner 中重复(撞号)`)
})

test('T2 取材面纪律形状锁:走 face-reader 的 catBatch,不磁盘读被审内容,含 §22d 入口守卫', () => {
  const src = readFileSync(path.join(REPO, GATE_REL), 'utf8')
  assert.match(src, /from\s+'\.\/lib\/face-reader\.mjs'/, '必须经 face-reader 层取材')
  assert.ok(src.includes('catBatch('), '面读内容必须走 catBatch(散写 git show = 半接线)')
  assert.ok(src.includes("from './lib/face-reader.mjs'"))
  // 被审六文件不得用磁盘读(readWorktreeFile 是显式逃生舱,允许;裸 readFileSync 不允许)
  const fsImports = src.match(/import\s*\{[^}]*\}\s*from\s*'node:fs'/g) ?? []
  for (const imp of fsImports) {
    assert.ok(
      !/\breadFileSync\b/.test(imp),
      '门脚本禁止 import readFileSync 读被审内容(共享工作树滞后 ⇒ 恒红/假绿来回跳)',
    )
  }
  assert.match(src, /isDirectRun/, '缺 §22d isDirectRun 守卫(import 即触发 main = 测试环境炸)')
})

test('T3 临时仓端到端:成套夹具三面皆绿;单侧阈值改掉必红且红在被改的面', () => {
  const dir = mkScratch('doom-parity')
  try {
    git(dir, ['init', '-q', '-b', 'main'])
    git(dir, ['config', 'user.email', 'gate@test.local'])
    git(dir, ['config', 'user.name', 'gate test'])
    materialize(dir, G.fixtureContents())
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'fixture'])

    const head = runGate(['--root', dir])
    assert.equal(head.status, 0, `成套夹具 HEAD 面应绿,实得:\n${head.out}`)
    const staged = runGate(['--root', dir, '--staged'])
    assert.equal(staged.status, 0, `成套夹具索引面应绿,实得:\n${staged.out}`)
    const worktree = runGate(['--root', dir, '--worktree'])
    assert.equal(worktree.status, 0, `工作树面应绿,实得:\n${worktree.out}`)

    // 阳性对照(任务书指定判据):Python 侧把重复阈值 3 改成 4 ⇒ 必红且点名该键
    const fixture = G.fixtureContents()
    const pyRel = G.FILES.pyModule
    writeFileSync(
      path.join(dir, pyRel),
      fixture[pyRel].replace('DOOM_LOOP_REPEAT_THRESHOLD = 3', 'DOOM_LOOP_REPEAT_THRESHOLD = 4'),
      'utf8',
    )
    // 只改磁盘 ⇒ head/staged 两面照旧绿(证明判据看的是被审面,不是磁盘)
    const stillGreenHead = runGate(['--root', dir])
    assert.equal(stillGreenHead.status, 0, 'HEAD 面不受磁盘脏改动影响(否则就是按磁盘判)')
    // 两面旗同给 ⇒ 判死 exit 2
    const bothFlags = runGate(['--root', dir, '--staged', '--worktree'])
    assert.equal(bothFlags.status, 2, '--staged 与 --worktree 同给必须 exit 2')
    // 暂存后 ⇒ 索引面必红
    git(dir, ['add', pyRel])
    const redStaged = runGate(['--root', dir, '--staged'])
    assert.equal(redStaged.status, 1, '索引面漂开必须 exit 1')
    assert.match(redStaged.out, /DOOM_LOOP_REPEAT_THRESHOLD/, '红点必须点名漂移的策略键')
    const stillGreenHead2 = runGate(['--root', dir])
    assert.equal(stillGreenHead2.status, 0, '同一时刻 HEAD 面必须仍绿(面隔离)')
    // 改回 ⇒ 索引面复绿(判据只认事实,不认基线)
    writeFileSync(path.join(dir, pyRel), fixture[pyRel], 'utf8')
    git(dir, ['add', pyRel])
    const greenAgain = runGate(['--root', dir, '--staged'])
    assert.equal(greenAgain.status, 0, `复改等值后索引面应绿:\n${greenAgain.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T4 面缺文件 ⇒ 判"无法判定"(exit 2),绝不记绿也绝不冒红', () => {
  const dir = mkScratch('doom-missing')
  try {
    git(dir, ['init', '-q', '-b', 'main'])
    git(dir, ['config', 'user.email', 'gate@test.local'])
    git(dir, ['config', 'user.name', 'gate test'])
    const fixture = G.fixtureContents()
    materialize(dir, fixture)
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'fixture'])
    assert.equal(runGate(['--root', dir]).status, 0)
    // 从提交树里删掉 Python 等价实现(摘掉一侧 = 判据失去比对对象,只能未判定)
    git(dir, ['rm', '-q', G.FILES.pyModule])
    git(dir, ['commit', '-q', '-m', 'remove py side'])
    const gone = runGate(['--root', dir])
    assert.equal(gone.status, 2, `一侧被删必须 exit 2 未判定,实得 ${gone.status}:\n${gone.out}`)
    assert.match(gone.out, /无法判定/)
    assert.match(gone.out, /core\/doom_loop\.py/)
    // 空树(一个被审文件都没有)同样不得记绿
    const empty = mkScratch('doom-empty')
    git(empty, ['init', '-q', '-b', 'main'])
    git(empty, ['config', 'user.email', 'gate@test.local'])
    git(empty, ['config', 'user.name', 'gate test'])
    writeFileSync(path.join(empty, 'README.md'), '# empty\n', 'utf8')
    git(empty, ['add', '-A'])
    git(empty, ['commit', '-q', '-m', 'empty'])
    const emptyRun = runGate(['--root', empty])
    assert.equal(emptyRun.status, 2, '零候选必须判死为"无法判定",而不是"0 违规 = 通过"')
    rmSync(empty, { recursive: true, force: true })
  } finally {
    rmScratch(dir)
  }
})

test('T5 真仓现状:HEAD 面只允许 0 或 2(未落地=未判定),落地后不得再闪红', () => {
  const r = runGate([])
  assert.ok(
    r.status === 0 || r.status === 2,
    `真仓 HEAD 面应绿或未判定,实得 ${r.status}:\n${r.out}`,
  )
  if (r.status === 0) {
    const j = runGate(['--json'])
    assert.equal(j.status, 0)
    const parsed = JSON.parse(j.out)
    assert.deepEqual(parsed.problems, [], '--json 与人类行结论必须一致')
    assert.equal(parsed.undetermined.length, 0)
  }
})

test('T6 自检可独立复跑且必须两次同果(防"只能跑一次的取证")', () => {
  const first = runGate(['--self-test'])
  const second = runGate(['--self-test'])
  assert.equal(first.status, 0, `--self-test 首跑应绿:\n${first.out}`)
  assert.equal(second.status, 0, `--self-test 复跑应绿(第二次起恒红 = 取证无效):\n${second.out}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
