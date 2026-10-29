// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-pool-yield.mjs —— 「已完成条目从占用面让位、号随让位回池」的裁决器(Y-2,2026-10-29 立)
 *
 * 缺陷本体(票面 Y-2 原话的机器形态):取号占用面 = 台账 ⊕ 47 份归档件按字典序拼接,**任何一次
 * 正文引用都算**(G-14 的 `scanFamilyIdHits`)。于是"已完成条目"永远占着号:归档件里的旧登记、
 * 台账里 `<!-- 已归档(… G-924 …) -->` 这种占位注释、以及批次流水里一句"〔同题原号 G-59〕",
 * 都让该号永久不可发。2026-10-29 现读:G 族 `SCAN_FACE_FULL`(窗 58..67 九枚候选全被扫描面吃掉)、
 * D 族 `POOL_FULL`(池 1..99 空闲 0 枚)。散点归档对这一型 Δ=0 —— 引用根本没离开归档面。
 *
 * 本器做的事:**给"让位"造一条可判定 / 可回滚 / 有留痕的路**,而不是放宽扫描面。
 * 判据对象是**一枚号**,不是整片面 —— 只有"这一枚号在面上每一次出现都已经结清"时才退,任一处在飞
 * (在册未勾行、刚结清的窗内、租约行、判不出结清日的引用)就整枚保住。所以 G-14 那道"两席领同号"
 * 的防线对**在飞号**一枚不松;松的只是"早就做完、只以归档/流水引用留在面上"的那一批。
 *
 * 判据单源(§22c):
 *  - "什么算一个编号" = `lib/plan-task-index.mjs` 的 `usedIdsOfPrefix`(本器只在它的结果上做减法,
 *    经同文件的 `usedIdsOfPrefixExcluding`);行级声明位取 `parseTaskRows` + `keyOfRow`(F9/F1 同一把尺);
 *  - "这个号在面上出现在哪" = `lib/plan-id-face.mjs` 的 `scanFamilyIdHits`(取号器跳号点名用的同一份);
 *  - "结清时间" = `ageAnchorOf`(行内最新日期,退追溯出生日),不另立日期口径;
 *  - "号段形状/池上限/租约行标记" = `lib/plan-id-lease.mjs` 的 `ID_HEAD_RE` / `LEASE_POOL_MAX` / `LEASE_MARK`。
 * 本文件**不写第二条编号正则**,也不自行决定"哪个号空闲"(空闲仍由 `poolFreeList` 现算)。
 *
 * 三条硬约束(票面):
 *  ① 不发 >99 的号:裁决射程恒为 1..LEASE_POOL_MAX,>池的存量债原本就不占池,不需要也不允许动;
 *  ② 不放宽扫描面:退出以**逐号证据**为准,不是"归档面不扫了";证据落机读台账,可回滚(删记录即复原);
 *  ③ 退出后若该号被重新领用必须能反查:台账是 append-only 的 `yield` / `reclaim` 两条事件,
 *    `--trace G-59` 把这条链连同当时的证据锚(归档件路径 + 行号 + 片段)一起打印。
 *
 * 用法(默认 --dry-run,只报数不写盘):
 *   node scripts/plan-pool-yield.mjs                       # 现读 G/D 两族,打印让位前后读数
 *   node scripts/plan-pool-yield.mjs --family G,D,O
 *   node scripts/plan-pool-yield.mjs --apply               # 把新城让位决定落台账
 *   node scripts/plan-pool-yield.mjs --trace D-59          # 反查一枚号:让位链 + 现面引用
 *   node scripts/plan-pool-yield.mjs --json
 * 退出码:0 = 裁决跑完(含"零枚可让位")/ 1 = 占用面判不出(台账或归档件读不到 ⇒ 不猜)/ 2 = 用法错。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { atomicWriteFileSync } from './lib/atomic-write.mjs'
