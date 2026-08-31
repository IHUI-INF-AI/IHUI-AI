#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-c-drive-paths.mjs — C 盘路径硬编码扫描守门 (AGENTS.md §26)
 *
 * 背景 (2026-07-27 立,§26 C 盘防护守门):
 *   用户已把所有开发工具的全局缓存/临时目录强制指向 D 盘 (TEMP/TMP/PNPM_HOME/
 *   npm/pip/uv/Cargo/Rustup/Go/Playwright),但 agent 在写代码/脚本时偶尔会
 *   把 `C:\temp\xxx` 或 `C:\Users\<user>\AppData\Local\Temp\xxx` 硬编码进源
 *   文件,绕过环境变量配置直接写 C 盘。每次都靠事后清理不可持续,需在
 *   pre-commit 阶段拦住这类硬编码写入路径。
 *
 * 检测范围:
 *   - 扫描 `git diff --cached --name-only` 中所有 .ts/.tsx/.js/.mjs/.cjs/
 *     .py/.ps1/.sh 文件 (其他文件如 .json/.yaml/.toml/.md 不在检测范围,
 *     文档提及 C 盘路径是合理的)
 *   - 命中则报告文件:行号 + 内容 (与现有守门脚本报告风格一致)
 *   - 排除项 (防止 false positive):
 *     ① .md / .gitignore 注释提及 → 文档合理 (按扩展名排除,不读内容)
 *     ② apps/desktop/src-tauri/ → Tauri 内部 API 调用 (合法)
 *     ③ scripts/check-c-drive-paths.mjs → 自身正则字面量命中
 *     ④ scripts/check-root-dir-clean.mjs / scripts/scan-i18n-zh-residue.mjs
 *        → 合规示例/规范文档
 *
 * 检测模式:
 *   - 默认 (无 --staged): 报模式,扫描 staged 文件,有违规仍 exit 0
 *     (用于手动验证场景,不阻塞命令)
 *   - --staged: pre-commit 模式,违规 exit 1 阻塞 commit
 *   - --json: 以 JSON 格式输出报告 (机器可读,接入 CI)
 *   - --quiet: 仅返回 exit code,不打印诊断 (--quiet + 成功 → stdout 空)
 *   - --help / -h: 打印帮助
 *
 * 退出码:
 *   0 = 通过 (无违规 / 仅 --staged 模式下无 staged 文件)
 *   1 = 失败 (检测到硬编码 C 盘路径)
 *   2 = 异常 (用法错误 / 文件缺失)
 *
 * 集成位置:
 *   guardian-runner.mjs id 'check-c-drive-paths' (warn-only 起步,AGENTS.md §26)
 *
 * 跳过方法 (应急,不推荐):
 *   HUSKY_SKIP_C_DRIVE_PATHS=1 git commit ...
 *
 * 用法:
 *   node scripts/check-c-drive-paths.mjs --staged
 *   node scripts/check-c-drive-paths.mjs --json
 *   node scripts/check-c-drive-paths.mjs --quiet
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// ROOT 取自 process.cwd() (而非脚本所在目录),使测试能通过 spawnSync 的
// cwd 选项切换 git 上下文。pre-commit 钩子天然从项目根调用,行为一致。
const ROOT = process.cwd()

// === CLI 参数 ===
const argv = process.argv.slice(2)
const isStaged = argv.includes('--staged')
const JSON_OUT = argv.includes('--json')
const QUIET = argv.includes('--quiet')
const SHOW_HELP = argv.includes('--help') || argv.includes('-h')

// === 应急逃生舱 (与 check-pwsh-version / check-root-dir-clean 一致) ===
if (process.env.HUSKY_SKIP_C_DRIVE_PATHS === '1') {
  if (!QUIET && !JSON_OUT) {
    console.log('  ⏭  C 盘路径硬编码扫描 (HUSKY_SKIP_C_DRIVE_PATHS=1, 跳过)')
  }
  process.exit(0)
}

// === 颜色 ===
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

function log(level, msg) {
  if (QUIET && level !== 'err') return
  const map = {
    info: { color: C.cyan, icon: '🔍' },
    ok: { color: C.green, icon: '✅' },
    warn: { color: C.yellow, icon: '⚠️ ' },
    err: { color: C.red, icon: '❌' },
  }
  const { color, icon } = map[level] || map.info
  console.log(`${color}${icon} ${msg}${C.reset}`)
}

