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
 * 结论行:`EXTRACT-RESULT state=ready|changed|refused|undetermined changed=N extractable=N bucketsDrift=M adopted=K`
 * 退出码:0 = 无待搬 / 1 = 有待搬且本档只报数 / 2 = 未判定或被拒。
 *
 * 孤儿键归并(2026-10-26 立,票面"新旧标识符双向差 ∧ ANC 标题锚点"):改号器只换台账行号、
 * 不搬侧车键;抽取器又按新号补写 —— 同一件事两把键,旧号键从此成孤儿(门 234 现读 orphan=97
 * 的主因)。本器是"认领"的唯一判据与唯一迁移出口(`--apply` 同批落地),两支:
 *  · **搬**(目标键空):孤儿记录 re-key 到新号键。受同一道守恒闸(目标行归属桶零变化),
 *    已禁形态(**整族**:waiting-human 待拍板 / waiting-env 等条件 / blocking 拍板残留)一律不搬
 *    —— 把禁令形态搬到新键 = 扩散禁令,凭空造出一枚真 F11/F12 活票(判据单源 `rotReasonsOf`)。
 *  · **退场**(目标键已被抽取器按新号补写):旧记录的非空语义字段必须被新记录**逐字覆盖**
 *    (删旧键不丢任何信息)才许退;否则点名交 `--reclassify`,绝不替人裁。
 *  · 标题锚点命中多行(同题不同号同时在册)⇒ 归属歧义,一条都不动(失效方向恒为"少搬")。
 * 判据出口 `adoptMovesOf` 同时供门 234(`check-plan-fields.mjs`)归并维 import,不写第二把匹配。
 *
 * 孤儿键退场档(2026-10-27 立,票面「侧车孤儿键没有合法退场档」):归并档的两支都要求**台账面上
 * 还有一个同题面的活行**当认领目标(搬=目标键空、退场=目标键已被新号补写且逐字覆盖),所以
 * "题面在台账已彻底消失"的那一族旧号键**结构性没有出口** —— 手工删 jsonl 行不算通道(§1 侧车只增
 * 不删,要删必须走器物并留痕),`--apply` 也不是纯退场档(同批还会追加抽取记录,把"退"和"写"混在
 * 一档 ⇒ 谁退了什么查不清)。本档 `--retire-orphans` 只做一件事:**只退不抽**,三条前置同时成立
 * 才退(判据全部 import 单源:复合主键 `compositeKeyOf`/`fieldsFor` + 归并档 `adoptMovesOf` 的在册集):
 *  ① 台账面已无任何对应登记行 —— 键逐字不在被审面行键集 ∧ **题面指纹也不在任何行(含已勾)** ∧ 不在
 *     归并档在册/点名集(搬、退场、不可归并三支都归归并档管,本档绝不重复处置);
 *  ② 键形态合法 —— 号段非空 ∧ `#` 后题面 ≥4 字(与 `compositeKeyOf` 同档),`T:` 兜底键不合法;
 *  ③ 该键**最近一次** `updatedBy` 不是本器的自写面(见 `SELF_WRITER_STAMPS`)。
 * 任一不成立 ⇒ 该键**一条都不退**并逐条点名原因;失效方向恒为"多留一条并点名",绝不是"多删一条"。
 *
 * 两条前置衍生出的死锁与唯一出口(`--retire-intent`,2026-10-27 补):③ 让"本器自己写过的记录"终身
 * 不退,① 里"题面出现在别的行正文里"那一族同理 —— 两族都**没有值可改**,而 `--reclassify` 是按
 * `sigOf`(语义字段签名)判"改没改"的:下一版与现版签名相同就 `continue` 跳过,`updatedBy` 因此
 * 永远换不成人给的交代 ⇒ 改判通道造不出那次改写,这两族结构上被钉死。故新增声明档
 * `--retire-intent <json>`:逐条声明 `key` + `why`(≥10 字,与 `--reclassify` 同一把尺子)+
 * `declaredAt`,题面族还要 `hitRefs` 把**每一枚**命中行点名(见 `validateRetireIntents`)。
 * 声明不会绕过任何别的判据:它只在这两族上放行,其余前置照旧逐条判。
 * 零丢失:退场前把被退物理行**逐字**写进既有那本账 `.ihui-agent/state/plan-row-drop.jsonl`
 * (同型条目,`kind=sidecar-orphan-retire`,不新建第二本账格式)—— 取不到那本账 ⇒ 整批不退并 exit 2。
 * **留痕排在摘行之前**:AGENTS §1 那条"留痕必须排在落地成功之后"的立因是"先写后落会把面上还在的
 * 行说成已删 ⇒ 复洁器误剔丢别人的行",而 `scrub-declared-removals.declaredRows` 只认
 * `/^\s*- \[[ xX]\]/` 形态的 `rowBefore`(本档写的是 jsonl 记录行,结构上进不了那个射程,害不到人);
 * 反过来先摘后写一旦崩在两步之间,记录就**逐字不可恢复**了。所以这一族的序只能是留痕 ⇒ 摘行 ⇒ 回读。
 * 默认 dry-run 只报数,`--apply` 才写盘;写盘走临时件 + rename,回读再断言
 * 「退场行数 + 剩余行数 == 退场前总行数」,不成立 ⇒ `state=refused` 并 exit 2。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { auditFace, readFieldsFace, readPlan } from './plan-tasks.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { FIELDS_REL, fieldsFor, normalizeRecord } from './lib/plan-fields.mjs'
import { DROP_LEDGER_REL, ledgerRowSet } from './lib/plan-drop-record.mjs'
import { parseHeader, resolveSidecar, stripHeader } from './lib/plan-field-line.mjs'
import {
  bucketFromFields,
  compositeKeyOf,
  dispositionFace,
  dispositionOf,
  dispositionOfV2,
  ownedElsewhereRe,
  parseTaskRows,
  sidecarHeaderParts,
  waitingEnvRe,
  waitingEnvSlotRe,
} from './lib/plan-task-index.mjs'
// 违禁桶族的唯一读数出口(门 234 的侧车已禁形态判据:waiting-human / waiting-env / blocking 拍板残留)。
// 与 `check-plan-fields` 互为 import 是**刻意**的:归并档与判据必须读同一把尺子(§0.6),
// 而不是各自保有一份桶名清单;两支都是函数声明,ESM 循环在实例化期即完成绑定,无运行期缺口。
import { rotReasonsOf } from './check-plan-fields.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** 只取归属声明后面的**值**;词表(整族判据)在 `plan-task-index`,这里不复制。
 *  认 `归属:` / `归属会话=` 与 `持有者:` 三种本仓真实写法(2026-10-26 收窄:去掉裸 `归[:：]`)。
 *  立因(实测 G-76):正文里的**历史注记/副本并入**自带 `〔归:机主处置隧道｜等:—〕` 这样的嵌入标头,
 *  旧词表把这一处也当成本行归属 ⇒ 侧车 owner 被写成注记里的旧读数,而本行行首投影说"等机主核隧道"。
 *  行首标头另有 `sidecarHeaderParts` 取值通道(投影是合法证据,注记不是),两条互不串门。 */
const OWNER_VALUE_RE = /(?:归属[:：]|归属会话\s*[=＝]|持有[者人][:：])\s*([^,，。;；\n〕｜]{1,120})/
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
  // 孤立右括号 = 括号噪声,不是持有人本字(2026-10-26 实测 G-941 `（可判;归属:ai-service 成本账本)`:
  // 同句全角 `（` 开、半角 `)` 收,字符类只挡全角)。带反引号的值不在此列 —— 本仓真实标头就是
  // `` 〔归:`path` 持有人)〕 `` 这种写法(镜像测试 REAL_POSITIVE 钉住),不能一刀切。
  // 2026-10-26(G-965 末批):括号是**包裹句的收尾**,不是持有人本字 ⇒ 剥掉一个未配对的收尾
  // `)`/`）`(紧接一个收尾冒号时,冒号属同段噪声)后,余值仍走下面**全部**既有约束;
  // 余值不成立才判 null(纯括号噪声剥完为空/占位,仍拒)。`cut` 已在第一个开括号处切开,
  // 故其中不可能有开括号 —— 尾括号天然未配对,只需剥这一个。
  let value = cut
  if (!cut.includes('`')) {
    const tail = /[)）][:：]?$/.exec(cut)
    if (tail) value = cut.slice(0, -tail[0].length).trimEnd()
  }
  if (value.length < 2) return null
  if (OWNER_PLACEHOLDER_RE.test(value)) return null
  if (OWNER_LEAD_PARTICLE_RE.test(value)) return null
  if (OWNER_TAIL_PARTICLE_RE.test(value)) return null
  // 超长一律**不造**(2026-10-26 立,治 G-63 那型):以前切到 48 字,切点常落在反引号/句子中段,
  // 产出 `\`scripts/lib/pre-commit-hook.js\` 与 \`scripts/safe` 这种**不能充当归属**的畸形值;
  // 同键再被另一条完整值补上就是投影互斥(门 234 conflict)。失效方向选"少搬一带",
  // 改值通道仍是 `--reclassify`(逐条带 why),不是抽取器顺手截。
  if (value.length > MAX_OWNER) return null
  return value
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
    // 散文一处都没抽到时,唯一合法退路是**行首标头**(标头-only 的投影行;注记里的嵌入标头不算)。
    if (!m) {
      const ho = cleanOwner(headerOwner)
      if (ho === null) return null
      rec.owner = ho
      // 归属分支的 waiting 恒 none(词表同序:owner 优先于等待),等段不参与,见下面公共段的条件。
      return rec
    }
    // 同一起点改在原行上取第二遍:face 与 line 等长(反引号遮成等长空白),这样带反引号的路径名
    // 不会被 `\s*` 吃掉;而"命中只在反引号里"仍由上面那次 face 判定挡住。
    const tail = OWNER_VALUE_RE.exec(src.slice(m.index))
    if (!tail) return null
    // 散文值被拒(超长/占位/虚词)时**退回行首标头**的 owner —— 投影是合法证据,注记不是。
    // 2026-10-26:退路只认行首那一段(sidecarHeaderParts),正文里嵌入的 `〔归:…〕` 一律不认。
    const owner = cleanOwner(tail[1]) ?? cleanOwner(headerOwner)
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

