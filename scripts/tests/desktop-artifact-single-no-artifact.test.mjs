// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-041 回归:收敛钩子不得把「没有产物 / 产物为空」判绿。
//
// 旧行为:目录不存在直接 return 0;目录里没有本次应产的包也 return 0(按"不产 nsis"放行)。
// 调用方(desktop-build / desktop-build-saas)把退出码 0 读成"通过",发布侧因此拿到假绿。
// 这里只钉三件事:
//   1. 产物目录不存在 ⇒ exit 1,且点名目录;
//   2. 目录里没有本次应产的包(空目录 / 只有别的版本)⇒ exit 1,且**不动**别人的文件;
//   3. 应产的包是 0 字节 ⇒ exit 1;真有产物时行为不变(exit 0)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HOOK = fileURLToPath(new URL('../desktop-artifact-single.mjs', import.meta.url))
const CUR = '智汇AI_0.1.44_x64-setup.exe'
const OTHER = '智汇AI_0.1.45_x64-setup.exe'

/** 显式清掉未签名豁免,免得外层 shell 的 env 把"缺签名"这条判据盖掉 */
const envFor = () => {
  const e = { ...process.env }
  delete e.DESKTOP_ALLOW_UNSIGNED
  return e
}

const runHook = (dir, expect) =>
  spawnSync(process.execPath, [HOOK, '--dir', dir, '--expect', expect], {
    encoding: 'utf8',
    windowsHide: true,
    env: envFor(),
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const seed = (dir, entries) => {
  for (const [name, content] of entries) writeFileSync(path.join(dir, name), content)
}

test('F-041:产物目录不存在 ⇒ exit 1,点名"没有产物"与目录', () => {
  const dir = mkScratch('ihui-artifact-no-dir-')
  const missing = path.join(dir, 'nsis')
  try {
    const r = runHook(missing, CUR)
    assert.equal(r.status, 1, `目录不存在必须判红,实际: ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.ok(r.stderr.includes('没有产物'), r.stderr)
    assert.ok(r.stderr.includes(missing), `必须点名缺失的目录,实际: ${r.stderr}`)
    assert.equal(existsSync(missing), false, '判红时不得顺手建目录')
  } finally {
    rmScratch(dir)
  }
})

test('F-041:产物目录为空 ⇒ exit 1,点名本次应产的包', () => {
  const dir = mkScratch('ihui-artifact-empty-dir-')
  try {
    const r = runHook(dir, CUR)
    assert.equal(r.status, 1, `空目录必须判红,实际: ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.ok(r.stderr.includes('没有产物'), r.stderr)
    assert.ok(r.stderr.includes(CUR), `必须点名期望的包名,实际: ${r.stderr}`)
    assert.ok(r.stderr.includes('(空)'), `必须报出目录现状,实际: ${r.stderr}`)
  } finally {
    rmScratch(dir)
  }
})

test('F-041:目录里只有别的版本包 ⇒ exit 1,且一个文件都不许删', () => {
  const dir = mkScratch('ihui-artifact-other-only-')
  const others = [
    [OTHER, 'x'],
    [`${OTHER}.sig`, 'sig'],
  ]
  try {
    seed(dir, others)
    const before = readdirSync(dir).sort()
    const r = runHook(dir, CUR)
    assert.equal(r.status, 1, `缺本次产物必须判红,实际: ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.ok(r.stderr.includes('没有产物'), r.stderr)
    assert.ok(r.stderr.includes('--no-artifact-check'), `必须给出显式跳过出路,实际: ${r.stderr}`)
    assert.deepEqual(readdirSync(dir).sort(), before, '缺包时不得删除别人的产物')
  } finally {
    rmScratch(dir)
  }
})

test('F-041:应产的包是 0 字节 ⇒ exit 1,点名"产物为空"', () => {
  const dir = mkScratch('ihui-artifact-empty-file-')
  try {
    seed(dir, [
      [CUR, ''],
      [`${CUR}.sig`, 'sig'],
    ])
    const r = runHook(dir, CUR)
    assert.equal(r.status, 1, `0 字节产物必须判红,实际: ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.ok(r.stderr.includes('产物为空'), r.stderr)
    assert.ok(r.stderr.includes('0 字节'), r.stderr)
    assert.ok(r.stderr.includes(CUR), r.stderr)
  } finally {
    rmScratch(dir)
  }
})

test('F-041 正例:有产物且签名齐全 ⇒ exit 0,行为不变', () => {
  const dir = mkScratch('ihui-artifact-ok-')
  try {
    seed(dir, [
      [CUR, 'x'],
      [`${CUR}.sig`, 'sig'],
    ])
    const r = runHook(dir, CUR)
    assert.equal(r.status, 0, `有产物必须仍判通过,实际: ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.ok(r.stdout.includes('唯一安装包'), r.stdout)
    assert.deepEqual(readdirSync(dir).sort(), [CUR, `${CUR}.sig`].sort())
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
