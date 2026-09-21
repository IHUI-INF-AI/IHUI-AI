// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/e2e-agent-access-never-public.test.mjs
 * —— `e2e-agent-access.mjs` OFF-02a / OFF-02c / OFF-02d 三条 JWT 白名单门禁的镜像测试。
 *
 * 覆盖两件事:
 *  1) **判据与被守门机制同源**:特权 router 根清单与兜底放行写法一律从 `jwt_auth.py` 的元组字面量
 *     动态解析(AGENTS.md §4 教训:手抄表必然漂移)。往清单里加一个新根,守门必须立刻跟着变红。
 *  2) **"运行时无害"不得洗白"静态违规"**:jwt_auth 的 fail-safe 会把 .env 里的 /api/agents/ 在运行时
 *     剔除,但那条配置债只活在 gitignored 的机器态里。故判据函数的签名**不接收**任何"代码侧是否已
 *     净化"的入参(结构性断言),并用真机 .env 的历史原文跑一遍 CLI(行为性断言)。
 *
 * AGENTS.md §22c/§22d:直接 import 源脚本的 `__test__` 导出,不复刻实现;源脚本带 isDirectRun 守卫,
 * import 时不会触发 main 副作用。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'e2e-agent-access.mjs')
const ROOT = resolve(__dirname, '..', '..')

import { __test__ as src } from '../e2e-agent-access.mjs'

const JWT_AUTH_PY = readFileSync(resolve(ROOT, 'apps/ai-service/app/core/jwt_auth.py'), 'utf8')
/** 2026-09-21 本机 `apps/ai-service/.env:35` 的历史原文(越权事故现场值,非编造夹具)。 */
const REAL_MACHINE_ENV =
  'JWT_PUBLIC_PATHS=/api/health,/api/legacy/,/health,/metrics,/api/agents/,'
  + '/api/admin/news/status,/api/admin/news/scheduler-status,/api/voice/stt,/api/voice/tts,'
  + '/api/artifacts/f/,/api/video/token6688-callback,/api/media/tasks/callback\n'
/** 与 config.py 默认值逐字一致的干净夹具(用来证明本门禁不是"恒红")。 */
const CLEAN_ENV =
  'JWT_PUBLIC_PATHS=/api/health,/api/legacy/,/health,/metrics,/api/publish/scan-login/platforms,'
  + '/api/admin/news/status,/api/voice/stt,/api/voice/tts,/api/artifacts/f/,'
  + '/api/video/token6688-callback,/api/media/tasks/callback,/.well-known/agent.json,/.well-known/agent-card.json\n'

function runCli(args) {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, '--json', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 << 20,
    timeout: 300_000,
  })
  let report = null
  try {
    report = JSON.parse(r.stdout)
  } catch {
    report = null
  }
  return { exit: r.status, report }
}
const caseOf = (report, id) => report.results.find((x) => x.id === id)

test('parseSecurityBoundaryTuples:特权根与兜底写法必须从 jwt_auth.py 元组字面量实读', () => {
  const tuples = src.parseSecurityBoundaryTuples(JWT_AUTH_PY)
  assert.ok(tuples, '真实 jwt_auth.py 必须能解析出两份清单')
  assert.ok(tuples.neverPublicRoots.includes('/api/mcp'), '/api/mcp 必须在清单内')
  assert.ok(tuples.neverPublicRoots.includes('/api/agents'), '/api/agents 必须在清单内(O19 收口新增)')
  for (const catchAll of ['/', '/api', '/api/']) {
    assert.ok(tuples.catchAllEntries.includes(catchAll), `兜底写法 ${catchAll} 必须在清单内`)
  }
})

test('parseSecurityBoundaryTuples:清单变化守门自动跟随(证明没有手抄常量)', () => {
  const synthetic = [
    '_NEVER_PUBLIC_ROOTS: tuple[str, ...] = ("/api/mcp", "/api/agents", "/api/brand-new-privileged")',
    '_CATCH_ALL_PUBLIC_ENTRIES: tuple[str, ...] = ("/", "/api", "/api/", "/v1")',
  ].join('\n')
  const tuples = src.parseSecurityBoundaryTuples(synthetic)
  assert.ok(tuples)
  assert.equal(src.isNeverPublicEntry('/api/brand-new-privileged/sessions', tuples), true)
  assert.equal(src.isNeverPublicEntry('/v1', tuples), true)
})

test('parseSecurityBoundaryTuples:常量改名或缺失时返回 null(判据失源不得静默放过)', () => {
  assert.equal(src.parseSecurityBoundaryTuples('PUBLIC_ROOTS = ("/api/mcp",)'), null)
  assert.equal(src.parseSecurityBoundaryTuples('_NEVER_PUBLIC_ROOTS: tuple[str, ...] = ()'), null)
  assert.equal(
    src.parseSecurityBoundaryTuples('_NEVER_PUBLIC_ROOTS: tuple[str, ...] = ("/api/mcp", "/api/agents")'),
    null,
    '只解析到一份清单同样算失源(两份必须齐)',
  )
})

