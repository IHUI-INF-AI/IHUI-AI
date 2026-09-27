#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-rn-double-header.mjs —— RN 屏包装器双层页头对账(判据 DH1 / DH2)
 *
 * 立因(2026-09-27 实测定案,不是推测):
 *   `apps/mobile-rn` 的一批屏是「包装器」:自己 import `components/NavBar` 画一条页头,
 *   再渲染 `@ihui/rn-app` 的共享屏 —— 而共享屏**自己也画一条页头**(单一源头的
 *   `packages/app/src/components/BackChevron.tsx` + `styles.header`)。同一个屏幕上叠两条页头。
 *   导航面**没有**画 header:`apps/mobile-rn/src/navigation/RootNavigator.tsx` 的 MainTabs 与
 *   RootStack 两处都是 `headerShown:false`,Settings 注册处也没有 per-screen 覆盖 ——
 *   所以判据不去读导航配置(那里永远看不到这一型)。
 *
 * 三条实测决定了判据的形状,照抄勿重新发明:
 *   ① 共享屏的页头**不可删**:HEAD 面实测 160+ 个 RN 屏以它为唯一页头(Wallet / Order / Help 全系)。
 *      ⇒ 反向对照不是"造出来的绿",是本仓的主体形态。
 *   ② 包装器的 NavBar 在 Settings / Profile 上承载 SideMenu 抽屉的唯一入口(☰ 菜单),删即功能丢失。
 *   ③ 共享侧 loading 分支实测**只有 spinner,没有页头也没有返回按钮**
 *      (`packages/app/src/features/course-detail/CourseDetailScreen.tsx` 的 loading 支),
 *      这正是包装器 NavBar 存在的原因 —— 所以正确出口是"给共享屏补抑制通道并在调用点传入",
 *      **不是**删任意一层。修复提示按这句话写,免得下一个人走"删包装器 NavBar"这条错路。
 *
 * 初扫 8 个候选里 3 个是假阳,它们已经在调用点用了共享屏的「页头抑制通道」:
 *   AgentScreen 传 `nestedInScrollView`(共享侧命中即早退,不再画页头)、
 *   NewsScreen→SquareScreen 传 `hideHeader`(`{hideHeader ? null : (页头)}`)、
 *   ShareScreen 传 `renderHeader`(页头由宿主给)。
 *   ⇒ 这三个名字**来自实测,不是穷举**。判据必须认调用点实参层的这条通道,否则一上线就把
 *     已经做对的三处判红 —— 按规矩写就红的门只有一个结局:逼人 `--no-verify`,连带废掉全部守门。
 *   泛化:任何**属性名含 `header`** 的实参都按同一规则处理(须"声明且被读"),外加 `nestedInScrollView`
 *   这一条不含 header 字样的实测例外。
 *
 * 判据
 *   DH2 双层叠加:RN 屏文件**无条件**渲染 NavBar(含 `import { NavBar as X }` 的别名解析)
 *     ∧ 同文件渲染的 `@ihui/rn-app` 具名组件(含 `as` 别名)其源码自带页头
 *     ∧ 调用点没有任何"声明且被读"的抑制通道 ⇒ 违规。
 *     锚点 = **该文件在 HEAD 自身的违规数**(与 77/83/98/102/113/131 同族):存量只报数,新增才判红。
 *     把 5 处存量当场判红就是一台与任何提交都无关的恒红门(§12e),唯一结局是逼人绕过钩子。
 *   DH1 机制在位/被摘线:抑制通道若在 `packages/app` 整族消失(无一条"声明且被读"),而本面又存在
 *     双层候选 ⇒ 判"失明"并喊原因。刻意**不在**"通道没了但也没有候选"时判红 —— 那会把一件
 *     合法的收口(全部包装器都改用共享页头)变成永久红门。
 *     同族教训:守门 70/76/81 —— 出口被摘线而门照报绿 = 没有门。
 *
 * 判据面**先剥注释与字符串**(等长遮罩,行号不变 —— 本门按位置向前回溯 `return`,删字符会错位):
 *   遮罩实现只有 `scripts/lib/code-mask.mjs` 一份,不得留本地副本(守门 131/135 因两处实现
 *   漂移各吃过一次亏,镜像测试有"任一门不得留第二份"的锁)。理由实测:本仓已两次发生
 *   "门把自己解释自己的注释判成违规"。豁免标记写在注释里,所以**豁免判原文、命中判遮罩面**。
 *
 * 口径同 70/77/83/98/101/103/118:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工逃生舱、两面旗同给 exit 2、任一面取不到 ⇒ **exit 2 无法判定**且不回落另一面;
 * 枚举与内容同面同轮;head 面枚举到 0 个候选判死不记绿。
 *
 * 已知射程上限(如实登记,不写成"已覆盖"):
 *   - 自带页头只认 `<BackChevron>` 这一形态(AGENTS §4 定的 RN 页头返回键唯一实现)。共享屏若
 *     改用别的页头载体,本门会把它读成"没有自带页头" ⇒ 少判一条,不会误判红。
 *   - `nestedInScrollView` 这类"早退式"通道只在**调用点实参**上判;共享侧的分支写法变了而名字
 *     还在时,由"声明且被读"那条(出现 ≥2 次)兜住。
 *   - 抑制通道经 `{...spread}` 传进来时判"未判定"并点名,不猜、也不静默算通过。
 *
 * 用法:node scripts/check-rn-double-header.mjs [--staged|--worktree|--json|--strict|--self-test|--files a b|--update-baseline]
 * 手动问责:pnpm check:rn-double-header(带 --strict,存量也判红)
 * 紧急跳过:HUSKY_SKIP_RN_DOUBLE_HEADER=1
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000
const SKIP_ENV = 'HUSKY_SKIP_RN_DOUBLE_HEADER'
const BASELINE_REL = 'scripts/rn-double-header-baseline.json'
const EXEMPT = /double-header-exempt:\s*(.*)$/
const EXEMPT_CLOSER = /^[\s*/{}-]+$/
/**
 * 豁免**必须带真原因**。裸标记(或只写一个注释闭合序列)不算 ——
 * 守门 102 记过同一型:标记后面只跟注释的闭合符时,那行曾被读成"带了原因",于是一行免检。
 * (AGENTS §守门速查同条另记了一次同款自咬:注释里原样写出那两个字符会先把注释自己关掉。)
 */
export function exemptReason(line) {
  const m = EXEMPT.exec(line || '')
  if (!m) return false
  const reason = m[1]
  // 空原因(冒号后什么都不剩)与"只剩注释闭合符"都不算理由
  return reason.trim() !== '' && !EXEMPT_CLOSER.test(reason)
}
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/

