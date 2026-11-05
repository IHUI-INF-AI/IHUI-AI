#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-drizzle-journal-sync.mjs — drizzle 迁移链「文件 ↔ journal」双向对账尺(只读)。
 *
 * ## 立因(goal-b49 逆向对照实测,2026-11-04,不是预防)
 * 现算本仓 `packages/database/drizzle/`:`meta/_journal.json` entries=364,而目录里
 * `*.sql` =366;两枚**文件有、journal 无**的孤儿(`0364_app_versions_store_channel`、
 * `20261104120000_agent_team_collab`)不会被 `migrate()` 应用 ⇒ 按链新建的库缺表且无人知
 * (安静失效)。对侧 WorkBuddy 的 sqlite migrations 同病灶更重(4 枚孤儿 + 4 组重号)且
 * **没有任何一面判据尺** ⇒ 本尺的超越轴 = 双向差集都判(文件有/journal 无、journal 有/文件无),
 * 外加 journal 内 `tag` 重号与 `idx` 断档,且**枚举到 0 个候选不判绿**(§0.3)。
 *
 * ## 三态口径(§0.3,与 check-service-inventory / check-mobile-version-code 同形,判据不抄)
 *   · ok(exit 0):两向差集为空 ∧ 无 tag 重号 ∧ 无 idx 断档/非整数,且两侧候选均 >0;
 *   · drift(exit 1):任一维命中,逐条点名(孤儿给文件名与所在侧,重号给 tag,断档给缺号);
 *   · unjudged(exit 2):journal 读不到/解不开/`entries` 不是数组、目录枚举失败、
 *     **枚举到 0 条 journal entries 或 0 个 .sql 文件**——一律点名原因,绝不用 0 冒充"没有",
 *     绝不记绿也不冒红。
 *
 * ## 取材面(§0.4 / 守门 118:两面各判各的,取不到**不回落另一个面**)
 * 本尺**两面都读,但定责不同**:
 *   · **HEAD blob 面 = 缺陷面**。`migrate()` 沿提交链建库时吃的是链上的 journal 与 sql,
 *     所以"孤儿/悬空/重号/断档"只在 HEAD 面成立才算真缺陷 ⇒ 判 drift(exit 1)。
 *   · **工作树面 = 现场面**。共享工作树上盘字节常年落后于 HEAD 或带他席在飞改动,
 *     按 §12e「与本次内容无关的红唯一结局是逼人跳门」,这类差**只报 `diskLag` 计数并逐条点名**,
 *     不冒充孤儿、不进缺陷面结论、不改退出码。
 *   · HEAD 面取不到(非 git 仓 / 无 HEAD / git 失败)⇒ 当场 **unjudged(exit 2)** 并点名原因,
 *     **绝不因为"盘上读得到"就退回工作树面冒充判过**(§0.3)。
 *   · `--worktree-only` 是人工逃生舱(显式声明才生效),只量盘面差,不代表缺陷结论。
 * 本尺**不挂提交链**(§12e:存量未归零时挂 blocking 即恒红门),
 * 唯一调度器 = git-guardian 的 `auditDrizzleJournalSync()`(warn-only)。
 *
 * 用法:
 *   node scripts/check-drizzle-journal-sync.mjs            现算真实仓,末行 DRIZZLE-JOURNAL state=…
 *   node scripts/check-drizzle-journal-sync.mjs --json     机读结论(明细随结论行一起打)
 *   node scripts/check-drizzle-journal-sync.mjs --worktree-only  人工逃生舱:只量盘面差,不判缺陷
 *   node scripts/check-drizzle-journal-sync.mjs --self-test 门内自检(夹具落 mkScratch,§15b/§26)
 * 退出码:0=ok;1=drift(仅 HEAD 面);2=unjudged(含自检失败与 HEAD 面取不到)。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { catBatch } from './lib/face-reader.mjs'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
export const GATE = 'check-drizzle-journal-sync.mjs'

/** 被审目录与 journal 相对路径(默认档;自检夹具覆写为 scratch 相对路径)。 */
export const MIGRATIONS_DIR_REL = join('packages', 'database', 'drizzle')
export const JOURNAL_SUBPATH = join('meta', '_journal.json')

