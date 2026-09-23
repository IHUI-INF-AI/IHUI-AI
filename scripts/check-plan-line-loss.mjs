#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PROJECT_PLAN.md 登记行防丢守门(2026-09-22 立,guardian-runner 第 71 项,blocking)
 *
 * 根因(同日实测两次):共享工作区里并发会话按"自己内存里那份旧计划文档"整文件提交,
 * 把别的会话**已经入库**的登记行按旧基线回写掉 —— 一小时内 10 条 G-152/G-166/D107b
 * 进度行被抹两次(第一次我自己也是肇事者,见项目记忆 safe-commit-index-race 第 22 条)。
 * 既有 13c `check-project-plan-archive.mjs` 只守"### XXX(已完成 ✅) 任务条目"这一种行,
 * 进度登记是条目内的 bullet,完全不在它视野内 → 补这一道。
 *
 * 判据(按**标记**而非整行,避免正常改写文案被误判):
 *   1. 基线 = HEAD:PROJECT_PLAN.md 里的"登记行",三种形态:
 *      a) bullet 行含 `**G-<数字>` / `**D<数字>` / `**O<数字>` / `**P<数字>` / `**W<数字>` /
 *         `**守门 NN` / `**第N步` 这类加粗编号 —— 标记取加粗头原文前缀(≤18 字);
 *      b) **复选任务行** `- [ ] O13b 第二段…`(编号紧跟复选框,无加粗)—— 2026-09-23 实测
 *         本会话一枚 `e8d668ad77` 就是把别人的 `- [ ] O13b …`、`- [ ] **Esc 无层栈协议**…`
 *         两族任务行整行抹掉,而只认加粗的门当时报"无缺失";
 *      c) **批次标题行** `### 第十四批(…):…`(标题以中文序号开头)。
 *      且长度 ≥ 40(短行多为小标题,不算登记行)。
 *   2. 取该行的**编号标记**(如 `G-166 第⑤步`),若在待提交内容里完全找不到 → 判丢失。
 *      b/c 两族的标记 = 编号 + 紧随的短标题(遇括号/冒号/星号即停,≤18 字),不吞整段正文 ——
 *      这些行的括注与计数常被正当改写(追加 ⑤、改条数),吞进标记会稳定产假阳;
 *      而只取编号又会撞车(`O14` 在 `O14b2` 那行里也在、`D13` 在别人的引用里也在),
 *      删掉整行仍报不出。编号本身不足 3 字的(`P0`/`D6` 这类两处必撞的短串)直接放过。
 *      ⚠️ b/c 两族**只认"行首编号"这一路判活**(候选里必须仍有某一行登记行以该编号开头),
 *      不再退回全文文本搜索:实测 `O13b 第二段` 这一族的标题被另一条进度行**原样引用**
 *      (`- **进度(2026-09-23 ⑤)**:… O13b 第二段 ①②③⑤ 已落 …`),任务行整行被抹掉后全文
 *      照样搜得到 → 旧判据报"无缺失"、自愈也回捞不到(2026-09-23 注入实锤的残余面)。
 *      刻意**不把这个收紧套到既有 a) 加粗 bullet**(现 214 条):一并改判会把
 *      "把编号挪到句中重写"这类正当编辑判成丢失,误伤面不可估。
 *   3. 允许两种正当情形:
 *      a) 该登记行原文可在 `.ihui-agent/archive/PROJECT_PLAN_*.md` 里找到(§1 归档流程);
 *      b) 本次提交同时改动了基线里没有该行的位置(即该行本就不是 HEAD 内容) —— 由
 *         "只从 HEAD 取基线"天然保证。
 *
 * 用法:
 *   node scripts/check-plan-line-loss.mjs --staged   # pre-commit:比对暂存区内容
 *   node scripts/check-plan-line-loss.mjs            # 手动:比对工作区内容
 *   node scripts/check-plan-line-loss.mjs --self-test
 * 退出码:0 通过 / 1 检出丢失 / 2 用法或读取失败
 * 紧急跳过:HUSKY_SKIP_PLAN_LINE_LOSS=1 git commit ...(会把丢失写进历史,先确认为何丢)
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const GIT = process.env.IHUI_GIT_BIN || 'git'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN = 'PROJECT_PLAN.md'
const ARCHIVE_DIR = path.join(ROOT, '.ihui-agent', 'archive')
const MIN_LEN = 40

const git = (args, cwd = ROOT) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  })

/**
 * 新两族(裸编号复选任务行 / 批次标题行)的标记 = **编号 + 紧随的短标题**:
 * 遇 `*` `（` `(` `：` `:` 即停,不足 6 字则续到下一个分隔符,上限 18 字。
 * 只取编号本身不够 —— 注入验证实测:`O14`、`D13` 在两处任务行的正文里都能撞见
 * (`O14b2`、"见 D13" 这类),把整行删掉仍报"无丢失",判据空转。
 */
