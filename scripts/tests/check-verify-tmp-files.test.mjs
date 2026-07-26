import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-verify-tmp-files.mjs')

// 创建临时扫描目录(模拟项目根)
function createTempRoot() {
  return mkdtempSync(join(tmpdir(), 'ihui-verify-'))
}

// 运行脚本并去除 ANSI 颜色码
function runScript(cwd, args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = r.stdout.replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

function writeFile(root, relPath, content = '') {
  const full = join(root, relPath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

// ─── 1. CLI 行为 ─────────────────────────────────────────

test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempRoot()
  try {
    const r = runScript(dir, ['--help'])
    assert.ok(
      r.status === 0 || r.status === 1,
      `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生 Error`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: 无参数运行(空 apps/)→ exit 0 + 无 verify-*.*', () => {
  const dir = createTempRoot()
  try {
    // 创建空 apps/web 让脚本扫描到
    mkdirSync(join(dir, 'apps', 'web'), { recursive: true })
    const r = runScript(dir)
    assert.equal(r.status, 0, `空 apps 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /无 verify-\*\.\* 临时文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 违规检测:apps/*/verify-*.* ───────────────────────

test('违规: apps/web/verify-foo.mjs → 默认 warn exit 0, --strict exit 1', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/verify-foo.mjs', 'console.log("tmp")\n')
    const rDefault = runScript(dir)
    assert.equal(rDefault.status, 0, `默认 warn-only 应 exit 0\nstdout: ${rDefault.out}`)
    assert.match(rDefault.out, /WARN/)
    assert.match(rDefault.out, /verify-foo\.mjs/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1, `--strict 应 exit 1\nstdout: ${rStrict.out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: apps/api/verify-bar.mjs → 默认 warn exit 0, --strict exit 1', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/api/verify-bar.mjs', 'console.log("tmp")\n')
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /verify-bar\.mjs/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: apps/web/src/lib/verify-helper.mjs(子目录)→ 检测到', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/src/lib/verify-helper.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /verify-helper\.mjs/)
    assert.match(r.out, /WARN/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 豁免场景 → 通过 ─────────────────────────────────

test('豁免: apps/web/tests/verify-helper.mjs(测试目录豁免,§23 配套)→ 通过', () => {
  // 源脚本 TEST_DIR_NAMES = ['__tests__', 'tests', 'test', 'spec']
  // tests/ 目录下的 verify-* 是合法测试文件,跳过
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/tests/verify-helper.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `测试目录豁免应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /无 verify-\*\.\* 临时文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: apps/web/__tests__/verify-helper.mjs(__tests__ 目录豁免)→ 通过', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/__tests__/verify-helper.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /无 verify-\*\.\* 临时文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: scripts/verify-*.mjs(不在扫描范围,SCAN_ROOTS=["apps"])→ 通过', () => {
  // 注:源脚本 SCAN_ROOTS 只有 ['apps'],不扫描 scripts/
  // §25 白名单豁免的真正实现是"不在扫描范围",而非显式白名单判断
  const dir = createTempRoot()
  try {
    writeFile(dir, 'scripts/verify-auth-shell.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `scripts/ 不在扫描范围应 exit 0\nstdout: ${r.out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: *.test.mjs / *.spec.ts(不匹配 verify-* 模式)→ 通过', () => {
  // VERIFY_FILE_RE = /^verify-.+\.(mjs|cjs|js|ts|tsx|jsx)$/i
  // verify-foo.test.mjs 不匹配(因为 .test.mjs 后缀不符合 verify-*.ext 模式)
  // 实际上 verify-foo.test.mjs 会匹配!因为正则是 verify-.+\.mjs,而 .test.mjs 里 .mjs 在末尾
  // 让我用 foo.test.mjs(非 verify 开头)来测试
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/foo.test.mjs', 'export const x = 1\n')
    writeFile(dir, 'apps/web/bar.spec.ts', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `非 verify 开头应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /无 verify-\*\.\* 临时文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: apps/web/utils.mjs(非 verify 开头)→ 通过', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/utils.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /无 verify-\*\.\* 临时文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 批量扫描 ─────────────────────────────────────────

test('批量: apps/ 含 3 个 verify-* 文件(2 违规 + 1 在测试目录豁免)→ 报告 2 违规', () => {
  const dir = createTempRoot()
  try {
    writeFile(dir, 'apps/web/verify-tmp1.mjs', 'console.log(1)\n')
    writeFile(dir, 'apps/api/verify-tmp2.mjs', 'console.log(2)\n')
    // tests/ 下的 verify 不算违规(豁免)
    writeFile(dir, 'apps/web/tests/verify-helper.mjs', 'export const x = 1\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `默认 warn-only 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /verify-tmp1\.mjs/)
    assert.match(r.out, /verify-tmp2\.mjs/)
    // 扫描总数应为 2(不算 tests/ 下的)
    assert.match(r.out, /扫描总数: 2/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1, `--strict 2 个警告应 exit 1`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