/** 未判定专用异常:调用方折成 exit 2,不记绿也不冒红(§0.3)。 */
export class Unjudged extends Error {}

/**
 * 纯函数:核心判据。输入显式给出(entries 数组或 null、sqlTags 字符串数组或 null),
 * 任何一路缺失/空集 ⇒ unjudged(枚举到 0 判死不记绿)。
 * @returns {{state:'ok'|'drift'|'unjudged', problems:string[], unjudgedReasons:string[], counts:object}}
 */
export function judgeJournalSync({ entries, sqlTags }) {
  const unjudgedReasons = []
  if (!Array.isArray(entries)) {
    unjudgedReasons.push('journal entries 不是数组(取不到/形状坏)')
  } else if (entries.length === 0) {
    unjudgedReasons.push('journal 枚举到 0 条 entries(链不可能为空 ⇒ 判死,不冒充"没有")')
  }
  if (!Array.isArray(sqlTags)) {
    unjudgedReasons.push('.sql 迁移清单不是数组(目录枚举失败)')
  } else if (sqlTags.length === 0) {
    unjudgedReasons.push('枚举到 0 个 .sql 迁移文件(目录不可能为空 ⇒ 判死,不冒充"没有")')
  }
  if (unjudgedReasons.length > 0) {
    return { state: 'unjudged', problems: [], unjudgedReasons, counts: countsOf(entries, sqlTags) }
  }

  const problems = []
  const journalTags = new Set()
  const tagSeen = new Map()
  const idxList = []
  for (const e of entries) {
    const tag = typeof e?.tag === 'string' ? e.tag : null
    if (tag === null) {
      problems.push(`journal entry idx=${JSON.stringify(e?.idx)} 缺字符串 tag(形状坏,无法对账)`)
      continue
    }
    journalTags.add(tag)
    tagSeen.set(tag, (tagSeen.get(tag) || 0) + 1)
    if (Number.isInteger(e.idx)) idxList.push(e.idx)
    else problems.push(`journal entry tag=${tag} 的 idx 不是整数(实得 ${JSON.stringify(e.idx)})`)
  }
  for (const [tag, n] of tagSeen) {
    if (n > 1) problems.push(`journal 内 tag 重号:${tag} 出现 ${n} 次(migrate() 会按 entries 顺序各跑一遍)`)
  }
  if (idxList.length >= 2) {
    const lo = Math.min(...idxList)
    const hi = Math.max(...idxList)
    const present = new Set(idxList)
    for (let i = lo; i <= hi; i++) if (!present.has(i)) problems.push(`journal idx 断档:缺 idx=${i}`)
  }

  const sqlSet = new Set(sqlTags)
  const fileOnly = sqlTags.filter((t) => !journalTags.has(t)).sort()
  const journalOnly = [...journalTags].filter((t) => !sqlSet.has(t)).sort()
  for (const t of fileOnly) {
    problems.push(`孤儿迁移(文件有/journal 无):${t}.sql —— migrate() 不会应用它,按链新建的库缺这份变更`)
  }
  for (const t of journalOnly) {
    problems.push(`journal 悬空条目(journal 有/文件无):tag=${t} —— migrate() 找对应 .sql 时会失败`)
  }
  return {
    state: problems.length > 0 ? 'drift' : 'ok',
    problems,
    unjudgedReasons: [],
    counts: { ...countsOf(entries, sqlTags), fileOnly: fileOnly.length, journalOnly: journalOnly.length },
  }
}

function countsOf(entries, sqlTags) {
  return {
    entries: Array.isArray(entries) ? entries.length : null,
    sqlFiles: Array.isArray(sqlTags) ? sqlTags.length : null,
  }
}

/**
 * 从盘面读两路输入。journal 读不到/解不开/entries 不是数组、目录枚举失败 ⇒ 抛 Unjudged。
 * 只读,绝不写任何被审路径。
 */
