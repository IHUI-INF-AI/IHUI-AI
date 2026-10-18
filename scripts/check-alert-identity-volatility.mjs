#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 告警身份抖动对账(拦"同一件事每轮换一次身份")
 *
 * 立项凭据(全是现读,不是假想):
 *  - 2026-10-18 当天 28 封到人邮件里 18 封是同一场「部署停摆」—— 身份写的是
 *    `stall;tip=<12>;lastSuccess=<iso>`,而这台机当日 361 枚提交推进 origin/main ⇒
 *    每量一轮都是"新故障",4 小时窗口结构上永不命中。
 *  - 同一条尺子上一天还量出:家目录改道 09-30/10-01 两天 94 封(身份里带 `3×robocopy 失败`
 *    这种条数)、盘根卫生 34 封/5 天(原始计数进身份)、部署环 ff 受阻 48h/47 封(整条文案当签名)。
 *  这些都被同一个规矩禁过(AGENTS §5e-1、`alertCountTier` 头注原文),也都各自被写过注释自称
 *  "已按类别"—— **注释与实现不符正是本门要抓的那一型**:人的复核会相信注释,门只读实现。
 *
 * 判据:
 *  - **V1(身份含抖动量)**:取每个发信调用点的**身份表达式**(JS/TS 的 `dedupKey:` 值、TS 的
 *    `fingerprint` 种子、ps1 的 `$sig=` 右侧与 `Fail "…"` 文案),逐个插值分类:
 *      · 命中 sha/时刻/原始计数/异常原文这类"每轮都变的量",且该插值**没有**经过折档器物
 *        (`alertCountTier` / `alertHeldTier` / `classifyAlertIdentity` / ps1 的 `Get-*Tier`)
 *        ⇒ 判红。
 *      · 状态量(exit 码、类别标签、名称集合)不算抖动 ⇒ 放过。
 *  - **V2(第二份尺子)**:同一文件里既自定义计数折档(`function tier(`/`const tier =`)又有
 *    `alertCountTier` ⇒ 判红(§0.6/§22c:两副边界必然漂开)。
 *
 * 定级:提交链走**该文件 HEAD 自身命中数**的差值棘轮(锚点 = 该文件 HEAD 面自己的 V1+V2 命中数,
 * 只拦"本次把抖动身份加回来");现读存量只报数,`--strict` 才问责。理由同 §12e:与本次提交内容
 * 无关的红,唯一结局是逼人 `--no-verify` 连带废掉整条链。
 * 出口:**无行内豁免标记**,只认具名台账 `scripts/data/alert-identity-exemptions.json`
 * (`{file, reason, ticket, until}`,到期即回队列;进守门 108 的存活期口径)。
 *
 * 取材面(AGENTS §0.4 / 守门 118):全量档判 **HEAD blob**,`--staged` 判**索引 blob**,
 * `--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2;被审面取不到或枚举到 0 个发信点 ⇒ exit 2
 * 显式「未判定」并点名原因(§0.3,不记绿也不冒红)。
 *
 * 用法:`node scripts/check-alert-identity-volatility.mjs [--staged|--worktree|--json|--strict|--self-test]`
 * 退出码:0 通过(含"只有存量") / 1 本次带进来的命中或 strict 下的存量 / 2 无法判定。
 *
 * 接线状态(如实登记):见本文件末尾 `WIRING` 与 AGENTS.md「门名点名索引」同批登记;
 * 未接提交链之前不得自称已接线(守门 89 R1/R4)。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskComments, maskScriptComments } from './lib/code-mask.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXEMPTION_LEDGER = 'scripts/data/alert-identity-exemptions.json'

/**
 * 射程枚举:先问"哪些文件里有发信构造"(git grep 在**被审面**上问,不读工作区),再只把那几份
 * 拉进内容面。为什么不像别的门那样先 ls-tree 全量再逐个读:apps/api/src 单目录就有几百个文件,
 * 全读一遍既慢又让"射程"名不副实(真正的发信点是个位数)。
 */
export function listProducerPaths(face) {
  const greps = { head: ['grep', '-l', '-E', PRODUCER_GREP, 'HEAD', '--', ...SCOPE_PREFIXES], staged: ['grep', '--cached', '-l', '-E', PRODUCER_GREP, '--', ...SCOPE_PREFIXES], worktree: ['grep', '-l', '-E', PRODUCER_GREP, '--', ...SCOPE_PREFIXES] }
  let raw
  try {
    raw = gitRaw(greps[face] || greps.head, ROOT)
  } catch (e) {
    // `git grep` 无命中是 exit 1(正常业务结论:0 个 ⇒ 射程失效),exit 其它值才是"git 没跑成"。
    // 把这两型并成一谈,就等于让一次争用能伪装成"这台机没有发信点"。
    if (e?.status === 1) return []
    return null
  }
  return String(raw)
    .split(/\r?\n/)
    .map((l) => (face === 'head' ? l.replace(/^HEAD:/, '') : l))
    .filter((p) => p && LANG_RE.test(p) && !SKIP_PATH_RE.test(p))
}

const specOf = (face, rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`)

