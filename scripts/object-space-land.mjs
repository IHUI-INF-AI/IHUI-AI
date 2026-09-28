// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对象空间落地器(常驻工具,不在提交链;2026-09-27 立,工程工具收口票)。
 *
 * 为什么在仓里(成因写死在头注,票面要求):本会话交付 8 枚票,全部要落"对象空间"提交 —— 工作树副本常年
 * 滞后 HEAD,按 pathspec 交工作树就把别人已入库的行整批写回旧态(AGENTS §12 一夜三次自伤)。当时在同一次
 * 会话里手写了 6 份近乎同形的落地脚本且已漂开(细节见 scripts/lib/bypass-git.mjs 头注),其中本器收的是
 * land-r24 + reconcile-index 两份:
 *  - ① 落地后 `git show --name-only` 回读,证明"消息声称的每条路径真在提交里"(本仓规矩:commit message
 *    只能写能被回读证明的东西;声明路径无差异 ⇒ 事先拒绝,而不是落地后让 proof 步骤扑空);
 *  - ② 逐路径把共享主索引对齐到新 blob —— commit-tree+update-ref 不碰主索引,新文件在别人眼里就成了
 *    `D ` 暂存删除、改动文件成 `M `,此后一次不带 pathspec 的普通提交就把本轮交付写回旧版。
 *    对齐只在"索引 blob == 父提交 blob 或索引里没有"时动(判据住在 lib,只有一份实现);
 *    别人真暂存过的一律**不动并点名"归属他人"**(退出码 0,但逐条喊出来,绝不静默)。
 *
 * CLI 契约(env 驱动,无参数):
 *  LAND_PATHS  必填,以 `;` 分隔的仓库相对路径清单(内容取各路径的工作树当前字节)
 *  LAND_MSG    必填,提交信息
 *  LAND_ROOT   测试/换仓通道:被落地的仓库根(缺省 = 本脚本所在仓根)
 *  LAND_BASE_REF 取证通道:防覆盖对账的基线 ref(缺省 HEAD;只有测试用它造"别人已改过"的现场)
 *  LAND_ALLOW_STALE 显式放行"陈旧落地"(见 staleLandingGuard 的成因),放行时必打一行留痕
 *  LAND_ALLOW_MALFORMED_ID 显式放行"活文档新增畸形登记编号"(默认关闭;打开时逐条点名放过了什么行)
 * 退出码:0 = 已落地且回读通过(对齐的 skipped/未判定只在 stdout 点名);
 *        1 = 业务拒绝(某目标路径被别人改过 ⇒ 需重新归并 / 声明路径无差异 / 盘上副本等于祖先版本且会抹掉基线里活着的行 /
 *            落地内容里存在"基线已删、祖先版本写过"的复活行,或该维判据未判定 ⇒ 未判定不等于通过 /
 *            活文档里本次新增畸形登记编号(父提交里的存量只报数;父提交取不到落"未判定"不判红)/
 *            CAS 12 次未抢到 / 提交面回读缺路径 / 索引锁龄超上限);
 *        2 = 用法或环境错(空清单 / 空消息 / 声明路径不在盘上 / 根不可当仓库问)。
 *
 * ⚠️ 头注刻意不写"已接 pre-commit / CI / 第 N 项"—— 它是手动常驻工具,那种话会被守门 89 判"声称已接线而零命中"。
 *
 * 2026-09-27 补的第二道拒绝(同日实测事故,登记为在账缺陷):本器**只**按声明路径取磁盘字节,
 * 而磁盘副本常年滞后 HEAD(它正是被绕开的原因 —— 走 pathspec 更糟)。一次真实落地把别人当天
 * 合法删掉的 25 行整批送回、又抹掉 HEAD 里 3 行活内容,而 `git status`、diff 行数、typecheck、
 * 全部守门都不响。判据不再自写:复用守门 84 导出的那一份"要交的内容 != HEAD 且字节级等于该路径
 * 某祖先版本"判定(heal-worktree-tracked 的 alignDrifts 用的是同一出口),本器只是**在落盘前问它一次**。
 *
 * 2026-09-27 补的第三道判据(同日第二次自伤,形态与上一道**不同**,整 blob 那一型看不见它):
 * 上面那条判据的前提是"要交的内容 == 某个祖先版本",而真实事故里调用方**还在陈旧副本上又做了
 * 自己的小改动**(5 个语言包各加 4 行新键)⇒ 落地的 blob = `祖先副本 ⊕ 新行`,逐字节不等于任何祖先
 * ⇒ 谓词永不成立 ⇒ offenders 空、连"只报不拦"那一支也进不去(它在 hits 循环里),守卫与没装一样。
 * 现补**行级复活**判据(`resurrectAnalysis`):一行同时满足 ① 不在基准 blob 里 ② 在要落地的内容里
 * ③ 在该路径某个祖先版本里 ⇒ 它是"被搬回来的旧内容",不是"新写的内容"。真新编辑只造 ①②,
 * 陈旧拼接才造 ①②③ —— 这个不对称就是判据的牙(镜像测试两臂各钉一边,两臂同色即判据无牙)。
 * 祖先窗口**不在本器重复数字**:走守门 84 的 `ancestorCommits` 那一个出口(窗口长度住在它内部);
 * 一个路径的全部祖先正文经 `face-reader.catBatch` **一次批量**读完(不逐行、不逐 blob 派生)。
 *
 * 2026-09-29 补的第四道拒绝(判据不在本器,只在落地点问一次):活文档的**畸形登记编号**(族名在编号段
 * 出现两次,如 `G-G-334`/`DD128`)那条唯一实现住在活文档编辑器 `live-doc-edit.mjs`,而**旁路落地不跑任何
 * 钩子** —— 拿一份陈旧工作树副本经本器交台账时,畸形号能一路进 HEAD 而全程无人拦(守门 71 头注 :54 记了
 * 那次复发;存量现值一律跑本器或 `live-doc-edit` 那把尺子读,本行**不**钉数字 —— 钉死的数下次收紧就成假账)。
 * 现由本器在水印预检与 write-tree **之前**问那一份实现一次:只拦"父提交里没有、本次内容里有"的新增行,
 * 他人历史存量只报数;父提交取不到 ⇒ 未判定(不判红,也不当零存量)。显式出口
 * `LAND_ALLOW_MALFORMED_ID=1`,默认关闭,放行必大声留痕。
 */

