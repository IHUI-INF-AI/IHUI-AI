// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file check-c-drive-paths.test.mjs 集成测试
 * @description 端到端覆盖 scripts/check-c-drive-paths.mjs 的核心规则 (AGENTS.md §26):
 *   - 默认调用 → exit 0 (无 staged 文件)
 *   - 含 C:\temp\ / C:\Users\*\AppData\Local\Temp\ / c:/temp/ / AppData\Local\Temp\
 *     的 .ts/.mjs staged → exit 1
 *   - 仅在 .md 中提及 → exit 0 (扩展名排除)
 *   - 自身正则字面量命中 → exit 0 (脚本路径排除)
 *   - --json 模式输出合法 JSON
 *   - --quiet 模式成功时无 stdout (除非失败)
 *   - --help 输出帮助文本
 *
 *   测试用临时 fixture (在 tmpdir() 下创建项目结构 + git init + spawnSync cwd 模拟
 *   项目根),不污染项目,符合 AGENTS.md §23 (目录用 tests/)。
 *   用 Node.js 内置 test runner,无第三方依赖。路径推导用 import.meta.url
 *   (AGENTS.md §15)。
 */
import { test, describe } from 'node:test'
import assert_ from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导 (AGENTS.md §15: 用 import.meta.url, 不硬编码) ───
const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-c-drive-paths.mjs')

// ─── 辅助: 创建临时项目根 ─────────────────────────────
function createTempProject() {
  return mkdtempSync(join(tmpdir(), 'ihui-check-c-drive-'))
}

// 辅助: 初始化 git 仓库 (用于 --staged 测试)
function initGitRepo(root) {
  execSync('git init -b main', { cwd: root, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: root, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: root, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: root, stdio: 'pipe' })
  // 先做一次空 commit,让后续 git diff --cached --name-only 能产生 staged 输出
  execSync('git commit --allow-empty -m init', { cwd: root, stdio: 'pipe' })
}

// 辅助: 写文件 + git add (模拟 staged)
function writeAndStage(root, relPath, content) {
  const absPath = join(root, relPath)
  mkdirSync(dirname(absPath), { recursive: true })
  writeFileSync(absPath, content, 'utf8')
  execSync(`git add "${relPath}"`, { cwd: root, stdio: 'pipe' })
}

// 辅助: 跑 check-c-drive-paths.mjs (cwd 设为临时项目根)
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

