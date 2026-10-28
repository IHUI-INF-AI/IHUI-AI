// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 台账侧车字段一致性(2026-10-22 立,blocking 档,只判差值维)。规格:
 * `docs/superpowers/specs/2026-10-22-plan-ledger-schema-design.md` §4 第 3 步。
 *
 * 判三维,取材一律同面同轮(§0.4:全量档 HEAD blob、`--staged` 索引 blob、`--worktree` 只作人工逃生舱):
 *  A1 **本次提交新带入**的未勾登记行里,既没有行内租约、也没有侧车记录的枚数。
 *     租约算交代(它已机器可读地指名持有者),侧车记录算交代(它结构化地指名持有者或等待条件),
 *     两者皆无才是 P1 要收的那种"靠散文猜"的新账 —— 存量一律只报数(下面 stock),
 *     因为 237 行历史账不可能在上线当天补齐:那是一台与任何提交都无关的恒红门(§12e)。
 *  A2 行内投影标头与侧车不一致:读不回(malformed)或投影 `renderHeader(侧车)` 与行内标头**读数不同** ⇒ 点名。
 *     比较走单源 `lib/plan-field-line.mjs` 的 `headerEquivalence()`,它把等式拆成三档(2026-10-26 修):
 *       · `exact`   —— 逐字相等;
 *       · `midform` —— **语义相同、形态未收敛**:行内读回的 owner 与等段文案与记录逐字相等,只是多写了
 *          渲染器从不产出的形态(实测 `〔归:X｜等:—〕` —— 显式空等占位)。这一型**不是归属说错**
 *          (parseHeader 把 `等:—` 读回 waiting=none,dispositionOf 同判,派单桶零影响),所以进入
 *          `midform=` 维**点名但不判红**,并逐行打出收敛出路(投影器物 `plan-fields-project`);
 *          判红它就是与提交内容无关的恒红门(§12e:那 4 行不是任何席本次提交带进来的,而台账不归门改)。
 *       · `mismatch` —— 读得回但读数不同(owner 换人 / 等段换事)⇒ 这才是 A2 要拦的"标头说错了"。
 *     逐字相等仍居首,不使用"包含":标头文本恰好出现在正文别处、而行内标头写了另一个人,那种形态不得蒙过。
 *     投影本身属 P2,所以今天 A2 的射程只有"手工写了个不对的标头"这一型 —— 正是必须现在就拦的那型。
 *     **例外(2026-10-24 补)**:该键位若落在 A3 的矛盾组上,期望标头本身就不可判(见下),
 *     那一行 A2 **不判**并计入 `blind=` 点名 —— "没判"绝不写成"判过"(§0.3),也绝不因为
 *     侧车自己的矛盾把 21 枚已投影行钉成恒红(§12e)。
 *  A3 **侧车同一复合键有多条、且投影读数互相矛盾**的键组(2026-10-24 立,实测缺口复现):
 *     `scripts/data/plan-fields.jsonl` 是"只增不删"的追加面,同键两条天然会发生;真正的问题不是
 *     "多了一份",而是**两条投影出不同标头**时"取哪一条"由 `loadFields` 按 `updatedAt` 隐式裁决
 *     —— 那是写入时刻,不是归属权威。实测 `G-41#围栏只判"新代码不得选用已删出口"` 同键两条:
 *     `owner="持有人"`(退化占位)与 `owner="mcp_unscoped_exit 围栏持有人"`,而当时账面是
 *     `A2 标头不一致 0 枚`(= 说"一致"),同一件事却有两个归属 —— 与 §1 记过的"两把尺子各读出
 *     31 与 59"同型。判据形状照 A1 的差值棘轮接,**不另造机制**:
 *       · 被审面全量矛盾组 ⇒ 只报数(`conflict=`);
 *       · 基准面(HEAD 侧车)没有的签名 ⇒ `a3` 新增,拦红;
 *       · 同键但读数逐字相同(抽取器重跑只换 `updatedAt` 的同义追加)⇒ 归 `dup=` 报数,永不拦红
 *         (拦它就是把门架在唯一合法的写入出口上,§12e)。
 *     投影层的显式规则在同源单点 `lib/plan-field-line.mjs` 的 `resolveSidecar()`:矛盾时输出
 *     `〔归:未判定〕`,不挑一条。
 *
 * 为什么 A1/A3 只在有基准面时才算:全量档(HEAD 面)结构上没有"本次新增"这一维。拿不到基准就写成 0,
 * 等于把"没判"报成"判过"(§0.3),所以那一档明写 `a1=NA`/`a3=NA` 且不参与 verdict。
 *
 * 为什么可以 blocking(§12e/票 G-965):本门的 verdict **只由差值维构成** —— A1 仅在拿得到基准面时
 * 数"本次新带入"的行,A3 仅在拿得到基准侧车面时数"本次新带入"的矛盾键组,A2 只数被审面上**读数真的
 * 不同**的标头(midform 这一型只点名不计入);存量 stock / dup / conflict / midform 只报数、不进判定。
 * 于是全量档存量 153 枚缺侧车 + 34 组矛盾仍是 exit 0 —— 不构成与提交内容无关的恒红门;存量维
 * (哪天把 stock/dup 也判红)仍未升档,那一步的前置才是存量归零。
 *
 * 机读末行:`PLAN-FIELDS-RESULT state=clean|warn|red|undetermined a1=<n|NA> a2=<n> a3=<n|NA>
 *  dup=<n> conflict=<n> blind=<n> midform=<n> orphan=<n> stock=<n> face=<head|staged|worktree>`
 * 退出码:0 = clean/warn / 1 = red / 2 = 未判定(取不到台账或侧车面,含 A3 的基准侧车面)。
 * `orphan`(侧车记录在台账里找不到对应行)与 `midform`(语义同、形态未收敛)都只报数、不进 verdict。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { MAX as HEADER_MAX } from './lib/plan-field-line.mjs'
