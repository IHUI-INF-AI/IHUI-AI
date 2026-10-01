#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 活文档点名路径的三面存续性对账(D169,2026-09-30 立)
 *
 * ── 立因(不是假想,是已发生的事故那一格)────────────────────────────────
 * `docs/benchmark-evidence/2026-09/` 下 6 份对账件曾在 HEAD 树在位、工作树同值,
 * 而**索引把它们记成了删除**。三道既有门在这一格上结构全部失明:
 *   · 守门 99(check-staged-deletions)刻意不把 .md 叙述算引用 —— 防"误红满天";
 *   · 守门 71(check-plan-line-loss)只管登记行的丢失,不管登记行**点名的文件**;
 *   · heal-worktree-tracked 的三判据够不到"索引面单侧缺失"这一格。
 * 于是一次**不带 pathspec 的普通提交**就能把 `PROJECT_PLAN.md` 与
 * `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md` 正文点名的取证件从版本树里删掉,而账面零声响。
 * 本门补的就是这一格:**活文档正文点名(反引号包裹)的仓内路径,必须在被审面在位**。
 *
 * ── 判什么(取材面与点名判据)────────────────────────────────────────────
 * 取材面(谁的正文被审)= `PROJECT_PLAN.md` + `AGENTS.md` + 任意层 `README*.md` +
 * `docs/` 下递归全部 .md(按被审面枚举,不 readdirSync 磁盘 —— 13c 的 A1/A2 同课)。
 * 点名判据 = 反引号包裹、且以白名单目录前缀开头的仓内相对路径:
 *   `docs/…` `scripts/…` `apps/…` `packages/…` `config/…`。
 * 白名单防误报是**刻意的窄**:本门**不**把 .md 引用一律升成守门 99 的 E1
 * (误红满天 ⇒ 恒红门 ⇒ 跳钩子连带守门作废,§12e)。
 * 提取时的归一(每条都写在 normalizeToken 的注释里,自检 ⑥⑦⑧⑪ 钉住):
 *   · 剥行号锚 `path:66` / `path:66-78`、剥 `#fragment`、剥尾部标点 —— 那仍是**对同一文件**的点名;
 *   · 含 `{` `}` `*` `?` 的形态(braces / glob)与反引号**外**的提及一律不算点名 ——
 *     它们不是"某一个文件在不在"的问题,升成存在性判据只会制造假红。
 *
 * ── 三面判据(只有三条)──────────────────────────────────────────────────
 *   ① 索引或工作区缺、而 HEAD 在位 ⇒ **红**(正是事故那一格);
 *   ② 三面齐在 ⇒ 绿;
 *   ③ HEAD 本就没有 ⇒ **报数不算红**,warning 点名(可能是新文档笔误,不是事故)。
 *   为什么 ③ 不判红:把"文档笔误"升成红就是恒红门(§12e),存量按"该文件 HEAD
 *   自身计数"如实报数 —— 现状是缺口不是存量,本门**不照票面去"恢复"任何东西**。
 *
 * ── 两个判定面(取材与被审同面同轮,不混面)────────────────────────────────
 *   缺省(审计档)= 从 **HEAD 面**的活文档取点名,对每个点名路径核三面。这一档
 *     供人工/CI 审计;HEAD 面是"存量自身计数",与工作树滞后无关(70/77/98 同口径)。
 *   `--staged`(提交链档,ratchet)= 只从**索引面**的活文档取点名,判"索引 vs HEAD":
 *     HEAD 在位而索引缺 ⇒ 红(本次提交正要把点名文件弄丢)。工作区**不参与**这一档
 *     —— 盘上随后改对不算修好,提交进去的仍是索引这一份(face-reader 同课)。
 *     索引里连文档都删了的,它的 HEAD 形态**不**回彩:提交面自洽以提交面自己的
 *     正文为准(删了点名者,不等于获得了删被点名者的豁免,但也不再由它点名)。
 *   两面旗同给 / 枚举到 0 份活文档 / 全部活文档里一条点名都提不出来 ⇒ **exit 2 判死**
 *   (空扫与"都没违规"同形是本仓最贵的假绿;提取器哑火尤其要响)。
 *
 * ── 棘轮与定级──────────────────────────────────────────────────────────
 * 本门只拦"本次提交把点名文件弄丢"(--staged 档),**不追存量**:存量按 HEAD 自身
 * 计数如实报数,首跑不红。注册进 scripts/guardian-runner.mjs 的条目是 blocking,
 * 但红格只有事故那一格 —— 修复出口在 onFailHint 里:`git restore --staged <path>`
 * (找回误删)或同步更新点名它的活文档;**本门只读,不代恢复,不删文件**。
 *
 * 用法:node scripts/check-live-doc-references.mjs [--staged|--json|--self-test]
 * 退出码:0 通过(可含 warning)/ 1 检出红格 / 2 无法判定(取材失败、枚举到 0、零点名)
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { gitRaw, selectFace } from './lib/face-reader.mjs'

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(dirname(SELF_DIR))

