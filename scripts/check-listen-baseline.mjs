// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI,需 console 输出诊断信息 */
/**
 * check-listen-baseline.mjs — RP-6(L15/P0)监听面基线静态审计门
 *
 * 判定边界(诚实纪律,§0.3「没判不写成判过」):
 *   本门只判定**静态可判**的那一份——「默认回环绑定的源码基线在位、且不能被悄悄回退;
 *   生产源码没有全网卡裸监听/文件明文密码/入站明文 Basic」。它**不**宣称"运行时没有
 *   0.0.0.0 监听端口":那需要真机 netstat/nssm 采集(check-service-baseline.mjs 在部署态做),
 *   静态门看不到进程实际绑定。把静态基线完整写成运行时无暴露就是假绿。
 *
 * 判据(全部去注释后判定,注释里出现不算):
 *   回环绑定基线(缺任一/被改成 0.0.0.0 ⇒ 判红):
 *     B1 apps/api/src/config/index.ts   HOST: z.string().default('127.0.0.1')
 *     B2 apps/api/src/index.ts          const HOST = process.env.HOST ?? '127.0.0.1'
 *     B3 apps/cli/src/lib/sso.ts        const CALLBACK_HOST = '127.0.0.1'
 *     B4 apps/cli/src/server/http-server.ts 默认 host 回环(注释声明 + 实现)
 *     B5 apps/api/src/worker-entry.ts   healthServer.listen(..., '127.0.0.1', ...)
 *   禁止项(被引入 ⇒ 判红):
 *     X2 生产源码出现 HOST/CALLBACK_HOST/bindHost/listenHost 硬编码 0.0.0.0 的赋值
 *     X3 生产配置出现文件明文密码(password|passwd 后接长字符串字面量)
 *     X4 入站明文 Basic(req.header('authorization') 含 Basic 校验)——出站调第三方合法
 *   (裸 listen(port) 无 host 这一型不判:仓内有大量合法单参数 listen(0) 测试夹具,
 *    静态区分生产/测试易误报;该型由运行态 check-service-baseline.mjs 兜底)
 *   策略清单:
 *     P1 docs/security/listen-surface-policy.md 在位且含"全网卡监听+明文密码+明文 Basic"禁令
 *
 * 口径:RP-4 已交付凭据进 OS keyring/DPAPI(credential-vault),本门不重复判;
 *   HTTP Basic 在仓内命中(paypal/ai-vendors/im-gateway)全是**出站**调第三方,非本服务入站,合法。
 *
 * 自失效:关键文件缺任一 / present 锚点不在 / absent 被引入 / 生产源枚举不足 ⇒ 判红;
 *   取不到 face 正文 ⇒ 未判定(exit 2),绝不静默绿。
 *
 * 取材面:默认 HEAD blob,--staged 判索引,--worktree 人工排查。
 * 用法: node scripts/check-listen-baseline.mjs [--head|--staged|--worktree|--self-test]
 */

import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Undetermined, catBatch, gitRaw, listFaceFiles, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

export const API_CONFIG = 'apps/api/src/config/index.ts'
export const API_INDEX = 'apps/api/src/index.ts'
export const CLI_SSO = 'apps/cli/src/lib/sso.ts'
export const CLI_HTTP = 'apps/cli/src/server/http-server.ts'
export const WORKER = 'apps/api/src/worker-entry.ts'
export const POLICY = 'docs/security/listen-surface-policy.md'
/** 生产 ts 源扫描根(用于 X1-X4 禁止项) */
export const SCAN_PATHS = ['apps/api/src', 'apps/cli/src']
export const MIN_TS_FILES = 40