import {
  HEADER_KIND,
  headerEquivalence,
  parseHeader,
  renderHeader,
  resolveSidecar,
} from './lib/plan-field-line.mjs'
import { fieldsFor } from './lib/plan-fields.mjs'
import {
  bucketFromFields,
  claimMarkOf,
  compositeKeyOf,
  locateSidecarHeader,
  parseTaskRows,
  titleOf,
} from './lib/plan-task-index.mjs'
import { adoptMovesOf } from './plan-fields-extract.mjs'
import { readFieldsFace, readPlan } from './plan-tasks.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(人工逃生舱)' }

/** 未判定臂的夹具落**仓外** scratch(§15b):那里没有 git 库,取材必然失败 ⇒ 这一臂不是摆设。 */
function withScratch(fn) {
  const dir = mkScratch('check-plan-fields')
  try {
    return fn(dir)
  } finally {
    rmScratch(dir)
  }
}

const isOpenRow = (r) => r.state === 'open'
const hasLease = (line) => claimMarkOf(line)?.form === 'lease'

/**
 * 侧车全记录 → 复合键分组 → 只留"同键多条"的组(投影裁决委派单源 `resolveSidecar`,§0.6)。
 * 被审面与基准面走**同一个出口**,否则"签名"在两面各算各的,A3 棘轮就成了第二把尺子。
 * @returns {{conflicts:{key:string,n:number,readings:string[]}[], dup:number}}
 */
export function conflictGroupsOf(records) {
  const byKey = new Map()
  for (const rec of records ?? []) {
    if (!rec || typeof rec.key !== 'string' || rec.key === '') continue
    const list = byKey.get(rec.key)
    if (list) list.push(rec)
    else byKey.set(rec.key, [rec])
  }
  const conflicts = []
  let dup = 0
  for (const [key, recs] of byKey) {
    const res = resolveSidecar(recs)
    if (res.n < 2) continue
    if (res.conflict) conflicts.push({ key, n: res.n, readings: res.readings })
    else dup += 1
  }
  return { conflicts, dup }
}

/** 矛盾组的跨面身份:键 + 去重排序后的投影读数(与记录条数无关,读数才是"矛盾的那件事")。 */
export const sideSig = (g) => JSON.stringify([g.key, g.readings])

/**
 * 侧车记录的**已禁形态**读数(2026-10-26 票②):台账两桶机主禁令(待拍板 F11 / 等条件 F12)
 * 在侧车里的投影就是 `bucketFromFields`(单源,§0.6)落在被禁桶;`blocking` 文本带"拍板"残留
 * 是第三型 —— 桶判据看不见它(owner 在场时桶读 owned-elsewhere),但它渲染出的标头永远挂着
 * 一句"等人拍板"。返回原因数组(空 = 未命中);不静默修数据,改判唯一出口 = `--reclassify`。
 */
export function rotReasonsOf(rec) {
  if (!rec || typeof rec !== 'object') return []
  const reasons = []
  const b = bucketFromFields(rec)
  if (b === 'waiting-human') reasons.push('waiting-human(待拍板桶,F11 禁)')
  else if (b === 'waiting-env') reasons.push('waiting-env(等条件桶,F12 禁)')
  if (String(rec.blocking ?? '').includes('拍板')) reasons.push('blocking 带拍板残留')
  return reasons
}

/** 腐烂记录的跨面身份:键 + 原因(棘轮按它比"本次新增",与 A3 的 sideSig 同一形状)。 */
export const rotSigOf = (rec) => {
  const reasons = rotReasonsOf(rec)
  return reasons.length ? JSON.stringify([rec.key, reasons]) : null
}

/**
 * 三维判定(A1/A2/A3)+ 三个只报数维(dup/conflict/blind)。纯函数:输入是已取好的行与已读好的
 * 侧车(最新映射 + 全记录 + 基准矛盾签名集),不碰 git ——
 * 这样 `--self-test` 与镜像测试能用同一份实现跑构造面,而不是另抄一套判据(§22c)。
 * `baseSideSignatures === null` ⇒ 没有基准侧车面(全量档)⇒ A3 不参与、报 NA(§0.3)。
 */
