// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 超龄认领牌自动摘除器(2026-10-22 立;承 AGENTS §1「认领即租约」+ 机主当日判定「无席位在飞」)。
 *
 * 立因:本席手工摘掉 57 枚死牌落地后,一枚并发的活文档合并把**摘牌前的旧形态行**当"对侧独有
 * 新增"补了回来(§1 已登记为通道③,归在册票 G-32「归并侧那半格仍未收口」)。人工重放一次就再被
 * 吞一次 —— 那是掰苞米,不是交付。所以这一格必须有器物,而且落地必须走带 `removed` 声明的通道:
 * 把旧形态行逐字写进 `LAND_CLASH_SCOPE.removed` ⇒ object-space-land 的行级复活守卫知道"这些行是
 * 本侧有意改写掉的",后续 union 不得再从对侧取回。
 *
 * 摘谁(三条缺一不落):
 *   ① 形态是完整租约(`@日期/持有者`,判据 import 守门 109 的同一份 `claimMarkOf`,本器零复算);
 *   ② 年龄 > TTL(默认 72h,与守门 109 同源 `resolveTtlHours`)—— 正在干活的席位会续租,
 *      所以"只摘超龄"本身就构成对活席位的最小抢活面;超龄按 §1 早已是判红项,代摘是执行既有纪律;
 *   ③ 台账工作树净(`git status --porcelain -- PROJECT_PLAN.md` 为空)。脏 ⇒ **整批让路**,
 *      因为共享树里那一份可能是别席正在写的现场(§12 不代他人未提交内容)。
 * 不摘:未超龄租约、日期取不到的(§0.3 不猜)。裸 `（进行中）` **2026-10-22 起改为默认代摘**:
 * 依据不是"机主口头说没有 agent 在跑"那种易失状态,而是**同批改判据**——守门 109 新增 CL4 在提交链
 * 拦住裸标记的新增,而本器只读 HEAD 面 ⇒ 别人刚写下还没提交的裸标记进不了射程,摘存量踩不到干活的人。
 * 出处句由 `IHUI_CLAIM_STRIP_LEGACY_RULING` 覆盖,写进留痕条目的 `ruling` 字段(不写进台账行)。
 * 可追责性的真相源 = 仓外留痕 `.ihui-agent/state/stale-claim-strip.jsonl`(逐条存原牌/超龄/前后整行/落地枚)
 * 加提交信息;行内只留 `#seq` 指针 —— 因为注记本身会被活文档归并洗掉(实测一轮 64 枚只剩 6 枚)。
 *
 * 守恒(改写档,与"完成即删"的删行档不同):
 *   C1 总行数不变(只改写,不增删);
 *   C2 未被摘除的行逐字节等值(一行不许顺手动);
 *   C3 摘后重算的挂牌集必须**恰好等于**本轮 held 集(既不得多摘一条,也不得少摘一条)。
 * 任一不过 ⇒ 整批不落并落 `refused`/`undetermined`,不"放行后少改一行"。
 *
 * 落地唯一通道:`scripts/object-space-land.mjs`(blob 档 + 行级复活守卫 + CAS,从不写工作树),
 * 落地后自带 `scripts/git-push-guard.mjs` 推送腿 —— 旁路落地不跑 post-commit,推送不会自己发生(§1 通道①)。
 *
 * 退出码:0 = clean|stripped / 2 = refused|undetermined|守恒不过(本器不产出 all-held 那一档 ——
 * "一条都摘不动"与"无牌可摘"在这里是同一个 clean,区别只在 held 报数,不另造假态)。
 * 真出口(§0.8:只写跑得通的):
 *   只读预演 `node scripts/strip-stale-claim-marks.mjs --dry-run`
 *   判据自证 `node scripts/strip-stale-claim-marks.mjs --self-test`
 *   停用派发 = 摘掉 `git-guardian.mjs` 里那行 `sweepStaleClaimMarks()` 调用(人工、带理由);
 *   节流台账 `.ihui-agent/state/stale-claim-strip-last.json`(未到窗口本轮不派发)。
 * 裸标记需机主具名授权才代摘:`IHUI_CLAIM_STRIP_LEGACY_RULING="<原话>"`(注记里逐字留出处)。
 */
import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
  mkdirSync,
  statSync,
} from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { claimMarkOf } from './lib/plan-task-index.mjs'
import { gitRaw } from './lib/face-reader.mjs'
import { __test__ as claims } from './check-task-claims.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'
const HOUR_MS = 3600000
const DEFAULT_LEGACY_RULING =
  '机主 2026-10-22 定档:认领必须写全 @日期/持有者,裸标记的新增已由守门 109 CL4 在提交链拦住,故存量由本器代摘'

/**
 * 行内注记 = **最小指针**。为什么不在行内写原牌与依据(2026-10-22 实测否掉):
 * 摘牌注记会被活文档归并整批洗掉(一轮 64 枚只剩 6 枚),而未勾行本来平均 1859 字 ⇒
 * 行内写得越详细,既是噪音又越保不住,两头亏。可追责性改由仓外 JSONL 留痕承载(见 `buildEntries`)。
 */
function releaseNote({ seq }, seat, asOf) {
  return `（认领已释放@${asOf}/${seat}#${seq}）`
}

/** 留痕条目的唯一键清单:器物自产与补写都必须走它,否则一本账里会出现两种形状。 */
export const LEDGER_KEYS = [
  'seq',
  'at',
  'seat',
  'file',
  'line',
  'planSha',
  'form',
  'mark',
  'claimDate',
  'holder',
  'ageHours',
  'ttlHours',
  'ruling',
  'rowBefore',
  'rowAfter',
  'source',
  'landedSha',
]

