#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 服务运行配置入库真相源对账尺(票 G-584 归口;只读:不创建/修改/启停任何服务、不写注册表)。
 *
 * 立因:票面现读 `HKLM:\SYSTEM\CurrentControlSet\Services` 下 IHUI 前缀与 Keycloak 共 21 个服务全部 nssm
 * 托管,而仓内 `nssm install|set` 只点名 5 个 ⇒ 其余 16 个的 Application/AppParameters/AppDirectory/
 * AppStdout 没有任何入库真相源。**机器事实按当次实测**(AGENTS 头注):本机 2026-10-29 现读为
 * 3 个 IHUI* 服务、0 个 nssm 托管、nssm.exe 不在位、无 Keycloak —— 与本尺无关的 21 枚读数属另一台
 * 机或历史态;本尺把"注册表实际值 ↔ 仓内清单"的对账做成器物,两台机各自 --snapshot 重生成即可。
 * 与 G-10 件 `scripts/data/service-definitions.json`(s9 尺 check-service-binary-paths 的基准维)
 * 的分工:那一件服务"路径是否还活着",本件服务"四键配置与仓内清单逐字节对账 + 是否被仓内 nssm
 * install/set 点名",两尺各自判自己立项那一型,不互相代填。
 *
 * 三态硬要求(§0.3):ok / drift / unjudged 绝不并桶;取不到 pwsh、注册表枚举哨兵不齐、清单文件
 * 读不到/解不开 ⇒ 一律 unjudged 点名原因并 exit 2,绝不记绿也不冒红、绝不用 0 冒充"没有"。
 * drift(实际值与清单不一致 / 面上多服务 / 清单里服务消失)⇒ exit 1。全 ok ⇒ exit 0。
 *
 * 脱敏纪律(§5d 同款形态):清单里秘密只存「键名 + 脱敏形态 前6***后2 (len=N)」;
 * 判据比较在**脱敏后字节面**进行,原始秘密永不出仓、也不出 stdout。
 *
 * **刻意不进提交链**(§12e:判本机运行时状态,挂成提交门即恒红门):不注册进
 * scripts/guardian-runner.mjs、不挂 .husky/**、不挂 CI。问责入口 = 手动 / 守护巡检轮(由他人接线)。
 *
 * 用法:
 *   node scripts/check-service-inventory.mjs                 # 对账,末行 OK=/DRIFT=/UNJUDGED=
 *   node scripts/check-service-inventory.mjs --json          # 机读结论
 *   node scripts/check-service-inventory.mjs --snapshot      # 现读注册表,把脱敏后的清单 JSON 打到 stdout(重建入库件用)
 *   node scripts/check-service-inventory.mjs --self-test     # 判据自检(含摘掉判据即翻红成对夹具)
 * 退出码:0=全 ok;1=至少一条量到的 drift;2=存在 unjudged(含自检失败)。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { hostname } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PS_CANDIDATES } from './check-service-binary-paths.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const INVENTORY_REL = 'scripts/data/service-inventory.json'
export const INVENTORY_PATH = path.join(ROOT, 'scripts', 'data', 'service-inventory.json')

export const SNAP_HEAD = '#SVCINV v1'
export const SNAP_TAIL = '#SVCINV-END'
/** nssm 四键在清单里的固定字段名(顺序稳定,自证面逐键比)。 */
export const NSSM_KEYS = ['application', 'appParameters', 'appDirectory', 'appStdout']
/** 敏感键名词根(REG_MULTI_SZ env 块逐行按键名判;大小写不敏感)。 */
export const SENSITIVE_KEY_ROOTS = ['PASSWORD', 'PASSWD', 'PWD', 'SECRET', 'TOKEN', 'CREDENTIAL', 'CREDENTIALS', 'APIKEY', 'API_KEY', 'ACCESS_KEY', 'DATA_SOURCE', 'DATASOURCE', 'DSN', 'KEY']
/** 值内联秘密的通用形态(键名式 k=v 与 URL userinfo)。 */
export const INLINE_SECRET_PATTERNS = [
  /(\b(?:password|passwd|pwd|secret|token|credential|credentials|api_?key|access_?key|auth|dsn)\b\s*[=:]\s*)(\S+)/gi,
]
const URL_USERINFO = /(:\/\/)([^:\/@\s]+):([^@\/\s]+)@/g

