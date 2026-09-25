#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 迁移记账守门(check-migration-bookkeeping.mjs)
 *
 * 校验 packages/database/drizzle 的 journal 与 .sql 是否严格一一对应、when 是否
 * 严格单调唯一;并可选(--db)对库内 drizzle.__drizzle_migrations 做双射强校验。
 *
 * 背景(2026-09-13 实测):
 *   1. drizzle-kit migrate 的判据是 `Number(DB.created_at) < entry.when`。
 *      本仓库 journal 的 when 一度是**合成时间戳**(等差 +86400000,止于 1721513600000),
 *      而库内 created_at 是真实时间(1788717703662)→ 判据恒假 → migrate 每轮空转、
 *      一条也不应用。修复后 journal 与库双射对齐(254 ↔ 254,when 集合完全相同)。
 *   2. 另一条基于 sha256 记账的旧通道(D:/DevEnv/tools/apply-migrations.py)与磁盘
 *      .sql **0 命中** —— 迁移文件被注入零宽溯源水印后内容改变,旧 hash 全失效。
 *   → 结构性事实(journal↔sql 一一对应、when 单调唯一、库↔journal 双射)必须有守门,
 *     否则下一次漂移仍会静默发生。
 *
 * 检测维度:
 *   离线(默认;CI 安全、无 DB 依赖):
 *     B1 journal 的 tag 集合 == drizzle/*.sql 的 basename 集合(双向)
 *     B2 tag 唯一
 *     B3 when 严格递增且唯一
 *     B4 idx 唯一(idx 断号仅告警 —— drizzle 按 tag 配对 SQL、按 when 排序,idx 只是元数据)
 *     B5 journal 结构完整(version / dialect / entries 数组,entry 必含 idx/tag/when)
 *   在线(--db):
 *     B6 库内行数 == journal 条目数
 *     B7 库内 created_at 集合 == journal when 集合(严格双射)
 *     B8 max(created_at) == max(when)(migrate「不空转」的充要条件)
 *     B9 库内每行 hash 均为合法 sha256(64 位十六进制)且唯一 —— 防再现 2026-09-13 的
 *        污染形态(453 行中含 153 个重复 hash 与 `NOFILE:` / `manual_` 伪值)
 *   旁路(warn 级,**不并入 B1-B5 的判红面**,也不改它们的退出码):
 *     B10 journal 登记表当前是否「无人 in flight」—— 报五路径( journal / 两张 schema /
 *        api 的 chat 路由与查询 )的 git 状态(已暂存 / 仅工作树脏 / 干净),以及
 *        packages/database/drizzle 下**未跟踪的 .sql** 清单。
 *        起因(2026-09-25 实测):本门离线 B1-B5 全过、exit 0,而绿**只是因为该门按工作树取材、
 *        磁盘上正躺着别人未跟踪的迁移文件**,journal 的脏改动也没暂存。于是「账目结构合法」
 *        与「这张登记表当前无人在飞」被混为一谈,后来者会据绿抢跑追加 idx。
 *        本判据就是把第二件事变成机器可判的 —— 但只**报状态**,不判红:
 *        别人的在飞改动不是本次提交的错(同守门 70/77/83 的"恒红门只会逼人 --no-verify")。
 *        要问责请跑 `--require-idle`(CI / 巡检),默认不改退出码。
 *
 * 用法:
 *   node scripts/check-migration-bookkeeping.mjs            # 离线(默认)
 *   node scripts/check-migration-bookkeeping.mjs --staged   # pre-commit(等价离线)
 *   node scripts/check-migration-bookkeeping.mjs --require-idle  # B10 由「只报」升为「判红」
 *   node scripts/check-migration-bookkeeping.mjs --db       # 追加库校验
 *       (DSN 取自 $DATABASE_URL,否则读 apps/api/.env 的 DATABASE_URL;
 *        psql 取自 $IHUI_PSQL,否则 D:\DevEnv\runtimes\pgsql\bin\psql.exe,否则 PATH 上的 psql)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { resolveGitBin } from './lib/gitdir.mjs'

const ROOT = process.cwd()
const DIR = join(ROOT, 'packages/database/drizzle')
const JOURNAL = join(DIR, 'meta/_journal.json')

const args = process.argv.slice(2)
const wantDb = args.includes('--db')
// B10 定级开关:默认 warn(只报不改退出码);--require-idle 才升成判红(供 CI / 巡检问责)
const requireIdle = args.includes('--require-idle')

// 应急跳过(与仓库其它守门一致): HUSKY_SKIP_MIGRATION_BOOKKEEPING=1 git commit ...
if (process.env.HUSKY_SKIP_MIGRATION_BOOKKEEPING === '1') {
  console.log('[迁移记账] ⏭  已按 HUSKY_SKIP_MIGRATION_BOOKKEEPING=1 跳过')
  process.exit(0)
}

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}
const fail = []
const warn = []
function ok(msg) {
  console.log(`  ${C.green}✓${C.reset} ${msg}`)
}
function bad(msg) {
  fail.push(msg)
  console.log(`  ${C.red}✗${C.reset} ${msg}`)
}
function wa(msg) {
  warn.push(msg)
  console.log(`  ${C.yellow}!${C.reset} ${msg}`)
}

// ---------- B5: journal 结构 ----------
if (!existsSync(JOURNAL)) {
  console.error(`${C.red}[迁移记账] 找不到 ${JOURNAL}${C.reset}`)
  process.exit(1)
}
let journal
try {
  journal = JSON.parse(readFileSync(JOURNAL, 'utf8'))
} catch (e) {
  console.error(`${C.red}[迁移记账] ${JOURNAL} 不是合法 JSON: ${e.message}${C.reset}`)
  process.exit(1)
}
if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
  console.error(`${C.red}[迁移记账] journal.entries 缺失或为空${C.reset}`)
  process.exit(1)
}
console.log(`${C.bold}[迁移记账] journal 结构${C.reset}`)
const malformed = journal.entries.filter(
  (e) => typeof e.idx !== 'number' || !e.tag || typeof e.when !== 'number',
)
if (malformed.length) bad(`B5 有 ${malformed.length} 个 entry 缺 idx/tag/when(如 ${malformed[0].tag ?? '<无 tag>'})`)
else ok(`B5 journal 结构完整(version=${journal.version}, dialect=${journal.dialect}, ${journal.entries.length} 条)`)

// ---------- 集合准备 ----------
const tags = journal.entries.map((e) => e.tag)
const whens = journal.entries.map((e) => e.when)
const idxs = journal.entries.map((e) => e.idx)
const sqls = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.slice(0, -4))

// ---------- B1: 双向一一对应 ----------
console.log(`${C.bold}[迁移记账] journal ↔ .sql 对应${C.reset}`)
{
  const tagSet = new Set(tags)
  const sqlSet = new Set(sqls)
  const journalNoSql = tags.filter((t) => !sqlSet.has(t))
  const sqlNoJournal = sqls.filter((s) => !tagSet.has(s))
  if (journalNoSql.length) bad(`B1 journal 有条目但缺 .sql(${journalNoSql.length}): ${journalNoSql.slice(0, 5).join(', ')}`)
  if (sqlNoJournal.length) bad(`B1 .sql 存在但 journal 未登记(${sqlNoJournal.length}): ${sqlNoJournal.slice(0, 5).join(', ')}`)
  if (!journalNoSql.length && !sqlNoJournal.length) ok(`B1 双向一一对应(${tags.length} ↔ ${sqls.length})`)
}

// ---------- B2: tag 唯一 ----------
console.log(`${C.bold}[迁移记账] 标识唯一性${C.reset}`)
{
  const seen = new Set()
  const dup = []
  for (const t of tags) {
    if (seen.has(t)) dup.push(t)
    seen.add(t)
  }
  if (dup.length) bad(`B2 tag 重复(${dup.length}): ${[...new Set(dup)].slice(0, 5).join(', ')}`)
  else ok('B2 tag 唯一')
}

// ---------- B3: when 严格递增且唯一 ----------
{
  const uniq = new Set(whens)
  if (uniq.size !== whens.length) {
    const dup = whens.filter((w, i) => whens.indexOf(w) !== i)
    bad(`B3 when 存在重复(${new Set(dup).size} 个值): ${[...new Set(dup)].slice(0, 5).join(', ')}`)
  }
  let mono = true
  for (let i = 1; i < whens.length; i++) if (whens[i] <= whens[i - 1]) mono = false
  if (!mono) bad('B3 when 非严格递增(drizzle 按 when 判定是否应用,顺序错乱会漏跑迁移)')
  if (mono && uniq.size === whens.length) ok('B3 when 严格递增且唯一')
}

// ---------- B4: idx(仅告警) ----------
{
  const uniq = new Set(idxs)
  if (uniq.size !== idxs.length) bad(`B4 idx 存在重复(${idxs.length - uniq.size} 个)`)
  else {
    const gaps = []
    const sorted = [...idxs].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) gaps.push(`${sorted[i - 1]}→${sorted[i]}`)
    if (gaps.length) wa(`B4 idx 断号(非阻塞): ${gaps.join(', ')} —— drizzle 按 tag 配对 SQL、按 when 排序,idx 仅元数据`)
    else ok('B4 idx 唯一且连续')
  }
}

// ---------- B6~B8: 库内记账双射(可选) ----------
if (wantDb) {
  console.log(`${C.bold}[迁移记账] 库内 drizzle.__drizzle_migrations 双射${C.reset}`)
  let dsn = process.env.DATABASE_URL || ''
  if (!dsn) {
    const envPath = join(ROOT, 'apps/api/.env')
    if (existsSync(envPath)) {
      const line = readFileSync(envPath, 'utf8')
        .split(/\r?\n/)
        .find((l) => /^\s*DATABASE_URL\s*=/.test(l))
      if (line) dsn = line.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim().replace(/^["']|["']$/g, '')
    }
  }
  if (!dsn) {
    wa('B6~B8 跳过:未找到 DATABASE_URL(env 或 apps/api/.env)')
  } else {
    const psqlCandidates = [
      process.env.IHUI_PSQL,
      'D:\\DevEnv\\runtimes\\pgsql\\bin\\psql.exe',
      'psql',
    ].filter(Boolean)
    const psql = psqlCandidates.find((p) => p === 'psql' || existsSync(p))
    try {
      const out = execFileSync(
        psql,
        [
          '-d',
          dsn,
          '-t',
          '-A',
          '-F',
          '|',
          '-c',
          'SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at',
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      )
      const rows = out
        .trim()
        .split(/\r?\n/)
        .filter((l) => l.trim() !== '')
        .map((l) => {
          const i = l.indexOf('|')
          return { createdAt: Number(l.slice(0, i).trim()), hash: l.slice(i + 1).trim() }
        })
      const dbWhens = rows.map((r) => r.createdAt).filter((n) => Number.isFinite(n))
      if (dbWhens.length !== whens.length) bad(`B6 行数不符: 库 ${dbWhens.length} vs journal ${whens.length}`)
      else ok(`B6 行数一致(${dbWhens.length})`)
      // B9: hash 合法性 —— 防再现 2026-09-13 的污染形态(153 个重复 hash + `NOFILE:`/`manual_` 伪值)
      {
        const badFmt = rows.filter((r) => !/^[0-9a-f]{64}$/.test(r.hash))
        const seen = new Set()
        const dup = []
        for (const r of rows) {
          if (seen.has(r.hash)) dup.push(r.hash)
          seen.add(r.hash)
        }
        if (badFmt.length) bad(`B9 有 ${badFmt.length} 行 hash 非合法 sha256(如 '${badFmt[0].hash.slice(0, 24)}')`)
        else if (dup.length) bad(`B9 有 ${new Set(dup).size} 个重复 hash(污染形态)`)
        else ok(`B9 ${rows.length} 行 hash 全为合法 sha256 且唯一`)
      }
      const a = [...whens].sort((x, y) => x - y)
      const b = [...dbWhens].sort((x, y) => x - y)
      const same = a.length === b.length && a.every((v, i) => v === b[i])
      if (same) ok('B7 created_at 集合与 journal when 集合严格双射')
      else {
        const bs = new Set(b)
        const as = new Set(a)
        bad(
          `B7 双射破裂: 仅 journal 有 ${a.filter((x) => !bs.has(x)).slice(0, 3).join(',')} / 仅库有 ${b
            .filter((x) => !as.has(x))
            .slice(0, 3)
            .join(',')}`,
        )
      }
      const dbMax = b.length ? b[b.length - 1] : -1
      const jMax = a.length ? a[a.length - 1] : -1
      if (dbMax === jMax) ok(`B8 max 一致(${jMax})→ migrate 不会空转,也不会重跑`)
      else if (dbMax > jMax) bad(`B8 库内 max(${dbMax})> journal max(${jMax})→ migrate 将恒空转(本仓 2026-09-13 故障形态)`)
      else wa(`B8 journal max(${jMax})> 库内 max(${dbMax})→ 存在待应用迁移(下一轮 deploy 会应用)`)
    } catch (e) {
      wa(`B6~B8 跳过:psql 执行失败(${String(e.message).split('\n')[0]})`)
    }
  }
}

// ---------- B10: journal 登记表是否「无人在飞」(warn 级,不并入 B1-B5 判红面) ----------
// 口径要点(三条都是刻意选择,改前三思):
//   ① 判的是**工作树 + 索引 + 未跟踪面**,不是 HEAD blob —— 本门问的就是"此刻有没有别人
//      正在改这张登记表",按 HEAD 判永远得到"空闲",等于没有这道判据。
//      (与 B1-B5 的取材面不同是有意的:B1-B5 判"账目结构合法",B10 判"登记表当前无人动"。)
//   ② 只报不判红。别人的在飞改动不是本次提交的错,与改动无关的 blocking 红只会逼人
//      --no-verify 并连带废掉全部守门(AGENTS §12e 同型)。问责出口是 --require-idle。
//   ③ 刻意**不调用 wa()**:wa() 会计入末尾「N 条告警」计数,而那个计数是 B1-B4 的口径。
//      B10 只新增自己的段落 + 一行独立小结,既有输出行逐字不变、退出码语义一字不动。
const B10_WATCH = [
  'packages/database/drizzle/meta/_journal.json',
  'packages/database/src/schema/chat.ts',
  'packages/database/src/schema/relation-tables.ts',
  'apps/api/src/routes/chat.ts',
  'apps/api/src/db/chat-queries.ts',
]
const B10_MIG_DIR = 'packages/database/drizzle'
const GIT_READ_TIMEOUT_MS = Number(process.env.IHUI_B10_GIT_TIMEOUT_MS) || 15000

/** git 只读调用:绝对路径 + safe.directory=* + windowsHide + timeout(AGENTS.md §5b / 守门 80) */
function gitReadonly(gitArgs) {
  const bin = resolveGitBin()
  if (!bin) throw new Error('未解析到 git 可执行文件(resolveGitBin 全部候选失败)')
  return execFileSync(bin, ['-c', 'safe.directory=*', '-C', ROOT, ...gitArgs], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: GIT_READ_TIMEOUT_MS,
  })
}

