// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * HEAD 面回捞件兜底清扫器(2026-10-30 立,治"计划任务文档跳跃")。
 *
 * 病型(硬证据枚 `7864cde002`,2026-10-30 17:12「chore(sync): 收敛 origin/main 到本地 main,手工解决…」):
 * 一次普通 `git merge` 的父1(本侧)= 40 枚未勾、父2(origin/main)= 338 枚、结果 = 342 枚 —— 本侧已对
 * 约 280 枚登记行行使过处置权(结清即删/违禁桶摘除),对侧带着旧台账整份回来。此后账面
 * 342→325→321:每席手动再结清一批,下一枚合并又带回来。这就是机主说的「跳跃」。
 *
 * 为什么全仓没有一件器物负责这一型(不是"没做",是**结构上打不到**):
 *  - `scrub-declared-removals.mjs` 的维一/维三都以「HEAD 面已无此行」为前提 ⇒ 服务的是"收编器带回盘上
 *    滞后副本"那一型;污染本身落在 HEAD 面上时,那道前提对每一枚候选恒假 ⇒ 零扣。
 *  - `union-converge.mjs` 的 `declaredDropCaps` 同样只管"本侧 0 份";带回的行来自对侧 ⇒ 不认。
 *  - `check-live-doc-merge-recall.mjs` 已接 `.husky/post-merge`,但**只警告不阻塞**、且默认只扫最近
 *    10 枚 merge ⇒ 看得见的那一格没有牙。
 *
 * 本器补的就是那一格:判据 import `lib/head-recall.mjs`(它 import `declaredRows()` 的「声明为删除」
 * 证据面 + `titleFpOf`,零复算,§0.6/§22c),把「HEAD 面无此行」那半条前提换成「HEAD 面有此行」。
 *
 * 落地唯一通道 = `live-doc-edit.mjs` 的**删除档**(`drop:true ∧ after:null`):CAS、三维守恒、回读、
 * 结清留痕(`form:'dropped'`)、门 71 自愈补跑、索引对齐全在那一台正牌器物里,本器不手写第二份。
 * 旁路落地不跑 post-commit ⇒ 推送腿必须自带(AGENTS §5b 回潮通道①:origin 还带着旧行就会被下一次
 * 合并再带回,所以"清完不推"等于没清)。
 *
 * 让路纪律(失效方向恒为「少摘」,绝不「多摘」):带活跃认领牌的行、同复合主键另有非候选行在册的
 * 行一律 held 不摘;台账或面取不到 ⇒ `state=undetermined`,一个字节不动也不记绿(§0.3)。
 *
 * 结论行:`SWEEP-RESULT state=clean|all-held|pending|stripped|refused|undetermined stripped=N held=M pending=P`
 *  六态各管一件事,不许互相冒充:`clean` 判过且零候选零让路 / `all-held` 有命中但全部让路(没摘)
 *  / `pending` dry-run 有候选(没摘) / `stripped` 已摘并回读证明 / `refused` 落地未成 / `undetermined` 没判成。
 *
 * 用法:
 *   node scripts/strip-head-recall-rows.mjs                 # dry-run,零写盘
 *   node scripts/strip-head-recall-rows.mjs --apply         # 摘除并落地 + 推送
 *   node scripts/strip-head-recall-rows.mjs --max-batch 200 --apply
 *   node scripts/strip-head-recall-rows.mjs --self-test
 *
 * 调度器:`scripts/git-guardian.mjs` 的巡检腿 `sweepHeadRecallRows()`(候选为 0 时零写零推)。
 * 头注刻意不写"已接 pre-commit / CI"字样(守门 89 R1/R2 判"声称已接而零命中")。
 */

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息(与 check-live-doc-merge-recall.mjs 同形) */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'
import { recallRowsOf } from './lib/head-recall.mjs'
import { compositeKeyOf } from './lib/plan-task-index.mjs'
import { declaredRows } from './scrub-declared-removals.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

export const PLAN_REL = 'PROJECT_PLAN.md'
export const SEAT = 'head-recall-sweep'
/** 结论态词表(唯一权威;⑬ 用它反查本模块源码,新增态必须先进这张表)。 */
export const SWEEP_STATES = 'clean|all-held|pending|stripped|refused|undetermined'
export const LAND_MSG =
  'fix(plan): HEAD面回捞件兜底清扫——摘除台账已声明删除却仍在HEAD面的登记行(普通git merge带旧台账侧绕开union判据,实测枚7864cde002 父1=40/父2=338/结果=342;判据lib/head-recall单源,留痕form:dropped)'
export const DEFAULT_MAX_BATCH = 400

