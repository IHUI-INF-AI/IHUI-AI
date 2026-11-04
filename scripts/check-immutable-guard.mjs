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
 * 逼人 `--no-verify`，§12e）也不能记绿（那等于没有护栏）。所以本门**刻意不进提交链**：
 * 守门执行器 `lib/guardian-executor.mjs` 对注册条目**无条件追加 `--staged`**（现读
 * `const cmdArgs = [...check.args]` + `if (passStaged) cmdArgs.push('--staged')`），而
 * `--staged` 档在本门里结构上没有消息来源 ⇒ 只要提交触及受保护面就 exit 2 ⇒ 按 §12e
 * 那正是一道恒堵门。要把它升成阻断档，前置 = 挂点换到 **commit-msg**（此时 `$1` 就是
 * 本次消息文件）且执行器要能按门给面参数，两件事都不在本席射程内（热档只读）。
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
  subjectOf,
  todayStr,
  verifyExemption,
  judgeChanges,
  exemptPayload,
} from './lib/immutable-guard.mjs'
import { FACES, Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

/** 仓根由脚本自身位置推导，禁 `process.cwd()`（§15：共享工作区 cwd 不可靠）。 */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 同仓既有惯例：本门自己的应急放行变量（门体自身也读它，手动复跑同样生效）。 */
export const SELF_SKIP = 'HUSKY_SKIP_IMMUTABLE_GUARD'

/** 豁免留痕（§0.7）：`--record` 时逐条追加，落在 gitignored 的 state 目录。 */
export const RECORD_REL = '.ihui-agent/state/immutable-guard-exemptions.jsonl'

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
 * 解析验签密钥。返回 `{key, source, why}`；`key === null` 表示"取不到可用密钥"。
 * 只回传来源**标签**，绝不把密钥本身写进任何输出（台账/JSON/告警都不带它）。
 */
export function resolveSigningKey(root, env = process.env) {
  const accept = (raw, source) => {
    const k = String(raw ?? '').trim()
    if (k.length < MIN_KEY_CHARS) {
      return { key: null, source, why: `${source} 提供的密钥长度 ${k.length} < ${MIN_KEY_CHARS}（按无效密钥处理）` }
    }
    return { key: k, source, why: '' }
  }
  const direct = String(env[KEY_ENV] ?? '').trim()
  if (direct) return accept(direct, KEY_ENV)
  const fromFile = (file, source) => {
    try {
      const abs = path.isAbsolute(file) ? file : path.join(root, file)
      return accept(readFileSync(abs, 'utf8'), `${source}:${file}`)
    } catch (e) {
      return { key: null, source, why: `${source} 指向的密钥文件读不到（${file}）：${e?.message ?? e}` }
    }
  }
  const envFile = String(env[KEY_FILE_ENV] ?? '').trim()
  if (envFile) return fromFile(envFile, KEY_FILE_ENV)
  let configured = ''
  try {
    configured = String(gitRaw(['config', '--get', KEY_CONFIG], root)).trim()
  } catch {
    configured = ''
  }
  if (configured) return fromFile(configured, `git config ${KEY_CONFIG}`)
  return {
    key: null,
    source: '',
    why: `密钥不存在（${KEY_ENV} / ${KEY_FILE_ENV} / git config ${KEY_CONFIG} 均未提供 ⇒ 按无签名 fail-closed 处理）`,
  }
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
  if (!FACES.includes(face)) throw new Undetermined(`未知判定面 ${String(face)}（只认 ${FACES.join(' / ')}）`)
  if (face === 'worktree') return readWorktreeFile(root, rel)
  const key = face === 'staged' ? `:${rel}` : `${rev}:${rel}`
  const got = catBatch(root, [key])
  return got.get(key) ?? null
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
 */
export function runAudit(root, face, { message = undefined, today = todayStr(), record = false, rev = 'HEAD', key = undefined } = {}) {
  const keyRes =
    key === undefined
      ? resolveSigningKey(root)
      : key === null
        ? { key: null, source: '', why: '密钥不存在（调用方显式置空 ⇒ 按 fail-closed 处理）' }
        : { key: String(key), source: 'caller', why: '' }
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
    keySource: keyRes.source,
    keyWhy: keyRes.key ? '' : keyRes.why,
    expired: [],
    listProblems: [],
    detail: '',
  }
  let listText
  try {
    listText = readFaceText(root, face, GUARD_DATA_REL, rev)
  } catch (e) {
    if (e instanceof Undetermined) return { ...baseOut, detail: e.message, code: 'list-missing' }
    throw e
  }
  if (listText === null) {
    return { ...baseOut, code: 'list-missing', detail: `受保护面清单在 ${rev} 面不存在：${GUARD_DATA_REL}` }
  }
  const parsed = parseGuardList(listText, { today })
  if (parsed.problems.length) {
    return {
      ...baseOut,
      exit: 2,
      code: 'list-bad',
      entryCount: parsed.entries.length,
      listProblems: parsed.problems,
    }
  }

  let changes
  try {
    changes = listFaceChanges(root, face, rev)
  } catch (e) {
    if (e instanceof Undetermined) return { ...baseOut, entryCount: parsed.entries.length, code: 'face-missing', detail: e.message }
    throw e
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

  const out = decide({
    listProblems: parsed.problems,
    entries: parsed.entries,
    changes,
    message: msg,
    today,
    key: keyRes.key,
    signatureRequiredFrom: parsed.signatureRequiredFrom,
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
        hits: (result.hits ?? []).map((h) => ({ path: h.path, kind: h.entry.kind, status: h.status })),
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
      for (const h of out.hits) lines.push(`   - 已声明改动：${h.path}（${h.entry.kind} / ${h.status}）`)
    }
    if (out.code === 'declared-unsigned') {
      lines.push(`   ⚠️ 无签名豁免（迁移窗口内，签名要求自 ${out.signatureRequiredFrom} 起生效）：`)
      for (const r of out.exempt.reasons) lines.push(`      理由：${r.reason}`)
      for (const h of out.hits) lines.push(`      - ${h.path}（${h.entry.kind} / ${h.status}）`)
      lines.push(`      签名状态：${out.signature.code}；密钥来源：${out.keySource || '(无)'}`)
      if (out.keyWhy) lines.push(`      密钥：${out.keyWhy}`)
      lines.push(`      已记台账：${out.unsignedRecorded || UNSIGNED_LEDGER_REL}`)
      lines.push(`      补签：${SIG_TRAILER} ${SIG_VERSION}:<hex>（签发命令见 --help 的 --sign-staged）`)
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
      lines.push(`   签名状态：${out.signature.code}${out.keySource ? `；密钥来源：${out.keySource}` : ''}`)
      if (out.keyWhy) lines.push(`   密钥：${out.keyWhy}`)
      lines.push(
        `   为什么判红：迁移窗口已于 ${out.signatureRequiredFrom ?? '(未设置)'} 到期 —— 仅文字理由不再放行，必须补 ${SIG_TRAILER} ${SIG_VERSION}:<hex> 签名。`,
      )
      lines.push(
        `   怎么合法改：先 \`node scripts/check-immutable-guard.mjs --sign-staged --subject "<提交标题>" --reason "<与 immutable-exempt 同一句理由>" [--paths <a,b,c>]\` 生成签名行，再提交；密钥须由 CI/机主注入（${KEY_ENV} 或 git config ${KEY_CONFIG}）。`,
      )
    }
    if (out.code === 'expired') {
      for (const e of out.expired) {
        lines.push(`   - ${e.path}（${e.kind}）reviewBy=${e.reviewBy} 已到期：请复核后更新 ${GUARD_DATA_REL}`)
      }
      lines.push('   为什么判红：§0.7 —— 登记必须"验过才免"且会到期，到期不清算 = 清单腐烂。')
    }
  } else {
    lines.push(`❌ 未判定 ${head} ${CODE_LABEL[out.code]}`)
    for (const p of out.listProblems ?? []) lines.push(`   - ${p.message}`)
    if (out.code === 'message-missing') {
      lines.push('   为什么判不了：改动清单能算出来，但提交信息还没有生成 ⇒ 无法判断"有没有声明"。')
      lines.push('   接线位：commit-msg 钩子（以 --message-file "$1" 传入）；pre-commit 阶段结构上还没有消息，勿挂本门。')
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
    return typeof doc?.cursor === 'string' && /^[a-f0-9]{40}$/.test(doc.cursor.trim()) ? doc.cursor.trim() : null
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
    writeFileSync(abs, JSON.stringify({ cursor: sha, at: new Date().toISOString(), ...extra }, null, 2), 'utf8')
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
function judgeBatch(root, batch, { today = todayStr(), record = false } = {}) {
  const breaches = []
  const undetermined = []
  const unsigned = []
  let declared = 0
  let skippedMerges = 0
  let judged = 0
  for (const sha of batch) {
    if (parentCount(root, sha) > 1) {
      skippedMerges += 1
      continue
    }
    judged += 1
    let one
    try {
      one = runAudit(root, 'head', { today, record, rev: sha })
    } catch (e) {
      one = { exit: 2, code: 'threw', detail: String(e?.message ?? e), hits: [], entryCount: 0, expired: [] }
    }
    const brief = {
      sha,
      code: one.code,
      subject: safeSubject(root, sha),
      hits: (one.hits ?? []).map((h) => ({ path: h.path, kind: h.entry?.kind ?? '', status: h.status ?? '' })),
      reasons: (one.exempt?.reasons ?? []).map((r) => r.reason),
      problems: (one.exempt?.problems ?? []).map((p) => p.message),
      signatureCode: one.signature?.code ?? '',
      keySource: one.keySource ?? '',
      windowUntil: one.signatureRequiredFrom ?? null,
      expired: (one.expired ?? []).map((x) => `${x.path}@${x.reviewBy}`),
      detail: one.detail ?? '',
    }
    if (one.exit === 1) breaches.push(brief)
    else if (one.exit === 2) undetermined.push(brief)
    else if (one.code === 'declared') declared += 1
    else if (one.code === 'declared-unsigned') unsigned.push(brief)
  }
  return { breaches, undetermined, unsigned, declared, skippedMerges, judged }
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
export function auditNewCommits(root, { limit = AUDIT_BATCH_DEFAULT, today = todayStr(), record = false } = {}) {
  let head
  try {
    head = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
  } catch (e) {
    return { ...AUDIT_BASE, detail: `HEAD 取不到：${e?.message ?? e}` }
  }
  if (!/^[a-f0-9]{40}$/.test(head)) return { ...AUDIT_BASE, detail: `HEAD 不是 40 位 sha：${head.slice(0, 20)}` }

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
    return { ...AUDIT_BASE, exit: 0, state: 'no-new-head', head, cursorBefore: cursor, cursorAfter: cursor, detail: 'HEAD 与游标同枚 ⇒ 本轮没有新输入（不等于"判过且干净"）' }
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
    return { ...AUDIT_BASE, state: 'undetermined', head, cursorBefore: cursor, cursorAfter: cursor, detail: `游标之后枚举到 0 枚提交（cursor=${cursor.slice(0, 12)}）⇒ 未判定，不记绿` }
  }

  const { breaches, undetermined, unsigned, declared, skippedMerges, judged } = judgeBatch(root, batch, { today, record })

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
  if (detached) notes.push('游标不在 HEAD 祖先链（改写史/强推）⇒ 本轮按最近提交判，游标推进到本批末位')
  if (pending > 0)
    notes.push(
      `区间长于本轮额度（limit=${limit}）⇒ 剩余 ${pending} 枚留下轮；游标保持 ${cursor.slice(0, 12)} 不推进，本批 ${batch.length} 枚 sha 记入 judged 集合（下轮只判差集，保证收敛）`,
    )
  if (cursorWriteWhy) notes.push(cursorWriteWhy)
  return {
    exit: breaches.length > 0 ? 1 : undetermined.length > 0 ? 2 : 0,
    state,
    head,
    audited: batch.length,
    judged,
    skippedMerges,
    declared,
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
export function auditRange(root, { range = 'origin/main..HEAD', today = todayStr(), record = false } = {}) {
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
    return { ...base, exit: 0, state: 'empty-range', range, detail: `区间 ${range} 为空 ⇒ 本轮零输入（不等于"判过且干净"）` }
  }
  const { breaches, undetermined, unsigned, declared, skippedMerges, judged } = judgeBatch(root, shas, { today, record })
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
    unsigned,
    pending: 0,
    breaches,
    undetermined,
    cursorBefore: '',
    cursorAfter: '',
    detail: '',
  }
}

/** 父数（>1 = 合并提交）。取不到按 1 处理 ⇒ 宁可多判一枚，不放过一枚。 */
function parentCount(root, sha) {
  try {
    return String(gitRaw(['show', '-s', '--format=%P', sha], root)).trim().split(/\s+/).filter(Boolean).length
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
    lines.push(`⚠️ ${head} 无签名豁免 ${unsigned.length} 枚（迁移窗口内，已记台账 ${UNSIGNED_LEDGER_REL}）`)
  } else if (out.exit === 0 && (out.state === 'clean' || out.state === 'no-new-head' || out.state === 'empty-range'))
    lines.push(`✅ ${head}`)
  else if (out.exit === 0 && out.state === 'bootstrapped') lines.push(`ℹ️ ${head}`)
  else if (out.exit === 1) lines.push(`❌ ${head} 判据面被静默改动（未声明 / 声明过短 / 签名缺失或验不过 / 清单到期）`)
  else lines.push(`❌ 未判定 ${head}`)
  if (out.range) lines.push(`   区间：${out.range}`)
  for (const b of out.breaches) {
    lines.push(`   - ${b.sha}「${b.subject}」code=${b.code}`)
    for (const h of b.hits) lines.push(`     · ${h.path}（${h.kind} / ${h.status}）`)
    for (const x of b.expired) lines.push(`     · 清单到期：${x}`)
    for (const p of b.problems) lines.push(`     ⚠️ ${p}`)
    if (b.signatureCode) lines.push(`     · 签名状态：${b.signatureCode}${b.keySource ? `（密钥来源 ${b.keySource}）` : ''}`)
  }
  for (const u of unsigned) {
    lines.push(`   ⚠️ ${u.sha}「${u.subject}」无签名豁免（${u.signatureCode}；窗口至 ${u.windowUntil}）`)
    for (const h of u.hits) lines.push(`     · ${h.path}（${h.kind} / ${h.status}）`)
    for (const r of u.reasons) lines.push(`     · 理由：${r}`)
  }
  for (const u of out.undetermined) lines.push(`   · 未判定 ${u.sha}「${u.subject}」code=${u.code} —— ${u.detail}`)
  if (out.declared) lines.push(`   已声明且验签通过（--record 已留痕）：${out.declared} 枚`)
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
  writeIn(root, GUARD_DATA_REL, JSON.stringify(Array.isArray(doc) ? entries : { ...doc, entries }, null, 2))
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
      return runAudit(root, face, opts)
    } catch (e) {
      return { exit: 99, code: 'threw', detail: e?.message ?? String(e) }
    }
  }

  // ST1 未触及 ⇒ 绿
  run((root) => {
    writeIn(root, 'docs/y.md', '# y\n')
    commitAll(root, 'docs: add y')
    const out = audit(root)
    ok('ST1 未触及受保护面 ⇒ exit 0 / pass', out.exit === 0 && out.code === 'pass', JSON.stringify({ exit: out.exit, code: out.code }))
  })

  // ST2 lib 前缀命中、无声明 ⇒ 红，且逐条点名 why
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: tweak reader')
    const out = audit(root)
    ok(
      'ST2 改 scripts/lib/ 无声明 ⇒ exit 1 / undeclared 且命中带 why',
      out.exit === 1 && out.code === 'undeclared' && out.hits.some((h) => h.path === 'scripts/lib/face-reader.mjs' && h.entry.why.length > 0),
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
      out.exit === 0 && out.code === 'declared' && out.exempt.reasons.length === 1 && out.signature.code === 'sig-verified',
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
      out.exit === 1 && out.code === 'undeclared' && out.exempt.problems.some((p) => p.code === 'reason-too-short'),
      JSON.stringify({ exit: out.exit, code: out.code, problems: out.exempt.problems }),
    )
  })

  // ST5 AGENTS.md 精确命中
  run((root) => {
    writeIn(root, 'AGENTS.md', '# changed\n')
    commitAll(root, 'docs: tweak agents')
    const out = audit(root)
    ok('ST5 改 AGENTS.md ⇒ exit 1 / undeclared', out.exit === 1 && out.code === 'undeclared', JSON.stringify({ exit: out.exit, code: out.code }))
  })

  // ST6 注册表命中
  run((root) => {
    writeIn(root, 'scripts/guardian-runner.mjs', '// changed\n')
    commitAll(root, 'chore: tweak runner')
    const out = audit(root)
    ok('ST6 改 scripts/guardian-runner.mjs ⇒ exit 1 / undeclared', out.exit === 1 && out.code === 'undeclared', JSON.stringify({ exit: out.exit, code: out.code }))
  })

  // ST7 豁免台账 glob 命中
  run((root) => {
    writeIn(root, 'scripts/data/demo-exemptions.json', '{"a":1}\n')
    commitAll(root, 'chore: widen exemption')
    const out = audit(root)
    ok('ST7 改 scripts/data/*-exemptions.json ⇒ exit 1 / undeclared', out.exit === 1 && out.code === 'undeclared', JSON.stringify({ exit: out.exit, code: out.code }))
  })

  // ST8 门体 glob 命中（新建一枚 check-*.mjs 也是改判据面）
  run((root) => {
    writeIn(root, 'scripts/check-brand-new.mjs', '// new gate\n')
    commitAll(root, 'feat: add gate')
    const out = audit(root)
    ok('ST8 新增 scripts/check-*.mjs ⇒ exit 1 / undeclared', out.exit === 1 && out.code === 'undeclared', JSON.stringify({ exit: out.exit, code: out.code }))
  })

  // ST9 删除受保护面 ⇒ 红
  run((root) => {
    gitRaw(['rm', '-q', 'scripts/check-demo.mjs'], root)
    commitAll(root, 'chore: drop gate')
    const out = audit(root)
    ok('ST9 删除受保护面 ⇒ exit 1 / undeclared', out.exit === 1 && out.code === 'undeclared', JSON.stringify({ exit: out.exit, code: out.code }))
  })

  // ST10 把受保护面改名搬走 ⇒ 旧路径仍命中（R 两侧都判）
  run((root) => {
    gitRaw(['mv', 'scripts/lib/face-reader.mjs', 'docs/face-reader.mjs'], root)
    commitAll(root, 'refactor: move reader')
    const out = audit(root)
    ok(
      'ST10 改名搬走受保护面 ⇒ exit 1 且命中旧路径',
      out.exit === 1 && out.code === 'undeclared' && out.hits.some((h) => h.path === 'scripts/lib/face-reader.mjs'),
      JSON.stringify({ exit: out.exit, code: out.code, hits: out.hits.map((h) => h.path) }),
    )
  })

  // ST11 默认档取不到父提交 ⇒ 未判定（不是绿也不是红）
  run((root) => {
    writeIn(root, 'docs/z.md', '# z\n')
    gitRaw(['add', '-A'], root)
    // 只留 baseline 一枚提交：HEAD^ 不存在
    const out = audit(root)
    ok('ST11 HEAD 无父提交 ⇒ exit 2 / face-missing', out.exit === 2 && out.code === 'face-missing', JSON.stringify({ exit: out.exit, code: out.code, detail: out.detail }))
  })

  // ST12 staged 面触及但无消息来源 ⇒ 未判定（commit-msg 才是接线位）
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// staged change\n')
    gitRaw(['add', '-A'], root)
    const out = audit(root, 'staged')
    ok('ST12 --staged 触及但无消息来源 ⇒ exit 2 / message-missing', out.exit === 2 && out.code === 'message-missing', JSON.stringify({ exit: out.exit, code: out.code }))
  })

  // ST13 staged 面 + 显式消息带 trailer + 签名 ⇒ 绿
  run((root) => {
    const reason = '复核过全部三个调用方的取值面'
    const subject = 'refactor: x'
    writeIn(root, 'scripts/lib/face-reader.mjs', '// staged change\n')
    gitRaw(['add', '-A'], root)
    const out = audit(root, 'staged', { message: signedMessage(subject, reason, ['scripts/lib/face-reader.mjs']), key: ST_KEY })
    ok('ST13 --staged + --message 合格声明与签名 ⇒ exit 0 / declared', out.exit === 0 && out.code === 'declared', JSON.stringify({ exit: out.exit, code: out.code }))
  })

  // ST14 worktree 未跟踪新增受保护面 ⇒ 红
  run((root) => {
    writeIn(root, 'scripts/lib/untracked-new.mjs', '// untracked\n')
    const out = audit(root, 'worktree', { message: 'wip' })
    ok(
      'ST14 --worktree 未跟踪新增 scripts/lib/* ⇒ exit 1 且命中',
      out.exit === 1 && out.code === 'undeclared' && out.hits.some((h) => h.path === 'scripts/lib/untracked-new.mjs'),
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
    ok('ST15 清单 kind 非法 ⇒ exit 2 / list-bad', out.exit === 2 && out.code === 'list-bad' && out.listProblems.length > 0, JSON.stringify({ exit: out.exit, code: out.code }))
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
      out.exit === 1 && out.code === 'expired' && out.expired.length === guardEntriesOf(guardJson).length,
      JSON.stringify({ exit: out.exit, code: out.code, expired: out.expired.length }),
    )
  })

  // ST17 清单不存在 ⇒ 未判定
  run((root) => {
    gitRaw(['rm', '-q', GUARD_DATA_REL], root)
    commitAll(root, 'chore: drop guard list')
    const out = audit(root)
    ok('ST17 清单在该面不存在 ⇒ exit 2 / list-missing', out.exit === 2 && out.code === 'list-missing', JSON.stringify({ exit: out.exit, code: out.code }))
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
    ok('ST18 未触及但清单到期 ⇒ exit 1 / expired', out.exit === 1 && out.code === 'expired', JSON.stringify({ exit: out.exit, code: out.code }))
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
    const r = parseExemptTrailer('refactor: x\n\nimmutable-exempt: 太短\n\nimmutable-exempt: 这条理由足够长而且点名了影响面')
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
      out.exit === 0 && out.code === 'declared' && rec && rec.hits.length === 1 && rec.reasons.length === 1,
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
      out.state === 'bootstrapped' && out.exit === 0 && out.audited === 0 && out.cursorAfter === out.head && out.breaches.length === 0,
      JSON.stringify({ state: out.state, exit: out.exit, audited: out.audited, cursorAfter: out.cursorAfter?.slice(0, 8), head: out.head?.slice(0, 8) }),
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
      JSON.stringify({ bad: { state: bad.state, audited: bad.audited, hits: bad.breaches.map((b) => b.hits.map((h) => h.path)) }, again: { state: again.state, exit: again.exit } }),
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
      first.audited === 2 && first.pending === 1 && first.breaches.length === 2 && second.audited === 1 && second.breaches.length === 1,
      JSON.stringify({ first: { audited: first.audited, pending: first.pending, breach: first.breaches.length }, second: { audited: second.audited, breach: second.breaches.length } }),
    )
  })

  // ST25 游标被改写（别人 force-push / 历史重写）⇒ 点名 detached，绝不静默"没有新提交"
  run((root) => {
    auditNewCommits(root) // 建点
    writeFileSync(path.join(root, CURSOR_REL), JSON.stringify({ cursor: '0'.repeat(40), at: new Date().toISOString() }), 'utf8')
    writeIn(root, 'scripts/lib/face-reader.mjs', '// after rewrite\n')
    commitAll(root, 'refactor: after rewrite')
    const out = auditNewCommits(root, { limit: 1 })
    ok(
      'ST25 游标不在祖先链 ⇒ detached 且仍判到最近一枚（不记绿）',
      out.detached === true && out.audited === 1 && out.breaches.length === 1 && /祖先链|枚举到 0/.test(out.detail),
      JSON.stringify({ detached: out.detached, audited: out.audited, breach: out.breaches.length, detail: out.detail.slice(0, 60) }),
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
      out.state === 'breach' && out.breaches.length === 1 && out.skippedMerges === 1 && out.judged === 1 && out.audited === 2,
      JSON.stringify({ state: out.state, breach: out.breaches.length, skippedMerges: out.skippedMerges, judged: out.judged, audited: out.audited }),
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
      rows = readFileSync(path.join(root, UNSIGNED_LEDGER_REL), 'utf8').trim().split(/\r?\n/).filter(Boolean)
    } catch {
      rows = []
    }
    const rec = rows.length ? JSON.parse(rows[rows.length - 1]) : null
    ok(
      'ST28 窗口内仅文字理由 ⇒ exit 0 / declared-unsigned 且落「无签名豁免」台账',
      out.exit === 0 && out.code === 'declared-unsigned' && out.unsignedRecorded === UNSIGNED_LEDGER_REL && rec && rec.kind === 'unsigned-exempt' && rec.signatureCode === 'sig-missing',
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
    const forged = signExemption({ subject, hits: ['scripts/lib/face-reader.mjs'], reason, key: ST_KEY_OTHER })
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
      out.exit === 1 && out.code === 'undeclared-unsigned' && out.signature.code === 'key-unavailable' && out.keyWhy.length > 0,
      JSON.stringify({ exit: out.exit, code: out.code, sig: out.signature.code, keyWhy: out.keyWhy }),
    )
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
    else if (a === '--range') opts.range = argv[++i]
    else if (a === '--subject') opts.subject = argv[++i]
    else if (a === '--reason') opts.reason = argv[++i]
    else if (a === '--paths') {
      const raw = String(argv[++i] ?? '')
      opts.paths = raw.split(',').map((s) => s.trim()).filter(Boolean)
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
  '      node scripts/check-immutable-guard.mjs --sign-staged --subject "<提交标题>" --reason "<理由>" [--paths <a,b,c>]  # 生成签名行（stdout 可直接贴进提交信息）',
  '      node scripts/check-immutable-guard.mjs --self-test',
  '',
  `受保护面清单: ${GUARD_DATA_REL}；合法改法: 提交信息里两行 —— \`${EXEMPT_TRAILER} <≥${MIN_REASON_CHARS} 字理由>\` + \`${SIG_TRAILER} ${SIG_VERSION}:<hex>\``,
  `签名密钥来源（按优先级）: ${KEY_ENV} / ${KEY_FILE_ENV} / git config ${KEY_CONFIG}（密钥不存在 ⇒ 需要验签的一律 fail-closed 判未豁免）`,
  `迁移窗口: ${GUARD_DATA_REL} 的 ${SIGNATURE_REQUIRED_KEY}；窗口内仅文字理由 ⇒ 放行并记 ${UNSIGNED_LEDGER_REL}，到期后必须有验得过的签名`,
  `巡检游标: ${CURSOR_REL}（派发点 = scripts/git-guardian.mjs 的 auditImmutableGuardNewCommits）`,
].join('\n')

/**
 * 签发助手（`--sign-staged`）：只对**点名的 staged 路径**算命中面，避免把别席暂存条目
 * 一起签进 payload（那样审计侧按提交 diff 重算会验不过）。密钥走同一套 `resolveSigningKey`。
 */
export function signStaged(root, { subject, reason, paths = [], today = todayStr() } = {}) {
  if (!subject || !String(subject).trim()) throw new Error('--subject 必填（必须与最终提交标题一字不差）')
  if (!reason || String(reason).trim() === '') throw new Error('--reason 必填')
  const args = ['diff', '--cached', '--name-status', '-M', '-z']
  if (paths.length) args.push('--', ...paths)
  const changes = parseNameStatusZ(gitRaw(args, root))
  const parsed = parseGuardList(readFileSync(path.join(root, GUARD_DATA_REL), 'utf8'), { today })
  if (parsed.problems.length) throw new Error(`清单形状坏，先修清单：${parsed.problems.map((p) => p.message).join('；')}`)
  const judged = judgeChanges({ changes, entries: parsed.entries, message: '', today })
  if (!judged.hits.length) throw new Error('指定路径里没有命中受保护面 ⇒ 无需签名（不签空集）')
  const keyRes = resolveSigningKey(root)
  if (!keyRes.key) throw new Error(keyRes.why)
  return {
    sig: signExemption({ subject, hits: judged.hits, reason, key: keyRes.key }),
    hits: judged.hits.map((h) => `${h.path}（${h.entry.kind} / ${h.status}）`),
    keySource: keyRes.source,
  }
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
    console.log(`⚠️ [immutable-guard] 应急跳过：${SELF_SKIP}=1（本次不判定；跳门留痕由 safe-commit attestation 负责）`)
    return 0
  }
  if (opts.signStaged && (opts.staged || opts.worktree || opts.auditNew || opts.range)) {
    console.error('❌ --sign-staged 只对 staged 面签发，不得与 --staged/--worktree/--audit-new/--range 同用')
    return 2
  }
  if (opts.range && (opts.staged || opts.worktree || opts.auditNew)) {
    console.error('❌ --range 走显式区间（push 门专用），不得与 --staged/--worktree/--audit-new 同用')
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
    console.error('❌ --audit-new 走自己的面（每枚提交自己那一轮），不得与 --staged/--worktree 同用')
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
  signStaged,
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
  // 签名豁免（2026-11-04 立）
  SIG_TRAILER,
  SIG_VERSION,
  MIN_KEY_CHARS,
  SIGNATURE_REQUIRED_KEY,
  UNSIGNED_LEDGER_REL,
  KEY_ENV,
  KEY_FILE_ENV,
  KEY_CONFIG,
  signExemption,
  verifyExemption,
  subjectOf,
  parseSigTrailer,
  exemptPayload,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
