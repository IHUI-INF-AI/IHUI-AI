// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「合并新增文件存续性对账」镜像测试(§22c:直接 import 源模块,不复制实现)
 *
 * 这里钉五件事,顺序有意义:
 *  1. **判据本身**会抓到"合并吞掉对侧独有新增"(用真临时仓造一次事故,不是读字符串);
 *  2. **口径**不会把已入库的历史事故变成后来每次提交的恒红门 —— 那是逼人紧急跳过、连带废掉全部守门;
 *  3. **装车**:runner 里真的注册了这道门(blocking + 自己的 skipEnv + 编号恰好一次),
 *     且它被守门 80 的 HOT 清单覆盖、被 AGENTS/README 点名(否则守门 89 R4 判红);
 *  4. **取材面**:取数必须真走 `lib/face-reader.mjs`,且由守门 118 本人的分类器确认是 `face`
 *     (半接线 = 这层看起来在用、判定面其实没换);
 *  5. **面的方向**:台账三面分歧时取磁盘面 —— 本门判的是 commit/tree 对象,结构上没有索引面可切。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../check-merge-addition-loss.mjs'
import { __test__ as DISC, maskComments } from '../check-gate-face-discipline.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const SCRIPT = 'check-merge-addition-loss.mjs'

function repo() {
  const dir = mkScratch('ihui-merge-loss-it-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  writeFileSync(join(dir, 'base.txt'), 'shared\n', 'utf8')
  run('add', 'base.txt')
  run('commit', '-qm', 'init')
  return { dir, run }
}

test('事故形态(整棵树按一侧回写)必须被抓到并点名路径', () => {
  const { dir, run } = repo()
  try {
    run('checkout', '-qb', 'a')
    writeFileSync(join(dir, 'feature.ts'), 'export const x = 1\n', 'utf8')
    run('add', 'feature.ts')
    run('commit', '-qm', 'feat: 新增 feature.ts')
    run('checkout', '-q', 'main')
    writeFileSync(join(dir, 'other.txt'), 'b\n', 'utf8')
    run('add', 'other.txt')
    run('commit', '-qm', 'chore: B 侧')
    const good = run('merge', '-q', '--no-edit', 'a')
    assert.equal(good, '', '正常合并应当成功')
    assert.equal(G.auditOne('HEAD', dir).lost.length, 0, '三路合并把对侧新增保住了,不得判红')

    // 现在把合并结果"回写成合并前的 B 侧整棵树" —— 这正是 2026-09-24 那枚合并的几何形状
    const beforeB = run('rev-parse', 'HEAD^1^')
    const head = run('rev-parse', 'HEAD')
    const bad = run('commit-tree', `${beforeB}^{tree}`, '-p', head, '-p', beforeB, '-m', 'accident')
    run('update-ref', 'HEAD', bad)
    const hit = G.auditOne('HEAD', dir)
    assert.ok(hit.merge, '必须认得出这是合并')
    assert.deepEqual(
      hit.lost.map((l) => l.path).sort(),
      ['feature.ts', 'other.txt'].sort(),
      `两侧独有新增都必须被点名,实际:${JSON.stringify(hit.lost)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('后手补回豁免(2026-10-19):对照面读到已补回才降级,部分补回不得洗成整体清白', () => {
  const { dir, run } = repo()
  try {
    run('checkout', '-qb', 'a')
    writeFileSync(join(dir, 'feature.ts'), 'export const x = 1\n', 'utf8')
    run('add', 'feature.ts')
    run('commit', '-qm', 'feat: 新增 feature.ts')
    run('checkout', '-q', 'main')
    writeFileSync(join(dir, 'other.txt'), 'b\n', 'utf8')
    run('add', 'other.txt')
    run('commit', '-qm', 'chore: B 侧')
    run('merge', '-q', '--no-edit', 'a')
    const beforeB = run('rev-parse', 'HEAD^1^')
    const head = run('rev-parse', 'HEAD')
    const bad = run('commit-tree', `${beforeB}^{tree}`, '-p', head, '-p', beforeB, '-m', 'accident')
    run('update-ref', 'HEAD', bad)
    // commit-tree/update-ref 不动索引 ⇒ 先把索引对齐,否则下一枚提交会把被吞的文件"顺手带回树",
    // 夹具自己造出假的重补现场(判据没变,变的是夹具保真度)。
    run('reset', '-q', '--mixed', 'HEAD')
    writeFileSync(join(dir, 'feature.ts'), 'export const x = 1\n', 'utf8')
    run('add', 'feature.ts')
    run('commit', '-qm', 'fix: 只补回 feature.ts')

    const h = G.auditOne(bad, dir)
    assert.ok(h.repaired.some((x) => x.path === 'feature.ts'), `已补回的必须进 repaired:${JSON.stringify(h.repaired)}`)
    assert.ok(!h.lost.some((x) => x.path === 'feature.ts'), '已补回的不得再算丢失(否则信会让收件人去补早已在树里的文件)')
    assert.ok(h.lost.some((x) => x.path === 'other.txt'), '没补的那条必须照旧判丢失(部分补回≠整体清白)')

    // 阳性对照:对照面换成事故自身 ⇒ 同一枚必须重新判丢失。摘掉 atRef 那一支,这例会直接翻绿。
    const self = G.auditOne(bad, dir, bad)
    assert.deepEqual(self.lost.map((x) => x.path).sort(), ['feature.ts', 'other.txt'].sort(), '对照面=合并自己 ⇒ 两侧独有新增全部判回')
    assert.equal(self.repaired.length, 0, '对照面里没有的东西不得被记成"已补回"')

    // 对照面取不到 ⇒ 退回判丢失并报名,不记绿(§0.3)
    const none = G.auditOne(bad, dir, 'refs/tags/不存在')
    assert.ok(none.lost.some((x) => x.path === 'feature.ts'), 'atRef 取不到 ⇒ 不得把"量不到"读成已补回')
    assert.ok(none.atRefUndetermined, '取不到必须点名,不许静默')
  } finally {
    rmScratch(dir)
  }
})

test('未知旗标 ⇒ 未判定名单(本门没有 --json,静默吃掉等于"文字出了而退出码没出")', () => {
  assert.deepEqual(G.unknownFlags(['--json']), ['--json'])
  assert.deepEqual(G.unknownFlags([]), [])
  assert.deepEqual(G.unknownFlags(['--rev', 'abc', '--staged', '--all-new', '--self-test', '--worktree', '--limit', '3']), [])
  assert.deepEqual(G.unknownFlags(['--nope', '--json']), ['--nope', '--json'])
})

test('缓存键必须剥到 tree oid:按符号名缓存会把 ref 移动后的新树读成旧树', () => {
  const src = readFileSync(new URL(`../${SCRIPT}`, import.meta.url), 'utf8')
  assert.match(src, /rev-parse', '--verify', `\$\{rev\}\^\{tree\}`/, 'treePaths 必须先剥 oid')
  assert.doesNotMatch(src, /const key = `\$\{cwd\}::\$\{rev\}`/, '不得用符号名当缓存键(自检第 2 例曾因此把真事故判成绿)')
})

test('parentsOf 的 token 偏移:rev-list --parents 第一个 token 是提交自己', () => {
  const { dir, run } = repo()
  try {
    writeFileSync(join(dir, 'x.txt'), '1\n', 'utf8')
    run('add', 'x.txt')
    run('commit', '-qm', 'second')
    assert.deepEqual(G.parentsOf('HEAD', dir).length, 1, '普通提交应有 1 个父')
    run('checkout', '-qb', 'c')
    writeFileSync(join(dir, 'y.txt'), '2\n', 'utf8')
    run('add', 'y.txt')
    run('commit', '-qm', 'on c')
    run('checkout', '-q', 'main')
    // 必须先让 main 也前进,否则 `merge c` 是 fast-forward ⇒ 根本没有合并提交,
    //   这条断言会退化成"检查一个不存在的形状"(实测第一次就是这么绿的假象来源)。
    writeFileSync(join(dir, 'z.txt'), '3\n', 'utf8')
    run('add', 'z.txt')
    run('commit', '-qm', 'on main')
    run('merge', '-q', '--no-edit', 'c')
    assert.equal(G.parentsOf('HEAD', dir).length, 2, '合并提交必须认出 2 个父(slice 偏移错会判成 1 个 ⇒ 整门恒绿)')
  } finally {
    rmScratch(dir)
  }
})

test('口径:未推的合并判红,已进 origin/main 的历史事故不拦后来每次提交', () => {
  const { dir, run } = repo()
  try {
    run('checkout', '-qb', 'a')
    writeFileSync(join(dir, 'feature.ts'), 'x\n', 'utf8')
    run('add', 'feature.ts')
    run('commit', '-qm', 'feat: a 侧新增')
    run('checkout', '-q', 'main')
    writeFileSync(join(dir, 'other.txt'), 'b\n', 'utf8')
    run('add', 'other.txt')
    run('commit', '-qm', 'chore: b 侧')
    run('merge', '-q', '--no-edit', 'a')
    const head = run('rev-parse', 'HEAD')
    const beforeB = run('rev-parse', 'HEAD^1^')
    const bad = run('commit-tree', `${beforeB}^{tree}`, '-p', head, '-p', beforeB, '-m', 'accident')
    run('update-ref', 'HEAD', bad)
    const badSha = bad

    assert.ok(
      G.pendingMerges(dir).some((r) => r.rev === badSha && r.lost.length > 0),
      '阳性对照:事故还没进 origin/main 时必须拦住',
    )
    run('update-ref', 'refs/remotes/origin/main', badSha)
    assert.ok(
      !G.pendingMerges(dir).some((r) => r.rev === badSha),
      '同一枚进入 origin/main 后不得再拦(否则每次提交都恒红,只会逼人紧急跳过)',
    )
    // 增量台账:别人推来的也能判到一次,且不会每轮重复
    const marker = join(dir, 'marker.json')
    assert.ok(G.auditUnseen(400, dir, marker).some((r) => r.rev === badSha))
    assert.equal(G.auditUnseen(400, dir, marker).length, 0, '已记过的合并不得每轮重判')
  } finally {
    rmScratch(dir)
  }
})

test('装车证明:runner 真注册了这道门,且编号恰好一次、被 HOT 清单与文档点名', () => {
  const runner = readFileSync(new URL('../guardian-runner.mjs', import.meta.url), 'utf8')
  const blocks = [...runner.matchAll(/id: '(\d+[a-z]?)',\n\s+label:[\s\S]*?script: '([^']+)'/g)]
  const mine = blocks.filter((m) => m[2] === SCRIPT)
  assert.equal(mine.length, 1, `runner 里必须恰好一处调用 ${SCRIPT},实际 ${mine.length}`)
  const id = mine[0][1]
  const sameId = blocks.filter((m) => m[1] === id)
  assert.equal(sameId.length, 1, `id ${id} 在 runner 里重复,会串 skipEnv 与失败归属`)
  const entry = runner.slice(runner.indexOf(`id: '${id}'`), runner.indexOf(`id: '${id}'`) + 1400)
  assert.match(entry, /mode: 'blocking'/, '必须 blocking —— warn 级挡不住整批文件消失')
  assert.match(entry, /skipEnv: 'HUSKY_SKIP_MERGE_ADDITION_LOSS'/, '必须有应急通道')
  assert.doesNotMatch(entry, /stagedTriggers: \[\]/, 'stagedTriggers 写空数组等于声明"永不触发"⇒ 门永不被调用')

  const hot = readFileSync(new URL('../check-git-read-timeout.mjs', import.meta.url), 'utf8')
  assert.ok(hot.includes(`'scripts/${SCRIPT}'`), '必须进守门 80 的 HOT 清单(一次审计 ls-tree 多棵全量树)')
  for (const doc of ['../../AGENTS.md', '../../README.md']) {
    const t = readFileSync(new URL(doc, import.meta.url), 'utf8')
    assert.ok(t.includes(SCRIPT), `${doc} 必须点名本门,否则守门 89 R4 判红`)
  }
})

// ── G-175:区间左端的选择必须是纯函数 + 构造面(pendingMerges 要联网,本身不可单测) ──
test('chooseRange 三分支:残值不可解析 ⇒ null(交回有界+台账,绝不拿它当区间左端)', () => {
  assert.equal(G.chooseRange({ remote: '', exists: false }), 'HEAD')
  assert.equal(G.chooseRange({ remote: 'a'.repeat(40), exists: true }), 'a'.repeat(40) + '..HEAD')
  assert.equal(G.chooseRange({ remote: 'b'.repeat(40), exists: false }), null)
})

test('commitExists:真 HEAD ⇒ true;随机 40 位 sha ⇒ false(多机残值就这形状);空串 ⇒ false', () => {
  const head = execFileSync(GIT, ['-c', 'safe.directory=*', 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  assert.equal(G.commitExists(head), true)
  assert.equal(G.commitExists('dead'.repeat(10)), false)
  assert.equal(G.commitExists(''), false, '空串必须 false,否则 chooseRange 走错分支')
})

test('反向锁:remote 三元式不得回来(回来 = 不可解析残值再次让 rev-list fatal)', () => {
  const src = readFileSync(new URL('../check-merge-addition-loss.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(
    src,
    /const range = remote [?] /,
    '选区间绕回三元式 ⇒ 门以 exit 2 冒充 blocking 违规,且没人能修',
  )
  assert.match(src, /const range = chooseRange[(]/, '选区间的决策必须走纯函数,不然不可证')
})

// ── A2(2026-10-22,G-939 判据缺口①):两父都有的路径在结果树里缺席 ──
test('A2:两父共有且基底里也有的路径,结果树丢掉时必须判红(A1 的前件在这一型上恒假)', () => {
  const { dir, run } = repo()
  try {
    writeFileSync(join(dir, 'shared.txt'), 'both sides keep it\n', 'utf8')
    run('add', 'shared.txt')
    run('commit', '-qm', 'shared.txt 进基底')
    const p1 = run('rev-parse', 'HEAD')
    // 第二父:树同 p1、多走一枚 ⇒ 共同基底就是 p1 ⇒ shared.txt ∈ 基底 ⇒ A1 结构上看不见
    const p2 = run('commit-tree', `${p1}^{tree}`, '-p', p1, '-m', '第二父(同树)')
    const p1Parent = run('rev-parse', `${p1}^`)
    const staleTree = run('rev-parse', `${p1Parent}^{tree}`)
    const merge = run('commit-tree', staleTree, '-p', p1, '-p', p2, '-m', 'A2 事故:结果树取旧基线')
    const res = G.auditOne(merge, dir, merge)
    assert.deepEqual(
      res.lost.map((x) => x.path),
      ['shared.txt'],
      `A1 必须一无所获(A2 是唯一能看见这一型的判据),实际:${JSON.stringify(res.lost)}`,
    )
    assert.equal(res.lost[0].byAllParents, true)

    // 反向对照:正常三路合并(shared.txt 两父都留)⇒ A2 不得判红
    run('checkout', '-qb', 'x')
    writeFileSync(join(dir, 'x.txt'), '1\n', 'utf8')
    run('add', 'x.txt')
    run('commit', '-qm', 'x 侧新增')
    run('checkout', '-q', 'main')
    run('merge', '-q', '--no-edit', 'x')
    const good = G.auditOne('HEAD', dir)
    assert.equal(good.lost.length, 0, `正常合并被 A2 误伤:${JSON.stringify(good.lost)}`)
    assert.equal(good.repaired.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('presentIn 与 treePaths 同语义:按路径批问不得漂出第二套成员性判据', () => {
  const { dir, run } = repo()
  try {
    writeFileSync(join(dir, 'only-here.txt'), 'x\n', 'utf8')
    run('add', 'only-here.txt')
    run('commit', '-qm', 'add')
    const set = G.treePaths('HEAD', dir)
    const r = G.presentIn('HEAD', ['base.txt', 'only-here.txt', 'nope.txt'], dir)
    assert.equal(r.failed, false)
    for (const p of ['base.txt', 'only-here.txt', 'nope.txt']) assert.equal(r.map.get(p), set.has(p), `对 ${p} 两路取证不一致`)
  } finally {
    rmScratch(dir)
  }
})

// ── A3(2026-10-22,G-939 判据缺口②):引用位移把整条线丢出祖先链 ──
test('A3:引用侧移必须判红;补回降级 repaired;位移两端入库后不重判;分离头如实未判定', () => {
  const { dir, run } = repo()
  try {
    writeFileSync(join(dir, 'dropped.ts'), 'export const dropped = 1\n', 'utf8')
    run('add', 'dropped.ts')
    run('commit', '-qm', 'feat: 只存在于将被丢掉的那条线上')
    const keep = run('rev-parse', 'HEAD')
    const dropTo = run('rev-parse', 'HEAD~1')
    run('update-ref', '-m', 'relay align(commit-tree+CAS 旁路落地的形态)', 'HEAD', dropTo)

    const mv = G.refMoves(dir)
    assert.ok(mv.ok, `分支 reflog 必须读得到:${JSON.stringify(mv)}`)
    assert.ok(mv.moves.some((m) => m.from === keep && m.to === dropTo), `相邻侧移未被读出:${JSON.stringify(mv.moves)}`)

    const row = G.auditRefMove(keep, dropTo, dir, dropTo)
    assert.deepEqual(row.lost.map((x) => x.path), ['dropped.ts'], `丢的路径必须点名:${JSON.stringify(row)}`)
    assert.ok(row.droppedCommits >= 1, '被丢提交数必须量到')
    // 反向对照:正常前进(from 是 to 的祖先)一律放过 —— 否则每次提交都会被读成位移
    assert.equal(G.auditRefMove(dropTo, keep, dir, keep).lost.length, 0)
    assert.equal(G.auditRefMove(dropTo, keep, dir, keep).droppedCommits, 0)

    // 提交链口径:落点尚未入库 ⇒ 必须在提交前抓到(这是 A3 值钱的那一格)
    const live = G.auditRefMoves(dir, { remote: '' })
    assert.ok(
      live.ok && live.rows.some((r) => r.from === keep && r.rev === dropTo && r.lost.some((x) => x.path === 'dropped.ts')),
      `未推送的侧移未被抓到:${JSON.stringify(live.rows.map((r) => [r.from.slice(0, 7), r.rev.slice(0, 7), r.lost.length]))}`,
    )

    // 后手补回 ⇒ repaired(与 A1 同口径,不得洗成无声)
    writeFileSync(join(dir, 'dropped.ts'), 'export const dropped = 1\n', 'utf8')
    run('add', 'dropped.ts')
    run('commit', '-qm', 'fix: 把被侧移丢掉的 dropped.ts 补回')
    const healed = G.auditRefMove(keep, dropTo, dir, 'HEAD')
    assert.ok(healed.repaired.some((x) => x.path === 'dropped.ts'), `补回未进 repaired:${JSON.stringify(healed)}`)
    assert.ok(!healed.lost.some((x) => x.path === 'dropped.ts'))

    // 两端都已入库 ⇒ 历史不重判(§12e);origin/main 指向 keep(同时包含两端)
    run('update-ref', 'refs/remotes/origin/main', keep)
    const scoped = G.auditRefMoves(dir)
    assert.ok(!scoped.rows.some((r) => r.from === keep && r.rev === dropTo), `已入库位移被重判:${JSON.stringify(scoped.rows)}`)

    // 分离头 ⇒ 该维如实报未判定,不冒绿
    run('checkout', '-q', '--detach', 'HEAD')
    const detached = G.refMoves(dir)
    assert.equal(detached.ok, false, '分离头下不得声称判过')
    assert.ok(detached.why, '取不到必须点名原因')
  } finally {
    rmScratch(dir)
  }
})

// ── A4(2026-10-23,G-939 残段):位移维的**射程**——滑出窗口的侧移必须仍被判到一次 ──
/**
 * A3 判得到"引用侧移整批丢提交"这一型,但它挂在提交链上、只回看当前分支 reflog 最近 40 条;
 * 而造出这一型的旁路落地 `update-ref` **不跑钩子**(§5b)⇒ 位移发生时没有门在跑,
 * 等下一次带钩子的提交时它可能已经滑出那 40 条(本仓 40 条实测 ≈ 53 分钟)。
 * 这一例就是把那个缺口造出来:同一枚侧移,窗口档读成"无位移",游标档必须判到。
 * 三臂同批:① 阳性 = 游标档抓到并点名丢的路径;② 反向 = 只走快进/正常合并的仓一律 0 行;
 * ③ 幂等 + 截断 = 同一段位移不重判、超出上界的部分下轮补判且被点名。
 */
test('A4:滑出 40 条窗口的侧移 ⇒ 窗口档看不见、游标档必须判到(且不重判、截断不静默丢弃)', () => {
  const { dir, run } = repo()
  const marker = join(dir, 'refmoves.json')
  try {
    // 游标先落在"什么都还没发生"的那一刻(首轮 degraded)
    const first = G.sweepRefMoves(dir, { markerPath: marker, remote: '' })
    assert.equal(first.ok, true, `首轮必须判得动:${JSON.stringify(first)}`)
    assert.ok(first.degraded, '首轮无游标 ⇒ 必须点名"退回窗口",不得静默当"没有位移"')

    // 造一次侧移,并把丢掉的提提交留在盘上(与既有夹具同一条保真纪律:
    // update-ref 只动引用不动索引 ⇒ 不对齐索引的话,下一枚普通提交会把 dropped.ts 顺手带回树里,
    // 于是"丢了"这一臂会被夹具自己洗成"已补回")
    writeFileSync(join(dir, 'dropped.ts'), 'export const dropped = 1\n', 'utf8')
    run('add', 'dropped.ts')
    run('commit', '-qm', 'feat: 只存在于将被丢掉的那条线上')
    const keep = run('rev-parse', 'HEAD')
    const dropTo = run('rev-parse', 'HEAD~1')
    run('update-ref', '-m', 'relay align(旁路落地不跑钩子)', 'HEAD', dropTo)
    run('reset', '-q', '--mixed', 'HEAD')

    // 60 枚普通提交把这次侧移挤出 REF_MOVE_WINDOW(40)
    for (let i = 0; i < 60; i++) {
      writeFileSync(join(dir, `f${i}.txt`), `${i}\n`, 'utf8')
      run('add', `f${i}.txt`)
      run('commit', '-qm', `chore: 普通提交 ${i}`)
    }

    // ① 缺口本身:窗口档读不到这次位移(这就是 G-939 残段的机器形态)
    const win = G.refMoves(dir)
    assert.ok(win.ok && win.moves.length > 0, `窗口档必须读得到位移:${JSON.stringify(win)}`)
    assert.ok(!win.moves.some((m) => m.from === keep && m.to === dropTo), '夹具失准:侧移仍在 40 条窗口内,这一臂证不了射程')
    const winAudit = G.auditRefMoves(dir, { moves: win.moves, remote: '' })
    assert.ok(!winAudit.rows.some((r) => r.from === keep), '窗口档里出现了这次侧移 ⇒ 夹具没把它挤出窗口')

    // ② 阳性对照:游标档必须抓到,并点名被整批丢出祖先链的那条线上引入的路径
    const swept = G.sweepRefMoves(dir, { markerPath: marker, remote: '' })
    const hit = swept.rows.find((r) => r.from === keep && r.rev === dropTo)
    assert.ok(hit, `游标档未抓到滑出窗口的侧移:${JSON.stringify(swept.rows.map((r) => [r.from.slice(0, 8), r.rev.slice(0, 8), r.lost.length]))}`)
    assert.ok(hit.lost.some((x) => x.path === 'dropped.ts'), `丢的路径必须点名:${JSON.stringify(hit.lost)}`)
    assert.ok(hit.droppedCommits >= 1, `被丢提交数必须量到:${JSON.stringify(hit.droppedCommits)}`)
    assert.ok(swept.newPairs >= 60, `游标档应把窗口外的位移一并扫到,实得 ${swept.newPairs}`)

    // ③ 幂等:同一段位移不得重判(否则每轮巡检都在重复报警)
    const tipNow = run('rev-parse', 'HEAD')
    const again = G.sweepRefMoves(dir, { markerPath: marker, remote: '' })
    assert.equal(again.newPairs, 0, `第二轮应无新位移,实得 ${again.newPairs}`)
    assert.equal(again.rows.length, 0, '已判过的位移不得再次成行')
    assert.equal(again.cursor, tipNow, '游标必须推到本轮已判集合的最新那条')

    // ④ 截断:上界之外的部分必须被点名,并由下一轮补判(方向永远是"欠着的下轮补",不是"跳过")
    const capMarker = join(dir, 'cap.json')
    const capped = G.sweepRefMoves(dir, { markerPath: capMarker, remote: '', cursor: '', maxPairs: 5, scanLimit: 2000 })
    assert.equal(capped.swept, 5, `本轮只该判 5 对,实得 ${capped.swept}`)
    assert.ok(capped.pending > 0, `超上界的部分必须被点名,pending=${capped.pending}`)
    const rest = G.sweepRefMoves(dir, { markerPath: capMarker, remote: '' })
    assert.equal(rest.newPairs, capped.pending, `下一轮必须恰好补上欠的那 ${capped.pending} 对,实得 ${rest.newPairs}`)
    assert.equal(rest.pending, 0, '补判轮不得再欠账')
    assert.equal(G.sweepRefMoves(dir, { markerPath: capMarker, remote: '' }).newPairs, 0, '第三轮不该再有残留(不重不漏)')
  } finally {
    rmScratch(dir)
  }
})

/**
 * A4 反向对照(§12e:判据不得把正常形态读成事故):
 * 一路正常提交 + 一枚正常三路合并的仓,游标档必须 0 行 0 红 —— 侧移的判据前件是
 * "from 不是 to 的祖先",快进与真合并天然满足祖先关系,一律放过。
 */
test('A4 反向对照:正常前进 + 正常三路合并 ⇒ 游标档 0 行 0 红(不得把每次提交读成事故)', () => {
  const { dir, run } = repo()
  const marker = join(dir, 'refmoves.json')
  try {
    run('checkout', '-qb', 'a')
    writeFileSync(join(dir, 'feature.ts'), 'export const x = 1\n', 'utf8')
    run('add', 'feature.ts')
    run('commit', '-qm', 'feat: 对侧新增 feature.ts')
    run('checkout', '-q', 'main')
    writeFileSync(join(dir, 'other.txt'), 'b side\n', 'utf8')
    run('add', 'other.txt')
    run('commit', '-qm', 'chore: B 侧改动')
    run('merge', '-q', '--no-edit', 'a')
    const merge = run('rev-parse', 'HEAD')
    for (let i = 0; i < 12; i++) {
      writeFileSync(join(dir, `n${i}.txt`), `${i}\n`, 'utf8')
      run('add', `n${i}.txt`)
      run('commit', '-qm', `chore: 普通提交 ${i}`)
    }
    const swept = G.sweepRefMoves(dir, { markerPath: marker, remote: '' })
    assert.ok(swept.ok, JSON.stringify(swept))
    assert.equal(swept.rows.length, 0, `正常历史被读成事故:${JSON.stringify(swept.rows.map((r) => [r.from.slice(0, 8), r.rev.slice(0, 8), r.lost.length]))}`)
    assert.equal(swept.judged, 0, `不该有任何位移进入判定(除快进确认),实得 ${swept.judged}`)
    // 合并本身也必须是干净的(A1/A2 的正常形态,防止 refactor 把配对改坏后连带误判)
    const m = G.auditOne(merge, dir)
    assert.ok(m.merge && m.lost.length === 0, `正常三路合并被误判:${JSON.stringify(m.lost)}`)
    // 配对实现与窗口档同源:pairMoves 必须等于 refMoves 的 moves(不带 toIndex)
    const ent = G.reflogEntries(dir, 40)
    assert.ok(ent.ok, JSON.stringify(ent))
    assert.deepEqual(G.pairMoves(ent.entries), G.refMoves(dir, 40).moves, 'pairMoves 与 refMoves 必须同源同形(不得两份配对)')
    assert.equal(G.pairMoves(ent.entries).every((m2) => m2.toIndex === undefined), true, '窗口档不带 toIndex(形状锁)')
    assert.equal(G.pairMoves(ent.entries, true).every((m2) => typeof m2.toIndex === 'number'), true, '游标档必须带 toIndex')
  } finally {
    rmScratch(dir)
  }
})

/**
 * A5(2026-10-24,G-939 判据缺口③):内容存续维。
 * 侧移丢掉的那条线改的是**已存在的文件**(路径还在、blob 回退到共同基底)⇒ 路径成员性维看不见,
 * 这一臂证明同一判据改读 blob oid 后必须判红;同时三臂反向:正常前进 / 内容被别人演进过 /
 * 后手重落,三种形态都不得判红。
 */
test('A5:路径还在但内容退回基底必须判红;正常前进/被演进/已重落三臂不得判红', () => {
  const { dir, run } = repo()
  try {
    writeFileSync(join(dir, 'content-a.txt'), 'v0\n', 'utf8')
    run('add', 'content-a.txt')
    run('commit', '-qm', '基底')
    const cBase = run('rev-parse', 'HEAD')
    writeFileSync(join(dir, 'content-a.txt'), 'v1 by dropped line\n', 'utf8')
    run('add', 'content-a.txt')
    run('commit', '-qm', 'feat: 改已有文件内容')
    const cFrom = run('rev-parse', 'HEAD')
    run('update-ref', '-m', 'relay align(旁路落地)', 'HEAD', cBase)
    run('reset', '-q', '--hard', cBase)

    const hit = G.auditRefMove(cFrom, cBase, dir, cBase)
    assert.equal(hit.lost.length, 1, `路径还在、内容回退也必须判红:${JSON.stringify(hit)}`)
    assert.equal(hit.lost[0].path, 'content-a.txt')
    assert.equal(hit.lost[0].contentReverted, true, '必须标出这是内容面命中,而不是路径被删')
    assert.ok(hit.droppedCommits >= 1)

    // 反向①:正常前进(from 是 to 的祖先)一律放过
    assert.equal(G.auditRefMove(cBase, cFrom, dir, cFrom).lost.length, 0)
    // 反向②:结果内容与基底/该线都不同 ⇒ 别人演进过,不得归因给位移
    writeFileSync(join(dir, 'content-b.txt'), 'b0\n', 'utf8')
    run('add', 'content-b.txt')
    run('commit', '-qm', '基底 b')
    const bBase = run('rev-parse', 'HEAD')
    writeFileSync(join(dir, 'content-b.txt'), 'from side\n', 'utf8')
    run('add', 'content-b.txt')
    run('commit', '-qm', '改 b')
    const bFrom = run('rev-parse', 'HEAD')
    run('reset', '-q', '--hard', bBase)
    writeFileSync(join(dir, 'content-b.txt'), 'to side evolved\n', 'utf8')
    run('add', 'content-b.txt')
    run('commit', '-qm', '另一侧也改 b')
    const bTo = run('rev-parse', 'HEAD')
    assert.equal(G.auditRefMove(bFrom, bTo, dir, bTo).lost.length, 0, '内容被演进过不得判红')
    // 反向③:后手重落(blob 离开基底)⇒ repaired,不重复喊人补
    writeFileSync(join(dir, 'content-a.txt'), 'v1 re-landed by hand\n', 'utf8')
    run('add', 'content-a.txt')
    run('commit', '-qm', '重落 content-a')
    const healed = G.auditRefMove(cFrom, cBase, dir, 'HEAD')
    assert.ok(healed.repaired.some((x) => x.path === 'content-a.txt' && x.contentReverted === true), JSON.stringify(healed))
    assert.ok(!healed.lost.some((x) => x.path === 'content-a.txt'), '已重落不得再判红')
  } finally {
    rmScratch(dir)
  }
})

test('A5 生成块:差异只在机器标记区块内不判丢失;区块外实义改动仍判红(2026-10-25)', () => {
  const { dir, run } = repo()
  try {
    const { begin, end } = G.GENERATED_REGIONS.find((r) => r.begin.includes('RECENT UPDATES'))
    assert.ok(begin && end, '标记必须来自源模块(不得在测试里复制一份)')
    const doc = (block, tail) => `# doc\n${begin}\n${block}\n${end}\n${tail}\n`
    writeFileSync(join(dir, 'gen.md'), doc('old', 'tail A'), 'utf8')
    run('add', 'gen.md')
    run('commit', '-qm', '基底 gen')
    const base = run('rev-parse', 'HEAD')
    writeFileSync(join(dir, 'gen.md'), doc('new', 'tail A'), 'utf8')
    run('add', 'gen.md')
    run('commit', '-qm', '只翻新生成块')
    const from = run('rev-parse', 'HEAD')
    run('update-ref', '-m', 'relay align(生成块)', 'HEAD', base)
    run('reset', '-q', '--hard', base)
    const churn = G.auditRefMove(from, base, dir, base)
    assert.equal(churn.lost.length, 0, `生成块翻新不得判红:${JSON.stringify(churn)}`)
    assert.ok(churn.generatedChurn.some((x) => x.path === 'gen.md'), '必须点名 generatedChurn(不洗成无声)')

    writeFileSync(join(dir, 'gen.md'), doc('newer', 'tail B'), 'utf8')
    run('add', 'gen.md')
    run('commit', '-qm', '生成块翻新 + 正文也改')
    const from2 = run('rev-parse', 'HEAD')
    run('update-ref', '-m', 'relay align(实义)', 'HEAD', base)
    run('reset', '-q', '--hard', base)
    const real = G.auditRefMove(from2, base, dir, base)
    assert.equal(real.lost.length, 1, `区块外实义改动必须仍判红:${JSON.stringify(real)}`)
    assert.equal(real.lost[0].path, 'gen.md')

    const dangling = `a\n${begin}\nx\nb\n`
    assert.equal(G.stripGeneratedDocRegions(dangling), dangling, '标记不成对不得剥离')
    assert.equal(G.stripGeneratedDocRegions(`a\n${begin}\nx\n${end}\nb\n`), 'a\n\nb\n', '成对时只剥区块')
  } finally {
    rmScratch(dir)
  }
})

test('blobMapAt 与 presentIn 同源:成员性面与内容面必须取自同一份派生(不得两套取数)', () => {
  const { dir, run } = repo()
  try {
    writeFileSync(join(dir, 'only-here.txt'), 'x\n', 'utf8')
    run('add', 'only-here.txt')
    run('commit', '-qm', 'add')
    const set = G.treePaths('HEAD', dir)
    const pres = G.presentIn('HEAD', ['base.txt', 'only-here.txt', 'nope.txt'], dir)
    const blobs = G.blobMapAt('HEAD', ['base.txt', 'only-here.txt', 'nope.txt'], dir)
    assert.equal(blobs.failed, false)
    for (const p of ['base.txt', 'only-here.txt', 'nope.txt']) {
      assert.equal(blobs.map.get(p) !== null, pres.map.get(p), `对 ${p} 成员性与内容面不一致`)
      assert.equal(blobs.map.get(p) !== null, set.has(p), `对 ${p} 与 treePaths 不一致`)
    }
  } finally {
    rmScratch(dir)
  }
})

/**
 * A4 阳性对照用**真仓历史**(票 G-939 原案):`72b3a20c50 → 588a6342d8`(reflog 消息 `g921c relay align`)。
 * 这一型在 2026-10-21 当场没响,是因为门只有 A1、而 A1 的被审对象是"合并提交"—— 现场根本没有合并提交。
 * 夹具会随仓演进消失(对象被 GC / 别的 checkout 没有这两枚)⇒ 先问可达性,取不到就如实跳过并说明,
 * 不得让这条真历史例变成别台的恒红门(§12e)。
 */
test('A4 阳性对照(真仓 G-939 原案):侧移必须被点名,内容已重落 ⇒ 落 repaired 不落 lost', () => {
  const REPO = fileURLToPath(new URL('../..', import.meta.url))
  const from = '72b3a20c50'
  const to = '588a6342d8'
  if (!G.commitExists(from, REPO) || !G.commitExists(to, REPO)) {
    console.log(`ℹ️ 真仓历史两枚位移端点不在本仓(${from}/${to})⇒ 这一例跳过,不记绿也不冒红`)
    return
  }
  // 票面事实①:被吞的那枚既不在 HEAD 祖先链、也不在 origin/main 上
  assert.equal(G.isAncestor('12898ccd9bcb2b8e094e0057d94e0fab0380293a', 'HEAD', REPO), false, '票面事实① 失准:原枚仍在 HEAD 祖先链')
  const r = G.auditRefMove(from, to, REPO, 'HEAD')
  assert.equal(r.kind, 'ref-move')
  assert.ok(r.droppedCommits >= 1, `被丢提交数应 ≥1,实得 ${r.droppedCommits}`)
  const named = [...r.lost, ...r.repaired].map((x) => x.path)
  assert.ok(named.length > 0, `位移两侧的差异必须被点名(lost+repaired 皆空 = 判据没问到东西):${JSON.stringify(r)}`)
  // A5 票面事实③:原枚改了 11 枚文件,其中 5 枚新增(A3 面)、6 枚改已有文件且 blob 退回基底(A5 面)。
  // 修复前 `--move` 只报 5 条 repaired —— 那 6 枚在路径成员性维上"还在",当场判绿。
  assert.equal(named.length, 11, `票面 11 枚文件必须全部被点名(A5 缺位时只剩 5 条):${JSON.stringify(named)}`)
  const contentReverted = r.repaired.filter((x) => x.contentReverted === true)
  assert.equal(contentReverted.length, 6, `改已有文件的 6 枚必须由 A5 点名:${JSON.stringify(r.repaired)}`)
  for (const p of [
    'apps/web/src/components/ai/ai-side-panel-tools.tsx',
    'apps/web/src/components/ai/ai-side-panel.tsx',
    'apps/web/src/components/ai/chat-pane-body.tsx',
    'apps/web/src/components/ai/import-analysis-dialog.tsx',
    'apps/web/src/hooks/use-chat/resume-stream.ts',
    'apps/web/src/stores/ai-tools-panel.ts',
  ])
    assert.ok(contentReverted.some((x) => x.path === p), `${p} 的内容回退未被 A5 点名`)
  // 票面事实②:内容已被 d3541dc2 重落 ⇒ 必须落 repaired,不得冒红(红了收信人只能重复补回,§5e-1)
  assert.equal(r.lost.length, 0, `内容已重落却被判丢失:${JSON.stringify(r.lost)}`)
  assert.ok(G.isAncestor('d3541dc2670cec8634a57d04bcfbe5ff2b47c093', 'HEAD', REPO), '票面事实② 失准:重落枚不在 HEAD 祖先链')
  // --move 取值解析(纯函数三臂):两枚齐 / 缺一个点 / 空段
  assert.deepEqual(G.parseMoveSpec('a..b'), { from: 'a', to: 'b' })
  assert.deepEqual(G.parseMoveSpec('HEAD~3..HEAD~2'), { from: 'HEAD~3', to: 'HEAD~2' })
  assert.ok(G.parseMoveSpec('只有单边').error, '缺 .. 必须报错,不得当成一枚位移直取')
  assert.ok(G.parseMoveSpec('..to').error && G.parseMoveSpec('from..').error, '两端的空段都必须报错')
  // 未知旗标档必须认得 --move(带值不吃值 ⇒ 否则 unknownFlags 把值读成旗标)
  assert.deepEqual(G.unknownFlags(['--move', 'a..b']), [])
  assert.deepEqual(G.unknownFlags(['--move', 'a..b', '--staged']), [])
  // 游标定位:同一枚 sha 重复出现时必须取**最旧**那次(宁可重判,不可漏判)
  const ents = [{ sha: 'X' }, { sha: 'Y' }, { sha: 'X' }, { sha: 'Z' }]
  assert.equal(G.locateMoveCursor(ents, 'X'), 2, `游标必须落在最旧那次出现,实得 ${G.locateMoveCursor(ents, 'X')}`)
  assert.equal(G.locateMoveCursor(ents, '不存在'), -1, '游标找不到 ⇒ -1(由调用方按 degraded 点名)')
})



/**
 * 装车证明(取材面)。三条一起读才成立:
 *  ① 层的**读取入口**真出现在取材路径上(不是只 import 了这层 —— 那正是本门被判 `half-wired` 的形态:
 *     引了 `resolveRemoteHead`,内容却仍由自己 `execFileSync` 派生 / 自己 `readFileSync` 读);
 *  ② 自派生的 git 与磁盘读取都不在了(判据跑在**遮掉注释**的文本上,否则本文件说明历史的那句
 *     "此前本门自己 execFileSync 派生"会让锁自己假红 —— 遮噪用的是门 118 本人那份,不另写一遍);
 *  ③ 直接拿门 118 的分类器问一次:本文件必须是 `face`。这一条是**尺子说话**,
 *     它比"看起来像走层了"强 —— 半接线归零这件事由判它的那道门当场确认。
 */
test('装车证明:取数必须真走 lib/face-reader.mjs,且门 118 对本文件的定性必须是 face', () => {
  const src = readFileSync(new URL(`../${SCRIPT}`, import.meta.url), 'utf8')
  const code = maskComments(src)
  assert.match(
    code,
    /(?:^|[^.\w$])(?:catBatch|readWorktreeFile)\s*\(/,
    '必须调用层的读取入口取内容(门 118 只认 catBatch / readWorktreeFile 两个凭证)',
  )
  assert.match(code, /gitRaw\s*\(/, 'git 派生必须经层的 gitRaw(绝对路径 / stdio / maxBuffer 一份实现)')
  assert.doesNotMatch(code, /execFileSync\s*\(/, '不得再自派生 git —— 那是 half-wired 的前半')
  assert.doesNotMatch(code, /readFileSync\s*\(/, '不得再自己 readFileSync 读台账 —— 那是 half-wired 的后半')
  assert.doesNotMatch(code, /C:\/Program Files\/Git\/cmd\/git\.exe/, 'git 绝对路径只在层里有一份(本文件镜像夹具除外)')
  assert.equal(
    DISC.classify(`scripts/${SCRIPT}`, src).kind,
    'face',
    '本门被守门 118 判成非 face ⇒ 全仓 half-wired 归零的前提破了(恒红门的前置就是各会话跳门)',
  )
})

/**
 * 本门**不可能**有 blob 正文面,这条也要钉住方向,免得下一个人照抄"索引优先"的模板改错:
 * 判据对象是 commit / tree 对象,而层的 `catBatch` 头解析只认 `<40hex> blob <size>`(tree 一律 null);
 * 台账 `.ihui-agent/state/` 被 .gitignore 忽略 ⇒ 结构上不在任何检出面里 ⇒ 只能跟磁盘。
 * 这里用**临时真仓**造三面分歧(HEAD / 索引 / 磁盘各一份),证明取的是磁盘那份。
 */
test('台账三面分歧 ⇒ 取磁盘面(本门无索引面可切,方向不得照抄模板)', () => {
  const { dir, run } = repo()
  try {
    const p = join(dir, 'ledger.json')
    writeFileSync(p, '{"face":"head-side"}\n', 'utf8')
    run('add', 'ledger.json')
    run('commit', '-qm', 'ledger 入库一版')
    writeFileSync(p, '{"face":"index-side"}\n', 'utf8')
    run('add', 'ledger.json')
    writeFileSync(p, '{"face":"disk-live"}\n', 'utf8')
    assert.equal(G.readMarker(p).face, 'disk-live', '必须跟磁盘运行态;取到 head/index 那份 = 台账永不生效')
    // 反向对照:同一判据对"只存在于 HEAD、磁盘上没有"的路径必须退回空表(不抛、不冒"已记过")
    assert.deepEqual(G.readMarker(join(dir, 'not-on-disk.json')), {}, '磁盘缺失 ⇒ 空表(保守重判),不得抛')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
