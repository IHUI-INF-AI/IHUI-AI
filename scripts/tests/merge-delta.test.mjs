// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  auditDelta,
  blobNewRels,
  blobOidOf,
  blobRemovedInAllParents,
  changedAgainstEveryParent,
  deltaParents,
  effectiveAnchorCount,
  lineKeysOf,
  newOccurrences,
  readParentTexts,
  removedOccurrences,
} from '../lib/merge-delta.mjs'

const git = (dir, ...args) =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const write = (dir, rel, text) => {
  mkdirSync(join(dir, rel.split('/').slice(0, -1).join('/') || '.'), { recursive: true })
  writeFileSync(join(dir, rel), text, 'utf8')
}

/**
 * 最小合并夹具:
 *   base   : base.txt
 *   ours   : ours.txt(HEAD 独有)
 *   theirs : upstream.txt(MERGE_HEAD 独有)
 *   合并未收口 ⇒ 索引 = 两父并集;索引里再 add new.txt = 本次真正新增。
 */
function mergeScene() {
  const dir = mkScratch('merge-delta-')
  git(dir, 'init', '-q')
  git(dir, 'checkout', '-q', '-b', 'main')
  write(dir, 'base.txt', 'base\n')
  git(dir, 'add', 'base.txt')
  git(dir, 'commit', '-qm', 'base')
  git(dir, 'checkout', '-q', '-b', 'theirs')
  write(dir, 'upstream.txt', 'upstream\n')
  git(dir, 'add', 'upstream.txt')
  git(dir, 'commit', '-qm', 'theirs')
  git(dir, 'checkout', '-q', 'main')
  write(dir, 'ours.txt', 'ours\n')
  git(dir, 'add', 'ours.txt')
  git(dir, 'commit', '-qm', 'ours')
  git(dir, 'merge', '--no-commit', 'theirs')
  return dir
}

