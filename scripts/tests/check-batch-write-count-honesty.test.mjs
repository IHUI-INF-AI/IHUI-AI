// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-batch-write-count-honesty.mjs(§22c 模式 —— 需要判据时 import 源脚本
 * 导出的实现,**不在这里复制第二份**;判据失效的表现永远是安静,所以这里只打三类东西:
 *
 *  1. **可注入性**:脚本必须能按 `--root` 换仓取证 —— 否则"审夹具"的测试会静默变成"审真仓"
 *     (守门 70 的 14 例镜像测试因门只认 cwd 而全部失效,正是这一型);
 *  2. **CLI 契约**:`--json` 必须可 `JSON.parse`;`--staged --worktree` 必须 exit 2;
 *     没有提交 / 覆盖面内枚举到 0 个文件必须判死而不是记绿;
 *  3. **反向锁(源码级)**:不得回到 `process.cwd()` 定根、不得回到"内容按磁盘读"、
 *     默认档不得变成 worktree。这类失效只有源码锁能防 —— 行为断言会跟着实现一起漂绿。
 *
 * 判据本体的正反成对用例住在 `--self-test`(现测例数与分档一律以该命令末行为准,不在这里钉数字 ——
 * 钉死了它下次收紧就变成假账),这里刻意不重跑一遍:重跑就是把测试变成实现的复读机。
 * 本轮为两份"惯例存量"计数(booleanAck / readQueryCount)补的是 **M10–M13**:CLI 契约、真仓阳性对照、
 * 以及三条源码级反向锁(计数不得进 decide / 结论行不得少掉它 / 两个计数器不得各写一遍 send 扫描)。
 * 2026-09-27 为 B1(假删除 ack 判据)补的是 **M14–M16**:CLI 端到端的"存量不红 / 改回字面量必红 /
 * 四数不受顶动",跨文件锁"新豁免族 delete-ack-exempt 必须进守门 108 的存活期表",以及源码锁
 * "B1 的豁免判法与落点取材不得另起第二份实现"。
 * 同日第二十九批(布尔档键族从单一眼 `deleted` 扩到五键)补的是 **M21–M22**:临时 git 仓端到 CLI 的
 * "新键写回字面量必红并点名该族 / 补回归零"变异对照,与三条源码级反向锁(键族只有一份真相、
 * 写动词筛选只许用在 B2 那一侧、decide 仍看不见任何一族键名)。
 * ⚠️ **M11 那把独立尺子随判据同批扩面** —— 它上一版只量 `deleted` 一族。今天 `17 ≤ 21` 侥幸还成立,
 * 但第二十六批正在把 `deleted` 那一族往下清:清到 0 的那天,"合计 ≤ deleted 字面量数"与
 * "字面量为 0 ⇒ V1 必为 0"两条都会把**还活着的新四族**当成混计判红 —— 那就是与任何提交都无关的
 * 恒红锁,而恒红锁的结局和被删一样(§12e)。现改成**逐键各量各的上界**,比原来的单个合计上界更严、
 * 不是更松;并把"按键表五键恒在位、且之和等于合计"补成硬条件(否则"少一族"与"那一族是 0"同形)。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GATE_REL = 'check-batch-write-count-honesty.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const GIT = resolveGitBin() || 'git'
const SRC = readFileSync(join(SCRIPTS_DIR, GATE_REL), 'utf8')

/** 真事故形状(逐字取自 `_shared.ts` 修复前的那一处):链上没有 returning、计数取请求侧长度 */
const BAD = [
  "import { inArray } from 'drizzle-orm'",
  'server.delete(basePath, async (request, reply) => {',
  '  const idList = parsed.data.ids.split(",")',
  '  await db.delete(table).where(inArray(table.id, idList))',
  '  return reply.send(success({ deleted: idList.length }))',
  '})',
  '',
].join('\n')
/** 修好之后的形状:走唯一出口 + 链上 .returning( */
const GOOD = [
  "import { inArray } from 'drizzle-orm'",
  "import { batchWriteOutcome } from '../utils/batch-outcome.js'",
  'server.delete(basePath, async (request, reply) => {',
  '  const rows = await db.delete(table).where(inArray(table.id, idList)).returning({ id: table.id })',
  '  const o = batchWriteOutcome(idList, rows.map((r) => r.id))',
  '  return reply.send(success({ affected: o.affected, missedIds: o.missedIds }))',
  '})',
  '',
].join('\n')
const REL = 'apps/api/src/routes/x.ts'

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

/**
 * 把门连同**相对 import 闭包**装进夹具仓(门按自身位置推 ROOT,不装它就在审真仓)。
 * 闭包清单由 scratch-module-closure 推导,不手抄 —— 该模块头注记过:手抄必然晚一拍。
 */
function writeRepo(dir, { commit = true, body = BAD } = {}) {
  gitIn(dir, ['init', '-q'])
  gitIn(dir, ['config', 'user.email', 'gate@fixture.local'])
  gitIn(dir, ['config', 'user.name', 'gate-fixture'])
  gitIn(dir, ['config', 'commit.gpgsign', 'false'])
  put(dir, REL, body)
  put(dir, 'apps/api/db-neighbor.ts', 'export const q = 1\n')
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
  ])
  if (commit) {
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'fixture'])
  }
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

const json = (r) => {
  if (r.code !== 0) throw new Error(`期望 exit 0,实得 ${r.code}:${r.out}`)
  try {
    return JSON.parse(r.out)
  } catch {
    throw new Error(`--json 输出不可 parse:${r.out.slice(0, 200)}`)
  }
}

/** 与 json() 的分工:这一个**不管退出码** —— 判红那一支的正解就是非零,不能让辅助函数先炸。 */
function parse(r) {
  try {
    return { code: r.code, j: JSON.parse(r.out) }
  } catch {
    throw new Error(`--json 输出不可 parse(exit ${r.code}):${r.out.slice(0, 240)}`)
  }
}

test('M1 --root 换仓取证:夹具仓的存量被点名,且 --json 可 parse', () => {
  const dir = mkScratch('bch-root-')
  try {
    writeRepo(dir)
    const j = json(run(dir, ['--root', dir, '--json']))
    if (j.face !== 'head') throw new Error(`默认档必须是 HEAD,实得 ${j.face}`)
    if (j.counts.violations !== 1)
      throw new Error(`夹具 HEAD 必须点名 1 处,实得 ${j.counts.violations}`)
    if (!j.violations.some((v) => v.file === REL && v.key === 'deleted'))
      throw new Error(`必须点名文件与键:${JSON.stringify(j.violations)}`)
    if (j.counts.files !== 1 || j.counts.enumerated !== 1)
      throw new Error(
        `覆盖面应只有 1 个文件(routes/db 两面前缀外的那份不得入面),实得 ${j.counts.files}/${j.counts.enumerated}`,
      )
  } finally {
    rmScratch(dir)
  }
})

test('M2 三面互异:默认判 HEAD、--staged 判索引、--worktree 判磁盘(同一棵临时仓三答)', () => {
  const dir = mkScratch('bch-face-')
  try {
    writeRepo(dir, { body: GOOD })
    // HEAD 干净;索引改成脏版本;磁盘再改成第三份(布尔确认 ⇒ 既不是脏也不是干净)
    put(dir, REL, BAD)
    gitIn(dir, ['add', REL])
    put(
      dir,
      REL,
      'server.delete(async (req, reply) => {\n  return reply.send(success({ deleted: true }))\n})\n',
    )
    const h = parse(run(dir, ['--root', dir, '--json']))
    const s = parse(run(dir, ['--root', dir, '--staged', '--json']))
    const w = parse(run(dir, ['--root', dir, '--worktree', '--json']))
    if (h.j.face !== 'head' || h.j.counts.violations !== 0)
      throw new Error(`HEAD 面是修好的那份 ⇒ 应 0,实得 ${h.j.counts.violations}`)
    if (s.j.counts.violations !== 1)
      throw new Error(`--staged 必须判索引里那份脏的 ⇒ 应 1,实得 ${s.j.counts.violations}`)
    // 索引那份相对 HEAD 是**净新增**(HEAD 已修好)⇒ 差值棘轮必须红:这正是本门要拦的那一次提交
    if (s.code !== 1 || !s.j.ratcheted?.length)
      throw new Error(
        `净新增必须 exit 1 并给出锚点,实得 exit ${s.code}:${JSON.stringify(s.j.ratcheted)}`,
      )
    if (w.j.counts.candidates !== 0 || w.j.counts.violations !== 0)
      throw new Error(`磁盘面是第三份(布尔确认)⇒ 双 0,实得 ${JSON.stringify(w.j.counts)}`)
  } finally {
    rmScratch(dir)
  }
})

