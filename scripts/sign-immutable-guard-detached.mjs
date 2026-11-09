#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分离签名台账签发器（`scripts/data/immutable-guard-detached-signatures.jsonl`）
 *
 * ## 它解决什么
 *
 * 签名槽位只存在于**提交信息**里，而提交信息是 sha 的一部分：已经落库、推送出去、
 * 当时只写了 `immutable-exempt:` 文字理由的那批提交，结构上**永远补不了**
 * `immutable-exempt-sig`（补签必改 sha ⇒ 只能 force push / rebase，本仓硬禁）。
 * 到 `signatureRequiredFrom` 那天，它们会从「窗口内放行」集体翻成判红，而它们自己无路可走。
 *
 * 本通道把签名放到**台账**里（一行一枚），但按下面四件事绑死，因此**不是豁免名单**：
 *   ① 40 位全量 sha（换一枚就查不到；短 sha 在本仓腐烂率实测 30.2%，禁止缩写）；
 *   ② 该枚 `rev^..rev` 差异集的**全路径集**（rename 旧+新都算，去重升序）——
 *      判定侧逐条精确相等地比，多一条 / 少一条 / 改写一条都判红（不做"包含即可"）；
 *   ③ 理由（与提交内 `immutable-exempt:` 同量纲，≥ 10 字）与 `signedAt`；
 *   ④ 独立追认钥（`ihui.immutableGuardAckKeyPath`，与提交签名钥不是同一把）的 HMAC-SHA256。
 * 删掉台账里任意一条 ⇒ 那一枚立刻回到「无签名 + 窗口已过 ⇒ 判红」——这就是通道的自证。
 *
 * ## 签名算法（**与 scripts/lib/immutable-guard.mjs 的 detachedPayload/signDetached 逐字一致**）
 *
 *   payload = JSON.stringify({ sha, paths, reason, signedAt })
 *   键序    固定 sha → paths → reason → signedAt
 *   paths   去重后 `.sort()`（Node 默认 UTF-16 码元序）；路径原样，不做大小写/斜杠改写
 *   sig     HMAC-SHA256(key, payload) 的 64 位小写 hex（裸 hex，不带版本前缀）
 *
 * ## 待签清单是**现算**的（不是常量）
 *
 *   区间：默认 `29b840d962^..origin/main`（signatureRequiredFrom 引入点至今）
 *   逐枚必须同时满足：
 *     · 非 merge；
 *     · 提交信息里至少一条 ≥10 字的 `immutable-exempt:`（且没有过短的坏行）；
 *     · 提交信息里**没有任何** `immutable-exempt-sig:` 行（签过的不重复签）；
 *     · 不在具名追认台账（`immutable-guard-attestations.jsonl`）里（那批走另一条通道）；
 *     · 在 `origin/main` 的 `signatureRequiredFrom` **当天**判定为 `undeclared-unsigned`
 *       （= 无签名 + 窗口已过 ⇒ 会转红的那一档；不触及受保护面 / 窗口内 / 已过期都不选）。
 *
 * ## 用法
 *
 *   node scripts/sign-immutable-guard-detached.mjs               # 现算 + 签发 + 写台账
 *   node scripts/sign-immutable-guard-detached.mjs --dry-run     # 只算不写（逐枚打印）
 *   node scripts/sign-immutable-guard-detached.mjs --signed-at 2026-11-07
 *   node scripts/sign-immutable-guard-detached.mjs --range <base^..ref>
 *
 * 退出码：0 = 全部自检通过（或没有待签且台账完好）；1 = 参数/取数/自检失败（**不写半成品**）。
 * 缺钥 ⇒ 1（拒签，fail-closed；绝不产出"看起来能用"的假签名）。
 * 本工具**不打印、不落盘**密钥内容；台账里只有签名，密钥留在仓外。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  ATTEST_LEDGER_REL,
  DETACHED_LEDGER_REL,
  DETACHED_SIG_RE,
  FULL_SHA_RE,
  GUARD_DATA_REL,
  isValidDateStr,
  parseAttestLedger,
  parseDetachedLedger,
  parseExemptTrailer,
  parseGuardList,
  parseSigTrailer,
  decide,
  signDetached,
  todayStr,
} from './lib/immutable-guard.mjs'
import {
  batchFaceChanges,
  batchFaceTexts,
  listFaceChanges,
  ROOT,
  resolveAckKey,
  resolveSigningKey,
} from './check-immutable-guard.mjs'
import { gitRaw } from './lib/face-reader.mjs'

/** signatureRequiredFrom 的引入点（2026-11-04）。写在这里是为了可复现，不参与任何判定。 */
const DEFAULT_RANGE = '29b840d962^..origin/main'

