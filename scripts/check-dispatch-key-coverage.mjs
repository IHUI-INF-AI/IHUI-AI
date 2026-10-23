// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ============================================================
// 派发契约键集对账(**常设只读审计器,禁止接进提交链**)
// ============================================================
//
// 收的是哪一族(2026-10-21 一天之内实测四枚,全同型):
//   ① `bumpProbeStreak` 的 info 不带 `firstAt`,派发侧 `Date.parse(st.firstAt)` ⇒ NaN ⇒
//      "已持续多久"那一档冻死 ⇒ 16 轮确认故障只寄出 1 封信;
//   ② `check-public-path-probe` 的 results 不带 `stat`,派发侧 `r?.stat || {}` ⇒
//      严重度档恒 0 ⇒ "恶化到断流级即重报"结构上打不到;
//   ③ `--stall-only --json` 不带 `lastSuccessFrom`,到人邮件正文那句"取自哪一份日志"恒不出现;
//   ④ 派发侧读 `c.recentWrites ?? c.probeHits`,而生产方那把尺子只有 `writing` ⇒ 一条证据支永哑。
// 共同点:**消费方按可选键取值并给一个静默默认** ⇒ 不抛错、不判红、不记账,只是那一维从此量不到。
//
// 判据(两条,都可机器判):
//  A. `CONTRACTS` 里声明的每一个读键,必须在该生产者**真跑一次**的 JSON 出口里出现
//     (递归收集键名,故嵌套在 results 值里的 `stat`/`leg` 也算量到)。跑不到出口 ⇒ 未判定,不记绿。
//  B. 声明面不许缩水:每个生产者的声明键数不得低于 `FLOOR`(现读当时值)。
//     删一条声明 = 一次有意的判断,必须写进 diff 并显式改 FLOOR,不许静默把锁拆小。
//
// **本尺子的边界(明写,不装)**:
//  ① 它**不发现新读键**。派发侧新加一个 `parsed.foo` 而没登记进 CONTRACTS,这里不会红 ——
//     那需要跨"helper 返回 { parsed } → 调用方各起别名"的数据流分析,我试过用启发式抽
//     (按函数体扫 `parsed.X`),18 格里静默跳掉 6 格却报"覆盖齐全",那是假绿,比没有更贵。
//     发现新读键仍靠人 + 两把按消费方正文现读的镜像测试
//     (`check-credential-health.test.mjs` T15、`audit-temp-landing.test.mjs` T1b)。
//  ② 只量**顶层与嵌套对象**的键名,**数组元素内**的字段不在射程(如 `hits[].path`:
//     本轮 hits 为空 ⇒ 该键永不出现,拿它当声明键会假红 —— 2026-10-21 实测咬到我自己的清单一次)。
//     元素内字段的形状由各自的镜像夹具钉(如 `check-orphan-deletion-refs` 的门内自检),不在这把尺子上。
// 本尺子守的是:**已登记的键别再悄悄消失**(今天那四枚全是这一型)。
//
// 为什么**不许**接提交链/巡检轮:它要真起 16 个子进程,若干依赖运行时(netstat / metrics 端点 /
// 磁盘扫描 / 注册表 / 公网探测),在非部署机上恒"未判定"—— 挂 blocking 就是 §12e 的恒红门。
// 同档先例:`verify-panel-data.mjs`、`check-miniapp-css-landing.mjs` 都因依赖运行时被排除在提交门外。
//
// 三态(§0.3):0 齐全 / 1 有声明键没量到 / 2 未判定(跑不到出口、或一个生产者都没派上)。
// 用法:node scripts/check-dispatch-key-coverage.mjs [--verbose] [--self-test] [--timeout-ms=N]

import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// G-322:带值旗标的**唯一取值出口**(值必须存在且不以 `-` 开头,否则判死,绝不折回默认)。
import { requireFlagValue } from './lib/flag-value.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 读键清单是 2026-10-21 逐格人工核出来的(每格都真跑过生产者,并对过派发侧源码):
 * `keys` = 消费方从这份 JSON 里取的键(含嵌套);`conditional` = 只在某条分支出口、
 * 必须附**可复核源码位置**才算登记(裸豁免 = 制造死角)。
 */
