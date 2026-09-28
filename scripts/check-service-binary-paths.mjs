#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:nssm 托管服务的二进制路径存续性对账(G-302,2026-09-27 立)
 *
 * 立因:RSSHub 停 3 天而**全链零告警**。外部自升级把 `~\.workbuddy\binaries\node\
 * versions\22.22.2-2` 整目录换掉,nssm 服务注册表里指向的二进制随之不存在 —— 故障形态是
 * "账面全绿、服务已经死了",现读只能靠人查 `sc query` + 路径存在性。本门把这一型变成机器
 * 可查事实:凡服务写着的应用绝对路径,取不到即点名服务名与路径。
 *
 * 判据边界(机器状态 vs 被审内容 —— 也是它不在守门 118 射程内的理由):
 *   被审对象是 HKLM 服务注册表,即**这台机装了什么**,不是仓库里被提交的内容。全量档 /
 *   `--staged` 档对它都没有意义,所以本门不引 `lib/face-reader.mjs`、不读任何仓库正文
 *   (唯一的 fs 访问是量服务二进制自身是否存在)。118 判的是"读被审内容时走没走同一张面",
 *   这里既无被审内容也无面可走 ⇒ 与它不同域;89 的装车判据同理不适用(它刻意不进提交链)。
 *
 * 定级理由(为什么必须是 warn / 纯告警,不得升 blocking):
 *   "服务的二进制在不在"由本机安装态决定,提交者结构上满足不了 —— 挂 blocking 的结局本仓
 *   记过多次:每台每次被逼 `--no-verify`,连带把其余全部守门一起作废(AGENTS §12e 同型,
 *   先例见 check-c-drive-pollution 头注)。所以默认档**确认缺失也 exit 0**,只是大声喊 +
 *   逐条报名;`--strict` 才是问责档(CI / 巡检),它把"未判定"同样计为不通过 —— 与
 *   check-digest-name-reality 的"拒绝出具合格证"同一取向。
 *
 * 三态绝不并桶:ok / missing / undetermined。非 win32、注册表基键读不到、一个 nssm 服务都
 *   枚举不到、派生失败或超时、输出行解不出、取值疑似被码页打断 ⇒ 一律 undetermined 并逐条
 *   点名原因,末尾打印"未判定 N 项"。**禁止**把这些汇总成"全部通过"。
 *
 * 为什么不走 `nssm get`:nssm 的 CLI 输出是 **UTF-16**,按 UTF-8 读会得到乱码结论(票面实测,
 *   而乱码路径必然"不存在" ⇒ 造出一批假红)。这里改从注册表读 nssm 的真实键名 —— 本机实测为
 *   `Services\<svc>\Parameters` 下的 `Application` / `AppDirectory`。控制台侧再显式把
 *   [Console]::OutputEncoding 设为 UTF-8(GBK 码页吃中文是 AGENTS §26 记过的同型)。本机
 *   powershell.exe 实为 5.1.26100、pwsh.exe 为 7.6.4 —— **两个不同引擎**,同一份脚本两边都验过。
 *
 * 用法:node scripts/check-service-binary-paths.mjs [--json|--strict|--self-test]
 * 接线(守门批 / pnpm 脚本 / 台账点名)由主会话统一做;本门刻意不挂 stagedTriggers。
 * 镜像测试:node --test scripts/tests/check-service-binary-paths.test.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const OK = 'ok'
const MISSING = 'missing'
const UND = 'undetermined'

