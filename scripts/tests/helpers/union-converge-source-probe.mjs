// @ihui-seat S-PROBE 2026-11-01
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/**
 * scripts/tests/helpers/union-converge-source-probe.mjs —— 源码级锁的**唯一**探测面(测试侧,零判据)。
 *
 * 立因(2026-11-01,S-PROBE 席位实测):`scripts/union-converge.mjs` 的判据族被逐字搬进
 * `scripts/lib/union-converge-judgments.mjs` 后,两个镜像测试仍用
 * `UNION_SRC.indexOf('export function liveDocExpectedCounts')` 这类**单文件字符串探测** ⇒ 返回 -1
 * ⇒ 断言恒假,而病(判据只有一份)其实还在。更糟的是反方向:把判据**复制**进 lib 时,只看一个文件的
 * 探测面**看不见**第二份 —— 那才是这两条锁真正要抓的形态。
 *
 * 因此本文件把探测面改成"全家族扫描",并顺带把锁变强:
 *   ① 家族 = `scripts/union-converge.mjs` + `scripts/lib/union-converge-*.mjs`(**目录现读**,
 *      不是手抄清单 —— 新增 lib 分片自动纳入,不会出现"拆出去就漏看");
 *   ② 唯一性 = `export function X` 恰好 1 处,且该函数体(去注释/折叠空白后)**在全家族只出现 1 次**
 *      ⇒ 改名不改体的拷贝同样翻红(原实现连同名副本都看不见);
 *   ③ 接线 = 取**真函数体**(从定义读到列 0 的收尾 `}`,不是固定 9000 字窗口),再判接线表达式在不在
 *      该体内 —— 窗口越界/挪出函数体即翻红。
 *
 * 取不到输入(家族少于 2 个文件 / 该函数一个定义都没有)⇒ `ok: false` 且 `why` 说明是"探测面漏了"
 * 而不是"判据没了" —— 调用方必须当成红,不许当绿灯(§0.3)。
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TOOL_REL = 'scripts/union-converge.mjs'
const LIB_RE = /^union-converge-.*\.mjs$/

/** 被审面:本器 + 它的 lib 分片。每次现读,避免同一进程内被变异后串味。 */
export function familySources() {
  const files = [{ rel: TOOL_REL, abs: join(SCRIPTS, 'union-converge.mjs') }]
  for (const f of readdirSync(join(SCRIPTS, 'lib')).sort())
    if (LIB_RE.test(f)) files.push({ rel: `scripts/lib/${f}`, abs: join(SCRIPTS, 'lib', f) })
  return files.map((f) => ({ rel: f.rel, src: readFileSync(f.abs, 'utf8') }))
}

/** 去行注释/块注释并折叠空白 —— 只用于**同体拷贝**比对,不做任何语义解析。 */
function normalize(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '"' || c === "'" || c === '`') {
      const q = c
      out += c
      i++
      while (i < n) {
        const d = src[i]
        out += d
        i++
        if (d === '\\') {
          if (i < n) out += src[i++]
          continue
        }
        if (d === q) break
      }
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  return out.replace(/\s+/g, ' ').trim()
}

/**
 * 从 `export function <name>(` 的定义处截到**顶层收尾**(列 0 的 `}`)。
 * 本仓 scripts 一律这样收尾(拆出的 lib 同形),取不到 ⇒ null(调用方按"未判定"报红)。
 */