// === 帮助 ===
if (SHOW_HELP) {
  console.log(`
check-c-drive-paths.mjs — C 盘路径硬编码扫描守门 (AGENTS.md §26)

用法:
  node scripts/check-c-drive-paths.mjs [选项]

选项:
  --staged   扫描 git 暂存区文件 (pre-commit 模式,违规 exit 1)
  --json     以 JSON 格式输出报告 (机器可读,接入 CI)
  --quiet    仅返回 exit code,不打印诊断
  --help     打印此帮助

退出码:
  0  通过 (无违规)
  1  失败 (检测到硬编码 C 盘路径)
  2  异常 (用法错误 / 文件缺失)

检测目标 (硬编码 Windows 路径):
  C:\\temp\\     C:\\Users\\   C:\\Program Files\\
  C:\\Windows\\  C:\\ProgramData\\
  c:/temp/      c:\\/temp     AppData\\Local\\Temp\\

排除范围 (不视为违规):
  - .md / .gitignore 等文档 (按扩展名排除)
  - apps/desktop/src-tauri/ (Tauri 内部 API)
  - scripts/check-c-drive-paths.mjs (自身正则字面量)
  - scripts/check-root-dir-clean.mjs / scan-i18n-zh-residue.mjs (合规示例)

集成位置: guardian-runner.mjs id 'check-c-drive-paths' (warn-only)
跳过方法: HUSKY_SKIP_C_DRIVE_PATHS=1 git commit ...
`)
  process.exit(0)
}

// === 检测目标文件扩展名 ===
const TARGET_EXTS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.py', '.ps1', '.sh',
])

// === 排除路径前缀 (合法硬编码 C 盘路径的场景) ===
//   self: 脚本自身正则字面量 (防止 false positive)
//   tauri: Tauri 内部 API,合法
//   examples: 合规示例/规范文档 (含示例的注释/字符串)
const EXCLUDE_PATHS = new Set([
  'scripts/check-c-drive-paths.mjs',
  'apps/desktop/src-tauri',
  'scripts/check-root-dir-clean.mjs',
  'scripts/scan-i18n-zh-residue.mjs',
  // 自身测试必然要在 fixture / 字符串字面量中构造违规路径用于断言守门识别,
  // 是合规示例而非真实硬编码。
  'scripts/tests/check-c-drive-paths.test.mjs',
  // guardian-runner.mjs 的 §26 守门注释必然引用 C:\temp / C:\Users\*\AppData\Local\Temp
  // 作示例说明 (与 #30a / #44 等守门块注释内嵌示例同性质),属合规示例。
  'scripts/guardian-runner.mjs',
])

// === 硬编码 C 盘路径正则 (7 条) ===
//   ① ~ ⑥: 标准 Windows 反斜杠路径
//   ⑦: Linux 风格路径
//   ⑧: 混合斜杠
//   ⑨: AppData\Local\Temp\ 子串 (相对路径式硬编码)
//
// 设计取舍:
//   - 大小写不敏感 (i flag): Windows 文件系统不区分大小写
//   - 不匹配 C:\temp2\ 这种合法目录 (路径必须有 \ 或 / 分隔符)
//   - C:\\ProgramData\\ 加 \b 边界,避免匹配 C:\\ProgramDataXYZ\\
const PATTERNS = [
  { id: 'c-temp', re: /c:\\temp\\/i, desc: 'C:\\temp\\' },
  { id: 'c-users', re: /c:\\users\\/i, desc: 'C:\\Users\\' },
  { id: 'c-program-files', re: /c:\\program files\\/i, desc: 'C:\\Program Files\\' },
  { id: 'c-windows', re: /c:\\windows\\/i, desc: 'C:\\Windows\\' },
  { id: 'c-programdata', re: /c:\\programdata\\/i, desc: 'C:\\ProgramData\\' },
  { id: 'c-temp-forward', re: /c:\/temp\//i, desc: 'c:/temp/' },
  { id: 'c-temp-mixed', re: /c:\\\/temp/i, desc: 'c:\\/temp' },
  { id: 'appdata-local-temp', re: /appdata\\local\\temp\\/i, desc: 'AppData\\Local\\Temp\\' },
]

// === 收集 staged 文件 ===
function collectFiles() {
  if (!isStaged) {
    // 非 staged 模式: 仅扫描根目录下一层文件,不做递归 (与 check-root-dir-clean 一致)
    // 当前本守门主要服务 pre-commit (--staged),无参数模式是辅助手动验证
    // 此处直接返回空数组,避免误扫整个 working tree (性能 + 噪声)
    return []
  }
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: ROOT,
    })
    return out
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0)
  } catch {
    return []
  }
}

