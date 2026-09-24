// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「合并新增文件存续性对账」镜像测试(§22c:直接 import 源模块,不复制实现)
 *
 * 这里钉三件事,顺序有意义:
 *  1. **判据本身**会抓到"合并吞掉对侧独有新增"(用真临时仓造一次事故,不是读字符串);
 *  2. **口径**不会把已入库的历史事故变成后来每次提交的恒红门 —— 那是逼人紧急跳过、连带废掉全部守门;
 *  3. **装车**:runner 里真的注册了这道门(blocking + 自己的 skipEnv + 编号恰好一次),
 *     且它被守门 80 的 HOT 清单覆盖、被 AGENTS/README 点名(否则守门 89 R4 判红)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFileSync } from 'node:fs'
import { __test__ as G } from '../check-merge-addition-loss.mjs'

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
