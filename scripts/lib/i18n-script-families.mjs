// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n 语族(Unicode 码位族)判据的唯一源(2026-09-26 立,守门 `check-i18n-locale-content-language` 的第一消费者)。
 *
 * 为什么必须有这一层,而不是各门自己写区间:
 *   「哪段码位算哪一族」此前在仓内已散落 **4 份**且互不完整 ——
 *   `scan-i18n-zh-residue.mjs`(汉字 + 谚文)、`deep-i18n-audit.mjs`(假名 + 谚文,谚文上界还写成
 *   `D7A3` 而别处是 `D7AF`)、`i18n-diff.mjs`(汉字)、`check-desktop-cache-plaintext.mjs`(汉字)。
 *   四处都是**模块内常量且所在脚本顶层直接执行 `main()`**(无 §22d 守卫),所以结构上 import 不到 ——
 *   新门要么抄第 5 份,要么落到这里。本层选后者,并把"补齐 4 处的引用"列为后续票(见交付报告)。
 *
 * 三条设计约束(都由实测逼出,不是审美):
 *   1. **区间用数字写,不用 `\uXXXX` 字面量**。写盘工具会把 `\u3400` 解成真字符,
 *      而字符一旦落进字符类,顺序/代理对错误就变成 `SyntaxError` 或**静默的错区间**(本仓踩过)。
 *      数字写法的另一好处:判据可直接读数值做互斥性检查,不必解析正则。
 *   2. **族间必须两两不相交**,否则"某值属哪族"没有唯一答案。`rangesAreDisjoint()` 是本层的
 *      自证出口,由门的自检调用(相交即判死,不带着错表继续算结论)。
 *   3. **`・`(U+30FB)刻意不归入 kata**:它是中日通用的中黑点,zh-TW/zh-CN 的正文里就在用
 *      (如「A・B」)。归进去会让任何一个带中黑点的中文条目被判成"混入日文"——
 *      判据产出的第一个红必须是真红,否则门在第一台机器上就被读成噪音。同理 U+303x 系列标点、
 *      U+FF61–FF65(半角标点)一律留作 neutral。
 *
 * 汉字族内部的简繁之分**不在本层能力内**(这是诚实边界,不是偷懒):
 *   「對/対/對」这类字形差异里,大量日本新字体与中国简化字**同码位**(気・会・図・点・写・台 …),
 *   所以"检测到汉字"既不能判 zh-TW 红也不能判 ja 红。仓内已有的两把尺子都是**表驱动**而非码位驱动:
 *   `opencc-js` 做简↔繁字形转换、`scripts/joyo-kanji.json` 给 2010 版常用汉字 2136 字。
 *   本层只提供 `loadJoyoSet()` / `nonJoyoHan()` 这两个取表出口,判读逻辑留给调用方
 *   —— 因为"非表内汉字"算不算违规,取决于审的是哪种 locale,那是业务判据不是码位事实。
 */

/**
 * 码位族区间表(闭区间 [起, 止],含端)。
 * 命名即族名;`kana` 不是族而是 `hira ∪ kata` 的派生别名(见 KANA_FAMILIES)。
 */
export const SCRIPT_RANGES = {
  han: [
    [0x3400, 0x4dbf], // CJK 扩展 A
    [0x4e00, 0x9fff], // CJK 统一表意文字(简繁同族,本层不分)
    [0xf900, 0xfaff], // CJK 兼容表意文字
    [0x20000, 0x2a6df], // CJK 扩展 B
    [0x2f800, 0x2fa1f], // CJK 兼容表意文字补充
  ],
  hira: [
    [0x3040, 0x309f], // 平假名 + 浊音符号 + U+309F 迭代记号
    [0x1b150, 0x1b16f], // 假名扩展 B(小写假名)。**刻意不含 U+1B100–1B12F** —— 那是假名扩展 A(片假形),
    // 早先把它写进 hira 会让两族区间订交,本文件的 `rangesAreDisjoint()` 上线首跑就判红了这一条。
  ],
  kata: [
    [0x30a0, 0x30fa], // 片假名(U+30A0 叠字记号 ~ U+30FA ヺ)
    [0x30fc, 0x30ff], // U+30FC 长音符起;**U+30FB「・」刻意排除**(中日通用中黑点)
    [0xff66, 0xff9d], // 半角片假名(U+FF61–FF65 半角标点在区间外)
    [0x1b100, 0x1b12f], // 假名扩展 A(阿伊努用追加片假名)
  ],
  hangul: [
    [0x1100, 0x11ff], // 谚文字母 + 扩展 A
    [0x3130, 0x318f], // 谚文兼容字母
    [0xa960, 0xa97f], // 谚文字母扩展 B
    [0xac00, 0xd7a3], // 谚文音节
    [0xd7b0, 0xd7c6], // 谚文字母扩展 C(仅字母段;D7F0–D7FB 的谚文标点不计)
  ],
  latin: [
    [0x0041, 0x005a], // A-Z
    [0x0061, 0x007a], // a-z
    [0x00c0, 0x024f], // Latin-1 补充 + 扩展 A/B(不含 IPA,够用且远离 CJK)
    [0x1e00, 0x1eff], // Latin 扩展附加
  ],
}

