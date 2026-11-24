#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import {
  gitCandidateOrder,
  resolveGitBin,
  resolvePortableGitCandidates,
} from '../lib/gitdir.mjs'

const PORTABLE_MARK = '.workbuddy/binaries/PortableGit'
const norm = (p) => p.replace(/\\/g, '/')

test('默认顺序:系统安装位与 PATH 都排在 workbuddy PortableGit 之前', () => {
  const order = gitCandidateOrder({})
  const sysIdx = order.indexOf('C:/Program Files/Git/cmd/git.exe')
  const pathIdx = order.indexOf('git')
  assert.ok(sysIdx >= 0, `系统安装位缺失: ${order.join(' | ')}`)
  assert.ok(pathIdx > sysIdx, `PATH 候选应排在系统安装位之后: ${order.join(' | ')}`)
  for (const p of resolvePortableGitCandidates({})) {
    if (!norm(p).includes(PORTABLE_MARK)) continue
    assert.ok(order.indexOf(p) > pathIdx, `portable 候选 ${p} 仍排在系统 Git 之前`)
  }
})

test('无显式覆盖时,自动扫描族不会顶掉系统候选', () => {
  const order = gitCandidateOrder({})
  const firstPortable = order.findIndex((p) => norm(p).includes(PORTABLE_MARK))
  const sysIdx = order.indexOf('C:/Program Files/Git/cmd/git.exe')
  if (firstPortable >= 0) assert.ok(firstPortable > sysIdx, order.join(' | '))
})

test('GIT_BIN 显式覆盖仍居首,且同值去重', () => {
  const bin = 'C:/Program Files/Git/cmd/git.exe'
  const order = gitCandidateOrder({ GIT_BIN: bin })
  assert.equal(order[0], bin)
  assert.equal(order.filter((p) => p === bin).length, 1)
})

test('IHUI_PORTABLE_GIT 是显式意图:展开项高于系统候选,自动扫描族仍在系统之后', () => {
  const root = 'D:/portable-git'
  const order = gitCandidateOrder({ IHUI_PORTABLE_GIT: root })
  const explicit = [root, join(root, 'cmd/git.exe'), join(root, 'bin/git.exe')]
  const sysIdx = order.indexOf('C:/Program Files/Git/cmd/git.exe')
  for (const p of explicit) {
    assert.ok(
      order.indexOf(p) >= 0 && order.indexOf(p) < sysIdx,
      `显式 portable ${p} 未排在系统之前`
    )
  }
  for (const p of order.filter((x) => norm(x).includes(PORTABLE_MARK))) {
    assert.ok(order.indexOf(p) > order.indexOf('git'), `自动扫描 ${p} 不应提前`)
  }
})

test('实解析不再选中 workbuddy PortableGit(修复前此例必红)', () => {
  const bin = resolveGitBin()
  assert.ok(bin, '本机没有任何可用 git')
  assert.ok(!norm(bin).includes(PORTABLE_MARK), `仍选中坏 portable: ${bin}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
