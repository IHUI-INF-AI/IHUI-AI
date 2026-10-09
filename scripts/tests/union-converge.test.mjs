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
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
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
import { maskComments } from '../lib/code-mask.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'

function fixture() {
  const dir = mkScratch('union-it-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
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
  // 「派生必须封顶」这一条原先钉的是字面量 `timeout: 300000`,现已换成**形状判据**(在下方
  // attemptUnionConverge 的函数体里判)—— 理由写在那一段,不要把它改回一个数字。
  // 判"结构"而不是判"某行文字长什么样":spawn 与接错被提成 attemptUnionConverge() 后,
  // 原先钉的 `uni = String(ue.stdout …)` 只是换了个变量名,不变量没变 ——
  // **子进程非零退出必须先接住再看输出**(否则 throw 甩成未捕获异常,人工出路根本打不出来)。
  // ⚠️ 判据载体从"函数名后 700 字符的窗口"换成**函数体本身**(2026-09-29 G-815406 顺带修):
  // 窗口量在 HEAD 上是 1347 字符(函数头注越长窗口越够不着)⇒ 这条锁**自那次加注释起就恒红**,
  // 只是长期被"本测试文件 import 不到 union-converge"的装载崩溃挡在门外,没人看见它红。
  // 换成函数体切片后:catch 仍是第一条语句才过,把 return 挪走或删掉 stderr 拼接都会翻红。
  {
    const start = conv.indexOf('function attemptUnionConverge(')
    assert.ok(start > 0, '找不到归并出口的定义 ⇒ 本锁对着空气判绿')
    const rest = conv.slice(start)
    const body = rest.slice(0, rest.indexOf('\n}\n') + 3)
    assert.match(
      body,
      /catch \(ue\) \{\s*return String\(ue\.stdout \|\| ue\.message/,
      '归并出口必须自己接住子进程非零退出,且优先回吐 stdout(裁决文本)',
    )
    assert.ok(body.includes('stderrTail(ue)'), 'catch 必须把子进程 stderr 接上(import 期崩溃时 stdout 是空的)')
    /**
     * 派生必须封顶(守门 80)——**判形状,不判字面量**。
     *
     * 为什么这才是想要的性质:本锁原钉的是 `timeout: 300000` 那个数,而 300000 在 2026-09-28 被
     * **有意**改成 1500000(实测一次 `--apply` 要 2–13 分钟,300s 封顶等于自动收敛永不成功 ——
     * 该决定写在 git-sync-converge.mjs 里 attemptUnionConverge 的注释上,并留了
     * `IHUI_UNION_CONVERGE_TIMEOUT_MS` 这条人工出口)。守门 80 要的从来不是"恰好 300 秒",
     * 而是**"派出去的子进程一定带一个有限上界,不会无界挂住"**(§5b 那次 `git ls-files` 挂 80 分钟、
     * CPU 只用 2.84s,就是没有上界的形状)。把锁写成字面量,它就把"调参"当成"违规",而下一次调参的
     * 人只会把锁改宽或整个删掉 —— 那是本仓记过最多次的失效路径(镜像测试只复读实现的一个数字,
     * 数字一变锁就成了噪声源,§22c)。
     *
     * 现在判三条:
     *  ① 归并出口那处 spawn 的 options 里必须出现 `timeout` 键(没有键 = 无界,直接红);
     *  ② 它的数值上界必须是**有限正数且 ≥ 60_000** —— 低于一分钟属"名义上有封顶、实际上跑不完",
     *     与没有封顶同罪(那才是本仓真发生过的形状);
     *  ③ env 覆盖档必须带**数字兜底**:`Number(process.env.X || 1500000)` 可,
     *     `Number(process.env.X)` 不可 —— 没兜底时一个非法 env 就把封顶变成 NaN/无界。
     *
     * 如实登记一条判据边界:值写成**标识符**(如 `timeout: GIT_TIMEOUT`)时本锁读不出数,
     * 会按 ① 之外的"无可判上界"翻红。这是刻意的窄口径(守门 80 自己也只认字面量与简写两形态),
     * 真要改用常量,请连同本锁一起改成解析那条常量,不得为变绿把 ②③ 删掉。
     */
    const capValue = (s) => {
      if (/^Number\(/.test(s)) {
        const fb = s.match(/\|\|\s*([0-9][0-9_]*)\s*\)/)?.[1]
        return fb === undefined ? null : Number(fb.replace(/_/g, ''))
      }
      return /^[0-9][0-9_]*$/.test(s) ? Number(s.replace(/_/g, '')) : null
    }
    const caps = [...body.matchAll(/timeout:\s*(Number\([^)]*\)|[0-9][0-9_]*)/g)].map((m) =>
      capValue(m[1]),
    )
    assert.ok(body.includes('timeout:'), '归并出口的 spawn 必须带 timeout 键(守门 80:热路径派生一律封顶)')
    assert.ok(
      caps.length >= 1 && caps.every((v) => Number.isFinite(v) && v >= 60_000),
      `封顶必须是 ≥ 60000 的有限正数(env 档须带数字兜底),实测 ${JSON.stringify(caps)} —— ` +
        '上界读不出、小于 1 分钟、或 env 无兜底,三种都等于没封顶',
    )
  }
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
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
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
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
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
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
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
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
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

/**
 * ── 「远端 sha 已取到、但该对象不在本机」这一格(G-473 的收口)──────────────────────
 *
 * 这一族判据要钉的不是"函数返回什么",而是**三个方向的错向各有一条锁**:
 *  ① 错向一(最贵):把"判不了"报成"无事可做" ⇒ exit 0 + "无需合并"。明明有待合并,
 *     调用方据此跳过一整轮收敛,账面全绿而分叉永久留着 —— 本仓记过最多次的失效型。
 *  ② 错向二:把"判不了"报成"工具坏了" ⇒ 一串 Node 堆栈加 `Not a valid commit name`,
 *     现场的人既得不到结论也得不到出路(这正是三次实测复现时账面看到的东西)。
 *  ③ 错向三:为了让它别崩,悄悄改用**跟踪 ref 的残值**继续往下合 —— 那会对着一个
 *     早已不存在的分叉做合并,比崩掉坏得多。这一条由源码级反向锁钉死(见 R-C-3),
 *     因为"没写出来的东西"结构上无法用行为用例证明。
 * 三条都有牙证明:① 用构造面断 exit 码与文案;② 用 CLI 端到端断 stderr 无堆栈;
 * ③ 用变异自证 —— 把禁写的回落真写进去,那条锁必须翻红。
 */

/** 大括号配对取出顶层函数体(形状锁用它:否则"函数在文件里"会被读成"判据在函数里")。 */
function topLevelBody(src, header) {
  const at = src.indexOf(header)
  assert.notEqual(at, -1, `源文件里找不到 ${header}`)
  let depth = 0
  for (let j = src.indexOf('{', at); j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') {
      depth--
      if (depth === 0) return src.slice(src.indexOf('{', at), j + 1)
    }
  }
  return assert.fail(`${header} 的括号没配平`)
}

/** 出路文案的判据输入全走构造面 —— 不依赖仓库恰好处于哪种状态。 */
const BOGUS_SHA = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
const srcOfTool = () =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'union-converge.mjs'), 'utf8')

test('R-A 出路文案:对侧 sha 不可达 ⇒ 只给按分支取的 fetch,并给得出免联网出口', () => {
  const g = U.unreachableObjectGuidance({
    missing: [BOGUS_SHA],
    theirs: BOGUS_SHA,
    head: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    branch: 'main',
  })
  assert.match(g, /git fetch origin main/, '必须给得出**按分支**取的命令(带真实分支名)')
  assert.match(g, /--theirs/, '必须同时给得出免联网出口(显式喂本地已可达的 sha)')
  assert.match(g, /不代跑 fetch/, '必须写明本器不代跑 fetch(写操作归属留给调用方)')
  // 关键的反向锁:文案里**不得**把"按 sha 直取"包装成一条可执行命令 ——
  // 公共托管默认拒绝未公布对象,而该 sha 是否还公布着恰恰在并发高峰最先失效,
  // 给出去就是第二条"文档写了却跑不通的出路"。
  assert.doesNotMatch(
    g,
    /fetch[^\n]*origin [0-9a-f]{7,40}/,
    `出路里不得出现「fetch … origin <具体 sha>」这种跑不通的命令:\n${g}`,
  )
})

test('R-B 出路文案:缺的是本地 HEAD ⇒ 不许喊 fetch,按 §5b 指向 gitdir/refs 体检', () => {
  const g = U.unreachableObjectGuidance({
    missing: [BOGUS_SHA],
    theirs: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    head: BOGUS_SHA,
    branch: 'main',
  })
  assert.match(g, /git-refs-heal|gitdir/, '本地 HEAD 不可达属 gitdir/refs 受损,必须指向该出口')
  assert.ok(!/出口①/.test(g), '这一型绝不能告诉人去 fetch 本机 HEAD 的 sha(无效且掩盖更重现场)')
})

test('R-C 出路文案:分支名取不到时宁可留占位,也不得印出「fetch origin HEAD」', () => {
  const g = U.unreachableObjectGuidance({ missing: [BOGUS_SHA], theirs: BOGUS_SHA, head: '', branch: '' })
  assert.match(g, /<当前分支名>/, '拿不到分支名要打占位,让人自己补')
  assert.ok(!/fetch origin HEAD/.test(g), 'detached 时 --abbrev-ref 回 "HEAD",照抄会产出一条必然失败的命令')
})

