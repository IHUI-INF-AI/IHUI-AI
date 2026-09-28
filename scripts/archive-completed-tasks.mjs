#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * PROJECT_PLAN.md 已完成任务条目自动归档脚本(2026-07-23 立)
 *
 * 功能:
 *   - 扫描 PROJECT_PLAN.md 中的已完成任务条目(§1 粒度 = ##/### 两级,标题含 ✅;
 *     兼容旧写法 `### [x] ✅(YYYY-MM-DD)`;识别实现与守门 13c 共用 scripts/lib/plan-task-headings.mjs)
 *   - 把完成日期 ≥ 阈值天数的条目移动到 .ihui-agent/archive/PROJECT_PLAN_YYYY-MM-DD_auto-archive.md
 *   - 原位置留 HTML 注释占位(符合 AGENTS.md §1 归档规则 + check-project-plan-archive.mjs 守门)
 *
 * 用法:
 *   node scripts/archive-completed-tasks.mjs              # 默认: 归档 ≥7 天前的已完成条目
 *   node scripts/archive-completed-tasks.mjs --days 3     # 归档 ≥3 天前的
 *   node scripts/archive-completed-tasks.mjs --all        # 归档所有已完成条目(不论日期)
 *   node scripts/archive-completed-tasks.mjs --allow-mass  # 人工放行大批量(自动档阀门见 main())
 *   node scripts/archive-completed-tasks.mjs --self-test   # 纯函数自检(零副作用、零派生 git)
 *
 * ── 底稿面与落盘形态(2026-09-28 立,根治"归档器把别人的翻勾退回未勾")────────────────
 * 事故形态(不是假设):本脚本此前**底稿取工作树磁盘副本、写回也写磁盘副本**。而
 * `PROJECT_PLAN.md` 是多会话共写的活文档,磁盘副本常年滞后 HEAD(AGENTS §12 为这一条立过铁律),
 * 于是一次自动归档 = 把一份滞后底稿整文件写进提交 ⇒ 别人**已入库**的 `[x]` 行被成批退回 `[ ]`。
 * 实测一枚这样的归档提交一次改动 4,249 行(+2040/−2364),其中至少 10 条 `[x]` 变成 `[ ]`
 * (G-206/G-207/D13/D62/D77/O82/P1/G-104/G-221/G-239…),并触发"归档器造 F1 分叉 → 门 71 回捞
 * 未勾形态 → 门 130 再红 → 再归并"的互咬(近 6h 内 6 枚"自愈被回写的任务状态副本" + 8 枚"自动回捞")。
 *
 * 三条改动(缺一不可,各自都有判据与端到端证明):
 *   ① **底稿 = 被审面**:归档集与占位所依据的正文一律经 `scripts/lib/face-reader.mjs` 的
 *      `catBatch(ROOT, ['HEAD:PROJECT_PLAN.md'])` 取(不自拼 `git show` —— 那是守门 118 判的
 *      "门脚本自己派生 git 读正文";取正文只有取材层这一条路)。
 *   ② **落盘 = 对象空间**:临时索引 + hash-object/update-index + write-tree + commit-tree +
 *      **CAS update-ref**(plumbing 唯一实现 `scripts/lib/bypass-git.mjs`;防覆盖判据 `clobberedPaths`
 *      来自常驻出口 `scripts/object-space-land.mjs`,动态 import —— 只在真要落提交时才付它 2s 的
 *      模块代价)。CAS 循环内每次重读 HEAD;**任一目标路径被别人改过即停并报原因**(不是抢锁)。
 *      全程不 `git add` 共享主索引、不 `git commit -- pathspec`(那两条都会把别人的在途内容打包)。
 *   ③ **绝不覆盖共享工作树**:提交后只按 `alignSharedIndex` 的判据逐路径对齐**索引**;磁盘副本
 *      只有在"盘上那份 == 父提交那份 ∧ 索引未被他人暂存"时才写(等价于一次最小手工编辑),
 *      否则**一字未动**并点名"工作树滞后 / 归属他人"。
 *
 * 核心判据 `zeroLossViolations()`(不是附加保险,是这道闸的牙):父提交面上每一条 `- [x]` 行,
 * 要么在产出面上**仍是 `- [x]`**,要么它所在条目按 §1 两步走被搬走 —— 豁免必须拿证据换:
 * 原位置留了占位 **且** 该行逐字进了本次归档正文。两条都不成立 ⇒ 拒绝落地并逐条打印原行。
 * 身份按**复合主键**(编号 + 标题前缀,`lib/plan-task-index.mjs` 的 `compositeKeyOf`,与 §1 F1 同一把
 * 尺子)算,给不出主键的行退回整行原文,两类身份**不混桶**(否则"换个写法"就绕过断言)。
 * 判据是**双向**的:少一条(退回未勾)与多一条(凭空把没做完的记成做过)同样拒落 —— 台账级说谎
 * 比账面分叉更响,AGENTS §1 明文禁止"把没做的记成做过的"。
 *
 * 面不可得时**不猜**:是 git 仓而 HEAD 里确有该文件却读不到正文(锁住/超时/损坏)⇒ 报"无法判定"
 * 并 exit 1,既不写盘也不落提交。只有"根本不是 git 仓 / HEAD 未诞生 / 该文件还没入库"才自动退回
 * 工作树档(= 本脚本 2026-09-28 之前的全部行为,此时不存在"别人已入库的行",写盘无 hazards)。
 *
 * 应急出口(三条都是现读代码得到的,不写跑不通的出路):
 *   - `HUSKY_SKIP_ARCHIVE=1` —— 本脚本**自己**在第 0 步就读它并 exit 0(2026-09-28 补:此前只有
 *     `.husky/post-commit:108` 读它,所以 AGENTS §1 那句"跳过用 HUSKY_SKIP_ARCHIVE=1"对**手动
 *     直跑与任何非钩子调用方**是空头支票;钩子那一道仍然有效,两处读的是同一个键)。
 *   - `IHUI_ARCHIVE_COMMIT=1` —— 归档提交自带的环境标记,防 post-commit 递归(钩子侧读)。
 *   - `IHUI_GIT_BIN=<git>` —— 换机逃生舱;同时让"写通道坏了"这条失败分支可被**执行**验证(镜像例)。
 *   - `--plan-face worktree` —— **人工取证专用**逃生舱:刻意用滞后的磁盘副本当底稿,用来证明
 *     `zeroLossViolations` 真的在拦(默认档永远走 HEAD,这条分支在正常路径上不可达)。
 *     它不改任何判据、不放宽任何断言,只是把"底稿取哪一面"交给人指定,并照常过零损失闸。
 *
 * 与守门 13c 的分工(2026-09-25 立,2026-09-26 起两边**共用一份提取实现**):
 *   13c 保护的是「##/### + 含(已完成 或 ✅)」的**全部**标题行(不许无声删除);
 *   本脚本只搬其中**含 ✅** 的子集 —— 搬运集必须是保护集的真子集,由
 *   lib 的构造保证(isArchivableTaskHeading 先过 isCompletedTaskHeading),不是注释约定。
 *   无 ✅ 的「### 已完成清单」一类小节标题因此永远不动。
 *   node scripts/archive-completed-tasks.mjs --dry-run    # 只打印不实际归档
 *   node scripts/archive-completed-tasks.mjs --auto-commit # 归档后自动 git add + commit(防递归: IHUI_ARCHIVE_COMMIT=1)
 *
 * 集成:
 *   - .husky/post-commit 钩子自动调用 --auto-commit 模式
 *   - 防递归: 归档 commit 设 IHUI_ARCHIVE_COMMIT=1, post-commit 检测到跳过
 *
 * 退出码:
 *   0 = 成功(无论是否归档;大批量阀门关闭自动档也是 0 —— "少做一件事"不是错误,不得把钩子链弄红)
 *   1 = 错误(读写失败 / 被审面读不到正文 / 零损失断言拒绝落地 / 写通道不可用 / 落地回读不符)
 *   2 = 脚本自身异常(main 抛出未捕获错误;与 §22d 的"业务失败 vs 脚本异常"退出码约定一致)
 */
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
// 底稿取的是**被审面**(HEAD blob),不是磁盘副本 —— 取正文只有取材层这一条路(守门 118 判的
// 正是"门脚本绕过这层自己派生 git 读内容");`readWorktreeFile` 只服务于"工作树档"那一支
// (非 git 夹具 / 显式 --plan-face worktree)与落地后的磁盘对齐前置比较。
import { catBatch, readWorktreeFile } from './lib/face-reader.mjs'
// 对象空间落地的 plumbing **只有一份**(scripts/lib/bypass-git.mjs,2026-09-27 收口)。
// 本脚本刻意不再手写第二份 read-tree/commit-tree/CAS —— 同一会话手写 6 份并漂开正是它入库的理由。
import {
  alignSharedIndex,
  casUpdateRef,
  commitTreeWithIndex,
  git as plumbingGit,
  headBlobOf,
  writeBlob,
  writeBlobOfWorktree,
} from './lib/bypass-git.mjs'
// "已完成行"的身份与判据一律走台账那一份实现(§1 的 F1 用同一把尺子),不在这里重抄复选框正则。
import { compositeKeyOf, parseTaskRows } from './lib/plan-task-index.mjs'
// 「什么算一个已完成条目标题」的**单一实现**(2026-09-26,与守门 13c 共用一份):
// 两边各写一遍标题正则正是本仓最高频失效型 —— 写法一漂,判据静默失明且失明表现为安静
// (HEAD 面 `^### .*✅` 0 命中 / `^## .*✅` 71 命中,归档器每次跑每次 0 条)。
// 搬运集 ⊂ 保护集由 lib 的构造保证(isArchivableTaskHeading 定义第一句即 isCompletedTaskHeading)。
import {
  parseCompletedTaskBlocks,
  entryHasOpenRows,
  isArchivableTaskHeading,
  extractCompletedTaskHeadings,
  countBulletCompleted,
} from './lib/plan-task-headings.mjs'