test('M2b 差值棘轮:存量与索引持平时不拦,加回来才判红(防恒红门)', () => {
  const dir = mkScratch('bch-ratchet-')
  try {
    writeRepo(dir)
    const same = json(run(dir, ['--root', dir, '--staged', '--json']))
    if (same.counts.violations !== 1)
      throw new Error(`索引==HEAD 应有 1 处存量,实得 ${same.counts.violations}`)
    if (same.exit !== 0)
      throw new Error(`与改动无关的存量不得判红(唯一结局是逼人 --no-verify),实得 exit ${same.exit}`)
    // 再加一处**同键**同型自算 ⇒ 该文件×该判据×该键 = 2 > 锚点 1 ⇒ 必须红,且锚点必须是
    // 「该文件 HEAD 自身同一(判据,键)桶的计数」。
    // 2026-09-27 第二十九批:这里刻意用**同一个键** —— 锚点的粒度已下沉到 ack 键,换成另一族的键
    // (如 affected)就是"新键从 0 起算"的另一条红路径,那条由 self-test 的 BK1 专门钉。
    put(
      dir,
      REL,
      `${BAD}\nserver.put(async (request, reply) => {\n  await db.update(table).set({ a: 1 }).where(inArray(table.id, idList2))\n  return reply.send(success({ deleted: idList2.length }))\n})\n`,
    )
    gitIn(dir, ['add', REL])
    const moreR = run(dir, ['--root', dir, '--staged', '--json'])
    if (moreR.code !== 1)
      throw new Error(`索引 2 > HEAD 1 应判红,实得 exit ${moreR.code}:${moreR.out}`)
    const more = JSON.parse(moreR.out)
    if (!more.ratcheted?.length || more.ratcheted[0].anchor !== 1)
      throw new Error(`必须报出锚点 = 该文件 HEAD 自身同桶计数:${JSON.stringify(more.ratcheted)}`)
    if (more.ratcheted[0].key !== 'deleted')
      throw new Error(
        `红点必须点名是哪个 ack 键(锚点粒度到键之后,报告说不出键就复核不了):${JSON.stringify(more.ratcheted)}`,
      )
  } finally {
    rmScratch(dir)
  }
})