test('R-D 构造面三态:可达 / 不可达 / 已同步,各走各的出口', () => {
  const { dir, run } = fixture()
  try {
    // 造一个**分叉**且对侧可达的形态。两条都必须成立,缺一这条用例就是假的:
    //  · HEAD 必须停在 ours(否则 theirs==head,resolveTargets 会判"已同步"而不是"该合并");
    //  · HEAD 必须落在**具名分支**上(detached 时 --abbrev-ref 回 "HEAD",出路文案只能打占位,
    //    于是"分支名取自被审仓库"这一维根本没被证明)。所以分叉长在另一条分支上,再切回来。
    const base = run('rev-parse', 'HEAD')
    writeFileSync(join(dir, 'ours.txt'), 'o\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours')
    const ours = run('rev-parse', 'HEAD')
    run('checkout', '-q', '-b', 'theirs-side', base)
    writeFileSync(join(dir, 'theirs.txt'), 't\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs')
    const theirs = run('rev-parse', 'HEAD')
    run('checkout', '-q', 'main')
    assert.equal(run('rev-parse', '--abbrev-ref', 'HEAD'), 'main', '夹具自证:HEAD 必须回到具名分支')
    assert.notEqual(ours, theirs, '夹具自证:两侧必须真的分叉')

    // ① 可达 ⇒ 既不是 skip 也不是 undetermined,正常交给 plan
    const ok = U.resolveTargets(theirs, dir)
    assert.equal(ok.skip, null, `可达时不该给 skip:${ok.skip}`)
    assert.equal(ok.undetermined, undefined, '可达时不该判未判定 —— 否则本票把正常路径改坏了')
    assert.equal(ok.theirs, theirs)
    const p = U.plan(ours, theirs, dir)
    assert.match(p.base, /^[0-9a-f]{40}$/, 'plan 必须真算出共同祖先而不是抛堆栈')

    // ② 不可达 ⇒ 未判定,且**不得**继续把 sha 交给祖先判据
    const bad = U.resolveTargets(BOGUS_SHA, dir)
    assert.equal(bad.skip, null, '不可达不是"无事可做",绝不能落进 skip')
    assert.equal(typeof bad.undetermined, 'string', '必须给出未判定文案')
    assert.match(bad.undetermined, /git fetch origin main/, '文案里的分支名必须来自被审的那个仓')

    // ③ 已同步 ⇒ 文案与退出路数一字不动(反向对照)
    const same = U.resolveTargets(ours, dir) // cwd=dir → head===ours → 已同步
    assert.equal(same.skip, '已同步')
    assert.equal(same.undetermined, undefined)
  } finally {
    rmScratch(dir)
  }
})

test('R-E 端到端:同一判据在 CLI 上落成的退出码是 2 / 0,且 stderr 没有 Node 堆栈', () => {
  // 夹具必须**自带一份脚本闭包**:脚本的 ROOT 由自身位置推导,不复制进去子进程就会去问真仓,
  // 那条用例测的就不是构造面(§22c「夹具复刻的是实现的形状」那一族的反面教材)。
  const { dir, run } = fixture()
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const root = join(here, '..')
    // 沿相对 import 说明符走一遍闭包(键取绝对路径,免做分隔符归一 —— 归一是本仓记过的坑)。
    // **不得**用"说明符里含 .. 就跳过"当越界判据:`lib/plan-task-index.mjs` 正是以
    // `'../check-plan-line-loss.mjs'` 往回摸根脚本的,那样跳会把闭包走漏成 8/10,
    // 子进程随即 ERR_MODULE_NOT_FOUND 以 exit 1 崩掉 —— 而本用例判的正是 exit 2,
    // 一条测具缺陷会伪装成"判据没生效"。越界一律按**解析后的相对位置**判。
    const copied = new Set()
    const walk = (abs) => {
      if (copied.has(abs)) return
      copied.add(abs)
      const src = readFileSync(abs, 'utf8')
      for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
        let t = resolve(dirname(abs), m[1])
        if (!existsSync(t) && existsSync(`${t}.mjs`)) t = `${t}.mjs`
        if (!existsSync(t)) continue
        if (relative(root, t).startsWith('..')) continue // 真越出 scripts/ 才不拷
        walk(t)
      }
    }
    walk(join(root, 'union-converge.mjs'))
    assert.ok(copied.size > 3, `闭包只走到 ${copied.size} 个文件 ⇒ 走漏了,子进程会 ERR_MODULE_NOT_FOUND`)
    for (const abs of copied) {
      const dest = join(dir, 'scripts', relative(root, abs))
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, readFileSync(abs), 'utf8')
    }
    const cli = (...args) =>
      spawnSync(process.execPath, ['scripts/union-converge.mjs', ...args], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在钩子/守护派生下必弹控制台窗
        timeout: 120000,
      })

    const dead = cli('--theirs', BOGUS_SHA)
    assert.ok(
      !/ERR_MODULE_NOT_FOUND/.test(dead.stderr),
      `闭包走漏,子进程根本没跑到判据:${dead.stderr.split('\n').slice(0, 4).join('\n')}`,
    )
    assert.equal(dead.status, 2, `不可达必须 exit 2(无法判定),实测 ${dead.status}\n${dead.stdout}`)
    assert.ok(!/无需合并/.test(dead.stdout), '不得沿用 exit 0 那一支的"无需合并"措辞')
    assert.ok(/git fetch origin main/.test(dead.stdout), '出路必须逐行打出来')
    assert.ok(/--theirs/.test(dead.stdout), '免联网出口必须一起给出')
    assert.ok(
      !/Not a valid commit name|at (git|plan|main) .*union-converge\.mjs/.test(dead.stdout + dead.stderr),
      `不得把一次 fetch 缺失表现成工具故障堆栈:\n${dead.stdout}\n${dead.stderr}`,
    )

    const synced = cli('--theirs', run('rev-parse', 'HEAD'))
    assert.equal(synced.status, 0, `已同步仍须 exit 0,实测 ${synced.status}\n${synced.stdout}`)
    assert.match(synced.stdout, /已同步 ⇒ 无需合并/, '正常路径文案一字不动')
  } finally {
    rmScratch(dir)
  }
})

