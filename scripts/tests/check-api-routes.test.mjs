// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 遮噪必须引 lib 那一份实现(§22c:测试里不得再抄一台分词器,否则"测试跟着实现一起漂绿")
import { maskComments } from '../lib/code-mask.mjs'

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

// ─── 30. 共享包自身必须进射程(§3 规定端内不得裸 fetch,路径字面量的住处就是这里) ──
// 正向锁:扩面若被回退成"只扫四个端",本例会红 —— 新增一面却没有一条断言喂它,
// 就等于该面在这门眼里不存在(名单类判据必须有正向证明,守门 120 同型)。
test('api-client 纳入:共享包里的死调用被扫出并点名该包', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/src/routes/x.ts', `server.get('/api/nothing', async () => {})`)
    writeFile(
      dir,
      'packages/api-client/src/endpoints/dead.ts',
      "export const ping = () => fetchApi('/api/shared/never-registered')\n",
    )
    writeFile(dir, 'scripts/api-routes-baseline.json', baselineWith({}))
    const r = runScript(dir)
    assert.equal(r.status, 1, `共享包调用点必须进射程\nstdout: ${r.out}`)
    assert.match(r.out, /GET \/api\/shared\/never-registered/)
    assert.match(r.out, /packages\/api-client\/src\/endpoints\/dead\.ts/)
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── 31. 该走棘轮的就走棘轮:api-client 的存量不得判红(否则与改动无关的提交全被钉住) ──
test('api-client 棘轮存量:等于基线额度 ⇒ exit 0 且只报数', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/src/routes/x.ts', `server.get('/api/nothing', async () => {})`)
    writeFile(
      dir,
      'packages/api-client/src/endpoints/dead.ts',
      "export const ping = () => fetchApi('/api/shared/never-registered')\n",
    )
    writeFile(
      dir,
      'scripts/api-routes-baseline.json',
      baselineWith({ 'packages/api-client/src/endpoints/dead.ts': 1 }),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `存量按棘轮只报数,不得判红\nstdout: ${r.out}`)
    assert.match(r.out, /api-client.*存量/)
  } finally {
    destroyTempRoot(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// 13. 带值旗标的吞噬(2026-09-28 修 `--dump-* --staged` 这一型,口径照抄枚 380431ffc)
// ═══════════════════════════════════════════════════════════

// ─── 32. --dump-missing / --dump-backend 的"值"若以 `-` 开头 ⇒ 不算值 ──
// 事故形态是 `--dump-missing --staged`(runner 给每道门追加 --staged)⇒ 在 cwd 写出名叫
// `--staged` 的文件(§28 禁止形态)。夹具通道无法同时带 --staged 走 --worktree(两面旗同给
// 由 face 判定在上游判死 —— 例 27 钉着),所以行为档用**同型**的无效 token --not-a-path
// (脚本不认识它,面与退出码语义不变)证谓词本体;真仓 `--dump-missing --staged` 一站由
// 交付报告的私有索引 CLI 现测 + 例 34 的源码形状锁钉死。
// spawn cwd = 夹具根:即便判据退化成旧形态,产物也只会落在 scratch,绝不碰真仓。
function runInCwd(extraArgs) {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/src/routes/x.ts', `server.get('/api/live', async () => {})`)
    writeFile(dir, 'apps/web/api.ts', `fetchApi('/api/dead-one')`)
    const stray = join(dir, '--not-a-path')
    const r = spawnSync('node', [SCRIPT_PATH, '--worktree', '--root', dir, ...extraArgs], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
    return { dir, stray, r }
  } catch (e) {
    destroyTempRoot(dir)
    throw e
  }
}

test('--dump-missing --not-a-path(以 - 开头的值):不写文件、人读结论仍在、stderr 点名无效值', () => {
  const { dir, stray, r } = runInCwd(['--dump-missing', '--not-a-path'])
  try {
    assert.equal(r.status, 1, `退出码语义一字未动(web 缺失仍 1)\nstdout: ${r.out}\nstderr: ${r.stderr}`)
    assert.match(r.out, /\/api\/dead-one/, '人读结论仍在(缺失照报)')
    assert.match(r.out, /逐条死调用/, '--dump-missing 的布尔档人读段仍打出')
    assert.match(r.stderr, /忽略无效的 --dump-missing 值: --not-a-path/, '无效值必须点名,不得静默按未给值处理')
    assert.ok(!existsSync(stray), `不得在 cwd 产出名叫 --not-a-path 的文件: ${stray}`)
  } finally {
    // 变异反证(判据退化)时残留的产物在这里清掉;绿色路径永不产生它。
    if (existsSync(stray)) rmSync(stray, { force: true })
    destroyTempRoot(dir)
  }
})

// ─── 33. --dump-backend 同一条谓词、同一个出口(两处各写一份必漂移) ──
test('--dump-backend --not-a-path(以 - 开头的值):同样不写文件并点名', () => {
  const { dir, stray, r } = runInCwd(['--dump-backend', '--not-a-path'])
  try {
    assert.match(r.stderr, /忽略无效的 --dump-backend 值: --not-a-path/)
    assert.ok(!existsSync(stray), `不得产出名叫 --not-a-path 的文件: ${stray}`)
  } finally {
    if (existsSync(stray)) rmSync(stray, { force: true })
    destroyTempRoot(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// 通道等价(CE)维 —— 2026-09-29,G-466 换维后的新格子
// 夹具里的 transport 逐字照 HEAD 面 `packages/api-client/src/client.ts:404-416` 的 normalizeUrl
// 形态写,只把改写档换成票面那一型(`/admin`→`/console`);守卫照 Fastify preHandler 真写法。
// 门读的是**这些文件的内容**,不是自带的第二张表 —— 该不变量由 T-CE-3 的源码反向锁钉住。
// ═══════════════════════════════════════════════════════════

const CE_TRANSPORT = [
  'export async function fetchApi<T>(url: string): Promise<T> {',
  '  const normalizedUrl = normalizeUrl(url)',
  '  return normalizedUrl as T',
  '}',
  'function normalizeUrl(url: string): string {',
  '  if (/^https?:\\/\\//i.test(url)) return url',
  '  const normalized = (() => {',
  "    if (url.startsWith('/api/') || url.startsWith('/uploads/') || url.startsWith('/ws/')) return url",
  "    if (url.startsWith('/admin')) {",
  "      return url.replace(/^\\/admin/, '/console')",
  '    }',
  "    if (url.startsWith('/')) return `/api${url}`",
  '    return `/api/${url}`',
  '  })()',
  '  return normalized',
  '}',
  '',
].join('\n')
/** 三条件里的②:读到客户端自报的通道头,且对 GET 有意放行 */
const CE_GUARD = [
  'export async function clientChannelGuard(server) {',
  "  server.addHook('preHandler', async (req, reply) => {",
  "    const channel = req.headers['x-client-channel']",
  "    const enforce = process.env.CHANNEL_ENFORCE === '1'",
  '    if (!enforce) return',
  "    if (req.method === 'GET') return",
  "    if (channel !== 'admin') {",
  "      return reply.code(403).send({ message: 'forbidden channel' })",
  '    }',
  '  })',
  '}',
  '',
].join('\n')
/** 同一个守卫,但没有按方法放行那一档 ⇒ ②不成立(这是"不得把正确实现钉死"的对照) */
const CE_GUARD_NO_EXEMPT = CE_GUARD.replace("    if (req.method === 'GET') return\n", '')
/** 同一份守卫代码,只是整段躺在块注释里 ⇒ 遮噪证明:注释不得给实现发合格证 */
const CE_GUARD_COMMENTED = [
  '/**',
  CE_GUARD.replace(/\n{2,}/g, '\n'),
  ' */',
  'export async function unusedGuard(server) {}',
  '',
].join('\n')
const CE_ROUTES =
  "server.get('/api/nothing', async () => ({}))\n" +
  "server.get('/api/admin/secret', async () => ({}))\n" +
  "server.get('/api/console/secret', async () => ({}))\n"
const CE_SITE = "export const load = () => fetchApi('/admin/secret')\n"
const CE_EMPTY_LEDGER = JSON.stringify({ version: 1, declared: [] })

/** 通道等价夹具:临时根里把三份事实源都摆齐 */
function ceRoot(extraFiles, overrides = {}) {
  const dir = createTempRoot()
  writeFile(dir, 'scripts/api-routes-baseline.json', baselineWith({}))
  writeFile(dir, 'scripts/data/channel-equiv-baseline.json', CE_EMPTY_LEDGER)
  writeFile(dir, 'packages/api-client/src/client.ts', CE_TRANSPORT)
  writeFile(dir, 'apps/api/src/plugins/ce-guard.ts', CE_GUARD)
  writeFile(dir, 'apps/api/src/routes/ce.ts', CE_ROUTES)
  writeFile(dir, 'apps/mobile-rn/src/screens/Ce.tsx', CE_SITE)
  for (const [rel, content] of Object.entries(extraFiles || {})) writeFile(dir, rel, content)
  for (const [rel, content] of Object.entries(overrides)) writeFile(dir, rel, content)
  return dir
}

// ─── T-CE-1 阳性对照(本票立项那一型):三条件齐备 ⇒ 判红并点名等价对 ───
test('通道等价:改写档+放行档+两侧都在册 ⇒ exit 1 且点名"两种拼写等价"', () => {
  const dir = ceRoot()
  try {
    const r = runScript(dir)
    assert.equal(r.status, 1, `三条件齐备必须判红,实得 exit=${r.status}\n${r.out}`)
    assert.match(
      r.out,
      /GET \/admin\/secret ≡ \/console\/secret/,
      '必须点名等价对与出处,否则读报告的人不知道该收哪一侧',
    )
    assert.match(r.out, /ce-guard\.ts/, '必须点名"放行依据"是哪一处守卫')
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── T-CE-2 反向对照一:守卫没有按方法放行的那一档 ⇒ 不得判红 ───
// 只删一行(`if (req.method === 'GET') return`),其余逐字不变 ⇒ 这一例证的是"②确有牙",
// 不是"夹具里恰好写了个红"。
test('通道等价:缺②(守卫全方法执行)⇒ 不判红,并点名缺 ②-c', () => {
  const dir = ceRoot({}, { 'apps/api/src/plugins/ce-guard.ts': CE_GUARD_NO_EXEMPT })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `②不成立不得判红,实得 exit=${r.status}\n${r.out}`)
    assert.match(r.out, /未判定\(通道等价 CE\):②/, '必须点名缺的是②')
    assert.doesNotMatch(r.out, /≡/, '不得出现旁路点名(判据不能只是把正确实现改坏一次就红)')
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── T-CE-3 遮噪双向锁:同一份守卫文本只躺在注释里 ⇒ 必绿 ───
// 与 T-CE-1 是**同一份代码**,差别只是注释符。只留"真代码必红"这一臂,就等于允许
// "注释里写过所以算实现"的假阳;只留"注释必绿"这一臂,就等于允许门瞎掉。两条同时成立才算有牙。
test('通道等价:注释里的通道头与放行档既不算②也不算站点', () => {
  const dir = ceRoot({}, { 'apps/api/src/plugins/ce-guard.ts': CE_GUARD_COMMENTED })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `注释形态不得判红,实得 exit=${r.status}\n${r.out}`)
    assert.doesNotMatch(r.out, /≡/, '注释里的守卫不得被当成②的在册证据')
    assert.match(r.out, /通道等价\(CE\)② 通道守卫:.*在册 0 个/, '读数行必须如实报"在册 0 个"')
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── T-CE-4 台账写明理由 ⇒ 判绿,并且必须说清是"已交代"而不是"没判" ───
test('通道等价:站点在台账里逐条写明理由 ⇒ exit 0 且报"已交代"', () => {
  const dir = ceRoot()
  writeFile(
    dir,
    'scripts/data/channel-equiv-baseline.json',
    JSON.stringify({
      version: 1,
      declared: [
        {
          file: 'apps/mobile-rn/src/screens/Ce.tsx',
          path: '/admin/secret',
          reason: '只读公开路由:该入口返回字段与 /console 侧同集合,无租户数据',
        },
      ],
    }),
  )
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `已交代不得再判红,实得 exit=${r.status}\n${r.out}`)
    assert.match(r.out, /逐条写明理由/, '必须报"已交代",不能把这一格读成"没判"')
    assert.doesNotMatch(r.out, /≡/, '交代过的站点不该再出现在旁路清单里')
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── T-CE-5 缺首锚台账 ⇒ 未判定(不判红也不记绿),同本门 BASELINE_FILE 缺档手法 ───
test('通道等价:台账缺档 ⇒ 该维未判定并点名,不判红', () => {
  const dir = ceRoot()
  rmSync(join(dir, 'scripts', 'data', 'channel-equiv-baseline.json'), { force: true })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `无首锚不得判红,实得 exit=${r.status}\n${r.out}`)
    assert.match(r.out, /首锚台账缺档|不在 .*面上 ⇒ 无首锚/, '缺档必须点名')
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── T-CE-6 真仓 HEAD 面现读:该维必须是"未判定"而不是"已判过",且整体不得因此变红 ───
// 这一例是"票面现场在本仓不成立"的**入库载体**:三条件里的②在本仓零命中,
// 所以本维今天只能报未判定。它同时是防恒红的锁 —— 谁把这台门改成对现状判红,这里就红。
test('真仓 HEAD 面:通道等价维必须现读出现写档、守卫 0 个,并落"未判定"', () => {
  const r = spawnSync('node', [SCRIPT_PATH], {
    cwd: dirname(SCRIPT_PATH),
    encoding: 'utf8',
    timeout: 420000,
    windowsHide: true,
  })
  const out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  assert.equal(r.status, 0, `真仓 HEAD 面不得因本维变红(新增恒红 = 逼人 --no-verify)\n${out.slice(0, 800)}`)
  assert.match(
    out,
    /通道等价\(CE\)① 归一改写档\(读自 head 面 packages\/api-client\/src\/client\.ts::normalizeUrl\):\/cozeZhsApi→\/api/,
    '①的读数必须逐字来自真 normalizeUrl 的改写档(空档要看得见)',
  )
  assert.match(out, /通道等价\(CE\)② 通道守卫:.*在册 0 个/, '②必须如实报"在册 0 个"')
  assert.match(out, /未判定\(通道等价 CE\)/, '三条件不齐 ⇒ 必须喊未判定,不得静默也不得记通过')
  assert.doesNotMatch(out, /通道等价\(CE\)已判过/, '"已判过"只允许在三条件齐备时出现')
})

// ─── T-CE-7 形状锁:CE 必须装车,事实源只有那一份,门内不得有第二张改写表 ───
test('形状锁:通道等价三维必须挂在主流程,且不得自带第二份改写表/守卫清单', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(src, /function\s+readUrlAliasRules\s*\(/, '① 归一档解析器必须在位')
  assert.match(src, /function\s+readChannelGuards\s*\(/, '② 通道守卫解析器必须在位')
  assert.match(src, /function\s+findLiveAliasSites\s*\(/, '③ 站点判据必须在位')
  assert.match(src, /function\s+collectAliasSiteUndetermined\s*\(/, '③ 的"看得见但判不了"档必须在位')
  // 装车:三个解析器都必须被主流程真的调用(定义了没人调 = 提交链上一路绿灯)
  assert.match(src, /readUrlAliasRules\(readSource\(CLIENT_TRANSPORT_FILE\)\)/, '① 必须按判定面取 transport')
  assert.match(src, /readChannelGuards\(guardEntries\)/, '② 必须吃插件面的 entries')
  assert.match(src, /findLiveAliasSites\(\{/, '③ 必须挂在执行段上')
  assert.match(src, /collectAliasSiteUndetermined\(\{/, '③ 的未判定档必须真被采集')
  // 同面同轮:transport 与台账必须进同一次 prefetch(否则 readSource 抛"未经 prefetch 就取材")
  assert.match(src, /CLIENT_TRANSPORT_FILE,\r?\n\s*CHANNEL_EQUIV_BASELINE_REL,/, '两份事实源必须进 prefetch')
  // 反向锁:门内不得出现第二份硬编码改写表 / 守卫清单
  // 反向锁:判定层不得出现任何通道头**具体名字** —— 名字必须由守卫面的代码现读。
  // 判"整份源码里没有这个名字"是错的(自测夹具逐字写着它,那正是 §22c 要求的"输入取自真实形态"),
  // 所以按**区段 + 遮噪面**判:runSelfTest 之前 = 判定层,把它遮掉注释后仍出现任何 header 名,
  // 就是硬编码。遮噪必须引 lib 那一份实现,测试里不得再抄一台分词器(§22c)。
  const judgeLayerStart = src.indexOf('function runSelfTest')
  assert.ok(judgeLayerStart > 1000, '判定层区段必须切得出来(runSelfTest 之前)')
  const judgeCode = maskComments(src.slice(0, judgeLayerStart))
  assert.doesNotMatch(judgeCode, /x-client-channel/i, '判定层不得写死通道头名(注释里的说明性提及不计)')
  assert.doesNotMatch(judgeCode, /['"]\/admin['"]/, '判定层不得写死别名前缀(事实源只能是 transport)')
  // 方法白名单也不得写死成表:放行档必须由守卫里的 `.method` 比较式读出来
  assert.doesNotMatch(judgeCode, /EXEMPT_METHODS\s*=\s*\[/, '不得留一张自带放行方法表')
  // 判据必须走**遮注释面**读三份事实源(注释里的通道头/放行档不得给实现发合格证)
  const maskHits = judgeCode.match(/maskComments\(/g) || []
  assert.ok(maskHits.length >= 3, `事实源取材必须逐份遮噪(实测 ${maskHits.length} 处)`)


  // 遮噪只引那一份实现
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/, '遮噪必须引 lib 那一份')
  assert.doesNotMatch(src, /function\s+maskComments\s*\(/, '门内不得自带第二份遮噪实现')
  // 三态文案齐备:缺①/缺②/缺③/无首锚 四种未判定都必须有各自的说辞
  for (const phrase of ['①归一实现读不出', '②通道守卫不在册', '③面上没有一处调用点', '无首锚']) {
    assert.ok(src.includes(phrase), `未判定档必须点名到"${phrase}"这一型`)
  }
})

// ═══════════════════════════════════════════════════════════
// FG(票面 :85 三条现场)—— 2026-09-29 补的阳性对照
// 门头注自 2026-09-26 起就声称"这三条我都看得见",而 `git grep -E
// 'user/token-balance|statistics/user-center|agent-category-dict' HEAD -- scripts`
// 实测只命中那一句注释、测试面 0 条 ⇒ "声称看得见"从未被喂过一次真输入。
// 三条各自的判据地位(逐条从实现里读出来,不是照票面猜):
//   FG-1 `endpoints/token.ts` 的 `fetchApi<TokenBalance>('/api/user/token-balance')` ⇒ 可判(进调用集)
//   FG-2 `endpoints/user.ts` 的 `fetchApi<UserStatistics>('/api/statistics/user-center')` ⇒ 可判,
//        且必须**逐条**判(同文件另有一条跨行 options 的已注册 POST,不得被连带判死)
//   FG-3 `endpoints/agent.ts` 的 `fetchApi<AgentCategories>('/cozeZhsApi/cache/…')` ⇒ **不可判**:
//        `pathRe` 要求引号紧邻 `/api/`,而这种字面量要等 transport 的 normalizeUrl 才补出 `/api/`,
//        归一档只被 CE① 读、主对账从不应用 ⇒ 一条都不进调用集,既不判死也不落任何既有未判定桶
//        ⇒ 按票第 3 条:登记成「未判定(改写前缀字面量)」并逐条报名,不判红、不写假用例凑数
// 输入形态逐字取自 HEAD 面真实文件(§22c:镜像夹具复刻的必须是真形态,不是实现的形状)。
// ═══════════════════════════════════════════════════════════

/** 三条阳性对照的"确实各跑过一次"登记表(由 FG-LOCK 判读,不是自增计数器) */
const FG_HITS = new Map()
function fgHit(key) {
  FG_HITS.set(key, (FG_HITS.get(key) || 0) + 1)
}

/** transport 夹具:逐字照 HEAD 面 packages/api-client/src/client.ts:404-416 的 normalizeUrl 形态 */
const FG_TRANSPORT = [
  'export async function fetchApi<T>(url: string, init?: RequestInit): Promise<T> {',
  '  const normalizedUrl = normalizeUrl(url)',
  '  return request(normalizedUrl, init) as unknown as T',
  '}',
  'function normalizeUrl(url: string, useStreamBase = false): string {',
  '  if (/^https?:\\/\\//i.test(url)) return url',
  '  const normalized = (() => {',
  "    if (url.startsWith('/api/') || url.startsWith('/uploads/') || url.startsWith('/ws/')) return url",
  "    if (url.startsWith('/cozeZhsApi')) {",
  "      return url.replace(/^\\/cozeZhsApi/, '/api')",
  '    }',
  "    if (url.startsWith('/')) return `/api${url}`",
  '    return `/api/${url}`',
  '  })()',
  '  return normalized',
  '}',
  '',
].join('\n')

/** 公共底:一条 2 段在册路由(供 transport 自己的 `/api/${url}` 模板有处可落)+ 空棘轮基线 */
function fgRoot(files) {
  const dir = createTempRoot()
  writeFile(dir, 'apps/api/src/routes/x.ts', "server.get('/api/nothing', async () => ({}))\n")
  writeFile(dir, 'packages/api-client/src/client.ts', FG_TRANSPORT)
  writeFile(dir, 'scripts/api-routes-baseline.json', baselineWith({}))
  for (const [rel, content] of Object.entries(files || {})) writeFile(dir, rel, content)
  return dir
}

// ─── FG-1a 阳性对照:api-client 面未注册的 3 段字面量必须**点名到文件与行** ───
test("FG-1 阳性对照:fetchApi<TokenBalance>('/api/user/token-balance') 未注册 ⇒ 逐条点名(票面 :85 第一条)", () => {
  const dir = fgRoot({
    'packages/api-client/src/endpoints/token.ts':
      "export async function getTokenBalance(): Promise<ApiResult<TokenBalance>> {\n  return fetchApi<TokenBalance>('/api/user/token-balance')\n}\n",
  })
  try {
    const r = runScript(dir)
    fgHit('FG-1')
    assert.equal(r.status, 1, `该面这一族必须判红,实得 exit=${r.status}\n${r.out}`)
    assert.match(r.out, /GET \/api\/user\/token-balance/, '路径必须逐字点名')
    assert.match(r.out, /endpoints\/token\.ts/, '必须点名到真实住处的文件')
    // 泛型形态漏抽 = 票面假设①;它一旦回来,这条调用不进调用集 ⇒ 上面两条同时不成立
    assert.match(
      r.out,
      /api-client:文件 \d+ \/ 调用 [1-9]\d*/,
      'api-client 面必须量到调用,不得空扫',
    )
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── FG-1b 反向对照:同一条字面量真在册 ⇒ 不得红(合法写法不得被钉死) ───
test('FG-1 反向对照:同形状换成后端真注册的 GET /api/user/token-balance ⇒ exit 0', () => {
  const dir = fgRoot({
    'apps/api/src/routes/user.ts': "server.get('/api/user/token-balance', async () => ({}))\n",
    'packages/api-client/src/endpoints/token.ts':
      "export async function getTokenBalance(): Promise<ApiResult<TokenBalance>> {\n  return fetchApi<TokenBalance>('/api/user/token-balance')\n}\n",
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `已注册的字面量不得判红\n${r.out}`)
    assert.doesNotMatch(r.out, /缺失|❌/, '报告里不得出现这一族的死调用')
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── FG-2a 阳性对照:同文件"一条已注册(跨行 options 的 POST)+ 一条未注册(泛型 GET)" ⇒ 只许点后者 ───
test("FG-2 阳性对照:fetchApi<UserStatistics>('/api/statistics/user-center') 未注册 ⇒ 点名它且不牵连同文件已注册那条", () => {
  const dir = fgRoot({
    'apps/api/src/routes/users.ts': "server.post('/api/users/change-phone', async () => ({}))\n",
    'packages/api-client/src/endpoints/user.ts': [
      'export async function changePhone(input: ChangePhoneInput): Promise<ApiResult<{ success: boolean }>> {',
      '  return fetchApi<{ success: boolean; user: { id: string } }>(',
      "    '/api/users/change-phone',",
      '    {',
      "      method: 'POST',",
      '      body: JSON.stringify(input),',
      '    },',
      '  )',
      '}',
      '',
      'export async function getUserStatistics(): Promise<ApiResult<UserStatistics>> {',
      "  return fetchApi<UserStatistics>('/api/statistics/user-center')",
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runScript(dir)
    fgHit('FG-2')
    assert.equal(r.status, 1, `未注册那条必须判红,实得 exit=${r.status}\n${r.out}`)
    assert.match(r.out, /GET \/api\/statistics\/user-center/, 'user-center 必须被点名')
    assert.match(r.out, /endpoints\/user\.ts/, '必须点名到 user.ts')
    assert.doesNotMatch(
      r.out,
      /POST \/api\/users\/change-phone/,
      '已注册的跨行 POST 不得被连带判死(逐条判,不是逐文件判)',
    )
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── FG-2b 反向对照:两条都真在册 ⇒ 同形状不得红 ───
test('FG-2 反向对照:两条拼写都后端在册 ⇒ exit 0(该面不得因合法调用变红)', () => {
  const dir = fgRoot({
    'apps/api/src/routes/users.ts':
      "server.post('/api/users/change-phone', async () => ({}))\nserver.get('/api/statistics/user-center', async () => ({}))\n",
    'packages/api-client/src/endpoints/user.ts': [
      'export async function getUserStatistics(): Promise<ApiResult<UserStatistics>> {',
      "  return fetchApi<UserStatistics>('/api/statistics/user-center')",
      '}',
      '',
    ].join('\n'),
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `实得 exit=${r.status}\n${r.out}`)
    assert.doesNotMatch(r.out, /statistics\/user-center.*缺失/)
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── FG-3a 阳性对照:改写前缀字面量今天**静态对账看不见** ⇒ 必须落「未判定」并逐条报名 ───
// 这条测的不是"判红",而是"不许静默":实测该形态在补本档之前,api-client 死调用 0 处 +
// 未判定 0 处 + exit 0 —— 三个数一起把"从没看过这一族"伪装成"已对账且干净"。
test('FG-3 阳性对照:/cozeZhsApi/cache/… 字面量必须被登记成未判定并点名(不得静默算通过)', () => {
  const dir = fgRoot({
    'packages/api-client/src/endpoints/agent.ts':
      "export async function getAgentCategories(): Promise<ApiResult<AgentCategories>> {\n  return fetchApi<AgentCategories>('/cozeZhsApi/cache/agent-category-dict/categories')\n}\n",
  })
  try {
    const r = runScript(dir)
    fgHit('FG-3')
    assert.equal(r.status, 0, `存量这一族当场判红就是恒红门(§12e),本轮只报名不判红\n${r.out}`)
    assert.match(
      r.out,
      /未判定\(改写前缀字面量,静态对账整条看不见\)1 处/,
      '不可见性必须无条件打印且计数为 1(把没判写成判过了是本仓最高频失效型)',
    )
    assert.match(
      r.out,
      /endpoints\/agent\.ts:2 .*\/cozeZhsApi\/cache\/agent-category-dict\/categories.*→归一后 \/api\/cache/,
      '必须点名到站点并给出归一后的拼写',
    )
    assert.doesNotMatch(
      r.out,
      /❌.*cozeZhsApi/,
      '本档只报名不判红:该字面量不得被写成死调用(那是把别人存量钉成恒红)',
    )
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── FG-3b 反向对照:同一形状换成合法 `/api/` 拼写且已注册 ⇒ 不得落进该盲区清单 ───
test('FG-3 反向对照:合法 /api/cache/… 已注册 ⇒ 盲区清单为 0 处且不得点名该文件', () => {
  const dir = fgRoot({
    'apps/api/src/routes/cache.ts':
      "server.get('/api/cache/agent-category-dict/categories', async () => ({}))\n",
    'packages/api-client/src/endpoints/agent.ts':
      "export async function getAgentCategories(): Promise<ApiResult<AgentCategories>> {\n  return fetchApi<AgentCategories>('/api/cache/agent-category-dict/categories')\n}\n",
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `实得 exit=${r.status}\n${r.out}`)
    assert.match(
      r.out,
      /未判定\(改写前缀字面量,静态对账整条看不见\)0 处/,
      '0 处也必须出声,并说清是"这一族射程是空的"而不是"已对账干净"',
    )
    assert.doesNotMatch(r.out, /endpoints\/agent\.ts/, '合法 `/api/` 拼写不得被误登进盲区清单')
  } finally {
    destroyTempRoot(dir)
  }
})

// ─── FG-LOCK 反向锁:三条阳性对照确实各命中一次 + 盲区档必须装车 ───
// 为什么必须有它:删掉一条用例时,`node --test` 的账面照样"全绿"(只是少一例),
// 于是"门声称看得见"重新回到无人喂input 的状态 —— 正是本票立项那一型的再生产。
test('FG-LOCK 反向锁:三条阳性对照各跑恰好一次,且盲区档挂在主流程、识别式只有一份', () => {
  for (const key of ['FG-1', 'FG-2', 'FG-3']) {
    assert.equal(
      FG_HITS.get(key) || 0,
      1,
      `${key} 的阳性对照必须恰好执行一次(实得 ${FG_HITS.get(key) || 0}) —— 缺失=用例被删,>1=夹具漂成两份`,
    )
  }
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(src, /function\s+collectAliasLiteralBlindSites\s*\(/, "③' 的采集器必须在位")
  assert.match(
    src,
    /collectAliasLiteralBlindSites\(\{ frontendFiles, alias \}\)/,
    "③' 必须真挂在 CE 执行段上(定义了没人调 = 提交链上一路绿灯,守门 70/76/81 同型)",
  )
  assert.match(src, /aliasLiteralBlind\.length > 0/, "③' 的输出必须无条件判读,不得嵌进别的分支")
  // 识别式只有一份:三处消费者共用 aliasLiteralRe,门内不得再抄第二张前缀匹配式
  assert.equal(
    (src.match(/rule\.from\.replace\([/]/g) || []).length,
    1,
    '字面量识别式只许写在 aliasLiteralRe 一处(两处各写一遍必然漂移)',
  )
  assert.ok(
    (src.match(/aliasLiteralRe\(rule\)/g) || []).length >= 3,
    "③/③ 的未判定档/③' 必须共用同一份识别式",
  )
  // 事实源仍只有 transport 那一份:判定层不得写死第二张改写表(照 T-CE-7 的同一把尺子)
  const judgeLayerStart = src.indexOf('function runSelfTest')
  assert.ok(judgeLayerStart > 1000, '判定层区段必须切得出来')
  const judgeCode = maskComments(src.slice(0, judgeLayerStart))
  assert.doesNotMatch(
    judgeCode,
    /['"]\/cozeZhsApi['"]/,
    '判定层不得写死改写前缀名(事实源只能是 transport)',
  )
})

// 只判源码形状(§22c:行为由 32/33 与既有 5/6 证,测试不复抄判据)。
// ─── 34. 形状锁:--dump-* 取值必须走唯一出口,不得退回裸 argv[indexOf(...)+1] ──
// 只判源码形状(§22c:行为由 32/33 与既有 5/6 证,测试不复抄判据)。
test('形状锁:dump 旗标取值单点化,旧的两行裸索引形态不得回来', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.doesNotMatch(
    src,
    /process\.argv\[\s*\w*(?:[dD]ump|Dump)\w*Idx\s*\+\s*1\s*\]/,
    '两处站点曾各写一份 `process.argv[<名>Idx + 1]`,该形态不得回来',
  )
  assert.doesNotMatch(src, /argv\[\s*argv\.indexOf\('--dump-/, '裸 indexOf(...)+1 形态不得回来')
  assert.match(src, /function\s+dumpFlagValue\s*\(/, '唯一取值出口必须在位')
  assert.match(src, /dumpFlagValue\('--dump-backend'\)/, '后端档站点必须走出口')
  assert.match(src, /dumpFlagValue\('--dump-missing'\)/, '缺失档站点必须走出口')
  const guardHits = src.match(/startsWith\('-'\)/g) || []
  assert.equal(guardHits.length, 1, '"不以 - 开头"判据只许写在唯一出口一处(两处各抄一份必漂移)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
