#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-plan-sha-form.mjs — 短 sha 当出处指针的**形态**防回潮门(票 G-1079146,warn 起步)
 *
 * 这是什么 / 不是什么:
 *   票面量算尺 `check-plan-sha-resolvable.mjs` 答"这枚短 sha 在**本机**解析不解析"(可解析性,
 *   寄生在本机对象库 + lineage);本门答"**新增行**里新写进去的 7–12 位短写,登记当时有没有
 *   带上可机械判的非提交依据"。可解析性归量算尺,登记形态归本门 —— 两把尺子各判各的结论,
 *   不得互相顶账(本门不跑 git cat-file 探测;量算尺不读台账)。全量 40 位不在本门射程
 *   (票面实测零枚 40 位腐烂,写全量是合规形态)。
 *
 * 票面四条前置的落地位置(没满足就别接线 —— 接线前逐条自证):
 *   ① 只吃**新增行** + 差值棘轮:`newLinesOf`(索引 blob vs HEAD blob 的**行多重集差**;
 *      HEAD 里逐字也有的行一律算存量,存量千枚级只报数,永不判红)。
 *   ② 三条可机械判的放过住在**判据侧**(本文件常量),不是措辞侧:
 *      `decl-prefix`(声明表前缀:revision/contenthash/integrity/serial/deviceid/rowid/
 *       storehash/fakeoid/上游/冻结上游/外部仓 + [=:：@] + 可选反引号,紧贴 token)/
 *      `filename`(文件名形态:后随 `.<ext>` 或行内以 `/` 收尾的路径段)/
 *      `ref-segment`(ref 名内段:token 后紧连 `-`/`_`/`/`+词)。
 *      抽取式只此一份:`HEX_RUN_RE`/`classifyShape`/`extractFromLine` 一律 import 自
 *      `./check-plan-sha-resolvable.mjs`(§22c,禁止抄第二份边界扫描)。
 *   ③ 具名台账 `scripts/data/plan-sha-noncommit.json`:逐条 `token+kind+reason+reviewBy`,
 *      缺字段 / 日期非法 / 到期 / **被审面没命中(清单腐烂)** / 重复 token 都判红;
 *      **刻意不给行内豁免**(正文里写 `-exempt:` 标记不构成放行,台账是唯一通道;
 *      该族已同笔进守门 108 的 FAMILY_LIFETIME_DAYS,两道门分属寿命档与合法性,不互顶账)。
 *   ④ 取材走 `lib/face-reader.mjs` 的 `catBatch`(HEAD/索引 blob 面,不读工作区);
 *      自检阳性对照用**构造夹具钉死**,不钉任何会移动的 HEAD 内容。
 *
 * 棘轮方向(与守门 167/121 同族):全量档(HEAD 面)只报数恒 exit 0;`--staged` 判
 *   本次改动动过 PROJECT_PLAN.md 时的新增行,违规 ⇒ 1。台账腐烂在两档都判红
 *   (台账不是"存量",是本门自己的数据 —— 它烂了等于尺子烂了,报数没有意义)。
 *
 * 已知判不了格(如实登记,不得读成"已确认没有"):
 *   ① 通道的假阴性:ref 名内段/路径段会放过个别真被截短的 commit 指针(如 `docs/abc1234`)
 *      —— 票面原话:抽取式的边界类改写"结构上摘不出射程",这是设计接受的换价;
 *      兜底是量算尺的可解析性对账(两把尺子独立运行)。
 *   ② 逐字相同的行**复制一份**按 diff 语义算新增(HEAD 同文配额用尽)—— 与真 diff hunk 一致;
 *      纯"挪位"(HEAD 里同文配额未耗尽)不算新增。
 *   ③ 台账 token 与被审面的命中按**逐字 token**判:台账登记短写、正文后来改写成全量 40 位
 *      ⇒ 判"面没命中"红 —— 这是刻意的(票面:加注后应改判或删条目,不是留着静默过期)。
 *
 * 手动:
 *   node scripts/check-plan-sha-form.mjs               # 全量档(HEAD blob):只报数,恒 exit 0(除台账腐烂/判死)
 *   node scripts/check-plan-sha-form.mjs --staged      # 提交链:新增行违规或台账问题 ⇒ exit 1
 *   node scripts/check-plan-sha-form.mjs --json        # 机器可读
 *   node scripts/check-plan-sha-form.mjs --self-test   # 构造面正反对照,零 git、零写盘
 * 退出码:0 过 / 1 判红(--staged 违规;台账腐烂两档皆红)/ 2 判不了(面取不到、台账缺失或非 JSON、空扫)。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, assertRepoRoot, catBatch, gitRaw, selectFace } from './lib/face-reader.mjs'