test('R-G 构造面:detached HEAD 下不可达,出路不得印出「fetch origin HEAD」这条必败命令', () => {
  // R-C 只测了纯函数的 branch:'' 入参,测不到 resolveTargets 里那次归一 —— 变异自证 M8 抓到这一点:
  // 把 `branch && branch !== "HEAD" ? branch : ""` 简化成 `branch`,纯函数用例照样全绿,
  // 而真仓 detached(收敛/守护链的常见现场)下文案会印出 `git fetch origin HEAD`,一条必然失败的命令。
  const { dir, run } = fixture()
  try {
    writeFileSync(join(dir, 'x.txt'), 'x\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'second')
    run('checkout', '-q', 'HEAD~1') // 进入 detached
    assert.equal(run('rev-parse', '--abbrev-ref', 'HEAD'), 'HEAD', '夹具自证:必须真的处于 detached')
    const bad = U.resolveTargets(BOGUS_SHA, dir)
    assert.equal(typeof bad.undetermined, 'string', 'detached 不影响"不可达"这一判据')
    assert.ok(
      !/fetch origin HEAD/.test(bad.undetermined),
      `detached 时 --abbrev-ref 回的 "HEAD" 不是分支名:\n${bad.undetermined}`,
    )
    assert.match(bad.undetermined, /<当前分支名>/, '拿不到分支名必须落到占位,让人自己补')
  } finally {
    rmScratch(dir)
  }
})

test('R-F 反向锁(源码级):不可达之后不得回落到跟踪 ref 残值继续合并', () => {
  const body = topLevelBody(srcOfTool(), 'export function resolveTargets(')
  // 判据必须**真挂在函数上**:函数在而没人调 = 提交链上一路绿灯(守门 70/76/81 同型)
  assert.match(body, /hasCommit\(/, '可达性判据必须住在 resolveTargets 里')
  assert.match(body, /unreachableObjectGuidance\(/, '出路文案必须复用同一份实现,不得两处各写一遍')
  assert.match(body, /undetermined:/, '判不了要落成未判定字段')
  // 顺序锁:可达性判据必须先于任何祖先判据 —— 否则未判定形同虚设
  assert.ok(
    body.indexOf('hasCommit(') < body.indexOf('isAncestor('),
    'hasCommit 必须排在 isAncestor 之前,否则缺对象时祖先判据先跑就会静默走到 plan',
  )
  // 禁写回落:取跟踪 ref 残值 / FETCH_HEAD / @{upstream} 当目标继续往下合
  for (const bad of [/refs\/remotes/, /@\{u/, /FETCH_HEAD/])
    assert.ok(!bad.test(body), `resolveTargets 里不得出现回落取值 ${bad}:${body.slice(0, 80)}…`)
  // 判完不可达之后不得再改写 theirs
  const after = body.slice(body.indexOf('hasCommit('))
  assert.ok(!/theirs\s*=[^=]/.test(after), '不可达之后不得重新赋值 theirs —— 那正是"悄悄换个目标接着合"')

  // 同一条判据的**另一半**:plan() 是给 import 者的那道闸,它也必须复用同一份出路实现。
  // 只锁 resolveTargets 的话,把 plan() 里那句换成随手写的第二份措辞照样全绿 ——
  // 而"两处各写一遍必漂"正是本仓记过最多次的失败型(变异自证 M10 抓到这一格)。
  const planBody = topLevelBody(srcOfTool(), 'export function plan(')
  assert.match(planBody, /hasCommit\(/, 'plan() 侧也必须自带可达性判据(import 者不经过 resolveTargets)')
  assert.match(
    planBody,
    /unreachableObjectGuidance\(/,
    'plan() 的出路文案必须复用同一份实现,不得各写一遍(CLI 用户与 import 者拿到的指导不能不一样)',
  )
})

test('R-H 出路文案:远端真值根本没问到 ⇒ 三出口齐备,且不得复用"无需合并"那套措辞', () => {
  const text = U.unreachableObjectGuidance({
    noRemoteTruth: 'ls-remote 超时',
    branch: 'main',
  })
  // 三出口:联网取分支 / 免联网喂可达 sha / refs 存续体检
  assert.match(text, /git fetch origin main/, '缺出口①(按分支 fetch)')
  assert.match(text, /--theirs/, '缺出口②(免联网;本轮实测就是靠它落成的,不给就等于没有)')
  assert.match(text, /git-refs-heal/, '缺出口③(连续问不到时先查 refs,而不是反复重跑)')
  // 这一型不是"无事可做":沿用旧措辞就会把网络失败说成同步完成
  assert.ok(!text.includes('无需合并'), '"无需合并"属于 skip 分支的措辞,未判定不得复用')
  // 分支名取不到时留占位,绝不印出 `fetch origin HEAD` 这条必败命令(与 R-C/R-G 同一规矩)
  const detached = U.unreachableObjectGuidance({ noRemoteTruth: 'x', branch: '' })
  assert.match(detached, /git fetch origin <当前分支名>/)
  assert.ok(!/git fetch origin HEAD/.test(detached), '不得给出取 HEAD 的 fetch 指令')
})

test('R-I 反向锁(源码级):"取不到远端真值"两支不得再塞进 skip(否则头注又成空承诺)', () => {
  const body = topLevelBody(srcOfTool(), 'export function resolveTargets(')
  // 本票修的正是这一格:头注写着 "2 = 无法判定:…或取不到远端真值",而实现把这两支给了 skip,
  // 于是 CLI 打印"无需合并"并 exit 0 —— 调用方据此跳过一整轮收敛,账面全绿。
  assert.doesNotMatch(
    body,
    /skip:\s*`取不到/,
    '「取不到远端真值」必须落 undetermined(exit 2),不得回 skip(exit 0)',
  )
  assert.doesNotMatch(
    body,
    /skip:\s*`取远端/,
    '「取远端异常」必须落 undetermined(exit 2),不得回 skip(exit 0)',
  )
  assert.equal(
    (body.match(/noRemoteTruth:/g) || []).length,
    2,
    '两支都要走同一份出路实现(noRemoteTruth 入参),少一支就是又分叉了',
  )
})

test('R-J 稳定标记:未判定那一支必须打出可被调用方分流的标记(不得只靠中文措辞)', () => {
  const src = srcOfTool()
  assert.match(
    src,
    /\[union-converge\] UNDETERMINED 未判定/,
    '未判定输出必须带 UNDETERMINED 标记 —— 调用方按它分流;只靠措辞的话,改一个字就把归因换掉',
  )
  // 标记只能出现在未判定那一支:出现在 skip 支就会把"无事可做"也分流走。
  // 计数只认**输出语句里**的标记 —— 头注/说明文字也会写出这个词,把它算进去等于
  // 让判据把自己说的话当成证据(本仓"注释里不得有执行性字符"的同族)。
  const marks = (src.match(/\[union-converge\] UNDETERMINED 未判定/g) || []).length
  assert.equal(marks, 1, `输出面标记应恰好一处(实测 ${marks}),多出来就是有人在别处也喊未判定`)
})

test('R-K 调用方分流顺序:git-sync-converge 必须先认 UNDETERMINED 再谈"亦判需人工"', () => {
  // 必须先在**代码面**上比:本仓那份头注里就原样写着「亦判需人工」(它描述的是这一型缺陷),
  // 不剥注释就会拿说明文字当调用点,顺序判据立刻反过来变成误红 —— 与 R-J 数标记是同一条教训。
  const conv = maskComments(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'git-sync-converge.mjs'), 'utf8'),
  )
  // 判据载体随 G-815406 收进一份实现:两处调用点原先各写一遍 `includes('UNDETERMINED')`,
  // 同轮又要加"依赖崩"这一态 ⇒ 三支字符串判据各写两遍必然漂移(本仓"两处算同一件事"那条禁令)。
  // 现在的不变量是:① 标记判据仍只有一份(在 classifyUnionAttempt 里);② 两处归并出口都调它;
  // ③ 每个调用窗口里,分流都排在"亦判需人工"之前。
  const undIdx = conv.indexOf("includes('UNDETERMINED')")
  assert.ok(undIdx > 0, '分流判据必须还在(按标记分流,否则一次网络失败会被写成内容裁决)')
  assert.equal(
    (conv.match(/includes\('UNDETERMINED'\)/g) || []).length,
    1,
    '标记判据只许一处实现 —— 两处各写一遍就会在加分支时漂开(G-815406 收口成一前的形态)',
  )
  const humanIdx = conv.indexOf('亦判需人工')
  assert.ok(humanIdx > 0, '真需人工那条路必须还在(不得静默)')
  const calls = [...conv.matchAll(/classifyUnionAttempt\((uni|uniOut)\)/g)]
  assert.equal(calls.length, 2, `两处归并出口都要分流(实测 ${calls.length}):冲突分支与状态放大分支同型`)
  for (const c of calls) {
    // 载体随转述层换了出口(五态各一句,"亦判需人工"如今只是 need-human 那一句的原文,而第二个
    // 调用点写的是"判需人工")。所以本锁改判**顺序**而不是某个短语:分流 → 取措辞 → 下结论。
    // 有人若把结论提到分流之前(= G-473/G-815406 那一型:把"没判"写成"判过了"),这里立刻翻红。
    const win = conv.slice(c.index, c.index + 1500)
    const r = win.indexOf('describeUnionRelay(')
    const h = win.search(/判需人工/)
    assert.ok(
      r > 0,
      `调用点 #${c.index}:窗口里必须经 describeUnionRelay 取措辞(实测位置 ${r})⇒ 短语被硬编回调用点就是第二份措辞`,
    )
    assert.ok(
      h > r,
      `调用点 #${c.index}:需人工结论(h=${h})必须排在转述出口(r=${r})之后 —— 顺序反了就是先下结论再找依据`,
    )
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * G-814386「副本指针 cap」的五条锁(2026-09-29 立)。
 * 这一票的形状是"给一条既有判据开一个例外",而例外最贵的失败方式不是判错,是
 * **静默** —— 少带的份数若没被点名,读报告的人就会把"0 丢失"当成"什么都没少"。
 * 所以四条源码级锁(针只有一个来源 / 两条路径都接上 / 必须进报告与提交信息 /
 * 豁免必须窄)加一条真临时仓的行为锁,缺一即红。
 * ─────────────────────────────────────────────────────────────────────────── */

test('R-L 指针针只有一个来源:必须 import,不得在本文件里再写一份正则字面量', () => {
  const src = srcOfTool()
  const code = maskComments(src) // 头注原样写着那句指针文字,不剥注释就会拿说明当判据
  assert.match(
    code,
    /import\s*\{[^}]*\bDUP_POINTER_RE\b[^}]*\}\s*from\s*'\.\/lib\/plan-task-index\.mjs'/,
    '必须复用尺子那一份 DUP_POINTER_RE(两处各写一遍必漂移,漂移的固定代价是例外与派单口径不同形)',
  )
  assert.doesNotMatch(
    code,
    /=\s*\/[^/\n]*重复登记副本[^/\n]*\//,
    '代码面不得再定义第二个"副本指针"正则 —— 有第二份就是本条锁存在的理由',
  )
  // 四个消费点各管一条路径(期望表 / 两侧同改丢行 / F5 豁免 / 活文档 cap),少一个就是那条路径又静默了
  assert.equal(
    (code.match(/DUP_POINTER_RE\.test\(/g) || []).length,
    4,
    '指针判据必须有且仅有这四处消费者(期望表、lostAddedLines、F5、liveDocPointerCaps)',
  )
})

test('R-M 两条路径都必须接上 cap:只接"两侧同改"那一支,台账这一族就恰好无人点名', () => {
  const src = srcOfTool()
  const split = topLevelBody(src, 'function recordSideLosses(')
  assert.match(split, /caps\.push\(/, '两侧同改路径必须把少带分流进 caps(而不是塞进 violations)')
  const verify = topLevelBody(src, 'export function verifyUnion(')
  assert.match(verify, /liveDocPointerCaps\(/, '活文档路径必须单独算少带 —— 它不经过 recordSideLosses')
  assert.match(verify, /bad\.pointerCaps\s*=/, '少带必须随落地闸的返回值一起交回调用方')
  const planBody = topLevelBody(src, 'export function plan(')
  assert.match(
    planBody,
    /built\.caps/,
    'plan() 的 caps 必须合流两条路径,只留一条 = 把另一条重新变静默',
  )
  assert.match(planBody, /vu\.pointerCaps/, '同上:活文档那一支也必须进同一个 caps 清单')
})

test('R-N 少带必须当着落地那一刻打出来,并写进合并提交信息(例外不得只活在内存里)', () => {
  const src = srcOfTool()
  assert.match(src, /formatPointerCapReport\(/, '报告必须经这一份出口排版(两处各印一遍必漂移)')
  assert.match(
    src,
    /副本指针行有意少带 \$\{capDropped\} 份/,
    '合并提交信息必须带少带份数 —— 后来人只读 git log 也要能分清"少带"与"丢了"',
  )
  assert.match(src, /const capDropped =/, '提交信息里的数字必须现算,不得由措辞冒充')
})

test('R-O F5 的豁免额度必须窄到"指针行 ∧ 仍 ≥1 份",否则注记整族的消失也会被放过', () => {
  const body = topLevelBody(srcOfTool(), 'export function planStateRegressions(')
  // 旧版这里锁的是一条字面量判据串。G-814386 把额度改成三档有据机制后那串不再存在,而"仍 ≥1 份"
  // 这条不变量也跟着**从代码里消失了**(注释还留着) —— 所以这里改判两件事:③ 档必须带下限项,
  // 并且用构造面直接问结果。形状锁会被同一次改写连带改掉,行为锁不会。
  assert.match(
    body,
    /Math\.max\(0,\s*rest \+ haveOcc - occ\)/,
    '副本指针行档的额度必须封顶在"结果面仍留一份"(haveOcc - occ 那一项);缺它 = 整族消失可被记成合法额度',
  )
  const pad = (s) => s + '　'.repeat(Math.max(0, 46 - [...s].length))
  const PTR = pad(
    '- [x] G-900001 带副本指针的注记行〔【归并】重复登记副本,归并到 G-900002;落账:复测 2026-09-29〕',
  )
  const PLAIN = pad('- [x] G-900003 不带指针的注记行〔【归并】落账:复测 2026-09-29〕')
  const threeRows = (row) => `# 甲侧\n${row}\n${row}\n${row}\n`
  const noNote = '# 乙侧\n这一面没有任何注记行\n'
  // A) 带指针的注记族在结果面**一份不剩** ⇒ 必须判红(这正是被改宽那一版的漏洞形状)
  const goneAll = U.planStateRegressions(noNote, [threeRows(PTR), noNote])
  assert.ok(
    goneAll.some((x) => x.startsWith('F5')),
    `A) 指针行整族消失不得被额度解释掉,实测 ${JSON.stringify(goneAll)}`,
  )
  // B) 同一族**留下一份**(少带 2 份) ⇒ 不得判红(这才是 G-814386 那条语义的正当形态)
  const oneLeft = U.planStateRegressions(`# 合并结果\n${PTR}\n`, [threeRows(PTR), noNote])
  assert.equal(
    oneLeft.filter((x) => x.startsWith('F5')).length,
    0,
    `B) 少带但留一份必须放过(否则每次台账收敛都在落地闸自杀),实测 ${JSON.stringify(oneLeft)}`,
  )
  // C) 不带指针的注记行整族消失 ⇒ 同样判红(下限不得只长在指针档上)
  const plainGone = U.planStateRegressions(noNote, [threeRows(PLAIN), noNote])
  assert.ok(
    plainGone.some((x) => x.startsWith('F5')),
    `C) 无指针注记行消失必须判红,实测 ${JSON.stringify(plainGone)}`,
  )
  /**
   * 注记的**形状判据只许有一份实现**(G-977960 ① 改的正是这里)。
   * 旧版这条锁的是字面量 `new RegExp(MERGE_NOTE_RE.source)` —— 一条形状锁。本票把逐行计数
   * 收进 lib 的 `lineNoteCount`,那串就消失了,于是"合规的改进"被这条锁判成红 —— 与本文件
   * 上方那句"形状锁会被同一次改写连带改掉,行为锁不会"是自相矛盾的。现改判两件可核的事:
   * ① 体内必须真的调用共享出口(不是自己再拼正则);② 体内不得再出现重拼 MERGE_NOTE_RE 的写法。
   * 行为侧的"一行两条 = 2 个 occurrence"由 --self-test 的 F5 量纲成对用例钉着,不靠这条文本锁。
   */
  assert.match(
    body,
    /lineNoteCount\(/,
    '注记的逐行计数必须复用 plan-task-index 那份 lineNoteCount;门内自拼正则 = 第二份实现,必漂移',
  )
  assert.equal(
    /new RegExp\(\s*MERGE_NOTE_RE/.test(body),
    false,
    'planStateRegressions 体内不得再重拼 MERGE_NOTE_RE(F5 的读数与额度必须同量纲,见 G-977960 ①)',
  )
  assert.match(
    body,
    /m\.mergeNotes < noteMax - allowed/,
    '判红条件必须是"扣完合法额度仍差" —— 直接比 noteMax 会让每一枚台账收敛在落地闸自杀',
  )
})

test('R-O2 量纲锁(G-977960 ①):跨行注记只报名不判红,承载行真消失仍判红', async () => {
  // 同一条注记横写两行时,`[^〕]` 含换行 ⇒ 整面命中数会随**行序**变化,而逐行额度机器看不见它。
  // 旧写法拿整面数当份数 ⇒ 一行没少也恒差 N 条且名单为空(实测 622/530/扣 90+3/差 2)。
  const OPEN = '- [x] ✅(2026-09-20) **CL 跨行注记**:做完了。〔【归并】CL '
  const CLOSE = '落账:复测 2026-09-26: 取证〕'
  const sides = [
    [OPEN, CLOSE, OPEN, CLOSE].join('\n') + '\n',
    'z 无关行\n',
  ]
  const reflowed = [OPEN, OPEN, CLOSE, CLOSE].join('\n') + '\n'
  // A) 行序重排:物理行一条没少 ⇒ 落地闸必须放过(旧口径在这里必红)
  assert.equal(
    U.planStateRegressions(reflowed, sides).join(''),
    '',
    `A) 重排不得判红,实测 ${JSON.stringify(U.planStateRegressions(reflowed, sides))}`,
  )
  // B) 报名行必须同时给出两侧与结果的跨行数,并写明"只报名"
  const caliber = U.mergeNoteCrossLineCaliber(reflowed, sides)
  assert.match(caliber, /各侧最多 2 条/, 'B) 量纲行必须报出各侧跨行数,实测:' + caliber)
  assert.match(caliber, /归并结果 1 条/, 'B) 量纲行必须报出结果跨行数,实测:' + caliber)
  assert.match(caliber, /只报名,不参与判红/, 'B) 必须写明这一档不参与判红,实测:' + caliber)
  // C) 承载行真被抹掉 ⇒ 必须判红(换量纲不等于关掉这一维;F5c 是这条改动的下限)
  const lostCarrier = U.planStateRegressions(OPEN + '\n', sides)
  assert.ok(
    lostCarrier.some((x) => x.startsWith('F5c')),
    `C) 承载跨行注记的行消失必须判红并点名,实测 ${JSON.stringify(lostCarrier)}`,
  )
  // D) 反向对照:同一族注记原样归并 ⇒ 不得判红(允许少带份数,不允许带走注记的行)
  assert.equal(
    U.planStateRegressions(sides[0], sides).join(''),
    '',
    `D) 原样归并不得判红,实测 ${JSON.stringify(U.planStateRegressions(sides[0], sides))}`,
  )
  // E) 读数出口:auditPlan 必须同时给出"整面命中数"与"逐行可判档",少一档 = 上面的量纲比较失去同源
  const idxMod = await import('../lib/plan-task-index.mjs')
  const u = idxMod.mergeNoteUnits(sides[0])
  assert.equal(
    `${u.total}/${u.lineAttributable}/${u.crossLine}`,
    '2/0/2',
    `E) 跨行那族必须是 total=2 · 逐行=0 · 跨行=2,实测 ${JSON.stringify(u)}`,
  )
})

test('R-P 行为锁(真临时仓):指针行只带回一份且必须点名,不带指针的同样形态一份都不许多', () => {
  const dir = mkScratch('union-cap-it-')
  try {
    const g = (...a) =>
      execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      }).trim()
    g('init', '-q', '-b', 'main')
    g('config', 'user.email', 't@t')
    g('config', 'user.name', 't')
    g('config', 'core.autocrlf', 'false')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), '# 台账\n- [ ] 公共行\n', 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'base')
    const base = g('rev-parse', 'HEAD')
    const DOC = join(dir, 'PROJECT_PLAN.md')
    const PTR = '〔【归并】重复登记副本(2026-09-26):同主键另一条,派单以那条为准。〕'
    const ROW = `- [ ] G-9 同一件事 ${PTR}`
    const PLAIN = '- [ ] G-9 同一件事 〔普通注记〕'
    g('checkout', '-q', '-b', 'theirs', base)
    const theirsDoc =
      `# 台账\n- [ ] 公共行\n${ROW}\n${ROW}\n${ROW}\n${PLAIN}\n${PLAIN}\n${PLAIN}\n`
    writeFileSync(DOC, theirsDoc, 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'theirs(三份指针行 + 三份不带指针的同文行)')
    const theirs = g('rev-parse', 'HEAD')
    g('checkout', '-q', '-B', 'ours', base)
    // ours 必须真的有自己的改动:空提交会被 git 拒掉,而"两侧同改"这一格恰恰要的是
    // 两父都动过同一份活文档 —— 否则本用例量的只是单侧复制,证不到落地闸那条路径。
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), '# 台账\n- [ ] 公共行\n- [ ] ours 独有\n', 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'ours(带一行本侧独有)')
    const p = U.plan(g('rev-parse', 'HEAD'), theirs, dir)
    const doc = U.show(p.tree, 'PROJECT_PLAN.md', dir)
    const cnt = (needle) => doc.split('\n').filter((l) => l === needle).length
    assert.deepEqual(
      [cnt(ROW), cnt(PLAIN)],
      [1, 3],
      '指针行只许带 1 份,不带指针的必须全带 —— 例外宽一档就是拿它盖真丢失',
    )
    assert.equal(p.bad.length, 0, `少带不是丢失,不得进 bad:${p.bad.slice(0, 2).join(' / ')}`)
    const rows = (p.caps || []).flatMap((c) => U.formatPointerCapReport(c.capped))
    assert.match(
      rows.join('\n'),
      /因副本指针有意少带 2 份/,
      `caps 必须把少带的 2 份点名出来:${JSON.stringify(p.caps)}`,
    )
    assert.ok(
      (p.caps || []).every((c) => c.capped?.every((e) => e.dropped > 0)),
      '每条 cap 必须带真实差额,dropped=0 的条目是噪声(会让报告行数虚高)',
    )
  } finally {
    rmScratch(dir)
  }
})

/**
 * R-Q 显式 `--theirs` 的短路判据(G-814402,2026-09-29 主会话亲历:一次已验证交付差点被
 * "本地纯落后 ⇒ 无需合并" + exit 0 整吞)。
 *
 * 判据只放在 `resolveTargets` 这一层(它是缺陷所在地),CLI 那一支刻意不在这里真跑:
 * 本器的 `ROOT` 由**脚本自身位置**推导(守门 70 的同一课),在临时仓里 spawn 真脚本会去操作真仓,
 * 所以"落地动作"的端到端由 union-converge 自带的 `--self-test` 覆盖,这里只钉分流。
 */
test('R-Q 显式 --theirs 时"本地纯落后"不得当成无需合并;只有"目标已被包含"才准短路', () => {
  const dir = mkScratch('union-explicit-')
  try {
    const run = (...a) =>
      execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      }).trim()
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 't@t')
    run('config', 'user.name', 't')
    run('config', 'core.autocrlf', 'false')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), '# 台账\n- [ ] 底座\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'base')
    const base = run('rev-parse', 'HEAD')
    // 对侧:本地之后的一枚提交,带着本地没有的文件(模拟"别人的交付等着被合进来")
    writeFileSync(join(dir, 'only-theirs.ts'), '要合进来的交付\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs-ahead')
    const ahead = run('rev-parse', 'HEAD')
    run('reset', '-q', '--hard', base) // 本地退回,造成"本地纯落后于 ahead"这一格

    assert.equal(U.hasCommit(ahead, dir), true, '夹具自证:两枚对象都必须在本机')
    const g = U.resolveTargets(ahead, dir)
    assert.equal(
      g.skip,
      null,
      `显式点了 --theirs 而本地落后 ⇒ 绝不能给出 skip(旧行为是 skip="本地纯落后…" + exit 0"无需合并"):${JSON.stringify(g)}`,
    )
    assert.ok(!g.undetermined, '对象都在本机 ⇒ 这不是"没资格判",不得混进未判定那一支')

    // 反向对照:目标已被本地包含时,短路照旧合法(否则每次都白合一遍)。
    // 注意要**再往前加一枚提交**再验:纯 ff 之后 head 与 theirs 会是同一个 sha,那走的是
    // 更早那一格 `skip:'已同步'`(也合法,但就把"已被包含"这一格验不到了 —— 夹具必须自己
    // 证明两种形态确有差异,否则这条断言恒真)。
    run('merge', '-q', '--no-edit', ahead)
    writeFileSync(join(dir, 'post-merge.ts'), '合并之后本地又走了一步\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'post')
    const nowHead = run('rev-parse', 'HEAD')
    assert.notEqual(nowHead, ahead, '夹具自证:本地必须真的走在 ahead 前面,否则本例退化成"已同步"那一格')
    const g2 = U.resolveTargets(ahead, dir)
    assert.equal(g2.skip, '目标已被本地包含', `已被包含才准短路:${JSON.stringify(g2)}`)

    // 形状锁:那句"本地纯落后"只保留给**自动解析远端真值**那一支(不显式点目标时它是对的建议)
    const src = readFileSync(new URL('../union-converge.mjs', import.meta.url), 'utf8')
    assert.match(
      maskComments(src),
      /if \(!explicit && isAncestor\(head, theirs, cwd\)\)\s*return \{ head, theirs, skip: '本地纯落后/,
      '"本地纯落后"短路必须被 !explicit 夹住 —— 摘掉这个条件就是回到 G-814402 那一吞',
    )
  } finally {
    rmScratch(dir)
  }
})
/* ── R-R / R-S / R-T:「对侧就地改写、本侧未动」的折叠判据(2026-09-29 立)────────────────
 * 立因是现读:`G-823` 与 `G-814425` 两组 F9 里,一侧拿着基底原文(相对基底**一个字节都没改**),
 * 另一侧把同一枚主键就地改写成「已落地」形态 —— 而归并把改写读成"对侧相对基底新增",
 * 于是同号两个形态并存、落地闸判需人工。那一格既不是任何人的登记错误,也不是"并集天然后果"
 * (F1/F4 那种),而是**归并器少了一条对称规则**:它已有"本侧改写、对侧未动 ⇒ 不复活旧行",
 * 却没有"对侧改写、本侧未动 ⇒ 不带旧行"。三条用例各钉一件事:折得对、不该折不折、有人调它。 */
test('R-R 折叠判据(真临时仓端到端):对侧改写主键 ∧ 本侧未动 ⇒ 合并树只带改写形态,任何一侧的独有行照留', () => {
  const dir = mkScratch('union-fold-it-')
  try {
    const g = (...a) =>
      execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      }).trim()
    g('init', '-q', '-b', 'main')
    g('config', 'user.email', 't@t')
    g('config', 'user.name', 't')
    g('config', 'core.autocrlf', 'false')
    const OLD = '- [ ] G-770 折叠夹具:同一议题的甲写法,含落点与判据两段说明。'
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# 台账\n- [ ] 公共行\n${OLD}\n`, 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'base')
    const base = g('rev-parse', 'HEAD')
    const DOC = join(dir, 'PROJECT_PLAN.md')
    // 本侧**动了同一份活文档**(否则走不到活文档归并这条路),但一个字都没碰 G-770
    g('checkout', '-q', '-B', 'ours', base)
    writeFileSync(DOC, `# 台账\n- [ ] 公共行\n${OLD}\n- [ ] ours 独有\n`, 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'ours(只加自己的行)')
    const ours = g('rev-parse', 'HEAD')
    const NEW = '- [x] ✅(2026-09-29) G-770 折叠夹具:同一议题的乙写法,含落点与判据两段说明。'
    g('checkout', '-q', '-B', 'theirs', base)
    writeFileSync(DOC, `# 台账\n- [ ] 公共行\n${NEW}\n- [ ] theirs 独有\n`, 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'theirs(就地改写 G-770)')
    const theirs = g('rev-parse', 'HEAD')
    const p = U.plan(ours, theirs, dir)
    const doc = U.show(p.tree, 'PROJECT_PLAN.md', dir)
    assert.ok(doc.includes(NEW), '改写形态必须进合并树')
    assert.equal(
      doc.split('\n').filter((l) => l === OLD).length,
      0,
      '基底旧形态不得再留一份 —— 留两份正是 F9「同号两形态」的产地,而它会被读成"别人把我的行改坏了"',
    )
    assert.ok(
      doc.includes('- [ ] ours 独有') && doc.includes('- [ ] theirs 独有'),
      '折叠只碰"本侧未动的主键",任何一侧的独有行一份都不许多',
    )
    assert.equal(p.bad.length, 0, `零丢失与状态分叉自证必须一起过:${p.bad.slice(0, 2).join(' / ')}`)
  } finally {
    rmScratch(dir)
  }
})

test('R-S 反向锁(真临时仓):本侧对同一主键**也改过** ⇒ 两侧同改,机器不许折,交人工并点名 F9', () => {
  const dir = mkScratch('union-fold-neg-')
  try {
    const g = (...a) =>
      execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      }).trim()
    g('init', '-q', '-b', 'main')
    g('config', 'user.email', 't@t')
    g('config', 'user.name', 't')
    g('config', 'core.autocrlf', 'false')
    const OLD = '- [ ] G-771 折叠夹具:基底形态。'
    // 两侧改出来的**标题必须不同**(前 24 字就分叉):同主键同标题会被判 F1「两态并存」,
    // 那是另一条维;本例要钉的是 F9「同号两议题」,所以措辞必须走到那个形状上。
    const MINE = '- [ ] G-771 本侧把它改成了另一个议题的措辞。'
    const NEW = '- [x] ✅(2026-09-29) G-771 对侧把它改成了第三种完全不同的措辞。'
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# 台账\n${OLD}\n`, 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'base')
    const base = g('rev-parse', 'HEAD')
    const DOC = join(dir, 'PROJECT_PLAN.md')
    g('checkout', '-q', '-B', 'ours', base)
    writeFileSync(DOC, `# 台账\n${MINE}\n`, 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'ours(把同一主键改成第三种形态)')
    const ours = g('rev-parse', 'HEAD')
    g('checkout', '-q', '-B', 'theirs', base)
    writeFileSync(DOC, `# 台账\n${NEW}\n`, 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'theirs(把同一主键改成另一种形态)')
    const theirs = g('rev-parse', 'HEAD')
    const p = U.plan(ours, theirs, dir)
    const doc = U.show(p.tree, 'PROJECT_PLAN.md', dir)
    assert.ok(doc.includes(MINE) && doc.includes(NEW), '两侧同改 ⇒ 两份都得留,少哪一份都是替别人裁决')
    assert.match(
      p.bad.join('\n'),
      /F9 归并新增撞号组[\s\S]*G-771/,
      `两侧同改那一格必须仍被点名交人工(折叠判据不得把它洗成"已归并"):${p.bad.slice(0, 2).join(' / ')}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('R-T 装车锁(源码级):折叠表必须接进 liveDocExpectedCounts 本体 —— 只写函数不接,产出面与自证面就会各读一张表', () => {
  const src = maskComments(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../union-converge.mjs'), 'utf8'))
  assert.match(
    src,
    /for \(const \[l, n\] of theirsRewriteCaps\(oursText, theirsText, baseText, suppress\)\)/,
    '期望表里不得没有这一行:它同时是产出面与自证面的唯一来源',
  )
  assert.match(
    src,
    /const over = n - \(want\.get\(l\) \|\| 0\)/,
    '脊柱裁剪必须按**期望表**扣份数,不得在 unionLines 里再算第二次 caps(两处各写一遍必漂移)',
  )
})
test('R-U 装车锁(源码级):折叠判据必须先过"是不是同一件事"的相似度闸 —— 摘掉它,同号两个不同议题会被静默删掉一侧', () => {
  const src = maskComments(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../union-converge.mjs'), 'utf8'))
  assert.match(src, /if \(sim < SIM_THRESHOLD\) continue/, '相似度闸不得被摘掉')
  assert.match(src, /from '\.\/lib\/live-doc-similarity\.mjs'/, '阈值与 Jaccard 必须复用那一份实现,不得在门里再写第二把尺子')
})

test('G-977960 ②:对侧删除 ∧ 本侧相对基底未动 ⇒ 删除随合并传播(合并树里没有它、逐路径点名、零丢失自证过)', () => {
  const { dir, run } = fixture()
  try {
    writeFileSync(join(dir, 'orphan.ts'), 'O\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'base(带零引用路径)')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\nours\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours(不碰 orphan.ts)')
    const ours = run('rev-parse', 'HEAD')
    run('checkout', '-q', 'HEAD~1')
    run('rm', '-q', 'orphan.ts')
    run('add', '-A')
    run('commit', '-qm', 'theirs(删零引用路径)')
    const theirs = run('rev-parse', 'HEAD')
    run('update-ref', 'refs/heads/main', ours)
    run('checkout', '-q', 'main')

    const p = U.plan(ours, theirs, dir)
    const paths = new Set(U.listPaths(p.tree, dir))
    assert.equal(p.bad.length, 0, `零丢失自证必须过:${p.bad.slice(0, 3).join(' / ')}`)
    assert.ok(!paths.has('orphan.ts'), '删除必须随合并生效:合并树里不得再有它(旧写法会把它折回)')
    assert.ok(
      p.propagatedDeletes.includes('orphan.ts'),
      `必须逐路径点名:${JSON.stringify(p.propagatedDeletes)}`,
    )
    assert.ok(!p.skippedDeletes.includes('orphan.ts'), '本侧未动 ⇒ 不得再进"不传播"清单')
    const sha = run('commit-tree', p.tree, '-p', ours, '-p', theirs, '-m', 'union(删除传播)')
    assert.equal(auditOne(sha, dir).lost.length, 0, '产物必须过它自己那道 A1(A1 只立罪新增)')
  } finally {
    rmScratch(dir)
  }
})

test('G-977960 ② 反向锁:对侧删除 ∧ 本侧改过 ⇒ 不传播(modify/delete 分叉,处置权归改写方)', () => {
  const { dir, run } = fixture()
  try {
    writeFileSync(join(dir, 'conflict-del.ts'), 'O\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'base')
    writeFileSync(join(dir, 'conflict-del.ts'), 'O-OURS-EDIT\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours(改了它)')
    const ours = run('rev-parse', 'HEAD')
    run('checkout', '-q', 'HEAD~1')
    run('rm', '-q', 'conflict-del.ts')
    run('add', '-A')
    run('commit', '-qm', 'theirs(删了它)')
    const theirs = run('rev-parse', 'HEAD')
    run('update-ref', 'refs/heads/main', ours)
    run('checkout', '-q', 'main')

    const p = U.plan(ours, theirs, dir)
    const paths = new Set(U.listPaths(p.tree, dir))
    assert.equal(p.bad.length, 0, `不得判红:${p.bad.slice(0, 3).join(' / ')}`)
    assert.ok(paths.has('conflict-del.ts'), '本侧改过 ⇒ 文件不得被对侧的删除带走')
    assert.equal(
      U.blobOf(p.tree, 'conflict-del.ts', dir),
      U.blobOf(ours, 'conflict-del.ts', dir),
      '留下必须是本侧改过的那份字节',
    )
    assert.ok(
      p.skippedDeletes.includes('conflict-del.ts') && !p.propagatedDeletes.includes('conflict-del.ts'),
      `必须留在"不传播"清单里点名,不得混进传播清单:${JSON.stringify([p.skippedDeletes, p.propagatedDeletes])}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ═══ 台账票 G-383 最后一格:union-converge 的行级复活对账(R1r 同款形态,2026-10-07)══════════
// 判据本体住在 lib/stale-content-analysis.mjs(与守门 84 R1r、落地器共用一份,这里绝不另立尺子);
// 本组测试钉的是**接线**:活文档归并结果相对本侧量复活、与本侧自身存量比差值棘轮、
// 默认全档只报数(推送链零风险)、--resurrect-block 才让"新增强"折进落地闸。

/** 捕获 U.plan 期间的 stdout(点名断言 + 不把归并报告刷进测试输出)。 */
function captureLogs(fn) {
  const logs = []
  const orig = console.log
  console.log = (...xs) => {
    logs.push(xs.join(' '))
  }
  try {
    return [fn(), logs]
  } finally {
    console.log = orig
  }
}

test('G-383 最后一格:滞后台账副本把 HEAD 已删、祖先写过的行带回归并结果 ⇒ 复活对账点名(默认只报数,不拦落地闸)', () => {
  const { dir, run } = fixture()
  try {
    const ROW = '- [ ] G-383 旧任务行(祖先写过、后来删掉的那一行)'
    // 旧行诞生 ⇒ 基底把它删掉(此后"本侧没有这一行"由基底继承)⇒ 本侧只加自己的行
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `a\nb\n${ROW}\n`, 'utf8')
    run('add', '-A')
    run('commit', '-qm', '旧行诞生')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', '基底(删掉旧行)')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\nours-new\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours')
    const ours = run('rev-parse', 'HEAD')
    run('checkout', '-q', 'HEAD~1')
    // 对侧 = 一份滞后的台账副本:把早已删掉的旧行原样搬回,另带一行真新工作
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `a\nb\n${ROW}\ntheirs-new\n`, 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs(滞后的台账副本)')
    const theirs = run('rev-parse', 'HEAD')
    run('update-ref', 'refs/heads/main', ours)
    run('checkout', '-q', 'main')

    const [p, logs] = captureLogs(() => U.plan(ours, theirs, dir))
    const r = (p.resurrect || []).find((x) => x.doc === 'PROJECT_PLAN.md')
    assert.ok(r, '活文档必须有复活对账记录(判据存在而永不调用 = 没有)')
    assert.equal(r.status, 'judged', `必须量到数,不得落未判定:${r.reason || ''}`)
    assert.equal(r.grade, 'red', `旧行被并集带回且本侧零存量 ⇒ 新增强:${JSON.stringify(r)}`)
    assert.equal(r.count, 1, `只认那一行旧行,对侧真新工作 theirs-new 不得跟着算账:${JSON.stringify(r)}`)
    assert.equal(r.anchor, 0, '本侧自身存量必须为 0(基底已删,本侧没复活任何行)')
    assert.ok(
      p.bad.every((b) => !String(b).includes('复活')),
      `默认全档只报数,复活对账不得折进落地闸:${p.bad.slice(0, 3).join(' / ')}`,
    )
    assert.ok(
      logs.some((l) => l.includes('[R1r 复活对账]') && l.includes('PROJECT_PLAN.md') && l.includes('新增强')),
      `归并报告必须点名复活对账:${JSON.stringify(logs.filter((l) => l.includes('复活对账')))}`,
    )
    // 显式旗标(--resurrect-block 的接线,main 里经 applyResurrectBlock):仅"新增强"折进落地闸
    U.applyResurrectBlock(p)
    assert.equal(p.bad.length, 1, `新增强在显式旗标下必须参与退出码:${JSON.stringify(p.bad)}`)
    assert.ok(p.bad[0].includes('行级复活新增强') && p.bad[0].includes('PROJECT_PLAN.md'), `点名到路径:${p.bad[0]}`)
  } finally {
    rmScratch(dir)
  }
})

test('G-383 最后一格·存量只报数:复活行数 ≤ 本侧自身存量(差值棘轮)⇒ 只点名,旗标也不拦', () => {
  const { dir, run } = fixture()
  try {
    const S1 = 'S1(祖先写过的一行台账)'
    const S2 = 'S2(祖先写过的另一行)'
    // 两行旧行都诞生于基底之前;基底把两行都删掉
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `a\nb\n${S1}\n${S2}\n`, 'utf8')
    run('add', '-A')
    run('commit', '-qm', '两行旧行诞生')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', '基底(两行都删)')
    // 本侧自己复活了 S2(存量债 1 行,是本侧历史欠的,不是本次归并带进来的)
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `a\nb\n${S2}\n`, 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours(自己复活了 S2)')
    const ours = run('rev-parse', 'HEAD')
    run('checkout', '-q', 'HEAD~1')
    // 对侧滞后台账把 S1 搬回
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `a\nb\n${S1}\ntheirs-new\n`, 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs(滞后的台账副本)')
    const theirs = run('rev-parse', 'HEAD')
    run('update-ref', 'refs/heads/main', ours)
    run('checkout', '-q', 'main')

    const [p, logs] = captureLogs(() => U.plan(ours, theirs, dir))
    const r = (p.resurrect || []).find((x) => x.doc === 'PROJECT_PLAN.md')
    assert.ok(r, '活文档必须有复活对账记录')
    assert.equal(r.status, 'judged', `必须量到数:${r.reason || ''}`)
    assert.equal(r.grade, 'stock', `复活 1 行 ≤ 本侧自身存量 1 行 ⇒ 存量只报数:${JSON.stringify(r)}`)
    assert.equal(r.count, 1)
    assert.equal(r.anchor, 1)
    assert.ok(
      p.bad.every((b) => !String(b).includes('复活')),
      `存量不得进落地闸:${p.bad.slice(0, 3).join(' / ')}`,
    )
    assert.ok(
      logs.some((l) => l.includes('存量只报数') && l.includes('PROJECT_PLAN.md')),
      `存量档必须当着报告点名:${JSON.stringify(logs.filter((l) => l.includes('复活对账')))}`,
    )
    // 差值棘轮的关键:存量档连显式旗标都不拦(拦存量 = 恒红门,§12e/§12f)
    const before = p.bad.length
    U.applyResurrectBlock(p)
    assert.equal(p.bad.length, before, '存量档在任何档位都不拦')
  } finally {
    rmScratch(dir)
  }
})

