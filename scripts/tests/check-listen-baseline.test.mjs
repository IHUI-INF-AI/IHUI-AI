// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-6 镜像测试:check-listen-baseline 的判据本体(与门共用同一 fixture,单一真相源)。
 *   ① 绿:5 present + 3 absent 齐 ⇒ 零违规;
 *   ② 红:逐条删 present / 注入 absent 坏串 ⇒ 判红(变异咬合);
 *   ③ 反假绿:注释不算、测试夹具里的 0.0.0.0 豁免、空扫描面、缺关键文件;
 *   ④ 边界:只判静态基线,不把运行时"无 0.0.0.0 监听"写成通过。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  API_INDEX,
  ABSENT_CHECKS,
  MIN_TS_FILES,
  PRESENT_CHECKS,
  evaluate,
  fixture,
  stripComments,
} from '../check-listen-baseline.mjs'

const BAD = {
  'X2-hardcode-any': "const HOST = '0.0.0.0'",
  'X3-file-plaintext-password': "const password = 'supersecret123'",
  'X4-inbound-basic': "if (req.header('authorization')?.startsWith('Basic ')) return false",
}

test('绿夹具:5 present + 3 absent 齐 ⇒ 零违规', () => {
  const r = evaluate({ files: fixture() })
  assert.equal(r.ok, true, JSON.stringify(r.violations))
  assert.equal(r.stats.passed, PRESENT_CHECKS.length + ABSENT_CHECKS.length)
  assert.ok(r.stats.ts >= MIN_TS_FILES)
})

test('红夹具:逐条删 present 锚点 ⇒ anchor-missing 判红', () => {
  for (const c of PRESENT_CHECKS) {
    const r = evaluate({ files: fixture({ omit: [c.id] }) })
    assert.equal(r.ok, false, `删 ${c.id} 应判红`)
    assert.ok(r.violations.some((v) => v.kind === 'anchor-missing' && v.detail.startsWith(c.id)), c.id)
  }
})

test('红夹具:逐条注入 absent 坏串 ⇒ unsafe-introduced 判红', () => {
  for (const [id, line] of Object.entries(BAD)) {
    const r = evaluate({ files: fixture({ inject: [{ rel: 'apps/api/src/evil.ts', line }] }) })
    assert.equal(r.ok, false, `引入 ${id} 应判红`)
    assert.ok(r.violations.some((v) => v.kind === 'unsafe-introduced' && v.detail.startsWith(id)), id)
  }
})

test('反假绿:present 锚点写进注释不算基线在位', () => {
  const r = evaluate({ files: fixture({ commentOut: ['B1-api-config'] }) })
  assert.ok(r.violations.some((v) => v.detail.startsWith('B1-api-config')))
})

test('反假绿:测试夹具里的 0.0.0.0 / 明文密码不算生产暴露', () => {
  const files = fixture({ inject: [
    { rel: 'apps/api/src/routes/__tests__/x.test.ts', line: "const HOST = '0.0.0.0'" },
    { rel: 'apps/cli/src/y.spec.ts', line: "const password = 'supersecret123'" },
  ] })
  assert.equal(evaluate({ files }).ok, true, JSON.stringify(evaluate({ files }).violations))
})

test('反假绿:空扫描面判红', () => {
  assert.equal(evaluate({ files: [] }).violations[0].kind, 'empty-face')
})

test('反假绿:缺关键文件判红', () => {
  const files = fixture().filter((f) => f.rel !== API_INDEX)
  while (files.filter((f) => /\.ts$/.test(f.rel) && !f.rel.includes('__tests__')).length < MIN_TS_FILES) {
    files.push({ rel: 'apps/api/src/extra.ts', source: 'export const y = 2' })
  }
  assert.ok(evaluate({ files }).violations.some((v) => v.kind === 'file-missing'))
})

test('stripComments:保留字符串里的 // URL,剥掉真注释', () => {
  const src = 'const u = "http://127.0.0.1:8802"; // const HOST = \'0.0.0.0\''
  const stripped = stripComments(src)
  assert.ok(stripped.includes('http://127.0.0.1:8802'))
  assert.ok(!stripped.includes('0.0.0.0'))
})

test('边界:判定边界为静态基线,不含运行时断言', () => {
  const r = evaluate({ files: fixture() })
  assert.deepEqual(Object.keys(r).sort(), ['ok', 'stats', 'violations'])
  assert.equal(r.stats.total, 8)
})
