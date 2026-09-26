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
 *   2b. **条目标题(`^#{2,3} O<数字>…`)必须仍以"标题形态"判活,不得只认行首编号**
 *      (2026-09-24 补,封 `## O42` 事故残留盲区):标题族虽已进基线,判活却走"该编号还有没有
 *      任何一行登记行以它开头" —— 而同一节里那条加粗 bullet `- **O42 残余…**` 的行首编号
 *      也是 `O42`,于是**删掉整节标题后门照报"无缺失"**(实测真仓 HEAD 抽掉 `## O42` 那一行:
 *      旧判据 0 报)。标题是一个任务在计划里唯一的可寻址入口,丢标题 = 把别人一整节的层级连根
 *      拔掉,比丢一条进度行更严重,故标题族的判活面收窄到"候选里仍有一行**标题**以该编号开头"。
 *      取舍见 `headingIdSet` 与 `selfTest` 里"只删标题、正文还留着"那一条。
 *   3. 允许两种正当情形:
 *      a) 该登记行原文可在 `.ihui-agent/archive/PROJECT_PLAN_*.md` 里找到(§1 归档流程),
 *         且那份副本**在本面里存在**(全量 = HEAD 树、`--staged` = 索引)—— 只躺在本机磁盘上、
 *         从未进任何提交的归档文件不构成删行凭据(2026-09-25 G-183 补,详见 `archivedCopy` 头注);
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
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { catBatch, gitRaw } from './lib/face-reader.mjs'

const GIT_TIMEOUT = 60000
const GIT = process.env.IHUI_GIT_BIN || 'git'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN = 'PROJECT_PLAN.md'
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
/**
 * 单一真相源出口(2026-09-26):`scripts/lib/plan-task-index.mjs` 按编号收敛任务状态时
 * 必须用**同一族**编号 —— 两处各写一遍必然漂移,而漂移的形态是"一边判孪生、一边判真丢失"
 * (AGENTS §12 与守门 118 记过同型)。此处导出,那边只在其上做"是否为主键位置"的收窄。
 */
export const TASK_ID_PATTERN = ID
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
  // 任务标题行也受保护(2026-09-23 实测补):并发会话按旧基线整文件回写,把
  // `## O28 门 53 白名单按新判据重算收紧…` 这一**标题**连同它下一条预警 bullet 一起写没了,
  // 而当时标题族只认"第N批" ⇒ 390 条扫描照报"无缺失"。标题是一个任务在计划里唯一的可寻址
  // 入口,丢了比丢一条进度行更隐蔽(正文条目还在,却挂在别人的章节下)。
  const h = line.match(new RegExp(String.raw`^#{2,4}\s*(第[0-9一二三四五六七八九十百①-⑳]+批|${ID})`))
  if (h && h[1].length >= 3) return h[1]
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
 * 一份文档里"仍作为**标题行行首**存在"的编号集合(2026-09-24 补)。
 * 与 `headIdSet` 唯一的差别是只看 `^#{2,4}` 形态的行 —— 标题族判活用它,不再共用大集合。
 * 为什么必须另开一路:`## O42 …` 这一节里跟着的 `- **O42 残余…**` bullet 行首编号同样是
 * `O42`,共用 headIdSet 时"删标题留正文"照样判活,而计划文档里**每个任务条目几乎都自带
 * 一条同编号 bullet**,等于标题族整族不受保护(真仓实测:抽掉 `## O42` 行 → 0 报)。
 * 这里刻意不加 MIN_LEN 门槛:把 60 字标题正当改写成 30 字仍是合法编辑,不该判丢。
 */