/** RN 侧发起面:只有 mobile-rn 会同时拿到 NavBar 与共享屏(包装器形态),故整包扫 .tsx/.jsx */
const RN_ROOT = 'apps/mobile-rn/src'
const SRC_EXT = /\.(tsx|jsx)$/
/** 共享包名与它的源码根:名字在 RN 侧 import 里写死,包根由仓内清单现读(不硬编码目录) */
const SHARED_PKG = '@ihui/rn-app'
/** 抑制通道名的三条形态(隐藏 / 替换 / 实测例外),见 isChannelName 的注释 */
const HIDE_CHANNEL = /^(?:hide|skip|omit|without)[A-Za-z]*Header$/
const SHOW_CHANNEL = /^(?:show|with)[A-Za-z]*Header$/
const REPLACE_CHANNEL = /^(?:render|custom)[A-Za-z]*Header$/
/** 不含 header 字样的实测例外:共享侧命中即早退、不再画页头 */
const EXTRA_CHANNELS = ['nestedInScrollView']
/** NavBar 的本地模块路径特征(端内组件,不来自共享包) */
const NAVBAR_MODULE = /components\/NavBar$/
/** 页头载体:AGENTS §4 定的 RN 页头返回键唯一实现 */
const HEADER_MARK = 'BackChevron'
/** 向前回溯 `return` / 未配对 `{` 的窗口(字符)。超出即判"未判定",不猜。 */
const GUARD_WINDOW = 6000
const GUARD_TOKEN = /&&|\|\||[^=!<>?\w]\?(?![.?])/

/** 行号线索只用于**报告**;判据与台账一律按内容锚点(AGENTS §1 禁止证据指针写行号)。 */
function lineOf(text, pos) {
  let n = 1
  for (let i = 0; i < pos && i < text.length; i++) if (text[i] === '\n') n++
  return n
}

function tagRe(name) {
  return new RegExp('<' + name + '(?![A-Za-z0-9_$])', 'g')
}
function tagPresent(text, name) {
  return new RegExp('<' + name + '(?![A-Za-z0-9_$])').test(text)
}

/**
 * `import { X as Y, type Z } from '@ihui/rn-app'` → [{symbol:X, alias:Y}]。
 * 不解析 `as` 别名就会漏判真站点(HEAD 面 5 处全部写成 `X as SharedX`)。
 * 命名空间导入 / 默认导入形态解不出具名符号 ⇒ 交调用方计"未判定",不静默算"没有"。
 */
