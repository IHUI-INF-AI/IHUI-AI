// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay:login-local-verified —— 「一键切号 + 对话随行对账」闭环 CLI(2026-10-30 立)。
 *
 * 把 MiniMax 当日真机验证过的四步收成一条命令(判据全部复用既有器物,不抄第二份):
 *   ① 池里选票(provider 必填;多票不点名 ⇒ exit 2 未判定,绝不猜)
 *   ② 切号前拍连续性快照(scripts/lib/switch-continuity-check.mjs,本地正库平台)
 *   ③ loginAccountLocal 真写回(关端 → 写 → 拉起,同 relay-local-login 服务路径)
 *   ④ 切号后快照 + compare ⇒ continuity-ok / -broken / no-continuity-face
 *
 * 用法:
 *   tsx scripts/relay-login-local-verified.ts --provider minimax [--uid <池票uid>] [--dry-run] [--json]
 *
 * 对账面映射(§0.6 与 switch-continuity-check 同源,这里只做键名映射):
 *   qoder/minimax/codex/zcode/opencode ⇒ 有本地正库对账面;
 *   trae/trae-solo(携对话腿自证)/workbuddy/codearts/loomy/doubao(对话在云端)/
 *   lingma/grokbot(未装)⇒ 无对账面,如实标 no-continuity-face,不冒 ok。
 *
 * 凭证纪律:任何输出不含 token/refreshToken 明文(快照面零正文;loginAccountLocal 返回面零凭据)。
 * 退出码:0 continuity-ok 或 no-continuity-face / 1 continuity-broken(切号真丢了会话)/ 2 未判定。
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { eq } from 'drizzle-orm'

import { aiRelayAccountPool } from '@ihui/database'
import { db } from '../src/db/index.js'
import { decryptAccountCredentials } from '../src/services/relay-account-pool-service.js'
import { loginAccountLocal } from '../src/services/relay-local-login.js'

// scripts/lib/*.mjs 无 .d.ts:动态 import 是 apps/api/scripts 既有模式
// (relay-trae-chat-switch.ts 同款),静态 import 会触发 TS7016。
const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..', '..')
const continuity = await import(
  pathToFileURL(path.join(REPO_ROOT, 'scripts', 'lib', 'switch-continuity-check.mjs')).href
)
const { snapshotApp, compareSnapshots } = continuity
type SnapshotResult = Awaited<ReturnType<typeof snapshotApp>>

// env 由 script 的 `tsx --env-file=.env` 注入(apps/api/.env 是本包运行面);
// 本文件不 import dotenv 自载:ESM 静态 import 提升会让 db 模块先于任何模块体求值。

/** 池 provider ⇒ 对账器 APPS 键(同名的直通;无正库面的一律 undefined) */
const CONTINUITY_FACE: Partial<Record<string, string>> = {
  qoder: 'qoder',
  minimax: 'minimax',
  codex: 'codex',
  zcode: 'zcode',
  opencode: 'opencode',
  workbuddy: 'workbuddy',
  codearts: 'codearts',
  loomy: 'loomy',
}

/** 池票最小形(loginAccountLocal 只吃这一张面;测试注入免真库) */
type PoolRowLike = Parameters<typeof loginAccountLocal>[0]

/**
 * 「无会话模板 ⇒ 静默兜底到本机当前会话」的平台,判据来自 scripts/local-login.mjs 的写回基底:
 * qoder `template ?? current`、codearts `template ?? row.session`、minimax/opencode `template ?? prev`。
 * 这些平台没模板时凭证照样换,但账号资料(user/userId/邮箱等)仍是本机旧号的
 * ⇒ 用户看到「切了号却显示旧号资料」。这里只告警,不拦写回(凭证写回本身是有效的)。
 *
 * 不在列的原因(逐平台读过写回配方):workbuddy 无模板且跨号时显式 409 no-template,不会静默沿用;
 * codex auth.json 只存 tokens 不含账号资料;zcode 认 secrets.credentialMap、doubao 认 cookies;
 * loomy 无模板是「资料缺字段」而非「带回旧号资料」,与本源缺陷不同型。
 */
export const TEMPLATE_FALLBACK_PROVIDERS: ReadonlySet<string> = new Set([
  'qoder',
  'codearts',
  'minimax',
  'opencode',
])

/**
 * 该池票是否采到会话模板(读 secretsEnc 解密后的 sessionTemplate)。
 * 解不开/无 secretsEnc 一律按「缺失」:失效方向是多提示一次,不是漏提示。
 */