test('G-383 最后一格·反向锁:对侧在分叉后真新写的行不得判成复活(祖先窗口只取本侧,牙不在对侧新工作上)', () => {
  const { dir, run } = fixture()
  try {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\nours-new\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours')
    const ours = run('rev-parse', 'HEAD')
    run('checkout', '-q', 'HEAD~1')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\ntheirs-brand-new(对侧真新工作的一行)\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs(真新工作)')
    const theirs = run('rev-parse', 'HEAD')
    run('update-ref', 'refs/heads/main', ours)
    run('checkout', '-q', 'main')

    const [p, logs] = captureLogs(() => U.plan(ours, theirs, dir))
    const r = (p.resurrect || []).find((x) => x.doc === 'PROJECT_PLAN.md')
    assert.ok(r, '活文档必须有复活对账记录(判据跑了,哪怕结论是干净)')
    assert.equal(r.status, 'judged', `必须判过:${r.reason || ''}`)
    assert.equal(r.count, 0, `对侧新行不在本侧历史里 ⇒ 结构上不是复活:${JSON.stringify(r)}`)
    assert.equal(r.grade, null)
    assert.ok(
      logs.every((l) => !l.includes('复活对账')),
      `判过且 0 行、窗口未尽 ⇒ 不刷屏:${JSON.stringify(logs.filter((l) => l.includes('复活对账')))}`,
    )
  } finally {
    rmScratch(dir)
  }
})

