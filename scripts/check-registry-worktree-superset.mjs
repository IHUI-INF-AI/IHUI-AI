#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 注册表文件「工作树/索引副本必须 ⊇ HEAD 已有条目」对账(票面 G-1058643,2026-10-06 立)
 *
 * ── 立因(现读复核过的前提,不是抄票面)──────────────────────────────
 * 本仓有两类**注册表**:根与各级 `package.json` 的 pnpm `scripts` 键、`scripts/guardian-runner.mjs`
 * 的守门注册块(`id:` + `script:` …)。它们同样是多会话共写的追加式清单,而**磁盘副本在这台机上
 * 会滞后 HEAD**。取版的两条路都吃工作树字节(`safe-commit.mjs` 的无 pathspec 步、旁路落地按工作树
 * 取版本),于是"我只加一条"的一次提交会把别人**刚入库的那条**写回旧形态。
 * 2026-10-06 当天症状:`check:percent-clamp` 在 HEAD 里,而 `pnpm run check:percent-clamp` 报
 * `ERR_PNPM_NO_SCRIPT` —— 工作树副本已经没有这一行。
 *
 * ── 为什么现有三道门都看不见这一格(逐条现读)────────────────────────
 * ① 守门 166 `check-live-doc-pathspec.mjs`:注册块 `stagedTriggers` 现值只有
 *    `PROJECT_PLAN.md / AGENTS.md / README.md` 三份活文档 ⇒ 两份注册表**不在它射程内**。
 * ② `check-stale-revert.mjs` 的 R1 判据是"**暂存 blob 逐字节等于该路径某个祖先提交的版本**"
 *    (源码 L15),而真实事故是"旧副本 ⊕ 别人的新行"= 混合体,逐字节永不等于任何祖先 ⇒ 结构上失明;
 *    它的 R1r 补的是**反方向**(HEAD 已删、祖先写过又被搬回),对"HEAD 有、候选面没有"同样不判。
 * ③ `heal-worktree-tracked.mjs --check` 现读输出"✅ 工作区已跟踪文件存续正常"(RC=0),
 *    它的三条判据里第二条是"**索引里的 blob == HEAD 里的 blob**" ⇒ 只要有人暂过存,这一格就整体
 *    不成立;而且它只恢复"文件被删",对"文件在、少几行"没有判据。
 * ⇒ 这一格此前只有散文(AGENTS §12),没有尺子。本票只交付尺子,**不修工作树滞后那一格**
 *    (那是 `heal-worktree-tracked.mjs --align-drift` 的活,副本属于别人 ⇒ 顺手去改是越权)。
 *
 * ── 判什么(两类,分开报数,绝不折叠成一个数)──────────────────────────
 *   **P1 缺失**:HEAD 有的条目行,候选面没有(pnpm `scripts` 键 / runner 注册块)。
 *   **P2 改写**:候选面把那一行改成了另一种写法 ⇒ 判据是**逐行等值**(条目行数组逐元素比);
 *     刻意不用"行数相等"糊过去 —— 行数等而正文漂开正是这一型最常见的形状(自检 S15 钉住:
 *     把这条判据换成行数比较,S15 必须变红)。
 *   **未判定**:逐行不等**但语义等值**(JSON 键序变化、prettier 缩进/引号重排)⇒ 落"未判定"
 *     并逐条点名,**既不算 P2 也不算通过**。出路是语义等值比较器(本门的 JSON 值比较 /
 *     runner 字段归一化比较),而不是放松判据。
 *   覆盖面如实登记:只判 `scripts` 映射与 runner 注册块;`devDependencies` 等其它 JSON 映射、
 *     以及 runner 里非注册块的改动**不在射程**(未覆盖 ≠ 通过)。
 *
 * ── 取材(基准恒为 HEAD blob;候选面 = 下一次提交真正会交付的那一份)──────
 *   缺省(全量/人工审计)候选面 = **工作树磁盘副本**:它正是"无 pathspec 提交会交付的东西"。
 *   `--staged`(提交链)候选面 = **索引 blob**:本次提交的内容,归本提交人负责。
 *   `--worktree` = 显式指名磁盘档(与缺省同面,供人工取证);两面旗同给 ⇒ **exit 2**。
 *   清单取自**基准面(HEAD 树)** —— 要存续的行住在 HEAD,候选面的存在性再按候选面自身核验
 *     (索引档查 `ls-files`,磁盘档查落盘可读),**不靠"盘上大概有"猜,也不 readdir 当凭据**;
 *     两侧正文各一次批量读满 ⇒ 清单与内容同面同轮,不混面。
 *   ⚠️ 枚举到 0 个注册表文件 ⇒ **exit 2 判死**,绝不记绿(空扫与"都没违规"同形)。
 *
 * ── 定级(失效方向只能是"多要一次定向说明",绝不是"多放一次跳门")────────
 *   缺省(磁盘档)**只报数不判红**:工作树副本此刻属于别的会话,当场判红就是把别人的在飞状态
 *     算成本提交人的账 ⇒ 结局是每个会话 `--no-verify`,连带链上约 190 道门对该提交作废(§12e)。
 *   `--strict` = 问责档:同一判据、同一计数,只是让磁盘档也判红(人工巡检/追责时用)。
 *   `--staged` = 提交链档:索引是**本次提交自己的内容**,P1/P2 即判红。
 *   唯一的"有意删除"出口(与 §12 同向,要求的是说明而不是放行):候选面上落一份
 *     `.ihui-agent/registry-superset-exempt.jsonl`,逐条 `{"path":…,"entry":…,"reason":"非空"}` ——
 *     被豁免的条目**仍然点名**并计入 `豁免` 维;记录畸形/原因空 ⇒ 不生效,照红。
 *     为什么不给行内标记:要豁免的那一行**正是消失的那一行**,把标记挂在它身上等于让出口随证据一起消失。
 *   紧急跳过仍走 runner 的 skipEnv(不在本门里),但编号/旗名一律以 `guardian-runner.mjs` 现值为准。
 *
 * 用法:node scripts/check-registry-worktree-superset.mjs [--staged|--worktree|--strict|--self-test|--json]
 * 退出码:0 通过或只报数 / 1 检出 P1|P2(提交链档,或缺省档叠加 `--strict`)/
 *         2 无法判定(枚举到 0 个注册表文件、两面旗同给、取材失败、自检之外的脚本异常)
 *
 * 注册状态:**本门尚未接线**(注册表由主会话单写者接线)。任何声称"已经进提交链"的措辞都不得
 *   写进本文 —— 那是守门 89 R2 的恒红形态。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(dirname(SELF_DIR))