/** porcelain XY → 人话状态;同一路径多行取"更脏"的那一条 */
function classifyXy(xy) {
  if (xy.includes('U')) return { text: '未合并(merge 冲突中)', rank: 4 }
  const x = xy[0] ?? ' '
  const y = xy[1] ?? ' '
  if (x === '?') return { text: '未跟踪', rank: 3 }
  if (x !== ' ') return y !== ' ' ? { text: '已暂存 + 工作树另有改动', rank: 3 } : { text: '已暂存', rank: 3 }
  if (y !== ' ') return { text: '仅工作树脏', rank: 2 }
  return { text: '干净', rank: 0 }
}

/**
 * 探针:返回 { verdict: 'idle'|'busy'|'undetermined', paths:[{path,state}], untrackedSql:[...], reason? }
 * 取不到 git 状态 ⇒ verdict='undetermined' 且**绝不记为空闲**(失败必须响,B10 静默绿 = 没有)。
 */
function probeJournalIdle() {
  let inside = ''
  try {
    inside = gitReadonly(['rev-parse', '--is-inside-work-tree']).trim()
  } catch (e) {
    return { verdict: 'undetermined', paths: [], untrackedSql: [], reason: `git 不可用:${String(e.message).split('\n')[0]}` }
  }
  if (inside !== 'true') {
    return { verdict: 'undetermined', paths: [], untrackedSql: [], reason: `该目录不在 git 工作树内(rev-parse 返回 ${inside || '<空>'})` }
  }
  try {
    // 注意:git status --porcelain 对**不存在/未跟踪的路径**给空输出,与"干净"同形。
    // 故先用 ls-files 确认跟踪态,未跟踪一律判"无法判定",不得记为空闲。
    const tracked = new Set(
      gitReadonly(['ls-files', '--', ...B10_WATCH])
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    )
    const worst = new Map()
    for (const line of gitReadonly(['status', '--porcelain', '--', ...B10_WATCH]).split(/\r?\n/)) {
      if (line.trim() === '') continue
      const raw = line.slice(3)
      const p = (raw.includes(' -> ') ? raw.split(' -> ').pop() : raw).replace(/^"|"$/g, '').replace(/\\/g, '/')
      const s = classifyXy(line.slice(0, 2))
      const prev = worst.get(p)
      if (!prev || s.rank > prev.rank) worst.set(p, s)
    }
    const paths = B10_WATCH.map((p) => {
      if (!tracked.has(p)) return { path: p, state: '未被 git 跟踪', rank: -1 }
      const s = worst.get(p)
      return { path: p, state: s ? s.text : '干净', rank: s ? s.rank : 0 }
    })
    const untrackedSql = gitReadonly(['ls-files', '--others', '--exclude-standard', '--', B10_MIG_DIR])
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/\\/g, '/'))
      .filter((l) => l.endsWith('.sql'))
    const unknown = paths.filter((p) => p.rank === -1)
    if (unknown.length) {
      return {
        verdict: 'undetermined',
        paths,
        untrackedSql,
        reason: `${unknown.length} 个受控路径未被 git 跟踪(${unknown.map((u) => u.path).join(', ')})——无法判定是否空闲`,
      }
    }
    const dirty = paths.filter((p) => p.rank > 0)
    if (dirty.length || untrackedSql.length) return { verdict: 'busy', paths, untrackedSql }
    return { verdict: 'idle', paths, untrackedSql }
  } catch (e) {
    return { verdict: 'undetermined', paths: [], untrackedSql: [], reason: `git 查询失败:${String(e.message).split('\n')[0]}` }
  }
}

