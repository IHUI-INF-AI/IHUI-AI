// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `green-state.mjs` 镜像测试。钉回滚判定三态:无记号拒回退 / HEAD 已是绿色态拒回退 /
 * 有记号且 HEAD 不同才放行;以及记号形状锁(sha 与时间)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as gs } from '../green-state.mjs'

const STATE = gs.parseState(
  '{"sha":"c05ca0d5000e1609f8dbcc60ebb9f770d6e63e56","at":"2026-10-25T10:00:00.000Z"}',
)

test('① 记号形状锁:非法 sha / 非法时间都抛', () => {
  assert.equal(STATE.sha.length, 40)
  assert.throws(() => gs.parseState('{"sha":"zzz","at":"2026-10-25T10:00:00.000Z"}'), /sha/)
  assert.throws(() => gs.parseState('{"sha":"abc1234","at":"not-a-date"}'), /at/)
  assert.throws(() => gs.parseState('not-json'), /JSON/)
})

test('② 回滚判定:无记号拒绝,不凭空回退', () => {
  const d = gs.decideRollback({ state: null, headSha: 'abc1234' })
  assert.equal(d.action, 'refused')
})

test('③ 回滚判定:HEAD 读不到判未判定', () => {
  assert.equal(gs.decideRollback({ state: STATE, headSha: '' }).action, 'unknown')
})

test('④ 回滚判定:已在绿色态拒绝(避免 web 白重启一次)', () => {
  assert.equal(gs.decideRollback({ state: STATE, headSha: STATE.sha }).action, 'refused')
  assert.equal(
    gs.decideRollback({ state: STATE, headSha: STATE.sha.slice(0, 12) }).action,
    'refused',
  )
})

test('⑤ 回滚判定:有记号且 HEAD 不同 ⇒ 放行', () => {
  const d = gs.decideRollback({ state: STATE, headSha: 'deadbee1234' })
  assert.equal(d.action, 'allowed')
  assert.match(d.why, /绿色态/)
})
