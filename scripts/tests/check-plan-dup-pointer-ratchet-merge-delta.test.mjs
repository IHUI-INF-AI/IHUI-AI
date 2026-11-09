// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 13d(`check-plan-dup-pointer-ratchet`)维③ 的合并面基准单测。
 *
 * case① 同一登记行同一条注记,HEAD 与 MERGE_HEAD 各 1 份、合并结果 2 份:
 *        旧算法计 1 份叠注判红;新算法(父面并集合法产生 2 份)计 0 份。
 * case② 合并结果里真把一份注记复制成两份(上游根本没有该注记):
 *        新算法仍然计 1 份判红。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts/check-plan-dup-pointer-ratchet.mjs')
const FILE = 'PROJECT_PLAN.md'

function git(dir, ...args) {
  const r = spawnSync(process.env.IHUI_GIT_BIN || 'git', args, {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${String(r.stderr || '').trim()}`)
  return String(r.stdout || '').trim()
}

function write(dir, rel, text) {
  const p = join(dir, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text)
}

function init() {
  const dir = mkScratch('plan-dup-merge-')
  git(dir, 'init', '-q')
  git(dir, 'config', 'user.email', 'test@example.com')
  git(dir, 'config', 'user.name', 'ihui-test')
  git(dir, 'checkout', '-q', '-b', 'main')
  return dir
}

const NOTE = '〔同题原号 G-9〕'
const ROW = '- [ ] G-1 做一件事'
const doc = (row) => `# 台账\n\n${row}\n`

/**
 * case①:两侧都把同一条注记加在同一行;合并自动收口成 1 份,再按"并集各带一份"的实测形态
 * 把结果面写成 2 份(索引),MERGE_HEAD 保留。
 */
function sceneBothSides() {
  const dir = init()
  write(dir, FILE, doc(ROW))
  git(dir, 'add', '--', FILE)
  git(dir, 'commit', '-q', '-m', 'base')

  write(dir, FILE, doc(`${ROW} ${NOTE}`))
  git(dir, 'add', '--', FILE)
  git(dir, 'commit', '-q', '-m', 'ours-note')

  git(dir, 'checkout', '-q', '-b', 'theirs', 'HEAD~1')
  write(dir, FILE, doc(`${ROW} ${NOTE}`))
  git(dir, 'add', '--', FILE)
  git(dir, 'commit', '-q', '-m', 'theirs-note')

  git(dir, 'checkout', '-q', 'main')
  git(dir, 'merge', '--no-commit', 'theirs')

  // 合并结果面:同一行带两份(两侧各一份的并集)
  write(dir, FILE, doc(`${ROW} ${NOTE} ${NOTE}`))
  git(dir, 'add', '--', FILE)
  return dir
}

function run(dir, { naive = false } = {}) {
  const mh = join(dir, '.git', 'MERGE_HEAD')
  let saved = null
  if (naive) {
    saved = readFileSync(mh, 'utf8')
    rmSync(mh)
  }
  try {
    const r = spawnSync(process.execPath, [GATE, '--staged', `--root=${dir}`], {
      cwd: REPO,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
    return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
  } finally {
    if (naive && saved !== null) writeFileSync(mh, saved)
  }
}

test('门 13d · case① 两父各带一份的叠注:旧算法计 1 / 新算法计 0', () => {
  const dir = sceneBothSides()
  try {
    const naive = run(dir, { naive: true })
    const fixed = run(dir)
    assert.equal(naive.status, 1, `旧算法应判红,实际:${naive.out}`)
    assert.match(naive.out, /从 0 份增至 1 份\(\+1\)/)
    assert.equal(fixed.status, 0, `新算法应放行,实际:${fixed.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('门 13d · case② 结果面真把一份注记复制成两份仍然判红', () => {
  const dir = init()
  try {
    write(dir, FILE, doc(ROW))
    git(dir, 'add', '--', FILE)
    git(dir, 'commit', '-q', '-m', 'base')

    // 我方加一份注记
    write(dir, FILE, doc(`${ROW} ${NOTE}`))
    git(dir, 'add', '--', FILE)
    git(dir, 'commit', '-q', '-m', 'ours-note')

    // 上游只动别的文件,既没有这条注记、也没有这份台账
    git(dir, 'checkout', '-q', '-b', 'theirs', 'HEAD~1')
    write(dir, 'notes/theirs.md', '# 上游\n')
    git(dir, 'add', '--', 'notes/theirs.md')
    git(dir, 'commit', '-q', '-m', 'theirs-other')
    git(dir, 'checkout', '-q', 'main')
    git(dir, 'merge', '--no-commit', 'theirs')

    // 合并结果面被写成两份(第二份是本次真复制出来的)
    write(dir, FILE, doc(`${ROW} ${NOTE} ${NOTE}`))
    git(dir, 'add', '--', FILE)

    const fixed = run(dir)
    assert.equal(fixed.status, 1, `真新增叠注应判红,实际:${fixed.out}`)
    assert.match(fixed.out, /从 0 份增至 1 份\(\+1\)/)
  } finally {
    rmScratch(dir)
  }
})
