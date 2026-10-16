#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对话流元素覆盖守门(PROJECT_PLAN.md D51 / 验收门 H13)
//
// 单一事实源 = scripts/data/chat-flow-elements.json(已实现锚点 + 声明事件 + 基线)
//            + PROJECT_PLAN.md 第四轮 `- [ ] **Dnn …(G-xx)**` 任务行(planned 元素,实时解析)。
// 五类违规即阻塞:
//   ① 期望元素锚点漂移(已实现元素的文件或关键标识不见 → 说明渲染位被删/改名)
//   ② 元素声明依赖的契约事件在两端契约里找不到(ai-service 与 packages/shared 必须同时有)
//   ③ 清单条目数倒退(低于 entryCountBaseline = 有人删了任务行或删了已实现元素而未说明)
//      **审面 = PROJECT_PLAN.md ⊕ 同面的归档件**(2026-09-28 立,见下方"审面"段):
//      这一判据数的是"清单里还有没有这条 G-ID 的交代",不是"这一行还躺在台账正文里"。
//   ④ 锚点存续性倒退(④a 单条目锚点数 < anchorCountBaseline.perElement / ④b 全清单锚点总数 < total)
//      —— 只按**条目**判不按**文件**判:锚点在同条目内从一端搬到另一端是合法重构,总数不变即绿。
//   ⑤ 注释式摘线(锚点的关键标识在**代码面**上已不见,只在注释里存续 = anchor-commented-out)
//      原实现是 `text.includes(mustMatch)`,把宿主那行 `import QueueBar from '../components/QueueBar'`
//      **改成注释**仍然"含该子串"→ 门报绿。现改为在**剥掉注释后的文本**上匹配。
// 设计取向:planned 元素**不**要求锚点(否则入库即恒红),增长只抬基线不拦人。
//
// 单调性(本票的自证核心):⑤ 只会让判红集合**变大**,不可能让原本红的变绿 —— 剥注释只删字符,
// `includes` 命中面单调收缩。交付时以「改前红 ⊇ 改后红」的差集对照证明(要求 改前红而改后绿 = 0)。
// 剩余盲区如实登记(不得当作已全解决):
//   · 状态机收尾处于「未闭合块注释 / 未闭合三引号串」⇒ 该文件判"不可信",**回退原文**(与改前等强),
//     计数打进输出的 undetermined 里,不静默;
//   · 除零/异或等歧义形态下的正则字面量按普通字符处理(只在「前一个有效字符 ∈ ( , = : [ ! & | ? { ;
//     或行首」且同一行内闭合)时才当正则跳过),因此形如 `a /= /re/` 这类极端写法仍可能被当成注释起点;
//   · 判据⑤认的是"代码面上不存续",不认"运行时是否真被调用"(摘线到一段死代码里仍算存续)。
//
// 用法:node scripts/check-chat-element-coverage.mjs [--self-test] [--json] [--staged|--worktree]
//   runner 下发的 --staged 不参与**文件范围**收窄:锚点/契约/清单条目都是"整仓属性",
//   按暂存集收范围恰好会放过"删掉别处锚点"这一类(与守门 78 同取向);但它**参与面**的选择
//   (--staged = 索引 blob,缺省 = HEAD blob,--worktree = 仅人工逃生舱,两面旗同给 ⇒ exit 2)。
//
// ─── 审面(2026-09-28 立;这一票改的是审面,不是阈值)───────────────────────────────
//
// 起因不是假想:2026-09-28 用户决定把自动归档档改成"完成即归档"(`archive-completed-tasks.mjs`
// 的 daysThreshold 缺省 = 0),台账里完成的 D 行会被**搬进** `.ihui-agent/archive/PROJECT_PLAN_*.md`。
// 而本门的 entryCount 里有一部分正是从台账正文的 D 行现读 G-ID(`planSource.taskLinePattern`),
// 于是"搬走"被读成"撤销":当天实测台账行数没减、元素没删,entryCount 却从基线 103 掉到 74 判红,
// 主会话手工把 68 行搬回台账才转绿 —— 那是**症状处置**,政策继续跑就会一次次复发。
//
// 先例是仓里已有的正确做法,照抄不重新发明:守门 71(`check-plan-line-loss.mjs`)的归档豁免
// "原文能在 archive 里找到 ⇒ 不算丢",且清单与内容**同面同轮**取(`--staged` 走 `git ls-files`
// 索引、全量走 `git ls-tree HEAD`,不 `readdirSync`);守门 13c 的 A2/A3 同一取向。
// 依据 G-183/G-173:**只躺在本机磁盘上、从未进任何提交的归档件不构成凭据** —— 否则"这台机
// 归档过"可以授权"那台机删行",而 §1 那句"archive 里找得到 ⇒ 不算丢"承诺的是一件事实在仓库里,
// 不是本机巧合。
//
// **基线不为变绿而下调**:`scripts/data/chat-flow-elements.json` 的 `entryCountBaseline` 保持现值
// (103)。判据变宽的唯一来源是"归档件在同面上确实带着那一行",不是把阈值调低。
// 三态不许并桶:归档件列到 0 个候选 ⇒ exit 2「无法判定」(枚举失效不是通过);清单里有名字而 blob
// 取不到 ⇒ **点名并计数**且 exit 2 拒绝出具合格证(把"没判"写成"判过了"是本仓最高频失效型)。
//
// 2026-10-08(gitRaw 型 B 收尾批)git 出口收口:本文件唯一自拼派生 `gitAt()`(三个调用面:
// nameSet 的两把 `git diff --name-only` 清单、取 blob 的 `git show :<rel>` / `git show HEAD:<rel>`)
// 迁取材层 scripts/lib/face-reader.mjs 的 `gitRaw`;`const GIT_BIN = process.env.GIT_BIN || …`
// 与 execFileSync import 随之删除。行为面对照:
//  · 二进制:旧 `process.env.GIT_BIN || win32 硬编码 bin/git.exe || 'git'` → 层内
//    `resolveGitBin() || 'git'` —— GIT_BIN env 是层候选链第一格且经 --version 验证,逃生舱语义
//    保留;win32 硬编码路径收进层验证链(旧码路径缺失 ⇒ 派生必败 ⇒ repoUsable 闩跳闸全量退化;
//    层会试下一候选,净收益)。
//  · 旧 `cwd: ROOT` → 层 `-C <ROOT>` 同效;`-c safe.directory=*` 同;层另带
//    core.quotepath=false(两把清单直接充当 blob 规格素材,非 ASCII 名可对回真实文件,净收益);
//    stdio 旧 ['ignore','pipe','ignore'] → 层无 input 态 ['ignore','pipe','pipe'],stderr 由层
//    收进异常消息 —— 本函数 catch 折 null 弃错误 ⇒ 可观察面同;timeout 旧 30s 显式保留
//    ({timeout:30_000});maxBuffer 旧 64MB → 层 64MB 同值。
//  · 失败折值一字未动:catch → null;repoUsable 闩(nameSet 失败即置 false,此后 gitAt 一律
//    null ⇒ 内容读退化 readDisk)与闩前置短路次序逐字保留;"判哪一面"三支判据一字未动。

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, selectFace, FACE_LABEL, Undetermined } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = join(ROOT, 'scripts', 'data', 'chat-flow-elements.json')
const CONTRACT_PY = join(ROOT, 'apps', 'ai-service', 'app', 'core', 'sse_contract.py')
const CONTRACT_TS = join(ROOT, 'packages', 'shared', 'src', 'sse', 'contract.ts')
const SKIP_ENV = 'HUSKY_SKIP_CHAT_ELEMENT_COVERAGE'

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * 判的是**仓库内容**,不是共享工作区里某个人未提交的缓冲区(与守门 77 同一取向,2026-09-24 补)。
 *
 * 原实现一律 `readFileSync`,于是并行会话的半截草稿会把无关提交钉红:2026-09-24 实测
 * `AiAssistantN8nScreen.tsx` 的 5 个锚点在 HEAD 里全在、在别人的未提交重写里全没了 →
 * [57] 恒红,而本会话只改了守门脚本。恒红的唯一结局是人人 --no-verify,连带把真正防回归的
 * 判据一起关掉(见 AGENTS §12)。
 *
 * 取内容规则:
 *   该路径已在暂存区(≠ HEAD)→ 取**索引 blob** = 这次提交会带走什么;
 *   该路径只有工作树改动(未暂存)→ 取 **HEAD blob** = 别人没提交的东西不算本仓状态;
 *   与 HEAD 一致 → 直读磁盘(三者等价,免为 66 个锚定文件逐个开进程)。
 */
