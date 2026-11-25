// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseEnvBlock, resolveEdgeSecret, unquote } from '../security/lib/edge-secret.mjs'

const fixtureDir = mkdtempSync(join(tmpdir(), 'ihui-edge-secret-'))
const fixtureEnv = join(fixtureDir, '.env')

test('parseEnvBlock 认 \\r\\n 分隔', () => {
  assert.deepEqual(parseEnvBlock('A=1\r\nB=2'), { A: '1', B: '2' })
})

test('parseEnvBlock 认 \\r 单独分隔 —— nssm 给的就是这种(只写 \\r?\\n 会静默漏键)', () => {
  const parsed = parseEnvBlock('IHUI_BG_PORT=8801\rIHUI_EDGE_SECRET=s3cret\rIHUI_EDGE_SECRET_MODE=enforce')
  assert.equal(Object.keys(parsed).length, 3)
  assert.equal(parsed.IHUI_EDGE_SECRET, 's3cret')
})

test('parseEnvBlock 认 \\n 分隔', () => {
  assert.deepEqual(parseEnvBlock('A=1\nB=2'), { A: '1', B: '2' })
})

test('值里含 = 与 < 不被截断(实测有 IHUI_BG_HEALTH_MATCH=<!DOCTYPE html)', () => {
  const parsed = parseEnvBlock('IHUI_BG_HEALTH_MATCH=<!DOCTYPE html>\rX=a=b=c')
  assert.equal(parsed.IHUI_BG_HEALTH_MATCH, '<!DOCTYPE html>')
  assert.equal(parsed.X, 'a=b=c')
})

test('空行与非法行被忽略', () => {
  const parsed = parseEnvBlock('\r\n  \r# comment\rNOVALUE\rOK=1')
  assert.deepEqual(Object.keys(parsed), ['OK'])
})

test('unquote 去掉成对引号,不成对就原样返回', () => {
  assert.equal(unquote('"abc"'), 'abc')
  assert.equal(unquote("'abc'"), 'abc')
  assert.equal(unquote('abc'), 'abc')
  assert.equal(unquote('"abc'), '"abc')
})

test('resolveEdgeSecret 优先取进程 env', () => {
  const r = resolveEdgeSecret({ env: { IHUI_EDGE_SECRET: 'from-env' }, files: [], readService: false })
  assert.equal(r.value, 'from-env')
  assert.equal(r.source, 'env:IHUI_EDGE_SECRET')
})

test('resolveEdgeSecret 次选 .env 文件', () => {
  writeFileSync(fixtureEnv, 'IHUI_EDGE_SECRET="from-file"\nOTHER=1\n', 'utf8')
  const r = resolveEdgeSecret({ env: {}, files: [fixtureEnv], readService: false })
  assert.equal(r.value, 'from-file')
  assert.equal(r.source, `file:${fixtureEnv}`)
})

test('三处都没有 ⇒ value=null 且不造假值', () => {
  const r = resolveEdgeSecret({ env: {}, files: [join(fixtureDir, 'nope.env')], readService: false })
  assert.equal(r.value, null)
  assert.equal(r.source, null)
})

test('source 只说明来源,绝不夹带值本身', () => {
  const r = resolveEdgeSecret({ env: { IHUI_EDGE_SECRET: 'super-secret-value' }, files: [], readService: false })
  assert.equal(String(r.source).includes('super-secret-value'), false)
  assert.equal(String(r.source).includes(r.value), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
