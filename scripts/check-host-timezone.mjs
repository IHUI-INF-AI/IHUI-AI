#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主机时区漂移对账(只读:不改时区、不写注册表、不停/启服务)。
 *
 * 立因(2026-09-30 复盘):本机时区在 2026-09-04T09:16:03Z 被一次**没有登记**的改动从东八区改成
 * UTC,持续 25 天,链上一百多道门禁没有一道发现。后果都是真实的:alipay.ts 的网关签名时刻按主机
 * 本地时间算(支付宝要 GMT+8 ⇒ 恒早 8 小时,对账单被拒);anomaly-detector.ts 判"凌晨 0-5 点"用主机
 * 小时 ⇒ 把北京 08:00-13:00 高峰正常活动打 70 分,真凌晨行为反而看不见;ihui-pg-backup-scheduler.ps1:44
 * 用 `Get-Date` 算"下一次 03:00" ⇒ 114MB 全库导出落在上午 11:00(实测文件名 ihui_dev_20260929_030001.dump)。
 *
 * 共同点不是"代码写错了",而是**没有任何一处问过"这台机的时区现在是什么"**,而散文里写着"生产机器
 * 本地时区为 UTC,读时间戳必须换算" ⇒ 每个接手的人把故障当常态绕过去(守门 92 替不存在的计划任务背书
 * 同型:文档不得替机器事实背书)。⇒ 规矩:凡被代码当前提的机器事实,必须有尺子现问 + 与声明表
 * config/host-timezone.json 对账(§5b"六类机器事实每次现取")。
 *
 * 四维,三态绝不并桶(量到了 / 量不到-点名原因 / 确实是 0):
 *   H1 区名  注册表 TimeZoneKeyName ∪ tzutil ∪ 新起 node 的 IANA,三通道互相同证,再比声明。
 *   H2 归属  System 日志 Kernel-General/ID1/"adjusted to the new time zone" ⇒ 时刻 + 发起进程。
 *            9-04 那次就是靠这条指认出 pwsh.exe,所以这维本身就是"改了必须能被指认"的机制。
 *            最新事件晚于声明 changedAt(超容差)⇒ 有人又改了区没改声明 ⇒ 判红。一条都取不到
 *            ⇒ 未判定,**不读成"没人动过"**(把没判写成判过了是本仓最高频失效型)。
 *   H3 落地  已在跑的服务是否真的按新区算时间 —— **不猜哪个运行时缓存,直接量**:取活日志最新一条无
 *            偏移时间戳的"当日时刻",与主机本地当日时刻求差(基准用注册表的 -ActiveTimeBias,
 *            不看进程启动时间,那只是代理)。实测两种形态都出现过:Node/ICU 进程改区后仍打旧时刻
 *            (⇒ 必须重启);PowerShell 7(.NET)在同机同日自行刷新成 +08:00(⇒ 不需要重启)。
 *            所以这一维的结论只来自戳,不来自"我以为哪个 runtime 会缓存"。
 *            文件 30 分钟内无新行 ⇒ 未判定:空闲不等于正确。
 *   H4 钟    区错不代表钟错:NTP 偏移实测(--quick 跳过)。取不到 ⇒ 未判定。
 *
 * 定级(不得自作主张改):**warn,绝不进 blocking 提交链** —— 主机时区是机器状态,提交者结构上满足
 * 不了,挂 blocking 就是每台每次被逼 --no-verify、连带该枚提交上全部守门作废(§12e/§12f;先例
 * check-service-binary-paths / visible-window-probe / check-image-placeholders)。到人出口挂
 * scripts/git-guardian.mjs 巡检轮(--quick),经 notify-deploy-failure.ts 派发 —— 那正是 9-04 缺的环。
 *
 * 取材(守门 118 口径):本门不读被审内容,只读机器运行态。活日志根经 seal-c-root-stray 的
 * devEnvRoot() 按工作树所在盘推导,禁止硬编码盘符(§15b)。
 *
 * 手动:node scripts/check-host-timezone.mjs [--json|--quick|--strict|--self-test]
 * 退出码:0 无漂移(可含未判定)/ 1 判红 / 2 脚本异常或声明表坏(--strict 下有未判定也是 2)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = resolve(HERE, '..')