function readFaceTexts(face, paths) {
  if (!paths.length) return []
  if (face === 'worktree') return paths.map((p) => ({ path: p, text: readWorktreeFile(ROOT, p) ?? '' }))
  const map = catBatch(ROOT, paths.map((p) => specOf(face, p)))
  return paths.map((p) => ({ path: p, text: map.get(specOf(face, p)) ?? '' }))
}

/** 折档器物:走到这些出口的量已归一,不算抖动。 */
const SANCTIONED_RE =
  /alertCountTier\s*\(|alertHeldTier\s*\(|classifyAlertIdentity\s*\(|Get-[A-Za-z]*Tier|Get-BackupMissedShifts|Get-MigratePendingTier|\bheld\.tier\b|\.sort\s*\(/

/** 每轮都变的量:sha 类 / 时刻类 / 原始计数与时长类 / 异常原文类。 */
const VOLATILE_RULES = [
  { kind: 'sha', re: /(Sha\b|sha\b|commit|HEAD\b|builtSha|tipSha|liveSha)/ },
  { kind: '时刻', re: /(Iso\b|ISO|toISOString|Date\.now|Get-Date|lastSuccess|\bts\b|timestamp|elapsed|heldMs|At\b)/ },
  { kind: '原始计数', re: /(\.length\b|\.Count\b|\.count\s*\(|count\(|\bfails\b|repeatNo|Math\.min\s*\()/ },
  { kind: '异常原文', re: /(\$_|\$\(\s*\$_|\berr\b\.message|e\.message)/ },
]

/** 状态量白名单:这些插值是"类别/码",不是抖动。 */
const STATE_RE = /^(?:after\.code|applied\.code|name|stallClass|whyTags|level|kind|code|tier|bucket|source|n)$/

/** 射程:会产出"到人发信身份"的文件类型与路径前缀(测试夹具与运行副本不在面内)。 */
const LANG_RE = /\.(mjs|cjs|js|ts|ps1)$/
const SCOPE_PREFIXES = ['scripts/', 'deploy/win/', 'apps/api/src/']
const SKIP_PATH_RE = /(\.test\.|\.spec\.|\.d\.ts$|node_modules|[/\\]tests?[/\\]|[/\\]__tests__[/\\])/

/** 一个文件是不是发信生产者:命中任一构造词才进射程(不命中 = 与身份无关,不判也不报)。 */
const PRODUCER_RE = /notifyGuardRed\(|dedupKey|Invoke-FailNotify|Send-EmailNotify|\$sig\s*=|fingerprint\(|--alert-id|Send-FailureAlert/
const PRODUCER_GREP = 'notifyGuardRed\\(|dedupKey|Invoke-FailNotify|Send-EmailNotify|\\$sig[[:space:]]*=|fingerprint\\(|--alert-id|Send-FailureAlert'

/** 抽 JS/TS 侧的身份表达式:`dedupKey: <值>` 与 `fingerprint(...)` 的种子。 */
export function jsIdentityExprs(text) {
  const out = []
  for (const m of text.matchAll(/dedupKey\s*:\s*/g)) {
    const rest = text.slice(m.index + m[0].length)
    out.push(extractValue(rest, m[0].length + (m.index ?? 0)))
  }
  return out.filter(Boolean)
}

function extractValue(rest) {
  let depth = 0
  let end = -1
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i]
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) {
      if (depth === 0) {
        end = i
        break
      }
      depth--
    } else if (c === ',' && depth === 0) {
      end = i
      break
    }
  }
  if (end < 0) end = rest.length
  return rest.slice(0, end)
}

/** 抽 ps1 侧的身份表达式:`$sig = <右侧整行>` 与 `Fail "<文案>"`。 */
export function psIdentityExprs(text) {
  const out = []
  for (const m of text.matchAll(/\$sig\s*=\s*(.+)/gi)) out.push({ raw: m[1], line: lineOf(text, m.index) })
  for (const m of text.matchAll(/\bFail\s+"([^"]*)"/g)) out.push({ raw: m[1], line: lineOf(text, m.index) })
  return out
}

function lineOf(text, idx) {
  return (text.slice(0, idx).match(/\n/g)?.length ?? 0) + 1
}

/** 取一段身份表达式里所有"会变的插值"(JS 的 `${...}`;ps1 直接看整串)。 */
export function interpolations(raw) {
  const js = [...String(raw).matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim())
  return js.length ? js : [String(raw).trim()]
}

/** 单个插值定性:归一 / 抖动 / 状态量 / 中性。 */
export function classifyExpr(expr) {
  const s = String(expr)
  if (SANCTIONED_RE.test(s)) return { verdict: '归一' }
  if (STATE_RE.test(s.trim())) return { verdict: '状态量' }
  for (const rule of VOLATILE_RULES) if (rule.re.test(s)) return { verdict: '抖动', kind: rule.kind }
  return { verdict: '中性' }
}

/** V2:同文件里的第二份折档尺子。 */
export function secondTierRuler(text, hasAlertCountTier) {
  return Boolean(hasAlertCountTier) && /function\s+tier\s*\(|const\s+tier\s*=\s*\(/.test(text)
}

/**
 * 判一个文件 ⇒ 命中清单 [{file,line,kind,detail}]
 * 身份表达式全部走 `classifyExpr`;抖动且未归一才算命中。
 */
export function judgeFile(path, text) {
  const hits = []
  const isPs = path.endsWith('.ps1')
  // 注释里写的示例(比如这道门自己的头注就逐字抄过 `dedupKey: \`stall;tip=…\``)不是实现 ——
  // 判它等于把"讲过这条规矩"读成"违反了这条规矩"。遮罩一律引 `code-mask` 那一份实现,
  // 不在本文件另写注释识别器(§0.6;blankByMask 按长度回填,行号不漂)。
  const src = isPs ? maskScriptComments(text, 'ps') : maskComments(text)
  if (isPs) {
    // ps1 的身份 = `$sig` 右侧那段文案。只有文案里**插值**了变量才是"每轮可能变";
    // 一句常量文案里出现了"sha"这个词不算(那是描述,不是读数)—— 按整串判会把
    // 「无法固化本轮远端 sha」这类固定措辞误判成抖动,误判的门很快就被当噪音绕过去。
    for (const e of psIdentityExprs(src)) {
      for (const tok of e.raw.match(/\$\([^)]*\)|\$\{[^}]*\}|\$[A-Za-z_]\w*/g) || []) {
        const c = classifyExpr(tok)
        if (c.verdict === '抖动') hits.push({ file: path, line: e.line, kind: `V1/${c.kind}`, detail: tok.slice(0, 90) })
      }
    }
  } else {
    for (const m of src.matchAll(/dedupKey\s*:\s*/g)) {
      const raw = extractValue(src.slice(m.index + m[0].length))
      const line = lineOf(src, m.index)
      for (const expr of interpolations(raw)) {
        const c = classifyExpr(expr)
        if (c.verdict === '抖动') hits.push({ file: path, line, kind: `V1/${c.kind}`, detail: expr.slice(0, 90) })
      }
    }
    if (secondTierRuler(src, /alertCountTier/.test(src)))
      hits.push({ file: path, line: 1, kind: 'V2/第二份折档', detail: '本地 tier() 与 alertCountTier 并存(§0.6)' })
    // V1b:自带指纹去重的实现层(TS 侧 `function fingerprint(f)` 那一族)。同一层里 `detail` 是
    // 给人看的正文(含时刻、原因原文、"连续 N 次"),把它并进指纹 ⇒ 每轮新指纹,冷却形同虚设
    // (2026-10-18 实测 ops-watch-reader 的"未送达标记"那一格就是这么绕开 :362 冷却的)。
    for (const m of src.matchAll(/function\s+fingerprint\s*\([^)]*\)\s*(?::\s*string\s*)?\{/g)) {
      const body = src.slice(m.index, m.index + 400)
      if (/\.detail\b/.test(body) && !/\.identity\b/.test(body))
        hits.push({ file: path, line: lineOf(src, m.index), kind: 'V1b/明细进指纹', detail: 'fingerprint 吃 detail 而没有稳定的 identity 种子' })
    }
  }
  return hits
}

/** 台账:具名豁免(带原因与到期日);命中项被豁免则从判红集移到报数集。 */
export function readExemptions(nowMs = Date.now(), file = join(ROOT, EXEMPTION_LEDGER)) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (e) {
    // 台账**不在位** = 一条豁免都没有(正常);**读不出/解不开** = 放行判据本身瞎了,
    // 必须拒绝判定(§0.3:既不替人放行也不冒红)。
    if (e?.code === 'ENOENT') return { active: [], expired: [], badLedger: false }
    return { active: [], expired: [], badLedger: true }
  }
  let rows
  try {
    rows = JSON.parse(text)
  } catch {
    return { active: [], expired: [], badLedger: true }
  }
  if (!Array.isArray(rows)) return { active: [], expired: [], badLedger: true }
  const alive = (r) => Number.isFinite(Date.parse(String(r?.until || ''))) && Date.parse(String(r.until)) >= nowMs
  return { active: rows.filter(alive), expired: rows.filter((r) => !alive(r)), badLedger: false }
}

export function isExempted(hit, active) {
  return active.some((r) => r.file === hit.file && r.kind === hit.kind)
}

/** 差值棘轮锚点:该文件 HEAD 自身的命中数。 */
export function ratchet(currentByFile, headByFile, newlyTouched) {
  const out = []
  for (const f of newlyTouched) {
    const cur = currentByFile.get(f) || 0
    const base = headByFile.get(f) ?? 0
    if (cur > base) out.push({ file: f, cur, base })
  }
  return out
}

function collect(face, pathsForList) {
  const paths = pathsForList(face)
  if (!paths) return { undetermined: ['清单取不到(git ls-tree/ls-files 失败)'] }
  if (!paths.length) return { undetermined: ['射程内枚举到 0 个文件 ⇒ 判死,不记绿'] }
  const texts = readFaceTexts(face, paths)
  const producers = []
  const undetermined = []
  const hits = []
  for (const t of texts) {
    if (!t.text) {
      undetermined.push(`${t.path}: 被审面读不到内容`)
      continue
    }
    if (!PRODUCER_RE.test(t.text)) continue
    producers.push(t.path)
    for (const h of judgeFile(t.path, t.text)) hits.push(h)
  }
  if (!producers.length) return { undetermined: ['枚举到 0 个发信调用点 ⇒ 射程失效,不记绿'] }
  return { hits, producers, undetermined }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(runSelfTest())
  const sel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (sel.error) {
    console.log(`❌ ${sel.error} ⇒ 未判定(§0.4)`)
    process.exit(2)
  }
  const face = sel.face
  const full = collect(face, listProducerPaths)
  if (full.undetermined?.length && !full.hits) {
    console.log(`未判定:取不到判据输入 ⇒ ${full.undetermined.join(' ; ')}`)
    process.exit(2)
  }
  const head = collect('head', listProducerPaths)
  const { active, expired, badLedger } = readExemptions()
  if (badLedger) {
    console.log('未判定:豁免台账形状不可解(既不放行也不冒红)')
    process.exit(2)
  }
  const live = full.hits.filter((h) => !isExempted(h, active))
  const exempt = full.hits.filter((h) => isExempted(h, active))
  const byFile = new Map()
  for (const h of live) byFile.set(h.file, (byFile.get(h.file) || 0) + 1)
  const headByFile = new Map()
  for (const h of head.hits || []) headByFile.set(h.file, (headByFile.get(h.file) || 0) + 1)
  const touched = face === 'staged' ? new Set((gitRaw(['diff', '--cached', '--name-only'], ROOT, { allowEmpty: true }) || '').split(/\r?\n/).filter(Boolean)) : new Set(byFile.keys())
  const newly = ratchet(byFile, headByFile, touched)
  const strict = argv.includes('--strict')

  const FACE_PRINT = { staged: '索引', head: 'HEAD', worktree: '工作树(人工逃生舱)' }
  console.log(`[身份抖动门] 面=${FACE_PRINT[face] || face} 发信点 ${full.producers.length} 个 / 抖动身份命中 ${live.length} 条(豁免 ${exempt.length} 条)`)
  for (const h of live) console.log(`  · ${h.file}:${h.line} ${h.kind} ⇒ ${h.detail}`)
  if (exempt.length) console.log(`  豁免中:${exempt.map((h) => `${h.file}:${h.kind}`).join(' , ')}`)
  if (expired.length) console.log(`  ⚠️ 豁免已到期回队列:${expired.map((r) => `${r.file}(${r.until})`).join(' , ')}`)
  if (head.undetermined?.length) console.log(`  ℹ️ HEAD 面对账未判定:${head.undetermined.join(' ; ')}`)
  if (full.undetermined.length) console.log(`  ℹ️ 被审面逐文件未判定:${full.undetermined.slice(0, 3).join(' ; ')}${full.undetermined.length > 3 ? ` …共 ${full.undetermined.length} 条` : ''}`)

  if (newly.length) {
    console.log(`❌ 本次把抖动身份加回来了 ${newly.length} 个文件(棘轮锚点 = 该文件 HEAD 自身命中数):`)
    for (const n of newly) console.log(`   ${n.file}: HEAD ${n.base} 条 → 现在 ${n.cur} 条`)
    console.log('   出路:身份只留「类别 × 折档」(alertCountTier/alertHeldTier/classifyAlertIdentity),实时读数进正文;或按 §5e-1 补具名豁免(带原因+到期)。')
    process.exit(1)
  }
  if (strict && live.length) {
    console.log(`❌ --strict 问责存量 ${live.length} 条`)
    process.exit(1)
  }
  console.log(live.length ? `✅ 本次未新增;存量 ${live.length} 条只报数(升 blocking 前置 = 存量归零,§12e)` : '✅ 全清')
  process.exit(0)
}

/** 自检:夹具成对 —— 摘掉折档器物必须翻红,补上必须翻绿。 */
function runSelfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  t('V1:tip 进身份判红(2026-10-18 那一型)', () => {
    const src = "notify('x', d, { dedupKey: `stall;tip=${String(p.tipSha || '').slice(0, 12)}` })"
    const hits = judgeFile('scripts/a.mjs', src)
    if (hits.length !== 1 || !hits[0].kind.startsWith('V1')) throw new Error(`应 1 条 V1,实测 ${JSON.stringify(hits)}`)
  })
  t('V1 反向:同一插值走 alertCountTier ⇒ 不判', () => {
    const src = 'notify(\'x\', d, { dedupKey: `orphan;tier=${alertCountTier(parsed.hits.length)}` })'
    if (judgeFile('scripts/a.mjs', src).length) throw new Error('折档器物输出被误判成抖动')
  })
  t('V1:heldMs 直算 bucket 判红(30 分钟一档那种)', () => {
    const src = 'notifyGuardRed(n, d, { dedupKey: `bucket=${Math.floor(heldMs / 3)} + ${heldMs}` })'
    if (!judgeFile('scripts/a.mjs', src).some((h) => h.kind.includes('原始计数') || h.kind.includes('时刻'))) throw new Error('未抓到 heldMs/Math.min 型')
  })
  t('V1:时刻进身份判红', () => {
    const src = 'notifyGuardRed(n, d, { dedupKey: `a;at=${p.lastSuccessIso}` })'
    if (!judgeFile('scripts/a.mjs', src).some((h) => h.kind === 'V1/时刻')) throw new Error('lastSuccessIso 未判红')
  })
  t('状态量放过:exit 码 / 类别 / 排序后名称集合', () => {
    const src = "notifyGuardRed(n, d, { dedupKey: `home-heal-exit=${after.code};why=${whyTags};svcs=${names.sort().join('+')}` })"
    const hits = judgeFile('scripts/a.mjs', src)
    if (hits.length) throw new Error(`状态量被误判:${JSON.stringify(hits)}`)
  })
  t('V2:tier() 与 alertCountTier 并存判红', () => {
    const src = 'function tier(n){return 1}\nconst k = alertCountTier(3)'
    if (!judgeFile('scripts/a.mjs', src).some((h) => h.kind.startsWith('V2'))) throw new Error('第二份尺子没抓到')
  })
  t('ps1:Fail 文案含异常原文判红,$Detail 分流后判绿;常量文案提到"sha"不算', () => {
    const bad = 'Fail "构建失败($_) → 保持当前在线版本"'
    const good = 'Fail "构建失败 → 保持当前在线版本" -Detail "原始报错:$_"'
    const constant = 'Fail "无法固化本轮远端 sha,fetch 结论不可用则不部署"'
    if (!judgeFile('deploy/win/a.ps1', bad).length) throw new Error('$_ 进签名未判红')
    if (judgeFile('deploy/win/a.ps1', good).length) throw new Error('Detail 位被误判(明细本就只进正文)')
    if (judgeFile('deploy/win/a.ps1', constant).length) throw new Error('固定措辞里出现 sha 一词被误判成抖动')
  })
  t('差值棘轮:HEAD 已有同样命中 ⇒ 不判本次', () => {
    const out = ratchet(new Map([['scripts/a.mjs', 2]]), new Map([['scripts/a.mjs', 2]]), new Set(['scripts/a.mjs']))
    if (out.length) throw new Error('存量被算成本次新增(恒红门之始)')
    const out2 = ratchet(new Map([['scripts/a.mjs', 3]]), new Map([['scripts/a.mjs', 2]]), new Set(['scripts/a.mjs']))
    if (out2.length !== 1) throw new Error('真新增没抓到')
  })
  t('豁免台账:到期即回队列,不可解即拒绝判定', () => {
    const now = Date.parse('2026-10-18T00:00:00.000Z')
    const dir = mkScratch('alert-id-ledger-')
    const f = join(dir, 'ledger.json')
    writeFileSync(f, JSON.stringify([{ file: 'scripts/a.mjs', kind: 'V1/sha', reason: 'x', ticket: 'G-1', until: '2026-10-01' }]), 'utf8')
    const r = readExemptions(now, f)
    if (r.active.length || r.expired.length !== 1) throw new Error('到期豁免没回队列')
    writeFileSync(f, 'not json', 'utf8')
    if (!readExemptions(now, f).badLedger) throw new Error('坏台账没被拒判(既不冒绿也不放行)')
    rmScratch(dir)
  })
  t('射程:识别器只认发信构造,路径黑名单挡测试夹具', () => {
    if (!PRODUCER_RE.test('notifyGuardRed(') || !PRODUCER_RE.test('dedupKey')) throw new Error('生产者识别失效')
    if (PRODUCER_RE.test('# 一段散文')) throw new Error('散文被当成发信点')
    if (!SKIP_PATH_RE.test('scripts/tests/a.test.mjs')) throw new Error('夹具没被排除')
  })
  t('注释里的示例不算实现(遮罩引 code-mask 那一份,行号不漂)', () => {
    const code = 'notifyGuardRed(n, d, { dedupKey: `x;tip=${p.tipSha}` })'
    const asComment = `// 立因:${code}\nconst a = 1\n`
    if (!judgeFile('scripts/a.mjs', code).length) throw new Error('代码位没判红(夹具本身失效)')
    if (judgeFile('scripts/a.mjs', asComment).length) throw new Error('注释里的同一段被当成实现判红')
    const psCode = 'Fail "构建失败($_) → 保持当前在线版本"\n'
    const psComment = '# ' + psCode
    if (!judgeFile('deploy/win/a.ps1', psCode).length) throw new Error('ps1 代码位没判红')
    if (judgeFile('deploy/win/a.ps1', psComment).length) throw new Error('ps1 注释被当实现')
  })
  t('V1b:自带指纹那一层把 detail 并进指纹判红;改走 identity 种子后判绿', () => {
    const bad = 'function fingerprint(f: WatchFinding): string {\n  return `${f.title}|${f.detail}`\n}'
    const good = 'function fingerprint(f: WatchFinding): string {\n  return `${f.title}|${f.identity ?? f.title}`\n}'
    if (!judgeFile('apps/api/src/jobs/a.ts', bad).some((h) => h.kind === 'V1b/明细进指纹')) throw new Error('detail 进指纹没抓到(ops-watch 那一型)')
    if (judgeFile('apps/api/src/jobs/a.ts', good).length) throw new Error('走 identity 种子仍被误判')
  })
  let pass = 0
  for (const c of cases) {
    try {
      c.fn()
      pass++
      console.log(`✔ ${c.name}`)
    } catch (e) {
      console.log(`✖ ${c.name} —— ${e.message}`)
    }
  }
  console.log(`末行:${pass}/${cases.length} 通过`)
  return pass === cases.length ? 0 : 1
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = {
  classifyExpr,
  judgeFile,
  interpolations,
  psIdentityExprs,
  jsIdentityExprs,
  ratchet,
  readExemptions,
  isExempted,
  secondTierRuler,
  listProducerPaths,
  PRODUCER_RE,
  SKIP_PATH_RE,
  VOLATILE_RULES,
  SANCTIONED_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
