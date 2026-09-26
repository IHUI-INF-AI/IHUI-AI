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
    // 再加一处同型自算 ⇒ 净新增 1 ⇒ 必须红,且锚点必须是该文件 HEAD 自身计数
    put(
      dir,
      REL,
      `${BAD}\nserver.put(async (request, reply) => {\n  await db.update(table).set({ a: 1 }).where(inArray(table.id, idList2))\n  return reply.send(success({ affected: idList2.length }))\n})\n`,
    )
    gitIn(dir, ['add', REL])
    const moreR = run(dir, ['--root', dir, '--staged', '--json'])
    if (moreR.code !== 1)
      throw new Error(`索引 2 > HEAD 1 应判红,实得 exit ${moreR.code}:${moreR.out}`)
    const more = JSON.parse(moreR.out)
    if (!more.ratcheted?.length || more.ratcheted[0].anchor !== 1)
      throw new Error(`必须报出锚点 = 该文件 HEAD 自身计数:${JSON.stringify(more.ratcheted)}`)
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
  // findBooleanAckSends 也在这张清单里:惯例计数的出口被摘掉一个,测试就会拿 undefined 跑出一片绿。
  for (const k of [
    'maskText',
    'findWriteChains',
    'findCountSends',
    'findBooleanAckSends',
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
   * 上界不是猜的,是可证的:每个被数到的落点都**必须含** `deleted : true` 这段文本,
   * 所以 结构计数 ≤ 同一覆盖面内该字面量的出现数。字面量计数用 `git grep -o` 独立取,
   * 不复用本门任何判据(否则就是让被判据自己给自己发合格证)。
   */
  const raw = execFileSync(
    GIT,
    [
      '-c',
      'safe.directory=*',
      'grep',
      '-o',
      '-E',
      'deleted[[:space:]]*:[[:space:]]*true',
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
  const literal = raw
    .split('\n')
    .filter(Boolean)
    // 注意版式:`git grep -o`(不带 -n)打的是 `HEAD:<path>:<匹配内容>`,**没有行号段** ——
    // 按 `:行号:` 去解会得到 0 条,而 0 在这把尺子上的表现是"取证失效",不是"存量掉了"。
    .map((l) => /^HEAD:(.+?):/.exec(l))
    .filter(Boolean)
    .map((m) => m[1])
    .filter((p) => !/(^|\/)(?:tests?|__tests__|e2e)\//.test(p)).length
  if (literal < 150)
    throw new Error(`第二把尺子自己只读到 ${literal} ⇒ 取证失效,不能拿它去证 237 那一侧`)
  console.log(
    `    · 现读:布尔 ack ${j.counts.booleanAckSites} 处 / ${j.counts.booleanAckFiles} 文件;读查询 count ${j.counts.readQueryCountSites} 处 / ${j.counts.readQueryCountFiles} 文件;字面量独立计数 ${literal}`,
  )
  if (j.counts.booleanAckSites < 150)
    throw new Error(
      `布尔 ack 现读只有 ${j.counts.booleanAckSites} 处 ⇒ 判据对这一型近乎失明,先查锚点与遮蔽面`,
    )
  if (j.counts.booleanAckSites > literal)
    throw new Error(
      `布尔 ack ${j.counts.booleanAckSites} > 覆盖面内字面量 ${literal} ⇒ 判据被放宽到"含 deleted 就算"那一型(混计)`,
    )
  if (j.counts.booleanAckFiles < 50)
    throw new Error(
      `布尔 ack 只落在 ${j.counts.booleanAckFiles} 个文件 ⇒ 与"全 API 惯例"的定性不符,先怀疑判据`,
    )
  if (j.counts.readQueryCountSites < 1)
    throw new Error(
      `读查询 count 族现读 ${j.counts.readQueryCountSites} 处:HEAD 面上这一族并非零,数到 0 就是判据空转`,
    )
  // 两型必须各计各的:一个都为零而另一个很大,通常是把两族并进了同一个数。
  if (j.counts.booleanAckSites === j.counts.readQueryCountSites)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
