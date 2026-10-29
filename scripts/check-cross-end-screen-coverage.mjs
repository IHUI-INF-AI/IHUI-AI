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
 * 2026-10-27 门 237 票「未判定桶收缩:补检测型,不松尺」(台账票面点名 --json 档):
 *   上面那句"只有显式标记才进判定面"过去只认**一条完整硬路径**,而真实在位的声明有好几种
 *   写法认不出(逐类第一手见 mirrorDeclarations 块头注与 --self-test 的 N 组夹具)。本票
 *   把识别面补宽(形2 容错路径 / 形3 目录-only + 同行屏名 / 形4 对齐动词 + 裸屏名),
 *   **判定尺度一寸未放**:名字类新形必须①同行有对齐动词 ②解析出的 spec 在同面共享屏索引
 *   里真在位 ③重名歧义一律不认。R1 登记凭据仍只认形1 硬路径(登记条目的纪律不被新形稀释)。
 *   undetermined 因此下降的幅度全部由 `新检测形认出` 一行按形报数,并可逐枚复证(--json 的
 *   `stats.recognizedByForm`)。反向对照 = 摘掉检测形 ⇒ 该例翻回未判定(N4)。
 *   另:本票同时恢复被 b966cb2167 洗掉的 ec7a5ef870 硬化 —— 取数 catch 折空集/折 null 冒绿
 *   改回抛 Undetermined + exit 2,collectRn/headDelegatedRn 回到同一把 RN_SCREEN_RE。
 *
 * Usage:
 *   node scripts/check-cross-end-screen-coverage.mjs            # 判定 + 报数
 *   node scripts/check-cross-end-screen-coverage.mjs --json     # 机器可读(含逐桶清单)
 *   node scripts/check-cross-end-screen-coverage.mjs --explain   # 逐枚取证:新形认出的那份声明原文
 *   node scripts/check-cross-end-screen-coverage.mjs --self-test
 */

import { existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, catBatch, gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

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
const explainMode = argv.includes('--explain')
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

/** 当前面上的文件清单(仓库相对路径,正斜杠)。face 除三档外可传任意 git 可解析 ref
 *  (还原度门的 CI 问责腿 --base=<ref> 用;'head' 仍映射 HEAD,三档行为一字不变)。 */
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
      : ['ls-tree', '-r', '--name-only', face === 'head' ? 'HEAD' : face, '--', dirPrefix]
  try {
    return gitRaw(args, ROOT, { maxBuffer: 64 * 1024 * 1024 })
      .split('\n')
      .map((s) => s.trim().replace(/\\/g, '/'))
      .filter(Boolean)
      .sort()
  } catch (e) {
    // §0.3:git 派生故障 = 取不到输入 ⇒ 显式未判定,绝不折成空集(空集会被记成"零命中"冒绿)。
    // 「该面没有这份件」不是这条出口管的:那是 catBatch 的 missing ⇒ null,不抛。
    throw new Undetermined(
      `faceList(${face}, ${dirPrefix}) 取不到 ${FACE_LABEL[face] ?? face} 面清单: ${e?.message ?? e}`,
    )
  }
}

/** 当前面上的文件内容;读不到 = null(该面没有这份件,不回落另一个面) */
function faceRead(face, rel) {
  const key = rel.replace(/\\/g, '/')
  const ck = faceCacheKey(face, key)
  if (faceCache.has(ck)) return faceCache.get(ck)
  // 正文一律经取材层(§0.4 / 门 118):磁盘面走 readWorktreeFile,git 两档走 catBatch ——
  // 不再自拼 `gitRaw(['show', …])`,否则"引了层却没换判定面"会被判半接线。
  if (face === 'worktree') {
    try {
      const v = readWorktreeFile(ROOT, key)
      faceCache.set(ck, v)
      return v
    } catch {
      faceCache.set(ck, null)
      return null
    }
  }
  const spec = faceSpec(face, key)
  try {
    const v = catBatch(ROOT, [spec], { maxBuffer: 64 * 1024 * 1024 }).get(spec) ?? null
    faceCache.set(ck, v)
    return v
  } catch (e) {
    // §0.3:catBatch 只在 git 派生故障时抛;missing/非 blob 已由取材层折成 null(合法"该面没有")。
    // 所以这个 catch 只可能吞掉"取不到输入" ⇒ 必须显式未判定,不得折成 null 冒充"文件不存在"。
    throw new Undetermined(
      `faceRead(${face}, ${key}) 取不到 ${FACE_LABEL[face] ?? face} 面内容: ${e?.message ?? e}`,
    )
  }
}

/**
 * 取材缓存 + **批量预取**(2026-10-27 落地,修「这道门 7 分钟跑不完」)。
 *
 * 旧实现:faceRead 每次都单独起一次 `git cat-file` 子进程(每文件一次)——
 * HEAD 面要读 RN 屏 300+ 、小程序在册页 400+ 、共享屏 300+ ⇒ 上千次进程 spawn,
 * 在 Windows 上每次 ~200ms ⇒ 门永远跑不完(实测 >7 分钟仍未结束,pre-push 必被拖死)。
 * 现实现:同一面的文件清单**一次性**交给 catBatch(它本就支持按字节分块批量读),
 * 千次 spawn 压到个位数。
 *
 * 语义不变:取不到 = null(不回落另一个面,§0.4);逐个读的回退路径仍在
 * (批量取不到时清掉预取标记,后续 faceRead 仍按原来的单读路径走)。
 */
const faceCache = new Map()
const facePrefetched = new Set()
const faceCacheKey = (face, rel) => `${face}\u0000${rel.replace(/\\/g, '/')}`
const faceSpec = (face, key) =>
  face === 'staged' ? `:${key}` : `${face === 'head' ? 'HEAD' : face}:${key}`

