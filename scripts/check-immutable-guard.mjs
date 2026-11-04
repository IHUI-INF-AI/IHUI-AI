// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 判据面不可变护栏（2026-10-25 立，台账无编号行「不可变护栏」）。
 *
 * ## 这道尺子拦什么
 *
 * 本仓实测过两种"判据被悄悄削"：门体被整枚提交删除（注册表要么仍指向它、要么只留下一条
 * 失效注册），以及 `scripts/lib/` 里共享判据被改一处（所有 import 它的门同时换尺子，而每道门
 * 自己的输出都看不见这件事）。这两类改动的共同点是：**改完之后没有任何一道门会喊**。
 *
 * 本门**不禁止**改判据面 —— 它只要求每次改动都在提交信息里**显式声明理由**：
 *
 *     immutable-exempt: <≥10 字理由>
 *
 * 失效方向按 §0.10 选：多要一次定向说明，绝不是多放一次跳门。没有声明 ⇒ 判红并逐条点名
 * "哪一面 / 为什么受保护 / 怎么合法改"；声明合格 ⇒ 绿。
 *
 * ## 取材面纪律（§0.4，与 70/77/83/98/101/118 同口径）
 *
 *   全量档（默认）  判 **HEAD 与父提交的比对**（HEAD 提交本身改了什么）+ HEAD 提交信息；
 *   `--staged`      判**索引相对 HEAD 的改动**（pre-commit 面），消息必须由
 *                   `--message-file/--message` 显式给（pre-commit 阶段结构上还没有提交信息）；
 *   `--worktree`    只作人工逃生舱：判工作树相对 HEAD 的改动 + 未跟踪文件，同样要求显式消息；
 *   两面旗同给 ⇒ exit 2（`selectFace` 单源）；
 *   清单与改动**同面同轮**取；取不到 ⇒ **未判定 exit 2**，绝不回落另一个面、绝不记绿（§0.3）。
 *
 * ## 为什么 pre-commit 档不给消息就判"未判定"而不是"判红"
 *
 * 结构上拿不到输入 ⇒ 按 §0.3 只能是 exit 2「未判定」，不能冒红（那会是一道恒红门，
 * 逼人 `--no-verify`，§12e）也不能记绿（那等于没有护栏）。所以本门**不进守门批**
 * （guardian-runner / pre-commit 那条链）：
 * 守门执行器 `lib/guardian-executor.mjs` 对注册条目**无条件追加 `--staged`**（现读
 * `const cmdArgs = [...check.args]` + `if (passStaged) cmdArgs.push('--staged')`），而
 * `--staged` 档在本门里结构上没有消息来源 ⇒ 只要提交触及受保护面就 exit 2 ⇒ 按 §12e
 * 那正是一道恒堵门。要把它升成阻断档，前置 = 挂点换到 **commit-msg**（此时 `$1` 就是
 * 本次消息文件）且执行器要能按门给面参数，两件事都不在本席射程内（热档只读）。
 *
 * 2026-11-04 现状更正（本段原文预测的前置条件已部分到位，如实改写，不留跑不通的说法）：
 * `.husky/commit-msg` 里已挂一档 `--staged --message-file "$1"` 的**只报不拦**预警
 * （`|| true`，与 check-style-verification 同形），目的不是拦，而是把同一判据搬到
 * "还改得动"的那一刻——未声明的枚一旦落账，本仓（pre-rebase 硬拦 + 多席共享工作树）
 * 结构上没有重写出路，只剩持钥方追认台账。**阻断档仍未升**：执行器仍无条件追加 `--staged`，
 * 而守门批里「未判定」非零退出会顶住全仓每一次提交（§12e）；硬墙依旧是 push 门那一档
 * （`--range origin/main..HEAD`，判的是提交自己的面）。
 *
 * ## 派发点（2026-10-30 接线，§0.9"造好没装车 = 没有"的出口）
 *
 * 唯一调度器 = `scripts/git-guardian.mjs` 的 `auditImmutableGuardNewCommits()`（巡检轮，
 * 5 分钟节流），跑 `--audit-new --record --json`：
 *
 *   `--audit-new` 判"**游标之后**的每一枚新提交恰好一次"（游标 =
 *                  `.ihui-agent/state/immutable-guard-audit.json`，与 `check-merge-addition-loss.mjs
 *                  --all-new` 同型）；每枚提交按**它自己那一面**取清单与改动
 *                  （`${rev}` 与 `${rev}^`，§0.4 同面同轮），提交信息取 `${rev}` 自己的正文。
 *   首轮无游标 ⇒ **只立游标、不判历史**（state=bootstrapped 并明写"历史未判"）：老提交里
 *                  没带 trailer 的是存量，按 §0.2 不许拿存量把这枚巡检点红，也不许写成"零违规"。
 *   游标不是 HEAD 祖先（改写史 / 强推）⇒ 只判最近 `--limit` 枚并点名 `cursor-detached`，
 *                  绝不静默当成"没有新提交"。
 *   区间超过 `--limit`（默认 50）⇒ 本轮判 limit 枚后**游标不推进**，已判 sha 记入 state
 *                  的 `judged` 集合，余数进 `pending`；后续轮次只判集合差集，直到区间全判完
 *                  才把游标推进到本轮 HEAD。旧实现把游标推到"日期序最老段末位"，而
 *                  `cursor..HEAD` 里的并行分支提交（不是游标后代）不会被新游标排除 ⇒
 *                  实测 2026-11-02 在 4 枚游标间循环 6 轮、pending 恒在 1833~1906 打转，
 *                  10-30 的存量永远判不完、告警每 4 小时重投一次。集合差集保证恰好一次且收敛。
 *   合并提交**跳过并计数**（`skippedMerges`）：它按第一父比 diff，命中就是父辈内容的并集，
 *                  而父辈那些枚自己已被判过 ⇒ 再判一遍是把同一件事记两回。残余缺口 =
 *                  恶意 merge 自己改判据面（两父都没有的形态）：那一格归 `root-guard --check`
 *                  的哈希封条（部署环 fail-closed），本档如实不覆盖。
 *
 * 判红不阻断任何提交（旁路检测档），但经 guardian 的到人通道按**稳定身份**去重上报
 * （`dedupKey='undeclared'`，明细与 sha 不进身份，§5e-3）：判据必须"看得见地响"。
 *
 * ## 判定顺序（`lib/immutable-guard.mjs` 的 `decide`，单一真相源）
 *
 *   清单坏行 / 清单空 / 清单取不到 ⇒ 2；清单 reviewBy 到期 ⇒ 1（§0.7 豁免会到期）；
 *   未触及 ⇒ 0；触及但拿不到消息 ⇒ 2；触及且有有效声明 ⇒ 0；触及无声明/理由过短 ⇒ 1。
 *
 * 手动：
 *   node scripts/check-immutable-guard.mjs                    # HEAD 面（HEAD vs HEAD^）
 *   node scripts/check-immutable-guard.mjs --staged --message-file .git/COMMIT_EDITMSG
 *   node scripts/check-immutable-guard.mjs --worktree --message "…"
 *   node scripts/check-immutable-guard.mjs --audit-new [--record] [--limit 50] [--json]
 *   node scripts/check-immutable-guard.mjs --self-test        # 自检（真跑 git 夹具，§22c 反向牙）
 */

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  EXEMPT_TRAILER,
  MIN_REASON_CHARS,
  CODE_LABEL,
  GUARD_DATA_REL,
  MIN_KEY_CHARS,
  SIGNATURE_REQUIRED_KEY,
  SIG_TRAILER,
  SIG_VERSION,
  SIG_VERSION_V2,
  SIG_VERSION_CURRENT,
  sigBaseOf,
  UNSIGNED_LEDGER_REL,
  decide,
  parseGuardList,
  parseNameStatusZ,
  parseExemptTrailer,
  parseSigTrailer,
  probeEntry,
  matchProtected,
  globToRegExp,
  signExemption,
  signExemptionV2,
  subjectOf,
  todayStr,
  verifyExemption,
  judgeChanges,
  exemptPayload,
  exemptPayloadV2,
  ACK_LEDGER_REL,
  FULL_SHA_RE,
  signAck,
  parseAckLedger,
} from './lib/immutable-guard.mjs'
import {
  FACES,
  Undetermined,
  catBatch,
  catBatchOids,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

/** 仓根由脚本自身位置推导，禁 `process.cwd()`（§15：共享工作区 cwd 不可靠）。 */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 同仓既有惯例：本门自己的应急放行变量（门体自身也读它，手动复跑同样生效）。 */
export const SELF_SKIP = 'HUSKY_SKIP_IMMUTABLE_GUARD'

/** 豁免留痕（§0.7）：`--record` 时逐条追加，落在 gitignored 的 state 目录。 */
export const RECORD_REL = '.ihui-agent/state/immutable-guard-exemptions.jsonl'

/**
 * 签发台账（2026-11-04 立）：`--sign-staged` 每签一次就记一行"我为哪个标题、哪批路径、哪句理由签的"。
 * 存在的理由是这一型事故当天真发生过：签发时钉的是**计划标题**，提交信息随后被改序，
 * 而签名载荷绑标题 ⇒ 验签必然不过 ⇒ 读数只说 `sig-invalid`，作者看不出"我少改了什么"，
 * 最可能的下一步就是"再补一句理由"或跳门——两条都是错的方向。
 * 有了这行台账，验不过时能直接把"当时签给谁"摊开对照：出路立刻从"补理由"变成"重签一次"。
 * 只存标题/路径/理由/签名（都是本来就写在提交信息里的东西），**绝不存密钥**。
 */
export const SIG_ISSUE_REL = '.ihui-agent/state/immutable-guard-sig-issues.jsonl'

/** 签发留痕：写失败只回传 null，不影响签发本身（留痕是帮助，不是判定输入）。 */
function recordSigIssue(root, { subject, paths, reason, sig, base = null, blobs = null }) {
  try {
    const abs = path.join(root, SIG_ISSUE_REL)
    mkdirSync(path.dirname(abs), { recursive: true })
    appendFileSync(
      abs,
      `${JSON.stringify({ at: new Date().toISOString(), subject, paths, reason, sig, base, blobs })}\n`,
      'utf8',
    )
    return SIG_ISSUE_REL
  } catch {
    return null
  }
}

/**
 * 拿"消息里那条签名"回查签发台账。命中 ⇒ 返回当时钉住的标题与路径集（用于点名成因）；
 * 取不到文件 / 没这条 ⇒ null（**不猜**，也不因此改判：判红就是判红，这里只多给一条可执行的成因线索）。
 */
export function findSigIssue(root, sigs) {
  const want = new Set((Array.isArray(sigs) ? sigs : []).map((s) => String(s).trim()))
  if (want.size === 0) return null
  let text
  try {
    text = readFileSync(path.join(root, SIG_ISSUE_REL), 'utf8')
  } catch {
    return null
  }
  let hit = null
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue
    let o
    try {
      o = JSON.parse(line)
    } catch {
      continue
    }
    if (o && want.has(String(o.sig))) hit = o
  }
  return hit
}

/**
 * 把"验签失败"按**签发时的三样东西**逐格比对，点名到底是哪一格变了。
 *
 * 2026-11-04 校正：路径集不一致**不是一个成因**，必须再按"包含方向"分角——两种真实现场都在这天
 * 同一仓里出现过，混成一句"路径集不一致"会把上游问题指成判据问题：
 *   `subject` 变、路径集不变 ⇒ `subject-polluted`（**②** 多会话共用 `.git/COMMIT_EDITMSG`，
 *              标题来自别席）。这是上游问题，不是判据缺陷，也**不据此放宽标题绑定**；
 *   `paths` 变、标题不变 ⇒ 再分三种：
 *     · 签名路径集 ⊆ 实际命中面（`missing` 为空，`extra` 非空）⇒ `path-set-drift`（**①** 取数面
 *       在签发后**变宽**：HEAD 前移/共享索引在签发后被别席加条目。真篡改只会"变宽"这一侧被
 *       签名挡住，v2 钉 base 后这一型应消失）；
 *     · 签名路径集 ⊃ 实际命中面（`missing` 非空，`extra` 为空）⇒ `signed-set-superset`
 *       （签发用的索引比提交用的索引宽，常见"签了共享索引、提交用更窄的私有索引"）；
 *     · 两边都有（`missing` 与 `extra` 都非空）⇒ `message-from-other-commit`（**②** 整条消息
 *       串号：签名行连同标题一起来自另一条提交，签的根本不是这批路径——注意此时标题对比
 *       **会显示一致**，因为串号把标题也一起换掉了，只靠标题比对无法发现）；
 *   `blobs` 变而路径集不变 ⇒ `blob-drift`（内容被换，v1 结构上就看不见这一格）。
 * 三格都同而签名仍不过 ⇒ 密钥不对或抄了别处的签名（归 `key-or-signature-mismatch`）。
 *
 * 这是**判别器**，不是判定器：返回值只进报告，不参与 exit code（判红仍是判红）。
 */
export function decomposeSigMismatch(issued, actual) {
  const iPaths = [...new Set((issued?.paths ?? []).map((p) => normalizeRel(p)))].sort()
  const aPaths = [...new Set((actual?.paths ?? []).map((p) => normalizeRel(p)))].sort()
  const paths = iPaths.length !== aPaths.length || iPaths.some((p, i) => p !== aPaths[i])
  const subject = String(issued?.subject ?? '').trim() !== String(actual?.subject ?? '').trim()
  const missing = iPaths.filter((p) => !aPaths.includes(p))
  const extra = aPaths.filter((p) => !iPaths.includes(p))
  let blobs = false
  const iBlobs = issued?.blobs && typeof issued.blobs === 'object' ? issued.blobs : null
  // 只有在**两边都出现**的路径上比内容号才有意义：一侧没有的路径已由 missing/extra 点名。
  // 2026-11-04 补：此前只在"路径集完全相同"时才比 blob，`path-and-blob-drift` 实际不可达；
  // 共有路径内容也变时，只报"路径集漂移"会让作者重签后再次因 blob 不符判红。
  if (iBlobs) {
    for (const p of iPaths) {
      if (!aPaths.includes(p)) continue
      if (String(iBlobs[p] ?? '') !== String(actual?.blobs?.[p] ?? '')) {
        blobs = true
        break
      }
    }
  }
  let cause
  if (subject && !paths && !blobs) cause = 'subject-polluted'
  else if (!subject && !paths && blobs) cause = 'blob-drift'
  else if (!subject && paths && blobs) cause = 'path-and-blob-drift'
  else if (!subject && paths) {
    if (missing.length && extra.length) cause = 'message-from-other-commit'
    else if (missing.length) cause = 'signed-set-superset'
    else cause = 'path-set-drift'
  } else if (subject && paths) cause = 'subject-and-paths'
  else cause = 'key-or-signature-mismatch'
  return { subject, paths, blobs, cause, missing, extra, issuedPaths: iPaths, actualPaths: aPaths }
}

/**
 * 追认台账取面：一律取**被审面的可见末端**（巡检/推送档 = HEAD blob，§0.4 同面同轮），不取工作树。
 * 理由："本地先塞一行台账就能把历史某枚洗白"这件事结构上不成立——那一行必须先进仓，
 * 而进仓本身要过本护栏（台账已登记进受保护面清单）。
 * 文件不存在 ⇒ `rows=[] / absent=true`（现状=还没有任何追认，这不是"读不到"）；
 * 坏行 ⇒ 进 `problems` 逐条点名，坏行不会被当成"没有追认"静默跳过（§0.7 清单腐烂要可见）。
 */
export function readAckRows(root, { rev = 'HEAD' } = {}) {
  let text
  try {
    text = readFaceText(root, 'head', ACK_LEDGER_REL, rev)
  } catch (e) {
    return {
      rows: [],
      problems: [{ why: `台账取不到（${e?.message ?? e}）⇒ 本轮没有可用追认` }],
      absent: false,
    }
  }
  if (text === null) return { rows: [], problems: [], absent: true }
  const parsed = parseAckLedger(text)
  return { rows: parsed.rows, problems: parsed.problems, absent: false }
}

/** head 面才有"被追认的那一枚"；解析不出 40 位 sha ⇒ null（不猜，也不拿 rev 字符串去比）。 */
function ackShaOf(root, face, rev) {
  if (face !== 'head') return null
  const raw = String(rev ?? '')
  if (FULL_SHA_RE.test(raw)) return raw
  try {
    const s = String(gitRaw(['rev-parse', raw], root) ?? '').trim()
    return FULL_SHA_RE.test(s) ? s : null
  } catch {
    return null
  }
}

/**
 * 该 sha 是否已进 `origin/main`（a1 历史兼容的唯一边界）。
 * 已入库 ⇒ 历史改不动、也不会再进推送区间 ⇒ 旧 a1 追认只在这一档保留；
 * 本地枚（待推的那些）⇒ false，必须走 a2 独立追认。取不到 origin/main ⇒ false（fail-closed）。
 */
function isOnOriginMain(root, sha) {
  if (!FULL_SHA_RE.test(String(sha ?? ''))) return false
  try {
    gitRaw(['merge-base', '--is-ancestor', String(sha), 'origin/main'], root)
    return true
  } catch {
    return false
  }
}

/**
 * 验签密钥的三个来源（优先级从高到低），全部**在提交者可控范围之外**才有意义：
 *   `IHUI_IMMUTABLE_GUARD_KEY`       CI / 机主直接注入的密钥串（最高优先，CI 的唯一推荐形态）；
 *   `IHUI_IMMUTABLE_GUARD_KEY_FILE`  CI / 机主注入的密钥文件路径；
 *   `git config ihui.immutableGuardKeyPath`
 *                                    机主在仓外（`~/.gitconfig` 或本机配置）登记的密钥文件路径。
 * **三个都取不到 ⇒ 密钥不存在 ⇒ 需要验签的一律按 `key-unavailable` 判 unverified（fail-closed）**，
 * 绝不允许"没有钥匙就默认放行"。密钥长度 < MIN_KEY_CHARS 同样按无效处理（短密钥可被暴力猜）。
 */
export const KEY_ENV = 'IHUI_IMMUTABLE_GUARD_KEY'
export const KEY_FILE_ENV = 'IHUI_IMMUTABLE_GUARD_KEY_FILE'
export const KEY_CONFIG = 'ihui.immutableGuardKeyPath'

/**
 * 独立追认密钥（2026-11-04 立，治"作者自认"）：追认用的是**另一把**钥，与提交签名钥分档。
 * 同一个 agent 会话既写提交又写追认行 = 自己给自己补豁免，把"他方追认"退化成一句自由文本；
 * 所以两把钥指纹相同 ⇒ `ack-self-key` 直接拒，缺钥 ⇒ `ack-key-unavailable` fail-closed。
 * 来源与提交钥同一套三档，但**三项都换名**（避免 CI 只注入一把钥时被静默复用）。
 */
export const ACK_KEY_ENV = 'IHUI_IMMUTABLE_GUARD_ACK_KEY'
export const ACK_KEY_FILE_ENV = 'IHUI_IMMUTABLE_GUARD_ACK_KEY_FILE'
export const ACK_KEY_CONFIG = 'ihui.immutableGuardAckKeyPath'

/**
 * 密钥句柄:原文**不作为可枚举属性**挂在返回值上(2026-11-05 立)。
 * 立因不是洁癖而是当天一次真实外泄:本函数头注一直写着「绝不把密钥本身写进任何输出」,
 * 但 `key` 是可枚举字段 ⇒ 任何一次调试性 `console.log(整个返回值)` 就把明文打进日志/会话记录,
 * 台账与 JSON 档守住了、打印没守住(实测有一把签发钥这样进了记录)。
 * 读侧 `res.key` 照常可取;`Object.keys` / `JSON.stringify` / 模板插值都不再带它。
 * `{...res}` 会丢 key —— 这是刻意的:密钥不该随展开传播(全仓现读无一处展开用法)。
 */
function maskKeyValue(k) {
  const s = String(k ?? '')
  return s.length <= 8 ? '<redacted>' : `${s.slice(0, 6)}***${s.slice(-2)}`
}

function keyHandle(k, source, why = '') {
  const o = { key: null, source, why }
  Object.defineProperty(o, 'key', {
    value: k,
    enumerable: false,
    writable: false,
    configurable: false,
  })
  o.toJSON = () => ({ key: k ? maskKeyValue(k) : null, source, why })
  return o
}

