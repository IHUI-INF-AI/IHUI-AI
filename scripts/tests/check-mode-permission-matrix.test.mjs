// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/check-mode-permission-matrix.mjs 的 §22c 镜像测试(V3 #53)。
 *
 * 判据一律 import 源文件的 __test__ 导出,**不在测试里复制一份解析/推导逻辑**
 * (复制 = 两份真相,源改判据而测试仍绿正是 §22c 立条要杀的那种假绿)。
 *
 * 与门内 --self-test 的分工:
 *   --self-test  = 构造面注入(快、无 git),证明"函数会给答案";
 *   本文件       = 真 git 仓端到端,证明"有人问它、且问的是被审的那一面"。
 *   后者不可省:本仓记过多次"自检恒绿而提交链上生效次数为 0"(门 128 那条血的教训),
 *   能区分这两者的只有"造一枚提交、再改索引、看两档各答什么"。
 */

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../check-mode-permission-matrix.mjs'

const REPO = path.resolve(import.meta.dirname, '..', '..')
const GATE_REL = 'scripts/check-mode-permission-matrix.mjs'
const GIT = 'git'

function git(dir, args) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** 把被审的六份面按**当前工作树内容**装进一枚独立临时仓(不碰真仓索引)。 */
function makeFaceRepo(label) {
  const dir = mkScratch(label)
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.email', 'gate@test.local'])
  git(dir, ['config', 'user.name', 'gate test'])
  for (const rel of Object.values(G.FILES)) {
    const abs = path.join(dir, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, readFileSync(path.join(REPO, rel), 'utf8'), 'utf8')
  }
  // 门本体不必复制进临时仓:runAudit 收 root 参数,复制反而会牵进 face-reader 的
  // 依赖链(gitdir.mjs 等),把那部分实现细节当成被测对象。
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'fixture'])
  return dir
}

test('T1 真仓 HEAD 面不得被"看不见"糊过去:要么逐格等值,要么明确喊未判定', () => {
  // 本票未提交前,HEAD 里还没有矩阵 ⇒ 默认档必须报**未判定**,而不是"0 问题 = 通过"。
  const r = G.runAudit({ root: REPO })
  assert.ok(
    r.problems.length === 0 || r.undetermined.length > 0,
    `既没问题也没未判定,说明判据没落地:${JSON.stringify(r)}`,
  )
})

test('T2 临时仓 HEAD 面:两侧矩阵逐格等值(阳性对照,证明门真能读出绿灯)', () => {
  const dir = makeFaceRepo('mpm-head-ok-')
  try {
    const r = G.runAudit({ root: dir, face: 'head' })
    assert.deepEqual(r.undetermined, [], `六份输入应全部取得到:${JSON.stringify(r.undetermined)}`)
    assert.deepEqual(r.problems, [])
    assert.equal(r.fileCount, Object.values(G.FILES).length)
  } finally {
    rmScratch(dir)
  }
})

