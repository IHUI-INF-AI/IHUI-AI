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
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as U } from '../union-converge.mjs'
import { auditOne } from '../check-merge-addition-loss.mjs'
import {
  parseArchivePlaceholders,
  placeholderKeyOfTitle,
  collectReferencedArchives,
  matchRuns,
  MIN_RUN_LINES,
  PLACEHOLDER_TITLE_TRUNC,
} from '../lib/ledger-move-aware.mjs'
import { parseCompletedTaskBlocks } from '../lib/plan-task-headings.mjs'

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
/**
 * ── 搬运感知(2026-09-28 新增维度)的成对端到端用例 ─────────────────────────────
 *
 * 夹具的形状必须是**真实事故那一型**,而不是"基底里有、本侧删掉"那一型 —— 后者三方判据早就拦住了,
 * 拿它当夹具会让用例在改动前后都绿(= 无牙)。真实形状是:
 *   基底 = **已归档形态**(台账里只有占位行,正文在归档件里);
 *   对侧 = 滞后台账副本提交上来的,相对基底把整块正文**当成新增**带了回来;
 *   本侧 = 基底 + 一处无关改动。
 * 这样"带回那些正文行"就是行 union 的既定行为(对侧相对基底确有新增),唯一能拦住它的就是新判据。
 */
const ARCHIVE_PATH = '.ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md'
const PH_JIA = `<!-- 已归档(2026-09-28:甲条目 ✅,完整内容在 ${ARCHIVE_PATH} -->`
const PH_YI = `<!-- 已归档(2026-09-28:乙条目 ✅,完整内容在 ${ARCHIVE_PATH} -->`
/** 归档件里那份"被搬走的正文" —— 与台账里被搬走前逐字同形(归档器就是这么写的)。 */
const ARCHIVE_TEXT =
  '# PROJECT_PLAN 自动归档(2026-09-28)\n\n' +
  '## 甲条目 ✅\n\n- [x] 甲一\n- [x] 甲二\n\n---\n\n' +
  '## 乙条目 ✅\n\n- [x] 乙一\n- [x] 乙二\n- [x] 乙三\n\n---\n\n'
const BASE_DOC = `# 台账\n${PH_JIA}\n${PH_YI}\n- [ ] 还开着的账\n`