/** 按三源解析一把密钥；返回 `{key, source, why}`(`key` 不可枚举,见 `keyHandle`),`key===null` = 取不到可用密钥。 */
function resolveKeyBySources(root, env, { envName, fileEnvName, configName, role }) {
  const accept = (raw, source) => {
    const k = String(raw ?? '').trim()
    if (k.length < MIN_KEY_CHARS) {
      return {
        key: null,
        source,
        why: `${source} 提供的密钥长度 ${k.length} < ${MIN_KEY_CHARS}（按无效密钥处理）`,
      }
    }
    return keyHandle(k, source, '')
  }
  const direct = String(env[envName] ?? '').trim()
  if (direct) return accept(direct, envName)
  const fromFile = (file, source) => {
    try {
      const abs = path.isAbsolute(file) ? file : path.join(root, file)
      return accept(readFileSync(abs, 'utf8'), `${source}:${file}`)
    } catch (e) {
      return {
        key: null,
        source,
        why: `${source} 指向的密钥文件读不到（${file}）：${e?.message ?? e}`,
      }
    }
  }
  const envFile = String(env[fileEnvName] ?? '').trim()
  if (envFile) return fromFile(envFile, fileEnvName)
  let configured = ''
  try {
    configured = String(gitRaw(['config', '--get', configName], root)).trim()
  } catch {
    configured = ''
  }
  if (configured) return fromFile(configured, `git config ${configName}`)
  return {
    key: null,
    source: '',
    why: `密钥不存在（${envName} / ${fileEnvName} / git config ${configName} 均未提供 ⇒ ${role}按无钥 fail-closed 处理）`,
  }
}

/**
 * 解析验签密钥。返回 `{key, source, why}`；`key === null` 表示"取不到可用密钥"。
 * 只回传来源**标签**，绝不把密钥本身写进任何输出（台账/JSON/告警都不带它）。
 */
export function resolveSigningKey(root, env = process.env) {
  return resolveKeyBySources(root, env, {
    envName: KEY_ENV,
    fileEnvName: KEY_FILE_ENV,
    configName: KEY_CONFIG,
    role: '',
  })
}

/** 解析独立追认密钥（与提交签名密钥必须是两把，判同一把在 `lookupAck` / `ackCommit` 里做）。 */
export function resolveAckKey(root, env = process.env) {
  return resolveKeyBySources(root, env, {
    envName: ACK_KEY_ENV,
    fileEnvName: ACK_KEY_FILE_ENV,
    configName: ACK_KEY_CONFIG,
    role: '独立追认钥',
  })
}

/**
 * 增量巡检游标（`--audit-new`）：记"判到哪儿了"，与 `check-merge-addition-loss.mjs --all-new`
 * 的位移游标同型 —— 游标之后的每一枚新提交判**恰好一次**。只判"最近一枚"在这一仓不行：
 * 多会话分钟级提交（现读 `.ihui-agent/state/` 各留痕）会让真正该判的那枚跟着别人的提交滑走，
 * 挂点存在而输入看不见 = §0.9 的"挂着-but-瞎"。
 */
export const CURSOR_REL = '.ihui-agent/state/immutable-guard-audit.json'

/** 单轮最多判多少枚（区间更长时留下轮并在 `pending` 里报数，不丢）。 */
export const AUDIT_BATCH_DEFAULT = 50

/**
 * 按判定面读单文件正文。取不到返回 null（**不回落**另一个面，§0.4）。
 * `rev` 只作用于 head 档：增量巡检读的是**那枚提交自己**的清单面（§0.4 清单与改动同面同轮）。
 * @returns {string|null}
 */
export function readFaceText(root, face, rel, rev = 'HEAD') {
  if (!FACES.includes(face))
    throw new Undetermined(`未知判定面 ${String(face)}（只认 ${FACES.join(' / ')}）`)
  if (face === 'worktree') return readWorktreeFile(root, rel)
  const key = face === 'staged' ? `:${rel}` : `${rev}:${rel}`
  const got = catBatch(root, [key])
  return got.get(key) ?? null
}

/**
 * 一批 spec 一次读完（2026-11-05 RP-92，纯削派生、不改判序）。
 * 立因（当次实测，30 枚区间）：逐枚 `cat-file` 单读清单 3.632 秒，批量一次 0.299 秒。
 * 失效方向：整批取不到 ⇒ 返回 `null` ⇒ 调用方**逐枚回落**原来的单读（变慢，但绝不判错）；
 * 单项 missing ⇒ 该键 `null`，与 `readFaceText` 的"该面没有这份清单"逐字同义。
 * @returns {Map<string,string|null>|null}
 */
export function batchFaceTexts(root, specs) {
  const list = [...new Set((Array.isArray(specs) ? specs : []).filter(Boolean).map(String))]
  if (list.length === 0) return new Map()
  try {
    const got = catBatch(root, list, { maxBuffer: 1 << 28 })
    if (!(got instanceof Map)) return null
    for (const s of list) if (!got.has(s)) got.set(s, null)
    return got
  } catch {
    return null
  }
}

const CHANGE_RECORD_SEP = '\x1e'
/**
 * 一批提交的 `rev^..rev` 差异集**一次读齐**（RP-92）。
 * 立因（当次实测）：逐枚 `git diff --name-status -M -z rev^ rev` 60 枚 9.008 秒；
 * 一次 `git log --no-walk=unsorted --name-status -M -z` 同样 60 枚 0.371 秒（≈24×）。
 * 分帧按当次 od -c 实测：`\x1e` + 40 位 sha + `\x00\n` + (`STATUS\x00PATH\x00`…)；
 * 任一片对不上"记录符后紧跟 40 位十六进制"⇒ **整批作废**返回空表 ⇒ 调用方逐枚回落。
 * 已知不等价处（必须由调用方避开，不是本函数兜）：
 *  · 根提交（0 父）：`git log` 无父可差不吐差异，而逐枚档的 `rev^` 会失败 ⇒ `face-missing`；
 *  · 合并提交：本档不吐逐父差异 —— 但 `judgeBatch` 在调用判定前就按父数跳过了它们。
 * @returns {Map<string,Array<{status:string,path:string,oldPath?:string}>>}
 */
export function batchFaceChanges(root, shas) {
  const out = new Map()
  const list = (Array.isArray(shas) ? shas : []).filter((s) => FULL_SHA_RE.test(String(s)))
  if (list.length === 0) return out
  let raw
  try {
    raw = String(
      gitRaw(
        [
          'log',
          '--no-walk=unsorted',
          '-z',
          `--format=${CHANGE_RECORD_SEP}%H`,
          '--name-status',
          '-M',
          '-z',
          ...list,
        ],
        root,
        { maxBuffer: 1 << 28 },
      ),
    )
  } catch {
    return out
  }
  const pieces = raw.split(CHANGE_RECORD_SEP)
  for (const piece of pieces.slice(1)) {
    const m = /^([0-9a-f]{40})(?:\u0000\n|\n)?([\s\S]*)$/.exec(piece)
    if (!m) return new Map()
    out.set(m[1], parseNameStatusZ(m[2]))
  }
  return out
}

/**
 * `origin/main` 的祖先集合（含其自身）—— 把逐枚 `merge-base --is-ancestor` 收成一次遍历。
 * 立因（当次实测）：逐枚 30 次 32.534 秒（≈1.08 秒/枚，本文件最大单项成本），
 * 一次 `git rev-list origin/main` 1.391 秒（45,327 枚）。两者对"是否祖先"答案等价：
 * rev-list 吐的正是"该 ref 及其全部祖先"。
 * 取不到（ref 不存在 / 派生失败 / 空集）⇒ `null` ⇒ 调用方逐枚回落 `isOnOriginMain`
 * （那条今天的失效方向是 false，即 fail-closed，回落不改变判定）。
 * @returns {Set<string>|null}
 */
export function originMainMembership(root, ref = 'origin/main') {
  try {
    const raw = String(gitRaw(['rev-list', String(ref)], root, { maxBuffer: 1 << 28 }))
    const set = new Set(raw.split(/\r?\n/).filter(Boolean))
    return set.size > 0 ? set : null
  } catch {
    return null
  }
}

/**
 * 被审面的改动清单。统一 `--name-status -M -z`（NUL 分帧：中文/空格路径不被打断）。
 * `--worktree` 档把未跟踪文件按 A 计入 —— 新建一枚受保护面同样是"触及判据面"。
 * @returns {Array<{status:string,path:string,oldPath?:string}>}
 */
export function listFaceChanges(root, face, rev = 'HEAD') {
  try {
    if (face === 'head') {
      return parseNameStatusZ(gitRaw(['diff', '--name-status', '-M', '-z', `${rev}^`, rev], root))
    }
    if (face === 'staged') {
      return parseNameStatusZ(gitRaw(['diff', '--cached', '--name-status', '-M', '-z'], root))
    }
    if (face === 'worktree') {
      const tracked = parseNameStatusZ(gitRaw(['diff', '--name-status', '-M', '-z', 'HEAD'], root))
      const untracked = String(gitRaw(['ls-files', '--others', '--exclude-standard', '-z'], root))
        .split('\u0000')
        .filter((p) => p.length > 0)
        .map((p) => ({ status: 'A', path: p }))
      return [...tracked, ...untracked]
    }
    throw new Undetermined(`未知判定面 ${String(face)}`)
  } catch (e) {
    if (e instanceof Undetermined) throw e
    throw new Undetermined(`${face} 面取改动清单失败：${e?.message ?? e}`)
  }
}

/**
 * 按签名自己钉住的 base 重放索引差异集（v2 专用，只对 staged 面有意义）。
 * `git diff --cached <base>` 比的是**索引 vs 那枚旧提交的树**，与当前 HEAD 无关；
 * HEAD 被别席推进时这个面不变，所以合法提交不会再被"多出来的他席条目"顶成 sig-invalid。
 * base 解析不到 / git 失败 ⇒ null（调用方回落当前面，并在读数里点名，不静默当成"面为空"）。
 * @returns {Array<{path:string,status:string,entry:object}>|null}
 */
export function stagedHitsAt(root, entries, base, today = todayStr()) {
  if (!FULL_SHA_RE.test(String(base ?? ''))) return null
  try {
    const changes = parseNameStatusZ(
      gitRaw(['diff', '--cached', '--name-status', '-M', '-z', base], root),
    )
    return judgeChanges({ changes, entries, message: '', today }).hits
  } catch {
    return null
  }
}

/**
 * 命中路径的**内容号**（v2 载荷里的 blob）。与判定同面同轮：
 *   staged  → `:path`（索引条目）；head → `rev:path`（该提交树里的条目）；
 *   worktree→ `hash-object`（工作树字节；人工逃生舱档）。
 * 取不到（路径被删 / 新建未入索引 / 旧 base 树里没有）⇒ 空串；空串本身就是"这一格没有内容号"，
 * 不会被当成某个真实 blob。
 */
export function blobMapFor(root, face, rev, paths) {
  const rels = [
    ...new Set((Array.isArray(paths) ? paths : []).map((p) => normalizeRel(p)).filter(Boolean)),
  ]
  const map = {}
  if (rels.length === 0) return map
  const specOf = (rel) => (face === 'staged' ? `:${rel}` : `${rev}:${rel}`)
  if (face !== 'worktree') {
    // 一次 `cat-file --batch-check` 解完整批命中路径（RP-92；逐枚 `rev-parse --verify` 每枚一次派生）。
    // missing ⇒ null ⇒ 空串，与逐枚档"git 报错 ⇒ 空串"同义：空串本身就是"这一格没有内容号"。
    let oids = null
    try {
      oids = catBatchOids(root, rels.map(specOf))
    } catch {
      oids = null
    }
    if (oids) {
      for (const rel of rels) map[rel] = String(oids.get(specOf(rel)) ?? '').trim()
      return map
    }
  }
  for (const rel of rels) {
    try {
      const arg = face === 'staged' ? `:${rel}` : face === 'worktree' ? null : `${rev}:${rel}`
      const out =
        arg === null
          ? gitRaw(['hash-object', '--', rel], root)
          : gitRaw(['rev-parse', '--verify', arg], root)
      map[rel] = String(out ?? '').trim()
    } catch {
      map[rel] = ''
    }
  }
  return map
}

