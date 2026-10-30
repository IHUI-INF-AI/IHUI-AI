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
}

/** 池票最小形(loginAccountLocal 只吃这一张面;测试注入免真库) */
type PoolRowLike = Parameters<typeof loginAccountLocal>[0]

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
}): Promise<VerifiedSwitchResult> {
  const doLoad = opts.loadRow ?? loadPoolRow
  const doWrite = opts.writeBack ?? loginAccountLocal
  const doSnap = opts.snapshot ?? snapshotApp
  const doCompare = opts.compare ?? compareSnapshots
  const notes: string[] = []

  const row = await doLoad(opts.provider, opts.uid)

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

function argValue(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag)
  if (idx === -1) return undefined
  return argv[idx + 1]
}

export function main(argv: string[]): number {
  const provider = argValue(argv, '--provider')
  if (!provider) {
    console.error(
      '用法:relay-login-local-verified.ts --provider <code> [--uid <池票uid>] [--dry-run] [--json]',
    )
    return 2
  }
  const uid = argValue(argv, '--uid')
  const dryRun = argv.includes('--dry-run')
  runVerifiedSwitch({ provider, uid, dryRun })
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
      if (argv.includes('--json')) console.log(JSON.stringify(r, null, 1))
      else console.log(lines.join('\n'))
      // pg 连接池 keep-alive 会挂住进程 ⇒ CLI 面显式退出(退出码按 verdict)
      process.exit(r.verdict === 'continuity-broken' ? 1 : 0)
    })
    .catch((e: { code?: string; message?: string }) => {
      console.error(`未判定: [${e?.code ?? 'switch-failed'}] ${e?.message ?? String(e)}`)
      process.exitCode = 2
    })
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main(process.argv.slice(2))

export const __test__ = { CONTINUITY_FACE, runVerifiedSwitch, main }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
