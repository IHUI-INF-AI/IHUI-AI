#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-plan-id-pool.mjs —— 号池对账门(warn 起步;接线状态以 `guardian-runner.mjs` 注册条目现值为准,
 * 本头注不自称"已接"—— 守门 89 R1/R2 就是拦"声称已接而权威点零命中"的那一型)。立因(2026-10-14 真事故):
 *
 * 机主 2026-10-14 拍板「任务号全部 ≤3 位、个位数起」,这条硬上限**只写在发号器里**
 * (`lib/plan-id-lease.mjs` 的 `LEASE_POOL_MAX = 999`,`next-plan-id.mjs` 池满即拒绝发号)。
 * 活面上没有任何一道门拦"声明位号 >999 的登记行" ⇒ 谁绕过发号器就没人管:本会话实测就是
 * 直接用 `plan-task-index.usedIdsOfPrefix()` 的 `max + 1` 取号,拿到 `G-1080899 / G-1080900`
 * 两条七位号,并一路绿灯落地(提交 `f477d186ef`,已让号为 O23/O27,枚 `4ee12cb8bc`)。
 * §0.9:判据必须在真跑它的那一刻才成立;"规则写在 A 里、B 面无人守"就是这一型。
 *
 * R1 号池超上限(差值棘轮,§12e):
 *   被审面登记行的**声明位**号 > LEASE_POOL_MAX ⇒ 违规。
 *   · 全量档(HEAD blob):存量只报数,**不判红** —— 现读存量 7 条(他人的长号),
 *     当场判红就是与提交内容无关的恒红门,唯一结局是逼人 --no-verify 连带废掉全部守门。
 *   · --staged(索引 blob):只拦**本次新带进来的**违规键(索引面违规键 ⊖ HEAD 面违规键)。
 *     升 blocking 的前置 = HEAD 面存量归零(§12e);定级以 runner 注册条目现值为准。
 *
 * R2 发号路径(只报数):把 `usedIdsOfPrefix(...)` 的 `.max` 再 +1 当号发的写法,除
 *   sanctioned 名单(取号器本身与写盘闸)外一律点名。这条不判红:同一形状在"分组统计"
 *   语境里是合法的(usedIdsOfPrefix 本职是给 F4/F10 分组用),判红会误伤;但必须**报名**,
 *   因为"合法用途"与"拿来发号"在这份代码里只差一行,静默过去就等于把 R1 的洞重新打开。
 *
 * 未判定纪律(§0.3):被审面取不到 ⇒ exit 2 显式"未判定",不记绿也不冒红;枚举到 0 个
 *   候选**不**判死(0 条违规是真结论,与"没量到"是两件事)。
 *
 * 用法:
 *   node scripts/check-plan-id-pool.mjs            # 全量档(HEAD 面,存量只报数)
 *   node scripts/check-plan-id-pool.mjs --staged   # 提交链档(索引面,拦新增)
 *   node scripts/check-plan-id-pool.mjs --json     # 机读
 *   node scripts/check-plan-id-pool.mjs --self-test  # 取证(含两条阳性对照)
 * 紧急跳过(不推荐):HUSKY_SKIP_PLAN_ID_POOL=1
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { catBatch, selectFace } from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'
import { LEASE_POOL_MAX, ID_HEAD_RE } from './lib/plan-id-lease.mjs'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const idx = require(path.join(ROOT, 'scripts/lib/plan-task-index.mjs'))
const PLAN = 'PROJECT_PLAN.md'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' }

/** 登记行(与 13d 同形:含残缺行 `[ ]`,排除 `<!-- -->` 占位注释)。 */
const isRow = (l) => /^\s*(?:[-*]\s*)?\[[ xX]\]/.test(l) && !/^\s*<!--/.test(l)

/**
 * 一面上的"超池声明"清单:取每行**声明位**号(keyOfRow 那一份判据),按 ID_HEAD_RE 取族与数字段,
 * 数字段 > poolMax 即违规。返回 [{key, family, num, line}]。
 */
