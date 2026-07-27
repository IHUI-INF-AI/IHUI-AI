import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  copyFileSync,
  mkdirSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SOURCE_SCRIPT = join(__dirname, '..', 'check-dedupe.mjs')

// ─── 辅助:创建临时项目(含脚本副本,使 __dirname 解析到 tempdir) ──
// 说明:check-dedupe.mjs 用 __dirname 推导 ROOT(=__dirname/..),
// 故将脚本复制到 tempdir/scripts/,ROOT 即为 tempdir,可完全控制环境。
function createTempProject() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-dedupe-'))
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(SOURCE_SCRIPT, join(dir, 'scripts', 'check-dedupe.mjs'))
  return dir
}

// ─── 辅助:初始化 git 仓库(含初始 commit) ──────────────────
function initGitRepo(dir) {
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, stdio: 'pipe' })
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' })
}

// ─── 辅助:运行临时项目中的脚本副本 ────────────────────────
function runScript(dir, args = []) {
  return spawnSync('node', [join(dir, 'scripts', 'check-dedupe.mjs'), ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
  })
}

// ─── 辅助:去除 ANSI 颜色码 ────────────────────────────────
function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, '')
}

// ─── 1. --staged 非 git 目录 → exit 0(git 命令失败,catch 跳过) ──────
test('--staged: 非 git 目录 → exit 0(git 命令抛错,catch 块退出)', () => {
  const dir = createTempProject()
  try {
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `非 git 目录应 exit 0,实际 ${r.status}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. --staged git 仓库无 staged 文件 → exit 0(跳过) ───────────────
test('--staged: git 仓库无 staged 文件 → exit 0(跳过)', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `无 staged 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /pnpm-lock\.yaml 未变更|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. --staged 暂存其他文件(非 pnpm-lock.yaml)→ exit 0(跳过) ──────
test('--staged: 暂存其他文件(非 pnpm-lock.yaml)→ exit 0(跳过)', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'package.json'), '{}\n')
    execSync('git add package.json', { cwd: dir, stdio: 'pipe' })
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `暂存非 lockfile 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /pnpm-lock\.yaml 未变更|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. --staged pnpm-lock.yaml 已暂存但工作树删除 → exit 0(LOCKFILE 不存在) ─
test('--staged: pnpm-lock.yaml 已暂存但工作树删除 → exit 0(LOCKFILE 不存在)', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfile content\n')
    execSync('git add pnpm-lock.yaml', { cwd: dir, stdio: 'pipe' })
    // 从工作树删除但保留 staged 状态
    rmSync(join(dir, 'pnpm-lock.yaml'))
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `LOCKFILE 不存在应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /未找到 pnpm-lock\.yaml/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. 无 --staged 无 pnpm-lock.yaml → exit 0(跳过) ─────────────────
test('无 --staged: 无 pnpm-lock.yaml → exit 0(跳过)', () => {
  const dir = createTempProject()
  try {
    const r = runScript(dir, [])
    assert.equal(r.status, 0, `无 lockfile 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /未找到 pnpm-lock\.yaml/)
    assert.match(r.stdout, /跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. --staged 暂存 pnpm-lock.yaml.bak(非精确匹配)→ exit 0(跳过) ──
test('--staged: 暂存 pnpm-lock.yaml.bak(非精确匹配)→ exit 0(跳过)', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'pnpm-lock.yaml.bak'), 'backup\n')
    execSync('git add pnpm-lock.yaml.bak', { cwd: dir, stdio: 'pipe' })
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `非精确匹配应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /pnpm-lock\.yaml 未变更|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. --staged 暂存 subdir/pnpm-lock.yaml(非根路径)→ exit 0(跳过) ──
test('--staged: 暂存 subdir/pnpm-lock.yaml(非根路径)→ exit 0(跳过)', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    mkdirSync(join(dir, 'subdir'), { recursive: true })
    writeFileSync(join(dir, 'subdir', 'pnpm-lock.yaml'), 'lockfile\n')
    execSync('git add subdir/pnpm-lock.yaml', { cwd: dir, stdio: 'pipe' })
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `非根路径应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /pnpm-lock\.yaml 未变更|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. --staged 附加额外参数 → 仍识别为 staged 模式 ─────────────────
test('--staged: 附加额外参数(--staged --foo --bar)→ 仍识别 staged 模式', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    const r = runScript(dir, ['--staged', '--foo', '--bar'])
    assert.equal(r.status, 0, `额外参数应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /pnpm-lock\.yaml 未变更|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. 输出含 [check:dedupe] 前缀 ──────────────────────────────────
test('输出: 消息包含 [check:dedupe] 前缀', () => {
  const dir = createTempProject()
  try {
    const r = runScript(dir, [])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /\[check:dedupe\]/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 10. --staged pnpm-lock.yaml 已暂存且存在 → 不跳过,进入 pnpm 检查 ──
test('--staged: pnpm-lock.yaml 已暂存且存在 → 不跳过,进入 pnpm 检查', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'INVALID LOCKFILE\n')
    execSync('git add pnpm-lock.yaml', { cwd: dir, stdio: 'pipe' })
    const r = runScript(dir, ['--staged'])
    // 不应输出"未变更,跳过"
    assert.ok(
      !r.stdout.includes('pnpm-lock.yaml 未变更'),
      'pnpm-lock.yaml 已暂存不应跳过',
    )
    // 应进入 pnpm dedupe 检查
    assert.match(r.stdout, /检查依赖版本碎片化/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. 无 --staged pnpm-lock.yaml 存在 → 进入 pnpm dedupe 检查 ──────
test('无 --staged: pnpm-lock.yaml 存在 → 进入 pnpm dedupe 检查', () => {
  const dir = createTempProject()
  try {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'INVALID LOCKFILE\n')
    const r = runScript(dir, [])
    // 应进入 pnpm dedupe 检查(非跳过)
    assert.match(r.stdout, /检查依赖版本碎片化/)
    // 不应输出"未找到 pnpm-lock.yaml"
    assert.ok(
      !r.stdout.includes('未找到 pnpm-lock.yaml'),
      'lockfile 存在不应输出"未找到"',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 12. pnpm dedupe --check 失败(无效 lockfile)→ exit 非零 + "失败" ──
test('退出码: pnpm dedupe --check 失败 → exit 非零 + 输出"失败"', () => {
  const dir = createTempProject()
  try {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'INVALID LOCKFILE CONTENT\n')
    const r = runScript(dir, [])
    // pnpm 对无效 lockfile 应失败(或 pnpm 未安装时 shell 返回非零)
    assert.notEqual(r.status, 0, `无效 lockfile 应 exit 非零,实际 ${r.status}`)
    assert.ok(r.status !== null, '进程不应超时')
    const combined = stripAnsi(r.stdout + r.stderr)
    assert.match(combined, /失败/)
    assert.match(combined, /pnpm dedupe/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. --staged 多文件暂存(含 pnpm-lock.yaml)→ 不跳过,进入 pnpm 检查 ─
test('--staged: 多文件暂存含 pnpm-lock.yaml → 不跳过,进入 pnpm 检查', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'package.json'), '{}\n')
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'INVALID LOCKFILE\n')
    writeFileSync(join(dir, 'README.md'), '# updated\n')
    execSync('git add package.json pnpm-lock.yaml README.md', {
      cwd: dir,
      stdio: 'pipe',
    })
    const r = runScript(dir, ['--staged'])
    // 不应输出"未变更,跳过"(pnpm-lock.yaml 在暂存列表中)
    assert.ok(
      !r.stdout.includes('pnpm-lock.yaml 未变更'),
      '含 pnpm-lock.yaml 暂存不应跳过',
    )
    // 应进入 pnpm dedupe 检查
    assert.match(r.stdout, /检查依赖版本碎片化/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
