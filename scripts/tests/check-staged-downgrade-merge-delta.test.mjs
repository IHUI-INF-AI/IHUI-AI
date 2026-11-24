// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 298(`check-staged-downgrade`)的合并面基准单测。
 *
 * 语义分界(用户口径):
 *   结果面等于**任一父** ⇒ 归因该父 ⇒ 不作降级(合并把上游版本取进结果面,不是回写);
 *   只有结果面**与所有父都不同**、且内容落在祖先旧档上,才是真降级。
 *   case① 索引 = MERGE_HEAD 的版本(且恰好也是 HEAD 的祖先)—— 旧算法计 1,新算法 0;
 *   case② 索引 = 共同祖先 base(两父都不是它)—— 新算法仍然判红,真降级一枚不放。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { judge } from '../check-staged-downgrade.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

function git(dir, ...args) {
  const r = spawnSync(process.env.IHUI_GIT_BIN || 'git', args, {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${String(r.stderr || '').trim()}`)
  return String(r.stdout || '').trim()
}

function write(dir, text) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'f.ts'), text)
}

function commit(dir, msg) {
  git(dir, 'add', '--', 'f.ts')
  git(dir, 'commit', '-q', '-m', msg)
}

/**
 * 三方历史:base v1 → 我方 v2 → v3(HEAD);上游从 base 出 v2。
 * 合并时把索引收口到 `resolveTo`;MERGE_HEAD 保留(merge --no-commit)。
 */
function scene(resolveTo) {
  const dir = mkScratch('downgrade-merge-')
  git(dir, 'init', '-q')
  git(dir, 'config', 'user.email', 'test@example.com')
  git(dir, 'config', 'user.name', 'ihui-test')
  git(dir, 'checkout', '-q', '-b', 'main')
  write(dir, 'v1\n')
  commit(dir, 'base-v1')
  write(dir, 'v2\n')
  commit(dir, 'ours-v2')
  write(dir, 'v3\n')
  commit(dir, 'ours-v3')

  git(dir, 'checkout', '-q', '-b', 'theirs', 'HEAD~2')
  write(dir, 'v2\n')
  commit(dir, 'theirs-v2')

  git(dir, 'checkout', '-q', 'main')
  const m = spawnSync(process.env.IHUI_GIT_BIN || 'git', ['merge', '--no-commit', 'theirs'], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
  })
  // 冲突是预期形态;非 0/1 之外的退出码才是夹具坏了
  assert.ok([0, 1].includes(m.status), `merge 失败:${String(m.stderr || '').trim()}`)
  write(dir, resolveTo)
  git(dir, 'add', '--', 'f.ts')
  return dir
}

function runJudge(dir) {
  return judge({ root: dir, message: '', declared: [], env: {} })
}

test('门 298 · case① 合并取到 MERGE_HEAD 的版本:旧算法计 1 / 新算法计 0', () => {
  const dir = scene('v2\n')
  const mh = join(dir, '.git', 'MERGE_HEAD')
  const saved = readFileSync(mh, 'utf8')
  try {
    const fixed = runJudge(dir)
    assert.equal(fixed.state, 'pass', `新算法应放行,实际:${JSON.stringify(fixed)}`)
    assert.equal(fixed.stale.length, 0)
    assert.ok(fixed.attributedToParent >= 1, '应把这一条归因给 MERGE_HEAD')
    assert.equal(fixed.stagedJudged, 1, '索引面确实判到了这一个文件')

    rmSync(mh)
    const naive = runJudge(dir)
    assert.equal(naive.state, 'fail', `旧算法应判红,实际:${JSON.stringify(naive)}`)
    assert.equal(naive.stale.length, 1)
    assert.equal(naive.stale[0].arm, 'verbatim')
  } finally {
    if (!exists(mh)) writeFileSync(mh, saved)
    rmScratch(dir)
  }
})

test('门 298 · case② 合并收口到共同祖先(两父都不是它)仍然判红', () => {
  const dir = scene('v1\n')
  try {
    const fixed = runJudge(dir)
    assert.equal(fixed.state, 'fail', `真降级应判红,实际:${JSON.stringify(fixed)}`)
    assert.ok(fixed.stale.length >= 1)
    assert.equal(fixed.attributedToParent, 0, '共同祖先不属于任一父面,不得归因')
  } finally {
    rmScratch(dir)
  }
})

function exists(p) {
  try {
    readFileSync(p)
    return true
  } catch {
    return false
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
