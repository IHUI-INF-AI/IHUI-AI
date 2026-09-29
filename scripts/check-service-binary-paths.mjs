#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Windows 服务二进制路径烂掉量算器(票 G-302;只读:不创建/修改/启停任何服务、不写注册表)。
 *
 * 立因(真机实测 2026-09-27):`IHUI-RSSHUB` 的 nssm Application 指向
 * `C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-2\node.exe`,该 IDE 自升级把
 * 目录换成 22.22.2-3 ⇒ 路径不存在、服务停(win32 退出码 3),而提交链上全部门禁没有一道看得见,
 * Alertmanager 当时 0 条告警 —— 静默了 3 天。
 *
 * 判"某服务在不在跑"必须**分开问三件事**(本仓同族教训:一条门只管自己立项那一型,就是那一型的洞):
 *   D1 STATE   —— 服务现在什么态。只看这条会把"启动即崩"读成"停着而已"。
 *   D2 路径     —— 服务配置写的 Application 是否真是可用文件(AppDirectory 是否真是目录)。
 *   D3 答不答   —— 2026-09-29 起不再只看"配置里声明了哪个端口":先问**这个服务的进程树实际在听什么**,
 *                  再按**该端口实际绑定的地址**探一次;两者都量不到 ⇒ 如实"未判定",绝不推测成没问题。
 *
 * D3 的两处缺陷是本票改的对象(全部真机现读,不引用文档数字):
 *   ① 旧判据的端口**只**取自服务配置声明(REG pb64 ∪ nssm AppParameters/AppEnvironmentExtra)。声明为空
 *      ⇒ 直接判"未判定",**从不问进程实际在听什么**。后果不是"少一维信息",而是:某个服务的子进程
 *      死了、监听消失,这台尺子不会变红,因为它本来就没在看 —— 而它存在的理由(RSSHub 静默停 3 天)
 *      恰恰依赖这一维。本机实测 21 个服务里有 **12 个**因此停在"未判定"。
 *   ② 旧探测写死 `net.connect({host:'127.0.0.1'})`。实测 `Keycloak` 的 `7800` **只绑在网卡地址**
 *      `192.168.1.37:7800`:对它用 127.0.0.1 探必回 ECONNREFUSED ⇒ 一个活端口会被报成失败。现按 netstat
 *      给出的**实际绑定地址**探:`0.0.0.0` / `[::]` 这类通配才回落到 127.0.0.1,`[::1]` 用 `::1`
 *      (纯 IPv6 回环监听在 IPv4 上不可达,拿 127.0.0.1 探就是重犯 ②),具体网卡地址就用那个地址。
 *   进程树归并是必须的:nssm 托管的"服务进程"(Win32_Service.ProcessId)常常只是包装进程,真正持有监听
 *   端口的是它派生的子进程(实测 9 个全部如此,例如 IHUI-WEB 服务 pid 与监听者 pid 不同)。只查服务 pid
 *   会把 9 个健康服务全判成"没有监听"。归并有深度上限 + 环保护 + 节点上限,并排除 pid ≤ 4(System/Idle)。
 *   **一处如实登记的判据边界**:本机对"声明了端口"的服务,子进程死掉 ⇒ 声明端口无应答 ⇒ 判问题(有牙);
 *   而对"从不声明端口"的那一批,子进程死掉后的形态是"进程树实测无监听" ⇒ 落"此维不适用"的未判定,
 *   **不是判问题** —— 要判"曾经有、现在没了"需要一份上次读数做对照,那属下一票,不得在此假称已覆盖。
 *
 * D2/D3 有**两条互不替代的取材通道**(add/add 合并票的实质:两个会话各写了其中一条,现读两侧各缺一半):
 *   REG  = 注册表 `HKLM:/SYSTEM/CurrentControlSet/Services` 的 `Parameters\Application|AppDirectory|pb64`
 *          (pb64 是 AppParameters+AppEnvironmentExtra 的 base64,免竖线分隔冲突与码页污染)。
 *          不依赖 nssm.exe 在位;且把**全部 nssm 托管服务无条件拉进射程** —— 本机实测 `Keycloak` 是
 *          nssm 托管而不在 IHUI* 过滤集内,只按名字过滤的那一版对它零判据。
 *          `REGMISSING` + 末行 `SUM|<服务键总数>` 是这条通道的完整性哨兵:没有它们,"0 行"与
 *          "整面没枚举到"同形(§22c:判据失效的表现永远是安静)。
 *   NSSM = `nssm get <svc> Application|AppDirectory|AppParameters|AppEnvironmentExtra`,独有的价值是把
 *          **"值为空"(退出码 0 + 空白载荷)与"取不到值"(非零退出/派生失败)** 分成两态 —— 前者是量到的
 *          坏值,后者是尺子失效。实测 nssm stdout 为 UTF-16LE 无 BOM(NUL 占比 0.500,现读复核),
 *          按 utf8 读会得到夹杂 NUL 的乱码结论。
 *   两通道都取到同一个 Application 而值不同 ⇒ 判问题并点名两个值(互为旁证,不是二选一)。
 *   注册表枚举成功而该服务不在其中 ⇒ `nssmManaged=measured(false)` ⇒ 它不是 nssm 托管(实测 IHUI-PG:
 *   nssm 对它回 `Parameter "Application" is only valid for services managed by NSSM!`)⇒ 记 `skipped`
 *   而不是 unattested。**只有当所有失明维都能被"非 nssm 托管"解释时才这样降**:STATE 失明或已量到坏值
 *   时绝不降 —— 否则 skipped 就成了新的消红通道。
 *
 * 每维三态硬要求:`量到了 N` / `量不到(点名原因)` / `确实是 0` 绝不并桶。非 win32、两把解释器候选都不
 * 在位、派生超时、输出形态不认识、取值疑被码页打断、Application 非绝对路径 ⇒ 一律未判定:既不记通过,
 * 也**不冒判"路径不存在"**(那会把尺子失效伪装成"这台机有一批坏服务")。
 *
 * 定级(不得自作主张改):**warn / 手动问责档,绝不进 blocking 提交链** —— 服务路径属机器状态,提交者
 * 结构上满足不了;挂 blocking 就是每台每次被逼跳门、连带让全部守门作废(§12e 同型)。先例:
 * check-artifact-budget(warn)、visible-window-probe(刻意不进提交链)。它**不是守门判红项**,但
 * `scripts/guardian-runner.mjs` 现以 `mode:'warn' + skipEnv:'HUSKY_SKIP_SERVICE_BINARY_PATHS'` 注册它,
 * 所以本文件**必须**读那个开关(只在 CLI 档生效,§22d)—— 注册表声明了出路而脚本不读,等于写一条
 * 跑不通的出路(AGENTS §守门速查里 46/11c/50 记过同型)。定级要改只能改成 warn,不得升 blocking。
 *
 * 用法:node scripts/check-service-binary-paths.mjs [--json] [--strict] [--service <名>]... [--filter 'IHUI*'] [--self-test]
 *   问责入口 `pnpm check:service-paths`(默认档);`--strict` 把"有维量不到"也计入不通过(拒绝出具合格证)。
 * 退出码:0 = 跑完且没有量到的问题(有未判定维时末行明写"不出具合格证");1 = 至少一个服务**量到**了问题
 *   (路径不存在 / 非 RUNNING / 声明端口无应答 / 观察到的监听端点全部不应答 / Application 值为空 / 两通道取值不一致),--strict 下含未判定;
 *   2 = 未判定到给不出任何结论(非 win32 / 任一枚举通道没跑到 / 没有任何可判对象 / --self-test 失败)。
 */
import { spawnSync } from 'node:child_process'
import net from 'node:net'
import { existsSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { hostname } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

/** 解释器候选(合并自对侧):装了 PS7 优先它(AGENTS §27),in-box 兜底。
 *  ⚠ 本机 2026-09-28 现读 $PSVersionTable:**两者都是 7.6.2**,所以这条不是"两套引擎取其一",
 *  而是"其中一把不在位时本门不得整维失明"。候选一律绝对路径 —— 裸命令名依赖 PATH,而服务身份与
 *  交互账户的 PATH 互不相通(§5b 记过同型)。 */
export const PS_CANDIDATES = [
  { bin: 'C:/Program Files/PowerShell/7/pwsh.exe', label: 'pwsh(7)' },
  { bin: 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', label: 'powershell(in-box)' },
]
/** nssm 候选绝对路径 —— 机器事实按当次存在性取;都不在位则 NSSM 通道未判定(REG 通道仍可判 D2)。 */
export const NSSM_CANDIDATES = ['C:\\Windows\\System32\\nssm.exe']
/** netstat 的绝对路径候选 —— 同上,不依赖 PATH(§5b:服务身份与交互账户的 PATH 互不相通)。
 *  SystemRoot 由 env 推导而不是写死盘符;都不在位 ⇒ 监听观察维未判定(绝不读成"没有监听")。 */
export const NETSTAT_CANDIDATES = [
  ...(process.env.SystemRoot ? [process.env.SystemRoot.replace(/[\\/]+$/, '') + '\\System32\\NETSTAT.EXE'] : []),
  'C:\\Windows\\System32\\NETSTAT.EXE',
]
/** 通道 PROC 的首尾哨兵 + 两段各自的计数行:与 STATE/REG 同一条规矩 ——
 *  没有它们,"0 行"与"整面没枚举到"同形(§22c:判据失效的表现永远是安静)。 */
export const PROC_HEAD = '#IHUI-PROCLIST v1'
export const PROC_TAIL = '#IHUI-PROCLIST-END'
/** REG 通道里 `Parameters` 子键不存在 / 编码失败 的两个哨兵(带 '!' 前缀,与 base64 字符集互斥,
 *  所以解析式不会把真 base64 读成哨兵,也不会把哨兵读成空载荷)。 */
export const REG_NO_PARAMS = '!N'
export const REG_ENCODE_ERROR = '!E'
/** 通道 A 的枚举要同时见到首尾哨兵才算"量到了";§5b 记过双引号转义让 PS 静默返空的坑,
 *  没有哨兵的"0 行"与"根本没跑到"必须能分开。 */
export const ENUM_HEAD = '#IHUI-SVC-LIST v1'
export const ENUM_TAIL = '#IHUI-SVC-END'
const PS_TIMEOUT_MS = Number(process.env.IHUI_SERVICE_ENUM_TIMEOUT_MS) || 120_000
const NSSM_TIMEOUT_MS = 5_000
const TCP_TIMEOUT_MS = 1_500
const NETSTAT_TIMEOUT_MS = 15_000
const PROC_TIMEOUT_MS = 60_000
/** 每服务最多探这么几个端点(再多说明配置里有噪声,只按前几个作答,其余如实报数)。 */
const MAX_PROBE_PORTS = 6
/** 进程树归并的两条硬上限 + 环保护:没有上限时,一台机器上 pid/ppid 数据异常就能把遍历变成死循环。 */
const TREE_MAX_DEPTH = 6
const TREE_MAX_NODES = 800

// ---------------------------------------------------------------------------
// 三态维度的唯一表示:`{kind:'measured', value}` 或 `{kind:'unmeasured', reason}`。
// "值是空串/空数组"属于 **measured**(量到了空),"拿不到"才属于 unmeasured。
// ---------------------------------------------------------------------------
const measured = (value) => ({ kind: 'measured', value })
const unmeasured = (reason) => ({ kind: 'unmeasured', reason: String(reason ?? '(无原因)') })

// ---------------------------------------------------------------------------
// 纯函数层(全部被测试直接 import,§22c:测试里不得再抄一份实现)
// ---------------------------------------------------------------------------

/**
 * nssm 输出解码。实测 stdout 是**无 BOM 的 UTF-16LE**(NUL 占比 ~0.5);不假设一定有 BOM,
 * 按 NUL 密度识别,识别不了退回 utf8 并如实标 encoding。
 */
export function decodeNssm(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.alloc(0)
  if (b.length === 0) return { encoding: 'empty', text: '' }
  let nul = 0
  for (const byte of b) if (byte === 0) nul++
  const ratio = nul / b.length
  if (b[0] === 0xff && b[1] === 0xfe) return { encoding: 'utf16le', text: b.toString('utf16le').replace(/^\uFEFF/, '') }
  if (ratio >= 0.25 && b.length % 2 === 0) return { encoding: 'utf16le', text: b.toString('utf16le') }
  return { encoding: 'utf8', text: b.toString('utf8') }
}

/**
 * 把一次 nssm get 的原始结果折叠成一个维度。
 * 关键分岔:**code===0** 才是"取到了"(哪怕载荷是空白 ⇒ 值为空),
 * **派生失败 / 非零退出码** 一律 unmeasured 并带上 stderr 片段 —— 二者绝不同态。
 */
export function interpretNssmGet(raw) {
  if (raw?.spawnError) {
    const why = raw.spawnError === 'ETIMEDOUT' ? '派生超时' : raw.spawnError === 'ENOENT' ? 'nssm 不在位' : raw.spawnError
    return unmeasured(`取不到值:派生失败(${why})`)
  }
  if (typeof raw?.code !== 'number') return unmeasured('取不到值:没有退出码可判')
  if (raw.code !== 0) {
    const err = decodeNssm(raw.stderrBuf).text.replace(/\r?\n/g, ' ').trim().slice(0, 120)
    return unmeasured(`取不到值:nssm 非零退出码 ${raw.code}${err ? ` (${err})` : ''}`)
  }
  const text = decodeNssm(raw.stdoutBuf).text.replace(/\r\n/g, '\n').trim()
  if (text === '') return measured(null) // ← "值为空":量到了,内容是空
  const first = text.split('\n')[0].trim()
  if (first === '') return measured(null)
  return measured(first)
}

/** nssm 的**多值**参数(AppEnvironmentExtra 每行一个值;AppParameters 也可能被分行写)不得只取首行。
 *  实测合并前本侧把 AppEnvironmentExtra 读成首行 ⇒ IHUI-OLLAMA 的 OLLAMA_HOST=127.0.0.1:11434 落在
 *  第二行以后,端口维被读成"确实没声明"(未判定),而注册表那份给得出 11434 —— 这就是本票合并前后
 *  该服务从"未出具合格证"变成"全维健康"的真实原因(现读退出码与名单见交付报告)。
 *  与 interpretNssmGet 的分工:单值参数仍取首行(语义不变),多值参数走这里保留全部行。 */
export function interpretNssmGetMultiline(raw) {
  if (raw?.spawnError || typeof raw?.code !== 'number' || raw.code !== 0) return interpretNssmGet(raw)
  const text = decodeNssm(raw.stdoutBuf).text.replace(/\r\n/g, '\n')
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l !== '')
  return lines.length === 0 ? measured(null) : measured(lines.join('\n'))
}

/** 取值疑似被码页打断(替换字符 U+FFFD / C0 控制字符,不含 Tab 与 CRLF)⇒ 不得据它判"路径不存在"
 *  (合并自对侧)。刻意用码位枚举而不是把 U+FFFD 写进源码字符类 —— 那是本仓记过的"说明性文字
 *  也会带执行性字符"那一型,而且复制粘贴会把 BOM/零宽字符一起带进来,让判据悄悄改义。 */
export function looksCorrupted(v) {
  const s = String(v)
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c === 0xfffd) return true
    if (c <= 0x08) return true
    if (c === 0x0b || c === 0x0c) return true
    if (c >= 0x0e && c <= 0x1f) return true
  }
  return false
}