export function hasSessionTemplate(row: PoolRowLike): boolean {
  try {
    const template = decryptAccountCredentials(row).secrets.sessionTemplate
    return (
      Boolean(template) &&
      typeof template === 'object' &&
      !Array.isArray(template) &&
      Object.keys(template as Record<string, unknown>).length > 0
    )
  } catch {
    return false
  }
}

/** 模板缺失告警(人类可读行与 --json 的 notes 同一份文案) */
export function templateMissingNote(providerCode: string): string {
  return (
    '模板缺失:该票导入时未采集会话模板,写回后客户端账号资料仍沿用旧号;' +
    `建议先跑 node scripts/relay-account-pool.mjs --from ${providerCode} 重新导入后再切`
  )
}

/** 默认选票:真库。测试经 opts.loadRow 注入,绝不连生产库(§5 测试隔离铁律) */
async function loadPoolRow(provider: string, uid?: string): Promise<PoolRowLike> {
  const rows = await db
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.providerCode, provider))
  if (rows.length === 0) {
    throw Object.assign(
      new Error(
        `池内无 ${provider} 票(未判定);先跑 scripts/relay-account-pool.mjs --from ${provider}`,
      ),
      {
        code: 'NO_POOL_ROW',
      },
    )
  }
  const row = uid ? rows.find((r) => r.uid === uid) : rows[0]
  if (!row)
    throw Object.assign(new Error(`池内无 uid=${uid} 的 ${provider} 票(未判定)`), {
      code: 'NO_SUCH_UID',
    })
  if (!uid && rows.length > 1) {
    throw Object.assign(
      new Error(
        `池内有 ${rows.length} 枚 ${provider} 票且未点名 --uid(未判定,绝不猜);可用:${rows.map((r) => r.uid).join(' | ')}`,
      ),
      { code: 'AMBIGUOUS_UID' },
    )
  }
  return row
}

export interface VerifiedSwitchResult {
  ok: boolean
  provider: string
  uid: string
  dryRun: boolean
  wroteBack: boolean
  continuityFace: boolean
  before: SnapshotResult | null
  after: SnapshotResult | null
  verdict: 'continuity-ok' | 'continuity-broken' | 'no-continuity-face' | 'not-run' | 'undetermined'
  compare: ReturnType<typeof compareSnapshots> | null
  writeBack: Awaited<ReturnType<typeof loginAccountLocal>> | null
  notes: string[]
}

export async function runVerifiedSwitch(opts: {
  provider: string
  uid?: string
  dryRun?: boolean
  /** 测试注入:替换选票腿(绝不连真库) */
  loadRow?: typeof loadPoolRow
  /** 测试注入:替换写回腿(绝不在测试里真写本机客户端) */
  writeBack?: typeof loginAccountLocal
  /** 测试注入:替换快照腿 */
  snapshot?: typeof snapshotApp
  /** 测试注入:替换 compare */
  compare?: typeof compareSnapshots
  /** 测试注入:替换「该票有无会话模板」判据(默认解密 secretsEnc,零真库) */
  hasTemplate?: typeof hasSessionTemplate
}): Promise<VerifiedSwitchResult> {
  const doLoad = opts.loadRow ?? loadPoolRow
  const doWrite = opts.writeBack ?? loginAccountLocal
  const doSnap = opts.snapshot ?? snapshotApp
  const doCompare = opts.compare ?? compareSnapshots
  const hasTemplate = opts.hasTemplate ?? hasSessionTemplate
  const notes: string[] = []

  const row = await doLoad(opts.provider, opts.uid)

  // 切号前就把「无模板会沿用旧号资料」说清楚(dry-run 也照报:用户该先知道再决定切不切)
  if (TEMPLATE_FALLBACK_PROVIDERS.has(row.providerCode) && !hasTemplate(row)) {
    notes.push(templateMissingNote(row.providerCode))
  }

  const face = CONTINUITY_FACE[opts.provider]
  const before = face ? doSnap(face) : null
  if (face && before?.state !== 'ok') notes.push(`切号前快照未判定:${before?.why ?? '?'}`)

  if (opts.dryRun) {
    notes.push('dry-run:未写回、未拍 after')
    return {
      ok: true,
      provider: opts.provider,
      uid: row.uid,
      dryRun: true,
      wroteBack: false,
      continuityFace: Boolean(face),
      before,
      after: null,
      verdict: 'not-run',
      compare: null,
      writeBack: null,
      notes,
    }
  }

  const writeBack = await doWrite(row)
  const after = face ? doSnap(face) : null
  let compare: ReturnType<typeof doCompare> | null = null
  let verdict: VerifiedSwitchResult['verdict']
  if (face && before?.state === 'ok' && after?.state === 'ok') {
    compare = doCompare(before, after)
    verdict = compare.verdict === 'continuity-broken' ? 'continuity-broken' : 'continuity-ok'
  } else {
    verdict = 'no-continuity-face'
    if (!face)
      notes.push(`${opts.provider} 无本地正库对账面(对话在云端或由携对话腿自证),写回结果如实回报`)
  }
  return {
    ok: verdict !== 'continuity-broken',
    provider: opts.provider,
    uid: row.uid,
    dryRun: false,
    wroteBack: true,
    continuityFace: Boolean(face),
    before,
    after,
    verdict,
    compare,
    writeBack,
    notes,
  }
}