/** runner 注册表(唯一一份,按路径点名)。 */
export const RUNNER_PATH = 'scripts/guardian-runner.mjs'
/** 有意删除的唯一出口,住在候选面。 */
export const EXEMPT_LEDGER = '.ihui-agent/registry-superset-exempt.jsonl'

/** 射程枚举:各级 package.json(排除 node_modules)与 runner 注册表。 */
export function isRegistryPath(p) {
  const s = String(p ?? '').replace(/\\/g, '/')
  if (s === RUNNER_PATH) return true
  if (s.includes('node_modules/')) return false
  return s === 'package.json' || s.endsWith('/package.json')
}

/** 枚举过滤(唯一入口;`collect` 只把它作用在 **HEAD 面**清单上 ⇒ 未被跟踪的文件不参与)。 */
export function filterRegistry(paths) {
  return [...paths].filter(isRegistryPath)
}

const indentOf = (l) => (String(l).match(/^\s*/) || [''])[0].length
const splitLines = (t) => String(t ?? '').split(/\r?\n/)

/**
 * `package.json` 的 `scripts` 条目提取:键 → {lines(逐字行), value(解析后的命令串)}。
 * 行组靠"同级键行定界"取,所以多行值也会整段落进同一条目;解析失败只报 error,不返回空表
 * (空表会被下游读成"没有条目"= 通过)。
 */
