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
 *  B4 `rounded-[...]` 任意值 → 必须换档位类(或 var(--radius-*))
 *     唯一放行:`0` / `none` / `inherit` / 同行或紧邻上行含 `radius-exempt:` 标记(真圆、头像、
 *     装饰点、胶囊等几何圆按 AGENTS §4 豁免清单本就不该方档化,但必须写明原因,不得静默)。
 *  B5 SVG `rx`/`ry`:静态 .svg 须等于档位值(没有 JS 通道),JSX 内联须引用 rnRadius.<step>。
 *  B6 引用了 `rnRadius` / `RADIUS_CSS_PX` 却没在本文件 import 它们 → 红。
 *     本门判的是 HEAD 内容,而 `pnpm typecheck` 只跑 worktree —— 悬空标识符属于"两边都不红"
 *     的那一类(前向移植 / 批量改写的典型遗留),只能在读 HEAD blob 的这里补上。
 *     import 常写成多行,必须在整条 `{…}` 括号里找名字。
 *  B 走 **HEAD 锚点棘轮**:每文件容忍上限 = 该文件 HEAD 版本自身的违规数(全量审计时上限只来自
 *    人工基线,因为内容就是 HEAD)。只拦"这次改动把绕档加回来了",不拦仓库既有债。
 *    锚点原先是一份手工维护的 JSON 清单,它有两个致命伤:并行会话把已迁好的路径整文件回写成
 *    旧基线时它照样绿(实测 HEAD 曾因此积累 1179 处),而工作区滞后的旧草稿又会被它误记成本仓债务。
 *    scripts/radius-single-source-baseline.json 保留为人工兜底(现应为空)。
 *
 * 用法:
 *   node scripts/check-radius-single-source.mjs              # 全量审计(基线外新增即红)
 *   node scripts/check-radius-single-source.mjs --staged     # pre-commit:只扫暂存文件
 *   node scripts/check-radius-single-source.mjs --self-test  # 判据正反例取证
 *   node scripts/check-radius-single-source.mjs --update-baseline  # 清理后下调基线(须人工确认)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

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
  if (step === null) return `档位表无 ${px}px(就近 ${table.nearest(px)};几何圆请加 radius-exempt)`
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