/** 解释器候选:装了 PS7 优先它(AGENTS §27),in-box 的 powershell 兜底。 */
export const PS_CANDIDATES = [
  { bin: 'C:/Program Files/PowerShell/7/pwsh.exe', label: 'pwsh(7)' },
  { bin: 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', label: 'powershell(in-box)' },
]

export const ENUM_TIMEOUT_MS = Number(process.env.IHUI_SERVICE_ENUM_TIMEOUT_MS) || 120_000

/**
 * 枚举脚本:只走注册表提供器,不碰 nssm CLI。
 * 路径一律正斜杠 —— 反斜杠经 `-Command` 传给解释器会被吃掉(本机实测把
 * `HKLM:\SYSTEM\...` 变成 `HKLM:SYSTEMCurrentControlSetServices` ⇒ 整面恒空 ⇒ 假未判定)。
 */
export function buildEnumScript() {
  return [
    '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8',
    "$ErrorActionPreference='SilentlyContinue'",
    "$base='HKLM:/SYSTEM/CurrentControlSet/Services'",
    '$total=0',
    'if(-not (Test-Path $base)){ Write-Output "REGMISSING|"+$base; exit 0 }',
    'foreach($k in (Get-ChildItem $base)){',
    '  $total=$total+1',
    "  $img=[string](Get-ItemProperty -Path $k.PSPath -Name ImagePath).ImagePath",
    "  $pp=Join-Path $k.PSPath 'Parameters'",
    "  $app=''; $dir=''",
    '  if(Test-Path $pp){',
    '    $app=[string](Get-ItemProperty -Path $pp -Name Application).Application',
    '    $dir=[string](Get-ItemProperty -Path $pp -Name AppDirectory).AppDirectory',
    '  }',
    "  if((-not [string]::IsNullOrEmpty($app)) -or ($img -match '(?i)nssm')){",
    '    Write-Output ("SVC|"+$k.PSChildName+"|app="+$app+"|dir="+$dir+"|img="+$img)',
    '  }',
    '}',
    'Write-Output ("SUM|"+$total)',
  ].join('\n')
}

const SVC_RE = /^SVC\|([^|]+)\|app=([^|]*)\|dir=([^|]*)\|img=(.*)$/

/**
 * 解释器输出 → { services, totalServices, regMissing, unparsed[] }。
 * 解不出的行必须留下并汇进未判定 —— 静默丢行等于把"没看清"写成"没有"。
 */
export function parseEnumOutput(text) {
  const services = []
  const unparsed = []
  let totalServices = null
  let regMissing = false
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('REGMISSING|')) {
      regMissing = true
      continue
    }
    if (line.startsWith('SUM|')) {
      const n = Number(line.slice(4))
      if (Number.isFinite(n)) totalServices = n
      else unparsed.push(line)
      continue
    }
    const m = SVC_RE.exec(line)
    if (!m) {
      unparsed.push(line)
      continue
    }
    services.push({ service: m[1], application: m[2], appDirectory: m[3], imagePath: m[4] })
  }
  return { services, totalServices, regMissing, unparsed }
}

/** 取值疑似被码页打断(U+FFFD 替换符 / 控制字符)⇒ 不得据它判"路径不存在"。 */
export function looksCorrupted(v) {
  return /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(String(v))
}

/** 存在性判定口:自检注入构造集合,生产档用真实 fs。 */
export function realExists(p) {
  try {
    return existsSync(p)
  } catch {
    return null
  }
}

/**
 * 逐服务分三态。返回 rows:[{service,application,appDirectory,kind,reason}]
 * 判不出的一律 undetermined 并写明原因,绝不冒判 missing(那会把尺子失效
 * 伪装成"仓库里有一批坏服务"),也绝不冒判 ok。
 */
export function classifyServices(services, exists = realExists) {
  return services.map((s) => {
    const base = { service: s.service, application: s.application, appDirectory: s.appDirectory }
    const app = String(s.application ?? '')
    if (!app.trim()) {
      return { ...base, kind: UND, reason: 'Parameters 无 Application 值 ⇒ 二进制落点无从判定(仅 ImagePath 命中 nssm)' }
    }
    if (looksCorrupted(app)) {
      return { ...base, kind: UND, reason: 'Application 取值含替换符/控制字符 ⇒ 疑被码页打断,不据此判缺失' }
    }
    if (!path.win32.isAbsolute(app)) {
      return { ...base, kind: UND, reason: 'Application 非绝对路径,落点由 PATH/工作目录决定,本门不判' }
    }
    const present = exists(app)
    if (present === null) {
      return { ...base, kind: UND, reason: '存在性检查抛错 ⇒ 未判定(不得记为缺失或通过)' }
    }
    return present
      ? { ...base, kind: OK, reason: '' }
      : { ...base, kind: MISSING, reason: 'Application 指向的文件不存在' }
  })
}