export function readMigrationState({ repoRoot = ROOT, dirRel = MIGRATIONS_DIR_REL } = {}) {
  const dir = join(repoRoot, dirRel)
  let sqlTags
  try {
    sqlTags = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.sql'))
      .map((d) => d.name.slice(0, -'.sql'.length))
  } catch (e) {
    throw new Unjudged(`目录枚举失败:${dir}(${String(e?.message ?? e).slice(0, 120)})`)
  }
  const journalPath = join(dir, JOURNAL_SUBPATH)
  if (!existsSync(journalPath)) throw new Unjudged(`journal 读不到:${journalPath}`)
  let parsed
  try {
    parsed = JSON.parse(readFileSync(journalPath, 'utf8'))
  } catch (e) {
    throw new Unjudged(`journal 不是合法 JSON:${journalPath}(${String(e?.message ?? e).slice(0, 120)})`)
  }
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : null
  if (entries === null) throw new Unjudged(`journal 的 entries 字段缺失或不是数组:${journalPath}`)
  return { entries, sqlTags }
}

/**
 * HEAD blob 面读取(缺陷面)。任何一步取不到 ⇒ 抛 Unjudged,**不回落工作树面**。
 * §12g:派生 git 必须显式接管 stdio(不写稳定 EBUSY)。
 */
export function readHeadMigrationState({ repoRoot = ROOT, ref = 'HEAD' } = {}) {
  const git = (args) =>
    spawnSync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  const dirTree = git(['ls-tree', '--name-only', `${ref}:${MIGRATIONS_DIR_REL.split(/[\\/]/).join('/')}`])
  if (dirTree.status !== 0 || typeof dirTree.stdout !== 'string') {
    throw new Unjudged(
      `HEAD 面迁移目录枚举失败:${dirTree.status ?? 'git 未运行'} ${String(dirTree.stderr ?? '').slice(0, 120)}`,
    )
  }
  const sqlTags = dirTree.stdout
    .split('\n')
    .filter((l) => l.endsWith('.sql'))
    .map((l) => l.slice(0, -'.sql'.length))
  // blob 正文一律经取材层(守门 118):同一份取面实现,不在这里另派生一条 git 管子。
  const journalSpec = `${ref}:${MIGRATIONS_DIR_REL.split(/[\\/]/).join('/')}/${JOURNAL_SUBPATH.split(/[\\/]/).join('/')}`
  let journalText
  try {
    journalText = catBatch(repoRoot, [journalSpec], { timeout: 60000 }).get(journalSpec)
  } catch (e) {
    throw new Unjudged(`HEAD 面 journal 取不到:${String(e?.message ?? e).slice(0, 120)}`)
  }
  if (typeof journalText !== 'string') {
    throw new Unjudged(`HEAD 面 journal 取不到:${journalSpec}(取材层未返回 blob 正文)`)
  }
  let parsed
  try {
    parsed = JSON.parse(journalText)
  } catch (e) {
    throw new Unjudged(`HEAD 面 journal 不是合法 JSON:${String(e?.message ?? e).slice(0, 120)}`)
  }
  if (!Array.isArray(parsed?.entries)) throw new Unjudged('HEAD 面 journal 的 entries 缺失或不是数组')
  return { entries: parsed.entries, sqlTags }
}

/**
 * 两面合成(纯函数,可测):HEAD 面定缺陷结论;工作树差只折成 diskLag 计数与点名,
 * 不参与退出码(§12e:他席现场不判成本仓缺陷)。
 * @returns {{state:'ok'|'drift'|'unjudged', problems:string[], unjudgedReasons:string[],
 *            diskLag:string[], counts:object}}
 */
export function composeFaceVerdict(head, disk) {
  if (head.state === 'unjudged') {
    return {
      state: 'unjudged',
      problems: [],
      unjudgedReasons: ['HEAD 面未判定 ⇒ 不回落工作树面:' + head.unjudgedReasons.join(' | ')],
      diskLag: [],
      counts: head.counts,
    }
  }
  const diskLag =
    disk && disk.state !== 'unjudged'
      ? [
          ...disk.problems.filter(() => head.state === 'ok'),
          ...(disk.counts.entries !== head.counts.entries || disk.counts.sqlFiles !== head.counts.sqlFiles
            ? [
                `工作树副本与 HEAD 面不同量:entries ${disk.counts.entries} vs ${head.counts.entries},` +
                  `sql ${disk.counts.sqlFiles} vs ${head.counts.sqlFiles}(盘面滞后/他席在飞,不判孤儿)`,
              ]
            : []),
        ]
      : []
  return {
    state: head.state,
    problems: head.problems,
    unjudgedReasons: head.unjudgedReasons,
    diskLag,
    counts: head.counts,
  }
}