let repoUsable = true
function gitAt(args) {
  if (!repoUsable) return null
  try {
    return gitRaw(args, ROOT, { timeout: 30_000 })
  } catch {
    return null
  }
}
const nameSet = (args) => {
  const out = gitAt(args)
  if (out === null) {
    repoUsable = false
    return null
  }
  return new Set(out.split('\n').filter(Boolean).map((l) => l.replaceAll('\\', '/')))
}
const STAGED = nameSet(['diff', '--name-only', '--cached'])
const WORKTREE_DIRTY = nameSet(['diff', '--name-only'])

/**
 * 纯决策(自检直接复用):给一个路径的三种"是否偏离"布尔,返回该读哪一份内容。
 *   staged            → 'index'(= 这次提交会带走的内容)
 *   仅工作树脏        → 'head'(别人没提交的缓冲区不算本仓状态)
 *   干净              → 'disk'(与 index/HEAD 等价,免开进程)
 */
export function pickSource({ staged, worktreeDirty }) {
  if (staged) return 'index'
  if (worktreeDirty) return 'head'
  return 'disk'
}

export function contentAt(rel, repoRoot = ROOT) {
  const norm = rel.replaceAll('\\', '/')
  const abs = join(repoRoot, norm)
  const readDisk = () => (existsSync(abs) ? readFileSync(abs, 'utf8') : '')
  if (resolve(repoRoot) !== resolve(ROOT) || !repoUsable) return readDisk()
  const src = pickSource({ staged: !!STAGED?.has(norm), worktreeDirty: !!WORKTREE_DIRTY?.has(norm) })
  if (src === 'disk') return readDisk()
  const blob = gitAt(['show', src === 'index' ? `:${norm}` : `HEAD:${norm}`])
  return blob !== null ? blob : readDisk()
}

// ─── 审面(2026-09-28 立):台账 ⊕ **同面**的归档件 ─────────────────────────────────
//
// 清单条目数判的是"这条 G-ID 在仓库里还有没有交代",不是"这一行还躺在台账正文里"。
// 自动归档档 2026-09-28 起为"完成即归档"(daysThreshold 缺省 0,用户的当天决定,不是缺陷),
// 完成的 D 行会被**搬进**归档件;只数台账正文就把"搬走"读成"撤销"(当天实测 entryCount 103→74
// 而台账行数一行未减、元素一个未删)。归档件必须按**被审面**取:清单走 `git ls-tree HEAD` /
// `git ls-files --cached`(不是 readdirSync),内容走 face-reader 的 catBatch **同面同轮**读满
// (先例 = 守门 71 的 archivedCopy / 守门 13c 的 A2/A3)。
// 只躺在本机、从未进任何提交的归档件不构成凭据(G-183):否则"A 机归档过"能授权"B 机删行"。

/** 归档目录(相对仓库根)与文件名判据 —— 与守门 71 同形,刻意不另立第二套命名。 */
const ARCHIVE_REL = '.ihui-agent/archive'
const ARCHIVE_FILE_RE = /(^|\/)PROJECT_PLAN_.*\.md$/
/** 归档清单/内容一次 git 派生的上限:归档件是台账搬运行的产物,单份可达数百 KB。 */
const ARCHIVE_GIT_TIMEOUT = 60_000

/**
 * 纯函数:某一面里该走哪条取内容路径。
 * 与 `pickSource`(锚点判据的既有取向:已暂存取索引 / 仅工作树脏取 HEAD / 干净取磁盘,
 * 三者对干净文件逐字等价)分开,是因为**归档面从来没有"磁盘档"**:磁盘面从来不是归档凭据。
 */
export function archiveFaceFor(face) {
  return face === 'staged' ? 'staged' : 'head'
}

/** 某一面里真实存在的归档副本路径(已入库的那些年)。`staged` 读索引,`head` 读 HEAD 树。 */
export function listArchiveFilesOnFace(face, root = ROOT) {
  const f = archiveFaceFor(face)
  const args =
    f === 'staged'
      ? ['ls-files', '-z', '--', ARCHIVE_REL]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ARCHIVE_REL]
  return gitRaw(args, root, { timeout: ARCHIVE_GIT_TIMEOUT })
    .split('\0')
    .filter(Boolean)
    .map((p) => p.replaceAll('\\', '/'))
    .filter((p) => ARCHIVE_FILE_RE.test(p))
    .sort()
}

/**
 * 归档补偿维的**第二来源**:退役留痕 ledger(2026-10-16 立)。
 *
 * 来历:机主 2026-10-16 令"完成即删,不留档、不归档"(AGENTS §1),`.ihui-agent/archive/PROJECT_PLAN_*.md`
 * 整体退出审面 —— 当次实测 HEAD 上 0 份(目录里只剩 1 份 purger 台账)。而这一维不是装饰:
 * 它是"台账里被搬走的行不得被读成撤销"的凭据(2026-09-28 现场:行数没减、元素没删,entryCount
 * 从 103 掉到 74 判红,当时靠手工搬回 68 行才转绿 = 症状处置)。凭据从"归档件"换成"归档件里抽出的
 * 编号集合",**仍是已入库、可复核的内容**(G-183/G-173:只躺在本机磁盘上、从未进任何提交的归档件不构成凭据),
 * 所以这不是把判据调松,是把它取材的那一面搬到政策还在的地方。
 * 面上还有归档件时**一律优先用它们**(`source='face'`),本文件只在整批退出时顶上。
 * **两个来源都空 ⇒ `enumerated === 0` 照旧交调用方判死 exit 2** —— 退役 ≠ 看不见;
 * 谁把这份 ledger 也删了,那一格就必须喊响,而不是悄悄绿(这条是本品自己的阳性对照)。
 */
const LEDGER_REL = 'scripts/data/chat-flow-archive-ledger.json'

/** 纯函数:ledger 文本 → 归档面可用的合成条目。缺文件 ⇒ absent;形状坏 ⇒ error(绝不静默当"没有那份")。 */
export function ledgerCorpus(text, source = LEDGER_REL) {
  if (!text || !text.trim()) return { archives: [], error: null, absent: true }
  let j
  try {
    j = JSON.parse(text)
  } catch (e) {
    return { archives: [], error: `退役 ledger(${source})不是合法 JSON:${e?.message ?? e}`, absent: false }
  }
  const ids = Array.isArray(j?.gapIds) ? j.gapIds.filter((x) => typeof x === 'string' && x) : null
  if (!ids || ids.length === 0) return { archives: [], error: `退役 ledger(${source})里 gapIds 为空或形状不对 ⇒ 本维无从判`, absent: false }
  return {
    archives: [{ path: `${source}#gapIds`, text: ids.join('\n'), ledger: true, gapIds: ids.length, sourceCommit: j.sourceCommit || null }],
    error: null,
    absent: false,
  }
}

