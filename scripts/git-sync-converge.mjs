#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * git-sync-converge.mjs — 主动推送收敛器(2026-09-18 晚立,根治"推不动→手工循环"卡点)。
 *
 * 背景:多会话并发推送,远端在 push 门 typecheck 的 4-5 分钟窗口内持续前移,
 * 单次 push 极易 non-FF。此前 agent 手工循环(fetch→merge→push)每轮 5-13 分钟,
 * 2026-09-18 实战收敛 3 轮耗时 25 分钟,且手工循环易漏步骤/误操作。
 *
 * 机制(worktree-preserving,零触碰他人未提交文件):
 *   1. fetch origin main
 *   2. origin/main 已是 HEAD 祖先 → 已收敛,结束
 *   3. HEAD 已被远端包含 → 无需推送,结束
 *   4. 分叉 → `git merge-tree --write-tree HEAD origin/main` 索引层建合并树
 *      (不触碰工作区,不影响其他会话的未提交文件;冲突则报错退出)
 *   5. `git commit-tree` 造合并提交 → `git update-ref refs/heads/main` 推进本地
 *   6. `node scripts/git-push-guard.mjs` 官方通道推送(含 push 门+降级重试)
 *   7. 重复至多 --rounds 轮(默认 3)
 *
 * 用法:
 *   node scripts/git-sync-converge.mjs [--branch main] [--rounds 3] [--dry-run]
 *   node scripts/git-sync-converge.mjs --self-test   # 回归自检(含 db6c455d6 静默回退复现,见下)
 *
 * 只读核验(不写任何东西)仍用 git-push-converge.mjs。
 *
 * 2026-09-23 静默回退根治(db6c455d6 把已入库的 mobile-rn 0.0.1 翻回 0.0.0,且无任何
 * commit 记录该路径变更 —— 索引层合并用了陈旧输入,merge-tree 之后直接 update-ref):
 *   ① 输入新鲜度 — merge-tree/commit-tree 只用刚解析的 SHA,不用 ref 名;update-ref
 *      带 expected-old 做 CAS,HEAD 被并发推进则本轮作废重来(不覆盖他人本地提交);
 *   ② 单边变更保持守门(assertNoSilentRevert, fail-closed) — 无冲突合并必须原样保留
 *      每一处单边变更(blob 逐字节,含 mode;删除亦比对),丢一处即 exit 1,绝不落提交;
 *      注:基线取 `git merge-base` 最优基(与 merge-tree 默认一致);极端纵横交错历史下
 *      基线分歧只会导致误拦(宁可 exit 1 转人工),永不漏放,方向永远 fail-closed;
 *   ③ 回归网: --self-test(真仓库演练,正反用例) + scripts/tests/ 下镜像测试(§22c)。
 */
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gitRaw, resolveRemoteHead } from './lib/face-reader.mjs'
import { postMergeLedgerSync } from './lib/post-merge-ledger-sync.mjs'
// 孤儿提交备份腿的单一实现(2026-10-29 门 30a 根因票):四台旁路落地器共用一份判据(§0.6),
// 本器只留薄封装与再导出 —— conv 档命名/幂等/pack-refs/留痕/永不抛 全部住在那一层。
import { orphanBackupRefName, backupOrphanCommit } from './lib/orphan-backup.mjs'
// 旁路合并的"对侧独有新增必须 ∈ 结果"复量:判据一律 import 守门 100 自己那份 A1 实现,
// 本器不复算第二份集合运算(AGENTS §0.6 单一真相源 / §22c 镜像测试纪律)。
import { auditOne as auditMergeAdditionLoss } from './check-merge-addition-loss.mjs'
// 旁路合并的"本侧显式删除被合并带回结果树"复量:判据一律 import 守门 168 自己那份实现
// (auditMerge + classifyCandidate + readAllowlist),本器不复算第二份(AGENTS §0.6 / §22c)。
import { auditMerge, classifyCandidate, readAllowlist } from './check-merge-deletion-resurrection.mjs'
// 判据只有一份:`planStateRegressions` 住在 union-converge(在收敛器里再写一遍
// "什么算状态放大"必然与它漂移,而漂移的代价固定是"一条尺子绿灯、另一条同一改动判红")。
// probe/ratchetViolations 同理 —— 维度清单不得在别处再抄一份 `['F1', …]`。
// ⚠️ 唯独 union-converge 那一份**不得静态 import**(G-815406,2026-09-29 实测):本器是并行会话的
// 公共同步/推送通道,而 union-converge 的依赖图比本器宽(它还吃 malformedLine / f9GroupLine)。
// 那份 lib 一旦被在飞改动改得少一个导出,静态 import 会让本器**在任何一条分支打出字之前**就死,
// 账面只剩一截 Node 堆栈 —— 既不归因(看不出断在谁的依赖上)也不降级(连与台账闸门无关的
// 快路径一起陪着死)。改成异步装载后,装载失败只会让**第①把尺子**落"未判定"并点名原因。
import { probe, ratchetViolations, narrowF9Face } from './plan-tasks.mjs'
import {
  auditPlan,
  dispositionOfV2,
  waitingHumanSelfVerdict,
  waitingEnvVerdict,
} from './lib/plan-task-index.mjs'
// 侧车(结构化归属表态)的唯一装载出口。定罪面必须与过滤面同一把尺(§0.6):
// `auditPlan(content, { fields })` 里那一把 `dispositionOfV2` 就是派单面/门 130/兜底清扫器
// (`strip-banned-buckets.mjs`)共用的那一把;少传 fields ⇒ 静默回落散文尺,读出的桶就不是同一个桶。
import { loadFields, FIELDS_REL } from './lib/plan-fields.mjs'

/** 装载状态:mod 为 null 时 error 必为非空一句话 ⇒ 调用方不得把它读成"闸门通过"。 */
const unionGate = { mod: null, error: '' }

/** 幂等装载 union-converge(闸门尺子的宿主)。装不上不抛,只留原因 —— 本器的降级路径靠它。 */
export async function ensureUnionModule() {
  if (unionGate.mod || unionGate.error) return unionGate
  try {
    unionGate.mod = await import('./union-converge.mjs')
  } catch (e) {
    // execFileSync 的教训同款:第一行才是起因,堆栈只是尸检报告。
    unionGate.error = String((e && e.message) || e || '未知原因')
      .split('\n')[0]
      .trim()
  }
  return unionGate
}

export { unionGate }

const C = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}
const log = (color, msg) => console.log(`${color}${msg}${C.reset}`)

/**
 * 收尾对齐子进程(`heal-worktree-tracked.mjs --align-drift`)的封顶(ms)。
 *
 * 2026-10-04 立。此前是硬编码 `90_000`,而内层 `heal-worktree-tracked.mjs:87` 的 `makeGit`
 * **刻意 `timeout: 0` 无界**(它的 `g` 兼承载 update-index / read-tree / restore 这类写操作,
 * 写操作中途被 SIGTERM 可能留下 .git/index.lock)—— 两层语义直接打架:外层偏用 90s 砍它,
 * 撞满即 SIGTERM 整棵子树,恰好制造它想避免的全局阻塞。
 *
 * 90s 这个数**没有任何实测支撑**:本机真仓四次实测 51/48/41/40 秒,最坏余量只有 1.76 倍;
 * 并发一叠加(部署环 / 守护 / 会话同时碰共享 gitdir,本机派生 git 本就 EBUSY)必然撞满
 * —— 10-03 07:41 的 `spawnSync ... node.exe ETIMEDOUT` 即此形态,此后 24.8 小时无一次成功。
 *
 * 取 600s:覆盖 40–51s 常态与数倍抖动,同时仍是**有限值** —— 守门 80 的口径要的是"有界",
 * 不是"够大就永不超时"。env 可调,理由与同文件 `IHUI_UNION_CONVERGE_TIMEOUT_MS` 一致。
 */
const ALIGN_DRIFT_TIMEOUT_MS = Number(process.env.IHUI_ALIGN_DRIFT_TIMEOUT_MS || 600_000)

/**
 * 合并提交的身份必须随调用一起给,不能依赖"当前用户配过 global config"。
 * 实测(2026-09-27 05:15,deploy\win\.converge.err.log):本器由 IHUI-DEPLOYLOOP 以服务身份
 * (LocalSystem)后台发起,而 user.name/user.email 只配在交互账户的
 * `C:\Users\Administrator\.gitconfig` 里(实测 `git config --show-origin` 唯一命中该文件,
 * 仓库 local config 无此项)⇒ 服务那份读不到,于是无冲突分支的 commit-tree 直接
 * `rc=128 Author identity unknown`。后果不是"某轮没合上",而是**部署环每 ~80 秒撞一次分叉、
 * 连续 35+ 轮永不产出新构建**,线上停在旧提交,而每轮仍在对生产库跑 migrate+seed。
 * 同一条判据 union-converge.mjs:75 早已修好(它走冲突分支),本器这一分支被漏掉 ——
 * 而调用方把"非零退出"报成"union-converge 亦判需人工"时,崩溃会被读成内容裁决,
 * 所以只有现读 err 日志才看得见真因。
 * 取值与 scripts/git-rebuild-local.mjs 登记的仓库机器身份同一份,不自立第二档。
 */
export const GIT_MACHINE_IDENTITY = [
  '-c',
  'user.name=智汇AGI社区',
  '-c',
  'user.email=ok502319984@gmail.com',
]

/**
 * 纯函数:悬空合并提交的备份 ref 名(§29 命名族 `lost-commit/wip-*`)。
 * 判据已迁入 `scripts/lib/orphan-backup.mjs`(§0.6 单一真相源:四台旁路落地器各拼一份必然漂开,
 * union-converge 那份 10 位无中段的副本就是活证据)。**这个再导出必须留着** —— 镜像测试
 * `scripts/tests/git-sync-converge-orphan-backup.test.mjs` 经 `__test__` 按名从本文件取用;
 * 删掉再导出 = 门 253 D2 那一型(削出口而消费方还按名取用 ⇒ 装载期当场炸)。
 * lib 版默认 `kind:'conv'`,读出值与本文件历史行为逐字相同(`lost-commit/wip-conv-<sha7>`)。
 */
export { orphanBackupRefName }

/**
 * 纯函数:把"吞并 + 应急出口"的裁定从 CLI 里剥出来,好让镜像测试真判(§0.3 方向:裸开关不放行)。
 * @returns {{proceed:boolean, block:boolean, skipUsed:boolean, bareSkip:boolean, lost:number}}
 */
export function additionLossVerdict({ lost = [], skip = false, reason = '' } = {}) {
  const n = lost.length
  if (n === 0) return { proceed: true, block: false, skipUsed: false, bareSkip: false, lost: 0 }
  if (skip && String(reason).trim())
    return { proceed: true, block: false, skipUsed: true, bareSkip: false, lost: n }
  // 裸跳门(只给 1 不给原因)与"什么都没给"同结局:拦。放行不是这一型的失效方向。
  return { proceed: false, block: true, skipUsed: false, bareSkip: skip === true, lost: n }
}

/**
 * 纯函数:把"删除复活 + 应急出口"的裁定从 CLI 里剥出来,好让镜像测试真判(§0.3 方向:裸开关不放行)。
 *
 * 口径与守门 168 一致:`reds` 是硬红;`undetermined`(含台账读不到)一律按 fail-closed 计入拦截 ——
 * 因为这条路不跑钩子,漏判的代价是"已删文件悄悄回流 origin/main",与 G-939 同一类事故。
 * @returns {{proceed:boolean, block:boolean, skipUsed:boolean, bareSkip:boolean, reds:number, undetermined:number}}
 */
export function deletionResurrectionVerdict({ reds = [], undetermined = [], skip = false, reason = '' } = {}) {
  const n = reds.length
  const u = undetermined.length
  if (n === 0 && u === 0)
    return { proceed: true, block: false, skipUsed: false, bareSkip: false, reds: 0, undetermined: 0 }
  if (skip && String(reason).trim())
    return { proceed: true, block: false, skipUsed: true, bareSkip: false, reds: n, undetermined: u }
  // 裸跳门(只给 1 不给原因)与"什么都没给"同结局:拦。放行不是这一型的失效方向。
  return { proceed: false, block: true, skipUsed: false, bareSkip: skip === true, reds: n, undetermined: u }
}

/**
 * 推进前复量:这枚合并提交有没有把某一侧"独有的新增"吞掉(守门 100 的 A1 判据)。
 *
 * 为什么必须在旁路侧再问一次:守门 100 的头注自写口径是"提交链口径:未进入 origin/main 的合并",
 * 而本器走 merge-tree + commit-tree + update-ref **不跑任何 git 钩子** ⇒ 提交链那道闸对这条路
 * 结构性失明。现读代价:枚 `12898ccd9bcb2b8e094e0057d94e0fab0380293a`(11 枚文件的真实功能提交,
 * post-commit 当时报"将自动推送")在合并后对 HEAD 与 origin 双非祖先,内容退回未提交态(台账 G-939)。
 *
 * `atRef` 刻意取合并提交自己:否则"后手补回"那一维会拿**尚未推进的旧 HEAD** 去判,把远端刚带来的
 * 新增误记成 repaired(那等于给吞并放行)。取合并树时 alive ≡ 结果树 ⇒ repaired 恒空,lost 就是真丢。
 * @returns {{lost:Array<{path:string,addedBy:string}>,repaired:Array<unknown>,atRefUndetermined:string,ok:boolean}}
 */
export function preAdvanceAdditionLoss({ mergeSha, cwd }) {
  const a = auditMergeAdditionLoss(mergeSha, cwd, mergeSha)
  return { lost: a.lost, repaired: a.repaired, atRefUndetermined: a.atRefUndetermined, ok: a.lost.length === 0 }
}

/**
 * 推进前复量:这枚合并提交有没有把某一侧"显式删除"的文件带回结果树(守门 168 的判据)。
 *
 * 为什么必须在旁路侧再问一次:守门 168 走提交链(commit 钩子),而本器走 merge-tree + commit-tree +
 * update-ref **不跑任何 git 钩子** ⇒ 提交链那道闸对这条路结构性失明。G-939 的现读就是这型事故:
 * 枚 12898ccd9bcb2b8e094e0057d94e0fab0380293a 在无钩子的合并之后对 HEAD 与 origin 双非祖先,
 * 内容退回未提交态(台账 G-939)。
 *
 * `atRef` 取合并提交自身:`auditMerge` 用合并树当结果面,所得 candidates 即"被带回"的真集。
 * 判据一律 import 守门 168 自己那份实现(auditMerge + classifyCandidate + readAllowlist),本器不复算。
 * 台账按**路径**豁免:登记且未过期的条目把对应候选判为 waived,不进红;台账读不到按 fail-closed 计入未判定。
 * @returns {{reds:Array<{path:string,ours:string}>,waived:Array,undetermined:Array<string>,ok:boolean,allowBroken:boolean}}
 */
export function preAdvanceDeletionResurrection({ mergeSha, parents, cwd }) {
  const a = auditMerge(mergeSha, parents, cwd)
  const today = new Date().toISOString().slice(0, 10)
  const allow = readAllowlist(cwd, 'head')
  const allowByPath = new Map()
  for (const e of allow.entries || []) if (e && e.path) allowByPath.set(e.path, e)
  const reds = []
  const waived = []
  const undetermined = []
  for (const c of a.candidates || []) {
    const v = classifyCandidate(c, { allowByPath, today })
    if (v.kind === 'red') reds.push({ ...c, ...v })
    else if (v.kind === 'waived-allowlist' || v.kind === 'waived-marker') waived.push({ ...c, ...v })
    else undetermined.push(`${c.path} @ ${String(c.merge).slice(0, 11)} —— ${v.why}`)
  }
  // 台账读不到 ⇒ 同样按 fail-closed 计入未判定(不冒成"没复活")。
  if (allow.broken) undetermined.push(`台账不可判读:${allow.broken}`)
  if ((a.undetermined || []).length) undetermined.push(...a.undetermined)
  return {
    reds,
    waived,
    undetermined,
    ok: reds.length === 0 && undetermined.length === 0,
    allowBroken: Boolean(allow.broken),
  }
}

/** 双侧同改路径的行面复量上限:超过即记「未判完」(未判定,不记绿),绝不静默截断。 */
const LOCAL_PRESERVED_MAX_CODE_FILES = 200

/**
 * 只读 git 读取(root 注入,统一层派生):失败一律上抛,由调用方转「未判定」。
 * 2026-10-26 迁 scripts/lib/face-reader.mjs 的 gitRaw(型 B 收口)。错误面对账:层抛 Undetermined
 * (消息 `git <cmd> 失败: <stderr 首行>`),调用方 tryBlob 按首行匹配 `does not exist in` 判删除档 ——
 * git show 的 `fatal: path '…' does not exist in '…'` 正是 stderr 首行,原样进消息,匹配不漂;
 * firstLineOf(e) 读不到 e.stderr 时退回 e.message,同一句话。层另带 safe.directory/quotepath=false/
 * GIT_OPTIONAL_LOCKS=0/EBUSY 兜底(只读面净收益;本仓路径全 ASCII,quotepath 无输出形态差)。
 */
function readGit(cwd, args, { maxBuffer = 64 << 20 } = {}) {
  return gitRaw(args, cwd, { timeout: 120_000, maxBuffer })
}

const firstLineOf = (e) => String((e && (e.stderr || e.message)) || e || '未知原因').split('\n')[0].trim()

/**
 * 落地前复量:本侧(本地 HEAD)已提交的内容是否仍被合并结果包含。
 *
 * 立因(票「合流会静默吞掉『已真机验证』的代码修复,而守门 76/71 对此零覆盖」):2026-09-24 实测
 * 本会话 84583fdf6 把 PlazaScreen.tsx:464 / RankingDetailScreen.tsx:171 的 colorScheme 字面量改成
 * resolvedTheme **并真机复测通过**,几轮 `git-sync-converge` 之后 HEAD 里那两处又变回写死 "light"
 * —— 合并取了对方侧。本器走 merge-tree + commit-tree + update-ref **不跑任何 git 钩子**,而守门 76
 * (stale-revert)与 71(plan-line-loss)只在提交链的**暂存面**上判 ⇒ 合流层是这两道门的共同盲区。
 * 既有 `assertNoSilentRevert` 只覆盖**单边变更**(双侧都改的路径直接跳过),而本事故恰是双侧同改
 * 同一文件 ⇒ 路径面与整 blob 字节面都看不见,必须判到**行**。
 *
 * 判据一律复用 union-converge 的既有自证出口(§0.6 单一真相源,本器零复算):
 *   ① `verifyUnion`:本侧路径全集 ⊆ 合并树 ∧ 对侧路径全集 ⊆ 合并树 ∧ 三本活文档的行重数
 *      (含搬运感知抑制表)—— 与 union-converge 的落地闸是**同一个函数**;
 *   ② `lostAddedLines`:双侧同改的**非文档**路径上,本侧"相对共同基底新增的行"必须仍出现在合并
 *      结果里(字符行 multiset 底线,局限与 union-converge 头注同款:只保重数不判语义顺序)。
 *      二进制文件按"未按行判"报数(`skipped`);超过读取上限或读失败记未判定(exit 2),不冒充判过。
 *
 * 三态纪律(§0.3):取不到输入(union-converge 未装载 / 四方 sha 或基底形状不对 / git 读失败 /
 * 双侧同改文件数超上限未判完)一律记 `undetermined`,调用方必须 exit 2 并逐条点名 ——
 * **绝不落成 0**;判出丢失记 `bad`,调用方 exit 1 且不 update-ref。
 * @returns {{bad:string[], undetermined:string[], judged:number, skipped:number}}
 */
