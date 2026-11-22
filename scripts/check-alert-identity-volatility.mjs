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
 *  - **V1b(明细进指纹)**:自带 `function fingerprint(...)` 那一层把 `detail` 并进身份而没有
 *    稳定 `identity` 种子 ⇒ 判红(时刻/原因原文/"连续 N 次"都在 detail 里)。
 *  - **V2(第二份尺子)**:同一文件里既自定义计数折档(`function tier(`/`const tier =`)又有
 *    `alertCountTier` ⇒ 判红(§0.6/§22c:两副边界必然漂开)。
 *  - **V3(射程声明对账,输入 = `scripts/data/alert-mail-faces.json`)**:每一面发信出口要么声明
 *    `inScope:true` 且**真的落在 `SCOPE_PREFIXES` 里**(否则 = 拿没装好的尺子冒充覆盖 ⇒ 红),
 *    要么声明 `inScope:false` 并写满 `gapReason`+`ticket`+`until`(缺一项 ⇒ 静默缺口红;
 *    到期 ⇒ 回队列红;`until` 不可解 ⇒ 等于永久豁免,红);`producerPath` 在 HEAD 面已不存在 ⇒
 *    清单腐烂红。这一维才是今天的真教训:**"覆盖了多少面"这件事本身没有器物对账**,所以一把
 *    号称量发信量的尺子可以安静地漏掉最大那个面好几天(28 封在它账面上是 MAIL=0)。
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
 * 接线状态(2026-10-18 现读,头注与注册条目必须同真同假 —— 脱节即红,镜像测试钉这条):
 * **已接进提交链 = 守门 id 224**(用 `scripts/gate-registry-insert.mjs` 以 HEAD 为底取号插入并同枚落地),
 * 注册条目现读 `mode: 'blocking'` / `skipEnv: 'HUSKY_SKIP_ALERT_IDENTITY'` /
 * `stagedTriggers: ['scripts/','deploy/win/','apps/api/src/','apps/api/scripts/']`(最后一项是
 * 发信唯一出口那一层,由 V3 自己抓出来必须补:出口声明 inScope:true 而射程没有它 = 假覆盖)。
 * 走的是差值棘轮(锚点 = 该文件 HEAD 自身命中数),现读 HEAD 面存量 0 条 + 1 条具名到期豁免,
 * 因此它对无关提交不构成红(§12e 禁的是恒红门,不是"拦新增")。自检 `--self-test`(条数现读,
 * 别在本文钉数),镜像 `scripts/tests/check-alert-identity-volatility.test.mjs`。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskComments, maskScriptComments, blankQuoteStrings } from './lib/code-mask.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXEMPTION_LEDGER = 'scripts/data/alert-identity-exemptions.json'
/** 发信面台账(V3 的输入):每一面要么在射程内,要么写明缺口理由+出处+到期日。 */
const MAIL_FACES_LEDGER = 'scripts/data/alert-mail-faces.json'

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
// `apps/api/scripts/` 是发信**唯一出口**所在层(§5e),必须算射程:V3 会把"声明 inScope:true 却
// 不在射程里"判成假覆盖 —— 2026-10-18 立台账当天就被自己这一维抓到过一次的正是这一格。
const SCOPE_PREFIXES = ['scripts/', 'deploy/win/', 'apps/api/src/', 'apps/api/scripts/']
const SKIP_PATH_RE = /(\.test\.|\.spec\.|\.d\.ts$|node_modules|[/\\]tests?[/\\]|[/\\]__tests__[/\\])/