const ROOT = process.cwd()
const PLAN_FILE = join(ROOT, 'PROJECT_PLAN.md')
const ARCHIVE_DIR = join(ROOT, '.ihui-agent', 'archive')
/** 提交面上的相对路径(git 只认正斜杠;ROOT 是工作树根,两者只差前缀)。 */
const PLAN_REL = 'PROJECT_PLAN.md'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const allMode = args.includes('--all')
const autoCommit = args.includes('--auto-commit')
const selfTest = args.includes('--self-test')
const noBullets = args.includes('--no-bullets')
// 大批量(格式漂移/积压)时的显式人工放行口 —— 自动档(pre-commit 钩子)没有这个开关就走阀门
const allowMass = args.includes('--allow-mass')
const daysIdx = args.indexOf('--days')
const daysThreshold = daysIdx >= 0 && args[daysIdx + 1] ? parseInt(args[daysIdx + 1], 10) : 0

/**
 * 底稿面:`head`(默认,= 被审面)/ `worktree`(人工取证逃生舱,或"根本没有被审面可比"时的自动退化)。
 * 值必须是这两个之一 —— 未知值**报错退出**,不得静默掉进默认档(那会让"我明明指定了另一面"
 * 与"脚本压根没认这个开关"在账面上长得一模一样)。
 * @returns {{face:string|null, error:string|null}}
 */
export function resolveRequestedFace(argv) {
  const i = argv.indexOf('--plan-face')
  if (i < 0) return { face: null, error: null }
  const v = String(argv[i + 1] ?? '')
  if (v !== 'head' && v !== 'worktree') {
    return { face: null, error: `--plan-face 只接受 head|worktree,实得 ${JSON.stringify(v)}` }
  }
  return { face: v, error: null }
}
const requestedFace = resolveRequestedFace(args)

// git 二进制按 §5b 取候选,不依赖 PATH(钩子/服务账户环境下 PATH 可能没有 git)
const GIT_BIN = (() => {
  // IHUI_GIT_BIN 与守门 71 同名:既是换机逃生舱,也让**失败路径可被执行验证**
  // (指向一个必然失败的可执行文件就能真跑到回滚分支,不靠静态断言)
  if (process.env.IHUI_GIT_BIN) return process.env.IHUI_GIT_BIN
  for (const p of ['C:/Program Files/Git/bin/git.exe', 'git']) {
    try {
      execFileSync(p, ['--version'], { stdio: 'ignore', windowsHide: true, timeout: 15_000 })
      return p
    } catch {
      /* 试下一个候选;全落空时退回 'git' 由调用处报错,不静默跳过 */
    }
  }
  return 'git'
})()

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

function todayStr() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

function dateDiffDays(dateStr) {
  if (!dateStr) return Infinity // 无日期视为最新,不归档(除非 --all)
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date(todayStr() + 'T00:00:00')
  return Math.floor((now - target) / 86400000)
}

/**
 * 解析已完成任务条目 —— 实现已收进 scripts/lib/plan-task-headings.mjs 的
 * parseCompletedTaskBlocks(2026-09-26,单一事实源)。级别感知粒度 ##/###;
 * `### [x] ✅(日期)` 旧写法继续兼容;`### 已完成清单` 一类无 ✅ 小节不算条目、不搬。
 * (历史教训原样保留在 lib 头注:旧式 /^### \[x\]/ 对真实形态 0 命中,空转 11 天而 15 个
 *  镜像测试全绿 —— 因为夹具复刻的是实现的形状,不是世界的形状,§22c。)
 */

/**
 * 去除条目正文末尾的空行
 */
function trimTrailingEmpty(lines) {
  const result = [...lines]
  while (result.length > 1 && result[result.length - 1].trim() === '') {
    result.pop()
  }
  return result
}

function shouldArchive(task) {
  if (allMode) return true
  // **默认阈值 0 = 完成即归档**(2026-09-28 由 7 改,用户原话"2053 条应该全归档才对"):
  // 旧默认把"刚做完一周内"整段留在台账里,于是台账里 98% 的已完成行(实测 2008/2053)按规则
  // 一条都不动 —— 这不是节流,是把"归档"这个动作推迟到没人再看它的时候。
  // `--days N` 仍可回到"只搬满 N 天的"节奏(取证或降速时用)。
  if (!task.date) return daysThreshold <= 0 // 阈值为 0 时不需要年龄判据 ⇒ 无日期也搬;>0 时不猜生日
  return dateDiffDays(task.date) >= daysThreshold
}

const BULLET_DONE_RE = /^\s*[-*+] \[[xX]\]/
const BULLET_ANY_RE = /^\s*[-*+] \[[ xX]\]/

/**
 * 子弹级已完成登记的采集器(2026-09-28 立,响应用户"完成的内容不要再留在 PROJECT_PLAN 里")。
 *
 * 为什么必须有这一维:`parseCompletedTaskBlocks` 只认 ##/### 两级带 ✅ 的**条目标题**,
 * 而台账里绝大多数完成状态写在 bullet 级 `- [x]`(HEAD 面实测 2106 条)—— 旧实现对此
 * 明写"不搬也不护",于是计划文档只增不减(实测 4.9 MB)。这不是阀值调错,是**归档粒度**
 * 本来就漏掉了这一整个量纲。
 *
 * 三条不许漂的判据:
 *  ① **只搬整段都是已完成登记的最长连续块** —— 块内一旦出现任何 `- [ ]`(含缩进子行)
 *     就在那里断开。把别人正开着的账搬进归档,比不归档严重得多(派单口径会静默少行)。
 *  ② **逐行判资格,不按整块第一行判**(2026-09-28 改,由实测逼出):旧写法取"块内第一条能解析出
 *     的日期"当整块年龄 ⇒ 一条满阈值的老登记只要紧跟在一条新登记后面,就被整块带着留下。实测净后果:
 *     台账里"该搬而没搬"的还剩 8 条 / 7,923 B,而采集器报"达阈值 0 段" —— 报数与真值分叉。
 *     现在不可行的行(未达 `--days` 阈值 / 设了阈值却解析不到日期)同样**断开**成独立段,不被带走。
 *  ③ 产出的对象与条目级同形({startLine,endLine,bodyLines,titleText,date,level:'bullet'}),
 *     因此**复用**既有的结构等值自证、零损失闸与对象空间落地,不另写第二套 plumbing
 *     (同一会话手写 6 份并漂开,正是 object-space-land 入库的理由)。
 */
export function collectCompletedBullets(content, { skipRanges = [], lineEligible = null } = {}) {
  const lines = String(content ?? '').split('\n')
  const inSkip = (i) => skipRanges.some((r) => i >= r.startLine && i <= r.endLine)
  // 默认档:阈值 0 ⇒ 每条已完成行都资格独立,只看它自己解不解得出生日(解不到也搬,不必判龄)
  const eligible = lineEligible || ((l) => (daysThreshold <= 0 ? true : !!dateOf(l)))
  const out = []
  let i = 0
  while (i < lines.length) {
    if (inSkip(i) || !BULLET_DONE_RE.test(lines[i]) || !eligible(lines[i])) {
      i++
      continue
    }
    const start = i
    const body = []
    let j = i
    while (j < lines.length && !inSkip(j)) {
      const l = lines[j]
      if (BULLET_ANY_RE.test(l)) {
        if (/^\s*[-*+] \[ \]/.test(l)) break // 块内遇到未完成登记 ⇒ 当场断开
        if (!eligible(l)) break // 上一条登记不够格 ⇒ 它自己留下,不搭本段的车
        body.push(l)
        j++
        continue
      }
      // 续行 = 缩进正文(块内已有 ≥2 空格缩进的行才认),它属于上一条登记
      if (/^ {2,}\S/.test(l) && body.length > 0) {
        if (/^\s*[-*+] \[ \]/.test(l)) break
        body.push(l)
        j++
        continue
      }
      break
    }
    if (body.length > 0) {
      const dateMatch = body.find((l) => dateOf(l)) ?? ''
      out.push({
        startLine: start,
        endLine: j - 1,
        level: 'bullet',
        title: body[0],
        titleText: String(body[0])
          .replace(/^\s*[-*+] \[[xX]\]\s*/, '')
          .slice(0, 80),
        date: dateOf(dateMatch),
        bodyLines: body,
      })
    }
    i = Math.max(j, start + 1)
  }
  return out
}

/** 行内第一个 YYYY-MM-DD(与 lib 的取龄口径同源:解析不到返回 null,不猜)。 */
function dateOf(line) {
  const m = /(20\d{2}-\d{2}-\d{2})/.exec(String(line ?? ''))
  return m ? m[1] : null
}

/**
 * 体积预算下的**最旧优先贪心选段**(从主流程抽成纯函数,是为了让它能被自检证到两面:
 * 既能证明"每轮真搬得动",也能证明"最旧一条自身超预算时返回空集" —— 后者是拒绝路径,
 * 不是"搬一半"。旧实现是"全批或不动",积压一旦超阈值就永久卡死(2026-09-28 实测:
 * 3 条 / 592,001 B 每次自动档重算同一批再拒绝,归档机制对存量结构性失效而账面一路绿)。
 */
export function selectWithinBudget(candidates, { maxEntries, maxBytes, entryBytes }) {
  const totalBytes = candidates.reduce((s, t) => s + entryBytes(t), 0)
  if (candidates.length <= maxEntries && totalBytes <= maxBytes) {
    return { picked: candidates, totalBytes, deferredCount: 0, deferredBytes: 0 }
  }
  const byAge = [...candidates].sort((a, b) =>
    String(a.date || '9999-12-31') < String(b.date || '9999-12-31') ? -1 : 1,
  )
  const picked = []
  let acc = 0
  for (const t of byAge) {
    const b = entryBytes(t)
    if (picked.length === 0 && b > maxBytes) break // 单条即超预算 ⇒ 整批拒绝(不拆条目)
    if (picked.length >= maxEntries || acc + b > maxBytes) break
    picked.push(t)
    acc += b
  }
  return {
    picked,
    totalBytes,
    oldestBytes: byAge.length > 0 ? entryBytes(byAge[0]) : 0,
    deferredCount: byAge.length - picked.length,
    deferredBytes: totalBytes - acc,
  }
}



