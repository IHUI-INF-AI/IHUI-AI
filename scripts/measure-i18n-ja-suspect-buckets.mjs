#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 133 的 L1b「表外汉字即嫌疑」三口径对照量表(G-1058618 立,2026-10-05)。
 *
 * ── 为什么要有这把尺 ──────────────────────────────────────────────────
 * 门 133 的 L1b 现行口径是 `lib/i18n-script-families.mjs` 的 `nonJoyoHan()`:
 * **不在 `scripts/joyo-kanji.json`(2010 版 2136 字)内即嫌疑**。这条判据的真语料假阳性很高
 * (七面现读 100 个字种),G-1058618 因此登记"须重新设计简繁判据的方向与按 locale 分派"。
 * 但**"有假阳性"不等于"换方向就能救"** —— 换方向可能连带削弱对真事故的捕获力。
 * 本尺就是量这一件事:**三口径各自在真语料上剩多少、对已知真事故各抓不抓到**。
 *
 * ── 本尺量出的结论(2026-10-05 现读,数字现跑勿照抄)─────────────────────
 *  ① 对**真事故①**(门 133 自检 T1 的 `web/ja::aiChat.org` 形状:整块繁体中文,
 *     值 `整理會話`/`資料夾`/`標籤`):**现行口径三个值全抓到**;方案 B 只抓到 `會`;
 *     方案 A(cn→tw)**一个都抓不到**(`會`/`夾`/`籤` 都不是简体字)。
 *     ⇒ **捕获力:现行 > B > A**。"换方向收窄"是在**削弱**对真事故的捕获,不是在修假阳性。
 *  ② 七面假阳性字种:现行 **100** / 方案A **6** / 方案B **23**。
 *  ③ 现行那 100 字按成因分三桶,**这才是判据设计的依据**(见 `BUCKETS`):
 *     双向都不变 59 / tw→jp 变 15 / cn→tw 变 6。第三桶里至少 5 个是**必须保留的专名**
 *     (`钉钉`/`智谱`/`微信视频号`=产品名、`简体中文`=语言本名)⇒ **任何按转换方向筛的口径都会
 *     在这 5 个上误报**。正解是按「是否专有/固有」分派,不是按简繁方向。
 *
 * ── 三条纪律 ──────────────────────────────────────────────────────────
 *  ① **表取不到 ⇒ 全部不判**。`joyo-kanji.json` 读不出/字数异常时输出 `ok:false` 且各计数为
 *     `null`,**不得**把"表没读到"读成"零嫌疑"—— 那会让整块内容凭空干净(与
 *     `nonJoyoHan()` 自己那条 `if (!joyo) return null` 同一纪律,此处是它的量表侧对应物)。
 *  ② **本尺只报数、不判红、不改一个字节**。收紧判据是门 133 持有人的决定(§12e 先量表
 *     不立刻收紧);本尺存在的意义是让那个决定有数字可依。
 *  ③ **转换器不可用 ⇒ 不判**。`opencc-js` 缺任一方向时该桶输出 `null` 并在 notes 里点名,
 *     不静默退化成"该桶为 0"。
 *
 * ── 用法 ──────────────────────────────────────────────────────────────
 *   node scripts/measure-i18n-ja-suspect-buckets.mjs              # 现读工作树磁盘面
 *   node scripts/measure-i18n-ja-suspect-buckets.mjs --json
 *   node scripts/measure-i18n-ja-suspect-buckets.mjs --limit 15   # 每桶明细打印条数
 *   node scripts/measure-i18n-ja-suspect-buckets.mjs --self-test
 *
 * ⚠️ 判读面默认是**工作树磁盘**(不是 HEAD):i18n 词包的改动往往还没落地,而本尺要量的是
 * **改完之后的语料**。要量某个 commit 用 `--source <rev>`(逐字从 `git show` 读,不读磁盘)。
 *
 * 退出码:0 = 量到了 / 1 = 判不出(表或转换器取不到)/ 2 = 用法错或脚本自身异常。
 *
 * ── 本尺自带的取证教训(改判据前先读这段)──────────────────────────────
 * 立这把尺时做过一轮变异取证,其中**第一版变异是自己错的**:
 * 想让 `inert` 桶失效,于是在 `buckets.inert.set(ch, [])` 之后插了一行 `if (true) continue` ——
 * 结果**自检 9/0 全绿、真语料读数一字未变**(59/15/5)。原因是 inert 收集走的是同一个 Map,
 * 后面照旧收齐,那行 `continue` 只是多跳过一次已经走过头的逻辑。
 * ⇒ **变异必须真改变输出,否则它什么都没证明**;发现读数没动时先怀疑变异本身,别急着说"判据有洞"。
 * 改成真变异(把 `toJp(ch) !== ch` 这个条件去掉,让双向都不变的字改走第二桶)后:
 * jpVariant **15 → 74**、inert **59 → 0**、自检 S1 翻红 ⇒ 这才是有效取证。
 * 另外两个有效变异:cnVariant 判定整条去掉(S3+S5 翻红)、`joyo.has(ch)` 跳过失效(S4 翻红)。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as OpenCC from 'opencc-js'

