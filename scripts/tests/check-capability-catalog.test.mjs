// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-capability-catalog.test.mjs — 能力目录守门的单元测试
 *
 * 遵循 AGENTS.md §22c/§22d:核心逻辑一律 `import { __test__ }` 源脚本,
 * **不在测试里复制任何实现**(无镜像常量);CLI 退出码通过 spawn 真实脚本 +
 * CAPABILITY_CATALOG_ROOT 指向临时 fixture 树来验证(不触碰真实业务文件)。
 *
 * 覆盖四类场景:已覆盖 / 未覆盖 / platform 泄漏 / 产物漂移,外加
 * declareCapability 迁移期统计、插件级 addHook 覆盖、反向核对(D)。
 *
 * 运行:node --test scripts/tests/check-capability-catalog.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-capability-catalog.mjs')

// §22c:直接 import 源脚本导出的核心函数(import 时 isDirectRun=false,无副作用)
import { __test__ as src } from '../check-capability-catalog.mjs'

const ENTRIES = src.parseCatalogEntries(src.SAMPLE_CATALOG)
const RATE = src.parseRateProfiles(src.SAMPLE_CATALOG)

function mkFile(rel, source) {
  return { relPath: rel, analysis: src.analyzeRouteFile({ relPath: rel, source, prefixes: ['/v1'] }) }
}
function run(files) {
  return src.evaluate({ entries: ENTRIES, rateProfiles: RATE, artifact: src.sampleArtifact(), artifactError: null, routeFiles: files, registry: null })
}

// ─── 1. 目录源码解析(不依赖 tsx,纯文本解析) ───────────────────
test('parseCatalogEntries: 解析 scope/routes/tools 与布尔字段', () => {
  assert.equal(ENTRIES.length, 2)
  const chat = ENTRIES.find((e) => e.scope === 'chat:write')
  assert.deepEqual(chat.routes, ['POST /v1/chat/completions'])
  assert.equal(chat.billable, true)
  const pub = ENTRIES.find((e) => e.scope === 'publish:operate')
  assert.equal(pub.dataClass, 'platform')
  assert.equal(pub.thirdPartyEligible, false)
  assert.deepEqual(pub.tools, ['publish_article'])
})

test('parseRateProfiles: 数字下划线归一(50_000 → 50000)', () => {
  assert.equal(RATE.low.dailyCalls, 50000)
  assert.equal(RATE.low.rpm, 600)
})

test('stripComments: 注释里的 server.get 不算注册点', () => {
  const commented = "// server.get('/x', { preHandler: [requireCapability('chat:write')] }, h)\n/* server.post('/y', h) */\n"
  assert.equal(src.extractHandlers(src.stripComments(commented)).length, 0)
  assert.equal(src.extractHandlers(src.stripComments("server.post('/y', h)\n")).length, 1)
})

// ─── 2. 场景 A:产物漂移 ─────────────────────────────────────
test('A: 产物字段漂移 → ARTIFACT_DRIFT;产物缺失 → ARTIFACT_MISSING', () => {
  const drifted = src.compareWithCatalog(ENTRIES, RATE, src.sampleArtifact({ billable: false }))
  assert.ok(drifted.drift.some((d) => d.scope === 'chat:write' && d.field === 'billable'))
  const consistent = src.compareWithCatalog(ENTRIES, RATE, src.sampleArtifact())
  assert.equal(consistent.drift.length, 0)
  assert.equal(consistent.missing.length, 0)
  assert.equal(consistent.extra.length, 0)
  const report = run([])
  assert.equal(report.failures.length, 0, '产物一致时不应有失败')
  const missing = src.evaluate({ entries: ENTRIES, rateProfiles: RATE, artifact: null, artifactError: null, routeFiles: [], registry: null })
  assert.ok(missing.failures.some((f) => f.code === 'ARTIFACT_MISSING'))
  assert.ok(missing.failures.some((f) => f.code === 'REGENERATE_HINT'))
})

test('A: 产物多出/缺少 scope 各自报错', () => {
  const extra = src.compareWithCatalog(ENTRIES, RATE, { capabilities: [...src.sampleArtifact().capabilities, { scope: 'ghost:read', domain: 'chat', dataClass: 'compute', risk: 'low', billable: false, thirdPartyEligible: true, idempotencyRequired: false, description: '', routes: [], tools: [], rate: RATE.low }] })
  assert.deepEqual(extra.extra, ['ghost:read'])
  const partial = src.compareWithCatalog(ENTRIES, RATE, { capabilities: [src.sampleArtifact().capabilities[0]] })
  assert.deepEqual(partial.missing, ['publish:operate'])
})

// ─── 3. 场景 B:未覆盖端点 ───────────────────────────────────
test('B: 未接能力闸的 handler → ENDPOINT_UNCOVERED 并带 method/path/行号', () => {
  const report = run([mkFile('apps/api/src/routes/v1-a.ts', "export default async (server) => {\n  server.post('/chat/completions', async () => {})\n}")])
  const failure = report.failures.find((f) => f.code === 'ENDPOINT_UNCOVERED')
  assert.ok(failure, '应报未覆盖')
  assert.equal(failure.file, 'apps/api/src/routes/v1-a.ts')
  assert.deepEqual(failure.endpoints.map((e) => [e.method, e.path]), [['POST', '/v1/chat/completions']])
  assert.equal(failure.endpoints[0].registeredAs, '/chat/completions')
  assert.equal(typeof failure.endpoints[0].line, 'number')
})