/* ── G585-A…E:「并集防多」那一半的镜像覆盖(票 G-585 剩余的正是这一格)────────────────
 * 票面写得很具体:`--resolve` 的零损失断言只判"两侧独有行不得减少"(防少),而人工最省事的
 * `git merge-file --union` 语义是"两侧新增都保留" ⇒ 同一条被两个会话各登记一次的行会被造出
 * **多余副本**(2026-09-28 实测 186 行)。实现侧已由别席入库(`excessAddedLines` /
 * `capAddedDuplicates` / `--union-capped`,枚 2c05603424),本块按票面补的两条变异自证是:
 *   ① 摘掉封顶(= 只走 `--resolve` 那一支)⇒ 多余副本断言必翻红  → G585-E 臂一
 *   ② 封顶写成 min / 全局去重 ⇒ "两侧独有行不得减少"必翻红      → G585-A(语义面)+ G585-E 臂二
 * 两条都做成**同夹具内的臂或对偶断言**,不靠人工改源码再还原 —— 恒绿的形状锁与"没跑过"的
 * 自述在本仓是同一条禁令(§22c / 门 150 票㉛),所以每条 cond 都是已求值布尔。 */

/** 界 = max(本侧重数, 对侧重数);夹具故意让"只在单侧出现的行"与"单侧合法持有 2 份的行"同时在场,
 *  min 变异会掉前者,全局去重变异会掉后者的第二份 —— 两种改法在同一份输入上给出不同答案。 */