test('M3 两面旗同给 ⇒ exit 2 并喊无法判定(不得任选一面冒充判定)', () => {
  const dir = mkScratch('bch-flags-')
  try {
    writeRepo(dir)
    const r = run(dir, ['--root', dir, '--staged', '--worktree'])
    if (r.code !== 2) throw new Error(`期望 exit 2,实得 ${r.code}:${r.out}`)
    if (!/无法判定/.test(r.out)) throw new Error(`必须喊"无法判定"而不是静默挑一面:${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('M4 没有提交 ⇒ exit 2,不得记成没有违规', () => {
  const dir = mkScratch('bch-nocommit-')
  try {
    writeRepo(dir, { commit: false })
    const r = run(dir, ['--root', dir])
    if (r.code !== 2) throw new Error(`空仓上必须判死,实得 ${r.code}:${r.out}`)
    if (!/无法判定/.test(r.out)) throw new Error(`必须喊"无法判定":${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('M5 覆盖面内枚举到 0 个文件 ⇒ 判死而不是绿(空扫就是本门要防的那一型)', () => {
  const dir = mkScratch('bch-empty-')
  try {
    gitIn(dir, ['init', '-q'])
    gitIn(dir, ['config', 'user.email', 'g@f.local'])
    gitIn(dir, ['config', 'user.name', 'g'])
    gitIn(dir, ['config', 'commit.gpgsign', 'false'])
    put(dir, 'docs/readme.md', 'x\n')
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), ['lib/face-reader.mjs'])
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'empty'])
    const r = run(dir, ['--root', dir])
    if (r.code !== 2) throw new Error(`覆盖面为空必须判死,实得 ${r.code}:${r.out}`)
    if (!/0 个候选源文件/.test(r.out))
      throw new Error(`必须说清是"枚举到 0",而不是笼统失败:${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('M6 末行打印四个现测数,且未判定与通过是两句话', () => {
  const dir = mkScratch('bch-report-')
  try {
    writeRepo(dir)
    const r = run(dir, ['--root', dir])
    const m = /候选 (\d+) \/ 违规 (\d+) \/ 未判定 (\d+) \/ 豁免 (\d+)/.exec(r.out)
    if (!m) throw new Error(`末行必须打印候选/违规/未判定/豁免四个数:${r.out}`)
    if (m[1] !== '1' || m[2] !== '1')
      throw new Error(`四个数应对上夹具:实得 ${m.slice(1).join('/')}`)
    if (/✅ 通过/.test(r.out)) throw new Error(`有违规时不得同时打"✅ 通过":${r.out}`)
    // 造一份词法不闭合的文件 ⇒ 该文件必须被点名成未判定,而不是静默跳过
    put(dir, 'apps/api/src/routes/leak.ts', "const s = '未闭合\nexport const x = 1\n")
    gitIn(dir, ['add', 'apps/api/src/routes/leak.ts'])
    const r2 = run(dir, ['--root', dir, '--staged'])
    if (!/未判定不等于通过/.test(r2.out)) throw new Error(`未判定必须与通过分开说:${r2.out}`)
    if (r2.code !== 0) throw new Error(`未判定不得冒红(它不是违规),实得 ${r2.code}:${r2.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('M7 反向锁:定根与取材面不得回到旧写法(门 70 / 门 118 同型失效的源码级防线)', () => {
  if (/process\.cwd\(\)/.test(SRC))
    throw new Error('ROOT 必须由脚本自身位置推导;按 cwd 定根 ⇒ 夹具测试静默审真仓')
  if (!/from '\.\/lib\/face-reader\.mjs'/.test(SRC))
    throw new Error('未引 face-reader ⇒ 等于自己派生 git 取内容')
  if (!/catBatch\(/.test(SRC)) throw new Error('未走层的读取入口 catBatch ⇒ 属门 118 说的半接线')
  if (/git show|execSync\(/.test(SRC)) throw new Error('不得自己拼 git show / execSync 取内容')
  if (!/def: 'head'/.test(SRC))
    throw new Error('默认档必须是 head(改成磁盘就是恒红与假绿来回跳那一型)')
  if (/readFileSync\([^)]*(?:REL|SCAN_DIRS)/.test(SRC))
    throw new Error('判据不得按磁盘读被审文件(共享工作树常年滞后 HEAD)')
})

test('M8 判据只此一份实现:__test__ 必须把核心函数交出去,测试不得另抄', () => {
  const self = readFileSync(join(HERE, 'check-batch-write-count-honesty.test.mjs'), 'utf8')
  if (/function\s+findWriteChains/.test(self) || /function\s+scanFileText/.test(self))
    throw new Error('测试里不得再实现一份判据(§22c:两套真相必然漂移)')
  const i = SRC.indexOf('export const __test__')
  if (i < 0) throw new Error('源脚本必须 export __test__ —— 否则判据不可被直接复用,只能被复读')
  const block = SRC.slice(i)
  // findBooleanAckSends / B2 的一跳三件套也在这张清单里:出口被摘掉一个,测试就会拿 undefined 跑出一片绿。
  for (const k of [
    'maskText',
    'findWriteChains',
    'findCountSends',
    'findBooleanAckSends',
    'indexExportedFns',
    'planDelegatedAckSites',
    'finishDelegatedAckSite',
    'scanFileText',
    'decide',
    'analyze',
  ])
    if (!new RegExp(`[\\s,{]${k}\\s*[,}:]`).test(block))
      throw new Error(`__test__ 少了 ${k}(门被摘掉一个出口,测试就会拿 undefined 跑)`)
})

test('M10 --json 只新增不改动:四个判据数字段与既有形态逐字在位,新计数为非负整数', () => {
  const dir = mkScratch('bch-json-')
  try {
    // 夹具里同时放一份"只有布尔 ack"的文件 ⇒ 新旧字段必须同时有值,才谈得上"只新增"
    writeRepo(dir, {
      body: `${BAD}\nserver.delete(async (request, reply) => {\n  return reply.send(success({ id, deleted: true }))\n})\n`,
    })
    const j = json(run(dir, ['--root', dir, '--json']))
    for (const k of [
      'files',
      'enumerated',
      'candidates',
      'violations',
      'undetermined',
      'exempt',
      'bareExempt',
    ])
      if (!Number.isInteger(j.counts[k]))
        throw new Error(`既有 counts.${k} 形态变了(实得 ${JSON.stringify(j.counts[k])})`)
    for (const k of ['returning', 'db', 'outlet', 'marker'])
      if (!Number.isInteger(j.exempt[k])) throw new Error(`既有 exempt.${k} 形态变了`)
    for (const k of [
      'gate',
      'root',
      'face',
      'strict',
      'counts',
      'exempt',
      'violations',
      'undetermined',
      'ratcheted',
      'exit',
    ])
      if (!(k in j)) throw new Error(`顶层既有字段 ${k} 不见了 —— 追加只许往末尾加键`)
    for (const k of [
      'booleanAckSites',
      'booleanAckFiles',
      'readQueryCountSites',
      'readQueryCountFiles',
    ])
      if (!Number.isInteger(j.counts[k]) || j.counts[k] < 0)
        throw new Error(`新计数字段 ${k} 缺失或为负:${JSON.stringify(j.counts)}`)
    // 2026-09-27 追加的按键分组表:五键必须**恒在位**(缺键 = 报表与判据的键表分叉,静默少一族)。
    const byKey = j.counts.booleanAckByKey
    if (!byKey || typeof byKey !== 'object')
      throw new Error(`counts.booleanAckByKey 缺失:${JSON.stringify(byKey)}`)
    for (const k of ['deleted', 'removed', 'restored', 'revoked', 'cleared'])
      if (!Number.isInteger(byKey[k]) || byKey[k] < 0)
        throw new Error(`booleanAckByKey.${k} 缺失或为负(五键恒在位):${JSON.stringify(byKey)}`)
    if (byKey.deleted !== 1 || byKey.removed !== 0)
      throw new Error(
        `夹具只有一处 deleted 那一族(removed 应为 0),实得 ${JSON.stringify(byKey)} —— 既有 booleanAckSites 的语义随键族扩大,但**按键必须分得清是哪一族**`,
      )
    if (j.counts.booleanAckSites !== 1 || j.counts.booleanAckFiles !== 1)
      throw new Error(
        `夹具那份只有一处布尔 ack,实得 ${j.counts.booleanAckSites}/${j.counts.booleanAckFiles}`,
      )
    if (j.counts.candidates !== 1 || j.counts.violations !== 1)
      throw new Error(
        `惯例计数不得顶动判据数:夹具仍是候选 1 违规 1,实得 ${j.counts.candidates}/${j.counts.violations}`,
      )
  } finally {
    rmScratch(dir)
  }
})

test('M11 真仓 HEAD 阳性对照(两把互相独立的尺子,不只量下限)', () => {
  const r = run(resolve(SCRIPTS_DIR, '..'), ['--json'])
  if (r.code !== 0)
    throw new Error(
      `真仓默认档应当退出 0(全量档只报数),实得 ${r.code}:${String(r.out).slice(0, 200)}`,
    )
  const j = JSON.parse(r.out)
  /*
   * 结构计数之外必须有第二把**异形**尺子:只量下限的门,把判据放宽成一锅粥照样绿
   * (变异① 把布尔正则换成 /deleted/ 后,真仓读数从 237 涨到 282,而任何"≥ 某值"的断言都还在通过)。
   * 上界不是猜的,是可证的:每个被 V1 数到的落点都**必须含** `deleted : true` 这段文本,
   * 所以 结构计数 ≤ 同一覆盖面内该字面量的出现数。字面量计数用 `git grep -o` 独立取,
   * 不复用本门任何判据(否则就是让被判据自己给自己发合格证)。
   *
   * **这里刻意不放"≥150 处"那一类存量下限**(上一版就是那样烂掉的):2026-09-27 那批
   * "布尔删除 ack 改成库确认"的清理正在把这一族从 237 处往下减,门与判据一个字都没改,
   * 而断言先红了。把**存量数字**写进断言 = 把"修好了"这件事变成一条与任何提交都无关的红,
   * 唯一结局是逼人 `--no-verify` 连带废掉全部守门(§12e 同型)。
   * "尺子坏没坏"改由一条**控制测量**判:同一条管道去量一个与这一族无关、结构上不可能为零的
   * 语法面(`=>`)。控制读到 0 ⇒ 版式/覆盖面漂了,那才是取证失效;控制非零而字面量读到 0
   * ⇒ 这一族真被清干净了,于是 V1 也必须为 0(下面那两条零位对照)。
   * "判据对这一型真有眼"的正面证明不住在这里,住在 M10 与 self-test 的临时仓夹具(精确期望数),
   * 它们不随存量涨跌。
   */
  const grepFace = (pattern) => {
    let raw
    try {
      raw = execFileSync(
        GIT,
        [
          '-c',
          'safe.directory=*',
          'grep',
          '-o',
          '-E',
          pattern,
          'HEAD',
          '--',
          'apps/api/src/routes',
          'apps/api/src/db',
        ],
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 180_000,
          maxBuffer: 64 << 20,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
    } catch (e) {
      // `git grep` 在**零命中**时按设计 exit 1(这不是失败);其它退出码才是尺子自己坏了。
      if (e?.status === 1 && !String(e?.stdout ?? '').trim()) return 0
      throw new Error(
        `第二把尺子没能跑完(exit ${e?.status ?? '?'}):${String(e?.stderr ?? e?.message ?? '').slice(0, 200)}`,
      )
    }
    return (
      raw
        .split('\n')
        .filter(Boolean)
        // 注意版式:`git grep -o`(不带 -n)打的是 `HEAD:<path>:<匹配内容>`,**没有行号段** ——
        // 按 `:行号:` 去解会得到 0 条,而 0 在这把尺子上的表现是"取证失效",不是"存量掉了"。
        .map((l) => /^HEAD:(.+?):/.exec(l))
        .filter(Boolean)
        .map((m) => m[1])
        .filter((p) => !/(^|\/)(?:tests?|__tests__|e2e)\//.test(p))
        .reduce((a) => a + 1, 0)
    )
  }
  const probe = grepFace('=>')
  /*
   * 独立尺子必须与判据**同一次扩面**(2026-09-27 第二十九批)。上一版它只量 `deleted` 一族,
   * 而判据的键族扩到五键 —— 不改这把尺子,`booleanAckSites > ackLit` 会在**判据完全正确**的那天
   * 恒红(§12e 同型:恒红锁的结局和被删一样)。改法是"逐键各量各的",不是"把合计放大":
   * 每个键的上界由它自己的字面量数给出,比原来的单个合计上界**更严**,不是更松。
   */
  const ACK_FAMILY = ['deleted', 'removed', 'restored', 'revoked', 'cleared']
  const ackLitBy = {}
  for (const k of ACK_FAMILY) ackLitBy[k] = grepFace(`${k}[[:space:]]*:[[:space:]]*true`)
  const ackLit = ACK_FAMILY.reduce((a, k) => a + ackLitBy[k], 0)
  const countLit = grepFace('count[[:space:]]*:')
  console.log(
    `    · 现读:布尔 ack ${j.counts.booleanAckSites} 处 / ${j.counts.booleanAckFiles} 文件` +
      `(按键 ${ACK_FAMILY.map((k) => `${k}=${j.counts.booleanAckByKey?.[k] ?? '缺'}`).join(' ')});` +
      `读查询 count ${j.counts.readQueryCountSites} 处 / ${j.counts.readQueryCountFiles} 文件;` +
      `独立尺子:字面量 ${ackLit}(${ACK_FAMILY.map((k) => `${k}=${ackLitBy[k]}`).join(' ')})/` +
      ` count 键面 ${countLit} / 管道控制 => ${probe}`,
  )
  if (probe < 1)
    throw new Error(
      `控制测量(覆盖面内 =>)读到 0 ⇒ 第二把尺子的管道或版式漂了,本轮上界与零位对照全部作废`,
    )
  // 报表漏一族(缺键/为 undefined)在这一点上就地红 —— 静默少一族比数字错更难查。
  for (const k of ACK_FAMILY)
    if (!Number.isInteger(j.counts.booleanAckByKey?.[k]))
      throw new Error(
        `booleanAckByKey 缺 '${k}' 一族(实得 ${JSON.stringify(j.counts.booleanAckByKey)})⇒ 报表与判据的键表分叉`,
      )
  if (ACK_FAMILY.reduce((a, k) => a + j.counts.booleanAckByKey[k], 0) !== j.counts.booleanAckSites)
    throw new Error(
      `按键分组之和 ≠ 合计(${ACK_FAMILY.map((k) => j.counts.booleanAckByKey[k]).join('+')} vs ${j.counts.booleanAckSites})⇒ 有两族被并成一族计数`,
    )
  if (j.counts.booleanAckSites > ackLit)
    throw new Error(
      `布尔 ack ${j.counts.booleanAckSites} > 覆盖面内字面量 ${ackLit} ⇒ 判据被放宽到"含键名就算"那一型(混计)`,
    )
  for (const k of ACK_FAMILY)
    if (j.counts.booleanAckByKey[k] > ackLitBy[k])
      throw new Error(
        `'${k}' 一族报 ${j.counts.booleanAckByKey[k]} > 独立字面量 ${ackLitBy[k]} ⇒ 该族的形态判据被放宽(逐键上界比合计更严,不得退回合计口径)`,
      )
  if (j.counts.readQueryCountSites > countLit)
    throw new Error(
      `读查询 count ${j.counts.readQueryCountSites} > 覆盖面内 count 键面 ${countLit} ⇒ V2 数到了"键逐字为 count"之外的形状`,
    )
  // 零位对照:字面量真被清干净了,V1/V2 必须跟着归零 —— 还报数就说明它数的是这一族之外的东西。
  for (const k of ACK_FAMILY)
    if (ackLitBy[k] === 0 && j.counts.booleanAckByKey[k] !== 0)
      throw new Error(
        `覆盖面内 '${k}' 字面量已为 0,而按键报表报 ${j.counts.booleanAckByKey[k]} ⇒ 两把尺子对不上账`,
      )
  if (ackLit === 0 && j.counts.booleanAckSites !== 0)
    throw new Error(
      `覆盖面内布尔 ack 字面量已为 0,而 V1 报 ${j.counts.booleanAckSites} ⇒ 两把尺子对不上账`,
    )
  if (countLit === 0 && j.counts.readQueryCountSites !== 0)
    throw new Error(
      `覆盖面内 count 键面已为 0,而 V2 报 ${j.counts.readQueryCountSites} ⇒ 两把尺子对不上账`,
    )
  // 两型必须各计各的:两个都非零却完全相同,才是"混计/一族是另一族的复制"的信号
  // (同为 0 是两处都清完了,不是复制 —— 上一版的等值判据在清零那天会自己判红)。
  if (j.counts.booleanAckSites > 0 && j.counts.booleanAckSites === j.counts.readQueryCountSites)
    throw new Error(
      `两型读数完全相同(${j.counts.booleanAckSites})⇒ 疑似混计或其中一族恒等于另一族的复制`,
    )
})

test('M12 真仓结论行必须点名两份惯例存量(不得被 ✅ 替它们说话)', () => {
  const r = run(resolve(SCRIPTS_DIR, '..'), [])
  if (r.code !== 0) throw new Error(`真仓默认档退出码应为 0,实得 ${r.code}`)
  if (!/布尔 ack 惯例\(不计红,仅现读计数\): \d+ 处 \/ \d+ 文件/.test(r.out))
    throw new Error(`结论行少了布尔 ack 的现读数:${String(r.out).split('\n').pop()}`)
  if (!/读查询 count 惯例\(不计红,仅现读计数\): \d+ 处 \/ \d+ 文件/.test(r.out))
    throw new Error('结论行少了读查询 count 的现读数')
  const line = r.out.split('\n').find((l) => l.includes('候选 ')) || ''
  if (!/候选 \d+ \/ 违规 \d+ \/ 未判定 \d+ \/ 豁免 \d+/.test(line))
    throw new Error(`既有四个判据数的形态被改动(只许追加):${line}`)
})

test('M13 反向锁:惯例计数不得进退出码、两个计数器不得各写一遍 send 扫描', () => {
  const body = /export function decide\([\s\S]*?\n\}/.exec(SRC)
  if (!body) throw new Error('decide 找不到 ⇒ 无法验证"惯例计数不进退出码"这条锁')
  if (/booleanAck|readQueryCount/.test(body[0]))
    throw new Error(
      'decide 里出现了惯例计数标识符 ⇒ 可见性数被接进了退出码,那就是把惯例当债问责(恒红门之始)',
    )
  const n = SRC.split('[Ss]uccess').length - 1
  if (n !== 1)
    throw new Error(
      `.send(<X>success({ 的扫描式出现 ${n} 次(应为 1)⇒ 违规判据与惯例计数各写一遍必然漂移(§22c)`,
    )
  if (!/for \(const \{ objOpen, objText \} of sendSuccessObjects\(code\)\)/.test(SRC))
    throw new Error('两个计数器不得绕过共用取材 sendSuccessObjects,自己再走一遍 code')
})

test('M9 接线成套性:未接线则放过;一旦接入提交链,必须 blocking + skipEnv 同时在位', () => {
  const runner = readFileSync(join(SCRIPTS_DIR, 'guardian-runner.mjs'), 'utf8')
  if (!runner.includes(GATE_REL)) return
  const block = new RegExp(
    `${GATE_REL.replace(/\./g, '\\.')}[\\s\\S]{0,900}?mode: 'blocking'`,
  ).test(runner)
  const skip = runner.includes('HUSKY_SKIP_BATCH_WRITE_COUNT_HONESTY')
  if (!block || !skip)
    throw new Error(
      `接线不完整: blocking=${block} skipEnv=${skip}(半接线比不接更危险:判据红时没人能正当脱身)`,
    )
})

/** B1 的两端形状:HEAD 存量假 ack(用户已拍板要改掉的旧语义)与"已改真"的迁移后形状。 */
const B1BAD = [
  'server.delete(basePath, async (request, reply) => {',
  '  await db.delete(table).where(eq(table.id, id))',
  '  return reply.send(success({ id, deleted: true }))',
  '})',
  '',
].join('\n')
const B1GOOD = [
  'server.delete(basePath, async (request, reply) => {',
  '  const rows = await db.delete(table).where(eq(table.id, id)).returning({ id: table.id })',
  '  return reply.send(success({ id, deleted: rows.length > 0 }))',
  '})',
  '',
].join('\n')

test('M14 B1 端到面:存量在 HEAD 默认只报数、--strict 问责;提交链把已改真的点写回字面量必红并点名 kind=b1', () => {
  // ① 存量形态:HEAD 含 1 处假 ack ⇒ 默认档 exit 0(存量不判红 = 防恒红门),--strict exit 1(它是判据)。
  const d1 = mkScratch('bch-b1debt-')
  try {
    writeRepo(d1, { body: B1BAD })
    const def = parse(run(d1, ['--root', d1, '--json']))
    if (def.code !== 0)
      throw new Error(
        `HEAD 有 B1 存量时默认档必须 0(恒红门唯一结局是逼人 --no-verify),实得 ${def.code}`,
      )
    if (def.j.counts.b1Violations !== 1)
      throw new Error(`夹具那份必须被 B1 现读到 1 处,实得 ${def.j.counts.b1Violations}`)
    for (const k of ['candidates', 'violations', 'undetermined', 'exempt'])
      if (def.j.counts[k] !== 0)
        throw new Error(
          `B1 不得顶动既有四数的 ${k}(应 0,实得 ${def.j.counts[k]})—— 两判据各计各的账`,
        )
    const strict = run(d1, ['--root', d1, '--strict', '--json'])
    if (strict.code !== 1)
      throw new Error(
        `--strict 下 B1 存量必须判红(它是判据不是惯例数,与 X1 对惯例计数的要求相反),实得 ${strict.code}`,
      )
  } finally {
    rmScratch(d1)
  }
  // ② 回退形态:HEAD 是"已改真"的那份,索引把它写回 deleted: true ⇒ 差值棘轮(锚点=b1 自己的 0)必红。
  const d2 = mkScratch('bch-b1reg-')
  try {
    writeRepo(d2, { body: B1GOOD })
    put(d2, REL, B1BAD)
    gitIn(d2, ['add', REL])
    const r = parse(run(d2, ['--root', d2, '--staged', '--json']))
    if (r.code !== 1)
      throw new Error(
        `把已改真的点改回字面量 true 必须 exit 1(用户拍板改真实语义后这是净新增),实得 ${r.code}`,
      )
    const b1 = (r.j.ratcheted || []).filter((x) => x.kind === 'b1')
    if (b1.length !== 1 || b1[0].anchor !== 0 || b1[0].now !== 1)
      throw new Error(`必须恰有一条 kind=b1、锚点 0、现值 1:${JSON.stringify(r.j.ratcheted)}`)
    const rep = run(d2, ['--root', d2, '--staged'])
    if (!/B1假ack/.test(rep.out))
      throw new Error(`判红块必须按 kind 点名 B1(不得只说"计数自算"):${rep.out}`)
  } finally {
    rmScratch(d2)
  }
})

test('M15 跨文件锁:B1 的豁免族必须登记进守门 108 的 FAMILY_LIFETIME_DAYS(30 天,待偿迁移债)', () => {
  const expiry = readFileSync(join(SCRIPTS_DIR, 'check-exemption-expiry.mjs'), 'utf8')
  const m = /'delete-ack-exempt':\s*(\d+)/.exec(expiry)
  if (!m)
    throw new Error(
      'delete-ack-exempt 没进存活期表 ⇒ 它会走 90 天默认档:迁移债被登记成半永久豁免,正是"豁免只有出生没有死亡"那一型',
    )
  if (m[1] !== '30')
    throw new Error(
      `delete-ack-exempt 的存活期必须是 30 天(待偿迁移债,理由写在表旁注释),实得 ${m[1]}`,
    )
})

/**
 * B2 的镜像段(M17–M20)。三件事各自要证明的东西不同,不混在一条里:
 *  M17 真仓 HEAD 的**变异对照**(摘掉已入库委托腿的 .returning( 必红 / 还原必归零)——
 *      这条同时是"B2 不会在第二十六批产出的正确形态上报红"的证明;
 *  M18 CLI 契约:`--json` 只追加五个 b2* 键、既有键形态不变,结论行必须现读点名 B2;
 *  M19 源码级反向锁:B2 不得另写第二份豁免判法 / 第二份 ack 落点取材,被调正文不得按磁盘读,
 *      "needs 为空即早退"这一型(会把整批未判定静默吞成 0 条)不得回来;
 *  M20 解析表只认实测存在的形态:门里那条别名必须真声明在 apps/api/tsconfig.json 的 paths 里。
 * 夹具与判据一律从 `__test__` 取(§22c:测试里再抄一份 import 解析或导出索引,就成了第二套真相)。
 */
const T = (await import(`../${GATE_REL}`)).__test__
test('M17 真仓 HEAD 变异对照:摘掉委托腿的 .returning( 必被 B2 点名,还原必归零(正确形态不得判红)', () => {
  const root = resolve(SCRIPTS_DIR, '..')
  const CALLER = 'apps/api/src/routes/admin-agreements.ts'
  const CALLEE = 'apps/api/src/db/agreements-queries.ts'
  const FN = 'deleteAgreement'
  const texts = T.readCandidates(root, 'head', [CALLER, CALLEE])
  const calleeSrc = texts.get(CALLEE)
  const callerSrc = texts.get(CALLER)
  const judge = (idx) => {
    const r = T.scanFileText(CALLER, callerSrc, { knownPaths: new Set([CALLEE]), calleeIndex: idx })
    return {
      v: r.b2.violations.map((x) => `${x.file}:${x.line}→${x.callee?.name}`),
      c: r.b2.exempt.confirmed,
      r,
    }
  }
  // 被审面就是遮蔽后的代码面 ⇒ 变异也做在这一面上(整文件级 replace 会先撞见别的 .returning(,
  // 那等于改了另一个函数却让本条对照以为自己改了这一个 —— 对照就退化成恒绿)。
  const base = T.indexExportedFns(T.maskText(calleeSrc).text)
  const fn = base.byName.get(FN)
  if (!fn)
    throw new Error(`HEAD 的 ${CALLEE} 里没有函数形态导出 ${FN} ⇒ 夹具失去依据,先核对再改本条`)
  if (!/\.returning\s*\(/.test(fn.bodyText))
    throw new Error(
      `${CALLEE}#${FN} 的函数体里没有 .returning( ⇒ 它不再是"已入库的正确形态"样本,本条对照失效`,
    )
  // ① 现读的 HEAD:委托腿已带 .returning( ⇒ B2 必须判放过、违规 0。
  const asIs = judge(new Map([[CALLEE, base]]))
  if (asIs.v.length !== 0)
    throw new Error(
      `已入库的正确形态(被调腿回报 RETURNING)被判红 ⇒ 恒红门:${asIs.v.join(' ')}(B2 必须认第二十六批产出的写法)`,
    )
  if (asIs.c < 1)
    throw new Error(
      `HEAD 面上这一处应被记为"库确认放过",实得 ${asIs.c} ⇒ 判据没看见那条 .returning(,归零是假绿`,
    )
  // ② 变异:只摘掉**这一个函数**的 .returning(...)(真仓既有 `.returning()` 也有 `.returning({id})`)。
  const stripped = new Map(base.byName)
  stripped.set(FN, { bodyText: fn.bodyText.replace(/\.returning\s*\([^)]*\)/, '') })
  const after = judge(new Map([[CALLEE, { ...base, byName: stripped }]]))
  if (after.v.length !== 1)
    throw new Error(
      `摘掉 .returning( 后必须恰被点名 1 处,实得 ${after.v.length}(${after.v.join(' ')})`,
    )
  if (!after.v[0].includes('admin-agreements.ts') || !after.v[0].endsWith(`→${FN}`))
    throw new Error(`违规必须点名调用方与这一个委托函数,实得 ${after.v[0]}`)
  // ③ 还原 ⇒ 归零(证明②的红是那一次改动造成的,不是判据恒红)。
  if (judge(new Map([[CALLEE, base]])).v.length !== 0)
    throw new Error('还原后仍判红 ⇒ 判据与变异无关,是恒红')
})

test('M18 --json 只追加五个 b2* 键且既有键形态逐字不变;真仓结论行必须现读点名 B2', () => {
  const dir = mkScratch('b2-json-')
  try {
    // 两腿都要在面上:调用方走 REL(在 SCAN_DIRS 内),被调腿落在 apps/api/src/db 下
    // —— 只放调用方的话,那一跳会被判"解析不到",B2 的账就成了 0,而 0 与"没判"长得一样。
    writeRepo(dir, { body: BAD })
    put(dir, REL, `${BAD}\n${T.B2_FIXTURES.delegated}`)
    put(dir, 'apps/api/src/db/b2-queries.ts', T.B2_FIXTURES.calleeNoReturning)
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'b2-two-legs'])
    const j = json(run(dir, ['--root', dir, '--json']))
    for (const k of [
      'files',
      'enumerated',
      'candidates',
      'violations',
      'undetermined',
      'exempt',
      'bareExempt',
      'booleanAckSites',
      'b1Violations',
      'readQueryCountSites',
    ])
      if (!(k in j.counts)) throw new Error(`既有 counts.${k} 不见了 ⇒ 追加只许往末尾加键`)
    for (const k of ['b2Candidates', 'b2Violations', 'b2Files', 'b2Undetermined', 'b2Exempt'])
      if (!Number.isInteger(j.counts[k]) || j.counts[k] < 0)
        throw new Error(`counts.${k} 缺失或为负:${JSON.stringify(j.counts)}`)
    // B2 命中必须被数到,而计数判据那一处仍只由 BAD 贡献(两判据各计各的账)
    if (j.counts.b2Violations !== 1 || j.counts.violations !== 1)
      throw new Error(
        `b2Violations=${j.counts.b2Violations} violations=${j.counts.violations}(应 1/1)—— 只追加不顶动`,
      )
    const rep = run(dir, ['--root', dir])
    if (!/B2 委托假 ack\(判据:违规 1 处 \/ 1 文件/.test(rep.out))
      throw new Error(`结论行必须现读点名 B2:${rep.out}`)
  } finally {
    rmScratch(dir)
  }
  const real = run(resolve(SCRIPTS_DIR, '..'), [])
  if (
    !/B2 委托假 ack\(判据:违规 \d+ 处 \/ \d+ 文件,候选 \d+,放过 \d+ 只报数,那一跳解析不到不判 \d+\)/.test(
      real.out,
    )
  )
    throw new Error(`真仓结论行少了 B2 的五个现读数:${String(real.out).split('\n').pop()}`)
})

test('M19 反向锁:B2 不得另写豁免判法/ack 落点取材,被调正文不得按磁盘读,"needs 为空即早退"不得回来', () => {
  // ① 豁免:必须复用 readExemptMarker 且带 DELETE_ACK_EXEMPT_TOKEN(与 B1 同一份实现)。
  if (!/readExemptMarker\([^)]*DELETE_ACK_EXEMPT_TOKEN/.test(SRC))
    throw new Error('B2 没走共享的 readExemptMarker ⇒ 两条通道的宽严会各自漂移(镜像 M16 同族)')
  // ② ack 落点:B2 必须吃调用方传进来的那一份 ackSites,不得自己再调一次 findBooleanAckSends。
  const plan = /export function planDelegatedAckSites\([\s\S]*?\n\}/.exec(SRC)
  if (!plan) throw new Error('planDelegatedAckSites 找不到 ⇒ 无法验证这一族是否共用同一份 ack 取材')
  if (/findBooleanAckSends\(/.test(plan[0]))
    throw new Error('B2 自己又扫了一遍布尔 ack 落点 ⇒ 与 V1/B1 三处各扫一遍必漂移')
  if (!/for \(const b of ackSites\)/.test(plan[0]))
    throw new Error('planDelegatedAckSites 必须优先吃注入的 ackSites(单遍取材)')
  // ③ 被调正文只能走 face-reader;按磁盘读被调文件就是把"没判"写成"判过了"。
  if (!/readCalleeTexts\(root, face, \[\.\.\.needs\]\)/.test(SRC))
    throw new Error('B2 的被调正文没有按所判面取(必须 readCalleeTexts(root, face, …))')
  if (/readFileSync\([^)]*callee/i.test(SRC))
    throw new Error('被调文件不得按磁盘读:共享工作树常年滞后 HEAD,同一份代码会在恒红与假绿之间跳')
  // ④ 静默吞未判定那一型(B2 落地当天真实踩过:needs 为空就 return,整批"那一跳解析不到"被读成 0 条)。
  const bundle = /export function scanFaceBundle\([\s\S]*?\n\}/.exec(SRC)
  if (!bundle) throw new Error('scanFaceBundle 找不到 ⇒ 无法验证这一条早退锁')
  if (/if \(!needs\.size\) return per/.test(bundle[0]))
    throw new Error('scanFaceBundle 里 "needs 为空即早退" 回来了 ⇒ 未判定会被静默吞成 0 条')
  // ⑤ B2 的数不得被并进任何既有判据数:aggregateB2 只写 res.b2.*。
  const agg = /export function aggregateB2\([\s\S]*?\n\}/.exec(SRC)
  if (!agg) throw new Error('aggregateB2 找不到')
  if (/res\.(violations|candidates|undetermined|exempt|b1)\b/.test(agg[0]))
    throw new Error('aggregateB2 写了既有键 ⇒ B2 与别的判据互相顶账')
})

test('M20 解析表只认实测存在的形态:门里的别名必须真声明在 apps/api/tsconfig.json 的 paths 里', () => {
  const alias = /const ALIAS_AT = '([^']+)'/.exec(SRC)
  if (!alias) throw new Error('找不到 ALIAS_AT ⇒ 无法验证别名是不是臆造的')
  const ts = readFileSync(join(resolve(SCRIPTS_DIR, '..'), 'apps/api/tsconfig.json'), 'utf8')
  const pathsBlock = /"paths"\s*:\s*([{][\s\S]*?[}])/.exec(ts)
  if (!pathsBlock)
    throw new Error(
      'apps/api/tsconfig.json 里没有 paths 块 ⇒ 门的别名表失去依据(要么恢复声明,要么把别名从解析表里去掉)',
    )
  const keys = [...pathsBlock[1].matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1])
  // tsconfig 的键写的是 `@/*`(带通配星),门里那一条是前缀 `@/` —— 补回星再比,
  // 否则这条锁在**声明完全正确**时恒红,而恒红锁的结局和被删一样。
  const aliasKey = `${alias[1].replace(/\*+$/, '')}*`
  if (!keys.includes(aliasKey))
    throw new Error(
      `门解析了别名 '${alias[1]}'(对应 tsconfig 键 ${aliasKey}),但 paths 未声明它(实测声明:${keys.join(' / ')})⇒ 解析表在臆造形态`,
    )
  // 候选生成必须覆盖 .js→.ts 与目录 index 两条实测形态(仓内 import 全部带 .js 后缀)。
  const cands = T.moduleSpecCandidates('../db/x.js', 'apps/api/src/routes/r.ts')
  if (!cands.candidates?.includes('apps/api/src/db/x.ts'))
    throw new Error(`.js→.ts 的候选没生成:${JSON.stringify(cands)}`)
  if (!cands.candidates?.includes('apps/api/src/db/x/index.ts'))
    throw new Error(`目录 index 的候选没生成:${JSON.stringify(cands)}`)
  if (T.moduleSpecCandidates('@ihui/database', 'apps/api/src/routes/r.ts').outside !== true)
    throw new Error('workspace 包必须被判为"在 apps/api/src 之外",不得当本仓一跳解析')
})

test('M16 反向锁:B1 的豁免判法与 ack 落点取材不得各写第二份实现', () => {
  // ① 豁免通道必须复用 readExemptMarker(只换 token),而不是自己再解一次"须带原因/须在注释里";
  //    ② ack 落点必须来自 findBooleanAckSends(或其入参注入),BOOL_ACK_RE 的 .exec 全源只许一次。
  if (!/readExemptMarker\([^)]*DELETE_ACK_EXEMPT_TOKEN/.test(SRC))
    throw new Error(
      'B1 没有走共享的 readExemptMarker(换 token 不换实现)⇒ 两条豁免通道的宽严会各自漂移',
    )
  const execs = SRC.match(/BOOL_ACK_RE\.exec/g) || []
  if (execs.length !== 1)
    throw new Error(`布尔 ack 的形态正则被执行 ${execs.length} 次(应为 1)⇒ V1 与 B1 各扫一遍必漂移`)
  if (!/for \(const b of ackSites \|\| findBooleanAckSends\(code\)\)/.test(SRC))
    throw new Error('findBoolAckB1Sites 必须优先吃调用方传入的落点清单(scanFileText 只扫一遍)')
})

/**
 * 2026-09-27 第二十九批(键族扩面)补的两例。要各自证明的东西不同,不混在一条里:
 *  M21 **临时 git 仓端到 CLI** 的变异对照:把一处"已按新键族诚实"的端点写回布尔字面量 ⇒ --staged
 *      必读红、必须点名 kind=b1、判红块必须现读出是 `removed` 那一族;补回 ⇒ 归零。
 *      这一例同时是"扩键族不是只扩报表"的装车证明 —— K 段那条构造面用例只能证明函数会给答案,
 *      "有人问它(而且是走差值棘轮而不是 --strict)"只能这样跑一遍。
 *  M22 源码级反向锁:键族只许一份真相(报表/正则都派生自 BOOL_ACK_KEYS,下游不得再抄硬编码名单)、
 *      动词筛选只许出现在 B2 那一侧(B1 若被筛,`deleted` 一族既有判据就被悄悄削弱)、
 *      decide 仍看不见任何一族键名(扩面不得把惯例计数接进退出码)。
 */
const REMOVED_HONEST = [
  'server.delete(basePath, async (request, reply) => {',
  '  await db.delete(table).where(eq(table.id, id))',
  '  return reply.send(success({ id, removed: rows.length > 0 }))',
  '})',
  '',
].join('\n')
const REMOVED_LIED = [
  'server.delete(basePath, async (request, reply) => {',
  '  await db.delete(table).where(eq(table.id, id))',
  '  return reply.send(success({ id, removed: true }))',
  '})',
  '',
].join('\n')

test('M21 端到面变异(新键族):把 removed 那一处诚实端点写回布尔字面量 ⇒ 差值棘轮必红并点名该族;补回归零', () => {
  const dir = mkScratch('bch-removed-')
  try {
    writeRepo(dir, { body: REMOVED_HONEST })
    // ① HEAD 就是诚实那份:新键族在 HEAD 面不得有违规(有就是恒红门,唯一结局是逼人 --no-verify)。
    const clean = parse(run(dir, ['--root', dir, '--json']))
    if (clean.code !== 0 || clean.j.counts.b1Violations !== 0)
      throw new Error(
        `诚实形状不得被 B1 判红(实得 exit ${clean.code} / b1Violations ${clean.j.counts.b1Violations})⇒ 门不认自己产出的形态`,
      )
    if (clean.j.counts.booleanAckByKey?.removed !== 0)
      throw new Error(
        `诚实形状连惯例面都不该数到(实得 ${JSON.stringify(clean.j.counts.booleanAckByKey)})`,
      )
    // ② 索引写回字面量 ⇒ 净新增 1 > 锚点 0,必须红,且红点必须说是哪一族。
    put(dir, REL, REMOVED_LIED)
    gitIn(dir, ['add', REL])
    const bad = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (bad.code !== 1) throw new Error(`写回布尔字面量必须 exit 1,实得 ${bad.code}:${bad.out}`)
    const hits = (bad.j.ratcheted || []).filter((x) => x.kind === 'b1')
    if (hits.length !== 1 || hits[0].anchor !== 0 || hits[0].now !== 1)
      throw new Error(`必须恰有一条 kind=b1、锚点 0、现值 1:${JSON.stringify(bad.j.ratcheted)}`)
    if (!bad.j.b1Violations?.[0] || bad.j.b1Violations[0].key !== 'removed')
      throw new Error(
        `违规落点必须带键名 removed(实得 ${JSON.stringify(bad.j.b1Violations)})⇒ 扩了键族却说不清红在哪一族,等于没扩`,
      )
    const rep = run(dir, ['--root', dir, '--staged'])
    if (!/removed/.test(rep.out) || !/\[B1假ack\]/.test(rep.out))
      throw new Error(`判红报告必须现读出族名与 kind:${rep.out}`)
    // ③ 补回 ⇒ 归零(证明②的红是那一次改动造成的,不是判据恒红)。
    put(dir, REL, REMOVED_HONEST)
    gitIn(dir, ['add', REL])
    const back = run(dir, ['--root', dir, '--staged', '--json'])
    if (back.code !== 0)
      throw new Error(`补回诚实形状后必须归零,实得 exit ${back.code}:${back.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('M25 --files 名单的两格静默:空格分隔的第二项不得被丢,落覆盖面外的项必须报名(2026-10-01 立)', () => {
  // 立项读数:旧 CLI 只取 `--files` 后**一个** token,`--files a b` 里的 b 被静默丢掉;
  // 而名单里落在覆盖面(SCAN_DIRS)外的项也从不出现在任何一格里。两格的表现都不是报错,
  // 是"文件 1/581 ✅ 通过" —— 调用方以为两文件都在审,实际只审了第一个(甚至一个都没审到)。
  const dir = mkScratch('bch-files-')
  try {
    writeRepo(dir)
    const Y = 'apps/api/src/routes/y.ts'
    put(dir, Y, 'export const nothingHere = 1\n')
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'two-in-scope-files'])
    // ① 空格分隔的两个覆盖面内路径 ⇒ 两个都要被审(旧写法在此只审 1 个,是变异对照)。
    const two = parse(run(dir, ['--root', dir, '--worktree', '--files', REL, Y, '--json']))
    if (two.code === 2) throw new Error(`两项都落在覆盖面内却判成 exit 2:${two.out ?? ''}`)
    if (two.j.counts.files !== 2)
      throw new Error(
        `--files 空格分隔必须审满两项,实得 files=${two.j.counts.files}(旧写法只取第一个 token ⇒ 第二项被静默丢掉)`,
      )
    if (two.j.counts.requestedFiles !== 2 || two.j.counts.outsideScopeFiles !== 0)
      throw new Error(
        `名单可见性两键必须现读为 2/0,实得 ${two.j.counts.requestedFiles}/${two.j.counts.outsideScopeFiles}`,
      )
    // ② 名单里混一项覆盖面外的 ⇒ 能判的照判(不得 exit 2 挡路),但那一项必须**点名**报出。
    // 注意这一臂**不带 --json**:报名住在人读结论行里,JSON 档只有计数。
    const GHOST = 'apps/api/src/utils/ghost.ts'
    const mixed = run(dir, ['--root', dir, '--worktree', '--files', REL, GHOST])
    if (mixed.code === 2)
      throw new Error(`部分落空应当照判并报名,不得整跑 exit 2(实得 ${mixed.code}:${mixed.out})`)
    if (!mixed.out.includes('ghost.ts') || !/落在覆盖面外/.test(mixed.out))
      throw new Error(
        `结论行必须点名覆盖面外的名单项,实得:${String(mixed.out).split('\n').slice(-2).join(' | ')}`,
      )
    // ②b 同一跑的机读档:两个计数键必须现读为 2/1(报表与人名同源,不得一处有一处无)。
    const mixedJson = parse(
      run(dir, ['--root', dir, '--worktree', '--files', REL, GHOST, '--json']),
    )
    if (
      mixedJson.j.counts.requestedFiles !== 2 ||
      mixedJson.j.counts.outsideScopeFiles !== 1 ||
      !(mixedJson.j.counts.outsideScopePaths || []).includes(GHOST)
    )
      throw new Error(
        `--json 三键必须 2/1 且点名 ${GHOST},实得 ${JSON.stringify(mixedJson.j.counts)}`,
      )
    // ③ 全部落空 ⇒ 仍判死(这是既有语义,不得被②的放宽一起吃掉)。
    const allOut = run(dir, ['--root', dir, '--worktree', '--files', GHOST])
    if (allOut.code !== 2)
      throw new Error(`名单全落覆盖面外必须 exit 2,实得 ${allOut.code}:${allOut.out}`)
    if (!allOut.out.includes('ghost.ts'))
      throw new Error(`判死那一支也必须报出是哪一项(否则下一个人无从收窄名单):${allOut.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('M22 反向锁:键族只有一份真相、动词筛选只在 B2 那一侧、decide 仍看不见任何一族键名', () => {
  // ① 判据正则与按键分组的报表都必须派生自 BOOL_ACK_KEYS(下游再抄一份硬编码名单就是第二真相)。
  const uses = (SRC.match(/BOOL_ACK_KEYS/g) || []).length
  if (uses < 5)
    throw new Error(
      `BOOL_ACK_KEYS 只被引用 ${uses} 次 ⇒ 报表/正则里有人手抄了键名单,削短键表不会有人喊`,
    )
  if (!/new RegExp\(`\[\{,\][^`]*\$\{BOOL_ACK_KEYS\.join/.test(SRC))
    throw new Error(
      '布尔档的形态正则没有从 BOOL_ACK_KEYS 派生 ⇒ 键表与判据会各自漂移(换键即隐身那一型)',
    )
  if (!/booleanAckByKey:\s*Object\.fromEntries\(BOOL_ACK_KEYS\.map/.test(SRC))
    throw new Error('按键分组的报表没有从 BOOL_ACK_KEYS 派生 ⇒ 少一族会静默变成"那一族是 0"')
  // ② 聚合也必须走同一张表(否则新那一族的数根本进不了 counts)。
  if (!/for \(const k of BOOL_ACK_KEYS\) acc\[k\] \+=/.test(SRC))
    throw new Error('按键分组的全仓聚合没有遍历 BOOL_ACK_KEYS ⇒ 新那一族进不了账,报表与判据分叉')
  // ③ 动词筛选只许用在 B2 的被调体:B1 若也筛,"同体内 update 链 + deleted 档"就漏判(削弱既有键族)。
  const b1Body = /export function findBoolAckB1Sites\([\s\S]*?\n\}/.exec(SRC)
  if (!b1Body) throw new Error('findBoolAckB1Sites 找不到 ⇒ 无法验证 B1 是否被动词筛选削弱')
  if (/BOOL_ACK_KEY_VERBS/.test(b1Body[0]))
    throw new Error(
      'B1 用了 BOOL_ACK_KEY_VERBS ⇒ 对既有 deleted 一族是**放宽**(体内 update 链不再算罪证);动词筛选是给 B2 的被调体用的,不得搬过来',
    )
  const classify = /function classifyCalleeBody\([\s\S]*?\n\}/.exec(SRC)
  if (!classify || !/BOOL_ACK_KEY_VERBS\[/.test(classify[0]))
    throw new Error(
      'classifyCalleeBody 没有按 ack 键筛写动词 ⇒ 委托体做两件写事的诚实形状会被误判红',
    )
  // ④ decide 仍不得看见任何一族键名(扩面不得把惯例计数接进退出码)。
  const d = /export function decide\([\s\S]*?\n\}/.exec(SRC)
  if (!d) throw new Error('decide 找不到')
  if (/BOOL_ACK|booleanAckByKey|removed|revoked|cleared/.test(d[0]))
    throw new Error('decide 里出现了键族标识符 ⇒ 惯例面被接进了退出码,扩面当天就会变成恒红门(§12e)')
})

test('M23 反向锁(裸 SQL 写链这一维):SQL 动词表只许一份、RETURNING 判据不得另写第二份、两条判据必须真接上', () => {
  const BS = String.fromCharCode(92)
  // 判"某段源码只有一份实现"必须先剥注释 —— 说明性文字里也会带执行性字符(门 103/117 各记过一次:
  // 头注把模式原样写出来,按文本数次数就把"解释判据"当成了"第二份判据")。
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const fnOf = (name) => {
    // 名字用拼接得到,否则本文件里出现的 `function <name>` 字面量会被 M8 的"测试不得复读判据"锁当成第二份实现。
    const head = 'export ' + 'function ' + name
    const i = CODE.indexOf(head)
    if (i < 0) return null
    const next = CODE.indexOf('\nexport function', i + head.length)
    return CODE.slice(i, next < 0 ? CODE.length : next)
  }
  // ① 写动词表只住在 findRawSqlWriteChains 里。
  const verbNeedle = 'DELETE' + BS + 's+FROM'
  const holders = CODE.split(/\n(?=export function |function )/).filter((f) => f.includes(verbNeedle))
  if (holders.length !== 1 || !holders[0].includes('findRawSqlWriteChains'))
    throw new Error(
      `裸 SQL 动词表落在 ${holders.length} 个函数里(应为 1 且是 findRawSqlWriteChains)⇒ 两份 SQL 解析必然漂移,` +
        '一处改了另一处不跟着改,判据与"放过证据"就会说不同的话',
    )
  // ② hasRawSqlReturning 必须是**投影**,不得留自己的 RETURNING 扫描。
  const proj = fnOf('hasRawSqlReturning')
  if (!proj) throw new Error('hasRawSqlReturning 找不到 ⇒ 无法验证它是否仍为投影')
  if (!proj.includes('findRawSqlWriteChains('))
    throw new Error('hasRawSqlReturning 不再走 findRawSqlWriteChains ⇒ 第二套 SQL 取材回来了')
  if (proj.includes(BS + 'bRETURNING' + BS + 'b'))
    throw new Error('hasRawSqlReturning 里自己扫 RETURNING ⇒ RETURNING 判据有两份实现(本枚票的立论之一)')
  // ③ 这一维必须**真接进两条判据**:B1 的候选与 V 的批量链池都要吃到 rawPool.chains。
  //    函数在、自检过、但没人调用 = 提交链上一路绿灯(守门 70/76/81 同型,门 102 的 GA5/GA6 同锁)。
  const b1 = fnOf('findBoolAckB1Sites')
  if (!b1 || !b1.includes('findRawSqlWriteChains'))
    throw new Error('B1 没接裸 SQL 写链 ⇒ "原生 SQL 发写 + 回布尔 true + 无 RETURNING"那一格重新失明')
  if (!/!c\.hasReturning/.test(b1))
    throw new Error(
      'B1 的裸 SQL 那一支没有要求"该条 SQL 缺 RETURNING" ⇒ 会把已带库答复的形状判红(恒红门同罪)',
    )
  const scan = fnOf('scanFileText')
  if (!scan || !scan.includes('[...findWriteChains(code), ...rawPool.chains]'))
    throw new Error('V(自算计数)的批量链池没并进裸 SQL 写链 ⇒ 计数判据对这一维仍瞎')
  if (!scan.includes('boolSites, nonBlank, rawPool)'))
    throw new Error('scanFileText 没把 rawPool 传给 findBoolAckB1Sites ⇒ 每次 ack 重扫一遍(第二套取材)')
  // ④ 配平不到必须落"未判定",且只有同体带 ack 时才参与退出码(否则无关文件会造恒红门)。
  if (!scan || !scan.includes('res.rawSqlUnparsed = []') || !/if \(ackHere\)/.test(scan))
    throw new Error(
      'rawSqlUnparsed 的"未判定/只报数"分流不在位 ⇒ 要么静默放过解析不到的写,要么把与本次提交无关的文件钉红',
    )
  // ⑤ 镜像测试自己不得再抄一份动词表(§22c:测试只复读实现就是复读机)。
  const self = readFileSync(join(HERE, 'check-batch-write-count-honesty.test.mjs'), 'utf8')
  if (self.includes(verbNeedle))
    throw new Error('镜像测试里出现了第二份裸 SQL 动词表 ⇒ 判据与取证各说各话')
})

/**
 * M24(票 守门134 条件性扩面①,2026-09-28):B2 那一跳的**裸 SQL 维触发条件**可复跑测量。
 * 票面判据逐字:任一 ack 落点的最小函数体 await 了一个"体内含无 RETURNING 裸 SQL 写"的具名函数
 * ⇒ 必补 B2 裸 SQL 维;未达即判据不动。测量住在门本体 measureB2RawSqlTrigger(与判据共用同一份
 * findRawSqlWriteChains / findBooleanAckSends / parseImportBindings,这里不另写第二份)。
 * 三条各钉一件事:
 *   阳性对照(夹具仓:委托腿裸 SQL 写无 RETURNING ⇒ 恰命中 1 并点名两侧)—— 没有它,"真仓 0"
 *     与"测量瞎了读 0"同形(M11 那把控制尺的同族教训);
 *   阴性对照(同一腿补 RETURNING ⇒ 0)—— 库答复住在模板串里,不得当罪证;
 *   真仓 HEAD 现读 hits=0 ⇒ 触发条件未达。命中 >0 时本条**当场红并喊"必补"** —— 这是接线索
 *     (tripwire),不是恒红锁:它只在票面形状出现的那天红,而那天判据本来就必须接上。
 *     刻意不钉 hops/undetermined 的下限(第二十九批 M11 的教训:把存量数写进断言 = 清完债那天
 *     冒出与任何提交无关的红)。
 */
test('M24 票134 触发条件可复跑:B2 裸 SQL 维普查(阳性恰命中/RETURNING 腿不命中/真仓 HEAD 现读 0)', () => {
  const dir = mkScratch('b2-raw-trigger-')
  try {
    writeRepo(dir, { commit: false })
    put(dir, T.B2_CALLER, T.B2_FIXTURES.delegated)
    put(dir, T.B2_CALLEE, T.B2_FIXTURES.calleeRawNoReturning)
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'trigger-fixture'])
    const hit = T.measureB2RawSqlTrigger(dir, 'head')
    if (hit.hits.length !== 1)
      throw new Error(
        `阳性对照(被调腿裸 SQL 写、无 RETURNING)必须恰命中 1,实得 ${hit.hits.length}(hops=${hit.hops},判不出=${hit.undetermined.length})⇒ 测量对这一型失明,真仓量出的 0 不可信:${JSON.stringify(hit.hits)}`,
      )
    const h = hit.hits[0]
    if (h.caller !== T.B2_CALLER || h.callee !== T.B2_CALLEE || h.fn !== 'deleteThing')
      throw new Error(`命中必须点名调用方、被调文件与具名函数,实得 ${JSON.stringify(h)}`)
    // 阴性对照:同一条腿补 RETURNING ⇒ 库答复住在模板串里,不是触发。
    put(dir, T.B2_CALLEE, T.B2_FIXTURES.calleeRawReturning)
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'returning-leg'])
    const letgo = T.measureB2RawSqlTrigger(dir, 'head')
    if (letgo.hits.length !== 0)
      throw new Error(
        `带 RETURNING 的被调腿被判成触发:${JSON.stringify(letgo.hits)} ⇒ 测量把"证据在别处"当罪证,真仓读数会虚高`,
      )
  } finally {
    rmScratch(dir)
  }
  const real = T.measureB2RawSqlTrigger(resolve(SCRIPTS_DIR, '..'), 'head')
  console.log(
    `    · 真仓 HEAD 面触发条件普查:ack 一跳 ${real.hops} 条 / 命中 ${real.hits.length} / 判不出 ${real.undetermined.length}`,
  )
  if (real.hits.length !== 0)
    throw new Error(
      `票 守门134 触发条件已达(${real.hits.length} 处):\n` +
        real.hits
          .map((x) => `  · ${x.caller}:${x.line}〈${x.key}〉→ ${x.callee}#${x.fn} 裸写 ${x.bareWrites} 条`)
          .join('\n') +
        '\n⇒ B2 那一跳必须接裸 SQL 维:复用 findRawSqlWriteChains 一份实现,被调正文读 indexExportedFns 的 rawBodyText;不得再挂"零存量"。',
    )
})
/**
 * M25(B6 · jsonb 整列覆盖维度,G-815954)—— 门体早就把 B6 的判据函数与夹具族导出给测试面
 * (头注写着"测试里再抄一份 jsonb 键族或声明正则,就成了第二真相"),但镜像此前对该维度 **0 消费**:
 * 门自己 `--self-test` 里有五条正反例,而端到端这一层没人跑过 ⇒ "维度在位"与"维度仍被消费"是两件事。
 * 本条只做一件事:**调生产入口 `scanFileText`**,拿它返回的 `b6` 结果对答案;
 * 夹具文本一律取门导出的 `FIXTURES`,测试内不写列名清单、不写声明正则、不写 excluded 形态判断。
 */
test('M25 B6 jsonb 整列覆盖:镜像必须经生产入口消费该维度(摘线不得被读成已覆盖)', () => {
  if (typeof T.scanFileText !== 'function')
    throw new Error('门不再导出 scanFileText ⇒ 生产入口被摘线')
  if (typeof T.findJsonbUpsertSites !== 'function')
    throw new Error('门不再导出 findJsonbUpsertSites ⇒ B6 判据被摘线,本条对照失去依据')
  if (!Array.isArray(T.JSONB_UPSERT_SCAN_DIRS) || T.JSONB_UPSERT_SCAN_DIRS.length === 0)
    throw new Error('B6 专属面枚举为空 ⇒ 该维度结构上扫不到任何文件,绿灯无意义')
  const fix = (k) => {
    const f = T.FIXTURES?.[k]
    // 夹具形态由门决定(现读为**已拼好的字符串**,自检里的 `v(FIX.b6JsonbSet)` 直接吃它);
    // 这里两种都接,但绝不在测试里自己拼第二份夹具文本 —— 那才是第二真相。
    if (typeof f === 'string') return f
    if (Array.isArray(f)) return f.join('\n')
    throw new Error(
      `门的 FIXTURES 里没有 b6 夹具 ${k}(实得 ${typeof f})⇒ 本条失去依据,先核门再改本条`,
    )
  }
  const run = (k) => {
    const r = T.scanFileText('a.ts', fix(k), { knownPaths: new Set(['a.ts']) })
    if (!r || !r.b6 || !Array.isArray(r.b6.candidates) || !Array.isArray(r.b6.violations))
      throw new Error('scanFileText 的返回里没有 b6 这一键 ⇒ 该维度不再随主扫描产出')
    return [r.b6.candidates.length, r.b6.violations.length]
  }
  // [候选, 违规]：红腿必须真红、绿腿必须真绿 —— 只验"有结论"不验方向,等于没验。
  const arms = [
    ['b6ExcludedBare', [1, 1], '整块 excluded 覆盖 ⇒ 红(票面红腿)'],
    ['b6JsonbSet', [1, 0], 'jsonb_set 指定路径 ⇒ 放过'],
    ['b6NamedMerge', [1, 0], '具名成员合并 ⇒ 放过'],
    ['b6FullDeclared', [1, 0], '整列覆盖 + 逐列声明 ⇒ 放过(唯一放行通道)'],
    ['b6FullNoDecl', [1, 1], '整列覆盖而无声明 ⇒ 红'],
  ]
  for (const [k, want, why] of arms) {
    const got = run(k)
    if (got[0] !== want[0] || got[1] !== want[1])
      throw new Error(
        `B6 ${k}(${why}):期望 候选/违规 = ${want.join('/')},实得 ${got.join('/')} ⇒ 判据或取材已漂,先核门再改本条`,
      )
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
