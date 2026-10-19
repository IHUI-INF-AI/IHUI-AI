#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-miniapp-taro-design-tokens.mjs — miniapp-taro design-tokens 同步守门(P3-1.3 立,2026-08-01)。
 *
 * 作用:校验 `apps/miniapp-taro/src/app.css` **首个** `:root` / `.dark` 块里的 design-token 档值,
 *       与 `packages/design-tokens/src/styles/tokens.css`(单一真相源)逐位一致。
 *       子集检查:只判副本已有的键 —— 「源头有、副本缺」由已接线的守门 36
 *       (`check-miniapp-tokens-sync.mjs`,判缺档 + `@theme` 注册面)负责,本门不重复判、也不冒充它。
 *       另判 `apps/miniapp-taro/src/app.config.ts` 的硬编码色值(warn-only,不改退出码)。
 *
 * 背景:Taro 4 + Tailwind v3 不识别 v4 的 `@theme` 语法,无法 `@import tokens.css`,
 *       需把 `:root` / `.dark` 抄一份到端内(写回侧 = `scripts/sync-miniapp-tokens.mjs`)。
 *       值漂移 = 视觉 bug,本脚捕获。
 *
 * 取材面(2026-10-17 收口,同守门 36/77/83/93/103/118 口径):
 *   默认判 **HEAD blob**(全量档),`--staged` 判**索引 blob**(本次提交会带走的那一份 ——
 *   盘上随后改对不算修好),`--worktree` 只作人工逃生舱;两个面旗同给 = 自相矛盾 ⇒ 判死;
 *   任一面取不到 ⇒ **exit 2「无法判定」**,既不冒红也绝不记绿,而且**不回落到另一个面**
 *   (回落就是把"没判"写成"判过了",§0.3)。
 *   三份输入(tokens.css / app.css / app.config.ts)由**同一次** `cat-file --batch` 同面同轮读完:
 *   清单与内容分两面取材正是守门 118 记过的"两面各自都没问题、悬留替红顶绿"的成因。
 *   改造前本门体只读磁盘(`selectFace` / `--staged` / `--worktree` 三个关键词命中数 = 0),
 *   所以台账票面写的"该门体没有任何面旗 ⇒ 现在接不得"就是这一格。本票解除的是**取材面**那一半;
 *   **接线本身(定级、skipEnv、文档点名)不在本票射程内**,故本头注不自称已接线
 *   (§0.9「造好没装车 = 没有」;守门 89 R1/R2 拦的正是"头注撒谎")。
 *
 * 判据的取块/取声明一律走 `scripts/lib/design-token-blocks.mjs` 那一份实现(§0.6 单一真相源)。
 *   本文件此前自己抄了一份 `extractAllBlocks` / `stripComments`,与 lib 那份**不同形**
 *   (lib 版要求选择器落在行首,旧版不限),2026-10-17 起本地副本已删。同形性不是靠"看起来一样":
 *   在 HEAD 面与索引面上实测两边都取到 137(:root 首块)+ 101(.dark)档、0 处漂移,逐字相同。
 *   档名 7 类判据(color/radius/chart/font/animate/z/shadow)同样走 lib 新出口
 *   `isDesignTokenVarName`;**残余**:`scripts/check-design-tokens-sync.mjs` 仍持有自己那份逐字
 *   相等的常量(本票射程外,收它进 lib 是后手)。
 *
 * 空扫不记绿(§0.3):副本首块里一个 design-token 档都没有 ⇒ 判据没吃到输入 ⇒ exit 2,
 *   而不是旧写法的 `[PASS] 0 variables in sync`;源头为空同理。
 *
 * ⚠️ 历史处置结论(2026-09-25 逐行审计,原文保留只作改判留痕,不得当口径引用):当时判为
 *   「**冗余 —— 未接线,本文件当前无任何调度器执行,勿再接线**」,理由有两半:
 *   ① 校验 1 与 `check-design-tokens-sync.mjs --target=miniapp-taro` 逐行同体(同一份档名表、
 *      同一套取块、同为"只判副本已有键");后者的执行者是 `scripts/run-8end-consistency-cert.mjs`
 *      的 id `design-tokens-sync-miniapp`(warnOnly:false)⇒ 那条判据并没失守,只是执行者不是本文件。
 *   ② 门体没有任何面旗 ⇒ 接不得。
 *   本次(2026-10-17)解除的是 ②;① 仍然成立,覆盖面差的实测登记如下(数字以命令现读为准):
 *     id 36 = 仅 `--color-*` × **全部 3 个** `:root` 块 + `.dark` = 175 个键
 *     本门  = 7 类 token × **仅首块** = 133 个键(2026-09-25 读数;现读见结论行)
 *   本门独有档位全是非 color(`--radius*` + `--chart-*`),前者提交链已由守门 77 判据 A 判,
 *   后者只在 CI 侧判 ⇒ "不接线"不等于零残余。定级(warn / blocking)由接线者按现读存量落,
 *   本文件不代拍;§12e 的前置是"升 blocking 的存量必须归零"。
 *
 * 用法:
 *   node scripts/check-miniapp-taro-design-tokens.mjs              全量(HEAD blob)
 *   node scripts/check-miniapp-taro-design-tokens.mjs --staged     索引面
 *   node scripts/check-miniapp-taro-design-tokens.mjs --worktree   人工排查(提交链不走这档)
 *   node scripts/check-miniapp-taro-design-tokens.mjs --quiet      只出错才说话
 *   node scripts/check-miniapp-taro-design-tokens.mjs --self-test  判据自检(含临时 git 仓三面分叉正控)
 *   node scripts/check-miniapp-taro-design-tokens.mjs --help       帮助
 *
 * 退出码:0 = 逐位同值;1 = 检出值漂移;2 = **未判定**(取不到被审面 / 枚举到 0 个候选 / 两个面旗同给)
 *   —— 三支"未判定"一律在 stdout/stderr 里点名是哪一份输入或哪一对旗子,既不记绿也不冒红(§0.3);
 *   真缺口才 exit 1,真判过才 exit 0。措辞用「无法判定(未判定 …)」与本族守门 36/47/218 同形。
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 取材只走这一层:绝对路径 git、safe.directory、quotepath、windowsHide、maxBuffer、
// "输出被截断 ⇒ 无法判定" —— 这几处易错点各门自己写一遍就会各漏一遍(AGENTS §4 / 守门 118)。
import { Undetermined, catBatch, gitBinary, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { collectDecls, extractAllBlocks, isDesignTokenVarName } from './lib/design-token-blocks.mjs'
// 三份输入的路径常量与写回侧生成器同源(§0.6):门里不得再抄第二份 `apps/miniapp-taro/...` 字面量。
import { APP_CSS_REL, TOKENS_SOURCE_REL } from './sync-miniapp-tokens.mjs'
// 仅自检夹具用:临时 git 仓唯一落点 + 闭包推导复制 + 用例登记唯一出口。
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { copyScriptWithClosure } from './lib/scratch-module-closure.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'

const NAME = 'check-miniapp-taro-design-tokens'
/**
 * 应急放行变量的**唯一名源**:登记进 `scripts/guardian-runner.mjs` 的 `skipEnv` 必须与此逐字相同
 * (镜像测试 `scripts/tests/check-miniapp-taro-design-tokens.test.mjs` F3 双向钉这个名字)。
 * 本门体**尚未被 runner 注册**(定级由接线者按现读存量落,见头注),在此之前这个变量不生效 ——
 * 名字先立在这里,是为了接线那一笔不必回来改判据文件。
 */
const SKIP_ENV = 'HUSKY_SKIP_MINIAPP_TARO_DESIGN_TOKENS'
const HERE = dirname(fileURLToPath(import.meta.url))
const root = join(HERE, '..')

/**
 * `app.config.ts` 与 `app.css` 同目录 ⇒ 路径从单源常量派生,而不是再抄一份字面量。
 * 用字符串替换而不是 `path.join/posix.dirname`:后两者在 Windows 上会把分隔符写成 `\`,
 * 而拼出来的串要直接喂给 `git show HEAD:<rel>` —— 反斜杠规格在 git 里恒取不到,
 * 于是"能判的形状"退化成"永远未判定"。
 */
const APP_CONFIG_REL = APP_CSS_REL.replace(/[^/]+$/, 'app.config.ts')
/** 同面同轮一次读完的清单(顺序即结论行报出的顺序)。 */
const FACE_RELS = [TOKENS_SOURCE_REL, APP_CSS_REL, APP_CONFIG_REL]

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/**
 * 「未判定」话术的唯一出处:三支判死路径(取不到被审面 / 枚举到 0 个候选 / 两个面旗同给)
 * 共用同一句话,措辞与本族守门 36/47/218 同形(「无法判定」+「未判定」两者都出现 ——
 * 前者是族内既有锚点,后者是 §0.3 的台账用词,镜像测试按本常量断言而不是自己再抄一份字面量)。
 */
const UNDET_TXT = '无法判定(未判定 ⇒ 既不记绿也不冒红)'

/**
 * 纯函数:argv → 判定面(默认 head)。导出是为了让"默认档不是磁盘"这一格能被构造面证明,
 * 而不是等人跑一次真仓看一眼结论行 —— 结论行会被人改,函数不会。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

/**
 * 按判定面取**全部三份**输入,一次 `cat-file --batch` 同面同轮读完。
 * 混面会在并发会话的瞬间产出假红/假绿;取不到一律抛 `Undetermined`(调用方折成 exit 2),
 * **不回落**到另一个面。root/face 都是入参:镜像测试因此能在临时 git 仓里造
 * "索引≠磁盘"的现场,而不依赖真仓瞬时状态(真仓三面同结论是常态,拿它取证等于什么都没测)。
 */
export function readFaceInputs(repoRoot, face) {
  const out = {}
  if (face === 'worktree') {
    for (const rel of FACE_RELS) {
      const t = readWorktreeFile(repoRoot, rel)
      if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${rel}`)
      out[rel] = t
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = FACE_RELS.map((rel) => prefix + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
  for (let i = 0; i < FACE_RELS.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined)
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${FACE_RELS[i]}`)
    out[FACE_RELS[i]] = t
  }
  return out
}

/**
 * 取某个 CSS 文本里 design-token 档的**最终值表**。
 * `firstOnly` = 只取每个选择器的首块:app.css 的第二个 `:root` 是端内自立色板
 * (注释自述"本块不会被覆盖"),它不归 tokens.css 管,合并进来就是一堆假红。
 * 取块与取声明都走 lib 那一份实现(§0.6),本文件不再自己解析花括号。
 */
export function collectTokenVars(css, selectors, { firstOnly = false } = {}) {
  const vars = {}
  for (const sel of selectors) {
    const blocks = extractAllBlocks(css, sel)
    const take = firstOnly ? blocks.slice(0, 1) : blocks
    for (const block of take)
      for (const d of collectDecls(block)) if (isDesignTokenVarName(d.name)) vars[d.name] = d.value
  }
  return vars
}

/**
 * 纯判据:副本首块已有的档必须在源头里等值存在(子集检查,缺档归守门 36 判)。
 * @returns {{diffs:Array<{block:string,name:string,app:string,tok:string}>,checked:number,source:number}}
 *   checked = 真的进入比对的档数(0 ⇒ 空扫 ⇒ 调用方判"未判定",不得记绿);
 *   source  = 源头侧同名并集大小(0 ⇒ 判据无输入 ⇒ 同样"未判定")。
 */
export function compare({ tokensCss, appCss }) {
  const appRoot = collectTokenVars(appCss, [':root'], { firstOnly: true })
  const appDark = collectTokenVars(appCss, ['.dark'], { firstOnly: true })
  const tokRoot = collectTokenVars(tokensCss, ['@theme', ':root'])
  const tokDark = collectTokenVars(tokensCss, ['.dark'])
  const diffs = []
  for (const [block, have, want] of [
    [':root', appRoot, tokRoot],
    ['.dark', appDark, tokDark],
  ]) {
    for (const [name, val] of Object.entries(have)) {
      const t = want[name]
      if (t === undefined || t !== val) diffs.push({ block, name, app: val, tok: t ?? '<missing>' })
    }
  }
  return {
    diffs,
    checked: Object.keys(appRoot).length + Object.keys(appDark).length,
    source: Object.keys(tokRoot).length + Object.keys(tokDark).length,
  }
}

/**
 * 从 app.config.ts 提取硬编码色值(warn-only,不改退出码)。
 * 原生导航栏/tabBar 无法用 CSS var,所以这条路不是债,只是需要被看见。
 * @returns {Array<{line:number,value:string,context:string}>}
 */
export function extractHardcodedColors(content) {
  const lines = content.split('\n')
  const results = []
  const colorRe = /(#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\))/g
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return
    const re = new RegExp(colorRe.source, 'g')
    let m
    while ((m = re.exec(line)) !== null) {
      const before = line.slice(0, m.index).trim()
      const keyMatch = before.match(/(\w+)\s*:\s*$/)
      results.push({ line: idx + 1, value: m[1], context: keyMatch ? keyMatch[1] : before.slice(-30) })
    }
  })
  return results
}

