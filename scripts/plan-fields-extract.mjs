// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 侧车抽取器(规格 §4 第 1 步,2026-10-22 立):把台账散文里的"归谁 / 在等什么"搬进
 * `scripts/data/plan-fields.jsonl`,**一个行文本都不改**。
 *
 * 为什么"只搬说辞、不改行"是这一步的唯一形态:台账行是活文档,近 10 把尺子按**整行逐字节**
 * 比份数(union-converge / merge-live-doc / 门 71 / 门 13d / 三维守恒器物…)。改一个字就会
 * 被别的席位的工作树副本按未改还原,或把判定面悄悄挪位。所以 P1 第一段只做"加法":
 * 侧车先长出来,派单读数必须一枚都不动 —— 这条由 `batchBucketDrift` 当场拦住,不靠人自觉。
 *
 * 三条硬规矩(失效方向一律是"少搬",绝不是"多放"):
 *  1. 抽不出可搬的值 ⇒ 不造记录,该行继续由散文判(派单面会报名"仍靠散文判定 N 枚")。
 *     绝不给"可做"的行造 `waiting:none` 记录:那等于把兜底值伪装成有交代(§0.3)。
 *  2. 抽取前后每行的桶必须**零变化**(基线 = **旧侧车**跑同一个 `dispositionOfV2`;投影行把归属句
 *     换成标头后散文面会回落 actionable,那不是漂移 —— 2026-10-25 修)。桶是判定输入;换个地方说
 *     不等于可以说错。任一漂移 ⇒ 整批 `state=refused` 不落,并逐条点名两侧读数。
 *     同键已有记录时**只加不减**(见 `enrichRecord`):桶不同一律不覆盖,桶相同只补/跟随非空字段。
 *  3. 词表只 import 不复制(`ownedElsewhereRe`)。造第二把尺子的下场本仓记过最多次:两把尺
 *     各自读出不同命中集,搬动那一步静默改掉派单判定,而守恒断言比的是桶、看不见词表漂。
 *
 * 取材面纪律(§0.4):台账与侧车**同面同轮** —— 一律经 `plan-tasks` 的 `auditFace` /
 * `readFieldsFace`,全量档读 HEAD blob、`--staged` 读索引 blob、`--worktree` 只作人工逃生舱。
 *
 * 用法:`node scripts/plan-fields-extract.mjs --check | --dry-run | --apply [--staged|--worktree]`
 *       `node scripts/plan-fields-extract.mjs --dedupe [--apply]`(同键去重;默认只报不写)
 * 结论行:`EXTRACT-RESULT state=ready|changed|refused|undetermined changed=N bucketsDrift=M`
 * 退出码:0 = 无待搬 / 1 = 有待搬且本档只报数 / 2 = 未判定或被拒。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { auditFace, readFieldsFace } from './plan-tasks.mjs'
import { FIELDS_REL, normalizeRecord } from './lib/plan-fields.mjs'
import { parseHeader, stripHeader } from './lib/plan-field-line.mjs'
import {
  bucketFromFields,
  compositeKeyOf,
  dispositionFace,
  dispositionOf,
  dispositionOfV2,
  ownedElsewhereRe,
  sidecarHeaderParts,
  waitingEnvRe,
  waitingEnvSlotRe,
} from './lib/plan-task-index.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** 只取归属声明后面的**值**;词表(整族判据)在 `plan-task-index`,这里不复制。
 *  认 `归属:` / `归:` 标头投影、`归属会话=` 与 `持有者:` 三种本仓真实写法。 */
const OWNER_VALUE_RE =
  /(?:归属[:：]|归[:：]|归属会话\s*[=＝]|持有[者人][:：])\s*([^,，。;；\n〕｜]{1,120})/
