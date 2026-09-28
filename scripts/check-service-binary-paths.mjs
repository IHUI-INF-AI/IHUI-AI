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
 *   D3 答不答   —— 从服务自身配置读到端口就 TCP 探一次;读不到 ⇒ 如实"未判定",绝不推测成没问题。
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
 *   (路径不存在 / 非 RUNNING / 声明端口不应答 / Application 值为空 / 两通道取值不一致),--strict 下含未判定;
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
/** 通道 REG 里 `Parameters` 子键不存在 / 编码失败 的两个哨兵(带 '!' 前缀,与 base64 字符集互斥,
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
/** 每服务最多探这么几个端口(再多说明配置里有噪声,只按前几个作答,其余如实报数)。 */
const MAX_PROBE_PORTS = 6

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
  else if (ports.value.length === 0) excuseable('端口应答', '服务配置里读不到监听端口声明 ⇒ 这一维未判定,不推测为没问题')
  else {
    const probe = rec.probe ?? unmeasured('端口应答维没有值(调用方未提供)')
    if (probe.kind === 'unmeasured') hard('端口应答', probe.reason)
    else if (probe.value.listening !== true) problems.push(`声明端口无应答(tcp):${probe.value.ports.join(',')}`)
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
  tcpProbe: (port) =>
    new Promise((resolve) => {
      const sock = net.connect({ host: '127.0.0.1', port })
      let settled = false
      const fin = (v) => {
        if (settled) return
        settled = true
        sock.destroy()
        resolve(v)
      }
      sock.setTimeout(TCP_TIMEOUT_MS)
      sock.once('connect', () => fin({ status: 'open' }))
      sock.once('timeout', () => fin({ status: 'unmeasured', why: `127.0.0.1:${port} 连接超时(${TCP_TIMEOUT_MS}ms)` }))
      sock.once('error', (e) => {
        const code = e && typeof e.code === 'string' ? e.code : 'unknown'
        if (code === 'ECONNREFUSED') fin({ status: 'closed' })
        else fin({ status: 'unmeasured', why: `127.0.0.1:${port} 报错(${code})` })
      })
    }),
}

function existenceOf(value, deps) {
  if (!value) return unmeasured('没有可判的存在性')
  if (looksCorrupted(value)) return unmeasured('取值含替换符/控制字符 ⇒ 疑被码页打断,不据此判缺失')
  if (!path.win32.isAbsolute(value)) return unmeasured(`非绝对路径(${value})⇒ 落点由 PATH/工作目录决定,本门不判缺失`)
  return measured(deps.fileKind(value))
}

async function inspectService({ name, stateValue, regRow, regChannelMeasured, inStateRows, deps, nssmPath }) {
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

  let probe
  if (ports.kind === 'measured' && ports.value.length > 0) {
    const targets = ports.value.slice(0, MAX_PROBE_PORTS)
    const results = await Promise.all(targets.map(async (port) => ({ port, r: await deps.tcpProbe(port) })))
    const open = results.filter((x) => x.r.status === 'open').map((x) => x.port)
    const un = results.filter((x) => x.r.status === 'unmeasured')
    if (open.length > 0) probe = measured({ listening: true, ports: targets, openPorts: open })
    else if (un.length > 0) probe = unmeasured(`端口探测有 ${un.length}/${targets.length} 个判不出:${un.map((x) => x.r.why).join(';')}`)
    else probe = measured({ listening: false, ports: targets, openPorts: [] })
  } else if (ports.kind === 'unmeasured') {
    probe = unmeasured(ports.reason)
  } else {
    probe = unmeasured('服务配置里没有端口声明(量到了空)')
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
    probe,
    nssmManaged,
    agreement: disagreement,
  }
  const verdict = judgeService(rec)
  return { name, rec, ...verdict }
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
    channels: { state: null, registry: null },
    registry: null,
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
  const dimUnmeasured = (pick) => svcs.filter((s) => pick(s.rec).kind === 'unmeasured').length
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
              ? `${d.value.listening ? '应答' : '无应答'}(${(d.value.ports ?? []).join(',')})`
              : String(d.value)
        : `未判定:${d.reason}`
    const mark = s.level === 'issue' ? '❌' : s.level === 'ok' ? '✅' : s.level === 'skipped' ? '➖' : '⚪'
    L.push(`${mark} ${s.name}${s.rec.scope ? ` [${s.rec.scope}]` : ''}`)
    L.push(
      `    STATE=${fmt(s.rec.state)}  Application=${fmt(s.rec.application)}${s.rec.applicationSources.length ? `(源:${s.rec.applicationSources.join('+')})` : ''}  [存在性 ${fmt(s.rec.appExists)}]  AppDirectory=${fmt(s.rec.appDirectory)}  端口=${fmt(s.rec.ports)}  应答=${fmt(s.rec.probe)}  nssm托管=${fmt(s.rec.nssmManaged)}`,
    )
    for (const p of s.problems) L.push(`      问题:${p}`)
    for (const b of s.blind) L.push(`      未判定:${b}`)
    if (s.level === 'skipped') L.push('      说明:该服务不是 nssm 托管,D2/D3 对它不适用;STATE 这一维已单独量过。')
  }
  const t = meta.totals
  if (t) {
    L.push(
      `结论:入审 ${t.services} 个 —— 量到问题 ${t.issue} / 未出具合格证(有维量不到)${t.unattested} / 全维健康 ${t.ok} / 非 nssm 托管跳过 ${t.skipped};各维未判定 STATE=${t.dimUnmeasured.state} Application=${t.dimUnmeasured.application} 端口声明=${t.dimUnmeasured.ports} 应答=${t.dimUnmeasured.probe} 托管性=${t.dimUnmeasured.nssmManaged}`,
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
    console.log('⏭  HUSKY_SKIP_SERVICE_BINARY_PATHS=1 —— 跳过服务二进制路径对账(机器态档,跳过不改变仓库结论)')
    process.exit(0)
  }
  const wantsJson = process.argv.slice(2).includes('--json')
  main()
    .then(({ exitCode, text, json }) => {
      const body = wantsJson && json != null ? json : text
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
  ENUM_HEAD, ENUM_TAIL, REG_NO_PARAMS, REG_ENCODE_ERROR, PS_CANDIDATES, NSSM_CANDIDATES, NSSM_TIMEOUT_MS, TCP_TIMEOUT_MS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