/** 脱敏形态与 §5d 一致:`前6***后2 (len=N)`;≤8 位整体打码。 */
export function maskSecret(v) {
  const s = String(v)
  const L = s.length
  if (L <= 8) return `*** (len=${L})`
  return `${s.slice(0, 6)}***${s.slice(-2)} (len=${L})`
}

/** env 块逐行:敏感键名 ⇒ 值打码;其余原样(键名本身不入敏感词集时保留可读)。 */
export function redactEnvBlock(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/.exec(line)
      if (!m) return line
      const rootHit = SENSITIVE_KEY_ROOTS.some((k) => m[1].toUpperCase().includes(k))
      return rootHit ? `${m[1]}=${maskSecret(m[2])}` : line
    })
    .join('\n')
}

/** 任意字符串字段:内联 password=xxx / URL userinfo 一并打码。 */
export function redactValue(s) {
  if (s === null || s === undefined) return null
  let out = String(s)
  for (const re of INLINE_SECRET_PATTERNS) out = out.replace(re, (_all, p1, p2) => p1 + maskSecret(p2))
  out = out.replace(URL_USERINFO, (_all, p1, p2, p3) => `${p1}${p2}:${maskSecret(p3)}@`)
  return out
}

/** 注册表枚举通道:全部载荷走 base64(免码页/竖线/引号三坑),首尾哨兵齐才算"量到了"。 */
export function buildSnapshotScript() {
  return [
    "$ErrorActionPreference='Continue'",
    'function B64($s){ [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$s)) }',
    `'${SNAP_HEAD}'`,
    "$names = Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services' | Where-Object { $_.PSChildName -match '^(IHUI|Keycloak)' } | Sort-Object PSChildName",
    'foreach ($n in $names) {',
    '  $svc = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\$n"',
    '  $ip = Get-ItemProperty $svc -ErrorAction SilentlyContinue',
    '  if ($null -eq $ip) { continue }',
    '  $img = [string]$ip.ImagePath',
    '  $dn = [string]$ip.DisplayName',
    '  $st = if ($null -ne $ip.Start) { [int]$ip.Start } else { -1 }',
    '  $p = Join-Path $svc "Parameters"',
    "  $has = if (Test-Path $p) { 'Y' } else { 'N' }",
    '  "S|$n|$has|$st|$(B64 $img)|$(B64 $dn)"',
    '  if ($has -eq "Y") {',
    '    $pp = Get-ItemProperty $p -ErrorAction SilentlyContinue',
    "    foreach ($k in 'Application','AppParameters','AppDirectory','AppStdout') {",
    '      $v = $pp.$k',
    '      if ($null -ne $v) { $enc = if ($v -is [array]) { ($v -join [char]10) } else { [string]$v }; "P|$n|$k|$(B64 $enc)" }',
    '    }',
    '  }',
    '}',
    `'${SNAP_TAIL}'`,
  ].join('\n')
}

const b64 = (tok) => Buffer.from(tok, 'base64').toString('utf8')

/** 解析枚举载荷;返回 {status:'ok'|'unjudged', reason?, services?}。
 *  哨兵不齐 ⇒ unjudged(把"0 行"与"整面没枚举到"分开,§22c)。 */