import { collectIdFace, ID_FACE_TRANSPORT, scanFamilyIdHits } from './lib/plan-id-face.mjs'
import {
  ID_HEAD_RE,
  LEASE_MARK,
  LEASE_POOL_MAX,
  poolBlocked,
  poolFreeList,
} from './lib/plan-id-lease.mjs'
import {
  ageAnchorOf,
  keyOfRow,
  parseTaskRows,
  usedIdsOfPrefix,
  usedIdsOfPrefixExcluding,
} from './lib/plan-task-index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')

/** 让位账本(机读,append-only)。与 `.ihui-agent/state/` 下其他账本同层同形态。 */
export const YIELD_LEDGER_REL = '.ihui-agent/state/plan-pool-yield.jsonl'
/**
 * 默认让位窗(天)。窗的意义:刚结清的条目可能还有在飞引用(运维照票号去核、合并面还没收敛),
 * 立刻把号发出去会造"同号两题"的现场。30 天 = 本仓"一个批次流水"的常规跨度,可经 `--window-days`
 * 调,但**调小是人的决定**,器物只如实报出窗内被保住的枚数(不许悄悄缩小窗来凑空闲)。
 */
export const YIELD_WINDOW_DAYS = 30

const oneLine = (e) =>
  String(e?.message ?? e)
    .split(/\r?\n/)[0]
    .slice(0, 200)

const isoDay = (d) => new Date(d).toISOString().slice(0, 10)

/** `G-59` / `D59` / `O13b` → `{family:'G', num:59}`;形状单源 = lib 的 `ID_HEAD_RE`。 */
export function familyNumOf(key) {
  const m = ID_HEAD_RE.exec(String(key ?? '').trim())
  if (!m) return null
  const num = Number(m[3])
  if (!Number.isFinite(num)) return null
  return { family: m[1].toUpperCase(), num }
}

/**
 * 把一份面切成"段"并给每行标态。段 = 台账一段 + 每份归档件一段(拼接顺序与 `joinFace` 一致:
 * 台账在前、归档件按路径字典序) —— 本器自己切,是为了让证据带上**归档件路径**(台账里只有一个
 * 拼接后的行号,运维照着核会核到别人那一行上)。
 */
export function segmentFace({ ledgerText, archives = [] }) {
  const segs = []
  if (typeof ledgerText === 'string')
    segs.push({ where: 'ledger', path: 'PROJECT_PLAN.md', text: ledgerText })
  for (const a of Array.isArray(archives) ? archives : [])
    if (typeof a?.text === 'string')
      segs.push({ where: 'archive', path: String(a.path ?? ''), text: a.text })
  for (const s of segs) {
    s.lines = s.text.split(/\r?\n/)
    s.rows = new Map() // line(1 基) -> { state, raw, key, settledAt, lease }
    for (const r of parseTaskRows(s.text)) {
      const raw = String(r.raw)
      s.rows.set(r.line, {
        state: r.state,
        raw,
        key: keyOfRow(raw),
        settledAt: ageAnchorOf(raw),
        lease: raw.includes(LEASE_MARK),
      })
    }
  }
  return segs
}

/**
 * 让位裁决(纯函数,零 IO)。
 *
 * 保留(RETAIN)的六类,任一命中 ⇒ 整枚号不动。**每一类都是"这个号还可能被并发领号冲突"的
 * 机器证据**,不是措辞:
 *  - `open-row`        :该号出现在**任何**未勾选行里(在册未勾 ⇒ 事情还没做完,号还在用);
 *  - `live-ledger-row` :该号出现在活台账的**任何**勾选行里(哪怕已勾 ⇒ 同一份活文档里两行同号
 *                        就是 F9 现场,先归档再让位,让位器不替归档器做搬运);
 *  - `archive-open-row`:归档件里的未勾行(归档件也可能带着没做完的条目);
 *  - `lease-row`      :租约行(`〔千段租约〕`)—— 机器记账的段尾主键,永不让位;
 *  - `no-declaration` :全face只有引用、没有任何声明位 ⇒ **判不出结清时间**,不退(失败方向 = 不退);
 *  - `no-settled-date`:有声明位但读不出日期 ⇒ 同上;
 *  - `within-window`  :结清日在窗内 ⇒ 刚结清,不退。
 *
 * @returns {{cutoff:string, windowDays:number, yields:Array, retained:Array, undetermined:Array}}
 */