/**
 * 台账 ⊕ 归档件的合并取材(一次批量派生,逐文件各开一次 git 是本仓守门 80 立过的 fork 风暴)。
 * @returns {{archives:Array<{path:string,text:string}>, missing:string[], enumerated:number, face:string, error:string|null, source:string}}
 *   - `enumerated === 0` ⇒ 调用方必须**判死**(空扫正是本判据要防的那一型故障,不得记绿);
 *   - `missing` = 面上有名字而 blob 取不到(unmerged / 对象损坏)⇒ 必须点名计数,
 *     不得静默当"没有那份"(把"没判"写成"判过了"是本仓最高频失效型)。
 */
export function readArchiveCorpus(face, root = ROOT) {
  const usedFace = archiveFaceFor(face)
  try {
    const files = listArchiveFilesOnFace(usedFace, root)
    if (files.length === 0) {
      // 审面没有归档件 ⇒ 试退役留痕 ledger,**同一面取材**(索引 blob 或 HEAD blob,绝不回落磁盘)
      const specs = [`${usedFace === 'staged' ? ':' : 'HEAD:'}${LEDGER_REL}`]
      const got = catBatch(root, specs, { timeout: ARCHIVE_GIT_TIMEOUT })
      const l = ledgerCorpus(got.get(specs[0]) ?? '')
      if (l.absent) return { archives: [], missing: [], enumerated: 0, face: usedFace, error: null, source: 'none' }
      if (l.error) return { archives: [], missing: [], enumerated: 0, face: usedFace, error: l.error, source: 'ledger-broken' }
      return { archives: l.archives, missing: [], enumerated: l.archives.length, face: usedFace, error: null, source: 'retirement-ledger' }
    }
    const specs = files.map((p) => `${usedFace === 'staged' ? ':' : 'HEAD:'}${p}`)
    const got = catBatch(root, specs, { timeout: ARCHIVE_GIT_TIMEOUT })
    const archives = []
    const missing = []
    for (let i = 0; i < files.length; i++) {
      const v = got.get(specs[i])
      if (typeof v === 'string') archives.push({ path: files[i], text: v })
      else missing.push(files[i])
    }
    return { archives, missing, enumerated: files.length, face: usedFace, error: null, source: 'face' }
  } catch (e) {
    return {
      archives: [],
      missing: [],
      enumerated: 0,
      face: usedFace,
      error: e instanceof Undetermined ? e.message : `归档面取材异常:${e?.message ?? e}`,
      source: 'error',
    }
  }
}

/** 一路文本里 D 族任务行贡献的 G-ID 集合(判据与 parsePlanned 同一份 pattern,不另抄)。 */
export function gapIdsOfText(text, planSource) {
  const set = new Set()
  for (const p of parsePlanned(String(text ?? ''), planSource.taskLinePattern, planSource.gapIdPattern)) {
    for (const g of p.gaps) set.add(g)
  }
  return set
}

/**
 * 纯判据:审面 = 台账正文 ⊕ 同面归档件。
 * 集合按 G-ID 去重(同一件事在台账与归档件各出现一次只算一条,不得双计),
 * 并单独报"只存在于归档件"的那一部分 = **搬走而未撤销**的证据(本票的全部理由)。
 * @returns {{gapIds:Set<string>, fromPlan:number, archivedOnly:string[]}}
 */
export function mergeGapIds({ planText, archives = [], planSource }) {
  const fromPlan = gapIdsOfText(planText, planSource)
  const gapIds = new Set(fromPlan)
  const archivedOnly = new Set()
  for (const a of archives) {
    for (const g of gapIdsOfText(a?.text ?? '', planSource)) {
      if (!gapIds.has(g)) archivedOnly.add(g)
      gapIds.add(g)
    }
  }
  return { gapIds, fromPlan: fromPlan.size, archivedOnly: [...archivedOnly].sort() }
}

// ─── 判据⑤ 剥注释(2026-09-25 立,堵"把宿主那行 import 改成注释"仍算存续的假绿)──────
//
// 为什么必须**字符串感知**:本仓已两次栽在"剥注释状态机被串内 /* 骗进块注释状态 ⇒ 假绿"
// (守门 70 的同类缺陷),而 `'https://x'` 里的 `//` 若被当注释起点,会把整行真代码吃掉 →
// 反方向的**假红**(本门 blocking 且每轮都跑,假红 = 恒红门 = 逼人 --no-verify)。
// 因此这里不是"能省则省"的近似:引号/反引号/三引号一律先进字符串态,注释判定只在 code 态发生。
const JS_LIKE = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'])
const PY_LIKE = new Set(['py'])
/** 正则字面量的"前置即合法"集合:刻意不含 `< > + - * % ~ ^`(那些位置后面的 `/` 更可能是除法/JSX 闭合) */
const REGEX_OPENERS = '(,=:[!&|?{};'

function regexLiteralEnd(text, from) {
  for (let j = from; j < text.length; j++) {
    const ch = text[j]
    if (ch === '\\') {
      j += 1
      continue
    }
    if (ch === '\n') return -1 // 不在同一行闭合 ⇒ 不是正则字面量
    if (ch === '/') return j + 1
  }
  return -1
}

/**
 * 剥掉注释,返回 `{ text, trusted, reason }`。
 * 覆盖:行注释(`'//' + 后续`)、块注释(`'/*' … '*' + '/'`)、JSX 花括号块注释、Python 井号注释、
 * 以及单引/双引/反引号/三引号串内的伪注释符(一律不剥)。
 * `trusted:false` 只出现在**收尾仍处于块注释或三引号串**(文件形态可疑,继续剥会造成大面积假红),
 * 调用方必须回退原文 —— 回退=与改前等强,绝不比改前更宽。
 */
export function stripCodeComments(input, ext = '') {
  const text = typeof input === 'string' ? input : ''
  const isJs = JS_LIKE.has(ext)
  const isPy = PY_LIKE.has(ext)
  const n = text.length
  let out = ''
  let i = 0
  let state = 'code' // code | line | block | str
  let quote = ''
  let triple = false
  let lastSig = ''
  while (i < n) {
    const c = text[i]
    const d = text[i + 1]
    if (state === 'code') {
      if (c === '/' && d === '/') {
        state = 'line'
        i += 2
        continue
      }
      if (c === '/' && d === '*') {
        state = 'block'
        i += 2
        continue
      }
      if (isPy && c === '#') {
        state = 'line'
        i += 1
        continue
      }
      // 正则字面量:/…/ 里可以有 //,不当注释起点(故须在字符串分支之前、注释分支之后判)
      if (isJs && c === '/' && (lastSig === '' || lastSig === '\n' || REGEX_OPENERS.includes(lastSig))) {
        const end = regexLiteralEnd(text, i + 1)
        if (end > 0) {
          out += text.slice(i, end)
          i = end
          lastSig = '/'
          continue
        }
      }
      if (c === "'" || c === '"' || (isJs && c === '`')) {
        triple = text[i + 1] === c && text[i + 2] === c
        quote = c
        out += triple ? c + c + c : c
        i += triple ? 3 : 1
        state = 'str'
        lastSig = c
        continue
      }
      out += c
      if (c === '\n') lastSig = '\n'
      else if (!/\s/.test(c)) lastSig = c
      i += 1
      continue
    }
    if (state === 'line') {
      if (c === '\n') {
        state = 'code'
        out += c
      }
      i += 1
      continue
    }
    if (state === 'block') {
      if (c === '*' && d === '/') {
        state = 'code'
        i += 2
        lastSig = ''
        continue
      }
      if (c === '\n') out += c // 保行号,便于人工对照
      i += 1
      continue
    }
    // state === 'str'
    if (c === '\\') {
      out += c + (d ?? '')
      i += 2
      continue
    }
    if (!triple && c === '\n') {
      // 单/双引号串不得跨行 ⇒ 这个引号其实是除号/异或之类的歧义字符,退回 code 继续判
      state = 'code'
      out += c
      i += 1
      continue
    }
    if (c === quote && (!triple || (text[i + 1] === quote && text[i + 2] === quote))) {
      out += triple ? quote + quote + quote : quote
      i += triple ? 3 : 1
      state = 'code'
      lastSig = quote
      continue
    }
    out += c
    i += 1
  }
  const reason =
    state === 'block' ? '块注释未闭合' : state === 'str' && triple ? '三引号串未闭合' : state === 'str' ? '字符串未闭合' : ''
  // 单行串未闭合已在循环里就地退回 code(不影响收尾);只有块状结构未闭合才判不可信
  return { text: out, trusted: state !== 'block' && !(state === 'str' && triple), reason }
}

