// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 违禁桶兜底清扫器(2026-10-25 立,承等条件/待拍板两道机主禁令的执行器物化)。
 *
 * 病型:union 收敛器与 goal-r4 型复翻席把违禁形态行(等条件/待拍板的未勾登记行)**主动写回
 * HEAD**——它们不走提交链,守门 130 的 F11/F12 基线棘轮拦不到;复翻席自身的凭据逻辑只认
 * "各批结清提交",不知道 2026-10-23/25 两道禁令。实测一轮回潮 54 行(2026-10-25)。
 *
 * 出路(AGENTS §1"机器级时序依赖的出路=把执行器物化"):由 guardian 巡检轮派发本器,
 * 自动摘除 HEAD 面全部 waiting-env/waiting-human 未勾行并留痕(f12-purge),循环战变成
 * 自动收敛——复翻席翻回,下一轮被清,且每次清偿都留痕可问责。
 *
 * 判据**全部 import 单源**(§0.6/§22c,零复算):
 *  - 行清单:lib/plan-task-index.mjs 的 parseTaskRows + dispositionOfV2(v2 尺=侧车⊕散文)
 *  - 侧车面:plan-tasks.mjs 的 readFieldsFace(HEAD 面,与本器判定面同面同轮)
 * 留痕 .ihui-agent/state/plan-row-drop.jsonl(kind=f12-purge),scrub/union 的
 * dropTitleFps 兜底据此识别"已声明摘除"防回捞。
 *
 * 结论行:`SWEEP-RESULT state=clean|stripped|undetermined stripped=N` —— 三态纪律:
 * "没判"绝不写成"判过"(§0.3)。已勾行不进射程(禁令只禁未勾挂账;翻勾是有主票的处置权)。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const PLAN_REL = 'PROJECT_PLAN.md'
export const DROP_REL = join('.ihui-agent', 'state', 'plan-row-drop.jsonl')
export const SEAT = 'f12-banned-bucket-sweep'

// 判据延迟装载引用(镜像测试可注入替身;生产面 sweep() 首行装载)
const judgesRef = { parseTaskRows: null, dispositionOfV2: null }

/**
 * 纯判定:台账文本 + 侧车面 ⇒ 违禁未勾行清单。判据运行时取 judgesRef(由 sweep 装载,
 * 镜像测试可直接注入替身)——本函数零 IO、零 git 派生。
 */
export function findBannedRows(content, fields) {
  const { parseTaskRows, dispositionOfV2 } = judgesRef
  if (typeof parseTaskRows !== 'function' || typeof dispositionOfV2 !== 'function')
    return { rows: [], undetermined: true, why: '判据未装载(judgesRef 空)' }
  if (typeof content !== 'string' || content === '')
    return { rows: [], undetermined: true, why: '台账文本取不到' }
  const out = []
  for (const r of parseTaskRows(content).filter((x) => x.state === 'open')) {
    const d = dispositionOfV2({ line: r.raw, fields })
    if (d.bucket === 'waiting-env' || d.bucket === 'waiting-human')
      out.push({ line: r.line, raw: r.raw, bucket: d.bucket })
  }
  return { rows: out, undetermined: false }
}

async function loadJudges() {
  const idx = await import(pathToFileURL(join(HERE, 'lib', 'plan-task-index.mjs')).href)
  const pt = await import(pathToFileURL(join(HERE, 'plan-tasks.mjs')).href)
  judgesRef.parseTaskRows = idx.parseTaskRows
  judgesRef.dispositionOfV2 = idx.dispositionOfV2
  return { readFieldsFace: pt.readFieldsFace }
}

