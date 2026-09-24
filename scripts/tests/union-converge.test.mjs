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
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 120000 }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'init')
  return { dir, run }
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
    assert.ok(bad.some((b) => b.includes('mine.ts')), `选边必须被判红,实际:${bad.join(' / ')}`)
  } finally {
    rmScratch(dir)
  }
})

test('行 union 的单调性:任一侧多出的重数不得减少,重复行也要按重数保住', () => {
  const merged = U.unionLines('x\ny\n', 'y\ny\nz\n')
  assert.equal(merged.split('\n').filter((l) => l === 'y').length, 2, 'theirs 有两个 y ⇒ 结果必须也有两个')
  assert.ok(merged.includes('x') && merged.includes('z'))
  assert.equal(U.unionLines('a\n', 'a\n'), 'a\n', '等重数不得凭空补出新行')
  assert.equal(U.unionLines('', 'a\n').split('\n').filter((l) => l === 'a').length, 1, '本侧空文档也要接住对侧行')
})

test('装车证明:收敛器冲突分支真的会调它,守护真的会调 --all-new 台账', () => {
  const conv = readFileSync(new URL('../git-sync-converge.mjs', import.meta.url), 'utf8')
  assert.match(conv, /'scripts\/union-converge\.mjs', '--apply'/, 'merge-tree 冲突必须交给 union-converge,而不是直接 exit 1')
  assert.match(conv, /windowsHide: true/, '派生必须禁弹窗(§5b)')
  assert.match(conv, /timeout: 300000/, '派生必须封顶(守门 80)')
  assert.match(conv, /uni = String\(ue\.stdout \|\| ue\.message/, '子进程非零退出会 throw,必须先接住再看输出,否则错误被甩成未捕获异常')
  assert.match(conv, /union-converge 亦判需人工/, 'union 也收不了时必须退回人工路径(不得静默)')

  const guard = readFileSync(new URL('../git-guardian.mjs', import.meta.url), 'utf8')
  assert.match(guard, /function auditMergeAdditionLoss\(\)/, '守护里必须有这一层')
  assert.match(guard, /\[script, '--all-new'\]/, '必须走增量台账面(默认面只判未推的合并)')
  assert.match(guard, /if \(!CHECK_ONLY\) auditMergeAdditionLoss\(\)/, '挂点必须在非 --check 分支(挂错等于永不执行)')

  const hot = readFileSync(new URL('../check-git-read-timeout.mjs', import.meta.url), 'utf8')
  assert.match(hot, /'scripts\/union-converge\.mjs'/, '必须进守门 80 的 HOT 清单')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
