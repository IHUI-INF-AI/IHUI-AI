// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * autonomy-leg-output — 全自治腿「产出对账」纯判据(/goal R3,2026-11-04 立)。
 *
 * 立因:A8 只量派发戳(*-dispatch-last.json)有没有刷,A11 只给 deploy-outcome-intake
 * 一条腿做精确产出对账。实测 dep-radar 的戳照刷、A1-A11 全绿,而产出账停在 10-30、
 * 守护日志连续 5 天自报「未判定」—— 整族尺子没有一条量得出「戳刷了但这条腿根本
 * 拿不到输入、什么都没产」。本模块把产出对账泛化到登记表全部 12 腿。
 *
 * 为什么不许做成「账静默就报红」的恒红门:12 腿里只有 1 条每轮必写(always),
 * 3 条是条件产腿(有结论/有候选才写),7 条结构性根本没有产出账(判据门只走 stdout),
 * 还有 1 条已由 A11 精确对账。若一律按「多久没写」判红,条件产腿的合法静默和环境
 * 缺口会天天顶红,尺子必然被整片放宽 —— 那比没有尺子更坏。
 *
 * 判据三分类(登记表 scripts/data/autonomy-leg-liveness.json 的 outputKind 是唯一真源):
 *   · always      : 静默超窗 ⇒ drift(每轮必写却没写,可整改)
 *   · conditional : 静默超窗 **且** 近窗自报未判定 ⇒ unjudged(输入面断链,点名给修法);
 *                   静默超窗但无自报 ⇒ ok(合法静默)
 *   · none / coveredBy : n/a,不参与三态
 * 形状坏行、登记表字段腐烂、账读不到 ⇒ 一律 unjudged(§0.3:不拿「没判」冒充「判过」)。
 * 派发戳只作 readout 旁证,**绝不参与三态**(与 A11 同规:戳只记 attemptAt,不记结论)。
 *
 * 本模块是纯函数:不读盘、不写盘、不 import 任何生产器物,便于镜像测试与变异自证。
 */
export const OUTPUT_KINDS = Object.freeze(['always', 'conditional', 'none'])
export const TIME_FIELDS = Object.freeze(['ts', 'at', 'epoch'])

const UNDETERMINED_RE = /undetermined|unjudged|未判定/i
const UNDETERMINED_FIELDS = Object.freeze(['result', 'overall', 'status', 'action', 'state'])

/** 一行产出是否**自报**「我量不动」。注意与「票没推进」无关,那是另一条链。 */
export function isUndeterminedRow(row) {
  if (!row || typeof row !== 'object') return false
  return UNDETERMINED_FIELDS.some((k) => typeof row[k] === 'string' && UNDETERMINED_RE.test(row[k]))
}