/**
 * 读侧:派生解释器取注册表。注入 `derive` 以便自检零改注册表。
 * 返回 { rows, totalServices, engine, undetermined[] } —— undetermined 是**读侧**原因,
 * 与行级原因合流后才进 counts。任何失败都落成原因,不落成一个空数组当"没有坏服务"。
 */
export function readNssmServices(opts = {}) {
  const { platform = process.platform, derive, exists = realExists, now = () => new Date().toISOString() } = opts
  if (platform !== 'win32') {
    return { rows: [], totalServices: null, engine: null, undetermined: [`非 win32(${platform}) ⇒ 服务注册表概念不适用,未判定`], at: now() }
  }
  const undetermined = []
  let picked = null
  for (const c of PS_CANDIDATES) {
    if (exists(c.bin) === true) {
      picked = c
      break
    }
  }
  if (!picked) {
    return { rows: [], totalServices: null, engine: null, undetermined: ['两把解释器候选都取不到 ⇒ 无法枚举服务,未判定'], at: now() }
  }

  const run =
    derive ||
    ((bin, script) =>
      execFileSync(bin, ['-NoProfile', '-NonInteractive', '-Command', script], {
        encoding: 'utf8',
        timeout: ENUM_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024,
      }))

  let out
  try {
    out = run(picked.bin, buildEnumScript())
  } catch (e) {
    const why =
      e && (e.code === 'ETIMEDOUT' || /timed out/i.test(String(e.message)))
        ? `派生超时(${ENUM_TIMEOUT_MS}ms)`
        : e && e.code === 'ENOENT'
          ? '解释器派生失败(ENOENT)'
          : `派生失败(退出码 ${e && e.status})`
    return { rows: [], totalServices: null, engine: picked.label, undetermined: [`${why}:${String(e && e.message).slice(0, 160)}`], at: now() }
  }

  const parsed = parseEnumOutput(out)
  if (parsed.totalServices === null) {
    undetermined.push('输出里没有 SUM 行 ⇒ 枚举被截断或解释器换了版式,未判定')
  }
  if (parsed.regMissing) {
    undetermined.push('注册表基键 HKLM:/SYSTEM/CurrentControlSet/Services 读不到 ⇒ 未判定')
  }
  for (const line of parsed.unparsed) {
    undetermined.push(`输出行形态解不出,已保留不丢弃:${line.slice(0, 200)}`)
  }
  const rows = classifyServices(parsed.services, exists)
  if (parsed.services.length === 0 && parsed.totalServices === null) {
    undetermined.push('一个服务键都没枚举到 ⇒ 判据对该面失明,未判定(不记通过)')
  } else if (parsed.services.length === 0) {
    undetermined.push(`枚举到 ${parsed.totalServices} 个服务键但 0 个 nssm 托管形态 ⇒ 本门无判定对象,未判定(不记通过)`)
  }
  return { rows, totalServices: parsed.totalServices, engine: picked.label, undetermined, at: now() }
}

/** 聚合三态读数与退出码。纯函数:退出码语义可用构造输入证明,不依赖本机装了什么。 */
export function summarize({ rows, undetermined = [], strict = false }) {
  const counts = {
    [OK]: rows.filter((r) => r.kind === OK).length,
    [MISSING]: rows.filter((r) => r.kind === MISSING).length,
    [UND]: rows.filter((r) => r.kind === UND).length + undetermined.length,
  }
  let verdict
  if (counts[MISSING] > 0) verdict = MISSING
  else if (counts[UND] > 0) verdict = UND
  else verdict = OK
  // 默认档恒 0(机器态,warn 语义);--strict 下 missing 与未判定都不出合格证。
  const exitCode = strict && verdict !== OK ? 1 : 0
  return { verdict, counts, exitCode, findings: rows.filter((r) => r.kind !== OK) }
}