/** 预取同一面的一批文件;磁盘面直读无需批量,git 两档一次 catBatch 取回。 */
function prefetchFace(face, rels) {
  if (face === 'worktree') return
  const keys = []
  const specs = []
  for (const rel of rels || []) {
    if (!rel) continue
    const key = rel.replace(/\\/g, '/')
    if (!key) continue
    const ck = faceCacheKey(face, key)
    if (faceCache.has(ck) || facePrefetched.has(ck)) continue
    facePrefetched.add(ck)
    keys.push(key)
    specs.push(faceSpec(face, key))
  }
  if (specs.length === 0) return
  let map
  try {
    map = catBatch(ROOT, specs, { maxBuffer: 64 * 1024 * 1024 })
  } catch {
    for (const k of keys) facePrefetched.delete(faceCacheKey(face, k))
    return
  }
  keys.forEach((k, i) => faceCache.set(faceCacheKey(face, k), map.get(specs[i]) ?? null))
}

const log = (...a) => {
  if (!jsonMode) console.log(...a)
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

/**
 * 共享屏(真相源):packages/app/src/features/<domain…>/<Name>Screen.tsx(按面枚举)。
 *
 * 〔2026-10-27 补检测形〕旧尺 `([^/]+)/…` 只认**一级**目录,于是真实在位的嵌套域
 * `packages/app/src/features/tools/pdf/PdfToolsHubScreen.tsx`(HEAD 面实测唯一一枚)
 * 从分母里凭空消失 —— 那不是"没镜像",是"没被判过"(§0.3 同型)。改 `(.+)` 后
 * domain 允许带 `/`,配套 MARK_RE_LOOSE 的目录段也允许多级,两半同宽。
 * 其余口径一字未动:`.test.tsx` 伴生测试(`__tests__/XScreen.test.tsx`)仍以 `Screen.tsx$`
 * 落在射程外,大小写首字母闸保留。
 */
function collectShared(face = FACE) {
  const re = new RegExp(`^${SHARED_DIR}/(.+)/([A-Z][A-Za-z0-9_]*Screen)\\.tsx$`)
  const out = []
  for (const rel of faceList(face, SHARED_DIR)) {
    const m = rel.match(re)
    if (!m) continue
    out.push({ name: m[2], domain: m[1], rel, spec: rel })
  }
  // 共享屏正文也可能被读(A14 尺子/登记表核验)⇒ 同面一次性预取
  prefetchFace(face, out.map((s) => s.spec))
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** RN 屏的唯一形态尺(2026-10-27 收紧,与 collectShared 同一把尺):
 *  apps/mobile-rn/src/screens/<Name>Screen.tsx —— 大写开头 + Screen 后缀 + 顶层。
 *  旧口径只筛 `.endsWith('.tsx')`:任何伴生 .tsx(screens/tests/*.test.tsx、components/、
 *  barrel index.tsx)都会混进分母(rnScreensTotal、R2 的 some 集、rnDelegatedRatio 分母、
 *  R4 的 nowDelegated)。HEAD 面实测 315 枚 .tsx 全部是该形态 ⇒ 收紧后存量读数不漂移;
 *  伴生测试不再混入(与 headDelegatedRn 注释里踩过的 `.test.ts` 同型,那次是两侧不同尺,
 *  这次是两侧同松)。*/
const RN_SCREEN_RE = /^apps\/mobile-rn\/src\/screens\/([A-Z][A-Za-z0-9_]*)Screen\.tsx$/

/** RN 屏:apps/mobile-rn/src/screens/<Name>Screen.tsx(按面读正文) */
function collectRn(face = FACE) {
  const files = faceList(face, RN_SCREENS)
    .map((rel) => (rel.match(RN_SCREEN_RE) ? rel : null))
    .filter(Boolean)
  // 一次批量取回本面全部 RN 屏正文(旧实现逐个起 git 子进程 ⇒ 上千次 spawn,门跑不完)
  prefetchFace(face, files)
  return files.map((rel) => ({
    file: rel,
    name: rel
      .split('/')
      .pop()
      .replace(/\.tsx$/, ''),
    text: faceRead(face, rel),
  }))
}

/** 同目录伴生样式表也算镜像标记载体(项目既有惯例:.css 头部写「对齐 RN 端 packages/app/...」)
 *  路径清单与正文同笔产出 —— 棘轮锚点侧要按**同一批载体**重算声明,两侧同宽才有牙。 */
function sidecarCssPaths(hit) {
  if (!hit) return []
  return [hit.replace(/\.tsx$/, '.css'), hit.replace(/[^/]*$/, 'index.css')]
}

function collectSidecarCss(hit, face = FACE) {
  let acc = ''
  for (const c of sidecarCssPaths(hit)) {
    const t = faceRead(face, c)
    if (t) acc += t
  }
  return acc
}

/** 小程序页面:按面解析 app.config.ts 的 pages + subPackages,再按同一面找页面文件 */
function collectMiniapp(face = FACE) {
  const txt = faceRead(face, MP_CONFIG)
  if (txt === null) {
    // §0.3:app.config.ts 在判定面上不存在 ⇒ 判定面残缺,记 0 页就是"零命中冒绿"。
    throw new Undetermined(`小程序 ${MP_CONFIG} 在 ${FACE_LABEL[face] ?? face} 面读不到,判定面残缺`)
  }
  const pages = []
  const headSeg = txt.slice(txt.indexOf('pages: ['), txt.indexOf('subPackages'))
  for (const m of headSeg.matchAll(/'([^']+)'/g)) if (m[1].startsWith('pages/')) pages.push(m[1])
  for (const m of txt.matchAll(/root:\s*'([^']+)',\s*pages:\s*\[([\s\S]*?)\]/g)) {
    const root = m[1]
    for (const p of m[2].matchAll(/'([^']+)'/g)) pages.push(`${root}/${p[1]}`)
  }
  // 在册页正文候选 + 同目录伴生样式表:一次性批量预取(旧实现逐个起 git 子进程)
  const candAll = []
  for (const p of pages) {
    candAll.push(`${MP_SRC}/${p}.tsx`, `${MP_SRC}/${p}/index.tsx`, `${MP_SRC}/${p}/index.jsx`)
  }
  const sideAll = []
  for (const c of candAll) sideAll.push(...sidecarCssPaths(c))
  prefetchFace(face, [...candAll, ...sideAll])
  const out = []
  for (const p of pages) {
    const cands = [`${MP_SRC}/${p}.tsx`, `${MP_SRC}/${p}/index.tsx`, `${MP_SRC}/${p}/index.jsx`]
    const hit = cands.find((c) => faceRead(face, c) !== null)
    out.push({
      route: p,
      file: hit || null,
      text: hit ? faceRead(face, hit) : null,
      cssText: collectSidecarCss(hit, face),
      cssFiles: hit ? sidecarCssPaths(hit) : [],
    })
  }
  return out
}

/* ============================================================================
 * 镜像声明识别器(唯一实现)
 * ----------------------------------------------------------------------------
 * 为什么必须只有一份:R3 的「当前面已镜像集」与「HEAD 锚点集」是同一把尺的两端。
 * 2026-10-27 之前两侧各写各的(锚点侧走 `git grep` 逐行 + 一条要求 `.tsx` 后缀的内联正则,
 * 当前侧走 MARK_RE 全文),两侧不同宽已在本门留下两型事故(见 headMirroredSpecs 旧注与
 * memory「锚点侧与当前侧不同宽=恒红」)。现在两侧一律把**同一批载体文件**的正文交给
 * `mirrorDeclarations()`,宽度天然相等;反向对照夹具(N4)摘掉检测形即翻未判定。
 *
 * 凭据分档(2026-10-27 补检测形,一律"认出真实形态",不放宽判定面):
 *   形 1 硬路径(原有,逐字保留):packages/app/src/features/<domain>/<Name>Screen[.tsx]
 *       —— 路径本身即凭据;R1 登记表核验**只认这一档**(登记条目的凭据纪律不得被新形稀释)。
 *   形 2 容错路径:同一条路径被注释换行折断 / 省掉 `src/` 段 / 带 `Shared` 前缀 /
 *       多级目录(实测 HEAD 面唯一那枚嵌套屏 `tools/pdf/PdfToolsHubScreen` 就同时踩了
 *       「目录层级」与「路径断行」两型)。
 *   形 3 目录-only + 同行屏名:只写到 `features/<domain>`(如
 *       `对齐 RN SharedAppTopupScreen(packages/app/src/features/app-topup)`)。
 *   形 4 对齐动词 + 裸屏名(可带 `Shared` 前缀):如
 *       `/* 会员状态卡对齐 SharedVipScreen …`、`对齐 RN HomeScreen root(...)`。
 *   形 3/形 4 是"名字"而非"路径",所以加两道闸,缺一道就不认:
 *     ① 同一行必须有对齐动词(否则代码里的同名标识符、API 函数名会被读成对齐声明);
 *     ② 解析出的 spec 必须在**同一面**的共享屏索引里真在位(§票面红线:判的是"符号真的
 *        出口在位",不是"文件名字对上了");按域名唯一解析,重名 ⇒ 歧义 ⇒ 不认并记名。
 *   新增形只让「未判定」桶里的项被正面判定,不改任何阈值/档位/豁免语义;严格形旧读数不受影响。
 * ==========================================================================*/

/** 形 1(原有硬路径,口径一字未动) */
const MARK_RE = /packages\/app\/src\/features\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_]+)Screen/g