// ─────────────────────────── 自检 ───────────────────────────
// 夹具分两层:C 组是纯内存判据(成对正反 —— 只证"会红"不证"不该红时不红"的判据等于没有);
// F 组必须走**真临时 git 仓 + 真 CLI**,因为"判定面"这件事在真仓上证不出来:三面此刻同结论,
// 拿真仓断言"读的是哪一面"就是一条恒绿断言。三面分叉只在构造面里存在。
// 落点 = scripts/lib/scratch-dir.mjs(§15b);仓库树内 git init 会被扫成嵌套仓(守门 208)。

const FIX_TOKENS = `@theme {
  --color-bg: white;
  --color-primary: black;
}
:root {
  /* 注释里的 --color-bait: 散文不是声明; */
  --radius: 4px;
  --chart-1: #aaaaaa;
  --spacing-2: 8px;
  --color-grad: linear-gradient(
    112deg,
    red 0%
  );
}
:root { --color-late: #123456; }
.dark {
  --color-bg: black;
  --radius: 8px;
  --chart-1: #333333;
}
`

const FIX_APP = `/* 端内入口样式:受管块由 scripts/sync-miniapp-tokens.mjs 原位写回 */
:root {
  --color-bg: white;
  --radius: 4px;
  --chart-1: #aaaaaa;
  --color-grad: linear-gradient( 112deg, red 0% );
}
/* ===== 端内自立色板(本门只看首块,这一块的漂移不归它判)===== */
:root {
  --color-late: #999999;
}
.dark {
  --color-bg: black;
  --radius: 8px;
  --chart-1: #333333;
}
`

