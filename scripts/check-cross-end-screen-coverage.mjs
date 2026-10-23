#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-cross-end-screen-coverage.mjs — 跨端页面覆盖对账(RN 端 ↔ 小程序端「一模一样」的正向推进尺)
 *
 * 为什么要有这道门:本仓「两端 UI 一致」的架构基础已存在 ——
 *   packages/app/src/features/<domain>/<Name>Screen.tsx 是共享屏(UI 与状态机的唯一真相源),
 *   RN 端 screens/*.tsx 是委托它的薄壳,Taro 端(小程序)因无法直接渲染 RN 原语而端内重写渲染层、
 *   靠「镜像 <共享屏路径>」标记声明对齐关系。
 * 但既有 check-cross-end-ui-parity.mjs 只判**组件级**同名样式(48 族配对腿),
 * **页面级覆盖**这一维从未有门 —— 于是「某共享屏只有 RN 有、小程序没有」这类缺口既不红也不被数,
 * 两端页面集长期分叉(RN 257 屏 vs 小程序 157 页,现读)。
 *
 * 判据(以代码为准,注释不数条数):
 *   R1 登记映射真实性 —— 登记表每条 (shared, rn, miniapp) 三端文件必须真实存在,
 *      且小程序页必须含 `packages/app/src/features/...` 镜像标记 ⇒ 路径搬走/标记删掉/页面删除都当场红(防清单腐烂)。
 *   R2 共享屏→RN 消费覆盖 —— 每个共享屏应至少被一个 RN 屏 import;只报数(存量口径,§12e)。
 *   R3 小程序镜像覆盖棘轮 —— 被小程序**显式镜像**的共享屏数只增不减(blocking,只拦本次带进来的倒退)。
 *   R4 RN 下沉率棘轮 —— RN 屏委托共享层的数量只增不减(blocking)。
 *
 * 「没判」绝不写成「判过」:小程序侧缺失靠路径启发式匹配不可靠 ⇒ 一律记**未判定**,
 * 既不进已对齐数也不进缺口数(§0.3)。只有显式标记或登记表的条目才进判定面。
 *
 * Usage:
 *   node scripts/check-cross-end-screen-coverage.mjs            # 判定 + 报数
 *   node scripts/check-cross-end-screen-coverage.mjs --json     # 机器可读
 *   node scripts/check-cross-end-screen-coverage.mjs --self-test
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(HERE, '..')
const R = (...p) => join(ROOT, ...p)

const SHARED_DIR = 'packages/app/src/features'
const RN_SCREENS = 'apps/mobile-rn/src/screens'
const MP_SRC = 'apps/miniapp-taro/src'
const MP_CONFIG = 'apps/miniapp-taro/src/app.config.ts'
const REGISTRY = 'scripts/data/cross-end-screen-registry.json'

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const selfTest = argv.includes('--self-test')
const stagedMode = argv.includes('--staged')
const worktreeMode = argv.includes('--worktree')

/* 取材面纪律(AGENTS §0.4):全量档判 HEAD blob、--staged 判索引 blob、--worktree 只是人工逃生舱。
 * 本门此前一律读工作树,而棘轮锚点(headMirroredSpecs)读 HEAD —— 两半不同面 ⇒ 共享多会话工作区里
 * 它报的"已镜像数"可以全是未提交副本(2026-10-24 实测:工作树面 70 条、HEAD 面 26 条,
 * 差 44 条只活在别席未入库的副本里),于是本地绿不等于干净检出/CI 绿。
 * 两面旗同给 = 面不明,当场未判定,不猜。 */
if (stagedMode && worktreeMode) {
  console.error('❌ 未判定:--staged 与 --worktree 同给,取材面不明(§0.4 不允许回落另一个面)')
  process.exit(2)
}
const FACE = stagedMode ? 'staged' : worktreeMode ? 'worktree' : 'head'
const FACE_LABEL = {
  head: 'HEAD blob(git ls-tree + git show HEAD:)',
  staged: '索引 blob(git ls-files + git show :)',
  worktree: '工作树(磁盘,人工逃生舱)',
}