// 抽取式与形状判定只此一份(§22c):HEX_RUN_RE 边界纪律 / classifyShape / extractFromLine
// 全部住在量算尺,本门 import 消费,禁止再写一份"什么是 sha 形态"。
import { classifyShape, extractCandidates, extractFromLine } from './check-plan-sha-resolvable.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const GATE = 'check-plan-sha-form'
export const PLAN_PATH = 'PROJECT_PLAN.md'
export const LEDGER_PATH = 'scripts/data/plan-sha-noncommit.json'
const GIT_TIMEOUT = 120000

/** 声明表前缀(判据侧常量表,票面前置②第一通道):名词 + 可选分隔符 + 可选反引号,紧贴 token。 */
export const DECLARATION_PREFIX_RE =
  /(?:\b(?:upstream\s+)?(?:revision|rev|commithash|contenthash|integrity|sha\d{0,3}|serialno|serialnumber|serial|deviceid|rowid|storehash|bundlehash|fakeoid)\b|上游(?:仓库)?|冻结上游|外部仓)\s*[=:：@]?\s*`?\s*$/i

/** 文件名/ref 形态通道(判据侧常量表,票面前置②第二、三通道)。 */
export function shapeChannel(before, after) {
  if (/^\.[A-Za-z0-9]{1,10}(?![\w-])/.test(after)) return 'filename'
  if (/\/$/.test(before)) return 'filename'
  if (/^[-_/][\w-]/.test(after)) return 'ref-segment'
  return null
}

/**
 * 新增行 = 行多重集差(索引面有、HEAD 面同文本配额已用尽的行)。
 * 不引外部 diff 解析:逐字同文即存量 —— 票面 ① 的最小机械实现,边界见头注"已知判不了格②"。
 */
export function newLinesOf(headText, faceText) {
  const countOf = (t) => {
    const m = new Map()
    for (const l of String(t ?? '').split(/\r?\n/)) m.set(l, (m.get(l) || 0) + 1)
    return m
  }
  const head = countOf(headText)
  const out = []
  const lines = String(faceText ?? '').split(/\r?\n/)
  const used = new Map()
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const u = used.get(l) || 0
    used.set(l, u + 1)
    if ((head.get(l) || 0) > u) continue
    out.push({ line: i + 1, text: l })
  }
  return out
}

/** 在一行里定位抽取出的 token(抽取有序,indexOf 顺序推进即可),带上 before/after 上下文。 */
function locateTokens(line) {
  const cands = extractFromLine(line, 1)
  let from = 0
  return cands.map((c) => {
    const at = line.indexOf(c.token, from)
    from = at + c.token.length
    return {
      ...c,
      at,
      before: line.slice(Math.max(0, at - 48), at),
      after: line.slice(at + c.token.length, at + c.token.length + 16),
    }
  })
}

/**
 * 台账校验(纯函数):逐条 token+kind+reason+reviewBy,缺字段/日期非法/过期/面没命中/重复都算 problem。
 * @param {unknown} raw 解析后的台账 JSON
 * @param {Set<string>} faceTokens 被审面上全部 candidate 形态 token(小写)
 * @param {string} today YYYY-MM-DD(UTC;自检注入固定值)
 */
export function validateLedger(raw, faceTokens, today) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Undetermined(`${LEDGER_PATH} 根必须是对象(实得 ${raw === null ? 'null' : typeof raw})`)
  if (!Array.isArray(raw.entries)) throw new Undetermined(`${LEDGER_PATH} 缺 entries 数组`)
  const problems = []
  const tokens = new Set()
  const seen = new Set()
  for (const [i, e] of raw.entries.entries()) {
    const at = `entries[${i}]`
    const miss = ['token', 'kind', 'reason', 'reviewBy'].filter(
      (k) => typeof e?.[k] !== 'string' || e[k].trim() === '',
    )
    if (miss.length) {
      problems.push({ entry: at, why: `缺字段:${miss.join('/')}` })
      continue
    }
    const tok = e.token.trim().toLowerCase()
    if (!/^[0-9a-f]{7,40}$/.test(tok)) {
      problems.push({ entry: at, why: `token 不是 sha 形态:${e.token}` })
      continue
    }
    if (seen.has(tok)) problems.push({ entry: at, why: `token 重复登记:${tok}` })
    seen.add(tok)
    const dm = /^(20\d{2})-(\d{2})-(\d{2})$/.exec(e.reviewBy.trim())
    const okDate =
      dm && Number(dm[2]) >= 1 && Number(dm[2]) <= 12 && Number(dm[3]) >= 1 && Number(dm[3]) <= 31
    if (!okDate) problems.push({ entry: at, why: `reviewBy 不是合法日期:${e.reviewBy}` })
    else if (e.reviewBy.trim() < today)
      problems.push({ entry: at, why: `reviewBy 已过期(${e.reviewBy.trim()} < ${today})` })
    if (!faceTokens.has(tok))
      problems.push({ entry: at, why: `被审面没有该 token(清单腐烂):${tok}` })
    tokens.add(tok)
  }
  return { tokens, problems }
}

/**
 * 纯判据核心(镜像主战场):对新增行判"新写进去的短 sha 有没有带上非提交依据"。
 * 全量 40 位与形状歧义(全数字/紧跟 #/长度出档)都不进判(量算尺与它自己的口径管)。
 */
export function judgeNewLines(newLines, ledgerTokens) {
  const violations = []
  const passed = []
  let scanned = 0
  for (const nl of newLines) {
    for (const c of locateTokens(nl.text)) {
      if (c.shape.kind !== 'candidate') continue
      if (c.token.length === 40) continue
      scanned++
      if (ledgerTokens.has(c.token.toLowerCase())) {
        passed.push({ line: nl.line, token: c.token, channel: 'ledger', form: c.form })
        continue
      }
      const chan = DECLARATION_PREFIX_RE.test(c.before)
        ? 'decl-prefix'
        : shapeChannel(c.before, c.after)
      if (chan) {
        passed.push({ line: nl.line, token: c.token, channel: chan, form: c.form })
        continue
      }
      violations.push({
        line: nl.line,
        token: c.token,
        form: c.form,
        excerpt: nl.text.trim().slice(0, 60),
      })
    }
  }
  return { scanned, violations, passed }
}

/** 退出码决策(纯函数)。台账腐烂两档皆红;内容违规只在 --staged 判红;判死一律 2。 */
export function decide({ mode, violations, ledgerProblems, undetermined, faceCandidates }) {
  if (undetermined.length) return 2
  if (faceCandidates === 0) return 2 // 抽不到任何 sha 形态 ⇒ 抽取式或台账格式漂了,判死不是通过
  if (ledgerProblems.length) return 1
  if (mode === 'staged' && violations.length) return 1
  return 0
}

const utcToday = () => new Date().toISOString().slice(0, 10)

/** 各面取材:面 = PROJECT_PLAN.md 的 blob(head/索引);台账 = 工作树数据文件(门自己的输入)。 */
export function analyze(root, face, { today = utcToday() } = {}) {
  let effFace = face
  let touched = true
  if (face === 'staged') {
    const staged = gitRaw(
      ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
      root,
      { timeout: GIT_TIMEOUT },
    )
      .split('\0')
      .filter((p) => p === PLAN_PATH)
    if (staged.length === 0) {
      effFace = 'head' // 本次没动计划面 ⇒ 回落全量只报数(棘轮不空转)
      touched = false
    }
  }
  const faceSpec = effFace === 'staged' ? `:${PLAN_PATH}` : `HEAD:${PLAN_PATH}`
  const got = catBatch(root, [faceSpec, `HEAD:${PLAN_PATH}`], {
    maxBuffer: 1 << 29,
    timeout: GIT_TIMEOUT,
  })
  const faceText = got.get(faceSpec) ?? null
  const headText = got.get(`HEAD:${PLAN_PATH}`) ?? null
  if (faceText === null) throw new Undetermined(`${effFace} 面取不到 ${PLAN_PATH} 的 blob`)
  if (headText === null) throw new Undetermined(`HEAD 面取不到 ${PLAN_PATH} 的 blob`)

  let ledgerRaw
  try {
    ledgerRaw = JSON.parse(readFileSync(resolve(root, LEDGER_PATH), 'utf8'))
  } catch (e) {
    throw new Undetermined(`台账读不到/解析不了 ${LEDGER_PATH}:${e?.message ?? e}`)
  }
  // faceTokens:被审面上全部 candidate 形态 token(小写)—— 台账"被审面没命中"的对账面
  const faceTokens = new Set()
  let faceCandidates = 0
  let stockShort = 0
  const stockTokens = new Set()
  for (const c of extractCandidates(faceText)) {
    if (c.shape.kind !== 'candidate') continue
    faceCandidates++
    faceTokens.add(c.token.toLowerCase())
    if (c.token.length !== 40) {
      stockShort++
      stockTokens.add(c.token.toLowerCase())
    }
  }
  const ledger = validateLedger(ledgerRaw, faceTokens, today)
  const newLines = effFace === 'staged' ? newLinesOf(headText, faceText) : []
  const { scanned, violations, passed } = judgeNewLines(newLines, ledger.tokens)
  const undetermined = []
  const exit = decide({ mode: effFace, violations, ledgerProblems: ledger.problems, undetermined, faceCandidates })
  return {
    gate: GATE,
    face: effFace,
    planTouched: touched,
    faceCandidates,
    stockShort,
    stockTokens: stockTokens.size,
    newLines: newLines.length,
    scanned,
    violations,
    passed,
    ledger: { file: LEDGER_PATH, entries: ledger.tokens.size, problems: ledger.problems },
    undetermined,
    exit,
  }
}

/** 自检:构造面成对正反例,零副作用、零 git、零写盘。cond 一律是已求值布尔(IIFE)。 */
function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran++
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail++
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }
  const TODAY = '2026-10-08'
  const HEAD = '存量行:提交 `fd595ae2c33` 落地\n'
  // S1 阳性对照(票面前置④:构造夹具,不钉 HEAD):新增行裸写短 sha、无任何通道 ⇒ 违规
  const J = (faceText, ledgerEntries = []) =>
    judgeNewLines(
      newLinesOf(HEAD, faceText),
      validateLedger({ entries: ledgerEntries }, new Set(['deadbee12']), TODAY).tokens,
    )
  eq('S1 新增行裸短 sha ⇒ 违规', (() => J(`${HEAD}新行:提交 \`ab12cd34e5\` 落地\n`).violations.length)(), 1)
  eq('S1 违规点名 token', (() => J(`${HEAD}新行:提交 \`ab12cd34e5\` 落地\n`).violations[0]?.token)(), 'ab12cd34e5')
  // S2 存量行(两版逐字同文)不进新增面;复制一份则按 diff 语义算新增(头注②)
  eq('S2 存量行不算新增', (() => newLinesOf(HEAD, HEAD + '别的内容\n').length)(), 1)
  eq('S2b 复制同文行配额用尽 ⇒ 按新增判', (() => J(`${HEAD}存量行:提交 \`fd595ae2c33\` 落地\n`).violations.length)(), 1)
  // S3 全量 40 位不在射程;形状歧义(全数字)不进判
  eq('S3 全量 40 不判', (() => J(`${HEAD}新行:oid 08abe3d76346cd927a6038c059e421ace1f9611f\n`).violations.length)(), 0)
  eq('S3b 全数字日期不进判', (() => J(`${HEAD}新行:2026-10-08 记录\n`).scanned)(), 0)
  // S4 三条判据侧通道(票面前置②)
  eq('S4 声明前缀放过', (() => J(`${HEAD}新行:外部仓 revision:\`abc1234ef\` 冻结\n`).violations.length)(), 0)
  eq('S4b 通道=decl-prefix', (() => J(`${HEAD}新行:外部仓 revision:\`abc1234ef\` 冻结\n`).passed[0]?.channel)(), 'decl-prefix')
  eq('S5 文件名形态放过', (() => J(`${HEAD}新行:产物 dist/app.deadbee12.js 已发布\n`).passed[0]?.channel)(), 'filename')
  eq('S6 ref 段放过', (() => J(`${HEAD}新行:分支 workbuddy/deadbee12-fix 已删\n`).passed[0]?.channel)(), 'filename')
  eq('S6b 后连字符也是 ref 段', (() => shapeChannel('前缀 ', '-deadbee12-x'))(), 'ref-segment')
  eq('S6c 裸 @ 前缀不放行(无声明名词)', (() => J(`${HEAD}新行:见 @deadbee12 的提交\n`).violations.length)(), 1)
  // S7 台账通道(票面前置③)
  eq(
    'S7 台账命中放过',
    (() =>
      J(`${HEAD}新行:上游仍是 \`29628c9\`\n`, [
        { token: '29628c9', kind: 'external-revision', reason: '上游冻结 revision', reviewBy: '2026-11-07' },
      ]).violations.length)(),
    0,
  )
  eq(
    'S7b 通道=ledger',
    (() =>
      J(`${HEAD}新行:上游仍是 \`29628c9\`\n`, [
        { token: '29628c9', kind: 'external-revision', reason: 'x', reviewBy: '2026-11-07' },
      ]).passed[0]?.channel)(),
    'ledger',
  )
  // S8 台账四格腐烂(缺字段/日期非法/过期/面没命中/重复)
  const V = (entries) => validateLedger({ entries }, new Set(['deadbee12']), TODAY).problems
  eq('S8 缺字段 ⇒ problem', (() => V([{ token: 'deadbee12', kind: 'x', reason: '' }]).length)(), 1)
  eq('S8b 日期非法 ⇒ problem', (() => V([{ token: 'deadbee12', kind: 'x', reason: 'y', reviewBy: '2026-13-40' }]).length)(), 1)
  eq('S8c 过期 ⇒ problem', (() => V([{ token: 'deadbee12', kind: 'x', reason: 'y', reviewBy: '2026-10-01' }])[0]?.why)(), 'reviewBy 已过期(2026-10-01 < 2026-10-08)')
  eq('S8d 面没命中 ⇒ problem', (() => V([{ token: 'cafebabe12', kind: 'x', reason: 'y', reviewBy: '2026-11-07' }])[0]?.why.includes('清单腐烂'))(), true)
  eq('S8e 重复 ⇒ problem', (() => V([
    { token: 'deadbee12', kind: 'x', reason: 'y', reviewBy: '2026-11-07' },
    { token: 'deadbee12', kind: 'z', reason: 'w', reviewBy: '2026-11-07' },
  ]).length)(), 1)
  eq('S8f 干净台账 ⇒ 0 problem', (() => V([{ token: 'deadbee12', kind: 'x', reason: 'y', reviewBy: '2026-11-07' }]).length)(), 0)
  // S9 退出码三臂(纯函数)
  eq('S9 --staged 违规 ⇒ 1', (() => decide({ mode: 'staged', violations: [{}], ledgerProblems: [], undetermined: [], faceCandidates: 3 }))(), 1)
  eq('S9b 全量档违规只报数 ⇒ 0', (() => decide({ mode: 'head', violations: [{}], ledgerProblems: [], undetermined: [], faceCandidates: 3 }))(), 0)
  eq('S9c 台账腐烂两档皆红', (() => decide({ mode: 'head', violations: [], ledgerProblems: [{}], undetermined: [], faceCandidates: 3 }))(), 1)
  eq('S9d 未判定 ⇒ 2', (() => decide({ mode: 'head', violations: [], ledgerProblems: [], undetermined: [{}], faceCandidates: 3 }))(), 2)
  eq('S9e 空普查判死 ⇒ 2', (() => decide({ mode: 'head', violations: [], ledgerProblems: [], undetermined: [], faceCandidates: 0 }))(), 2)
  // S10 判据单一性:抽取式必须来自量算尺(§22c 的机器形状)
  eq('S10 classifyShape 来自量算尺', (() => classifyShape('fd595ae2c33').kind)(), 'candidate')

  console.log(`自检:${ran - fail}/${ran} 通过`)
  return fail === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const root = ROOT
  try {
    assertRepoRoot(root, GATE)
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
    return 2
  }
  const { face, error } = selectFace({ staged: argv.includes('--staged'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  let out
  try {
    out = analyze(root, face)
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : e?.message ?? String(e)}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
    return out.exit
  }
  for (const p of out.ledger.problems) console.error(`   台账 ${p.entry}:${p.why}`)
  if (out.violations.length) {
    const tag = out.face === 'staged' ? '本次新增行里' : '存量(全量档只报数,不判红)'
    console.error(`❌ 检出 ${out.violations.length} 枚新增短 sha 短写、无可机械判的非提交依据(${tag}):`)
    for (const v of out.violations.slice(0, 40))
      console.error(`   L${v.line} ${v.token} [${v.form}] ${v.excerpt}`)
    console.error(
      '   出路:① 写全量 40 位;② 换内容锚点(编号 + 标题原文);③ 确属非提交指针(设备序列号/contenthash/',
      'ref 段/外部仓 revision…)⇒ 进台账 scripts/data/plan-sha-noncommit.json(token+kind+reason+reviewBy)。',
    )
  }
  const l = out.ledger
  console.log(
    `${out.exit === 0 ? '✅' : out.exit === 2 ? '❌ 无法判定' : '❌ 判红'} [${out.face}]${out.planTouched ? '' : '(计划面本次未动 ⇒ 回落全量只报数)'}` +
      ` 面候选 ${out.faceCandidates} / 存量短写 ${out.stockTokens} 枚 / 新增行 ${out.newLines} / 新增短写 ${out.scanned} / 违规 ${out.violations.length} / 放过 ${out.passed.length}` +
      ` / 台账 ${l.entries} 条(问题 ${l.problems.length})`,
  )
  return out.exit
}

// §22d 双形态入口:被 import(镜像测试/同族门)时不跑 main
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ 脚本自身异常(exit 2): ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  GATE,
  PLAN_PATH,
  LEDGER_PATH,
  DECLARATION_PREFIX_RE,
  shapeChannel,
  newLinesOf,
  validateLedger,
  judgeNewLines,
  decide,
  analyze,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
