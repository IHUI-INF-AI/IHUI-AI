import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-parent-pollution.mjs')

// ─── 运行脚本并去除 ANSI 颜色码,便于正则断言 ───
function runScript(args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.err = (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// ═══════════════════════════════════════════════════════════════
// 正则规则单元测试(源脚本未导出函数,直接复制正则验证规则逻辑)
// 与 check-commit-loss-guard.test.mjs 同款做法:正则复制自源脚本
// ═══════════════════════════════════════════════════════════════

const SUSPICIOUS_EXTS = new Set([
  '.ps1', '.psm1', '.bat', '.cmd', '.sh',
  '.py', '.js', '.mjs', '.cjs', '.ts',
  '.txt', '.log', '.tmp',
])

const AGENT_FILENAME_PATTERNS = [
  /^search_.*\.(ps1|py|sh|bat|txt|js|mjs)$/i,
  /_search_.*\.(ps1|py|sh|bat|txt)$/i,
  /_search_result.*\.txt$/i,
  /^search_result.*\.txt$/i,
  /^uuyc.*\.(ps1|txt|log)$/i,
  /^tmp_.*\.(ps1|py|sh|bat|txt|js|mjs)$/i,
  /^ihui[-_].*\.(ps1|py|sh|bat|txt|js|mjs|json)$/i,
  /^test_.*\.(ps1|py|sh|bat)$/i,
  /^debug_.*\.(txt|log|ps1)$/i,
  /^cleanup.*\.(ps1|py|sh|bat)$/i,
  /^fix_.*\.(ps1|py|sh|bat)$/i,
  /^migrate.*\.(ps1|py|sh|bat)$/i,
  /^scan_.*\.(ps1|py|sh|bat|txt)$/i,
  /_result\.txt$/i,
  /_output\.txt$/i,
  /_list\.txt$/i,
]

const AGENT_OP_TRACES = [
  /Get-ChildItem/i,
  /Write-Output/i,
  /Out-File/i,
  /Set-Content/i,
  /Add-Content/i,
  /Remove-Item/i,
  /Copy-Item/i,
  /Move-Item/i,
  /New-Item/i,
  /Select-Object/i,
  /Format-Table/i,
  /Format-List/i,
  /\$ErrorActionPreference/i,
  /\[Console\]::OutputEncoding/i,
  /WriteAllBytes|WriteAllText/i,
  /require\(['"]fs['"]\)/,
  /import.*from\s+['"]node:fs['"]/,
]

const PROJECT_REF_PATTERNS = [
  /IHUI[-_]?AI/i,
  /d:\\桌面\\项目/i,
  /D:\\桌面\\项目/i,
  /桌面\\项目/i,
  /apps[\\/]web[\\/]/,
  /apps[\\/]api[\\/]/,
  /apps[\\/]ai-service[\\/]/,
  /apps[\\/]extension[\\/]/,
  /apps[\\/]desktop[\\/]/,
  /apps[\\/]miniapp-taro[\\/]/,
  /apps[\\/]mobile-rn[\\/]/,
  /apps[\\/]cli[\\/]/,
  /packages[\\/]database[\\/]/,
  /packages[\\/]auth[\\/]/,
  /packages[\\/]types[\\/]/,
  /packages[\\/]ui([-_]?react)?[\\/]/,
  /@ihui\//i,
  /@ihui[-_]/i,
]

const USER_LEGIT_PATTERNS = [
  /\.lnk$/i,
  /\.url$/i,
  /\.(docx?|xlsx?|pptx?|pdf|odt|ods|odp)$/i,
  /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico|tiff?)$/i,
  /\.(mp4|mp3|wav|avi|mkv|flv|mov|wma|flac)$/i,
  /\.(zip|rar|7z|tar|gz|bz2|xz)$/i,
  /\.(exe|msi|dmg|pkg|deb|rpm|appimage)$/i,
  /^desktop\.ini$/i,
  /^Thumbs\.db$/i,
  /^项目端口分析与维护成本优化\.md$/i,
]

function matchesAgentFilenamePattern(filename) {
  return AGENT_FILENAME_PATTERNS.some(p => p.test(filename))
}

function isUserLegit(filename) {
  return USER_LEGIT_PATTERNS.some(p => p.test(filename))
}

// 模拟源脚本 scanFileContent 的双信号判定
function contentTriggers(content) {
  const hasProjectRef = PROJECT_REF_PATTERNS.some(p => p.test(content))
  const hasAgentOp = AGENT_OP_TRACES.some(p => p.test(content))
  return hasProjectRef && hasAgentOp
}

// ═══════════════════════════════════════════════════════════════
// 1. CLI 行为测试(基线干净:实际环境 g:\ 已无 agent 污染)
// ═══════════════════════════════════════════════════════════════

test('CLI: 默认模式(基线干净)→ exit 0 + stdout 含 "✅" + "无 agent 污染"', () => {
  const r = runScript()
  assert.equal(r.status, 0, `基线应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
  assert.match(r.out, /✅/)
  assert.match(r.out, /无 agent 污染/)
})

test('CLI: --warn / --auto-clean 模式(基线干净)→ 均 exit 0', () => {
  for (const flag of ['--warn', '--auto-clean']) {
    const r = runScript([flag])
    assert.equal(r.status, 0, `${flag} 基线应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    // 无污染时走主流程,均打印 "✅ ... 无 agent 污染"
    assert.match(r.out, /✅|无 agent 污染/, `${flag} 应有 ✅ 或 "无 agent 污染" 输出`)
  }
})

test('CLI: --quiet 模式(基线干净)→ exit 0 + stdout 静默(无 ✅ 输出)', () => {
  const r = runScript(['--quiet'])
  assert.equal(r.status, 0, `--quiet 应 exit 0\nstdout: ${r.out}`)
  // --quiet 抑制 console.log("✅ ..." ),stdout 应为空
  assert.equal(r.out.trim(), '', `--quiet 应静默 stdout,实际: "${r.out}"`)
})

test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const r = runScript(['--help'])
  assert.ok(
    r.status === 0 || r.status === 1,
    `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.err}`,
  )
  assert.ok(!r.err.includes('Error:'), `--help 不应产生 Error 输出`)
  assert.ok(!r.err.includes('TypeError'), `--help 不应产生 TypeError`)
})

// ═══════════════════════════════════════════════════════════════
// 2. 文件名强信号检测(AGENT_FILENAME_PATTERNS,§15 命中即 block)
// ═══════════════════════════════════════════════════════════════

test('文件名强信号: search_* / *_result.txt / *_output.txt / *_list.txt → 匹配', () => {
  // search_* 前缀(§15 历史事故命名 search_uuyc.ps1)
  assert.ok(matchesAgentFilenamePattern('search_uuyc.ps1'), 'search_*.ps1 应匹配')
  assert.ok(matchesAgentFilenamePattern('search_find.py'), 'search_*.py 应匹配')
  assert.ok(matchesAgentFilenamePattern('search_files.txt'), 'search_*.txt 应匹配')
  // _result.txt / _output.txt / _list.txt 后缀(强信号)
  assert.ok(matchesAgentFilenamePattern('uuyc_result.txt'), '_result.txt 应匹配')
  assert.ok(matchesAgentFilenamePattern('search_result.txt'), '^search_result*.txt 应匹配')
  assert.ok(matchesAgentFilenamePattern('scan_output.txt'), '_output.txt 应匹配')
  assert.ok(matchesAgentFilenamePattern('list_list.txt'), '_list.txt 应匹配')
})

test('文件名强信号: ihui-* / tmp_* / test_* / debug_* / cleanup* / fix_* / migrate* / scan_* → 匹配', () => {
  assert.ok(matchesAgentFilenamePattern('ihui-clean.ps1'), 'ihui-*.ps1 应匹配')
  assert.ok(matchesAgentFilenamePattern('ihui_test.json'), 'ihui_*.json 应匹配')
  assert.ok(matchesAgentFilenamePattern('tmp_find.ps1'), 'tmp_*.ps1 应匹配')
  assert.ok(matchesAgentFilenamePattern('test_check.ps1'), 'test_*.ps1 应匹配')
  assert.ok(matchesAgentFilenamePattern('debug_2024.log'), 'debug_*.log 应匹配')
  assert.ok(matchesAgentFilenamePattern('cleanup_junk.ps1'), 'cleanup*.ps1 应匹配')
  assert.ok(matchesAgentFilenamePattern('fix_sidebar.ps1'), 'fix_*.ps1 应匹配')
  assert.ok(matchesAgentFilenamePattern('migrate_db.ps1'), 'migrate*.ps1 应匹配')
  assert.ok(matchesAgentFilenamePattern('scan_ports.ps1'), 'scan_*.ps1 应匹配')
})

test('文件名强信号: 普通合法文件名 → 不匹配(避免误伤用户脚本)', () => {
  assert.ok(!matchesAgentFilenamePattern('normal.txt'), 'normal.txt 不应匹配')
  assert.ok(!matchesAgentFilenamePattern('README.md'), 'README.md 不应匹配(后缀 .md 不在任何模式)')
  assert.ok(!matchesAgentFilenamePattern('package.json'), 'package.json 不应匹配(无 ihui 前缀)')
  assert.ok(!matchesAgentFilenamePattern('utils.mjs'), 'utils.mjs 不应匹配')
  assert.ok(!matchesAgentFilenamePattern('config.ps1'), 'config.ps1 不应匹配(无强信号前缀)')
  assert.ok(!matchesAgentFilenamePattern('test.spec.ts'), 'test.spec.ts 不应匹配')
  // 边界: test_ 开头但后缀 .ts 不在 test_ 模式后缀列表(.ts 仅在 ihui_ 模式中出现)
  assert.ok(!matchesAgentFilenamePattern('test_foo.ts'), 'test_*.ts 不应匹配(后缀 .ts 不在 test_ 模式)')
})

test('边界: 大小写不敏感匹配(i 标志)— SEARCH_FOO.PS1 应匹配', () => {
  assert.ok(matchesAgentFilenamePattern('SEARCH_FOO.PS1'), '大写文件名应匹配(正则带 i 标志)')
  assert.ok(matchesAgentFilenamePattern('Search_Result.TXT'), '混合大小写应匹配')
  assert.ok(matchesAgentFilenamePattern('IHUI-CLEAN.PS1'), 'IHUI- 大写应匹配')
})

// ═══════════════════════════════════════════════════════════════
// 3. 白名单豁免(USER_LEGIT_PATTERNS,合法用户文件跳过)
// ═══════════════════════════════════════════════════════════════

test('白名单豁免: 快捷方式 / Office / 图片 / 音视频 / 压缩包 / 安装包 → 跳过(legit)', () => {
  // 快捷方式
  assert.ok(isUserLegit('vscode.lnk'), '.lnk 应豁免')
  assert.ok(isUserLegit('chrome.url'), '.url 应豁免')
  // Office 文档
  assert.ok(isUserLegit('report.docx'), '.docx 应豁免')
  assert.ok(isUserLegit('data.xlsx'), '.xlsx 应豁免')
  assert.ok(isUserLegit('manual.pdf'), '.pdf 应豁免')
  // 图片
  assert.ok(isUserLegit('photo.jpg'), '.jpg 应豁免')
  assert.ok(isUserLegit('icon.png'), '.png 应豁免')
  assert.ok(isUserLegit('vector.svg'), '.svg 应豁免')
  // 音视频
  assert.ok(isUserLegit('video.mp4'), '.mp4 应豁免')
  assert.ok(isUserLegit('song.mp3'), '.mp3 应豁免')
  // 压缩包
  assert.ok(isUserLegit('backup.zip'), '.zip 应豁免')
  assert.ok(isUserLegit('archive.7z'), '.7z 应豁免')
  // 安装包(用户下载)
  assert.ok(isUserLegit('installer.exe'), '.exe 应豁免')
  assert.ok(isUserLegit('setup.msi'), '.msi 应豁免')
})

test('白名单豁免: desktop.ini / Thumbs.db / 历史迁移文件名 → 跳过(legit,大小写不敏感)', () => {
  assert.ok(isUserLegit('desktop.ini'), 'desktop.ini 应豁免(Windows 系统文件)')
  assert.ok(isUserLegit('Thumbs.db'), 'Thumbs.db 应豁免(Windows 缩略图缓存)')
  assert.ok(isUserLegit('Desktop.ini'), 'Desktop.ini 应豁免(大小写不敏感)')
  assert.ok(isUserLegit('THUMBS.DB'), 'THUMBS.DB 应豁免(大小写不敏感)')
  assert.ok(isUserLegit('项目端口分析与维护成本优化.md'), '历史迁移文件名应豁免(2026-07-25 教训)')
})

// ═══════════════════════════════════════════════════════════════
// 4. 可疑扩展名范围(SUSPICIOUS_EXTS)
// ═══════════════════════════════════════════════════════════════

test('SUSPICIOUS_EXTS: agent 临时产物扩展名在列表,合法用户文件扩展名不在列表', () => {
  // agent 临时产物典型扩展名 → 在列表
  for (const ext of ['.ps1', '.psm1', '.bat', '.cmd', '.sh', '.py', '.js', '.mjs', '.cjs', '.ts', '.txt', '.log', '.tmp']) {
    assert.ok(SUSPICIOUS_EXTS.has(ext), `${ext} 应在 SUSPICIOUS_EXTS 中`)
  }
  // 合法用户文件扩展名 → 不在列表(避免误扫)
  for (const ext of ['.lnk', '.url', '.docx', '.xlsx', '.pdf', '.jpg', '.png', '.mp4', '.zip', '.exe', '.md', '.json', '.html']) {
    assert.ok(!SUSPICIOUS_EXTS.has(ext), `${ext} 不应在 SUSPICIOUS_EXTS 中`)
  }
})

// ═══════════════════════════════════════════════════════════════
// 5. 内容双信号检测(项目路径引用 + agent 操作痕迹 同时命中)
// ═══════════════════════════════════════════════════════════════

test('内容双信号: 项目引用(IHUI-AI / apps/web / @ihui/)+ agent 操作痕迹 → 触发', () => {
  // IHUI-AI 项目名 + Get-ChildItem(§15 历史事故场景)
  assert.ok(
    contentTriggers('# agent 调试脚本\nGet-ChildItem -Path IHUI-AI -Recurse\n'),
    'IHUI-AI + Get-ChildItem 应触发',
  )
  // apps/web/ 跨项目引用 + Out-File 文件写入
  assert.ok(
    contentTriggers('Get-Content apps/web/app/page.tsx | Out-File result.txt\n'),
    'apps/web/ + Out-File 应触发',
  )
  // @ihui/ monorepo 包引用 + Set-Content
  assert.ok(
    contentTriggers("import { foo } from '@ihui/types'\nSet-Content -Path out.txt -Value 'x'\n"),
    '@ihui/ + Set-Content 应触发',
  )
})

test('内容双信号: agent 操作痕迹覆盖 PowerShell + Node.js 双语言', () => {
  // PowerShell Get-ChildItem
  assert.ok(contentTriggers("Get-ChildItem IHUI-AI\n"), 'PowerShell Get-ChildItem 应触发')
  // Node.js require('fs')
  assert.ok(
    contentTriggers("const fs = require('fs')\n// IHUI-AI project\n"),
    "Node.js require('fs') + IHUI-AI 应触发",
  )
  // Node.js import from 'node:fs'
  assert.ok(
    contentTriggers("import { readFileSync } from 'node:fs'\n// IHUI-AI\n"),
    'Node.js import node:fs + IHUI-AI 应触发',
  )
  // WriteAllText 字面字符串(注:writeFileSync 不在列表)
  assert.ok(
    contentTriggers("// WriteAllText\n// IHUI-AI\n"),
    'WriteAllText 字面字符串 + IHUI-AI 应触发',
  )
})

test('内容单信号 / 无信号: 仅项目引用 / 仅 agent 操作 / 普通文本 → 不触发', () => {
  // 仅项目路径引用(用户合法脚本可能引用项目名)
  assert.ok(
    !contentTriggers('# 我的笔记:在 IHUI-AI 项目中工作\n# 仅引用项目名,无 agent 操作痕迹\n'),
    '仅项目引用不应触发(单信号)',
  )
  // 仅 agent 操作痕迹(PowerShell 通用教程无项目引用)
  assert.ok(
    !contentTriggers('# PowerShell 教程\nGet-ChildItem | Select-Object Name, Length\n'),
    '仅 agent 操作痕迹不应触发(单信号)',
  )
  // 普通文本(无任何信号)
  assert.ok(
    !contentTriggers('Hello world\nThis is a normal text file\nNo project refs, no agent ops\n'),
    '普通文本不应触发',
  )
})

// ═══════════════════════════════════════════════════════════════
// 6. 边界场景
// ═══════════════════════════════════════════════════════════════

test('边界: 文件名强信号优先于内容扫描(短路判定)— 即使内容空也判定污染', () => {
  // 模拟 findPollution 逻辑:文件名命中强信号 → 直接判定,不再扫内容
  // 即使文件内容空,文件名 search_x.ps1 也应判定为污染
  const filename = 'search_pollution.ps1'
  const filenameMatch = matchesAgentFilenamePattern(filename)
  assert.ok(filenameMatch, '文件名强信号应优先判定,与内容无关')
  // 反例:普通文件名 + 内容双信号 → 走内容扫描分支(源脚本逻辑)
  const normalFilename = 'config.ps1'
  assert.ok(!matchesAgentFilenamePattern(normalFilename), '普通文件名不命中强信号,需走内容扫描')
})