const extOf = (file) => (String(file).split('.').pop() || '').toLowerCase()

/** 从 PROJECT_PLAN.md 解析第四轮任务行 → planned 元素与其 G-ID */
export function parsePlanned(planText, taskLinePattern, gapIdPattern) {
  const planned = []
  const lineRe = new RegExp(taskLinePattern, 'mu')
  const gapRe = new RegExp(gapIdPattern, 'gu')
  for (const line of planText.split('\n')) {
    const hit = lineRe.exec(line)
    if (!hit) continue
    const gaps = [...new Set(line.match(gapRe) ?? [])]
    planned.push({ task: hit[2], done: hit[1] === 'x', title: line.slice(hit.index).slice(0, 90), gaps })
  }
  return planned
}

export function checkAnchors(implemented, repoRoot = ROOT, opts = {}) {
  const baselineEntries = Array.isArray(opts.commentOnlyBaseline) ? opts.commentOnlyBaseline : []
  const keyOf = (v) => `${v.id} :: ${v.file} :: ${v.mustMatch}`
  const known = new Set(baselineEntries.map(keyOf))
  const stillDebt = new Set()
  const violations = []
  const notices = []
  let undetermined = 0
  for (const el of implemented) {
    for (const anchor of el.anchors ?? []) {
      const text = contentAt(anchor.file, repoRoot)
      if (!text) {
        violations.push({ kind: 'anchor-missing-file', id: el.id, detail: anchor.file })
        continue
      }
      if (!anchor.mustMatch) continue
      if (!text.includes(anchor.mustMatch)) {
        violations.push({
          kind: 'anchor-missing-marker',
          id: el.id,
          detail: `${anchor.file} 内找不到「${anchor.mustMatch}」`,
        })
        continue
      }
      // 原文含该子串 ≠ 代码面上存续:判据⑤在**剥注释后**再匹配一次。
      const { text: codeSurface, trusted, reason } = stripCodeComments(text, extOf(anchor.file))
      if (!trusted) {
        undetermined += 1
        notices.push({
          kind: 'anchor-strip-undetermined',
          id: el.id,
          detail: `${anchor.file} 剥注释不可信(${reason}),本条按原文判 = 与改前等强,未放宽`,
        })
        continue
      }
      if (codeSurface.includes(anchor.mustMatch)) continue
      // 键必须含**元素 id**(不是 anchor.id —— 锚点对象上没有 id,写错会让存量清单永不命中,
      // 把 3 处存量当场判红 = 恒红门)。上面 notices 的 cleared 计数就是这条缺陷的显形处。
      const k = `${el.id} :: ${anchor.file} :: ${anchor.mustMatch}`
      if (known.has(k)) {
        stillDebt.add(k)
        notices.push({ kind: 'anchor-commented-out-known', id: el.id, detail: k })
        continue
      }
      violations.push({
        kind: 'anchor-commented-out',
        id: el.id,
        detail:
          `${anchor.file} 内「${anchor.mustMatch}」**只存在于注释里**(代码面上已不存续)—— ` +
          `宿主那行被摘线成注释,或锚点本来就指错了对象。清账:把 mustMatch 改指代码面上的真实标识`,
      })
    }
  }
  // 登记项没命中 = 要么已清偿(好事),要么该行的 id/file/mustMatch 与任何锚点都对不上(登记错位,
  // 效果等同"基线失效")。两种都只提示不判红 —— 但它必须被打印,否则错位会静默成恒红。
  for (const k of known) if (!stillDebt.has(k)) notices.push({ kind: 'anchor-commented-out-cleared', detail: k })
  return { violations, notices, undetermined }
}

/**
 * 判据④ 锚点存续性(棘轮,只减即红)。
 * 关键取舍:额度按**条目**登记而不是按文件,所以"把某端锚点搬到同条目的另一端"总数不变 ⇒ 绿。
 * 恒红是本仓记过最多次的反面教训(逼人以 --no-verify → 连带废掉全部守门),故新增一律放行,
 * 只有低于登记额度才判红;确属撤销须在同 PR 里调额度并说明理由。
 */
export function checkAnchorPersistence(implemented, persistence) {
  const list = Array.isArray(implemented) ? implemented : []
  const perElement =
    persistence && typeof persistence === 'object' && persistence.perElement && typeof persistence.perElement === 'object'
      ? persistence.perElement
      : null
  const total = persistence && typeof persistence === 'object' ? persistence.total : null
  if (perElement === null || typeof total !== 'number' || !Number.isFinite(total)) {
    return {
      violations: [
        {
          kind: 'anchor-baseline-missing',
          id: '(persistence)',
          detail:
            '台账缺 anchorCountBaseline.total / .perElement —— 整份登记表被按旧基线回写的指纹' +
            '(AGENTS §12:多会话共写的登记表正是最易被回写的一类)。恢复该字段,或在同 PR 说明理由后重建',
        },
      ],
      danglingBaseline: [],
    }
  }
  const violations = []
  const seen = new Set()
  let sum = 0
  for (const el of list) {
    const n = (el.anchors ?? []).length
    sum += n
    const floor = perElement[el.id]
    if (typeof floor !== 'number') continue
    seen.add(el.id)
    if (n < floor) {
      violations.push({
        kind: 'anchor-count-regression',
        id: el.id,
        detail: `锚点数 ${n} < 基线 ${floor}(少 ${floor - n} 条)—— 搬到同条目另一端可以(总数不变即绿),整批删不行`,
      })
    }
  }
  if (sum < total) {
    violations.push({
      kind: 'anchor-total-regression',
      id: '(persistence)',
      detail: `全清单锚点总数 ${sum} < 基线 ${total} —— 有人删了锚点行而未调 anchorCountBaseline`,
    })
  }
  const danglingBaseline = Object.keys(perElement).filter((k) => !seen.has(k))
  return { violations, danglingBaseline }
}

export function checkEvents(implemented, contractPyText, contractTsText) {
  const violations = []
  for (const el of implemented) {
    for (const ev of el.events ?? []) {
      const inPy = contractPyText.includes(`"${ev}"`) || contractPyText.includes(`'${ev}'`)
      const inTs = contractTsText.includes(`"${ev}"`) || contractTsText.includes(`'${ev}'`)
      if (!inPy || !inTs) {
        violations.push({
          kind: 'event-contract-drift',
          id: el.id,
          detail: `${ev}: ai-service=${inPy ? '有' : '无'} shared=${inTs ? '有' : '无'}(两端必须同时声明)`,
        })
      }
    }
  }
  return violations
}