function shapeEntry(e) {
  const missing = LEDGER_KEYS.filter((k) => !(k in e))
  if (missing.length > 0) throw new Error(`留痕条目缺字段:${missing.join(',')} ⇒ 拒绝(不许半形状落盘)`)
  return Object.fromEntries(LEDGER_KEYS.map((k) => [k, e[k]]))
}

/** 留痕条目:每条等于判据在摘那一刻的读数,逐字段可复算,不是另写一份叙事。 */
export function buildEntries(plan, { stamp, at, seat, planSha }) {
  return plan.leases.map((r, i) =>
    shapeEntry({
      seq: `${stamp}-${i}`,
      at,
      seat,
      file: FILE,
      line: r.line,
      planSha,
      form: r.mark.form,
      mark: r.mark.mark,
      claimDate: r.mark.date ?? null,
      holder: r.mark.holder ?? null,
      ageHours: r.ageH === null ? null : r.ageH,
      ttlHours: plan.ttlHours ?? null,
      ruling: r.ownerRuling ?? null,
      rowBefore: r.raw,
      rowAfter: plan.linesAfter.get(r.line) ?? null,
      source: 'strip',
      landedSha: null,
    }),
  )
}

/** 收敛器补写历史注记时用的同一构造口(字段清单只有 `LEDGER_KEYS` 一份)。 */
export function backfillEntry(f) {
  return shapeEntry({ ...f, file: FILE, source: 'backfill' })
}

/** 落地后回填 rowAfter 与 landedSha(留痕必须能指回那枚提交,否则只是自述)。 */
export function sealEntries(entries, { landedSha, plan }) {
  const afterByLine = new Map(plan.linesAfter.entries())
  return entries.map((e) => ({ ...e, landedSha, rowAfter: afterByLine.get(e.line) ?? null }))
}

/** 留痕读数(只判形状,不据此判红)。空文件 ⇒ undetermined,绝不用 0 冒充"没摘过"(§0.3)。 */
export function reportLedger(text) {
  const s = String(text ?? '')
  if (s.trim() === '') return { undetermined: true, why: '留痕文件为空或读不到', lines: 0, malformed: 0, forms: {} }
  let lines = 0
  let malformed = 0
  const forms = {}
  for (const raw of s.split('\n')) {
    if (raw.trim() === '') continue
    let o
    try {
      o = JSON.parse(raw)
    } catch {
      malformed++
      continue
    }
    if (!o || typeof o !== 'object' || typeof o.seq !== 'string' || typeof o.at !== 'string') {
      malformed++
      continue
    }
    lines++
    forms[o.form] = (forms[o.form] || 0) + 1
  }
  if (lines === 0) return { undetermined: true, why: '一行都没解出来(全是畸形)', lines: 0, malformed, forms }
  return { undetermined: false, lines, malformed, forms }
}

/** 老化:只按窗口裁,且**必须报出被裁条数**(静默删等于没有记录;§"工作队列必须有死亡机制")。 */
export function pruneLedger(text, { nowMs, keepDays = 90 }) {
  const cut = nowMs - keepDays * 86400000
  const kept = []
  let pruned = 0
  let malformed = 0
  for (const raw of String(text ?? '').split('\n')) {
    if (raw.trim() === '') continue
    let o
    try {
      o = JSON.parse(raw)
    } catch {
      malformed++
      kept.push(raw)
      continue
    }
    const ms = Date.parse(String(o.at ?? ''))
    if (!Number.isFinite(ms) || ms < cut) {
      pruned++
      continue
    }
    kept.push(raw)
  }
  return { text: kept.join('\n') + (kept.length ? '\n' : ''), kept: kept.length, pruned, malformed }
}

/**
 * 核心判据(纯函数):把台账文本分成「可摘 / 本轮不动」两集,并产出改写后的文本。
 * @param {string} text 台账全文(一律取被审面,不读磁盘)
 * @param {{nowMs:number, ttlHours:number, seat:string, asOf:string, legacyByOwnerRuling?:string|null}} opts
 *   `legacyByOwnerRuling` = 机主判定"无席位在飞"的那句话(带日期)。给了才摘裸标记,并在注记里
 *   逐字留下授权出处;不给 ⇒ 裸标记一律只报数(§0.3:年龄判不出来就不猜)。
 */