/**
 * **同批同键投影互斥**的键集(唯一实现,写入口与规划面共用;§0.6)。
 *
 * 侧车是"只增不删"的追加面,同键多条天然会发生;真正的问题是**投影读数互斥**时"取哪一条"
 * 由 `loadFields` 按 `updatedAt` 隐式裁决 —— 那是写入时刻,不是归属权威(门 234 的 conflict/A3
 * 就长这样)。抽取器的职责是"搬",不是"改判":同一批候选里同键出现两个不同读数,
 * 说明抽取面自己就歧义(典型:同一行被抽成两个 owner),此时**一条都不写**并点名,交 `--reclassify`
 * 逐条裁决(带 why)。读数比较复用 `resolveSidecar`(与门同一把尺,不在这里另写"什么算不同")。
 */
export function collisionKeysOf(recs) {
  const byKey = new Map()
  for (const raw of recs ?? []) {
    const n = normalizeRecord(raw)
    if (!n.ok) continue
    if (!byKey.has(n.rec.key)) byKey.set(n.rec.key, [])
    byKey.get(n.rec.key).push(n.rec)
  }
  return [...byKey].filter(([, list]) => resolveSidecar(list).conflict).map(([k]) => k)
}

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
  // 同批同键读数互斥 ⇒ 这些键**一条都不写**(写哪条都是替人裁决),与规划面共用一把尺。
  const collisions = collisionKeysOf(recs)
  const collisionSet = new Set(collisions)
  for (const raw of recs) {
    const n = normalizeRecord(raw)
    if (!n.ok) {
      rejected++
      continue
    }
    if (collisionSet.has(n.rec.key)) {
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
  if (toAppend.length === 0) return { appended: 0, dupSkipped, rejected, collisions, path: abs }
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
  return { appended: toAppend.length, dupSkipped, rejected, collisions, path: abs }
}

/** 回读记录条数(物理行数,不是去重后的键数 —— 同键多份正是要能看见的形态)。 */
export function readBackCount(root) {
  return existingLines(root).length
}

/**
 * 落盘 `plan.pendingList` 这一批(2026-10-25 补):**同键就地改写胜出那条**、新键追加。
 *
 * 与 `writeRecords` 的分工是刻意分开的两件事:后者是初装期的"只增不删"(它连同键改值都追加,
 * 历史可对照);而 pendingList 里混着 `enrichRecord` 的**合并记录**(同键,只补了缺字段),
 * 若也按只增不删落盘,同键会长期两份,且 `--check` 每轮都把它再算成待搬 —— 实测 worktree 面
 * 3 条(G-593 / G-941 / G-115)把 check 钉在 changed,永远到不了 ready。
 * "胜出那条"的挑选口径与 `loadFields` 相同:updatedAt 最新,并列取先出现的。
 */
export function writePendingRecords(root, recs) {
  const abs = recordsFile(root)
  const before = existingLines(root)
  const winner = new Map()
  const parsedLine = []
  for (const [i, l] of before.entries()) {
    let rec = null
    try {
      const n = normalizeRecord(JSON.parse(l))
      if (n.ok) rec = n.rec
    } catch {
      // 畸形行不替它做决定:原样留着,由门报数
    }
    parsedLine.push(rec)
    if (!rec) continue
    const cur = winner.get(rec.key)
    if (cur === undefined) winner.set(rec.key, i)
    else if (Date.parse(rec.updatedAt) > Date.parse(parsedLine[cur].updatedAt)) winner.set(rec.key, i)
  }
  const out = [...before]
  let rewrote = 0
  let appended = 0
  let rejected = 0
  // 同批同键读数互斥 ⇒ 一条都不写(与 `writeRecords` 同一把尺;这两处各写一份必然漂)。
  const collisions = collisionKeysOf(recs)
  const collisionSet = new Set(collisions)
  for (const raw of recs) {
    const n = normalizeRecord(raw)
    if (!n.ok) {
      rejected++
      continue
    }
    if (collisionSet.has(n.rec.key)) {
      rejected++
      continue
    }
    const i = winner.get(n.rec.key)
    if (i === undefined) {
      appended++
      out.push(JSON.stringify(n.rec))
      parsedLine.push(n.rec)
      winner.set(n.rec.key, out.length - 1)
    } else {
      out[i] = JSON.stringify(n.rec)
      parsedLine[i] = n.rec
      rewrote++
    }
  }
  if (rewrote + appended === 0) return { rewritten: 0, appended, rejected, collisions, path: abs }
  mkdirSync(path.dirname(abs), { recursive: true })
  const tmp = `${abs}.tmp-${process.pid}`
  writeFileSync(tmp, out.join('\n') + '\n', 'utf8')
  try {
    renameSync(tmp, abs)
  } catch (e) {
    throw new Error(
      `侧车写盘失败(${String(e?.code ?? e)}),目标文件保持原样:${abs} —— 临时件留在 ${path.basename(tmp)}`,
    )
  }
  return { rewritten: rewrote, appended, rejected, collisions, path: abs }
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
  return { candidates, extractable: candidates.length, pending: pendingList.length, pendingList, collisions: collisionKeysOf(pendingList) }
}

/**
 * 孤儿键归并的唯一判据(2026-10-26 立,门 234 归并维同 import 这一份,§0.6)。
 *
 *  · 孤儿 = 侧车里有 ∧ 当前台账任何行(含已勾)的复合键都对不上;认领目标 = **未勾在册行**
 *    (`state==='open'`,已勾行不充当认领目标),其复合键与孤儿键**标题锚点(`#` 后段)逐字相等
 *    ∧ 号段不同** —— 键本身仍单源 `compositeKeyOf`,这里只按 `#` 分段,不写第二把键解析。
 *  · 目标键已有记录 ⇒ **退场**支:旧记录的非空语义字段被新记录逐字覆盖(删旧键零信息丢失)才许退;
 *    否则点名交 `--reclassify`,绝不替人裁。
 *  · 目标键空 ⇒ **搬**支:re-key 到新号键;已禁形态整族(`rotReasonsOf` 非空 ⇒ waiting-human /
 *    waiting-env / blocking 拍板残留)不搬,搬动前过同一道守恒闸(目标行归属桶零变化,`batchBucketDrift`)。
 *    拒搬不改数据:留在 `skipped` 并点名原因,改判唯一出口 = `--reclassify`(这一支无权裁决归属语义)。
 *  · 标题锚点命中多行 ⇒ 归属歧义,一条都不动;台账已无同锚点行(完成即删)⇒ 真孤儿,保持只报数。
 * 纯函数(除 `nowIso` 打戳)。`rows` 需要 `{state, raw}` 形(`parseTaskRows` 的产物)。
 */
export function adoptMovesOf(records, rows, sideMap, nowIso = new Date().toISOString()) {
  const openByTitle = new Map()
  const rowKeySet = new Set()
  for (const r of rows ?? []) {
    const k = compositeKeyOf(r?.raw ?? '')
    if (!k) continue
    rowKeySet.add(k)
    if (r.state !== 'open') continue
    const i = k.indexOf('#')
    if (i <= 0) continue
    const t = k.slice(i + 1)
    if (!t) continue
    if (!openByTitle.has(t)) openByTitle.set(t, [])
    openByTitle.get(t).push({ key: k, row: r })
  }
  // 语义覆盖:旧记录每个非空语义字段都逐字等于新记录的对应字段 ⇒ 删旧键不丢任何信息。
  const covered = (oldRec, newRec) =>
    ['owner', 'waiting', 'blocking', 'next'].every((k) => {
      const ov = String(oldRec?.[k] ?? '')
      return ov === '' || ov === String(newRec?.[k] ?? '')
    })
  const moves = []
  const retires = []
  const skipped = []
  const seen = new Set()
  const takenTargets = new Set()
  for (const rec of records ?? []) {
    const fromKey = String(rec?.key ?? '')
    const i = fromKey.indexOf('#')
    if (i <= 0) continue // 无号段(T:rowhash 兜底键)不参与:它本来就不充当归属权威
    if (rowKeySet.has(fromKey) || seen.has(fromKey)) continue
    seen.add(fromKey)
    const title = fromKey.slice(i + 1)
    const same = openByTitle.get(title) ?? []
    const uniqKeys = [...new Set(same.map((c) => c.key))]
    if (uniqKeys.length === 0) continue // 台账已无同锚点行(完成即删)⇒ 真孤儿,保持只报数
    if (uniqKeys.length > 1) {
      skipped.push({ key: fromKey, why: `标题锚点命中 ${uniqKeys.length} 行在册(${uniqKeys.join(' / ')}),归属歧义 ⇒ 一条都不动` })
      continue
    }
    const target = same[0]
    const toKey = target.key
    const existing = (sideMap ?? new Map()).get(toKey) ?? null
    if (existing) {
      if (covered(rec, existing)) retires.push({ fromKey, toKey })
      else
        skipped.push({
          key: fromKey,
          why: `新号键 ${toKey} 已有记录且未逐字覆盖旧记录语义(旧 owner=${String(rec?.owner ?? '')} waiting=${String(rec?.waiting ?? '')} blocking=${String(rec?.blocking ?? '')}) ⇒ 交 --reclassify 裁`,
        })
      continue
    }
    if (takenTargets.has(toKey)) {
      skipped.push({ key: fromKey, why: `同锚点已有一条搬往 ${toKey},多条只搬一条 ⇒ 其余交人工` })
      continue
    }
    // 已禁形态**整族**不搬(2026-10-27 补洞):这一支只做"搬 + 退场",无权裁决归属语义;
    // 把违禁值搬到活键上 = 归并自己凭空造出一枚真 F11/F12 活票(台账面上本来干净的行,一次 --apply
    // 就带上 waiting=env —— 洞在生产者一侧,不在判据一侧)。原实现只拒 waiting-human 与 blocking
    // 拍板残留,**漏了 waiting-env(F12 等条件桶)**。判据单源 import 门 234 的 `rotReasonsOf`
    // (§0.6:与机主两条例令同一把尺子,本器不写第二份桶名/词表);失效方向 = 留在 `skipped` 并
    // 点名原因(沿用既有 moves/retires/skipped 三态),绝不是顺手把违禁值改掉。
    const banned = rotReasonsOf(rec)
    if (banned.length > 0) {
      skipped.push({ key: fromKey, why: `已禁形态(${banned.join(' ∧ ')})⇒ 先 --reclassify 改判再搬` })
      continue
    }
    // 守恒闸:搬到新号键后,目标行的归属桶必须零变化(与抽取候选同一道闸,不绕开)。
    const moved = { ...rec, key: toKey, updatedAt: nowIso, updatedBy: 'plan-fields-extract-adopt' }
    const afterMap = new Map(sideMap ?? new Map())
    afterMap.delete(fromKey)
    afterMap.set(toKey, moved)
    const drift = batchBucketDrift([target.row.raw], afterMap, sideMap ?? new Map())
    if (drift.length > 0) {
      skipped.push({ key: fromKey, why: `守恒闸:搬到 ${toKey} 后目标行归属桶漂移(${drift[0]})` })
      continue
    }
    takenTargets.add(toKey)
    moves.push({ fromKey, toKey, rec: moved })
  }
  return { moves, retires, skipped }
}

/**
 * 孤儿键归并落盘(搬 + 退场一条出口):摘掉 fromKey 的全部物理行,搬支把 re-key 记录追加。
 * 临时件 + rename,失败目标文件一字节不动;写前重验目标键仍为空(防与抽取写盘竞态造第二读数,
 * 竞态条目进 `raced` 点名而不是硬写)。退场支无需追加 —— 摘行即退场。
 */
export function applyAdoptMoves(root, moves = [], retires = []) {
  const abs = recordsFile(root)
  const before = existingLines(root)
  const fromKeys = new Set([...moves.map((m) => m.fromKey), ...retires.map((m) => m.fromKey)])
  const kept = []
  const stillThere = new Set()
  let removed = 0
  for (const l of before) {
    let k = null
    try {
      const n = normalizeRecord(JSON.parse(l))
      if (n.ok) k = n.rec.key
    } catch {
      // 畸形行原样保留,由门报数(§0.3:不替看不懂的行做决定)
    }
    if (k !== null && fromKeys.has(k)) {
      removed++
      continue
    }
    kept.push(l)
    if (k !== null) stillThere.add(k)
  }
  const appended = []
  const raced = []
  let moved = 0
  for (const m of moves) {
    if (stillThere.has(m.toKey)) {
      raced.push(m.fromKey)
      continue
    }
    stillThere.add(m.toKey)
    appended.push(JSON.stringify(m.rec))
    moved++
  }
  if (moved === 0 && removed === 0) return { moved: 0, retired: 0, removed: 0, raced, path: abs }
  mkdirSync(path.dirname(abs), { recursive: true })
  const tmp = `${abs}.tmp-${process.pid}`
  writeFileSync(tmp, [...kept, ...appended].join('\n') + '\n', 'utf8')
  try {
    renameSync(tmp, abs)
  } catch (e) {
    throw new Error(
      `侧车归并写盘失败(${String(e?.code ?? e)}),目标文件保持原样:${abs} —— 临时件留在 ${path.basename(tmp)}`,
    )
  }
  return { moved, retired: retires.length, removed, raced, path: abs }
}

/**
 * ── 孤儿键退场档(2026-10-27 立,票面「侧车孤儿键没有合法退场档」)────────────────
 *
 * 归并档的两支都以"台账面上还有一个同题面的行"为前提(搬 = 目标键空、退场 = 目标键已被新号补写
 * 且逐字覆盖)。题面在台账**彻底消失**的那一族旧号键因此结构性没有出口:手工删 jsonl 行不算通道
 * (§1「侧车只增不删,要删必须走器物并留痕」),而 `--apply` 不是纯退场档(同批还会追加抽取记录,
 * 谁退了什么查不清)。本档只做一件事:**只退不抽**。
 *
 * 三条前置同时成立才退(任一不成立 ⇒ 该键一条都不退并点名;失效方向恒为"多留一条"):
 *  ① 台账面已无任何对应登记行 —— 复合主键逐字不在行键集(行键走单源 `fieldsFor`,与门 234 同一把尺)
 *     ∧ **题面指纹不在任何行(含已勾)** ∧ 不在归并档在册/点名集(`adoptMovesOf` 单源,绝不重复处置);
 *  ② 键形态合法 —— 号段非空 ∧ `#` 后题面 ≥4 字(与 `compositeKeyOf` 同档),`T:<sha1>` 兜底键不合法;
 *  ③ 该键**最近一次** `updatedBy` 不是本器的自写面 —— 见 `SELF_WRITER_STAMPS`。
 *
 * 为什么③ 的射程是"抽取/归并两条自动腿"而不含 `--reclassify`:主席 d1c4029f3e3 的 commit message
 * 自述"已按退场前置把 4 条旧键的 waiting 收到 none…目的:使 adoptMovesOf 的退场前置成立" ——
 * 声明式改判(逐条带 why)是本仓唯一的"定向说明"通道,它写的戳是**人给的交代**,不是本器自产的说辞。
 * 把它也算进"本器",等于把主席自己准备好的那批永久钉死 ⇒ 判据输入集依赖它要消的形态而自锁
 * (AGENTS §1「回潮实测到三条通道」②那一型)。拿不准的那一族(自动腿刚写的 67 枚)留在射程外,
 * 出路点名得很清楚:逐条 `--reclassify`(带 why)⇒ 下一轮进射程。
 */
const SELF_WRITER_STAMPS = new Set([UPDATED_BY, 'plan-fields-extract-adopt'])
export const RETIRE_SEAT = 'plan-fields-extract'
export const RETIRE_DROP_KIND = 'sidecar-orphan-retire'
/** 留痕条目的 `file` 面(正斜杠:git/对账侧只认 posix 分隔符,同 `plan-tasks.fieldsSpecRel`)。 */
const FIELDS_REL_POSIX = FIELDS_REL.split(path.sep).join('/')
const RETIRE_DROP_NOTE =
  '孤儿键退场档(plan-fields-extract --retire-orphans --apply):复合主键与题面指纹在被审面均已无对应登记行 ⇒ 侧车记录逐字退场;本行即回滚件(把它原样追加回侧车即恢复)'

/** 题面指纹归一:空白差异("DevEnv 搬入 G" vs "DevEnv搬入G")不构成"题面已消失"的凭据。
 *  失效方向恒为多留一条 —— 归一只会让更多键落 held,绝不放宽退场。 */
const titleKeyOf = (s) => String(s ?? '').replace(/\s+/g, '')

const faceIdentityOf = (rec) =>
  `${rec.key}|${sigOf(rec)}|${String(rec.updatedAt ?? '')}|${String(rec.updatedBy ?? '')}`

/**
 * 物理行 → `[{raw, rec, why}]`(纯函数,零 IO)。畸形行不丢:`rec=null` + 原因,
 * 由调用方逐条点名并**原样留在盘上**(§0.3 不替看不懂的行做决定)。
 */
export function parsePhysicalLines(lines = []) {
  const out = []
  for (const raw of lines ?? []) {
    let rec = null
    let why = ''
    try {
      const n = normalizeRecord(JSON.parse(raw))
      if (n.ok) rec = n.rec
      else why = n.why
    } catch (e) {
      why = `JSON 解析失败(${String(e?.message ?? e).split('\n')[0]})`
    }
    out.push({ raw: String(raw), rec, why })
  }
  return out
}

/** 声明 why 的最短长度:与 `applyReclassify` 同一把尺子(少于 10 字 = 没说明,等于替人猜)。 */
const MIN_DECLARED_WHY = 10
/** hitRefs 每条的最短长度:台账题面普遍 ≥20 字,再短的 ref 会同时覆盖到别的行。 */
const MIN_HIT_REF = 20

/**
 * 退场声明档的唯一判据(纯函数,零 IO;`--retire-intent` 档只做 I/O 与打印)。
 *
 * 为什么要有这一档:见文件头「两条前置衍生出的死锁」—— 自写面记录与"题面挂在别的行正文里"这两族
 * 没有可改的语义值,`--reclassify` 按 `sigOf` 相同即跳过,等于没有出口。声明档就是 AGENTS §0.10
 * 要的那"多一次定向说明":逐条 key + why(≥10 字,与 `applyReclassify` 同一把尺子)+ declaredAt。
 *
 * 两档失效方向刻意分开:
 *  · **整批拒**(`error`)只给"声明本身不成话"用(key 不在册 / 理由太短 / 时刻不可解析 / 可选字段
 *    类型错 / 同键重复声明)——它说明这份声明档不可信,半批应用等于挑着信;
 *  · **逐项跳过**(`skipped`)给"这一枚声明过期了"用(早于记录最后一次改写 / recordSig 对不上)——
 *    其余声明仍然有效,但被跳过的那枚绝不放行(陈旧声明不记通过)。
 *
 * `nowIso` 与 `applyReclassify` 同形(签名对位,调用方可注入时钟):本档判据只比"记录自带的
 * updatedAt"与"声明自带的 declaredAt"两枚时刻 —— 把"当下"放进判据会让同一份声明在两次运行里
 * 判出不同结论,而这正是"判据失效得安静"的形状。故第三个参数刻意不用,`_` 前缀即 lint 在册标记。
 */
export function validateRetireIntents(items, records, _nowIso = new Date().toISOString()) {
  const reject = (error) => ({ intents: new Map(), error, skipped: [] })
  if (!Array.isArray(items) || items.length === 0)
    return reject('声明档必须是非空数组 [{key, why, declaredAt, declaredBy?, recordSig?, hitRefs?}]')
  // 同键多份物理行:哪条算"当下记录"必须与 retirePlanOf 同序(严格更新才换、并列取先出现),
  // 否则两处读出的 updatedAt 可以不同 ⇒ 同一份声明在一边已陈旧、在另一边还新鲜。
  const latest = new Map()
  for (const rec of records ?? []) {
    const k = String(rec?.key ?? '')
    if (k === '') continue
    const cur = latest.get(k)
    if (!cur || Date.parse(String(rec.updatedAt ?? '')) > Date.parse(String(cur.updatedAt ?? '')))
      latest.set(k, rec)
  }
  const intents = new Map()
  const skipped = []
  const seen = new Set()
  for (const [i, it] of items.entries()) {
    const n = i + 1
    if (!it || typeof it !== 'object' || Array.isArray(it)) return reject(`第 ${n} 项不是对象`)
    if (typeof it.key !== 'string' || it.key === '')
      return reject(`第 ${n} 项缺 key 或 key 不是非空字符串`)
    if (seen.has(it.key)) return reject(`第 ${n} 项 key 重复声明(${it.key})—— 同一键只能有一份交代`)
    seen.add(it.key)
    if (typeof it.why !== 'string' || it.why.trim().length < MIN_DECLARED_WHY)
      return reject(`第 ${n} 项 why 少于 ${MIN_DECLARED_WHY} 字(不说明理由的退场等于替人猜)`)
    if (typeof it.declaredAt !== 'string' || Number.isNaN(Date.parse(it.declaredAt)))
      return reject(
        `第 ${n} 项 declaredAt 不可解析(判不出声明时刻就无法判它是否陈旧):${JSON.stringify(it.declaredAt)}`,
      )
    if (it.declaredBy !== undefined && typeof it.declaredBy !== 'string')
      return reject(`第 ${n} 项 declaredBy 必须是字符串,实际 ${JSON.stringify(it.declaredBy)}`)
    if (it.recordSig !== undefined && typeof it.recordSig !== 'string')
      return reject(`第 ${n} 项 recordSig 必须是字符串,实际 ${JSON.stringify(it.recordSig)}`)
    if (
      it.hitRefs !== undefined &&
      (!Array.isArray(it.hitRefs) ||
        it.hitRefs.some((r) => typeof r !== 'string' || r.trim().length < MIN_HIT_REF))
    )
      return reject(
        `第 ${n} 项 hitRefs 必须是字符串数组且每条 ≥${MIN_HIT_REF} 字(太短的 ref 覆盖不到具体行)`,
      )
    const rec = latest.get(it.key)
    if (!rec) return reject(`第 ${n} 项 key 不在侧车面(陈旧声明不记通过):${it.key}`)
    if (Date.parse(String(rec.updatedAt ?? '')) > Date.parse(it.declaredAt)) {
      skipped.push({
        key: it.key,
        why: `声明早于记录最后一次改写(updatedAt=${String(rec.updatedAt ?? '')}),陈旧声明不记通过`,
      })
      continue
    }
    if (it.recordSig !== undefined && it.recordSig !== sigOf(rec)) {
      skipped.push({ key: it.key, why: '声明里的 recordSig 与当下记录不符' })
      continue
    }
    intents.set(it.key, {
      key: it.key,
      why: it.why.trim(),
      declaredAt: it.declaredAt,
      declaredBy: typeof it.declaredBy === 'string' ? it.declaredBy : '',
      hitRefs: Array.isArray(it.hitRefs) ? [...it.hitRefs] : [],
    })
  }
  return { intents, error: null, skipped }
}

/**
 * 命中行覆盖判定:每条 ref 必须是**一条尚未被认领的命中行**原文前缀,且每一枚命中行都被某条 ref
 * 覆盖。按前缀而非子串:ref 要能唯一定位"就是这一行",子串会让一段公共措辞冒充行身份。
 * 多条 ref 必须各认领一行(重复 ref 认领不到第二行 ⇒ 不放行):多余 ref 说明声明面与台账面
 * 对不上,那是另一种"拿不准",按失效方向多留一条。
 */
function hitRefsCover(hits, refs) {
  const used = new Set()
  for (const ref of Array.isArray(refs) ? refs : []) {
    const i = hits.findIndex((h, idx) => !used.has(idx) && h.raw.startsWith(ref))
    if (i < 0) return false
    used.add(i)
  }
  return used.size === hits.length
}

/**
 * 退场判据(纯函数,零 IO、零 git):物理行条目 + 台账行 + 被审面侧车映射 ⇒ 可退/留下/畸形。
 * `faceIds` 缺省 null = 不做盘上↔面同形核验(单测直接构造条目时用);实跑档必传。
 * `retireIntents` = `validateRetireIntents` 准入的 Map(缺省 null = 没有声明档):它只对两族
 * "没有值可改"的记录放行,其余前置一条都不绕过。
 */
export function retirePlanOf(
  entries,
  rows,
  sideMap,
  { selfStamps = SELF_WRITER_STAMPS, faceIds = null, retireIntents = null } = {},
) {
  const adopt = adoptMovesOf(
    (entries ?? []).filter((e) => e?.rec).map((e) => e.rec),
    rows,
    sideMap,
  )
  const inAdopt = new Map()
  for (const m of adopt.moves)
    inAdopt.set(m.fromKey, `归并档在册(搬 → ${m.toKey})⇒ 归 --apply 的归并腿处置,本档不重复动手`)
  for (const m of adopt.retires)
    inAdopt.set(
      m.fromKey,
      `归并档在册(退场:新号键 ${m.toKey} 已有记录且语义逐字覆盖)⇒ 同上,本档不重复动手`,
    )
  const skipped = new Map(adopt.skipped.map((s) => [s.key, s.why]))

  const rowKeys = new Set()
  const rowNums = new Set()
  // 无编号行(编号位被租约/标头挤掉的)在 compositeKeyOf 处恒 null ⇒ 上面的键集看不见它们。
  // 孤儿判据因此还须有一道"题面是否原样出现在任何登记行正文里"的保守检查(空白归一后子串命中)。
  // 失效方向恒为多留:命中即不退,绝不拿它当"题面等价"去放宽别的分支。
  const compactRows = []
  const anchors = new Map()
  for (const r of rows ?? []) {
    const raw = String(r?.raw ?? '')
    if (raw === '') continue
    // 同时留原文与压缩形:命中判定按压缩形(空白差异不算另一行),而 hitRefs 要按**原文前缀**
    // 核对(声明里点名的是人看到的那一行,压缩形会吃掉排版,人写不出那样的 ref)。
    compactRows.push({ raw, compact: raw.replace(/\s+/g, '') })
    rowKeys.add(fieldsFor({ line: raw, map: null }).key)
    const k = compositeKeyOf(raw)
    if (!k) continue
    const i = k.indexOf('#')
    if (i <= 0) continue
    rowNums.add(k.slice(0, i).trim())
    const t = titleKeyOf(k.slice(i + 1))
    if (!t) continue
    if (!anchors.has(t)) anchors.set(t, [])
    anchors.get(t).push({ key: k, state: r.state })
  }

  // 同键多份 ⇒ "最近一次"按 loadFields 同序判(严格更新才换、并列取先出现的那条)。
  const byKey = new Map()
  const malformed = []
  for (const item of entries ?? []) {
    const rec = item?.rec ?? null
    if (!rec) {
      malformed.push({ raw: String(item?.raw ?? ''), why: item?.why ?? '记录解析不出' })
      continue
    }
    const key = String(rec.key ?? '')
    if (!byKey.has(key)) byKey.set(key, { latest: rec, lines: [item] })
    else {
      const g = byKey.get(key)
      g.lines.push(item)
      if (Date.parse(String(rec.updatedAt ?? '')) > Date.parse(String(g.latest.updatedAt ?? '')))
        g.latest = rec
    }
  }

  const retire = []
  const held = []
  for (const [key, g] of byKey) {
    const i = key.indexOf('#')
    const anchor = i > 0 ? key.slice(i + 1) : ''
    if (i <= 0 || key.slice(0, i).trim() === '' || anchor.trim().length < 4) {
      held.push({
        key,
        why: `键形态不合法(号段缺位或题面短于 4 字,实测题面长度 ${anchor.trim().length})⇒ 不退`,
        lines: g.lines,
      })
      continue
    }
    // `T:<sha1>` 兜底键 = 行本体逐字哈希:行一改写就换人,结构上不可能是"孤儿",只可能是
    // "换了行"。它不得充当归属权威(fieldsFor 的 keyKind='rowhash'),本档一条都不退。
    if (key.startsWith('T:')) {
      held.push({
        key,
        why: 'T:<sha1> 兜底键(行本体重写即换人)不得充当归属权威 ⇒ 不退,交 --reclassify 定向说明',
        lines: g.lines,
      })
      continue
    }
    if (inAdopt.has(key)) {
      held.push({ key, why: inAdopt.get(key), lines: g.lines })
      continue
    }
    if (skipped.has(key)) {
      held.push({ key, why: `归并档点名不可归并(${skipped.get(key)})⇒ 交 --reclassify`, lines: g.lines })
      continue
    }
    if (rowKeys.has(key)) {
      held.push({ key, why: '台账面仍有该复合主键的登记行 ⇒ 绝不退', lines: g.lines })
      continue
    }
    // 编号是强身份:同号行还在(哪怕题面已改写/带空格),题面漂移就**不是**孤儿凭据。
    // 2026-10-27 实测:41 条 dry-run 可退里有 12 条与活行只差一个空格(G-50 "DevEnv 搬入 G"
    // 对侧车 G-50#DevEnv搬入G)或同号不同题 ⇒ 只按逐字题面比会把这些活票的归属记录退掉。
    const numSegment = key.slice(0, i).trim()
    if (rowNums.has(numSegment)) {
      held.push({
        key,
        why: `台账面仍有同号行(${numSegment})—— 编号是强身份,题面漂移不足以判孤儿 ⇒ 不退`,
        lines: g.lines,
      })
      continue
    }
    const hits = anchors.get(titleKeyOf(anchor)) ?? []
    if (hits.length > 0) {
      held.push({
        key,
        why: `题面指纹仍在台账(命中 ${hits.map((h) => `${h.key}[${h.state}]`).join(' / ')})⇒ 拿不准不退`,
        lines: g.lines,
      })
      continue
    }
    const compactAnchor = titleKeyOf(anchor)
    // 声明档只在这两族上生效(见文件头「两条前置衍生出的死锁」):先取,后面的判据按需问它。
    const intent = retireIntents?.get(key) ?? null
    const hitRows = compactRows.filter((t) => t.compact.includes(compactAnchor))
    if (hitRows.length > 0 && !hitRefsCover(hitRows, intent?.hitRefs)) {
      held.push({
        key,
        why:
          '题面原样出现在某条登记行正文里(该行编号位可能被租约/标头挤掉 ⇒ 复合主键解析不出)⇒ 不退' +
          (intent
            ? `;hitRefs 未覆盖全部命中行(${hitRows.length} 条命中/${(intent.hitRefs ?? []).length} 条 ref)`
            : ';出路 = --retire-intent 声明档逐条点名命中行'),
        lines: g.lines,
      })
      continue
    }
    const by = String(g.latest?.updatedBy ?? '')
    if (selfStamps.has(by) && !intent) {
      held.push({
        key,
        why:
          `最近一次 updatedBy=${by}(本器自写面)⇒ 本轮不退;出路 = --reclassify 逐条带 why 声明后下一轮进射程` +
          ';记录没有可改值时 --reclassify 会跳过(sigOf 相同即跳过)⇒ 这一族的出口是 --retire-intent 声明档',
        lines: g.lines,
      })
      continue
    }
    if (faceIds) {
      const off = g.lines.filter((l) => !faceIds.has(faceIdentityOf(l.rec)))
      if (off.length > 0) {
        held.push({
          key,
          why: `盘上 ${off.length} 行在被审面读不到同形副本(侧车正被别席改写)⇒ 不退`,
          lines: g.lines,
        })
        continue
      }
    }
    retire.push({ key, updatedBy: by, lines: g.lines, ...(intent ? { intent } : {}) })
  }

  const total = (entries ?? []).length
  const retireLines = retire.reduce((n, r) => n + r.lines.length, 0)
  const keptLines = total - retireLines
  return {
    retire,
    held,
    malformed,
    rowsN: (rows ?? []).length,
    keysN: byKey.size,
    retireKeys: retire.length,
    retireLines,
    heldKeys: held.length,
    total,
    keptLines,
    // 「退场数 + 剩余数 == 退场前总数」(畸形行也在剩余数里,不进退场射程)
    conserved: retireLines + keptLines === total,
    adopt,
  }
}

/**
 * 退场落盘(唯一写出口):留痕 ⇒ 摘行 ⇒ 回读自证,三段任一不成立 ⇒ 侧车一字节不动或整批拒。
 *
 * 顺序与 §1「留痕必须排在落地成功之后」**刻意相反**,理由是可证的:那一条的立因是"先写后落会把
 * 面上还在的台账行说成已删 ⇒ `scrub-declared-removals` 误剔 ⇒ 丢别人的行",而 `declaredRows` 只收
 * `/^\s*- \[[ xX]\]/` 形态的 `rowBefore`(门 234 的 orphan/rot 与 union 的 declaredDropCaps 同一条筛),
 * 本档写的是 `plan-fields.jsonl` 的 JSON 记录行,结构上进不了那个射程 ⇒ 多说一句不害人;
 * 反过来先摘后写一旦崩在两步之间,记录就**逐字不可恢复**了(零丢失要求的是这一头)。
 *
 * @param {object} o io 注入点(镜像测试用):{read, append, mkdir, readSidecar, rename}
 */
export function applyRetireRecords(
  root = ROOT,
  plan = {},
  {
    ledgerRel = DROP_LEDGER_REL,
    nowIso = new Date().toISOString(),
    baseline = '',
    io = {},
  } = {},
) {
  const read = io.read ?? ((p) => readFileSync(p, 'utf8'))
  const append = io.append ?? ((p, s) => appendFileSync(p, s, 'utf8'))
  const mkdir = io.mkdir ?? ((p) => mkdirSync(p, { recursive: true }))
  const retire = plan.retire ?? []
  const abs = recordsFile(root)
  const ledgerAbs = path.join(root, ledgerRel)
  if (retire.length === 0)
    return { state: 'clean', retired: 0, lines: 0, path: abs, ledger: ledgerRel, why: '本轮零条满足三条前置 ⇒ 一个字节都不动' }
  if (plan.conserved !== true)
    return { state: 'refused', retired: 0, lines: 0, path: abs, ledger: ledgerRel, why: `守恒断言不过(退场 ${plan.retireLines} + 剩余 ${plan.keptLines} ≠ 退场前 ${plan.total})⇒ 整批不落` }

  // ① 留痕件必须**取到**才动数据:读不到(含文件不在)⇒ 未判定,零写盘(§0.3 不猜"它大概是空的")。
  let ledgerText
  try {
    ledgerText = read(ledgerAbs)
  } catch (e) {
    return {
      state: 'undetermined',
      retired: 0,
      lines: 0,
      path: abs,
      ledger: ledgerRel,
      why: `留痕件取不到(${ledgerRel},实测码 ${String(e?.code ?? e)}):${String(e?.message ?? e).split('\n')[0]} ⇒ 整批不退,侧车一字节不动`,
    }
  }
  const have = ledgerRowSet(ledgerText)
  if (!have.ok)
    return { state: 'undetermined', retired: 0, lines: 0, path: abs, ledger: ledgerRel, why: `留痕件不成文本(${have.why})⇒ 整批不退` }

  // 幂等:逐字已在账 ⇒ 不重复追加(同一枚死键被别席带回后再退一次,账面仍只有一条凭据)。
  const entries = []
  const seen = new Set()
  let already = 0
  for (const r of retire)
    for (const l of r.lines) {
      const raw = String(l.raw ?? '')
      if (have.set.has(raw) || seen.has(raw)) {
        already++
        continue
      }
      seen.add(raw)
      const entry = {
        at: nowIso,
        seat: RETIRE_SEAT,
        file: FIELDS_REL_POSIX,
        kind: RETIRE_DROP_KIND,
        rowBefore: raw,
        note: RETIRE_DROP_NOTE,
      }
      if (baseline) entry.baseline = baseline
      // 声明档退场必须可追责:凭据就是"谁在什么时刻凭什么退的"。没有 intent 时**一个键都不加**
      // (旧账逐字节不变) —— 同一本账里混两种形状,复对时分不清"没声明"与"声明丢了"。
      if (r.intent) {
        entry.declaredWhy = r.intent.why
        entry.declaredAt = r.intent.declaredAt
        entry.declaredBy = r.intent.declaredBy ?? ''
      }
      entries.push(entry)
    }

  // 摘行前重取当前盘面(取材与落盘之间可能被别席改过 ⇒ 以"此刻的面"为准逐字比对)。
  const target = new Set()
  for (const r of retire) for (const l of r.lines) target.add(String(l.raw ?? ''))
  const before = existingLines(root)
  const kept = before.filter((l) => !target.has(l))
  const removed = before.length - kept.length
  if (removed !== target.size)
    return {
      state: 'refused',
      retired: 0,
      lines: 0,
      path: abs,
      ledger: ledgerRel,
      why: `落盘前重取盘面:待退的 ${target.size} 行里只有 ${removed} 行仍在位(盘面已被别席改写)⇒ 整批不落`,
    }

  // ② 留痕先入账(写不进 ⇒ 未判定,尚未摘任何行)。
  if (entries.length > 0) {
    try {
      mkdir(path.dirname(ledgerAbs))
      append(ledgerAbs, entries.map((e) => JSON.stringify(e)).join('\n') + '\n')
    } catch (e) {
      return {
        state: 'undetermined',
        retired: 0,
        lines: 0,
        path: abs,
        ledger: ledgerRel,
        why: `留痕件写不进(${ledgerRel}):${String(e?.message ?? e).split('\n')[0]} ⇒ 整批不退,侧车一字节不动`,
      }
    }
  }

  // ③ 摘行(临时件 + rename;失败则目标文件保持原样,留痕只是多说了一句,不害人)。
  const tmp = `${abs}.tmp-${process.pid}`
  try {
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(tmp, kept.join('\n') + (kept.length ? '\n' : ''), 'utf8')
    renameSync(tmp, abs)
  } catch (e) {
    return {
      state: 'refused',
      retired: 0,
      lines: 0,
      path: abs,
      ledger: ledgerRel,
      ledgerWritten: entries.length,
      why: `侧车写盘失败(${String(e?.code ?? e)}):目标文件保持原样 —— 临时件留在 ${path.basename(tmp)};留痕已入账 ${entries.length} 条(它是凭据,不是判决)`,
    }
  }

  // ④ 回读自证:剩余行逐字 == 计划剩余 ∧ 被退行逐字已不在面 ∧「退场数 + 剩余数 == 退场前总数」。
  const after = existingLines(root)
  const drift = []
  if (after.length !== kept.length) drift.push(`回读行数 ${after.length} ≠ 计划剩余 ${kept.length}`)
  for (const [i, l] of after.entries()) if (l !== kept[i]) drift.push(`第 ${i + 1} 行内容不符`)
  const back = new Set(after)
  for (const raw of target) if (back.has(raw)) drift.push(`被退行仍在位:${raw.slice(0, 60)}`)
  if (removed + after.length !== before.length)
    drift.push(`守恒不过:退场 ${removed} + 剩余 ${after.length} ≠ 退场前 ${before.length}`)
  if (drift.length > 0)
    return {
      state: 'refused',
      retired: 0,
      lines: removed,
      path: abs,
      ledger: ledgerRel,
      ledgerWritten: entries.length,
      why: `回读自证不过(逐条):${drift.slice(0, 3).join(' / ')}${drift.length > 3 ? ` …另 ${drift.length - 3} 条` : ''}`,
    }
  return {
    state: 'stripped',
    retired: retire.length,
    lines: removed,
    before: before.length,
    after: after.length,
    ledgerWritten: entries.length,
    alreadyInLedger: already,
    path: abs,
    ledger: ledgerRel,
  }
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
  // 孤儿键归并(2026-10-26):判据单源 adoptMovesOf;认领目标 = 全部未勾在册行,不是收窄后的
  // claimableRows(被租约/指针收窄掉的行照样可能是改号后的新号行)。
  const adopt = adoptMovesOf(
    [...side.map.values(), ...(side.orphans ?? [])],
    parseTaskRows(readPlan(root, face)),
    side.map,
  )
  // 只有**真正会写出去的那批**(pendingList + 归并搬/退场)参与漂移判定;候选全集里被 enrich
  // 拒掉的那些本来就不会落盘,拿它们算 before/after 只会把"不写"误报成"改判"。
  const merged = new Map(side.map)
  for (const rec of p.pendingList) merged.set(rec.key, rec)
  for (const m of adopt.moves) {
    merged.delete(m.fromKey)
    merged.set(m.toKey, m.rec)
  }
  for (const m of adopt.retires) merged.delete(m.fromKey)
  return {
    undetermined: false,
    lines,
    ...p,
    adopt,
    // before 面 = **旧侧车**(判定语义的基线),不是裸散文(见 batchBucketDrift 头注)。
    drift: batchBucketDrift(lines, merged, side.map),
    existingCount: readBackCount(root),
  }
}

function printVerdict(p, { listLimit = 0 }) {
  if (p.undetermined) {
    console.log(`⚠️ 未判定 —— 侧车面取不到:${p.why}`)
    console.log('EXTRACT-RESULT state=undetermined changed=0 extractable=0 bucketsDrift=0 adopted=NA')
    return 2
  }
  console.log(
    `派单面 ${p.lines.length} 行 ⇒ 抽得出 ${p.extractable} 行(已在侧车 ${p.extractable - p.pending} 行 / 待追加 ${p.pending} 行)` +
      ` / 抽不出(继续靠散文报数)${p.lines.length - p.extractable} 行;侧车现有 ${p.existingCount} 条记录`,
  )
  const ad = p.adopt ?? { moves: [], retires: [], skipped: [] }
  const adoptedN = ad.moves.length + ad.retires.length
  if (ad.moves.length || ad.retires.length || ad.skipped.length) {
    console.log(
      `孤儿键归并(新旧标识符双向差 ∧ 标题锚点):搬 ${ad.moves.length} / 退场 ${ad.retires.length} / 不可归并 ${ad.skipped.length}` +
        `(改号器留下的旧号键;同批搬侧车键的迁移出口 = 本器 --apply)`,
    )
    for (const m of ad.moves.slice(0, 20)) console.log(`   ⇲ 搬 ${m.fromKey} → ${m.toKey}`)
    for (const m of ad.retires.slice(0, 20))
      console.log(`   ✂ 退场 ${m.fromKey}(新号键 ${m.toKey} 已有记录且语义逐字覆盖旧键,删旧键零信息丢失)`)
    for (const s of ad.skipped.slice(0, 10)) console.log(`   ⚠ ${s.key}:${s.why}`)
    if (ad.skipped.length > 10) console.log(`   …另 ${ad.skipped.length - 10} 条不可归并未逐条打印`)
  }
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
    console.log(`EXTRACT-RESULT state=refused changed=0 extractable=${p.extractable} bucketsDrift=${p.drift.length} adopted=0`)
    return 2
  }
  // 同批同键投影互斥(2026-10-26 立):抽出来两个互斥读数 ⇒ 一条都不写,交 `--reclassify` 逐条裁决。
  // 放行任何一条都是替人裁决归属,下一轮门 234 会把它变成 conflict(而门只报数,没人会看见)。
  if ((p.collisions ?? []).length > 0) {
    console.log(
      `❌ 整批不落 —— 抽取面同键 ${p.collisions.length} 个键投影读数互斥(写哪一条都是替人裁决):`,
    )
    for (const k of p.collisions.slice(0, 20)) console.log(`   · ${k}`)
    if (p.collisions.length > 20) console.log(`   …另 ${p.collisions.length - 20} 个键未逐条打印`)
    console.log(`EXTRACT-RESULT state=refused changed=0 extractable=${p.extractable} bucketsDrift=0 adopted=0 conflictKeys=${p.collisions.length}`)
    return 2
  }
  console.log('守恒:抽取前后每一行的归属桶零变化(逐行比 旧侧车 ↔ 新侧车,同为 dispositionOfV2)')
  // `changed` 只数**待追加**:全搬完时它是 0 ⇒ state=ready。把"已在位"再报成"有活"就是虚增待办。
  const state = p.pending > 0 ? 'changed' : 'ready'
  console.log(
    `EXTRACT-RESULT state=${state} changed=${p.pending} extractable=${p.extractable} bucketsDrift=0 adopted=${adoptedN}`,
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
  // S8/S9(2026-10-25 owner 补全):reclassify 可写 owner ⇒ bucketFromFields 判 owned-elsewhere;
  // 非字符串 owner 整批拒。
  const s8base = { key: 'G-8 甲', waiting: 'env', updatedAt: '2026-10-24T00:00:00.000Z' }
  const s8 = applyReclassify([s8base], [
    { key: 'G-8 甲', owner: '机主凭据交付面', why: '等条件禁令清偿:真卡在机主供值面' },
  ])
  ok(
    'S8 reclassify 写 owner ⇒ 桶变 owned-elsewhere',
    s8.changes?.length === 1 && s8.changes[0].rec.owner === '机主凭据交付面',
  )
  const s9 = applyReclassify([s8base], [{ key: 'G-8 甲', owner: 42, why: '非字符串 owner 必须整批拒' }])
  ok('S9 非字符串 owner ⇒ error(不落半批)', !!s9.error)

  // 孤儿键归并(2026-10-26):改号器留下的旧号键由新号键认领 —— 搬/退场/守恒闸/禁令/歧义各一臂。
  const newRow = '- [ ] G-70 备份链重建 —— 归属:备份链持有人'
  const newRowKey = compositeKeyOf(newRow)
  const oldRec = {
    key: compositeKeyOf('- [ ] G-79 备份链重建 —— 归属:备份链持有人'),
    owner: '备份链持有人',
    waiting: 'none',
    updatedAt: '2026-10-22T00:00:00.000Z',
  }
  const openRow = { line: 1, state: 'open', raw: newRow }
  const a10 = adoptMovesOf([oldRec], [openRow], new Map())
  ok(
    'S10 搬支:标题锚点逐字相等 ∧ 号段不同 ∧ 目标键空 ⇒ 搬到新号键',
    a10.moves.length === 1 && a10.moves[0].toKey === newRowKey && a10.moves[0].fromKey === oldRec.key,
  )
  const newRec = { key: newRowKey, owner: '备份链持有人', waiting: 'none', updatedAt: '2026-10-23T00:00:00.000Z' }
  const a11 = adoptMovesOf([oldRec], [openRow], new Map([[newRec.key, newRec]]))
  ok(
    'S11 退场支:新号键已有记录且语义逐字覆盖旧键 ⇒ 退场(不产生第二份)',
    a11.retires.length === 1 && a11.retires[0].toKey === newRowKey && a11.moves.length === 0,
  )
  const a12 = adoptMovesOf([{ ...oldRec, blocking: '旧记录独有的信息' }], [openRow], new Map([[newRec.key, newRec]]))
  ok(
    'S12 旧记录有新记录没有的字段 ⇒ 不退场,点名交 --reclassify(绝不替人裁)',
    a12.retires.length === 0 && a12.skipped.length === 1 && /reclassify/.test(a12.skipped[0].why),
  )
  const a13 = adoptMovesOf(
    [{ key: compositeKeyOf('- [ ] G-72 纯标题可做'), owner: '某持有者', waiting: 'none', updatedAt: '2026-10-22T00:00:00.000Z' }],
    [{ line: 1, state: 'open', raw: '- [ ] G-71 纯标题可做' }],
    new Map(),
  )
  ok(
    'S13 守恒闸:搬动会把可做行改判成归他人 ⇒ 拒搬并点名(闸沿用,不绕开)',
    a13.moves.length === 0 && /守恒闸/.test(a13.skipped[0]?.why ?? ''),
  )
  const a14 = adoptMovesOf(
    [{ key: compositeKeyOf('- [ ] G-73 备份链重建 —— 归属:备份链持有人'), waiting: 'human', updatedAt: '2026-10-22T00:00:00.000Z' }],
    [openRow],
    new Map(),
  )
  ok('S14 已禁形态(waiting-human 待拍板桶)不搬 —— 搬=扩散禁令', a14.moves.length === 0 && /已禁形态/.test(a14.skipped[0]?.why ?? ''))
  const a14b = adoptMovesOf(
    [{ key: compositeKeyOf('- [ ] G-81 备份链重建 在等:上游镜像源同步'), waiting: 'env', updatedAt: '2026-10-22T00:00:00.000Z' }],
    [{ line: 1, state: 'open', raw: '- [ ] G-70 备份链重建 在等:上游镜像源同步' }],
    new Map(),
  )
  ok(
    'S14b 已禁形态整族:waiting-env(等条件桶)同样不搬(2026-10-27 补洞,搬=凭空造真 F12 活票;判据单源 rotReasonsOf)',
    a14b.moves.length === 0 && /已禁形态/.test(a14b.skipped[0]?.why ?? ''),
  )
  const a15 = adoptMovesOf([oldRec], [openRow, { line: 2, state: 'open', raw: '- [ ] G-80 备份链重建 —— 归属:备份链持有人' }], new Map())
  ok('S15 标题锚点命中两行在册 ⇒ 归属歧义,一条都不动', a15.moves.length === 0 && /歧义/.test(a15.skipped[0]?.why ?? ''))
  const dir = mkScratch('pf-extract-adopt')
  try {
    mkdirSync(path.join(dir, 'scripts', 'data'), { recursive: true })
    const oldLine = JSON.stringify({ key: oldRec.key, owner: '备份链持有人', waiting: 'none', updatedAt: '2026-10-22T00:00:00.000Z' })
    writeFileSync(path.join(dir, 'scripts', 'data', 'plan-fields.jsonl'), oldLine + '\n', 'utf8')
    const w = applyAdoptMoves(dir, a10.moves, [])
    const after = readFileSync(path.join(dir, 'scripts', 'data', 'plan-fields.jsonl'), 'utf8')
    ok(
      'S16 归并落盘:旧号键物理行被摘、新号键记录写入(临时件+rename 出口)',
      w.moved === 1 && w.removed === 1 && after.includes(newRowKey) && !after.includes(oldRec.key),
    )
  } finally {
    rmScratch(dir)
  }
  // 退场声明档(2026-10-27):两族"没有值可改而被钉死"的记录各一对正反例。全部走真函数
  // (`retirePlanOf` / `validateRetireIntents`)—— 造 mock 锁住的只是测试自己的假设。
  const selfRows = [{ line: 1, state: 'open', raw: '- [ ] G-91 别的活票 —— 归属:某人' }]
  const selfRec = {
    key: 'G-90#退场声明档演练',
    waiting: 'none',
    updatedAt: '2026-10-20T00:00:00.000Z',
    updatedBy: 'plan-fields-extract',
  }
  const selfEntry = { raw: JSON.stringify(selfRec), rec: selfRec, why: '' }
  const selfMap = new Map([[selfRec.key, selfRec]])
  const okIntent = {
    key: selfRec.key,
    why: '题面在台账面已彻底消失,逐条声明退场(自写面记录的定向说明)',
    declaredAt: '2026-10-21T00:00:00.000Z',
    declaredBy: 'self-test',
  }
  const v17 = validateRetireIntents([okIntent], [selfRec])
  const p17 = retirePlanOf([selfEntry], selfRows, selfMap, { retireIntents: v17.intents })
  ok(
    'S17 自写面记录 + 合法声明 ⇒ 可退(旧档在这一族恒 0,声明是唯一出口)',
    v17.error === null && p17.retireKeys === 1 && p17.retire[0]?.intent?.why === okIntent.why,
  )
  const p18 = retirePlanOf([selfEntry], selfRows, selfMap)
  ok(
    'S18 同一记录不给声明 ⇒ 仍不退(自写面护栏原样保留)',
    p18.retireKeys === 0 && p18.held.some((h) => h.key === selfRec.key),
  )
  const v19 = validateRetireIntents(
    [{ ...okIntent, declaredAt: '2026-10-19T00:00:00.000Z' }],
    [selfRec],
  )
  const p19 = retirePlanOf([selfEntry], selfRows, selfMap, { retireIntents: v19.intents })
  ok(
    'S19 声明早于记录 updatedAt ⇒ 进 skipped(陈旧不记通过)且该键不可退',
    v19.error === null &&
      v19.skipped.length === 1 &&
      v19.skipped[0].key === selfRec.key &&
      p19.retireKeys === 0,
  )
  const hitRowA = '- [ ] （进行中@2026-10-20/某席）退场声明档锚点演练 归属:甲'
  const hitRowB = '- [ ] （进行中@2026-10-20/另席）退场声明档锚点演练 归属:乙'
  const hitRec = {
    key: 'G-92#退场声明档锚点演练',
    waiting: 'none',
    updatedAt: '2026-10-20T00:00:00.000Z',
    updatedBy: 'plan-fields-extract',
  }
  const hitRows = [selfRows[0], { line: 2, state: 'open', raw: hitRowA }, { line: 3, state: 'open', raw: hitRowB }]
  const hitMap = new Map([[hitRec.key, hitRec]])
  const hitEntry = { raw: JSON.stringify(hitRec), rec: hitRec, why: '' }
  const hitBase = {
    key: hitRec.key,
    why: '题面只挂在那两条无主键行的正文里,逐条点名后再退',
    declaredAt: '2026-10-21T00:00:00.000Z',
  }
  const v20a = validateRetireIntents([{ ...hitBase, hitRefs: [hitRowA] }], [hitRec])
  const v20b = validateRetireIntents([{ ...hitBase, hitRefs: [hitRowA, hitRowB] }], [hitRec])
  const p20a = retirePlanOf([hitEntry], hitRows, hitMap, { retireIntents: v20a.intents })
  const p20b = retirePlanOf([hitEntry], hitRows, hitMap, { retireIntents: v20b.intents })
  ok(
    'S20 题面挂在别的行正文里:hitRefs 未覆盖全部命中行 ⇒ 不可退;覆盖全部 ⇒ 可退',
    v20a.error === null &&
      v20b.error === null &&
      p20a.retireKeys === 0 &&
      /hitRefs 未覆盖全部命中行\(2 条命中\/1 条 ref\)/.test(
        p20a.held.find((h) => h.key === hitRec.key)?.why ?? '',
      ) &&
      p20b.retireKeys === 1,
  )
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
    if (it.owner !== undefined && typeof it.owner !== 'string')
      return { error: `第 ${k + 1} 项 owner 必须是字符串,实际 ${JSON.stringify(it.owner)}` }
    const next = { ...rec }
    if (it.waiting !== undefined) next.waiting = it.waiting
    if (it.blocking !== undefined) next.blocking = String(it.blocking)
    // owner(2026-10-25 补,机主令"等条件同型禁止"清偿批):归机主动作面/归他席的行需要把
    // owner 写进侧车(bucketFromFields:owner 非空 ⇒ owned-elsewhere)。与 waiting/blocking
    // 同一条纪律:逐条声明、带 why、陈旧不记通过。
    if (it.owner !== undefined) next.owner = String(it.owner).trim()
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
  // 退场声明是 `--retire-orphans` 的前置,单独给等于让声明悬空(它到底对哪一档生效说不清)⇒ 用法错。
  if (has('--retire-intent') && !has('--retire-orphans')) {
    console.log('❌ 用法错 —— --retire-intent 只能与 --retire-orphans 同用')
    return 2
  }
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
  // 孤儿键退场档(2026-10-27):只退不抽。三条前置与失效方向见 retirePlanOf 头注;
  // 默认 dry-run 零写盘,`--apply` 才动侧车(留痕 → 摘行 → 回读自证三段全在 applyRetireRecords 里)。
  if (has('--retire-orphans')) {
    if (has('--staged') && has('--worktree')) {
      console.log('❌ 用法错 —— --staged 与 --worktree 不得同用(两个判定面互斥,§0.4)')
      return 2
    }
    const face = has('--staged') ? 'staged' : has('--worktree') ? 'worktree' : 'head'
    let rows
    let side
    try {
      // 判定面必须是**全量登记行**(open + done),不能拿派单口径 claimableRows:
      // 后者刻意排除了带完整租约的行(在飞),用它当孤儿判据会把每一张在飞票的侧车记录
      // 都读成"台账已无对应行" ⇒ 2026-10-27 实测 dry-run 41 条可退里 12 条正是这一型。
      rows = parseTaskRows(readPlan(ROOT, face))
      side = readFieldsFace(ROOT, face)
    } catch (e) {
      console.log(`⚠️ 未判定 —— 台账面取不到(${face}):${String(e?.message ?? e).split('\n')[0]}`)
      console.log('RETIRE-RESULT state=undetermined retireKeys=0 retireLines=0 heldKeys=0')
      return 2
    }
    if (side.undetermined) {
      console.log(`⚠️ 未判定 —— 侧车取不到:${side.why}`)
      console.log('RETIRE-RESULT state=undetermined retireKeys=0 retireLines=0 heldKeys=0')
      return 2
    }
    const entries = parsePhysicalLines(existingLines(ROOT))
    // 声明档(2026-10-27):给"自写面"与"题面挂在别的行正文里"这两族一条定向说明通道。
    // 读不到/解析不了 ⇒ 未判定(不猜"大概是空的");有一条不合格 ⇒ 整批拒(不做部分应用)。
    let retireIntents = null
    const intentAt = argv.indexOf('--retire-intent')
    if (intentAt >= 0) {
      const file = argv[intentAt + 1]
      if (!file || file.startsWith('--')) {
        console.log('⚠️ 未判定 —— 声明档读不到/解析不了(未给路径)')
        console.log('RETIRE-RESULT state=undetermined retireKeys=0 retireLines=0 heldKeys=0 intents=0')
        return 2
      }
      let items
      try {
        items = JSON.parse(readFileSync(file, 'utf8'))
      } catch (e) {
        console.log(
          `⚠️ 未判定 —— 声明档读不到/解析不了(${file}):${String(e?.message ?? e).split('\n')[0]}`,
        )
        console.log('RETIRE-RESULT state=undetermined retireKeys=0 retireLines=0 heldKeys=0 intents=0')
        return 2
      }
      const v = validateRetireIntents(items, entries.map((e) => e.rec).filter(Boolean))
      if (v.error) {
        console.log(`❌ 声明档不合格 —— ${v.error}`)
        console.log('RETIRE-RESULT state=refused retireKeys=0 retireLines=0 heldKeys=0 intents=0')
        return 2
      }
      for (const s of v.skipped) console.log(`  ⏸ ${s.key}: ${s.why}`)
      retireIntents = v.intents
    }
    const intentCount = retireIntents ? retireIntents.size : 0
    const faceIds = new Set(Array.from(side.map.values()).map(faceIdentityOf))
    const rp = retirePlanOf(entries, rows, side.map, { faceIds, retireIntents })
    for (const m of rp.malformed ?? []) console.log(`  ⚠️ 畸形行原样保留:${m.why}`)
    for (const h of rp.held) console.log(`  ⏸ ${h.key}: ${h.why}`)
    for (const r of rp.retire)
      console.log(`  ⟳ 可退 ${r.key}(最近写手 ${r.updatedBy || '(缺)'},${r.lines.length} 行)`)
    console.log(
      `RETIRE-RESULT state=${rp.conserved ? (rp.retireKeys ? 'ready' : 'clean') : 'refused'} retireKeys=${rp.retireKeys} retireLines=${rp.retireLines} heldKeys=${rp.heldKeys} entries=${rp.total} kept=${rp.keptLines} intents=${intentCount}`,
    )
    if (!rp.conserved) return 2
    if (!has('--apply')) {
      console.log('   (dry-run:零写盘 —— 侧车文件一个字节都不动)')
      return rp.retireKeys ? 1 : 0
    }
    const res = applyRetireRecords(ROOT, rp)
    if (res.state === 'stripped') {
      console.log(
        `✅ 已退场 ${res.retired} 键 / ${res.lines} 行(留痕 ${res.ledgerWritten} 条 → ${res.ledger})`,
      )
      return 0
    }
    console.log(`⚠️ ${res.state} —— ${res.why}`)
    return res.state === 'clean' ? 0 : 2
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
  const ad = p.adopt ?? { moves: [], retires: [] }
  if (code !== 1 && ad.moves.length === 0 && ad.retires.length === 0) {
    if (code === 0) console.log('   本轮零条待追加(抽得出的记录已在侧车):侧车无需写入。')
    return code
  }
  if (code === 1) {
    // 落盘 = `pendingList`(同键合并后的那一批),**不是** `candidates`:
    // 后者含"已有键的候选",按只增不删追加会给同键叠出第二读数 ⇒ 门 234 conflict(2026-10-26 收口)。
    // 同键就地改写胜出那条的实现住在 `writePendingRecords`(它跑起来才不会把 check 钉在 changed)。
    const written = writePendingRecords(ROOT, p.pendingList)
    for (const k of written.collisions ?? [])
      console.log(`   ⚠ 同批同键互斥,整键拒写并点名:${k}(交 --reclassify 逐条裁决)`)
    console.log(
      `已写入 ${written.rewritten} 条合并记录 / 追加 ${written.appended} 条记录(记录不合法或同批互斥被拒 ${written.rejected} 条)` +
        ` → ${path.relative(ROOT, written.path)}`,
    )
  }
  // 孤儿键归并同批落地(2026-10-26):写前重验目标键仍为空,竞态条目点名放弃,不造第二读数。
  if (ad.moves.length || ad.retires.length) {
    const w = applyAdoptMoves(ROOT, ad.moves, ad.retires)
    console.log(
      `孤儿键归并已落地:搬 ${w.moved} 条 / 退场 ${w.retired} 条(摘旧号键物理行 ${w.removed} 行)→ ${path.relative(ROOT, w.path)}`,
    )
    for (const k of w.raced ?? [])
      console.log(`   ⚠ 目标键在写盘间隙已有记录,该条放弃(不造第二读数):${k}`)
  }
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
  adoptMovesOf,
  applyAdoptMoves,
  parsePhysicalLines,
  retirePlanOf,
  validateRetireIntents,
  applyRetireRecords,
  faceIdentityOf,
  RETIRE_SEAT,
  RETIRE_DROP_KIND,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