export function bodyAt(src, from) {
  const open = src.indexOf('{', from)
  if (open < 0) return null
  const close = src.indexOf('\n}', open)
  if (close < 0) return null
  return src.slice(from, close + 2)
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 全家族里 `export function <name>` 的每一处定义(含所在文件与真函数体)。 */
export function definitionsOf(name) {
  const re = new RegExp(`export\\s+function\\s+${escapeRe(name)}\\s*\\(`, 'g')
  const out = []
  for (const f of familySources()) {
    for (let m; (m = re.exec(f.src)); ) {
      const body = bodyAt(f.src, m.index)
      if (body !== null) out.push({ rel: f.rel, at: m.index, body })
      else out.push({ rel: f.rel, at: m.index, body: null })
    }
  }
  return out
}

/**
 * 某段函数体(去注释/折叠空白后)在全家族源码里出现了几次 —— **改名不改体的拷贝也算**:
 * 比对面取 `{` 之后的正文(签名行/函数名不参与),所以换个名字抄一份照样数到 2。
 */
export function bodyCopiesInFamily(body) {
  const open = body.indexOf('{')
  const key = normalize(open < 0 ? body : body.slice(open))
  if (key.length < 40) throw new Error('待比对的函数体过短(探测不出东西)⇒ 未判定,不许当绿灯')
  const hits = []
  let count = 0
  for (const f of familySources()) {
    const ns = normalize(f.src)
    let from = 0
    let n = 0
    while ((from = ns.indexOf(key, from)) !== -1) {
      n++
      from += key.length
    }
    if (n > 0) {
      count += n
      hits.push({ rel: f.rel, n })
    }
  }
  return { count, hits }
}

/**
 * 唯一性锁:该函数在全家族**恰好 1 份定义**,且函数体全家族**只此一处**。
 * 返回 `{ ok, why, rel, body }`;`ok:false` 时 `why` 必须原样进断言消息(不许吞掉)。
 */
export function uniqueDefinition(name) {
  const fam = familySources()
  if (fam.length < 2)
    return { ok: false, why: `探测面只扫到 ${fam.length} 个文件(union-converge.mjs + lib/union-converge-*.mjs 应至少 2 个)⇒ 未判定,不许当绿灯`, rel: null, body: null }
  const defs = definitionsOf(name)
  if (defs.length === 0)
    return { ok: false, why: `全家族(${fam.map((f) => f.rel).join(' / ')})里找不到 export function ${name} ⇒ 探测面过期,未判定`, rel: null, body: null }
  if (defs.length > 1)
    return {
      ok: false,
      why: `export function ${name} 在家族里出现 ${defs.length} 处(${defs.map((d) => d.rel).join(' / ')})⇒ §0.6 单一真相源破了`,
      rel: null,
      body: null,
    }
  const d = defs[0]
  if (!d.body) return { ok: false, why: `${d.rel} 里 ${name} 的函数体截不出来(收尾不是列 0 的 })⇒ 未判定`, rel: d.rel, body: null }
  const copies = bodyCopiesInFamily(d.body)
  if (copies.count !== 1)
    return {
      ok: false,
      why: `${name} 的函数体在全家族出现 ${copies.count} 次(${copies.hits.map((h) => `${h.rel}×${h.n}`).join(' / ')})⇒ 判据被复制成多份(改名不改体也算),§0.6 破了`,
      rel: d.rel,
      body: null,
    }
  return { ok: true, why: '', rel: d.rel, body: d.body }
}

/** 接线锁:接线表达式必须落在该唯一函数的**真函数体**内(不是同文件里别处)。 */
export function wiringInBody(name, needle) {
  const u = uniqueDefinition(name)
  if (!u.ok) return { ok: false, why: u.why }
  if (!u.body.includes(needle))
    return { ok: false, why: `${name}(${u.rel})的函数体里找不到接线点 ${JSON.stringify(needle)} ⇒ 接线被挪出去了` }
  return { ok: true, why: '', rel: u.rel, body: u.body }
}

/** 读任意一件被审文件(如 scripts/lib/conflict-marker-triples.mjs):供"别处那份判据不得被抄进来"用。 */
export function sourceOf(rel) {
  return readFileSync(join(SCRIPTS, '..', rel), 'utf8')
}

/** 取某文件里某函数(允许非 export)的真函数体,取不到 ⇒ null。 */
export function functionBodyIn(src, name) {
  const re = new RegExp(`(?:export\\s+)?function\\s+${escapeRe(name)}\\s*\\(`, 'g')
  const m = re.exec(src)
  return m ? bodyAt(src, m.index) : null
}