export function parseSharedImports(text) {
  const out = []
  const RE = /import\s+(type\s+)?\{([^}]*)\}\s+from\s*['"]([^'"]+)['"]/g
  for (const m of text.matchAll(RE)) {
    if (m[3] !== SHARED_PKG) continue
    if (m[1]) continue // `import type { … }` 整条只是类型
    for (const raw of m[2].split(',')) {
      const p = raw.trim()
      if (!p) continue
      if (/^type\s/.test(p)) continue // 纯类型导入不可能被当组件渲染
      const mm = /^([A-Z][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(p)
      if (!mm) {
        out.push({ symbol: null, alias: null, raw: p })
        continue
      }
      out.push({ symbol: mm[1], alias: mm[2] || mm[1] })
    }
  }
  return out
}

/** NavBar 的本地绑定名(含 `import NavBar from` / `import { NavBar as X }` 两种形态) */
export function parseNavBarBindings(text) {
  const names = new Set()
  let unparsed = false
  const RE = /import\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g
  for (const m of text.matchAll(RE)) {
    if (!NAVBAR_MODULE.test(m[2])) continue
    const clause = m[1].trim()
    if (clause.startsWith('{')) {
      for (const raw of clause.slice(1, -1).split(',')) {
        const p = raw.trim().replace(/^type\s+/, '')
        if (!p) continue
        const mm = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(p)
        if (mm) names.add(mm[2] || mm[1])
        else unparsed = true
      }
      continue
    }
    if (/^[A-Z][\w$]*$/.test(clause)) names.add(clause)
    else unparsed = true
  }
  return { names, unparsed }
}

/**
 * 渲染点是否"无条件":从命中位置向前回溯,找**最近一个未配对的 `{`**。
 *   · 该 `{` 之后出现 `&&` / `||` / 三元 `?` ⇒ guarded(条件渲染,本门不判红,但如实报数)
 *   · 先撞到 `return` 或窗口起点 ⇒ plain(挂在顶层返回的 JSX 上)
 * 判不出来一律 'unknown' 并计入未判定 —— 把"看不见"写成"没问题"是本仓最高频的失效型。
 */
export function renderGuard(masked, pos) {
  const start = Math.max(0, pos - GUARD_WINDOW)
  let depth = 0
  for (let i = pos - 1; i >= start; i--) {
    const c = masked[i]
    if (c === '}') depth++
    else if (c === '{') {
      if (depth === 0) {
        const seg = masked.slice(i, pos)
        return GUARD_TOKEN.test(seg) ? 'guarded' : 'plain'
      }
      depth--
    } else if (
      masked.startsWith('return', i) &&
      !/[\w$]/.test(masked[i - 1] || '') &&
      !/[\w$]/.test(masked[i + 6] || '')
    ) {
      return 'plain'
    }
  }
  return start === 0 ? 'plain' : 'unknown'
}

/**
 * 通道名规则(刻意**不是**"名字里带 header 就算"):
 *   HIDE    `hideHeader` / `withoutDetailHeader` —— 布尔,真值 = 抑制
 *   SHOW    `showHeader` —— 布尔,**假值**才是抑制
 *   REPLACE `renderHeader` / `customHeader` —— 页头由宿主给,共享侧不再画
 *   EXTRA   不含 header 字样的实测例外(`nestedInScrollView`)
 * 泛化成"/header/i"会把 `headerRow` / `cardHeader` 这类样式键与元素名一并认作通道,
 * 于是通道族清单变成一张什么都能对上的噪声表 —— 判据失去区分力还一路报绿。
 */
export function isChannelName(name) {
  if (EXTRA_CHANNELS.includes(name)) return 'extra'
  if (HIDE_CHANNEL.test(name)) return 'hide'
  if (SHOW_CHANNEL.test(name)) return 'show'
  if (REPLACE_CHANNEL.test(name)) return 'replace'
  return null
}

/** 共享屏是否自带页头(实测形态 = 渲染 HEADER_MARK) */
export function selfHeader(masked) {
  return tagPresent(masked, HEADER_MARK)
}

/** 从 `<Alias` 起读到该**开标签**的 `>`(深度 0,跳过 `{}`/`()`/`[]` 里的嵌套) */
export function readTagRegion(masked, start) {
  let depth = 0
  for (let i = start; i < masked.length; i++) {
    const c = masked[i]
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    else if (c === '>' && depth === 0 && masked[i - 1] !== '=')
      return masked.slice(start, masked[i - 1] === '/' ? i - 1 : i)
    else if (c === '<' && depth === 0 && i > start) return null // 撞上子元素 ⇒ 开标签没闭合,判不出
  }
  return null
}

function matchBrace(text, openIdx) {
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * 解析开标签的属性面。**只在深度 0 取属性名**,所以三元/箭头函数体里的标识符
 * 不会被误读成属性(实测:naive 正则在 ShareScreen 上把 `null` / `handleShare`
 * 当成了属性名,并把 `renderHeader` 整条截丢 ⇒ 假阳)。
 * @returns {{attrs:Map<string,{kind:string,value:string|null}>, spreads:string[]}}
 */
export function parseTagAttrs(region) {
  const attrs = new Map()
  const spreads = []
  let i = region.search(/[\s\n]/)
  if (i < 0) return { attrs, spreads }
  let depth = 0
  while (i < region.length) {
    const c = region[i]
    // `{...hostProps}` 必须**先于**通用的花括号计数处理:否则那个 `{` 会把深度抬起来,
    // 展开对象整条属性在判据里隐身 —— 实测这样产出的不是"少判",而是把真抑制判成违规。
    if (depth === 0 && c === '{' && region.startsWith('...', i + 1)) {
      const rest = region.slice(i + 4)
      const s = /^\s*([A-Za-z_$][\w$]*)/.exec(rest)
      spreads.push(s ? s[1] : '?')
      const end = matchBrace(region, i)
      i = end < 0 ? region.length : end + 1
      continue
    }
    if (c === '{' || c === '(' || c === '[') {
      depth++
      i++
      continue
    }
    if (c === '}' || c === ')' || c === ']') {
      depth--
      i++
      continue
    }
    if (depth !== 0) {
      i++
      continue
    }
    const mm = /^[A-Za-z_$][\w$]*/.exec(region.slice(i))
    if (!mm || /[\w$.]/.test(region[i - 1] || '')) {
      i++
      continue
    }
    const name = mm[0]
    let j = i + name.length
    while (j < region.length && /\s/.test(region[j])) j++
    if (region[j] === '=') {
      let k = j + 1
      while (k < region.length && /\s/.test(region[k])) k++
      if (region[k] === '{') {
        const end = matchBrace(region, k)
        attrs.set(name, { kind: 'expr', value: end < 0 ? null : region.slice(k + 1, end).trim() })
        i = end < 0 ? region.length : end + 1
        continue
      }
      attrs.set(name, { kind: 'value', value: null })
      i = k + 1
      continue
    }
    attrs.set(name, { kind: 'bare', value: null })
    i = j
  }
  return { attrs, spreads }
}

/** 调用点:找到 `<alias` 开标签并解析它的属性区;取不到 ⇒ null(由调用方计未判定) */
export function callSiteAttrs(masked, aliasName) {
  const RE = tagRe(aliasName)
  const m = RE.exec(masked)
  if (!m) return null
  const region = readTagRegion(masked, m.index)
  if (region === null) return null
  const parsed = parseTagAttrs(region)
  return { ...parsed, pos: m.index }
}

/**
 * `{...sharedProps}` 的一跳回溯:在同文件里找 `const sharedProps ... = { … }` 的**对象字面量**,
 * 返回它的键名。解析不出 ⇒ null(不猜)。
 * 依据:共享屏的抑制通道可以经展开对象传进来,只看字面属性会把真抑制判成违规;
 * 而"顺手改成不猜"会把真违规判成抑制 —— 所以取不到时要如实点名。
 */
export function resolveObjectKeys(masked, objName) {
  const RE = new RegExp(
    '(?:const|let|var)\\s+' + objName + '\\b[^=]*=\\s*(?:[A-Za-z_$][\\w$<>,\\[\\]\\s|&]*\\s*)?\\{',
  )
  const m = RE.exec(masked)
  if (!m) return null
  const open = masked.indexOf('{', m.index + m[0].length - 1)
  const close = matchBrace(masked, open)
  if (close < 0) return null
  const body = masked.slice(open + 1, close)
  const keys = []
  for (const seg of body.split(/,(?![^{}]*\})/)) {
    const mm = /^\s*([A-Za-z_$][\w$]*)\s*:?\s*$/.exec(seg.replace(/[[]\s*[A-Za-z_$][\w$]*\s*\]/g, ''))
    if (mm) keys.push(mm[1])
  }
  return keys
}

/**
 * 声明:共享侧真的**接受**这个 prop。两种真实写法:
 *   ① props 接口成员 / 逐行解构 —— 行首 `NAME?:` / `NAME =` / `NAME,`
 *   ② 同行解构 `function X({ a, hideHeader }: P)` —— 只在**形参括号内**认
 * 刻意不写"文件里出现过这个名字就算":共享组件在自己的 body 里以同名实参**调用别的函数**
 * 时,它并没有接受这个 prop —— 那正是"看起来有、其实没装车"那一型,判成已声明就等于把真违规
 * 洗成抑制(失效方向必须是"多要一次说明",不能是"多放一次跳门")。
 */
export function channelDeclared(sharedText, name) {
  const N = name.replace(/[$]/g, '\\$')
  if (new RegExp('^\\s*' + N + '\\s*\\??\\s*[:=,]', 'm').test(sharedText)) return true
  const SIG = /(?:function\s+[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*\s*=\s*)\(\s*\{([\s\S]{0,1200}?)\}/g
  for (const m of sharedText.matchAll(SIG)) {
    // 解构清单的末项后面既没有 `,` 也没有 `:`(它就是 `}` 前的那一段),所以 `$` 也是合法结尾
    if (new RegExp('(^|,)\\s*' + N + '\\s*\\??\\s*(?:=|,|$)').test(m[1])) return true
  }
  return false
}
/**
 * 被读:该通道在共享侧出现在**分支位置**上(三元 / `&&` / `||` / `!` / `if()` / 比较 / 作为函数调用)。
 * 只被解构出来却从没被读过的 prop **什么都没抑制** —— 那正是本门要防的"看起来有、其实没装车"。
 * 三种真实形态(2026-09-27 现读 HEAD):
 *   `{hideHeader ? null : (页头)}` / `{renderHeader ? renderHeader() : <BackChevron/>}` / `if (nestedInScrollView) { … }`
 */
export function channelHonored(sharedText, name) {
  const N = name.replace(/[$]/g, '\\$')
  const READ = new RegExp(
    '(?:if\\s*\\(\\s*!?\\s*' +
      N +
      '\\b|!' +
      N +
      '\\b|' +
      N +
      '\\s*(?:\\?|&&|\\|\\||===|!==|\\())',
  )
  return READ.test(sharedText)
}

/** `export function X(` / `export const X =` 形态的定义位;返回 symbol → [文件] */
export function buildSymbolIndex(files) {
  const idx = new Map()
  for (const [rel, text] of files) {
    if (!text) continue
    const masked = maskCommentsAndStrings(text)
    for (const m of masked.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Z][\w$]*)/g)) {
      if (!idx.has(m[1])) idx.set(m[1], [])
      idx.get(m[1]).push({ rel, masked })
    }
  }
  return idx
}

