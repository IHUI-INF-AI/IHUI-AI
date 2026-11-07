// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * selectRuntime 的行为锁：选中较新且兼容的条；
 * 平台键缺失、哈希不合法、版本比不出来都不得回退成「没有更新」或「用第一条」。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { selectRuntime } from '../lib/runtime-feed.mjs'

const SHA = 'ab'.repeat(32)
const SHA_UPPER = 'AB'.repeat(32)

function row(overrides = {}) {
  return {
    version: '1.2.3',
    minAppVersion: '1.0.0',
    url: 'https://example.com/runtime/win32-x64.tar.gz',
    sha256: SHA,
    size: 4096,
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

test('选中发布时间更晚、且最低应用版本仍兼容的条', () => {
  const olderHigher = row({
    version: '2.0.0',
    publishedAt: '2026-01-01T00:00:00.000Z',
  })
  const incompatibleLatest = row({
    version: '9.0.0',
    minAppVersion: '9.0.0',
    publishedAt: '2026-11-01T00:00:00.000Z',
  })
  const newerCompatible = row({
    version: '1.5.0',
    publishedAt: '2026-08-01T00:00:00.000Z',
  })
  const list = [olderHigher, incompatibleLatest, newerCompatible]
  const result = selectRuntime({ platforms: { 'win32-x64': list } }, 'win32-x64', '1.8.0')

  assert.equal(result.ok, true)
  assert.equal(result.reason, 'selected')
  assert.deepEqual(result.pick, newerCompatible)
  assert.notEqual(result.pick, newerCompatible)
  assert.equal(list[0], olderHigher)
  assert.equal(list[2], newerCompatible)
})

test('平台键不存在是 platform-absent，不是 none-compatible', () => {
  const feed = { platforms: { 'linux-x64': [row()] } }
  const result = selectRuntime(feed, 'win32-x64', '1.8.0')
  assert.deepEqual(result, { ok: false, reason: 'platform-absent', pick: null })
})

test('平台键在但数组为空是 platform-empty，与缺键分开', () => {
  const result = selectRuntime({ platforms: { 'win32-x64': [] } }, 'win32-x64', '1.8.0')
  assert.deepEqual(result, { ok: false, reason: 'platform-empty', pick: null })
})

test('哈希大写的条被跳过；旁边还有合法条时选合法条', () => {
  const upper = row({ sha256: SHA_UPPER, version: '9.9.9', publishedAt: '2026-12-01T00:00:00.000Z' })
  const good = row({ version: '1.1.0', publishedAt: '2026-03-01T00:00:00.000Z' })
  const result = selectRuntime({ platforms: { 'darwin-arm64': [upper, good] } }, 'darwin-arm64', '2.0.0')
  assert.equal(result.ok, true)
  assert.equal(result.reason, 'selected')
  assert.equal(result.pick.version, '1.1.0')
  assert.equal(result.pick.sha256, SHA)
})

test('只剩哈希大写的条时是 rows-unreadable，不得当成选中', () => {
  const result = selectRuntime(
    { platforms: { 'darwin-arm64': [row({ sha256: SHA_UPPER })] } },
    'darwin-arm64',
    '2.0.0',
  )
  assert.deepEqual(result, { ok: false, reason: 'rows-unreadable', pick: null })
})

test('应用版本低于 minAppVersion 则 none-compatible', () => {
  const result = selectRuntime(
    { platforms: { 'win32-x64': [row({ version: '3.1.0', minAppVersion: '2.0.0' })] } },
    'win32-x64',
    '1.9.9',
  )
  assert.deepEqual(result, { ok: false, reason: 'none-compatible', pick: null })
})

test('feed 为 null 是 feed-unmeasured', () => {
  assert.deepEqual(selectRuntime(null, 'win32-x64', '1.0.0'), {
    ok: false,
    reason: 'feed-unmeasured',
    pick: null,
  })
})

test('没有 platforms 对象同样是 feed-unmeasured', () => {
  assert.equal(selectRuntime({}, 'win32-x64', '1.0.0').reason, 'feed-unmeasured')
  assert.equal(selectRuntime({ platforms: null }, 'win32-x64', '1.0.0').reason, 'feed-unmeasured')
  assert.equal(selectRuntime('feed', 'win32-x64', '1.0.0').reason, 'feed-unmeasured')
})

test('发布时间相同再取 version 较大者，按主.次.修数值比', () => {
  const at = '2026-05-01T00:00:00.000Z'
  const nine = row({ version: '1.9.0', publishedAt: at })
  const ten = row({ version: '1.10.0', publishedAt: at })
  const result = selectRuntime({ platforms: { 'linux-x64': [nine, ten] } }, 'linux-x64', '2.0.0')
  assert.equal(result.pick.version, '1.10.0')
})

test('最低应用版本 1.2.0 不高于应用 1.10.0，字符串序不得把它判成不兼容', () => {
  const result = selectRuntime(
    { platforms: { 'win32-x64': [row({ minAppVersion: '1.2.0', version: '3.0.0' })] } },
    'win32-x64',
    '1.10.0',
  )
  assert.equal(result.ok, true)
  assert.equal(result.pick.version, '3.0.0')
})

test('版本字段比不出来的条被跳过；只剩它则 rows-unreadable', () => {
  const bad = row({ version: '1.2' })
  const good = row({ version: '1.3.0', publishedAt: '2026-02-01T00:00:00.000Z' })
  const picked = selectRuntime({ platforms: { 'win32-x64': [bad, good] } }, 'win32-x64', '2.0.0')
  assert.equal(picked.pick.version, '1.3.0')
  const onlyBad = selectRuntime({ platforms: { 'win32-x64': [bad] } }, 'win32-x64', '2.0.0')
  assert.deepEqual(onlyBad, { ok: false, reason: 'rows-unreadable', pick: null })
})

test('应用版本比不出来时不得回退成选中或没有更新', () => {
  const only = row()
  const result = selectRuntime({ platforms: { 'win32-x64': [only] } }, 'win32-x64', '1.2')
  assert.equal(result.ok, false)
  assert.equal(result.pick, null)
  assert.equal(result.reason, 'version-unmeasured')
})

test('minAppVersion 与应用版本相等仍可选', () => {
  const result = selectRuntime(
    { platforms: { 'win32-x64': [row({ minAppVersion: '1.2.3' })] } },
    'win32-x64',
    '1.2.3',
  )
  assert.equal(result.ok, true)
  assert.equal(result.pick.version, '1.2.3')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
