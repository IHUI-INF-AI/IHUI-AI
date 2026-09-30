#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ensure-silent-tasks.mjs — 桌面「零弹窗」全盘审计 + 自愈(2026-09-22 立)。
 *
 * 用户铁律:"不允许出现任何窗口,除非我自己打开"。
 * 事故背景:计划任务 "IHUI-AI git-guardian" 的活任务曾被注册成直跑 node.exe ——
 * 计划任务以 InteractiveToken 在交互会话执行控制台程序时,Windows 必弹可见 conhost
 * 黑窗,导致桌面每 2 分钟闪一扇窗(2026-09-20 首踩,2026-09-22 复发)。
 * git-guardian 自身已内建单任务漂移自检;本脚本把同口径扩到**全机**:
 *
 * 扫描范围与判定:
 *   ① 全部计划任务(schtasks /query /v /fo csv):action 直指控制台程序(node/cmd/
 *      powershell/pwsh/python/git/adb/cscript…)且 Run As User 是交互账户(非 SYSTEM/
 *      Service,session 0 账户无窗口能力)→ 违规
 *   ② 启动文件夹(用户 + 公共):.cmd/.bat 登录即闪控制台 → 违规(仅报告)
 *   ③ 注册表 Run 键(HKCU/HKLM):控制台程序自启 → 违规(仅报告)
 *
 * 修复策略:
 *   - 任务名或 action 含 "IHUI" 的违规任务:**自动修复** —— 生成隐藏 VBS 包装
 *     (SW_HIDE,ASCII-only,参照 git-guardian-hidden.vbs 模式),用 Set-ScheduledTask
 *     原位替换 action(**保留全部触发器**,绝不用 schtasks /create 重建)。
 *   - 非 IHUI 任务:只报告不动(避免误伤他人任务;SYSTEM 账户任务本身无窗口能力不判违规)。
 *
 * 用法:
 *   node scripts/ensure-silent-tasks.mjs          审计 + 自动修复 IHUI 违规任务
 *   node scripts/ensure-silent-tasks.mjs --check  只审计不修复(exit 1 = 存在违规)
 *
 * 常驻:dev-stack watcher(--watch)每 10 分钟调用本脚本一次,开机自启即永远有人兜底。
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, basename, extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOG_DIR = join(ROOT, '.tmp-sync')
const AUDIT_LOG = join(LOG_DIR, 'silent-tasks-audit.log')
const WRAPPER_DIR = join(homedir(), '.ihui-silent-guard')
const CHECK_ONLY = process.argv.includes('--check')

/** 会弹控制台窗的程序(小写、去 .exe)。wscript/mshta 等 GUI 子系统不在列。 */
const CONSOLE_EXES = new Set([
  'node', 'npm', 'npx', 'pnpm', 'pnpx', 'yarn', 'bun', 'deno', 'cmd', 'command', 'powershell', 'pwsh',
  'cscript', 'python', 'python3', 'py', 'git', 'adb', 'fastboot', 'taro', 'next', 'expo', 'curl', 'wget',
  'ssh', 'scp', 'ffmpeg', 'ffprobe', 'taskkill', 'tasklist', 'netstat', 'schtasks', 'reg', 'sc', 'wmic',
  'cargo', 'go', 'make', 'gradle', 'java', 'conhost', 'bash', 'sh', 'wsl', 'mstest', 'vbc',
])
/** Run As User 含这些字样 = session 0 / 服务账户,无窗口能力,不判违规 */
const SESSION0_USER = /(system|service|s-1-5)/i
/** IHUI 归属判定(只自动修自己的任务) */
const IS_IHUI = /ihui/i

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.info(line)
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    appendFileSync(AUDIT_LOG, line + '\n')
  } catch {
    /* 日志失败不影响审计 */
  }
}