export function preAdvanceLocalPreserved({
  local,
  remote,
  tree,
  base,
  cwd = process.cwd(),
  union = unionGate.mod,
  /**
   * 声明式例外(2026-10-28 立):`--take-theirs-doc <path>` 的路径集,原样交给
   * `verifyUnion` 的第 9 参。**本器不判它该不该豁免** —— 那一份判据(整 blob 逐字等于
   * 对侧、声明了非活文档/两侧都取不到都要判红)全在收敛器实现里;这里只是把
   * "人的声明"送进去,否则索引层这条路根本没有表达它的口子(实测:对侧合法结清删行,
   * merge-tree 已按常理删对,自证却按"本侧已提交内容被吞"拒推进 HEAD ⇒ 整仓同步停摆)。
   */
  takeTheirsDocs = null,
} = {}) {
  const bad = []
  const undetermined = []
  const result = { bad, undetermined, judged: 0, skipped: 0 }
  const SHA_RE = /^[0-9a-f]{40}$/
  for (const [k, v] of Object.entries({ local, remote, tree, base })) {
    if (typeof v !== 'string' || !SHA_RE.test(v.trim()))
      undetermined.push(`输入 ${k} 取不到或形状不对(${String(v).slice(0, 44)})`)
  }
  if (
    !union ||
    typeof union.verifyUnion !== 'function' ||
    typeof union.lostAddedLines !== 'function'
  ) {
    undetermined.push(
      `union-converge 自证出口未装载(verifyUnion/lostAddedLines 缺失):${unionGate.error || '原因未取到'}`,
    )
  }
  if (undetermined.length) return result

  // ① 路径面 + 活文档行面:与 union-converge 落地闸同一个出口。不传折叠台账 ——
  //    merge-tree 产物不做同题折叠,传一张空账反而会把"台账没声明"读成未判定。
  try {
    const vu = union.verifyUnion(
      local.trim(),
      remote.trim(),
      tree.trim(),
      cwd,
      base.trim(),
      new Map(),
      null,
      null,
      takeTheirsDocs,
    )
    for (const b of vu) bad.push(String(b))
  } catch (e) {
    undetermined.push(`verifyUnion 抛错:${firstLineOf(e)}`)
    return result
  }

  // ② 代码行面:只判"双侧相对基底都改过"的非文档路径 —— 单边变更已由 assertNoSilentRevert
  //    逐字节守住,活文档行面已由 ① 守住,重复判会造两份尺子(§0.6)。
  const liveDocs = new Set(Array.isArray(union.LIVE_DOCS) ? union.LIVE_DOCS : [])
  let codePaths
  try {
    const changedOf = (rev) =>
      new Set(
        readGit(cwd, ['diff', '--name-only', '--no-renames', `${base.trim()}..${rev}`])
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      )
    const cl = changedOf(local.trim())
    const cr = changedOf(remote.trim())
    codePaths = [...cl].filter((p) => cr.has(p) && !liveDocs.has(p)).sort()
  } catch (e) {
    undetermined.push(`双侧同改路径枚举失败:${firstLineOf(e)}`)
    return result
  }
  if (codePaths.length > LOCAL_PRESERVED_MAX_CODE_FILES) {
    undetermined.push(
      `双侧同改路径 ${codePaths.length} 枚 > 上限 ${LOCAL_PRESERVED_MAX_CODE_FILES} ⇒ 行面只判了前 ${LOCAL_PRESERVED_MAX_CODE_FILES} 枚(未判完,不记绿)`,
    )
    codePaths = codePaths.slice(0, LOCAL_PRESERVED_MAX_CODE_FILES)
  }
  /**
   * 读某 rev 下该路径的内容。三态(§0.3):`null` = 该 rev 下**没有这个路径**(删除档,调用点按语义跳过);
   * 字符串 = 读到内容;`undefined` = **读失败**(对象缺失/超时/锁争用/超过读取上限)⇒ 已记未判定。
   * 旧写法把 catch 一律 return null,于是"git 读失败"与"删除档"同形 ⇒ 未判定被静默落成绿
   * (头注承诺"git 读失败一律记 undetermined",实现与承诺对齐)。
   */
  const tryBlob = (rev, p) => {
    try {
      return readGit(cwd, ['show', `${rev}:${p}`])
    } catch (e) {
      const msg = firstLineOf(e)
      if (/does not exist in|exists on disk, but not in/i.test(msg)) return null
      undetermined.push(`${p} 在 ${String(rev).slice(0, 11)} 的内容读取失败(不是删除档):${msg}`)
      return undefined
    }
  }
  for (const p of codePaths) {
    const lt = tryBlob(local.trim(), p)
    // undefined = 已记未判定;null = 本侧删除 ⇒ 没有"本侧新增行"可判(删除归守门 168)
    if (typeof lt !== 'string') continue
    const btRaw = tryBlob(base.trim(), p)
    if (btRaw === undefined) continue
    const rtRaw = tryBlob(remote.trim(), p)
    if (rtRaw === undefined) continue
    const mt = tryBlob(tree.trim(), p)
    if (mt === undefined) continue
    if (mt === null) continue // 结果删了该路径:① 的路径面已经点名,不重复判
    const bt = btRaw ?? ''
    const rt = rtRaw ?? ''
    if ([lt, bt, rt, mt].some((t) => t.includes('\u0000'))) {
      result.skipped += 1
      continue
    }
    let lost
    try {
      lost = union.lostAddedLines(bt, lt, rt, mt)
    } catch (e) {
      undetermined.push(`${p} 行面复量抛错:${firstLineOf(e)}`)
      continue
    }
    result.judged += 1
    if (!lost.length) continue
    const sample = lost
      .slice(0, 3)
      .map((l) => String(l).slice(0, 60))
      .join(' / ')
    bad.push(`${p} 本侧已提交的 ${lost.length} 行不在合并结果里(lostAddedLines):${sample}`)
  }
  return result
}

/**
 * 纯函数:把「本侧已提交内容仍在」的裁定从 CLI 里剥出来(§0.3 三态,镜像测试直接喂构造面)。
 * 未判定优先于丢失:判据一处没跑成时不许把结论说成"没丢",也不许说成"判了丢"(exit 2)。
 * @returns {{status:'ok'|'lost'|'undetermined', exitCode:0|1|2, bad:number, undetermined:number}}
 */
export function localPreservedVerdict({ bad = [], undetermined = [] } = {}) {
  const u = undetermined.length
  const b = bad.length
  if (u > 0) return { status: 'undetermined', exitCode: 2, bad: b, undetermined: u }
  if (b > 0) return { status: 'lost', exitCode: 1, bad: b, undetermined: 0 }
  return { status: 'ok', exitCode: 0, bad: 0, undetermined: 0 }
}

/**
 * 把一枚 CAS 落空的合并提交按 §29 零损失流程备份成 tag 并固化(pack-refs)。
 * 实现住 `scripts/lib/orphan-backup.mjs`(conv/uni/land 三档共用一份判据,§0.6);本层是**薄封装**:
 * 同名同签名、返回形状 `{ok, ref, already?}` 与日志文案/颜色逐字不变 ——
 * 镜像测试与 addition-loss / deletion-resurrection 两把调用侧锁钉的就是这些字面。
 */
function backupOrphanMerge(sha, why) {
  let anomaly = ''
  const res = backupOrphanCommit({
    sha,
    why,
    kind: 'conv',
    root: process.cwd(),
    // lib 的出声一律暂存,由下面按本文件历史文案逐字重放(日志形状也是契约,不随手换措辞)。
    logger: (m) => {
      anomaly = String(m)
    },
  })
  if (res.why === 'bad-sha-or-kind') {
    log(C.yellow, `  ⚠️ 悬空合并提交的 SHA 形状不对(${String(sha).slice(0, 12)}),未备份`)
    return { ok: false, ref: null }
  }
  if (res.ok && res.already) return { ok: true, ref: res.ref, already: true }
  if (res.ok) {
    log(C.green, `  🛟 已备份孤儿合并提交为 ${res.ref}(否则守门 30a 会让每次提交跳门)`)
    return { ok: true, ref: res.ref }
  }
  // tag 未成(历史同形:不出声,只把 ok:false 交回调用点);lib 自身抛异常才重放失败行
  if (res.why === 'threw') {
    log(
      C.yellow,
      `  ⚠️ 备份孤儿合并提交失败:${anomaly.replace(/^⚠️ 备份孤儿提交异常:/, '').slice(0, 120)}`,
    )
  }
  return { ok: false, ref: res.ref }
}
/** 纯函数:拼出带身份的 `commit-tree` 参数(判据可被镜像测试直接喂构造面)。 */
export function mergeCommitArgs({ tree, parents, message }) {
  const ps = (Array.isArray(parents) ? parents : [parents]).flatMap((p) => ['-p', p])
  return [...GIT_MACHINE_IDENTITY, 'commit-tree', tree, ...ps, '-m', message]
}

/** 轮询 push-state.json 至终态(guard 异步推送是后台跑的,须等落定再决策)。
 *  终态集 2026-09-26 起是 done | failed | diverged —— **diverged 必须算落定**:
 *  它是 guard 对"远端拒收 non-fast-forward"的结论,不写进来的话本函数会白等满
 *  8 分钟才返回 timeout,而收敛器每轮都等一次 = 三轮 24 分钟空转(§5b「🔄 主动收敛」
 *  当初要根治的就是这个)。老状态文件里没有该值 ⇒ 行为与今天一致(向后兼容)。 */
function waitForPushState(headSha, timeoutMs = 8 * 60 * 1000) {
  const stateFile = resolve(process.cwd(), '.ihui-agent/state/push-state.json')
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const s = JSON.parse(readFileSync(stateFile, 'utf8'))
      if (
        s.headSha === headSha &&
        (s.status === 'done' || s.status === 'failed' || s.status === 'diverged')
      )
        return s.status
      // state 已被更新 HEAD 的其他推送覆盖 → 视为本 HEAD 推送已无意义
      if (s.headSha !== headSha) return 'superseded'
    } catch {
      /* 无状态文件 */
    }
    if (Date.now() > deadline) return 'timeout'
    // 同步休眠改用 Atomics.wait(仓内既有正例:desktop-installer-assets.mjs),不再派生 node 子进程。
    // 诱因是实测事实:2026-09-24 该 `node -e` 派生在一轮收敛中失败过一次(隔离复现 3/3 成功 ⇒
    // 瞬时派生失败,根因未定位),而 execFileSync 抛出会把**整轮收敛**连带中止 —— 此时合并提交已推进、
    // 后续轮次与推送检查全部没跑。休眠不该是收敛器的失败模式。
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000)
  }
}

/**
 * 主 git 助手(rev-parse/fetch/tag/pack-refs/commit-tree/update-ref/merge-base/show 读写混用)。
 * 2026-10-26 迁 scripts/lib/face-reader.mjs 的 gitRaw(型 B 收口)。行为面对账:
 *  - 旧实现基于 process.cwd() 且不带 -C ⇒ 新实现以 cwd=process.cwd() 显式入层(gitRaw 强制 root);
 *    调用点需要别的 root 时经 opts.cwd 传(如 mergedPlanStateRegressions 的 blobOf)。
 *  - **必须封顶**保留:本文件在提交链与守护链上跑,一次无界的 `ls-remote`/`fetch` 挂住
 *    就等于"提交像死掉了"(守门 80 存在的原因;同一族实测挂过 80 分钟)⇒ timeout 默认 60s 原样。
 *  - stdio 旧 ['ignore','pipe','pipe'](git 不吃 stdin)与层无 input 态逐字同形;windowsHide 同;
 *    maxBuffer 旧默认 64MB 与层默认同值(显式透传,调用点覆盖照旧生效)。
 *  - 错误面:原样抛改抛 Undetermined(消息 `git <cmd> 失败: <stderr 首行>`,带 .status)。
 *    现有消费点逐一核过:allowFail→null 分支不看错误内容;fetch catch / backupOrphanMerge catch /
 *    alignFailureNote 只读 message(或 stderr 首行,读不到退回 message)⇒ 兼容。
 *    `rev-parse --verify --quiet` 无值时 rc=1:旧 throw→allowFail→null,层把 rc 带到
 *    Undetermined.status 后仍走同一 null 出口 ⇒ 同形。commit-tree 的身份 -c 经 argv 注入,
 *    与层前置的 -c 并存(git 多 -c 累积),顺序语义不变。
 */