/** 当前面上的文件清单(仓库相对路径,正斜杠) */
function faceList(face, dirPrefix) {
  if (face === 'worktree') {
    const base = R(dirPrefix)
    if (!existsSync(base)) return []
    return walk(base)
      .map((p) => relative(ROOT, p).replace(/\\/g, '/'))
      .sort()
  }
  const args =
    face === 'staged'
      ? ['ls-files', '-c', '--', dirPrefix]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', dirPrefix]
  try {
    return execFileSync('git', ['-C', ROOT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\n')
      .map((s) => s.trim().replace(/\\/g, '/'))
      .filter(Boolean)
      .sort()
  } catch {
    return []
  }
}

/** 当前面上的文件内容;读不到 = null(该面没有这份件,不回落另一个面) */
function faceRead(face, rel) {
  const key = rel.replace(/\\/g, '/')
  if (face === 'worktree') {
    try {
      return readFileSync(R(key), 'utf8')
    } catch {
      return null
    }
  }
  const spec = face === 'staged' ? `:${key}` : `HEAD:${key}`
  try {
    return execFileSync('git', ['-C', ROOT, 'show', spec], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

const log = (...a) => { if (!jsonMode) console.log(...a) }

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

/** 共享屏(真相源):packages/app/src/features/<domain>/<Name>Screen.tsx(按面枚举) */
function collectShared(face = FACE) {
  const re = new RegExp(`^${SHARED_DIR}/([^/]+)/([A-Z][A-Za-z0-9_]*Screen)\\.tsx$`)
  const out = []
  for (const rel of faceList(face, SHARED_DIR)) {
    const m = rel.match(re)
    if (!m) continue
    out.push({ name: m[2], domain: m[1], rel, spec: rel })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** RN 屏:apps/mobile-rn/src/screens/*.tsx(按面读正文) */
function collectRn(face = FACE) {
  return faceList(face, RN_SCREENS)
    .filter((rel) => rel.endsWith('.tsx'))
    .map((rel) => ({
      file: rel,
      name: rel.split('/').pop().replace(/\.tsx$/, ''),
      text: faceRead(face, rel),
    }))
}

/** 同目录伴生样式表也算镜像标记载体(项目既有惯例:.css 头部写「对齐 RN 端 packages/app/...」) */
function collectSidecarCss(hit, face = FACE) {
  if (!hit) return ''
  let acc = ''
  for (const c of [hit.replace(/\.tsx$/, '.css'), hit.replace(/[^/]*$/, 'index.css')]) {
    const t = faceRead(face, c)
    if (t) acc += t
  }
  return acc
}

/** 小程序页面:按面解析 app.config.ts 的 pages + subPackages,再按同一面找页面文件 */
function collectMiniapp(face = FACE) {
  const txt = faceRead(face, MP_CONFIG)
  if (txt === null) return []
  const pages = []
  const headSeg = txt.slice(txt.indexOf('pages: ['), txt.indexOf('subPackages'))
  for (const m of headSeg.matchAll(/'([^']+)'/g)) if (m[1].startsWith('pages/')) pages.push(m[1])
  for (const m of txt.matchAll(/root:\s*'([^']+)',\s*pages:\s*\[([\s\S]*?)\]/g)) {
    const root = m[1]
    for (const p of m[2].matchAll(/'([^']+)'/g)) pages.push(`${root}/${p[1]}`)
  }
  const out = []
  for (const p of pages) {
    const cands = [`${MP_SRC}/${p}.tsx`, `${MP_SRC}/${p}/index.tsx`, `${MP_SRC}/${p}/index.jsx`]
    const hit = cands.find((c) => faceRead(face, c) !== null)
    out.push({
      route: p,
      file: hit || null,
      text: hit ? faceRead(face, hit) : null,
      cssText: collectSidecarCss(hit, face),
    })
  }
  return out
}

/** 小程序页是否显式镜像了某共享屏(标记形如 packages/app/src/features/<domain>/<Name>Screen) */
const MARK_RE = /packages\/app\/src\/features\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_]+)Screen/g
function mirroredSpecs(mp) {
  const found = new Set()
  const hay = `${mp.text || ''}\n${mp.cssText || ''}`
  for (const m of hay.matchAll(MARK_RE)) found.add(`${SHARED_DIR}/${m[1]}/${m[2]}Screen.tsx`)
  return found
}

/** RN 屏是否消费了某共享屏(import 自 @ihui/rn-app 且出现该符号) */
function rnConsumes(rn, sharedName) {
  if (!rn.text) return false
  const re = new RegExp(`\\b${sharedName}\\b`)
  if (!re.test(rn.text)) return false
  return /@ihui\/rn-app/.test(rn.text)
}

/**
 * 棘轮锚点 = **HEAD 面**(§0.5「棘轮锚点 = 该文件 HEAD 自身的违规数」)。
 * 曾一度拿人工基线 JSON 当锚点,被变异测试当场证伪:补 47 条镜像后基线仍是旧读数,
 * 此刻删掉任意一条标记门都判绿 —— 那是假绿,不是棘轮。故改为 git 读 HEAD 面,免维护、不过期。
 */
function gitGrep(pattern, pathspec) {
  try {
    return execFileSync('git', ['-C', ROOT, 'grep', '-n', '-E', pattern, 'HEAD', '--', pathspec], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

/**
 * HEAD 面:小程序页显式镜像的共享屏集合。
 * **取材面必须与当前面同宽**(§0.4):只认 app.config.ts 注册页面那批文件。
 * 曾因 git grep 扫整个 src(把未注册页/组件里的引用也算进来)而当前面只扫注册页
 * ⇒ 未注册页上的标记被读成「本次被删」,当场造出假红(变异测试抓到)。
 */
function headMirroredSpecs(allowedFiles) {
  const out = new Set()
  const allow = new Set(allowedFiles || [])
  for (const line of gitGrep('packages/app/src/features/[A-Za-z0-9_-]+/[A-Za-z0-9_]+Screen', MP_SRC).split('\n')) {
    const pm = line.match(/^HEAD:([^:]+):\d+:/)
    if (!pm || !allow.has(pm[1])) continue
    const m = line.match(/(packages\/app\/src\/features\/[A-Za-z0-9_-]+\/[A-Za-z0-9_]+Screen\.tsx)/)
    if (m) out.add(m[1])
  }
  return out
}

/** HEAD 面:委托共享层(@ihui/rn-app)的 RN 屏文件路径集合 */
function headDelegatedRn() {
  return new Set(
    gitGrep('@ihui/rn-app', RN_SCREENS)
      .split('\n')
      .map((l) => l.split(':')[1])
      .filter(Boolean),
  )
}

function loadJson(p, fallback, face = FACE) {
  const txt = faceRead(face, p)
  if (txt === null) return fallback
  try { return JSON.parse(txt) } catch { return fallback }
}

function run() {
  const shared = collectShared()
  const rn = collectRn()
  const mp = collectMiniapp()
  const registry = loadJson(REGISTRY, { entries: [] })

  // --- R2:共享屏 → RN 消费覆盖(只报数) ---
  const rnConsumed = new Set()
  for (const s of shared) if (rn.some((r) => rnConsumes(r, s.name))) rnConsumed.add(s.spec)

  // --- 小程序显式镜像 ---
  const mirrored = new Map() // spec -> [route]
  for (const s of shared) {
    for (const p of mp) if (mirroredSpecs(p).has(s.spec)) {
      if (!mirrored.has(s.spec)) mirrored.set(s.spec, [])
      mirrored.get(s.spec).push(p.route)
    }
  }

  // --- R1:登记表真实性 ---
  const r1Red = []
  for (const e of registry.entries || []) {
    const { shared: sp, rn: rf, miniapp: mr } = e || {}
    if (!sp || !rf || !mr) { r1Red.push({ entry: e, why: '登记项缺 shared/rn/miniapp 三键之一' }); continue }
    if (faceRead(FACE, sp) === null) { r1Red.push({ entry: e, why: `共享屏不存在(${FACE} 面): ${sp}` }); continue }
    if (faceRead(FACE, rf) === null) { r1Red.push({ entry: e, why: `RN 屏不存在(${FACE} 面): ${rf}` }); continue }
    const mpEntry = mp.find((p) => p.route === mr)
    if (!mpEntry || !mpEntry.file) { r1Red.push({ entry: e, why: `小程序页不存在: ${mr}` }); continue }
    if (!mirroredSpecs(mpEntry).has(sp)) {
      r1Red.push({ entry: e, why: `小程序页 ${mr} 缺「镜像 ${sp}」标记(标记是配对的唯一凭据)` })
    }
  }

  // --- R3/R4 棘轮 ---
  const nowMirrored = [...mirrored.keys()].sort()
  const nowDelegated = rn.filter((r) => /@ihui\/rn-app/.test(r.text || '')).map((r) => r.file).sort()
  // 只拦「本次改动把 HEAD 已有的倒退掉」:新增不拦(那是收口),存量不拦(§12e)。
  // 锚点宽度 = HEAD 面在册页 ∪ 当前面在册页:只用当前面的话,「把整页删掉」会让那一页
  // 从允许清单里消失,连带把它的镜像声明从锚点里抹掉 —— 删页面反而免了倒退判定。
  const anchorWidth = new Set([
    ...collectMiniapp('head').map((p) => p.file).filter(Boolean),
    ...mp.map((p) => p.file).filter(Boolean),
  ])
  const lostMirrored = [...headMirroredSpecs(anchorWidth)].filter(
    (x) => !nowMirrored.includes(x),
  )
  const lostDelegated = [...headDelegatedRn()].filter((x) => !nowDelegated.includes(x))

  const stats = {
    face: FACE,
    faceLabel: FACE_LABEL[FACE],
    sharedTotal: shared.length,
    rnScreensTotal: rn.length,
    miniappPagesTotal: mp.length,
    miniappPagesWithFile: mp.filter((p) => p.file).length,
    rnConsumedShared: rnConsumed.size,
    rnConsumedRatio: shared.length ? +(rnConsumed.size / shared.length).toFixed(4) : 0,
    rnDelegatedScreens: nowDelegated.length,
    rnDelegatedRatio: rn.length ? +(nowDelegated.length / rn.length).toFixed(4) : 0,
    mirroredShared: nowMirrored.length,
    mirroredRatio: shared.length ? +(nowMirrored.length / shared.length).toFixed(4) : 0,
    registryEntries: (registry.entries || []).length,
    undeterminedMiniapp: shared.length - nowMirrored.length - r1Red.length,
  }

  const red = []
  for (const x of r1Red) red.push({ rule: 'R1', ...x })
  for (const x of lostMirrored) red.push({ rule: 'R3', why: `共享屏的小程序镜像被撤: ${x}` })
  for (const x of lostDelegated) red.push({ rule: 'R4', why: `RN 屏不再委托共享层: ${x}` })


  if (jsonMode) {
    console.log(JSON.stringify({ stats, red, mirrored: nowMirrored, gaps: shared.filter((s) => !mirrored.has(s.spec)).map((s) => s.spec) }, null, 2))
  } else {
    log(`判定面                  : ${stats.faceLabel}`)
    log(`共享屏(真相源)          : ${stats.sharedTotal}`)
    log(`RN 屏                   : ${stats.rnScreensTotal}(委托共享层 ${stats.rnDelegatedScreens},${(stats.rnDelegatedRatio * 100).toFixed(1)}%)`)
    log(`小程序页                : ${stats.miniappPagesTotal}(有文件 ${stats.miniappPagesWithFile})`)
    log(`共享屏被 RN 消费        : ${stats.rnConsumedShared}/${stats.sharedTotal}`)
    log(`共享屏被小程序显式镜像  : ${stats.mirroredShared}/${stats.sharedTotal}`)
    log(`未判定(无标记,不算缺口): ${stats.undeterminedMiniapp}`)
    log(`登记表条目              : ${stats.registryEntries}`)
    if (red.length) {
      log('')
      for (const r of red) log(`❌ [${r.rule}] ${r.why}`)
      log(`\n❌ 结论:跨端页面覆盖对账判红 ${red.length} 处`)
    } else {
      log('\n✅ 结论:登记映射全部真实,镜像/下沉两项无倒退')
    }
  }
  return red.length === 0 ? 0 : 1
}

function selfTestFn() {
  const cases = []
  const shared = collectShared()
  cases.push({ name: 'A1 共享屏可枚举', pass: shared.length > 0, got: shared.length })
  const rn = collectRn()
  cases.push({ name: 'A2 RN 屏可枚举', pass: rn.length > 0, got: rn.length })
  const mp = collectMiniapp()
  cases.push({ name: 'A3 小程序页可枚举且解析出路由', pass: mp.length > 0, got: mp.length })
  cases.push({ name: 'A4 小程序页至少一页有对应文件', pass: mp.some((p) => p.file), got: mp.filter((p) => p.file).length })
  // 正反例:镜像标记识别器对确定形态必须命中 / 对空串必须零命中
  const probe = { text: '// 镜像 packages/app/src/features/activity/ActivityScreen', cssText: '' }
  cases.push({ name: 'A5 镜像标记识别(正面)', pass: mirroredSpecs(probe).has(`${SHARED_DIR}/activity/ActivityScreen.tsx`), got: [...mirroredSpecs(probe)] })
  cases.push({ name: 'A6 镜像标记识别(反面:无关文本)', pass: mirroredSpecs({ text: 'nothing here', cssText: '' }).size === 0, got: 0 })
  cases.push({ name: 'A7 RN 消费判定(正面)', pass: rnConsumes({ text: "import { ActivityScreen } from '@ihui/rn-app'" }, 'ActivityScreen'), got: true })
  cases.push({ name: 'A8 RN 消费判定(反面:无 rn-app 引用)', pass: !rnConsumes({ text: 'const ActivityScreen = 1' }, 'ActivityScreen'), got: false })
  const hm = headMirroredSpecs(mp.map((p) => p.file).filter(Boolean))
  cases.push({ name: 'A9 棘轮锚点=HEAD 面:已镜像集合可算且非空', pass: hm.size > 0, got: hm.size })
  const hd = headDelegatedRn()
  cases.push({ name: 'A10 棘轮锚点=HEAD 面:RN 下沉集合可算且非空', pass: hd.size > 0, got: hd.size })
  // 取材面纪律(§0.4)的三条:读不到就是 null(不许回落另一个面)、列举与读取同面、
  // 在册页若在某一面上有文件,那一面必须真读得出内容(跨面回落会在这里当场露形)。
  cases.push({
    name: 'A11 faceRead 读不到的件返回 null(不回落另一个面)',
    pass: faceRead('head', 'scripts/__definitely_not_in_head_probe__.ts') === null,
    got: faceRead('head', 'scripts/__definitely_not_in_head_probe__.ts'),
  })
  cases.push({
    name: 'A12 faceRead 三面都能读出 app.config(三面都存在该件)',
    pass: ['head', 'staged', 'worktree'].every((f) => typeof faceRead(f, MP_CONFIG) === 'string'),
    got: ['head', 'staged', 'worktree'].map((f) => `${f}:${(faceRead(f, MP_CONFIG) || '').length}`).join(' '),
  })
  const headMp = collectMiniapp('head')
  cases.push({
    name: 'A13 小程序在册页的 file 与内容同面(HEAD 面内不自相矛盾)',
    pass: headMp.every((p) => !p.file || (typeof p.text === 'string' && p.text.length > 0)),
    got: `${headMp.filter((p) => p.file).length}/${headMp.length} 页在 HEAD 面有文件`,
  })
  cases.push({
    name: 'A14 共享屏列举按面自洽:每条 spec 都能在该面读出内容',
    pass: collectShared('head').every((s) => faceRead('head', s.spec) !== null),
    got: collectShared('head').length,
  })
  cases.push({
    name: 'A15 阳性对照:把 spec 改成不存在的件,A14 那把尺子必须判不过',
    pass: ![{ spec: `${SHARED_DIR}/__nope__/NopeScreen.tsx` }].every((s) => faceRead('head', s.spec) !== null),
    got: false,
  })
  let bad = 0
  for (const c of cases) {
    if (!c.pass) bad++
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.got !== undefined ? ` — ${JSON.stringify(c.got)}` : ''}`)
  }
  console.log(`\n自检 ${cases.length} 例,失败 ${bad}`)
  return bad === 0 ? 0 : 1
}

/* §22d:直执行才跑主流程 —— 否则测试一 import __test__ 就触发判定并 process.exit,把用例进程带走 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

/** §22c:判据单一出口 —— 取证测试 import 这份,禁止在测试里另抄一份面读取器 */
export const __test__ = { faceRead, faceList, collectShared, collectRn, collectMiniapp, mirroredSpecs, rnConsumes, headMirroredSpecs, headDelegatedRn, FACE, MARK_RE }

if (isDirectRun) {
  if (selfTest) process.exit(selfTestFn())
  process.exit(run())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