/**
 * 判据③ 条目数对账(2026-10-16 改**射程**;不是放宽 —— 是把拦不住的那一半交还给拦得住的门)。
 *
 * 原先只有一条绝对式 `entryCount < baseline ⇒ 判红`,而 `entryCount = 代码侧元素数 + 台账派生 G-ID 数`。
 * 后一半自机主 2026-10-16 令"完成即删,不留档、不归档"(AGENTS §1)起**不再是持久不变式**:
 * 任务完成后整行从台账摘除是政策要求的动作,不是撤销。当次实测 HEAD 面上台账派生那一半只剩 5/63,
 * 于是这条绝对式对**接下来每个人的每一次提交**都成立 ⇒ 人人被逼 `--no-verify`。§12e 把这一型写死了:
 * "与提交内容无关的红,唯一结局是逼人跳门、连带废掉全部守门"。
 *
 * 现在的分工**按凭据在不在自动切换**(政策今天来回翻过:AGENTS 里"归档已退役"与"归档机制"两段并存,
 * 另有会话正在把归档件往回恢复 —— 所以这一维不能一次性改死):
 *  · `mode='face'`(面上真有归档件,或 self-test 合成夹具)⇒ **沿用绝对式** `entryCount < baseline` 判红,
 *    牙齿一个字没动;归档件哪天回到面上,这一维当场自动重新武装;
 *  · `mode='retirement-ledger'`(归档件整批退出、由退役 ledger 顶上来)⇒ 拆半拦:
 *      − **代码侧照旧判红**:`entryCount − 台账派生数 < elementCountBaseline` 即拦,删已实现元素必被抓;
 *      − 台账派生那一半低于额度**只报数不判红**:未勾登记行的丢失由守门 71(`check-plan-line-loss.mjs`)
 *        按行拦,锚点侧还有判据④逐条额度 + 总数拦(比数条目数更精确),同一条债不在两处各计一次
 *        (机主对 P5/P7 立过同一条);
 *  · 拆半档里任一环节取不到数 ⇒ **回落绝对式判红**:宁多拦一次,绝不静默放行(§0.3/§0.10)。
 * 额度数同源不新造:`gapFloor = entryCountBaseline − elementCountBaseline`,当次实测
 * `implemented.length === 40`、`103 − 40 = 63` 与之相符。
 */
export function checkBaseline(entryCount, baseline, corpusNote = '', parts = {}) {
  const mode = parts.mode === 'retirement-ledger' ? 'retirement-ledger' : 'face'
  const els = Array.isArray(parts.implemented) ? parts.implemented.length : null
  const gapCount = Number.isFinite(Number(parts.gapCount)) ? Number(parts.gapCount) : null
  const elementFloor = Number.isFinite(Number(parts.elementCountBaseline)) ? Number(parts.elementCountBaseline) : null
  const absolute = () =>
    entryCount < baseline
      ? [
          {
            kind: 'inventory-regression',
            id: '(inventory)',
            detail:
              `清单条目 ${entryCount} < 基线 ${baseline}${corpusNote} —— ` +
              `删任务行或删已实现元素必须同 PR 说明理由并调基线;基线不为变绿而下调,本判据的**阈值**不是本票的可调项`,
          },
        ]
      : []
  // 凭据链完整 ⇒ 原判据一字不动
  if (mode === 'face') return absolute()
  // 拆半档:取不到数一律回落绝对式(拿不到输入就多拦一次,绝不静默放行)
  if (els === null || gapCount === null || elementFloor === null) return absolute()
  const gapFloor = Math.max(0, baseline - elementFloor)
  const codeSide = entryCount - gapCount
  const out = []
  if (codeSide < elementFloor) {
    out.push({
      kind: 'inventory-regression',
      id: '(inventory)',
      detail:
        `代码侧条目 ${codeSide} < 额度 ${elementFloor}(= entryCount ${entryCount} − 台账派生 ${gapCount})${corpusNote} —— ` +
        `删已实现元素必须同 PR 说明理由并同笔调 elementCountBaseline;基线不为变绿而下调`,
    })
  }
  if (gapCount < gapFloor) {
    out.push({
      kind: 'inventory-shortfall-note',
      id: '(inventory-plan-derive)',
      detail:
        `台账派生编号 ${gapCount} < 额度 ${gapFloor} —— **存量,不判红**:归档件已整批退出审面` +
        `(机主 2026-10-16 令"完成即删,不留档"),完成后整行摘除是政策动作而非撤销,绝对式会变成对每一次提交都` +
        `成立的恒红门(§12e:与提交内容无关的红,唯一结局是逼人跳门、连带废掉全部守门)。未勾登记行的丢失由` +
        `守门 71 按行拦,代码侧由上面那条与判据④锚点额度拦;**归档件一回到面上本行自动失效**(mode 切回 face ` +
        `即沿用绝对式)。凭据:scripts/data/chat-flow-archive-ledger.json、tag backup/archive-removal-2026-10-16`,
    })
  }
  return out
}

export function runChecks({ data, planText, contractPy, contractTs, archives = [], archiveMissing = [] }) {
  const merged = mergeGapIds({ planText, archives, planSource: data.planSource })
  const gapIds = merged.gapIds
  const anchorRes = checkAnchors(data.implemented, ROOT, {
    commentOnlyBaseline: data.commentOnlyAnchorBaseline?.entries,
  })
  const persistenceRes = checkAnchorPersistence(data.implemented, data.anchorCountBaseline)
  const eventViolations = checkEvents(data.implemented, contractPy, contractTs)
  const entryCount = gapIds.size + data.implemented.length
  const baselineRes = checkBaseline(
    entryCount,
    data.entryCountBaseline,
    `(审面 = 台账 ${merged.fromPlan} 条 + 归档件补回 ${merged.archivedOnly.length} 条,` +
      `共读 ${archives.length} 份同面归档件)`,
    // 拆半取材:代码侧 = data.implemented 那份清单(只有显式编辑才会少),
    // 台账派生 = 本轮从 plan ⊕ 归档凭据现读出的 G-ID 数。两个数都来自同一份 data,不另造额度。
    {
      implemented: data.implemented,
      gapCount: gapIds.size,
      elementCountBaseline: Number.isFinite(Number(data.elementCountBaseline)) ? Number(data.elementCountBaseline) : null,
      // mode 只由**凭据形状**决定:归档件真在面上 = 'face'(绝对式);由退役 ledger 顶上 = 'retirement-ledger'
      mode: archives.length > 0 && archives.every((a) => a.ledger === true) ? 'retirement-ledger' : 'face',
    },
  )
  const baselineViolations = baselineRes.filter((v) => v.kind !== 'inventory-shortfall-note')
  const inventoryNotes = baselineRes.filter((v) => v.kind === 'inventory-shortfall-note')
  const anchorCount = (data.implemented ?? []).reduce((s, el) => s + (el.anchors ?? []).length, 0)
  return {
    inventoryNotes,
    plannedTasks: parsePlanned(planText, data.planSource.taskLinePattern, data.planSource.gapIdPattern).length,
    gapIds: gapIds.size,
    // 台账正文单独一条与"归档件补回"分开计:只有后者才是"搬走 ≠ 撤销"的证据,不得混成一桶
    planGapIds: merged.fromPlan,
    archivedOnlyGapIds: merged.archivedOnly,
    archiveFiles: archives.length,
    // 面上有名字而 blob 取不到 ⇒ 计数偏低 = "未判定",绝不能读成"通过"
    archiveMissing: [...archiveMissing],
    implemented: (data.implemented ?? []).length,
    anchorCount,
    entryCount,
    baseline: data.entryCountBaseline,
    // 存量与未判定一律**如实报数**,绝不静默成"看起来全绿"(只减不增,新增的注释态锚点直接进 violations)
    knownCommentOnly: anchorRes.notices.filter((n) => n.kind === 'anchor-commented-out-known').length,
    clearedCommentOnly: anchorRes.notices.filter((n) => n.kind === 'anchor-commented-out-cleared').length,
    anchorUndetermined: anchorRes.undetermined,
    stripNotices: anchorRes.notices.filter((n) => n.kind === 'anchor-strip-undetermined').map((n) => `${n.id}: ${n.detail}`),
    danglingBaseline: persistenceRes.danglingBaseline,
    violations: [
      ...anchorRes.violations,
      ...persistenceRes.violations,
      ...eventViolations,
      ...baselineViolations,
    ],
  }
}

