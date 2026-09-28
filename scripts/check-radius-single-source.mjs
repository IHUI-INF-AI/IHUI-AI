#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 圆角单一源头守门(全 8 端)。
 *
 * 堵的是两类静默漂移:
 *  A. 表漂移 —— radius.js(唯一真相源)/ tokens.css --radius-* / miniapp-taro app.css --radius-* /
 *     tailwind-preset.js 四处档位值不一致(历史上 v3 preset 的 rounded-sm=2px 与 web v4 的 sm=4px
 *     同名不同值,正是"手机上圆角和全局设定不统一"的根因之一)。
 *  B. 取用漂移 —— 端内写死数字/偏档值,绕开档位表(RN StyleSheet 数字、CSS px/rpx 字面量、
 *     rounded-[任意值]、每文件自定 *_RADIUS 常量)。全仓实测曾达 1292 处 RN 数字 + 509 处 taro
 *     任意值 + 495 处 CSS 字面量,档位形同虚设。
 *
 * 判据:
 *  A 任一档值不一致或 preset 重新内联字面量表 → 红(恒扫,不受 --staged 影响)。
 *  B1 TS/TSX `border(Top|Bottom)?(Left|Right)?Radius: <数字|rpx(N)>` → 必须写 rnRadius.<step>
 *  B2 TS/TSX 本地 `const *RADIUS* = <数字>` → 必须引用档位
 *  B3 CSS/SCSS/HTML `border-radius: <px|rpx|rem 字面量>` → 必须写 var(--radius-*)
 *     **逐值判**:多值声明(`border-radius: var(--radius-xl) 24rpx 0 0`)里每个角都要自己合规,
 *     旧写法"值里出现 var( 就整条放行"会让这类混写整条隐身;任意属性形态 `[border-radius:6rpx]`
 *     (Tailwind/小程序 className)同样在射程内。
 *  B4 `rounded-[...]` 任意值 → 必须换档位类(或 var(--radius-*))
 *     唯一放行:`0` / `none` / `inherit` / **可证的几何真圆**(见 `circleVerdict` 与
 *     `lib/box-geometry.mjs` 的 `isGeometricCircle` / `isHalfOfDeclaredSide`)。
 *     ⚠️ 2026-09-28 起 `radius-exempt` 标记**不再是任何一判据的出口**(用户定档:"不允许有任何豁免")。
 *     原先它把"真圆/头像/装饰点/胶囊"一律交给人写一句话放行,而"胶囊"恰是项目明令禁止的形状 ——
 *     于是标记既当豁免又当掩盖,而门从不量形状。现在形状由盒尺寸量出来:正方+半边=几何(放行),
 *     非正方+半边=胶囊(判红,不吃标记),量不出=判不出(判红,出路是把尺寸写进同一作用域)。
 *  B5 SVG `rx`/`ry`:静态 .svg 须等于档位值(没有 JS 通道),JSX 内联须引用 rnRadius.<step>。
 *  B6 引用了 `rnRadius` / `RADIUS_CSS_PX` 却没在本文件 import 它们 → 红。
 *     本门判的是 HEAD 内容,而 `pnpm typecheck` 只跑 worktree —— 悬空标识符属于"两边都不红"
 *     的那一类(前向移植 / 批量改写的典型遗留),只能在读 HEAD blob 的这里补上。
 *     import 常写成多行,必须在整条 `{…}` 括号里找名字。
 *  B8 豁免标记族**本身**(那个带冒号的指令形态)→ 红。通道废除靠两半:"写了也没用"由判序保证
 *     (本门与门 150 都不再按标记放行),"写了就红"就是这一条 —— 只拆出口不拦回写,下一个人挂一行
 *     标记就等于把那条通道悄悄接回来(票㉜ 把存量摘到 0 之后,HEAD 上又长出过 2 处,是实测不是假想)。
 *     识别式与门 150 的报名共用 `lib/radius-exempt-marker.mjs` 那一份;判它必须看**原文行** ——
 *     标记活在注释里,而本门逐行的第一步就是把整行注释直接 return。散文提这个族名不带冒号,
 *     因此不会被自己判红(判据不能吃自己的说明文字)。
 *  B 走 **HEAD 锚点棘轮**:每文件容忍上限 = 该文件 HEAD 版本自身的违规数(全量审计时上限只来自
 *    人工基线,因为内容就是 HEAD)。只拦"这次改动把绕档加回来了",不拦仓库既有债。
 *    锚点原先是一份手工维护的 JSON 清单,它有两个致命伤:并行会话把已迁好的路径整文件回写成
 *    旧基线时它照样绿(实测 HEAD 曾因此积累 1179 处),而工作区滞后的旧草稿又会被它误记成本仓债务。
 *    scripts/radius-single-source-baseline.json 保留为人工兜底(现应为空)。
 *
 * 取材纪律(2026-09-26 收口,门 118):判定面的 **blob 正文**一律经
 *   `scripts/lib/face-reader.mjs` 的 `catBatch` **一次批量预取**再逐路径读 map ——
 *   与守门 36/93/124/13c 同口径。兜住五件各门自己写必错的事(git 绝对路径、batch 的
 *   stdio[0]=pipe、一次派生读一批而非 fork 风暴、junction 穿根比较、maxBuffer 给足)。
 *   只做**路径枚举/存在性**的调用(`ls-files` / `diff --name-only` / `rev-parse --show-toplevel`)
 *   不读 blob、层无对应出口,**留原样** —— 把它们算成"读内容"并硬改是本仓登记过的假阳型。
 *   语义未动:全量档仍判 HEAD blob(棘轮锚点也恒取 HEAD),--staged/--files 仍取工作树。
 *
 * 用法:
 *   node scripts/check-radius-single-source.mjs              # 全量审计(基线外新增即红)
 *   node scripts/check-radius-single-source.mjs --staged     # pre-commit:只扫暂存文件
 *   node scripts/check-radius-single-source.mjs --self-test  # 判据正反例取证
 *   node scripts/check-radius-single-source.mjs --update-baseline  # 清理后下调基线(须人工确认)
 *
 * 退出码(与守门 94/99/101 同口径):
 *   0 = 判据执行且通过;1 = 判据执行且发现红线;2 = **无法判定**(取材面失效:本检出无 .git 而 git
 *   向上逃逸到外层仓、跟踪清单解析失败或"退出码 0 但 0 条"的空扫)—— 空扫绝不记绿。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

import { catBatch, Undetermined } from './lib/face-reader.mjs'
import { objectDims, boxDims, scopeDimTexts, isHalfOfDeclaredSide, classifyRadiusGeometry } from './lib/box-geometry.mjs'
import { RADIUS_EXEMPT_MARKER_RE } from './lib/radius-exempt-marker.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_FILE = join(ROOT, 'scripts/radius-single-source-baseline.json')
const isStaged = process.argv.includes('--staged')
/** 显式文件清单模式:供迁移执行者按文件自验,判据与全量/暂存模式完全同源 */
const FILES_MODE = process.argv.includes('--files')
const fileList = FILES_MODE ? process.argv.slice(process.argv.indexOf('--files') + 1).filter((a) => !a.startsWith('--')) : []
const SELF_TEST = process.argv.includes('--self-test')
const UPDATE_BASELINE = process.argv.includes('--update-baseline')

/** 扫描范围:每端源码目录 */
const SCAN_DIRS = [
  'apps/web/app',
  'apps/web/src',
  'apps/miniapp-taro/src',
  'apps/mobile-rn/app',
  'apps/mobile-rn/src',
  'apps/mobile-rn/components',
  'packages/app/src',
  'packages/ui-react/src',
  'packages/ui-native/src',
  'packages/shared/src',
  'apps/extension/src',
  'apps/extension/entrypoints',
  'apps/desktop/src-tauri/offline',
  'apps/cli/src',
  // api 端不渲染 UI,但 swagger-theme 会**生成 HTML/CSS**(B3 覆盖),一并纳入对账
  'apps/api/src',
]
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'android', 'ios', '.expo', 'coverage', '.output', 'web-build', '__tests__', 'tests', 'e2e', 'test'])
/** 档位表自身的定义处(tokens.css / app.css 的 --radius-* 行)不参与 B3 判定 */
const TABLE_FILES = /styles[\\/]tokens\.css$/

function loadTable() {
  // radius.js 是 ESM;用 import() 取真实档位表(守门不复制常量,否则守门自己就成了第二份真相)
  // Windows 下绝对路径必须经 pathToFileURL,否则 ERR_UNSUPPORTED_ESM_URL_SCHEME(协议 'd:')
  return import(pathToFileURL(join(ROOT, 'packages/design-tokens/src/radius.js')).href)
}

/**
 * 只读 git 调用:一律带 timeout(守门 80)+ windowsHide(守门 52)。
 * 共享工作区里 git 挂起过 80 分钟(CPU 仅 2.84s),钩子链上没有超时等于没有交付。
 */
function gitRo(args) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1 << 28,
    timeout: 60000,
  })
}

/** 一份 git 文件清单(路径统一正斜杠);取不到返回 null,调用方按"无法收窄"处理而非静默放行 */
function gitNameSet(args) {
  try {
    return new Set(gitRo(args).split('\n').filter(Boolean).map((l) => l.replaceAll('\\', '/')))
  } catch {
    return null
  }
}

/**
 * 仓库活性判定:跟踪清单只有在"git 上下文确实指向本检出"时才可信。
 * 隔离检出(本目录无 .git、但某个祖先是 git 仓)会让 git **向上逃逸**到外层仓:
 * 从该 cwd 执行 `git ls-files` 返回的是「退出码 0 + 空清单」而非报错(外层仓在本路径下
 * 没有跟踪文件),于是 auditHead 的棘轮过滤把 6000+ 候选整批滤成 0,判据 C 同样拿到空清单
 * ——整道门一条判据都没执行,却打印「✅ 圆角单一源头对账通过」并以 0 退出(2026-09-25 实测)。
 * 口径对齐守门 78/94/99/101:toplevel 不匹配 / 清单取不到 / 空扫 ⇒ **exit 2 显式"无法判定"**,
 * 绝不冒烟成判据红,也绝不记绿。
 */
function resolveGitContext() {
  let top
  try {
    top = gitRo(['rev-parse', '--show-toplevel']).trim()
  } catch (e) {
    return { ok: false, reason: `git rev-parse --show-toplevel 未能执行:${String(e?.stderr || e?.message || e).split('\n')[0]}` }
  }
  if (!top) return { ok: false, reason: 'git rev-parse --show-toplevel 返回空输出' }
  const norm = (p) => p.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase()
  if (norm(top) !== norm(ROOT)) {
    return { ok: false, reason: `git 上下文指向 ${top},不是本门 ROOT(${ROOT})—— 本检出没有自己的 .git,跟踪清单会被读成外层仓库的口径` }
  }
  return { ok: true }
}

function* walk(dir) {
  let es
  try {
    es = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of es) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(p)
    } else yield p
  }
}