function fail(msg) {
  console.error(`[sign-detached] ${msg}`)
  process.exit(1)
}

function parseArgv(argv) {
  const o = {
    range: DEFAULT_RANGE,
    signedAt: todayStr(),
    out: DETACHED_LEDGER_REL,
    root: ROOT,
    dryRun: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--range') o.range = argv[++i]
    else if (a === '--signed-at') o.signedAt = argv[++i]
    else if (a === '--out') o.out = argv[++i]
    else if (a === '--root') o.root = argv[++i]
    else if (a === '--dry-run') o.dryRun = true
    else if (a === '--help' || a === '-h') {
      console.log(
        [
          '用法: node scripts/sign-immutable-guard-detached.mjs [--range <a..b>] [--signed-at YYYY-MM-DD] [--out <file>] [--dry-run] [--root <仓根>]',
          `台账: ${DETACHED_LEDGER_REL}（一行一条；sha 40 位全量；paths = 该枚 rev^..rev 全路径集，去重升序）`,
          `签名: HMAC-SHA256(独立追认钥, JSON.stringify({sha,paths,reason,signedAt})) → 64 位小写 hex`,
          '待签清单现算：非 merge / 有 ≥10 字理由 / 无 sig 行 / 不在追认台账 / 到期当天判 undeclared-unsigned',
        ].join('\n'),
      )
      process.exit(0)
    } else fail(`未知参数：${a}（--help 看用法）`)
  }
  if (!isValidDateStr(o.signedAt)) fail(`--signed-at 必须是 YYYY-MM-DD：${o.signedAt}`)
  return o
}

/** 该枚的全路径集：`rev^..rev` 差异集里出现过的每一条路径（rename 的旧+新都算），去重升序。 */
function pathSetOf(changes) {
  return [
    ...new Set(
      (Array.isArray(changes) ? changes : [])
        .flatMap((c) => [c?.path, c?.oldPath])
        .filter((p) => typeof p === 'string' && p.trim()),
    ),
  ].sort()
}

/** 一次读完区间内每枚的 sha + 提交日 + 提交信息。`\x1f` 分列、`\x1e` 分帧（消息里不会出现这两字节）。 */
function readRangeMeta(root, range) {
  const raw = String(
    gitRaw(
      ['log', '--no-merges', '--reverse', `--format=%H%x1f%cs%x1f%B%x1e`, String(range)],
      root,
      { maxBuffer: 1 << 28 },
    ),
  )
  const out = []
  for (const piece of raw.split('\x1e')) {
    if (!piece.trim()) continue
    const [sha, date, ...rest] = piece.split('\x1f')
    if (!FULL_SHA_RE.test(String(sha ?? '').trim())) continue
    out.push({
      sha: String(sha).trim(),
      commitDate: String(date ?? '').trim(),
      message: rest.join('\x1f').replace(/^\n+/, '').replace(/\n+$/, ''),
    })
  }
  return out
}

/** 从某个 ref 读策略清单；拿不到 / 坏 ⇒ fail（不能猜"到期日是哪天"）。 */
function policyOf(root, rev) {
  let text
  try {
    text = String(gitRaw(['show', `${rev}:${GUARD_DATA_REL}`], root))
  } catch (e) {
    fail(`取不到 ${rev} 的策略清单（${e?.message ?? e}）⇒ 无法现算待签清单`)
  }
  const parsed = parseGuardList(text)
  if (parsed.problems.length)
    fail(`${rev} 的策略清单坏：${parsed.problems.map((p) => p.message).join(' | ')}`)
  if (!parsed.signatureRequiredFrom)
    fail(`${rev} 没登记 signatureRequiredFrom ⇒ 没有"到期转红"这回事，本通道无事可做`)
  return parsed
}