/**
 * 归档占位的标题形态。**与守门 13c 的反查同形** —— 两边各写一遍就是"一边写一边看不见"
 * (AGENTS §1「标题形态三处必须同形」)。归档器与 13c 都从 lib 的 `headingTitle` 取标题文本。
 */
function placeholderLine(today, titleText, archiveBaseName) {
  return `<!-- 已归档(${today}:${titleText.slice(0, 60)},完整内容在 .ihui-agent/archive/${archiveBaseName} -->`
}

// ─── 底稿面:被审面优先,取不到不猜 ───────────────────────────────────────
/**
 * 决定"这份计划文档的底稿取哪一面",输出三态之一:
 *   head      —— HEAD 面上确有该文件且正文取到(默认档,也是真实仓库里唯一的合法档)
 *   worktree —— 显式 `--plan-face worktree`,或"根本没有被审面可比"(非 git 仓 / HEAD 未诞生 /
 *               该文件尚未入库)。后者写盘不可能是"把别人已入库的行退回旧版",因为还没有入库行。
 *   none      —— 磁盘与被审面都取不到
 * **是 git 仓、HEAD 里确有该路径、却读不到正文(锁住 / 超时 / 对象损坏)⇒ { face:'undetermined' }** ——
 * 那一档绝不能退到磁盘:否则本票要根治的那一型会在最常见的故障形态下原地复活。
 */
export function resolvePlanBase({ root, requested }) {
  const headSpec = `HEAD:${PLAN_REL}`
  let repo = true
  let headCommit = null
  try {
    headCommit = plumbingGit(['rev-parse', '--verify', '--quiet', 'HEAD'], { root, allowFail: true })
  } catch {
    repo = false
  }
  if (!repo || headCommit === null) {
    const wt = readWorktreeFileOrNull(root)
    if (wt === null) return { face: 'none', text: null, why: '既不是可用的 git 仓,盘上也没有 PROJECT_PLAN.md' }
    return {
      face: 'worktree',
      auto: true,
      text: wt,
      parentText: null,
      why: '没有被审面可取(非 git 仓或 HEAD 尚未诞生)⇒ 退回工作树档:此支没有"别人已入库的行"可被写回',
    }
  }
  let headText = null
  let headAbsent = false
  try {
    const got = catBatch(root, [headSpec])
    headText = got.get(headSpec) ?? null
    if (headText === null) headAbsent = true
  } catch (e) {
    // 层抛 Undetermined = 仓在、面该有、就是读不到 ⇒ 无法判定(既不冒红也不记绿,更不偷偷改用盘)
    return { face: 'undetermined', text: null, why: `被审面取不到:${e.message}` }
  }
  if (headAbsent) {
    const wt = readWorktreeFileOrNull(root)
    if (wt === null) return { face: 'none', text: null, why: 'HEAD 与磁盘都没有 PROJECT_PLAN.md' }
    return {
      face: 'worktree',
      auto: true,
      text: wt,
      parentText: null,
      why: `${PLAN_REL} 尚未进入 HEAD ⇒ 无已入库形态可被回退,退回工作树档`,
    }
  }
  if (requested === 'worktree') {
    const wt = readWorktreeFileOrNull(root)
    if (wt === null) return { face: 'undetermined', text: null, why: '指定了 --plan-face worktree 而盘上没有该文件' }
    return {
      face: 'worktree',
      explicit: true,
      text: wt,
      parentText: headText,
      headSha: headCommit,
      why: '人工取证逃生舱:刻意以磁盘副本为底稿(默认档是 HEAD)。零损失闸仍按父提交面判,不因逃生舱而放宽',
    }
  }
  return { face: 'head', text: headText, parentText: headText, headSha: headCommit, why: '被审面 HEAD blob(默认档)' }
}

/** 磁盘面的"取不到即 null",不把编码/权限错误伪装成"该文件不存在"(取材层原样抛 ⇒ 这里接成 null 前先判存在)。 */
function readWorktreeFileOrNull(root) {
  try {
    return readWorktreeFile(root, PLAN_REL)
  } catch {
    return null
  }
}

/** 写通道自检:落任何东西之前,先用**本脚本解析出的 git 二进制**问一次 HEAD。 */
function writeChannelProbe(root) {
  try {
    const out = execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', root, 'rev-parse', '--verify', '--quiet', 'HEAD'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 8 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, sha: String(out ?? '').trim() }
  } catch (e) {
    return { ok: false, why: String(e?.stderr ?? e?.message ?? e).split(/\r?\n/)[0] }
  }
}

// ─── 零损失断言(本次修复的核心判据) ─────────────────────────────────────
/**
 * 一行"已完成任务行"的身份:复合主键优先(编号 + 标题前缀,与 §1 F1 同一把尺子),
 * 给不出主键的行退回整行原文。两类身份**分开装桶**(前缀 kind:)——
 * 让原文档去顶主键行的名额,等于"把行首编号换个写法"就能绕过断言。
 */
export function doneIdentityOf(rawLine) {
  const key = compositeKeyOf(rawLine)
  return key ? `key:${key}` : `raw:${String(rawLine).replace(/\s+$/, '')}`
}

/** 一份文本里所有 `- [x]/- [X]` 行的身份多重集(行判据走 parseTaskRows 那一份实现,不重抄正则)。 */
export function doneMultiset(text) {
  const out = new Map()
  for (const r of parseTaskRows(String(text ?? ''))) {
    if (r.state !== 'done') continue
    const id = doneIdentityOf(r.raw)
    const cur = out.get(id)
    if (cur) {
      cur.count += 1
      if (!cur.samples.includes(r.raw) && cur.samples.length < 3) cur.samples.push(r.raw)
    } else {
      out.set(id, { id, count: 1, samples: [r.raw] })
    }
  }
  return out
}

/**
 * 零损失断言:父提交面上每一条 `- [x]` 必须满足下面之一,否则就是"既没被归档又退回未勾"。
 *   A. 它不在任何被搬条目块里 ⇒ 产出面上同身份的行仍是 `- [x]`(计数不得少);
 *   B. 它在被搬块里,且该块的 §1 两步走证据齐备 ⇒ 原位置有占位(`placeholderPresent`)
 *      **且** 该块正文逐字进了本次归档文件(`bodyInArchive`)。豁免必须拿证据换,
 *      不能只凭"它在我算好的范围里"就放过 —— 归档文件没入库的豁免等于把内容扔进虚空。
 * 反向一并判:产出面/归档面里**多出来**的已完成行(父面上没有的身份与计数)同样违规,
 * 那是"把没做的记成做过"的形态(AGENTS §1 明文禁止),不是"更干净"。
 *
 * @returns {{violations:Array<{id:string,missing:number,samples:string[],why:string}>,
 *            kept:number, exempted:number, undetermined:number}}
 */
export function zeroLossViolations({ parentText, newText, movedRanges = [], blockEvidence = [] }) {
  if (typeof parentText !== 'string') {
    // 没有父提交面可比(非 git 夹具 / 文件尚未入库)⇒ 本判据**不适用**,如实报"未判定"而不是"通过"
    return { violations: [], kept: 0, exempted: 0, undetermined: 1 }
  }
  const inMoved = (line1) => movedRanges.some((r) => line1 >= r.startLine + 1 && line1 <= r.endLine + 1)
  const needKept = new Map()
  const needMoved = new Map()
  let kept = 0
  let exempted = 0
  const bump = (m, id, raw) => {
    const cur = m.get(id)
    if (cur) cur.count += 1
    else m.set(id, { id, count: 1, samples: [raw] })
  }
  for (const r of parseTaskRows(parentText)) {
    if (r.state !== 'done') continue
    const id = doneIdentityOf(r.raw)
    if (inMoved(r.line)) {
      needMoved.set(id, (needMoved.get(id) ?? 0) + 1)
      continue
    }
    kept += 1
    bump(needKept, id, r.raw)
  }
  const have = doneMultiset(newText)
  const violations = []
  // A:该活的必须还活着
  for (const [id, e] of needKept) {
    const got = have.get(id)?.count ?? 0
    if (got < e.count) {
      violations.push({
        id,
        missing: e.count - got,
        samples: e.samples,
        why: '父提交面上是 [x],产出面上不在了 ⇒ 疑似拿滞后底稿覆盖了别人已入库的翻勾',
      })
    }
  }
  // B:被搬走的每一条都要 §1 两步走的证据
  const movedExemptOk = blockEvidence.every((b) => b && b.placeholderPresent && b.bodyInArchive)
  if (needMoved.size > 0) {
    if (!movedExemptOk || blockEvidence.length === 0) {
      for (const [id, n] of needMoved) {
        violations.push({
          id,
          missing: n,
          samples: [(have.get(id)?.samples ?? [])[0] ?? id],
          why: '条目被搬走,但"原位置留占位 + 完整内容进归档文件"两条证据不齐 ⇒ 豁免不成立',
        })
      }
    } else {
      exempted = [...needMoved.values()].reduce((a, b) => a + b, 0)
    }
  }
  // 反向:产出面上冒出父面没有的已完成行 = 台账级说谎,同样拒落
  const parentTotal = new Map()
  for (const r of parseTaskRows(parentText)) {
    if (r.state !== 'done') continue
    const id = doneIdentityOf(r.raw)
    parentTotal.set(id, (parentTotal.get(id) ?? 0) + 1)
  }
  for (const [id, h] of have) {
    const p = parentTotal.get(id) ?? 0
    if (h.count > p) {
      violations.push({
        id,
        missing: h.count - p,
        samples: h.samples,
        why: '产出面上多出了父提交没有的 [x] 行 ⇒ "把没做的记成做过的",一律拒落',
      })
    }
  }
  return { violations, kept, exempted, undetermined: 0 }
}

