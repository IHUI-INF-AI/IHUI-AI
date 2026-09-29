// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试(§22c 模式 —— 判据与取材一律从守门 134 的 `__test__` 取,**不在这里抄第二份正则**):
 * 关联票的判据本体正反成对 + 棘轮端到面。文件名里的 G-815953/G-815956 是首两张票;G-815955(B5)
 * 同属守门 134 的判据族,经本票拍板**追加在本文件**(不另起新文件):B5 与 B4 同为棘轮专用维,
 * 取材/棘轮口径同构,分开文件只会让"同一把尺子"看起来像两把。
 *
 *  - G-815953(B3):批量回填的 UPDATE 必须带「上一次迁移应用时刻」的时间上界谓词。
 *    红:写迁移记账列(migrationBatch/migration_batch/legacyId/legacyTable…)而 where 无
 *    lte(/lt(/backfillWhere(/<= 任一(含无 where 的全表无界);绿:lte 上界、backfillWhere 唯一出口
 *    (apps/api/src/utils/backfill-baseline.ts);裸 SQL UPDATE 维正反成对;真仓对照:HEAD 的
 *    id-mapping-queries.ts(backfillMigrationBatch)零违规,抹掉出口名必现 1 处违规。
 *  - G-815956(B4):迟到终态事件不得把已终态记录改回活动态。
 *    红:`set({status:'cancelled'}).where(eq(t.id,id))`(where 无同列 eq/in/ne 前置)/无 where;
 *    绿:补 and(eq(t.status,…)) 或同列 ne/inArray 前置;
 *    棘轮专用维:head+strict 只报数不判红(decide 签名刻意不收 b4Violations —— 结构锁),
 *    staged 净新增即红(kind='b4',锚点 = 该文件 HEAD 自身计数,新文件锚点 0)。
 *  - G-815955(B5):按可空/非唯一排序列 ORDER BY 必须带确定性尾键(同值行两次查询间座位不定 ⇒ 分页漂移;
 *    上游经验 `order by sequence is null, sequence, time_created, rowid` 每级都有确定性尾键)。
 *    红:单键 `orderBy(asc(t.sortOrder))`/`orderBy(desc(t.<族列>))`(族 = sortOrder/sortOrderInGroup/
 *    position/sequence)而无后续尾键;绿:补 `…, desc(t.createdAt), asc(t.id))`(尾键最后一键能唯一定位行);
 *    **与 B4 同构的棘轮专用维**:head+strict 只报数不判红(decide 签名刻意不收 b5Violations —— 结构锁),
 *    staged 净新增即红(kind='b5',锚点 = 该文件 HEAD 自身计数,新文件锚点 0)。
 *    首落点:apps/api/src/db/billing-queries.ts findPlans 的单键 `asc(plans.sortOrder)` 已随本票补尾键;
 *    判不了的形态(变量键 / sql` 模板 / 裸 SQL SELECT…ORDER BY / services/ 面)见守门头注 B5 段,不进面。
 *
 * **票面镜像形状的偏差说明(如实登记)**:票 A 红例写作"无界 where isNull(x)",但软删形状
 * `set({deletedAt:…}).where(and(eq(…), isNull(…)))` 与回填词法同形且 HEAD 实测十几处,按 isNull
 * 划线是恒红门(§12e);守门 B3 收窄为"写迁移记账列 + 无时间上界"(头注 B3 段),本文件红例按
 * 收窄后的判据取形,isNull 软删形状反而钉成反假阳锁(下面的软删用例)。
 *
 * **判不了格登记(票面要求:判不了的形态必须登记,不得假装已解决;与守门头注 B3/B4 段同源)**:
 *  - B3:① 落点在 SCAN_DIRS(apps/api/src/routes|db)之外的独立回填脚本不进面;② 接收者非 db|tx|trx
 *    裸标识符(含 `db.with(...).update`)不进面;③ 上界经中间变量间接拼装(如 `const w = cond ?
 *    lte(…) : undefined`)⇒ whereText 只看一跳字面,按无上界计(fail-closed);④ drizzle where 里用
 *    sql`…<=…` 模板写上界 ⇒ 遮蔽面(blankStrings 档)读不到模板内容,按无上界计。
 *  - B4:① set 值来自变量/简写/spread ⇒ 遮蔽面有可见 token,不进面(状态机收口的语义判定不做;
 *    票面点名的上游 settleSessionInput / markSessionInput 一类"值非字面量"形态在本仓对应
 *    oauth-queries.ts 的 markSessionUsed 等,落这一格);② 数字枚举码(set({status: 2}))⇒ 数字
 *    字面量在遮蔽面可见,与变量同格,字面量判据(值被抹空形态)结构上不认;③ `as` 断言字面量
 *    ⇒ 遮蔽面 `status:` 后跟标识符,不进面;④ 前置写在 sql`…` 模板里 ⇒ 按无前置计(fail-closed);
 *    ⑤ 裸 SQL 的 UPDATE…SET status 刻意只认 drizzle 链(存量实测 0,该形状出现那天由镜像正例
 *    扩面接维);⑥ "该列是否真是终态列"是语义问题,词法只认 status/state 列名。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GATE_REL = 'check-batch-write-count-honesty.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO_ROOT = resolve(SCRIPTS_DIR, '..')
const GIT = resolveGitBin() || 'git'
// §22c:判据只此一份实现 —— 全部从守门的 __test__ 取,测试里出现第二份正则即为 M8 同型违例。
const T = (await import('../check-batch-write-count-honesty.mjs')).__test__

const DB_REL = 'apps/api/src/db/g815-fixture.ts'
const B3_REL = 'apps/api/src/db/backfill-g815953.ts'
const B3_MORE_REL = 'apps/api/src/db/backfill-g815953-more.ts'
const B4_REL = 'apps/api/src/db/status-g815956.ts'
const B4_NEW_REL = 'apps/api/src/db/status-g815956-more.ts'
// G-815955(B5):追加在本文件的第三张关联票(见头注),夹具落点与 B3/B4 同面。
const B5_REL = 'apps/api/src/db/orderby-g815955.ts'
const B5_NEW_REL = 'apps/api/src/db/orderby-g815955-more.ts'

/** 直测夹具统一包进函数体(与真实落点同形,也避开"无函数体"的口径)。 */
const wrap = (body) =>
  [
    "import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm'",
    "import { db } from './index.js'",
    'export async function go(x, y, b) {',
    body,
    '}',
    '',
  ].join('\n')
const b3Scan = (body) => T.scanFileText(DB_REL, wrap(body)).b3
const b4Scan = (body) => T.scanFileText(DB_REL, wrap(body)).b4
/** B5 直测夹具:orderBy 是读链,import 面换成 asc/desc(判据是词法的,import 行只为同形)。 */
const b5Wrap = (body) =>
  [
    "import { asc, desc, sql } from 'drizzle-orm'",
    "import { db } from './index.js'",
    'export async function go(x, y) {',
    body,
    '}',
    '',
  ].join('\n')
const b5Scan = (body) => T.scanFileText(DB_REL, b5Wrap(body)).b5

/* ------------------------------- 临时 git 仓 ------------------------------- */

function gitIn(dir, args) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/** 把门连同相对 import 闭包装进夹具仓(门按自身位置推 ROOT,不装它就在审真仓)。 */
function writeRepo(dir, { files = {} } = {}) {
  gitIn(dir, ['init', '-q'])
  gitIn(dir, ['config', 'user.email', 'gate@fixture.local'])
  gitIn(dir, ['config', 'user.name', 'gate-fixture'])
  gitIn(dir, ['config', 'commit.gpgsign', 'false'])
  for (const [rel, text] of Object.entries(files)) put(dir, rel, text)
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
  ])
  gitIn(dir, ['add', '-A'])
  gitIn(dir, ['commit', '-q', '-m', 'fixture'])
  return dir
}

function run(dir, args) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', GATE_REL), ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return {
      code: typeof e?.status === 'number' ? e.status : -1,
      out: `${e?.stdout ?? ''}${e?.stderr ?? ''}`,
    }
  }
}

/** 与"只许 exit 0"的 json() 分工:判红那一支的正解就是非零,不能让辅助函数先炸。 */
function parse(r) {
  try {
    return { code: r.code, j: JSON.parse(r.out) }
  } catch {
    throw new Error(`--json 输出不可 parse(exit ${r.code}):${r.out.slice(0, 240)}`)
  }
}

/* --------------------------- G-815953:B3 判据直测 --------------------------- */

test('G-815953 B3 正反成对:无界回填红 / lte 绿 / 出口绿 / 软删同形反假阳 / 裸 SQL 维', () => {
  // 红:写迁移记账列,where 无任何时间上界(票面红例按收窄判据取形,偏差见头注)。
  const bad = b3Scan('  await db.update(t).set({ migrationBatch: x }).where(eq(t.migrationBatch, y))')
  if (bad.violations.length !== 1 || bad.candidates.length !== 1)
    throw new Error(`无界回填必须 1 违规 1 候选,实得 ${JSON.stringify(bad)}`)
  if (bad.violations[0].via !== 'drizzle' || bad.violations[0].col !== 'migrationBatch')
    throw new Error(`落点字段不对:${JSON.stringify(bad.violations[0])}`)
  if (!/无时间上界/.test(bad.violations[0].whereWhy || ''))
    throw new Error(`红点必须说清缺什么:${bad.violations[0].whereWhy}`)

  // 绿:手写 lte 上界(票面绿例的形状)。
  const lteGreen = b3Scan(
    '  await db.update(t).set({ migrationBatch: x }).where(and(eq(t.migrationBatch, y), lte(t.createdAt, b)))',
  )
  if (lteGreen.violations.length !== 0 || lteGreen.candidates.length !== 1)
    throw new Error(`lte 上界必须绿:${JSON.stringify(lteGreen)}`)
  if (lteGreen.candidates[0].disposition !== 'bounded')
    throw new Error(`处置必须是 bounded:${JSON.stringify(lteGreen.candidates[0])}`)

  // 绿:走 backfillWhere 唯一出口(其实参自带 backfillWhere( 字样)。
  const outletGreen = b3Scan(
    '  await db.update(t).set({ migrationBatch: x }).where(backfillWhere({ column: t.createdAt, baselineTime: b, conditions: [eq(t.migrationBatch, y)] }))',
  )
  if (outletGreen.violations.length !== 0 || outletGreen.candidates.length !== 1)
    throw new Error(`唯一出口必须绿:${JSON.stringify(outletGreen)}`)

  // 反假阳锁:软删形状与回填词法同形但不写记账列 ⇒ 不进面(票面 isNull 红例的偏差落点,§12e)。
  const softDel = b3Scan(
    '  await db.update(t).set({ deletedAt: new Date() }).where(and(eq(t.ownerId, x), isNull(t.deletedAt)))',
  )
  if (softDel.candidates.length !== 0 || softDel.violations.length !== 0)
    throw new Error(`软删同形不得被判成回填:${JSON.stringify(softDel)}`)

  // 红(变体):无 where 的全表无界 update 同判。
  const noWhere = b3Scan('  await db.update(t).set({ migrationBatch: x })')
  if (noWhere.violations.length !== 1 || noWhere.violations[0].whereWhy !== '无 where(全表无界)')
    throw new Error(`全表无界必须红且说明原因:${JSON.stringify(noWhere.violations)}`)

  // 裸 SQL 维正反成对(sqlText 取模板体、${…} 剥成 ?,`<=` 在 SQL 串里可读)。
  const rawBad = b3Scan(
    '  await db.execute(sql`UPDATE id_mapping SET migration_batch = ${x} WHERE migration_batch = ${y}`)',
  )
  if (rawBad.violations.length !== 1 || rawBad.violations[0].via !== 'raw-sql')
    throw new Error(`裸 SQL 无界回填必须红:${JSON.stringify(rawBad)}`)
  if (rawBad.violations[0].col !== 'migration_batch')
    throw new Error(`裸 SQL 维记账列识别错:${JSON.stringify(rawBad.violations[0])}`)
  const rawGreen = b3Scan(
    '  await db.execute(sql`UPDATE id_mapping SET migration_batch = ${x} WHERE migration_batch = ${y} AND created_at <= ${b}`)',
  )
  if (rawGreen.violations.length !== 0 || rawGreen.candidates.length !== 1)
    throw new Error(`裸 SQL 带 <= 上界必须绿:${JSON.stringify(rawGreen)}`)
})

/* --------------------------- G-815956:B4 判据直测 --------------------------- */

test('G-815956 B4 正反成对:字面量无前置红 / 补同列前置绿 / 无 where 红 / 判不了格不进面', () => {
  // 红:票面红例逐字形状 —— set 写字面量 status 而 where 只按 id 圈行。
  const bad = b4Scan(`  await db.update(t).set({ status: 'cancelled' }).where(eq(t.id, x))`)
  if (bad.violations.length !== 1 || bad.candidates.length !== 1)
    throw new Error(`终态回退必须 1 违规 1 候选,实得 ${JSON.stringify(bad)}`)
  if (bad.violations[0].col !== 'status' || bad.violations[0].via !== 'drizzle')
    throw new Error(`落点字段不对:${JSON.stringify(bad.violations[0])}`)
  if (!/无同列 eq\/in\/ne 前置/.test(bad.violations[0].whereWhy || ''))
    throw new Error(`红点必须说清缺什么:${bad.violations[0].whereWhy}`)

  // 绿:票面绿例 —— 补 and(eq(t.status,'pending')) 同列前置。
  const green = b4Scan(
    `  await db.update(t).set({ status: 'cancelled' }).where(and(eq(t.id, x), eq(t.status, 'pending')))`,
  )
  if (green.violations.length !== 0 || green.candidates.length !== 1)
    throw new Error(`补同列前置必须绿:${JSON.stringify(green)}`)
  if (green.candidates[0].disposition !== 'precondition')
    throw new Error(`处置必须是 precondition:${JSON.stringify(green.candidates[0])}`)

  // 绿(变体):同列 ne / inArray 前置同样算数。
  for (const body of [
    `  await db.update(t).set({ status: 'cancelled' }).where(and(eq(t.id, x), ne(t.status, 'done')))`,
    `  await db.update(t).set({ status: 'cancelled' }).where(and(eq(t.id, x), inArray(t.status, ['pending'])))`,
  ]) {
    const g = b4Scan(body)
    if (g.violations.length !== 0) throw new Error(`同列前置变体必须绿:${body} ⇒ ${JSON.stringify(g)}`)
  }

  // state 列同判。
  const stateCol = b4Scan(`  await db.update(t).set({ state: 'archived' }).where(eq(t.id, x))`)
  if (stateCol.violations.length !== 1 || stateCol.violations[0].col !== 'state')
    throw new Error(`state 列必须同判:${JSON.stringify(stateCol)}`)

  // 红(变体):无 where —— "改哪几行"完全交给调用方纪律。
  const noWhere = b4Scan(`  await db.update(t).set({ status: 'cancelled' })`)
  if (noWhere.violations.length !== 1 || noWhere.violations[0].whereWhy !== '无 where')
    throw new Error(`无 where 必须红且说明原因:${JSON.stringify(noWhere.violations)}`)

  // 判不了格(头注 B4 段,如实钉住:不进面 —— 既不判红也不冒绿)。
  const unjudgeable = [
    ['变量值', '  await db.update(t).set({ status: nextStatus }).where(eq(t.id, x))'],
    ['简写', '  await db.update(t).set({ status }).where(eq(t.id, x))'],
    ['spread', '  await db.update(t).set({ ...patch }).where(eq(t.id, x))'],
    ['数字枚举码', '  await db.update(t).set({ status: 2 }).where(eq(t.id, x))'],
    ['裸 SQL 维(刻意不认)', '  await db.execute(sql`UPDATE t SET status = ${x} WHERE id = ${y}`)'],
  ]
  for (const [why, body] of unjudgeable) {
    const u = b4Scan(body)
    if (u.candidates.length !== 0 || u.violations.length !== 0)
      throw new Error(`判不了格「${why}」必须不进面(登记而非假装已解决):${JSON.stringify(u)}`)
  }
})

/* ------------------------------ §22c 取材锁 ------------------------------ */

test('§22c 取材锁:__test__ 新出口在位,镜像测试不养第二份判据', () => {
  for (const [k, check] of [
    ['findBackfillBoundSites', (v) => typeof v === 'function'],
    ['findTerminalStateSites', (v) => typeof v === 'function'],
    ['findOrderByTailKeySites', (v) => typeof v === 'function'],
    ['MIGRATION_COL_RE', (v) => v instanceof RegExp],
    ['BACKFILL_BOUND_RE', (v) => v instanceof RegExp],
    ['STATE_LITERAL_KEY_RE', (v) => v instanceof RegExp],
    ['RISKY_ORDER_COL_RE', (v) => v instanceof RegExp],
    ['ORDER_SINGLE_KEY_RE', (v) => v instanceof RegExp],
  ]) {
    if (!check(T[k]))
      throw new Error(`守门 __test__ 必须导出 ${k},镜像判据只此一份实现,实得 ${typeof T[k]}`)
  }
})

/* --------------------------- G-815953:真仓对照 --------------------------- */

test('G-815953 真仓对照:HEAD 的 id-mapping-queries.ts 走唯一出口零违规;抹掉出口名必现 1 处违规', () => {
  const blob = execFileSync(
    GIT,
    [
      '-c',
      'safe.directory=*',
      '-C',
      REPO_ROOT,
      'cat-file',
      'blob',
      'HEAD:apps/api/src/db/id-mapping-queries.ts',
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 8 << 20 },
  )
  if (!blob.includes('backfillWhere('))
    throw new Error('HEAD 的 id-mapping-queries.ts 必须走 backfillWhere 唯一出口(首落点),否则正例对照失效')
  const ok = T.scanFileText('apps/api/src/db/id-mapping-queries.ts', blob)
  if (ok.b3.violations.length !== 0)
    throw new Error(`已提交的出口写法不得判红:${JSON.stringify(ok.b3.violations)}`)
  if (ok.b3.candidates.length < 1)
    throw new Error('HEAD 应至少有 1 个 B3 候选(backfillMigrationBatch),候选为 0 说明判据失明')
  // 变异对照:把出口名抹成 and( ⇒ 上界谓词从 whereText 里消失 ⇒ 必须现出 1 处违规。
  const mutated = blob.replace(/backfillWhere\s*\(/, 'and(')
  const bad = T.scanFileText('apps/api/src/db/id-mapping-queries.ts', mutated)
  if (bad.b3.violations.length !== 1)
    throw new Error(`抹掉上界出口后必须现出 1 处 B3 违规,实得 ${JSON.stringify(bad.b3)}`)
  if (bad.b3.violations[0].col !== 'migrationBatch')
    throw new Error(`变异红点必须指着迁移记账列:${JSON.stringify(bad.b3.violations[0])}`)
})

/* ------------------------- G-815953:CLI 端到面 + 棘轮 ------------------------- */

const B3_BAD_SRC = [
  "import { eq } from 'drizzle-orm'",
  "import { db } from './index.js'",
  "import { idMapping } from '@ihui/database'",
  'export async function backfillBatch(toBatch, fromBatch) {',
  '  await db.update(idMapping).set({ migrationBatch: toBatch }).where(eq(idMapping.migrationBatch, fromBatch))',
  '}',
  '',
].join('\n')
const B3_LTE_SRC = [
  "import { and, eq, lte } from 'drizzle-orm'",
  "import { db } from './index.js'",
  "import { idMapping } from '@ihui/database'",
  'export async function backfillBatch(toBatch, fromBatch, baseline) {',
  '  await db',
  '    .update(idMapping)',
  '    .set({ migrationBatch: toBatch })',
  '    .where(and(eq(idMapping.migrationBatch, fromBatch), lte(idMapping.createdAt, baseline)))',
  '}',
  '',
].join('\n')
const B3_SECOND_SRC = [
  'export async function backfillLegacyKeys(toBatch, fromTable) {',
  '  await db.update(idMapping).set({ legacyId: 1 }).where(eq(idMapping.legacyTable, fromTable))',
  '}',
  '',
].join('\n')

test('G-815953 CLI 端到面:无界回填 --strict 必红;lte 上界同形状 --strict 绿', () => {
  const badDir = mkScratch('g815-b3-bad-')
  try {
    writeRepo(badDir, { files: { [B3_REL]: B3_BAD_SRC } })
    const r = parse(run(badDir, ['--root', badDir, '--strict', '--json']))
    if (r.code !== 1)
      throw new Error(`无界回填 --strict 必须 exit 1(存量 0,B3 全量判红),实得 ${r.code}:${r.out.slice(0, 240)}`)
    if (r.j.counts.b3Violations !== 1)
      throw new Error(`counts.b3Violations 应为 1,实得 ${JSON.stringify(r.j.counts)}`)
    if (r.j.b3Violations?.[0]?.file !== B3_REL || r.j.b3Violations[0].via !== 'drizzle')
      throw new Error(`红点必须点名文件与维:${JSON.stringify(r.j.b3Violations)}`)
  } finally {
    rmScratch(badDir)
  }

  const goodDir = mkScratch('g815-b3-good-')
  try {
    writeRepo(goodDir, { files: { [B3_REL]: B3_LTE_SRC } })
    const r = parse(run(goodDir, ['--root', goodDir, '--strict', '--json']))
    if (r.code !== 0)
      throw new Error(`lte 上界 --strict 必须绿,实得 exit ${r.code}:${r.out.slice(0, 240)}`)
    if (r.j.counts.b3Candidates !== 1 || r.j.counts.b3Violations !== 0)
      throw new Error(`候选 1 违规 0 才是"看得见且放过",实得 ${JSON.stringify(r.j.counts)}`)
  } finally {
    rmScratch(goodDir)
  }
})

test('G-815953 CLI 棘轮:同文件第二条无界回填 ⇒ 净新增红,锚点 = 该文件 HEAD 自身 B3 计数', () => {
  const dir = mkScratch('g815-b3-ratchet-')
  try {
    writeRepo(dir, { files: { [B3_REL]: B3_BAD_SRC } })
    // 持平:索引 == HEAD(1 处存量)⇒ 不拦(防恒红门)。
    const flat = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (flat.code !== 0)
      throw new Error(`与改动无关的存量不得判红,实得 exit ${flat.code}:${flat.out.slice(0, 240)}`)
    // 同文件加第二条无界回填 ⇒ 2 > 锚点 1 ⇒ 红,且锚点必须报出 1。
    put(dir, B3_REL, B3_BAD_SRC + B3_SECOND_SRC)
    gitIn(dir, ['add', B3_REL])
    const more = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (more.code !== 1)
      throw new Error(`净新增必须 exit 1,实得 ${more.code}:${more.out.slice(0, 240)}`)
    const r = (more.j.ratcheted || []).find((e) => e.kind === 'b3')
    if (!r) throw new Error(`ratcheted 必须含 kind='b3':${JSON.stringify(more.j.ratcheted)}`)
    if (r.file !== B3_REL || r.anchor !== 1 || r.now !== 2 || r.added !== 1)
      throw new Error(`锚点必须是该文件 HEAD 自身 B3 计数(1):${JSON.stringify(r)}`)
  } finally {
    rmScratch(dir)
  }
})

/* ------------------------- G-815956:CLI 端到面 + 棘轮 ------------------------- */

const B4_BAD_SRC = [
  "import { eq } from 'drizzle-orm'",
  "import { db } from './index.js'",
  'export async function cancel(id) {',
  "  await db.update(sessionTable).set({ status: 'cancelled' }).where(eq(sessionTable.id, id))",
  '}',
  '',
].join('\n')

test('G-815956 CLI 端到面:存量 head+strict 只报数不判红;staged 净新增即红(kind=b4,新文件锚点 0)', () => {
  const dir = mkScratch('g815-b4-')
  try {
    writeRepo(dir, { files: { [B4_REL]: B4_BAD_SRC } })
    // 棘轮专用维的结构锁:head 面(含 --strict)对 B4 存量只报数 —— decide 刻意不收 b4Violations。
    const head = parse(run(dir, ['--root', dir, '--strict', '--json']))
    if (head.code !== 0)
      throw new Error(
        `B4 存量 head+strict 不判红(只拦新增),实得 exit ${head.code}:${head.out.slice(0, 240)}`,
      )
    if (head.j.counts.b4Violations !== 1)
      throw new Error(`存量必须报数可见(counts.b4Violations=1),实得 ${JSON.stringify(head.j.counts)}`)
    // 持平:索引只追加一行注释(遮蔽面同文)⇒ B4 计数不变 ⇒ 不拦。
    put(dir, B4_REL, `${B4_BAD_SRC}// touched\n`)
    gitIn(dir, ['add', B4_REL])
    const flat = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (flat.code !== 0)
      throw new Error(`与锚点持平时不得判红,实得 exit ${flat.code}:${flat.out.slice(0, 240)}`)
    // 净新增:新文件一条 B4 ⇒ 锚点 0 ⇒ 红。
    put(dir, B4_NEW_REL, B4_BAD_SRC)
    gitIn(dir, ['add', B4_NEW_REL])
    const more = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (more.code !== 1)
      throw new Error(`净新增必须 exit 1,实得 ${more.code}:${more.out.slice(0, 240)}`)
    const r = (more.j.ratcheted || []).find((e) => e.kind === 'b4')
    if (!r) throw new Error(`ratcheted 必须含 kind='b4':${JSON.stringify(more.j.ratcheted)}`)
    if (r.file !== B4_NEW_REL || r.anchor !== 0 || r.added !== 1)
      throw new Error(`新文件的锚点必须是 0:${JSON.stringify(r)}`)
  } finally {
    rmScratch(dir)
  }
})

/* --------------------------- G-815955:B5 判据直测 --------------------------- */

test('G-815955 B5 正反成对:单键无尾键红 / 补尾键绿 / desc·sequence 变体 / 反假阳与判不了格不进面', () => {
  // 红:票面红例逐字形状 —— 单键 asc(sortOrder),同值行两次查询间没有确定座位(分页漂移)。
  const bad = b5Scan('  await db.select().from(plans).orderBy(asc(plans.sortOrder))')
  if (bad.violations.length !== 1 || bad.candidates.length !== 1)
    throw new Error(`单键无尾键必须 1 违规 1 候选,实得 ${JSON.stringify(bad)}`)
  if (bad.violations[0].col !== 'sortOrder' || bad.violations[0].via !== 'drizzle')
    throw new Error(`落点字段不对:${JSON.stringify(bad.violations[0])}`)
  if (!/单键排序无确定性尾键/.test(bad.violations[0].orderByWhy || ''))
    throw new Error(`红点必须说清缺什么:${bad.violations[0].orderByWhy}`)

  // 绿:票面正例 —— 补 desc(createdAt), asc(id) 确定性尾键;首键同族但后面还有键 ⇒ 放过。
  const green = b5Scan(
    '  await db.select().from(plans).orderBy(asc(plans.sortOrder), desc(plans.createdAt), asc(plans.id))',
  )
  if (green.violations.length !== 0 || green.candidates.length !== 1)
    throw new Error(`补尾键必须绿:${JSON.stringify(green)}`)
  if (green.candidates[0].disposition !== 'tail-key')
    throw new Error(`处置必须是 tail-key:${JSON.stringify(green.candidates[0])}`)

  // 变体:desc + sequence 同判红 —— 键族与方向都不限 sortOrder·asc(判据按族划线)。
  const seq = b5Scan('  await db.select().from(tasks).orderBy(desc(tasks.sequence))')
  if (seq.violations.length !== 1 || seq.violations[0].col !== 'sequence')
    throw new Error(`desc+sequence 必须同判:${JSON.stringify(seq)}`)
  const pos = b5Scan('  await db.select().from(items).orderBy(asc(items.position))')
  if (pos.violations.length !== 1 || pos.violations[0].col !== 'position')
    throw new Error(`position 必须同判:${JSON.stringify(pos)}`)

  // 反假阳锁:首键不在键族(asc(t.name))与守门既有的多键惯例形态 ⇒ 不进面(词法只认票面键族)。
  const nonFamily = b5Scan('  await db.select().from(t).orderBy(asc(t.name))')
  if (nonFamily.candidates.length !== 0 || nonFamily.violations.length !== 0)
    throw new Error(`非键族首键不得进面:${JSON.stringify(nonFamily)}`)

  // 判不了格(守门头注 B5 段,如实钉住:不进面 —— 既不判红也不冒绿)。
  const unjudgeable = [
    ['变量键', '  await db.select().from(t).orderBy(sortCol)'],
    ['展开键', '  await db.select().from(t).orderBy(...keys)'],
    ['sql 模板', '  await db.select().from(t).orderBy(sql`sort_order asc`)'],
    ['裸 SQL SELECT…ORDER BY', "  await db.execute(sql`SELECT * FROM t ORDER BY sort_order`)"],
  ]
  for (const [why, body] of unjudgeable) {
    const u = b5Scan(body)
    if (u.candidates.length !== 0 || u.violations.length !== 0)
      throw new Error(`判不了格「${why}」必须不进面(登记而非假装已解决):${JSON.stringify(u)}`)
  }
})

/* ------------------------- G-815955:CLI 端到面 + 棘轮 ------------------------- */

const B5_BAD_SRC = [
  "import { asc } from 'drizzle-orm'",
  "import { db } from './index.js'",
  "import { plans } from '@ihui/database'",
  'export async function listPlans() {',
  '  await db.select().from(plans).orderBy(asc(plans.sortOrder))',
  '}',
  '',
].join('\n')

test('G-815955 CLI 端到面:存量 head+strict 只报数不判红;staged 净新增即红(kind=b5,新文件锚点 0)', () => {
  const dir = mkScratch('g815-b5-')
  try {
    writeRepo(dir, { files: { [B5_REL]: B5_BAD_SRC } })
    // 棘轮专用维的结构锁:head 面(含 --strict)对 B5 存量只报数 —— decide 刻意不收 b5Violations(与 B4 同构)。
    const head = parse(run(dir, ['--root', dir, '--strict', '--json']))
    if (head.code !== 0)
      throw new Error(
        `B5 存量 head+strict 不判红(只拦新增),实得 exit ${head.code}:${head.out.slice(0, 240)}`,
      )
    if (head.j.counts.b5Violations !== 1)
      throw new Error(`存量必须报数可见(counts.b5Violations=1),实得 ${JSON.stringify(head.j.counts)}`)
    if (head.j.b5Violations?.[0]?.file !== B5_REL || head.j.b5Violations[0].col !== 'sortOrder')
      throw new Error(`报数必须点名文件与列:${JSON.stringify(head.j.b5Violations)}`)
    // 持平:索引只追加一行注释(遮蔽面同文)⇒ B5 计数与锚点持平 ⇒ 不拦(防恒红门)。
    put(dir, B5_REL, `${B5_BAD_SRC}// touched\n`)
    gitIn(dir, ['add', B5_REL])
    const flat = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (flat.code !== 0)
      throw new Error(`与锚点持平时不得判红,实得 exit ${flat.code}:${flat.out.slice(0, 240)}`)
    // 净新增:新文件一条 B5 ⇒ 锚点 0 ⇒ 红。
    put(dir, B5_NEW_REL, B5_BAD_SRC)
    gitIn(dir, ['add', B5_NEW_REL])
    const more = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (more.code !== 1)
      throw new Error(`净新增必须 exit 1,实得 ${more.code}:${more.out.slice(0, 240)}`)
    const r = (more.j.ratcheted || []).find((e) => e.kind === 'b5')
    if (!r) throw new Error(`ratcheted 必须含 kind='b5':${JSON.stringify(more.j.ratcheted)}`)
    if (r.file !== B5_NEW_REL || r.anchor !== 0 || r.added !== 1)
      throw new Error(`新文件的锚点必须是 0:${JSON.stringify(r)}`)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