function titleMarker(rest) {
  const stops = []
  for (const m of rest.matchAll(/[*（(：:]/g)) stops.push(m.index)
  let end = stops.length ? stops[0] : rest.length
  if (end < 6) end = stops.find((s) => s >= 6) ?? rest.length
  return rest.slice(0, Math.min(end, 18)).trim()
}

/**
 * 登记行编号族。字母编号形态:G-166 / D107b / O13b2 / P2-F.10 / W18 / B15
 * (字母后缀与点号都要容得下);外加 `守门 NN` 一族 —— 各道闸门在计划里的登记行用的就是这个
 * 前缀(如 `**守门 72 \`scripts/check-dockerfile-copy-paths.mjs\`(sha …)**`),2026-09-23 实测
 * 有一枚并发暂存版本正整块删掉别人的守门登记,只认 G/D/P/W 会完全看不见。
 * `O\d+` / `B\d+` 两族同日补:计划里 O13b/O14b2/O19b/O20c、B15 这类任务行写成
 * `- [ ] O13b …` 裸编号,加粗正则看不见 —— 本会话 `e8d668ad77` 抹掉的第一条正是它。
 */
const ID = String.raw`G-\d+[a-z]?|D\d+[a-z]?|O\d+[a-z]*\d*|B\d+[a-z]?|P\d+(?:-[A-Za-z]+)?(?:\.\d+)?|W\d+|守门\s*\d+[a-z]?`
const ID_RE = new RegExp(`(${ID})`)
/** 复选框与其后多层状态装饰(`（进行中）` / `✅(日期)`)一起剥掉,露出真正的内容开头 */
function checkboxBody(line) {
  let body = line.replace(/^\s*[-*]\s\[[ xX]\]\s*/, '')
  if (body === line) return null
  for (;;) {
    const deco = body.match(/^(?:[✅⏳☑✔✓🕐⚠]?\s*[（(][^）)]*[）)]\s*)+/)
    if (!deco || !deco[0]) break
    body = body.slice(deco[0].length)
  }
  return body
}

/**
 * 行首编号(登记行的"身份"):复选任务行裸编号、批次标题行序号,以及加粗头紧跟编号的行。
 * 用途见 `registrationOf` 的注释 —— 单靠"标记字符串还在不在全文里"判丢失会被引用句骗过。
 */
export function headIdOf(line) {
  const cb = checkboxBody(line)
  if (cb !== null) {
    const m = cb.match(ID_RE)
    if (m && m.index === 0 && m[1].length >= 3) return m[1]
    return null
  }
  const h = line.match(/^#{2,4}\s*(第[0-9一二三四五六七八九十百①-⑳]+批)/)
  if (h) return h[1]
  const b = line.match(/^\s*[-*]\s(?:✅\s*(?:\([^)]*\)\s*)?|⏳\s*(?:\([^)]*\)\s*)?)?\*\*([^\s*]+)/)
  if (b) {
    const m = b[1].match(ID_RE)
    if (m && m.index === 0 && m[1].length >= 3) return m[1]
  }
  return null
}

/** 一份文档里"仍作为登记行行首存在"的编号集合 */
export function headIdSet(src) {
  const out = new Set()
  for (const line of src.split(/\r?\n/)) {
    const id = headIdOf(line)
    if (id) out.add(id)
  }
  return out
}

/**
 * 一条登记行的完整身份:marker = 用于"整行是否还在"的文本标记;id = 用于"这个编号还有没有
 * 任何一行登记行以它开头"的行首编号(只有新两族与加粗紧跟编号的行才有)。
 * 为什么要 id 这一路:`O13b 第二段` 这一族的标题被另一条进度行**原样引用**
 * (`- **进度(2026-09-23 ⑤)**:… O13b 第二段 ①②③⑤ 已落 …`),于是任务行整行被抹掉后,
 * 纯文本搜索仍命中 → 门报"无缺失"、自愈也回捞不到(2026-09-23 注入实锤的残余面)。
 * 只对"行首编号"这一路收紧,不动既有 214 条加粗 bullet 的判据语义,避免连带误伤。
 */
export function registrationOf(line) {
  const marker = markerOf(line)
  if (!marker) return null
  // ⚠️ 只有"新两族"才走行首编号判活。既有 214 条加粗 bullet(`- **G-166 第⑤步…**`)保持
  // 原文前缀文本搜索的旧语义 —— 一并收紧会把"把编号挪到句中重写"这类正当编辑判成丢失,
  // 误伤面不可估(本轮刻意按住)。
  const shape = /^\s*[-*]\s\[[ xX]\]/.test(line) ? 'checkbox' : /^#{2,4}\s/.test(line) ? 'heading' : 'bold'
  const id = shape === 'bold' ? null : headIdOf(line)
  return { marker, id, shape }
}

/**
 * 该登记行在候选内容里还算不算"存活"。
 * ⚠️ 有行首编号的条目**只认行首编号**,不再退回全文文本搜索 —— 否则"标题被别处原样引用"
 * 那一条正好把文本搜索喂饱,新判据等于没加(本条判据就是为它写的,实测过一遍才发现)。
 */
export function stillRegistered(entry, candidateSrc, candidateIds) {
  if (entry.id) return (candidateIds ?? headIdSet(candidateSrc)).has(entry.id)
  return candidateSrc.includes(entry.marker)
}