/** 结构等值零损失判据的**原子**验证:产出面必须恰好等于"父面把被搬块逐块换成占位",别动一行。 */
export function derivedByConstructionOk({ parentText, newText, movedRanges, today, archiveBaseName }) {
  const lines = String(parentText).split('\n')
  const sorted = [...movedRanges].sort((a, b) => a.startLine - b.startLine)
  let cursor = 0
  const expect = []
  for (const r of sorted) {
    if (r.startLine < cursor) return false // 范围重叠 ⇒ 从后往前 splice 会互相踩行
    expect.push(...lines.slice(cursor, r.startLine))
    expect.push(placeholderLine(today, r.titleText ?? '', archiveBaseName))
    cursor = r.endLine + 1
  }
  expect.push(...lines.slice(cursor))
  return expect.join('\n') === newText
}

/** 把被搬条目换成占位,产出新正文与"被搬范围"清单(0 基行号,与 lib 的 startLine/endLine 同基)。 */
export function buildNewPlanText({ baseText, tasks, today, archiveBaseName }) {
  const lines = String(baseText).split('\n')
  const ranges = tasks.map((t) => ({ start: t.startLine, end: t.endLine, title: t.titleText }))
  for (let i = ranges.length - 1; i >= 0; i--) {
    const r = ranges[i]
    lines.splice(r.start, r.end - r.start + 1, placeholderLine(today, r.title, archiveBaseName))
  }
  return {
    newText: lines.join('\n'),
    movedRanges: ranges.map((r) => ({ startLine: r.start, endLine: r.end, titleText: r.title })),
  }
}

/** 构建本次要**追加**进归档文件的正文块(两条落地路径共用,不得各写一份)。同日重复运行只补一次 header。 */
function buildArchiveChunk(today, tasks) {
  const archiveFile = join(ARCHIVE_DIR, `PROJECT_PLAN_${today}_auto-archive.md`)
  const archiveHeader =
    `# PROJECT_PLAN 自动归档(${today})\n\n` +
    `> 本文件由 scripts/archive-completed-tasks.mjs 自动生成,归档自 PROJECT_PLAN.md 的已完成任务条目。\n\n---\n\n`
  let chunk = existsSync(archiveFile) ? '' : archiveHeader
  const bodies = []
  for (const task of tasks) {
    const body = trimTrailingEmpty(task.bodyLines).join('\n')
    bodies.push(body)
    chunk += body + '\n\n---\n\n'
  }
  return { archiveFile, chunk, bodies }
}

/** 一段块正文是否**逐行连续**地出现在目标文本里(§1 第二步"完整内容进归档文件"的证据判据)。 */
function blockLandsContiguously(haystackText, bodyText) {
  if (!bodyText) return false
  const hay = String(haystackText).split('\n')
  const needle = String(bodyText).split('\n')
  if (needle.length > hay.length) return false
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let ok = true
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

const MAX_CAS_ATTEMPTS = 12

/**
 * 被审面档(head / 显式 worktree 取证)的落地路径:内存算产出 → 结构等值自证 → 追加归档文件 →
 * **零损失闸** → 写通道自检 → 临时索引 + commit-tree + CAS → 提交面回读复核 → 索引与工作树按归属对齐。
 *
 * 它**从不**在落地前把计划文档写到磁盘上:磁盘副本可能既是滞后底稿又是别人在飞的现场。
 */
async function landThroughObjectSpace({ base, toArchive }) {
  const today = todayStr()
  const archiveBaseName = `PROJECT_PLAN_${today}_auto-archive.md`
  const archiveRel = `.ihui-agent/archive/${archiveBaseName}`
  const { newText, movedRanges } = buildNewPlanText({
    baseText: base.text,
    tasks: toArchive,
    today,
    archiveBaseName,
  })

  // ① 结构等值:产出面必须**恰好**等于"底稿面把被搬块逐块换成占位",别动一行。
  //    这是 plumbing 那三条判据里的第二条(结构等值,不是重复行计数)在本器上的形态。
  const derived = derivedByConstructionOk({
    parentText: base.text,
    newText,
    movedRanges,
    today,
    archiveBaseName,
  })
  if (!derived) {
    console.error(C.red + '❌ 产出面不等于"底稿 ⊕ 本次搬运"的结构等值 ⇒ 拒绝落地(搬运范围算错了)' + C.reset)
    process.exit(1)
  }

  // ② 归档块先在**内存里**算出来:判据没通过之前,本函数一个字节都不往磁盘上写。
  //    (把 appendFileSync 放在零损失闸之前 = 拒绝落地时还留一份没入库的归档件当"半截现场",
  //     那是把一次可复核的失败换成一份需要下一个人去猜的垃圾。)
  const { archiveFile, chunk, bodies } = buildArchiveChunk(today, toArchive)
  const existingArchive = existsSync(archiveFile) ? readWorktreeFile(ROOT, archiveRel) : null
  const archiveWouldBe = (existingArchive ?? '') + chunk
  const placeholderOf = (t) => placeholderLine(today, t.titleText, archiveBaseName)
  const blockEvidence = toArchive.map((t, i) => ({
    title: t.titleText,
    placeholderPresent: newText.split('\n').includes(placeholderOf(t)),
    bodyInArchive: blockLandsContiguously(archiveWouldBe, bodies[i]),
  }))

  // ③ 零损失闸(本票核心):父提交面上每一条 [x] 要么还活着,要么带着 §1 两步走证据被搬走。
  const zl = zeroLossViolations({
    parentText: base.parentText,
    newText,
    movedRanges,
    blockEvidence,
  })
  if (zl.violations.length > 0) {
    console.error(
      C.red +
        `❌ 零损失断言不通过:${zl.violations.length} 组已完成行既没被归档、又不在产出面上是 [x] ⇒ 拒绝落地` +
        C.reset,
    )
    for (const v of zl.violations) {
      console.error(`   [${v.why}] 身份 ${v.id} 缺 ${v.missing} 条:`)
      for (const s of v.samples) console.error(`     ${s}`)
    }
    console.error(
      C.yellow +
        '   底稿面是 ' +
        base.face +
        (base.explicit ? '(显式 --plan-face worktree)' : '') +
        ',父提交面上这些行是 [x]。计划文档**一字未动**、未落提交、归档文件也未创建。' +
        C.reset,
    )
    process.exit(1)
  }
  console.log(
    C.dim +
      `   零损失闸通过:父面保留 ${zl.kept} 条 [x] 逐条仍在产出面,${zl.exempted} 条随条目搬走且占位+归档正文齐备` +
      C.reset,
  )

  // ③b 现在才真写归档文件(追加语义 appendFileSync 保持不变),写完立刻复核落盘字节:
  //     "我以为要豁免"的证据必须真的在盘上,否则一次失败的追加就把豁免建立在虚空上。
  if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true })
  appendFileSync(archiveFile, chunk, 'utf8')
  const archiveAfter = readWorktreeFile(ROOT, archiveRel) ?? ''
  const notLanded = toArchive.filter((t, i) => !blockLandsContiguously(archiveAfter, bodies[i]))
  if (notLanded.length > 0) {
    console.error(
      C.red + `❌ 归档文件写完后复核不通过:${notLanded.length} 个条目块没有逐字落进归档件 ⇒ 不落提交` + C.reset,
    )
    for (const t of notLanded) console.error(`     ${t.titleText.slice(0, 80)}`)
    process.exit(1)
  }

  // ④ 写通道自检:用**本脚本**解析出的 git 二进制(IHUI_GIT_BIN 逃生舱)问一次 HEAD。
  //    问不到 ⇒ 不落、不动索引、不动盘。这一句同时保证"git 坏了"这条失败分支可被执行验证,
  //    而不是只有静态断言替它背书(本仓反复记过"从没跑过的失败分支 = 没写的错误处理")。
  const probe = writeChannelProbe(ROOT)
  if (!probe.ok) {
    console.error(C.red + '❌ 归档未被索引收下:写通道自检失败(git 不可用)——' + probe.why + C.reset)
    console.error(
      C.yellow + '   计划文档一字未动、未建提交;归档文件留在磁盘当证据。修好 git 通道后重跑即可。' + C.reset,
    )
    process.exit(1)
  }

  // ⑤ 对象空间提交。plumbing 只有一份(lib/bypass-git),防覆盖判据 clobberedPaths 也取自
  //    常驻出口 object-space-land —— 动态 import 是刻意的:它一跳 import 链实测 ≈2.2s,
  //    而 post-commit 每轮都要跑本脚本、绝大多数轮次压根没有可归档条目,不该让空转轮付这笔钱。
  const { clobberedPaths } = await import('./object-space-land.mjs')
  const paths = [PLAN_REL, archiveRel]
  const baseMap = new Map(paths.map((p) => [p, headBlobOf(base.headSha, p, { root: ROOT })]))
  const msg = `chore(auto): 归档 ${toArchive.length} 个已完成任务条目至 .ihui-agent/archive/`
  let planBlob = null
  let archiveBlob = null
  try {
    planBlob = writeBlob(newText, { root: ROOT })
    archiveBlob = writeBlobOfWorktree(archiveRel, { root: ROOT })
  } catch (e) {
    console.error(C.red + '❌ 归档未被索引收下:写 blob 失败 ——' + e.message + C.reset)
    process.exit(1)
  }
  let landed = ''
  let parentSha = ''
  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt++) {
    const head = plumbingGit(['rev-parse', 'HEAD'], { root: ROOT, allowFail: true })
    if (!head) {
      console.error(C.red + '❌ 放弃落地:HEAD 读不到(gitdir 被锁/损坏),不猜、不写' + C.reset)
      process.exit(1)
    }
    // CAS 循环内**每次重读 HEAD**;任一目标路径被别人改过即停并报原因(不是抢锁,是拒绝覆盖)
    const clobber = clobberedPaths(paths, baseMap, head, { root: ROOT })
    if (clobber.length > 0) {
      console.error(
        C.red +
          `❌ 放弃落地:HEAD 已推进且这些目标路径被别人改过 ⇒ 需重新归并而非覆盖(第 ${attempt} 次):` +
          '\n  ' +
          clobber.join('\n  ') +
          C.reset,
      )
      process.exit(1)
    }
    let made
    try {
      made = commitTreeWithIndex({
        root: ROOT,
        parent: head,
        // 防递归语义不变:归档提交带 IHUI_ARCHIVE_COMMIT=1,post-commit 检测到即跳过(钩子侧读)。
        // 对象空间提交不跑钩子,这一句是"哪条路径都可能触发钩子链"的兜底声明。
        message: msg,
        entries: [
          { path: PLAN_REL, blob: planBlob },
          { path: archiveRel, blob: archiveBlob },
        ],
        baseRef: head,
      })
    } catch (e) {
      console.error(C.red + '❌ 归档未被索引收下:临时索引/commit-tree 失败 ——' + e.message + C.reset)
      process.exit(1)
    }
    try {
      if (casUpdateRef(made.commit, head, { root: ROOT })) {
        landed = made.commit
        parentSha = head
        console.log(C.green + `✅ 第 ${attempt} 次 CAS 成功 HEAD=${landed.slice(0, 9)}(父 ${head.slice(0, 9)})` + C.reset)
        break
      }
    } catch (e) {
      console.error(C.red + '❌ 归档未被索引收下:ref 更新抛错 ——' + e.message + C.reset)
      process.exit(1)
    }
    console.log(
      C.yellow +
        `⚠️ 第 ${attempt} 次 CAS 失败(别人先推进了 HEAD),重读重试;` +
        `本次弃用的提交 ${made.commit.slice(0, 9)} 成为不可达对象(守门 30a 只取 unreachable commit 行,` +
        '需要留档时按 §22 打 lost-commit/* tag)' +
        C.reset,
    )
  }
  if (!landed) {
    console.error(C.red + `❌ ${MAX_CAS_ATTEMPTS} 次都没抢到 CAS,HEAD 与主索引均未动` + C.reset)
    process.exit(1)
  }

  // ⑥ 提交面回读:声明的两条路径必须真在树上,且**落地后的这一面**再过一次零损失闸。
  const inCommit = new Set(
    plumbingGit(['show', '--name-only', '--format=', landed], { root: ROOT, allowFail: true })
      ?.split('\n')
      .map((s) => s.trim())
      .filter(Boolean) ?? [],
  )
  const notProven = paths.filter((p) => !inCommit.has(p))
  if (notProven.length > 0) {
    console.error(C.red + '❌ 归档未被索引收下:提交面回读缺路径 ——' + notProven.join(', ') + C.reset)
    process.exit(1)
  }
  const landedText = catBatch(ROOT, [`${landed}:${PLAN_REL}`]).get(`${landed}:${PLAN_REL}`) ?? null
  if (landedText === null) {
    console.error(C.red + '❌ 落地后的这一面取不到正文 ⇒ 未判定,不当作成功' + C.reset)
    process.exit(1)
  }
  const zl2 = zeroLossViolations({
    parentText: base.parentText,
    newText: landedText,
    movedRanges,
    blockEvidence,
  })
  if (zl2.violations.length > 0) {
    console.error(C.red + `❌ 提交面复核:${zl2.violations.length} 组已完成行不在了 ——` + C.reset)
    for (const v of zl2.violations) console.error(`     ${v.id} 缺 ${v.missing} 条:${v.samples[0] ?? ''}`)
    process.exit(1)
  }
  console.log(`${C.green}✅ 已归档 ${toArchive.length} 个条目${C.reset}`)
  console.log(`${C.dim}   归档文件: ${archiveRel}${C.reset}`)
  console.log(`${C.dim}   PROJECT_PLAN.md 原位置已留归档占位注释${C.reset}`)
  console.log(`${C.green}✅ 归档 commit 已创建(对象空间:IHUI_ARCHIVE_COMMIT=1 防递归语义不变)${C.reset}`)

  // ⑦ 共享主索引按归属对齐(判据只有一份:alignSharedIndex),然后才谈工作树。
  const align = alignSharedIndex({ root: ROOT, paths, parentRef: parentSha })
  if (align.lockAbandoned) {
    console.error(C.red + '❌ .git/index.lock 锁龄超上限:不代删别人的锁,请人工确认后单跑索引对齐' + C.reset)
    process.exit(1)
  }
  if (align.failed) {
    console.error(C.red + `❌ 索引对齐未完成:${align.error ?? '轮次耗尽'}` + C.reset)
    process.exit(1)
  }
  for (const s of align.skipped) {
    console.log(C.yellow + `   未动(归属他人):${s.path} —— ${s.reason}` + C.reset)
  }
  for (const u of align.undetermined) {
    console.log(C.yellow + `   未判定:${u.path} —— ${u.reason}` + C.reset)
  }
  const planOwnedByOther = align.skipped.some((s) => s.path === PLAN_REL)
  const wtText = readWorktreeFileOrNull(ROOT)
  if (planOwnedByOther) {
    console.log(
      C.yellow + `⚠️ ${PLAN_REL} 已被他人暂存 ⇒ 磁盘副本一字未动(本脚本不替你把它交回任何一版)` + C.reset,
    )
  } else if (wtText === null) {
    console.log(C.yellow + `⚠️ 磁盘上没有 ${PLAN_REL} ⇒ 不代写文件(找回它属工作区自愈那一层)` + C.reset)
  } else if (base.explicit) {
    // 显式逃生舱的磁盘**就是**底稿,拿它跟自己对齐是恒真式 ⇒ 一律不写盘(取证动作不改共享现场)
    console.log(C.yellow + '⚠️ 取证档(--plan-face worktree)⇒ 磁盘副本一字未动' + C.reset)
  } else if (wtText === base.text) {
    writeFileSync(PLAN_FILE, newText, 'utf8')
    console.log(
      C.dim + `   工作树副本此前与父提交逐字相同 ⇒ 已随提交对齐(等价一次最小手工编辑,不覆盖任何人)` + C.reset,
    )
  } else {
    console.log(
      C.yellow +
        `⚠️ 工作树滞后 / 归属他人:磁盘副本与父提交那份不相同 ⇒ **一字未动**并点名(本票立的正是这一条)` +
        C.reset,
    )
    console.log(C.dim + `   下一次谁按磁盘提交都只会交出他自己那份;归档结果已在 HEAD(${landed.slice(0, 9)})` + C.reset)
  }
}