/** 形 2:容错路径(组 1=目录段可多级、组 2=可选 Shared 前缀、组 3=屏名主干)。
 *  斜杠两侧允许**至多一个**换行 + 行首缩进(注释折行那一型),不给"跨多行随便拼路径"的口子;
 *  `src/` 可省(`packages/app features/<domain>` 实测在写);目录段可多级。 */
const MARK_RE_LOOSE =
  /packages[ \t]{0,4}\/[ \t]{0,4}app[ \t]{0,4}(?:\/[ \t]{0,4}|[ \t]{0,4}\r?\n[ \t]{0,4})?(?:src[ \t]{0,4}(?:\/[ \t]{0,4}|[ \t]{0,4}\r?\n[ \t]{0,4})?)?features[ \t]{0,4}\/[ \t]{0,4}([A-Za-z0-9_-]+(?:[ \t]{0,4}\/[ \t]{0,4}[A-Za-z0-9_-]+)*)[ \t]{0,4}\/[ \t]{0,4}(Shared)?([A-Z][A-Za-z0-9_]*?)Screen/g

/** 形 3 的目录锚:只写到 features/<domain> 且**后面不接屏名**(接了就是形 1/形 2) */
const DIR_ONLY_RE = /packages\/app\/(?:src\/)?features\/([A-Za-z0-9_-]+)(?!\/[A-Za-z0-9_]*Screen)/g

/** 屏名素材:`Shared?Xxx…Screen`;组 1=Shared 前缀、组 2=主干 */
const SCREEN_TOKEN_RE = /\b(Shared)?([A-Z][A-Za-z0-9_]*?)Screen\b/g

/** 形 3/形 4 的动词闸(缺动词的行一律不认,防"标识符撞名"被读成对齐声明) */
const ALIGN_VERB_RE = /(对齐|镜像|参照|对标|还原|同形|唯一标准|视觉标准)/

function buildSharedIndex(shared) {
  const bySpec = new Set()
  const byDomName = new Map()
  const byName = new Map()
  for (const s of shared) {
    const base = s.spec.slice(0, -'.tsx'.length).split('/').pop()
    bySpec.add(s.spec)
    byDomName.set(`${s.domain}/${base}`, s.spec)
    if (!byName.has(base)) byName.set(base, [])
    byName.get(base).push(s.spec)
  }
  return { bySpec, byDomName, byName }
}

/** 名 → spec:`Shared` 前缀先剥再试(项目惯例:小程序注释里的 `Shared<X>Screen` 指的是
 *  共享层的 `<X>Screen`),两种写法都必须命中索引才算"在位";按域名解不到就退到全局唯一名,
 *  全局多解 ⇒ 歧义(记名不记 spec)。 */
function resolveSpec(idx, dom, tokenBase, prefixShared, ambiguous) {
  const cands = []
  if (prefixShared) cands.push(`${tokenBase}Screen`, `Shared${tokenBase}Screen`)
  else cands.push(`${tokenBase}Screen`)
  for (const c of cands) {
    if (dom && idx.byDomName.has(`${dom}/${c}`)) return idx.byDomName.get(`${dom}/${c}`)
  }
  for (const c of cands) {
    const hit = idx.byName.get(c)
    if (!hit) continue
    if (hit.length === 1) return hit[0]
    ambiguous.add(c)
  }
  return null
}

