// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * api-endpoint-delta.test.mjs —— 门 300 的镜像测试(§22c)。
 *
 * 判据不复制:提取/裁决全部 import 源 lib 与源门 `__test__`,本文件只钉方向:
 *   T1 提取器正例四形(fetch 字面量 / request url / 模板串 / 常量透传)
 *   T2 提取器反例(非 /api 串、普通常量)不误报
 *   T3 未判定必须计数(变量/形参/跨文件常量),不许折成「没有」
 *   T4 共享端点消费(import 自 @ihui/api-client)不算端内直拼
 *   T5 共享覆盖 exact/prefix/none + 前缀深度
 *   T6 棘轮:未登记新增 = 红;合规登记 = 绿;理由<10字/缺 owner/pending = 红
 *   T7 端到端:真实仓 HEAD 面存量全部在册,门 exit 0;三端差集读数可复现
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  extractEndpoints,
  extractSharedEndpoints,
  normalizePath,
  normalizeSharedPath,
  prefixOf,
  sharedCoverage,
  sharedPrefixSet,
  scanLineLiterals,
} from '../lib/api-endpoint-literals.mjs'
import { __test__ as G } from '../check-api-endpoint-delta.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPTS = join(ROOT, 'scripts')
const LEDGER = join(ROOT, 'scripts', 'data', 'api-endpoint-delta-ledger.jsonl')

/** 用注入的 listFiles/readFile 跑提取器(不落临时目录,不碰工作树)。 */
function extractFromTexts(end, texts) {
  const files = Object.keys(texts)
  return extractEndpoints('/nonexistent', end, 'apps/miniapp-taro', {
    listFiles: () => files,
    readFile: (rel) => texts[rel] ?? null,
  })
}

test('T1 提取器正例:四形都认得', () => {
  assert.equal(scanLineLiterals("fetch('/api/x')")[0]?.normalized, '/api/x')
  assert.equal(scanLineLiterals('request({ url: "/api/y" })')[0]?.normalized, '/api/y')
  assert.equal(scanLineLiterals('fetch(`/api/z/${id}`)')[0]?.normalized, '/api/z/:param')
  assert.equal(normalizePath('/api/ai/history${buildQs({ a: 1 })}'), '/api/ai/history/:param', '嵌套花括号必须整体替换')
  assert.equal(normalizePath('/api/x?a=1&b=2'), '/api/x')
})

test('T2 反例:非 /api 串与普通常量不误报', () => {
  assert.equal(scanLineLiterals("fetch('/not-api/x')").length, 0)
  assert.equal(scanLineLiterals("const s = 'hello'").length, 0)
  assert.equal(normalizePath('/apix/y'), null)
  assert.equal(normalizePath('/api/(.*)'), null, '正则 matcher 不是端点')
  const r = extractFromTexts('mp', { 'demo/clean.ts': "export const x = 'hello'\n" })
  assert.equal(r.rows.length, 0)
  assert.equal(r.unknowns.length, 0)
})

test('T3 未判定:变量/形参必须计数,不许折成没有', () => {
  const r = extractFromTexts('mp', {
    'demo/unknown.ts': 'export function f(url){ fetch(url) }\n',
    'demo/const.ts': 'const P = "/api/const/x";\nfetch(P)\n',
  })
  assert.equal(r.unknowns.length, 1, 'fetch(url) 必须落未判定')
  const refs = r.rows.filter((x) => x.form === 'const-ref')
  assert.equal(refs.length, 1, '同文件常量透传必须回填成 const-ref 行')
  assert.equal(refs[0].normalized, '/api/const/x')
})

test('T4 共享端点消费(import 自 @ihui/api-client)不算端内直拼', () => {
  const r = extractFromTexts('mp', {
    'demo/shared.ts': "import { apiUrl } from '@ihui/api-client'\nfetch(apiUrl)\n",
  })
  assert.equal(r.rows.length, 0)
  assert.equal(r.unknowns.length, 0, 'shared-client 绑定不该冒充未判定')
})

test('T5 共享覆盖与前缀深度', () => {
  assert.equal(sharedCoverage('/api/a/b', ['/api/a/b']).kind, 'exact')
  assert.equal(sharedCoverage('/api/a', ['/api/a/b']).kind, 'prefix')
  assert.equal(sharedCoverage('/api/nope/x', ['/api/a/b']).kind, 'none')
  assert.equal(prefixOf('/api/a/b', 1), '/api/a')
  assert.equal(prefixOf('/api/a/b', 2), '/api/a/b')
  assert.ok(sharedPrefixSet(['/api/a/b'], 1).has('/api/a'))
})

