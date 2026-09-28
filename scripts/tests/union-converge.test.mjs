// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `union-converge.mjs` 镜像测试(§22c:直接 import 源模块,不复制实现)
 *
 * 重点不是"函数返回什么",而是**它真的被装上**:`git-sync-converge` 一遇冲突就交人工,
 * 而人工最容易犯的错是选边 —— 本工具若只存在不被调用,等于没有(AGENTS 守门速查里
 * "判据存在而永不调用 = 没有"那一族的反面教材就是它自己)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch } from '../lib/face-reader.mjs'
import { findMarkerPairs, stripMarkerTriples } from '../lib/conflict-marker-triples.mjs'
import { __test__ as U } from '../union-converge.mjs'
import { auditOne } from '../check-merge-addition-loss.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const HERE = dirname(fileURLToPath(import.meta.url))
/**
 * 真仓取证用的仓库根。默认按本文件自身位置推(`scripts/tests/` 的上两级 = 仓库根);
 * 在沙盒里复跑时(把 scripts/ 整棵拷进临时目录取证)本文件旁边没有 `.git`,
 * 必须用 `IHUI_CONVERGE_EVIDENCE_REPO` 指回真仓 —— **指不到就 assert.fail,
 * 不许把"取不到证据"读成"这一族没有问题"**(AGENTS §22c「镜像只复读实现就是复读机」同源)。
 */
const EVIDENCE_REPO =
  process.env.IHUI_CONVERGE_EVIDENCE_REPO || resolve(HERE, '..', '..')
/**
 * 成对标记的**出处**:枚 `761c0bc9abcef1873a8fa0c9d034cf7d03f5cc70`(2026-09-28 当次的 HEAD),
 * `PROJECT_PLAN.md` 第 16309–16311 行是两侧内容为空的三行,
 * `.ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md` 有两处 ours 侧带一行内容的同形态。
 * 刻意钉在**这个固定 sha**而不是 `HEAD`:账还完之后 HEAD 上就没有标记了,
 * "真仓逐字取材"这条断言的前提会当场失效 —— 而判据是否还有牙,不能跟着存量一起消失。
 */
const MARKER_EVIDENCE = {
  rev: '761c0bc9abcef1873a8fa0c9d034cf7d03f5cc70',
  files: ['PROJECT_PLAN.md', '.ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md'],
}

function fixture() {
  const dir = mkScratch('union-it-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  run('config', 'core.autocrlf', 'false') // 本机实测 autocrlf=true ⇒ 行尾会替归并结果加 CRLF,字节断言必须先钉死
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'init')
  return { dir, run }
}

/**
 * 两侧同改的夹具:`clean.ts` 各改一处不同区域(可干净三方)、`clash.ts` 改同一行(必冲突)、
 * `only-theirs.ts` 只有对侧动过(回归钉:必须仍整文件取对侧)。
 */
function bothTouchedFixture() {
  const { dir, run } = fixture()
  writeFileSync(join(dir, 'clean.ts'), 'l1\nl2\nl3\nl4\nl5\n', 'utf8')
  writeFileSync(join(dir, 'clash.ts'), 'x1\nx2\nx3\n', 'utf8')
  writeFileSync(join(dir, 'only-theirs.ts'), 'ot-base\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'base2')
  writeFileSync(join(dir, 'clean.ts'), 'L1\nl2\nl3\nl4\nl5\n', 'utf8')
  writeFileSync(join(dir, 'clash.ts'), 'x1\nOURS\nx3\n', 'utf8')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\nours\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'ours')
  const ours = run('rev-parse', 'HEAD')
  run('checkout', '-q', 'HEAD~1')
  writeFileSync(join(dir, 'clean.ts'), 'l1\nl2\nl3\nTHEIRS\nl5\n', 'utf8')
  writeFileSync(join(dir, 'clash.ts'), 'x1\nTHEIRS\nx3\n', 'utf8')
  writeFileSync(join(dir, 'only-theirs.ts'), 'ot-theirs\n', 'utf8')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\ntheirs\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'theirs')
  const theirs = run('rev-parse', 'HEAD')
  run('update-ref', 'refs/heads/main', ours)
  run('checkout', '-q', 'main')
  return { dir, run, ours, theirs }
}