/** 一坨载体正文 → 声明了的共享屏集合(按形分桶,便于把"降幅来自哪一形"报数) */
function mirrorDeclarations(hay, idx) {
  const specs = new Set()
  const ambiguous = new Set()
  const forms = new Map()
  const put = (form, spec) => {
    if (!spec || !idx.bySpec.has(spec)) return
    specs.add(spec)
    if (!forms.has(form)) forms.set(form, new Set())
    forms.get(form).add(spec)
  }
  for (const m of hay.matchAll(MARK_RE)) put('形1-硬路径', resolveSpec(idx, m[1], m[2], false, ambiguous))
  for (const m of hay.matchAll(MARK_RE_LOOSE)) {
    const dom = m[1].replace(/\s+/g, '')
    put('形2-容错路径', resolveSpec(idx, dom, m[3], m[2] === 'Shared', ambiguous))
  }
  for (const line of hay.split('\n')) {
    const hasVerb = ALIGN_VERB_RE.test(line)
    const toks = [...line.matchAll(SCREEN_TOKEN_RE)]
    if (!hasVerb || toks.length === 0) continue
    for (const d of line.matchAll(DIR_ONLY_RE))
      for (const t of toks) put('形3-目录-only', resolveSpec(idx, d[1], t[2], t[1] === 'Shared', ambiguous))
    for (const t of toks) put('形4-动词+裸屏名', resolveSpec(idx, null, t[2], t[1] === 'Shared', ambiguous))
  }
  return { specs, forms, ambiguous }
}

/** 小程序页是否**硬路径**镜像了某共享屏 —— R1 登记表凭据(旧口径,不含新形) */
function mirroredSpecs(mp) {
  const found = new Set()
  const hay = `${mp.text || ''}\n${mp.cssText || ''}`
  for (const m of hay.matchAll(MARK_RE)) found.add(`${SHARED_DIR}/${m[1]}/${m[2]}Screen.tsx`)
  return found
}

/** 一个在册页的全部声明载体(页面文件 + 同目录伴生样式表)—— 两侧同宽的唯一载体清单 */
function carriersOf(p) {
  if (!p || !p.file) return []
  return [p.file, ...p.cssFiles]
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
    return gitRaw(['grep', '-n', '-E', pattern, 'HEAD', '--', pathspec], ROOT)
  } catch (e) {
    // §0.3:git grep 故障 = 取不到输入 ⇒ 显式未判定。旧写法 catch 返回 '' 会把 HEAD 锚点集
    // 读成空集 ⇒ lostMirrored/lostDelegated 全空 ⇒ 棘轮整体记绿 —— 那是"没判"冒充"判过"。
    throw new Undetermined(
      `gitGrep(${pattern}, ${pathspec}) 在 HEAD 面取不到锚点: ${e?.message ?? e}`,
    )
  }
}

/**
 * HEAD 面:小程序在册页显式声明镜像的共享屏集合(棘轮锚点)。
 * **与当前面同宽、同尺、同载体口径**(§0.4 + 识别器块头注):不再自跑一条内联正则,
 * 而是把 HEAD 面的在册页载体正文喂给同一个 `mirrorDeclarations()`,索引也取 HEAD 面的
 * 共享屏集 —— 当前面认得的形,锚点侧一律认得,反之不可能(旧实现两侧各写一条正则,
 * 锚点侧还要求 `.tsx` 后缀,已证为"不同宽"两型事故之源)。
 * 载体清单由调用方给(= HEAD 面在册页 ∪ 当前面在册页):只给当前面清单时,「整页删掉」
 * 会让那一页从清单消失、连带把它的声明从锚点抹掉 ⇒ 删页面反而免了倒退判定(旧注已证)。
 * 返回 {specs, readCount}:readCount=0 而清单非空 ⇒ 锚点取不到,由 run() 记未判定。
 */
function headMirroredSpecs(allowedCarriers, idx) {
  const out = new Set()
  const allow = new Set(allowedCarriers || [])
  if (allow.size === 0) return { specs: out, readCount: 0 }
  const index = idx || buildSharedIndex(collectShared('head'))
  let readCount = 0
  for (const rel of allow) {
    const t = faceRead('head', rel)
    if (t === null) continue // 该面没有这份件(合法:新增页 / 已删页在另一侧)
    readCount++
    for (const sp of mirrorDeclarations(t, index).specs) out.add(sp)
  }
  return { specs: out, readCount }
}

/**
 * HEAD 面:委托共享层(@ihui/rn-app)的 RN 屏文件路径集合。
 * 两侧口径必须一致:当前侧 nowDelegated 来自 collectRn 的 RN_SCREEN_RE —— 本侧若不筛
 * 同一把尺,`screens/tests/*.test.tsx` 这类伴生文件(正文带 `export type … from
 * '@ihui/rn-app'` 的类型面引用)会进 HEAD 锚点集、却永远进不了当前委托集 ⇒ R4 从该文件
 * 落地起恒红(实测 quick-notes-insert-wiring.test.ts)。R4 判的是「RN **屏**委托共享层」,
 * 两侧同取 `RN_SCREEN_RE` 才是同一把尺子(ec7a5ef870 已硬化,被 b966cb2167 洗回 `.tsx`,
 * 本票恢复)。
 */
function headDelegatedRn() {
  return new Set(
    gitGrep('@ihui/rn-app', RN_SCREENS)
      .split('\n')
      .map((l) => l.split(':')[1])
      .filter((f) => f && RN_SCREEN_RE.test(f)),
  )
}

function loadJson(p, fallback, face = FACE) {
  const txt = faceRead(face, p)
  if (txt === null) return fallback
  try {
    return JSON.parse(txt)
  } catch {
    return fallback
  }
}