const G585_BASE = '台账头\n'
const G585_OURS = '台账头\n只有本侧的一行\n'
const G585_THEIRS = '台账头\n对侧一行\n对侧一行\n'
const G585_MERGED = '台账头\n只有本侧的一行\n对侧一行\n对侧一行\n对侧一行\n'

test('G585-A 封顶的界是 max 不是 min/全局去重:单侧独有行一份不许少,另一侧合法 2 份也不许被压成 1', () => {
  const ex = U.excessAddedLines(G585_BASE, G585_OURS, G585_THEIRS, G585_MERGED)
  assert.deepEqual(
    ex.map((e) => [e.line, e.have, e.bound, e.excess]),
    [['对侧一行', 3, 2, 1]],
    `只应点名"被造出更多份"的那一行(重数 3 对界 2),实际:${JSON.stringify(ex)}`,
  )

  const capped = U.capAddedDuplicates(G585_BASE, G585_OURS, G585_THEIRS, G585_MERGED)
  const lines = capped.text.split('\n')
  // 专杀 min:max(1,0)=1 保住它,min(1,0)=0 会让本侧独有行整条消失 ⇒ 这一条当场翻红
  assert.equal(
    lines.filter((l) => l === '只有本侧的一行').length,
    1,
    `封顶不得把"只在一侧出现过"的行压没(min 变异会在这里翻红):\n${capped.text}`,
  )
  // 专杀全局去重:界取 max(0,2)=2 ⇒ 对侧合法的两份都得留;写成"每行只留一份"会在这里翻红
  assert.equal(
    lines.filter((l) => l === '对侧一行').length,
    2,
    `对侧自己合法持有两份 ⇒ 封顶只能收到 2,不得去重成 1:\n${capped.text}`,
  )
  assert.equal(
    capped.removed.length,
    1,
    `丢弃的必须恰好是超出界的那一份:${JSON.stringify(capped.removed)}`,
  )
  // 封顶之后这条判据必须不再报任何东西(否则出口没把内容收进界内)
  assert.deepEqual(
    U.excessAddedLines(G585_BASE, G585_OURS, G585_THEIRS, capped.text),
    [],
    `封顶后的内容仍被报多余副本 ⇒ 出口没生效:${JSON.stringify(U.excessAddedLines(G585_BASE, G585_OURS, G585_THEIRS, capped.text))}`,
  )
})

