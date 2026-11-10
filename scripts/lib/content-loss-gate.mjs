// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * content-loss-gate.mjs —— **合面前后的内容级防丢闸**(2026-11-05,独立于结构缺陷票)。
 *
 * ## 治的是"整份取对侧"这条下游病
 *
 * 行/文件面判据只能证明"路径还在",证明不了"里面的键还在"。一次 `--take-theirs-doc` /
 * `keptTheirs` 把整份对侧盖过来,路径照样在位,`scripts/data/*.json` 少 17 个键、
 * 测试文件少 3 个用例,任何"文件数一致"的闸都看不见。本层只问**内容**:
 *
 *   · `scripts/data/*.json`、`*.jsonl`、`packages/i18n/messages/**\/*.json`
 *       —— 递归键集差集:`oursKeys − mergedKeys` 与 `theirsKeys − mergedKeys` 必须为空;
 *          JSONL 按记录并集取键,任一行解不开 ⇒ 未判定即判红(不静默当空表)。
 *   · 活文档(`PROJECT_PLAN.md`、`README.md`)与 `AGENTS.md`
 *       —— 行级包含:两侧的非空行(去首尾空白比较)必须仍出现在合并结果里,多重集计数
 *          (两侧都有的同一行只要求一份)。
 *
 * 非空即判红并**点名**缺失键/行;判定失败(rev 取不到 / JSON 解不开)同样判红 ——
 * §0.3:判不出不是放行的许可证。本层不参与"要不要删文件"的判断(那是旁路删除硬门的射程)。
 *
 * ## 判据纠偏(2026-11-05,实测咬住第 9 轮收敛落地闸后定夺)
 *
 * `README.*` 的数字表与"守门点名索引"段是 `sync-readme-numbers.mjs`(唯一写入口)的**生成块**
 * (`<!-- BEGIN GENERATED … --> … <!-- END GENERATED … -->`)。生成块的行值随两侧各自提交
 * 时点滚动(trackedFiles/testFiles 只会前进),两侧同一行**天然互斥** —— "合并结果必须包含
 * 对侧生成行"结构上不可满足,等价于 §12e 定义的恒红门:唯一结局是把每个含 README 数字变化的
 * 合并逼去跳门。故本层对活文档的行级包含**先剥生成块再判**,人工段落一行不放宽。
 * 生成块自身的零丢失不在本层裸奔:它由生成器单源(重算即全量覆写,不存在"少带"这一说)
 * + 收敛落地后的 docs 重算腿(47b / auto-commit「README 数字按 HEAD 面重算」系列)承接。
 * AGENTS.md / PROJECT_PLAN.md 无生成块标记,行为与纠偏前逐字节等价。
 *
 * ## 判据纠偏二(2026-11-05,第 11 轮收敛实测顶死后定夺)
 *
 * 行级 union 的「同题折叠」(attestFoldPair)与「摘除台账 credit」已在**产物面**逐条举证
 * (去向行在场 ∧ 同主键/指纹 ∧ 注记与票号被接住)后少带原行;本层若再按逐字包含复读,
 * 被折叠的原始行同时是"归并器证明合法少带"与"本层必须全包含" —— 两道闸互顶,合并死锁。
 * 纠偏 = 调用方把已认账行(creditedDrops)逐字端进来,本层只免**这些**行;未被任何台账认领的
 * 缺口一分不放。与纠偏一同口径:补衔接,不削目标。
 *
 * ## 折叠台账这一格(2026-11-06,在册票 G-32「归并侧那半格」的续办)
 *
 * 本层初版是**第三把**不认折叠的尺子:归并器对 `PROJECT_PLAN.md` 开 `dedupeTasks` 把同题行
 * 折成一份(信息守恒,少的只是行份数),`verifyUnion` 早认这本账(`attestFoldPair` 四问),
 * F5 ⑤ 档也认(2026-10-16 立),唯独本层按字面多重集比 ⇒ 把**合法折叠**读成"少带行"⇒ 恒红。
 * 仓内实测记录就是这个形状:关折叠 0 处 / 开折叠 289 处,真丢失 0 处(纯误拒收)。
 *
 * 治法与前两把尺子同形(§0.6 单一真相源 —— 本层不另写一份"什么叫合法折叠"):
 * 调用方把**同一轮**的折叠台账(`foldLedgerOf` 的产物)喂进来,本层只做**举证** ——
 * 少掉的那几份只有"台账确实声明折了它 ∧ 四问全过(去向行真在产物面 / 同一件事 /
 * 独有注记与票号被接住)"才销账;台账没这一行、台账只解释一部分、或举证不成立 ⇒ 照旧判红。
 * 台账没喂进来 ⇒ 行为与初版逐字一致(旧调用方一条都不放松)。
 *
 * ## 双向分叉合流登记(2026-11-06,本地 `c587dd5023` 的「纠偏二」与远端 2026-11-06 的
 * ## 「折叠台账这一格」是同一次分叉的两侧,谁都不含谁 ⇒ 就地合流,不选边)
 *
 * 两侧治的是同一个死锁(归并器已举证的合法少带被本层逐字复读成丢失),但**举证来源不同**:
 *  - 本地侧(`creditedDrops`):调用方(union-converge 的落地闸)把 `verifyUnion` 同一轮已经
 *    按 `attestFoldPair` / `declaredDropCaps` / `declaredFamilyCaps` 在产物面举过证的
 *    `p.folded[].dropped ∪ p.dropLedgerCredited[].dropped` **逐字端进来**,本层只免这些行。
 *  - 远端侧(`foldLedgers` / `declaredRemovals` / `base`):调用方端**原始台账**,举证在本层跑
 *    (仍是那三份单源判据,§0.6 没写第二份),外加「基底有、本侧已删 ⇒ 归并不补回」的重数维。
 *
 * 合流口径 = **三个独立举证来源**,一行只有在**至少一个来源自己的前置全数成立**时才免复读;
 * 任一来源成立不了就不给它免,照旧判红。刻意没有做的事(§0.2:失效方向只能是"多要一次说明"):
 *  · 三路**没有**并成"任一命中即整行放行"的统一放宽 —— 每一路自己的前置一个不少:
 *    远端折叠路仍须过 `attestFoldPair` 四问 ∧ 台账申报份数足以覆盖 deficit;
 *    远端摘除路仍须 `declaredDropCaps` 三条(逐字命中 ∧ 产物面已无此行 ∧ 是登记行形)与
 *    `declaredFamilyCaps` 的族凭据;本地认账路仍须"该行逐字在调用方端进来的认账集里"。
 *  · 本地认账集**只在"没有任何台账对本层开过口"时**才被采纳(`dropCreditOf` 与 `foldCreditOf`
 *    双双给出 `none`,即两本账都没这一行)。它**不压过**远端侧的积极结论:
 *    - `lost`(去向行不在产物面 / 与被折行不是同一件事 / 注记票号没接住)= 产物面上的**反证**;
 *    - 折叠已 attested 但台账只解释部分份数 = 仍有 `deficit − cap` 份无任何凭据;
 *      这两格本地认账集一律不许言下撤回 —— 认账集是**行级**的,没有份数维度,拿它去消一份
 *      有数量缺口的账就是"并成或条件后统一放宽"。本地调用方只端认账集、不端台账,这两格在
 *      它的输入面上根本不会出现,故不削它的机制。
 *    - `undetermined`(判不出去向)按 §0.3 仍记「未判定」:未判定不是放行许可证,也不因为
 *      认账集里有这一行就把注记洗掉(注记本来就不进缺行清单,少掉它只会让 ok 变绿)。
 *  · 任一侧单独缺席 ⇒ 与那一侧的原实现**逐字同行为**:只端认账集(本地调用方形)⇒ 两本台账
 *    取不到 ⇒ `none` ⇒ 认账集生效、其余维度不开;只端台账(远端调用方形)⇒ 认账集为空 ⇒ 本层
 *    与本文件远端形态逐字同结论;两者都不端 ⇒ 与初版逐字一致(旧调用方一条都不放松)。
 *  · 认账集免掉的每一行**同样报名**:与折叠/摘除销账共用 `dropped` 一条通道,`via` 写明
 *    `调用方认账集(creditedDrops)`,绝不静默折进"0 丢失"(§0.10;本地侧原实现是 `.filter` 掉
 *    就完事、无痕可查,合流后按远端侧的留痕纪律收紧 —— 只加判据不减)。
 */
