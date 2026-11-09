#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 派生自动同步腿「显式申报」通道镜像测试(2026-11-04 立)。钉四件事:
 *  ① 命中登记的派生腿写出的产物,在 `git add` 之前申报(路径 + 工作树 blob)⇒ 私有索引
 *     护栏把它并入本单允许集,提交成功、产物落地,**不需要任何 skip**;
 *  ② 申报集之外的路径被写 ⇒ 仍 exit 1(反向用例,不许把这通道做成"什么都放行");
 *  ③ 申报的 blob 与索引实际内容不符 ⇒ exit 1(内容钉核验);
 *  ④ 申报了却没产出(索引无该条目) ⇒ exit 1(悬空申报也算违规)。
 *
 * 夹具一律走 `mkScratch()`(AGENTS §15b/§15c),不落工作树、不落 C 盘。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ISO = resolve(HERE, '..', 'isolated-git.mjs')
const DERIVED = resolve(HERE, '..', 'lib', 'derived-artifacts.js')
const INPUT = 'apps/web/src/input.ts'
const PRODUCT = 'apps/web/src/generated.ts'

const cleanEnv = (extra = {}) => {
  const env = { ...process.env }
  delete env.GIT_INDEX_FILE
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  return { ...env, ...extra }
}

function git(dir, args, allowFail = false) {
  const r = spawnSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: cleanEnv(),
  })
  if (!allowFail && r.status !== 0)
    throw new Error(`git ${args.join(' ')} 失败:${r.stderr || r.stdout}`)
  return r
}

const DECLARE_SCRIPT = `#!/usr/bin/env node
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const D = require(process.env.IHUI_TEST_DERIVED_MODULE)
const manifest = process.env.IHUI_ISOLATED_INDEX_DERIVED_MANIFEST
const mode = process.argv[2]
const product = ${JSON.stringify(PRODUCT)}
const declare = () =>
  D.declareDerivedArtifact({ manifestFile: manifest, path: product, generator: 'test-gen', gitCwd: process.cwd() })
const add = (p) => execFileSync('git', ['add', '--', p], { stdio: 'inherit' })
if (mode === 'ok') {
  fs.writeFileSync(product, 'generated:ok\\n')
  declare()
  add(product)
} else if (mode === 'rogue') {
  fs.writeFileSync(product, 'generated:ok\\n')
  declare()
  fs.writeFileSync('rogue.txt', 'not-declared\\n')
  add(product)
  add('rogue.txt')
} else if (mode === 'tamper') {
  fs.writeFileSync(product, 'generated:X\\n')
  declare()
  fs.writeFileSync(product, 'generated:Y\\n')
  add(product)
} else if (mode === 'missing') {
  fs.writeFileSync(product, 'generated:ok\\n')
  declare()
  fs.unlinkSync(product)
} else {
  process.exit(2)
}
`

function makeRepo() {
  const dir = mkScratch('derived-')
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'derived-test@example.invalid'])
  git(dir, ['config', 'user.name', 'derived-test'])
  git(dir, ['config', 'core.hooksPath', '.git/hooks'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  mkdirSync(join(dir, 'apps', 'web', 'src'), { recursive: true })
  writeFileSync(join(dir, INPUT), 'input v1\n')
  const declareScript = join(dir, 'declare.cjs')
  writeFileSync(declareScript, DECLARE_SCRIPT)
  git(dir, ['add', '--', INPUT, 'declare.cjs'])
  git(dir, ['commit', '-m', 'init', '--no-verify'])
  writeFileSync(
    join(dir, '.git', 'hooks', 'pre-commit'),
    [
      '#!/bin/sh',
      'node "$IHUI_TEST_DECLARE" "$IHUI_TEST_MODE" || exit 1',
      'node "$IHUI_TEST_ISO" -C "$PWD" restore-index --snapshot "$IHUI_ISOLATED_INDEX_SNAPSHOT" || exit 1',
      '',
    ].join('\n'),
    'utf8',
  )
  writeFileSync(join(dir, INPUT), 'input v2\n')
  return { dir, declareScript }
}

function commitWithDerived(dir, declareScript, mode) {
  return spawnSync(
    process.execPath,
    [ISO, '-C', dir, 'commit', '-m', `derived:${mode}`, '--', INPUT],
    {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: cleanEnv({
        IHUI_TEST_DECLARE: declareScript,
        IHUI_TEST_ISO: ISO,
        IHUI_TEST_DERIVED_MODULE: DERIVED,
        IHUI_TEST_MODE: mode,
      }),
    },
  )
}

const head = (dir) => git(dir, ['rev-parse', 'HEAD']).stdout.trim()
const isoLeftovers = (dir) => {
  try {
    return readdirSync(join(dir, '.git', 'ihui-isolated-index'))
  } catch {
    return []
  }
}

test('① 已申报的派生产物:提交成功、产物落地、共享索引干净、无需任何 skip', () => {
  const { dir, declareScript } = makeRepo()
  try {
    const before = head(dir)
    const r = commitWithDerived(dir, declareScript, 'ok')
    assert.equal(r.status, 0, `应成功,实际 stderr=${r.stderr}`)
    assert.notEqual(head(dir), before)
    const names = git(dir, ['show', '--name-only', '--format=', 'HEAD']).stdout.trim()
    assert.deepEqual(names.split(/\r?\n/).filter(Boolean).sort(), [INPUT, PRODUCT].sort())
    assert.equal(git(dir, ['status', '--short']).stdout.trim(), '')
    assert.deepEqual(isoLeftovers(dir), [])
    assert.ok(readFileSync(join(dir, PRODUCT), 'utf8').includes('generated:ok'))
  } finally {
    rmScratch(dir)
  }
})

test('② 反向:申报集之外的路径被写 ⇒ 仍 exit 1 且点名 rogue.txt', () => {
  const { dir, declareScript } = makeRepo()
  try {
    const before = head(dir)
    const r = commitWithDerived(dir, declareScript, 'rogue')
    assert.equal(r.status, 1, `应拒绝提交,实际 status=${r.status}`)
    assert.match(r.stderr, /之外塞入了索引条目/)
    assert.match(r.stderr, /rogue\.txt/)
    assert.equal(head(dir), before, '被拒绝时不得产生提交')
  } finally {
    rmScratch(dir)
  }
})

test('③ 申报 blob 与索引内容不符 ⇒ exit 1(内容钉核验)', () => {
  const { dir, declareScript } = makeRepo()
  try {
    const before = head(dir)
    const r = commitWithDerived(dir, declareScript, 'tamper')
    assert.equal(r.status, 1, `应拒绝提交,实际 status=${r.status}`)
    assert.match(r.stderr, /派生产物申报与索引实际内容不符/)
    assert.match(r.stderr, new RegExp(PRODUCT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.equal(head(dir), before)
  } finally {
    rmScratch(dir)
  }
})

test('④ 申报了却没产出(索引无该条目) ⇒ exit 1', () => {
  const { dir, declareScript } = makeRepo()
  try {
    const before = head(dir)
    const r = commitWithDerived(dir, declareScript, 'missing')
    assert.equal(r.status, 1, `应拒绝提交,实际 status=${r.status}`)
    assert.match(r.stderr, /申报了但索引里没有该条目/)
    assert.equal(head(dir), before)
  } finally {
    rmScratch(dir)
  }
})