import { git } from './lib/bypass-git.mjs'
import { JOYO_FILE_REL, joyoSetFromRaw } from './lib/i18n-script-families.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
/** 七个语言包面(与 `lib/i18n-scan-targets.mjs` 的面同名;此处只列,判定由文件存在与否给出)。 */
export const FACES = [
  'web',
  'extension',
  'shared',
  'api',
  'cli',
  'miniapp-taro',
  'mobile-rn',
]
/** 日文面(本尺只审 ja —— 繁体残留的判据是 ja 特有的)。 */
export const JA = 'ja'

/** 三个桶的名字(**顺序即报告顺序**,从"最合法"到"最可疑")。 */
export const BUCKETS = {
  /** 双向都不变 ⇒ 日语固有汉字 / 日语新字体 / 专名。任何转换方向都动不了它们 ⇒ 合法。 */
  inert: '双向都不变(日语固有字/专名)',
  /** `tw→jp` 会变 ⇒ 日文旧字体或台湾繁体。多数仍正当(语言本名、角色名),少数可能是残留。 */
  jpVariant: 'tw→jp 变(日文旧字体/台湾繁体)',
  /** `cn→tw` 会变 ⇒ 唯一可疑桶。但里面**至少一半是必须保留的专名**。 */
  cnVariant: 'cn→tw 变(简体残留候选)',
}

/** 把 JSON 树里所有字符串叶子摊平(逐条带键路径,报告要能指名"哪个键")。 */
export function flattenStrings(obj, base = '$') {
  const out = []
  const walk = (v, p) => {
    if (typeof v === 'string') out.push({ path: p, value: v })
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`))
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`)
  }
  walk(obj, base)
  return out
}

/** 值内的汉字(纯码位判定 —— 族表 `han` 的实测口径:不依赖 opencc)。 */
const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/

/**
 * 三口径分桶(纯函数;`converters` 缺失时该桶为 `null`,**不静默当 0**)。
 * @param leaves `flattenStrings` 的产物
 * @param joyo   常用汉字表 Set
 * @param cv     `{ toTw, toJp }` 两个单字函数;缺一 ⇒ 对应桶为 null
 */
