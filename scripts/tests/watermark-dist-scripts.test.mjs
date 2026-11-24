// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 分发脚本豁免判据的镜像测试(§22c 第②步:判据一律 import 源文件 __test__,测试里不复制第二份判据)
import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__ } from '../lib/watermark-dist-scripts.mjs'

const { judgeDistScript, DistScriptLedgerUnavailable } = __test__

const ENTRY = {
  id: 'dist-install-ps1-root',
  path: 'scripts/install.ps1',
  anchorRegex: 'IHUI AI CLI — 一键安装脚本',
  expires: '2099-01-01',
  evidence: [{ file: 'scripts/install.ps1', contains: 'IHUI AI CLI — 一键安装脚本' }],
  reason: '这份文件要直接发给终端用户执行,载荷会被杀软判成木马,可用性优先。',
}

const SAMPLE = '# IHUI AI CLI — 一键安装脚本 (Windows PowerShell)\n#requires -Version 7\n'

test('未登记的路径一律不进豁免(不豁免 ≠ 报红,由覆盖面照旧判)', () => {
  const r = judgeDistScript({ rel: 'scripts/other.ps1', text: SAMPLE, entries: [ENTRY] })
  assert.equal(r.exempt, false)
  assert.equal(r.state, 'not-registered')
})

test('登记路径 + 正文命中锚点 + 未到期 ⇒ 豁免', () => {
  const r = judgeDistScript({
    rel: 'scripts/install.ps1',
    text: SAMPLE,
    entries: [ENTRY],
    today: '2027-01-01',
  })
  assert.equal(r.exempt, true)
  assert.equal(r.state, 'exempt')
  assert.equal(r.entryId, 'dist-install-ps1-root')
})

test('登记路径但正文不再命中锚点 ⇒ 前提失效,不豁免(防同路径被换成别的内容)', () => {
  const r = judgeDistScript({
    rel: 'scripts/install.ps1',
    text: '随便写点别的\n',
    entries: [ENTRY],
    today: '2027-01-01',
  })
  assert.equal(r.exempt, false)
  assert.equal(r.state, 'premise-missing')
  assert.match(r.why ?? '', /锚点/)
})

test('豁免到期 ⇒ 整条失效并点名(§0.7 存活期)', () => {
  const r = judgeDistScript({
    rel: 'scripts/install.ps1',
    text: SAMPLE,
    entries: [{ ...ENTRY, expires: '2027-06-30' }],
    today: '2027-07-01',
  })
  assert.equal(r.exempt, false)
  assert.equal(r.state, 'expired')
  assert.match(r.why ?? '', /2070-07-01|2027-07-01/)
})

test('被审面取不到正文 ⇒ 前提无法核验,不豁免(方向倒向严的一侧)', () => {
  const r = judgeDistScript({ rel: 'scripts/install.ps1', text: null, entries: [ENTRY] })
  assert.equal(r.exempt, false)
  assert.equal(r.state, 'no-content')
})

test('路径逐字判等:前缀相近的路径不得被糊住', () => {
  for (const rel of ['scripts/install.ps2', 'scripts/install.ps1.bak', 'x/scripts/install.ps1']) {
    const r = judgeDistScript({ rel, text: SAMPLE, entries: [ENTRY] })
    assert.equal(r.exempt, false, `${rel} 不应被豁免`)
    assert.equal(r.state, 'not-registered')
  }
})

test('台账形状坏 ⇒ 抛 DistScriptLedgerUnavailable(既不冒绿也不冒红)', () => {
  assert.ok(DistScriptLedgerUnavailable instanceof Function)
  assert.equal(DistScriptLedgerUnavailable.prototype.constructor.name, 'DistScriptLedgerUnavailable')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