function git(args, { allowFail = false, timeout = 60_000, maxBuffer = 64 << 20, cwd = process.cwd() } = {}) {
  try {
    // 根治(2026-09-30)的 stdin ignore 形态由层保证(gitRaw 无 input 态 stdio[0]='ignore')。
    return gitRaw(args, cwd, { timeout, maxBuffer }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/** 把冲突分支与"无冲突但状态被放大"分支共用的归并出口抽出来 —— 两处各写一遍 spawn 必然漂移。 */
function attemptUnionConverge(freshRemote, repoRoot) {
  // 子进程非零退出会 throw,必须在**这里**接住再看输出 —— 否则"需要人工"这条路永远走不到,
  // 而镜像测试就是按"紧跟 catch 的那一句必须回吐 stdout"来钉这一格的。
  // 三条"并集天然后果"的量纲在这里**逐条带理由**声明放行(F5/F6/F9/F9b 与路径零丢失仍硬判):
  // 活文档归并的定义是"两侧行的并集",同一件事两台机器各登记一次时并集必然新造出 F1/F4 的
  // 分叉与副本 ⇒ "不得高于任何一侧"在合并这条路上不可满足(2026-09-28 实测:部署环连续 113 轮
  // BLOCKED-DIVERGED、线上停在 17:41 那版约 4 小时)。放行不静默:--apply 会把两个读数与理由
  // 打印并写进合并提交信息;`IHUI_UNION_NO_STATE_ACCEPT=1` 让任何一次运行退回严格判据用于取证。
  const acceptDims = [
    'forks=两台机器各登记一次同一件事,并集天然成对(调用方常驻裁决,非静默)',
    'dupOpenCopies=同一件事两侧各写一条待办,保住双方行是零丢失承诺的必然结果(同上)',
    'rotatedAuto=目标行随并集回到台面,合并之后由 plan-tasks-merge --heal 收口(同上)',
  ]
  const strict = process.env.IHUI_UNION_NO_STATE_ACCEPT === '1'
  const args = ['scripts/union-converge.mjs', '--apply', '--theirs', freshRemote]
  for (const r of strict ? [] : acceptDims) args.push('--accept-state-growth', r)
  /**
   * 声明透传(2026-10-28 立)。
   *
   * 立因不是"缺一条便捷参数",而是**本器把一类只能由人做的判断锁死在门外**:
   * union-converge 有六条声明式出口(`--take-theirs-doc` / `--take-ours` / `--take-theirs` /
   * `--resolve` / `--union-capped` / `--supersede`),它们存在的唯一理由就是
   * "工具只能比字面、判不出语义住在哪一行"。而本器派生它时**一条都不转发** —— 于是遇到
   * 那几型,本器每轮只会复读同一句判红,人只能绕开本器直接跑 union-converge
   * (把本器的 CAS/fetch/推送链一起绕过)。这正是 §0.8 "只判不修的门逼人绕过"。
   *
   * 实测两例(2026-10-28 同一小时内):①对侧 `d75e178e26b` 结清 O68 删掉登记行,本侧该文件
   * 与基线逐字相同 ⇒ 三方合并的正确结果就是删掉它,零丢失自证却判"吞掉本侧已提交内容";
   * ②对侧删 AGENTS.md 两行 R4 补记,同型。两例的正解都只有 `--take-theirs-doc`,而本器
   * 表达不了 ⇒ 每轮 3 分钟白等,远端持续前进,分叉越拉越大。
   *
   * 本条**只做透传,零判据**:声明的语义、举证(supersedeProof/折叠四问)、留痕与
   * "声明未命中照样判红"全部仍在 union-converge 那一份实现里(§0.6 单一真相源),
   * 本器不校验、不改写、不代填。缺值一律不代猜(交给 union-converge 自己的用法错出口),
   * 且透传的旗号逐条打印 —— 声明式例外不许静默(与守门 83 同一规矩)。
   */
  const forwarded = declarationArgs(process.argv)
  if (forwarded.length > 0) {
    args.push(...forwarded)
    const names = forwarded.filter((x) => x.startsWith('--'))
    log(C.dim, `  ℹ️ 声明透传至 union-converge(${names.length} 条):${names.join(' ')} —— 判据/举证/留痕仍在收敛器那一份实现里,本器不代判`)
  }
  try {
    const out = execFileSync(process.execPath, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true, // §5b:漏此参数在钩子/守护派生下必弹控制台窗
      // 根治(2026-09-30):stdin 设 ignore,避开交互会话 Node 建子进程 stdin 管道 EBUSY
      // (union-converge 经 argv 吃参数、经临时文件通道写 blob,不吃 stdin;同 git() 助手修法)。
      stdio: ['ignore', 'pipe', 'pipe'],
      // 300s 在这台机上跑不完一次归并:实测一次 --apply(取对侧 9 路径 + 活文档并集 + 台账
      // 逐行解析)要 2–13 分钟 ⇒ 超时等于自动收敛永不成功。与"落地闸不可满足"是同一次停摆的
      // 两半,只修判据不修这里的封顶,部署环仍会每轮白等。守门 80 的"热路径一律封顶"保留。
      timeout: Number(process.env.IHUI_UNION_CONVERGE_TIMEOUT_MS || 1500000),
    })
    // 退出码必须与裁决文本一起走:execFileSync 只在子进程退 0 时返回 stdout,非零走下面那条出口。
    // 少了这一个数,"它退 0 却没报落地"(= 它压根没判人工)就与"它判了人工"在下游完全同形。
    return String(out) + unionExitMark(0)
    // stdout 优先(它是 union-converge 自己的裁决文本);但**必须把 stderr 接上** —— 子进程死在
    // import 期时 stdout 是空的,只回吐 `Command failed: <argv>` 那一行 message 就等于让下一个人
    // 重新去猜"到底是内容裁决还是通道断了"(本文件下方 alignFailureNote 头注记过同一型)。
  } catch (ue) {
    return String(ue.stdout || ue.message || '') + stderrTail(ue) + killNote(ue) + unionExitMark(ue && ue.status)
  }
}

/**
 * 孩子没有退出码时,把"是怎么没的"写进转述文本(2026-10-28 实测:落后 730 枚的一次归并撞上
 * 25 分钟封顶被 SIGTERM 掐死,下游只能报"退出码未取到"—— 于是"没跑完"与"跑完但没写结论"完全同形,
 * 下一个人只能重来一遍 25 分钟)。只加说明,不动 unionExitMark 的格式(它有形状锁与解析方)。
 */
export function killNote(ue) {
  if (!ue || Number.isInteger(ue.status) || !ue.signal) return ''
  const cap = Number(process.env.IHUI_UNION_CONVERGE_TIMEOUT_MS || 1500000)
  return `\n[归并未跑完:孩子被 ${ue.signal} 掐死(上限 ${cap}ms)⇒ 这不是 union-converge 的裁决;` +
    '要么按 IHUI_UNION_CONVERGE_TIMEOUT_MS 抬高上限,要么先跑只读档 node scripts/union-converge.mjs --theirs <sha> 读它的结论行]'
}

/** 取子进程 stderr 的首个非空行(崩溃的真正出处),封顶 300 字符防把整截堆栈灌进判定文本。 */
function stderrTail(ue) {
  const first = String((ue && ue.stderr) || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)[0]
  return first ? `\n[子进程 stderr] ${first}`.slice(0, 300) : ''
}

/** 闸门尺子没跑成时的点名前缀 —— 调用方按它分流,不得与"内容放大"混进同一个红。 */
export const STATE_GATE_UNDETERMINED = '[台账闸门未判定]'

/**
 * 仅对侧(origin 面)引文型违禁桶命中的普通点名行前缀 —— **刻意不共用** `STATE_GATE_UNDETERMINED`
 * 前缀:该行在本地 HEAD 面 0 命中,本地改不到(`live-doc-edit` 的 REPLACE 要求 before 在被审面
 * 命中 ⇒ 那行本地永远改不掉),挂未判定前缀会被主流程当硬拒 ⇒ 全仓推送死锁(2026-10-27 实测)。
 * 点名不拒推:随合并进本地后由台账侧车/清扫器通道处置。
 */
export const REMOTE_ONLY_BAN_NOTE = '[台账点名·仅对侧]'

/**
 * ── union 结论的转述层(2026-09-29 立)────────────────────────────────
 * 立因是本文件自己实测到的措辞谎:merge-tree 冲突分支过去打印
 *   ❌ 合并冲突,且 union-converge 亦判需人工(见上)。
 *   而它随那句一起贴出来的,只有 merge-tree 的 fatal 噪声与 CONFLICT 行
 * 而"见上"里从来没有 union 的结论 —— 子进程 stdout 那几行才是判据:
 * 摘要行带 `需人工 N`,落地闸不过时另有 `❌ 落地闸不过 N 处:` 与其后逐条维度行。
 * 2026-09-29 一天内在同一句上被误导 4 次,其中至少 2 次人工复跑 union-converge 是
 * exit 0(可落地)的。上层把"没取到结论"写成"人工判定",等于让每个后来人都重跑一遍
 * 昂贵的手工判定。三条判据只许有这一份实现,两个调用点不得各拼一遍措辞:
 *  1. 逐字带出结论行,不改写、不摘要;超上限就点名截断了多少行、多少字节。
 *  2. 取不到结论行(输出只有噪声、为空、或崩在装载期)⇒ 说 `未判定:<原因>`,
 *     禁止读成"需人工" —— 那是本层存在的理由。
 *  3. 子进程 exit 0 而外层仍失败 ⇒ 不得沿用"亦判需人工",它压根没判过这个。
 */

/** 本器贴在裁决文本末尾的退出码标签(union 自己从不打这一行,所以判据先剥掉它)。 */
export const UNION_EXIT_MARK_HEAD = '[relay:union-exit='
const UNION_EXIT_RE = /\[relay:union-exit=(\d+|unknown)\]/g

/** 把退出码拼成一行带出来。读不懂的码(信号终止等)落 unknown,不得冒充 0 或 1。 */
export function unionExitMark(code) {
  const c = Number.isInteger(code) && code >= 0 ? code : 'unknown'
  return '\n' + UNION_EXIT_MARK_HEAD + c + ']\n'
}

/** 剥掉转述层自己加的标签:判据只该看 union 说了什么,不该看本器贴的记号。 */
export function stripUnionExitMark(text) {
  return String(text ?? '').replace(UNION_EXIT_RE, '')
}

/** 读回子进程退出码。没带标签或形状不认识 ⇒ null,即"取不到";不得当成 0,也不当成 1。 */
export function readUnionExitCode(text) {
  let last
  for (const m of String(text ?? '').matchAll(UNION_EXIT_RE)) last = m[1]
  if (last === undefined || last === 'unknown') return null
  return Number(last)
}

/**
 * 声明透传的唯一判据(纯函数、零 IO、零副作用)。
 *
 * 为什么抽成导出函数而不是在派生点内联:这一格判的是"人的声明有没有送达" —— 它失效的
 * 形态是**安静**的(声明被吞 ⇒ union-converge 拿不到 ⇒ 每轮复读同一句判红,grep 日志
 * 只会看到"又红了一次",看不出"声明压根没送到"),所以必须能被镜像测试逐条钉:
 * ①命中/②顺序/③缺值不代猜/④非声明旗号一律不转发/⑤重复声明逐条保留。
 *
 * 纪律:本函数**只做"哪些 token 是声明"**,一个字节都不判断声明内容是否合理 ——
 * 举证(supersedeProof / 折叠四问)、"声明未命中照样判红"、"放行逐条打印并写进合并
 * 提交信息"全部仍在 union-converge 那一份实现里(§0.6 单一真相源,不在本器再写一遍)。
 *
 * 缺值**不代猜**(`--take-theirs-doc` 后面紧跟另一个旗号或没有 token):本器不替人编一个
 * 默认路径 —— 编了就是把"人声明了"和"人声明错了"变成同形。留空让 union-converge 的
 * "值没给"用法错出口来判,那才是唯一有资格说这句话的地方。
 */
export const DECLARATION_FLAGS = Object.freeze([
  '--take-theirs-doc',
  '--take-ours',
  '--take-theirs',
  '--resolve',
  '--union-capped',
  '--supersede',
])

export function declarationArgs(argv = process.argv) {
  const list = Array.isArray(argv) ? argv : []
  const out = []
  for (let i = 2; i < list.length; i++) {
    const flag = list[i]
    if (!DECLARATION_FLAGS.includes(flag)) continue
    const value = list[i + 1]
    if (value === undefined || String(value).startsWith('--')) continue
    out.push(flag, value)
    i++
  }
  return out
}

/**
 * `--take-theirs-doc` 的路径集(Set)形状 —— 与 `union-converge` 内部同一形态:
 * 收敛器那条路用 `takeTheirsDocs?.has?.(p)` 逐路径问,索引层这条路必须喂同一个形状,
 * 否则"人的声明"在两条路上是两种东西(§0.6:同一件事只许一种表示)。
 * 无声明 ⇒ 返回 `null`(不是空 Set):`null` 表示"这条维度本轮没开",空 Set 表示
 * "开了但一个路径都没声明",两者在下游语义不同,不得同形。
 */
export function declaredTheirsDocs(argv = process.argv) {
  const flat = declarationArgs(argv)
  const out = new Set()
  for (let i = 0; i < flat.length; i += 2) {
    if (flat[i] === '--take-theirs-doc') out.add(flat[i + 1])
  }
  return out.size > 0 ? out : null
}

/**
 * 把 union-converge 那一次尝试分成五态。为什么必须由判据分而不是只看退出码:
 * 非零退出同时覆盖了"它判了人工裁决"(人要接着解冲突)与"它根本没判"(依赖崩/空输出),
 * 把后者说成前者就会把人引去手工选边 —— 而 2026-09-24 的实测正是选边合并抹掉了对侧 35 个独有路径。
 * 为什么也不能只看文本:退 0 的两种形状("无需合并"与"落地那行措辞变了")在 stdout 里都不含
 * `✅ 合并落地`,只看文本就会把它们一起塞进 need-human —— 这正是转述层要修的第二格。
 * `crashed` 的两种形状:Node 的模块/异常指纹,或者一个字都没打(空输出同样判不出内容)。
 * 入参可以是字符串(兄弟镜像测试按字符串喂),也可以是带 exitCode 的对象。
 */
export function classifyUnionAttempt(input) {
  const raw = typeof input === 'string' ? input : String((input && input.text) ?? '')
  const given =
    input && typeof input === 'object' && Number.isInteger(input.exitCode) ? input.exitCode : null
  const exit = given === null ? readUnionExitCode(raw) : given
  const t = stripUnionExitMark(raw)
  if (t.includes('✅ 合并落地')) return 'landed'
  if (t.includes('UNDETERMINED') || t.includes('未判定:')) return 'undetermined'
  // 上面两支都没命中而它退 0:它没下过人工裁决,本器也不替它补一个。
  if (exit === 0) return 'exited-clean'
  if (t.trim() === '') return 'crashed'
  if (
    /does not provide an export|Cannot find module|ERR_MODULE_|ReferenceError|SyntaxError|TypeError|RangeError|#asyncInstantiate|at node:internal|Command failed/.test(
      t,
    )
  )
    return 'crashed'
  return 'need-human'
}

/**
 * 五态各自要说的那句话(措辞本身就是分流结果,所以单独成函数给镜像测试判"崩溃不得被说成需人工")。
 * 只有 need-human 那一支允许出现"需人工";其余四支都必须给出**可执行的下一步**。
 * need-human 那句原先写"(见上)"——那是谎:调用点在那之前一个字都没打印 union 的输出。
 */
export function unionOutcomeMessage(kind) {
  switch (kind) {
    case 'landed':
      return 'union-converge 已归并落地,转下一轮复核'
    case 'undetermined':
      return 'union-converge 判"无法判定"(远端真值/对象不在本机)⇒ 本轮不推进;这不是内容裁决:先按它给的出口补一次 fetch(或喂一个本地可达的 --theirs sha),再重跑本器'
    case 'crashed':
      return 'union-converge 这个进程**崩了**(import 期或运行时异常),它一处内容都没判 ⇒ 本轮不推进。这不是内容裁决,把冲突交给人工解只会走成"选边"并写没对侧独有内容;出路是先修那条被在飞改动打破的依赖(或等它落盘),再重跑本器'
    case 'exited-clean':
      return 'union-converge **正常退出(exit 0)却没报落地** ⇒ 它没下过人工裁决,本器不替它补一个结论。可能是它判了"无需合并/已是祖先",也可能是它那行落地措辞变了;出路是先跑只读的那一份(node scripts/union-converge.mjs --theirs <sha>,不带 --apply)读它自己的结论行,再重跑本器'
    default:
      return 'union-converge 亦判需人工(它的结论逐字见下,不再是"见上")'
  }
}

/** union 摘要行里的"需人工 N"(它自己那行 [union-converge] … / 需人工 N / …)。 */
export const UNION_NEEDHUMAN_RE = /需人工 (\d+)/
/** 落地闸不过的头行:顶格、以冒号结尾,其后才是缩进的逐条维度行。 */
export const UNION_GATE_HEADER_RE = /^\s*❌ 落地闸不过 (\d+) 处:\s*$/
/** 本器为崩溃补上的那行 stderr 出处(它是"为什么没判"的证据,必须随结论一起走)。 */
export const UNION_STDERR_LINE_RE = /^\[子进程 stderr\] /

const byteLen = (s) => Buffer.byteLength(String(s), 'utf8')

/**
 * 从 union-converge 的输出里挑出**它自己的结论行**,逐字、不改写:
 *  · 摘要行(带 `需人工 N`)
 *  · `❌ 落地闸不过 N 处:` 那一行,以及其后所有缩进条目行(union 自己封顶 15 条)
 *  · 崩溃/异常时那行 `[子进程 stderr]`(取不到结论时它就是原因)
 * 行数与字节两条上限,超了就点名截断了多少 —— 只封顶不喊,就等于又把"没带全"写成"带全了"。
 */
export function extractUnionVerdict(text, opts = {}) {
  const maxLines = Number.isInteger(opts.maxLines) && opts.maxLines > 0 ? opts.maxLines : 40
  const maxBytes = Number.isInteger(opts.maxBytes) && opts.maxBytes > 0 ? opts.maxBytes : 6000
  const lines = stripUnionExitMark(text).split(/\r?\n/)
  const picked = []
  let needHumanCount = null
  let gateCount = null
  let gateHeaderAt = -1
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (needHumanCount === null) {
      const m = UNION_NEEDHUMAN_RE.exec(l)
      if (m) {
        needHumanCount = Number(m[1])
        picked.push(l)
      }
    }
    if (gateHeaderAt < 0) {
      const g = UNION_GATE_HEADER_RE.exec(l)
      if (g) {
        gateCount = Number(g[1])
        gateHeaderAt = i
        picked.push(l)
      }
    }
  }
  if (gateHeaderAt >= 0) {
    for (let i = gateHeaderAt + 1; i < lines.length; i++) {
      const l = lines[i]
      // 条目行是缩进行;遇到顶格行说明这一段已经结束(后面的东西不属这一族)。空行跳过而不终止:
      // union 在闸条目之间不打空行,但换行由 console.log 拼,多一个空行不该把转述整段截断。
      if (/^[ \t]+\S/.test(l)) picked.push(l)
      else if (l.trim() === '') continue
      else break
    }
  }
  const errLine = lines.find((l) => UNION_STDERR_LINE_RE.test(l))
  if (errLine && !picked.includes(errLine)) picked.push(errLine)
  const totalBytes = picked.reduce((s, l) => s + byteLen(l), 0)
  const kept = []
  let bytes = 0
  for (const l of picked) {
    if (kept.length >= maxLines) break
    const nb = bytes + byteLen(l)
    if (nb > maxBytes && kept.length > 0) break
    kept.push(l)
    bytes = nb
  }
  const droppedLines = picked.length - kept.length
  const droppedBytes = Math.max(0, totalBytes - bytes)
  return {
    lines: kept,
    hits: {
      needHuman: needHumanCount !== null,
      gateBlock: gateCount !== null,
      none: needHumanCount === null && gateCount === null,
    },
    needHumanCount,
    gateCount,
    total: { lines: picked.length, bytes: totalBytes },
    kept: { lines: kept.length, bytes },
    truncated:
      droppedLines > 0 || droppedBytes > 0 ? { lines: droppedLines, bytes: droppedBytes } : null,
  }
}

/**
 * 给"原文证据"(merge-tree 的噪声等)用的封顶出口:同样必须点名截断了多少,
 * 不得静默变短 —— 静默变短就是伪造完整性,与本仓"失败必须响"同一条禁令。
 */
export function capText(text, opts = {}) {
  const maxLines = Number.isInteger(opts.maxLines) && opts.maxLines > 0 ? opts.maxLines : 15
  const maxBytes = Number.isInteger(opts.maxBytes) && opts.maxBytes > 0 ? opts.maxBytes : 2000
  const all = String(text ?? '').split(/\r?\n/)
  while (all.length > 0 && all[all.length - 1].trim() === '') all.pop()
  const totalBytes = all.reduce((s, l) => s + byteLen(l), 0)
  const kept = []
  let bytes = 0
  for (const l of all) {
    if (kept.length >= maxLines) break
    const nb = bytes + byteLen(l)
    if (nb > maxBytes && kept.length > 0) break
    kept.push(l)
    bytes = nb
  }
  const dropped = all.length - kept.length
  return {
    text: kept.join('\n'),
    total: { lines: all.length, bytes: totalBytes },
    kept: { lines: kept.length, bytes },
    truncated:
      dropped > 0 || bytes < totalBytes
        ? { lines: dropped, bytes: Math.max(0, totalBytes - bytes) }
        : null,
  }
}

/** 转述块:逐字结论行 + (被截断时的)点名行。没有结论行也要说出来,不得打印成空。 */
function renderUnionBlock(verdict) {
  const body =
    verdict.lines.length > 0
      ? verdict.lines.join('\n')
      : '(union-converge 没有可转述的结论行 —— 它那句判定没有到达本器)'
  if (!verdict.truncated) return body
  return (
    `${body}\n(转述已截断:结论共 ${verdict.total.lines} 行 / ${verdict.total.bytes} 字节,` +
    `此处带出 ${verdict.kept.lines} 行 / ${verdict.kept.bytes} 字节,` +
    `还差 ${verdict.truncated.lines} 行 / ${verdict.truncated.bytes} 字节)`
  )
}

/**
 * 把一次 union 尝试转述成外层可以直接打印的三段:kind / counts / headline + block。
 * headline 的规则就是本票的判据 2 与 3:
 *  · 取到了结论行 ⇒ 报条数(`落地闸不过 N 处 / 需人工 M 项 / exit=…`),`hasVerdict` 为真;
 *  · 没取到 ⇒ 一律 `未判定:<原因>`,任何一支都不许出现"亦判需人工"那句话。
 */
export function describeUnionRelay(input, opts = {}) {
  const text = typeof input === 'string' ? input : String((input && input.text) ?? '')
  const given =
    input && typeof input === 'object' && Number.isInteger(input.exitCode) ? input.exitCode : null
  const exitCode = given === null ? readUnionExitCode(text) : given
  const verdict = extractUnionVerdict(text, opts)
  const kind = classifyUnionAttempt(input)
  const mark = exitCode === null ? '退出码未取到' : `exit=${exitCode}`
  const counts = `落地闸不过 ${verdict.gateCount ?? 0} 处 / 需人工 ${verdict.needHumanCount ?? 0} 项 / ${mark}`
  const block = renderUnionBlock(verdict)
  if (kind === 'need-human' && !verdict.hits.none) {
    return {
      kind,
      exitCode,
      verdict,
      counts,
      hasVerdict: true,
      headline: `union 判需人工(${counts})`,
      block,
    }
  }
  const why =
    kind === 'landed'
      ? '它报了落地但没有结论行(落地本来不需要结论行)⇒ 属"本器与它的结论不同面",不是人工裁决'
      : kind === 'undetermined'
        ? '它自己判了未判定(远端真值/对象不在本机),没有下过人工裁决'
        : kind === 'crashed'
          ? `子进程没有产出可用输出(${mark})⇒ 一处内容都没判`
          : kind === 'exited-clean'
            ? `子进程 ${mark} 却没报落地 ⇒ 它没下过人工裁决`
            : `子进程 ${mark},输出里既没有「需人工 N」也没有「❌ 落地闸不过 N 处:」⇒ 本器没取到它的结论`
  // "没取到结论"这一支的出路**不得**借用 unionOutcomeMessage('need-human') 那句话:
  // 那句含"亦判需人工",而这一支的全部意义就是不许把它当成已经判过。
  const advice =
    kind === 'need-human'
      ? '出路是先跑只读的那一份(node scripts/union-converge.mjs --theirs <sha>,不带 --apply)读它自己打的结论行,再重跑本器;本器不替它把"没取到"写成"已判定"'
      : unionOutcomeMessage(kind)
  return {
    kind,
    exitCode,
    verdict,
    counts,
    hasVerdict: false,
    headline: `未判定:${why} ⇒ ${advice}`,
    block,
  }
}