test('deltaParents:非合并 ⇒ 只有 HEAD;head 面 ⇒ 不适用;合并 ⇒ HEAD + MERGE_HEAD', () => {
  const dir = mkScratch('merge-delta-faces-')
  try {
    git(dir, 'init', '-q')
    git(dir, 'checkout', '-q', '-b', 'main')
    write(dir, 'a.txt', 'a\n')
    git(dir, 'add', 'a.txt')
    git(dir, 'commit', '-qm', 'a')
    const nonMerge = deltaParents({ root: dir, face: 'staged' })
    assert.equal(nonMerge.applicable, true)
    assert.equal(nonMerge.merge, false)
    assert.deepEqual(nonMerge.parents.map((p) => p.rev), ['HEAD'])
    const head = deltaParents({ root: dir, face: 'head' })
    assert.equal(head.applicable, false, 'head 面没有本次提交维')
    assert.equal(head.parents.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('deltaParents:合并未收口 ⇒ 两个父提交且 MERGE_HEAD 是上游 tip', () => {
  const dir = mergeScene()
  try {
    const d = deltaParents({ root: dir, face: 'staged' })
    assert.equal(d.merge, true)
    assert.deepEqual(d.parents.map((p) => p.label), ['HEAD', 'MERGE_HEAD'])
    assert.equal(
      d.parents[1].rev,
      git(dir, 'rev-parse', 'MERGE_HEAD').trim(),
      '第二父必须现读 MERGE_HEAD',
    )
  } finally {
    rmScratch(dir)
  }
})

test('readParentTexts:上游独有文件在 HEAD 面为 null、在 MERGE_HEAD 面有正文', () => {
  const dir = mergeScene()
  try {
    const d = deltaParents({ root: dir, face: 'staged' })
    const texts = readParentTexts({ root: dir, rels: ['upstream.txt', 'ours.txt'], parents: d.parents })
    assert.equal(texts.get('HEAD').get('upstream.txt'), null)
    assert.equal(texts.get('HEAD').get('ours.txt'), 'ours\n')
    assert.equal(texts.get('MERGE_HEAD').get('upstream.txt'), 'upstream\n')
    assert.equal(texts.get('MERGE_HEAD').get('ours.txt'), null)
  } finally {
    rmScratch(dir)
  }
})

test('newOccurrences:上游既有条目不算本次新增,索引里真正新加的才算', () => {
  const dir = mergeScene()
  try {
    // 模拟结果面条目:两父并集 + 本次真新增
    const result = ['base.txt', 'ours.txt', 'upstream.txt', 'new.txt']
    const headKeys = ['base.txt', 'ours.txt']
    const mergeKeys = ['base.txt', 'upstream.txt']
    assert.deepEqual(newOccurrences(result, [headKeys, mergeKeys]), ['new.txt'])
    // 非合并:与只看 HEAD 的简单 diff 等价
    assert.deepEqual(newOccurrences(result, [headKeys]), ['upstream.txt', 'new.txt'])
  } finally {
    rmScratch(dir)
  }
})

test('newOccurrences:同名两枚按多重集记票(摘旧塞新不得互相冒充)', () => {
  assert.deepEqual(newOccurrences(['k', 'k'], [['k'], ['k']]), ['k'])
  assert.deepEqual(newOccurrences(['k'], [['k', 'k']]), [])
  assert.deepEqual(newOccurrences(['k', 'k'], [['k']]), ['k'])
})

test('removedOccurrences:两父都有、结果丢了 ⇒ 本次删除;只在 HEAD 有 ⇒ 归因上游不记', () => {
  assert.deepEqual(removedOccurrences([], [['a'], ['a']]), ['a'])
  assert.deepEqual(removedOccurrences([], [['a'], []]), [], '上游从来没有 ⇒ 不是本次删除')
  assert.deepEqual(removedOccurrences(['a'], [['a'], ['a']]), [])
})

test('changedAgainstEveryParent:与任一父相同即归因该父,不是本次改写', () => {
  assert.equal(changedAgainstEveryParent('new', ['new', 'old']), false)
  assert.equal(changedAgainstEveryParent('new', ['old1', 'old2']), true)
  assert.equal(changedAgainstEveryParent('new', [null, null]), true)
})

test('effectiveAnchorCount:计数门 `读数 > 锚点 ⇔ 本次新增 > 0`', () => {
  assert.equal(effectiveAnchorCount(5, 2), 3)
  assert.equal(effectiveAnchorCount(5, 0), 5)
  assert.equal(effectiveAnchorCount(0, 0), 0)
})

test('auditDelta:两父基准把简单 diff 的假阳性单独点名,差额可复算', () => {
  const a = auditDelta({
    resultKeys: ['base', 'ours', 'upstream', 'new'],
    parentKeyLists: [['base', 'ours'], ['base', 'upstream']],
    naiveKeys: ['upstream', 'new'],
  })
  assert.deepEqual(a.newKeys, ['new'])
  assert.deepEqual(a.onlyNaive, ['upstream'], '简单 diff 多报的正是上游既有条目')
  assert.deepEqual(a.onlyCorrect, [])
  assert.equal(a.same, false)
  const b = auditDelta({
    resultKeys: ['base', 'new'],
    parentKeyLists: [['base'], []],
    naiveKeys: ['new'],
  })
  assert.equal(b.same, true, '非合并时两套基准必须逐字同结论')
})

test('blobNewRels:上游带入的文件不记本次新增,索引里新加的文件才记', () => {
  const dir = mergeScene()
  try {
    write(dir, 'new.txt', 'new\n')
    git(dir, 'add', 'new.txt')
    const d = deltaParents({ root: dir, face: 'staged' })
    const rels = ['base.txt', 'ours.txt', 'upstream.txt', 'new.txt']
    const fresh = blobNewRels({ root: dir, face: 'staged', rels, parents: d.parents })
    assert.deepEqual([...fresh].sort(), ['new.txt'])
  } finally {
    rmScratch(dir)
  }
})

test('blobRemovedInAllParents:只有两父都有的文件被删才算本次删除', () => {
  const dir = mkScratch('merge-delta-del-')
  try {
    git(dir, 'init', '-q')
    git(dir, 'checkout', '-q', '-b', 'main')
    write(dir, 'both.txt', 'both\n')
    git(dir, 'add', 'both.txt')
    git(dir, 'commit', '-qm', 'base')
    git(dir, 'checkout', '-q', '-b', 'theirs')
    write(dir, 'theirs.txt', 't\n')
    git(dir, 'add', 'theirs.txt')
    git(dir, 'commit', '-qm', 'theirs')
    git(dir, 'checkout', '-q', 'main')
    write(dir, 'ours.txt', 'o\n')
    git(dir, 'add', 'ours.txt')
    git(dir, 'commit', '-qm', 'ours')
    git(dir, 'merge', '--no-commit', 'theirs')
    git(dir, 'rm', '-q', 'both.txt')
    const d = deltaParents({ root: dir, face: 'staged' })
    assert.deepEqual(
      [...blobRemovedInAllParents({ root: dir, face: 'staged', rels: ['both.txt', 'ours.txt'], parents: d.parents })],
      ['both.txt'],
    )
  } finally {
    rmScratch(dir)
  }
})

test('blobOidOf:父提交不可读 ⇒ 抛未判定,不得伪装成「该父没有这份件」', () => {
  const dir = mkScratch('merge-delta-badrev-')
  try {
    git(dir, 'init', '-q')
    git(dir, 'checkout', '-q', '-b', 'main')
    write(dir, 'a.txt', 'a\n')
    git(dir, 'add', 'a.txt')
    git(dir, 'commit', '-qm', 'a')
    assert.throws(
      () => blobOidOf({ root: dir, face: 'rev', rev: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', rel: 'a.txt' }),
      /父提交 .* 不可读/,
    )
  } finally {
    rmScratch(dir)
  }
})

test('lineKeysOf:路径+行归一文本,空行不进多重集', () => {
  const keys = lineKeysOf('a.md', 'x\r\n  y  \n\n')
  assert.equal(keys.length, 2)
  assert.match(keys[0], /a\.md\u0000x$/)
  assert.match(keys[1], /a\.md\u0000y$/)
})

test('合并态取不到 MERGE_HEAD 内容 ⇒ 抛未判定,不折成空集', () => {
  const dir = mkScratch('merge-delta-broken-')
  try {
    git(dir, 'init', '-q')
    git(dir, 'checkout', '-q', '-b', 'main')
    write(dir, 'a.txt', 'a\n')
    git(dir, 'add', 'a.txt')
    git(dir, 'commit', '-qm', 'a')
    const gitDir = join(dir, git(dir, 'rev-parse', '--git-dir').trim())
    writeFileSync(join(gitDir, 'MERGE_HEAD'), '', 'utf8')
    assert.throws(() => deltaParents({ root: dir, face: 'staged' }), /MERGE_HEAD 存在但为空/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
