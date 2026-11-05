#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 侧车声明式改判的**桶维唯一出口**(票 O68,2026-10-29 立)。
 *
 * ## 病(现读,不是推测)
 * `scripts/data/plan-fields.jsonl` 是 v2 尺的权威(`dispositionOfV2`:侧车命中即以侧车为准),
 * 而其中一批记录是**判据修正之前**的抽取产物:`O02#跨端UI单一源` 记着 2026-10-25 的
 * `waiting:"none"`(无 owner),行内标头却早已改归 `〔归:机主真机验证面｜等:—〕`
 * ⇒ 侧车判 `actionable`、散文判 `owned-elsewhere`,派单面按侧车把 O02 列成"现在可做"
 * (实测 before = `bucket=actionable source=fields conflict=true`)。
 * 两条既有写入口结构上都解不了这一个病:
 *  · `plan-fields-extract --check/--apply` 自带**桶零变化**守恒闸(`batchBucketDrift`)——
 *    它的职责是"搬说辞、不改判定",改桶恰在它的禁令里,整批 `refused`(这条闸不能放宽:
 *    放宽它等于让抽取器顺手改派单判定);
 *  · 手改 jsonl 不算通道(§1 侧车只增不删;且不留 `updatedBy`/`updatedAt` 交代,
 *    下一轮没人查得出谁改的,同键多份还会被门 234 读成 A3 矛盾组)。
 * `plan-fields-extract.mjs` 里另有一条 `--reclassify` 档(判据 `applyReclassify`),但它**只按
 * `sigOf` 打印**(`owner=…|waiting=…`),不回答"这一改把**派单桶**挪到哪一档"—— 而 O68 要的正是
 * 桶维读数:没有 before/after 桶,"改完了"与"桶没动"从输出上无法区分,下一个人只能再翻一遍台账散文。
 *
 * ## 本器只做一件事
 * 读 `--decl <json>`:`[{key, owner?, waiting?, blocking?, before?, after?, why}]`,逐条
 *  ① **校验**(判据**全部 import,本器不写第二把尺子**):
 *    · 值域 / `why` ≥10 字 / key 在侧车面 / 与现状同形跳过 —— extract 的 `applyReclassify`;
 *    · owner 形态 —— extract 的 `cleanOwner`(截断符 `…` / 占位 / 虚词 / 连续空白 / 括号 / 超 48 字
 *      同一把尺子);
 *    · 本器只补**谁都没判**的三项:同一份声明档里同键重复(同一键两份互为矛盾的交代没有胜者)、
 *      该键在**写面(工作树)台账**找不到对应登记行(侧车归属必须挂在一行上,"挂空"的改判无从复算桶)、
 *      **`before`/`after` 桶断言与复算不符**(见下);
 *  ② **复算桶**:用 `dispositionOfV2` 在写面上算这一行改判前后的桶,逐条打印
 *    `写面桶 before(来源=fields|prose,冲突=…) → after(…)` + 该行 state,并打出判定面 HEAD 的
 *    对照读数(该键写面副本与 HEAD 不同时 —— 上一轮改判未提交);
 *    **桶断言(`before`/`after`,可选但给了就要对)**是"多要一次定向说明"落成机器可读形态:
 *    声明者写出他以为的现状桶与目标桶,复算逐字段(bucket/source/conflict)比对,任一处不符
 *    ⇒ 整批不落。它防的正是本票的病:有人拿着**过期读数**("我以为它还是 actionable")来改判,
 *    改完以为改对了。桶是**判定结果不是写入口径** —— 只给 before/after 不给
 *    owner/waiting/blocking 依旧整批拒(否则等于替侧车猜该写什么值)。
 *  ③ **落盘**:写前把侧车整份备份到 `.ihui-agent/backups/plan-fields/`(gitignored,留最近 20 份),
 *    再走 `writeDedupedRecords`(临时件 + rename,与 extract 同一出口、同一种文件形态);
 *    写完**回读逐键断言**语义字段,不符 ⇒ exit 2 并点名(已写盘也要说清楚,同时报写前备份路径)。
 * 任一条校验不过 ⇒ **整批不落**(exit 2),绝不部分应用 —— 声明是"多要一次定向说明"的那份说明,
 * 说明里有一句不成话,这一批就不可信(挑着信 = 挑着改判定)。
 *
 * ## 为什么不能绕过
 *  · 绕 extract 的守恒闸去"顺手改个 owner"= 把"搬说辞"变成"改判定",而桶是派单输入(§22c);
 *  · 绕本器手改 jsonl 没有交代,且门 234 的 A3 会把同键多份读数读成矛盾组 ⇒ 投影只能输出
 *    `〔归:未判定〕`(没人能派单,也没人敢动);
 *  · 改判目标是**已禁形态**时本器拒写:`waiting-human`(待拍板 F11)/ `waiting-env`(等条件 F12)/
 *    `blocking` 带"拍板"残留,判据单源 `check-plan-fields.rotReasonsOf`。从"可做"改判进禁桶
 *    = 凭空造一枚 F11/F12 活票,与 extract 归并档"已禁形态不搬"同一取向(Date: 2026-10-27 补洞)。
 *    只在**本次新引入**时拒(before 已在禁桶的,本器允许把它改出来;改判正是那族唯一出路)。
 *
 * ## 失效方向(§0.3)
 * 取不到台账面 / 侧车面 / 声明档 ⇒ 打印「未判定」并 exit 2,**不回落另一个面、不猜"大概是空的"**;
 * 声明里有一项不成话 ⇒ 整批不落并逐条点名。**少改一次,绝不是多放一次。**
 *
 * ## 取材面(§0.4)
 * 本器是**写入器物**,不是守门尺子,所以 before/after 读数取**它要改写的那一面 = 工作树**
 * (台账行 + 侧车同面同轮),重跑一次必落"与写面现状同形 ⇒ 零改动"而不是再算一遍同一件事;
 * 判定面 **HEAD**(全量档口径,派单面此刻消费的那一面)只作**对照打印**:某键的写面副本与 HEAD
 * 不同(上一轮改判已落盘未提交)时逐条打出 `对照:判定面 HEAD 现读 <桶>`,绝不拿它冒充写面读数。
 * 取不到写面 ⇒ exit 2 未判定;HEAD 面取不到 ⇒ 明写"本节只报写面读数",不记绿也不冒红(§0.3)。
 * 同键多份(写面)⇒ 整批不落并点名去重档:整份重写会把"哪条胜出"的隐式裁决一并落盘,那是
 * `--dedupe` 的事,不是改判档的事。
 *
 * ## 用法
 *  `node scripts/plan-fields-reclassify.mjs --decl <声明档.json>`           只读复核(dry-run,零写盘)
 *  `node scripts/plan-fields-reclassify.mjs --decl <声明档.json> --apply`   落盘
 *  `node scripts/plan-fields-reclassify.mjs --self-test`
 *  `node scripts/plan-fields-reclassify.mjs --help`
 * 声明档示例(每项必须有 why,≥10 字;`owner`/`waiting`/`blocking` 至少给一项,否则是空声明;
 * `before`/`after` 可选,给了就逐字段复算比对,值域单源 = `plan-task-index` 的 `DISPOSITIONS`):
 *  `[{"key":"O02#跨端UI单一源","owner":"机主真机验证面","waiting":"none",
 *     "before":{"bucket":"actionable","source":"fields","conflict":true},
 *     "after":{"bucket":"owned-elsewhere","conflict":false},
 *     "why":"行内标头已改归机主真机面,剩余仅真机观感读数"}]`
 * 结论行:`RECLASSIFY-RESULT state=clean|ready|landed|refused|undetermined declared=N changed=N unchanged=N`
 * 退出码:0 = 无需改 / 已落地;1 = dry-run 存在待改;2 = 未判定或被拒。
 */
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { FIELDS_REL, loadFields } from './lib/plan-fields.mjs'
import { DISPOSITIONS, compositeKeyOf, dispositionOfV2, parseTaskRows } from './lib/plan-task-index.mjs'
import { readFieldsFace, readPlan } from './plan-tasks.mjs'
import { applyReclassify, cleanOwner, writeDedupedRecords } from './plan-fields-extract.mjs'
// 违禁桶族的唯一读数出口(与 extract 归并档 import 的是同一份,§0.6)。
import { rotReasonsOf } from './check-plan-fields.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** 声明里可改的语义字段(与 `applyReclassify` 同三枚;`why` 是交代,不是值)。 */
const DECLARED_KEYS = ['owner', 'waiting', 'blocking']
/** `dispositionOfV2` 结论里可被断言的三个字段(桶 + 来源 + 是否两侧矛盾)。 */
const BUCKET_FIELDS = ['bucket', 'source', 'conflict']
/** 桶来源值域单源 = `dispositionOfV2` 自己的两个分支,不另抄一份。 */
const BUCKET_SOURCES = new Set(['fields', 'prose'])
/** 逐字比较用的规范形:字段插入顺序不是语义,`loadFields` 会按 `OPTIONAL_KEYS` 重排。 */
const canon = (o) => JSON.stringify(Object.keys(o ?? {}).sort().map((k) => [k, o[k]]))