const MAX_OWNER = 48
const MAX_BLOCKING = 24
/** 归属值里这些形态一定是"别的话"混进来:破折号后的叙述、连续空白(台账排版分隔两件事)、括号补充。 */
const OWNER_CUT_RE = /(?:\s*[—–]{1,2}\s+|\s{2,}|[（(])/
/** 截完还以虚词开头/结尾的,是被人句子的中段顶出来的假持有人 ⇒ 整条不造。 */
const OWNER_LEAD_PARTICLE_RE = /^[的与和及是在为把对跟]/
const OWNER_TAIL_PARTICLE_RE = /[的和与及了]$/
/** 占位值不是归属:不替"未派/待认领"造一条 owner(侧车记录必须指名一个可寻址的持有人)。 */
const OWNER_PLACEHOLDER_RE = /^(?:[—–-]+|未派|待认领|无主|无人|未定)$/
const UPDATED_BY = 'plan-fields-extract'

/** owner 归一(单源出口):投影器要问同一把尺子,否则"等价"判断会与抽取时的截断规则分家。 */
export function cleanOwner(raw) {
  const cut = String(raw ?? '')
    .split(OWNER_CUT_RE)[0]
    // `…` 是"原文已被截断"的痕迹,绝不能进侧车:记录 owner 里带它 ⇒ 每次投影都写出含 `…` 的标头,
    // 而 parseHeader 对 `…` 一律 malformed(截断后的 owner 不能充当权威)⇒ 门 234 A2 永久红
    // (2026-10-25 实测 G-47/G-48/G-49 三行正是这么来的)。去掉省略号、保留已知前缀。
    .replace(/…/g, '')
    .trim()
  if (cut.length < 2) return null
  if (OWNER_PLACEHOLDER_RE.test(cut)) return null
  if (OWNER_LEAD_PARTICLE_RE.test(cut)) return null
  if (OWNER_TAIL_PARTICLE_RE.test(cut)) return null
  return cut.slice(0, MAX_OWNER)
}

/**
 * blocking = **让这一行不落"现在可做"的那段话本身**,不是替他写一句理由。
 * 先取作者自己的自述槽(`在等什么:` / `在等:`),槽里没有才退回词族命中词 ——
 * 两把尺子都问 `plan-task-index` 要同一份正则(§0.6),所以"搬进侧车"不会因词表分家而改判。
 * 等人拍板那一档没有可复用的词族出口(它的判据是带四档护栏的函数),拿不到槽就留空:
 * 宁缺 ⇒ 侧车绝不替人编一句等待理由。
 */
function blockingOf(face, bucket) {
  const slot = waitingEnvSlotRe().exec(face)
  const slotText = slot && slot[1] ? slot[1].trim() : ''
  if (slotText !== '') return slotText.slice(0, MAX_BLOCKING)
  if (bucket === 'waiting-env') {
    const m = waitingEnvRe().exec(face)
    if (m) return m[0].slice(0, MAX_BLOCKING)
  }
  return ''
}

/**
 * 一行 → 一条忠实记录,或 `null`(搬不动)。
 *
 * `waiting` 一律由**散文桶**推得,而不是再判一遍词 —— 这一步的产物必须与它替代的说法同判,
 * 否则"搬"就变成了"改判"。owner 只取 `归属:` 后面的值,且取自遮掉反引号后的面:命中若只存在于
 * 反引号里,那是**转述别人的理由**(G-1058610 病②那一型),不是本行的归属表态。
 */
export function extractFromLine(line, nowIso = new Date().toISOString()) {
  const key = compositeKeyOf(line)
  if (!key) return null
  const bucket = dispositionOf(line)
  if (bucket === 'actionable') return null
  const face = dispositionFace(line)
  // 含标头的遮码面:face 现在剥侧车标头(判定层不该读投影),而"这条键位只有标头一个证据"时
  // owner 仍要从它取 —— 取法必须与判定分开,否则标头-only 行会被抽成空记录。
  const fullFace = String(line).replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length))
  const rec = { key, waiting: 'none', updatedAt: nowIso, updatedBy: UPDATED_BY }
  if (bucket === 'owned-elsewhere') {
    // 命中若只存在于反引号里,那是转述别人的理由(G-1058610 病②),不是本行的归属表态
    const headerOwner = sidecarHeaderParts(line)?.owner ?? ''
    if (!ownedElsewhereRe().test(face) && !headerOwner) return null
    // **散文优先于标头**(2026-10-25 修):标头是投影,它的 owner 可能已被截断/带 `…`;
    // 而正文里的 `归属:` 句才是现读原文。先剥掉行首标头再取值,取不到才退回整行
    // (投影行把归属句换成标头时,标头是唯一证据)。
    const headerless = stripHeader(line)
    let m = null
    let src = headerless
    if (headerless !== line) {
      const masked = dispositionFace(headerless)
      if (ownedElsewhereRe().test(masked)) {
        m = OWNER_VALUE_RE.exec(masked)
        src = headerless
      }
    }
    if (!m) {
      src = line
      m = OWNER_VALUE_RE.exec(fullFace)
    }
    if (!m) return null
    // 同一起点改在原行上取第二遍:face 与 line 等长(反引号遮成等长空白),这样带反引号的路径名
    // 不会被 `\s*` 吃掉;而"命中只在反引号里"仍由上面那次 face 判定挡住。
    const tail = OWNER_VALUE_RE.exec(src.slice(m.index))
    if (!tail) return null
    const owner = cleanOwner(tail[1])
    if (owner === null) return null
    rec.owner = owner
  } else if (bucket === 'waiting-human') {
    rec.waiting = 'human'
  } else {
    rec.waiting = 'env'
  }
  const blocking = blockingOf(face, bucket)
  if (blocking !== '') rec.blocking = blocking
  // 行内标头的 `等:X` 的 X 必须能原样搬回侧车,否则投影永远少一段(门 234 A2 的另一半)。
  // **只搬等段,不搬归属**:归属的权威在侧车;标头里的 owner 若与侧车不一致,由投影器物
  // 按侧车重渲染/摘除(改抽取一侧会把桶悄悄改判 —— 那是三维守恒禁止的事)。
  const h = parseHeader(line)
  if (h.rec && !h.malformed && rec.waiting !== 'none' && !rec.blocking) {
    const text = String(h.rec.blocking ?? '').trim()
    if (text !== '') rec.blocking = text.slice(0, MAX_BLOCKING)
  }
  return rec
}