import { gitRaw } from './face-reader.mjs'
// 折叠销账与摘除销账的举证判据**只有一份**(§0.6):本层不另写"什么叫同一件事/什么叫注记被接住",
// 也不另写"什么叫本机已声明摘除"(逐字那一族住在 `declaredDropCaps`:逐字命中台账 ∧ 该面已无此行
// ∧ 是登记行形;改写形态那一族住在 `declaredFamilyCaps`:题面指纹/复合主键/题面 32 字指纹任一命中)。
import { attestFoldPair, declaredDropCaps, declaredFamilyCaps } from './union-converge-judgments.mjs'

/** `scripts/data` 下的数据件(含子目录)与五语言词包。 */
export const KEY_SET_PATH_RE = /^(?:scripts\/data\/(?:.*\/)?[^/]+\.(?:json|jsonl)|packages\/i18n\/messages\/(?:.*\/)?[^/]+\.json)$/
/** 行级包含的活文档(与 union-converge 的 LIVE_DOCS 同口径);`AGENTS.md` 单列要求,这里一并覆盖。 */
export const DEFAULT_LIVE_DOCS = ['PROJECT_PLAN.md', 'AGENTS.md', 'README.md']

export const __MAX_LISTED = 40

function readRev(root, rev, path) {
  try {
    return gitRaw(['show', `${rev}:${path}`], root, { timeout: 60_000 })
  } catch {
    return null // 该 rev 没有这份文件(新增 / 删除)
  }
}