export function extractPkgEntries(text) {
  const lines = splitLines(text)
  let parsed = null
  let parseError = ''
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    parseError = `JSON 解析失败:${String(e.message).split(/\r?\n/)[0].slice(0, 90)}`
  }
  // 解析不了就是"读不出",不许退化成"没有条目"(那会把坏文件判成整表 P1 或整表通过)
  if (parseError) return { ok: false, entries: new Map(), order: [], hasScripts: false, error: parseError }
  let head = null
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)"scripts"\s*:\s*\{/.exec(lines[i])
    if (m && (head === null || m[1].length < head.indent.length)) head = { i, indent: m[1] }
  }
  if (!head) return { ok: true, entries: new Map(), order: [], hasScripts: false, error: '' }
  let end = -1
  for (let j = head.i + 1; j < lines.length; j++) {
    if (indentOf(lines[j]) === head.indent.length && /^\s*\}/.test(lines[j])) {
      end = j
      break
    }
  }
  if (end < 0) return { ok: false, entries: new Map(), order: [], hasScripts: true, error: 'scripts 块右边界未定位' }
  const keyRe = new RegExp(
    `^\\s{${head.indent.length + 2},}"((?:[^"\\\\]|\\\\.)*)"\\s*:`,
  )
  const marks = []
  for (let j = head.i + 1; j < end; j++) {
    const m = keyRe.exec(lines[j])
    if (m) marks.push({ j, key: JSON.parse(`"${m[1]}"`) })
  }
  const scripts = parsed && parsed.scripts && typeof parsed.scripts === 'object' ? parsed.scripts : null
  const entries = new Map()
  const order = []
  marks.forEach((mk, idx) => {
    const stop = idx + 1 < marks.length ? marks[idx + 1].j : end
    entries.set(mk.key, {
      lines: lines.slice(mk.j, stop),
      value: scripts && Object.prototype.hasOwnProperty.call(scripts, mk.key) ? scripts[mk.key] : null,
    })
    order.push(mk.key)
  })
  return {
    ok: parseError === '',
    entries,
    order,
    hasScripts: true,
    error: parseError,
  }
}

/**
 * runner 注册块提取:`id:` 行 → 上溯最近的裸 `{` 行定界,块尾取同缩进的 `}` 行。
 * 结构性比较读**遮注释后**的文本(注释漂开不该算改写),逐字行仍取原文 —— 报告里要点名的是原文。
 * 缩进众数过滤:嵌套对象里的 `id:` 不是注册块,众数之外的一律记"定位失败"而不是悄悄丢掉。
 */
export function extractRunnerEntries(text) {
  const raw = splitLines(text)
  const masked = splitLines(maskComments(text))
  const idRe = /^\s*id:\s*['"]([^'"]+)['"]\s*,?\s*$/
  const hits = []
  for (let i = 0; i < raw.length; i++) {
    const m = idRe.exec(raw[i])
    if (m) hits.push({ i, id: m[1] })
  }
  const blocks = []
  const failed = []
  for (const h of hits) {
    let open = -1
    for (let j = h.i - 1; j >= 0; j--) {
      const t = (masked[j] ?? '').trim()
      if (!t) continue
      if (t === '{') {
        open = j
        break
      }
      break
    }
    if (open < 0 || indentOf(raw[h.i]) <= indentOf(raw[open])) {
      failed.push(h.id)
      continue
    }
    let close = -1
    for (let j = h.i + 1; j < raw.length; j++) {
      if (
        indentOf(masked[j]) === indentOf(raw[open]) &&
        (masked[j].trim() === '}' || masked[j].trim() === '},')
      ) {
        close = j
        break
      }
    }
    if (close < 0) {
      failed.push(h.id)
      continue
    }
    blocks.push({ id: h.id, open, close, indent: indentOf(raw[open]) })
  }
  const hist = new Map()
  for (const b of blocks) hist.set(b.indent, (hist.get(b.indent) || 0) + 1)
  let dom = null
  for (const [ind, c] of hist) if (dom === null || c > hist.get(dom)) dom = ind
  const kept = blocks.filter((b) => b.indent === dom)
  for (const b of blocks) if (b.indent !== dom) failed.push(b.id)
  const entries = new Map()
  const order = []
  const dup = []
  for (const b of kept) {
    const lines = raw.slice(b.open, b.close + 1)
    if (entries.has(b.id)) dup.push(b.id)
    entries.set(b.id, { lines, value: normalizeBlock(masked.slice(b.open, b.close + 1)) })
    if (!dup.includes(b.id)) order.push(b.id)
  }
  return {
    ok: kept.length > 0,
    entries,
    order,
    failed: [...new Set(failed)],
    dup: [...new Set(dup)],
    error: kept.length > 0 ? '' : '未定位到任何注册块(缩进判据不成立)',
  }
}

