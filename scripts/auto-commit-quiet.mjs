#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * auto-commit-quiet.mjs —— 无人认领的未提交改动自动收编(2026-10-22 机主令)
 *
 * 存在理由:仓库只有 post-commit 自动推送,没有自动提交;并行席位的半成品会一直
 * 挂在工作区,久了既挡别人的门、又有被并发 checkout 覆盖的风险(§12d 事故面)。
 * 本器在"改动停止呼吸"之后才动手,做到既不全天候抢提交他人的活,也不让任何改动无限期悬空。
 *
 * 判定(全部满足才提交):
 *   1. `git status` 有改动;
 *   2. 所有改动文件的 mtime 都早于 QUIET_MIN 分钟(默认 3,2026-10-22 提速)—— 还在写的一律放过;
 *   3. 无未解决冲突(UU/AA/DD)、无 .git/index.lock、无进行中的守门批;
 *   4. **路径白名单**(2026-11-02 收紧,立因见 COLLECT_WHITELIST):只收编文档与派生产物,
 *      `apps/**`、`packages/**` 下的业务代码与测试、`AGENTS.md`/`PROJECT_PLAN.md` 等规则文件
 *      一律不收编;无法判定归属的路径按"不收编"处理(fail-safe,宁可留给人清)。
 *
 * 两条来源通道(2026-11-03 加②,与①**并列**,①一条未放宽):
 *   ① 白名单族 —— 上面 1–4,既有行为一字未改;
 *   ② 账本族 —— 守护写盘腿往 `.ihui-agent/state/cross-end-landing.jsonl` 申报过的产出,
 *      准入判据全在 `scripts/lib/cross-end-landing-ledger.mjs` 的 `collectiblePaths`
 *      (账本在册 ∧ 落点 blob 逐字节等于登记 blobOid ∧ 超静默期 ∧ 非 ignored),本器再逐条
 *      **双检**一次工作树 blob(防收编途中被改),然后吃同一批护栏(busy 闸 / 活文档归复洁链 /
 *      MAX_PATHS 分批 / i18n 切批),自成一枚 `chore(cross-end):` 批次。
 *      取不到账本 ⇒ `ledger=unjudged` 且一条不收(§0.3,不用空集冒充"没有待收")。
 *
 * 落地一律走 safe-commit(全门冻结索引),失败只记日志不重试轰炸;调度器下一轮自然重来。
 * 推送不自带(交 post-commit 的 git-push-guard)。
 * **结论行纪律(2026-11-03 立,§0.3/§0.9)**:直跑形态的每一轮 —— 含每一条让路(no-candidates
 * 型/busy 型/账本取不到型)与异常 —— 都必须经唯一出口 `emitConclusion` 往 **stdout** 打恰好一行
 * `COLLECT-RESULT …`(形态仍由 `ledgerConclusionLine` 现产,键集与前缀一字不改);
 * 被 import 时默认不写调用方 stdout(测试面走注入的 logLine)。
 * 用法: node scripts/auto-commit-quiet.mjs [--dry-run]
 */
import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw } from './lib/face-reader.mjs'
// 已结清行回退判据(§0.6 单一真相源):本器只 import,不抄第二份"什么算已结清/同一件事"。
import { closedRowRegressions } from './lib/ledger-closed-rows.mjs'
// 账本收编族(2026-11-03 新增)的唯一准入判据住在库里,本器不写第二份(§0.6):
// 「账本在册 ∧ 落点当前 blob 逐字节等于登记 blobOid ∧ 超静默期 ∧ 非 ignored」四条全在
// collectiblePaths 内实现;本器只负责取数、双检、过既有护栏、交给 safe-commit。
import {
  DEFAULT_QUIET_MS,
  collectiblePaths,
  ledgerPathFor,
} from './lib/cross-end-landing-ledger.mjs'
// 活文档清单的唯一出处(§0.6):本器不再自己抄一份"哪些文件算活文档"。
import { DEFAULT_LIVE_DOCS } from './lib/content-loss-gate.mjs'

// 测试注入面(2026-11-03,"结论行纪律"的镜像测试要直跑子进程于临时仓夹具):
// 仅 IHUI_AUTO_COMMIT_QUIET_TEST_ROOT 显式设置时改钉 ROOT;守护/生产派发从不设置该变量
// ⇒ 生产形态 ROOT 仍由脚本自身位置推导(§15),逐字节同形。
const ROOT = process.env.IHUI_AUTO_COMMIT_QUIET_TEST_ROOT
  ? resolve(process.env.IHUI_AUTO_COMMIT_QUIET_TEST_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIET_MIN = Number(process.env.IHUI_AUTO_COMMIT_QUIET_MIN || 3)
const DRY = process.argv.includes('--dry-run')
const LOG = join(ROOT, '.ihui-agent', 'state', 'hook-logs', 'auto-commit-quiet.log')
/**
 * 账本族的静默期:与白名单族同一把尺(QUIET_MIN 分钟),量不到时退回库里的默认档。
 * 两族共用一个阈值是刻意的 —— 同一份改动不该因为来源不同而等不同的时间(§0.6)。
 */
const LEDGER_QUIET_MS = Number.isFinite(QUIET_MIN) && QUIET_MIN > 0 ? QUIET_MIN * 60_000 : DEFAULT_QUIET_MS
/**
 * 单轮 pathspec 上限(命令行长度,2026-10-24 实测):脏件到 620 个时,整批 pathspec 传给
 * safe-commit 会在 Windows CreateProcess 处撞 ENAMETOOLONG(日志连续多轮
 * `spawnSync ... ENAMETOOLONG`),于是"自动收编"整器空转、改动永久悬挂。改为每轮只收前 N 个,
 * 余量下一轮接着收 —— 契约不变(全部过期改动最终都会被收编),只是把一次提交拆成多轮。
 * 提到模块级(2026-11-03)是因为**账本族也必须吃这一刀**;原注释留在批次切分处不删。
 */
const MAX_PATHS = Number(process.env.IHUI_AUTO_COMMIT_MAX_PATHS || 100)

const EXCLUDE = [
  /(^|\/)\.env(\.|$)/,
  /(^|\/)node_modules\//,
  /(^|\/)\.next\//,
  /(^|\/)\.ihui-agent\/tmp\//,
  /(^|\/)\.ihui-agent\/state\/hook-logs\//,
  /\.log$/,
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|apk|aab|jar|so|dll|exe|mp4|woff2?)$/i,
  // 人工台账**不**在此排除(2026-10-22 改):`PROJECT_PLAN.md`/`AGENTS.md` 是多席位并发改写的
  // 活文档,但"永不收编"会让改动永久悬挂(实测一份工作树副本吃掉 HEAD 已入库的 7 行)。
  // 处置改为收编前先过 merge-live-doc 归并(见 mergeLiveDocs):归并后 lost≠0 / 长行重复新增
  // 的本轮剔除,其余正常收编 —— 既不丢行,也不留无人认领的改动。
]
/** 排除表唯一判据(§0.6 单一真相源):主流程与镜像测试 import 同一份,不复制表。 */
function isExcluded(path) {
  return EXCLUDE.some((re) => re.test(path))
}

/**
 * 收编路径白名单(2026-11-02 收紧;立因 = 当日 ef1c716616「收编停留≥3分钟」把 7 件实质回退
 * 与 3 个半成品测试自动送进主干)。
 *
 * 旧实现只排除 `.env`/二进制一类,其余**全部**收编 —— 收编器因此能替任何席位提交业务代码与
 * 测试,而它唯一的判据只是"停笔 3 分钟";半成品、回退、未跑过测试的改动都会被当成成品入库。
 * 现在改成**白名单**:只有下面这些明确属于文档/派生产物的路径才收编,其余一律留在工作树交人。
 *
 * 判据刻意是"逐条列出的具体形态",不是"猜什么像生成物"的宽正则;新增形态必须在这里显式登记
 * 并补测试,不做模糊匹配。fail-safe:任何不在名单里的路径(含无法判定的)⇒ 不收编。
 */
const COLLECT_WHITELIST = [
  // 根级 README 及其语言变体(README.md / README.en.md / README.ja.md / README.ko.md)
  /^README(?:[.-][A-Za-z]{2,})?\.md$/,
  // 自动更新基线(由钩子/脚本写入)
  /^\.doc-autoupdate\//,
  // 显式生成物后缀
  /\.generated\.ts$/,
  /\.b64\.txt$/,
  // 根护栏清单(生成物,重钉走脚本)
  /^scripts\/data\/root-guard-manifest\.json$/,
  // 各端 i18n 生成目录(apps/<端>/src/i18n/generated/*.gen.ts)
  /^apps\/[^/]+\/src\/i18n\/generated\//,
  // 非色档受管块的**源头落点**(TS 档表 → tokens.css,由 sync-css-tokens.mjs --write 派生)。
  // 与上面几条同性质:它是派生态、AGENTS.md 明写「禁止手改」,正确性由门 93 R9/R10/R11 在提交链
  // 逐值兜底 —— 不是 f6e0ba44a9 防的那一型(业务代码/半成品测试)。守护的源头腿若写了它却无人收,
  // 「Web 改档表 → 三端自动跟」就停在最后一公里。
  /^packages\/design-tokens\/src\/styles\/tokens\.css$/,
]

/**
 * 该路径是否允许自动收编(白名单唯一判据)。
 *
 * fail-safe:未命中白名单一律 false —— 宁可留给人清,也不再自动送进主干。
 * 路径先归一成 `/` 分隔,Windows 反斜杠形态同判。
 */
function isCollectible(path) {
  const p = String(path).replace(/\\/g, '/')
  return COLLECT_WHITELIST.some((re) => re.test(p))
}

/**
 * 把候选路径分成"可收编/留下"两摞(pure;镜像测试直接调用,支持注入 predicate 做反向例)。
 * 默认判据 = isCollectible;注入 `() => true` 应能让"只收编白名单"的断言失败。
 */
function partitionCollectible(paths, predicate = isCollectible) {
  const collected = []
  const held = []
  for (const p of paths) {
    if (predicate(p)) collected.push(p)
    else held.push(p)
  }
  return { collected, held }
}


/**
 * 活文档:收编前必须归并(工作树副本可能滞后于 HEAD,直接提交会吞掉别人已入库的行)。
 *
 * **清单向 `lib/content-loss-gate` 的 `DEFAULT_LIVE_DOCS` 问,不在本器抄第四份**(§0.6;
 * 同口径另有 union-converge-judgments 的 LIVE_DOCS 与 safe-commit 3e 的 LIVE_DOCS)。
 * 现读实证(2026-11-05):旧写法只认 `PROJECT_PLAN|AGENTS`,而 safe-commit Step 3e 的闸
 * **含 `README.md`** —— 于是本器从不给 README 做归并准备,README 工作树副本滞后时(实测吃掉
 * HEAD 已入库行 438 条)3e 每次都拒整批,白名单族 13 枚/轮原地空转。两处对"哪些是活文档"
 * 给出不同答案,受害的只有自动化那一侧(人是 agent,会自己去跑 merge-live-doc --apply)。
 *
 * 形状刻意取**宽于 3e**(`(^|\/)<名>$`,连 `apps/web/AGENTS.md` 这类同名嵌套件也一起备):
 * 3e 的射程只有根级三枚,宽一档的结果只会是"本器多归并、多让路",不会出现"本器不收编而 3e 照收"
 * 之外的反向漏洞(把嵌套件放过去才真会吃掉别人已入库的行 —— §0.10:失效方向恒为多要一次准备)。
 */