export function parseSnapshot(text) {
  if (typeof text !== 'string' || text.length === 0) return { status: 'unjudged', reason: '枚举通道无输出' }
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  const hi = lines.indexOf(SNAP_HEAD)
  const ti = lines.lastIndexOf(SNAP_TAIL)
  if (hi === -1 || ti === -1 || ti < hi) return { status: 'unjudged', reason: `枚举哨兵不齐(head@${hi},tail@${ti})` }
  const services = new Map()
  const noise = []
  for (const l of lines.slice(hi + 1, ti)) {
    const s = /^S\|([^|]+)\|([YN])\|(-?\d+)\|([^|]*)\|([^|]*)$/.exec(l)
    if (s) {
      services.set(s[1], {
        name: s[1],
        hasParameters: s[2] === 'Y',
        start: Number(s[3]),
        imagePath: b64(s[4]),
        displayName: b64(s[5]),
        params: {},
      })
      continue
    }
    const p = /^P\|([^|]+)\|([A-Za-z]+)\|([^|]*)$/.exec(l)
    if (p && services.has(p[1])) {
      services.get(p[1]).params[p[2]] = b64(p[3])
      continue
    }
    noise.push(l)
  }
  if (noise.length > 0) return { status: 'unjudged', reason: `枚举载荷含 ${noise.length} 条不认识行(形态漂移)`, noise }
  return { status: 'ok', services }
}

/** 把枚举结果归一为与清单同形的脱敏事实集。 */
export function deriveLiveFacts(parsed) {
  const out = []
  for (const rec of parsed.services.values()) {
    const nssmManaged = rec.hasParameters || /nssm(\.exe)?/i.test(rec.imagePath)
    const fact = {
      name: rec.name,
      displayName: redactValue(rec.displayName),
      start: rec.start,
      imagePath: redactValue(rec.imagePath),
      nssmManaged,
      application: rec.hasParameters ? redactValue(redactEnvBlock(rec.params.Application ?? '')) : null,
      appParameters: rec.hasParameters ? redactValue(redactEnvBlock(rec.params.AppParameters ?? '')) : null,
      appDirectory: rec.hasParameters ? redactValue(rec.params.AppDirectory ?? '') : null,
      appStdout: rec.hasParameters ? redactValue(rec.params.AppStdout ?? '') : null,
    }
    // 非 nssm 托管时四键不适用:与清单同基准置 null(§2026-10-13 教训:两侧必须同基准归一化)
    if (!nssmManaged) for (const k of NSSM_KEYS) if (fact[k] === '') fact[k] = null
    out.push(fact)
  }
  out.sort((a, b) => (a.name < b.name ? -1 : 1))
  return out
}

/** 仓内 `nssm install|set` 点名判定(纯函数,输入 = {相对路径→内容} 映射,零 fs 依赖⇒可夹具自证)。 */
export function detectRepoNssmRefs(filesMap, serviceName) {
  const esc = serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // \b 在 `-` 边界不可靠(IHUI-API vs IHUI-API-BLUE),显式排除后继 - 与字母数字
  const nameRe = new RegExp(`(?<![A-Za-z0-9_-])${esc}(?![A-Za-z0-9_-])`, 'i')
  const hits = []
  for (const [rel, content] of Object.entries(filesMap)) {
    if (!/nssm\s+(install|set)/i.test(content)) continue
    if (nameRe.test(content)) hits.push(rel)
  }
  return hits.sort()
}

export const REPO_SCAN_ROOTS = ['deploy/win', 'deploy/scripts/prod-bundle', 'monitoring/alertbridge']
export const REPO_SCAN_EXTS = ['.ps1', '.cjs', '.mjs', '.sh', '.cmd', '.bat', '.md']
/** 采集仓内扫描面(相对路径→内容);读不到某根只点名不失明整面。 */
export function collectRepoScanFiles(repoRoot = ROOT) {
  const map = {}
  const walk = (dir, relDir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const rel = relDir ? `${relDir}/${e.name}` : e.name
      if (e.isDirectory()) walk(path.join(dir, e.name), rel)
      else if (REPO_SCAN_EXTS.some((x) => e.name.toLowerCase().endsWith(x))) {
        try {
          map[rel] = readFileSync(path.join(dir, e.name), 'utf8')
        } catch {
          /* 单文件读不到:跳过并点名 */
        }
      }
    }
  }
  for (const r of REPO_SCAN_ROOTS) walk(path.join(repoRoot, r), r.split(path.sep).join('/'))
  return map
}