console.log(`${C.bold}[迁移记账] B10 journal 登记表空闲性(warn 级,不参与 B1-B5 判定)${C.reset}`)
const idle = probeJournalIdle()
for (const p of idle.paths) {
  const mark = p.rank > 0 ? C.yellow : p.rank === 0 ? C.green : C.yellow
  console.log(`  ${mark}${p.rank > 0 ? '!' : '✓'}${C.reset} ${p.path} ${C.dim}${p.state}${C.reset}`)
}
for (const f of idle.untrackedSql) {
  console.log(`  ${C.yellow}!${C.reset} ${f} ${C.dim}未跟踪的迁移文件(在飞)${C.reset}`)
}
if (idle.verdict === 'idle') {
  ok('B10 空闲:五路径全干净且 drizzle/ 下无未跟踪 .sql')
} else if (idle.verdict === 'busy') {
  const d = idle.paths.filter((p) => p.rank > 0).length
  console.log(
    `  ${C.yellow}! B10 未判定,有人在飞 —— 受控路径 ${d} 个脏 / 未跟踪迁移 ${idle.untrackedSql.length} 枚(已逐条点名)${C.reset}`,
  )
} else {
  console.log(`  ${C.yellow}! B10 未判定(无法取证):${idle.reason}${C.reset}`)
}
console.log(
  `  ${C.dim}结论:B1-B5 绿不等于 journal 空闲,凡追加 idx / 新增迁移的票,开工前置是本判据报空闲。${C.reset}`,
)

