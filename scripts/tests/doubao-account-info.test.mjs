// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchDoubaoAccountPhone, normalizeDoubaoMobile } from '../lib/doubao-account-info.mjs'

/**
 * 豆包上游手机号读取钉(2026-11-17):
 * - 上游实际只回掩码(`+86 157******40`),normalize 必须剥国家码/空格且两种形态都收;
 * - 坏 cookie(U+FFFD/控制字符)不得进 HTTP 头 —— 与 doubao-adapter 同源判据;
 * - 取不到(null)是合法结果,绝不 throw(§0.3 取不到 ≠ 失效)。
 */

test('normalizeDoubaoMobile:全号/掩码/非法形态', () => {
  assert.equal(normalizeDoubaoMobile('+86 15754320340'), '15754320340')
  assert.equal(normalizeDoubaoMobile('+86 157******40'), '157******40')
  assert.equal(normalizeDoubaoMobile('157-5432-0340'), '15754320340')
  assert.equal(normalizeDoubaoMobile('+1 4155552671'), null)
  assert.equal(normalizeDoubaoMobile(''), null)
  assert.equal(normalizeDoubaoMobile(null), null)
})

test('fetchDoubaoAccountPhone:真票掩码 + 坏 cookie 剔除', async () => {
  let seenUrl = ''
  let seenInit
  const fetchImpl = async (url, init) => {
    seenUrl = String(url)
    seenInit = init
    return {
      ok: true,
      json: async () => ({
        code: 0,
        data: { base_account_info: { mobile: '+86 157******40' } },
      }),
    }
  }
  const phone = await fetchDoubaoAccountPhone(
    [
      { name: 'sessionid', value: 'abc123' },
      { key: 'uid_tt', value: '7350000000000000000' },
      // 模拟解密损坏:含 U+FFFD 的 msToken 必须被剔除,否则整个 Cookie 头会被 undici 拒收
      { name: 'msToken', value: 'bad\uFFFDtoken' },
    ],
    { fetchImpl, timeoutMs: 1000 },
  )
  assert.equal(phone, '157******40')
  assert.match(seenUrl, /\/alice\/user\/get_account_info\?/)
  assert.match(seenUrl, /aid=582478/)
  assert.equal(seenInit.method, 'POST')
  assert.match(seenInit.headers.cookie, /sessionid=abc123/)
  assert.match(seenInit.headers.cookie, /uid_tt=7350000000000000000/)
  assert.doesNotMatch(seenInit.headers.cookie, /msToken/)
})

test('fetchDoubaoAccountPhone:业务码非 0 → null', async () => {
  const phone = await fetchDoubaoAccountPhone([{ name: 'sessionid', value: 'abc' }], {
    fetchImpl: async () => ({ ok: true, json: async () => ({ code: 710012020 }) }),
    timeoutMs: 1000,
  })
  assert.equal(phone, null)
})

test('fetchDoubaoAccountPhone:无可用 cookie → 不请求、返回 null', async () => {
  let called = false
  const phone = await fetchDoubaoAccountPhone([], {
    fetchImpl: async () => {
      called = true
      return { ok: true, json: async () => ({}) }
    },
  })
  assert.equal(phone, null)
  assert.equal(called, false)
})

test('fetchDoubaoAccountPhone:网络异常 → null 不抛', async () => {
  const phone = await fetchDoubaoAccountPhone([{ name: 'sessionid', value: 'abc' }], {
    fetchImpl: async () => {
      throw new Error('network down')
    },
    timeoutMs: 1000,
  })
  assert.equal(phone, null)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