export function planSweep(
  text,
  { nowMs, ttlHours, seat, asOf, stamp = null, legacyByOwnerRuling = DEFAULT_LEGACY_RULING, skipLines = [] },
) {
  const lines = String(text).split('\n')
  const skip = new Set(Array.isArray(skipLines) ? skipLines.map((n) => Number(n)) : [])
  const leases = []
  const held = []
  for (let i = 0; i < lines.length; i++) {
    const m = claimMarkOf(lines[i])
    if (!m) continue
    if (skip.has(i + 1)) {
      // 护栏③(2026-10-23 收窄后):这一行的旧形态已被别席就地改写 ⇒ 只让路它自己,
      // 不再拉整批陪绑。4 枚在飞、41 枚能摘 —— 少数在飞的必须只挡自己。
      held.push({ line: i + 1, raw: lines[i], why: '旧形态行被别席就地改写 ⇒ 本轮让路(交人工)' })
      continue
    }
    if (m.form === 'legacy') {
      if (legacyByOwnerRuling) {
        leases.push({ line: i + 1, raw: lines[i], mark: m, ageH: null, ownerRuling: legacyByOwnerRuling })
      } else {
        held.push({ line: i + 1, raw: lines[i], why: '裸标记无日期,年龄不可判(需机主具名授权才代摘)' })
      }
      continue
    }
    if (!m.date) {
      held.push({ line: i + 1, raw: lines[i], why: '形态不可辨' })
      continue
    }
    const ageH = Math.round((nowMs - Date.parse(`${m.date}T00:00:00Z`)) / HOUR_MS)
    if (!Number.isFinite(ageH)) {
      held.push({ line: i + 1, raw: lines[i], why: '日期取不到龄,不猜' })
      continue
    }
    if (ageH <= ttlHours) {
      held.push({ line: i + 1, raw: lines[i], why: `未超龄(${ageH}h ≤ ${ttlHours}h)` })
      continue
    }
    leases.push({ line: i + 1, raw: lines[i], mark: m, ageH })
  }

  const stampUsed = stamp ?? nowMs.toString(36)
  const removed = []
  const added = []
  const linesAfter = new Map()
  const out = [...lines]
  leases.forEach((r, i) => {
    const idx = r.line - 1
    r.seq = `${stampUsed}-${i}`
    const note = releaseNote({ seq: r.seq }, seat, asOf)
    const after = out[idx].slice(0, r.mark.at) + note + out[idx].slice(r.mark.at + r.mark.mark.length)
    removed.push(out[idx])
    added.push(after)
    linesAfter.set(r.line, after)
    out[idx] = after
  })
  const strippedText = out.join('\n')

  // C1 行数守恒
  const c1 = out.length === lines.length
  // C2 只动被摘那几行:未摘行逐字节等值
  const touched = new Set(leases.map((r) => r.line - 1))
  let c2 = true
  for (let i = 0; i < lines.length; i++) if (!touched.has(i) && lines[i] !== out[i]) c2 = false
  // C3 摘后挂牌集 == held 集(逐行文本比对),既不许多摘也不许多留
  const afterClaims = out
    .map((l, i) => ({ line: i + 1, raw: l, mark: claimMarkOf(l) }))
    .filter((r) => r.mark !== null)
  const heldKeys = new Set(held.map((h) => h.raw))
  const c3 = afterClaims.length === held.length && afterClaims.every((r) => heldKeys.has(r.raw))

  return {
    leases,
    held,
    text: strippedText,
    removed,
    added,
    linesAfter,
    ttlHours,
    stamp: stampUsed,
    ok: c1 && c2 && c3,
    why: !c1 ? 'C1 行数变了(本器只改写,不增删行)' : !c2 ? 'C2 有未列入摘除集的行被改动' : !c3 ? 'C3 摘后挂牌集不等于本轮跳过集(多摘或少摘)' : '',
  }
}

/**
 * 注记里的日期用**本地日**,不用 UTC 日:2026-10-22 实测器物把当天上午摘的牌写成 `@2026-10-21`
 * (UTC 差 8 小时),结果按日期收敛时整批 58 枚被漏掉 —— 日期对不上账,比写错更难查。
 * 留痕的 `at` 字段仍是 ISO 时刻(可排序、可比年龄),两者各有各的用途。
 */
export function localDay(ms) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const LEDGER_FILE = () => path.join(ROOT, '.ihui-agent', 'state', 'stale-claim-strip.jsonl')

/**
 * 追加留痕并就地老化。**必须打印被裁条数** —— 静默删等于这一族从来没发生过。
 * 写在 `.ihui-agent/state/`(gitignored、活文档归并射程外):台账行内的注记会被别席的清偿提交洗掉
 * (实测一轮 64 枚只剩 6 枚),所以可追责性的真相源只能是这里 + 提交信息。
 */
export function appendLedger(entries, { file = LEDGER_FILE(), nowMs = Date.now(), keepDays = 90 } = {}) {
  mkdirSync(path.dirname(file), { recursive: true })
  const prior = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const pr = pruneLedger(prior, { nowMs, keepDays })
  const body = entries.map((e) => JSON.stringify(e)).join('\n')
  writeFileSync(file, `${pr.text}${body}\n`, 'utf8')
  return { written: entries.length, pruned: pr.pruned, malformed: pr.malformed, file }
}

/**
 * 落地后复验(2026-10-22 补,本器实犯):摘牌必须回读**落地后的 HEAD 面**再判一次。
 * 只算落地前的守恒就报成功是不够的 —— 实测出现过"留痕写了 57 条、HEAD 面上牌一枚没少",
 * 而 `git rev-parse HEAD` 取到的还是别席刚顶上来那枚 ⇒ 留痕会指向一枚不是自己的提交。
 * ok 要求两条同时成立:被摘的原行一条都不在面上,且面上挂牌总数等于本轮跳过数。
 */
export function verifyLanded(headText, plan) {
  const lines = String(headText).split('\n')
  const staleLeft = plan.removed.filter((raw) => lines.includes(raw)).length
  const held = lines.filter((l) => /^\s*- \[ \]/.test(l) && claimMarkOf(l)).length
  return { ok: staleLeft === 0 && held === plan.held.length, staleLeft, held }
}

/** 留痕读数 CLI 出口:取不到文件一律判未判定,不得用 0 冒充"没摘过"(§0.3)。 */
export function readLedgerReport({ file = LEDGER_FILE() } = {}) {
  if (!existsSync(file)) return { undetermined: true, why: `留痕文件不在位:${path.relative(ROOT, file)}` }
  return reportLedger(readFileSync(file, 'utf8'))
}

function result(state, n) {
  const line = `SWEEP-RESULT state=${state} stale=${n.stale ?? 0} held=${n.held ?? 0} stripped=${n.stripped ?? 0} lines=${n.lines ?? 0}`
  console.log(line)
  return { state, line }
}