export function bucketize(leaves, joyo, cv) {
  const buckets = { inert: new Map(), jpVariant: new Map(), cnVariant: new Map() }
  const notes = []
  if (!cv || typeof cv.toTw !== 'function' || typeof cv.toJp !== 'function') {
    notes.push('opencc-js 转换器不可用 ⇒ jpVariant / cnVariant 两桶不判(null),只出 inert 桶')
  }
  let outTab = 0
  const outTabChars = new Set()
  for (const { path, value } of leaves) {
    for (const ch of String(value)) {
      if (!HAN_RE.test(ch)) continue
      if (ch.length > 1) continue // astral 字种不进常用表判定
      if (joyo.has(ch)) continue
      outTab += 1
      outTabChars.add(ch)
      const key = cv && typeof cv.toTw === 'function' && cv.toTw(ch) !== ch ? 'cnVariant' : null
      if (key) {
        if (!buckets[key].has(ch)) buckets[key].set(ch, [])
        buckets[key].get(ch).push(path)
        continue
      }
      if (cv && typeof cv.toJp === 'function' && cv.toJp(ch) !== ch) {
        if (!buckets.jpVariant.has(ch)) buckets.jpVariant.set(ch, [])
        buckets.jpVariant.get(ch).push(path)
        continue
      }
      if (!buckets.inert.has(ch)) buckets.inert.set(ch, [])
      buckets.inert.get(ch).push(path)
    }
  }
  if (!cv || typeof cv.toTw !== 'function') notes.push('cnVariant 桶未判(缺 cn→tw 转换器)')
  if (!cv || typeof cv.toJp !== 'function') notes.push('jpVariant 桶未判(缺 tw→jp 转换器)')
  return {
    outTabOccurrences: outTab,
    outTabChars: [...outTabChars],
    inert: buckets.inert,
    jpVariant: cv && typeof cv.toJp === 'function' ? buckets.jpVariant : null,
    cnVariant: cv && typeof cv.toTw === 'function' ? buckets.cnVariant : null,
    notes,
  }
}

/** 桶的字种数(桶为 null ⇒ null,不是 0)。 */
const sizeOf = (m) => (m === null ? null : m.size)

// ── 自检:合成词包夹具 ⇒ 确定性,不依赖真仓瞬时状态 ──
function selfTest(cv) {
  const results = []
  const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail })

  if (!cv) {
    console.error('❌ 自检需要 opencc-js 转换器(缺依赖 ⇒ 本尺不判,不是"零嫌疑")')
    return 1
  }

  // 夹具覆盖:日语固有表外字(双向不变)/ 台湾繁体(仅 tw→jp 变)/ 简体(仅 cn→tw 变)/ 表内字(不该出现)
  const FIX = {
    a: '智匯あり', // 智/匯 双向不变 ⇒ inert
    b: '繁體中文', // 體 tw->jp 变 ⇒ jpVariant
    c: '简体中文', // 简 cn->tw 变 ⇒ cnVariant(且它是**必须保留**的语言本名)
    d: '保存する', // 全部表内 ⇒ 任何桶都不该收
  }
  // 表内容纳全部**表内**字;智/匯/體/简 刻意**不入表** —— 它们就是要被量出来的表外字。
  const joyo = new Set([...'保存する日本語漢字仮名交差 amalgamation'])
  const leaves = flattenStrings(FIX)
  const r = bucketize(leaves, joyo, cv)

  ok(
    'S1 桶分类:双向不变 ⇒ inert(智/匯)',
    r.inert.has('智') && r.inert.has('匯') && !r.cnVariant.has('智') && !r.jpVariant.has('智'),
    `inert=${[...r.inert.keys()].join('')}`,
  )
  ok(
    'S2 桶分类:仅 tw→jp 变 ⇒ jpVariant(體)',
    r.jpVariant.has('體') && !r.cnVariant.has('體'),
    `jp=${[...r.jpVariant.keys()].join('')}`,
  )
  ok(
    'S3 桶分类:仅 cn→tw 变 ⇒ cnVariant(简)',
    r.cnVariant.has('简') && !r.jpVariant.has('简'),
    `cn=${[...r.cnVariant.keys()].join('')}`,
  )
  ok(
    'S4 表内字不进任何桶(保存/する 等)',
    !r.inert.has('保') && !r.jpVariant.has('保') && !r.cnVariant.has('保'),
    `inert=${[...r.inert.keys()].join('')}`,
  )
  ok(
    'S5 每个桶都必须带**键路径**(报告要能指名哪个键,不能只给字种)',
    r.cnVariant.get('简')?.every((p) => p.startsWith('$')) && r.cnVariant.get('简').length === 1,
    JSON.stringify(r.cnVariant.get('简')),
  )
  ok(
    'S6 表外计数两种口径都要给(处数 + 字种数 —— 原票面把两者混着引用过)',
    r.outTabOccurrences > r.outTabChars.length && r.outTabChars.length > 0,
    `occ=${r.outTabOccurrences} chars=${r.outTabChars.length}`,
  )
  ok(
    'S7 缺转换器 ⇒ 相应桶为 null 且 notes 点名(**不是 0**,不是静默)',
    (() => {
      const r2 = bucketize(leaves, joyo, { toTw: cv.toTw })
      return (
        r2.cnVariant !== null &&
        r2.jpVariant === null &&
        r2.inert !== null &&
        r2.notes.some((n) => n.includes('jpVariant')) &&
        sizeOf(r2.jpVariant) === null
      )
    })(),
    JSON.stringify(bucketize(leaves, joyo, { toTw: cv.toTw }).notes),
  )
  ok(
    'S8 空词包 ⇒ 三桶皆空、计数 0(量到了的 0,与"表取不到的 null"可区分)',
    (() => {
      const r3 = bucketize([], joyo, cv)
      return r3.outTabOccurrences === 0 && r3.outTabChars.length === 0 && r3.inert.size === 0
    })(),
  )
  ok(
    'S9 数组元素要带 [i] 下标(词包里有大量数组,只给 `$.a.b` 定位不到是同一种"报数不能定位")',
    flattenStrings({ r: ['x', 'y'] }).map((l) => l.path).join('|') === '$.r[0]|$.r[1]',
    flattenStrings({ r: ['x', 'y'] }).map((l) => l.path).join('|'),
  )

  const fail = results.filter((x) => !x.pass)
  for (const x of results)
    console.log(
      `  ${x.pass ? '✅' : '❌'} ${x.name}${x.detail && !x.pass ? ` —— ${x.detail}` : ''}`,
    )
  console.log(`\nja 嫌疑分桶自检:${results.length - fail.length} 通过 / ${fail.length} 失败`)
  return fail.length ? 1 : 0
}

