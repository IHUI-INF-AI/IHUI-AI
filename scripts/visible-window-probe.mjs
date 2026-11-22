#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 可见窗口量算器(只读:不杀进程、不写仓库外路径、不递归文件系统)。
 *
 * 为什么必须有它(而不是"再补一次 windowsHide 参数"):
 *   AGENTS §5b「🪟 后台进程禁弹窗」那条给出的取证出路是一个从未入库的临时脚本 —— 文档写了一条
 *   跑不通的出路,于是"刚才这一次负载到底弹出了几个可见窗口"这一维**没有任何版本化的尺子**。
 *   同一族缺陷本仓已记过三次:`pnpm c-drive:clean-ours` 从来不存在、守门 46/11c/50 的
 *   `HUSKY_SKIP_*` 是假通道。本工具把那条出路变成受版本控制的入口。
 *
 * 它与现有两件仪器的分工(缺一个都答不上问题):
 *   - `scripts/check-no-visible-spawn.mjs`(守门 52)判的是**源码里有没有写 windowsHide**;
 *   - `scripts/install-console-window-hook.mjs` 装的是**机器级默认值**;
 *   - 本工具量的是**这一次运行真的弹出了几个窗口**。
 *   静态判据绿不等于运行时不弹窗:§5b 记的五次复发里至少有两次(WT 委托、fork 风暴)恰恰是
 *   "逐点参数都补了、现象仍在" —— 那两型只有运行时样本能定性。
 *
 * 为什么它**不在提交链**(这是设计,不是待办):
 *   它判的是**机器此刻的运行时状态**,与"这次提交改了什么"无关,提交者结构上无法满足它。
 *   挂进 blocking 钩子就是一台与任何提交都无关的恒红门,唯一结局是各会话 `--no-verify`,
 *   一次绕过等于其余全部守门对该提交作废(§12e 同型)。同类定级先例:
 *   `check-desktop-cache-plaintext.mjs`(warn-only、刻意不挂 runner)与
 *   `check-artifact-budget.mjs`(warn,理由原文即"产物在不在本机是机器状态")。
 *   同理它也**不是守门**,所以头注不自称"已接 pre-commit / CI / 第 N 项"。
 *
 * 判据诚实性(本仓最高频失效型是"把没量到写成结论")—— 每一维三态分明:
 *   `量到了 N` / `确实是 0` / `未判定:<原因>`。取不到一律显式未判定并点名原因
 *   (非 win32 / PowerShell 不在位 / 派生失败 / 超时 / 输出形态不认识 / 进程快照失效 /
 *   WMI 不可达),**绝不折成"0 个窗口"**;人读面逐条打印实扫样本(类名 + 标题 + 尺寸 + pid +
 *   镜像名 + 父链),不接受"合计约 0"这种把真信号藏掉的量级(§26"合计约 0 MB"同型)。
 *
 * 派生纪律:唯一一处外部派生 = PowerShell 子进程,一律带 `windowsHide: true` + `timeout` +
 *   `maxBuffer` + `stdio` 全 pipe(§5b / 守门 52 / 守门 80)。探针自己弹窗是最高级的自伤。
 *   超时只会终止**本工具自己派生的**那一个子进程(这是卫生,不是"杀进程"):本工具对任何
 *   别人的进程都不做 Stop-Process / taskkill,也不重启服务。
 *
 * 用法:
 *   node scripts/visible-window-probe.mjs --snapshot                 # 一次性快照
 *   node scripts/visible-window-probe.mjs --watch 120000             # 采样 2 分钟(默认档)
 *   node scripts/visible-window-probe.mjs --watch 60000 --interval 15 --json
 *   node scripts/visible-window-probe.mjs --watch --min-px 200       # 只量非 1x1 噪声窗口
 * 选项:--snapshot | --watch [ms] | --interval <ms> | --min-px <面积> | --json | --no-wmi | --help
 * 退出码:0 = 主判据(窗口枚举)量到了(含量到 0 个);2 = 未判定 / 脚本自身异常。
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** 唯一被派生的执行体候选:先 PowerShell 7(§27),再系统 5.1(本机实测两者同引擎)。 */
export const PWSH_CANDIDATES = [
  'C:/Program Files/PowerShell/7/pwsh.exe',
  'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
]
/** PowerShell 与 Node 之间只走 JSON 行(每帧一行):没有自造分隔符,
 *  标题里出现的 0x1E/0x1F 在 C# 侧就被替换掉 —— 两侧协议必须是可 parse 的文本。 */