const HUMAN_LEDGER_RE = new RegExp(
  `(^|/)(${DEFAULT_LIVE_DOCS.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`,
)
/** README 生成数字块(由 sync-readme-numbers.mjs 独占写入)。 */
const README_FILES = ['README.md', 'README.en.md', 'README.ko.md', 'README.ja.md']

function git(args, opts = {}) {
  // 派生 git 一律走脚本层(lib/face-reader 的 gitRaw,G-927 2026-10-22):裸起 'git' 会被
  // scripts/tests/face-reader.test.mjs 的"裸派生生产文件只减不增"棘轮记为新增者。层内同批兜住
  // 原先手写的三件事(显式 stdio §12g、windowsHide 强制生效、带 input 时 stdin=pipe),
  // maxBuffer 默认 64MB 与本器原值同档;绝对路径 git 二进制与 safe.directory 纪律一并拿到。
  return gitRaw(args, ROOT, opts)
}

/**
 * a 相对 b 的多重集行差(a 有而 b 没有的行数;重复行按份数算)。
 */
export function minusCount(aText, bText) {
  const pool = new Map()
  for (const l of String(bText).split('\n')) pool.set(l, (pool.get(l) ?? 0) + 1)
  let n = 0
  for (const l of String(aText).split('\n')) {
    const c = pool.get(l) ?? 0
    if (c > 0) pool.set(l, c - 1)
    else n += 1
  }
  return n
}

/**
 * 部分回退判据(阈值单源,镜像测试与生产探针共用一把尺,§0.6/§22c)。
 *
 * 立因枚 f0572d64c4(2026-11-01 00:40,收编器自己那一枚):吃掉 2915 行翻译的那一轮,
 * 盘上副本是**滞后编辑器缓冲 + 自身少量改动**的混血 —— 实测它到"最近祖先"的行距(584)
 * 与到 HEAD 的行距一模一样 ⇒ 既不等于旧版也不等于新版,整片等值那一臂结构上看不见它。
 *
 * 阈值全部由**现读对照**定(第一版拍 `removed>=20 && added<=10`,拿真事故枚回放 15 枚文件
 * 命中 0 条 —— 测试全绿而判据是空的,已作废):
 *   事故 f0572d64c4  删占比 565/7698=7.3%、15/575=2.6%   增/删 19/565=3.4%、1/15=6.7%
 *   合法死键清理 7cb6c064  删占比 28/7724=0.4%、5/7158=0.1%(增=0 ⇒ 单看"只删不增"会误杀它)
 *   合法正常收编 49c3ecd3  删占比 45/29830=0.2%,增/删 43/45=96%
 * ⇒ 分开两族的那一维是**删掉的行数占该文件全文的比例**(事故最小 2.6% vs 合法最大 0.4%,间隔 6.5 倍),
 *   不是绝对行数,也不是"只删不增"。取 删占比 ≥2% ∧ 删 ≥15 行 ∧ 增 ≤ 删的 1/8,三条缺一不算。
 *
 * 判成滞后就留在工作树交显式处置(§0.10:失效方向必须"多要一次说明",绝不能"多放一次跳门");
 * 有意的批量删除由归属席位自己提交 —— 收编器不替谁决定删掉别人刚入库的成百行。
 */
export function isPartialRevert(delta) {
  if (!delta || typeof delta.removed !== 'number') return false
  const removed = delta.removed
  const added = delta.added
  const total = delta.headLines
  if (!(removed >= 15) || !(total > 0)) return false
  if (removed * 100 < total * 2) return false // 删占比 <2% 全文:是有意的定点删除,不是缓冲回退
  return added * 8 <= removed // 增不得盖过删:大量重写过的算新工作
}

/**
 * 滞后副本判据(纯函数;镜像测试直接用它,§22c)。
 *
 * 立因(2026-10-25 实测,不是推测):旁路落地(`object-space-land`)只推进 HEAD 与索引,**不写工作树**;
 * 本器 3 分钟后按工作树字节收编,就把那笔已入库的改动整份写回旧版。实测一枚 `chore(auto)` 在同一文件里
 * 回退了绑定手机/邮箱两端点 88 行与门 198 的 updatedAt 出口形态两处,HEAD 面行为锁 7/7 全红。
 *
 * 判据一(整片):工作树 blob ≠ HEAD blob,却等于该路径某个**祖先提交**的同路径 blob ⇒ 滞后副本。
 * 判据二(部分,2026-11-01 补):见 isPartialRevert —— 整片等值看不见"滞后缓冲+自身改动"的混血。
 * 失效方向刻意保持收编(任一探针取不到 ⇒ 当"不是滞后副本"),只有**证实**才跳过并点名,
 * 让"有意回退"由人显式提交(§0.10:失效方向必须是多要一次定向说明)。
 */
export function partitionStaleCopies(paths, probes) {
  const kept = []
  const skipped = []
  const why = new Map()
  for (const p of paths) {
    const wt = probes.worktree(p)
    const head = probes.head(p)
    if (!wt) {
      kept.push(p)
      continue
    }
    if (!head) {
      // HEAD 无此文件:通常是真新文件(收编);但若历史上曾入库过,这就是**删除档死件回潮**
      // (2026-10-31 实测:aboutPageSections.ts 被正当删除三次,本器第四次把它收编回 HEAD ——
      // 旧判据在「HEAD blob 问不到」这一格 fail-open,恰好是回潮的通道)。证得到曾存在 ⇒ skip。
      // 证不到(探针取不到/无 A 记录)⇒ 按真新文件放行(失效方向保持原收编行为,不猜)。
      if (probes.everExisted?.(p)) {
        skipped.push(p)
        why.set(p, '删除档死件回潮(HEAD 无此件,历史证得到曾入库)')
        continue
      }
      kept.push(p)
      continue
    }
    if (wt === head) {
      kept.push(p)
      continue
    }
    const ancestors = probes.ancestors(p) || []
    if (ancestors.includes(wt)) {
      skipped.push(p)
      why.set(p, '整片等于该路径某个祖先版本(滞后副本)')
      continue
    }
    // 部分回退臂(2026-11-01 补,立因枚 f0572d64c4):整片等值那一臂看不见
    // "滞后编辑器缓冲 + 自身少量改动"的混血;阈值与其现读对照见 isPartialRevert。
    const delta = probes.lineDelta?.(p)
    if (isPartialRevert(delta)) {
      skipped.push(p)
      why.set(
        p,
        `部分回退嫌疑(HEAD 有而盘上无 ${delta.removed} 行=${((delta.removed / delta.headLines) * 100).toFixed(1)}% 全文 / 盘上新增仅 ${delta.added} 行)`,
      )
      continue
    }
    kept.push(p)
  }
  return { kept, skipped, why }
}

/** git 探针(取不到一律返回 null ⇒ fail-open,保持原收编行为)。 */
function staleCopyProbes(p) {
  const oid = (ref) => {
    try {
      return git(['rev-parse', ref]).trim()
    } catch {
      return null
    }
  }
  return {
    worktree: () => {
      try {
        return git(['hash-object', '--', p]).trim()
      } catch {
        return null
      }
    },
    head: () => oid(`HEAD:${p}`),
    everExisted: () => {
      // 曾入库过 = 历史上有 A(add)记录;删除档死件判据的事实腿(不是猜测)。
      try {
        return git(['log', '--diff-filter=A', '-n', '1', '--format=%H', '--', p]).trim().length > 0
      } catch {
        return false
      }
    },
    /**
     * 行差(部分回退臂的输入):removed = HEAD 有而盘上没有的行数,added = 盘上新增的行数。
     * 按**多重集**算(重复行按份数),否则一份 20 行的样板被复制两遍会被算成 0。
     * 任一文本取不到(未入库/二进制/超大)⇒ 返回 null ⇒ 该臂不参与判断(fail-open 同上一臂)。
     */
    lineDelta: () => {
      let headText = null
      let wtText = null
      try {
        headText = git(['show', `HEAD:${p}`])
      } catch {
        return null
      }
      try {
        wtText = readFileSync(join(ROOT, p), 'utf8')
      } catch {
        return null
      }
      if (headText === null || wtText === null) return null
      return {
        removed: minusCount(headText, wtText),
        added: minusCount(wtText, headText),
        headLines: headText.split('\n').length,
      }
    },
    ancestors: () => {
      let commits = []
      try {
        // 窗口 6→40(2026-10-31):回潮-删除轮次多的路径(aboutPageSections 三删四回)在 6 枚
        // 窗口里可能只见删除不见旧 blob,滞后判定漏网;40 覆盖同一路径的现实轮次。
        commits = git(['log', '-n', '40', '--format=%H', '--', p])
          .trim()
          .split('\n')
          .filter(Boolean)
      } catch {
        return []
      }
      const out = []
      for (const c of commits) {
        const b = oid(`${c}:${p}`)
        if (b) out.push(b)
      }
      return out
    },
  }
}

/**
 * 审**全部**候选路径(2026-10-29 取消「已暂存 = 明确意图」那条豁免)。
 *
 * 立因(现读事故,不是推测):b44ab834609(00:36:57)把 a3facca58f3(00:32:48,早 4 分钟)
 * 刚入库的 relay 守卫②整份写回旧版。当时那三个路径被别席暂存过 ⇒ 落进旧豁免 ⇒ 守卫
 * 一次都没问。而本器落地走 safe-commit,它 Step1 `git reset HEAD` 清索引、Step2
 * `git add -A <声明集>` ⇒ **真正入库的是工作树字节**,与"谁暂存过"毫无关系。
 * 所以"已暂存"既不能证明工作树内容是新的,也不能证明提交出去的就是那份暂存。
 *
 * `changes` 参数保留(调用方仍在传,且它是本器其它判据的输入),但不再参与豁免决策。
 * 失效方向仍是"少收编一次":判成滞后就跳过并逐条点名,人想显式提交随时可以(§0.10)。
 */
function dropStaleCopies(stale, changes, probeFactory = staleCopyProbes) {
  if (!stale.length) return { kept: stale, skipped: [], why: new Map() }
  // 探针必须**逐臂全递**:上一版这里漏递 `everExisted`,导致「删除档死件回潮」那一臂
  // 在真实调用路径上永远是 `probes.everExisted?.()` ⇒ undefined ⇒ 按真新文件放行 ——
  // 镜像测试直接构造 probes 传进 partitionStaleCopies,所以测试全绿而生产臂空转(§0.9:
  // 判据必须在真跑它的那一刻才成立;2026-10-31 补的那一臂等于没补)。同批补递 lineDelta。
  const { skipped, why } = partitionStaleCopies([...stale], {
    worktree: (p) => probeFactory(p).worktree(),
    head: (p) => probeFactory(p).head(),
    everExisted: (p) => probeFactory(p).everExisted?.(),
    lineDelta: (p) => probeFactory(p).lineDelta?.(),
    ancestors: (p) => probeFactory(p).ancestors(),
  })
  return { kept: stale.filter((p) => !skipped.includes(p)), skipped, why }
}

