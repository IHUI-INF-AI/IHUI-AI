// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { __test__ as patch } from '../../apps/miniapp-taro/scripts/patch-entry-chunks.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

test('给 deferred chunk 补静态 require:相对路径按入口所在层级,缺产物文件的不补', () => {
  const dir = mkScratch('patch-entry-chunks')
  try {
    fs.mkdirSync(path.join(dir, 'pages/index'), { recursive: true })
    fs.writeFileSync(path.join(dir, '111.js'), '// chunk')
    fs.writeFileSync(path.join(dir, '222.js'), '// chunk')
    const entry = path.join(dir, 'pages/index/index.js')
    fs.writeFileSync(entry, 'wx.webpackJsonp;e.O(0,[111,222,999],function(){})', 'utf8')

    const r = patch.patchFile(entry, { root: dir })
    assert.equal(r.changed, true)
    assert.equal(r.count, 2)

    const out = fs.readFileSync(entry, 'utf8')
    assert.match(out, /e\.O\(0,\[111,222,999\]/)
    assert.match(out, /require\("\.\.\/\.\.\/111\.js"\)/)
    assert.match(out, /require\("\.\.\/\.\.\/222\.js"\)/)
    assert.ok(!out.includes('999.js'), '产物里不存在的 chunk 不得被补')
    assert.ok(out.includes(patch.MARK), '必须带幂等标记')
  } finally {
    rmScratch(dir)
  }
})

test('幂等:同一文件第二次调用不再追加', () => {
  const dir = mkScratch('patch-entry-chunks-idem')
  try {
    fs.writeFileSync(path.join(dir, '7.js'), '// chunk')
    const entry = path.join(dir, 'app.js')
    fs.writeFileSync(entry, 'e.O(0,[7],function(){})', 'utf8')
    assert.equal(patch.patchFile(entry, { root: dir }).changed, true)
    const once = fs.readFileSync(entry, 'utf8')
    assert.equal(patch.patchFile(entry, { root: dir }).changed, false)
    assert.equal(fs.readFileSync(entry, 'utf8'), once)
  } finally {
    rmScratch(dir)
  }
})

test('无 deferred 列表 ⇒ 原样保留', () => {
  const dir = mkScratch('patch-entry-chunks-none')
  try {
    const entry = path.join(dir, 'plain.js')
    fs.writeFileSync(entry, 'console.log(1)', 'utf8')
    assert.equal(patch.patchFile(entry, { root: dir }).changed, false)
    assert.equal(fs.readFileSync(entry, 'utf8'), 'console.log(1)')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
