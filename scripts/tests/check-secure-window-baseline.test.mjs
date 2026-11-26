// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-5 镜像测试:check-secure-window-baseline 的判据本体(与门共用同一 fixture,单一真相源)。
 *
 * 正反成对,避免只留正向用例让判据整族空转:
 *   ① 绿:15 锚点齐 ⇒ 零违规;
 *   ② 红:逐条删 present 锚点 / 逐条注入 absent 坏串 ⇒ 对应违规判红(变异咬合);
 *   ③ 反假绿:present 写进注释不算、absent 写进注释不算回退、空扫描面、缺关键文件全部判红;
 *   ④ 边界:诚实断言本门判的是"静态基线完整",不把运行时"三安全项已开"写成通过。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAPS_REL,
  CHECKS,
  KEY_FILES,
  MIN_RUST_FILES,
  evaluate,
  fixture,
  stripComments,
} from '../check-secure-window-baseline.mjs'

const BAD_LINES = {
  'S2-csp-no-eval': "'unsafe-eval'",
  'S3-csp-mod-protect': '"dangerousDisableAssetCspModification": true',
  'E1-no-node-integration': 'nodeIntegration: true',
  'E1-no-no-isolation': 'contextIsolation: false',
  'E1-no-no-websecurity': 'webSecurity: false',
}

test('绿夹具:15 锚点齐 ⇒ 零违规', () => {
  const r = evaluate({ files: fixture() })
  assert.equal(r.ok, true, JSON.stringify(r.violations))
  assert.equal(r.stats.passed, CHECKS.length)
  assert.ok(r.stats.rust >= MIN_RUST_FILES)
})

test('红夹具:逐条删 present 锚点 ⇒ anchor-missing 判红', () => {
  for (const c of CHECKS.filter((x) => x.mode === 'present')) {
    const r = evaluate({ files: fixture({ omit: [c.id] }) })
    assert.equal(r.ok, false, `删 ${c.id} 应判红`)
    assert.ok(r.violations.some((v) => v.kind === 'anchor-missing' && v.detail.startsWith(c.id)), `${c.id}`)
  }
})

test('红夹具:逐条注入 absent 坏串 ⇒ unsafe-introduced 判红', () => {
  for (const [id, line] of Object.entries(BAD_LINES)) {
    const r = evaluate({ files: fixture({ inject: [{ id, line }] }) })
    assert.equal(r.ok, false, `引入 ${id} 应判红`)
    assert.ok(r.violations.some((v) => v.kind === 'unsafe-introduced' && v.detail.startsWith(id)), id)
  }
})

test('反假绿:present 锚点写进注释不算基线在位', () => {
  const r = evaluate({ files: fixture({ commentOut: ['S1-global-api-off'] }) })
  assert.ok(r.violations.some((v) => v.detail.startsWith('S1-global-api-off')))
})

test('反假绿:absent 坏串写进注释不算回退', () => {
  const r = evaluate({ files: fixture({ inject: [{ id: 'E1-no-node-integration', line: '// nodeIntegration: true' }] }) })
  assert.equal(r.ok, true, JSON.stringify(r.violations))
})

test('反假绿:空扫描面判红', () => {
  assert.equal(evaluate({ files: [] }).violations[0].kind, 'empty-face')
})

test('反假绿:缺关键文件判红', () => {
  const files = fixture().filter((f) => f.rel !== CAPS_REL)
  while (files.filter((f) => /\.rs$/.test(f.rel)).length < MIN_RUST_FILES) {
    files.push({ rel: 'apps/desktop/src-tauri/src/extra.rs', source: '// filler' })
  }
  assert.ok(evaluate({ files }).violations.some((v) => v.kind === 'file-missing'))
})

test('stripComments:保留字符串里的 // URL,剥掉真注释', () => {
  const src = 'const u = "https://aizhs.top"; // withGlobalTauri: true\n"withGlobalTauri": false,'
  const stripped = stripComments(src)
  assert.ok(stripped.includes('https://aizhs.top'), '字符串 URL 不得被当注释截断')
  assert.ok(!stripped.includes('withGlobalTauri: true'), '注释里的坏串必须被剥掉')
  assert.ok(stripped.includes('"withGlobalTauri": false'), '真代码锚点必须保留')
})

test('边界:判定边界为静态基线,不含运行时断言', () => {
  assert.deepEqual(Object.keys(evaluate({ files: fixture() })).sort(), ['ok', 'stats', 'violations'])
  assert.equal(KEY_FILES.includes('apps/desktop/src-tauri/tauri.conf.json'), true)
})
