#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const checker = resolve('scripts/check-index-reverse-staged.mjs')
const { __test__ } = await import(pathToFileURL(checker).href)

function sh(cwd, args) {
  // 门 193:派生 git 必须显式接管 stdio,否则本机 0/30 成功(EBUSY)。取值按不带 input 的
  // ['ignore','pipe','pipe'] —— 判据只认属性名,不认取值(见 check-git-stdio-discipline.mjs)。
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败: ${r.stderr}`)
  return r.stdout.trim()
}

function initRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-revstaged-'))
  sh(dir, ['init', '-q'])
  sh(dir, ['config', 'user.email', 't@test.local'])
  sh(dir, ['config', 'user.name', 'test'])
  return dir
}

function commitVersion(dir, path, value) {
  writeFileSync(join(dir, path), `${value}\n`)
  sh(dir, ['add', '--', path])
  sh(dir, ['commit', '-qm', `set ${path}=${value}`])
  return sh(dir, ['rev-parse', `HEAD:${path}`])
}

/** 模拟对象空间提交推进 HEAD 但共享索引没回同步:索引 blob 设为旧版,HEAD/工作树保持新版 */
function leaveReverseStaged(dir, path, oldBlob) {
  sh(dir, ['update-index', '--cacheinfo', `100644,${oldBlob},${path}`])
}

test('① 对象空间提交遗留的反向 staged 必须判红并点名祖先', () => {
  const dir = initRepo()
  try {
    const oldBlob = commitVersion(dir, 'f.txt', 'v1')
    commitVersion(dir, 'f.txt', 'v2')
    leaveReverseStaged(dir, 'f.txt', oldBlob)

    const found = __test__.findReverseStaged({ root: dir })
    assert.equal(found.length, 1)
    assert.equal(found[0].path, 'f.txt')
    assert.equal(found[0].stagedBlob, oldBlob.slice(0, 10))
    assert.notEqual(found[0].headBlob, found[0].stagedBlob)
    assert.match(found[0].ancestor, /^[0-9a-f]{10}$/)
    // CLI 退出码必须是 1
    const r = spawnSync(process.execPath, [checker, '--root', dir, '--json'], { encoding: 'utf8' })
    assert.equal(r.status, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('② 回同步共享索引后必须转绿(修复配方有效)', () => {
  const dir = initRepo()
  try {
    const oldBlob = commitVersion(dir, 'f.txt', 'v1')
    const newBlob = commitVersion(dir, 'f.txt', 'v2')
    leaveReverseStaged(dir, 'f.txt', oldBlob)
    assert.equal(__test__.findReverseStaged({ root: dir }).length, 1)

    sh(dir, ['update-index', '--cacheinfo', `100644,${newBlob},f.txt`])
    assert.equal(__test__.findReverseStaged({ root: dir }).length, 0)
    const r = spawnSync(process.execPath, [checker, '--root', dir], { encoding: 'utf8' })
    assert.equal(r.status, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('③ 正常 staged(索引是 HEAD 里不存在的新内容)不得误报 —— 避免恒红尺子', () => {
  const dir = initRepo()
  try {
    commitVersion(dir, 'f.txt', 'v1')
    writeFileSync(join(dir, 'f.txt'), 'v3-not-in-history\n')
    sh(dir, ['add', '--', 'f.txt'])
    assert.equal(__test__.findReverseStaged({ root: dir }).length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('④ 新增文件 staged(HEAD 无此路径)不得误报', () => {
  const dir = initRepo()
  try {
    commitVersion(dir, 'f.txt', 'v1')
    writeFileSync(join(dir, 'brand-new.ts'), 'new\n')
    sh(dir, ['add', '--', 'brand-new.ts'])
    assert.equal(__test__.findReverseStaged({ root: dir }).length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('⑤ 停在 HEAD~2 甚至更早的祖先版本同样判红(连续多次手搓)', () => {
  const dir = initRepo()
  try {
    const v1 = commitVersion(dir, 'f.txt', 'v1')
    commitVersion(dir, 'f.txt', 'v2')
    commitVersion(dir, 'f.txt', 'v3')
    leaveReverseStaged(dir, 'f.txt', v1)
    const found = __test__.findReverseStaged({ root: dir })
    assert.equal(found.length, 1)
    assert.equal(found[0].distance, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('⑥ 空格/中文路径也能定位且修复提示带引号', () => {
  const dir = initRepo()
  try {
    const oldBlob = commitVersion(dir, '含 空格.ts', 'v1')
    commitVersion(dir, '含 空格.ts', 'v2')
    leaveReverseStaged(dir, '含 空格.ts', oldBlob)
    const found = __test__.findReverseStaged({ root: dir })
    assert.equal(found.length, 1)
    assert.equal(found[0].path, '含 空格.ts')
    assert.match(__test__.repairHint(found), /"含 空格\.ts"/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('⑦ 索引与 HEAD 一致时零命中(当前仓库常态,不制造恒红)', () => {
  const dir = initRepo()
  try {
    commitVersion(dir, 'f.txt', 'v1')
    commitVersion(dir, 'g.txt', 'v2')
    assert.deepEqual(__test__.findReverseStaged({ root: dir }), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
