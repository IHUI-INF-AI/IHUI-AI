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
 *  - ① 落地后逐路径 `git cat-file -e <commit>:<path>` 回读存在性,证明"消息声称的每条路径真在提交里"
 *    (本仓规矩:commit message 只能写能被回读证明的东西;声明路径无差异 ⇒ 事先拒绝,而不是落地后让
 *    proof 步骤扑空)。**存在性判据问 git 的结论而不是解析它的输出**(G-801):`git show --name-only`
 *    的输出文本默认按 core.quotePath 把非 ASCII 路径八进制转写并加引号,拿输出字节当路径身份,
 *    中文/带空格路径必然比不中 ⇒ 已成功的交付被报成"缺路径";该清单只留作"是否混提"的辅助且必须 -c core.quotePath=false;
 *  - ② 逐路径把共享主索引对齐到新 blob —— commit-tree+update-ref 不碰主索引,新文件在别人眼里就成了
 *    `D ` 暂存删除、改动文件成 `M `,此后一次不带 pathspec 的普通提交就把本轮交付写回旧版。
 *    对齐只在"索引 blob == 父提交 blob 或索引里没有"时动(判据住在 lib,只有一份实现);
 *    别人真暂存过的一律**不动并点名"归属他人"**(退出码 0,但逐条喊出来,绝不静默)。
 *
 * CLI 契约(env 驱动,无参数):
 *  LAND_PATHS  必填,以 `;` 分隔的仓库相对路径清单
 *              · 缺省(工作树模式)内容取各路径的工作树当前字节
 *              · 配 LAND_BLOBS 时内容来自清单,**不读工作树** —— 用于"同一文件里别人有在飞改动"
 *                的场景:那种情况下交工作树字节 = 替别人落地(§12 污染型),正确内容只能是 HEAD⊕本票行
 *  LAND_MSG    必填,提交信息
 *  LAND_BLOBS  可选,JSON 清单 `{files:[{path,blob}]}`(blob 由 hash-object -w 得到,须已在对象库)
 *  LAND_BLOB_PROOF 配 LAND_BLOBS 时必填:一句话写明"构造内容相对基线只动了本票行"是靠什么证的。
 *              工作树取材的两道陈旧守卫在 blob 模式结构上不适用(它们比的是盘上那份),
 *              替代尺 = 祖先 blob 对账 + 水印横幅保持 + 这句证明;三者都大声报数,少守卫不静默。
 *  LAND_ROOT   测试/换仓通道:被落地的仓库根(缺省 = 本脚本所在仓根)
 *  LAND_BASE_REF 取证通道:防覆盖对账的基线 ref(缺省 HEAD;只有测试用它造"别人已改过"的现场)
 *  LAND_ALLOW_STALE 显式放行"陈旧落地"(见 staleLandingGuard 的成因),放行时必打一行留痕
 *              (只对工作树模式有意义;blob 模式的对应判据是祖先对账,不放行)
 * 退出码:0 = 已落地且回读通过(对齐的 skipped/未判定只在 stdout 点名);
 *        1 = 业务拒绝(某目标路径被别人改过 ⇒ 需重新归并 / 声明路径无差异 / 盘上副本等于祖先版本且会抹掉基线里活着的行 /
 *            落地内容里存在"基线已删、祖先版本写过"的复活行,或该维判据未判定 ⇒ 未判定不等于通过 /
 *            CAS 12 次未抢到 / 提交面回读 git 明确回答"不在树里"(G-801 起存在性逐路径 cat-file -e 判) / 索引锁龄超上限);
 *        2 = 用法或环境错(空清单 / 空消息 / 声明路径不在盘上 / 根不可当仓库问 /
 *            提交面回读"问不到"⇒ 未判定:落地已推进 HEAD,但存在性未能判定 —— 既不报成功也不报"缺路径",
 *            因为假失败会诱使重跑一次已经成功的落地,而"未判定"折成"没有"是同一型失真)。
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
 */