/**
 * 逐行比对「**旧侧车**判的桶」与「**新侧车**判的桶」,返回漂移点名清单。
 *
 * 2026-10-25 修(治"投影行被抽取器整体误拒"):旧实现拿 `dispositionOf`(纯散文)当 before,
 * 而**投影器物会把逐字等价的归属散文句换成行内标头**(规格 §4.3:只加标头会顶破长行档),
 * 于是投影后的行散文面自然回落 actionable,侧车面仍是 owned-elsewhere ⇒ 每一行都被判"桶漂移",
 * 抽取整批 refused(G-06/G-15/G-18 实测)。契约本来写的是"搬动说辞不得改变判定":判定 =
 * `dispositionOfV2`(散文 ⊕ 侧车),所以 before 必须用**旧侧车**跑同一个函数,而不是裸散文。
 * 不传 `beforeMap`(空侧车)时 v2 回落散文,与改动前逐字同形 —— 自检 S6 的语料仍原样成立。
 */
export function batchBucketDrift(lines, map, beforeMap = new Map()) {
  const beforeFields = { map: beforeMap, undetermined: false }
  const fields = { map, undetermined: false }
  const out = []
  for (const line of lines) {
    const before = dispositionOfV2({ line, fields: beforeFields })
    const after = dispositionOfV2({ line, fields })
    if (after.bucket !== before.bucket) {
      out.push(
        `${compositeKeyOf(line) ?? '(无主键)'} 前=${before.bucket}(来源=${before.source}) ⇄ 后=${after.bucket}(来源=${after.source})`,
      )
    }
  }
  return out
}

const recordsFile = (root) => path.join(root, FIELDS_REL)