/** 窗口行字段表 —— PowerShell 侧的 schema 行报的是**它实际用的**名字,两侧必须逐字对账。 */
const WINDOW_FIELDS = ['hwnd', 'pid', 'w', 'h', 'x', 'y', 'exStyles', 'class', 'title']
const PROC_FIELDS = ['pid', 'ppid', 'name']
/** 默认档要能覆盖"一次守门链"(实测 130+ 道门 ≈ 数十秒到几分钟)。 */
const DEFAULT_WATCH_MS = 120_000
/** 一次守门链跑完再等它结束用不上,但采样窗口本身不得长过这个数(否则输出体积无界)。 */
export const MAX_WATCH_MS = 600_000
const DEFAULT_INTERVAL_MS = 15
/** 进程表用 Toolhelp 快照(本机实测一次全量 15ms),所以可以每帧都取,归属不会"事后查不到"。 */
const PROC_SNAPSHOT_MIN_MS = 10
/** 父链回溯上限:超过就如实报"链条截断",不当"已经到根"。 */
export const CHAIN_MAX_DEPTH = 32
/** 控制台形态表:命中即计入 consoleForm;**未命中只报数**,不得据此判成不是控制台(这是正例表,不是全集)。 */
export const CONSOLE_CLASSES = ['ConsoleWindowClass', 'CASCADIA_HOSTING_WINDOW_CLASS', 'Console']
export const CONSOLE_IMAGES = ['cmd.exe', 'conhost.exe', 'powershell.exe', 'pwsh.exe', 'wt.exe', 'node.exe', 'git.exe']
/** 宽限要给足:探针每次启动都要过一次 Add-Type(C# 编译),本机满载时这一步实测要几十秒。
 *  只给 30s 会把"慢"报成"派生失败" —— 把没量到的原因写错,比不报更难查(实测踩过一次)。 */
const EXEC_TIMEOUT_GRACE_MS = 180_000
/** 输出缓冲:窗口行很便宜,但 watch 到分钟级 × 15ms 采样仍是 MB 量,按上限量给。 */
const MAX_BUFFER_BYTES = 128 * 1024 * 1024

const int = (v, dflt) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : dflt
}

/**
 * 生成 PowerShell 探针脚本。所有插值都先过 `int()`(数字归一),
 * 因此脚本文本里没有"把用户输入当代码拼进去"的那条路。
 */