function selfTest() {
  // 判据 pattern 只有一份真相:优先取数据文件里的,读不到才用等价内联值(并显式告警)
  let planSource
  try {
    planSource = loadJson(DATA_FILE).planSource
  } catch {
    console.warn('⚠️ self-test 读不到数据文件,回退内联 pattern(可能与实际判据漂移)')
    planSource = {
      taskLinePattern: '^- \\[([ x])\\]\\s*(?:✅[^*]*)?\\*\\*(D[0-9]+)',
      gapIdPattern: 'G-[0-9]{2,3}',
    }
  }
  const base = {
    planSource,
    entryCountBaseline: 1,
    anchorCountBaseline: { total: 1, perElement: { ok: 1, ev: 0 } },
    implemented: [{ id: 'ok', anchors: [{ file: 'package.json', mustMatch: '"name"' }], events: [] }],
  }
  const plan = '- [ ] **D90 示例元素(G-140)**:x\n- [x] ✅(2026-09-20)**D27 交付审查(G-29)**:y\n'
  const cases = [
    ['正常态', { ...base, implemented: [{ id: 'ok', anchors: [{ file: 'package.json' }] }] }, plan, 0],
    [
      '① 锚点文件不见',
      { ...base, implemented: [{ id: 'bad', anchors: [{ file: 'nope/nothere.tsx' }] }] },
      plan,
      1,
    ],
    [
      '① 锚点标识漂移',
      { ...base, implemented: [{ id: 'bad', anchors: [{ file: 'package.json', mustMatch: 'ZZZ_不存在' }] }] },
      plan,
      1,
    ],
    [
      '② 事件单端缺失',
      {
        ...base,
        implemented: [{ id: 'ev', anchors: [], events: ['brand_new_event'] }],
      },
      plan,
      1,
    ],
    ['③ 条目数倒退', { ...base, entryCountBaseline: 999 }, plan, 1],
    [
      '④a 锚点被整批删(条目内计数低于额度)',
      { ...base, implemented: [{ id: 'ok', anchors: [], events: [] }] },
      plan,
      1,
    ],
    [
      '④b 合法搬端:锚点从 A 文件搬到 B 文件(条目内计数不变)⇒ 必绿',
      { ...base, implemented: [{ id: 'ok', anchors: [{ file: 'pnpm-workspace.yaml', mustMatch: 'packages:' }], events: [] }] },
      plan,
      0,
    ],
    [
      '④c 台账缺 anchorCountBaseline(整文件回写指纹)',
      { ...base, anchorCountBaseline: undefined, implemented: [{ id: 'ok', anchors: [{ file: 'package.json' }] }] },
      plan,
      1,
    ],
    [
      '⑤a 注释式摘线(真语料:宿主只在 // 注释里留该词)⇒ 必红',
      {
        ...base,
        commentOnlyAnchorBaseline: { entries: [] },
        implemented: [
          { id: 'ok', anchors: [{ file: 'apps/web/src/components/ai/task-status-bar.tsx', mustMatch: 'describeToolActivity' }] },
        ],
      },
      plan,
      1,
    ],
    [
      '⑤b 同一处已登记为存量 ⇒ 只报数不判红(防恒红)',
      {
        ...base,
        commentOnlyAnchorBaseline: {
          entries: [
            {
              id: 'ok',
              file: 'apps/web/src/components/ai/task-status-bar.tsx',
              mustMatch: 'describeToolActivity',
              note: 'self-test 夹具',
            },
          ],
        },
        implemented: [
          { id: 'ok', anchors: [{ file: 'apps/web/src/components/ai/task-status-bar.tsx', mustMatch: 'describeToolActivity' }] },
        ],
      },
      plan,
      0,
    ],
  ]
  let bad = 0
  for (const [label, data, planText, expectedMin] of cases) {
    const res = runChecks({ data, planText, contractPy: '', contractTs: '' })
    const got = Math.min(res.violations.length, 1)
    const ok = got === Math.min(expectedMin, 1) && (expectedMin === 0 ? res.violations.length === 0 : true)
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${label} → ${res.violations.length} 违规(期望 ${expectedMin === 0 ? '0' : '≥1'})`)
  }
  // ── ③ 的审面(2026-09-28 立):台账 ⊕ 同面归档件。正反必须成对,否则判据没有牙 ──
  const archivedLine = '- [x] ✅(2026-09-27)**D77 搬走的元素(G-151)**:归档前原文\n'
  const planWithoutThatLine = '- [ ] **D90 示例元素(G-140)**:x\n'
  const corpusCases = [
    [
      '③a 台账行被搬进归档件(同字在归档面上)⇒ 不判红',
      planWithoutThatLine,
      [{ path: '.ihui-agent/archive/PROJECT_PLAN_2026-09-28.md', text: archivedLine }],
      false,
    ],
    [
      '③b 反向对照:台账与归档件两侧都没有 ⇒ 仍判红(不得把"看不见"写成"没有")',
      planWithoutThatLine,
      [{ path: '.ihui-agent/archive/PROJECT_PLAN_2026-09-28.md', text: '# 已归档(内容里不含该行)\n' }],
      true,
    ],
    [
      '③c 两侧各有一份同字 ⇒ 只计一条(去重,不得双计把额度刷出来)',
      plan + '\n' + archivedLine,
      [{ path: '.ihui-agent/archive/PROJECT_PLAN_2026-09-28.md', text: archivedLine }],
      false,
    ],
  ]
  for (const [label, planText, archives, expectRed] of corpusCases) {
    const data = { ...base, entryCountBaseline: 3 }
    const res = runChecks({ data, planText, contractPy: '', contractTs: '', archives })
    // 去重证明:同一批 G-ID 只在台账里出现一次 vs 台账与归档件各出现一次,gapIds 必须同值
    const ref = runChecks({ data, planText, contractPy: '', contractTs: '', archives: [] })
    const isRed = res.violations.some((v) => v.kind === 'inventory-regression')
    const dedupOk = label.startsWith('③c') ? res.gapIds === ref.gapIds : true
    const ok = isRed === expectRed && dedupOk && res.entryCount >= 3 === !expectRed
    if (!ok) bad++
    console.log(
      `${ok ? '✓' : '✗'} ${label} → 条目 ${res.entryCount}(基线 3)、archivedOnly ${res.archivedOnlyGapIds.length}、去重 ${dedupOk ? '同值' : '双计!'}`,
    )
  }
  // 归档面的面选择:磁盘面从来不是归档凭据(G-183),worktree 也只能落回头树
  for (const [f, want] of [['staged', 'staged'], ['head', 'head'], ['worktree', 'head']]) {
    const ok = archiveFaceFor(f) === want
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} 归档面 ${f} → ${want}(实得 ${archiveFaceFor(f)})`)
  }
  // ⑤b 的"只报数"必须真报出数(报不出来 = 存量清单形同隐形)
  const knownCase = runChecks({
    data: cases[9][1],
    planText: plan,
    contractPy: '',
    contractTs: '',
  })
  const knownCounted = knownCase.knownCommentOnly === 1 && knownCase.violations.length === 0
  if (!knownCounted) bad++
  console.log(
    `${knownCounted ? '✓' : '✗'} ⑤b 存量计数如实输出 → knownCommentOnly=${knownCase.knownCommentOnly}(期望 1)、违规 ${knownCase.violations.length}(期望 0)`,
  )
  // 事件双端齐备的正例:必须不报违规
  const evOk = runChecks({
    data: {
      ...base,
      anchorCountBaseline: { total: 0, perElement: {} },
      implemented: [{ id: 'ev', anchors: [], events: ['usage'] }],
    },
    planText: plan,
    contractPy: 'EVENTS = ["usage"]',
    contractTs: 'export const E = ["usage"]',
  })
  const evOkPass = evOk.violations.length === 0
  if (!evOkPass) bad++
  console.log(`${evOkPass ? '✓' : '✗'} ② 正例(双端都有)→ ${evOk.violations.length} 违规(期望 0)`)
  const parsed = runChecks({ data: base, planText: plan, contractPy: '', contractTs: '' })
  const parseOk = parsed.plannedTasks === 2 && parsed.gapIds === 2 && parsed.violations.length === 0
  if (!parseOk) bad++
  console.log(
    `${parseOk ? '✓' : '✗'} 解析判据:任务 ${parsed.plannedTasks}(期望 2)、G-ID ${parsed.gapIds}(期望 2)、违规 ${parsed.violations.length}(期望 0)`,
  )
  // 内容来源决策(2026-09-24 补):判仓库内容而非共享工作区快照,四个方向都要钉住
  const srcCases = [
    [{ staged: true, worktreeDirty: true }, 'index', '已暂存 → 判索引(这次提交会带走的内容)'],
    [{ staged: false, worktreeDirty: true }, 'head', '只有工作树脏 → 判 HEAD(别人未提交的缓冲区不算本仓状态)'],
    [{ staged: false, worktreeDirty: false }, 'disk', '干净文件 → 直读磁盘(与 index/HEAD 等价,免开进程)'],
    [{ staged: true, worktreeDirty: false }, 'index', '只暂存未再改 → 仍判索引'],
  ]
  for (const [inp, want, label] of srcCases) {
    const got = pickSource(inp)
    const ok = got === want
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} 内容来源 ${label} → ${got}(期望 ${want})`)
  }
  // 判据⑤ 的剥注释语义(成对正反例):本仓记过两次"状态机被串内 /* 骗进块注释态 ⇒ 假绿"
  const stripCases = [
    {
      label: '行注释被剥(含被注释掉的那行 import)',
      input: "const a = 1\n// import Q from 'q' // 摘线\nconst b = 2\n",
      ext: 'ts',
      trusted: true,
      kept: ['const a = 1', 'const b = 2'],
      gone: ["import Q from 'q'"],
    },
    {
      label: "串内 // 不得当注释起点(反向对照,防假红)",
      input: "const u = 'https://x.example/a' ;\nconst v = 2 // tail\n",
      ext: 'ts',
      trusted: true,
      kept: ["'https://x.example/a'", 'const v = 2'],
      gone: ['tail'],
    },
    {
      label: '串内 /* 不得进块注释态(防把后半个文件吞掉)',
      input: 'const u = "http://a/*b*/c" ;\nconst KEEP = 1\n',
      ext: 'ts',
      trusted: true,
      kept: ['"http://a/*b*/c"', 'const KEEP = 1'],
      gone: [],
    },
    {
      label: '多行块注释被剥且保留换行',
      input: 'a /* 块\n注释 */ b\nconst KEEP = 1\n',
      ext: 'ts',
      trusted: true,
      kept: ['a ', ' b', 'const KEEP = 1'],
      gone: ['块', '注释'],
    },
    { label: 'JSX {/* */} 被剥', input: 'const x = <T>{/* import Q */}1</T>\n', ext: 'tsx', trusted: true, kept: ['1'], gone: ['import Q'] },
    {
      label: '正则字面量里的 // 不当注释起点',
      input: 'const re = /https?:\\/\\//g ;\nconst KEEP = 1\n',
      ext: 'ts',
      trusted: true,
      kept: ['/https?:\\/\\//g', 'const KEEP = 1'],
      gone: [],
    },
    {
      label: '模板串内的伪注释符不剥',
      input: 'const s = `模板里 // 与 /* 都不算注释` ;\nconst KEEP = 1\n',
      ext: 'ts',
      trusted: true,
      kept: ['`模板里 // 与 /* 都不算注释`', 'const KEEP = 1'],
      gone: [],
    },
    { label: '非 Python 文件里的 # 不是注释', input: 'const s = a # b ;\n', ext: 'ts', trusted: true, kept: ['# b'], gone: [] },
    { label: 'Python # 注释被剥', input: '# 说明 import Q\nx = 1\n', ext: 'py', trusted: true, kept: ['x = 1'], gone: ['import Q', '说明'] },
    {
      label: 'Python 三引号 docstring 里的 # 不当注释',
      input: '"""\n# 不是注释 import Q\n"""\nx = 1\n',
      ext: 'py',
      trusted: true,
      kept: ['# 不是注释 import Q', 'x = 1'],
      gone: [],
    },
    {
      label: '未闭合块注释 ⇒ trusted:false(调用方回退原文,绝不假红)',
      input: 'const bad = 1 /* 块注释没关\nconst KEEP = 1\n',
      ext: 'ts',
      trusted: false,
      kept: [],
      gone: [],
    },
    {
      label: '正常代码里的标识必须留下(变异④的正向底座)',
      input: "import QueueBar from '../components/QueueBar'\n",
      ext: 'tsx',
      trusted: true,
      kept: ["import QueueBar from '../components/QueueBar'"],
      gone: [],
    },
  ]
  for (const c of stripCases) {
    const r = stripCodeComments(c.input, c.ext)
    const trustOk = r.trusted === c.trusted
    const keptOk = c.kept.every((s) => r.text.includes(s))
    const goneOk = c.gone.every((s) => !r.text.includes(s))
    const ok = trustOk && keptOk && goneOk
    if (!ok) bad++
    const why = ok ? '' : !trustOk ? `(trusted 期望 ${c.trusted} 实得 ${r.trusted})` : !keptOk ? '(该留的没留)' : '(该剥的没剥)'
    console.log(`${ok ? '✓' : '✗'} 剥注释 ${c.label}${why}`)
  }
  console.log(bad === 0 ? '✅ self-test 全过' : `❌ self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  if (process.env[SKIP_ENV] === '1') {
    console.warn(`⚠️  [chat-element-coverage] 已用 ${SKIP_ENV}=1 跳过(紧急通道,须在 PROJECT_PLAN.md 说明)`)
    return 0
  }
  const data = loadJson(DATA_FILE)
  // 面旗先判:两个面旗同给 = 自相矛盾(取哪一面都会让另一面成为假绿)⇒ 判死,不猜。
  const { face, error: faceError } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (faceError) {
    console.error(`❌ [chat-element-coverage] ${faceError} —— 无法判定(不冒红,也不记绿)`)
    return 2
  }
  if (face === 'worktree') {
    console.error('⚠️  [chat-element-coverage] --worktree 是**人工排查**逃生舱:锚点按磁盘判,提交链不得使用')
  }
  // 归档件与台账**同面同轮**取(见文件头"审面"段):面上列到 0 个候选 = 尺子失效,不是"没有归档";
  // blob 取不到 ⇒ 后面逐条点名并以"未判定"退出,绝不静默当"没有那份"。
  const corpus = readArchiveCorpus(face)
  if (corpus.error) {
    console.error(
      `❌ [chat-element-coverage] 归档面(${FACE_LABEL[corpus.face] ?? corpus.face})取材失败 ⇒ 无法判定:${corpus.error}`,
    )
    return 2
  }
  if (corpus.enumerated === 0) {
    console.error(
      `❌ [chat-element-coverage] 归档补偿维**两个来源都空**:${FACE_LABEL[corpus.face] ?? corpus.face}里 ` +
        `${ARCHIVE_REL}/ 下枚举到 0 份 PROJECT_PLAN_*.md,退役留痕 ledger(scripts/data/chat-flow-archive-ledger.json)` +
        `也不在这面上(source=${corpus.source})⇒ 审面不完整,无法判定(空枚举不是"通过";` +
        `清单来源被摘线/目录搬家/凭据被删正是本判据要防的那一型)`,
    )
    return 2
  }
  if (corpus.error) {
    console.error(`❌ [chat-element-coverage] 归档补偿维取材异常 ⇒ 无法判定:${corpus.error}`)
    return 2
  }
  if (corpus.source === 'retirement-ledger')
    console.log(
      `ℹ️ [chat-element-coverage] 归档件已随"完成即删"整体退出审面(机主 2026-10-16 令),本维改用入库退役 ledger:` +
        `${corpus.archives[0].gapIds} 枚编号,出处提交 ${(corpus.archives[0].sourceCommit || '?').slice(0, 12)}`,
    )
  // 计划文本与两份契约同样按**仓库内容**判(见 contentAt 注释):PROJECT_PLAN.md 是共享工作区里
  // 最容易被并发会话按旧基线整文件覆写的一份,按磁盘读会把"别人没提交的旧副本"当成本仓清单。
  const planText = contentAt('PROJECT_PLAN.md')
  if (!planText.trim()) {
    console.error(`❌ [chat-element-coverage] 被审面(${FACE_LABEL[face] ?? face})取不到 PROJECT_PLAN.md ⇒ 无法判定`)
    return 2
  }
  const relOpt = (p) => (p.startsWith(ROOT) ? p.slice(ROOT.length + 1).replaceAll('\\', '/') : null)
  const readOpt = (p) => {
    const rel = relOpt(resolve(p))
    return rel ? contentAt(rel) : existsSync(p) ? readFileSync(p, 'utf8') : ''
  }
  const res = runChecks({
    data,
    planText,
    contractPy: readOpt(CONTRACT_PY),
    contractTs: readOpt(CONTRACT_TS),
    archives: corpus.archives,
    archiveMissing: corpus.missing,
  })
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...res, violations: res.violations }, null, 2))
  }
  if (res.violations.length === 0) {
    console.log(
      `✅ [chat-element-coverage] 清单 ${res.entryCount} 条(G-ID ${res.gapIds} = 台账 ${res.planGapIds} + 归档件补回 ${res.archivedOnlyGapIds.length}、已实现锚点 ${res.implemented};审面归档件 ${res.archiveFiles} 份)、锚点 ${res.anchorCount} 条、planned 任务 ${res.plannedTasks} 行,锚点存续性/代码面/契约均一致`,
    )
  } else {
    console.error(
      `❌ [chat-element-coverage] ${res.violations.length} 处违规(清单 ${res.entryCount} 条 = 台账 ${res.planGapIds} + 归档件补回 ${res.archivedOnlyGapIds.length}、锚点 ${res.anchorCount} 条、审面归档件 ${res.archiveFiles} 份):`,
    )
    for (const v of res.violations) console.error(`  ${v.kind} :: ${v.id} :: ${v.detail}`)
  }
  // 射程说明:台账派生那一半低于额度是**政策存量**(完成即删),只报数不拦;
  // 报不出来才等于隐形 —— 静默的全绿与恒红门同样是本仓记过最多次的坑。
  for (const n of res.inventoryNotes ?? []) console.error(`  ⚠️ ${n.kind} :: ${n.id} :: ${n.detail}`)
  // 存量与未判定一律要喊出来:静默的"看起来全绿"与恒红门同样是本仓记过最多次的坑
  if (res.knownCommentOnly > 0) {
    console.error(
      `  ⚠️ 存量注释态锚点 ${res.knownCommentOnly} 处(已登记 commentOnlyAnchorBaseline,只报数不判红、只减不增):`,
    )
    for (const e of data.commentOnlyAnchorBaseline?.entries ?? []) {
      console.error(`     · ${e.id} :: ${e.file} :: ${e.mustMatch}`)
    }
    console.error('     清账方式:把 mustMatch 改指宿主**代码面**上的真实标识(不得反向删注释来消账)')
  }
  if (res.clearedCommentOnly > 0) {
    console.error(
      `  ⚠️ 存量清单有 ${res.clearedCommentOnly} 项本轮未命中:要么已被清偿(请同 PR 移除登记项),要么该行 id/file/mustMatch 登记错位(= 基线失效,会让另一处恒红)。两种都不计红,但都必须人工看一眼`,
    )
  }
  if (res.anchorUndetermined > 0) {
    console.error(`  ⚠️ ${res.anchorUndetermined} 处锚定文件剥注释不可信,已回退原文判(与改前等强,未放宽):`)
    for (const s of res.stripNotices) console.error(`     · ${s}`)
  }
  if (res.danglingBaseline.length > 0) {
    console.error(
      `  ⚠️ anchorCountBaseline.perElement 有 ${res.danglingBaseline.length} 个键在 implemented 里已无对应条目(元素被改名/删除的指纹,只提示):${res.danglingBaseline.join(', ')}`,
    )
  }
  // 归档件补回的那部分是**本票的全部理由**,必须被看见(否则没人能判断"变宽"来自哪里)。
  if (res.archivedOnlyGapIds.length > 0) {
    console.error(
      `  ℹ️ 审面里有 ${res.archivedOnlyGapIds.length} 条 G-ID **只在归档件里**(台账正文已无该行 = 完成即归档搬走,不是撤销):${res.archivedOnlyGapIds.slice(0, 12).join(' ')}${res.archivedOnlyGapIds.length > 12 ? ' …' : ''}`,
    )
  }
  if (res.archiveMissing.length > 0) {
    console.error(
      `  ⚠️ 未判定:${res.archiveMissing.length} 份归档件在审面上有名字而 blob 取不到(unmerged / 对象缺失)—— 计数因此**偏低**,本门拒绝出具"已通过"合格证(把"没判"写成"判过了"是本仓最高频失效型):`,
    )
    for (const p of res.archiveMissing) console.error(`     · ${p}`)
  }
  if (res.violations.length === 0 && res.archiveMissing.length > 0) return 2
  if (res.violations.length === 0) return 0
  console.error(
    `\n  💡 修复:渲染位被删/改名 → 恢复或同 PR 更新 scripts/data/chat-flow-elements.json 并说明理由;\n     事件单端缺 → 补 sse_contract.py 与 packages/shared/src/sse/contract.ts 两处;\n     条目/锚点倒退 → 恢复任务行或锚点,或说明为何撤销后同 PR 调基线;\n     注释式摘线(anchor-commented-out)→ 恢复宿主那行真代码,或把 mustMatch 改指代码面上的真实标识;\n     自检:node scripts/check-chat-element-coverage.mjs --self-test\n     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
  )
  return 1
}

export const __test__ = {
  parsePlanned,
  checkAnchors,
  checkEvents,
  checkBaseline,
  checkAnchorPersistence,
  stripCodeComments,
  runChecks,
  pickSource,
  contentAt,
  // 2026-09-28 审面:镜像测试**直接 import**这些,不得再抄一份判据(§22c)
  mergeGapIds,
  gapIdsOfText,
  archiveFaceFor,
  listArchiveFilesOnFace,
  readArchiveCorpus,
  ARCHIVE_FILE_RE,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
