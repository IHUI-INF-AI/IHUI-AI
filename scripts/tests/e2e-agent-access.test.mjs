// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/e2e-agent-access.test.mjs —— O17 判据函数单元测试(纯离线,零网络)
/**
 * 覆盖 scripts/e2e-agent-access.mjs 导出的核心判据(AGENTS.md §22c:直接 import 源函数,
 * 不复刻实现):
 *   - parseJwtPublicPaths:Python 配置里跨行拼接的默认白名单必须完整解析(漏一行 = 漏判 /api/mcp)
 *   - parseEnvList       :.env 覆盖值解析(部署态漂移检测)
 *   - parseOpenRegistry  :/api 登记表字面量解析(键 / methods / paths / scope),通配必须被解析出来
 *   - stripComments + countScopedCallSites:受控出口调用点计数口径(排 import、排注释、排闸实现文件)
 *   - mask               :凭据脱敏(永不回显完整值)
 * 以及"离线模式可跑通并给出结论"的最小集成断言。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'e2e-agent-access.mjs')
const ROOT = resolve(__dirname, '..', '..')

// §22d:源脚本带 isDirectRun 守卫,import 时不触发 main 副作用
import { __test__ as src } from '../e2e-agent-access.mjs'

test('parseJwtPublicPaths:跨行字符串拼接必须合并成一份完整白名单', () => {
  const py = [
    'class Settings:',
    '    jwt_public_paths: str = (',
    '        "/api/health,/api/legacy/,/health,/metrics,"',
    '        # 注释里写 /api/mcp 不算放行',
    '        "/api/voice/stt,/api/voice/tts,"',
    '        "/.well-known/agent.json"',
    '    )',
  ].join('\n')
  const paths = src.parseJwtPublicPaths(py)
  assert.ok(paths, '应解析出白名单')
  assert.deepEqual(paths, [
    '/api/health',
    '/api/legacy/',
    '/health',
    '/metrics',
    '/api/voice/stt',
    '/api/voice/tts',
    '/.well-known/agent.json',
  ])
  assert.ok(!paths.some((p) => p === '/api/mcp' || p.startsWith('/api/mcp/')), '注释中的 /api/mcp 不得计入放行')
})

test('parseJwtPublicPaths:默认值真含 /api/mcp 时必须能被抓出来(判据不是恒绿)', () => {
  const py = '    jwt_public_paths: str = (\n        "/api/health,/api/mcp"\n    )\n'
  const paths = src.parseJwtPublicPaths(py)
  assert.ok(paths.includes('/api/mcp'))
})

test('parseJwtPublicPaths:结构不符时返回 null(判据失效不得静默通过)', () => {
  assert.equal(src.parseJwtPublicPaths('jwt_public_paths: str = "abc"'), null)
  assert.equal(src.parseJwtPublicPaths(''), null)
})

test('parseEnvList:逗号分隔覆盖值解析 + 缺键返回 null', () => {
  assert.deepEqual(src.parseEnvList('A=1\nJWT_PUBLIC_PATHS=/api/health, /api/mcp\n', 'JWT_PUBLIC_PATHS'), [
    '/api/health',
    '/api/mcp',
  ])
  assert.equal(src.parseEnvList('A=1\n', 'JWT_PUBLIC_PATHS'), null)
})

test('parseOpenRegistry:解析条目并如实暴露通配/非 /api 路径违规', () => {
  const ts = `
export const x = 1
const DECLARATIONS = {
  'skills-list': {
    description: 'd',
    methods: ['GET'],
    paths: ['/api/skills'],
    scope: 'skills:read',
  },
  'bad-wildcard': {
    description: 'd2',
    methods: ['GET', 'POST'],
    paths: ['/api/v1/tools/*', '/v1/leaves-api-scope'],
    scope: 'tools:read',
  },
} as const satisfies Record<string, OpenCapabilityDeclaration>
`
  const entries = src.parseOpenRegistry(ts)
  assert.equal(entries?.length, 2)
  assert.deepEqual(entries[0], { key: 'skills-list', paths: ['/api/skills'], methods: ['GET'], scope: 'skills:read' })
  assert.deepEqual(entries[1].paths, ['/api/v1/tools/*', '/v1/leaves-api-scope'])
  assert.deepEqual(entries[1].methods, ['GET', 'POST'])
})

test('stripComments + countScopedCallSites:注释与 import 行不算调用点,闸实现文件排除', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-o17-scoped-'))
  try {
    mkdirSync(join(dir, 'routes'), { recursive: true })
    mkdirSync(join(dir, 'db'), { recursive: true })
    writeFileSync(
      join(dir, 'routes', 'a.ts'),
      [
        "import { db, dbScoped } from '../db/index.js'",
        '// 注释里提到 dbScoped 不算',
        'const rows = await dbScoped.select().from(t) // 行尾 dbReadScoped 注释不算第二处',
        'const n = await dbScoped.select()',
      ].join('\n'),
    )
    writeFileSync(join(dir, 'routes', 'b.ts'), "export const q = dbReadScoped.select()")
    writeFileSync(join(dir, 'db', 'index.ts'), "export const dbScoped = 1")
    const hits = src.countScopedCallSites(dir, new Set(['db/index.ts']))
    assert.equal(hits.length, 3, `真实调用点应为 3(2 处 a.ts + 1 处 b.ts),实际 ${hits.length}`)
    assert.ok(hits.every((h) => !h.includes('db/index.ts')), '闸实现文件不得计入调用点')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('mask:凭据只露前 6 位并给出长度', () => {
  assert.equal(src.mask('ihui_0123456789abcdef'), 'ihui_0***(len=21)')
  assert.equal(src.mask(''), '(未提供)')
})

test('离线模式端到端可跑:退出码 0/1 且 JSON 结论完整(不得把 SKIP 记成 PASS)', () => {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 << 20,
    timeout: 300_000,
  })
  assert.ok(r.status === 0 || r.status === 1, `退出码异常 ${r.status}:${(r.stderr || '').slice(0, 300)}`)
  const report = JSON.parse(r.stdout)
  const ids = report.results.map((x) => x.id)
  for (const required of ['OFF-02', 'OFF-04', 'OFF-07', 'OFF-09', 'OFF-10', 'OFF-11']) {
    assert.ok(ids.includes(required), `缺少必需断言 ${required}`)
  }
  assert.ok(
    report.results.every((x) => ['PASS', 'FAIL', 'SKIP'].includes(x.status) && typeof x.detail === 'string' && x.detail.length > 0),
    '每条结论都必须带状态与非空依据',
  )
  // 离线模式不得伪装在线结论
  const live = report.results.filter((x) => x.group.startsWith('live:'))
  assert.equal(live.length, 0, '未加 --live 时不应产生在线分组结论')
  assert.ok(report.results.some((x) => x.id === 'LIVE-00' && x.status === 'SKIP'), '离线模式必须显式标注在线通道未验证')
  assert.ok(report.counts.PASS >= 10, `离线断言数异常:${JSON.stringify(report.counts)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