export function buildPowerShellScript({ intervalMs, durationMs, minArea, procSnapshotMs, wantWmi }) {
  const n = (v) => String(int(v, 0))
  // C# 侧刻意用 (char)0x1E / (char)0x1F 而不是转义字面量:模板字符串与 PS here-string 两层
  // 转义规则不同,写反斜杠必有其一被吃掉(本文件注释也不写那两个序列的字面形态)。
  return [
    "$ErrorActionPreference = 'Stop'",
    'try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch { }',
    '$src = @\'',
    'using System;',
    'using System.Text;',
    'using System.Runtime.InteropServices;',
    'using System.Collections.Generic;',
    'public sealed class IhuiVisibleWindowProbe {',
    '  delegate bool EnumWindowsProc(IntPtr h, IntPtr l);',
    '  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);',
    '  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);',
    '  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextLengthW(IntPtr h);',
    '  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);',
    '  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);',
    '  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);',
    '  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);',
    '  [DllImport("user32.dll")] static extern int GetWindowLongW(IntPtr h, int idx);',
    '  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }',
    '  [StructLayout(LayoutKind.Sequential)]',
    '  public struct PROCESSENTRY32 {',
    '    public uint dwSize; public uint cntUsage; public uint th32ProcessID; public IntPtr th32DefaultHeapID;',
    '    public uint th32ModuleID; public uint cntThreads; public uint th32ParentProcessID;',
    '    public int pcPriClassBase; public uint dwFlags;',
    '    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;',
    '  }',
    '  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);',
    '  [DllImport("kernel32.dll", SetLastError = true)] static extern bool Process32First(IntPtr h, ref PROCESSENTRY32 e);',
    '  [DllImport("kernel32.dll", SetLastError = true)] static extern bool Process32Next(IntPtr h, ref PROCESSENTRY32 e);',
    '  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);',
    '  static string One(string s) {',
    '    if (s == null) return "";',
    '    s = s.Replace((char)0x1F, (char)0x20).Replace((char)0x1E, (char)0x20).Replace((char)0x0D, (char)0x20).Replace((char)0x0A, (char)0x20);',
    '    return s.Trim();',
    '  }',
    '  public static string Windows(long minArea) {',
    '    var rows = new List<string>();',
    '    EnumWindows((h, l) => {',
    '      try {',
    '        if (!IsWindowVisible(h)) return true;',
    '        int len = GetWindowTextLengthW(h);',
    '        var tb = new StringBuilder(len + 2);',
    '        if (len > 0) GetWindowTextW(h, tb, tb.Capacity);',
    '        var cb = new StringBuilder(512);',
    '        GetClassNameW(h, cb, cb.Capacity);',
    '        uint owner = 0;',
    '        GetWindowThreadProcessId(h, out owner);',
    '        RECT r;',
    '        GetWindowRect(h, out r);',
    '        int w = r.Right - r.Left, hh = r.Bottom - r.Top;',
    '        if (w <= 0 || hh <= 0) return true;',
    '        if ((long)w * (long)hh < minArea) return true;',
    '        rows.Add(string.Join("" + (char)0x1F, new string[] { ((long)h).ToString(), owner.ToString(), w.ToString(), hh.ToString(),',
    '          r.Left.ToString(), r.Top.ToString(), ((long)GetWindowLongW(h, -20)).ToString(), One(cb.ToString()), One(tb.ToString()) }));',
    '      } catch { }',
    '      return true;',
    '    }, IntPtr.Zero);',
    '    return string.Join("" + (char)0x1E, rows);',
    '  }',
    '  public static string Processes() {',
    '    IntPtr h = CreateToolhelp32Snapshot(2u, 0u);',
    '    if (h == IntPtr.Zero || (long)h == -1L) return null;',
    '    var sb = new StringBuilder();',
    '    try {',
    '      var e = new PROCESSENTRY32();',
    '      e.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));',
    '      if (!Process32First(h, ref e)) return "";',
    '      bool first = true;',
    '      do {',
    '        if (!first) sb.Append((char)0x1E);',
    '        first = false;',
    '        sb.Append(e.th32ProcessID).Append((char)0x1F).Append(e.th32ParentProcessID).Append((char)0x1F).Append(One(e.szExeFile));',
    '      } while (Process32Next(h, ref e));',
    '    } finally { CloseHandle(h); }',
    '    return sb.ToString();',
    '  }',
    '}',
    "'@",
    'Add-Type -TypeDefinition $src -Language CSharp',
    '$intervalMs = ' + n(intervalMs),
    '$durationMs = ' + n(durationMs),
    '$minArea = ' + n(minArea),
    '$procSnapshotMs = ' + n(procSnapshotMs),
    '$wantWmi = ' + (wantWmi ? '$true' : '$false'),
    '$known = @{}',
    '@{ kind = "schema"; fields = @(' + WINDOW_FIELDS.map((f) => `"${f}"`).join(', ') + ');',
    '   procFields = @(' + PROC_FIELDS.map((f) => `"${f}"`).join(', ') + ');',
    '   pwsh = $PSVersionTable.PSVersion.ToString(); host = [System.Environment]::MachineName;',
    "   intervalMs = $intervalMs; durationMs = $durationMs; minArea = $minArea } | ConvertTo-Json -Compress -Depth 4",
    '$lastSnap = (Get-Date).AddMilliseconds(-1000000)',
    '$deadline = (Get-Date).AddMilliseconds($durationMs)',
    'while ($true) {',
    '  $t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()',
    '  $snap = "skipped"',
    '  $newProcs = @()',
    '  if (((Get-Date) - $lastSnap).TotalMilliseconds -ge $procSnapshotMs) {',
    '    $lastSnap = Get-Date',
    '    $raw = $null',
    '    try { $raw = [IhuiVisibleWindowProbe]::Processes() } catch { $raw = $null }',
    '    if ($null -eq $raw) { $snap = "error" }',
    '    elseif ($raw -eq "") { $snap = "empty" }',
    '    else {',
    '      $snap = "ok"',
    '      foreach ($rec in $raw.Split([char]0x1E)) {',
    '        $f = $rec.Split([char]0x1F)',
    '        if ($f.Count -lt 3) { continue }',
    '        $p = [int64]$f[0]',
    '        if (-not $known.ContainsKey($p)) {',
    '          $known[$p] = $true',
    '          $newProcs += , @($p, [int64]$f[1], [string]$f[2])',
    '        }',
    '      }',
    '    }',
    '  }',
    // 枚举本身抛错必须**喊出来并中止采样**,不能被读成"这一帧 0 个窗口" —— 那正是"把没量到写成结论"。
    '  $wtext = ""',
    '  $winErr = $null',
    '  try { $wtext = [IhuiVisibleWindowProbe]::Windows($minArea) } catch { $winErr = $_.Exception.Message }',
    '  if ($winErr -ne $null) {',
    '    $wmsg = $winErr -replace "[\\r\\n]+", " "',
    '    @{ kind = "win-error"; why = $wmsg } | ConvertTo-Json -Compress',
    '    break',
    '  }',
    '  $wins = @()',
    '  if ($wtext -ne $null -and $wtext -ne "") {',
    '    foreach ($rec in $wtext.Split([char]0x1E)) {',
    '      $f = $rec.Split([char]0x1F)',
    '      if ($f.Count -lt 9) { continue }',
    '      $wins += , @([int64]$f[0], [int64]$f[1], [int]$f[2], [int]$f[3], [int]$f[4], [int]$f[5], [int64]$f[6], [string]$f[7], [string]$f[8])',
    '    }',
    '  }',
    '  @{ kind = "sample"; t = $t; snapshot = $snap; w = $wins; p = $newProcs } | ConvertTo-Json -Compress -Depth 6',
    '  if ((Get-Date) -ge $deadline) { break }',
    '  Start-Sleep -Milliseconds $intervalMs',
    '}',
    'if ($wantWmi) {',
    '  try {',
    '    $rows = @(Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,Name -ErrorAction Stop) |',
    '      ForEach-Object { , @([int64]$_.ProcessId, [int64]$_.ParentProcessId, [string]$_.Name) }',
    "    @{ kind = \"wmi\"; rows = $rows } | ConvertTo-Json -Compress -Depth 6",
    '  } catch {',
    '    $msg = $_.Exception.Message -replace "[\\r\\n]+", " "',
    "    @{ kind = \"wmi-error\"; why = $msg } | ConvertTo-Json -Compress",
    '  }',
    '}',
    '@{ kind = "end"; t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); windows = $known.Count } | ConvertTo-Json -Compress',
  ].join('\n')
}