export function buildInventoryObject(liveFacts, filesMap, meta = {}) {
  return {
    $comment:
      '本机 Windows 服务运行配置的入库真相源(票 G-584 归口)。射程 = 注册表 HKLM:\\SYSTEM\\CurrentControlSet\\Services 下名字匹配 ^(IHUI|Keycloak)$ 的服务;四键 application/appParameters/appDirectory/appStdout 仅 nssmManaged=true 时有值。秘密只存脱敏形态(前6***后2 (len=N)),原始凭据永不入仓。重建方式:node scripts/check-service-inventory.mjs --snapshot 重定向覆写本文件;不得手改单条。',
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    host: meta.host ?? hostname(),
    nssmBinaryPresent: meta.nssmBinaryPresent ?? false,
    comparisonBasis: '脱敏后逐字节等值;两侧同基准归一化',
    services: liveFacts.map((f) => {
      const refs = detectRepoNssmRefs(filesMap, f.name)
      return { ...f, referencedByRepoNssmScripts: refs.length > 0, repoNssmRefFiles: refs }
    }),
  }
}

/** 三态对账(纯函数):逐键比 + 面上多/缺服务;绝不并桶。 */
export function compareInventory(inventory, liveFacts) {
  const verdicts = []
  const liveByName = new Map(liveFacts.map((f) => [f.name, f]))
  const invByName = new Map((inventory?.services ?? []).map((f) => [f.name, f]))
  for (const [name, live] of liveByName) {
    const inv = invByName.get(name)
    if (!inv) {
      verdicts.push({ name, status: 'drift', fields: [{ key: '__presence__', expected: '(不在清单)', actual: '在注册表实际存在' }] })
      continue
    }
    const fields = []
    // referencedByRepoNssmScripts 属**仓内侧**事实(由 detectRepoNssmRefs 在快照生成时对账),
    // 注册表实际面没有这一维 ⇒ 不参与"注册表↔清单"比键,否则是结构上必漂的假 drift。
    for (const key of ['displayName', 'start', 'imagePath', 'nssmManaged', ...NSSM_KEYS]) {
      const a = norm(inv[key])
      const b = norm(live[key])
      if (a !== b) fields.push({ key, expected: a, actual: b })
    }
    verdicts.push({ name, status: fields.length ? 'drift' : 'ok', fields })
  }
  for (const name of invByName.keys()) {
    if (!liveByName.has(name)) verdicts.push({ name, status: 'drift', fields: [{ key: '__presence__', expected: '清单在册', actual: '注册表已无此服务键' }] })
  }
  return verdicts
}

const norm = (v) => (v === undefined ? null : v === null ? null : String(v))

