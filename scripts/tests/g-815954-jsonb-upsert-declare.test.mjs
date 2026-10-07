// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试(§22c 模式 —— 判据与取材一律从守门 134 的 `__test__` 取,**不在这里抄第二份正则**):
 * G-815954(B6):jsonb 整列覆盖式 upsert 会吃掉"显式清空"的墓碑 —— onConflictDoUpdate 的 set 块
 * 凡写 jsonb 键族的列(metadata/messages/payload/categories/tags/credentialsJson,词法近似),
 * 每一列必须**逐列声明写策略**:
 *   - 具名成员合并(sql`${t.col} || <具名成员>::jsonb`)与 `jsonb_set(` 指定路径 = 结构上即绿
 *     (缺席不触碰语义,票面正反对的绿腿);
 *   - 其余形态(整块 `excluded.<col>` 搬入 / 裸赋值 / 纯字符串)⇒ 整列覆盖,键行及其上 3 行内必须有
 *     逐列策略声明注释 `// <列>:全量真相`(或 `<列>:全量覆盖` / `<列>:full-truth` 别名),
 *     无声明 ⇒ 红腿。票面正反成对:**整块 excluded ⇒ 红;jsonb_set ⇒ 绿**。
 *
 * **窄口径取舍(与守门头注 B6 段同源,如实登记)**:B6 是与 B4/B5 同档的**棘轮专用维** ——
 * HEAD 面实存 7 处整列覆盖无声明(registry-queries.ts 同步快照 upsert ×6:categories/tags/payload
 * 的 raw.* 与 EXCLUDED.* 各 3;im-gateway.ts 凭据回写 ×1),镜像形状与存量词法同形;收窄列族到
 * 0 列会让判据失明,逐处补声明又属业务代码改动(不归本门)。按票面口径"现存违规报数不判红,只拦
 * 新增":head 面(含 --strict)只报数、永不判红(decide 签名**刻意不收** b6Violations —— 结构锁,
 * 守门自检 B6D 钉住);staged 面走「该文件 HEAD 自身 B6 计数」差值棘轮(kind='b6'),净新增即红,
 * 新文件锚点 0(第一个 jsonb upsert 第一次就写错必须判红)。
 *
 * **真仓对照(票面硬要求)**:阳性站点 apps/api/src/services/agent-runtime/session-store.ts
 * 已修(提交 adcdceb7f6):messages 全量真相+逐列声明、metadata 具名成员合并 —— 本文件直接读
 * HEAD blob 复核**必须判绿**(0 违规,两条候选的处置各归其位);抹掉声明注释必现 1 处违规。
 * registry-queries.ts / im-gateway.ts 的 7 处存量是**基线锁**:修掉一处(改绿是期望的收敛方向)
 * 请同步改这里的期望数 —— 锁死数字才能让"存量被偷偷变大"在测试面上现形。
 *
 * **判不了格登记(与守门头注 B6 段同源,本文件钉住其中可词法判的几格)**:
 *  - ①"列是否真是 jsonb"靠键族词法近似;刻意**不含 value**(systemConfigs/userPreferences 的
 *    value 是 text 列,按名收族会把 6 处 KV 覆盖误判进面);族外 jsonb 列(config/context/prefs
 *    等)不进面,扩族必须同批核对 HEAD 存量,否则恒红门(§12e);
 *  - ②config 的 set 非对象字面量(set: buildSet(row) 一类)⇒ 不进面;
 *  - ③合并右值经中间变量在别处拼装 ⇒ 看不见(fail-closed:按整列覆盖计,声明通道可放行);
 *  - ④声明写在键行上方 >3 行 ⇒ 垂直窗口外,读不到,照红;
 *  - ⑤jsonb_insert( 等其他路径语义函数未列绿腿 ⇒ 按整列覆盖计(fail-closed,同 ③)。
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

// 直测夹具的路径只是红点字段里的文件名标签(判据按 set 块形态分流,不按路径)。
const DB_REL = 'apps/api/src/db/g815954-fixture.ts'
// CLI 端到面两条腿:基础面(SCAN_DIRS)落 apps/api/src/db;B6 专属面增量枚举落 apps/api/src/services
// (票面阳性站点 session-store.ts 住在 services —— 判据必须看得见它才能判绿)。
const B6_REL = 'apps/api/src/db/jsonb-g815954.ts'
const B6_NEW_REL = 'apps/api/src/db/jsonb-g815954-more.ts'
const B6_SVC_REL = 'apps/api/src/services/g815954-jsonb-fixture.ts'

/** 直测夹具统一包进函数体(与真实落点同形)。变量名词法同形即可,不执行。 */
const b6Wrap = (body) =>
  [
    "import { sql } from 'drizzle-orm'",
    "import { db } from './index.js'",
    'export async function go(row: Record<string, unknown>, flag: boolean, enabled: boolean) {',
    body,
    '}',
    '',
  ].join('\n')
const b6Scan = (body) => T.scanFileText(DB_REL, b6Wrap(body)).b6

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

/** 真仓对照:直读本仓 HEAD 的 blob(不读工作树 —— 工作树常有他人在飞改动)。 */
function headBlob(rel) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', REPO_ROOT, 'cat-file', 'blob', `HEAD:${rel}`], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 8 << 20,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/* --------------------------- G-815954:B6 判据直测 --------------------------- */

test('G-815954 B6 正反成对:整块 excluded 红 / jsonb_set 绿 / 具名合并 绿 / 整列覆盖+声明 绿 / 删声明变异 红', () => {
  // 红(票面红腿):整块 excluded 搬入 —— 冲突行的新值整列盖上,别的写入方的具名成员与 null 墓碑被整笔吃掉。
  const ex = b6Scan(
    '  await db.insert(things).values(row).onConflictDoUpdate({ target: things.id, set: { payload: sql`EXCLUDED.payload` } })',
  )
  if (ex.violations.length !== 1 || ex.candidates.length !== 1)
    throw new Error(`整块 excluded 必须 1 违规 1 候选,实得 ${JSON.stringify(ex)}`)
  if (ex.violations[0].form !== 'excluded' || ex.violations[0].col !== 'payload' || ex.violations[0].via !== 'drizzle')
    throw new Error(`红点落点字段不对:${JSON.stringify(ex.violations[0])}`)
  if (!/excluded 整块搬入/.test(ex.violations[0].setWhy || ''))
    throw new Error(`红点必须说清缺什么:${ex.violations[0].setWhy}`)

  // 绿(票面绿腿①):jsonb_set 指定路径 —— 未点名的路径不触碰。
  const js = b6Scan(
    "  await db.insert(things).values({ id }).onConflictDoUpdate({ target: things.id, set: { payload: sql`jsonb_set(${things.payload}, '{a}', ${flag}::jsonb)` } })",
  )
  if (js.violations.length !== 0 || js.candidates.length !== 1)
    throw new Error(`jsonb_set 必须绿:${JSON.stringify(js)}`)
  if (js.candidates[0].disposition !== 'jsonb-set')
    throw new Error(`处置必须是 jsonb-set:${JSON.stringify(js.candidates[0])}`)

  // 绿(票面绿腿②):具名成员合并 —— `||` 右侧只含本次点名的成员,行内旧成员(含 null 墓碑)不因本次写入被吃掉。
  const mg = b6Scan(
    '  await db.insert(things).values({ id }).onConflictDoUpdate({ target: things.id, set: { metadata: sql`${things.metadata} || ${JSON.stringify(row)}::jsonb` } })',
  )
  if (mg.violations.length !== 0 || mg.candidates.length !== 1)
    throw new Error(`具名成员合并必须绿:${JSON.stringify(mg)}`)
  if (mg.candidates[0].disposition !== 'named-merge')
    throw new Error(`处置必须是 named-merge:${JSON.stringify(mg.candidates[0])}`)

  // 绿(整列覆盖的唯一放行通道):键行上一行带逐列策略声明(session-store 现行写法)。
  const declaredBody = [
    '  await db.insert(agentRuntimeSessions).values(row).onConflictDoUpdate({',
    '    target: agentRuntimeSessions.id,',
    '    set: {',
    '      // messages:全量真相 —— 内存态即完整转写,整列落盘。',
    '      messages: row.context.messages,',
    '    },',
    '  })',
  ].join('\n')
  const ok = b6Scan(declaredBody)
  if (ok.violations.length !== 0 || ok.candidates.length !== 1)
    throw new Error(`带声明整列覆盖必须绿:${JSON.stringify(ok)}`)
  if (ok.candidates[0].disposition !== 'declared-full-truth')
    throw new Error(`处置必须是 declared-full-truth:${JSON.stringify(ok.candidates[0])}`)

  // 变异对照(票面硬要求):上一条**删掉声明注释** ⇒ 必须转红 —— 逐列声明是整列覆盖的唯一放行通道。
  const mutatedBody = declaredBody.replace(/^ *\/\/ messages:全量真相[^\n]*\n/m, '')
  if (mutatedBody === declaredBody) throw new Error('变异必须真的抹掉了声明行,否则对照失效')
  const noDecl = b6Scan(mutatedBody)
  if (noDecl.violations.length !== 1 || noDecl.candidates.length !== 1)
    throw new Error(`删声明后必须转红:${JSON.stringify(noDecl)}`)
  if (noDecl.violations[0].form !== 'bare' || noDecl.violations[0].col !== 'messages')
    throw new Error(`变异红点必须是 messages 裸覆盖:${JSON.stringify(noDecl.violations[0])}`)
  if (!/整列覆盖/.test(noDecl.violations[0].setWhy || ''))
    throw new Error(`bare 红点的 why 与 excluded 必须各说各话:${noDecl.violations[0].setWhy}`)

  // 绿(变体):整块 excluded 也走声明通道 + 英文别名 full-truth 同放行。
  const exDecl = b6Scan(
    [
      '  await db.insert(things).values(row).onConflictDoUpdate({',
      '    target: things.id,',
      '    set: {',
      '      // payload: full-truth —— 同步快照即权威全集(英文别名同放行)。',
      '      payload: sql`EXCLUDED.payload`,',
      '    },',
      '  })',
    ].join('\n'),
  )
  if (exDecl.violations.length !== 0 || exDecl.candidates[0]?.disposition !== 'declared-full-truth')
    throw new Error(`excluded + 声明(英文别名)必须绿:${JSON.stringify(exDecl)}`)
})

test('G-815954 B6 冒充钉子与判不了格:字符串冒充绿腿/声明照红,JS 层 || 是值运算,jsonb_insert fail-closed,键族外不进面', () => {
  // 冒充钉子①:纯字符串值里带 `|| …::jsonb` —— 全遮蔽档剩空白,冒充不了合并,照红。
  const strMerge = b6Scan(
    '  await db.insert(kv).values(row).onConflictDoUpdate({ target: kv.key, set: { metadata: "x || y::jsonb" } })',
  )
  if (strMerge.violations.length !== 1 || strMerge.violations[0].form !== 'bare')
    throw new Error(`字符串冒充合并必须照红:${JSON.stringify(strMerge)}`)

  // 冒充钉子②:JS 层 `||` 是值运算(产出整颗新值 = 整列覆盖;无 sql` 标签 ⇒ 非合并),照红。
  const jsOr = b6Scan(
    '  await db.insert(things).values({ id }).onConflictDoUpdate({ target: things.id, set: { metadata: enabled || false } })',
  )
  if (jsOr.violations.length !== 1 || jsOr.violations[0].form !== 'bare')
    throw new Error(`JS 层 || 必须按裸覆盖照红:${JSON.stringify(jsOr)}`)

  // 冒充钉子③:声明字样活在**字符串值**里 ⇒ 头查注释符 + 同位判档双锁拒绝,照红。
  const strDecl = b6Scan(
    '  await db.insert(kv).values(row).onConflictDoUpdate({ target: kv.key, set: { messages: "messages:全量真相 —— 完整转写" } })',
  )
  if (strDecl.violations.length !== 1)
    throw new Error(`字符串冒充声明必须照红:${JSON.stringify(strDecl)}`)

  // fail-closed 钉子:jsonb_insert( 等其他路径语义函数未列绿腿 ⇒ 按整列覆盖计(判不了格⑤)。
  const jbIns = b6Scan(
    "  await db.insert(things).values({ id }).onConflictDoUpdate({ target: things.id, set: { payload: sql`jsonb_insert(${things.payload}, '{a}', ${flag}::jsonb)` } })",
  )
  if (jbIns.violations.length !== 1)
    throw new Error(`未列绿腿的路径函数必须 fail-closed 照红:${JSON.stringify(jbIns)}`)

  // 判不了格④:声明写在键行上方 >3 行 ⇒ 垂直窗口外,读不到,照红(登记,不装看不见)。
  const tooFar = b6Scan(
    [
      '  await db.insert(agentRuntimeSessions).values(row).onConflictDoUpdate({',
      '    target: agentRuntimeSessions.id,',
      '    set: {',
      '      // messages:全量真相 —— 这行声明离键行 4 行,超出垂直窗口(键行+上3行)。',
      '      status: row.status,',
      '      updatedAt: new Date(),',
      '      createdAt: new Date(),',
      '      messages: row.context.messages,',
      '    },',
      '  })',
    ].join('\n'),
  )
  if (tooFar.violations.length !== 1)
    throw new Error(`垂直窗口外的声明必须读不到(照红):${JSON.stringify(tooFar)}`)

  // 判不了格①/②:键族外列(刻意不含 value)与 set 非对象字面量 ⇒ 不进面(既不判红也不冒绿)。
  const noFace = [
    ['键族外 value(刻意不含)', '  await db.insert(kv).values(row).onConflictDoUpdate({ target: kv.key, set: { value: row.value } })'],
    ['族外 jsonb 列 config', '  await db.insert(things).values(row).onConflictDoUpdate({ target: things.id, set: { config: row.config } })'],
    ['set 非对象字面量', '  await db.insert(things).values(row).onConflictDoUpdate({ target: things.id, set: buildSet(row) })'],
  ]
  for (const [why, body] of noFace) {
    const u = b6Scan(body)
    if (u.candidates.length !== 0 || u.violations.length !== 0)
      throw new Error(`判不了格「${why}」必须不进面(登记而非假装已解决):${JSON.stringify(u)}`)
  }
})

/* ------------------------------ §22c 取材锁 ------------------------------ */

test('§22c 取材锁:__test__ B6 出口在位,镜像测试不养第二份判据', () => {
  for (const [k, check] of [
    ['findJsonbUpsertSites', (v) => typeof v === 'function'],
    ['listJsonbUpsertExtraPaths', (v) => typeof v === 'function'],
    ['jsonbPolicyDeclRe', (v) => typeof v === 'function'],
    ['JSONB_UPSERT_COL_RE', (v) => v instanceof RegExp],
    ['JSONB_SET_RE', (v) => v instanceof RegExp],
    ['JSONB_MERGE_RE', (v) => v instanceof RegExp],
    ['JSONB_SQL_TAG_RE', (v) => v instanceof RegExp],
    ['EXCLUDED_REF_RE', (v) => v instanceof RegExp],
    [
      'JSONB_UPSERT_SCAN_DIRS',
      (v) =>
        Array.isArray(v) &&
        T.SCAN_DIRS.every((d) => v.includes(d)) &&
        v.includes('apps/api/src/services') &&
        v.includes('apps/api/src/plugins'),
    ],
  ]) {
    if (!check(T[k]))
      throw new Error(`守门 __test__ 必须导出 ${k},镜像判据只此一份实现,实得 ${typeof T[k]}`)
  }
})

/* ------------------------------ G-815954:真仓对照 ------------------------------ */

test('G-815954 真仓对照:HEAD 的 session-store.ts 必须判绿(声明+合法合并);registry/im-gateway 存量 7 处基线锁', () => {
  const SS_REL = 'apps/api/src/services/agent-runtime/session-store.ts'
  const blob = headBlob(SS_REL)
  // 票面硬要求:阳性站点已修(adcdceb7f6)—— messages 逐列声明、metadata 具名成员合并,HEAD 面必须 0 违规。
  const ok = T.scanFileText(SS_REL, blob)
  if (ok.b6.violations.length !== 0)
    throw new Error(`阳性站点 HEAD 面必须判绿:${JSON.stringify(ok.b6.violations)}`)
  const byCol = new Map(ok.b6.candidates.map((c) => [c.col, c]))
  if (
    ok.b6.candidates.length !== 2 ||
    byCol.get('messages')?.disposition !== 'declared-full-truth' ||
    byCol.get('metadata')?.disposition !== 'named-merge'
  )
    throw new Error(`两条候选的处置必须各归其位:${JSON.stringify([...byCol.values()])}`)

  // 变异对照:抹掉 messages 的逐列声明 ⇒ 必须现出 1 处违规(整列覆盖失去唯一放行通道)。
  const mutated = blob.replace(/^\s*\/\/ messages:全量真相[^\n]*\n/m, '')
  if (mutated === blob) throw new Error('变异必须真的抹掉了声明行,否则对照失效')
  const bad = T.scanFileText(SS_REL, mutated)
  if (bad.b6.violations.length !== 1 || bad.b6.violations[0].col !== 'messages' || bad.b6.violations[0].form !== 'bare')
    throw new Error(`抹掉声明后必须现出 1 处 messages 违规:${JSON.stringify(bad.b6.violations)}`)

  // 存量基线锁(棘轮专用维的"报数不判红"必须建立在看得见上):修掉一处(期望方向)请同步改期望数。
  const reg = T.scanFileText('apps/api/src/db/registry-queries.ts', headBlob('apps/api/src/db/registry-queries.ts')).b6
  const regForms = reg.violations.map((v) => v.form)
  if (
    reg.violations.length !== 6 ||
    regForms.filter((f) => f === 'excluded').length !== 3 ||
    regForms.filter((f) => f === 'bare').length !== 3
  )
    throw new Error(
      `registry-queries.ts 存量基线:6 处(excluded/bare 各 3),实得 ${JSON.stringify(reg.violations.map((v) => [v.line, v.col, v.form]))}`,
    )
  const im = T.scanFileText('apps/api/src/routes/im-gateway.ts', headBlob('apps/api/src/routes/im-gateway.ts')).b6
  if (im.violations.length !== 1 || im.violations[0].col !== 'credentialsJson' || im.violations[0].form !== 'bare')
    throw new Error(`im-gateway.ts 存量基线:1 处 credentialsJson bare,实得 ${JSON.stringify(im.violations)}`)
})

/* ------------------------- G-815954:CLI 端到面 + 棘轮 ------------------------- */

const B6_BAD_SRC = [
  "import { sql } from 'drizzle-orm'",
  "import { db } from './index.js'",
  "import { registryThings } from '@ihui/database'",
  'export async function syncThing(row: Record<string, unknown>) {',
  '  await db',
  '    .insert(registryThings)',
  '    .values(row)',
  '    .onConflictDoUpdate({',
  '      target: registryThings.id,',
  '      set: { payload: sql`EXCLUDED.payload` },',
  '    })',
  '}',
  '',
].join('\n')

test('G-815954 CLI 端到面:存量 head+strict 只报数不判红;staged 净新增即红(kind=b6,新文件锚点 0)', () => {
  const dir = mkScratch('g815954-db-')
  try {
    writeRepo(dir, { files: { [B6_REL]: B6_BAD_SRC } })
    // 棘轮专用维的结构锁:head 面(含 --strict)对 B6 存量只报数 —— decide 刻意不收 b6Violations。
    const head = parse(run(dir, ['--root', dir, '--strict', '--json']))
    if (head.code !== 0)
      throw new Error(`B6 存量 head+strict 不判红(只拦新增),实得 exit ${head.code}:${head.out.slice(0, 240)}`)
    if (head.j.counts.b6Violations !== 1)
      throw new Error(`存量必须报数可见(counts.b6Violations=1),实得 ${JSON.stringify(head.j.counts)}`)
    if (head.j.b6Violations?.[0]?.file !== B6_REL || head.j.b6Violations[0].col !== 'payload')
      throw new Error(`报数必须点名文件与列:${JSON.stringify(head.j.b6Violations)}`)
    // 持平:索引只追加一行注释(遮蔽面同文)⇒ B6 计数与锚点持平 ⇒ 不拦(防恒红门)。
    put(dir, B6_REL, `${B6_BAD_SRC}// touched\n`)
    gitIn(dir, ['add', B6_REL])
    const flat = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (flat.code !== 0)
      throw new Error(`与锚点持平时不得判红,实得 exit ${flat.code}:${flat.out.slice(0, 240)}`)
    // 净新增:新文件一条 B6 ⇒ 锚点 0 ⇒ 红(第一个 jsonb upsert 第一次就写错必须判红)。
    put(dir, B6_NEW_REL, B6_BAD_SRC)
    gitIn(dir, ['add', B6_NEW_REL])
    const more = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (more.code !== 1)
      throw new Error(`净新增必须 exit 1,实得 ${more.code}:${more.out.slice(0, 240)}`)
    const r = (more.j.ratcheted || []).find((e) => e.kind === 'b6')
    if (!r) throw new Error(`ratcheted 必须含 kind='b6':${JSON.stringify(more.j.ratcheted)}`)
    if (r.file !== B6_NEW_REL || r.anchor !== 0 || r.added !== 1)
      throw new Error(`新文件的锚点必须是 0:${JSON.stringify(r)}`)
  } finally {
    rmScratch(dir)
  }
})

const B6_SVC_SRC = [
  "import { sql } from 'drizzle-orm'",
  "import { db } from '../db/index.js'",
  "import { agentRuntimeSessions } from '@ihui/database'",
  'export async function touchSession(id: string, snapshot: Record<string, unknown>) {',
  '  await db',
  '    .insert(agentRuntimeSessions)',
  '    .values({ id, payload: snapshot })',
  '    .onConflictDoUpdate({',
  '      target: agentRuntimeSessions.id,',
  '      set: { payload: sql`EXCLUDED.payload` },',
  '    })',
  '}',
  '',
].join('\n')

/** 同文件换一列再覆盖(换列逃逸钉子):2 > 锚点 1 ⇒ 净新增红 —— 被覆盖的列名在红点字段里点名,换列不豁免。 */
const B6_SVC_TWO_SRC = [
  "import { sql } from 'drizzle-orm'",
  "import { db } from '../db/index.js'",
  "import { agentRuntimeSessions } from '@ihui/database'",
  'export async function touchSession(id: string, snapshot: Record<string, unknown>, meta: Record<string, unknown>) {',
  '  await db.insert(agentRuntimeSessions).values({ id, payload: snapshot }).onConflictDoUpdate({ target: agentRuntimeSessions.id, set: { payload: sql`EXCLUDED.payload` } })',
  '  await db.insert(agentRuntimeSessions).values({ id, metadata: meta }).onConflictDoUpdate({ target: agentRuntimeSessions.id, set: { metadata: meta } })',
  '}',
  '',
].join('\n')

test('G-815954 CLI 专属面:services 落点 B6 也看得见(维度专属枚举);同文件换列再覆盖 = 净新增(换列逃逸不存在)', () => {
  const dir = mkScratch('g815954-svc-')
  try {
    // 基础面(routes/db)全空会触发门的"枚举到 0 个候选源文件"无法判定保护(exit 2)——
    // 补一枚无害的基础面文件垫底(无写链无发送,B6 也不进面)。
    writeRepo(dir, {
      files: { [B6_SVC_REL]: B6_SVC_SRC, 'apps/api/src/db/keep-g815954.ts': 'export const keep = 1\n' },
    })
    // B6 专属面 = SCAN_DIRS ∪ services ∪ plugins:session-store 一族住在 services,枚举必须够得着。
    const head = parse(run(dir, ['--root', dir, '--strict', '--json']))
    if (head.code !== 0)
      throw new Error(`services 存量 head+strict 不判红,实得 exit ${head.code}:${head.out.slice(0, 240)}`)
    if (head.j.counts.b6Violations !== 1 || head.j.b6Violations?.[0]?.file !== B6_SVC_REL)
      throw new Error(`B6 专属面(services)必须枚举得到该文件,实得 ${JSON.stringify(head.j.b6Violations)}`)
    // 持平:索引只追加一行注释 ⇒ B6 计数与锚点持平 ⇒ 不拦(防恒红门)。
    put(dir, B6_SVC_REL, `${B6_SVC_SRC}// touched\n`)
    gitIn(dir, ['add', B6_SVC_REL])
    const flat = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (flat.code !== 0)
      throw new Error(`与锚点持平时不得判红,实得 exit ${flat.code}:${flat.out.slice(0, 240)}`)
    // 同文件换一列再覆盖 ⇒ 2 > 锚点 1 ⇒ 净新增红。
    put(dir, B6_SVC_REL, B6_SVC_TWO_SRC)
    gitIn(dir, ['add', B6_SVC_REL])
    const more = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (more.code !== 1)
      throw new Error(`换列再覆盖必须 exit 1,实得 ${more.code}:${more.out.slice(0, 240)}`)
    const r = (more.j.ratcheted || []).find((e) => e.kind === 'b6')
    if (!r || r.file !== B6_SVC_REL || r.anchor !== 1 || r.now !== 2 || r.added !== 1)
      throw new Error(`锚点必须是该文件 HEAD 自身 B6 计数(1),现读 2:${JSON.stringify(r)}`)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