/** stdout 必须是 UTF-8(脚本里已设 OutputEncoding);这里只做形态识别与拆行。 */
export function splitJsonLines(text) {
  const lines = String(text ?? '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const parsed = []
  const bad = []
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line))
    } catch {
      bad.push(line)
    }
  }
  return { parsed, bad }
}

/** schema 与两侧字段表逐字对账 —— 形态不认识就判"未判定",绝不按猜测计数。 */
export function checkSchema(obj) {
  if (!obj || obj.kind !== 'schema') return { ok: false, why: '输出里没有 schema 首行 ⇒ 输出形态不认识' }
  if (Array.from(obj.fields || []).join(',') !== WINDOW_FIELDS.join(','))
    return { ok: false, why: `schema.fields 与本工具预期不等:${JSON.stringify(obj.fields)}` }
  if (Array.from(obj.procFields || []).join(',') !== PROC_FIELDS.join(','))
    return { ok: false, why: `schema.procFields 与本工具预期不等:${JSON.stringify(obj.procFields)}` }
  return { ok: true, why: null }
}

export function buildProcMap(parsed, { source = 'toolhelp' } = {}) {
  const map = new Map()
  let badRows = 0
  for (const obj of parsed) {
    if (obj.kind !== 'sample' && obj.kind !== 'wmi') continue
    const rows = Array.isArray(obj.rows) ? obj.rows : Array.isArray(obj.p) ? obj.p : []
    for (const r of rows) {
      if (!Array.isArray(r) || r.length < 2) {
        badRows++
        continue
      }
      const pid = Number(r[0])
      const ppid = Number(r[1])
      const name = String(r[2] ?? '')
      if (!Number.isFinite(pid)) {
        badRows++
        continue
      }
      // 先到的 Toolhelp 记录优先(它与窗口采样同帧,归属最贴近现场);WMI 只补空档。
      if (!map.has(pid)) map.set(pid, { pid, ppid: Number.isFinite(ppid) ? ppid : null, name, source })
    }
  }
  return { map, badRows }
}

/**
 * 父链回溯。三态:
 *   ok            到了根(ppid 自指 / ppid 不再在表里且已到 System 或 0)
 *   broken        链条中途断开(父 pid 表里没有)—— 如实标出断点,不假装到根
 *   unknown       起点 pid 本身不在表里 ⇒ 归属**未判定**,不得写成"无父进程"
 */
export function deriveChain(pid, procMap) {
  const start = procMap.get(Number(pid))
  if (!start) return { kind: 'unknown', chain: [], why: `pid ${pid} 不在任何一次进程快照里(启停于采样窗口之外,或权限不足看不到)` }
  const chain = [{ pid: start.pid, name: start.name || '(无名)' }]
  const seen = new Set([start.pid])
  let cur = start
  let kind = 'broken'
  for (let depth = 0; depth < CHAIN_MAX_DEPTH; depth++) {
    const parent = cur.ppid === null ? null : procMap.get(cur.ppid)
    if (cur.ppid === null) {
      kind = 'broken'
      break
    }
    if (parent === undefined) {
      if (cur.ppid === cur.pid) {
        kind = 'ok'
        break
      }
      kind = 'broken'
      chain.push({ pid: cur.ppid, name: `(不在快照里:pid ${cur.ppid})`, unresolved: true })
      break
    }
    if (seen.has(parent.pid)) {
      kind = 'cycle'
      break
    }
    seen.add(parent.pid)
    chain.push({ pid: parent.pid, name: parent.name || '(无名)' })
    cur = parent
    if (parent.ppid === parent.pid) {
      kind = 'ok'
      break
    }
  }
  return { kind, chain, why: kind === 'ok' ? null : `父链在第 ${chain.length} 环处${kind === 'cycle' ? '成环' : '断开'}` }
}

