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
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as U } from '../union-converge.mjs'
import { auditOne } from '../check-merge-addition-loss.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'

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
  assert.match(
    conv,
    /uni = String\(ue\.stdout \|\| ue\.message/,
    '子进程非零退出会 throw,必须先接住再看输出,否则错误被甩成未捕获异常',
  )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