export function overPoolDeclarations(text, poolMax = LEASE_POOL_MAX) {
  const out = []
  const lines = String(text ?? '').split(/\r?\n/)
  lines.forEach((l, i) => {
    if (!isRow(l)) return
    const key = idx.keyOfRow(l)
    if (!key) return
    const m = ID_HEAD_RE.exec(key)
    if (!m) return
    const num = Number(m[3])
    if (!Number.isFinite(num)) return
    if (num > poolMax) out.push({ key, family: m[1].toUpperCase(), num, line: i + 1 })
  })
  return out
}

/**
 * R2 发号路径:只认**那个构造形状** —— `usedIdsOfPrefix(...)` 的结果紧接着被
 * `.template.replace('%d', String(xxx.max + 1))` 写成号(本会话真实踩到的就是这一行)。
 *
 * 为什么不用"同文件共现"判:第一版就是共现判,当场误伤 `plan-tasks.mjs` 自测里的**引文**
 * (`"手工 max+1 抄进正文必撞"`)与本门自己的夹具字符串。遮注释不遮字符串是横向口径定的方向,
 * 不能为了自洽把判据放宽到"字符串也遮"(那等于把真发号一起放过)。收到构造级之后:
 * **描述这件事的文字不算做这件事的代码**,而真把号算出来写进正文的形状一个都跑不掉。
 */