/**
 * 收编批必须按 scope 门文档化的合法形态切两刀(2026-10-31,实测结构性死锁):
 *   - R2 对「staged 含 packages/i18n/messages/ 且 scope≠i18n」无条件判红(R2 不走跨切白名单);
 *   - R3 对「≥3 个 apps 子目录 + 显式 scope 不在端集合」判红,而 scope=null 的聚合 commit 明文合法。
 * 旧的 `chore(auto)` 两头都撞:批里有 i18n 必红 R2、跨 ≥3 端必红 R3 ⇒ 收编器每轮同一条红原地
 * 打转,改动永久悬挂(2026-10-31 实测 108 枚,十条日志轮同一出口)。不削判据,只把批次摆对:
 * i18n messages 单独一枚 chore(i18n),其余走无 scope 的 chore: 聚合。
 */
const I18N_MESSAGES_PREFIX = 'packages/i18n/messages/'
function autoCommitMessages(quietMin) {
  return {
    i18n: `chore(i18n): 收编停留≥${quietMin}分钟的 i18n 未提交改动`,
    rest: `chore: 收编停留≥${quietMin}分钟的未提交改动`,
  }
}

function partitionI18nBatch(paths) {
  const i18n = []
  const rest = []
  for (const p of paths) {
    ;(String(p).replace(/\\/g, '/').startsWith(I18N_MESSAGES_PREFIX) ? i18n : rest).push(p)
  }
  return { i18n, rest }
}

function log(line) {
  mkdirSync(dirname(LOG), { recursive: true })
  appendFileSync(LOG, `[${new Date().toISOString()}] ${line}\n`)
}

function guardBusy() {
  if (existsSync(join(ROOT, '.git', 'index.lock'))) return 'index.lock 在用'
  const preCommitLog = join(ROOT, '.ihui-agent', 'state', 'hook-logs', 'pre-commit.log')
  if (!existsSync(preCommitLog)) return null
  const ageSec = (Date.now() - statSync(preCommitLog).mtimeMs) / 1000
  if (ageSec > 30) return null // 半分钟没人写 ⇒ 批次已结束(旧实现按 6 分钟判,把刚跑完的批次误当在跑,导致永远让路)
  // 最近 30 秒内有写入:再取一次大小确认是否仍在增长(3 秒采样,避免误判)
  const size1 = statSync(preCommitLog).size
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000) // 真同步睡眠,不烧 CPU
  const size2 = statSync(preCommitLog).size
  if (size2 !== size1) return `守门批正在写(pre-commit.log 30 秒内仍在增长:${size1}→${size2})`
  return null
}

/** 解析 porcelain -z: 每条 `XY path`(重命名带两个 NUL 段),返回 {xy, path} */
function listChanges() {
  const raw = git(['status', '--porcelain', '-z']).split('\0')
  const out = []
  for (let i = 0; i < raw.length; i++) {
    const rec = raw[i]
    if (!rec || rec.length < 4) continue
    const xy = rec.slice(0, 2)
    let path = rec.slice(3)
    if (xy[0] === 'R' || xy[0] === 'C') i++ // 跳过重命名目标段
    if (xy === '??') path = rec.slice(3)
    out.push({ xy, path })
  }
  return out
}

/**
 * 活文档归并:把 HEAD 已入库、工作树副本里被吞掉的行插回(merge-live-doc 的既有职责)。
 * 认绿条件 = 归并后 lost=0 **且** ≥60 字符长行重复新增=0;任一不满足都不收编,
 * 留给下一轮或文档所有者 —— 宁可悬挂一轮,也不把丢行/重复登记写进历史。
 */
function mergeLiveDoc(file, root = ROOT) {
  try {
    const out = execFileSync(
      process.execPath,
      [join(root, 'scripts', 'merge-live-doc.mjs'), '--file', file, '--apply'],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 << 20,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    // 两种输出形态都要认(2026-10-22 实测):
    //   · 有整行丢失 → apply 插回后打印「归并后仍判 lost = N(必须 0)」;
    //   · 无整行丢失 → apply 是空操作,只打印「真丢失(需插回)= 0」,不打归并汇总。
    // 只认这两类 lost 读数;都读不到就 fail-closed(不认绿,宁可悬挂一轮)。
    const after = out.match(/归并后仍判 lost = (\d+)/)
    const before = out.match(/真丢失\(需插回\)=\s*(\d+)/)
    const lost = after ? Number(after[1]) : before ? Number(before[1]) : null
    if (lost === null) return { ok: false, why: '归并输出缺少 lost 读数(不认绿)' }
    if (lost !== 0) return { ok: false, why: `归并后 lost=${lost}` }
    const dup = out.match(/归并后 \d+\(新增 (\d+)\)/)
    if (dup && Number(dup[1]) !== 0) return { ok: false, why: `长行重复新增 ${dup[1]}` }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      why: String(e?.stdout || e?.message || '')
        .trim()
        .split('\n')
        .slice(-3)
        .join('\n'),
    }
  }
}

/**
 * 门 237(归档单调性)同一把尺子,审磁盘面:红 = 有已归档票被复活成未勾活行 / 逐字孪生回插。
 * 判据实现只有 scripts/check-plan-archive-monotonic.mjs 一份(§0.6 单一真相源),本器不复制。
 */
function checkArchiveMonotonic(root = ROOT) {
  try {
    execFileSync(
      process.execPath,
      [join(root, 'scripts', 'check-plan-archive-monotonic.mjs'), '--worktree'],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 << 20,
        timeout: 120000,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    return { ok: true }
  } catch (e) {
    const out = String(e?.stderr || e?.stdout || e?.message || '')
      .trim()
      .split('\n')
      .filter(Boolean)
    return { ok: false, why: out.slice(0, 3).join(' / ') }
  }
}

/**
 * 活文档写盘前快照(2026-10-24 加固):merge-live-doc 与摘除复洁都是"**先写盘、后判定**"——
 * 实测 16:00/16:06/16:09 三轮各检出 12/14 条归档倒退,提交被门 237 拦下了,但工作树副本
 * 已被这两步写脏,下一位席位读到的是被污染的台账。快照 + 判定红即回滚,让"不收编"真的
 * 等于"本器没碰过这个文件"。返回 Buffer(逐字节回写,不经编码转换)。
 */
function snapshotLedger(file, root = ROOT) {
  try {
    return readFileSync(join(root, file))
  } catch {
    return null
  }
}

/** 回滚到快照;内容未变(本器没写盘)时不动文件,避免空写刷新 mtime 把文件又冻 3 分钟。 */
function rollbackLedger(file, snap, why, root = ROOT) {
  if (!snap) return
  try {
    const cur = readFileSync(join(root, file))
    if (cur.equals(snap)) return
    writeFileSync(join(root, file), snap)
    log(`活文档已回滚工作树副本(${file}):${why}`)
  } catch (e) {
    log(`⚠️ 活文档回滚失败(${file}),工作树仍可能脏:${String(e?.message || e)}`)
  }
}

/**
 * 处置侧快照落盘(2026-10-28 立,票 gb22「活文档被体积清偿压好后又被归并档原样拉回」)。
 *
 * 为什么需要这一份:§1 的体积清偿是两步走 —— 先把整区正文逐字写进 `.ihui-agent/archive/`,再把文档
 * 压下来。压下来到落库之间(实测 11:40 压 → 11:54 入库)HEAD 仍是**未压版**,而 `merge-live-doc --apply`
 * 比的正是 HEAD ↔ 工作树 ⇒ 它把刚被有意搬走的行判成"真丢失"原样插回(实测 2026-10-28 11:51:57 把
 * 95336 字节顶回 102352,备份件 `.ihui-agent/tmp/AGENTS.md.2026-10-28T03-51-57.pre-merge.bak`)。
 * 复洁器要判"这一行是本轮归并插回来的、还是别人真新增的",唯一可靠的基准就是**归并前那一刻的工作树**
 * —— 也就是本器已经在手的 `snapshotLedger` 快照。落盘只为把它交给子进程,文件名固定 ⇒ 每轮覆盖,不堆积。
 *
 * 只服务正文族(AGENTS.md / README*.md):PROJECT_PLAN.md 一族的四道维有镜像测试钉着,本次红线是不动
 * 其语义,故该族一律不传这一旗(判据语义与 2026-10-22 立版逐字相同)。
 *
 * @returns {string|null} 相对 ROOT 的快照路径;取不到快照 ⇒ null(本维不启用,复洁退回原判据)
 */
function writeDispositionSnapshot(file, snap, root = ROOT) {
  if (!file.endsWith('.md') || file.endsWith('PROJECT_PLAN.md')) return null
  if (!snap || !snap.length) return null
  try {
    const dir = join(root, '.ihui-agent', 'tmp', 'auto-commit-quiet')
    mkdirSync(dir, { recursive: true })
    const rel = join(
      '.ihui-agent',
      'tmp',
      'auto-commit-quiet',
      `${basename(file)}.pre-merge.disposition`,
    )
    const abs = join(root, rel)
    writeFileSync(abs, snap)
    return rel
  } catch (e) {
    log(
      `⚠️ 处置侧快照落盘失败(${file}):${String(e?.message || e)} ⇒ 本轮不启用归档批次维(退回原判据)`,
    )
    return null
  }
}

/**
 * 已结清行回退闸的取数口(2026-10-25):HEAD blob 走取材层(守门 118 —— 散写 cat-file 会让
 * "判据与内容不同面同轮"悄悄发生);候选取**现盘文本**,因为调用点已在归并/复洁之后,
 * 那一刻的盘上文本就是即将入库的那一份。任一取不到 ⇒ null,由判据落 undetermined(fail-closed)。
 */
function ledgerFaces(file, root = ROOT) {
  let head = null
  try {
    const spec = `HEAD:${file}`
    head = catBatch(root, [spec]).get(spec) ?? null
  } catch {
    head = null
  }
  let candidate = null
  try {
    candidate = readFileSync(join(root, file), 'utf8')
  } catch {
    candidate = null
  }
  return { head, candidate }
}

/**
 * 把 README 的 GENERATED NUMBERS 块刷到现算值,并把**真写盘**的 README 纳入本次提交。
 *
 * 病灶(2026-10-22 实测):该块由 post-commit 回写 ⇒ 工作树最新、索引面落后一枚;而门 173 判的
 * 是索引面,于是**下一枚不带 README 的提交必红**(实测 tracked 15613 / 索引 15612 / HEAD 15611)。
 * 收编前先同步,数字随本次提交落地;sync 幂等(数字没变不写盘),不会造自激提交。
 */
function syncReadmeNumbers(stale) {
  const before = new Map()
  for (const f of README_FILES) {
    try {
      before.set(f, statSync(join(ROOT, f)).mtimeMs)
    } catch {
      /* 缺文件跳过 */
    }
  }
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'sync-readme-numbers.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 << 20,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], // §12g:本机不给显式 stdio 会 EBUSY
    })
  } catch (e) {
    return log(
      `⚠️ sync-readme-numbers 失败(不阻断):${String(e?.stdout || e?.message || '')
        .trim()
        .split('\n')
        .slice(-3)
        .join('\n')}`,
    )
  }
  const added = []
  for (const f of README_FILES) {
    const b = before.get(f)
    if (b === undefined) continue
    let a
    try {
      a = statSync(join(ROOT, f)).mtimeMs
    } catch {
      continue
    }
    if (a !== b && !stale.includes(f)) {
      stale.push(f)
      added.push(f)
    }
  }
  if (added.length) log(`README 生成数字已刷新,纳入本次收编:${added.join(', ')}`)
}

