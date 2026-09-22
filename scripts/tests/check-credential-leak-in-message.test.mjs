// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(AGENTS.md §22c):直接 import 源脚本的 __test__,禁止把源函数复制一份到本文件。
// 覆盖:判据样例表 / stringify 取参 / 括号与模板扫描 / 声明解析 / 凭据语义分类 /
//       基线豁免生效 / 扫描根过滤 / main 的退出码契约(必须按返回值退出)。
// 2026-09-23 追加两类回归:① 豁免 key 不含行号(上方插行仍豁免,实参改掉仍报);
//       ② 跨行同一物理外泄点只计一次,且不相交的不同调用/不同凭据实参不被顶掉。
import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as G } from '../check-credential-leak-in-message.mjs'

test('§22c 锚点:__test__ 暴露判据函数且样例表非空', () => {
  for (const k of [
    'scanSource',
    'evalCase',
    'classifyStringifyArg',
    'findStringifyArgs',
    'main',
    'readBaselineRaw',
  ]) {
    assert.ok(typeof G[k] === 'function', `__test__ 缺少 ${k}`)
  }
  assert.ok(Array.isArray(G.SELFTEST_CASES) && G.SELFTEST_CASES.length >= 10)
})

test('判据样例表逐条与 want 一致(含"非凭据变量不拦"的反例)', () => {
  for (const c of G.SELFTEST_CASES) {
    assert.equal(G.evalCase(c.src), c.want, `样例失败: ${c.name}`)
  }
})

test('findStringifyArgs:嵌套括号 + 多实参只取被序列化对象', () => {
  const args = G.findStringifyArgs(`error(502, 'x' + JSON.stringify({ a: f(1, 2) }, null, 2))`)
  assert.deepEqual(args, ['{ a: f(1, 2) }'])
})

test('firstArgOf:字符串内的逗号不参与顶层切分', () => {
  assert.equal(G.firstArgOf(`'a,b', c`), `'a,b'`)
  assert.equal(G.firstArgOf(`data, { space: 2 }`), 'data')
})

test('parenDepth:模板插值与注释内的圆括号不改变净深度', () => {
  assert.equal(G.parenDepth('error(502, `f(${g(1)}) x`)'), 0)
  assert.equal(G.parenDepth('a(1 // ) (\n'), 1)
})

test('collectDeclarations + resolveDeclaredRhs:取使用点之前最近一次声明', () => {
  const src = ['const tokenData = await r.json()', 'const tokenData2 = 1', 'use(tokenData)'].join(
    '\n',
  )
  const decls = G.collectDeclarations(src)
  assert.match(String(G.resolveDeclaredRhs(decls, 'tokenData', 3)), /await r\.json/)
  assert.equal(G.resolveDeclaredRhs(decls, 'nope', 3), null)
})

test('classifyStringifyArg:四种凭据路径命中,普通错误体不命中', () => {
  const decls = G.collectDeclarations(
    ['const body = await resp.json()', 'const credentialPayload = x'].join('\n'),
  )
  const ok = [
    ['tokenData', decls, 3],
    ['{ access_token: t }', decls, 3],
    ['auth.client_secret', decls, 3],
    ['credentialPayload', decls, 3],
  ]
  for (const [arg, d, line] of ok)
    assert.equal(G.classifyStringifyArg(arg, d, line), true, `应命中: ${arg}`)
  assert.equal(G.classifyStringifyArg('body', decls, 3), false, '非凭据声明右侧不应命中')
  assert.equal(G.classifyStringifyArg('errData', decls, 3), false)
  assert.equal(G.classifyStringifyArg('genData', decls, 3), false)
})

test('基线豁免:命中 key 后同一违规被放行(存量豁免能力)', () => {
  const src = "return reply.status(502).send(error(502, 'x' + JSON.stringify(tokenData)))"
  const hit = G.scanSource(src, 'apps/api/src/routes/demo.ts')
  assert.equal(hit.violations.length, 1)
  const key = `apps/api/src/routes/demo.ts::${hit.violations[0].snippet}`
  const after = G.scanSource(src, 'apps/api/src/routes/demo.ts', new Set([key]))
  assert.equal(after.violations.length, 0)
})