/** 假名 = 平假名 ∪ 片假名(判"混入日语"用这一族,而不是分别判) */
export const KANA_FAMILIES = ['hira', 'kata']
/** 汉字族名(简繁不分,见文件头第 3 条) */
export const HAN_FAMILY = 'han'
export const FAMILY_NAMES = Object.keys(SCRIPT_RANGES)

/** 由若干族的区间表拼一个字符类(u 旗标必须带:扩展 B 是 astral 平面,非 u 模式会 Range out of order) */
function buildClass(families) {
  const body = families
    .flatMap((f) => SCRIPT_RANGES[f])
    .map(([lo, hi]) => `${String.fromCodePoint(lo)}-${String.fromCodePoint(hi)}`)
    .join('')
  return new RegExp(`[${body}]`, 'u')
}

/** 由区间表编译一个字符类正则(u 旗标必须带:扩展 B 是 astral 平面,非 u 模式会 Range out of order) */
export function classFromRanges(pairs) {
  const body = pairs
    .map(([lo, hi]) => `${String.fromCodePoint(lo)}-${String.fromCodePoint(hi)}`)
    .join('')
  return new RegExp(`[${body}]`, 'u')
}

/** 逐族正则(惰性编译一次;导出是为了镜像测试能直接断言区间落进了正则) */
let _compiled = null
export function familyRe() {
  if (!_compiled) {
    _compiled = new Map()
    for (const f of FAMILY_NAMES) _compiled.set(f, classFromRanges(SCRIPT_RANGES[f]))
  }
  return _compiled
}

/** 单字符归族:命中的族名数组(设计上至多 1 个 —— 相交由 rangesAreDisjoint 兜住) */
export function charFamilies(ch) {
  const out = []
  for (const [f, re] of familyRe()) if (re.test(ch)) out.push(f)
  return out
}

/**
 * 全族合并正则(快路径)。注意 latin 也是一族,所以"纯英文文案"**不会**被这条快路径跳过 ——
 * 它跳掉的是纯数字 / 纯标点 / 纯占位符那类无族可判的值。真正给 L1 省时间的是下面那把
 * `anyCjkFamilyRe()`(han ∪ hira ∪ kata ∪ hangul):跨族矛盾只在 CJK 四族之间发生,
 * 而真仓语言包 ~7 万条叶子里大半是 `{var}`、URL、数字、纯英文术语。
 */
let _anyRe = null
export function anyFamilyRe() {
  if (!_anyRe) _anyRe = buildClass(FAMILY_NAMES)
  return _anyRe
}
/** 该值是否含任一族字符(false ⇒ familiesIn 必为空,可整条跳过) */
export function hasAnyFamily(text) {
  return anyFamilyRe().test(String(text))
}

let _anyCjkRe = null
/** CJK 四族(han/hira/kata/hangul)合并正则 —— L1 逐字符判定的快路径 */
export function anyCjkFamilyRe() {
  if (!_anyCjkRe) _anyCjkRe = buildClass(FAMILY_NAMES.filter((f) => f !== 'latin'))
  return _anyCjkRe
}
/** 该值是否含任一 CJK 族字符(false ⇒ 本门的跨族判据可直接跳过该值) */
export function hasAnyCjkFamily(text) {
  return anyCjkFamilyRe().test(String(text))
}

/** 值内出现的族集合(中性字符如数字/标点/占位符不产生族) */
export function familiesIn(text) {
  const s = String(text)
  if (!hasAnyFamily(s)) return []
  const hit = new Set()
  for (const ch of s) for (const f of charFamilies(ch)) hit.add(f)
  return [...hit].sort()
}