import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  alignSharedIndex,
  casUpdateRef,
  commitTreeWithIndex,
  git,
  headBlobOf,
  resolveHeadRef,
  writeBlobOfWorktree,
  ABSENT,
} from './lib/bypass-git.mjs'
import { analyze as staleAncestorAnalysis, ancestorCommits } from './check-stale-revert.mjs'
import { catBatch, readWorktreeFile } from './lib/face-reader.mjs'
// 行级复活/计行判据的**单一实现**(2026-09-28 提取到 lib:守门 84 的 R1r 要用同一把尺子,
// 两处各写一遍必然漂开 —— 本层只留 import 与再导出,不再持有第二份计数口径)。
import {
  lineDelta,
  resurrectAnalysis,
  RESURRECT_MAX_BLOB_BYTES,
  RESURRECT_MIN_LINE_LEN,
} from './lib/stale-content-analysis.mjs'
// G-725:旁路留痕的唯一出口(键名/落点与 safe-commit 那本台账同形,不在本器里另拼 JSON)。
import { recordBypassLanding } from './lib/commit-attestation.mjs'
/**
 * 畸形登记编号判据的**唯一实现**(2026-09-29 立)。
 * 判据住在活文档编辑器 `live-doc-edit.mjs` 的 `newMalformed`(:534,它内部再引 `MALFORMED_ID_RE`
 * /`MALFORMED_BODY_RE` 与 `bodyOfRow` 那一份)—— 守门 71 的头注(:48/:90)就写着"编号形态判据的
 * 唯一实现住在活文档编辑器里"。**本器不得再写一份正则**:两处各写一遍"什么算畸形号"必然漂开,
 * 而漂开的表现永远是安静(本仓记过最多次的失败型)。
 * 补这道闸的理由是那条唯一实现**只覆盖跑得到钩子的那条面**:守门 71 的编号形态维在 `--staged` 档
 * 判本次新增(G-722 接入提交链),而旁路落地**不跑任何钩子** —— 拿一份陈旧工作树副本经本器交台账时,
 * 畸形号照样能一路进 HEAD 而全程无人拦(守门 71 头注 :54 记的那次事故就是同一批畸形号被并发旧底稿
 * 带回;存量现值一律跑本器现读,本注**不**钉数字)。
 */
import { newMalformed } from './live-doc-edit.mjs'
/**
 * 活文档清单的**权威出处** = `scripts/union-converge.mjs:94` 的 `export const LIVE_DOCS`。
 * 为什么不是任务书点名的那两处:`scripts/merge-live-doc.mjs` 走 `--file <单个路径>`、通篇没有清单;
 * `scripts/check-plan-line-loss.mjs:98` 只有 `const PLAN = 'PROJECT_PLAN.md'`(单本,未导出)。
 * 全仓唯一导出这三本之处就是 union-converge,且它的用法也是 `LIVE_DOCS.includes(p)` 精确匹配(:475/:501/:693)。
 * 本器复用那一份,**不新立第四本、不在这里重抄一遍名字**。
 */
import { LIVE_DOCS } from './union-converge.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
// 水印 CLI 与本器同目录:用它而不是拼 cwd 相对路径,理由见 watermarkPreflight 内注释。
const WATERMARK_CLI = join(HERE, 'watermark.mjs')
const REPO_ROOT = resolve(HERE, '..')
const MAX_CAS_ATTEMPTS = 12