export const CONTRACTS = [
  { producer: 'scripts/check-host-timezone.mjs', args: ['--json'], consumer: 'auditHostTimezone', keys: ['verdict', 'reasons', 'declared', 'changedAt', 'measured', 'h1', 'h2', 'h3', 'h4', 'undeterminedCount', 'naiveStampDefaultOffset'] },
  { producer: 'scripts/check-disk-root-hygiene.mjs', args: ['--json'], consumer: 'auditDiskRootHygiene', keys: ['verdict', 'counts', 'violations', 'undetermined', 'notApplicable', 'diskRootStray', 'worktreeOutside'] },
  { producer: 'scripts/check-ops-patrol.mjs', args: ['--json'], consumer: 'auditOpsPatrol / watchPatrolHeartbeat', keys: ['at', 'devEnv', 'counts', 'rc', 'findings', 'undetermined', 'ok', 'adjudicated', 'rotten'] },
  { producer: 'scripts/check-public-path-probe.mjs', args: ['--burst', '--json'], consumer: 'auditPublicPathProbe', keys: ['rc', 'at', 'results', 'control', 'split', 'swapEvents', 'ledger', 'positiveControlRan', 'verdict', 'reasons', 'numbers', 'leg', 'stat'] },
  { producer: 'scripts/check-tunnel-leg-health.mjs', args: ['--json'], consumer: 'auditTunnelLegHealth', keys: ['legs', 'dims', 'positiveControl', 'edgeLocations', 'netshV4Probe', 'failedCollectSources', 'exitCode', 'evidenceAt', 'pids', 'v4AddressCount', 'metricsPort', 'tool'] },
  { producer: 'scripts/check-credential-health.mjs', args: ['--stall-only', '--json'], consumer: 'auditDeployStall', keys: ['at', 'liveSha', 'tipSha', 'tipSource', 'lastSuccessIso', 'lastSuccessFrom', 'lastSuccessFromClause', 'thresholdMin', 'level', 'why', 'behindHours', 'inFlight', 'missingInputs', 'diag'] },
  { producer: 'scripts/check-orphan-deletion-refs.mjs', args: ['--json'], consumer: 'auditOrphanDeletionRefs', keys: ['hits', 'undetermined', 'deleted', 'candidates'] },
  { producer: 'scripts/record-tunnel-metrics.mjs', args: ['--json'], consumer: 'recordTunnelMetrics 那一格', keys: ['ok', 'ledger', 'pops', 'previousPops', 'haConnections', 'totalRequests', 'requestErrors', 'diff', 'concurrent', 'rpcFailures', 'originConnectAvgMs', 'processStartSeconds', 'responseByCode', 'port', 'pids', 'at'], conditional: [{ key: 'reason', evidence: 'record-tunnel-metrics.mjs:158/160/162/164/170/173 六条 `return { ok:false, reason:… }`;派发侧只在 `parsed.ok !== true` 那一支读它(git-guardian.mjs:4068)' }] },
  { producer: 'scripts/check-temp-landing.mjs', args: ['--json'], consumer: 'auditTempLanding', keys: ['verdict', 'tiers', 'live', 'scrubber', 'probes', 'counts', 'grading', 'configPath', 'drift', 'undetermined', 'writing'] },
  { producer: 'scripts/heal-worktree-tracked.mjs', args: ['--json', '--dry-run'], consumer: 'healWorktreeTracked 那一格', keys: ['restored', 'held', 'reconciled', 'orphanIndex', 'paths', 'intentLost', 'intentLostPaths', 'layerSkips'] },
  { producer: 'scripts/check-env-drift.mjs', args: ['--json'], consumer: 'auditEnvDrift', keys: ['exit', 'counts', 'verdicts', 'backupDir', 'face', 'state', 'id', 'drift', 'backup'] },
  { producer: 'scripts/check-baseline-freshness.mjs', args: ['--json'], consumer: 'reportBaselineFreshness', keys: ['code', 'lines', 'axes', 'measured', 'upstream'] },
  // 服务自愈动作器 ⇒ 派发侧 `healUnresponsiveServices`。这一格是 2026-10-21 那两封"该响没响"
  // 之后补的:封顶(`window-capped`)与名单外故障(`not-in-list`)两个终态都由**逐台决策**承载,
  // 而决策住在 `actions` 不是 `results` —— 派发侧一旦抄错集合,读到的就是恒空,铃永远不响。
  // `ackState` 走 conditional:它只在"名单外且真坏了"时才出口(今天命中 IHUI-OLLAMA);
  // 那台一旦被摘掉,这一键就该从出口里消失,不得让它把审计读成"清单腐烂"。
  {
    producer: 'scripts/heal-unresponsive-services.mjs',
    args: ['--json'],
    consumer: 'healUnresponsiveServices',
    keys: ['at', 'apply', 'counts', 'actions', 'results', 'name', 'kind', 'why', 'checked', 'answering', 'planned', 'restarted', 'failed', 'watch', 'cooldown', 'capped', 'undetermined', 'offlist', 'offlistAnswering', 'offlistUndetermined', 'offlistUnregistered', 'offlistAckExpired'],
    conditional: [{ key: 'ackState', evidence: 'heal-unresponsive-services.mjs 的 decideRound `!entry` 分支只在 verdict∈{down,silent} 时给 ackState;派发侧 git-guardian.mjs 的 alertTerminalHeld(名单外)按它分三档出路' }],
  },
]

