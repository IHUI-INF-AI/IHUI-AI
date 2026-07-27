import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-api-client-utf8.mjs')

// 目标目录(相对项目根):packages/api-client/src/endpoints
const ENDPOINTS_REL = join('packages', 'api-client', 'src', 'endpoints')

// ─── 辅助:创建临时项目根目录 ─────────────────────────────
function createTempRoot() {
  return mkdtempSync(join(tmpdir(), 'ihui-api-cli-utf8-'))
}

// 辅助:在临时项目下创建 endpoints 目录,并写入指定文件
// files: [{ name, content: string|Buffer }]
function createEndpoints(root, files) {
  const dir = join(root, ENDPOINTS_REL)
  mkdirSync(dir, { recursive: true })
  for (const f of files || []) {
    const target = join(dir, f.name)
    mkdirSync(join(target, '..'), { recursive: true })
    if (Buffer.isBuffer(f.content)) {
      writeFileSync(target, f.content)
    } else {
      writeFileSync(target, f.content, 'utf8')
    }
  }
  return dir
}

// 辅助:运行脚本(去除 ANSI 颜色码,便于正则断言)
// 源脚本全部用 console.log → stdout;提供 out(stdout)、err(stderr)、all(合并)
const ANSI_RE = /\x1b\[[0-9;]*m/g
function runScript(cwd) {
  const r = spawnSync('node', [SCRIPT_PATH], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (r.stdout) r.stdout = r.stdout.replace(ANSI_RE, '')
  if (r.stderr) r.stderr = r.stderr.replace(ANSI_RE, '')
  r.all = `${r.stdout || ''}\n${r.stderr || ''}`
  return r
}

// ─── 字节常量 ─────────────────────────────────────────────
// "中":U+4E2D → E4 B8 AD(合法 3 字节 UTF-8)
const ZHONG = Buffer.from([0xe4, 0xb8, 0xad])
// "😀":U+1F600 → F0 9F 98 80(合法 4 字节 UTF-8)
const GRIN = Buffer.from([0xf0, 0x9f, 0x98, 0x80])

// ─── 1. CLI: 空项目根不崩溃(脚本未实现 --help,走默认扫描) ───
test('CLI: 空项目根不崩溃(无 packages/api-client/src/endpoints)', () => {
  const root = createTempRoot()
  try {
    const r = runScript(root)
    assert.ok(
      r.status === 0 || r.status === 1,
      `不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `不应产生未捕获 Error`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 2. 无 packages/api-client/src/endpoints 目录 → exit 0 + 警告 ───
test('无 packages/api-client/src/endpoints 目录 → exit 0 + 警告"未找到 ... 跳过"', () => {
  const root = createTempRoot()
  try {
    const r = runScript(root)
    assert.equal(r.status, 0, `目录不存在应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /未找到/)
    assert.match(r.stdout, /跳过/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. endpoints 目录存在但为空 → exit 0 + 警告"无 .ts 文件" ───
test('endpoints 目录存在但为空 → exit 0 + 警告"无 .ts 文件"', () => {
  const root = createTempRoot()
  try {
    createEndpoints(root, [])
    const r = runScript(root)
    assert.equal(r.status, 0, `空目录应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /无 \.ts 文件/)
    assert.match(r.stdout, /跳过/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. 仅有非 .ts 文件(.js/.json)→ exit 0 + 警告"无 .ts 文件" ───
test('仅有非 .ts 文件(.js/.json)→ exit 0 + 警告"无 .ts 文件"', () => {
  const root = createTempRoot()
  try {
    createEndpoints(root, [
      { name: 'foo.js', content: 'export const a = 1\n' },
      { name: 'bar.json', content: '{"x":1}' },
    ])
    const r = runScript(root)
    assert.equal(r.status, 0, `非 .ts 应跳过 → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /无 \.ts 文件/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. 纯 ASCII .ts 文件 → exit 0 + "UTF-8 干净" + 成功消息 ───
test('纯 ASCII .ts 文件 → exit 0 + "UTF-8 干净: 1 个文件" + 成功消息', () => {
  const root = createTempRoot()
  try {
    createEndpoints(root, [
      { name: 'developer.ts', content: 'export const foo = 1\n' },
    ])
    const r = runScript(root)
    assert.equal(r.status, 0, `纯 ASCII 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /扫描 1 个/)
    assert.match(r.stdout, /UTF-8 干净: 1 个文件/)
    assert.match(r.stdout, /所有 1 个 api-client 源文件字节级 UTF-8 完整/)
    assert.match(r.stdout, /可安全被 tsc 编译/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. 合法中文(3 字节 UTF-8)→ exit 0 ───────────────────
test('合法中文(3 字节 UTF-8)→ exit 0 + 干净', () => {
  const root = createTempRoot()
  try {
    const content = Buffer.concat([
      Buffer.from('export const name = "'),
      ZHONG,
      Buffer.from('"\n'),
    ])
    createEndpoints(root, [{ name: 'misc.ts', content }])
    const r = runScript(root)
    assert.equal(r.status, 0, `合法中文应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /UTF-8 干净: 1 个文件/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. 合法 emoji(4 字节 UTF-8)→ exit 0 ──────────────────
test('合法 emoji(4 字节 UTF-8)→ exit 0 + 干净', () => {
  const root = createTempRoot()
  try {
    const content = Buffer.concat([
      Buffer.from('export const emoji = "'),
      GRIN,
      Buffer.from('"\n'),
    ])
    createEndpoints(root, [{ name: 'share.ts', content }])
    const r = runScript(root)
    assert.equal(r.status, 0, `合法 emoji 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /UTF-8 干净: 1 个文件/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. 空 .ts 文件(0 字节)→ exit 0 + 不误报 ───────────────
test('空 .ts 文件(0 字节)→ exit 0 + 不误报', () => {
  const root = createTempRoot()
  try {
    createEndpoints(root, [
      { name: 'empty.ts', content: Buffer.alloc(0) },
    ])
    const r = runScript(root)
    assert.equal(r.status, 0, `空文件应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /UTF-8 干净: 1 个文件/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. 规则 A:3 字节 UTF-8 第 3 字节为 0x3F → exit 1 ────────
test('规则 A:3 字节 UTF-8 第 3 字节为 0x3F(?) → exit 1 + 报告"3rd byte replaced by 0x3F" + bytes hex', () => {
  const root = createTempRoot()
  try {
    // 0xE4 0xB8 0x3F:0xE4 是中文 3 字节起始,0xB8 合法续字节,0x3F 是损坏
    const corrupted = Buffer.from([0xe4, 0xb8, 0x3f])
    const content = Buffer.concat([
      Buffer.from('export const x = "'),
      corrupted,
      Buffer.from('"\n'),
    ])
    createEndpoints(root, [{ name: 'developer.ts', content }])
    const r = runScript(root)
    assert.equal(r.status, 1, `损坏应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /发现 1 处损坏字节序列/)
    assert.match(r.stdout, /3rd byte replaced by 0x3F/)
    assert.match(r.stdout, /0xe4 0xb8 0x3f/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. 规则 B:2 字节 UTF-8 非法续字节 → exit 1 ────────────
test('规则 B:2 字节 UTF-8 (0xC0-0xDF) 非法续字节 → exit 1 + "2-byte UTF-8 invalid continuation"', () => {
  const root = createTempRoot()
  try {
    // 0xC2 0x00:0xC2 是 2 字节起始,0x00 不是合法续字节(需 0x80-0xBF)
    const content = Buffer.from([0xc2, 0x00])
    createEndpoints(root, [{ name: 'misc.ts', content }])
    const r = runScript(root)
    assert.equal(r.status, 1, `2 字节非法续字节应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /2-byte UTF-8 invalid continuation/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. 规则 B:4 字节 UTF-8 非法续字节 → exit 1 ────────────
test('规则 B:4 字节 UTF-8 (0xF0-0xF7) 非法续字节 → exit 1 + "4-byte UTF-8 invalid continuation"', () => {
  const root = createTempRoot()
  try {
    // 0xF0 0x00 0x80 0x80:0xF0 是 4 字节起始,0x00 不是合法续字节
    const content = Buffer.from([0xf0, 0x00, 0x80, 0x80])
    createEndpoints(root, [{ name: 'payment.ts', content }])
    const r = runScript(root)
    assert.equal(r.status, 1, `4 字节非法续字节应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /4-byte UTF-8 invalid continuation/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. 单独续字节(0x80-0xBF)→ exit 1 + "invalid UTF-8 leading byte" ─
test('单独续字节(0x80)→ exit 1 + "invalid UTF-8 leading byte 0x80"', () => {
  const root = createTempRoot()
  try {
    // 0x80 单独出现,无起始字节
    const content = Buffer.from([0x80])
    createEndpoints(root, [{ name: 'system.ts', content }])
    const r = runScript(root)
    assert.equal(r.status, 1, `单独续字节应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /invalid UTF-8 leading byte 0x80/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 13. 单文件 >5 处违规 → 截断显示"还有 N 处" ─────────────
test('单文件 7 处违规 → 显示前 5 处 + "还有 2 处"截断', () => {
  const root = createTempRoot()
  try {
    // 构造 7 处损坏:7 个 0x80 单独字节
    const content = Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80])
    createEndpoints(root, [{ name: 'multi.ts', content }])
    const r = runScript(root)
    assert.equal(r.status, 1, `多违规应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /发现 7 处损坏字节序列/)
    assert.match(r.stdout, /还有 2 处/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14. 混合:1 干净 + 1 损坏 → exit 1 + 报告路径 + 修复脚本 + 根因 ─
test('混合:1 干净 + 1 损坏 → exit 1 + 报告损坏文件路径 + 修复脚本 + 根因说明(Turbopack/PowerShell)', () => {
  const root = createTempRoot()
  try {
    createEndpoints(root, [
      { name: 'clean.ts', content: 'export const ok = 1\n' },
      { name: 'broken.ts', content: Buffer.from([0xe4, 0xb8, 0x3f]) },
    ])
    const r = runScript(root)
    assert.equal(r.status, 1, `有损坏应 exit 1\nstdout: ${r.stdout}`)
    // 干净文件计入 okCount
    assert.match(r.stdout, /UTF-8 干净: 1 个文件/)
    // 损坏文件路径被报告(含完整相对路径)
    assert.match(r.stdout, /packages[\\/]api-client[\\/]src[\\/]endpoints[\\/]broken\.ts/)
    // 修复脚本含 node -e 和 0x3F 逻辑
    assert.match(r.stdout, /node -e/)
    assert.match(r.stdout, /0x3F/)
    // 根因说明
    assert.match(r.stdout, /Turbopack/)
    assert.match(r.stdout, /PowerShell/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