/** 登记行 → 编号标记(找不到返回 null) */
export function markerOf(line) {
  const isBullet = /^\s*[-*]\s/.test(line)
  // 标题行只有"以批次序号开头"这一种受保护形态(见文件头判据 1c),正文标题不进基线
  const isHeading = /^#{2,4}\s/.test(line)
  if (!isBullet && !isHeading) return null
  // 再外加 `第N步` 中文序号一族(数字/汉字/带圈数字) —— `**第⑥步 …**` 这类按步骤自造
  // 序号写的进度登记行此前完全不受保护:被并发旧基线覆写后 273 条扫描仍报"无缺失"
  // (2026-09-23 本会话实锤一枚"第⑥步"登记行被抹)。刻意只认 `步`:
  // "第N次/第N轮/第N阶段"是叙述而非登记序号,纳进必假红。
  if (line.trim().length < MIN_LEN) return null
  const m = isBullet
    ? line.match(new RegExp(`\\*\\*(${ID}|第[0-9一二三四五六七八九十①-⑳]+步)`))
    : null
  if (m) {
    // 标记 = 加粗头的**原文前缀**(不做任何重拼,否则 "D107b" 会被拆成 "D107 b" 这种
    // 源文本里根本不存在的串,导致正常提交被误判为丢失);遇到下一个 `*` 即停 ——
    // 不然 `**P2-F.4**(评估触发)…` 这种"编号后紧跟闭合星号"的行会把 `**` 吃进标记,
    // 于是别人正常改写文案也被判成"登记行消失"(实测 1 例假阳)。
    const tail = line.slice(m.index + 2)
    const star = tail.indexOf('*')
    return (star >= 0 ? tail.slice(0, star) : tail).slice(0, 18)
  }
  if (isBullet) {
    // 复选任务行:编号必须在**内容开头**(剥掉复选框与多层状态装饰之后,见 checkboxBody)。
    const body = checkboxBody(line)
    if (body === null) return null // 不是复选任务行
    const id = body.match(ID_RE)
    return id && id.index === 0 && id[1].length >= 3 ? titleMarker(body) : null
  }
  // 标题行:只认开头的中文/阿拉伯批次序号(`### 第十四批(…):…`)。刻意不认"轮/次/阶段"——
  // `第二轮` 这类串在正文里到处出现,拿它当标记等于永久报不出丢失,只会往基线里塞空条目。
  const h = line.match(/^(#{2,4}\s*)(第[0-9一二三四五六七八九十百①-⑳]+批)/)
  return h && h[2].length >= 3 ? titleMarker(line.slice(h[1].length)) : null
}

/** 从一份计划文档里抽出所有登记行(标记 + 行首编号) */
export function registeredLines(src) {
  return src
    .split(/\r?\n/)
    .map((line) => ({ line, ...(registrationOf(line) || {}) }))
    .filter((x) => x.marker)
}

/** 基线里存在、待提交内容里彻底消失的登记行 */
export function lostMarkers(baselineSrc, candidateSrc) {
  const ids = headIdSet(candidateSrc)
  const out = []
  for (const { line, marker, id } of registeredLines(baselineSrc)) {
    // 双路判活:① 标记文本还在全文任意位置(登记行被改写但留了编号 → 不算丢);
    //          ② 该编号仍作为**某一行登记行的行首**存在(专治"标题被别处原样引用"把①骗过去)
    if (!stillRegistered({ marker, id }, candidateSrc, ids)) out.push({ marker, line, id })
  }
  return out
}

/** 归档目录里能否找到原文(§1 归档 = 正当删除) */
export function archivedCopy(marker) {
  if (!existsSync(ARCHIVE_DIR)) return null
  for (const f of readdirSync(ARCHIVE_DIR)) {
    if (!/^PROJECT_PLAN_.*\.md$/.test(f)) continue
    const src = readFileSync(path.join(ARCHIVE_DIR, f), 'utf8')
    if (src.includes(marker)) return f
  }
  return null
}

function candidateContent(isStaged) {
  if (isStaged) {
    // 暂存区里没有该文件(本次不改计划文档)→ 无需比对
    try {
      return git(['show', `:${PLAN}`])
    } catch {
      return null
    }
  }
  return readFileSync(path.join(ROOT, PLAN), 'utf8')
}

export function runCheck(isStaged) {
  const baseline = git(['show', `HEAD:${PLAN}`])
  const candidate = candidateContent(isStaged)
  if (candidate === null) return { ok: true, lost: [] }
  const lost = lostMarkers(baseline, candidate).filter(
    (x) => !archivedCopy(x.marker) && !(x.id && archivedCopy(x.id)),
  )
  return { ok: lost.length === 0, lost }
}

/**
 * 扫最近 N 个提交的计划版本,收集登记行,找出当前内容里已消失的那些。
 * (并发"旧基线整文件提交"与 git-sync-converge 的索引层合并都可能把别人的行合掉;
 *  本函数是"从历史里回捞"的通用手段,不依赖是谁、哪一枚提交弄丢的。)
 * 同时记下每行在历史里的**前一行**,回插时用得上。
 */
/**
 * 扫最近 N 个提交的计划版本,收集登记行(含每行在历史里的**前一行**,回插时用得上)。
 * 单独拆出来是因为同一份历史要和两个目标比对:工作区、HEAD(见 heal)。
 */
export function historyMarkers(depth = 60) {
  const shas = git(['rev-list', `--max-count=${depth}`, 'HEAD'])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
  const seen = new Map()
  for (const sha of shas) {
    let src
    try {
      src = git(['show', `${sha}:${PLAN}`])
    } catch {
      continue
    }
    const rows = src.split(/\r?\n/)
    rows.forEach((line, i) => {
      const reg = registrationOf(line)
      if (!reg) return
      const { marker } = reg
      if (seen.has(marker)) return
      let prev = null
      for (let j = i - 1; j >= 0; j--) {
        if (rows[j].trim()) {
          prev = rows[j]
          break
        }
      }
      seen.set(marker, { line, marker, id: reg.id, sha, prev })
    })
  }
  return seen
}

/** 历史登记行里在 targetSrc 中缺席的那些(归档过的正当移除自动排除) */
export function missingFrom(seen, targetSrc) {
  const missing = []
  const ids = headIdSet(targetSrc)
  for (const [marker, v] of seen) {
    if (stillRegistered({ marker, id: v.id }, targetSrc, ids)) continue
    if (archivedCopy(marker) || (v.id && archivedCopy(v.id))) continue
    missing.push(v)
  }
  return missing
}

/**
 * 扫最近 N 个提交的计划版本,找出当前内容里已消失的那些。
 * (并发"旧基线整文件提交"与 git-sync-converge 的索引层合并都可能把别人的行合掉;
 *  本函数是"从历史里回捞"的通用手段,不依赖是谁、哪一枚提交弄丢的。)
 */
export function collectMissing(targetSrc, depth = 60) {
  const seen = historyMarkers(depth)
  const missing = missingFrom(seen, targetSrc)
  return { total: seen.size, missing }
}

/**
 * 把丢失行插回:优先插到"它在历史里的前一行"之后(邻居今天还在 → 分组不散),
 * 邻居也没了就直接追加到文件末尾 —— 宁可位置不理想,也绝不丢掉内容。
 * 只改字符串,不碰工作区文件。
 */
export function healContent(targetSrc, missing) {
  const eol = targetSrc.includes('\r\n') ? '\r\n' : '\n'
  const lines = targetSrc.split(eol)
  const ids = headIdSet(targetSrc)
  let appended = 0
  let inserted = 0
  for (const entry of missing) {
    const { line, id, prev } = entry
    if (stillRegistered(entry, lines.join(eol), ids)) continue
    const clean = line.replace(/\r$/, '')
    if (id) ids.add(id) // 本轮回插过的行,后续同编号条目不再重复插
    const at = prev ? lines.findIndex((l) => l.replace(/\r$/, '') === prev.replace(/\r$/, '')) : -1
    if (at >= 0) {
      lines.splice(at + 1, 0, clean)
      inserted += 1
    } else {
      lines.splice(lines.length - 1, 0, clean)
      appended += 1
    }
  }
  return { out: lines.join(eol), inserted, appended }
}

function selfTest() {
  const base = [
    '### 某任务',
    '  - **G-166 第⑤步(第 57 轮续):N8n 屏改用共享交代组件并回收 6 个旧取词键,细节见提交说明。**',
    '  - **D107b 结案(第 57 轮):证据替换推测,该因果链不成立,留下的是防回潮锁而不是待办。**',
    '  - 短行不带编号不该被当成登记行',
    '  - **普通说明**:这行没有编号,丢了也不该报。',
  ].join('\n')
  const cases = []
  const t = (name, fn) => cases.push({ name, pass: !!fn() })

  t('登记行被删除 → 报两条', () => {
    const cand = base.replace(/ {2}- \*\*G-166[^\n]*\n/, '').replace(/ {2}- \*\*D107b[^\n]*\n/, '')
    return lostMarkers(base, cand).length === 2
  })
  t(
    '改写文案但保留编号 → 不报(避免误伤正常编辑)',
    () =>
      lostMarkers(base, base.replace('N8n 屏改用共享交代组件并回收 6 个旧取词键', '换了个说法'))
        .length === 0,
  )
  t(
    '无编号行丢失 → 不报(不在本闸职责内)',
    () =>
      lostMarkers(base, base.replace('  - **普通说明**:这行没有编号,丢了也不该报。', '')).length ===
      0,
  )
  t(
    'markerOf 认 G-/D(含字母后缀)/P-x.n 编号并要求 bullet + 长度',
    () =>
      markerOf(
        '  - **G-166 第⑤步(第 57 轮续):N8n 屏改用共享交代组件并回收 6 个旧取词键,细节见提交说明。**',
      ) === 'G-166 第⑤步(第 57 轮续)' &&
      markerOf(
        '  - **D107b 结案(第 57 轮):证据替换推测,该因果链不成立,留下的是防回潮锁而不是待办。**',
      ) === 'D107b 结案(第 57 轮):证' &&
      markerOf(
        '  - **P2-F.10 追加 —— 凭据外泄族收到第 5 处,F 通道两次自我纠正,Python 覆盖落地全绿。**',
      ) === 'P2-F.10 追加 —— 凭据外泄' &&
      markerOf('- **D12 短') === null &&
      markerOf('**G-1 没有 bullet**这是一行足够长的但没有列表符号的内容,不该算登记行。') === null &&
      // `守门 NN` 登记行一族:认编号前缀,但"守门"后无数字的散文行不算
      String(
        markerOf(
          '  - **守门 72 `scripts/check-dockerfile-copy-paths.mjs`(sha `f9a264f25b`)**:提交 `79b9` 给根 package.json 加 postinstall 而镜像没 COPY scripts。',
        ),
      ).startsWith('守门 72') &&
      markerOf(
        '  - **守门链的执行语义**:任一 blocking 门失败都跑完再汇总,这是工程约束不是登记行编号。',
      ) === null,
  )
  t(
    'markerOf 认 `第N步` 中文序号族(阿拉伯/汉字/带圈),且只认"步"不认次数/轮次/阶段',
    () =>
      // 正例:三种序号写法都命中,标记取加粗头原文前缀
      String(
        markerOf(
          '  - **第⑥步(第 58 轮):ACP 侧 z.enum 收紧为 kebab∪camel 双拼写,落库/出参各按规范档与 wire 归一。**',
        ),
      ).startsWith('第⑥步') &&
      String(
        markerOf(
          '  - **第6步(第 58 轮):登记行防丢守门补中文序号族,扫描口径与真实计划做误伤回归后再提交。**',
        ),
      ).startsWith('第6步') &&
      String(
        markerOf(
          '  - **第十二步收口(第 59 轮):权限档派生清单落共享层,400 文案不再从 Partial 派生 undefined。**',
        ),
      ).startsWith('第十二步') &&
      // 反例 1:"第N次/第N轮"是叙述不是步骤登记,行再长也不算
      markerOf(
        '  - **第 58 轮续**:这是一条足够长的进度叙述行,写的是轮次不是步骤,不该受本闸保护。',
      ) === null &&
      markerOf(
        '  - **第③次尝试**:这行足够长但用的是次数序号,属于过程叙述,不该被当成登记行受保护。',
      ) === null &&
      markerOf(
        '  - **第①阶段说明**:这一行足够长,写的是阶段而非步骤,同样不该被当登记行收紧保护。',
      ) === null,
  )
  t('markerOf 对 `第N步` 族仍要求 bullet 与长度(非 bullet / 短行都不算)', () => {
    const long =
      '这是一段足够长的正文说明,里面引用了 **第⑥步** 这个序号来描述前因后果,但它根本不是列表项登记行。'
    return (
      markerOf(long) === null &&
      markerOf('  - **第⑥步**') === null &&
      markerOf('  - **第⑥步补**)') === null
    )
  })
  t(
    'markerOf 认复选任务行的裸编号(`- [ ] O13b …`),标记 = 编号 + 短标题(不吞括注正文)',
    () =>
      // 正例:O/B/D 三族裸编号 + 带 ✅(日期) 前缀都已勾的完成行
      markerOf(
        '- [ ] O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**;② 删掉 2 处本地重定义',
      ) === 'O13b 第二段' &&
      // 复选框后先写状态的写法(计划里真实存在),标记同样是 `O13b 第二段`
      markerOf(
        '- [ ]（进行中） O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**。',
      ) === 'O13b 第二段' &&
      markerOf(
        '- [ ] B15 本目标下**仍未闭环**的两件事(不写作已完成,各自给出解阻判据):健康门禁与迁移账本两处复核。',
      ) === 'B15 本目标下' &&
      markerOf(
        '- [ ] D13 逐消息上下文可解释视图(G-10)。V2 深化口径(2026-09-19 晚):须含 auto_context 命中/RAG chunk 四类。',
      ) === 'D13 逐消息上下文可解释视图' &&
      // 反例 1:编号后面紧跟 `**` 的行仍走加粗原文前缀(既有语义,别退化成裸编号)
      String(
        markerOf(
          '- [x] ✅(2026-09-23) **D44 白名单兜底事件逐个补渲染位(G-62)**:WHITELIST 第 107 行起 10 事件逐个定渲染位。',
        ),
      ).startsWith('D44 白名单兜底事件') &&
      // 反例 2:两处都够不着的行不算登记行(正文段落 / 编号不在内容开头)
      markerOf(
        '这是一段足够长的正文,里面提到了 O13b 第二段这件事的来龙去脉,但它不是任务登记行,不该进基线。',
      ) === null &&
      markerOf(
        '- [ ] 这一行的内容开头不是编号,虽然正文中段出现了 D107b 之类的串,也不该被当登记行收紧保护。',
      ) === null &&
      // 反例 3:编号本身 <3 字(P0/D6/W1)在两处都能撞见,拿它当标记只会塞永不报丢的空条目 → 放过
      markerOf(
        '- [ ] P0 该项编号只有两个字,标记全文必撞,不做无意义的基线条目。这是足够长的一行说明文字。',
      ) === null &&
      markerOf(
        '- [ ] D6 多 agent 栈收敛(agents-kanban/swarm 四套→AgentLoopV2 单一事实源)方案评审并启动(G-22)。',
      ) === null,
  )
  t(
    'markerOf 认批次标题行 `### 第N批`,刻意不认轮/次/阶段标题',
    () =>
      markerOf(
        '### 第十八批(2026-09-23):目录页输入框垂直居中 —— 单行 Edit 顶对齐文字,并给这条修复立跨文件闸',
      ) === '第十八批(2026-09-23)' &&
      // 冒号紧跟序号时,标记续到下一个分隔符前(仍 ≤18 字,不吞整段标题)
      (() => {
        const v = String(
          markerOf('#### 第七批:main 上属于本路的守门 70 越线清零(2026-09-23,commit `18598f4ac2`)'),
        )
        return v.startsWith('第七批:') && v.length <= 18 && !v.includes('(')
      })() &&
      markerOf('### 第二轮收口(同日续做:把上一节所有待办清零时新查出的 6 项,均已修并取证)') ===
        null &&
      markerOf('### 第十四阶段总结:这一节标题写的是阶段而非批次,纳进必与正文撞车,故不受保护。') ===
        null &&
      // 反例:正文段落里出现"第十四批"不算标题行
      markerOf('本会话第十四批的收尾工作已经全部落地,这一行是正文段落而非章节标题,不该进基线。') ===
        null,
  )
  t('新两族进 lostMarkers:整行消失必报,改写编号后文案不报(误伤回归)', () => {
    const b = [
      '### 第十九批(2026-09-23):一条用于验证批次标题防丢的标题行,正文部分可以随便改写而不该报丢。',
      '- [ ] O13c 第三段(收敛本身,若干条可核算):① 一条用于验证裸编号任务行防丢的登记行,正文随便改写。',
      '  - **普通说明**:这行没有编号,丢了也不该报,是既有职责边界。',
    ].join('\n')
    // 改写正文(保留编号) → 0 报
    const edited = b
      .replace('一条用于验证批次标题防丢的标题行', '换了个说法但编号还在')
      .replace('① 一条用于验证裸编号任务行防丢的登记行', '① 改写了')
    // 整行删除 → 恰好 2 报(第三行无编号不报)
    const removed = b.replace(/^### 第十九批[^\n]*\n/m, '').replace(/^- \[ \] O13c[^\n]*\n/m, '')
    return lostMarkers(b, edited).length === 0 && lostMarkers(b, removed).length === 2
  })
  t('headIdOf 认三种"行首编号"形态,且散文里的引用不算', () => {
    return (
      // 复选任务行裸编号 / 带状态装饰 / 已勾带 ✅(日期)
      headIdOf(
        '- [ ] O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**;② 删掉 2 处本地重定义',
      ) === 'O13b' &&
      headIdOf(
        '- [ ]（进行中） O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**。',
      ) === 'O13b' &&
      headIdOf(
        '- [x] ✅(2026-09-23) D51 对话流元素覆盖守门:新建 `scripts/check-chat-element-coverage.mjs`(注册进 guardian-runner)。',
      ) === 'D51' &&
      // 批次标题行
      headIdOf('### 第二十批(2026-09-23):一条用于验证批次标题行首编号的登记标题,足够长。') === '第二十批' &&
      // 加粗头紧跟编号 ⇒ 也算行首编号(让"改写成加粗形态"不被误判成丢失)
      headIdOf('  - **G-166 第⑤步(第 57 轮续):N8n 屏改用共享交代组件并回收 6 个旧取词键,细节见提交说明。**') ===
        'G-166' &&
      // 反例:编号出现在正文中段(散文引用)、或短编号(P0/D6 两处必撞)都不给身份
      headIdOf(
        '  - **进度(2026-09-23 ⑤)**:`admin.ts:124` 的统一 admin preHandler 已收编,O13b 第二段 ①②③⑤ 已落,仅剩 ④。',
      ) === null &&
      headIdOf('- [ ] P0 这一行的编号只有两个字,全文必撞,不给身份也不给保护。足够长的一行说明文字内容。') === null
    )
  })
  t(
    '残余面根治:任务行整行被抹、但标题被别处原样引用时,行首编号这一路必须报出来',
    () => {
      const b = [
        '### 某任务',
        '- [ ] O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**;② 删掉 2 处本地重定义。',
        '  - **进度(2026-09-23 ⑤)**:`admin.ts:124` 的统一 admin preHandler 已收编进集中封装,O13b 第二段 ①②③⑤ 已落,仅剩 ④ 升 blocking。',
      ].join('\n')
      // ① 旧判据的空转面:整行删掉后 `O13b 第二段` 仍能在那条进度行里搜到
      const erased = b.replace(/^- \[ \] O13b[^\n]*\n/m, '')
      const byText = erased.includes('O13b 第二段')
      // ② 新判据必须报 1 条
      const lost = lostMarkers(b, erased)
      // ③ 反例 A:改写正文保留行首编号 → 不报
      const reworded = b.replace('① 34 个白名单文件逐个迁移到集中封装并**删条目**', '① 换成 31 个文件')
      // ④ 反例 B:整行改成已勾 + ✅(日期) 形态 → 不报(编号仍是行首)
      const done = b.replace(
        '- [ ] O13b 第二段(收敛本身,5 条可核算):',
        '- [x] ✅(2026-09-23) O13b 第二段(收敛本身,5 条可核算):',
      )
      return (
        byText &&
        lost.length === 1 &&
        lost[0].marker === 'O13b 第二段' &&
        lostMarkers(b, reworded).length === 0 &&
        lostMarkers(b, done).length === 0
      )
    },
  )
  t('healContent 走同一判据:编号仍是行首就不重复插,编号消失才回捞', () => {
    const task =
      '- [ ] O13c 第三段(收敛本身,若干条可核算):① 一条用于验证自愈判据一致性的登记行,正文可随便改写。'
    const ref =
      '  - **进度(第 61 轮)**:这一行原样引用了 O13c 第三段 这件事的前因后果,但它不是登记行的行首形态。'
    const entry = { line: task, marker: 'O13c 第三段', id: 'O13c', prev: ref }
    const target = ['### 段', ref, ''].join('\n')
    const healed = healContent(target, [entry])
    const again = healContent(healed.out, [entry])
    return (
      healed.inserted === 1 &&
      healContent(target + '\n' + task, [entry]).inserted === 0 &&
      again.inserted === 0 &&
      again.appended === 0
    )
  })
  t('归档目录豁免路径可达(不抛异常即算通)', () => {
    const v = archivedCopy('一个绝对不存在的标记 XYZ')
    return v === null || typeof v === 'string'
  })
  t('missingFrom 可分别喂工作区与 HEAD(旁路提交把 HEAD 合掉、工作区还留着时仍能发现)', () => {
    const line = '  - **G-777 收口(第 60 轮):一条足够长的登记行,用来验证双目标比对逻辑。**'
    const seen = new Map([['G-777 收口', { marker: 'G-777 收口', line, prev: null }]])
    const withLine = `${base}\n${line}`
    return missingFrom(seen, withLine).length === 0 && missingFrom(seen, base).length === 1
  })
  t('healContent:邻居还在 → 插到邻居之后,分组不散', () => {
    const target = [
      '### 段',
      '  - **G-166 第①步(第 57 轮):新立交代帧持久化,细节见提交说明。**',
      '',
    ].join('\n')
    const missing = [
      {
        marker: 'G-166 第⑤步(第 57',
        line: '  - **G-166 第⑤步(第 57 轮续):N8n 屏改用共享交代组件并回收 6 个旧取词键。**',
        prev: '  - **G-166 第①步(第 57 轮):新立交代帧持久化,细节见提交说明。**',
      },
    ]
    const { out, inserted, appended } = healContent(target, missing)
    const order = out
      .split('\n')
      .map((l) => (l.includes('第①步') ? 1 : l.includes('第⑤步') ? 2 : 0))
      .filter(Boolean)
    return inserted === 1 && appended === 0 && String(order) === '1,2'
  })
  t('healContent:邻居也没了 → 追加而不是丢弃', () => {
    const target = ['### 段', '  - 别的行', ''].join('\n')
    const missing = [
      {
        marker: 'D999z 结案',
        line: '  - **D999z 结案(第 1 轮):这是一条足够长的登记行,邻居已经不存在于当前内容里。**',
        prev: '  - 这一行在当前内容里已经不存在了',
      },
    ]
    const { out, inserted, appended } = healContent(target, missing)
    return inserted === 0 && appended === 1 && out.includes('D999z 结案')
  })
  t('healContent:幂等 —— 已存在的标记不会被二次插入', () => {
    const line = '  - **D999z 结案(第 1 轮):这是一条足够长的登记行,重复插入会被本用例抓到。**'
    const target = ['### 段', line, ''].join('\n')
    const { inserted, appended, out } = healContent(target, [
      { marker: 'D999z 结案', line, prev: null },
    ])
    return inserted === 0 && appended === 0 && out.split('D999z 结案').length - 1 === 1
  })

  let failed = 0
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
    if (!c.pass) failed++
  }
  console.log(`\nself-test: ${cases.length - failed}/${cases.length} 通过`)
  return failed === 0 ? 0 : 1
}

/**
 * 回捞 + (可选)前向恢复提交。
 * 返回退出码:0 = 无需恢复或已恢复成功;1 = 恢复失败(不动历史,交人工)。
 */
function heal(commit) {
  const head = git(['show', `HEAD:${PLAN}`])
  const disk = readFileSync(path.join(ROOT, PLAN), 'utf8')
  const seen = historyMarkers()
  /**
   * 工作区与 HEAD **分别**判缺失。只看工作区会留一个洞:并发会话走 commit-tree 旁路
   * (git-sync-converge / 临时索引提交)时钩子根本不跑,它把某行从 HEAD 合掉后,
   * 共享工作区里那一行往往还在 → 单一目标会"无缺失"提前返回,HEAD 从此永远缺着。
   */
  const diskMissing = missingFrom(seen, disk)
  const headMissing = missingFrom(seen, head)
  if (diskMissing.length === 0 && headMissing.length === 0) {
    console.log(`✅ [plan-line-loss] 扫描 ${seen.size} 条登记行:无缺失,无需回捞`)
    return 0
  }
  let inserted = 0
  let appended = 0
  if (diskMissing.length) {
    const healed = healContent(disk, diskMissing)
    inserted = healed.inserted
    appended = healed.appended
    console.warn(
      `⚠️  [plan-line-loss] 工作区缺 ${diskMissing.length} 条登记行 → 回插 ${inserted} 条(邻居在)+ ${appended} 条(追加):`,
    )
    for (const m of diskMissing) console.warn(`     · ${m.marker}`)
    if (healed.out !== disk) writeFileSync(path.join(ROOT, PLAN), healed.out, 'utf8')
  }
  if (headMissing.length) {
    console.warn(
      `⚠️  [plan-line-loss] HEAD 缺 ${headMissing.length} 条登记行(被旁路提交合掉,工作区可能仍留着):`,
    )
    for (const m of headMissing) console.warn(`     · ${m.marker}`)
  }
  if (!commit) {
    console.log('   (未加 --commit:只写工作区,不建提交)')
    return 0
  }
  if (headMissing.length === 0) {
    console.log('   HEAD 已含全部登记行,无需建恢复提交')
    return 0
  }
  const msgFile = path.join(ROOT, '.ihui-agent/tmp', `plan.heal.${Date.now()}.msg`)
  // post-commit 里这条链是 `... || true`,目录不存在会让恢复提交**静默失败** → 先确保目录在
  mkdirSync(path.dirname(msgFile), { recursive: true })
  // 提交用的基线**必须是 HEAD**,不能用刚写盘的工作区内容 —— 工作区可能带着别人
  // 尚未提交的行,拿去建提交等于代收(§12 暂存区污染红线)。
  const healedHead = healContent(head, headMissing).out
  if (healedHead === head) {
    console.log('   回捞后 HEAD 内容与当前一致,不建空提交')
    return 0
  }
  writeFileSync(
    msgFile,
    `docs(plan): 自动回捞 ${headMissing.length} 条被并发旧基线提交抹掉的登记行\n\n` +
      `由 scripts/check-plan-line-loss.mjs --heal --commit 生成:按最近历史逐条取回原文,` +
      `插回各自邻居之后(邻居也缺席则追加到末尾)。只加不减。\n` +
      (diskMissing.length ? `(同轮工作区另回插 ${inserted}+${appended} 条,不入本次提交。)\n` : ''),
    'utf8',
  )
  const tmp = path.join(ROOT, '.ihui-agent/tmp', `plan.heal.${Date.now()}.md`)
  writeFileSync(tmp, healedHead, 'utf8')
  const blob = git(['hash-object', '-w', tmp]).trim()
  const parent = git(['rev-parse', 'HEAD']).trim()
  const idx = path.join(ROOT, '.ihui-agent/tmp', `index-plan-heal-${Date.now()}`)
  const env2 = { ...process.env, GIT_INDEX_FILE: idx }
  const g2 = (a, o = {}) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: ROOT,
      encoding: 'utf8',
      env: env2,
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
      ...o,
    }).trim()
  try {
    g2(['read-tree', parent])
    g2(['update-index', '--add', '--cacheinfo', `100644,${blob},${PLAN}`])
    const tree = g2(['write-tree'])
    const newCommit = execFileSync(
      GIT,
      ['-c', 'safe.directory=*', 'commit-tree', tree, '-p', parent, '-F', msgFile],
      { cwd: ROOT, encoding: 'utf8', env: env2, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
    ).trim()
    g2(['update-ref', 'refs/heads/main', newCommit, parent])
    console.log(`   已建前向恢复提交 ${newCommit.slice(0, 11)}`)
    try {
      const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'git-push-guard.mjs')], {
        cwd: ROOT,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
    } catch {
      /* 推送交后台守卫,失败不影响本次恢复 */
    }
  } catch (e) {
    console.error(`❌ [plan-line-loss] 恢复提交失败:${e?.message ?? e}`)
    return 1
  } finally {
    rmSync(idx, { force: true })
    rmSync(tmp, { force: true })
    rmSync(msgFile, { force: true })
  }
  return 0
}

