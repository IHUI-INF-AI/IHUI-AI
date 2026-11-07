#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-db-migration-gaps.mjs —— DB 迁移账本的「中间缺口」审计(只读默认,修复需显式 --repair --yes)
 *
 * 立因(2026-10-25 生产实测):
 *   `drizzle-kit migrate` 只应用 `when > max(账本.created_at)` 的迁移。一个**带旧 when 的迁移晚到**
 *   (并发分支合并 / 编号重排 / 手工补文件)就会被**永久跳过**,而 migrate 仍 exit 0。
 *   部署侧旧判据只看「journal 条数 − 账本条数」,既分不清「中间缺口(永不补)」与「待应用(下轮会补)」,
 *   又把 1 条真实缺口报成档位噪音。实测后果:D125 协作表 `chat_conversation_collaborators` /
 *   `chat_message_comments` 在生产**根本没有建表**,而部署日志只说“迁移未落地 1-3 档”。
 *
 * 判据(纯函数 classifyMigrationGaps,构造面可证):
 *   · applied   账本里 created_at == 该文件的 when 的行,hash == **该文件当前字节** sha256(逐行身份);
 *   · hashDrift 该 when 有账本行但 hash 不等于本文件当前字节 ⇒ 要么当年应用后文件被改,
 *               要么账本绑定到了别的 tag 的字节。若该 hash 唯一命中另一个当前文件,额外标
 *               suspectedShift(提示,不计 applied/不计绿);
 *   · pending   hash 缺 ∧ when > maxApplied ⇒ drizzle 下一轮会应用;
 *   · lateGap   hash 缺 ∧ when 不在账本里 ∧ when <= maxApplied ⇒ **drizzle 永不应用** ⇒ 判红。
 *
 * 用法:
 *   node scripts/check-db-migration-gaps.mjs                 # 只读审计
 *   node scripts/check-db-migration-gaps.mjs --json          # 机器可读
 *   node scripts/check-db-migration-gaps.mjs --repair --yes  # 应用 lateGap 的 SQL 并补账本行
 *   node scripts/check-db-migration-gaps.mjs --fail-on-hash-drift  # T9:未豁免的新漂移判红(存量按清单豁免)
 *   node scripts/check-db-migration-gaps.mjs --self-test
 *   --env-file <path>   DSN 来源(默认 apps/api/.env;也可直接用 env DATABASE_URL)
 *   --journal <path>    journal(默认 packages/database/drizzle/meta/_journal.json)
 *   --exempt <path>     hashDrift 存量豁免清单(默认 scripts/migration-hash-drift-exempt.json)
 *   --backup-dir <path> 修复前账本快照目录(默认 D:/DevEnv/backups,§5b 批准落点;env IHUI_BACKUP_DIR 可覆盖)
 *
 * T9 口径:hashDrift 由「只报数」升为**可阻断**,但只对**清单外的新漂移**判红(存量 25 条逐条给了
 * compensated/rewrite-verified/watermark-verified/pending 处理路径);清单不合法(compensation 文件缺失、
 * pending 无票号)属配置错误,直接 exit 2,不做静默降级。
 *
 * 退出码:0 = 无 lateGap(且 blocking 档下无未豁免漂移);1 = 有 lateGap / 未豁免漂移(或修复中某条失败);
 *        2 = 未判定(psql/DSN/库/journal 取不到,或豁免清单不合法)。
 * 密码纪律:DSN 只经 PGPASSWORD 传给子进程,绝不进 argv/日志;任何输出都不打印 DSN。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { requireFlagValue } from './lib/flag-value.mjs'
import { locatePsqlClient } from './lib/psql-client-locate.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_JOURNAL = join(ROOT, 'packages/database/drizzle/meta/_journal.json')
const DEFAULT_ENV_FILE = join(ROOT, 'apps/api/.env')
const DEFAULT_BACKUP_DIR = 'D:/DevEnv/backups'
const DEFAULT_EXEMPT_PATH = join(ROOT, 'scripts/migration-hash-drift-exempt.json')
const EXEMPT_STATES = new Set(['compensated', 'rewrite-verified', 'watermark-verified', 'pending'])

/** journal 在 `<drizzle>/meta/` 下,而 SQL 文件在 `<drizzle>/` —— 两者差一层,取错会把每条都读成“文件缺失”。 */
export function migrationsDirOf(journalPath) {
  return resolve(dirname(journalPath), '..')
}