test('B: rules 变量 + 内联 requireCapability 算覆盖,裸 handler 不算', () => {
  const source = [
    "const gate = requireCapabilityRules([{ methods: ['POST'], pattern: /^\\/v1\\/chat\\/completions$/, scope: 'chat:write' }])",
    'export default async (server) => {',
    "  server.post('/chat/completions', { preHandler: [requireApiKeyAuth, gate] }, async () => {})",
    "  server.get('/chat/sessions', { preHandler: [requireCapability('chat:write')] }, async () => {})",
    "  server.get('/chat/naked', async () => {})",
    '}',
  ].join('\n')
  const report = run([mkFile('apps/api/src/routes/v1-b.ts', source)])
  assert.equal(report.stats.handlers, 3)
  assert.equal(report.stats.covered, 2)
  assert.equal(report.stats.uncovered, 1)
  assert.deepEqual(report.failures[0].endpoints.map((e) => e.path), ['/v1/chat/naked'])
})

test('B: 插件级 addHook(requireCapabilityRules) 覆盖整族 handler', () => {
  const source = "export default async (server) => {\n  server.addHook('preHandler', requireCapabilityRules([{ pattern: /^\\/v1\\/x$/, scope: 'chat:write' }]))\n  server.get('/x', async () => {})\n}"
  const report = run([mkFile('apps/api/src/routes/v1-h.ts', source)])
  assert.equal(report.stats.uncovered, 0)
  assert.equal(report.stats.covered, 1)
})

test('B: declareCapability 算覆盖但计入 warn 统计(迁移期登记)', () => {
  const source = "export default async (server) => {\n  server.post('/d', { preHandler: [declareCapability('chat:write')] }, async () => {})\n}"
  const report = run([mkFile('apps/api/src/routes/v1-d.ts', source)])
  assert.equal(report.stats.uncovered, 0)
  assert.equal(report.stats.declareOnly, 1)
  assert.ok(report.warnings.some((w) => w.code === 'DECLARE_ONLY'))
})

// ─── 4. 场景 C:scope 语义 ───────────────────────────────────
test('C: platform / 非第三方 scope 进入 /v1 rules 表 → 失败', () => {
  const source = "export default async (server) => {\n  server.addHook('preHandler', requireCapabilityRules([{ pattern: /^\\/v1\\/publish$/, scope: 'publish:operate' }]))\n  server.post('/publish', async () => {})\n}"
  const report = run([mkFile('apps/api/src/routes/v1-p.ts', source)])
  assert.ok(report.failures.some((f) => f.code === 'PLATFORM_IN_THIRD_PARTY_RULES'))
  assert.equal(report.stats.platformLeaks, 1)
})

test('C: 同一非第三方 scope 走 /api 面 rules → 只 warn 不失败', () => {
  const source = "export default async (server) => {\n  server.addHook('preHandler', requireCapabilityRules([{ pattern: /^\\/api\\/publish$/, scope: 'publish:operate' }]))\n  server.post('/publish', async () => {})\n}"
  const report = run([mkFile('apps/api/src/routes/v1-q.ts', source)])
  assert.equal(report.failures.length, 0)
  assert.ok(report.warnings.some((w) => w.code === 'M2M_FORBIDDEN_GATE'))
})

test('C: 闸口引用目录外 scope → SCOPE_UNREGISTERED', () => {
  const source = "export default async (server) => {\n  server.post('/z', { preHandler: [requireCapability('nope:read')] }, async () => {})\n}"
  const report = run([mkFile('apps/api/src/routes/v1-u.ts', source)])
  assert.ok(report.failures.some((f) => f.code === 'SCOPE_UNREGISTERED' && /nope:read/.test(f.message)))
})

// ─── 5. 场景 D:反向核对 ─────────────────────────────────────
test('D: 目录声明但代码无注册点 → 仅 warn;命中注册点则不 warn', () => {
  const registry = [{ file: 'apps/api/src/routes/v1-a.ts', method: 'POST', candidates: ['/v1/chat/completions'] }]
  const report = src.evaluate({ entries: ENTRIES, rateProfiles: RATE, artifact: src.sampleArtifact(), artifactError: null, routeFiles: [], registry })
  const stale = report.warnings.filter((w) => w.code === 'DECLARED_ROUTE_NOT_FOUND')
  assert.equal(stale.length, 1, 'chat:write 已命中,publish:operate 应报腐化')
  assert.ok(/POST \/api\/publish\/\*/.test(stale[0].message))
  assert.equal(report.stats.declaredRoutes, 2)
  assert.equal(report.stats.staleDeclaredRoutes, 1)
})