/**
 * 合并面的**违禁桶判定面**(2026-10-27 立,根治"定罪面与过滤面两把尺",§0.6)。
 *
 * 判据只有一份:`auditPlan(content, { fields })` 里的 `dispositionOfV2` 就是派单出口
 * (`plan-tasks --open --dispatchable`)、门 130 F11/F12、兜底清扫器 `strip-banned-buckets.mjs`
 * 共用的那一把尺 —— 侧车命中以侧车为准,没命中才回落散文。**少传 fields 就是另一把尺**,
 * 而两把尺之差不是风格问题,是同一行被读成两个桶。
 *
 * 散文回落那一档再加一道**引述护栏**:`dispositionOf` 对"等人拍板"是两把尺取或
 * (`waitingHumanDirectVerdict` 措辞族,只过护栏① + `waitingHumanSelfVerdict`,带四道语法辖域护栏),
 * 于是行内**引用**禁令词的句子(实测 H01:`批四注记里我列进「等拍板」的…已收回`)会被 direct 尺
 * 命中、而带引号护栏的那把尺给出 `undetermined`(= 落在引号里、机器判不了是自指还是转述)。
 * 定罪面改用**带护栏的那把尺**复核,只认它明确说的这一种话:
 *  - `undetermined` ⇒ 判不准 ⇒ 落未判定并大声点名(既不定罪也不当干净,§0.3);
 *  - 其余(`self` / `null` / `negated`)⇒ **维持定罪**。`null` 只是"第二把尺没说话",
 *    措辞族那一把的裸命中照样算 —— 把 null 也降档等于放宽覆盖面(真等行 `需要用户拍板` 会漏放,
 *    那是比假红更坏的方向,任务书明令禁止)。
 * 侧车命中的行**不问**这道尺:结构化表态就是它的依据(与 lib 头注那两条恒定豁免同口径)。
 *
 * @param mergedText 合并面的 PROJECT_PLAN.md 全文
 * @param fields 合并面侧车的装载结果(`loadFields` 产物;不得是 undetermined)
 * @param localText 本地 HEAD 面的 PROJECT_PLAN.md 全文(调用方以被审 local rev 的 blob 现取;
 *        取不到输入传 null/undefined ⇒ 一律按"在本地"处理,维持既有硬拒 —— §0.3,失效方向
 *        绝不许是"读不到就放行")。逐行问「该行在不在本地 HEAD 面」是死锁收口的唯一核心判据:
 *        只在 origin 面的行本地改不到,硬拒它 = 焊死全仓推送(2026-10-27 实测)。
 * @returns `{face, undetermined}` —— face 的 F11/F12 名单与读数同步收窄
 *          (名单与 counts 不同形会让 `f11Ratchet` 落 `blind`,那一格本身就是不记绿);
 *          undetermined 条目带 `inLocal`(raw 是否逐字出现在本地 HEAD 面),调用方按它分流硬拒/点名。
 */
export function mergedLedgerFace(mergedText, fields, localText) {
  const a = auditPlan(mergedText, { fields })
  const undetermined = []
  // 本地 HEAD 面的行集合:一次 O(n) 构建,逐行 O(1) **整行等值**比对。不用 `includes` 子串匹配:
  // 子串会把"本地另一行恰好包含这段文字"误读成本行在本地,把纯对侧行错打成 inLocal=true,
  // 死锁只修一半;而 `raw` 来自 parseTaskRows 的逐行切分(不含换行),与行集合天然同形。
  const localLines = typeof localText === 'string' ? new Set(localText.split(/\r?\n/)) : null
  const inLocalOf = (raw) => (localLines ? localLines.has(raw) : true)
  const withGuard = (rows, guarded, bucket) =>
    rows.filter((r) => {
      const d = dispositionOfV2({ line: r.raw, fields })
      if (d.source !== 'prose') return true
      const v = guarded(r.raw)
      if (v !== 'undetermined') return true
      undetermined.push({ bucket, verdict: v, raw: r.raw, inLocal: inLocalOf(r.raw) })
      return false
    })
  a.waitingHumanRows = withGuard(a.waitingHumanRows ?? [], waitingHumanSelfVerdict, 'F11')
  a.counts.waitingHuman = a.waitingHumanRows.length
  a.waitingEnvRows = withGuard(a.waitingEnvRows ?? [], waitingEnvVerdict, 'F12')
  a.counts.waitingEnv = a.waitingEnvRows.length
  return { face: narrowF9Face(a, mergedText), undetermined }
}

/** 点名一行的截断出口(证据文本只给人看的形状,不充当判据;行号一律不印,§1)。 */
function clipRow(raw) {
  return String(raw).replace(/\s+/g, ' ').trim().slice(0, 60)
}

/**
 * 合并树里 `PROJECT_PLAN.md` 的任务状态是否被放大。两把尺子各钉一种真实形状:
 *  ① **相对两侧的上限**(union-converge 的 `planStateRegressions`):合并自己造出更多分叉;
 *  ② **相对入库基线**(`scripts/plan-task-state-baseline.json`,随门 130 一起入库的那份):
 *     一侧已把某一维清偿到基线、另一侧仍是旧形态时,①**看不见**这一型 ——
 *     max(两侧) 恰等于那个未清偿侧的数字。2026-09-26 实测即此:本地把 F6 从 8 收到 0,
 *     远端一份陈旧计划文档带着那 8 块进来,merge-tree 判"无冲突",而 max(两侧)=8 不报。
 * 基线一律从**合并树**取(与被审内容同一时刻同一面,不读磁盘也不读工作树);
 * 合并树里没有计划文档 ⇒ 这一维在该面上没有语义,返回 [] 而不是记绿。
 * 结构化侧车(`scripts/data/plan-fields.jsonl`)同样取**合并树**那一份(§0.4 同面同轮):
 * 取不到 ⇒ F11/F12 两维落未判定并点名,**绝不回落成"无侧车的散文面"** —— 那把尺不是过滤面的尺,
 * 2026-10-27 就是用它把全仓推送焊死的(合并面 `G-395…` 侧车已改判 owned-elsewhere、散文面仍读成
 * waiting-human ⇒ 一条根本不存在的"放大"拦下所有会话的推送 = §12e 恒红门)。
 */
export function mergedPlanStateRegressions(mergedTree, local, remote, repoRoot) {
  const REL = 'PROJECT_PLAN.md'
  const BASE_REL = 'scripts/plan-task-state-baseline.json'
  // git 的 rev 规格只认正斜杠:`FIELDS_REL` 由 path.join 造,本机是 `scripts\data\…`,
  // 照原样送会恒判"取不到"(同 plan-tasks.mjs 的 fieldsSpecRel,§12f:出路必须真跑得通)。
  const FIELDS_GIT_REL = FIELDS_REL.split('\\').join('/')
  const blobOf = (rev, rel) => {
    try {
      return git(['show', `${rev}:${rel}`], { cwd: repoRoot, maxBuffer: 1 << 26 })
    } catch {
      return ''
    }
  }
  // 侧车那一路必须把"该面上没有这个 blob"与"blob 在、内容为空"分开:前者 = 未判定,
  // 后者 = 零条记录(loadFields 的三态就是这么分的,本器不得把两者揉成一团)。
  const blobOrNull = (rev, rel) => {
    try {
      return git(['show', `${rev}:${rel}`], { cwd: repoRoot, maxBuffer: 1 << 26 })
    } catch {
      return null
    }
  }
  const merged = blobOf(mergedTree, REL)
  if (!merged.trim()) return []
  // 闸门尺子没装载成功 ⇒ 这一维**没跑**。绝不允许在这里返回 [] —— 那会把"看不见"写成"没有放大",
  // 而本器随后就 update-ref + 推送(本仓最高频的失效型:判据失效的表现永远是安静)。
  if (!unionGate.mod)
    return [
      `${STATE_GATE_UNDETERMINED} union-converge 装载失败 ⇒ 「相对两侧上限」那把尺子一处都没判(${unionGate.error});` +
        '这不是"没有放大"也不是"判了放大",本轮不推进。出路:把缺的那半边导出补上(或等它落盘)再重跑本器。',
    ]
  const out = unionGate.mod.planStateRegressions(merged, [blobOf(local, REL), blobOf(remote, REL)])
  const baseTxt = blobOf(mergedTree, BASE_REL)
  if (!baseTxt.trim()) return out
  let base = null
  try {
    base = JSON.parse(baseTxt)
  } catch {
    return [...out, '基线 JSON 解析失败 ⇒ 第②把尺子未判定(不记为通过)']
  }
  // 第②把尺子的 F9 一维必须吃**声明位口径**的面(G-460 之后):`auditPlan` 的 `collisions` 已是
  // 声明位档,但 `probe()` 里还带着宽口径 `wide` 的组数读数,拿它比只含声明位键的基线 ⇒
  // 现读 129 vs 112 这类"量纲不同"的红会在**每一次有台账变化的合并**上拦住自动收敛
  // (lib 头注写的触发条件已被 G-460 落锚踩响)。收口 = 同一份 narrowF9Face,不在本器另算一遍。
  // F11/F12 两臂(2026-10-23/2026-10-25 强制令)需要判定面本身 ⇒ 面作第三参传进去;而这一面
  // 必须与过滤面**同一把尺** = v2(侧车 ⊕ 散文),所以侧车也从合并树一起取(2026-10-27 收口:
  // 原先这里是"散文尺读数,merged 侧车不在手",于是定罪面与过滤面是两把尺 —— 见 mergedLedgerFace 头注)。
  const fields = loadFields(repoRoot, blobOrNull(mergedTree, FIELDS_GIT_REL))
  if (fields.undetermined) {
    // 侧车不在手 ⇒ 手上只剩散文那一把尺。这里**不**拿它给合并结果定罪(它不是过滤面的尺),
    // 也**不**读成干净:把 F11/F12 两维从本轮判定里摘出、大声落未判定,其余维度照旧硬判。
    // 基线里根本没有 F11/F12 这两个键时(旧形状基线),这两维本来就"缺项不判" ⇒ 不制造
    // 一条无人能处置的未判定行(缺项不判是 ratchetViolations 既有善意,不是本器放宽)。
    const banless = { ...base }
    delete banless.F11
    delete banless.F12
    const proseFace = narrowF9Face(auditPlan(merged), merged)
    out.push(...ratchetViolations(banless, probe(proseFace), proseFace))
    if (Object.hasOwn(base, 'F11') || Object.hasOwn(base, 'F12'))
      out.unshift(
        `${STATE_GATE_UNDETERMINED} 合并面取不到结构化侧车 ${FIELDS_GIT_REL}(${fields.why})` +
          ' ⇒ F11/F12 两维**未判定**:定罪面与过滤面必须是同一把尺(§0.6),本器不用无侧车的散文面定罪,' +
          '也不把"没判"读成干净。出路:让侧车与台账同面入库' +
          '(node scripts/plan-fields-extract.mjs --apply),或确认该面确实带着一份 plan-fields.jsonl,' +
          '再重跑本器。',
      )
    return out
  }
  // 本地 HEAD 面的台账文本:逐行问「该行在不在本地」的唯一取材面。用 blobOrNull 而不是 blobOf:
  // 取不到本地面(git 失败/rev 坏)时宁可保守维持既有硬拒(§0.10:失效方向是多要一次定向说明,
  // 不是跳门),绝不能把"读不到"读成"0 命中"静默放行;真正的"本地面无此行"由行集合精确判定。
  const localPlan = blobOrNull(local, REL)
  const { face: mf, undetermined: undecidedRows } = mergedLedgerFace(merged, fields, localPlan)
  out.push(...ratchetViolations(base, probe(mf), mf))
  // 判不准的行必须**报名**(§0.3),并按「该行在不在本地 HEAD 面」分流(2026-10-27 推送死锁收口):
  //  - 在本地 ⇒ live-doc-edit 的 REPLACE 改得到 ⇒ 维持既有硬拒:本地改完再推;
  //  - 只在 origin 面 ⇒ 本地永远改不到(REPLACE 要求 before 在被审面命中),硬拒 = 焊死全仓推送。
  //    降为普通点名行(REMOTE_ONLY_BAN_NOTE 前缀,主流程的未判定硬拒不认它):逐行点名
  //    bucket+截断行,不冒 STATE_GATE_UNDETERMINED,交台账侧车/清扫器通道处置。
  if (undecidedRows.length) {
    const inLocalRows = undecidedRows.filter((r) => r.inLocal)
    const remoteOnlyRows = undecidedRows.filter((r) => !r.inLocal)
    if (inLocalRows.length) {
      out.unshift(
        `${STATE_GATE_UNDETERMINED} 有 ${inLocalRows.length} 行的违禁桶命中只出自**无引号护栏的措辞族尺**,` +
          '而带语法辖域护栏的 self 尺判"引号内、判不了是自指还是转述"(叙述引文这一型)⇒ 本器不给它定罪,' +
          '也不当成干净(该行在本地 HEAD 面,本地改得到,改完再推):' +
          inLocalRows.map((r) => `${r.bucket}[${r.verdict}]=${clipRow(r.raw)}`).join(' / '),
      )
    }
    if (remoteOnlyRows.length) {
      out.push(
        `${REMOTE_ONLY_BAN_NOTE} ${remoteOnlyRows.length} 行引文型违禁桶命中只在 origin 面的台账行(本地 HEAD 面 0 命中)——` +
          '非本次收敛带来的,本地处置不了;随合并进本地后由台账侧车/清扫器通道处置:' +
          remoteOnlyRows.map((r) => `${r.bucket}[${r.verdict}]=${clipRow(r.raw)}`).join(' / '),
      )
    }
  }
  return out
}

/**
 * 把"子进程失败了"变成"子进程为什么失败"。
 *
 * `execFileSync` 抛出的 `e.message` 只有 `Command failed: <argv>` —— 真正的起因在 `e.stderr` 里。
 * 本仓为这一类"只剩一行栈/message"的不可诊断状态付过很多次代价(守门 93 的匿名 exit 2、
 * 门 94 的取材失败被吞成判据红……),所以收尾动作的告警**必须带原因与退出码**:
 * 并行会话持有 index.lock 时,对齐器失败是**常态**而不是异常,把它写成"Command failed"
 * 等于让下一个人重新去猜"到底是被锁还是真坏了"。
 */
export function alignFailureNote(e) {
  const code = typeof e?.status === 'number' ? `rc=${e.status}` : 'rc=未知'
  const cause =
    String((e && (e.stderr || e.stdout)) || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)[0] || String((e && e.message) || e || '未知原因').split('\n')[0]
  const timedOut = e && e.timedOut ? '(超时)' : ''
  return `${code}${timedOut} ${cause}`.slice(0, 200)
}

// ─── 收尾对齐状态台账(2026-09-25 票 O74:从"失败只记日志"到"能喊到人") ───
// 收敛器是"谁跑谁一次性"的进程,自己不适合直接发邮件;守护 git-guardian 每 2 分钟一轮,
// 已是所有自愈告警的派发点 ⇒ 本文件**只写** `.ihui-agent/state/converge-align-state.json`
// (失败 +1 / 成功归零并写 lastOkAt),阈值判断与到人只在 git-guardian.mjs 侧
// (`shouldAlertAlignStall` → `notifyGuardRed('converge-align-stall', …)`,§5e 唯一邮件通道)。
// 并发安全:临时文件 + renameSync 原子替换;读不到 / JSON 坏了 ⇒ 视作"无法判定"并照常重写。
// 收敛器停摆的代价远大于状态缺失,本层任何异常一律吞掉,绝不让状态文件把收敛器搞崩。
// 相对 repo 根的固定落点(recordAlignOutcome 用 resolve(repoRoot, ALIGN_STATE_FILE) 拼绝对)。
// **必须保持相对路径** —— 写成 resolve(cwd) 的绝对路径会让 repoRoot 参数形同虚设。
export const ALIGN_STATE_FILE = '.ihui-agent/state/converge-align-state.json'

/** 读状态;文件缺失 / 坏 JSON / 形状不对一律返回 null("无法判定"),不抛 */
export function readAlignState(p) {
  try {
    const s = JSON.parse(readFileSync(p, 'utf8'))
    if (!s || typeof s !== 'object' || !Number.isFinite(s.consecutiveFailures)) return null
    return s
  } catch {
    return null
  }
}

/** 原子写(临时文件 + rename);目录不存在即补建;任何失败只返回 false,不外抛 */
export function writeAlignState(p, s) {
  const tmp = `${p}.${process.pid}.tmp`
  try {
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(tmp, JSON.stringify(s, null, 1), 'utf8')
    renameSync(tmp, p)
    return true
  } catch {
    try {
      rmSync(tmp, { force: true })
    } catch {
      /* 清理临时文件失败也无所谓 */
    }
    return false
  }
}

/** 纯函数:由旧状态 + 本轮成败算出新状态(失败 +1 / 成功归零并写 lastOkAt) */
export function nextAlignState(prev, { ok, note, nowMs, roundMerges }) {
  const hasPrev = prev && typeof prev === 'object'
  const numOr = (v, dflt) => (Number.isFinite(v) ? v : dflt)
  if (ok) {
    return {
      consecutiveFailures: 0,
      lastFailAt: numOr(hasPrev ? prev.lastFailAt : null, null),
      lastOkAt: nowMs,
      lastNote: String(note ?? 'ok'),
      // 语义:本次对齐**实际修复的文件数**(0 = 无漂移,也是成功)
      lastRoundMerges: numOr(roundMerges, null),
    }
  }
  return {
    consecutiveFailures: numOr(hasPrev ? prev.consecutiveFailures : 0, 0) + 1,
    lastFailAt: nowMs,
    lastOkAt: numOr(hasPrev ? prev.lastOkAt : null, null),
    lastNote: String(note ?? ''),
    lastRoundMerges: numOr(roundMerges, null),
  }
}

