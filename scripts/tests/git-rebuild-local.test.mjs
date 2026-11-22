// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * git-rebuild-local.mjs 的四条判据锁(DBG-85 / DBG-86 / DBG-87 / DBG-50)。
 *
 * 只 import 纯函数并读源码。不得执行 main(),不得对真仓库跑重建、--apply 或 checkout -- .。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { __test__ as rebuild } from '../git-rebuild-local.mjs'

const {
  lockHeldBlocksRebuild,
  judgeRepoHealthy,
  judgeArchiveRestorable,
  judgeArchiveComplete,
  mayRemoveOriginalGitdir,
  cloneFailureAction,
  indexRebuildPlan,
  commandDiscardsWorktree,
} = rebuild

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'git-rebuild-local.mjs'), 'utf8')

function executableSource(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const HEAD = 'ref: refs/heads/main\n'

test('DBG-85: 锁被持有(null)必须拒绝,无锁的空串必须放行', () => {
  assert.equal(lockHeldBlocksRebuild(null), true)
  assert.equal(lockHeldBlocksRebuild(''), false)
  assert.equal(lockHeldBlocksRebuild('locked: unit=other'), false)
})

test('DBG-86: 对象探针失败不得判健康,恒真式折出的 true 也不得判健康', () => {
  const folded = null !== null || true
  assert.equal(folded, true)
  assert.equal(judgeRepoHealthy('abc123', folded, folded), false)
  assert.equal(judgeRepoHealthy('abc123', '', ''), true)
  assert.equal(judgeRepoHealthy('abc123', null, ''), false)
  assert.equal(judgeRepoHealthy('abc123', '', null), false)
  assert.equal(judgeRepoHealthy('abc123', null, null), false)
  assert.equal(judgeRepoHealthy('', '', ''), false)
  assert.equal(judgeRepoHealthy(null, '', ''), false)
  assert.equal(judgeRepoHealthy('   ', '', ''), false)
})

test('DBG-86 接线:可执行代码把原始探针交给 judgeRepoHealthy,不得再写恒真式', () => {
  const code = executableSource(src)
  assert.match(code, /judgeRepoHealthy\(head,\s*commitProbe,\s*treeProbe\)/)
  assert.doesNotMatch(code, /\|\|\s*true/)
})

test('DBG-87: 归档不完整不得删原件', () => {
  assert.equal(judgeArchiveComplete(null).ok, false)
  assert.equal(mayRemoveOriginalGitdir(null), false)
  assert.equal(mayRemoveOriginalGitdir({ ok: false, reason: 'x' }), false)
  const mismatch = judgeArchiveComplete({
    exists: true,
    isDirectory: true,
    headText: HEAD,
    sourceHeadText: 'ref: refs/heads/other\n',
    hasObjects: true,
  })
  assert.equal(mismatch.ok, false)
  assert.match(mismatch.reason, /不一致/)
  assert.equal(mayRemoveOriginalGitdir(mismatch), false)
  const noObjects = judgeArchiveRestorable({
    exists: true,
    isDirectory: true,
    headText: HEAD,
    hasObjects: false,
  })
  assert.equal(noObjects.ok, false)
  assert.equal(
    judgeArchiveComplete({
      exists: true,
      isDirectory: true,
      headText: '\n',
      sourceHeadText: '\n',
      hasObjects: true,
    }).ok,
    false,
  )
  assert.equal(
    cloneFailureAction({ cloneHasHead: false, originalRemoved: false, archiveComplete: false }),
    'abort-keep',
  )
})

test('DBG-87: 归档完整才允许删,clone 失败必须按归档恢复', () => {
  const good = judgeArchiveComplete({
    exists: true,
    isDirectory: true,
    headText: HEAD,
    sourceHeadText: HEAD,
    hasObjects: true,
  })
  assert.equal(good.ok, true)
  assert.equal(mayRemoveOriginalGitdir(good), true)
  assert.equal(
    cloneFailureAction({ cloneHasHead: false, originalRemoved: true, archiveComplete: true }),
    'restore',
  )
  assert.equal(
    cloneFailureAction({ cloneHasHead: true, originalRemoved: true, archiveComplete: true }),
    'proceed',
  )
  assert.equal(
    cloneFailureAction({ cloneHasHead: false, originalRemoved: true, archiveComplete: false }),
    'unrecoverable',
  )
})

test('DBG-87 接线:先判归档再 rmSync,clone 失败要调用恢复而不是只打印', () => {
  const code = executableSource(src)
  const removeAt = code.lastIndexOf('rmSync(targetGitDir')
  const gateAt = code.lastIndexOf('mayRemoveOriginalGitdir(', removeAt)
  assert.ok(gateAt !== -1 && gateAt < removeAt, 'rmSync 之前没有 mayRemoveOriginalGitdir')
  assert.match(code.slice(gateAt, removeAt), /process\.exit\(1\)/)
  assert.match(code, /restoreGitdirFromArchive\(archiveDir,\s*targetGitDir\)/)
  assert.match(code, /failureAction === 'restore'/)
  assert.doesNotMatch(code, /工作区文件未受影响/)
})

test('DBG-50: index 计划不得丢弃工作区,checkout -- . 必须判为丢弃', () => {
  const plan = indexRebuildPlan()
  assert.equal(plan.command, 'reset')
  assert.equal(plan.touchesWorktree, false)
  assert.equal(commandDiscardsWorktree(plan.command), false)
  assert.equal(commandDiscardsWorktree('checkout -- .'), true)
  assert.equal(commandDiscardsWorktree('git -C /repo checkout -- .'), true)
  assert.equal(commandDiscardsWorktree('reset --hard'), true)
  assert.equal(commandDiscardsWorktree('reset --hard HEAD'), true)
  assert.equal(commandDiscardsWorktree('restore .'), true)
  assert.equal(commandDiscardsWorktree('checkout -b main origin/main'), false)
  const code = executableSource(src)
  assert.doesNotMatch(code, /checkout\s+--\s+\./)
  assert.match(code, /commandDiscardsWorktree\(indexPlan\.command\)/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