/**
 * 纯函数:`before`/`after` 桶声明逐字段比对(**唯一**实现,自检与主流程都问它)。
 * `bucket` 必填由调用方(形态校验)回答;这里只比**声明过的**字段 —— 没声明 = 不主张。
 * @returns {{field:string, declared:unknown, actual:unknown}[]} 空数组 = 声明与复算同形
 */
export function bucketAssertionDrift(declared, actual) {
  const out = []
  if (!declared || typeof declared !== 'object') return out
  for (const k of BUCKET_FIELDS) {
    if (declared[k] === undefined) continue
    if (declared[k] !== actual?.[k]) out.push({ field: k, declared: declared[k], actual: actual?.[k] })
  }
  return out
}

/** 桶声明的**形态**校验(值域单源 = `DISPOSITIONS` / `BUCKET_SOURCES`)。 */
function bucketDeclError(b, which, n) {
  if (!b || typeof b !== 'object' || Array.isArray(b))
    return `第 ${n} 项 ${which} 桶声明必须是对象 {bucket, source?, conflict?},实际 ${JSON.stringify(b)}`
  if (typeof b.bucket !== 'string' || !DISPOSITIONS.includes(b.bucket))
    return `第 ${n} 项 ${which}.bucket 不在桶值域(${DISPOSITIONS.join('/')})内:${JSON.stringify(b.bucket)}`
  if (b.source !== undefined && !BUCKET_SOURCES.has(b.source))
    return `第 ${n} 项 ${which}.source 只能是 fields/prose,实际 ${JSON.stringify(b.source)}`
  if (b.conflict !== undefined && typeof b.conflict !== 'boolean')
    return `第 ${n} 项 ${which}.conflict 只能是布尔,实际 ${JSON.stringify(b.conflict)}`
  return null
}