/**
 * 路径归一为 `/` 分隔(Windows 反斜杠形态同判;与 isCollectible 的归一法同取向)。
 */
function normSlashes(p) {
  return String(p).replace(/\\/g, '/')
}

/**
 * 落点**此刻**的工作树 blob oid(双检唯一取数出口)。
 *
 * 刻意走 face-reader 的 gitRaw(§12g 显式 stdio + 绝对路径 + safe.directory),不在本层裸起 git
 * —— 与库内 `currentOidsForFace` 用的是同一条 git 出口(`hash-object -- <path>`),两把尺同形。
 * 取不到(文件已消失/git 报错)⇒ null,由调用方按「不相等」处理(失效方向 = 少收一条,§0.10)。
 */
function worktreeBlobOid(path, root = ROOT) {
  const p = normSlashes(path)
  try {
    if (!existsSync(join(root, p))) return null
    return String(gitRaw(['hash-object', '--', p], root)).trim().toLowerCase()
  } catch {
    return null
  }
}

/**
 * 一批路径在 **HEAD 面**的 blob oid:`Map<path, oid|null>`(null = HEAD 上没有这一枚)。
 *
 * 一次 `cat-file --batch-check` 问完整批:逐路径 spawn 在 188 枚这批上就是 188 个进程。
 * `--batch-check` 对每条输入**恰好输出一行**(解不开的那行形如 `HEAD:<path> missing`),
 * 所以按输入序对齐下标即可;解不出 40 位 + `blob` ⇒ null,不猜。
 * 整批取不到 ⇒ 抛给调用方(由调用方记「未判定」,绝不把"读不到"当成"都不在 HEAD")。
 */
function headBlobOidsOf(paths, root = ROOT) {
  const out = new Map()
  if (paths.length === 0) return out
  const specs = paths.map((p) => `HEAD:${normSlashes(p)}`)
  const raw = String(
    gitRaw(['cat-file', '--batch-check=%(objectname) %(objecttype)'], root, {
      input: `${specs.join('\n')}\n`,
    }),
  )
  const lines = raw.split(/\r?\n/)
  paths.forEach((p, i) => {
    const m = /^([0-9a-f]{40}) blob\b/.exec(lines[i] ?? '')
    out.set(p, m ? m[1].toLowerCase() : null)
  })
  return out
}

/**
 * 账本收编族的准入判据(2026-11-03 立;§0.6 —— 四条准入全在库里,本函数零复算)。
 *
 * 与白名单族的关系是**并列的第二条来源通道**,不是放宽白名单:
 * 白名单(f6e0ba44a9 那次收窄是对的——旧实现无差别收编把 7 件实质回退 + 3 个半成品测试送进主干)
 * 一条也没动;本族只多认一种凭据 = 守护腿自己往落点账本申报过、且 blob 逐字节对得上的产出。
 *
 * 两道 blob 比对不是冗余:
 *   · 库内那一次发生在 `collectiblePaths` 取数的那一刻;
 *   · 本函数这最后一次发生在**交给提交通道之前**(TOCTOU 窗:守护腿可能在收编途中又改了同一枚文件)。
 *     不等 ⇒ 剔出本批并计入 contested(绝不"改过了也照收")。
 *
 * @returns {{ledger:'ok'|'unjudged', reason:string|null, collectible:object[],
 *            settled:object[], settledCheck:'ok'|'unjudged', settledCheckReason:string|null,
 *            quiet:object[], contested:object[], incomplete:object[], ignored:object[],
 *            deduped:object[]}}
 */
export function collectLedgerEntries(now = Date.now(), opts = {}) {
  const {
    quietMs = LEDGER_QUIET_MS,
    root = ROOT,
    face = 'worktree',
    whitelistPaths = new Set(),
    // 测试注入面(与 commit/logLine/busyCheck 同一取向):结清维的取数函数。生产默认走 git 一次批量问。
    headOidsOf = headBlobOidsOf,
  } = opts
  const res = collectiblePaths(now, { quietMs, face, root })
  if (!res.ok) {
    // §0.3:账本不存在 / 为空 / git 取不到 ⇒ **未判定**,不得把"取不到"当成"没有待收",
    // 也不得用它冒充绿(处置同型先例见 scripts/scrub-declared-removals.mjs 的 exit 2 档)。
    return {
      ledger: 'unjudged',
      reason: String(res.reason ?? '未给出原因'),
      collectible: [],
      settled: [],
      settledCheck: 'unjudged',
      settledCheckReason: `账本未判定:${String(res.reason ?? '')}`,
      quiet: [],
      contested: [],
      incomplete: [],
      ignored: [],
      deduped: [],
    }
  }
  const quiet = [...res.quiet]
  const contested = [...res.contested]
  const incomplete = [...res.incomplete]
  const ignored = [...res.ignored]
  const deduped = []
  const pending = []
  for (const it of res.collectible) {
    // 与白名单族命中同一路径 ⇒ **以白名单族为准**(不得重复提交同一路径;白名单族在本族之前落地)。
    if (whitelistPaths.has(normSlashes(it.path))) {
      deduped.push({ leg: it.leg, path: it.path, reason: '白名单族本轮已收同一枚,以白名单族为准' })
      continue
    }
    pending.push(it)
  }
  const collectible = []
  for (const it of pending) {
    const actual = worktreeBlobOid(it.path, root)
    if (actual === it.blobOid) {
      collectible.push(it)
      continue
    }
    contested.push({
      leg: it.leg,
      path: it.path,
      expectedOid: it.blobOid,
      actualOid: actual,
      stage: 'recheck-before-commit',
    })
  }
  /**
   * 第三道:申报内容**已在主干上**(HEAD 面 blob == 申报 blob)⇒ 这一条已经结清,
   * 不再交给提交通道(2026-11-05 立,现读实证见下面 settled 的成因)。
   *
   * 为什么必须在这里判,而不是等 safe-commit 报错:收编器把批交给 safe-commit 后,后者
   * Step 2 的 `git add -A -- <声明集>` 对这些枚**零暂存**(内容与 HEAD 一致,无 diff 可暂),
   * Step 3b 就按"预期文件未暂存"整枚退出 ⇒ **一批里混进一条已结清的,整轮 0 入库**。
   * 现读:账本 229 行 / 可收编 188 枚里 **113 枚已在 HEAD**、单轮批预算只有 100 枚 ⇒
   * 死行长期占满队列头部,真活(75 枚)永远排不进本轮 —— 这是"最后一公里冻结"的第二层
   * 根因(第一层是别席暂存件连坐的复活闸,已同日收口)。
   *
   * 失效方向(§0.10):HEAD 面整批取不到 ⇒ 一条也不剔(`settledCheck='unjudged'` 进结论行),
   * 宁可让这一轮继续撞 safe-commit 的显式报错,也不"读不到就当已结清"把真活静默丢掉。
   */
  const settled = []
  let settledCheck = 'ok'
  let settledCheckReason = null
  let headOids = null
  try {
    headOids = headOidsOf(
      collectible.map((c) => c.path),
      root,
    )
  } catch (e) {
    settledCheck = 'unjudged'
    settledCheckReason = String(e?.message ?? e).split('\n')[0]
  }
  if (headOids) {
    const stillOpen = []
    for (const it of collectible) {
      const head = headOids.get(it.path) ?? null
      if (head && head === String(it.blobOid).toLowerCase()) settled.push(it)
      else stillOpen.push(it)
    }
    collectible.length = 0
    collectible.push(...stillOpen)
  }
  return {
    ledger: 'ok',
    reason: null,
    collectible,
    settled,
    settledCheck,
    settledCheckReason,
    quiet,
    contested,
    incomplete,
    ignored,
    deduped,
  }
}

/**
 * 批内出现的 `apps/<端>` 段数(账本族标题的输入)。
 *
 * 口径比门 check-commit-scope-consistency 的 R3 **更严**(R3 只数 PATH_TO_AREA 映射得到的端,
 * 这里数所有 `apps/*` 首段)⇒ 只会更早降级成无 scope 聚合形态,绝不会更晚。
 * 刻意**不 import** 那枚门:它模块顶层就有 `HUSKY_SKIP_SCOPE_CHECK=1 ⇒ process.exit(0)`,
 * 被本器静态 import 会让"带应急变量跑收编器"变成静默零动作(§0.9 的哑臂型失效)。
 * 本函数只用于**摆对批次**,不削任何一道判据(与 `autoCommitMessages` 那一刀同取向)。
 */
export function appsSegmentsOf(paths) {
  const segs = new Set()
  for (const p of paths) {
    const m = /^apps\/([^/]+)\//.exec(normSlashes(p))
    if (m) segs.add(m[1])
  }
  return segs.size
}

/**
 * 账本族的提交标题(与白名单族**不同批次、不同标题**)。
 *
 * 形态全部取自本仓既有高频合法形态(现读 `git log` 近 500 枚:`chore(cross-end):` 40 枚、
 * `chore(i18n):` 6 枚、无 scope 的 `chore:` 是 R3 明文允许的聚合形态),不自创 type/scope:
 *   · i18n messages 批 ⇒ `chore(i18n):`(R2 对"含 packages/i18n/messages/ 且 scope≠i18n"无条件红);
 *   · 非 i18n 批且跨 ≥3 个 apps 端 ⇒ 降为 `chore:`(R3 对显式非跨切 scope 判红);
 *   · 其余 ⇒ `chore(cross-end):`。
 */
export function ledgerCommitMessage(paths, kind = 'rest') {
  const body = `收编守护落档产出(${paths.length} 件,凭落点账本)`
  if (kind === 'i18n') return `chore(i18n): ${body}`
  return appsSegmentsOf(paths) >= 3 ? `chore: ${body}` : `chore(cross-end): ${body}`
}

/**
 * 机读结论行(§0.3 失败方向诚实):未判定 ⇒ `ledger=unjudged` 且 `reason=` 点名,
 * 绝不把"取不到"写成"没有待收";各桶逐条报数,不只报一个总数。
 */