/** 造一枚"基底=已归档形态"的临时仓,返回 { dir, run, ours, theirs, base }。 */
function moveAwareFixture(theirsDoc, { putArchive = true } = {}) {
  const dir = mkScratch('union-move-aware-')
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
  run('config', 'core.autocrlf', 'false')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), BASE_DOC, 'utf8')
  if (putArchive) {
    mkdirSync(join(dir, '.ihui-agent', 'archive'), { recursive: true })
    writeFileSync(join(dir, ARCHIVE_PATH), ARCHIVE_TEXT, 'utf8')
  }
  run('add', '-A')
  run('commit', '-qm', 'base(已归档形态)')
  const base = run('rev-parse', 'HEAD')
  // 对侧:滞后台账副本被提交上来 —— 已归档正文整块"新增"回来,外加别人真新写的行
  run('checkout', '-q', '-b', 'theirs', base)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), theirsDoc, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'theirs(滞后台账)')
  const theirs = run('rev-parse', 'HEAD')
  // 本侧:同一基底上的一处无关改动 ⇒ merge-base 恰是 base(夹具自证在下面每条用例里)
  run('checkout', '-q', '-B', 'ours', base)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${BASE_DOC}ours-line\n`, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'ours')
  const ours = run('rev-parse', 'HEAD')
  run('checkout', '-q', 'main')
  run('update-ref', 'refs/heads/main', ours)
  return { dir, run, base, ours, theirs }
}

/** 夹具自证:对侧那份台账里必须真的**带着**被搬走的正文块,否则"没带回"只是因为根本没有。 */
function assertStaleDocHasBlocks(tDoc, titles) {
  const got = parseCompletedTaskBlocks(tDoc).map((b) => placeholderKeyOfTitle(b.titleText))
  for (const t of titles)
    assert.ok(got.includes(t), `夹具自证失败:对侧台账里没有「${t}」这一块 ⇒ 本用例无意义(${got.join('|')})`)
}

test('正例:基准面已有 已归档 占位代表的块 ⇒ 不得从对侧带回正文,且报告逐条点名计数', () => {
  // 台账里甲/乙两块正文都回来了(滞后台),另加一行别人真新写的
  const theirsDoc =
    BASE_DOC +
    '## 甲条目 ✅\n\n- [x] 甲一\n- [x] 甲二\n\n' +
    '- [ ] 别人刚写的一条待办\n' +
    '## 乙条目 ✅\n\n- [x] 乙一\n- [x] 乙二\n- [x] 乙三\n'
  assertStaleDocHasBlocks(theirsDoc, ['甲条目 ✅', '乙条目 ✅'])
  const { dir, run, base, ours, theirs } = moveAwareFixture(theirsDoc)
  try {
    const p = U.plan(ours, theirs, dir)
    assert.equal(
      run('merge-base', ours, theirs),
      base,
      '夹具自证:merge-base 必须是"已归档形态"那枚基底(否则三方判据自己就把这些行拦了,新判据无从表现)',
    )
    const doc = U.show(p.tree, 'PROJECT_PLAN.md', dir)
    for (const l of ['- [x] 甲一', '- [x] 甲二', '- [x] 乙一', '- [x] 乙三', '## 甲条目 ✅', '## 乙条目 ✅'])
      assert.ok(!doc.split('\n').includes(l), `已归档正文被带回:${l}`)
    assert.ok(doc.split('\n').includes('- [ ] 别人刚写的一条待办'), '别人新写的行必须照旧取回')
    assert.ok(doc.includes(PH_JIA) && doc.includes(PH_YI), '本侧的占位行不得被动摇')
    // 变异对照(证明拦住它们的是**新判据**,不是夹具恰好没写出来):
    // 同样三份文本、同一张基底,把抑制表换成 null ⇒ 那些行必须原样回来。
    const withoutTable = U.unionLines(
      U.show(ours, 'PROJECT_PLAN.md', dir),
      U.show(theirs, 'PROJECT_PLAN.md', dir),
      U.show(base, 'PROJECT_PLAN.md', dir),
      null,
    )
    assert.ok(
      withoutTable.split('\n').includes('- [x] 甲一') &&
        withoutTable.split('\n').includes('- [x] 乙三'),
      '摘掉新判据后仍不带回已归档正文 ⇒ 本用例没有牙(测的是夹具不是判据)',
    )
    assert.deepEqual(p.bad, [], `落地闸必须照旧过:${p.bad.slice(0, 3).join(' / ')}`)
    const ma = p.moveAware.find((x) => x.doc === 'PROJECT_PLAN.md')
    assert.ok(ma, 'plan() 必须把搬运感知这一维带出来(不得静默)')
    assert.equal(
      ma.stats.suppressedLines,
      7,
      '甲(标题 + 2 条)+ 乙(标题 + 3 条)= 7 行 —— 标题行也属被搬走的正文;空行不参与抑制',
    )
    assert.equal(ma.suppressedBlocks.length, 2)
    assert.deepEqual(
      [...ma.suppressedBlocks.map((b) => b.title)].sort((x, y) => (x < y ? -1 : 1)),
      ['乙条目 ✅', '甲条目 ✅'].sort((x, y) => (x < y ? -1 : 1)),
      '未取回的必须按条目块点名到标题',
    )
    assert.ok(
      ma.suppressedBlocks.every((b) => b.archivePath === ARCHIVE_PATH),
      '每一块都要给出它是被哪一份归档件代表的(证据链要能追)',
    )
    // 报告出口:三态必须各有各的话,且计数与结构一致
    const lines = U.formatMoveAwareReport(p.moveAware)
    assert.ok(
      lines.some((l) => l.includes('因搬运感知未取回 7 行') && l.includes('PROJECT_PLAN.md')),
      lines.join(' / '),
    )
    assert.ok(lines.some((l) => l.includes('甲条目') && l.includes(ARCHIVE_PATH)), lines.join(' / '))
    assert.equal(auditOne(run('commit-tree', p.tree, '-p', ours, '-p', theirs, '-m', 'u'), dir).lost.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('牙(比正例更重要):不属于任何占位代表的行一条都不许少带 —— 含"块内新写的一行"', () => {
  // 甲块内部插了一条别人新写的登记(它自己就是把连续段断开的断点);乙块整体是别人新写的条目
  const theirsDoc =
    BASE_DOC +
    '- [ ] 完全独立的新登记\n' +
    '## 甲条目 ✅\n\n- [x] 甲一\n- [ ] 别人刚在块里补的一行\n- [x] 甲二\n\n' +
    '## 丙条目 ✅\n\n- [x] 丙一\n- [x] 丙二\n'
  // 只解构用得到的三项:`run`/`base` 在本用例没有调用点,留着会被 eslint(no-unused-vars)
  // 判红。这一型红在 HEAD 上躺了一段时间,后果是**任何碰这个文件的提交都被 lint-staged 挡在
  // 守门批之前**(2026-09-28 实测:safe-commit 的归因层把它定责到提交者,这是对的),
  // 而守门批跑不起来 = 那枚提交上全部对账作废。
  const { dir, ours, theirs } = moveAwareFixture(theirsDoc)
  try {
    const p = U.plan(ours, theirs, dir)
    const doc = U.show(p.tree, 'PROJECT_PLAN.md', dir)
    const lines = doc.split('\n')
    for (const must of [
      '- [ ] 完全独立的新登记',
      '- [ ] 别人刚在块里补的一行',
      '## 丙条目 ✅',
      '- [x] 丙一',
      '- [x] 丙二',
    ])
      assert.ok(lines.includes(must), `少带了别人新写的行:${must}`)
    // 同一条用例里另一半:确被代表的行仍然不得带回(证明上面"没少带"不是靠关掉判据换来的)
    assert.ok(!lines.includes('- [x] 甲一'), '被占位代表的行仍须拦住,否则反例是在放水')
    const ma = p.moveAware.find((x) => x.doc === 'PROJECT_PLAN.md')
    assert.equal(ma.stats.suppressedLines, 2, '甲块只剩两行被代表(新写那行把连续段切断了)')
    assert.ok(!ma.suppressedBlocks.some((b) => b.title === '丙条目 ✅'), '没有被占位点名的条目不得被抑制')
  } finally {
    rmScratch(dir)
  }
})

test('归档件取不到 = 坏指针 ⇒ 一律照旧取回并打印未判定原因,绝不当成"已归档"', () => {
  const theirsDoc = BASE_DOC + '## 甲条目 ✅\n\n- [x] 甲一\n- [x] 甲二\n'
  assertStaleDocHasBlocks(theirsDoc, ['甲条目 ✅'])
  // 占位在,但它点名的归档文件**从来没入库**(真仓里就有这一型:占位指向盘上有、面上没有的文件)
  const { dir, ours, theirs } = moveAwareFixture(theirsDoc, { putArchive: false })
  try {
    const p = U.plan(ours, theirs, dir)
    const lines = U.show(p.tree, 'PROJECT_PLAN.md', dir).split('\n')
    assert.ok(lines.includes('- [x] 甲一'), '内容证据拿不到时必须照旧取回(失效方向=多带一行)')
    assert.ok(lines.includes('## 甲条目 ✅'), '同上:整块都不得被抑制')
    const ma = p.moveAware.find((x) => x.doc === 'PROJECT_PLAN.md')
    assert.equal(ma.stats.suppressedLines, 0)
    assert.equal(ma.undetermined.length, 1, JSON.stringify(ma))
    assert.match(ma.undetermined[0].reason, /取不到|坏指针/, JSON.stringify(ma.undetermined))
    const rep = U.formatMoveAwareReport(p.moveAware)
    assert.ok(
      rep.some((l) => l.includes('未判定') && l.includes('照旧取回')),
      `未判定必须打印出来,不得静默:${rep.join(' / ')}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('同一形状的另一支:占位写的是通配归档件名 ⇒ 不指向可核验内容 ⇒ 照旧取回', () => {
  const oursDoc =
    '# 台账\n<!-- 已归档(2026-09-28:甲条目 ✅,完整内容在 .ihui-agent/archive/PROJECT_PLAN_*.md -->\n- [ ] 还开着的账\n'
  const theirsDoc = oursDoc + '## 甲条目 ✅\n\n- [x] 甲一\n- [x] 甲二\n'
  const dir = mkScratch('union-move-wild-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    }).trim()
  try {
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 't@t')
    run('config', 'user.name', 't')
    run('config', 'core.autocrlf', 'false')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), oursDoc, 'utf8')
    mkdirSync(join(dir, '.ihui-agent', 'archive'), { recursive: true })
    writeFileSync(join(dir, ARCHIVE_PATH), ARCHIVE_TEXT, 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'base')
    const base = run('rev-parse', 'HEAD')
    run('checkout', '-q', '-b', 'theirs', base)
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), theirsDoc, 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs')
    const theirs = run('rev-parse', 'HEAD')
    run('checkout', '-q', '-B', 'ours', base)
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${oursDoc}\nours-line\n`, 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours')
    const ours = run('rev-parse', 'HEAD')
    const p = U.plan(ours, theirs, dir)
    const lines = U.show(p.tree, 'PROJECT_PLAN.md', dir).split('\n')
    assert.ok(lines.includes('- [x] 甲一'), '通配占位不构成代表 ⇒ 必须照旧取回')
    assert.equal(collectReferencedArchives(oursDoc, theirsDoc).size, 0, '通配路径不得进"要读的归档件"清单')
    const ma = p.moveAware.find((x) => x.doc === 'PROJECT_PLAN.md')
    assert.equal(ma.undetermined.length, 1, JSON.stringify(ma.undetermined))
    assert.match(ma.undetermined[0].reason, /通配/)
  } finally {
    rmScratch(dir)
  }
})

/**
 * 反漂移锁:**占位形态的规格住在归档器里,不在本测试里重写一遍。**
 * 取 `archive-completed-tasks.mjs` 真产出的 `placeholderLine()` 输出喂给判据的解析器 ——
 * 归档器哪天改文案,这条必红(§22c:镜像判据的对象是"某个真实文件的形态"时,输入必须逐字取自那个文件)。
 */
test('占位解析必须吃得下归档器真产出的那一行(含 60 字截断与"随块带走的归并落账注记"段)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const script = pathToFileURL(join(here, '..', 'archive-completed-tasks.mjs')).href
  const ARCH = 'PROJECT_PLAN_2026-09-28_auto-archive.md'
  const call = (...a) => `m.__test__.placeholderLine(${a.map((s) => JSON.stringify(s)).join(',')})`
  const args = [
    ['2026-09-28', '甲条目 ✅', ARCH],
    ['2026-09-28', '乙条目 ✅', ARCH, '〔【归并】乙 落账:复测 2026-09-28: 取证〕'],
    ['2026-09-28', 'x'.repeat(90), ARCH],
  ]
  const code =
    'import(' +
    JSON.stringify(script) +
    ').then((m)=>process.stdout.write(JSON.stringify([' +
    args.map((a) => call(...a)).join(',') +
    '])))'
  const r = spawnSync(process.execPath, ['-e', code], {
    cwd: join(here, '..', '..'),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  assert.equal(r.status, 0, `取归档器的真占位出口失败:${String(r.stderr).slice(0, 300)}`)
  const [plain, withNotes, truncated] = JSON.parse(r.stdout)
  assert.match(plain, /^<!--\s*已归档\(/, `归档器产出的形态变了:${plain}`)
  for (const [line, wantTitle] of [
    [plain, '甲条目 ✅'],
    [withNotes, '乙条目 ✅'],
    [truncated, 'x'.repeat(PLACEHOLDER_TITLE_TRUNC)],
  ]) {
    const got = parseArchivePlaceholders(line)
    assert.equal(got.length, 1, `一行占位应解析出一条:${line}`)
    assert.equal(got[0].title, wantTitle, `标题段取错:${line}`)
    assert.equal(got[0].resolvable, true, `可核验性判错:${got[0].whyNot}`)
    assert.equal(got[0].archivePath, `.ihui-agent/archive/${ARCH}`)
  }
  assert.ok(
    withNotes.includes('随块带走的归并落账注记'),
    '夹具自证:这条真产出必须确实带注记段,否则上面那条断言是空转',
  )
  const truncatedTitle = parseArchivePlaceholders(truncated)[0].title
  assert.equal(
    truncatedTitle.length,
    PLACEHOLDER_TITLE_TRUNC,
    `归档器对占位标题的截断长度与本判据配对键用的长度不再是同一个数(本器 ${truncatedTitle.length} / 判据 ${PLACEHOLDER_TITLE_TRUNC})⇒ 配对会静默失配,这条必须红着逼人回来改`,
  )
  assert.match(truncatedTitle, /^x+$/, '截断取的必须就是标题开头那一段')
})

test('抑制表只减对侧贡献,绝不动本侧自己的重数(少带=丢别人内容,方向不允许)', () => {
  const count = (s, l) => s.split('\n').filter((x) => x === l).length
  const ours = 'a\nb\n'
  const theirs = 'a\na\na\n'
  const base = 'a\n'
  // 不设抑制:对侧比基底多 2 份 ⇒ 补回 2 份(共 3 份),这是本工具的既定行为
  assert.equal(count(U.unionLines(ours, theirs, base), 'a'), 3, '夹具自证:无抑制时对侧净增必须补回')
  // 抑制 2 份:对侧贡献归零,本侧那一份原样在
  assert.equal(count(U.unionLines(ours, theirs, base, new Map([['a', 2]])), 'a'), 1)
  // 抑制表给得再多(99,远超对侧重数)也**不得**把本侧自己那一份吃掉 —— 只减对侧,不减本侧
  assert.equal(count(U.unionLines(ours, theirs, base, new Map([['a', 99]])), 'a'), 1, '本侧的行被抑制表吃掉了')
  assert.ok(U.unionLines(ours, theirs, base, new Map([['a', 99]])).includes('b'), '本侧其余行不得受影响')
})

test('matchRuns 的门槛:单行相同不算证据,两行连续才算(台账同文行成百)', () => {
  const hay = ['a', 'b', 'c']
  assert.equal(matchRuns(['a'], hay).covered.filter(Boolean).length, 0, '一段只有一行 ⇒ 不算被代表')
  assert.equal(matchRuns(['a', 'b'], hay).covered.filter(Boolean).length, 2)
  assert.equal(MIN_RUN_LINES, 2)
  // 中间插一行别人的 ⇒ 断点前后各自成段,断点那行永远不被覆盖(这就是"少带不可能"的构造证明)
  const m = matchRuns(['a', 'b', '别人新写', 'c'], hay)
  assert.deepEqual(m.covered, [true, true, false, false], JSON.stringify(m))
})

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

/**
 * 反假红锁:`core.quotepath` 默认 true 会把中文路径输出成 `"...\346\226\207..."`,
 * 而落地闸拿这份转义串去合并树里找同名路径 ⇒ 找不到 ⇒ 判"合并树丢了对侧路径"。
 * 2026-09-28 实测:`docs/benchmark-evidence/2026-09/reconcile-附录C.md` 等 **5 枚真实存在的文件**
 * 被判成丢失,整条收敛被堵死 —— 症状不是"少一个功能",而是"谁都合不了并,只能人工选边",
 * 而人工选边正是本工具立项要消灭的那个动作。
 */
test('中文路径不得被 quotePath 转义成"丢失",且每个 git 派生点都必须带上开关', () => {
  const dir = mkScratch('union-quotepath-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    }).trim()
  try {
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 't@t')
    run('config', 'user.name', 't')
    run('config', 'core.autocrlf', 'false')
    writeFileSync(join(dir, 'base.txt'), 'b\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'init')
    // 本侧:只动一个普通文件
    writeFileSync(join(dir, 'ours.txt'), 'o\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours')
    const ours = run('rev-parse', 'HEAD')
    // 对侧:回退一格后加一枚**中文命名**的文件
    run('checkout', '-q', 'HEAD~1')
    mkdirSync(join(dir, 'docs'))
    writeFileSync(join(dir, 'docs/附录C.md'), 't\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs')
    const theirs = run('rev-parse', 'HEAD')

    const listed = U.listPaths(theirs, dir)
    assert.ok(listed.includes('docs/附录C.md'), `枚举面必须给出真名,实测 ${JSON.stringify(listed)}`)
    assert.ok(
      !listed.some((p) => p.includes('\\3')),
      `枚举面里不得出现 quotePath 八进制转义形态:${JSON.stringify(listed.filter((p) => p.includes('\\3')))} —— 出现即说明该派生点又漏了开关`,
    )
    const named = U.diffNames(run('rev-parse', 'HEAD~1'), theirs, dir)
    assert.ok(named.includes('docs/附录C.md'), `diff 面同样必须给出真名,实测 ${JSON.stringify(named)}`)

    // 形状锁:本文件里每一处带 safe.directory 的 git 派生都必须同时带 quotepath 开关
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'union-converge.mjs'), 'utf8')
    const missing = src
      .split('\n')
      .filter((l) => /'-c',\s*'safe\.directory=\*'/.test(l) && !/core\.quotepath=false/.test(l))
    assert.deepEqual(missing, [], `这些 git 派生点缺 core.quotepath=false:\n${missing.join('\n')}`)
    assert.ok(ours && theirs, '夹具自证:两侧提交都真在位')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