/** 一个文件是不是发信生产者:命中任一构造词才进射程(不命中 = 与身份无关,不判也不报)。 */
const PRODUCER_RE = /notifyGuardRed\(|dedupKey|Invoke-FailNotify|Send-EmailNotify|\$sig\s*=|fingerprint\(|--alert-id|Send-FailureAlert/
const PRODUCER_GREP = 'notifyGuardRed\\(|dedupKey|Invoke-FailNotify|Send-EmailNotify|\\$sig[[:space:]]*=|fingerprint\\(|--alert-id|Send-FailureAlert'
/** V4 发现集用的两段 ERE(git grep 侧)与上面的 JS 正则同义,只按其一并存修改。 */
const TRANSPORT_SRC = 'createTransport|sendMail\\(|Send-MailMessage|RESEND_API_KEY|api\\.resend\\.com'
const OPS_SRC = "ALERT_EMAIL_TO|notify-deploy-failure|--alert-id|alertId|severity:[[:space:]]*[\"'](critical|warning)"

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
  // 判它等于把"讲过这条规矩"读成"违反了这条规矩"。同理,自检夹具把反例写成**单引号串内嵌
  // 反引号**,所以引号串也要抹;但模板字面量必须留着 —— 那正是本门要读的东西,连它一起抹就等于
  // 把门做瞎(实测 `blankStrings` 一用,自检档立刻看不见真代码)。遮罩一律引 `code-mask`
  // 那一份实现,不在本文件另写词法器(§0.6;等长遮罩,行号不漂)。
  const src = isPs ? maskScriptComments(text, 'ps') : blankQuoteStrings(maskComments(text))
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

/**
 * V3 —— 发信面台账对账(2026-10-18 立,这一维才是今天真正的教训)。
 *
 * 今天那 18 封不是我看不见才没修:量算仪 `alert-volume-report.mjs` 只读 `deploy-loop.log` 一份,
 * 而 git-guardian 那一面寄了 28 封 —— 它的账面上写着 `MAIL=0`。**"覆盖了多少面"这件事本身没有
 * 任何器物对账**,所以一把号称量发信量的尺子可以安静地漏掉最大那个面好几天。
 * 于是本门不只判身份,还判"射程声明":台账里每一条声明 `inScope:true` 的生产者,必须真的落在
 * 本门的 `SCOPE_PREFIXES` 里(否则就是"登了却扫不到"的假覆盖);声明 `inScope:false` 的必须写明
 * 缺口理由 + 出处 + 到期日(否则就是静默缺口);路径在 HEAD 面已不存在 ⇒ 清单腐烂即红。
 * @param {Array<object>} rows 台账解析结果(null ⇒ 由调用方落未判定)
 * @param {Set<string>} headFiles HEAD 面的全部路径
 * @param {{nowMs:number, prefixes?:string[]}} opts
 */
export function judgeMailFaces(rows, headFiles, { nowMs, prefixes = SCOPE_PREFIXES } = {}) {
  const hits = []
  for (const r of rows) {
    const path = String(r?.producerPath || '')
    if (!path) {
      hits.push({ file: MAIL_FACES_LEDGER, line: 1, kind: 'V3/台账形状', detail: '有一条 producerPath 为空' })
      continue
    }
    if (!headFiles.has(path)) {
      hits.push({ file: MAIL_FACES_LEDGER, line: 1, kind: 'V3/清单腐烂', detail: `${path} 在被审面已不存在` })
      continue
    }
    if (r.inScope === true) {
      if (!prefixes.some((p) => path.startsWith(p)))
        hits.push({ file: MAIL_FACES_LEDGER, line: 1, kind: 'V3/假覆盖', detail: `${path} 声明在射程内,但射程里没有它(= 拿没装好的尺子冒充覆盖)` })
      continue
    }
    const gap = [!r.gapReason && '缺口理由', !r.ticket && '出处', !r.until && '到期日'].filter(Boolean)
    if (gap.length) {
      hits.push({ file: MAIL_FACES_LEDGER, line: 1, kind: 'V3/静默缺口', detail: `${path} 声明不在射程却缺 ${gap.join('/')}(§0.10:方向是多要一次说明,绝不是安静放行)` })
      continue
    }
    const untilMs = Date.parse(String(r.until))
    if (!Number.isFinite(untilMs)) {
      hits.push({ file: MAIL_FACES_LEDGER, line: 1, kind: 'V3/到期日不可解', detail: `${path} 的 until=${r.until} ⇒ 等于永久豁免` })
    } else if (untilMs < nowMs) {
      hits.push({ file: MAIL_FACES_LEDGER, line: 1, kind: 'V3/缺口到期回队列', detail: `${path} 的射程缺口已于 ${r.until} 到期,须补判据或重登记` })
    }
  }
  return hits
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

/**
 * V3 的取数:读被审面上的发信面台账 + HEAD 的路径全集。
 * 台账取不到/解不开/枚举为空 ⇒ 一律落未判定(§0.3),不得读成"没有缺口"。
 */
function collectMailFaces(face, nowMs = Date.now()) {
  const text = readFaceTexts(face, [MAIL_FACES_LEDGER])[0]?.text
  if (!text) return { hits: [], undetermined: [`${MAIL_FACES_LEDGER} 在被审面取不到`] }
  let rows
  try {
    rows = JSON.parse(text)
  } catch {
    return { hits: [], undetermined: [`${MAIL_FACES_LEDGER} 解不开(形状坏 ⇒ 既不放行也不冒红,与第三方台账同一条判序)`] }
  }
  if (!Array.isArray(rows) || !rows.length) return { hits: [], undetermined: [`${MAIL_FACES_LEDGER} 枚举到 0 条 ⇒ 判死不记绿`] }
  // 路径全集恒取 HEAD:"这条路径还在不在仓里"问的是仓库事实,与被审面是不是索引无关
  // (索引面判的是内容,不是存在性)。
  const listed = String(gitRaw(['ls-tree', '-r', '--name-only', 'HEAD'], ROOT) || '').split(/\r?\n/)
  if (!listed.length || (listed.length === 1 && !listed[0]))
    return { hits: [], undetermined: ['被审面路径全集取不到 ⇒ 无从判"清单是否腐烂",不记绿'] }
  const discovered = discoverFaceCandidates(face)
  if (discovered === null) return { hits: [], undetermined: ['V4 发现集 git grep 失败 ⇒ 看不见新面就等于没这一维,不记绿'] }
  return {
    hits: [...judgeMailFaces(rows, new Set(listed), { nowMs }), ...judgeFaceCoverage(rows, discovered)],
    undetermined: [],
  }
}

/**
 * V4 —— 发现集对账(2026-10-19 立,立因是 V3 只审"已声明的行")。
 *
 * V3 的台账能钉住"登了却扫不到"和"没写理由的缺口",但它**看不见没登过的新面** ——
 * 今天就是被一次人工审计揪出 `apps/api/src/services/alert-notification-service.ts`:
 * 它自建 nodemailer transport、被 ops-watch-reader 当到人通道用,既不在 faces 台账里,
 * 也不在出口台账里(于是量不到、也拦不到)。"要有人先想到去登记"这件事本身就是漏的。
 *
 * 本维度自己把候选找出来:命中"投递构造"(createTransport / sendMail / Send-MailMessage /
 * Resend key)且同文件里带运维告警标记(ALERT_EMAIL_TO / --alert-id / alertId / severity)的文件,
 * 每一个都必须有台账行。缺行 ⇒ 红,**且命中记在那个新文件自己身上**(不是记在台账文件上)——
 * 否则提交者没动台账文件,差值棘轮看不见这条红,规矩就成了摆设。
 */
const TRANSPORT_RE = /createTransport|sendMail\(|Send-MailMessage|RESEND_API_KEY|api\.resend\.com/
const OPS_RE = /ALERT_EMAIL_TO|notify-deploy-failure|--alert-id|alertId|severity:\s*['"](critical|warning)['"]/
export const FACE_ROLES = ['producer', 'exit', 'measurer', 'guard', 'asset', 'config', 'other']

/** 从 git grep 输出去掉 `HEAD:` 前缀、剔测试夹具,返回相对路径数组。 */
function grepPaths(args, face) {
  let raw
  try {
    raw = gitRaw(args, ROOT)
  } catch (e) {
    if (e?.status === 1) return []
    return null
  }
  return String(raw)
    .split(/\r?\n/)
    .map((l) => l.replace(/^HEAD:/, ''))
    .filter((p) => p && LANG_RE.test(p) && !SKIP_PATH_RE.test(p))
}

export function discoverFaceCandidates(face) {
  const globs = ['--', '*.ts', '*.mjs', '*.cjs', '*.js', '*.ps1']
  const greps = {
    head: ['grep', '-l', '-E', TRANSPORT_SRC, 'HEAD', ...globs],
    staged: ['grep', '--cached', '-l', '-E', TRANSPORT_SRC, ...globs],
    worktree: ['grep', '-l', '-E', TRANSPORT_SRC, ...globs],
  }
  const ops = {
    head: ['grep', '-l', '-E', OPS_SRC, 'HEAD', ...globs],
    staged: ['grep', '--cached', '-l', '-E', OPS_SRC, ...globs],
    worktree: ['grep', '-l', '-E', OPS_SRC, ...globs],
  }
  const t = grepPaths(greps[face] || greps.head, face)
  const o = grepPaths(ops[face] || ops.head, face)
  if (t === null || o === null) return null
  const oSet = new Set(o)
  return [...new Set(t.filter((p) => oSet.has(p)).concat(o.filter((p) => /notify-deploy-failure/.test(p))))].sort()
}

export function judgeFaceCoverage(rows, discovered) {
  const hits = []
  const paths = new Set(rows.map((r) => r?.producerPath))
  for (const r of rows) {
    if (!FACE_ROLES.includes(String(r?.role || '')))
      hits.push({ file: MAIL_FACES_LEDGER, line: 1, kind: 'V4/缺角色', detail: `${r?.producerPath} 没有合法的 role(${FACE_ROLES.join('|')})` })
  }
  for (const d of discovered) {
    if (!paths.has(d)) hits.push({ file: d, line: 1, kind: 'V4/未登记发信面', detail: '命中"投递构造 + 运维告警标记",但 alert-mail-faces.json 里没有这一行' })
  }
  return hits
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
  // V3 与 V1/V2 同一套棘轮与豁免:命中记在台账那个文件名下,锚点 = 该文件 HEAD 自身命中数,
  // 所以"补台账时顺手把一条过期缺口带进来"会被拦,而"别人那格的历史缺口"不会挡住本次提交。
  const facesNow = collectMailFaces(face)
  if (facesNow.undetermined.length) {
    console.log(`未判定:发信面台账这一维取不到 ⇒ ${facesNow.undetermined.join(' ; ')}(不记绿也不冒红)`)
    process.exit(2)
  }
  if (Array.isArray(full.hits)) full.hits.push(...facesNow.hits)
  if (Array.isArray(head.hits)) head.hits.push(...(face === 'head' ? facesNow.hits : collectMailFaces('head').hits))
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
  t('夹具串不算实现,真模板字面量必须仍被抓到(遮罩引号而留反引号的分界)', () => {
    const fixture = 'const case1 = "dedupKey: `x;tip=${p.tipSha}`"'
    if (judgeFile('scripts/a.mjs', fixture).length) throw new Error('自检夹具被当实现判红(门咬自己的解释文字)')
    const real = 'notifyGuardRed(n, d, { dedupKey: `x;tip=${p.tipSha}` })'
    if (!judgeFile('scripts/a.mjs', real).length) throw new Error('真模板字面量读不到 = 门被做瞎(用 blankStrings 就是这一型)')
  })
  t('V3 射程声明对账:假覆盖/静默缺口/到期缺口/清单腐烂四型都红,合规条目不红', () => {
    const files = new Set(['scripts/git-guardian.mjs', 'monitoring/x.cjs', 'monitoring/y.cjs', 'monitoring/z.cjs', 'monitoring/w.cjs', 'apps/ai-service/app/services/a.py'])
    const now = Date.parse('2026-10-18T00:00:00.000Z')
    const ok = [
      { producerPath: 'scripts/git-guardian.mjs', inScope: true },
      { producerPath: 'monitoring/x.cjs', inScope: false, gapReason: '词法未装', ticket: 'G-1', until: '2026-12-31' },
    ]
    if (judgeMailFaces(ok, files, { nowMs: now }).length) throw new Error('合规条目被误判')
    const bad = [
      // 文件在,却声明"在射程内"而射程里没有那个前缀 ⇒ 假覆盖(拿没装好的尺子冒充覆盖)
      { producerPath: 'monitoring/y.cjs', inScope: true },
      // 声明不在射程却不写理由/出处/到期 ⇒ 静默缺口
      { producerPath: 'monitoring/z.cjs', inScope: false },
      // 缺口到期 ⇒ 回队列
      { producerPath: 'apps/ai-service/app/services/a.py', inScope: false, gapReason: 'x', ticket: 't', until: '2026-01-01' },
      // 台账指向 HEAD 面已不存在的路径 ⇒ 清单腐烂
      { producerPath: 'scripts/gone.mjs', inScope: true },
    ]
    const kinds = judgeMailFaces(bad, files, { nowMs: now }).map((h) => h.kind)
    for (const want of ['V3/假覆盖', 'V3/静默缺口', 'V3/缺口到期回队列', 'V3/清单腐烂'])
      if (!kinds.includes(want)) throw new Error(`漏判 ${want},实测 ${kinds.join(' | ')}`)
    // 到期日写成人眼看不懂的形式(比如裸月份)⇒ 等于永久豁免,必须单独红
    const unparse = judgeMailFaces([{ producerPath: 'monitoring/w.cjs', inScope: false, gapReason: 'x', ticket: 't', until: '31/12' }], new Set(['monitoring/w.cjs']), { nowMs: now })
    if (!unparse.some((h) => h.kind === 'V3/到期日不可解')) throw new Error('不可解的到期日没被拦(=静默永久豁免)')
  })
  t('V4 发现集:没登过的新面必须红,且命中记在新文件身上(否则棘轮看不见)', () => {
    const rows = [{ producerPath: 'scripts/known.mjs', role: 'producer', inScope: true }]
    const hits = judgeFaceCoverage(rows, ['scripts/known.mjs', 'monitoring/brand-new.cjs'])
    const miss = hits.find((h) => h.kind === 'V4/未登记发信面')
    if (!miss) throw new Error('没登记的新面没被抓到')
    if (miss.file !== 'monitoring/brand-new.cjs')
      throw new Error(`命中必须落在那个新文件身上(实测 ${miss.file});落在台账文件上的话,提交者没改台账 ⇒ 差值棘轮看不见这条红,规矩成摆设`)
    const both = [
      ...rows,
      { producerPath: 'monitoring/brand-new.cjs', role: 'producer', inScope: false, gapReason: 'x', ticket: 't', until: '2099-01-01' },
    ]
    const after = judgeFaceCoverage(both, ['scripts/known.mjs', 'monitoring/brand-new.cjs'])
    if (after.length) throw new Error(`全登记了还判红 = 恒红门之始:${JSON.stringify(after)}`)
    if (!judgeFaceCoverage([{ producerPath: 'scripts/norole.mjs', inScope: true }], ['scripts/norole.mjs']).some((h) => h.kind === 'V4/缺角色'))
      throw new Error('没有 role 的条目必须红(否则"这条到底发不发信"读不出来)')
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
  judgeMailFaces,
  judgeFaceCoverage,
  discoverFaceCandidates,
  collectMailFaces,
  FACE_ROLES,
  listProducerPaths,
  MAIL_FACES_LEDGER,
  EXEMPTION_LEDGER,
  PRODUCER_RE,
  SKIP_PATH_RE,
  VOLATILE_RULES,
  SANCTIONED_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