function normalizeRel(p) {
  return String(p ?? '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
}

function readHeadMessage(root, rev = 'HEAD') {
  return gitRaw(['log', '-1', '--format=%B', rev], root)
}

/**
 * 对某一面跑一次完整判定。返回结构化结果（CLI / 自检 / 镜像测试共用同一实现）。
 *
 * `message` 语义：
 *   `undefined` ⇒ head 档读 HEAD 提交信息；staged/worktree 档为 `null`（= 结构上没有消息）;
 *   `string`    ⇒ 用调用方给的（`--message` / `--message-file` / 夹具）;
 *   `null`      ⇒ 显式"没有消息"。
 * `rev` 只作用于 head 档：`--audit-new` 用它把判定面钉在**被审的那枚提交**上
 *   （清单、改动、提交信息三样都取 `${rev}` 那一轮，§0.4 同面同轮）。
 * `key` 只给自检/测试注入用；`undefined` ⇒ 走 `resolveSigningKey` 的正式三源。
 * `policyRev`（2026-11-04 立，push 门专用）：**策略取自哪里**。默认空 = 与 `rev` 同轮（巡检语义）。
 *   push 门给区间基点（origin/main）：被审者无法在自己提交里删掉/推后 `signatureRequiredFrom`
 *   来给自己放行；命中面 entries 仍取被审提交自己的清单（新增登记对当枚即生效）。
 */
export function runAudit(
  root,
  face,
  {
    message = undefined,
    today = todayStr(),
    record = false,
    rev = 'HEAD',
    policyRev = null,
    key = undefined,
    ackKey = undefined,
    ackRows = [],
    keyRes = undefined,
    ackKeyRes = undefined,
    listTextPre = undefined,
    policyTextPre = undefined,
    changesPre = undefined,
    onOriginMainPre = undefined,
  } = {},
) {
  // 批档(judgeBatch)整批解析一次两把密钥再逐枚透传:密钥来源的**文字**必须与逐枚解析时一致,
  // 所以这里透传的是整个结果对象(而不是把 key 塞进去、让 source 变成 'caller')。
  const keyResFinal =
    keyRes !== undefined
      ? keyRes
      : key === undefined
        ? resolveSigningKey(root)
        : key === null
          ? { key: null, source: '', why: '密钥不存在（调用方显式置空 ⇒ 按 fail-closed 处理）' }
          : { key: String(key), source: 'caller', why: '' }
  const ackKeyResFinal =
    ackKeyRes !== undefined
      ? ackKeyRes
      : ackKey === undefined
        ? resolveAckKey(root)
        : ackKey === null
          ? {
              key: null,
              source: '',
              why: '独立追认密钥不存在（调用方显式置空 ⇒ 按 fail-closed 处理）',
            }
          : { key: String(ackKey), source: 'caller', why: '' }
  const baseOut = {
    face,
    rev,
    exit: 2,
    code: 'face-missing',
    entryCount: 0,
    changeCount: 0,
    hits: [],
    untouched: [],
    exempt: { present: false, reasons: [], problems: [] },
    signature: { present: false, ok: false, code: 'sig-missing', reasons: [], problems: [] },
    signatureRequiredFrom: null,
    keySource: keyResFinal.source,
    keyWhy: keyResFinal.key ? '' : keyResFinal.why,
    expired: [],
    listProblems: [],
    detail: '',
  }
  const useBasePolicy = Boolean(policyRev && policyRev !== rev)
  // 批档预读（judgeBatch 一次读齐全批；`undefined` = 没给 ⇒ 逐枚自取，判定逐字不变。
  // 这里必须区分"预读说这面没有清单"(null ⇒ 直接用)与"没预读"(undefined ⇒ 自己读)，
  // 把前者当后者会白派生，把后者当前者会把判得出来的枚说成 list-missing。）
  let listText
  let policyText = null
  try {
    if (useBasePolicy) {
      policyText =
        policyTextPre !== undefined
          ? policyTextPre
          : readFaceText(root, 'head', GUARD_DATA_REL, policyRev)
      listText =
        listTextPre !== undefined ? listTextPre : readFaceText(root, 'head', GUARD_DATA_REL, rev)
    } else {
      listText =
        listTextPre !== undefined ? listTextPre : readFaceText(root, face, GUARD_DATA_REL, rev)
    }
  } catch (e) {
    if (e instanceof Undetermined) return { ...baseOut, detail: e.message, code: 'list-missing' }
    throw e
  }
  if (listText === null) {
    return {
      ...baseOut,
      code: 'list-missing',
      detail: `受保护面清单在 ${rev} 面不存在：${GUARD_DATA_REL}`,
    }
  }
  if (policyText === null && useBasePolicy) {
    return {
      ...baseOut,
      code: 'list-missing',
      detail: `策略清单在 ${policyRev} 面不存在：${GUARD_DATA_REL}`,
    }
  }
  const parsed = parseGuardList(listText, { today })
  const policyParsed = policyText === null ? parsed : parseGuardList(policyText, { today })
  const listProblems = [...parsed.problems, ...policyParsed.problems]
  if (listProblems.length) {
    return {
      ...baseOut,
      exit: 2,
      code: 'list-bad',
      entryCount: parsed.entries.length,
      listProblems,
    }
  }

  let changes
  if (changesPre !== undefined) {
    changes = changesPre
  } else {
    try {
      changes = listFaceChanges(root, face, rev)
    } catch (e) {
      if (e instanceof Undetermined)
        return {
          ...baseOut,
          entryCount: parsed.entries.length,
          code: 'face-missing',
          detail: e.message,
        }
      throw e
    }
  }

  let msg = message
  if (msg === undefined) {
    if (face === 'head') {
      try {
        msg = readHeadMessage(root, rev)
      } catch (e) {
        msg = null
        baseOut.detail = `${rev} 的提交信息取不到：${e?.message ?? e}`
      }
    } else {
      msg = null
    }
  }

  // v2 签名的取数面：按签名自己钉住的 base 重放 staged 差异集，并取命中路径的内容号。
  // 只对 staged 面做——head 面的差异集是 `rev^..rev`（提交自己那一轮，天然稳定），
  // worktree 面不参与签名豁免的强制。
  const primaryJudged = judgeChanges({ changes, entries: parsed.entries, message: '', today })
  const blobPaths = new Set(primaryJudged.hits.map((h) => h.path))
  let hitsByBase = null
  if (typeof msg === 'string') {
    const bases = new Set(
      parseSigTrailer(msg)
        .sigs.map((s) => sigBaseOf(s))
        .filter(Boolean),
    )
    if (face === 'staged' && bases.size) {
      hitsByBase = {}
      for (const b of bases) {
        const alt = stagedHitsAt(root, parsed.entries, b, today)
        if (alt) {
          hitsByBase[b] = alt
          for (const h of alt) blobPaths.add(h.path)
        }
      }
    }
  }
  const blobs = blobMapFor(root, face, rev, [...blobPaths])

  const ackSha = ackShaOf(root, face, rev)
  // a1 只对 origin/main 已入库枚保留：那些枚改不动历史、也不会再进推送区间；
  // 本地枚（区间里待推的那些）必须用 a2 独立追认，否则"作者拿提交钥自签一行"照样洗白。
  // `onOriginMainPre` = 批档一次 `rev-list origin/main` 的成员判定；`undefined` ⇒ 逐枚问（原路径）。
  const onOriginMain =
    onOriginMainPre === undefined ? isOnOriginMain(root, ackSha) : Boolean(onOriginMainPre)
  const legacyA1 = Boolean(ackSha && onOriginMain)
  const out = decide({
    listProblems: parsed.problems,
    entries: parsed.entries,
    changes,
    message: msg,
    today,
    key: keyResFinal.key,
    signatureRequiredFrom: policyParsed.signatureRequiredFrom,
    // 追认台账只在 face='head' 且能解析出 40 位 sha 时才问得到；--staged/--worktree 两档结构上
    // 还没有"被追认的那一枚"，传空数组即保持原语义(不是放宽，是无输入)。
    ackRows,
    sha: ackSha,
    ackKey: ackKeyResFinal.key,
    legacyA1,
    hitsByBase,
    blobs,
  })
  const result = {
    ...baseOut,
    ...out,
    face,
    rev,
    entryCount: parsed.entries.length,
    changeCount: changes.length,
    detail: baseOut.detail,
  }
  if (record && out.code === 'declared') {
    result.recorded = recordExemption(root, result)
  }
  // 有签名行却验不过 ⇒ 回查签发台账,把"当时签给了哪个标题/哪批路径/哪份内容"摊开，
  // 并**分角**点名到底是①标题、②路径集、③blob，各自成因不同（标题那支是上游消息污染）。
  // 只加线索,不改判定(判红仍判红),取不到就不印——绝不拿猜测冒充成因。
  if (
    out.code === 'undeclared-unsigned' &&
    out.signature?.code === 'sig-invalid' &&
    typeof msg === 'string'
  ) {
    const issued = findSigIssue(root, parseSigTrailer(msg).sigs)
    if (issued) {
      result.sigIssuedFor = {
        subject: issued.subject,
        paths: issued.paths,
        at: issued.at,
        base: issued.base ?? null,
      }
      result.sigMismatch = decomposeSigMismatch(issued, {
        subject: subjectOf(msg),
        paths: out.hits.map((h) => h.path),
        blobs,
      })
    }
  }
  // 「无签名豁免」台账**无条件**写（不依赖 --record）：迁移窗口内的旧语义通过必须留下可审计的痕迹，
  // 否则它和现状一样是完全静默的。写失败只回传原因，不改判定（漏记一条 ≠ 改动没发生，但必须可见）。
  if (out.code === 'declared-unsigned') {
    result.unsignedRecorded = recordUnsignedExemption(root, result)
  }
  return result
}

/** 豁免留痕：只记"哪一面、哪些命中、理由原文、时刻"，不存整条提交信息（可能含无关内容）。 */
export function recordExemption(root, result) {
  try {
    const rel = RECORD_REL
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    appendFileSync(
      abs,
      `${JSON.stringify({
        at: new Date().toISOString(),
        face: result.face,
        hits: result.hits.map((h) => ({ path: h.path, kind: h.entry.kind, status: h.status })),
        reasons: result.exempt.reasons.map((r) => r.reason),
      })}\n`,
      'utf8',
    )
    return rel
  } catch {
    return null
  }
}

/**
 * 「无签名豁免」绕过台账：迁移窗口内"仅文字理由"的每一次放行都必须留痕（现状是完全静默）。
 * 不存提交信息正文、不存密钥；只记"哪一面/哪枚提交/命中哪些面/理由/签名状态/窗口到期日"。
 */
export function recordUnsignedExemption(root, result) {
  try {
    const abs = path.join(root, UNSIGNED_LEDGER_REL)
    mkdirSync(path.dirname(abs), { recursive: true })
    appendFileSync(
      abs,
      `${JSON.stringify({
        at: new Date().toISOString(),
        kind: 'unsigned-exempt',
        face: result.face,
        rev: result.rev,
        code: result.code,
        windowUntil: result.signatureRequiredFrom,
        signatureCode: result.signature?.code ?? '',
        keySource: result.keySource ?? '',
        hits: (result.hits ?? []).map((h) => ({
          path: h.path,
          kind: h.entry.kind,
          status: h.status,
        })),
        reasons: (result.exempt?.reasons ?? []).map((r) => r.reason),
      })}\n`,
      'utf8',
    )
    return UNSIGNED_LEDGER_REL
  } catch {
    return null
  }
}

/** 人读输出。判红时逐条点名"哪一面 / 为什么受保护 / 怎么合法改"（票面要求）。 */
export function formatReport(out) {
  const lines = []
  const head = `[immutable-guard face=${out.face}]`
  if (out.exit === 0) {
    lines.push(`✅ ${head} ${CODE_LABEL[out.code]}（受保护面 ${out.entryCount} 条）`)
    if (out.code === 'declared') {
      for (const r of out.exempt.reasons) lines.push(`   声明：${EXEMPT_TRAILER} ${r.reason}`)
      for (const h of out.hits)
        lines.push(`   - 已声明改动：${h.path}（${h.entry.kind} / ${h.status}）`)
    }
    if (out.code === 'declared-unsigned') {
      lines.push(`   ⚠️ 无签名豁免（迁移窗口内，签名要求自 ${out.signatureRequiredFrom} 起生效）：`)
      for (const r of out.exempt.reasons) lines.push(`      理由：${r.reason}`)
      for (const h of out.hits) lines.push(`      - ${h.path}（${h.entry.kind} / ${h.status}）`)
      lines.push(`      签名状态：${out.signature.code}；密钥来源：${out.keySource || '(无)'}`)
      if (out.keyWhy) lines.push(`      密钥：${out.keyWhy}`)
      lines.push(`      已记台账：${out.unsignedRecorded || UNSIGNED_LEDGER_REL}`)
      lines.push(
        `      补签：${SIG_TRAILER} ${SIG_VERSION_CURRENT}:<base40>:<hex>（签发命令见 --help 的 --sign-staged）`,
      )
    }
  } else if (out.exit === 1) {
    lines.push(`❌ ${head} ${CODE_LABEL[out.code]}`)
    if (out.code === 'undeclared') {
      for (const h of out.hits) {
        lines.push(`   - ${h.path}（${h.entry.kind} / ${h.status}）`)
        lines.push(`     为什么受保护：${h.entry.why}`)
      }
      for (const p of out.exempt.problems) lines.push(`   ⚠️ ${p.message}`)
      lines.push(
        `   怎么合法改：在本次提交信息里写一行 \`${EXEMPT_TRAILER} <≥${MIN_REASON_CHARS} 字理由>\`（逐行生效、只对本次提交有效）；受保护面不得静默删除。`,
      )
    }
    if (out.code === 'undeclared-unsigned') {
      for (const h of out.hits) {
        lines.push(`   - ${h.path}（${h.entry.kind} / ${h.status}）`)
        lines.push(`     为什么受保护：${h.entry.why}`)
      }
      for (const p of out.signature.problems) lines.push(`   ⚠️ ${p.message}`)
      lines.push(
        `   签名状态：${out.signature.code}${out.keySource ? `；密钥来源：${out.keySource}` : ''}`,
      )
      if (out.keyWhy) lines.push(`   密钥：${out.keyWhy}`)
      if (out.sigIssuedFor)
        lines.push(
          `   签发对照：这条签名是为标题「${out.sigIssuedFor.subject}」/ ${out.sigIssuedFor.paths.length} 枚路径（${out.sigIssuedFor.paths.join(',')}）签的（${out.sigIssuedFor.at}）` +
            `${out.sigIssuedFor.base ? `，base ${String(out.sigIssuedFor.base).slice(0, 12)}` : ''} ⇒ 与实际标题/路径集不一致；载荷绑标题，改过标题或换过暂存集都会毁签。`,
        )
      if (out.sigMismatch) {
        const m = out.sigMismatch
        lines.push(
          `   逐格判别：标题${m.subject ? '不一致' : '一致'} / 路径集${m.paths ? '不一致' : '一致'} / 内容 ${m.blobs ? '不一致' : '一致'} ⇒ 成因 ${m.cause}`,
        )
        if (m.cause === 'subject-polluted')
          lines.push(
            '     · 标题那一格不一致而路径集与内容一致 ⇒ **上游消息污染（②）**：多会话共用 `.git/COMMIT_EDITMSG`，标题取自别席。' +
              '这只推翻"标题绑定"，不推翻签名语义——本判据**不放宽**标题；治本在提交侧（私有消息文件 + 提交后回读自证），修好后本条判据仍照旧生效。' +
              '可执行自查：把你写到消息文件的标题与 `git log -1 --format=%s <sha>` 直接对照。',
          )
        else if (m.cause === 'path-set-drift')
          lines.push(
            `     · 标题一致、签名路径集是实际命中面的**子集**（本次多出：${m.extra.join('、') || '无'}）⇒ **① 取数面在签发后变宽**（HEAD 前移 / 同一索引在签发后被别席加条目）。` +
              'v2 已按签名钉住的 base 重放差异集，若这型仍出现，说明签发时用的不是私有索引；不是内容篡改，也不是判据过宽。',
          )
        else if (m.cause === 'signed-set-superset')
          lines.push(
            `     · 标题一致、签名路径集**比实际命中面宽**（签名有、本次没有：${m.missing.join('、') || '无'}）⇒ 签发时读到的索引比提交用的索引宽（常见：签了共享索引、提交用了更窄的私有索引）。` +
              '重签一次即可，判据不放宽。',
          )
        else if (m.cause === 'message-from-other-commit')
          lines.push(
            `     · 签名路径集与实际命中面**互不包含**（签名有、本次没有：${m.missing.join('、') || '无'}；本次有、签名没有：${m.extra.join('、') || '无'}）⇒ **整条消息（含签名行）串号（②）**：这条签名是给另一条提交签的，不是本席路径集被篡改。` +
              '注意此时"标题"一格会显示一致——串号把标题也一起换掉了，只比标题发现不了，必须比路径集的包含方向。' +
              '治本在提交侧（私有消息文件 + 提交后回读自证）；本判据不因此放宽。',
          )
        else if (m.cause === 'blob-drift')
          lines.push(
            '     · 路径集不变而内容号变了 ⇒ 同一路径被换内容（可能是 pre-commit 格式化改写了文件）：以最终提交的字节重新 --sign-staged，不要跳过签名。',
          )
        else if (m.cause === 'path-and-blob-drift')
          lines.push(
            '     · 路径集与内容号都不一致 ⇒ 索引内容整体被替换；按实际暂存集与内容重新签发。',
          )
        else if (m.cause === 'subject-and-paths')
          lines.push(
            '     · 标题与路径集同时不一致 ⇒ 消息与索引都被换过；先确认提交用的索引与消息都属于本席，再重签。',
          )
      }
      // 两句"为什么"分档给:上一句把 sig-invalid 也说成"窗口到期"是**会指错方向**的成因
      // (作者会去补理由,而真因只是签早了/签错了范围)。
      lines.push(
        out.signature.code === 'sig-invalid' || out.signature.code === 'key-unavailable'
          ? `   为什么判红：消息里带了 \`${SIG_TRAILER}\` 行但**验不过**（标题/路径集/理由与签发那一刻不一致，或密钥不是那一把）——不是"没签名"，也不是窗口到期。`
          : `   为什么判红：迁移窗口已于 ${out.signatureRequiredFrom ?? '(未设置)'} 到期 —— 仅文字理由不再放行，必须补 ${SIG_TRAILER} ${SIG_VERSION_CURRENT}:<base40>:<hex> 签名。`,
      )
      lines.push(
        `   怎么合法改：先 \`node scripts/check-immutable-guard.mjs --sign-staged --subject "<提交标题>" --reason "<与 immutable-exempt 同一句理由>" [--paths <a,b,c>]\` 生成签名行，再提交；密钥须由 CI/机主注入（${KEY_ENV} 或 git config ${KEY_CONFIG}）。`,
      )
    }
    if (out.code === 'expired') {
      for (const e of out.expired) {
        lines.push(
          `   - ${e.path}（${e.kind}）reviewBy=${e.reviewBy} 已到期：请复核后更新 ${GUARD_DATA_REL}`,
        )
      }
      lines.push('   为什么判红：§0.7 —— 登记必须"验过才免"且会到期，到期不清算 = 清单腐烂。')
    }
  } else {
    lines.push(`❌ 未判定 ${head} ${CODE_LABEL[out.code]}`)
    for (const p of out.listProblems ?? []) lines.push(`   - ${p.message}`)
    if (out.code === 'message-missing') {
      lines.push('   为什么判不了：改动清单能算出来，但提交信息还没有生成 ⇒ 无法判断"有没有声明"。')
      lines.push(
        '   接线位：commit-msg 钩子（以 --message-file "$1" 传入）；pre-commit 阶段结构上还没有消息，勿挂本门。',
      )
      for (const h of out.hits) lines.push(`   - 触及：${h.path}（${h.entry.kind}）`)
    }
    if (out.detail) lines.push(`   - ${out.detail}`)
  }
  lines.push(
    `[判定面=${out.face}] code=${out.code} 受保护面 ${out.entryCount} 条 / 改动 ${out.changeCount} 条 / 命中 ${out.hits.length} 条 / 到期 ${out.expired.length} 条 / 未判定 ${out.exit === 2 ? 1 : 0} / 签名要求自 ${out.signatureRequiredFrom ?? '(未设置⇒立即)'}`,
  )
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 增量巡检档（--audit-new）：巡检轮的唯一入口，判"游标之后每一枚提交恰好一次"
// ---------------------------------------------------------------------------

/** 游标读不到 / 形状坏 ⇒ 返回 null（调用方按首轮建点，绝不"当成没新提交"记绿）。 */
export function readCursorText(root) {
  try {
    const doc = JSON.parse(readFileSync(path.join(root, CURSOR_REL), 'utf8'))
    return typeof doc?.cursor === 'string' && /^[a-f0-9]{40}$/.test(doc.cursor.trim())
      ? doc.cursor.trim()
      : null
  } catch {
    return null
  }
}

/** 未判完区间内已判过的提交集合（游标不推进时的"差集"底账；判完即随游标推进清空）。 */
export function readJudgedShas(root) {
  try {
    const doc = JSON.parse(readFileSync(path.join(root, CURSOR_REL), 'utf8'))
    const rows = Array.isArray(doc?.judged) ? doc.judged : []
    return rows.filter((s) => typeof s === 'string' && /^[a-f0-9]{40}$/.test(s))
  } catch {
    return []
  }
}

/** 游标写失败不影响本轮判定结论（下轮重判同一批 = 重复判，不 = 漏判），但必须回传原因。 */
export function writeCursor(root, sha, extra = {}) {
  try {
    const abs = path.join(root, CURSOR_REL)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(
      abs,
      JSON.stringify({ cursor: sha, at: new Date().toISOString(), ...extra }, null, 2),
      'utf8',
    )
    return ''
  } catch (e) {
    return `游标写入失败：${e?.message ?? e}`
  }
}

/** 游标必须是 HEAD 的祖先，否则（改写史/强推）`since..HEAD` 会漏掉整段真实历史。 */
export function isAncestor(root, sha, head) {
  try {
    gitRaw(['merge-base', '--is-ancestor', sha, head], root)
    return true
  } catch {
    return false
  }
}

const AUDIT_BASE = {
  exit: 2,
  state: 'undetermined',
  audited: 0,
  judged: 0,
  skippedMerges: 0,
  declared: 0,
  retro: [],
  pending: 0,
  breaches: [],
  undetermined: [],
  unsigned: [],
  cursorBefore: '',
  cursorAfter: '',
  head: '',
  detached: false,
  detail: '',
}

/**
 * 判一批提交并归桶（`--audit-new` 与 `--range` 共用同一份，判据不分叉）。
 * 归桶顺序：exit 1 ⇒ breach；exit 2 ⇒ undetermined；exit 0 ⇒ declared（签名验过）
 * 或 unsigned（迁移窗口内仅文字理由）。合并提交跳过并计数（理由见调用处注释）。
 */
function judgeBatch(root, batch, { today = todayStr(), record = false, policyRev = null } = {}) {
  const breaches = []
  const undetermined = []
  const unsigned = []
  const retro = []
  let declared = 0
  let skippedMerges = 0
  let judged = 0
  // 追认台账整批读一次(同一末端),逐枚只查自己的 sha;坏行带出去点名,不静默。
  const ack = readAckRows(root)
  // 整批一次读齐父辈/标题/正文 + 一次解析两把密钥(2026-11-05;读不到就逐枚回落原路径,判定不变)
  const metas = batchCommitMeta(root, batch)
  const sharedKeyRes = resolveSigningKey(root)
  const sharedAckKeyRes = resolveAckKey(root)
  // 三张批表(2026-11-05 RP-92):清单正文 / 差异集 / origin/main 成员集。
  // 每一张都是"取不到 ⇒ 该枚逐枚回落原路径",不是"取不到 ⇒ 当成空"。
  const policySpec = policyRev ? `${policyRev}:${GUARD_DATA_REL}` : null
  const listBatch = batchFaceTexts(
    root,
    policySpec
      ? [...new Set([...batch.map((sha) => `${sha}:${GUARD_DATA_REL}`), policySpec])]
      : batch.map((sha) => `${sha}:${GUARD_DATA_REL}`),
  )
  const changesBatch = batchFaceChanges(root, batch)
  const originSet = originMainMembership(root)
  for (const sha of batch) {
    const meta = metas.get(sha) ?? null
    const parents = meta ? meta.parentCount : parentCount(root, sha)
    if (parents > 1) {
      skippedMerges += 1
      continue
    }
    judged += 1
    // 根提交(0 父)不吃批表:`git log` 无父可差不吐差异,而逐枚档的 `rev^` 会失败 ⇒ `face-missing`。
    // 宁可这一枚多派生一次,也不把"判不了"悄悄读成"没改判据面"(§0.3)。
    const useBatchChanges = parents > 0 && changesBatch.has(sha)
    const listTextPre = listBatch === null ? undefined : listBatch.get(`${sha}:${GUARD_DATA_REL}`)
    const policyTextPre = listBatch === null || !policySpec ? undefined : listBatch.get(policySpec)
    let one
    try {
      one = runAudit(root, 'head', {
        today,
        record,
        rev: sha,
        policyRev,
        ackRows: ack.rows,
        message: meta ? meta.message : undefined,
        keyRes: sharedKeyRes,
        ackKeyRes: sharedAckKeyRes,
        listTextPre,
        policyTextPre,
        changesPre: useBatchChanges ? changesBatch.get(sha) : undefined,
        onOriginMainPre: originSet ? originSet.has(sha) : undefined,
      })
    } catch (e) {
      one = {
        exit: 2,
        code: 'threw',
        detail: String(e?.message ?? e),
        hits: [],
        entryCount: 0,
        expired: [],
      }
    }
    const brief = {
      sha,
      code: one.code,
      subject: meta ? meta.subject : safeSubject(root, sha),
      hits: (one.hits ?? []).map((h) => ({
        path: h.path,
        kind: h.entry?.kind ?? '',
        status: h.status ?? '',
      })),
      reasons: (one.exempt?.reasons ?? []).map((r) => r.reason),
      problems: (one.exempt?.problems ?? []).map((p) => p.message),
      signatureCode: one.signature?.code ?? '',
      sigIssuedFor: one.sigIssuedFor ?? null,
      keySource: one.keySource ?? '',
      windowUntil: one.signatureRequiredFrom ?? null,
      expired: (one.expired ?? []).map((x) => `${x.path}@${x.reviewBy}`),
      detail: one.detail ?? '',
      // 追认读数与 trailer 不同形:它必须带着"谁补的、到几时"一起出去,否则会被读成"当时就声明了"。
      ackedBy:
        one.ack?.state === 'valid' ? `${one.ack.row.ackedBy}(到期 ${one.ack.row.expires})` : '',
      substitutedFor: one.ack?.substitutedFor ?? '',
      ackProblem: one.ack?.state === 'invalid' ? `${one.ack.code}:${one.ack.why}` : '',
    }
    if (one.exit === 1) breaches.push(brief)
    else if (one.exit === 2) undetermined.push(brief)
    else if (one.code === 'declared') declared += 1
    else if (one.code === 'retro-declared') retro.push(brief)
    else if (one.code === 'declared-unsigned') unsigned.push(brief)
  }
  return {
    breaches,
    undetermined,
    unsigned,
    retro,
    declared,
    skippedMerges,
    judged,
    ackProblems: ack.problems,
    ackAbsent: ack.absent,
  }
}

/**
 * 判游标之后的新提交（最老→最新，单轮 ≤limit，超出留下轮）。三态各自封闭：
 *   bootstrapped    首轮建点，**历史未判**（不冒充"零违规"，§0.3；也不拿存量点红，§0.2）；
 *   no-new-head     游标 == HEAD，本轮零判据（不是"判过且干净"）；
 *   cursor-detached 游标不在 HEAD 祖先链 ⇒ 只判最近 limit 枚并点名；
 *   clean           判过的每一枚都未触及 / 已声明；
 *   breach          至少一枚静默改了判据面（未声明 / 声明过短 / 清单到期）；
 *   undetermined    至少一枚判不了（HEAD 取不到 / 无父提交 / 清单坏 / 触及却无消息）。
 * 退出码 0 / 1 / 2 = 上述后三档；breach 与 undetermined 同时有 ⇒ 先报 breach（红优先于没判）。
 */
export function auditNewCommits(
  root,
  { limit = AUDIT_BATCH_DEFAULT, today = todayStr(), record = false } = {},
) {
  let head
  try {
    head = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
  } catch (e) {
    return { ...AUDIT_BASE, detail: `HEAD 取不到：${e?.message ?? e}` }
  }
  if (!/^[a-f0-9]{40}$/.test(head))
    return { ...AUDIT_BASE, detail: `HEAD 不是 40 位 sha：${head.slice(0, 20)}` }

  const cursor = readCursorText(root)
  if (cursor === null) {
    const why = writeCursor(root, head, { bootstrappedAt: new Date().toISOString() })
    return {
      ...AUDIT_BASE,
      exit: 0,
      state: 'bootstrapped',
      head,
      cursorAfter: head,
      detail: `游标缺失或形状坏 ⇒ 本轮只把起点建在 ${head}，**历史提交一律未判**（存量按 §0.2 不点红、也不冒充零违规）${why ? `；${why}` : ''}`,
    }
  }
  if (cursor === head) {
    return {
      ...AUDIT_BASE,
      exit: 0,
      state: 'no-new-head',
      head,
      cursorBefore: cursor,
      cursorAfter: cursor,
      detail: 'HEAD 与游标同枚 ⇒ 本轮没有新输入（不等于"判过且干净"）',
    }
  }

  const detached = !isAncestor(root, cursor, head)
  let batch
  let pending = 0
  let cursorNext = null
  let judgedNext = null
  if (detached) {
    batch = String(gitRaw(['rev-list', head], root))
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, limit)
      .reverse()
  } else {
    const all = String(gitRaw(['rev-list', '--reverse', `${cursor}..${head}`], root))
      .split(/\r?\n/)
      .filter(Boolean)
    const allSet = new Set(all)
    // 差集底账只保留仍在本区间内的 sha：区间外的历史 judged 不再需要（游标推进时已清空）。
    const judged = new Set(readJudgedShas(root).filter((s) => allSet.has(s)))
    const pendingAll = all.filter((sha) => !judged.has(sha))
    batch = pendingAll.slice(0, limit)
    pending = Math.max(0, pendingAll.length - batch.length)
    if (pending > 0) {
      // 区间未判完 ⇒ 游标原地不动，把本批已判 sha 并进 judged；下一轮只判差集（保证收敛）。
      cursorNext = cursor
      judgedNext = [...judged, ...batch]
    } else {
      // 区间已全判完 ⇒ 游标推进到本轮 HEAD；judged 底账随游标推进清空。
      cursorNext = head
    }
  }
  if (batch.length === 0) {
    // 游标是 HEAD 的后代（别人刚把 HEAD 往回挪）或区间真空 ⇒ 判不了就点名，不推进游标。
    return {
      ...AUDIT_BASE,
      state: 'undetermined',
      head,
      cursorBefore: cursor,
      cursorAfter: cursor,
      detail: `游标之后枚举到 0 枚提交（cursor=${cursor.slice(0, 12)}）⇒ 未判定，不记绿`,
    }
  }

  const { breaches, undetermined, unsigned, retro, declared, skippedMerges, judged, ackProblems } =
    judgeBatch(root, batch, { today, record })

  const lastAudited = batch[batch.length - 1]
  // 判完 ⇒ 推进到本轮 HEAD；没判完 ⇒ 游标**原地不动**、本批已判 sha 进 `judged` 底账。
  // 旧实现推进到"本批末位"在含并行分支的区间里不收敛（末位不是游标后代 ⇒ 下一轮又被枚举回来）。
  const writeTo = detached ? lastAudited : cursorNext
  const writeExtra = detached
    ? { audited: batch.length, pending, detached }
    : { audited: batch.length, pending, detached, judged: pending > 0 ? judgedNext : [] }
  const cursorWriteWhy = writeCursor(root, writeTo, writeExtra)
  const state = breaches.length > 0 ? 'breach' : undetermined.length > 0 ? 'undetermined' : 'clean'
  const notes = []
  if (detached)
    notes.push('游标不在 HEAD 祖先链（改写史/强推）⇒ 本轮按最近提交判，游标推进到本批末位')
  if (pending > 0)
    notes.push(
      `区间长于本轮额度（limit=${limit}）⇒ 剩余 ${pending} 枚留下轮；游标保持 ${cursor.slice(0, 12)} 不推进，本批 ${batch.length} 枚 sha 记入 judged 集合（下轮只判差集，保证收敛）`,
    )
  if (cursorWriteWhy) notes.push(cursorWriteWhy)
  if (ackProblems.length)
    notes.push(
      `追认台账坏行 ${ackProblems.length} 条(逐条点名:${ackProblems.map((p) => `L${p.line ?? '?'} ${p.why}`).join(' | ')})⇒ 这些行一律不生效`,
    )
  return {
    exit: breaches.length > 0 ? 1 : undetermined.length > 0 ? 2 : 0,
    state,
    head,
    audited: batch.length,
    judged,
    skippedMerges,
    declared,
    retro,
    unsigned,
    pending,
    breaches,
    undetermined,
    cursorBefore: cursor,
    cursorAfter: writeTo,
    detached,
    detail: notes.join('；'),
  }
}

/**
 * 显式区间档（`--range a..b`，2026-11-04 立）。push 门用它判"本次要推的每一枚"：
 * 与 `--audit-new` 共用同一份 `judgeBatch`（判据不分叉），区别只有两点 ——
 *   ① 输入是**调用方点名的区间**，不是游标（游标可能已被巡检推到这些提交之前，
 *      那会让 push 门看到 `no-new-head` 而瞎绿）；
 *   ② 不写游标、不计 pending（区间由 rev-list 一次算全，判不完就不是 push 门该管的形态）。
 * 区间解析失败（`origin/main` 未 fetch / 拼错）⇒ exit 2 **未判定**，不判红也不记绿。
 * 区间为空 ⇒ exit 0 / `empty-range`（真的零输入，明确不冒充"判过且干净"）。
 */
export function auditRange(
  root,
  { range = 'origin/main..HEAD', today = todayStr(), record = false } = {},
) {
  const base = { ...AUDIT_BASE, range }
  let shas
  try {
    shas = String(gitRaw(['rev-list', '--reverse', range], root))
      .split(/\r?\n/)
      .filter(Boolean)
  } catch (e) {
    return {
      ...base,
      state: 'undetermined',
      range,
      detail: `区间 ${range} 解析失败（origin/main 未 fetch 或区间拼错）：${e?.message ?? e} ⇒ 未判定，不记绿`,
    }
  }
  if (shas.length === 0) {
    return {
      ...base,
      exit: 0,
      state: 'empty-range',
      range,
      detail: `区间 ${range} 为空 ⇒ 本轮零输入（不等于"判过且干净"）`,
    }
  }
  // 策略基点：区间左端（三点区间取 merge-base）。签名要求日取**基点**的清单 ——
  // 被审者在自己提交里删掉/推后开关也给自己放不了行；命中面仍取被审提交自己的清单。
  let baseRev
  try {
    baseRev = rangeBaseRev(root, range)
  } catch (e) {
    return {
      ...base,
      state: 'undetermined',
      range,
      detail: `区间 ${range} 的基点解析失败：${e?.message ?? e} ⇒ 未判定，不记绿`,
    }
  }
  const { breaches, undetermined, unsigned, retro, declared, skippedMerges, judged, ackProblems } =
    judgeBatch(root, shas, {
      today,
      record,
      policyRev: baseRev,
    })
  return {
    ...base,
    exit: breaches.length > 0 ? 1 : undetermined.length > 0 ? 2 : 0,
    state: breaches.length > 0 ? 'breach' : undetermined.length > 0 ? 'undetermined' : 'clean',
    range,
    head: shas[shas.length - 1],
    audited: shas.length,
    judged,
    skippedMerges,
    declared,
    retro,
    unsigned,
    pending: 0,
    breaches,
    undetermined,
    cursorBefore: '',
    cursorAfter: '',
    detail: ackProblems.length ? `追认台账坏行 ${ackProblems.length} 条 ⇒ 这些行一律不生效` : '',
  }
}

/** 区间基点：`a..b` ⇒ a；`a...b` ⇒ merge-base(a,b)。解析失败抛错（调用方折 exit 2）。 */
function rangeBaseRev(root, range) {
  const three = String(range).includes('...')
  const [left, right] = String(range).split(three ? '...' : '..')
  if (!left || !right) throw new Error(`区间必须形如 a..b 或 a...b，收到：${range}`)
  const args = three ? ['merge-base', left, right] : ['rev-parse', '--verify', `${left}^{commit}`]
  const out = String(gitRaw(args, root)).trim()
  if (!out) throw new Error(`无法解析区间左端：${left}`)
  return out
}

/** 父数（>1 = 合并提交）。取不到按 1 处理 ⇒ 宁可多判一枚，不放过一枚。 */
/**
 * 一批提交的父辈/标题/正文**一次读齐**(2026-11-05 立,只为削派生,不改判序)。
 *
 * 立因(当次实测):`--range HEAD~30..HEAD` 花 86.6 秒 ≈ 2.9 秒/枚。推送门要判的是
 * `origin/main..HEAD`(当次现读 147 枚)⇒ 约 425 秒,必然被 300 秒看门狗砍掉 ——
 * 也就是"专抓未声明改判据面"的那道审计**在推送时静默不发生**(§0.9:没跑=没有;§0.3:被砍掉不等于判过)。
 * 每枚提交原本要 3 次独立派生只为拿"父辈数 / 标题 / 正文",而这四样 git 一次就能全给。
 *
 * 失效方向(不许变成"少判一次"):
 *  · 整批读不到 ⇒ 返回空 Map ⇒ 调用处逐枚回落原来的逐次派生(变慢,但绝不判错);
 *  · 某枚在批输出里对不上号/字段数不对 ⇒ 该枚不进气表,同样逐枚回落;
 *  · 正文里出现分隔符导致拆段数量不对 ⇒ 按"对不上"处理,不猜。
 */
const META_RECORD_SEP = '\x1e'
const META_FIELD_SEP = '\x1f'
function batchCommitMeta(root, shas) {
  const out = new Map()
  if (!Array.isArray(shas) || shas.length === 0) return out
  try {
    const raw = String(
      gitRaw(
        [
          'log',
          '--no-walk=unsorted',
          `--format=%H${META_FIELD_SEP}%P${META_FIELD_SEP}%s${META_FIELD_SEP}%B${META_RECORD_SEP}`,
          ...shas,
        ],
        root,
      ),
    )
    for (const rec of raw.split(META_RECORD_SEP)) {
      const body = rec.replace(/^\n/, '')
      if (!body.trim()) continue
      const parts = body.split(META_FIELD_SEP)
      if (parts.length !== 4) continue
      const [sha, parents, subject, message] = parts
      if (!/^[0-9a-f]{40}$/.test(sha.trim())) continue
      out.set(sha.trim(), {
        parentCount: parents.trim() === '' ? 0 : parents.trim().split(/\s+/).length,
        subject: subject.trim(),
        // git 每条记录本来自带的收尾换行,被这里的记录分隔符 %x1e 顶掉了;
        // 逐枚读法(`git log -1 --format=%B`)会带那个换行。补回来才叫**逐字等值**,
        // 否则本枚的等价锁 ST49b 会差一个换行 —— 差别看着无害,但判据面不许"差不多"。
        message: message + '\n',
      })
    }
  } catch {
    /* 一次读不到就整批回落逐枚 —— 报数与判定都不许因此变化 */
  }
  return out
}

function parentCount(root, sha) {
  try {
    return String(gitRaw(['show', '-s', '--format=%P', sha], root))
      .trim()
      .split(/\s+/)
      .filter(Boolean).length
  } catch {
    return 1
  }
}

/** `git log --format=%s` 在根提交上会失败 ⇒ 标题取不到只写空串，不影响判定。 */
function safeSubject(root, sha) {
  try {
    return String(gitRaw(['log', '-1', '--format=%s', sha], root)).trim()
  } catch {
    return ''
  }
}

/** 人读输出：判红逐枚点名"哪一面 / 为什么受保护 / 怎么合法改"，与单枚档同一口径。 */
export function formatAuditReport(out) {
  const lines = []
  const head = `[immutable-guard:audit] state=${out.state}`
  const unsigned = Array.isArray(out.unsigned) ? out.unsigned : []
  if (out.exit === 0 && unsigned.length > 0) {
    lines.push(
      `⚠️ ${head} 无签名豁免 ${unsigned.length} 枚（迁移窗口内，已记台账 ${UNSIGNED_LEDGER_REL}）`,
    )
  } else if (
    out.exit === 0 &&
    (out.state === 'clean' || out.state === 'no-new-head' || out.state === 'empty-range')
  )
    lines.push(`✅ ${head}`)
  else if (out.exit === 0 && out.state === 'bootstrapped') lines.push(`ℹ️ ${head}`)
  else if (out.exit === 1)
    lines.push(`❌ ${head} 判据面被静默改动（未声明 / 声明过短 / 签名缺失或验不过 / 清单到期）`)
  else lines.push(`❌ 未判定 ${head}`)
  if (out.range) lines.push(`   区间：${out.range}`)
  for (const b of out.breaches) {
    lines.push(`   - ${b.sha}「${b.subject}」code=${b.code}`)
    for (const h of b.hits) lines.push(`     · ${h.path}（${h.kind} / ${h.status}）`)
    for (const x of b.expired) lines.push(`     · 清单到期：${x}`)
    for (const p of b.problems) lines.push(`     ⚠️ ${p}`)
    if (b.signatureCode)
      lines.push(
        `     · 签名状态：${b.signatureCode}${b.keySource ? `（密钥来源 ${b.keySource}）` : ''}`,
      )
    if (b.sigIssuedFor)
      lines.push(
        `     · 签发对照：那条签名是为标题「${b.sigIssuedFor.subject}」/ ${b.sigIssuedFor.paths.length} 枚路径（${b.sigIssuedFor.paths.join(',')}）签的，` +
          `与本页实际（标题「${b.subject}」）不一致 ⇒ **出路是重签一次，不是补理由、更不是跳门**`,
      )
    if (b.sigMismatch) {
      const m = b.sigMismatch
      lines.push(
        `     · 逐格判别：标题${m.subject ? '不一致' : '一致'} / 路径集${m.paths ? '不一致' : '一致'} / 内容 ${m.blobs ? '不一致' : '一致'} ⇒ 成因 ${m.cause}`,
      )
      if (m.cause === 'subject-polluted')
        lines.push(
          '       - 标题那格单独不一致 ⇒ 上游消息污染（`.git/COMMIT_EDITMSG` 被并发覆盖），不是本判据过宽；标题绑定不放宽，治本在提交侧。',
        )
    }
  }
  for (const u of unsigned) {
    lines.push(
      `   ⚠️ ${u.sha}「${u.subject}」无签名豁免（${u.signatureCode}；窗口至 ${u.windowUntil}）`,
    )
    for (const h of u.hits) lines.push(`     · ${h.path}（${h.kind} / ${h.status}）`)
    for (const r of u.reasons) lines.push(`     · 理由：${r}`)
  }
  for (const u of out.undetermined)
    lines.push(`   · 未判定 ${u.sha}「${u.subject}」code=${u.code} —— ${u.detail}`)
  // 追认档必须逐枚点名"谁补的、到几时":它和 trailer 不同形,写成一粒计数就等于把事后补发
  // 洗成了"当时就合规"(§0.10 失效方向要多要一次说明,不是少说一次)。
  for (const u of out.retro ?? []) {
    lines.push(
      `   ℹ️ ${u.sha}「${u.subject}」追认通过（提交当时${u.substitutedFor || '未声明'}，由 ${u.ackedBy} 事后具名补 ⇒ 不得读成当时就合规）`,
    )
    for (const h of u.hits) lines.push(`     · ${h.path}（${h.kind} / ${h.status}）`)
    for (const r of u.reasons) lines.push(`     · 追认理由：${r}`)
  }
  if (out.declared) lines.push(`   已声明且验签通过（--record 已留痕）：${out.declared} 枚`)
  if ((out.retro ?? []).length)
    lines.push(`   事后追认通过（台账逐枚具名，到期即回到红）：${(out.retro ?? []).length} 枚`)
  if (out.detail) lines.push(`   注：${out.detail}`)
  lines.push(
    `[immutable-guard:audit] 判 ${out.audited} 枚(其中合并跳过 ${out.skippedMerges ?? 0} 枚) / 红 ${out.breaches.length} / 未判定 ${out.undetermined.length} / 无签名 ${unsigned.length} / 待判 ${out.pending} / 游标 ${String(out.cursorBefore || '').slice(0, 12) || '(无)'} → ${String(out.cursorAfter || '').slice(0, 12) || '(无)'}`,
  )
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 自检：真跑 git 夹具（§22c：行为只能靠构造面证明；临时仓落 mkScratch，§15b）
// ---------------------------------------------------------------------------

const SELFTEST_BASELINE = {
  'docs/x.md': '# baseline\n',
  'scripts/lib/face-reader.mjs': '// baseline\n',
  'scripts/guardian-runner.mjs': '// baseline\n',
  'AGENTS.md': '# baseline\n',
  'scripts/check-demo.mjs': '// baseline\n',
  'scripts/data/demo-exemptions.json': '{}\n',
}

function writeIn(root, rel, text) {
  const abs = path.join(root, rel)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

function commitAll(root, message) {
  gitRaw(['add', '-A'], root)
  gitRaw(['commit', '--no-verify', '-F', '-'], root, { input: message })
}

/** 建一枚 scratch 仓：基线提交里带真实清单 + 各形态的受保护面样本。 */
function seedRepo(guardJson) {
  const root = mkScratch('immguard-st-')
  gitRaw(['init', '-q', '-b', 'main'], root)
  gitRaw(['config', 'user.email', 'selftest@example.invalid'], root)
  gitRaw(['config', 'user.name', 'selftest'], root)
  gitRaw(['config', 'commit.gpgsign', 'false'], root)
  // 本仓实测过 core.hooksPath 指向不存在目录 ⇒ 静默跑 0 个钩子；夹具仓显式钉死"无钩子"。
  gitRaw(['config', 'core.hooksPath', '.git/no-hooks'], root)
  for (const [rel, text] of Object.entries(SELFTEST_BASELINE)) writeIn(root, rel, text)
  writeIn(root, GUARD_DATA_REL, guardJson)
  commitAll(root, 'baseline')
  return root
}

/** 自检夹具密钥（≥ MIN_KEY_CHARS；只在 scratch 仓里用，与机主真钥无关）。 */
const ST_KEY = 'immutable-guard-self-test-key-0123456789abcdef'
const ST_KEY_OTHER = 'immutable-guard-self-test-other-key-0123456789'
/** 独立追认夹具钥：与上面两把都不同（a2 追认只认这一把，等于"另一个主体"）。 */
const ST_ACK_KEY = 'immutable-guard-self-test-ack-key-0123456789abcdef'

/** 造一条"理由 + 正确签名"的提交信息（签名绑定标题/命中路径/理由，与验签侧同一 payload）。 */
function signedMessage(subject, reason, hits, key = ST_KEY) {
  return `${subject}\n\n${EXEMPT_TRAILER} ${reason}\n${SIG_TRAILER} ${signExemption({ subject, hits, reason, key })}`
}

/** 清单正文 → entries（自检里改写清单形状时用；不复制判据常量）。 */
function guardEntriesOf(text) {
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed : parsed.entries
}

/** 原地改写清单 entries 并写回同形正文（旧数组形态 / 新对象形态都不丢顶层开关）。 */
function mutateGuardDoc(root, mutate) {
  const doc = JSON.parse(realGuardJson())
  const entries = Array.isArray(doc) ? doc : doc.entries
  mutate(entries)
  writeIn(
    root,
    GUARD_DATA_REL,
    JSON.stringify(Array.isArray(doc) ? entries : { ...doc, entries }, null, 2),
  )
}

function realGuardJson() {
  return readFileSync(path.join(ROOT, GUARD_DATA_REL), 'utf8')
}

/** 自检输出行：与仓内 `st/ok` 惯例一致（失败即非 0）。 */
export function selfTest() {
  const cases = []
  const ok = (name, cond, detail = '') => {
    cases.push({ name, ok: Boolean(cond), detail })
  }
  const guardJson = realGuardJson()
  const auditWin = parseGuardList(guardJson).signatureRequiredFrom
  // 「窗口后」的今天：窗口日期 + 1 天（窗口未配置 = 立即要求签名 ⇒ 用当天即可）；不写死日期，开关改了测试跟着走。
  const dayAfterWindow = auditWin
    ? new Date(Date.parse(`${auditWin}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
    : todayStr()
  const run = (fn) => {
    const root = seedRepo(guardJson)
    try {
      return fn(root)
    } finally {
      rmScratch(root)
    }
  }
  const audit = (root, face = 'head', opts = {}) => {
    try {
      // 追认钥默认走"另一个主体"的夹具钥；用例要测缺钥/同钥时显式覆盖。
      return runAudit(root, face, { ackKey: ST_ACK_KEY, ...opts })
    } catch (e) {
      return { exit: 99, code: 'threw', detail: e?.message ?? String(e) }
    }
  }

  // ST1 未触及 ⇒ 绿
  run((root) => {
    writeIn(root, 'docs/y.md', '# y\n')
    commitAll(root, 'docs: add y')
    const out = audit(root)
    ok(
      'ST1 未触及受保护面 ⇒ exit 0 / pass',
      out.exit === 0 && out.code === 'pass',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST2 lib 前缀命中、无声明 ⇒ 红，且逐条点名 why
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: tweak reader')
    const out = audit(root)
    ok(
      'ST2 改 scripts/lib/ 无声明 ⇒ exit 1 / undeclared 且命中带 why',
      out.exit === 1 &&
        out.code === 'undeclared' &&
        out.hits.some((h) => h.path === 'scripts/lib/face-reader.mjs' && h.entry.why.length > 0),
      JSON.stringify({ exit: out.exit, code: out.code, hits: out.hits.map((h) => h.path) }),
    )
  })

  // ST3 同改动带有效 trailer + 正确签名 ⇒ 绿（签名豁免生效）
  run((root) => {
    const reason = '修复批量读取的内存上限，已复核全部调用方'
    const subject = 'refactor: tweak reader'
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, signedMessage(subject, reason, ['scripts/lib/face-reader.mjs']))
    const out = audit(root, 'head', { key: ST_KEY })
    ok(
      'ST3 同一改动带 immutable-exempt: + 正确签名 ⇒ exit 0 / declared',
      out.exit === 0 &&
        out.code === 'declared' &&
        out.exempt.reasons.length === 1 &&
        out.signature.code === 'sig-verified',
      JSON.stringify({ exit: out.exit, code: out.code, sig: out.signature.code }),
    )
  })

  // ST4 trailer 理由过短 ⇒ 仍红，且点名"理由只有 N 字"
  run((root) => {
    writeIn(root, 'AGENTS.md', '# changed\n')
    commitAll(root, 'docs: tweak\n\nimmutable-exempt: 改一下')
    const out = audit(root)
    ok(
      'ST4 理由不足 10 字 ⇒ exit 1 / undeclared 且问题点名',
      out.exit === 1 &&
        out.code === 'undeclared' &&
        out.exempt.problems.some((p) => p.code === 'reason-too-short'),
      JSON.stringify({ exit: out.exit, code: out.code, problems: out.exempt.problems }),
    )
  })

  // ST5 AGENTS.md 精确命中
  run((root) => {
    writeIn(root, 'AGENTS.md', '# changed\n')
    commitAll(root, 'docs: tweak agents')
    const out = audit(root)
    ok(
      'ST5 改 AGENTS.md ⇒ exit 1 / undeclared',
      out.exit === 1 && out.code === 'undeclared',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST6 注册表命中
  run((root) => {
    writeIn(root, 'scripts/guardian-runner.mjs', '// changed\n')
    commitAll(root, 'chore: tweak runner')
    const out = audit(root)
    ok(
      'ST6 改 scripts/guardian-runner.mjs ⇒ exit 1 / undeclared',
      out.exit === 1 && out.code === 'undeclared',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST7 豁免台账 glob 命中
  run((root) => {
    writeIn(root, 'scripts/data/demo-exemptions.json', '{"a":1}\n')
    commitAll(root, 'chore: widen exemption')
    const out = audit(root)
    ok(
      'ST7 改 scripts/data/*-exemptions.json ⇒ exit 1 / undeclared',
      out.exit === 1 && out.code === 'undeclared',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST8 门体 glob 命中（新建一枚 check-*.mjs 也是改判据面）
  run((root) => {
    writeIn(root, 'scripts/check-brand-new.mjs', '// new gate\n')
    commitAll(root, 'feat: add gate')
    const out = audit(root)
    ok(
      'ST8 新增 scripts/check-*.mjs ⇒ exit 1 / undeclared',
      out.exit === 1 && out.code === 'undeclared',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST9 删除受保护面 ⇒ 红
  run((root) => {
    gitRaw(['rm', '-q', 'scripts/check-demo.mjs'], root)
    commitAll(root, 'chore: drop gate')
    const out = audit(root)
    ok(
      'ST9 删除受保护面 ⇒ exit 1 / undeclared',
      out.exit === 1 && out.code === 'undeclared',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST10 把受保护面改名搬走 ⇒ 旧路径仍命中（R 两侧都判）
  run((root) => {
    gitRaw(['mv', 'scripts/lib/face-reader.mjs', 'docs/face-reader.mjs'], root)
    commitAll(root, 'refactor: move reader')
    const out = audit(root)
    ok(
      'ST10 改名搬走受保护面 ⇒ exit 1 且命中旧路径',
      out.exit === 1 &&
        out.code === 'undeclared' &&
        out.hits.some((h) => h.path === 'scripts/lib/face-reader.mjs'),
      JSON.stringify({ exit: out.exit, code: out.code, hits: out.hits.map((h) => h.path) }),
    )
  })

  // ST11 默认档取不到父提交 ⇒ 未判定（不是绿也不是红）
  run((root) => {
    writeIn(root, 'docs/z.md', '# z\n')
    gitRaw(['add', '-A'], root)
    // 只留 baseline 一枚提交：HEAD^ 不存在
    const out = audit(root)
    ok(
      'ST11 HEAD 无父提交 ⇒ exit 2 / face-missing',
      out.exit === 2 && out.code === 'face-missing',
      JSON.stringify({ exit: out.exit, code: out.code, detail: out.detail }),
    )
  })

  // ST12 staged 面触及但无消息来源 ⇒ 未判定（commit-msg 才是接线位）
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// staged change\n')
    gitRaw(['add', '-A'], root)
    const out = audit(root, 'staged')
    ok(
      'ST12 --staged 触及但无消息来源 ⇒ exit 2 / message-missing',
      out.exit === 2 && out.code === 'message-missing',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST13 staged 面 + 显式消息带 trailer + 签名 ⇒ 绿
  run((root) => {
    const reason = '复核过全部三个调用方的取值面'
    const subject = 'refactor: x'
    writeIn(root, 'scripts/lib/face-reader.mjs', '// staged change\n')
    gitRaw(['add', '-A'], root)
    const out = audit(root, 'staged', {
      message: signedMessage(subject, reason, ['scripts/lib/face-reader.mjs']),
      key: ST_KEY,
    })
    ok(
      'ST13 --staged + --message 合格声明与签名 ⇒ exit 0 / declared',
      out.exit === 0 && out.code === 'declared',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST14 worktree 未跟踪新增受保护面 ⇒ 红
  run((root) => {
    writeIn(root, 'scripts/lib/untracked-new.mjs', '// untracked\n')
    const out = audit(root, 'worktree', { message: 'wip' })
    ok(
      'ST14 --worktree 未跟踪新增 scripts/lib/* ⇒ exit 1 且命中',
      out.exit === 1 &&
        out.code === 'undeclared' &&
        out.hits.some((h) => h.path === 'scripts/lib/untracked-new.mjs'),
      JSON.stringify({ exit: out.exit, code: out.code, hits: out.hits.map((h) => h.path) }),
    )
  })

  // ST15 清单坏行 ⇒ 未判定（形状坏不猜）
  run((root) => {
    mutateGuardDoc(root, (entries) => {
      entries[0].kind = 'no-such-kind'
    })
    gitRaw(['add', '-A'], root)
    commitAll(root, 'chore: break guard list')
    const out = audit(root)
    ok(
      'ST15 清单 kind 非法 ⇒ exit 2 / list-bad',
      out.exit === 2 && out.code === 'list-bad' && out.listProblems.length > 0,
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST16 清单 reviewBy 到期 ⇒ 红（清单腐烂，§0.7）
  run((root) => {
    mutateGuardDoc(root, (entries) => {
      for (const e of entries) e.reviewBy = '2020-01-01'
    })
    commitAll(root, 'chore: old reviewBy')
    const out = audit(root)
    ok(
      'ST16 reviewBy 到期 ⇒ exit 1 / expired',
      out.exit === 1 &&
        out.code === 'expired' &&
        out.expired.length === guardEntriesOf(guardJson).length,
      JSON.stringify({ exit: out.exit, code: out.code, expired: out.expired.length }),
    )
  })

  // ST17 清单不存在 ⇒ 未判定
  run((root) => {
    gitRaw(['rm', '-q', GUARD_DATA_REL], root)
    commitAll(root, 'chore: drop guard list')
    const out = audit(root)
    ok(
      'ST17 清单在该面不存在 ⇒ exit 2 / list-missing',
      out.exit === 2 && out.code === 'list-missing',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST18 未触及但有到期项 ⇒ 红（存量腐烂不因"本次没改"而无视）
  run((root) => {
    mutateGuardDoc(root, (entries) => {
      for (const e of entries) e.reviewBy = '2020-01-01'
    })
    commitAll(root, 'chore: old reviewBy')
    writeIn(root, 'docs/w.md', '# w\n')
    commitAll(root, 'docs: add w')
    const out = audit(root)
    ok(
      'ST18 未触及但清单到期 ⇒ exit 1 / expired',
      out.exit === 1 && out.code === 'expired',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST19 清单每一项都能被匹配函数认出（反向牙：清单登记了而尺子匹配不上 = 护栏射程静默缩水）
  {
    const parsed = parseGuardList(guardJson)
    const probes = parsed.entries.map((e) => probeEntry(e))
    ok(
      'ST19 清单每条自证可被匹配（反向牙）',
      parsed.problems.length === 0 && parsed.entries.length > 0 && probes.every((p) => p.ok),
      JSON.stringify({
        entries: parsed.entries.length,
        problems: parsed.problems.length,
        blind: probes.filter((p) => !p.ok).map((p) => p.entry?.path),
      }),
    )
  }

  // ST20 过短声明不会抹掉同提交里另一条合格声明
  {
    const r = parseExemptTrailer(
      'refactor: x\n\nimmutable-exempt: 太短\n\nimmutable-exempt: 这条理由足够长而且点名了影响面',
    )
    ok(
      'ST20 一短一长声明 ⇒ 长的生效、短的只点名',
      r.reasons.length === 1 && r.problems.length === 1,
      JSON.stringify({ reasons: r.reasons.length, problems: r.problems.length }),
    )
  }

  // ST21 --record 留痕：声明合格且签名验过时逐条落 jsonl（§0.7 豁免留痕）
  run((root) => {
    const reason = '已复核全部调用方并补齐镜像测试'
    const subject = 'refactor: x'
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, signedMessage(subject, reason, ['scripts/lib/face-reader.mjs']))
    const out = audit(root, 'head', { record: true, key: ST_KEY })
    const file = path.join(root, RECORD_REL)
    let rec = null
    try {
      rec = JSON.parse(readFileSync(file, 'utf8').trim().split(/\r?\n/).pop())
    } catch {
      rec = null
    }
    ok(
      'ST21 --record ⇒ declared 且 jsonl 留痕可解析',
      out.exit === 0 &&
        out.code === 'declared' &&
        rec &&
        rec.hits.length === 1 &&
        rec.reasons.length === 1,
      JSON.stringify({ exit: out.exit, code: out.code, recorded: out.recorded, rec }),
    )
  })

  // ST22 --audit-new 首轮只建点：历史里那枚未声明的改动**不得**被读成"零违规"，也不得点红
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: tweak reader')
    const out = auditNewCommits(root)
    ok(
      'ST22 --audit-new 首轮 ⇒ bootstrapped / exit 0 / 判 0 枚 / 游标落在 HEAD',
      out.state === 'bootstrapped' &&
        out.exit === 0 &&
        out.audited === 0 &&
        out.cursorAfter === out.head &&
        out.breaches.length === 0,
      JSON.stringify({
        state: out.state,
        exit: out.exit,
        audited: out.audited,
        cursorAfter: out.cursorAfter?.slice(0, 8),
        head: out.head?.slice(0, 8),
      }),
    )
  })

  // ST23 建点后每一枚新提交判恰好一次：红→判 1 枚，游标推进；再跑一轮 ⇒ 无新输入不记绿成"判过"
  run((root) => {
    auditNewCommits(root) // 建点
    writeIn(root, 'scripts/lib/face-reader.mjs', '// silent edit\n')
    commitAll(root, 'refactor: silent judgement edit')
    const bad = auditNewCommits(root)
    const again = auditNewCommits(root)
    ok(
      'ST23 游标后那枚静默改判据面 ⇒ breach/exit 1 且点名路径；下一轮 no-new-head 不重复判',
      bad.state === 'breach' &&
        bad.exit === 1 &&
        bad.audited === 1 &&
        bad.breaches.length === 1 &&
        bad.breaches[0].hits.some((h) => h.path === 'scripts/lib/face-reader.mjs') &&
        again.state === 'no-new-head' &&
        again.exit === 0,
      JSON.stringify({
        bad: {
          state: bad.state,
          audited: bad.audited,
          hits: bad.breaches.map((b) => b.hits.map((h) => h.path)),
        },
        again: { state: again.state, exit: again.exit },
      }),
    )
  })

  // ST24 单轮额度：区间长于 limit ⇒ 只判最老那段、游标只推进到已判末位、余数进 pending（不丢）
  run((root) => {
    auditNewCommits(root) // 建点
    for (let i = 0; i < 3; i += 1) {
      writeIn(root, 'scripts/lib/face-reader.mjs', `// edit ${i}\n`)
      commitAll(root, `refactor: edit ${i}`)
    }
    const first = auditNewCommits(root, { limit: 2 })
    const second = auditNewCommits(root, { limit: 2 })
    ok(
      'ST24 limit=2 时先判最老两枚(pending=1)，第二轮补判最后一枚 ⇒ 三枚各判一次',
      first.audited === 2 &&
        first.pending === 1 &&
        first.breaches.length === 2 &&
        second.audited === 1 &&
        second.breaches.length === 1,
      JSON.stringify({
        first: { audited: first.audited, pending: first.pending, breach: first.breaches.length },
        second: { audited: second.audited, breach: second.breaches.length },
      }),
    )
  })

  // ST25 游标被改写（别人 force-push / 历史重写）⇒ 点名 detached，绝不静默"没有新提交"
  run((root) => {
    auditNewCommits(root) // 建点
    writeFileSync(
      path.join(root, CURSOR_REL),
      JSON.stringify({ cursor: '0'.repeat(40), at: new Date().toISOString() }),
      'utf8',
    )
    writeIn(root, 'scripts/lib/face-reader.mjs', '// after rewrite\n')
    commitAll(root, 'refactor: after rewrite')
    const out = auditNewCommits(root, { limit: 1 })
    ok(
      'ST25 游标不在祖先链 ⇒ detached 且仍判到最近一枚（不记绿）',
      out.detached === true &&
        out.audited === 1 &&
        out.breaches.length === 1 &&
        /祖先链|枚举到 0/.test(out.detail),
      JSON.stringify({
        detached: out.detached,
        audited: out.audited,
        breach: out.breaches.length,
        detail: out.detail.slice(0, 60),
      }),
    )
  })

  // ST26 合并提交不重复计（第一父 diff 是父辈内容的并集）：分支那枚判一次，merge 枚跳过并点名
  run((root) => {
    auditNewCommits(root) // 建点
    gitRaw(['checkout', '-q', '-b', 'feat'], root)
    writeIn(root, 'scripts/lib/face-reader.mjs', '// branch edit\n')
    commitAll(root, 'refactor: silent branch edit')
    gitRaw(['checkout', '-q', 'main'], root)
    gitRaw(['merge', '-q', '--no-ff', 'feat', '-m', 'Merge branch feat'], root)
    const out = auditNewCommits(root)
    ok(
      'ST26 分支枚判一次 ⇒ breach=1 且 merge 枚 skippedMerges=1（同一件事不记两回）',
      out.state === 'breach' &&
        out.breaches.length === 1 &&
        out.skippedMerges === 1 &&
        out.judged === 1 &&
        out.audited === 2,
      JSON.stringify({
        state: out.state,
        breach: out.breaches.length,
        skippedMerges: out.skippedMerges,
        judged: out.judged,
        audited: out.audited,
      }),
    )
  })

  // ---------------------------------------------------------------------
  // 签名豁免（2026-11-04）：反向测试四条 + 密钥缺失 fail-closed 一条
  // ---------------------------------------------------------------------

  // ST27 正确签名 ⇒ declared 放行（正向对照）
  run((root) => {
    const reason = '签名绑定标题与命中面，本单即受审对象'
    const subject = 'refactor: signed exemption'
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, signedMessage(subject, reason, ['scripts/lib/face-reader.mjs']))
    const out = audit(root, 'head', { key: ST_KEY })
    ok(
      'ST27 文字理由 + 正确签名 ⇒ exit 0 / declared',
      out.exit === 0 && out.code === 'declared' && out.signature.code === 'sig-verified',
      JSON.stringify({ exit: out.exit, code: out.code, sig: out.signature.code }),
    )
  })

  // ST28 迁移窗口内：仅文字理由（无签名行）⇒ 放行 + 「无签名豁免」台账落地
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: legacy\n\nimmutable-exempt: 迁移窗口内的旧写法，复核过全部调用方')
    const out = audit(root, 'head', { today: '2000-01-01', key: null })
    let rows = []
    try {
      rows = readFileSync(path.join(root, UNSIGNED_LEDGER_REL), 'utf8')
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
    } catch {
      rows = []
    }
    const rec = rows.length ? JSON.parse(rows[rows.length - 1]) : null
    ok(
      'ST28 窗口内仅文字理由 ⇒ exit 0 / declared-unsigned 且落「无签名豁免」台账',
      out.exit === 0 &&
        out.code === 'declared-unsigned' &&
        out.unsignedRecorded === UNSIGNED_LEDGER_REL &&
        rec &&
        rec.kind === 'unsigned-exempt' &&
        rec.signatureCode === 'sig-missing',
      JSON.stringify({ exit: out.exit, code: out.code, recorded: out.unsignedRecorded, rec }),
    )
  })

  // ST29 迁移窗口后：仅文字理由 ⇒ 不放行
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: legacy\n\nimmutable-exempt: 迁移窗口后的旧写法，复核过全部调用方')
    const out = audit(root, 'head', { today: dayAfterWindow, key: null })
    ok(
      'ST29 窗口后仅文字理由 ⇒ exit 1 / undeclared-unsigned（不放行）',
      out.exit === 1 && out.code === 'undeclared-unsigned',
      JSON.stringify({ exit: out.exit, code: out.code, sig: out.signature.code }),
    )
  })

  // ST30 签名形状正确但验签失败 ⇒ 不放行（窗口内也不放：伪造签名不能比不签更划算）
  run((root) => {
    const reason = '签名绑定标题与命中面，本单即受审对象'
    const subject = 'refactor: forged signature'
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    const forged = signExemption({
      subject,
      hits: ['scripts/lib/face-reader.mjs'],
      reason,
      key: ST_KEY_OTHER,
    })
    commitAll(root, `${subject}\n\n${EXEMPT_TRAILER} ${reason}\n${SIG_TRAILER} ${forged}`)
    const out = audit(root, 'head', { today: '2000-01-01', key: ST_KEY })
    ok(
      'ST30 签名形状正确但验签失败 ⇒ exit 1 / undeclared-unsigned（窗口内也不放行）',
      out.exit === 1 && out.code === 'undeclared-unsigned' && out.signature.code === 'sig-invalid',
      JSON.stringify({ exit: out.exit, code: out.code, sig: out.signature.code }),
    )
  })

  // ST31 密钥不存在 + 有签名行 ⇒ fail-closed（绝不"没钥匙就默认放行"）
  run((root) => {
    const reason = '签名绑定标题与命中面，本单即受审对象'
    const subject = 'refactor: missing key'
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, signedMessage(subject, reason, ['scripts/lib/face-reader.mjs']))
    const out = audit(root, 'head', { today: '2000-01-01', key: null })
    ok(
      'ST31 密钥不存在但有签名行 ⇒ exit 1（key-unavailable，fail-closed）',
      out.exit === 1 &&
        out.code === 'undeclared-unsigned' &&
        out.signature.code === 'key-unavailable' &&
        out.keyWhy.length > 0,
      JSON.stringify({
        exit: out.exit,
        code: out.code,
        sig: out.signature.code,
        keyWhy: out.keyWhy,
      }),
    )
  })

  // ---------------------------------------------------------------------
  // 事后追认台账（2026-11-04）：正反成对 + 每一档失效方向都往严里倒
  // ---------------------------------------------------------------------

  /** 造一条合法追认行（命中面由护栏自己算，这里只补签名与到期）。 */
  const ackRowFor = (sha, paths, reason = '事后逐枚具名补说明，覆盖面与命中一致', opts = {}) => {
    const row = {
      sha,
      paths,
      reason,
      ackedBy: opts.ackedBy ?? 'selftest',
      ackedAt: '2026-11-04T00:00:00.000Z',
      expires: opts.expires ?? '2099-01-01',
    }
    return {
      ...row,
      sig: signAck({ sha, paths, reason, ackedBy: row.ackedBy, key: opts.key ?? ST_ACK_KEY }),
    }
  }

  // ST32 反向基准：未声明且无追认 ⇒ 照旧红（新增档不许把默认方向放松一格）
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: silent')
    const out = audit(root, 'head', { key: ST_KEY })
    ok(
      'ST32 未声明 + 台账空 ⇒ 仍 exit 1 / undeclared（不静默绿）',
      out.exit === 1 && out.code === 'undeclared',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  })

  // ST33 正：合法签名追认 ⇒ retro-declared / exit 0，且读数必须带着"谁补的"
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: silent')
    const sha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const rows = [ackRowFor(sha, ['scripts/lib/face-reader.mjs'])]
    const out = audit(root, 'head', { key: ST_KEY, ackRows: rows })
    ok(
      'ST33 有效追认 ⇒ exit 0 / retro-declared 且带 ackedBy/expires',
      out.exit === 0 &&
        out.code === 'retro-declared' &&
        out.ack.row.ackedBy === 'selftest' &&
        out.ack.row.expires === '2099-01-01',
      JSON.stringify({ exit: out.exit, code: out.code, ack: out.ack }),
    )
  })

  // ST34 反向：签名是拿**别的 sha** 签的 ⇒ 验不过，红不变（抄行不划算）
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: silent')
    const sha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const rows = [
      ackRowFor(sha, ['scripts/lib/face-reader.mjs'], '事后逐枚具名补说明，覆盖面与命中一致', {
        key: ST_KEY_OTHER,
      }),
    ]
    const out = audit(root, 'head', { key: ST_KEY, ackRows: rows })
    ok(
      'ST34 追认签名验不过 ⇒ 仍 exit 1 且 ackProblem 点名 ack-sig-invalid',
      out.exit === 1 && out.code === 'undeclared' && out.ack && out.ack.code === 'ack-sig-invalid',
      JSON.stringify({ exit: out.exit, code: out.code, ack: out.ack && out.ack.code }),
    )
  })

  // ST35 反向：追认到期 ⇒ 回到红（追认不是终身赦免，§0.7）
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: silent')
    const sha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const rows = [
      ackRowFor(sha, ['scripts/lib/face-reader.mjs'], '事后逐枚具名补说明，覆盖面与命中一致', {
        expires: '2020-01-01',
      }),
    ]
    const out = audit(root, 'head', { key: ST_KEY, ackRows: rows, today: '2026-11-04' })
    ok(
      'ST35 追认到期 ⇒ 仍 exit 1 且点名 ack-expired',
      out.exit === 1 && out.ack && out.ack.code === 'ack-expired',
      JSON.stringify({ exit: out.exit, ack: out.ack && out.ack.code }),
    )
  })

  // ST36 反向：追认漏列实际命中的那一面 ⇒ 不算说明到位
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: silent')
    const sha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const rows = [ackRowFor(sha, ['AGENTS.md'])]
    const out = audit(root, 'head', { key: ST_KEY, ackRows: rows })
    ok(
      'ST36 追认 paths 未覆盖命中面 ⇒ 仍红并点名 ack-paths-incomplete',
      out.exit === 1 && out.ack && out.ack.code === 'ack-paths-incomplete',
      JSON.stringify({ exit: out.exit, ack: out.ack && { code: out.ack.code, why: out.ack.why } }),
    )
  })

  // ST37 台账坏行 ⇒ 该行不生效且被逐条点名（不静默当成"没有追认"）；文件不存在 ⇒ absent 而非"读不到"。
  run((root) => {
    const bad = '{ not json\n{"sha":"deadbeef","paths":[],"reason":"短"}\n'
    const r = parseAckLedger(bad)
    const absent = readAckRows(root, { rev: 'HEAD' })
    ok(
      'ST37 台账坏行 ⇒ rows 空 + problems 逐条带行号；无文件档 absent=true（现状=还没有追认，不是读不到）',
      r.rows.length === 0 &&
        r.problems.length >= 1 &&
        r.problems[0].line === 1 &&
        absent.absent === true &&
        absent.rows.length === 0,
      JSON.stringify({ rows: r.rows.length, problems: r.problems, absent }),
    )
  })

  // ST38 端到端（这一条才是"推送不再被历史顶死"的证据）：
  //        未声明枚挡住 range ⇒ 追加签名追认并**提交进仓**后，同一区间判成 clean，红数归零。
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: silent blocks push')
    const sha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const base = String(gitRaw(['rev-parse', 'HEAD~1'], root)).trim()
    const before = auditRange(root, { range: `${base}..${sha}`, today: '2026-11-04' })
    const row = ackRowFor(sha, ['scripts/lib/face-reader.mjs'])
    writeIn(root, ACK_LEDGER_REL, `${JSON.stringify(row)}\n`)
    commitAll(
      root,
      'chore(guard): 追认上述未声明枚\n\nimmutable-exempt: 追认台账自身在受保护面上，本枚即补发说明那一步',
    )
    // range/巡检两档的密钥只走**正式三源**(不接 key 注入参数)——自检用 env 那一档把夹具钥递进去,
    // 与本仓真钥同一条路径,不许为了测试开后门。
    process.env[KEY_ENV] = ST_KEY
    process.env[ACK_KEY_ENV] = ST_ACK_KEY
    let after
    try {
      after = auditRange(root, { range: `${base}..${sha}`, today: '2026-11-04' })
    } finally {
      delete process.env[KEY_ENV]
      delete process.env[ACK_KEY_ENV]
    }
    ok(
      'ST38 range 先红 ⇒ 追认进仓后同区间 clean（追认只从**已提交面**取，工作树塞行不生效）',
      before.exit === 1 &&
        before.breaches.length === 1 &&
        after.exit === 0 &&
        after.state === 'clean' &&
        after.retro.length === 1 &&
        after.retro[0].ackedBy.startsWith('selftest'),
      JSON.stringify({
        before: { exit: before.exit, breaches: before.breaches.length },
        after: {
          exit: after.exit,
          state: after.state,
          retro: after.retro.length,
          by: after.retro[0] && after.retro[0].ackedBy,
        },
      }),
    )
    // 反向牙：把追认行**从提交面撤掉**（还原成没有台账的样子）⇒ 同区间必须再红。
    // 这一条防的是"range 只读了工作树那份文件"——那会让本地随手塞一行永久洗白历史。
    gitRaw(['rm', '-q', '-f', ACK_LEDGER_REL], root)
    commitAll(root, 'chore(guard): 撤掉追认（反向夹具）')
    const again = auditRange(root, { range: `${base}..${sha}`, today: '2026-11-04' })
    ok(
      'ST38b 追认被撤 ⇒ 同区间立刻回到红（可见性只认已提交面）',
      again.exit === 1 && again.breaches.length === 1,
      JSON.stringify({ exit: again.exit, breaches: again.breaches.length }),
    )
  })

  // ST39 自带签名但验不过(拿别的钥匙签的)⇒ 无追认时仍红；有持钥方追认才转 retro-declared,
  // 且读数必须点明"它替代的是哪一种失败",不许与"当时就签对了"混成同一句。
  run((root) => {
    const reason = '签名绑定标题与命中面，本单即受审对象'
    const subject = 'refactor: signed with wrong key'
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, signedMessage(subject, reason, ['scripts/lib/face-reader.mjs'], ST_KEY_OTHER))
    const sha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const without = audit(root, 'head', { key: ST_KEY })
    const rows = [ackRowFor(sha, ['scripts/lib/face-reader.mjs'])]
    const withAck = audit(root, 'head', { key: ST_KEY, ackRows: rows })
    ok(
      'ST39 假签名 + 无追认 ⇒ 红；假签名 + 有效追认 ⇒ retro-declared 且 substitutedFor 点名替代的是哪一格',
      without.exit === 1 &&
        without.code === 'undeclared-unsigned' &&
        withAck.exit === 0 &&
        withAck.code === 'retro-declared' &&
        withAck.ack.substitutedFor === '自带签名验不过',
      JSON.stringify({
        without: { exit: without.exit, code: without.code },
        withAck: {
          exit: withAck.exit,
          code: withAck.code,
          sub: withAck.ack && withAck.ack.substitutedFor,
        },
      }),
    )
  })

  // ST40 窗口关闭后（2026-11-11 起）只有文字理由 ⇒ 红；此时**唯一**前向出路就是持钥方追认。
  // 这一条钉的是自治环的长期可行性：会话没有密钥 ⇒ 判据面那一格永远只能由人来结清（配合 auto-evolve 的整批拒收）。
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(
      root,
      'refactor: text only after window\n\nimmutable-exempt: 窗口关闭后只剩文字理由，按新语义不放行',
    )
    const sha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const today = '2027-01-01'
    const before = audit(root, 'head', { key: ST_KEY, today })
    const rows = [
      ackRowFor(sha, ['scripts/lib/face-reader.mjs'], '窗口关闭后由持钥方逐枚具名追认', {
        expires: '2099-01-01',
      }),
    ]
    const after = audit(root, 'head', { key: ST_KEY, today, ackRows: rows })
    ok(
      'ST40 窗口后仅文字理由 ⇒ 红；同枚加有效追认 ⇒ retro-declared(substitutedFor=窗口已过)',
      before.exit === 1 &&
        before.code === 'undeclared-unsigned' &&
        after.exit === 0 &&
        after.code === 'retro-declared' &&
        after.ack.substitutedFor.startsWith('窗口已过'),
      JSON.stringify({
        before: { exit: before.exit, code: before.code },
        after: { exit: after.exit, code: after.code, sub: after.ack && after.ack.substitutedFor },
      }),
    )
  })

  // ST41 签发留痕回查:签给"计划标题"、提交时标题被改 ⇒ 除 sig-invalid 外还必须摊开"当时签给了谁",
  // 且那句"为什么判红"不许再说成"窗口到期"(两个出路完全不同:重签 vs 补签名)。
  run((root) => {
    const reason = '载荷绑标题这一条就是标题被改序后的反例'
    const planned = 'refactor: planned subject'
    const actual = 'refactor: actual subject after reorder'
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    gitRaw(['add', '-A'], root)
    process.env[KEY_ENV] = ST_KEY
    let signed
    let out
    try {
      signed = signStaged(root, {
        subject: planned,
        reason,
        paths: ['scripts/lib/face-reader.mjs'],
      })
      commitAll(root, `${actual}\n\n${EXEMPT_TRAILER} ${reason}\n${SIG_TRAILER} ${signed.sig}`)
      out = audit(root, 'head', { key: ST_KEY })
    } finally {
      delete process.env[KEY_ENV]
    }
    const report = out.exit === 1 ? formatReport(out) : ''
    ok(
      'ST41 标题被改 ⇒ sig-invalid + 签发对照点名计划标题,且成因句不再谎称"窗口到期"',
      out.exit === 1 &&
        out.code === 'undeclared-unsigned' &&
        out.signature.code === 'sig-invalid' &&
        out.sigIssuedFor &&
        out.sigIssuedFor.subject === planned &&
        out.sigIssuedFor.paths.join(',') === 'scripts/lib/face-reader.mjs' &&
        report.includes('签发对照') &&
        report.includes('不一致') &&
        !report.includes('仅文字理由不再放行'),
      JSON.stringify({
        exit: out.exit,
        code: out.code,
        sig: out.signature.code,
        issued: out.sigIssuedFor ?? null,
        has对照: report.includes('签发对照'),
        仍说窗口: report.includes('仅文字理由不再放行'),
      }),
    )
    // ST41b 反向:签名本来就是为实际标题签的 ⇒ 不许出现"签发对照"这一行(线索只在真不一致时才给,
    // 拿它当装饰就会把对的方向说歪)。
    run((root2) => {
      writeIn(root2, 'scripts/lib/face-reader.mjs', '// changed\n')
      gitRaw(['add', '-A'], root2)
      process.env[KEY_ENV] = ST_KEY
      let clean
      let out2
      try {
        signed = signStaged(root2, {
          subject: actual,
          reason,
          paths: ['scripts/lib/face-reader.mjs'],
        })
        commitAll(root2, `${actual}\n\n${EXEMPT_TRAILER} ${reason}\n${SIG_TRAILER} ${signed.sig}`)
        out2 = audit(root2, 'head', { key: ST_KEY })
        clean = formatReport(out2)
      } finally {
        delete process.env[KEY_ENV]
      }
      ok(
        'ST41b 标题一致 ⇒ declared 且不出签发对照线索',
        out2.exit === 0 && out2.code === 'declared' && !clean.includes('签发对照'),
        JSON.stringify({ exit: out2.exit, code: out2.code }),
      )
    })
  })

  // ST42 ① HEAD 在"签发 → 验签"之间前移：v2（钉 base + blob）必须仍放行；
  // 同场用 v1 旧语义做**基线对照**，必须红——两支都在，才证明"修的是取数面，不是放宽判据"。
  run((root) => {
    const reason = 'HEAD 前移不改变本席声明面（v2 把取数面钉在签发那一刻）'
    const subject = 'fix: keep staged signature valid across HEAD advance'
    const ours = 'scripts/lib/face-reader.mjs'
    const theirs = 'scripts/guardian-runner.mjs'
    const idx = path.join(root, '.git', 'st-index')
    let outV2
    let outV1
    let signedBase = ''
    try {
      writeIn(root, ours, '// ours\n')
      process.env.GIT_INDEX_FILE = idx
      gitRaw(['read-tree', 'HEAD'], root)
      gitRaw(['add', '--', ours], root)
      process.env[KEY_ENV] = ST_KEY
      const signed = signStaged(root, { subject, reason, paths: [ours] })
      signedBase = signed.base
      const msgV2 = `${subject}\n\n${EXEMPT_TRAILER} ${reason}\n${SIG_TRAILER} ${signed.sig}`
      // 旧语义基线：v1 载荷只有 {标题, 路径集, 理由}，取数面是"相对当前 HEAD 的差异集"。
      const entries = parseGuardList(guardJson).entries
      const judged = judgeChanges({
        changes: [{ status: 'M', path: ours }],
        entries,
        message: '',
        today: todayStr(),
      })
      const v1 = signExemption({ subject, hits: judged.hits, reason, key: ST_KEY })
      const msgV1 = `${subject}\n\n${EXEMPT_TRAILER} ${reason}\n${SIG_TRAILER} ${v1}`
      // 别席推进 HEAD（改另一条受保护路径），**不碰**本席私有索引。
      delete process.env.GIT_INDEX_FILE
      writeIn(root, theirs, '// theirs\n')
      gitRaw(['add', '--', theirs], root)
      gitRaw(['commit', '--no-verify', '-F', '-'], root, { input: 'chore: 别席推进 HEAD' })
      process.env.GIT_INDEX_FILE = idx
      outV2 = audit(root, 'staged', { message: msgV2, key: ST_KEY })
      outV1 = audit(root, 'staged', { message: msgV1, key: ST_KEY })
    } finally {
      delete process.env[KEY_ENV]
      delete process.env.GIT_INDEX_FILE
    }
    ok(
      'ST42 ① HEAD 前移（签发→验签之间）⇒ v2 仍 declared，且 v1 基线同场必红',
      outV2.exit === 0 &&
        outV2.code === 'declared' &&
        outV2.signature.code === 'sig-verified' &&
        outV2.signature.matchedBase === signedBase &&
        outV2.foreignHits.includes(theirs) &&
        outV1.exit === 1 &&
        outV1.code === 'undeclared-unsigned' &&
        outV1.signature.code === 'sig-invalid',
      JSON.stringify({
        v2: {
          exit: outV2.exit,
          code: outV2.code,
          sig: outV2.signature?.code,
          base: outV2.signature?.matchedBase ?? null,
          foreign: outV2.foreignHits ?? [],
        },
        v1: {
          exit: outV1.exit,
          code: outV1.code,
          sig: outV1.signature?.code,
          cause: outV1.sigMismatch?.cause ?? null,
        },
      }),
    )
  })

  // ST43 ② 路径集被真实篡改（同一 base、无 HEAD 前移，偷偷多暂存一条受保护路径）⇒ 必须拒。
  run((root) => {
    const reason = '路径集篡改的反例：多一条未声明受保护路径'
    const subject = 'fix: path set tamper must fail'
    const ours = 'scripts/lib/face-reader.mjs'
    const extra = 'scripts/guardian-runner.mjs'
    const idx = path.join(root, '.git', 'st-index')
    let out
    try {
      writeIn(root, ours, '// ours\n')
      writeIn(root, extra, '// extra\n')
      process.env.GIT_INDEX_FILE = idx
      gitRaw(['read-tree', 'HEAD'], root)
      gitRaw(['add', '--', ours], root)
      process.env[KEY_ENV] = ST_KEY
      const signed = signStaged(root, { subject, reason, paths: [ours] })
      const msg = `${subject}\n\n${EXEMPT_TRAILER} ${reason}\n${SIG_TRAILER} ${signed.sig}`
      gitRaw(['add', '--', extra], root) // 签完之后私塞
      out = audit(root, 'staged', { message: msg, key: ST_KEY })
    } finally {
      delete process.env[KEY_ENV]
      delete process.env.GIT_INDEX_FILE
    }
    ok(
      'ST43 ② 路径集被真实篡改 ⇒ 仍 exit 1 / sig-invalid，且逐格判别名 paths 不一致',
      out.exit === 1 &&
        out.code === 'undeclared-unsigned' &&
        out.signature.code === 'sig-invalid' &&
        out.sigMismatch?.paths === true,
      JSON.stringify({
        exit: out.exit,
        code: out.code,
        sig: out.signature?.code,
        mismatch: out.sigMismatch ?? null,
      }),
    )
  })

  // ST44 ② 同一路径内容被换（路径集不变）⇒ v2 的 blob 硬断言必须拒；v1 结构上看不见这一格。
  run((root) => {
    const reason = 'blob 篡改的反例：路径不变、内容被换'
    const subject = 'fix: content tamper must fail'
    const ours = 'scripts/lib/face-reader.mjs'
    const idx = path.join(root, '.git', 'st-index')
    let out
    try {
      writeIn(root, ours, '// signed content\n')
      process.env.GIT_INDEX_FILE = idx
      gitRaw(['read-tree', 'HEAD'], root)
      gitRaw(['add', '--', ours], root)
      process.env[KEY_ENV] = ST_KEY
      const signed = signStaged(root, { subject, reason, paths: [ours] })
      const msg = `${subject}\n\n${EXEMPT_TRAILER} ${reason}\n${SIG_TRAILER} ${signed.sig}`
      writeIn(root, ours, '// swapped after signing\n')
      gitRaw(['add', '--', ours], root)
      out = audit(root, 'staged', { message: msg, key: ST_KEY })
    } finally {
      delete process.env[KEY_ENV]
      delete process.env.GIT_INDEX_FILE
    }
    ok(
      'ST44 ② 路径集不变而内容被换 ⇒ exit 1 / sig-invalid，且逐格判别名 blobs 不一致',
      out.exit === 1 &&
        out.code === 'undeclared-unsigned' &&
        out.signature.code === 'sig-invalid' &&
        out.sigMismatch?.blobs === true,
      JSON.stringify({
        exit: out.exit,
        code: out.code,
        sig: out.signature?.code,
        mismatch: out.sigMismatch ?? null,
      }),
    )
  })

  // ST49 ② 整条消息串号：签名行是给**另一条提交**（另一批受保护路径）签的，与本次命中集互不包含。
  // 这型的关键是"标题也可以一致"——串号把标题一起换掉，只比标题发现不了；必须比路径集包含方向。
  run((root) => {
    const reason = '整条消息串号的反例：签名属于另一批路径'
    const subject = 'fix: message swapped from another session'
    const ours = 'scripts/lib/face-reader.mjs'
    const other = 'scripts/guardian-runner.mjs'
    const idxSign = path.join(root, '.git', 'st-index-sign')
    const idxCommit = path.join(root, '.git', 'st-index-commit')
    let out
    try {
      writeIn(root, other, '// other\n')
      process.env.GIT_INDEX_FILE = idxSign
      gitRaw(['read-tree', 'HEAD'], root)
      gitRaw(['add', '--', other], root)
      process.env[KEY_ENV] = ST_KEY
      const signed = signStaged(root, { subject, reason, paths: [other] })
      const msg = `${subject}\n\n${EXEMPT_TRAILER} ${reason}\n${SIG_TRAILER} ${signed.sig}`
      writeIn(root, ours, '// ours\n')
      process.env.GIT_INDEX_FILE = idxCommit
      gitRaw(['read-tree', 'HEAD'], root)
      gitRaw(['add', '--', ours], root)
      out = audit(root, 'staged', { message: msg, key: ST_KEY })
    } finally {
      delete process.env[KEY_ENV]
      delete process.env.GIT_INDEX_FILE
    }
    ok(
      'ST49 ② 签名属于另一批路径（与本次命中互不包含）⇒ 仍红，且判别点名 message-from-other-commit',
      out.exit === 1 &&
        out.code === 'undeclared-unsigned' &&
        out.signature.code === 'sig-invalid' &&
        out.sigMismatch?.cause === 'message-from-other-commit' &&
        out.sigMismatch?.missing.includes(other) &&
        out.sigMismatch?.extra.includes(ours),
      JSON.stringify({
        exit: out.exit,
        code: out.code,
        sig: out.signature?.code,
        mismatch: out.sigMismatch ?? null,
      }),
    )
  })

  // ST50 签发面比提交面宽（签了共享索引，提交用更窄的私有索引）⇒ 判红但成因必须点名 signed-set-superset。
  run((root) => {
    const reason = '签发面比提交面宽的反例'
    const subject = 'fix: sign wider than commit'
    const ours = 'scripts/lib/face-reader.mjs'
    const other = 'scripts/guardian-runner.mjs'
    const idx = path.join(root, '.git', 'st-index')
    let out
    try {
      writeIn(root, ours, '// ours\n')
      writeIn(root, other, '// other\n')
      process.env.GIT_INDEX_FILE = idx
      gitRaw(['read-tree', 'HEAD'], root)
      gitRaw(['add', '--', ours, other], root)
      process.env[KEY_ENV] = ST_KEY
      const signed = signStaged(root, { subject, reason, paths: [ours, other] })
      const msg = `${subject}\n\n${EXEMPT_TRAILER} ${reason}\n${SIG_TRAILER} ${signed.sig}`
      // 提交面比签发面窄：把 other 的索引条目复位到 HEAD（不删工作树、不产生 D 状态）。
      // 不能用 `git rm --cached`：other 若在 HEAD 里，那会留下一条 D 命中，路径集就不只是"少一条"。
      gitRaw(['reset', '-q', 'HEAD', '--', other], root)
      out = audit(root, 'staged', { message: msg, key: ST_KEY })
    } finally {
      delete process.env[KEY_ENV]
      delete process.env.GIT_INDEX_FILE
    }
    ok(
      'ST50 签名面比提交面宽 ⇒ 仍红，且判别点名 signed-set-superset',
      out.exit === 1 &&
        out.code === 'undeclared-unsigned' &&
        out.signature.code === 'sig-invalid' &&
        out.sigMismatch?.cause === 'signed-set-superset' &&
        out.sigMismatch?.missing.includes(other),
      JSON.stringify({
        exit: out.exit,
        code: out.code,
        sig: out.signature?.code,
        mismatch: out.sigMismatch ?? null,
      }),
    )
  })

  // ST51 recordSigIssue.base：签发台账必须记住"签给哪个 base 的哪批内容号"。
  // 为什么正确：没有 base ⇒ 事后验签失败时无法按"当时那一面"重放，只能看到"路径集不一致"，
  // 分不出①HEAD 前移与②消息串号；没有 blob ⇒ 无法判断同一路径内容是否被换。台账两格都在，才可对账。
  run((root) => {
    const rel = 'scripts/lib/face-reader.mjs'
    const idx = path.join(root, '.git', 'st-index')
    let signed
    try {
      writeIn(root, rel, '// signed content\n')
      process.env.GIT_INDEX_FILE = idx
      gitRaw(['read-tree', 'HEAD'], root)
      gitRaw(['add', '--', rel], root)
      process.env[KEY_ENV] = ST_KEY
      signed = signStaged(root, {
        subject: 'fix: ledger base',
        reason: '台账必须记住签发时的 base 与内容号',
        paths: [rel],
      })
    } finally {
      delete process.env[KEY_ENV]
      delete process.env.GIT_INDEX_FILE
    }
    const rows = readFileSync(path.join(root, SIG_ISSUE_REL), 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((l) => JSON.parse(l))
    const row = rows[rows.length - 1]
    const headNow = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    ok(
      'ST51 recordSigIssue 落账 base/blob：base 恰为签发时 HEAD，blob 恰为索引里那一份',
      row.base === signed.base &&
        row.base === headNow &&
        row.blobs?.[rel] === signed.blobs[rel] &&
        FULL_SHA_RE.test(String(row.blobs?.[rel] ?? '')) &&
        String(row.sig).startsWith(`${SIG_VERSION_V2}:${signed.base}:`) &&
        JSON.stringify(row.paths) === JSON.stringify([rel]),
      JSON.stringify({
        rowBase: String(row.base).slice(0, 12),
        signedBase: String(signed.base).slice(0, 12),
        headNow: headNow.slice(0, 12),
        ledgerBlob: String(row.blobs?.[rel] ?? '').slice(0, 8),
        signedBlob: String(signed.blobs?.[rel] ?? '').slice(0, 8),
      }),
    )
  })

  // ST52 recordSigIssue 写失败分支：留痕是帮助，不是判定输入 ⇒ 写不进去也必须照常签发。
  // 为什么正确：把同名路径做成目录，appendFileSync 必然抛（EISDIR）⇒ 唯一正确结果是回传 null；
  // 若它抛到调用方，一次"台账目录被占"就会把正常签发变成异常，方向变成"为了提交先删台账"。
  run((root) => {
    const rel = 'scripts/lib/face-reader.mjs'
    const idx = path.join(root, '.git', 'st-index')
    let signed
    try {
      writeIn(root, rel, '// content\n')
      mkdirSync(path.join(root, SIG_ISSUE_REL), { recursive: true }) // 同名目录 ⇒ 追加必失败
      process.env.GIT_INDEX_FILE = idx
      gitRaw(['read-tree', 'HEAD'], root)
      gitRaw(['add', '--', rel], root)
      process.env[KEY_ENV] = ST_KEY
      signed = signStaged(root, {
        subject: 'fix: ledger unwritable',
        reason: '台账写失败不得阻断签发本身',
        paths: [rel],
      })
    } finally {
      delete process.env[KEY_ENV]
      delete process.env.GIT_INDEX_FILE
    }
    ok(
      'ST52 recordSigIssue 写失败 ⇒ recorded=null，签名形状与 base 不受影响',
      signed.recorded === null &&
        signed.sig.startsWith(`v2:${signed.base}:`) &&
        FULL_SHA_RE.test(signed.base),
      JSON.stringify({
        recorded: signed.recorded,
        sigHead: String(signed.sig).slice(0, 12),
        base: String(signed.base).slice(0, 12),
      }),
    )
  })

  // ST53 blobMapFor 三条"取不到"路径：被删出索引 / 新建未入索引 / 旧面没有该路径 ⇒ 一律空串。
  // 为什么正确：v2 载荷里 blob 是"这一面里该路径的内容号"。取不到时必须留空，让验签用它去比对；
  // 若这里悄悄回落到 HEAD 内容或抛错，"被删/未暂存"的路径就会拿旧内容签进载荷 ⇒ 假通过或假红。
  run((root) => {
    const tracked = 'scripts/lib/face-reader.mjs'
    const fresh = 'scripts/lib/new-not-staged.mjs'
    const idx = path.join(root, '.git', 'st-index')
    let present
    let deleted
    let unstaged
    let absentInBase
    try {
      writeIn(root, fresh, '// 只落工作树，不入索引\n')
      process.env.GIT_INDEX_FILE = idx
      gitRaw(['read-tree', 'HEAD'], root)
      gitRaw(['add', '--', tracked], root)
      present = blobMapFor(root, 'staged', 'HEAD', [tracked])
      gitRaw(['rm', '--cached', '--', tracked], root) // 只删索引条目（工作树仍在）
      deleted = blobMapFor(root, 'staged', 'HEAD', [tracked])
      unstaged = blobMapFor(root, 'staged', 'HEAD', [fresh])
      absentInBase = blobMapFor(root, 'head', 'HEAD', ['docs/never-in-any-commit.md'])
    } finally {
      delete process.env.GIT_INDEX_FILE
    }
    ok(
      'ST53 blobMapFor 取不到 ⇒ 空串（已入索引为 40 位）',
      FULL_SHA_RE.test(String(present[tracked] ?? '')) &&
        deleted[tracked] === '' &&
        unstaged[fresh] === '' &&
        absentInBase['docs/never-in-any-commit.md'] === '',
      JSON.stringify({
        present: String(present[tracked] ?? '').slice(0, 8),
        deleted: deleted[tracked],
        unstaged: unstaged[fresh],
        absentInBase: absentInBase['docs/never-in-any-commit.md'],
      }),
    )
  })

  // ST54 path-and-blob-drift：路径集变了、且**共有路径**的内容号也变了 ⇒ 必须同时点名两格。
  // 为什么正确：只报"路径集漂移"会让作者以为补齐/删掉那条路径就够，重签后仍会因内容不符再红一次；
  // 只报 blob 又会漏掉 missing/extra。这一型只有两格都报，出路才是"按最终索引整体重签"。
  {
    const dec = decomposeSigMismatch(
      {
        subject: 's',
        paths: ['scripts/lib/a.mjs', 'scripts/lib/b.mjs'],
        blobs: { 'scripts/lib/a.mjs': 'a'.repeat(40), 'scripts/lib/b.mjs': 'b'.repeat(40) },
      },
      {
        subject: 's',
        paths: ['scripts/lib/a.mjs', 'scripts/lib/c.mjs'],
        blobs: { 'scripts/lib/a.mjs': 'c'.repeat(40), 'scripts/lib/c.mjs': 'd'.repeat(40) },
      },
    )
    ok(
      'ST54 路径集与共有路径内容同时变 ⇒ cause=path-and-blob-drift，且两向差集正确',
      dec.cause === 'path-and-blob-drift' &&
        dec.paths === true &&
        dec.blobs === true &&
        dec.missing.includes('scripts/lib/b.mjs') &&
        dec.extra.includes('scripts/lib/c.mjs'),
      JSON.stringify(dec),
    )
  }

  // ST55 missing/extra/issuedPaths/actualPaths：报告逐条点名路径就靠这四个字段。
  // 为什么正确：集合必须归一化、去重、排序——同一路径的 `\` 写法与 `./` 写法不归一，报告就会把
  // 一条路径点成两条，作者照着去查会查错文件；去重则避免同一路径报两次掩盖真正的 missing。
  {
    const dec = decomposeSigMismatch(
      { subject: 'S', paths: ['scripts\\lib\\b.mjs', './scripts/lib/a.mjs', 'scripts/lib/a.mjs'] },
      { subject: 'S', paths: ['scripts/lib/a.mjs', 'scripts/lib/c.mjs'] },
    )
    ok(
      'ST55 逐格字段：issuedPaths/actualPaths 归一化去重排序，missing/extra 各自正确',
      JSON.stringify(dec.issuedPaths) ===
        JSON.stringify(['scripts/lib/a.mjs', 'scripts/lib/b.mjs']) &&
        JSON.stringify(dec.actualPaths) ===
          JSON.stringify(['scripts/lib/a.mjs', 'scripts/lib/c.mjs']) &&
        JSON.stringify(dec.missing) === JSON.stringify(['scripts/lib/b.mjs']) &&
        JSON.stringify(dec.extra) === JSON.stringify(['scripts/lib/c.mjs']) &&
        dec.cause === 'message-from-other-commit',
      JSON.stringify(dec),
    )
  }

  // ST56 normalizeRel 直接断言：Windows 侧拼路径会带 `\` 或 `./`，不归一化 ⇒ 同一路径两种写法被当成两条。
  // 为什么正确：判定与载荷拼装都按字符串相等比路径；归一化必须幂等，且空串保持空
  //（调用方用空串表示"这一面取不到该路径"，不能被变成 '.' 之类）。
  {
    const cases = [
      ['scripts\\lib\\x.mjs', 'scripts/lib/x.mjs'],
      ['./scripts/x.mjs', 'scripts/x.mjs'],
      ['scripts/lib/x.mjs', 'scripts/lib/x.mjs'],
      ['', ''],
    ]
    ok(
      'ST56 normalizeRel：反斜杠/前导 ./ 归一且幂等，空串保持空',
      cases.every(([raw, want]) => normalizeRel(raw) === want) &&
        normalizeRel(normalizeRel('scripts\\lib\\x.mjs')) === normalizeRel('scripts\\lib\\x.mjs') &&
        normalizeRel('') === '',
      JSON.stringify(cases.map(([raw]) => [raw, normalizeRel(raw)])),
    )
  }

  // ST45 自认：a2 追认行拿**提交签名钥**签（同一把）⇒ 不算他方追认，红不变。
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: silent self ack')
    const sha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const rows = [
      ackRowFor(sha, ['scripts/lib/face-reader.mjs'], '作者拿自己的提交钥给自己补一行', {
        key: ST_KEY,
      }),
    ]
    const out = audit(root, 'head', { key: ST_KEY, ackRows: rows, ackKey: ST_KEY })
    ok(
      'ST45 追认钥 == 提交签名钥 ⇒ 仍 exit 1 且点名 ack-self-key（自认不等于他方追认）',
      out.exit === 1 && out.code === 'undeclared' && out.ack && out.ack.code === 'ack-self-key',
      JSON.stringify({ exit: out.exit, code: out.code, ack: out.ack && out.ack.code }),
    )
  })

  // ST46 缺独立追认钥 ⇒ fail-closed（绝不拿提交钥顶替，也绝不"没钥就放行"）。
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: silent missing ack key')
    const sha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const rows = [ackRowFor(sha, ['scripts/lib/face-reader.mjs'])]
    const out = audit(root, 'head', { key: ST_KEY, ackRows: rows, ackKey: null })
    ok(
      'ST46 独立追认钥不可得 ⇒ 仍 exit 1 且点名 ack-key-unavailable（fail-closed）',
      out.exit === 1 &&
        out.code === 'undeclared' &&
        out.ack &&
        out.ack.code === 'ack-key-unavailable',
      JSON.stringify({ exit: out.exit, code: out.code, ack: out.ack && out.ack.code }),
    )
  })

  // ST47 a1 旧行只对 origin/main 已入库枚保留：本地枚（scratch 仓）一律拒——
  // 这一条是"作者自签一行洗白本地红"那条洞的封口。
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: silent legacy a1')
    const sha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const legacy = {
      sha,
      paths: ['scripts/lib/face-reader.mjs'],
      reason: '旧 a1 自认行，本地枚不得再靠它洗白',
      ackedBy: 'self',
      ackedAt: '2026-11-04T00:00:00.000Z',
      expires: '2099-01-01',
      sig: `a1:${'0'.repeat(64)}`,
    }
    const out = audit(root, 'head', { key: ST_KEY, ackRows: [legacy] })
    ok(
      'ST47 本地枚 + a1 旧行 ⇒ 仍 exit 1 且点名 ack-legacy-retired（a1 只留 origin/main）',
      out.exit === 1 &&
        out.code === 'undeclared' &&
        out.ack &&
        out.ack.code === 'ack-legacy-retired',
      JSON.stringify({ exit: out.exit, code: out.code, ack: out.ack && out.ack.code }),
    )
  })

  // ST48 署名被改 ⇒ a2 签名必验不过（ackedBy 在载荷里，不再是一句自由文本）。
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: ackedBy tamper')
    const sha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const row = ackRowFor(sha, ['scripts/lib/face-reader.mjs'], '签名后把署名改成别人不算数', {
      ackedBy: '作者本人',
    })
    const tampered = { ...row, ackedBy: '独立复核人' }
    const out = audit(root, 'head', { key: ST_KEY, ackRows: [tampered] })
    ok(
      'ST48 改 ackedBy 而签名不变 ⇒ exit 1 / ack-sig-invalid（署名已签进载荷）',
      out.exit === 1 && out.code === 'undeclared' && out.ack && out.ack.code === 'ack-sig-invalid',
      JSON.stringify({ exit: out.exit, code: out.code, ack: out.ack && out.ack.code }),
    )
  })

  // ST49 整批元信息通道(batchCommitMeta)不得改变任何一次判定:
  // ① 拿到的 parentCount/subject/message 必须与逐枚 gitRaw 读回的逐字一致;
  // ② 同一枚提交,注入 message 与让 runAudit 自己读 message ⇒ 归桶码必须相同。
  // 立因:这一档只为削派生而存在(实测 --range HEAD~30..HEAD 86.6s→72.2s)。派生可以省,判定一枚都不许多省或少省。
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// one\n')
    commitAll(root, 'refactor: 批档一致性第一枚')
    const sha1 = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    writeIn(root, 'scripts/lib/face-reader.mjs', '// two\n')
    commitAll(root, 'fix: 批档一致性第二枚\n\n带正文第二行,验证 %B 逐字等值')
    const sha2 = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const metas = batchCommitMeta(root, [sha1, sha2])
    const m1 = metas.get(sha1)
    const m2 = metas.get(sha2)
    ok(
      'ST49a 批档拿到的 parentCount/subject 与逐枚读法逐字一致',
      !!m1 &&
        !!m2 &&
        m1.parentCount === parentCount(root, sha1) &&
        m2.parentCount === parentCount(root, sha2) &&
        m1.subject === String(gitRaw(['log', '-1', '--format=%s', sha1], root)).trim(),
      JSON.stringify({ m1, m2: m2 && { pc: m2.parentCount, sub: m2.subject } }),
    )
    ok(
      'ST49b %B 逐字等值(含正文第二行与尾换行)',
      !!m2 && m2.message === String(gitRaw(['log', '-1', '--format=%B', sha2], root)),
      JSON.stringify({
        batch: m2 && m2.message,
        single: String(gitRaw(['log', '-1', '--format=%B', sha2], root)),
      }),
    )
    const viaBatch = runAudit(root, 'head', { message: m2.message, key: ST_KEY, rev: sha2 })
    const viaSingle = runAudit(root, 'head', { key: ST_KEY, rev: sha2 })
    ok(
      'ST49c 注入正文与自己读正文 ⇒ 归桶码逐字相同(等价性锁)',
      viaBatch.code === viaSingle.code && viaBatch.exit === viaSingle.exit,
      JSON.stringify({ viaBatch: viaBatch.code, viaSingle: viaSingle.code }),
    )
    const blind = batchCommitMeta(root, ['0000000000000000000000000000000000000000'])
    ok(
      'ST49d 批档对不上的 sha 不进表(调用处因此逐枚回落,而不是当成"父辈 0 / 无正文")',
      blind.size === 0,
      `size=${blind.size}`,
    )
  })

  // ST57 RP-92 三张批表(清单正文 / 差异集 / origin/main 成员集)不得改变任何一次判定。
  // 立因(当次实测):推送门判 origin/main..HEAD(现读 147 枚)要 400 秒级,而它挂在 300 秒
  // 看门狗下面 ⇒ 那道"专抓未声明改判据面"的审计在推送时被悄悄砍掉(§0.9 没跑=没有)。
  // 批档把每枚 3~5 次派生收成整批常数级;省的是派生,一枚判定都不许多省或少省。
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// r1\n')
    commitAll(root, 'chore: 批表对照第一枚')
    const shaRoot = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    writeIn(root, 'docs/中文路径.md', '# 中文名\n')
    commitAll(root, 'docs: 中文路径')
    const shaCjk = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    gitRaw(['mv', 'docs/中文路径.md', 'docs/renamed.md'], root)
    commitAll(root, 'chore: 改名')
    const shaRename = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    gitRaw(['rm', '-q', 'docs/x.md'], root)
    commitAll(root, 'chore: 删除')
    const shaDelete = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    // 零改动枚要显式 allow-empty:这一档正是"批表里空数组与缺席不可混"的那一格。
    gitRaw(['commit', '--no-verify', '--allow-empty', '-F', '-'], root, {
      input: 'chore: 空改动枚',
    })
    const shaEmpty = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const shas = [shaRoot, shaCjk, shaRename, shaDelete, shaEmpty]
    const table = batchFaceChanges(root, shas)
    let diffCount = 0
    for (const sha of shas) {
      if (parentCount(root, sha) === 0) continue
      const one = listFaceChanges(root, 'head', sha)
      const got = table.get(sha)
      if (!got || JSON.stringify(got) !== JSON.stringify(one)) diffCount += 1
    }
    ok(
      'ST57a 批量差异集与逐枚 `diff rev^ rev` 逐字等值(新增/中文名/改名/删除/空改动各一枚)',
      diffCount === 0 && table.size === shas.length,
      JSON.stringify({
        diffCount,
        tableSize: table.size,
        rename: table.get(shaRename),
        empty: table.get(shaEmpty),
      }),
    )
    ok(
      'ST57b 分帧对不上 ⇒ 整批作废空表(调用处逐枚回落,不拿"读不到"当"没改动")',
      batchFaceChanges(root, ['0000000000000000000000000000000000000000']).size === 0,
      `size=${batchFaceChanges(root, ['0000000000000000000000000000000000000000']).size}`,
    )
    // 根提交是批表唯一已知不等价处:git log 无父可差 ⇒ 吐空;逐枚档 `rev^` 失败 ⇒ face-missing。
    // 排除条挂在 parentCount==0 上,这里把"两条读数确实不同"钉住 —— 否则那格排除只是注释。
    // 取真正的根提交:`rev-list --max-parents=0`(夹具基线提交之上还有 seedRepo 那一枚,
    // 拿"本组第一枚"当根提交会测到 parentCount==1,那条排除就白测了)。
    const trueRoot = String(gitRaw(['rev-list', '--max-parents=0', 'HEAD'], root))
      .trim()
      .split(/\r?\n/)[0]
    const rootPc = parentCount(root, trueRoot)
    const viaTable = runAudit(root, 'head', {
      rev: trueRoot,
      message: 'chore: 批表对照',
      key: ST_KEY,
      changesPre: [],
    })
    const viaSingle = runAudit(root, 'head', { rev: trueRoot, message: '', key: ST_KEY })
    ok(
      'ST57c 根提交不吃批表:parents==0 且批表读数(untouched)≠逐枚读数(face-missing) ⇒ 排除条有牙',
      rootPc === 0 && viaSingle.code === 'face-missing' && viaTable.code !== 'face-missing',
      JSON.stringify({ rootPc, viaTable: viaTable.code, viaSingle: viaSingle.code }),
    )
    const jbRoot = judgeBatch(root, [trueRoot, shaEmpty])
    ok(
      'ST57h 批表接线处真跳过根提交:judgeBatch 把根枚落 undetermined/face-missing,不读成"没改判据面"',
      jbRoot.judged === 2 &&
        jbRoot.undetermined.some((u) => u.sha === trueRoot && u.code === 'face-missing'),
      JSON.stringify({
        judged: jbRoot.judged,
        undetermined: jbRoot.undetermined.map((u) => `${String(u.sha).slice(0, 8)}:${u.code}`),
      }),
    )
    const texts = batchFaceTexts(
      root,
      shas
        .map((s) => `${s}:${GUARD_DATA_REL}`)
        .concat(['deadbeefdeadbeefdeadbeefdeadbeefdeadbeef:scripts/data/immutable-guard.json']),
    )
    let textMismatch = 0
    for (const sha of shas) {
      const got = texts?.get(`${sha}:${GUARD_DATA_REL}`)
      if (got !== readFaceText(root, 'head', GUARD_DATA_REL, sha)) textMismatch += 1
    }
    ok(
      'ST57d 批量清单正文与逐枚 readFaceText 逐字等值,missing 归 null 不归空串',
      textMismatch === 0 &&
        !!texts &&
        texts.get('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef:scripts/data/immutable-guard.json') ===
          null,
      JSON.stringify({ textMismatch, missing: texts && texts.get('x') }),
    )
    const blobsBatch = blobMapFor(root, 'head', shaCjk, ['docs/中文路径.md', 'docs/不存在.md'])
    ok(
      'ST57e 命中路径内容号一次批量解:在面 ⇒ 40 位,不在面 ⇒ 空串(与逐枚档同形)',
      /^[0-9a-f]{40}$/.test(blobsBatch['docs/中文路径.md'] ?? '') &&
        blobsBatch['docs/不存在.md'] === '',
      JSON.stringify(blobsBatch),
    )
    // origin/main 成员集与逐枚 merge-base 必须同答;ref 取不到 ⇒ null ⇒ 逐枚回落(不折成"全是本地枚")。
    try {
      gitRaw(['fetch', '-q', '.', `+${shaCjk}:refs/remotes/origin/main`], root)
      const set = originMainMembership(root)
      const tipSha = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
      ok(
        'ST57f origin/main 成员集 == 逐枚 merge-base;区间外的枚不在集内',
        !!set &&
          set.has(shaRoot) === isOnOriginMain(root, shaRoot) &&
          set.has(shaCjk) === isOnOriginMain(root, shaCjk) &&
          set.has(tipSha) === false &&
          isOnOriginMain(root, tipSha) === false,
        JSON.stringify({ set: set && [...set].length, tipIn: set && set.has(tipSha) }),
      )
      ok(
        'ST57g ref 取不到 ⇒ 成员集 null(不返回空集把已入库枚说成本地枚)',
        originMainMembership(root, 'refs/remotes/origin/不存在') === null,
        String(originMainMembership(root, 'refs/remotes/origin/不存在')),
      )
    } catch (e) {
      ok('ST57f/g 夹具建 origin/main 失败 ⇒ 该组判不了(不记绿)', false, String(e?.message ?? e))
    }
  })

  const failed = cases.filter((c) => !c.ok)
  for (const c of cases) {
    console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.ok ? '' : ` —— ${c.detail}`}`)
  }
  console.log(`[immutable-guard:self-test] ${cases.length - failed.length}/${cases.length} 通过`)
  return { total: cases.length, passed: cases.length - failed.length, failed: failed.length, cases }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgv(argv) {
  const opts = {
    staged: false,
    worktree: false,
    auditNew: false,
    signStaged: false,
    ack: null,
    by: null,
    expires: null,
    range: null,
    subject: null,
    reason: null,
    paths: [],
    limit: AUDIT_BATCH_DEFAULT,
    message: undefined,
    messageFile: null,
    json: false,
    record: false,
    selfTest: false,
    root: ROOT,
    today: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--staged') opts.staged = true
    else if (a === '--worktree') opts.worktree = true
    else if (a === '--audit-new') opts.auditNew = true
    else if (a === '--sign-staged') opts.signStaged = true
    else if (a === '--ack') opts.ack = argv[++i]
    else if (a === '--by') opts.by = argv[++i]
    else if (a === '--expires') opts.expires = argv[++i]
    else if (a === '--range') opts.range = argv[++i]
    else if (a === '--subject') opts.subject = argv[++i]
    else if (a === '--reason') opts.reason = argv[++i]
    else if (a === '--paths') {
      const raw = String(argv[++i] ?? '')
      opts.paths = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (a === '--limit') {
      const n = Number.parseInt(String(argv[++i]), 10)
      if (!Number.isFinite(n) || n <= 0) throw new Error(`--limit 必须是正整数，收到：${argv[i]}`)
      opts.limit = n
    } else if (a === '--json') opts.json = true
    else if (a === '--record') opts.record = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--message-file') opts.messageFile = argv[++i]
    else if (a === '--message') opts.message = argv[++i]
    else if (a === '--root') opts.root = argv[++i]
    else if (a === '--today') opts.today = argv[++i]
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`未知参数：${a}（--help 看用法）`)
  }
  return opts
}

const USAGE = [
  '用法: node scripts/check-immutable-guard.mjs [--staged|--worktree|--audit-new|--range <a..b>] [--message-file <f>|--message <s>] [--json] [--record] [--root <仓根>] [--today <YYYY-MM-DD>]',
  '      node scripts/check-immutable-guard.mjs --audit-new [--limit 50] [--record]   # 巡检轮档（游标之后每枚判一次）',
  '      node scripts/check-immutable-guard.mjs --range origin/main..HEAD            # push 门档（逐枚判"本次要推的"）',
  '      node scripts/check-immutable-guard.mjs --ack <40位sha> --reason "<≥10字>" --by <席位> --expires <YYYY-MM-DD>  # 事后追认一档（详见 ACK 段）',
  '      node scripts/check-immutable-guard.mjs --sign-staged --subject "<提交标题>" --reason "<理由>" [--paths <a,b,c>]  # 生成签名行（stdout 可直接贴进提交信息）',
  '      node scripts/check-immutable-guard.mjs --self-test',
  '',
  `受保护面清单: ${GUARD_DATA_REL}；合法改法: 提交信息里两行 —— \`${EXEMPT_TRAILER} <≥${MIN_REASON_CHARS} 字理由>\` + \`${SIG_TRAILER} ${SIG_VERSION_CURRENT}:<base40>:<hex>\``,
  `签名密钥来源（按优先级）: ${KEY_ENV} / ${KEY_FILE_ENV} / git config ${KEY_CONFIG}（密钥不存在 ⇒ 需要验签的一律 fail-closed 判未豁免）`,
  `独立追认密钥来源（与上一行必须是两把钥，同一把 ⇒ 判 ack-self-key 自认不成立）: ${ACK_KEY_ENV} / ${ACK_KEY_FILE_ENV} / git config ${ACK_KEY_CONFIG}`,
  `迁移窗口: ${GUARD_DATA_REL} 的 ${SIGNATURE_REQUIRED_KEY}；窗口内仅文字理由 ⇒ 放行并记 ${UNSIGNED_LEDGER_REL}，到期后必须有验得过的签名`,
  `巡检游标: ${CURSOR_REL}（派发点 = scripts/git-guardian.mjs 的 auditImmutableGuardNewCommits）`,
].join('\n')

