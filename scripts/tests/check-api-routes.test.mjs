// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-api-routes.mjs')

// ─── 辅助:创建临时目录作为 monorepo 根 ──────────────────────
// 2026-09-26 两处改动(都由实测逼出):
//  ① 落点改 `scripts/lib/scratch-dir.mjs`(§26:不得往 os.tmpdir() 写,活进程 TEMP 可能仍钉 C 盘);
//  ② 夹具经 **`--worktree --root <dir>`** 通道进入。源脚本的 ROOT 不再取 process.cwd(),
//     只靠 cwd 的那套调用**结构上已经失效**(13 例里 11 例其实在审真仓、账面全绿而结论与夹具无关
//     —— 守门 70 / 13c 同型事故)。临时根不是 git 仓,所以夹具只能走磁盘档。
// 注意:源脚本 extractBackendRoutes() 在 apps/api/src/routes 不存在/为空时返回空 routes
// (旧版这里返回裸数组会让 buildCompositePrefixes 崩溃,2026-09-26 已修成对象),
// 仍预建空 routes 目录以匹配夹具语义。
function createTempRoot() {
  const dir = mkScratch('ihui-api-routes-')
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
  return dir
}

function destroyTempRoot(dir) {
  rmScratch(dir)
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
  const r = spawnSync(
    'node',
    [SCRIPT_PATH, '--worktree', '--root', cwd, ...args],
    {
      cwd: dirname(SCRIPT_PATH),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

/** 三端棘轮夹具基线的最小形状 */
function baselineWith(counts) {
  return JSON.stringify({ version: 1, perFileCount: counts })
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
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
    destroyTempRoot(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// 11. 三端纳入(2026-09-26 扩面):存量走棘轮、新增判红、缺锚点判"未判定"
// ═══════════════════════════════════════════════════════════

// ─── 21. mobile-rn 的死调用必须被看见(此前零判据的那一型) ──
// 立因实测:RN 侧 StudyIndexScreen 调后端从未注册的 GET /api/study/videos,
// 页面在任何数据下都不可达,而门只扫 apps/web ⇒ 结构上看不见。
test('三端纳入:mobile-rn 死调用被扫出并点名文件(无基线⇒未判定,不判红)', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/src/routes/x.ts', `server.get('/api/nothing', async () => {})`)
    writeFile(
      dir,
      'apps/mobile-rn/src/screens/StudyIndexScreen.tsx',
      "fetchApi('/api/study/videos')\n",
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `无锚点时不得判红(恒红门=逼人 --no-verify)\nstdout: ${r.out}`)
    assert.match(r.out, /未判定/, '缺基线必须如实喊"未判定",不得记为通过')
    assert.match(r.out, /apps\/mobile-rn\/src\/screens\/StudyIndexScreen\.tsx/)
    assert.match(r.out, /GET \/api\/study\/videos/)
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── 22. 基线内 ⇒ 只报数(登记),不得因为"三端有存量"而拦提交 ──
test('棘轮存量:等于基线额度 ⇒ exit 0 且逐条登记文件名与存量数', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/src/routes/x.ts', `server.get('/api/nothing', async () => {})`)
    writeFile(
      dir,
      'apps/mobile-rn/src/screens/StudyIndexScreen.tsx',
      "fetchApi('/api/study/videos')\n",
    )
    writeFile(
      dir,
      'scripts/api-routes-baseline.json',
      baselineWith({ 'apps/mobile-rn/src/screens/StudyIndexScreen.tsx': 1 }),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `存量应与基线相抵\nstdout: ${r.out}`)
    assert.match(r.out, /棘轮内存量死调用 1 处/)
    assert.match(r.out, /通过/)
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── 23. 超出基线 ⇒ 判红并点名"新增"(棘轮有牙的正例) ──
test('棘轮新增:同文件多加一处死调用超出基线额度 ⇒ exit 1 + 点名新增', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/src/routes/x.ts', `server.get('/api/nothing', async () => {})`)
    writeFile(
      dir,
      'apps/mobile-rn/src/screens/StudyIndexScreen.tsx',
      "fetchApi('/api/study/videos')\nfetchApi('/api/study/also-dead')\n",
    )
    writeFile(
      dir,
      'scripts/api-routes-baseline.json',
      baselineWith({ 'apps/mobile-rn/src/screens/StudyIndexScreen.tsx': 1 }),
    )
    const r = runScript(dir)
    assert.equal(r.status, 1, `超出基线必须判红\nstdout: ${r.out}`)
    assert.match(r.out, /新增 1 处/)
    assert.match(r.out, /\/api\/study\/also-dead/)
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── 24. miniapp-taro 目录真在射程内(不是"恰好没有这种文件") ──
test('三端纳入:miniapp-taro 的死调用同样被扫出(Taro.request 形态)', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/src/routes/x.ts', `server.get('/api/nothing', async () => {})`)
    writeFile(
      dir,
      'apps/miniapp-taro/src/pages/plaza/index.tsx',
      "Taro.request({ url: BASE + '/api/plaza/dead-endpoint', method: 'GET' })\n",
    )
    writeFile(dir, 'scripts/api-routes-baseline.json', baselineWith({}))
    const r = runScript(dir)
    assert.equal(r.status, 1, `新文件无基线额度 ⇒ 判红\nstdout: ${r.out}`)
    assert.match(r.out, /apps\/miniapp-taro/)
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── 25. extension 的 .js 扩展名同样纳入(旧扫描面只认 .ts/.tsx) ──
test('三端纳入:extension 的 .js 文件里的死调用被扫出', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/src/routes/x.ts', `server.get('/api/nothing', async () => {})`)
    writeFile(
      dir,
      'apps/extension/entrypoints/dead.js',
      "fetch('/api/ext/never-registered').then(() => {})\n",
    )
    writeFile(dir, 'scripts/api-routes-baseline.json', baselineWith({}))
    const r = runScript(dir)
    assert.equal(r.status, 1, `.js 调用点必须进射程\nstdout: ${r.out}`)
    assert.match(r.out, /GET \/api\/ext\/never-registered/)
    assert.match(r.out, /apps\/extension/)
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── 26. 扩面不得把 web 的既有零容忍放宽:基线只兜三端,不兜 web ──
test('web 仍是零容忍:基线里有额度也不豁免 apps/web 的死调用', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/src/routes/x.ts', `server.get('/api/nothing', async () => {})`)
    writeFile(dir, 'apps/web/dead.ts', "fetchApi('/api/web/legacy-thing')\n")
    writeFile(
      dir,
      'scripts/api-routes-baseline.json',
      baselineWith({ 'apps/web/dead.ts': 99 }),
    )
    const r = runScript(dir)
    assert.equal(r.status, 1, `web 侧不受棘轮保护\nstdout: ${r.out}`)
    assert.match(r.out, /发现 1 处前端调用无后端路由/)
  } finally {
    destroyTempRoot(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// 12. 判定面纪律(2026-09-26 收口后的形状锁 —— 参照守门 118 / 2e-dupns R4)
// ═══════════════════════════════════════════════════════════

// ─── 27. 两面旗同给 / --root 配 git 档 ⇒ 都判死(exit 2) ──
test('面旗互斥:--staged --worktree 与 --root(非 worktree) 都必须 exit 2', () => {
  const dir = createTempRoot()
  try {
    const both = spawnSync('node', [SCRIPT_PATH, '--staged', '--worktree'], {
      cwd: dirname(SCRIPT_PATH),
      encoding: 'utf8',
      windowsHide: true,
    })
    assert.equal(both.status, 2, `两面旗同给应判死\nstdout: ${both.stdout}\nstderr: ${both.stderr}`)
    const badRoot = spawnSync('node', [SCRIPT_PATH, '--root', dir], {
      cwd: dirname(SCRIPT_PATH),
      encoding: 'utf8',
      windowsHide: true,
    })
    assert.equal(
      badRoot.status,
      2,
      `--root 只在 --worktree 档有效(换根仍按 HEAD 读=双根分裂)\nstdout: ${badRoot.stdout}`,
    )
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── 28. 形状锁:内容必须走 face-reader 的读取入口,不得退回磁盘/cwd ──
// 方向与 2e-dupns R4 一致:收口**之后**判据反过来 —— 出现 face-reader 的 catBatch 才是合规,
// 退回 readFileSync(取仓内内容 或 const ROOT = process.cwd() 即红。
test('形状锁:取材层必须真被用来读内容(退化回磁盘即红)', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(src, /from\s+['"]\.\/lib\/face-reader\.mjs['"]/, '必须经统一取材层')
  assert.match(src, /catBatch\s*\(/, '内容必须走 catBatch(git 面)—— 守门 118 判 half-wired')
  assert.match(src, /readWorktreeFile\s*\(/, '磁盘档必须走层的 readWorktreeFile')
  assert.doesNotMatch(
    src,
    /const ROOT = process\.cwd\(\)/,
    'ROOT 不得再由 process.cwd() 决定(守门 70 的镜像测试 13/14 恒红那一型)',
  )
  assert.doesNotMatch(
    src,
    /readFileSync\s*\(/,
    '脚本内不得留任何直接 readFileSync —— 取内容一律走取材层',
  )
})

// ─── 29. --self-test 必须真能跑通(判据有效性自查,失败即 exit 1) ──
test('--self-test 端到端 exit 0(含棘轮三例)', () => {
  const r = spawnSync('node', [SCRIPT_PATH, '--self-test'], {
    cwd: dirname(SCRIPT_PATH),
    encoding: 'utf8',
    windowsHide: true,
  })
  const out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  assert.equal(r.status, 0, `--self-test 必须全绿\nstdout: ${out}\nstderr: ${r.stderr}`)
  assert.match(out, /self-test 通过/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
