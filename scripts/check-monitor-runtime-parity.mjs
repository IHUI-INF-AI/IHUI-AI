#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子的诊断输出就是它的交付物 */

/**
 * 只读对账尺子:monitoring 运行副本 ↔ 仓内真相 逐对同形对账(2026-10-18 立,票 G-584 同族)
 *
 * 堵的格子:监控栈以 nssm 原生方式跑在 D:\DevEnv\monitor,而仓内真相在 monitoring/。
 * panel provisioning 那一格已有派生器 scripts/sync-panel-live-provisioning.mjs
 * (派生到运行副本、幂等、--check 零副作用);其余四对(alertmanager / promtail /
 * grafana.ini / loki)与 ai-service 的 .env 结构键**全仓没有任何对账器** ——
 * check-prod-bundle-shadow.mjs 只登记 prod-bundle 那 9 对,monitoring→DevEnv 零覆盖。
 * 实测漂移型:两侧 COMBO_CHAINS 都有值但 chain 顺序不同(顺序影响降级优先级,不是无害差异)。
 *
 * 定级纪律(本仓铁律,不得回退):
 *   本器物判的是**机器态**,不得接进 pre-commit/提交链,也不接守护巡检轮 —— 挂 blocking
 *   就是 §12e 禁的恒红门(别的机器上 D:\DevEnv\monitor 根本不存在,提交者结构上满足不了)。
 *   它属于 AGENTS「只读对账尺子(未接入提交链,也未接入守护巡检轮)」那一族;
 *   镜像测试里有形状锁钉住 guardian-runner.mjs 注册表不得出现本文件名。
 *
 * 为什么"差异 ≠ 错"(结论是差异清单,判红权归人):
 *   运行副本可以**有意**与仓内不同 —— 原生部署下端口改写(docker 服务名→127.0.0.1)、
 *   路径改写(/loki-data→D:\DevEnv\monitor)、grafana.ini 的原生段展开都是合法形态。
 *   所以本尺不判红:退出码里永远没有"因差异而 1"这一支。
 *
 * 三态与退出码(§0.3:"没判"绝不写成"判过"):
 *   同形 same           —— 归一化后 LCS 差值为 0;
 *   差异 differ         —— 报差异行数与首个对不齐处(只报行号与方位,**绝不打印任何行内容**);
 *   未判定 undetermined —— 任一侧读不到/超出比较预算/键枚举为 0 ⇒ 显式点名,不记绿也不冒红。
 *   退出码:0 = 全部可判定(同形或差异都算量到,差异不拦任何东西);
 *           2 = 任一未判定,或配对清单空转(现读配置对 < 4 ⇒ 清单腐烂,判死不记绿)。
 *
 * 取材口径:两侧都读**磁盘当轮现值**。这不是审面门(守门 118 的 HEAD/索引纪律判提交内容),
 * 本尺判的就是"这台机盘上当下是什么";仓内副本若恰有在飞编辑,量到的就是那个现场,如实报。
 * 归一化(只影响比较、不改盘):剔水印结构行(判据 import
 * scripts/lib/watermark-lines.mjs 的 stripWatermarkStructure,§22c 不复制)、剥零宽族、
 * CRLF/CR→LF、行尾空白、首尾空行。运行副本无水印,归一化对它是恒等变换。
 *
 * .env 结构键:只比"两侧是否同形",值一律不落输出(AGENTS §5d 密钥防泄漏纪律)。
 * 显式白名单 COMBO_CHAINS + 结构键模式 *_URL/*_PORT;键名含 SECRET/TOKEN/PASSWORD/
 * CREDENTIAL/API_KEY/PRIVATE_KEY 的键即便撞模式也整体剔除(不参与比较、不出现在清单)。
 *
 * 用法: node scripts/check-monitor-runtime-parity.mjs [--json]
 *        node scripts/check-monitor-runtime-parity.mjs --self-test
 * 配对清单实际项为现读确认结果(2026-10-18):仓内 alertmanager 真相面取
 * monitoring/alertmanager/alertmanager.rendered.yml —— 同目录的 alertmanager.yml 自陈
 * "已废弃、不再被任何运行实例加载"(故意留的诱饵),拿它对账得到的是恒定噪音;
 * loki 两侧文件名现读同为 loki-config.yml(与派单票面"文件名不同"的说法不符,以实测为准)。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { dropZeroWidth, stripWatermarkStructure } from './lib/watermark-lines.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ── 配对清单(每条必须带 owner + reason;空转即 exit 2,见头注) ──
// 下限 4→3(2026-10-20):第 4 对的原对象已整体退役 —— 运行副本侧 `D:\DevEnv\monitor\` 实测无该目录、
// 无服务注册、8816 无监听,仓内侧也随改名换成了 board.ini。判据的输入集缩了,下限跟着缩是如实;
// 这一格的意义仍是"配对清单别空转",不是"让它变绿"。
export const MIN_CONFIG_PAIRS = 3
export const PAIRS = [
  {
    id: 'alertmanager',
    repoRel: 'monitoring/alertmanager/alertmanager.rendered.yml',
    runtimeAbs: 'D:/DevEnv/monitor/alertmanager/alertmanager.yml',
    owner: '机主 2026-10-18 指令(票 G-584 同族)',
    reason: '现役加载件 = 模板 alertmanager.yml.tmpl 的渲染产物 rendered.yml(含真实凭据、被 git 忽略;本尺只比同形、绝不打印内容)。仓内 alertmanager.yml 自陈已废弃,故意不对账它',
  },
  {
    id: 'promtail',
    repoRel: 'monitoring/promtail/promtail-config.yml',
    runtimeAbs: 'D:/DevEnv/monitor/promtail/promtail-config.yml',
    owner: '机主 2026-10-18 指令(票 G-584 同族)',
    reason: 'promtail 原生二进制现读加载此对;仓内侧带溯源水印横幅,归一化后比较',
  },
  {
    id: 'loki',
    repoRel: 'monitoring/loki/loki-config.yml',
    runtimeAbs: 'D:/DevEnv/monitor/loki/loki-config.yml',
    owner: '机主 2026-10-18 指令(票 G-584 同族)',
    reason: 'loki 原生实例现读加载此对;两侧文件名实测同为 loki-config.yml(派单票面称不同,以当次实测为准 —— "凡机器事实每次现读")',
  },
]

// ── .env 结构键对(值绝不落输出) ──
export const ENV_PAIRS = [
  {
    id: 'ai-service-env',
    repoRel: 'apps/ai-service/.env',
    runtimeAbs: 'D:/DevEnv/ihui-prod/apps/ai-service/.env',
    owner: '机主 2026-10-18 指令(票 G-584 同族)',
    reason: 'COMBO_CHAINS 的 chain 顺序即降级优先级,顺序不同不是无害差异;*_URL/*_PORT 类结构键同法对账',
    explicitKeys: ['COMBO_CHAINS'],
    patterns: [/^[A-Z0-9_]*_(?:URL|PORT)$/],
  },
]

// 键名撞这些词族 ⇒ 整体剔除(不参与比较、不出现在清单),即便形态命中 *_URL/*_PORT。
export const SECRET_NAME_RE = /(?:SECRET|TOKEN|PASSWORD|CREDENTIAL|API_?KEY|PRIVATE_KEY)/

const MAX_LCS_LINES = 3000 // 单侧超过此线数或乘积超预算 ⇒ 未判定(不静默半比较)

/** 比较前归一化:剔水印结构行、剥零宽、换行统一、行尾空白、首尾空行。返回行数组。 */
export function normalizeLines(raw) {
  const stripped = stripWatermarkStructure(String(raw)).text
  const lines = dropZeroWidth(stripped)
    .split(/\r\n|\r|\n/)
    .map((l) => l.replace(/[ \t]+$/, ''))
  while (lines.length && lines[0].trim() === '') lines.shift()
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  return lines
}