/**
 * 签发助手（`--sign-staged`）：只对**点名的 staged 路径**算命中面，避免把别席暂存条目
 * 一起签进 payload（那样审计侧按提交 diff 重算会验不过）。密钥走同一套 `resolveSigningKey`。
 */
export function signStaged(root, { subject, reason, paths = [], today = todayStr() } = {}) {
  if (!subject || !String(subject).trim())
    throw new Error('--subject 必填（必须与最终提交标题一字不差）')
  if (!reason || String(reason).trim() === '') throw new Error('--reason 必填')
  const args = ['diff', '--cached', '--name-status', '-M', '-z']
  if (paths.length) args.push('--', ...paths)
  const changes = parseNameStatusZ(gitRaw(args, root))
  const parsed = parseGuardList(readFileSync(path.join(root, GUARD_DATA_REL), 'utf8'), { today })
  if (parsed.problems.length)
    throw new Error(`清单形状坏，先修清单：${parsed.problems.map((p) => p.message).join('；')}`)
  const judged = judgeChanges({ changes, entries: parsed.entries, message: '', today })
  if (!judged.hits.length) throw new Error('指定路径里没有命中受保护面 ⇒ 无需签名（不签空集）')
  const keyRes = resolveSigningKey(root)
  if (!keyRes.key) throw new Error(keyRes.why)
  // v2：把取数面钉在**签发这一刻的 HEAD**，并把每条命中路径的内容号写进载荷。
  // 签发之后别席推进 HEAD 不会再让路径集漂移；同一路径换了内容也验不过。
  const base = String(gitRaw(['rev-parse', 'HEAD'], root))
    .trim()
    .toLowerCase()
  if (!FULL_SHA_RE.test(base))
    throw new Error(`upstream HEAD 解析不到全量 sha：${base.slice(0, 20)}`)
  const blobs = blobMapFor(
    root,
    'staged',
    'HEAD',
    judged.hits.map((h) => h.path),
  )
  const sig = signExemptionV2({ subject, hits: judged.hits, blobs, reason, key: keyRes.key, base })
  return {
    sig,
    base,
    blobs,
    hits: judged.hits.map((h) => `${h.path}（${h.entry.kind} / ${h.status}）`),
    keySource: keyRes.source,
    // 留痕这一刻就把"签给了哪个标题/哪批路径/哪个 base/哪份内容"钉住;将来验不过时直接摊开对照,
    // 免得作者面对 sig-invalid 去补理由(错方向)或跳门(更错)。
    recorded: recordSigIssue(root, {
      subject,
      paths: judged.hits.map((h) => h.path),
      reason,
      sig,
      base,
      blobs,
    }),
  }
}