export function classifyWindow(win) {
  const cls = String(win.class || '')
  return CONSOLE_CLASSES.includes(cls) || CONSOLE_IMAGES.includes(String(win.image || '').toLowerCase())
}

/**
 * 汇总:每个"不同的窗口"(按 hwnd)一条记录 + 按镜像名/父链根的归属计数。
 * `undetermined` 单列 —— 这些是**没量到归属**的窗口,不得被折进任何一张归属表。
 */
export function summarize({ parsed, procMap, schemaOk }) {
  const frames = parsed.filter((o) => o && o.kind === 'sample')
  const byHwnd = new Map()
  let sightings = 0
  let malformedWindows = 0
  for (const f of frames) {
    const wins = Array.isArray(f.w) ? f.w : []
    for (const r of wins) {
      if (!Array.isArray(r) || r.length < WINDOW_FIELDS.length) {
        malformedWindows++
        continue
      }
      const win = {
        hwnd: Number(r[0]),
        pid: Number(r[1]),
        w: Number(r[2]),
        h: Number(r[3]),
        x: Number(r[4]),
        y: Number(r[5]),
        class: String(r[7] ?? ''),
        title: String(r[8] ?? ''),
      }
      sightings++
      const prev = byHwnd.get(win.hwnd)
      if (!prev) byHwnd.set(win.hwnd, { ...win, seenIn: 1, firstT: f.t, lastT: f.t })
      else {
        prev.seenIn++
        prev.lastT = f.t
        if (!prev.title && win.title) prev.title = win.title
      }
    }
  }

  const windows = []
  const undetermined = []
  const perImage = new Map()
  const perRoot = new Map()
  let consoleForm = 0
  let formUnlisted = 0
  for (const rec of byHwnd.values()) {
    const chain = deriveChain(rec.pid, procMap)
    const self = procMap.get(rec.pid)
    const image = self && self.name ? self.name : null
    if (!schemaOk) {
      undetermined.push({ ...rec, reason: 'schema 未对账 ⇒ 不判归属' })
      continue
    }
    const entry = { ...rec, image, chainKind: chain.kind, chain: chain.chain, chainWhy: chain.why }
    windows.push(entry)
    if (!image) {
      undetermined.push({ ...entry, reason: chain.why || '镜像名未取到' })
      continue
    }
    const bucket = perImage.get(image) || { image, windows: 0, sightings: 0, pids: new Set() }
    bucket.windows++
    bucket.sightings += rec.seenIn
    bucket.pids.add(rec.pid)
    perImage.set(image, bucket)
    const root = chain.chain.length ? chain.chain[chain.chain.length - 1].name || '(无名)' : '(未知)'
    const rb = perRoot.get(root) || { root, windows: 0, images: new Set() }
    rb.windows++
    rb.images.add(image)
    perRoot.set(root, rb)
    if (classifyWindow(entry)) consoleForm++
    else formUnlisted++
  }
  windows.sort((a, b) => b.sightings - a.sightings || a.pid - b.pid)
  const sortCount = (m) =>
    [...m.values()]
      .map((v) => ({ ...v, pids: v.pids ? [...v.pids] : undefined, images: v.images ? [...v.images] : undefined }))
      .sort((a, b) => b.windows - a.windows)
  return {
    frames: frames.length,
    sightings,
    distinctWindows: byHwnd.size,
    malformedWindows,
    windows,
    undetermined,
    perImage: sortCount(perImage),
    perRoot: sortCount(perRoot),
    consoleForm,
    formUnlisted,
  }
}

export function resolvePwsh({ candidates = PWSH_CANDIDATES, platform = process.platform, exists = existsSync } = {}) {
  if (platform !== 'win32') return { path: null, why: `本平台为 ${platform},可见窗口是 Windows 概念 ⇒ 未判定(不是"没有窗口")` }
  for (const c of candidates) {
    try {
      if (exists(c)) return { path: c, why: null }
    } catch {
      /* 单个候选探不到不影响下一个 */
    }
  }
  return { path: null, why: `PowerShell 候选全部不在位:${candidates.join(' | ')}` }
}

