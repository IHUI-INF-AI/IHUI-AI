#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * strip-stale-closed-rows.mjs —— 「完成即删」的无人值守兜底(2026-10-20 立,机主令:
 * "要彻底根治 固定完成立即删掉记录")。
 *
 * 为什么提交口那道闸(守门 check-plan-closed-stock S1)还不够:
 *   S1 只在**有人提交且碰到 PROJECT_PLAN.md** 时拦。已完成行回到 HEAD 的另一条通道是
 *   并发合并/旧基线回写(2026-10-20 实测:一次清扫推上去后,合并又把 3 条带回),
 *   而带回它的那枚提交可以不碰台账 ⇒ 提交口看不见。故需一枚按同一判据清扫的兜底层。
 *
 * 判据**不在此重写**:import 守门的 staleClosedVerdict(§0.6/§22c 单一实现)。
 * 清扫集 = HEAD 面里的"跨枚滞留"已勾行(与 HEAD^ 同主键都已勾)。
 * **刚翻勾的那一枚永不清扫** —— 给守门 71 的 (c) 配平凭据留活路,否则结清只能变成
 * "无凭据减少"被无限回捞(本机 2026-10-20 实测)。
 *
 * 三条硬守恒(不成立 ⇒ 整批不落,不部分落):
 *   H1 未勾登记行逐字节同序不变(一行不许动、不许重排);
 *   H2 行数差 == 清扫条数(只删行,不改写行);
 *   H3 清扫后仍留下的已勾行必须全是"本枚首次翻勾"(滞留集为空)。
 *
 * 落地唯一通道:`scripts/object-space-land.mjs`(blob 档 + 行级复活守卫 + CAS,从不写工作树)。
 * 旁路落地不跑 post-commit ⇒ 自动推送腿不触发(AGENTS §5b 回潮通道①),故本器落地后
 * 自己调 `git-push-guard.mjs` 把 origin 追平,并把跳过的守恒读数打进留痕。
 *
 * 用法:
 *   node scripts/strip-stale-closed-rows.mjs           # 只读预演(零副作用;exit 0 无滞留 / 1 有 / 2 未判定)
 *   node scripts/strip-stale-closed-rows.mjs --apply    # 落地 + 推送
 *   node scripts/strip-stale-closed-rows.mjs --self-test
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parseTaskRows } from './lib/plan-task-index.mjs'
import { staleClosedVerdict } from './check-plan-closed-stock.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'
/** 单批上限:超出即拒绝自动回写(与水印门"单次缺口 >200 拒绝自动回写"同一取向,§0.10 失效方向是多要一次说明) */
const BATCH_CAP = 400

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' }