// ---------- 汇总 ----------
console.log('')
if (warn.length) console.log(`${C.yellow}[迁移记账] ${warn.length} 条告警(非阻塞)${C.reset}`)
if (fail.length) {
  console.error(`${C.red}${C.bold}[迁移记账] ✗ ${fail.length} 项失败${C.reset}`)
  fail.forEach((f) => console.error(`   - ${f}`))
  console.error(`\n修复提示:\n  node scripts/watermark.mjs list-uncovered   # 若 .sql 水印损坏导致内容变化\n  node scripts/check-migration-bookkeeping.mjs --db   # 对照库内记账\n`)
  process.exit(1)
}
console.log(`${C.green}${C.bold}[迁移记账] ✓ 全部通过(${tags.length} 条迁移,离线${wantDb ? ' + 库内双射' : ''})${C.reset}`)

// B10 问责档:只有 --require-idle 才把「非空闲 / 无法判定」升为判红。
// 默认档(CI 与提交链跑的形态)退出码与 B1-B5 完全不变 —— 这是本票的硬约束。
if (requireIdle && idle.verdict !== 'idle') {
  const why = idle.verdict === 'busy' ? '有人在飞' : `无法判定(${idle.reason})`
  console.error(`${C.red}${C.bold}[迁移记账] ✗ B10 --require-idle:journal 登记表非空闲 —— ${why}${C.reset}`)
  console.error(`${C.dim}  开工前置未满足:等对方的迁移落地/暂存完毕,或把本次动作让给该票持有者。${C.reset}`)
  process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