/** 白名单目录前缀(票面口径,刻意窄):只认这五个前缀下的反引号路径。 */
export const REF_PREFIXES = ['docs/', 'scripts/', 'apps/', 'packages/', 'config/']

/**
 * 取材面(谁的正文被审):PROJECT_PLAN.md + AGENTS.md + 任意层 README*.md + docs/ 递归全部 .md。
 * 只定射程,不定判据 —— 判据在 normalizeToken / judgeRefs。
 */
export const MATERIAL_RE = /^(PROJECT_PLAN\.md|AGENTS\.md|docs\/[^]+\.md)$|(^|\/)README[^/]*\.md$/

/**
 * 从一篇活文档正文提取点名路径(纯函数,自检与镜像测试都钉这一份):
 *  1. 只取反引号内的候选 —— 反引号**外**的提及不算引用(守门 99 的教训:叙述≠引用,反过来也一样);
 *  2. 白名单前缀过滤(REF_PREFIXES);
 *  3. 剥 `#fragment`、剥行号锚 `:66` / `:66-78`、剥尾部标点 —— 那仍是对同一文件的点名;
 *  4. 含 `{ } * ?` 的 braces/glob 形态整条丢弃:它们不是"某个文件在不在"的问题。
 * 返回 Map<路径, {form:'file'|'dir', docs:Set<文档>}>;form=dir 的判据走目录前缀,不走精确路径。
 */
/**
 * 单个反引号候选的归一(纯函数,提取判据的**唯一**实现;正文路径与 git grep 路径共用这一份):
 *  1. 白名单前缀过滤(REF_PREFIXES);
 *  2. 剥 `#fragment`、剥行号锚 `:66` / `:66-78`、剥尾部标点 —— 那仍是对同一文件的点名;
 *  3. 含 `{` `}` `*` `?` 的形态(braces / glob)与反引号内带空白的整条丢弃 ——
 *     它们不是"某一个文件在不在"的问题,升成存在性判据只会制造假红。
 * 返回 {key, form} 或 null;form=dir 的判据走目录前缀,不走精确路径。
 */
export function normalizeToken(raw) {
  let p = String(raw).trim()
  if (!REF_PREFIXES.some((pre) => p.startsWith(pre))) return null
  if (/[\s\\{}*?]/.test(p)) return null // braces / glob / 反引号内带空白 —— 不是单一路径点名
  p = p.replace(/#.*$/, '') // #fragment 锚
  p = p.replace(/::[^/:]+$/, '') // 语言符号锚 path::func(仍是对同一文件的点名)
  p = p.replace(/:\d+(?:-\d+)?$/, '') // 行号锚 path:66 / path:66-78
  p = p.replace(/[.,;:!?)\]}】」』》,、。;;!!??]+$/, '') // 尾部标点是句子结构,不是路径成分(含中文标点)
  if (!p || !REF_PREFIXES.some((pre) => p.startsWith(pre))) return null
  const form = p.endsWith('/') || !/\.[A-Za-z0-9]{1,12}$/.test(p) ? 'dir' : 'file'
  const key = form === 'dir' ? p.replace(/\/+$/, '') : p
  if (!key) return null
  return { key, form }
}

function addRef(refs, doc, norm) {
  if (!norm) return
  let rec = refs.get(norm.key)
  if (!rec) {
    rec = { form: norm.form, docs: new Set() }
    refs.set(norm.key, rec)
  }
  rec.docs.add(doc)
}