function existingLines(root) {
  const abs = recordsFile(root)
  if (!existsSync(abs)) return []
  return readFileSync(abs, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
}

/**
 * 追加记录(侧车**只增不删**):同键同语义已在位 ⇒ 跳过(幂等 —— 重复行会被 `loadFields` 读成
 * orphans,把"谁改的"查不出来,而每次跑的 `updatedAt` 都是当下,按整行逐字节去重等于每重跑一次
 * 就叠一条);同键而语义字段真变了 ⇒ 追加,最新者胜由 `loadFields` 判,本器绝不就地改历史行。
 * 写盘走"临时件 + rename",被拒的批次一个字节都不留在目标文件上。
 */
export function writeRecords(root, recs) {
  const abs = recordsFile(root)
  const before = existingLines(root)
  const haveSigs = new Map()
  const addHave = (rec) => {
    if (!haveSigs.has(rec.key)) haveSigs.set(rec.key, new Set())
    haveSigs.get(rec.key).add(sigOf(rec))
  }
  for (const l of before) {
    let parsed = null
    try {
      parsed = JSON.parse(l)
    } catch {
      continue // 畸形行不参与去重:它本来就不是"在位"的形态,由门报数
    }
    const n = normalizeRecord(parsed)
    if (n.ok) addHave(n.rec)
  }
  const toAppend = []
  let dupSkipped = 0
  let rejected = 0
  for (const raw of recs) {
    const n = normalizeRecord(raw)
    if (!n.ok) {
      rejected++
      continue
    }
    if (haveSigs.get(n.rec.key)?.has(sigOf(n.rec))) {
      dupSkipped++
      continue
    }
    addHave(n.rec)
    toAppend.push(JSON.stringify(n.rec))
  }
  if (toAppend.length === 0) return { appended: 0, dupSkipped, rejected, path: abs }
  mkdirSync(path.dirname(abs), { recursive: true })
  const tmp = `${abs}.tmp-${process.pid}`
  writeFileSync(tmp, [...before, ...toAppend].join('\n') + '\n', 'utf8')
  try {
    renameSync(tmp, abs)
  } catch (e) {
    throw new Error(
      `侧车写盘失败(${String(e?.code ?? e)}),目标文件保持原样:${abs} —— 临时件留在 ${path.basename(tmp)}`,
    )
  }
  return { appended: toAppend.length, dupSkipped, rejected, path: abs }
}

/** 回读记录条数(物理行数,不是去重后的键数 —— 同键多份正是要能看见的形态)。 */
export function readBackCount(root) {
  return existingLines(root).length
}

/**
 * 同键去重(2026-10-25 立;治「唯一写入口只会追加 ⇒ 同键双记录」:门 234 的 4 组矛盾组)。
 *
 * 语义必须**零变化**,三道闸:
 *  1. **解析映射逐键同签名**:`loadFields` 本来就按 updatedAt 最新胜出(并列取先出现的),
 *     本器用同一规则挑一条;挑出的记录与原解析映射逐键比 `SEMANTIC_KEYS` 签名,
 *     任一不等 ⇒ 拒绝(说明盘上副本与判定面已分叉,不是纯去重);
 *  2. **键集相等**:解析映射里有的键,盘上文件必须都有(反之亦然);缺/多一律拒绝 ——
 *     拿旧副本去重会把 HEAD 里新写的记录整条抹掉;
 *  3. **畸形行拒绝**:JSON 坏或值域外的行不替它做决定(§0.3)。
 * 输出按各键**首次出现**的位置排序(不乱序,便于 diff 与人工复核)。
 */
export function dedupeRecords(root = ROOT, { lines = null, map = null } = {}) {
  const raw = lines ?? existingLines(root)
  const parsed = []
  const malformed = []
  for (const [i, l] of raw.entries()) {
    let reason = null
    let rec = null
    try {
      const n = normalizeRecord(JSON.parse(l))
      if (n.ok) rec = n.rec
      else reason = n.why
    } catch {
      reason = 'JSON 解析失败'
    }
    if (rec) parsed.push({ i, raw: l, rec })
    else malformed.push(`#${i + 1}: ${reason}`)
  }
  if (malformed.length)
    return { state: 'refused', why: `畸形行 ${malformed.length} 条(不替看不懂的行做决定):${malformed.slice(0, 3).join('; ')}` }

  // key → { rec: 最新胜出那条, first: 该键首次出现的位置 }。位置只用于**输出排序**,
  // 不能拿"胜出记录所在行"排序(最新那条常常在文件末尾,会让输出整体倒序)。
  const chosen = new Map()
  for (const p of parsed) {
    const cur = chosen.get(p.rec.key)
    // 与 loadFields 完全同序:只有**严格更新**才换(并列取先出现的那条)。
    if (!cur) chosen.set(p.rec.key, { rec: p.rec, first: p.i })
    else if (Date.parse(p.rec.updatedAt) > Date.parse(cur.rec.updatedAt)) cur.rec = p.rec
  }

  let reference = map
  if (!reference) {
    const f = readFieldsFace(root, 'head')
    if (f.undetermined) return { state: 'undetermined', why: f.why }
    reference = f.map
  }
  const mismatch = []
  for (const [k, c] of chosen) {
    const ref = reference.get(k)
    if (!ref || sigOf(ref) !== sigOf(c.rec)) mismatch.push(k)
  }
  const missing = [...reference.keys()].filter((k) => !chosen.has(k))
  if (mismatch.length || missing.length)
    return {
      state: 'refused',
      why:
        `去重后与解析映射不一致(语义变 ${mismatch.length} 键 / 键集缺 ${missing.length} 键)` +
        `:${[...mismatch, ...missing].slice(0, 3).join(', ')}`,
    }

  const out = [...chosen.values()].sort((a, b) => a.first - b.first).map((c) => c.rec)
  return {
    state: out.length === parsed.length ? 'ready' : 'changed',
    dropped: parsed.length - out.length,
    before: raw.length,
    after: out.length,
    records: out,
  }
}

/** 整份重写(临时件 + rename;失败目标一字节不动)。 */
export function writeDedupedRecords(root, records) {
  const abs = recordsFile(root)
  const before = existingLines(root)
  mkdirSync(path.dirname(abs), { recursive: true })
  const tmp = `${abs}.tmp-${process.pid}`
  writeFileSync(tmp, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  try {
    renameSync(tmp, abs)
  } catch (e) {
    throw new Error(
      `侧车去重写盘失败(${String(e?.code ?? e)}),目标文件保持原样:${abs} —— 临时件留在 ${path.basename(tmp)}`,
    )
  }
  return { path: abs, before: before.length, after: records.length }
}

/** 语义签名:只有这四个字段参与判定;`updatedAt` / `updatedBy` 是留痕,不参与。 */
const SEMANTIC_KEYS = ['owner', 'waiting', 'blocking', 'next']
const sigOf = (rec) => SEMANTIC_KEYS.map((k) => `${k}=${String(rec?.[k] ?? '')}`).join('|')

/**
 * 纯函数:行集 + 侧车现有映射 ⇒ 抽得出多少 / 待追加多少。
 * "已在位"必须按**语义**认,不能按整行逐字节认:每次跑的 `updatedAt` 都是当下,
 * 按字节比会让 `--check` 永远报"还有 N 条可搬"、`--apply` 每次叠一条同键旧值 ——
 * 虚增待办与孤儿记录两个病一起犯(账面永远有活是本仓记过最多次的成因)。
 */
/**
 * 已有一条记录时的**只加不减**合并(2026-10-25 立):
 *  · 侧车与散文判出的桶不同 ⇒ **不覆盖**(投影后的行散文面已把归属句换成标头,
 *    再抽一次只会把 owned-elsewhere 降级成 waiting-env —— 实测 G-03/D03 整批被这条顶成 refused);
 *  · 桶相同 ⇒ 只补记录里**缺的**字段(典型:行内标头 `等:X` 的 X 还没进侧车),
 *    并刷新 updatedAt/updatedBy;不删任何既有字段。
 * 返回 null = 不该动这条记录。
 */
export function enrichRecord(existing, candidate) {
  // 桶不同一律不覆盖(双向):改桶 = 改派单判定,必须由投影器物按侧车权威重写标头,
  // 不能借"抽取"这一步偷偷完成(三维守恒与门 234 都把这条当红线)。
  if (bucketFromFields(existing) !== bucketFromFields(candidate)) return null
  const next = { ...existing }
  let changed = false
  // 同桶内以候选(散文/标头的现读)为准,但**空值不覆盖**既有值 —— 只加不减:
  // 投影行把归属句换成标头后,散文侧的 owner 会暂时抽不出(空),那不代表要抹掉侧车里的 owner。
  for (const k of ['owner', 'waiting', 'blocking', 'next']) {
    const cv = candidate[k]
    if (cv === undefined || String(cv ?? '').trim() === '') continue
    if (String(cv) !== String(next[k] ?? '')) {
      next[k] = cv
      changed = true
    }
  }
  if (!changed) return null
  next.key = existing.key
  next.updatedAt = candidate.updatedAt
  next.updatedBy = candidate.updatedBy
  return next
}

export function planFromRows(lines, sideMap) {
  const candidates = []
  for (const line of lines) {
    const rec = extractFromLine(line)
    if (rec) candidates.push(rec)
  }
  const pendingList = []
  for (const c of candidates) {
    const cur = sideMap.get(c.key)
    if (!cur) {
      pendingList.push(c)
      continue
    }
    const merged = enrichRecord(cur, c)
    if (merged) pendingList.push(merged)
  }
  return { candidates, extractable: candidates.length, pending: pendingList.length, pendingList }
}

/** 一次算完:面 → 候选 → 合并侧车 → 漂移。check / dry-run / apply 三处共用同一份,不许两套口径。 */
export function plan({ root = ROOT, face = 'head' } = {}) {
  const a = auditFace(root, face)
  const lines = a.claimableRows.map((r) => r.raw)
  const side = readFieldsFace(root, face)
  if (side.undetermined)
    return {
      undetermined: true,
      why: side.why,
      lines,
      candidates: [],
      pendingList: [],
      extractable: 0,
      pending: 0,
      drift: [],
    }
  const p = planFromRows(lines, side.map)
  // 只有**真正会写出去的那批**(pendingList)参与漂移判定;候选全集里被 enrich 拒掉的那些
  // 本来就不会落盘,拿它们算 before/after 只会把"不写"误报成"改判"。
  const merged = new Map(side.map)
  for (const rec of p.pendingList) merged.set(rec.key, rec)
  return {
    undetermined: false,
    lines,
    ...p,
    // before 面 = **旧侧车**(判定语义的基线),不是裸散文(见 batchBucketDrift 头注)。
    drift: batchBucketDrift(lines, merged, side.map),
    existingCount: readBackCount(root),
  }
}

function printVerdict(p, { listLimit = 0 }) {
  if (p.undetermined) {
    console.log(`⚠️ 未判定 —— 侧车面取不到:${p.why}`)
    console.log('EXTRACT-RESULT state=undetermined changed=0 extractable=0 bucketsDrift=0')
    return 2
  }
  console.log(
    `派单面 ${p.lines.length} 行 ⇒ 抽得出 ${p.extractable} 行(已在侧车 ${p.extractable - p.pending} 行 / 待追加 ${p.pending} 行)` +
      ` / 抽不出(继续靠散文报数)${p.lines.length - p.extractable} 行;侧车现有 ${p.existingCount} 条记录`,
  )
  if (listLimit > 0)
    for (const r of p.pendingList.slice(0, listLimit))
      console.log(`   待追加 ${r.key}  waiting=${r.waiting}${r.owner ? ` owner=${r.owner}` : ''}`)
  if (listLimit > 0 && p.pending > listLimit)
    console.log(`   …另 ${p.pending - listLimit} 条待追加未逐条打印`)
  if (p.drift.length > 0) {
    console.log(
      `❌ 整批不落 —— 抽取后 ${p.drift.length} 行的归属桶发生变化(桶是判定输入,换个地方说不等于可以说错):`,
    )
    for (const d of p.drift.slice(0, 20)) console.log(`   · ${d}`)
    if (p.drift.length > 20) console.log(`   …另 ${p.drift.length - 20} 条同型,未逐条打印`)
    console.log(`EXTRACT-RESULT state=refused changed=0 bucketsDrift=${p.drift.length}`)
    return 2
  }
  console.log('守恒:抽取前后每一行的归属桶零变化(逐行比 旧侧车 ↔ 新侧车,同为 dispositionOfV2)')
  // `changed` 只数**待追加**:全搬完时它是 0 ⇒ state=ready。把"已在位"再报成"有活"就是虚增待办。
  const state = p.pending > 0 ? 'changed' : 'ready'
  console.log(
    `EXTRACT-RESULT state=${state} changed=${p.pending} extractable=${p.extractable} bucketsDrift=0`,
  )
  return p.pending > 0 ? 1 : 0
}

function selfTest() {
  const checks = []
  const ok = (name, cond) => checks.push([name, !!cond])
  const owned = '- [ ] G-1 甲 —— 归属:门 130 持有人,细节'
  const r = extractFromLine(owned)
  ok('S1 归属行抽出 owner', r && r.owner === '门 130 持有人')
  ok('S2 owner 优先于 waiting(与词表同序,搬动不改判)', r && r.waiting === 'none')
  ok('S3 可做的行不造记录', extractFromLine('- [ ] G-2 乙 可做') === null)
  ok('S4 命中词族但无可搬归属值 ⇒ 宁缺', extractFromLine('- [ ] G-3 丙 不代做') === null)
  ok(
    'S5 忠实记录零漂移',
    batchBucketDrift([owned, '- [ ] G-2 乙 可做'], new Map([[r.key, r]])).length === 0,
  )
  const bad = { key: r.key, waiting: 'none', updatedAt: '2026-10-22T00:00:00.000Z' }
  const d = batchBucketDrift([owned], new Map([[bad.key, bad]]))
  ok(
    'S6 造错的记录被点名(两侧读数都摆出来)',
    d.length === 1 && /owned-elsewhere/.test(d[0]) && /actionable/.test(d[0]),
  )
  ok('S7 空侧车不可能有漂移', batchBucketDrift([owned], new Map()).length === 0)
  let fails = 0
  for (const [name, pass] of checks) {
    if (!pass) fails++
    console.log(`${pass ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n自检:${checks.length - fails} 通过 / ${fails} 失败`)
  return fails === 0 ? 0 : 1
}

/**
 * 纯函数:声明式改判的**唯一判据**(main 的 `--reclassify` 档只做 I/O 与打印)。
 * 逐条校验 key 在面 / why ≥10 字 / waiting 合法;与现状同形 ⇒ 跳过(不制造"改过"的假账);
 * 任一不合格 ⇒ 整批 `{error}`(不做部分应用)。
 */
export function applyReclassify(records, items, nowIso = new Date().toISOString()) {
  const byKey = new Map((records ?? []).map((r) => [r.key, r]))
  const WAITING = new Set(['none', 'env', 'human'])
  const changes = []
  for (const [k, it] of (items ?? []).entries()) {
    if (!it || typeof it.key !== 'string' || typeof it.why !== 'string' || it.why.trim().length < 10)
      return { error: `第 ${k + 1} 项缺 key / why 或理由少于 10 字(不说明理由的改判等于替人猜)` }
    const rec = byKey.get(it.key)
    if (!rec) return { error: `第 ${k + 1} 项 key 不在侧车面(陈旧声明不记通过):${it.key}` }
    if (it.waiting !== undefined && !WAITING.has(it.waiting))
      return { error: `第 ${k + 1} 项 waiting 只能是 none/env/human,实际 ${JSON.stringify(it.waiting)}` }
    const next = { ...rec }
    if (it.waiting !== undefined) next.waiting = it.waiting
    if (it.blocking !== undefined) next.blocking = String(it.blocking)
    if (sigOf(next) === sigOf(rec)) continue
    next.updatedAt = nowIso
    next.updatedBy = 'plan-fields-reclassify'
    changes.push({ key: it.key, from: sigOf(rec), to: sigOf(next), why: it.why, rec: next })
  }
  return { changes }
}

function main() {
  const argv = process.argv.slice(2)
  const has = (f) => argv.includes(f)
  if (has('--self-test')) return selfTest()
  // 同键去重(整份重写)是独立档:不和抽取的三种模式混判(它既不读台账面,也不搬说辞)。
  if (has('--dedupe')) {
    const apply = has('--apply')
    const r = dedupeRecords(ROOT)
    if (r.state === 'undetermined' || r.state === 'refused') {
      console.log(`⚠️ 未判定/拒绝 —— ${r.why}`)
      console.log(`DEDUPE-RESULT state=${r.state} dropped=0 before=0 after=0`)
      return 2
    }
    console.log(`DEDUPE-RESULT state=${r.state} dropped=${r.dropped} before=${r.before} after=${r.after}`)
    if (!apply) {
      console.log('   (dry-run:零写盘 —— 侧车文件一个字节都不动)')
      return r.state === 'changed' ? 1 : 0
    }
    if (r.state === 'changed') {
      const w = writeDedupedRecords(ROOT, r.records)
      console.log(`已去重:${w.before} → ${w.after} 条 → ${path.relative(ROOT, w.path)}`)
    } else console.log('   无需去重(同键至多一条)')
    return 0
  }
  // 声明式改判(2026-10-25 立):抽取器的桶来自**当时的散文判据**,判据修正后侧车会把旧桶钉住
  // (v2 尺侧车优先)⇒ 机主令要求代裁结清"待拍板"时,改行也改不动桶。出口 = 逐条声明 key/waiting/
  // blocking/why,与 live-doc-edit 的 LIVE_BUCKET_RECLASSIFY 同一条纪律(逐条、带原因、陈旧不记通过)。
  if (has('--reclassify')) {
    const i = argv.indexOf('--reclassify')
    const file = argv[i + 1]
    const apply = has('--apply')
    if (!file || file.startsWith('--')) {
      console.log('❌ 用法:--reclassify <声明档 JSON> [--apply](缺省 dry-run)')
      return 2
    }
    const d = dedupeRecords(ROOT)
    if (d.state === 'refused' || d.state === 'undetermined') {
      console.log(`⚠️ 未判定/拒绝 —— ${d.why}`)
      console.log('RECLASSIFY-RESULT state=undetermined changed=0')
      return 2
    }
    let items
    try {
      items = JSON.parse(readFileSync(file, 'utf8'))
    } catch (e) {
      console.log(`❌ 读不到/解析不了声明档(${file}):${String(e?.message ?? e).split('\n')[0]}`)
      return 2
    }
    if (!Array.isArray(items) || items.length === 0) {
      console.log('❌ 声明档必须是非空数组 [{key, waiting?, blocking?, why}]')
      return 2
    }
    const records = d.records ?? []
    const byKey = new Map(records.map((r) => [r.key, r]))
    const res = applyReclassify(records, items)
    if (res.error) {
      console.log(`❌ ${res.error}`)
      return 2
    }
    const changes = res.changes
    for (const c of changes) console.log(`  ⟳ ${c.key}: ${c.from} → ${c.to}(原因:${c.why})`)
    console.log(`RECLASSIFY-RESULT changed=${changes.length} declared=${items.length}`)
    if (!apply) {
      console.log('   (dry-run:零写盘 —— 侧车文件一个字节都不动)')
      return changes.length ? 1 : 0
    }
    if (changes.length) {
      for (const c of changes) byKey.set(c.key, c.rec)
      const nextRecords = records.map((r) => byKey.get(r.key) ?? r)
      const w = writeDedupedRecords(ROOT, nextRecords)
      console.log(`已改判 ${changes.length} 条 → ${path.relative(ROOT, w.path)}`)
    }
    return 0
  }
  const modes = ['--check', '--dry-run', '--apply'].filter(has)
  if (modes.length !== 1) {
    console.log(
      '❌ 用法 —— 必须且只能给一个模式:--check(只读)/ --dry-run(只读并逐条点名)/ --apply(写盘)',
    )
    console.log(
      '   不给"默认模式"是刻意的:一件会被误当只读跑的器物如果默认写盘,一次笔误就把侧车刷成垃圾堆。',
    )
    return 2
  }
  if (has('--staged') && has('--worktree')) {
    console.log('❌ 用法错 —— --staged 与 --worktree 不得同用(两个判定面互斥,§0.4)')
    return 2
  }
  const face = has('--staged') ? 'staged' : has('--worktree') ? 'worktree' : 'head'
  let p
  try {
    p = plan({ root: ROOT, face })
  } catch (e) {
    console.log(`⚠️ 未判定 —— 取材失败:${String(e?.message ?? e).split('\n')[0]}`)
    console.log('EXTRACT-RESULT state=undetermined changed=0 bucketsDrift=0')
    return 2
  }
  const code = printVerdict(p, { listLimit: modes[0] === '--check' ? 0 : 40 })
  if (modes[0] !== '--apply') {
    if (modes[0] === '--dry-run') console.log('   (dry-run:零写盘 —— 侧车文件一个字节都不动)')
    return code
  }
  if (code !== 1) {
    if (code === 0) console.log('   本轮零条待追加(抽得出的记录已在侧车):侧车无需写入。')
    return code
  }
  const written = writeRecords(ROOT, p.candidates)
  console.log(
    `已追加 ${written.appended} 条记录(逐字已在位而跳过 ${written.dupSkipped} 条 / 记录不合法被拒 ${written.rejected} 条)→ ${path.relative(ROOT, written.path)}`,
  )
  console.log(`回读条数:${readBackCount(ROOT)}`)
  return 0
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

export const __test__ = {
  extractFromLine,
  enrichRecord,
  batchBucketDrift,
  applyReclassify,
  writeRecords,
  readBackCount,
  dedupeRecords,
  writeDedupedRecords,
  planFromRows,
  plan,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