export function judge(
  rows,
  {
    baseRowTexts = null,
    map = new Map(),
    allRecords = [],
    baseSideSignatures = null,
    baseRotSignatures = null,
    identity = (s) => s,
  } = {},
) {
  const { conflicts, dup } = conflictGroupsOf(allRecords)
  const conflictKeys = new Map(conflicts.map((g) => [g.key, g]))
  const a3List = []
  const conflictList = []
  for (const g of conflicts) {
    conflictList.push(
      `  ${g.key}  ${g.n} 条记录、投影读数 ${g.readings.length} 个互斥:${g.readings.map((x) => clip(x)).join(' ↔ ')}`,
    )
    if (baseSideSignatures !== null && !baseSideSignatures.has(sideSig(g)))
      a3List.push(`  ${g.key}  基准面(HEAD 侧车)没有这个矛盾签名 ⇒ A3 新增拦红`)
  }

  const a1List = []
  const a2List = []
  const midformList = []
  const blindList = []
  let stock = 0
  // 孤儿键归并维(2026-10-26 票①"新旧标识符双向差 ∧ ANC 标题锚点"):改号器只换台账行号、
  // 不搬侧车键,抽取器又按新号补写 ⇒ 同一件事两把键,旧号键成孤儿。判据单源 import
  // `plan-fields-extract` 的 `adoptMovesOf`(§0.6,搬支自带守恒闸),本门不写第二把键匹配:
  //  · 搬支(目标键空)—— 新号键**认领**旧号键的侧车字段;被认领的行不再是"缺交代"
  //    (它的结构化归属已在侧车、只是键还挂在旧号上),判它缺交代就是给合法的改号提交记恒红(§12e);
  //  · 退场支(新号键已被抽取器按新号补写且语义逐字覆盖旧键)—— 旧键退场,不产生第二份。
  // 两支都从 orphan 分流进 `adopt`(只报数;升档前置 = 存量归零,§12e)。
  const adoptRes = adoptMovesOf(allRecords, rows, map)
  const adoptKeys = new Map()
  for (const m of adoptRes.moves) adoptKeys.set(m.fromKey, `搬 → ${m.toKey}`)
  for (const m of adoptRes.retires) adoptKeys.set(m.fromKey, `退场(新号键 ${m.toKey} 已有记录且语义覆盖旧键)`)
  const adoptTargets = new Set(adoptRes.moves.map((m) => m.toKey))
  const adoptList = [...adoptKeys].map(([k, disp]) => `  ${k}  ${disp}`)
  for (const s of adoptRes.skipped) adoptList.push(`  ⚠ ${s.key}  不可归并:${s.why}`)
  // 孤儿记录(规格 §1):侧车记录在台账里找不到对应行 ⇒ **只报数、不判红**。
  // 行键一律走单源 `fieldsFor`(含无主键行的 `T:<sha1>` 兜底键),不在本门另拼一份键;
  // 兜底键本来就会在行被重写时换人,所以"孤儿"是这套设计的已知形态,不是违规。
  const rowKeys = new Set()
  for (const r of rows) rowKeys.add(fieldsFor({ line: r.raw, map: null }).key)
  const orphanKeys = new Map()
  for (const rec of allRecords ?? []) {
    if (!rec || typeof rec.key !== 'string' || rec.key === '') continue
    if (rowKeys.has(rec.key)) continue
    if (adoptKeys.has(rec.key)) continue // 已被新号键认领(搬/退场)⇒ 分流进 adopt,不再计孤儿
    orphanKeys.set(rec.key, (orphanKeys.get(rec.key) ?? 0) + 1)
  }
  let orphan = 0
  const orphanList = []
  for (const [key, n] of orphanKeys) {
    orphan += n
    orphanList.push(`  ${key}  ${n} 条侧车记录在台账里找不到对应行`)
  }
  // 已禁形态腐烂点名(2026-10-26 票②):命中 ⇒ 列腐烂、逐条点名,**不静默修数据**。
  // 差值棘轮:基准侧车面(HEAD)已有的签名只报数,本次新增的签名拦红(与 A3 同形状,§12e);
  // 全量档没有基准 ⇒ rotn=NA 不参与 verdict(§0.3)。改判唯一出口 = plan-fields-extract --reclassify。
  const rotList = []
  const rotSigs = []
  const rotSeen = new Set()
  for (const rec of allRecords ?? []) {
    if (!rec || typeof rec.key !== 'string' || rec.key === '') continue
    if (rotSeen.has(rec.key)) continue
    rotSeen.add(rec.key)
    const reasons = rotReasonsOf(rec)
    if (!reasons.length) continue
    rotList.push(`  ${rec.key}  ${reasons.join(' ∧ ')}(改判出口:plan-fields-extract --reclassify)`)
    rotSigs.push(JSON.stringify([rec.key, reasons]))
  }
  let rotNew = 0
  if (baseRotSignatures !== null)
    for (const s of rotSigs) if (!baseRotSignatures.has(s)) rotNew++
  for (const r of rows.filter(isOpenRow)) {
    const line = r.raw
    const key = compositeKeyOf(line)
    const rec = key ? (map.get(key) ?? null) : null
    if (!rec && !hasLease(line)) {
      if (adoptTargets.has(key)) {
        // 新号键能认领旧号键的侧车字段(搬支在册)⇒ 不算"缺交代":结构化归属已在侧车,
        // 只是键还挂在旧号上。迁移出口:node scripts/plan-fields-extract.mjs --apply。
      } else if (baseRowTexts && !baseRowTexts.has(identity(line)))
        a1List.push(`  L${r.line}  ${key ?? '(无主键)'}  ${titleOf(line) ?? clip(line)}`)
      else stock++
    }
    const p = parseHeader(line)
    if (key && conflictKeys.has(key)) {
      // A2 例外(2026-10-24):键位落在矛盾组上 ⇒ 期望标头本身不可判,这一行 A2 **不判**、
      // 计入 blind 点名 —— "没判"绝不写成"判过"(§0.3),也不因侧车自己的矛盾把已投影行钉成恒红(§12e)。
      if (p.malformed || p.rec)
        blindList.push(`  L${r.line}  ${key}  键位在矛盾组 ⇒ 期望标头不可判,A2 未判`)
    } else if (p.malformed) {
      a2List.push(`  L${r.line}  标头读不回(malformed):${clip(headerOf(line))}`)
    } else if (p.rec && rec) {
      const eq = headerEquivalence(line, rec)
      // 逐字相等是首选;语义相等而形态未收敛(`等:—` 显式空占位这类)只点名不判红 ——
      // 它不是"归属说错",而是投影器物还没重渲染过(2026-10-26:4 枚 A2 恒红实测为此型)。
      if (eq.kind === HEADER_KIND.MISMATCH)
        a2List.push(
          `  L${r.line}  标头 ⇄ 侧车不一致 行内=${clip(eq.said ?? headerOf(line))} 侧车=${clip(eq.want)}`,
        )
      else if (eq.kind === HEADER_KIND.MIDFORM)
        midformList.push(
          `  L${r.line}  ${key}  中间态(语义同、形态未收敛) 行内=${clip(eq.said)} 投影=${clip(eq.want)} —— 出路:node scripts/plan-fields-project.mjs --dry-run → --emit → live-doc-edit`,
        )
    }
  }
  return {
    a1: a1List.length,
    a2: a2List.length,
    a3: a3List.length,
    dup,
    conflict: conflicts.length,
    blind: blindList.length,
    midform: midformList.length,
    stock,
    orphan,
    adopt: adoptKeys.size,
    adoptSkipped: adoptRes.skipped.length,
    rot: rotList.length,
    rotNew,
    hasBase: !!baseRowTexts,
    hasBaseSide: baseSideSignatures !== null,
    a1List,
    a2List,
    a3List,
    midformList,
    conflictList,
    blindList,
    orphanList,
    adoptList,
    rotList,
  }
}