function diffNames(root, a, b) {
  try {
    return gitRaw(['diff', '--name-only', a, b], root, { timeout: 60_000 })
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean)
  } catch {
    return null
  }
}

/** JSON 递归键集:数组按 `[]` 折叠(不给下标),对象键拼点路径。 */
export function jsonKeySet(value, prefix = '', out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) jsonKeySet(item, `${prefix}[]`, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const p = prefix ? `${prefix}.${k}` : k
      out.add(p)
      jsonKeySet(v, p, out)
    }
  }
  return out
}

/** 文本 → 键集;JSONL 逐行并集。解不开返回 `{error}`(调用方必须判红)。 */
export function textKeySet(text, path) {
  if (text === null || text === undefined) return { keys: new Set(), absent: true }
  try {
    if (/\.jsonl$/i.test(path)) {
      const keys = new Set()
      // 2026-11-05:JSONL 里 `//` 开头的注释行是仓库既有写法(`scripts/data/intentional-file-deletions.jsonl`
      // 首行即 "// 有意整文件删除…"),它们不是数据行。原先逐行 JSON.parse 连注释也解,一份带注释的
      // 台账只要被本侧改过就会让整份键面判"解不开"并阻断落地(实测旁路删除硬门的台账补录后触发)。
      // 2026-11-10 补:`#` 开头的注释行同样是仓库既有写法且由文件自身声明 ——
      // `scripts/data/migration-rewrite-ledger.jsonl` 头注逐字写着「每行一条 JSON,`#` 开头为注释」,
      // 基底/本侧/对侧三方首行都是 `#`。只认 `//` 会把这份正常台账整份判成"解不开",
      // 按 §0.3 拒绝落地并锁死合流。故按文件自述惯例一并跳过 `#` 行;数据行的解析与键面判红口径不变。
      const lines = String(text)
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.trimStart().startsWith('//') && !l.trimStart().startsWith('#'))
      for (const line of lines) jsonKeySet(JSON.parse(line), '', keys)
      return { keys }
    }
    return { keys: jsonKeySet(JSON.parse(String(text).replace(/^\uFEFF/, ''))) }
  } catch (e) {
    return { error: `${path} 的 JSON 解不开:${String(e?.message ?? e).slice(0, 120)}` }
  }
}

/**
 * 剥掉「生成块」(成对的 `<!-- BEGIN GENERATED … -->` / `<!-- END GENERATED … -->` 之间含标记行)。
 * 生成块是派生态:行值随重算时点滚动,两侧互斥是常态(见头注「判据纠偏」)。
 * 剥块只做**行级包含判据的输入整形**,不改文件本体、不影响键集面。
 */
export function stripGeneratedBlocks(text) {
  if (text === null || text === undefined) return text
  const out = []
  let inGen = false
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (/^<!--\s*BEGIN GENERATED\b/i.test(line)) {
      inGen = true
      continue
    }
    if (/^<!--\s*END GENERATED\b/i.test(line)) {
      inGen = false
      continue
    }
    if (!inGen) out.push(raw)
  }
  return out.join('\n')
}

/** 非空行多重集(去首尾空白比较,行内空白不动)。 */
export function lineMultiset(text) {
  const m = new Map()
  if (text === null || text === undefined) return m
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    m.set(line, (m.get(line) || 0) + 1)
  }
  return m
}

/** side 里有、merged 里不够的行(点名用)。 */
export function missingLines(sideText, mergedText) {
  return missingLineCounts(sideText, mergedText).map((x) => x.line)
}

/**
 * 同上,但**连"少了几份"一起给** —— 折叠销账按份数算(台账只解释 N 份就是 N 份的额度),
 * 只知道"少了一行"分不出"少带 1 份"与"少带 5 份"(§0.6:份数口径只许一份)。
 */
export function missingLineCounts(sideText, mergedText) {
  const have = lineMultiset(mergedText)
  const missing = []
  for (const [line, count] of lineMultiset(sideText)) {
    const got = have.get(line) || 0
    if (got < count) missing.push({ line, deficit: count - got })
  }
  return missing
}

/**
 * 折叠台账的字面归一(2026-11-06)。
 *
 * 台账的字面来自折叠层自己的行重数(`counter`,**不裁剪**),本层的行重数**去首尾空白**
 * ⇒ 两边字面必须归到同一空间才能配对。这里只做**裁剪**这一件事:不改内容、不改份数。
 * 裁剪后同一字面出现多次 ⇒ 只留先到的一条(台账同一字面只应有一条,重复即陈旧,不多认)。
 */