export const PRESENT_CHECKS = Object.freeze([
  { id: 'B1-api-config', file: API_CONFIG, re: /HOST:\s*z\.string\(\)\.default\(\s*'127\.0\.0\.1'\s*\)/, label: 'api config HOST 默认回环' },
  { id: 'B2-api-index', file: API_INDEX, re: /const\s+HOST\s*=\s*process\.env\.HOST\s*\?\?\s*'127\.0\.0\.1'/, label: 'api index HOST 默认回环' },
  { id: 'B3-cli-sso', file: CLI_SSO, re: /const\s+CALLBACK_HOST\s*=\s*'127\.0\.0\.1'/, label: 'cli SSO 回调默认回环' },
  { id: 'B5-worker', file: WORKER, re: /healthServer\.listen\([^)]*'127\.0\.0\.1'/, label: 'worker 健康检查回环' },
  { id: 'P1-policy', file: POLICY, re: /全网卡监听[^\n]{0,40}明文密码[^\n]{0,40}明文\s*Basic/, label: '网络策略评审清单禁令' },
])

/**
 * 禁止项:在生产 ts 源上判。scope=any-file,任一生产文件命中即红(测试夹具排除)。
 * 这些是差值判据——当前全部不命中(绿),被引入才红。
 */
export const ABSENT_CHECKS = Object.freeze([
  { id: 'X2-hardcode-any', re: /(?:HOST|CALLBACK_HOST|bindHost|listenHost)\s*(?::[^=]+)?=\s*['"]0\.0\.0\.0['"]/, label: '生产源码硬编码 0.0.0.0 绑定' },
  { id: 'X3-file-plaintext-password', re: /(?:password|passwd)\s*[:=]\s*['"][^'"$\n]{8,}['"]/, label: '生产配置明文密码字面量' },
  { id: 'X4-inbound-basic', re: /req\.header\(\s*['"]authorization['"]\s*\)[^\n]{0,60}(?:startsWith|includes)\(\s*['"]Basic\s+/i, label: '入站明文 Basic 校验' },
])

/** 去注释但保留字符串字面量。 */
export function stripComments(source) {
  const src = String(source ?? '')
  let out = ''
  let i = 0
  let state = 'code'
  let quote = ''
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (state === 'code') {
      if (c === '/' && n === '/') { state = 'line'; i += 2; continue }
      if (c === '/' && n === '*') { state = 'block'; i += 2; continue }
      if (c === '"' || c === "'" || c === '`') { state = 'str'; quote = c; out += c; i += 1; continue }
      out += c
      i += 1
    } else if (state === 'line') {
      if (c === '\n') { state = 'code'; out += '\n' }
      i += 1
    } else if (state === 'block') {
      if (c === '*' && n === '/') { state = 'code'; i += 2; continue }
      if (c === '\n') out += '\n'
      i += 1
    } else {
      out += c
      if (c === '\\' && i + 1 < src.length) { out += src[i + 1]; i += 2; continue }
      if (c === quote) state = 'code'
      i += 1
    }
  }
  return out
}

const isProdTs = (rel) => /\.ts$/.test(rel) && !rel.includes('__tests__') && !/\.test\./.test(rel) && !/\.spec\./.test(rel)

/** 纯判据。files: [{rel, source}]。 */
export function evaluate({ files, minTs = MIN_TS_FILES }) {
  const violations = []
  const list = Array.isArray(files) ? files : []
  const tsFiles = list.filter((f) => isProdTs(f.rel))
  if (tsFiles.length < minTs) {
    return {
      ok: false,
      violations: [{ kind: 'empty-face', file: '(none)', detail: `生产 ts 源只枚举到 ${tsFiles.length} 个(<${minTs}),扫描器可能失明` }],
      stats: { files: list.length, ts: tsFiles.length, passed: 0, total: PRESENT_CHECKS.length + ABSENT_CHECKS.length },
    }
  }
  const byRel = new Map(list.map((f) => [f.rel, stripComments(f.source)]))
  const keyFiles = [...new Set([...PRESENT_CHECKS.map((c) => c.file), ...ABSENT_CHECKS.map(() => null)].filter(Boolean))]
  for (const rel of keyFiles) {
    if (!byRel.has(rel)) violations.push({ kind: 'file-missing', file: rel, detail: '关键监听面文件不在被审面' })
  }
  for (const c of PRESENT_CHECKS) {
    const code = byRel.get(c.file)
    if (code === undefined) continue
    if (!c.re.test(code)) violations.push({ kind: 'anchor-missing', file: c.file, detail: `${c.id}: ${c.label}` })
  }
  for (const c of ABSENT_CHECKS) {
    for (const f of tsFiles) {
      if (c.re.test(f.source)) {
        violations.push({ kind: 'unsafe-introduced', file: f.rel, detail: `${c.id}: ${c.label}` })
        break
      }
    }
  }
  return {
    ok: violations.length === 0,
    violations,
    stats: {
      files: list.length,
      ts: tsFiles.length,
      passed: PRESENT_CHECKS.length + ABSENT_CHECKS.length
        - violations.filter((v) => v.kind === 'anchor-missing' || v.kind === 'unsafe-introduced').length,
      total: PRESENT_CHECKS.length + ABSENT_CHECKS.length,
    },
  }
}

function readFace(root, face) {
  let rels = listFaceFiles(root, face, { paths: SCAN_PATHS })
  if (face === 'worktree') {
    const untracked = String(gitRaw(['ls-files', '--others', '--exclude-standard', '-z', '--', ...SCAN_PATHS], root))
      .split('\0').filter(Boolean)
    rels = [...new Set([...rels, ...untracked])]
  }
  rels = [...new Set([...rels, ...PRESENT_CHECKS.map((c) => c.file)])]
  const specs = rels.map((rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`))
  let sources
  if (face === 'worktree') sources = rels.map((rel) => readWorktreeFile(root, rel))
  else {
    const blobs = catBatch(root, specs)
    sources = specs.map((spec) => blobs.get(spec) ?? null)
  }
  const missing = rels.filter((_, i) => sources[i] === null || sources[i] === undefined)
  if (missing.length) throw new Undetermined(`${face} 面有 ${missing.length} 个文件取不到正文(首:${missing[0]}),不回落其它面`)
  return rels.map((rel, i) => ({ rel, source: sources[i] }))
}

/** 夹具:present 锚点给真行,absent 默认不出现,补足 ts 源数。 */
export function fixture({ omit = [], inject = [], commentOut = [] } = {}) {
  const content = {
    [API_CONFIG]: ["export const config = {", "  HOST: z.string().default('127.0.0.1'),", "}"],
    [API_INDEX]: ["const PORT = 8802", "const HOST = process.env.HOST ?? '127.0.0.1'", "server.listen({ port: PORT, host: HOST })"],
    [CLI_SSO]: ["const CALLBACK_HOST = '127.0.0.1';", "server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {})"],
    [WORKER]: ["healthServer.listen(healthPort, '127.0.0.1', () => {})"],
    [CLI_HTTP]: ["export class AgentServer { host = '127.0.0.1' }"],
    [POLICY]: ["# 监听面基线", "- 禁止全网卡监听 + 文件内明文密码 + 明文 Basic 组合(HTTP Basic 入站)"],
  }
  for (const id of commentOut) {
    const c = PRESENT_CHECKS.find((x) => x.id === id)
    assert.ok(c, `unknown present anchor ${id}`)
    const lines = content[c.file]
    const idx = lines.findIndex((l) => c.re.test(l))
    assert.ok(idx >= 0, `fixture 缺锚点行 ${id}`)
    lines[idx] = `// ${lines[idx]}`
  }
  for (const id of omit) {
    const c = PRESENT_CHECKS.find((x) => x.id === id)
    assert.ok(c, `unknown present anchor ${id}`)
    const lines = content[c.file]
    const idx = lines.findIndex((l) => c.re.test(l))
    assert.ok(idx >= 0, `fixture 缺锚点行 ${id}`)
    lines.splice(idx, 1)
  }
  const out = Object.entries(content).map(([rel, lines]) => ({ rel, source: lines.join('\n') }))
  for (const { rel, line } of inject) out.push({ rel, source: line })
  // 补足生产 ts 源数
  for (let i = 0; out.filter((f) => isProdTs(f.rel)).length < MIN_TS_FILES; i += 1) {
    out.push({ rel: `apps/api/src/filler_${i}.ts`, source: 'export const x = 1' })
  }
  return out
}

function selfTest() {
  const green = evaluate({ files: fixture() })
  assert.equal(green.ok, true, `绿夹具应通过:${JSON.stringify(green.violations)}`)

  for (const c of PRESENT_CHECKS) {
    const red = evaluate({ files: fixture({ omit: [c.id] }) })
    assert.equal(red.ok, false, `删掉 ${c.id} 必须判红`)
    assert.ok(red.violations.some((v) => v.kind === 'anchor-missing' && v.detail.startsWith(c.id)), `${c.id}`)
  }

  const BAD = {
    'X2-hardcode-any': "const HOST = '0.0.0.0'",
    'X3-file-plaintext-password': "const password = 'supersecret123'",
    'X4-inbound-basic': "if (req.header('authorization')?.startsWith('Basic ')) return false",
  }
  for (const [id, line] of Object.entries(BAD)) {
    const red = evaluate({ files: fixture({ inject: [{ rel: 'apps/api/src/evil.ts', line }] }) })
    assert.equal(red.ok, false, `引入 ${id} 必须判红`)
    assert.ok(red.violations.some((v) => v.kind === 'unsafe-introduced' && v.detail.startsWith(id)), id)
  }

  // 反假绿:present 锚点写进注释不算
  const commented = evaluate({ files: fixture({ commentOut: ['B1-api-config'] }) })
  assert.ok(commented.violations.some((v) => v.detail.startsWith('B1-api-config')), '注释里的 HOST 默认不得算数')
  // 反假绿:测试夹具里的 0.0.0.0 不算禁止项
  const testFixture = fixture({ inject: [{ rel: 'apps/api/src/routes/__tests__/x.test.ts', line: "const HOST = '0.0.0.0'" }] })
  assert.equal(evaluate({ files: testFixture }).ok, true, '测试夹具的 0.0.0.0 不得算生产暴露')
  // 反假绿:空面 / 缺关键文件
  assert.equal(evaluate({ files: [] }).violations[0].kind, 'empty-face')
  const missing = fixture().filter((f) => f.rel !== API_INDEX)
  while (missing.filter((f) => isProdTs(f.rel)).length < MIN_TS_FILES) {
    missing.push({ rel: 'apps/api/src/extra.ts', source: 'export const y = 2' })
  }
  assert.ok(evaluate({ files: missing }).violations.some((v) => v.kind === 'file-missing'))

  console.log('✅ check-listen-baseline self-test: 绿夹具 + 5 present/3 absent 逐条变异 + 注释不算/测试夹具豁免/空面/缺文件 全部咬合')
}

function main(argv) {
  if (argv.includes('--self-test')) { selfTest(); return 0 }
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (picked.error) { console.error(`❌ check-listen-baseline: ${picked.error}(未判定,exit 2)`); return 2 }
  let result
  try { result = evaluate({ files: readFace(ROOT, picked.face) }) }
  catch (e) { console.error(`❌ check-listen-baseline: ${e.message}(未判定,exit 2)`); return 2 }
  if (result.ok) {
    console.log(`✅ check-listen-baseline: 监听面基线 ${result.stats.passed}/${result.stats.total} 在位,扫描 ${result.stats.ts} 个生产 ts 源(面:${picked.face})`)
    console.log('   ℹ️  静态基线完整 ≠ 运行时无 0.0.0.0 监听:后者需真机 netstat/nssm 采集(check-service-baseline.mjs),本门不伪称')
    return 0
  }
  console.error(`❌ check-listen-baseline: ${result.violations.length} 处监听面缺口(面:${picked.face})`)
  for (const v of result.violations) console.error(`  - [${v.kind}] ${v.file}: ${v.detail}`)
  return 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