export function ledgerConclusionLine(r) {
  const parts = [
    'COLLECT-RESULT',
    `ledger=${r.ledger}`,
    `collected=${r.collected}`,
    `whitelistCollected=${r.whitelistCollected}`,
    `ledgerCollected=${r.ledgerCollected}`,
    `quiet=${r.quiet}`,
    `contested=${r.contested}`,
    `incomplete=${r.incomplete}`,
    `ignored=${r.ignored}`,
    `deduped=${r.deduped}`,
    `held=${r.held}`,
    // 2026-11-05 补两键(§0.3:挑了 N 枚 ≠ 入库 N 枚。此前失败也被计进 collected,
    // 于是"被无关全局面红门整批拦死"在机读面上与"收得很顺"同形。加在行尾,既有前缀解析不受影响。)
    `blocked=${r.blocked ?? 0}`,
    `dry=${r.dry ? 'true' : 'false'}`,
  ]
  if (r.reason) parts.push(`reason=${r.reason}`)
  // 身份位 blocker 必须是稳定类别(§5e-3 寄信去重按它);认不出精确门名时,摘要走 hint
  // —— 摘要含路径/文案,进身份会造成寄信风暴,所以只作附列供人读。
  if (r.blocker) parts.push(`blocker=${r.blocker}`)
  if (r.hint) parts.push(`hint=${r.hint}`)
  /**
   * 结清维(2026-11-05 立,同 `blocked/blocker/hint` 的先例只加行尾、不动前缀):
   * `settled=N` 存在即证明本轮**量过**"申报内容是否已在 HEAD";白名单族那一类结论没有这一维
   * 就整键缺席(缺席 = 没测,不得用 settled=0 冒充"测过且都还活着")。
   * HEAD 面取不到时额外写 `settledCheck=unjudged`(§0.3:未判定要有机读面)。
   */
  if (typeof r.settled === 'number') parts.push(`settled=${r.settled}`)
  if (r.settledCheck === 'unjudged') parts.push('settledCheck=unjudged')
  return parts.join(' ')
}

/**
 * 结论行 stdout 臂的开关(§22d 同取向):只有直跑形态置 true,被 import 时绝不写调用方 stdout。
 * `stdoutConclusionWritten` 保证一轮至多一行 —— 异常兜底不得在已出行的轮次上叠第二行。
 */
let conclusionStdoutEnabled = false
let stdoutConclusionWritten = false

function setConclusionStdout(on) {
  conclusionStdoutEnabled = !!on
  if (!on) stdoutConclusionWritten = false
}

/**
 * 本器**唯一**的结论出口(2026-11-03 立,§0.3):每一条退出路径(让路/无候选/取不到输入/异常)
 * 都必须经由它出结论行 —— 形态仍由 `ledgerConclusionLine` 现产(键集与前缀不改、不加,§0.6),
 * 文件日志走 logLine(默认 log;测试注入面),直跑形态再补一行 stdout 给消费者(runLegChild)。
 */
function emitConclusion(r, logLine = log) {
  const line = ledgerConclusionLine(r)
  logLine(line)
  if (conclusionStdoutEnabled && !stdoutConclusionWritten) {
    stdoutConclusionWritten = true
    process.stdout.write(`${line}\n`)
  }
  return line
}

/** 结论行的默认形态:每个键都是数(不得让 undefined 漏进机读面),覆写只填差异。 */
function baseConclusion(over = {}) {
  return {
    ledger: 'ok',
    collected: 0,
    whitelistCollected: 0,
    ledgerCollected: 0,
    quiet: 0,
    contested: 0,
    incomplete: 0,
    ignored: 0,
    deduped: 0,
    held: 0,
    blocked: 0,
    blocker: null,
    hint: null,
    dry: DRY,
    reason: null,
    ...over,
  }
}

/**
 * busy 让路必须分得清是哪一路(两型都是"被让路"却成因不同;机读面一个 token,不带空格)。
 * 取值 = `busy-index-lock` / `busy-pre-commit-log`(§0.3:失效方向是多要一次点名,不是"skipped")。
 */
function classifyBusy(busy) {
  return String(busy).includes('index.lock') ? 'busy-index-lock' : 'busy-pre-commit-log'
}

/**
 * 白名单族的唯一出口笔:把"本轮不提交"的**具体形态码**记账进 tally,轮级结论行由
 * `runLedgerFamily`(main 的 finally 担保每轮都跑)经 `emitConclusion` 一并出 ——
 * 白名单族体内自此不得再有静默 return(§0.3)。`line` 只进文件日志,细节不挤进机读行。
 */
function exitWhitelist(tally, code, line = null) {
  if (line) log(line)
  if (code && !tally.reasons.includes(code)) tally.reasons.push(code)
  return line
}

/** 复洁器回带的机读读数;未回带 ⇒ null(调用方必须让路,不得当成绿)。 */
function parseScrubOutcome(text) {
  const m = /state=(\w+) dropped=(\d+)/.exec(String(text ?? ''))
  if (!m) return null
  const ar = /archive=(\d+)/.exec(String(text ?? ''))
  return { state: m[1], dropped: Number(m[2]), archive: ar ? Number(ar[1]) : null }
}

/**
 * 账本族的活文档护栏:命中 HUMAN_LEDGER_RE 的那几枚必须走**与白名单族同一批器物**
 * (mergeLiveDoc → scrub-declared-removals[--archive-disposition] → 归档单调性 → 已结清行闸),
 * 任一不达标就让路并回滚工作树副本 —— 新通道不得成为绕过这些护栏的第二条入库路径(§0.10)。
 */