export function timeOfRow(row, timeField) {
  if (timeField === 'epoch') {
    const n = Number(typeof row === 'object' && row !== null ? row.at ?? row.ts : row)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  if (!row || typeof row !== 'object') return null
  const t = Date.parse(String(row[timeField] ?? '').trim())
  return Number.isFinite(t) ? t : null
}

/**
 * 解析一份 `.jsonl` 产出台账。与摄入器 readDecisionText 同规:
 * 仅「末段半条记录 + 文件无尾换行 + 解析失败」算并发撕裂(torn),不算坏行;
 * 中间坏行必须如实计 bad,不许靠删输入把读数抹绿。
 *
 * **自报未判定行不刷新 latestMs**:「我量不动」是诊断行,不是有效结论。若让它算产出,
 * 一条腿天天写 undetermined 就会被读成「刚刚有产出」⇒ 尺子结构性恒绿,正是本维要抓的
 * 静默断链。它仍计入 undetermined,在账空/静默分支顶起 unjudged。
 * @param {string} text 账本文本
 * @param {'ts'|'at'|'epoch'} timeField 时间字段口径
 * @param {number} sinceMs 只统计此后的自报未判定行(避免一行陈年旧账让尺子永久 unjudged)
 */
export function parseLegLedger(text, timeField = 'ts', sinceMs = 0) {
  const raw = String(text ?? '')
  const parts = raw.split(/\r?\n/)
  const endsWithNewline = /\r?\n$/.test(raw)
  let latestMs = null
  let total = 0
  let bad = 0
  let torn = 0
  let undetermined = 0
  for (let i = 0; i < parts.length; i += 1) {
    const line = parts[i].trim()
    if (!line) continue
    const isLast = i === parts.length - 1
    let row
    try {
      row = JSON.parse(line)
    } catch {
      if (isLast && !endsWithNewline) {
        torn += 1
        continue
      }
      bad += 1
      continue
    }
    total += 1
    const t = timeOfRow(row, timeField)
    if (t === null) {
      bad += 1
      continue
    }
    const selfReported = isUndeterminedRow(row)
    if (!selfReported && (latestMs === null || t > latestMs)) latestMs = t
    if (t >= sinceMs && selfReported) undetermined += 1
  }
  return { latestMs, total, bad, torn, undetermined }
}

function stampAgeMin(stamps, id, now) {
  const s = stamps?.[id]
  if (!s || typeof s.attemptAtMs !== 'number') return null
  return Math.max(0, Math.round((now - s.attemptAtMs) / 60_000))
}

/**
 * 全腿产出对账。输入全由取料层搬运,本函数不碰文件系统。
 * @param {object} p
 * @param {Array}  p.legs        登记表 legs(仓内文件,按被审面取)
 * @param {object} p.ledgers     { [outputRel]: text };ENOENT ⇒ '',读失败 ⇒ null
 * @param {object} p.stamps      { [stamp]: {attemptAtMs} },只作旁证
 * @param {object} p.selfReports { [stamp]: boolean },守护日志近窗内是否自报未判定
 * @param {number} p.now
 */
export function classifyLegOutputs({ legs, ledgers = {}, stamps = {}, selfReports = {}, now = Date.now() } = {}) {
  if (!Array.isArray(legs)) {
    return { state: 'unjudged', rows: [], summary: '登记表 legs 不是数组 ⇒ 全腿产出对账没量' }
  }
  const rows = []
  for (const leg of legs) {
    const id = String(leg?.stamp ?? '(无 stamp)')
    const base = { id, kind: leg?.outputKind ?? '(缺)', latestAt: null, ageMin: null, stampAgeMin: stampAgeMin(stamps, id, now) }
    if (leg?.coveredBy) {
      rows.push({ ...base, state: 'n/a', why: `已由 ${leg.coveredBy} 精确对账,本维不重复量` })
      continue
    }
    const kind = leg?.outputKind
    if (kind === 'none') {
      rows.push({ ...base, state: 'n/a', why: '结构性无产出账(判据门/基线面),由 A8 量戳' })
      continue
    }
    const shapeOk =
      OUTPUT_KINDS.includes(kind) &&
      typeof leg?.outputRel === 'string' && leg.outputRel.length > 0 &&
      TIME_FIELDS.includes(leg?.outputTimeField) &&
      Number.isInteger(leg?.silenceCeilingMs) && leg.silenceCeilingMs > 0
    if (!shapeOk) {
      rows.push({ ...base, state: 'unjudged', why: '登记表产出字段缺失/非法 ⇒ 不冒充判过' })
      continue
    }
    const text = ledgers[leg.outputRel]
    if (text === null || text === undefined) {
      rows.push({ ...base, state: 'unjudged', why: `产出账取不到(${leg.outputRel})` })
      continue
    }
    const p = parseLegLedger(text, leg.outputTimeField, now - leg.silenceCeilingMs)
    base.latestAt = p.latestMs === null ? null : new Date(p.latestMs).toISOString()
    base.ageMin = p.latestMs === null ? null : Math.max(0, Math.round((now - p.latestMs) / 60_000))
    const stampTail = base.stampAgeMin === null ? '' : ` / 派发戳 ${base.stampAgeMin}min 前`
    if (p.bad > 0) {
      rows.push({ ...base, state: 'unjudged', why: `产出账 ${p.bad} 行形状坏(另 ${p.torn} 行并发撕裂已剔除)⇒ 判不出` })
      continue
    }
    if (p.latestMs === null) {
      if (p.undetermined > 0 || selfReports[id] === true) {
        rows.push({ ...base, state: 'unjudged', why: `产出账近窗只有 ${p.undetermined} 行自报未判定、无一条有效结论 ⇒ 采集输入面断链,不是有产出${stampTail}` })
        continue
      }
      rows.push(
        kind === 'always'
          ? { ...base, state: 'drift', why: `每轮必写的产出账一条都没有 ⇒ 零产出${stampTail}` }
          : { ...base, state: 'unjudged', why: `条件产腿一次都没产过、无基线 ⇒ 合法静默与漏产分不出${stampTail}` },
      )
      continue
    }
    const silent = now - p.latestMs > leg.silenceCeilingMs
    if (!silent) {
      rows.push({ ...base, state: 'ok', why: `最近产出 ${base.ageMin}min 前,在 ${Math.round(leg.silenceCeilingMs / 3_600_000)}h 窗内${stampTail}` })
      continue
    }
    if (kind === 'always') {
      rows.push({ ...base, state: 'drift', why: `每轮必写却静默 ${base.ageMin}min(>${Math.round(leg.silenceCeilingMs / 60_000)}min)⇒ 账零新增${stampTail}` })
      continue
    }
    const selfReported = selfReports[id] === true || p.undetermined > 0
    rows.push(
      selfReported
        ? { ...base, state: 'unjudged', why: `条件产腿静默 ${base.ageMin}min 且近窗自报未判定 ⇒ 采集输入面断链,不是合法静默${stampTail}` }
        : { ...base, state: 'ok', why: `条件产腿静默 ${base.ageMin}min 但无自报未判定 ⇒ 合法静默${stampTail}` },
    )
  }
  const drift = rows.filter((r) => r.state === 'drift')
  const unjudged = rows.filter((r) => r.state === 'unjudged')
  const ok = rows.filter((r) => r.state === 'ok')
  const na = rows.filter((r) => r.state === 'n/a')
  return {
    state: drift.length ? 'drift' : unjudged.length ? 'unjudged' : 'ok',
    rows,
    summary: `全腿产出对账:${rows.length} 腿 = ok ${ok.length} / n/a ${na.length} / drift ${drift.length} / unjudged ${unjudged.length}`,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