export function renderHuman(result) {
  const L = []
  L.push('守门 check-service-binary-paths:nssm 托管服务的二进制路径存续性(机器状态档,默认只喊不拦)')
  L.push(`  取材:注册表 HKLM:/SYSTEM/CurrentControlSet/Services(解释器 ${result.engine ?? '未取到'}) · 服务键总数 ${result.totalServices ?? '未判定'}`)
  if (result.rows.length === 0) L.push('  (本轮没有可报名的 nssm 服务条目)')
  for (const r of result.rows) {
    L.push(`  [${r.kind}] ${r.service} → ${r.application || '(无 Application)'}${r.reason ? ` —— ${r.reason}` : ''}`)
  }
  for (const u of result.undetermined) L.push(`  [${UND}] (整面) —— ${u}`)
  const c = result.counts
  L.push(`  合计:可判存在 ${c[OK]} / 确认缺失 ${c[MISSING]} / 未判定 ${c[UND]}`)
  if (result.verdict === MISSING) {
    L.push('  ⚠️  存在确认缺失的服务二进制 —— 这正是 RSSHub 那 3 天的形态:服务在、路径没了、无人喊。')
    L.push('      逐条点名见上;修复出口是把它指向的真实二进制补回或把服务重指到新路径(改服务属机器态动作,本门不代做)。')
  } else if (result.verdict === UND) {
    L.push(`  ❔ 未判定 ${c[UND]} 项 —— 这不是"通过",是这一维今天没被看过。逐条原因见上。`)
  } else {
    L.push(`  ✅ ${c[OK]} 个 nssm 服务的 Application 全部存在(仅此一项为已判定结论)。`)
  }
  if (!result.strict && result.exitCode === 0 && result.verdict !== OK) {
    L.push('  (定级 warn:服务路径属机器状态,提交者结构上满足不了 ⇒ 默认档不改退出码;问责请跑 --strict)')
  }
  return L.join('\n')
}

export function main(argv = process.argv.slice(2)) {
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  const result = readNssmServices()
  const agg = summarize({ rows: result.rows, undetermined: result.undetermined, strict })
  const payload = {
    gate: 'check-service-binary-paths',
    at: result.at,
    engine: result.engine,
    strict,
    totalServices: result.totalServices,
    verdict: agg.verdict,
    counts: agg.counts,
    rows: result.rows,
    undetermined: result.undetermined,
    exitCode: agg.exitCode,
  }
  if (json) {
    console.log(JSON.stringify(payload, null, 2))
  } else {
    console.log(renderHuman({ ...payload, strict }))
  }
  return agg.exitCode
}

/**
 * 自检:全程零注册表写入、零真机依赖 —— 判据从注册表取值的动作被注入替身,三态分流由构造面证明。
 * 每条判据都配正反例(只留正例就是复读机,§22c)。
 */