/**
 * 纯函数:声明 + 写面(工作树)台账/侧车 ⇒ 改判计划,**或整批拒**。
 *
 * 为什么用**写面**当 before 基线:本器改的就是工作树那份物理行,重跑一次必须落"未变"而不是
 * 再算一遍同样的事;`headFields` 只用于**对照打印**(派单面此刻读什么),判据不吃它。
 *
 * @param {object} o
 * @param {{raw:string,state:string}[]} o.rows   写面(工作树)全部登记行(open + done)
 * @param {{map:Map<string,object>,undetermined:boolean}} o.beforeFields 写面侧车(改判前)
 * @param {{map:Map<string,object>,undetermined:boolean}|null} [o.headFields] 判定面(HEAD)侧车,仅对照
 * @param {object[]} o.records 写面记录(每个键一条,`loadFields` 的胜出者)
 * @param {object[]} o.items 声明项 `[{key, owner?, waiting?, blocking?, why}]`
 * @returns {{error:string}|{items:object[],changes:object[],nextRecords:object[],declared:number}}
 */
export function buildReclassifyPlan({
  rows,
  beforeFields,
  headFields = null,
  records,
  items,
  nowIso = new Date().toISOString(),
}) {
  const fail = (why) => ({ error: why })
  if (!Array.isArray(items) || items.length === 0)
    return fail('声明档必须是非空数组 [{key, owner?, waiting?, blocking?, why}](空声明 = 没有要改的事)')

  const rowByKey = new Map()
  for (const r of rows ?? []) {
    const k = compositeKeyOf(String(r?.raw ?? ''))
    if (!k) continue
    // 同键多行(台账缺陷,门 130 F4 管):取第一行复算即可 —— 桶读的是同一份侧车记录,
    // 本器不为台账自身的重复改判据。
    if (!rowByKey.has(k)) rowByKey.set(k, r)
  }

  const seen = new Set()
  for (const [i, it] of (items ?? []).entries()) {
    const n = i + 1
    if (!it || typeof it !== 'object' || Array.isArray(it)) return fail(`第 ${n} 项不是对象`)
    if (typeof it.key !== 'string' || it.key.trim() === '')
      return fail(`第 ${n} 项缺 key 或 key 不是非空字符串`)
    if (seen.has(it.key))
      return fail(`第 ${n} 项 key 重复声明(${it.key})—— 同一键只能有一份交代,两份互相矛盾的声明没有胜者`)
    seen.add(it.key)
    if (DECLARED_KEYS.every((k) => it[k] === undefined))
      return fail(
        `第 ${n} 项没有声明任何语义字段(owner/waiting/blocking 至少一项)—— ` +
          `空声明不制造"改过"的假账;桶(before/after)是判定结果不是写入口径,单给桶也照样拒`,
      )
    for (const which of ['before', 'after']) {
      if (it[which] === undefined) continue
      const e = bucketDeclError(it[which], which, n)
      if (e) return fail(e)
    }
    if (!rowByKey.has(it.key))
      return fail(
        `第 ${n} 项 key 在写面(工作树)台账里找不到对应登记行:${it.key}` +
          `(侧车归属必须挂在一行上;先核对复合主键,或先把该行写进台账 —— 挂空的改判无从复算桶)`,
      )
    if (typeof it.owner === 'string') {
      const v = it.owner.trim()
      // 空串 = 显式抹掉归属(改判方向之一,落回 waiting 桶),不走向取值尺子;
      // 非空则必须**原样**通过 cleanOwner(抽取器同一把尺子:超 48 字/占位/虚词/`…` 一律不是归属)。
      if (v !== '' && cleanOwner(v) !== v)
        return fail(
          `第 ${n} 项 owner 形态不合法(占位/虚词/含截断符/超长,与抽取器 cleanOwner 同一把尺):${JSON.stringify(it.owner)}`,
        )
    }
  }

  // 值域 / why 长度 / key 在侧车面 / 与现状同形跳过 —— 全部由 extract 的判据回答(§0.6)。
  const res = applyReclassify(records, items, nowIso)
  if (res.error) return fail(res.error)

  const beforeMap = beforeFields?.map instanceof Map ? beforeFields.map : new Map()
  const afterMap = new Map(beforeMap)
  const changeByKey = new Map()
  for (const c of res.changes ?? []) {
    changeByKey.set(c.key, c)
    afterMap.set(c.key, c.rec)
  }
  const afterFields = { map: afterMap, undetermined: false }

  const out = []
  const banned = []
  const drift = []
  const headMap = headFields?.undetermined ? null : (headFields?.map ?? null)
  for (const [i, it] of items.entries()) {
    const n = i + 1
    const row = rowByKey.get(it.key)
    const change = changeByKey.get(it.key) ?? null
    const before = dispositionOfV2({ line: row.raw, fields: beforeFields })
    const after = change
      ? dispositionOfV2({ line: row.raw, fields: afterFields })
      : dispositionOfV2({ line: row.raw, fields: beforeFields })
    // 桶断言:声明者以为的现状/目标必须与复算逐字段同形(防拿过期读数改判)。
    for (const [which, declared, actual] of [
      ['before', it.before, before],
      ['after', it.after, after],
    ]) {
      for (const d of bucketAssertionDrift(declared, actual))
        drift.push(
          `第 ${n} 项(${it.key}) ${which}.${d.field} 声明 ${JSON.stringify(d.declared)} ≠ 现算 ${JSON.stringify(d.actual)}`,
        )
    }
    // 禁桶守卫只在**本次新引入**时拒:before 已在禁桶的那族,本器正是它的出路。
    const beforeRec = beforeMap.get(it.key) ?? null
    const afterRec = change?.rec ?? beforeRec
    const rotBefore = rotReasonsOf(beforeRec)
    const rotAfter = rotReasonsOf(afterRec)
    if (rotAfter.length > 0 && rotBefore.length === 0)
      banned.push(`${it.key}:改判后落 ${rotAfter.join(' ∧ ')}`)
    // 对照:该键在判定面(HEAD)与写面的读数是否已经不同(上一轮改判已落盘未提交)。
    const headDiffers = headMap !== null && canon(headMap.get(it.key)) !== canon(beforeRec)
    out.push({
      key: it.key,
      state: row.state,
      before,
      after,
      change,
      unchanged: change === null,
      headRead: headDiffers ? dispositionOfV2({ line: row.raw, fields: headFields }) : null,
    })
  }
  if (banned.length > 0)
    return fail(
      `改判目标是已禁形态(待拍板 F11 / 等条件 F12 的机主禁令射程)⇒ 整批不落:${banned.join(' / ')}`,
    )
  if (drift.length > 0)
    return fail(
      `桶声明与复算不一致(声明是你以为的现状/结果,复算才是派单面真正读到的)⇒ 整批不落:` +
        `${drift.join(' / ')}(先拿现读读数重写声明档,别拿过期读数改判)`,
    )

  const nextRecords = (records ?? []).map((r) => changeByKey.get(r.key)?.rec ?? r)
  return { items: out, changes: res.changes ?? [], nextRecords, declared: items.length }
}