const FIX_CONFIG = `export default defineAppConfig({
  window: {
    navigationBarBackgroundColor: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
})
`

/** 首块里一条被改 ⇒ 唯一可能的红点;档名不写死在断言里,夹具改了也不腐烂。 */
function driftFirstRoot(css, name, value) {
  const next = css.replace(new RegExp(`(^|\\n)(\\s*${name}: )[^;]+;`), `$1$2${value};`)
  if (next === css) throw new Error(`夹具没改到 ${name}(档名或排版与夹具不符)`)
  return next
}

/**
 * 只改**指定选择器的首块**里的那一条。
 * 为什么不能沿用 `driftFirstRoot`(全文 replace):同一个档名(如 `--radius`)在 `:root` 与
 * `.dark` 两区都出现,全文 replace 永远先命中排在前面的 `:root` —— "我改的是 .dark 面"这句前提
 * 于是根本没被执行,断言等的红点也不会来(守门 36 的镜像测试栽过同一格,教训逐字同形)。
 */
function driftInBlock(css, selector, name, value) {
  const head = `${selector} {`
  const at = css.indexOf(head)
  if (at < 0) throw new Error(`夹具里没有 ${selector} 块`)
  const end = css.indexOf('}', at)
  const seg = css.slice(at, end)
  const re = new RegExp(`(${name}: )[^;]+;`)
  if (!re.test(seg)) throw new Error(`夹具的 ${selector} 首块里没有 ${name}`)
  return css.slice(0, at) + seg.replace(re, `$1${value};`) + css.slice(end)
}