/**
 * 纯判据:journal + 账本 + 文件 hash ⇒ 四桶。
 * `applied` 形如 `[{ hash, createdAt }]`(createdAt 可为 null/数字/数字字符串)。
 *
 * 2026-11-07 收紧:applied 只认**逐行身份**——created_at == 本 tag 的 when **且**
 * hash == 本 tag 当前文件 hash。账本 hash 在别的 tag 文件里命中,一律不算 applied,
 * 只作为 `suspectedShift` 提示(此时本行仍进 hashDrift)。原因是全局集合命中会让
 * 错位行的哈希给邻居发绿卡:实测 147 条绑定错位里 137 条被旧判据记成 applied。
 *
 * suspectedShift 只在「该 hash 唯一对应另一个当前文件」时给出;两个不同 tag 的文件
 * 恰好同字节时,hash 不唯一,不能当作位移证据,只保留 hashDrift 红。
 */
export function classifyMigrationGaps({ journal, applied, fileHashOf }) {
  const entries = Array.isArray(journal?.entries) ? journal.entries : []
  const ownHashes = entries.map((e) => fileHashOf(e))
  const hashToEntries = new Map()
  ownHashes.forEach((h, idx) => {
    if (!h) return
    const prev = hashToEntries.get(h) ?? []
    prev.push(idx)
    hashToEntries.set(h, prev)
  })
  const hashesByWhen = new Map()
  let maxApplied = -Infinity
  for (const a of applied ?? []) {
    if (a?.createdAt !== null && a?.createdAt !== undefined && a?.createdAt !== '') {
      const n = Number(a.createdAt)
      if (Number.isFinite(n)) {
        const key = String(n)
        if (n > maxApplied) maxApplied = n
        if (a?.hash) {
          const set = hashesByWhen.get(key) ?? new Set()
          set.add(String(a.hash))
          hashesByWhen.set(key, set)
        }
      }
    }
  }
  if (!Number.isFinite(maxApplied)) maxApplied = 0
  const out = { applied: [], hashDrift: [], pending: [], lateGap: [], maxApplied, suspectedShift: [] }
  entries.forEach((e, idx) => {
    const when = Number(e.when)
    const own = ownHashes[idx]
    const rowHashes = hashesByWhen.get(String(when))
    if (own && rowHashes?.has(own)) {
      out.applied.push(e)
      return
    }
    if (rowHashes) {
      let hint = null
      for (const h of rowHashes) {
        const targets = hashToEntries.get(h) ?? []
        if (targets.length !== 1) continue
        const to = targets[0]
        if (to === idx) continue
        hint = { toTag: entries[to]?.tag ?? '', offset: to - idx, ledgerHash: h }
        break
      }
      out.hashDrift.push(hint ? { ...e, suspectedShift: hint } : e)
      if (hint) out.suspectedShift.push({ tag: e.tag, ...hint })
      return
    }
    if (when > maxApplied) out.pending.push(e)
    else out.lateGap.push(e)
  })
  return out
}

/**
 * T9 hashDrift 存量豁免清单校验(纯函数;`fileExists` 由调用方注入以便构造面测试)。
 * 契约:进入清单的 tag 必须:
 *   · state ∈ 四档;compensated 的 compensation 文件必须真实存在(防“写了票没落地”);
 *   · rewrite-verified / watermark-verified 必须有 evidence(commit 短号);
 *   · pending 必须有 ticket(未定性也要留追号,不许裸豁免)。
 * 返回 { ok, byTag:Map<tag,entry>, problems:string[] }。
 */
export function loadHashDriftExempt(raw, fileExists = () => true) {
  const problems = []
  const byTag = new Map()
  const entries = Array.isArray(raw?.entries) ? raw.entries : []
  if (!entries.length) problems.push('豁免清单为空或缺少 entries 数组')
  for (const e of entries) {
    const tag = String(e?.tag ?? '').trim()
    if (!tag) {
      problems.push('存在 tag 为空的条目')
      continue
    }
    if (byTag.has(tag)) problems.push(`${tag}:重复条目`)
    if (!EXEMPT_STATES.has(e?.state)) {
      problems.push(`${tag}:state 非法(${e?.state})`)
      continue
    }
    if (e.state === 'compensated') {
      if (!e.compensation) problems.push(`${tag}:compensated 缺 compensation`)
      else if (!fileExists(e.compensation)) problems.push(`${tag}:compensation 文件不存在(${e.compensation})`)
    } else if (e.state === 'pending') {
      if (!e.ticket) problems.push(`${tag}:pending 缺 ticket`)
    } else if (!e.evidence) {
      problems.push(`${tag}:${e.state} 缺 evidence`)
    }
    byTag.set(tag, e)
  }
  return { ok: problems.length === 0, byTag, problems }
}