export const CONFIG_PATH = join(REPO, 'config', 'host-timezone.json')
export const PS_CANDIDATES = ['C:/Program Files/PowerShell/7/pwsh.exe', 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe']
export const H2_TOLERANCE_SEC = 180
export const H3_STALE_MS = 30 * 60 * 1000
export const H3_ZONE_GAP_HOURS = 2
export const LIVE_LOGS = ['svc-api-nssm.log', 'svc-ai-nssm.log', 'monitor.log', 'pg-backup-scheduler.log']

export function decodeStdout(buf) {
  if (!buf || buf.length === 0) return { encoding: 'empty', text: '' }
  let nuls = 0
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0) nuls++
  if (buf[0] === 0xff && buf[1] === 0xfe) return { encoding: 'utf16le', text: buf.toString('utf16le').replace(/^/, '') }
  if (nuls / buf.length >= 0.25 && buf.length % 2 === 0) return { encoding: 'utf16le', text: buf.toString('utf16le') }
  return { encoding: 'utf8', text: buf.toString('utf8') }
}

/** 无偏移日志戳的默认归属区只能来自声明表;形态不认识 ⇒ null,绝不默认成 UTC(那正是错位成因)。 */
export function naiveStampOffset(cfg) {
  const v = cfg && cfg.logStampConsumers && cfg.logStampConsumers.naiveStampDefault
  return typeof v === 'string' && /^[+-]\d{2}:\d{2}$/.test(v) ? v : null
}

/**
 * 戳的"当日时刻"与**给定偏移**下的本地"当日时刻"之差(小时,折算到 ±12 最短弧)。判不出 ⇒ null。
 *
 * ⚠️ 偏移是**入参**,不得在这里读 `getHours()`:那会让判据跟着跑它的进程所在区变,而本仓今晚刚
 * 因为这个形态修掉两条"永远绿"的断言(anomaly-detector / automation scheduler 的测试同型)。调用方
 * 必须把**注册表 ActiveTimeBias 取负**那份当前值喂进来 —— H3 要问的正是"写日志的人用的区,和主机
 * 现在声明的区是否一致",拿跑判据的进程自己的区当基准就是循环论证。
 */
export function stampHourGapHours(stampText, nowMs = Date.now(), hostOffsetMinutes = 0) {
  const m = /(?:\d{4}-\d{2}-\d{2})?[T ]?(\d{2}):(\d{2}):(\d{2})/.exec(stampText)
  if (!m) return null
  if (!Number.isFinite(hostOffsetMinutes)) return null
  const stampSec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
  const d = new Date(nowMs)
  const utcSec = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()
  let expectSec = utcSec + hostOffsetMinutes * 60
  expectSec = ((expectSec % 86400) + 86400) % 86400
  let delta = (stampSec - expectSec) / 3600
  if (delta > 12) delta -= 24
  if (delta < -12) delta += 24
  return delta
}

