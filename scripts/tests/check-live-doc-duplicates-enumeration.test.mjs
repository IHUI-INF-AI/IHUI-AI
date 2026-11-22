// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 245(`check-live-doc-duplicates`)的枚举面单测。
 *
 * 修复前的病:--staged 面用 `git ls-tree --name-only : <doc>`(`:` 不是合法 tree-ish),
 * git fatal 被吞成 false ⇒ 6 份被审文档全"不存在" ⇒ 以"枚举到 0 份"的名义判死。
 * 修复后必须区分两种输出,二者都是 exit 2 但文案与含义不同:
 *   · 枚举失败        ⇒ 「枚举面取不到」,是取数面不可用(未判定);
 *   · 枚举成功但 0 份  ⇒ 「枚举成功但被审文档确实 0 份」,这时才允许判死。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { __test__ } from '../check-live-doc-duplicates.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts/check-live-doc-duplicates.mjs')
const { enumerateDocs } = __test__

function git(dir, ...args) {
  const r = spawnSync(process.env.IHUI_GIT_BIN || 'git', args, {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${String(r.stderr || '').trim()}`)
  return String(r.stdout || '').trim()
}

function init() {
  const dir = mkScratch('live-doc-enum-')
  git(dir, 'init', '-q')
  git(dir, 'config', 'user.email', 'test@example.com')
  git(dir, 'config', 'user.name', 'ihui-test')
  return dir
}

function run(dir) {
  const r = spawnSync(process.execPath, [GATE, '--staged', `--root=${dir}`], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

test('门 245 · --staged 索引面枚举真的读到了文件(修复前恒为 0 份)', () => {
  const dir = init()
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'README.md'), '# 活文档\n\n正文\n')
    writeFileSync(join(dir, 'AGENTS.md'), '# 代理\n')
    git(dir, 'add', '--', 'README.md', 'AGENTS.md')
    git(dir, 'commit', '-q', '-m', 'base')
    writeFileSync(join(dir, 'README.md'), '# 活文档\n\n正文\n- 新增一行\n')
    git(dir, 'add', '--', 'README.md')

    const e = enumerateDocs({ root: dir, face: 'staged' })
    assert.deepEqual(e.failures, [], `枚举不得失败:${JSON.stringify(e.failures)}`)
    assert.deepEqual(e.docs.sort(), ['AGENTS.md', 'README.md'])

    const r = run(dir)
    assert.equal(r.status, 0, `枚举成功且无新增副本应通过,实际:${r.out}`)
    assert.doesNotMatch(r.out, /枚举到 0 份/)
  } finally {
    rmScratch(dir)
  }
})

test('门 245 · 「枚举失败」与「枚举成功但 0 份」必须是两种输出', () => {
  // ① 枚举失败:根目录不是 git 仓库 ⇒ 每次探测都失败
  const broken = mkScratch('live-doc-broken-')
  // ② 枚举成功但确实 0 份:合法仓库,但六份被审文档一份都不在
  const empty = init()
  try {
    writeFileSync(join(empty, 'notes.txt'), '无关文件\n')
    git(empty, 'add', '--', 'notes.txt')
    git(empty, 'commit', '-q', '-m', 'only-notes')

    const eBroken = enumerateDocs({ root: broken, face: 'staged' })
    assert.equal(eBroken.docs.length, 0)
    assert.ok(eBroken.failures.length >= 1, '非仓库必须报枚举失败')

    const eEmpty = enumerateDocs({ root: empty, face: 'staged' })
    assert.deepEqual(eEmpty, { docs: [], failures: [] }, '合法仓库的 0 份是"枚举成功但确实 0 份"')

    const rBroken = run(broken)
    const rEmpty = run(empty)
    assert.equal(rBroken.status, 2, rBroken.out)
    assert.equal(rEmpty.status, 2, rEmpty.out)
    assert.match(rBroken.out, /枚举面取不到/)
    assert.doesNotMatch(rBroken.out, /枚举成功但被审文档确实 0 份/)
    assert.match(rEmpty.out, /枚举成功但被审文档确实 0 份/)
    assert.doesNotMatch(rEmpty.out, /枚举面取不到/)
  } finally {
    rmScratch(broken)
    rmScratch(empty)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