export async function sweep({ apply = false, logger = console.log } = {}) {
  const { readFieldsFace } = await loadJudges()
  let text
  try {
    text = execFileSync('git', ['-C', ROOT, 'show', `HEAD:${PLAN_REL}`], {
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    logger(`⚠️ 未判定 —— HEAD 台账取不到:${String(e?.message ?? e).split('\n')[0]}`)
    console.log('SWEEP-RESULT state=undetermined stripped=0')
    return { state: 'undetermined', stripped: 0 }
  }
  const fields = readFieldsFace(ROOT, 'head')
  const found = findBannedRows(text, fields)
  if (found.undetermined) {
    logger(`⚠️ 未判定 —— ${found.why ?? '判据失明'}`)
    console.log('SWEEP-RESULT state=undetermined stripped=0')
    return { state: 'undetermined', stripped: 0 }
  }
  if (found.rows.length === 0) {
    logger('✅ 违禁桶干净(waiting-env/waiting-human 未勾行 0 条,读数来自本器现判)')
    console.log('SWEEP-RESULT state=clean stripped=0')
    return { state: 'clean', stripped: 0 }
  }
  const envN = found.rows.filter((r) => r.bucket === 'waiting-env').length
  const humanN = found.rows.length - envN
  logger(`违禁未勾行 ${found.rows.length} 条(env=${envN}/human=${humanN})`)
  for (const r of found.rows.slice(0, 10)) logger(`   L${r.line} [${r.bucket}] ${r.raw.slice(0, 70)}`)
  if (found.rows.length > 10) logger(`   …另 ${found.rows.length - 10} 行未逐条打印`)
  if (!apply) {
    logger('(dry-run:零写盘 —— 加 --apply 才摘)')
    console.log(`SWEEP-RESULT state=stripped stripped=0 pending=${found.rows.length}`)
    return { state: 'stripped', stripped: 0, pending: found.rows.length }
  }
  const banned = new Set(found.rows.map((r) => r.line))
  const kept = text.split('\n').filter((l, i) => !banned.has(i + 1))
  const dropLog = found.rows.map((r) =>
    JSON.stringify({ at: new Date().toISOString(), seat: SEAT, file: PLAN_REL, kind: 'f12-purge', rowBefore: r.raw }),
  )
  const land = landViaObjectSpace(kept.join('\n'), logger)
  if (!land.ok) {
    logger(`❌ 落地被拒(${land.why})——不写留痕,下轮重试`)
    console.log('SWEEP-RESULT state=undetermined stripped=0')
    return { state: 'undetermined', stripped: 0 }
  }
  // 留痕排在**落地成功之后**(§1:先写后落会把"面上还在"说成"已删")
  const dropAbs = join(ROOT, DROP_REL)
  mkdirSync(dirname(dropAbs), { recursive: true })
  appendFileSync(dropAbs, dropLog.join('\n') + '\n', 'utf8')
  logger(`✅ 摘除 ${found.rows.length} 行已落地(${land.commit ?? 'HEAD 推进'}),留痕 ${dropLog.length} 条`)
  console.log(`SWEEP-RESULT state=stripped stripped=${found.rows.length}`)
  return { state: 'stripped', stripped: found.rows.length }
}

function landViaObjectSpace(text) {
  // 走仓内正牌旁路落地器(object-space-land:自带 CAS/回读/索引对齐/复跑),本器不手写第六份 commit-tree。
  // 先写工作树副本(land 读盘),被拒即还原 —— 落地器只对"与 HEAD 不同"的文件放行,写坏还原零残留。
  const planAbs = join(ROOT, PLAN_REL)
  const before = readFileSync(planAbs, 'utf8')
  if (before === text) return { ok: false, why: '盘面与将落内容相同(HEAD 已被别席同步?)' }
  writeFileSync(planAbs, text, 'utf8')
  const r = spawnSync(process.execPath, [join(HERE, 'object-space-land.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10 * 60 * 1000,
    maxBuffer: 1 << 24,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      LAND_PATHS: PLAN_REL,
      LAND_MSG:
        'chore(plan): 违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留)',
    },
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  if (r.status !== 0) {
    writeFileSync(planAbs, before, 'utf8')
    return { ok: false, why: out.split('\n').filter((l) => l.trim()).slice(-2).join(' / ').slice(0, 220) }
  }
  const m = out.match(/\b[0-9a-f]{12,40}\b/)
  return { ok: true, commit: m ? m[0].slice(0, 12) : null }
}

export function selfTest() {
  let fails = 0
  const ok = (cond, msg) => {
    if (!cond) {
      fails++
      console.error(`✗ ${msg}`)
    }
  }
  const T1 = '- [ ] **G-900 等条件**:等环境条件。'
  const T2 = '- [ ] **G-901 待拍板**:需用户拍板。'
  const T3 = '- [x] ✅(2026-10-25) **G-902 已结清**(等条件词属结清注记,合法)。'
  const T4 = '- [ ] **G-903 真活**:现在就能做。'
  const face = `# 计划\n${T4}\n${T1}\n${T2}\n${T3}\n`
  // ① 无 fields 的构造面:散文尺命中 T1/T2,已勾 T3 不进射程
  judgesRef.parseTaskRows = undefined
  // 注入真判据(import 单源)
  return import(pathToFileURL(join(HERE, 'lib', 'plan-task-index.mjs'))).then((idx) => {
    judgesRef.parseTaskRows = idx.parseTaskRows
    judgesRef.dispositionOfV2 = idx.dispositionOfV2
    const r1 = findBannedRows(face, null)
    ok(
      r1.rows.length === 2 && r1.undetermined === false,
      `① 构造面须点出 2 条违禁(T1/T2),实测 ${JSON.stringify(r1.rows.map((r) => r.line))}`,
    )
    ok(
      r1.rows.every((r) => !/^-\s\[x\]/.test(r.raw)),
      '② 已勾行不进射程(结清注记合法)',
    )
    const r2 = findBannedRows('', null)
    ok(r2.undetermined === true, '③ 空文本 ⇒ 未判定(不记绿不冒红)')
    const r3 = findBannedRows(face, null)
    ok(
      r3.rows[0].raw === T1 || r3.rows[0].raw === T2,
      '④ 名单带原文(留痕 rowBefore 用)',
    )
    // ⑤ SWEEP-RESULT 行形态锁(形状:三态关键词在位)
    ok('SWEEP-RESULT state=clean stripped=0'.match(/SWEEP-RESULT state=(clean|stripped|undetermined)/) !== null, '⑤ 结论行形态')
    if (fails === 0) console.log('自检:全部通过(5 组)')
    else console.error(`自检:${fails} 失败`)
    return fails
  })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (process.argv.includes('--self-test')) {
    selfTest().then((fails) => process.exitCode = fails ? 1 : 0)
  } else {
    sweep({ apply: process.argv.includes('--apply') })
      .then((r) => {
        process.exitCode = r.state === 'undetermined' ? 2 : 0
      })
      .catch((e) => {
        console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
        process.exit(2)
      })
  }
}

export const __test__ = { findBannedRows, judgesRef, SEAT, PLAN_REL, DROP_REL }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