function runCapture(exe, args, timeoutMs = 60_000) {
  try {
    return execFileSync(exe, args, { encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    return `${e.stdout || ''}${e.stderr || ''}`
  }
}

/** 取命令串首个可执行名(小写、去路径、去 .exe)。 */
export function exeNameOf(cmdLine) {
  const s = (cmdLine || '').trim()
  if (!s) return ''
  let first
  if (s.startsWith('"')) {
    const end = s.indexOf('"', 1)
    first = end > 0 ? s.slice(1, end) : s.slice(1)
  } else {
    // 优先按已知扩展名截取:未加引号的带空格路径("C:\Program Files\nodejs\node.exe --check")
    // 若按空格切首段会取成 "C:\Program" 而漏判(实测踩过)
    const m = s.match(/^.*?\.(exe|cmd|bat|com|scr)\b/i)
    first = m ? m[0] : (s.split(/\s+/)[0] || '')
  }
  // %systemroot% 一类变量展开不了,按最后的段名兜底
  first = first.replace(/%[^%]*%/, (mm) => mm.split('\\').pop().replace(/%/g, ''))
  return basename(first).toLowerCase().replace(/\.exe$|\.cmd$|\.bat$/, '')
}

/** action 是否直指控制台程序(→ 交互会话必弹窗)。 */
export function isConsoleAction(target) {
  return CONSOLE_EXES.has(exeNameOf(target))
}

/** 由 Get-ScheduledTask 的 Execute/Arguments 还原完整命令串(供包装 VBS 内嵌)。 */
export function actionToCommand(a) {
  const exe = (a.exe || '').trim()
  const args = (a.args || '').trim()
  const exePart = exe.startsWith('"') || !exe.includes(' ') ? exe : `"${exe}"`
  return args ? `${exePart} ${args}` : exePart
}

/**
 * 全部计划任务(每个 action 一行 JSONL)。
 * 不用 schtasks CSV/LIST 解析:实测其重定向输出为 GBK 本地化编码且 Task To Run 字段含
 * 未转义内嵌引号("node.exe ""...mjs"" --check")会把分词/按行解析全部撕烂。
 * Get-ScheduledTask 结构化输出 + [Console]::OutputEncoding=UTF8 跨语言零歧义;
 * LogonType/State 是枚举名(英文),不受系统语言影响。
 */
export function listTasks() {
  const ps =
    `$ProgressPreference='SilentlyContinue'\n` +
    `[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)\n` +
    `Get-ScheduledTask | ForEach-Object { $t = $_; foreach ($a in $t.Actions) {\n` +
    `  [PSCustomObject]@{ name = $t.TaskPath + $t.TaskName; exe = [string]$a.Execute; args = [string]$a.Arguments;\n` +
    `    state = [string]$t.State; user = [string]$t.Principal.UserId; logon = [string]$t.Principal.LogonType }\n` +
    `    | ConvertTo-Json -Compress\n` +
    `} }`
  const out = runCapture('pwsh.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', psEncode(ps)], 120_000)
  const tasks = new Map()
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue
    let o
    try {
      o = JSON.parse(line)
    } catch {
      continue
    }
    if (!o.name || !o.exe) continue
    if (!tasks.has(o.name)) {
      tasks.set(o.name, { name: o.name, state: o.state || '', runAs: o.user || '', logon: o.logon || '', actions: [] })
    }
    tasks.get(o.name).actions.push({ exe: o.exe, args: o.args || '' })
  }
  return [...tasks.values()]
}

/** 生成隐藏 VBS 包装(shell.Run SW_HIDE)。ASCII-only:cscript/wscript 按 ANSI 解码,非 ASCII 会编译错(2026-09-20 实测)。 */
export function wrapperVbsContent(cmd) {
  const esc = cmd.replace(/"/g, '""')
  return [
    `' Auto-generated by IHUI-AI scripts/ensure-silent-tasks.mjs -- do not edit.`,
    `' Hidden launcher: runs the task command with SW_HIDE (zero visible console window).`,
    `' ASCII-only by design: cscript/wscript decode .vbs via ANSI codepage.`,
    `Option Explicit`,
    `Dim shell`,
    `Set shell = CreateObject("WScript.Shell")`,
    `shell.Run "${esc}", 0, False`,
    ``,
  ].join('\r\n')
}

function djb2(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(16)
}

/** PowerShell EncodedCommand:无引号转义地狱,参数随便带空格/引号。 */
function psEncode(script) {
  return Buffer.from(script, 'utf16le').toString('base64')
}

/** 原位替换任务 action 为 wscript 隐藏包装(保留全部触发器/主体设置)。 */
function replaceActionWithWrapper(taskName, taskToRun) {
  mkdirSync(WRAPPER_DIR, { recursive: true })
  const vbsPath = join(WRAPPER_DIR, `${basename(taskName).replace(/[^a-z0-9_-]/gi, '-')}-${djb2(taskName)}-hidden.vbs`)
  writeFileSync(vbsPath, wrapperVbsContent(taskToRun), 'utf8')
  const ps =
    `$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '"${vbsPath.replace(/'/g, "''")}"'\n` +
    `$path = Split-Path '${taskName.replace(/'/g, "''")}'\n` +
    `$leaf = Split-Path '${taskName.replace(/'/g, "''")}' -Leaf\n` +
    `if ($path -eq '') { $path = '\\' }\n` +
    `Set-ScheduledTask -TaskPath $path -TaskName $leaf -Action $a | Out-Null\n` +
    `Write-Output OK`
  // powershell.exe(5.1)被本机 WDAC 拦 EPERM(从 node 派生时,与 EDID 脚本头注释同款病理),必须用 pwsh(PS7)
  const out = runCapture('pwsh.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', psEncode(ps)], 90_000)
  const ok = /OK/.test(out)
  if (!ok) log(`  替换失败输出: ${out.trim().split('\n').slice(-3).join(' | ')}`)
  return ok ? vbsPath : null
}