export function selfTest() {
  const fails = []
  let n = 0
  const t = (name, fn) => {
    n += 1
    try {
      fn()
      console.log(`  ✅ ${name}`)
    } catch (e) {
      fails.push(`${name}: ${e && e.message}`)
      console.log(`  ❌ ${name}: ${e && e.message}`)
    }
  }
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg)
  }
  const fixedExists = (set) => (p) => (set.has(p) ? true : false)

  // ① 行级三态:正例(存在⇒ok)/ 反例(不存在⇒missing),同一条判据两侧都有牙
  t('S01 Application 存在 ⇒ ok', () => {
    const rows = classifyServices([{ service: 'A', application: 'C:/x/a.exe' }], fixedExists(new Set(['C:/x/a.exe'])))
    assert(rows[0].kind === OK, `期望 ok,实得 ${rows[0].kind}`)
  })
  t('S02 Application 不存在 ⇒ missing(不得静默成 ok)', () => {
    const rows = classifyServices([{ service: 'A', application: 'C:/x/gone.exe' }], fixedExists(new Set()))
    assert(rows[0].kind === MISSING, `期望 missing,实得 ${rows[0].kind}`)
    assert(/不存在/.test(rows[0].reason), 'missing 必须带原因')
  })
  t('S03 非绝对路径 ⇒ undetermined,不判 missing', () => {
    const rows = classifyServices([{ service: 'A', application: 'node.exe' }], fixedExists(new Set()))
    assert(rows[0].kind === UND, `期望 undetermined,实得 ${rows[0].kind}`)
  })
  t('S04 空 Application ⇒ undetermined(仅 ImagePath 命中 nssm 的那一类)', () => {
    const rows = classifyServices([{ service: 'A', application: '' }], fixedExists(new Set()))
    assert(rows[0].kind === UND, `期望 undetermined,实得 ${rows[0].kind}`)
  })
  t('S05 码页受损取值 ⇒ undetermined 而非 missing', () => {
    const rows = classifyServices([{ service: 'A', application: 'C:/x/\uFFFDnode.exe' }], fixedExists(new Set()))
    assert(rows[0].kind === UND, `期望 undetermined,实得 ${rows[0].kind}`)
  })
  t('S06 存在性检查抛错 ⇒ undetermined(exists 返回 null)', () => {
    const rows = classifyServices([{ service: 'A', application: 'C:/x/a.exe' }], () => null)
    assert(rows[0].kind === UND, `期望 undetermined,实得 ${rows[0].kind}`)
  })

  // ② 整面:空枚举不得被读成通过(本票的核心风险)
  t('S07 枚举到 0 个 nssm 服务 ⇒ 未判定,不是 ok', () => {
    const r = readNssmServices({
      platform: 'win32',
      derive: () => 'SUM|716\n',
      exists: fixedExists(new Set(['C:/Program Files/PowerShell/7/pwsh.exe'])),
    })
    assert(r.rows.length === 0, '不该有行')
    assert(r.undetermined.length > 0, '空枚举必须留下未判定原因')
    assert(summarize({ rows: r.rows, undetermined: r.undetermined }).verdict === UND, `期望 verdict=undetermined,实得 ${summarize({ rows: r.rows, undetermined: r.undetermined }).verdict}`)
  })
  t('S08 有 nssm 服务且路径都在 ⇒ verdict=ok(对照组:证明 S07 的红来自空枚举)', () => {
    const r = readNssmServices({
      platform: 'win32',
      derive: () => 'SVC|RssHub|app=C:/x/node.exe|dir=C:/x|img=C:/x/nssm.exe\nSUM|716\n',
      exists: fixedExists(new Set(['C:/Program Files/PowerShell/7/pwsh.exe', 'C:/x/node.exe'])),
    })
    const s = summarize({ rows: r.rows, undetermined: r.undetermined })
    assert(s.verdict === OK, `期望 ok,实得 ${s.verdict} / ${JSON.stringify(s.counts)}`)
    assert(s.counts[OK] === 1, '应恰好判到 1 个 ok')
  })
  t('S09 有 nssm 服务而路径没了 ⇒ verdict=missing 并点名服务名', () => {
    const r = readNssmServices({
      platform: 'win32',
      derive: () => 'SVC|RssHub|app=C:/versions/22.22.2-2/node.exe|dir=C:/x|img=C:/x/nssm.exe\nSUM|716\n',
      exists: fixedExists(new Set(['C:/Program Files/PowerShell/7/pwsh.exe'])),
    })
    const s = summarize({ rows: r.rows, undetermined: r.undetermined })
    assert(s.verdict === MISSING, `期望 missing,实得 ${s.verdict}`)
    assert(/RssHub/.test(renderHuman({ ...r, ...s, counts: s.counts, strict: false })), '人读面必须点名服务')
  })
  t('S10 派生失败 ⇒ 未判定且原因点名(不得成空表)', () => {
    const err = new Error('boom')
    err.code = 'ETIMEDOUT'
    const r = readNssmServices({ platform: 'win32', derive: () => { throw err }, exists: () => true })
    assert(r.undetermined.some((u) => /超时/.test(u)), `期望点名超时,实得 ${JSON.stringify(r.undetermined)}`)
    assert(summarize({ rows: r.rows, undetermined: r.undetermined }).verdict === UND, '派生失败必须落未判定')
  })
  t('S11 非 win32 ⇒ 未判定(如实,不冒充"没有坏服务")', () => {
    const r = readNssmServices({ platform: 'linux', exists: () => true })
    assert(r.undetermined.length === 1 && /win32/.test(r.undetermined[0]), JSON.stringify(r.undetermined))
  })
  t('S12 解释器候选全取不到 ⇒ 未判定', () => {
    const r = readNssmServices({ platform: 'win32', exists: () => false })
    assert(r.undetermined.some((u) => /解释器/.test(u)), JSON.stringify(r.undetermined))
  })
  t('S13 注册表基键缺失 ⇒ 未判定并点名', () => {
    const r = readNssmServices({
      platform: 'win32',
      derive: () => 'REGMISSING|HKLM:/SYSTEM/CurrentControlSet/Services\n',
      exists: fixedExists(new Set(['C:/Program Files/PowerShell/7/pwsh.exe'])),
    })
    assert(r.undetermined.some((u) => /基键/.test(u)), JSON.stringify(r.undetermined))
    assert(summarize({ rows: r.rows, undetermined: r.undetermined }).verdict === UND, '基键缺失不得记通过')
  })
  t('S14 缺 SUM 行(截断)⇒ 未判定', () => {
    const r = readNssmServices({
      platform: 'win32',
      derive: () => 'SVC|A|app=C:/x/a.exe|dir=|img=C:/x/nssm.exe\n',
      exists: fixedExists(new Set(['C:/Program Files/PowerShell/7/pwsh.exe', 'C:/x/a.exe'])),
    })
    assert(r.undetermined.some((u) => /SUM/.test(u)), JSON.stringify(r.undetermined))
  })
  t('S15 解不出的行必须保留并进未判定(不静默丢)', () => {
    const p = parseEnumOutput('SVC|A|app=C:/x/a.exe|dir=|img=oops\nGARBAGE LINE\nSUM|10\n')
    assert(p.services.length === 1, `应解析 1 条,实得 ${p.services.length}`)
    assert(p.unparsed.length === 1 && /GARBAGE/.test(p.unparsed[0]), JSON.stringify(p.unparsed))
  })
  t('S16 img 含竖线时仍解析(末段贪婪)', () => {
    const p = parseEnumOutput('SVC|A|app=C:/x/a.exe|dir=C:/x|img=C:/a|b/nssm.exe\nSUM|10\n')
    assert(p.services[0].imagePath === 'C:/a|b/nssm.exe', p.services[0].imagePath)
  })

  // ③ 退出码语义:warn 默认档 vs strict 问责档
  t('S17 默认档:确认缺失 ⇒ exit 0(机器态不得拦提交)', () => {
    assert(summarize({ rows: [{ kind: MISSING }], strict: false }).exitCode === 0, '默认档必须 0')
  })
  t('S18 strict:确认缺失 ⇒ exit 1', () => {
    assert(summarize({ rows: [{ kind: MISSING }], strict: true }).exitCode === 1, 'strict 缺失必须 1')
  })
  t('S19 strict:未判定 ⇒ exit 1(拒绝出具合格证)', () => {
    assert(summarize({ rows: [], undetermined: ['x'], strict: true }).exitCode === 1, 'strict 未判定必须 1')
  })
  t('S20 默认档:未判定 ⇒ exit 0 但 verdict 不是 ok', () => {
    const s = summarize({ rows: [], undetermined: ['x'], strict: false })
    assert(s.exitCode === 0 && s.verdict === UND, JSON.stringify(s))
  })
  t('S21 全 ok ⇒ strict 也 0(证明 strict 不是恒红)', () => {
    assert(summarize({ rows: [{ kind: OK }], strict: true }).exitCode === 0, '干净面 strict 必须 0')
  })
  t('S22 counts 三态不并桶:ok+missing+undetermined 各自独立计数', () => {
    const s = summarize({
      rows: [{ kind: OK }, { kind: MISSING }, { kind: UND }],
      undetermined: ['整面原因'],
      strict: false,
    })
    assert(s.counts[OK] === 1 && s.counts[MISSING] === 1 && s.counts[UND] === 2, JSON.stringify(s.counts))
  })
  t('S23 人读面:未判定必须喊出"未判定 N 项",不得写"全部通过"', () => {
    const s = summarize({ rows: [], undetermined: ['整面原因A', '整面原因B'], strict: false })
    const txt = renderHuman({ rows: [], undetermined: ['整面原因A', '整面原因B'], engine: 'x', totalServices: 716, counts: s.counts, verdict: s.verdict, strict: false })
    assert(/未判定 2 项/.test(txt), txt)
    assert(!/全部通过/.test(txt), txt)
    assert(/原因A/.test(txt), '未判定必须逐条报名')
  })
  t('S24 人读面:确认缺失时不得出现"全部存在"', () => {
    const s = summarize({ rows: [{ kind: MISSING, service: 'A', application: 'C:/x' }], strict: false })
    const txt = renderHuman({ rows: [{ kind: MISSING, service: 'A', application: 'C:/x', reason: '不存在' }], undetermined: [], engine: 'x', totalServices: 9, counts: s.counts, verdict: s.verdict, strict: false })
    assert(!/全部存在/.test(txt), txt)
    assert(/RSSHub 那 3 天/.test(txt), '必须把这一型说成它自己')
  })

  // ④ --json 形状:必须可 parse 且 counts 与明细自洽
  t('S25 --json 载荷可 JSON.parse 且 counts 与 rows 自洽', () => {
    const rows = classifyServices(
      [{ service: 'A', application: 'C:/x/a.exe' }, { service: 'B', application: 'C:/x/b.exe' }],
      fixedExists(new Set(['C:/x/a.exe'])),
    )
    const payload = { gate: 'check-service-binary-paths', rows, ...summarize({ rows, undetermined: [], strict: false }) }
    const back = JSON.parse(JSON.stringify(payload))
    assert(back.counts[OK] === 1 && back.counts[MISSING] === 1, JSON.stringify(back.counts))
    assert(back.counts[OK] + back.counts[MISSING] + back.counts[UND] === back.rows.length, 'counts 与明细必须闭合')
  })

  // ⑤ 端到端夹具:真文件在/不在,证明 missing 来自文件系统而不是硬编
  t('S26 真夹具:落盘文件⇒ok,删掉后同一路径⇒missing', () => {
    const dir = mkScratch('svc-bin-')
    try {
      const bin = path.join(dir, 'node.exe')
      writeFileSync(bin, 'x')
      const winPath = bin.replace(/\\/g, '/')
      const a = classifyServices([{ service: 'A', application: winPath }])
      assert(a[0].kind === OK, `夹具内文件应 ok,实得 ${a[0].kind}`)
      rmSync(bin)
      const b = classifyServices([{ service: 'A', application: winPath }])
      assert(b[0].kind === MISSING, `删除后应 missing,实得 ${b[0].kind}`)
    } finally {
      rmScratch(dir)
    }
  })
  t('S27 建夹具本身不得把落点放进仓库树内', () => {
    const dir = mkScratch('svc-root-')
    try {
      const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
      assert(!dir.startsWith(repo), `夹具落到了仓库内:${dir}`)
    } finally {
      rmScratch(dir)
    }
  })

  console.log(`\n--self-test:${n - fails.length} 通过 / ${fails.length} 失败`)
  if (fails.length) for (const f of fails) console.log(`  ✗ ${f}`)
  return fails.length ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // 应急出口只作用于 CLI 档:被 import 时不得改变宿主进程的行为(§22d)
  if (process.env.HUSKY_SKIP_SERVICE_BINARY_PATHS === '1') {
    console.log('⏭  HUSKY_SKIP_SERVICE_BINARY_PATHS=1 —— 跳过服务二进制路径对账(机器态档,跳过不改变仓库结论)')
    process.exit(0)
  }
  // §22d:脚本自身异常一律 exit 2(无法判定),不得以 uncaught 冒充判据红/绿
  try {
    const argv = process.argv.slice(2)
    const code = argv.includes('--self-test') ? selfTest() : main(argv)
    process.exit(code)
  } catch (e) {
    console.error(`无法判定(本门自身异常,不是判据结论):${e && e.message}\n${e && e.stack}`)
    process.exit(2)
  }
}

export const __test__ = {
  OK,
  MISSING,
  UND,
  PS_CANDIDATES,
  buildEnumScript,
  parseEnumOutput,
  classifyServices,
  readNssmServices,
  summarize,
  renderHuman,
  main,
  selfTest,
  looksCorrupted,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