/** 行内那一段投影标头的原文(定位单源 locateSidecarHeader,不写第二份括号语法)。 */
function headerOf(line) {
  const span = locateSidecarHeader(line)
  return span ? line.slice(span.start, span.end) : ''
}

const clip = (s, n = HEADER_MAX + 8) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n)

/**
 * 编号纪元身份尺(2026-10-24):全量重编号后,同一任务的 raw 行必然逐字不同(号是正文的一部分),
 * A1 若按 raw 比对基准面,会把**每一条在册行**都读成"本次新增缺交代" —— 与提交内容无关的恒红门
 * (§12e)。纪元标记下,身份改按"抹掉任务号"后的正文比对:号可以全退全换,正文变一个字仍判新。
 * 仅在候选面带 `<!-- 编号纪元:YYYY-MM-DD … map=<路径> -->` 时启用;无标记 ⇒ 逐字旧行为。
 */
const ID_TOKEN_RE = /\b(?:G|WP|V3|D|O|A|B|P|W)-?\d{1,4}\b/g

export function idNorm(line) {
  return String(line)
    .replace(/〔旧号[^〕]*〕/g, '')
    .replace(/(\s*-\s*\[[ xX]\]\s*(?:（[^）]*）\s*)?)\d{1,3}(?=[.、])/, '$1<ID>')
    .replace(ID_TOKEN_RE, '<ID>')
}

/** 侧车复合键的前缀(号)按重编号映射换算;标题后缀不动 —— 与重排器只换号不换题同一口径。 */
export function translateSideKey(key, translate) {
  if (!translate || translate.size === 0) return key
  const i = key.indexOf('#')
  const id = i < 0 ? key : key.slice(0, i)
  const to = translate.get(id)
  return to ? to + key.slice(i) : key
}