function run() {
  const shared = collectShared()
  const rn = collectRn()
  const mp = collectMiniapp()
  // §0.3「枚举到 0 个候选判死,不得记绿」:三面任一枚在判定面上枚举为空 = 取材面残缺,
  // 而不是"这个仓没有共享屏"。HEAD 面实测 250/315/173,正常仓永远打不到这三条出口。
  if (shared.length === 0)
    throw new Undetermined(`${FACE_LABEL[FACE]} 上 ${SHARED_DIR} 枚举到 0 枚共享屏 ⇒ 判死不记绿`)
  if (rn.length === 0)
    throw new Undetermined(`${FACE_LABEL[FACE]} 上 ${RN_SCREENS} 枚举到 0 枚 RN 屏 ⇒ 判死不记绿`)
  if (mp.length === 0)
    throw new Undetermined(`${FACE_LABEL[FACE]} 上小程序在册页枚举到 0 页 ⇒ 判死不记绿`)
  const registry = loadJson(REGISTRY, { entries: [] })
  if (!Array.isArray(registry.entries))
    throw new Undetermined(`登记表 ${REGISTRY} 在 ${FACE_LABEL[FACE]} 面读不出 entries 数组 ⇒ R1 无输入`)
  if (registry.entries.length === 0)
    throw new Undetermined(
      `登记表 ${REGISTRY} 在 ${FACE_LABEL[FACE]} 面枚举到 0 条 ⇒ R1 判死不记绿(§0.3)`,
    )
  // 登记表里的 shared/rn 路径也要读(核验 R1)⇒ 同面一次性预取
  prefetchFace(
    FACE,
    (registry.entries || []).flatMap((e) => [e?.shared, e?.rn]).filter(Boolean),
  )

  // --- R2:共享屏 → RN 消费覆盖(只报数) ---
  const rnConsumed = new Set()
  for (const s of shared) if (rn.some((r) => rnConsumes(r, s.name))) rnConsumed.add(s.spec)

  // --- 小程序显式声明(宽尺 = 形1∪形2∪形3∪形4;R1 凭据仍是形1 硬路径) ---
  const idx = buildSharedIndex(shared)
  const mirrored = new Map() // spec -> [route](宽尺)
  const strictSpecs = new Set() // 旧尺认出的(仅供"降幅归因"报数,不参与判定)
  const formsAgg = new Map() // 形 -> Set(spec)(本面全部声明按形归堆)
  const ambiguousNames = new Set() // 形4 解到重名 ⇒ 不认,逐名点名
  const pageDecls = [] // 在册页逐页的识别结果(逐枚取证 --explain 的唯一底稿)
  for (const p of mp) {
    if (!p.file) continue
    const hay = `${p.text || ''}\n${p.cssText || ''}`
    const d = mirrorDeclarations(hay, idx)
    for (const n of d.ambiguous) ambiguousNames.add(n)
    for (const [f, s] of d.forms) {
      if (!formsAgg.has(f)) formsAgg.set(f, new Set())
      for (const x of s) formsAgg.get(f).add(x)
    }
    for (const s of d.specs) {
      if (!mirrored.has(s)) mirrored.set(s, [])
      mirrored.get(s).push(p.route)
    }
    for (const s of mirroredSpecs(p)) if (idx.bySpec.has(s)) strictSpecs.add(s)
    pageDecls.push({ route: p.route, file: p.file, hay, d })
  }

  // --- R1:登记表真实性 ---
  const r1Red = []
  for (const e of registry.entries || []) {
    const { shared: sp, rn: rf, miniapp: mr } = e || {}
    if (!sp || !rf || !mr) {
      r1Red.push({ entry: e, why: '登记项缺 shared/rn/miniapp 三键之一' })
      continue
    }
    if (faceRead(FACE, sp) === null) {
      r1Red.push({ entry: e, why: `共享屏不存在(${FACE} 面): ${sp}` })
      continue
    }
    if (faceRead(FACE, rf) === null) {
      r1Red.push({ entry: e, why: `RN 屏不存在(${FACE} 面): ${rf}` })
      continue
    }
    const mpEntry = mp.find((p) => p.route === mr)
    if (!mpEntry || !mpEntry.file) {
      r1Red.push({ entry: e, why: `小程序页不存在: ${mr}` })
      continue
    }
    if (!mirroredSpecs(mpEntry).has(sp)) {
      r1Red.push({ entry: e, why: `小程序页 ${mr} 缺「镜像 ${sp}」标记(标记是配对的唯一凭据)` })
    }
  }

  // --- R3/R4 棘轮 ---
  const nowMirrored = [...mirrored.keys()].sort()
  const nowDelegated = rn
    .filter((r) => /@ihui\/rn-app/.test(r.text || ''))
    .map((r) => r.file)
    .sort()
  // 只拦「本次改动把 HEAD 已有的倒退掉」:新增不拦(那是收口),存量不拦(§12e)。
  // 锚点宽度 = HEAD 面在册页载体 ∪ 当前面在册页载体(含伴生样式表):只用当前面的话,
  // 「把整页删掉」会让那一页从清单里消失,连带把它的镜像声明从锚点里抹掉 —— 删页面反而
  // 免了倒退判定。两侧同尺靠的是同一个 mirrorDeclarations(),不是两条长得像的正则。
  const headMp = collectMiniapp('head')
  const anchorWidth = new Set([...headMp, ...mp].flatMap(carriersOf))
  const anchor = headMirroredSpecs(anchorWidth, buildSharedIndex(collectShared('head')))
  if (anchorWidth.size > 0 && anchor.readCount === 0) {
    throw new Undetermined(
      `HEAD 面锚点载体 ${anchorWidth.size} 枚全部取不到正文 ⇒ 棘轮无输入,不折成空锚点冒绿(§0.3)`,
    )
  }
  const lostMirrored = [...anchor.specs].filter((x) => !nowMirrored.includes(x))
  const lostDelegated = [...headDelegatedRn()].filter((x) => !nowDelegated.includes(x))

  // --- 未判定桶逐类拆解(报数 + 逐枚取证;判定尺度一寸未动) ---
  const gainedByForm = new Map() // 形 -> [spec](只列旧尺认不出的那些)
  for (const [form, set] of formsAgg) {
    const fresh = [...set].filter((s) => !strictSpecs.has(s))
    if (fresh.length) gainedByForm.set(form, fresh.sort())
  }
  const gained = [...new Set([...gainedByForm.values()].flat())].sort()
  const notMirrored = shared.filter((s) => !mirrored.has(s.spec))

  // 桶口径(2026-10-27 本票定档,把旧那一句"未判定 158"拆成三种**不同性质**的结论):
  //   桶 U 真·未判定 = 判定面残缺(取不到输入)⇒ 由 Undetermined/exit 2 承担,正常跑完必为 0;
  //                  旧实现把"判据认不出该形"也塞进这一桶,这正是本票要收的假警报。
  //   桶 S 判为「无声明」= 在册页 + 伴生样式表(声明载体)全文按四形扫过、零命中,
  //                  且小程序整面也扫不到该屏名 ⇒ 这是一次**完成的判定**(结论:没镜像),
  //                  不是"没判";只报数不判红(补页是功能活,§12e 不许把存量升成门)。
  //   桶 M 判为「有提及未成凭据」= 整面扫到屏名、但在载体里没构成四形之一(缺动词 / 写在
  //                  未注册页或组件里)⇒ 同样判过,结论是"凭据不足";逐枚可查(--explain)。
  //   桶 A 名称歧义 = 裸屏名解到 ≥2 枚在位共享屏 ⇒ **不认**(尺子不猜),逐名点名。
  const CARRIER_EXT_RE = /\.(tsx|ts|jsx|js|css|scss|less|wxss|md)$/
  const mpAll = faceList(FACE, MP_SRC).filter((f) => CARRIER_EXT_RE.test(f))
  const carrierSet = new Set(mp.flatMap(carriersOf))
  const offCarrier = mpAll.filter((f) => !carrierSet.has(f))
  prefetchFace(FACE, offCarrier)
  const unreadableOff = offCarrier.filter((f) => faceRead(FACE, f) === null)
  // 一坨整面正文 + 一屏一条 `\b` 尺(载体与射程外同一把提名词):防 `PointHistoryScreen`
  // 被子串匹配成 `HistoryScreen` 而误报"有提及" —— 两桶语义必须同词边界。
  const offBlob = offCarrier.map((f) => faceRead(FACE, f) || '').join('\n')
  const carrierBlob = pageDecls.map((pd) => pd.hay).join('\n')
  const mentions = (base) => {
    const re = new RegExp(`\\b${base}\\b`)
    return re.test(carrierBlob) || re.test(offBlob)
  }
  const bucket = { S: [], M: [], A: [], U: [] }
  for (const s of notMirrored) {
    const base = s.spec.slice(0, -'.tsx'.length).split('/').pop()
    if (ambiguousNames.has(base)) bucket.A.push(s.spec)
    else if (mentions(base)) bucket.M.push(s.spec)
    // 整面零提及,但射程外还有取不到正文的文件 ⇒ "零提及"这个结论没判满,记未判定不记绿
    else if (unreadableOff.length > 0)
      bucket.U.push(`${s.spec}(射程外 ${unreadableOff.length} 枚文件取不到正文,举证不全)`)
    else bucket.S.push(s.spec)
  }

  const explainBySpec = new Map()
  for (const pd of pageDecls) {
    for (const [form, set] of pd.d.forms) {
      for (const sp of set) {
        if (strictSpecs.has(sp)) continue
        if (!explainBySpec.has(sp)) explainBySpec.set(sp, [])
        const line = pd.hay.split('\n').find((l) => mirrorDeclarations(l, idx).specs.has(sp))
        explainBySpec.get(sp).push({ form, route: pd.route, file: pd.file, line: (line || '').trim().slice(0, 140) })
      }
    }
  }

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
    undeterminedMiniapp: bucket.U.length,
    noDeclaration: bucket.S.length,
    mentionNoCredential: bucket.M.length,
    ambiguousName: bucket.A.length,
    carrierFilesScanned: carrierSet.size,
    offCarrierFilesScanned: offCarrier.length,
    offCarrierUnreadable: unreadableOff.length,
    recognizedByNewForms: gained.length,
    recognizedByForm: Object.fromEntries(
      [...gainedByForm.entries()].map(([f, list]) => [f, [...new Set(list)].sort()]),
    ),
    strictOnlyCount: strictSpecs.size,
    anchorReadCount: anchor.readCount,
    anchorWidthCount: anchorWidth.size,
  }

  const red = []
  for (const x of r1Red) red.push({ rule: 'R1', ...x })
  for (const x of lostMirrored) red.push({ rule: 'R3', why: `共享屏的小程序镜像被撤: ${x}` })
  for (const x of lostDelegated) red.push({ rule: 'R4', why: `RN 屏不再委托共享层: ${x}` })

  if (explainMode) {
    const rows = [...explainBySpec.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    console.log(
      JSON.stringify(
        { face: FACE, 新形认出枚数: gained.length, 逐枚取证: rows.map(([spec, why]) => ({ spec, why })) },
        null,
        2,
      ),
    )
    return red.length === 0 ? 0 : 1
  }

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          stats,
          red,
          mirrored: nowMirrored,
          notMirrored: notMirrored.map((s) => s.spec),
          buckets: {
            判为无声明: bucket.S.sort(),
            提及未成凭据: bucket.M.sort(),
            名称歧义: bucket.A.sort(),
            真未判定: bucket.U.sort(),
          },
          recognizedByNewForms: gained,
        },
        null,
        2,
      ),
    )
  } else {
    log(`判定面                  : ${stats.faceLabel}`)
    log(`共享屏(真相源)          : ${stats.sharedTotal}`)
    log(
      `RN 屏                   : ${stats.rnScreensTotal}(委托共享层 ${stats.rnDelegatedScreens},${(stats.rnDelegatedRatio * 100).toFixed(1)}%)`,
    )
    log(
      `小程序页                : ${stats.miniappPagesTotal}(有文件 ${stats.miniappPagesWithFile},声明载体 ${stats.carrierFilesScanned} 枚 + 射程外备查 ${stats.offCarrierFilesScanned} 枚)`,
    )
    log(`共享屏被 RN 消费        : ${stats.rnConsumedShared}/${stats.sharedTotal}`)
    log(
      `共享屏被小程序显式镜像  : ${stats.mirroredShared}/${stats.sharedTotal}(旧硬路径尺只认 ${stats.strictOnlyCount})`,
    )
    log(
      `未判定(判定面残缺)      : ${stats.undeterminedMiniapp}${stats.undeterminedMiniapp ? ' ⇒ 不记绿也不冒红,逐枚见 --json 的「真未判定」' : ''}`,
    )
    log(
      `判为无声明(缺口候选)    : ${stats.noDeclaration} / 提及未成凭据 ${stats.mentionNoCredential} / 名称歧义 ${stats.ambiguousName}`,
    )
    log(
      `新检测形认出(从未判定转入判定面): ${stats.recognizedByNewForms} —— ${Object.entries(stats.recognizedByForm).map(([f, l]) => `${f} ${l.length}`).join(' / ') || '无'}`,
    )
    log(`登记表条目              : ${stats.registryEntries}`)
    if (red.length) {
      log('')
      for (const r of red) log(`❌ [${r.rule}] ${r.why}`)
      log(`\n❌ 结论:跨端页面覆盖对账判红 ${red.length} 处`)
    } else if (stats.undeterminedMiniapp) {
      log(`\n⚠️ 结论:无倒退,但 ${stats.undeterminedMiniapp} 枚举证不全(未判定,不等于判过)`)
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
  cases.push({
    name: 'A4 小程序页至少一页有对应文件',
    pass: mp.some((p) => p.file),
    got: mp.filter((p) => p.file).length,
  })
  // 正反例:镜像标记识别器对确定形态必须命中 / 对空串必须零命中
  const probe = { text: '// 镜像 packages/app/src/features/activity/ActivityScreen', cssText: '' }
  cases.push({
    name: 'A5 镜像标记识别(正面)',
    pass: mirroredSpecs(probe).has(`${SHARED_DIR}/activity/ActivityScreen.tsx`),
    got: [...mirroredSpecs(probe)],
  })
  cases.push({
    name: 'A6 镜像标记识别(反面:无关文本)',
    pass: mirroredSpecs({ text: 'nothing here', cssText: '' }).size === 0,
    got: 0,
  })
  cases.push({
    name: 'A7 RN 消费判定(正面)',
    pass: rnConsumes({ text: "import { ActivityScreen } from '@ihui/rn-app'" }, 'ActivityScreen'),
    got: true,
  })
  cases.push({
    name: 'A8 RN 消费判定(反面:无 rn-app 引用)',
    pass: !rnConsumes({ text: 'const ActivityScreen = 1' }, 'ActivityScreen'),
    got: false,
  })
  const hm = headMirroredSpecs(mp.flatMap(carriersOf)).specs
  cases.push({ name: 'A9 棘轮锚点=HEAD 面:已镜像集合可算且非空', pass: hm.size > 0, got: hm.size })
  const hd = headDelegatedRn()
  cases.push({
    name: 'A10 棘轮锚点=HEAD 面:RN 下沉集合可算且非空',
    pass: hd.size > 0,
    got: hd.size,
  })
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
    got: ['head', 'staged', 'worktree']
      .map((f) => `${f}:${(faceRead(f, MP_CONFIG) || '').length}`)
      .join(' '),
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
    pass: ![{ spec: `${SHARED_DIR}/__nope__/NopeScreen.tsx` }].every(
      (s) => faceRead('head', s.spec) !== null,
    ),
    got: false,
  })

  /* ---- N 组(2026-10-27 本票):补检测形的成对夹具。
   * 夹具索引全合成(不依赖仓内存量),这样"摘掉即翻红"才只由判据决定;
   * N11/N12 再拿 HEAD 面真实在册页做阳性对照,防"造好没装车"。 */
  const FIX = buildSharedIndex([
    { spec: `${SHARED_DIR}/demo/DemoScreen.tsx`, domain: 'demo', name: 'DemoScreen' },
    { spec: `${SHARED_DIR}/tools/pdf/PdfHubScreen.tsx`, domain: 'tools/pdf', name: 'PdfHubScreen' },
    { spec: `${SHARED_DIR}/dup/AScreen.tsx`, domain: 'dup', name: 'AScreen' },
    { spec: `${SHARED_DIR}/dup2/AScreen.tsx`, domain: 'dup2', name: 'AScreen' },
  ])
  const D = (hay) => mirrorDeclarations(hay, FIX)
  const OLD = (hay) => {
    const out = new Set()
    for (const m of hay.matchAll(MARK_RE)) out.add(`${SHARED_DIR}/${m[1]}/${m[2]}Screen.tsx`)
    return out
  }
  const t3 = '/* 对齐 RN SharedDemoScreen(packages/app/src/features/demo):RN raw dp × 2 = rpx */'
  const t4a = '// 状态徽章色(对齐 RN SharedDemoScreen statusColors:浅底深字 token)'
  const t4b = '/* 页面根背景对齐 RN DemoScreen container:tk.surface.bg */'
  const t2 = '/* 业务卡下沉 packages/app\n   features/tools/pdf/PdfHubScreen.tsx;交互保留 */'
  cases.push({
    name: 'N1 形3 目录-only + 同行屏名 ⇒ 认出(旧硬路径尺认不出)',
    pass: D(t3).specs.has(`${SHARED_DIR}/demo/DemoScreen.tsx`) && OLD(t3).size === 0,
    got: [...D(t3).specs],
  })
  cases.push({
    name: 'N2 形4 对齐动词 + Shared 前缀裸屏名 ⇒ 认出(旧尺认不出)',
    pass: D(t4a).specs.has(`${SHARED_DIR}/demo/DemoScreen.tsx`) && OLD(t4a).size === 0,
    got: [...D(t4a).specs],
  })
  cases.push({
    name: 'N3 形4 对齐动词 + 裸屏名 ⇒ 认出(旧尺认不出)',
    pass: D(t4b).specs.has(`${SHARED_DIR}/demo/DemoScreen.tsx`) && OLD(t4b).size === 0,
    got: [...D(t4b).specs],
  })
  cases.push({
    name: 'N4 反向对照(摘掉即翻红):同一批文本退回旧尺 ⇒ 四形全部零命中',
    pass: [t3, t4a, t4b, t2].every((hay) => OLD(hay).size === 0) && [t3, t4a, t4b, t2].every((hay) => D(hay).specs.size === 1),
    got: [t3, t4a, t4b, t2].map((hay) => `旧${OLD(hay).size}/新${D(hay).specs.size}`).join(' '),
  })
  cases.push({
    name: 'N5 形2 容错路径(注释断行 + 省 src + 多级目录)⇒ 认出(旧尺认不出)',
    pass: D(t2).specs.has(`${SHARED_DIR}/tools/pdf/PdfHubScreen.tsx`) && OLD(t2).size === 0,
    got: [...D(t2).specs],
  })
  cases.push({
    name: 'N6 尺未放宽①:屏名在位但同行无对齐动词 ⇒ 不认(代码标识符不算凭据)',
    pass: D('const DemoScreen = 1\nexport { DemoScreen }').specs.size === 0,
    got: 0,
  })
  cases.push({
    name: 'N6b 尺未放宽②:有动词但 spec 不在索引(定义不在位)⇒ 不认',
    pass: D('/* 对齐 RN GhostScreen 视觉 */').specs.size === 0,
    got: 0,
  })
  cases.push({
    name: 'N6c 尺未放宽③:裸屏名解到重名(歧义)⇒ 不认且逐名点名',
    pass:
      D('/* 顶部标题区(对齐 RN AScreen header) */').specs.size === 0 &&
      D('/* 顶部标题区(对齐 RN AScreen header) */').ambiguous.has('AScreen'),
    got: [...D('/* 顶部标题区(对齐 RN AScreen header) */').ambiguous],
  })
  cases.push({
    name: 'N7 真缺失仍判缺失:硬路径指向不在位件 ⇒ 宽尺不认(旧尺会认 ⇒ 这一格是收紧)',
    pass:
      OLD(`// 镜像 ${SHARED_DIR}/gone/GoneScreen.tsx`).size === 1 &&
      D(`// 镜像 ${SHARED_DIR}/gone/GoneScreen.tsx`).specs.size === 0,
    got: { 旧尺: OLD(`// 镜像 ${SHARED_DIR}/gone/GoneScreen.tsx`).size, 新尺: D(`// 镜像 ${SHARED_DIR}/gone/GoneScreen.tsx`).specs.size },
  })
  cases.push({
    name: 'N8 两侧同尺结构锁:锚点侧函数体内不得再出现内联 features 正则',
    pass:
      !/packages\\?\/app/.test(headMirroredSpecs.toString()) &&
      /mirrorDeclarations\(/.test(headMirroredSpecs.toString()),
    got: headMirroredSpecs.toString().includes('mirrorDeclarations'),
  })
  const headIdx = buildSharedIndex(collectShared('head'))
  const wideReal = new Set()
  const strictReal = new Set()
  for (const p of collectMiniapp('head')) {
    if (!p.file) continue
    for (const s of mirrorDeclarations(`${p.text || ''}\n${p.cssText || ''}`, headIdx).specs)
      wideReal.add(s)
    for (const s of mirroredSpecs(p)) if (headIdx.bySpec.has(s)) strictReal.add(s)
  }
  const gainedReal = [...wideReal].filter((s) => !strictReal.has(s))
  cases.push({
    // 只报数,不判红(§12e)。判据活性不由这一格证明:N1–N7 已用全合成夹具 FIX 成对证明四形各自
    // 认出、且 N4 是「退回旧尺即零命中」的摘掉即翻红反控,N11 已管住「宽尺 ⊇ 旧尺」的结构不变量。
    // 这一格钉的是「仓里存在一枚只有裸名凭据、别处无硬路径的屏」——那是**存量读数**,与 R3 镜像
    // 棘轮的成功条件互斥:账收得越干净,每枚屏越会有硬路径 ⇒ 净增必然趋零。拿它判红就是造一道
    // 与任何提交都无关、且**永远不会随账还清而自愈**的恒红门(同型判据见
    // check-selftest-registrant-evaluates.mjs:31-40 的成文理由)。失效方向:读数照常打印,看得见。
    name: 'N9 本面净增枚数(只报数;判据活性由 N1–N7 构造面 + N11 结构锁证明)',
    pass: true,
    got: `${gainedReal.length} 枚(宽尺 ${wideReal.size} / 旧尺 ${strictReal.size})`,
  })
  cases.push({
    name: 'N10 新认出的每一枚都能在同面读出正文(判的是符号在位,不是名字对上了)',
    pass: gainedReal.every((s) => typeof faceRead('head', s) === 'string'),
    got: gainedReal.length,
  })
  cases.push({
    name: 'N11 检测形不得把任何"旧尺已认"的枚数弄丢(宽尺 ⊇ 旧尺,只增不减)',
    pass: [...strictReal].every((s) => wideReal.has(s)),
    got: `旧尺 ${strictReal.size} 枚全在宽尺内`,
  })
  let bad = 0
  for (const c of cases) {
    if (!c.pass) bad++
    console.log(
      `${c.pass ? '✓' : '✗'} ${c.name}${c.got !== undefined ? ` — ${JSON.stringify(c.got)}` : ''}`,
    )
  }
  console.log(`\n自检 ${cases.length} 例,失败 ${bad}`)
  return bad === 0 ? 0 : 1
}

