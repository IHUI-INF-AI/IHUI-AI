#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 竞品对话流清单 ↔ 我方语言包/源码 逐条对账器（一次性取证工具，不在提交链）。
 *
 * 为什么不是"读一遍清单然后写结论"：本次要处理 1,370 行条目，人读完必然漏；
 * 而漏的部分会以"我方没有"的形态写进台账，那比空白更贵（本仓把"把没判写成判过了"列为最高频失效型）。
 *
 * 四态口径（**绝不并桶**，尤其不得把 undetermined 写成 missing）：
 *   L1 verbatim   竞品原文与我方 value 逐字等值（去空白后）
 *   L2 near       字符二元组 Jaccard ≥ 0.5（中文按字切，前缀/分词在中文里会漏——本仓 merge-live-doc 同一条教训）
 *   L3 keyonly    原文不同形、但有同能力证据 ⇒ 只能算"需人工核"，不算命中也不算缺失。两条来源：
 *                 ① 键末段同名 ∧ 该键的值与竞品原文互为词头（`composer…edit`="编辑此消息" vs 我方 `…edit`="编辑"）
 *                    **∧ 宾语落点（G-802）**：末段是通用动作词（open/close/copy/delete/send/select/expand）时，
 *                    还须我方语料里有"同一宾语的该动作"或"该宾语是我方被管理对象"，否则不算同能力证据 ——
 *                    通用动词单独出现的词头巧合曾把 7 条真缺失静默洗出 MISS（账面变好而信号变少）；
 *                 ② 子串同形（一方文案整段出现在另一方里）。
 *                 ⚠️ 刻意**不**收"只末段同名"这一条 —— 实测它会一次放过 103/459 条真缺失。
 *   MISS          三面都没抓到 ⇒ 候选缺失，仍须人工判"是真没有"还是"我方另起一名"
 *
 * 控制测量（先于一切结论）：拿我方自己的一条真实原文喂 L1 与 L2，两边都必须命中；
 * 不成立就直接退出 —— 那说明匹配器坏了，此时任何 MISS 计数都是噪声（本仓"一次性量尺的三种静默失明
 * 全表现为 0 处"那一型）。
 *
 * 用法: node reconcile.mjs <清单.md> [--section "附录 D"] [--out <逐条导出件.md>]
 * 自检: node reconcile.mjs --self-test        （构造面用例，不依赖仓库瞬时状态）
 *
 * 本器**刻意不进提交链**：它判的是"文档清单 ↔ 代码文案"的一致性，与某一次提交改了什么无关，
 * 挂进钩子就是一台与任何提交都无关的恒红门。问责方式 = 手动跑上面两条命令。
 *
 * 引用本目录产物时的两条口径（D167）：
 *   ① 族级聚合只在"该族行都归上族"时可用；行内落 `(未判定)` 的行不参与族级计数，
 *      导出件抬头会印一行告警 —— 没有那一行才允许引用"N 处"。
 *   ② skip 明细按原因逐条报数（控制台与导出件抬头都有），"被摘掉多少条、为什么摘"必须可见；
 *      静默变短等于伪造完整性。
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true }).trim()
const argv = process.argv.slice(2)
const SELF_TEST = argv.includes('--self-test')
const LIST = argv[0]
if (!SELF_TEST && (!LIST || !fs.existsSync(LIST))) {
  console.error('用法: reconcile.mjs <清单.md> [--section 名称]')
  process.exit(2)
}
const secIdx = argv.indexOf('--section')
const SEC = secIdx > 0 ? argv[secIdx + 1] : null