/** 纯构造:候选 ⇒ `live-doc-edit` 删除档的 pairs(同文副本合并成一项带 all:true,重复 before 会被拒)。 */
export function dropPairsOf(rows) {
  const m = new Map()
  for (const r of Array.isArray(rows) ? rows : []) {
    const raw = r?.raw
    if (typeof raw !== 'string' || raw === '') continue
    m.set(raw, (m.get(raw) || 0) + 1)
  }
  return [...m.entries()].map(([before, n]) => ({
    before,
    after: null,
    drop: true,
    ...(n > 1 ? { all: true } : {}),
  }))
}

/** 摘除后的面文本(纯函数,供自检与落地后复核用;落地本体交给 live-doc-edit)。 */
export function removedTextOf(content, rows) {
  const drop = new Set((Array.isArray(rows) ? rows : []).map((r) => r.raw))
  return content
    .split('\n')
    .filter((l) => !drop.has(l))
    .join('\n')
}

/**
 * 判:取被审面 + 台账 ⇒ 回捞件。零写盘。
 * @returns {{state:string, stripped:number, held:number, pending:number, rows:Array, why?:string}}
 */
export function judge({ maxBatch = DEFAULT_MAX_BATCH, logger = console.log } = {}) {
  let text
  try {
    text = gitRaw(['show', `HEAD:${PLAN_REL}`], ROOT, { maxBuffer: 1 << 26 })
  } catch (e) {
    return {
      state: 'undetermined',
      stripped: 0,
      held: 0,
      pending: 0,
      rows: [],
      why: `HEAD 台账取不到:${oneLine(e)}`,
    }
  }
  let declared
  try {
    declared = declaredRows(ROOT)
  } catch (e) {
    return {
      state: 'undetermined',
      stripped: 0,
      held: 0,
      pending: 0,
      rows: [],
      why: `摘除台账取不到:${oneLine(e)}`,
    }
  }
  const found = recallRowsOf(text, declared)
  if (found.undetermined)
    return { state: 'undetermined', stripped: 0, held: 0, pending: 0, rows: [], why: found.why }
  if (found.rows.length === 0) {
    if (found.held.length > 0) {
      logger(`⏸ 命中 ${found.held.length} 枚但全部让路(带牌 / 同主键他行在册)⇒ 本轮一枚不摘`)
      return { state: 'all-held', stripped: 0, held: found.held.length, pending: 0, rows: [] }
    }
    logger('✅ HEAD 面干净:未勾登记行里没有「已被摘除台账声明删除」的回捞件,也无让路行')
    return { state: 'clean', stripped: 0, held: 0, pending: 0, rows: [] }
  }
  const rows = found.rows.slice(0, maxBatch)
  logger(
    `回捞件 ${found.rows.length} 枚(逐字维 ${rows.filter((r) => r.via === 'verbatim').length}/题面指纹维 ${rows.filter((r) => r.via === 'title').length}),让路 ${found.held.length} 枚${found.rows.length > rows.length ? `,本批封顶 ${rows.length}` : ''}`,
  )
  for (const r of rows.slice(0, 8)) logger(`   L${r.line} [${r.via}] ${r.raw.slice(0, 64)}`)
  if (rows.length > 8) logger(`   …另 ${rows.length - 8} 枚未逐条打印`)
  for (const h of found.held.slice(0, 5)) logger(`   ⏸ L${h.line} ${h.why}`)
  return {
    state: 'pending',
    stripped: 0,
    held: found.held.length,
    pending: rows.length,
    rows,
    face: text,
  }
}

function oneLine(e) {
  return String(e?.message ?? e ?? '')
    .split('\n')[0]
    .slice(0, 160)
}