/**
 * 从一篇活文档正文提取点名路径(纯函数,自检钉住):只取反引号内的候选 ——
 * 反引号**外**的提及不算引用(守门 99 的教训:叙述≠引用,反过来也一样)。
 * 返回 Map<路径, {form, docs:Set<文档>}>。
 */
export function extractRefs(text, doc) {
  const out = new Map()
  if (!text) return out
  for (const m of String(text).matchAll(/`([^`\n]+)`/g)) addRef(out, doc, normalizeToken(m[1]))
  return out
}

/**
 * 一条点名在"路径清单面"的在位性(纯函数):file 走精确命中,dir 走"任一路径以其为前缀"。
 * @param {Set<string>} set 全量路径清单(ls-tree / ls-files,均带 core.quotepath=false)
 */
export function presentIn(set, key, form) {
  if (form === 'file') return set.has(key)
  if (set.has(key)) return true // 目录自身被文件清单命中(名字恰好是文件)也算在位
  const pre = key + '/'
  for (const p of set) if (p.startsWith(pre)) return true
  return false
}

/**
 * 判定(纯函数,注入面清单,自检不碰 git):
 *  face='audit'  ⇒ 三面:红 = HEAD 在位 ∧(索引缺 ∨ 工作区缺);
 *  face='staged' ⇒ 两面:红 = HEAD 在位 ∧ 索引缺(本次提交正把点名文件弄丢);
 *  HEAD 缺 ⇒ warning(报数不算红)。取不到工作区答案(workCheck 抛)⇒ 计入 undetermined。
 */
export function judgeRefs({ refs, headSet, indexSet, workCheck, face }) {
  const res = { green: 0, red: [], warn: [], undetermined: [], total: 0 }
  for (const [key, rec] of refs) {
    res.total += 1
    let inHead
    try {
      inHead = presentIn(headSet, key, rec.form)
    } catch (e) {
      res.undetermined.push(`${key}:HEAD 面在位性取不到(${e?.message ?? e})`)
      continue
    }
    if (!inHead) {
      res.warn.push({ path: key, docs: [...rec.docs], why: 'HEAD 本就没有(可能笔误,不算红)' })
      continue
    }
    const inIndex = presentIn(indexSet, key, rec.form)
    if (face === 'staged') {
      if (!inIndex) res.red.push({ path: key, missing: ['index'], docs: [...rec.docs] })
      else res.green += 1
      continue
    }
    if (!inIndex) {
      res.red.push({ path: key, missing: ['index'], docs: [...rec.docs] })
      continue
    }
    let inWork
    try {
      inWork = workCheck(key, rec.form)
    } catch (e) {
      res.undetermined.push(`${key}:工作区在位性取不到(${e?.message ?? e})`)
      continue
    }
    if (!inWork) res.red.push({ path: key, missing: ['worktree'], docs: [...rec.docs] })
    else res.green += 1
  }
  return res
}

/** 工作区在位性(生产实现):file/dir 都是 existsSync;读不到当作不在位由判据点名。 */
function workExists(root, key) {
  return existsSync(join(root, key))
}

/**
 * 取材面的枚举与候选提取(被审面枚举 + 同面取材,不混面)。
 *
 * ⚠️ 候选提取刻意**不走** face-reader 的 `catBatch`(cat-file --batch 喂 stdin),也不逐文档
 * `git show`(288 份活文档 = 288 次派生,实测 97s,提交链挂不起):
 * 2026-09-30 实证,本机病会话里「Node 给子进程建 stdin 管道」确定性 EBUSY,更阴的一型是
 * "管道建成了但喂进去的内容静默丢失"(合法 OID 包空 blob)。所以这里用**一次**
 * `git grep -o -E '`[^`]+`'`(零 stdin,gitRaw 的 stdio=['ignore','pipe','pipe'] 恰是
 * EBUSY 配方要求的两态)把全部候选一次取回,秒级。
 *
 * 判据只住一份:grep 的正则**刻意最宽**(任何反引号包裹的串),前缀过滤/剥锚/丢 glob
 * 全部由 `normalizeToken` 那一份 JS 判据做 —— grep 只当"候选搬运工",不当尺子,
 * 两头各一把尺必然漂开(§22c 同一条理由)。
 * grep 整体失败(除"无命中"status=1 外)⇒ 抛 Undetermined,由 run 判死,不静默算零。
 */
function materialDocs({ root, face }) {
  const listArgs = face === 'staged' ? ['ls-files', '--'] : ['ls-tree', '-r', '--name-only', 'HEAD']
  return String(gitRaw(listArgs, root, { timeout: 60000 }))
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((p) => p && MATERIAL_RE.test(p))
}

function collectTokens({ root, face, docs }) {
  const args =
    face === 'staged'
      ? ['grep', '--cached', '--no-color', '-o', '-E', '`[^`]+`', '--', ...docs]
      : ['grep', '--no-color', '-o', '-E', '`[^`]+`', 'HEAD', '--', ...docs]
  let out
  try {
    out = gitRaw(args, root, { timeout: 120000, maxBuffer: 64 << 20 })
  } catch (e) {
    if (e?.status === 1) return [] // "无命中"是 grep 的正常非零结论,不是取材失败
    throw e
  }
  const tokens = []
  for (const line of String(out).split(/\r?\n/)) {
    const i = line.indexOf('`')
    if (i < 0) continue
    const j = line.lastIndexOf('`')
    if (j <= i) continue
    let path = line.slice(0, i).replace(/:$/, '')
    if (path.startsWith('HEAD:')) path = path.slice(5)
    if (!path) continue
    tokens.push({ doc: path, raw: line.slice(i + 1, j) })
  }
  return tokens
}

/**
 * 主判定。`face` 只改"从哪面取正文 + 工作区是否参与",三判据本身一字不分档。
 */
export function run({ root = REPO_ROOT, face = 'audit' } = {}) {
  const res = { face, docs: 0, refs: 0, green: 0, red: [], warn: [], undetermined: [] }
  let docs
  try {
    docs = materialDocs({ root, face })
  } catch (e) {
    res.undetermined.push(`取材面枚举失败:${e?.message ?? e}`)
    return res
  }
  res.docs = docs.length
  if (docs.length === 0) {
    res.undetermined.push('枚举到 0 份取材面活文档 ⇒ 空扫与"都没违规"同形,判死')
    return res
  }
  let tokens
  try {
    tokens = collectTokens({ root, face, docs })
  } catch (e) {
    res.undetermined.push(`候选提取失败:${e?.message ?? e}`)
    return res
  }
  const refs = new Map()
  for (const { doc, raw } of tokens) addRef(refs, doc, normalizeToken(raw))
  res.refs = refs.size
  if (refs.size === 0) {
    res.undetermined.push(
      `${docs.length} 份活文档里提取到 0 条点名 ⇒ 提取器哑火或取材面为空,判死`,
    )
    return res
  }
  let headSet
  let indexSet
  try {
    headSet = new Set(
      String(gitRaw(['ls-tree', '-r', '--name-only', 'HEAD'], root, { timeout: 60000 }).trim()).split('\n'),
    )
    indexSet = new Set(
      String(gitRaw(['ls-files', '--'], root, { timeout: 60000 }).trim())
        .split('\n')
        .filter(Boolean),
    )
  } catch (e) {
    res.undetermined.push(`面清单枚举失败:${e?.message ?? e}`)
    return res
  }
  const verdict = judgeRefs({
    refs,
    headSet,
    indexSet,
    workCheck: (key) => workExists(root, key),
    face,
  })
  res.green = verdict.green
  res.red = verdict.red
  res.warn = verdict.warn
  res.undetermined.push(...verdict.undetermined)
  return res
}

function oneLine(e) {
  return String(e?.message ?? e ?? '')
    .split(/\r?\n/)[0]
    .slice(0, 160)
}

function report(res, { json }) {
  if (json) {
    console.log(JSON.stringify(res, null, 2))
    return res.red.length ? 1 : res.undetermined.length ? 2 : 0
  }
  const label = { audit: 'HEAD 面正文 × 三面在位(审计档)', staged: '索引面正文 × 索引 vs HEAD(提交链档)' }[res.face]
  console.log(`活文档点名路径存续性对账 · 判定面=${label}`)
  console.log(
    `  取材活文档 ${res.docs} 份 · 点名路径 ${res.refs} 条 · 绿 ${res.green} · 红 ${res.red.length} · warning ${res.warn.length}`,
  )
  for (const r of res.red.slice(0, 12))
    console.log(`  ❌ ${r.path}(${r.missing.join('+')} 缺,HEAD 在位)← ${r.docs.slice(0, 3).join(', ')}`)
  if (res.red.length > 12) console.log(`  … 另 ${res.red.length - 12} 条红`)
  for (const w of res.warn.slice(0, 8))
    console.log(`  ⚠️ ${w.path}(HEAD 本就没有,报数不算红)← ${w.docs.slice(0, 3).join(', ')}`)
  if (res.warn.length > 8) console.log(`  … 另 ${res.warn.length - 8} 条 warning`)
  for (const u of res.undetermined) console.log(`  ❔ 未判定:${u}`)
  if (res.red.length)
    console.log(
      '  修复出口(二选一,本门只读不代恢复):误删 ⇒ `git restore --staged <path>` 找回;' +
        '确属下线 ⇒ 同步更新点名它的活文档。禁止用"改判据/加豁免"消红。',
    )
  const tail = res.red.length
    ? '结论:红 ⇒ 判红'
    : res.undetermined.length
      ? '结论:未判定 ⇒ 判死(不记绿)'
      : `结论:绿(${res.green}/${res.refs} 在位${res.warn.length ? `,另有 ${res.warn.length} 条 HEAD 缺席 warning` : ''})`
  console.log(tail)
  return res.red.length ? 1 : res.undetermined.length ? 2 : 0
}

/**
 * 构造面自检(零副作用、零 git):每条 cond 都是已求值的布尔(见 150 票㉛ 的教训)。
 * 覆盖:正例三面齐在 / 事故格反例(索引删 HEAD 在 ⇒ 红)/ 笔误 warning 档 /
 * 反引号外提及不算引用 / braces 丢弃 / 行号锚剥离 / 目录式点名 / staged 档不看工作区。
 */
export function selfTest() {
  const rows = []
  const t = (name, cond) => {
    rows.push({ name, ok: !!cond })
    console.log(`${!!cond ? '✓' : '✗'} ${name}`)
  }
  const mk = (pairs) => {
    const refs = new Map()
    for (const [k, form] of pairs) refs.set(k, { form, docs: new Set(['D.md']) })
    return refs
  }
  const H = new Set(['docs/keep.md', 'docs/dir/child.md', 'scripts/tool.mjs', 'scripts/run.sh'])
  const I = new Set(['docs/keep.md', 'docs/dir/child.md', 'scripts/tool.mjs', 'scripts/run.sh'])
  const work = (key) => key !== 'scripts/run.sh' // 构造:工作区唯独缺 run.sh

  t('① 正例:file 点名三面齐在 ⇒ 绿且无红', (() => {
    const r = judgeRefs({ refs: mk([['docs/keep.md', 'file']]), headSet: H, indexSet: I, workCheck: work, face: 'audit' })
    return r.green === 1 && r.red.length === 0 && r.warn.length === 0
  })())

  t('② 事故格反例:HEAD 在位、工作区在位、索引记删除 ⇒ 红(missing=index)', (() => {
    const I2 = new Set([...I].filter((p) => p !== 'docs/keep.md'))
    const r = judgeRefs({ refs: mk([['docs/keep.md', 'file']]), headSet: H, indexSet: I2, workCheck: work, face: 'audit' })
    return r.red.length === 1 && r.red[0].missing.includes('index')
  })())

  t('③ 工作区缺而 HEAD+索引在 ⇒ 红(missing=worktree)', (() => {
    const r = judgeRefs({ refs: mk([['scripts/run.sh', 'file']]), headSet: H, indexSet: I, workCheck: work, face: 'audit' })
    return r.red.length === 1 && r.red[0].missing.includes('worktree')
  })())

  t('④ 笔误档:HEAD 本就没有 ⇒ 只 warning,不红', (() => {
    const r = judgeRefs({ refs: mk([['docs/typo.md', 'file']]), headSet: H, indexSet: I, workCheck: work, face: 'audit' })
    return r.red.length === 0 && r.warn.length === 1
  })())

  t('⑤ 提交链档:索引缺而 HEAD 在 ⇒ 红;工作区不参与(盘上改对不算修好)', (() => {
    const I2 = new Set([...I].filter((p) => p !== 'docs/keep.md'))
    const r = judgeRefs({ refs: mk([['docs/keep.md', 'file']]), headSet: H, indexSet: I2, workCheck: () => true, face: 'staged' })
    return r.red.length === 1 && r.red[0].missing.includes('index')
  })())

  t('⑥ 提取:反引号外提及不算引用、braces/glob 丢弃', (() => {
    const text = '见 docs/outer.md 不带反引号;`scripts/{a,b}.ps1` 与 `docs/*.md` 都不是单一路径;`docs/inner.md` 才算。'
    const refs = extractRefs(text, 'D.md')
    return refs.size === 1 && refs.has('docs/inner.md')
  })())

  t('⑦ 提取:行号锚/fragment/尾部标点剥离后仍点名同一文件', (() => {
    const refs = extractRefs('`scripts/release-desktop-local.mjs:66-78`、`scripts/tool.mjs#用法`、`docs/keep.md。`', 'D.md')
    return refs.has('scripts/release-desktop-local.mjs') && refs.has('scripts/tool.mjs') && refs.has('docs/keep.md') && refs.size === 3
  })())

  t('⑧ 提取:目录式点名(尾斜杠/无扩展名)归 form=dir,且剥尾斜杠', (() => {
    const refs = extractRefs('`docs/benchmark-evidence/` 与 `apps/web`', 'D.md')
    return refs.get('docs/benchmark-evidence')?.form === 'dir' && refs.get('apps/web')?.form === 'dir'
  })())

  t('⑨ 在位性:dir 点名走前缀命中,file 点名走精确命中', (() => {
    return presentIn(H, 'docs/dir', 'dir') && !presentIn(H, 'docs/kee', 'file') && presentIn(H, 'docs/keep.md', 'file')
  })())

  t('⑩ 定级方向锁:audit 档工作区缺判红,同一输入 staged 档不判工作区红', (() => {
    const refs = mk([['scripts/run.sh', 'file']])
    const a = judgeRefs({ refs, headSet: H, indexSet: I, workCheck: work, face: 'audit' })
    const s = judgeRefs({ refs: mk([['scripts/run.sh', 'file']]), headSet: H, indexSet: I, workCheck: work, face: 'staged' })
    return a.red.length === 1 && s.red.length === 0 && s.green === 1
  })())

  t('⑪ 判据只住一份:git grep 候选路径(normalizeToken)与正文路径(extractRefs)同判据等值', (() => {
    const text = '见 `docs/a.md:12`、`scripts/{x,y}.ps1`、`apps/web/`、bare apps/api 与 `config/missing.yaml。`'
    const viaText = extractRefs(text, 'D.md')
    const raws = [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1])
    const viaTokens = new Map()
    for (const raw of raws) addRef(viaTokens, 'D.md', normalizeToken(raw))
    if (viaText.size !== viaTokens.size) return false
    for (const [k, rec] of viaText) {
      const other = viaTokens.get(k)
      if (!other || other.form !== rec.form || other.docs.size !== rec.docs.size) return false
    }
    return true
  })())

  const bad = rows.filter((r) => !r.ok)
  console.log(`—— 自检 ${rows.length - bad.length}/${rows.length} 通过${bad.length ? ' ✗' : ' ✅'}`)
  for (const r of bad) console.log(`   ✗ ${r.name}`)
  return bad.length ? 1 : 0
}

function main(argv) {
  const has = (f) => argv.includes(f)
  if (has('--self-test')) return selfTest()
  const picked = selectFace({ staged: has('--staged'), worktree: false, def: 'audit' })
  if (picked.error) {
    console.error(`❌ ${picked.error} ⇒ 无法判定`)
    return 2
  }
  try {
    return report(run({ root: REPO_ROOT, face: picked.face }), { json: has('--json') })
  } catch (e) {
    console.error(`❌ 脚本自身异常:${oneLine(e)}`)
    return 2
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ 脚本自身异常:${oneLine(e)}`)
    process.exitCode = 2
  }
}

export const __test__ = { run, selfTest, extractRefs, normalizeToken, judgeRefs, presentIn, MATERIAL_RE, REF_PREFIXES }

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