/**
 * 追认签发（2026-11-04 立）。写一行台账 = 给一枚**已入库**提交补发说明，所以每一道都往严里判：
 *  - sha 必须 40 位全量且在仓里解析得到（短写、不存在的枚、非 commit 对象一律拒）；
 *  - 命中面由护栏自己算，调用方不能自己挑几个面"部分追认"；
 *  - 那枚当下必须是**被判红**的状态（`undeclared` / `undeclared-unsigned`）才准追认：
 *    已经合规的枚不需要第二道出口，判不动的枚更不许签（不签判不动的东西）；
 *  - 无密钥 ⇒ 拒（fail-closed，绝不写一条没人验得动的行冒充已追认）；
 *  - `expires` 必填且晚于今天：追认不是终身赦免，到期即回到红（§0.7 豁免必须会到期）。
 */
export function ackCommit(root, { sha, reason, by, expires, today = todayStr() } = {}) {
  if (!FULL_SHA_RE.test(String(sha ?? '')))
    throw new Error(
      `--ack 必须是 40 位全量 sha（证据指针禁短写）：收到 ${String(sha ?? '').slice(0, 20)}`,
    )
  if (!reason || [...String(reason).trim()].length < MIN_REASON_CHARS)
    throw new Error(`--reason 必填且不短于 ${MIN_REASON_CHARS} 字`)
  if (!by || !String(by).trim()) throw new Error('--by 必填（补发说明的席位/人名 ⇒ 追责从这里起）')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(expires ?? '')))
    throw new Error(
      `--expires 必须是 YYYY-MM-DD（追认必须会到期）：收到 ${String(expires ?? '').slice(0, 20)}`,
    )
  if (String(expires) <= today)
    throw new Error(`--expires(${expires}) 不得早于或等于本次判定期(${today})`)
  let type = ''
  try {
    type = String(gitRaw(['cat-file', '-t', sha], root)).trim()
  } catch (e) {
    throw new Error(`sha 在仓里解析不到：${sha} —— ${e?.message ?? e}`)
  }
  if (type !== 'commit') throw new Error(`${sha} 不是 commit 对象（${type || '空'}）⇒ 不追认`)
  const one = runAudit(root, 'head', { rev: sha, today })
  if (one.exit === 0) throw new Error(`那枚本判就通过（code=${one.code}）⇒ 没有需要追认的东西`)
  if (one.exit === 2)
    throw new Error(
      `那枚判不了（code=${one.code}：${one.detail || '无明细'}）⇒ 先修判定输入，不签判不动的追认`,
    )
  if (!one.hits.length) throw new Error('那枚没触及任何受保护面 ⇒ 无需追认（不追空集）')
  const ackKeyRes = resolveAckKey(root)
  if (!ackKeyRes.key) throw new Error(`独立追认密钥不可得 ⇒ 拒签（${ackKeyRes.why}）`)
  const submitKeyRes = resolveSigningKey(root)
  if (submitKeyRes.key && submitKeyRes.key === ackKeyRes.key) {
    throw new Error('追认密钥与提交签名密钥是同一把 ⇒ 作者自认不算他方追认（请改用独立追认钥）')
  }
  const paths = one.hits.map((h) => h.path)
  const row = {
    sha,
    paths,
    reason: String(reason).trim(),
    ackedBy: String(by).trim(),
    ackedAt: new Date().toISOString(),
    expires: String(expires),
    sig: signAck({ sha, paths, reason, ackedBy: String(by).trim(), key: ackKeyRes.key }),
  }
  const file = path.join(root, ACK_LEDGER_REL)
  const line = `${JSON.stringify(row)}\n`
  mkdirSync(path.dirname(file), { recursive: true })
  appendFileSync(file, line, 'utf8')
  return { row, line: line.trimEnd(), paths, keySource: ackKeyRes.source, file: ACK_LEDGER_REL }
}