/**
 * 把 hashDrift 分成「已豁免(存量)」与「未豁免(新增)」。
 * 只有未豁免的 tag 在 --fail-on-hash-drift 档下判红;pending 计入存量但单独报数。
 */
export function partitionHashDrift(driftTags, exempt) {
  const known = exempt?.byTag ?? new Map()
  const out = { exempted: [], unexplained: [], counts: {} }
  for (const tag of driftTags ?? []) {
    const e = known.get(tag)
    if (e) {
      out.exempted.push({ tag, state: e.state })
      out.counts[e.state] = (out.counts[e.state] ?? 0) + 1
    } else {
      out.unexplained.push(tag)
    }
  }
  return out
}

/** DSN 只许来自 env 或 env 文件的 DATABASE_URL;输出永不回显。 */
export function readDsn({ envFile = DEFAULT_ENV_FILE, env = process.env } = {}) {
  if (env.DATABASE_URL) return { ok: true, dsn: env.DATABASE_URL.trim(), from: 'env' }
  try {
    const m = readFileSync(envFile, 'utf8').match(/^DATABASE_URL=(.*)$/m)
    if (m && m[1].trim()) return { ok: true, dsn: m[1].trim(), from: envFile }
    return { ok: false, why: `${envFile} 里没有非空 DATABASE_URL` }
  } catch (e) {
    return { ok: false, why: `读不到 ${envFile}(${String(e?.code ?? e)})` }
  }
}

export function psqlArgsFromDsn(dsn) {
  let u
  try {
    u = new URL(dsn)
  } catch {
    return { ok: false, why: 'DSN 不是合法 URL' }
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return { ok: false, why: `DSN 协议不是 postgres(${u.protocol})` }
  return {
    ok: true,
    args: ['-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username), '-d', u.pathname.slice(1)],
    env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password) },
  }
}

function runPsql(psql, dsn, extra, { timeout = 60_000 } = {}) {
  const p = psqlArgsFromDsn(dsn)
  if (!p.ok) return { ok: false, why: p.why }
  const r = spawnSync(psql, [...p.args, ...extra], {
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: p.env,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.error) return { ok: false, why: String(r.error.code ?? r.error.message) }
  if (r.status !== 0) return { ok: false, why: `psql exit=${r.status}: ${String(r.stderr ?? '').trim().slice(0, 200)}` }
  return { ok: true, stdout: String(r.stdout ?? '') }
}

function readApplied(psql, dsn) {
  const r = runPsql(psql, dsn, ['-At', '-F', '\t', '-c', 'select hash, coalesce(created_at::text, \'\') from drizzle.__drizzle_migrations;'])
  if (!r.ok) return r
  const rows = r.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, createdAt] = line.split('\t')
      return { hash: (hash ?? '').trim(), createdAt: (createdAt ?? '').trim() }
    })
  return { ok: true, applied: rows }
}

export const __test__ = {
  classifyMigrationGaps,
  loadHashDriftExempt,
  partitionHashDrift,
  readDsn,
  migrationsDirOf,
}