export function decideYield({
  face,
  families = ['G', 'D'],
  windowDays = YIELD_WINDOW_DAYS,
  now = new Date(),
  poolMax = LEASE_POOL_MAX,
} = {}) {
  const fams = [...new Set((Array.isArray(families) ? families : [])
    .map((f) => String(f).replace(/[^A-Za-z]/g, '').toUpperCase())
    .filter(Boolean))]
  const segs = segmentFace(face ?? {})
  const empty = { cutoff: null, windowDays, yields: [], retained: [], undetermined: [] }
  if (!segs.some((s) => s.where === 'ledger'))
    return {
      ...empty,
      undetermined: fams.map((f) => ({ family: f, num: null, reason: 'no-ledger-text' })),
    }
  const wd = Number.isFinite(windowDays) && windowDays >= 0 ? Number(windowDays) : YIELD_WINDOW_DAYS
  // ⚠️ 窗的比对必须**同量纲**:台账里的结清日期是"日"(YYYY-MM-DD),把它拿去和"毫秒级 now - 30d"
  // 比大小会凭空吃掉一天 —— 2026-10-29 实测:G-36 结清日 2026-09-29、窗 30 天,`2026-09-29T00:00Z`
  // 与 `now(05:53Z)-30d` 差 6 小时 ⇒ 被判"出窗"让了位。改为**日对日**(两端都取 ISO 日,字符串序
  // 即时间序),且让位窗含端点(正好第 30 天的号仍在窗内)。失效方向必须是"多留一天",不是"早发一天"。
  const cutoff = isoDay(new Date(new Date(now).getTime() - wd * 86400000))

  // 声明位索引:family -> num -> [{where, path, line, state, settledAt, lease}]
  const decls = new Map()
  const hits = new Map() // family -> num -> [{where, path, line, state|null}]
  const addDecl = (f, num, rec) => {
    if (!decls.has(f)) decls.set(f, new Map())
    const m = decls.get(f)
    if (!m.has(num)) m.set(num, [])
    m.get(num).push(rec)
  }
  for (const f of fams) {
    for (const s of segs) {
      for (const [line, row] of s.rows) {
        const p = familyNumOf(row.key)
        if (!p || p.family !== f) continue
        addDecl(f, p.num, {
          where: s.where,
          path: s.path,
          line,
          state: row.state,
          settledAt: row.settledAt,
          lease: row.lease,
          key: row.key,
          snippet: row.raw.trim().slice(0, 120),
        })
      }
      const h = scanFamilyIdHits(s.text, f)
      if (h === null)
        return {
          ...empty,
          cutoff,
          undetermined: [{ family: f, num: null, reason: 'scan-undetermined' }],
        }
      for (const [num, rec] of h) {
        if (!hits.has(f)) hits.set(f, new Map())
        const m = hits.get(f)
        if (!m.has(num)) m.set(num, [])
        for (const site of rec.sites) {
          const row = s.rows.get(site.line) ?? null
          m.get(num).push({
            where: s.where,
            path: s.path,
            line: site.line,
            state: row ? row.state : null,
            snippet: site.snippet,
          })
        }
      }
    }
  }

  const yields = []
  const retained = []
  const undetermined = []
  for (const f of fams) {
    const famHits = hits.get(f) ?? new Map()
    const famDecls = decls.get(f) ?? new Map()
    const nums = [...new Set([...famHits.keys(), ...famDecls.keys()])].sort((a, b) => a - b)
    for (const num of nums) {
      // ① 池外号不在射程:>99 的存量债原本就不占池(poolBlocked 只认 1..poolMax),
      //    动它只会把归档件的可读性搞坏而于池无益 —— 也顺手把"发 >99"那扇门彻底焊死。
      if (!(num >= 1 && num <= poolMax)) continue
      const occ = famHits.get(num) ?? []
      const ds = famDecls.get(num) ?? []
      const reasons = []
      // ⚠️ `open-row` 只认**活台账**的未勾行 = "在册未勾"那一档(票面原话)。归档件里的未勾行是
      // **死快照**(`PROJECT_PLAN_*_renumber-snapshot.md` / `*_auto-archive.md` 里成片留着 `- [ ]`),
      // 它们不可能被并发领号用上,拿它当保留理由只会让每一枚号都永远退不出去 —— 2026-10-29 现读
      // 实测:D 族 44 枚保留号里 41 枚的唯一"在飞"证据就是这种归档未勾行行(散点全灭的同一型)。
      // 归档未勾行不计保留,但**照样入账**(`archivedOpenRefs`),让复核看得见"这枚号在归档面上还有
      // 未勾残行",而不是被悄悄抹掉。
      if (occ.some((o) => o.where === 'ledger' && o.state === 'open')) reasons.push('open-row')
      if (occ.some((o) => o.where === 'ledger' && o.state !== null && o.state !== 'open'))
        reasons.push('live-ledger-row')
      if (ds.some((d) => d.lease)) reasons.push('lease-row')
      if (ds.length === 0) reasons.push('no-declaration')
      else {
        if (ds.some((d) => !d.settledAt)) reasons.push('no-settled-date')
        // 日对日比较(见上面的量纲注):结清日 >= 截止日 ⇒ 仍在窗内,不让位。
        if (ds.some((d) => d.settledAt && String(d.settledAt) >= cutoff)) reasons.push('within-window')
      }
      const archivedOpenRefs = occ.filter((o) => o.where === 'archive' && o.state === 'open').length
      // 标签用**该号自己的书写形状**(取声明位主键原样:`D59` 不添连字符、`G-05` 不掉零);
      // 没有声明位(纯引用)时才退到 `族-号` 这一形态,仅作显示与 --trace 取值。
      const label = ds[0]?.key ? String(ds[0].key).trim() : `${f}-${num}`
      if (reasons.length) {
        retained.push({ family: f, num, label, reasons, evidence: [...ds, ...occ].slice(0, 4) })
        if (reasons.includes('no-declaration') || reasons.includes('no-settled-date'))
          undetermined.push({ family: f, num, label, reasons })
        continue
      }
      yields.push({
        family: f,
        num,
        label,
        settledAt: ds.map((d) => d.settledAt).sort().pop(),
        declarations: ds.map((d) => ({
          where: d.where,
          path: d.path,
          line: d.line,
          state: d.state,
          settledAt: d.settledAt,
          snippet: d.snippet,
        })),
        referenceCount: occ.length,
        archivedOpenRefs,
        referenceSites: occ.slice(0, 6).map((o) => ({
          where: o.where,
          path: o.path,
          line: o.line,
          snippet: o.snippet,
        })),
      })
    }
  }
  return { cutoff, windowDays: wd, yields, retained, undetermined }
}