/** 读 env 并判用法;不合法 ⇒ {error, code:2}。 */
export function parseArgs(env = process.env) {
  const root = env.LAND_ROOT ? resolve(env.LAND_ROOT) : REPO_ROOT
  const paths = String(env.LAND_PATHS ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  const msg = env.LAND_MSG ?? ''
  const baseRef = env.LAND_BASE_REF || 'HEAD'
  if (paths.length === 0) return { error: '缺 LAND_PATHS(以 ; 分隔)⇒ 拒绝执行(空清单会把 undefined 当路径提交,本仓踩过)' }
  if (msg === '') return { error: '缺 LAND_MSG ⇒ 拒绝执行(不允许空消息落地,提交史无法归因)' }
  if (!resolveHeadRef({ root })) return { error: `${root} 不是可用仓库(HEAD 不可解析或 detached)⇒ 无法判定,不落` }
  const missing = paths.filter((p) => !existsSync(join(root, p)))
  if (missing.length > 0) return { error: `声明路径不在盘上:\n  ${missing.join('\n  ')}` }
  return { root, paths, msg, baseRef }
}

/** 防覆盖护栏:基线快照与当下 HEAD 之间,哪些目标路径的内容被别人动过。 */
export function clobberedPaths(paths, baseMap, headNow, { root }) {
  return paths.filter((p) => headBlobOf(headNow, p, { root }) !== baseMap.get(p))
}

/* 计行口径与行级复活判据(linesOf / tallyLines / resurrectKey / lineDelta / resurrectAnalysis)
 * 已于 2026-09-28 提取到 scripts/lib/stale-content-analysis.mjs —— 守门 84 的 R1r 与本器必须用
 * **同一把尺子**,所以本文件不再持有实现,只 import 上面那一份。 */
/**
 * 陈旧落地守卫。两条互相补盲的判据,任一条成立即**拒绝**:
 *
 *  A. **整 blob**:盘上要交的副本**等于该路径某个祖先版本**、且落地会**抹掉基线里活着的行**。
 *     判据只有一份,住在守门 84(`check-stale-revert.mjs` 导出的 analyze):"要交的内容 != HEAD
 *     且字节级等于该路径某祖先版本"。heal-worktree-tracked 的 alignDrifts 调的是同一个出口;
 *     本器**不再抄第三份**(两处算同一件事必漂移是本仓记过最多次的失败型)。它给得出精确祖先 sha。
 *  B. **行级复活**:内容不等于任何祖先(因为调用方在陈旧副本上又改了东西)⇒ A 结构上看不见,
 *     但落地仍会把基线已删的行搬回来。判据是 `resurrectAnalysis`(①②③ 三条见其注释)。
 *
 * 三种结论,不并桶:
 *  - offender(参与拒绝):A 成立 ∧ 有行会从基线消失(或量不到消失行数)/ B 量到复活行 ≥ 1 /
 *    B **未能判定**(取不到祖先正文、无祖先版本、超过尺寸护栏)—— 判不了就不放行,
 *    本器已有大声出口 `LAND_ALLOW_STALE=1`,宁可让人显式确认,绝不把"没判"写成"判过了"。
 *  - 只报不拦:A 成立 ∧ 相对基线只增不删 ∧ B 已判定且复活 0 行(即新增的都是噪声行/真新内容)。
 *    这一支现在很窄 —— B 未判定也走 offender,所以"把别人删掉的行搬回来"不再能从这一支溜走。
 *  - 不在射程(报数不判红):基线里没有这条(新增文件无行可消失)/ 基线该路径 ≠ 当下 HEAD
 *    (守门 84 的祖先链以 HEAD 为锚,那条链此刻不是本次落地的基准)/ 二进制正文(行级判据按定义
 *    不适用,而 A 仍照判)。三种都**报名**,不静默。
 */
export function detectStaleLanding({ root, paths, baseRef = 'HEAD', head }) {
  const headRef = head ?? git(['rev-parse', 'HEAD'], { root })
  const notes = []
  const judged = []
  for (const p of paths) {
    const b = headBlobOf(baseRef, p, { root })
    if (b === ABSENT) continue
    if (b !== headBlobOf(headRef, p, { root })) {
      notes.push({
        path: p,
        kind: 'face-mismatch',
        why: '基线与当下 HEAD 在该路径上不同 ⇒ 祖先链不是本次落地的基准,交防覆盖护栏判定',
      })
      continue
    }
    judged.push(p)
  }
  let hits
  try {
    hits = staleAncestorAnalysis(root, judged, { source: 'worktree' })
  } catch (e) {
    return {
      ok: false,
      offenders: judged.map((p) => mkEntry(p, null, null, null, {
        status: 'undetermined',
        reason: '整 blob 判据未能运行 ⇒ 行级判据无从对齐',
      })),
      notes,
      reason: `陈旧判据未能运行:${firstLine(e)}`,
    }
  }
  const hitBy = new Map(hits.map((h) => [h.path, h.commit]))

  // 祖先清单:每路径一次 git log(复用守门 84 的窗口出口,本器不重复窗口数字)。
  // 尺寸护栏排在**取祖先正文之前**:不这样就会为一个 3.9MB 的滞后大文件派 40 × 3.9MB 的读,
  // 而那份读的结果按定义不采用(超限即未判定)—— 白花一次派生等于给自己造一个"太慢所以被人跳过"的守卫。
  const shasBy = new Map()
  const logFailed = new Set()
  const sizeExceeded = new Set()
  const worktreeOf = new Map()
  for (const p of judged) {
    try {
      worktreeOf.set(p, readWorktreeFile(root, p))
    } catch (e) {
      worktreeOf.set(p, e) // 留错误对象:报告要能区分"读不到"与"读出来是 null(二进制/不存在)"
    }
  }
  let texts = new Map()
  let batchError = null
  try {
    texts = catBatch(root, judged.map((p) => `${baseRef}:${p}`))
  } catch (e) {
    batchError = firstLine(e)
  }
  if (!batchError) {
    for (const p of judged) {
      const wt = worktreeOf.get(p)
      const base = texts.get(`${baseRef}:${p}`)
      if (typeof wt === 'string' && typeof base === 'string' && Math.max(wt.length, base.length) > RESURRECT_MAX_BLOB_BYTES) {
        sizeExceeded.add(p)
        continue
      }
      try {
        shasBy.set(p, ancestorCommits(root, p))
      } catch {
        shasBy.set(p, [])
        logFailed.add(p) // "读不到祖先"与"没有祖先"是两件事,后者才可能真是新文件
      }
    }
    // 正文:**每路径一次批量读满**(它的全部祖先版本走同一次 cat-file --batch,不逐 blob 派生)。
    const ancSpecs = []
    for (const p of judged) for (const c of shasBy.get(p) ?? []) ancSpecs.push(`${c}:${p}`)
    if (ancSpecs.length > 0) {
      try {
        for (const [k, v] of catBatch(root, ancSpecs)) texts.set(k, v)
      } catch (e) {
        batchError = firstLine(e)
      }
    }
  }

  const offenders = []
  for (const p of judged) {
    const wt = worktreeOf.get(p)
    const newText = wt instanceof Error ? null : wt
    const baseText = batchError ? null : (texts.get(`${baseRef}:${p}`) ?? null)
    const delta = lineDelta(baseText, newText)
    const wholeHit = hitBy.get(p) ?? null
    let line
    if (batchError) line = { status: 'undetermined', reason: `祖先正文批量读取失败:${batchError}`, sample: [], commits: [] }
    else if (sizeExceeded.has(p))
      line = {
        status: 'out-of-scope',
        reason: `正文超过行级扫描尺寸护栏 ${RESURRECT_MAX_BLOB_BYTES}B ⇒ 未读祖先(整 blob 判据仍照判)`,
        sample: [],
        commits: [],
      }
    else if (logFailed.has(p)) line = { status: 'undetermined', reason: '祖先提交清单取不到(git log 未能运行)', sample: [], commits: [] }
    else
      line = resurrectAnalysis({
        baseText,
        newText,
        ancestors: (shasBy.get(p) ?? []).map((c) => ({
          commit: c.slice(0, 9),
          text: texts.get(`${c}:${p}`) ?? null,
        })),
      })
    if (wt instanceof Error)
      notes.push({ path: p, kind: 'undetermined', why: `工作树正文读不到:${firstLine(wt)}` })
    const entry = mkEntry(p, wholeHit, delta, line)
    // 未覆盖必须**逐条报名**,且与"是否参与拒绝"无关 —— 一台只在放行时才沉默的守卫,
    // 读报告的人会把"没判"当成"判过了"(本仓最高频失效型)。
    if (line.status === 'out-of-scope')
      notes.push({ ...entry, kind: 'line-out-of-scope', why: `行级复活判据未覆盖此路径:${line.reason}` })
    const refuseByBlob = !!wholeHit && (delta.vanished === null || delta.vanished > 0)
    const refuseByLines = line.status === 'judged' ? line.count > 0 : line.status === 'undetermined'
    if (refuseByBlob || refuseByLines) {
      offenders.push(entry)
      continue
    }
    if (wholeHit)
      notes.push({
        ...entry,
        kind: 'resurrect-only',
        why:
          `内容等于祖先 ${wholeHit},相对基线只增 ${delta.appeared} 行、不删任何行,` +
          `且新增行都不在该祖先版本里(复活 0 行)⇒ 只报不拦`,
      })
  }
  return { ok: offenders.length === 0, offenders, notes }
}

/** 报告条目的一份子:两条判据的读数并排放,渲染层不再各自判一次。 */
function mkEntry(path, commit, delta, line, fallback) {
  const d = delta ?? { vanished: null, appeared: null, vanishedSample: [], appearedSample: [] }
  return {
    path,
    commit,
    ...d,
    resurrected: line?.count ?? null,
    resurrectedSample: line?.sample ?? [],
    resurrectedBy: line?.commits ?? [],
    lineStatus: line?.status ?? 'undetermined',
    lineReason: line?.reason ?? fallback?.reason ?? '判据未运行',
  }
}

function firstLine(e) {
  return String(e?.message ?? e ?? '').split('\n')[0] || '(无输出)'
}

/** 拒绝/留痕时要说的话集中在一处:出口必须可复制,原因必须点名到文件与祖先版本。 */
function staleReport(guard, { allowStale }) {
  const lines = []
  for (const n of guard.notes) {
    lines.push(`ℹ️ ${n.path}:${n.why}`)
    appendSamples(lines, n)
  }
  const uncovered = guard.notes.filter((n) => n.kind === 'line-out-of-scope').length
  if (!guard.offenders.length) {
    if (uncovered)
      lines.push(
        `ℹ️ 行级复活判据未覆盖 ${uncovered} 条路径(尺寸护栏 / 二进制 / 无祖先版本)—— **未覆盖 ≠ 通过**;` +
          '这些路径仍由整 blob 那一支护着,要行级也盖上就得把正文取回本器(另计一票)。',
      )
    return lines
  }
  const unjudged = guard.offenders.filter((o) => o.lineStatus === 'undetermined').length
  const head = allowStale
    ? `⚠️ LAND_ALLOW_STALE=1 ⇒ 放行 ${guard.offenders.length} 处陈旧落地(其中 ${unjudged} 处判据未判定 —— 放行不等于判过;这一枚提交确实会把下面这些行写回旧态,该行输出即留痕)`
    : `❌ 陈旧落地守卫:这些声明路径的盘上副本**等于该文件某个祖先版本**,或会把基线里已被删掉的行**搬回**落地内容 ⇒ 拒绝落地${guard.reason ? '(' + guard.reason + ')' : ''}`
  lines.push(head)
  for (const o of guard.offenders) {
    const v = o.vanished === null ? '消失行数未判定' : `消失 ${o.vanished} 行`
    const a = o.appeared === null ? '重现行数未判定' : `重现 ${o.appeared} 行`
    const blob = o.commit ? `== 祖先 ${o.commit}` : o.lineStatus === 'judged' ? '(内容不等于任何祖先)' : '(祖先版本取不到)'
    const who = o.resurrectedBy.length ? `(见于祖先 ${o.resurrectedBy.slice(0, 3).join(', ')})` : ''
    const r =
      o.lineStatus === 'judged'
        ? `复活 ${o.resurrected} 行(证据行门槛:含字母且 ≥${RESURRECT_MIN_LINE_LEN} 字符)${who}`
        : `复活行数未判定:${o.lineReason}`
    lines.push(`   - ${o.path}  ${blob}  ${v} / ${a} / ${r}`)
    appendSamples(lines, o)
  }
  if (!allowStale) {
    lines.push('   最常见成因:共享工作树副本滞后 HEAD ⇒ 落地器取的是磁盘字节(走 pathspec 只会更糟),')
    lines.push('   而调用方又在这份滞后副本上补了自己的改动(所以整 blob 判据看不见,只有行级复活看得见)。')
    lines.push('   出口 ① 取 HEAD 形态重新施加改动(先看判据再动手,别覆盖别人的在飞现场):')
    lines.push('            git cat-file blob HEAD:<path> > <path>   ← 覆盖工作树副本,确认其中没有你自己的未提交内容才用')
    lines.push('   出口 ② 确属有意重生成 ⇒ LAND_ALLOW_STALE=1 重跑本器(会大声留痕,不会静默放行)')
    lines.push('   标了"未判定"的行是**判据没读到东西**(浅历史 / 超过尺寸护栏 / git 派生失败),不是"检查过且干净";')
    lines.push('   未判定不得被读成通过 —— 要放行只有出口 ② 这一条显式路径。')
  }
  return lines
}

function appendSamples(lines, entry) {
  for (const l of entry.vanishedSample ?? []) lines.push(`       - 消失: ${l}`)
  for (const l of entry.appearedSample ?? []) lines.push(`       + 重现: ${l}`)
  for (const l of entry.resurrectedSample ?? []) lines.push(`       ↺ 复活: ${l}`)
}

/**
 * 活文档编号形态复核(2026-09-29 立;本器是"畸形号绕过唯一判据进 HEAD"那条通道的唯一拦截点)。
 *
 * 只对**活文档路径**生效:清单不自己造,取 `union-converge.mjs` 导出的那一份 `LIVE_DOCS`
 * (依据写在文件顶部 import 处)。非清单路径不进射程 —— 同一形态写在 `.ts` 或别的 `.md` 里不判,
 * 这是射程不是遗漏:判据按清单走,全局误伤会让本器对每次普通落地都喊红。
 *
 * 只拦**本次新引入**:判据本体 `newMalformed(baseText, landedText)` 给两档 ——
 *  - `added`      = 落地内容里有、父提交(CAS 基线 `baseRef`)那份里没有的畸形行 ⇒ 拒绝
 *  - `preexisting`= 落地内容里有、父提交里**已在**的畸形行 ⇒ 只报数不拦
 * 存量为什么不拦(§12e 恒红门同一条):他人历史留下的畸形号钉红每一次落地,唯一结局是逼人绕开本器
 * 改用 pathspec 硬交 —— 拿一个更危险的出口换一个账面好看。但必须打印出来,否则"存量"与"我刚造的"
 * 在账面上同形(本仓最高频失效型就是"把没判写成判过了",而这里连"没分家"都读不出来)。
 *
 * **未判定既不判红也不记绿**(与 `detectStaleLanding` 把未判定算进 offenders 刻意不同,按本票票面):
 * 父提交里取不到该路径正文(新文件 / 对象不可读 / 二进制)时,存量这一维结构上无从对齐,把它当
 * "零存量"直接判红就是替本次改动无关的债造恒红门;而沉默不喊等于把"没判"写成"判过了"。
 * 所以这一格落 `undetermined` 并逐条报名。
 *
 * @param {{ root: string, paths: string[], baseRef?: string }} a
 * @returns {{ ok: boolean,
 *   offenders: Array<{ path: string, added: Array<{ line: string, family: string }> }>,
 *   stock: Array<{ path: string, preexisting: Array<{ line: string, family: string }> }>,
 *   undetermined: Array<{ path: string, reason: string }>,
 *   scanned: number }}
 */
export function detectMalformedLiveDocIds({ root, paths, baseRef = 'HEAD' }) {
  const docs = paths.filter((p) => LIVE_DOCS.includes(p))
  const gate = { ok: true, offenders: [], stock: [], undetermined: [], scanned: docs.length }
  if (docs.length === 0) return gate
  // 父提交那一面**一次批量读满**(face-reader 的 cat-file --batch,守门 118 的取材面纪律:
  // 枚举与内容同面同轮,不逐 blob 派生)。maxBuffer 给足 1<<28 —— 整面文档不得用默认值,
  // face-reader 头注第 5 条记过"真仓语言包 1,080,001 字节被默认 1MB 截成'读不出/仓库坏了'"那一型,
  // 而 PROJECT_PLAN.md 现 4.7MB。
  let texts
  try {
    texts = catBatch(
      root,
      docs.map((p) => `${baseRef}:${p}`),
      { maxBuffer: 1 << 28 },
    )
  } catch (e) {
    for (const p of docs)
      gate.undetermined.push({
        path: p,
        reason: `父提交面(${baseRef})批量取材失败 ⇒ 存量无从对齐:${firstLine(e)}`,
      })
    return gate
  }
  for (const p of docs) {
    const baseText = texts.get(`${baseRef}:${p}`) ?? null
    if (baseText === null) {
      gate.undetermined.push({
        path: p,
        reason:
          `父提交 ${baseRef} 里取不到该路径正文(新文件 / 对象不可读 / 二进制)⇒ 存量这一维**未判定**,` +
          '不据此判红,更不得当"零存量"',
      })
      continue
    }
    let landedText
    try {
      landedText = readWorktreeFile(root, p)
    } catch (e) {
      gate.undetermined.push({
        path: p,
        reason: `要落地的正文读不到:${firstLine(e)} ⇒ 未判定(不记通过)`,
      })
      continue
    }
    if (landedText === null) {
      gate.undetermined.push({
        path: p,
        reason: '要落地的正文读不到或含 NUL(二进制)⇒ 行形态判据按定义不适用,未判定(不记通过)',
      })
      continue
    }
    const mal = newMalformed(baseText, landedText)
    if (mal.added.length > 0) gate.offenders.push({ path: p, added: mal.added })
    if (mal.preexisting.length > 0) gate.stock.push({ path: p, preexisting: mal.preexisting })
  }
  gate.ok = gate.offenders.length === 0
  return gate
}

/**
 * 编号形态闸的措辞出口(纯函数,与 `staleReport` 同取向:话说在哪儿,只在一种场合说一次)。
 * 三态不并桶 —— "射程外"、"未判定"、"存量只报数"、"新增拒绝"各有句式,读报告的人据此才知道该动哪一手。
 * "跑了且干净"那句**只在真有判定结果时**才印:未判定存在却照印,就是把"没判"写成"判过了"(本仓最高频失效型)。
 */
export function malformedIdReport(gate, { allowMalformed = false, baseRef = 'HEAD' } = {}) {
  const lines = []
  // "没跑这一维"与"跑了且干净"必须**可读出来不同形**(本仓"只报数不报名"记过多次):
  // 两种情形各给一句,免得下一个接手的人把沉默读成合格证。
  if (gate.scanned === 0)
    lines.push(
      `ℹ 活文档编号形态闸:本次声明路径不含活文档(${LIVE_DOCS.join(' / ')})⇒ 不进射程,这是**射程**,不是"判过且干净"`,
    )
  for (const u of gate.undetermined)
    lines.push(`ℹ️ ${u.path}:未判定 —— ${u.reason}(未判定 ≠ 零存量,也 ≠ 查过了且干净)`)
  for (const s of gate.stock)
    lines.push(
      `ℹ 活文档存量畸形登记编号 ${s.preexisting.length} 行(${s.path}:父提交 ${baseRef} 里已在 ⇒ ` +
        '只报数不拦,与本次落地无关;逐条清偿另计批)',
    )
  if (gate.ok && gate.scanned > 0 && gate.undetermined.length === 0)
    lines.push(`✅ 活文档编号形态闸:已判 ${gate.scanned} 本活文档(本次新增畸形 0 行)`)
  if (!gate.ok) {
    const total = gate.offenders.reduce((a, o) => a + o.added.length, 0)
    lines.push(
      allowMalformed
        ? `⚠️ LAND_ALLOW_MALFORMED_ID=1 ⇒ 本次由人工放行 ${total} 行畸形登记编号落地` +
            '(判据:object-space-land.detectMalformedLiveDocIds → live-doc-edit.newMalformed;' +
            '放行不等于判过 —— 下面这些行会真进 HEAD,该行输出即留痕)'
        : `❌ 活文档编号形态闸:本次要落地的内容里有 ${total} 行畸形登记编号(族名在编号段出现两次)⇒ 拒绝落地`,
    )
    for (const o of gate.offenders) {
      lines.push(
        `   - ${o.path} 本次新增 ${o.added.length} 行(畸形号会让台账撞号维 F9 把它多计一个"编号挂两个标题",替别人造债):`,
      )
      for (const x of o.added.slice(0, 4)) lines.push(`       · [族 ${x.family}] ${x.line}`)
      if (o.added.length > 4) lines.push(`       · …另 ${o.added.length - 4} 行未逐条打印`)
    }
    if (!allowMalformed) {
      lines.push(
        '   成因固定:取号令牌 {{NEXT_ID:X}} 的展开值**本身已含族名**,正文再手写一个字面 X 就产出 XX123(在案另一形态 G-G-334 同源)。',
      )
      lines.push(
        '   改法:删掉正文里那一个字面族名,只留令牌。判据只有 live-doc-edit.mjs 那一份,本器不写第二份。',
      )
      lines.push(
        '   应急出口(默认关闭):LAND_ALLOW_MALFORMED_ID=1 重跑本器 ⇒ 大声留痕,不会静默放行。',
      )
    }
  }
  return lines
}

/**
 * 溯源水印预检(G-253,2026-09-27 立)。
 *
 * 为什么落地点归本器管、而不该由 pre-commit 那道 `check-watermark-coverage` 管:
 * 旁路落地**不跑钩子** —— read 一次真仓历史就能看到,对象空间提交是"新文件带着无横幅
 * 内容进 HEAD"的唯一通道,而那道门把未跟踪面判成 blocking 又会变成"与本次提交无关的
 * 恒红门"(它扫到的是别人在飞的文件)。所以:闸门侧只报数,落地侧**拒发合格证**。
 *
 * 判据本体仍是那一份:`watermark.mjs verify`(含第三方台账排除 —— 不给 Apache/MIT 原文
 * 打我方归属横幅,那是 provenance-ledger P8 的射程)。这里只回答"要不要现在落地"。
 *
 * @param {{ root: string, paths: string[], run?: Function, node?: string }} a
 * @returns {{ ok: true } | { ok: false, why: string }}
 */
export function watermarkPreflight({ root, paths, run = defaultRun, node = process.execPath }) {
  /** 摘出 verify 的"未覆盖"清单 —— 拒绝理由必须点名是哪个文件,不得只说"没通过"。 */
  const uncoveredOf = (text) =>
    String(text ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .slice(0, 10)
      .join('\n  ')
  const hint =
    '  修法:`node scripts/watermark.mjs inject <file>` 后重跑本落地器;' +
    '台账登记的第三方内容不需要横幅(由 provenance-ledger P8 审计)。'
  let res
  try {
    // 刻意用**本文件旁边的** watermark.mjs(绝对路径)+ **绝对**目标路径:
    // 落地器的 `root` 可以是任何仓(镜像测试就在临时仓里跑),按 root 相对拼路径会
    // 指向一个不存在的脚本,而"脚本不存在"被当成"校验不通过"就是假红、当成通过就是假绿。
    // 绝对路径让 verify 的 scopeFromArgs 直接命中文件,与 root 是否为被验仓无关。
    res = run(node, [WATERMARK_CLI, 'verify', ...paths.map((x) => resolve(root, x))], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      return { ok: false, why: '取不到 node 执行体 ⇒ 无法判断水印是否完整,拒绝落地(宁停不猜)' }
    }
    const uncovered = uncoveredOf(String(e?.stdout ?? '') + String(e?.stderr ?? ''))
    return {
      ok: false,
      why:
        `水印校验派生失败(${String(e?.message ?? e).split('\n')[0]})。\n` +
        (uncovered ? `  未覆盖清单(前 10):\n  ${uncovered}\n` : '') +
        hint,
    }
  }
  const status = res?.status ?? 0
  if (status !== 0) {
    // 两条拒绝路径**共用**同一份清单提取:第一版只在抛异常那一支摘 stdout,而真跑 `verify`
    // 非零退出走的是这一支 —— 于是拒绝理由只说"没通过",不点名是哪个文件。
    const uncovered = uncoveredOf(String(res?.stdout ?? '') + String(res?.stderr ?? ''))
    return {
      ok: false,
      why:
        `verify 退出码 ${status},拒绝落地无有效横幅的内容。\n` +
        (uncovered ? `  未覆盖清单(前 10):\n  ${uncovered}\n` : '') +
        hint,
    }
  }
  return { ok: true }
}

function defaultRun(cmd, args, opts) {
  execFileSync(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
  return { status: 0 }
}

async function main() {
  const parsed = parseArgs()
  if (parsed.error) {
    console.error(`❌ ${parsed.error}`)
    process.exit(2)
  }
  const { root, paths, msg, baseRef } = parsed
  const skipWatermark = process.env.IHUI_LAND_SKIP_WATERMARK === '1'

  const head0 = git(['rev-parse', 'HEAD'], { root })
  const base = new Map(paths.map((p) => [p, headBlobOf(baseRef, p, { root })]))
  const mine = new Map(paths.map((p) => [p, writeBlobOfWorktree(p, { root })]))

  // 声明无差异 ⇒ 事先拒绝(提交面回读结构上证明不了"改了它";safe-commit Step③ 同型的中止语义,前置到写盘之前)
  const noDiff = paths.filter((p) => mine.get(p) === base.get(p))
  if (noDiff.length > 0) {
    console.error(`❌ 这些声明路径与基线(${baseRef})内容逐字节相同 ⇒ 拒绝落地(提交面回读永远证不了它们被改):\n  ${noDiff.join('\n  ')}`)
    process.exit(1)
  }

  /**
   * 陈旧落地守卫:放在 CAS **与水印预检之前** —— 拒绝路径上对象库、ref、索引都没被碰过,
   * 也不必先花一次 verify 派生去为一个注定不落地的内容做证。
   * 判据本身不在此重述(见 detectStaleLanding),这里只接线。
   */
  const allowStale = process.env.LAND_ALLOW_STALE === '1'
  if (allowStale)
    console.log('⚠️ LAND_ALLOW_STALE=1 ⇒ 陈旧落地守卫只做报告、不参与拒绝(该行输出即留痕)')
  const guard = detectStaleLanding({ root, paths, baseRef, head: head0 })
  const refusing = !guard.ok && !allowStale
  for (const line of staleReport(guard, { allowStale })) {
    if (refusing) console.error(line)
    else console.log(line)
  }
  if (refusing) process.exit(1)

  /**
   * 活文档编号形态闸(2026-09-29 立):判据只有一份,住在 `live-doc-edit.mjs` 的 `newMalformed`
   * (本器只 import 不重写 —— 见文件顶部与 detectMalformedLiveDocIds 的依据)。
   * 位置刻意排在**祖先回写/行级复活两道拒绝之后、水印预检与 write-tree/commit-tree 之前**:
   *  - 排在它们之后:陈旧落地那一型先把内容整批写回旧态,编号形态在那份内容上谈"本次新引入"没有意义;
   *  - 排在水印预检之前:与上面守卫同一条理由 —— 拒绝路径上不必先花一次 verify 派生去为一个
   *    注定不落地的内容做证;而且**必须在 write-tree/commit-tree 之前**:内容一旦 commit,
   *    再 exit 1 就是把"已入库"谎报成"没落地",而"没落地"的唯一反应是重跑(本器 G-321 花两档
   *    退出码要消灭的正是这一混淆)。
   * 失败时对象库、ref、索引都还没被碰过 ⇒ 不留半截索引,也不留半截提交。
   */
  const allowMalformed = process.env.LAND_ALLOW_MALFORMED_ID === '1'
  if (allowMalformed)
    console.log(
      '⚠️ LAND_ALLOW_MALFORMED_ID=1 ⇒ 活文档编号形态闸只做报告、不参与拒绝(该行输出即留痕)',
    )
  const malGate = detectMalformedLiveDocIds({ root, paths, baseRef })
  const malRefusing = !malGate.ok && !allowMalformed
  for (const line of malformedIdReport(malGate, { allowMalformed, baseRef })) {
    if (malRefusing) console.error(line)
    else console.log(line)
  }
  if (malRefusing) process.exit(1)

  let landed = ''
  let parentSha = ''
  // 水印预检(G-253):旁路提交不跑钩子,这道检查是"无横幅文件进 HEAD"的唯一拦截点。
  // 放在 CAS **之前** —— 校验不通过时对象库与 ref 都未被动过。
  if (!skipWatermark) {
    const preflight = watermarkPreflight({ root, paths })
    if (!preflight.ok) {
      console.error(`❌ 水印预检不通过,拒绝落地:${preflight.why}`)
      console.error('   应急跳过(仅限确属台账第三方内容):IHUI_LAND_SKIP_WATERMARK=1')
      process.exit(1)
    }
    console.log(`✅ 水印预检通过 ${paths.length}/${paths.length} 路径(verify 口径,含第三方台账排除)`)
  } else {
    console.log('⚠️ IHUI_LAND_SKIP_WATERMARK=1 ⇒ 本次跳过水印预检(该行输出即留痕)')
  }
  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt++) {
    const head = git(['rev-parse', 'HEAD'], { root })
    const clobber = clobberedPaths(paths, base, head, { root })
    if (clobber.length > 0) {
      console.error(`❌ 放弃落地:HEAD 已推进且这些目标路径被别人改过 ⇒ 需重新归并而非覆盖(第 ${attempt} 次尝试):\n  ${clobber.join('\n  ')}`)
      process.exit(1)
    }
    const { commit } = commitTreeWithIndex({
      root,
      parent: head,
      message: msg,
      entries: paths.map((p) => ({ path: p, blob: mine.get(p) })),
      baseRef: head,
    })
    if (casUpdateRef(commit, head, { root })) {
      landed = commit
      parentSha = head
      console.log(`✅ 第 ${attempt} 次 CAS 成功 HEAD=${commit}(基线 ${baseRef}=${head0.slice(0, 9)})`)
      break
    }
    console.log(`⚠️ 第 ${attempt} 次 CAS 失败(别人先推进了 HEAD),重读重试`)
  }
  if (landed === '') {
    console.error(`❌ ${MAX_CAS_ATTEMPTS} 次均未抢到 CAS,主索引未动`)
    process.exit(1)
  }

  // ① 提交面回读:声明的每条路径必须出现在 git show --name-only 清单里
  const inCommit = new Set(
    git(['show', '--name-only', '--format=', landed], { root })
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean),
  )
  const notProven = paths.filter((p) => !inCommit.has(p))
  if (notProven.length > 0) {
    console.error(`❌ 提交面回读缺路径(消息声称的改动没真进树):\n  ${notProven.join('\n  ')}`)
    process.exit(1)
  }
  const extras = [...inCommit].filter((p) => !paths.includes(p))
  console.log(
    `✅ 提交面回读 ${paths.length}/${paths.length} 路径在树${extras.length ? `;另有非声明路径 ${extras.length} 条(检查是否混提)` : ''}`,
  )

  /**
   * G-725 留痕:走到这里"这枚提交已在 HEAD 里、且声明路径都过了回读"是既成事实 ——
   * 主索引对齐(下一步)成功与否都不改变"它绕过了提交链"这一点,所以留痕必须写在对齐**之前**。
   * 硬要求:写失败只喊一行 WARN,绝不把一次成功落地判红(它记的是账,不是门禁)。
   */
  const attest = recordBypassLanding({
    root,
    source: 'object-space-land',
    landedSha: landed,
    headBefore: parentSha,
    declaredFiles: paths,
    watermarkSkipped: skipWatermark,
  })
  if (!attest.ok)
    console.log(
      `⚠️ 跳门留痕未写入(落地已成功 HEAD=${landed.slice(0, 11)},不改退出码):${attest.why}`,
    )
  else console.log(`✅ 跳门留痕 1 行已写入 ${attest.path}(kind=bypass-landing,gatesRun=false)`)

  // ② 共享主索引对齐(判据在 lib,只有一份):未尽事项点名后退出码仍 0 —— 落地本身已成功
  const align = alignSharedIndex({ root, paths, parentRef: parentSha })
  if (align.lockAbandoned) {
    console.error('❌ .git/index.lock 锁龄超上限:不代删别人的锁,请人工确认持有者后单跑索引对齐')
    process.exit(1)
  }
  if (align.failed) {
    console.error(`❌ 索引对齐未完成(轮次耗尽/派生持续失败):${align.error ?? ''}`)
    process.exit(1)
  }
  console.log(`✅ 主索引已对齐 ${align.moved.length + align.already.length}/${paths.length} 路径(移动 ${align.moved.length} / 已就位 ${align.already.length})`)
  if (align.skipped.length > 0) {
    console.log(`⚠️ 未动(归属他人):\n  ${align.skipped.map((s) => `${s.path} (${s.reason})`).join('\n  ')}`)
  }
  if (align.undetermined.length > 0) {
    console.log(`⚠️ 未判定:\n  ${align.undetermined.map((u) => `${u.path} (${u.reason})`).join('\n  ')}`)
  }
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  parseArgs,
  clobberedPaths,
  lineDelta,
  resurrectAnalysis,
  detectStaleLanding,
  staleReport,
  detectMalformedLiveDocIds,
  malformedIdReport,
  // 再导出**判据宿主那一个函数对象**(不是包一层的复制品)—— 镜像测试 T19 用它做同一性锁:
  // 形状锁只能证明源码里没有第二份"形状",拷贝一份再改名就绕过去了;同一对象 ⇒ 结构上不可能有两份。
  newMalformed,
  LIVE_DOCS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