function guardLedgerLiveDocPath(path, { root = ROOT, logLine = log } = {}) {
  const snap = snapshotLedger(path, root)
  const dispRel = writeDispositionSnapshot(path, snap, root)
  const r = mergeLiveDoc(path, root)
  if (!r.ok) {
    rollbackLedger(path, snap, `账本族归并未达标:${r.why}`, root)
    return { ok: false, why: `归并未达标:${r.why}` }
  }
  let outcome
  try {
    const sr = execFileSync(
      process.execPath,
      [
        join(root, 'scripts', 'scrub-declared-removals.mjs'),
        path,
        ...(dispRel ? ['--archive-disposition', dispRel] : []),
      ],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 << 20,
        timeout: 120000,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    outcome = parseScrubOutcome(sr)
  } catch (e) {
    const why = String(e?.stdout || e?.message || '')
      .trim()
      .split('\n')
      .slice(-2)
      .join(' / ')
    rollbackLedger(path, snap, `账本族复洁失败:${why}`, root)
    return { ok: false, why: `复洁失败:${why}` }
  }
  if (!outcome) {
    rollbackLedger(path, snap, '账本族复洁未回带机读行', root)
    return { ok: false, why: '复洁未回带机读行 ⇒ 本轮不收编' }
  }
  // 归档批次维放过行 = 归并把"只在盘上、HEAD 面尚未入库"的迁出批次插回来了 ⇒ 让路(同白名单族那一档)。
  if (outcome.archive && outcome.archive > 0) {
    rollbackLedger(path, snap, '账本族归档批次维放行', root)
    return { ok: false, why: `归并插回 ${outcome.archive} 行已迁入 archive 的批次 ⇒ 不收编` }
  }
  if (path.endsWith('PROJECT_PLAN.md')) {
    const mono = checkArchiveMonotonic(root)
    if (!mono.ok) {
      rollbackLedger(path, snap, `账本族归档单调性判红:${mono.why}`, root)
      return { ok: false, why: `归档单调性未通过:${mono.why}` }
    }
    const faces = ledgerFaces(path, root)
    const g = closedRowRegressions(faces.head, faces.candidate)
    if (g.undetermined || !g.ok) {
      rollbackLedger(path, snap, '账本族已结清行闸未过', root)
      return {
        ok: false,
        why: g.undetermined ? '已结清行闸未判定' : `候选回退 ${g.regressions.length} 条已结清行`,
      }
    }
  }
  logLine(`账本族活文档护栏通过(${path}):归并 lost=0 / 复洁 state=${outcome.state}`)
  return { ok: true }
}

/**
 * 账本族的执行段:取凭据 → 过既有护栏 → 分批切 i18n → 交 safe-commit → 打机读结论行。
 *
 * 提交通道**只有一条** = 既有的 commitBatch(spawn safe-commit.mjs,全门冻结索引),
 * 本器不自带 push 腿(推送仍交 post-commit 的 git-push-guard,契约与白名单族一致);
 * `commit` 形参是测试注入面(默认就是生产那一条),不是第二套通道。
 */
export function runLedgerFamily(opts = {}) {
  const {
    now = Date.now(),
    quietMs = LEDGER_QUIET_MS,
    root = ROOT,
    face = 'worktree',
    maxPaths = MAX_PATHS,
    dry = DRY,
    whitelistPaths = new Set(),
    whitelistCollected = 0,
    whitelistHeld = 0,
    whitelistReasons = [],
    whitelistBlocked = 0,
    whitelistBlocker = null,
    whitelistHint = null,
    commit = commitBatch,
    logLine = log,
    busyCheck = guardBusy,
    liveDocGuard = guardLedgerLiveDocPath,
  } = opts

  const emit = (r) => {
    emitConclusion(r, logLine)
    return r
  }

  const entries = collectLedgerEntries(now, { quietMs, root, face, whitelistPaths })
  const counts = {
    quiet: entries.quiet.length,
    contested: entries.contested.length,
    incomplete: entries.incomplete.length,
    ignored: entries.ignored.length,
    deduped: entries.deduped.length,
    // 已在主干上的申报(结清件):它们**不占批预算**、也不该再交通道(见 collectLedgerEntries 第三道)。
    settled: entries.settled.length,
    settledCheck: entries.settledCheck,
    // 两族合计的"被拦枚数 + 拦路者"(挑了 N 枚 ≠ 入库 N 枚;被拦不许并进 held —— held 的既有
    // 语义是归属未明/活文档让路,与"门把整批拦死"是两回事,合并就读不回成因)。
    blocked: whitelistBlocked,
    blocker: whitelistBlocker,
    hint: whitelistHint,
  }
  // 轮级结论行的 reason = 白名单族形态码 + 本族形态码(无空格 '+' 连接;取不到任何
  // 让路形态 ⇒ null,行内不写 reason 键,与既有形态同形)。held 同样两族合计。
  const joinReason = (r) => {
    const parts = [...whitelistReasons]
    if (r) parts.push(r)
    return parts.length ? parts.join('+') : null
  }
  const withCounts = (over) =>
    emit({
      dry,
      ledger: entries.ledger,
      whitelistCollected,
      ...counts,
      ...over,
      held: (over.held ?? 0) + whitelistHeld,
      reason: joinReason(over.reason),
    })

  if (entries.ledger !== 'ok') {
    logLine(
      `账本族未判定(不收编任何一条,也不是"没有待收"):${entries.reason}(当轮账本 = ${normSlashes(ledgerPathFor(root))})`,
    )
    return withCounts({
      ledger: 'unjudged',
      reason: entries.reason,
      collected: whitelistCollected,
      ledgerCollected: 0,
      held: 0,
    })
  }
  if (counts.deduped) {
    logLine(
      `账本族去重让路 ${counts.deduped} 枚(白名单族为准):${entries.deduped
        .slice(0, 8)
        .map((d) => d.path)
        .join(', ')}`,
    )
  }
  const named = (list, key = 'path') =>
    list
      .slice(0, 8)
      .map((it) => `${it[key]}${it.leg ? `(${it.leg})` : ''}${it.stage ? `[${it.stage}]` : ''}`)
      .join(', ')
  // 四桶逐条点名排在**任何早退之前**:只报总数就等于没点名(事故面恰恰是"改过了还照收"),
  // 而可收编集为空时更要让人看见"为什么这一轮一条都没收"。
  if (counts.contested)
    logLine(`账本族 contested 逐条点名:${named(entries.contested)}${counts.contested > 8 ? ' …' : ''}`)
  if (counts.quiet)
    logLine(`账本族 quiet(未到静默期)逐条点名:${named(entries.quiet)}${counts.quiet > 8 ? ' …' : ''}`)
  if (counts.incomplete)
    logLine(
      `账本族 incomplete(键/形状不正)逐条点名:${entries.incomplete
        .slice(0, 8)
        .map((it) => `${it.path}[缺 ${Array.isArray(it.missingFields) ? it.missingFields.join('+') : '?'}]`)
        .join(', ')}${counts.incomplete > 8 ? ' …' : ''}`,
    )
  if (counts.ignored)
    logLine(`账本族 ignored(被 .gitignore 覆盖)逐条点名:${named(entries.ignored)}${counts.ignored > 8 ? ' …' : ''}`)
  // 结清件也要点名:它们从批里出去了,读结论行的人必须能看出"少交的那些枚去哪了",
  // 而不是把它们当成"本轮没排到"。
  if (counts.settled)
    logLine(
      `账本族 settled(申报内容已在 HEAD ⇒ 已结清,不再交通道)逐条点名:${named(entries.settled)}${counts.settled > 8 ? ' …' : ''}`
    )
  if (counts.settledCheck === 'unjudged')
    logLine(
      `账本族结清维未判定(${entries.settledCheckReason ?? 'HEAD 面 blob 取不到'})⇒ 本轮一条都不剔,照旧交给通道(§0.10:读不到不许当已结清)`,
    )

  if (entries.collectible.length === 0) {
    return withCounts({
      collected: whitelistCollected,
      ledgerCollected: 0,
      held: 0,
      // "整批都已在 HEAD"与"账本里根本没有可收的申报"是两件事:前者说明守护腿这一轮的产出
      // 已全部入库(好消息),后者说明无人申报(要查派发)。合并成一个码就读不回成因。
      reason: counts.settled ? 'ledger-all-settled' : 'no-ledger-collectible',
    })
  }

  // 既有护栏之一:busy 闸(index.lock / 守门批正在写)在**落地前**再问一次 ——
  // 取凭据与活文档护栏都要花时间,不能拿开跑那一刻的读数担保落地这一刻。
  const busy = busyCheck()
  if (busy) {
    logLine(`账本族让路:${busy}(可收编 ${entries.collectible.length} 枚本轮不提交,下一轮自然重来)`)
    return withCounts({
      collected: whitelistCollected,
      ledgerCollected: 0,
      held: entries.collectible.length,
      reason: classifyBusy(busy),
    })
  }

  // 活文档护栏(同批器物):命中 HUMAN_LEDGER_RE 的逐条过链,不达标即让路。
  const paths = []
  let held = 0
  for (const it of entries.collectible) {
    const p = normSlashes(it.path)
    if (HUMAN_LEDGER_RE.test(p)) {
      const g = liveDocGuard(p, { root, logLine })
      if (!g.ok) {
        logLine(`账本族不收编活文档(${p}):${g.why}`)
        held += 1
        continue
      }
    }
    paths.push(p)
  }
  if (paths.length === 0)
    return withCounts({
      collected: whitelistCollected,
      ledgerCollected: 0,
      held,
      reason: 'livedoc-held',
    })

  // 既有护栏之一:MAX_PATHS 分批(命令行长度,见模块级定义处注释)。
  let batch = paths
  if (paths.length > maxPaths) {
    batch = paths.slice(0, maxPaths)
    logLine(
      `账本族候选 ${paths.length} 个超过单轮上限 ${maxPaths}(命令行长度),本轮只收 ${batch.length} 个,余量下一轮`,
    )
    held += paths.length - batch.length
  }

  if (dry) {
    logLine(`dry-run:账本族可收编 ${batch.length} 枚不提交:${batch.slice(0, 8).join(', ')}`)
    return withCounts({ collected: whitelistCollected, ledgerCollected: 0, held })
  }

  // 既有护栏之一:i18n / 非 i18n 切两批(同 autoCommitMessages 那一刀的判据来源)。
  const { i18n, rest } = partitionI18nBatch(batch)
  // 2026-11-05:`landed` 只认提交真成功的那批(此前无论成败都 += 本批枚数 ⇒ 结论行把"被拦死"
  // 报成"收了 N 枚")。被拦的枚数单列 blocked 并点名拦路者,不许并进 held(held 的既有语义是
  // "归属未明/活文档让路",与"门拦了"是两回事,合并就读不回成因)。
  let landed = 0
  let blocked = 0
  let blocker = null
  let hint = null
  for (const [list, tag] of [
    [i18n, 'i18n'],
    [rest, 'rest'],
  ]) {
    if (!list.length) continue
    const r = commit(list, ledgerCommitMessage(list, tag), root) ?? {}
    const done = typeof r.landed === 'number' ? r.landed : 0
    const tried = typeof r.attempted === 'number' ? r.attempted : list.length
    landed += done
    if (tried - done > 0) {
      blocked += tried - done
      blocker ??= r.blocker ?? 'unidentified'
      hint ??= r.hint ?? null
    }
  }
  if (blocked)
    logLine(
      `⛔ 账本族本轮被拦 ${blocked} 枚(拦路者=${blocker}${hint ? ` 摘要=${hint}` : ''})⇒ 这些枚仍在盘上未入库,下一轮仍会重来`,
    )
  logLine(`账本族已交 safe-commit:${landed} 枚(推送交 post-commit 的 git-push-guard,本器不带 push 腿)`)
  return withCounts({
    collected: whitelistCollected + landed,
    ledgerCollected: landed,
    held,
    blocked: whitelistBlocked + blocked,
    blocker: whitelistBlocker ?? blocker,
    hint: whitelistHint ?? hint,
  })
}

/**
 * 收编器的两条来源通道(2026-11-03 定型,机主令"守护写盘 → 账本凭据 → 收编入库"接到底):
 *   ① 白名单族 = 既有 `COLLECT_WHITELIST`(f6e0ba44a9 那次收窄**一条未动**,放宽白名单是本任务的红线);
 *   ② 账本族 = 守护写盘腿自己往落点账本申报过、且落点 blob 逐字节对得上的产出("验过才收")。
 * 两族各自成批、各自标题、互不干扰;②刻意跑在①之后 —— ①体内有多处结构性早退
 * (`changes.length===0` / `stale.length===0` / `DRY` / 归并后空集…),挂在它后面会被它的空候选
 * 一起短路掉,所以用 `finally` 担保②每轮都被跑到(§0.9:造好没装车 = 没有)。
 */
function main() {
  const busy = guardBusy()
  if (busy) {
    log(`跳过:${busy}`)
    return emitConclusion(baseConclusion({ ledger: 'unjudged', reason: classifyBusy(busy) }))
  }

  const tally = { collected: 0, paths: new Set(), held: 0, reasons: [], blocked: 0, blocker: null, hint: null }
  try {
    runWhitelistFamily(tally)
  } finally {
    runLedgerFamily({
      whitelistPaths: tally.paths,
      whitelistCollected: tally.collected,
      whitelistHeld: tally.held,
      whitelistReasons: [...tally.reasons],
      whitelistBlocked: tally.blocked,
      whitelistBlocker: tally.blocker,
      whitelistHint: tally.hint,
    })
  }
}

/** 白名单族(既有收编链,判据与顺序一字未改;只是从 main 拆出来,并向下族交回本轮计数)。 */
/**
 * 活文档拒收后的**唯一**再发令判据(2026-11-05 立,现读实证)。
 *
 * 事故形态不是"判据太严",是**准备与发令之间的窗**:本器 22:01:31 刚把 README 归并到
 * `lost=0 / 长行重复新增 0`(机读行就在同一份日志里),22:02:29 safe-commit Step 3e 复跑
 * 同一把尺却判红 —— 这 58 秒里别的席位又推进了 HEAD。活文档的"已准备好"天然是**会过期的凭据**。
 * 人是 agent 会"再 merge 一次再提交",器物此前不会 ⇒ 同一批 13 枚连续多轮原地空转。
 *
 * 纪律三条:① 只对 `live-doc-line-loss` 这一类生效(别的拦路者一律不重发,更不是跳门);
 * ② 批内没有活文档路径 ⇒ 不重发(说明红来自别处,重发只会掩盖);
 * ③ 重备未达标(lost≠0 / 长行重复新增≠0)⇒ **不重发**并逐枚点名,不得用重试掩盖真丢失。
 * 通过三条才允许**再一次**发令(调用方拿到 retry=true 后只 commit 一次,不做循环)。
 */
export function liveDocRetryPlan({
  blocker = null,
  paths = [],
  root = ROOT,
  merge = mergeLiveDoc,
} = {}) {
  if (blocker !== 'live-doc-line-loss') return { retry: false, docs: [], notReady: [] }
  const docs = (paths ?? []).filter((p) => HUMAN_LEDGER_RE.test(normSlashes(p)))
  if (docs.length === 0) return { retry: false, docs, notReady: [] }
  const notReady = []
  for (const f of docs) {
    const g = merge(f, root)
    if (!g?.ok) notReady.push(`${f}:${g?.why ?? '未给出原因'}`)
  }
  return { retry: notReady.length === 0, docs, notReady }
}

function runWhitelistFamily(
  tally = {
    collected: 0,
    paths: new Set(),
    held: 0,
    reasons: [],
    blocked: 0,
    blocker: null,
    hint: null,
  },
  { root = ROOT, commit = commitBatch, retryPlan = liveDocRetryPlan, logLine = log } = {},
) {
  const rawChanges = listChanges().filter((c) => !isExcluded(c.path))
  // 路径白名单(2026-11-02,fail-safe):白名单外的改动一律不收编,只记日志留给人清;
  // 无法判定归属的路径同样落进 held —— 宁可悬挂,也不再替别的席位提交业务代码/测试。
  const changes = rawChanges.filter((c) => isCollectible(c.path))
  const held = rawChanges.filter((c) => !isCollectible(c.path))
  tally.held = held.length
  if (held.length) {
    log(
      `白名单外 ${held.length} 个路径不收编(留给人清):${held
        .slice(0, 8)
        .map((c) => c.path)
        .join(', ')}${held.length > 8 ? ' …' : ''}`,
    )
  }
  if (changes.length === 0)
    return exitWhitelist(tally, rawChanges.length === 0 ? 'no-changes' : 'no-whitelist-hits')

  const conflicted = changes.filter((c) => /^(UU|AA|DD|AU|UA|DU|UD)$/.test(c.xy))
  if (conflicted.length)
    return exitWhitelist(
      tally,
      'whitelist-conflicted',
      `跳过:有未解决冲突 ${conflicted.map((c) => c.path).join(',')}`,
    )

  const now = Date.now()
  let youngest = Infinity
  const stale = []
  const deleted = []
  for (const c of changes) {
    // 删除**永不**自动收编(2026-10-22 实证):删除件没有 mtime 可判"停止呼吸",旧实现按
    // ageMin=Infinity 直接收,于是别的席位刚暂存的 `D scripts/lib/gate-scope.mjs` 立刻被本器
    // 当候选提交 —— 而 runner 仍 import 它,提交即等于把整条守门链打断(靠 pre-commit 崩在
    // ERR_MODULE_NOT_FOUND 才拦住)。删除是"删错一枚就断链"的一类,交人工确认后显式声明。
    if (/D/.test(c.xy)) {
      deleted.push(c.path)
      continue
    }
    const abs = isAbsolute(c.path) ? c.path : join(ROOT, c.path)
    let ageMin
    try {
      ageMin = (now - statSync(abs).mtimeMs) / 60_000
    } catch {
      continue // 刚被移除/改名:状态已过期,本轮不碰
    }
    youngest = Math.min(youngest, ageMin)
    if (ageMin >= QUIET_MIN) stale.push(c.path)
  }
  if (deleted.length) log(`跳过删除(不自动收编,请人工确认后显式声明):${deleted.join(', ')}`)
  if (stale.length === 0) return exitWhitelist(tally, 'not-quiet')

  // 活文档先归并,再把归并达标的收编(2026-10-22:替代"永不收编"——后者会让改动永久悬挂)。
  if (!DRY) {
    for (const f of [...stale].filter((p) => HUMAN_LEDGER_RE.test(p))) {
      // 写盘前快照(2026-10-24):下面三步都是"先写盘、后判定",判定红时若不回滚,
      // "本轮不收编"只保住了历史,工作树副本仍被写脏 —— 那正是 16:00/16:06/16:09 三次
      // 回插事故里污染扩散到下一席位的原因。
      const snap = snapshotLedger(f)
      // 处置侧快照(2026-10-28,票 gb22):归并档比的是 HEAD ↔ 工作树,而体积清偿在飞的窗口里
      // HEAD 还是未压版 ⇒ 被有意搬走的行会被判成"真丢失"插回。把归并前的工作树交给复洁器,
      // 它才能把"本轮归并插回的迁出行"和"别人真新增的行"分开。PROJECT_PLAN 一族不传(红线)。
      const dispRel = writeDispositionSnapshot(f, snap)
      /** 只在判定红时回滚;判定绿则保留本器写盘(归并/复洁的正当产物)。 */
      const revertIfRed = (why) => {
        if (!f.endsWith('PROJECT_PLAN.md')) return
        const mono = checkArchiveMonotonic()
        if (mono.ok) return
        rollbackLedger(f, snap, `${why} ⇒ ${mono.why}`)
      }
      const r = mergeLiveDoc(f)
      if (r.ok) {
        // 归并达标≠可以收编:工作树滞后副本里那些"已被声明式摘除"的旧行,归并档看不见
        // (它只判不丢行/不重复),会被当成本轮改动收编回去 —— 实测四枚已结清登记行因此整批复活。
        // 收编前先按摘除台账把这些行剔掉;器物判不出一律不剔(宁可留一轮噪音)。
        try {
          const sr = execFileSync(
            process.execPath,
            [
              join(ROOT, 'scripts', 'scrub-declared-removals.mjs'),
              f,
              ...(dispRel ? ['--archive-disposition', dispRel] : []),
            ],
            {
              cwd: ROOT,
              encoding: 'utf8',
              maxBuffer: 64 << 20,
              timeout: 120000,
              stdio: ['ignore', 'pipe', 'pipe'],
              windowsHide: true,
            },
          )
          const m = /state=(\w+) dropped=(\d+)/.exec(String(sr ?? ''))
          const ar = /archive=(\d+)/.exec(String(sr ?? ''))
          log(
            `活文档摘除台账复洁(${f}): ${m ? `${m[1]} dropped=${m[2]}${ar ? ` archive=${ar[1]}` : ''}` : '未回带机读行 ⇒ 本轮不收编'}`,
          )
          if (!m) {
            revertIfRed('复洁未回带机读行')
            stale.splice(stale.indexOf(f), 1)
            continue
          }
          // 归档批次维放过行 = 本轮归并确实把"已按 §1 逐字迁入 archive 的迁出批次"插回来了,而该批次
          // 此刻只在盘上、不在 HEAD 面 ⇒ 现在收编会把清偿成果第二次写回历史。让路给文档所有者:
          // 工作树已被复洁回到处置那一版(不是被插回的那一版),本器不再碰它,同批归档件与正文一起落库
          // 之后下一轮自然无滞留。失效方向恒为"多要一次落库",绝不是"多放一次收编"。
          if (ar && Number(ar[1]) > 0) {
            log(
              `活文档让路(${f}):本轮归并插回 ${ar[1]} 行"已逐字迁入 archive 的迁出批次"(凭据只在盘上、HEAD 面尚未入库)⇒ 不收编,留给文档所有者与同批归档件一起落库`,
            )
            stale.splice(stale.indexOf(f), 1)
            continue
          }
        } catch (e) {
          log(
            `活文档摘除台账复洁失败(${f}),本轮不收编:${String(e?.stdout || e?.message || '')
              .split('\n')
              .slice(-2)
              .join(' / ')}`,
          )
          revertIfRed('复洁失败')
          stale.splice(stale.indexOf(f), 1)
          continue
        }
        // 归档单调性自检(2026-10-23 新增,承当日实测事故):归并只补"丢行",对"已归档(✅)票被旧快照
        // 展开回未勾活行"零覆盖 —— 实测工作区副本这样回插 29+/16- 后被本器整批收编进历史。收编前按
        // 门 237 同一把尺子审磁盘面(判据只有那一份实现);红即让路,不在本器里"先修后收编"。
        if (f.endsWith('PROJECT_PLAN.md')) {
          const mono = checkArchiveMonotonic()
          if (!mono.ok) {
            log(`活文档归档单调性未通过(${f}),本轮不收编:${mono.why}`)
            // 已实锤的污染态:回滚到本轮开跑前的副本,不让本器的归并/复洁写盘留在磁盘上。
            rollbackLedger(f, snap, `本轮归并/复洁后归档单调性判红:${mono.why}`)
            stale.splice(stale.indexOf(f), 1)
            continue
          }
        }
        // 已结清行回退闸(2026-10-25 新增,承当日 16:25 收编事故):merge-live-doc 只判"丢行/长行
        // 重复",判不出"HEAD 已勾的登记行在工作树副本里被原地写回 `- [ ]`"(行数不变、一行不丢,
        // 归并档结构性看不见);归档单调性只管 ✅ 标题复活,不管勾选态。
        // 两型回退源都在本闸射程内(根因与取证见 scripts/lib/ledger-closed-rows.mjs 头注):
        // ① 混合体(旧副本⊕本地小改)——整份文本不等于任何祖先 blob,dropStaleCopies 的整片臂判不了
        //    (2026-11-01 起多了一条 isPartialRevert 删占比臂,但它是"批量丢行"的尺寸启发式,
        //    判不出"只勾了几行被写回 `- [ ]`"这种一行级回退 ⇒ 本闸对勾选态仍是唯一精确的那把尺);
        // ② 整份旧 blob 覆盖——dropStaleCopies 能拦(2026-10-29 起它审**全部**候选:旧的那条
        //    "已暂存=明确意图"豁免正是 b44ab834609 回退守卫②的入口,而落地走 safe-commit 的
        //    `git add -A`,提交的是工作树字节,与谁暂存过无关),但整片臂只回溯该路径最近 40 枚提交,
        //    而本闸按**盘上文本 vs HEAD blob** 判勾选态,不受"副本多老"影响。
        // 位置刻意选在**归并+复洁之后、safe-commit 之前**的最后一档:①候选文本此刻就是即将入库
        // 的那一份(复洁只剔 HEAD 面已不存在的行,动不到本闸的主键面);②放到归并之前会把"归并
        // 本来能补回的行"误判成回退;③与归档单调性同层,任何一道红都在同一处回滚 + 退出候选。
        if (f.endsWith('PROJECT_PLAN.md')) {
          const { head, candidate } = ledgerFaces(f)
          const g = closedRowRegressions(head, candidate)
          if (g.undetermined) {
            log(`活文档已结清行闸未判定(${f}):HEAD/候选取不到或为空 ⇒ 本轮不收编、不写盘`)
            rollbackLedger(f, snap, '已结清行闸未判定')
            stale.splice(stale.indexOf(f), 1)
            continue
          }
          if (!g.ok) {
            const named = g.regressions.slice(0, 10).map((r) => `${r.key}(HEAD L${r.line})`)
            const more =
              g.regressions.length > named.length
                ? ` …另有 ${g.regressions.length - named.length} 条`
                : ''
            log(`活文档已结清行回退(${f}),本轮不收编:${named.join(' / ')}${more}`)
            rollbackLedger(f, snap, `候选把 ${g.regressions.length} 条已结清行写回未勾/抹掉`)
            stale.splice(stale.indexOf(f), 1)
            continue
          }
          log(
            `活文档已结清行闸通过(${f}):HEAD 面 ${g.headClosed} 个已结清主键仍全部在候选已勾集中(${g.candidateClosed})`,
          )
        }
        log(`活文档归并完成(${f}):lost=0 / 长行重复新增 0,可收编`)
      } else {
        log(`活文档归并未达标(${f}),本轮不收编:${r.why}`)
        revertIfRed('归并未达标')
        stale.splice(stale.indexOf(f), 1)
      }
    }
    if (stale.length === 0) return exitWhitelist(tally, 'livedoc-held-empty')
  }

  const verb = youngest === Infinity ? '全部已删除' : `最年轻 ${youngest.toFixed(1)} 分钟`
  log(
    `候选 ${stale.length}/${changes.length} 个文件(${verb},阈值 ${QUIET_MIN} 分钟):${stale.slice(0, 8).join(', ')}${stale.length > 8 ? ' …' : ''}`,
  )
  if (DRY) return exitWhitelist(tally, 'whitelist-dry-run', 'dry-run:不提交')

  // 滞后副本/删除档死件守卫(2026-10-31 重新接线):判据与装车锁(T6)2026-10-29 就写好了,
  // 但 main 里的接线被后续某次副本覆盖洗掉 —— 守卫整个悬空,aboutPageSections 第四次回潮
  // (7a47524b07)即此通道,T6 一直红着没人修(教训:镜像测试红了必须有人读)。
  //   ① 工作树 blob == 该路径任一祖先 blob ⇒ 滞后副本(旁路落地只推进 HEAD 不写工作树的残留);
  //   ② HEAD 无此文件但 git log --diff-filter=A 证得到曾入库 ⇒ 删除档死件回潮(不再 fail-open)。
  // 失效方向仍是「少收编一次」:skipped 留在工作树,交删除意图账 / 归属席位显式处置(§0.10)。
  {
    const { kept, skipped, why } = dropStaleCopies(stale, changes)
    if (skipped.length) {
      log(
        `跳过滞后副本(留在工作树,交删除意图账/归属席位显式处置):${skipped
          .map((p) => `${p}${why?.get?.(p) ? ` [${why.get(p)}]` : ''}`)
          .join(', ')}`,
      )
      if (kept.length === 0) return exitWhitelist(tally, 'stale-copy-held-empty')
      stale.length = 0
      stale.push(...kept)
    }
  }

  syncReadmeNumbers(stale) // 先刷数字,再把真写盘的 README 纳入
  // 命令行长度上限(2026-10-24 实测):脏件到 620 个时,整批 pathspec 传给 safe-commit 会在
  // Windows CreateProcess 处撞 ENAMETOOLONG(日志连续多轮 `spawnSync ... ENAMETOOLONG`),
  // 于是"自动收编"整器空转、改动永久悬挂。改为每轮只收前 N 个,余量下一轮接着收 ——
  // 契约不变(全部过期改动最终都会被收编),只是把一次提交拆成多轮。
  // README 必须留在本批:sync 已把数字刷进工作树,不带它提交会让门 173 在下一枚提交必红。
  // (上限常量本身提到模块级 = MAX_PATHS,因为**账本族也必须吃同一刀**;注释原文留在原位。)
  if (stale.length > MAX_PATHS) {
    const keep = stale.filter((f) => README_FILES.includes(f))
    const rest = stale.filter((f) => !README_FILES.includes(f))
    const picked = rest.slice(0, Math.max(0, MAX_PATHS - keep.length))
    log(
      `候选 ${stale.length} 个超过单轮上限 ${MAX_PATHS}(命令行长度),本轮只收 ${picked.length + keep.length} 个,余量下一轮`,
    )
    stale.length = 0
    stale.push(...picked, ...keep)
  }

  const { i18n: i18nPaths, rest: restPaths } = partitionI18nBatch(stale)
  const msgs = autoCommitMessages(QUIET_MIN)
  // 把本轮白名单族的集计交回调用方:①账本族据此去重(同路径以白名单族为准,绝不重复提交);
  // ②总结论行的 `collected=` 才是"两族合计"而不是本族自说自话。
  for (const p of [...i18nPaths, ...restPaths]) tally.paths.add(normSlashes(p))
  // 同一条诚实性判据:白名单族也只认提交真成功的枚数(旧形态先赋 collected 再提交,成败都一样)。
  let wlLanded = 0
  let wlBlocked = 0
  let wlBlocker = null
  let wlHint = null
  for (const [list, msg] of [
    [i18nPaths, msgs.i18n],
    [restPaths, msgs.rest],
  ]) {
    if (!list.length) continue
    let r = commit(list, msg) ?? {}
    // 活文档拒收 ⇒ 就地重备一次(判据与副作用分开,便于镜像测试钉住"只做一次")。
    if (r.blocker === 'live-doc-line-loss') {
      const plan = retryPlan({ blocker: r.blocker, paths: list, root })
      if (plan.retry) {
        logLine(
          `白名单族活文档拒收 ⇒ 已就地重备 ${plan.docs.length} 枚(merge-live-doc --apply)并重试一次:${plan.docs.join(', ')}`,
        )
        r = commit(list, msg) ?? {}
      } else if (plan.notReady.length > 0) {
        logLine(
          `白名单族活文档重备未达标 ⇒ 不重试(不得用重试掩盖真丢失):${plan.notReady.join(' / ')}`,
        )
      }
    }
    const done = typeof r.landed === 'number' ? r.landed : 0
    const tried = typeof r.attempted === 'number' ? r.attempted : list.length
    wlLanded += done
    if (tried - done > 0) {
      wlBlocked += tried - done
      wlBlocker ??= r.blocker ?? 'unidentified'
      wlHint ??= r.hint ?? null
    }
  }
  if (wlBlocked)
    log(`⛔ 白名单族本轮被拦 ${wlBlocked} 枚(拦路者=${wlBlocker}${wlHint ? ` 摘要=${wlHint}` : ''})⇒ 仍在盘上,下一轮仍会重来`)
  tally.collected = wlLanded
  tally.blocked = wlBlocked
  tally.blocker = wlBlocker
  tally.hint = wlHint
}

/**
 * 从 safe-commit 的失败输出里认出**拦路的那道门**(可归因才有整改的下一步,§5e-1)。
 * 只认既有输出形态,不猜:① `❌ <label>...失败，提交已阻止`(runner 的汇总行)
 * ② `❌ check-xxx: ...`(门体自报)③ 兜底 `unknown` ⇒ 如实说"拦路的门没认出来",不冒充已知。
 */
export function blockerFromOutput(text) {
  const s = String(text ?? '')
  const m = /❌\s*([^\n]*?)\.\.\.失败，提交已阻止/.exec(s)
  if (m) {
    const script = /check-[a-z0-9-]+\.mjs|check-[a-z0-9-]+/.exec(s)
    return `${m[1].trim().slice(0, 40)}${script ? `(${script[0]})` : ''}`.replace(/\s+/g, '_')
  }
  const c = /^❌\s*(check-[a-z0-9-]+)/m.exec(s)
  if (c) return c[1]
  // 以下四类都是 safe-commit **本身**的整轮拒(不是某道门判红),现读都真实发生过:
  // 复活暂存件回流被拦(本仓另一席的删除意图被带回)、活文档工作树副本吃掉 HEAD 已入库的行、
  // 声明集不符、并发锁耗尽。
  if (/中止 commit[^\n]*回流/.test(s)) return 'resurrected-deletion-refusal'
  if (/heal-worktree-tracked|revoke-deletion|intentional-file-deletions/.test(s)) return 'resurrected-deletion-refusal'
  // Step 3e 的活文档闸(README/AGENTS/PROJECT_PLAN):工作树副本少了 HEAD 已入库的行 ⇒ 整轮拒。
  if (/活文档对账判红/.test(s)) return 'live-doc-line-loss'
  if (/声明集|本任务文件|pathspec 只提交/.test(s)) return 'safe-commit-scope-refusal'
  if (/并发锁|锁争用|index\.lock/.test(s)) return 'safe-commit-lock-exhausted'
  return 'unidentified'
}

/**
 * 认不出精确门名时给一行**可归因摘要**(§5e-1:红了要能给出下一步,不能只说 unidentified)。
 * 只进日志/邮件正文,不进 `blocker` 身份位 —— 身份里塞会抖动的路径/计数会造成寄信风暴(§5e-3)。
 */
export function blockerHint(text) {
  const lines = String(text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const bad =
    [...lines].reverse().find((l) => l.startsWith('❌')) ??
    lines.find((l) => /error|失败|拒|中止/.test(l)) ??
    ''
  return bad.replace(/["`$\\]/g, '').slice(0, 90).replace(/\s+/g, '_')
}

/**
 * 本器**唯一**的提交通道(2026-11-03 从 main 体内提到模块级,好让账本族复用同一条出口)。
 * 语义未变:落地一律 spawn `scripts/safe-commit.mjs`(全门冻结索引 + pathspec 只提交声明集),
 * 失败只记日志不重试轰炸,调度器下一轮自然重来;**不自带 push 腿**(推送仍由 post-commit 的
 * git-push-guard 自动完成并回读,§16b/§20 契约不变)。
 * `root` 形参给测试注入 mkScratch 临时仓用(默认 ROOT ⇒ 既有行为一字未变)。
 *
 * 2026-11-05 改返回值(§0.3 的诚实性,不是加功能):此前调用方**无论成败**都把本批枚数累加进
 * `collected` ⇒ 现读实证:一整个下午跨端账本 229 条申报里**带 landedSha 的 0 条**,而结论行连报
 * `collected=103`(它真实含义是"本轮挑了 103 枚"),于是"被一道与跨端无关的全局面红门整批拦死"
 * 这件事在机读面上长得像"收得很好"。失败方向必须是"多要一次定向说明"(§0.10):
 * 现在返回 `{attempted, landed, blocker}`, landed 只在提交真成功时计数, blocker 点名拦路的门。
 */
function commitBatch(paths, message, root = ROOT) {
  const attempted = paths.length
  if (!attempted) return { attempted: 0, landed: 0, blocker: null }
  try {
    const out = execFileSync(
      process.execPath,
      [join(root, 'scripts', 'safe-commit.mjs'), '-m', message, '--', ...paths],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 << 20,
        windowsHide: true,
        env: { ...process.env, AGENT_SCOPE: '' },
      },
    )
    log(`✅ safe-commit 成功(${message})\n${String(out).trim().split('\n').slice(-4).join('\n')}`)
    return { attempted, landed: attempted, blocker: null, hint: null }
  } catch (e) {
    const body = String(e.stdout || e.message)
    log(`❌ safe-commit 失败(下一轮再试):${body.trim().split('\n').slice(-6).join('\n')}`)
    return { attempted, landed: 0, blocker: blockerFromOutput(body), hint: blockerHint(body) }
  }
}

// §22d:被 import 时不得触发 CLI 主流程(镜像测试要能用生产判据复算,§22c)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  // 直跑形态:结论行必须达 stdout(消费者 runLegChild 读 stdout);异常路径也必须
  // **先行后抛**(§0.3 —— 取不到输入/坏了都要点名,绝不只靠 catch 打日志后哑退)。
  // 重抛保持既有退出码语义(未捕获异常 ⇒ 非 0 退出,与改前同形)。
  setConclusionStdout(true)
  try {
    main()
  } catch (e) {
    emitConclusion(
      baseConclusion({
        ledger: 'unjudged',
        reason: `exception:${String(e?.message ?? e)
          .replace(/\s+/g, '_')
          .slice(0, 160)}`,
      }),
    )
    throw e
  }
}

export const __test__ = {
  isExcluded,
  blockerFromOutput,
  blockerHint,
  isCollectible,
  partitionCollectible,
  COLLECT_WHITELIST,
  listChanges,
  guardBusy,
  mergeLiveDoc,
  syncReadmeNumbers,
  snapshotLedger,
  rollbackLedger,
  partitionStaleCopies,
  dropStaleCopies,
  minusCount,
  isPartialRevert,
  partitionI18nBatch,
  autoCommitMessages,
  // 账本收编族(2026-11-03):判据住在 lib/cross-end-landing-ledger.mjs,这里只暴露本器的段。
  collectLedgerEntries,
  headBlobOidsOf,
  liveDocRetryPlan,
  runLedgerFamily,
  guardLedgerLiveDocPath,
  ledgerCommitMessage,
  ledgerConclusionLine,
  // 结论行唯一出口族(2026-11-03):镜像测试据此钉"每条退出路径都出声"。
  emitConclusion,
  baseConclusion,
  classifyBusy,
  exitWhitelist,
  setConclusionStdout,
  appsSegmentsOf,
  worktreeBlobOid,
  parseScrubOutcome,
  normSlashes,
  LEDGER_QUIET_MS,
  MAX_PATHS,
  commitBatch,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