export function main(argv = process.argv.slice(2)) {
  let opts
  try {
    opts = parseArgv(argv)
  } catch (e) {
    console.error(`❌ ${e.message}`)
    return 2
  }
  if (opts.help) {
    console.log(USAGE)
    return 0
  }
  if (opts.selfTest) {
    const r = selfTest()
    return r.failed === 0 ? 0 : 1
  }
  if (process.env[SELF_SKIP] === '1') {
    console.log(
      `⚠️ [immutable-guard] 应急跳过：${SELF_SKIP}=1（本次不判定；跳门留痕由 safe-commit attestation 负责）`,
    )
    return 0
  }
  if (opts.signStaged && (opts.staged || opts.worktree || opts.auditNew || opts.range)) {
    console.error(
      '❌ --sign-staged 只对 staged 面签发，不得与 --staged/--worktree/--audit-new/--range 同用',
    )
    return 2
  }
  if (
    opts.ack !== null &&
    (opts.staged || opts.worktree || opts.auditNew || opts.range || opts.signStaged)
  ) {
    console.error(
      '❌ --ack 只针对**已入库的那一枚**签发追认，不得与判定档或 --sign-staged 同用（同用=两件事挤一条命令，读数必然含混）',
    )
    return 2
  }
  if (opts.range && (opts.staged || opts.worktree || opts.auditNew)) {
    console.error(
      '❌ --range 走显式区间（push 门专用），不得与 --staged/--worktree/--audit-new 同用',
    )
    return 2
  }
  if (opts.signStaged) {
    let r
    try {
      r = signStaged(opts.root, {
        subject: opts.subject,
        reason: opts.reason,
        paths: opts.paths,
        ...(opts.today ? { today: opts.today } : {}),
      })
    } catch (e) {
      console.error(`❌ 签发失败：${e?.message ?? e}`)
      return 2
    }
    // 说明走 stderr，stdout 只留可直接贴进提交信息的两行。
    console.error(`# 已签 ${r.hits.length} 条命中面，密钥来源：${r.keySource}`)
    for (const h of r.hits) console.error(`# 命中：${h}`)
    console.log(`${EXEMPT_TRAILER} ${String(opts.reason).trim()}`)
    console.log(`${SIG_TRAILER} ${r.sig}`)
    return 0
  }
  if (opts.ack !== null) {
    let r
    try {
      r = ackCommit(opts.root, {
        sha: opts.ack,
        reason: opts.reason,
        by: opts.by,
        expires: opts.expires,
        ...(opts.today ? { today: opts.today } : {}),
      })
    } catch (e) {
      console.error(`❌ 追认失败：${e?.message ?? e}`)
      return 2
    }
    console.error(`# 已追认 ${r.paths.length} 条命中面，密钥来源：${r.keySource}`)
    for (const p of r.paths) console.error(`# 命中：${p}`)
    console.log(r.line)
    console.error(
      `# 台账已追加一行 → ${r.file}（工作树）。⚠️ 台账本身登记在受保护面上：把这一行提交进仓的那枚，自己也要带 immutable-exempt 声明。`,
    )
    return 0
  }
  if (opts.range) {
    let out
    try {
      out = auditRange(opts.root, {
        range: opts.range,
        record: opts.record,
        ...(opts.today ? { today: opts.today } : {}),
      })
    } catch (e) {
      console.error(`❌ 未判定：${e?.message ?? e}`)
      return 2
    }
    if (opts.json) console.log(JSON.stringify(out, null, 2))
    else console.log(formatAuditReport(out))
    return out.exit
  }
  if (opts.staged && opts.worktree) {
    console.error('❌ --staged 与 --worktree 不得同用（两个判定面互斥）')
    return 2
  }
  if (opts.auditNew && (opts.staged || opts.worktree)) {
    console.error(
      '❌ --audit-new 走自己的面（每枚提交自己那一轮），不得与 --staged/--worktree 同用',
    )
    return 2
  }
  if (opts.auditNew) {
    let out
    try {
      out = auditNewCommits(opts.root, {
        limit: opts.limit,
        record: opts.record,
        ...(opts.today ? { today: opts.today } : {}),
      })
    } catch (e) {
      console.error(`❌ 未判定：${e?.message ?? e}`)
      return 2
    }
    if (opts.json) console.log(JSON.stringify(out, null, 2))
    else console.log(formatAuditReport(out))
    return out.exit
  }
  const picked = selectFace({ staged: opts.staged, worktree: opts.worktree, def: 'head' })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return 2
  }
  let message
  if (opts.messageFile) {
    try {
      message = readFileSync(path.resolve(opts.messageFile), 'utf8')
    } catch (e) {
      console.error(`❌ 未判定：提交信息文件取不到（${opts.messageFile}）：${e?.message ?? e}`)
      return 2
    }
  } else if (opts.message !== undefined) {
    message = opts.message
  }
  let out
  try {
    out = runAudit(opts.root, picked.face, {
      message,
      record: opts.record,
      ...(opts.today ? { today: opts.today } : {}),
    })
  } catch (e) {
    console.error(`❌ 未判定：${e?.message ?? e}`)
    return 2
  }
  if (opts.json) console.log(JSON.stringify(out, null, 2))
  else console.log(formatReport(out))
  return out.exit
}

