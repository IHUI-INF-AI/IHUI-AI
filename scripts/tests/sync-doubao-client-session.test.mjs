// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { __test__ as S } from '../sync-doubao-client-session.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('parseArgs:豆包回灌腿Flags与互斥边界', () => {
  const p = S.parseArgs(['--json', '--dry-run', '--all-profiles', '--uid=auto:target'])
  assert.equal(p.json, true)
  assert.equal(p.dryRun, true)
  assert.equal(p.allProfiles, true)
  assert.equal(p.uid, 'auto:target')
  assert.equal(p.error, null)

  assert.match(S.parseArgs(['--bogus']).error, /未知参数/)
  assert.match(S.parseArgs(['--uid=']).error, /--uid=/)
  assert.match(S.parseArgs(['--profile=Default', '--all-profiles']).error, /互斥/)
})

test('buildPayload:只有服务端 accepted 的会话能进写库载荷', () => {
  const extracted = {
    accounts: [
      { uid: 'auto:ok', token: 'tok-ok', cookies: [{ name: 'sessionid', value: 'v1' }] },
      { uid: 'auto:dead', token: 'tok-dead', cookies: [{ name: 'sessionid', value: 'v2' }] },
      { uid: 'auto:unknown', token: 'tok-u', cookies: [{ name: 'sessionid', value: 'v3' }] },
    ],
  }
  const verifications = new Map([
    ['auto:ok', { verdict: 'accepted', reason: '', mobile: '157******40' }],
    ['auto:dead', { verdict: 'rejected', reason: '服务端未返回账号信息', mobile: null }],
    ['auto:unknown', { verdict: 'undetermined', reason: 'timeout', mobile: null }],
  ])
  const p = S.buildPayload(extracted, verifications, '', '2026-11-26T00:00:00.000Z')
  assert.equal(p.providerCode, 'doubao')
  assert.equal(p.accounts.length, 1)
  assert.equal(p.accounts[0].uid, 'auto:ok')
  assert.equal(p.accounts[0].phone, '157******40')
  assert.equal(p.clientActiveAt, '2026-11-26T00:00:00.000Z')
  assert.equal(p.meta.rejected.length, 1)
  assert.equal(p.meta.undetermined.length, 1)
  assert.ok(!JSON.stringify(p).includes('tok-dead'))
  assert.ok(!JSON.stringify(p).includes('tok-u'))
})

test('buildPayload:点名 uid 时验票通过不止一条 ⇒ uidError 且 accounts 清空(不猜)', () => {
  const extracted = {
    accounts: [
      { uid: 'auto:a', token: 't1', cookies: [{ name: 'sessionid', value: 'v1' }] },
      { uid: 'auto:b', token: 't2', cookies: [{ name: 'sessionid', value: 'v2' }] },
    ],
  }
  const verifications = new Map([
    ['auto:a', { verdict: 'accepted', reason: '', mobile: null }],
    ['auto:b', { verdict: 'accepted', reason: '', mobile: null }],
  ])
  const p = S.buildPayload(extracted, verifications, 'auto:a')
  assert.match(p.meta.uidError, /认不出/)
  assert.deepEqual(p.accounts, [])
  const one = S.buildPayload({ accounts: [extracted.accounts[0]] }, verifications, 'auto:a')
  assert.equal(one.accounts[0].targetUid, 'auto:a')
})

test('probeDoubaoClientActive:进程三态不并桶', () => {
  assert.equal(S.probeDoubaoClientActive({}, []), false)
  assert.equal(S.probeDoubaoClientActive({}, [123]), true)
  assert.equal(S.probeDoubaoClientActive({}, null), null)
})

test('落库端单源:豆包壳只指向整包 cookiesEnc 的专用落库脚本', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'sync-doubao-client-session.mjs'), 'utf8')
  assert.ok(shell.includes('relay-doubao-session-sync.ts'))
  assert.ok(!shell.includes('relay-client-session-sync.ts'), '通用腿只写一个 token,不能冒豆包整包')
})