export function argValue(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag)
  if (idx === -1) return undefined
  return argv[idx + 1]
}

/** CLI 面 IO 注入(测试注入假 exit,绝不真退进程;四腿可选,缺省走真 stdout/stderr/process.exit) */
export interface MainIo {
  exit?: (code: number) => void
  /** stderr 面 */
  write?: (text: string) => void
  /** stdout 面 */
  log?: (text: string) => void
  /** 测试注入:替换切号腿(默认真库真写回) */
  run?: typeof runVerifiedSwitch
}

/**
 * 唯一退出出口:pg 连接池 keep-alive 会挂住进程,凡「设 exitCode 后只 return」的路径
 * 都会让子进程活到被外层超时杀掉(2026-10-31 实测失败分支 120s 不退)。
 * 先写 stderr 再 exit,与 relay-account-import / relay-minimax-session-sync 同款写法。
 */
export function exitWith(code: number, message: string | null, io: MainIo = {}): void {
  const exit = io.exit ?? process.exit
  const write = io.write ?? ((text: string) => void process.stderr.write(text))
  if (message) write(message.endsWith('\n') ? message : `${message}\n`)
  exit(code)
}

export function main(argv: string[], io: MainIo = {}): number {
  const provider = argValue(argv, '--provider')
  if (!provider) {
    exitWith(
      2,
      '用法:relay-login-local-verified.ts --provider <code> [--uid <池票uid>] [--dry-run] [--json]',
      io,
    )
    return 2 // 仅注入假 exit 时可达;真 process.exit 不返回
  }
  const uid = argValue(argv, '--uid')
  const dryRun = argv.includes('--dry-run')
  const run = io.run ?? runVerifiedSwitch
  const log = io.log ?? ((text: string) => void console.log(text))
  run({ provider, uid, dryRun })
    .then((r) => {
      const lines = [
        `票: provider=${r.provider} uid=${r.uid}`,
        r.before
          ? `before: ${r.before.state} 会话=${r.before.sessions?.count ?? '?'} 钉=${r.before.sessions?.digest ?? '-'}`
          : 'before: (无对账面)',
        r.writeBack
          ? `写回: ok=${r.writeBack.ok} 落点=${r.writeBack.targetFile} 备份=${r.writeBack.backupFile}`
          : '写回: (dry-run 或未执行)',
        ...(r.writeBack?.notes ?? []).map((n) => `  · ${n}`),
        r.after
          ? `after: ${r.after.state} 会话=${r.after.sessions?.count ?? '?'} 钉=${r.after.sessions?.digest ?? '-'}`
          : r.dryRun
            ? 'after: (dry-run)'
            : 'after: (无对账面)',
        r.compare ? `compare: ${r.compare.verdict} ${r.compare.note}` : '',
        ...r.notes.map((n) => `  · ${n}`),
        `SWITCH-VERIFIED state=${r.verdict}`,
      ].filter(Boolean)
      // --json 打整份结果 ⇒ notes(含模板缺失告警)在两条产出面上都可见
      if (argv.includes('--json')) log(JSON.stringify(r, null, 1))
      else log(lines.join('\n'))
      // pg 连接池 keep-alive 会挂住进程 ⇒ CLI 面显式退出(退出码按 verdict)
      exitWith(r.verdict === 'continuity-broken' ? 1 : 0, null, io)
    })
    .catch((e: { code?: string; message?: string }) => {
      // 失败分支同样必须显式退出:只设 exitCode 会被 pg 句柄挂住(2026-10-31 实测 120s 不退)
      exitWith(2, `未判定: [${e?.code ?? 'switch-failed'}] ${e?.message ?? String(e)}`, io)
    })
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main(process.argv.slice(2))

export const __test__ = {
  CONTINUITY_FACE,
  TEMPLATE_FALLBACK_PROVIDERS,
  hasSessionTemplate,
  templateMissingNote,
  exitWith,
  runVerifiedSwitch,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