/** 注册块的语义指纹:剥注释、并空白、统一引号 ⇒ 只有真改了字段值才会变。 */
export function normalizeBlock(lines) {
  return lines
    .map((l) =>
      String(l)
        .replace(/\/\/[^\n]*/g, '')
        .replace(/['"]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((l) => l !== '')
    .join(' ')
}

export function extract(path, text) {
  return path === RUNNER_PATH ? extractRunnerEntries(text) : extractPkgEntries(text)
}

/** 豁免账:候选面上的 JSONL;畸形记录不生效并点名(裸原因=没有出口)。 */
export function parseLedger(text) {
  const ok = new Map()
  const bad = []
  if (!text) return { ok, bad, present: false }
  for (const line of splitLines(text)) {
    const t = line.trim()
    if (!t || t.startsWith('//')) continue
    let rec
    try {
      rec = JSON.parse(t)
    } catch {
      bad.push(`记录无法解析:${t.slice(0, 60)}`)
      continue
    }
    const path = String(rec?.path ?? '').replace(/\\/g, '/')
    const entry = String(rec?.entry ?? '')
    const reason = String(rec?.reason ?? '').trim()
    if (!path || !entry) bad.push(`记录缺 path/entry:${t.slice(0, 60)}`)
    else if (!reason) bad.push(`记录缺非空 reason(裸标记不生效):${path}#${entry}`)
    else ok.set(`${path}#${entry}`, reason)
  }
  return { ok, bad, present: true }
}

/**
 * 单文件判定核心(纯函数,与取材分开 ⇒ 自检能构造)。
 * 三态严格分开:p1 / p2 / und;pass 只统计"逐字等值"的条目,绝不与 und 合并。
 */
export function judgeFile({ path, headText, candText, candAbsent, ledger }) {
  const r = { path, p1: [], p2: [], und: [], exempted: [], pass: 0, headEntries: 0, candEntries: 0 }
  if (candAbsent) {
    r.und.push({ entry: '(整个文件)', why: '候选面取不到该路径(文件被删/未暂存),不判绿' })
    return r
  }
  const H = extract(path, headText)
  const C = extract(path, candText)
  if (!H.ok) {
    r.und.push({ entry: '(整个文件)', why: `HEAD 面抽取失败:${H.error}` })
    return r
  }
  if (!C.ok) {
    r.und.push({ entry: '(整个文件)', why: `候选面抽取失败:${C.error}` })
    return r
  }
  r.headEntries = H.entries.size
  r.candEntries = C.entries.size
  // 抽取器自己"看不见"的条目不许蒸发:定位失败/重号一律点名成未判定。
  if (H.failed && H.failed.length) {
    r.und.push({ entry: '(HEAD 侧)', why: `${H.failed.length} 个注册块定位失败:${H.failed.slice(0, 5).join(',')}` })
  }
  for (const f of C.failed || []) {
    if (H.entries.has(f)) r.und.push({ entry: f, why: '候选面该注册块定位失败 ⇒ 无法判定(不得当成通过)' })
  }
  for (const d of [...new Set([...(C.dup || []), ...(H.dup || [])])]) {
    r.und.push({ entry: d, why: '同一 id 出现多块 ⇒ 键轴不唯一,交人工(不判绿)' })
  }
  const linesEqual = (a, b) => {
    if (!a || !b) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }
  for (const [key, h] of H.entries) {
    if (key === '(未定位)') continue
    if (!C.entries.has(key)) {
      const why = 'HEAD 有该条目,候选面整条不见(P1 型写回)'
      const reason = ledger && ledger.ok.get(`${path}#${key}`)
      if (reason) r.exempted.push({ entry: key, why: `${why};豁免理由:${reason}` })
      else r.p1.push({ entry: key, why })
      continue
    }
    const c = C.entries.get(key)
    if (linesEqual(h.lines, c.lines)) {
      r.pass += 1
      continue
    }
    if (String(h.value) === String(c.value)) {
      r.und.push({
        entry: key,
        why: '逐行不等但语义等值(键序/缩进/引号重排)⇒ 未判定,不算 P2 也不算通过',
      })
      continue
    }
    const diff = []
    const max = Math.max(h.lines.length, c.lines.length)
    for (let i = 0; i < max; i++) {
      const a = h.lines[i] ?? '(无)'
      const b = c.lines[i] ?? '(无)'
      if (a !== b) diff.push(`L${i + 1} HEAD「${String(a).trim().slice(0, 70)}」↔ 候选「${String(b).trim().slice(0, 70)}」`)
    }
    r.p2.push({
      entry: key,
      why: `逐行不等(行数 ${h.lines.length}↔${c.lines.length}):${diff.slice(0, 3).join(' | ')}`,
    })
  }
  const headOrderKey = H.order.join('\u0000')
  const candOrderKey = C.order.filter((k) => H.entries.has(k)).join('\u0000')
  if (headOrderKey !== candOrderKey && r.p1.length === 0) {
    r.und.push({ entry: '(条目顺序)', why: 'HEAD 与候选面的条目排列不同 ⇒ 未判定(逐行集合等值不解释顺序漂开)' })
  }
  for (const b of ledger && ledger.bad ? ledger.bad : []) {
    r.und.push({ entry: '(豁免账)', why: b })
  }
  return r
}

/** 清单(基准面=HEAD 树)+ 存在性按候选面核验 + 两侧正文各一次批量读满。 */
export function collect({ root, face }) {
  const headPaths = String(
    gitRaw(['ls-tree', '-r', '--name-only', 'HEAD'], root, { timeout: 60000 }) ?? '',
  )
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((p) => p)
  // 清单只按 HEAD 面 ⇒ 候选面(盘上/索引)里"HEAD 没有"的注册表文件不参与判定
  const listed = filterRegistry(headPaths)
  if (listed.length === 0) {
    return { paths: [], enumerated: 0, error: 'HEAD 面枚举到 0 个注册表文件' }
  }
  let present = listed
  if (face === 'staged') {
    const idx = new Set(
      String(gitRaw(['ls-files', '--'], root, { timeout: 60000 }) ?? '')
        .split(/\r?\n/)
        .map((s) => s.trim()),
    )
    present = listed.filter((p) => idx.has(p))
  }
  const headSpecs = listed.map((p) => `HEAD:${p}`)
  const candSpecs = face === 'staged' ? present.map((p) => `:${p}`) : []
  const headMap = catBatch(root, headSpecs, { timeout: 120000 })
  const candIndex = face === 'staged' ? catBatch(root, candSpecs, { timeout: 120000 }) : null
  const files = listed.map((p) => {
    const headText = headMap.get(`HEAD:${p}`)
    let candText = null
    if (headText === undefined || headText === null) {
      return { path: p, headText: null, candText: null, headAbsent: true }
    }
    if (face === 'staged') candText = present.includes(p) ? candIndex.get(`:${p}`) ?? null : null
    else candText = readWorktreeFile(root, p)
    return { path: p, headText, candText, headAbsent: false }
  })
  const ledgerText =
    face === 'staged'
      ? catBatch(root, [`HEAD:${EXEMPT_LEDGER}`, `:${EXEMPT_LEDGER}`], { timeout: 60000 }).get(
          `:${EXEMPT_LEDGER}`,
        ) ?? null
      : readWorktreeFile(root, EXEMPT_LEDGER)
  return { paths: listed, files, enumerated: listed.length, ledgerText, error: null }
}

/** 一次完整审计(纯口径 + 取材都在此,镜像测试与自检都走它)。 */
export function run({ root = REPO_ROOT, face = 'worktree', strict = false } = {}) {
  const res = { face, strict, docs: [], p1: 0, p2: 0, und: 0, exempted: 0, enumerated: 0, error: null }
  let got
  try {
    got = collect({ root, face })
  } catch (e) {
    res.error = e instanceof Undetermined ? e.message : `取材异常:${String(e && e.message).slice(0, 120)}`
    return res
  }
  if (got.error) {
    res.error = got.error
    return res
  }
  res.enumerated = got.enumerated
  const ledger = parseLedger(got.ledgerText)
  for (const f of got.files) {
    if (f.headAbsent) {
      res.docs.push({
        path: f.path,
        p1: [],
        p2: [],
        und: [{ entry: '(整个文件)', why: 'HEAD 面取不到该路径 ⇒ 无法判定(不判绿)' }],
        exempted: [],
        pass: 0,
        headEntries: 0,
        candEntries: 0,
      })
      continue
    }
    res.docs.push(
      judgeFile({
        path: f.path,
        headText: f.headText,
        candText: f.candText,
        candAbsent: f.candText === null,
        ledger,
      }),
    )
  }
  for (const d of res.docs) {
    res.p1 += d.p1.length
    res.p2 += d.p2.length
    res.und += d.und.length
    res.exempted += d.exempted.length
  }
  return res
}

/** 结论行(永远最后打印,一行读完四个维度)。 */
export function conclusion(res, { blocking }) {
  const faceLabel = res.face === 'staged' ? '候选=索引 blob' : '候选=工作树磁盘'
  const tier = blocking ? '问责(判红)' : '只报数(不判红)'
  return `结论:${faceLabel},基准=HEAD blob,档=${tier} ⇒ P1 缺失 ${res.p1} 条 / P2 改写 ${res.p2} 条 / 未判定 ${res.und} 条 / 豁免 ${res.exempted} 条 / 注册表文件 ${res.enumerated} 份`
}

export function report(res, { json = false } = {}) {
  const blocking = res.face === 'staged' || res.strict
  if (res.error) {
    console.error(`❌ 无法判定:${res.error}(既不记绿也不判红)`)
    return 2
  }
  if (!res.enumerated) {
    console.error('❌ 枚举到 0 个注册表文件 ⇒ 判死(空扫与"都没违规"同形,不得记通过)')
    return 2
  }
  if (json) {
    console.log(JSON.stringify({ ...res, blocking }))
    return blocking && (res.p1 + res.p2 > 0) ? 1 : 0
  }
  for (const d of res.docs) {
    if (!d.p1.length && !d.p2.length && !d.und.length) continue
    console.log(`📄 ${d.path}(HEAD 条目 ${d.headEntries} 条,候选条目 ${d.candEntries} 条)`)
    for (const x of d.p1) console.log(`   ❌ [P1 缺失] ${x.entry}:${x.why}`)
    for (const x of d.p2) console.log(`   ❌ [P2 改写] ${x.entry}:${x.why}`)
    for (const x of d.exempted) console.log(`   ✅ [豁免] ${x.entry}:${x.why}`)
    for (const x of d.und) console.log(`   ❓ [未判定] ${x.entry}:${x.why}`)
  }
  if (res.p1 + res.p2 > 0 && !blocking) {
    console.log(
      'ℹ️ 缺省档只报数:工作树副本此刻属于别的会话,当场判红 = 把别人的在飞状态算成本提交人的账 ⇒',
    )
    console.log('   唯一结局是每个会话 --no-verify(§12e,连带约 190 道门作废)。要问责请用 --strict。')
    console.log('   确属有意删除:在候选面落 ' + EXEMPT_LEDGER + ' 的一条 {path,entry,reason}(不带原因不生效)。')
  }
  console.log(conclusion(res, { blocking }))
  return blocking && res.p1 + res.p2 > 0 ? 1 : 0
}

/* ------------------------------------------------------------------ 自检 */

const PKG_A = [
  '{',
  '  "name": "x",',
  '  "scripts": {',
  '    "check:a": "node 1",',
  '    "check:b": "node 2",',
  '    "check:c": "node 3",',
  '    "check:d": "node 4",',
  '    "check:e": "node 5"',
  '  },',
  '  "deps": {}',
  '}',
].join('\n')
/** 中间两键互换:每一条目的逐字行(含行尾逗号)都没变,只有排列变了 ⇒ 纯换序夹具。 */
const PKG_REORDER = [
  '{',
  '  "name": "x",',
  '  "scripts": {',
  '    "check:a": "node 1",',
  '    "check:c": "node 3",',
  '    "check:b": "node 2",',
  '    "check:d": "node 4",',
  '    "check:e": "node 5"',
  '  },',
  '  "deps": {}',
  '}',
].join('\n')
/** 键与值一字未改,只有缩进被重排(prettier 型) ⇒ 逐行不等、语义等值。 */
const PKG_REFLOW = PKG_A.replace('    "check:b": "node 2",', '      "check:b": "node 2",')
const PKG_DROP_B = PKG_A.replace('    "check:b": "node 2",\n', '')
const RUNNER_A = [
  'const gates = [',
  '  {',
  "    id: '10',",
  "    script: 'a.mjs',",
  "    mode: 'blocking',",
  '    args: [],',
  '  },',
  '  {',
  "    id: '11',",
  "    script: 'b.mjs',",
  "    mode: 'blocking',",
  '  },',
  ']',
].join('\n')

const led = (recs) => parseLedger(recs.map((r) => JSON.stringify(r)).join('\n'))

/** 成对正反例:每一条都指定"应该看见什么",不看感觉。 */
export function selfTest() {
  const rows = []
  const ok = (name, cond, why = '') => rows.push({ name, ok: !!cond, why })
  const j = (path, head, cand, ledger = { ok: new Map(), bad: [], present: false }) =>
    judgeFile({ path, headText: head, candText: cand, candAbsent: false, ledger })

  // S1 干净面:候选==HEAD ⇒ 四维全 0,pass==HEAD 条目数
  const s1 = j('package.json', PKG_A, PKG_A)
  ok('S1 候选==HEAD ⇒ P1/P2/未判定全 0', s1.p1.length === 0 && s1.p2.length === 0 && s1.und.length === 0 && s1.pass === 5, JSON.stringify(s1))
  // S2 与 S1 成对:整条键被抹掉 ⇒ 必须点名该键
  const s2 = j('package.json', PKG_A, PKG_DROP_B)
  ok('S2 少一行 ⇒ P1 恰好点名 check:b', s2.p1.length === 1 && s2.p1[0].entry === 'check:b' && s2.p2.length === 0)
  // S3 与 S2 成对:仅仅换序 ⇒ 不得算 P1
  const s3 = j('package.json', PKG_A, PKG_REORDER)
  ok('S3 纯换序(行内容一致)⇒ 不算 P1 也不算 P2', s3.p1.length === 0 && s3.p2.length === 0 && s3.pass === 5, JSON.stringify(s3.p1.concat(s3.p2).map((x) => x.entry)))
  ok('S3b 与 S3 成对:换序必须落"未判定"并点名,不许静默', s3.und.length === 1 && s3.und[0].entry === '(条目顺序)')
  // S4 未被跟踪的文件不参与:枚举只住在 HEAD 面,候选面多出的注册表进不了射程
  const s4 = filterRegistry([
    'package.json',
    'apps/api/package.json',
    'node_modules/left-pad/package.json',
    RUNNER_PATH,
    'src/a.ts',
  ])
  ok('S4 射程枚举只收 package.json 与 runner(排除 node_modules)', s4.length === 3 && !s4.includes('node_modules/left-pad/package.json') && !s4.includes('src/a.ts'), s4.join(','))
  const ownSrc = String(readWorktreeFile(REPO_ROOT, 'scripts/check-registry-worktree-superset.mjs') ?? '')
  // 自指导出的字面量:把要禁的东西拆开写,否则这条锁会被自己的源码点亮(2026-10-06 实测踩过)。
  const fsImport = ['from ', "'node:", "fs'"].join('')
  ok(
    'S4b 枚举源必须是 HEAD 面(不 readdir 磁盘 ⇒ 未跟踪文件没有入场券)',
    /ls-tree[^\n]*'HEAD'/.test(ownSrc) && !ownSrc.includes(fsImport),
  )
  // S5 语义等值而逐行不等 ⇒ 落未判定,并点名,绝不并到 P2 里
  const s5 = j('package.json', PKG_A, PKG_REFLOW)
  ok('S5 prettier 重排 ⇒ 未判定(不是 P2)', s5.p2.length === 0 && s5.und.length >= 1 && s5.und[0].entry === 'check:b', JSON.stringify(s5))
  // S6 与 S5 成对:命令真改了 ⇒ P2,带行级差异
  const s6 = j('package.json', PKG_A, PKG_A.replace('"check:b": "node 2"', '"check:b": "node 9"'))
  ok('S6 值改写 ⇒ P2 点名 check:b', s6.p2.length === 1 && s6.p2[0].entry === 'check:b')
  // S7 runner:整块被抹 ⇒ P1 点名 id
  const s7 = j(RUNNER_PATH, RUNNER_A, RUNNER_A.replace(/ {2}\{\n {4}id: '11',[\s\S]*?\n {2}\},\n/, ''))
  ok('S7 runner 少一块 ⇒ P1 点名 id 11', s7.p1.length === 1 && s7.p1[0].entry === '11', JSON.stringify(s7.p1))
  // S8 与 S7 成对:字段值漂开 ⇒ P2
  const s8 = j(RUNNER_PATH, RUNNER_A, RUNNER_A.replace("mode: 'blocking',\n    args: []", "mode: 'advisory',\n    args: []"))
  ok('S8 runner 改 mode ⇒ P2 点名 id 10', s8.p2.length === 1 && s8.p2[0].entry === '10')
  // S9 与 S8 成对:引号/缩进写法换了、字段值没换 ⇒ 未判定
  const s9 = j(RUNNER_PATH, RUNNER_A, RUNNER_A.replace("    id: '10',", "    id: \"10\","))
  ok('S9 引号换形而语义等值 ⇒ 未判定,不得算 P2', s9.p2.length === 0 && s9.und.length >= 1, JSON.stringify(s9.und))
  // S10 P2 判据是**逐行等值**而不是行数等值:行数同、内容漂 ⇒ 必须 P2
  const s10 = j(RUNNER_PATH, RUNNER_A, RUNNER_A.replace("    script: 'a.mjs',", "    script: 'z.mjs',"))
  ok('S10 行数相等而正文漂开 ⇒ P2(换成行数比较就看不见)', s10.p2.length === 1 && s10.p2[0].entry === '10')
  // S11 候选面 JSON 坏了 ⇒ 未判定,不许静默
  const s11 = j('package.json', PKG_A, '{"scripts": {,}')
  ok('S11 候选面解析失败 ⇒ 未判定并点名', s11.p2.length === 0 && s11.p1.length === 0 && s11.und.length === 1)
  // S12 候选面整份文件没了 ⇒ 未判定(不是 P1 汇总,也不判绿)
  const s12 = judgeFile({ path: 'package.json', headText: PKG_A, candText: null, candAbsent: true, ledger: led([]) })
  ok('S12 候选面缺文件 ⇒ 未判定,绝不记通过', s12.und.length === 1 && s12.p1.length === 0)
  // S13 豁免账成对:带原因 ⇒ 豁免并点名;裸原因 ⇒ 照红
  const s13a = j('package.json', PKG_A, PKG_DROP_B, led([{ path: 'package.json', entry: 'check:b', reason: 'G-1 归档两步走' }]))
  const s13b = j('package.json', PKG_A, PKG_DROP_B, led([{ path: 'package.json', entry: 'check:b', reason: '  ' }]))
  ok('S13 豁免带原因 ⇒ 从 P1 转入豁免维(仍点名)', s13a.p1.length === 0 && s13a.exempted.length === 1)
  ok('S13b 与 S13 成对:裸标记不生效 ⇒ 照计 P1', s13b.p1.length === 1 && s13b.exempted.length === 0)
  // S14 三档定级:同一判据,只有 blocking 换 ⇒ 退出码换,计数不换
  const mk = (face, strict) => ({ face, strict, p1: 1, p2: 0, und: 0, exempted: 0, enumerated: 3, error: null, docs: [] })
  ok('S14 缺省(磁盘档)只报数 ⇒ exit 0', report(mk('worktree', false), { json: true }) === 0)
  ok('S14b --strict 同一计数判红 ⇒ exit 1', report(mk('worktree', true), { json: true }) === 1)
  ok('S14c 提交链档(索引)判红 ⇒ exit 1', report(mk('staged', false), { json: true }) === 1)
  // S15 空枚举判死(不记绿)
  const s15 = report({ face: 'worktree', strict: false, docs: [], p1: 0, p2: 0, und: 0, exempted: 0, enumerated: 0, error: null }, { json: false })
  ok('S15 枚举到 0 个注册表文件 ⇒ exit 2,绝不记绿', s15 === 2)
  // S16 两面旗同给 ⇒ 判死
  ok('S16 --staged 与 --worktree 同给 ⇒ 判死', selectFace({ staged: true, worktree: true, def: 'worktree' }).error !== null)
  // S17 真仓射程:两份注册表必须都被枚举到
  ok('S17 射程含根 package.json 与 runner', isRegistryPath('package.json') && isRegistryPath(RUNNER_PATH) && !isRegistryPath('node_modules/x/package.json') && !isRegistryPath('src/a.ts'))

  const bad = rows.filter((x) => !x.ok)
  console.log(`—— 自检 ${rows.length - bad.length}/${rows.length} 通过${bad.length ? ' ✗' : ' ✅'}`)
  for (const x of bad) console.log(`   ✗ ${x.name} ${x.why}`)
  return bad.length ? 1 : 0
}

function main(argv) {
  const has = (f) => argv.includes(f)
  if (has('--self-test')) return selfTest()
  const picked = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'worktree' })
  if (picked.error) {
    console.error(`❌ ${picked.error} ⇒ 无法判定`)
    return 2
  }
  const res = run({ root: REPO_ROOT, face: picked.face, strict: has('--strict') })
  return report(res, { json: has('--json') })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ 脚本自身异常:${String(e && e.message).split(/\r?\n/)[0]}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  run,
  collect,
  judgeFile,
  extract,
  filterRegistry,
  extractPkgEntries,
  extractRunnerEntries,
  parseLedger,
  conclusion,
  report,
  selfTest,
  isRegistryPath,
  RUNNER_PATH,
  EXEMPT_LEDGER,
  PKG_A,
  PKG_REORDER,
  PKG_REFLOW,
  PKG_DROP_B,
  RUNNER_A,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
