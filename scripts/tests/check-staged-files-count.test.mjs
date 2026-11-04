// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file check-staged-files-count.test.mjs 集成测试
 * @description 三态覆盖 scripts/check-staged-files-count.mjs(AGENTS.md §0.3):
 *   - 真 0:暂存文件数 ≤ 阈值 / 暂存区为空 → exit 0
 *   - 真违规:暂存文件数 > 阈值 → exit 1
 *   - 未判定:非 git 目录(git diff --cached 失败)→ exit 2 并点名
 *   - 逃生舱:HUSKY_SKIP_STAGED_COUNT=1 → exit 0
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-staged-files-count.mjs')

function run(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    // 不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
    env: { ...process.env, ...(opts.env || {}) },
  })
}

function initGitRepo(root) {
  execSync('git init -b main', { cwd: root, stdio: 'ignore' })
  execSync('git config user.email test@test.com', { cwd: root, stdio: 'ignore' })
  execSync('git config user.name test', { cwd: root, stdio: 'ignore' })
  execSync('git config commit.gpgsign false', { cwd: root, stdio: 'ignore' })
}

function stageFiles(root, count) {
  for (let i = 0; i < count; i += 1) {
    const abs = join(root, 'dir', `f${i}.ts`)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, `export const x${i} = 1\n`, 'utf8')
    execSync(`git add "${String(join('dir', `f${i}.ts`)).replace(/\\/g, '/')}"`, {
      cwd: root,
      stdio: 'ignore',
    })
  }
}

test('真 0:暂存文件数 ≤ 阈值 → exit 0', () => {
  const root = mkScratch('ihui-staged-count-')
  try {
    initGitRepo(root)
    stageFiles(root, 2)
    const r = run(['--max=2'], { cwd: root })
    assert.equal(r.status, 0, `2 ≤ 2 应 exit 0,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
  } finally {
    rmScratch(root)
  }
})

test('真 0:暂存区为空 → exit 0(计数门无违规)', () => {
  const root = mkScratch('ihui-staged-count-')
  try {
    initGitRepo(root)
    const r = run(['--max=0'], { cwd: root })
    assert.equal(r.status, 0, `空暂存区应 exit 0,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
  } finally {
    rmScratch(root)
  }
})

test('真违规:暂存文件数 > 阈值 → exit 1', () => {
  const root = mkScratch('ihui-staged-count-')
  try {
    initGitRepo(root)
    stageFiles(root, 3)
    const r = run(['--max=2'], { cwd: root })
    assert.equal(r.status, 1, `3 > 2 应 exit 1,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.match(r.stderr, /阈值/)
  } finally {
    rmScratch(root)
  }
})

test('未判定:非 git 目录 → exit 2(git diff 失败)', () => {
  const root = mkScratch('ihui-staged-count-')
  try {
    const r = run(['--max=2'], { cwd: root })
    assert.equal(r.status, 2, `非 git 目录应 exit 2,实际 ${r.status}\n${r.stderr}`)
    assert.match(r.stderr, /未判定/)
    assert.match(r.stderr, /取不到 git 暂存区/)
  } finally {
    rmScratch(root)
  }
})

test('逃生舱:HUSKY_SKIP_STAGED_COUNT=1 → exit 0', () => {
  const root = mkScratch('ihui-staged-count-')
  try {
    const r = run([], { cwd: root, env: { HUSKY_SKIP_STAGED_COUNT: '1' } })
    assert.equal(r.status, 0, `跳过应 exit 0,实际 ${r.status}`)
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