/**
 * 落盘后的回读自证:逐键逐字比(规范形 `canon`,字段插入顺序不是语义)。
 * 任一处不符 ⇒ 已写盘也要说清楚(不冒"落地成功")。
 */
export function verifyLanded(root, records) {
  const got = loadFields(root)
  if (got.undetermined) return { ok: false, why: `回读取不到侧车:${got.why}` }
  if (got.malformed > 0) return { ok: false, why: `回读见到 ${got.malformed} 条畸形行(改写不该造出看不懂的行)` }
  const drift = []
  for (const rec of records ?? []) {
    const back = got.map.get(rec.key)
    if (!back) {
      drift.push(`${rec.key}:回读不在位`)
      continue
    }
    if (canon(back) !== canon(rec)) drift.push(`${rec.key}:回读与计划不符`)
  }
  if (got.map.size !== new Set((records ?? []).map((r) => r.key)).size)
    drift.push(`回读键数 ${got.map.size} ≠ 计划键数 ${new Set((records ?? []).map((r) => r.key)).size}`)
  if (drift.length > 0) return { ok: false, why: drift.slice(0, 3).join(' / ') }
  return { ok: true, keys: got.map.size }
}

const fmtBucket = (d) => `${d.bucket}(来源=${d.source}${d.conflict ? ',冲突=true' : ''})`