/** 真实派生:走不带 shell 的 execFile,配 windowsHide / timeout / maxBuffer / stdio 全 pipe。 */
export function runPwshDefault({ pwsh, script, timeoutMs }) {
  return new Promise((resolve) => {
    execFile(
      pwsh,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', script],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER_BYTES,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
      (err, stdout, stderr) => {
        if (err) {
          // 三种失败各有各的出路,不得一律写成"派生失败":被自己的 timeout 终止(killed/signal)/ 执行体不存在(ENOENT)/
          // 跑起来但非零退出(status)。原因写错比不写更难查(本工具判的就是"到底量没量到")。
          const kind = err.killed || err.signal ? `timeout(超过 ${timeoutMs}ms,已终止本工具自己的探针子进程)` : err.code === 'ENOENT' ? 'ENOENT(PowerShell 路径不存在)' : `exit=${err.status ?? err.code ?? 'unknown'}`
          resolve({ ok: false, stdout: String(stdout ?? ''), why: `PowerShell 未跑完(${kind}):${String(err.message).replace(/[\r\n]+/g, ' ').slice(0, 160)}`, stderr: String(stderr ?? '') })
          return
        }
        resolve({ ok: true, stdout: String(stdout ?? ''), why: null, stderr: String(stderr ?? '') })
      },
    )
  })
}

export function parseArgs(argv) {
  const out = { mode: null, watchMs: DEFAULT_WATCH_MS, intervalMs: DEFAULT_INTERVAL_MS, minArea: 0, json: false, wmi: true, help: false, unknown: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => (argv[i + 1] && !String(argv[i + 1]).startsWith('--') ? argv[++i] : undefined)
    if (a === '--snapshot') out.mode = 'snapshot'
    else if (a === '--watch') {
      out.mode = 'watch'
      const v = next()
      if (v !== undefined) out.watchMs = int(v, DEFAULT_WATCH_MS)
    } else if (a === '--interval') out.intervalMs = int(next(), DEFAULT_INTERVAL_MS)
    else if (a === '--min-px') out.minArea = int(next(), 0)
    else if (a === '--json') out.json = true
    else if (a === '--no-wmi') out.wmi = false
    else if (a === '--help' || a === '-h') out.help = true
    else out.unknown.push(String(a))
  }
  return out
}