const oneLine = (e) => String(e?.stderr ?? e?.message ?? e).split(/\r?\n/)[0].slice(0, 200)

/**
 * 两个单字转换器。**缺 opencc-js 时 `cv` 为 null 而不是抛** —— 本尺的纪律是"判不出就说判不出",
 * 而 `import` 失败在 ESM 顶层是**加载期**错误(unhandled rejection / ERR_MODULE_NOT_FOUND),
 * 根本走不到 `catch`;所以转换器构造只包 `Converter(...)` 那一步,依赖缺失靠 `--self-test` 与
 * 静态 import 的存在性交给人。同仓 5 处 `opencc-js` 用法(`scan-i18n-zh-residue` / `fix-zh-tw-residue` /
 * `apply-brand-glossary` / `deep-i18n-audit` / `fix-i18n-deep`)都是静态 import,本尺与它们同形。
 */
function loadConverters() {
  try {
    return {
      cv: {
        toTw: OpenCC.Converter({ from: 'cn', to: 'tw' }),
        toJp: OpenCC.Converter({ from: 'tw', to: 'jp' }),
      },
      why: null,
    }
  } catch (e) {
    return { cv: null, why: `转换器构造失败:${oneLine(e)}` }
  }
}

function main() {
  const argv = process.argv.slice(2)
  const allowed = new Set(['--json', '--self-test', '--source', '--limit'])
  const takesValue = new Set(['--source', '--limit'])
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) return fail2(`✗ 不接受位置参数 ${a}`)
    if (!allowed.has(a)) return fail2(`✗ 未知参数 ${a}(可用:--source <rev> / --limit <n> / --json / --self-test)`)
    if (takesValue.has(a)) i++
  }

  const { cv, why } = loadConverters()
  if (argv.includes('--self-test')) return selfTest(cv)

  let limit = 15
  const iLim = argv.indexOf('--limit')
  if (iLim >= 0) {
    const n = Number(argv[iLim + 1])
    if (Number.isInteger(n) && n >= 0) limit = n
    else return fail2(`✗ --limit 要非负整数,收到 ${JSON.stringify(argv[iLim + 1])}`)
  }
  const iSrc = argv.indexOf('--source')
  let source = null
  if (iSrc >= 0) {
    const raw = argv[iSrc + 1]
    if (typeof raw === 'string' && raw !== '' && !raw.startsWith('-')) source = raw
    else console.error(`ℹ 忽略无效的 --source 值:${JSON.stringify(raw)},已退回默认(工作树磁盘面)`)
  }

  // ── 表:优先读磁盘(与被审面同源由 source 决定),取不到 ⇒ 全部不判 ──
  const joyoPath = join(REPO_ROOT, JOYO_FILE_REL)
  let joyoRaw = null
  try {
    joyoRaw = source
      ? git(['show', `${source}:${JOYO_FILE_REL}`], { root: REPO_ROOT, raw: true, timeout: 60_000 })
      : readFileSync(joyoPath, 'utf8')
  } catch (e) {
    console.error(`❌ 常用汉字表取不到(${source ? source + ':' : ''}${JOYO_FILE_REL}):${oneLine(e)}`)
    console.error(`   ⇒ 本次不判(**不是"零嫌疑"**);表是判据输入,读不到就没有答案。`)
    return 1
  }
  const joyo = joyoSetFromRaw(joyoRaw)
  if (!joyo) {
    console.error(`❌ 常用汉字表解析不出(字数异常或形态不认识)⇒ 本次不判`)
    return 1
  }
  if (!cv) {
    console.error(`❌ ${why}`)
    console.error(`   ⇒ 两桶转换判定不判;只出 inert 桶。`)
  }

  // ── 七面词包:逐面独立读,读不到的面**报名**(不静默当零份)──
  const perFace = []
  const missing = []
  for (const f of FACES) {
    const rel = `packages/i18n/messages/${f}/${JA}.json`
    let text = null
    try {
      text = source ? git(['show', `${source}:${rel}`], { root: REPO_ROOT, raw: true, timeout: 120_000 }) : readFileSync(join(REPO_ROOT, rel), 'utf8')
    } catch {
      missing.push(rel)
      continue
    }
    let obj
    try {
      obj = JSON.parse(text)
    } catch (e) {
      perFace.push({ face: f, error: `JSON 解析失败:${oneLine(e)}` })
      continue
    }
    const leaves = flattenStrings(obj)
    const b = bucketize(leaves, joyo, cv)
    perFace.push({
      face: f,
      bytes: Buffer.byteLength(text, 'utf8'),
      stringLeaves: leaves.length,
      outTabOccurrences: b.outTabOccurrences,
      outTabChars: b.outTabChars.length,
      inert: sizeOf(b.inert),
      jpVariant: sizeOf(b.jpVariant),
      cnVariant: sizeOf(b.cnVariant),
      _maps: b,
    })
  }

  if (perFace.length === 0) {
    console.error(`❌ 七面 ${JA}.json 一份都读不到 ⇒ 本次不判`)
    return 1
  }

  // 全局面:三桶字符合并(同一字出现在两面只算一次 —— 报的是"多少种字形有问题")
  const union = { inert: new Set(), jpVariant: new Set(), cnVariant: new Set() }
  let occ = 0
  for (const p of perFace) {
    if (p.error) continue
    occ += p.outTabOccurrences
    for (const k of ['inert', 'jpVariant', 'cnVariant'])
      for (const ch of p._maps[k]?.keys() ?? []) union[k].add(ch)
  }

  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          source: source ?? '(工作树磁盘面)',
          joyoChars: joyo.size,
          converters: cv ? 'ok' : 'unavailable',
          missingFaces: missing,
          perFace: perFace.map((p) => {
            const { _maps, ...rest } = p
            return rest
          }),
          union: {
            occurrences: occ,
            inert: union.inert.size,
            jpVariant: union.jpVariant.size,
            cnVariant: union.cnVariant.size,
            inertChars: [...union.inert].join(''),
            jpVariantChars: [...union.jpVariant].join(''),
            cnVariantChars: [...union.cnVariant].join(''),
          },
        },
        null,
        2,
      ),
    )
    return cv ? 0 : 1
  }

  const face = source ?? '(工作树磁盘)'
  console.log(`被审面:${face} · 七面 ${JA}.json · 常用汉字表 ${joyo.size} 字 · 转换器:${cv ? 'ok' : '不可用'}`)
  console.log(
    `\n表外(现行 nonJoyoHan 口径)合计 **${occ} 处 / ${union.inert.size + union.jpVariant.size + union.cnVariant.size} 字种**`,
  )
  console.log(`\n面`.padEnd(16) + '表外处'.padEnd(10) + '表外字种'.padEnd(12) + 'inert'.padEnd(9) + 'jp变'.padEnd(9) + 'cn变')
  for (const p of perFace) {
    if (p.error) {
      console.log(p.face.padEnd(16) + `❌ ${p.error}`)
      continue
    }
    console.log(
      p.face.padEnd(16) +
        String(p.outTabOccurrences).padEnd(10) +
        String(p.outTabChars).padEnd(12) +
        String(p.inert).padEnd(9) +
        String(p.jpVariant ?? '未判').padEnd(9) +
        String(p.cnVariant ?? '未判'),
    )
  }
  if (missing.length) console.log(`\n⚠️ 读不到的面(不静默当零份):${missing.join(', ')}`)
  console.log(`\n── 全局三桶(字种去重)──`)
  console.log(`  ${BUCKETS.inert}: ${union.inert.size}`)
  console.log(`  ${BUCKETS.jpVariant}: ${union.jpVariant === undefined ? '未判' : union.jpVariant.size}`)
  console.log(`  ${BUCKETS.cnVariant}: ${union.cnVariant === undefined ? '未判' : union.cnVariant.size}`)
  console.log(`\n★ 只有第三桶(cn→tw 变)是残留候选,且其中**至少一半是必须保留的专名** ——`)
  console.log(`  任何"按转换方向筛"的口径都会在那些专名上误报;正解是按「是否专有/固有」分派。`)

  if (limit > 0) {
    const all = perFace.filter((p) => !p.error)
    for (const [k, label] of [
      ['cnVariant', 'cn→tw 变(逐条读:哪些是专名、哪些是真残留)'],
      ['jpVariant', 'tw→jp 变(多数正当:语言本名/角色名)'],
      ['inert', '双向都不变(合法,任何方向都动不了 —— 列出只为证明"它们不是病")'],
    ]) {
      const seen = new Map()
      for (const p of all)
        for (const [ch, paths] of p._maps[k] ?? []) {
          if (!seen.has(ch)) seen.set(ch, new Set())
          for (const x of paths) seen.get(ch).add(`${p.face} ${x}`)
        }
      console.log(`\n--- ${label}(${seen.size} 字种,打印前 ${Math.min(limit, seen.size)} 个)---`)
      for (const [ch, paths] of [...seen].slice(0, limit)) {
        const sample = [...paths][0]
        console.log(`  「${ch}」 ${seen.size ? '' : ''}示例 ${sample}${seen.get(ch).size > 1 ? ` (另 ${seen.get(ch).size - 1} 处)` : ''}`)
      }
    }
  }
  return cv ? 0 : 1
}

function fail2(msg) {
  console.error(msg)
  return 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    const code = main()
    if (code !== 0) process.exit(code)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { bucketize, flattenStrings, BUCKETS, FACES, JA, HAN_RE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