export function foldPairsOf(ledger) {
  const out = new Map()
  for (const x of ledger?.pairs ?? []) {
    if (!x || typeof x.dropped !== 'string') continue
    const dropped = x.dropped.trim()
    if (!dropped || out.has(dropped)) continue
    const kept = typeof x.kept === 'string' ? x.kept.trim() : ''
    out.set(dropped, {
      dropped,
      kept: kept ? kept : null,
      droppedCopies: Number.isFinite(x.droppedCopies) ? x.droppedCopies : 0,
    })
  }
  return out
}

/**
 * 一条"少带的行"能不能用折叠台账销账。
 *
 * **举证只认 `attestFoldPair` 四问**(同一件事 / 去向行真在产物面 / 独有注记与票号被接住),
 * 本层不另写一份(§0.6)。四问不过 ⇒ 一分不给:
 *  - `none`        —— 台账没这一行 ⇒ 折叠从未声明折过它 ⇒ 照旧判红(真丢失的牙一处不松);
 *  - `undetermined`—— 判不出(主键算不出/去向给不出)⇒ 记「未判定」并点名,**不当成"没丢"**(§0.3);
 *  - `lost`        —— 举证不成立 ⇒ 判红。
 *
 * 额度封顶在台账申报的份数:台账报折 N 份就只销 N 份,剩下的仍是真少带。
 * **台账申报 0 份(或份数不是一个正数)= 一份都不销** —— 台账只报"折掉了"的行,真折叠报出的份数
 * 恒 ≥1(见 `foldLedgerOf`:只有真少了才成对),所以 0/非数只可能来自陈旧或外来的台账。
 * 这一格必须往"多要一次说明"的方向取:不得回落成"台账没报份数就当它全销"(§0.10 方向禁令)。
 *
 * @param {string} line 少带的那一行(已去首尾空白)
 * @param {number} deficit 这一侧少了几份
 * @param {Map<string,{dropped:string,kept:string|null,droppedCopies:number}>} pairOf 台账(已归一)
 * @param {Map<string,number>} mergedMap 产物面的行重数(去首尾空白)
 */
export function foldCreditOf(line, deficit, pairOf, mergedMap) {
  const pair = pairOf?.get?.(line)
  if (!pair) return { status: 'none', credit: 0, kept: null, reason: '折叠台账没有这一行 ⇒ 不是合法折叠' }
  const att = attestFoldPair({ dropped: pair.dropped, kept: pair.kept }, mergedMap)
  if (att.status !== 'attested')
    return { status: att.status, credit: 0, kept: att.kept ?? null, reason: att.reason }
  const cap = Number.isFinite(pair.droppedCopies) && pair.droppedCopies > 0 ? pair.droppedCopies : 0
  return { status: 'attested', credit: Math.min(deficit, cap), kept: att.kept, reason: '' }
}

/**
 * 一条"少带的行"能不能用**本机摘除台账**销账(2026-11-06,续办 G-32 那半格的另一半)。
 *
 * 判据不在这层写:`caps` 由调用方用 `declaredDropCaps(产物面, 台账逐字集)` 算出来 —— 那本尺
 * 已经要求「台账逐字命中 ∧ 该面已无此行 ∧ 是登记行形」三条同时成立才入册(取不到台账 ⇒ 空集,
 * 一条不扣)。本层只做字面归一(去首尾空白,与 `foldPairsOf` 同一处理)与份数封顶:
 *  - `declared` —— 在该面已入册 ⇒ 全额销账,但**必须报名**(§0.10 不许静默折进"0 丢失");
 *  - `none`     —— 台账没这一行 ⇒ 真丢失的牙一处不松,照旧判红。
 * 额度取该侧的 deficit:摘除台账声明的是"这一行整行被正当摘走",不存在"只摘一半份数"的形态。
 *
 * @param {string} line 少带的那一行(已去首尾空白)
 * @param {number} deficit 这一侧少了几份
 * @param {Set<string>|null} caps `declaredDropCaps` 的产物(未归一)
 */
export function dropCreditOf(line, deficit, caps) {
  if (!(caps instanceof Set) || caps.size === 0) return { status: 'none', credit: 0 }
  for (const l of caps) if (l.trim() === line) return { status: 'declared', credit: deficit }
  return { status: 'none', credit: 0 }
}

/** `sideKeys − mergedKeys`,排序后返回。 */
export function missingKeys(sideKeys, mergedKeys) {
  return [...sideKeys].filter((k) => !mergedKeys.has(k)).sort()
}

