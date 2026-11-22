// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 70 的合并面基准:额度 = max(静态基线, 有效锚点);有效锚点 = 结果读数 − 本次真正新增。
// 夹具用**真 git 临时合并仓**(git init + 两分支 + merge --no-commit),判据从 CLI 外部证明。
// 两格必测:① 合并带入的上游既有命中 ⇒ 不判红;② 合并里真新增一行 ⇒ 判红。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const DIR = resolve(fileURLToPath(import.meta.url), '..', '..')
const SCRIPT = join(DIR, 'scan-hardcoded-zh.mjs')

const git = (dir, ...args) =>
  execFileSyncGit(dir, ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args])

function execFileSyncGit(dir, args) {
  const r = spawnSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr}`)
  return r.stdout
}

const write = (dir, rel, text) => {
  mkdirSync(join(dir, rel.split('/').slice(0, -1).join('/')), { recursive: true })
  writeFileSync(join(dir, rel), text, 'utf8')
}

const addCommit = (dir, msg) => {
  git(dir, 'add', '-A')
  git(dir, 'commit', '-qm', msg)
}

function mergeHeadPath(dir) {
  const p = git(dir, 'rev-parse', '--git-path', 'MERGE_HEAD').trim()
  return p.startsWith('/') || p.includes(':') ? p : join(dir, p)
}

function runGate(dir) {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--staged', '--exit', '1'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

/** naive = 单父(HEAD)基准:临时摘掉 MERGE_HEAD,让旧的额度公式说话。 */
function runNaive(dir) {
  const p = mergeHeadPath(dir)
  const saved = readFileSync(p, 'utf8')
  rmSync(p, { force: true })
  try {
    return runGate(dir)
  } finally {
    writeFileSync(p, saved, 'utf8')
  }
}

function redCount(text) {
  const m = text.match(/越过基线\((\d+) 个文件/)
  return m ? Number(m[1]) : 0
}

function scene() {
  const dir = mkScratch('scan-zh-merge-')
  git(dir, 'init', '-q')
  git(dir, 'checkout', '-q', '-b', 'main')
  write(dir, 'apps/web/app/both.tsx', "export const A = '确定'\n")
  addCommit(dir, 'base')

  git(dir, 'checkout', '-q', '-b', 'theirs')
  write(dir, 'apps/web/app/upstream.tsx', "export const U = '上游文案'\n")
  addCommit(dir, 'theirs')

  git(dir, 'checkout', '-q', 'main')
  write(dir, 'apps/web/app/both.tsx', "export const A = '确定'\nexport const B = '取消'\n")
  addCommit(dir, 'ours')

  git(dir, 'merge', '--no-commit', 'theirs')
  return dir
}

test('门70/合并:上游带入的既有命中不判红(newCount=0 ⇒ 锚点=结果读数)', () => {
  const dir = scene()
  try {
    const naive = runNaive(dir)
    const fixed = runGate(dir)
    console.log(
      `[门70|case①] naive=${redCount(naive.stderr)} fixed=${redCount(fixed.stderr)}`,
    )
    assert.equal(naive.status, 1, 'naive 单父基准应把上游 upstream.tsx 判红')
    assert.match(naive.stderr, /upstream\.tsx/, 'naive 红点必须点名上游文件')
    assert.equal(fixed.status, 0, '双父基准下合并带入的既有条目不得判红')
    assert.doesNotMatch(fixed.stderr, /upstream\.tsx/)
  } finally {
    rmScratch(dir)
  }
})

test('门70/合并:合并里真新增一行 ⇒ 仍判红(且只红这一次新增)', () => {
  const dir = scene()
  try {
    write(
      dir,
      'apps/web/app/both.tsx',
      "export const A = '确定'\nexport const B = '取消'\nexport const C = '新增文案'\n",
    )
    git(dir, 'add', 'apps/web/app/both.tsx')
    const naive = runNaive(dir)
    const fixed = runGate(dir)
    console.log(
      `[门70|case②] naive=${redCount(naive.stderr)} fixed=${redCount(fixed.stderr)}`,
    )
    assert.equal(naive.status, 1)
    assert.equal(fixed.status, 1, '合并里真新增一行必须判红')
    assert.match(fixed.stderr, /both\.tsx: 3 处 > 基线 2 处\(新增 1\)/)
    assert.doesNotMatch(fixed.stderr, /upstream\.tsx/, '上游既有条目仍不得被记成本次新增')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