export function newestStampFromLog(path, nowMs = Date.now()) {
  if (!existsSync(path)) return { kind: 'undetermined', reason: '文件不存在' }
  let st
  try {
    st = statSync(path)
  } catch (e) {
    return { kind: 'undetermined', reason: '量不到 mtime:' + e.message }
  }
  const age = nowMs - st.mtimeMs
  if (age > H3_STALE_MS) return { kind: 'undetermined', reason: '日志空闲 ' + Math.round(age / 60000) + ' 分钟(>30),不能据此说缓存正确' }
  try {
    const buf = readFileSync(path)
    const tail = buf.subarray(Math.max(0, buf.length - 65536)).toString('utf8')
    for (const line of tail.split(/\r?\n/).reverse()) {
      const m = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.exec(line)
      if (m) return { kind: 'measured', stamp: m[0] }
      const t = /\[(\d{2}:\d{2}:\d{2})/.exec(line)
      if (t) return { kind: 'measured', stamp: '2000-01-01 ' + t[1] }
    }
    return { kind: 'undetermined', reason: '尾部 64KB 无可解析时间戳形态' }
  } catch (e) {
    return { kind: 'undetermined', reason: '读失败:' + e.message }
  }
}

// 中文消息会被 GBK 码页打断(§26),所以格式化留在 PS 侧、载荷只留 ASCII,且时区变更的**前后时刻**
// 取事件的结构化 Properties(FILETIME→UTC),不解析消息文本。
export const PS_QUERY = `$ErrorActionPreference='SilentlyContinue'
$ti = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\TimeZoneInformation'
$evs = @(Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-Kernel-General';Id=1} -MaxEvents 80 |
  Where-Object { $_.Message -match 'adjusted to the new time zone' } | Select-Object -First 6 |
  ForEach-Object {
    $m = ($_.Message -replace '\\s+',' ')
    $proc = ''
    if ($m -match 'HarddiskVolume\\d+\\\\(.+?\\.exe)') { $proc = ($Matches[1] -replace '[^\\x20-\\x7E\\\\:.]','') }
    $newT=''; $oldT=''
    $ft = @($_.Properties | Where-Object { $_.Value -is [long] } | ForEach-Object { $_.Value })
    if ($ft.Count -ge 1) { try { $newT = ([DateTime]::FromFileTime([long]$ft[0])).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') } catch {} }
    if ($ft.Count -ge 2) { try { $oldT = ([DateTime]::FromFileTime([long]$ft[1])).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') } catch {} }
    [pscustomobject]@{ utc=$_.TimeCreated.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); proc=$proc; newT=$newT; oldT=$oldT }
  })
[pscustomobject]@{
  zoneKey=[string]$ti.TimeZoneKeyName
  activeBiasMin=$(if ($null -eq $ti.ActiveTimeBias) { -99999 } else { [int]$ti.ActiveTimeBias })
  rtu=$(if ($null -eq $ti.RealTimeIsUniversal) { 'absent' } else { [string]$ti.RealTimeIsUniversal })
  tzutil=((((tzutil /g) -join '') -replace '[^\\x20-\\x7E]','').Trim())
  zoneEvs=@($evs); psVer=$PSVersionTable.PSVersion.ToString()
} | ConvertTo-Json -Compress -Depth 6`

export function resolvePs(fs) {
  const ex = fs || existsSync
  for (const p of PS_CANDIDATES) if (ex(p)) return p
  return null
}

export function askPowerShell({ run = execFileSync, ps = resolvePs() } = {}) {
  if (!ps) return { ok: false, reason: '两把 PowerShell 候选都不在位' }
  try {
    const buf = run(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_QUERY], {
      windowsHide: true, timeout: 45000, maxBuffer: 8 * 1024 * 1024, encoding: 'buffer',
    })
    const dec = decodeStdout(buf)
    const text = dec.text.trim()
    if (!text) return { ok: false, reason: 'PS 空输出(encoding=' + dec.encoding + ')' }
    try {
      return { ok: true, data: JSON.parse(text) }
    } catch {
      return { ok: false, reason: 'PS 输出非可解析 JSON:' + text.slice(0, 100) }
    }
  } catch (e) {
    const why = (e && e.code === 'ETIMEDOUT') ? '派生超时' : (e && e.status !== undefined ? '退出码 ' + e.status : '派生失败')
    return { ok: false, reason: why + ':' + String(e && e.message).slice(0, 140) }
  }
}

export function judgeH1(cfg, psData, nodeIana, nodeOffsetMin) {
  const exp = (cfg && cfg.expected) || {}
  const ch = []
  if (psData && psData.zoneKey) ch.push({ from: 'registry', value: String(psData.zoneKey) })
  if (psData && psData.tzutil) ch.push({ from: 'tzutil', value: String(psData.tzutil) })
  if (nodeIana) ch.push({ from: 'node-iana', value: String(nodeIana) })
  if (ch.length === 0) return { state: 'undetermined', reason: '三条通道全取不到', channels: ch }
  const bad = []
  for (const c of ch) {
    const want = c.from === 'node-iana' ? exp.iana : exp.windowsZoneKey
    if (want && c.value !== want) bad.push(c.from + '=' + c.value + ' ≠ 声明 ' + want)
  }
  if (typeof exp.utcOffsetMinutes === 'number' && typeof nodeOffsetMin === 'number' && nodeOffsetMin !== exp.utcOffsetMinutes) {
    bad.push('主机偏移 ' + nodeOffsetMin + ' 分 ≠ 声明 ' + exp.utcOffsetMinutes + ' 分')
  }
  return { state: bad.length ? 'mismatch' : 'ok', detail: bad, channels: ch, channelCount: ch.length }
}