/**
 * 写前备份:侧车整份复制到 `.ihui-agent/backups/plan-fields/`(整目录 gitignored),
 * 按文件名(= ISO 时刻)只留最近 `keep` 份。备份是**兜底**不是前置:源读不到 ⇒ 返回 null,
 * 调用方明写"未备份",但不拦落地(否则结构上无法改判,§0.10 失效方向)。
 * 与 `writeDedupedRecords` 的临时件 + rename 互补:那一步保证"要么旧版要么新版",这一步保证
 * "新版不对劲时旧版还在"。
 * @returns {string|null} 备份相对路径;源不存在 ⇒ null
 */
export function backupFields(root, stamp, keep = 20) {
  const src = path.join(root, FIELDS_REL)
  let text
  try {
    text = readFileSync(src, 'utf8')
  } catch {
    return null
  }
  const dir = path.join(root, '.ihui-agent', 'backups', 'plan-fields')
  mkdirSync(dir, { recursive: true })
  const dst = path.join(dir, `plan-fields.${stamp.replace(/[:.]/g, '-')}.jsonl`)
  writeFileSync(dst, text, 'utf8')
  try {
    const olds = readdirSync(dir)
      .filter((f) => /^plan-fields\..+\.jsonl$/.test(f))
      .sort()
    for (const f of olds.slice(0, Math.max(0, olds.length - keep))) unlinkSync(path.join(dir, f))
  } catch {
    // 轮转失败不反推"没备份" —— 备份件本身已写成;多留几份比误删干净。
  }
  return path.relative(root, dst)
}

function printPlan(p) {
  for (const it of p.items) {
    console.log(
      `  ${it.unchanged ? '·' : '⟳'} ${it.key}[${it.state}] 写面桶 ${fmtBucket(it.before)} → ${fmtBucket(it.after)}` +
        `${it.unchanged ? '(与写面现状同形,跳过)' : `  sig ${it.change.from} → ${it.change.to}`}`,
    )
    if (it.change) console.log(`      原因:${it.change.why}`)
    if (it.headRead) console.log(`      对照:判定面 HEAD 现读 ${fmtBucket(it.headRead)}(该键写面副本已与 HEAD 不同 —— 上一轮改判未提交)`)
  }
}