import { hasAnyWatermarkTrace, hasExactCanonicalBanner } from './lib/watermark-lines.mjs'
import { existsSync, readFileSync } from 'node:fs'
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
  UNKNOWN,
} from './lib/bypass-git.mjs'
import {
  analyze as staleAncestorAnalysis,
  ancestorCommits,
  resolveBlobs,
} from './check-stale-revert.mjs'
import { catBatch, readWorktreeFile } from './lib/face-reader.mjs'
// 存在性三态探针需要 git 二进制的解析出口(与 bypass-git 同一份,不在本器另立候选路径)。
import { resolveGitBin } from './lib/gitdir.mjs'
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

const HERE = dirname(fileURLToPath(import.meta.url))
// 水印 CLI 与本器同目录:用它而不是拼 cwd 相对路径,理由见 watermarkPreflight 内注释。
const WATERMARK_CLI = join(HERE, 'watermark.mjs')
const REPO_ROOT = resolve(HERE, '..')
// 与 lib/bypass-git.mjs 同一个解析出口(候选路径只有一份,本器不另立)。
const GIT_BIN = resolveGitBin() || 'git'
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
  /**
   * `LAND_BLOBS` = 内容清单(JSON:`{files:[{path,blob}]}`)。为什么要有这条通道:
   * 共享工作树里**别人的在飞改动**与本票的改动常常落在同一个文件的不同行上,而"交工作树字节"
   * 就是替别人落地(§12 污染型)。这时正确内容只能是 `HEAD ⊕ 本票行`,它只存在于对象空间。
   * 磁盘那条路(`writeBlobOfWorktree`)对这种内容根本不成立,所以必须显式声明来源,而不是
   * 让调用方再手写第六份 commit-tree 装置(AGENTS 记过:6 份同形脚本已互相漂开)。
   */
  const blobs = env.LAND_BLOBS ? JSON.parse(readFileSync(env.LAND_BLOBS, 'utf8')) : null
  const blobOf = blobs ? new Map((blobs.files || []).map((f) => [f.path, f.blob])) : null
  if (paths.length === 0)
    return { error: '缺 LAND_PATHS(以 ; 分隔)⇒ 拒绝执行(空清单会把 undefined 当路径提交,本仓踩过)' }
  if (msg === '') return { error: '缺 LAND_MSG ⇒ 拒绝执行(不允许空消息落地,提交史无法归因)' }
  if (!resolveHeadRef({ root }))
    return { error: `${root} 不是可用仓库(HEAD 不可解析或 detached)⇒ 无法判定,不落` }
  if (blobOf) {
    const noBlob = paths.filter((p) => !blobOf.get(p))
    if (noBlob.length > 0)
      return {
        error: `LAND_BLOBS 清单里缺这些声明路径 ⇒ 内容无从取得,拒绝落地:\n  ${noBlob.join('\n  ')}`,
      }
    const unknown = [...blobOf.keys()].filter((p) => !paths.includes(p))
    if (unknown.length > 0)
      return {
        error: `LAND_BLOBS 里有未声明路径(${unknown.join(', ')})⇒ 声明面与内容面必须一致,拒绝落地`,
      }
    // blob 模式不要求盘上有该文件:内容来自对象空间,工作树那份属于别人
  } else {
    const missing = paths.filter((p) => !existsSync(join(root, p)))
    if (missing.length > 0) return { error: `声明路径不在盘上:\n  ${missing.join('\n  ')}` }
  }
  return { root, paths, msg, baseRef, blobOf }
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
      offenders: judged.map((p) =>
        mkEntry(p, null, null, null, {
          status: 'undetermined',
          reason: '整 blob 判据未能运行 ⇒ 行级判据无从对齐',
        }),
      ),
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
    texts = catBatch(
      root,
      judged.map((p) => `${baseRef}:${p}`),
    )
  } catch (e) {
    batchError = firstLine(e)
  }
  if (!batchError) {
    for (const p of judged) {
      const wt = worktreeOf.get(p)
      const base = texts.get(`${baseRef}:${p}`)
      if (
        typeof wt === 'string' &&
        typeof base === 'string' &&
        Math.max(wt.length, base.length) > RESURRECT_MAX_BLOB_BYTES
      ) {
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
    if (batchError)
      line = {
        status: 'undetermined',
        reason: `祖先正文批量读取失败:${batchError}`,
        sample: [],
        commits: [],
      }
    else if (sizeExceeded.has(p))
      line = {
        status: 'out-of-scope',
        reason: `正文超过行级扫描尺寸护栏 ${RESURRECT_MAX_BLOB_BYTES}B ⇒ 未读祖先(整 blob 判据仍照判)`,
        sample: [],
        commits: [],
      }
    else if (logFailed.has(p))
      line = {
        status: 'undetermined',
        reason: '祖先提交清单取不到(git log 未能运行)',
        sample: [],
        commits: [],
      }
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
      notes.push({
        ...entry,
        kind: 'line-out-of-scope',
        why: `行级复活判据未覆盖此路径:${line.reason}`,
      })
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
    const blob = o.commit
      ? `== 祖先 ${o.commit}`
      : o.lineStatus === 'judged'
        ? '(内容不等于任何祖先)'
        : '(祖先版本取不到)'
    const who = o.resurrectedBy.length ? `(见于祖先 ${o.resurrectedBy.slice(0, 3).join(', ')})` : ''
    const r =
      o.lineStatus === 'judged'
        ? `复活 ${o.resurrected} 行(证据行门槛:含字母且 ≥${RESURRECT_MIN_LINE_LEN} 字符)${who}`
        : `复活行数未判定:${o.lineReason}`
    lines.push(`   - ${o.path}  ${blob}  ${v} / ${a} / ${r}`)
    appendSamples(lines, o)
  }
  if (!allowStale) {
    lines.push(
      '   最常见成因:共享工作树副本滞后 HEAD ⇒ 落地器取的是磁盘字节(走 pathspec 只会更糟),',
    )
    lines.push(
      '   而调用方又在这份滞后副本上补了自己的改动(所以整 blob 判据看不见,只有行级复活看得见)。',
    )
    lines.push('   出口 ① 取 HEAD 形态重新施加改动(先看判据再动手,别覆盖别人的在飞现场):')
    lines.push(
      '            git cat-file blob HEAD:<path> > <path>   ← 覆盖工作树副本,确认其中没有你自己的未提交内容才用',
    )
    lines.push('   出口 ② 确属有意重生成 ⇒ LAND_ALLOW_STALE=1 重跑本器(会大声留痕,不会静默放行)')
    lines.push(
      '   标了"未判定"的行是**判据没读到东西**(浅历史 / 超过尺寸护栏 / git 派生失败),不是"检查过且干净";',
    )
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

/**
 * **blob 模式**的陈旧判据:`detectStaleLanding` 的两条判据都以"工作树那份字节 = 要落地的内容"
 * 为前提,而 blob 模式要落的内容根本不在盘上(盘上那份属于别人的在飞改动)—— 套它等于用
 * 别人的内容给自己做证。所以这里换一条同义但可判的尺子:**构造出来的 blob 不得等于该路径
 * 历史上任何一枚 blob**(守门 84 R1 的判据形状,只是取材从索引换成显式 blob)。
 * 等于祖先 ⇒ 这不是新内容,是一次写回。
 * 行级复活那一维在本模式**结构上不适用**(它比较的是"盘上有没有把删掉的行搬回来"),
 * 因此调用方必须用 `LAND_BLOB_PROOF` 出具"构造内容相对基线只动了本票行"的证据,本器把那句话
 * 原样打进输出 —— 少一道守卫必须写明少了哪道、由什么替代,不得静默当"判过了"。
 */
export function blobAncestorClash({ root, paths, blobOf, baseRef = 'HEAD' }) {
  const clashes = []
  const unjudged = []
  const notes = []
  for (const p of paths) {
    const oid = blobOf.get(p)
    if (!oid) {
      unjudged.push({ path: p, why: '清单里没有该路径的 blob' })
      continue
    }
    if (headBlobOf(baseRef, p, { root }) === ABSENT) {
      notes.push({ path: p, why: '基线里没有该路径(新增文件)⇒ 无祖先可对账,按定义不构成写回' })
      continue
    }
    // 祖先清单与批量取 blob 都用守门 84 的那两份出口(窗口数字、失败语义都住在它内部)
    const anc = ancestorCommits(root, p)
    if (!anc.length) {
      // 一个祖先都取不到 ⇒ 这一维**没判**,不得读成"不等于任何祖先"
      unjudged.push({ path: p, why: '祖先清单为空/取不到 ⇒ 无法对账' })
      continue
    }
    const ab = resolveBlobs(
      root,
      anc.map((c) => `${c}:${p}`),
    )
    if (ab.size !== anc.length) {
      unjudged.push({ path: p, why: `祖先正文只取到 ${ab.size}/${anc.length} 个 ⇒ 对账不完整` })
      continue
    }
    const hit = anc.filter((c) => ab.get(`${c}:${p}`) === oid)
    if (hit.length)
      clashes.push({ path: p, oid, commits: hit.slice(0, 3).map((c) => c.slice(0, 9)) })
  }
  return { clashes, unjudged, notes }
}

/**
 * blob 模式的水幕检查:`watermark.mjs_verify` 读的是盘上文件,对 blob 内容零覆盖。
 *
 * 判的是**单向**关系:基线有横幅而构造内容没有 ⇒ 有人把横幅抹掉了 ⇒ 拒落。
 * 刻意不要求"两边前三行逐字等值" —— 那等于**强制**目标必须带横幅,于是新增文件/第三方台账
 * 内容(按 §5c 与守门 107 P8 的口径本来就没有我们的横幅)会被本器自己的预检挡住,
 * 而"给出路且跑不通"正是本仓反复登记过的那类缺陷。
 * 载荷可解码性仍由提交链上的水印守门负责,本器只保证"不是我抹的"。
 */
/**
 * blob 模式的水幕检查:`watermark.mjs verify` 读的是盘上文件,对 blob 内容零覆盖。
 *
 * 判的是**单向**关系:基线有横幅而构造内容没有 ⇒ 有人把横幅抹掉了 ⇒ 拒落。
 * 刻意不要求"两边前三行逐字等值" —— 那等于**强制**目标必须带横幅,于是新增文件/第三方台账
 * 内容(按 §5c 与守门 107 P8 的口径本来就没有我们的横幅)会被本器自己的预检挡住,
 * 而"给出路且跑不通"正是本仓反复登记过的那类缺陷。
 *
 * 2026-09-29 补第三态:基线的横幅**不可认**(整块缺失、只剩载荷行、或版权行被编码往返改成乱码)
 * 而构造内容带规范横幅 ⇒ 这是修复,放行并报名。判据最初把这一格也判红,于是"补回被抹掉的署名"
 * 这件正是本器该鼓励的事,被本器自己拦住了 —— 而它拦住的那三份文件,HEAD 上现在仍然没有署名。
 * "篡改规范文案"(两边都规范而文字不同)照旧判红,这一格不让步。
 */
export function decideBanner({ baseText, newText }) {
  const hasAny = hasAnyWatermarkTrace
  const baseCanonical = hasExactCanonicalBanner(baseText)
  const newCanonical = hasExactCanonicalBanner(newText)
  const head3 = (text) => String(text).split('\n').slice(0, 3).join('\n')
  if (!hasAny(baseText) && !hasAny(newText)) {
    return {
      verdict: 'note',
      why: '两边都没有横幅(新增/第三方台账内容)⇒ 本器不逼它长出横幅,交水印守门与 107 P8 判',
    }
  }
  if (hasAny(baseText) && !hasAny(newText))
    return { verdict: 'broken', why: '基线有横幅而构造内容没有 ⇒ 横幅被抹' }
  if (!baseCanonical && newCanonical) {
    return {
      verdict: 'repaired',
      why: '基线横幅不可认(缺失/只剩载荷行/版权行被编码往返改坏)而构造内容带规范横幅 ⇒ 这是补回署名,放行并报名',
    }
  }
  if (head3(baseText) !== head3(newText)) {
    if (!newCanonical)
      return { verdict: 'broken', why: '构造内容的横幅不可认 ⇒ 拒绝把无署名内容放进 HEAD' }
    return {
      verdict: 'broken',
      why: '两边都是规范横幅而前三行仍被换掉 ⇒ 这是在改写横幅文字,不是保持',
    }
  }
  return { verdict: 'kept', why: '前三行与基线逐字等值 ⇒ 横幅未被触碰' }
}

export function blobBannerPreserved({ root, paths, blobOf, baseRef = 'HEAD' }) {
  const broken = []
  const unjudged = []
  const notes = []
  for (const p of paths) {
    const baseOid = headBlobOf(baseRef, p, { root })
    if (!blobOf.get(p)) {
      unjudged.push({ path: p, why: '清单里没有该路径的 blob' })
      continue
    }
    /**
     * "基线里没有"与"问不到基线"是两件事(与上面祖先对账第 509 行同一约定,那里一直是对的):
     * 新增文件**按定义**没有可保持的横幅,把它计成未判定会让任何带新文件的落地整体 exit 2,
     * 而这台工具是共享落地出口 —— 卡住的不是本次提交,是所有会话。新增件的横幅覆盖交
     * 水印守门(它有"新增必须注入"的权威判据),本器只守"别把已入库的横幅改掉/放进无横幅内容"。
     */
    if (baseOid === ABSENT) {
      notes.push({ path: p, why: '基线里没有该路径(新增文件)⇒ 无横幅可保持,新增覆盖交水印守门判' })
      continue
    }
    if (baseOid === UNKNOWN) {
      unjudged.push({ path: p, why: '基线 blob 问不到 ⇒ 无法判横幅是否保持' })
      continue
    }
    const bt = git(['cat-file', 'blob', baseOid], { root, raw: true, allowFail: true })
    const nt = git(['cat-file', 'blob', blobOf.get(p)], { root, raw: true, allowFail: true })
    if (bt === null || nt === null) {
      unjudged.push({ path: p, why: 'blob 正文取不到' })
      continue
    }
    const d = decideBanner({ baseText: bt, newText: nt })
    if (d.verdict === 'broken') broken.push({ path: p, why: d.why })
    else if (d.verdict === 'note' || d.verdict === 'repaired') notes.push({ path: p, why: d.why })
  }
  return { broken, unjudged, notes }
}

/**
 * 提交面存在性三态探针(2026-09-29 票 G-801)。存在性一律**问 git 的结论**,不再拿
 * `git show --name-only` 的输出字节当路径身份 —— git 默认按 core.quotePath 把非 ASCII 路径
 * 八进制转写并加引号,旧式逐字比对使任何中文/带空格路径**必然**比不中,把已成功的交付报成
 * "缺路径"(枚 `fea980104b` 实测:`docs/项目说明/8端一致性认证矩阵-2026-09-15.md` 真在树里、
 * `cat-file -e` 成立,回读却打了红)。假失败的后果不是多看一眼日志:读到"没入库"的人会重跑
 * 同一次落地(幂等判据 G-321① 拦的就是这个),或改走 `git add && git commit` 的 pathspec 路径 —— 那才是 §12 的真事故。
 *
 * 为什么不复用 lib 的 `git()`:它把任何非零一律折叠(throw 掉数字退出码 / allowFail 时 null),
 * 而这一维的三态各自有结论 —— "git 明确说不在树里"(absent,业务红,exit 1)与
 * "问不到"(未判定,exit 2,不得冒充前者)是两件事。同型先例:bypass-git 的 `isAncestor`
 * 也为此自带一次 spawnSync(见其头注),不在调用方各写一份的是**判据**,不是派生姿势。
 *
 * 归因规则(实测 git 2.55,`cat-file -e` 对"路径不在树"与"commit 解不出"**都返回 128**,
 * 所以状态数字本身不足以分两态,必须两路正交信号):
 *  - 派生 rc=0 ⇒ present;
 *  - rc 为数字 且 stderr 命中"树里应答"签名(does not exist in / exists on disk, but not in)
 *    且 提交对象本身可解析(前置一次性 rev-parse,解不出则整批未判定)⇒ absent;
 *  - 其余(ENOENT/超时/被信号终止/退出码不带应答签名)⇒ undetermined。
 * 三条不变量:present+absent+undetermined 恒等于 paths.length(非 ASCII 路径**不得被静默跳过**);
 * 未判定不得折成 absent;git 给不出应答时绝不冒称判过。
 */
export function commitFacePresence({ root, commit, paths, timeoutMs = 30_000 }) {
  const present = []
  const absent = []
  const undetermined = []
  const baseArgs = ['-c', 'safe.directory=*']
  if (process.platform === 'win32') baseArgs.push('-c', 'core.protectNTFS=false')
  const ask = (args) => {
    try {
      execFileSync(GIT_BIN, [...baseArgs, '-C', root, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: 8 << 20,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { status: 0, errText: '' }
    } catch (e) {
      return { status: e.status, errText: `${e.stderr ?? ''}${e.message ?? ''}` }
    }
  }
  // 前置一次"问得到吗":提交对象本身解析不出 ⇒ 整批未判定(不得把"问不到"折叠成"没有")。
  const probe = ask(['rev-parse', '--verify', '--quiet', `${commit}^{commit}`])
  if (probe.status !== 0) {
    for (const p of paths)
      undetermined.push({ path: p, why: '落地的提交本身问不到(rev-parse 非 0)⇒ 存在性未判定,不是"缺路径"' })
    return { present, absent, undetermined }
  }
  for (const p of paths) {
    const r = ask(['cat-file', '-e', `${commit}:${p}`])
    if (r.status === 0) present.push(p)
    else if (typeof r.status === 'number' && /does not exist in|exists on disk, but not in/.test(r.errText))
      absent.push(p)
    else
      undetermined.push({
        path: p,
        why: `cat-file -e 未给出"树里应答"(status=${r.status ?? '派生失败/超时/信号'})⇒ 未判定,不折成"缺路径"`,
      })
  }
  return { present, absent, undetermined }
}

async function main() {
  const parsed = parseArgs()
  if (parsed.error) {
    console.error(`❌ ${parsed.error}`)
    process.exit(2)
  }
  const { root, paths, msg, baseRef, blobOf } = parsed
  const skipWatermark = process.env.IHUI_LAND_SKIP_WATERMARK === '1'

  const head0 = git(['rev-parse', 'HEAD'], { root })
  const base = new Map(paths.map((p) => [p, headBlobOf(baseRef, p, { root })]))
  const mine = new Map(
    paths.map((p) => [p, blobOf ? blobOf.get(p) : writeBlobOfWorktree(p, { root })]),
  )
  if (blobOf) {
    const proof = String(process.env.LAND_BLOB_PROOF ?? '').trim()
    if (proof === '') {
      console.error(
        '❌ blob 模式必须出具 LAND_BLOB_PROOF(一句话说明"构造内容相对基线只动了本票行"是靠什么证的)\n' +
          '   理由:工作树取材的两道陈旧守卫在 blob 模式结构上不适用,少了守卫必须写明由什么替代,\n' +
          '   不得让"没判"在账面上读成"判过了"。',
      )
      process.exit(2)
    }
    console.log(
      `ℹ️ blob 模式(内容来自对象空间清单,不取工作树字节)⇒ 盘上那份属于他人改动,本器不读它`,
    )
    console.log(`   替代证据:${proof}`)
    const clash = blobAncestorClash({ root, paths, blobOf })
    if (clash.clashes.length) {
      console.error(`❌ 构造内容与该路径某历史 blob 逐字节相同 ⇒ 那是写回旧版,不是新内容:`)
      for (const c of clash.clashes) console.error(`   ${c.path} == ${c.commits.join('/')}`)
      process.exit(1)
    }
    if (clash.unjudged.length) {
      console.error(
        `❌ 祖先对账未能运行(${clash.unjudged.length} 个路径):把"问不到"写成"不等于任何祖先"就是给合格证背书`,
      )
      process.exit(2)
    }
    console.log(`✅ 祖先对账 ${paths.length}/${paths.length} 路径:构造内容不等于任何历史 blob`)
    const banner = blobBannerPreserved({ root, paths, blobOf, baseRef })
    for (const n of banner.notes || []) console.log(`   ℹ️ ${n.path}:${n.why}`)
    if (banner.broken.length) {
      console.error(`❌ 水印横幅未保持(把无横幅内容放进 HEAD,或改写了横幅本身):`)
      for (const b of banner.broken) console.error(`   ${b.path}:${b.why}`)
      process.exit(1)
    }
    if (banner.unjudged.length) {
      console.error(`❌ 横幅检查未能运行(${banner.unjudged.length} 个路径):取不到不等于保持`)
      process.exit(2)
    }
    console.log(
      `✅ 水印横幅保持 ${paths.length - (banner.notes || []).length}/${paths.length} 路径${(banner.notes || []).length ? `(另有 ${(banner.notes || []).length} 个基线本就无横幅,只点名不逼它长出横幅)` : ''}`,
    )
  }

  // 声明无差异 ⇒ 事先拒绝(提交面回读结构上证明不了"改了它";safe-commit Step③ 同型的中止语义,前置到写盘之前)
  const noDiff = paths.filter((p) => mine.get(p) === base.get(p))
  if (noDiff.length > 0) {
    console.error(
      `❌ 这些声明路径与基线(${baseRef})内容逐字节相同 ⇒ 拒绝落地(提交面回读永远证不了它们被改):\n  ${noDiff.join('\n  ')}`,
    )
    process.exit(1)
  }

  /**
   * 陈旧落地守卫:放在 CAS **与水印预检之前** —— 拒绝路径上对象库、ref、索引都没被碰过,
   * 也不必先花一次 verify 派生去为一个注定不落地的内容做证。
   * 判据本身不在此重述(见 detectStaleLanding),这里只接线。
   * **blob 模式不走这一段**:它的两条判据都以"盘上那份 = 要落的内容"为前提,而 blob 模式的
   * 盘上那份属于别人;上面已换成祖先对账 + 横幅保持 + 调用方出具的证明,三条各自大声报数。
   */
  const allowStale = process.env.LAND_ALLOW_STALE === '1'
  if (!blobOf) {
    if (allowStale)
      console.log('⚠️ LAND_ALLOW_STALE=1 ⇒ 陈旧落地守卫只做报告、不参与拒绝(该行输出即留痕)')
    const guard = detectStaleLanding({ root, paths, baseRef, head: head0 })
    const refusing = !guard.ok && !allowStale
    for (const line of staleReport(guard, { allowStale })) {
      if (refusing) console.error(line)
      else console.log(line)
    }
    if (refusing) process.exit(1)
  }

  let landed = ''
  let parentSha = ''
  // 水印预检(G-253):旁路提交不跑钩子,这道检查是"无横幅文件进 HEAD"的唯一拦截点。
  // 放在 CAS **之前** —— 校验不通过时对象库与 ref 都未被动过。
  // blob 模式改由 blobBannerPreserved 判(上面已跑):verify 读的是盘上文件,而盘上那份属于别人,
  // 拿它给要落地的内容做证就是替别人的内容签字。
  if (!skipWatermark && !blobOf) {
    const preflight = watermarkPreflight({ root, paths })
    if (!preflight.ok) {
      console.error(`❌ 水印预检不通过,拒绝落地:${preflight.why}`)
      console.error('   应急跳过(仅限确属台账第三方内容):IHUI_LAND_SKIP_WATERMARK=1')
      process.exit(1)
    }
    console.log(
      `✅ 水印预检通过 ${paths.length}/${paths.length} 路径(verify 口径,含第三方台账排除)`,
    )
  } else if (skipWatermark) {
    // 上一版把这条写成 `else`,于是 **blob 模式**(它有自己的横幅判据,已在上面跑过)也走进这一支,
    // 打印出一句"本次跳过水印预检"—— 那是**凭空声称一个没发生的放行**:环境变量根本没设,
    // 读报告的人会以为有人绕过了守卫(而这类"账面声称的出路"正是本仓记过多次的失效型)。
    console.log('⚠️ IHUI_LAND_SKIP_WATERMARK=1 ⇒ 本次跳过水印预检(该行输出即留痕)')
  }
  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt++) {
    const head = git(['rev-parse', 'HEAD'], { root })
    const clobber = clobberedPaths(paths, base, head, { root })
    if (clobber.length > 0) {
      console.error(
        `❌ 放弃落地:HEAD 已推进且这些目标路径被别人改过 ⇒ 需重新归并而非覆盖(第 ${attempt} 次尝试):\n  ${clobber.join('\n  ')}`,
      )
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
      console.log(
        `✅ 第 ${attempt} 次 CAS 成功 HEAD=${commit}(基线 ${baseRef}=${head0.slice(0, 9)})`,
      )
      break
    }
    console.log(`⚠️ 第 ${attempt} 次 CAS 失败(别人先推进了 HEAD),重读重试`)
  }
  if (landed === '') {
    console.error(`❌ ${MAX_CAS_ATTEMPTS} 次均未抢到 CAS,主索引未动`)
    process.exit(1)
  }

  // ① 提交面回读(G-801):存在性逐路径问 git 的结论 `cat-file -e <commit>:<path>`,三态不并桶。
  //    旧写法解析 `git show --name-only` 的输出文本并与声明路径逐字比对 —— git 默认按
  //    core.quotePath 把非 ASCII 路径八进制转写并加引号,中文/带空格路径必然比不中,
  //    把已成功的交付报成"缺路径";假失败会诱使重跑一次已经成功的落地(G-321① 幂等判据要拦的事)。
  const face = commitFacePresence({ root, commit: landed, paths })
  if (face.undetermined.length > 0) {
    console.error(`❌ 提交面回读未判定(${face.undetermined.length} 路径):git 对"在不在树里"给不出结论 ⇒ 既不报"在树"也不报"缺路径":`)
    for (const u of face.undetermined) console.error(`   ${u.path} (${u.why})`)
    console.error(`   落地已推进 HEAD=${landed};先查 git 为何问不到,再逐路径核验 \`git cat-file -e ${landed.slice(0, 9)}:<path>\`;禁止按"缺路径"重跑本次落地`)
    process.exit(2)
  }
  const notProven = face.absent
  if (notProven.length > 0) {
    console.error(`❌ 提交面回读缺路径(消息声称的改动没真进树;git 逐路径答"不在 ${landed.slice(0, 9)} 的树里"):\n  ${notProven.join('\n  ')}`)
    process.exit(1)
  }
  // `--name-only` 清单只留作"是否混提"的辅助提醒,且**必须**带 -c core.quotePath=false ——
  // 否则非 ASCII 路径会被转写成引号形态,辅助判据自己重演 G-801 那一型。它不参与存在性结论。
  let listed = null
  try {
    listed = new Set(
      git(['-c', 'core.quotePath=false', 'show', '--name-only', '--format=', landed], { root })
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean),
    )
  } catch (e) {
    console.log(
      `⚠️ 混提核查问不到(辅助提醒维,不参与存在性结论):${e && e.message ? e.message : e}`,
    )
  }
  const extras = listed ? [...listed].filter((p) => !paths.includes(p)) : []
  console.log(
    `✅ 提交面回读 ${paths.length}/${paths.length} 路径在树${listed ? (extras.length ? `;另有非声明路径 ${extras.length} 条(检查是否混提)` : '') : '(混提核查未判定)'}`,
  )

  /**
   * G-725 留痕:走到这里"这枚提交已在 HEAD 里、且声明路径都过了逐路径存在性判定"是既成事实 ——
   * 主索引对齐(下一步)成功与否都不改变"它绕过了提交链"这一点,所以留痕必须写在对齐**之前**、
   * 写在回读三态判定**之后**(回读未判定/缺路径的分支各有自己的退出码,那些情形不该记成"已落地")。
   * 硬要求:写失败只喊一行 WARN,绝不把一次成功落地判红(它记的是账,不是门禁)。
   * 这一族曾被一次"按滞后工作树副本提交的旁路落地"整体抹掉过(2026-09-29 现读 HEAD 计数 0),
   * 所以它的存续由 `scripts/tests/plan-tasks-f9.test.mjs` 同族的形状锁看着,不靠人记得。
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
  console.log(
    `✅ 主索引已对齐 ${align.moved.length + align.already.length}/${paths.length} 路径(移动 ${align.moved.length} / 已就位 ${align.already.length})`,
  )
  if (align.skipped.length > 0) {
    console.log(
      `⚠️ 未动(归属他人):\n  ${align.skipped.map((s) => `${s.path} (${s.reason})`).join('\n  ')}`,
    )
  }
  if (align.undetermined.length > 0) {
    console.log(
      `⚠️ 未判定:\n  ${align.undetermined.map((u) => `${u.path} (${u.reason})`).join('\n  ')}`,
    )
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
  commitFacePresence,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