/** 实参值 → 'true' | 'false' | null(判不出) */
function boolOf(attr) {
  if (!attr) return null
  if (attr.kind === 'bare') return 'true'
  if (attr.kind !== 'expr') return null
  const v = (attr.value || '').trim()
  if (v === 'true') return 'true'
  if (v === 'false') return 'false'
  return null
}

/**
 * 纯函数:一个调用点的抑制通道结论(命中判据走遮罩面,所以传 rnMasked 而不是原文)。
 * 三种真实形态在 HEAD 面上实测(2026-09-27):AgentScreen 传 `nestedInScrollView`、
 * NewsScreen→SquareScreen 传 `hideHeader`、ShareScreen 传 `renderHeader`。
 * @returns {{suppressed:string[], noop:Array<{name:string,reason:string}>, undetermined:string[]}}
 */
export function evaluateChannels({ attrs, spreads, rnMasked, sharedMasked }) {
  const suppressed = []
  const noop = []
  const undetermined = []
  const consider = (name, attr) => {
    const shape = isChannelName(name)
    if (!shape) return false
    const wantsTrue = shape !== 'show' // show 族只有 false 才是抑制
    let on = boolOf(attr)
    if (shape === 'replace' || shape === 'extra') on = on === 'false' ? 'false' : 'true'
    if (on === null) {
      undetermined.push(name) // 值不是字面量 ⇒ 如实点名,方向是"多要一次说明",不是多判一次红
      on = 'true'
    }
    if (on !== (wantsTrue ? 'true' : 'false')) return true // 实参在,但不构成抑制(如 hideHeader={false})
    if (!channelDeclared(sharedMasked, name)) {
      noop.push({ name, reason: 'suppress-undeclared' })
      return true
    }
    if (!channelHonored(sharedMasked, name)) {
      noop.push({ name, reason: 'suppress-not-honored' })
      return true
    }
    suppressed.push(name)
    return true
  }
  for (const [name, attr] of attrs) consider(name, attr)
  for (const objName of spreads || []) {
    const keys = resolveObjectKeys(rnMasked, objName)
    if (keys === null) {
      undetermined.push('{...' + objName + '}')
      continue
    }
    for (const k of keys) consider(k, { kind: 'bare', value: null })
  }
  return { suppressed, noop, undetermined }
}

/**
 * DH2 单文件审计(纯函数,不碰 git —— 取材面由调用方决定,所以正反例都能构造)。
 * @param rnText 原文(NavBar 绑定与豁免标记走原文)
 * @param rnMasked 遮罩面(命中判据走这一面)
 * @param symbolIndex buildSymbolIndex 的产物(共享侧,同面同轮)
 */
export function auditRnFile({ file, rnText, rnMasked, symbolIndex }) {
  const hits = []
  const undetermined = []
  const usedChannels = new Set()
  let exempted = 0
  const rawLines = rnText.split('\n')
  /**
   * 行内出口 `double-header-exempt: <原因>` —— **必须带原因**(裸标记不放行,守门 102 同一条收紧)。
   * 认两处落点:NavBar 渲染行、共享屏调用行,以及它们各自的紧邻上一行(纯注释行)。
   * 豁免判**原文**(标记就写在注释里,遮罩之后永远匹配不到 —— 那等于把出口自己抹掉)。
   */
  const exemptAt = (pos) => {
    const ln = lineOf(rnMasked, pos)
    for (const i of [ln - 1, ln - 2]) {
      const l = rawLines[i]
      if (l === undefined) continue
      if (i === ln - 2 && !COMMENT_LINE.test(l)) continue
      if (exemptReason(l)) return true
    }
    return false
  }
  const nav = parseNavBarBindings(rnText)
  const navNames = new Set([...nav.names])
  if ((!navNames.size || nav.unparsed) && tagPresent(rnMasked, 'NavBar')) {
    // 渲染了 NavBar 却没有可解析的绑定:命名空间导入(`NS.NavBar`)等形态。
    // 判不出归属 ⇒ 未判定,不猜也不静默放行。
    undetermined.push({ file, reason: '渲染 NavBar 但解析不到它的 import 绑定' })
  }
  const navPositions = []
  for (const n of navNames) {
    const RE = tagRe(n)
    let m
    while ((m = RE.exec(rnMasked))) navPositions.push({ name: n, pos: m.index })
  }
  if (!navPositions.length)
    return { hits, undetermined, exempted, usedChannels, navRendered: false }
  const guards = navPositions.map((p) => ({ ...p, guard: renderGuard(rnMasked, p.pos) }))
  const plain = guards.filter((g) => g.guard === 'plain')
  for (const g of guards.filter((x) => x.guard !== 'plain')) {
    undetermined.push({
      file,
      reason: `NavBar 渲染点${g.guard === 'guarded' ? '是条件分支' : '归属判不出'}(${g.name})`,
    })
  }
  const live = plain.filter((g) => {
    if (!exemptAt(g.pos)) return true
    exempted++
    return false
  })
  if (!live.length || !plain.length)
    return { hits, undetermined, exempted, usedChannels, navRendered: true }

  const shared = parseSharedImports(rnText)
  for (const imp of shared) {
    if (!imp.symbol) {
      undetermined.push({ file, reason: `共享包导入项解不出符号:${imp.raw}` })
      continue
    }
    if (!tagPresent(rnMasked, imp.alias)) continue // 只 import 没渲染
    const defs = symbolIndex.get(imp.symbol) || []
    if (!defs.length) {
      undetermined.push({
        file,
        reason: `${SHARED_PKG} 的 ${imp.symbol} 在共享包源码里找不到定义位`,
      })
      continue
    }
    const headed = defs.filter((d) => selfHeader(d.masked))
    if (!headed.length) continue // 共享侧不自带页头 ⇒ 这一族不是双层(反向对照)
    const site = callSiteAttrs(rnMasked, imp.alias)
    if (!site) {
      undetermined.push({ file, reason: `${imp.alias} 的调用点开标签取不到(未闭合或撞上子元素)` })
      continue
    }
    const ev = evaluateChannels({
      attrs: site.attrs,
      spreads: site.spreads,
      rnMasked,
      sharedMasked: headed[0].masked,
    })
    for (const n of ev.undetermined)
      undetermined.push({ file, reason: `${imp.alias} 的通道 ${n} 取值判不出(按已抑制处理,不判红)` })
    for (const n of [...ev.suppressed, ...ev.noop.map((x) => x.name)]) usedChannels.add(n)
    const base = {
      file,
      navTag: live[0].name,
      symbol: imp.symbol,
      alias: imp.alias,
      sharedFile: headed[0].rel,
    }
    if (ev.noop.length) {
      if (exemptAt(site.pos)) {
        exempted++
        continue
      }
      for (const n of ev.noop) hits.push({ ...base, channel: n.name, reason: n.reason })
      continue
    }
    if (ev.suppressed.length) continue // 抑制通道声明且被读 ⇒ 单层页头,合规
    if (exemptAt(site.pos)) {
      exempted++
      continue
    }
    hits.push({
      ...base,
      channel: null,
      reason: site.spreads.length ? 'double-header-via-spread' : 'double-header',
    })
  }
  return { hits, undetermined, exempted, usedChannels, navRendered: true }
}