test('端到端:两侧独有新增都保住,台账两行都保住,产物经守门 100 复核 0 丢失', () => {
  const { dir, run } = fixture()
  try {
    writeFileSync(join(dir, 'mine.ts'), 'm\n', 'utf8')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\nours\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours')
    const ours = run('rev-parse', 'HEAD')
    run('checkout', '-q', 'HEAD~1')
    writeFileSync(join(dir, 'theirs.ts'), 't\n', 'utf8')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\ntheirs\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs')
    const theirs = run('rev-parse', 'HEAD')
    run('update-ref', 'refs/heads/main', ours)
    // 上一步 `checkout HEAD~1` 把 HEAD 留在了对侧(detached)⇒ 不切回 main,resolveTargets 会看到
    // HEAD == theirs 而报"已同步",于是这条断言测的就不再是产品逻辑而是夹具本身。
    run('checkout', '-q', 'main')

    const p = U.plan(ours, theirs, dir)
    assert.deepEqual(p.bad, [], `零丢失自证必须通过:${p.bad.slice(0, 3).join(' / ')}`)
    assert.ok(p.tookTheirs.includes('theirs.ts'), '对侧新增必须计入"取对侧"清单')
    const sha = run('commit-tree', p.tree, '-p', ours, '-p', theirs, '-m', 'union')
    assert.equal(auditOne(sha, dir).lost.length, 0, '本工具的产物必须通过它自己那道 A1')
    assert.equal(U.resolveTargets(theirs, dir).skip, null, '真分叉时不得报"无需合并"')
  } finally {
    rmScratch(dir)
  }
})

