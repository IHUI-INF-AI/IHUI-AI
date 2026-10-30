// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `union-converge.mjs` 的 `--take-theirs-doc` 镜像测试(§22c:直接 import 源模块 __test__,不复制判据)
 *
 * 立因(台账票「生产签出 D:/DevEnv/ihui-prod 停摆的真因」):生产签出收敛时
 * `union-converge --apply --take-theirs <path>` 对活文档声明了路径级选边,但 1) 的活文档行级
 * union 不认这份声明,仍把对侧 121 行滞后基线形态并回结果 —— 路径级选边与行级 union 两层打架。
 * 本组测试钉的是"整份活文档取对侧"这条声明式出口的三面:
 *   ① 产物面 —— 声明后该路径整 blob 逐字等于对侧、行级 union 不跑;
 *   ② 波及面 —— 未声明的活文档照旧行级 union,一条不碰;
 *   ③ 自证面 —— verifyUnion 对这类路径的判据改为"整 blob 等于对侧"(声明不免检),
 *     声明路径不存在/对侧取不到 ⇒ 未判定不记通过;声明了非活文档路径 ⇒ 未命中判红。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as U } from '../union-converge.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { maskComments } from '../lib/code-mask.mjs'
// 括号配平 + 顶层逗号切分只有一个实现(§0.6):形状锁沿用守门 193 的 `callSpan`/`splitArgs`,
// 不在这里抄第二份(抄一份就会在"折行/字符串里带逗号/对象字面量"这三处各自漂开)。
import { callSpan, splitArgs } from '../check-git-stdio-discipline.mjs'

const GIT = resolveGitBin() || 'git'
const here = dirname(fileURLToPath(import.meta.url))
const srcOfTool = () => readFileSync(resolve(here, '..', 'union-converge.mjs'), 'utf8')

/**
 * 源码级形状锁的取材器:按 `headRe` 锚到某处签名/调用的 `(`(锚点必须自己含 `\(`,否则
 * `export function plan` 会串到 `planStateRegressions`),整段交给守门 193 的 `splitArgs` 切顶层。
 *
 * 为什么不写 `foldKeep,\s*takeTheirsDocs,` 这种相邻性正则(2026-10-30 实测的失效形态):
 * 相邻性钉的是"此刻这两个标识符挨着",下次谁在中间插一枚形参,断言红的是"没收到",而真因是
 * **位序漂了** —— 锚错了维度,还会把"插形参把后位参数静默右移"这种真事故藏进一条误报里。
 * 位序对齐(签名第 N 位 ↔ 调用第 N 位)才是这条锁真正想钉的东西。
 */
function argsOf(src, headRe) {
  const m = headRe.exec(src)
  assert.ok(m, `源码级形状锁:源码里找不到 ${headRe}`)
  const open = m.index + m[0].length - 1
  assert.equal(src[open], '(', `源码级形状锁:${headRe} 的锚点没落在 "(" 上(同名函数前缀会串档)`)
  return splitArgs(callSpan(src, open))
}

/** 清单里标识符(形参可带 `= 缺省`)的位置;找不到就当场红,不返回 -1 让下游静默通过。 */
function slotOf(list, name, where) {
  const i = list.findIndex((a) => a.split('=')[0].trim() === name)
  assert.ok(i >= 0, `源码级形状锁:${where} 的清单里找不到 ${name}`)
  return i
}

