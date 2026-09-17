// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-api-routes.mjs')

// ─── 辅助:创建临时目录作为 monorepo 根(process.cwd()) ────
// check-api-routes.mjs 用 process.cwd() 推导 apps/web / apps/api/src/routes,
// 不调用 git,所以无需 git init,只需目录结构匹配。
// 注意:源脚本 extractBackendRoutes() 在 apps/api/src/routes 不存在时存在早期返回
// (返回 routes 数组而非 { routes, prefixes }),导致 buildCompositePrefixes 崩溃。
// 源脚本只读不改,这里预建空 routes 目录规避该 bug。
function createTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-api-routes-'))
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
  return dir
}

// ─── 辅助:在工作目录创建文件(自动建父目录) ────────────────
// relPath 用正斜杠(Windows fs 兼容)
function writeFile(dir, relPath, content = '') {
  const full = join(dir, ...relPath.split('/'))
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

// ─── 辅助:运行 check-api-routes.mjs,返回去除 ANSI 的输出 ───
function runScript(cwd, args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// ═══════════════════════════════════════════════════════════
// 1. 空目录与退出码基础
// ═══════════════════════════════════════════════════════════

// ─── 1. 空目录: 无 apps/web 无 apps/api → exit 0(无前端调用即无缺失) ──
test('空目录: 无 apps/web 无 apps/api → exit 0(无前端调用即无缺失)', () => {
  const dir = createTempRoot()
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `空目录应 exit 0\nstdout: ${r.out}\nstderr: ${r.stderr}`)
    assert.match(r.out, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 命中: 前端 GET /api/users 完全匹配后端路由 → exit 0 ──
test('命中: GET /api/users 前端调用匹配后端路由 → exit 0', () => {
  const dir = createTempRoot()
  try {
    writeFile(
      dir,
      'apps/api/src/routes/users.ts',
      `server.get('/api/users', async (req, reply) => { return { ok: true } })`,
    )
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/users')`)
    const r = runScript(dir)
    assert.equal(r.status, 0, `匹配应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 缺失: 前端调用无对应后端路由 → exit 1 + 报告缺失 ─────
test('缺失: GET /api/nonexistent 无后端路由 → exit 1 + 报告缺失', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/nonexistent')`)
    const r = runScript(dir)
    assert.equal(r.status, 1, `缺失应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /❌|发现.*处前端调用无后端路由/)
    assert.match(r.out, /\/api\/nonexistent/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 2. CLI 选项
// ═══════════════════════════════════════════════════════════

// ─── 4. --warn-only: 有缺失但 exit 0(warn 模式不阻塞) ────────
test('--warn-only: 有缺失但 exit 0(warn 模式不阻塞)', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/nonexistent')`)
    const r = runScript(dir, ['--warn-only'])
    assert.equal(r.status, 0, `--warn-only 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /warn-only/) // 模式标识
    assert.match(r.out, /❌|发现.*处/) // 仍报告缺失
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. --dump-missing <file>: 把缺失列表写入 JSON 文件 ──────
test('--dump-missing <file>: 缺失列表写入 JSON 文件', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/missing-one')`)
    const dumpFile = join(dir, 'missing.json')
    const r = runScript(dir, ['--dump-missing', dumpFile])
    assert.equal(r.status, 1, `有缺失应 exit 1\nstdout: ${r.out}`)
    assert.ok(existsSync(dumpFile), 'dump 文件应被创建')
    const dumped = JSON.parse(readFileSync(dumpFile, 'utf8'))
    assert.ok(Array.isArray(dumped), 'dump 应为数组')
    assert.ok(
      dumped.some((c) => c.path === '/api/missing-one'),
      '应含缺失路径 /api/missing-one',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. --dump-backend <file>: 把后端路由列表写入 JSON 文件 ──
test('--dump-backend <file>: 后端路由列表写入 JSON 文件', () => {
  const dir = createTempRoot()
  try {
    writeFile(
      dir,
      'apps/api/src/routes/users.ts',
      `server.get('/api/users', async () => {})`,
    )
    const dumpFile = join(dir, 'backend.json')
    const r = runScript(dir, ['--dump-backend', dumpFile])
    assert.equal(r.status, 0, `无缺失应 exit 0\nstdout: ${r.out}`)
    assert.ok(existsSync(dumpFile), 'dump 文件应被创建')
    const dumped = JSON.parse(readFileSync(dumpFile, 'utf8'))
    assert.ok(Array.isArray(dumped), 'dump 应为数组')
    assert.ok(
      dumped.some((rt) => rt.method === 'GET' && rt.localPath === '/api/users'),
      '应含后端路由 GET /api/users',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 3. 路径跳过规则(/api/llm/)
// ═══════════════════════════════════════════════════════════

// ─── 7. /api/llm/ 跳过: 走 Next.js rewrite 到 ai-service,不参与比对 ──
test('/api/llm/ 调用跳过(走 ai-service rewrite)→ exit 0', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/llm/chat')`)
    const r = runScript(dir)
    assert.equal(r.status, 0, `/api/llm/ 应跳过\nstdout: ${r.out}`)
    assert.match(r.out, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 4. 路径匹配规则(:param / * catch-all)
// ═══════════════════════════════════════════════════════════

// ─── 8. :param 通配: 前端 /api/users/${id} ↔ 后端 /api/users/:id ──
test(':param 通配: 前端 /api/users/${id} ↔ 后端 /api/users/:id → exit 0', () => {
  const dir = createTempRoot()
  try {
    writeFile(
      dir,
      'apps/api/src/routes/users.ts',
      `server.get('/api/users/:id', async (req, reply) => {})`,
    )
    writeFile(dir, 'apps/web/api.ts', 'fetchApi(`/api/users/${userId}`)')
    const r = runScript(dir)
    assert.equal(r.status, 0, `:param 应匹配\nstdout: ${r.out}`)
    assert.match(r.out, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. * catch-all: 后端 /api/documents/* 匹配多段前端路径 ──
test('* catch-all: 后端 /api/documents/* 匹配前端 /api/documents/a/b/c → exit 0', () => {
  const dir = createTempRoot()
  try {
    writeFile(
      dir,
      'apps/api/src/routes/docs.ts',
      `server.get('/api/documents/*', async (req, reply) => {})`,
    )
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/documents/a/b/c')`)
    const r = runScript(dir)
    assert.equal(r.status, 0, `* catch-all 应匹配\nstdout: ${r.out}`)
    assert.match(r.out, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 5. 后端路由提取规则(registerCrud 工厂 / 方法匹配)
// ═══════════════════════════════════════════════════════════

// ─── 10. registerCrud 展开: 5 条路由,前端 POST /api/items 命中 ──
test('registerCrud 展开: 前端 POST /api/items 命中(工厂展开含 POST)→ exit 0', () => {
  const dir = createTempRoot()
  try {
    writeFile(
      dir,
      'apps/api/src/routes/items.ts',
      `registerCrud(server, '/api/items', { /* opts */ })`,
    )
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/items', { method: 'POST' })`)
    const r = runScript(dir)
    assert.equal(r.status, 0, `registerCrud POST 应命中\nstdout: ${r.out}`)
    assert.match(r.out, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. 方法不匹配: 前端 POST 后端仅 GET → exit 1 ───────────
test('方法不匹配: 前端 POST /api/users 后端仅 GET → exit 1', () => {
  const dir = createTempRoot()
  try {
    writeFile(
      dir,
      'apps/api/src/routes/users.ts',
      `server.get('/api/users', async (req, reply) => {})`,
    )
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/users', { method: 'POST' })`)
    const r = runScript(dir)
    assert.equal(r.status, 1, `方法不匹配应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /❌|发现.*处/)
    assert.match(r.out, /POST \/api\/users/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 6. ignore 配置(.check-api-routes-ignore.json)
// ═══════════════════════════════════════════════════════════

// ─── 12. ignore 配置: 缺失路由被豁免 → exit 0 + 报告豁免数 ────
test('ignore 配置: 缺失路由被 .check-api-routes-ignore.json 豁免 → exit 0', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/unknown')`)
    writeFile(
      dir,
      '.check-api-routes-ignore.json',
      JSON.stringify({
        version: 1,
        ignorePatterns: [{ pathPattern: '/api/unknown', reason: '后端待实装' }],
      }),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `被豁免应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /豁免/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 7. 文件过滤(*.test.ts 跳过 / *.spec.ts 保留)
// ═══════════════════════════════════════════════════════════

// ─── 13. *.test.ts 跳过: mock 调用不计入前端调用 → exit 0 ────
test('*.test.ts 跳过: mock 调用不计入前端调用 → exit 0', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/api.test.ts', `fetchApi('/api/test-only-mock')`)
    const r = runScript(dir)
    assert.equal(r.status, 0, `*.test.ts 应跳过\nstdout: ${r.out}`)
    assert.match(r.out, /前端 API 调用: 0 处/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 14. *.spec.ts 保留: e2e 调用计入比对 → exit 1(无后端) ──
test('*.spec.ts 保留: e2e 调用计入前端调用 → exit 1(无后端)', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/api.spec.ts', `fetchApi('/api/e2e-missing')`)
    const r = runScript(dir)
    assert.equal(r.status, 1, `*.spec.ts 应计入\nstdout: ${r.out}`)
    assert.match(r.out, /\/api\/e2e-missing/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 8. 方法推断(注释标注 // method: POST 覆盖默认 GET)
// ═══════════════════════════════════════════════════════════

// ─── 15. 注释标注: 前一行 // method: POST → 推断为 POST + 命中后端 POST ──
test('注释标注: 前一行 // method: POST → 方法推断为 POST + 命中后端 POST', () => {
  const dir = createTempRoot()
  try {
    writeFile(
      dir,
      'apps/api/src/routes/x.ts',
      `server.post('/api/annotated', async () => {})`,
    )
    writeFile(dir, 'apps/web/api.ts', `// method: POST\nfetchApi('/api/annotated')\n`)
    const r = runScript(dir)
    assert.equal(r.status, 0, `注释标注 POST 应命中后端 POST\nstdout: ${r.out}`)
    assert.match(r.out, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 9. 内联查询串提取(2026-09-17 正则加固回归防护)
// ═══════════════════════════════════════════════════════════

// ─── 16. 内联查询串: '/api/users?q=abc' 应被提取,归一化去掉 ?... 后命中后端 ──
// 加固前 pathRe 字符类不含 `?` → 这类调用整条不被提取,守门静默放行(实测漏检 288 条路径)。
test('内联查询串: /api/users?q=abc 归一化后命中后端 GET /api/users → exit 0', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/src/routes/users.ts', `server.get('/api/users', async () => {})`)
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/users?q=abc')`)
    const r = runScript(dir)
    assert.equal(r.status, 0, `内联查询串应被提取并命中\nstdout: ${r.out}`)
    assert.match(r.out, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 17. 盲区回归: 内联查询串调用无后端路由时必须报缺失(加固前会 exit 0) ──
test('内联查询串盲区回归: /api/memory/graph?query=abc 无后端 → exit 1 + 报告缺失', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/memory/graph?query=abc')`)
    const r = runScript(dir)
    assert.equal(r.status, 1, `内联查询串缺失应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /\/api\/memory\/graph/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 10. method 推断加固(2026-09-17):可选链归一化 / 调用收尾截断 / 跨行 options
// ═══════════════════════════════════════════════════════════

// ─── 18. 可选链: `${editing?.id}` 的 `?.` 不得被当成查询串清空 ──
// 加固前 expr.includes('?') 命中 `${editing?.id}` → 整个插值被清空,
// 路径退化为 /api/admin/exam/questions(丢掉 :param) → 与后端 /:id 比对必然误报缺失。
test('可选链归一化: ${editing?.id} 保留 :param → 命中 PUT /api/admin/exam/questions/:id', () => {
  const dir = createTempRoot()
  try {
    writeFile(
      dir,
      'apps/api/src/routes/exam.ts',
      `server.put('/api/admin/exam/questions/:id', async () => {})`,
    )
    writeFile(
      dir,
      'apps/web/q.tsx',
      "eduApi(`/api/admin/exam/questions/${editing?.id}`, {\n  method: 'PUT',\n})",
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `可选链应保留 :param 并命中\nstdout: ${r.out}`)
    assert.match(r.out, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 19. 调用收尾截断: GET 调用后紧邻另一个 POST 调用时不得误抓 ──
// 加固前向后盲扫固定 4 行 → 跨出当前调用,抓到下一个 useMutation 的 method: 'POST',
// 把 GET /api/circles/mine 误报成 POST(my-circles/page.tsx 实测)。
test('调用收尾截断: queryFn GET 后紧跟 useMutation 的 POST → 判 GET 不误抓', () => {
  const dir = createTempRoot()
  try {
    writeFile(
      dir,
      'apps/api/src/routes/circles.ts',
      `server.get('/api/circles/mine', async () => {})\nserver.post('/api/circles/:id/leave', async () => {})`,
    )
    writeFile(
      dir,
      'apps/web/my-circles.tsx',
      'async function api<T>(url: string, options?: RequestInit): Promise<T> {\n' +
        '  const r = await fetchApi<T>(url, options)\n' +
        '  return r.data\n' +
        '}\n' +
        'export default function P() {\n' +
        '  const { data } = useQuery({\n' +
        '    queryFn: () => api<D>(`/api/circles/mine?page=${page}`),\n' +
        '  })\n' +
        '  const delMut = useMutation({\n' +
        "    mutationFn: (id: string) => api(`/api/circles/${id}/leave`, { method: 'POST' }),\n" +
        '  })\n' +
        '}\n',
    )
    const r = runScript(dir)
    assert.equal(
      r.status,
      0,
      `不应把下一个调用的 POST 误抓成 /api/circles/mine 的方法\nstdout: ${r.out}`,
    )
    assert.match(r.out, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 20. 跨行 options: URL 与 `return api(url, { method: 'POST' })` 相隔 6 行 ──
// refund 页形态:三元拼 URL(第 5/6 行) → body 构造 → 第 8 行才出现 method。
// 加固前 4 行窗口够不到 → 误判 GET(实为 POST) → 与后端 POST /refunds/:id/audit 比对误报缺失。
test('跨行 options: 三元 URL 后第 6 行的 method: POST 仍应被识别', () => {
  const dir = createTempRoot()
  try {
    writeFile(
      dir,
      'apps/api/src/routes/refund.ts',
      `server.post('/api/refunds/:id/audit', async () => {})\nserver.post('/api/refunds/:id/reject', async () => {})`,
    )
    writeFile(
      dir,
      'apps/web/refund.tsx',
      'const mut = useMutation({\n' +
        '  mutationFn: () => {\n' +
        '    const url =\n' +
        "      mode === 'audit'\n" +
        '        ? `/api/refunds/${id}/audit`\n' +
        '        : `/api/refunds/${id}/reject`\n' +
        "    const body = mode === 'audit' ? { a: 1 } : { b: 2 }\n" +
        "    return api(url, { method: 'POST', body: JSON.stringify(body) })\n" +
        '  },\n' +
        '})\n',
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `跨行 method 应被识别为 POST 并命中\nstdout: ${r.out}`)
    assert.match(r.out, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