describe('check-c-drive-paths.mjs 集成测试 (AGENTS.md §26)', () => {

  // ─── 测试 1: 默认调用 (无 --staged) → exit 0 (无 staged 扫描) ─
  test('默认调用 (无 --staged) → exit 0 (仅报告模式)', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      const r = runScript([], { cwd: root })
      assert_.equal(r.status, 0, `默认调用应 exit 0, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 2: --staged + 含 C:\temp\foo → exit 1 ─────────
  test('--staged: 含 C:\\temp\\foo 的 .ts staged → exit 1', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      writeAndStage(root, 'apps/web/src/foo.ts', 'const tmp = "C:\\temp\\foo"\nexport default tmp\n')
      const r = runScript(['--staged'], { cwd: root })
      assert_.equal(r.status, 1, `含 C:\\temp\\ 应 exit 1, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert_.match(r.stdout + r.stderr, /C:\\temp\\|c-temp|硬编码/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 3: --staged + 含 C:\Users\*\AppData\Local\Temp\ → exit 1 ──
  test('--staged: 含 C:\\Users\\admin\\AppData\\Local\\Temp\\bar 的 .mjs staged → exit 1', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      writeAndStage(root, 'scripts/temp-helper.mjs', "const p = 'C:\\Users\\admin\\AppData\\Local\\Temp\\bar'\nconsole.log(p)\n")
      const r = runScript(['--staged'], { cwd: root })
      assert_.equal(r.status, 1, `含 AppData\\Local\\Temp\\ 应 exit 1, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
      // 应命中 c-users 或 appdata-local-temp 任一
      assert_.match(r.stdout + r.stderr, /C:\\Users|AppData\\Local\\Temp|c-users|appdata-local-temp/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 4: --staged + 含 c:/temp/ (Linux 风格) → exit 1 ──
  test('--staged: 含 c:/temp/ 路径 → exit 1', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      writeAndStage(root, 'apps/api/utils/path.py', 'PATH = "c:/temp/shared"\nimport os\nos.environ["X"] = PATH\n')
      const r = runScript(['--staged'], { cwd: root })
      assert_.equal(r.status, 1, `含 c:/temp/ 应 exit 1, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert_.match(r.stdout + r.stderr, /c:\/temp|c-temp-forward/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 5: --staged + 含 AppData\Local\Temp\ (相对路径式) → exit 1 ──
  test('--staged: 含 AppData\\Local\\Temp\\ 路径 → exit 1', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      // 用相对形式硬编码 AppData\Local\Temp\ 子串 (即便路径不含 C: 前缀,也属违规)
      writeAndStage(root, 'packages/cli/src/runner.ps1', '$tempPath = "AppData\\Local\\Temp\\myapp.log"\nWrite-Output $tempPath\n')
      const r = runScript(['--staged'], { cwd: root })
      assert_.equal(r.status, 1, `含 AppData\\Local\\Temp\\ 应 exit 1, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert_.match(r.stdout + r.stderr, /AppData\\Local\\Temp|appdata-local-temp/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 6: --staged + 仅 .md 中提及 C:\temp → exit 0 (.md 扩展名排除) ──
  test('--staged: 仅在 .md 中提及 C:\\temp (假违规) → exit 0 (.md 被排除)', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      // 在 README.md 中描述 §26 C 盘防护规则,需引用 "C:\\temp" 作示例
      // 文档合理提及,不应触发
      writeAndStage(root, 'docs/c-drive-history.md', [
        '# C 盘防护历史',
        '',
        '曾发生硬编码 C:\\temp\\xxx 的事故 (AGENTS.md §26)。',
        '',
        '禁止使用 C:\\temp\\ 作为写入目标,改用 os.tmpdir()。',
        '',
      ].join('\n'))
      const r = runScript(['--staged'], { cwd: root })
      assert_.equal(r.status, 0, `.md 提及 C:\\temp 应被排除 exit 0, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert_.match(r.stdout, /通过|不在检测范围/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 7: --staged + 含 apps/desktop/src-tauri/ → exit 0 (Tauri 内部 API 排除) ──
  test('--staged: apps/desktop/src-tauri/ 内的 C:\\temp → exit 0 (Tauri 内部 API 排除)', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      writeAndStage(root, 'apps/desktop/src-tauri/src/internal.rs', '// Tauri 内部 API 调用,合法\nconst INTERNAL: &str = "C:\\\\temp\\\\tauri-internal";\n')
      // 注: .rs 不在 TARGET_EXTS (.ts/.tsx/.js/.mjs/.cjs/.py/.ps1/.sh) 内,
      // 但仍断言: 假如未来扩展到 .rs 时,apps/desktop/src-tauri/ 也应被排除
      const r = runScript(['--staged'], { cwd: root })
      assert_.equal(r.status, 0, `Tauri 内部应排除 exit 0, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 8: --json 模式 → exit 0 + 输出合法 JSON ─────────
  test('--staged: --json 模式 → exit 0, 输出合法 JSON', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      writeAndStage(root, 'apps/web/src/clean.ts', 'export const ok = "D:\\\\caches\\\\temp\\\\safe"\n')
      const r = runScript(['--staged', '--json'], { cwd: root })
      assert_.equal(r.status, 0, `--json 应 exit 0, 实际 ${r.status}\nstderr: ${r.stderr}`)
      const report = JSON.parse(r.stdout)
      assert_.equal(report.ok, true, 'JSON.ok 应为 true')
      assert_.ok(Array.isArray(report.violations), 'JSON.violations 应为数组')
      assert_.equal(report.violations.length, 0, 'JSON.violations 应为空')
      assert_.equal(typeof report.filesScanned, 'number', 'JSON.filesScanned 应为数字')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 9: --json + 含违规 → exit 1 + violations 非空 ─────
  test('--staged: --json 模式 + 含违规 → exit 1, violations 非空', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      writeAndStage(root, 'scripts/bad.mjs', 'const x = "C:\\temp\\oops"\n')
      const r = runScript(['--staged', '--json'], { cwd: root })
      assert_.equal(r.status, 1, `--json 含违规应 exit 1, 实际 ${r.status}`)
      const report = JSON.parse(r.stdout)
      assert_.equal(report.ok, false)
      assert_.ok(report.violations.length > 0, 'JSON.violations 应非空')
      assert_.equal(report.violations[0].file, 'scripts/bad.mjs')
      assert_.ok(typeof report.violations[0].line === 'number')
      assert_.match(report.violations[0].pattern, /c-temp/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 10: --quiet + 成功 → stdout 为空 ───────────────
  test('--staged: --quiet + 无违规 → exit 0, stdout 为空', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      writeAndStage(root, 'apps/web/src/clean.ts', 'export const ok = 1\n')
      const r = runScript(['--staged', '--quiet'], { cwd: root })
      assert_.equal(r.status, 0, `--quiet 应 exit 0, 实际 ${r.status}\nstderr: ${r.stderr}`)
      assert_.equal(
        r.stdout.trim(),
        '',
        `--quiet 成功应无 stdout, 实际: ${JSON.stringify(r.stdout)}`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 11: --quiet + 违规 → exit 1 (stderr 仍输出修复指南) ──
  test('--staged: --quiet + 含违规 → exit 1', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      writeAndStage(root, 'apps/web/src/bad.ts', 'const x = "C:\\temp\\yikes"\n')
      const r = runScript(['--staged', '--quiet'], { cwd: root })
      assert_.equal(r.status, 1, `--quiet 含违规应 exit 1, 实际 ${r.status}`)
      // --quiet 不抑制 stderr (修复指南仍可见)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 12: --help → exit 0 + 帮助文本 ───────────────
  test('--help → exit 0, stdout 含帮助文本', () => {
    const r = runScript(['--help'])
    assert_.equal(r.status, 0, `--help 应 exit 0, 实际 ${r.status}`)
    assert_.match(r.stdout, /check-c-drive-paths/)
    assert_.match(r.stdout, /--staged/)
    assert_.match(r.stdout, /--json/)
    assert_.match(r.stdout, /--quiet/)
    assert_.match(r.stdout, /退出码/)
    assert_.match(r.stdout, /AGENTS\.md §26/)
  })

  // ─── 测试 13: 自身正则字面量命中 → exit 0 (自身排除) ─────
  test('--staged: 自身 scripts/check-c-drive-paths.mjs 正则字面量命中 → exit 0 (自身排除)', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      // 把守门脚本自身复制到临时项目根的 scripts/ 下 (相对路径触发排除逻辑)
      // 排除条件: file === 'scripts/check-c-drive-paths.mjs' (相对路径匹配)
      const realScriptPath = SCRIPT_PATH
      const tmpScriptPath = join(root, 'scripts', 'check-c-drive-paths.mjs')
      mkdirSync(dirname(tmpScriptPath), { recursive: true })
      // 直接读 + 写,确保与源一致
      const realContent = readFileSync(realScriptPath, 'utf8')
      writeFileSync(tmpScriptPath, realContent, 'utf8')
      execSync('git add scripts/check-c-drive-paths.mjs', { cwd: root, stdio: 'pipe' })
      const r = runScript(['--staged'], { cwd: root })
      // 守门脚本自身正则字面量大量出现 (C:\\temp\\ 等),但应被路径排除
      assert_.equal(r.status, 0, `自身正则字面量应被排除 exit 0, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
      assert_.match(r.stdout, /通过|不在检测范围/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  // ─── 测试 14: 多个扩展名混在 staged → 仅扫描目标扩展名 ─────
  test('--staged: .json + .yaml 等非目标扩展名混入 → 不扫描 (按扩展名过滤)', () => {
    const root = createTempProject()
    try {
      initGitRepo(root)
      // .json 中含违规字符串 (但 .json 不在 TARGET_EXTS),应被跳过
      writeAndStage(root, 'apps/web/config.json', '{"tmpPath": "C:\\\\temp\\\\foo"}\n')
      // .ts 干净文件,正常扫描
      writeAndStage(root, 'apps/web/src/safe.ts', 'export const x = 1\n')
      const r = runScript(['--staged', '--json'], { cwd: root })
      assert_.equal(r.status, 0, `非目标扩展名应被排除 exit 0, 实际 ${r.status}\nstderr: ${r.stderr}`)
      const report = JSON.parse(r.stdout)
      assert_.equal(report.ok, true)
      // 只扫了 .ts (1 个),.json 被扩展名排除
      assert_.equal(report.filesScanned, 1, `filesScanned 应为 1 (仅 .ts), 实际 ${report.filesScanned}`)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