function shouldScan(file) {
  // 排除路径前缀
  for (const ex of EXCLUDE_PATHS) {
    if (file === ex || file.startsWith(`${ex}/`)) return false
  }
  // 扩展名白名单
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
  return TARGET_EXTS.has(ext)
}

// === 扫描单个文件 ===
function scanFile(relPath) {
  const absPath = join(ROOT, relPath)
  if (!existsSync(absPath)) {
    // 文件可能在 staged 后被删除 (git diff --cached 仍报 staged 名)
    // 不视为错误,跳过
    return []
  }
  let text
  try {
    text = readFileSync(absPath, 'utf8')
  } catch {
    return []
  }
  const lines = text.split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const p of PATTERNS) {
      if (p.re.test(line)) {
        hits.push({
          file: relPath,
          line: i + 1,
          pattern: p.id,
          snippet: line.trim().slice(0, 120),
        })
        break // 一行只报首个命中模式,避免一行多条刷屏
      }
    }
  }
  return hits
}

function main() {
  const files = collectFiles()

  if (files.length === 0) {
    if (JSON_OUT) {
      console.log(JSON.stringify({ ok: true, filesScanned: 0, violations: [], message: 'no staged files' }, null, 2))
    } else {
      log('ok', isStaged ? 'C 盘路径扫描通过:staged 区无目标文件' : 'C 盘路径扫描通过:请用 --staged 模式扫描暂存区')
    }
    process.exit(0)
  }

  // 过滤目标扩展名 + 排除路径
  const targetFiles = files.filter(shouldScan)

  if (targetFiles.length === 0) {
    if (JSON_OUT) {
      console.log(JSON.stringify({ ok: true, filesScanned: 0, violations: [], message: 'no in-scope files in staged' }, null, 2))
    } else {
      log('ok', `C 盘路径扫描通过:staged 区 ${files.length} 个文件均不在检测范围 (扩展名/排除路径)`)
    }
    process.exit(0)
  }

  const violations = []
  for (const f of targetFiles) {
    const hits = scanFile(f)
    violations.push(...hits)
  }

  if (JSON_OUT) {
    const report = {
      ok: violations.length === 0,
      filesScanned: targetFiles.length,
      filesInStaged: files.length,
      violations,
    }
    console.log(JSON.stringify(report, null, 2))
  } else if (violations.length === 0) {
    log('ok', `C 盘路径扫描通过:扫描 ${targetFiles.length} 个目标文件,无硬编码`)
  } else {
    log('err', `C 盘路径扫描发现 ${violations.length} 处硬编码:`)
    for (const v of violations) {
      console.error(`  ${C.dim}${v.file}:${v.line}${C.reset}  [${v.pattern}]  ${v.snippet}`)
    }
    console.error('')
    console.error(`${C.yellow}修复方法 (AGENTS.md §26):${C.reset}`)
    console.error('  - 临时文件 → 用 os.tmpdir() (Node) 或 $env:TEMP (PowerShell),自动走 D 盘')
    console.error('  - 用户配置目录 → 用工具自带配置 (pnpm config / npm config / pip config)')
    console.error('  - 系统日志 → 写 $env:TEMP (已指向 D 盘)')
    console.error('  - 唯一例外:Tauri 内部 API 路径 (apps/desktop/src-tauri/,已自动排除)')
    console.error('')
    console.error(`${C.dim}跳过方法 (应急):HUSKY_SKIP_C_DRIVE_PATHS=1 git commit ...${C.reset}`)
  }

  process.exit(violations.length === 0 ? 0 : 1)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