async function main() {
  // 应急通道**在本脚本里真被读取**(2026-09-28 补):此前只有 .husky/post-commit:108 读它,
  // 于是 AGENTS §1 那句"跳过用 HUSKY_SKIP_ARCHIVE=1"对手动直跑与任何非钩子调用方是空头支票。
  if (process.env.HUSKY_SKIP_ARCHIVE === '1') {
    console.log(`${C.dim}⏭  HUSKY_SKIP_ARCHIVE=1 ⇒ 跳过归档(钩子内外同一把开关,不再只靠钩子侧兜)${C.reset}`)
    process.exit(0)
  }
  if (requestedFace.error) {
    console.error(C.red + `❌ ${requestedFace.error}` + C.reset)
    process.exit(1)
  }
  if (!existsSync(PLAN_FILE)) {
    console.log(`${C.dim}⏭  PROJECT_PLAN.md 不存在,跳过归档${C.reset}`)
    process.exit(0)
  }

  // 底稿**取被审面(HEAD)**,不取磁盘副本(2026-09-28 立,理由见文件头"底稿面与落盘形态")。
  const base = resolvePlanBase({ root: ROOT, requested: requestedFace.face })
  if (base.face === 'undetermined') {
    console.error(C.red + `❌ 无法判定:底稿取不到 ⇒ 既不写盘也不落提交(绝不偷偷退回磁盘副本)——${base.why}` + C.reset)
    process.exit(1)
  }
  if (base.face === 'none') {
    console.log(`${C.dim}⏭  PROJECT_PLAN.md 不存在(或被取材层判为非文本),跳过归档 —— ${base.why}${C.reset}`)
    process.exit(0)
  }
  console.log(
    C.dim +
      `   底稿面:${base.face}${base.headSha ? `(${String(base.headSha).slice(0, 9)})` : ''}` +
      `${base.auto ? ' — 自动退化' : ''}${base.explicit ? ' — 显式逃生舱(取证专用)' : ''}:${base.why}` +
      C.reset,
  )
  const content = base.text
  if (content === null || content === '') {
    console.log(`${C.dim}⏭  PROJECT_PLAN.md 读取失败或为空文件,跳过归档${C.reset}`)
    process.exit(0)
  }
  const tasks = parseCompletedTaskBlocks(content)
  // 「标题带 ✅ 但体内还裹着未完成登记」的**假条目**一律不搬(2026-09-28 实测 HEAD 面:
  // 一条 `## P1 侧边栏底部 5 工具按钮…立并完成 ✅` 之后再无同级标题 ⇒ 块一路吞到文件末尾 =
  // 771 行 / 575,577 B,块内 `- [ ]` 237 条)。搬走它等于把别人正开着的 237 件活账归档,
  // 派单口径静默少 237 行 —— 那比"积压没清"严重得多。
  // 本判据与体积阀**正交**:`--allow-mass` 只放宽"一次搬多少字节",不放宽"这一条能不能搬"。
  const candidates = tasks.filter(shouldArchive)
  const blocked = candidates.filter((t) => entryHasOpenRows(t.bodyLines))
  let toArchive = candidates.filter((t) => !entryHasOpenRows(t.bodyLines))
  if (blocked.length > 0) {
    console.log(
      C.yellow +
        `⛔ 有 ${blocked.length} 个"条目标题写着已完成、体内仍有未勾选登记"的块**不参与归档**:` +
        C.reset,
    )
    for (const t of blocked) {
      const openN = t.bodyLines.filter((l) => /^[-*+] \[ \]/.test(l)).length
      console.log(
        C.yellow +
          `   L${t.startLine + 1}(lvl=${t.level})体内未勾选 ${openN} 条 / 整块 ${Buffer.byteLength(t.bodyLines.join('\n'), 'utf8')} B —— ${String(t.titleText).slice(0, 60)}` +
          C.reset,
      )
    }
    console.log(
      C.dim +
        '   出路是把该节的已完成条目升到独立 ##/### 标题下,或就地删掉标题里的"已完成"标记 —— 归档器不替你判哪些行是活账。' +
        C.reset,
    )
  }
  // 如实报数(禁止把"看不见"洗成"确信没有"):保护集比搬运集宽的部分、以及完全在归档粒度
  // 之外的 bullet 级 `- [x]`,都必须出现在输出里。
  const protectedCount = extractCompletedTaskHeadings(content).length
  const bulletCount = countBulletCompleted(content)
  const granularityNote =
    `(保护集 ${protectedCount} 条含"已完成"无"✅"者只护不搬;` +
    `另有 ${bulletCount} 处已完成状态写在 bullet 级 - [x],` +
    `${noBullets ? '本次 --no-bullets ⇒ 不纳入(默认档是纳入的)' : '已纳入归档粒度(2026-09-28 立)'})`

  // ── 子弹级纳入(2026-09-28,响应用户"完成的内容不要再记在 PROJECT_PLAN 里")──
  // 采集范围与本轮条目级搬运结果**互斥**(skipRanges),否则同一行被 splice 两次。
  if (!noBullets) {
    const bulletSkip = toArchive.map((t) => ({ startLine: t.startLine, endLine: t.endLine }))
    // 逐行判资格(不是逐块):满阈值的老行紧跟在新行后面时,旧写法会整段带着它留下。
    const bulletAll = collectCompletedBullets(content, {
      skipRanges: bulletSkip,
      lineEligible: (l) => shouldArchive({ date: dateOf(l) }),
    })
    const bulletOk = bulletAll.filter(shouldArchive)
    if (bulletAll.length > 0) {
      console.log(
        C.dim +
          `   子弹级采集:面上达阈值的段 ${bulletOk.length} 段(逐行判龄,不按整块首行 —— 混合段会各自断开)` +
          C.reset,
      )
    }
    toArchive = [...toArchive, ...bulletOk].sort((a, b) => a.startLine - b.startLine)
  }

  if (toArchive.length === 0) {
    console.log(
      `${C.dim}⏭  无可归档的已完成任务条目${C.reset} ` +
        `${C.dim}(共 ${tasks.length} 个已完成,阈值 ${allMode ? 'all' : '≥' + daysThreshold + ' 天'})${C.reset}\n` +
        `${C.dim}   ${granularityNote}${C.reset}`,
    )
    process.exit(0)
  }

  console.log(
    `${C.cyan}📦 发现 ${toArchive.length} 个可归档的已完成任务条目${C.reset}` +
      `${C.dim}(共 ${tasks.length} 个已完成,阈值 ${allMode ? '--all' : '≥' + daysThreshold + ' 天'})${C.reset}` +
      `\n${C.dim}   ${granularityNote}${C.reset}`,
  )
  toArchive.forEach((t) => {
    console.log(`${C.dim}  - ${t.titleText.slice(0, 70)}${C.reset}`)
  })

  if (dryRun) {
    console.log(`${C.yellow}⚠️  --dry-run 模式,未实际归档${C.reset}`)
    process.exit(0)
  }

  // 大批量阀门 —— 只在**自动档**(post-commit 钩子带 --auto-commit)生效,人工跑不受限。
  // 依据(2026-09-25 实测):修好匹配式后,正常稳态一次是 7 条 / 14.8 KB / 全文的 0.61%;
  //   超过 25 条或 256 KB 就意味着"格式又漂了一次"或"积压被一次性放开",那种量级的活文档重写
  //   必须是人做的决定(共享工作区里并发会话正拿着这份文件,§12)⇒ 绝不静默搬走半个计划文档。
  //   (参照 §5c 水印门"单次缺口 > 200 个拒绝自动回写"的同一条设计。)
  // **但"全批或不动"是错的默认**(2026-09-28 实测):积压 3 条 / 592,001 B 就永久超阈值,
  //   每次自动档重算同一批再拒绝 ⇒ 阀把"少做一件事"变成了"永远不做这件事",归档机制对这批
  //   存量结构性失效而账面一路绿。现改为按**最旧优先贪心取前缀**:单批仍在预算内,但每轮真搬得动。
  //   只有"最旧那一条自身就超预算"才回到拒绝路径 —— 那才是真正需要人工裁的量级。
  const MASS_MAX_ENTRIES = 25
  const MASS_MAX_BYTES = 256 * 1024
  const entryBytes = (t) => Buffer.byteLength((t.bodyLines || []).join('\n'), 'utf8')
  if (autoCommit && !allowMass) {
    const sel = selectWithinBudget(toArchive, {
      maxEntries: MASS_MAX_ENTRIES,
      maxBytes: MASS_MAX_BYTES,
      entryBytes,
    })
    if (sel.picked.length === 0 && toArchive.length > 0) {
      console.log(
        C.yellow +
          '⚠  大批量归档阀门关闭中(自动档):' +
          toArchive.length +
          ' 条 / ' +
          sel.totalBytes +
          ' B,且最旧一条自身 ' +
          sel.oldestBytes +
          ' B 已超单批预算 ' +
          MASS_MAX_BYTES +
          ' B(预算 ' +
          MASS_MAX_ENTRIES +
          ' 条或 ' +
          MASS_MAX_BYTES +
          ' B)' +
          C.reset,
      )
      console.log(
        C.dim +
          '   单条即超预算 ⇒ 不拆条目搬(拆了就不是"完整任务条目"了),需人工放行:' +
          ' node scripts/archive-completed-tasks.mjs --allow-mass' +
          C.reset,
      )
      // 退出码 0:这是"自动档少做一件事",不是错误 —— 绝不得让钩子链因此红
      process.exit(0)
    }
    if (sel.deferredCount > 0) {
      toArchive = sel.picked
      console.log(
        C.dim +
          `   体积预算内取最旧前缀:本次搬 ${sel.picked.length} 段 / ${sel.totalBytes - sel.deferredBytes} B,` +
          `余 ${sel.deferredCount} 段 / ${sel.deferredBytes} B 下一轮继续(每轮都在搬,不再永久卡死)` +
          C.reset,
      )
    }
  }

  // ── 分支:底稿来自被审面 ⇒ 对象空间落地(绝不把 HEAD 派生的正文写进可能滞后的磁盘副本) ──
  // 显式 `--plan-face worktree` 也走这一支 —— 它是"拿滞后磁盘当底稿"的取证场景,正好用来
  // 证明零损失闸真的在拦(默认档下那条分支结构上不可达)。
  if (base.face === 'head' || base.explicit) {
    if (!autoCommit) {
      console.log(
        C.yellow +
          '⚠️ 底稿是被审面 ⇒ 本脚本不会只改磁盘副本(那等于把一份 HEAD 派生的正文塞进可能滞后的' +
          '工作树,下一次按磁盘提交就退回旧版)。' +
          C.reset,
      )
      console.log(
        C.dim +
          `   ${toArchive.length} 个条目待归档,出路二选一:预览用 --dry-run;真落用 --auto-commit(对象空间 + CAS + 零损失闸)。` +
          C.reset,
      )
      process.exit(0)
    }
    await landThroughObjectSpace({ base, toArchive })
    return
  }

  // ── 工作树档(仅在"没有被审面可比"时自动进入):下面整段是 2026-09-28 之前的原实现,行为一字未动 ──
  // 确保归档目录存在
  if (!existsSync(ARCHIVE_DIR)) {
    mkdirSync(ARCHIVE_DIR, { recursive: true })
  }

  const today = todayStr()
  const archiveBaseName = `PROJECT_PLAN_${today}_auto-archive.md`
  const archiveFile = join(ARCHIVE_DIR, archiveBaseName)

  // 构建归档文件内容(追加模式)—— 与对象空间档共用 buildArchiveChunk 那一份
  const { chunk: archiveContent, bodies: archivedBodies } = buildArchiveChunk(today, toArchive)

  // 追加到归档文件
  appendFileSync(archiveFile, archiveContent, 'utf8')

  // 构建 PROJECT_PLAN.md 新内容:用占位注释替换每个已归档条目(同一份 buildNewPlanText)
  const { newText: newContent } = buildNewPlanText({
    baseText: content,
    tasks: toArchive,
    today,
    archiveBaseName,
  })
  // 零损失闸在没有父提交面时不适用(上面已如实打印"退回工作树档"的理由);但结构性搬运
  // 仍要自证"搬走的内容真在归档文件里",否则就是"内容进了虚空"。
  const archiveAfter = readWorktreeFile(ROOT, `.ihui-agent/archive/${archiveBaseName}`) ?? archiveContent
  const lost = toArchive.filter(
    (t, i) =>
      !blockLandsContiguously(archiveAfter, archivedBodies[i]) ||
      !newContent.split('\n').includes(placeholderLine(today, t.titleText, archiveBaseName)),
  )
  if (lost.length > 0) {
    console.error(C.red + `❌ §1 两步走的证据不齐(${lost.length} 条):拒绝改写计划文档` + C.reset)
    for (const t of lost) console.error(`     ${t.titleText.slice(0, 80)}`)
    process.exit(1)
  }

  writeFileSync(PLAN_FILE, newContent, 'utf8')

  console.log(`${C.green}✅ 已归档 ${toArchive.length} 个条目${C.reset}`)
  console.log(
    `${C.dim}   归档文件: .ihui-agent/archive/PROJECT_PLAN_${today}_auto-archive.md${C.reset}`,
  )
  console.log(`${C.dim}   PROJECT_PLAN.md 原位置已留归档占位注释${C.reset}`)

  // 自动 commit 模式
  if (autoCommit) {
    try {
      // ⚠ 两条都必须**带 pathspec**,且不经 shell(2026-09-25 修,理由写在下面)。
      // 旧写法第二步是 `execSync('git commit --no-verify -m "…"')` —— **不带路径**,等于"把当下索引里
      // 的东西全提交"。共享索引里常年挂着并发会话 staged 的内容(本次改写时就实测撞上 6 个别人
      // staged 的文件删除),那这一枚"归档 commit"会把**别人的在途改动一起打包带走** —— 正是 §12
      // 反复记的那一型污染,而且它跑在 post-commit 里、没有人盯着看。
      // 为什么这个洞今天才暴露:归档器自 2026-09-14 起匹配式与文件真实形态漂开、每次扫到 0 条,
      // 这段代码从没真跑过。**修好匹配式的同一条提交里必须一起修它**,否则"让它能用"就等于"引爆它"。
      const planRel = 'PROJECT_PLAN.md'
      const archiveRel = `.ihui-agent/archive/PROJECT_PLAN_${today}_auto-archive.md`
      const gitQ = ['-c', 'safe.directory=*'] // §5b:不得依赖环境
      // `-f` + 事务性核验 —— 2026-09-25 实测:归档器**第一次真跑**就死在这里。归档目录被
      // .gitignore 的 `.ihui-agent/` 整目录忽略 ⇒ `git add` 拒绝该路径 ⇒ 自动 commit 失败 ⇒
      // 计划文档的改写以"已 staged 未提交"挂在**共享索引**里(别人一次不带 pathspec 的提交就把它
      // 带走),而那 15KB 归档内容**只存在于本机**。同批把 .gitignore 改成 `.ihui-agent/*` +
      // `!.ihui-agent/archive/` 让锚点默认可入库;`-f` 是防"将来又被人加回忽略"的兜底。
      let stagedOk = false
      try {
        execFileSync(GIT_BIN, [...gitQ, 'add', '-f', '--', planRel, archiveRel], {
          cwd: ROOT,
          stdio: 'pipe',
          windowsHide: true,
          timeout: 120_000,
        })
        const staged = new Set(
          execFileSync(
            GIT_BIN,
            [...gitQ, 'diff', '--cached', '--name-only', '--', planRel, archiveRel],
            {
              cwd: ROOT,
              encoding: 'utf8',
              windowsHide: true,
              timeout: 120_000,
            },
          )
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        )
        stagedOk = staged.has(planRel) && staged.has(archiveRel)
        if (!stagedOk) {
          console.error(
            C.red +
              '❌ 归档未被索引收下(暂存集=' +
              JSON.stringify([...staged]) +
              ')—— 通常是 .gitignore 又把 .ihui-agent/archive/ 忽略了' +
              C.reset,
          )
        }
      } catch (e) {
        console.error(C.red + '❌ git add -f 失败:' + e.message + C.reset)
      }
      if (!stagedOk) {
        // 还原:**绝不留"内容已从计划里搬走、但没有任何版本记住它"的中间态**。
        // 先按 §12d 的形态逐路径撤销暂存,再把工作树写回搬运前的原文(内存里那份 content)。
        try {
          execFileSync(GIT_BIN, [...gitQ, 'restore', '--staged', '--', planRel, archiveRel], {
            cwd: ROOT,
            stdio: 'pipe',
            windowsHide: true,
            timeout: 120_000,
          })
        } catch {
          /* 撤销失败也要继续还原工作树,不在此处再抛 */
        }
        writeFileSync(PLAN_FILE, content, 'utf8')
        console.error(
          C.yellow +
            '   已回滚:计划文档还原到搬运前,归档文件留在磁盘当证据。修好忽略规则/索引后重跑即可。' +
            C.reset,
        )
        process.exit(1)
      }
      const msg = `chore(auto): 归档 ${toArchive.length} 个已完成任务条目至 .ihui-agent/archive/`
      execFileSync(
        GIT_BIN,
        [...gitQ, 'commit', '--no-verify', '-m', msg, '--', planRel, archiveRel],
        {
          cwd: ROOT,
          stdio: 'pipe',
          windowsHide: true,
          env: { ...process.env, IHUI_ARCHIVE_COMMIT: '1' },
          timeout: 120_000,
        },
      )
      console.log(`${C.green}✅ 归档 commit 已创建(IHUI_ARCHIVE_COMMIT=1 防递归)${C.reset}`)
    } catch (e) {
      console.error(`${C.red}❌ 自动 commit 失败: ${e.message}${C.reset}`)
      console.error(
        `${C.yellow}   请手动: git add PROJECT_PLAN.md .ihui-agent/archive/ && git commit${C.reset}`,
      )
    }
  }

  process.exit(0)
}