/** 结论行(守护派发的稳定解析出口):三态 + 各维计数,单行不折行。 */
export function formatStateLine(r) {
  const c = r.counts
  return (
    `DRIZZLE-JOURNAL state=${r.state} entries=${c.entries ?? '-'} sqlFiles=${c.sqlFiles ?? '-'} ` +
    `fileOnly=${c.fileOnly ?? '-'} journalOnly=${c.journalOnly ?? '-'} problems=${r.problems.length} ` +
    `diskLag=${r.diskLag?.length ?? 0} unjudgedReasons=${r.unjudgedReasons.length}`
  )
}

/** 门内自检:纯判据各枝 + 盘面 IO 各失败枝,夹具一律落 mkScratch(§15b,禁 os.tmpdir、禁仓库树内)。 */
export function selfTest() {
  const rows = []
  const t = (name, cond, got) => rows.push({ name, ok: cond === true, got: got === undefined ? '' : String(got) })
  const mk = (tags, idxStart = 1) => tags.map((tag, i) => ({ idx: idxStart + i, tag, version: '7', when: 1, breakpoints: true }))
  // P1-P5 纯判据枝
  let r = judgeJournalSync({ entries: mk(['a', 'b', 'c']), sqlTags: ['a', 'b', 'c'] })
  t('P1 三枚全对齐 ⇒ ok', r.state === 'ok', JSON.stringify(r))
  r = judgeJournalSync({ entries: mk(['a', 'b']), sqlTags: ['a', 'b', '0364_orphan'] })
  t(
    'P2 孤儿(文件有/journal 无)⇒ drift 且点名文件名',
    r.state === 'drift' && r.problems.some((p) => p.includes('0364_orphan.sql') && p.includes('文件有/journal 无')),
    r.problems.join(' | ')
  )
  r = judgeJournalSync({ entries: mk(['a', 'b', 'ghost']), sqlTags: ['a', 'b'] })
  t(
    'P3 悬空(journal 有/文件无)⇒ drift 且点名 tag',
    r.state === 'drift' && r.problems.some((p) => p.includes('ghost') && p.includes('journal 有/文件无'))
  )
  r = judgeJournalSync({ entries: mk(['a', 'a']), sqlTags: ['a'] })
  t(
    'P4 journal tag 重号 ⇒ drift 且给出出现次数',
    r.state === 'drift' && r.problems.some((p) => p.includes('tag 重号') && p.includes('出现 2 次'))
  )
  r = judgeJournalSync({ entries: mk(['a', 'c'], 1).map((e, i) => ({ ...e, idx: i === 0 ? 1 : 3 })), sqlTags: ['a', 'c'] })
  t(
    'P5 journal idx 断档 ⇒ drift 且点名缺号',
    r.state === 'drift' && r.problems.some((p) => p.includes('idx 断档') && p.includes('idx=2'))
  )
  r = judgeJournalSync({ entries: [], sqlTags: ['a'] })
  t('P6 journal 枚举到 0 条 ⇒ unjudged(绝不记绿)', r.state === 'unjudged')
  r = judgeJournalSync({ entries: mk(['a']), sqlTags: [] })
  t('P7 .sql 枚举到 0 个 ⇒ unjudged(绝不用 0 冒充"没有")', r.state === 'unjudged')
  r = judgeJournalSync({ entries: null, sqlTags: ['a'] })
  t('P8 entries 取不到(null)⇒ unjudged', r.state === 'unjudged')
  r = judgeJournalSync({ entries: [], sqlTags: [] })
  t('P9 两侧都空 ⇒ unjudged 且两条原因都点名', r.state === 'unjudged' && r.unjudgedReasons.length === 2)
  // IO 枝:scratch 夹具目录(结构 = <scratch>/drizzle/meta/_journal.json + *.sql)
  const dir = mkScratch('djs-')
  try {
    const base = join(dir, 'drizzle')
    mkdirSync(join(base, 'meta'), { recursive: true })
    const journal = (entries) => writeFileSync(join(base, 'meta', '_journal.json'), JSON.stringify({ version: '7', dialect: 'postgresql', entries }), 'utf8')
    const touch = (name) => writeFileSync(join(base, name), '-- fixture\n', 'utf8')
    journal(mk(['a', 'b']))
    touch('a.sql')
    touch('b.sql')
    const got = readMigrationState({ repoRoot: dir, dirRel: 'drizzle' })
    t('I1 盘面全对齐目录 ⇒ 读回两路输入且判 ok', judgeJournalSync(got).state === 'ok')
    touch('orphan.sql')
    t('I2 盘面多一枚孤儿 sql ⇒ drift 点名', judgeJournalSync(readMigrationState({ repoRoot: dir, dirRel: 'drizzle' })).problems.some((p) => p.includes('orphan.sql')))
    writeFileSync(join(base, 'meta', '_journal.json'), '{oops', 'utf8')
    let threw = null
    try {
      readMigrationState({ repoRoot: dir, dirRel: 'drizzle' })
    } catch (e) {
      threw = e
    }
    t('I3 journal 解不开 ⇒ Unjudged(不是 drift 也不是绿)', threw instanceof Unjudged && /JSON/.test(threw.message))
    journal([])
    t('I4 journal entries=[] ⇒ judge 折成 unjudged(不记绿)', judgeJournalSync(readMigrationState({ repoRoot: dir, dirRel: 'drizzle' })).state === 'unjudged')
    threw = null
    try {
      readMigrationState({ repoRoot: dir, dirRel: 'no-such-dir' })
    } catch (e) {
      threw = e
    }
    t('I5 目录枚举失败 ⇒ Unjudged 点名路径', threw instanceof Unjudged && /枚举失败/.test(threw.message))
  } finally {
    try {
      rmScratch(dir)
    } catch {
      /* rmScratch 幂等兜底 */
    }
  }
  // 两面合成(§0.4/守门 118:HEAD 面定缺陷,盘面差只算滞后;取不到不回落)
  {
    const ok = { state: 'ok', problems: [], unjudgedReasons: [], counts: { entries: 3, sqlFiles: 3 } }
    const drift = {
      state: 'drift',
      problems: ['孤儿迁移(文件有/journal 无):x.sql'],
      unjudgedReasons: [],
      counts: { entries: 2, sqlFiles: 3 },
    }
    const diskLag = { state: 'drift', problems: ['孤儿迁移(文件有/journal 无):y.sql'], unjudgedReasons: [], counts: { entries: 2, sqlFiles: 3 } }
    let c = composeFaceVerdict(ok, diskLag)
    t(
      'C1 HEAD 面 ok + 盘面差 ⇒ 整体 ok,差只进 diskLag(不冒充缺陷)',
      c.state === 'ok' && c.problems.length === 0 && c.diskLag.length > 0 && c.diskLag.some((s) => s.includes('不判孤儿')),
      JSON.stringify(c)
    )
    c = composeFaceVerdict(drift, drift)
    t(
      'C2 HEAD 面 drift ⇒ 整体 drift、problems 只来自 HEAD 面(盘面同差也不重复记账)',
      c.state === 'drift' && c.problems.length === 1 && c.problems[0].includes('x.sql') && c.diskLag.length === 0,
      JSON.stringify(c)
    )
    // 缺陷面为 drift 时,盘面不同量仍作为信息性差留痕(标签已写明"不判孤儿"),
    // 但缺陷结论与 problems 必须来自 HEAD 面,不被盘面洗白。
    c = composeFaceVerdict(drift, { ...ok, problems: ['工作树侧多出的差:z.sql'] })
    t(
      'C2b HEAD 面 drift + 盘面不同量 ⇒ drift 保持、problems 仍是 HEAD 面那一条',
      c.state === 'drift' &&
        c.problems.length === 1 &&
        c.problems[0].includes('x.sql') &&
        c.diskLag.some((s) => s.includes('不同量')),
      JSON.stringify(c)
    )
    c = composeFaceVerdict({ state: 'unjudged', problems: [], unjudgedReasons: ['HEAD 面 journal 取不到'], counts: {} }, diskLag)
    t(
      'C3 HEAD 面未判定 ⇒ 整体未判定,**不回落工作树面**(§0.3)',
      c.state === 'unjudged' && c.problems.length === 0 && c.diskLag.length === 0 && c.unjudgedReasons.some((s) => s.includes('不回落')),
      JSON.stringify(c)
    )
    c = composeFaceVerdict(ok, { state: 'unjudged', problems: [], unjudgedReasons: ['盘面读不到'], counts: {} })
    t(
      'C4 盘面取不到而 HEAD 面 ok ⇒ 仍 ok(盘面不是缺陷面)',
      c.state === 'ok' && c.diskLag.length === 0,
      JSON.stringify(c)
    )
    const line = formatStateLine(composeFaceVerdict(ok, diskLag))
    t('C5 结论行带 diskLag 计数且单行', !/[\r\n]/.test(line) && line.includes('diskLag=') && line.startsWith('DRIZZLE-JOURNAL state=ok'), line)
  }
  // 反向对照(§0.10 失效方向):结论行必须是守护可解析的单行稳定出口
  {
    const line = formatStateLine(judgeJournalSync({ entries: mk(['a']), sqlTags: ['a', 'b'] }))
    t(
      'X1 结论行单行且三态键齐备(drift + fileOnly=1)',
      !/[\r\n]/.test(line) && line.startsWith('DRIZZLE-JOURNAL state=drift') && line.includes('fileOnly=1'),
      line
    )
  }
  return rows
}