// §22d isDirectRun：被镜像测试 import 时不得跑 CLI 主流程。
// Windows 反斜杠必须经 pathToFileURL 归一，裸拼 file:// 永不成立。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  SELF_SKIP,
  RECORD_REL,
  CURSOR_REL,
  AUDIT_BATCH_DEFAULT,
  ROOT,
  readFaceText,
  listFaceChanges,
  runAudit,
  recordExemption,
  formatReport,
  readCursorText,
  writeCursor,
  isAncestor,
  auditNewCommits,
  auditRange,
  // 批表通道(RP-92):镜像测试 import 这些本体,禁止复制判据(§22c)
  judgeBatch,
  batchCommitMeta,
  batchFaceChanges,
  batchFaceTexts,
  originMainMembership,
  blobMapFor,
  parentCount,
  isOnOriginMain,
  signStaged,
  ackCommit,
  readAckRows,
  resolveSigningKey,
  formatAuditReport,
  selfTest,
  parseArgv,
  seedRepo,
  commitAll,
  writeIn,
  realGuardJson,
  // 判据本体从 lib 透出（§22c：镜像测试 import 生产判据，禁止复制常量）
  EXEMPT_TRAILER,
  MIN_REASON_CHARS,
  GUARD_DATA_REL,
  parseGuardList,
  parseNameStatusZ,
  parseExemptTrailer,
  probeEntry,
  matchProtected,
  globToRegExp,
  decide,
  // 签名豁免（2026-11-04 立；v2 钉 base + blob 2026-11-04 同日补）
  SIG_TRAILER,
  SIG_VERSION,
  SIG_VERSION_V2,
  SIG_VERSION_CURRENT,
  sigBaseOf,
  MIN_KEY_CHARS,
  SIGNATURE_REQUIRED_KEY,
  UNSIGNED_LEDGER_REL,
  KEY_ENV,
  KEY_FILE_ENV,
  KEY_CONFIG,
  signExemption,
  signExemptionV2,
  verifyExemption,
  subjectOf,
  parseSigTrailer,
  exemptPayload,
  exemptPayloadV2,
  // 取数面钉定（v2）：按签名自己的 base 重放 + 命中路径内容号
  stagedHitsAt,
  blobMapFor,
  decomposeSigMismatch,
  // 2026-11-04 补测：签发台账与路径归一化（此前只有间接执行，无针对性断言）
  recordSigIssue,
  normalizeRel,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
