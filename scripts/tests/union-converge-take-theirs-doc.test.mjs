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

const GIT = resolveGitBin() || 'git'
const here = dirname(fileURLToPath(import.meta.url))
const srcOfTool = () => readFileSync(resolve(here, '..', 'union-converge.mjs'), 'utf8')

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
  else writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\ntheirs-line\n滞后基线甲\n滞后基线乙\n', 'utf8')
  writeFileSync(join(dir, 'README.md'), 'r-base\ntheirs-r\n', 'utf8')
  writeFileSync(join(dir, 'only-theirs.ts'), 'ot-theirs\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'theirs')
  const theirs = run('rev-parse', 'HEAD')
  run('checkout', '-q', 'main')
  run('update-ref', 'refs/heads/main', ours)
  return { dir, run, base, ours, theirs }
}

/** plan() 的第 4..10 位形参全走缺省,只点第 11 位 takeTheirsDocs(与既有调用方逐字兼容的证明)。 */
const planWithDoc = (ours, theirs, dir, docs) =>
  U.plan(ours, theirs, dir, new Set(), new Map(), new Set(), null, null, null, null, docs)

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
    assert.ok(!doc.includes('ours-line'), `本侧独有行被整份取代是声明本身:${doc.replace(/\n/g, '|')}`)
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
    assert.equal(unionP.bad.length, 0, `夹具自证:未声明时零丢失自证必须过:${unionP.bad.slice(0, 3).join(' / ')}`)
    const declared = new Set(['PROJECT_PLAN.md'])
    const red = U.verifyUnion(ours, theirs, unionP.tree, dir, base, null, null, null, declared)
    assert.ok(
      red.some((b) => b.includes('PROJECT_PLAN.md') && b.includes('不等于对侧')),
      `union 产物顶着声明必须判红(不得绕过零丢失自证):${JSON.stringify(red)}`,
    )
    // 正控:同一套输入,树里换成对侧 blob ⇒ 不判红
    const ok = U.verifyUnion(ours, theirs, unionP.tree, dir, base, null, null, null, null)
    assert.equal(ok.length, 0, `夹具自证:同一棵树不带声明必须全绿:${JSON.stringify(ok.slice(0, 3))}`)
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
        p.bad.some((b) => b.includes('PROJECT_PLAN.md') && b.includes('未判定') && b.includes('--take-theirs-doc')),
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
      p.bad.some((b) => b.includes('notes.md') && b.includes('声明未命中') && b.includes('--take-theirs')),
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
  assert.match(
    src,
    /takeTheirsDocs\.size \? takeTheirsDocs : null,/,
    'main() 调 plan() 必须把声明集传进去(只解析不传 = 自检绿而生效次数 0)',
  )
  // plan() 必须把它同时喂给 buildUnion(产出面)与 verifyUnion(自证面)—— 两面不同形 = 工具自己锁死
  assert.match(src, /foldKeep,\s*\n\s*takeTheirsDocs,\s*\n\s*\)/, 'buildUnion 必须收到声明集')
  assert.match(
    src,
    /built\.foldLedgers, supersede, takeTheirsDocs\)/,
    'verifyUnion 必须收到声明集(自证语义=整 blob 等于对侧,不喂就是行级期望表在判)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