export async function main({ argv = process.argv.slice(2), deps = {} } = {}) {
  const log = deps.log ?? ((s) => process.stdout.write(s + '\n'))
  const opts = parseArgs(argv)
  if (opts.help) {
    log('用法:node scripts/visible-window-probe.mjs [--snapshot | --watch [ms]] [--interval <ms>] [--min-px <面积>] [--json] [--no-wmi]')
    log('  不在上表内的参数一律拒绝并退出 2(未判定),绝不静默按默认档跑。')
    return { exitCode: 0 }
  }
  const runPwsh = deps.runPwsh ?? runPwshDefault
  const resolve = deps.resolvePwsh ?? resolvePwsh
  if (opts.unknown.length) {
    const why = `命令行 ${opts.unknown.join(' ')} 不在接受表内 ⇒ 拒绝执行(未知开关静默掉进默认分支,等于用一次"看起来跑过了"骗自己)`
    return {
      exitCode: 2,
      meta: {
        tool: 'visible-window-probe',
        mode: opts.mode ?? null,
        durationMs: 0,
        intervalMs: opts.intervalMs,
        minArea: opts.minArea,
        clamped: null,
        pwsh: null,
        undetermined: [why],
        verdict: 'undetermined',
      },
    }
  }
  const mode = opts.mode ?? 'snapshot'
  const durationMs = mode === 'snapshot' ? 0 : Math.min(opts.watchMs, MAX_WATCH_MS)
  const intervalMs = Math.max(1, opts.intervalMs)
  const resolved = resolve({ candidates: PWSH_CANDIDATES, platform: deps.platform ?? process.platform })

  const meta = {
    tool: 'visible-window-probe',
    mode,
    durationMs,
    intervalMs,
    minArea: opts.minArea,
    clamped: mode !== 'snapshot' && opts.watchMs > MAX_WATCH_MS ? `--watch 请求 ${opts.watchMs}ms,已截到 ${MAX_WATCH_MS}ms(输出体积上界)` : null,
    pwsh: resolved.path,
    undetermined: [],
  }

  let verdict = null
  if (!resolved.path) {
    meta.undetermined.push(`窗口枚举:${resolved.why}`)
    verdict = { status: 'undetermined', exitCode: 2 }
  } else {
    const script = Buffer.from(
      buildPowerShellScript({
        intervalMs,
        durationMs,
        minArea: opts.minArea,
        procSnapshotMs: Math.max(PROC_SNAPSHOT_MIN_MS, intervalMs),
        wantWmi: opts.wmi,
      }),
      'utf16le',
    ).toString('base64')
    const res = await runPwsh({ pwsh: resolved.path, script, timeoutMs: durationMs + EXEC_TIMEOUT_GRACE_MS })
    meta.stderr = res.stderr ? res.stderr.slice(0, 300) : ''
    const { parsed, bad } = splitJsonLines(res.stdout)
    const schemaLine = parsed.find((o) => o && o.kind === 'schema')
    const schema = checkSchema(schemaLine)
    meta.schema = schema
    meta.outputBadLines = bad.length
    meta.pwshVersion = schemaLine?.pwsh ?? null
    meta.machine = schemaLine?.host ?? null
    if (!res.ok) meta.undetermined.push(`窗口枚举:${res.why}`)
    if (!schema.ok) meta.undetermined.push(`窗口枚举:${schema.why}`)
    if (res.ok && schema.ok && bad.length > 0) meta.undetermined.push(`输出解析:${bad.length} 行不是可识别 JSON(未计入任何结论)`)
    // 探针中途抛错 ⇒ 采样窗口只覆盖了要求时长的一部分。已数到的帧仍然有效,但**整次结论不得记为已量到**
    // —— 拿半程样本回答"这一次负载弹了几个窗"就是本仓反复记过的那种"把没判写成判过了"。
    const winErrLine = parsed.find((o) => o && o.kind === 'win-error')
    if (winErrLine)
      meta.undetermined.push(`窗口枚举:探针在采样中途抛错并中止(后续帧缺失)—— ${String(winErrLine.why ?? '').slice(0, 160)}`)

    const frames = parsed.filter((o) => o && o.kind === 'sample')
    const snapStates = frames.reduce((acc, f) => {
      acc[f.snapshot] = (acc[f.snapshot] ?? 0) + 1
      return acc
    }, {})
    meta.processSnapshots = snapStates
    const allOk = frames.length > 0 && (snapStates.ok ?? 0) === 0
    if (res.ok && schema.ok && allOk)
      meta.undetermined.push(`父链:进程快照全部未成功(${Object.keys(snapStates).join('/')})⇒ 归属维度未判定,窗口计数仍有效`)
    const wmiLine = parsed.find((o) => o && o.kind === 'wmi')
    const wmiErr = parsed.find((o) => o && o.kind === 'wmi-error')
    if (!opts.wmi) meta.wmi = { status: 'skipped', why: '按 --no-wmi 主动跳过' }
    else if (wmiErr) meta.wmi = { status: 'undetermined', why: `WMI 不可达:${String(wmiErr.why ?? '').slice(0, 160)}` }
    else if (!wmiLine && res.ok) meta.wmi = { status: 'undetermined', why: '输出里没有 WMI 结果行(形态不认识,不记为"无差异")' }

    const { map: procMap } = buildProcMap(parsed)
    meta.procRecords = procMap.size
    const sum = summarize({ parsed, procMap, schemaOk: schema.ok })
    Object.assign(meta, {
      frames: sum.frames,
      sightings: sum.sightings,
      distinctWindows: sum.distinctWindows,
      malformedWindows: sum.malformedWindows,
      consoleForm: sum.consoleForm,
      formUnlisted: sum.formUnlisted,
    })
    if (res.ok && schema.ok && sum.frames === 0) meta.undetermined.push('窗口枚举:采样循环一个 sample 都没产出 ⇒ 未判定(不得读成"0 个窗口")')

    // WMI 与 Toolhelp 两份父链的交叉对账:不一致必须点名,不得静默取一侧。
    const wmiMap = wmiLine ? buildProcMap([wmiLine], { source: 'wmi' }).map : null
    if (wmiMap && wmiMap.size) {
      let agree = 0
      const disagree = []
      let onlyWmi = 0
      for (const [pid, rec] of wmiMap) {
        const th = procMap.get(pid)
        if (!th) {
          onlyWmi++
          continue
        }
        if (th.ppid === rec.ppid) agree++
        else if (disagree.length < 10) disagree.push({ pid, toolhelp: th.ppid, wmi: rec.ppid, name: rec.name })
      }
      meta.wmi = { status: 'measured', rows: wmiMap.size, agree, disagree, onlyInWmi: onlyWmi }
      if (disagree.length) meta.undetermined.push(`父链:两把尺子对 ${disagree.length} 个 pid 给出不同父进程(已逐条列出,未择一)`)
    }
    // 整次结论记"已量到"的四条同时成立:派生本身没坏、形态认识、至少一帧、且采样没被中途打断。
    // 少任何一条都是未判定 —— 本仓最高频的失效型就是"把没量到写成 0 个窗口"。
    const measuredEnough = res.ok && schema.ok && sum.frames > 0 && !winErrLine
    verdict = measuredEnough ? { status: 'measured', exitCode: 0 } : { status: 'undetermined', exitCode: 2 }
    meta.result = { windows: sum.windows, perImage: sum.perImage, perRoot: sum.perRoot, attributionUndetermined: sum.undetermined }
  }
  meta.verdict = verdict.status
  const exitCode = verdict.exitCode
  return { exitCode, meta }
}