/** 收敛器收尾处调用:把本轮对齐结果落进状态台账(整体吞异常,绝不影响收敛结论) */
export function recordAlignOutcome(repoRoot, ok, note, roundMerges) {
  try {
    const p = resolve(repoRoot, ALIGN_STATE_FILE)
    writeAlignState(
      p,
      nextAlignState(readAlignState(p), { ok, note, nowMs: Date.now(), roundMerges }),
    )
  } catch {
    /* 状态台账失败不回扰收敛 */
  }
}

/** a 是否为 b 的祖先(merge-base --is-ancestor 靠 exit code 判定;二态:非 0 一律 false) */
function isAncestor(a, b) {
  // 2026-10-26 迁 gitRaw(与 scripts/lib/bypass-git.mjs 已迁先例同型,但本器保持二态):
  // 旧 stdio 'ignore' 三口全弃、无 stdout 消费 ⇒ 层 pipe 面无差;旧 60s 封顶原样保留。
  try {
    gitRaw(['merge-base', '--is-ancestor', a, b], process.cwd(), { timeout: 60_000 })
    return true
  } catch {
    return false
  }
}

/**
 * 远端 sha 的对象存在性核验 —— ls-remote / FETCH_HEAD 只回一个 sha 字符串,**不保证提交对象
 * 已下载到本地对象库**;并发会话刚 push 时这正是常态(2026-09-27 上午两轮收敛皆在此裸栈:
 * `merge-base` 报 `Not a valid commit name`,`git()` 包装器抛、main 无 catch)。
 * 缺失时 isAncestor 还会**静默返回 false**(把"本地纯领先"判错方向),比抛异常更阴。
 * 所以核验放在解析出远端 sha 之后的**唯一一处**、任何需要对象的命令之前;缺失先定向 fetch
 * 自愈,仍补不到 ⇒ 判"无法判定"交调用方干净跳过本轮。
 * **不得**退化成读跟踪 ref 残值当替代(§5b:残值会合出过期结果,比不合更糟)。
 * @param run 可注入 git 执行器(失败返回 null,与 git() 包装器的 allowFail 同形)——
 *            自检/镜像测试要在临时仓构造"缺失/可补回"现场,不赌网络。
 */
export function ensureCommitObjectPresent(sha, branch, { run } = {}) {
  const exec = run ?? ((args) => git(args, { allowFail: true }))
  if (exec(['cat-file', '-e', `${sha}^{commit}`]) !== null) return { ok: true }
  exec(['fetch', 'origin', branch])
  if (exec(['cat-file', '-e', `${sha}^{commit}`]) !== null)
    return { ok: true, recoveredByFetch: true }
  return {
    ok: false,
    reason: `本地对象库无提交对象 ${sha.slice(0, 11)},定向 fetch origin ${branch} 后复核仍缺失`,
  }
}

// ─── 静默回退守门(纯函数,可单测;见文件头 2026-09-23 节) ──

/** 解析 `git ls-tree -r -z` 输出为 path → "mode blob" */
function parseLsTreeZ(output) {
  const map = new Map()
  for (const entry of output.split('\0')) {
    if (!entry) continue
    const m = entry.match(/^(\d+) \w+ ([0-9a-f]{40})\t([\s\S]*)$/)
    if (!m) throw new Error(`无法解析 ls-tree 条目:${entry.slice(0, 80)}`)
    map.set(m[3], `${m[1]} ${m[2]}`)
  }
  return map
}

/** 列出某 tree 的全部条目(root 注入, self-test 指向临时仓库) */
function collectTreeEntries(treeish, cwd) {
  // 真仓整树 ls-tree 输出 >1MB,必须放大 maxBuffer(层默认 64MB 已覆盖,原注释语义保留);
  // 2026-10-26 迁 gitRaw:binary 档取 Buffer(旧 encoding:'buffer' 同形),-z 分帧不经转义、
  // 与 core.quotepath 无涉;旧 300s 封顶与 stdin-ignore 形态(层无 input 态)原样保留。
  const out = gitRaw(['ls-tree', '-r', '-z', treeish], cwd, { binary: true, timeout: 300_000 })
  return parseLsTreeZ(out.toString('utf8'))
}

/**
 * 纯函数:揪出被合并吞掉的单边变更(无冲突合并的完备判据)。
 * base→local 与 base→remote 有且仅有一边动过的路径,合并树必须与动的那边逐字节一致。
 * @returns Array<{path, side: 'local'|'remote', expected: string|null, actual: string|null}>
 *   expected/action 为 null 表示"应删除/已删除"。
 */
function verifySingleSided(base, local, remote, merged) {
  const violations = []
  const paths = new Set([...base.keys(), ...local.keys(), ...remote.keys(), ...merged.keys()])
  for (const p of paths) {
    const b = base.has(p) ? base.get(p) : null
    const l = local.has(p) ? local.get(p) : null
    const r = remote.has(p) ? remote.get(p) : null
    const m = merged.has(p) ? merged.get(p) : null
    const changedLocal = l !== b
    const changedRemote = r !== b
    if (changedLocal && !changedRemote) {
      if (m !== l) violations.push({ path: p, side: 'local', expected: l, actual: m })
    } else if (changedRemote && !changedLocal) {
      if (m !== r) violations.push({ path: p, side: 'remote', expected: r, actual: m })
    }
    // 双边都改 → merge-tree 负责(冲突即失败),本守门跳过;双边未改 → 跳过。
  }
  return violations
}

/** 编排:取 base/local/remote/mergedTree 四树条目并比对(cwd 缺省当前仓库) */
function assertNoSilentRevert({ base, local, remote, mergedTree, cwd }) {
  const dir = cwd ?? process.cwd()
  return verifySingleSided(
    collectTreeEntries(base, dir),
    collectTreeEntries(local, dir),
    collectTreeEntries(remote, dir),
    collectTreeEntries(mergedTree, dir),
  )
}

// ─── --self-test(真仓库演练,临时仓库全在 gitignore 的 .ihui-agent/tmp 下) ──

/** 临时仓库 git 调用(身份/签名经 -c 注入,不依赖全局配置) */
function tgit(cwd, args, opts = {}) {
  // 2026-10-26 迁 gitRaw:身份三连 -c 经 argv 透传(与层前置的 -c 累积共存,git 语义不变);
  // root=临时仓路径现成;旧调用无封顶(夹具秒级操作),随迁取层默认 60s —— 有界方向与守门 80 一致。
  return gitRaw(
    [
      '-c',
      'user.name=ihui-test',
      '-c',
      'user.email=t@t.local',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    cwd,
    { timeout: opts.timeout, maxBuffer: opts.maxBuffer },
  ).trim()
}

/** 文本式 ls-tree 行(供 mktree 拼篡改树) */
function lsTreeLines(treeish, cwd) {
  // 2026-10-26 迁 gitRaw;夹具全 ASCII ⇒ quotepath 无输出形态差。旧 300s 封顶原样保留。
  return gitRaw(['ls-tree', treeish], cwd, { timeout: 300_000 })
    .trim()
    .split('\n')
}

/**
 * 用 mktree 按行拼树(行格式与 ls-tree 输出一致)。
 *
 * 2026-10-04 改(不是风格调整,是修一条实测出来的机器级限制)。原写法有两种,都撞死:
 *   ① `stdio: ['pipe','pipe','pipe'], input: …` —— 靠 Node 建 stdin 管道喂内容。
 *      本机上这条路 **100% 失败**,成组对照 20×2 实测:pipe 三态 ok=0/fail=20,
 *      firstErr=`spawnSync git EBUSY`;同机同命令同参数、只差 stdin 怎么来的 ignore 三态 ok=20/fail=0。
 *   ② 改用 `git mktree --input=<file>` —— **`mktree` 根本没有 `--input` 选项**
 *      (usage 只有 `[-z] [--missing] [--batch]`,实测报 unknown option)。这条路想当然。
 * 正解:**stdio 传数字 fd**(`openSync` 出来的真实句柄),子进程直接拿它当 stdin,
 * **完全不经过 Node 的管道机制**。实测 20/20 通过(mktree 与 hash-object 各 20/20)。
 *
 * 三条实测的合起来才是本条判据:本机派生 git 时,**能不能喂 stdin 取决于"管道由谁建"** ——
 * Node 建的必挂(EBUSY),OS 句柄直传的没事。所以 MEMORY 里"带 input 用 pipe 三态"那句是错的,
 * 已改:正确形态是数字 fd,或干脆用 git 支持的路径参数(若该动词真有的话)。
 */
function mktree(cwd, lines) {
  // 落在 cwd 内(而非 os.tmpdir):mktree 的 base 是仓库根,同盘临时文件避免跨卷与权限歧义。
  const tmp = resolve(
    cwd,
    `.ihui-mktree-${process.pid}-${Math.random().toString(36).slice(2, 8)}.tmp`,
  )
  let fd = null
  try {
    writeFileSync(tmp, lines.join('\n') + '\n', 'utf8')
    fd = openSync(tmp, 'r')
    return execFileSync('git', ['mktree'], {
      encoding: 'utf8',
      cwd,
      windowsHide: true,
      stdio: [fd, 'pipe', 'pipe'],
    }).trim()
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd)
      } catch {
        /* 句柄已随子进程退出而失效,close 失败不影响结论 */
      }
    }
    // 必删:临时文件留在工作区会被 status/guardian 当成未跟踪产物,进而污染对齐判据。
    try {
      rmSync(tmp, { force: true })
    } catch {
      /* 清理失败不掩盖真结果 */
    }
  }
}

/** 把行数组中 path 那行的 blob 换掉(拼"被回退"的树) */
function swapBlob(lines, path, newBlob) {
  return lines.map((ln) => (ln.endsWith(`\t${path}`) ? ln.replace(/[0-9a-f]{40}/, newBlob) : ln))
}