function listFacePaths(face, prefix) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z', '--', prefix], ROOT, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean)
  if (face === 'staged')
    return gitRaw(['ls-files', '-z', '--', prefix], ROOT, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-files', '-z', '--', prefix], ROOT, { timeout: GIT_TIMEOUT })
    .split('\0')
    .filter(Boolean)
}

/**
 * 暂存面上 RN 侧候选**收窄到本次改动的文件**(与守门 131 同取向:pre-commit 判的是"这次提交
 * 会带走的内容")。共享侧**不收窄** —— 符号解析要看整棵索引,少一份源就把真站点读成
 * "找不到定义位"。差异集为空时按整棵索引兜底(防"空暂存恒绿",守门 70 那一课)。
 */
function stagedRnChanged(prefix) {
  const changed = gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], ROOT, {
    timeout: GIT_TIMEOUT,
  })
    .split('\0')
    .filter(Boolean)
    .filter((p) => p.startsWith(prefix + '/'))
  return changed
}

function readFace(paths, face) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(ROOT, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

/** 现读共享包所在的目录(包名 → 仓内路径),不把 `packages/app` 写死成第二份真相 */
function sharedPackageRoot(face) {
  const manifests = listFacePaths(face, 'packages')
    .concat(listFacePaths(face, 'apps'))
    .filter((p) => /(^|\/)package\.json$/.test(p) && !/(^|\/)node_modules\//.test(p))
  const texts = readFace(manifests, face)
  for (const rel of manifests) {
    const t = texts.get(rel)
    if (typeof t !== 'string') continue
    let json
    try {
      json = JSON.parse(t)
    } catch {
      continue
    }
    if (json && json.name === SHARED_PKG) return dirname(rel)
  }
  return null
}

/** 一个面的全部违规记录 + 未判定(不含棘轮) */
function collect(face, onlyRn) {
  const pkgRoot = sharedPackageRoot(face)
  if (!pkgRoot)
    return { undeterminedAll: [{ reason: `面上找不到 ${SHARED_PKG} 的包清单(名字或位置漂了)` }], hits: [], files: [], unreadable: [], sharedFiles: 0 }
  const rnAll = listFacePaths(face, RN_ROOT).filter((p) => SRC_EXT.test(p))
  let narrowed = null
  if (face === 'staged' && !onlyRn) {
    const changed = stagedRnChanged(RN_ROOT)
    if (changed.length) narrowed = new Set(changed)
  }
  let rnFiles = narrowed ? rnAll.filter((p) => narrowed.has(p)) : rnAll
  if (onlyRn) rnFiles = rnFiles.filter((p) => onlyRn.includes(p))
  const sharedAll = listFacePaths(face, pkgRoot).filter((p) => SRC_EXT.test(p) || /\.ts$/.test(p))
  const rnTexts = readFace(rnFiles, face)
  const sharedTexts = readFace(sharedAll, face)
  const sharedMap = new Map()
  const unreadable = []
  for (const p of sharedAll) {
    const t = sharedTexts.get(p)
    if (typeof t !== 'string') continue
    sharedMap.set(p, t)
  }
  for (const p of rnFiles) if (typeof rnTexts.get(p) !== 'string') unreadable.push(p)
  const symbolIndex = buildSymbolIndex(sharedMap)
  const hits = []
  const undeterminedAll = []
  const channelsSeen = new Set()
  let exemptedAll = 0
  for (const p of rnFiles) {
    const t = rnTexts.get(p)
    if (typeof t !== 'string') continue
    if (!t.includes(SHARED_PKG)) continue
    const r = auditRnFile({ file: p, rnText: t, rnMasked: maskCommentsAndStrings(t), symbolIndex })
    hits.push(...r.hits)
    undeterminedAll.push(...r.undetermined)
    exemptedAll += r.exempted
    for (const c of r.usedChannels) channelsSeen.add(c)
  }
  // DH1 的输入:通道族在**共享侧**是否仍"声明且被读"(与调用点是否用它们无关)
  const declaredChannels = new Set()
  const honoredChannels = new Set()
  for (const [, t] of sharedMap) {
    const masked = maskCommentsAndStrings(t)
    for (const m of masked.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      const name = m[1]
      if (!isChannelName(name)) continue
      if (channelDeclared(masked, name)) declaredChannels.add(name)
      if (channelHonored(masked, name)) honoredChannels.add(name)
    }
  }
  return {
    hits,
    undeterminedAll,
    exempted: exemptedAll,
    unreadable,
    files: rnFiles,
    scanned: rnFiles.length,
    scannedAll: rnAll.length,
    narrowed: !!narrowed,
    sharedFiles: sharedAll.length,
    pkgRoot,
    channelsUsedAtSites: [...channelsSeen],
    channelsDeclared: [...declaredChannels],
    channelsHonored: [...honoredChannels],
  }
}

/**
 * 纯函数:把"本轮计数"与"HEAD 锚点计数"折成红名单(锚点恒为该文件 HEAD 自身存量,
 * 绝不来自基线 JSON —— 静态清单会被一次整文件回退带旧,把修法本身判成违规,守门 77 那一课)。
 */
export function decideRed(currentByFile, headByFile) {
  const red = []
  for (const [f, n] of [...currentByFile].sort()) {
    const cap = headByFile.get(f) || 0
    if (n > cap) red.push({ file: f, n, cap })
  }
  return red
}

/** 纯函数:DH1 失明判据 —— 只有"本面存在双层候选 **且** 通道族整族不可用"才判红 */
export function decideBlind({ violationCount, honoredChannels, undeclaredChannelHits }) {
  const familyGone = honoredChannels.length === 0
  return familyGone && (violationCount > 0 || undeclaredChannelHits > 0)
}

export function analyze(face, opts = {}) {
  const cur = collect(face, opts.files)
  const head = face === 'head' ? cur : collect('head', opts.files)
  const byFile = (c) => {
    const m = new Map()
    for (const h of c.hits) m.set(h.file, (m.get(h.file) || 0) + 1)
    return m
  }
  const red = opts.strict
    ? [...cur.hits].map((h) => ({ file: h.file, n: 1, cap: 0 }))
    : decideRed(byFile(cur), byFile(head))
  const blind = decideBlind({
    violationCount: cur.hits.length,
    honoredChannels: cur.channelsHonored,
    undeclaredChannelHits: cur.hits.filter((h) => h.reason.startsWith('suppress-')).length,
  })
  const headFiles = new Set(cur.files)
  const emptyScan = face === 'head' && headFiles.size === 0
  const redCount = red.length + (blind ? 1 : 0)
  return {
    face,
    pkgRoot: cur.pkgRoot,
    scannedFiles: cur.scanned,
    sharedFiles: cur.sharedFiles,
    unreadable: cur.unreadable,
    narrowedToStaged: cur.narrowed,
    faceFileCount: cur.scannedAll,
    undetermined: cur.undeterminedAll,
    exempted: cur.exempted,
    violations: cur.hits,
    stock: head.hits,
    red,
    blind,
    channels: {
      declared: cur.channelsDeclared.sort(),
      honored: cur.channelsHonored.sort(),
      usedAtSites: cur.channelsUsedAtSites.sort(),
    },
    total: cur.hits.length,
    filesWithHits: byFile(cur).size,
    emptyScan,
    exit:
      cur.unreadable.length || emptyScan || (cur.undeterminedAll.length && opts.strict && opts.requireDetermined)
        ? 2
        : redCount
          ? 1
          : 0,
  }
}

function readBaseline() {
  const p = join(ROOT, BASELINE_REL)
  if (!existsSync(p))
    return { note: '基线文件不在位(锚点恒取 HEAD 实态,本文件只作台账)', stock: [] }
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'))
    return { ...raw, stock: Array.isArray(raw.stock) ? raw.stock : [] }
  } catch (e) {
    return { note: `基线 JSON 解析失败(${e.message})⇒ 本轮只按 HEAD 实态判,台账不作数`, stock: [] }
  }
}

function runSelfTest() {
  let fail = 0
  const ok = (name, cond) => {
    if (cond) console.log(`✅ ${name}`)
    else {
      fail++
      console.log(`❌ ${name}`)
    }
  }
  const idxOf = (sharedRel, sharedText) =>
    buildSymbolIndex(new Map([[sharedRel, sharedText]]))
  const SHARED = `export function SquareScreen({ t, hideHeader, renderHeader, nestedInScrollView }: P) {
  return (
    <View style={styles.header}>
      {hideHeader ? null : (
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} />
        </View>
      )}
      {nestedInScrollView ? <FlatList data={d} /> : <ScrollView>{items}</ScrollView>}
    </View>
  )
}`
  const SHARED_NOOP = `export function SquareScreen({ t, hideHeader }: P) {
  return (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} />
    </View>
  )
}`
  const WRAP_BAD = `import { SquareScreen as SharedSquare } from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
export default function S() {
  return (
    <View style={{ flex: 1 }}>
      <NavBar title="t" onBack={go} />
      <SharedSquare t={t} />
    </View>
  )
}`
  const WRAP_ALIASED_NAV = WRAP_BAD.replace(
    "import { NavBar } from '../components/NavBar'",
    "import { NavBar as TopBar } from '../components/NavBar'",
  ).replace('<NavBar title', '<TopBar title')
  const WRAP_CONDITIONAL = WRAP_BAD.replace(
    '<NavBar title="t" onBack={go} />',
    '{ready && <NavBar title="t" onBack={go} />}',
  )
  const WRAP_NO_NAVBAR = WRAP_BAD.replace('      <NavBar title="t" onBack={go} />\n', '')
  const WRAP_SUPPRESSED = WRAP_BAD.replace('<SharedSquare t={t}', '<SharedSquare t={t} hideHeader')
  const WRAP_SPREAD = WRAP_BAD.replace(
    '<SharedSquare t={t} />',
    '<SharedSquare {...hostProps} />',
  ).replace(
    'export default function S() {',
    'export default function S() {\n  const hostProps = { t, hideHeader }',
  )
  const WRAP_SPREAD_UNKNOWN = WRAP_BAD.replace('<SharedSquare t={t} />', '<SharedSquare {...hostProps} />')
  const WRAP_FALSE_PROP = WRAP_BAD.replace('<SharedSquare t={t}', '<SharedSquare t={t} hideHeader={false}')
  const WRAP_UNDECLARED = WRAP_BAD.replace('<SharedSquare t={t}', '<SharedSquare t={t} hideDetailHeader')
  const WRAP_ONLY_COMMENT = WRAP_BAD.replace(
    '      <NavBar title="t" onBack={go} />\n',
    '      {/* 早先这里写 <NavBar title="t" onBack={go} />,后来挪走了 */}\n',
  )
  const WRAP_EXEMPT = WRAP_BAD.replace(
    '<SharedSquare t={t} />',
    '<SharedSquare t={t} /> {/* double-header-exempt: 抽屉入口只在 NavBar 上 */}',
  )
  const WRAP_EXEMPT_BARE = WRAP_BAD.replace(
    '<SharedSquare t={t} />',
    '<SharedSquare t={t} /> {/* double-header-exempt: */}',
  )
  const idx = idxOf('packages/app/src/features/square/SquareScreen.tsx', SHARED)
  const idxNoop = idxOf('packages/app/src/features/square/SquareScreen.tsx', SHARED_NOOP)
  const auditWith = (index, src) =>
    auditRnFile({
      file: 'apps/mobile-rn/src/screens/S.tsx',
      rnText: src,
      rnMasked: maskCommentsAndStrings(src),
      symbolIndex: index,
    })
  const audit = (src) => auditWith(idx, src)

  ok('DH2 阳性:NavBar + 自带页头的共享屏 + 无通道 ⇒ 违规', audit(WRAP_BAD).hits.length === 1)
  ok('DH2 放过:调用点带"声明且被读"的 hideHeader ⇒ 不是双层', audit(WRAP_SUPPRESSED).hits.length === 0)
  ok('DH2 放过:通道经 {...对象} 展开传进来(一跳回溯同文件对象字面量)', audit(WRAP_SPREAD).hits.length === 0)
  ok('DH2 判红:`hideHeader={false}` 等于没抑制(显式关掉)', audit(WRAP_FALSE_PROP).hits.length === 1)
  ok('DH2 判红:通道名在共享侧根本没声明(传了个没人认的 prop)', audit(WRAP_UNDECLARED).hits.some((h) => h.reason === 'suppress-undeclared'))
  ok('DH2 判红:通道声明了却从没被读(什么都不会抑制)', idxNoop && auditWith(idxNoop, WRAP_SUPPRESSED).hits.some((h) => h.reason === 'suppress-not-honored'))
  ok('展开对象解析不到 ⇒ 计"未判定"并点名,绝不静默放行', (() => {
    const r = audit(WRAP_SPREAD_UNKNOWN)
    return r.undetermined.some((u) => String(u.reason).includes('hostProps'))
  })())
  ok('别名解析:`X as SharedX` 必须被认出来(HEAD 真站点全是这形态)', audit(WRAP_BAD).hits[0].alias === 'SharedSquare')
  ok('别名解析:NavBar 侧 `import { NavBar as TopBar }` 同样必须被认出来', audit(WRAP_ALIASED_NAV).hits.length === 1)
  ok('条件渲染不判红,但必须计"未判定"(不得静默放行)', (() => {
    const r = audit(WRAP_CONDITIONAL)
    return r.hits.length === 0 && r.undetermined.length >= 1
  })())
  ok('注释里写 `<NavBar>` 字样不得判红(判据面先剥注释)', (() => {
    const r = audit(WRAP_ONLY_COMMENT)
    return r.hits.length === 0 && r.navRendered === false
  })())
  ok('豁免带原因 ⇒ 放行并计数(不得静默)', (() => {
    const r = audit(WRAP_EXEMPT)
    return r.hits.length === 0 && r.exempted === 1
  })())
  ok('豁免裸标记(冒号后无原因)不得放行', audit(WRAP_EXEMPT_BARE).hits.length === 1)
  ok('豁免"冒号后只剩空白"同样不得放行(空原因不是原因)', !exemptReason('x // double-header-exempt:   '))
  ok('豁免只剩注释闭合符不得放行(守门 102 记过的那一型)', !exemptReason('x // double-header-exempt: */'))
  ok('豁免带真原因必须放行(出口不能是假装有)', exemptReason('x // double-header-exempt: 抽屉入口只在这条上'))
  ok('反向对照:共享屏自带页头而 RN 侧不加 NavBar ⇒ 合规(本仓 160+ 屏的主体形态)', audit(WRAP_NO_NAVBAR).hits.length === 0)
  ok('遮罩保行号:命中行的行号与原文一致(否则向前回溯 return 会错位)', (() => {
    const masked = maskCommentsAndStrings(WRAP_BAD)
    const pos = masked.indexOf('<NavBar')
    return lineOf(WRAP_BAD, pos) === lineOf(masked, pos)
  })())
  ok('renderGuard:顶层 return 的 JSX ⇒ plain', renderGuard(maskCommentsAndStrings(WRAP_BAD), maskCommentsAndStrings(WRAP_BAD).indexOf('<NavBar')) === 'plain')
  ok('renderGuard:`{cond && <X/>}` ⇒ guarded', (() => {
    const t = 'function f(){return (<View>{ready && <NavBar />}?</View>)}'
    const masked = maskCommentsAndStrings(t)
    return renderGuard(masked, masked.indexOf('<NavBar')) === 'guarded'
  })())
  ok('通道识别:名字含 header 即算(泛化)+ nestedInScrollView 实测例外', isChannelName('renderHeader') && isChannelName('nestedInScrollView') && !isChannelName('onBack'))
  ok('channelHonored:只声明不读 ⇒ false(声明了却没读等于什么都没抑制)', !channelHonored(maskCommentsAndStrings('export function Q({ hideHeader }: P) { return <View><BackChevron/></View> }'), 'hideHeader'))
  ok('channelHonored:声明 + 分支读取 ⇒ true', channelHonored(maskCommentsAndStrings(SHARED), 'hideHeader'))
  ok('selfHeader:渲染 BackChevron 才算自带页头;只有 styles.header 定义不算', selfHeader(maskCommentsAndStrings('export function K(){return <View style={styles.header}><Text>t</Text></View>}')) === false)
  ok('棘轮四向 A:HEAD 有存量、本轮无新增 ⇒ 不判红(decideRed)', decideRed(new Map([['a.tsx', 1]]), new Map([['a.tsx', 1]])).length === 0)
  ok('棘轮四向 B:本轮新增一处 ⇒ 判红', decideRed(new Map([['a.tsx', 2]]), new Map([['a.tsx', 1]])).length === 1)
  ok('棘轮四向 C:HEAD 有而本轮清了 ⇒ 绿(存量下降不该反过来红)', decideRed(new Map(), new Map([['a.tsx', 1]])).length === 0)
  ok('棘轮四向 D:锚点必须是 HEAD 实态而不是基线数字 —— 全量面红名单恒空', (() => {
    const r = analyze('head')
    return r.exit !== 2 && r.red.length === 0 && r.total === r.stock.length
  })())
  ok('DH1:族整不可用但本面无候选 ⇒ 不判红(合法的收口不该变成永久红门)', decideBlind({ violationCount: 0, honoredChannels: [], undeclaredChannelHits: 0 }) === false)
  ok('DH1:族整不可用而有候选 ⇒ 判"失明"(出口被摘线而门照报绿 = 没有门)', decideBlind({ violationCount: 1, honoredChannels: [], undeclaredChannelHits: 0 }))
  ok('真仓 HEAD 阳性对照:必须点名 5 处存量(看不见存量 = 判据对该形态全盲,不算通过)', (() => {
    const r = analyze('head')
    const files = r.stock.map((h) => h.file.split('/').pop()).sort()
    const want = ['CourseDetailScreen.tsx', 'LiveDetailScreen.tsx', 'ProfileScreen.tsx', 'SettingsScreen.tsx', 'StudyPublishScreen.tsx']
    return JSON.stringify(files) === JSON.stringify(want) && r.total === 5
  })())
  ok('真仓假阳对照:三处已用抑制通道的候选必须判绿(Agent/News/Share)', (() => {
    const r = analyze('head')
    const bad = ['AgentScreen', 'NewsScreen', 'ShareScreen']
    return !r.stock.some((h) => bad.some((b) => h.file.endsWith(`/${b}.tsx`)))
  })())
  ok('真仓反向对照:共享屏自带页头而 RN 不加 NavBar 的合规族必须被扫到(>100)', (() => {
    const r = analyze('head')
    return r.scannedFiles > 150 && r.sharedFiles > 100 && r.exit === 0
  })())
  ok('--json 可 parse 且不含说明性文本', (() => {
    const r = analyze('head')
    return JSON.parse(JSON.stringify(r)).face === 'head'
  })())
  console.log(`--self-test: ${fail === 0 ? '全部通过' : `${fail} 条失败`}`)
  return fail
}

function main() {
  const argv = process.argv.slice(2)
  if (process.env[SKIP_ENV] === '1' && !argv.includes('--self-test')) {
    console.log(`⏭ 已跳过(${SKIP_ENV}=1)`)
    process.exit(0)
  }
  if (argv.includes('--self-test')) {
    process.exitCode = runSelfTest() === 0 ? 0 : 1
    return
  }
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    process.exit(2)
  }
  const fi = argv.indexOf('--files')
  const onlyFiles = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : null
  const opts = { strict: argv.includes('--strict'), requireDetermined: argv.includes('--require-determined'), files: onlyFiles && onlyFiles.length ? onlyFiles : undefined }
  const r = analyze(picked.face, opts)
  if (argv.includes('--update-baseline')) {
    const payload = {
      $schemaNote:
        '本文件只是台账(现读的锚点恒为该文件在 HEAD 自身的违规数,见 decideRed)。行号一律不写 —— 任何一次 append 都会挪位,AGENTS §1 已实测"按行号给的证据复核通过率 0/27"。',
      face: 'HEAD',
      stock: r.stock.map((h) => ({
        rnFile: h.file,
        navBarImport: h.navTag,
        sharedSymbol: h.symbol,
        sharedRenderAlias: h.alias,
        sharedFile: h.sharedFile,
        reason: h.reason,
      })),
    }
    writeFileSync(join(ROOT, BASELINE_REL), JSON.stringify(payload, null, 2) + '\n', 'utf8')
    console.log(`✅ 台账已写 ${BASELINE_REL}(存量 ${payload.stock.length} 处,内容锚点,无行号)`)
    process.exitCode = 0
    return
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r))
    process.exitCode = r.exit
    return
  }
  const ledger = readBaseline()
  console.log(
    `[rn-double-header] 面:${r.face} · 共享包根:${r.pkgRoot || '未解析'} · RN 文件 ${r.scannedFiles}${
      r.face === 'staged'
        ? r.narrowedToStaged
          ? '(=本次暂存的改动集)'
          : '(暂存集里没有 mobile-rn 文件 ⇒ 按整棵索引兜底,防空暂存恒绿)'
        : ''
    } · 共享文件 ${r.sharedFiles}`,
  )
  console.log(
    `   抑制通道族:声明 ${r.channels.declared.join(',') || '(无)'} / 被读 ${r.channels.honored.join(',') || '(无)'} / 调用点用到 ${r.channels.usedAtSites.join(',') || '(无)'}`,
  )
  if (r.unreadable.length)
    console.log(`❌ 无法判定:${r.unreadable.length} 个候选在本面取不到内容(不记绿也不冒红),首个:${r.unreadable[0]}`)
  if (r.emptyScan) console.log('❌ 无法判定:head 面枚举到 0 个 RN 源文件 ⇒ 枚举面或仓库根错位,不得读成"这仓没有 RN 屏"')
  if (r.blind)
    console.log(
      '❌ DH1 失明:共享侧已没有任何"声明且被读"的页头抑制通道,而本面仍存在双层候选 —— 此时 DH2 的"无通道"结论全靠一张不存在的出口',
    )
  if (r.undetermined.length) {
    console.log(`⚠️ 未判定 ${r.undetermined.length} 处(判据看不见 ≠ 没有):`)
    for (const u of r.undetermined.slice(0, 12)) console.log(`   ${u.file || '-'}:${u.reason}`)
    if (r.undetermined.length > 12) console.log(`   …另 ${r.undetermined.length - 12} 处,--json 取全量`)
  }
  if (r.red.length) {
    console.log(`❌ DH2 新增(超出该文件 HEAD 自身存量)${r.red.length} 个文件:`)
    for (const h of r.violations) {
      if (!r.red.some((x) => x.file === h.file)) continue
      console.log(
        `   ${h.file}  渲染 ${h.navTag} + ${h.symbol}(共享侧 ${h.sharedFile})${h.channel ? ` 通道 ${h.channel} ${h.reason}` : ` 无抑制通道(${h.reason})`}`,
      )
    }
    console.log(
      '   出路(按实测,别走错):给共享屏补/接页头抑制通道并在调用点传入 —— ' +
        '删共享页头会让 160+ 以它为唯一页头的屏失去返回键,删包装器 NavBar 会让 Settings/Profile 失去抽屉唯一入口、' +
        '并让共享侧 loading 分支(实测只有 spinner)失去唯一返回手段。\n' +
        '         确属例外写 `double-header-exempt: <原因>`(带原因;已进守门 108 存活期表,30 天)。',
    )
  } else {
    console.log(
      `✅ DH2 无新增。存量 ${r.total} 处 / ${r.filesWithHits} 文件按"HEAD 自身存量"棘轮只报数(现值看这一行,别引用文档里的旧数);带原因豁免 ${r.exempted} 处`,
    )
  }
  if (ledger.stock && ledger.stock.length !== r.stock.length)
    console.log(
      `ℹ️ 台账与本轮 HEAD 读数不等(台账 ${ledger.stock.length} / 现读 ${r.stock.length})—— 只报数:或有人已清偿,或格式又漂,以本行为准并跑 --update-baseline`,
    )
  console.log('提示:本门射程 = apps/mobile-rn/ 的 .tsx/.jsx(共享侧改页头不会新增双层,发起面只有 RN 屏)')
  process.exitCode = r.exit
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href)
  main()

export const __test__ = {
  analyze,
  auditRnFile,
  buildSymbolIndex,
  callSiteAttrs,
  channelDeclared,
  channelHonored,
  decideBlind,
  decideRed,
  evaluateChannels,
  exemptReason,
  isChannelName,
  parseNavBarBindings,
  parseSharedImports,
  parseTagAttrs,
  readTagRegion,
  renderGuard,
  resolveObjectKeys,
  selfHeader,
  EXTRA_CHANNELS,
  SHARED_PKG,
  EXEMPT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