const isDirectRun =
  process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href

if (isDirectRun) {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())
  if (args.includes('--heal')) {
    // 从最近历史回捞被"旧基线整文件提交 / 索引层合并"抹掉的登记行,写回工作区文件。
    // 默认只改工作区(由调用方决定何时提交);--commit 额外走一次"临时 index + commit-tree"
    // 的前向恢复提交,并交给 git-push-guard 推送(绕过钩子的并发提交模式,与 AGENTS §12 一致)。
    process.exit(heal(args.includes('--commit')))
  }
  if (process.env.HUSKY_SKIP_PLAN_LINE_LOSS === '1') {
    console.warn('⚠️  HUSKY_SKIP_PLAN_LINE_LOSS=1,已跳过计划登记行防丢守门')
    process.exit(0)
  }
  const isStaged = args.includes('--staged')
  try {
    const { ok, lost } = runCheck(isStaged)
    if (ok) {
      console.log(
        `✅ [plan-line-loss] PROJECT_PLAN.md 无登记行丢失(${isStaged ? '暂存区' : '工作区'})`,
      )
      process.exit(0)
    }
    console.error(
      `❌ [plan-line-loss] ${lost.length} 条已入库的登记行在本次提交内容里彻底消失:\n` +
        lost.map((x) => `   · ${x.marker}\n     ${x.line.trim().slice(0, 90)}…`).join('\n'),
    )
    console.error(
      '\n  💡 这几乎总是"按内存里的旧计划文档整文件提交"造成的覆盖,不是有意删除:\n' +
        '     1) 从原始提交逐字取回:`git log --all -S "<标记>" -- PROJECT_PLAN.md` 找到引入它\n' +
        '        的提交,`git show <sha>:PROJECT_PLAN.md` 取整行,插回原锚点后再提交;\n' +
        '     2) 确属归档 → 原文必须出现在 .ihui-agent/archive/PROJECT_PLAN_*.md 里(本闸自动放行);\n' +
        '     3) 提交计划文档前一律现取 HEAD 版本再插自己的行,别相信自己内存里的那份。\n' +
        '     紧急跳过:HUSKY_SKIP_PLAN_LINE_LOSS=1(会把别人的登记行写没,慎用)\n',
    )
    process.exit(1)
  } catch (e) {
    console.error(`❌ [plan-line-loss] 检查失败:${e?.message ?? e}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
