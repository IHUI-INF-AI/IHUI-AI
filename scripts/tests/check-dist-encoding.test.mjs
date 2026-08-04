import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-dist-encoding.mjs')

// ─── BOM 字节序常量(与源脚本保持一致) ──────────────────────
const BOM_UTF8 = Buffer.from([0xef, 0xbb, 0xbf])
const BOM_UTF16_LE = Buffer.from([0xff, 0xfe])
const BOM_UTF16_BE = Buffer.from([0xfe, 0xff])

// ─── 辅助:创建临时项目根目录 ─────────────────────────────
function createTempRoot() {
  return mkdtempSync(join(tmpdir(), 'ihui-dist-enc-'))
}

// 辅助:在临时项目下创建一个 package/app(含 dist/<file>,文件内容由 buffer 指定)
// opts: { scope: 'packages'|'apps', name, files: [{ name, content: string|Buffer }] }
function createDistPackage(root, opts) {
  const scope = opts.scope || 'packages'
  const pkgDir = join(root, scope, opts.name)
  const distDir = join(pkgDir, 'dist')
  mkdirSync(distDir, { recursive: true })
  for (const f of opts.files || []) {
    const target = join(distDir, f.name)
    mkdirSync(join(target, '..'), { recursive: true })
    if (Buffer.isBuffer(f.content)) {
      writeFileSync(target, f.content)
    } else {
      writeFileSync(target, f.content, 'utf8')
    }
  }
  return pkgDir
}

// 辅助:运行脚本(stdout/stderr 去除 ANSI 颜色码,便于正则断言)
// 源脚本:console.info→stdout(扫描数/无 BOM 数/成功消息);
//         console.warn→stderr(空目录警告);console.error→stderr(BOM 违规+修复命令)
// 提供 out(stdout)、err(stderr)、all(合并)三种渠道供断言
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

