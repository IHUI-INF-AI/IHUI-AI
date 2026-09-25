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
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFileSync } from 'node:fs'
import { __test__ as G } from '../check-merge-addition-loss.mjs'
import { __test__ as DISC, maskComments } from '../check-gate-face-discipline.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const SCRIPT = 'check-merge-addition-loss.mjs'

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-merge-loss-it-'))
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 60000 }).trim()
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
    rmSync(dir, { recursive: true, force: true })
  }
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
    rmSync(dir, { recursive: true, force: true })
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
    rmSync(dir, { recursive: true, force: true })
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

// ── 2026-09-26 迁入共用取材层:半接线必须被钉死在"不可复发"这一档 ──

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
 * 台账 `.workbuddy/` 被 .gitignore 忽略 ⇒ 结构上不在任何检出面里 ⇒ 只能跟磁盘。
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
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