/**
 * 派发层(2026-10-22 补建,门 98 那条悬空导入就是缺它)。
 *
 * 立因:AGENTS.md §1 写着"兜底器物 `strip-stale-claim-marks.mjs`(guardian 每 30 分钟派发)",
 * 而本函数**从未被实现过** —— `scripts/tests/strip-stale-claim-marks.test.mjs` 为它写了三段
 * 断言(含"拿不到结论行必须落 undetermined,不得读成无需摘"),门 98 一直把这条悬空导入当存量债报。
 * 本函数按那些断言实现,不改任何既有判据:
 *
 *   ① **节流闸**:与其余各层同口径(读戳 → 干活 → 写戳)。戳读不到 ⇒ 不当成"最近跑过",
 *      照常干活 —— 失效方向是多跑一次,不是漏跑一次。
 *   ② **runner 注入**:跑法由调用方给(测试注入假 runner,真实派发传 spawnSync 那支),
 *      本层只负责节流与结论解析,不自己派生 git。
 *   ③ **结论行解析**:只认机读行 `SWEEP-RESULT state=… stale=… held=… stripped=… lines=…`。
 *      拿不到 ⇒ `undetermined`(§0.3:没判绝不写成判过;把"没做"读成"无需摘"是最坏的一种绿)。
 *   ④ **跑失败同理**落 undetermined,不记绿也不冒红。
 *
 * @param {{tickFile:string, logger?:(l:string)=>void, runner:()=>({ok:boolean,out:string}), ttlMs?:number}} o
 * @returns {{state:string, stale?:string, held?:string, stripped?:string, lines?:string, why?:string}}
 */
export function sweepStaleClaimMarks({
  tickFile,
  logger = (l) => console.log(l),
  runner,
  ttlMs = 30 * 60 * 1000,
}) {
  // ① 节流闸
  let throttled = false
  try {
    if (tickFile && existsSync(tickFile)) {
      const age = Date.now() - statSync(tickFile).mtimeMs
      if (Number.isFinite(age) && age >= 0 && age < ttlMs) throttled = true
    }
  } catch {
    /* 戳读不到 ⇒ 不节流 */
  }
  if (throttled) {
    logger(`未到节流窗口(< ${Math.round(ttlMs / 60000)} 分钟),本轮不派发`)
    return { state: 'throttled', why: '未到节流窗口' }
  }

  // ② 注入式 runner
  const r = typeof runner === 'function' ? runner() : null
  if (!r || r.ok !== true) {
    logger('清扫器运行失败 ⇒ 落未判定(不记绿也不冒红)')
    return { state: 'undetermined', why: '清扫器运行失败' }
  }

  // ③ 结论行解析(只认机读行)
  const m =
    /SWEEP-RESULT\s+state=(\S+)\s+stale=(\S+)\s+held=(\S+)\s+stripped=(\S+)\s+lines=(\S+)/.exec(
      String(r.out || ''),
    )
  if (!m) {
    logger('拿不到机读结论行 ⇒ 落未判定(不把"没做"读成"无需摘")')
    return { state: 'undetermined', why: '结论行缺失' }
  }
  const [, state, stale, held, stripped, lines] = m
  if (state === 'stripped' && Number(stripped) > 0) {
    logger(`代摘 ${stripped} 枚(滞留 ${stale} / 本轮不动 ${held} / 台账 ${lines} 行)`)
  } else {
    logger(`清扫结论 state=${state}(滞留 ${stale} / 本轮不动 ${held} / 台账 ${lines} 行)`)
  }

  // ④ 写戳(失败不改变结论)
  try {
    if (tickFile) {
      mkdirSync(path.dirname(tickFile), { recursive: true })
      writeFileSync(tickFile, new Date().toISOString())
    }
  } catch {
    /* 写戳失败不影响本轮结论 */
  }
  return { state, stale, held, stripped, lines }
}

function git(args, opts = {}) {
  // 派生 git 一律走脚本层(lib/face-reader 的 gitRaw,G-927 2026-10-22):裸起 'git' 会被
  // scripts/tests/face-reader.test.mjs 的"裸派生生产文件只减不增"棘轮记为新增者。层内同批兜住
  // §12g 显式 stdio(喂 input 时 stdin=pipe)、windowsHide、utf8 与绝对路径 git 二进制纪律;
  // maxBuffer 沿用本器 1<<28 档(台账整档 show/hash-object 远超层默认 64MB),调用方 opts 仍可覆盖。
  return gitRaw(args, ROOT, { maxBuffer: 1 << 28, ...opts })
}

/**
 * 护栏③(2026-10-23 收窄,治"让路变成永久停摆")。
 *
 * 原判据:`git status --porcelain -- PROJECT_PLAN.md` 非空 ⇒ 整批让路。本仓是多会话共写活文档,
 * 该文件的工作树副本**常年不净**(2026-10-23 实测:留痕最后一条停在 10-22 07:45,而派发节流台账
 * 显示此后每 30 分钟仍在跑 —— 护栏天天触发,器物天天"让路",45 枚超龄牌一枚都没再摘下来)。
 *
 * 为什么"工作树脏"本来就不构成让路条件:
 *   · 取材面是 `git show HEAD:PROJECT_PLAN.md`(HEAD blob),不是工作树;
 *   · 落地走 `object-space-land`(blob 档 + CAS + 行级复活守卫),从不写工作树;
 *   · 本批要摘的旧形态行**逐字**写进 `LAND_CLASH_SCOPE.removed`,复活守卫认得它们是有意删的;
 *   · 工作树副本滞后带来的回潮,由 `scrub-declared-removals`(auto-commit-quiet 收编后调用)
 *     与 `union-converge` 的 `declaredDropCaps` 两条通道兜(2026-10-23 均装车并有接线锁)。
 * ⇒ 脏的是"别人的副本",不是"我的判据面"。
 *
 * 收窄后的判据(仍有真语义,只是不再被常态脏误触):
 *   **本批要摘的旧形态行,若在工作树副本里已被别席就地改写成别的样子**(不再是逐字同一行) ⇒ 让路。
 *   那一型说明别席正在动这几行本身,不是纯滞后;纯滞后(行还在、只是旧)则照常放行 ——
 *   它下次收编时旧形态行会被复洁器按台账剔掉,不会把我的改写顶回来。
 * 失效方向:工作树读不到 ⇒ 让路(未判定不猜,§0.3)。
 *
 * @returns {{blocked:boolean, byWorktree:string[]}}
 */
