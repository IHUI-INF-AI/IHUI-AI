// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveAccountUid, decodeDoubaoSafeStorageValue } from '../lib/doubao-auth-extract.mjs'

/**
 * 票 Y-25 钉:同账号换会话票(sessionid 族轮换)后,派生的稳定 uid 不变、仍命中旧行。
 * uid_tt / uid_tt_ss 是字节账号 UID,登录期内不变;sessionid / sid_tt 是会话票,换票即变。
 */

const HOST = '.doubao.com'

function entries({ sessionid, uid = '7350000000000000000', uidttss = 'stable-ss' }) {
  return [
    { source: 'cookies', key: 'sessionid', host: HOST, name: 'sessionid', value: sessionid },
    { source: 'cookies', key: 'sessionid_ss', host: HOST, name: 'sessionid_ss', value: `ss_${sessionid}` },
    { source: 'cookies', key: 'sid_tt', host: HOST, name: 'sid_tt', value: `sidtt_${sessionid}` },
    { source: 'cookies', key: 'uid_tt', host: HOST, name: 'uid_tt', value: uid },
    { source: 'cookies', key: 'uid_tt_ss', host: HOST, name: 'uid_tt_ss', value: uidttss },
  ]
}

test('同账号换 sessionid,派生 uid 不变且走 stable-uid 档', () => {
  const a = deriveAccountUid(entries({ sessionid: 'aaa' }))
  const b = deriveAccountUid(entries({ sessionid: 'bbb' }))
  assert.equal(a.mode, 'stable-uid')
  assert.equal(b.mode, 'stable-uid')
  assert.equal(a.uid, b.uid, '换会话票后稳定 uid 必须相同 ⇒ 覆盖能命中旧行')
  assert.notEqual(a.uid, '')
})

test('uid_tt 本身变了才换 uid(账号真换了)', () => {
  const a = deriveAccountUid(entries({ sessionid: 'aaa', uid: '111' }))
  const b = deriveAccountUid(entries({ sessionid: 'aaa', uid: '222' }))
  assert.notEqual(a.uid, b.uid)
})

test('无 uid_tt 族 ⇒ 退回 bundle 档,不冒充稳定(绝不返回空 uid)', () => {
  const noStable = [
    { source: 'cookies', key: 'sessionid', host: HOST, name: 'sessionid', value: 'abc' },
  ]
  const r = deriveAccountUid(noStable)
  assert.equal(r.mode, 'bundle')
  assert.match(r.uid, /^auto:[0-9a-f]{32}$/)
})

test('空输入不炸,退回 bundle 档', () => {
  const r = deriveAccountUid([])
  assert.equal(r.mode, 'bundle')
  assert.match(r.uid, /^auto:/)
})

test('uid_tt 值不含 cookie 明文(uid 是哈希,零凭据回显)', () => {
  const { uid } = deriveAccountUid(entries({ sessionid: 'x', uid: 'SECRET-UID-VALUE' }))
  assert.ok(!uid.includes('SECRET-UID-VALUE'), 'uid 是 sha256 摘要,不得含原值明文')
})

test('msToken 是二进制票:latin1 往返零丢失,不能按 UTF-8 解码成 U+FFFD(2026-11-26 根因)', () => {
  const raw = Buffer.from([0x95, 0xab, 0x85, 0xae, 0x29, 0x04, 0xf7, 0xd0, 0xd8, 0x13, 0xff, 0x80])
  const text = decodeDoubaoSafeStorageValue(raw, 'msToken')
  assert.equal(Buffer.from(text, 'latin1').equals(raw), true, 'latin1 往返必须逐字节相等')
  assert.equal(text.includes('\uFFFD'), false, 'latin1 不产生替换字符')
  // 对照:普通会话票仍按豆包魔数剥头(这里无魔数 ⇒ 原样 utf8)
  const plain = decodeDoubaoSafeStorageValue(Buffer.from('abc', 'utf8'), 'sessionid')
  assert.equal(plain, 'abc')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