function mainCli(argv) {
  if (argv.includes('--self-test')) {
    const rows = selfTest()
    for (const row of rows) console.info(`${row.ok ? '✅' : '❌'} ${row.name}${row.ok ? '' : ` — ${row.got}`}`)
    const fail = rows.filter((x) => !x.ok).length
    console.info(`[${GATE}] self-test: pass ${rows.length - fail} / fail ${fail}`)
    // 与 check-service-inventory 同档:自检失败 ⇒ 2(尺子本身坏了,不冒充 1="量到了 drift")
    return fail === 0 ? 0 : 2
  }
  const asJson = argv.includes('--json')
  const worktreeOnly = argv.includes('--worktree-only')
  let result
  try {
    const diskJudged = judgeJournalSync(readMigrationState({}))
    if (worktreeOnly) {
      // 人工逃生舱:只看盘面差,并明确它不是缺陷结论(退出码仍随盘面判据,便于手工核对夹具)。
      result = { ...diskJudged, diskLag: diskJudged.state === 'drift' ? diskJudged.problems : [] }
    } else {
      let headJudged
      try {
        headJudged = judgeJournalSync(readHeadMigrationState({}))
      } catch (e) {
        if (!(e instanceof Unjudged)) throw e
        headJudged = {
          state: 'unjudged',
          problems: [],
          unjudgedReasons: [e.message],
          counts: { entries: null, sqlFiles: null, fileOnly: null, journalOnly: null },
        }
      }
      result = composeFaceVerdict(headJudged, diskJudged)
    }
  } catch (e) {
    if (!(e instanceof Unjudged)) {
      console.error(`[${GATE}] ❌ 尺子自身异常(未判定,不记绿不冒红):${e?.stack ?? e}`)
      return 2
    }
    result = {
      state: 'unjudged',
      problems: [],
      unjudgedReasons: [e.message],
      diskLag: [],
      counts: { entries: null, sqlFiles: null },
    }
  }
  if (asJson) console.info(JSON.stringify({ gate: GATE, ...result }))
  for (const p of result.problems) console.warn(`  ${p}`)
  // 盘面差单独一档打印:点名但明说"不判孤儿",免得读日志的人把它当本仓缺陷。
  for (const d of result.diskLag ?? []) console.info(`  盘面滞后/在飞(不判缺陷):${d}`)
  for (const u of result.unjudgedReasons) console.error(`  未判定:${u}`)
  console.info(formatStateLine(result))
  return result.state === 'ok' ? 0 : result.state === 'drift' ? 1 : 2
}

// §22d:双形态入口守卫(必须 pathToFileURL,禁手拼 file:///)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = mainCli(process.argv.slice(2))
  } catch (e) {
    console.error(`[${GATE}] ❌ 尺子异常(未判定)\n${e?.stack ?? e}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  judgeJournalSync,
  readMigrationState,
  readHeadMigrationState,
  composeFaceVerdict,
  formatStateLine,
  selfTest,
  Unjudged,
  GATE,
  MIGRATIONS_DIR_REL,
  JOURNAL_SUBPATH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