test('扫描根过滤:候选文件全部落在 apps/ 与 packages/,测试代码单独分桶为 warn', () => {
  const files = G.listCandidatesToScan(false)
  assert.ok(files.length > 100, 'git ls-files 未真正运行(不得静默通过)')
  for (const f of files) {
    assert.ok(/^(apps|packages)\//.test(f), `越出扫描根: ${f}`)
    assert.doesNotMatch(f, /(\.d\.ts|node_modules|[/\\]dist[/\\]|[/\\]tests?[/\\]|[/\\]e2e[/\\])/)
  }
  const bucketed = G.partitionByTestPath([
    { file: 'apps/api/src/routes/demo.ts' },
    { file: 'apps/cli/benchmarks/bench.test.ts' },
    { file: 'packages/api-client/tests/x.ts' },
  ])
  assert.deepEqual(
    bucketed.prod.map((v) => v.file),
    ['apps/api/src/routes/demo.ts'],
  )
  assert.equal(bucketed.test.length, 2)
})

test('现网零高危:被修的厂商代理文件不得被本门判为违规(防误伤 35 处历史透传)', () => {
  const rel = 'apps/api/src/routes/ai-vendors/proxy-extended-media3.ts'
  const r = G.scanSource(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'), rel)
  assert.equal(r.violations.length, 0)
  assert.ok(r.candidates.length > 0, '该文件本应产生低置信候选(候选通道失效即为假门)')
})

test('main 按返回值给出退出码(--self-test/--help 均为 0)', async () => {
  assert.equal(await G.main(['--self-test']), 0)
  assert.equal(await G.main(['--help']), 0)
})

test('凭据语义词表覆盖规格要求的 11 个词根', () => {
  for (const w of [
    'token',
    'secret',
    'credential',
    'password',
    'apikey',
    'api_key',
    'bearer',
    'refresh_token',
    'access_token',
    'id_token',
    'client_secret',
  ]) {
    assert.ok(G.CRED_SEMANTIC_RE.test(w), `词表缺 ${w}`)
  }
  assert.ok(G.CRED_LITERAL_RE.test('bad refresh_token here'))
  assert.ok(!G.CRED_LITERAL_RE.test('bad token here'), '字面量判据只认三个令牌字段名')
})

// ── 2026-09-23 两个实测缺陷的回归用例(判据一律走权威入口 scanSource,不自拼内部件) ──

const DRIFT_FILE = 'apps/api/src/routes/drift.ts'
const DRIFT_BASE =
  'const keep = 1\nreturn reply.status(502).send(error(502, `令牌失败 ${JSON.stringify(tokenData)}`))'

test('缺陷1 回归:豁免 key 不含行号 → 调用上方插入行后豁免仍生效', () => {
  const first = G.scanSource(DRIFT_BASE, DRIFT_FILE)
  assert.equal(first.violations.length, 1)
  const key = first.violations[0].key
  assert.equal(key, `${DRIFT_FILE}::stringify-cred-arg|tokenData`, 'key 必须是 路径::kind|证据')
  assert.ok(!/^\d+:|\|\d+:/.test(key), 'key 内不得出现起始行号')

  const drifted = `const a = 1\nconst b = 2\nconst c = 3\n${DRIFT_BASE}`
  // 哨兵 1:未登记豁免时,漂移后仍必须报,且行号已变(证明判据真的解析到了非空凭据实参)
  const raw = G.scanSource(drifted, DRIFT_FILE)
  assert.equal(raw.violations.length, 1, '判据链路失效(空结果)会让下面的豁免断言假通过')
  assert.equal(raw.violations[0].key, key, '同一处外泄在插入行后 key 必须一字不变')
  assert.equal(
    raw.violations[0].line,
    first.violations[0].line + 3,
    '行号确实随插入行发生了漂移(3 行)',
  )
  assert.deepEqual(raw.violations[0].lines, [5], '行号仍要出现在报错数据里(给人看)')
  // 哨兵 2:登记豁免后不再被报
  assert.equal(G.scanSource(drifted, DRIFT_FILE, new Set([key])).violations.length, 0)
})

test('缺陷1 防过宽:凭据实参真被改掉后原豁免不再放行', () => {
  const key = G.scanSource(DRIFT_BASE, DRIFT_FILE).violations[0].key
  const changed = DRIFT_BASE.replace(/tokenData/g, 'tokenDataV2')
  const r = G.scanSource(changed, DRIFT_FILE, new Set([key]))
  assert.equal(r.violations.length, 1, '换了被序列化的凭据对象 = 新的外泄点,不得被旧豁免顶掉')
  assert.equal(r.violations[0].evidence, 'tokenDataV2')
  // 换成非凭据实参 → 降为候选(反例链路哨兵:候选必须真的解析到 errData)
  const downgraded = G.scanSource(DRIFT_BASE.replace(/tokenData/g, 'errData'), DRIFT_FILE)
  assert.equal(downgraded.violations.length, 0)
  assert.ok(
    downgraded.candidates.some((c) => c.arg === 'errData'),
    '候选通道失效即为假门',
  )
})

test('缺陷2 回归:跨行写法的同一物理外泄点只计一次', () => {
  const src =
    '  return reply.status(502).send(\n' +
    '    error(502, `令牌获取失败: ${JSON.stringify(tokenData).slice(0, 400)}`)\n' +
    '  )'
  const ctxCount = G.findStatusContexts(src.split('\n')).length
  const r = G.scanSource(src, 'apps/api/src/routes/dup.ts')
  assert.ok(ctxCount >= 2, `前置事实:${ctxCount} 个 4xx/5xx 起点(不足 2 则本例测不到重复计数)`)
  assert.equal(r.violations.length, 1, '同一物理外泄点必须恰为 1')
  const v = r.violations[0]
  assert.equal(v.evidence, 'tokenData', '哨兵:必须真的解析到凭据实参')
  assert.equal(v.contexts, ctxCount, '被合并的上下文数要在数据里可见')
  assert.deepEqual(v.lines, [1, 2], '两个起点的行号都要留在输出数据里')
  assert.match(v.excerpt, /JSON\.stringify\(tokenData\)/)
})

test('缺陷2 反向:同文件两处同签名但行区间不相交的外泄仍各计一条(不同调用不互相顶掉)', () => {
  const src = [
    'async function a() {',
    "  return reply.status(502).send(error(502, 'x' + JSON.stringify(tokenData)))",
    '}',
    'async function b() {',
    "  return reply.status(502).send(error(502, 'y' + JSON.stringify(tokenData)))",
    '}',
  ].join('\n')
  const r = G.scanSource(src, 'apps/api/src/routes/two.ts')
  assert.equal(r.violations.length, 2)
  assert.deepEqual(
    r.violations.map((v) => v.lines),
    [[2], [5]],
  )
  assert.equal(
    r.violations[0].key,
    r.violations[1].key,
    '同签名共享一条豁免 key(存量整改按签名登记)',
  )
})

test('缺陷2 反向:同一窗口内两个不同凭据实参合并为一条但证据串点名两处', () => {
  const src =
    'return reply.status(502).send(error(502, `a ${JSON.stringify(tokenData)} b ${JSON.stringify(clientSecret)}`))'
  const r = G.scanSource(src, 'apps/api/src/routes/both.ts')
  assert.equal(r.violations.length, 1)
  assert.equal(
    r.violations[0].evidence,
    'clientSecret,tokenData',
    '两处证据都必须进 key,不得只报其一',
  )
})

test('--self-test 的结论必须真的落到退出码上(防打印失败却 exit 0 的假门)', async () => {
  assert.equal(await G.main(['--self-test']), 0)
  const bogus = { name: '故意错判的哨兵样例', src: G.SELFTEST_CASES[0].src, want: 'none' }
  G.SELFTEST_CASES.push(bogus)
  try {
    assert.equal(await G.main(['--self-test']), 1, 'self-test 检出失败必须返回 1')
  } finally {
    G.SELFTEST_CASES.pop()
  }
  assert.equal(await G.main(['--self-test']), 0, '还原后必须回到 0')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