test('G585-B 人工新写的一行(两侧都没有)不是"多余副本",封顶一律不碰', () => {
  // 判据只管"同一行被造出更多份",不管"凭空多一行" —— 后者是另一条判据的事,本器不代裁。
  // 实现里 `if (bound === 0) continue` 这一句一旦被删,合并注记/归并说明这类整行会被封顶吃掉,
  // 而那正好把"防多"变成"丢内容"(与票面"不得为此放宽丢行断言"是同一条纪律的反方向)。
  const merged = `${G585_MERGED}归并说明:两侧同改按人工裁决取改写形态\n`
  assert.deepEqual(
    U.excessAddedLines(G585_BASE, G585_OURS, G585_THEIRS, merged).map((e) => e.line),
    ['对侧一行'],
    '两侧都没有的那一行不得进多余副本桶',
  )
  const capped = U.capAddedDuplicates(G585_BASE, G585_OURS, G585_THEIRS, merged)
  assert.ok(
    capped.text.split('\n').includes('归并说明:两侧同改按人工裁决取改写形态'),
    `封顶不得删人工新写的行:\n${capped.text}`,
  )
})

test('G585-C 空行不参与封顶(与 lostAddedLines / liveDocExpectedCounts 同一条口径)', () => {
  // 归档件里 `---` 与空行成百,把它们计进"多余副本"会让判据在真仓上一路喊红 ——
  // 那等于把这条判据变成第二台恒红门,唯一结局是没人用它。
  const ex = U.excessAddedLines('\n', '\n\n', '\n\n', '\n\n\n\n')
  assert.deepEqual(ex, [], `空行不得算多余副本:${JSON.stringify(ex)}`)
  const capped = U.capAddedDuplicates('b\n', 'b\nx\n', 'b\nx\n', 'b\nx\nx\n\n\n')
  assert.equal(
    capped.text.split('\n').filter((l) => l.trim() === '').length,
    'b\nx\nx\n\n\n'.split('\n').filter((l) => l.trim() === '').length,
    `空行必须原样保留(本出口收的是同一行的多余份数,不是格式):\n${JSON.stringify(capped.text)}`,
  )
  assert.equal(capped.removed.length, 1, '只应收掉 x 的第三份')
})