export function audit({ fix = false } = {}) {
  const violations = []
  // ① 计划任务:任一 action 直指控制台程序且非 session 0 账户 → 违规
  for (const t of listTasks()) {
    if (/disabled|禁用/i.test(t.state)) continue
    if (SESSION0_USER.test(t.runAs)) continue // SYSTEM/Service 跑在 session 0,无窗口能力
    // LogonType 枚举:Interactive / Token / Group 属"仅登录时运行"(有桌面,会弹窗);
    // S4U / Password / ServiceAccount 属"无论是否登录都运行"(session 0,无桌面) → 结构上无法弹窗,
    // 不算违规。2026-09-23 订正:原式把 s4u 也计入违规,会把 dev-stack 守护从"S4U 根治形态"
    // 反向改写成 wscript+VBS(依赖 SW_HIDE 的逐点方案),与本仓 AGENTS.md §5b 的 S4U 例外条对打。
    // 未知/空值仍按可弹窗处理(宁误报不漏报)。
    if (/s4u|password|serviceaccount|group/i.test(t.logon)) continue
    const badActions = t.actions.filter((a) => isConsoleAction(a.exe))
    if (!badActions.length) continue
    const isIhui = IS_IHUI.test(t.name) || t.actions.some((a) => IS_IHUI.test(`${a.exe} ${a.args || ''}`))
    violations.push({ kind: 'task', name: t.name, detail: actionToCommand(badActions[0]), ihui: isIhui })
  }
  // ② 启动文件夹(.cmd/.bat 登录即闪控制台;仅报告)
  const startupDirs = [
    join(homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'),
    'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp',
  ]
  for (const dir of startupDirs) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (!/.cmd$|.bat$/i.test(extname(f))) continue
      violations.push({ kind: 'startup', name: `${dir}\\${f}`, detail: '(启动项 cmd/bat,登录时闪控制台)', ihui: false })
    }
  }
  // ③ 注册表 Run 键(仅报告)
  for (const hive of ['HKCU', 'HKLM']) {
    const out = runCapture('reg', ['query', `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`])
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/REG_SZ\s+(.*)$/)
      if (!m) continue
      if (isConsoleAction(m[1])) {
        violations.push({ kind: 'runkey', name: `${hive}\\...\\Run`, detail: m[1].trim(), ihui: IS_IHUI.test(m[1]) })
      }
    }
  }

  const ihuiBad = violations.filter((v) => v.kind === 'task' && v.ihui)
  log(`审计完成: 计划任务/启动项/Run键共 ${violations.length} 处违规(IHUI 可修 ${ihuiBad.length} 处)`)

  for (const v of violations) {
    if (fix && v.kind === 'task' && v.ihui) {
      const vbs = replaceActionWithWrapper(v.name, v.detail)
      if (vbs) {
        log(`  已修复: 任务 "${v.name}" action → wscript.exe "${vbs}"(触发器原位保留)`)
      } else {
        log(`  ❌ 修复失败: 任务 "${v.name}" 需人工处理`)
      }
    } else {
      log(`  ⚠️ 未修(${v.kind}${v.ihui ? '' : ',非IHUI'}): ${v.name} → ${v.detail}`)
    }
  }
  return violations
}

function main() {
  if (CHECK_ONLY) {
    const v = audit({ fix: false })
    if (v.length) {
      console.error(`❌ [ensure-silent-tasks --check] ${v.length} 处「交互会话直跑控制台程序」违规,桌面会弹窗`)
      process.exit(1)
    }
    console.info('✅ [ensure-silent-tasks --check] 全盘零弹窗:无交互控制台计划任务/启动项/Run键违规')
    return
  }
  audit({ fix: true })
  // 修复后复扫:IHUI 违规必须清零才算自愈成功
  const after = audit({ fix: false })
  const ihuiLeft = after.filter((v) => v.kind === 'task' && v.ihui)
  if (ihuiLeft.length) {
    console.error(`❌ [ensure-silent-tasks] 修复后仍剩 ${ihuiLeft.length} 处 IHUI 违规,需人工介入`)
    process.exit(1)
  }
  if (after.length) log('自愈完成:IHUI 违规清零 ✅(非 IHUI 违规仅报告不自动修)')
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}

export const __test__ = { exeNameOf, isConsoleAction, actionToCommand, listTasks, wrapperVbsContent }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
