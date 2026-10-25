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
 * 逼人 `--no-verify`，§12e）也不能记绿（那等于没有护栏）。所以接线位天然是 **commit-msg**
 * 钩子（此时 `$1` 就是本次消息文件），建议见 `PROJECT_PLAN` / 交付报告。
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
  decide,
  parseGuardList,
  parseNameStatusZ,
  parseExemptTrailer,
  probeEntry,
  matchProtected,
  globToRegExp,
  todayStr,
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
 * 按判定面读单文件正文。取不到返回 null（**不回落**另一个面，§0.4）。
 * @returns {string|null}
 */
export function readFaceText(root, face, rel) {
  if (!FACES.includes(face)) throw new Undetermined(`未知判定面 ${String(face)}（只认 ${FACES.join(' / ')}）`)
  if (face === 'worktree') return readWorktreeFile(root, rel)
  const rev = face === 'staged' ? `:${rel}` : `HEAD:${rel}`
  const got = catBatch(root, [rev])
  return got.get(rev) ?? null
}

/**
 * 被审面的改动清单。统一 `--name-status -M -z`（NUL 分帧：中文/空格路径不被打断）。
 * `--worktree` 档把未跟踪文件按 A 计入 —— 新建一枚受保护面同样是"触及判据面"。
 * @returns {Array<{status:string,path:string,oldPath?:string}>}
 */
export function listFaceChanges(root, face) {
  try {
    if (face === 'head') {
      return parseNameStatusZ(gitRaw(['diff', '--name-status', '-M', '-z', 'HEAD^', 'HEAD'], root))
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

function readHeadMessage(root) {
  return gitRaw(['log', '-1', '--format=%B', 'HEAD'], root)
}

/**
 * 对某一面跑一次完整判定。返回结构化结果（CLI / 自检 / 镜像测试共用同一实现）。
 *
 * `message` 语义：
 *   `undefined` ⇒ head 档读 HEAD 提交信息；staged/worktree 档为 `null`（= 结构上没有消息）;
 *   `string`    ⇒ 用调用方给的（`--message` / `--message-file` / 夹具）;
 *   `null`      ⇒ 显式"没有消息"。
 */
export function runAudit(root, face, { message = undefined, today = todayStr(), record = false } = {}) {
  const baseOut = {
    face,
    exit: 2,
    code: 'face-missing',
    entryCount: 0,
    changeCount: 0,
    hits: [],
    untouched: [],
    exempt: { present: false, reasons: [], problems: [] },
    expired: [],
    listProblems: [],
    detail: '',
  }
  let listText
  try {
    listText = readFaceText(root, face, GUARD_DATA_REL)
  } catch (e) {
    if (e instanceof Undetermined) return { ...baseOut, detail: e.message, code: 'list-missing' }
    throw e
  }
  if (listText === null) {
    return { ...baseOut, code: 'list-missing', detail: `受保护面清单在 ${face} 面不存在：${GUARD_DATA_REL}` }
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
    changes = listFaceChanges(root, face)
  } catch (e) {
    if (e instanceof Undetermined) return { ...baseOut, entryCount: parsed.entries.length, code: 'face-missing', detail: e.message }
    throw e
  }

  let msg = message
  if (msg === undefined) {
    if (face === 'head') {
      try {
        msg = readHeadMessage(root)
      } catch (e) {
        msg = null
        baseOut.detail = `HEAD 提交信息取不到：${e?.message ?? e}`
      }
    } else {
      msg = null
    }
  }

  const out = decide({ listProblems: parsed.problems, entries: parsed.entries, changes, message: msg, today })
  const result = {
    ...baseOut,
    ...out,
    face,
    entryCount: parsed.entries.length,
    changeCount: changes.length,
    detail: baseOut.detail,
  }
  if (record && out.code === 'declared') {
    result.recorded = recordExemption(root, result)
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
    `[判定面=${out.face}] code=${out.code} 受保护面 ${out.entryCount} 条 / 改动 ${out.changeCount} 条 / 命中 ${out.hits.length} 条 / 到期 ${out.expired.length} 条 / 未判定 ${out.exit === 2 ? 1 : 0}`,
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

  // ST3 同改动带有效 trailer ⇒ 绿（声明生效）
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: tweak reader\n\nimmutable-exempt: 修复批量读取的内存上限，已复核全部调用方')
    const out = audit(root)
    ok(
      'ST3 同一改动带 immutable-exempt: ⇒ exit 0 / declared',
      out.exit === 0 && out.code === 'declared' && out.exempt.reasons.length === 1,
      JSON.stringify({ exit: out.exit, code: out.code, reasons: out.exempt.reasons }),
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

  // ST13 staged 面 + 显式消息带 trailer ⇒ 绿
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// staged change\n')
    gitRaw(['add', '-A'], root)
    const out = audit(root, 'staged', { message: 'refactor: x\n\nimmutable-exempt: 复核过全部三个调用方的取值面' })
    ok('ST13 --staged + --message 合格声明 ⇒ exit 0 / declared', out.exit === 0 && out.code === 'declared', JSON.stringify({ exit: out.exit, code: out.code }))
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
    const bad = JSON.parse(guardJson)
    bad[0].kind = 'no-such-kind'
    writeIn(root, GUARD_DATA_REL, JSON.stringify(bad, null, 2))
    gitRaw(['add', '-A'], root)
    commitAll(root, 'chore: break guard list')
    const out = audit(root)
    ok('ST15 清单 kind 非法 ⇒ exit 2 / list-bad', out.exit === 2 && out.code === 'list-bad' && out.listProblems.length > 0, JSON.stringify({ exit: out.exit, code: out.code }))
  })

  // ST16 清单 reviewBy 到期 ⇒ 红（清单腐烂，§0.7）
  run((root) => {
    const old = JSON.parse(guardJson).map((e) => ({ ...e, reviewBy: '2020-01-01' }))
    writeIn(root, GUARD_DATA_REL, JSON.stringify(old, null, 2))
    commitAll(root, 'chore: old reviewBy')
    const out = audit(root)
    ok(
      'ST16 reviewBy 到期 ⇒ exit 1 / expired',
      out.exit === 1 && out.code === 'expired' && out.expired.length === old.length,
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
    const old = JSON.parse(guardJson).map((e) => ({ ...e, reviewBy: '2020-01-01' }))
    writeIn(root, GUARD_DATA_REL, JSON.stringify(old, null, 2))
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

  // ST21 --record 留痕：声明合格时逐条落 jsonl（§0.7 豁免留痕；取不到不判红，但结果里 recorded=null）
  run((root) => {
    writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    commitAll(root, 'refactor: x\n\nimmutable-exempt: 已复核全部调用方并补齐镜像测试')
    const out = audit(root, 'head', { record: true })
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
    else if (a === '--json') opts.json = true
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
  '用法: node scripts/check-immutable-guard.mjs [--staged|--worktree] [--message-file <f>|--message <s>] [--json] [--record] [--root <仓根>] [--today <YYYY-MM-DD>]',
  '      node scripts/check-immutable-guard.mjs --self-test',
  '',
  `受保护面清单: ${GUARD_DATA_REL}；合法改法: 提交信息里一行 \`${EXEMPT_TRAILER} <≥${MIN_REASON_CHARS} 字理由>\``,
].join('\n')

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
  if (opts.staged && opts.worktree) {
    console.error('❌ --staged 与 --worktree 不得同用（两个判定面互斥）')
    return 2
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
  ROOT,
  readFaceText,
  listFaceChanges,
  runAudit,
  recordExemption,
  formatReport,
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