test('isNeverPublicEntry:与 Python _is_never_public 同口径(前缀继承,且不误伤近邻路径)', () => {
  const tuples = src.parseSecurityBoundaryTuples(JWT_AUTH_PY)
  assert.ok(tuples)
  const expect = {
    '/api/mcp': true,
    '/api/agents': true,
    '/api/agents/': true,
    '  /api/agents/sessions  ': true,
    '/api/agents-documentation': false,
    '/api/health': false,
    '/.well-known/agent.json': false,
    '/': true,
    '/api': true,
    '/api/': true,
    '/api/voice/stt': false,
  }
  for (const [entry, want] of Object.entries(expect)) {
    assert.equal(src.isNeverPublicEntry(entry, tuples), want, `${JSON.stringify(entry)} 应判 ${want}`)
  }
})

test('detectPrivilegedPublicEntries:逐条归因到 router 根,且签名里不存在"运行时已净化"这个入参', () => {
  assert.equal(
    src.detectPrivilegedPublicEntries.length,
    2,
    '判据函数只吃(条目清单, 边界清单)——一旦允许传入"代码侧已加固",fail-safe 就会把违规洗绿',
  )
  const tuples = src.parseSecurityBoundaryTuples(JWT_AUTH_PY)
  const violations = src.detectPrivilegedPublicEntries(
    ['/api/agents/', '/api/voice/stt', '/', '/api/mcp/sessions'],
    tuples,
  )
  assert.deepEqual(
    violations.map((v) => v.entry),
    ['/api/agents/', '/', '/api/mcp/sessions'],
  )
  const agents = violations.find((v) => v.entry === '/api/agents/')
  assert.equal(agents.kind, 'privileged-router-root')
  assert.equal(agents.routerRoot, '/api/agents')
  assert.match(agents.reason, /无端点级鉴权|code review/, '必须说明为什么不得匿名放行')
  const catchAll = violations.find((v) => v.entry === '/')
  assert.equal(catchAll.kind, 'catch-all')
  assert.match(catchAll.reason, /等同于关掉整条鉴权链/)
})

test('CLI(真机历史 .env 原文):必须 FAIL 并点名 /api/agents/ 与死条目,退出码 1', (t) => {
  const tmp = mkdtempSync(join(ROOT, '.ihui-agent', 'tmp', 'e2e-never-public-'))
  try {
    const envPath = join(tmp, 'env-with-agents.fixture.env')
    writeFileSync(envPath, REAL_MACHINE_ENV)
    const { exit, report } = runCli(['--ai-env', envPath])
    assert.ok(report, `脚本未给出 JSON 结论:${exit}`)
    assert.equal(exit, 1, '特权条目必须 blocking,不得只是 warn')
    assert.equal(caseOf(report, 'OFF-02a').status, 'PASS', '清单解析成功(排除"因解析失败而红")')
    const c = caseOf(report, 'OFF-02c')
    assert.equal(c.status, 'FAIL')
    assert.match(c.detail, /\/api\/agents\//, '必须点名违规条目本身')
    assert.match(c.detail, /router 根 \/api\/agents/, '必须给出所属 router 根')
    assert.match(c.detail, /fail-safe 已在运行时剔除/, '必须显式说明"运行时无害"仍判红(反悖论)')
    const d = caseOf(report, 'OFF-02d')
    assert.equal(d.status, 'FAIL')
    assert.match(d.detail, /\/api\/admin\/news\/scheduler-status/)
    assert.match(d.detail, /消费方 0 个/, '零消费方的 .env 独占条目必须被点名为死条目')
    assert.ok(
      report.findings.some((f) => f.severity === 'high' && /\/api\/agents\//.test(f.title)),
      '特权条目还须进 high 级告警清单',
    )
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  void t
})

test('CLI(与默认值一致的干净 .env):同一门禁必须 PASS,退出码 0(证明不是恒红)', () => {
  const tmp = mkdtempSync(join(ROOT, '.ihui-agent', 'tmp', 'e2e-never-public-'))
  try {
    const envPath = join(tmp, 'env-clean.fixture.env')
    writeFileSync(envPath, CLEAN_ENV)
    const { exit, report } = runCli(['--ai-env', envPath])
    assert.ok(report)
    assert.equal(caseOf(report, 'OFF-02c').status, 'PASS')
    assert.ok(!caseOf(report, 'OFF-02d') || caseOf(report, 'OFF-02d').status === 'PASS', '无 .env 独占条目时不得判红')
    assert.equal(exit, 0, `干净配置必须全绿,实际 FAIL:${report.results.filter((r) => r.status === 'FAIL').map((r) => r.id).join(',')}`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('CLI(被审计 .env 缺失):判据无法执行时按未证明处理,不得静默跳过', () => {
  const { exit, report } = runCli(['--ai-env', '.ihui-agent/tmp/definitely-not-here.env'])
  assert.ok(report)
  assert.equal(caseOf(report, 'OFF-02c').status, 'FAIL')
  assert.match(caseOf(report, 'OFF-02c').detail, /读不到/)
  assert.equal(exit, 1)
})