/**
 * 判定一次合并的内容面。
 *
 * 三个**互相独立**的举证来源(头注「双向分叉合流登记」),各自的前置都不因对方而放宽:
 *  - `creditedDrops`   —— 调用方在同一轮 `verifyUnion` 里已按单源判据举过证的少带行(行级、逐字);
 *  - `foldLedgers`     —— 折叠原始台账(`foldLedgerOf` 产物),举证在本层跑 `attestFoldPair` 四问,
 *                         额度封顶在台账申报的份数;
 *  - `declaredRemovals`—— 本机摘除台账整份/Set,逐字族走 `declaredDropCaps`、改写形态族走
 *                         `declaredFamilyCaps`(判据都在那两把尺里,本层不复算);
 *  - `base`            —— 基底面,给「基底有、本侧已删 ⇒ 归并不补回」的重数维;
 *                         **没喂 ⇒ 该维一条都不放行**(§0.3:取不到不是放行许可证)。
 *
 * @param {{root:string, ours:string, theirs:string, merged:string, paths?:string[],
 *          liveDocs?:string[], read?: (rev:string,path:string)=>string|null,
 *          creditedDrops?: Set<string>|string[]|null,
 *          foldLedgers?: Map<string,{pairs:Array<{dropped:string,kept:string|null,droppedCopies:number}>}>|null,
 *          declaredRemovals?: Set<string>|{set:Set<string>,keyIndex?:Map<string,string[]>,dropTitleRows?:Map<string,string[]>,dropTitleFps?:Set<string>,filesSeen?:number,malformedLines?:string[]}|null,
 *          base?: string|null}} a
 * @returns {{ok:boolean, checked:string[], violations:Array<{path:string,kind:string,
 *           missingOurs:string[], missingTheirs:string[], error?:string}>, undetermined:string[],
 *           folded:Array<{path:string,side:string,dropped:string,copies:number,kept:string|null}>,
 *           dropped:Array<{path:string,side:string,line:string,copies:number,via:string,ledgerRows?:string[]}>}}
 *           (`dropped[].via` 逐条写明销账来自哪一路:`逐字` / `族:…` / `本侧处置权已行使(基底有、本侧已删)`
 *            / `调用方认账集(creditedDrops)` —— 每一处免复读都必须报名,§0.10)
 */