/** 取两面(台账 + 侧车)。任一面取不到 ⇒ 未判定,绝不回落另一个面(§0.4)。 */
export function readFaces(root = ROOT, face = 'head') {
  let content
  try {
    content = readPlan(root, face)
  } catch (e) {
    return {
      ok: false,
      why: `${LABEL[face] ?? face} 取不到 PROJECT_PLAN.md:${String(e?.message ?? e).split('\n')[0]}`,
    }
  }
  const epochMark = face === 'head' ? null : (/<!--\s*编号纪元[:：][^>]*-->/.exec(content) || [])[0] || null
  let translate = null
  if (epochMark) {
    const mapRel = (/map=([^\s>)(]+)/.exec(epochMark) || [])[1] || null
    if (!mapRel) return { ok: false, why: '编号纪元缺 map=<旧号→新号映射路径> ⇒ A1/A3 基准面不可折算' }
    try {
      const parsed = JSON.parse(readFileSync(path.join(root, mapRel), 'utf8'))
      translate = new Map(Object.entries(parsed?.map ?? {}))
    } catch (e) {
      return { ok: false, why: `编号纪元映射取不到(${mapRel}):${String(e?.message ?? e).split('\n')[0]}` }
    }
  }
  const side = readFieldsFace(root, face)
  if (side.undetermined) return { ok: false, why: `侧车面取不到:${side.why ?? '(未点名原因)'}` }
  let base = null
  let baseSideSigs = null
  let baseRotSigs = null
  if (face !== 'head') {
    try {
      // 纪元面:基准身份按抹号后的正文比;无纪元 ⇒ 逐字旧行为(镜像测试锁住这一条)
      const identity = translate ? idNorm : (s) => s
      base = new Set(parseTaskRows(readPlan(root, 'head')).filter(isOpenRow).map((r) => identity(r.raw)))
    } catch (e) {
      return {
        ok: false,
        why: `基准面(HEAD)取不到 ⇒ A1 未判定:${String(e?.message ?? e).split('\n')[0]}`,
      }
    }
    const bs = readFieldsFace(root, 'head')
    if (bs.undetermined)
      return { ok: false, why: `基准侧车面(HEAD)取不到 ⇒ A3 未判定:${bs.why ?? '(未点名原因)'}` }
    // 纪元面:基准矛盾签名里的号按映射折算 —— 重编号只是把这些矛盾搬到新号下,不是新矛盾;
    // 无纪元 ⇒ 原样(旧行为)。折算后仍不匹配的新签名照旧拦红。
    baseSideSigs = new Set(
      conflictGroupsOf([...bs.map.values(), ...(bs.orphans ?? [])]).conflicts.map((g) =>
        sideSig(translate ? { ...g, key: translateSideKey(g.key, translate) } : g),
      ),
    )
    // 已禁形态(腐烂)的基准签名:同面同轮取自 HEAD 侧车;纪元面同样按映射折算号段。
    baseRotSigs = new Set(
      [...bs.map.values(), ...(bs.orphans ?? [])]
        .map((r) => rotSigOf(translate ? { ...r, key: translateSideKey(r.key, translate) } : r))
        .filter(Boolean),
    )
  }
  return {
    ok: true,
    rows: parseTaskRows(content),
    baseRowTexts: base,
    identity: translate ? idNorm : (s) => s,
    map: side.map,
    allRecords: [...side.map.values(), ...(side.orphans ?? [])],
    baseSideSignatures: baseSideSigs,
    baseRotSignatures: baseRotSigs,
    malformedSide: side.malformed ?? 0,
  }
}

export function verdict(v, face) {
  const a1Text = v.hasBase ? String(v.a1) : 'NA'
  const a3Text = v.hasBaseSide ? String(v.a3) : 'NA'
  // midform(语义同、形态未收敛)只报数:它不是归属说错,判红就是与提交内容无关的恒红门(§12e)。
  // rot 走差值棘轮:基准侧车面已有的已禁形态签名只报数(存量清偿前置),本次新增才拦红(§12e)。
  const rotText = v.hasBaseSide ? String(v.rotNew) : 'NA'
  const red =
    v.a2 > 0 || (v.hasBase && v.a1 > 0) || (v.hasBaseSide && v.a3 > 0) || (v.hasBaseSide && v.rotNew > 0)
  const state = red ? 'red' : v.stock > 0 ? 'warn' : 'clean'
  return {
    state,
    code: red ? 1 : 0,
    line:
      `PLAN-FIELDS-RESULT state=${state} a1=${a1Text} a2=${v.a2} a3=${a3Text} dup=${v.dup} ` +
      `conflict=${v.conflict} blind=${v.blind} midform=${v.midform} orphan=${v.orphan} ` +
      `adopt=${v.adopt} rot=${v.rot} rotn=${rotText} stock=${v.stock} face=${face}`,
  }
}