function planFaceBlockedBy(leases = [], { root = ROOT } = {}) {
  const list = Array.isArray(leases) ? leases : []
  if (list.length === 0) return { blocked: false, byWorktree: [] }
  let worktree
  try {
    worktree = readFileSync(path.join(root, FILE), 'utf8')
  } catch {
    return { blocked: true, byWorktree: ['<工作树副本读不到 ⇒ 未判定,按让路处理>'] }
  }
  const set = new Set(worktree.split('\n'))
  // 只问"别席有没有就地改过这几行"——纯滞后(逐字还在)不算改动,回潮交复洁器。
  const touched = list.filter((r) => !set.has(r.raw)).map((r) => `L${r.line}`)
  return { blocked: touched.length > 0, byWorktree: touched }
}

/**
 * 待摘点名行(纯函数,便于镜像测试钉住)。裸标记那一档**没有日期也没有持有者**,
 * 照完整租约的模板印就会产出 `原牌 null/null 超龄 nullh` 这种数学上不成立的断言,
 * 让下一个人以为超龄维坏了(§0.8:文案不许说错话)。
 */
export function leaseReportLine(r) {
  const bare = r.mark?.form !== 'lease' || !r.mark?.date
  if (bare)
    return (
      `  ▸ 待摘 L${r.line} 裸标记（进行中）无日期无持有者 ⇒ 超龄维不适用,` +
      `依据是同批 CL4(新增即拦)+ 本器物只读 HEAD 面`
    )
  return `  ▸ 待摘 L${r.line} 原牌 ${r.mark.date}/${r.mark.holder} 超龄 ${r.ageH}h`
}

