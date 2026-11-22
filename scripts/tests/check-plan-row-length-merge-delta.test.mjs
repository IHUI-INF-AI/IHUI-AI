// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 293(`check-plan-row-length`)的合并面基准单测。
 *
 * 夹具刻意用**真实合并未收口状态**(`git merge --no-commit`),不是纯函数模拟:
 *   case① 上游分支新增的超阈登记行被合并带进索引 —— 旧算法(锚点=HEAD)计 1 处判红,
 *          新算法(锚点=每一枚父提交)计 0 处。
 *   case② 合并结果里真新增一条超阈登记行 —— 新算法仍然判红(不能把门测成永远绿)。
 * "旧算法"用**删掉 MERGE_HEAD 后同一份索引**复算:非合并提交父集只有 HEAD,即修前语义。
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
const GATE = join(REPO, 'scripts/check-plan-row-length.mjs')

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

function commit(dir, msg) {
  git(dir, 'add', '--', 'PROJECT_PLAN.md')
  git(dir, 'commit', '-q', '-m', msg)
}

function scene() {
  const dir = mkScratch('plan-row-merge-')
  git(dir, 'init', '-q')
  git(dir, 'config', 'user.email', 'test@example.com')
  git(dir, 'config', 'user.name', 'ihui-test')
  // 两段的改动位置拉开 >3 行,保证 git 三方合并不动用冲突解算(否则索引里是冲突标记)
  const gap = '\n\n\n\n\n'
  git(dir, 'checkout', '-q', '-b', 'main')
  write(dir, 'PROJECT_PLAN.md', `# 台账\n\n## 我方区\n- [ ] G-1 短行${gap}\n## 上游区\n`)
  commit(dir, 'base')

  // 上游:在末尾新增一条 500 字的未勾登记行
  git(dir, 'checkout', '-q', '-b', 'theirs')
  write(
    dir,
    'PROJECT_PLAN.md',
    `# 台账\n\n## 我方区\n- [ ] G-1 短行${gap}\n## 上游区\n- [ ] G-3 ${'长'.repeat(500)}\n`,
  )
  commit(dir, 'theirs-long-row')

  // 我方:只在「我方区」加一行短文,与上游那一行无关
  git(dir, 'checkout', '-q', 'main')
  write(dir, 'PROJECT_PLAN.md', `# 台账\n\n## 我方区\n- [ ] G-1 短行\n- [ ] G-2 我方短行${gap}\n## 上游区\n`)
  commit(dir, 'ours-short-row')

  git(dir, 'merge', '--no-commit', 'theirs')
  return dir
}

/** 跑门。`naive=true` 时临时摘掉 MERGE_HEAD 复算"只看 HEAD"的修前语义。 */
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

test('门 293 · case① 上游带进的超阈行:旧算法计 1 / 新算法计 0', () => {
  const dir = scene()
  try {
    const naive = run(dir, { naive: true })
    const fixed = run(dir)
    assert.equal(naive.status, 1, `旧算法应判红,实际:${naive.out}`)
    assert.match(naive.out, /新增超阈登记行 1 处/)
    assert.match(naive.out, /K:G-3/)
    assert.equal(fixed.status, 0, `新算法应放行,实际:${fixed.out}`)
    assert.match(fixed.out, /本轮新增超阈登记行 0 处/)
  } finally {
    rmScratch(dir)
  }
})

test('门 293 · case② 合并结果真新增超阈行仍然判红', () => {
  const dir = scene()
  try {
    write(
      dir,
      'PROJECT_PLAN.md',
      readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8') + `- [ ] G-4 ${'新'.repeat(500)}\n`,
    )
    git(dir, 'add', '--', 'PROJECT_PLAN.md')
    const fixed = run(dir)
    assert.equal(fixed.status, 1, `真新增应判红,实际:${fixed.out}`)
    assert.match(fixed.out, /K:G-4/)
    assert.doesNotMatch(fixed.out, /K:G-3/)
  } finally {
    rmScratch(dir)
  }
})
