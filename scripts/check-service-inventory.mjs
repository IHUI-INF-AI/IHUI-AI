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
 * 读不到/解不开、**枚举到 0 个候选服务** ⇒ 一律 unjudged 点名原因并 exit 2,绝不记绿也不冒红、
 * 绝不用 0 冒充"没有"。〔P0 静默绿修补@2026-10-30 g34-s4:旧 buildSnapshotScript 用 "HKLM:\...\$n"
 * 取路径,而 $n 是 RegistryKey、ToString() 返回 HKEY_LOCAL_MACHINE\... 全串 ⇒ 真服务全被 continue、
 * --snapshot 输出 services:[] 却因哨兵齐 exit 0(本机实测 3 枚 IHUI* 服务全部静默消失、自检仍 13/13 绿,
 * 因自检夹具从不派生 pwsh)。正解 = 一律 .PSChildName(路径 + S|/P| 三处内插同改),补 0 候选判死闸
 * 与生产者形状锁 bareRegistryVarHits(带"改回去必翻红"反向对照)。〕
 * drift(实际值与清单不一致 / 面上多服务 / 清单里服务消失)⇒ exit 1。全 ok ⇒ exit 0。
 *
 * ── 第二格:三面分类(g35-s13@2026-10-30,票 G-584「三枚在册服务在仓里零 provisioning 真相源」)──
 * 上一席把"注册表 ↔ 清单"这一面对账修活了,但它只回答**配置对不对**,没回答**这服务是谁建的**。
 * 本尺把三个面分开取数再逐枚定性:
 *   ① 注册表实际面 = ^(IHUI|Keycloak) 匹配到的服务键(本机现读 3 枚);
 *   ② 结构化名册面 = 三本台账里**整值等于服务名形态**的取值(现读 24 枚)。名册只认结构化整值:
 *      按 token 正则去扫 deploy/ 全文会把 IHUI_WEB_PORT(env 键)、ihui-ai-svc(容器名)、指标名
 *      全捞进来(实测 60 枚文件里 60+ 个"候选名"),那把尺子判不了任何东西;
 *   ③ 仓内动作面 = 逐行找「建服动词」(nssm install / New-Service / sc create)与「用服动词」
 *      (Get-/Start-/Stop-/Restart-/Set-Service、nssm get|set、sc config|query)。**建 ≠ 用**:
 *      只有建的动作才配当"怎么被造出来"的真相源,使用点只证明有人在用它。
 * 归属一律**按行**取,不按整文件共现 —— 实测整文件共现会把 install-deploy-loop-service.ps1:16
 * 那行注释里顺手列出的 IHUI-MONITOR / IHUI-GIT-GUARD / IHUI-PG-BACKUP 全读成"这脚本建的"(假真相源)。
 * 分桶:installed-provisioned / installed-no-provisioning-source(装了但仓里没人能建 = 票面那一格,
 * 未登记债即红)/ not-installed-installable(本机没装、仓里有建法)/ not-installed-consumer-only
 * (本机没装、仓里只有使用点 ⇒ 属另一台承载机,非幽灵)/ not-installed-declared-elsewhere(债账已
 * 点名归属)/ ghost-reference(名册点名、既没装、仓里既无建法又无使用点 = 悬空引用 ⇒ 红)。
 * 红只开两档,且都必须"验过才免":免的依据住 scripts/data/service-provisioning-gaps.json,
 * 每条带 services/reason(≥10 字)/reviewBy(会到期),三要素缺一按未登记处理;到期即回红(§0.7)。
 *
 * ── ihui-enable-unattended-intake.ps1 那一格的处置(§0.8 不许留跑不通的出路)──
 * 该脚本是仓里唯一命中 IHUI-API 的文件,但它只做 `nssm set AppEnvironmentExtra`(参数化改写),
 * **不负责建服务**;而本机现读 IHUI-API 连 Parameters 子键都没有(ImagePath 是 cmd.exe /c 包装的
 * SCM 直装形态)⇒ 它在这台机上结构上跑不通。补"建服务那一腿"要 SCM 写权限与服务账号身份,属机器
 * 动作、本席不代造,造一枚没法当场验的建服脚本同样违反 §0.8。处置 = 把射程写成脚本里的**硬闸**
 * (服务不在位 / 非 nssm 托管 ⇒ exit 2 点名"本脚本不建服务"并把出路指向本清单的 provisioning 段),
 * 判据侧由 ST44 钉住:命中 IHUI-API 的那枚文件必须含该声明,摘掉声明即回红 —— 声明不是注释,是闸。
 *
 * ── 盘符维(§0 七类现读机器事实)──
 * 清单里的 imageTemplate 一律把当次仓库根归一成 ${REPO_ROOT}(反斜杠/正斜杠/file:/// 三形同归),
 * 判据里不出现任何写死的 D:\ / G:\;bakedRepoPathHits 只报"钉在当次仓根之下"的枚数(换盘符即全体
 * 起不来的暴露面),换盘符后必须重跑 --snapshot,否则注册表↔清单的 imagePath 比对会判 DRIFT(那一侧
 * 才是有牙的)。票面"6 个服务钉死 D:\IHUI-AI"在本机已随 D:→G: 迁移失效,现读以本文件读数为准。
 *
 * 脱敏纪律(§5d 同款形态):清单里秘密只存「键名 + 脱敏形态 前6***后2 (len=N)」;
 * 判据比较在**脱敏后字节面**进行,原始秘密永不出仓、也不出 stdout。
 *
 * **刻意不进提交链**(§12e:判本机运行时状态,挂成提交门即恒红门):不注册进
 * scripts/guardian-runner.mjs、不挂 .husky/**、不挂 CI。问责入口 = 手动 / pnpm check:service-inventory
 * / 守护巡检轮(接线由主席做,AGENTS/README 的 R4 点名同批待主席补)。
 *
 * 用法:
 *   node scripts/check-service-inventory.mjs                 # 对账,末行 OK=/DRIFT=/FACE-RED=/UNJUDGED=
 *   node scripts/check-service-inventory.mjs --json          # 机读结论(含 faceRows 逐枚分桶)
 *   node scripts/check-service-inventory.mjs --snapshot      # 现读注册表,把脱敏后的清单 JSON 打到 stdout(重建入库件用)
 *   node scripts/check-service-inventory.mjs --self-test     # 判据自检(含摘掉判据即翻红成对夹具)
 * 退出码:0=全 ok;1=至少一条量到的 drift 或量到的缺口;2=存在 unjudged(含自检失败)。
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
export const SENSITIVE_KEY_ROOTS = [
  'PASSWORD',
  'PASSWD',
  'PWD',
  'SECRET',
  'TOKEN',
  'CREDENTIAL',
  'CREDENTIALS',
  'APIKEY',
  'API_KEY',
  'ACCESS_KEY',
  'DATA_SOURCE',
  'DATASOURCE',
  'DSN',
  'KEY',
]
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
  for (const re of INLINE_SECRET_PATTERNS)
    out = out.replace(re, (_all, p1, p2) => p1 + maskSecret(p2))
  out = out.replace(URL_USERINFO, (_all, p1, p2, p3) => `${p1}${p2}:${maskSecret(p3)}@`)
  return out
}

/** 注册表枚举通道:全部载荷走 base64(免码页/竖线/引号三坑),首尾哨兵齐才算"量到了"。
 *  `T|<n>` = Services hive 子键总数,用来把"过滤器匹配 0 个"与"hive 根本没读到"两种 0 分开点名。
 *
 *  修@2026-10-30(P0 静默绿,票 G-584 g34-s4 复现):`$n` 是 `Microsoft.Win32.RegistryKey`,
 *  在字符串内插里走 `ToString()` ⇒ 返回 `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\<名>`
 *  全串(不是子键名)。旧写法把它拼回 `HKLM:\...\<$n>`,得到
 *  `HKLM:\SYSTEM\CurrentControlSet\Services\HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\IHUI-API`
 *  这种必然不存在的路径 ⇒ `Get-ItemProperty` 恒 null ⇒ **每个真服务都命中 `continue`** ⇒ 载荷恒空、
 *  `--snapshot` 却因"哨兵齐"判 status=ok 并 **exit 0**(本机实测 3 枚 IHUI* 服务全部消失)。
 *  正解 = 一律取 `.PSChildName`(仅子键名);路径与两条载荷行(`S|`/`P|`)的 **三处** 内插同批改,
 *  只改路径那处会留下"服务名=全路径"的次生漂移。形状由 selfTest 的脚本面锁(成对夹具)钉住——
 *  自检夹具此前只喂合成载荷、从不派生 pwsh,所以 13/13 全绿与生产者坏掉可以同时成立。 */
export function buildSnapshotScript() {
  return [
    "$ErrorActionPreference='Continue'",
    'function B64($s){ [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$s)) }',
    `'${SNAP_HEAD}'`,
    "$svcRoot = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services'",
    '$all = @(Get-ChildItem $svcRoot -ErrorAction SilentlyContinue)',
    "'T|' + $all.Count",
    "$names = @($all | Where-Object { $_.PSChildName -match '^(IHUI|Keycloak)' } | Sort-Object PSChildName)",
    'foreach ($n in $names) {',
    '  $key = $n.PSChildName',
    '  $svc = "$svcRoot\\$key"',
    '  $ip = Get-ItemProperty $svc -ErrorAction SilentlyContinue',
    '  if ($null -eq $ip) { continue }',
    '  $img = [string]$ip.ImagePath',
    '  $dn = [string]$ip.DisplayName',
    '  $st = if ($null -ne $ip.Start) { [int]$ip.Start } else { -1 }',
    '  $p = Join-Path $svc "Parameters"',
    "  $has = if (Test-Path $p) { 'Y' } else { 'N' }",
    '  "S|$key|$has|$st|$(B64 $img)|$(B64 $dn)"',
    '  if ($has -eq "Y") {',
    '    $pp = Get-ItemProperty $p -ErrorAction SilentlyContinue',
    "    foreach ($k in 'Application','AppParameters','AppDirectory','AppStdout') {",
    '      $v = $pp.$k',
    '      if ($null -ne $v) { $enc = if ($v -is [array]) { ($v -join [char]10) } else { [string]$v }; "P|$key|$k|$(B64 $enc)" }',
    '    }',
    '  }',
    '}',
    `'${SNAP_TAIL}'`,
  ].join('\n')
}

const b64 = (tok) => Buffer.from(tok, 'base64').toString('utf8')

/** 形状锁判据(单一实现，自检的正/反两面共用，§22c 不许复制第二份尺):
 *  枚举脚本里的 `$n` 是 `Microsoft.Win32.RegistryKey`，字符串内插里走 `ToString()` ⇒
 *  得到 `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\<名>` 全串。它只许出现在
 *  两处：`foreach ($n in $names)` 的目标、以及 `$n.PSChildName` 取子键名。
 *  其余任何一处 `$n` 都是那枚 P0 静默绿本体(路径拼不出 ⇒ 真服务全 continue ⇒ 载荷空而 exit 0)。
 *  返回残留 `$n` 的枚数；0 = 形状合格。 */
export function bareRegistryVarHits(script) {
  const allowed = String(script)
    .split('$n.PSChildName')
    .join('')
    .split('foreach ($n in $names)')
    .join('')
  // (?!\w) 排除 `$names`(循环集合变量)——$n 只是它的前缀，不是内插点。
  // 故意**不带** (?!\.)：`$n.Name`/`$n.GetValue(...)` 这类同样落红，只有 .PSChildName 是正解。
  return (allowed.match(/\$n(?!\w)/g) ?? []).length
}

/** 解析枚举载荷;返回 {status:'ok'|'unjudged', reason?, services?}。
 *  哨兵不齐 ⇒ unjudged(把"0 行"与"整面没枚举到"分开,§22c)。 */
export function parseSnapshot(text) {
  if (typeof text !== 'string' || text.length === 0)
    return { status: 'unjudged', reason: '枚举通道无输出' }
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  const hi = lines.indexOf(SNAP_HEAD)
  const ti = lines.lastIndexOf(SNAP_TAIL)
  if (hi === -1 || ti === -1 || ti < hi)
    return { status: 'unjudged', reason: `枚举哨兵不齐(head@${hi},tail@${ti})` }
  const services = new Map()
  const noise = []
  let total = null
  for (const l of lines.slice(hi + 1, ti)) {
    const t = /^T\|(\d+)$/.exec(l)
    if (t) {
      total = Number(t[1])
      continue
    }
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
  if (noise.length > 0)
    return { status: 'unjudged', reason: `枚举载荷含 ${noise.length} 条不认识行(形态漂移)`, noise }
  // §0.3「枚举到 0 个候选判死不记绿」:本尺过滤器是 ^(IHUI|Keycloak) 正则,它「匹配到 0 个」
  // 与旧 RegistryKey 拼路径 bug「把每个真服务都 continue 掉」在载荷面上长得一模一样——旧行为
  // 正是拿后者冒充前者并 exit 0(本机实测 3 枚 IHUI* 服务全部消失仍报 ok)。T| 总数哨兵只用来
  // 给「究竟哪个 0」定向说明,不作为放行条件:真机一枚都没有时出口是人工登记空清单并写明依据,
  // 不是接受绿(§0.10 失效方向恒为多要一次定向说明)。
  if (services.size === 0) {
    if (total === null)
      return {
        status: 'unjudged',
        reason: '枚举到 0 个候选服务且缺 T| 总数哨兵——枚举面本身没判到，不记绿(§0.3)',
        total: null,
      }
    if (total === 0)
      return {
        status: 'unjudged',
        reason:
          '枚举到 0 个候选服务，且 Services hive 子键总数也读到 0——hive 不可读或路径形态已变，不记绿(§0.3)',
        total,
      }
    return {
      status: 'unjudged',
      reason: `枚举到 0 个候选服务(过滤器在 ${total} 个服务里匹配 0 个)——按 §0.3 判死不记绿`,
      total,
    }
  }
  return { status: 'ok', services, total }
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
      application: rec.hasParameters
        ? redactValue(redactEnvBlock(rec.params.Application ?? ''))
        : null,
      appParameters: rec.hasParameters
        ? redactValue(redactEnvBlock(rec.params.AppParameters ?? ''))
        : null,
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
  const nameRe = nameLiteralRe(serviceName)
  const hits = []
  for (const [rel, content] of Object.entries(filesMap)) {
    if (!/nssm\s+(install|set)/i.test(content)) continue
    if (nameRe.test(content)) hits.push(rel)
  }
  return hits.sort()
}

/** 服务名精确匹配(纯函数,三处探测器共用一把尺,§0.6 不写第二份)。
 *  `\b` 在 `-` 边界不可靠(IHUI-API vs IHUI-API-BLUE),显式排除前后继 - 与字母数字。 */
export function nameLiteralRe(serviceName) {
  const esc = String(serviceName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![A-Za-z0-9_-])${esc}(?![A-Za-z0-9_-])`, 'i')
}

/** 「建服动词」与「改写/消费动词」必须分家(g35-s13 立,票 G-584 第二格):
 *  仓里点名某服务名的文件,只有含**建**的动作才配当"这服务是怎么来的"的真相源;
 *  `nssm set` / `Get-Service` 那一类只证明**有人在用它**,不证明任何人能把它建出来。
 *  混成一把尺的结果就是把 IHUI-API 读成"有真相源"——它唯一的命中件
 *  `deploy/win/ihui-enable-unattended-intake.ps1` 是参数化改写,且本机 IHUI-API 无
 *  Parameters 子键(nssm 根本不管它)⇒ 那脚本对这台机结构上跑不通(§0.8)。 */
export const REPO_CREATE_VERB_RE = /(nssm\s+install|New-Service\b|sc(?:\.exe)?\s+create\b)/i
export const REPO_SERVICE_USE_VERB_RE =
  /((?:Get|Start|Stop|Restart|Set)-Service\b|nssm\s+(?:get|set|install|restart|stop|start)\b|sc(?:\.exe)?\s+(?:config|query|start|stop)\b)/i

/** 服务名 token(整词,盘符/路径前缀不算):`G:\IHUI-AI\…` 里的 IHUI-AI 是目录名，不是服务。 */
const REPO_NAME_TOKEN_RE = /(?<![A-Za-z0-9_\\/.:-])((?:IHUI|Keycloak)(?:-[A-Za-z0-9]+)*)(?![A-Za-z0-9_-])/gi
/** `$svc = 'IHUI-DEPLOYLOOP'` / `[string]$ServiceName='X'` / `$a = @("X","Y")` 这类"本文件的服务目标"声明。
 *  装具脚本一律用变量把名字喂给 nssm(`nssm install $svc …`)，只按字面量同行动就会把每一枚装服脚本读成"没建法"。 */
const REPO_SVC_ASSIGN_RE = /\$\w*(?:svc|service)\w*\s*=/i

/** 逐行摘出「这一行提到的服务名」；行级归属是这一维的关键：
 *  `install-deploy-loop-service.ps1:16` 的注释里顺手列了 IHUI-MONITOR / IHUI-GIT-GUARD /
 *  IHUI-PG-BACKUP，按**整文件**共现去判"建服源"就会把这四枚全认成它建的(实测误判)。 */
export function harvestRepoServiceTargets(text) {
  const create = new Set()
  const use = new Set()
  const set = new Set()
  const assigned = new Set()
  const lines = String(text).split(/\r?\n/)
  const hasCreate = lines.some((l) => REPO_CREATE_VERB_RE.test(l))
  const hasUse = lines.some((l) => REPO_SERVICE_USE_VERB_RE.test(l))
  const hasSet = lines.some((l) => REPO_NSSM_SET_RE.test(l))
  for (const line of lines) {
    if (REPO_SVC_ASSIGN_RE.test(line)) {
      for (const m of String(line).matchAll(REPO_NAME_TOKEN_RE)) assigned.add(m[1].toLowerCase())
    }
    const toks = [...String(line).matchAll(REPO_NAME_TOKEN_RE)].map((m) => m[1].toLowerCase())
    if (toks.length === 0) continue
    if (REPO_CREATE_VERB_RE.test(line)) for (const x of toks) create.add(x)
    else if (REPO_SERVICE_USE_VERB_RE.test(line)) for (const x of toks) use.add(x)
    if (REPO_NSSM_SET_RE.test(line)) for (const x of toks) set.add(x)
  }
  // 变量形态的装服脚本：`$svc = 'X'` + 本文件有对应动词 ⇒ 认成该动词的目标
  if (hasCreate) for (const x of assigned) create.add(x)
  if (hasUse) for (const x of assigned) use.add(x)
  if (hasSet) for (const x of assigned) set.add(x)
  return { create, use, set, hasCreate, hasUse, hasSet }
}

/** 一个服务名在仓内的来源面(建 > 用,同文件只归最先命中的那一档)。 */
export function detectRepoServiceSources(filesMap, serviceName) {
  const key = String(serviceName).toLowerCase()
  const create = []
  const use = []
  for (const [rel, content] of Object.entries(filesMap)) {
    const t = harvestRepoServiceTargets(content)
    if (t.create.has(key)) create.push(rel)
    else if (t.use.has(key)) use.push(rel)
  }
  return {
    create: create.sort(),
    use: use.sort(),
    nssmSet: detectRepoNssmRefs(filesMap, serviceName),
  }
}

/** 「只有改写、没有建」的命中面:nssm set 点名过、但整仓没有 create 动词。 */
export function detectRewriteOnlySources(sources) {
  return sources.nssmSet.filter((f) => !sources.create.includes(f))
}

export const REPO_SCAN_ROOTS = [
  'deploy/win',
  'deploy/scripts/prod-bundle',
  'monitoring/alertbridge',
]
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
      '本机 Windows 服务运行配置的入库真相源(票 G-584 归口)。射程 = 注册表 HKLM:\\SYSTEM\\CurrentControlSet\\Services 下名字匹配 ^(IHUI|Keycloak)$ 的服务;四键 application/appParameters/appDirectory/appStdout 仅 nssmManaged=true 时有值。秘密只存脱敏形态(前6***后2 (len=N)),原始凭据永不入仓。services[].provisioning 是**仓内侧**读数(建服源/使用源/通道/盘符无关模板),回答"这服务是谁建的";repoNameRoster + reverseGaps 是**反向面**(仓里点名而本机未装)。重建方式:node scripts/check-service-inventory.mjs --snapshot 重定向覆写本文件;不得手改单条。声明性的"缺建法"债住 scripts/data/service-provisioning-gaps.json(带 reviewBy,会到期),不在本文件里手抄。',
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    host: meta.host ?? hostname(),
    nssmBinaryPresent: meta.nssmBinaryPresent ?? false,
    comparisonBasis: '脱敏后逐字节等值;两侧同基准归一化',
    repoRoot: repoRootFacts(meta.repoRoot ?? ROOT),
    services: liveFacts.map((f) => {
      const refs = detectRepoNssmRefs(filesMap, f.name)
      const sources = detectRepoServiceSources(filesMap, f.name)
      return {
        ...f,
        referencedByRepoNssmScripts: refs.length > 0,
        repoNssmRefFiles: refs,
        provisioning: provisioningFacts(f, sources, meta.repoRoot ?? ROOT),
      }
    }),
    /** 反向面(仓里点名而本机未装)与名册来源:纯**仓内侧**读数，重生成才有效；
     *  对账时一律按当次仓内文件重算(见 classifyServiceFaces)，本段只作出处与审计快照。 */
    repoNameRoster: meta.roster
      ? {
          files: meta.roster.read ?? [],
          unreadable: meta.roster.unreadable ?? [],
          names: [...meta.roster.names.values()].map((e) => ({ name: e.name, in: e.rosterFiles })),
        }
      : { files: [], names: [], note: '本次未采集名册(--snapshot 才会带上)' },
    reverseGaps: meta.faceRows
      ? meta.faceRows
          .filter((r) => !r.installed)
          .map((r) => ({
            name: r.name,
            bucket: r.bucket,
            detail: r.detail,
            createSources: r.createSources,
            useSources: r.useSources,
            declaredGap: r.declaredGap,
          }))
      : [],
  }
}

/** 盘符是 §0 七类现读机器事实之一:入库件里凡是"仓根绝对路径"都存成
 *  `${REPO_ROOT}` 模板 + 一条当次实测的 repoRoot 读数,判据永远拿**当次**仓库根去比,
 *  绝不把某台机的 `D:\` / `G:\` 写成条件(票面"6 个服务钉死 D:\IHUI-AI"就是这么失效的)。 */
export const REPO_ROOT_TOKEN = '${REPO_ROOT}'

export function repoRootFacts(repoRoot) {
  const norm = String(repoRoot).replace(/[\\/]+$/, '')
  const m = /^([A-Za-z]:)/.exec(norm)
  return {
    live: norm,
    drive: m ? m[1].toUpperCase() : null,
    note: '当次实测的仓库根(§0 现读),只作本次对账输入,不作跨机判据',
  }
}

/** 服务命令行里的仓根绝对路径 → `${REPO_ROOT}` 模板(反斜杠 / 正斜杠 / file:/// 三形同归)。 */
export function toRepoRootTemplate(text, repoRoot) {
  if (text === null || text === undefined) return null
  const norm = String(repoRoot).replace(/[\\/]+$/, '')
  const variants = [...new Set([norm, norm.replace(/\\/g, '/')])].sort(
    (a, b) => b.length - a.length,
  )
  let out = String(text)
  for (const v of variants) out = out.split(v).join(REPO_ROOT_TOKEN)
  return out
}

/** imagePath 里指向本仓根之下的带盘符绝对路径枚数 —— 换盘符即全体起不来的暴露面。
 *  计数口径:先归一(分隔符/大小写)，再问"这个 token 是否落在当次仓库根之下";
 *  盘外的绝对路径(如 C:\\Users\\…\\node.exe)不随仓库迁移，不计入这一维。 */
const normPathKey = (p) =>
  String(p)
    .replace(/[\\/]+/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase()

/** 带盘符绝对路径的 token 正则(单一实现:bakedRepoPathHits 与自检共用，§0.6)。
 *  `(?<![A-Za-z0-9])` 是必需的 —— 少了它，`file:///G:/IHUI-AI/…` 会被从 `e:/` 处咬开
 *  (实测:同一串里真正落在仓根之下的两枚只数出 1 枚，盘符维读低)。 */
export const DRIVE_PATH_TOKEN_RE = /(?<![A-Za-z0-9])[A-Za-z]:[\\/][^"'`\s)]*/g

export function bakedRepoPathHits(text, repoRoot) {
  if (text === null || text === undefined) return 0
  const key = normPathKey(repoRoot)
  if (!key) return 0
  const tokens = String(text).match(DRIVE_PATH_TOKEN_RE) ?? []
  return tokens.filter((t) => normPathKey(t).startsWith(key)).length
}

/** 承载通道分类:cmd.exe /c 包装 = 手工 `sc create binPath=` / New-Service 的典型形;
 *  nssm 托管与裸二进制各成一档;解不出一律 unknown(不猜)。 */
export function classifyProvisioningChannel(imagePath) {
  const s = String(imagePath ?? '').trim()
  if (!s) return 'empty'
  if (/nssm(\.exe)?/i.test(s)) return 'nssm'
  if (/^cmd(?:\.exe)?\s+\/[ci]\b/i.test(s)) return 'scm-cmd-wrapper'
  if (/^[A-Za-z]:[\\/]/.test(s.replace(/^"/, ''))) return 'bare-binary'
  return 'unknown'
}

/** 仓内侧 + 本机侧合起来的一格"这服务怎么来的"。 */
export function provisioningFacts(fact, sources, repoRoot) {
  const rewriteOnly = (sources.create.length === 0 ? detectRewriteOnlySources(sources) : [])
  return {
    channel: classifyProvisioningChannel(fact.imagePath),
    imageTemplate: toRepoRootTemplate(fact.imagePath, repoRoot),
    bakedRepoPathHits: bakedRepoPathHits(fact.imagePath, repoRoot),
    repoCreateSources: sources.create,
    repoRewriteOnlySources: rewriteOnly,
    repoUseSources: sources.use,
    // 票面那一格的机读结论:装了、但仓里没有任何"建"的动作 ⇒ 换机无人能重建
    truthStatus: sources.create.length > 0 ? 'provisioned-in-repo' : 'no-repo-provisioning-source',
  }
}

/** 「只有改写、没有建」的命中面:nssm set 点名过、但整仓没有 create 动词。 */

/** 服务名册(反向缺口的分母)只认**结构化台账**里逐字等于服务名形态的取值:
 *  按 token 正则去扫 deploy/ 全文会把 `IHUI_WEB_PORT`(env 键)、`ihui-ai-svc`(容器名)、
 *  指标名、备份目录名全捞进来(实测 60 个文件里 60+ 个"候选名"),那把尺子判不了任何东西。 */
export const SERVICE_ROSTER_FILES = [
  'scripts/data/service-auto-restart.json',
  'scripts/data/expected-stopped-services.json',
  'scripts/data/service-definitions.json',
]
const SERVICE_NAME_VALUE_RE = /^(IHUI|Keycloak)(-[A-Za-z0-9]+)*$/i

export function collectServiceNamesFromJson(value, into = new Set()) {
  if (typeof value === 'string') {
    if (SERVICE_NAME_VALUE_RE.test(value.trim())) into.add(value.trim())
    return into
  }
  if (Array.isArray(value)) {
    for (const v of value) collectServiceNamesFromJson(v, into)
    return into
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectServiceNamesFromJson(v, into)
  }
  return into
}

/** 读名册:一本都读不到 ⇒ unjudged(不拿空名册冒充"仓里没点名"，§0.3)。 */
export function collectRosterNames(repoRoot = ROOT, files = SERVICE_ROSTER_FILES) {
  const names = new Map()
  const read = []
  const unreadable = []
  for (const rel of files) {
    let text
    try {
      text = readFileSync(path.join(repoRoot, rel), 'utf8')
    } catch {
      unreadable.push(rel)
      continue
    }
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      unreadable.push(`${rel}(JSON 解不开:${e.message})`)
      continue
    }
    read.push(rel)
    for (const n of collectServiceNamesFromJson(parsed)) {
      const k = n.toLowerCase()
      if (!names.has(k)) names.set(k, { name: n, rosterFiles: [] })
      if (!names.get(k).rosterFiles.includes(rel)) names.get(k).rosterFiles.push(rel)
    }
  }
  if (read.length === 0)
    return { status: 'unjudged', reason: `名册台账一本都没读到:${unreadable.join(' | ')}` }
  return { status: 'ok', names, read, unreadable }
}

/** 声明性"缺建法"债(唯一可手改的一页;到期即失效并重新点名，§0.7)。 */
export const GAPS_REL = 'scripts/data/service-provisioning-gaps.json'
export const GAPS_PATH = path.join(ROOT, 'scripts', 'data', 'service-provisioning-gaps.json')

/** 债账形态解析(纯函数:自检喂合成 JSON 即可，不必落盘夹具)。
 *  三要素缺一即**不构成豁免**(§0.7 验过才免):空 services / 日期形态坏 / 理由短于 10 字 ⇒ 进 malformed 点名，
 *  绝不静默收下;`gaps` 数组缺失 ⇒ 整本未判定(不拿"解得开但形状不对"当"没有欠")。 */
export function parseDeclaredGaps(text, nowIso) {
  let doc
  try {
    doc = JSON.parse(text)
  } catch (e) {
    return { status: 'unjudged', reason: `债账 JSON 解不开:${e.message}` }
  }
  if (!Array.isArray(doc?.gaps))
    return { status: 'unjudged', reason: '债账缺 gaps 数组(形态漂移，不猜)' }
  const today = String(nowIso).slice(0, 10)
  const byName = new Map()
  const malformed = []
  for (const g of doc.gaps) {
    const services = Array.isArray(g?.services) ? g.services : []
    const reviewBy = typeof g?.reviewBy === 'string' ? g.reviewBy : ''
    const reason = typeof g?.reason === 'string' ? g.reason : ''
    if (services.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(reviewBy) || reason.length < 10) {
      malformed.push(JSON.stringify(g).slice(0, 120))
      continue
    }
    for (const s of services) {
      byName.set(String(s).toLowerCase(), {
        ...g,
        services: [s],
        lapsed: reviewBy < today,
      })
    }
  }
  return { status: 'ok', byName, malformed, total: doc.gaps.length }
}

export function readDeclaredGaps(nowIso, filePath = GAPS_PATH) {
  let text
  try {
    text = readFileSync(filePath, 'utf8')
  } catch {
    return { status: 'unjudged', reason: `债账读不到:${GAPS_REL}(不拿"读不到"当"没有欠")` }
  }
  return parseDeclaredGaps(text, nowIso)
}

export const GAP_BUCKETS = {
  installedProvisioned: 'installed-provisioned',
  installedNoSource: 'installed-no-provisioning-source',
  notInstalledInstallable: 'not-installed-installable',
  notInstalledConsumerOnly: 'not-installed-consumer-only',
  notInstalledDeclared: 'not-installed-declared-elsewhere',
  ghost: 'ghost-reference',
}

/** 三面差集分类(纯函数):注册表实际面 ∧ 仓内名册面 ∧ 仓内动作面 ⇒ 每枚一个桶。
 *  红只开在两处:①在服而仓里零建法且**未登记债**(或债已到期);②名册点名、既没装、
 *  仓里既无建法又无消费点 = 幽灵引用。其余按桶报数——它们判的是机器现状(§12e)。 */
export function classifyServiceFaces({ liveNames, rosterNames, sourcesOf, gaps }) {
  const rows = []
  // rosterNames 允许两种形:裸名字符串 或 {name, rosterFiles}(幽灵点名要用出处)
  const roster = (rosterNames ?? []).map((e) =>
    typeof e === 'string' ? { name: e, rosterFiles: [] } : e,
  )
  const rosterByLower = new Map(roster.map((e) => [String(e.name).toLowerCase(), e]))
  const liveNames_ = liveNames ?? []
  const all = new Set([...liveNames_, ...roster.map((e) => e.name)])
  for (const name of [...all].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))) {
    const lower = name.toLowerCase()
    const installed = liveNames_.some((n) => String(n).toLowerCase() === lower)
    const rosterEntry = rosterByLower.get(lower)
    const rostered = Boolean(rosterEntry)
    const src = sourcesOf(name)
    const gap = gaps?.status === 'ok' ? gaps.byName.get(name.toLowerCase()) : undefined
    let bucket
    let red = false
    let detail
    if (installed && src.create.length > 0) {
      bucket = GAP_BUCKETS.installedProvisioned
      detail = `建服源 ${src.create.join(',')}`
    } else if (installed) {
      bucket = GAP_BUCKETS.installedNoSource
      detail = src.use.length
        ? `仓里只有使用点(${src.use.join(',')})，无建法`
        : '仓里既无建法也无使用动词点'
      if (!gap) red = true
      else if (gap.lapsed) {
        red = true
        detail += `；债已到期(reviewBy=${gap.reviewBy})`
      }
    } else if (src.create.length > 0) {
      bucket = GAP_BUCKETS.notInstalledInstallable
      detail = `本机没装；建服源 ${src.create.join(',')}${rostered ? '' : '(名册外)'}`
    } else if (src.use.length > 0) {
      bucket = GAP_BUCKETS.notInstalledConsumerOnly
      detail = `本机没装；仓里只有使用点(${src.use.join(',')}——属另一台承载机的服务，非幽灵引用)`
      if (!rostered) red = true
    } else {
      // 名册在册 ∧ 本机未装 ∧ 仓内零动作：已登记"属另一台承载机"⇒ 报数；未登记/已到期 ⇒ 幽灵引用(红)
      if (gap && !gap.lapsed) {
        bucket = GAP_BUCKETS.notInstalledDeclared
        detail = `本机没装；债账登记为「${gap.hostScope ?? '另一台承载机'}」(reviewBy=${gap.reviewBy})`
      } else {
        bucket = GAP_BUCKETS.ghost
        detail = rostered
          ? `名册点名(${(rosterEntry.rosterFiles ?? []).join(',') || '-'})，但本机未装、仓里无建法无使用动词点、债账也未登记`
          : '无归属(既不在名册、本机未装、仓里也无建法无使用点)'
        if (gap?.lapsed) detail += `；债已到期(reviewBy=${gap.reviewBy})`
        red = true
      }
    }
    if (installed && !rostered) detail += '；不在结构化名册内(建议补登)'
    rows.push({
      name,
      installed,
      rostered,
      bucket,
      red,
      detail,
      declaredGap: gap ? { reviewBy: gap.reviewBy, lapsed: gap.lapsed } : null,
      createSources: src.create,
      useSources: src.use,
    })
  }
  return rows
}


/** §0.8 出路闸(g35-s13 立，票 G-584 第三格)：
 *  一枚文件对某台**在册服务**只做 `nssm set`(改写)却没有建法，那它就必须**在自己正文里**
 *  声明"本脚本不负责建服务"，并把出路指向本清单的 provisioning 段。否则文档/清单留着一条
 *  跑不通的出路：本机 IHUI-API 连 Parameters 子键都没有(cmd.exe /c 包装的 SCM 直装形态)，
 *  照着那枚脚本走一遍只会撞在 nssm 上，而报错不提"这脚本本来就不建服务"。
 *  返回未声明的命中面 [{file, service}]；空 = 这一格合格。声明句是硬闸的文本凭据，
 *  闸本身在脚本里(Invoke-Enable 的 Resolve-ServiceTargetShape)，两者缺一不成立。 */
export const REWRITE_SCOPE_MARKER = '本脚本不负责建服务'
const REPO_NSSM_SET_RE = /nssm\s+set/i

export function findUndeclaredRewriteScopes(filesMap, rows) {
  const out = []
  for (const r of rows ?? []) {
    if (!r.installed) continue
    if (r.createSources.length > 0) continue
    const key = String(r.name).toLowerCase()
    for (const [rel, content] of Object.entries(filesMap)) {
      const t = harvestRepoServiceTargets(content)
      if (!t.set.has(key)) continue
      if (!String(content).includes(REWRITE_SCOPE_MARKER)) out.push({ file: rel, service: r.name })
    }
  }
  return out.sort((a, b) => (a.file < b.file ? -1 : 1))
}

/** 凭据形状自审(本席的凭据红线是**机器闸**，不是口头保证)。
 *  入库件与债账只许出现「键名 + 脱敏形态」;任何 `KEY=值` 且值不是 `前6***后2 (len=N)` 形态
 *  ⇒ 判红并**只回显键名与长度**(绝不回显值)。URL userinfo(user:pass@host)同型命中。
 *  输出里永远不出现被命中的那串值本身。 */
export const CRED_KEY_SHAPE_RE =
  /([A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|CREDENTIALS?|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|DATA_SOURCE|DATASOURCE|DSN)[A-Z0-9_]*)=([^\n]*)/gi
/** 脱敏形态的唯一合法形状:含 `***` 且以 ` (len=N)` 收尾(与 §5d / maskSecret 同形)。 */
export const MASKED_VALUE_RE = /\*\*\*.*\(len=\d+\)$|^\*\*\* \(len=\d+\)$/
const URL_USERINFO_SHAPE = /:\/\/[^\s/:@"'`]{1,64}:[^\s/@"'`]{1,256}@/g

export function auditCredentialShapes(text) {
  const violations = []
  const s = String(text ?? '')
  for (const m of s.matchAll(CRED_KEY_SHAPE_RE)) {
    const value = m[2].trim().replace(/["',]+$/, '')
    if (value === '' || value === 'null') continue
    if (MASKED_VALUE_RE.test(value)) continue
    violations.push({ key: m[1], shape: 'KEY=未脱敏值', length: value.length })
  }
  for (const m of s.matchAll(URL_USERINFO_SHAPE)) {
    violations.push({
      key: '(URL userinfo)',
      shape: 'scheme://user:pass@host',
      length: String(m[0]).length,
    })
  }
  return violations
}

/** 三面分类(注册表 ∧ 名册 ∧ 仓内动作)对入库件与债账一体自审;返回给 finish 的是计数与键名。 */
export function auditRepoArtifacts() {
  const out = []
  for (const rel of [INVENTORY_REL, GAPS_REL]) {
    let text
    try {
      text = readFileSync(path.join(ROOT, rel), 'utf8')
    } catch {
      out.push({ file: rel, unjudged: '读不到入库件，凭据自审未判定' })
      continue
    }
    out.push({ file: rel, violations: auditCredentialShapes(text) })
  }
  return out
}


export function compareInventory(inventory, liveFacts) {
  const verdicts = []
  const liveByName = new Map(liveFacts.map((f) => [f.name, f]))
  const invByName = new Map((inventory?.services ?? []).map((f) => [f.name, f]))
  for (const [name, live] of liveByName) {
    const inv = invByName.get(name)
    if (!inv) {
      verdicts.push({
        name,
        status: 'drift',
        fields: [{ key: '__presence__', expected: '(不在清单)', actual: '在注册表实际存在' }],
      })
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
    if (!liveByName.has(name))
      verdicts.push({
        name,
        status: 'drift',
        fields: [{ key: '__presence__', expected: '清单在册', actual: '注册表已无此服务键' }],
      })
  }
  return verdicts
}

const norm = (v) => (v === undefined ? null : v === null ? null : String(v))

function readLive() {
  if (process.platform !== 'win32')
    return { status: 'unjudged', reason: `非 win32 平台(${process.platform}),注册表通道不适用` }
  const ps = PS_CANDIDATES.find((c) => existsSync(c.bin))
  if (!ps)
    return {
      status: 'unjudged',
      reason:
        '两把 PowerShell 解释器候选都不在位(§5b:服务身份与交互账户 PATH 互不相通,故按绝对路径候选找)',
    }
  const r = spawnSync(
    ps.bin,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', buildSnapshotScript()],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: Number(process.env.IHUI_SVCINV_TIMEOUT_MS || 60_000),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  )
  if (r.error) return { status: 'unjudged', reason: `pwsh 派生失败:${r.error.message}` }
  if (r.status !== 0)
    return {
      status: 'unjudged',
      reason: `pwsh 枚举退出码 ${r.status},stderr 首行:${String(r.stderr || '').split(/\r?\n/)[0] || '(空)'}`,
    }
  return parseSnapshot(r.stdout)
}

/** 仓内侧(名册 ∧ 动作面)与注册表实际面的三面分类;返回 {rows, unjudged}。
 *  名册读不到 / 债账读不到 ⇒ 整维未判定:未判定绝不折成"没有缺口"，也绝不折成红(§0.3)。 */
export function faceClassify({ liveFacts, filesMap, roster, gaps }) {
  const unjudged = []
  if (roster.status !== 'ok')
    unjudged.push({ name: '(名册面)', reason: `结构化名册未判定:${roster.reason}` })
  if (gaps.status !== 'ok')
    unjudged.push({ name: '(债账面)', reason: `声明性缺建法债未判定:${gaps.reason}` })
  if (unjudged.length > 0) return { rows: [], unjudged }
  // 名册条目带出处(rosterFiles)，幽灵点名才指得出"是哪本台账在点这个名字"
  const rosterNames = [...roster.names.values()]
  const rows = classifyServiceFaces({
    liveNames: liveFacts.map((f) => f.name),
    rosterNames,
    sourcesOf: (n) => detectRepoServiceSources(filesMap, n),
    gaps,
  })
  if (rows.length === 0)
    unjudged.push({
      name: '(三面)',
      reason:
        '注册表实际面与结构化名册面同时枚举到 0 个服务——两面皆空即枚举失效，判死不记绿(§0.3)',
    })
  return { rows, unjudged }
}

export function bucketCounts(rows) {
  const c = {}
  for (const r of rows) c[r.bucket] = (c[r.bucket] ?? 0) + 1
  return c
}

export function runOnce({ json = false, nowIso = new Date().toISOString(), repoRoot = ROOT } = {}) {
  const live = readLive()
  if (live.status !== 'ok')
    return finish({
      unjudged: [{ name: '(整面)', reason: `注册表枚举通道未判定:${live.reason}` }],
      json,
    })
  if (!existsSync(INVENTORY_PATH))
    return finish({
      unjudged: [{ name: '(入库件)', reason: `清单文件读不到:${INVENTORY_REL}` }],
      json,
    })
  let inventory
  try {
    inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'))
  } catch (e) {
    return finish({
      unjudged: [{ name: '(入库件)', reason: `清单 JSON 解不开:${e.message}` }],
      json,
    })
  }
  const liveFacts = deriveLiveFacts(live)
  const filesMap = collectRepoScanFiles(repoRoot)
  const faces = faceClassify({
    liveFacts,
    filesMap,
    roster: collectRosterNames(repoRoot),
    gaps: readDeclaredGaps(nowIso),
  })
  const scopeReds = findUndeclaredRewriteScopes(filesMap, faces.rows)
  // 盘符维(§0 七类现读机器事实之三):服务命令行里钉死"当次仓根之下"的绝对路径枚数。
  // 只报数不判红——它是机器现状而非本次提交能改的东西(§12e);换盘符后必须重跑 --snapshot,
  // 否则注册表↔清单那一侧的 imagePath 比对会把它抓成 DRIFT(那一侧才是有牙的)。
  const driveBaked = liveFacts
    .map((f) => ({ name: f.name, hits: bakedRepoPathHits(f.imagePath, repoRoot) }))
    .filter((x) => x.hits > 0)
  // 凭据形状自审(入库件 + 债账):命中的只回显**键名与长度**，值绝不出面。
  const credAudits = auditRepoArtifacts()
  const credUnjudged = credAudits
    .filter((a) => a.unjudged)
    .map((a) => ({ name: `(${a.file})`, reason: a.unjudged }))
  const credReds = credAudits.flatMap((a) => (a.violations ?? []).map((v) => ({ file: a.file, ...v })))
  return finish({
    verdicts: compareInventory(inventory, liveFacts),
    faceRows: faces.rows,
    unjudged: faces.unjudged.concat(credUnjudged),
    scopeReds,
    credReds,
    driveBaked,
    drive: repoRootFacts(repoRoot).drive,
    json,
  })
}

function finish({
  verdicts = [],
  unjudged = [],
  faceRows = [],
  scopeReds = [],
  credReds = [],
  driveBaked = [],
  drive = null,
  json = false,
}) {
  let ok = 0
  let drift = 0
  for (const v of verdicts) {
    if (v.status === 'ok') ok++
    else if (v.status === 'drift') drift++
    else unjudged.push(v)
  }
  const faceRed = faceRows.filter((r) => r.red)
  const lines = []
  for (const v of verdicts) {
    if (v.status === 'drift') {
      lines.push(
        `DRIFT ${v.name}:` +
          v.fields
            .map((f) => ` ${f.key} [清单=${shorten(f.expected)} ↔ 实际=${shorten(f.actual)}]`)
            .join(';'),
      )
    }
  }
  for (const r of faceRed) lines.push(`FACE-RED ${r.name} [${r.bucket}] ${shorten(r.detail, 200)}`)
  for (const r of faceRows) {
    if (r.red) continue
    if (r.bucket === GAP_BUCKETS.installedProvisioned) continue
    lines.push(`FACE ${r.name} [${r.bucket}] ${shorten(r.detail, 200)}`)
  }
  for (const u of unjudged)
    lines.push(`UNJUDGED ${u.name || '(整面)'}: ${u.reason ?? '该维取不到输入'}`)
  for (const s of scopeReds)
    lines.push(
      `SCOPE-RED ${s.file} 对 ${s.service} 只做 nssm set(改写)却没有「${REWRITE_SCOPE_MARKER}」这句声明(§0.8 不许留跑不通的出路)`,
    )
  for (const b of driveBaked)
    lines.push(
      `DRIVE-BAKED ${b.name}: ${b.hits} 条钉在当次仓根(${drive ?? '盘符未判定'})之下的绝对路径(只报数;换盘符须 --snapshot 重生成，否则注册表↔清单的 imagePath 比对会判 DRIFT)`,
    )
  for (const c of credReds)
    lines.push(
      `CRED-SHAPE-RED ${c.file} 键名=${c.key} 形态=${c.shape} 值长=${c.length}(值本身一律不回显)——入库件只许「键名 + 前6***后2 (len=N)」`,
    )
  const exitCode =
    unjudged.length > 0
      ? 2
      : drift + faceRed.length + scopeReds.length + credReds.length > 0
        ? 1
        : 0
  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          ok,
          drift,
          unjudged: unjudged.length,
          verdicts,
          unjudgedReasons: unjudged,
          faceBuckets: bucketCounts(faceRows),
          faceRows,
          scopeReds,
          credReds,
          drive,
          driveBaked,
        },
        null,
        2,
      ) + '\n',
    )
  } else {
    for (const l of lines) process.stdout.write(l + '\n')
    if (faceRows.length > 0) {
      const counts = bucketCounts(faceRows)
      const parts = [
        `注册表在册 ${faceRows.filter((r) => r.installed).length}`,
        `结构化名册 ${faceRows.filter((r) => r.rostered).length}`,
      ]
      for (const [k, v] of Object.entries(counts).sort((a, b) => (a[0] < b[0] ? -1 : 1)))
        parts.push(`${k}=${v}`)
      process.stdout.write(`三面分桶: ${parts.join(' / ')}\n`)
    }
  }
  process.stdout.write(
    `OK=${ok} DRIFT=${drift} FACE-RED=${faceRed.length} UNJUDGED=${unjudged.length}${unjudged.length ? ' — 未判定不记绿也不冒红(§0.3)' : ''}\n`,
  )
  return exitCode
}

const shorten = (s, max = 120) =>
  s === null ? 'null' : String(s).replace(/\s+/g, ' ').slice(0, max)


// ---------------- self-test ----------------
export function selfTest() {
  const fails = []
  let ran = 0
  const t = (label, cond) => {
    ran++
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
    if (!opts.dropIhuiApi)
      lines.push(`S|IHUI-API|N|2|${B('cmd.exe /c "cd /d G:\\IHUI-AI"')}|${B('API')}`)
    if (opts.mutateImagePath)
      lines[lines.length - 1] = `S|IHUI-API|N|2|${B('cmd.exe /c "cd /d D:\\IHUI-AI"')}|${B('API')}`
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
  t(
    'ST5 非 nssm 四键同基准归 null',
    NSSM_KEYS.every((k) => api[k] === null),
  )
  t(
    'ST6 内联秘密脱敏(原值绝不出面)',
    !JSON.stringify(demo).includes('S3cretLongValue') && /前6|\*\*\*/.test(JSON.stringify(demo)),
  )
  const inv = buildInventoryObject(
    facts,
    {
      'deploy/win/install-demo-service.ps1':
        'nssm install IHUI-DEMO X\nnssm set IHUI-DEMO AppStdout Y',
      'deploy/win/other.ps1': 'IHUI-API 无关提及无 nssm 动词',
    },
    { generatedAt: 'T', host: 'H', nssmBinaryPresent: true },
  )
  t(
    'ST7 仓内 nssm 点名判定(动词+名字同文件)',
    inv.services.find((s) => s.name === 'IHUI-DEMO').referencedByRepoNssmScripts === true &&
      inv.services.find((s) => s.name === 'IHUI-API').referencedByRepoNssmScripts === false,
  )
  // 成对夹具:同面同数据 ⇒ ok;改一个字段 ⇒ drift(摘掉这一判就永远读不到漂移)
  const okV = compareInventory(inv, deriveLiveFacts(parsed))
  t('ST8 正控:清单↔实际同基准 ⇒ 全 ok', okV.length === 2 && okV.every((v) => v.status === 'ok'))
  const driftLive = deriveLiveFacts(parseSnapshot(mkText({ mutateImagePath: true })))
  const dV = compareInventory(inv, driftLive)
  const apiV = dV.find((v) => v.name === 'IHUI-API')
  t(
    'ST9 反控:imagePath 漂移必被点名(成对夹具的"红"半边)',
    apiV.status === 'drift' && apiV.fields.some((f) => f.key === 'imagePath'),
  )
  const dropOne = compareInventory(
    inv,
    driftLive.filter((f) => f.name !== 'IHUI-API'),
  )
  t(
    'ST10 清单在册而实际消失 ⇒ drift __presence__',
    dropOne.find((v) => v.name === 'IHUI-API')?.fields?.[0]?.key === '__presence__',
  )
  const extra = compareInventory({ services: [] }, deriveLiveFacts(parsed))
  t(
    'ST11 实际多出未入册 ⇒ drift(不用 0 冒充没有)',
    extra.length === 2 && extra.every((v) => v.status === 'drift'),
  )
  const red = redactValue('postgres://user:Sup3rSecretPassw0rd@h:5432/db token=abcdefghij12')
  t(
    'ST12 URL userinfo + k=v 双形态打码',
    !red.includes('Sup3rSecretPassw0rd') && !red.includes('abcdefghij12') && red.includes('len='),
  )
  t(
    'ST13 maskSecret 短值整体打码',
    maskSecret('abc') === '*** (len=3)' && maskSecret('1234567890').startsWith('123456***'),
  )
  // ---- P0 静默绿补丁(2026-10-30 g34-s4):枚举到 0 个候选判死不记绿 + 生产者脚本形状锁 ----
  // 立因:ST1–ST13 全部只喂**合成载荷**，从不派生 pwsh ⇒ 生产者(枚举脚本)整体失效时自检照样 13/13 绿，
  // 而 --snapshot 因"哨兵齐"exit 0 产出 services:[]。故新增两条互补牙:载荷面(0 候选必 unjudged)
  // 与脚本面(禁止裸 $n 内插)，并各配"改回去必翻红"的反向对照。
  const zeroMatch = parseSnapshot([SNAP_HEAD, 'T|300', SNAP_TAIL].join('\n'))
  t(
    'ST14 过滤器匹配 0 个(哨兵齐而载荷空)⇒ unjudged，绝不记绿(§0.3)',
    zeroMatch.status === 'unjudged' && zeroMatch.total === 300,
  )
  const zeroNoTotal = parseSnapshot([SNAP_HEAD, SNAP_TAIL].join('\n'))
  t(
    'ST15 0 服务且缺 T| 哨兵 ⇒ 同样 unjudged(不给"缺证据"留绿通道)',
    zeroNoTotal.status === 'unjudged',
  )
  const zeroHive = parseSnapshot([SNAP_HEAD, 'T|0', SNAP_TAIL].join('\n'))
  t(
    'ST16 hive 总数 0 ⇒ unjudged 并点名 hive',
    zeroHive.status === 'unjudged' && /hive/i.test(zeroHive.reason),
  )
  const prod = buildSnapshotScript()
  t(
    'ST17 生产者形状锁:枚举脚本除 foreach 目标与 .PSChildName 外不得再出现 $n(静默绿根因)',
    bareRegistryVarHits(prod) === 0 && prod.includes('$n.PSChildName'),
  )
  t(
    'ST18 反向对照:把路径内插改回裸 $n 则 ST17 必翻红(成对夹具的红半边)',
    bareRegistryVarHits('  $svc = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\$n"') === 1,
  )
  t(
    'ST19 载荷行同锁:S| 用裸 $n 必红、用 $key 必绿(服务名漂成全路径那一型)',
    bareRegistryVarHits('  "S|$n|$has|$st"') === 1 &&
      bareRegistryVarHits('  "S|$key|$has|$st"') === 0,
  )
  t(
    'ST20 正控:T| 行不算噪声，两服务面仍 ok 且带上总数',
    parseSnapshot([SNAP_HEAD, 'T|300', ...mkText().split('\n').slice(1)].join('\n')).status ===
      'ok',
  )

  // ---- 三面分类(g35-s13，票 G-584 第二/三格):建法面 ≠ 使用面;反向缺口逐枚定性 ----
  const faceFiles = {
    // 装具脚本用变量喂名字：`nssm install $svc` + `$svc = 'IHUI-DEPLOYLOOP'` ⇒ 必须认成建服源
    'deploy/win/install-deploy-loop-service.ps1':
      "# 本机其余任务(IHUI-MONITOR / IHUI-GIT-GUARD)本就全是 nssm 服务\n$svc = 'IHUI-DEPLOYLOOP'\n& $nssm install $svc $pwsh\n",
    // 只做改写、不建服务 ⇒ 使用面，绝不是建法面
    'deploy/win/ihui-enable-unattended-intake.ps1':
      "$ServiceName = 'IHUI-API'\nnssm set $ServiceName AppEnvironmentExtra K=V\n",
    'deploy/win/ihui-deploy.ps1': "$routerSvc = Get-Service -Name 'IHUI-API-ROUTER'\n",
    'deploy/win/only-docs.md': 'IHUI-GHOST-SVC 只在文档里被提了一句，没有任何动词',
  }
  const srcDeployloop = detectRepoServiceSources(faceFiles, 'IHUI-DEPLOYLOOP')
  t(
    'ST21 变量形态装具($svc = 名 + nssm install $svc)认成建服源',
    srcDeployloop.create.join() === 'deploy/win/install-deploy-loop-service.ps1',
  )
  t(
    'ST22 反控:同文件注释里顺手列的 IHUI-GIT-GUARD 不得被认成它建的(整文件共现那一坑)',
    detectRepoServiceSources(faceFiles, 'IHUI-GIT-GUARD').create.length === 0 &&
      detectRepoServiceSources(faceFiles, 'IHUI-GIT-GUARD').use.length === 0,
  )
  const srcApi = detectRepoServiceSources(faceFiles, 'IHUI-API')
  t(
    'ST23 nssm set 只算使用面:IHUI-API 有使用点而无建法',
    srcApi.create.length === 0 &&
      srcApi.use.includes('deploy/win/ihui-enable-unattended-intake.ps1'),
  )
  t(
    'ST24 改写-only 命中面(nssmSet 减建法)正是票面点名的结构跑不通那一格',
    detectRewriteOnlySources(srcApi).join() === 'deploy/win/ihui-enable-unattended-intake.ps1' &&
      detectRewriteOnlySources(srcDeployloop).length === 0,
  )
  const mkGaps = (reviewBy, extra = []) =>
    parseDeclaredGaps(
      JSON.stringify({
        gaps: [
          {
            services: ['IHUI-API', 'IHUI-WEB'],
            reason: '本机手工 SCM 直装，仓里无建法(测试夹具说明)',
            reviewBy,
          },
          ...extra,
        ],
      }),
      '2026-10-30T00:00:00Z',
    )
  const faceBase = {
    liveNames: ['IHUI-API', 'IHUI-DEPLOYLOOP', 'IHUI-WEB'],
    rosterNames: [
      { name: 'IHUI-API', rosterFiles: ['x.json'] },
      { name: 'IHUI-DEPLOYLOOP', rosterFiles: ['x.json'] },
      { name: 'IHUI-API-ROUTER', rosterFiles: ['x.json'] },
      { name: 'IHUI-GHOST-SVC', rosterFiles: ['x.json'] },
    ],
    sourcesOf: (n) => detectRepoServiceSources(faceFiles, n),
  }
  const rowsDeclared = classifyServiceFaces({ ...faceBase, gaps: mkGaps('2099-01-01') })
  const by = (n) => rowsDeclared.find((r) => r.name === n)
  t(
    'ST25 在服+有建法 ⇒ installed-provisioned 且不红',
    by('IHUI-DEPLOYLOOP').bucket === GAP_BUCKETS.installedProvisioned &&
      by('IHUI-DEPLOYLOOP').red === false,
  )
  t(
    'ST26 在服+无建法+债在册(未到期) ⇒ 报数不红',
    by('IHUI-API').bucket === GAP_BUCKETS.installedNoSource && by('IHUI-API').red === false,
  )
  const rowsNoDebt = classifyServiceFaces({
    ...faceBase,
    gaps: parseDeclaredGaps(JSON.stringify({ gaps: [] }), '2026-10-30T00:00:00Z'),
  })
  t(
    'ST27 反向对照:同一枚服务没有债登记 ⇒ 必红(摘掉豁免即翻红，豁免不是消红通道)',
    rowsNoDebt.find((r) => r.name === 'IHUI-API').red === true,
  )
  const rowsLapsed = classifyServiceFaces({ ...faceBase, gaps: mkGaps('2020-01-01') })
  t(
    'ST28 债到期即失效并重新点名(reviewBy 是真到期不是装饰)',
    rowsLapsed.find((r) => r.name === 'IHUI-API').red === true &&
      /到期/.test(rowsLapsed.find((r) => r.name === 'IHUI-API').detail),
  )
  t(
    'ST29 本机没装但有使用点 ⇒ 判"另一台承载机"，不是幽灵引用',
    by('IHUI-API-ROUTER').bucket === GAP_BUCKETS.notInstalledConsumerOnly &&
      by('IHUI-API-ROUTER').red === false,
  )
  t(
    'ST30 名册点名而仓内零动作零安装 ⇒ ghost-reference 必红(成对夹具的红半边)',
    by('IHUI-GHOST-SVC').bucket === GAP_BUCKETS.ghost && by('IHUI-GHOST-SVC').red === true,
  )
  t(
    'ST31 反向对照:把使用点证据抹掉，ROUTER 那一枚也落进 ghost ⇒ 分桶确有牙',
    classifyServiceFaces({
      ...faceBase,
      rosterNames: [{ name: 'IHUI-API-ROUTER', rosterFiles: ['x.json'] }],
      liveNames: [],
      sourcesOf: () => ({ create: [], use: [], nssmSet: [] }),
      gaps: mkGaps('2099-01-01'),
    }).find((r) => r.name === 'IHUI-API-ROUTER').red === true,
  )
  t(
    'ST32 债账三要素缺一即不构成豁免:缺日期/理由过短/空 services 全进 malformed',
    (() => {
      const g = parseDeclaredGaps(
        JSON.stringify({
          gaps: [
            { services: ['A'], reason: '理由够长了这里是一句定向说明', reviewBy: '2026-13-99X' },
            { services: ['B'], reason: '太短', reviewBy: '2027-01-01' },
            { services: [], reason: '理由够长了这里是一句定向说明', reviewBy: '2027-01-01' },
          ],
        }),
        '2026-10-30T00:00:00Z',
      )
      return g.status === 'ok' && g.malformed.length === 3 && g.byName.size === 0
    })(),
  )
  t(
    'ST33 债账缺 gaps 数组 ⇒ 整本未判定(不拿"解得开但形状不对"当"没有欠")',
    parseDeclaredGaps(JSON.stringify({ nope: 1 }), '2026-10-30T00:00:00Z').status === 'unjudged' &&
      parseDeclaredGaps('{ broken', '2026-10-30T00:00:00Z').status === 'unjudged',
  )
  const faceUnjudged = faceClassify({
    liveFacts: deriveLiveFacts(parseSnapshot(mkText())),
    filesMap: faceFiles,
    repoRoot: 'G:\\IHUI-AI',
    nowIso: '2026-10-30T00:00:00Z',
    roster: { status: 'unjudged', reason: '夹具:名册读不到' },
    gaps: { status: 'unjudged', reason: '夹具:债账读不到' },
  })
  t(
    'ST34 名册/债账读不到 ⇒ 三面维整维未判定，rows 空且点名两条(不冒红也不记绿)',
    faceUnjudged.rows.length === 0 && faceUnjudged.unjudged.length === 2,
  )
  t(
    'ST35 名册一本都读不到 ⇒ collectRosterNames 落未判定(不拿空名册当"仓里没点名")',
    collectRosterNames(ROOT, ['scripts/data/does-not-exist.json']).status === 'unjudged',
  )
  t(
    'ST36 名册只认结构化整值:env 键 IHUI_WEB_PORT / 容器名 ihui-ai-svc / 散文里的 IHUI-API 全不算点名',
    (() => {
      const s = collectServiceNamesFromJson({
        envKey: 'IHUI_WEB_PORT',
        prose: '重启 IHUI-API 之前先看容器 ihui-ai-svc',
        service: 'IHUI-API-GREEN',
        list: ['ihui-alert-bridge', 'Keycloak', 'IHUI-AI'],
      })
      return (
        [...s].sort().join(',') === 'IHUI-AI,IHUI-API-GREEN,Keycloak,ihui-alert-bridge' &&
        !s.has('IHUI_WEB_PORT')
      )
    })(),
  )
  t(
    'ST37 盘符模板归一:反斜杠/正斜杠/file:/// 三形同归 ${REPO_ROOT}，判据里不留任何盘符',
    (() => {
      const root = 'G:\\IHUI-AI'
      const tpl = toRepoRootTemplate(
        'cd /d G:\\IHUI-AI\\apps\\api && import file:///G:/IHUI-AI/node_modules/x.mjs',
        root,
      )
      return (
        tpl.includes(REPO_ROOT_TOKEN) &&
        !/(?<![A-Za-z0-9])[A-Za-z]:[\\/]/.test(tpl) &&
        tpl.split(REPO_ROOT_TOKEN).length === 3
      )
    })(),
  )
  t(
    'ST38 bakedRepoPathHits 只数落在当次仓根之下的路径(盘外路径不算、换盘符即读 0)',
    (() => {
      const root = 'G:\\IHUI-AI'
      const s = 'cd /d G:\\IHUI-AI\\apps\\api && C:\\Users\\x\\node.exe --import file:///G:/IHUI-AI/n/mjs'
      return (
        bakedRepoPathHits(s, root) === 2 &&
        bakedRepoPathHits(s, 'D:\\IHUI-AI') === 0 &&
        bakedRepoPathHits(null, root) === 0
      )
    })(),
  )
  t(
    'ST39 承载通道分类:cmd.exe /c 包装 / nssm / 裸 exe 三档分开，解不出落 unknown',
    classifyProvisioningChannel('cmd.exe /c "cd /d G:\\x"') === 'scm-cmd-wrapper' &&
      classifyProvisioningChannel('C:\\windows\\system32\\nssm.exe') === 'nssm' &&
      classifyProvisioningChannel('G:\\node.exe src/index.ts') === 'bare-binary' &&
      classifyProvisioningChannel('') === 'empty' &&
      classifyProvisioningChannel('msedge://weird') === 'unknown',
  )
  t(
    'ST40 入库对象带 provisioning 与名册出处；truthStatus 对"装了但没人建"那一格给出机读结论',
    (() => {
      const facts = deriveLiveFacts(parseSnapshot(mkText()))
      const inv = buildInventoryObject(facts, faceFiles, {
        generatedAt: 'T',
        host: 'H',
        repoRoot: 'G:\\IHUI-AI',
        roster: {
          names: new Map([['ihui-api', { name: 'IHUI-API', rosterFiles: ['x.json'] }]]),
          read: ['x.json'],
          unreadable: [],
        },
        faceRows: [
          { name: 'IHUI-API', installed: true, bucket: 'b', detail: 'd', createSources: [], useSources: [] },
        ],
      })
      const api = inv.services.find((s) => s.name === 'IHUI-API')
      return (
        api.provisioning.truthStatus === 'no-repo-provisioning-source' &&
        api.provisioning.repoCreateSources.length === 0 &&
        api.provisioning.imageTemplate.includes(REPO_ROOT_TOKEN) === true &&
        inv.repoNameRoster.names[0].in.join() === 'x.json' &&
        inv.reverseGaps.length === 0
      )
    })(),
  )
  t(
    'ST41 名册在册而仓内零动作:债账登记"属另一台承载机"⇒ 换桶不红；到期或撤登记⇒ 立刻回红',
    (() => {
      const declared = classifyServiceFaces({
        liveNames: [],
        rosterNames: [{ name: 'IHUI-GHOST-SVC', rosterFiles: ['x.json'] }],
        sourcesOf: () => ({ create: [], use: [], nssmSet: [] }),
        gaps: parseDeclaredGaps(
          JSON.stringify({
            gaps: [
              {
                services: ['IHUI-GHOST-SVC'],
                hostScope: '监控承载机(非本机)',
                reason: '名册在册而本机未装，仓里既无建法也无消费点(夹具)',
                reviewBy: '2099-01-01',
              },
            ],
          }),
          '2026-10-30T00:00:00Z',
        ),
      })[0]
      const lapsed = classifyServiceFaces({
        liveNames: [],
        rosterNames: [{ name: 'IHUI-GHOST-SVC', rosterFiles: ['x.json'] }],
        sourcesOf: () => ({ create: [], use: [], nssmSet: [] }),
        gaps: parseDeclaredGaps(
          JSON.stringify({
            gaps: [
              {
                services: ['IHUI-GHOST-SVC'],
                reason: '名册在册而本机未装，仓里既无建法也无消费点(夹具)',
                reviewBy: '2020-01-01',
              },
            ],
          }),
          '2026-10-30T00:00:00Z',
        ),
      })[0]
      return (
        declared.bucket === GAP_BUCKETS.notInstalledDeclared &&
        declared.red === false &&
        /监控承载机/.test(declared.detail) &&
        lapsed.bucket === GAP_BUCKETS.ghost &&
        lapsed.red === true
      )
    })(),
  )
  t(
    'ST42 射程纪律:测试夹具里的 "New-Service"/"nssm install" 不得被当成建服真相源',
    // 立因:实测把 scripts/ 整目录加进 REPO_SCAN_ROOTS 后，scripts/tests/*.test.mjs 的
    // 夹具行(同一行既写动词又写服务名)会把 IHUI-API 读成"仓里有建法"⇒ 假绿。
    // 射程只允许承载"真会跑的东西"的目录，夹具不在其内。
    !REPO_SCAN_ROOTS.includes('scripts') &&
      REPO_SCAN_ROOTS.every((r) => /^(deploy|monitoring)\b/.test(r)),
  )
  t(
    'ST43 名册出处进 ghost 点名:未登记的幽灵必须带着"是哪本台账在点它"出来',
    (() => {
      const r = classifyServiceFaces({
        liveNames: [],
        rosterNames: [
          { name: 'IHUI-GHOST-SVC', rosterFiles: ['scripts/data/service-auto-restart.json'] },
        ],
        sourcesOf: () => ({ create: [], use: [], nssmSet: [] }),
        gaps: parseDeclaredGaps('{"gaps":[]}', '2026-10-30T00:00:00Z'),
      })[0]
      return r.red === true && /service-auto-restart\.json/.test(r.detail)
    })(),
  )
  // ---- ST44/ST45:§0.8 出路闸(改写-only 的那枚文件必须自述"不建服务") ----
  const intakeWithDecl =
    "$ServiceName = 'IHUI-API'\nnssm set $ServiceName AppEnvironmentExtra K=V\n# 本脚本不负责建服务\n"
  const intakeWithoutDecl = "$ServiceName = 'IHUI-API'\nnssm set $ServiceName AppEnvironmentExtra K=V\n"
  const rowsForScope = [
    { name: 'IHUI-API', installed: true, createSources: [], useSources: ['a.ps1'] },
  ]
  t(
    'ST44 改写-only 且未声明射程 ⇒ SCOPE 命中(出路必须写在脚本里，不写在注释堆里)',
    findUndeclaredRewriteScopes({ 'a.ps1': intakeWithoutDecl }, rowsForScope).length === 1 &&
      findUndeclaredRewriteScopes({ 'a.ps1': intakeWithoutDecl }, rowsForScope)[0].file === 'a.ps1',
  )
  t(
    'ST45 反向对照:补上声明句即清(同数据同面，摘掉声明必回红);有建法的在册服务不走这一闸',
    findUndeclaredRewriteScopes({ 'a.ps1': intakeWithDecl }, rowsForScope).length === 0 &&
      findUndeclaredRewriteScopes(
        { 'a.ps1': intakeWithoutDecl },
        [{ name: 'IHUI-API', installed: true, createSources: ['b.ps1'], useSources: ['a.ps1'] }],
      ).length === 0 &&
      findUndeclaredRewriteScopes(
        { 'a.ps1': "$x = 'IHUI-WEB'\nGet-Service $x\n" },
        [{ name: 'IHUI-WEB', installed: true, createSources: [], useSources: ['a.ps1'] }],
      ).length === 0,
  )
  t(
    'ST46 装具脚本的变量喂名形态必须被认成建法($svc = 名 + nssm install $svc 分行)',
    (() => {
      const t2 = harvestRepoServiceTargets("$svc = 'IHUI-DEPLOYLOOP'\n& $nssm install $svc $pwsh\n")
      return t2.create.has('ihui-deployloop') && !t2.create.has('ihui-monitor')
    })(),
  )
  // ---- 凭据红线(密钥不入仓)做成正反对照的机器闸 ----
  t(
    'ST47 凭据自审:KEY=裸值 与 URL userinfo 双双命中，且回显里不含值的任何片段',
    (() => {
      const v = auditCredentialShapes(
        'IHUI_ADMIN_PASSWORD=Sup3rLongClearValue\nDATA_SOURCE_NAME=postgres://u:An0therClearPass@h:5432/db\n'
      )
      const echoed = JSON.stringify(v)
      return (
        v.length === 3 &&
        v[0].key === 'IHUI_ADMIN_PASSWORD' &&
        !echoed.includes('Sup3rLongClearValue') &&
        !echoed.includes('An0therClearPass') &&
        v.some((x) => x.key === '(URL userinfo)')
      )
    })(),
  )
  t(
    'ST48 反向对照:已按 前6***后2 (len=N) 打码的键(含 JSON 收尾引号/逗号)不得误判',
    (() => {
      const v = auditCredentialShapes(
        '"appParameters": "IHUI_ADMIN_PASSWORD=Sup3rS***rd (len=40)",\n"dsn": "mysql://u:Ab1234***yz (len=30)@h/db"\n'
      )
      return v.length === 0
    })(),
  )
  t(
    'ST49 空值/null 不算秘密(结构对账不需要值，也不许把空键报成泄漏)',
    auditCredentialShapes('API_KEY=\nOTHER_TOKEN=null\n').length === 0
  )
  return { fails, ran }
}

function snapshotToStdout() {
  const nowIso = new Date().toISOString()
  const live = readLive()
  if (live.status !== 'ok') {
    process.stderr.write(`UNJUDGED:注册表枚举通道未判定:${live.reason}(§0.3 不以空清单冒充现读)\n`)
    return 2
  }
  const nssmPresent = existsSync('C:\\Windows\\System32\\nssm.exe')
  const liveFacts = deriveLiveFacts(live)
  const filesMap = collectRepoScanFiles()
  const roster = collectRosterNames()
  const gaps = readDeclaredGaps(nowIso)
  const faces = faceClassify({
    liveFacts,
    filesMap,
    nowIso,
    roster: roster.status === 'ok' ? roster : { status: 'unjudged', reason: roster.reason },
    gaps: gaps.status === 'ok' ? gaps : { status: 'unjudged', reason: gaps.reason },
  })
  for (const u of faces.unjudged)
    process.stderr.write(`未判定(不影响清单，只影响本次三面分类):${u.reason}\n`)
  const obj = buildInventoryObject(liveFacts, filesMap, {
    nssmBinaryPresent: nssmPresent,
    roster: roster.status === 'ok' ? roster : null,
    faceRows: faces.rows.length > 0 ? faces.rows : null,
  })
  const json = JSON.stringify(obj, null, 2)
  // 生产者侧硬闸:脱敏没做干净就不许出货(只回显键名与长度，值本身绝不上屏)。
  const leaks = auditCredentialShapes(json)
  if (leaks.length > 0) {
    for (const v of leaks)
      process.stderr.write(
        `CRED-SHAPE-REFUSED 键名=${v.key} 形态=${v.shape} 值长=${v.length}(值不回显)——拒绝输出清单\n`,
      )
    return 2
  }
  process.stdout.write(json + '\n')
  return 0
}

function mainCli(argv) {
  if (argv.includes('--self-test')) {
    const { fails, ran } = selfTest()
    for (const f of fails) process.stdout.write(`FAIL ${f}\n`)
    process.stdout.write(
      fails.length === 0
        ? `SELF-TEST PASS ${ran}/${ran}\n`
        : `SELF-TEST FAIL ${fails.length}/${ran}\n`,
    )
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
  bareRegistryVarHits,
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