function putFile(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/**
 * 在 scratch 里建一个真 git 仓:门体连同**推导出的** import 闭包拷进去(手抄清单必然晚一拍,
 * 少一跳就是 ERR_MODULE_NOT_FOUND,而那会被下游读成"判据通过"),再按参数决定建不建索引/提交。
 * `git:false` = 完全不建仓(证明取不到 ⇒ 未判定,而不是悄悄回落磁盘冒绿);
 * `commit:false` = 有仓但没有 HEAD(同一份磁盘内容,判死与判绿只差在这个面上)。
 */
function buildFixture({
  tokensCss = FIX_TOKENS,
  appCss = FIX_APP,
  appConfig = FIX_CONFIG,
  git = true,
  commit = true,
}) {
  const dir = mkScratch('miniapp-taro-dt-')
  copyScriptWithClosure(HERE, `${NAME}.mjs`, join(dir, 'scripts'), [
    'lib/design-token-blocks.mjs',
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
    'sync-miniapp-tokens.mjs',
  ])
  putFile(dir, TOKENS_SOURCE_REL, tokensCss)
  putFile(dir, APP_CSS_REL, appCss)
  putFile(dir, APP_CONFIG_REL, appConfig)
  if (!git) return dir
  const run = (...a) => {
    const r = spawnSync(
      gitBinary(),
      [
        '-c', 'safe.directory=*',
        '-c', 'core.quotepath=false',
        '-c', 'core.autocrlf=false',
        '-C', dir,
        ...a,
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    if (r.status !== 0) throw new Error(`git ${a.join(' ')} 失败:${String(r.stderr ?? '').trim()}`)
    return String(r.stdout ?? '').trim()
  }
  run('init', '-q', '--initial-branch=main')
  run('config', 'user.name', 'gate-fixture')
  run('config', 'user.email', 'gate-fixture@invalid')
  run('config', 'core.hooksPath', join(dir, '.no-hooks'))
  if (!commit) return dir
  run('add', '-A')
  run('commit', '-qm', 'fixture')
  return { dir, run }
}

/** 三面各给一份内容:HEAD=appCssHead、索引=appCssIndex、盘上=appCssWorktree(缺省逐层继承)。 */
function buildFaceFixture({ appCssHead, appCssIndex, appCssWorktree, tokensCss = FIX_TOKENS }) {
  const fx = buildFixture({ tokensCss, appCss: appCssHead })
  const index = appCssIndex ?? appCssHead
  const worktree = appCssWorktree ?? index
  putFile(fx.dir, APP_CSS_REL, index)
  fx.run('add', '--', APP_CSS_REL)
  putFile(fx.dir, APP_CSS_REL, worktree)
  return fx
}

function runCli(dir, args = []) {
  const r = spawnSync(process.execPath, [join(dir, 'scripts', `${NAME}.mjs`), ...args], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
    // 显式清空应急放行变量:本机一旦带着它跑自检,四支"未判定"路径会整道静默 exit 0,
    // 于是 F4~F9 全部**假绿**(判据失效的表现永远是安静)。
    env: { ...process.env, [SKIP_ENV]: '' },
  })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, last: String(`${r.stdout ?? ''}${r.stderr ?? ''}`).trim().split(/\r?\n/).pop() ?? '' }
}

function selfTest() {
  const { t, report } = makeRegistrar()
  const fixtures = []
  /** 建夹具并把清理挂上:report() 之前不删(thunk 求值点在那儿)。 */
  const fx = (build) => {
    const one = build()
    fixtures.push(one)
    return one
  }
  const dirOf = (one) => (one.dir ? one.dir : one)

  // ── C 组:纯内存判据,成对 ──
  const base = compare({ tokensCss: FIX_TOKENS, appCss: FIX_APP })
  t('C1 反控(防恒红):副本与源头同形 ⇒ 0 漂移', () => base.diffs.length === 0)
  t('C1b 夹具真的有档可判(否则 C1 是空转)', () => base.checked === 7 && base.source > 0, `checked=${base.checked}`)

  const drift = compare({ tokensCss: FIX_TOKENS, appCss: driftFirstRoot(FIX_APP, '--color-bg', '#eee') })
  t('C2 阳性:首块某档被改 ⇒ 必红且点名两侧读数', () =>
    drift.diffs.length === 1 &&
    drift.diffs[0].name === '--color-bg' &&
    drift.diffs[0].block === ':root' &&
    drift.diffs[0].app === '#eee' &&
    drift.diffs[0].tok === 'white', JSON.stringify(drift.diffs))

  const driftDark = compare({ tokensCss: FIX_TOKENS, appCss: driftInBlock(FIX_APP, '.dark', '--radius', '2px') })
  t('C3 阳性:.dark 首块被改 ⇒ 必红且点名 .dark 面', () =>
    driftDark.diffs.length === 1 && driftDark.diffs[0].block === '.dark' &&
    driftDark.diffs[0].name === '--radius' && driftDark.diffs[0].tok === '8px',
    JSON.stringify(driftDark.diffs))

  const subset = compare({ tokensCss: FIX_TOKENS, appCss: driftFirstRoot(FIX_APP, '--chart-1', '#eeeeee') })
  t('C4 子集语义:源头独有档(@theme 的 --color-primary)不得被算成本门的红', () =>
    subset.diffs.length === 1 && !subset.diffs.some((d) => d.name === '--color-primary'),
    JSON.stringify(subset.diffs))

  const extBlock = compare({ tokensCss: FIX_TOKENS, appCss: `${FIX_APP}\n:root {\n  --color-bg: #111111;\n}\n` })
  t('C5 首块语义(反控):端内第二块的漂移不归本门判 ⇒ 不得因此变红', () => extBlock.diffs.length === 0,
    JSON.stringify(extBlock.diffs))
  const firstBlockLast = compare({
    tokensCss: FIX_TOKENS,
    appCss: FIX_APP.replace(':root {\n  --color-bg: white;', ':root {\n  --color-bg: #111111;\n  --color-bg: white;'),
  })
  t('C5b 首块内同名重复声明取**最后一条**(与 CSS 层叠同形;旧实现按正则先后覆盖,结论一致)', () =>
    firstBlockLast.diffs.length === 0, JSON.stringify(firstBlockLast.diffs))
  const firstBlockWin = compare({
    tokensCss: FIX_TOKENS,
    appCss: FIX_APP.replace(':root {\n  --color-bg: white;', ':root {\n  --color-bg: white;\n  --color-bg: #111111;'),
  })
  t('C5c 阳性:同一档在首块里被后写的值改坏 ⇒ 必须红(反证 C5b 不是"整块失明")', () =>
    firstBlockWin.diffs.length === 1 && firstBlockWin.diffs[0].app === '#111111',
    JSON.stringify(firstBlockWin.diffs))

  const nonColor = compare({ tokensCss: FIX_TOKENS, appCss: driftInBlock(FIX_APP, ':root', '--radius', '9px') })
  t('C6 本门独有增量:非 color 档(--radius)必须真的在判定面里', () => nonColor.diffs.length === 1,
    JSON.stringify(nonColor.diffs))
  const notToken = compare({
    tokensCss: FIX_TOKENS,
    appCss: FIX_APP.replace('--radius: 4px;', '--radius: 4px;\n  --spacing-2: 1px;'),
  })
  t('C6b 反向:非 design-token 档(--spacing-2)不得进判定面', () => notToken.diffs.length === 0,
    JSON.stringify(notToken.diffs))

  const commentDrift = compare({
    tokensCss: FIX_TOKENS,
    appCss: FIX_APP.replace('--radius: 4px;', '/* --radius: 99px; 说明文字 */\n  --radius: 4px;'),
  })
  t('C7 注释里的声明散文不得被当数据(两侧都剥注释)', () => commentDrift.diffs.length === 0,
    JSON.stringify(commentDrift.diffs))
  const realDecl = compare({
    tokensCss: FIX_TOKENS,
    appCss: FIX_APP.replace('--radius: 4px;', '--radius: 99px;'),
  })
  t('C7b 阳性对照:同一行去掉注释壳就是真漂移', () => realDecl.diffs.length === 1, JSON.stringify(realDecl.diffs))

  const multiLine = compare({
    tokensCss: FIX_TOKENS,
    appCss: FIX_APP.replace('--color-grad: linear-gradient( 112deg, red 0% );', '--color-grad: linear-gradient( 112deg, blue 0% );'),
  })
  t('C8 跨行档:值内部空白归一后仍按内容比,真改动必红', () => multiLine.diffs.length === 1,
    JSON.stringify(multiLine.diffs))
  t('C8b 反控:同一档在源头写成跨行、副本写成单行 ⇒ 归一后等值,不判漂移', () =>
    !base.diffs.some((d) => d.name === '--color-grad'))

  const empty = compare({ tokensCss: FIX_TOKENS, appCss: '/* 一个受管档都没有 */' })
  t('C9 空扫判死:副本无 design-token 档 ⇒ checked=0(调用方据此 exit 2,不得记绿)', () => empty.checked === 0)
  const noSource = compare({ tokensCss: ':root { --spacing-1: 4px; }', appCss: FIX_APP })
  t('C9b 空扫判死:源头一个 token 档都没有 ⇒ source=0', () => noSource.source === 0)

  const hard = extractHardcodedColors(FIX_CONFIG)
  t('C10 硬编码色值阳性:夹具里的两枚都必须被抓到', () => hard.length === 2 &&
    hard.some((h) => h.value === '#ffffff') && hard.some((h) => h.value.startsWith('rgba(')),
    JSON.stringify(hard))
  t('C10b 反向:注释行里的色值不算', () => extractHardcodedColors(`// '#ffffff'\n/* '#000000' */\n* '#123123'`).length === 0)

  t('C11 默认面必须是 HEAD(旧默认是磁盘,本条是换锚的反向锁)', () => faceFromArgv([]).face === 'head',
    JSON.stringify(faceFromArgv([])))
  t('C11b --staged ⇒ 索引面', () => faceFromArgv(['--staged']).face === 'staged')
  t('C11c --worktree ⇒ 人工逃生舱面', () => faceFromArgv(['--worktree']).face === 'worktree')
  t('C11d 两个面旗同给 ⇒ 判死(取哪一面都会让另一面成为假绿)', () =>
    !!faceFromArgv(['--staged', '--worktree']).error, JSON.stringify(faceFromArgv(['--staged', '--worktree'])))
  t('C12 app.config.ts 路径由 app.css 常量派生(不得再抄第二份字面量)', () =>
    APP_CONFIG_REL === 'apps/miniapp-taro/src/app.config.ts' && APP_CONFIG_REL.includes('/'),
    APP_CONFIG_REL)

  // ── F 组:真临时 git 仓 + 真 CLI(判定面只能在这里证明) ──
  const drifted = driftFirstRoot(FIX_APP, '--color-bg', '#123456')
  const okFixture = fx(() => buildFixture({}))
  const rHead = runCli(dirOf(okFixture), [])
  const rStaged = runCli(dirOf(okFixture), ['--staged'])
  const rWorktree = runCli(dirOf(okFixture), ['--worktree'])
  t('F1 三面一致(同步夹具)⇒ 三档全部 exit 0(防恒红门)', () =>
    rHead.code === 0 && rStaged.code === 0 && rWorktree.code === 0,
    `head=${rHead.code} staged=${rStaged.code} worktree=${rWorktree.code} :: ${rHead.out.slice(0, 300)}`)
  t('F1b 结论行必须落在末行且写明取材面(否则报告读不出这句话关于哪个面)', () =>
    /取材面:HEAD blob/.test(rHead.last) && /取材面:索引 blob/.test(rStaged.last) &&
    /取材面:工作树/.test(rWorktree.last), `head末行=${rHead.last}`)
  t('F1c warn 维度不改退出码:app.config.ts 有硬编码色而 CLI 仍 0', () =>
    extractHardcodedColors(FIX_CONFIG).length > 0 && rHead.code === 0)

  // F2 三面分叉正控之一:HEAD 里躺着漂移,索引与盘上已被后手改对 ⇒ 只有默认档该红。
  const f2 = fx(() => buildFaceFixture({ appCssHead: drifted, appCssIndex: FIX_APP, appCssWorktree: FIX_APP }))
  const f2Head = runCli(dirOf(f2), [])
  const f2Staged = runCli(dirOf(f2), ['--staged'])
  const f2Wt = runCli(dirOf(f2), ['--worktree'])
  t('F2 HEAD 漂而索引/盘已修好 ⇒ 默认档必须翻红并点名(换面正控:摘掉换面即翻绿)', () =>
    f2Head.code === 1 && /值漂移/.test(f2Head.out) && /--color-bg/.test(f2Head.out) &&
    /取材面:HEAD blob/.test(f2Head.last), `code=${f2Head.code} :: ${f2Head.out.slice(0, 300)}`)
  t('F2b 同一夹具下 --staged 与 --worktree 必须绿(只有 HEAD 那一面欠账)', () =>
    f2Staged.code === 0 && f2Wt.code === 0,
    `staged=${f2Staged.code} worktree=${f2Wt.code} :: ${f2Staged.out.slice(0, 300)}`)

  // F3 反向分叉:索引里躺着漂移(别人 add 了又在盘上改回去)⇒ 只有 --staged 该红。
  const f3 = fx(() => buildFaceFixture({ appCssHead: FIX_APP, appCssIndex: drifted, appCssWorktree: FIX_APP }))
  const f3Staged = runCli(dirOf(f3), ['--staged'])
  const f3Head = runCli(dirOf(f3), [])
  t('F3 索引漂而 HEAD/盘同步 ⇒ --staged 必须红(盘上随后改对不算修好)', () =>
    f3Staged.code === 1 && /取材面:索引 blob/.test(f3Staged.last),
    `code=${f3Staged.code} :: ${f3Staged.out.slice(0, 300)}`)
  t('F3b 同一夹具默认档必须绿(否则默认读的是索引,不是 HEAD)', () => f3Head.code === 0,
    `code=${f3Head.code} :: ${f3Head.out.slice(0, 300)}`)

  // F4 取不到 ⇒ exit 2,且不回落到另一个面。
  const noGit = fx(() => buildFixture({ git: false }))
  const ngHead = runCli(dirOf(noGit), [])
  const ngStaged = runCli(dirOf(noGit), ['--staged'])
  const ngWt = runCli(dirOf(noGit), ['--worktree'])
  t('F4 非 git 目录 + 盘上内容完全正确 ⇒ 默认档与 --staged 一律 exit 2「无法判定」(旧写法在这里冒绿)', () =>
    ngHead.code === 2 && ngStaged.code === 2 && /无法判定/.test(ngHead.out) && /无法判定/.test(ngStaged.out),
    `head=${ngHead.code} staged=${ngStaged.code} :: ${ngHead.out.slice(0, 300)}`)
  t('F4b 逃生舱不依赖 git:同一夹具 --worktree 必须能读到并判绿(反证上面两条红是面取不到,不是判据坏)', () =>
    ngWt.code === 0, `code=${ngWt.code} :: ${ngWt.out.slice(0, 300)}`)

  const noHead = fx(() => buildFixture({ commit: false }))
  const nh = runCli(dirOf(noHead), [])
  const nhs = runCli(dirOf(noHead), ['--staged'])
  t('F5 有仓无提交 ⇒ HEAD 面取不到 exit 2;索引面此时是空的 ⇒ 同样 exit 2', () =>
    nh.code === 2 && nhs.code === 2 && /无法判定/.test(nh.out),
    `head=${nh.code} staged=${nhs.code} :: ${nh.out.slice(0, 300)}`)

  const twoFlags = runCli(dirOf(okFixture), ['--staged', '--worktree'])
  t('F6 两个面旗同给 ⇒ 当场 exit 2 并点名原因(不得任选一面冒充判定)', () =>
    twoFlags.code === 2 && /无法判定/.test(twoFlags.out), `code=${twoFlags.code} :: ${twoFlags.out.slice(0, 200)}`)

  const emptyApp = fx(() => buildFixture({ appCss: '/* 端内一个 design-token 档都没有 */' }))
  const ea = runCli(dirOf(emptyApp), [])
  const eaWt = runCli(dirOf(emptyApp), ['--worktree'])
  t('F7 空扫 ⇒ exit 2「无法判定」而不是旧写法的 [PASS] 0 variables(HEAD 面与逃生舱两档都要判死)', () =>
    ea.code === 2 && eaWt.code === 2 && /无法判定/.test(ea.out),
    `head=${ea.code} worktree=${eaWt.code} :: ${ea.out.slice(0, 300)}`)

  const missingConfig = fx(() => {
    const one = buildFixture({})
    one.run('rm', '--cached', '--', APP_CONFIG_REL)
    one.run('commit', '-qm', 'drop app.config.ts')
    return one
  })
  const mc = runCli(dirOf(missingConfig), [])
  t('F8 声明过的输入在面上不存在 ⇒ exit 2 并点名是哪一份(不得悄悄把它当"没有硬编码色")', () =>
    mc.code === 2 && /app\.config\.ts/.test(mc.out) && /无法判定/.test(mc.out),
    `code=${mc.code} :: ${mc.out.slice(0, 300)}`)

  // F9 「未判定」话术锁:四支判死路径(取不到面 / 两面旗同给 / 空扫 / 输入缺件)必须共用
  //   UNDET_TXT 这一份措辞。判据语义不变,只是把"取不到输入"钉成台账用词 ——
  //   一个只 exit 2 而不写"未判定"的门,下游(报告、CI、问责)读到的就只是"门没通过",
  //   分不清是没判还是判了没问题(§0.3)。
  t('F9 判死话术必须含「未判定」且四支路径同出一源(UNDET_TXT 一份,不许各写各的)', () =>
    UNDET_TXT.includes('未判定') &&
    [ngHead, ngStaged, nh, twoFlags, ea, mc].every((r) => r.code === 2 && r.out.includes(UNDET_TXT)),
    [ngHead, ngStaged, nh, twoFlags, ea, mc].map((r) => `${r.code}:${r.out.includes(UNDET_TXT)}`).join(' '))

  const { pass, fail, cases } = report()
  for (const c of cases) console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.pass ? '' : ` —— 实得:${c.got}`}`)
  for (const one of fixtures) {
    try {
      rmScratch(dirOf(one), { bestEffort: true })
    } catch {
      console.log(`  ⚠ 夹具清理失败(不影响判定):${dirOf(one)}`)
    }
  }
  console.log(
    fail
      ? `self-test 失败 ${fail}/${cases.length}`
      : `✅ ${NAME} self-test 全通过(${cases.length} 例,pass=${pass})`,
  )
  return fail ? 1 : 0
}

// ─────────────────────────── CLI ───────────────────────────

function usage() {
  console.log(`${NAME}.mjs — miniapp-taro design-tokens 同步守门(P3-1.3)

用法:
  node scripts/${NAME}.mjs [选项]

选项:
  (无选项)     全量档:判 HEAD blob
  --staged     判索引 blob(本次提交会带走的那一份)
  --worktree   人工逃生舱:判盘上内容(提交链不走这档)
  --quiet, -q  只在有问题时说话
  --self-test  判据自检(纯内存夹具 + 临时 git 仓三面分叉正控)
  --help, -h   显示此帮助

校验内容:
  1. app.css 首个 :root/.dark 块的 design-token 档值 vs tokens.css(子集检查,判漂移即 exit 1)
  2. app.config.ts 硬编码色值(warn-only,不改退出码)

退出码:
  0 = 逐位同值
  1 = 检出值漂移
  2 = ${UNDET_TXT}(取不到被审面 / 枚举到 0 个候选 / 两个面旗同给 / 脚本自身异常)
`)
}

export function run(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return usage(), 0
  if (argv.includes('--self-test')) return selfTest()
  const quiet = argv.includes('--quiet') || argv.includes('-q')

  // 应急放行读点(兑现面):runner 登记的 skipEnv 名必须与 SKIP_ENV 逐字相同(镜像 F3 钉这个名字)。
  // 打印一行再 exit 0 —— 静默放行会把"没判"渲染成"判过"(§0.3 / 守门 89 同族)。
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⏭ ${SKIP_ENV}=1 ⇒ 本门未判定(人工放行,不等于通过):${NAME}`)
    return 0
  }

  const sel = faceFromArgv(argv)
  if (sel.error) {
    console.error(`[${NAME}] ❌ ${UNDET_TXT}:${sel.error}`)
    return 2
  }
  const face = sel.face
  if (!quiet)
    console.log(
      `[${NAME}] Checking ${APP_CSS_REL} vs ${TOKENS_SOURCE_REL}(取材面:${FACE_TXT[face]})...`
    )

  let inputs
  try {
    inputs = readFaceInputs(root, face)
  } catch (e) {
    // 「无法判定」是预期结论,一句话足够;**其他异常**必须带栈落地 —— 匿名 exit 2 = 不可诊断
    // (一个编码/权限错误不得伪装成"该文件不存在"的业务结论)。
    const known = e instanceof Undetermined
    console.error(
      `[${NAME}] 取不到输入(${FACE_TXT[face]})⇒ ${UNDET_TXT}:${known ? e.message : (e?.stack ?? e)}`
    )
    return 2
  }

  const { diffs, checked, source } = compare({
    tokensCss: inputs[TOKENS_SOURCE_REL],
    appCss: inputs[APP_CSS_REL],
  })
  // 枚举到 0 个候选判死不记绿(§0.3):旧写法在这里打印 "[PASS] 0 variables in sync"。
  if (source === 0) {
    console.error(
      `[${NAME}] 源头 tokens.css 里没有 design-token 档(取材面:${FACE_TXT[face]})⇒ 判据无输入 ${UNDET_TXT}`
    )
    return 2
  }
  if (checked === 0) {
    console.error(
      `[${NAME}] 副本 app.css 首块里没有 design-token 档(取材面:${FACE_TXT[face]})⇒ 空扫 ${UNDET_TXT}(空扫不是同步)`
    )
    return 2
  }

  // warn 维度先报,把结论行留给末行(镜像测试按末行断言"这句话是关于哪个取材面的")。
  const hardcoded = extractHardcodedColors(inputs[APP_CONFIG_REL])
  if (hardcoded.length > 0 && !quiet) {
    console.log(
      `[WARN] app.config.ts: ${hardcoded.length} 处硬编码色值(原生导航栏/tabBar 无法用 CSS var,warn-only 不改退出码):`
    )
    for (const c of hardcoded.slice(0, 10)) console.log(`  line ${c.line}: ${c.context} = '${c.value}'`)
    if (hardcoded.length > 10) console.log(`  ... 另有 ${hardcoded.length - 10} 处`)
  }

  if (diffs.length === 0) {
    if (!quiet)
      console.log(
        `[PASS] app.css 首块 ${checked} 个 design-token 档与 tokens.css 逐位同值(源头并集 ${source} 档,缺档由守门 36 判;取材面:${FACE_TXT[face]})`
      )
    return 0
  }
  for (const block of [':root', '.dark']) {
    const items = diffs.filter((d) => d.block === block)
    if (!items.length) continue
    console.error(`  ${block} 块:`)
    for (const d of items)
      console.error(`    ${d.name}: app.css='${d.app}' vs tokens='${d.tok}' —— 值漂移`)
  }
  console.error(
    `  修复:pnpm --filter @ihui/miniapp-taro sync-tokens(原位写回,幂等,不动端内自有档与注释)`
  )
  console.error(
    `[${NAME}] 检出 ${diffs.length} 处值漂移(逐位同值 ${checked - diffs.length}/${checked};取材面:${FACE_TXT[face]})`
  )
  return 1
}