function run({ root = ROOT, face = 'head' } = {}) {
  const f = readFaces(root, face)
  if (!f.ok) {
    console.log(`⚠️ 未判定 —— ${f.why}`)
    console.log(
      `PLAN-FIELDS-RESULT state=undetermined a1=NA a2=NA a3=NA dup=NA conflict=NA blind=NA midform=NA orphan=NA adopt=NA rot=NA rotn=NA stock=NA face=${face}`,
    )
    return 2
  }
  const v = judge(f.rows, {
    baseRowTexts: f.baseRowTexts,
    identity: f.identity,
    map: f.map,
    allRecords: f.allRecords,
    baseSideSignatures: f.baseSideSignatures,
    baseRotSignatures: f.baseRotSignatures,
  })
  console.log(
    `判定面:${LABEL[face]} ⊕ 同轮侧车 ${f.map.size} 条记录(侧车畸形行 ${f.malformedSide} 条,畸形行不参与判定但必须报名)` +
      (v.hasBase ? '' : ' —— 全量档没有"本次新增"这一维 ⇒ A1=NA/A3=NA/rotn=NA,不得读成 0'),
  )
  console.log(
    `A1 新增行缺交代 ${v.hasBase ? v.a1 : 'NA'} 枚 / A2 标头不一致 ${v.a2} 枚 / ` +
      `A3 新增矛盾键组 ${v.hasBaseSide ? v.a3 : 'NA'} 组 / ` +
      `同键同读数 dup ${v.dup} 组 / 全量矛盾 ${v.conflict} 组 / A2 盲区点名 ${v.blind} 枚 / ` +
      `中间态 ${v.midform} 枚(语义同、形态未收敛;点名不判红) / ` +
      `孤儿记录 ${v.orphan} 条(只报数,不判红) / ` +
      `孤儿键归并 ${v.adopt} 条(搬+退场;另有不可归并 ${v.adoptSkipped} 条逐条点名) / ` +
      `已禁形态腐烂 ${v.rot} 条(点名不静默修;本次新增 ${v.hasBaseSide ? v.rotNew : 'NA'} 条) / ` +
      `存量缺侧车记录 ${v.stock} 枚(dup/conflict/blind/midform/orphan/adopt/rot/存量只报数)`,
  )
  for (const l of v.a1List.slice(0, 20)) console.log(`  · A1 ${l}`)
  if (v.a1List.length > 20) console.log(`  · A1 …另 ${v.a1List.length - 20} 枚同型未逐条打印`)
  for (const l of v.a2List.slice(0, 20)) console.log(`  · A2 ${l}`)
  if (v.a2List.length > 20) console.log(`  · A2 …另 ${v.a2List.length - 20} 枚同型未逐条打印`)
  for (const l of v.a3List.slice(0, 20)) console.log(`  · A3 ${l}`)
  if (v.a3List.length > 20) console.log(`  · A3 …另 ${v.a3List.length - 20} 组同型未逐条打印`)
  for (const l of v.midformList.slice(0, 20)) console.log(`  · 中间态 ${l}`)
  if (v.midformList.length > 20)
    console.log(`  · 中间态 …另 ${v.midformList.length - 20} 枚同型未逐条打印`)
  for (const l of v.conflictList.slice(0, 20)) console.log(`  · 矛盾组 ${l}`)
  if (v.conflictList.length > 20)
    console.log(`  · 矛盾组 …另 ${v.conflictList.length - 20} 组同型未逐条打印`)
  for (const l of v.blindList.slice(0, 20)) console.log(`  · A2盲区 ${l}`)
  if (v.blindList.length > 20)
    console.log(`  · A2盲区 …另 ${v.blindList.length - 20} 枚同型未逐条打印`)
  for (const l of (v.orphanList ?? []).slice(0, 20)) console.log(`  · 孤儿 ${l}`)
  if ((v.orphanList ?? []).length > 20)
    console.log(`  · 孤儿 …另 ${v.orphanList.length - 20} 条同型未逐条打印`)
  for (const l of (v.adoptList ?? []).slice(0, 20)) console.log(`  · 归并 ${l}`)
  if ((v.adoptList ?? []).length > 20)
    console.log(`  · 归并 …另 ${v.adoptList.length - 20} 条同型未逐条打印`)
  for (const l of (v.rotList ?? []).slice(0, 20)) console.log(`  · 腐烂 ${l}`)
  if ((v.rotList ?? []).length > 20)
    console.log(`  · 腐烂 …另 ${v.rotList.length - 20} 条同型未逐条打印`)
  // 2026-10-28 改准:这枚数**不是** --apply 能清的面。抽取器按规矩"抽不出可搬的值 ⇒ 不造记录"
  // ⇒ 对这批行 --apply 恒 changed=0,照旧提示"结清出口 --apply"会让人以为跑过了(实测)。
  if (v.stock > 0)
    console.log(
      `   存量 ${v.stock} 枚 = 靠散文判的行(抽取器抽不出可搬的值,按规矩一条记录都不造)⇒ node scripts/plan-fields-extract.mjs --apply 对它们无效(changed=0,跑了也清不掉)。出路二选一:①用 live-doc-edit 在该行正文补「归属:…/在等:…」让抽取器可搬 ②确无可搬说辞的按 plan-fields-extract 头注的声明档处置(--reclassify 只改已有记录、--retire-orphans 只退孤儿键,手改 jsonl 不算通道)`,
    )
  const r = verdict(v, face)
  console.log(r.line)
  return r.code
}