/** 声明面下限(2026-10-21 现读)。要降它必须连着说明"为什么这一格不再需要",写进 diff。 */
export const FLOOR = { 'scripts/check-host-timezone.mjs': 11, 'scripts/check-disk-root-hygiene.mjs': 7, 'scripts/check-ops-patrol.mjs': 9, 'scripts/check-public-path-probe.mjs': 13, 'scripts/check-tunnel-leg-health.mjs': 12, 'scripts/check-credential-health.mjs': 14, 'scripts/check-orphan-deletion-refs.mjs': 4, 'scripts/record-tunnel-metrics.mjs': 16, 'scripts/check-temp-landing.mjs': 11, 'scripts/heal-worktree-tracked.mjs': 8, 'scripts/check-env-drift.mjs': 9, 'scripts/check-baseline-freshness.mjs': 5, 'scripts/heal-unresponsive-services.mjs': 22 }

/** 递归收集一份 JSON 里出现过的所有键名。 */
export function allKeys(j, out = new Set()) {
  if (Array.isArray(j)) { for (const v of j) allKeys(v, out); return out }
  if (!j || typeof j !== 'object') return out
  for (const [k, v] of Object.entries(j)) { out.add(k); allKeys(v, out) }
  return out
}

/** 从可能带噪声的 stdout 里取第一个配平的 JSON 对象。 */
export function parseJsonLoose(text) {
  const t = String(text || '').trim()
  if (!t) return null
  try { return JSON.parse(t) } catch { /* 往下试截取 */ }
  const start = t.indexOf('{')
  if (start < 0) return null
  let depth = 0, quote = null
  for (let i = start; i < t.length; i++) {
    const ch = t[i]
    if (quote) { if (ch === '\\') { i++; continue } if (ch === quote) quote = null; continue }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue }
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(t.slice(start, i + 1)) } catch { return null } } }
  }
  return null
}

/**
 * 纯判据 A:声明键是否都在真出口里。
 * @returns {{missing:string[], declaredOnly:string[], checked:number}}
 */
export function adjudicateContract(contract, emittedKeySet) {
  const cond = new Set((contract.conditional || []).map((c) => c.key))
  const missing = contract.keys.filter((k) => !emittedKeySet.has(k))
  const declaredOnly = missing.filter((k) => cond.has(k))
  return { missing, declaredOnly, checked: contract.keys.length }
}