export function judgeH2(cfg, events) {
  const declared = cfg && cfg.changedAt && cfg.changedAt.utc
  if (!Array.isArray(events)) return { state: 'undetermined', reason: 'PS 未给出事件数组', events: [] }
  if (events.length === 0) return { state: 'undetermined', reason: '射程内一条时区变更事件都没有(日志被清/权限不足)⇒ 不能读成"没人动过时区"', events: [] }
  if (!declared) return { state: 'undetermined', reason: '声明表无 changedAt.utc,无从比对', events }
  const newest = events.map((e) => Date.parse(e.utc)).filter(Number.isFinite).sort((a, b) => b - a)[0]
  const declaredMs = Date.parse(declared)
  if (!Number.isFinite(newest) || !Number.isFinite(declaredMs)) return { state: 'undetermined', reason: '事件或声明时刻解析不出', events }
  if (newest > declaredMs + H2_TOLERANCE_SEC * 1000) {
    const who = events.find((e) => Date.parse(e.utc) === newest)
    return { state: 'drift', reason: '最近一次时区变更 ' + new Date(newest).toISOString() + ' 晚于声明的 ' + declared + ' ⇒ 有人改了主机时区没改声明表', culprit: who && who.proc ? who.proc : '(进程名未取到)', events }
  }
  return { state: 'ok', events, newestEventUtc: new Date(newest).toISOString() }
}

export function judgeH3(logDir, nowMs = Date.now(), hostOffsetMinutes = null) {
  if (!logDir) return { state: 'undetermined', reason: 'DevEnv 根推导失败 ⇒ 不回落硬编码盘符', rows: [] }
  if (!Number.isFinite(hostOffsetMinutes)) {
    return { state: 'undetermined', reason: '主机当前偏移取不到(注册表 ActiveTimeBias 空)⇒ 无基准可比,不猜', rows: [] }
  }
  const rows = []
  let judged = 0
  for (const name of LIVE_LOGS) {
    const found = newestStampFromLog(join(logDir, name), nowMs)
    if (found.kind !== 'measured') {
      rows.push({ file: name, state: 'undetermined', reason: found.reason })
      continue
    }
    const gap = stampHourGapHours(found.stamp, nowMs, hostOffsetMinutes)
    if (gap === null) {
      rows.push({ file: name, state: 'undetermined', reason: '戳形态解析不出' })
      continue
    }
    judged++
    const bad = Math.abs(gap) > H3_ZONE_GAP_HOURS
    rows.push({ file: name, state: bad ? 'stale-cache' : 'ok', gapHours: Number(gap.toFixed(2)), stamp: found.stamp, note: bad ? '写这行的进程仍按别的区算时间 ⇒ 改完时区必须重启它' : '' })
  }
  if (judged === 0) return { state: 'undetermined', reason: '四份活日志一条都没判出来(空闲或形态不认识)', rows }
  return { state: rows.some((r) => r.state === 'stale-cache') ? 'stale-cache' : 'ok', rows, judged, idleOrBlind: rows.length - judged }
}

export function readConfig(path = CONFIG_PATH) {
  try {
    return { ok: true, data: JSON.parse(readFileSync(path, 'utf8')) }
  } catch (e) {
    return { ok: false, reason: '声明表取不到或坏了:' + e.message }
  }
}

export function measureNtp({ run = execFileSync } = {}) {
  const res = { state: 'undetermined', reason: '--quick 档不派生 NTP', offsetSec: null }
  try {
    const out = String(run('w32tm', ['/stripchart', '/computer:ntp.aliyun.com', '/samples:2', '/dataonly'], { windowsHide: true, timeout: 25000, encoding: 'utf8' }))
    const vals = [...out.matchAll(/([+-])(\d{2}):(\d{2})\.(\d{3,})|([+-]\d{2}\.\d{6,})/g)].map((m) =>
      m[5] !== undefined ? Number(m[5]) : (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4])))
    if (!vals.length) {
      res.reason = 'stripchart 输出里没有可解析偏移样本(可能被代理/防火墙挡 UDP 123)'
      return res
    }
    vals.sort((a, b) => a - b)
    res.offsetSec = vals[Math.floor(vals.length / 2)]
    res.state = Math.abs(res.offsetSec) < 5 ? 'ok' : 'bad'
    if (res.state === 'bad') res.reason = '与 NTP 差 ' + res.offsetSec + 's'
  } catch (e) {
    res.reason = 'NTP 探测失败:' + String(e && e.message).slice(0, 120)
  }
  return res
}

