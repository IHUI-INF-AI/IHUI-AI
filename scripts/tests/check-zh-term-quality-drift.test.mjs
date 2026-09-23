// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-zh-term-quality 同族漂移判据镜像测试(H29 残余①)。
 * §22c:直接 import 源脚本 __test__,禁止复制实现。
 * 跑法:node --test scripts/tests/check-zh-term-quality-drift.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { __test__ as G } from '../check-zh-term-quality.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RULES = [
  { keyRoot: 'list', forbidden: ['房源', '挂牌'], expect: ['列表'], note: 't' },
  { keyRoot: 'port', forbidden: ['港口'], expect: ['端口'], note: 't' },
]

test('§22c 锚点:__test__ 暴露漂移函数', () => {
  for (const k of ['matchRule', 'scanTexts', 'runScan', 'parentOf', 'detectFamilyDrift', 'scanFamilyDrifts']) {
    assert.ok(typeof G[k] === 'function', `__test__ 缺少 ${k}`)
  }
})

test('parentOf:数组下标剥离/无点不成族', () => {
  assert.equal(G.parentOf('m.list.inProgress'), 'm.list')
  assert.equal(G.parentOf('m.list.[0]'), 'm.list')
  assert.equal(G.parentOf('single'), '')
  assert.equal(G.parentOf('a.b.c.d'), 'a.b.c')
})

test('漂移真缺陷必红:同族两种错译 + 错译配正确侧', () => {
  const twoBad = [
    { keyPath: 'm.list.inProgress', text: '房源' },
    { keyPath: 'm.list.completed', text: '挂牌' },
    { keyPath: 'm.list.failed', text: '列出未成功' },
  ]
  assert.equal(G.detectFamilyDrift(twoBad, RULES).length, 1)
  const badPlusOk = [
    { keyPath: 'm.list.a', text: '显示房源' },
    { keyPath: 'm.list.b', text: '文件列表' },
  ]
  assert.equal(G.detectFamilyDrift(badPlusOk, RULES).length, 1)
})

test('漂移不误报:全正确/单孤立/并列/跨父级', () => {
  const allOk = [
    { keyPath: 'm.list.a', text: '文件列表' },
    { keyPath: 'm.list.b', text: '列表视图' },
  ]
  assert.equal(G.detectFamilyDrift(allOk, RULES).length, 0)
  const single = [{ keyPath: 'm.list.a', text: '房源' }]
  assert.equal(G.detectFamilyDrift(single, RULES).length, 0)
  const mixed = [
    { keyPath: 'm.list.a', text: '列表 / 房源视图' },
    { keyPath: 'm.list.b', text: '文件列表' },
  ]
  assert.equal(G.detectFamilyDrift(mixed, RULES).length, 0)
  const crossFamily = [
    { keyPath: 'a.list.x', text: '房源' },
    { keyPath: 'b.list.y', text: '文件列表' },
  ]
  assert.equal(G.detectFamilyDrift(crossFamily, RULES).length, 0)
})

test('scanFamilyDrifts:带命名空间与见证键', () => {
  const texts = [
    { keyPath: 'net.port.a', text: '港口占用' },
    { keyPath: 'net.port.b', text: '端口占用' },
  ]
  const out = G.scanFamilyDrifts('demo', 'zh-CN', texts, RULES)
  assert.equal(out.length, 1)
  assert.equal(out[0].kind, 'family-drift')
  assert.equal(out[0].keyPath, 'net.port.*')
  assert.ok(out[0].witnessKeys.length >= 2)
})

test('miniapp 离线包同一判据:解压后 zh-TW 零命中', () => {
  const genFile = join(ROOT, 'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts')
  assert.ok(existsSync(genFile), '离线包文件不存在')
  const src = readFileSync(genFile, 'utf8')
  const m = src.match(/'zh-TW':\s*'([^']+)'/)
  assert.ok(m, 'bundle 内无 zh-TW 载荷')
  const inflated = JSON.parse(gunzipSync(Buffer.from(m[1], 'base64')).toString('utf8'))
  const texts = []
  const walk = (node, path) => {
    if (typeof node === 'string') {
      texts.push({ keyPath: path.join('.'), text: node })
      return
    }
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      for (const [k, v] of Object.entries(node)) walk(v, [...path, k])
    }
  }
  walk(inflated, [])
  assert.ok(texts.length > 1000, `bundle 文案过少:${texts.length}`)
  const glossary = JSON.parse(
    readFileSync(join(ROOT, 'scripts/data/zh-term-glossary.json'), 'utf8'),
  )
  let singles = 0
  for (const t of texts) {
    for (const r of glossary.rules) singles += G.matchRule(t.keyPath, t.text, r).length
  }
  assert.equal(singles, 0)
  assert.equal(G.detectFamilyDrift(texts, glossary.rules).length, 0)
})
