import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-safe-parse.mjs')

// ─── 辅助:创建临时目录作为 monorepo 根(process.cwd()) ────
// check-safe-parse.mjs 用 process.cwd() 推导 apps/api/src/routes,
// 不调用 git,所以无需 git init,只需目录结构匹配。
function createTempRoot({ withRoutesDir = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-safe-parse-'))
  if (withRoutesDir) {
    mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
  }
  return dir
}

// ─── 辅助:在 routes 目录下创建 .ts 文件(自动建父目录) ─────
function writeRoute(dir, fileName, content = '') {
  const full = join(dir, 'apps', 'api', 'src', 'routes', fileName)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

// ─── 辅助:运行脚本,返回去除 ANSI 颜色码的输出 ─────────────
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
// 1. 目录与退出码基础
// ═══════════════════════════════════════════════════════════

// ─── 1. 目录不存在: apps/api/src/routes 缺失 → exit 1 ──────
test('目录不存在: apps/api/src/routes 缺失 → exit 1 + 报告目录不存在', () => {
  const dir = createTempRoot({ withRoutesDir: false })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 1, `目录不存在应 exit 1\nstdout: ${r.out}\nstderr: ${r.stderr}`)
    assert.match(r.out, /目录不存在|❌/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 空目录: routes 存在但无 .ts 文件 → exit 0 + 0 处 silent-ignore ─
test('空目录: routes 存在但无 .ts 文件 → exit 0 + 0 处 silent-ignore', () => {
  const dir = createTempRoot()
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `空目录应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /0 处 silent-ignore/)
    assert.match(r.out, /✅/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 2. 安全模式(检测规则核心:各种 .success 检查方式)
// ═══════════════════════════════════════════════════════════

// ─── 3. 安全: 直接赋值 + if (!x.success) 检查 → exit 0 ──────
test('安全: const x = schema.safeParse() + if (!x.success) → exit 0', () => {
  const dir = createTempRoot()
  try {
    writeRoute(
      dir,
      'safe.ts',
      [
        'server.post("/api/x", async (req) => {',
        '  const result = schema.safeParse(req.body)',
        '  if (!result.success) return { code: 400 }',
        '  return { code: 200 }',
        '})',
      ].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `检查 .success 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /0 处 silent-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 安全: 解构含 success → exit 0(解构时即视为已检查) ──
test('安全: const { success, data } = schema.safeParse() → exit 0', () => {
  const dir = createTempRoot()
  try {
    writeRoute(
      dir,
      'destructure.ts',
      [
        'server.post("/api/y", async (req) => {',
        '  const { success, data } = schema.safeParse(req.body)',
        '  if (!success) return { code: 400 }',
        '  return data',
        '})',
      ].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `解构 success 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /0 处 silent-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. 安全: 用 if (!result) 否定检查 → exit 0 ─────────────
test('安全: 用 if (!result) 否定检查 → exit 0', () => {
  const dir = createTempRoot()
  try {
    writeRoute(
      dir,
      'negation.ts',
      [
        'server.post("/api/z", async (req) => {',
        '  const result = schema.safeParse(req.body)',
        '  if (!result) return { code: 400 }',
        '  return result.data',
        '})',
      ].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `!result 检查应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /0 处 silent-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. 安全: 用 result === false 检查 → exit 0 ─────────────
test('安全: 用 if (result === false) 检查 → exit 0', () => {
  const dir = createTempRoot()
  try {
    writeRoute(
      dir,
      'false-check.ts',
      [
        'server.post("/api/w", async (req) => {',
        '  const result = schema.safeParse(req.body)',
        '  if (result === false) return { code: 400 }',
        '  return result.data',
        '})',
      ].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `=== false 检查应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /0 处 silent-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 安全: .success 检查在第 8 行(lookAhead 边界)→ exit 0 ──
test('安全: .success 检查在 lookAhead 第 8 行(边界)→ exit 0', () => {
  const dir = createTempRoot()
  try {
    const lines = [
      'server.post("/api/edge", async (req) => {', // idx=0
      '  const result = schema.safeParse(req.body)', // idx=1 (safeParse 在此)
    ]
    // 插入 7 行无关代码(idx=2~8),.success 检查放 idx=9
    // lookAhead=8 → fwd 从 idx+1=2 到 idx+8=9(含),fwd=9 < idx+1+8=10 → 命中
    for (let i = 0; i < 7; i++) lines.push(`  const noop${i} = ${i}`)
    lines.push('  if (!result.success) return { code: 400 }')
    lines.push('  return { code: 200 }')
    lines.push('})')
    writeRoute(dir, 'edge-safe.ts', lines.join('\n'))
    const r = runScript(dir)
    assert.equal(r.status, 0, `第 8 行边界检查应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /0 处 silent-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 3. 违规检测(silent-ignore)
// ═══════════════════════════════════════════════════════════

// ─── 8. 违规: silent-ignore(无 .success 检查)→ 报告 + exit 0(警告模式) ─
test('违规: silent-ignore(无 .success 检查)→ 报告 + exit 0(警告模式不阻塞)', () => {
  const dir = createTempRoot()
  try {
    writeRoute(
      dir,
      'unsafe.ts',
      [
        'server.post("/api/unsafe", async (req) => {',
        '  const result = schema.safeParse(req.body)',
        '  return { data: result.data }',
        '})',
      ].join('\n'),
    )
    const r = runScript(dir)
    // 警告模式:即使有违规也 exit 0(不阻塞 CI,源脚本第 21 行注释)
    assert.equal(r.status, 0, `警告模式应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /1 处 silent-ignore/)
    assert.match(r.out, /unsafe\.ts/)
    assert.match(r.out, /silent-ignore 风险/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. 违规: .success 检查超过 8 行外(第 9 行)→ 报告 ─────
test('违规: .success 检查超过 lookAhead 8 行(第 9 行)→ 报告 silent-ignore', () => {
  const dir = createTempRoot()
  try {
    const lines = [
      'server.post("/api/late", async (req) => {', // idx=0
      '  const result = schema.safeParse(req.body)', // idx=1
    ]
    // 插入 8 行无关代码(idx=2~9),.success 检查放 idx=10
    // lookAhead=8 → fwd 从 idx+1=2 到 idx+8=9(含),fwd=10 < 10 为 false → 未检查
    for (let i = 0; i < 8; i++) lines.push(`  const noop${i} = ${i}`)
    lines.push('  if (!result.success) return { code: 400 }')
    lines.push('  return { code: 200 }')
    lines.push('})')
    writeRoute(dir, 'too-late.ts', lines.join('\n'))
    const r = runScript(dir)
    assert.equal(r.status, 0, `警告模式应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /1 处 silent-ignore/)
    assert.match(r.out, /too-late\.ts/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 4. 多行赋值(跨行 const x =\n  schema.safeParse())
// ═══════════════════════════════════════════════════════════

// ─── 10. 多行赋值: const x =\n  schema.safeParse() + 检查 → exit 0 ─
test('多行赋值: const x =\\n  schema.safeParse() + if (!x.success) → exit 0', () => {
  const dir = createTempRoot()
  try {
    writeRoute(
      dir,
      'multiline.ts',
      [
        'server.post("/api/multi", async (req) => {',
        '  const result =',
        '    schema.safeParse(req.body)',
        '  if (!result.success) return { code: 400 }',
        '  return result.data',
        '})',
      ].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `多行赋值+检查应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /0 处 silent-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 5. 多文件批量扫描
// ═══════════════════════════════════════════════════════════

// ─── 11. 批量: 2 文件(1 安全 + 1 违规)→ 仅报告违规文件 ───
test('批量: 2 文件(1 安全 + 1 违规)→ 仅报告违规文件', () => {
  const dir = createTempRoot()
  try {
    // 用 clean.ts 避免文件名子串冲突(unsafe.ts 含 safe.ts 子串)
    writeRoute(
      dir,
      'clean.ts',
      [
        'server.get("/api/clean", async (req) => {',
        '  const r = schema.safeParse(req.body)',
        '  if (!r.success) return { code: 400 }',
        '  return r.data',
        '})',
      ].join('\n'),
    )
    writeRoute(
      dir,
      'unsafe.ts',
      [
        'server.post("/api/unsafe", async (req) => {',
        '  const r = schema.safeParse(req.body)',
        '  return r.data',
        '})',
      ].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `警告模式应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /1 处 silent-ignore/)
    assert.match(r.out, /unsafe\.ts/)
    assert.ok(
      !r.out.includes('clean.ts'),
      `安全文件不应出现在违规列表中\nstdout: ${r.out}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 6. 文件过滤(扩展名)
// ═══════════════════════════════════════════════════════════

// ─── 12. 非 .ts 文件(.js)不被扫描 → 0 silent-ignore ────────
test('过滤: .js 文件不被扫描(仅 .ts)→ 0 处 silent-ignore', () => {
  const dir = createTempRoot()
  try {
    // 在 routes 目录写 .js 文件(应被忽略,collectFiles 仅收集 .ts)
    const full = join(dir, 'apps', 'api', 'src', 'routes', 'ignore.js')
    writeFileSync(
      full,
      [
        'server.post("/api/ignore", async (req) => {',
        '  const result = schema.safeParse(req.body)',
        '  return result.data',
        '})',
      ].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `.js 不被扫描应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /0 处 silent-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 7. 统计输出
// ═══════════════════════════════════════════════════════════

// ─── 13. 统计: 输出路由数 + safeParse 数 + silent-ignore 数 ─
test('统计: 输出路由数 + safeParse 数 + silent-ignore 数', () => {
  const dir = createTempRoot()
  try {
    writeRoute(
      dir,
      'stats.ts',
      [
        'server.get("/api/a", async (req) => {',
        '  const r = schema.safeParse(req.body)',
        '  if (!r.success) return 400',
        '  return r.data',
        '})',
        'server.post("/api/b", async (req) => {',
        '  const r2 = schema2.safeParse(req.body)',
        '  return r2.data',
        '})',
      ].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `警告模式应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /路由数:\s+2/)
    assert.match(r.out, /safeParse 调用:\s+2/)
    assert.match(r.out, /silent-ignore 风险:\s+1/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 8. 多 safeParse 调用(同文件)
// ═══════════════════════════════════════════════════════════

// ─── 14. 多 safeParse: 同文件 2 处均违规 → 报告 2 处 ─────────
test('多 safeParse: 同文件 2 处均违规 → 报告 2 处 silent-ignore', () => {
  const dir = createTempRoot()
  try {
    writeRoute(
      dir,
      'multi.ts',
      [
        'server.get("/api/m1", async (req) => {',
        '  const r1 = schema.safeParse(req.body)',
        '  const r2 = schema2.safeParse(req.query)',
        '  return { a: r1.data, b: r2.data }',
        '})',
      ].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `警告模式应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /2 处 silent-ignore/)
    assert.match(r.out, /multi\.ts/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