// ─── --self-test:纯函数自检(零副作用、零派生 git、零写盘)──────────────────
// 每条判据都配**正反两例**:只证明"会拦"的自检等于没证明(它可能把正常形态一起拦了),
// 只证明"会放"的自检更糟(它可能什么都放)。见 §22c。
function runSelfTest() {
  const today = '2099-01-01'
  const archiveBaseName = `PROJECT_PLAN_${today}_auto-archive.md`
  const results = []
  const ok = (name, cond, detail = '') =>
    results.push({ name, pass: cond === true, detail: cond === true ? '' : String(detail) })

  // 夹具:一条可归档的 ## 条目(内含一条 [x] 登记行)+ 一条**不属于该条目**的 [x] 行。
  const parentText = [
    '# plan',
    '',
    '## 已完成条目A(2026-09-01 完成 ✅)',
    '正文 A1',
    '- [x] ✅(2026-09-01) **G-206 同一个缺口今天被补了两遍**(刻意不合并)',
    '',
    '## 活章节',
    '- [x] ✅(2026-09-01) **G-207 另一件已完成的事**(编号加标题前缀)',
    '- [ ] **G-208 还没做完的事**',
    '',
  ].join('\n')
  const tasks = parseCompletedTaskBlocks(parentText)
  ok('S0 夹具本身就是一条可归档条目(否则后面全在对着空气判)', tasks.length === 1, `实得 ${tasks.length}`)
  const built = buildNewPlanText({ baseText: parentText, tasks, today, archiveBaseName })
  const ev = [
    {
      title: tasks[0].titleText,
      placeholderPresent: built.newText
        .split('\n')
        .includes(placeholderLine(today, tasks[0].titleText, archiveBaseName)),
      bodyInArchive: blockLandsContiguously(
        trimTrailingEmpty(tasks[0].bodyLines).join('\n') + '\n\n---\n\n',
        trimTrailingEmpty(tasks[0].bodyLines).join('\n'),
      ),
    },
  ]

  // S1 正当归档:条目被搬走、G-207 逐字活着 ⇒ 零违规
  const zlGood = zeroLossViolations({
    parentText,
    newText: built.newText,
    movedRanges: built.movedRanges,
    blockEvidence: ev,
  })
  ok('S1 正当归档(占位齐 + 正文进归档件)⇒ 零违规', zlGood.violations.length === 0, JSON.stringify(zlGood.violations))
  ok('S1b 被搬的那条 [x] 计入 exempted 而不是被无声放过', zlGood.exempted === 1, JSON.stringify(zlGood))

  // S2 结构等值:产出面 == 底稿 ⊕ 本次搬运
  ok(
    'S2 产出面等于"底稿把被搬块换成占位"的结构等值',
    derivedByConstructionOk({ parentText, newText: built.newText, movedRanges: built.movedRanges, today, archiveBaseName }),
  )
  // S3 反向:别人的一行被改动 ⇒ 结构等值必须红(它才是"只拦我这次改动"的那道锁)
  const tampered = built.newText.replace('G-208 还没做完的事', 'G-208 被别人顺手改了')
  ok(
    'S3 产出面被夹带一行他人改动 ⇒ 结构等值判红',
    derivedByConstructionOk({ parentText, newText: tampered, movedRanges: built.movedRanges, today, archiveBaseName }) === false,
  )

  // S4 本票根治的那一型:底稿滞后(已入库的 [x] 在磁盘上是 [ ])⇒ 零损失闸必须点名
  const staleBase = parentText.replace(
    '- [x] ✅(2026-09-01) **G-207',
    '- [ ] **G-207',
  )
  const staleBuilt = buildNewPlanText({ baseText: staleBase, tasks: parseCompletedTaskBlocks(staleBase), today, archiveBaseName })
  const zlStale = zeroLossViolations({
    parentText,
    newText: staleBuilt.newText,
    movedRanges: staleBuilt.movedRanges,
    blockEvidence: ev,
  })
  ok('S4 滞后底稿把已入库的 [x] 退回 [ ] ⇒ 零损失闸点名', zlStale.violations.length === 1, JSON.stringify(zlStale.violations))
  ok(
    'S4b 违规条目带得出原行(报告要能读,不能只给计数)',
    (zlStale.violations[0]?.samples ?? []).some((s) => s.includes('G-207')),
    JSON.stringify(zlStale.violations),
  )

  // S5 豁免不是白给的:占位没落地 ⇒ 同一笔搬运必须被判红
  const zlNoPlaceholder = zeroLossViolations({
    parentText,
    newText: built.newText,
    movedRanges: built.movedRanges,
    blockEvidence: [{ title: ev[0].title, placeholderPresent: false, bodyInArchive: true }],
  })
  ok('S5 搬走但原位置没留占位 ⇒ 豁免不成立、判红', zlNoPlaceholder.violations.length > 0)

  // S6 反向护栏:产出面凭空多出一条 [x] 同样拒落(不得把没做的记成做过的)
  const invented = built.newText + '\n- [x] ✅(2026-09-01) **G-999 谁也没做过的事**\n'
  const zlInvent = zeroLossViolations({
    parentText,
    newText: invented,
    movedRanges: built.movedRanges,
    blockEvidence: ev,
  })
  ok('S6 产出面多出父面没有的 [x] ⇒ 同样拒落(双向断言)', zlInvent.violations.length > 0, JSON.stringify(zlInvent.violations))

  // S7 两类身份不得混桶:产出面上把行首编号摘掉 ⇒ 主键档仍须判缺
  const rewritten = parentText.replace(
    '- [x] ✅(2026-09-01) **G-207 另一件已完成的事**(编号加标题前缀)',
    '- [ ] 另一件已完成的事(换个写法就想绕过闸)',
  )
  const zlRewrite = zeroLossViolations({
    parentText,
    newText: buildNewPlanText({
      baseText: rewritten,
      tasks: parseCompletedTaskBlocks(rewritten),
      today,
      archiveBaseName,
    }).newText,
    movedRanges: built.movedRanges,
    blockEvidence: ev,
  })
  ok('S7 换写法(编号被摘掉)不得顶掉主键行的名额 ⇒ 仍判红', zlRewrite.violations.length > 0, JSON.stringify(zlRewrite.violations))

  // S8 没有父提交面可比 ⇒ 判"不适用/未判定",绝不记为通过
  const zlNone = zeroLossViolations({ parentText: null, newText: built.newText })
  ok('S8 无父面 ⇒ 不适用(undetermined=1)且不当合格证', zlNone.undetermined === 1 && zlNone.violations.length === 0, JSON.stringify(zlNone))

  // S9 面开关:未知值必须报错,不得静默掉进默认档
  ok('S9 --plan-face 缺省 ⇒ 不指定(走默认档)', resolveRequestedFace([]).face === null)
  ok('S9b --plan-face worktree 认得', resolveRequestedFace(['--plan-face', 'worktree']).face === 'worktree')
  ok('S9c --plan-face 非法值 ⇒ 报错而非吞成默认档', !!resolveRequestedFace(['--plan-face', 'HEAD']).error)
  ok('S9d --plan-face 缺值 ⇒ 报错', !!resolveRequestedFace(['--plan-face']).error)

  // S10 §22c:判据的输入必须包含**真实文件里逐字取来的形态**(此行逐字取自 2026-09-28 的
  // HEAD:PROJECT_PLAN.md 一条已入库登记行,只把日期换掉),不得全靠自造夹具。
  const REAL_ROW =
    '- [x] ✅(2026-09-26) **G-206 同一个缺口今天被补了两遍**(刻意不给 F1 判红开关:开关就是下一次静默)'
  const realKey = compositeKeyOf(REAL_ROW)
  ok('S10 真实登记行能给出复合主键(不是 null)', typeof realKey === 'string' && realKey.length > 8, String(realKey))
  ok('S10b 真实登记行被认作 done 行', parseTaskRows(REAL_ROW).length === 1 && parseTaskRows(REAL_ROW)[0].state === 'done')
  ok(
    'S10c 同一行换成 [ ] 后身份不变(证明判据认的是"同一件事",不是"哪个字符")',
    doneIdentityOf(REAL_ROW) === doneIdentityOf(REAL_ROW.replace('- [x]', '- [ ]')),
  )

  // S11 占位形态与 13c 反查同形:必须是"<!-- 已归档(日期):标题,完整内容在 .ihui-agent/archive/<文件> -->"
  const ph = placeholderLine(today, '某个已完成任务条目(2026-09-01 完成 ✅)', archiveBaseName)
  ok('S11 占位含相对路径且以 HTML 注释闭合', ph.startsWith('<!-- 已归档(') && ph.endsWith('-->') && ph.includes('.ihui-agent/archive/' + archiveBaseName), ph)
  ok('S11b 标题超 60 字被截断(既有形态,不得改)', placeholderLine(today, 'x'.repeat(80), archiveBaseName).includes('x'.repeat(60)))

  // S12 子弹级采集器:连续 - [x] 并成一段,缩进续行算正文,**遇到任何未勾选行当场断开**
  // (把别人正开着的账搬进归档比不归档严重得多 ⇒ 这一条是本维的安全底座,必须可测)。
  const bFix = [
    '## 活章节',
    '- [x] ✅(2026-09-01) **G-300 甲已完成**',
    '  续行说明属于甲',
    '- [x] ✅(2026-09-02) **G-301 乙已完成**',
    '- [ ] **G-302 丙还开着**',
    '## 另一章',
    '- [x] ✅(2026-09-03) **G-303 丁已完成**',
    '  - [ ] 丁的缩进子项还开着',
  ].join('\n')
  const bRuns = collectCompletedBullets(bFix)
  ok('S12 连续已完成登记并成一段(含缩进续行)', bRuns.length === 2 && bRuns[0].bodyLines.length === 3, JSON.stringify(bRuns.map((r) => r.bodyLines.length)))
  ok(
    'S12b 采集段内一条未勾选都不许有(正反两章都验)',
    bRuns.every((r) => !r.bodyLines.some((l) => /^\s*[-*+] \[ \]/.test(l))),
    JSON.stringify(bRuns.map((r) => r.bodyLines)),
  )
  ok('S12c 未勾选行的缩进子项不得被裹进上一条', !String(bRuns[1] && bRuns[1].bodyLines).includes('丁的缩进子项还开着'), JSON.stringify(bRuns[1]))
  ok('S12d skipRanges 内的子弹不采(与条目级搬运互斥)', collectCompletedBullets(bFix, { skipRanges: [{ startLine: 1, endLine: 3 }] }).length === 1, JSON.stringify(collectCompletedBullets(bFix, { skipRanges: [{ startLine: 1, endLine: 3 }] }).map((r) => r.startLine)))

  // S12e 逐行判资格(2026-09-28 由实测逼出的缺陷):旧写法按"块内第一条日期"定整块年龄 ⇒
  // 满阈值的老行紧跟在新行后面就被整段带着留下,而采集器还报"达阈值 0 段"(报数与真值分叉)。
  const mixFix = [
    '- [x] ✅(2026-01-02) **G-910 新的一条**',
    '- [x] ✅(2025-01-01) **G-911 满阈值的一条**',
    '- [x] ✅(2026-01-03) **G-912 又一条新的**',
  ].join('\n')
  const oldOnly = collectCompletedBullets(mixFix, {
    lineEligible: (l) => String(l).includes('(2025-'),
  })
  ok('S12e 混合段里满阈值的行单独成段被搬走,不搭新行的车', oldOnly.length === 1 && oldOnly[0].bodyLines.length === 1 && oldOnly[0].bodyLines[0].includes('G-911'), JSON.stringify(oldOnly))
  ok(
    'S12f 相邻两条都满阈值时仍并成一段(不得为逐行判龄把占位数炸成一比一)',
    collectCompletedBullets([ '- [x] ✅(2025-01-01) **G-913 甲**', '- [x] ✅(2025-01-02) **G-914 乙**' ].join('\n'), { lineEligible: (l) => String(l).includes('(2025-') }).length === 1,
  )

  // S13 假条目守卫:标题写着已完成、体内还有未勾选 ⇒ 不搬(真仓 L13850 那一枚 575,577 B /
  // 块内未勾选 237 条就是这一型;人工按提示跑 --allow-mass 会把 237 件活账归档)。
  // §22c:标题逐字取自 HEAD:PROJECT_PLAN.md 第 13850 行,不得用自造形态。
  const REAL_FALSE_HEADING =
    '## P1 侧边栏底部 5 工具按钮收进用户行下拉菜单(2026-09-21 立并完成 ✅,平台独占:仅 apps/web)'
  ok('S13 真实形态标题确实被认作可搬条目(否则守卫无从谈起)', isArchivableTaskHeading(REAL_FALSE_HEADING))
  ok(
    'S13b 体内有未勾选行 ⇒ 守卫判不搬',
    entryHasOpenRows([REAL_FALSE_HEADING, '- [ ] 还开着的活账']) === true,
  )
  ok('S13c 体内全是已完成 ⇒ 守卫不得拦(否则归档整族失效)', entryHasOpenRows([REAL_FALSE_HEADING, '- [x] ✅(2026-09-21) 做完了']) === false)

  // S14 体积预算取最旧前缀:每轮都搬得动(旧"全批或不动"= 永久卡死);单条超预算 ⇒ 空集(不拆条目)
  const eb = (t) => Buffer.byteLength(t.bodyLines.join('\n'), 'utf8')
  const cands = [
    { date: '2026-09-10', bodyLines: ['- [x] ' + 'A'.repeat(100)] },
    { date: '2026-09-20', bodyLines: ['- [x] ' + 'B'.repeat(100)] },
    { date: '2026-09-05', bodyLines: ['- [x] ' + 'C'.repeat(100)] },
  ]
  const g1 = selectWithinBudget(cands, { maxEntries: 25, maxBytes: 150, entryBytes: eb })
  ok('S14 超预算时按最旧优先取前缀,不是整批拒绝', g1.picked.length === 1 && g1.picked[0].date === '2026-09-05' && g1.deferredCount === 2, JSON.stringify({ p: g1.picked.map((x) => x.date), d: g1.deferredCount }))
  const g2 = selectWithinBudget([{ date: '2026-09-01', bodyLines: ['- [x] ' + 'X'.repeat(400)] }], { maxEntries: 25, maxBytes: 150, entryBytes: eb })
  ok('S14b 最旧一条自身超预算 ⇒ 返回空集(拒绝路径,绝不搬半条)', g2.picked.length === 0 && g2.oldestBytes > 150, JSON.stringify({ p: g2.picked.length, o: g2.oldestBytes }))
  const g3 = selectWithinBudget(cands, { maxEntries: 25, maxBytes: 100000, entryBytes: eb })
  ok('S14c 预算内 ⇒ 整批原样通过(不得为"更安全"而少搬)', g3.picked.length === 3 && g3.deferredCount === 0, JSON.stringify(g3.picked.length))

  let failed = 0
  for (const r of results) {
    if (r.pass) console.log(`${C.dim}✅ ${r.name}${C.reset}`)
    else {
      failed += 1
      console.log(`${C.red}❌ ${r.name}\n   ${r.detail}${C.reset}`)
    }
  }
  console.log(
    `${failed === 0 ? C.green : C.red}自检共 ${results.length} 条断言,通过 ${results.length - failed},失败 ${failed}${C.reset}`,
  )
  process.exit(failed === 0 ? 0 : 1)
}

// §22d:CLI 直跑与"被测试 import"两种形态必须分开 —— 顶层 `main()` 会让镜像测试一 import
// 就真去动一份仓库(本脚本动的还是活文档)。判定必须经 pathToFileURL 归一,Windows 反斜杠
// 路径裸拼 file:// 永远不相等,那会让 CLI 永不触发 = 静默失控。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun && selfTest) runSelfTest()

if (isDirectRun) {
  main().catch((e) => {
    console.error(`${C.red}❌ 脚本自身异常:${e?.message ?? e}\n${e?.stack ?? ''}${C.reset}`)
    process.exit(2) // 2 = 脚本异常,1 = 业务失败(§22b/§22d 的退出码约定)
  })
}

export const __test__ = {
  placeholderLine,
  doneIdentityOf,
  doneMultiset,
  zeroLossViolations,
  derivedByConstructionOk,
  buildNewPlanText,
  buildArchiveChunk,
  blockLandsContiguously,
  resolveRequestedFace,
  resolvePlanBase,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