// §22d:CLI 直接执行才跑主流程;被镜像测试 import 时不得有副作用(Windows 上必须 pathToFileURL)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // 顶层兜底:未预料到的异常**必须**落成 exit 2「未判定」(脚本自己崩了 = 判据没跑完 = 没判),
  // 绝不能被下游读成"没报错就是通过"。写成显式 process.exit(2) 而不是复用 code,
  // 是为了让"这一支是判死"这件事在源码面上可读(关键字审计不再假阴性)。
  let code = 2
  try {
    code = run(process.argv.slice(2))
  } catch (e) {
    const known = e instanceof Undetermined
    console.error(`❌ ${NAME} 脚本自身异常 ⇒ ${UNDET_TXT}:${known ? e.message : (e?.stack ?? e)}`)
    process.exit(2)
  }
  process.exit(code)
}

export const __test__ = {
  compare,
  collectTokenVars,
  faceFromArgv,
  readFaceInputs,
  extractHardcodedColors,
  buildFixture,
  buildFaceFixture,
  runCli,
  NAME,
  SKIP_ENV,
  APP_CONFIG_REL,
  FACE_RELS,
  UNDET_TXT,
  FACE_TXT,
  FIX_TOKENS,
  FIX_APP,
  FIX_CONFIG,
  driftFirstRoot,
  driftInBlock,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