function git(args, encoding = 'utf8') {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** 取一面 blob;取不到返回 null(调用方落「未判定」,不回落另一个面 —— §0.4) */
function blobOf(spec) {
  try {
    return git(['cat-file', '-p', spec])
  } catch {
    return null
  }
}

/**
 * 纯函数:从底稿里摘掉指定行号的行,并跑三条守恒。
 * @returns {{ok:boolean, text?:string, removed?:number, why?:string, keptClosed:number}}
 */
export function buildStripPlan(baseText, staleLines) {
  const lines = String(baseText).split('\n')
  const drop = new Set(staleLines)
  const removed = lines.filter((_, i) => drop.has(i + 1)).length
  if (removed !== drop.size)
    return { ok: false, keptClosed: 0, why: `H0 行号集有 ${drop.size - removed} 枚指不到行(面已变)` }
  const out = lines.filter((_, i) => !drop.has(i + 1))
  const openBefore = lines.filter((l) => /^\s*- \[ \]/.test(l))
  const openAfter = out.filter((l) => /^\s*- \[ \]/.test(l))
  if (
    openBefore.length !== openAfter.length ||
    !openBefore.every((l, i) => l === openAfter[i])
  )
    return { ok: false, keptClosed: 0, why: 'H1 未勾登记行没做到逐字节同序不变' }
  if (out.length !== lines.length - removed)
    return { ok: false, keptClosed: 0, why: 'H2 行数差不等于清扫条数' }
  const closedAfter = parseTaskRows(out.join('\n')).filter((r) => r.state === 'done').length
  return { ok: true, text: out.join('\n'), removed, keptClosed: closedAfter }
}

/** 自检:纯函数夹具,不落盘、不碰仓库。 */
function selfTest() {
  const openRow = '- [ ] G-1 待办夹具:一件事'
  const staleClosed = '- [x] ✅(2026-10-20/甲) G-2 待办夹具:二件事'
  const freshClosed = '- [x] ✅(2026-10-20/乙) G-3 待办夹具:三件事'
  const cases = [
    {
      n: 'H1/H2 成立:摘掉滞留行,未勾行原样,行数精确减少',
      base: [openRow, staleClosed, freshClosed].join('\n'),
      drop: [2],
      ok: true,
      removed: 1,
      keptClosed: 1,
    },
    {
      n: 'H0 行号指不到(面已变)⇒ 整批不落',
      base: [openRow].join('\n'),
      drop: [7],
      ok: false,
    },
    {
      n: '零行清扫 ⇒ 成立且不动任何字节',
      base: [openRow, staleClosed].join('\n'),
      drop: [],
      ok: true,
      removed: 0,
      keptClosed: 1,
    },
  ]
  let fails = 0
  for (const c of cases) {
    const r = buildStripPlan(c.base, c.drop)
    const ok = r.ok === c.ok && (c.ok ? r.removed === c.removed && r.text === c.base.split('\n').filter((_, i) => !c.drop.includes(i + 1)).join('\n') && r.keptClosed === c.keptClosed : true)
    if (!ok) {
      fails++
      console.log(`${C.red}✗${C.reset} ${c.n} —— 实得 ok=${r.ok} removed=${r.removed}${r.why ? ' why=' + r.why : ''}`)
    } else console.log(`${C.green}✓${C.reset} ${c.n}`)
  }
  // 反证:摘掉一枚未勾行必须被 H1 咬住(守恒不是装饰)
  const hurt = buildStripPlan([openRow, staleClosed].join('\n'), [1])
  if (hurt.ok) {
    fails++
    console.log(`${C.red}✗ 反证失败:摘掉未勾行竟通过了 H1 守恒${C.reset}`)
  } else console.log(`${C.green}✓${C.reset} 反证:摘未勾行被 H1 拦下(${hurt.why})`)
  // 反证:判据 import 的是守门本体,不是本地抄一份
  let wired = false
  try {
    wired = git(['show', 'HEAD:scripts/check-plan-closed-stock.mjs']).includes('staleClosedVerdict')
  } catch {
    wired = false
  }
  console.log(
    `${wired ? C.green + '✓' : C.yellow + '⚠'}${C.reset} 判据来源:守门脚本${wired ? '已在 HEAD 面导出 staleClosedVerdict' : '尚未落地(本枚一起落)'}`,
  )
  console.log(`${C.cyan}自检 ${cases.length + 2 - fails}/${cases.length + 2}${C.reset}`)
  return fails ? 1 : 0
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())
  const apply = args.includes('--apply')

  const headText = blobOf('HEAD:' + FILE)
  const baseText = blobOf('HEAD^:' + FILE)
  if (headText === null || baseText === null) {
    console.error(`${C.yellow}⏭ 未判定:${C.reset}HEAD 或 HEAD^ 面的 ${FILE} 取不到 ⇒ 不清扫(§0.3)`)
    process.exit(2)
  }
  const v = staleClosedVerdict(headText, baseText)
  if (v.undetermined) {
    console.error(`${C.yellow}⏭ 未判定:登记行解析异常 ⇒ 不得读成"没有滞留行"${C.reset}`)
    process.exit(2)
  }
  if (v.stale.length === 0) {
    console.log(`${C.green}✅ 无跨枚滞留的已完成登记行${C.reset}(HEAD 面已勾 ${v.faceClosed} 条,均为刚翻勾的一枚宽限)`)
    process.exit(0)
  }
  if (v.stale.length > BATCH_CAP) {
    console.error(
      `${C.red}❌ 拒绝自动回写:${v.stale.length} 条 > 单批上限 ${BATCH_CAP}${C.reset} —— 这个量级要么是清扫本身出问题,` +
        `要么是台账被整片带回;交人工按守门提示分批处理,不静默批量删。`,
    )
    process.exit(1)
  }
  console.log(
    `${C.cyan}📊 跨枚滞留已勾登记行 ${v.stale.length} 条${C.reset}(HEAD 面已勾共 ${v.faceClosed} 条)`,
  )
  for (const r of v.stale.slice(0, 10)) console.log(`   L${r.line} ${r.raw.slice(0, 110)}`)
  if (!apply) {
    console.log(`${C.yellow}只读预演(零副作用)。落地:--apply${C.reset}`)
    process.exit(1)
  }

  const plan = buildStripPlan(headText, v.stale.map((r) => r.line))
  if (!plan.ok || plan.removed !== v.stale.length) {
    console.error(`${C.red}❌ 守恒不过,整批不落:${C.reset}${plan.why ?? '清扫条数与滞留集不等'}`)
    process.exit(1)
  }
  // H3:摘完仍留下的已勾行必须全是"本枚首次翻勾"(再跑一次同一判据,基线换成 HEAD)
  const after = staleClosedVerdict(plan.text, headText)
  if (after.stale.length !== 0) {
    console.error(`${C.red}❌ H3 不过:摘完仍有 ${after.stale.length} 条被判滞留 ⇒ 行号集与判据不自洽,不落${C.reset}`)
    process.exit(1)
  }

  const dir = mkScratch('ihui-strip-closed-')
  try {
    const newPath = path.join(dir, 'new.md')
    writeFileSync(newPath, plan.text, 'utf8')
    const blob = git(['hash-object', '-w', newPath]).trim()
    const blobsPath = path.join(dir, 'blobs.json')
    const scopePath = path.join(dir, 'clash.json')
    writeFileSync(blobsPath, JSON.stringify({ files: [{ path: FILE, blob }] }))
    writeFileSync(
      scopePath,
      JSON.stringify({ files: [{ path: FILE, removed: v.stale.map((r) => r.raw), added: [] }] }),
    )
    const env = {
      ...process.env,
      LAND_PATHS: FILE,
      LAND_BLOBS: blobsPath,
      LAND_CLASH_SCOPE: scopePath,
      LAND_BLOB_PROOF:
        `滞留集由守门 check-plan-closed-stock 的同一判据算出(HEAD ∩ HEAD^ 同复合主键都已勾);` +
        `复算: node scripts/check-plan-closed-stock.mjs(全量档点名同一批行)。` +
        `守恒:H1 未勾 ${(plan.text.match(/^\s*- \[ \]/gm) || []).length} 行逐字节同序 / ` +
        `H2 行数 -${plan.removed} / H3 摘后再跑判据滞留=0`,
      LAND_MSG:
        `chore(plan): 自动摘除 ${plan.removed} 条跨枚滞留的已完成登记行(完成即删兜底轮;` +
        `未勾行逐字节守恒,判据 import 守门 check-plan-closed-stock)`,
    }
    const land = spawnSync(process.execPath, [path.join(ROOT, 'scripts/object-space-land.mjs')], {
      cwd: ROOT,
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 600000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out = `${land.stdout ?? ''}${land.stderr ?? ''}`
    console.log(out.split('\n').slice(-12).join('\n'))
    if (land.status !== 0) {
      console.error(`${C.red}❌ 落地器拒绝(exit ${land.status})${C.reset} ⇒ 不重试、不强推,交人工看上面的点名`)
      process.exit(1)
    }
  } finally {
    rmScratch(dir)
  }

  // 旁路落地不跑 post-commit ⇒ 推送腿必须自带(AGENTS §5b 回潮通道①:origin 还带旧行就会被合并带回)
  const push = spawnSync(process.execPath, [path.join(ROOT, 'scripts/git-push-guard.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  console.log(
    `${push.status === 0 ? C.green + '✅ 推送腿已派发' : C.yellow + '⚠️ 推送腿 exit ' + push.status + '(不阻断,交 converge)' + C.reset}`,
  )
  console.log(
    `${C.green}✅ 清扫完成:摘除 ${plan.removed} 条;HEAD 现为 ${git(['rev-parse', 'HEAD']).trim().slice(0, 11)}${C.reset}`,
  )
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { buildStripPlan, FILE, BATCH_CAP }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