test('G585-D 严格档只吃台账那一族:源码文件里的同形重复不判红(假阳比漏报更贵)', () => {
  for (const doc of U.LIVE_DOCS) {
    assert.equal(
      U.isDupCapStrictPath(doc),
      true,
      `活文档必须在严格档里(否则"防多"对它整族失明):${doc}`,
    )
  }
  assert.equal(U.isDupCapStrictPath('PROJECT_PLAN.md'), true)
  assert.equal(
    U.isDupCapStrictPath('.ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md'),
    true,
    '归档件同名族必须在射程内 —— 票面立因就是那份 186 行重复的归档件',
  )
  assert.equal(
    U.isDupCapStrictPath('apps/api/src/routes/chat.ts'),
    false,
    '普通源码文件里"两侧各加了一行相同的闭合括号"是正当形态,判红就是逼人绕出口',
  )
  assert.equal(U.isDupCapStrictPath(undefined), false, '取不出路径一律不判,不得默认成严格档')
})

test('G585-E 端到端三臂(真临时仓):--resolve 必翻红 / --union-capped 封顶且零损失仍过 / 非严格档不判', () => {
  // 载体刻意用**归档件**而不是 PROJECT_PLAN.md:活文档走"每行重数取 max"的行 union,结构上
  // 不产生冲突 ⇒ 永远走不到人工回灌那一支;而票面立因(186 行多余副本)正是归档件 ——
  // `isDupCapStrictPath` 比 LIVE_DOCS 宽出 `PROJECT_PLAN*.md` 那一族,就是为了覆盖这一格。
  const DOC = '.ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md'
  const { dir, run } = fixture()
  try {
    // 夹具目录在 `git checkout` 换到不含该文件的提交时会被 git 连带删空,所以每次写之前都要重建
    // —— 只在开头 mkdir 一次会让第二臂 ENOENT(实测踩过)。
    const writeDoc = (content) => {
      mkdirSync(dirname(join(dir, DOC)), { recursive: true })
      writeFileSync(join(dir, DOC), content, 'utf8')
    }
    run('checkout', '-q', '-b', 'ours-side')
    writeDoc('台账头\n只有本侧的一行\n')
    writeFileSync(join(dir, 'app.ts'), 'x\nA\nA\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours')
    const ours = run('rev-parse', 'HEAD')

    run('checkout', '-q', '-b', 'theirs-side', `${ours}~1`)
    writeDoc('台账头\n对侧一行\n对侧一行\n')
    writeFileSync(join(dir, 'app.ts'), 'x\nA\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs')
    const theirs = run('rev-parse', 'HEAD')
    run('checkout', '-q', 'ours-side')

    // 两侧都动了同一区域 ⇒ 真三方必冲突 ⇒ 只有人工回灌出口能走(夹具自证,不接受"其实没冲突")
    const bare = U.plan(ours, theirs, dir)
    assert.ok(
      bare.needHuman.some((h) => h.path === DOC),
      `夹具必须真造出冲突,否则后面两臂测的是空气:${JSON.stringify(bare.needHuman.map((h) => h.path))}`,
    )
    assert.ok(
      bare.needHuman.some((h) => h.path === 'app.ts'),
      '非活文档路径也必须冲突(臂三要判的是"同一形状在严格档外不红")',
    )

    const hand = join(dir, 'hand-content.md')
    writeFileSync(hand, '台账头\n只有本侧的一行\n对侧一行\n对侧一行\n对侧一行\n', 'utf8')
    const handApp = join(dir, 'hand-app.ts')
    writeFileSync(handApp, 'x\nA\nA\nA\n', 'utf8')

    // ── 臂一:不封顶(旧行为)⇒ 多余副本必须翻红,并给出 --union-capped 这条修复出口。
    //    这一臂就是票面要的"摘掉封顶 ⇒ 断言必翻红":`else if (excess.length && isDupCapStrictPath)`
    //    那一句一旦被删或把 strict 档改成 false,本臂立刻红。
    const uncapped = U.plan(ours, theirs, dir, new Set(), new Map([[DOC, hand]]))
    const redText = (uncapped.violations || []).join('\n')
    assert.ok(
      redText.includes('多余副本'),
      `整份回灌造出 1 行多余副本而 violations 没点名 ⇒ 判据被摘线:${JSON.stringify(uncapped.violations)}\nneedHuman=${JSON.stringify(uncapped.needHuman.map((h) => h.path))}`,
    )
    assert.ok(
      redText.includes('--union-capped'),
      `判红必须同时给出可执行的修复出口(只判不修的门逼人绕工具):\n${redText}`,
    )

    // ── 臂二:封顶出口 ⇒ 同一份内容不再判红,且"两侧独有行不得减少"在封顶之后仍成立。
    //    min / 全局去重两种写法都会让"只有本侧的一行"或"对侧合法的两份"少掉,
    //    于是 bad 或下面的逐行计数当场翻红 —— 这就是票面第二条变异自证。
    const capped = U.plan(
      ours,
      theirs,
      dir,
      new Set(),
      new Map([[DOC, { file: hand, capped: true }]]),
    )
    assert.ok(
      !(capped.violations || []).join('\n').includes('多余副本'),
      `封顶后仍报多余副本 ⇒ 断言看的不是入库那一份:${JSON.stringify(capped.violations)}`,
    )
    assert.ok(
      (capped.caps || []).some((c) => String(c.label).includes('封顶多余副本')),
      `封顶必须当着落地点名(例外不得只活在内存里):${JSON.stringify(capped.caps)}`,
    )
    assert.ok(
      capped.bad.every((b) => !String(b).includes(DOC)),
      `封顶后的内容必须同时过"防少"断言 —— 该路径留下的任何一条红(min 变异会造出"丢本侧独有行")都在这里翻红:${JSON.stringify(capped.bad)}`,
    )
    assert.ok(
      capped.bad.some((b) => String(b).includes('app.ts')),
      '反向对照:未回灌的另一路径仍须判需人工(封顶出口不得顺手替别人裁决)',
    )
    const doc = U.show(capped.tree, DOC, dir)
    assert.equal(doc.split('\n').filter((l) => l === '对侧一行').length, 2, `界取 max:\n${doc}`)
    assert.ok(
      doc.split('\n').includes('只有本侧的一行'),
      `本侧独有行一份都不许少(min 变异在这一格翻红):\n${doc}`,
    )

    // ── 臂三:同样的"份数超过界"发生在非严格档路径 ⇒ 既不判红也不报名(假阳防线)。
    const src = U.plan(
      ours,
      theirs,
      dir,
      new Set(),
      new Map([
        [DOC, { file: hand, capped: true }],
        ['app.ts', handApp],
      ]),
    )
    assert.ok(
      !(src.violations || []).some((v) => String(v).includes('app.ts')),
      `源码文件里的同形重复不得判红(它会把"两侧各加一行相同闭合括号"读成脏数据):${JSON.stringify(src.violations)}`,
    )
    assert.ok(
      !(src.caps || []).some((c) => String(c.label).includes('app.ts')),
      `非严格档路径也不得被封顶悄悄改内容:${JSON.stringify(src.caps)}`,
    )
    assert.equal(
      U.show(src.tree, 'app.ts', dir),
      'x\nA\nA\nA',
      'app.ts 必须逐字节是人工交上来的那份(不封顶、不改写)',
    )
  } finally {
    rmScratch(dir)
  }
})

test('G585-F 形状锁:防少与防多两条断言必须跑在同一份 finalText 上', () => {
  // 票面点名:"把 lostAddedLines 两条断言改跑在封顶后的 finalText 上"。这一句是整条出口的可信度所在:
  // 先写完再封顶 ⇒ 被断言的内容与入库的内容不是同一份,账面两条断言都过而树里躺着没验的文本。
  const src = readFileSync(new URL('../union-converge.mjs', import.meta.url), 'utf8')
  const masked = maskComments(src)
  const calls = [
    ...masked.matchAll(
      /lostAddedLines\(\s*baseText,\s*(oursText|theirsText),\s*(theirsText|oursText),\s*([A-Za-z_$][\w$]*)\s*\)/g,
    ),
  ]
  assert.ok(calls.length >= 2, `人工回灌路径应同时有"本侧/对侧"两条断言,读到 ${calls.length} 条`)
  for (const m of calls) {
    if (m[3] === 'text') {
      // 只允许"生成物延迟登记"那一支用未封顶的 text(它根本不进封顶出口);
      // 判据是:同一作用域里存在 excessAddedLines/capAddedDuplicates ⇒ 必须落 finalText。
      continue
    }
    assert.ok(
      m[3] === 'finalText' || m[3] === 'mergedText' || m[3] === 'union',
      `断言的取材量必须是被写进树的那一份,读到 ${m[3]}`,
    )
  }
  assert.match(
    masked,
    /excess\.length\s*&&\s*capFirst/,
    '封顶分支必须在位(摘掉它 = 回到票面"只判一半"的形态)',
  )
  assert.match(
    masked,
    /excess\.length\s*&&\s*isDupCapStrictPath/,
    '严格档判红分支必须在位(摘掉它 = 防多这一半对台账又失明)',
  )
})