/** 人读面:先给结论与三态,再逐条列实扫样本 —— 只给合计数字就是本仓记过的那种假小量级。 */
export function renderText(meta) {
  const L = []
  L.push(`可见窗口量算器 —— 模式 ${meta.mode}${meta.mode === 'watch' ? ` ${meta.durationMs}ms / 间隔 ${meta.intervalMs}ms` : ''}`)
  L.push(`执行体:${meta.pwsh ?? '(未解析到)'}${meta.pwshVersion ? ` (pwsh ${meta.pwshVersion})` : ''}${meta.machine ? ` @${meta.machine}` : ''}`)
  if (meta.clamped) L.push(`  ⚠️ ${meta.clamped}`)
  if (meta.frames !== undefined) {
    L.push(`结论:${meta.verdict === 'measured' ? '已量到' : '未判定'} —— 样本 ${meta.frames ?? 0} 帧、窗口目击 ${meta.sightings ?? 0} 次、不同窗口 ${meta.distinctWindows ?? 0} 个`)
    if ((meta.distinctWindows ?? 0) === 0 && meta.verdict === 'measured') L.push('  (确认为 0:采样期间没有任何可见顶层窗口。这不是"没量到"。)')
    L.push(`  进程记录 ${meta.procRecords ?? 0} 条 | 快照状态 ${JSON.stringify(meta.processSnapshots ?? {})} | 归属未判定 ${meta.attributionUndetermined?.length ?? 0} 个窗口`)
    L.push(`  控制台形态命中 ${meta.consoleForm ?? 0} 个 | 不在形态表内 ${meta.formUnlisted ?? 0} 个(未命中只报数,不判成「不是控制台」)`)
    if (meta.malformedWindows) L.push(`  ⚠️ 形态不符的窗口行 ${meta.malformedWindows} 条,未计入任何结论`)
  }
  if (meta.wmi) {
    const w = meta.wmi
    if (w.status === 'measured')
      L.push(`  WMI 交叉对账:取到 ${w.rows} 条,父链一致 ${w.agree} 条,仅 WMI 侧有 ${w.onlyInWmi} 条,不一致 ${w.disagree?.length ?? 0} 条`)
    else L.push(`  WMI 交叉对账:未判定 —— ${w.why}`)
    for (const d of w.disagree ?? []) L.push(`    · pid=${d.pid} Toolhelp 父=${d.toolhelp} vs WMI 父=${d.wmi} (${d.name})`)
  }
  const rows = (meta.result?.windows ?? []).slice(0, 40)
  if (rows.length) {
    L.push('\n实扫窗口清单(按目击次数;父链由近及远):')
    for (const r of rows) {
      const chain = r.chain.map((c) => c.name || c.pid).join(' <- ')
      L.push(
        `  ${String(r.w).padStart(5)}x${String(r.h).padEnd(5)} pid=${String(r.pid).padStart(6)} ${(r.image ?? '(未判定)').padEnd(18)} ${r.class.slice(0, 26).padEnd(26)} 「${r.title.slice(0, 40)}」 看到 ${r.seenIn}/${meta.frames} 帧`,
      )
      L.push(`      链[${r.chainKind}] ${chain.slice(0, 160)}${r.chainWhy ? ` —— ${r.chainWhy}` : ''}`)
    }
  }
  const und = (meta.result?.attributionUndetermined ?? []).slice(0, 10)
  if (und.length) {
    L.push('\n归属未判定的窗口(有窗口、无进程信息 —— 这些不得进任何归属表):')
    for (const r of und) L.push(`  pid=${r.pid} ${r.class ? `类=${r.class} ` : ''}「${(r.title || '').slice(0, 40)}」 —— ${r.reason}`)
  }
  if (meta.undetermined.length) {
    L.push('\n未判定维度(取不到就叫取不到,绝不折成 0 或"没有"):')
    for (const u of meta.undetermined) L.push(`  · ${u}`)
  }
  if (meta.stderr) L.push(`\n(PowerShell stderr:${meta.stderr})`)
  L.push('\n(本工具只读:未结束任何进程、未写任何文件;唯一派生的是那个探针子进程,超时只终止它自己。)')
  return L.join('\n')
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then(({ exitCode, meta }) => {
      const asJson = process.argv.slice(2).includes('--json')
      if (asJson) process.stdout.write(JSON.stringify(meta ?? {}, null, 2) + '\n')
      else process.stdout.write(renderText(meta ?? {}) + '\n')
      process.exitCode = exitCode
    })
    .catch((e) => {
      process.stderr.write(`探针自身异常(未判定):${e?.stack ?? e?.message ?? e}\n`)
      process.exitCode = 2
    })
}

export const __test__ = {
  buildPowerShellScript,
  splitJsonLines,
  checkSchema,
  buildProcMap,
  deriveChain,
  classifyWindow,
  summarize,
  resolvePwsh,
  runPwshDefault,
  parseArgs,
  main,
  renderText,
  WINDOW_FIELDS,
  PROC_FIELDS,
  PWSH_CANDIDATES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