/** 让位集:family -> Set<num>。取号层只吃这个号集(不读证据)。 */
export function yieldedSetOf(yields) {
  const out = new Map()
  for (const y of Array.isArray(yields) ? yields : []) {
    if (!y?.family) continue
    if (!out.has(y.family)) out.set(y.family, new Set())
    out.get(y.family).add(Number(y.num))
  }
  return out
}

/** 让位前后读数(取号器真正用的那一份池:1..poolMax 补集,经 lib 的 `poolFreeList`)。 */
export function poolReading({ face, family, yielded = null, poolMax = LEASE_POOL_MAX } = {}) {
  const text = String(face ?? '')
  const before = usedIdsOfPrefix(text, family)
  const beforeNums = (before?.ids ?? [])
    .map((l) => Number(/(\d+)$/.exec(String(l))?.[1] ?? Number.NaN))
    .filter((n) => Number.isFinite(n))
  const freeBefore = poolFreeList({ usedNumbers: beforeNums, baseMax: before?.max ?? null, poolMax })
  const after = yielded && yielded.size
    ? usedIdsOfPrefixExcluding(text, family, yielded)
    : before
  const afterNums = (after?.ids ?? [])
    .map((l) => Number(/(\d+)$/.exec(String(l))?.[1] ?? Number.NaN))
    .filter((n) => Number.isFinite(n))
  const freeAfter = poolFreeList({ usedNumbers: afterNums, baseMax: after?.max ?? null, poolMax })
  // 占用枚数**只在 lib 里算一次**:`poolBlocked` 就是取号器那一份口径(baseMax ≤ poolMax 时把
  // lowMax+1..baseMax 一并算占)。在报告侧再数一遍会造出第二把尺 —— "空闲 66"与"发不出号"并存。
  const occupied = (nums, u) =>
    poolBlocked({ usedNumbers: nums, baseMax: u?.max ?? null, poolMax }).blocked.size
  return {
    family,
    before: { used: before?.used ?? null, occupied: occupied(beforeNums, before), free: freeBefore.length, firstFree: freeBefore[0] ?? null },
    after: { used: after?.used ?? null, occupied: occupied(afterNums, after), free: freeAfter.length, firstFree: freeAfter[0] ?? null },
  }
}