/** LCS 长度(滚动行 DP);超预算返回 null(调用方折成未判定,不回落近似值)。 */
export function lcsLength(A, B) {
  if (A.length > MAX_LCS_LINES || B.length > MAX_LCS_LINES) return null
  if (A.length * B.length > 9_000_000) return null
  const [long, short] = A.length >= B.length ? [A, B] : [B, A]
  let prev = new Int32Array(short.length + 1)
  let cur = new Int32Array(short.length + 1)
  for (let i = 1; i <= long.length; i++) {
    for (let j = 1; j <= short.length; j++) {
      cur[j] = long[i - 1] === short[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    }
    ;[prev, cur] = [cur, prev]
    cur.fill(0)
  }
  return prev[short.length]
}

/** 归一化两侧的 diff 读数。firstDiff 只含行号与方位,不含内容。 */
export function diffStats(linesA, linesB) {
  const lcs = lcsLength(linesA, linesB)
  if (lcs === null) return { undetermined: `行数超出比较预算(单侧 ≤${MAX_LCS_LINES} 行且乘积 ≤9e6),不半比较` }
  const diffCount = linesA.length + linesB.length - 2 * lcs
  if (diffCount === 0) return { equal: true, diffCount: 0 }
  let k = 0
  while (k < linesA.length && k < linesB.length && linesA[k] === linesB[k]) k++
  const side = k >= linesB.length ? 'repo-only-tail' : k >= linesA.length ? 'runtime-only-tail' : 'mismatch'
  return { equal: false, diffCount, firstDiff: { repoLine: k + 1, runtimeLine: k + 1, side } }
}

function readSide(absPath, label) {
  try {
    return { ok: true, text: readFileSync(absPath, 'utf8') }
  } catch (e) {
    return { ok: false, why: `${label}读不到(${absPath}):${e.code || e.message}` }
  }
}

/** 单对配置文件的三态判定。夹具可注入 repoAbs(与 runtimeAbs 同落 scratch),判据不分叉。 */
export function comparePair(pair, readFn = readSide, repoAbsOverride = null) {
  const repoAbs = repoAbsOverride ?? join(ROOT, pair.repoRel)
  const a = readFn(repoAbs, '仓内侧')
  const b = readFn(pair.runtimeAbs, '运行副本侧')
  if (!a.ok || !b.ok) {
    return { id: pair.id, state: 'undetermined', why: [a.ok ? null : a.why, b.ok ? null : b.why].filter(Boolean).join(' / ') }
  }
  const linesA = normalizeLines(a.text)
  const st = diffStats(linesA, normalizeLines(b.text))
  if (st.undetermined) return { id: pair.id, state: 'undetermined', why: st.undetermined }
  if (st.equal) return { id: pair.id, state: 'same', repoLines: linesA.length }
  return { id: pair.id, state: 'differ', diffCount: st.diffCount, firstDiff: st.firstDiff }
}

/** 解析 .env,只挑结构键(COMBO_CHAINS 显式 + *_URL/*_PORT 模式;密钥命名族整体剔除)。 */
export function selectEnvKeys(raw, { explicitKeys = [], patterns = [] }) {
  const out = new Map()
  for (const line of String(raw).split(/\r\n|\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (!m) continue
    const key = m[1]
    if (SECRET_NAME_RE.test(key)) continue
    if (!explicitKeys.includes(key) && !patterns.some((re) => re.test(key))) continue
    out.set(key, m[2].trim().replace(/^(['"])(.*)\1$/, '$2')) // 同名键后写覆盖(与 dotenv last-wins 同形)
  }
  return out
}

/** 单对 .env 的结构键逐键同形判定;输出只含键名与三态,绝不含值。 */
export function compareEnvPair(ep, readFn = readSide, repoAbsOverride = null) {
  const repoAbs = repoAbsOverride ?? join(ROOT, ep.repoRel)
  const a = readFn(repoAbs, '仓内侧')
  const b = readFn(ep.runtimeAbs, '运行副本侧')
  if (!a.ok || !b.ok) {
    return { id: ep.id, state: 'undetermined', why: [a.ok ? null : a.why, b.ok ? null : b.why].filter(Boolean).join(' / '), keys: [] }
  }
  const ka = selectEnvKeys(a.text, ep)
  const kb = selectEnvKeys(b.text, ep)
  const names = [...new Set([...ka.keys(), ...kb.keys()])].sort()
  if (names.length === 0) return { id: ep.id, state: 'undetermined', why: '结构键枚举到 0(两侧 .env 均无白名单键),判死不记绿', keys: [] }
  const keys = names.map((k) => {
    const va = ka.get(k)
    const vb = kb.get(k)
    if (va === undefined) return { key: k, state: 'differ', note: 'missing-on-repo(值不落输出)' }
    if (vb === undefined) return { key: k, state: 'differ', note: 'missing-on-runtime(值不落输出)' }
    return { key: k, state: va === vb ? 'same' : 'differ', note: va === vb ? '' : 'value-mismatch(值不落输出)' }
  })
  return { id: ep.id, state: keys.every((r) => r.state === 'same') ? 'same' : 'differ', keys }
}

/** 全量对账 ⇒ 报告 + 分桶 + 退出码。同形/差异都算"量到";未判定或空清单 ⇒ 2。 */
export function runParity(pairs, envPairs, readFn = readSide, overrides = {}) {
  const rows = pairs.map((p) => comparePair(p, readFn, overrides[p.id] ?? null))
  const envRows = envPairs.map((e) => compareEnvPair(e, readFn, overrides[e.id] ?? null))
  const bucket = (rs) => ({
    same: rs.filter((r) => r.state === 'same').length,
    differ: rs.filter((r) => r.state === 'differ').length,
    undetermined: rs.filter((r) => r.state === 'undetermined').length,
  })
  const cb = bucket(rows)
  const eb = bucket(envRows)
  const warnings = []
  if (pairs.length < MIN_CONFIG_PAIRS) warnings.push(`配对清单空转:配置对 ${pairs.length} 枚 < ${MIN_CONFIG_PAIRS}(清单腐烂,判死不记绿)`)
  const hasUndetermined = cb.undetermined + eb.undetermined > 0
  const exitCode = pairs.length < MIN_CONFIG_PAIRS || hasUndetermined ? 2 : 0
  return { generated: new Date().toISOString(), pairs: rows, env: envRows, buckets: { config: cb, env: eb }, exitCode, warnings }
}

function describePairResult(r) {
  if (r.state === 'same') return `同形(归一化后 ${r.repoLines} 行逐行相等)`
  if (r.state === 'undetermined') return `未判定:${r.why}`
  const f = r.firstDiff
  const where = f.side === 'mismatch'
    ? `首个对不齐处 仓内第 ${f.repoLine} 行 ↔ 运行副本第 ${f.runtimeLine} 行起`
    : f.side === 'repo-only-tail'
      ? `运行副本在第 ${f.repoLine} 行后截断(内容不打印)`
      : `仓内在第 ${f.runtimeLine} 行后多出一段(内容不打印)`
  return `差异 ${r.diffCount} 行(归一化口径)—— ${where}`
}

export function render(report) {
  const out = []
  const mark = { same: '=', differ: '≠', undetermined: '?' }
  for (const r of report.pairs) out.push(`${mark[r.state]} [配置] ${r.id}: ${describePairResult(r)}`)
  for (const r of report.env) {
    if (r.state === 'undetermined') { out.push(`? [env] ${r.id}: ${r.why}`); continue }
    for (const k of r.keys) out.push(`${mark[k.state]} [env] ${r.id}.${k.key}: ${k.state === 'same' ? '同形(值不落输出)' : `差异(${k.note})`}`)
  }
  for (const w of report.warnings) out.push(`! ${w}`)
  const b = report.buckets
  out.push(`分桶:配置对 同形 ${b.config.same} / 差异 ${b.config.differ} / 未判定 ${b.config.undetermined};env 对 同形 ${b.env.same} / 差异 ${b.env.differ} / 未判定 ${b.env.undetermined}`)
  out.push(report.exitCode === 0
    ? '✓ 全部量到(差异 ≠ 错,判红权归人;本尺零写入,不同步任何一侧)'
    : '✗ 未判定或清单空转已在上表以 ? 与 ! 点名 —— 不记绿也不冒红')
  return out.join('\n')
}

// ── --self-test:成对正反夹具(同形→0、改一字节→点名该对、任一侧缺→未判定)+ 取材非空锁 ──
// 夹具唯一落点 = scripts/lib/scratch-dir.mjs 的 mkScratch(§15b,不落仓库树、不碰真实运行副本)。
function runSelfTest() {
  // 用例登记走共用出口(scripts/lib/selftest-registrant.mjs):thunk 在消费循环里**必被调用**,
  // 值形态即算即得 —— 结构上封死"登记侧写 !!ok 而用例传箭头函数 ⇒ 恒真"的老洞(守门 41 同型)。
  // 本门用例全是值形态(登记时已求值),夹具在 finally 里销毁不影响账面。
  const { t: ok, report } = makeRegistrar()
  const dir = mkScratch('monitor-runtime-parity-selftest')
  try {
    const w = (rel, text) => { const p = join(dir, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p }
    const banner = '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。\n// [IHUI-AI-PROVENANCE]:⁠占位⁠\n\n'
    const bodyA = 'server:\n  http_listen_port: 3100\nauth_enabled: false\n'
    w('repo/loki', banner + bodyA)
    w('run/loki', bodyA.replace(/\n/g, '\r\n')) // 运行副本:无水印 + CRLF ⇒ 归一化后同形
    w('repo/promtail', bodyA)
    w('run/promtail', bodyA.replace('3100', '3101')) // 改一个字符 ⇒ 必须点名这一对
    w('repo/grafini', 'app_name = x\n') // run/grafini 故意不建 ⇒ 缺侧 ⇒ 未判定
    w('repo/extra1', bodyA)
    w('run/extra1', bodyA)
    w('repo/extra2', bodyA)
    w('run/extra2', bodyA)
    w('repo/env', 'COMBO_CHAINS=a,b\nAI_SERVICE_URL=http://x-never-print\nDB_PASSWORD=p1-never-print\n')
    w('run/env', 'COMBO_CHAINS=b,a\nAI_SERVICE_URL=http://x-never-print\nDB_PASSWORD=p2-never-print\n')

    const fakePairs = [
      { id: 'loki', repoRel: null, runtimeAbs: join(dir, 'run', 'loki') },
      { id: 'promtail', repoRel: null, runtimeAbs: join(dir, 'run', 'promtail') },
      { id: 'grafana-ini', repoRel: null, runtimeAbs: join(dir, 'run', 'grafini') },
      { id: 'ghost', repoRel: null, runtimeAbs: join(dir, 'run', 'ghost') },
      { id: 'extra1', repoRel: null, runtimeAbs: join(dir, 'run', 'extra1') },
      { id: 'extra2', repoRel: null, runtimeAbs: join(dir, 'run', 'extra2') },
    ]
    const overrides = {
      loki: join(dir, 'repo', 'loki'),
      promtail: join(dir, 'repo', 'promtail'),
      'grafana-ini': join(dir, 'repo', 'grafini'),
      ghost: join(dir, 'repo', 'ghost'),
      extra1: join(dir, 'repo', 'extra1'),
      extra2: join(dir, 'repo', 'extra2'),
    }
    const rows = fakePairs.map((p) => comparePair(p, readSide, overrides[p.id]))
    ok('夹具:水印横幅+CRLF 差异归一化后 ⇒ 同形(diffCount 0)', rows[0].state === 'same')
    ok('夹具:改一字符 ⇒ 判差异且点名的是 promtail 这一对(首差行号=2)', rows[1].state === 'differ' && rows[1].id === 'promtail' && rows[1].diffCount > 0 && rows[1].firstDiff.repoLine === 2)
    ok('夹具:缺运行副本侧 ⇒ 未判定,不记绿也不冒红', rows[2].state === 'undetermined')
    ok('夹具:两侧都缺 ⇒ 未判定(点名双侧)', rows[3].state === 'undetermined' && rows[3].why.includes('仓内侧') && rows[3].why.includes('运行副本侧'))
    const envE = { id: 'env', repoRel: null, runtimeAbs: join(dir, 'run', 'env'), explicitKeys: ['COMBO_CHAINS'], patterns: [/^[A-Z0-9_]*_(?:URL|PORT)$/] }
    const er = compareEnvPair(envE, readSide, join(dir, 'repo', 'env'))
    ok('夹具:COMBO_CHAINS 顺序不同 ⇒ 键级差异点名该键', er.state === 'differ' && er.keys.find((k) => k.key === 'COMBO_CHAINS')?.state === 'differ')
    ok('夹具:AI_SERVICE_URL 两侧同形 ⇒ same(值不落输出)', er.keys.find((k) => k.key === 'AI_SERVICE_URL')?.state === 'same')
    ok('夹具:键名撞密钥族(DB_PASSWORD)⇒ 整体剔除,不出现在清单', !er.keys.some((k) => /PASSWORD/.test(k.key)))
    const leaked = JSON.stringify({ rows, er })
    ok('夹具:任何值都不落输出(never-print 哨兵与 p1/p2 字样绝不出现在报告)', !leaked.includes('never-print') && !leaked.includes('p1-') && !leaked.includes('p2-'))
    const determined = [fakePairs[0], fakePairs[1], fakePairs[4], fakePairs[5]] // 同形×3 + 差异×1,无未判定
    const differRun = runParity(determined, [], readSide, overrides)
    ok('退出码纪律:存在差异但不含未判定 ⇒ 0(差异不产生 exit 1,判红权归人)', differRun.exitCode === 0 && differRun.buckets.config.differ > 0)
    const withUndetermined = [fakePairs[0], fakePairs[1], fakePairs[4], fakePairs[2]] // 4 枚成清单,其中一枚缺运行副本
    const undeterminedRun = runParity(withUndetermined, [], readSide, overrides)
    ok('退出码纪律:任一未判定 ⇒ 2(不记绿)', undeterminedRun.exitCode === 2 && undeterminedRun.buckets.config.undetermined === 1)
    ok('取材非空锁:配对清单 <4 枚 ⇒ exit 2 且点名空转', runParity([], [], readSide).exitCode === 2 && runParity([], [], readSide).warnings.length > 0)
    ok('真清单现读:PAIRS ≥ 4 且每条带 owner+reason', PAIRS.length >= MIN_CONFIG_PAIRS && PAIRS.every((p) => p.owner && p.reason && p.repoRel && p.runtimeAbs))
    ok('真清单现读:ENV_PAIRS ≥ 1 且密钥剔除逻辑在册', ENV_PAIRS.length >= 1 && SECRET_NAME_RE.test('DB_PASSWORD') && !SECRET_NAME_RE.test('AI_SERVICE_URL'))
    ok('真仓 CLI 取材非空:真配对跑一遍,枚举到的配置对 ≥ 4(防空清单静默全绿)', runParity(PAIRS, ENV_PAIRS).pairs.length >= MIN_CONFIG_PAIRS)
  } finally {
    rmScratch(dir)
  }
  const r = report()
  for (const c of r.cases) console.log(`${c.pass ? '✓' : '✗'} ${c.name}`)
  console.log(`自检 ${r.pass}/${r.cases.length} 通过`)
  return r.fail ? 1 : 0
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(runSelfTest())
  const bad = argv.filter((a) => a !== '--json' && a !== '--self-test')
  if (bad.length) { console.error(`✗ 未判定:未知选项 ${bad.join(' ')} —— 本尺只接受 --json / --self-test`); process.exit(2) }
  const report = runParity(PAIRS, ENV_PAIRS)
  console.log(argv.includes('--json') ? JSON.stringify(report, null, 2) : render(report))
  process.exit(report.exitCode)
}

// ── §22c 出口:镜像测试直接 import,不复制判据 ──
export const __test__ = {
  ROOT,
  PAIRS,
  ENV_PAIRS,
  MIN_CONFIG_PAIRS,
  SECRET_NAME_RE,
  MAX_LCS_LINES,
  normalizeLines,
  lcsLength,
  diffStats,
  comparePair,
  selectEnvKeys,
  compareEnvPair,
  runParity,
  render,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
