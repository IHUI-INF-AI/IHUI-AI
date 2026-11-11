// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 按钮描边颜色显式化对账 —— 「同屏同性质按钮描边深浅不一」的第一把尺子。
//
// 立因(2026-11-11 用户实拍):同屏同性质的快捷按钮描边深浅不一 —— 模板 chips 写裸 `border`
// (类名里**看不见颜色**,实际落 apps/web/app/globals.css 的 `@layer base * { border-color:
// var(--color-border) }` 全局默认档)、同屏快捷卡写 `border border-border/60`、共享 Button
// 原语 outline 档用 `border-input`。裸 `border` 把描边颜色"藏"在全局默认里,同性质按钮各写
// 各的配方无人看守。圆角维由门 150 收口后,描边**颜色**维是同一失效型的下一格。
//
// 判据(第一版,只做可判定的事,不做语义猜):
//  射程:会渲染界面的源码(.tsx/.jsx)里的**按钮类元素** —— 证据形态与门 150 的 C2 同取向:
//   JSX 标签名 `button` / `Button*`、样式键或类名**头词元**命中 button|btn|control 词元;
//   行归属用 `lib/jsx-scope.mjs` 的 scanJsx(2026-11-11 修复后:属性表达式里的 JSX 如
//   `footer={<button …/>}` 建独立元素并正确归属 —— 自检有一条用例钉住这个形态,不得回退)。
//  判红(族 `border-color-implicit`):该元素的 className/类串里存在**无状态修饰的描边宽度类**
//   (`border`、`border-2`、`border-x`、`border-t-2`、`border-[2px]` 等)却**没有任何一条
//   无状态修饰的显式描边颜色类**(`border-<token>`、`border-[var(--…)]`、`border-[#…]`)。
//   `hover:` / `focus:` / `active:` / `data-*:` / `group-hover:` 等带修饰的只算**状态覆盖**,
//   不算基础色声明 —— 基础色缺失时非 hover 态就落全局默认,正是实拍那一幕。
//  合规来源两种:① 类串里直接写了 `border-<色>`;② 引用了共享常量 —— 常量值一律按**被审面**
//   解析(源 = packages/design-tokens/src/button-variants.ts,思路同 radius-tokens 的
//   constantMapOf),**门内不写死任何字符串副本**:常量在那一面被改成无色的,引用它就判红。
//  三态之外还有第四格(照门 150 的诚实性纪律):**不在射程** = 有描边宽度类但没有任何按钮类
//   证据的元素(卡片/面板的 border)—— 它们没有"同性质按钮"对账对象,不归本门判,但按第四个
//   数字单列、`--all` 逐条报名,既不并进"通过"也不并进"未判定"。
//  未判定:类串含解不开的动态标识符(非共享常量、非字面量)⇒ 只报名,不冒红也不记绿。
//
// OUT_OF_SCOPE(第一版判 className/类串面,以下两格逐条报名,不得静默漏):
//  ① CSS 面(globals.css 等的 `border:` 简写自带颜色语法、`@layer base` 全局默认本身):
//     CSS 里没有"元素"可归属,颜色档与选择器特异性纠缠,判它需要先建 CSS 元素模型 —— 成本
//     不在第一版射程,如实报名。
//     2026-11-11 全仓实测:简写不带色的 60 处命中里,绝大多数是 .venv 三方件、.next 生成物
//     与 `border: 0` 零宽(无描边可对账);**真实源码仅 1 处** ——
//     apps/miniapp-taro/src/pkg-ai/ai/chat.css:121 `border: 2rpx solid`(落 currentColor),
//     补色需小程序视觉对稿,留待小程序描边批。
//  ② RN StyleSheet 面 —— **2026-11-11 遗留票收编进射程**(族 FAMILY_RN,判据见 auditRnStyleText):
//     borderWidth/borderColor 是分离声明、跨对象键,与类串形态不同构 ⇒ 走**对象级配对**判据:
//     同对象有 borderColor(含方向色键)⇒ 合规;同对象有 `...` 展开(主题注入)⇒ 未判定报名
//     (不猜展开带不带色);都没有 ⇒ 判红(RN 缺省边框色是黑,与 web 裸 border 落 @layer base
//     同一失效型)。不要求按钮证据:裸宽无色无论元素类型都渲染黑边,都是缺陷。
//     建门时全仓实测(packages/app、apps/mobile-rn、packages/ui-native 共 1027 文件)报"裸宽 14 处";
//     2026-11-11 遗留票逐处复核**全部为侦察误报**:11 处零宽刻意压边(borderWidth: 0,不画边)、
//     3 处唯一调用点内联注色(SearchInput/plan-styles/RankingScreen,永不落黑)。门体判据据此
//     增设零宽豁免,3 处存量入台账锚点(理由见 $rn-inline-injected)。同票小程序 CSS 面
//     chat.css:121 `border: 2rpx solid` 已补 var(--color-white-45) 回退色,CSS 源码面清零。
//
// 存量不得判红(立门即恒红是本仓最高反面教训):棘轮锚点 = **该文件在被审面上的自身违规数**,
//  键 = `文件|border-color-implicit`,台账 scripts/button-border-color-baseline.json。
//  台账读**工作树磁盘**(门 299 同例:台账是门的判据输入,不是被判面内容;pre-commit 时磁盘
//  那份即同枚将入库的那份)。只允许下降,首次入锚用 --emit-baseline 产物。
//
// 如实报名(2026-11-11 建门现读):唯一档 SHARED_QUICK_ACTION_BORDER_CLASS 的治理改动此刻在
//  stash@{0}(wip:他席活跃现场13项-pre-bloat-merge)未落盘,HEAD/工作树均无此常量。本门**不依赖
//  它存在**:合规来源②的值永远按被审面解析 —— 治理落盘后,prompt-templates/workbench-welcome 的
//  引用自动转合规;落盘前它们按存量走棘轮。门内不写死任何档名副本。
//
// 接线:guardian-runner.mjs 主 checks 数组,id '314'(现读最大占用号 313),mode blocking,
//  skipEnv HUSKY_SKIP_BUTTON_BORDER_COLOR,stagedTriggers ['apps/','packages/']。
//  ⚠️ 门 150 头注记过同型事故:注册必须进**主 checks 数组**(runner 迭代入口是
//  `pushGate ? pushGateChecks : checks`,被并进 pushGateChecks 等于没装)—— 镜像 T1 钉这一条。
//
// 用法:
//   node scripts/check-button-border-color.mjs                  # 全量(HEAD blob),存量不判红
//   node scripts/check-button-border-color.mjs --staged         # 索引 blob(提交链用)
//   node scripts/check-button-border-color.mjs --worktree       # 磁盘面,只供人工排查
//   node scripts/check-button-border-color.mjs --files <a> <b>  # 按文件自验
//   node scripts/check-button-border-color.mjs --strict         # 有未判定 ⇒ exit 2
//   node scripts/check-button-border-color.mjs --json           # stdout 只有 JSON
//   node scripts/check-button-border-color.mjs --all            # 出射程那格也逐条列出
//   node scripts/check-button-border-color.mjs --emit-baseline  # 重出锚点(只允许下降)
//   node scripts/check-button-border-color.mjs --self-test      # 判据自检
//   门体未与被判面同代时(新立门未提交):$env:IHUI_GATE_BODY_SOURCE='worktree' 显式声明。
//
// @ts-check

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  catBatch,
  gitRaw,
  listFaceFiles,
  readWorktreeFile,
  selectFace,
  Undetermined,
} from './lib/face-reader.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'
import { scanJsx, hasJsxShape } from './lib/jsx-scope.mjs'
import { maskFaces } from './lib/radius-roles.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** 共享档唯一源:合规来源②的常量值只从这一份文件、按被审面解析(门内零抄表)。 */
const BUTTON_VARIANTS_REL = 'packages/design-tokens/src/button-variants.ts'
const BASELINE_REL = 'scripts/button-border-color-baseline.json'
/** 本门违规族名(台账键 = `文件|族`):JSX 类串面 + RN StyleSheet 对象面(2026-11-11 遗留票收编)。 */
export const FAMILY = 'border-color-implicit'
export const FAMILY_RN = 'border-color-missing-rn'
/** RN 端目录面:StyleSheet 对象级配对判据的射程(.ts/.tsx 全收,plan-styles.ts 这类纯样式表也在此列)。 */
export const RN_DIR_RE = /^(?:packages\/(?:app|ui-native|rn-app)\/|apps\/mobile-rn\/)/
const FACE_TXT = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(磁盘)' }