test('T3 临时仓:提交里改脏一格 → HEAD 面必红且点名该格', () => {
  const dir = makeFaceRepo('mpm-cell-')
  try {
    const rel = G.FILES.pyRegistry
    const abs = path.join(dir, rel)
    const src = readFileSync(abs, 'utf8')
    const at = src.indexOf('CHAT_PERMISSION_TOOL_MATRIX: Final')
    assert.ok(at >= 0, '临时仓里找不到工具矩阵声明')
    const cell = src.indexOf('"manual": "readonly"', at)
    assert.ok(cell >= 0)
    writeFileSync(abs, src.slice(0, cell) + '"manual": "all"' + src.slice(cell + 19), 'utf8')
    git(dir, ['commit', '-q', '-am', 'drift python cell'])
    const r = G.runAudit({ root: dir, face: 'head' })
    const named = r.problems.filter((p) => p.includes('[plan][manual]'))
    assert.ok(r.problems.length > 0, '改脏一格却零问题 = 判据失明')
    assert.ok(
      named.length >= 2,
      `应同时点名"表≠轴推导"与"TS≠Python",实得:${JSON.stringify(r.problems)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T4 三面三答:索引脏而 HEAD 干净 ⇒ --staged 红、head 绿(不得借 HEAD 内容凑数)', () => {
  const dir = makeFaceRepo('mpm-face-')
  try {
    const rel = G.FILES.tsRegistry
    const abs = path.join(dir, rel)
    const src = readFileSync(abs, 'utf8')
    const at = src.indexOf('CHAT_PERMISSION_TOOL_MATRIX')
    const cell = src.indexOf("manual: 'readonly'", at)
    assert.ok(cell >= 0)
    writeFileSync(abs, src.slice(0, cell) + "manual: 'all'" + src.slice(cell + 18), 'utf8')
    git(dir, ['add', rel]) // 只进索引,不提交
    const staged = G.runAudit({ root: dir, face: 'staged' })
    const head = G.runAudit({ root: dir, face: 'head' })
    assert.ok(staged.problems.length > 0, '索引里的漂移必须被 --staged 抓到')
    assert.equal(head.problems.length, 0, 'HEAD 面仍是好的 —— 两面答案必须不同形')
    assert.notDeepEqual(
      staged.problems.map((p) => p.slice(0, 2)),
      [],
    )
  } finally {
    rmScratch(dir)
  }
})

test('T5 取材面形状锁:必须走 face-reader 的 catBatch,不得回到按磁盘判', () => {
  const src = readFileSync(path.join(REPO, GATE_REL), 'utf8')
  assert.ok(/from '\.\/lib\/face-reader\.mjs'/.test(src), '未引取材层')
  assert.ok(/catBatch\(/.test(src), '未用 catBatch 读被审内容(半接线 = 门自认没收紧)')
  assert.ok(!/readFileSync\(/.test(src), '门脚本不得按磁盘读被审内容(共享工作树会滞后 HEAD)')
  assert.ok(/selectFace\(/.test(src), '未走 selectFace 判档')
})

test('T6 CLI:两面旗同给必须判死,而不是"后者覆盖前者"', () => {
  const r = spawnSync(process.execPath, [path.join(REPO, GATE_REL), '--staged', '--worktree'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 2, `期望 exit 2,实得 ${r.status}:${r.stderr}`)
})

test('T7 零候选不得记绿:decide 面对空输入必须报未判定', () => {
  const r = G.decide({})
  assert.equal(r.problems.length, 0)
  assert.equal(r.undetermined.length, Object.values(G.FILES).length)
})

test('T8 别名调用也得算消费者:数调用而不是数名字(否则 M5 在别名写法下失明)', () => {
  const code = 'x = _resolve_mode_policy(a, b)\n# resolve_mode_policy 只是注释里提了一句\n'
  assert.equal(G.countCalls('resolve_mode_policy', code), 1)
  assert.equal(G.countCalls('resolve_mode_policy', 'y = legacy_mode_check(a)\n'), 0)
})

test('T9 接线成套性:头注声明必须与 runner 现读一致;已注册则必须 blocking + 有应急跳过 env', () => {
  const runner = readFileSync(path.join(REPO, 'scripts/guardian-runner.mjs'), 'utf8')
  const SCRIPT_RE = /script:\s*'[^']*check-mode-permission-matrix\.mjs'/
  const registered = SCRIPT_RE.test(runner)
  const gateSrc = readFileSync(path.join(REPO, GATE_REL), 'utf8')

  // ⚠️ 原未注册分支是一对**措辞 grep**:`!/已接 pre-commit|guardian 第 \d+ 项/`(反向)+
  //   `/尚未接线|注册由主会话/`(正向)。两处都锚在**会被人改写的头注散文**上,而不是锚 runner:
  //   ① 反向锁原状就已 miss —— 头注早已改写成【接线状态:已接入】,不再有"已接 pre-commit"
  //      字样 ⇒ 哪天注册条被摘掉而头注仍自称已接入,这条反向锁**照样绿**(静默假绿,最难发现)。
  //   ② 正向锁的"绿"来自门体中段一句讲"矩阵由另一枚提交带"的散文(讲现实场景那段里的
  //      "注册由主会话落"),与头注无关 ⇒ 那句散文被删就假红,而头注真的写对了也照样红。
  // ⇒ 改成结构判据:头注用**唯一**的【接线状态:…】标记声明接线事实,本用例按 runner 现读
  //    做**双向**对账。措辞不再进断言 ⇒ 头注日后怎么改写都不会假红/假绿。
  const claim = gateSrc.match(/【接线状态:([^】]+)】/)
  assert.ok(claim, '头注缺【接线状态:…】标记 ⇒ 接线声明无处可读,本用例已空转')
  assert.equal(
    claim[1] === '已接入',
    registered,
    `头注声明「接线状态:${claim[1]}」与 runner 现读不一致(registered=${registered})`,
  )
  if (!registered) return

  const at = runner.search(SCRIPT_RE)
  assert.ok(at >= 0, 'runner 注册块缺 script 字段(仅路径字符串不构成装车)')
  // ⚠️ 原来取 `at ± 900` 的**窗口**判 blocking/skipEnv,实测无牙:窗口跨进邻门,邻门的
  // `mode:'blocking'` 替本门交差(把本门自己翻成 warn 后断言仍绿)。改按**注册块边界**取本门那条。
  const start = runner.lastIndexOf('\n  {', at)
  const next = runner.indexOf('\n    script:', at + 10)
  const entry = runner.slice(start < 0 ? at : start, next > 0 ? next : runner.length)
  assert.match(entry, /mode:\s*'blocking'/, '接线了却不是 blocking —— 判对了也没人被打断')
  assert.match(entry, /skipEnv:\s*'HUSKY_SKIP_MODE_PERMISSION_MATRIX'/, '缺应急跳过通道')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