function selfTest() {
  const results = []
  // 未判定清单:尺子本身没装载成功时，这两例**没跑** —— 既不得记通过也不得记红，
  // 只点名并把原因打到末行(把"看不见"写成"判过了"是本仓最高频的失效型)。
  const undetermined = []
  const ok = (name, cond, extra = '') => {
    results.push(cond)
    console.log(`${cond ? '✅' : '❌'} ${name}${cond || !extra ? '' : ` (${extra})`}`)
  }
  let tmp = null
  try {
    // 2026-10-26 迁 gitRaw(bootstrap:取 root 前尚无仓库,显式传 process.cwd(),与旧无 -C 同形)。
    // 旧注释记过的 stdio 教训现由层保证(无 input 态 ['ignore','pipe','pipe'] + EBUSY 兜底)。
    const root = gitRaw(['rev-parse', '--show-toplevel'], process.cwd(), { timeout: 60_000 }).trim()
    tmp = resolve(root, '.ihui-agent/tmp/converge-selftest')
    rmSync(tmp, { recursive: true, force: true })
    mkdirSync(tmp, { recursive: true })
    const repo = resolve(tmp, 'repo')
    mkdirSync(repo, { recursive: true })
    tgit(repo, ['init', '-q', '-b', 'main'])
    // base: app.json=0.0.0(复刻事故现场) + keep.txt
    writeFileSync(resolve(repo, 'app.json'), '{"version":"0.0.0"}\n')
    writeFileSync(resolve(repo, 'keep.txt'), 'base\n')
    tgit(repo, ['add', '-A'])
    tgit(repo, ['commit', '-qm', 'base'])
    // 本地侧:0.0.0→0.0.1(单边);远端侧:加新文件(单边);keep.txt 双边未改
    tgit(repo, ['checkout', '-qb', 'side-local'])
    writeFileSync(resolve(repo, 'app.json'), '{"version":"0.0.1"}\n')
    tgit(repo, ['add', '-A'])
    tgit(repo, ['commit', '-qm', 'local bump'])
    tgit(repo, ['checkout', '-q', 'main'])
    tgit(repo, ['checkout', '-qb', 'side-remote'])
    writeFileSync(resolve(repo, 'new.txt'), 'remote\n')
    tgit(repo, ['add', '-A'])
    tgit(repo, ['commit', '-qm', 'remote add'])
    const base = tgit(repo, ['merge-base', 'side-local', 'side-remote'])
    const goodTree = gitRaw(['merge-tree', '--write-tree', 'side-local', 'side-remote'], repo)
      .trim()
      .split('\n')[0]
      .trim()
    ok('干净合并无冲突(40 位 tree)', /^[0-9a-f]{40}$/.test(goodTree), goodTree.slice(0, 20))
    // 用例 1:干净合并必须通过守门(含双边新增与未改文件)
    const v1 = assertNoSilentRevert({
      base,
      local: 'side-local',
      remote: 'side-remote',
      mergedTree: goodTree,
      cwd: repo,
    })
    ok('用例 1:干净合并零违反', v1.length === 0, JSON.stringify(v1).slice(0, 160))
    // 用例 2:事故复现 —— 把合并树里 app.json 换回 base 版,守门必须揪出
    const localBlob = tgit(repo, ['rev-parse', 'side-local:app.json'])
    const baseBlob = tgit(repo, ['rev-parse', `${base}:app.json`])
    const doctored = mktree(repo, swapBlob(lsTreeLines(goodTree, repo), 'app.json', baseBlob))
    const v2 = assertNoSilentRevert({
      base,
      local: 'side-local',
      remote: 'side-remote',
      mergedTree: doctored,
      cwd: repo,
    })
    ok(
      '用例 2:陈旧回退被拦截(路径/侧/期望/实得全对)',
      v2.length === 1 &&
        v2[0].path === 'app.json' &&
        v2[0].side === 'local' &&
        v2[0].expected === `100644 ${localBlob}` &&
        v2[0].actual === `100644 ${baseBlob}`,
      JSON.stringify(v2).slice(0, 200),
    )
    // 用例 PS-1/PS-2:合并落地闸的**第二把尺子** —— 两侧与合并结果同形时,相对 max(两侧)
    // 判不出"一侧已清偿、另一侧陈旧"那一型,必须靠"相对入库基线"。没有这两例,
    // 今天真实发生过的账复活在这道闸上就是隐形的。
    tgit(repo, ['checkout', '-q', 'main'])
    tgit(repo, ['checkout', '-qb', 'ps-debt', base])
    if (unionGate.mod) {
      const LP = (s) => s + '　'.repeat(Math.max(0, 46 - [...s].length))
      const BLK = [
        LP('- 块行一:整块登记被并发并集留下两份,行级四条看不见'),
        LP('- 块行二:第二行,过块级阈值才计入'),
        LP('- 块行三:第三行'),
      ].join('\n')
      writeFileSync(
        resolve(repo, 'PROJECT_PLAN.md'),
        `## 甲\n${BLK}\n## 乙\n${BLK}\n\n尾行非 bullet\n`,
        'utf8',
      )
      mkdirSync(resolve(repo, 'scripts'), { recursive: true })
      writeFileSync(
        resolve(repo, 'scripts/plan-task-state-baseline.json'),
        '{"F1":0,"F2":0,"F3":0,"F4":0,"F6":0,"F5":0}\n',
        'utf8',
      )
      // 侧车必须同批进夹具面(2026-10-27):合并面的 F11/F12 判定只认 v2 尺,而 v2 尺要先拿到
      // 侧车这份输入。**空文件 = 零条记录**(与"取不到 ⇒ 未判定"是两态,loadFields 分得开),
      // 这里要的是"面在、零条记录"那一态 —— 缺了它,PS-2 会被判成"侧车未判定"而不是"没有放大"。
      mkdirSync(resolve(repo, 'scripts/data'), { recursive: true })
      writeFileSync(resolve(repo, 'scripts/data/plan-fields.jsonl'), '', 'utf8')
      tgit(repo, ['add', '-A'])
      tgit(repo, ['commit', '-qm', 'ps debt'])
      const sha = tgit(repo, ['rev-parse', 'HEAD'])
      const r5 = mergedPlanStateRegressions(sha, sha, sha, repo)
      ok(
        '用例 PS-1:两侧与结果同形(F6=1)而基线是 0 ⇒ 第二把尺子必须点名',
        r5.some((x) => x.includes('F6')),
        JSON.stringify(r5).slice(0, 160),
      )
      // 反向对照:基线本来就写着 1 ⇒ 不得判红(否则这道闸把所有合并都堵死,与恒红门同罪)
      writeFileSync(
        resolve(repo, 'scripts/plan-task-state-baseline.json'),
        '{"F1":0,"F2":0,"F3":0,"F4":0,"F6":1,"F5":0}\n',
        'utf8',
      )
      tgit(repo, ['commit', '-aqm', 'baseline says 1'])
      const sha2 = tgit(repo, ['rev-parse', 'HEAD'])
      ok(
        '用例 PS-2:基线与实态一致 ⇒ 不得判红(尺子不能是恒真式)',
        mergedPlanStateRegressions(sha2, sha2, sha2, repo).length === 0,
        JSON.stringify(mergedPlanStateRegressions(sha2, sha2, sha2, repo)).slice(0, 160),
      )
    } else {
      undetermined.push(`用例 PS-1/PS-2 未跑:union-converge 装载失败(${unionGate.error})`)
    }
    // 用例 3:单边删除被"复活"同样拦截(期望缺失)
    tgit(repo, ['checkout', '-q', 'main'])
    tgit(repo, ['checkout', '-qb', 'del-local', base])
    tgit(repo, ['rm', '-q', 'keep.txt'])
    tgit(repo, ['commit', '-qm', 'local del'])
    tgit(repo, ['checkout', '-q', 'main'])
    tgit(repo, ['checkout', '-qb', 'del-remote', base])
    writeFileSync(resolve(repo, 'other.txt'), 'r\n')
    tgit(repo, ['add', '-A'])
    tgit(repo, ['commit', '-qm', 'remote add'])
    const base2 = tgit(repo, ['merge-base', 'del-local', 'del-remote'])
    const goodTree2 = gitRaw(['merge-tree', '--write-tree', 'del-local', 'del-remote'], repo)
      .trim()
      .split('\n')[0]
      .trim()
    const resurrected = mktree(
      repo,
      lsTreeLines(goodTree2, repo).concat(
        lsTreeLines(base2, repo).filter((ln) => ln.endsWith('\tkeep.txt')),
      ),
    )
    const v3 = assertNoSilentRevert({
      base: base2,
      local: 'del-local',
      remote: 'del-remote',
      mergedTree: resurrected,
      cwd: repo,
    })
    ok(
      '用例 3:单边删除被复活时拦截(期望缺失)',
      v3.length === 1 && v3[0].path === 'keep.txt' && v3[0].expected === null,
      JSON.stringify(v3).slice(0, 160),
    )
    // 用例 4:双边同改互异 → 守门跳过(冲突归 merge-tree 管)
    const bothMaps = {
      base: new Map([['f', '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']]),
      local: new Map([['f', '100644 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']]),
      remote: new Map([['f', '100644 cccccccccccccccccccccccccccccccccccccccc']]),
      merged: new Map([['f', '100644 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']]),
    }
    ok(
      '用例 4:双边互异跳过(零违反)',
      verifySingleSided(bothMaps.base, bothMaps.local, bothMaps.remote, bothMaps.merged).length ===
        0,
    )
    // 用例 5:纯 mode 变更(mode 相同 blob 不同 entry)被拦截
    const modeMaps = {
      base: new Map([['run', '100644 dddddddddddddddddddddddddddddddddddddddd']]),
      local: new Map([['run', '100755 dddddddddddddddddddddddddddddddddddddddd']]),
      remote: new Map([['run', '100644 dddddddddddddddddddddddddddddddddddddddd']]),
      merged: new Map([['run', '100644 dddddddddddddddddddddddddddddddddddddddd']]),
    }
    const v5 = verifySingleSided(modeMaps.base, modeMaps.local, modeMaps.remote, modeMaps.merged)
    ok('用例 5:纯 mode 回退被拦截', v5.length === 1 && v5[0].side === 'local')
    // 用例 6-8:「远端在哪」的唯一取法(§5b:跟踪 ref 会被清理、packed-refs 残值会被读回来;
    // 而 fetch/rev-parse 抛异常曾经把整轮收敛变成裸栈退出)。三态一律**构造**,不赌网络。
    const A = 'a'.repeat(40)
    const C = 'c'.repeat(40)
    const r6 = resolveRemoteHead('main', {
      run: (args) => (args[0] === 'ls-remote' ? `${A}\trefs/heads/main` : ''),
    })
    ok(
      '用例 6:ls-remote 可达 ⇒ 用服务器当次真值',
      r6.sha === A && /ls-remote/.test(r6.source),
      JSON.stringify(r6).slice(0, 90),
    )
    const r7 = resolveRemoteHead('main', {
      fetchedNow: true,
      run: (args) => {
        if (args[0] === 'ls-remote') throw new Error('offline')
        if (args[0] === 'rev-parse') return A
        return ''
      },
    })
    ok(
      '用例 7:ls-remote 不可达而本轮已 fetch ⇒ 退 FETCH_HEAD 并如实标注',
      r7.sha === A && /FETCH_HEAD/.test(r7.source),
      JSON.stringify(r7).slice(0, 90),
    )
    const r8 = resolveRemoteHead('main', {
      run: (args) => {
        if (args[0] === 'ls-remote') throw new Error('proxy down')
        if (args[0] === 'rev-parse') return C
        return ''
      },
    })
    ok(
      '用例 8:只剩跟踪 ref 残值 ⇒ 判"无法判定"且不抛(残值随结论报出,但不参与落槌)',
      r8.sha === null && r8.stale === C && /不足以判定/.test(r8.reason),
      JSON.stringify(r8).slice(0, 140),
    )
    // 用例 9-12:远端 sha 的**对象**不在本地(ls-remote 只回字符串;2026-09-27 上午两轮收敛
    // 都在这上面裸栈退出)。核验必须先定向 fetch 自愈、补不到判"无法判定",任何一态都不得抛。
    const calls9 = []
    const r9 = ensureCommitObjectPresent('d'.repeat(40), 'main', {
      run: (args) => {
        calls9.push(args[0])
        return args[0] === 'cat-file' ? null : ''
      },
    })
    ok(
      '用例 9:对象始终缺失 ⇒ 判"无法判定"、点名 sha、不抛(次序必为 cat-file→fetch→cat-file)',
      r9.ok === false &&
        r9.reason.includes('d'.repeat(11)) &&
        calls9.join(',') === 'cat-file,fetch,cat-file',
      JSON.stringify(r9).slice(0, 120),
    )
    // 用例 10:对象在位 ⇒ 一次 cat-file 即过,不发多余 fetch;缺失而 fetch 补回 ⇒ recoveredByFetch
    const r9b = (() => {
      let fetches = 0
      const r = ensureCommitObjectPresent('a'.repeat(40), 'main', {
        run: (args) => {
          if (args[0] === 'fetch') fetches++
          return ''
        },
      })
      return r.ok === true && !r.recoveredByFetch && fetches === 0
    })()
    const r9c = (() => {
      let probes = 0
      return ensureCommitObjectPresent('b'.repeat(40), 'main', {
        run: (args) => (args[0] === 'cat-file' ? (probes++ === 0 ? null : '') : ''),
      })
    })()
    ok(
      '用例 10:核验通过(对象在位)不发多余 fetch;fetch 补回必须带 recoveredByFetch 标记',
      r9b && r9c.ok === true && r9c.recoveredByFetch === true,
    )
    // 真临时仓现场(参照上方构造式夹具的落点,全在 gitignore 的 .ihui-agent/tmp 下):
    // "服务器已前移而本地无对象"必须用另一台机真的推一枚来造,只测注入会退化成把假设写成断言。
    const dir10 = resolve(tmp, 'obj-face')
    mkdirSync(dir10, { recursive: true })
    // 2026-10-26 迁 gitRaw:身份经 -c argv 透传(与层前置 -c 累积共存);夹具全为 file 协议本地仓,
    // 网络面零;旧 60s 封顶与 stdin-ignore 形态由层同形保留。
    const bg = (cwd, args) =>
      gitRaw(['-c', 'user.name=ihui-test', '-c', 'user.email=t@t.local', ...args], cwd, {
        timeout: 60_000,
      }).trim()
    const bare10 = resolve(dir10, 'origin.git')
    mkdirSync(bare10, { recursive: true })
    bg(dir10, ['init', '-q', '--bare', '-b', 'main', bare10])
    // 首枚 clone 不带 -b(空裸仓上 `clone -b main` 报 "Remote branch main not found");
    // 推送用显式 refspec 落 main,第二枚 clone 时 main 已存在才带 -b(remote-head 镜像测试同法)
    bg(dir10, ['clone', '-q', bare10, 'work'])
    const work10 = resolve(dir10, 'work')
    writeFileSync(resolve(work10, 'a.txt'), 'one\n')
    bg(work10, ['add', '-A'])
    bg(work10, ['commit', '-qm', 'one'])
    bg(work10, ['push', '-q', 'origin', 'HEAD:refs/heads/main'])
    bg(dir10, ['clone', '-q', '-b', 'main', bare10, 'other'])
    const other10 = resolve(dir10, 'other')
    writeFileSync(resolve(other10, 'b.txt'), 'two\n')
    bg(other10, ['add', '-A'])
    bg(other10, ['commit', '-qm', 'two'])
    bg(other10, ['push', '-q', 'origin', 'HEAD:refs/heads/main'])
    const runW = (args) => {
      try {
        return bg(work10, args)
      } catch {
        return null
      }
    }
    const tip10 = bg(work10, ['ls-remote', 'origin', 'refs/heads/main']).split('\t')[0]
    ok(
      '用例 11 阳性对照:ls-remote 的值确实在 work 仓解不出对象(否则下面整组用例无牙)',
      /^[0-9a-f]{40}$/.test(tip10) && runW(['cat-file', '-e', `${tip10}^{commit}`]) === null,
      tip10.slice(0, 11),
    )
    const r10 = ensureCommitObjectPresent(tip10, 'main', { run: runW })
    ok(
      '用例 11:对象缺失 ⇒ 定向 fetch 后复核补齐(ok + recoveredByFetch,自愈而非崩或谎报)',
      r10.ok === true && r10.recoveredByFetch === true,
      JSON.stringify(r10).slice(0, 120),
    )
    // 补不到的那一半同样用真 git:other 上造一枚**从未推送**的提交,fetch 结构上带不回它
    writeFileSync(resolve(other10, 'c.txt'), 'three\n')
    bg(other10, ['add', '-A'])
    bg(other10, ['commit', '-qm', 'three unpushed'])
    const ghost10 = bg(other10, ['rev-parse', 'HEAD'])
    const r11 = ensureCommitObjectPresent(ghost10, 'main', { run: runW })
    ok(
      '用例 12:定向 fetch 补不到(该提交从未上过服务器)⇒ 判"无法判定"且不抛',
      r11.ok === false && r11.reason.includes(ghost10.slice(0, 11)),
      JSON.stringify(r11).slice(0, 140),
    )

    // ── 用例 13-15:合并提交的身份必须自带(2026-09-27 部署环停摆的真因)──────────
    // 现场复刻服务身份:把 global/system 两份 config 指到不存在的路径,并抹掉 GIT_*_NAME/EMAIL,
    // 于是 git 只能走"自动探测"⇒ 与 IHUI-DEPLOYLOOP 以 LocalSystem 跑本器时同形。
    // **这一步是本组用例的全部价值**:不剥离配置的话,自检会在"交互账户配过身份的本机"上恒绿,
    // 证明的是我的 %USERPROFILE% 而不是服务的那份(§22c"镜像测试只复读实现就是复读机"同型)。
    const repoId = resolve(tmp, 'repo-identity')
    mkdirSync(repoId, { recursive: true })
    const idEnv = { ...process.env }
    for (const k of [
      'GIT_AUTHOR_NAME',
      'GIT_AUTHOR_EMAIL',
      'GIT_COMMITTER_NAME',
      'GIT_COMMITTER_EMAIL',
    ])
      delete idEnv[k]
    idEnv.GIT_CONFIG_GLOBAL = resolve(tmp, 'no-such-global-config')
    idEnv.GIT_CONFIG_SYSTEM = resolve(tmp, 'no-such-system-config')
    const ggit = (args, opts = {}) =>
      execFileSync('git', args, {
        encoding: 'utf8',
        cwd: repoId,
        windowsHide: true,
        env: idEnv,
        // 本函数全部调用点(init/add/commit/checkout/rev-parse/merge-base…)都**不传 input**,
        // 故 stdin 设 ignore 安全;若将来有调用点要传 input,必须同时把这里改成 ['pipe',…]。
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
        ...opts,
      }).trim()
    tgit(repoId, ['init', '-q', '-b', 'main'])
    writeFileSync(resolve(repoId, 'a.txt'), '1\n')
    tgit(repoId, ['add', '-A'])
    tgit(repoId, ['commit', '-qm', 'base'])
    const idParent = tgit(repoId, ['rev-parse', 'HEAD'])
    const idTree = tgit(repoId, ['rev-parse', 'HEAD^{tree}'])

    // 用例 13 = 阳性对照:没有身份 ⇒ git 必崩(证明"这一型确实会崩",而不是我在防一个假想故障)
    let nakedErr = ''
    try {
      ggit(['commit-tree', idTree, '-p', idParent, '-m', 'no identity'])
      nakedErr = 'UNEXPECTED-SUCCESS'
    } catch (e) {
      nakedErr = String(e.stderr || e.message || e)
    }
    ok(
      '用例 13:服务身份现场(无 global config)裸 commit-tree ⇒ 必失败(阳性对照,防自检恒绿)',
      /identity|auto-detect/i.test(nakedErr),
      nakedErr.split('\n')[0].slice(0, 90),
    )

    // 用例 14 = 修复本体:同一现场带身份 ⇒ 建得出提交,且身份逐字回读一致
    // (回读用 %cn/%ce 而不是只看退出码:非 ASCII 经 argv 传参在 Windows 上有码页风险,
    //  不闭环回读就是"命令成功了、提交里写着乱码"那一型静默失真。)
    let idOk = false
    let idNote = ''
    try {
      const made = ggit(
        mergeCommitArgs({ tree: idTree, parents: [idParent], message: 'with identity' }),
      )
      const back = ggit(['log', '-1', '--format=%cn%x00%ce', made])
      idOk = /^[0-9a-f]{40}$/.test(made) && back === '智汇AGI社区\0ok502319984@gmail.com'
      idNote = `sha=${made.slice(0, 11)} 回读=${JSON.stringify(back)}`
    } catch (e) {
      idNote = String(e.stderr || e.message || e)
        .split('\n')[0]
        .slice(0, 90)
    }
    ok('用例 14:mergeCommitArgs 带身份 ⇒ 同现场建提交成功且 %cn/%ce 逐字回读一致', idOk, idNote)

    // 用例 15 = 纯函数形状:身份必须在 commit-tree **之前**(git 只认前置的 -c),双父顺序不变
    const shape = mergeCommitArgs({ tree: 'T', parents: ['P1', 'P2'], message: 'M' })
    const ctIdx = shape.indexOf('commit-tree')
    ok(
      '用例 15:参数顺序 = 身份 -c 在前 → commit-tree → -p 逐个 → -m(单父也成立)',
      shape.join('\0') ===
        [
          '-c',
          'user.name=智汇AGI社区',
          '-c',
          'user.email=ok502319984@gmail.com',
          'commit-tree',
          'T',
          '-p',
          'P1',
          '-p',
          'P2',
          '-m',
          'M',
        ].join('\0') &&
        ctIdx === 4 &&
        shape.slice(0, ctIdx).join('\0') === GIT_MACHINE_IDENTITY.join('\0') &&
        mergeCommitArgs({ tree: 'T', parents: 'P1', message: 'M' }).join('\0') ===
          [...GIT_MACHINE_IDENTITY, 'commit-tree', 'T', '-p', 'P1', '-m', 'M'].join('\0'),
      shape.join(' '),
    )
    // 用例 16 = 孤儿合并提交的备份 ref 必须是守门 30a 认账的那一族(纯函数,正反成对)
    ok(
      '用例 16:备份 ref 名 = lost-commit/wip-conv-<sha7>(§29 命名族,30a 才认它是"已备份");' +
        'SHA 形状不对必须返回 null 而不是造出一个坏 ref',
      orphanBackupRefName('947ef34a88a2b4c1d2e3f4a5b6c7d8e9f0a1b2c3') ===
        'lost-commit/wip-conv-947ef34' &&
        orphanBackupRefName(''.padStart(40, 'a')) === `lost-commit/wip-conv-${'a'.repeat(7)}` &&
        orphanBackupRefName('') === null &&
        orphanBackupRefName('zxcvbn') === null &&
        orphanBackupRefName(undefined) === null,
      String(orphanBackupRefName('947ef34a88a2')),
    )
  } catch (e) {
    console.log(`❌ 自检异常:${e?.message ?? e}\n${e?.stack ?? ''}`)
    console.log(`   临时仓库保留在 ${tmp}(供排查,下次自检会清掉)`)
    return false
  }
  const pass = results.every(Boolean)
  for (const u of undetermined) console.log(`ℹ ${u} ⇒ 不计通过，也不判红`)
  console.log(
    pass
      ? `\nself-test 全通过(${results.length} 例${undetermined.length ? `,**另有 ${undetermined.length} 组未判定**` : ''})`
      : `\nself-test 失败`,
  )
  if (pass && tmp && undetermined.length === 0) rmSync(tmp, { recursive: true, force: true })
  return pass
}