/** 逐族字符数(块级聚合用;同一字符多次出现按次数计) */
export function countFamilies(text) {
  const c = new Map(FAMILY_NAMES.map((f) => [f, 0]))
  const s = String(text)
  if (!hasAnyFamily(s)) return c
  for (const ch of s) for (const f of charFamilies(ch)) c.set(f, (c.get(f) || 0) + 1)
  return c
}

/** 是否含假名(平/片任一)。整串 test 而不是逐字符 —— 一次全量要问 7 万次,这是热路径。 */
let _kanaRe = null
export function kanaRe() {
  if (!_kanaRe) _kanaRe = buildClass(KANA_FAMILIES)
  return _kanaRe
}
export function hasKana(text) {
  return kanaRe().test(String(text))
}
export function hasHangul(text) {
  return familyRe().get('hangul').test(String(text))
}
export function hasHan(text) {
  return familyRe().get('han').test(String(text))
}
/** 含任一"东亚表意/音节/假名"族(用于把纯拉丁/纯数字的值判成"无族可判") */
export function hasCjkFamily(text) {
  return hasAnyCjkFamily(text)
}

/**
 * 区间互斥性自检(纯函数,可对任意表调用 —— 门的自检用它证明"哪段码位算哪族"有唯一答案)。
 * @returns {{ok:boolean, overlaps:string[]}}
 */
export function rangesAreDisjoint(table = SCRIPT_RANGES) {
  const all = []
  for (const [fam, pairs] of Object.entries(table))
    for (const [lo, hi] of pairs) all.push({ fam, lo, hi })
  const overlaps = []
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]
      const b = all[j]
      if (a.fam === b.fam) continue
      if (a.lo <= b.hi && b.lo <= a.hi)
        overlaps.push(
          `${a.fam}[${a.lo.toString(16)}-${a.hi.toString(16)}] ∩ ${b.fam}[${b.lo.toString(16)}-${b.hi.toString(16)}]`,
        )
    }
    const s = all[i]
    if (s.lo > s.hi) overlaps.push(`${s.fam} 区间反了:${s.lo.toString(16)} > ${s.hi.toString(16)}`)
  }
  return { ok: overlaps.length === 0, overlaps }
}

export const JOYO_FILE_REL = 'scripts/joyo-kanji.json'

/**
 * 取常用汉字表(2010 版 2136 字)。取不到 / 字数异常 ⇒ **null**(调用方必须判"未判定",
 * 不得把"表没读到"读成"这个字不在表内"—— 那会让整块内容凭空被判红,与 §5d"读不到被下游
 * 报成失效"同族)。
 *
 * 真仓 `scripts/joyo-kanji.json` 的 `chars` 是**一个长字符串**(「亜哀挨愛…」)而不是数组,
 * 另带 `codepoints` 数值数组 —— 两种形态都要认(优先 codepoints:数值不受文件编码往返影响)。
 * 这里刻意写得宽容而调用方判得保守:解出来的字数 < min 一律 null,不返回"半张表"。
 */
export function joyoSetFromRaw(raw, { min = 2000 } = {}) {
  let obj = null
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const fromCodepoints = Array.isArray(obj.codepoints)
    ? obj.codepoints
        .filter((n) => Number.isInteger(n) && n > 0 && n <= 0x10ffff)
        .map((n) => String.fromCodePoint(n))
    : null
  const chars = obj.chars
  const fromChars =
    typeof chars === 'string'
      ? [...chars]
      : Array.isArray(chars)
        ? chars.filter((c) => typeof c === 'string' && [...c].length === 1)
        : null
  const pool =
    fromCodepoints && fromCodepoints.length >= (fromChars ? fromChars.length : 0)
      ? fromCodepoints
      : fromChars
  if (!pool) return null
  const set = new Set(pool)
  if (set.size < min) return null
  return set
}

/** 值内的"非日本常用汉字"字种(用于把"整块汉字"进一步判成"那是中文不是日语") */
export function nonJoyoHan(text, joyo) {
  if (!joyo) return null // 未判定,不是"没有嫌疑"
  const han = familyRe().get('han')
  const out = new Set()
  for (const ch of String(text)) {
    if (!han.test(ch)) continue
    if (ch.length > 1) continue // astral 平面字种不在 2136 表内,方向上按"跳过"处理(不误报)
    if (!joyo.has(ch)) out.add(ch)
  }
  return [...out].join('')
}