export function sweep({ apply = false, maxBatch = DEFAULT_MAX_BATCH, logger = console.log } = {}) {
  const verdict = judge({ maxBatch, logger })
  if (verdict.state === 'undetermined') {
    logger(`⚠️ 未判定 —— ${verdict.why}`)
    console.log('SWEEP-RESULT state=undetermined stripped=0 held=0 pending=0')
    return verdict
  }
  if (verdict.state === 'clean' || verdict.state === 'all-held') {
    console.log(`SWEEP-RESULT state=${verdict.state} stripped=0 held=${verdict.held} pending=0`)
    return verdict
  }
  if (!apply) {
    logger('(dry-run:零写盘 —— 加 --apply 才摘)')
    console.log(
      `SWEEP-RESULT state=pending stripped=0 held=${verdict.held} pending=${verdict.pending}`,
    )
    return { ...verdict, state: 'pending' }
  }

  const pairs = dropPairsOf(verdict.rows)
  const tmpDir = join(ROOT, '.ihui-agent', 'tmp', 'head-recall-sweep')
  mkdirSync(tmpDir, { recursive: true })
  const manifest = join(tmpDir, `pairs-${Date.now()}.json`)
  writeFileSync(manifest, JSON.stringify(pairs, null, 2), 'utf8')

  const headBefore = safeHead()
  const land = spawnSync(process.execPath, [join(HERE, 'live-doc-edit.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15 * 60 * 1000,
    maxBuffer: 1 << 24,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      LIVE_DOC: PLAN_REL,
      LIVE_MSG: LAND_MSG,
      LIVE_SEAT: SEAT,
      LIVE_REPLACE_FILE: manifest,
    },
  })
  const landOut = `${land.stdout ?? ''}${land.stderr ?? ''}`
  const headAfter = safeHead()
  // 凭据 = HEAD 有没有被推进 + 面上那几枚是否真没了(不是落地器退出码,§1)
  let nowText = null
  try {
    nowText = gitRaw(['show', `HEAD:${PLAN_REL}`], ROOT, { maxBuffer: 1 << 26 })
  } catch {}
  const stillOnFace =
    nowText === null ? null : verdict.rows.filter((r) => nowText.split('\n').includes(r.raw)).length

  if (land.status !== 0 || !nowText || stillOnFace === null || stillOnFace > 0) {
    logger(
      `❌ 本轮未落地(land exit=${land.status},HEAD ${headBefore.slice(0, 11)}→${headAfter.slice(0, 11)},` +
        `面上仍有 ${stillOnFace ?? '取不到'} 枚)——不补写留痕,下轮重试`,
    )
    logger(
      landOut
        .split('\n')
        .filter((l) => l.trim())
        .slice(-6)
        .join('\n'),
    )
    console.log(
      `SWEEP-RESULT state=refused stripped=0 held=${verdict.held} pending=${verdict.pending}`,
    )
    return { ...verdict, state: 'refused' }
  }

  logger(
    `✅ 摘除 ${verdict.rows.length} 枚已落地(${headBefore.slice(0, 11)}→${headAfter.slice(0, 11)}),留痕由 live-doc-edit 的删除档逐条入账(form:dropped)`,
  )
  // 旁路落地不跑 post-commit ⇒ 推送腿自带(origin 还带旧行就会被下一次合并再带回)
  const push = spawnSync(process.execPath, [join(HERE, 'git-push-guard.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5 * 60 * 1000,
    maxBuffer: 1 << 24,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  logger(
    push.status === 0
      ? '✅ 推送腿已派发'
      : `⚠️ 推送腿 exit ${push.status}(不阻断,交给 converge;origin 未追平前本器下轮仍会判 pending)`,
  )
  console.log(
    `SWEEP-RESULT state=stripped stripped=${verdict.rows.length} held=${verdict.held} pending=0`,
  )
  return { ...verdict, state: 'stripped', stripped: verdict.rows.length }
}

function safeHead() {
  try {
    return gitRaw(['rev-parse', 'HEAD'], ROOT)
  } catch {
    return ''
  }
}

export function selfTest() {
  let fails = 0
  const ok = (cond, msg) => {
    if (cond) return
    fails++
    console.error(`✗ ${msg}`)
  }
  // 夹具:一枚在台账里被声明删除的未勾行 + 一枚真活行
  const R1 = '- [ ] G-901 已被摘除的回捞件'
  const R2 = '- [ ] G-902 真活,没被谁处置过'
  const R3 = '- [ ]（进行中@2026-10-30/在飞席） G-903 同样在台账里但席位在飞'
  const R4 = '- [ ] G-901 已被摘除的回捞件' // 同文第二份 ⇒ 合并成一项 all:true
  const declared = {
    filesSeen: 2,
    dropTitleFps: new Set(),
    dropTitleRows: new Map([['__fp__', [R1, R3]]]),
    set: new Set([R1, R3]),
  }
  const face = `# 计划\n${R2}\n${R1}\n${R4}\n${R3}\n`
  const found = recallRowsOf(face, declared)
  ok(found.undetermined === false, '① 夹具面可判(不应当未判定)')
  ok(found.rows.length === 2, `② 同文两副本都该进候选(实测 ${found.rows.length})`)
  ok(
    found.held.length === 1 && /活跃认领牌/.test(found.held[0].why),
    `③ 带牌行让路(实测 held=${found.held.length})`,
  )
  const pairs = dropPairsOf(found.rows)
  ok(
    pairs.length === 1 && pairs[0].all === true && pairs[0].drop === true,
    `④ pairs 合并同文副本: ${JSON.stringify(pairs)}`,
  )
  ok(removedTextOf(face, found.rows).split('\n').includes(R1) === false, '⑤ 摘除面确实少掉那两行')
  const noLedger = recallRowsOf(face, { filesSeen: 0 })
  ok(noLedger.undetermined === true, '⑥ 台账取不到 ⇒ 未判定(不记绿也不冒红)')
  const noFace = recallRowsOf('', declared)
  ok(noFace.undetermined === true, '⑦ 面取不到 ⇒ 未判定')
  const noCands = recallRowsOf(`# 计划\n${R2}\n`, declared)
  ok(
    noCands.rows.length === 0 && noCands.undetermined === false,
    '⑧ 无候选 ⇒ 判过且干净,不是未判定',
  )
  // ⑨ 全让路面(命中但唯一那枚带牌)⇒ 0 摘 + 1 held,不得读成"没命中"
  const heldOnly = recallRowsOf(`# 计划\n${R3}\n`, declared)
  ok(
    heldOnly.rows.length === 0 && heldOnly.held.length === 1,
    `⑨ 全让路面应 0 摘/1 held(实测 rows=${heldOnly.rows.length} held=${heldOnly.held.length})`,
  )
  // ⑩ 同复合主键另有非候选行在册 ⇒ 让路;主键不同形时不该让。
  //    两型都断言"结果与主键关系一致",不靠手写期望数(主键算法漂了这条会自己喊)。
  const R5 = `${R1}（同题他行仍在册）`
  const sameKey = compositeKeyOf(R1) === compositeKeyOf(R5)
  const guarded = recallRowsOf(`# 计划\n${R1}\n${R5}\n`, {
    ...declared,
    dropTitleRows: new Map([['__fp__', [R1]]]),
  })
  ok(
    sameKey
      ? guarded.rows.length === 0 && guarded.held.length === 1
      : guarded.rows.length === 1 && guarded.held.length === 0,
    `⑩ 同主键让路与主键关系必须同形(sameKey=${sameKey}, rows=${guarded.rows.length}, held=${guarded.held.length})`,
  )
  // ⑪ 两枚同题都被声明删除 ⇒ 互为候选,不触发"他行在册"的让路
  const bothDropped = recallRowsOf(`# 计划\n${R1}\n${R5}\n`, {
    ...declared,
    dropTitleRows: new Map([['__fp__', [R1, R5]]]),
  })
  ok(
    bothDropped.rows.length === 2,
    `⑪ 同题两枚都在台账 ⇒ 都进候选(实测 ${bothDropped.rows.length})`,
  )
  // ⑫ via 只有两型,状态词表不扩号(结论行要被 guardian 与 CI 读)
  ok(
    [...found.rows, ...guarded.rows].every((r) => r.via === 'title' || r.via === 'verbatim'),
    '⑫ via 取值只许 title/verbatim',
  )
  // ⑬ 结论态词表**双向锁**:源码里出现的每个 `state:'…'` 字面量都必须在词表里(防手滑造一个
  //    guardian/CI 读不到的态),且词表里每个态都必须有产出点(防"登记了却没人产出"的腐烂条目,§0.7)。
  //    拿常量表自证"包含自己"是假牙,所以这里量的是**源码字节**。
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const used = [...new Set([...src.matchAll(/state:\s*'([a-z-]+)'/g)].map((m) => m[1]))]
  ok(
    used.length >= 6,
    `⑬ 应至少量到 6 个状态字面量(实测 ${used.length} ⇒ 正则没咬住源码,本条自身失效)`,
  )
  for (const s of used)
    ok(SWEEP_STATES.includes(s), `⑬ 状态 "${s}" 不在结论词表里 ⇒ guardian/CI 读不到它`)
  for (const s of SWEEP_STATES.split('|'))
    ok(used.includes(s), `⑬ 词表里的 "${s}" 在源码里没有产出点 ⇒ 腐烂条目`)
  if (fails === 0) console.log(`自检:全部通过(13 组,状态 ${used.length} 个)`)
  else console.error(`自检:${fails} 失败`)
  return fails
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exitCode = selfTest() ? 1 : 0
  } else {
    try {
      const mi = argv.indexOf('--max-batch')
      const maxBatch = mi >= 0 ? Number(argv[mi + 1]) : DEFAULT_MAX_BATCH
      if (!Number.isInteger(maxBatch) || maxBatch <= 0) {
        console.error(`❌ --max-batch 要正整数(收到 ${argv[mi + 1]})`)
        process.exit(2)
      }
      const r = sweep({ apply: argv.includes('--apply'), maxBatch })
      process.exitCode = r.state === 'undetermined' || r.state === 'refused' ? 2 : 0
    } catch (e) {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    }
  }
}

export const __test__ = {
  judge,
  sweep,
  dropPairsOf,
  removedTextOf,
  selfTest,
  SEAT,
  PLAN_REL,
  LAND_MSG,
  SWEEP_STATES,
  DEFAULT_MAX_BATCH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