/** 读让位账本:坏行不吞(`badLines` 计数),空/缺文件 = 零记录(不是"判不出")。 */
export function readYieldLedger(path) {
  if (!existsSync(path)) return { records: [], badLines: 0, exists: false }
  let raw = ''
  try {
    raw = readFileSync(path, 'utf8')
  } catch (e) {
    return { records: [], badLines: 0, exists: true, unreadable: oneLine(e) }
  }
  const records = []
  let badLines = 0
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    try {
      const rec = JSON.parse(t)
      if (rec && typeof rec === 'object' && rec.family && rec.event) records.push(rec)
      else badLines += 1
    } catch {
      badLines += 1
    }
  }
  return { records, badLines, exists: true }
}

/**
 * 由账本推"此刻生效的让位集":每个 (family,num) 以**最后一条事件**为准
 * (`yield` = 退出占用面,`reclaim` = 重新领用 ⇒ 复归占用面)。这是"可回滚"的全部机制:
 * 追加一条 `reclaim` 就把号还给占用面,不需要改历史。
 */
export function activeYields(records) {
  const last = new Map()
  for (const r of Array.isArray(records) ? records : []) {
    const num = Number(r.num)
    if (!r.family || !Number.isFinite(num)) continue
    last.set(`${String(r.family).toUpperCase()}|${num}`, r)
  }
  const out = new Map()
  for (const r of last.values()) {
    if (r.event !== 'yield') continue
    const f = String(r.family).toUpperCase()
    if (!out.has(f)) out.set(f, new Set())
    out.get(f).add(Number(r.num))
  }
  return out
}

/** 账本里某枚号的全部事件(按写入顺序)—— `--trace` 的反查源。 */
export function traceOf(records, family, num) {
  const f = String(family).toUpperCase()
  const n = Number(num)
  return (Array.isArray(records) ? records : []).filter(
    (r) => String(r.family).toUpperCase() === f && Number(r.num) === n,
  )
}