// ─── 1. CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行) ───
test('CLI: --help 不崩溃(脚本未实现 --help,直接走默认扫描)', () => {
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

// ─── 2. 无 packages/ 且无 apps/ 目录 → exit 0 + 警告"未找到" ───
test('无 packages/ 和 apps/ 目录 → exit 0 + 警告"未找到任何 packages/*/dist 或 apps/*/dist"', () => {
  const root = createTempRoot()
  try {
    const r = runScript(root)
    assert.equal(r.status, 0, `空目录应 exit 0\nall: ${r.all}`)
    // 警告走 console.warn → stderr
    assert.match(r.all, /未找到任何 packages\/\*\/dist 或 apps\/\*\/dist/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. packages/ 存在但无 dist 子目录 → exit 0 + 警告 ─────────
test('packages/ 存在但无 dist 子目录 → exit 0 + 警告', () => {
  const root = createTempRoot()
  try {
    mkdirSync(join(root, 'packages', 'no-dist-pkg'), { recursive: true })
    const r = runScript(root)
    assert.equal(r.status, 0, `无 dist 应 exit 0\nall: ${r.all}`)
    assert.match(r.all, /未找到任何 packages\/\*\/dist 或 apps\/\*\/dist/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. dist 文件无 BOM(UTF-8 无 BOM)→ exit 0 ───────────────
test('dist 文件无 BOM(UTF-8 无 BOM)→ exit 0 + 报告"所有 dist 文件均为 UTF-8 无 BOM"', () => {
  const root = createTempRoot()
  try {
    createDistPackage(root, {
      name: 'clean-pkg',
      files: [{ name: 'index.js', content: 'export const a = 1\n' }],
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `无 BOM 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /无 BOM: 1 个文件/)
    assert.match(r.stdout, /所有 dist 文件均为 UTF-8 无 BOM/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. dist 文件含 UTF-8 BOM (0xEF 0xBB 0xBF) → exit 1 ──────
test('dist 文件含 UTF-8 BOM (0xEF 0xBB 0xBF) → exit 1 + 报告 BOM 类型', () => {
  const root = createTempRoot()
  try {
    const content = Buffer.concat([BOM_UTF8, Buffer.from('export const a = 1\n')])
    createDistPackage(root, {
      name: 'utf8-bom-pkg',
      files: [{ name: 'index.js', content }],
    })
    const r = runScript(root)
    assert.equal(r.status, 1, `UTF-8 BOM 应 exit 1\nall: ${r.all}`)
    // 违规报告走 console.error → stderr,用 all 合并渠道断言
    assert.match(r.all, /发现 1 个含 BOM 的 dist 文件/)
    assert.match(r.all, /UTF-8 BOM \(0xEF 0xBB 0xBF\)/)
    assert.match(r.all, /packages[\\/]utf8-bom-pkg[\\/]dist[\\/]index\.js/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. dist 文件含 UTF-16 LE BOM (0xFF 0xFE) → exit 1 ────────
test('dist 文件含 UTF-16 LE BOM (0xFF 0xFE) → exit 1 + 报告 BOM 类型', () => {
  const root = createTempRoot()
  try {
    // 2026-07-19 真实事故根因:PowerShell WriteAllText 默认 UTF-16 LE BOM
    const content = Buffer.concat([BOM_UTF16_LE, Buffer.from('export const a = 1\n')])
    createDistPackage(root, {
      name: 'utf16le-pkg',
      files: [{ name: 'admin-auth.js', content }],
    })
    const r = runScript(root)
    assert.equal(r.status, 1, `UTF-16 LE BOM 应 exit 1\nall: ${r.all}`)
    assert.match(r.all, /发现 1 个含 BOM 的 dist 文件/)
    assert.match(r.all, /UTF-16 LE BOM \(0xFF 0xFE\)/)
    assert.match(r.all, /admin-auth\.js/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. dist 文件含 UTF-16 BE BOM (0xFE 0xFF) → exit 1 ────────
test('dist 文件含 UTF-16 BE BOM (0xFE 0xFF) → exit 1 + 报告 BOM 类型', () => {
  const root = createTempRoot()
  try {
    const content = Buffer.concat([BOM_UTF16_BE, Buffer.from('export const a = 1\n')])
    createDistPackage(root, {
      name: 'utf16be-pkg',
      files: [{ name: 'index.js', content }],
    })
    const r = runScript(root)
    assert.equal(r.status, 1, `UTF-16 BE BOM 应 exit 1\nall: ${r.all}`)
    assert.match(r.all, /发现 1 个含 BOM 的 dist 文件/)
    assert.match(r.all, /UTF-16 BE BOM \(0xFE 0xFF\)/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. 多个 dist 文件含 BOM → 全部报告 ─────────────────────
test('多个 dist 文件含 BOM → 全部报告 + exit 1', () => {
  const root = createTempRoot()
  try {
    createDistPackage(root, {
      name: 'multi-bom',
      files: [
        { name: 'a.js', content: Buffer.concat([BOM_UTF8, Buffer.from('a\n')]) },
        { name: 'b.mjs', content: Buffer.concat([BOM_UTF16_LE, Buffer.from('b\n')]) },
        { name: 'c.css', content: Buffer.concat([BOM_UTF16_BE, Buffer.from('c\n')]) },
      ],
    })
    const r = runScript(root)
    assert.equal(r.status, 1, `多 BOM 应 exit 1\nall: ${r.all}`)
    assert.match(r.all, /发现 3 个含 BOM 的 dist 文件/)
    assert.match(r.all, /a\.js/)
    assert.match(r.all, /b\.mjs/)
    assert.match(r.all, /c\.css/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. apps/*/dist 也在扫描范围 → exit 1 ────────────────────
test('apps/*/dist 文件含 BOM 同样被扫描 → exit 1', () => {
  const root = createTempRoot()
  try {
    createDistPackage(root, {
      scope: 'apps',
      name: 'api',
      files: [{ name: 'endpoints/admin-auth.js', content: Buffer.concat([BOM_UTF16_LE, Buffer.from('x\n')]) }],
    })
    const r = runScript(root)
    assert.equal(r.status, 1, `apps/*/dist BOM 应 exit 1\nall: ${r.all}`)
    assert.match(r.all, /发现 1 个含 BOM 的 dist 文件/)
    assert.match(r.all, /apps[\\/]api[\\/]dist[\\/]endpoints[\\/]admin-auth\.js/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. 目标扩展名过滤(.js .mjs .cjs .ts .map .css .json .html) ─
test('目标扩展名(.js .mjs .cjs .ts .map .css .json .html)中含 BOM → 全部 exit 1', () => {
  const root = createTempRoot()
  try {
    const exts = ['.js', '.mjs', '.cjs', '.ts', '.map', '.css', '.json', '.html']
    const files = exts.map((ext, i) => ({
      name: `f${i}${ext}`,
      content: Buffer.concat([BOM_UTF8, Buffer.from('content\n')]),
    }))
    createDistPackage(root, { name: 'all-exts', files })
    const r = runScript(root)
    assert.equal(r.status, 1, `所有目标扩展名含 BOM 应 exit 1\nall: ${r.all}`)
    assert.match(r.all, /发现 8 个含 BOM 的 dist 文件/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. 非目标扩展名(.txt .md .png)即使含 BOM 也不检测 ─────
test('非目标扩展名(.txt .md .png .svg)即使含 BOM 也不扫描 → exit 0', () => {
  const root = createTempRoot()
  try {
    createDistPackage(root, {
      name: 'ignored-exts',
      files: [
        { name: 'a.txt', content: Buffer.concat([BOM_UTF8, Buffer.from('a\n')]) },
        { name: 'b.md', content: Buffer.concat([BOM_UTF8, Buffer.from('b\n')]) },
        { name: 'c.png', content: Buffer.concat([BOM_UTF8, Buffer.from('c\n')]) },
        { name: 'd.svg', content: Buffer.concat([BOM_UTF8, Buffer.from('d\n')]) },
      ],
    })
    const r = runScript(root)
    // 4 个文件都不在 TARGET_EXTS → collectFiles 跳过 → distFiles.length === 0 → 警告 + exit 0
    assert.equal(r.status, 0, `非目标扩展名应跳过 → exit 0\nall: ${r.all}`)
    assert.match(r.all, /未找到任何 packages\/\*\/dist 或 apps\/\*\/dist/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. 无扩展名文件被跳过 ────────────────────────────────
test('无扩展名文件(如 Makefile/Dockerfile)被跳过 → exit 0', () => {
  const root = createTempRoot()
  try {
    createDistPackage(root, {
      name: 'no-ext',
      files: [
        { name: 'Makefile', content: Buffer.concat([BOM_UTF8, Buffer.from('all:\n')]) },
        { name: 'LICENSE', content: Buffer.concat([BOM_UTF8, Buffer.from('MIT\n')]) },
      ],
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `无扩展名文件应跳过 → exit 0\nall: ${r.all}`)
    assert.match(r.all, /未找到任何 packages\/\*\/dist 或 apps\/\*\/dist/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 13. 空 dist 文件(0 字节)→ 不应误报 BOM → exit 0 ───────
test('空 dist 文件(0 字节)→ 不应误报 BOM → exit 0', () => {
  const root = createTempRoot()
  try {
    createDistPackage(root, {
      name: 'empty-pkg',
      files: [
        { name: 'empty.js', content: Buffer.alloc(0) },
        { name: 'real.js', content: 'export const a = 1\n' },
      ],
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `空文件不应误报 BOM → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /无 BOM: 2 个文件/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14. 文件 < 3 字节(1-2 字节)→ 不应误报 UTF-16 BOM ────
test('文件仅 1-2 字节(非 BOM)→ 不应误报 UTF-16 BOM → exit 0', () => {
  const root = createTempRoot()
  try {
    // 1 字节:0xFF(恰好 UTF-16 LE BOM 第一字节,但无第二字节)
    // 2 字节:0xFE 0x00(0xFE 是 UTF-16 BE 第一字节,但第二字节不是 0xFF)
    createDistPackage(root, {
      name: 'tiny-pkg',
      files: [
        { name: 'one.js', content: Buffer.from([0xff]) },
        { name: 'two.js', content: Buffer.from([0xfe, 0x00]) },
        { name: 'three.js', content: Buffer.from([0xef, 0xbb, 0x00]) }, // 不是完整 UTF-8 BOM
      ],
    })
    const r = runScript(root)
    assert.equal(r.status, 0, `小文件不应误报 BOM → exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /无 BOM: 3 个文件/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 15. 错误输出含 PowerShell 修复命令 + 根因说明 ─────────
test('BOM 违规时输出含 PowerShell 修复命令 + 根因说明(PowerShell WriteAllText 默认 UTF-16 LE BOM)', () => {
  const root = createTempRoot()
  try {
    const content = Buffer.concat([BOM_UTF16_LE, Buffer.from('export const a = 1\n')])
    createDistPackage(root, {
      name: 'fix-cmd-pkg',
      files: [{ name: 'index.js', content }],
    })
    const r = runScript(root)
    assert.equal(r.status, 1, `应 exit 1\nall: ${r.all}`)
    // 修复命令包含 pwsh 关键字和 WriteAllBytes
    assert.match(r.all, /pwsh -Command/)
    assert.match(r.all, /WriteAllBytes/)
    // 根因说明
    assert.match(r.all, /PowerShell WriteAllText 默认 UTF-16 LE BOM 编码/)
    assert.match(r.all, /Turbopack 解析失败/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
