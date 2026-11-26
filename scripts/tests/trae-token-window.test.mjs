// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 客户端票窗判据的回归测试(2026-11-26 立)。
 *
 * 每一格都对应一次真事故或一条真边界:
 *  - 剩 8h + rt 废 ⇒ 客户端先换票 ⇒ 20403 当场登出(本次两次切号失败的根因);
 *  - 剩 30h 但总寿命已耗过 1/3 ⇒ 客户端同样先换票(1/3 那条支路,容易漏);
 *  - 剩 30h 且 1/3 未耗 ⇒ 直接用票,rt 废也不影响本次登录(不能误杀)。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TRAE_CLIENT_TOKEN_WINDOW_MS,
  TRAE_TOKEN_VERDICT,
  traeTokenLeftHours,
  traeTokenVerdict,
  traeTokenWindowTag,
  traeTicketWindowTag,
} from '../lib/trae-token-window.mjs'

const NOW = Date.parse('2026-11-26T12:00:00+08:00')
const H = 3600000

test('无 token / 无到期时刻 ⇒ need-login(连换票都不该试)', () => {
  assert.equal(traeTokenVerdict({ expiresAt: NOW + 48 * H }, NOW), TRAE_TOKEN_VERDICT.NEED_LOGIN)
  assert.equal(traeTokenVerdict({ token: 't' }, NOW), TRAE_TOKEN_VERDICT.NEED_LOGIN)
  assert.equal(
    traeTokenVerdict({ token: 't', expiresAt: 'not-a-date' }, NOW),
    TRAE_TOKEN_VERDICT.NEED_LOGIN,
  )
})

test('票已过期 ⇒ need-login', () => {
  assert.equal(
    traeTokenVerdict({ token: 't', expiresAt: NOW - H }, NOW),
    TRAE_TOKEN_VERDICT.NEED_LOGIN,
  )
})

test('剩余 8h ⇒ need-refresh(29 日那次切号失败的原样场景)', () => {
  assert.equal(
    traeTokenVerdict({ token: 't', expiresAt: NOW + 8 * H }, NOW),
    TRAE_TOKEN_VERDICT.NEED_REFRESH,
  )
})

test('剩余恰好 24h ⇒ need-refresh(客户端判据是 r <= 24h,不是 <)', () => {
  assert.equal(
    traeTokenVerdict({ token: 't', expiresAt: NOW + 24 * H }, NOW),
    TRAE_TOKEN_VERDICT.NEED_REFRESH,
  )
})

test('剩余 30h、总寿命 90h(1/3 未耗)⇒ valid,不能误杀好号', () => {
  assert.equal(
    traeTokenVerdict(
      { token: 't', expiresAt: NOW + 30 * H, tokenReleaseAt: NOW - 60 * H },
      NOW,
    ),
    TRAE_TOKEN_VERDICT.VALID,
  )
})

test('剩余 30h、总寿命 120h(已耗过 1/3 = 40h)⇒ need-refresh(1/3 支路)', () => {
  assert.equal(
    traeTokenVerdict(
      { token: 't', expiresAt: NOW + 30 * H, tokenReleaseAt: NOW - 90 * H },
      NOW,
    ),
    TRAE_TOKEN_VERDICT.NEED_REFRESH,
  )
})

test('剩余 30h 但没有 tokenReleaseAt ⇒ 退回 24h 判据 ⇒ valid', () => {
  assert.equal(
    traeTokenVerdict({ token: 't', expiresAt: NOW + 30 * H, tokenReleaseAt: null }, NOW),
    TRAE_TOKEN_VERDICT.VALID,
  )
})

test('票窗剩余小时:解不出 → null,过期 → 负数', () => {
  assert.equal(traeTokenLeftHours({ expiresAt: null }, NOW), null)
  assert.equal(traeTokenLeftHours({ expiresAt: NOW + 8 * H }, NOW), 8)
  assert.ok(traeTokenLeftHours({ expiresAt: NOW - H }, NOW) < 0)
})

test('展示标签:valid 不打扰,need-refresh 报剩余小时,过期报重登', () => {
  assert.equal(
    traeTokenWindowTag({ token: 't', expiresAt: NOW + 30 * H, tokenReleaseAt: NOW - 60 * H }, NOW),
    '',
  )
  const refresh = traeTokenWindowTag({ token: 't', expiresAt: NOW + 8 * H }, NOW)
  assert.match(refresh, /票窗仅剩8\.0h/)
  assert.match(traeTokenWindowTag({ token: 't', expiresAt: NOW - H }, NOW), /票已过期/)
})

test('列表标签(只需要到期时刻):与预检同一判据', () => {
  assert.equal(traeTicketWindowTag({ expiresAt: NOW + 30 * H }, NOW), '')
  assert.match(traeTicketWindowTag({ expiresAt: NOW + 8 * H }, NOW), /票窗仅剩8\.0h/)
  assert.match(traeTicketWindowTag({ expiresAt: '坏值' }, NOW), /解不出/)
  // 1/3 支路:剩 30h > 24h,但总寿命 120h 已耗 90h ⇒ 一样要换票
  assert.match(
    traeTicketWindowTag({ expiresAt: NOW + 30 * H, tokenReleaseAt: NOW - 90 * H }, NOW),
    /票窗仅剩30\.0h/,
  )
  assert.equal(TRAE_CLIENT_TOKEN_WINDOW_MS, 24 * H)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