/** 幂等:已生效的 yield 不重写;已 reclaim 且仍被保留的号不重写。返回待追加记录(不写盘)。 */
export function planRecords({ decision, records, now = new Date() } = {}) {
  const at = new Date(now).toISOString()
  const last = new Map()
  for (const r of Array.isArray(records) ? records : []) {
    last.set(`${String(r.family).toUpperCase()}|${Number(r.num)}`, r)
  }
  const out = []
  const skip = []
  for (const y of decision?.yields ?? []) {
    const k = `${y.family}|${y.num}`
    const prev = last.get(k)
    if (prev && prev.event === 'yield') {
      skip.push({ ...y, why: 'already-yielded' })
      continue
    }
    out.push({
      event: 'yield',
      family: y.family,
      num: y.num,
      label: y.label,
      at,
      windowDays: decision.windowDays,
      cutoff: decision.cutoff,
      settledAt: y.settledAt,
      declarations: y.declarations,
      referenceCount: y.referenceCount,
      referenceSites: y.referenceSites,
      basis: 'plan-pool-yield:v1',
    })
  }
  // 复归:账本里已生效的让位,只要**本轮裁决不再让它退**,就记一条 reclaim 把号还给占用面。
  // 早先只认 `open-row`/`live-ledger-row`(重新领用),但"窗内"这类理由同样会让裁决翻转(窗随日期
  // 推进而滑动、口径修正也会翻转),只认两种会让账本与裁决**长期背离** —— 账本说让位、裁决说保留,
  // 取号侧读账本 ⇒ 一个本该保住的号被悄悄发出去。所以账本是"裁决的当前结论",任何保留理由都复归。
  for (const r of decision?.retained ?? []) {
    const k = `${r.family}|${r.num}`
    const prev = last.get(k)
    if (!prev || prev.event !== 'yield') continue
    out.push({
      event: 'reclaim',
      family: r.family,
      num: r.num,
      label: r.label,
      at,
      reasons: r.reasons,
      evidence: r.evidence,
      basis: 'plan-pool-yield:v1',
    })
  }
  return { records: out, skipped: skip }
}

export function appendYieldRecords(path, records) {
  const lines = (Array.isArray(records) ? records : []).map((r) => JSON.stringify(r))
  if (!lines.length) return { added: 0 }
  const prev = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const head = prev && !prev.endsWith('\n') ? `${prev}\n` : prev
  mkdirSync(dirname(path), { recursive: true })
  atomicWriteFileSync(path, `${head}${lines.join('\n')}\n`)
  return { added: lines.length }
}