/**
 * 自检:全部跑**构造面**,一条真台账都不碰。含阳性对照(A1/A2 必须能报出来)与未判定臂
 * (取不到面 ⇒ 不记绿也不冒红)。
 */
function selfTest() {
  const checks = []
  const ok = (name, cond) => checks.push([name, !!cond])
  const mk = (raw, line = 1) => ({ line, state: 'open', raw, key: compositeKeyOf(raw) })
  const fresh = '- [ ] G-1 甲 细节'
  const leased = '- [ ] （进行中@2026-10-22/holder-x） G-2 乙 细节'
  const rec = {
    key: compositeKeyOf(fresh),
    owner: '门 130 持有人',
    waiting: 'none',
    updatedAt: '2026-10-22T00:00:00.000Z',
  }

  const v1 = judge([mk(fresh)], { baseRowTexts: new Set(), map: new Map() })
  ok('S1 新行无租约无侧车 ⇒ A1=1(阳性对照)', v1.a1 === 1 && v1.stock === 0)
  const v2 = judge([mk(fresh)], { baseRowTexts: null, map: new Map() })
  ok(
    'S2 无基准面 ⇒ A1 不参与、改报存量(全量档不冒新增)',
    v2.a1 === 0 && v2.stock === 1 && !v2.hasBase,
  )
  const v3 = judge([mk(fresh)], { baseRowTexts: new Set([fresh]), map: new Map() })
  ok('S3 同一行已在基准面 ⇒ 不算新增', v3.a1 === 0 && v3.stock === 1)
  ok(
    'S4 完整租约即交代 ⇒ A1 不重复逼侧车',
    judge([mk(leased)], { baseRowTexts: new Set(), map: new Map() }).a1 === 0,
  )
  const v5 = judge([mk(fresh)], { baseRowTexts: new Set(), map: new Map([[rec.key, rec]]) })
  ok('S5 有侧车记录 ⇒ A1=0', v5.a1 === 0 && v5.stock === 0)

  const want = renderHeader(rec)
  const goodRow = `- [ ] ${want} G-1 甲 细节`
  const badRow = `- [ ] 〔归:另一个人〕 G-1 甲 细节`
  const map1 = new Map([[rec.key, rec]])
  ok('S6 标头与侧车一致 ⇒ A2=0(阳性对照的前半)', judge([mk(goodRow)], { map: map1 }).a2 === 0)
  ok('S7 标头与侧车不一致 ⇒ A2=1(阳性对照)', judge([mk(badRow)], { map: map1 }).a2 === 1)
  ok('S8 标头读不回 ⇒ A2=1', judge([mk('- [ ] 〔归:甲…〕 G-1 丙')], { map: map1 }).a2 === 1)
  ok('S9 headerOf 取回的行内原文就是那一段', headerOf(goodRow) === want)

  const empty = judge([], { baseRowTexts: new Set(), map: new Map() })
  ok(
    'S10 零行 ⇒ clean 且退出 0',
    verdict(empty, 'staged').state === 'clean' && verdict(empty, 'staged').code === 0,
  )
  ok(
    'S11 只有存量 ⇒ warn 且退出 0(warn 档不当红)',
    verdict(v2, 'head').state === 'warn' && verdict(v2, 'head').code === 0,
  )
  ok(
    'S12 有 A1 ⇒ red 且退出 1',
    verdict(v1, 'staged').state === 'red' && verdict(v1, 'staged').code === 1,
  )
  ok('S13 全量档 a1 读数必须是 NA 而不是 0', /a1=NA/.test(verdict(v2, 'head').line))

  const und = withScratch((dir) => readFaces(dir, 'head'))
  ok('S14 取不到面 ⇒ 未判定臂真的通(不记绿也不冒红)', und.ok === false && /取不到/.test(und.why))

  const recB = { key: rec.key, owner: '另一个人', waiting: 'none', updatedAt: '2026-10-23T00:00:00.000Z' }
  const conflictRecords = [rec, recB]
  const v15 = judge([], { allRecords: conflictRecords, baseSideSignatures: new Set() })
  ok(
    'S15 同键两条读数互斥且基准侧车面没有 ⇒ A3=1 拦红(阳性对照)',
    v15.a3 === 1 && v15.conflict === 1 && verdict(v15, 'staged').code === 1,
  )
  const v16 = judge([], {
    allRecords: conflictRecords,
    baseSideSignatures: new Set(conflictGroupsOf(conflictRecords).conflicts.map(sideSig)),
  })
  ok(
    'S16 同一矛盾签名已在基准侧车面 ⇒ 棘轮不涨,A3=0 不拦',
    v16.conflict === 1 && v16.a3 === 0 && verdict(v16, 'staged').code === 0,
  )
  const v17 = judge([], { allRecords: [rec, { ...rec, updatedAt: '2026-10-23T00:00:00.000Z' }] })
  ok(
    'S17 同键同读数(重跑只换 updatedAt)⇒ 归 dup 报数,不算矛盾',
    v17.dup === 1 && v17.conflict === 0 && v17.a3 === 0,
  )
  const v18 = judge([mk(`- [ ] ${renderHeader(rec)} G-1 甲 细节`)], {
    map: new Map([[rec.key, recB]]),
    allRecords: conflictRecords,
  })
  ok(
    'S18 键位落在矛盾组 ⇒ A2 不判、计入 blind 点名',
    v18.a2 === 0 && v18.blind === 1,
  )
  const v19 = judge([], { allRecords: conflictRecords })
  ok(
    'S19 无基准侧车面 ⇒ A3 报 NA 且不当红(§0.3)',
    v19.hasBaseSide === false &&
      /a3=NA/.test(verdict(v19, 'head').line) &&
      verdict(v19, 'head').code === 0,
  )

  // 孤儿记录(规格 §1):记录在台账里找不到对应行 ⇒ 只报数、不判红。
  const orphanRec = { ...rec, key: 'G-999#台账里已经没有这一行' }
  const v20 = judge([mk(fresh)], { map: new Map(), allRecords: [orphanRec] })
  ok(
    'S20 侧车记录找不到对应行 ⇒ orphan 报数且不判红',
    v20.orphan === 1 && verdict(v20, 'staged').code === 0 && v20.a1 === 0,
  )
  const v21 = judge([mk(fresh)], { map: new Map([[rec.key, rec]]), allRecords: [rec] })
  ok('S21 记录有对应行 ⇒ orphan=0', v21.orphan === 0)

  // A2 中间态(2026-10-26):语义同、形态未收敛 ⇒ 点名、不判红。这是 4 枚 A2 恒红实测出来的那一型。
  const holderRec = { key: compositeKeyOf('- [ ] G-7 庚 细节'), owner: '机主运维面', waiting: 'none' }
  const midLine = `- [ ] 〔归:机主运维面｜等:—〕 G-7 庚 细节`
  const v22 = judge([mk(midLine)], { map: new Map([[holderRec.key, holderRec]]) })
  ok(
    'S22 行内多写 `｜等:—`(语义同)⇒ 计入 midform、A2=0、不判红',
    v22.a2 === 0 && v22.midform === 1 && verdict(v22, 'staged').code === 0,
  )
  const wrongOwner = '- [ ] 〔归:另一个面｜等:—〕 G-7 庚 细节'
  const v23 = judge([mk(wrongOwner)], { map: new Map([[holderRec.key, holderRec]]) })
  ok(
    'S23 同形但 owner 换人 ⇒ 仍是 A2 红(中间态不得把"说错了"一起放过)',
    v23.a2 === 1 && v23.midform === 0 && verdict(v23, 'staged').code === 1,
  )
  const wrongWait = '- [ ] 〔归:机主运维面｜等:机主核隧道〕 G-7 庚 细节'
  const v24 = judge([mk(wrongWait)], { map: new Map([[holderRec.key, holderRec]]) })
  ok('S24 同 owner 但等段写成了真等待 ⇒ A2 红(等段也算读数)', v24.a2 === 1 && v24.midform === 0)
  ok(
    'S25 摘掉中间态判据即翻红(成对夹具:三档等式不存在时同一行必落 A2)',
    headerEquivalence(midLine, holderRec).kind === 'midform' &&
      renderHeader(holderRec) !== headerOf(midLine),
  )

  // A2 的"逐字相等":want 若只是出现在正文别处,不得把行内那块错标头蒙过去。
  const sneakyTitle = '- [ ] 〔归:另一个人〕 G-1 甲 细节'
  const sneaky = `${sneakyTitle} —— 备注里写了 ${want}`
  const skey = compositeKeyOf(sneaky)
  ok(
    'S26 标头必须逐字相等(正文里包含同一串不算)',
    judge([mk(sneaky)], { map: new Map([[skey, { ...rec, key: skey }]]) }).a2 === 1,
  )

  let fails = 0
  for (const [name, pass] of checks) {
    if (!pass) fails++
    console.log(`${pass ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n自检:${checks.length - fails} 通过 / ${fails} 失败`)
  // 自检只判构造面,**不**顺手跑真台账:否则"存量 warn"或"实跑 red"会被读成自检失败,
  // 而这两种读数恰恰都是本门设计里允许的结果(§12e)。实跑结论另用不带 --self-test 的命令取。
  return fails === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--staged') && argv.includes('--worktree')) {
    console.log('❌ 用法错 —— --staged 与 --worktree 不得同用(两个判定面互斥,§0.4)')
    console.log(
      'PLAN-FIELDS-RESULT state=undetermined a1=NA a2=NA a3=NA dup=NA conflict=NA blind=NA midform=NA orphan=NA adopt=NA rot=NA rotn=NA stock=NA face=none',
    )
    return 2
  }
  const face = argv.includes('--staged')
    ? 'staged'
    : argv.includes('--worktree')
      ? 'worktree'
      : 'head'
  return run({ root: ROOT, face })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { judge, verdict, readFaces, headerOf, run, conflictGroupsOf, sideSig }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
