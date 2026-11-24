// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// check-file-size.test.mjs — 三态回归:取不到输入 ⇒ exit 2,真 0 ⇒ exit 0
// 2026-11-04 假绿专项:此前 staged 面 git 失败折叠为空集、文件读不到折叠为 0 行,都会空转绿灯。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-file-size.mjs')

function git(dir, ...args) {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  })
}

function initRepo(dir) {
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'config', 'user.email', 't@t')
  git(dir, 'config', 'user.name', 't')
  git(dir, 'config', 'commit.gpgsign', 'false')
  writeFileSync(join(dir, 'README.md'), '# init\n')
  git(dir, 'add', 'README.md')
  git(dir, 'commit', '-qm', 'init')
}

function run(dir, args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  })
}

const combined = (r) => `${r.stdout || ''}${r.stderr || ''}`

test('未判定: --staged 非 git 目录 ⇒ exit 2(取不到 staged 面不折成空集)', () => {
  const dir = mkScratch('file-size-nogit-')
  try {
    const r = run(dir, ['--staged'])
    assert.equal(r.status, 2, `应 exit 2,实得 ${r.status}\n${combined(r)}`)
    assert.match(r.stderr, /staged 面取不到|未判定/, '必须点名取材失败')
  } finally {
    rmScratch(dir)
  }
})

test('真 0: --staged git 仓库无新增文件 ⇒ exit 0 并显式打印不适用', () => {
  const dir = mkScratch('file-size-empty-')
  try {
    initRepo(dir)
    const r = run(dir, ['--staged'])
    assert.equal(r.status, 0, `真 0 应 exit 0,实得 ${r.status}\n${combined(r)}`)
    assert.match(r.stdout, /不适用|跳过/, '真空集必须显式说明')
  } finally {
    rmScratch(dir)
  }
})

test('真 0: --staged 新增小文件 ⇒ exit 0', () => {
  const dir = mkScratch('file-size-small-')
  try {
    initRepo(dir)
    const rel = 'apps/web/src/small.ts'
    mkdirSync(join(dir, 'apps/web/src'), { recursive: true })
    writeFileSync(join(dir, rel), 'export const a = 1\nexport const b = 2\n')
    git(dir, 'add', rel)
    const r = run(dir, ['--staged', '--limit=100'])
    assert.equal(r.status, 0, `小文件应 exit 0,实得 ${r.status}\n${combined(r)}`)
  } finally {
    rmScratch(dir)
  }
})

test('真红: --staged 新增超阈值文件 ⇒ exit 1', () => {
  const dir = mkScratch('file-size-big-')
  try {
    initRepo(dir)
    const rel = 'apps/web/src/big.ts'
    mkdirSync(join(dir, 'apps/web/src'), { recursive: true })
    writeFileSync(join(dir, rel), 'a\nb\nc\n')
    git(dir, 'add', rel)
    const r = run(dir, ['--staged', '--limit=1'])
    assert.equal(r.status, 1, `超阈值应 exit 1,实得 ${r.status}\n${combined(r)}`)
    assert.match(combined(r), /超阈值|失败/)
  } finally {
    rmScratch(dir)
  }
})

test('未判定: 全量模式扫描面为空 ⇒ exit 2(不得报通过)', () => {
  const dir = mkScratch('file-size-noscan-')
  try {
    const r = run(dir, [])
    assert.equal(r.status, 2, `扫描面为空应 exit 2,实得 ${r.status}\n${combined(r)}`)
    assert.match(r.stderr, /扫描面为空|未判定/, '必须点名扫描面为空')
  } finally {
    rmScratch(dir)
  }
})

test('真 0: 全量模式有可扫描文件且未超阈值 ⇒ exit 0', () => {
  const dir = mkScratch('file-size-full-')
  try {
    mkdirSync(join(dir, 'apps/web/src'), { recursive: true })
    writeFileSync(join(dir, 'apps/web/src/small.ts'), 'export const a = 1\n')
    const r = run(dir, ['--limit=100'])
    assert.equal(r.status, 0, `全量未超阈值应 exit 0,实得 ${r.status}\n${combined(r)}`)
  } finally {
    rmScratch(dir)
  }
})

test('反例: 索引里 3MB、工作树被截成 0 字节 ⇒ 仍必须 exit 1(量索引 blob 而不是工作树)', () => {
  const dir = mkScratch('file-size-index-blob-')
  try {
    initRepo(dir)
    const rel = 'assets/big.bin'
    mkdirSync(join(dir, 'assets'), { recursive: true })
    const abs = join(dir, rel)
    writeFileSync(abs, Buffer.alloc(3 * 1024 * 1024, 0x61))
    git(dir, 'add', rel)
    // 模拟"先 git add 3MB、再把工作树截成 0 字节":git commit 只认索引,
    // 量工作树的实现会被这一手静默放行。
    writeFileSync(abs, '')
    const r = run(dir, ['--staged'])
    assert.equal(r.status, 1, `索引 3MB 必须 exit 1,实得 ${r.status}\n${combined(r)}`)
    assert.match(combined(r), /2\.9MB|3\.0MB|新增文件/, '必须点名索引 blob 体积')
  } finally {
    rmScratch(dir)
  }
})

test('反例: 推送区间新增 3MB 文件 ⇒ --range 必须 exit 1(堵 --no-verify 绕过)', () => {
  const dir = mkScratch('file-size-range-big-')
  try {
    initRepo(dir)
    const rel = 'assets/range-big.bin'
    mkdirSync(join(dir, 'assets'), { recursive: true })
    writeFileSync(join(dir, rel), Buffer.alloc(3 * 1024 * 1024, 0x62))
    git(dir, 'add', rel)
    git(dir, 'commit', '-qm', 'big')
    const r = run(dir, ['--range=HEAD~1..HEAD'])
    assert.equal(r.status, 1, `区间 3MB 必须 exit 1,实得 ${r.status}\n${combined(r)}`)
    assert.match(combined(r), /区间新增文件|2\.9MB|3\.0MB/)
  } finally {
    rmScratch(dir)
  }
})

test('真 0: 推送区间只改小文件 ⇒ --range exit 0', () => {
  const dir = mkScratch('file-size-range-small-')
  try {
    initRepo(dir)
    writeFileSync(join(dir, 'small.txt'), 'ok\n')
    git(dir, 'add', 'small.txt')
    git(dir, 'commit', '-qm', 'small')
    const r = run(dir, ['--range=HEAD~1..HEAD'])
    assert.equal(r.status, 0, `区间小文件应 exit 0,实得 ${r.status}\n${combined(r)}`)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