/** 现读占用面(台账 ⊕ 归档件,同面同轮 —— 一段不读全就拒绝裁决)。 */
export function readFace({ root = REPO_ROOT, source = 'HEAD' } = {}) {
  const face = collectIdFace({ root, source, doc: 'PROJECT_PLAN.md' })
  if (!face || face.ok !== true || (face.undetermined?.length ?? 0) > 0)
    return { ok: false, why: (face?.undetermined ?? []).join(' / ') || '占用面取不到' }
  // 段边界只能靠逐份取正文:collectIdFace 交出的 archiveFiles 只有 {path,bytes}。这里**复用同一个
  // transport、同一个 source(且 source 是 commit sha ⇒ 内容不可变)**,不另跑一份枚举 —— 枚举/判不出的
  // 所有权柄仍只有 collectIdFace 那一份,本层只补"哪一段是哪份归档件"这个证据锚。
  const archives = []
  for (const f of face.archiveFiles) {
    let text
    try {
      text = ID_FACE_TRANSPORT.show({ root, source, path: f.path })
    } catch (e) {
      return { ok: false, why: `归档件 ${f.path} 二次取正文失败:${oneLine(e)}` }
    }
    if (typeof text !== 'string') return { ok: false, why: `归档件 ${f.path} 二次取正文没拿到文本` }
    archives.push({ path: f.path, text })
  }
  return {
    ok: true,
    face: { ledgerText: face.ledgerText, archives, text: face.text },
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const USAGE = [
  '用法: node scripts/plan-pool-yield.mjs [--family G,D] [--window-days 30] [--apply] [--trace G-59] [--json]',
  '  缺省 --dry-run:只打印"让位前命中/空闲 → 让位后命中/空闲",一个字节不写。',
  '  --apply:把本次新裁决的让位落进 .ihui-agent/state/plan-pool-yield.jsonl(幂等,重跑不重写)。',
  '  --trace <FAM-N>:反查一枚号的让位链(含归档件路径 + 行号 + 片段)。',
].join('\n')

export function parseArgs(argv = []) {
  const out = { families: ['G', 'D'], windowDays: YIELD_WINDOW_DAYS, apply: false, json: false, trace: null, errors: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = String(argv[i])
    if (a === '--apply') out.apply = true
    else if (a === '--json') out.json = true
    else if (a === '--help' || a === '-h') out.help = true
    else if (a === '--family') {
      const v = argv[++i]
      if (!v) out.errors.push('--family 缺值')
      else out.families = String(v).split(',').map((s) => s.trim()).filter(Boolean)
    } else if (a === '--window-days') {
      const v = Number(argv[++i])
      if (!Number.isInteger(v) || v < 0) out.errors.push('--window-days 须是非负整数')
      else out.windowDays = v
    } else if (a === '--trace') {
      const v = argv[++i]
      if (!v) out.errors.push('--trace 缺值')
      else out.trace = String(v)
    } else out.errors.push(`未知参数:${a}`)
  }
  return out
}

function printReading(r) {
  const fmt = (x) => `池内已占 ${x.occupied} / 空闲 ${x.free}`
  console.log(
    `  ${r.family.padEnd(3)} 让位前 ${fmt(r.before)} → 让位后 ${fmt(r.after)}` +
      `(族读数 used ${r.before.used} → ${r.after.used}${r.after.firstFree ? `,让位后首空闲 ${r.family}-${r.after.firstFree}` : ''})`,
  )
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log(USAGE)
    return 0
  }
  if (args.errors.length) {
    for (const e of args.errors) console.error(`❌ ${e}`)
    console.error(USAGE)
    return 2
  }
  const root = process.env.LIVE_ROOT ? resolve(process.env.LIVE_ROOT) : REPO_ROOT
  const ledgerPath = resolve(root, YIELD_LEDGER_REL)
  const led = readYieldLedger(ledgerPath)
  if (led.unreadable) {
    console.error(`❌ 让位账本读不到(${led.unreadable})⇒ 不裁:账本在位却读不出,读成"零让位"会把已让位号又当成占用`)
    return 1
  }
  if (led.badLines > 0) console.error(`⚠️ 让位账本有 ${led.badLines} 行解析不了(已跳过,不静默)`)

  if (args.trace) {
    const p = familyNumOf(args.trace)
    if (!p) {
      console.error(`❌ --trace 取值认不出编号形状:${args.trace}`)
      return 2
    }
    const chain = traceOf(led.records, p.family, p.num)
    console.log(`让位链 ${p.family}-${p.num}(账本 ${YIELD_LEDGER_REL},共 ${chain.length} 条事件)`)
    if (!chain.length) console.log('  (无记录:这一枚号从未让位过 ⇒ 恒在占用面)')
    for (const r of chain) {
      const ev = r.event === 'yield' ? '让位' : '复归占用面'
      const ev2 = r.declarations ?? r.evidence ?? []
      const why = Array.isArray(r.reasons) && r.reasons.length ? ` 保留理由=${r.reasons.join('+')}` : ''
      console.log(
        `  ${r.at ?? '?'} ${ev}:结清=${r.settledAt ?? '-'} 窗=${r.windowDays ?? '-'}天${why}` +
          (ev2[0] ? ` 锚=${ev2[0].path}:${ev2[0].line}「${String(ev2[0].snippet ?? '').slice(0, 50)}」` : ''),
      )
    }
    const face = readFace({ root })
    if (!face.ok) {
      console.log(`  ⚠️ 现面取不到(${face.why})⇒ 现引用未核`)
      return 0
    }
    const live = (face.face.ledgerText ?? '')
      .split('\n')
      .map((l, i) => ({ l, i: i + 1 }))
      .filter((x) => scanFamilyIdHits(x.l, p.family)?.has(p.num))
    console.log(`  现面活台账引用 ${live.length} 处`)
    for (const x of live.slice(0, 5))
      console.log(`    第${x.i}行「${x.l.trim().slice(0, 70)}」`)
    return 0
  }

  const f = readFace({ root })
  if (!f.ok) {
    console.error(`❌ 占用面判不出(${f.why})⇒ 不裁:按窄面裁让位等于撤防线`)
    return 1
  }
  const decision = decideYield({ face: f.face, families: args.families, windowDays: args.windowDays })
  const pending = planRecords({ decision, records: led.records })
  const applied = activeYields(led.records)
  // 让位后读数必须用"账本已生效 ∪ 本次待落 − 本次复归"的净集:dry-run 也要给出 --apply 之后的那个数,
  // 否则"跑一次实测"只能靠真写盘来验(票面要求先看数、后决定)。复归必须一起减 ——
  // 只加不减会让 dry-run 把"已 reclaim 的号"仍算作让位,报出一个取号器根本不会用的宽松数(假绿)。
  const merged = new Map()
  for (const [fam, set] of applied) merged.set(fam, new Set(set))
  for (const rec of pending.records) {
    const fam = String(rec.family).toUpperCase()
    if (!merged.has(fam)) merged.set(fam, new Set())
    if (rec.event === 'yield') merged.get(fam).add(Number(rec.num))
    else merged.get(fam).delete(Number(rec.num))
  }
  const readings = args.families.map((fam) =>
    poolReading({ face: f.face.text, family: fam, yielded: merged.get(fam) ?? new Set() }),
  )
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          cutoff: decision.cutoff,
          windowDays: decision.windowDays,
          readings,
          yields: decision.yields.map((y) => ({ family: y.family, num: y.num, settledAt: y.settledAt })),
          retained: decision.retained.map((r) => ({ family: r.family, num: r.num, reasons: r.reasons })),
          undetermined: decision.undetermined,
          pending: pending.records.length,
          applied: args.apply,
        },
        null,
        2,
      ),
    )
    return 0
  }
  console.log(
    `让位裁决(窗=${decision.windowDays} 天,截止日=${decision.cutoff};池=1..${LEASE_POOL_MAX};` +
      `账本已生效让位 ${[...applied.values()].reduce((a, s) => a + s.size, 0)} 枚)`,
  )
  for (const r of readings) printReading(r)
  const byReason = new Map()
  for (const r of decision.retained) for (const why of r.reasons) byReason.set(why, (byReason.get(why) ?? 0) + 1)
  console.log(
    `  本轮裁决:可让位 ${decision.yields.length} 枚 / 保留 ${decision.retained.length} 枚` +
      (byReason.size ? `(保留原因:${[...byReason].map(([k, v]) => `${k}×${v}`).join(' ')})` : ''),
  )
  if (decision.undetermined.length)
    console.log(
      `  ⚠️ 判不出结清而保留的 ${decision.undetermined.length} 枚(不退,失败方向=守住):` +
        decision.undetermined.slice(0, 12).map((u) => `${u.family}-${u.num}`).join(',') +
        (decision.undetermined.length > 12 ? ' …' : ''),
    )
  if (args.apply) {
    const r = appendYieldRecords(ledgerPath, pending.records)
    const kinds = pending.records.reduce((m, x) => ((m[x.event] = (m[x.event] ?? 0) + 1), m), {})
    console.log(
      `✅ 已落账 ${r.added} 条(${Object.entries(kinds).map(([k, v]) => `${k}×${v}`).join(' ') || '无新增'};` +
        `幂等跳过 ${pending.skipped.length} 枚已让位)⇒ ${YIELD_LEDGER_REL}`,
    )
    const after = readYieldLedger(ledgerPath)
    const nowApplied = activeYields(after.records)
    for (const fam of args.families) {
      const rd = poolReading({ face: f.face.text, family: fam, yielded: nowApplied.get(fam) ?? new Set() })
      console.log(
        `  账本回读 ${fam}:现在生效让位 ${(nowApplied.get(fam) ?? new Set()).size} 枚,池内空闲 ${rd.after.free}`,
      )
    }
  } else {
    console.log(`  (dry-run:未写账本;要落账加 --apply,预期新增 ${pending.records.length} 条)`)
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