const ALLOC_CONSTRUCTION_RE =
  /usedIdsOfPrefix\s*\([\s\S]{0,600}?\.template\.replace\(\s*'%d'\s*,\s*String\(\s*[\w.]*\.?max\s*\+\s*1/

export function allocPathHits(code) {
  const src = maskComments(String(code ?? ''))
  const m = ALLOC_CONSTRUCTION_RE.exec(src)
  if (!m) return []
  const at = src.slice(0, m.index).split(/\r?\n/).length
  return [{ line: at, text: src.slice(m.index, m.index + 110).replace(/\r?\n/g, ' ⏎ ') }]
}

/** 差值判定(纯函数):索引面里 HEAD 面没有的超池键 = 本次带进来的。 */
export function poolRatchetVerdict(headText, indexText, poolMax = LEASE_POOL_MAX) {
  const before = overPoolDeclarations(headText, poolMax)
  const after = overPoolDeclarations(indexText, poolMax)
  const bset = new Set(before.map((x) => x.key))
  return { before, after, added: after.filter((x) => !bset.has(x.key)) }
}

/**
 * sanctioned 名单:这些文件**本来就该**含该形状,不点名(每条都得写理由,裸名单就是后门)。
 *  - next-plan-id.mjs / live-doc-edit.mjs —— 正牌取号出口(池式发号就是它们做的);
 *  - plan-id-lease.mjs / plan-task-index.mjs —— `nextTaskIdLabel` 的号段与形状实现本体;
 *  - plan-collide-renumber.mjs —— 撞号让号批工具,它必须能算新号;
 *  - 本门自己 —— 判据的构造形状与阳性对照夹具就写在同一个文件里,不豁免就是咬自己
 *    (反向锁在镜像测试:名单不得再扩,且新增项必须带理由)。
 */
const SANCTIONED_ALLOC = new Set([
  'next-plan-id.mjs',
  'live-doc-edit.mjs',
  'plan-id-lease.mjs',
  'plan-task-index.mjs',
  'plan-collide-renumber.mjs',
  'check-plan-id-pool.mjs',
])

function scanAllocPath() {
  const fs = require('node:fs')
  const dir = path.join(ROOT, 'scripts')
  const hits = []
  let names = []
  try {
    names = fs.readdirSync(dir).filter((f) => /\.mjs$/.test(f))
  } catch {
    return null
  }
  for (const f of names) {
    if (SANCTIONED_ALLOC.has(f)) continue
    let t = null
    try {
      t = fs.readFileSync(path.join(dir, f), 'utf8')
    } catch {
      continue
    }
    const h = allocPathHits(t)
    if (h.length) hits.push({ file: f, hits: h })
  }
  return hits
}

function main(argv) {
  const jsonOut = argv.includes('--json')
  const staged = argv.includes('--staged')
  const specs = staged ? [`:${PLAN}`, `HEAD:${PLAN}`] : [`HEAD:${PLAN}`]
  let got
  try {
    got = catBatch(ROOT, specs, { timeout: 60000 })
  } catch {
    got = null
  }
  if (!got) {
    console.error(`${C.yellow}⏭  号池对账未判定:被审面取不到(不记绿也不冒红)${C.reset}`)
    return 2
  }
  const faceText = staged ? got.get(`:${PLAN}`) : got.get(`HEAD:${PLAN}`)
  const headText = staged ? got.get(`HEAD:${PLAN}`) : got.get(`HEAD:${PLAN}`)
  if (typeof faceText !== 'string' || typeof headText !== 'string' || faceText === '' || headText === '') {
    console.error(`${C.yellow}⏭  号池对账未判定:${staged ? '索引面或 HEAD 面' : 'HEAD 面'}取不到${C.reset}`)
    return 2
  }

  let verdict
  if (staged) verdict = poolRatchetVerdict(headText, faceText)
  else {
    const over = overPoolDeclarations(faceText)
    verdict = { before: over, after: over, added: [] }
  }
  const alloc = scanAllocPath()

  if (jsonOut) {
    console.log(JSON.stringify({ poolMax: LEASE_POOL_MAX, staged, stock: verdict.after.length, added: verdict.added, allocPath: alloc }))
    if (staged && verdict.added.length) return 1
    return 0
  }

  console.log(
    `${C.cyan}[plan-id-pool]${C.reset} 池上限 ${LEASE_POOL_MAX}(单源 lib/plan-id-lease.mjs,env 不得覆写)/ 判定面:${staged ? '索引 blob' : 'HEAD blob'}`,
  )
  console.log(
    `  R1 超池声明:存量 ${verdict.after.length} 条;本次新增 ${verdict.added.length} 条${verdict.after.length ? `(样例 ${verdict.after.slice(0, 5).map((x) => x.key).join(' ')})` : ''}`,
  )
  if (alloc === null) console.log(`  R2 未判定:scripts/ 目录读不出 ⇒ 发号路径这一维不判通过`)
  else if (!alloc.length) console.log(`  R2 发号路径:无命中(除 sanctioned 名单外没人用 usedIdsOfPrefix 的 max+1 发号)`)
  else
    for (const a of alloc)
      console.log(
        `  R2 发号路径点名 ${a.file}:${a.hits.length} 处 —— 长号只能由 next-plan-id/live-doc-edit 的发号路径给;若这是分组统计用途,请把号发交回取号器`,
      )

  if (staged && verdict.added.length) {
    console.error(
      `${C.red}❌ 号池差值棘轮:本次提交新带进 ${verdict.added.length} 条 >${LEASE_POOL_MAX} 的声明号${C.reset}`,
    )
    for (const x of verdict.added.slice(0, 10)) console.error(`  · L${x.line} ${x.key}`)
    console.error(
      `${C.yellow}出路:① 用正牌取号器发号后让号,尾注随行可溯原号:` +
        `node scripts/next-plan-id.mjs(池内空闲清单是它给的,不要自己数空闲位,更不要用 usedIdsOfPrefix 的 max+1);\n` +
        `       ② 确属必要的历史大号 ⇒ 走人工裁定并登记,不得靠 --no-verify 过去。`,
    )
    return 1
  }
  if (staged) console.log(`${C.green}✅ 号池差值:本次未新增长号(存量 ${verdict.after.length} 条只报数)${C.reset}`)
  else console.log(`${C.green}✅ 号池全量档:存量只报数(升 blocking 的前置 = 存量归零,§12e)${C.reset}`)
  return 0
}

/** 取证:纯函数三态 + 两条阳性对照(有牙证明),不碰真仓。 */
function selfTest() {
  const fail = []
  const NOTE = (n, k) => `- [ ] ${k} **事${n}**:正文交代得很长以便过闸。\n`
  // ① 超池识别
  const face = `# t\n${NOTE(1, 'G-1038426')}${NOTE(2, 'O23')}${NOTE(3, 'D1047')}${NOTE(4, 'G-999')}${NOTE(5, 'O13b')}`
  const over = overPoolDeclarations(face)
  const keys = over.map((x) => x.key).sort()
  if (keys.join(',') !== 'D1047,G-1038426') fail.push(`R1 识别错:${keys.join(',')} 应为 D1047,G-1038426(999/23/13b 不得算超池)`)
  // ② 差值棘轮有牙:索引面把存量长号原样带着 ⇒ 不红;新带一条长号 ⇒ 红
  const headFace = `# t\n${NOTE(1, 'G-1038426')}${NOTE(2, 'O23')}`
  const sameFace = headFace
  const newBad = headFace + NOTE(9, 'G-1099001')
  const v1 = poolRatchetVerdict(headFace, sameFace)
  if (v1.added.length !== 0) fail.push(`存量不担责被破坏:${v1.added.map((x) => x.key).join(',')} 应为空`)
  const v2 = poolRatchetVerdict(headFace, newBad)
  if (v2.added.length !== 1 || v2.added[0].key !== 'G-1099001')
    fail.push(`新增长号未拦:${JSON.stringify(v2.added.map((x) => x.key))} 应为 [G-1099001]`)
  // ③ 发号路径:构造形状必中;两种"提到这件事"的写法必不中(假阳护栏)
  const offender = "const u = idx.usedIdsOfPrefix(t, 'G')\nconst id = u.template.replace('%d', String(u.max + 1))\n"
  if (!allocPathHits(offender).length) fail.push('R2 失明:usedIdsOfPrefix → template.replace(…max+1) 的构造没被认出')
  const benignStats = "const u = idx.usedIdsOfPrefix(t, 'G')\nconsole.log('该族已用', u.used, '个,最大', u.max)\n"
  if (allocPathHits(benignStats).length) fail.push('R2 误伤:只做分组统计的文件被判成发号路径')
  const benignProse =
    "// 手工 max+1 抄进正文必撞\nconst msg = '不要自己数空闲位,更不要用 max + 1 发号'\nconst u = usedIdsOfPrefix(t, 'G')\n"
  if (allocPathHits(benignProse).length) fail.push('R2 误伤:注释/字符串里描述这件事的文字被判成代码(第一版就是这么误伤 plan-tasks.mjs 的)')
  // ④ 非登记行不参与(占位注释里的长号引用是历史留痕,不算超池声明)
  const prose = `# t\n<!-- 已归档(2026-10-14:G-1080898 完整内容在 x -->\n- [ ] O24 正常行\n`
  if (overPoolDeclarations(prose).length) fail.push('占位注释里的历史号被算成超池声明 ⇒ 判据过宽')
  console.log(
    fail.length
      ? `❌ self-test ${fail.length} 例:\n  - ` + fail.join('\n  - ')
      : `✅ self-test 通过(4 组判据 · 阳性对照 5 条:新增长号必拦 / 构造发号必拦 / 存量不担责 / 分组统计不误伤 / 引文不误伤;池上限 ${LEASE_POOL_MAX})`,
  )
  return fail.length ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exitCode = selfTest()
  } else {
    const { error } = selectFace({ staged: argv.includes('--staged'), def: 'worktree' })
    if (error) {
      console.error(`❌ 无法判定: ${error}`)
      process.exitCode = 2
    } else if (process.env.HUSKY_SKIP_PLAN_ID_POOL === '1') {
      console.warn('⚠️  HUSKY_SKIP_PLAN_ID_POOL=1,已跳过号池对账守门')
      process.exitCode = 0
    } else {
      process.exitCode = main(argv)
    }
  }
}

export const __test__ = { overPoolDeclarations, poolRatchetVerdict, allocPathHits, selfTest, PLAN, SANCTIONED_ALLOC }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