export function runOnce({ quick = false, run = execFileSync, now = () => Date.now(), logDir = null, nodeProbe } = {}) {
  const cfg = readConfig()
  if (!cfg.ok) return { verdict: 'error', reasons: [cfg.reason] }
  const psRes = askPowerShell({ run })
  const probe = nodeProbe || (() => {
    try {
      const o = String(run(process.execPath, ['-p', 'JSON.stringify([Intl.DateTimeFormat().resolvedOptions().timeZone,-new Date().getTimezoneOffset()])'], { windowsHide: true, timeout: 15000, encoding: 'utf8' }))
      const [iana, off] = JSON.parse(o.trim())
      return { iana, off }
    } catch (e) {
      return { iana: null, off: null, reason: String(e && e.message).slice(0, 120) }
    }
  })()
  const h1 = judgeH1(cfg.data, psRes.ok ? psRes.data : null, probe.iana, probe.off)
  const h2 = judgeH2(cfg.data, psRes.ok ? psRes.data.zoneEvs : null)
  // H3 的基准取**注册表 ActiveTimeBias 取负**(Windows 的 Bias = 本地落后 UTC 的分钟数,东八区是 -480),
  // 而不是跑判据这个进程自己的缓存区 —— 那正是本门要发现不一致的东西,拿它当基准就是循环论证。
  const regBias = psRes.ok ? psRes.data.activeBiasMin : null
  const hostOffsetMin = Number.isFinite(regBias) && regBias !== -99999 ? -Number(regBias) : (Number.isFinite(probe.off) ? probe.off : null)
  const h3 = judgeH3(logDir, now(), hostOffsetMin)
  const h4 = quick ? { state: 'undetermined', reason: '--quick 档不派生 NTP', offsetSec: null } : measureNtp({ run })
  const reds = []
  if (h1.state === 'mismatch') reds.push('H1 主机时区与声明不符:' + h1.detail.join(' / '))
  if (h2.state === 'drift') reds.push('H2 ' + h2.reason + '(发起:' + h2.culprit + ')')
  if (h3.state === 'stale-cache') reds.push('H3 有常驻进程仍按旧区算时间 ⇒ 需要重启(逐条见 rows)')
  if (h4.state === 'bad') reds.push('H4 主机钟与 NTP 差 ' + h4.offsetSec + 's')
  const und = [h1, h2, h3, h4].filter((h) => h.state === 'undetermined').length
  return {
    verdict: reds.length ? 'red' : 'green',
    reasons: reds,
    declared: cfg.data.expected,
    changedAt: cfg.data.changedAt && cfg.data.changedAt.utc,
    measured: { registry: psRes.ok ? psRes.data.zoneKey : null, tzutil: psRes.ok ? psRes.data.tzutil : null, nodeIana: probe.iana, nodeOffsetMin: probe.off, realTimeIsUniversal: psRes.ok ? psRes.data.rtu : null, ps: psRes.ok ? psRes.data.psVer : '未取到(' + psRes.reason + ')' },
    h1, h2, h3, h4, undeterminedCount: und, naiveStampDefaultOffset: naiveStampOffset(cfg.data),
  }
}

export function logDirFromRepo(repoRoot = REPO) {
  try {
    const root = dirname(resolve(repoRoot))
    const drive = root.slice(0, 3)
    if (!/^[A-Za-z]:\\$/.test(drive)) return { dir: null, reason: '工作树根形态不认识:' + root }
    return { dir: join(root, 'DevEnv', 'logs'), reason: '' }
  } catch (e) {
    return { dir: null, reason: '推导失败:' + e.message }
  }
}