test('routesMatch: 参数段/尾部通配两侧均视为占位', () => {
  assert.ok(src.routesMatch('/v1/agents/:id', '/v1/agents/:agentId'))
  assert.ok(src.routesMatch('/api/publish/*', '/api/publish/weibo'))
  assert.ok(!src.routesMatch('/v1/agents', '/v1/agents/:id'))
  assert.deepEqual(src.parseDeclaredRoute('GET /v1/models'), { method: 'GET', path: '/v1/models' })
  assert.equal(src.joinPath('/v1', '/assistants'), '/v1/assistants')
  assert.equal(src.joinPath('', '/v1/mcp/tools'), '/v1/mcp/tools')
})

test('V1_ROUTE_FILE_RE: 只认 routes 与 routes/other 下的 v1-*.ts', () => {
  assert.ok(src.V1_ROUTE_FILE_RE.test('apps/api/src/routes/v1-public.ts'))
  assert.ok(src.V1_ROUTE_FILE_RE.test('apps/api/src/routes/other/v1-tools-routes.ts'))
  assert.ok(!src.V1_ROUTE_FILE_RE.test('apps/api/src/routes/billing.ts'))
  assert.ok(!src.V1_ROUTE_FILE_RE.test('apps/api/src/routes/admin/v1-x.ts'))
})

// ─── 6. CLI 退出码(临时 fixture 树,不读真实业务文件) ─────────
function makeFixtureTree(routeSource) {
  const root = mkdtempSync(join(tmpdir(), 'ihui-capability-'))
  mkdirSync(join(root, 'packages/types/src'), { recursive: true })
  mkdirSync(join(root, 'packages/types/generated'), { recursive: true })
  mkdirSync(join(root, 'apps/api/src/routes'), { recursive: true })
  writeFileSync(join(root, 'packages/types/src/capability-catalog.ts'), src.SAMPLE_CATALOG, 'utf8')
  writeFileSync(join(root, 'packages/types/generated/capabilities.json'), JSON.stringify(src.sampleArtifact(), null, 2), 'utf8')
  writeFileSync(join(root, 'apps/api/src/routes/v1-demo.ts'), routeSource, 'utf8')
  return root
}
function runCli(root, extraArgs = []) {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, ...extraArgs], {
    encoding: 'utf8',
    env: { ...process.env, CAPABILITY_CATALOG_ROOT: root },
    windowsHide: true,
  })
  return r
}

test('CLI: 未覆盖端点 → exit 1 并在 --json 中给出清单', () => {
  const root = makeFixtureTree("export default async (server) => {\n  server.post('/chat/completions', async () => {})\n}")
  try {
    const r = runCli(root, ['--json'])
    assert.equal(r.status, 1)
    const parsed = JSON.parse(r.stdout)
    assert.equal(parsed.stats.uncovered, 1)
    assert.ok(parsed.failures.some((f) => f.code === 'ENDPOINT_UNCOVERED'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('CLI: 全部登记 + 产物一致 → exit 0', () => {
  const root = makeFixtureTree("export default async (server) => {\n  server.post('/chat/completions', { preHandler: [requireCapability('chat:write')] }, async () => {})\n}")
  try {
    const r = runCli(root, ['--json'])
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.equal(JSON.parse(r.stdout).stats.uncovered, 0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('CLI: 产物漂移 → exit 1 并提示重新生成', () => {
  const root = makeFixtureTree("export default async (server) => {\n  server.post('/chat/completions', { preHandler: [requireCapability('chat:write')] }, async () => {})\n}")
  try {
    writeFileSync(join(root, 'packages/types/generated/capabilities.json'), JSON.stringify({ capabilities: [] }), 'utf8')
    const r = runCli(root, ['--json'])
    assert.equal(r.status, 1)
    assert.ok(r.stdout.includes('ARTIFACT_MISSING_SCOPES'))
    assert.ok(r.stdout.includes('REGENERATE_HINT'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('CLI: --self-test 内置断言全绿(exit 0);产物缺失也判失败', () => {
  const selfTest = spawnSync(process.execPath, [SCRIPT_PATH, '--self-test'], { encoding: 'utf8', windowsHide: true })
  assert.equal(selfTest.status, 0, selfTest.stdout + selfTest.stderr)
  assert.ok(selfTest.stdout.includes('全部断言通过'))
  const root = makeFixtureTree('export default async (server) => {}')
  try {
    rmSync(join(root, 'packages/types/generated/capabilities.json'))
    assert.ok(!existsSync(join(root, 'packages/types/generated/capabilities.json')))
    const r = runCli(root, ['--json'])
    assert.equal(r.status, 1)
    assert.ok(r.stdout.includes('ARTIFACT_MISSING'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('CLI: --staged 且无 v1 路由文件暂存时不判定端点覆盖(用环境变量注入清单)', () => {
  const root = makeFixtureTree("export default async (server) => {\n  server.post('/chat/completions', async () => {})\n}")
  try {
    const r = spawnSync(process.execPath, [SCRIPT_PATH, '--staged', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, CAPABILITY_CATALOG_ROOT: root, CAPABILITY_CATALOG_FILES: 'README.md' },
      windowsHide: true,
    })
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.equal(JSON.parse(r.stdout).stats.filesScanned, 0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