export function headingIdSet(src) {
  const out = new Set()
  for (const line of src.split(/\r?\n/)) {
    if (!/^#{2,4}\s/.test(line)) continue
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
  const shape = /^\s*[-*]\s\[[ xX]\]/.test(line)
    ? 'checkbox'
    : /^#{2,4}\s/.test(line)
      ? 'heading'
      : 'bold'
  const id = shape === 'bold' ? null : headIdOf(line)
  return { marker, id, shape }
}

/**
 * 该登记行在候选内容里还算不算"存活"。
 * ⚠️ 有行首编号的条目**只认行首编号**,不再退回全文文本搜索 —— 否则"标题被别处原样引用"
 * 那一条正好把文本搜索喂饱,新判据等于没加(本条判据就是为它写的,实测过一遍才发现)。
 * ⚠️ 标题族(`shape === 'heading'`)再收一档:必须候选里**仍有一行标题**以该编号开头才算活。
 * 共用大集合时同一节的 `- **O42 残余…**` bullet 会把 `## O42` 标题"喂活",删标题零报
 * (2026-09-24 真仓实测),而条目正文挂在别人的章节下正是最难发现的一种失真。
 * 调用方没传标题集时按候选内容现算(绝不静默回落到大集合 —— 回落等于把盲区留回去)。
 */
export function stillRegistered(entry, candidateSrc, candidateIds, candidateHeadingIds) {
  if (!entry.id) return candidateSrc.includes(entry.marker)
  if (entry.shape === 'heading') {
    return (candidateHeadingIds ?? headingIdSet(candidateSrc)).has(entry.id)
  }
  return (candidateIds ?? headIdSet(candidateSrc)).has(entry.id)
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
  // 标题行:认开头的批次序号(`### 第十四批(…):…`),以及**以登记编号打头的任务标题**
  // (`## O28 …` / `## D107b …` / `## 守门 79 …`)。后者是 2026-09-23 实测补的一族:并发旧基线
  // 回写抹掉了 `## O28` 标题,而本门当时只认"第N批",390 条扫描照报"无缺失"(判据盲区)。
  // 仍刻意不认"轮/次/阶段"—— `第二轮` 这类串在正文里到处出现,拿它当标记等于永久报不出
  // 丢失,只会往基线里塞空条目。
  const h = line.match(new RegExp(String.raw`^(#{2,4}\s*)(第[0-9一二三四五六七八九十百①-⑳]+批|${ID})`))
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
  const headingIds = headingIdSet(candidateSrc)
  const out = []
  for (const { line, marker, id, shape } of registeredLines(baselineSrc)) {
    // 双路判活:① 标记文本还在全文任意位置(登记行被改写但留了编号 → 不算丢);
    //          ② 该编号仍作为**某一行登记行的行首**存在(专治"标题被别处原样引用"把①骗过去);
    //          ③ 标题族另走 headingIds —— 见 stillRegistered
    if (!stillRegistered({ marker, id, shape }, candidateSrc, ids, headingIds))
      out.push({ marker, line, id, shape })
  }
  return out
}

/** 归档豁免的目录(相对仓库根);清单与内容**同面**取,见 archivedCopy。 */
const ARCHIVE_REL = '.ihui-agent/archive'
const ARCHIVE_FILE_RE = /^PROJECT_PLAN_.*\.md$/

/** 某一面里真实存在的归档副本路径(= 已入库的那些)。`staged` 读索引,其余读 HEAD 树。 */
function faceArchiveFiles(face) {
  const args =
    face === 'staged'
      ? ['ls-files', '-z', '--', ARCHIVE_REL]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ARCHIVE_REL]
  return gitRaw(args, ROOT, { timeout: GIT_TIMEOUT })
    .split('\0')
    .filter(Boolean)
    .filter((p) => ARCHIVE_FILE_RE.test(p.split('/').pop()))
}

/**
 * 按面缓存「路径 → 该面 blob 内容」,整进程各面至多一次批量派生。
 * 逐 marker 各开一次 git 是本仓守门 80 立过的 fork 风暴形态,所以一次读满一批。
 */
const ARCHIVE_BLOB_CACHE = new Map()
function faceArchiveBlobs(face) {
  if (ARCHIVE_BLOB_CACHE.has(face)) return ARCHIVE_BLOB_CACHE.get(face)
  const files = faceArchiveFiles(face)
  const rev = face === 'staged' ? ':' : 'HEAD:'
  const specs = files.map((p) => `${rev}${p}`)
  const got = specs.length ? catBatch(ROOT, specs, { timeout: GIT_TIMEOUT }) : new Map()
  const map = new Map()
  for (let i = 0; i < files.length; i++) {
    const v = got.get(specs[i])
    // 面里有名字却读不到 blob(unmerged / 刚被删)⇒ 不计入凭据,也不抛:
    // 少一条豁免只会多要一次定向说明,而拿不准时放行才是本闸最怕的那一型。
    if (typeof v === 'string') map.set(files[i], v)
  }
  ARCHIVE_BLOB_CACHE.set(face, map)
  return map
}

/**
 * 归档目录里能否找到原文(§1 归档 = 正当删除)。
 *
 * **只认已入库的锚点**(2026-09-25 补,G-183 ③):旧实现是 `readdirSync(ARCHIVE_DIR)` +
 * `readFileSync`,于是本机写一份**从未进任何提交**的 `archive/PROJECT_PLAN_*.md`,就能为
 * 「把别人已入库的登记行从计划文档里删掉」出具归档凭据 —— 而那份原文在另一台检出上不存在,
 * 删掉的行也无从找回。§1 那句「archive 里找得到 ⇒ 不算丢」的前提是「归档过」属于**仓库事实**,
 * 不是本机巧合(与 G-173「可审计锚点必须受版本控制」同一条纪律)。
 * 现清单与内容同面:`--staged` 判索引、全量判 HEAD 树;该面里没有的路径不构成凭据。
 *
 * `list` / `read` 可注入,使三条组合(未入库⇒不放行 / 已入库⇒放行 / 面里有名字但 blob 取不到
 * ⇒ 不放行)能在不往真仓 archive 目录写文件的前提下取证(那正是要防的取证姿势)。
 */
export function archivedCopy(marker, opts = {}) {
  const face = opts.face ?? 'head'
  const blobs = opts.list ? null : faceArchiveBlobs(face)
  const files = opts.list ? opts.list() : [...blobs.keys()]
  const read = opts.read ?? ((p) => blobs.get(p) ?? null)
  for (const p of files) {
    if (!ARCHIVE_FILE_RE.test(p.split('/').pop())) continue
    const src = read(p)
    if (typeof src === 'string' && src.includes(marker)) return p
  }
  return null
}

/**
 * 按当次判定面选出归档豁免函数:`--staged` 判索引、全量判 HEAD。
 * 与「内容面」同面是刻意的 —— 豁免所依据的归档副本必须是这次提交真的带得走(或已入库)的那份,
 * 而不是盘上随后被谁改过的那份。
 */
export function archiveExemptFor(isStaged) {
  const face = isStaged ? 'staged' : 'head'
  return (marker) => archivedCopy(marker, { face })
}

/**
 * 丢失清单里排除"已归档"的那些(§1 归档 = 正当移除)。
 * `archived` 可注入,使"归档放行"这条豁免能被取证而不必往真仓 archive 目录写文件。
 */
export function dropArchivedLost(lost, archived = archivedCopy) {
  return lost.filter((x) => !archived(x.marker) && !(x.id && archived(x.id)))
}

/**
 * 丢失清单里的**标题级**条目(`## O42 …` 这种任务条目标题)。
 * 单独点名是因为它的后果与丢一条 bullet 不同:整节层级被连根拔掉,而 --heal 只会逐行回捞,
 * 补不回"标题 + 其下正文"的从属关系 —— 报告必须把这一层能力边界说清楚,不得装作已自愈。
 */
export function headingLosses(lost) {
  return lost.filter((x) => x.shape === 'heading')
}

/**
 * 内容面统一走取材层的 `cat-file --batch`(2026-09-25 迁移)。
 * 规格里 `<rev>:` 前缀决定面:`:PLAN` = 索引、`HEAD:PLAN` = 提交树、`<sha>:PLAN` = 历史版本;
 * **冒号不可省** —— 省了就是拿裸路径问 cat-file,每个版本都"不存在",于是本闸的
 * "从历史回捞"会静默变成"无登记行可回捞"(= 判据对整类丢失失明)。
 */
function readSpec(spec) {
  const v = catBatch(ROOT, [spec], { timeout: GIT_TIMEOUT }).get(spec)
  if (typeof v !== 'string') throw new Error(`取材面 ${spec} 取不到内容`)
  return v
}

function readSpecOrNull(spec) {
  try {
    return readSpec(spec)
  } catch {
    return null
  }
}

/**
 * 纯选择(自检据此**构造**"索引面 ≠ 磁盘面"的现场,不依赖真仓瞬时状态):
 * staged 模式必须取索引 blob —— 那才是这次提交真正带走的一份;缺省取工作区文本(本门既有口径)。
 */
export function pickPlanContent({ isStaged, readIndex, readDisk }) {
  return isStaged ? readIndex(PLAN) : readDisk(PLAN)
}

function candidateContent(isStaged) {
  return pickPlanContent({
    isStaged,
    // 暂存区里没有该文件(本次不改计划文档)→ 返回 null,调用方据此无需比对
    readIndex: () => readSpecOrNull(`:${PLAN}`),
    readDisk: () => readFileSync(path.join(ROOT, PLAN), 'utf8'),
  })
}

export function runCheck(isStaged) {
  const baseline = readSpec(`HEAD:${PLAN}`)
  const candidate = candidateContent(isStaged)
  if (candidate === null) return { ok: true, lost: [] }
  const lost = dropArchivedLost(lostMarkers(baseline, candidate), archiveExemptFor(isStaged))
  return { ok: lost.length === 0, lost, prose: proseLossReport(baseline, candidate) }
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
  // 一次批量读满 60 个历史版本(迁移前是逐 sha 各开一次 `git show`,60 次派生)
  const specs = shas.map((sha) => `${sha}:${PLAN}`)
  let historic
  try {
    historic = catBatch(ROOT, specs, { timeout: GIT_TIMEOUT })
  } catch {
    historic = new Map()
  }
  for (let i = 0; i < shas.length; i++) {
    const sha = shas[i]
    const src = historic.get(specs[i])
    if (typeof src !== 'string') continue
    const rows = src.split(/\r?\n/)
    // 内层索引刻意命名 k:批量读迁移时外层丢掉了 `const sha`,而 forEach 的 `i` 又把外层计数器
    // 遮住 ⇒ `sha` 未定义 ⇒ `--heal` 每次抛 ReferenceError。post-commit 写着 || true,于是整条
    // 自愈层静默失效(本节下方那段"自愈提交自上线起从未成功过"的同型)。
    rows.forEach((line, k) => {
      const reg = registrationOf(line)
      if (!reg) return
      const { marker } = reg
      if (seen.has(marker)) return
      let prev = null
      for (let j = k - 1; j >= 0; j--) {
        if (rows[j].trim()) {
          prev = rows[j]
          break
        }
      }
      seen.set(marker, { line, marker, id: reg.id, shape: reg.shape, sha, prev })
    })
  }
  return seen
}

/** 历史登记行里在 targetSrc 中缺席的那些(归档过的正当移除自动排除) */
export function missingFrom(seen, targetSrc, archived = archivedCopy) {
  const missing = []
  const ids = headIdSet(targetSrc)
  const headingIds = headingIdSet(targetSrc)
  for (const [marker, v] of seen) {
    if (stillRegistered({ marker, id: v.id, shape: v.shape }, targetSrc, ids, headingIds)) continue
    if (archived(marker) || (v.id && archived(v.id))) continue
    missing.push(v)
  }
  return missing
}

/**
 * **非登记行**的整行丢失计量(2026-09-24 补,本闸自身的覆盖面缺口)。
 *
 * 本闸只锚"编号登记行"(G-x/Dx/Px/Wx/守门 NN),而并发"按内存里旧计划文档整文件提交"
 * 抹掉的大头恰恰是**不带编号的正文 bullet**(条目内的进度叙述、收口说明)——
 * 实测本机 2026-09-24 04:5x:待提交内容与 HEAD 相比非登记行少 **813 行**,而登记行一条不少,
 * 于是本闸报绿、13c(只认任务标题行)报绿、门 65(只数文件数)报绿 ⇒ **静默**。
 * 门 71 自己的"无登记行丢失"这句绿灯,此前恰恰是这类事故的遮羞布。
 *
 * 刻意**只报数不阻塞**:改写措辞、段落重排、缩进归一都会命中同一形态,判红必然卡死
 * 他人的正常 PLAN 提交(AGENTS §12 明确禁止把他人改动变成全局阻塞)。报数进 stdout,
 * 由人(或后续把阈值接进 CI)决定要不要追。
 */
export function proseLossReport(baseSrc, targetSrc) {
  const kept = new Set(
    targetSrc
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  )
  const lost = []
  for (const raw of baseSrc.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (registrationOf(raw)) continue // 登记行由 missingFrom/lostMarkers 精确判,不重复计
    if (!kept.has(line)) lost.push(line)
  }
  return { lostCount: lost.length, sample: lost.slice(0, 3) }
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
/**
 * 规模安全闸阈值:一次回捞的"缺失登记行"占扫描总数超过此比例,即判为**基线异常**而非真丢。
 * 可用 IHUI_PLAN_HEAL_MAX_MISSING_RATIO 覆盖(0<r≤1);非法值回落默认,绝不因配置错而放行。
 */
export function healSuspectRatio() {
  const raw = process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO
  if (raw === undefined || raw === '') return 0.4
  const v = Number(raw)
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.4
}

/**
 * 2026-09-23 立,由本仓一次真实自伤事故反推(登记见 PROJECT_PLAN 的 O24 段):
 * 有会话对活文档做"全量 union 回补",独有行判据用整行文本差集 —— PLAN 在两分钟窗口内被
 * 并发重排改写措辞,使同一内容的新旧两个版本全落到"缺失"一侧,勘察时 59 行、执行时暴涨成
 * 1505 行,插回去就是 1543 行重复入库。**"零损失断言"只保证不删,不保证不重复**。
 * 本闸补的正是这后半句:真丢通常是几条到几十条(本日实测 1/2/4 条),一次丢"四成以上"
 * 几乎必然是比对基线错了,此时写盘的回捞只会把文档搅成两份真相 ⇒ 拒绝,交人工判。
 */
export function assessHealScale(missingCount, seenCount, ratio = healSuspectRatio()) {
  if (!(seenCount > 0)) return { ok: true, ratio: 0, reason: '无登记行可比对,规模闸不启用' }
  const r = missingCount / seenCount
  if (r > ratio) {
    return {
      ok: false,
      ratio: r,
      reason: `缺失 ${missingCount}/${seenCount} 条 = ${(r * 100).toFixed(1)}%,超阈值 ${(ratio * 100).toFixed(0)}%`,
    }
  }
  return { ok: true, ratio: r, reason: '' }
}

/**
 * 本门自己的"接线自检"。
 *
 * 为什么必须有(2026-09-24):本门存在的理由就是"并发会话把别人已入库的登记行整文件回写掉",
 * 而它**自己没有任何东西看守注册块**。今天一天内共享工作树就被旧基线回写过多轮,
 * `guardian-runner.mjs` 里那道 id 71 注册块正是这类回写的普通牺牲品 —— 一旦被抹掉:
 *   · pre-commit 不再跑本门(提交裸奔,登记行开始丢);
 *   · CI 也不会发现(它不在提交链上);
 *   · 镜像测试**连红都不是** —— 它断言的是"本门编号在 runner 中恰好一次",摘线后
 *     该测试文件根本不会被调用。
 * 即"防丢门被摘掉"这件事本身不受任何门保护,只能自指。判据口径与守门 89 一致:
 * 按**内容**点名本脚本,且必须查满五处权威点 —— `.husky/pre-commit` 自 2026-09-22 起
 * 只是薄壳,只查它必然得出相反结论。
 */
export const WIRE_POINTS = [
  ['scripts/guardian-runner.mjs', 'guardian-runner 注册表'],
  ['scripts/lib/pre-commit-hook.js', 'pre-commit 真实逻辑'],
  ['.husky/pre-commit', 'pre-commit 薄壳'],
  ['.husky/post-commit', 'post-commit 自愈层'],
  ['package.json', '根 package.json scripts'],
]

export function planLineLossWired(root = ROOT) {
  const present = []
  const missing = []
  let existingPoints = 0
  for (const [rel, label] of WIRE_POINTS) {
    let text = ''
    try {
      text = readFileSync(path.join(root, rel), 'utf8')
    } catch {
      missing.push(`${label}(读不到 ${rel})`)
      continue
    }
    existingPoints++
    if (text.includes('check-plan-line-loss')) present.push(label)
    else missing.push(`${label}(${rel} 未点名本脚本)`)
  }
  /**
   * `applicable` —— 一个注册落点文件都不存在时,这里**不是**本仓,而是被复制出去的夹具
   * (本门的端到端用例就把本脚本 copy 进临时 git 仓跑)。那种场合判"摘线"是错的,
   * 会让一个正常工作的副本以"门被摘掉"的名义 exit 1(第一版就踩了:连带弄红三枚既有端到端用例)。
   * 所以摘线只在"落点文件在、但都不点名本门"时成立。
   */
  return {
    applicable: existingPoints > 0,
    wired: present.length > 0,
    present,
    missing,
  }
}

/** 打印摘线告警;`hard` 时(提交链上的 check 模式)直接判红 exit 1。 */
function guardWiring(hard) {
  const w = planLineLossWired()
  if (w.wired || !w.applicable) return w
  console.warn(
    '\n❌ [plan-line-loss] 本门已从提交链上被摘掉 —— 五处权威接线点无一再点名本脚本' +
      `(登记行正在无人看守地丢失):\n   ${w.missing.join('\n   ')}`,
  )
  console.warn(
    '   修法(一行,立即恢复):在 `scripts/guardian-runner.mjs` 恢复 id 71 注册块' +
      "(`script: 'check-plan-line-loss.mjs'`);\n" +
      '   若同时需要 post-commit 自愈层,还要在 `.husky/post-commit` 恢复对 `--heal` 的调用。\n',
  )
  if (hard) process.exit(1)
  return w
}

export function healContent(targetSrc, missing) {
  const eol = targetSrc.includes('\r\n') ? '\r\n' : '\n'
  const lines = targetSrc.split(eol)
  const ids = headIdSet(targetSrc)
  const headingIds = headingIdSet(targetSrc)
  let appended = 0
  let inserted = 0
  for (const entry of missing) {
    const { line, id, prev } = entry
    if (stillRegistered(entry, lines.join(eol), ids, headingIds)) continue
    const clean = line.replace(/\r$/, '')
    if (id) {
      // 本轮回插过的行,后续同编号条目不再重复插
      ids.add(id)
      if (entry.shape === 'heading') headingIds.add(id)
    }
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
  t('同一形态由 proseLossReport 如实计量(非登记行丢失此前无任何门可见)', () => {
    const r = proseLossReport(
      base,
      base.replace('  - **普通说明**:这行没有编号,丢了也不该报。', ''),
    )
    return r.lostCount === 1 && r.sample[0].includes('普通说明')
  })
  t('反向对照:内容一致 → prose 计量 0(不得把正常提交报成丢失)', () => {
    return proseLossReport(base, base).lostCount === 0
  })
  t('登记行不重复计入 prose(红灯判据已覆盖,两条通道不得双计)', () => {
    return proseLossReport(base, base.replace(/ {2}- \*\*G-166[^\n]*\n/, '')).lostCount === 0
  })
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
    'markerOf / headIdOf 认「以登记编号打头的任务标题」一族(## O28 / ## D107b / ## 守门 79),散文标题不算',
    () =>
      String(
        markerOf(
          '## O28 门 53 白名单按新判据重算收紧 + D71② 真实障碍与"第二张错误表"预警(2026-09-24 立并完成 ✅,单端工程治理:scripts + 勘察)',
        ),
      ).startsWith('O28 门 53 白名单') &&
      String(
        markerOf('## D107b 结案:把"是否真丢 commit"改成按树指纹判,不再靠抽样,并留下可复跑证据。'),
      ).startsWith('D107b') &&
      String(
        markerOf('## 守门 79 提交内容含冲突标记(blocking):成对 <<<< ==== >>>> 三模式的判据与取证口径说明。'),
      ).startsWith('守门 79') &&
      // 批次标题一族必须保持原样(收紧不得把旧语义挤掉)
      String(
        markerOf('### 第十四批(第 61 轮续):登记行防丢守门补任务标题一族,含正反例与真仓零告警回归。'),
      ).startsWith('第十四批') &&
      // 反例:无登记编号的标题不进基线,否则任何改写都会报丢失、基线里塞满空条目
      markerOf('## 关键参考文档') === null &&
      markerOf('## 本会话对守门链执行语义的一次长标题说明,它不带任何登记编号因此不该被当作登记行。') === null &&
      headIdOf('## O28 门 53 白名单按新判据重算收紧 + D71② 真实障碍(2026-09-24)') === 'O28' &&
      headIdOf('## 关键参考文档') === null,
  )
  t(
    '整行判活:任务标题被抹掉必须报丢失;只改写标题文案而保留编号 ⇒ 不报(不误伤正常编辑)',
    () => {
      const base = [
        '## O30 一个任务标题(2026-09-24 立并完成 ✅,单端工程治理:scripts + 计划文档登记)',
        '',
        '- [x] ✅(2026-09-24) **O30① 进度行**:内容足够长足够长足够长足够长足够长足够长。',
        '',
      ].join('\n')
      const dropped = base.replace('## O30 一个任务标题(2026-09-24 立并完成 ✅,单端工程治理:scripts + 计划文档登记)\n\n', '')
      const renamed = base.replace('## O30 一个任务标题', '## O30 任务标题文案已被正常改写')
      const lost = lostMarkers(base, dropped).map((x) => x.marker)
      const kept = lostMarkers(base, renamed).map((x) => x.marker)
      return lost.some((m) => String(m).startsWith('O30')) && !kept.some((m) => String(m).startsWith('O30 一个'))
    },
  )
  // ── 标题级判活(2026-09-24 补,封 `## O42` 事故盲区)正反用例 ──────────────────────
  // 真实事故形态:同一节里既有 `## O42 …` 标题、又有 `- **O42 残余…**` 这类**同编号 bullet**。
  // 旧判据把两者都塞进同一个 headIdSet,于是"删标题留正文"在该编号仍被正文顶着的意义上"没丢"
  // —— 真仓 HEAD 抽掉 `## O42` 那一行实测 0 报。新判据要求候选里仍有**标题**以该编号开头。
  const O42SEC = [
    '## O42 台账也不能撒谎 —— 门 89 新增 R7「豁免依据必须可核验」,并当场抓到一条已入库的假依据(2026-09-24)',
    '- **O42 残余(不写作收口)**:① R7 只核结构事实,自然语言真伪仍无人核 —— 台账 13 条里 8 条是本次新增。',
    '- [x] ✅(2026-09-24) **O42③ 第三处残留**:仓库里根本没有源的那一份,按跟踪文件 grep 的取证路径自身有盲区。',
    '  - **普通说明**:这行没有编号,丢了也不该报,是既有职责边界。',
  ].join('\n')
  t(
    '删整节标题(同节仍有同编号 bullet 顶着编号)必须报丢失 —— 旧判据在此处完全无感',
    () => {
      const noHeading = O42SEC.split('\n')
        .filter((l) => !l.startsWith('## O42 '))
        .join('\n')
      const lost = lostMarkers(O42SEC, noHeading)
      // 旧判据的空转面:编号 O42 在候选里仍作为两行 bullet 的行首存在
      const headingIdsGone = !headingIdSet(noHeading).has('O42') && headIdSet(noHeading).has('O42')
      return (
        headingIdsGone &&
        lost.length === 1 &&
        lost[0].id === 'O42' &&
        lost[0].shape === 'heading' &&
        lost[0].marker.startsWith('O42 台账')
      )
    },
  )
  t(
    '标题族只改写文案 / 缩到更短 / ## 降级 ### 而保留编号 ⇒ 都不报(合法编辑不误伤)',
    () => {
      const reworded = O42SEC.replace(
        '## O42 台账也不能撒谎 —— 门 89 新增 R7「豁免依据必须可核验」,并当场抓到一条已入库的假依据(2026-09-24)',
        '## O42 换个说法:台账不能撒谎,而且这一版还顺手补了依据核验的判据说明文字,足够长所以仍是登记标题',
      )
      const shortened = O42SEC.replace(/^## O42 .*$/m, '## O42 短标题,短到不足 MIN_LEN 门槛的字数要求了')
      const demoted = O42SEC.replace(/^## O42 /m, '### O42 ')
      return (
        lostMarkers(O42SEC, reworded).length === 0 &&
        lostMarkers(O42SEC, shortened).length === 0 &&
        lostMarkers(O42SEC, demoted).length === 0
      )
    },
  )
  t(
    '取舍:只删标题、正文还在 ⇒ 判红(整节被挂到别人章节下正是最难发现的一种失真)',
    () => {
      // 刻意不给"正文仍在即视为搬家"的豁免:那样就等于把本次事故重新放回盲区。
      // 正当移除的两条出口由 dropArchivedLost(§1 归档)与紧急跳过承担,不靠放宽判据。
      const noHeading = O42SEC.split('\n').filter((l) => !l.startsWith('## O42 ')).join('\n')
      const bodyIntact = noHeading.includes('O42 残余') && noHeading.includes('第三处残留')
      return bodyIntact && lostMarkers(O42SEC, noHeading).length === 1
    },
  )
  t(
    '归档放行对标题族同样成立:archive 里能找到该标题原文 ⇒ 不算丢(§1 归档 = 正当移除)',
    () => {
      const noHeading = O42SEC.split('\n').filter((l) => !l.startsWith('## O42 ')).join('\n')
      const lost = lostMarkers(O42SEC, noHeading)
      const fakeArchive = (m) => (m.startsWith('O42 台账') ? 'PROJECT_PLAN_2026-09-24.md' : null)
      return lost.length === 1 && dropArchivedLost(lost, fakeArchive).length === 0
    },
  )
  t('headingLosses 只挑标题级并点名条目号(判红输出靠它给可诊断信息)', () => {
    const noHeading = O42SEC.split('\n').filter((l) => !l.startsWith('## O42 ')).join('\n')
    const lost = lostMarkers(O42SEC, noHeading)
    const hl = headingLosses(lost)
    return hl.length === 1 && hl[0].id === 'O42' && headingLosses([]).length === 0
  })
  t(
    '回归对照:本次收紧只作用于标题族,bullet 三族的判活路由一字未动',
    () => {
      // ① 只删标题:不得连带把同节两条 O42 bullet 报成丢失(它们真的还在)
      const noHeading = O42SEC.split('\n').filter((l) => !l.startsWith('## O42 ')).join('\n')
      const onlyHeading = lostMarkers(O42SEC, noHeading)
      // ② 复选任务行整行消失、且该编号再无别处以它开头 → 仍走老路报丢,shape 未被改道
      const solo = [
        '### 某任务',
        '- [ ] O48 独立任务行(两条子项):① 一条用于验证复选行老判据的登记行,正文可随便改写而不报。',
        '  - **进度(2026-09-24)**:这一行原样引用了 O48 独立任务行 却不在行首,不构成行首编号。',
      ].join('\n')
      const soloDropped = lostMarkers(solo, solo.replace(/^- \[ \] O48[^\n]*\n/m, ''))
      // ③ 加粗 bullet 只改写 marker 之后的文案 → 不报(既有"不误伤正常编辑"语义)
      const boldReworded = lostMarkers(
        O42SEC,
        O42SEC.replace('① R7 只核结构事实,自然语言真伪仍无人核', '① 换成别的说法,长度仍然足够足够长'),
      )
      return (
        onlyHeading.length === 1 &&
        onlyHeading[0].shape === 'heading' &&
        soloDropped.length === 1 &&
        soloDropped[0].shape === 'checkbox' &&
        boldReworded.length === 0
      )
    },
  )
  t(
    'heal 能力边界:标题级条目只回插一行且幂等;输出必须如实标注需人工归并',
    () => {
      const headingLine = O42SEC.split('\n')[0]
      const noHeading = O42SEC.split('\n').slice(1).join('\n')
      const reg = registrationOf(headingLine)
      const entry = {
        line: headingLine,
        marker: reg.marker,
        id: reg.id,
        shape: reg.shape,
        prev: null,
      }
      const first = healContent(noHeading, [entry])
      const second = healContent(first.out, [entry])
      // 回插后判活必须成立(标题集已在 healContent 内同步),否则就是重复插入的循环
      const ids = headIdSet(noHeading)
      return (
        first.inserted + first.appended === 1 &&
        second.inserted === 0 &&
        second.appended === 0 &&
        stillRegistered(entry, first.out, ids, headingIdSet(first.out)) &&
        !first.out.includes(headingLine + '\n' + headingLine)
      )
    },
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
      headIdOf('### 第二十批(2026-09-23):一条用于验证批次标题行首编号的登记标题,足够长。') ===
        '第二十批' &&
      // 加粗头紧跟编号 ⇒ 也算行首编号(让"改写成加粗形态"不被误判成丢失)
      headIdOf(
        '  - **G-166 第⑤步(第 57 轮续):N8n 屏改用共享交代组件并回收 6 个旧取词键,细节见提交说明。**',
      ) === 'G-166' &&
      // 反例:编号出现在正文中段(散文引用)、或短编号(P0/D6 两处必撞)都不给身份
      headIdOf(
        '  - **进度(2026-09-23 ⑤)**:`admin.ts:124` 的统一 admin preHandler 已收编,O13b 第二段 ①②③⑤ 已落,仅剩 ④。',
      ) === null &&
      headIdOf(
        '- [ ] P0 这一行的编号只有两个字,全文必撞,不给身份也不给保护。足够长的一行说明文字内容。',
      ) === null
    )
  })
  t('残余面根治:任务行整行被抹、但标题被别处原样引用时,行首编号这一路必须报出来', () => {
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
    const reworded = b.replace(
      '① 34 个白名单文件逐个迁移到集中封装并**删条目**',
      '① 换成 31 个文件',
    )
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
  })
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
  t('归档豁免只认**已入库**的归档副本:四条组合各自成立(G-183 ③)', () => {
    const marker = 'G-998 归档锚点入库可判定性测试条目'
    const name = 'PROJECT_PLAN_2099-01-01_auto-archive.md'
    const body = `# 归档\n\n- [x] ✅(2099-01-01) ${marker}:正文内容\n`
    // ① 面里有这个名字、blob 里有原文 ⇒ 放行(正当归档)
    const onFace = archivedCopy(marker, { list: () => [name], read: () => body })
    // ② 盘上有同名副本但**面里没有**(未 `git add`,或整目录被忽略)⇒ 不构成凭据。
    //    这一条就是本次修的洞:旧实现 readdirSync(磁盘),本机写一份就能授权删别人的登记行。
    const untracked = archivedCopy(marker, { list: () => [], read: () => body })
    // ③ 面里列出了路径、blob 却取不到(unmerged / 已删)⇒ 同样不放行,且不得抛
    const brokenBlob = archivedCopy(marker, { list: () => [name], read: () => null })
    // ④ 清单里混着别的文件名(归档目录同时放审计件)⇒ 仍只认 PROJECT_PLAN_*.md,不误读
    const otherNames = archivedCopy(marker, {
      list: () => ['hollow-backup-tags-2026-09-24.txt', name],
      read: (p) => (p === name ? body : marker),
    })
    return onFace === name && untracked === null && brokenBlob === null && otherNames === name
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
  // 规模安全闸正反例(2026-09-23 O24 事故反推):"丢得太多"必判基线异常,正常量必放行。
  t('规模闸:缺失占四成以上 → 判基线异常(拒绝回捞)', () => {
    const s = assessHealScale(120, 240, 0.4)
    return s.ok === false && s.reason.includes('50.0%')
  })
  t('规模闸:正常量(几条 / 恰好卡在阈值)→ 放行,不误伤真实丢失', () => {
    return assessHealScale(4, 240, 0.4).ok === true && assessHealScale(96, 240, 0.4).ok === true
  })
  t('规模闸:扫描数为 0 时不得判异常(无分母即不启用,避免空文档恒红)', () => {
    return assessHealScale(7, 0, 0.4).ok === true
  })
  t('规模闸阈值:env 非法值回落 0.4,合法的 0.9 生效', () => {
    const prev = process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO
    try {
      process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO = 'not-a-number'
      const bad = healSuspectRatio()
      process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO = '5'
      const over = healSuspectRatio()
      process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO = '0.9'
      const okv = healSuspectRatio()
      return bad === 0.4 && over === 0.4 && okv === 0.9
    } finally {
      if (prev === undefined) delete process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO
      else process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO = prev
    }
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
/**
 * 回捞行的**出处**(该登记行最后出现在哪一枚提交里)。
 * 打印它有两个作用:① 人工核验时不必再跑一遍 `git log -S`;② `historyMarkers` 的 `sha` 字段
 * 由此变成**有消费者**的字段 —— 上一版它只在构造点被引用,批量读迁移时构造点写成未定义标识符,
 * `--heal` 从此每次抛 ReferenceError,而 post-commit 的 `|| true` 把它吞成静默失效。
 * 取不到就如实打印「未知来源」,不把「字段没了」伪装成「这行没有出处」。
 */
function src7(entry) {
  return entry.sha ? String(entry.sha).slice(0, 9) : '未知来源'
}

function heal(commit) {
  // 自愈层只**告警**不拒跑:摘线时它恰恰是唯一还能把行捞回来的东西,拒绝执行等于见死不救
  guardWiring(false)
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
  // 规模安全闸:回捞量异常 ⇒ 判为基线错(活文档被并发重排/改写措辞),拒绝自动写盘。
  const scale = assessHealScale(Math.max(diskMissing.length, headMissing.length), seen.size)
  if (!scale.ok) {
    console.error(`❌ [plan-line-loss] 规模安全闸拦截 —— ${scale.reason}`)
    console.error(
      '   一次回捞四成以上登记行,几乎不可能是"真的全丢了",而是比对基线已变(并发会话重排了文档、\n' +
        '   或把同一条登记改写了措辞)。此时照单回捞 = 把同一内容的两个版本都留下,造出两份真相。\n' +
        '   请先人工确认:① HEAD 与工作区哪个是期望形态;② 缺失行的原文能否在 archive 里找到(§1 归档)。\n' +
        '   确认确为真实丢失后再临时放行:IHUI_PLAN_HEAL_MAX_MISSING_RATIO=1 node scripts/check-plan-line-loss.mjs --heal\n' +
        '   (紧急跳过整道自愈:HUSKY_SKIP_PLAN_HEAL=1)',
    )
    return 1
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
    for (const m of diskMissing) console.warn(`     · ${m.marker}(回捞自 ${src7(m)})`)
    if (healed.out !== disk) writeFileSync(path.join(ROOT, PLAN), healed.out, 'utf8')
  }
  if (headMissing.length) {
    console.warn(
      `⚠️  [plan-line-loss] HEAD 缺 ${headMissing.length} 条登记行(被旁路提交合掉,工作区可能仍留着):`,
    )
    for (const m of headMissing) console.warn(`     · ${m.marker}(HEAD 侧,回捞自 ${src7(m)})`)
  }
  /**
   * 标题级丢失的**能力边界必须如实说明**:healContent 只逐行回捞,把 `## O42 …` 这一行插回
   * 邻居之后,但它不知道整节正文去了哪、也无从恢复从属关系(正文多为非登记行,本就不在回捞面)。
   * 所以这里只报"标题行已回插、层级需人工归并",绝不打"整节已恢复"这类做不到的结论。
   */
  const headingLost = new Map()
  for (const m of [...diskMissing, ...headMissing])
    if (m.shape === 'heading' && !headingLost.has(m.marker)) headingLost.set(m.marker, m)
  if (headingLost.size) {
    const ids = [...new Set([...headingLost.values()].map((m) => m.id ?? m.marker))].join('、')
    console.warn(
      `⚠️  [plan-line-loss] 其中 ${headingLost.size} 条是**任务条目标题**(${ids})——\n` +
        `     自愈只能把标题这一行插回去,**无法重建"标题 + 其下整节正文"的从属关系**;\n` +
        `     标题级丢失需人工归并:` +
        '`git log --all -S "<标题>" -- PROJECT_PLAN.md`' +
        ` 定位原提交,\n` +
        `     再 ` +
        '`git show <sha>:PROJECT_PLAN.md`' +
        ` 把**整节**原文一起插回原锚点(AGENTS.md §12b 协作收尾)。`,
    )
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
  // 提交链/CI 上的 check 模式:**先验自己还在不在链上**。摘线时若照常报"无丢失",
  // 那就是最坏的一种绿 —— 门没跑,却以门的名义宣布通过。
  guardWiring(true)
  const isStaged = args.includes('--staged')
  try {
    const { ok, lost, prose } = runCheck(isStaged)
    /** 非登记行丢失只报数(理由见 proseLossReport 注释);阈值只影响措辞强度,不改变退出码 */
    const reportProse = () => {
      if (!prose?.lostCount) return
      const head =
        prose.lostCount >= 100
          ? `❗ [plan-line-loss] 非登记行丢失 ${prose.lostCount} 行(≥100 高度疑似"旧基线整文件提交")`
          : `ℹ️ [plan-line-loss] 非登记行比 HEAD 少 ${prose.lostCount} 行`
      console.warn(
        `${head} —— 本闸只锚编号登记行,这类行**不在红灯判据内**。\n` +
          prose.sample.map((l) => `     样例: ${l.slice(0, 88)}`).join('\n') +
          `\n     自查:确认这些行是否已被有意改写/归档(归档须落 .ihui-agent/archive/PROJECT_PLAN_*.md);\n` +
          `           若确属误覆盖,按上面 1) 的三步从 HEAD 逐行取回后再提交。`,
      )
    }
    if (ok) {
      console.log(
        `✅ [plan-line-loss] PROJECT_PLAN.md 无登记行丢失(${isStaged ? '暂存区' : '工作区'})`,
      )
      reportProse()
      process.exit(0)
    }
    console.error(
      `❌ [plan-line-loss] ${lost.length} 条已入库的登记行在本次提交内容里彻底消失:\n` +
        lost
          .map(
            (x) =>
              `   · ${x.marker}${x.shape === 'heading' ? `   ← 条目标题 ${x.id}` : ''}\n` +
              `     ${x.line.trim().slice(0, 90)}…`,
          )
          .join('\n'),
    )
    const hl = headingLosses(lost)
    if (hl.length) {
      console.error(
        `\n  🔴 标题级丢失 ${hl.length} 处,条目号:${[...new Set(hl.map((x) => x.id ?? x.marker))].join('、')} ——\n` +
          '     丢的不是一行,而是那个条目在计划里**唯一的可寻址入口**:其下正文会被挂到上一节,\n' +
          '     而 `--heal` 只回捞单行、补不回整节层级 ⇒ **标题级丢失一律需人工归并**(按下面 1)\n' +
          '     取那一节的**整节**原文插回原锚点,不要只补标题行)。',
      )
    }
    console.error(
      '\n  💡 这几乎总是"按内存里的旧计划文档整文件提交"造成的覆盖,不是有意删除:\n' +
        '     1) 从原始提交逐字取回:`git log --all -S "<标记>" -- PROJECT_PLAN.md` 找到引入它\n' +
        '        的提交,`git show <sha>:PROJECT_PLAN.md` 取整行,插回原锚点后再提交;\n' +
        '     2) 确属归档 → 原文必须出现在**已入库**的 .ihui-agent/archive/PROJECT_PLAN_*.md 里(本闸按\n' +
        '        被审面核对,本机写一份未提交的副本不算凭据;§1 归档流程 + G-183);\n' +
        '     3) 提交计划文档前一律现取 HEAD 版本再插自己的行,别相信自己内存里的那份;\n' +
        '     4) 给**已入库的条目标题改编号**(如 O42 → O45)与本闸要防的"旧基线覆盖"在内容上\n' +
        '        不可区分,同样判红:旧标题必须留在原处(或按 §1 归档),新编号另起一节。\n' +
        '     紧急跳过:HUSKY_SKIP_PLAN_LINE_LOSS=1(会把别人的登记行写没,慎用)\n',
    )
    process.exit(1)
  } catch (e) {
    console.error(`❌ [plan-line-loss] 检查失败:${e?.message ?? e}`)
    process.exit(2)
  }
}

/**
 * AGENTS.md §22c:镜像测试一律 import 本对象,**禁止**在测试里复制判据实现
 * (复制 = 两套并行真相,源函数一改测试就"假绿",守门形同虚设)。
 * §22d 要求本 export 位于 `if (isDirectRun)` 之后,免得测试 import 时把 CLI 主流程带起来。
 */
export const __test__ = {
  markerOf,
  headIdOf,
  headIdSet,
  headingIdSet,
  registrationOf,
  registeredLines,
  stillRegistered,
  lostMarkers,
  dropArchivedLost,
  archivedCopy,
  archiveExemptFor,
  headingLosses,
  missingFrom,
  healContent,
  proseLossReport,
  healSuspectRatio,
  assessHealScale,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