function readLive() {
  if (process.platform !== 'win32') return { status: 'unjudged', reason: `非 win32 平台(${process.platform}),注册表通道不适用` }
  const ps = PS_CANDIDATES.find((c) => existsSync(c.bin))
  if (!ps) return { status: 'unjudged', reason: '两把 PowerShell 解释器候选都不在位(§5b:服务身份与交互账户 PATH 互不相通,故按绝对路径候选找)' }
  const r = spawnSync(ps.bin, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', buildSnapshotScript()], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: Number(process.env.IHUI_SVCINV_TIMEOUT_MS || 60_000),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  if (r.error) return { status: 'unjudged', reason: `pwsh 派生失败:${r.error.message}` }
  if (r.status !== 0) return { status: 'unjudged', reason: `pwsh 枚举退出码 ${r.status},stderr 首行:${String(r.stderr || '').split(/\r?\n/)[0] || '(空)'}` }
  return parseSnapshot(r.stdout)
}

export function runOnce({ json = false } = {}) {
  const live = readLive()
  if (live.status !== 'ok') return finish({ unjudged: [{ name: '(整面)', reason: `注册表枚举通道未判定:${live.reason}` }], json })
  if (!existsSync(INVENTORY_PATH)) return finish({ unjudged: [{ name: '(入库件)', reason: `清单文件读不到:${INVENTORY_REL}` }], json })
  let inventory
  try {
    inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'))
  } catch (e) {
    return finish({ unjudged: [{ name: '(入库件)', reason: `清单 JSON 解不开:${e.message}` }], json })
  }
  const liveFacts = deriveLiveFacts(live)
  return finish({ verdicts: compareInventory(inventory, liveFacts), json })
}

function finish({ verdicts = [], unjudged = [], json = false }) {
  let ok = 0
  let drift = 0
  for (const v of verdicts) {
    if (v.status === 'ok') ok++
    else if (v.status === 'drift') drift++
    else unjudged.push(v)
  }
  const lines = []
  for (const v of verdicts) {
    if (v.status === 'drift') {
      lines.push(`DRIFT ${v.name}:` + v.fields.map((f) => ` ${f.key} [清单=${shorten(f.expected)} ↔ 实际=${shorten(f.actual)}]`).join(';'))
    }
  }
  for (const u of unjudged) lines.push(`UNJUDGED ${u.name || '(整面)'}: ${u.reason ?? '该维取不到输入'}`)
  const exitCode = unjudged.length > 0 ? 2 : drift > 0 ? 1 : 0
  if (json) {
    process.stdout.write(JSON.stringify({ ok, drift, unjudged: unjudged.length, verdicts, unjudgedReasons: unjudged }, null, 2) + '\n')
  } else {
    for (const l of lines) process.stdout.write(l + '\n')
  }
  process.stdout.write(`OK=${ok} DRIFT=${drift} UNJUDGED=${unjudged.length}${unjudged.length ? ' — 未判定不记绿也不冒红(§0.3)' : ''}\n`)
  return exitCode
}

const shorten = (s) => (s === null ? 'null' : String(s).replace(/\s+/g, ' ').slice(0, 120))

// ---------------- self-test ----------------
export function selfTest() {
  const fails = []
  const t = (label, cond) => {
    if (!cond) fails.push(label)
  }
  // 夹具:一 nssm 一非 nssm,env 块含秘密
  const mkText = (opts = {}) => {
    const B = (s) => Buffer.from(String(s), 'utf8').toString('base64')
    const lines = [SNAP_HEAD]
    lines.push(`S|IHUI-DEMO|Y|2|${B('C:\\Windows\\System32\\nssm.exe')}|${B('Demo Service')}`)
    lines.push(`P|IHUI-DEMO|Application|${B('C:/pwsh/pwsh.exe')}`)
    lines.push(`P|IHUI-DEMO|AppParameters|${B('-File X.ps1 -password=S3cretLongValue')}`)
    lines.push(`P|IHUI-DEMO|AppDirectory|${B('G:/IHUI-AI')}`)
    lines.push(`P|IHUI-DEMO|AppStdout|${B('G:/DevEnv/logs/svc.log')}`)
    if (!opts.dropIhuiApi) lines.push(`S|IHUI-API|N|2|${B('cmd.exe /c "cd /d G:\\IHUI-AI"')}|${B('API')}`)
    if (opts.mutateImagePath) lines[lines.length - 1] = `S|IHUI-API|N|2|${B('cmd.exe /c "cd /d D:\\IHUI-AI"')}|${B('API')}`
    lines.push(SNAP_TAIL)
    return lines.join('\n')
  }
  const parsed = parseSnapshot(mkText())
  t('ST1 哨兵齐⇒解析成功且 2 服务', parsed.status === 'ok' && parsed.services.size === 2)
  const noHead = parseSnapshot(SNAP_TAIL + '\n')
  t('ST2 哨兵不齐⇒unjudged(0 行≠没枚举到)', noHead.status === 'unjudged')
  const noisey = parseSnapshot([SNAP_HEAD, 'garbage!!', SNAP_TAIL].join('\n'))
  t('ST3 载荷形态漂移⇒unjudged 不猜', noisey.status === 'unjudged')
  const facts = deriveLiveFacts(parsed)
  const demo = facts.find((f) => f.name === 'IHUI-DEMO')
  const api = facts.find((f) => f.name === 'IHUI-API')
  t('ST4 nssm 托管判定', demo.nssmManaged === true && api.nssmManaged === false)
  t('ST5 非 nssm 四键同基准归 null', NSSM_KEYS.every((k) => api[k] === null))
  t('ST6 内联秘密脱敏(原值绝不出面)', !JSON.stringify(demo).includes('S3cretLongValue') && /前6|\*\*\*/.test(JSON.stringify(demo)))
  const inv = buildInventoryObject(facts, { 'deploy/win/install-demo-service.ps1': 'nssm install IHUI-DEMO X\nnssm set IHUI-DEMO AppStdout Y', 'deploy/win/other.ps1': 'IHUI-API 无关提及无 nssm 动词' }, { generatedAt: 'T', host: 'H', nssmBinaryPresent: true })
  t('ST7 仓内 nssm 点名判定(动词+名字同文件)', inv.services.find((s) => s.name === 'IHUI-DEMO').referencedByRepoNssmScripts === true && inv.services.find((s) => s.name === 'IHUI-API').referencedByRepoNssmScripts === false)
  // 成对夹具:同面同数据 ⇒ ok;改一个字段 ⇒ drift(摘掉这一判就永远读不到漂移)
  const okV = compareInventory(inv, deriveLiveFacts(parsed))
  t('ST8 正控:清单↔实际同基准 ⇒ 全 ok', okV.length === 2 && okV.every((v) => v.status === 'ok'))
  const driftLive = deriveLiveFacts(parseSnapshot(mkText({ mutateImagePath: true })))
  const dV = compareInventory(inv, driftLive)
  const apiV = dV.find((v) => v.name === 'IHUI-API')
  t('ST9 反控:imagePath 漂移必被点名(成对夹具的"红"半边)', apiV.status === 'drift' && apiV.fields.some((f) => f.key === 'imagePath'))
  const dropOne = compareInventory(inv, driftLive.filter((f) => f.name !== 'IHUI-API'))
  t('ST10 清单在册而实际消失 ⇒ drift __presence__', dropOne.find((v) => v.name === 'IHUI-API')?.fields?.[0]?.key === '__presence__')
  const extra = compareInventory({ services: [] }, deriveLiveFacts(parsed))
  t('ST11 实际多出未入册 ⇒ drift(不用 0 冒充没有)', extra.length === 2 && extra.every((v) => v.status === 'drift'))
  const red = redactValue('postgres://user:Sup3rSecretPassw0rd@h:5432/db token=abcdefghij12')
  t('ST12 URL userinfo + k=v 双形态打码', !red.includes('Sup3rSecretPassw0rd') && !red.includes('abcdefghij12') && red.includes('len='))
  t('ST13 maskSecret 短值整体打码', maskSecret('abc') === '*** (len=3)' && maskSecret('1234567890').startsWith('123456***'))
  return fails
}

function snapshotToStdout() {
  const live = readLive()
  if (live.status !== 'ok') {
    process.stderr.write(`UNJUDGED:注册表枚举通道未判定:${live.reason}(§0.3 不以空清单冒充现读)\n`)
    return 2
  }
  const nssmPresent = existsSync('C:\\Windows\\System32\\nssm.exe')
  const obj = buildInventoryObject(deriveLiveFacts(live), collectRepoScanFiles(), { nssmBinaryPresent: nssmPresent })
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n')
  return 0
}

function mainCli(argv) {
  if (argv.includes('--self-test')) {
    const fails = selfTest()
    for (const f of fails) process.stdout.write(`FAIL ${f}\n`)
    process.stdout.write(fails.length === 0 ? 'SELF-TEST PASS 13/13\n' : `SELF-TEST FAIL ${fails.length}/13\n`)
    return fails.length === 0 ? 0 : 2
  }
  if (argv.includes('--snapshot')) return snapshotToStdout()
  return runOnce({ json: argv.includes('--json') })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = mainCli(process.argv.slice(2))
  } catch (e) {
    process.stderr.write(`脚本自身异常:${e?.message}\n${e?.stack ?? ''}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  maskSecret,
  redactValue,
  redactEnvBlock,
  buildSnapshotScript,
  parseSnapshot,
  deriveLiveFacts,
  detectRepoNssmRefs,
  buildInventoryObject,
  compareInventory,
  selfTest,
  SNAP_HEAD,
  SNAP_TAIL,
  NSSM_KEYS,
  INVENTORY_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
