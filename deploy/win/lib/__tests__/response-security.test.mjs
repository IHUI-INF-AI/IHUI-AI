// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  API_SECURITY_HEADERS,
  applySecurityHeaders,
  resolveSecurityHeaderMode,
} from '../response-security.mjs'

test('resolveSecurityHeaderMode: env on/off 优先于监听面推断', () => {
  assert.equal(resolveSecurityHeaderMode('on', '0.0.0.0'), true) // web 实例但显式开
  assert.equal(resolveSecurityHeaderMode('off', '127.0.0.1'), false) // api 实例但显式关
  assert.equal(resolveSecurityHeaderMode('ON', '0.0.0.0'), true) // 大小写不敏感
  assert.equal(resolveSecurityHeaderMode('  off ', '127.0.0.1'), false) // 容忍空格
})

test('resolveSecurityHeaderMode: 缺省按监听面推断 —— 回环=API 实例=加', () => {
  assert.equal(resolveSecurityHeaderMode(undefined, '127.0.0.1'), true)
  assert.equal(resolveSecurityHeaderMode('', '::1'), true)
  assert.equal(resolveSecurityHeaderMode(null, 'localhost'), true)
})

test('resolveSecurityHeaderMode: 缺省按监听面推断 —— 0.0.0.0=web 实例=不加', () => {
  // web router 必须绑 0.0.0.0(EdgeOne 回源硬约束),其安全头由 next.config 自理,
  // 此处若误加会重复甚至破坏 web 同域 iframe。
  assert.equal(resolveSecurityHeaderMode(undefined, '0.0.0.0'), false)
})

test('applySecurityHeaders: enabled=false 原样返回(不复制、不增删)', () => {
  const up = { 'content-type': 'application/json' }
  assert.equal(applySecurityHeaders(up, false), up)
})

test('applySecurityHeaders: 给上游补全套安全头(API 当前零安全头 ⇒ 净增量)', () => {
  const out = applySecurityHeaders({ 'content-type': 'application/json' }, true)
  for (const [k] of API_SECURITY_HEADERS) {
    assert.ok(k.toLowerCase() in _lowerKeys(out), `缺安全头 ${k}`)
  }
  assert.equal(out['content-type'], 'application/json') // 原有头保留
  assert.equal(getHeader(out, 'x-frame-options'), 'DENY')
  assert.equal(getHeader(out, 'x-content-type-options'), 'nosniff')
})

test('applySecurityHeaders: 不覆盖上游已设的安全头(防双份 CSP)', () => {
  const out = applySecurityHeaders(
    { 'content-type': 'application/json', 'x-frame-options': 'SAMEORIGIN', 'content-security-policy': "default-src 'self'" },
    true,
  )
  assert.equal(getHeader(out, 'x-frame-options'), 'SAMEORIGIN') // 保留上游值,不改成 DENY
  assert.equal(getHeader(out, 'content-security-policy'), "default-src 'self'")
  // 其余上游没设的仍补
  assert.equal(getHeader(out, 'x-content-type-options'), 'nosniff')
})

test('applySecurityHeaders: 大小写不敏感地识别已设头', () => {
  const out = applySecurityHeaders({ 'X-Frame-Options': 'SAMEORIGIN' }, true)
  assert.equal(getHeader(out, 'x-frame-options'), 'SAMEORIGIN') // 不重复追加小写版
  const keys = Object.keys(out).map((k) => k.toLowerCase())
  assert.equal(keys.filter((k) => k === 'x-frame-options').length, 1)
})

test('applySecurityHeaders: 不修改入参(防御性)', () => {
  const up = { 'content-type': 'application/json' }
  applySecurityHeaders(up, true)
  assert.deepEqual(up, { 'content-type': 'application/json' })
})

// ── helpers ────────────────────────────────────────────────────────────────
function _lowerKeys(obj) {
  const out = {}
  for (const k of Object.keys(obj)) out[k.toLowerCase()] = true
  return out
}

/** 大小写不敏感地读响应头(HTTP 头名大小写不敏感,实测 Node 上游头已小写、本模块注入用规范大小写)。 */
function getHeader(obj, name) {
  const lk = name.toLowerCase()
  for (const k of Object.keys(obj || {})) {
    if (k.toLowerCase() === lk) return obj[k]
  }
  return undefined
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