function selfTest() {
  const checks = []
  const ok = (name, cond) => checks.push([name, !!cond])
  const journal = {
    entries: [
      { tag: 'a_applied', when: 100 },
      { tag: 'b_late', when: 200 },
      { tag: 'c_pending', when: 400 },
      { tag: 'd_drift', when: 300 },
    ],
  }
  const applied = [
    { hash: 'h-a', createdAt: 100 },
    { hash: 'h-d-old', createdAt: 300 },
    { hash: 'h-last', createdAt: 300 },
  ]
  const fileHashOf = (e) => ({ a_applied: 'h-a', b_late: 'h-b', c_pending: 'h-c', d_drift: 'h-d-new' })[e.tag]
  const r = classifyMigrationGaps({ journal, applied, fileHashOf })
  ok('S1 已应用按 hash 认', r.applied.length === 1 && r.applied[0].tag === 'a_applied')
  ok('S2 中间缺口:hash 缺 ∧ when 不在账本 ∧ ≤ maxApplied ⇒ lateGap', r.lateGap.length === 1 && r.lateGap[0].tag === 'b_late')
  ok('S3 when > maxApplied ⇒ pending(drizzle 下轮会补)', r.pending.length === 1 && r.pending[0].tag === 'c_pending')
  ok('S4 hash 漂移但 when 在账本 ⇒ hashDrift(只报数,不判红)', r.hashDrift.length === 1 && r.hashDrift[0].tag === 'd_drift')
  ok('S5 maxApplied 取账本最大值', r.maxApplied === 300)
  const empty = classifyMigrationGaps({ journal: { entries: [] }, applied: [], fileHashOf: () => null })
  ok('S6 空 journal ⇒ 四桶全空(不静默造红)', empty.applied.length + empty.lateGap.length + empty.pending.length + empty.hashDrift.length === 0)

  // S6b/S6c:逐行身份 + 疑似位移边界
  const nextJournal = { entries: [{ tag: 'x', when: 100 }, { tag: 'y', when: 200 }] }
  const nextApplied = [{ hash: 'h-y', createdAt: 100 }, { hash: 'h-x-old', createdAt: 200 }]
  const nextHash = (e) => ({ x: 'h-x', y: 'h-y' })[e.tag]
  const nr = classifyMigrationGaps({ journal: nextJournal, applied: nextApplied, fileHashOf: nextHash })
  ok(
    'S6b binding-next:全局命中不发绿,本行 hashDrift 且带疑似位移 +1',
    nr.applied.length === 0 &&
      nr.hashDrift.length === 2 &&
      nr.hashDrift[0].suspectedShift?.offset === 1 &&
      nr.hashDrift[0].suspectedShift?.toTag === 'y',
  )
  const dupJournal = { entries: [{ tag: 'a', when: 100 }, { tag: 'b', when: 200 }, { tag: 'c', when: 300 }] }
  const dupApplied = [{ hash: 'h-dup', createdAt: 100 }, { hash: 'h-b-own', createdAt: 200 }]
  const dupHash = (e) => ({ a: 'h-a', b: 'h-dup', c: 'h-dup' })[e.tag]
  const dr = classifyMigrationGaps({ journal: dupJournal, applied: dupApplied, fileHashOf: dupHash })
  ok(
    'S6c 两个不同 tag 同字节:hash 不唯一 ⇒ 不标疑似位移,但本行仍红',
    dr.hashDrift.some((e) => e.tag === 'a') && !dr.hashDrift.find((e) => e.tag === 'a')?.suspectedShift,
  )
  const sameJournal = { entries: [{ tag: 'p', when: 100 }, { tag: 'q', when: 200 }] }
  const sameApplied = [{ hash: 'h-same', createdAt: 100 }, { hash: 'h-same', createdAt: 200 }]
  const sr = classifyMigrationGaps({ journal: sameJournal, applied: sameApplied, fileHashOf: () => 'h-same' })
  ok('S6d 两 tag 同字节且各自账本行都自证 ⇒ 两条都绿(不因重复 hash 误红)', sr.applied.length === 2)

  // T9 豁免清单:契约校验 + 存量/新增分割
  const goodRaw = {
    entries: [
      { tag: 'x1', state: 'compensated', compensation: '20261107006000_a.sql' },
      { tag: 'x2', state: 'rewrite-verified', evidence: 'abc1234' },
      { tag: 'x3', state: 'watermark-verified', evidence: 'def5678' },
      { tag: 'x4', state: 'pending', ticket: 'DB-DRIFT-01' },
    ],
  }
  const good = loadHashDriftExempt(goodRaw, (f) => f === '20261107006000_a.sql')
  ok('S7 合法豁免清单 ⇒ ok', good.ok && good.byTag.size === 4)
  const bad = loadHashDriftExempt(
    {
      entries: [
        { tag: 'y1', state: 'compensated', compensation: 'missing.sql' },
        { tag: 'y2', state: 'pending' },
        { tag: 'y3', state: 'bogus' },
        { tag: 'y1', state: 'rewrite-verified', evidence: 'e' },
      ],
    },
    () => false,
  )
  ok('S8 非法清单 ⇒ 逐条报问题(缺文件/缺票/state 非法/重复)', bad.ok === false && bad.problems.length === 4)
  const part = partitionHashDrift(['x1', 'x2', 'zz_new'], good)
  ok('S9 存量豁免、新增未豁免', part.exempted.length === 2 && part.unexplained.length === 1 && part.unexplained[0] === 'zz_new')
  const partNo = partitionHashDrift(['x1'], { byTag: new Map() })
  ok('S10 清单为空 ⇒ 全部未豁免(不静默放水)', partNo.unexplained.length === 1)

  let fails = 0
  for (const [name, pass] of checks) {
    if (!pass) fails++
    console.log(`${pass ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n自检:${checks.length - fails} 通过 / ${fails} 失败`)
  return fails === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  const has = (f) => argv.includes(f)
  const opt = (f, d, noun = '路径') => {
    const r = requireFlagValue(argv, f, { noun, fallback: d })
    if (r.error) {
      console.error(`❌ 用法错:${r.error}`)
      process.exit(2)
    }
    return r.value
  }
  if (has('--self-test')) return selfTest()
  const journalPath = opt('--journal', DEFAULT_JOURNAL)
  const envFile = opt('--env-file', DEFAULT_ENV_FILE)
  const backupDir = opt('--backup-dir', process.env.IHUI_BACKUP_DIR || DEFAULT_BACKUP_DIR)
  const repair = has('--repair')
  const json = has('--json')
  const failOnDrift = has('--fail-on-hash-drift')
  const exemptPath = opt('--exempt', DEFAULT_EXEMPT_PATH)

  let journal
  try {
    journal = JSON.parse(readFileSync(journalPath, 'utf8'))
  } catch (e) {
    console.log(`⚠️ 未判定 —— journal 读不到:${journalPath}(${String(e?.code ?? e)})`)
    console.log('GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0')
    return 2
  }
  const loc = locatePsqlClient()
  if (!loc.psql) {
    console.log(`⚠️ 未判定 —— ${loc.tried.join(' | ')}`)
    console.log('GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0')
    return 2
  }
  const d = readDsn({ envFile })
  if (!d.ok) {
    console.log(`⚠️ 未判定 —— ${d.why}`)
    console.log('GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0')
    return 2
  }
  const ap = readApplied(loc.psql, d.dsn)
  if (!ap.ok) {
    console.log(`⚠️ 未判定 —— 账本读不到:${ap.why}`)
    console.log('GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0')
    return 2
  }
  const dir = migrationsDirOf(journalPath)
  const fileHashOf = (e) => {
    const f = join(dir, `${e.tag}.sql`)
    if (!existsSync(f)) return null
    return createHash('sha256').update(readFileSync(f)).digest('hex')
  }
  const g = classifyMigrationGaps({ journal, applied: ap.applied, fileHashOf })

  // T9:hashDrift 存量豁免清单(缺文件/坏条目一律 exit 2,不静默降级)
  let exemptRaw
  try {
    exemptRaw = JSON.parse(readFileSync(exemptPath, 'utf8'))
  } catch (e) {
    console.log(`⚠️ 未判定 —— hashDrift 豁免清单读不到:${exemptPath}(${String(e?.code ?? e)})`)
    console.log('GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0')
    return 2
  }
  const exempt = loadHashDriftExempt(exemptRaw, (name) => existsSync(join(dir, name)))
  if (!exempt.ok) {
    console.error(`❌ hashDrift 豁免清单不合法(${exemptPath}):`)
    for (const p of exempt.problems) console.error(`  · ${p}`)
    console.log('GAPS-RESULT state=undetermined lateGap=0 pending=0 hashDrift=0')
    return 2
  }
  const part = partitionHashDrift(g.hashDrift.map((e) => e.tag), exempt)
  const driftCounts =
    `compensated=${part.counts.compensated ?? 0}/rewrite=${part.counts['rewrite-verified'] ?? 0}/` +
    `watermark=${part.counts['watermark-verified'] ?? 0}/pending=${part.counts.pending ?? 0}`

  const fmt = (list) => list.slice(0, 20).map((e) => `${e.tag}(${new Date(Number(e.when)).toISOString().slice(0, 10)})`)
  if (json) {
    console.log(
      JSON.stringify({
        applied: g.applied.length,
        pending: g.pending.map((e) => e.tag),
        lateGap: g.lateGap.map((e) => ({ tag: e.tag, when: e.when })),
        hashDrift: g.hashDrift.map((e) => e.tag),
        suspectedShift: g.suspectedShift,
        hashDriftExempted: part.exempted,
        hashDriftUnexplained: part.unexplained,
        maxApplied: g.maxApplied,
      }),
    )
  } else {
    console.log(
      `应用账本: applied=${g.applied.length} / lateGap=${g.lateGap.length} / pending=${g.pending.length} / ` +
        `hashDrift=${g.hashDrift.length}(豁免 ${part.exempted.length},未豁免 ${part.unexplained.length})`,
    )
    if (g.lateGap.length) console.log(`  ❌ 中间缺口(drizzle 永不应用):${fmt(g.lateGap).join(', ')}`)
    if (g.pending.length) console.log(`  ⏳ 待应用(drizzle 下轮会补):${fmt(g.pending).join(', ')}`)
    if (g.hashDrift.length)
      console.log(
        `  ℹ️ 账本 hash 与现文件不同但 when 已在账:共 ${g.hashDrift.length} 条,` +
          `其中疑似位移 ${g.suspectedShift.length} 条,` +
          `存量豁免 ${part.exempted.length}(${driftCounts}),未豁免 ${part.unexplained.length}`,
      )
    if (part.unexplained.length)
      console.log(
        `  ${failOnDrift ? '❌' : '⚠️'} 未豁免漂移${failOnDrift ? '(blocking)' : '(仅告警,加 --fail-on-hash-drift 即红)'}:` +
          `${fmt(part.unexplained.map((tag) => ({ tag, when: journal.entries.find((e) => e.tag === tag)?.when }))).join(', ')}`,
      )
    if (part.counts.pending)
      console.log(`  📝 未定性存量 ${part.counts.pending} 条(pending 票号见 scripts/migration-hash-drift-exempt.json)`)
  }

  if (!repair) {
    // `--json` 契约:**只输出一行 JSON**,不再追加人读摘要 —— 调用方(守护/部署)按“最后一行”解析,
    // 多一行摘要就等于把可解析读数永远判成"未判定"(2026-10-25 实测踩中)。
    const red = g.lateGap.length > 0 || (failOnDrift && part.unexplained.length > 0)
    if (!json)
      console.log(
        `GAPS-RESULT state=${red ? 'red' : 'ok'} lateGap=${g.lateGap.length} pending=${g.pending.length} ` +
          `hashDrift=${g.hashDrift.length} hashDriftSuspected=${g.suspectedShift.length} ` +
          `hashDriftUnexplained=${part.unexplained.length}`,
      )
    return red ? 1 : 0
  }
  if (!has('--yes')) {
    console.log('❌ 修复档必须显式 --yes(会在生产库执行 DDL 并写迁移账本)')
    return 2
  }
  if (!g.lateGap.length) {
    console.log('GAPS-RESULT state=ok lateGap=0(无需修复)')
    return 0
  }
  // 修复前先快照账本(小文本,回滚凭据)
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const snap = join(backupDir, `pg-ledger-${ts}.tsv`)
  try {
    mkdirSync(backupDir, { recursive: true })
    const raw = runPsql(loc.psql, d.dsn, ['-At', '-F', '\t', '-c', 'select id, hash, coalesce(created_at::text, \'\') from drizzle.__drizzle_migrations order by id;'])
    if (!raw.ok) throw new Error(raw.why)
    writeFileSync(snap, raw.stdout)
    console.log(`账本快照:${snap}`)
  } catch (e) {
    console.log(`❌ 修复前快照失败,拒绝改写生产账本:${String(e?.message ?? e).slice(0, 160)}`)
    return 2
  }
  for (const e of g.lateGap) {
    const f = join(dir, `${e.tag}.sql`)
    if (!existsSync(f)) {
      console.log(`❌ ${e.tag}:SQL 文件不在位,停止(已应用的批次不回滚;快照见上)`)
      return 1
    }
    const apply = runPsql(loc.psql, d.dsn, ['-v', 'ON_ERROR_STOP=1', '-1', '-f', f])
    if (!apply.ok) {
      console.log(`❌ ${e.tag}:应用失败,停止(${apply.why})`)
      return 1
    }
    const hash = fileHashOf(e)
    const ins = runPsql(loc.psql, d.dsn, [
      '-v',
      'ON_ERROR_STOP=1',
      '-1',
      '-c',
      `insert into drizzle.__drizzle_migrations(hash, created_at) values ('${hash}', ${Number(e.when)});`,
    ])
    if (!ins.ok) {
      console.log(`⚠️ ${e.tag}:SQL 已应用但账本行写入失败(${ins.why})—— 重跑本器会重复应用,需人工补账本`)
      return 1
    }
    console.log(`✅ ${e.tag}:已应用并补账本`)
  }
  console.log(`GAPS-RESULT state=repaired lateGap=${g.lateGap.length}`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