/* §22d:直执行才跑主流程 —— 否则测试一 import __test__ 就触发判定并 process.exit,把用例进程带走 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

/** §22c:判据单一出口 —— 取证测试 import 这份,禁止在测试里另抄一份面读取器/检测形正则 */
export const __test__ = {
  faceRead,
  faceList,
  collectShared,
  collectRn,
  collectMiniapp,
  mirroredSpecs,
  mirrorDeclarations,
  buildSharedIndex,
  carriersOf,
  sidecarCssPaths,
  rnConsumes,
  headMirroredSpecs,
  headDelegatedRn,
  FACE,
  MARK_RE,
  MARK_RE_LOOSE,
  DIR_ONLY_RE,
  SCREEN_TOKEN_RE,
  ALIGN_VERB_RE,
  RN_SCREEN_RE,
  SHARED_DIR,
  MP_SRC,
}

/** §0.3 统一出口:取数失败(Undetermined)⇒ exit 2 显式「未判定」并点名原因,不冒绿也不冒红。 */
function exitUndetermined(e) {
  console.error(`❌ 未判定: ${e?.message ?? e}(取不到输入不记绿也不冒红,§0.3)`)
  process.exit(2)
}

if (isDirectRun) {
  if (selfTest) {
    try {
      process.exit(selfTestFn())
    } catch (e) {
      if (e instanceof Undetermined) exitUndetermined(e)
      throw e
    }
  }
  try {
    process.exit(run())
  } catch (e) {
    if (e instanceof Undetermined) exitUndetermined(e)
    throw e
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