export function judgeContentLoss({
  root,
  ours,
  theirs,
  merged,
  paths,
  liveDocs = DEFAULT_LIVE_DOCS,
  creditedDrops = null,
  read = (rev, path) => readRev(root, rev, path),
  foldLedgers = null,
  declaredRemovals = null,
  base = null,
}) {
  // 已由折叠/摘除台账认过账的行(调用方把 p.folded[].dropped ∪ p.dropLedgerCredited[].dropped 逐字端进来):
  // attestFoldPair 已在**产物面**举过证(去向行在场 ∧ 同指纹/主键 ∧ 注记与票号被接住),
  // 本层若再按逐字包含复读一遍,两道闸就互相顶死 —— 折叠线自己既在 missing 里被点名、
  // 又永远不可能"在 merged 里出现原始形态"。纠偏口径:只免认过账的,未入账缺口一分不放。
  // 合流后这一路是**三个独立举证来源之一**(头注「双向分叉合流登记」):它只在 `dropCreditOf` 与
  // `foldCreditOf` 都答不上(两本台账对本层没开过口)时才采纳,且**不压过** `lost` / 只覆盖部分
  // 份数这两种积极结论 —— 认账集是行级的、没有份数维度,用它去消数量缺口就是"统一放宽"。
  // 取不到 / 没喂 ⇒ 空集 ⇒ 一条不免(与远端形态逐字同结论);免掉的每一行仍进 `dropped` 报名。
  const credit = creditedDrops instanceof Set ? creditedDrops : new Set((creditedDrops ?? []).map((l) => String(l ?? '').trim()).filter(Boolean))
  const undetermined = []
  const folded = []
  const dropped = []
  let candidates = paths ? [...new Set(paths)] : null
  if (!candidates) {
    const a = diffNames(root, ours, merged)
    const b = diffNames(root, theirs, merged)
    if (a === null || b === null) {
      undetermined.push(`合并前后差集取不到(${ours}..${merged} / ${theirs}..${merged})`)
      candidates = []
    } else candidates = [...new Set([...a, ...b])]
  }
  const scoped = candidates.filter((p) => KEY_SET_PATH_RE.test(p) || liveDocs.includes(p))
  const violations = []
  for (const p of scoped) {
    const o = read(ours, p)
    const t = read(theirs, p)
    const m = read(merged, p)
    if (KEY_SET_PATH_RE.test(p)) {
      const mo = textKeySet(o, p)
      const mt = textKeySet(t, p)
      const mm = textKeySet(m, p)
      const bad = [mo.error, mt.error, mm.error].filter(Boolean)
      if (bad.length) {
        violations.push({ path: p, kind: 'keys', missingOurs: [], missingTheirs: [], error: bad[0] })
        continue
      }
      const missingOurs = missingKeys(mo.keys, mm.keys)
      const missingTheirs = missingKeys(mt.keys, mm.keys)
      if (missingOurs.length || missingTheirs.length)
        violations.push({ path: p, kind: 'keys', missingOurs, missingTheirs })
      continue
    }
    // 活文档行级包含:生成块已剥(两侧数字互斥是常态,头注「判据纠偏」),人工段落一行不放宽。
    const missingOurs = missingLines(stripGeneratedBlocks(o), stripGeneratedBlocks(m))
    const missingTheirs = missingLines(stripGeneratedBlocks(t), stripGeneratedBlocks(m))
    /**
     * 「本侧处置权已行使」那一维(2026-11-06 补,镜像 union 侧 `liveDocExpectedCounts` 的
     * `addedByTheirs = n − max(base, ours)`):**基底里就有、本侧已删**的行,归并不从对侧补回
     * (完成即删 / 摘除 / 让号的处置权在本侧;补回就是"回捞已结清行",本仓为它打了一个月的仗)。
     * 本层此前把这种行读成"对侧少带"⇒ 逼人把已删的行复活 ⇒ 恒红门那一型(§12e)。
     *
     * 判据只问**重数**:对侧这一行相对基底**新增**(对侧份数 > max(基底份数, 本侧份数))⇒ 归并
     * 本就该带回它,少带才是丢;否则归并压根没欠它 ⇒ 不算丢。
     * 底面取不到(`base` 没喂)⇒ 一条都不放行(照旧判红):取不到不是放行许可证(§0.3)。
     */
    const baseRaw = base ? lineMultiset(read(base, p) ?? '') : null
    const oursRaw = lineMultiset(o ?? '')
    const theirsRaw = lineMultiset(t ?? '')
    const missingTheirsOwed = []
    for (const l of missingTheirs) {
      const tn = theirsRaw.get(l) || 0
      const on = oursRaw.get(l) || 0
      const bn = baseRaw ? baseRaw.get(l) || 0 : tn
      if (baseRaw && tn <= Math.max(bn, on)) {
        // 本侧处置权已行使 ⇒ 归并不欠它 ⇒ 不算丢(但要报名,不许静默折进"0 丢失")。
        dropped.push({ path: p, side: '对侧', line: l, copies: 0, via: '本侧处置权已行使(基底有、本侧已删)' })
        continue
      }
      missingTheirsOwed.push(l)
    }
    /**
     * 活文档维:行级包含 + **折叠台账销账**(2026-11-06)。
     *
     * 销账的判据只有一份(`attestFoldPair`),本层只做举证与报数:
     * 台账没喂进来 / 台账没这一行 / 举证不过 ⇒ 照旧判红;台账只解释一部分 ⇒ 剩下的仍判红。
     * 销掉的每一笔都要进 `folded` 并随报告报名(§0.10:少带的份数不许静默折进"0 丢失")。
     *
     * 销账在**缺行清单之上**做(不改清单怎么算出来的):清单由行级包含判据出,本层只把其中
     * 「台账声明折了它 ∧ 四问全过」的那些份销掉 —— 清单本身仍是人工段落一行的底线。
     */
    const mergedMap = lineMultiset(m)
    const pairOf = foldPairsOf(foldLedgers?.get?.(p))
    // 摘除台账这一格:三条判据全在 `declaredDropCaps` 里(逐字命中 ∧ 产物面已无 ∧ 登记行形),
    // 本层不复算;台账没喂进来(null)⇒ 空集 ⇒ 与初版逐字一致(旧调用方一条都不放松)。
    // 台账有两种形状:裸 Set(逐字那一族够用)与台账构造出口的整份对象(多带「题面 32 字指纹」
    // 与「整台账缺失」两档)⇒ 两种都认,免得族那一维在只喂 Set 的调用方身上整个不开。
    const ledgerSet =
      declaredRemovals instanceof Set
        ? declaredRemovals
        : declaredRemovals?.set instanceof Set
          ? declaredRemovals.set
          : null
    const ledgerObj = declaredRemovals instanceof Set ? null : (declaredRemovals ?? null)
    const dropCaps = ledgerSet ? declaredDropCaps(m, ledgerSet) : new Set()
    // 份数口径与上面的缺行清单**同面同轮**:清单在剥过生成块的文本上出,份数也得在同一个
    // 文本上出(否则清单说"少一行"、份数说"少五份",两个口径对不上 ⇒ 销账额度算错)。
    const deficitsOf = (sideText) =>
      new Map(
        missingLineCounts(stripGeneratedBlocks(sideText), stripGeneratedBlocks(m)).map((x) => [
          x.line,
          x.deficit,
        ]),
      )
    const sideMissing = (missingList, sideText, sideName) => {
      const deficits = deficitsOf(sideText)
      const out = []
      for (const line of missingList) {
        const deficit = deficits.get(line) ?? 1
        const dc = dropCreditOf(line, deficit, dropCaps)
        if (dc.status === 'declared') {
          dropped.push({ path: p, side: sideName, line, copies: dc.credit, via: '逐字' })
          continue
        }
        /**
         * 合流点(2026-11-06,两侧在**同一段代码**上的互斥实现,必须当场裁决):
         * 远端形态在这里把折叠举证的结果命名为 `credit`,它把外层本地侧的**调用方认账集**
         * (`creditedDrops` ⇒ `credit`)整个遮蔽掉了 —— 直接取远端形态,本地那一路在函数体内
         * 结构上取不到输入,等于把 `c587dd5023` 的能力删掉;直接取本地形态(在清单上 `.filter`)
         * 则把折叠/摘除/处置权三维删掉。裁决 = **保留判据更多的一版**(远端的三维全在),
         * 只把这里的局部标识符改名 `foldCred`(纯标识符,判据一字未动),让两路同时可达。
         */
        const foldCred = foldCreditOf(line, deficit, pairOf, mergedMap)
        if (foldCred.status === 'attested') {
          if (foldCred.credit >= deficit) {
            folded.push({ path: p, side: sideName, dropped: line, copies: deficit, kept: foldCred.kept })
            continue
          }
          // 台账只解释了其中一部分 ⇒ 剩下的是真少带,照旧判红(额度封顶在台账申报的份数)。
          // 调用方认账集**不压这一格**:它是行级的、不带份数维度,用它去消数量缺口就是
          // "三路并成或条件后统一放宽"(头注「双向分叉合流登记」)。
          out.push(line)
          continue
        }
        if (foldCred.status === 'undetermined') {
          undetermined.push(
            `${p} 活文档少带行的折叠去向未判定(不当成"没丢",不记通过):${foldCred.reason}:${line.slice(0, 60)}`,
          )
          // 未判定不是放行许可证(§0.3):即使调用方认账集里有这一行,也不把注记洗掉
          // (注记本来就不进缺行清单,少掉它只会让 ok 变绿 ⇒ 方向反了)。
          continue
        }
        /**
         * 剩下两档:`lost`(产物面上的**积极反证**——去向行不在场 / 与被折行不是同一件事 /
         * 独有注记或票号没接住)与 `none`(两本台账对这一行根本没开过口)。
         * 本地侧调用方认账集只在 `none` 这一格被采纳(它自己的前置:该行逐字在 `verifyUnion`
         * 同一轮端出的 `p.folded[].dropped ∪ p.dropLedgerCredited[].dropped` 里)。
         * `lost` 不许被认账集撤回 —— 反证比"调用方说它折过"更有资格定这条行。
         */
        if (foldCred.status === 'none' && credit.has(line)) {
          dropped.push({
            path: p,
            side: sideName,
            line,
            copies: deficit,
            via: '调用方认账集(creditedDrops)',
          })
          continue
        }
        out.push(line)
      }
      return out
    }
    const creditedOurs = sideMissing(missingOurs, o, '本侧')
    const creditedTheirs = sideMissing(missingTheirsOwed, t, '对侧')
    /**
     * 摘除台账「改写形态」那一族(G-34/G-43,2026-11-06 补):union 侧按**族**(题面指纹/复合主键/
     * 题面 32 字指纹)判「本侧处置权已行使 ⇒ 不补回」;本层此前只认**逐字**那一族 ⇒ 两把尺子
     * 不同形 ⇒ union 扣掉的行本层读成"少带内容"⇒ 合并恒拒(实测形态:行级 union 判对侧缺失 4,
     * 折叠与逐字两本账都答不上 ⇒ 恒红;那 4 行是同族不同字面的千段租约/让号行)。
     * 治法与折叠那一格同形(§0.6 单一真相源):**复用同一把尺**(`declaredFamilyCaps`),
     * 本层不复算"什么叫同一族"、也不另写一份族索引。
     *
     * 提问面与 union 侧同面:本侧文本 = ours(union 的「本侧」恒为 ours),候选 = 本层判剩下的缺行
     * ⇒ 本侧还持有的行不在候选内(它是被别的机制带走的,不该由台账销账顶罪;否则一次销账遮两笔)。
     * 让路桶(照旧补回却仍缺)= 真少带 ⇒ 照旧判红;未判定桶 ⇒ 记「未判定」不当成"没丢"(§0.3)。
     */
    let finalOurs = creditedOurs
    let finalTheirs = creditedTheirs
    const pending = new Map()
    for (const l of creditedOurs) pending.set(l, deficitsOf(o).get(l) ?? 1)
    for (const l of creditedTheirs) pending.set(l, deficitsOf(t).get(l) ?? 1)
    if (pending.size && ledgerObj !== null) {
      const fam = declaredFamilyCaps(o, pending, ledgerObj)
      const applyFam = (list, sideName, deficits) => {
        const rest = []
        for (const l of list) {
          if (fam.withheld.has(l)) {
            const ev = fam.evidence.get(l)
            dropped.push({
              path: p,
              side: sideName,
              line: l,
              copies: deficits.get(l) ?? 1,
              via: `族:${fam.withheld.get(l)}`,
              ledgerRows: (ev?.ledgerRows ?? []).map((x) => String(x).slice(0, 120)),
            })
            continue
          }
          if (fam.undetermined.has(l)) {
            undetermined.push(
              `${p} 活文档少带行的摘除去向未判定(不当成"没丢",不记通过):${fam.undetermined.get(l)}:${l.slice(0, 60)}`,
            )
            continue
          }
          rest.push(l)
        }
        return rest
      }
      finalOurs = applyFam(creditedOurs, '本侧', deficitsOf(o))
      finalTheirs = applyFam(creditedTheirs, '对侧', deficitsOf(t))
    }
    if (finalOurs.length || finalTheirs.length)
      violations.push({ path: p, kind: 'lines', missingOurs: finalOurs, missingTheirs: finalTheirs })
  }
  return {
    ok: violations.length === 0 && undetermined.length === 0,
    checked: scoped,
    violations,
    undetermined,
    folded,
    dropped,
  }
}