const STAGED_SET = (() => {
  if (!isStaged) return null
  try {
    return new Set(
      execFileSync(process.execPath === '' ? 'git' : 'git', ['diff', '--cached', '--name-only'], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
        .split('\n')
        .filter(Boolean)
        .map((f) => f.replaceAll('\\', '/')),
    )
  } catch {
    return null
  }
})()

const isCss = (f) => /\.(css|scss|less)$/.test(f)
const isJsx = (f) => /\.(tsx|jsx|ts)$/.test(f) && !/\.d\.ts$/.test(f)
/** .svg 不再整体跳过:SVG 的 rx/ry 会产生圆角(B5 管它) */
const isDoc = (f) => /\.(md|json|snap)$/.test(f)

/** 生成"应写成什么"的提示(档位名唯一来源仍是 table,守门不复制表) */
function targetOf(table, px) {
  const step = table.stepOf(px)
  if (step === null) return `档位表无 ${px}px(就近 ${table.nearest(px)};几何真圆请写成与边长同形的 <边长> / 2 或 50%)`
  return step === '2xl' ? "rnRadius['2xl']" : `rnRadius.${step}`
}
const skipped = (rel) => rel.split('/').some((seg) => SKIP_DIRS.has(seg)) || /\.(test|spec)\.[jt]sx?$/.test(rel)

/**
 * 判据 C:覆盖面对账 —— 「我没扫到」与「我声明过不扫」必须可区分。
 *
 * 全仓任何含圆角取用的跟踪文件,只有两种合法归宿:
 *   ① 落在 SCAN_DIRS(受 B 判据约束);
 *   ② 落在下面的 OUT_OF_SCOPE,并写明**为什么不适用**。
 * 落进第三类(新端、新目录、改名)即红。没有这一条,加一个新前端就等于悄悄绕开整道门 ——
 * 本次改造最初就是靠人工全仓扫描才发现 ai-service / 美术 svg 这些守门视野外的角落。
 */
export const OUT_OF_SCOPE = [
  {
    re: /(^|\/)(assets|public|static)\//,
    why: '静态美术资产:svg/图片里的 rx/ry 是图形轮廓本身,不是 UI 容器圆角,方档化等于改美术',
    // bExempt = 这条声明同时把文件**从 B 判据里摘出去**。过去只有判据 C 认这张表,而 B 照扫 ——
    // 于是 vendored .svg 与 lucide 字形数据被迫挂满 `radius-exempt` 标记,去平息一道自己
    // 已经声明过"不适用"的门。声明式范围必须两半同形,否则"范围外"只是台账上一句空话。
    // ⚠️ 这里刻意写成**扩展名**而不是 `true`:目录名叫 assets/public/static 的树里也可能长出
    // 真正的界面代码(实测 HEAD 面那 5 个 .tsx/.css/.js 就是),整目录摘出去等于给未来开一个
    // 静默逃逸的口 —— 范围只按"这条声明说的是什么东西"生效。
    bExempt: /\.(svg|png|jpe?g|webp|gif|ico)$/i,
  },
  {
    re: /^apps\/miniapp-taro\/src\/components\/LineIcon\/icons\.ts$/,
    why: '第三方 lucide 字形数据(rx/ry 是 24 格 viewBox 单位,吸附档位会改坏图标形状;来源归属见守门 107 第三方台账)',
    bExempt: true,
  },
  {
    re: /^apps\/miniapp-taro\/scripts\/gen-line-icons\.mjs$/,
    why: '上面那份字形数据的生成器(写入的是 lucide 原始 path 文本,不是本仓 UI 的圆角取用)',
    bExempt: true,
  },
  { re: /^packages\/design-tokens\//, why: '档位表自身(radius.js / tailwind-preset / tokens.css),由 A 判据负责其一致性' },
  {
    re: /^apps\/ai-service\//,
    why: '内容渲染分支:发布到第三方平台的文章 HTML 属内容产物(同 §4「文档/营销正文」豁免口径),不是应用界面',
  },
  { re: /^docs\//, why: '文档产物 HTML,非应用界面' },
  { re: /(^|\/)scripts\/gen_[^/]*\.(py|mjs)$/, why: '开发期报告生成器产物模板,非应用界面' },
]

const RADIUS_TOKEN_RE = /(border(?:-top|-bottom)?(?:-left|-right)?-radius|borderRadius|\brounded-\[|\b(?:rx|ry)\s*[=:])/

/**
 * B7 的方向词表:`rounded-t` / `rounded-tr-sm` 这类"只写方向"或"方向+档位"都是合法类名。
 * 档位名**不写在这里** —— 见 scanText 里的 `classStepNames`(从 radius.js 的表现取,
 * 抄一份固定名单就是第二份真相:表改档时 B7 会拿旧名单判新代码)。
 */
const CLASS_DIR_NAMES = new Set(['t', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br', 'ss', 'se', 'es', 'ee', 's', 'e'])

/**
 * 判据 C 的"范围外"声明里带 `bExempt` 的那些,**同时把文件从 B 的取材清单摘出去**。
 * 过去只有 C 认这张表,B 照扫不误 —— 于是 vendored .svg 与 lucide 字形数据只能靠挂
 * `radius-exempt` 标记去平息一道自己已经声明过"不适用"的门(实测 24 处标记就是这么来的)。
 * 数量在结论行如实打印:摘出去多少必须报名,不得让"少扫了文件"读成"没有违规"。
 */
const B_EXEMPT = OUT_OF_SCOPE.filter((o) => o.bExempt)
const isBExcluded = (rel) => B_EXEMPT.some((o) => o.re.test(rel) && (o.bExempt === true || o.bExempt.test(rel)))

/** 纯函数(便于自检注入文件清单):返回 { red:[{file,why}], exempt:[{file,category}] } */
export function coverageAudit(trackedFiles, readFile) {
  const red = []
  const exempt = []
  for (const f of trackedFiles.map((x) => x.replaceAll('\\', '/'))) {
    if (skipped(f) || isDoc(f) || /\.(d\.ts|snap|svg\.d\.ts)$/.test(f)) continue
    // .py 必须一并枚举:ai-service 的发布 HTML 渲染器就写在 Python 里,
    // 不枚举就等于让「内容渲染分支」这条豁免形同虚设(靠漏掉而不是靠声明)
    if (!/\.(tsx|jsx|ts|js|css|scss|less|html|svg|py)$/.test(f)) continue
    if (SCAN_DIRS.some((d) => f.startsWith(d + '/'))) continue // ① 已受 B 判据覆盖
    let text = ''
    try {
      text = readFile(f)
    } catch {
      continue
    }
    if (!text.split('\n').some((l) => RADIUS_TOKEN_RE.test(l) && !/^\s*(\/\/|\*|#|<!--)/.test(l.trim()))) continue
    const hit = OUT_OF_SCOPE.find((o) => o.re.test(f))
    if (hit) exempt.push({ file: f, category: hit.why })
    else red.push({ file: f, why: '既不在 SCAN_DIRS 覆盖内,也未声明为范围外 —— 新增端/目录静默绕开门' })
  }
  return { red, exempt }
}

/** 从 CSS 文本里抽 --radius-* 定义(用于 A 表对账) */
export function readCssRadius(fileText) {
  const map = {}
  const re = /^\s*(--radius(?:-(?:xs|sm|md|lg|xl|2xl))?)\s*:\s*([0-9.]+)(rem|px)\s*;/gm
  let m
  while ((m = re.exec(fileText))) {
    const px = m[3] === 'rem' || m[3] === 'em' ? Number(m[2]) * 16 : Number(m[2])
    map[m[1]] = Number.isFinite(px) ? px : null
  }
  return map
}

/** B 判据:单文件 → 违规点列表。纯函数,自检直接复用 */
/**
 * 棘轮切分:每文件**超出容忍上限**的那部分才算新增违规。
 * 纯函数,自检直接复用 —— 上限从哪来(HEAD 锚点 / 静态基线)由调用方决定,切分口径只此一份。
 */
export function splitFresh(byFile, tolOf) {
  const fresh = []
  for (const [rel, vs] of byFile) {
    const tol = tolOf(rel)
    vs.forEach((v, i) => {
      if (i >= tol) fresh.push({ file: rel, ...v })
    })
  }
  return fresh
}

/**
 * 预取面访问器(2026-09-26 取材收口):只认「本批已预取的规格」。
 * 未预取的规格**抛** `Undetermined`,而不是偷偷再派生一次 git —— 层纪律「先 prefetch 再 read」
 * 的意义就在于:偷偷补派生会把逐文件 fork 风暴的退化掩盖成正常(face-reader 头注原话)。
 * 值本身可为 null(该 HEAD 里确实没有这个文件),由调用方决定"无此文件"的业务含义。
 */
export function makeBlobAccessor(map) {
  return (spec) => {
    if (!map.has(spec)) throw new Undetermined(`未预取的规格:${spec}(先 prefetch 再 read,禁止补一次派生)`)
    return map.get(spec)
  }
}

/**
 * 每文件扫描内容的取材分支(纯函数,自检注入假 reader 造「三面异形」现场):
 *  - 全量档(auditHead)且该文件磁盘≠HEAD ⇒ 用预取的 **HEAD blob**(与旧逐文件 git 读同面,
 *    判据未动 —— 滞后的工作树草稿不得被记成本仓债务);
 *  - 其余 ⇒ 工作树(本门 --staged/--files 的既有约定,同 lint-staged 形态)。
 * 工作树读失败回 null(旧形态 = 抛错被外层 catch 后 continue),调用方跳过该文件。
 * blobOf 对未预取规格的抛**不被吞**:那是计划缺陷,必须大声失败而不是表现为"少扫一个文件"。
 */
export function pickScanSource(rel, { auditHead, diverged, blobOf, readWorktree }) {
  if (auditHead && diverged && diverged.has(rel)) return blobOf(`HEAD:${rel}`) ?? null
  try {
    return readWorktree(rel)
  } catch {
    return null
  }
}

export function scanText(rel, text, table) {
  const bad = []
  const lines = text.split('\n')
  const steps = Object.entries(table.RADIUS_STEPS).map(([, v]) => v)
  /**
   * B9 的上限 = **档位表里的最大档**(2xl = 16px)。写死 16 就是抄第二份真相:档位表一改,
   * 抄数的门会对着旧表打分(本文件头注为 A 判据写下的同一条理由)。
   */
  const MAX_STEP = Math.max(...steps.filter((n) => Number.isFinite(n)))
  /**
   * B9 只管**数值与档位形态**的半径。"全圆写法"(`rounded-full` / `50%` / `9999px`)的等效半径
   * 由守门 11 的 C7 判 —— 那一族的归属门本来就是"容器禁用纯圆/胶囊"这道,而本门的主题是
   * "有没有绕档位表写死数字",相对写法里根本没有写死的数字。同一族两道门各计一次,
   * 两处读数就会互相顶掉(守门 83 为这条写过明文),所以这里**不留**几何上限闸。
   */
  const B9_HINT = `圆角半径不得超过最大档 2xl(${MAX_STEP}px)—— 项目定档"不允许圆角过大",改取 ≤ 2xl 的档(全圆写法由守门 11 的 C7 判同一上限)`
  // B7 的档位名单**从 radius.js 的表现取**;`DEFAULT` 是数值兜底键、不是类名后缀,留着它
  // 就等于把"看起来像类名"当成"是类名",而那正是 B7 要防的同一型。
  const classStepNames = new Set([...Object.keys(table.RADIUS_STEPS).filter((k) => k !== 'DEFAULT'), 'full', 'none'])
  /**
   * 纯圆相对式(`50%` / `9999px`)的放行判据从"有没有标记"换成"**量出来的形状**":
   *  - 同一作用域里 `width === height` ⇒ 真圆是几何,不是"绕档位表写死数字",不需要任何标记;
   *  - 量得出来但不等 ⇒ 胶囊 / 椭圆 —— 本项目不允许胶囊形态,**没有豁免通道**(用户定档:零豁免);
   *  - 量不出来 ⇒ 判"几何无法确认",出路是把盒尺寸写进同一作用域,而不是挂一行标记。
   * 只看"两侧数值是否同形"不看单位,是因为 `50%` 的定义就是"各自边长的一半";dims 取材与门 150 的
   * C6 共用 `lib/box-geometry.mjs` 那一份实现(两把尺子各算一遍形状必漂,本仓记过最多次)。
   */
  /**
   * 一条半径相对自己那个盒的几何定性(实现只有一份,住在 lib/box-geometry.mjs,与门 150 的 C6 同一把尺)。
   * 'circle' / 'rounded-end' 算几何 ⇒ 不是"绕档位表写死数字";
   * 'capsule' 是本项目禁止的形状;'tier' 就是普通圆角取用,必须走档位表。
   */
  const geoPass = (idx, radiusText, anchor) => ['circle', 'rounded-end'].includes(classifyRadiusGeometry(lines, idx, radiusText, anchor))
  const circleVerdict = (i) => {
    // 作者把宽高写成同一个值(常量、rpx(N)、toRpx(x) 都算)⇒ 盒子是正方,这是比数值更强的证据:
    // 它不依赖 dims 的单位折算口径。
    const dt = scopeDimTexts(lines, i)
    if (dt.length >= 2 && new Set(dt).size === 1) return 'circle'
    const d = [objectDims(lines, i), boxDims(lines, i)].find(
      (x) => x && Number.isFinite(x.w) && Number.isFinite(x.h) && x.w > 0 && x.h > 0,
    )
    if (!d) return 'unproven'
    // 严格数值等值,不用 `shape === 'square'` —— 那一档在 dims 实现里是"长短边比 ≤1.35 就算方",
    // 16×12 也落在里面;相对式 50% 在这种盒上渲染出来是椭圆/胶囊,不能按真圆放行。
    return d.w === d.h ? 'circle' : 'capsule'
  }
  lines.forEach((line, i) => {
    /**
     * B8:豁免标记族本身。放在**逐行第一步**、且在"整行注释直接 return"之前 —— 标记就活在注释里,
     * 放到那行之后本门就永远看不见它(判据面与豁免面两套遮罩的历史教训,门 102/131 各记过一次)。
     * 档位表自身不判:它是规格文件而非取用点,里面的散文一旦提到这个族名会替人写出假阳。
     */
    if (!TABLE_FILES.test(rel) && RADIUS_EXEMPT_MARKER_RE.test(line)) {
      bad.push({
        line: i + 1,
        rule: 'B8',
        raw: line.trim().slice(0, 120),
        hint:
          '圆角豁免通道已整体废除(项目定档「不允许有任何豁免」)—— 删掉这条标记:真圆由"正方盒 + 半径=半边"自己成立,' +
          '胶囊是本项目禁止的形状,没有例外',
      })
    }
    const t = line.trim()
    if (/^(\/\/|\*|\/\*|<!--|#\s|;;)/.test(t)) return
    const isDocLike = /\.html$/i.test(rel)
    if (isCss(rel) || isDocLike || isJsx(rel)) {
      // 不锚定行首:一行里可能有 `width: 16px; border-radius: 50%` 多声明,
      // 且 .ts 里会内嵌生成的 HTML/CSS(cli 分享页),两类都得看见
      // 两条取材形状都在这里,不锚定行首:一行里可能有 `width: 16px; border-radius: 50%` 多声明,
      // .ts 里会内嵌生成的 HTML/CSS(cli 分享页),而 **小程序/Tailwind 的任意属性形态**
      // `[border-radius:6rpx]` 前面是 `[` 不是空白 —— 旧字符类把它整个漏掉,于是 6rpx(=3px,
      // 根本不在档位表上)长期隐身。值字符类同时排除 `]`,否则整串 className 被当成一个值读。
      if (TABLE_FILES.test(rel)) return
      const m = /(^|[;{}[\s])(border(?:-top|-bottom)?(?:-left|-right)?-radius\s*:\s*)([^;}\n'"\]]+)/.exec(line)
      if (m) {
        const val = m[3].trim()
        if (/^(?:inherit|none|0)$/i.test(val)) {
          // 整值就是关键字/零,没有可判的字面量
        } else if (/50%|9999px/.test(val)) {
          // 纯圆/胶囊:**形状量出来才放行,标记不再起作用**(项目定档:不允许胶囊、不允许豁免)。
          const v = circleVerdict(i)
          if (v === 'circle') return
          bad.push({
            line: i + 1,
            rule: v === 'capsule' ? 'B3-capsule' : 'B3-unproven',
            raw: val,
            hint:
              v === 'capsule'
                ? '非正方盒上的 50% / 9999px 渲染成胶囊 —— 本项目不允许胶囊形态,改取该元素类别的角色档(见 radius.js 的 RADIUS_ROLES)'
                : '同一作用域里量不到等值的 width/height,门无法确认它是几何真圆还是胶囊 ⇒ 把盒尺寸写在这个作用域里',
          })
        } else {
          // **逐值判,不按整串短路**:旧写法只要值里出现 `var(--radius` 就整条放行,于是
          // `border-radius: var(--radius-xl) 24rpx 0 0` 这种"第一个角引用档位、其余角写死字面量"
          // 的多值声明整条隐身(HEAD 实测 4 处)。多值声明的每一个角都必须自己合规。
          for (const part of val.split(/\s+/)) {
            if (/^(?:var\(|calc\(|inherit|none|auto$)/i.test(part) || /^0(?:\.[0-9]+)?(?:px|rpx|rem|em|%)?$/i.test(part)) continue
            const mm = /^([0-9.]+)(rpx|px|rem|em)$/.exec(part)
            if (!mm) continue
            // 与 B1 同一条尺子:等式成立才算几何,不是绕档(实现只有一份,见 lib/box-geometry.isGeometricCircle)。
            if (geoPass(i, part)) continue
            const px = mm[2] === 'rpx' ? Number(mm[1]) / 2 : mm[2] === 'px' ? Number(mm[1]) : Number(mm[1]) * 16
            if (px === 0) continue
            if (steps.includes(px)) bad.push({ line: i + 1, rule: 'B3', raw: part, hint: `应写 var(--radius-*)(${table.stepOf(px) ?? px})` })
            else bad.push({ line: i + 1, rule: 'B3-off', raw: part, hint: `偏档字面量;就近档位 = ${table.nearest(px)}` })
          }
        }
      }
    }
    if (!isJsx(rel) && !/\.svg$/i.test(rel)) return
    if (isJsx(rel)) {
      // B1 RN/内联 style:裸数字、rpx()、以及**带引号的字符串值**('8px' / "6px 6px 0 0" / `…`)
      //    带引号那支是 2026-09-23 对抗排查补的:原判据只认裸数字,54 处 `borderRadius: '8px'`
      //    与 B3 的值字符类(排除引号)同时漏过,等于最大盲区。
      const re = /\bborder(?:Top|Bottom)?(?:Left|Right)?Radius\s*:\s*(rpx\(\s*[0-9.]+\s*\)|-?[0-9.]+|(['"`])([^'"`]*)\2)/
      const m = re.exec(line)
      if (m) {
        if (m[1].startsWith('rpx(') || /^-?[0-9.]+$/.test(m[1])) {
          const raw = m[1]
          const isRpx = raw.startsWith('rpx(')
          const declared = Number(isRpx ? raw.slice(4, -1) : raw)
          const px = isRpx ? declared / 2 : declared
          if (px === 0) return
          /**
           * `<边长> / 2` 必须先折算再比上限。这条不是修饰:正则捕获的是**分子**,
           * 所以 `borderRadius: 18 / 2`(真实半径 9)在按分子判的写法下会被读成 18 ——
           * 而 18 > 16 就判红。实测 HEAD 面因此**凭空造出 4 枚假阳**(`18 / 2`、`24 / 2`、
           * `20 / 2` 三形),而我差点去"修"它们:那等于把三处本来正确的几何真圆改小,
           * 而门的红会变成唯一证据。**假阳的代价不是多一条红,是逼人改坏没坏的东西。**
           */
          const halfForm = /^\s*\/\s*2\b/.test(line.slice(m.index + m[0].length))
          const effective = halfForm ? px / 2 : px
          /**
           * B9 先于"几何放行"判:`48×48 盒上的 24` 数值上就是半边,旧口径把它当几何真圆放走,
           * 而项目定档是**任何圆角半径 ≤ 最大档 16px**(用户 2026-09-29 裁决:不允许圆角过大,
           * 圆形头像/圆形图标底板不再豁免)。放行支路因此必须带上这一道闸,否则它就是漏口。
           */
          if (effective > MAX_STEP) {
            bad.push({ line: i + 1, rule: 'B9', raw: `${raw}(=${effective}px)`, hint: B9_HINT })
            return
          }
          /**
           * "半径由盒尺寸算出来"的两种几何写法在此放行,合起来就是 §4 推荐的那一种:
           *  - `<边长> / 2`:**分子必须等于同一作用域量得到的正方边长** —— 写 `/ 2` 只是*声称*在算一半,
           *    40×40 的盒上写 `10 / 2` 仍是绕档(声称不等于证明);
           *  - 数值恰为正方边长的一半(`48×48` 上的 `24`)。
           * B2 那条本地常量判据早就带同款排除(`(?![0-9.]*\s*\/)`),B1 漏了 ⇒ HEAD 实测 22 处
           * **按规矩写出来的站点**被本门判红,而门给出的出路是"加 radius-exempt 标记" ——
           * 用豁免盖住门自己推荐的形态,失效方向是逼人挂标记而不是逼人改正(§22c 同族)。
           * 只在"半径与盒形都不带单位"时判等(RN StyleSheet 的 dp):`dimsFromText` 对不同书写形态的
           * 单位折算口径不同(`w-[96rpx]` 折半、`width: 96rpx` 取原值),跨形态比数值会造出假方形。
           * 判不出来就不是放行 —— 落回下面的红,出路是写成相对式(`50%`)或把盒尺寸写进同一作用域。
           */
          // 数值支路走到这里已经过了"折算后 > MAX_STEP"那道闸,所以半径必 ≤ 最大档 —— 几何放行不再叠上限闸。
          if (halfForm ? isHalfOfDeclaredSide(lines, i, raw) : geoPass(i, raw)) return
          bad.push({ line: i + 1, rule: isRpx ? 'B1-rpx' : 'B1', raw, hint: `应写 ${targetOf(table, px)}(几何圆请写成 <边长> / 2 或 50%)` })
        } else {
          const val = (m[3] || '').trim()
          if (/var\(--radius|inherit|none/.test(val)) return
          if (/50%|9999px/.test(val)) {
            // 与 B3 同一条尺子:形状量出来才算几何,标记在这一侧不起作用(见 circleVerdict 注释)。
            // 正方盒 ⇒ 真圆 ⇒ 几何放行;**等效半径是否超上限由守门 11 的 C7 判**(那一族归它量),
            // 本门不再叠一道,免得同一枚站点两处计数。
            const v = circleVerdict(i)
            if (v === 'circle') return
            bad.push({
              line: i + 1,
              rule: v === 'capsule' ? 'B1-capsule' : 'B1-unproven',
              raw: m[1],
              hint:
                v === 'capsule'
                  ? '非正方盒上的 50% / 9999px 渲染成胶囊 —— 本项目不允许胶囊形态,改取该元素类别的角色档(见 radius.js 的 RADIUS_ROLES)'
                  : '同一作用域里量不到等值的 width/height,门无法确认它是几何真圆还是胶囊 ⇒ 把盒尺寸写进这个作用域',
            })
            return
          }
          for (const part of val.split(/\s+/)) {
            const mm = /^([0-9.]+)(rpx|px|rem|em)$/.exec(part)
            if (!mm) continue
            if (geoPass(i, part)) continue
            const px = mm[2] === 'rpx' ? Number(mm[1]) / 2 : mm[2] === 'px' ? Number(mm[1]) : Number(mm[1]) * 16
            if (px === 0) continue
            bad.push({ line: i + 1, rule: 'B1-string', raw: part, hint: `应写数值档位 ${targetOf(table, px)}(不要字符串字面量)` })
          }
        }
      }
      // 名字须**确实指向圆角**。子串匹配会误伤三类真实常量(2026-09-23 由 4 个并行批次各自
      // 独立撞到,证明是判据缺陷而非个案):
      //   · MAX_ROUNDS / DEFAULT_COMM_ROUNDS / aiRounds —— 轮次计数(ROUND 子串)
      //   · ARXIV_MAX_RESULTS —— arXiv 查询参数(RX 子串)
      //   · SNIPPET_RADIUS —— 确实叫 RADIUS 但是字符窗口,属命名债,靠改名解决(见下)
      // 误报的代价是把业务常量吸附成档位值(5 轮→4 轮、60 字符→16 字符),比漏判严重得多。
      const mc = /^\s*(?:const|let)\s+([A-Za-z0-9_]*(?:RADIUS|Radius|CORNER|Corner)(?:[A-Za-z0-9_]*|\b)|(?:(?:[A-Za-z0-9_]+_)?(?:RX|RY|Rx|Ry)(?:_[A-Za-z0-9_]+)?))(?![A-Za-z0-9_])\s*=\s*([0-9.]+)(?![0-9.]*\s*\/)/.exec(line)
      if (mc) bad.push({ line: i + 1, rule: 'B2', raw: `${mc[1]}=${mc[2]}`, hint: '本地圆角/圆点半径常量应直接引用 rnRadius.<step>' })
    }
    // B5:SVG 圆角矩形 —— rx/ry 同样产生圆角,原先完全无判据(.svg 还被当资产整体跳过)
    //   静态 .svg 资产里没有 JS/CSS 变量通道,故只要求「取值等于档位」或带 radius-exempt 标记;
    //   JSX 内联 SVG 可以引用档位,按 rnRadius.<step> 要求。
    const staticSvg = /\.svg$/i.test(rel)
    const reRx = /\b(rx|ry)\s*=\s*"([0-9.]+)(px)?"|\b(rx|ry)\s*=\s*\{\s*([0-9.]+)\s*\}/g
    let r5
    while ((r5 = reRx.exec(line))) {
      // 分支 1(rx="8")命中组 2;分支 2(rx={8})命中组 5 —— 下标取错会算出 NaN
      const raw = r5[2] ?? r5[5]
      const px = Number(raw)
      if (!Number.isFinite(px) || px === 0 || geoPass(i, raw, /\b(?:rx|ry)\s*[=:]/)) continue
      if (staticSvg && steps.includes(px)) continue
      bad.push({ line: i + 1, rule: 'B5', raw: `${r5[1] || r5[4]}=${raw}`, hint: staticSvg ? `静态 SVG 圆角须等于档位值(${table.nearest(px)}) —— 项目不留豁免标记,确属图形轮廓则把该资产目录声明进 OUT_OF_SCOPE` : `SVG 圆角应引用档位 ${targetOf(table, px)}` })
    }
    const arb = /\brounded(?:-[a-z0-9]+)*-\[([^\]]+)\]/g
    let a
    while ((a = arb.exec(line))) {
      if (/var\(--radius/.test(a[1]) || geoPass(i, a[1], /rounded-/)) continue
      bad.push({ line: i + 1, rule: 'B4', raw: a[0], hint: '任意值须换档位类 rounded-<step>(几何真圆请写成与边长同形的 <边长> / 2,门能认出它)' })
    }
    /**
     * B7:类名**解析不到任何工具类**时,圆角其实是 0,而账面什么都看不出来。
     * 立判据的实例不是假想:HEAD 上曾有 9 处 `rounded-$1-xl` / `rounded-$1-2xl`(批量 codemod
     * 的替换串里 `$1` 没被展开,方向字母被吃掉)—— 底部弹层与角标的圆角**当场失效**,
     * 而 B3/B4/门 150 全都看不见:B3 只看 `border-radius:`、B4 只认 `rounded-[…]` 方括号形态,
     * `rounded-$1-xl` 长得"像个类名"。唯一暴露它的是门 128 的一条真仓阳性对照恰好失败
     * (**阳性对照顺带充当了哨兵**),否则这批会带着 9 个死类名一直绿下去。
     * 判据刻意只扫"类名属性里的词元",并且跳过插值/方括号/斜杠修饰三型 ——
     * 把它们算进来就是几百处假红(散文里的 `rounded-lg/rounded-sm`、模板里的 `rounded-md${status}`),
     * 而假红的代价永远是各会话跳钩子、连带全部守门作废(§12e 同型)。
     */
    if (isJsx(rel) || isDocLike) {
      const attr = /class(?:Name)?\s*=\s*(?:\{\s*)?['"`]([^'"`]*)['"`]/g
      let am
      while ((am = attr.exec(line))) {
        for (const rawTok of am[1].split(/\s+/)) {
          let tok = rawTok
          const colon = tok.lastIndexOf(':')
          if (colon > 0) tok = tok.slice(colon + 1)
          if (!tok.startsWith('rounded')) continue
          if (tok.includes('${') || tok.includes('[') || tok.includes('/')) continue
          const segs = tok.split('-').slice(1)
          let why = ''
          if (!segs.length) continue
          else if (segs.every((s) => CLASS_DIR_NAMES.has(s))) continue
          else if (!classStepNames.has(segs[segs.length - 1])) why = `尾段 "${segs[segs.length - 1]}" 不是档位名`
          else if (!segs.slice(0, -1).every((s) => CLASS_DIR_NAMES.has(s))) why = `中段 "${segs.find((s) => !CLASS_DIR_NAMES.has(s))}" 不是方向/角`
          if (why) bad.push({ line: i + 1, rule: 'B7-dead-class', raw: tok, hint: `${why} ⇒ Tailwind 不产出任何规则,这一处的圆角实际是 0(死类名)` })
        }
      }
    }
  })
  // B6:引用了档位出口(rnRadius / RADIUS_CSS_PX)却没在本文件 import 它们。
  //    这道门现在判的是 **HEAD 内容**,而 tsc 只在 worktree 上跑 —— "别人没提交的草稿"与
  //    "HEAD 里悬空的标识符"本地全绿却都是真的,前向移植/批量改写最容易留下的就是这一类。
  //    import 常写成多行,必须在整条 `{…}` 里找名字:首版按单行匹配,把 6 个正常文件
  //    (swagger-theme / design-templates / chart-template-card 等)全判成缺 import。
  if (isJsx(rel)) {
    const importLists = [...text.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]*design-tokens['"]/g)].map((m) => m[1])
    for (const name of ['rnRadius', 'RADIUS_CSS_PX']) {
      const used = lines.some((l) => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l) && new RegExp(`\\b${name}\\s*\\.`).test(l))
      if (!used) continue
      if (importLists.some((s) => new RegExp(`[\\s,{]${name}(?:\\s+as\\s+\\w+)?\\s*(?:,|$)`).test(s))) continue
      bad.push({ line: 1, rule: 'B6', raw: `${name} 被使用但未 import`, hint: `须在 '@ihui/design-tokens' 的 import 列表里带上 ${name},否则该文件在 HEAD 上直接编译不过` })
    }
  }
  return bad
}

/**
 * A4:角色并集(`RadiusRole`)↔ `RADIUS_ROLES` 键集对账。**纯函数**,两侧输入都由调用方喂,
 * 这样"缺档 / 多档 / 一致"三态都能在临时构造面上证明,不必改真仓的 d.ts。
 *
 * 立因:本票给 `radius.js` 加了 `popover` / `bubble` 两个角色,而 `radius.d.ts` 的 `RadiusRole`
 * 是**手抄的第二份** —— A 判据当时只比"档位值"(steps),不比"角色名",于是新角色在类型面整族隐身:
 * 运行时取 `rnRadiusFor.popover` 能拿到 6,而任何 TS 消费方写它都是 TS2339(且 `pnpm typecheck`
 * 只在 worktree 跑,谁不写这一行就永远不红)。同一型缺陷在守门 128 的"几何表 ↔ 自己的 .d.ts"维
 * 登记过一次,那一条只覆盖 geometry.js —— **表加了新列,审表的门必须同批改**。
 */
export function checkRoleUnion(roles, declText) {
  const errors = []
  const table = Object.keys(roles || {})
  if (table.length === 0) return ['RADIUS_ROLES 为空 —— 角色表被清空,判据不认这个结论']
  const at = String(declText || '').indexOf('export type RadiusRole')
  if (at < 0) return ['radius.d.ts 找不到 `export type RadiusRole` 声明 —— 角色名在类型面不可消费']
  const body = String(declText)
    .slice(at)
    .split(/\n\s*(?:export|\/\*\*|interface|type)\b/)[0]
  const declared = [...body.matchAll(/['"]([\w-]+)['"]/g)].map((m) => m[1])
  if (declared.length === 0) return ['RadiusRole 声明里取不到任何字面量 —— 判据失明,不记通过']
  const dset = new Set(declared)
  const tset = new Set(table)
  for (const r of table) if (!dset.has(r)) errors.push(`RadiusRole 缺 '${r}'(radius.js 已有该角色)`)
  for (const r of declared) if (!tset.has(r)) errors.push(`RadiusRole 多 '${r}'(radius.js 已无此角色 = 类型清单腐烂)`)
  return errors
}

/** A 判据:四处档位表值一致性。返回红线列表 */
export async function checkTableConsistency() {
  const mod = await loadTable()
  const errors = []
  const table = { ...mod.RADIUS_STEPS }
  // 1) tokens.css
  const tokensCss = readFileSync(join(ROOT, 'packages/design-tokens/src/styles/tokens.css'), 'utf8')
  const cssMap = readCssRadius(tokensCss)
  const expectCss = { '--radius': table.DEFAULT, '--radius-xs': table.xs, '--radius-sm': table.sm, '--radius-md': table.md, '--radius-lg': table.lg, '--radius-xl': table.xl, '--radius-2xl': table['2xl'] }
  for (const [k, v] of Object.entries(expectCss)) {
    if (cssMap[k] === undefined) { errors.push(`tokens.css 缺少 ${k} 定义(应为 ${v}px)`); continue }
    if (Math.abs(cssMap[k] - v) > 0.001) errors.push(`tokens.css ${k}=${cssMap[k]}px 与 radius.js ${v}px 漂移`)
  }
  // 2) miniapp-taro app.css(端内同步块)
  const appCssPath = join(ROOT, 'apps/miniapp-taro/src/app.css')
  if (existsSync(appCssPath)) {
    const appMap = readCssRadius(readFileSync(appCssPath, 'utf8'))
    for (const [k, v] of Object.entries(expectCss)) {
      if (appMap[k] === undefined) continue // 端内可只同步子集
      if (Math.abs(appMap[k] - v) > 0.001) errors.push(`miniapp-taro app.css ${k}=${appMap[k]}px 与 radius.js ${v}px 漂移`)
    }
  }
  // 3) tailwind preset 必须引用 RADIUS_REM,不得重新内联字面量表
  const preset = readFileSync(join(ROOT, 'packages/design-tokens/src/tailwind-preset.js'), 'utf8')
  if (!/borderRadius:\s*RADIUS_REM\s*,?/.test(preset)) errors.push('tailwind-preset.js 的 borderRadius 必须写 `borderRadius: RADIUS_REM`,不得重新内联档位字面量')
  // 4) 角色名两处对账(档值同形,但历史上只比档值 —— 新角色就是这么在类型面隐身的)
  const roleDecl = (() => {
    try {
      const b = catBatch(ROOT, ['HEAD:packages/design-tokens/src/radius.d.ts'])
      return b.get('packages/design-tokens/src/radius.d.ts') ?? b.get('HEAD:packages/design-tokens/src/radius.d.ts') ?? ''
    } catch (e) {
      return null
    }
  })()
  if (roleDecl === null) errors.push('radius.d.ts 取不到(HEAD 面)—— 角色名对账未能执行,不记通过')
  else errors.push(...checkRoleUnion(mod.RADIUS_ROLES, roleDecl))
  return { errors, table }
}

function loadBaselineSites() {
  try {
    const j = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
    return (j.sites || []).map((s) => ({ file: s.file, rule: s.rule, raw: s.raw }))
  } catch {
    return []
  }
}

async function selfTest() {
  const table = {
    RADIUS_STEPS: { xs: 2, sm: 4, DEFAULT: 8, md: 6, lg: 8, xl: 12, '2xl': 16 },
    stepOf: (px) => ({ 2: 'xs', 4: 'sm', 6: 'md', 8: 'lg', 12: 'xl', 16: '2xl' })[px] || null,
    nearest: (px) => [2, 4, 6, 8, 12, 16].reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a)),
  }
  const cases = [
    { name: 'B1 RN 数字字面量必拦', f: 'packages/app/src/x.tsx', s: 'const st = { a: { borderRadius: 8 } }', red: true },
    { name: 'B1 rnRadius 引用放行', f: 'packages/app/src/x.tsx', s: "import { rnRadius } from '@ihui/design-tokens'\nconst st = { a: { borderRadius: rnRadius.lg } }", red: false },
    { name: 'B1 0 放行', f: 'packages/app/src/x.tsx', s: 'const st = { a: { borderRadius: 0 } }', red: false },
    { name: 'B1 `<边长> / 2` 且分子等于同一作用域的正方边长 ⇒ §4 推荐的几何式,放行', f: 'packages/app/src/x.tsx', s: 'const st = { a: { width: 20, height: 20, borderRadius: 20 / 2 } }', red: false },
    { name: 'B1 反向:`/ 2` 只是声称在算一半 —— 分子与盒尺寸不符(10 vs 40×40)不得放行', f: 'packages/app/src/x.tsx', s: 'const st = { a: { width: 40, height: 40, borderRadius: 10 / 2 } }', red: true },
    { name: 'B1 反向:量不到盒形的 `/ 2` 不得放行(声称不等于证明)', f: 'packages/app/src/x.tsx', s: 'const st = { a: { borderRadius: 20 / 2 } }', red: true },
    // 用户 2026-09-29 定档「任何圆角半径不得超过最大档 2xl=16px,圆形头像不再豁免」之后,
    // 这一格的原期望("48×48 上的 24 按形状放行")**已被裁决推翻** —— 半径 24 超上限,必红。
    // 留原样就是让自检替一条已废的口径背书,所以改判红,并补一条仍在上限内的几何真圆当放行对照。
    { name: 'B1 数值真圆 48×48 上的 24 ⇒ 形状是正圆但**半径超上限**,按 2026-09-29 定档判红', f: 'packages/app/src/x.tsx', s: 'const st = { a: { width: 48, height: 48, borderRadius: 24 } }', red: true },
    { name: 'B1 数值真圆 32×32 上的 16 ⇒ 既是几何真圆又不超上限 ⇒ 放行(上一条的放行对照)', f: 'packages/app/src/x.tsx', s: 'const st = { a: { width: 32, height: 32, borderRadius: 16 } }', red: false },
    { name: 'B1 `<边长> / 2` 折算后才比上限:48 的盒写 `48 / 2`=24 ⇒ 红', f: 'packages/app/src/x.tsx', s: 'const st = { a: { width: 48, height: 48, borderRadius: 48 / 2 } }', red: true },
    { name: 'B1 `<边长> / 2` 折算是真半径:18 的盒写 `18 / 2`=9 ⇒ 几何放行(不得按分子 18 去比上限而误判)', f: 'packages/app/src/x.tsx', s: 'const st = { a: { width: 18, height: 18, borderRadius: 18 / 2 } }', red: false },
    { name: 'B1 反向:`/ 2` 的分子与盒边长不符(36 的盒写 18/2)⇒ 声称不等于证明,仍按绕档拦', f: 'packages/app/src/x.tsx', s: 'const st = { a: { width: 36, height: 36, borderRadius: 18 / 2 } }', red: true },

    { name: 'B1 反向:量不到盒形时标记**不再**替几何背书(零豁免)', f: 'packages/app/src/x.tsx', s: 'const st = { a: { borderRadius: 24 } } // radius-exempt: 48dp 头像正圆', red: true },
    { name: 'B1 rpx 绕档必拦', f: 'apps/mobile-rn/src/x.tsx', s: 'const st = { a: { borderRadius: rpx(16) } }', red: true },
    { name: 'B2 本地常量必拦', f: 'apps/mobile-rn/src/x.tsx', s: 'const CARD_RADIUS = 12', red: true },
    { name: 'B2 引用档位放行', f: 'apps/mobile-rn/src/x.tsx', s: "import { rnRadius } from '@ihui/design-tokens'\nconst CARD_RADIUS = rnRadius.xl", red: false },
    { name: 'B3 CSS 字面量必拦', f: 'apps/miniapp-taro/src/a.css', s: '  border-radius: 24rpx;', red: true },
    { name: 'B3 CSS var 放行', f: 'apps/miniapp-taro/src/a.css', s: '  border-radius: var(--radius-xl);', red: false },
    {
      name: 'B3 多值声明逐值判 —— var 之后的裸字面量必须看见(旧整串短路漏过 4 处)',
      f: 'apps/miniapp-taro/src/a.css',
      s: '  border-radius: var(--radius-xl) 24rpx 0 0;',
      red: true,
    },
    {
      name: 'B3 多值声明全用 var 必须放行(逐值判不得反过来误伤)',
      f: 'apps/miniapp-taro/src/a.css',
      s: '  border-radius: var(--radius-xl) var(--radius-xl) 0 0;',
      red: false,
    },
    {
      name: 'B3 任意属性形态 [border-radius:6rpx] 必拦(前导 [ 旧字符类漏掉;40rpx 的边上 6rpx 既不是档位也不是几何半边)',
      f: 'apps/miniapp-taro/src/a.tsx',
      s: '  <View className="w-[40rpx] h-[40rpx] [border-radius:6rpx] bg-primary" />',
      red: true,
    },
    {
      name: 'B3 反向配对:同一条 6rpx 落在 12rpx 见方盒上 = 几何真圆 ⇒ 放行,且不需要任何标记',
      f: 'apps/miniapp-taro/src/a.tsx',
      s: '  <View className="w-[12rpx] h-[12rpx] [border-radius:6rpx] bg-primary" />',
      red: false,
    },
    {
      name: 'B3 任意属性形态引用档位必须放行(与 B4 的 rounded-[var(--radius-lg)] 同口径)',
      f: 'apps/miniapp-taro/src/a.tsx',
      s: '  <View className="w-[12rpx] h-[12rpx] [border-radius:var(--radius-xs)] bg-primary" />',
      red: false,
    },
    { name: 'B3 圆形无标记必拦', f: 'apps/web/app/x.css', s: '  border-radius: 50%;', red: true },
    {
      name: 'B7 死类名必拦(codemod 把方向字母吃成 $1 ⇒ Tailwind 不产出任何规则,圆角其实是 0)',
      f: 'apps/miniapp-taro/src/x.tsx',
      s: '<View className="relative rounded-$1-xl bg-card" />',
      red: true,
    },
    {
      name: 'B7 反向:方向类名 / 变体前缀 / 任意值 / 插值一律不得误伤',
      f: 'apps/miniapp-taro/src/y.tsx',
      s: '<View className="rounded-t hover:rounded-md rounded-tr-sm rounded-[var(--radius-lg)] rounded-md${size}" />',
      red: false,
    },
    {
      name: 'B7 反向:档位名之外的词一律拦(名单不外溢成"看着像类名就算")',
      f: 'apps/miniapp-taro/src/z.tsx',
      s: '<View className="rounded-pill" />',
      red: true,
    },
    {
      name: 'B7 档位名单来自 radius.js:表里有的档不得被读成死类名(改档时 B7 跟着走)',
      f: 'apps/miniapp-taro/src/w.tsx',
      s: '<View className="rounded-xs rounded-2xl" />',
      red: false,
    },
    { name: 'B3 反向:量不到盒形时标记**不再**放行(零豁免 —— 形状是量出来的,不是谁声明的)', f: 'apps/web/app/x.css', s: '  border-radius: 50%; /* radius-exempt: 头像 */', red: true },
    {
      name: 'B8 合规取用 + 一行标记 ⇒ 仍红(拦的是"挂标记"这个动作本身,与那一档对不对无关)',
      f: 'apps/web/app/b8.tsx',
      s: 'const s = { card: { borderRadius: rnRadius.lg } } // radius-role-exempt: 主视觉卡\n',
      red: true,
    },
    {
      name: 'B8 标记写在整行注释里也必须被看见(判据面若是遮罩面,这一条会静默漏掉整族)',
      f: 'apps/web/app/b8b.tsx',
      s: '// radius-exempt: 这一行只有注释\nconst s = { card: { borderRadius: rnRadius.lg } }\n',
      red: true,
    },
    {
      name: 'B8 反向:散文提这个族名(不带冒号)不得被判红 —— 判据不能吃自己的说明文字',
      f: 'apps/web/app/b8c.css',
      s: '/* 这里以前挂过 radius-exempt 与 radius-role-exempt,通道已整体废除,现在靠形状量 */\n.card { border-radius: var(--radius-lg); }\n',
      red: false,
    },
    { name: 'B3 可证正方 + 50% ⇒ 真圆放行(不需要任何标记)', f: 'apps/web/app/x.css', s: '  width: 96rpx;\n  height: 96rpx;\n  border-radius: 50%;', red: false },
    { name: 'B3 注释行放行', f: 'apps/web/app/x.css', s: '  /* border-radius: 24rpx; */', red: false },
    { name: 'B3 tokens.css 自身定义行放行', f: 'packages/design-tokens/src/styles/tokens.css', s: '  border-radius: 8px;', red: false },
    { name: 'B4 任意值必拦', f: 'apps/miniapp-taro/src/a.tsx', s: '<View className="rounded-[24rpx]" />', red: true },
    { name: 'B4 var 形式放行', f: 'apps/miniapp-taro/src/a.tsx', s: '<View className="rounded-[var(--radius-lg)]" />', red: false },
    { name: 'B3 一行多声明也要看见(width…; border-radius: 50%)—— 非正方 ⇒ 胶囊判红', f: 'apps/desktop/src-tauri/offline/index.html', s: '    width: 16px; height: 12px; border-radius: 50%;', red: true },
    { name: 'B3 同一行的 width/height 必须被读到(正方 ⇒ 真圆放行)', f: 'apps/desktop/src-tauri/offline/index.html', s: '    width: 16px; height: 16px; border-radius: 50%;', red: false },
    { name: 'B3 TS 模板里生成的 CSS 字面量必拦', f: 'apps/cli/src/commands/share.ts', s: '  .meta { background: #f6f8fa; border-radius: 6px; padding: 1rem; }', red: true },
    { name: 'B1 带引号字符串值必拦(原判据盲区:54 处 borderRadius: "8px")', f: 'apps/web/src/components/common/Toaster.tsx', s: 'const t = { borderRadius: "8px" }', red: true },
    { name: 'B1 字符串多值必拦', f: 'apps/web/app/(main)/design/InspectorPanel.tsx', s: 'style={{ borderRadius: "6px 6px 0 0" }}', red: true },
    { name: 'B1 字符串写 var 放行', f: 'apps/web/src/a.tsx', s: 'style={{ borderRadius: "var(--radius-lg)" }}', red: false },
    { name: 'B1 字符串纯圆无标记必拦', f: 'apps/web/src/a.tsx', s: 'style={{ borderRadius: "50%" }}', red: true },
    { name: 'B5 SVG rx 表达式数值必拦(且不得算出 NaN/undefined)', f: 'apps/web/src/components/ai/chart-template-card.tsx', s: '<rect rx={2} ry={2} width={10} />', red: true, saneRaw: true },
    { name: 'B5 静态 svg 偏档必拦', f: 'apps/web/public/x.svg', s: '<rect rx="5" ry="5" />', red: true },
    { name: 'B5 静态 svg 取值为档位则放行(无 JS 变量通道)', f: 'apps/web/public/x.svg', s: '<rect rx="8" ry="8" />', red: false },
    { name: 'B5 JSX 内联 svg 仍须引用档位', f: 'apps/web/src/a.tsx', s: '<rect rx="8" ry="8" />', red: true },
    { name: 'B2 常量名不含 RADIUS 也要拦(BAR_RX 形态)', f: 'apps/web/src/components/ai/chart-template-card.tsx', s: 'const BAR_RX = 2', red: true },
    { name: 'B2 正向对照:名字含 ROUND 的非圆角常量不得误报(MAX_ROUNDS=5 是编排轮次)', f: 'apps/api/src/services/crew-orchestrator.ts', s: 'const MAX_ROUNDS = 5', red: false },
    { name: 'B2 正向对照:DEFAULT_COMM_ROUNDS 同形不误报', f: 'apps/api/src/services/subagent-dispatch-service.ts', s: 'const DEFAULT_COMM_ROUNDS = 3', red: false },
    { name: 'B2 正向对照:ARXIV_MAX_RESULTS 含 RX 子串不得误报(arXiv 查询参数)', f: 'apps/api/src/jobs/ai-world-sync.ts', s: 'const ARXIV_MAX_RESULTS = 60', red: false },
    { name: 'B2 正向对照:aiRounds 轮次计数不误报', f: 'apps/api/src/routes/edu-canteen.ts', s: 'let aiRounds = 1', red: false },
    { name: 'B2 反向对照:独立成词的 RX 常量仍要拦(SVG 半径)', f: 'apps/web/src/components/ai/chart-template-card.tsx', s: 'const RX = 2', red: true },
    { name: 'B2 反向对照:BAR_RX 前缀形仍要拦', f: 'apps/web/src/components/ai/chart-template-card.tsx', s: 'const BAR_RX = 4', red: true },
    { name: 'B1 带引号字符串值必拦(原判据盲区:54 处 borderRadius: "8px")', f: 'apps/web/src/components/common/Toaster.tsx', s: 'const t = { borderRadius: "8px" }', red: true },
    { name: 'B1 字符串多值必拦', f: 'apps/web/app/(main)/design/InspectorPanel.tsx', s: 'style={{ borderRadius: "6px 6px 0 0" }}', red: true },
    { name: 'B1 字符串写 var 放行', f: 'apps/web/src/a.tsx', s: 'style={{ borderRadius: "var(--radius-lg)" }}', red: false },
    { name: 'B1 字符串纯圆无标记必拦', f: 'apps/web/src/a.tsx', s: 'style={{ borderRadius: "50%" }}', red: true },
    { name: 'B5 SVG rx 数值必拦', f: 'apps/web/src/components/ai/chart-template-card.tsx', s: '<rect rx={2} ry={2} width={10} />', red: true },
    { name: '档位类放行', f: 'apps/web/src/a.tsx', s: '<div className="rounded-lg p-2" />', red: false },
    { name: 'B6 引用 rnRadius 却没 import 必拦(HEAD 上就是编译不过)', f: 'apps/web/src/a.tsx', s: 'const s = { a: { borderRadius: rnRadius.lg } }', red: true },
    { name: 'B6 多行 import 带 rnRadius 必须放行(首版单行匹配误伤 6 个正常文件)', f: 'apps/api/src/plugins/swagger-theme.ts', s: "import {\n  COLOR_BLACK,\n  rnRadius,\n  RADIUS_CSS_PX,\n} from '@ihui/design-tokens'\nconst s = { a: { borderRadius: rnRadius.lg } }\nconst css = `border-radius: ${RADIUS_CSS_PX.md}`", red: false },
    { name: 'B6 别名 import(rnRadius as r)同样放行', f: 'apps/web/src/a.tsx', s: "import { rnRadius as r } from '@ihui/design-tokens'\nconst s = { a: { borderRadius: r.lg } }", red: false },
    { name: 'B6 只在注释里提到 rnRadius 不算使用', f: 'apps/web/src/a.tsx', s: '// 这里将来会换成 rnRadius.lg\nconst s = { a: { borderRadius: 0 } }', red: false },
  ]
  let fail = 0
  for (const c of cases) {
    const bad = scanText(c.f, c.s, table)
    const hit = bad.length > 0
    const ok = hit === c.red
    if (c.saneRaw) for (const b of bad) if (/undefined|NaN/.test(b.raw)) console.log('❌', c.name, 'raw 解析异常:', b.raw)
    console.log(ok ? '✅' : '❌', c.name, ok ? `(${bad.length} 违规)` : `→ 期望${c.red ? '红' : '绿'},实际${hit ? '红' : '绿'} ${JSON.stringify(bad.map((b) => b.rule))}`)
    if (!ok) fail++
    if (c.saneRaw && bad.some((b) => /undefined|NaN/.test(b.raw))) fail++
  }
  // HEAD 锚点棘轮:每文件容忍上限 = 该文件 HEAD 版本自身的违规数(或人工基线,取大)。
  // 这四例钉住的是本门最容易跑偏的两个方向 —— 把别人的老债算成本次新增(误红 → --no-verify 常态化),
  // 以及容忍整文件回写旧基线(误绿 → 迁移被静默撤销)。
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ line: i + 1, rule: 'B1', raw: '8', hint: '' }))
  const ratchet = [
    { name: '锚点:HEAD 已迁完(0 处)、待提交内容 3 处 → 新增 3(整文件回写旧基线必红)', by: { 'a.tsx': 3 }, tol: { 'a.tsx': 0 }, want: 3 },
    { name: '锚点:HEAD 本来 3 处、待提交仍 3 处 → 新增 0(改老文件不替老债背红)', by: { 'a.tsx': 3 }, tol: { 'a.tsx': 3 }, want: 0 },
    { name: '锚点:HEAD 3 处、待提交 5 处 → 新增恰为超出的 2 处', by: { 'a.tsx': 5 }, tol: { 'a.tsx': 3 }, want: 2 },
    { name: '锚点:HEAD 3 处、待提交 1 处(减债)→ 新增 0', by: { 'a.tsx': 1 }, tol: { 'a.tsx': 3 }, want: 0 },
  ]
  for (const r of ratchet) {
    const byFile = new Map(Object.entries(r.by).map(([f, n]) => [f, mk(n)]))
    const got = splitFresh(byFile, (f) => r.tol[f] ?? 0).length
    const ok = got === r.want
    console.log(ok ? '✅' : '❌', r.name, ok ? '' : `→ 期望 ${r.want},实际 ${got}`)
    if (!ok) fail++
  }
  // 取材迁移(2026-09-26,门 118)的构造面证明:用**注入的假 blob 面**造「三面异形」现场
  // (不改真仓、不碰台账、不依赖仓库瞬时状态 —— §22c:判据是行为分支,必须构造证明)。
  // 钉住两条:锚点数字只认 HEAD blob(滞后的磁盘/索引不得参与容忍上限),且全量档扫描内容
  // 同取 HEAD blob;反向对照各一条,防止这两支退化成恒真式。
  const FACE_REL = 'apps/web/src/face-probe.tsx'
  const HEAD_CLEAN = 'const s = { a: { borderRadius: 0 } }\n'
  const DISK_DIRTY =
    'const s = { a: { borderRadius: 8 } }\nconst t = { a: { borderRadius: 8 } }\nconst u = { a: { borderRadius: 8 } }\n'
  const faceProofs = []
  {
    const dirtyCounts = scanText(FACE_REL, DISK_DIRTY, table).length
    const byFileF = new Map([[FACE_REL, scanText(FACE_REL, DISK_DIRTY, table)]])
    const accHead0 = makeBlobAccessor(new Map([['HEAD:' + FACE_REL, HEAD_CLEAN]]))
    const tolFromHead = (rel) => {
      const b = accHead0(`HEAD:${rel}`)
      return b === null ? 0 : scanText(rel, b, table).length
    }
    const freshHead0 = splitFresh(byFileF, tolFromHead).length
    faceProofs.push({
      name: `取材:磁盘 3 处而 HEAD blob 0 处时,--staged 档锚点必须取 HEAD(新增应 = ${dirtyCounts},绝不是 0)`,
      ok: dirtyCounts === 3 && freshHead0 === 3,
      detail: `dirty=${dirtyCounts}, fresh=${freshHead0}`,
    })
    // 反向对照:HEAD blob 换成同一份脏内容 ⇒ 同一输入新增 0(证明上一条不是恒真式)
    const accHead3 = makeBlobAccessor(new Map([['HEAD:' + FACE_REL, DISK_DIRTY]]))
    const freshHead3 = splitFresh(byFileF, (rel) => {
      const b = accHead3(`HEAD:${rel}`)
      return b === null ? 0 : scanText(rel, b, table).length
    }).length
    faceProofs.push({
      name: '取材反向对照:HEAD blob 自身 3 处 ⇒ 同一待提交内容新增 0(锚点跟 HEAD 走,不替老债背红)',
      ok: freshHead3 === 0,
      detail: `fresh=${freshHead3}`,
    })
    // 未预取的规格必须抛(先 prefetch 再 read,禁止补一次派生)
    let threw = false
    try {
      accHead0('HEAD:apps/web/src/never-prefetched.tsx')
    } catch {
      threw = true
    }
    faceProofs.push({
      name: '取材:未预取规格必须抛(不得偷偷补派生掩盖退化)',
      ok: threw,
      detail: `threw=${threw}`,
    })
    // 全量档异形文件的**扫描内容**取 HEAD blob,而非工作树;--staged 档仍取工作树(既有约定)
    const pickAudit = pickScanSource(FACE_REL, {
      auditHead: true,
      diverged: new Set([FACE_REL]),
      blobOf: accHead0,
      readWorktree: () => DISK_DIRTY,
    })
    const pickStaged = pickScanSource(FACE_REL, {
      auditHead: false,
      diverged: null,
      blobOf: accHead0,
      readWorktree: () => DISK_DIRTY,
    })
    faceProofs.push({
      name: '取材:auditHead 档异形文件扫描内容 = HEAD blob(工作树再脏也不参与);取不到 ⇒ null 跳过',
      ok: pickAudit === HEAD_CLEAN,
      detail: JSON.stringify({ pickAudit: pickAudit && pickAudit.slice(0, 24) }),
    })
    faceProofs.push({
      name: '取材:--staged/--files 档内容仍取工作树(迁移未被顺手改成 HEAD 面,判据语义未动)',
      ok: pickStaged === DISK_DIRTY,
      detail: JSON.stringify({ pickStaged: pickStaged && pickStaged.slice(0, 24) }),
    })
    for (const p of faceProofs) {
      console.log(p.ok ? '✅' : '❌', p.name, p.ok ? '' : `→ ${p.detail}`)
      if (!p.ok) fail++
    }
  }
  // A 表对账:CSS 值漂移必须识别
  const css = '--radius: 0.5rem;\n  --radius-xs: 0.125rem;\n  --radius-sm: 0.3rem;\n'
  const map = readCssRadius(css)
  const driftOk = Math.abs(map['--radius-sm'] - 4.8) < 0.01
  console.log(driftOk ? '✅' : '❌', 'A 判据能读出 CSS 漂移值 sm=4.8px', driftOk ? '' : JSON.stringify(map))
  if (!driftOk) fail++
  /**
   * A4 角色名对账:三条成对 —— 只加"缺档必红"而不加"一致必须绿",判据失效也会表现为红消失;
   * 而"多档(清单腐烂)"必须与"缺档"同时判,否则有人删 radius.js 的一档而 d.ts 不删,门一路绿,
   * 消费方拿到 `rnRadiusFor.<已删角色>` = undefined(颜色/圆角 undefined 是本仓记过的运行时形态)。
   */
  const ROLE_DECL_OK = "export type RadiusRole = 'tiny' | 'control' | 'chip'\n\n/** 档位 → px */\nexport declare const RADIUS_STEPS: number\n"
  const roleMissing = checkRoleUnion({ tiny: 'xs', control: 'sm', chip: 'md', popover: 'md' }, "export type RadiusRole = 'tiny' | 'control' | 'chip'\n")
  const roleRotten = checkRoleUnion({ tiny: 'xs', control: 'sm' }, ROLE_DECL_OK)
  const roleOk = checkRoleUnion({ tiny: 'xs', control: 'sm', chip: 'md' }, ROLE_DECL_OK)
  const roleNoDecl = checkRoleUnion({ tiny: 'xs' }, 'export declare const RADIUS_STEPS: number\n')
  const roleEmptyTable = checkRoleUnion({}, ROLE_DECL_OK)
  for (const [nm, cond, det] of [
    ['A4 radius.js 有新角色而 RadiusRole 未跟上 ⇒ 点名缺档', roleMissing.length === 1 && /缺 'popover'/.test(roleMissing[0]), roleMissing],
    ['A4 反向:RadiusRole 多出的角色(表里已删)⇒ 判清单腐烂', roleRotten.length === 1 && /多 'chip'/.test(roleRotten[0]), roleRotten],
    ['A4 两侧一致 ⇒ 零红(与上两条成对,否则"红消失"没有含义)', roleOk.length === 0, roleOk],
    ['A4 声明整块不见 ⇒ 判"未能执行"而非通过', roleNoDecl.length === 1 && /找不到/.test(roleNoDecl[0]), roleNoDecl],
    ['A4 角色表被清空 ⇒ 判死,不记绿', roleEmptyTable.length === 1 && /为空/.test(roleEmptyTable[0]), roleEmptyTable],
  ]) {
    console.log(cond ? '✅' : '❌', nm, cond ? '' : JSON.stringify(det))
    if (!cond) fail++
  }
  // A 判据端到端:真实仓四处档位表必须一致(此例同时钉住 Windows 下 import() 必须走 pathToFileURL 的回归)
  let tableErr = []
  try {
    tableErr = (await checkTableConsistency()).errors
  } catch (e) {
    tableErr = [`checkTableConsistency 抛错:${e?.message || e}`]
  }
  console.log(tableErr.length === 0 ? '✅' : '❌', 'A 判据端到端:真实档位表四处一致', tableErr.length ? '→ ' + tableErr.join(' | ') : '')
  if (tableErr.length) fail++
  // 判据 C 覆盖面对账:未归类目录必红,已声明范围外只计数不红
  const fake = {
    'apps/newui/src/card.tsx': 'const s = { a: { borderRadius: 8 } }',
    'apps/ai-service/app/services/publish/formatter.py': 'css = "border-radius: 6px;"',
    'apps/web/src/components/ok.tsx': 'const s = { a: { borderRadius: rnRadius.lg } }',
    'apps/foo/assets/images/icon.svg': '<rect rx="8" />',
  }
  const covRes = coverageAudit(Object.keys(fake), (f) => fake[f])
  const covOk =
    covRes.red.length === 1 &&
    covRes.red[0].file === 'apps/newui/src/card.tsx' &&
    covRes.exempt.length === 2 &&
    covRes.exempt.every((e) => !e.file.includes('newui'))
  console.log(covOk ? '✅' : '❌', 'C 判据:新端未归类必红 / 已声明范围外只计数 / 已覆盖目录交 B', covOk ? '' : JSON.stringify(covRes))
  if (!covOk) fail++
  const total = cases.length + 3 + ratchet.length + faceProofs.length
  console.log(fail ? `\n${fail}/${total} 例失败` : `\n全部 ${total} 例通过`)
  process.exit(fail ? 1 : 0)
}

async function main() {
  if (SELF_TEST) {
    await selfTest()
    return 0
  }
  // 取材面活性:先确认 git 上下文就是本检出,再谈"扫到了什么"。
  // 判据没跑成(exit 2 无法判定)与判据跑了 0 命中(exit 0)必须可区分 —— 后者合法,前者绝不记绿。
  const ctx = resolveGitContext()
  if (!ctx.ok) {
    console.error(`❌ [radius-guard] 无法判定:${ctx.reason} —— 判据未能执行,不计通过`)
    return 2
  }
  const { errors: tableErrors, table: rawTable } = await checkTableConsistency()
  const mod = await loadTable()
  const table = {
    RADIUS_STEPS: rawTable,
    stepOf: (px) => Object.keys(rawTable).find((k) => rawTable[k] === px && k !== 'DEFAULT') || null,
    nearest: (px) => [...new Set(Object.values(rawTable))].reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a)),
    mod,
  }
  const files = []
  let bExcludedCount = 0
  if (FILES_MODE) {
    for (const f of fileList)
      if (!skipped(f.replaceAll('\\', '/'))) {
        const rel = f.replaceAll('\\', '/')
        if (isBExcluded(rel)) {
          bExcludedCount++
          continue
        }
        files.push(rel)
      }
  } else if (isStaged) {
    if (!STAGED_SET) {
      console.error('❌ [radius-guard] 无法判定:git diff --cached 未能执行,--staged 无法收窄到暂存区 —— 判据未能执行,不计通过')
      return 2
    }
    for (const f of STAGED_SET) if (!skipped(f) && !isDoc(f) && !isBExcluded(f)) files.push(f)
  } else {
    for (const d of SCAN_DIRS) for (const abs of walk(join(ROOT, d))) {
      const rel = relative(ROOT, abs).replaceAll('\\', '/')
      if (skipped(rel) || isDoc(rel) || /(^|\/)\.d\.ts$/.test(rel)) continue
      // 摘出去多少要报名:判据 C 的声明式范围若静默生效,读报告的人会把"没扫"当成"没有违规"。
      if (isBExcluded(rel)) {
        bExcludedCount++
        continue
      }
      files.push(rel)
    }
  }
  const violations = []
  // **全量审计判的是仓库现状(HEAD blob),不是工作区快照。**
  // 共享工作区里并行会话的未提交草稿常年滞后 HEAD:按磁盘读会把"别人没提交的旧基线"
  // 记成本仓的圆角债 —— 一道与工作区里真实改动无关的红门,只会逼人 --no-verify 并连带废掉全部守门。
  // 与 HEAD 一致的文件磁盘内容 == HEAD 内容,仍直读磁盘(6153 文件里的绝大多数,不必逐个起 git)。
  // --staged / --files 则按仓库既有约定读工作树(与 lint-staged 同形态),用下面的 HEAD 锚点约束"本次改动"。
  const auditHead = !isStaged && !FILES_MODE
  const diverged = auditHead ? gitNameSet(['diff', '--name-only', 'HEAD']) : null
  const trackedSet = auditHead ? gitNameSet(['ls-files']) : null
  if (auditHead) {
    // 全量审计的取材面是 HEAD:清单取不到、或"退出码 0 但 0 条"(守门 78:空扫不报绿)都是尺子失效,
    // 不是"判据执行了、命中 0"。真仓不可能没有跟踪文件 —— 0 只可能是 git 上下文不对。
    if (!trackedSet) {
      console.error('❌ [radius-guard] 无法判定:git ls-files 未能执行,HEAD 口径的全仓跟踪清单取不到 —— 不计通过')
      return 2
    }
    if (trackedSet.size === 0) {
      console.error('❌ [radius-guard] 无法判定:git ls-files 列出 0 个路径(空扫不报绿,真仓不可能没有跟踪文件)—— 不计通过')
      return 2
    }
    for (let i = files.length - 1; i >= 0; i--) if (!trackedSet.has(files[i])) files.splice(i, 1)
    if (files.length === 0) {
      console.error('❌ [radius-guard] 无法判定:全量候选为 0 文件(SCAN_DIRS ∩ 跟踪清单为空)—— 判据未能执行,不计通过')
      return 2
    }
  }
  // ── 取材迁移(2026-09-26,门 118 纪律)────────────────────────────────
  // 这一段起所有 **blob 正文**经共用层 `catBatch` **一次批量预取**,再逐路径读 map。
  // 旧形态是本文件自己逐文件派生 git 读内容(锚点一处 + 全量档异形文件一处),与本仓
  // 36/93/124 收口前同型:逐路径派生 = fork 风暴,且裸 'git' 在 GUI 宿主/服务账户的
  // PATH 下解析不通(§5b"git 调用不得依赖环境")。上面那批只**枚举路径/问存在性**的调用
  // (ls-files / diff --name-only / rev-parse)不读 blob、层无对应出口,刻意留原样。
  // 三面各归各位:全量档取 HEAD blob;--staged/--files 取工作树(既有约定,未被迁移顺手改掉)。
  const headSpecs = []
  if (auditHead) {
    if (diverged) for (const rel of files) if (diverged.has(rel)) headSpecs.push(`HEAD:${rel}`)
  } else {
    for (const rel of files) headSpecs.push(`HEAD:${rel}`)
  }
  let headBlobs
  try {
    headBlobs = catBatch(ROOT, headSpecs)
  } catch (e) {
    console.error(
      `❌ [radius-guard] 无法判定:HEAD blob 一次批量预取失败(${String(e?.message || e).split('\n')[0].slice(0, 180)})—— 判据未能执行,不记绿`,
    )
    return 2
  }
  const blobOf = makeBlobAccessor(headBlobs)
  const readWorktree = (rel) => readFileSync(join(ROOT, rel), 'utf8')
  const headCounts = new Map()
  const headCountOf = (rel) => {
    if (headCounts.has(rel)) return headCounts.get(rel)
    const blob = blobOf(`HEAD:${rel}`)
    // null = HEAD 里没有该文件(本次新增)→ 上限 0,任何绕档都算新增(与旧 catch 分支同义)
    const n = blob === null || blob === undefined ? 0 : scanText(rel, blob, table).length
    headCounts.set(rel, n)
    return n
  }
  const byFile = new Map()
  for (const rel of files) {
    const text = pickScanSource(rel, { auditHead, diverged, blobOf, readWorktree })
    if (text === null) continue // 该面取不到(HEAD 里已无此文件/工作区删除)→ 不属于本仓现状
    const vs = scanText(rel, text, table)
    if (!vs.length) continue
    byFile.set(rel, vs)
    for (const v of vs) violations.push({ file: rel, ...v })
  }
  const baselineSites = loadBaselineSites()
  const baselineCounts = new Map()
  for (const s of baselineSites) baselineCounts.set(s.file, (baselineCounts.get(s.file) || 0) + 1)
  // 容忍上限按模式取,理由不同:
  //   全量:内容就是 HEAD,上限只能来自人工登记的基线 —— 否则"仓里有多少就容忍多少",
  //        存量债永远照不出来(基线现为空 = 仓内绕档必须为 0)。
  //   暂存:改老文件不该替老债背红,故上限 += 该文件 HEAD 自身已有的量(相对 HEAD 只减不增)。
  const tolOf = (rel) => Math.max(baselineCounts.get(rel) || 0, isStaged || FILES_MODE ? headCountOf(rel) : 0)
  // 判据 C:覆盖面对账。与暂存范围无关,恒按全仓跟踪清单判 —— 静默逃逸不会因"本次没碰"而消失
  let cov = { red: [], exempt: [] }
  try {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28, timeout: 120000 })
      .split('\n')
      .filter(Boolean)
    cov = coverageAudit(tracked, (f) => readFileSync(join(ROOT, f), 'utf8'))
  } catch (e) {
    console.error(`❌ [radius-guard] 无法判定:判据 C 的跟踪文件清单取不到(git ls-files 失败:${String(e?.message || e).split('\n')[0]})—— 判据未能执行,既不记红也不记绿`)
    return 2
  }
  // 棘轮锚点从"会腐烂的手工清单"换成**该文件 HEAD 版本自身的违规数**:
  // 只拦"这次改动把绕档取用加回来了",不拦仓库既有债;工作区滞后既不能藏债也不能造债。
  const fresh = splitFresh(byFile, tolOf)
  const healed = baselineSites.filter((s) => !violations.some((v) => `${v.file}::${v.rule}::${v.raw}` === `${s.file}::${s.rule}::${s.raw}`))

  if (UPDATE_BASELINE) {
    const sites = violations.map((v) => ({ file: v.file, rule: v.rule, raw: v.raw })).sort((a, b) => `${a.file}${a.rule}${a.raw}`.localeCompare(`${b.file}${b.rule}${b.raw}`))
    writeFileSync(BASELINE_FILE, `${JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), note: '人工登记的存量兜底(只减不增)。常态应为空:自 2026-9-24 起本门棘轮锚点已是"该文件 HEAD 自身的违规数",不再依赖此清单;仅当某目录整体纳入扫描需一次性放行时才写。', sites }, null, 2)}\n`)
    console.log(`[radius-guard] 基线已下调:${sites.length} 处存量`)
    return 0
  }

  console.log(
    `[radius-guard] 判定面 ${
      isStaged
        ? '工作树(--staged 与本门既有约定:同 lint-staged 形态,**不是**索引 blob)'
        : FILES_MODE
          ? '工作树(--files 人工自验)'
          : 'HEAD blob(磁盘≠HEAD 者按 HEAD 取)'
    } | 扫描 ${files.length} 文件(B 射程外按声明摘除 ${bExcludedCount} 个)| 违规 ${violations.length} 处(HEAD 自身/基线容忍 ${violations.length - fresh.length} / 新增 ${fresh.length})| 基线已修 ${healed.length} 处 | 覆盖面对账:范围外已声明 ${cov.exempt.length} 个、未归类 ${cov.red.length} 个`,
  )
  if (tableErrors.length) {
    console.error('\n❌ 档位表漂移(单一源头被破,必须修):')
    for (const e of tableErrors) console.error('   -', e)
  }
  if (cov.red.length) {
    console.error('\n❌ 判据 C:这些文件含圆角取用,却既不在 SCAN_DIRS 覆盖内、也未声明为范围外 ——')
    console.error('   等于新增端/目录静默绕开本门。要么把目录加进 SCAN_DIRS,要么在 OUT_OF_SCOPE 写明为什么不适用:')
    for (const c of cov.red.slice(0, 20)) console.error(`   - ${c.file}`)
    if (cov.red.length > 20) console.error(`   ...另有 ${cov.red.length - 20} 个`)
  }
  if (cov.exempt.length && !isStaged) {
    const byCat = {}
    for (const e of cov.exempt) byCat[e.category.split(':')[0]] = (byCat[e.category.split(':')[0]] || 0) + 1
    console.log(`   已声明范围外(如实报数,便于质疑):${Object.entries(byCat).map(([k, n]) => `${k}×${n}`).join(', ')}`)
  }
  if (fresh.length) {
    const byRule = {}
    for (const v of fresh) byRule[v.rule] = (byRule[v.rule] || 0) + 1
    console.error(`\n❌ 新增 ${fresh.length} 处绕开圆角档位表(${Object.entries(byRule).map(([k, n]) => `${k}×${n}`).join(', ')}):`)
    for (const v of fresh.slice(0, 40)) console.error(`   ${v.file}:${v.line}  [${v.rule}] ${v.raw}  → ${v.hint}`)
    if (fresh.length > 40) console.error(`   ...另有 ${fresh.length - 40} 处`)
    //  HEAD 已迁移而待提交内容仍有违规 = 草稿落在迁移前的旧基线上(共享工作区滞后),
    //  不是"你写错了档位",正解是把改动重做到 HEAD 版本之上。
    //  2026-09-26 取材收口:全量档下旧写法仍会逐文件去读 HEAD blob,而 `(isStaged||FILES_MODE)`
    //  为假时结果恒为空 ⇒ 判据一字未动,只把短路提到读之前(全量档不再为该目的派生任何 blob)。
    const staleBase = isStaged || FILES_MODE ? [...byFile.keys()].filter((f) => headCountOf(f) === 0) : []
    if (staleBase.length) {
      console.error(`\n   ⚠️ 其中这些文件的 **HEAD 版本 0 违规**、待提交内容却有违规 → 你的草稿基于旧基线(圆角迁移已落在 HEAD):`)
      for (const f of staleBase.slice(0, 10)) console.error(`      - ${f}  (对照: git show HEAD:${f})`)
      console.error('      修法:按上面的档位提示改写这几行,或把改动重做到 HEAD 版本之上;不得整文件回写旧基线(守门 76 会按静默回滚拦)。')
    }
  }
  if (healed.length && !isStaged) console.log(`💡 ${healed.length} 处存量已修,可跑 node scripts/check-radius-single-source.mjs --update-baseline 下调基线`)
  const red = tableErrors.length > 0 || fresh.length > 0 || cov.red.length > 0
  if (!red) console.log('✅ 圆角单一源头对账通过(档位表一致,无新增绕档取用,覆盖面全部归类)')
  return red ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error(`❌ 守门自身异常:${e?.stack || e}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