test('反向对照:取某一侧整棵树(选边)必须被 verifyUnion 判失败', () => {
  const { dir, run } = fixture()
  try {
    writeFileSync(join(dir, 'mine.ts'), 'm\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours')
    const ours = run('rev-parse', 'HEAD')
    run('checkout', '-q', 'HEAD~1')
    writeFileSync(join(dir, 'theirs.ts'), 't\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs')
    const theirs = run('rev-parse', 'HEAD')
    run('update-ref', 'refs/heads/main', ours)
    // 上一步 `checkout HEAD~1` 把 HEAD 留在了对侧(detached)⇒ 不切回 main,resolveTargets 会看到
    // HEAD == theirs 而报"已同步",于是这条断言测的就不再是产品逻辑而是夹具本身。
    run('checkout', '-q', 'main')
    const oneSide = run('rev-parse', `${theirs}^{tree}`)
    const bad = U.verifyUnion(ours, theirs, oneSide, dir)
    assert.ok(
      bad.some((b) => b.includes('mine.ts')),
      `选边必须被判红,实际:${bad.join(' / ')}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('行 union 的单调性:任一侧多出的重数不得减少,重复行也要按重数保住', () => {
  const merged = U.unionLines('x\ny\n', 'y\ny\nz\n')
  assert.equal(
    merged.split('\n').filter((l) => l === 'y').length,
    2,
    'theirs 有两个 y ⇒ 结果必须也有两个',
  )
  assert.ok(merged.includes('x') && merged.includes('z'))
  assert.equal(U.unionLines('a\n', 'a\n'), 'a\n', '等重数不得凭空补出新行')
  assert.equal(
    U.unionLines('', 'a\n')
      .split('\n')
      .filter((l) => l === 'a').length,
    1,
    '本侧空文档也要接住对侧行',
  )
})

test('两侧同改不同区域 ⇒ 真三方保住两侧改动(旧写法在这里会整文件取对侧,静默吃掉本侧)', () => {
  const { dir, run, ours, theirs } = bothTouchedFixture()
  try {
    const p = U.plan(ours, theirs, dir)
    assert.ok(
      p.mergedClean.includes('clean.ts'),
      `clean.ts 必须走三方归并并记账,实际:${JSON.stringify(p.mergedClean)}`,
    )
    assert.ok(!p.tookTheirs.includes('clean.ts'), '两侧同改的路径不得再进"整文件取对侧"清单')
    const merged = U.show(p.tree, 'clean.ts', dir)
    assert.equal(
      merged,
      'L1\nl2\nl3\nTHEIRS\nl5',
      `两侧新增行都要在结果里,实际:${merged.replace(/\n/g, '|')}`,
    )
    assert.deepEqual(p.violations, [], `丢行断言不该报违规:${p.violations.join(' / ')}`)
    const sha = run('commit-tree', p.tree, '-p', ours, '-p', theirs, '-m', 'union')
    assert.equal(auditOne(sha, dir).lost.length, 0, '三方归并后的产物仍须过守门 100 的 A1')
  } finally {
    rmScratch(dir)
  }
})

test('两侧同改同一行区域 ⇒ 判失败并点名该文件,绝不悄悄取某一侧', () => {
  const { dir, ours, theirs } = bothTouchedFixture()
  try {
    const p = U.plan(ours, theirs, dir)
    const clash = p.needHuman.find((h) => h.path === 'clash.ts')
    assert.ok(clash, `必须点名 clash.ts,实际:${JSON.stringify(p.needHuman)}`)
    assert.equal(clash.kind, 'conflict', 'merge-file 报的冲突区必须归为 conflict 一类')
    assert.ok(
      p.bad.some((b) => b.includes('clash.ts')),
      '冲突必须同时进落地闸 bad(只看 bad 的调用方也落不了地)',
    )
    assert.equal(U.show(p.tree, 'clash.ts', dir), 'x1\nOURS\nx3', '冲突文件不得被换成对侧内容')
  } finally {
    rmScratch(dir)
  }
})

test('take-ours 是"声明式例外",不是选边后门:同一文件从需人工变成本侧 blob,且必须留名', () => {
  const { dir, ours, theirs } = bothTouchedFixture()
  try {
    const def = U.plan(ours, theirs, dir)
    assert.ok(def.needHuman.some((h) => h.path === 'clash.ts'), '默认必须交人工')

    const forced = U.plan(ours, theirs, dir, new Set(['clash.ts']))
    assert.equal(forced.needHuman.length, 0, '声明取本侧后不得再报需人工')
    assert.deepEqual(forced.keptOurs, ['clash.ts'], '被声明的路径必须逐条点名(不得静默)')
    assert.equal(U.show(forced.tree, 'clash.ts', dir), 'x1\nOURS\nx3', '该路径树内容必须等于本侧版本')
    assert.equal(
      U.blobOf(forced.tree, 'only-theirs.ts', dir),
      U.blobOf(theirs, 'only-theirs.ts', dir),
      '一条例外不得连带丢掉对侧其它独有新增 —— 落地闸其余断言必须照常全绿',
    )
    assert.deepEqual(forced.bad, [], `声明后整棵合并树仍须过零丢失自证:${forced.bad.slice(0, 2).join(' / ')}`)
  } finally {
    rmScratch(dir)
  }
})

test('仅对侧动过 ⇒ 与改前行为逐字一致(整文件取对侧 blob)', () => {
  const { dir, ours, theirs } = bothTouchedFixture()
  try {
    const p = U.plan(ours, theirs, dir)
    assert.ok(p.tookTheirs.includes('only-theirs.ts'), '仅对侧动过必须仍走"取对侧"')
    assert.ok(!p.mergedClean.includes('only-theirs.ts'), '它不该被算进三方归并')
    assert.equal(
      U.blobOf(p.tree, 'only-theirs.ts', dir),
      U.blobOf(theirs, 'only-theirs.ts', dir),
      '树里的 blob 必须逐字等于对侧版本',
    )
    assert.deepEqual(
      U.diffNames(p.base, ours, dir).sort(),
      ['PROJECT_PLAN.md', 'clash.ts', 'clean.ts'],
      '本侧动过的清单按 diff base..ours 计',
    )
  } finally {
    rmScratch(dir)
  }
})

test('丢行判据的边界:另一侧显式删除的基底同名行不计为丢失,但重数下降必须点名', () => {
  assert.deepEqual(
    U.lostAddedLines('d\nd\n', 'd\nd\nd\n', 'd\n', 'd\nd\n'),
    [],
    '对侧删了一份基底 d ⇒ 本侧新增那份保住即可',
  )
  assert.deepEqual(
    U.lostAddedLines('b\n', 'b\nx\n', 'b\n', 'b\n'),
    ['x'],
    '本侧新增行被吃掉必须点名',
  )
  assert.deepEqual(
    U.lostAddedLines('a\n', 'a\nn\nn\n', 'a\n', 'a\nn\n'),
    ['n'],
    '同名的两份新增只剩一份也算丢',
  )
})

test('mergeThreeBlobs 三态:干净出 buffer、冲突报 conflict、二进制报 binary(都不返回可入库的"某一侧")', () => {
  const { dir, run, ours, theirs } = bothTouchedFixture()
  try {
    const base = run('merge-base', ours, theirs)
    const oid = (rev, p) => run('rev-parse', `${rev}:${p}`)
    const clean = U.mergeThreeBlobs(
      oid(base, 'clean.ts'),
      oid(ours, 'clean.ts'),
      oid(theirs, 'clean.ts'),
      dir,
    )
    assert.equal(clean.ok, true, '不同区域的两侧改动必须能干净三方')
    assert.equal(clean.buf.toString('utf8'), 'L1\nl2\nl3\nTHEIRS\nl5\n')
    const conflict = U.mergeThreeBlobs(
      oid(base, 'clash.ts'),
      oid(ours, 'clash.ts'),
      oid(theirs, 'clash.ts'),
      dir,
    )
    assert.equal(conflict.ok, false)
    assert.equal(conflict.kind, 'conflict')
    assert.match(
      conflict.buf.toString('utf8'),
      /^<<<<<<< /m,
      '冲突标记只作证据,函数本身不得被判为可入库',
    )
    writeFileSync(join(dir, 'b.bin'), Buffer.from('a\u0000z\u0000c\n'))
    run('add', '-A')
    run('commit', '-qm', 'ours-bin')
    const oursBin = run('rev-parse', 'HEAD')
    writeFileSync(join(dir, 'b.bin'), Buffer.from('a\u0000y\u0000c\n'))
    run('add', '-A')
    run('commit', '-qm', 'theirs-bin')
    const theirsBin = run('rev-parse', 'HEAD')
    const bin = U.mergeThreeBlobs(
      oid(base, 'clean.ts'),
      U.blobOf(oursBin, 'b.bin', dir),
      U.blobOf(theirsBin, 'b.bin', dir),
      dir,
    )
    assert.equal(bin.kind, 'binary', '二进制两侧同改必须判"无法文本三方",不得选边')
  } finally {
    rmScratch(dir)
  }
})

test('CAS 失败的悬空提交必须本工具自己 tag 掉(否则把噪声留给下一个人)', () => {
  const src = readFileSync(new URL('../union-converge.mjs', import.meta.url), 'utf8')
  const at = src.indexOf('if (cas.status !== 0)')
  assert.ok(at > 0, '找不到 CAS 失败分支')
  const branch = src.slice(at, at + 1200)
  assert.match(branch, /git\(\['tag', tagName, sha/, 'CAS 失败要就地按 §22 打 lost-commit tag')
  assert.match(branch, /lost-commit\/wip-/, "tag 名必须走本仓既有命名族(lost-commit/wip-<sha>)")
  // tag 失败不得掩盖原始故障:仍要 exit 1 并给出手工命令
  assert.match(branch, /process\.exit\(1\)/, 'CAS 失败必须非零退出')
})

test('装车证明:收敛器冲突分支真的会调它,守护真的会调 --all-new 台账', () => {
  const conv = readFileSync(new URL('../git-sync-converge.mjs', import.meta.url), 'utf8')
  assert.match(
    conv,
    /'scripts\/union-converge\.mjs', '--apply'/,
    'merge-tree 冲突必须交给 union-converge,而不是直接 exit 1',
  )
  assert.match(conv, /windowsHide: true/, '派生必须禁弹窗(§5b)')
  assert.match(conv, /timeout: 300000/, '派生必须封顶(守门 80)')
  // 判"结构"而不是判"某行文字长什么样":spawn 与接错被提成 attemptUnionConverge() 后,
  // 原先钉的 `uni = String(ue.stdout …)` 只是换了个变量名,不变量没变 ——
  // **子进程非零退出必须先接住再看输出**(否则 throw 甩成未捕获异常,人工出路根本打不出来)。
  assert.match(
    conv,
    /function attemptUnionConverge\([\s\S]{0,700}?catch \(ue\) \{\s*return String\(ue\.stdout \|\| ue\.message/,
    '归并出口必须自己接住子进程非零退出',
  )
  assert.match(
    conv,
    /attemptUnionConverge\(/g,
    '出口必须被调用',
  )
  // 两个调用点(冲突分支 + 无冲突但状态被放大分支)都走同一个出口,不得各写一遍 spawn。
  // 计数要减掉**定义行**本身 —— 定义与调用的文本形态只差一个 `function ` 前缀,
  // 直接数出现次数会把定义算成第三个调用点(本条第一次跑就是这么红的)。
  {
    const all = (conv.match(/attemptUnionConverge\(freshRemote, repoRoot\)/g) ?? []).length
    const defs = (conv.match(/function attemptUnionConverge\(freshRemote, repoRoot\)/g) ?? []).length
    assert.equal(all - defs, 2, '调用点必须恰好两处(多出来就是有人又写了一遍 spawn)')
  }
  assert.match(conv, /union-converge 亦判需人工/, 'union 也收不了时必须退回人工路径(不得静默)')

  const guard = readFileSync(new URL('../git-guardian.mjs', import.meta.url), 'utf8')
  assert.match(guard, /function auditMergeAdditionLoss\(\)/, '守护里必须有这一层')
  assert.match(guard, /\[script, '--all-new'\]/, '必须走增量台账面(默认面只判未推的合并)')
  assert.match(
    guard,
    /if \(!CHECK_ONLY\) auditMergeAdditionLoss\(\)/,
    '挂点必须在非 --check 分支(挂错等于永不执行)',
  )
  // §5b 那条恢复源刷新原本挂在计划任务上,而任务已实测消失 ⇒ 挂点必须在守护里,
  //   且同样只能挂非 --check 分支;写在这里是因为这三层是同一族"判了得有地方修"。
  assert.match(guard, /function refreshRecoverySource\(\)/, '守护里必须有恢复源刷新层')
  assert.match(
    guard,
    /\[script, '--check'\]|judge\.code === 0/,
    '必须先零副作用早退,不许每轮都去刷',
  )
  assert.match(guard, /if \(!CHECK_ONLY\) refreshRecoverySource\(\)/, '挂点必须在非 --check 分支')

  const hot = readFileSync(new URL('../check-git-read-timeout.mjs', import.meta.url), 'utf8')
  assert.match(hot, /'scripts\/union-converge\.mjs'/, '必须进守门 80 的 HOT 清单')
})

/**
 * F6 块级维度必须真在落地闸的 KEYS 里。为什么单独立一条:
 * "每行重数 = max(两侧)"这条归并规则本身就是整块重复的**生产机制**(两侧各写一份同文块,
 * 并集就留下两份),而行级四条对此全盲 —— 合并提交又不跑 pre-commit。
 * 所以这一维若从 KEYS 里漂走,没有任何其他尺子会喊。
 */
test('planStateRegressions 必须拦"归并把整块登记放大"(F6 在 KEYS 里且有牙)', () => {
  const LP = (s) => s + '　'.repeat(Math.max(0, 46 - [...s].length))
  const BLK = [
    LP('- 块行一:两侧各写一份同文块,并集 max 之后留下两份'),
    LP('- 块行二:第二行,过块级阈值'),
    LP('- 块行三:第三行'),
  ].join('\n')
  const oneSide = `## 甲\n${BLK}\n\n尾行非 bullet`
  const merged = `## 甲\n${BLK}\n## 乙\n${BLK}\n\n尾行非 bullet`
  const hit = U.planStateRegressions(merged, [oneSide, '# 对侧\n没有任何块\n'])
  assert.ok(
    hit.some((x) => x.startsWith('F6')),
    `归并把块放大必须点名 F6,实测 ${JSON.stringify(hit)}`,
  )
  // 反向:等值不得判红(否则收敛永远做不成,唯一结局是人工选边 —— 那正是本工具立项的理由)
  assert.equal(U.planStateRegressions(oneSide, [oneSide, oneSide]).length, 0, '块数等值不得判红')
})

/* ═════════ 活文档并集出口剥掉成对冲突标记三行(2026-09-28 立) ═════════
 * 形状:成对标记进 HEAD ⇒ 守门 79 判红 ⇒ 有人手工删三行并前向提交 ⇒ 下一枚并集合并把仍带这
 * 三行的对侧版本按行 union 补回来(删除不随合并传播是本工具的既定设计)⇒ 红原地复活。
 * 所以必须在并集出口剥掉。本组用例的重点是**判据只有一份**且**真能命中真仓写出来的那一形态**。
 */

/** 真仓逐字取材:从固定 rev 取活文档原文,量出**真实存在**的成对标记(旧逻辑必须判到)。 */
function readVerbatimMarkers() {
  const specs = MARKER_EVIDENCE.files.map((p) => `${MARKER_EVIDENCE.rev}:${p}`)
  let got
  try {
    got = catBatch(EVIDENCE_REPO, specs)
  } catch (e) {
    assert.fail(`真仓取证取不到(仓库根 ${EVIDENCE_REPO}):${e.message}`)
  }
  const found = []
  for (const [i, spec] of specs.entries()) {
    const text = got.get(spec)
    if (text === null || text === undefined)
      assert.fail(
        `出处 ${MARKER_EVIDENCE.rev}:${MARKER_EVIDENCE.files[i]} 取不到 ⇒ 无法复核"逐字取自真仓"这条判据` +
          '(不得把取不到读成"这一族已无标记";沙盒复跑请设 IHUI_CONVERGE_EVIDENCE_REPO 指回真仓)',
      )
    const r = findMarkerPairs(text)
    const lines = text.split('\n')
    for (const p of r.pairs)
      found.push({
        path: MARKER_EVIDENCE.files[i],
        text,
        pair: p,
        triple: [p.startLine, p.sepLine, p.endLine].map((n) => lines[n - 1]),
      })
  }
  return found
}

const multiset = (t) => {
  const m = new Map()
  for (const l of t.split('\n')) m.set(l, (m.get(l) || 0) + 1)
  return m
}

test('真仓逐字取材:该出处确实有 ≥2 对成对标记(证明下面每一条判的不是自造夹具)', () => {
  const found = readVerbatimMarkers()
  assert.ok(
    found.length >= 2,
    `出处 ${MARKER_EVIDENCE.rev.slice(0, 10)} 上成对标记不足 2 对(实得 ${found.length})—— 出处被改写或取证根不对`,
  )
  assert.ok(
    found.some((f) => !f.path.endsWith('PROJECT_PLAN.md')),
    '归档件里那两处(ours 侧带一行内容)也要量到,否则只覆盖了空内容的形态',
  )
})

test('真仓逐字内容喂新逻辑:三行剥净、其余每一行逐字存活、行数差恰等于剥掉的行数', () => {
  for (const f of readVerbatimMarkers()) {
    // 旧逻辑(守门 79 的判据)对同一份内容必须判到成对标记 —— 这就是"阳性对照"
    assert.ok(findMarkerPairs(f.text).pairs.length >= 1, `${f.path}: 旧逻辑竟判不到,夹具失效`)
    assert.equal(f.triple.length, 3, `${f.path}: 三行定位不全(sepLine 为 null 的形态本工具一律不剥)`)
    assert.match(f.triple[0], /^<<<<<<< /, `${f.path}: 开头行形态`)
    assert.equal(f.triple[1], '=======', `${f.path}: 分隔线形态`)
    assert.match(f.triple[2], /^>>>>>>> /, `${f.path}: 结尾行形态`)
    const st = stripMarkerTriples(f.text)
    assert.equal(st.manual.length, 0, `${f.path}: 真仓形态被判成"需人工"(${JSON.stringify(st.manual)})`)
    assert.ok(st.stripped >= 1, `${f.path}: 剥了 0 对`)
    assert.equal(
      findMarkerPairs(st.text).pairs.length,
      0,
      `${f.path}: 剥完仍有成对标记 ⇒ 并集出口对它无效`,
    )
    // 除被剥的那些行外,每一行都逐字存活(多重集比对 —— 重复行要按重数核,不能用"包含")
    const before = multiset(f.text)
    const after = multiset(st.text)
    const removedTotal = [...st.removed.values()].reduce((a, b) => a + b, 0)
    let vanished = 0
    for (const [l, n] of before) vanished += n - (after.get(l) || 0)
    assert.equal(vanished, removedTotal, `${f.path}: 消失的行数(${vanished}) ≠ 剥掉的标记行数(${removedTotal})`)
    assert.equal(
      st.text.split('\n').length,
      f.text.split('\n').length - removedTotal,
      `${f.path}: 行数差不对`,
    )
    // 幂等:再跑一次逐字不变
    const again = stripMarkerTriples(st.text)
    assert.equal(again.text, st.text, `${f.path}: 二次运行改写了内容(不幂等)`)
    assert.equal(again.stripped, 0, `${f.path}: 二次运行还在剥`)
  }
})

test('并集出口:期望表跟着扣掉被剥的三行,而 unionLines 原产出仍带着它们(对照 = 不扣减就会误报丢行)', () => {
  const ours = '- [ ] 甲\n<<<<<<< ours\n=======\n>>>>>>> theirs\n- [ ] 乙\n'
  const theirs = '- [ ] 甲\n- [ ] 乙\n- [ ] 对侧行\n'
  const base = '- [ ] 甲\n- [ ] 乙\n'
  const raw = U.unionLines(ours, theirs, base)
  assert.equal(findMarkerPairs(raw).pairs.length, 1, '对照组:未剥之前必须有一对(否则下面那条是空转)')
  const out = U.liveDocUnionOutput(ours, theirs, base)
  assert.equal(findMarkerPairs(out.text).pairs.length, 0, '产出必须剥净')
  assert.equal(out.want.has('<<<<<<< ours'), false, '期望表必须跟着扣掉被剥行')
  assert.equal(out.want.has('======='), false, '分隔线同样不得留在期望表里')
  assert.equal(out.want.get('- [ ] 甲'), 1, '内容行照旧要求存活(扣减不是万能豁免)')
  assert.equal(out.strip.stripped, 1, '剥了几对必须逐条报名')
})

test('扣减只认"被剥掉的那几行":无成对标记时,与标记同形的合法 Markdown 行不得从期望表里消失', () => {
  // 只有一行 ======= 是合法 setext 下划线 —— 它既不该被剥,也不该被从期望表里扣掉
  const doc = '小节名\n=======\n正文\n'
  const out = U.liveDocUnionOutput(doc, doc, doc)
  assert.equal(out.text, doc, '不得剥单行 =======')
  assert.equal(out.want.get('======='), 1, '没被剥的行不得被扣减(否则零丢失断言就出现豁免口)')
  assert.equal(out.strip.stripped, 0)
})

test('判据只有一份实现:配对判据的定义处与标记正则全仓唯一,两处消费方都走 import', () => {
  const lib = readFileSync(join(HERE, '..', 'lib', 'conflict-marker-triples.mjs'), 'utf8')
  const gate = readFileSync(join(HERE, '..', 'check-no-conflict-markers.mjs'), 'utf8')
  const conv = readFileSync(join(HERE, '..', 'union-converge.mjs'), 'utf8')
  const defs = [lib, gate, conv].filter((s) => /function findMarkerPairs\s*\(/.test(s)).length
  assert.equal(defs, 1, `findMarkerPairs 的定义处必须唯一,实得 ${defs} 处`)
  const regexes = [lib, gate, conv].filter((s) => /\/\^<<<<<<<\s/.test(s)).length
  assert.equal(regexes, 1, '标记行首正则(判据字面量)只许出现在共用层一处')
  assert.match(lib, /function stripMarkerTriples\s*\(/, '剥三行的判据住在共用层')
  assert.doesNotMatch(conv, /function stripMarkerTriples\s*\(/, '消费方不得各自再实现一份 strip')
  assert.doesNotMatch(gate, /function stripMarkerTriples\s*\(/, '同上')
  assert.match(gate, /from '\.\/lib\/conflict-marker-triples\.mjs'/, '守门 79 必须改成 import 共用层')
  assert.match(
    gate,
    /export \{[\s\S]{0,200}?findMarkerPairs[\s\S]{0,200}?from '\.\/lib\/conflict-marker-triples\.mjs'/,
    '守门 79 要 re-export 它,否则 archive-completed-tasks 的既有 import 会断',
  )
  assert.match(conv, /from '\.\/lib\/conflict-marker-triples\.mjs'/, '收敛器必须 import 共用层')
})

test('装车证明:并集出口真的调 strip,落地闸真的在树内容上现读成对标记', () => {
  const conv = readFileSync(join(HERE, '..', 'union-converge.mjs'), 'utf8')
  const build = conv.slice(
    conv.indexOf('export function buildUnion'),
    conv.indexOf('export function verifyUnion'),
  )
  assert.match(build, /liveDocUnionOutput\(/, '活文档循环必须走并集出口(不是直接 unionLines)')
  assert.match(build, /kind: 'conflict-marker'/, '剥不净时必须往 needHuman 里点名这一型')
  assert.match(build, /markerStrips/, '剥了几对必须记录下来供 main() 报名(不得静默改台账)')
  const verify = conv.slice(
    conv.indexOf('export function verifyUnion'),
    conv.indexOf('/** 找一对需要合并的输入'),
  )
  assert.match(verify, /liveDocUnionOutput\(/, '落地闸必须与产出同一个期望表出口')
  assert.match(verify, /findMarkerPairs\(mergedText\)/, '落地闸必须在树内容上现读成对标记')
  assert.match(verify, /未判定/, '取不到内容 ⇒ 未判定并拒绝落地(不静默放行)')
  const main = conv.slice(conv.indexOf('async function main'))
  assert.match(main, /markerStrips \|\| \[\]/, 'main() 必须逐条打印被剥的标记')
  assert.match(main, /markerOrphans \|\| \[\]/, '孤立结尾标记必须逐条报名')
  assert.match(
    main,
    /conflict-marker/,
    '半截标记的人工出路必须被打印出来(不得给一条跑不通的 --resolve 出路)',
  )
})

test('端到端(真临时仓):本侧带成对标记仍能落地且树内容无标记;半截标记必须拒绝落地', () => {
  const { dir, run } = fixture()
  try {
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      '- [ ] 甲\n<<<<<<< ours\n=======\n>>>>>>> theirs\n- [ ] 乙\n',
      'utf8',
    )
    run('add', '-A')
    run('commit', '-qm', 'ours 带成对标记')
    const ours = run('rev-parse', 'HEAD')
    run('checkout', '-q', 'HEAD~1')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\n- [ ] 对侧行\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs')
    const theirs = run('rev-parse', 'HEAD')
    run('update-ref', 'refs/heads/main', ours)
    run('checkout', '-q', 'main')
    const p = U.plan(ours, theirs, dir)
    assert.deepEqual(p.bad, [], `带成对标记不得阻止落地:${p.bad.slice(0, 2).join(' / ')}`)
    const doc = U.show(p.tree, 'PROJECT_PLAN.md', dir)
    assert.equal(findMarkerPairs(doc).pairs.length, 0, `落地内容里不得还有成对标记:${doc}`)
    assert.ok(
      ['- [ ] 甲', '- [ ] 乙', '- [ ] 对侧行'].every((s) => doc.includes(s)),
      `三方内容都要在:${doc}`,
    )
    assert.equal(p.markerStrips.length, 1, '剥标记必须报名')
    // 反向:半截标记 ⇒ 交人工,且不得被"能剥多少剥多少"糊过去
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      '- [ ] 甲\n<<<<<<< ours\n=======\n只剩一半\n',
      'utf8',
    )
    run('add', '-A')
    run('commit', '-qm', 'ours 半截标记')
    const half = run('rev-parse', 'HEAD')
    const q = U.plan(half, theirs, dir)
    assert.ok(
      q.needHuman.some((h) => h.path === 'PROJECT_PLAN.md' && h.kind === 'conflict-marker'),
      `半截标记必须点名需人工:${JSON.stringify(q.needHuman)}`,
    )
    assert.ok(q.bad.length > 0, '半截标记那一轮必须落不了地')
    assert.match(U.show(q.tree, 'PROJECT_PLAN.md', dir), /只剩一半/, '不剥 ⇒ 内容不得被改动')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