function selfTest() {
  const checks = []
  const ok = (name, cond) => checks.push([name, !!cond])
  const key = 'O02#跨端UI单一源'
  const row = {
    line: 1,
    state: 'open',
    raw: '- [ ]〔归:机主真机验证面｜等:—〕 O02 跨端 UI 单一源:小程序端与 App(RN)端逐档同值',
  }
  const before = {
    map: new Map([[key, { key, waiting: 'none', blocking: '', updatedAt: '2026-10-25T08:18:07.725Z', updatedBy: 'plan-fields-reclassify' }]]),
    undetermined: false,
  }
  const records = [...before.map.values()]
  const base = buildReclassifyPlan({
    rows: [row],
    beforeFields: before,
    records,
    items: [{ key, owner: '机主真机验证面', waiting: 'none', why: '行内标头已改归机主真机面,剩余仅真机观感读数' }],
    nowIso: '2026-10-29T00:00:00.000Z',
  })
  ok(
    'S1 改判前后桶可见:actionable(冲突) → owned-elsewhere(无冲突)',
    !base.error &&
      base.items[0].before.bucket === 'actionable' &&
      base.items[0].before.conflict === true &&
      base.items[0].after.bucket === 'owned-elsewhere' &&
      base.items[0].after.conflict === false,
  )
  ok('S2 落盘记录带 updatedBy=plan-fields-reclassify', base.changes?.[0]?.rec?.updatedBy === 'plan-fields-reclassify')
  const shortWhy = buildReclassifyPlan({
    rows: [row],
    beforeFields: before,
    records,
    items: [{ key, owner: '机主真机验证面', why: '太短' }],
  })
  ok('S3 why 太短 ⇒ 整批拒(判据来自 extract 的 applyReclassify,不另写)', /少于 10 字/.test(shortWhy.error ?? ''))
  const noRow = buildReclassifyPlan({
    rows: [],
    beforeFields: before,
    records,
    items: [{ key, owner: '机主真机验证面', why: '行内标头已改归机主真机面,剩余仅真机观感读数' }],
  })
  ok('S4 判定面找不到该行的 key ⇒ 整批拒(挂空的改判无从复算桶)', /找不到对应登记行/.test(noRow.error ?? ''))
  const dup = buildReclassifyPlan({
    rows: [row],
    beforeFields: before,
    records,
    items: [
      { key, owner: '甲面持有人', why: '第一条交代足够长的定向说明' },
      { key, owner: '乙面持有人', why: '第二条交代足够长的定向说明' },
    ],
  })
  ok('S5 同键重复声明 ⇒ 整批拒(两份矛盾的交代没有胜者)', /重复声明/.test(dup.error ?? ''))
  const badOwner = buildReclassifyPlan({
    rows: [row],
    beforeFields: before,
    records,
    items: [{ key, owner: '…', why: '非法 owner 形态必须整批拒(与 cleanOwner 同一把尺)' }],
  })
  ok('S6 owner 形态非法(截断符/占位)⇒ 整批拒', /owner 形态不合法/.test(badOwner.error ?? ''))
  const toBanned = buildReclassifyPlan({
    rows: [row],
    beforeFields: before,
    records,
    items: [{ key, waiting: 'env', why: '把可做改判进等条件桶 —— 正是 F12 禁令射程' }],
  })
  ok('S7 改判目标是已禁形态(等条件桶)⇒ 整批拒(凭空造 F12 活票)', /已禁形态/.test(toBanned.error ?? ''))
  const noField = buildReclassifyPlan({
    rows: [row],
    beforeFields: before,
    records,
    items: [{ key, why: '一个语义字段都没声明,等于没改' }],
  })
  ok('S8 空声明(只给 why)⇒ 整批拒(不制造"改过"的假账)', /没有声明任何语义字段/.test(noField.error ?? ''))
  const same = buildReclassifyPlan({
    rows: [{ ...row, raw: '- [ ] O02 跨端 UI 单一源:小程序端与 App(RN)端逐档同值' }],
    beforeFields: { map: new Map([[key, { key, owner: '机主真机验证面', waiting: 'none', updatedAt: '2026-10-25T00:00:00.000Z' }]]), undetermined: false },
    records: [{ key, owner: '机主真机验证面', waiting: 'none', updatedAt: '2026-10-25T00:00:00.000Z' }],
    items: [{ key, owner: '机主真机验证面', why: '与现状同形的声明应被跳过而不是记一笔改动' }],
  })
  ok('S9 与现状同形 ⇒ changes=0(不制造"改过"的假账)', !same.error && same.changes.length === 0 && same.items[0].unchanged === true)

  const assertItem = {
    key,
    owner: '机主真机验证面',
    waiting: 'none',
    before: { bucket: 'actionable', source: 'fields', conflict: true },
    after: { bucket: 'owned-elsewhere', conflict: false },
    why: '行内标头已改归机主真机面,剩余仅真机观感读数',
  }
  const asserted = buildReclassifyPlan({
    rows: [row],
    beforeFields: before,
    records,
    items: [assertItem],
    nowIso: '2026-10-29T00:00:00.000Z',
  })
  ok(
    'S10 桶断言与复算同形 ⇒ 放行(changes=1)',
    !asserted.error && asserted.changes.length === 1 && asserted.items[0].after.bucket === 'owned-elsewhere',
  )
  const wrongBefore = buildReclassifyPlan({
    rows: [row],
    beforeFields: before,
    records,
    items: [{ ...assertItem, before: { bucket: 'owned-elsewhere' } }],
  })
  ok(
    'S11 before 桶声明与现算不符 ⇒ 整批拒(防拿过期读数改判)',
    /桶声明与复算不一致/.test(wrongBefore.error ?? '') && /before\.bucket/.test(wrongBefore.error ?? ''),
  )
  const wrongAfter = buildReclassifyPlan({
    rows: [row],
    beforeFields: before,
    records,
    items: [{ ...assertItem, after: { bucket: 'actionable' } }],
  })
  ok(
    'S12 after 桶声明与复算不符 ⇒ 整批拒(改判没落到你以为的那一档)',
    /桶声明与复算不一致/.test(wrongAfter.error ?? '') && /after\.bucket/.test(wrongAfter.error ?? ''),
  )
  const badBucket = buildReclassifyPlan({
    rows: [row],
    beforeFields: before,
    records,
    items: [{ ...assertItem, after: { bucket: 'todo' } }],
  })
  ok('S13 桶值域外(todo)⇒ 整批拒(值域单源 DISPOSITIONS)', /桶值域/.test(badBucket.error ?? ''))
  const onlyBuckets = buildReclassifyPlan({
    rows: [row],
    beforeFields: before,
    records,
    items: [{ key, before: { bucket: 'actionable' }, after: { bucket: 'owned-elsewhere' }, why: '只声明桶不给写入口径,等于替侧车猜值' }],
  })
  ok(
    'S14 只给 before/after 不给语义字段 ⇒ 整批拒(桶是判定结果不是写入口径)',
    /没有声明任何语义字段/.test(onlyBuckets.error ?? ''),
  )
  ok(
    'S15 bucketAssertionDrift:未声明字段不主张(只比声明过的)',
    bucketAssertionDrift({ bucket: 'actionable' }, { bucket: 'actionable', source: 'prose', conflict: true }).length === 0 &&
      bucketAssertionDrift({ source: 'fields' }, { bucket: 'actionable', source: 'prose' }).length === 1,
  )

  let fails = 0
  for (const [name, pass] of checks) {
    if (!pass) fails++
    console.log(`${pass ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n自检:${checks.length - fails} 通过 / ${fails} 失败`)
  return fails === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  const has = (f) => argv.includes(f)
  if (has('--self-test')) return selfTest()
  if (has('--help') || has('-h')) {
    console.log(`用法:
  node scripts/plan-fields-reclassify.mjs --decl <声明档.json>          只读复核(dry-run,零写盘)
  node scripts/plan-fields-reclassify.mjs --decl <声明档.json> --apply  落盘(先备份,写后回读)
  node scripts/plan-fields-reclassify.mjs --self-test                   判据自检
  node scripts/plan-fields-reclassify.mjs --help                        本帮助

声明档(JSON 数组,逐条一项;禁批量一锅端,一条一项交代):
  [{ key:"O02#跨端UI单一源",                 // 复合主键(编号#标题前缀),必须在台账有一行
     owner?:"机主真机验证面", waiting?:"none|env|human", blocking?:"…",   // 至少一项,禁桶不落
     before?:{ bucket:"actionable", source?:"fields|prose", conflict?:true },
     after?:{ bucket:"owned-elsewhere", conflict?:false },
     why:"<≥10 字定向说明>" }]
桶值域(= plan-task-index 的 DISPOSITIONS):${DISPOSITIONS.join(' / ')}
before/after 是**断言**:逐字段复算(dispositionOfV2)比对,不一致整批拒;桶是判定结果,
单给桶不给 owner/waiting/blocking 也整批拒。
结论行:RECLASSIFY-RESULT state=clean|ready|landed|refused|undetermined declared=N changed=N unchanged=N`)
    return 0
  }
  // 未认识的旗标一律用法错(§0.3):静默忽略 `--aply` 这类笔误会把 dry-run 当成"已经改过了"。
  const known = new Set(['--decl', '--apply'])
  const unknown = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--decl') {
      i++
      continue
    }
    if (!known.has(argv[i])) unknown.push(argv[i])
  }
  if (unknown.length > 0) {
    console.log(`❌ 用法错 —— 未认识的旗标:${unknown.join(' ')}(只认 --decl <声明档> / --apply / --self-test / --help)`)
    console.log('RECLASSIFY-RESULT state=refused declared=0 changed=0 unchanged=0')
    return 2
  }
  const declAt = argv.indexOf('--decl')
  const declFile = declAt >= 0 ? argv[declAt + 1] : null
  if (!declFile || declFile.startsWith('--')) {
    console.log('❌ 用法 —— 必须给 --decl <声明档 JSON> [--apply](缺省 dry-run)')
    console.log('RECLASSIFY-RESULT state=refused declared=0 changed=0 unchanged=0')
    return 2
  }

  let items
  try {
    items = JSON.parse(readFileSync(declFile, 'utf8'))
  } catch (e) {
    console.log(`⚠️ 未判定 —— 声明档读不到/解析不了(${declFile}):${String(e?.message ?? e).split('\n')[0]}`)
    console.log('RECLASSIFY-RESULT state=undetermined declared=0 changed=0 unchanged=0')
    return 2
  }

  // 写面(工作树):本器改的就是这一份物理行,重跑必须落"未变";台账与侧车**同面同轮**(§0.4)。
  let rows
  let wt
  try {
    rows = parseTaskRows(readPlan(ROOT, 'worktree'))
  } catch (e) {
    console.log(`⚠️ 未判定 —— 写面(工作树)取不到台账:${String(e?.message ?? e).split('\n')[0]}`)
    console.log('RECLASSIFY-RESULT state=undetermined declared=0 changed=0 unchanged=0')
    return 2
  }
  wt = loadFields(ROOT)
  if (wt.undetermined) {
    console.log(`⚠️ 未判定 —— 写面(工作树)取不到侧车:${wt.why}`)
    console.log('RECLASSIFY-RESULT state=undetermined declared=0 changed=0 unchanged=0')
    return 2
  }
  if (wt.malformed > 0) {
    console.log(`❌ 整批不落 —— 侧车有 ${wt.malformed} 条畸形行(不替看不懂的行做决定,先人工核对)`)
    console.log('RECLASSIFY-RESULT state=refused declared=0 changed=0 unchanged=0')
    return 2
  }
  if ((wt.orphans ?? []).length > 0) {
    // 同键多份:整份重写会把"哪条胜出"的隐式裁决一起落盘 —— 那是去重档的事,不是改判档的事。
    console.log(`❌ 整批不落 —— 侧车同键多份 ${wt.orphans.length} 条(先 \`node scripts/plan-fields-extract.mjs --dedupe --apply\`)`)
    console.log('RECLASSIFY-RESULT state=refused declared=0 changed=0 unchanged=0')
    return 2
  }
  // 判定面(HEAD)侧车只作**对照打印**(派单面此刻读什么);取不到就明写只报写面,不冒充判过(§0.3)。
  const headFields = readFieldsFace(ROOT, 'head')
  if (headFields.undetermined) console.log(`   (判定面 HEAD 侧车取不到:${headFields.why} ⇒ 本节只报写面读数)`)

  const p = buildReclassifyPlan({
    rows,
    beforeFields: { map: wt.map, undetermined: false },
    headFields: headFields.undetermined ? null : headFields,
    records: [...wt.map.values()],
    items,
  })
  if (p.error) {
    console.log(`❌ 整批不落 —— ${p.error}`)
    console.log(`RECLASSIFY-RESULT state=refused declared=${Array.isArray(items) ? items.length : 0} changed=0 unchanged=0`)
    return 2
  }
  printPlan(p)
  console.log(`写面(工作树):台账 ${rows.length} 行 / 侧车 ${wt.map.size} 条`)
  const changed = p.changes.length
  if (changed === 0) {
    console.log('   声明与现状全部同形 ⇒ 零改动(不制造"改过"的假账)。')
    console.log(`RECLASSIFY-RESULT state=clean declared=${p.declared} changed=0 unchanged=${p.declared}`)
    return 0
  }
  const resultLine = (state) =>
    `RECLASSIFY-RESULT state=${state} declared=${p.declared} changed=${changed} unchanged=${p.declared - changed}`
  if (!has('--apply')) {
    console.log(resultLine('ready'))
    console.log('   (dry-run:零写盘 —— 侧车文件一个字节都不动)')
    return 1
  }
  const bk = backupFields(ROOT, new Date().toISOString())
  const w = writeDedupedRecords(ROOT, p.nextRecords)
  const back = verifyLanded(ROOT, p.nextRecords)
  if (!back.ok) {
    console.log(`⚠️ 回读自证不过(已写盘,须人工复查):${back.why}`)
    console.log(`   写前备份:${bk ?? '未取到(源文件读不到,无法留旧版)'}`)
    console.log(resultLine('refused'))
    return 2
  }
  console.log(
    `✅ 已改判 ${changed} 条(侧车 ${w.before} → ${w.after} 条,回读 ${back.keys} 键逐字同位)→ ${path.relative(ROOT, w.path)}`,
  )
  console.log(`   写前备份:${bk ?? '未取到(源文件读不到,无法留旧版)'}`)
  console.log(resultLine('landed'))
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
  buildReclassifyPlan,
  bucketAssertionDrift,
  backupFields,
  verifyLanded,
  fmtBucket,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