test('T5b 共享端点相对路径归一(门 300 假阳性修复)', () => {
  assert.equal(normalizeSharedPath('/srs/streams'), '/api/srs/streams', '相对字面量按 resolveUrl 补 /api')
  assert.equal(normalizeSharedPath('/ai/history${buildQs({ a: 1 })}'), '/api/ai/history/:param')
  assert.equal(normalizeSharedPath('/api/a/b?x=1'), '/api/a/b')
  assert.equal(normalizeSharedPath('srs/streams'), null, '非斜杠开头不是端点')
  assert.equal(normalizeSharedPath('/api/(.*)'), null, '正则 matcher 不是端点')
  // extractSharedEndpoints 只收调用参数位上的相对路径,普通字符串不误收
  const shared = extractSharedEndpoints('/nonexistent', {
    listFiles: () => ['packages/api-client/src/endpoints/demo.ts'],
    readFile: () =>
      "export const a = () => fetchApi('/srs/streams')\nexport const b = 'views/not-api'\nexport const c = () => compute('/plain/word')\n",
  })
  assert.ok(shared.paths.includes('/api/srs/streams'))
  assert.ok(!shared.paths.some((p) => p.includes('plain')), '非 fetchApi 调用位的相对串不误收')
})

test('T6 棘轮:未登记 = 红;登记必须 owner + 理由 ≥10 字 + 非 pending', () => {
  const fake = {
    ends: {
      web: { files: 1, filesWithLiteral: 1, rows: [], unknowns: [] },
      rn: { files: 1, filesWithLiteral: 0, rows: [], unknowns: [] },
      mp: { files: 1, filesWithLiteral: 0, rows: [], unknowns: [] },
    },
    unique: { web: ['/api/new'], rn: [], mp: [] },
  }
  const stock = { end: 'web', prefix: '/api/new', baseline: true, verdict: 'platform-only', owner: 'x', reason: '存量已裁决:web 包装层专属链路不可共享' }
  const reg = { end: 'web', prefix: '/api/new', baseline: false, verdict: 'platform-specific', owner: 'x', reason: '平台专属链路无法共享' }
  assert.equal(G.evaluateRatchet(fake, []).reds.length, 1)
  assert.equal(G.evaluateRatchet(fake, [stock]).reds.length, 0)
  assert.equal(G.evaluateRatchet(fake, [{ ...stock, verdict: 'pending' }]).reds.length, 1, '存量 pending 也必须红')
  assert.equal(G.evaluateRatchet(fake, [reg]).reds.length, 0)
  assert.equal(G.evaluateRatchet(fake, [{ ...reg, owner: '' }]).reds.length, 1)
  assert.equal(G.evaluateRatchet(fake, [{ ...reg, reason: '临时' }]).reds.length, 1)
  assert.equal(G.evaluateRatchet(fake, [{ ...reg, verdict: 'pending' }]).reds.length, 1)
  assert.equal(G.evaluateRatchet({ ...fake, unique: { web: [], rn: [], mp: [] } }, [stock]).advisories[0]?.rule, 'R3')
})

test('T7 端到端:真实仓 HEAD 面存量全部在册,门 exit 0 且读数可复现', () => {
  const out = execFileSync(process.execPath, [join(SCRIPTS, 'check-api-endpoint-delta.mjs'), '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  const j = JSON.parse(out)
  assert.equal(j.reds.length, 0)
  assert.ok(j.stats.sharedPaths > 0)
  for (const end of ['web', 'rn', 'mp']) {
    assert.ok(j.stats.ends[end].files > 0)
    assert.ok(j.stats.ends[end].occurrences > 0)
  }
  const ledger = readFileSync(LEDGER, 'utf8').trim().split('\n').map(JSON.parse)
  assert.ok(ledger.length > 0)
  assert.equal(ledger.reduce((a, r) => a + r.occurrenceCount, 0) >= ledger.length, true)
  assert.ok(ledger.every((r) => r.baseline === true && r.depth === 1), '存量台账必须全 baseline 且口径固定')

  // 共享端点清单来自真源:每条都必须落在 packages/api-client/src/endpoints 下
  const shared = extractSharedEndpoints(ROOT)
  assert.ok(shared.paths.length > 0)
  assert.ok(shared.occurrences.every((o) => o.file.startsWith('packages/api-client/src/endpoints/')))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