// —— 我方语料：zh-CN 语言包展平（web 主面包 + shared 包） ——
function flatten(obj, prefix, acc) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') {
      const t = normText(v)
      if (!t) continue
      // 末段词头索引必须看**每一个叶子**，不能只看"该文本的首个键"：若 `编辑` 先落在 `x.save` 上，
      // 后面的 `y.edit` 就会被文本去重跳过 ⇒ 段 `edit` 永远收不到这个词头，
      // 本条判据恰好在它要救的那一型上失明（"判据必须覆盖门自己产出的形态"同族）。
      if (t.length >= 2 && /[㐀-鿿]/.test(t)) {
        const seg = key.split('.').pop().toLowerCase()
        if (!ourSegs.has(seg)) ourSegs.set(seg, [])
        ourSegs.get(seg).push([key, t])
      }
      if (!acc.has(t)) { acc.set(t, key); orig.set(t, v) }
    } else if (v && typeof v === 'object') flatten(v, key, acc)
  }
  return acc
}
function normText(s) {
  return String(s).replace(/\s+/g, '').replace(/[，。、：；！？「」『』“”‘’（）()【】\[\]<>*_·—\-]/g, '').toLowerCase()
}
const our = new Map() // 归一化文本 -> 我方键（可能多键，取首个）
const orig = new Map() // 归一化文本 -> 原始 value：控制测量必须喂真实原文，喂键名会得到假阴性
const ourPairs = [] // [归一文本, 原始 value, key]
// D167 步 4 的判据底座：**按键路径末段**建的我方词头索引（seg -> [[键, 归一值], …]）。
// 为什么必须是"同一个键的两条证据"而不是两条独立巧合：先实测过"末段同名(不看值)"会一次放过 103/459 条
// ——`title`/`label`/`open` 这类通用段名与我方上千个键撞名，把真缺失整片洗出 MISS 名单，
// 那是"为数字好看放宽判据"（本票禁止）。所以这里只收"末段同名 ∧ 该键自己的值是词头"这一条联合证据。
const ourSegs = new Map()
for (const f of ['packages/i18n/messages/web/zh-CN.json', 'packages/i18n/messages/shared/zh-CN.json']) {
  // 取材面 = 被审面(HEAD)，与下面源码字面量那一侧同形。
  // 按磁盘读语言包会把"HEAD 有、工作树还滞后"的文案算进我方语料 ⇒ 真差距被洗成 L1；
  // 反过来别人正在改的行会临时混进语料 ⇒ 同一份清单两次跑出不同结论(本仓"两处算同一件事必漂移"同族)。
  let text = null
  try {
    text = execFileSync('git', ['-C', ROOT, 'show', `HEAD:${f}`], { encoding: 'utf8', maxBuffer: 64e6, windowsHide: true })
  } catch {
    console.log(`⚠️ 我方语料取不到(HEAD 面): ${f}（该面不计入，会抬高 MISS）`)
    continue
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    console.error(`❌ 语言包解析失败 ${f}: ${e?.message ?? e} ⇒ 语料不完整，拒绝出结论`)
    process.exit(2)
  }
  const acc = flatten(parsed, '', new Map())
  for (const [t, k] of acc) if (!our.has(t)) { our.set(t, k); ourPairs.push([t, k, orig.get(t) || '']) }
}
// 源码内不走 i18n 的中文字面量（对标附录 C）。
// ⚠️ 口径必须是被审面(HEAD)而不是工作树：本机共享工作树常年滞后，按磁盘扫会把
// "HEAD 有、工作树还没同步"的文案误判成 MISS —— 那是把量具的失效写成仓库的缺陷（本仓同一型记过多次）。
// 也不能用 `git grep -E "\p{Han}"`：git grep 走 POSIX ERE，不认 \p{Han}，会**静默返回空**而不是报错。
const srcZh = new Set()
{
  let files = []
  try {
    // 必须 -C ROOT：否则从子目录跑时 `-- apps/web/src` 会按当前目录解析 ⇒ 静默拿到 0 个文件
    files = execFileSync('git', ['-C', ROOT, 'ls-tree', '-r', '--name-only', 'HEAD', '--', 'apps/web/src', 'packages/shared/src'], { encoding: 'utf8', maxBuffer: 64e6, windowsHide: true })
      .split('\n').filter((f) => /\.(ts|tsx)$/.test(f))
  } catch { console.log('⚠️ HEAD 文件清单取不到 ⇒ 附录 C 只能靠语言包判，其 MISS 数不得引用') }
  if (!files.length) {
    console.error('❌ HEAD 面 .ts/.tsx 清单为 0 ⇒ 源码面无从取证，拒绝出 MISS 结论（空枚举不是"没有中文文案"）')
    process.exit(2)
  }
  let out = ''
  if (files.length) {
    try {
      out = execFileSync('git', ['-C', ROOT, 'cat-file', '--batch'], { input: files.map((f) => `HEAD:${f}`).join('\n') + '\n', encoding: 'utf8', maxBuffer: 768e6, windowsHide: true })
    } catch { console.log('⚠️ HEAD 面批量读失败 ⇒ 附录 C 的 MISS 不得引用（量具失效不是仓库缺陷）') }
  }
  for (const m of out.matchAll(/["'`]([^"'`\n]{1,80})["'`]/g)) {
    if (!/[㐀-鿿豈-﫿]/.test(m[1])) continue // 码位范围；\p{Han} 在字符类内需 v 旗标，u 模式会抛
    const t = normText(m[1])
    if (t.length >= 2) srcZh.add(t)
  }
  console.log(`HEAD 面源码中文字面量: ${srcZh.size} 条（${files.length} 个 .ts/.tsx）`)
  if (!srcZh.size && files.length) {
    console.error('❌ 源码面抓到 0 条 ⇒ 判附录 C 无资格，拒绝出 MISS 结论')
    process.exit(2)
  }
}

// 被审语料的全部归一化文案（语言包叶子 + 源码中文字面量）——"宾语落点"只在这上面判，
// 与 L1/L2 用的是同一份面（HEAD），不得另按磁盘取一份（本仓"两处算同一件事必漂移"同族）。
let landingPool = null
function corpusStrings() {
  if (!landingPool) landingPool = [...new Set([...ourPairs.map((p) => p[0]), ...srcZh])]
  return landingPool
}
function bigrams(s) {
  const a = []
  for (let i = 0; i < s.length - 1; i++) a.push(s.slice(i, i + 2))
  return a
}
function jaccard(s1, s2) {
  const A = new Set(bigrams(s1)), B = new Set(bigrams(s2))
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / new Set([...A, ...B]).size
}

// —— D167 步 2：值层判据（"是否含 CJK 且非纯枚举"），键名启发式退为第二道 ——
// 为什么主筛必须看**值本身**：键名启发式只认"键恰好叫 className / backgroundColor"那一型，
// 而清单里 `dir:"ltr"`、`phase:"idle"`、`variant:"ghost"`、`text-[13px]` 这些键名朴素、值却是样式/枚举的行
// 全部从它指缝里漏过去，一路进 MISS（票面第②条实测漏下 27 条）。
const CJK_RE = /[㐀-鿿ヰ-ヿ가-힯]/
const HEX_RE = /^#[0-9a-f]{3,8}$/i
const STYLE_FN_RE = /^(?:var|calc|rgba?|hsla?|clamp|min|max|translate[xy]?|rotate|scale)[^()]*\([^)]*\)$/i
const UNIT_NUM_RE = /^[+-]?(?:\d+(?:\.\d+)?(?:px|rem|em|rpx|vh|vw|pt|dp|ms|s)?|0)$/
const ARB_RE = /^[a-z][a-z0-9-]*\[[^\]]*\]$/i
// 分隔符集合含 `.`（清单实测 `className:"size-3.5"`、`className:"mr-2"` 这类小数档 Tailwind 类名），
// 但首字符必须是 ASCII 字母 ⇒ 含汉字的真串（`已超时 48h`）永远进不了这一条，由 CJK 守卫再挡一道。
const ENUM_WORD_RE = /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/i
function enumToken(p) {
  return HEX_RE.test(p) || STYLE_FN_RE.test(p) || UNIT_NUM_RE.test(p) || ARB_RE.test(p) || ENUM_WORD_RE.test(p)
}
/**
 * 整串是不是"纯样式/枚举值"（不是用户看得见的文案）。判据只看**值本身**的形状：
 * 按 `:` `/` `,` 拆段，每一段都必须落进样式/枚举词法（`#hex`/`var()`/`Npx`/`x-[y]`/单个 ASCII 词）。
 * 三条刻意的窄口径，各有一条反向对照钉着（见 ST5）：
 *  - **含任一汉字即 false**（硬要求⑥的那道闸）。这道不是摆设：`content-['提交']`、`w-[图标]` 这类
 *    带方括号/函数的样式串，词法本身是放得进去的（`\[[^\]]*\]` 不限内容），全靠这道把"里面有中文"的串
 *    挡回来 —— 实测现读五节里 0 条命中该形状，但删掉它就不只是换个标签，而是给"中文写在样式串里"
 *    那一型开了口子，所以留着并由 ST5 的正向对照钉死。
 *  - 不设"带空格即散文"那道守卫：它会把 `grid-cols-[1fr 2fr]` 这类确实是样式的值错分进"非中文"档，
 *    而多词散文本来就过不了词法（空格不在任何词法里）；实测删除后产物读数一字不变（变异 M2）。
 *  - `Ctrl+Shift+P` 这类键位串整段过不了词法（`+` 不在里面）⇒ 由"非中文原文"那一档处理，不冒充枚举。
 */
export function isPureEnumOrStyle(raw) {
  const s = String(raw ?? '').trim().replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim()
  if (!s || CJK_RE.test(s)) return false
  const parts = s.split(/[:/,]/).map((x) => x.trim()).filter(Boolean)
  return parts.length > 0 && parts.every(enumToken)
}
/**
 * D167 步 4 的否证判据：同一个我方键，路径末段与竞品键末段同名，且该键的值与竞品原文**互为词头**。
 * 票面那一例：竞品 `composer.referencePreview.edit` = "编辑此消息"，我方 `….edit` = "编辑" ——
 * 同能力、不同文案，字符 Jaccard 必然不中，但它**不是差距**，所以落 L3（需人工核），既不算命中也不算缺失。
 * 窄在两处，缺一即会拿通用段名（title/label/open）把真缺失整片洗白：
 * ① 证据必须落在**同一个键**上（实测"末段同名而不看值"放过 103/459 条，本票禁止这种放宽）；
 * ② 词头长度上界 6 字，更长的形态本就该由 L1/L2 收，不该在这一档混过去。
 */
/**
 * G-802 的**宾语落点约束**（只收紧、不放宽）：末段是通用动作词时，"同能力证据"必须另有宾语落点。
 *
 * 立因：`ourStemForSegment` 原先只验「末段同名 ∧ 该键的值与原文互为词头」，而 `open/close/copy/delete/
 * send/select/expand` 这族动词在**任何**域都会撞名 —— 实测 7 条"我方根本没有这个宾语能力"的键
 * （速记板/任务回顾/发送预览/示例能力）就这样被词头巧合从 MISS 里摘走，账面读数变小而真信号变少。
 *
 * 两臂判据（任一成立才算宾语落了地）：
 *  ① 动宾同现 —— 我方有某条文案同时含该动词与该宾语（`关闭` + `标签页` ⇒「关闭标签页」在册）；
 *  ② 宾语是我方在册的**被管理对象** —— 该宾语与任一"建/销"类动作同串出现（`动态`⇒「删除动态」），
 *     说明这个宾语在我方是要被增删的对象，而不是碰巧出现在别的动作里的词素。
 * ②刻意**不**收"与任一动词同串"：`预览` 在语料里与 打开/关闭/复制/选择/编辑 全同现（它是别处的
 * 受事），收了就等于把 `发送预览` 又洗回 L3 —— 只有"建/销"这一类才证明宾语是一门在册对象。
 * 剥噪（指示词/数量词前缀、通用尾名词）只用于把 `此消息→消息`、`动态操作→动态` 这类同一宾语救回来，
 * 不引入新宾语；剥完为空 ⇒ 原文除了动作词没别的内容 ⇒ 算落地（这条不是豁免，是"无宾语可判"）。
 *
 * `pool` 是注入参数而不是内部读语料：自检必须能用**构造面**判这条判据（不拿仓库瞬时状态当恒定前提）。
 */
const GENERIC_ACTION_SEGS = new Set(['open', 'close', 'copy', 'delete', 'send', 'select', 'expand'])
const MANAGED_ACTION_WORDS = ['删除', '新增', '添加', '新建', '创建']
const RESIDUE_NOISE_PREFIX = /^(此|该|这|那|本|一条|一个|一项|当前|所选)/
const RESIDUE_NOISE_SUFFIX = /(文档|文件|操作|内容|列表|条目|页面)$/
/** 从竞品原文里剥出宾语：去掉动词词头、占位符，再给"指示词/通用尾名词"各一个剥噪臂。 */
export function residueForms(text, verbValue) {
  const raw = String(text || '').split(String(verbValue || '')).join('').replace(/\{\{?[^}]*\}?\}?/g, '')
  const forms = []
  for (const x of [raw, raw.replace(RESIDUE_NOISE_PREFIX, ''), raw.replace(RESIDUE_NOISE_SUFFIX, '')]) {
    if (x.length >= 2 && !forms.includes(x)) forms.push(x)
  }
  return { raw, forms }
}
const fpCache = new Map() // `${宾语}\u0000${动词}` -> 结论：同一份宾语被上千行复用，不缓存会把这趟跑成分钟级
export function objectFootprintOk(text, verbValue, pool) {
  const v = String(verbValue || '')
  const { raw, forms } = residueForms(text, v)
  if (!raw) return { ok: true, why: '无宾语(整条文案就是动作词本身)' }
  if (!forms.length) return { ok: true, why: `宾语剥噪后不足两字(${raw})` }
  for (const r of forms) {
    const ck = `${r}\u0000${v}`
    let hit = fpCache.get(ck)
    if (!hit) {
      const same = pool.find((s) => s.includes(v) && s.includes(r))
      const managed = same ? null : pool.find((s) => s.includes(r) && MANAGED_ACTION_WORDS.some((w) => s.includes(w)))
      hit = same ? { ok: true, why: `动宾同现「${r}」⇒${same.slice(0, 24)}` }
        : managed ? { ok: true, why: `宾语系我方被管理对象「${r}」⇒${managed.slice(0, 24)}` }
          : { ok: false, why: `宾语零落点(${forms.join('/')})` }
      fpCache.set(ck, hit)
    }
    if (hit.ok) return hit
  }
  return { ok: false, why: `宾语零落点(${forms.join('/')})` }
}
/**
 * 旧口径（只验末段同名 + 词头同形，**不看宾语**）——只给自检当"这条今天确实会被摘掉"的有牙证明用，
 * 判定链一律不调它。把它接回 `matchOne` 就是 G-802 复现。
 */
export function stemIgnoringFootprint(keyName, t) {
  if (!t) return null
  const seg = String(keyName || '').split('.').pop().toLowerCase()
  const list = ourSegs.get(seg)
  if (!list) return null
  for (const [k, v] of list) {
    if (v === t || v.length > 6) continue
    if (t.startsWith(v) || v.startsWith(t)) return [k, v]
  }
  return null
}
export function ourStemForSegment(keyName, t, pool = corpusStrings()) {
  if (!t) return null
  const seg = String(keyName || '').split('.').pop()
  if (!seg) return null
  const list = ourSegs.get(seg.toLowerCase())
  if (!list) return null
  const generic = GENERIC_ACTION_SEGS.has(seg.toLowerCase())
  for (const [k, v] of list) {
    if (v === t || v.length > 6) continue
    if (t.startsWith(v) || v.startsWith(t)) {
      // G-802：通用动词那一跳必须另有宾语落点；非通用末段（edit/hide/pin…）本身已带语义，口径不变。
      if (generic && t.startsWith(v) && !objectFootprintOk(t, v, pool).ok) continue
      return [k, v]
    }
  }
  return null
}

// skip 的原因必须**逐档报名**（"被摘掉多少条、为什么摘"读得出来，才谈得上复核）；
// 计数一律由判定结果事后归集，不在 matchOne 里加副作用 —— 同一份判定若被跑两遍，
// 副作用式计数就会翻倍，而"翻倍的分母"正是下一轮解释不了的差额（本仓"两处算同一件事必漂移"同族）。
function skip(why) { return { state: 'skip', why } }

function matchOne(text, keyName) {
  const t = normText(text)
  if (!t) return skip('原文为空或纯符号')
  // 值层主筛(D167 步 2)：纯样式/枚举值不是文案，摘在匹配之前 —— 这一道不看键名，所以键名朴素
  // 而值是样式的那一整族(`dir:"ltr"`/`phase:"idle"`/`variant:"ghost"`)第一次被真正拦住。
  if (isPureEnumOrStyle(text)) return skip('枚举/样式值非文案(值层主筛)')
  // 第二道：键名启发式。**必须排在"非中文"那道之前**，否则它结构上永远跑不到
  // (前面已经要求值含汉字，而它自己又要求值不含汉字 ⇒ 恒假的死支路 —— 第一版就犯了这个错，
  //  是变异测试"摘掉值层主筛后第二道应接住"没翻红才暴露的)。它只兜"值层词法没覆盖到的样式值"，
  //  绝不兜含汉字的串 —— 那条 `!CJK_RE.test(text)` 就是硬要求⑥(真文案不得被放过)在这道闸上的体现。
  const kn = String(keyName || '')
  if (/className|backgroundColor|color:|textDecoration|font[A-Z]|border|padding|margin|display|flex|overflow|position|cursor|transition|animation/i.test(kn)
      && !CJK_RE.test(text)) return skip('样式键名非文案(第二道)')
  // 非中文原文(键位 Ctrl+Shift+P、代码、英文散文)不进"这条中文我方有没有"这一维。
  // 必须摘在匹配之前 —— 实测 `Ctrl+Shift+P` 会被 Jaccard 判成 L2，那比 MISS 更糟：
  // MISS 是"没找到"，L2 是"找到了"，量具在此替我方发了合格证(本仓"把没判写成判过了"同型)。
  if (!CJK_RE.test(String(text))) return skip('非中文原文(不计 MISS，只报数)')
  if (our.has(t)) return { state: 'L1', where: our.get(t) }
  if (srcZh.has(t)) return { state: 'L1', where: '源码字面量' }
  let best = null
  for (const [ot, ok] of ourPairs) {
    const j = jaccard(t, ot)
    if (j >= 0.5 && (!best || j > best.j)) best = { j, ok }
  }
  if (best) return { state: 'L2', where: `${best.ok} (J=${best.j.toFixed(2)})` }
  const stem = ourStemForSegment(keyName, t)
  if (stem) {
    // 命中理由要能复核：通用动词那一跳到底是靠哪条宾语落点算"同能力"的，直接印在导出件里。
    const sSeg = String(keyName || '').split('.').pop().toLowerCase()
    const fp = GENERIC_ACTION_SEGS.has(sSeg) && t.startsWith(stem[1]) ? objectFootprintOk(t, stem[1], corpusStrings()) : null
    return { state: 'L3', where: `键末段同名+词头同形:我方 ${stem[0]}=「${stem[1]}」${fp ? ` · ${fp.why}` : ''}` }
  }
  // L2b 实词包含：竞品串常带占位符/限定语而更长，逐字与 Jaccard 都会漏。
  // 只判成「需人工核」而不是命中 —— 形似不等于等同，把子串当命中会造出假"我方已有"。
  if (t.length >= 4) {
    for (const [ot, ok] of ourPairs) {
      if (ot.length < 3) continue
      if (t.includes(ot) || ot.includes(t)) return { state: 'L3', where: `子串同形:${ok}` }
    }
  }
  return { state: 'MISS' }
}

// —— 控制测量：匹配器必须先证明自己能打中 ——
{
  const probeKey = ourPairs[Math.floor(ourPairs.length / 2)]
  if (!probeKey) { console.error('❌ 我方语料为空 ⇒ 无资格判 MISS'); process.exit(2) }
  const raw = String(probeKey[2] || probeKey[0]) // 必须喂原始 value（index 2），喂键名会得到必然 MISS 的假阴性
  const a = matchOne(raw, '')
  const b = matchOne(' ' + raw.slice(0, 4) + ' ' + raw.slice(4), '') // 加空白与截断：验归一化路径
  console.log(`控制测量: 原值=${a.state} 变形=${b.state}  我方语料 ${ourPairs.length} 条`)
  if (a.state !== 'L1' || b.state === 'MISS') {
    console.error('❌ 匹配器未通过控制测量 ⇒ 本次 MISS 一律无效，拒绝出结论')
    process.exit(2)
  }
}

if (SELF_TEST) runSelfTest() // 语料已加载 ⇒ 构造面判得动;runSelfTest 内部自行 exit

// —— 解析清单：三种格式 ——
/**
 * 把竞品清单解析成行记录。**纯函数、不碰磁盘**，好让 `--self-test` 能用构造面判归属。
 *
 * 归属规矩（D167 步 1，"@out 复位"）：
 *   `## 节`   换节 ⇒ 清族（前一轮已修：旧写法只在 `###` 处更新族，于是没有 `###` 子标题的一节
 *             会整批沿用上一节族名 —— 附录 D 的错误码行因此被记成 `tagPill`）；
 *   `### 族`  设族；
 *   **块边界**（代码栅栏开/闭、新表头行）⇒ 若该族已经产出行，则清族。
 * 三条边界都必要，因为"族名只对它紧跟着的那一块有效"才是这份清单的真实结构：
 * 一个 `###` 标题之后可能先跟表格再跟栅栏，也可能栅栏之后就换到下一张表，
 * 只有"块结束即失焦"能让后面那些**没有标题**的行落到 `(未判定)`，而不是继续顶着一个族名。
 * 复位判据有牙的证明写在 `--self-test` 的 ST4（删掉复位 ⇒ 该用例必翻红）。
 */
export function parseInventory(lines, secFilter = null) {
  const rows = []
  const src = lines.map((l) => String(l).trim())
  let section = '', family = '', familyUsed = false, inFence = false
  for (let i = 0; i < src.length; i++) {
    const l = src[i]
    if (/^#{2,3} /.test(l)) {
      const t = l.replace(/^#+\s*/, '')
      if (/^(\d+|附录)\s/.test(t) || /^## /.test(l)) {
        section = t
        if (/^## /.test(l)) { family = ''; familyUsed = false }
      }
      if (/^### /.test(l)) { const m = l.match(/^### `?([^`（ ]+)`?/); family = m ? m[1] : t; familyUsed = false; continue }
      continue
    }
    // 块边界复位：栅栏开/闭、或"表头 + 分隔行"起的新表 —— 已经产出行的族在此失焦。
    if (/^(?:```|~~~)/.test(l)) { inFence = !inFence; if (familyUsed) family = ''; familyUsed = false; continue }
    if (/^\|/.test(l) && /^\|(\s*:?-{2,}\s*\|)+/.test(src[i + 1] || '')) { if (familyUsed) family = ''; familyUsed = false; continue }
    if (secFilter && !section.includes(secFilter)) continue
    let m = l.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|/) // 正文表格 | `key` | 原文 |
    if (m) { rows.push({ sec: section, fam: family, key: m[1], text: m[2] }); familyUsed = true; continue }
    m = l.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/) // 错误码表 | code | 标题 | 正文 |
    if (m && !/^-+$/.test(m[2])) { rows.push({ sec: section, fam: family, key: m[1], text: m[2] + ' ' + m[3] }); familyUsed = true; continue }
    m = l.match(/^([A-Za-z][A-Za-z0-9_]*):\s*["“]([^"”]{1,80})["”]/) // 附录 C key:"值"
    if (m) { rows.push({ sec: section, fam: family, key: (family || '(未判定)') + '.' + m[1], text: m[2] }); familyUsed = true; continue }
  }
  return rows
}
/** 族级的"能不能引用"出口：空族一律显式记 `(未判定)`，不得印成空白（空白读起来像"这一维没东西"）。 */
function famOf(f) { return f ? String(f) : '(未判定)' }
/**
 * 票面目标行为的那一半："**不能用的时候，工具自己会说这一维别引用**"。
 * 纯函数、构造面可判（ST7）；`total=0` 不冒充"齐备"——空枚举既不是通过也不是失败，是"没有可说的"。
 */
export function familyAdvisory(total, undetermined) {
  if (!total) return { warn: null, text: '本件没有任何行 ⇒ 族级维度无从谈起（空枚举不记为"齐备"）' }
  if (undetermined) {
    return { warn: true, text: `⚠️ 族级数字不得引用：${undetermined}/${total} 行落在 (未判定) 桶（族名只对它紧跟着的那一块有效，见 parseInventory 的复位规矩）。逐条原文与判定态仍可用。` }
  }
  return { warn: false, text: `族级归属：${total} 行全部归到某个族，族级计数可用于归因。` }
}

const lines = fs.readFileSync(LIST, 'utf8').split(/\r?\n/)
const rows = parseInventory(lines, SEC)


const bySec = new Map(), misses = []
// 判一遍就定稿：`--out` 那一侧曾第二次调用 matchOne，于是同一行被计两次（一次进 bySec、一次进导出件），
// 而 skip 计数是副作用式的话还会翻倍。现整个流程共用一份 decided。
const decided = rows.map((r) => ({ ...r, ...matchOne(r.text, r.key) }))
const skipTally = new Map()
for (const r of decided) {
  const res = { state: r.state, why: r.why, where: r.where }
  const k = r.sec.slice(0, 28)
  if (!bySec.has(k)) bySec.set(k, { L1: 0, L2: 0, L3: 0, MISS: 0, skip: 0 })
  bySec.get(k)[res.state] = (bySec.get(k)[res.state] || 0) + 1
  if (res.state === 'skip') skipTally.set(res.why, (skipTally.get(res.why) || 0) + 1)
  if (res.state === 'MISS') misses.push(`${r.sec.split(' ')[0]} ${famOf(r.fam)} · \`${r.key}\` · ${r.text.slice(0, 40)}`)
}
// 族级可用性自证：只要有行落 `(未判定)`，族级聚合就**不得**被引用，工具自己喊出来。
// 措辞只有一份实现（familyAdvisory），控制台与导出件抬头都取它 —— 两处各写一遍必然漂移。
const undetermined = decided.filter((r) => !r.fam).length
const advisory = familyAdvisory(decided.length, undetermined)
console.log(`\n=== 对账（共 ${rows.length} 条，筛选=${SEC || '全清单'}）===`)
console.log(advisory.text)
console.log('节'.padEnd(30) + 'L1逐字\tL2近义\tL3待核\tMISS\tskip(不计差距)')
for (const [k, v] of bySec) console.log(k.padEnd(28) + `${v.L1}\t${v.L2}\t${v.L3}\t${v.MISS}\t${v.skip || 0}`)
if (skipTally.size) {
  console.log('\n=== skip 明细（不计 MISS，逐档报名；"值层主筛"与"第二道"的相对份数就是那两道闸的实际覆盖面）===')
  for (const [why, n] of [...skipTally].sort((a, b) => b[1] - a[1])) console.log(`  · ${why}: ${n} 条`)
}
console.log('\n=== MISS 明细（候选缺失，仍需人工判"真没有"还是"我方另起一名"）===')
const uniq = [...new Set(misses)]
for (const x of uniq.slice(0, Number(process.env.SHOW || 90))) console.log('  · ' + x)
if (uniq.length > 90) console.log(`  … 另 ${uniq.length - 90} 条（SHOW=200 可全出）`)
// 逐条导出：分节计数不足以让人复核，每条判定都得落到文件
const oIdx = argv.indexOf('--out')
if (oIdx > 0 && argv[oIdx + 1]) {
  const rows2 = decided
  const head = '# 逐条对账导出：' + (SEC || '全清单') + '\n\n' +
    '生成：`node docs/benchmark-evidence/2026-09/reconcile.mjs qoder/chat-stream-inventory.md' +
    (SEC ? ` --section "${SEC}"` : '') + ' --out <本文件>`\n\n' +
    '四态口径：**L1 逐字 / L2 近义(Jaccard≥0.5) 不算差距**；L3=需人工核（键同名或子串同形，形似不等于等同）；' +
    'MISS=候选缺失，须逐条定性后才可写进台账。控制测量在运行前已通过，故 MISS 不是匹配器空转的产物。\n\n' +
    (advisory.text ? '> ' + advisory.text + '\n\n' : '') +
    (skipTally.size
      ? '> 不计 MISS 的 skip 明细（逐档报名）：' + [...skipTally].map(([w, n]) => `${w} ${n} 条`).join(' / ') + '\n\n'
      : '') +
    '| 节 | 族 | 竞品键 | 竞品原文 | 判定 | 我方对应 |\n| --- | --- | --- | --- | --- | --- |\n'
  const body = rows2.map((r) => '| ' + [r.sec.split('：')[0].slice(0, 12), famOf(r.fam), '`' + r.key + '`', String(r.text).slice(0, 46).replace(/\|/g, '/'), r.state, r.where || r.why || ''].join(' | ') + ' |').join('\n')
  fs.writeFileSync(argv[oIdx + 1], head + body + '\n')
  console.log('\n# 已导出 ' + rows2.length + ' 条 → ' + argv[oIdx + 1])
}
console.log(`\n# 口径: L1/L2 不算差距; L3=需人工核; MISS 必须逐条定性后才可写进台账。`)

/**
/**
 * 自检（D167）：每条都判"量具自己会不会把没看见写成没差距"，并且**正反成对**——
 * 只有"该红的构造面会红"被证过，绿才叫证据；只留正向断言，判据漂了它跟着漂（§22c 复读机那一型）。
 * 每条都在注释里写"它在什么情况下会红"，否则下一个人只能靠猜。
 */
function runSelfTest() {
  const out = []
  const t = (name, ok, got) => out.push([name, !!ok, got])

  // ST1 换节必须清族：`## 节` 之后那些没有 `###` 的行不得继承上一节族名。
  // 会红的条件：把 parseInventory 里 `if (/^## /.test(l)) { family = ''; ... }` 的 `family = ''` 删掉，
  // 第 2 条就会带 tagPill ⇒ inherited=true ⇒ 本条红。
  {
    const md = ['## 10 工具与审批', '### `tagPill`', '', '| `a` | 已审批 |', '## 附录 D 错误码', '', '| `E001` | 网络错误 | 请检查网络后重试 |']
    const rows = parseInventory(md)
    const inherited = rows.length === 2 && String(rows[1].fam).includes('tagPill')
    t('ST1 换节后无 ### ⇒ 族名不得继承上一节', !inherited && rows.length === 2, rows.map((r) => famOf(r.fam)).join(' / '))
  }

  // ST2 纯 ASCII（键位、代码、英文散文）不得进 MISS：MISS 的含义是"这条中文文案我方没有"，
  // 拿它套非中文行会凭空造差距（实测 27 行）。
  // 会红的条件：把 matchOne 里"非中文原文"那道 skip 删掉 ⇒ a.state 变 MISS ⇒ 本条红。
  // （`Ctrl+Shift+P` 走的是"非中文"档而不是"枚举"档：`+` 不在枚举词法里，见 isPureEnumOrStyle 的注释。）
  {
    const a = matchOne('Ctrl+Shift+P', 'kbd.shortcut')
    const b = matchOne('请检查网络后重试', 'err.net')
    t('ST2 非中文原文判 skip 而非 MISS，且中文行不受影响', a.state === 'skip' && b.state !== 'skip', `${a.state} / ${b.state}`)
  }

  // ST3 取材面形状锁：语言包语料必须走被审面（HEAD），不得按磁盘读。
  // 立因：源码字面量那一侧已按 HEAD 取（并写了注释说明为什么），语言包这一侧却按磁盘读
  // —— 同一把尺子两个面，并发会话推进的瞬间就会产出自洽却错位的结论。
  // 会红的条件：源码里重新出现"以路径变量按磁盘读语言包"那种语句 ⇒ 本条红。
  // ⚠️ 判据只看**代码面**（行注释已剥）：这条形状锁第一次落地时被自己写的说明咬红 ——
  //    注释里原样抄了那个待禁的调用式，而锁是按整篇文本匹配的，于是"描述缺陷"变成了"命中缺陷"
  //    （本仓记过的同型：说明性文字也会带执行性字符 ⇒ 判据必须在剥注释后的面上判）。
  {
    const src = fs.readFileSync(new URL(import.meta.url), 'utf8')
    const codeFace = src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
    const diskRead = /fs\.readFileSync\(\s*(?:p|path|file|fp)\b[^)]*utf8/.test(codeFace)
    t('ST3 语言包语料不得按磁盘读（必须经 git show 取被审面）', !diskRead, diskRead ? '代码面仍存在以路径变量按磁盘读的语句' : '已走被审面')
  }

  // ST4 块边界复位（票面第①条点名的"遇到新的表头/新的代码块没有复位"）。两个边界各自单独钉，
  // 因为它们是不同的形状（附录 C 用栅栏装 key:"值"，正文与附录 D/E 用表格）：
  //   ST4a 栅栏边界：`### fam` 之后那块里的行**必须保留** fam（复位判据不得把合法归属一起清掉）；
  //                  栅栏关掉之后紧跟一条没有标题的 key:"值" ⇒ 必须落 (未判定)。
  //   ST4b 表头边界：同一 `###` 下第二张表的第一行 ⇒ 必须落 (未判定)，第一张表的行仍保留 fam。
  // 会红的条件：① 删掉栅栏那处复位 ⇒ ST4a 的第 2 行仍带 fam ⇒ 红（ST4b 不会红 —— 所以必须分开钉）；
  //             ② 删掉表头那处复位 ⇒ ST4b 的第 2 行仍带 fam ⇒ 红；
  //             ③ 把任一处复位改成"无条件清族" ⇒ 两个用例的**正向臂**同时红（族全废=判据自毁）。
  {
    const a = parseInventory(['## 附录 C：内置文案', '', '### `tagPill`', '', '```', 'copy:"复制代码"', '```', '', 'orphan:"栅栏外文案"'])
    const aIn = a.find((r) => r.key === 'tagPill.copy')
    const aOut = a.find((r) => /orphan$/.test(r.key))
    t('ST4a 栅栏边界：块内保留族 / 栅栏外无标题的行落 (未判定)',
      Boolean(aIn) && String(aIn.fam) === 'tagPill' && Boolean(aOut) && aOut.fam === '',
      a.map((r) => `${r.key}⇒${famOf(r.fam)}`).join(' / '))
    const b = parseInventory([
      '## 14 会话管理', '', '### `chatSession.*`', '',
      '| 元素/状态（键） | 原文文案 |', '| --- | --- |', '| `chatSession.one` | 第一张表的文案 |',
      '| 元素/状态（键） | 原文文案 |', '| --- | --- |', '| `chatSession.two` | 第二张表的文案 |',
    ])
    const bIn = b.find((r) => r.key === 'chatSession.one')
    const bOut = b.find((r) => r.key === 'chatSession.two')
    t('ST4b 表头边界：第二张表不得继续顶前一个族',
      Boolean(bIn) && String(bIn.fam) === 'chatSession.*' && Boolean(bOut) && bOut.fam === '',
      b.map((r) => `${r.key}⇒${famOf(r.fam)}`).join(' / '))
  }

  // ST5 值层判据：票面第②条点名的三个例子必须走**值层这一道**（不是靠"非中文"侥幸躲过），
  // 且真文案不得被这道放过（硬要求⑥）。
  // 夹具原文逐字取自入库清单 `qoder/chat-stream-inventory.md` 附录 C 的栅栏（4541-4621 段）：
  //   dir:"ltr" / phase:"idle" / variant:"ghost"；同族还有 type:"button"、className:"size-3.5"。
  // 会红的条件：① 摘掉值层那道 skip ⇒ 三条的落点会从"值层主筛"变成"非中文原文"⇒ why 不匹配 ⇒ 红
  //                （只断言 state==='skip' 是不够的 —— 两道闸都给 skip，报告面就分不出是谁拦的）；
  //             ② 放宽枚举词法（例如允许非 ASCII 字符，或把词法整条改成通配）⇒ 正向对照 `已超时 48h`
  //                被判 skip ⇒ 红（这条就是"值层放宽不得把真文案放过"的锁）；
  //             ③ 让样式**键名**那道闸不看值 ⇒ 正向对照 `主要按钮`（键叫 className）被判 skip ⇒ 红；
  //             ④ 摘掉值层判据里的汉字守卫 ⇒ `w-[图标]` 这类"方括号里是中文"的串会被词法直接吞掉
  //                （`\[[^\]]*\]` 不限括号内容）⇒ 该臂判 skip ⇒ 红。现读五节 0 条命中该形状，
  //                所以这一臂是**前瞻守卫**而不是存量修复 —— 它的价值正在"删掉即红"。
  {
    // 两种写法都要判：栅栏原文 `dir:"ltr"` 经 parseInventory 会得到 (key=`tagPill.dir`, text=`ltr`)，
    // 而票面第②条点名的是合成串 `dir:ltr` —— 两者都必须由**值层**这一道摘掉，不能只靠"非中文"侥幸。
    const enums = [
      ['dir:ltr', 'tagPill.dir'], ['phase:idle', 'markdownImage/Table.phase'], ['variant:ghost', 'SuggestionBanner.variant'],
      ['ltr', 'tagPill.dir'], ['idle', 'markdownImage/Table.phase'], ['ghost', 'SuggestionBanner.variant'],
      ['size-3.5', 'markdownImage/Table.className'], ['tablist', 'updates.role'],
    ].map(([text, key]) => [text, matchOne(text, key)])
    const byValueLayer = enums.every(([, r]) => r.state === 'skip' && /值层主筛/.test(String(r.why)))
    // 正向对照：带汉字的真文案不得被值层这道摘走；键名像样式、值却是真文案的也不得被第二道摘走。
    const real = matchOne('已超时 48h', 'attention.demo.items.tooltip.status')
    const styleKeyButRealCopy = matchOne('主要按钮', 'x.className')
    const bracketedCjk = matchOne('w-[图标]', 'x.className')
    // 第二道的岗位：值层词法装不下的**多段样式串**(含空格)，只有键名认得它。摘掉第二道 ⇒ 本条红。
    const secondGate = matchOne('mr-2 w-[calc(100%-0.5rem)]', 'x.className')
    t('ST5 枚举/样式值由值层主筛摘除(点名原因)，含汉字真文案不被放过',
      byValueLayer && real.state !== 'skip' && styleKeyButRealCopy.state !== 'skip' && bracketedCjk.state !== 'skip'
        && secondGate.state === 'skip' && /第二道/.test(String(secondGate.why)),
      `${enums.map(([x, r]) => `${x}⇒${r.state}/${r.why || '-'}`).join(' / ')} ｜ 已超时 48h⇒${real.state} ｜ 主要按钮⇒${styleKeyButRealCopy.state} ｜ w-[图标]⇒${bracketedCjk.state} ｜ 多段样式串⇒${secondGate.state}/${secondGate.why || '-'}`)
  }

  // ST6 假阳率否证（票面第③条，§9.2 那 2/5=40% 否证样本的第一条固化成用例）。
  // 夹具原文逐字取自 `qoder/chat-stream-inventory.md:2299`：
  //   | `composer.referencePreview.edit` | 编辑此消息 | renderer.js 内 `edit:"…"`（newChatResources 的 zh 段） |
  // 我方实为 `…edit` = "编辑"（同能力、不同文案）⇒ 字符 Jaccard 必然不中，但它**不是差距**。
  // 所以判 L3（需人工核）而不是 MISS；也不得判 L1/L2 —— 那是替我方发合格证。
  // 四条臂各钉一处会漂的写法，"会红的条件"逐条写明：
  //  ① 摘掉 ourStemForSegment 这一档 ⇒ `编辑此消息` 落 MISS ⇒ 红；
  //  ② 放宽成"末段同名就算、不看值" ⇒ 反向对照 `还没有速记`(键末段 emptyTitle，我方 7 个 *.emptyTitle 的值里
  //     没有它的词头) 被当成"同能力"放过 ⇒ 红。实测：单看末段同名会一次放过 103/459 条真缺失，
  //     联合证据(同一个键 + 值互为词头)只放过 21 条 —— 这一条就是那道边界的锁；
  //  ③ 段索引改成"只收该文本的首个键"(跟着文本去重一起跳) ⇒ `隐藏动态` 退成 MISS ⇒ 红。
  //     不是假想：值「隐藏」第一次出现在 `admin.commentLogs.hidden`(末段是 hidden)，末段 `hide` 只有 `common.hide`
  //     —— 去重版永远收不到 (hide, 隐藏) 这一对，而它正是本档要救的那一型；
  //  ④ 语料前提没了（HEAD 面语言包里 `*.edit`="编辑" 或 `common.hide`="隐藏" 不在位）⇒ 判红并点名前提，
  //     绝不静默变绿 —— 用例失去牙齿必须被人知道。
  {
    const premiseEdit = (ourSegs.get('edit') || []).filter(([, v]) => v === '编辑').length
    const premiseHide = (ourSegs.get('hide') || []).filter(([, v]) => v === '隐藏').length
    const a = matchOne('编辑此消息', 'composer.referencePreview.edit')
    const b = matchOne('还没有速记', 'chatSession.quickNotes.emptyTitle')
    const c = matchOne('隐藏动态', 'updates.hide')
    const d = matchOne('马赛克', 'chatSession.quickNotes.imageAnnotation.mosaic')
    t('ST6 同能力不同文案判 L3(不算差距也不算命中)；同段名而值不相关、以及段索引漏收的，仍判 MISS',
      premiseEdit > 0 && premiseHide > 0 && a.state === 'L3' && c.state === 'L3' && b.state === 'MISS' && d.state === 'MISS',
      `前提 *.edit=「编辑」${premiseEdit} 条 / *.hide=「隐藏」${premiseHide} 条 ⇒ 编辑此消息⇒${a.state} 隐藏动态⇒${c.state} 还没有速记⇒${b.state} 马赛克⇒${d.state}`)
  }

  // ST7 目标行为的另一半（票面："族级条数能用于归因；**不能用的时候，工具自己会说这一维别引用**"）。
  // 判三态：有未判定 ⇒ 喊"不得引用"并给出份数；全无未判定 ⇒ 才允许说"可归因"；
  // 空件(total=0) ⇒ 既不喊也不背书 —— 把"什么都没扫到"写成"族级齐备"是本仓最贵的那一型。
  // 会红的条件：① 把告警文案改成无条件"齐备" ⇒ 第一臂红；② 让空件也走"齐备"分支 ⇒ 第三臂红。
  {
    const warn = familyAdvisory(87, 87)
    const ok = familyAdvisory(128, 0)
    const empty = familyAdvisory(0, 0)
    t('ST7 族级不可用时工具自己点名；空件不背书',
      warn.warn === true && /不得引用/.test(warn.text) && /87\/87/.test(warn.text)
        && ok.warn === false && !/不得引用/.test(ok.text)
        && empty.warn === null && !/可用于归因/.test(empty.text),
      `有未判定⇒${warn.warn} / 齐备⇒${ok.warn} / 空件⇒${empty.warn}(文案:${empty.text})`)
  }

  // ST8 宾语落点约束（G-802 验收③：构造面反向对照 —— 修改前这一条必须红，因为今天它会被摘掉）。
  // 夹具 pool 里**有**通用动词「打开」、**没有**「速记板」这个宾语：旧口径靠"末段同名+词头"就能把
  // `打开速记板` 救进 L3，而它事实是我方零覆盖的能力 ⇒ 新口径必须让它留在 MISS。
  // 三条臂各钉一处会漂的写法，"会红的条件"逐条写明：
  //  ① 摘掉 `ourStemForSegment` 里那句宾语落点约束 ⇒ `e2e` 从 MISS 变回 L3 ⇒ 红（这条就是两臂差）；
  //  ② 把"被管理对象"臂放宽成"与任一动词同串" ⇒ `发送预览` 那臂（pool 里有「关闭预览」这种
  //     **他域受事**）会被放回 L3 ⇒ 红 —— 只有建/销类动作才证明宾语是我方在册对象，视图类动词不算；
  //  ③ 构造面的正臂（`打开文件`：pool 里动宾同串）必须算落地 —— 只判负臂不判正臂，删掉约束也照样绿，
  //     那就不是判据而是断言；
  //  ④ 语料前提漂了（我方 `*.open` 不再=「打开」，或"速记"忽然有了落点）⇒ 判红并点名前提，
  //     绝不静默变绿（与 ST6 的第④臂同一条规矩）。
  {
    const pool = ['打开文件', '关闭文件', '删除评论', '新建分组', '关闭预览']
    const neg = objectFootprintOk('打开速记板', '打开', pool)
    const pos = objectFootprintOk('打开文件', '打开', pool)
    const otherDomainObj = objectFootprintOk('发送预览', '发送', pool)
    const oldFires = Boolean(stemIgnoringFootprint('chatSession.quickNotes.open', normText('打开速记板')))
    const premiseOpen = (ourSegs.get('open') || []).filter(([, v]) => v === '打开').length
    const premiseNoObj = !corpusStrings().some((s) => s.includes('速记'))
    const e2e = matchOne('打开速记板', 'chatSession.quickNotes.open')
    t('ST8 末段通用动词 + 宾语零落点 ⇒ 不算同能力证据；动宾同现的正臂仍算（构造面 + 真语料端到端）',
      !neg.ok && pos.ok && !otherDomainObj.ok && oldFires && premiseOpen > 0 && premiseNoObj && e2e.state === 'MISS',
      `构造面：速记板⇒${neg.ok ? '误判落地' : '零落点✓'} / 打开文件⇒${pos.ok ? '落地✓' : '误判零落点'} / 发送预览(他域受事)⇒${otherDomainObj.ok ? '误判落地' : '零落点✓'} ｜ 旧口径确实会摘走=${oldFires} ｜ 前提 *.open=「打开」${premiseOpen} 条、真语料含「速记」=${!premiseNoObj} ⇒ 端到端 ${e2e.state}`)
  }

  // ST9 同一宾语的同名动作我方确有 ⇒ 不得被误留成差距（G-802 验收④：收紧不得把假阳放回来）。
  // 构造面：pool 里有「关闭标签页」⇒ `关闭标签页` 必须算落地；真语料端到端：清单里那一行
  // `关闭 {{label}} 标签页`（占位符要能剥掉）必须仍判 L3 而不是 MISS。
  // 会红的条件：① 宾语臂写反（把"落地"当"不落"）⇒ 两臂同时红；② 占位符剥离漂了 ⇒
  //    `关闭 {{label}} 标签页` 的宾语读成 `{{label}}标签页`，动宾同现查不到 ⇒ 端到端退成 MISS ⇒ 红；
  // ③ 真语料里「关闭标签页」这条文案被删 ⇒ 前提不成立 ⇒ 红并点名（不是静默换结论）。
  {
    const pool = ['关闭标签页', '新建分组']
    const pos = objectFootprintOk('关闭标签页', '关闭', pool)
    const premiseTab = corpusStrings().some((s) => s === '关闭标签页')
    const e2e = matchOne('关闭 {{label}} 标签页', 'chatSession.workspaceTabs.close')
    t('ST9 同一宾语的同名动作我方确有 ⇒ 仍判 L3(不算差距)；剥占位符后宾语须读成「标签页」',
      pos.ok && premiseTab && e2e.state === 'L3',
      `构造面⇒${pos.ok ? '落地✓' : '误判零落点'} ｜ 前提 语料含「关闭标签页」=${premiseTab} ⇒ 端到端 ${e2e.state}/${e2e.where || e2e.why || '-'}`)
  }

  for (const [name, ok, got] of out) console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ' —— 实得: ' + got}`)
  const bad = out.filter((x) => !x[1]).length
  console.log(`# 自检 ${out.length - bad}/${out.length} 通过`)
  process.exit(bad ? 1 : 0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