export function selfTest() {
  const out = []
  const t = (name, cond) => out.push({ name, pass: !!cond })
  const cfg = { expected: { windowsZoneKey: 'China Standard Time', iana: 'Asia/Shanghai', utcOffsetMinutes: 480 }, changedAt: { utc: '2026-09-29T17:17:29Z' }, logStampConsumers: { naiveStampDefault: '+08:00' } }
  t('01 H1 三通道同声明 ⇒ ok', judgeH1(cfg, { zoneKey: 'China Standard Time', tzutil: 'China Standard Time' }, 'Asia/Shanghai', 480).state === 'ok')
  t('02 H1 主机是 UTC ⇒ mismatch(9-04..9-29 的真实形态)', judgeH1(cfg, { zoneKey: 'UTC', tzutil: 'UTC' }, 'UTC', 0).state === 'mismatch')
  t('03 H1 全取不到 ⇒ undetermined(不冒绿)', judgeH1(cfg, null, null, null).state === 'undetermined')
  t('04 H1 两通道互斥仍判红(尺子不许选边)', judgeH1(cfg, { zoneKey: 'China Standard Time', tzutil: 'UTC' }, 'Asia/Shanghai', 480).state === 'mismatch')
  t('05 H2 事件晚于声明 ⇒ drift 并点名进程', judgeH2(cfg, [{ utc: '2026-10-01T00:00:00Z', proc: 'pwsh.exe' }]).state === 'drift')
  t('06 H2 事件与声明同刻 ⇒ ok', judgeH2(cfg, [{ utc: '2026-09-29T17:17:30Z', proc: 'tzutil.exe' }]).state === 'ok')
  t('07 H2 空事件 ⇒ undetermined(绝不读成没人动过)', judgeH2(cfg, []).state === 'undetermined')
  t('08 H2 非数组 ⇒ undetermined', judgeH2(cfg, null).state === 'undetermined')
  t('09 H2 容差内不算漂移', judgeH2(cfg, [{ utc: '2026-09-29T17:19:00Z', proc: 'x.exe' }]).state === 'ok')
  const nowZ = Date.parse('2026-09-29T17:00:00Z')
  // 断言一律**显式给偏移**,不读进程自己的区:否则这几条在 CI(UTC)与本机(+08)上会给出不同颜色,
  // 而"跟着宿主变的断言"正是今晚修掉的那一型(anomaly-detector / automation scheduler 测试同型)。
  t('10 戳=声明偏移下的本地时刻 ⇒ 差 0', Math.abs(stampHourGapHours('2026-09-30 01:00:00', nowZ, 480)) < 0.05)
  t('11 戳仍是改区前的缓存 ⇒ |差| ≈ 8 判得出', Math.abs(Math.abs(stampHourGapHours('2026-09-29 17:00:00', nowZ, 480)) - 8) < 0.05)
  t('12 偏移给 0(主机真是 UTC)⇒ 同一戳差 0,不谎报', Math.abs(stampHourGapHours('2026-09-29 17:00:00', nowZ, 0)) < 0.05)
  t('13 跨午夜折算最短弧(不把 16h 当 16h)', Math.abs(stampHourGapHours('2026-09-30 01:00:00', Date.parse('2026-09-30T17:30:00Z'), 480)) < 0.6)
  t('14 认 pino-pretty 的 HH:mm:ss 形态', stampHourGapHours('2000-01-01 17:24:23', nowZ, 480) !== null)
  t('15 形态不认识 ⇒ null,不猜', stampHourGapHours('not a stamp', nowZ, 480) === null)
  t('16 偏移不是数 ⇒ null(无基准就不下结论)', stampHourGapHours('2026-09-30 01:00:00', nowZ, null) === null)
  t('17 空闲/非日志文件 ⇒ undetermined 而非 ok', newestStampFromLog(join(REPO, 'package.json')).kind === 'undetermined')
  t('18 声明表缺文件 ⇒ error(不冒充 0)', readConfig(join(REPO, 'config', 'definitely-no-such.json')).ok === false)
  t('19 naiveStampDefault 坏形态 ⇒ null(不得默认 UTC)', naiveStampOffset({ logStampConsumers: { naiveStampDefault: 'UTC' } }) === null)
  t('20 naiveStampDefault 好形态 ⇒ 取到', naiveStampOffset(cfg) === '+08:00')
  t('21 decodeStdout 空 buffer ⇒ empty', decodeStdout(Buffer.alloc(0)).encoding === 'empty')
  t('22 decodeStdout UTF-16LE 无 BOM 按 NUL 密度识别', decodeStdout(Buffer.from([0x61, 0x00, 0x62, 0x00, 0x63, 0x00, 0x00, 0x00])).encoding === 'utf16le')
  t('23 奇数长度绝不猜成 UTF-16LE(错解码会产出乱码结论)', decodeStdout(Buffer.from([0x61, 0x00, 0x62, 0x00, 0x63])).encoding === 'utf8')
  t('24 decodeStdout 普通 utf8 不误判 utf16', decodeStdout(Buffer.from('hello world!')).encoding === 'utf8')
  t('25 judgeH3 无 logDir ⇒ undetermined(不回落盘符)', judgeH3(REPO, Date.now(), 480).state !== 'ok')
  t('26 judgeH3 没有偏移基准 ⇒ undetermined', judgeH3(REPO, Date.now(), null).state === 'undetermined')
  t('27 judgeH3 全空闲 ⇒ undetermined(空闲不等于正确)', judgeH3(REPO, Date.now() + 10 * 3600 * 1000, 480).state === 'undetermined')
  t('28 真声明表在位且形态合法 ⇒ naive 默认取到 +08:00', naiveStampOffset(readConfig().data) === '+08:00')
  t('29 PS 载荷含结构化 Properties 取材(newT),不解析中文', PS_QUERY.includes('FromFileTime') && !/[^\x00-\x7F]/.test(PS_QUERY))
  t('30 所有派生都带 windowsHide(§5b 弹窗事故)', /windowsHide: true/.test(askPowerShell.toString()) && /windowsHide: true/.test(measureNtp.toString()) && /windowsHide: true/.test(runOnce.toString()))
  t('31 所有派生都带 timeout(守门 80)', /timeout: 45000/.test(askPowerShell.toString()) && /timeout: 25000/.test(measureNtp.toString()) && /timeout: 15000/.test(runOnce.toString()))
  const pass = out.filter((o) => o.pass).length
  console.log(out.map((o) => (o.pass ? 'ok   ' : 'FAIL ') + o.name).join('\n'))
  console.log('SELFTEST ' + pass + '/' + out.length)
  return pass === out.length ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const json = argv.includes('--json')
  const strict = argv.includes('--strict')
  const quick = argv.includes('--quick')
  const ld = logDirFromRepo()
  const res = runOnce({ quick, logDir: ld.dir, now: () => Date.now() })
  if (res.verdict === 'error') {
    console.error('判死:' + res.reasons.join('; '))
    return 2
  }
  if (json) {
    console.log(JSON.stringify(res, null, 2))
  } else {
    console.log('声明  : ' + res.declared.windowsZoneKey + ' / ' + res.declared.iana + ' / UTC+' + res.declared.utcOffsetMinutes / 60 + ' / changedAt ' + res.changedAt)
    console.log('实测  : registry=' + res.measured.registry + ' tzutil=' + res.measured.tzutil + ' node=' + res.measured.nodeIana + ' off=' + res.measured.nodeOffsetMin + 'min RTC-UTC=' + res.measured.realTimeIsUniversal)
    console.log('PS    : ' + res.measured.ps)
    console.log('H1 区名: ' + res.h1.state + (res.h1.detail && res.h1.detail.length ? ' | ' + res.h1.detail.join(' / ') : ''))
    console.log('H2 归属: ' + res.h2.state + (res.h2.reason ? ' | ' + res.h2.reason : '') + (res.h2.events ? ' | 事件 ' + res.h2.events.length + ' 条' : ''))
    for (const e of (res.h2.events || []).slice(0, 5)) console.log('      · ' + e.utc + ' 进程=' + (e.proc || '(未取到)'))
    console.log('H3 落地: ' + res.h3.state + (res.h3.reason ? ' | ' + res.h3.reason : ''))
    for (const r of res.h3.rows || []) console.log('      · ' + r.file + ' ' + r.state + (r.gapHours !== undefined ? ' 差 ' + r.gapHours + 'h' : '') + (r.reason ? ' (' + r.reason + ')' : '') + (r.note ? ' ' + r.note : ''))
    console.log('H4 钟  : ' + res.h4.state + (res.h4.reason ? ' | ' + res.h4.reason : '') + (res.h4.offsetSec !== null ? ' 偏移 ' + res.h4.offsetSec + 's' : ''))
    console.log('无偏移日志戳默认按 ' + res.naiveStampDefaultOffset + ' 解(来自声明表,非硬编码)')
    console.log(res.verdict === 'red' ? '❌ 判红:' + res.reasons.join('; ') : '✅ 无漂移(未判定 ' + res.undeterminedCount + ' 维' + (res.undeterminedCount ? ' —— 未判定不等于已确认,别当合格证用' : '') + ')')
  }
  if (res.verdict === 'red') return 1
  if (strict && res.undeterminedCount > 0) return 2
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error('脚本自身异常:' + (e && e.stack))
    process.exit(2)
  }
}

export const __test__ = { decodeStdout, naiveStampOffset, stampHourGapHours, newestStampFromLog, judgeH1, judgeH2, judgeH3, readConfig, runOnce, selfTest, logDirFromRepo, measureNtp, askPowerShell, PS_QUERY, PS_CANDIDATES, H2_TOLERANCE_SEC, H3_STALE_MS, H3_ZONE_GAP_HOURS, LIVE_LOGS, CONFIG_PATH, REPO }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