/**
 * 扫描面 = 会渲染界面的 JSX 源码 + RN 端目录的 .ts/.tsx(StyleSheet 对象面,2026-11-11 遗留票
 * 收编,见头注 OUT_OF_SCOPE ②)。CSS/SCSS/LESS 不在射程,理由见头注 OUT_OF_SCOPE ①;
 * 排除目录走共享清单 isExcludedDirName(各门抄一份 EXCLUDED 是本仓腐烂源头,门 150 同一条纪律)。
 */
const UI_EXT = /\.(tsx|jsx)$/
const RN_TS_EXT = /\.(ts|tsx)$/
const TEST_RE = /(^|\/)(?:tests?|__tests__|e2e|test)\//
const SPEC_RE = /\.(test|spec)\.[cm]?[jt]sx?$/
const GEN_RE = /(\.gen\.|\.generated\.|(^|\/)generated\/)/

/** 报名式排除(每条带 why,"我没扫到"与"我声明不扫"必须分得开)。 */
export const OUT_OF_SCOPE = [
  {
    re: /^packages\/design-tokens\//,
    why: '共享档定义源(button-variants.ts 等)自身:本门按被审面解析其值,不判定义文件里的字面量',
  },
  { re: /^packages\/i18n\//, why: '语言包与其构建产物,不渲染界面' },
  { re: /^packages\/database\//, why: 'schema 与迁移,不含 UI' },
  { re: /^packages\/types\//, why: '跨端类型声明,取值形态不是界面取用' },
  { re: /^apps\/api\//, why: '后端,没有"同性质按钮"这一概念' },
  { re: /^apps\/ai-service\//, why: 'Python 服务与发布内容渲染,不属本门射程' },
  {
    re: /\.(css|scss|less)$/,
    why: 'OUT_OF_SCOPE ①:CSS 无元素可归属,`border:` 简写自带颜色语法与 @layer base 全局默认纠缠,需要 CSS 元素模型,不在第一版',
  },
  {
    re: /^.*\.tsx?$|.*\.jsx?$/,
    why: 'OUT_OF_SCOPE ②(2026-11-11 遗留票已收窄):RN 端目录的 StyleSheet 对象面已由 FAMILY_RN 配对判据收进射程;本条只报名"非 RN 端目录的 .ts 无 StyleSheet 维"这一维',
  },
]

/** 按钮类证据的词元表(C2 同取向:头词元命中,不做语义猜)。 */
const BUTTON_STEMS = new Set(['button', 'btn', 'control'])

/**
 * 类名 token → {kind: 'width'|'color'|'style', variant}。
 * variant = 冒号前的状态修饰(`hover:`/`data-[state=open]:`/`group-hover:`…);
 * 带修饰的颜色**只算状态覆盖**,基础色缺失时非 hover 态落全局默认 —— 这正是实拍那一幕。
 * `border-[2px]`(任意值宽度)与 `border-[var(--x)]`/`border-[#hex]`(任意值颜色)按括号内
 * 是否纯长度分流。`border-none` 是 style 维,既不算宽也不算色。
 */
export function classifyBorderToken(tok) {
  const s = String(tok || '')
  if (!s.includes('border')) return null
  const ci = s.lastIndexOf(':')
  const variant = ci >= 0 ? s.slice(0, ci) : ''
  const base = ci >= 0 ? s.slice(ci + 1) : s
  if (!base.startsWith('border')) return null
  if (base === 'border-none') return { kind: 'style', variant }
  if (/^border(?:-[xysetrlb])?(?:-\d+(?:\.\d+)?)?$/.test(base)) return { kind: 'width', variant }
  const arb = /^border(?:-[xysetrlb])?-\[(.+)\]$/.exec(base)
  if (arb) {
    return /^\d+(?:\.\d+)?(?:px|rem|em)?$/.test(arb[1])
      ? { kind: 'width', variant }
      : { kind: 'color', variant }
  }
  const m = /^border(?:-[xysetrlb])?-(.+)$/.exec(base)
  if (!m) return null
  if (/^(?:collapse|separate|solid|dashed|dotted|double|hidden)$/.test(m[1]))
    return { kind: 'style', variant }
  return { kind: 'color', variant }
}

/** 名字的头词元(kebab/camel 双拆,取首段小写):`buttonPrimary`→button、`btn-sm`→btn、`bg-card`→bg。 */
export function headToken(name) {
  const first = String(name || '').split(/[-_.]/)[0] || ''
  const m = /^[A-Z]?[a-z0-9]+/.exec(first)
  return (m ? m[0] : first).toLowerCase()
}

/**
 * 元素自己的属性区文本:`line..attrEndLine` 的行切片,从标签名之后起,**在下一个 `<` 处截断**
 * (嵌套 JSX 是别的元素的属性区,外层不得替内层认领类串,反之内层也不得被外层抢走 —— 归属
 * 由 scanJsx 修复后的元素清单给,这里只还原"这个开标签自己写了什么")。
 * 已知欠账(报名不猜):嵌套 JSX 之后还挂着的自有属性会被截掉(实测形态里 className 总在首位,
 * 且截断只会**少判**不会多判,方向与本仓"假阳比漏报贵"一致)。
 */
export function ownAttrText(lines, el) {
  const slice = lines.slice(el.line - 1, el.attrEndLine).join('\n')
  let start = slice.indexOf('<' + el.name)
  start = start >= 0 ? start + 1 + el.name.length : 0
  const nest = slice.indexOf('<', start)
  return slice.slice(start, nest >= 0 ? nest : undefined)
}

/** className/class 属性抽取:字面 token、共享常量引用、解不开动态标识符三样各归各。 */
const HELPER_NAMES = new Set(['cn', 'clsx', 'twMerge', 'twJoin', 'cva', 'tv', 'styles', 'default'])

export function extractClassInfo(attrText, sharedMap) {
  const tokens = []
  const refs = []
  let dynamic = false
  const pushAll = (str) => {
    for (const t of String(str || '').trim().split(/\s+/))
      if (t && !tokens.includes(t)) tokens.push(t)
  }
  let m
  const plainRe = /\bclass(?:Name)?\s*=\s*(["'])([^"'`\n]*)\1/g
  while ((m = plainRe.exec(attrText))) pushAll(m[2])
  const braceRe = /\bclass(?:Name)?\s*=\s*\{/g
  while ((m = braceRe.exec(attrText))) {
    let depth = 1
    let i = m.index + m[0].length
    const start = i
    let q = ''
    while (i < attrText.length && depth > 0) {
      const c = attrText[i]
      if (q) {
        if (c === '\\') i++
        else if (c === q) q = ''
      } else if (c === '"' || c === "'" || c === '`') q = c
      else if (c === '{') depth++
      else if (c === '}') depth--
      i++
    }
    const body = attrText.slice(start, i - 1)
    for (const lit of body.matchAll(/(["'`])([^"'`\n]*)\1/g)) pushAll(lit[2])
    // 标识符扫描前先把字符串字面量**等长遮掉**:否则 `cn('border px-3')` 里的 `px`、`bg` 会被
    // 当成"解不开的动态标识符",把该判红的形态误降成未判定(2026-11-11 建门现读 prompt-templates 踩中)。
    const bodyIds = body.replace(/(["'`])(?:[^"'`\n]|\\.)*?\1/g, (mm) => ' '.repeat(mm.length))
    for (const id of bodyIds.matchAll(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?/g)) {
      const raw = id[0]
      const after = bodyIds[id.index + raw.length]
      if (after === '(') continue // 函数调用(cn(...) 之类)不是常量引用
      const key = sharedMap && sharedMap.has(raw) ? raw : null
      if (key) {
        refs.push({ name: key, value: sharedMap.get(key) })
        continue
      }
      if (HELPER_NAMES.has(raw) || /^\w+$/.test(raw) && sharedMap && [...sharedMap.keys()].some((k) => k.split('.')[0] === raw))
        continue // 对象名点号前的裸名(如 SHARED_BUTTON_VARIANT_CLASSES 本身)由 map 的整表键兜住
      dynamic = true
    }
  }
  return { tokens, refs, dynamic }
}

/**
 * 按钮类证据:标签名 `button`/`Button*`,或样式键/类名**头词元**命中 BUTTON_STEMS。
 * 类名证据用**本元素自己的** token(不用 scanJsx 的 el.classes —— 它按整段属性区正则收集,
 * 会被嵌套元素污染);样式键维的污染风险同向(只会少判不会多判的除外,已报名)。
 */
export function buttonEvidence(el, tokens) {
  if (el.base === 'button') return 'tag:button'
  if (/^Button/.test(el.base)) return 'tag:Button*'
  for (const k of el.keys) if (BUTTON_STEMS.has(headToken(k))) return 'key:' + k
  for (const c of tokens) if (BUTTON_STEMS.has(headToken(c))) return 'class:' + c
  return null
}

/**
 * 共享档常量表(按被审面解析,思路同 radius-tokens 的 constantMapOf):
 *  标量 `export const NAME = '…'` ⇒ NAME→值;对象 `export const NAME = { k: '…' }` ⇒
 *  NAME.k→值、NAME→各含 border 档值的拼接(spread 引用形态)。
 * 只保留**值里含 border 词元**的档(无描边的档与本色门无关)。注释行跳过。
 */
export function sharedBorderConstsOf(src) {
  const map = new Map()
  const lines = String(src || '').split('\n')
  const hasBorder = (v) => String(v).split(/\s+/).some((t) => classifyBorderToken(t))
  const objRe = /(?:^|[^\w$.])(?:export\s+)?(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*\{/
  let curObj = null
  let objBuf = ''
  for (const raw of lines) {
    const t = raw.trim()
    if (/^(?:\/\/|\/\*|\*)/.test(t)) continue
    if (curObj) {
      objBuf += raw + '\n'
      for (const mm of raw.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(['"])((?:[^'"\\]|\\.)*)\2/g))
        if (hasBorder(mm[3])) map.set(`${curObj}.${mm[1]}`, mm[3])
      if (/[}]\s*,?\s*$/.test(t)) {
        curObj = null
        objBuf = ''
      }
      continue
    }
    const om = objRe.exec(raw)
    if (om) {
      curObj = om[1]
      objBuf = ''
      continue
    }
    const sm = /(?:^|[^\w$.])(?:export\s+)?(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(['"])((?:[^'"\\]|\\.)*)\2/.exec(raw)
    if (sm && hasBorder(sm[3])) map.set(sm[1], sm[3])
  }
  // 对象整表键:引用 `...NAME` / `NAME`(spread 形态)时,把该对象所有含 border 档拼进来判
  const byObj = new Map()
  for (const [k, v] of map) {
    const dot = k.indexOf('.')
    if (dot < 0) continue
    const obj = k.slice(0, dot)
    byObj.set(obj, (byObj.get(obj) ? byObj.get(obj) + ' ' : '') + v)
  }
  for (const [obj, v] of byObj) if (!map.has(obj)) map.set(obj, v)
  return map
}

/**
 * 单文件 → 四格结果(纯函数,夹具与真仓 blob 都能喂,自检因此可端到端)。
 * violations 项:{file, line, family, form, detail};undetermined/outOfScope 同形状带 reason。
 */
export function auditFileText(rel, src, sharedMap) {
  const out = {
    violations: [],
    undetermined: [],
    outOfScope: [],
    compliant: 0,
    borderElems: 0,
    scopeCorrupt: 0,
    scopeTruncated: 0,
  }
  const { kept, strings } = maskFaces(src)
  if (!hasJsxShape(kept)) return out
  const scan = scanJsx(kept, { strings })
  out.scopeCorrupt = scan.corrupt
  out.scopeTruncated = scan.truncated
  const keptLines = kept.split('\n')
  for (const el of scan.elements) {
    const attr = ownAttrText(keptLines, el)
    const { tokens, refs, dynamic } = extractClassInfo(attr, sharedMap)
    const eff = [...tokens]
    for (const r of refs) for (const t of String(r.value).split(/\s+/)) if (t && !eff.includes(t)) eff.push(t)
    const xs = eff
      .map((t) => ({ tok: t, k: classifyBorderToken(t) }))
      .filter((x) => x.k)
    if (!xs.length) continue
    out.borderElems++
    const ev = buttonEvidence(el, tokens)
    if (!ev) {
      out.outOfScope.push({
        file: rel,
        line: el.line,
        reason: 'no-button-evidence',
        form: xs.some((x) => x.k.kind === 'width') ? '描边宽度类' : '描边色类',
        detail: `<${el.base}> ${xs.map((x) => x.tok).join(' ')} —— 无按钮类证据,卡片/面板不归本门对账`,
      })
      continue
    }
    const widths = xs.filter((x) => x.k.kind === 'width')
    const colors = xs.filter((x) => x.k.kind === 'color')
    if (!widths.length) continue // 只写了色没写宽:没有描边可对账
    if (colors.some((c) => c.k.variant === '')) {
      out.compliant++
      continue
    }
    if (dynamic) {
      out.undetermined.push({
        file: rel,
        line: el.line,
        reason: 'dynamic-class',
        form: widths.map((w) => w.tok).join(' '),
        detail: `<${el.base}>(证据 ${ev}) 描边宽度类 ${widths.map((w) => w.tok).join(' ')} 存在,但类串含解不开的动态标识符(非共享常量、非字面量)⇒ 基础色**未判定**,不得读成通过`,
      })
      continue
    }
    out.violations.push({
      file: rel,
      line: el.line,
      family: FAMILY,
      form: widths.map((w) => w.tok).join(' '),
      detail:
        `<${el.base}>(证据 ${ev})写了描边宽度类 ${widths.map((w) => w.tok).join(' ')} 却无无状态修饰的显式描边颜色类` +
        (colors.length ? `(只有状态覆盖 ${colors.map((c) => c.tok).join('/')},不算基础色)` : '') +
        ' ⇒ 非 hover 态落 @layer base 全局默认档',
    })
  }
  return out
}

/**
 * RN StyleSheet 维判据(族 FAMILY_RN,2026-11-11 遗留票收编,头注 OUT_OF_SCOPE ②):
 * 对每个 border*Width 键,在 maskFaces 遮注释/字符串后的面上做**花括号配对**找其所在对象字面量:
 *  同对象有 borderColor(含方向色键)⇒ 合规;同对象有 `...` 展开 ⇒ 未判定报名(不猜展开带不带色);
 *  都没有 ⇒ 判红(RN 缺省边框色是黑)。
 * 不要求按钮证据:裸宽无色无论元素类型都渲染黑边,都是缺陷(与 JSX 面"只做可判定的事"同纪律,
 *  这里对象边界是可判定的,所以不需要按钮词元来缩小射程)。
 * **零宽豁免**:borderWidth: 0 不画边、补色无意义 ⇒ 直接合规(2026-11-11 遗留票复核:建门侦察的
 *  14 处"裸宽"里 11 处是零宽刻意压边 —— ±10 行窗口启发式不辨零宽,门体判据必须辨)。
 * **调用点注色不跟踪**:静态对象无色但唯一调用点内联补色(同票复核 3 处:SearchInput、
 *  plan-styles、RankingScreen)—— 跨文件流分析不在射程,这 3 处按存量入台账锚点 1(理由写在
 *  台账 $rn-inline-injected),同文件再增裸宽照常判红。
 * 射程由调用方把住(RN_DIR_RE ∩ .ts/.tsx);web 的 .ts 无 StyleSheet 面,不进。
 */
const RN_BW_RE = /\bborder(?:Top|Bottom|Left|Right|Start|End)?Width\s*:/g
const RN_BC_RE = /\bborder(?:Top|Bottom|Left|Right|Start|End)?Color\s*:/

export function auditRnStyleText(rel, src) {
  const out = { violations: [], undetermined: [], compliant: 0 }
  const { kept } = maskFaces(src)
  const lineAt = (idx) => kept.slice(0, idx).split('\n').length
  RN_BW_RE.lastIndex = 0
  let m
  while ((m = RN_BW_RE.exec(kept))) {
    // 零宽豁免:borderWidth: 0 不画边,补色无意义(遗留票复核 11/14 处为此形态,见上注)
    const after = kept.slice(m.index + m[0].length, m.index + m[0].length + 16)
    if (/^\s*0\s*(?:[,}\r\n;]|$)/.test(after)) {
      out.compliant++
      continue
    }
    let depth = 0
    let objStart = -1
    for (let i = m.index - 1; i >= 0; i--) {
      const c = kept[i]
      if (c === '}') depth++
      else if (c === '{') {
        if (depth === 0) {
          objStart = i
          break
        }
        depth--
      }
    }
    if (objStart < 0) {
      out.undetermined.push({
        file: rel,
        line: lineAt(m.index),
        reason: 'rn-object-unfound',
        form: m[0].trim().replace(/:\s*$/, ''),
        detail: 'borderWidth 键定位不到所在对象字面量 ⇒ 未判定,不冒红也不记绿',
      })
      continue
    }
    let d2 = 0
    let objEnd = -1
    for (let i = objStart; i < kept.length; i++) {
      const c = kept[i]
      if (c === '{') d2++
      else if (c === '}') {
        d2--
        if (d2 === 0) {
          objEnd = i
          break
        }
      }
    }
    if (objEnd < 0) {
      out.undetermined.push({
        file: rel,
        line: lineAt(m.index),
        reason: 'rn-object-truncated',
        form: m[0].trim().replace(/:\s*$/, ''),
        detail: 'borderWidth 所在对象花括号不闭合(解析失配)⇒ 未判定,报名不猜',
      })
      continue
    }
    const span = kept.slice(objStart, objEnd + 1)
    if (RN_BC_RE.test(span)) {
      out.compliant++
      continue
    }
    if (span.includes('...')) {
      out.undetermined.push({
        file: rel,
        line: lineAt(m.index),
        reason: 'rn-style-spread',
        form: m[0].trim().replace(/:\s*$/, ''),
        detail: '同对象无 borderColor 但有 `...` 展开(可能由主题注入色)⇒ 未判定报名,不猜展开带不带色',
      })
      continue
    }
    out.violations.push({
      file: rel,
      line: lineAt(m.index),
      family: FAMILY_RN,
      form: m[0].trim().replace(/:\s*$/, ''),
      detail:
        'StyleSheet 对象含描边宽度键 ' +
        m[0].trim().replace(/:\s*$/, '') +
        ' 而同对象无 borderColor(含方向色键)⇒ RN 缺省边框色落**黑**,与 web 裸 border 落 @layer base 同一失效型',
    })
  }
  return out
}

/* ─────────────────────────── 棘轮(与门 150 同型) ─────────────────────────── */

export function anchorKey(v) {
  return `${v.file}|${v.family}`
}

export function countByKey(violations) {
  const m = {}
  for (const v of violations) {
    const k = anchorKey(v)
    m[k] = (m[k] || 0) + 1
  }
  return m
}

/** 棘轮:本次计数 > 该键锚点 才算红;台账缺键 ⇒ 视作 0(新增即拦)。 */
export function applyRatchet(counts, anchors) {
  const red = []
  for (const [key, n] of Object.entries(counts)) {
    const cap = Number(anchors?.[key] ?? 0)
    if (n > cap) red.push({ key, count: n, cap })
  }
  return red.sort((a, b) => b.count - b.cap - (a.count - a.cap) || a.key.localeCompare(b.key))
}

/**
 * 锚点收紧(门 150 同条):只对**本次真的改过的文件**把上限换成该文件 HEAD 自身计数 ——
 * 否则"在同一文件里把已收敛的写法加回来"会被冻结台账的旧值放行。
 */
export function tightenAnchors(anchors, perFile) {
  const out = { ...(anchors || {}) }
  const tightened = []
  const knownFiles = new Set((perFile || []).map((e) => e.file))
  for (const e of perFile || []) {
    for (const [key, ledgerCap] of Object.entries(anchors || {})) {
      const [file] = key.split('|')
      if (file !== e.file) continue
      const cap = Number(e.counts?.[key] ?? 0)
      if (cap < Number(ledgerCap)) {
        tightened.push({ key, was: Number(ledgerCap), now: cap })
        out[key] = cap
      }
    }
  }
  return { anchors: out, tightened, files: [...knownFiles] }
}

/** 台账只允许下降或持平;第一次入锚(空台账)除外;新键带账拒绝(否则判红可被同一条命令洗成豁免)。 */
export function anchorRegression(prev, next) {
  const had = Object.keys(prev || {}).length > 0
  if (!had) return []
  const bad = []
  for (const [k, cap] of Object.entries(prev || {})) {
    const n = Number(next?.[k])
    if (!Number.isFinite(n)) bad.push(`${k}:锚点消失(旧 ${cap})`)
    else if (n > cap) bad.push(`${k}:锚点上升 ${cap} → ${n}`)
  }
  for (const [k, n] of Object.entries(next || {})) {
    if (k in prev) continue
    if (Number(n) > 0) bad.push(`${k}:新键带账(${n})—— 台账一经建立只许下调,存量要纳管请人工改并写明理由`)
  }
  return bad
}

export function parseBaseline(text, label) {
  if (text === null || text === undefined) return null
  try {
    const j = JSON.parse(text)
    if (!j || typeof j !== 'object' || !j.anchors || typeof j.anchors !== 'object')
      throw new Error('缺 anchors 字段')
    return j
  } catch (e) {
    throw new Undetermined(`${label}解析失败:${e.message} —— 坏台账不得静默当空锚点用`)
  }
}

export function emitBaseline(violations, baseline) {
  const anchors = { ...(baseline?.anchors || {}) }
  const counts = countByKey(violations)
  for (const [k, n] of Object.entries(counts)) anchors[k] = n
  // 本次读数为 0 的既有键**降到 0 而不是删键**(键消失与"台账被并发旧基线整文件回写"账面同形)
  for (const k of Object.keys(anchors)) if (!(k in counts)) anchors[k] = 0
  return {
    $note:
      '按钮描边颜色显式化锚点(键 = 文件|border-color-implicit 或 文件|border-color-missing-rn,' +
      '值 = 该文件在被审面上的存量违规数)。' +
      '只拦"这次改动把无基础色的描边加回来了",存量另计批清偿;键消失即视为台账被回写,拒绝落盘。',
    anchors,
  }
}

export function isInScope(rel) {
  const rnFace = RN_DIR_RE.test(rel) && RN_TS_EXT.test(rel)
  if (!UI_EXT.test(rel) && !rnFace) return false
  if (TEST_RE.test(rel) || SPEC_RE.test(rel) || GEN_RE.test(rel)) return false
  const segs = rel.split('/')
  if (segs.some((s) => isExcludedDirName(s))) return false
  if (segs.some((s, i) => i < segs.length - 1 && s.startsWith('.') && s !== '.github')) return false
  // 最后一条 OUT_OF_SCOPE 是"维"报名(RN StyleSheet),不是路径排除;按 re 逐条走时跳过它
  return !OUT_OF_SCOPE.slice(0, -1).some((o) => o.re.test(rel))
}

export function faceFromArgv(argv) {
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) throw new Undetermined(error)
  return face
}

/** 台账读工作树磁盘(门 299 同例):它是门的判据输入,不是被判面内容。 */
function readLedger(repoRoot) {
  let src = null
  try {
    src = readWorktreeFile(repoRoot, BASELINE_REL)
  } catch (e) {
    throw new Undetermined(`${BASELINE_REL} 磁盘读取失败:${e.message}`)
  }
  if (src === null)
    return {
      anchors: {},
      $note: '台账不在盘上 —— 本次按"零锚点"判,任何存量都会判红(接线前须先 --emit-baseline 入锚)',
    }
  return parseBaseline(src, BASELINE_REL)
}

/** 共享常量表按被审面取;取不到 ⇒ 空表(引用解不开 ⇒ 落未判定报名,不猜、不判红)。 */
function constsFromBatch(got, specAt, warn) {
  const s = got.get(specAt(BUTTON_VARIANTS_REL))
  if (typeof s !== 'string') {
    warn.push(`${BUTTON_VARIANTS_REL} 在被审面上取不到 ⇒ 共享常量引用一律落未判定报名(不猜)`)
    return new Map()
  }
  return sharedBorderConstsOf(s)
}

function aggregate(rel, src, sharedMap, acc) {
  const r = auditFileText(rel, src, sharedMap)
  acc.violations.push(...r.violations)
  acc.undetermined.push(...r.undetermined)
  acc.outOfScope.push(...r.outOfScope)
  acc.compliant += r.compliant
  acc.borderElems += r.borderElems
  acc.scopeCorrupt += r.scopeCorrupt
  acc.scopeTruncated += r.scopeTruncated
  if (RN_DIR_RE.test(rel) && RN_TS_EXT.test(rel)) {
    const rn = auditRnStyleText(rel, src)
    acc.violations.push(...rn.violations)
    acc.undetermined.push(...rn.undetermined)
    acc.rnCompliant += rn.compliant
  }
}

function emptyAcc() {
  return {
    violations: [],
    undetermined: [],
    outOfScope: [],
    compliant: 0,
    borderElems: 0,
    scopeCorrupt: 0,
    scopeTruncated: 0,
    rnCompliant: 0,
  }
}

/**
 * 全量/暂存档:清单与内容**同面同轮**(listFaceFiles + catBatch);共享常量同面取;
 * 台账读磁盘(见 readLedger 注释)。`--files` 指定的路径一个都不在射程 ⇒ Undetermined(不冒绿)。
 */
export function runAudit(repoRoot, face, { only } = {}) {
  const listed = listFaceFiles(repoRoot, face)
  let files = listed.filter(isInScope)
  const skippedSpecs = []
  if (only && only.length) {
    const want = new Set(only.map((p) => p.replaceAll('\\', '/').replace(/^\.?\//, '')))
    const hit = files.filter((f) => want.has(f))
    for (const w of want) if (!hit.includes(w) && !listed.includes(w)) skippedSpecs.push(`${w}(不在被审面)`)
    else if (!hit.includes(w)) skippedSpecs.push(`${w}(不在射程:CSS/RN StyleSheet/测试/排除清单)`)
    if (!hit.length)
      throw new Undetermined(`--files 指定的路径没有一个在射程内:${skippedSpecs.join(' / ') || [...want].join(' ')}`)
    files = hit
  }
  if (!files.length) throw new Undetermined(`${FACE_TXT[face]}上枚举到 0 个在射程文件 —— 空扫不记绿`)
  const specAt = (p) => (face === 'staged' ? `:${p}` : `HEAD:${p}`)
  const specs = [...files, BUTTON_VARIANTS_REL].map(specAt)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28, timeout: 180000 })
  const warns = []
  const sharedMap = constsFromBatch(got, specAt, warns)
  const acc = emptyAcc()
  for (const rel of files) {
    const src = got.get(specAt(rel))
    if (src === null || src === undefined)
      throw new Undetermined(`${FACE_TXT[face]}取不到 ${rel}(清单与内容必须同面同轮)`)
    aggregate(rel, src, sharedMap, acc)
  }
  const baseline = readLedger(repoRoot)
  const anchorInfo = { anchors: baseline.anchors || {}, tightened: [], skipped: [] }
  if (face === 'staged') {
    let changed = null
    try {
      changed = String(gitRaw(['diff', '--name-only', 'HEAD', '--cached'], repoRoot) ?? '')
        .split(/\r?\n/)
        .map((s) => s.replaceAll('\\', '/').trim())
        .filter(Boolean)
    } catch (e) {
      anchorInfo.skipped.push(`git diff 取不到(${String(e?.message ?? e).slice(0, 80)})⇒ 本枚按台账判,未做任何收紧`)
    }
    const targets = changed ? changed.filter((f) => files.includes(f)) : []
    if (targets.length) {
      const headGot = catBatch(repoRoot, targets.map((p) => `HEAD:${p}`), { maxBuffer: 1 << 28, timeout: 180000 })
      const perFile = []
      for (const rel of targets) {
        const src = headGot.get(`HEAD:${rel}`)
        if (typeof src !== 'string') {
          anchorInfo.skipped.push(`${rel}:HEAD 正文取不到 ⇒ 这一格不收紧(新增文件由"台账缺键视作 0"兜住)`)
          continue
        }
        const counts = {}
        const headAcc = emptyAcc()
        aggregate(rel, src, sharedMap, headAcc) // 含 RN StyleSheet 维:收紧面与判定面必须同判据
        for (const v of headAcc.violations) {
          const k = anchorKey(v)
          counts[k] = (counts[k] || 0) + 1
        }
        perFile.push({ file: rel, counts })
      }
      const t = tightenAnchors(baseline.anchors || {}, perFile)
      anchorInfo.anchors = t.anchors
      anchorInfo.tightened = t.tightened
    }
  }
  return {
    face,
    files,
    scopeNarrowed: !!(only && only.length),
    skippedSpecs,
    warns,
    baseline,
    anchorInfo,
    sharedConsts: [...sharedMap.keys()],
    ...acc,
    red: applyRatchet(countByKey(acc.violations), anchorInfo.anchors),
  }
}

/** 工作树档:只供人工排查,大声喊,不作为结论。 */
export function runAuditWorktree(repoRoot, only) {
  let files = listFaceFiles(repoRoot, 'head').filter(isInScope)
  if (only && only.length) {
    const want = new Set(only.map((p) => p.replaceAll('\\', '/').replace(/^\.?\//, '')))
    files = files.filter((f) => want.has(f))
  }
  if (!files.length) throw new Undetermined('工作树档枚举到 0 个在射程文件 —— 空扫不记绿')
  const constSrc = readWorktreeFile(repoRoot, BUTTON_VARIANTS_REL)
  const warns = []
  if (typeof constSrc !== 'string') warns.push(`${BUTTON_VARIANTS_REL} 磁盘取不到 ⇒ 共享常量引用一律落未判定报名`)
  const sharedMap = typeof constSrc === 'string' ? sharedBorderConstsOf(constSrc) : new Map()
  const acc = emptyAcc()
  for (const rel of files) {
    const src = readWorktreeFile(repoRoot, rel)
    if (src === null) continue // 磁盘面允许"少扫一个"(工作树档本就不作为结论),清单面在 runAudit 里是判死的
    aggregate(rel, src, sharedMap, acc)
  }
  const baseline = readLedger(repoRoot)
  return {
    face: 'worktree',
    files,
    scopeNarrowed: !!(only && only.length),
    skippedSpecs: [],
    warns,
    baseline,
    anchorInfo: { anchors: baseline.anchors || {}, tightened: [], skipped: [] },
    sharedConsts: [...sharedMap.keys()],
    ...acc,
    red: applyRatchet(countByKey(acc.violations), baseline.anchors || {}),
  }
}

export function lineOf(v) {
  return `  ${v.file}:${v.line} [${v.family}] ${v.detail}`
}

export async function main(argv = process.argv.slice(2), repoRoot = ROOT) {
  if (argv.includes('--self-test')) return await selfTest(repoRoot)
  // 门体同代自检由 selectFace 内部兜住(face-reader 2026-11-08 层):门未与被判面同枚提交时,
  // 带 --staged/HEAD 面旗直跑会报"门体与被判面不同代" ⇒ 按头注出路显式声明
  // $env:IHUI_GATE_BODY_SOURCE='worktree'(会如实落痕);--worktree 面自洽,不受影响。
  const strict = argv.includes('--strict')
  const idx = argv.indexOf('--files')
  const only = idx >= 0 ? argv.slice(idx + 1).filter((a) => !a.startsWith('--')) : []
  let res
  try {
    const face = faceFromArgv(argv)
    res = face === 'worktree' ? runAuditWorktree(repoRoot, only) : runAudit(repoRoot, face, { only })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`⚠️ 无法判定:${e.message}`)
      return 2
    }
    throw e
  }
  if (argv.includes('--emit-baseline')) {
    const next = emitBaseline(res.violations, res.baseline)
    const regress = anchorRegression(res.baseline?.anchors || {}, next.anchors)
    if (regress.length) {
      console.error(`× 拒绝出台账:${regress.length} 条锚点上升/消失/新键带账(只允许下降或持平)`)
      for (const r of regress.slice(0, 20)) console.error(`  - ${r}`)
      return 1
    }
    console.log(JSON.stringify(next, null, 2))
    console.error(`台账按 ${FACE_TXT[res.face]} 面生成;逐条核过再放进 ${BASELINE_REL}`)
    return 0
  }
  const undetFileCount = new Set(res.undetermined.map((u) => u.file)).size
  if (argv.includes('--json')) {
    // stdout 只准出现 JSON:任何尾随说明行都会砸碎镜像测试的 JSON.parse
    console.log(
      JSON.stringify({
        face: res.face,
        scannedFiles: res.files.length,
        borderElems: res.borderElems,
        compliant: res.compliant,
        rnCompliant: res.rnCompliant,
        violationCount: res.violations.length,
        violations: res.violations,
        red: res.red,
        undetermined: res.undetermined,
        undeterminedCount: res.undetermined.length,
        outOfScopeCount: res.outOfScope.length,
        outOfScope: argv.includes('--all') ? res.outOfScope : undefined,
        scopeCorrupt: res.scopeCorrupt,
        scopeTruncated: res.scopeTruncated,
        sharedConsts: res.sharedConsts,
        warns: res.warns,
        skippedSpecs: res.skippedSpecs,
        tightened: res.anchorInfo.tightened,
        baselineAnchors: Object.keys(res.baseline?.anchors || {}).length,
        undetFileCount,
      }),
    )
  } else {
    if (res.face === 'worktree')
      console.log('⚠️⚠️ 正在按**磁盘**判(工作树档):共享工作树常年滞后 HEAD,本档只供人工排查,不得作为结论 ⚠️⚠️')
    if (res.scopeNarrowed && res.skippedSpecs.length)
      console.log(`  ⓘ --files 中被跳过(不在射程/不在面):${res.skippedSpecs.join(' / ')}`)
    for (const w of res.warns) console.log(`  ⚠ ${w}`)
    console.log(
      `判定面 ${FACE_TXT[res.face]}:扫 ${res.files.length} 个在射程文件、读到 ${res.borderElems} 个带描边词元的元素` +
        `、RN StyleSheet 配对合规 ${res.rnCompliant} 处` +
        `(共享档常量 ${res.sharedConsts.length} 条按被审面解析;台账锚点 ${Object.keys(res.baseline?.anchors || {}).length} 条)`,
    )
    if (res.anchorInfo?.tightened?.length) {
      const t = res.anchorInfo.tightened
      console.log(
        `  ⓘ 锚点按 HEAD 面收紧 ${t.length} 键:` +
          t.slice(0, 6).map((x) => ` ${x.key} ${x.was}→${x.now}`).join(' ,') +
          (t.length > 6 ? ` …其余 ${t.length - 6} 键见 --json` : ''),
      )
    }
    for (const s of res.anchorInfo?.skipped ?? [])
      console.log(`  ⚪ 锚点未收紧:${s}(不收紧 = 按台账判,不得凭"读不到"当"HEAD 干净")`)
    if (res.red.length) {
      console.log(`❌ 判红(${res.red.length} 个「文件×族」超出自身锚点):`)
      for (const r of res.red.slice(0, 40)) {
        const vs = res.violations.filter((v) => anchorKey(v) === r.key)
        console.log(`  ${r.key}:本次 ${r.count} 处 / 锚点 ${r.cap}`)
        for (const v of vs.slice(0, 5)) console.log(lineOf(v))
      }
      if (res.red.length > 40) console.log(`  …其余 ${res.red.length - 40} 族见 --json`)
    } else if (res.violations.length) {
      console.log(
        `◦ 读到 ${res.violations.length} 处"描边宽度类无基础色",全部不超过各自文件锚点 ⇒ 存量,不判红` +
          '(清一处就 `--emit-baseline` 下调,不得为过门调高)',
      )
    } else {
      console.log('✅ 未发现"按钮描边无显式基础色"的取用(在射程内)')
    }
    if (res.undetermined.length) {
      console.log(
        `⚠ 未判定 ${res.undetermined.length} 处(分布在 ${undetFileCount} 个文件)—— 判不出不等于通过,逐条报名:`,
      )
      for (const u of res.undetermined.slice(0, 30))
        console.log(`  ${u.file}:${u.line} [${u.reason}] ${u.detail}`)
      if (res.undetermined.length > 30)
        console.log(`  …其余 ${res.undetermined.length - 30} 条:--json 全量 / --strict 会判死`)
    }
    console.log(
      `◦ 解析健康:闭合失配 ${res.scopeCorrupt} 处、属性区超长 ${res.scopeTruncated} 处 —— ` +
        '**不是通过**:那些元素可能整片看不见,报名在这里。',
    )
    if (argv.includes('--all') && res.outOfScope.length) {
      console.log(`◦ 不在射程(有描边词元但无按钮类证据),逐条报名:`)
      for (const o of res.outOfScope.slice(0, 80)) console.log(`  ${o.file}:${o.line} ${o.detail}`)
      if (res.outOfScope.length > 80)
        console.log(`  …其余 ${res.outOfScope.length - 80} 条见 --json 的 outOfScope`)
    }
    console.log(
      `结论(四个数各算各的,谁也不替谁背书):判红 ${res.red.length} 族 / ` +
        `已判合规 ${res.compliant} 处(宽度+显式基础色同源)/ ` +
        `描边无基础色 ${res.violations.length} 处(其中超出自身锚点的就是上面 ${res.red.length} 族)/ ` +
        `未判定 ${res.undetermined.length} 处(逐条报名,不是通过)/ ` +
        `不在射程 = 无按钮类证据的描边元素 ${res.outOfScope.length} 处` +
        `${argv.includes('--all') ? '(--all 已逐条列出)' : '(--all 逐条列出)'}`,
    )
  }
  if (res.red.length) return 1
  if (strict && res.undetermined.length) return 2
  return 0
}

/* ─────────────────────────────── 自检 ─────────────────────────────── */

const FIXTURE_SHARED = new Map([
  ['SHARED_QUICK_ACTION_BORDER_CLASS', 'border border-input hover:border-primary/40'],
  ['SHARED_BUTTON_VARIANT_CLASSES.outline', 'border border-input bg-background text-foreground'],
])

/** 夹具共用一行:`<button className="…">` ⇒ 判一行。 */
const A = (src, shared = FIXTURE_SHARED) => auditFileText('x/T.tsx', src, shared)

export async function selfTest(repoRoot = ROOT) {
  const { t, report } = makeRegistrar()

  t('① 裸 border 按钮判红', () => {
    const r = A('<button className="border px-3">ok</button>')
    return r.violations.length === 1 && r.violations[0].line === 1
  })
  t('② border border-input 合规', () => {
    const r = A('<button className="border border-input">ok</button>')
    return r.violations.length === 0 && r.compliant === 1
  })
  t('③ 只有 hover:border-primary/40 无基础色 ⇒ 判红', () => {
    const r = A('<button className="border hover:border-primary/40">ok</button>')
    return r.violations.length === 1 && /状态覆盖/.test(r.violations[0].detail)
  })
  t('④ data-[state=open]:border-primary 是修饰,不算基础色', () => {
    const r = A('<button className="border data-[state=open]:border-primary">ok</button>')
    return r.violations.length === 1
  })
  t('⑤ 引用 SHARED_QUICK_ACTION_BORDER_CLASS ⇒ 合规', () => {
    const r = A('<button className={cn(SHARED_QUICK_ACTION_BORDER_CLASS, \'px-2\')}>ok</button>')
    return r.violations.length === 0 && r.compliant === 1
  })
  t('⑥ 常量按被审面解析:同名常量改成无色 ⇒ 照样判红(钉"不写死副本")', () => {
    const poisoned = new Map([['SHARED_QUICK_ACTION_BORDER_CLASS', 'border px-2']])
    const r = A('<button className={cn(SHARED_QUICK_ACTION_BORDER_CLASS)}>ok</button>', poisoned)
    return r.violations.length === 1
  })
  t('⑦ footer={<button className="border">} 归属到按钮本体判红(钉 scanJsx 修复不回退)', () => {
    const src = [
      'function D() {',
      '  return (',
      '    <Modal',
      '      open={o}',
      '      footer={<button className="border px-3 hover:border-primary/40">ok</button>}',
      '    />',
      '  )',
      '}',
    ].join('\n')
    const r = A(src)
    return (
      r.violations.length === 1 &&
      r.violations[0].line === 5 &&
      r.outOfScope.every((o) => o.line !== 5)
    )
  })
  t('⑧ 非按钮元素(border 卡片)不在射程,单列第四格', () => {
    const r = A('<div className="rounded-lg border bg-card p-4">card</div>')
    return r.violations.length === 0 && r.outOfScope.length === 1 && r.outOfScope[0].reason === 'no-button-evidence'
  })
  t('⑨ 类名头词元 btn ⇒ 按钮证据,判红', () => {
    const r = A('<span className="btn-primary border">b</span>')
    return r.violations.length === 1
  })
  t('⑩ 样式键头词元 control ⇒ 按钮证据,判红', () => {
    const r = A('<View style={styles.control} className="border">b</View>')
    return r.violations.length === 1
  })
  t('⑪ Button* 组件标签 ⇒ 按钮证据', () => {
    const r = A('<Button variant="outline" className="border">b</Button>')
    return r.violations.length === 1
  })
  t('⑫ border-2/border-x-4 是宽度类;border-[2px] 宽度、border-[#fff] 色', () => {
    const w = A('<button className="border-2">a</button>').violations.length === 1
    const x = A('<button className="border-x-4">a</button>').violations.length === 1
    const arb = A('<button className="border-[2px]">a</button>').violations.length === 1
    const col = A('<button className="border border-[#fff]">a</button>').compliant === 1
    const vari = A('<button className="border border-[var(--color-border)]">a</button>').compliant === 1
    return w && x && arb && col && vari
  })
  t('⑬ 解不开动态标识符 ⇒ 未判定,不冒红', () => {
    const r = A('<button className={cn(\'border\', extraCls)}>a</button>')
    return r.violations.length === 0 && r.undetermined.length === 1
  })
  t('⑭ 只写色不写宽 ⇒ 无描边可对账,不判不记', () => {
    const r = A('<button className="border-input">a</button>')
    return r.violations.length === 0 && r.compliant === 0 && r.outOfScope.length === 0
  })
  t('⑮ 共享常量表解析(button-variants.ts 形态):标量+对象档', () => {
    const src = [
      "export const SHARED_BUTTON_BASE_CLASS = 'items-center justify-center'",
      'export const SHARED_BUTTON_VARIANT_CLASSES: Record<string, string> = {',
      "  default: 'bg-cta text-cta-foreground',",
      "  outline: 'border border-input bg-background',",
      '}',
      "export const SHARED_QUICK_ACTION_BORDER_CLASS = 'border border-input hover:border-primary/40'",
    ].join('\n')
    const m = sharedBorderConstsOf(src)
    return (
      m.has('SHARED_QUICK_ACTION_BORDER_CLASS') &&
      m.has('SHARED_BUTTON_VARIANT_CLASSES.outline') &&
      !m.has('SHARED_BUTTON_VARIANT_CLASSES.default') &&
      !m.has('SHARED_BUTTON_BASE_CLASS') &&
      m.get('SHARED_BUTTON_VARIANT_CLASSES').includes('border-input')
    )
  })
  t('⑯ 棘轮:存量 ≤ 锚点不红;超锚判红;缺键视作 0', () => {
    const counts = { 'a.tsx|border-color-implicit': 2 }
    const ok = applyRatchet(counts, { 'a.tsx|border-color-implicit': 2 }).length === 0
    const red = applyRatchet(counts, { 'a.tsx|border-color-implicit': 1 })
    const zero = applyRatchet(counts, {})
    return ok && red.length === 1 && red[0].key === 'a.tsx|border-color-implicit' && zero.length === 1
  })
  t('⑰ 台账单调:上升/消失/新键带账全拒;下降放行;空台账首入豁免', () => {
    const up = anchorRegression({ 'a.tsx|border-color-implicit': 1 }, { 'a.tsx|border-color-implicit': 2 }).length === 1
    const gone = anchorRegression({ 'a.tsx|border-color-implicit': 1 }, {}).length === 1
    const nk = anchorRegression(
      { 'a.tsx|border-color-implicit': 0 },
      { 'a.tsx|border-color-implicit': 0, 'b.tsx|border-color-implicit': 3 },
    ).length === 1
    const down = anchorRegression({ 'a.tsx|border-color-implicit': 2 }, { 'a.tsx|border-color-implicit': 1 }).length === 0
    const first = anchorRegression({}, { 'a.tsx|border-color-implicit': 5 }).length === 0
    return up && gone && nk && down && first
  })
  t('⑱ emitBaseline:读数入锚、旧键归零不删键', () => {
    const j = emitBaseline(
      [{ file: 'a.tsx', family: FAMILY }],
      { anchors: { 'a.tsx|border-color-implicit': 3, 'b.tsx|border-color-implicit': 2 } },
    )
    return (
      j.anchors['a.tsx|border-color-implicit'] === 1 &&
      j.anchors['b.tsx|border-color-implicit'] === 0
    )
  })
  t('⑲ tightenAnchors:只降不升,未改文件不动', () => {
    const r = tightenAnchors(
      { 'a.tsx|border-color-implicit': 3, 'b.tsx|border-color-implicit': 3 },
      [{ file: 'a.tsx', counts: { 'a.tsx|border-color-implicit': 1 } }],
    )
    return (
      r.anchors['a.tsx|border-color-implicit'] === 1 &&
      r.anchors['b.tsx|border-color-implicit'] === 3 &&
      r.tightened.length === 1
    )
  })
  t('⑳ isInScope:tsx/jsx 进;css/ts/测试/生成物/apps/api/design-tokens 出', () => {
    return (
      isInScope('apps/web/src/x.tsx') &&
      isInScope('packages/app/src/y.jsx') &&
      !isInScope('apps/web/app/globals.css') &&
      !isInScope('packages/design-tokens/src/button-variants.ts') &&
      !isInScope('apps/api/src/x.tsx') &&
      !isInScope('apps/web/tests/x.tsx') &&
      !isInScope('apps/web/src/x.test.tsx') &&
      !isInScope('apps/web/src/generated/x.tsx') &&
      !isInScope('node_modules/foo/x.tsx')
    )
  })
  t('㉑ OUT_OF_SCOPE 每条带 why(报名式排除的最低形状)', () => {
    return OUT_OF_SCOPE.length >= 8 && OUT_OF_SCOPE.every((o) => o.re instanceof RegExp && typeof o.why === 'string' && o.why.length >= 8)
  })
  t('㉒ 真仓被审面:button-variants.ts 的 outline 档按 HEAD 面解析出含 border 的共享档', () => {
    const got = catBatch(repoRoot, [`HEAD:${BUTTON_VARIANTS_REL}`], { maxBuffer: 1 << 24 })
    const s = got.get(`HEAD:${BUTTON_VARIANTS_REL}`)
    if (typeof s !== 'string') return false
    const m = sharedBorderConstsOf(s)
    return (
      m.has('SHARED_BUTTON_VARIANT_CLASSES.outline') &&
      /border-input/.test(m.get('SHARED_BUTTON_VARIANT_CLASSES.outline')) &&
      !m.has('SHARED_BUTTON_SIZE_CLASSES.sm')
    )
  })
  t('㉓ 合规反臂:同一段里写了 border-input 必须放行(恒红也算通过的反面)', () => {
    const red = A('<button className="border px-3">ok</button>').violations.length === 1
    const ok = A('<button className="border border-input px-3">ok</button>').violations.length === 0
    return red && ok
  })
  t('㉔ 多行 className 的 cn(...) 字面段全部可见(跨行属性区)', () => {
    const src = [
      '<button',
      '  className={cn(',
      "    'inline-flex rounded-sm bg-background',",
      "    'border border-input',",
      '  )}',
      '>',
    ].join('\n')
    const r = A(src)
    return r.compliant === 1 && r.violations.length === 0
  })
  t('㉕ 零宽词元:注释里的 border 不算取用(maskFaces 生效)', () => {
    const src = ['// <button className="border">', '<div>hi</div>'].join('\n')
    const r = A(src)
    return r.violations.length === 0 && r.borderElems === 0
  })
  t('㉖ RN StyleSheet 对象级配对判据(FAMILY_RN):配对合规/裸宽判红/方向变体/兄弟对象色不救/零宽豁免/展开未判定', () => {
    const R = (src) => auditRnStyleText('packages/app/src/x.ts', src)
    const pair = R('const s = StyleSheet.create({ c: { borderWidth: 1, borderColor: "#eee" } })')
    const naked = R('const s = StyleSheet.create({ c: { borderWidth: 1 } })')
    const dirOk = R('const s = StyleSheet.create({ c: { borderTopWidth: 1, borderTopColor: k } })')
    const dirBad = R('const s = StyleSheet.create({ c: { borderTopWidth: 1 } })')
    const sib = R('const s = StyleSheet.create({ a: { borderWidth: 1 }, b: { borderColor: x } })')
    const zero = R('const s = StyleSheet.create({ c: { borderWidth: 0, style: "none" } })')
    const zeroDir = R('const s = StyleSheet.create({ c: { borderLeftWidth: 0 } })')
    const spread = R('const s = StyleSheet.create({ c: { ...tk.border, borderWidth: 1 } })')
    return (
      pair.violations.length === 0 &&
      pair.compliant === 1 &&
      naked.violations.length === 1 &&
      naked.violations[0].family === FAMILY_RN &&
      dirOk.violations.length === 0 &&
      dirOk.compliant === 1 &&
      dirBad.violations.length === 1 &&
      sib.violations.length === 1 &&
      zero.violations.length === 0 &&
      zero.compliant === 1 &&
      zeroDir.violations.length === 0 &&
      zeroDir.compliant === 1 &&
      spread.violations.length === 0 &&
      spread.undetermined.length === 1 &&
      spread.undetermined[0].reason === 'rn-style-spread'
    )
  })
  t('㉗ RN 违规行号 = borderWidth 键行(多行对象);嵌套对象取最内层界', () => {
    const src = ['const s = StyleSheet.create({', '  c: {', '    padding: 4,', '    borderWidth: 1,', '  },', '})'].join('\n')
    const r = auditRnStyleText('packages/app/src/x.ts', src)
    const nested = auditRnStyleText('packages/app/src/y.ts', 'const s = StyleSheet.create({ row: { p: 4, box: { borderWidth: 1 } } })')
    return r.violations.length === 1 && r.violations[0].line === 4 && nested.violations.length === 1
  })
  t('㉘ RN 射程:packages/app 与 apps/mobile-rn 的 .ts/.tsx 在射程;web/共享包 .ts 与测试面不在', () => {
    return (
      isInScope('packages/app/src/components/SearchInput.tsx') &&
      isInScope('packages/app/src/features/plan/plan-styles.ts') &&
      isInScope('apps/mobile-rn/src/components/SideMenu.tsx') &&
      !isInScope('apps/web/src/lib/utils.ts') &&
      !isInScope('packages/shared/src/ui/x.ts') &&
      !isInScope('packages/app/tests/text-field.test.tsx')
    )
  })
  t('㉙ 字面段已带基础色 + 动态标识符 ⇒ 合规(色检查先于 dynamic,7 处未判定自愈路径)', () => {
    const r = A("<button className={cn('border border-input px-2', active && 'bg-accent')}>ok</button>")
    return r.violations.length === 0 && r.compliant === 1 && r.undetermined.length === 0
  })

  const { pass, fail, cases } = report()
  for (const r of cases) console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ` —— ${r.got}`}`)
  console.log(`--self-test: ${cases.length} 条,失败 ${fail} 条`)
  return fail ? 1 : 0
}

// §22d:双形态入口守护 —— 镜像测试 import 判据时不得触发 CLI(它会派生 git)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  ROOT,
  FAMILY,
  FAMILY_RN,
  RN_DIR_RE,
  BUTTON_VARIANTS_REL,
  BASELINE_REL,
  OUT_OF_SCOPE,
  isInScope,
  classifyBorderToken,
  headToken,
  buttonEvidence,
  ownAttrText,
  extractClassInfo,
  sharedBorderConstsOf,
  auditFileText,
  auditRnStyleText,
  anchorKey,
  countByKey,
  applyRatchet,
  anchorRegression,
  emitBaseline,
  parseBaseline,
  tightenAnchors,
  faceFromArgv,
  runAudit,
  runAuditWorktree,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
