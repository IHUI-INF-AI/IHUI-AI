// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 豆包导入入口探针单测:只读临时假 bundle,零真安装包、零账号。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { probeDoubaoImportSurface } from '../lib/doubao-import-surface.mjs'

const REL = path.join(
  'local_webcontents',
  'extensions',
  'ai-views',
  'static',
  'js',
  'async',
  's2-asset-import.js',
)

function fakeApp(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doubao-import-'))
  const bundle = path.join(dir, REL)
  fs.mkdirSync(path.dirname(bundle), { recursive: true })
  if (text !== null) fs.writeFileSync(bundle, text)
  return dir
}

test('① 扫描式文案 ⇒ scan-apps(当前 2.37.16 实证)', () => {
  const dir = fakeApp('正在扫描你安装的应用 查看我的电脑，找到需要导入的 AI 应用 个人应用 企业应用')
  try {
    const r = probeDoubaoImportSurface({ appDir: dir })
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'scan-apps')
    assert.ok(r.scanHits.length >= 2)
    assert.equal(r.fileHits.length, 0)
    assert.match(r.note, /不能承诺原生导入/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('② 文件选择文案 ⇒ file-pick(仍提示须目标账号实测)', () => {
  const dir = fakeApp('选择文件 上传文件 导入 ZIP 选择备份文件')
  try {
    const r = probeDoubaoImportSurface({ appDir: dir })
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'file-pick')
    assert.ok(r.fileHits.length >= 2)
    assert.match(r.note, /UI 实测/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('②b bundle 用 \\uXXXX 转义中文 ⇒ 先还原再判 scan-apps(否则永远 0 命中)', () => {
  const dir = fakeApp(
    '\\u6b63\\u5728\\u626b\\u63cf\\u4f60\\u5b89\\u88c5\\u7684\\u5e94\\u7528 ' +
      '\\u67e5\\u770b\\u6211\\u7684\\u7535\\u8111\\uff0c\\u627e\\u5230\\u9700\\u8981\\u5bfc\\u5165\\u7684 AI \\u5e94\\u7528',
  )
  try {
    const r = probeDoubaoImportSurface({ appDir: dir })
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'scan-apps')
    assert.ok(r.scanHits.length >= 2)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('③ 文案不足 ⇒ unknown(不猜)', () => {
  const dir = fakeApp('数据导入与同步')
  try {
    const r = probeDoubaoImportSurface({ appDir: dir })
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'unknown')
    assert.match(r.note, /未判定/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('④ 安装目录不存在 ⇒ app-not-found', () => {
  const r = probeDoubaoImportSurface({ appDir: path.join(os.tmpdir(), 'doubao-no-app-xyz') })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'app-not-found')
})

test('⑤ bundle 缺失 ⇒ bundle-unreadable', () => {
  const dir = fakeApp(null)
  try {
    const r = probeDoubaoImportSurface({ appDir: dir })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'bundle-unreadable')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