function main() {
  const opts = parseArgv(process.argv.slice(2))
  const root = opts.root
  const policy = policyOf(root, 'origin/main')
  const policyDate = policy.signatureRequiredFrom

  const ackRes = resolveAckKey(root)
  if (!ackRes.key) fail(`取不到独立追认钥（拒签，fail-closed）：${ackRes.why}`)
  const submitRes = resolveSigningKey(root)
  if (submitRes.key && submitRes.key === ackRes.key)
    fail('独立追认钥与提交签名钥是同一把 ⇒ 分离通道退化为作者自认，拒签（钥未分离）')

  // 追认台账：那 33 枚走另一条通道，这里只排除、不重签。
  let attestRows = []
  const attestPath = path.join(root, ATTEST_LEDGER_REL)
  if (existsSync(attestPath)) {
    const parsed = parseAttestLedger(readFileSync(attestPath, 'utf8'))
    if (parsed.problems.length)
      fail(
        `追认台账坏行 ${parsed.problems.length} 条（先修它，否则"是否已追认"不可判）：${parsed.problems
          .map((p) => `L${p.line ?? '?'} ${p.why}`)
          .join(' | ')}`,
      )
    attestRows = parsed.rows
  }
  const attestShas = new Set(attestRows.map((r) => r.sha))

  // 既有分离台账：只增不减。形状/验签有一条不对 ⇒ 整车拒绝（绝不覆盖坏行）。
  let existingRows = []
  const outPath = path.resolve(root, opts.out)
  if (existsSync(outPath)) {
    const parsed = parseDetachedLedger(readFileSync(outPath, 'utf8'))
    if (parsed.problems.length)
      fail(
        `既有分离台账坏行 ${parsed.problems.length} 条（拒绝在其上追加/覆盖）：${parsed.problems
          .map((p) => `L${p.line ?? '?'} ${p.why}`)
          .join(' | ')}`,
      )
    const seen = new Set()
    for (const row of parsed.rows) {
      if (seen.has(row.sha)) fail(`既有分离台账同一 sha 重复：${row.sha}（先人工裁定）`)
      seen.add(row.sha)
      const expected = signDetached({
        sha: row.sha,
        paths: row.paths,
        reason: row.reason,
        signedAt: row.signedAt,
        key: ackRes.key,
      })
      if (expected !== row.sig)
        fail(`既有分离台账验签不过：${row.sha}（L${row.line}）⇒ 先修它，本工具不覆盖`)
    }
    existingRows = parsed.rows
  }

  const meta = readRangeMeta(root, opts.range)
  if (!meta.length) fail(`区间 ${opts.range} 读不到任何非 merge 提交（检查 ref / 是否已 fetch）`)

  // 先按"提交信息"这一层筛：有 ≥10 字理由、没有 sig 行、不在追认台账。
  // 只对这批人去取"该枚自己的清单 + 差异集"——把 1700 多枚的取数压到真正要判的那几百枚。
  const preCandidates = []
  const counts = { noReason: 0, hasSig: 0, attested: 0, listBad: 0, notRed: 0, already: 0 }
  for (const m of meta) {
    const reasons = parseExemptTrailer(m.message)
    const sigs = parseSigTrailer(m.message)
    if (!reasons.reasons.length || reasons.problems.length) {
      counts.noReason += 1
      continue
    }
    if (sigs.present) {
      counts.hasSig += 1
      continue
    }
    if (attestShas.has(m.sha)) {
      counts.attested += 1
      continue
    }
    preCandidates.push({ ...m, reason: reasons.reasons[0].reason })
  }

  // 批量取数按块做：一次 `git log` 带 1700+ 个 sha 会顶穿 Windows 命令行长度上限
  // （实测整批返空 ⇒ 全部误判成"取不到"）。块内取不到再逐枚回落，绝不把"取不到"当成"没这回事"。
  const BATCH = 200
  const guardTexts = new Map()
  const changeSets = new Map()
  for (let i = 0; i < preCandidates.length; i += BATCH) {
    const chunk = preCandidates.slice(i, i + BATCH).map((m) => m.sha)
    const texts = batchFaceTexts(
      root,
      chunk.map((s) => `${s}:${GUARD_DATA_REL}`),
    )
    if (texts instanceof Map)
      for (const [k, v] of texts) {
        if (v !== null && v !== undefined) guardTexts.set(k, v)
      }
    for (const [sha, cs] of batchFaceChanges(root, chunk)) changeSets.set(sha, cs)
    for (const sha of chunk) {
      if (!guardTexts.has(`${sha}:${GUARD_DATA_REL}`)) {
        try {
          guardTexts.set(
            `${sha}:${GUARD_DATA_REL}`,
            String(gitRaw(['show', `${sha}:${GUARD_DATA_REL}`], root)),
          )
        } catch {
          /* 走下面的 listBad */
        }
      }
      if (!changeSets.has(sha)) {
        try {
          changeSets.set(sha, listFaceChanges(root, 'head', sha))
        } catch {
          /* 走下面的 listBad */
        }
      }
    }
  }

  const selected = []
  for (const m of preCandidates) {
    const guardText = guardTexts.get(`${m.sha}:${GUARD_DATA_REL}`)
    const own = guardText === undefined ? null : parseGuardList(guardText)
    const changes = changeSets.get(m.sha)
    if (!own || own.problems.length || !changes || !changes.length) {
      counts.listBad += 1
      console.warn(`[sign-detached] 跳过 ${m.sha}：该枚自己的清单/差异集取不到（不猜）`)
      continue
    }
    const out = decide({
      entries: own.entries,
      changes,
      message: m.message,
      today: policyDate,
      key: submitRes.key,
      signatureRequiredFrom: own.signatureRequiredFrom,
      sha: m.sha,
      ackRows: [],
      attestRows,
      detachedRows: [],
      commitDate: m.commitDate,
      ackKey: ackRes.key,
    })
    if (out.code !== 'undeclared-unsigned') {
      counts.notRed += 1
      continue
    }
    if (existingRows.some((r) => r.sha === m.sha)) {
      counts.already += 1
      continue
    }
    selected.push({
      sha: m.sha,
      commitDate: m.commitDate,
      reason: m.reason,
      paths: pathSetOf(changes),
      entries: own.entries,
      ownSignatureRequiredFrom: own.signatureRequiredFrom,
      changes,
      message: m.message,
      subject: String(out.subject ?? '').trim(),
    })
  }

  console.log(
    `[sign-detached] 区间 ${opts.range}：非 merge ${meta.length} 枚 / 已有文字理由但无签名且到期会判红 ${selected.length} 枚`,
  )
  console.log(
    `[sign-detached] 未选：无理由或理由过短 ${counts.noReason} / 已有签名行 ${counts.hasSig} / 已在追认台账 ${counts.attested} / 清单或差异集取不到 ${counts.listBad} / 到期当天不判红 ${counts.notRed} / 既有台账已覆盖 ${counts.already}`,
  )

  const fresh = []
  for (const item of selected) {
    if (item.commitDate && opts.signedAt < item.commitDate)
      fail(
        `--signed-at ${opts.signedAt} 早于 ${item.sha} 的提交日 ${item.commitDate} ⇒ 拒签（不许倒签）`,
      )
    let sig
    try {
      sig = signDetached({
        sha: item.sha,
        paths: item.paths,
        reason: item.reason,
        signedAt: opts.signedAt,
        key: ackRes.key,
      })
    } catch (e) {
      fail(`签发失败（${item.sha}）：${e.message}`)
    }
    if (!DETACHED_SIG_RE.test(sig)) fail(`签发结果形状坏（${item.sha}）：${sig}`)
    const row = {
      sha: item.sha,
      paths: item.paths,
      reason: item.reason,
      signedAt: opts.signedAt,
      sig,
    }

    // 自检 1：重算 payload ⇒ 必须与 sig 一致（防"签的和验的不是同一个字节"）。
    const recomputed = signDetached({ ...row, key: ackRes.key })
    if (recomputed !== sig) fail(`自检失败（${item.sha}）：payload 重算签名不一致`)

    // 自检 2：把这一行单独喂给判定层 ⇒ 必须被它自己认成 detached-valid（逐枚端到端）。
    const self = decide({
      entries: item.entries,
      changes: item.changes,
      message: item.message,
      today: policyDate,
      key: submitRes.key,
      signatureRequiredFrom: item.ownSignatureRequiredFrom,
      sha: item.sha,
      ackRows: [],
      attestRows,
      detachedRows: [row],
      commitDate: item.commitDate,
      ackKey: ackRes.key,
    })
    if (self.code !== 'detached-valid' || self.exit !== 0)
      fail(`自检失败（${item.sha}）：独立判定得到 ${self.code}（exit ${self.exit}）`)

    fresh.push(row)
    console.log(
      `  ✅ ${item.sha}「${item.subject}」paths=${row.paths.length} reason=${[...row.reason].length}字 signedAt=${row.signedAt} sig=${sig.slice(0, 12)}… 自检=detached-valid`,
    )
  }

  const allRows = [...existingRows, ...fresh].sort((a, b) =>
    a.sha < b.sha ? -1 : a.sha > b.sha ? 1 : 0,
  )
  const body = allRows
    .map((r) =>
      JSON.stringify({
        sha: r.sha,
        paths: r.paths,
        reason: r.reason,
        signedAt: r.signedAt,
        sig: r.sig,
      }),
    )
    .join('\n')

  if (opts.dryRun) {
    console.log(
      `[sign-detached] --dry-run：应写 ${allRows.length} 条（新增 ${fresh.length} 条）→ ${opts.out}（未落盘）`,
    )
  } else {
    writeFileSync(outPath, body ? `${body}\n` : '', 'utf8')
    console.log(
      `[sign-detached] 写出 ${allRows.length} 条（新增 ${fresh.length} 条）→ ${opts.out}（密钥来源：${ackRes.source}）`,
    )
  }
  console.log(
    `[sign-detached] 待签清单是现算的：区间 ${opts.range} + 到期日 ${policyDate}（取自 origin/main 的 signatureRequiredFrom），没有把任何数量写死`,
  )
}

export { pathSetOf, readRangeMeta }

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