/** 夹具:PROJECT_PLAN.md 与 README.md 两侧同改(走行级 union 的那一族),对侧另带滞后基线形态。 */
function docTakeoverFixture({ theirsDropsDoc = false } = {}) {
  const dir = mkScratch('union-take-doc-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...a], {
      // 本会话 Node 建子进程 stdin 管道会 EBUSY ⇒ stdin 必须显式 ignore(§12g 同款)
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  run('config', 'core.autocrlf', 'false') // 字节断言前必须钉死行尾(本机 autocrlf=true)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\n', 'utf8')
  writeFileSync(join(dir, 'README.md'), 'r-base\n', 'utf8')
  writeFileSync(join(dir, 'clean.ts'), 'l1\nl2\nl3\nl4\nl5\n', 'utf8')
  writeFileSync(join(dir, 'notes.md'), 'n-base\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'base')
  const base = run('rev-parse', 'HEAD')
  // 本侧:台账加一行自己的、README 加一行自己的
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\nours-line\n', 'utf8')
  writeFileSync(join(dir, 'README.md'), 'r-base\nours-r\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'ours')
  const ours = run('rev-parse', 'HEAD')
  // 对侧:台账带回两行滞后基线形态(正是行级 union 会回灌的那一族),README 同改另一行
  run('checkout', '-q', '-b', 'theirs', base)
  if (theirsDropsDoc) run('rm', '-q', 'PROJECT_PLAN.md')
  else
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      'a\nb\ntheirs-line\n滞后基线甲\n滞后基线乙\n',
      'utf8',
    )
  writeFileSync(join(dir, 'README.md'), 'r-base\ntheirs-r\n', 'utf8')
  writeFileSync(join(dir, 'only-theirs.ts'), 'ot-theirs\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'theirs')
  const theirs = run('rev-parse', 'HEAD')
  run('checkout', '-q', 'main')
  run('update-ref', 'refs/heads/main', ours)
  return { dir, run, base, ours, theirs }
}

/**
 * plan() 的第 4..11 位形参全走缺省,只点第 12 位 takeTheirsDocs(与既有调用方逐字兼容的证明)。
 *
 * 注意:按位置传参就是这条证据本身,也因此最脆:`--declare-side-loss` 的 `declaredLoss` 后来被插在
 * `foldKeep` 与 `takeTheirsDocs` 之间(HEAD 亲测),后位参数整体右移一位 —— 本夹具当时仍按第 11 位
 * 递声明集,`Set` 被喂进 `declaredLoss`(期望 `Map`),`declaredLoss?.get?.(p)` 在 Set 上取不到
 * `get` ⇒ 静默 no-op,五条断言全读成空数组。T-Doc-f 的位序对齐锁给这类"插形参"装了牙:
 * 形状漂了当场红,不允许再以"空数组"的形态安静通过。
 */
const planWithDoc = (ours, theirs, dir, docs) =>
  U.plan(ours, theirs, dir, new Set(), new Map(), new Set(), null, null, null, null, null, docs)

test('T-Doc-a 声明 --take-theirs-doc ⇒ 该活文档整 blob 取对侧、行级 union 不跑(滞后基线不再回灌),且逐条点名', () => {
  const { dir, ours, theirs } = docTakeoverFixture()
  try {
    const p = planWithDoc(ours, theirs, dir, new Set(['PROJECT_PLAN.md']))
    assert.ok(
      p.keptTheirsDocs.includes('PROJECT_PLAN.md'),
      `必须逐条点名(不得静默):${JSON.stringify(p.keptTheirsDocs)}`,
    )
    assert.equal(
      U.blobOf(p.tree, 'PROJECT_PLAN.md', dir),
      U.blobOf(theirs, 'PROJECT_PLAN.md', dir),
      '声明后该路径整 blob 必须逐字等于对侧',
    )
    const doc = U.show(p.tree, 'PROJECT_PLAN.md', dir)
    assert.ok(
      !doc.includes('ours-line'),
      `本侧独有行被整份取代是声明本身:${doc.replace(/\n/g, '|')}`,
    )
    for (const l of ['theirs-line', '滞后基线甲', '滞后基线乙'])
      assert.ok(doc.includes(l), `对侧整份必须原样落地:${doc.replace(/\n/g, '|')}`)
    assert.equal(
      p.bad.length,
      0,
      `自证语义=整 blob 等于对侧 ⇒ 落地闸必须过(不得按行级期望表追讨):${p.bad.slice(0, 3).join(' / ')}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T-Doc-b 未声明的活文档不受影响:README.md 仍走行级 union,两侧独有行都在', () => {
  const { dir, ours, theirs } = docTakeoverFixture()
  try {
    const p = planWithDoc(ours, theirs, dir, new Set(['PROJECT_PLAN.md']))
    assert.ok(
      !p.keptTheirsDocs.includes('README.md'),
      `未声明的路径不得被顺手带上:${JSON.stringify(p.keptTheirsDocs)}`,
    )
    assert.notEqual(
      U.blobOf(p.tree, 'README.md', dir),
      U.blobOf(theirs, 'README.md', dir),
      '未声明路径不得整份取对侧',
    )
    const rd = U.show(p.tree, 'README.md', dir)
    assert.ok(
      rd.includes('ours-r') && rd.includes('theirs-r'),
      `未声明的活文档仍须两侧独有行都存活:${rd.replace(/\n/g, '|')}`,
    )
    // 反向对照:整份取代的"逐条点名"不得多报
    assert.deepEqual(p.keptTheirsDocs, ['PROJECT_PLAN.md'], JSON.stringify(p.keptTheirsDocs))
  } finally {
    rmScratch(dir)
  }
})

test('T-Doc-c 自证面有牙:树里不是对侧 blob 而声明还在 ⇒ verifyUnion 判红(union 结果不得被静默放行)', () => {
  const { dir, base, ours, theirs } = docTakeoverFixture()
  try {
    // 未声明的那一轮:树里 PROJECT_PLAN.md 是行级 union 的产物
    const unionP = U.plan(ours, theirs, dir)
    assert.equal(
      unionP.bad.length,
      0,
      `夹具自证:未声明时零丢失自证必须过:${unionP.bad.slice(0, 3).join(' / ')}`,
    )
    const declared = new Set(['PROJECT_PLAN.md'])
    const red = U.verifyUnion(ours, theirs, unionP.tree, dir, base, null, null, null, declared)
    assert.ok(
      red.some((b) => b.includes('PROJECT_PLAN.md') && b.includes('不等于对侧')),
      `union 产物顶着声明必须判红(不得绕过零丢失自证):${JSON.stringify(red)}`,
    )
    // 正控:同一套输入,树里换成对侧 blob ⇒ 不判红
    const ok = U.verifyUnion(ours, theirs, unionP.tree, dir, base, null, null, null, null)
    assert.equal(
      ok.length,
      0,
      `夹具自证:同一棵树不带声明必须全绿:${JSON.stringify(ok.slice(0, 3))}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T-Doc-d 声明路径两侧都取不到 ⇒ 未判定不记通过(拦落地,绝不冒充"对侧本来就是空的")', () => {
  // 臂一:声明的路径根本不存在
  {
    const { dir, ours, theirs } = docTakeoverFixture()
    try {
      const p = planWithDoc(ours, theirs, dir, new Set(['does/not/exist.md']))
      assert.ok(
        p.bad.some((b) => b.includes('does/not/exist.md') && b.includes('未判定')),
        `不存在的声明必须落未判定:${JSON.stringify(p.bad)}`,
      )
    } finally {
      rmScratch(dir)
    }
  }
  // 臂二:声明的活文档对侧删掉了 ⇒ 对侧 blob 取不到,同一格未判定
  {
    const { dir, ours, theirs } = docTakeoverFixture({ theirsDropsDoc: true })
    try {
      const p = planWithDoc(ours, theirs, dir, new Set(['PROJECT_PLAN.md']))
      assert.ok(
        !p.keptTheirsDocs.includes('PROJECT_PLAN.md'),
        `对侧没有该路径 ⇒ 声明不得被记成已生效:${JSON.stringify(p.keptTheirsDocs)}`,
      )
      assert.ok(
        p.bad.some(
          (b) =>
            b.includes('PROJECT_PLAN.md') &&
            b.includes('未判定') &&
            b.includes('--take-theirs-doc'),
        ),
        `对侧取不到必须未判定点名:${JSON.stringify(p.bad)}`,
      )
    } finally {
      rmScratch(dir)
    }
  }
})

test('T-Doc-e 声明了存在但非活文档的路径 ⇒ 声明未命中判红(整路径取对侧该走 --take-theirs)', () => {
  const { dir, ours, theirs } = docTakeoverFixture()
  try {
    const p = planWithDoc(ours, theirs, dir, new Set(['notes.md']))
    assert.ok(
      p.bad.some(
        (b) => b.includes('notes.md') && b.includes('声明未命中') && b.includes('--take-theirs'),
      ),
      `错道声明必须当场点名:${JSON.stringify(p.bad)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T-Doc-f 装车锁(源码级):CLI 旗标必须真被解析并传到 plan(),判据存在而永不接线 = 没有', () => {
  const src = maskComments(srcOfTool())
  assert.match(
    src,
    /if \(argv\[i\] === '--take-theirs-doc' && argv\[i \+ 1\]\) takeTheirsDocs\.add\(argv\[\+\+i\]\)/,
    'CLI 解析循环里必须有 --take-theirs-doc 的取值分支',
  )
  // 三面(产出/自证/安装)逐面按**位序**对齐:签名第 N 位 ↔ 调用第 N 位。
  // 只判"标识符出现过"会被"解析了但没传"或"传错形参位"这两种静默失效绕过 —— 后者正是本文件
  // 2026-10-30 之前一直红的真因(`declaredLoss` 插队把 `takeTheirsDocs` 右移一位)。
  const planSig = argsOf(src, /export function plan\(/)
  const buildSig = argsOf(src, /export function buildUnion\(/)
  const verifySig = argsOf(src, /export function verifyUnion\(/)
  // 调用侧的锚必须点住 main()/plan() 里那两处:同名的自检调用(`const p = plan(ours, theirs, dir)`)
  // 先出现,只按 `const p = plan(` 取会串到自检那一支(实测 3 参 vs 签名 12 参当场误红)。
  const planCall = argsOf(src, /const p = plan\((?=\s*t\.head,)/)
  const buildCall = argsOf(src, /const built = buildUnion\(/)
  const verifyCall = argsOf(src, /const vu = verifyUnion\(/)
  assert.equal(
    planCall.length,
    planSig.length,
    `main() 调 plan() 的实参数必须与签名形参数相等(少传/多传都是静默右移的温床):${planCall.length} ≠ ${planSig.length}`,
  )
  assert.equal(
    buildCall.length,
    buildSig.length,
    `plan() 调 buildUnion() 的实参数必须与签名形参数相等:${buildCall.length} ≠ ${buildSig.length}`,
  )
  assert.equal(
    verifyCall.length,
    verifySig.length,
    `plan() 调 verifyUnion() 的实参数必须与签名形参数相等:${verifyCall.length} ≠ ${verifySig.length}`,
  )
  assert.equal(
    planCall[slotOf(planSig, 'takeTheirsDocs', 'plan 签名')],
    'takeTheirsDocs.size ? takeTheirsDocs : null',
    'main() 调 plan() 必须把声明集传进去(只解析不传 = 自检绿而生效次数 0)',
  )
  // plan() 必须把它同时喂给 buildUnion(产出面)与 verifyUnion(自证面)—— 两面不同形 = 工具自己锁死
  assert.equal(
    buildCall[slotOf(buildSig, 'takeTheirsDocs', 'buildUnion 签名')],
    'takeTheirsDocs',
    'buildUnion 必须收到声明集',
  )
  assert.equal(
    verifyCall[slotOf(verifySig, 'takeTheirsDocs', 'verifyUnion 签名')],
    'takeTheirsDocs',
    'verifyUnion 必须收到声明集(自证语义=整 blob 等于对侧,不喂就是行级期望表在判)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