export function scanText(rel, text, table) {
  const bad = []
  const lines = text.split('\n')
  const steps = Object.entries(table.RADIUS_STEPS).map(([, v]) => v)
  const marked = (i) => /radius-exempt/.test(lines[i]) || (i > 0 && /radius-exempt/.test(lines[i - 1]))
  lines.forEach((line, i) => {
    const t = line.trim()
    if (/^(\/\/|\*|\/\*|<!--|#\s|;;)/.test(t)) return
    const isDocLike = /\.html$/i.test(rel)
    if (isCss(rel) || isDocLike || isJsx(rel)) {
      // 不锚定行首:一行里可能有 `width: 16px; border-radius: 50%` 多声明,
      // 且 .ts 里会内嵌生成的 HTML/CSS(cli 分享页),两类都得看见
      if (TABLE_FILES.test(rel)) return
      const m = /(^|[;{}\s])(border(?:-top|-bottom)?(?:-left|-right)?-radius\s*:\s*)([^;}\n'"]+)/.exec(line)
      if (m) {
        const val = m[3].trim()
        if (!/var\(--radius|inherit|none/.test(val)) {
          if (/50%|9999px/.test(val)) {
            if (!marked(i)) bad.push({ line: i + 1, rule: 'B3-circle', raw: val, hint: '真圆/胶囊须加 /* radius-exempt: 原因 */' })
          } else {
            for (const part of val.split(/\s+/)) {
              const mm = /^([0-9.]+)(rpx|px|rem|em)$/.exec(part)
              if (!mm) continue
              const px = mm[2] === 'rpx' ? Number(mm[1]) / 2 : mm[2] === 'px' ? Number(mm[1]) : Number(mm[1]) * 16
              if (px === 0) continue
              if (!marked(i)) {
                if (steps.includes(px)) bad.push({ line: i + 1, rule: 'B3', raw: part, hint: `应写 var(--radius-*)(${table.stepOf(px) ?? px})` })
                else bad.push({ line: i + 1, rule: 'B3-off', raw: part, hint: `偏档字面量;就近档位 = ${table.nearest(px)}` })
              }
            }
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
          const px = raw.startsWith('rpx(') ? Number(raw.slice(4, -1)) / 2 : Number(raw)
          if (px === 0) return
          if (marked(i)) return
          bad.push({ line: i + 1, rule: raw.startsWith('rpx(') ? 'B1-rpx' : 'B1', raw, hint: `应写 ${targetOf(table, px)}(几何圆请加 radius-exempt)` })
        } else {
          const val = (m[3] || '').trim()
          if (/var\(--radius|inherit|none/.test(val)) return
          if (/50%|9999px/.test(val)) {
            if (!marked(i)) bad.push({ line: i + 1, rule: 'B1-circle', raw: m[1], hint: '字符串形态的纯圆/胶囊同样要 radius-exempt 标记' })
            return
          }
          for (const part of val.split(/\s+/)) {
            const mm = /^([0-9.]+)(rpx|px|rem|em)$/.exec(part)
            if (!mm) continue
            const px = mm[2] === 'rpx' ? Number(mm[1]) / 2 : mm[2] === 'px' ? Number(mm[1]) : Number(mm[1]) * 16
            if (px === 0 || marked(i)) continue
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
      if (mc && !marked(i)) bad.push({ line: i + 1, rule: 'B2', raw: `${mc[1]}=${mc[2]}`, hint: '本地圆角/圆点半径常量应直接引用 rnRadius.<step>' })
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
      if (!Number.isFinite(px) || px === 0 || marked(i)) continue
      if (staticSvg && steps.includes(px)) continue
      bad.push({ line: i + 1, rule: 'B5', raw: `${r5[1] || r5[4]}=${raw}`, hint: staticSvg ? `静态 SVG 圆角须等于档位值(${table.nearest(px)})或加 radius-exempt 注释` : `SVG 圆角应引用档位 ${targetOf(table, px)}` })
    }
    const arb = /\brounded(?:-[a-z0-9]+)*-\[([^\]]+)\]/g
    let a
    while ((a = arb.exec(line))) {
      if (/var\(--radius/.test(a[1]) || marked(i)) continue
      bad.push({ line: i + 1, rule: 'B4', raw: a[0], hint: '任意值须换档位类 rounded-<step>' })
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
      const used = lines.some((l, k) => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l) && new RegExp(`\\b${name}\\s*\\.`).test(l))
      if (!used) continue
      if (importLists.some((s) => new RegExp(`[\\s,{]${name}(?:\\s+as\\s+\\w+)?\\s*(?:,|$)`).test(s))) continue
      bad.push({ line: 1, rule: 'B6', raw: `${name} 被使用但未 import`, hint: `须在 '@ihui/design-tokens' 的 import 列表里带上 ${name},否则该文件在 HEAD 上直接编译不过` })
    }
  }
  return bad
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
    { name: 'B1 几何圆带标记放行', f: 'packages/app/src/x.tsx', s: 'const st = { a: { borderRadius: 24 } } // radius-exempt: 48dp 头像正圆', red: false },
    { name: 'B1 rpx 绕档必拦', f: 'apps/mobile-rn/src/x.tsx', s: 'const st = { a: { borderRadius: rpx(16) } }', red: true },
    { name: 'B2 本地常量必拦', f: 'apps/mobile-rn/src/x.tsx', s: 'const CARD_RADIUS = 12', red: true },
    { name: 'B2 引用档位放行', f: 'apps/mobile-rn/src/x.tsx', s: "import { rnRadius } from '@ihui/design-tokens'\nconst CARD_RADIUS = rnRadius.xl", red: false },
    { name: 'B3 CSS 字面量必拦', f: 'apps/miniapp-taro/src/a.css', s: '  border-radius: 24rpx;', red: true },
    { name: 'B3 CSS var 放行', f: 'apps/miniapp-taro/src/a.css', s: '  border-radius: var(--radius-xl);', red: false },
    { name: 'B3 圆形无标记必拦', f: 'apps/web/app/x.css', s: '  border-radius: 50%;', red: true },
    { name: 'B3 圆形带标记放行', f: 'apps/web/app/x.css', s: '  border-radius: 50%; /* radius-exempt: 头像 */', red: false },
    { name: 'B3 注释行放行', f: 'apps/web/app/x.css', s: '  /* border-radius: 24rpx; */', red: false },
    { name: 'B3 tokens.css 自身定义行放行', f: 'packages/design-tokens/src/styles/tokens.css', s: '  border-radius: 8px;', red: false },
    { name: 'B4 任意值必拦', f: 'apps/miniapp-taro/src/a.tsx', s: '<View className="rounded-[24rpx]" />', red: true },
    { name: 'B4 var 形式放行', f: 'apps/miniapp-taro/src/a.tsx', s: '<View className="rounded-[var(--radius-lg)]" />', red: false },
    { name: 'B3 一行多声明也要看见(width…; border-radius: 50%)', f: 'apps/desktop/src-tauri/offline/index.html', s: '    width: 16px; height: 16px; border-radius: 50%;', red: true },
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
  // A 表对账:CSS 值漂移必须识别
  const css = '--radius: 0.5rem;\n  --radius-xs: 0.125rem;\n  --radius-sm: 0.3rem;\n'
  const map = readCssRadius(css)
  const driftOk = Math.abs(map['--radius-sm'] - 4.8) < 0.01
  console.log(driftOk ? '✅' : '❌', 'A 判据能读出 CSS 漂移值 sm=4.8px', driftOk ? '' : JSON.stringify(map))
  if (!driftOk) fail++
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
  const total = cases.length + 3 + ratchet.length
  console.log(fail ? `\n${fail}/${total} 例失败` : `\n全部 ${total} 例通过`)
  process.exit(fail ? 1 : 0)
}

async function main() {
  if (SELF_TEST) {
    await selfTest()
    return 0
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
  if (FILES_MODE) {
    for (const f of fileList) if (!skipped(f.replaceAll('\\', '/'))) files.push(f.replaceAll('\\', '/'))
  } else if (isStaged && STAGED_SET) {
    for (const f of STAGED_SET) if (!skipped(f) && !isDoc(f)) files.push(f)
  } else {
    for (const d of SCAN_DIRS) for (const abs of walk(join(ROOT, d))) {
      const rel = relative(ROOT, abs).replaceAll('\\', '/')
      if (skipped(rel) || isDoc(rel) || /(^|\/)\.d\.ts$/.test(rel)) continue
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
  if (auditHead && trackedSet) {
    for (let i = files.length - 1; i >= 0; i--) if (!trackedSet.has(files[i])) files.splice(i, 1)
  }
  const headCounts = new Map()
  const headCountOf = (rel) => {
    if (headCounts.has(rel)) return headCounts.get(rel)
    let n = 0
    try {
      n = scanText(rel, gitRo(['show', `HEAD:${rel}`]), table).length
    } catch {
      n = 0 // HEAD 无此文件(本次新增)→ 上限 0,任何绕档都算新增
    }
    headCounts.set(rel, n)
    return n
  }
  const byFile = new Map()
  for (const rel of files) {
    let text
    try {
      text = auditHead && diverged && diverged.has(rel) ? gitRo(['show', `HEAD:${rel}`]) : readFileSync(join(ROOT, rel), 'utf8')
    } catch {
      continue // HEAD 里已无此文件(工作区滞后或删除)→ 不属于本仓现状
    }
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
    console.error(`❌ 判据 C 无法执行(git ls-files 失败):${e?.message || e} —— 按失败处理,不静默放行`)
    tableErrors.push('覆盖面对账(判据 C)未能执行')
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
    `[radius-guard] 扫描 ${files.length} 文件 | 违规 ${violations.length} 处(HEAD 自身/基线容忍 ${violations.length - fresh.length} / 新增 ${fresh.length})| 基线已修 ${healed.length} 处 | 覆盖面对账:范围外已声明 ${cov.exempt.length} 个、未归类 ${cov.red.length} 个`,
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
    const staleBase = [...byFile.keys()].filter((f) => headCountOf(f) === 0 && (isStaged || FILES_MODE))
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