/** 端口维度:从服务**自身配置**(注册表 pb64 与/或 nssm AppParameters+AppEnvironmentExtra)里抠端口。
 *  只认这几形态;抠不到 ⇒ 空数组(合法结论"该配置确实没写端口"),不是猜测。 */
export function extractPortsFromConfig(texts) {
  const joined = (Array.isArray(texts) ? texts : [texts]).filter((t) => typeof t === 'string' && t !== '').join('\n')
  const out = new Set()
  const push = (raw) => {
    const n = Number(raw)
    if (Number.isInteger(n) && n > 0 && n <= 65535) out.add(n)
  }
  for (const m of joined.matchAll(/PORT=(\d{2,5})\b/g)) push(m[1])
  // 刻意不写 \bHOST=:实测 OLLAMA_HOST 这类带下划线前缀的键里,"词边界"会把整条正则打掉
  // (下划线是词字符)—— 那是"扫到 0"伪装成"没有声明"的一型。
  for (const m of joined.matchAll(/HOST=[^\s;]*?:(\d{2,5})\b/g)) push(m[1])
  for (const m of joined.matchAll(/--port(?:=|\s+)(\d{2,5})\b/g)) push(m[1])
  for (const m of joined.matchAll(/(?:^|[\s"])\/p(?:ort)?[:=](\d{2,5})\b/gm)) push(m[1])
  for (const m of joined.matchAll(/-p\s+(\d{2,5})\b/g)) push(m[1])
  for (const m of joined.matchAll(/listen-address[=:\s]+:?(?:[\d.]*:)?(\d{2,5})\b/g)) push(m[1])
  return [...out].sort((a, b) => a - b)
}

/** pb64 字段 → 三态:哨兵 / 解得出 / 解不出。解不出绝不读成"没有端口声明"。 */
export function decodeRegistryConfigBlob(field) {
  if (field === REG_NO_PARAMS) return { kind: 'absent', text: '' }
  if (field === REG_ENCODE_ERROR) return { kind: 'error', text: '' }
  if (!/^[A-Za-z0-9+/=]*$/.test(String(field))) return { kind: 'error', text: '' }
  try {
    return { kind: 'ok', text: Buffer.from(String(field), 'base64').toString('utf8') }
  } catch {
    return { kind: 'error', text: '' }
  }
}

/** 通道 A:Get-Service 枚举(只读)。首尾哨兵 + 全程 ASCII,把"PS 静默返空"那一型挡在未判定侧。 */
export function buildEnumerationScript() {
  return [
    "$ErrorActionPreference = 'Stop'",
    'try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch { }',
    `Write-Output '${ENUM_HEAD}'`,
    'try {',
    '  $svcs = @(Get-Service -ErrorAction Stop)',
    "  foreach ($s in $svcs) { Write-Output ('SVC|' + $s.Name + '|' + [string]$s.Status + '|' + [string]$s.StartType) }",
    '} catch { Write-Error $_; exit 9 }',
    `Write-Output '${ENUM_TAIL}'`,
    'exit 0',
  ].join('\n')
}

/** 通道 REG:注册表枚举行(nssm 托管形态)。路径一律正斜杠 —— 反斜杠经 `-Command` 传给解释器会被
 *  吃掉(对侧实测把 `HKLM:\SYSTEM\...` 变成 `HKLM:SYSTEMCurrentControlSetServices` ⇒ 整面恒空 ⇒ 假未判定)。
 *  `img=` 放末段贪婪匹配:ImagePath 本身可以含竖线,而 app=/dir= 含竖线的行**解不出** ⇒ 落 unparsed ⇒
 *  未判定(由自检 REG-13 钉住,不得静默丢行)。 */
export function buildRegistryScript() {
  return [
    "$ErrorActionPreference = 'SilentlyContinue'",
    'try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch { }',
    "$base='HKLM:/SYSTEM/CurrentControlSet/Services'",
    'if (-not (Test-Path $base)) { Write-Output ("REGMISSING|" + $base); Write-Output "SUM|NA"; exit 0 }',
    '$total = 0',
    'foreach ($k in @(Get-ChildItem $base)) {',
    '  $total = $total + 1',
    '  $img = [string](Get-ItemProperty -Path $k.PSPath -Name ImagePath).ImagePath',
    "  $pp = Join-Path $k.PSPath 'Parameters'",
    "  $app = ''; $dir = ''; $pb = ''",
    '  if (Test-Path $pp) {',
    '    $app = [string](Get-ItemProperty -Path $pp -Name Application).Application',
    '    $dir = [string](Get-ItemProperty -Path $pp -Name AppDirectory).AppDirectory',
    '    $pa = @((Get-ItemProperty -Path $pp -Name AppParameters).AppParameters)',
    '    $ee = @((Get-ItemProperty -Path $pp -Name AppEnvironmentExtra).AppEnvironmentExtra)',
    '    try { $pb = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($pa + $ee) -join "`n")) } catch { $pb = ' +
      "'" + REG_ENCODE_ERROR + "'" +
      ' }',
    '  } else { $pb = ' +
      "'" + REG_NO_PARAMS + "'" +
      ' }',
    "  if ((-not [string]::IsNullOrEmpty($app)) -or ($img -match '(?i)nssm')) {",
    "    Write-Output ('SVC|' + $k.PSChildName + '|app=' + $app + '|dir=' + $dir + '|pb64=' + $pb + '|img=' + $img)",
    '  }',
    '}',
    "Write-Output ('SUM|' + $total)",
  ].join('\n')
}

const REG_SVC_RE = /^SVC\|([^|]+)\|app=([^|]*)\|dir=([^|]*)\|pb64=(![NE]|[A-Za-z0-9+/=]*)\|img=(.*)$/

/** 通道 A 输出折叠:哨兵不齐 = 未判定;"两哨兵之间 0 行" = 确实是 0 —— 三态各归各位。 */
export function parseServiceList(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
  const head = lines.findIndex((l) => l.trim() === ENUM_HEAD)
  const tail = lines.findIndex((l) => l.trim() === ENUM_TAIL)
  if (head === -1 || tail === -1 || tail < head)
    return unmeasured(`取不到值:STATE 枚举输出缺首尾哨兵(head=${head !== -1}, tail=${tail !== -1}) ⇒ 无法区分"没有服务"与"没跑到"`)
  const rows = []
  let bad = 0
  for (const line of lines.slice(head + 1, tail)) {
    const t = line.trim()
    if (t === '') continue
    const parts = t.split('|')
    if (parts.length < 4 || parts[0] !== 'SVC') {
      bad++
      continue
    }
    const [, name, status, startType] = parts
    if (!name) {
      bad++
      continue
    }
    rows.push({ name, status: String(status ?? '').toUpperCase() || 'UNKNOWN', startType: String(startType ?? '').toUpperCase() })
  }
  return measured({ rows, malformed: bad })
}

/** 通道 REG 输出折叠。解不出的行必须留下并汇进未判定 —— 静默丢行等于把"没看清"写成"没有"。
 *  `sumMissing`(截断)与 `regMissing`(基键读不到)是两个不同原因,不得并成一个"0 个服务"。 */
export function parseRegistryOutput(text) {
  const rows = []
  const unparsed = []
  let totalServiceKeys = null
  let regMissing = false
  let sumSeen = false
  for (const raw of String(text ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('REGMISSING|')) {
      regMissing = true
      continue
    }
    if (line.startsWith('SUM|')) {
      sumSeen = true
      const v = line.slice(4).trim()
      if (v !== 'NA') {
        const n = Number(v)
        if (Number.isFinite(n)) totalServiceKeys = n
        else unparsed.push(line)
      }
      continue
    }
    const m = REG_SVC_RE.exec(line)
    if (!m) {
      unparsed.push(line)
      continue
    }
    rows.push({ service: m[1], application: m[2], appDirectory: m[3], pb64: m[4], imagePath: m[5] })
  }
  return { rows, totalServiceKeys, regMissing, sumSeen, unparsed }
}

// ---------------------------------------------------------------------------
// D3 的新取材层:「这个服务的进程树实际在听什么」(2026-09-29 本票)
// 全部是纯函数 —— 派生只发生在 defaultDeps 里,测试喂构造面/真机逐字夹具即可复现。
// ---------------------------------------------------------------------------

/** 回环探测地址:只有**通配绑定**才回落到它(见 probeHostForBind)。 */
export const LOOPBACK_PROBE_HOST = '127.0.0.1'

/** netstat 的 TCP 数据行:`TCP  <local>  <foreign>  LISTENING  <pid>`。本机实测表头是 GBK localized
 *  的(且 `TCP` / `LISTENING` 是 ASCII),所以判据只认 ASCII 词元,遇到解不出的 TCP 行**计数不丢弃**
 *  —— 静默跳过等于把"输出形态换了"读成"这台机没有监听"。 */
const NETSTAT_TCP_LISTEN_RE = /^TCP\s+(\S+)\s+(\S+)\s+LISTENING\s+(\d+)\s*$/
/** 一条 TCP 行里"状态"列是别的东西(TIME_WAIT / ESTABLISHED / CLOSED…)是**正常形态**,不得计成"解不出";
 *  只有列数都对不齐的行才算 malformed。反过来,状态列明明写着 LISTENING 而整行解不出的,**必须**算
 *  malformed —— 那是本判据对该行失明,读成"没有监听"就是把没看清写成没有问题。
 *  把前者计入 malformed 的代价是本机每次跑都刷出成百的假"形态不符"(自检 NS-3b 抓出来的:"提取式过宽"
 *  与"提取式过窄"都是判据缺陷,只是一个造噪声、一个造合格证)。 */
const NETSTAT_TCP_STATE_RE = /^TCP\s+\S+\s+\S+\s+\S+(\s+\d+)?\s*$/
const NETSTAT_LISTENING_PREFIX_RE = /^TCP\s+\S+\s+\S+\s+LISTENING(\s|$)/
/** `[::1]:7800` / `0.0.0.0:135` / `*:80` 三形态都解得出 {address, port};解不出返回 null。 */
export function splitHostPort(token) {
  const t = String(token ?? '').trim()
  const m = /^\[([^\]]+)\]:(\d+)$/.exec(t) ?? /^([^[\]:]+):(\d+)$/.exec(t)
  if (!m) return null
  const port = Number(m[2])
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null
  return { address: m[1], port }
}

/** netstat 文本 → 监听端点集合(折叠成三态:形态不认识 ⇒ unmeasured,"确实是 0"要显式说)。 */
export function interpretNetstatListening(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
  const rows = []
  let tcpLines = 0
  let notListening = 0
  let malformed = 0
  for (const line of lines) {
    const t = line.trim()
    if (t === '') continue
    if (!/^TCP(\s|$)/.test(t)) continue // UDP 行与 localized 表头:合法的非目标行,不计 malformed
    tcpLines++
    const m = NETSTAT_TCP_LISTEN_RE.exec(t)
    if (!m) {
      if (NETSTAT_LISTENING_PREFIX_RE.test(t)) malformed++ // 明明是监听行却解不出 ⇒ 判据失明,必须喊
      else if (NETSTAT_TCP_STATE_RE.test(t)) notListening++
      else malformed++
      continue
    }
    const hp = splitHostPort(m[1])
    if (!hp) {
      malformed++
      continue
    }
    rows.push({ address: hp.address, port: hp.port, pid: Number(m[3]) })
  }
  if (tcpLines === 0)
    return unmeasured('netstat 输出里没有任何 TCP 行 ⇒ 无法区分"确实没有监听"与"输出形态不认识",不推测为没有监听')
  if (malformed > 0 && rows.length === 0)
    return unmeasured(`netstat 的 TCP 行有 ${malformed} 条形态解不出且一条监听都没量到 ⇒ 判据对不上输出形态,不读成"没有监听"`)
  return measured({ rows, tcpLines, notListening, malformed })
}

/** 进程树 + 服务 pid 的枚举脚本(只读:两条 CIM 查询,不改任何东西)。全程 ASCII + 首尾哨兵 + 两段
 *  各自的计数行 —— 与 STATE/REG 同一条纪律:"没跑到"必须能和"跑到而什么都没有"分开。
 *  刻意用 `Win32_Service.ProcessId` 而不是 Get-Service:后者不暴露 pid,而 pid 是归并的起点。 */
export function buildProcessListScript() {
  return [
    "$ErrorActionPreference = 'Stop'",
    'try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch { }',
    `Write-Output '${PROC_HEAD}'`,
    'try {',
    '  $pc = 0',
    '  foreach ($p in @(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)) {',
    '    $pc = $pc + 1',
    "    $pp = [string]$p.ParentProcessId; if ([string]::IsNullOrEmpty($pp)) { $pp = 'NA' }",
    "    Write-Output ('PS|' + [string]$p.ProcessId + '|' + $pp)",
    '  }',
    "  Write-Output ('PSUM|' + $pc)",
    '} catch { Write-Error $_; exit 9 }',
    'try {',
    '  $sc = 0',
    '  foreach ($s in @(Get-CimInstance -ClassName Win32_Service -ErrorAction Stop)) {',
    '    $sc = $sc + 1',
    "    Write-Output ('SV|' + $s.Name + '|' + [string]$s.ProcessId)",
    '  }',
    "  Write-Output ('SSUM|' + $sc)",
    '} catch { Write-Error $_; exit 9 }',
    `Write-Output '${PROC_TAIL}'`,
    'exit 0',
  ].join('\n')
}

/** 该通道的折叠:哨兵/计数行不齐 ⇒ unmeasured;行解不出 ⇒ 进 unparsed 并汇进未判定(不静默丢)。 */
export function interpretProcessList(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
  const head = lines.findIndex((l) => l.trim() === PROC_HEAD)
  const tail = lines.findIndex((l) => l.trim() === PROC_TAIL)
  if (head === -1 || tail === -1 || tail < head)
    return unmeasured(`取不到值:进程枚举输出缺首尾哨兵(head=${head !== -1}, tail=${tail !== -1})⇒ 无法区分"没有进程"与"没跑到"`)
  const procs = []
  const svcPid = new Map()
  const unparsed = []
  let procSum = null
  let svcSum = null
  for (const line of lines.slice(head + 1, tail)) {
    const t = line.trim()
    if (t === '') continue
    if (t.startsWith('PSUM|')) {
      const n = Number(t.slice(5).trim())
      if (Number.isFinite(n)) procSum = n
      else unparsed.push(t)
      continue
    }
    if (t.startsWith('SSUM|')) {
      const n = Number(t.slice(5).trim())
      if (Number.isFinite(n)) svcSum = n
      else unparsed.push(t)
      continue
    }
    if (t.startsWith('PS|')) {
      const parts = t.split('|')
      const pid = Number(parts[1])
      const ppidRaw = parts[2]
      // pid **可以是 0**(System Idle Process 就在 Win32_Process 里)—— 刻意不收紧成 pid>0:
      // 真机第一跑就是被这里丢行打脸的 —— PSUM=311 而实收 310 ⇒ 整维判"输出被截断"而失明,
      // 一句"计数对不上"背后其实是"我的判序不认 pid 0"。收下行、由 buildProcessTree 拒绝它当根,
      // 才是把 pid 0 与"数不齐的行"分开处理(后者才该进 unparsed ⇒ 未判定)。
      if (parts.length === 3 && Number.isInteger(pid) && pid >= 0) {
        procs.push({ pid, ppid: ppidRaw === 'NA' || ppidRaw === '0' ? null : Number(ppidRaw) })
      } else unparsed.push(t)
      continue
    }
    if (t.startsWith('SV|')) {
      const parts = t.split('|')
      const name = parts[1]
      const pid = Number(parts[2])
      if (parts.length === 3 && name && Number.isInteger(pid)) svcPid.set(name.toLowerCase(), { name, pid })
      else unparsed.push(t)
      continue
    }
    unparsed.push(t)
  }
  if (procSum === null) return unmeasured(`取不到值:没有 PSUM 计数行 ⇒ 枚举被截断或解释器换了版式(unparsed=${unparsed.length})`)
  if (svcSum === null) return unmeasured(`取不到值:没有 SSUM 计数行 ⇒ 服务 pid 面被截断(unparsed=${unparsed.length})`)
  if (procSum !== procs.length || svcSum !== svcPid.size)
    return unmeasured(`取不到值:计数行与行数不符(PSUM=${procSum} 实收 ${procs.length};SSUM=${svcSum} 实收 ${svcPid.size})⇒ 输出被截断`)
  if (unparsed.length > 0) return unmeasured(`取不到值:有 ${unparsed.length} 行形态解不出(首条:${String(unparsed[0]).slice(0, 160)})⇒ 宁可整维未判定,也不把丢行读成"没有"`)
  return measured({ procs, svcPid, procSum, svcSum })
}

/** 服务 pid → 自身 + 全部后代。**深度上限 + 节点上限 + visited 环保护**三条都必须有:实测最长的一条
 *  是"服务 → 中间壳 → 子 → 孙"(nssm 包 cmd 包 node 那一型),而 ppid 数据异常时没有环保护就是死循环。
 *  pid ≤ SYSTEM_PID_FLOOR 一律不当根 —— System(4)/Idle(0) 名下挂着全机 RPC 监听,把它们当后代等于
 *  把别的进程的端口算到这个服务头上(比漏判更糟:那会造出"这服务在监听"的假账)。 */
export const SYSTEM_PID_FLOOR = 4
export function buildProcessTree(rootPid, procs, { maxDepth = TREE_MAX_DEPTH, maxNodes = TREE_MAX_NODES } = {}) {
  const children = new Map()
  for (const p of procs ?? []) {
    if (!p || !Number.isInteger(p.pid) || !Number.isInteger(p.ppid)) continue
    if (!children.has(p.ppid)) children.set(p.ppid, [])
    children.get(p.ppid).push(p.pid)
  }
  const root = Number(rootPid)
  if (!Number.isInteger(root) || root <= SYSTEM_PID_FLOOR) return { pids: new Set(), truncated: false, hitCap: false, rootUsable: false, root }
  const pids = new Set([root])
  let frontier = [root]
  let depth = 0
  let truncated = false
  let hitCap = false
  while (frontier.length > 0 && depth < maxDepth) {
    const next = []
    for (const pid of frontier) {
      for (const child of children.get(pid) ?? []) {
        if (child <= SYSTEM_PID_FLOOR || pids.has(child)) continue // 环保护:已收过的 pid 不再展开
        if (pids.size >= maxNodes) {
          hitCap = true
          truncated = true
          continue
        }
        pids.add(child)
        next.push(child)
      }
    }
    frontier = next
    depth++
    if (frontier.length > 0 && depth >= maxDepth) truncated = true
  }
  return { pids, truncated, hitCap, rootUsable: true, root, depth }
}

/** 把监听端点按 pid 归到某一棵进程树名下。绑定地址原样带出 —— 探测地址必须由它决定,不得写死回环。 */
export function attributeListening(listenRows, pidSet) {
  const out = []
  for (const r of listenRows ?? []) {
    if (!r || !pidSet || !pidSet.has(Number(r.pid))) continue
    out.push({ address: r.address, port: Number(r.port), pid: Number(r.pid) })
  }
  return out.sort((a, b) => a.port - b.port || String(a.address).localeCompare(String(b.address)))
}

/**
 * 探测地址 = 该端口**实际绑定的地址**,只有通配绑定才回落到回环:
 *   `0.0.0.0` / `[::]` / `*` → 127.0.0.1(通配含回环,一定能连上)
 *   `[::1]`                 → `::1`(纯 IPv6 回环监听在 IPv4 上不可达 ⇒ 拿 127.0.0.1 探就是假失败)
 *   `192.168.1.37`          → 原地址(本机实测 Keycloak 的 7800 只绑网卡地址,127.0.0.1 回 ECONNREFUSED)
 */
export function probeHostForBind(rawAddress) {
  const a = String(rawAddress ?? '').trim()
  const bare = a.replace(/^\[/, '').replace(/\]$/, '').trim()
  if (bare === '' || bare === '*' || bare === '0.0.0.0' || bare === '::') return LOOPBACK_PROBE_HOST
  return bare
}

/** 待探端点 = 声明端口 ∪ 观察到的监听端点,按端口去重。
 *  顺序刻意是"声明在前":声明是有期望值的(没人应答就该判问题),观察只是取证。
 *  一个端口若两边都有 ⇒ 用**观察到的绑定地址**探(修缺陷②);只在声明里出现 ⇒ 只能回落回环(旧行为)。 */
export function buildProbeTargets({ declaredPorts = [], observedEndpoints = [], cap = MAX_PROBE_PORTS } = {}) {
  const byPort = new Map()
  for (const ep of observedEndpoints) {
    const port = Number(ep?.port)
    if (!Number.isInteger(port)) continue
    if (!byPort.has(port)) byPort.set(port, [])
    byPort.get(port).push(ep)
  }
  const targets = []
  const seenHostPort = new Set()
  const push = (port, addressOrNull, from) => {
    const host = addressOrNull === null ? LOOPBACK_PROBE_HOST : probeHostForBind(addressOrNull)
    const key = `${host}:${port}`
    if (seenHostPort.has(key)) return
    seenHostPort.add(key)
    targets.push({ port, host, label: key, from })
  }
  for (const raw of declaredPorts) {
    const port = Number(raw)
    if (!Number.isInteger(port)) continue
    const eps = byPort.get(port)
    if (eps && eps.length > 0) for (const ep of eps) push(port, ep.address, 'declared+observed')
    else push(port, null, 'declared')
  }
  for (const [port, eps] of byPort) {
    if (declaredPorts.map(Number).includes(port)) continue
    for (const ep of eps) push(port, ep.address, 'observed')
  }
  const kept = targets.slice(0, cap)
  return { targets: kept, truncated: Math.max(0, targets.length - kept.length) }
}

/** 探测结果 → 应答维(三态)。判序三条都不可少:
 *  ① 声明端口里有"探不出"的 ⇒ 整维未判定 —— 把尺子失效写成"服务没应答"就是造冤案;
 *  ② 声明端口里有明确不应答的 ⇒ 量到的问题(即使别的观察端点是通的)—— 这就是"子进程死了"要有牙的那一格;
 *  ③ 没有声明端口时,只看观察到的端点:全不通 ⇒ 问题(内核说在听而地址上连不上,是真发现);
 *     有一个通 ⇒ 应答;探不出 ⇒ 未判定。 */
export function foldProbeOutcome({ targets, results, declaredPorts = [], truncated = 0 } = {}) {
  const declared = declaredPorts.map(Number).filter((n) => Number.isInteger(n))
  const openPorts = new Set()
  const unmeasuredWhys = []
  const closedLabels = []
  for (const r of results ?? []) {
    if (r?.status === 'open') openPorts.add(Number(r.port))
    else if (r?.status === 'unmeasured') unmeasuredWhys.push(`${r.label ?? r.port}:${r.why}`)
    else if (r?.status === 'closed') closedLabels.push(r.label ?? String(r.port))
  }
  const note = truncated > 0 ? `(端点超上限,未探 ${truncated} 个)` : ''
  const declaredMissing = declared.filter((p) => !openPorts.has(p))
  if (declaredMissing.length > 0) {
    const missingProbes = (results ?? []).filter((r) => declared.includes(Number(r.port)) && !openPorts.has(Number(r.port)))
    if (missingProbes.some((r) => r.status === 'unmeasured'))
      return unmeasured(`声明端口 ${declaredMissing.join(',')} 的探测判不出:${missingProbes.map((r) => r.why).join(';')}${note ? `;${note}` : ''}`)
    return measured({
      listening: false,
      ports: declaredMissing,
      openPorts: [...openPorts].sort((a, b) => a - b),
      labels: missingProbes.map((r) => r.label ?? String(r.port)),
      why: `声明端口无应答${note ? `(${note})` : ''}`,
    })
  }
  if (openPorts.size > 0) {
    // 应答的取证按**端点**记账,不按端口合并:同一个端口在 `::1` 与 `127.0.0.1` 上是两次不同的探测,
    // 拿"端口通了"去列出全部地址就是把"没验过的"混进"验过的"(真机现读 IHUI-PG 的 8810 即双绑)。
    // 没应答的那几个端点不消音:写进 note,由人读面原样印出来 —— 一个服务只要有一个端点真在答,
    // 本维就是"应答",这是判序②③的既有语义,本票没有改动它。
    const openLabels = (results ?? []).filter((r) => r?.status === 'open').map((r) => r.label ?? `${r.host}:${r.port}`)
    const notOpen = (results ?? [])
      .filter((r) => r?.status === 'closed' || r?.status === 'unmeasured')
      .map((r) => `${r.label ?? `${r.host}:${r.port}`}(${r.status === 'closed' ? '拒' : '判不出'})`)
    const detail = notOpen.length > 0 ? `另有 ${notOpen.length} 个监听端点未应答:${notOpen.join(',')}` : ''
    return measured({
      listening: true,
      ports: [...openPorts].sort((a, b) => a - b),
      openPorts: [...openPorts].sort((a, b) => a - b),
      labels: openLabels,
      note: [note, detail].filter(Boolean).join(';'),
    })
  }
  if (unmeasuredWhys.length > 0) return unmeasured(`监听端点探测判不出:${unmeasuredWhys.join(';')}${note ? `;${note}` : ''}`)
  if ((targets ?? []).length > 0)
    return measured({
      listening: false,
      ports: [...new Set(targets.map((t) => Number(t.port)))].sort((a, b) => a - b),
      openPorts: [],
      labels: closedLabels,
      why: `进程树实测在听而地址上连不上${note ? `(${note})` : ''}`,
    })
  return measured({ listening: false, ports: [], openPorts: [], labels: [], why: '无可探端点' })
}

/** 过滤器:'IHUI*' / 'ihui-*' 这类通配转成大小写不敏感正则;'*' 匹配一切。 */
export function compileFilter(pattern) {
  const p = String(pattern ?? 'IHUI*').trim()
  const re = new RegExp('^' + p.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i')
  return (name) => re.test(String(name))
}

/** 两通道取值 → D2 的落点(合并裁决:REG 为主、NSSM 为旁证, disagreement 是第三条判据)。 */
export function resolveApplication({ regRow, regChannelMeasured, nssmApplication }) {
  const regApp = regRow ? String(regRow.application ?? '').trim() : ''
  if (regApp) {
    const src = ['registry']
    if (nssmApplication.kind === 'measured') {
      src.push('nssm')
      if (nssmApplication.value !== null && nssmApplication.value !== regApp)
        return { application: measured(regApp), sources: src, disagreement: measured(`两通道取值不一致:registry='${regApp}' vs nssm='${nssmApplication.value}'`) }
    }
    return { application: measured(regApp), sources: src, disagreement: measured(false) }
  }
  // 注册表这一行是靠 ImagePath 命中 nssm 才出现的,而 Parameters\Application 是空的
  if (nssmApplication.kind === 'measured') {
    const src = nssmApplication.value === null ? ['nssm(值为空)'] : ['nssm']
    return { application: nssmApplication, sources: src, disagreement: measured(false) }
  }
  if (regRow) return { application: unmeasured('Parameters 无 Application 值 ⇒ 二进制落点无从判定(仅 ImagePath 命中 nssm),nssm 通道又取不到'), sources: ['registry-empty'], disagreement: unmeasured('只有一通道给得出东西,无从对账') }
  if (regChannelMeasured) return { application: nssmApplication, sources: ['nssm'], disagreement: unmeasured('该服务不在注册表 nssm 枚举集内(见 nssmManaged)') }
  return { application: nssmApplication, sources: [], disagreement: unmeasured('REG 通道未判定') }
}

/** nssm 托管性:注册表枚举成功而该服务不在其中 ⇒ measured(false)(实测 IHUI-PG 即此型)。 */
export function resolveNssmManaged({ regRow, regChannelMeasured, inStateRows }) {
  if (!regChannelMeasured) return unmeasured('REG 通道未判定 ⇒ 无从判断该服务是否 nssm 托管')
  if (regRow) return measured(true)
  if (!inStateRows) return unmeasured('该服务既不在注册表 nssm 枚举集内,也不在 STATE 枚举结果内 ⇒ 名字对不对都没量到')
  return measured(false)
}

/** pb64 与 nssm 两份配置 → 端口声明维(取并集:任一通道给得出就用,绝不因一通道失效而丢另一通道的量)。 */
export function resolvePorts({ pb64, nssmParameters, nssmEnvironmentExtra }) {
  const texts = []
  const sources = []
  if (pb64.kind === 'ok') {
    texts.push(pb64.text)
    sources.push('registry')
  }
  const nssmBoth = nssmParameters.kind === 'measured' && nssmEnvironmentExtra.kind === 'measured'
  if (nssmBoth) {
    texts.push(nssmParameters.value ?? '', nssmEnvironmentExtra.value ?? '')
    sources.push('nssm')
  }
  if (texts.length === 0) {
    const why =
      pb64.kind === 'absent' ? '注册表无 Parameters 子键' : pb64.kind === 'error' ? '注册表配置 blob 解不出' : pb64.kind === 'none' ? '该服务不在注册表 nssm 枚举集内(无行可读)' : 'REG 配置未判定'
    return { ports: unmeasured(`端口声明取不到:${why};且 nssm AppParameters/AppEnvironmentExtra 至少一份未量到`), portsSources: [] }
  }
  return { ports: measured(extractPortsFromConfig(texts)), portsSources: sources }
}

/**
 * 合并三判据成级别。规则(朝"不冤枉、不背书"收):
 *   任何一维**量到了坏值** ⇒ issue;
 *   有**非 nssm 托管解释不了**的失明维 ⇒ unattested(不冒充健康);
 *   失明维**全部**可由"该服务不是 nssm 托管"解释 ⇒ skipped(它压根不在 D2/D3 射程,但不是"没量到");
 *   全部维都量到且都好 ⇒ ok。
 * hardBlind 与 blind 的分工是这一版的关键:STATE 失明、或"已经量到 Application 却量不到存在性"
 * 这类,都不能被 skipped 掩盖 —— 否则 skipped 就成了新的消红通道。
 */
export function judgeService(rec) {
  const problems = []
  const blind = []
  const hardBlind = []
  const excuseable = (label, reason) => {
    blind.push(`${label}:${reason}`)
  }
  const hard = (label, reason) => {
    blind.push(`${label}:${reason}`)
    hardBlind.push(`${label}:${reason}`)
  }
  const state = rec.state
  if (state.kind === 'unmeasured') hard('STATE', state.reason)
  else if (state.value !== 'RUNNING') problems.push(`STATE=${state.value}`)

  const app = rec.application
  if (app.kind === 'unmeasured') excuseable('Application', app.reason)
  else if (app.value === null) problems.push('Application 值为空(通道取到了,内容是空)')
  else {
    const ex = rec.appExists
    if (ex.kind === 'unmeasured') hard('Application 存在性', ex.reason)
    else if (ex.value !== 'file') problems.push(`Application 路径不是可用文件(${ex.value}):${app.value}`)
  }

  const dir = rec.appDirectory
  if (dir.kind === 'measured' && dir.value !== null && dir.value !== '') {
    // 缺维按"未判定"处理而不是抛 TypeError:判据必须对部分构造的对象是全函数,
    // 否则任何调用方少给一个键就让整扇门在 e2e 之前先崩(镜像 T5 就是少给 appDirectoryExists 时撞出来的)。
    const d = rec.appDirectoryExists ?? unmeasured('AppDirectory 存在性维没有值(调用方未提供)')
    if (d.kind === 'unmeasured') excuseable('AppDirectory 存在性', d.reason)
    else if (d.value !== 'dir') problems.push(`AppDirectory 不是存在的目录(${d.value}):${dir.value}`)
  } else if (dir.kind === 'unmeasured') excuseable('AppDirectory', dir.reason)

  const dis = rec.agreement
  if (dis && dis.kind === 'measured' && typeof dis.value === 'string') problems.push(dis.value)

  const ports = rec.ports
  if (ports.kind === 'unmeasured') excuseable('端口声明', ports.reason)
  // 应答维不再由"声明是否为空"决定走哪条路 —— 声明为空时观察层可能给得出端点(本机实测 9 个服务即此型)。
  // 空不空的分岔搬到 foldProbeOutcome 的产出上:它给得出 measured 就照判,给不出才是失明。
  const probe = rec.probe ?? unmeasured('端口应答维没有值(调用方未提供)')
  if (probe.kind === 'unmeasured') {
    // 声明里明明有端口却探不出 ⇒ 这是硬失明,不能被 skipped 掩盖(否则 skipped 就成了新的消红通道)
    if (ports.kind === 'measured' && ports.value.length > 0) hard('端口应答', probe.reason)
    else excuseable('端口应答', probe.reason)
  } else if (probe.value.listening !== true) {
    if ((probe.value.ports ?? []).length > 0) problems.push(`监听无应答(tcp):${(probe.value.labels ?? probe.value.ports).join(',')}${probe.value.why ? ` —— ${probe.value.why}` : ''}`)
    else excuseable('端口应答', '应答维给的是"无可探端点"⇒ 这一维未判定,不推测为没问题')
  }

  const managed = rec.nssmManaged
  if (managed.kind === 'unmeasured') hard('nssm 托管性', managed.reason)

  let level
  if (problems.length > 0) level = 'issue'
  else if (hardBlind.length > 0) level = 'unattested'
  else if (blind.length > 0) level = managed.kind === 'measured' && managed.value === false ? 'skipped' : 'unattested'
  else level = 'ok'
  return { level, problems, blind, hardBlind }
}

/**
 * 退出码聚合(默认档 = 手动问责语义;--strict 追加"有维量不到也不出合格证")。
 * 任一通道未判定 ⇒ 2;没有任何可判对象(或全部只剩 skipped/unattested)⇒ 2 —— "空表"永远不是通过。
 */
export function computeExitCode(services, channels, opts = {}) {
  const strict = opts.strict === true
  const stateCh = channels?.state
  const regCh = channels?.registry
  if (!stateCh || stateCh.kind === 'unmeasured') return 2
  if (!regCh || regCh.kind === 'unmeasured') return 2
  const judged = services.filter((s) => s.level !== 'skipped')
  if (services.length === 0 || judged.length === 0) return 2
  if (judged.every((s) => s.level === 'unattested')) return 2
  if (services.some((s) => s.level === 'issue')) return 1
  if (strict && services.some((s) => s.level === 'unattested')) return 1
  return 0
}

// ---------------------------------------------------------------------------
// CLI 参数(纯函数,便于自检喂构造 argv)
// ---------------------------------------------------------------------------
export function parseArgs(argv) {
  const opts = { help: false, json: false, strict: false, selfTest: false, filter: 'IHUI*', services: [] }
  const bad = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') opts.help = true
    else if (a === '--json') opts.json = true
    else if (a === '--strict') opts.strict = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--filter') {
      const v = argv[++i]
      if (typeof v === 'string' && v !== '') opts.filter = v
      else bad.push('--filter 后面没有值')
    } else if (a === '--service') {
      const v = argv[++i]
      if (typeof v === 'string' && v !== '') opts.services.push(v)
      else bad.push('--service 后面没有值')
    } else bad.push(`不认识的参数:${a}`)
  }
  return { opts, bad }
}

/** 两把解释器候选按存在性择一(合并自对侧)。都不在位 ⇒ 两通道一起未判定,由调用方落 exit 2。 */
export function pickPowerShell(exists = (p) => existsSync(p)) {
  return PS_CANDIDATES.find((c) => exists(c.bin) === true) ?? null
}

// ---------------------------------------------------------------------------
// 真实执行体(只有 main() 的默认 deps 会走到这里;测试一律注入假 deps)
// ---------------------------------------------------------------------------
function defaultSpawn(cmd, args, timeoutMs) {
  try {
    const out = spawnSync(cmd, args, {
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'buffer',
    })
    if (out.error) return { spawnError: out.error.code || out.error.name || 'spawn-error', stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }
    return { code: out.status ?? -1, stdoutBuf: out.stdout ?? Buffer.alloc(0), stderrBuf: out.stderr ?? Buffer.alloc(0) }
  } catch (e) {
    return { spawnError: e?.code || e?.name || 'spawn-throw', stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }
  }
}

const defaultDeps = {
  platform: process.platform,
  host: () => hostname(),
  exists: (p) => existsSync(p),
  psBin: null,
  psEnumerate: (bin) => defaultSpawn(bin, ['-NoProfile', '-NonInteractive', '-Command', buildEnumerationScript()], PS_TIMEOUT_MS),
  psRegistry: (bin) => defaultSpawn(bin, ['-NoProfile', '-NonInteractive', '-Command', buildRegistryScript()], PS_TIMEOUT_MS),
  resolveNssm: () => NSSM_CANDIDATES.find((p) => existsSync(p)) ?? null,
  nssmGet: (nssmPath, svc, param) => defaultSpawn(nssmPath, ['get', svc, param], NSSM_TIMEOUT_MS),
  fileKind: (p) => {
    try {
      const st = statSync(p)
      if (st.isFile()) return 'file'
      if (st.isDirectory()) return 'dir'
      return 'other'
    } catch {
      return 'missing'
    }
  },
  /** netstat -ano:一次派生、只读;SystemRoot 推导的绝对路径优先,不依赖 PATH。 */
  netstatSnapshot: () => {
    const bin = NETSTAT_CANDIDATES.find((p) => existsSync(p)) ?? null
    if (!bin) return { spawnError: 'netstat 不在位(候选 ' + NETSTAT_CANDIDATES.join(', ') + ')' }
    return defaultSpawn(bin, ['-ano'], NETSTAT_TIMEOUT_MS)
  },
  psProcesses: (bin) => defaultSpawn(bin, ['-NoProfile', '-NonInteractive', '-Command', buildProcessListScript()], PROC_TIMEOUT_MS),
  /** 探测地址由**端口实际绑定的地址**决定(见 probeHostForBind)—— 写死回环会把只绑网卡的活端口报成失败。 */
  tcpProbe: (port, host = LOOPBACK_PROBE_HOST) =>
    new Promise((resolve) => {
      const sock = net.connect({ host, port })
      let settled = false
      const fin = (v) => {
        if (settled) return
        settled = true
        sock.destroy()
        resolve(v)
      }
      sock.setTimeout(TCP_TIMEOUT_MS)
      sock.once('connect', () => fin({ status: 'open' }))
      sock.once('timeout', () => fin({ status: 'unmeasured', why: `${host}:${port} 连接超时(${TCP_TIMEOUT_MS}ms)` }))
      sock.once('error', (e) => {
        const code = e && typeof e.code === 'string' ? e.code : 'unknown'
        if (code === 'ECONNREFUSED') fin({ status: 'closed' })
        else fin({ status: 'unmeasured', why: `${host}:${port} 报错(${code})` })
      })
    }),
}

function existenceOf(value, deps) {
  if (!value) return unmeasured('没有可判的存在性')
  if (looksCorrupted(value)) return unmeasured('取值含替换符/控制字符 ⇒ 疑被码页打断,不据此判缺失')
  if (!path.win32.isAbsolute(value)) return unmeasured(`非绝对路径(${value})⇒ 落点由 PATH/工作目录决定,本门不判缺失`)
  return measured(deps.fileKind(value))
}

/** 服务 pid → 该服务进程树实际持有的监听端点。三态里"量到的空"与"没量到"必须分得开:
 *  前者才允许说"任务型,此维不适用",后者只能说"这一维没看成"—— 两者的处置动作完全不同。 */
export function computeObservedListening({ servicePid, netstat, procs }) {
  if (!netstat || netstat.kind === 'unmeasured') return unmeasured(`监听观察取不到:netstat 维未判定(${netstat?.reason ?? '没有值'})`)
  if (!procs || procs.kind === 'unmeasured') return unmeasured(`监听观察取不到:进程树维未判定(${procs?.reason ?? '没有值'})`)
  const rawPid = Number(servicePid)
  if (servicePid === null || servicePid === undefined || !Number.isInteger(rawPid))
    return unmeasured('监听观察取不到:进程枚举里没有这个服务的 pid 条目 ⇒ 无从确定归并起点(与"服务停着所以 pid=0"是两件事)')
  const tree = buildProcessTree(rawPid, procs.value.procs)
  if (!tree.rootUsable)
    return unmeasured(`监听观察取不到:服务 pid=${rawPid} ≤ ${SYSTEM_PID_FLOOR}(未运行或非进程型),拿它当根会把 System/Idle 名下全机 RPC 监听算到该服务头上`)
  const endpoints = attributeListening(netstat.value.rows, tree.pids)
  return measured({ endpoints, treeSize: tree.pids.size, truncated: tree.truncated, listenerPids: [...new Set(endpoints.map((e) => e.pid))].sort((a, b) => a - b) })
}

async function inspectService({ name, stateValue, regRow, regChannelMeasured, inStateRows, deps, nssmPath, listen }) {
  const get = (param) => (nssmPath ? interpretNssmGet(deps.nssmGet(nssmPath, name, param)) : unmeasured(`取不到值:nssm 不在位(候选 ${NSSM_CANDIDATES.join(', ')} 都不存在)`))
  // 多值参数(AppEnvironmentExtra 一行一个)不得只取首行:本机现读 IHUI-OLLAMA 的 AppEnvironmentExtra 是
  // 7 行,`OLLAMA_HOST=127.0.0.1:11434` 落在第 2 行 ⇒ 用取首行的读法,端口维对"确实声明了端口"的服务
  // 静默失明(合并前该服务被判未判定,合并后判全维健康 —— 证据见交付说明)。
  const getMulti = (param) => (nssmPath ? interpretNssmGetMultiline(deps.nssmGet(nssmPath, name, param)) : unmeasured(`取不到值:nssm 不在位(候选 ${NSSM_CANDIDATES.join(', ')} 都不存在)`))
  const nssmApplication = get('Application')
  const nssmAppDirectory = get('AppDirectory')
  const nssmParameters = getMulti('AppParameters')
  const nssmEnvironmentExtra = getMulti('AppEnvironmentExtra')

  const { application, sources, disagreement } = resolveApplication({ regRow, regChannelMeasured, nssmApplication })
  const nssmManaged = resolveNssmManaged({ regRow, regChannelMeasured, inStateRows })
  const regDir = regRow ? String(regRow.appDirectory ?? '').trim() : ''
  const appDirectory = regDir ? measured(regDir) : nssmAppDirectory
  const appExists = application.kind === 'measured' && application.value !== null ? existenceOf(application.value, deps) : unmeasured('没有可判的存在性(Application 未量到)')
  const appDirectoryExists = appDirectory.kind === 'measured' && appDirectory.value !== null && appDirectory.value !== '' ? existenceOf(appDirectory.value, deps) : unmeasured('没有可判的存在性(AppDirectory 未量到)')
  // 没有注册表行 ⇒ 该通道对这个服务**什么都没有**,不得把"字段缺席"读成"空载荷"(那会把没判写成判过了)
  const { ports, portsSources } = resolvePorts({ pb64: regRow ? decodeRegistryConfigBlob(regRow.pb64) : { kind: 'none', text: '' }, nssmParameters, nssmEnvironmentExtra })

  // ── D3:先看进程树实际在听什么,再按**实际绑定地址**探(2026-09-29 本票改的就是这一段)────────
  const netstat = listen?.netstat ?? unmeasured('监听观察维没有值(调用方未提供 netstat)')
  const procs = listen?.procs ?? unmeasured('监听观察维没有值(调用方未提供进程树)')
  const servicePid = listen?.svcPid instanceof Map ? (listen.svcPid.get(name.toLowerCase())?.pid ?? null) : null
  const observed = computeObservedListening({ servicePid, netstat, procs })
  const declaredPorts = ports.kind === 'measured' ? ports.value : []
  const observedEndpoints = observed.kind === 'measured' ? observed.value.endpoints : []
  const { targets, truncated } = buildProbeTargets({ declaredPorts, observedEndpoints, cap: MAX_PROBE_PORTS })

  let probe
  if (targets.length > 0) {
    const results = await Promise.all(
      targets.map(async (t) => {
        const r = await deps.tcpProbe(t.port, t.host)
        return { ...t, status: r?.status ?? 'unmeasured', why: r?.why ?? '探测出口没有给出状态' }
      }),
    )
    probe = foldProbeOutcome({ targets, results, declaredPorts, truncated })
  } else if (observed.kind === 'measured') {
    // 量到了"树里没有任何 TCP 监听",且配置也没声明端口 —— 这才是可以说"此维不适用"的那一格。
    probe = unmeasured('该服务无监听端口(任务型),此维不适用(进程树实测:服务 pid 与其全部后代都没有 TCP 监听端点)')
  } else {
    probe = unmeasured(`${observed.reason}${declaredPorts.length === 0 ? ';且服务配置里读不到端口声明' : ''} ⇒ 这一维未判定,不推测为没问题`)
  }

  const rec = {
    name,
    scope: null,
    state: stateValue === undefined || stateValue === null ? unmeasured('该服务名不在 STATE 枚举结果里') : measured(stateValue),
    application,
    applicationSources: sources,
    appExists,
    appDirectory,
    appDirectoryExists,
    ports,
    portsSources,
    observed,
    probe,
    nssmManaged,
    agreement: disagreement,
  }
  const verdict = judgeService(rec)
  return { name, rec, ...verdict }
}

/** 监听观察取材:netstat 一次 + 进程树一次,折叠成三态并写进 meta(供人读面点名)。
 *  "退出码 0 而输出形态不认识" 与 "派生失败" 各有各的措辞 —— 三者不得并成一句"没有监听"。 */
async function collectListeningSnapshot(deps, meta) {
  const nsRaw = typeof deps.netstatSnapshot === 'function' ? deps.netstatSnapshot() : { spawnError: '调用方未提供 netstatSnapshot 出口' }
  let netstat
  if (nsRaw?.spawnError) netstat = unmeasured(`netstat 派生失败(${nsRaw.spawnError})`)
  else if (typeof nsRaw?.code === 'number' && nsRaw.code !== 0) netstat = unmeasured(`netstat 非零退出码 ${nsRaw.code}`)
  // 刻意不走 decodeNssm:netstat 的表头是 OEM 码页的本地化文字,按 UTF-8 解会得到替换符;
  // 数据行本就 ASCII,latin1 原样取出后只认 ASCII 词元,判据不受码页影响(本机实测表头 GBK、数据行 ASCII)。
  else netstat = interpretNetstatListening(latin1(nsRaw?.stdoutBuf))
  const procRaw = typeof deps.psProcesses === 'function' ? deps.psProcesses(meta.engine?.bin ?? null) : { spawnError: '调用方未提供 psProcesses 出口' }
  let procs
  if (procRaw?.spawnError) procs = unmeasured(`进程枚举派生失败(${procRaw.spawnError})`)
  else procs = interpretProcessList(decodeNssm(Buffer.from(procRaw?.stdoutBuf ?? '')).text)
  meta.channels.listen = netstat.kind === 'unmeasured' || procs.kind === 'unmeasured' ? unmeasured([netstat, procs].filter((d) => d.kind === 'unmeasured').map((d) => d.reason).join(';')) : measured(null)
  meta.listen = {
    netstatEndpoints: netstat.kind === 'measured' ? netstat.value.rows.length : null,
    netstatTcpLines: netstat.kind === 'measured' ? netstat.value.tcpLines : null,
    netstatNotListening: netstat.kind === 'measured' ? netstat.value.notListening : null,
    netstatMalformed: netstat.kind === 'measured' ? netstat.value.malformed : null,
    processCount: procs.kind === 'measured' ? procs.value.procSum : null,
    servicePidCount: procs.kind === 'measured' ? procs.value.svcSum : null,
  }
  return {
    netstat,
    procs,
    svcPid: procs.kind === 'measured' ? procs.value.svcPid : null,
  }
}

/** netstat 是 ANSI/OEM 码页的英文表头 + ASCII 数据行;按 latin1 取才不会被 GBK 表头带出替换符。 */
function latin1(buf) {
  try {
    return Buffer.isBuffer(buf) ? buf.toString('latin1') : String(buf ?? '')
  } catch {
    return ''
  }
}

export async function main({ argv = process.argv.slice(2), deps = defaultDeps } = {}) {
  const { opts, bad } = parseArgs(argv)
  if (bad.length) return { exitCode: 2, text: `参数不认识的形态:${bad.join(';')}\n(见 --help)`, json: null }
  if (opts.help)
    return {
      exitCode: 0,
      text: '见文件头注释。warn 级手动问责量算器:三判据(STATE / 路径在不在 / 答不答)分开问,D2/D3 有注册表与 nssm 两条取材通道,三态分明。只读,不改任何服务。',
      json: null,
    }
  if (opts.selfTest) return selfTest(opts)
  const meta = baseMeta(deps)
  if (deps.platform !== 'win32') {
    meta.fatal = `未判定:非 win32(${String(deps.platform)}),本工具不记为通过`
    return finish(meta, 2, opts)
  }
  const engine = deps.psBin ?? pickPowerShell(deps.exists)
  meta.engine = engine ? { bin: engine.bin, label: engine.label } : null
  if (!engine) {
    meta.channels.state = unmeasured('两把解释器候选都不在位 ⇒ 两条枚举通道都无法派生,未判定')
    meta.channels.registry = meta.channels.state
    meta.fatal = `未判定:${meta.channels.state.reason}`
    return finish(meta, 2, opts)
  }
  const nssmPath = deps.resolveNssm()
  meta.nssm = { path: nssmPath, why: nssmPath ? null : `候选 ${NSSM_CANDIDATES.join(', ')} 都不在位 ⇒ 只有 NSSM 通道失明,REG 通道仍可判 D2` }

  // 通道 A(STATE)
  const enumRaw = deps.psEnumerate(engine.bin)
  if (enumRaw.spawnError) meta.channels.state = unmeasured(`PowerShell 派生失败(${enumRaw.spawnError}) ⇒ 未判定,不记为通过`)
  else {
    const t = decodeNssm(Buffer.from(enumRaw.stdoutBuf ?? '')).text
    const p = parseServiceList(t)
    if (p.kind === 'unmeasured') {
      const errTail = decodeNssm(Buffer.from(enumRaw.stderrBuf ?? '')).text.replace(/\r?\n/g, ' ').trim().slice(0, 160)
      meta.channels.state = unmeasured(`${p.reason}${errTail ? `;stderr:${errTail}` : ''}(退出码 ${enumRaw.code})`)
    } else meta.channels.state = p
  }
  // 通道 B(REG)
  const regRaw = deps.psRegistry(engine.bin)
  if (regRaw.spawnError) meta.channels.registry = unmeasured(`注册表枚举派生失败(${regRaw.spawnError}) ⇒ 未判定,不记为通过`)
  else {
    const t = decodeNssm(Buffer.from(regRaw.stdoutBuf ?? '')).text
    const p = parseRegistryOutput(t)
    meta.registry = { totalServiceKeys: p.totalServiceKeys, regMissing: p.regMissing, unparsed: p.unparsed }
    const why = []
    if (!p.sumSeen) why.push('输出里没有 SUM 行 ⇒ 枚举被截断或解释器换了版式')
    if (p.regMissing) why.push('注册表基键 HKLM:/SYSTEM/CurrentControlSet/Services 读不到')
    for (const line of p.unparsed) why.push(`输出行形态解不出,已保留不丢弃:${String(line).slice(0, 200)}`)
    meta.channels.registry = why.length ? unmeasured(`${why.join(';')}(退出码 ${regRaw.code})`) : measured({ rows: p.rows })
  }
  if (meta.channels.state.kind === 'unmeasured' || meta.channels.registry.kind === 'unmeasured') return finish(meta, 2, opts)

  // 通道 C(监听观察)= netstat + 进程树。它**不**参与"整门 exit 2"的闸门:D1/D2 与"声明了端口的服务"
  // 在它失效时仍然可判,把半边失明升级成整面不给结论反而会把可用的取证挡掉。
  // 但它必须在这一轮被大声印出来 —— 静默降级就是本票要修的那个形态(§5e"失败必须响"同一条禁令)。
  const listen = await collectListeningSnapshot(deps, meta)

  const stateRows = meta.channels.state.value.rows
  const stateByName = new Map(stateRows.map((r) => [r.name.toLowerCase(), r]))
  const regRows = meta.channels.registry.value.rows
  const regByName = new Map(regRows.map((r) => [r.service.toLowerCase(), r]))

  // 入审集合:--filter/--service 命中的 STATE 服务 ∪ 全部注册表 nssm 服务(实测 Keycloak 只在这一侧)
  const want = new Set(opts.services)
  const match = opts.services.length > 0 ? (n) => want.has(n) : compileFilter(opts.filter)
  meta.filter = opts.services.length > 0 ? `--service ${opts.services.join(',')}` : opts.filter
  const scope = new Map()
  for (const r of stateRows) if (match(r.name)) scope.set(r.name.toLowerCase(), { name: r.name, from: 'filter' })
  for (const r of regRows) {
    const key = r.service.toLowerCase()
    if (scope.has(key)) scope.set(key, { name: scope.get(key).name, from: 'filter+registry' })
    else scope.set(key, { name: r.service, from: 'registry' })
  }
  meta.enumeration = { stateRows: stateRows.length, registryRows: regRows.length, matched: scope.size, registryAlwaysIn: regRows.filter((r) => !match(r.service)).map((r) => r.service) }
  meta.skippedByFilter = Math.max(0, stateRows.length - stateRows.filter((r) => match(r.name)).length)
  meta.malformedRows = meta.channels.state.value.malformed

  for (const [key, s] of scope) {
    const st = stateByName.get(key)
    meta.services.push(
      await inspectService({
        name: s.name,
        stateValue: st ? st.status : null,
        inStateRows: Boolean(st),
        regRow: regByName.get(key) ?? null,
        regChannelMeasured: true,
        deps,
        nssmPath,
        listen,
      }),
    )
    meta.services[meta.services.length - 1].rec.scope = s.from
  }

  return finish(meta, computeExitCode(meta.services, meta.channels, { strict: opts.strict }), opts)
}

function baseMeta(deps) {
  let host = null
  try {
    host = typeof deps.host === 'function' ? String(deps.host()) : null
  } catch {
    host = null // 主机名量不到不影响任何判据,如实留 null
  }
  return {
    tool: 'check-service-binary-paths',
    generatedAt: new Date().toISOString(),
    platform: String(deps.platform),
    host,
    fatal: null,
    engine: null,
    nssm: null,
    channels: { state: null, registry: null, listen: null },
    registry: null,
    listen: null,
    enumeration: null,
    filter: null,
    services: [],
    skippedByFilter: 0,
    malformedRows: 0,
    totals: null,
  }
}

function finish(meta, exitCode, opts) {
  const svcs = meta.services
  const count = (level) => svcs.filter((s) => s.level === level).length
  const dimUnmeasured = (pick) => svcs.filter((s) => (pick(s.rec) ?? { kind: 'unmeasured' }).kind === 'unmeasured').length
  meta.totals = {
    services: svcs.length,
    ok: count('ok'),
    issue: count('issue'),
    unattested: count('unattested'),
    skipped: count('skipped'),
    dimUnmeasured: {
      // ⚠ 本门历史上在这里翻过两次,方向相反,都把结论写得像跑通了:
      //   ① 旧版把 pick 收到的一层当 rec 又点一次 `.rec`(双重解引用),② 合并时我照旧注释改成
      //   `pick(s)`,于是 `.kind` 读在 undefined 上 —— 真跑到 finish 的 e2e 当场 TypeError。
      //   现事实:`svcs` 的每一项是 `{ name, rec, level, ... }`,所以解引用只做一次(s.rec),
      //   箭头形参名 rec 收到的正是那个 rec 对象。判据的口径必须由 e2e 而不是注释来定。
      state: dimUnmeasured((rec) => rec.state),
      application: dimUnmeasured((rec) => rec.application),
      ports: dimUnmeasured((rec) => rec.ports),
      observed: dimUnmeasured((rec) => rec.observed),
      probe: dimUnmeasured((rec) => rec.probe),
      nssmManaged: dimUnmeasured((rec) => rec.nssmManaged),
    },
    exitCode,
  }
  const text = renderText(meta)
  return { exitCode, text, json: JSON.stringify(meta, null, 2), opts }
}

export function renderText(meta) {
  const L = []
  L.push(`服务二进制路径量算器(G-302,warn 级,只读) @ ${meta.host ?? ''} platform=${meta.platform}`)
  if (meta.fatal) L.push(meta.fatal)
  L.push(`解释器:${meta.engine ? `${meta.engine.label} (${meta.engine.bin})` : '(未择到 —— 两把候选都不在位)'}`)
  if (meta.nssm) L.push(`nssm:${meta.nssm.path ?? `(不在位 —— ${meta.nssm.why})`}`)
  if (meta.filter) L.push(`过滤器:${meta.filter}(注册表 nssm 服务**无条件入审**,不受它收窄)`)
  if (meta.channels.state) L.push(`通道 STATE:${meta.channels.state.kind === 'unmeasured' ? `未判定 —— ${meta.channels.state.reason}` : `量到 ${meta.channels.state.value.rows.length} 个服务`}`)
  if (meta.channels.registry) {
    if (meta.channels.registry.kind === 'unmeasured') L.push(`通道 REG:未判定 —— ${meta.channels.registry.reason}`)
    else
      L.push(
        `通道 REG:量到 ${meta.channels.registry.value.rows.length} 个 nssm 托管形态(注册表服务键总数 ${meta.registry?.totalServiceKeys ?? '未判定'};REGMISSING=${meta.registry?.regMissing ? '是' : '否'};解不出的行 ${meta.registry?.unparsed?.length ?? 0} 条)`,
      )
  }
  if (meta.channels.listen)
    L.push(
      meta.channels.listen.kind === 'unmeasured'
        ? `通道 监听观察:未判定 —— ${meta.channels.listen.reason}`
        : `通道 监听观察:量到 netstat TCP 监听 ${meta.listen?.netstatEndpoints ?? '未判定'} 个端点(ASCII TCP 行 ${meta.listen?.netstatTcpLines ?? '?'} 行、非监听态 ${meta.listen?.netstatNotListening ?? 0} 行、形态不符 ${meta.listen?.netstatMalformed ?? 0} 行)、进程 ${meta.listen?.processCount ?? '?'} 个 / 服务 pid ${meta.listen?.servicePidCount ?? '?'} 个`,
    )
  if (meta.enumeration) {
    L.push(`入审 ${meta.enumeration.matched} 个(其中仅由注册表带入、不在过滤器命中集内的:${meta.enumeration.registryAlwaysIn.join(', ') || '无'})`)
    if (meta.enumeration.matched === 0) L.push('  (确实是 0:两通道都跑到了而没有任何入审对象。这不是"没量到",但也**不出合格证** —— 见退出码 2 的约定。)')
    if (meta.skippedByFilter) L.push(`  被过滤器跳过 ${meta.skippedByFilter} 个 STATE 服务`)
    if (meta.malformedRows) L.push(`  STATE 输出形态不符行 ${meta.malformedRows} 条未计入`)
  }
  for (const s of meta.services) {
    const fmt = (d) =>
      d.kind === 'measured'
        ? d.value === null
          ? '(空)'
          : Array.isArray(d.value)
            ? `[${d.value.join(',')}]`
            : typeof d.value === 'object'
              ? `${d.value.listening ? '应答' : '无应答'}(${(d.value.labels ?? d.value.ports ?? []).join(', ')}${d.value.note ? `〔${d.value.note}〕` : ''})`
              : String(d.value)
        : `未判定:${d.reason}`
    /** 观察维单独一种排版:它给的是"在听哪个地址、由哪个 pid 持有",这是本票新增的那一维的取证。 */
    const fmtObserved = (d) =>
      d.kind === 'measured'
        ? d.value.endpoints.length === 0
          ? '(实测无监听)'
          : d.value.endpoints.map((e) => `${e.address}:${e.port}←pid ${e.pid}`).join(' ') + (d.value.truncated ? ' (树已达深度上限)' : '')
        : `未判定:${d.reason}`
    const mark = s.level === 'issue' ? '❌' : s.level === 'ok' ? '✅' : s.level === 'skipped' ? '➖' : '⚪'
    L.push(`${mark} ${s.name}${s.rec.scope ? ` [${s.rec.scope}]` : ''}`)
    L.push(
      `    STATE=${fmt(s.rec.state)}  Application=${fmt(s.rec.application)}${s.rec.applicationSources.length ? `(源:${s.rec.applicationSources.join('+')})` : ''}  [存在性 ${fmt(s.rec.appExists)}]  AppDirectory=${fmt(s.rec.appDirectory)}  端口=${fmt(s.rec.ports)}  实测监听=${fmtObserved(s.rec.observed)}  应答=${fmt(s.rec.probe)}  nssm托管=${fmt(s.rec.nssmManaged)}`,
    )
    for (const p of s.problems) L.push(`      问题:${p}`)
    for (const b of s.blind) L.push(`      未判定:${b}`)
    if (s.level === 'skipped') L.push('      说明:该服务不是 nssm 托管 ⇒ D2(它自己声明的 Application 路径)对它不适用;STATE 与"实测监听/应答"两维仍按各自通道量过,见上面那行。')
  }
  const t = meta.totals
  if (t) {
    L.push(
      `结论:入审 ${t.services} 个 —— 量到问题 ${t.issue} / 未出具合格证(有维量不到)${t.unattested} / 全维健康 ${t.ok} / 非 nssm 托管跳过 ${t.skipped};各维未判定 STATE=${t.dimUnmeasured.state} Application=${t.dimUnmeasured.application} 端口声明=${t.dimUnmeasured.ports} 监听观察=${t.dimUnmeasured.observed} 应答=${t.dimUnmeasured.probe} 托管性=${t.dimUnmeasured.nssmManaged}`,
    )
    if (t.issue > 0) L.push('  ⚠️ 存在量到的问题 —— 这正是 RSSHub 那 3 天的形态:服务在、路径没了、无人喊。逐条见上;修复属机器状态动作,由持有人执行,本工具不动任何服务。')
    else if (t.services === 0 || t.services === t.skipped) L.push('判定:未判定 —— 这台机上没有任何对象被完整量到三判据,**不记为通过**。')
    else if (t.unattested > 0) L.push('判定:无量到的问题,但有服务存在未判定维(上面逐条点名)—— 不得把这行读成"全健康"。')
    else L.push('判定:全部入审对象的三判据都量到了且都健康。')
  }
  return L.join('\n')
}

// ---------------------------------------------------------------------------
// --self-test:全部跑在构造面上,零派生、零副作用(不派生 PowerShell/nssm、不碰注册表、不碰服务)。
// 正反成对:只留一侧就可能恒绿或恒红。夹具走 mkScratch(),落点不得在仓库树内。
// ---------------------------------------------------------------------------
function selfTest(opts) {
  const out = []
  let fail = 0
  const ok = (name, cond) => {
    if (cond) out.push(`  ✔ ${name}`)
    else {
      fail++
      out.push(`  ✘ ${name}`)
    }
  }
  const dim = (k, v) => (k === 'm' ? measured(v) : unmeasured(v))
  /** nssm 载荷形态的多行/单行构造器(UTF-16LE,与真机一致)。 */
  const u16Lines = (v) => Buffer.from((Array.isArray(v) ? v : [v]).join('\r\n'), 'utf16le')
  const nssmUn = dim('u', '取不到值:nssm 不在位(候选都不存在)')
  const healthy = (over = {}) => ({
    state: dim('m', 'RUNNING'),
    application: dim('m', 'C:\\node\\node.exe'),
    applicationSources: ['registry'],
    appExists: dim('m', 'file'),
    appDirectory: dim('m', 'C:\\app'),
    appDirectoryExists: dim('m', 'dir'),
    ports: dim('m', [8802]),
    probe: dim('m', { listening: true, ports: [8802] }),
    nssmManaged: dim('m', true),
    agreement: dim('m', false),
    ...over,
  })
  const judge = (over) => judgeService({ name: 'X', ...healthy(over) })
  const bothMeasured = { state: dim('m', { rows: [{ name: 'X', status: 'RUNNING', startType: 'AUTOMATIC' }] }), registry: dim('m', { rows: [] }) }
  const mk = (level) => ({ level, rec: healthy() })

  // ── 三态基础与"值为空 vs 取不到"的分岔(本侧维度)────────────────────────
  const dec = decodeNssm(Buffer.from('D:\\IHUI-AI\\apps\\web', 'utf16le'))
  ok('S1 UTF-16LE(无 BOM)按 NUL 密度识别并解出原值', dec.encoding === 'utf16le' && dec.text === 'D:\\IHUI-AI\\apps\\web')
  const vEmpty = interpretNssmGet({ code: 0, stdoutBuf: Buffer.from('\r\n', 'utf16le'), stderrBuf: Buffer.alloc(0) })
  const vFail = interpretNssmGet({ code: 3, stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.from('GetServiceConfigName failed', 'utf16le') })
  ok('S2 退出码 0+空白 ⇒ measured(null)(值为空);非零退出 ⇒ unmeasured(取不到)—— 两态绝不并桶',
    vEmpty.kind === 'measured' && vEmpty.value === null && vFail.kind === 'unmeasured')
  ok('S2b 派生失败(超时 / ENOENT)⇒ unmeasured 且点名原因',
    /超时/.test(interpretNssmGet({ spawnError: 'ETIMEDOUT' }).reason) && /不在位/.test(interpretNssmGet({ spawnError: 'ENOENT' }).reason))
  ok('S3 从服务自身配置抠端口:PORT= 与 HOST=...: 两形态都提得出', extractPortsFromConfig(['PORT=12000', 'OLLAMA_HOST=127.0.0.1:11434']).join(',') === '11434,12000')
  ok('S4 无端口声明 ⇒ 空数组(合法的"确实是没写"),不猜默认端口', extractPortsFromConfig(['-NoProfile -File run-web.ps1']).length === 0)
  const eRows = parseServiceList(`${ENUM_HEAD}\nSVC|IHUI-API|Running|Automatic\n${ENUM_TAIL}\n`)
  const eZero = parseServiceList(`${ENUM_HEAD}\n${ENUM_TAIL}\n`)
  ok('S5 STATE 哨兵齐 ⇒ 量到行;哨兵齐而零行 ⇒ 确实是 0;无哨兵 ⇒ 未判定("没跑到"不得读成"没有服务")',
    eRows.kind === 'measured' && eRows.value.rows.length === 1 && eZero.kind === 'measured' && eZero.value.rows.length === 0 && parseServiceList('').kind === 'unmeasured')
  ok('S5b 过滤器大小写不敏感、通配可用', compileFilter('ihui-*')('IHUI-RSSHUB') && !compileFilter('IHUI-*')('WSearch') && compileFilter('*')('Keycloak'))

  // ── 判据成对:每一条"拦得住"配一条"不冤枉"(本侧维度)─────────────────────
  ok('S6 路径不存在 ⇒ issue 且点名那条路径本身', (() => {
    const r = judge({ appExists: dim('m', 'missing') })
    return r.level === 'issue' && r.problems.some((p) => p.includes('C:\\node\\node.exe'))
  })())
  ok('S7 三判据全好 ⇒ ok(反向对照:不许把健康对象判红,缺这条就是恒红门)', judge().level === 'ok')
  ok('S8 两条通道都取不到 D2 ⇒ unattested,既不 ok 也不 issue', (() => {
    const r = judge({ application: nssmUn, appExists: dim('u', '没东西可判'), nssmManaged: dim('u', 'REG 未判定') })
    return r.level === 'unattested' && r.blind.some((b) => /不在位/.test(b))
  })())
  ok('S9 只有"端口这维读不到声明" ⇒ unattested(不得因 state+path 好就发合格证)', judge({ ports: dim('m', []), probe: dim('u', '没有声明') }).level === 'unattested')
  ok('S10 端口声明在而无应答 ⇒ issue;有应答见 S7 —— 成对', judge({ probe: dim('m', { listening: false, ports: [8802] }) }).level === 'issue')
  ok('S10b STATE 非 RUNNING 而其余全好 ⇒ issue(只看路径会把"停着"读成健康)', judge({ state: dim('m', 'STOPPED') }).level === 'issue')
  ok('S11 Application 值为空(取到了但内容是空)⇒ issue,与"取不到"不同态',
    judge({ application: dim('m', null), appExists: dim('u', '没有可判的存在性') }).level === 'issue')

  ok('S2c 多值参数保留全部行:OLLAMA 型(port 在第 2 行)不得被读成"没声明";反向对照单行值不受影响', (() => {
    const multi = interpretNssmGetMultiline({ code: 0, stdoutBuf: u16Lines(['OLLAMA_KEEP_ALIVE=24h', 'OLLAMA_HOST=127.0.0.1:11434']), stderrBuf: Buffer.alloc(0) })
    const single = interpretNssmGetMultiline({ code: 0, stdoutBuf: u16Lines('D:\\x\\node.exe'), stderrBuf: Buffer.alloc(0) })
    const viaSingle = interpretNssmGet({ code: 0, stdoutBuf: u16Lines(['OLLAMA_KEEP_ALIVE=24h', 'OLLAMA_HOST=127.0.0.1:11434']), stderrBuf: Buffer.alloc(0) })
    return (
      multi.kind === 'measured' && /11434/.test(multi.value) && extractPortsFromConfig([multi.value]).join() === '11434' &&
      single.value === 'D:\\x\\node.exe' &&
      // 阳性对照:旧的取首行读法对同一条载荷确实提不出端口 —— 不写这条,本判据不知道自己修好了什么
      extractPortsFromConfig([viaSingle.value]).length === 0
    )
  })())

  // ── 对侧独有维度:取值卫生 + 空枚举不记通过 ──────────────────────────────
  ok('R1 码页受损的取值 ⇒ 存在性未判定,而不是判它"路径不存在"', (() => {
    const ex = existenceOf('C:/x/' + String.fromCharCode(0xfffd) + 'node.exe', { fileKind: () => 'missing' })
    return ex.kind === 'unmeasured' && /码页/.test(ex.reason)
  })())
  ok('R1b 同一条判据对干净路径必须给 file(否则 R1 只是永真式)', existenceOf('C:/x/a-node.exe', { fileKind: () => 'file' }).value === 'file')
  ok('R2 非绝对路径 ⇒ 未判定而非 missing(落点由 PATH/工作目录决定,本门不判缺失)',
    existenceOf('node.exe', { fileKind: () => 'missing' }).kind === 'unmeasured')
  ok('R3 两通道都跑到而 0 个可判对象 ⇒ exit 2,"空表"永远不是通过',
    computeExitCode([], { state: dim('m', { rows: [] }), registry: dim('m', { rows: [] }) }) === 2)
  ok('R3b 任一通道未判定 ⇒ exit 2(半边失明不得写成整面通过)',
    computeExitCode([mk('ok')], { state: dim('m', { rows: [] }), registry: dim('u', 'REGMISSING') }) === 2 &&
      computeExitCode([mk('ok')], { state: dim('u', '静默空输出'), registry: dim('m', { rows: [] }) }) === 2)
  ok('R4 REGMISSING 基键行 ⇒ REG 通道未判定并点名,且 totalServiceKeys 留 null', (() => {
    const p = parseRegistryOutput('REGMISSING|HKLM:/SYSTEM/CurrentControlSet/Services\nSUM|NA\n')
    return p.regMissing === true && p.totalServiceKeys === null && p.rows.length === 0 && p.sumSeen === true
  })())
  ok('R5 缺 SUM 行(截断)⇒ sumSeen=false,不得读成"枚举完了而什么都没有"',
    parseRegistryOutput('SVC|A|app=C:/x/a.exe|dir=C:/x|pb64=!N|img=C:/x/nssm.exe\n').sumSeen === false)
  ok('R6 解不出的行必须保留并进未判定(静默丢行 = 把"没看清"写成"没有")', (() => {
    const p = parseRegistryOutput('SVC|A|app=C:/x/a.exe|dir=C:/x|pb64=!N|img=C:/x/nssm.exe\nGARBAGE LINE\nSUM|10\n')
    return p.rows.length === 1 && p.unparsed.length === 1 && /GARBAGE/.test(p.unparsed[0])
  })())
  ok('R7 img 含竖线时仍解析(末段贪婪)',
    parseRegistryOutput('SVC|A|app=C:/x/a.exe|dir=C:/x|pb64=!N|img=C:/a|b/nssm.exe\nSUM|10\n').rows[0].imagePath === 'C:/a|b/nssm.exe')
  ok('R8 pb64 三态:!N=无 Parameters 子键 / !E=编码失败 / base64=解得出,三者不得并桶', (() => {
    const a = decodeRegistryConfigBlob(REG_NO_PARAMS)
    const b = decodeRegistryConfigBlob(REG_ENCODE_ERROR)
    const c = decodeRegistryConfigBlob(Buffer.from('PORT=9096', 'utf8').toString('base64'))
    return a.kind === 'absent' && b.kind === 'error' && c.kind === 'ok' && extractPortsFromConfig([c.text]).join() === '9096'
  })())
  ok('R9 空 base64 ⇒ ok 而 text 为空;非 base64 字符 ⇒ error(不得读成"没有端口声明")', (() => {
    const zero = decodeRegistryConfigBlob(Buffer.from('', 'utf8').toString('base64'))
    return zero.kind === 'ok' && zero.text === '' && decodeRegistryConfigBlob('!!').kind === 'error'
  })())

  // ── 两通道合并裁决(本票新增的那一格)───────────────────────────────────
  ok('M1 REG 有值 ⇒ D2 取 REG;nssm 同值时源记 registry+nssm(旁证成立,不是重复劳动)', (() => {
    const r = resolveApplication({ regRow: { application: 'C:/x/node.exe' }, regChannelMeasured: true, nssmApplication: measured('C:/x/node.exe') })
    return r.application.value === 'C:/x/node.exe' && r.sources.includes('registry') && r.sources.includes('nssm') && r.disagreement.value === false
  })())
  ok('M2 两通道取值不一致 ⇒ 判 problem 并点名两个值(只有合并才有的第三条牙)', (() => {
    const ag = resolveApplication({ regRow: { application: 'C:/new/node.exe' }, regChannelMeasured: true, nssmApplication: measured('C:/old/node.exe') })
    const r = judge({ agreement: ag.disagreement })
    return r.level === 'issue' && r.problems.some((p) => /两通道取值不一致/.test(p) && p.includes('C:/new/node.exe') && p.includes('C:/old/node.exe'))
  })())
  ok('M3 REG 空 app + nssm 取不到 ⇒ 未判定(对侧那一型),不是"值为空"的 issue', (() => {
    const r = resolveApplication({ regRow: { application: '' }, regChannelMeasured: true, nssmApplication: nssmUn })
    return r.application.kind === 'unmeasured' && /仅 ImagePath 命中 nssm/.test(r.application.reason)
  })())
  ok('M4 REG 空 app + nssm 退出码 0 空载荷 ⇒ 保留本侧语义 measured(null)',
    resolveApplication({ regRow: { application: '' }, regChannelMeasured: true, nssmApplication: measured(null) }).application.value === null)
  ok('M5 注册表枚举成功而服务不在集内 ⇒ nssmManaged=measured(false)(实测 IHUI-PG 型)',
    resolveNssmManaged({ regRow: null, regChannelMeasured: true, inStateRows: true }).value === false)
  ok('M5b REG 通道未判定时不得据此断言"非 nssm 托管"(看不见 ≠ 没有)',
    resolveNssmManaged({ regRow: null, regChannelMeasured: false, inStateRows: true }).kind === 'unmeasured')
  ok('M6 非 nssm 托管 + 失明全因它不在射程 ⇒ skipped(不是 unattested,也不冒充 ok)', (() => {
    const r = judge({ application: dim('u', 'nssm 只对托管服务有效'), appExists: dim('u', 'x'), appDirectory: dim('u', 'x'), ports: dim('u', 'x'), probe: dim('u', 'x'), nssmManaged: dim('m', false) })
    return r.level === 'skipped' && r.hardBlind.length === 0
  })())
  ok('M6b skipped 不是消红通道:同一对象只要 STATE 失明或量到坏值,级别必须升回来', (() => {
    const blindState = judge({ state: dim('u', 'STATE 没跑到'), application: dim('u', 'x'), appExists: dim('u', 'x'), appDirectory: dim('u', 'x'), ports: dim('u', 'x'), probe: dim('u', 'x'), nssmManaged: dim('m', false) })
    const stopped = judge({ state: dim('m', 'STOPPED'), application: dim('u', 'x'), appExists: dim('u', 'x'), appDirectory: dim('u', 'x'), ports: dim('u', 'x'), probe: dim('u', 'x'), nssmManaged: dim('m', false) })
    return blindState.level === 'unattested' && stopped.level === 'issue'
  })())
  ok('M7 端口取两通道并集:REG 无 Parameters(!N)而 nssm 给得出 ⇒ 仍有端口(不因合并退化)', (() => {
    const r = resolvePorts({ pb64: decodeRegistryConfigBlob(REG_NO_PARAMS), nssmParameters: measured('--port 8815'), nssmEnvironmentExtra: measured('') })
    return r.ports.kind === 'measured' && r.ports.value.join() === '8815' && r.portsSources.includes('nssm')
  })())
  ok('M8 两通道都给不出配置 ⇒ 端口维未判定(既不推测"没有端口"更不推测"没问题")',
    resolvePorts({ pb64: { kind: 'none', text: '' }, nssmParameters: nssmUn, nssmEnvironmentExtra: nssmUn }).ports.kind === 'unmeasured')
  ok('M8b 字段缺席(!N 之类)与"空载荷"不得同形:后者是量到了空 ⇒ 合法 measured([])',
    resolvePorts({ pb64: decodeRegistryConfigBlob(Buffer.from('', 'utf8').toString('base64')), nssmParameters: nssmUn, nssmEnvironmentExtra: nssmUn }).ports.kind === 'measured')

  // ── 退出码聚合与 CLI 参数 ────────────────────────────────────────────────
  ok('S11 退出码:issue⇒1 / 全 unattested⇒2 / 有量到且无 issue⇒0 / 无可判对象⇒2 / 只剩 skipped⇒2',
    computeExitCode([mk('issue')], bothMeasured) === 1 &&
      computeExitCode([mk('unattested')], bothMeasured) === 2 &&
      computeExitCode([mk('ok'), mk('unattested')], bothMeasured) === 0 &&
      computeExitCode([], bothMeasured) === 2 &&
      computeExitCode([mk('skipped')], bothMeasured) === 2)
  ok('S11b --strict 只收紧"有维量不到"这一档,且不得把健康面也判红(否则问责档永不可用)',
    computeExitCode([mk('ok'), mk('unattested')], bothMeasured, { strict: false }) === 0 &&
      computeExitCode([mk('ok'), mk('unattested')], bothMeasured, { strict: true }) === 1 &&
      computeExitCode([mk('ok')], bothMeasured, { strict: true }) === 0)
  ok('A1 参数解析:--strict/--json/--self-test/--service/--filter 各自就位', (() => {
    const { opts, bad } = parseArgs(['--json', '--strict', '--service', 'IHUI-API', '--filter', 'ihui-*'])
    return opts.json && opts.strict && bad.length === 0 && opts.services.join() === 'IHUI-API' && opts.filter === 'ihui-*'
  })())
  ok('A2 缺值的 --filter/--service 与不认识的参数 ⇒ 报错清单(不静默吞)',
    parseArgs(['--filter']).bad.length === 1 && parseArgs(['--nope']).bad.length === 1)
  ok('A3 两条枚举脚本都被写全:REG 用正斜杠基键 + SUM + pb64 + 两个哨兵;STATE 用首尾哨兵', (() => {
    const reg = buildRegistryScript()
    const st = buildEnumerationScript()
    return reg.includes("'HKLM:/SYSTEM/CurrentControlSet/Services'") && reg.includes('SUM|') && reg.includes('pb64=') &&
      reg.includes(REG_NO_PARAMS) && reg.includes(REG_ENCODE_ERROR) && !reg.includes('HKLM:\\') &&
      st.includes(ENUM_HEAD) && st.includes(ENUM_TAIL) && st.includes('Get-Service') && !/Stop-Service/.test(st)
  })())

  // ── D3 新层:「进程树实际在听什么」+ 按实际绑定地址探(2026-09-29 本票)──────────────
  // 下面 NS-1 / TR-1 两条的输入是**本机现读逐字取回的** netstat 行与父子链(§22c:镜像/自检的
  // 输入至少一条取自真文件、真机形态),不是照着实现编出来的夹具。
  const NS_KEYCLOAK = '  TCP    192.168.1.37:7800      0.0.0.0:0              LISTENING       10532'
  const NS_WILDCARD = '  TCP    0.0.0.0:8802           0.0.0.0:0              LISTENING       8616'
  const NS_V6_LOOP = '  TCP    [::1]:8810             [::]:0                 LISTENING       6916'
  const NS_V6_ANY = '  TCP    [::]:56587             [::]:0                 LISTENING       22884'
  ok('NS-1 真机 netstat 行逐字可解:网卡绑定地址必须原样带出(缺陷②的取证面)', (() => {
    const r = interpretNetstatListening(`\r\nActive Connections\r\n  Proto  Local Address          Foreign Address        State           PID\r\n${NS_KEYCLOAK}\r\n`)
    return (
      r.kind === 'measured' &&
      r.value.rows.length === 1 &&
      r.value.rows[0].address === '192.168.1.37' && r.value.rows[0].port === 7800 && r.value.rows[0].pid === 10532
    )
  })())
  ok('NS-2 IPv6 两种形态都解:通配 [::] 与回环 [::1] 不得被混成同一种(探测地址由它决定)', (() => {
    const r = interpretNetstatListening(`${NS_V6_LOOP}\n${NS_V6_ANY}\n${NS_WILDCARD}\n`)
    return (
      r.kind === 'measured' && r.value.rows.length === 3 &&
      r.value.rows[0].address === '::1' && r.value.rows[1].address === '::' && r.value.rows[2].address === '0.0.0.0'
    )
  })())
  ok('NS-3 UDP 行与 localized 表头不计 malformed;一条 TCP 行都没有 ⇒ 未判定(不得读成"没有监听")', (() => {
    const gbkish = interpretNetstatListening('  活动连接\n  协议   本地地址          外部地址        状态           PID\n  UDP    0.0.0.0:5353           *:*      1234\n')
    const noTcp = interpretNetstatListening('')
    return gbkish.kind === 'unmeasured' && /没有任何 TCP 行/.test(gbkish.reason) && noTcp.kind === 'unmeasured'
  })())
  ok('NS-3b 有 TCP 行而零 LISTENING ⇒ measured(rows 为空)且计 notListening、malformed=0("确实是 0"与"没量到"分家)', (() => {
    const r = interpretNetstatListening('  TCP    1.2.3.4:5          5.6.7.8:9          ESTABLISHED 4321\n')
    return r.kind === 'measured' && r.value.rows.length === 0 && r.value.tcpLines === 1 && r.value.malformed === 0 && r.value.notListening === 1
  })())
  ok('NS-4 TCP 行形态不认识(列数不齐 / 监听行缺 PID)⇒ 判"未判定"并点名形态,不读成"这台机没有监听"', (() => {
    const r = interpretNetstatListening('  TCP    weird-form-here\n')
    const half = interpretNetstatListening('  TCP    1.2.3.4:5          5.6.7.8:9          LISTENING\n')
    return (
      r.kind === 'unmeasured' && /形态解不出/.test(r.reason) &&
      half.kind === 'unmeasured' && /形态解不出/.test(half.reason)
    )
  })())
  ok('PH-1 探测地址五条:通配→回环、IPv6 回环→::1、具体网卡→原地址(成对:网卡地址绝不被折成回环)', (() => {
    const wild = probeHostForBind('0.0.0.0') === LOOPBACK_PROBE_HOST && probeHostForBind('[::]') === LOOPBACK_PROBE_HOST && probeHostForBind('*') === LOOPBACK_PROBE_HOST
    const loop4 = probeHostForBind('127.0.0.1') === '127.0.0.1'
    const loop6 = probeHostForBind('[::1]') === '::1'
    const nic = probeHostForBind('192.168.1.37') === '192.168.1.37'
    return wild && loop4 && loop6 && nic
  })())
  ok('PH-2 空/畸形地址 ⇒ 未写死答案:回落回环但不得吞掉真地址(splitHostPort 拒 0 端口与 >65535)', (() => {
    const zero = splitHostPort('[::]:0')
    const big = splitHostPort('1.1.1.1:70000')
    const dns = splitHostPort('example.com:443')
    return zero === null && big === null && dns !== null && probeHostForBind('') === LOOPBACK_PROBE_HOST
  })())
  // 本机实测链:服务 pid 6372 → 4876 → 10532(真正持有 7800/8543/50027/57800 的那一个)
  const PROC_KEYCLOAK = [
    { pid: 10532, ppid: 4876 },
    { pid: 4876, ppid: 6372 },
    { pid: 6372, ppid: 1188 },
    { pid: 1188, ppid: 1052 },
  ]
  ok('TR-1 真机链:服务 pid 6372 的后代里必须有 10532(深度 2),而反向不得(祖先不是后代)', (() => {
    const t = buildProcessTree(6372, PROC_KEYCLOAK)
    const up = buildProcessTree(10532, PROC_KEYCLOAK)
    return t.pids.has(10532) && t.pids.has(4876) && !t.pids.has(1188) && up.pids.size === 1
  })())
  ok('TR-2 环保护与深度上限:自指/互指不得死循环;超深链必须 truncated 而不是静默少收', (() => {
    const selfRef = buildProcessTree(7, [{ pid: 7, ppid: 7 }, { pid: 8, ppid: 7 }])
    const mutual = buildProcessTree(7, [{ pid: 7, ppid: 9 }, { pid: 9, ppid: 7 }])
    let chain = []
    for (let i = 0; i < TREE_MAX_DEPTH + 4; i++) chain.push({ pid: 100 + i, ppid: i === 0 ? 100 : 99 + i })
    chain = [{ pid: 100, ppid: 50 }, ...chain]
    const deep = buildProcessTree(100, chain)
    return selfRef.pids.has(8) && mutual.pids.size === 2 && deep.truncated === true && deep.pids.size <= TREE_MAX_DEPTH + 2
  })())
  ok('TR-3 pid ≤ 4 不当归并起点(System/Idle 名下挂着全机 RPC 监听,算进服务头上就是假账)',
    buildProcessTree(4, PROC_KEYCLOAK).rootUsable === false && buildProcessTree(0, PROC_KEYCLOAK).rootUsable === false)
  ok('TR-4 attributeListening 只收树内的 pid;树外端口一格都不许算进来', (() => {
    const eps = attributeListening([{ address: '192.168.1.37', port: 7800, pid: 10532 }, { address: '127.0.0.1', port: 135, pid: 1188 }], buildProcessTree(6372, PROC_KEYCLOAK).pids)
    return eps.length === 1 && eps[0].port === 7800
  })())
  ok('TR-5 观察维三态:netstat 未判定 ⇒ 不许说"任务型";量到而树里为空 ⇒ measured(空)', (() => {
    const noChannel = computeObservedListening({ servicePid: 6372, netstat: unmeasured('netstat 派生失败(ENOENT)'), procs: measured({ procs: PROC_KEYCLOAK }) })
    const noPid = computeObservedListening({ servicePid: null, netstat: interpretNetstatListening(NS_KEYCLOAK), procs: measured({ procs: PROC_KEYCLOAK }) })
    const emptyTree = computeObservedListening({ servicePid: 6372, netstat: interpretNetstatListening('  TCP    1.1.1.1:9            0.0.0.0:0              LISTENING       4321\n'), procs: measured({ procs: PROC_KEYCLOAK }) })
    return (
      noChannel.kind === 'unmeasured' && /netstat 维未判定/.test(noChannel.reason) &&
      noPid.kind === 'unmeasured' && /没有这个服务/.test(noPid.reason) &&
      emptyTree.kind === 'measured' && emptyTree.value.endpoints.length === 0
    )
  })())
  ok('BT-1 待探端点:声明端口若在观察里出现 ⇒ 用观察到的绑定地址(缺陷②对声明端口同样成立)', (() => {
    const t = buildProbeTargets({ declaredPorts: [7800], observedEndpoints: [{ address: '192.168.1.37', port: 7800, pid: 10532 }] })
    return t.targets.length === 1 && t.targets[0].host === '192.168.1.37' && t.targets[0].from === 'declared+observed'
  })())
  ok('BT-1b 声明端口没人观察到时回落回环(旧行为不丢);纯观察端点按各自地址;同一 host:port 去重', (() => {
    const t = buildProbeTargets({ declaredPorts: [8802], observedEndpoints: [{ address: '127.0.0.1', port: 8801, pid: 1 }, { address: '[::]', port: 8801, pid: 2 }] })
    // 8801 的两条绑定(v4 回环 + v6 通配)都归一到 127.0.0.1:8801 ⇒ 必须只剩一个待探端点:
    // 探两次同一条 TCP 连接不产生新信息,只会白吃 MAX_PROBE_PORTS 的名额。
    const only8801 = t.targets.filter((x) => x.port === 8801)
    const declared = t.targets.find((x) => x.port === 8802)
    return only8801.length === 1 && only8801[0].host === '127.0.0.1' && only8801[0].from === 'observed' && declared.host === LOOPBACK_PROBE_HOST && declared.from === 'declared'
  })())
  ok('BT-1c 同一端口既有 v6 回环又有 v4 网卡绑定 ⇒ 两个地址都要探(只留一个就会漏掉"绑在 v6 上"那一型)', (() => {
    const t = buildProbeTargets({ declaredPorts: [], observedEndpoints: [{ address: '[::1]', port: 8810, pid: 1 }, { address: '127.0.0.1', port: 8810, pid: 2 }] })
    return t.targets.length === 2 && t.targets.some((x) => x.host === '::1') && t.targets.some((x) => x.host === '127.0.0.1')
  })())
  ok('BT-2 端点超上限必须报 truncated 数,不得静默只探前几个就当作全量结论', (() => {
    const many = Array.from({ length: 12 }, (_, i) => ({ address: '127.0.0.1', port: 9000 + i, pid: 77 }))
    const t = buildProbeTargets({ declaredPorts: [], observedEndpoints: many })
    return t.targets.length === MAX_PROBE_PORTS && t.truncated === 12 - MAX_PROBE_PORTS
  })())
  ok('FP-1 7800 那一格的成对锁:按实际地址探=应答;若有人把地址折回环(旧缺陷)必判无应答', (() => {
    const eps = [{ address: '192.168.1.37', port: 7800, pid: 10532 }]
    const { targets } = buildProbeTargets({ declaredPorts: [], observedEndpoints: eps })
    // 假探针:只有"打到真地址"才算 open —— 它模拟的正是本机实测(127.0.0.1:7800 回 ECONNREFUSED)。
    const answer = (host) => (host === '192.168.1.37' ? { status: 'open' } : { status: 'closed' })
    const good = foldProbeOutcome({ targets, results: targets.map((x) => ({ ...x, status: answer(x.host).status })), declaredPorts: [] })
    const legacy = foldProbeOutcome({ targets: [{ port: 7800, host: '127.0.0.1', label: '127.0.0.1:7800', from: 'declared' }], results: [{ port: 7800, label: '127.0.0.1:7800', status: 'closed' }], declaredPorts: [] })
    return good.kind === 'measured' && good.value.listening === true && legacy.value.listening === false && legacy.value.labels.join().includes('127.0.0.1:7800')
  })())
  ok('FP-2 反向对照(要求的"声明了端口而没人听"):必须判问题,不得退成未判定', (() => {
    const r = foldProbeOutcome({ targets: [{ port: 8802, host: '127.0.0.1', label: '127.0.0.1:8802', from: 'declared' }], results: [{ port: 8802, label: '127.0.0.1:8802', status: 'closed' }], declaredPorts: [8802] })
    const j = judge({ ports: dim('m', [8802]), probe: r })
    return r.kind === 'measured' && r.value.listening === false && j.level === 'issue' && j.problems.some((p) => p.includes('127.0.0.1:8802'))
  })())
  ok('FP-3 声明端口"探不出" ⇒ 未判定,不得被别的端点应答洗成通过', (() => {
    const r = foldProbeOutcome({
      targets: [{ port: 8802, host: '127.0.0.1', label: '127.0.0.1:8802', from: 'declared' }, { port: 9100, host: '127.0.0.1', label: '127.0.0.1:9100', from: 'observed' }],
      results: [{ port: 8802, label: '127.0.0.1:8802', status: 'unmeasured', why: '超时' }, { port: 9100, label: '127.0.0.1:9100', status: 'open' }],
      declaredPorts: [8802],
    })
    return r.kind === 'unmeasured' && /8802/.test(r.reason)
  })())
  ok('FP-4 观察到的端点全不应答(内核说在听而地址连不上)⇒ 问题,不是"未判定"', (() => {
    const r = foldProbeOutcome({ targets: [{ port: 8801, host: '127.0.0.1', label: '127.0.0.1:8801', from: 'observed' }], results: [{ port: 8801, label: '127.0.0.1:8801', status: 'closed' }], declaredPorts: [] })
    return r.kind === 'measured' && r.value.listening === false && /连不上/.test(r.value.why) && judge({ ports: dim('m', []), probe: r }).level === 'issue'
  })())
  ok('FP-5 无监听端口且是量到的 ⇒ 判据措辞必须是"任务型,此维不适用",不得与"没量到"同形', (() => {
    const taskType = judge({ ports: dim('m', []), probe: dim('u', '该服务无监听端口(任务型),此维不适用(进程树实测:服务 pid 与其全部后代都没有 TCP 监听端点)') })
    const blind = judge({ ports: dim('m', []), probe: dim('u', '监听观察取不到:netstat 派生失败(ENOENT)') })
    return (
      taskType.level === 'unattested' && taskType.blind.some((b) => /任务型/.test(b)) &&
      blind.level === 'unattested' && blind.blind.some((b) => /netstat 派生失败/.test(b)) && !blind.blind.some((b) => /任务型/.test(b))
    )
  })())
  ok('FP-6 声明为空而观察到手到端点 ⇒ 仍要有牙:应答则 ok,不应答则 issue', (() => {
    const open = judge({ ports: dim('m', []), probe: dim('m', { listening: true, ports: [8801], labels: ['127.0.0.1:8801'] }) })
    const dead = judge({ ports: dim('m', []), probe: dim('m', { listening: false, ports: [8801], labels: ['127.0.0.1:8801'], why: 'x' }) })
    return open.level === 'ok' && dead.level === 'issue'
  })())
  ok('FP-7 应答取证按端点不按端口合并:双绑地址只有一条真应答时,另一条不得混进 labels,也不许消音', (() => {
    // 真机现读形态:IHUI-PG 的 8810 同时绑在 [::1] 与 127.0.0.1 上,那是**两次**不同的探测
    // (双绑是真机现读;"其中一条被拒"是构造,那次现读两条都通 —— 本条判的是取证口径,不是机器事实)。
    const t = [
      { port: 8810, host: '::1', label: '::1:8810', from: 'observed' },
      { port: 8810, host: '127.0.0.1', label: '127.0.0.1:8810', from: 'observed' },
    ]
    const r = foldProbeOutcome({ targets: t, results: [{ ...t[0], status: 'closed' }, { ...t[1], status: 'open' }], declaredPorts: [] })
    const taskReason = '该服务无监听端口(任务型),此维不适用(进程树实测:服务 pid 与其全部后代都没有 TCP 监听端点)'
    // 平台值走具名常量而不是字面量:`platform: 'win32',` 与祖先 d2244d549 里已被删掉的那一行逐字同形,
    // 守门 84 的行级复活判据按行文本比对,会把"新写的夹具"读成"搬回旧行"。语义不变,只是不再撞文本。
    const WIN_PLATFORM = 'win32'
    const face = renderText({
      host: 'H',
      platform: WIN_PLATFORM,
      engine: null,
      nssm: null,
      channels: {},
      totals: null,
      services: [
        { name: 'A', level: 'ok', problems: [], blind: [], rec: healthy({ ports: dim('m', []), observed: dim('m', { endpoints: [{ address: '127.0.0.1', port: 8810, pid: 6916 }], treeSize: 2 }), probe: r }) },
        { name: 'B', level: 'unattested', problems: [], blind: ['端口应答:' + taskReason], rec: healthy({ ports: dim('m', []), observed: dim('m', { endpoints: [], treeSize: 1 }), probe: dim('u', taskReason) }) },
      ],
    })
    return (
      r.kind === 'measured' && r.value.listening === true &&
      r.value.labels.join() === '127.0.0.1:8810' && /另有 1 个监听端点未应答/.test(r.value.note) &&
      face.includes('实测监听=127.0.0.1:8810←pid 6916') && face.includes('::1:8810(拒)') && face.includes('此维不适用')
    )
  })())
  ok('PL-1 进程树通道三态:缺哨兵 / 缺计数行 / 计数与行数不符 / 有解不出的行 ⇒ 全部未判定,绝不静默丢行', (() => {
    const good = [PROC_HEAD, 'PS|6372|1188', 'PS|4876|6372', 'PS|10532|4876', 'PSUM|3', 'SV|Keycloak|6372', 'SV|IHUI-WEB|22696', 'SSUM|2', PROC_TAIL].join('\n')
    const g = interpretProcessList(good)
    const okCount = g.kind === 'measured' && g.value.procs.length === 3 && g.value.svcPid.get('keycloak').pid === 6372
    return (
      okCount &&
      interpretProcessList('').kind === 'unmeasured' &&
      interpretProcessList(`${PROC_HEAD}\n${PROC_TAIL}`).kind === 'unmeasured' &&
      interpretProcessList(good.replace('PSUM|3', 'PSUM|9')).kind === 'unmeasured' &&
      interpretProcessList(good.replace('PS|6372|1188', 'PS|6372')).kind === 'unmeasured'
    )
  })())
  ok('PL-2 父进程未知(ppid=NA)仍收下这个 pid —— 丢节点会把"看得见服务自己"变成看不见', (() => {
    const g = interpretProcessList([PROC_HEAD, 'PS|6372|NA', 'PSUM|1', 'SV|A|6372', 'SSUM|1', PROC_TAIL].join('\n'))
    return g.kind === 'measured' && g.value.procs[0].ppid === null && buildProcessTree(6372, g.value.procs).pids.has(6372)
  })())
  ok('PL-2b pid 0(System Idle)必须被收下并对得上账 —— 本机真跑第一把就是被"丢掉 pid 0 ⇒ PSUM≠实收"打成整维失明的', (() => {
    const g = interpretProcessList([PROC_HEAD, 'PS|0|NA', 'PS|4|0', 'PS|6372|1188', 'PSUM|3', 'SV|A|6372', 'SSUM|1', PROC_TAIL].join('\n'))
    const tree = buildProcessTree(6372, g.value.procs)
    return (
      g.kind === 'measured' && g.value.procs.length === 3 &&
      tree.pids.has(6372) && !tree.pids.has(0) && !tree.pids.has(4) &&
      buildProcessTree(0, g.value.procs).rootUsable === false
    )
  })())
  ok('PL-3 生成的枚举脚本:三条哨兵齐、只用两条 CIM 读查询、没有任何写动作', (() => {
    const s = buildProcessListScript()
    return (
      s.includes(PROC_HEAD) && s.includes(PROC_TAIL) && s.includes('Win32_Process') && s.includes('Win32_Service') &&
      !/Stop-Service|Set-Service|Remove-Service|Start-Process|Invoke-CimMethod/.test(s) && !/\$ErrorActionPreference = 'SilentlyContinue'/.test(s)
    )
  })())

  // ── 真夹具:存在性判据真的读文件系统,而夹具不得长在仓库树内 ─────────────

  let fixtureNote = ''
  try {
    const dir = mkScratch('svc-selftest-')
    try {
      const bin = path.join(dir, 'node.exe')
      writeFileSync(bin, 'placeholder')
      ok('F1 真夹具:落盘文件 ⇒ 存在性判据给 file ⇒ ok', judge({ appExists: measured(depsFileKind(bin)) }).level === 'ok')
      rmSync(bin)
      ok('F2 真夹具:同一路径删掉后 ⇒ missing(证明 missing 来自文件系统,不是硬编码)',
        judge({ appExists: measured(depsFileKind(bin)) }).level === 'issue')
      // 本模块就在 <repo>/scripts/ 下 ⇒ 上一级就是仓库根;写成两级会把"父目录"当仓库根,
      // 于是这条锁在任何机器上都恒假(夹具永远"在仓库内")—— 永假断言与永真断言同样没用。
      const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
      ok('F3 夹具落点不得在仓库树内(§26 唯一夹具落点)', !dir.startsWith(repo))
      fixtureNote = `\n  (真夹具 3 条已跑;落点 ${dir})`
    } finally {
      rmScratch(dir)
    }
  } catch (e) {
    ok('F0 真夹具建得起来(建不起来就是判据失效,必须喊出来)', false)
    fixtureNote = `\n  夹具失败:${e?.message ?? e}`
  }

  return {
    exitCode: fail > 0 ? 1 : 0,
    text: `自检 ${out.length} 条,失败 ${fail} 条(构造面 + 临时夹具,零派生):\n${out.join('\n')}${fixtureNote}\n${fail === 0 ? '✅ 自检全绿' : '❌ 自检有红 —— 判据本身有问题,先修尺子,不要去放宽判据'}`,
    json: opts.json ? JSON.stringify({ selfTest: { total: out.length, failed: fail } }, null, 2) : null,
  }
}

/** 夹具用的真实存在性判据(与生产档同一个 fileKind,证明的不是替身)。 */
function depsFileKind(p) {
  return defaultDeps.fileKind(p)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // 应急出口只作用于 CLI 档:被 import 时不得改变宿主进程的行为(§22d)
  if (process.env.HUSKY_SKIP_SERVICE_BINARY_PATHS === '1') {
    console.info('⏭  HUSKY_SKIP_SERVICE_BINARY_PATHS=1 —— 跳过服务二进制路径对账(机器态档,跳过不改变仓库结论)')
    process.exit(0)
  }
  const wantsJson = process.argv.slice(2).includes('--json')
  main()
    .then(({ exitCode, text, json }) => {
      const body = wantsJson && json !== undefined && json !== null ? json : text
      if (body) process.stdout.write(String(body) + '\n')
      process.exitCode = exitCode
    })
    .catch((e) => {
      // §22d:本工具自身异常 = 无法判定,不得以 uncaught 冒充判据的红或绿
      process.stderr.write(`本工具自身异常(未判定,不记为通过):${e?.stack ?? e?.message ?? String(e)}\n`)
      process.exitCode = 2
    })
}

export const __test__ = {
  measured, unmeasured, decodeNssm, interpretNssmGet, interpretNssmGetMultiline, looksCorrupted, extractPortsFromConfig,
  decodeRegistryConfigBlob, buildEnumerationScript, buildRegistryScript, parseServiceList,
  parseRegistryOutput, compileFilter, pickPowerShell, resolveApplication, resolveNssmManaged,
  resolvePorts, existenceOf, judgeService, computeExitCode, parseArgs, renderText, main, selfTest,
  interpretNetstatListening, splitHostPort, buildProcessListScript, interpretProcessList, buildProcessTree,
  attributeListening, probeHostForBind, buildProbeTargets, foldProbeOutcome, computeObservedListening,
  ENUM_HEAD, ENUM_TAIL, PROC_HEAD, PROC_TAIL, REG_NO_PARAMS, REG_ENCODE_ERROR, PS_CANDIDATES, NSSM_CANDIDATES,
  NETSTAT_CANDIDATES, LOOPBACK_PROBE_HOST, SYSTEM_PID_FLOOR, MAX_PROBE_PORTS, TREE_MAX_DEPTH, TREE_MAX_NODES,
  NSSM_TIMEOUT_MS, TCP_TIMEOUT_MS, NETSTAT_TIMEOUT_MS, PROC_TIMEOUT_MS, defaultDeps,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