function selfTest() {
  let n = 0, bad = 0
  const ok = (name, c, extra = '') => { n++; if (!c) { bad++; console.log(`  ❌ ${name}${extra ? ' —— ' + extra : ''}`) } else console.log(`  ✅ ${name}`) }
  const emitted = allKeys({ rc: 0, results: { a: { verdict: 'breach', stat: { n: 3 } } }, control: { hit: true } })
  ok('S1 嵌套键也算量到(stat 在 results 的值里)', adjudicateContract({ keys: ['verdict', 'stat', 'rc'] }, emitted).missing.length === 0)
  const r = adjudicateContract({ keys: ['verdict', 'phantom'] }, emitted)
  ok('S2 阳性对照:从不出口的声明键被判缺', r.missing.length === 1 && r.missing[0] === 'phantom', `实得 ${r.missing.join(',')}`)
  const c = adjudicateContract({ keys: ['reason'], conditional: [{ key: 'reason', evidence: 'x:1' }] }, new Set(['ok']))
  ok('S3 条件字段带证据 ⇒ 只报数不判缺', c.missing.length === 1 && c.declaredOnly.length === 1)
  const bare = adjudicateContract({ keys: ['reason'], conditional: [] }, new Set(['ok']))
  ok('S4 反证:同样一个键没登记条件依据时必须判缺(不许裸豁免)', bare.missing.length === 1 && bare.declaredOnly.length === 0)
  ok('S5 噪声里取 JSON', parseJsonLoose('前置噪声\n{"a":1,"b":{"c":2}}\n尾部噪声').a === 1)
  ok('S6 取不到 JSON 时返回 null 而不是空对象(不得把"没跑成"读成"跑了且没键")', parseJsonLoose('完全不是 JSON') === null)
  const floor = CONTRACTS.filter((c) => c.keys.length < (FLOOR[c.producer] ?? 0))
  ok(`S7 声明面不低于 FLOOR(${CONTRACTS.length} 格逐格比)`, floor.length === 0, floor.map((f) => f.producer).join(','))
  console.log(`check-dispatch-key-coverage --self-test:${n - bad}/${n} 通过`)
  return bad === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const verbose = argv.includes('--verbose')
  // G-322:--timeout-ms 走 scripts/lib/flag-value.mjs 单源。旧写法 `Number(argv[gi+1]) || 200_000`
  // 把三支坏值全折回默认:漏值 ⇒ Number(undefined)=NaN ⇒ `|| 200_000`;`--timeout-ms --json` ⇒ 把
  // `--json` 当毫秒数;`--timeout-ms 0` ⇒ 0 是 falsy,又被折回 200_000(用户显式要的即时超时没了)。
  const timeoutFlag = requireFlagValue(argv, '--timeout-ms', { noun: '毫秒数(正整数)' })
  if (timeoutFlag.error) {
    console.log(`❌ 无法判定 —— ${timeoutFlag.error}`)
    return 2
  }
  let timeoutMs = 200_000
  if (timeoutFlag.present) {
    const n = Number(timeoutFlag.value)
    if (!Number.isInteger(n) || n <= 0) {
      console.log(`❌ 无法判定 —— --timeout-ms 必须是正整数,实得:${JSON.stringify(timeoutFlag.value)}`)
      return 2
    }
    timeoutMs = n
  }
  let ran = 0
  const gaps = []
  const shrink = []
  let totalChecked = 0
  for (const c of CONTRACTS) {
    if (c.keys.length < (FLOOR[c.producer] ?? 0)) shrink.push(`${c.producer} 声明 ${c.keys.length} < FLOOR ${FLOOR[c.producer]}`)
    let out = null
    try {
      out = execFileSync(process.execPath, [c.producer, ...c.args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, timeout: timeoutMs, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      out = String(e?.stdout ?? '')
      if (!out.trim()) { console.log(`  ?? ${c.producer} 跑不出 stdout(${typeof e?.status === 'number' ? 'exit ' + e.status : String(e?.message || e).slice(0, 60)})⇒ 该格未判定`); continue }
    }
    const j = parseJsonLoose(out)
    if (!j) { console.log(`  ?? ${c.producer} 的 stdout 解不出 JSON ⇒ 该格未判定(不记绿)`); continue }
    ran += 1
    const keys = allKeys(j)
    totalChecked += c.keys.length
    const { missing, declaredOnly } = adjudicateContract(c, keys)
    if (missing.length) gaps.push({ producer: c.producer, consumer: c.consumer, missing, declaredOnly })
    else if (verbose) console.log(`  ✅ ${c.producer} 声明 ${c.keys.length} 键全部量到`)
  }
  if (!ran) { console.log('⚠️ 未判定 —— 一个生产者都没跑起来,本审计没有结论(§0.3)'); return 2 }
  const hard = gaps.filter((g) => g.missing.length !== g.declaredOnly.length)
  const soft = gaps.filter((g) => g.missing.length === g.declaredOnly.length && g.missing.length)
  console.log(`[派发契约覆盖审计] 跑了 ${ran}/${CONTRACTS.length} 格 · 声明读键 ${totalChecked} 个 · 边界:本尺子**不发现新读键**,只守已登记的别再悄悄消失`)
  for (const s of soft) if (verbose) console.log(`  ⓘ ${s.producer} 条件字段 ${s.declaredOnly.join(',')} 本轮分支没走到(依据已登记)`)
  if (shrink.length) { console.log(`❌ 声明面缩水 ${shrink.length} 处(删声明必须显式改 FLOOR 并写明理由):`); for (const s of shrink) console.log('   · ' + s) }
  if (hard.length) {
    console.log(`❌ ${hard.length} 格有声明键在任何一次真出口里都没量到:`)
    for (const g of hard) console.log(`   ${g.producer}(${g.consumer})缺:${g.missing.filter((k) => !g.declaredOnly.includes(k)).join(',')} —— 要么生产方不再发射(今天那四枚这一型),要么该登记为条件字段并附源码位置`)
    return shrink.length || hard.length ? 1 : 0
  }
  if (shrink.length) return 1
  console.log(`✅ 齐全 —— ${totalChecked} 个声明读键全部量到(或走已登记的分支)`); return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isDirectRun) process.exit(main(process.argv.slice(2)))

export const __test__ = { allKeys, parseJsonLoose, adjudicateContract, CONTRACTS, FLOOR }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