// ─── 主流程(§22d:仅 direct-run 执行,被 import 时零副作用) ──
function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1)
  const getOpt = (name, dflt) => {
    const i = argv.indexOf(name)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
  }
  const branch = getOpt('--branch', 'main')
  const maxRounds = Number(getOpt('--rounds', 3))
  const dryRun = argv.includes('--dry-run')
  // `--no-proxy`(2026-10-26 立):显式临时绕开仓库配的代理。
  // 立因:当天给的出路"手打 `git -c http.proxy= …`"在本器上**跑不通**(本器自己派生 git,不吃调用方的 argv),
  // 违反 AGENTS §0.8「文档不得写跑不通的出路」。旗标只置 env(`IHUI_GIT_NO_PROXY=1`),
  // 由唯一取材层 `lib/face-reader.mjs` 的 `isForceDirect()` 认 —— 本器零判定复算(§0.6),
  // 且不写任何持久配置、不碰代理客户端。
  if (argv.includes('--no-proxy')) {
    process.env.IHUI_GIT_NO_PROXY = '1'
    log(C.dim, '  ℹ️ --no-proxy:本轮所有 git 网络命令走直连(临时绕过,不改 git 配置、不动代理客户端)')
  }

  const repoRoot = git(['rev-parse', '--show-toplevel'], { allowFail: true })
  if (!repoRoot) {
    log(C.red, '❌ 不在 git 仓库中')
    process.exit(2)
  }

  // ── `--status`(2026-10-18 立):只读回报收尾对齐停摆台账,零副作用 ────────────────
  // 立因不是"缺一个查询档",而是**告警正文写了这条出路却从没人实现它**:`scripts/git-guardian.mjs`
  // 的 converge-align-stall 邮件里印着「node scripts/git-sync-converge.mjs --status(只读看对齐状态)」,
  // 而本器的 argv 从未认过这个旗号。未识别的旗号在这里被静默忽略 ⇒ 收信人照信里那一行回车,
  // 实际执行的是**整轮收敛**(clean stale lock / fetch / merge-tree / commit-tree / update-ref / 推送)。
  // 一条自称只读、动手却改共享面的指令,比"根本没有这条出路"更坏(§0.8:给用户的每条命令必须
  // 真跑得通**且语义相符**)。本档补的就是那句承诺的语义:读状态、报数,然后原样退出。
  // 刻意不在这里复刻"该不该喊人"的阈值判据 —— 那份判据只有一份实现
  // (`git-guardian.mjs` 的 `shouldAlertAlignStall`,§22c),这里只报原始读数与它住在哪。
  if (argv.includes('--status')) {
    const st = readAlignState(resolve(repoRoot, ALIGN_STATE_FILE))
    log(C.dim, `── --status:收尾对齐停摆台账(只读,不 fetch、不合并、不推送)──`)
    log(C.dim, `  状态文件:${resolve(repoRoot, ALIGN_STATE_FILE)}`)
    if (!st || !Number.isFinite(st.consecutiveFailures)) {
      log(
        C.yellow,
        '  读数:无法判定(状态文件不在位、坏 JSON 或 consecutiveFailures 非有限数)' +
          ' ⇒ 守护这一族按"未判定 ⇒ 不喊"处理,不代表对齐成功过',
      )
    } else {
      const ageMs = Number.isFinite(st.lastFailAt) ? Date.now() - st.lastFailAt : null
      log(
        C.dim,
        `  consecutiveFailures=${st.consecutiveFailures}` +
          ` | lastFailAt=${Number.isFinite(st.lastFailAt) ? new Date(st.lastFailAt).toISOString() : '(缺失)'}${
            ageMs === null ? '' : ` (距今 ${Math.round(ageMs / 60000)} 分钟)`
          }`,
      )
      log(C.dim, `  最后真因:${String(st.lastNote ?? '(无)').slice(0, 200)}`)
      log(
        C.dim,
        '  该不该喊人由守护那一档判(阈值判据只有一份:scripts/git-guardian.mjs 的 shouldAlertAlignStall,' +
          '默认连续失败 ≥3 且距今 ≥10 分钟,env IHUI_ALIGN_STALL_FAILS / IHUI_ALIGN_STALL_AGE_MS 可覆盖)',
      )
      log(C.dim, '  要归零台账:node scripts/git-sync-converge.mjs --align-only(只跑收尾对齐,幂等)')
    }
    process.exit(0)
  }

  // 2026-09-19:收敛前清理 stale 锁(根治 index.lock 卡死)。
  // 收敛器做 fetch/merge-tree/commit-tree/update-ref 等写操作,stale index.lock 会全挂。
  try {
    execFileSync('node', ['scripts/git-lock.mjs', 'clean'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      cwd: repoRoot,
    })
  } catch {
    /* 清理失败不阻塞收敛 */
  }

  // ── `--align-only`(2026-10-04 立):只跑一次收尾对齐,不碰合并 ──────────────
  //
  // 立因是上面那段头注自己没盖住的一个洞:alignWorktreeAfterHeadMove 只在**真的推进了 HEAD**
  // 之后才被调用。于是"本地提交已被远端包含"这一轮(实测 2026-10-04:7 秒 rc=0)会整段跳过,
  // recordAlignOutcome 不被调 ⇒ `.ihui-agent/state/converge-align-state.json` 的
  // consecutiveFailures 永不归零 ⇒ 守护的 converge-align-stall 阈值**结构上无法靠跑收敛解除**。
  // 告警正文给的唯一出路正是"跑一轮收敛",而那条路在本地已同步时是空转 ——
  // 实测 10-03 07:41 失败后 24.8 小时无人推进,告警一直挂着,不是有人忽略它。
  //
  // 本旗标是那条出路真正需要的那一格:**只跑对齐器**(它自身幂等、判据在 heal-worktree-tracked),
  // 成败照旧写同一个状态文件,让"跑一次就能归零"成立。不碰合并、不 fetch、不碰远端。
  if (argv.includes('--align-only')) {
    log(C.dim, '── --align-only:只跑收尾对齐(不收敛、不推送)──')
    alignWorktreeAfterHeadMove()
    const st = readAlignState(resolve(repoRoot, ALIGN_STATE_FILE))
    // log 的签名是 (color, msg) —— 两参都要给。第一版只给了拼接好的整串,于是 color=整串、
    // msg=undefined,输出末尾挂一个 "undefined"(实测已复现),这类小瑕疵会让排障的人
    // 以为状态里还有别的字段没判干净。
    if (st && st.consecutiveFailures === 0) {
      log(C.green, '  ✅ 收尾对齐成功,停摆台账已归零')
    } else {
      log(C.yellow, `  ⚠️ 收尾对齐未成功(连续失败 ${st ? st.consecutiveFailures : '未知'} 次)`)
    }
    process.exit(0)
  }

  /**
   * 收敛成功后顺手对齐工作区幻影漂移(2026-09-23 立)。
   * 本器走 merge-tree/commit-tree/update-ref,只推进 HEAD 与 index、**从不 checkout**(§12d
   * "零触碰他人未提交文件"),于是每收敛一次,工作区就多一批落后文件 —— 实测本仓曾累计
   * 503 个文件落后 486 个提交,任何会话 `git add <file>` 都会把别人的改动静默回滚。
   * 对齐判据在 scripts/heal-worktree-tracked.mjs:索引==HEAD 且 工作区内容==该路径某祖先版本
   * 才动,任一不成立即放过 ⇒ 会话的真实未提交改动与有暂存的路径都不被覆盖。
   * 失败只记日志,绝不影响收敛结论(推送已成功)。
   * 2026-09-25 票 O74:成败都写进 .ihui-agent/state/converge-align-state.json,由 git-guardian
   * 按"连续 ≥3 次且最后失败 ≥10 分钟"的阈值经 notifyGuardRed 喊到人(只记日志不再是终点)。
   */
  function alignWorktreeAfterHeadMove() {
    try {
      const out = execFileSync(
        process.execPath,
        ['scripts/heal-worktree-tracked.mjs', '--align-drift', '--json'],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          cwd: repoRoot,
          // 子进程必须封顶:对齐器内部要写索引,并行会话持有 index.lock 时它会等/失败;
          // 无界等待等于把"收敛成功后的收尾"变成整条链的挂起点(守门 80 就是为这一族立的)。
          //
          // 2026-10-04 修(本条封顶与被调脚本的语义**自相矛盾**,是 24 小时停摆的成因):
          // 内层 `heal-worktree-tracked.mjs:87` 的 `makeGit` 是**刻意 `timeout: 0` 无界**的,
          // 理由已写在那个文件的头注里 —— 它的 `g` 同时承载写操作(update-index / read-tree /
          // restore),写操作中途被 SIGTERM **可能留下 .git/index.lock**,把一次挂起换成全局阻塞。
          // 于是两层语义打架:内层刻意无界,外层偏用 90s 砍它 ⇒ 撞满即 SIGTERM 整棵子树,
          // 恰好制造它想避免的那种局面。
          // 而 90s 这个数没有任何实测支撑:本机真仓四次实测 51/48/41/40 秒(2026-10-04),
          // **最坏余量只有 1.76 倍** —— 并发一叠加(部署环 / 守护 / 会话同时碰共享 gitdir,
          // 本机派生 git 本就 EBUSY)就必然撞满,这正是 10-03 07:41 那次 ETIMEDOUT 的形态。
          // 取 600s:既能覆盖 40–51s 的常态与数倍抖动,又仍是有限值(守门 80 的口径要的是
          // "有界",不是"够大就永不超时")。同文件 `attemptUnionConverge` 的
          // IHUI_UNION_CONVERGE_TIMEOUT_MS 是同一族做法(默认 1500s + env 可调),口径一致。
          timeout: ALIGN_DRIFT_TIMEOUT_MS,
        },
      )
        .trim()
        .split('\n')
        .pop()
      const r = JSON.parse(out || '{}')
      recordAlignOutcome(repoRoot, true, `aligned=${r.aligned ?? 0}`, r.aligned ?? 0)
      if (r.aligned) {
        log(C.dim, `  🧹 工作区幻影漂移已对齐 ${r.aligned} 个文件(HEAD 前进未 checkout 的后遗症)`)
      }
      // 落地欠回写(第五层)最该喊出来的位置就是这里:HEAD 刚被推进,活文档那条脏索引是**本轮**
      // 造成的。以前它无人负责,一路悬到别人提交(守门 84 判红)或挡住 `--ff-only`(停部署)。
      if (r.landingAligned) {
        log(C.dim, `  🧹 落地欠回写已对齐 ${r.landingAligned} 个路径的索引(只写索引,工作树未动)`)
      }
      for (const h of (r.landingHeld || []).slice(0, 3)) {
        log(C.yellow, `  ℹ️ ${h.path} 未按落地欠账对齐:${String(h.reason).slice(0, 120)}`)
      }
      for (const u of (r.landingUndetermined || []).slice(0, 3)) {
        log(C.yellow, `  ⚠️ 未判定 ${u.path}:${String(u.reason).slice(0, 120)}`)
      }
    } catch (e) {
      log(C.yellow, '  工作区漂移对齐未完成(不影响收敛结论): ' + alignFailureNote(e))
      recordAlignOutcome(repoRoot, false, alignFailureNote(e), null)
    }
  }

  for (let round = 1; round <= maxRounds; round++) {
    log(C.dim, `── 第 ${round}/${maxRounds} 轮 ──`)
    // fetch 失败**不是收敛器的失败模式**(休眠/瞬时锁/代理抖动都算不得结论),但也不能拿旧值继续判断
    let fetchedNow = false
    try {
      git(['fetch', 'origin', branch])
      fetchedNow = true
    } catch (e) {
      log(
        C.yellow,
        `  ⚠️ fetch 未完成:${String((e && e.message) || e)
          .split('\n')[0]
          .slice(0, 110)}`,
      )
    }
    const rHead = resolveRemoteHead(branch, { root: repoRoot, fetchedNow })
    if (!rHead.sha) {
      log(
        C.red,
        `❌ 无法判定远端位置 ⇒ 本轮不合并、不推送(绝不拿跟踪 ref 残值落槌):${rHead.reason}`,
      )
      log(
        C.yellow,
        '   手动核验:`git ls-remote origin refs/heads/' + branch + '`;通道排查见 AGENTS §5b/§20',
      )
      process.exit(2)
    }
    if (rHead.source !== 'ls-remote(当次服务器真值)')
      log(C.yellow, `  ⚠️ 远端值取自 ${rHead.source}(ls-remote 不可达),结论按此面给出`)
    const remoteHead = rHead.sha
    // 对象存在性核验的唯一一道闸:放在解析出远端 sha 之后、一切需要对象的消费者
    // (isAncestor / merge-base / merge-tree / commit-tree -p / ls-tree)之前,
    // 各调用点不得再各写一份(必然漂移)。
    const obj = ensureCommitObjectPresent(remoteHead, branch)
    if (!obj.ok) {
      log(
        C.red,
        `❌ 无法判定远端提交:${obj.reason}(远端值取自 ${rHead.source})⇒ 本轮不合并、不推送,转下一轮`,
      )
      continue
    }
    if (obj.recoveredByFetch) log(C.yellow, '  远端提交对象曾缺失,已由定向 fetch 补齐(继续收敛)')
    const localHead = git(['rev-parse', 'HEAD'])

    if (remoteHead === localHead) {
      log(C.green, `✅ 已收敛:本地 === 远端(${remoteHead.slice(0, 11)})`)
      process.exit(0)
    }
    if (isAncestor(localHead, remoteHead)) {
      // 远端已包含本地 → 并发期"被远端包含即为完成"
      log(C.green, `✅ 本地提交已被远端包含(${localHead.slice(0, 11)}),按并发纪律视为完成,不推送`)
      process.exit(0)
    }
    if (isAncestor(remoteHead, localHead)) {
      // 本地纯领先(可 fast-forward):直接 guard 推送,禁止 merge-tree——
      // 否则会造出冗余合并提交(历史噪音 + 新 headSha 使 push-gate 内容缓存失效)。
      log(C.yellow, `本地领先远端(FF 可达),跳过合并直接推送(${localHead.slice(0, 11)})`)
      if (dryRun) {
        log(C.dim, '  --dry-run:到此为止,不推送')
        process.exit(0)
      }
    } else {
      log(
        C.yellow,
        `分叉:本地 ${localHead.slice(0, 11)} / 远端 ${remoteHead.slice(0, 11)} → 索引层合并(不触碰工作区)`,
      )
      if (dryRun) {
        log(C.dim, '  --dry-run:到此为止,不合并不推送')
        process.exit(0)
      }
      // 输入新鲜度:合并且只用刚解析的 SHA,不用 ref 名 —— fetch→merge 窗口内若有并发
      // 推进了本地/远端引用,用旧 ref 名会合出"过期输入"的正确合并(静默丢变更)。
      const freshLocal = git(['rev-parse', 'HEAD'])
      // 新鲜度复核**更**要用当次服务器值:合并输入只要有一侧是残值,合出来的就是
      // "对过期输入做的正确合并" —— 它会安静地把别人刚推的东西当成不存在。
      const freshR = resolveRemoteHead(branch, { root: repoRoot, fetchedNow: false })
      if (!freshR.sha) {
        log(C.yellow, `  合并前复核远端失败(${freshR.reason.slice(0, 90)})⇒ 不合并不推送,转下一轮`)
        continue
      }
      // freshRemote 只有与 remoteHead 相等才会往下走合并(不等即 continue),
      // 而 remoteHead 的对象存在性已在轮首核过 ⇒ 这一处不需要、也不得再核一遍。
      const freshRemote = freshR.sha
      if (freshLocal !== localHead || freshRemote !== remoteHead) {
        log(C.yellow, '  本轮内引用已前移,重读输入后转下一轮(不合并不推送)')
        continue
      }
      const mergeBase = git(['merge-base', freshLocal, freshRemote])
      // 索引层合并树(worktree-preserving):冲突时 merge-tree 输出含冲突信息,tree 为 null 段
      // ⚠️ 本处**有意保留裸派生**(2026-10-26 型 B 收口第 10 轮判不可迁,依据同 bypass-git.mjs
      // 头注格式):catch 支的冲突噪声点名依赖失败调用的**完整 stdout**(下方 capText(e.stdout ??
      // e.message) 取 merge-tree 的 CONFLICT 行清单并计截断账),而层的 Undetermined 刻意不带
      // stdout(失败只回 stderr 首行)。改判据语义(退化到 message 一行)会丢掉点名冲突文件这一
      // 真信号;补取道要再派生一次 merge-tree,是第二把尺子。写操作面(临时 merge 对象)不在层
      // 的只读取材契约内。派生形态(stdio ignore/pipe/pipe + windowsHide)与层同;本调用无封顶
      // 为**迁移前既有形态**,随保留原样一并保留(不在本票范围内改动)。
      let tree
      try {
        const out = execFileSync('git', ['merge-tree', '--write-tree', freshLocal, freshRemote], {
          encoding: 'utf8',
          windowsHide: true,
          // EBUSY 免疫(ihui-spawn-ebusy-fix):本调用不吃 stdin,绕开坏管道路径
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        tree = out.trim().split('\n')[0].trim()
        if (!/^[0-9a-f]{40}$/.test(tree)) throw new Error(out)
      } catch (e) {
        // 冲突 ≠ 只能人工。人工接手时最容易犯的错是**选边** —— 2026-09-24 就是有一枚"取某一侧整棵树"
        // 的合并把对侧独有新增的 35 个路径整批抹掉(净 −12014 行),而它的提交信息写着"每一行均存活"。
        // 所以先让 union-converge 试一次**文件面零丢失**的归并(本侧整棵树 ∪ 对侧自身改动 ∪ 活文档
        // 行 union,落地前自证 0 丢失、落地后由守门 100 复核);它也不收敛才退回人工。
        const uni = attemptUnionConverge(freshRemote, repoRoot)
        const uniKind = classifyUnionAttempt(uni)
        if (uniKind === 'landed') {
          log(C.green, `↻ merge-tree 冲突已由 union-converge 归并,转下一轮复核\n${uni.trim()}`)
          continue
        }
        // 先分"没资格判",再谈"需人工":顺序反过来就等于把一次网络失败(G-473 那一型)或一次
        // **依赖崩溃**(G-815406 那一型:子进程根本没跑到判内容)说成一次内容裁决,
        // 而下一条路会把人引去手工解冲突 —— 手工最容易犯的错正是选边,而选边会写没对侧独有内容。
        // 措辞只许有 describeUnionRelay 那一份实现:两个调用点各拼一遍,就是"上面说实话、下面说谎"。
        const relay = describeUnionRelay(uni)
        // merge-tree 的噪声点名了哪些文件冲突,是真信号,但它不是 union 的判定 —— 旧代码把它
        // 顶在那句结论下面,读的人就以为那是 union 说过的话。截断也必须自己点名。
        const n = capText(e.stdout ?? e.message)
        const noise =
          `—— 以下是 merge-tree 的冲突噪声,不是 union 的判定` +
          (n.truncated
            ? `(截断 ${n.truncated.lines} 行 / ${n.truncated.bytes} 字节,原文共 ${n.total.lines} 行)`
            : '') +
          `:\n${n.text}`
        if (relay.hasVerdict) {
          log(
            C.red,
            `❌ 合并冲突,且 union-converge 亦判需人工(${relay.counts})。它那句话逐字如下,不再是"见上":\n${relay.block}\n${noise}`,
          )
        } else {
          log(C.red, `❌ ${relay.headline}\n${relay.block}\n${noise}`)
        }
        process.exit(1)
      }
      log(C.dim, `  合并树 ${tree.slice(0, 11)}(无冲突)`)
      /**
       * 活文档状态回归(与冲突分支共用归并出口,只是触发条件不同)。
       * 为什么无冲突分支**也**要判:`merge-tree` 的三方合并在"一侧新增整块、另一侧从未有过"时
       * 不报冲突,直接把那块搬进结果 —— 2026-09-26 实测:本地已把整块重复(F6)从 8 清偿到 0,
       * 远端一份陈旧计划文档带着那 8 块进来,收敛器一路"无冲突 ✅ 推进",已付的账原地复活,
       * 连同一枚刚登记的行一起不见了,而账面写的是"HEAD 已含全部登记行"。
       * 两把尺子(相对两侧上限 + 相对入库基线)与"为什么第一把看不见这一型"写在
       * `mergedPlanStateRegressions` 头注;维度清单只有一份 = plan-tasks 导出的 probe()。
       */
      const regressions = mergedPlanStateRegressions(tree, freshLocal, freshRemote, repoRoot)
      // 闸门尺子自己没跑成 ⇒ 这不是"内容放大"，也不得读成"没有放大"。单列一支、给出口，
      // 不要顺着下面的"放大"文案把人引去手工选边(G-815406)。
      // 2026-10-27:判据改成**逐条扫**而不是只看第 0 条 —— 侧车取不到 / 引文判不准这两型都可能是
      // 第 N 条(第①把尺子先报过别的内容),只看首条就会把"没判"当成"判了放大",
      // 随后派生 union-converge --apply 去解一个并不存在的冲突(§0.3 / §12f)。
      const gateUndetermined = regressions.filter((r) => r.startsWith(STATE_GATE_UNDETERMINED))
      if (gateUndetermined.length > 0) {
        for (const r of gateUndetermined) log(C.red, `❌ ${r}`)
        process.exit(1)
      }
      if (regressions.length > 0) {
        log(C.red, `❌ 无冲突合并放大了活文档任务状态(${regressions.length} 条),拒绝推进:`)
        for (const r of regressions.slice(0, 8)) log(C.red, `   ${r}`)
        const uniOut = attemptUnionConverge(freshRemote, repoRoot)
        const uniOutKind = classifyUnionAttempt(uniOut)
        if (uniOutKind === 'landed') {
          log(
            C.green,
            `↻ 状态放大已由 union-converge 归并,转下一轮复核\n${uniOut.trim().split('\n').slice(-2).join('\n')}`,
          )
          continue
        }
        // 这一支原先把"没取到结论"直接说成人工裁决,而那之前只贴了本器自己那 8 条放大行 ——
        // union 的结论一个字都没带出来,与冲突分支同一句谎,只是更安静。
        const relay2 = describeUnionRelay(uniOut)
        if (!relay2.hasVerdict) {
          log(C.red, `❌ ${relay2.headline}\n${relay2.block}`)
          process.exit(1)
        }
        log(
          C.red,
          `❌ union-converge 判需人工(${relay2.counts})。状态放大不是"选边"能收的 —— 两侧的行都得保住。它的结论逐字如下:\n${relay2.block}`,
        )
        process.exit(1)
      }
      // 单边变更保持守门(fail-closed):任一单边变更丢失即拒绝推进,绝不 update-ref/推送。
      const violations = assertNoSilentRevert({
        base: mergeBase,
        local: freshLocal,
        remote: freshRemote,
        mergedTree: tree,
        cwd: repoRoot,
      })
      if (violations.length > 0) {
        log(C.red, `❌ 合并树静默回退 ${violations.length} 处,拒绝推进(fail-closed):`)
        for (const v of violations.slice(0, 20)) {
          log(
            C.red,
            `   ${v.side === 'local' ? '本地' : '远端'}独改 ${v.path} 期望 ${v.expected ?? '(删除)'} 实得 ${v.actual ?? '(删除)'}`,
          )
        }
        process.exit(1)
      }

      /**
       * 落地前复量(票「合流会静默吞掉『已真机验证』的代码修复,而守门 76/71 对此零覆盖」):
       * 本侧已提交的内容是否仍被合并结果包含。判据全部 import union-converge 的既有自证出口
       * (`verifyUnion` + `lostAddedLines`),本器零复算 —— 与它自己的落地闸是同一份尺子。
       * `assertNoSilentRevert` 对**双侧同改**的路径结构上跳过,而本票的事故恰是双侧同改同一文件:
       * 路径还在、整 blob 却取了对方侧 ⇒ 只有"行"这条面看得见。未判定一律 exit 2,不落绿。
       */
      const preserved = preAdvanceLocalPreserved({
        local: freshLocal,
        remote: freshRemote,
        tree,
        base: mergeBase,
        cwd: repoRoot,
        takeTheirsDocs: declaredTheirsDocs(process.argv),
      })
      const preservedVerdict = localPreservedVerdict(preserved)
      if (preservedVerdict.status === 'undetermined') {
        log(C.red, '❌ 落地前「本侧已提交内容仍在」复量未判定(不记绿,本轮不推进 HEAD):')
        for (const u of preserved.undetermined.slice(0, 10)) log(C.red, `   · ${u}`)
        log(
          C.yellow,
          '   这不是"没丢",也不是"判了丢" —— 判据一处都没跑成。补上缺的出口/输入后重跑本器(未造合并提交、未动 HEAD)。',
        )
        process.exit(2)
      }
      if (preservedVerdict.status === 'lost') {
        log(
          C.red,
          `❌ 合并结果吞掉 ${preserved.bad.length} 处本侧已提交内容(union-converge 自证出口,import 复用)⇒ 拒绝推进 HEAD,绝不 update-ref/推送:`,
        )
        for (const b of preserved.bad.slice(0, 20)) log(C.red, `   · ${b}`)
        if (preserved.bad.length > 20)
          log(
            C.red,
            `   …另 ${preserved.bad.length - 20} 处(本侧 ${freshLocal.slice(0, 11)} / 远端 ${freshRemote.slice(0, 11)} / 合并树 ${String(tree).slice(0, 11)})`,
          )
        log(
          C.yellow,
          `   人工出口:被吞的本侧改动走 scripts/object-space-land.mjs 前向重落(先 git tag lost-commit/<全40位> 保全原枚);` +
            `判据本身错了就改判据(带反证用例),**不得**删掉本器里这条断言。`,
        )
        process.exit(1)
      }
      log(
        C.dim,
        `  本侧保留复量(union-converge verifyUnion + lostAddedLines):路径/活文档行/双侧同改文件独有行 0 处丢失` +
          `(行面判 ${preserved.judged} 枚文件${preserved.skipped ? `,另 ${preserved.skipped} 枚二进制/超大未按行判` : ''})`,
      )

      const mergeMsg = `Merge origin/${branch} (worktree-preserving sync via git-sync-converge) round${round}`
      const mergeSha = git(
        mergeCommitArgs({ tree, parents: [freshLocal, freshRemote], message: mergeMsg }),
      )
      // 推进前复量(G-939):合并提交吞掉任一"某父独有的新增"⇒ 拒绝推进。旁路不跑钩子 ⇒
      // 提交链那道守门 100 对这条路永不可见,故在这里借它自己的 A1 判据再问一次(零复算)。
      const loss = preAdvanceAdditionLoss({ mergeSha, cwd: repoRoot })
      const lossVerdict = additionLossVerdict({
        lost: loss.lost,
        skip: process.env.IHUI_SKIP_CONVERGE_ADDITION_LOSS === '1',
        reason: String(process.env.IHUI_SKIP_CONVERGE_ADDITION_LOSS_REASON ?? '').trim(),
      })
      if (lossVerdict.block) {
        log(
          C.red,
          `❌ 合并树吞掉 ${lossVerdict.lost} 处"某侧独有新增"(守门 100 的 A1 判据,经 import 复量)⇒ 拒绝推进 HEAD,绝不 update-ref/推送:`,
        )
        for (const l of loss.lost.slice(0, 20)) {
          log(C.red, `   · ${l.path}  由父 ${String(l.addedBy).slice(0, 11)} 独有,合并结果里没有`)
        }
        if (lossVerdict.lost > 20)
          log(C.red, `   …另 ${lossVerdict.lost - 20} 处(逐条见 git show ${mergeSha.slice(0, 11)})`)
        // 已 commit-tree 的合并提交此刻成悬空对象 ⇒ 必须先按 §29 备份,否则把 30a 的红转嫁给下一位提交者
        backupOrphanMerge(mergeSha, 'addition-loss')
        log(
          C.yellow,
          `   人工出口:① 被吞侧的内容重落走 scripts/object-space-land.mjs(先 git tag lost-commit/<全40位> 保全原枚);` +
            `② 判据本身错了就改判据(带反证用例),确属误判时的应急出口是 IHUI_SKIP_CONVERGE_ADDITION_LOSS=1 **且必须同时带** IHUI_SKIP_CONVERGE_ADDITION_LOSS_REASON=<原因>。`,
        )
        log(
          C.red,
          lossVerdict.bareSkip
            ? `❌ 裸跳门标记(IHUI_SKIP_CONVERGE_ADDITION_LOSS=1)不放行:缺 IHUI_SKIP_CONVERGE_ADDITION_LOSS_REASON ⇒ 本枚拒绝推进`
            : `❌ 本枚拒绝推进(未给应急出口)—— 吞并已推送提交不是可以咽下的成本`,
        )
        process.exit(1)
      }
      if (lossVerdict.skipUsed) {
        log(
          C.yellow,
          `⚠️ 吞并复量按应急出口放行(留痕):原因=${String(process.env.IHUI_SKIP_CONVERGE_ADDITION_LOSS_REASON ?? '').trim().slice(0, 160)} —— 被吞新增不会因此回来,请照人工出口补落`,
        )
      } else {
        // 过了也得把"判过"这件事量出来:静默通过和"根本没跑到这一步"在日志里同形,
        // 而这一格正是 G-939 立项的原因(吞并已推送提交被咽下)。判据取不到输入时
        // atRefUndetermined 非空 ⇒ 单独喊,不并进"零丢失"那句(§0.3)。
        log(
          C.dim,
          `  吞并复量(守门 100 A1,import 复量):某父独有新增丢失 ${loss.lost.length} 处 / 后手补回 ${loss.repaired.length} 处`,
        )
        if (loss.atRefUndetermined)
          log(C.yellow, `  ⚠️ 吞并复量有一维未判定:${loss.atRefUndetermined} ⇒ 本轮结论只按"合并结果是否缺路径"判`)
      }
      // 推进前复量(G-939 同源根因):合并提交把任一"本侧显式删除"的文件带回结果树 ⇒ 拒绝推进。
      // 旁路不跑钩子 ⇒ 守门 168 对这条路永不可见,故在这里借它自己的判据再问一次(零复算)。
      const resurrect = preAdvanceDeletionResurrection({
        mergeSha,
        parents: [freshLocal, freshRemote],
        cwd: repoRoot,
      })
      const resurrectVerdict = deletionResurrectionVerdict({
        reds: resurrect.reds,
        undetermined: resurrect.undetermined,
        skip: process.env.IHUI_SKIP_CONVERGE_DELETION_RESURRECTION === '1',
        reason: String(process.env.IHUI_SKIP_CONVERGE_DELETION_RESURRECTION_REASON ?? '').trim(),
      })
      if (resurrectVerdict.block) {
        log(
          C.red,
          `❌ 合并树把 ${resurrect.reds.length} 处"本侧显式删除"带回结果树(守门 168 判据,经 import 复量)⇒ 拒绝推进 HEAD,绝不 update-ref/推送:`,
        )
        for (const r of resurrect.reds.slice(0, 20)) {
          log(C.red, `   · ${r.path}  在父 ${String(r.ours).slice(0, 11)} 本侧被删,合并结果树里又出现`)
        }
        if (resurrect.undetermined.length) {
          log(
            C.yellow,
            `  ⚠️ 另有 ${resurrect.undetermined.length} 条未判定(fail-closed,按拦处理):${resurrect.undetermined.slice(0, 3).join(' / ')}`,
          )
        }
        // 已 commit-tree 的合并提交此刻成悬空对象 ⇒ 必须先按 §29 备份,否则把 30a 的红转嫁给下一位提交者
        backupOrphanMerge(mergeSha, 'deletion-resurrection')
        log(
          C.yellow,
          `   人工出口:被带回的文件若确应恢复,先在台账 scripts/data/deletion-survival-allowlist.json 登记该路径(载明原因 + 复核日)再重跑;` +
            `确属误判时的应急出口是 IHUI_SKIP_CONVERGE_DELETION_RESURRECTION=1 **且必须同时带** IHUI_SKIP_CONVERGE_DELETION_RESURRECTION_REASON=<原因>。`,
        )
        log(
          C.red,
          resurrectVerdict.bareSkip
            ? `❌ 裸跳门标记(IHUI_SKIP_CONVERGE_DELETION_RESURRECTION=1)不放行:缺 IHUI_SKIP_CONVERGE_DELETION_RESURRECTION_REASON ⇒ 本枚拒绝推进`
            : `❌ 本枚拒绝推进(未给应急出口)—— 删除被静默复活不是可以咽下的成本`,
        )
        process.exit(1)
      }
      if (resurrectVerdict.skipUsed) {
        log(
          C.yellow,
          `⚠️ 删除复活复量按应急出口放行(留痕):原因=${String(process.env.IHUI_SKIP_CONVERGE_DELETION_RESURRECTION_REASON ?? '').trim().slice(0, 160)} —— 被带回的删除不会因此消失,请照人工出口处置`,
        )
      } else {
        // 过了也得把"判过"这件事量出来:静默通过和"根本没跑到这一步"在日志里同形,
        // 而这一格正是 G-939 立项的原因(删除被静默复活)。台账路径豁免的条目报出来,不静默消失。
        log(
          C.dim,
          `  删除复活复量(守门 168,import 复量):硬红 ${resurrect.reds.length} 处 / 豁免 ${resurrect.waived.length} 处 / 未判定 ${resurrect.undetermined.length} 处`,
        )
      }
      // CAS 更新引用:only-if-HEAD 未动。被并发推进则本轮作废转下一轮,
      // 绝不覆盖他人刚落地的本地提交(覆盖=丢 commit,见 AGENTS.md §22)。
      const cas = git(['update-ref', `refs/heads/${branch}`, mergeSha, freshLocal], {
        allowFail: true,
      })
      if (cas === null) {
        log(C.yellow, '  本地 HEAD 被并发推进,本轮作废,转下一轮重来')
        // 这一枚合并提交此刻已成**悬空对象**。守门 30a(check-commit-loss-guard)对
        // "未备份的悬空 commit"是 blocking,而它**没有 stagedTriggers ⇒ 每一次提交都必跑**
        // ——于是一轮正常的并发争用会把全链 158 道检查对之后每一次提交都顶成 --no-verify。
        // 2026-09-27 同日两例:一枚 round3 悬空 merge 让所有会话的提交被挡,最后是人工补 tag
        // 才消红(见 AGENTS §12f"恒红门优先级")。出路 = §29 既定的零损失流程:tag 指向原对象
        // (不删、不改写、不碰别人的引用),再固化进 packed-refs —— 嵌套 refs/tags/<ns>/* 属
        // depth≥2,不 pack 就会被宿主清理层删掉,下次照样红(tag 在 = 红在,等于没修)。
        // tag 失败只报数:多一枚悬空是 30a 该喊的事,不能因此让收敛器在本轮罢工。
        backupOrphanMerge(mergeSha, `round${round}`)
        continue
      }
      log(C.dim, `  合并提交 ${mergeSha.slice(0, 11)} 已推进本地 ${branch}`)
      // commit-tree 旁路**不跑钩子**,守门 71 的 post-commit 自愈因此永不触发。实测一枚收敛合并
      // 把并发会话已入库的登记行合掉且无人知晓(2026-09-22/23 两次),故在落合并提交后就地补跑一次
      // 自愈(只加不减;失败不阻断收敛,下一枚走钩子的提交仍会再兜一次)。
      postMergeLedgerSync({ root: repoRoot, log: (s) => log(C.yellow, s) })
    }

    // 官方通道推送(guard 异步化:命令秒回,推送在后台 worker 执行)
    execFileSync('node', ['scripts/git-push-guard.mjs'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      cwd: repoRoot,
    })

    // 等待后台推送落定再决策(2026-09-18 晚修复:此前立即查远端,推送还在 270s 门里
    // 未完成即误判"远端又前移",3 轮全空转)
    const myHead = git(['rev-parse', 'HEAD'])
    const result = waitForPushState(myHead)
    log(C.dim, `  后台推送结果: ${result}`)
    if (result === 'done') {
      log(C.green, `✅ 推送收敛成功:${myHead.slice(0, 11)}`)
      alignWorktreeAfterHeadMove()
      process.exit(0)
    }
    if (result === 'superseded') {
      log(C.yellow, '  推送状态已被更新的 HEAD 覆盖(并发会话推进了本地),继续下一轮')
    }
    if (result === 'diverged') {
      // guard 已把这一趟判成"远端拒收",不是门失败、也不是网络失败 ⇒ 回到本轮的合并路径,
      // 而不是让调用方以为还要再查一遍凭据/门禁。
      log(C.yellow, '  guard 判 diverged(远端拒收 non-fast-forward)⇒ 本轮重新取远端并合并后再推')
    }

    // 推完的核验只认服务器回读(§20:推没推完不认 dry-run、不认本地 ref)
    const nowR = resolveRemoteHead(branch, { root: repoRoot, fetchedNow: false })
    const nowRemote = nowR.sha
    if (!nowRemote) {
      log(C.yellow, `  推送后回读远端失败(${nowR.reason.slice(0, 90)})⇒ 转下一轮重推,不报成功`)
      continue
    }
    if (nowRemote === git(['rev-parse', 'HEAD'])) {
      log(C.green, `✅ 推送收敛成功:${nowRemote.slice(0, 11)}`)
      alignWorktreeAfterHeadMove()
      process.exit(0)
    }
    log(C.yellow, `  第 ${round} 轮未落地(远端 ${nowRemote.slice(0, 11)}),继续下一轮`)
  }

  log(C.red, `❌ ${maxRounds} 轮未收敛,稍后重跑: node scripts/git-sync-converge.mjs`)
  const lastState = (() => {
    try {
      return JSON.parse(readFileSync(resolve(process.cwd(), '.ihui-agent/state/push-state.json'), 'utf8'))
    } catch {
      return null
    }
  })()
  if (lastState?.status === 'diverged') {
    // 2026-09-26:diverged 是 guard 分诊后的**具名**结论(远端拒收非快进),与下面那条
    // "failed 多半是远端拒收推送保护"的推断不同 —— 这一型不用猜,也不用查凭据/门禁。
    log(C.red, '   上一轮推送结论是 diverged ⇒ 就是并发分叉(远端已推进、拒收非快进),非门禁非凭据。')
    log(C.red, '   复跑本命令(每轮都会重取远端并按索引层合并);反复撞车才需要人工裁。')
  } else if (lastState?.status === 'failed') {
    // 2026-09-24 实测:这句话原来无论何因都写"并发推力过大",而真实原因是**远端拒收推送**
    // (push protection 拦凭据形状)—— 于是每个人都去查并发/网络,没人去看拒绝原文。
    log(
      C.red,
      '   上一轮推送结论是 failed ⇒ 多半不是并发,而是**推送被远端拒收**。看归类与卡门 commit:',
    )
    log(C.red, '     GUARD_ASYNC=0 node scripts/git-push-guard.mjs')
  } else {
    log(C.yellow, '   (并发推力过大:远端在每次推送前又被推进;重跑即可)')
  }
  process.exit(1)
} // ← function main() 结束(§22d:以下 export/守卫在 import 时执行,main 体不执行)

export const __test__ = {
  orphanBackupRefName,
  backupOrphanMerge,
  parseLsTreeZ,
  verifySingleSided,
  collectTreeEntries,
  assertNoSilentRevert,
  resolveRemoteHead,
  alignFailureNote,
  ensureCommitObjectPresent,
  readAlignState,
  writeAlignState,
  nextAlignState,
  recordAlignOutcome,
  mergeCommitArgs,
  preAdvanceAdditionLoss,
  additionLossVerdict,
  preAdvanceDeletionResurrection,
  deletionResurrectionVerdict,
  preAdvanceLocalPreserved,
  localPreservedVerdict,
  GIT_MACHINE_IDENTITY,
  selfTest,
  ensureUnionModule,
  unionGate,
  classifyUnionAttempt,
  unionOutcomeMessage,
  // 转述层的四个出口一并导出:镜像测试按 §22c 直接喂构造面,不得在测试里重写判据。
  unionExitMark,
  stripUnionExitMark,
  readUnionExitCode,
  extractUnionVerdict,
  capText,
  describeUnionRelay,
  STATE_GATE_UNDETERMINED,
  REMOTE_ONLY_BAN_NOTE,
  mergedPlanStateRegressions,
  // 2026-10-27:合并面违禁桶的判定面(单源尺 + 引述护栏)与它的点名出口一并导出 ——
  // 镜像测试按 §22c 直接喂构造面复用同一份判据,不得在测试里再抄一把尺。
  mergedLedgerFace,
  clipRow,
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isDirectRun) {
  // 先异步装载闸门尺子，再把同步的 main 交出去 —— 装载失败**不拦启动**：本器多数分支与台账闸门
  // 无关，把它整体判死才是 G-815406 要修的那个"公共通道陪着一条依赖一起死"。
  // 整条链共用一个 catch:未预期路径也要留一行可读原因,而不是裸栈。
  ensureUnionModule()
    .then(() => main())
    .catch((e) => {
      // execFileSync 的 e.message 只有 `Command failed: <argv>`,真因在 e.stderr(今早的崩溃
      // 账面只剩栈,起因 `Not a valid commit name` 要人去猜)。收敛器是并行会话的公共通道,
      // "崩了"必须读得出"为什么"。
      console.error(`❌ 收敛器异常中断:${alignFailureNote(e)}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