/** 人类档点名(CLI 与 union-converge --apply 共用同一份措辞)。 */
export function formatLossReport(result, { max = __MAX_LISTED } = {}) {
  const lines = []
  for (const u of result.undetermined) lines.push(`  ⚠️ 未判定:${u}`)
  for (const v of result.violations) {
    if (v.error) {
      lines.push(`  · ${v.path} —— ${v.error}`)
      continue
    }
    for (const [side, list] of [
      ['本侧', v.missingOurs],
      ['对侧', v.missingTheirs],
    ]) {
      if (!list.length) continue
      const shown = list.slice(0, max)
      lines.push(
        `  · ${v.path} —— ${side}缺失${v.kind === 'keys' ? '键' : '行'} ${list.length}:${shown.join(' | ')}` +
          (list.length > max ? ` …另有 ${list.length - max} 个` : ''),
      )
    }
  }
  // 折叠销账必须报名(与 `formatFoldReport` 同一条留痕纪律):少带的份数不许静默折进"0 丢失"。
  const folded = result.folded ?? []
  if (folded.length) {
    const copies = folded.reduce((s, e) => s + (e.copies || 0), 0)
    lines.push(`  · 折叠销账(合法少带,已过 attestFoldPair 四问):${folded.length} 行 / ${copies} 份`)
    for (const e of folded.slice(0, max))
      lines.push(
        `      · ${e.path} ${e.side}少带 ${e.copies} 份 → 去向 ${String(e.kept ?? '').slice(0, 60)} ← ${String(e.dropped).slice(0, 60)}`,
      )
    if (folded.length > max) lines.push(`      · …另有 ${folded.length - max} 行`)
  }
  // 摘除销账同样必须报名(同一条留痕纪律):凭本机摘除台账正当少带的行,逐条点名,不静默。
  const dropped = result.dropped ?? []
  if (dropped.length) {
    const copies = dropped.reduce((s, e) => s + (e.copies || 0), 0)
    lines.push(
      `  · 摘除/处置权销账(合法少带,凭据 = 本机摘除台账:逐字族 declaredDropCaps(逐字命中 ∧ 产物面已无此行 ∧ 是登记行形)` +
        ` + 改写形态族 declaredFamilyCaps(题面指纹/复合主键/题面 32 字指纹任一命中)` +
        ` + 本侧处置权族(基底有、本侧已删 ⇒ 归并不补回)` +
        ` + 调用方认账集(creditedDrops:verifyUnion 同一轮已按同源判据在产物面举过证的少带行)):${dropped.length} 行 / ${copies} 份`,
    )
    for (const e of dropped.slice(0, max)) {
      const via = e.via ? ` [${e.via}]` : ''
      const row = Array.isArray(e.ledgerRows) && e.ledgerRows.length ? ` 凭据:${String(e.ledgerRows[0]).slice(0, 80)}` : ''
      lines.push(`      · ${e.path} ${e.side}少带 ${e.copies} 份 ←${via} ${String(e.line).slice(0, 60)}${row}`)
    }
    if (dropped.length > max) lines.push(`      · …另有 ${dropped.length - max} 行`)
  }
  return lines.join('\n')
}

export const __test__ = { readRev, diffNames, jsonKeySet, textKeySet, lineMultiset, stripGeneratedBlocks, missingLines, missingKeys, judgeContentLoss, formatLossReport }
// 折叠台账这一格新增的三个出口**单列一行**:既有那行是判据面的公共面(多方各自往里追加过出口),
// 并到同一行就得两处各写一份写法 ⇒ 漂移(§0.6)。这三个函数本身也是具名导出,测试直呼具名即可。
export const __test__fold = { missingLineCounts, foldPairsOf, foldCreditOf }
// 摘除台账这一格(2026-11-06)另起一行,同样是为了不与既有那行并排(§0.6)。
export const __test__drop = { dropCreditOf }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