export function run({
  apply = false,
  dryRun = false,
  ttlHours,
  nowMs = Date.now(),
  seat = 'stale-claim-strip',
  ownerRuling = process.env.IHUI_CLAIM_STRIP_LEGACY_RULING ?? DEFAULT_LEGACY_RULING,
} = {}) {
  const ttl = ttlHours ?? claims.resolveTtlHours(null, process.env[claims.TTL_ENV]).ttlHours
  const asOf = localDay(nowMs)
  let text
  try {
    text = git(['show', `HEAD:${FILE}`])
  } catch {
    console.log('❌ 取不到 HEAD 面台账 ⇒ 未判定(不记绿也不冒红,§0.3)')
    return 2
  }
  // let 而非 const:护栏③ 收窄后可能按"可摘面"重算一次(把别席就地改写过的那几枚移出)
  let plan = planSweep(text, { nowMs, ttlHours: ttl, seat, asOf, legacyByOwnerRuling: ownerRuling })
  const n = { stale: plan.leases.length, held: plan.held.length, stripped: 0, lines: text.split('\n').length }

  for (const h of plan.held) console.log(`  · 本轮不动 L${h.line} [${h.why}] ${h.raw.slice(0, 70)}`)
  for (const r of plan.leases.slice(0, 12)) console.log(leaseReportLine(r))
  if (plan.leases.length > 12) console.log(`  ▸ …另有 ${plan.leases.length - 12} 枚同批`)

  if (!plan.ok) {
    console.log(`❌ 守恒不过:${plan.why} ⇒ 整批不落`)
    return 2
  }
  if (plan.leases.length === 0) return result('clean', n).state === 'clean' ? 0 : 0

  if (dryRun) {
    console.log(`dry-run:本批将摘 ${plan.leases.length} 枚(不落地)`)
    return 0
  }
  if (!apply) {
    console.log(`未带 --apply ⇒ 只报数不落地(待摘 ${plan.leases.length} 枚)`)
    return 0
  }
  // 护栏③(2026-10-23 收窄):不再因"工作树脏"整批让路 —— 本器取材 HEAD 面、落地走对象空间,
  // 脏的是别人的副本不是我的判据面;只在本批旧形态行**被别席就地改写**时才让路,且**只让路那几枚**
  // (实测:45 枚里 4 枚在飞,原护栏会连另外 41 枚一起按住 —— 少数在飞的必须只挡自己)。
  let deferred = 0
  {
    const guard = planFaceBlockedBy(plan.leases)
    if (guard.blocked) {
      const touched = new Set(guard.byWorktree.map((x) => Number(x.slice(1))))
      const skipLines = plan.leases.filter((r) => touched.has(r.line)).map((r) => r.line)
      if (skipLines.length > 0) {
        deferred = skipLines.length
        console.log(
          `⛔ 护栏③:${skipLines.length} 枚旧形态行已被别席就地改写(L${skipLines.join(' L')})⇒ 只让路这几枚,其余照摘`,
        )
        // 用同一把判据重算(只把让路行移入 held,不新写第二份判据),落地内容随之只含可摘部分
        plan = planSweep(text, {
          nowMs,
          ttlHours: ttl,
          seat,
          asOf,
          legacyByOwnerRuling: ownerRuling,
          skipLines,
        })
        if (!plan.ok) {
          console.log(`❌ 守恒不过:${plan.why} ⇒ 整批不落`)
          return 2
        }
      }
    } else {
      console.log(
        `ℹ️ 护栏③:工作树副本不净属常态(别席在写),但本批旧形态行均仍逐字在场(纯滞后)⇒ 放行;回潮由复洁器按摘除台账兜`,
      )
    }
  }
  if (plan.leases.length === 0) {
    console.log(
      deferred > 0 ? `本轮可摘 0 枚(另 ${deferred} 枚被别席就地改写而让路,交人工)` : '本轮无待摘',
    )
    return result('clean', { ...n, deferred }).state === 'clean' ? 0 : 0
  }
  // 护栏③ 之后 plan 已按"可摘面"重算 ⇒ 结论行必须报这个面,不能报护栏前的老数
  // (把"41 枚可摘"报成"45 枚待摘"会让读日志的人以为还有 4 枚没人负责)。
  n.stale = plan.leases.length
  n.held = plan.held.length
  n.deferred = deferred

  // 留痕要能指回"摘之前是哪枚提交",所以基线 sha 必须在落地前取。
  const planSha = git(['rev-parse', 'HEAD']).trim()
  let kept = false
  const dir = mkdtempSync(path.join(ROOT, '.ihui-agent', 'tmp', 'stale-claim-strip-'))
  try {
    const blobsPath = path.join(dir, 'blobs.json')
    const scopePath = path.join(dir, 'clash.json')
    // `blob` 字段要的是**已在对象库里的 blob sha**(object-space-land 的契约),不是内容文本 ——
    // 直接塞文本会被判"字节数取不到 ⇒ 不落地"(2026-10-22 本器首次 --apply 即栽在这格)。
    const blob = git(['hash-object', '-w', '--stdin'], { input: plan.text }).trim()
    if (!/^[0-9a-f]{40}$/.test(blob)) {
      console.log(`❌ hash-object 未回带 40 位 blob sha(实得 ${String(blob).slice(0, 40)})⇒ 不落,拒绝用猜的值继续`)
      return 2
    }
    writeFileSync(blobsPath, JSON.stringify({ files: [{ path: FILE, blob }] }))
    writeFileSync(
      scopePath,
      JSON.stringify({ files: [{ path: FILE, removed: plan.removed, added: plan.added }] }),
    )
    const env = {
      ...process.env,
      LAND_PATHS: FILE,
      LAND_BLOBS: blobsPath,
      LAND_CLASH_SCOPE: scopePath,
      LAND_BLOB_PROOF:
        `挂牌判据 import 守门 109 的 claimMarkOf(本器零复算);TTL=${ttl}h 由 resolveTtlHours 同源解析;` +
        `摘除条件=完整租约形∧超龄,裸标记/未超龄/日期不可判一律不动(共 ${plan.held.length} 条已逐条点名);` +
        `守恒:C1 行数 ${n.lines} 不变 / C2 未摘行逐字节等值 / C3 摘后挂牌集 == 跳过集(${plan.held.length} 条);` +
        `旧形态 ${plan.removed.length} 行逐字写进 removed ⇒ 后续 union 不得从对侧取回(§1 通道③的声明式防线)。`,
      LAND_MSG:
        `fix(plan): 自动摘除 ${plan.leases.length} 枚超龄认领牌(兜底轮;判据 import 守门一零九,` +
        `台账工作树净才动手,原牌日期与持有者逐字留在注记里可溯)`,
    }
    const land = spawnSync(process.execPath, [path.join(ROOT, 'scripts/object-space-land.mjs')], {
      cwd: ROOT,
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 600000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out = `${land.stdout ?? ''}${land.stderr ?? ''}`
    const rowsOut = String(out)
      .split(/\r?\n/)
      .filter(Boolean)
    console.log(rowsOut.slice(-8).join('\n'))
    if (land.status !== 0) {
      // 被拒时必须把拒因交出来:落地器的诊断行常常埋在它回显的台账正文之间,
      // 只打末 8 行就等于"失败了但没说为什么"(本器 2026-10-22 首次 --apply 实犯)。
      const diag = rowsOut.filter((l) => /❌|⛔|拒绝|守卫|复活|陈旧|不过|未判定|冲突|≠|判不出|需要人工|需人工/.test(l))
      console.log(`── 拒因诊断(${diag.length} 行,取器物筛出的判据行)──\n${diag.slice(-25).join('\n')}`)
      console.log(`── 原始末 ${Math.min(60, rowsOut.length)} 行 ──\n${rowsOut.slice(-60).join('\n')}`)
      console.log('❌ object-space-land 未落地 ⇒ 不推送,整批不落')
      kept = true
      return 2
    }
    // 新枚 sha 只能从落地器自己的输出里解,不能用 rev-parse 现取(并发下别人一秒内就能顶上来)
    const shaHit = /CAS 成功 HEAD=([0-9a-f]{40})/.exec(out)
    if (!shaHit) {
      console.log('❌ 未从落地器输出解出 40 位新枚 sha ⇒ 不写留痕、不报成功(宁可白跑一轮)')
      kept = true
      return 2
    }
    const landedSha = shaHit[1]
    const v = verifyLanded(git(['show', `HEAD:${FILE}`]), plan)
    if (!v.ok) {
      console.log(
        `❌ 落地后复验不过:HEAD 面仍含 ${v.staleLeft} 枚被摘原行 · 面上挂牌 ${v.held} 条(应 ${plan.held.length} 条)⇒ 本轮判未生效,不写留痕`,
      )
      kept = true
      return 2
    }
    const ents = sealEntries(
      buildEntries(plan, { stamp: plan.stamp, at: new Date(nowMs).toISOString(), seat, planSha }),
      { landedSha, plan },
    )
    const led = appendLedger(ents, { nowMs })
    console.log(
      `📝 留痕 ${led.written} 条 → ${path.relative(ROOT, led.file)}(老化裁掉 ${led.pruned} 条 · 畸形 ${led.malformed} 条 · 落地枚 ${landedSha.slice(0, 12)})`,
    )
    const push = spawnSync(process.execPath, [path.join(ROOT, 'scripts/git-push-guard.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 600000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    console.log(String(push.stdout ?? '').trim().split('\n').slice(-3).join('\n'))
    return result('stripped', { ...n, deferred, stripped: plan.leases.length }).state === 'stripped' ? 0 : 0
  } finally {
    // 落地被拒时**保留现场**并打印路径:临时件一删,下一句"为什么被拒"就再也问不出来了
    // (本器 2026-10-22 首次 --apply 即因此只能看到台账正文,看不到落地器的结论行)。
    if (kept) console.log(`现场保留:${dir}(blobs.json / clash.json 可手工复喂 object-space-land)`)
    else rmSync(dir, { recursive: true, force: true })
  }
}

/** 夹具:一枚超龄租约 + 一枚新鲜租约 + 一枚裸标记 + 一行叙述 + 一枚行尾租约。 */
export const FIXTURE = [
  '- [ ]（进行中@2026-01-01/甲席） G-1 超龄租约,必须摘',
  '- [ ]（进行中@2026-10-20/乙席） G-2 新鲜租约,不许碰',
  '- [ ]（进行中） G-3 裸标记无日期,不可判龄 ⇒ 不许碰',
  '- [ ] G-4 普通待办,正文提到（进行中）是叙述',
  '- [ ] G-5 行尾注记〕（进行中@2026-01-02/丙席）',
  '- [ ] G-6 别的事,一行都不许顺手动',
].join('\n')

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, ok, extra = '') => {
    if (ok) {
      pass++
      console.log(`✅ ${name}`)
    } else {
      fail++
      console.log(`❌ ${name}${extra ? `:${extra}` : ''}`)
    }
  }
  const now = Date.parse('2026-10-22T12:00:00Z')
  const p = planSweep(FIXTURE, { nowMs: now, ttlHours: 72, seat: 'x', asOf: '2026-10-22' })
  t(
    '摘除集=三枚(两枚超龄租约 + 一枚裸标记);新鲜租约不许动(2026-10-22 CL4 定档后裸标记默认代摘)',
    p.leases.length === 3,
    `实到 ${p.leases.length}`,
  )
  t('跳过集=一枚(G-2 新鲜租约;G-4 叙述不算挂牌故不在集内)', p.held.length === 1, `实到 ${p.held.length}`)
  t('C1 行数守恒', FIXTURE.split('\n').length === p.text.split('\n').length)
  t('守恒三条整体成立', p.ok === true, p.why)
  t(
    '形状锁:行内注记只是指针,长度必须 ≤62 字且含 #seq(原牌信息住在留痕,不塞台账)',
    [...p.text.matchAll(/（认领已释放@[^）]*）/g)].every((m) => m[0].length <= 62 && m[0].includes('#')),
    [...p.text.matchAll(/（认领已释放@[^）]*）/g)].map((m) => m[0].length).join(','),
  )
  t(
    '原牌三要素改由留痕条目承载,且逐字段等于判据读数',
    (() => {
      const es = buildEntries(p, { stamp: p.stamp, at: '2026-10-22T12:00:00Z', seat: 'x', planSha: 'b'.repeat(40) })
      const ls = es.filter((e) => e.form === 'lease')
      return ls.length === 2 && ls.every((e) => /^2026-01-0\d$/.test(e.claimDate) && !!e.holder && !!e.rowBefore)
    })(),
  )
  t('摘后挂牌集 == 跳过集(C3 成立)', p.text.split('\n').filter((l) => claimMarkOf(l) !== null).length === p.held.length)
  // 反证一:强行多摘一行(把 G-6 也改写)⇒ C2 必须咬住
  const hurt = planSweep(FIXTURE, { nowMs: now, ttlHours: 72, seat: 'x', asOf: '2026-10-22' })
  hurt.text = hurt.text.replace('- [ ] G-6 别的事,一行都不许顺手动', '- [ ] G-6 被顺手动了')
  const lines = hurt.text.split('\n')
  const recheck = lines.filter((l) => claimMarkOf(l) !== null).length
  t('反证:顺手动一行时 C2 判据本身仍能识别(守恒不是装饰)', hurt.text !== FIXTURE && recheck === hurt.held.length)
  // 反证二:TTL 放宽到零 ⇒ 新鲜那枚也必须进来(证明"超龄"这一维真在起作用)
  const p2 = planSweep(FIXTURE, { nowMs: now, ttlHours: -1, seat: 'x', asOf: '2026-10-22' })
  t('TTL=0 时新鲜租约同批可摘 ⇒ 超龄维有牙', p2.leases.length === 4, `实到 ${p2.leases.length}`)
  // 出处句可被机主原话覆盖,覆盖后必须逐字进注记(可追责)
  const pr = planSweep(FIXTURE, {
    nowMs: now,
    ttlHours: 72,
    seat: 'x',
    asOf: '2026-10-22',
    legacyByOwnerRuling: '机主 2026-10-22 判定无席位在飞',
  })
  t(
    '机主原话进留痕的 ruling 字段,行内仍然只是指针(换了位置也不丢出处)',
    (() => {
      const es = buildEntries(pr, { stamp: pr.stamp, at: '2026-10-22T12:00:00Z', seat: 'x', planSha: 'c'.repeat(40) })
      const legacy = es.filter((e) => e.form === 'legacy')
      return (
        legacy.length === 1 &&
        legacy[0].ruling === '机主 2026-10-22 判定无席位在飞' &&
        /（认领已释放@2026-10-22\/x#[a-z0-9]+-\d+）/.test(pr.linesAfter.get(legacy[0].line))
      )
    })(),
  )
  // 反证三:摘过的文本再跑一遍必须判 clean(幂等,否则每轮都在抖 = 门 229 那条"台账每 30 分钟抖一次"同型)
  const p3 = planSweep(p.text, { nowMs: now, ttlHours: 72, seat: 'x', asOf: '2026-10-22' })
  t('幂等:摘后再跑=零可摘(不会每轮重摘同一批)', p3.leases.length === 0 && p3.held.length === 1, `stale=${p3.leases.length} held=${p3.held.length}`)
  // ── 留痕三段(条目构造 / 读数 / 老化)——台账行内的注记会被活文档归并洗掉(实测 64 枚只剩 6 枚),
  //    所以可追责性的真相源必须是仓外的 JSONL,行内只留指针。
  const ents = buildEntries(p, { stamp: p.stamp, at: '2026-10-22T12:00:00Z', seat: 'x', planSha: 'a'.repeat(40) })
  t('留痕条目逐字段等于判据读数(不是重写一遍)', ents.length === 3 && ents.every((e) => e.rowBefore && e.form && e.seq))
  t(
    '行内注记的 #seq 与留痕条目一一对应(否则指针指向不存在的事)',
    ents.every((e) => p.text.includes(`#${e.seq}`)) && new Set(ents.map((e) => e.seq)).size === ents.length,
  )
  t('留痕条目里 lease 与 legacy 分型清楚,超龄量不猜', ents.filter((e) => e.form === 'lease').length === 2 && ents.filter((e) => e.form === 'legacy').every((e) => e.ageHours === null))
  const rep = reportLedger(ents.map((e) => JSON.stringify(e)).join('\n') + '\n')
  t('读数器按身份分桶并显式报 malformed', rep.lines === 3 && rep.malformed === 0 && rep.forms.lease === 2)
  t('读数器对空文件判未判定,不用 0 冒充"没摘过"', reportLedger('').undetermined === true)
  t('读数器对畸形行逐条计数不静默(缺字段与解不出都算畸形)', reportLedger('{"seq":"a"}\n不是JSON\n').malformed === 2)
  const aged = [
    JSON.stringify({ seq: 'old', at: '2026-01-01T00:00:00Z', form: 'lease' }),
    JSON.stringify({ seq: 'new', at: '2026-10-22T00:00:00Z', form: 'lease' }),
  ].join('\n')
  const pruned = pruneLedger(aged, { nowMs: now, keepDays: 90 })
  t('老化只按窗口裁且**报出被裁条数**(工作队列必须有死亡机制,静默删等于没记录)', pruned.kept === 1 && pruned.pruned === 1)
  t('老化不静默吞畸形行', pruneLedger('乱码\n', { nowMs: now, keepDays: 90 }).malformed === 1)
  // 补写条目(收敛器用)必须与器物自产条目同键集 —— 否则留痕里会有两种形状,读数是错的
  const bf = backfillEntry({
    seq: 'bf-0',
    at: '2026-10-22T12:00:00Z',
    seat: 'x',
    line: 1,
    form: 'lease',
    mark: '（进行中@2026-09-01/甲）',
    claimDate: '2026-09-01',
    holder: '甲',
    ageHours: 1200,
    ttlHours: 72,
    ruling: null,
    rowBefore: '- [ ]（进行中@2026-09-01/甲） X',
    rowAfter: '- [ ]（认领已释放@2026-10-21/x#bf-0） X',
    planSha: 'a'.repeat(40),
    landedSha: 'b'.repeat(40),
  })
  const own = sealEntries(ents, { landedSha: 'c'.repeat(40), plan: p })[0]
  t(
    '补写条目与器物自产条目键集完全相同(留痕不得有两种形状)',
    Object.keys(bf).sort().join(',') === Object.keys(own).sort().join(','),
    `${Object.keys(bf).sort().join(',')} vs ${Object.keys(own).sort().join(',')}`,
  )
  t('补写条目必须自证 source,不得冒充器物本轮摘的', bf.source === 'backfill' && own.source === 'strip')
  t(
    '落地后复验:HEAD 面仍含被摘的原行 ⇒ ok=false 并报出残留数(不许"写了留痕就当落了地")',
    (() => {
      const v = verifyLanded(FIXTURE, p)
      return v.ok === false && v.staleLeft === 3
    })(),
  )
  t(
    '落地后复验:摘除生效时 ok=true 且 held 等于本轮跳过数',
    (() => {
      const v = verifyLanded(p.text, p)
      return v.ok === true && v.held === p.held.length
    })(),
  )
  console.log(`--self-test: ${pass}/${pass + fail} 通过`)
  return fail
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  const known = new Set(['--self-test', '--apply', '--dry-run', '--report'])
  const unknown = argv.filter((a) => !known.has(a) && !a.startsWith('--ttl-hours'))
  if (unknown.length > 0) {
    console.error(`❌ 未登记的旗标:${unknown.join(' ')} ⇒ 拒绝执行(未知开关不得静默落进默认分支)`)
    process.exitCode = 2
  } else if (argv.includes('--self-test')) process.exitCode = selfTest() === 0 ? 0 : 1
  else if (argv.includes('--report')) {
    const r = readLedgerReport()
    console.log(
      r.undetermined
        ? `LEDGER-REPORT state=undetermined why=${r.why}`
        : `LEDGER-REPORT state=ok lines=${r.lines} malformed=${r.malformed} forms=${JSON.stringify(r.forms)}`,
    )
    process.exitCode = r.undetermined ? 2 : 0
  } else {
    const ttlFlag = argv.find((a) => a.startsWith('--ttl-hours'))
    process.exitCode = run({
      apply: argv.includes('--apply'),
      dryRun: argv.includes('--dry-run'),
      ttlHours: ttlFlag ? Number(ttlFlag.split('=')[1]) : undefined,
    })
  }
}

export const __test__ = {
  planSweep,
  planFaceBlockedBy,
  leaseReportLine,
  FIXTURE,
  releaseNote,
  FILE,
  buildEntries,
  backfillEntry,
  shapeEntry,
  sealEntries,
  verifyLanded,
  localDay,
  LEDGER_FILE,
  LEDGER_KEYS,
  reportLedger,
  pruneLedger,
  appendLedger,
  readLedgerReport,
  LEDGER_FILE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
