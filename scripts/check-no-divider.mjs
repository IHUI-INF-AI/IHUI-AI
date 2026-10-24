#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 分割线守门 — 拦住"用描边画一条分隔线"这一型视觉元素。
 *
 * 依据 AGENTS.md 第 4 节"前端 UI 约束"(强制)与"禁止分割线(强制)":
 *   禁止 `<hr>` / divide-y / divide-x / 单边 border-t/b/l/r 当纯分隔线。
 *   允许:容器完整描边(border border-border)、背景色对比、间距分隔(gap-* / space-y-*)。
 *
 * 判定六族(同一把"分隔线"尺子,按**书写语言**分面 —— 2026-10-23 补 5/6):
 *   1) divide-y / divide-x        → BLOCKING(出现即违规,无合法 UI 用途)
 *   2) 字面量 `<hr>`              → BLOCKING(仅 .tsx 的真实 JSX;字符串/注释内豁免)
 *   3) 单边低透明度描边(如 border-t border-border/50)→ WARN(不阻塞)
 *   4) **单边不透明描边**(如 `border-b border-border`、`<tr className="border-t">`)
 *      → 差值棘轮 BLOCKING(2026-10-23 立)
 *   5) **.css 里的单边声明**(`border-top: 1px solid var(--color-border)`)
 *      → 差值棘轮 BLOCKING(2026-10-23 立 G-879)。本文件旧头注写着"CSS 侧由跨端 token 门管",
 *      实测是**假的**:`check-cross-end-tokens.mjs` 只判 token 副本同步,全仓没有任何一道门判
 *      CSS 单边描边 ⇒ 门自己写了条不存在的出路,把小程序 26 条页面级分割线整个放在射程外。
 *      排除条款必须是量出来的事实,不能是一句注释(见 [[feedback-gate-exclusion-clause-is-a-defect]] 同型)。
 *   6) **RN / Taro 样式对象单边宽**(`{ borderTopWidth: 1, borderTopColor: tk.border.light }`)
 *      → 差值棘轮 BLOCKING(同批立)。原生端根本不用 Tailwind 类名,族 1–4 对它结构上打不到。
 *
 * 族 4/6 的形状重载补档(2026-10-23 L29015;**2026-10-24 合一**):**背景色发丝线** —— `h-px bg-border` /
 * RN `{ height: 1, backgroundColor: tk.border.light }` 与单边描边是同一个视觉动作(线由背景色画),
 * 并入同一把差值棘轮。**合一后族 7 不再自带一把宽松近似**:判据本体 = 发丝尺
 * (`check-hairline-separator.mjs`) 的严格指纹,实现只有一份,住在下方族 7 段的
 * `scanHairlineFaces`(§0.6)—— 底色档表、任意值发丝档(1–2px / ≤4rpx)、RN `hairlineWidth×1|×2`、
 * 三型结构件指纹、shadowOffset 例外、未判定档,族 7 与发丝尺对同一枚文件读出**同一个枚数**。
 * 立因(互顶实证,票 L29015 尾格):旧族 7 按整名精确匹配 + 只认 `h-px|w-px|h-[1px]`,比发丝尺窄 ——
 * 把 `h-px bg-popover` 这类尺子计为存量的形状改成等积单边描边时,发丝尺存量 1→0(变好),族 6/4 棘轮
 * 却按 HEAD 基线 0 把清偿本身判成"新增 1 超棘轮"⇒ 两把尺互相顶着,清偿被回退。**合一 = 清偿形状
 * 换写法不再触红**:HEAD 基线已含这枚线,改成等积单边描边后计数不升,棘轮天然放行;这**不是**豁免
 * 清单,也不是削任何一把尺(判据反而在族 7 侧收紧:低透明度发丝 `bg-border/50` 与复合名中性词根
 * `bg-muted-foreground`、`height: 2`、`hairlineWidth * 2` 从"不判/WARN/未判定"升为与其它中性发丝线
 * 同档的 blocking 计数 —— 与发丝尺同判;带透明度的**单边描边**(族 3)仍是 WARN,两族分档不变)。
 * 形状被三型结构件重载,全部在命中**之前**按可机械判定指纹排除(§12e:
 * 把这三型判红就是恒红门):菜单/下拉 `role="separator"`(含 Separator 组件定义行)、
 * 时间线/树 `absolute`+上界成对 + `w-px` 竖向导引轨、`pane-split` 分割器的 `w-full h-px`;
 * 三型指纹与 `check-hairline-separator.mjs` 共用 `structuralTypeOf`(§0.6,同一把尺子)。
 * 反向锁:裸 `h-px bg-border` 照判;`absolute` + `h-px` 横轴**不**享轨出口;
 * 裸 `h-full|flex-1` + `w-px` 不享轨出口(尺子按 divider+railSuspect 计数,族 7 同判);
 * 彩色 bg(bg-primary)与整段非中性的底色档不判。RN 面 `height: StyleSheet.hairlineWidth * <变量>`
 * 这类表达式量不出宽度 ⇒ 未判定报数(SearchOverlay:481 实测那一型),不判也不冒充没命中(§0.3)。
 *
 * 为什么第 4 族走差值棘轮而不是"出现即拦":机主 2026-10-22 定档"界面里不该有分割线",
 * 而存量按当次 HEAD 现读(散在几十页)。把存量挂成绝对红就是 §12e 的恒红门 —— 唯一结局
 * 是人人 --no-verify 连带废掉全部门。锚点 = **该文件 HEAD 面自身的命中数**:只拦"本次提交
 * 把它加回来 / 加得比 HEAD 更多",逐页清存量时只报数。
 *
 * 第 4 族怎么和 AGENTS.md 允许的"结构性边框"区分(容器完整边框系统 / 引用块左边框 /
 * IDE diff 面板都不是分隔线)—— 全部按**可机械判定的形状**收窄,不做语义猜测:
 *   · 同一行还写了整圈宽度(`border` / `border-2`)或双轴(`border-x` / `border-y`)
 *     ⇒ 这一边只是"整圈边框系统里的一格 override",放过;
 *   · 单边宽度 ≥2(`border-l-4`、`border-b-2`)⇒ 强调条 / 下划线式选中态,放过;
 *   · 描边颜色不是中性档(非 border|input|muted|card|background,且非 gray|neutral|slate|zinc|stone-N)
 *     ⇒ 彩色强调,放过;`transparent` 同理(根本没画线);
 *   · 同一格同时收一条横边 + 一条竖边(`border-b border-r`)⇒ 网格 / 箱体收口(课程表、考勤矩阵
 *     每格自画 bottom+right 的那种格线),放过;只把同向两条(`border-t border-b`)照样判 —— 那是两条线;
 *   · 竖边 + 同轴缩进对(`ml-4 border-l pl-2`)⇒ 引用块左条 / 树形缩进导引线(§4 明文允许
 *     "引用块左边框"),放过;横边不享受这一条;
 *   · 宽度为 0(`last:border-b-0`)⇒ 擦除动作,放过。
 * 同一套形状收窄(整圈 / 双轴 / ≥2px 粗边 / 彩色 / 横竖同格 / 缩进轨 / 宽度 0 擦除)对六族共用,
 * 差别只在"从哪里取形状":族 4 读一行 class,族 5 读一条 CSS 规则块,族 6 读一个对象字面量。
 * 已知不在射程而**必须点名**的形状:写在 TS 字符串里的生成式 CSS(`border-bottom:1px solid ${t.hairline}`)
 * —— HTML 邮件、落地页、swagger 主题这类面用不了 flex 间距(邮件客户端按 table 排版),照族 5 拦
 * 就是 §12e 恒红门 ⇒ 族 5 在代码文件里降为 WARN 并逐条报数,升档的前置 = 存量归零 + 逐面给出替代版式。
 * 判据宁窄勿宽 —— 漏的那部分由全量档报数暴露,不许为凑数反手放宽。
 *
 * 取材面纪律(§0.4):全量档判 **HEAD blob**、`--staged` 判**索引 blob**、棘轮锚点判 HEAD blob;
 * 清单与内容同面同轮,都出自 ./lib/face-reader.mjs。此前本门"清单取索引、内容读磁盘"正是
 * §5c 2026-10-15 记过的那一型(盘上改好但没提交 ⇒ 门报绿而 CI 必红)。
 *
 * 用法:
 *   node scripts/check-no-divider.mjs --staged     pre-commit(新增违规则 exit 1)
 *   node scripts/check-no-divider.mjs              全量扫描报告(存量只报数, exit 0)
 *   node scripts/check-no-divider.mjs --worktree   人工逃生舱:量盘上清偿进度(读磁盘,可能撞并发席的半编辑态,
 *                                                  不作提交门禁;§0.4 规定的第三面)
 *   node scripts/check-no-divider.mjs --self-test  判据自检(含主判定路径)
 *   node scripts/check-no-divider.mjs --help
 *
 * 跳过方法(紧急):HUSKY_SKIP_NO_DIVIDER=1 git commit ...
 */
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { COLORS as C } from './lib/logger.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { Undetermined, assertRepoRoot, selectFace } from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'
import { addedLineNumbers, headAnchors, readSources, sourceCandidates } from './lib/face-scan.mjs'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const isWorktree = process.argv.includes('--worktree')
const isSelfTest = process.argv.includes('--self-test')
const isHelp = process.argv.includes('--help')

/** §22d 双形态入口:被镜像测试 import 时不得执行 skip/--help/主流程,也不得 process.exit */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

// 跳过方法(紧急):HUSKY_SKIP_NO_DIVIDER=1 git commit ...
// 守卫排在 isDirectRun 里:本文件同时被镜像测试 import,顶层 process.exit 会把测试进程带走。
if (isDirectRun && process.env.HUSKY_SKIP_NO_DIVIDER === '1') {
  console.log('⏭  分割线守门(HUSKY_SKIP_NO_DIVIDER=1, 跳过)')
  process.exit(0)
}

if (isDirectRun && isHelp) {
  console.log(`
check-no-divider.mjs — 分割线守门

用法:
  node scripts/check-no-divider.mjs --staged     pre-commit 模式(新增违规则 exit 1)
  node scripts/check-no-divider.mjs              全量扫描报告(存量只报数, exit 0)
  node scripts/check-no-divider.mjs --worktree    人工逃生舱:量盘上进度(不作提交门禁, exit 0)
  node scripts/check-no-divider.mjs --self-test  判据自检
  node scripts/check-no-divider.mjs --help       本帮助

判定:
  - divide-y / divide-x:出现即违规(BLOCKING,注释行豁免)
  - <hr 标签:.tsx 真实 JSX 出现即违规(BLOCKING,字符串/注释内豁免)
  - 单边低透明度描边(border-t border-border/50):WARN(非阻塞)
  - 单边不透明描边(border-b border-border、<tr className="border-t">):差值棘轮 BLOCKING
    锚点 = 该文件 HEAD 面自身命中数;存量只报数,超出基线才拦提交
  - .css 里的单边声明(border-top: 1px solid var(--color-border)):同一把差值棘轮 BLOCKING
  - RN/Taro 样式对象单边宽({ borderTopWidth: 1, ... }):同一把差值棘轮 BLOCKING
  - 背景色发丝线(h-px bg-border / RN { height: 1, backgroundColor: 中性 }):同一把差值棘轮 BLOCKING
    判据 = 发丝尺严格指纹单源(scanHairlineFaces,2026-10-24 合一;含 bg-popover/bg-white 等复合中性档、
    1–2px 与 ≤4rpx 任意值、hairlineWidth×1|×2、bg-border/50 同档照判)
    排除:role="separator" 菜单线 / absolute+上界成对 + w-px 竖导引轨 / w-full h-px 分割器 / 彩色底
  - 代码文件字符串里的生成式 CSS(邮件/落地页/第三方主题):WARN 逐条报数,不拦提交
  放过:整圈边框 / 双轴 / ≥2px 粗边 / 彩色或 transparent / 横竖同格(网格收口) /
        竖边+同轴 m?p? 缩进轨(引用块左条)/ 宽度 0 擦除(last:border-0、border-bottom:none) /
        发丝线三型结构件(separator/导引轨/分割器)/ 发丝线彩色底(bg-primary 等非中性档)
`)
  process.exit(0)
}

/** 源码(class 工具类 + RN 样式对象)与 .css(声明块)两面都要扫 —— 2026-10-23 补 CSS 面 */
const SCAN_GLOBS = ['*.ts', '*.tsx', '*.js', '*.jsx', '*.css']

/** git grep 预筛:必须是各族判据的**超集**,否则清单面比内容面窄 = 静默少扫
 *  (2026-10-24 合一:`[hw]-\\[(length:)?[0-9.]` 取代旧 `[hw]-\\[1px\\]`、并补 RN 数值档
 *   `(height|width): *[0-2]` —— 严格尺还认 `h-[2px]`/`h-[2rpx]`/`h-[length:1px]` 与
 *   `height: 1`(展开运算符无 backgroundColor 的未判定档连 backgroundColor 都不含),
 *   旧支比内容面窄 ⇒ 清偿这些形状时清单面失明) */
const PREFILTER_RE =
  'divide-[yx]|<hr|border-[tblr]|border-\\[|border-(top|bottom|left|right)|border(Top|Bottom|Left|Right)(Width|Color)|[hw]-px|[hw]-\\[(length:)?[0-9.]|hairlineWidth|backgroundColor|(height|width): *[0-2][[:space:],}]'

/** 违规模式:divide-y / divide-x(独立 class token;用 \b 词边界,兼容引号包裹的 className) */
const VIOLATION_RE = /\bdivide-[yx]\b/

/** 违规模式:字面量 <hr 标签(无歧义分割线,大小写敏感匹配小写 hr 元素) */
const HR_RE = /<hr\b/

/** 单边方向档(AGENTS.md §4 点名的正是这四条边) */
const SIDE_TOKENS = new Set(['t', 'b', 'l', 'r'])
/** 双轴档 = 一次画两条对边,属"整圈边框系统"的一种,不按纯分隔线判 */
const AXIS_TOKENS = new Set(['x', 'y'])
/** 中性描边色档(这些档就是"线"本身;其余色名一律当强调) */
const NEUTRAL_COLOR_ROOTS = new Set(['border', 'input', 'muted', 'card', 'background'])
const NEUTRAL_SHADE_RE = /^(?:gray|neutral|slate|zinc|stone)-\d+$/

/** class 字符集:字母数字 + 连字符/冒号/斜杠/方括号/点/下划线/括号/@% */
const CLASS_TOKEN_RE = /[A-Za-z0-9_[\]./:()@%,-]+/g

/**
 * 剥掉变体前缀(`hover:` / `md:hover:` / `[&>div]:`),只看最后一段真 class。
 * 必须按**括号深度**找冒号:`border-b-[length:2rpx]` 的冒号住在方括号里,是 Tailwind 的
 * 类型标注而不是变体分隔符 —— 旧的"取最后一个冒号"会把 head 切成 `2rpx]`,整枚 token
 * 直接判不成描边(S59 实测那一格)。
 */
export function stripVariantPrefix(cls) {
  let depth = 0
  let lastOutside = -1
  for (let i = 0; i < cls.length; i++) {
    const c = cls[i]
    if (c === '[') depth++
    else if (c === ']') depth = Math.max(0, depth - 1)
    else if (c === ':' && depth === 0) lastOutside = i
  }
  return lastOutside < 0 ? cls : cls.slice(lastOutside + 1)
}

/**
 * 把一个 class token 拆成分割线判据要的形状信息。
 * 变体前缀(hover: / dark: / last: / [&>div]:)一律剥掉,只看最后一段真 class。
 * @returns {{kind:'full'|'axis'|'side'|'color', side?:string, width?:number, color?:string, opacity:number|null}|null}
 */
export function classifyBorderToken(cls) {
  const head = stripVariantPrefix(cls)
  if (!head.startsWith('border')) return null
  const slash = head.indexOf('/')
  const body = slash < 0 ? head : head.slice(0, slash)
  const opacityRaw = slash < 0 ? null : head.slice(slash + 1)
  const opacity = opacityRaw !== null && /^\d+$/.test(opacityRaw) ? Number(opacityRaw) : null
  const segs = body.split('-')
  if (segs[0] !== 'border') return null
  if (segs.length === 1) return { kind: 'full', opacity }
  // 独立任意值必须整段匹配:变量名里的连字符会被 segs 切碎(`[var(--color-border)]` 不是 `[var(--color`)
  const standaloneArb = body.match(/^border-\[([^\]]*)\]$/)
  if (standaloneArb) {
    const raw = standaloneArb[1].trim().replace(/^color:/i, '')
    if (!isArbitraryColor(raw)) {
      const g = cssHairlineGrade(raw.replace(/^length:/i, ''))
      if (g === 'thick') return { kind: 'full', width: 3, opacity }
      if (g === 'erase') return { kind: 'full', width: 0, opacity }
      return { kind: 'full', width: 1, opacity }
    }
    return { kind: 'color', color: raw, opacity }
  }
  const second = segs[1]
  if (/^\d+$/.test(second)) return { kind: 'full', width: Number(second), opacity }
  if (AXIS_TOKENS.has(second)) {
    // border-x / border-y 也吃宽度档:`border-x-0` 是擦除,不能顶掉整行判据
    if (segs.length === 2) return { kind: 'axis', width: 1, opacity }
    if (/^\d+$/.test(segs[2])) return { kind: 'axis', width: Number(segs[2]), opacity }
    return { kind: 'axis', width: 1, opacity }
  }
  if (SIDE_TOKENS.has(second)) {
    if (segs.length === 2) return { kind: 'side', side: second, width: 1, opacity }
    if (/^\d+$/.test(segs[2]))
      return { kind: 'side', side: second, width: Number(segs[2]), opacity }
    const rest = segs.slice(2).join('-')
    // 任意值:方括号里既可能是长度也可能是颜色档,必须按内容分流。
    // 旧判定把方括号一律当长度 ⇒ `border-t-[var(--color-primary)]` 被读成发丝线(假红);
    // 而独立成枚的 `border-[var(--color-border)]` 又被当色名 ⇒ 中性变量名认不出 ⇒ 当彩色放过
    // (settings/bill 14 条 `border-t border-[var(--color-border)]` 漏在这一格,G-879)。
    const arb = rest.match(ARBITRARY_VALUE_RE)
    if (arb) {
      const raw = arb[1].trim().replace(/^color:/i, '')
      if (!isArbitraryColor(raw)) {
        const g = cssHairlineGrade(raw.replace(/^length:/i, ''))
        if (g === 'thick') return { kind: 'side', side: second, width: 3, opacity }
        if (g === 'erase') return { kind: 'side', side: second, width: 0, opacity }
        return { kind: 'side', side: second, width: 1, opacity }
      }
      return { kind: 'side', side: second, width: 1, color: raw, opacity }
    }
    return { kind: 'side', side: second, width: 1, color: rest, opacity }
  }
  if (segs.length === 2) return { kind: 'color', color: second, opacity }
  return { kind: 'color', color: segs.slice(1).join('-'), opacity }
}

/** Tailwind 任意值语法 `[value]`(可能带 `length:` / `color:` 类型标注) */
const ARBITRARY_VALUE_RE = /^\[([^\]]*)\]$/
/** 方括号里是不是颜色档(var()/hex/颜色函数/`color:` 前缀);否则按长度档量 */
export function isArbitraryColor(raw) {
  const v = String(raw ?? '').trim()
  return /^(?:color:|var\(|#|rgba?\(|hsla?\(|oklch\(|color\()/i.test(v)
}

/** 没写颜色 ⇒ 继承全局中性描边档;写了非中性色档 ⇒ 强调,不算分隔线 */
export function isNeutralBorderColor(name) {
  if (name === undefined || name === null) return true
  const raw = String(name)
    .trim()
    .replace(/^color:/i, '')
  if (NEUTRAL_COLOR_ROOTS.has(raw)) return true
  if (NEUTRAL_SHADE_RE.test(raw)) return true
  // CSS 变量名:同一张中性档表,`--color-border` → `border`,`--color-border-medium` → `border` 档
  const cssVar = raw.match(/^var\(\s*--([\w-]+)\s*\)$/)
  if (cssVar) {
    const token = cssVar[1].replace(/^color-/, '')
    if (NEUTRAL_COLOR_ROOTS.has(token)) return true
    if (NEUTRAL_SHADE_RE.test(token)) return true
    return NEUTRAL_COLOR_ROOTS.has(token.split('-')[0])
  }
  return false
}

/**
 * 缩进轨指纹:这一行的 class 里,每条被收的竖边都在**同一轴**上配齐了
 * `m<l|r>-` / `mx-`(把整块推离基准)与 `p<l|r>-` / `px-`(内容与轨之间的导流)。
 * 三条全齐 = 引用块 / 树形导引线(AGENTS.md §4 允许),不是分隔线。
 */
export function hasIndentRailPair(line, sides) {
  const has = (re) => re.test(line)
  return [...sides].every((s) => {
    const margin = new RegExp(`(?:[\\w.-]+:)*m(?:${s}|x)-(?:\\d+|\\[[^\\]]*\\])`)
    const pad = new RegExp(`(?:[\\w.-]+:)*p(?:${s}|x)-(?:\\d+|\\[[^\\]]*\\])`)
    return has(margin) && has(pad)
  })
}

/**
 * 单行判定(纯函数;自检与 CLI 共用同一实现,§0.6 单一真相源)。
 * @returns {{level:'warn'|'blocking', label:string, col:number}|null}
 */
export function classifyDividerLine(line) {
  const tokens = []
  for (const m of line.matchAll(CLASS_TOKEN_RE)) {
    const parsed = classifyBorderToken(m[0])
    if (parsed) tokens.push({ parsed, col: m.index + 1 })
  }
  if (tokens.length === 0) return null
  // 整圈 / 双轴宽度**实际在画**才算"边框系统的一格 override"(AGENTS.md 明示允许)。
  // 2026-10-23 修一个自己写出来的真 bug:`border-b … last:border-0` 这种"表行线 + 末行擦除"
  // 的写法里,`border-0` 是 kind:'full' width:0 的**擦除动作**,旧判定见到任何 full/axis token
  // 就整行放过 ⇒ HEAD 面 24 条 `<tr>` 表行线就这么漏过去(教育条线各页密集)。
  const ring = tokens.filter((t) => t.parsed.kind === 'full' || t.parsed.kind === 'axis')
  if (ring.some((t) => (t.parsed.width ?? 1) > 0)) return null
  const sides = tokens.filter((t) => t.parsed.kind === 'side')
  if (sides.length === 0) return null
  // 宽度 0 = 擦除动作(如 last:border-b-0),不画线
  const drawn = sides.filter((t) => t.parsed.width > 0)
  if (drawn.length === 0) return null
  // 粗边(≥2px)= 强调条 / 选中下划线
  if (drawn.some((t) => t.parsed.width >= 2)) return null
  // 彩色(含 transparent)描边 = 强调,不是中性分隔线
  const colored = tokens.some(
    (t) =>
      (t.parsed.kind === 'side' || t.parsed.kind === 'color') &&
      !isNeutralBorderColor(t.parsed.color),
  )
  if (colored) return null
  // 同一格同时收**一条横边 + 一条竖边** = 网格 / 箱体的角(课程表、考勤表、排班矩阵那种
  // 每格自己画 bottom+right 的格线),不是"两块内容之间的一条线" ⇒ AGENTS.md 的"容器边框收口"。
  // 刻意只认垂直相交的那一组:`border-t border-b`(上下各一条)是**两条**分隔线,照判。
  const drawnSides = new Set(drawn.map((t) => t.parsed.side))
  if (
    (drawnSides.has('t') || drawnSides.has('b')) &&
    (drawnSides.has('l') || drawnSides.has('r'))
  ) {
    return null
  }
  // 引用块左条 / 树形缩进导引线:AGENTS.md §4 明文允许"引用块左边框"。这一族的机械指纹是
  // **竖边 + 同轴的缩进对**(m?- 与 p?- 同时在场)—— 块被推离基准线、内容又与轨留了导流,
  // 那这根边就是"缩进块的轨",不是两块内容之间的线。横边(t/b)一律不享受这一条 ——
  // `mt-3 border-t pt-2` 正是本轮清掉最多的那一型分隔线,横边也走这条出口就等于"加一对 mt/pt 就能遮红"。
  if ([...drawnSides].every((s) => s === 'l' || s === 'r') && hasIndentRailPair(line, drawnSides)) {
    return null
  }
  const first = drawn[0]
  // 带透明度 ⇒ 老那一档"伪分割线",维持 WARN(存量清完再谈升档)
  if (tokens.some((t) => t.parsed.opacity !== null)) {
    return { level: 'warn', label: 'low-opacity single border', col: first.col }
  }
  return { level: 'blocking', label: 'single-side divider', col: first.col }
}

// ─────────────────────── 族 7:背景色发丝线(2026-10-24 合一:严格指纹单源在本段) ───────────────────────
// `h-px bg-border` 与 `border-b border-border` 画的是同一条视觉线 —— 线由背景色画(L29015 票)。
// 旧族 7 自带一把宽松近似(整名精确匹配 + 只认 h-px|w-px|h-[1px]),与发丝尺 `check-hairline-separator.mjs`
// 的严格指纹分叉 ⇒ 等积清偿被族 6/4 棘轮判成"新增超基线"(两尺互顶,票尾实证)。
// 合一 = 判据本体只剩一份:发丝尺的两面扫描(面 A class 表达式 / 面 B RN 样式对象)整体住在下面的
// `scanHairlineFaces`,族 7 与发丝尺对同一枚文件读出同一组命中;发丝尺退化为适配层 + 自己的棘轮面。
// 形状被三型结构件重载:菜单/下拉 role="separator"、时间线/树竖向导引轨、pane-split 分割器。
// 排除指纹全部走在命中**之前**,且只认机械形状不做语义猜测;判据宁窄勿宽,漏的由全量档报数暴露。

// ── 三型结构件的**唯一**指纹实现(§0.6)──────────────────────────────────────
// `check-hairline-separator.mjs` 已 import 本段,两边不再是"两把尺子":
// 同一枚发丝线在族 7 与本门得到同一判定。判据只认机械形状,不做语义猜测:
//   型① role="separator" / 宿主 *Separator / `.Separator` 定义行;
//   型② 竖轴 w-px + (absolute 且上界成对,或 h-full/flex-1 撑满);
//   型③ cursor-col/row-resize / pane-split|resizer|*-handle / 通宽 w-full+h-px。
// 反向锁:横向 absolute+h-px 不享轨出口;裸 h-px 照判(见 11d 自检 S60–S63)。

/** `attr = <值>` 的值区间(引号串 / 按引号跳过的配平花括号)。取不到 ⇒ null */
export function attributeValueSpan(text, afterKey) {
  let i = afterKey
  while (i < text.length && /\s/.test(text[i])) i++
  if (text[i] !== '=') return null
  i++
  while (i < text.length && /\s/.test(text[i])) i++
  const c = text[i]
  if (c === '"' || c === "'") {
    let j = i + 1
    while (j < text.length) {
      if (text[j] === '\\') {
        j += 2
        continue
      }
      if (text[j] === c) return { start: i + 1, end: j }
      j++
    }
    return null
  }
  if (c === '{') {
    let depth = 0
    let quote = null
    for (let j = i; j < text.length; j++) {
      const ch = text[j]
      if (quote) {
        if (ch === '\\') j++
        else if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch
        continue
      }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) return { start: i + 1, end: j }
      }
    }
    return null
  }
  return null
}

/** 命中处所属的 className **值表达式**区间(多行 cn() 的形状要整体读,不能按物理行) */
export function classNameValueSpan(text, idx) {
  const at = text.lastIndexOf('className', idx)
  if (at < 0) return null
  const span = attributeValueSpan(text, at + 'className'.length)
  if (!span) return null
  return idx >= span.start && idx <= span.end ? span : null
}

/** 发丝维度档:`h-px`/`w-px` = hair;任意值只认数字+单位,粗档不进候选 */
export function thinTokensOf(classText) {
  const out = []
  for (const m of classText.matchAll(CLASS_TOKEN_RE)) {
    const head = stripVariantPrefix(m[0])
    const px = /^([hw])-px$/.exec(head)
    if (px) {
      out.push({ axis: px[1], token: head, grade: 'hair' })
      continue
    }
    const arb = /^([hw])-\[(?:length:)?([0-9.]+(?:px|rpx|rem|em|pt))\]$/.exec(head)
    if (!arb) continue
    const grade = cssHairlineGrade(arb[2])
    if (grade === 'hair' || grade === 'unknown') out.push({ axis: arb[1], token: head, grade })
  }
  return out
}

/** 命中处的 JSX 开放标签起点;命中与 `<` 之间出现 `>` ⇒ 判不出(不猜) */
export function jsxTagStart(text, idx) {
  for (let i = idx; i >= 1; i--) {
    if (text[i] !== '<') continue
    if (!/[A-Za-z]/.test(text[i + 1] ?? '')) continue
    if (text.slice(i + 1, idx).includes('>')) return null
    return i
  }
  return null
}

/** 命中处的 JSX 标签名(`DropdownMenuPrimitive.Separator` 原样返回);取不到 ⇒ null */
export function jsxTagNameAt(text, idx) {
  const start = jsxTagStart(text, idx)
  if (start === null) return null
  const m = /^<([A-Za-z][\w.]*)/.exec(text.slice(start, start + 120))
  return m ? m[1] : null
}

/** 宿主元素窗口:开放标签 → 命中所在行尾(`role=` 常写在命中行的上一行) */
function elementWindow(text, idx) {
  const start = jsxTagStart(text, idx)
  const nl = text.indexOf('\n', idx)
  const end = nl < 0 ? text.length : nl
  return text.slice(start === null ? Math.max(0, idx - 300) : start, end)
}

/** 最近的 `const|let|var X =` 或块首 `X: {` —— 型③靠它认 RESIZER_CLASS.x.line */
export function ownerNameOf(text, idx) {
  const before = text.slice(Math.max(0, idx - 4000), idx)
  const decls = [...before.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?:=[^=]|:)/g)]
  if (decls.length > 0) return decls[decls.length - 1][1]
  const keys = [...before.matchAll(/(?:^|\n)\s*([A-Za-z_$][\w$]*)\s*:\s*[{(]/g)]
  if (keys.length > 0) return keys[keys.length - 1][1]
  return null
}

/**
 * 三型结构件判定(族 7 与本门**共用**这一份)。
 * @returns {{type:string, why:string}|null} null = 不属三型(交棘轮)
 */
export function structuralTypeOf({ relPath = '', text = '', idx = 0, surface = '' }) {
  // 型① 语义分隔件(ARIA role / 宿主 *Separator / Separator 定义行)
  if (
    /role\s*=\s*["'{][^}]*\bseparator\b/.test(elementWindow(text, idx)) ||
    EX_SEP_RE.test(surface)
  ) {
    return {
      type: 'semantic-separator',
      why: 'role="separator" / *Separator 原语 / Separator 定义行 ⇒ ARIA 语义分隔件',
    }
  }
  const tag = jsxTagNameAt(text, idx)
  if (tag && /(^|\.)[A-Za-z]*Separator$/.test(tag)) {
    return {
      type: 'semantic-separator',
      why: `宿主组件是 ${tag} ⇒ Radix 分隔件原语(自带 role=separator)`,
    }
  }
  const tokens = []
  for (const m of surface.matchAll(CLASS_TOKEN_RE)) tokens.push(stripVariantPrefix(m[0]))
  const has = (re) => tokens.some((t) => re.test(t))
  const thin = thinTokensOf(surface)
  // 型② 导引轨:发丝维度必须是**宽度**(横截面),长度靠 absolute 上界成对撑满。
  // 只认 absolute:裸 `h-full|flex-1 + w-px` 在尺子里是 divider + railSuspect(照常计数、
  // 单列待判),族 7 若在此放过就是两把尺子。
  if (thin.some((t) => t.axis === 'w')) {
    const verticalInset = has(/^top-/) && has(/^bottom-/)
    const inset = has(/^inset-y-0$/) || has(/^inset-0$/)
    const calcHeight = has(/^h-\[(calc|min|max)\(/)
    const pinned = verticalInset || inset || (calcHeight && (has(/^top-/) || has(/^bottom-/)))
    if (has(/^absolute$/) && pinned) {
      return {
        type: 'guide-rail',
        why: 'absolute+竖轴上界成对 + w-px ⇒ 撑满长度方向的导引轨',
      }
    }
  }
  // 型③ 可拖拽分隔器
  const probe = `${surface}\n${ownerNameOf(text, idx) ?? ''}\n${relPath}`
  if (/cursor-(col|row)-resize/.test(probe)) {
    return { type: 'draggable-splitter', why: '光标 cursor-col/row-resize ⇒ 可拖拽分割器手柄' }
  }
  if (/(pane-?split|resizer|split-?handle|drag-?handle)/i.test(probe)) {
    return {
      type: 'draggable-splitter',
      why: '类名/拥有者声明名/文件路径命中 pane-split|resizer|*-handle ⇒ 可拖拽分割器',
    }
  }
  if (has(/^w-full$/) && thin.some((t) => t.axis === 'h')) {
    return {
      type: 'draggable-splitter',
      why: '通宽 w-full + h-px ⇒ 面板分割条(pane-split 拖拽柄的机械同形)',
    }
  }
  return null
}

/**
 * 单行判定(族 7,**兼容包装**,纯函数;自检与镜像测试的既有入口)。
 * 2026-10-24 合一后本函数不再自带判据:它把整份文本交给 `scanHairlineFaces`(严格指纹单源),
 * 取落在目标行的 divider 命中。级别只有 blocking(发丝尺对 `bg-border/50` 本就计 divider,
 * 族 7 的旧 WARN 档随合一取消 —— 低透明度档只保留给**描边**族 3)。
 * @returns {{level:'blocking', label:string, col:number}|null}
 */
export function classifyHairlineLine(line, ctx = {}) {
  const { relPath = '', text = line, lineStart = 0 } = ctx
  const faces = scanHairlineFaces(relPath, text)
  const targetLine = text.slice(0, lineStart).split('\n').length
  const hit = faces.hits.find((h) => h.line === targetLine && h.kind === 'divider')
  if (!hit) return null
  return {
    level: 'blocking',
    label: hit.family === 'rn' ? 'rn-style bg hairline divider' : 'bg hairline divider',
    col: hit.col ?? 1,
  }
}

// ─────────────── 严格指纹单源:`scanHairlineFaces`(2026-10-24 由发丝尺整体迁入) ───────────────
// 本体原住 `check-hairline-separator.mjs` 的 scanSource(票 L29015 尾格:族 7 宽松档与尺子严格档
// 必须合一)。迁移原因:①§0.6 一把尺子 —— 旧族 7 的整名表/轴档/透明度档是第二份实现,必然漂开;
// ②发丝尺 import 本门的 structuralTypeOf/thinTokensOf,若反向 import 就成循环 ⇒ 判据上收到
// 三型指纹同侧(本段紧跟 structuralTypeOf,依赖全部就地)。发丝尺退化为适配层(命中对象逐字沿用)。

/** 排除指纹①:语义分隔件 —— 组件定义行与调用点都是"菜单里的那条 separator",不是页面分隔线 */
const EX_SEP_RE =
  /role\s*=\s*["']?separator|\.Separator\b|Separator\s+className=|["']-mx-1 my-1 h-px/

/**
 * 中性底色词根(发丝族专表 = 描边中性根表 + {white, black, popover, hairline, divider, separator,
 * surface})。差异只有一处:白/黑在本族算中性。理由是「描边不得取墨档」是 **border 专有**规则,
 * 而"背景色画线"取墨档在白底上根本看不见,不构成同一个问题。
 */
const NEUTRAL_BG_ROOTS = new Set([
  'border',
  'input',
  'muted',
  'card',
  'background',
  'popover',
  'divider',
  'hairline',
  'separator',
  'surface',
  'white',
  'black',
])
const NEUTRAL_BG_SHADE_RE = /^(?:gray|grey|neutral|slate|zinc|stone)-\d+$/
/** `bg-*` 里这些不是颜色(尺寸/定位/渐变/关键字),读到就整枚不算底色 */
const NON_COLOR_BG_RE =
  /^(?:gradient|none|cover|contain|center|left|right|top|bottom|repeat|no-repeat|clip|origin|blend|fixed|local|scroll|auto|transparent|current|inherit|unset|initial|opacity|size|position|image|url)/

/** 索引 → 行号(遮罩后文本与原文逐行等长,行号可直接对回原文件) */
export function lineOfIndex(text, idx) {
  const before = text.slice(0, idx)
  return (before.match(/\n/g) || []).length + 1
}

/**
 * 底色档。返回 true = 中性(就是"线"的颜色)/ false = 彩色(强调)/ null = 不是颜色 token。
 */
export function bgNeutrality(classHead) {
  if (!/^bg-/.test(classHead)) return null
  const body = classHead.slice(3)
  const slash = body.indexOf('/')
  const colorPart = slash < 0 ? body : body.slice(0, slash)
  if (colorPart === '') return null
  if (/^\[/.test(colorPart)) {
    // `bg-[length:…]`/`bg-[size:…]` 是尺寸不是颜色
    if (/^\[(length|size|position|image|url|linear-gradient|radial-gradient):/.test(colorPart))
      return null
    return isNeutralColorRef(colorPart.replace(/^\[/, '').replace(/\]$/, ''))
  }
  if (NON_COLOR_BG_RE.test(colorPart)) return null
  if (NEUTRAL_BG_ROOTS.has(colorPart)) return true
  if (NEUTRAL_BG_SHADE_RE.test(colorPart)) return true
  // 复合名(`bg-surface-muted`):任一段落在中性根表即中性
  return colorPart.includes('-') && colorPart.split('-').some((seg) => NEUTRAL_BG_ROOTS.has(seg))
}

/** @returns {Array<{token:string, neutral:boolean}>} */
export function bgTokensOf(classText) {
  const out = []
  for (const m of classText.matchAll(CLASS_TOKEN_RE)) {
    const head = stripVariantPrefix(m[0])
    const verdict = bgNeutrality(head)
    if (verdict !== null) out.push({ token: head, neutral: verdict })
  }
  return out
}

/** surface 里是否存在匹配 re 的 class token(带变体前缀剥离) */
function tokensSome(surface, re) {
  for (const m of surface.matchAll(CLASS_TOKEN_RE)) {
    if (re.test(stripVariantPrefix(m[0]))) return true
  }
  return false
}

/**
 * RN 横截面档。`StyleSheet.hairlineWidth`(×1|×2)与数值 1–2 都是发丝;
 * `* <非数字>` ⇒ unknown(量不到);变量/百分比/函数调用 ⇒ null(不是发丝候选,不进射程)。
 * @returns {'hair'|'thick'|'erase'|'unknown'|null}
 */
export function rnThinGrade(raw) {
  const v = String(raw ?? '')
    .trim()
    .replace(/,$/, '')
  if (v === '') return null
  const hw = /^StyleSheet\.hairlineWidth(?:\s*\*\s*(\d+(?:\.\d+)?))?$/.exec(v)
  if (hw) {
    const n = hw[1] === undefined ? 1 : Number(hw[1])
    if (n <= 0) return 'erase'
    return n <= 2 ? 'hair' : 'thick'
  }
  if (/^StyleSheet\.hairlineWidth\s*\*/.test(v)) return 'unknown'
  if (/^[A-Za-z_$'"`]/.test(v)) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n <= 0) return 'erase'
  return n <= 2 ? 'hair' : 'thick'
}

/**
 * 整份源码的发丝线严格指纹(发丝尺与族 7 **共用这一把**,§0.6/§22c)。
 * 命中对象逐字沿用迁移前形态,另带 `family`('class'|'rn')与 `col` 供 11d 消费。
 * @returns {{hits:Array<{line:number,col?:number,family:string,kind:'divider'|'exempt'|'undetermined',label:string,snippet:string,type?:string,why?:string,railSuspect?:boolean}>}}
 */
export function scanHairlineFaces(relPath, rawText) {
  const masked = maskComments(rawText)
  const skip = interpolationBraceIndices(masked)
  const rawLines = rawText.split('\n')
  const hits = []
  const seen = new Set()
  const push = (hit) => {
    if (seen.has(hit.line)) return
    seen.add(hit.line)
    hits.push(hit)
  }
  const snippetOf = (line) =>
    String(rawLines[line - 1] ?? '')
      .trim()
      .slice(0, 140)
  const colOf = (idx) => idx - (masked.lastIndexOf('\n', idx) + 1) + 1

  // ── 面 A:Tailwind 类名(h-px / w-px / 任意值发丝 + bg-*)──
  for (const m of masked.matchAll(/[hw]-px\b|[hw]-\[(?:length:)?[0-9.]+(?:px|rpx|rem|em|pt)\]/g)) {
    const line = lineOfIndex(masked, m.index)
    if (seen.has(line)) continue
    const span = classNameValueSpan(masked, m.index)
    const surface = span
      ? masked.slice(span.start, span.end)
      : masked.slice(
          masked.lastIndexOf('\n', m.index) + 1,
          masked.indexOf('\n', m.index) < 0 ? masked.length : masked.indexOf('\n', m.index),
        )
    // 没写底色 ⇒ 这条线不是背景色画的,不归本族
    const bgs = bgTokensOf(surface)
    if (bgs.length === 0) continue
    // ⚠️ 顺序即口径:**粗尺寸过滤必须排在彩色底(accent)判定之前**(「粗于发丝的尺寸根本不进候选」)。
    // thinTokensOf 自己就把 thick 档丢掉 ⇒ `thin.length === 0` ⇔ 这枚在 h/w 两维上都量不出发丝 ⇒
    // 它是尺寸块(徽标/按钮/头像/骨架条),连"放过行"都不该有。反过来先问底色,就会把 `h-[100rpx] bg-cta`
    // 这类 50px 高的按钮记成「彩色底发丝线」—— 标签失真(账面上"彩色底"里躺着的全是粗块),
    // 而且与三型指纹分叉(那边 HAIRLINE 先认出发丝才看底色)。§22c:一把尺子。
    // 排在底色**之后**的那一格(没底色不判)不动:那是"不归本门"的射程边界,与粗细无关(尺子自检 T04/T17)。
    const thin = thinTokensOf(surface)
    if (thin.length === 0) continue
    if (!bgs.some((b) => b.neutral)) {
      push({
        line,
        family: 'class',
        kind: 'exempt',
        type: 'accent-background',
        label: `彩色底 ${bgs.map((b) => b.token).join(',')}`,
        why: '底色非中性档 ⇒ 强调条 / 下划线,不是中性分隔线',
        snippet: snippetOf(line),
      })
      continue
    }
    const hair = thin.filter((t) => t.grade === 'hair')
    if (hair.length === 0) {
      const unknown = thin.filter((t) => t.grade === 'unknown')
      if (unknown.length > 0) {
        push({
          line,
          family: 'class',
          col: colOf(m.index),
          kind: 'undetermined',
          label: `发丝维度量不出物理像素(${unknown.map((t) => t.token).join(',')})`,
          snippet: snippetOf(line),
        })
      }
      continue
    }
    const structural = structuralTypeOf({ relPath, text: masked, idx: m.index, surface })
    if (structural) {
      push({
        line,
        family: 'class',
        kind: 'exempt',
        type: structural.type,
        label: structural.type,
        why: structural.why,
        snippet: snippetOf(line),
      })
      continue
    }
    const suspect =
      thin.some((t) => t.axis === 'w') &&
      tokensSome(surface, /^(?:h-full|flex-1|h-auto|flex-auto|self-stretch)$/)
    push({
      line,
      family: 'class',
      col: colOf(m.index),
      kind: 'divider',
      label: 'bg 发丝分隔线(h-px/w-px + 中性底)',
      snippet: snippetOf(line),
      ...(suspect ? { railSuspect: true } : {}),
    })
  }

  // ── 面 B:RN / 内联样式对象(height|width 发丝 + backgroundColor 中性)──
  // 词界必须是 `(?<![-\w])` 而不是 `\b`(合一后实测):`\b` 认 '-' 后的 'height' ⇒ 模板串里的
  // kebab CSS 属性 `line-height:1.6;`(无单位数值!)被读成 RN 发丝档——email-templates /
  // design-templates / certificate-download 页 8 处假阳即此型(2026-10-24 现读 diff 取证)。
  // kebab CSS 串归族 5(生成式 CSS,代码文件里只 WARN),本面只管 JS 对象键。
  for (const m of masked.matchAll(/(?<![-\w])(height|width)\s*:\s*([^,;{}\n]+)/g)) {
    const line = lineOfIndex(masked, m.index)
    if (seen.has(line)) continue
    const grade = rnThinGrade(m[2])
    if (grade === 'unknown') {
      push({
        line,
        family: 'rn',
        col: colOf(m.index),
        kind: 'undetermined',
        label: `横截面取不出物理像素(${m[2].trim()})`,
        snippet: snippetOf(line),
      })
      continue
    }
    if (grade !== 'hair') continue
    const block = enclosingBraceBlock(masked, m.index, skip)
    if (!block) {
      push({
        line,
        family: 'rn',
        col: colOf(m.index),
        kind: 'undetermined',
        label: '样式对象括号配不平 ⇒ 同块底色读不出',
        snippet: snippetOf(line),
      })
      continue
    }
    // `shadowOffset: { width: 0, height: 1 }` 是阴影偏移,不是线(实测 5 枚,见票面)
    if (
      /shadow(?:Offset|Radius)\s*:\s*$/.test(
        masked.slice(Math.max(0, block.start - 40), block.start),
      )
    ) {
      continue
    }
    const bgVals = [...block.inner.matchAll(/\bbackgroundColor\s*:\s*([^,;{}\n]+)/g)].map(
      (x) => x[1],
    )
    if (bgVals.length === 0) {
      // 有展开运算符却读不到显式底色 ⇒ 形状读不出(不猜成绿)
      if (block.inner.includes('...')) {
        push({
          line,
          family: 'rn',
          col: colOf(m.index),
          kind: 'undetermined',
          label: '样式对象用展开运算符且未写 backgroundColor ⇒ 底色读不出',
          snippet: snippetOf(line),
        })
      }
      continue
    }
    if (!bgVals.every((v) => isNeutralColorRef(v))) {
      push({
        line,
        family: 'rn',
        kind: 'exempt',
        type: 'accent-background',
        label: '彩色底',
        why: 'background 非中性档 ⇒ 强调条,不是中性分隔线',
        snippet: snippetOf(line),
      })
      continue
    }
    const structural = structuralTypeOf({
      relPath,
      text: masked,
      idx: m.index,
      surface: snippetOf(line),
    })
    if (structural) {
      push({
        line,
        family: 'rn',
        kind: 'exempt',
        type: structural.type,
        label: structural.type,
        why: structural.why,
        snippet: snippetOf(line),
      })
      continue
    }
    push({
      line,
      family: 'rn',
      col: colOf(m.index),
      kind: 'divider',
      label: 'RN/内联发丝分隔线(height|width + 中性 backgroundColor)',
      snippet: snippetOf(line),
    })
  }

  hits.sort((a, b) => a.line - b.line)
  return { hits }
}

// ─────────────────────── 族 5/6:CSS 声明块与 RN 样式对象 ───────────────────────
// 族 1–4 读的是 Tailwind class 字符串。原生端(RN/Taro StyleSheet)与非 Tailwind 的 .css 根本不写
// 这种字符串 ⇒ 同一个"用描边画一条线"的动作在两种书写语言里结构上打不到。形状收窄共用一把尺子。

/** 单边方向:CSS kebab 名 / RN camel 名 → 同一个 t|b|l|r 轴 */
const SIDE_FROM_CSS = { top: 't', bottom: 'b', left: 'l', right: 'r' }
const SIDE_FROM_RN = { Top: 't', Bottom: 'b', Left: 'l', Right: 'r' }
const HORIZONTAL_SIDES = new Set(['t', 'b'])
const VERTICAL_SIDES = new Set(['l', 'r'])

/** 中性色档词根(与 class 族同一张表:NEUTRAL_COLOR_ROOTS);强调色词根单独列,命中即放过 */
const ACCENT_COLOR_ROOT_RE =
  /(primary|brand|accent|info|success|warning|danger|error|cta|link|focus|ring|select|active)/i
const NEUTRAL_COLOR_ROOT_RE =
  /(border|input|muted|card|background|divider|hairline|separator|gray|grey|neutral|slate|zinc|stone)/i

/**
 * 一段颜色引用是不是中性描边档。
 * 没写颜色 ⇒ 继承全局描边档 ⇒ 中性(与 class 族 isNeutralBorderColor 同口径);
 * 读不出颜色形态(既不是 var() 也不是 #hex/函数/关键字)⇒ 按未知放过,不猜。
 */
export function isNeutralColorRef(raw) {
  const v = String(raw ?? '').trim()
  if (v === '') return true
  if (/transparent|currentColor|inherit/i.test(v)) return false
  if (ACCENT_COLOR_ROOT_RE.test(v)) return false
  if (NEUTRAL_COLOR_ROOT_RE.test(v)) return true
  const hexes = v.match(/#([0-9a-fA-F]{3,8})\b/g) || []
  if (hexes.length > 0) return hexes.every((h) => isGrayHex(h))
  return false
}

/** 灰阶 hex(r≈g≈b 且不是纯黑墨档)⇒ 中性描边;其余按强调放过 */
function isGrayHex(hex) {
  const body = hex.slice(1)
  const full =
    body.length === 3 || body.length === 4
      ? body
          .slice(0, 3)
          .split('')
          .map((c) => c + c)
          .join('')
      : body.slice(0, 6)
  if (full.length < 6) return false
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16))
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max - min > 12) return false
  return !(max === 0 && min === 0) // 纯黑 = 墨档,§4「描边不得取墨档」另有其门,这里不当分隔线判
}

/**
 * CSS 长度值 → 是否发丝线。返回 'hair' | 'thick' | 'erase' | 'unknown'。
 * px ≤2 与 rpx ≤4(750 设计稿下 2rpx≈1px)算发丝;更粗 = 强调条/选中下划线(§4 允许出口,
 * 与 class 族「宽度 ≥2 放过」同一条);`none`/`0` = 擦除;认不出的单位与变量一律不判。
 */
export function cssHairlineGrade(raw) {
  const v = String(raw ?? '').trim()
  if (v === '') return 'unknown'
  if (/^(none|hidden)\b/i.test(v)) return 'erase'
  const m = v.match(/^(\d+(?:\.\d+)?)(px|rpx|rem|em|pt)?(?![\w.])/)
  if (!m) return 'unknown'
  const n = Number(m[1])
  const unit = m[2] || 'px'
  if (n === 0) return 'erase'
  if (unit === 'rpx') return n <= 4 ? 'hair' : 'thick'
  if (unit === 'px') return n <= 2 ? 'hair' : 'thick'
  if (unit === 'pt') return n <= 1.5 ? 'hair' : 'thick'
  return 'unknown' // rem/em/%:量不出物理像素 ⇒ 不判(§0.3 取不到不冒充)
}

/** RN 样式对象的宽度取值:'hair' | 'thick' | 'erase' | 'unknown' */
export function rnHairlineGrade(raw) {
  const v = String(raw ?? '').trim()
  if (v === 'StyleSheet.hairlineWidth') return 'hair'
  if (/^[0-9a-zA-Z_$.[\]]+$/.test(v) && !/^\d/.test(v)) return 'unknown' // 变量:量不到就不判
  const n = Number(v)
  if (!Number.isFinite(n)) return 'unknown'
  if (n <= 0) return 'erase'
  return n <= 1 ? 'hair' : 'thick'
}

/** 整份文本里 `${…}` 插值的花括号位置(每轮扫描算一次,别按命中重算 ⇒ O(n·命中) 的自造慢) */
export function interpolationBraceIndices(text) {
  const skip = new Set()
  for (const m of text.matchAll(/\$\{[^{}]*\}/g)) {
    skip.add(m.index + 1)
    skip.add(m.index + m[0].length - 1)
  }
  return skip
}

/**
 * 命中处所在的最内层 `{ … }`(CSS 规则块 / JS 对象字面量)。
 * 只按括号配平走,不做语法解析 —— 判据要的只是"同一个盒子里还画了什么"。
 * `${…}`(模板字符串插值)不算块:生成式 CSS 就住在模板字面量里,把 `${VAR}` 当盒子会让
 * 规则块在插值处断裂 ⇒ 颜色与邻边全部读丢(S50 实测那一型)。
 */
export function enclosingBraceBlock(text, idx, skip = new Set()) {
  // 模板字符串插值 `${…}` 的两枚花括号整对摘掉:它们既不开块也不闭块
  let depth = 0
  let start = -1
  for (let i = idx; i >= 0; i--) {
    if (skip.has(i)) continue
    const c = text[i]
    if (c === '}') depth++
    else if (c === '{') {
      if (depth === 0) {
        start = i
        break
      }
      depth--
    }
  }
  if (start < 0) return null
  depth = 0
  for (let i = start + 1; i < text.length; i++) {
    if (skip.has(i)) continue
    const c = text[i]
    if (c === '{') depth++
    else if (c === '}') {
      if (depth === 0) return { start, end: i, inner: text.slice(start + 1, i) }
      depth--
    }
  }
  return null
}

/** 索引 → 行/列(遮罩后的文本与原文件逐行等长,所以行号可直接对回原文件) */
function lineColAt(text, idx) {
  const before = text.slice(0, idx)
  const nl = before.lastIndexOf('\n')
  return { line: (before.match(/\n/g) || []).length + 1, col: idx - nl }
}

/**
 * 族 5/6 共用的形状判定:给出「本块里画着的边」与形状事实,决定这一条算不算分隔线。
 * @returns {null|'divider'} 放过 ⇒ null
 */
function judgeBoxSides({ drawn, grade, neutral, inner, side, railChecks }) {
  if (grade !== 'hair') return null // 擦除 / 粗边 / 量不出 ⇒ 放过
  if (!neutral) return null // 彩色 ⇒ 强调
  // 三角、箭头这类 CSS 图形:同块里出现 transparent 的边 ⇒ 这是在画形状,不是在画线
  if (/transparent/i.test(inner)) return null
  const horiz = [...drawn].some((s) => HORIZONTAL_SIDES.has(s))
  const vert = [...drawn].some((s) => VERTICAL_SIDES.has(s))
  if (horiz && vert) return null // 横竖各一边 = 网格 / 箱体收口(同 class 族那条)
  if (VERTICAL_SIDES.has(side) && railChecks()) return null // 引用块左条 / 树形导引线
  return 'divider'
}

/** CSS 声明值的形状:`;`/行尾/`}` 断开,但 `${插值}` 整段算值的一部分(生成式 CSS 的颜色就住在这儿)
 *  插值分支必须排在前面 —— `[^;{}…]` 会先吃掉那个 `$`,留下 `{` 时无路可走,值就在插值处断掉(S50) */
const CSS_VAL_SRC = '(?:\\$\\{[^}]*\\}|[^;{}\\n])*'

/** 族 5:.css(与代码文件里的 CSS 串)单边声明。返回 {hits, undetermined} */
export function scanCssDeclarations(
  text,
  { asWarnOnly = false, skip = interpolationBraceIndices(text) } = {},
) {
  const hits = []
  const undeterminedRows = []
  let undetermined = 0
  const re = new RegExp(`\\bborder-(top|bottom|left|right)\\s*:\\s*(${CSS_VAL_SRC})`, 'g')
  for (const m of text.matchAll(re)) {
    const side = SIDE_FROM_CSS[m[1]]
    const value = m[2]
    const block = enclosingBraceBlock(text, m.index, skip)
    if (!block) {
      undetermined++
      undeterminedRows.push({
        line: lineColAt(text, m.index).line,
        col: lineColAt(text, m.index).col,
        label: asWarnOnly ? 'generated-css undetermined' : 'css undetermined',
        why: '声明不在任何规则块内(内联 style 属性 / 模板串)⇒ 同块邻边与整圈形状读不出',
      })
      continue
    }
    const inner = block.inner
    // 整圈 / 双轴宽度在画 ⇒ 这一边只是盒框里的一格 override(与 class 族同一条出口)
    let hasRing = false
    for (const r of inner.matchAll(
      new RegExp(`(?:^|[;{\\s])border(?:-width)?\\s*:\\s*(${CSS_VAL_SRC})`, 'g'),
    )) {
      const g = cssHairlineGrade(r[1])
      if (g === 'hair' || g === 'thick') hasRing = true
    }
    if (hasRing) continue
    const grade = cssHairlineGrade(value)
    if (grade === 'unknown') {
      undetermined++
      const at = lineColAt(text, m.index)
      undeterminedRows.push({
        line: at.line,
        col: at.col,
        label: asWarnOnly ? 'generated-css undetermined' : 'css undetermined',
        why: `宽度取不出物理长度(${value.trim().slice(0, 24)})⇒ 不判`,
      })
      continue
    }
    const drawn = new Set()
    for (const d of inner.matchAll(
      new RegExp(`\\bborder-(top|bottom|left|right)\\s*:\\s*(${CSS_VAL_SRC})`, 'g'),
    )) {
      if (cssHairlineGrade(d[2]) === 'hair') drawn.add(SIDE_FROM_CSS[d[1]])
    }
    const colorPart = value.replace(/^(?:\d+(?:\.\d+)?(?:px|rpx|rem|em|pt)?|none|hidden)\s*/, '')
    const verdict = judgeBoxSides({
      drawn,
      grade,
      neutral: isNeutralColorRef(colorPart || value),
      inner,
      side,
      railChecks: () => cssIndentRail(inner, side),
    })
    if (verdict !== 'divider') continue
    const { line, col } = lineColAt(text, m.index)
    hits.push({
      line,
      col,
      level: asWarnOnly ? 'warn' : 'blocking',
      label: asWarnOnly ? 'generated-css single-side divider' : 'css single-side divider',
      snippet: text.split('\n')[line - 1].trim().slice(0, 140),
    })
  }
  return { hits, undetermined, undeterminedRows }
}

/** 引用块左条 / 树形导引线的 CSS 形态:竖边 + 同轴 padding 与 margin 都在同一条规则里 */
function cssIndentRail(inner, side) {
  if (!VERTICAL_SIDES.has(side)) return false
  const other = side === 'l' ? 'left' : 'right'
  const pad = new RegExp(`padding(-${other}|-inline)?\\s*:`, 'i')
  const mar = new RegExp(`margin(-${other}|-inline)?\\s*:`, 'i')
  return pad.test(inner) && mar.test(inner)
}

/** 族 6:RN / Taro 样式对象单边宽度。返回 {hits, undetermined, undeterminedRows} */
export function scanRnStyleObjects(text, skip = interpolationBraceIndices(text)) {
  const hits = []
  const undeterminedRows = []
  let undetermined = 0
  const re = /\bborder(Top|Bottom|Left|Right)Width\s*:\s*([^,;{}\n]*)/g
  for (const m of text.matchAll(re)) {
    const side = SIDE_FROM_RN[m[1]]
    const value = m[2]
    const block = enclosingBraceBlock(text, m.index, skip)
    if (!block) {
      undetermined++
      const at = lineColAt(text, m.index)
      undeterminedRows.push({
        line: at.line,
        col: at.col,
        label: 'rn-style undetermined',
        why: '样式对象括号配不平 ⇒ 同盒整圈/邻边形状读不出',
      })
      continue
    }
    const inner = block.inner
    let hasRing = false
    for (const r of inner.matchAll(/\bborderWidth\s*:\s*([^,;{}\n]*)/g)) {
      const g = rnHairlineGrade(r[1])
      if (g === 'hair' || g === 'thick') hasRing = true
    }
    if (hasRing) continue
    const grade = rnHairlineGrade(value)
    if (grade === 'unknown') {
      undetermined++
      const at = lineColAt(text, m.index)
      undeterminedRows.push({
        line: at.line,
        col: at.col,
        label: 'rn-style undetermined',
        why: `宽度取自变量(${value.trim().slice(0, 24)})⇒ 量不到就不判`,
      })
      continue
    }
    const drawn = new Set()
    for (const d of inner.matchAll(/\bborder(Top|Bottom|Left|Right)Width\s*:\s*([^,;{}\n]*)/g)) {
      if (rnHairlineGrade(d[2]) === 'hair') drawn.add(SIDE_FROM_RN[d[1]])
    }
    const colorVals = [
      ...inner.matchAll(new RegExp(`\\bborder${m[1]}Color\\s*:\\s*([^,;{}\\n]*)`, 'g')),
      ...inner.matchAll(/\bborderColor\s*:\s*([^,;{}\n]*)/g),
    ].map((c) => c[1])
    const neutral = colorVals.length === 0 || colorVals.every((c) => isNeutralColorRef(c))
    const verdict = judgeBoxSides({
      drawn,
      grade,
      neutral,
      inner,
      side,
      railChecks: () => rnIndentRail(inner, side),
    })
    if (verdict !== 'divider') continue
    const { line, col } = lineColAt(text, m.index)
    hits.push({
      line,
      col,
      level: 'blocking',
      label: 'rn-style single-side divider',
      snippet: text.split('\n')[line - 1].trim().slice(0, 140),
    })
  }
  // 族 7 的 RN 面(`height/width` 发丝 + 同块中性 backgroundColor)2026-10-24 起不再在本函数里
  // 自带一把宽松尺(旧档 `rnHairlineGrade` 只认 ×1、无三型/无 shadowOffset 例外 ⇒ 与发丝尺分叉,
  // 等积清偿被读成新增)。统一走 `scanHairlineFaces` 面 B(严格指纹单源,由 scanSource 挂载)。
  return { hits, undetermined, undeterminedRows }
}

/** RN 侧缩进轨:竖边 + 同轴 padding 与 margin 同在(与 class 族 hasIndentRailPair 同一形状) */
function rnIndentRail(inner, side) {
  if (!VERTICAL_SIDES.has(side)) return false
  const camel = side === 'l' ? 'Left' : 'Right'
  const pad = new RegExp(`\\bpadding(${camel}|Horizontal)?\\s*:`, 'i')
  const mar = new RegExp(`\\bmargin(${camel}|Horizontal)?\\s*:`, 'i')
  return pad.test(inner) && mar.test(inner)
}

/**
 * 块注释遮罩:内容替换为空格、保留换行,行号与原文件逐行对齐。
 * 字符串字面量**不遮** —— 生成器往 HTML 里拼 `border-b` 也是真违规(code-generator.ts 实测即此型)。
 */
export function maskBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

/**
 * CSS 里的属性选择器 `[class*='border-l']` 是在**描述**哪些元素带了那个类,不是自己在画边。
 * 不遮的话族 4 会把这类兼容规则读成分隔线(globals.css 实测两枚假阳 ⇒ 棘轮锚点被顶高,
 * 等于给这一文件的真违规让出两格额度)。只遮 `[class…]` 这一族,代码文件里的
 * `[&>div]:border-b` 那种任意值变体不在射程内 —— 它是真在画。
 */
export function maskCssAttributeSelectors(text) {
  return text.replace(/\[class[^=\]]*[~^*|$]?=[^\]]*\]/g, (m) => m.replace(/[^\n]/g, ' '))
}

/**
 * 整份源码判据。
 * @returns {{hard: Array, single: Array, undetermined: number, lines: string[]}}
 *   hard=族 1/2,single=族 3/4/5/6(带 level),undetermined=族 5/6 里取值取不出形状的那些
 *   (变量宽度、括号配不平的块 ⇒ §0.3 不判,但必须报数,不得静默),
 *   lines=**与 single/hard 同一次读取**的那份行数组(遮罩后)—— 主判定要用它做片段,
 *   不要再按行号去原文件取第二遍:清单面与被审面同轮、内容与结论同轮(§0.4)。
 */
export function scanSource(relPath, text) {
  const hard = []
  const single = []
  const isTsx = relPath.endsWith('.tsx')
  const isCss = relPath.endsWith('.css')
  const classText = maskBlockComments(isCss ? maskCssAttributeSelectors(text) : text)
  const lines = classText.split('\n')
  let lineStart = 0
  lines.forEach((line, idx) => {
    lineStart += line.length + 1
    if (isExemptLine(line)) return
    const lineNumber = idx + 1
    const dm = VIOLATION_RE.exec(line)
    if (dm) {
      hard.push({
        line: lineNumber,
        col: dm.index + 1,
        label: line.match(/divide-y\b/) ? 'divide-y' : 'divide-x',
        snippet: line.trim().slice(0, 140),
      })
      return
    }
    if (isTsx) {
      const code = stripStringsAndComments(line)
      const hm = HR_RE.exec(code)
      if (hm) {
        hard.push({
          line: lineNumber,
          col: hm.index + 1,
          label: '<hr>',
          snippet: line.trim().slice(0, 140),
        })
        return
      }
    }
    const dividerHit = classifyDividerLine(line)
    if (dividerHit) {
      single.push({
        line: lineNumber,
        col: dividerHit.col,
        level: dividerHit.level,
        label: dividerHit.label,
        snippet: line.trim().slice(0, 140),
      })
    }
  })
  // ── 族 5/6:同一张"分隔线"尺子,读另外两种书写语言 ──
  // .css 用块注释遮罩(`//` 在 CSS 里不是注释,`url(https://…)` 会被行注释遮掉 ⇒ 按方言分开)
  const surface = isCss ? maskBlockComments(text) : maskComments(text)
  const skip = interpolationBraceIndices(surface)
  let undetermined = 0
  const undeterminedRows = []
  for (const found of isCss
    ? [scanCssDeclarations(surface, { skip }), scanRnStyleObjects(surface, skip)]
    : [
        scanRnStyleObjects(surface, skip),
        scanCssDeclarations(surface, { asWarnOnly: true, skip }),
      ]) {
    single.push(...found.hits)
    undetermined += found.undetermined
    undeterminedRows.push(...found.undeterminedRows)
  }
  // ── 族 7(2026-10-24 合一):发丝线严格指纹与发丝尺同一把(§0.6)──
  // 判据面 = 整份文本(maskComments 在 scanHairlineFaces 内部完成;跨行 className 值表达式整体读)。
  // divider → 与描边族同一把 blocking 棘轮尺;exempt(三型/彩色底)→ 不计数(尺子同样不计数);
  // undetermined → 只报数(§0.3)。.css 面不归本族(发丝尺头注现读:css 发丝为空集,扩容走尺子侧)。
  if (!isCss) {
    for (const h of scanHairlineFaces(relPath, text).hits) {
      if (h.kind === 'divider') {
        single.push({
          line: h.line,
          col: h.col ?? 1,
          level: 'blocking',
          label: h.family === 'rn' ? 'rn-style bg hairline divider' : 'bg hairline divider',
          snippet: h.snippet,
        })
      } else if (h.kind === 'undetermined') {
        undetermined++
        undeterminedRows.push({
          line: h.line,
          col: h.col ?? 1,
          label: 'bg hairline undetermined',
          why: h.label,
        })
      }
    }
  }
  return { hard, single, undetermined, undeterminedRows }
}

/** 族 4 的计数口径 —— 棘轮锚点与本轮读数必须用同一把尺子(§22c) */
export function countOpaqueSingles(scan) {
  return scan.single.filter((f) => f.level === 'blocking').length
}

/**
 * 去除行内字符串字面量与注释,用于 <hr 判定。
 * 真实 JSX <hr 元素永远不会出现在字符串/注释内,故剥离后残留的 <hr 才属真实违规;
 * 字符串字面量(如 markdown→HTML 的 '<hr/>')与注释中的 <hr 会被一并去除,避免误报。
 */
function stripStringsAndComments(line) {
  let out = ''
  const n = line.length
  let i = 0
  while (i < n) {
    const c = line[i]
    const c2 = line[i + 1]
    if (c === '/' && c2 === '//') break // 行注释:余下全部跳过
    if (c === '/' && c2 === '*') {
      i += 2
      while (i < n && !(line[i] === '*' && line[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      i++
      while (i < n) {
        if (line[i] === '\\') {
          i += 2
          continue
        }
        if (line[i] === quote) {
          i++
          break
        }
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * 豁免判定 — 返回 true 表示该行不算违规。仅豁免注释行(// 单行、/* 块注释、* 列表项、
 * JSX {/* 块注释),以及行内 // 注释之后出现的 divide-(说明性注释)。
 * divide-y / divide-x 无合法 UI 用途,故不做内容豁免。
 */
function isExemptLine(line) {
  const trimmed = line.trim()
  if (/^\s*(\/\/|\/\*|\*|\{)/.test(trimmed)) return true
  const m = line.match(/divide-[yx]\b/)
  if (m && line.slice(0, m.index).includes('//')) return true
  return false
}

// ───────────────────────────── 取材与棘轮(共用层 ./lib/face-scan.mjs) ─────────────────────────────
// 候选清单 / 同面取材 / 新增行号 / 差值锚点这四件事每道内容门都要做,而且每一件都有已记录的错法
// (带 pathspec 问 name-status ⇒ rename 支永远走不到;--diff-filter 少带 R ⇒ 改名档整个失明;
// 清单取索引、内容读磁盘 ⇒ 盘上改好没提交也能报绿)。判据不得在锚点侧另写一份,故锚点与读数
// 一律传同一个 countOf。

export async function run({ staged, worktree }) {
  const top = assertRepoRoot(ROOT, '分割线守门')
  const picked = selectFace({ staged, worktree, def: 'head' })
  if (picked.error) {
    console.log(`${C.red}❌ ${picked.error}${C.reset}`)
    return 2
  }
  const face = picked.face

  console.log(
    `${C.cyan}${C.bold}[分割线守门] 扫描 divide-y / divide-x / <hr> / 单边描边...${C.reset}`,
  )
  console.log(
    `${C.dim}规则: AGENTS.md 第 4 节 — 禁止 divide-y/divide-x/<hr>/单边 border-t|b|l|r 当分割线,改用 space-y-* 间距或 bg-muted 对比${C.reset}`,
  )
  console.log(
    `${C.dim}取材面: ${face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(人工逃生舱,不作提交门禁)' : 'HEAD blob'};单边不透明描边按「该文件 HEAD 自身命中数」做差值棘轮${C.reset}`,
  )
  console.log('')

  const addedLines = staged ? addedLineNumbers(top) : null
  const listed = sourceCandidates(top, face, {
    prefilterRe: PREFILTER_RE,
    pathspecs: SCAN_GLOBS,
    skipSegmentTest: isExcludedDirName,
  })
  const candidates0 = staged ? listed.filter((rel) => addedLines.has(rel)) : listed
  if (candidates0.length === 0) {
    console.log(
      `${C.green}✅ ${staged ? '暂存区无含分割线类 token 的源码变更,跳过' : '被审面无含分割线类 token 的源码文件,跳过'}${C.reset}`,
    )
    return 0
  }
  const { texts: contents } = readSources(top, face, candidates0)
  const candidates = candidates0.filter((rel) => contents.has(rel))
  const addedLinesMap = staged ? addedLines : null
  // 锚点与读数同一个 countOf —— 两把尺子算出来的差值不叫棘轮,叫吵架
  const anchor = staged
    ? headAnchors(top, candidates, (rel, src) => countOpaqueSingles(scanSource(rel, src)))
    : new Map()

  let hardNew = 0
  let hardStock = 0
  let dividerNew = 0
  let dividerStock = 0
  let warnStock = 0
  let undetermined = 0
  const undeterminedItems = []
  const reports = []

  for (const rel of candidates) {
    const scan = scanSource(rel, contents.get(rel))
    undetermined += scan.undetermined
    const relPosix = relative(top, rel).split('\\').join('/')
    for (const u of scan.undeterminedRows) {
      undeterminedItems.push({
        file: relPosix,
        item: { ...u, level: 'undetermined', tag: '未判定' },
      })
    }
    const allowed = staged ? addedLinesMap?.get(rel) : null
    const items = []

    for (const f of scan.hard) {
      if (staged && allowed && allowed.has(f.line)) {
        hardNew++
        items.push({ ...f, level: 'blocking', tag: '被审面新增' })
      } else {
        hardStock++
        items.push({ ...f, level: 'stock', tag: staged ? '未改动行(HEAD 存量)' : '存量' })
      }
    }

    // 族 4:判据是**计数**(超出基线才算红),点名是**取证**(整族逐行给出落点)。
    // 不这样分开写,清理动作就会因为行号挪位而被读成"新增"。
    const blockers = scan.single.filter((x) => x.level === 'blocking')
    const base = staged ? (anchor.get(rel) ?? 0) : blockers.length
    const over = Math.max(0, blockers.length - base)
    dividerNew += over
    dividerStock += blockers.length - over
    for (const f of blockers) {
      items.push({
        ...f,
        level: over > 0 ? 'blocking' : 'stock',
        tag: over > 0 ? `超出 HEAD 基线 ${base}` : '存量',
      })
    }
    for (const f of scan.single.filter((x) => x.level === 'warn')) {
      warnStock++
      items.push({ ...f, level: 'warn', tag: '存量' })
    }

    if (items.length > 0) {
      reports.push({ file: relative(top, rel).split('\\').join('/'), items })
    }
  }

  const blockingTotal = hardNew + dividerNew
  console.log(`${C.bold}扫描结果:${C.reset}`)
  console.log(`  扫描文件: ${candidates.length} 个`)
  console.log(
    `  拦截数:   ${blockingTotal} 处 (BLOCKING:divide/<hr> 新增 ${hardNew},单边描边(类名/CSS/RN 样式对象)超基线 ${dividerNew})`,
  )
  console.log(
    `  存量:     ${hardStock + dividerStock} 处 (divide/<hr> ${hardStock},单边描边 ${dividerStock}) — 只报数(§12e)`,
  )
  console.log(
    `  告警:     ${warnStock} 处 (WARN:低透明度单边描边 + 代码里的生成式 CSS 单边,不阻塞)`,
  )
  console.log(
    `  ${undetermined > 0 ? `${C.yellow}` : C.dim}未判定: ${undetermined} 处 (宽度取自变量 / 声明不在规则块内 ⇒ 不判也不冒充没命中)${C.reset}`,
  )
  console.log('')

  if (reports.length === 0) {
    console.log(`${C.green}${C.bold}✅ 分割线守门通过${C.reset}`)
    return 0
  }

  if (blockingTotal > 0) {
    console.log(`${C.red}${C.bold}❌ 发现 ${blockingTotal} 处违规 + ${warnStock} 处告警:${C.reset}`)
  } else {
    console.log(
      `${C.yellow}${C.bold}⚠️  本次提交无新增违规;下列 ${hardStock + dividerStock} 处存量与 ${warnStock} 处告警待逐页清偿${C.reset}`,
    )
  }
  console.log('')
  for (const { file, items } of reports) {
    const head = items.some((i) => i.level === 'blocking') ? C.red : C.yellow
    console.log(`${head}${file}${C.reset}`)
    for (const f of items) {
      const tag = f.level === 'blocking' ? C.red : f.level === 'warn' ? C.yellow : C.dim
      const lvl = f.level === 'blocking' ? '[BLOCKING]' : f.level === 'warn' ? '[WARN]' : '[存量]'
      console.log(
        `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${tag}${lvl} [${f.label}] ${f.tag}${C.reset} ${f.snippet}`,
      )
    }
    console.log('')
  }
  // 未判定逐条点名(§0.3:取不到输入就说"没判",不得写成"没命中")
  if (undeterminedItems.length > 0) {
    console.log(
      `${C.yellow}${C.bold}未判定 ${undeterminedItems.length} 处(不拦提交,但必须让人看见):${C.reset}`,
    )
    for (const { file, item } of undeterminedItems) {
      console.log(
        `  ${C.dim}${file}:${item.line}:${item.col}${C.reset} ${C.yellow}[未判定] [${item.label}]${C.reset} ${item.why}`,
      )
    }
    console.log('')
  }
  console.log(`${C.dim}修复方法:${C.reset}`)
  console.log(`  1. 列表容器用 space-y-* 间距分隔(推荐,§4 允许的"间距分隔")`)
  console.log(`  2. 或用 bg-muted / bg-card 背景色对比区分区块(§4 允许的"背景色对比")`)
  console.log(`  3. 容器完整描边用 border border-border(单边 border-t/b/l/r 当分割线仍禁止)`)
  console.log(`  4. <hr> 标签一律禁止,改用上述替代方案`)
  console.log(`  5. 单边描边若确属结构性(整圈边框系统的一格 / 引用块左条 / IDE diff 面板),`)
  console.log(`     把宽度写进 ≥2 或换彩色档即落在判据之外;纯分隔线一律改间距或背景对比`)
  console.log(`  6. 详细规则见 AGENTS.md 第 4 节"前端 UI 约束"`)
  console.log('')

  if (staged && blockingTotal > 0) {
    console.log(`${C.red}${C.bold}❌ 分割线守门失败 — 提交已阻止${C.reset}`)
    console.log(`${C.dim}跳过方法:HUSKY_SKIP_NO_DIVIDER=1 git commit ...${C.reset}`)
    return 1
  }
  if (!staged) {
    console.log(
      `${C.yellow}${C.bold}⚠️  ${face === 'worktree' ? '工作树档只供人工量进度(exit 0,不作提交门禁)' : '全量模式仅报数(exit 0)'}${C.reset}`,
    )
  }
  return 0
}

// ───────────────────────────── 自检 ─────────────────────────────

function ok(cond, msg) {
  if (!cond) throw new Error(msg || '断言不成立')
}

/**
 * 判据自检。成对给夹具(每条"放过"都必须有同形状的"判红"对照),并覆盖主判定
 * scanSource —— 只测 helper 而主路径坏了,门一跑就红在自检之外(本仓记过那一型)。
 */
export function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const hit = (line) => classifyDividerLine(line)

  t('S01 不透明单边描边 ⇒ blocking', () => {
    const r = hit('  return <div className="border-b border-border px-3" />')
    ok(r && r.level === 'blocking' && r.label === 'single-side divider', JSON.stringify(r))
  })
  t('S02 无颜色 token 的裸 border-t ⇒ blocking', () => {
    const r = hit('  <tr key={d.date} className="border-t" />')
    ok(r && r.level === 'blocking', JSON.stringify(r))
  })
  t('S03 低透明 ⇒ 仍 WARN(不悄悄升档)', () => {
    const r = hit('  <div className="border-t border-border/50" />')
    ok(r && r.level === 'warn', JSON.stringify(r))
  })
  t('S04 整圈描边 + 单边 override ⇒ 放过(结构性:容器边框系统的一格)', () => {
    ok(hit('  <div className="border border-border border-r" />') === null)
    ok(hit('  <div className="border border-border border-t-0" />') === null)
  })
  t('S05 双轴 border-x ⇒ 放过', () => {
    ok(hit('  <div className="border-x border-border" />') === null)
  })
  t('S06 宽度≥2 强调条 ⇒ 放过', () => {
    ok(hit('  <div className="border-l-4 border-info" />') === null)
  })
  t('S07 下划线式选中态 ⇒ 放过', () => {
    ok(hit("  'rounded-none border-0 border-b-2 border-accent text-accent'") === null)
  })
  t('S08 单边彩色 compound 名 ⇒ 放过', () => {
    ok(hit("  ? 'text-primary border-l-brand-accent-deep bg-muted'") === null)
  })
  t('S09 擦除动作 last:border-b-0 ⇒ 放过', () => {
    ok(hit('  <div className="grid gap-4 px-4 py-3 last:border-b-0" />') === null)
  })
  t('S10 transparent ⇒ 放过', () => {
    ok(hit("  'flex border-l-2 border-transparent'") === null)
  })
  t('S11 中性色阶 gray-200(RN 分隔线)⇒ blocking', () => {
    const r = hit('  <View className="border-b border-gray-200 px-4" />')
    ok(r && r.level === 'blocking', JSON.stringify(r))
  })
  t('S12 驼峰 CSS-in-JS 键不误伤', () => {
    ok(hit("  const s = { borderTopWidth: 1, borderBottomColor: '#eee' }") === null)
  })
  t('S13 主判定:注释行整族豁免', () => {
    const r = scanSource(
      'apps/web/a.tsx',
      '// 这里曾有 border-b border-border 与 divide-y\nexport const z = 1\n',
    )
    ok(r.hard.length === 0 && r.single.length === 0)
  })
  t('S14 主判定:块注释里的 <hr> 不算违规', () => {
    const r = scanSource(
      'apps/web/a.tsx',
      '/* 旧模板产出的 <hr/> 已移除 */\nexport const P = () => <div />\n',
    )
    ok(r.hard.length === 0)
  })
  t('S15 主判定:.tsx 真实 <hr> ⇒ hard', () => {
    const r = scanSource('apps/web/a.tsx', 'export const P = () => <div><hr /></div>\n')
    ok(r.hard.length === 1 && r.hard[0].label === '<hr>', JSON.stringify(r))
  })
  t('S16 主判定:.ts 字符串里的 <hr> 不算', () => {
    const r = scanSource('apps/api/x.ts', "export const s = '<hr/>'\n")
    ok(r.hard.length === 0)
  })
  t('S17 主判定:divide-y 无条件违规', () => {
    const r = scanSource(
      'apps/web/a.tsx',
      'export const P = () => <ul className="divide-y"><li>a</li></ul>\n',
    )
    ok(r.hard.length === 1 && r.hard[0].label === 'divide-y')
  })
  t('S18 主判定:同一行 divide 优先,不重复报单边', () => {
    const r = scanSource(
      'apps/web/a.tsx',
      'export const P = () => <ul className="divide-y border-b border-border" />\n',
    )
    ok(r.hard.length === 1 && r.single.length === 0, JSON.stringify(r))
  })
  t('S19 主判定:生成器拼进 HTML 的分隔线是真违规', () => {
    const r = scanSource(
      'apps/api/code-generator.ts',
      'const html = `<div className="flex justify-between border-b py-2">x</div>`\n',
    )
    ok(r.single.length === 1 && r.single[0].level === 'blocking', JSON.stringify(r))
  })
  t('S20 同文件多行分别计数(棘轮按计数比大小)', () => {
    const r = scanSource(
      'apps/web/a.tsx',
      'export const P = () => (\n  <div>\n    <div className="border-t border-border" />\n    <div className="border-b border-border" />\n  </div>\n)\n',
    )
    ok(countOpaqueSingles(r) === 2, String(countOpaqueSingles(r)))
  })
  t('S21 反向断言:摘掉透明度即从 WARN 落 blocking', () => {
    ok(hit('  <div className="border-t border-muted/30" />')?.level === 'warn')
    ok(hit('  <div className="border-t border-muted" />')?.level === 'blocking')
  })
  t('S22 形状锁:预筛是判据的超集(border-[tblr] 一族必在清单面)', () => {
    ok(PREFILTER_RE.includes('border-[tblr]'))
    ok([...SIDE_TOKENS].every((s) => 'tblr'.includes(s)))
  })
  t('S23 形状锁:族 4 未点名整圈边框 ⇒ 结构性出口不许被删', () => {
    ok(classifyBorderToken('border')?.kind === 'full')
    ok(classifyBorderToken('border-2')?.kind === 'full')
    ok(classifyBorderToken('hover:border')?.kind === 'full')
    ok(classifyBorderToken('border-y')?.kind === 'axis')
    ok(classifyBorderToken('border-b')?.kind === 'side')
    ok(classifyBorderToken('border-b-0')?.width === 0)
    ok(classifyBorderToken('border-b-brand-accent-deep')?.color === 'brand-accent-deep')
    ok(classifyBorderToken('rounded-lg') === null)
  })
  t('S24 网格收口:同格横边 + 竖边各一 ⇒ 放过(课程表/考勤矩阵那种每格自画格线)', () => {
    ok(hit('  <div className="min-h-[60px] border-b border-r p-1" />') === null)
    ok(hit('  <div className="border-t border-l p-2" />') === null)
  })
  t('S25 反向对照:同向两条边是两条分隔线,照判', () => {
    const h = hit('  <div className="border-t border-b px-3 py-2" />')
    ok(h && h.level === 'blocking', JSON.stringify(h))
    const v = hit('  <div className="border-l border-r px-3 py-2" />')
    ok(v && v.level === 'blocking', JSON.stringify(v))
  })
  t('S26 反向对照:单边仍判红 —— 网格档只放过垂直相交的那一组', () => {
    ok(hit('  <div className="border-b border-r p-1" />') === null)
    ok(hit('  <div className="border-b p-1" />')?.level === 'blocking')
  })
  t('S27 缩进轨:竖边 + 同轴 ml/pl 成对 ⇒ 放过(引用块左条 / 树形导引线)', () => {
    ok(hit('  <div className="ml-4 border-l border-border pl-2 pt-1" />') === null)
    ok(hit('  <div className="mr-4 border-r border-border pr-2" />') === null)
    ok(hit('  <div className="mx-2 border-l border-border/40 px-2" />') === null)
  })
  t('S28 反向对照:缺任一半缩进对就照判(border-l 不能靠加点 padding 混过去)', () => {
    ok(
      hit('  <div className="flex w-72 shrink-0 flex-col border-l bg-card" />')?.level ===
        'blocking',
    )
    ok(hit('  <div className="ml-4 border-l border-border" />')?.level === 'blocking')
    ok(hit('  <div className="border-l border-border pl-2" />')?.level === 'blocking')
  })
  t('S29 横边不享受缩进轨出口(最常见的遮红形状:mt-3 border-t pt-2)', () => {
    const r = hit('  <div className="mt-3 border-t border-border pt-2" />')
    ok(r && r.level === 'blocking', JSON.stringify(r))
  })
  t('S30 变体擦除不顶判:border-b + last:border-0 仍是分隔线(24 枚表行线曾漏在这一格)', () => {
    const r = hit('  <tr key={id} className="border-b border-border last:border-0">')
    ok(r && r.level === 'blocking', JSON.stringify(r))
    const v = hit('  <div className="border-x-0 border-b border-border" />')
    ok(v && v.level === 'blocking', JSON.stringify(v))
  })
  t('S31 反向对照:真在画的整圈/双轴边仍放过(擦除与整圈不是一回事)', () => {
    ok(hit('  <div className="border border-border border-t-0" />') === null)
    ok(hit('  <div className="border-x border-border" />') === null)
    ok(hit('  <div className="border-2 border-border border-b" />') === null)
  })

  // ── 族 5(CSS 声明块)/ 族 6(RN 样式对象):2026-10-23 补的两面书写语言 ──
  const css = (body) => scanSource('a.css', body).single
  const rn = (body) => scanSource('a.tsx', body).single
  t('S40 族 5 正例:.css 单边中性描边 = 分隔线(小程序页面级 26 条即这一型)', () => {
    const hits = css('.card {\n  border-top: 1px solid var(--color-border);\n}')
    ok(hits.length === 1 && hits[0].level === 'blocking', JSON.stringify(hits))
    ok(hits[0].label === 'css single-side divider', hits[0].label)
    ok(hits[0].line === 2, `行号要对回声明那一行,实际 ${hits[0].line}`)
  })
  t('S41 族 5 擦除:not-last 的 border-bottom:none 不画线', () => {
    ok(css('.row:last-child {\n  border-bottom: none;\n}').length === 0)
    ok(css('.row {\n  border-bottom: 0;\n}').length === 0)
  })
  t('S42 族 5 整圈 override:盒框在画时那一条竖边不算分隔线', () => {
    ok(
      css(
        '.box {\n  border: 1px solid var(--color-border);\n  border-left: 3px solid var(--color-primary);\n}',
      ).length === 0,
    )
    ok(
      css('.box {\n  border-width: 1px;\n  border-top: 1px solid var(--color-border);\n}')
        .length === 0,
    )
  })
  t('S43 族 5 CSS 三角/箭头(两侧 transparent)是在画形状,不是线', () => {
    const caret =
      '.caret {\n  width: 0;\n  height: 0;\n  border-left: 5rpx solid transparent;\n  border-right: 5rpx solid transparent;\n  border-top: 9rpx solid var(--color-muted-foreground);\n}'
    ok(css(caret).length === 0, JSON.stringify(css(caret)))
  })
  t('S44 族 5 引用块左条:竖边 + 同轴 padding 与 margin ⇒ §4 明文允许', () => {
    const rail =
      '.quote {\n  margin-left: 8px;\n  padding-left: 12px;\n  border-left: 1px solid var(--color-border);\n}'
    ok(css(rail).length === 0, JSON.stringify(css(rail)))
    // 只加 padding 不加 margin ⇒ 轨不成立,照判(不许"补个 padding 就遮红")
    ok(
      css('.quote {\n  padding-left: 12px;\n  border-left: 1px solid var(--color-border);\n}')
        .length === 1,
    )
  })
  t('S45 族 5 网格收口:同格横竖各一边(表格每格 bottom+right)放过', () => {
    ok(
      css(
        '.cell {\n  border-bottom: 1px solid var(--color-border);\n  border-right: 1px solid var(--color-border);\n}',
      ).length === 0,
    )
  })
  t('S46 族 5 同向两条(top+bottom)= 两条线,照判', () => {
    const hits = css(
      '.band {\n  border-top: 1px solid var(--color-border);\n  border-bottom: 1px solid var(--color-border);\n}',
    )
    ok(hits.length === 2, JSON.stringify(hits))
  })
  t('S47 族 5 强调色与粗边出口:彩色 = 高亮下划线;>2px = 强调条', () => {
    ok(css('.tab {\n  border-bottom: 1px solid var(--color-primary);\n}').length === 0)
    ok(css('.hero {\n  border-top: 3px solid var(--color-border);\n}').length === 0)
    ok(css('.tab {\n  border-bottom: 1px solid #0969da;\n}').length === 0)
    ok(css('.tab {\n  border-bottom: 1px solid #e5e7eb;\n}').length === 1, '灰阶 hex 就是中性档')
  })
  t('S48 族 5 单位量不出 ⇒ 未判定计数,既不记绿也不冒红(§0.3)', () => {
    const r = scanSource('a.css', '.x {\n  border-top: 0.06rem solid var(--color-border);\n}')
    ok(r.single.length === 0 && r.undetermined === 1, JSON.stringify(r))
  })
  t('S49 族 5 注释里的 CSS 不算(遮罩只由注释层负责)', () => {
    ok(css('/* .x { border-top: 1px solid var(--color-border); } */').length === 0)
  })
  t('S50 族 5 在代码文件里降 WARN:生成式 CSS(邮件/落地页/第三方主题)逐条报数不拦', () => {
    const hits = rn('const s = `.cover{border-bottom:1px solid ${DOC_BORDER};margin-bottom:40px;}`')
    ok(hits.length === 1 && hits[0].level === 'warn', JSON.stringify(hits))
    ok(hits[0].label === 'generated-css single-side divider', hits[0].label)
  })
  t('S51 族 6 正例:RN 样式对象单边宽 = 分隔线(rowDivider 那种命名即自证)', () => {
    const hits = rn(
      'const s = StyleSheet.create({\n  rowDivider: { borderTopColor: tk.border.light, borderTopWidth: 1 },\n})',
    )
    ok(hits.length === 1 && hits[0].level === 'blocking', JSON.stringify(hits))
    ok(hits[0].label === 'rn-style single-side divider', hits[0].label)
  })
  t(
    'S52 族 6 擦除与整圈:borderBottomWidth:0 不画线;bund borderWidth 在画时那一条是 override',
    () => {
      ok(rn('const s = {\n  rowLast: { borderBottomWidth: 0 },\n}').length === 0)
      ok(
        rn(
          'const s = {\n  box: { borderWidth: 1, borderColor: tk.border.light, borderTopWidth: 1 },\n}',
        ).length === 0,
      )
    },
  )
  t('S53 族 6 网格 / 强调色 / 缩进轨三条出口同一把尺子', () => {
    ok(rn('const s = {\n  cell: { borderBottomWidth: 1, borderRightWidth: 1 },\n}').length === 0)
    ok(
      rn('const s = {\n  tab: { borderBottomWidth: 1, borderBottomColor: brand.cta },\n}')
        .length === 0,
    )
    ok(
      rn('const s = {\n  rail: { borderLeftWidth: 1, paddingLeft: 8, marginLeft: 4 },\n}')
        .length === 0,
    )
    ok(
      rn('const s = {\n  rail: { borderLeftWidth: 1, paddingLeft: 8 },\n}').length === 1,
      '缺 margin 就不算轨',
    )
  })
  t('S54 族 6 hairlineWidth 与变量宽度:前者是发丝线,后者未判定', () => {
    ok(rn('const s = {\n  line: { borderTopWidth: StyleSheet.hairlineWidth },\n}').length === 1)
    const r = scanSource('a.tsx', 'const s = {\n  bar: { borderTopWidth: TAB_BAR_TOP_BORDER },\n}')
    ok(r.single.length === 0 && r.undetermined === 1, JSON.stringify(r))
  })
  t('S55 族 6 反向锁:borderTopLeftRadius / borderBottomColor 单出不算宽度动作', () => {
    ok(
      rn('const s = {\n  card: { borderTopLeftRadius: 8, borderBottomColor: tk.border.light },\n}')
        .length === 0,
    )
  })
  t('S56 族 6 行注释里的属性不算(遮注释、留字符串)', () => {
    ok(rn('// 旧写法:borderTopWidth: 1\nconst s = { paddingTop: 4 }').length === 0)
  })
  t('S57 反向对照:.css 里的属性选择器是在"描述谁带了这个类",不是自己在画边', () => {
    const hits = css("[class*='border-l'][class*='bg-card'] * {\n  scrollbar-width: thin;\n}")
    ok(hits.length === 0, JSON.stringify(hits))
    // 同一条规则里真画了单边 ⇒ 照样点名(遮罩只遮选择器,不遮声明)
    ok(css("[class*='border-l'] * {\n  border-top: 1px solid var(--color-border);\n}").length === 1)
  })
  t('S58 形状锁:两面书写语言都在清单面里(CSS 面曾被一句"由跨端 token 门管"整片放过)', () => {
    ok(SCAN_GLOBS.includes('*.css'), JSON.stringify(SCAN_GLOBS))
    ok(/border-\(top\|bottom\|left\|right\)/.test(PREFILTER_RE), PREFILTER_RE)
    ok(/border\(Top\|Bottom\|Left\|Right\)\(Width\|Color\)/.test(PREFILTER_RE), PREFILTER_RE)
    // 族 7 的三型输入(类名轴 token / RN 表达式 / RN 背景键)都必须在预筛超集里,
    // 否则清单面比内容面窄 = 静默少扫(与 CSS 面那一格同型)
    ok(/\[hw\]-px/.test(PREFILTER_RE), PREFILTER_RE)
    // 合一@2026-10-24:严格尺认任意值发丝(`h-[2px]`/`h-[2rpx]`/`h-[length:1px]`)与 RN 数值档
    // (`height: 1`,展开运算符未写 backgroundColor 的未判定档连 backgroundColor 都不含)
    ok(PREFILTER_RE.includes('[hw]-\\[(length:)?[0-9.]'), PREFILTER_RE)
    ok(PREFILTER_RE.includes('(height|width): *[0-2][[:space:],}]'), PREFILTER_RE)
    ok(PREFILTER_RE.includes('hairlineWidth'), PREFILTER_RE)
    ok(PREFILTER_RE.includes('backgroundColor'), PREFILTER_RE)
  })

  t(
    'S59 任意值宽度不是色档:`border-b-[length:2rpx] border-border` 是真分隔线(6 枚曾按"彩色"放过)',
    () => {
      const v = hit('  <View className="px-[24rpx] border-b-[length:2rpx] border-border" />')
      ok(v && v.level === 'blocking', JSON.stringify(v))
      ok(
        hit('  <View className="border-b-[length:8rpx] border-border" />') === null,
        '粗档仍算强调条',
      )
      ok(hit('  <View className="border-b-[0] border-border" />') === null, '0 仍是擦除')
      ok(hit('  <View className="border-l-[3px] border-brand-500" />') === null, '彩色仍放过')
      // 反向锁:变体前缀仍要剥(`[&>div]:` 的冒号在括号外,`[length:]` 的在括号内)
      ok(hit('  <div className="[&>div]:border-b [&>div]:border-border" />')?.level === 'blocking')
      ok(hit('  <div className="hover:border-b hover:border-border" />')?.level === 'blocking')
    },
  )

  // ── 任意值色档(G-879 第三条盲区):`border-[var(--color-border)]` 旧判当彩色放过 ──
  t('S67 任意值中性色变量单边 ⇒ blocking(settings/bill 14 条就是这一型)', () => {
    const r = hit('  <View className="border-t border-[var(--color-border)] px-[24rpx]" />')
    ok(r && r.level === 'blocking', JSON.stringify(r))
    ok(
      hit('  <View className="border-b-[var(--color-border)] border-border" />')?.level ===
        'blocking',
      '"border-b-[<颜色>]" 是色档不是长度',
    )
    ok(
      hit('  <View className="border-t border-[var(--color-border-medium)]" />')?.level ===
        'blocking',
    )
  })
  t('S68 任意值反向:彩色变量 / 整圈 / 粗档 / 擦除仍放过', () => {
    ok(hit('  <div className="border-t border-[var(--color-primary)]" />') === null)
    ok(hit('  <div className="border-t-[var(--color-brand-accent-deep)]" />') === null)
    ok(hit('  <div className="border border-[var(--color-border)]" />') === null, '整圈不是分隔线')
    ok(hit('  <div className="border-t-[3px] border-border" />') === null, '粗档是强调条')
    ok(hit('  <div className="border-t-[0] border-border" />') === null, '0 是擦除')
  })
  t('S69 形状锁:任意值按内容分流,预筛含独立色档形态', () => {
    ok(isArbitraryColor('var(--color-border)') && !isArbitraryColor('length:2rpx'))
    ok(isNeutralBorderColor('var(--color-border)'), '变量名回落到中性档表')
    ok(!isNeutralBorderColor('var(--color-primary)'))
    ok(classifyBorderToken('border-[var(--color-border)]')?.kind === 'color')
    const w = classifyBorderToken('border-[length:2rpx]')
    ok(w?.kind === 'full' && w.width === 1, '独立长度档是整圈宽度,不是色名')
    ok(PREFILTER_RE.includes('border-\\['), PREFILTER_RE)
  })

  // ── 族 7(背景色发丝线):2026-10-23 L29015 ──
  const hit2 = classifyHairlineLine
  t('S60 族 7 正例:h-px/w-px/h-[1px] + 中性 bg ⇒ blocking;变体前缀要剥', () => {
    const h = hit2('  <div className="h-px bg-border" />')
    ok(h && h.level === 'blocking' && h.label === 'bg hairline divider', JSON.stringify(h))
    ok(hit2('  <div className="w-px bg-muted" />')?.level === 'blocking')
    ok(hit2('  <div className="h-[1px] bg-gray-200" />')?.level === 'blocking')
    ok(hit2('  <div className="md:h-px md:bg-border" />')?.level === 'blocking', '变体前缀仍要剥')
    ok(hit2('  <div className="h-px bg-card" />')?.level === 'blocking')
    ok(hit2('  <div className="h-px bg-background" />')?.level === 'blocking')
  })
  t('S61 族 7 排除①语义分隔件:separator 三态放过,裸线照判(反向锁)', () => {
    ok(hit2('  <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-muted" />') === null)
    ok(hit2('  <div role="separator" className="h-px bg-border" />') === null)
    ok(hit2('  <Separator className="h-px bg-muted" />') === null)
    ok(
      hit2(
        '  const Separator = ({ className }) => <div className={cn(".Separator h-px", className)} />',
      ) === null,
    )
    // 反向锁:没有分隔件结构件的同一形状必须照判(排除不许被拿来遮红)
    ok(hit2('  <div className="h-px bg-muted" />')?.level === 'blocking')
  })
  t(
    'S62 族 7 排除②导引轨:absolute+上界成对 + w-px 放过;裸 h-full/flex-1 照判(与尺子 railSuspect 同判)',
    () => {
      ok(hit2('  <div className="absolute top-0 bottom-0 left-3 w-px bg-border" />') === null)
      ok(
        hit2('  <div className="h-full w-px bg-muted" />')?.level === 'blocking',
        '裸 h-full 不享轨出口',
      )
      ok(
        hit2('  <div className="w-px flex-1 bg-border" />')?.level === 'blocking',
        '裸 flex-1 不享轨出口',
      )
      ok(
        hit2('  <div className="absolute h-px bg-border" />')?.level === 'blocking',
        '横轴不享轨出口',
      )
    },
  )
  t('S63 族 7 排除③分割器:w-full + h-px 放过(pane-split);非通宽照判', () => {
    ok(hit2('  <div className="w-full h-px cursor-row-resize bg-border" />') === null)
    ok(hit2('  <div className="flex-1 h-px bg-border" />')?.level === 'blocking')
  })
  t(
    'S64 族 7 边界(合一后与发丝尺同判):彩色/transparent/无 bg/非发丝轴不判;透明度档与复合名中性档照判 blocking',
    () => {
      ok(hit2('  <div className="h-px bg-primary" />') === null)
      ok(hit2('  <div className="h-px bg-transparent" />') === null)
      // 合一@2026-10-24:发丝尺对 `bg-border/50` 本就按 divider 计数(底色档剥 /opacity),
      // 族 7 旧 WARN 档是那把宽松近似的第二把尺 ⇒ 随合一取消(低透明度档只保留给描边族 3)。
      const op = hit2('  <div className="h-px bg-border/50" />')
      ok(op && op.level === 'blocking', JSON.stringify(op))
      // 复合名 = 任一段落中性根即算(bg-muted-foreground 含 muted 根)——尺子口径,整名档随合一取消
      const comp = hit2('  <div className="h-px bg-muted-foreground" />')
      ok(comp && comp.level === 'blocking', JSON.stringify(comp))
      ok(hit2('  <div className="h-px" />') === null, '没有 bg 不判(可能是占位/轨道)')
      ok(hit2('  <div className="h-4 bg-border" />') === null, '非发丝轴 token 不判')
    },
  )
  t('S65 族 7 主路径:scanSource 与棘轮同尺(countOpaqueSingles 含发丝线 blocking)', () => {
    const r = scanSource(
      'apps/web/a.tsx',
      'export const P = () => (\n  <div>\n    <div className="h-px bg-border" />\n    <div className="h-px bg-primary" />\n    <div className="border-b border-border" />\n  </div>\n)\n',
    )
    ok(countOpaqueSingles(r) === 2, JSON.stringify(r.single))
    // 合一@2026-10-24:`bg-border/50` 与发丝尺同判 blocking(旧 WARN 档是第二把尺,已随合一取消)
    const w = scanSource(
      'apps/web/b.tsx',
      'export const P = () => <div className="h-px bg-border/50" />\n',
    )
    ok(
      countOpaqueSingles(w) === 1 && w.single.length === 1 && w.single[0].level === 'blocking',
      JSON.stringify(w.single),
    )
  })
  t(
    'S66 族 7 RN 面(合一后):height:1|2、hairlineWidth×1|×2 + 中性底 ⇒ blocking;×变量 ⇒ 未判定;彩色/无 bg/粗档不判',
    () => {
      const hits = rn(
        'const s = StyleSheet.create({\n  line: { height: 1, backgroundColor: tk.border.light },\n})',
      )
      ok(hits.length === 1 && hits[0].level === 'blocking', JSON.stringify(hits))
      ok(hits[0].label === 'rn-style bg hairline divider', hits[0].label)
      const v = rn('const s = {\n  rail: { width: 1, backgroundColor: tokens.surface.muted },\n}')
      ok(v.length === 1, JSON.stringify(v))
      const hw = rn(
        'const s = {\n  line: { height: StyleSheet.hairlineWidth, backgroundColor: tk.border.light },\n}',
      )
      ok(hw.length === 1, JSON.stringify(hw))
      // 合一@2026-10-24:`×2` 与 `height: 2` 在发丝尺是真实写法的发丝档(SearchOverlay:481 同型),
      // 旧档"量不出宽度⇒未判定"是第二把宽松尺,已随严格指纹单源取消;`× <变量>` 仍是未判定。
      const two = rn(
        'const s = {\n  line: { height: StyleSheet.hairlineWidth * 2, backgroundColor: tk.border.light },\n}',
      )
      ok(two.length === 1 && two[0].label === 'rn-style bg hairline divider', JSON.stringify(two))
      const thick2 = rn('const s = {\n  line: { height: 2, backgroundColor: tk.border.light },\n}')
      ok(thick2.length === 1, JSON.stringify(thick2))
      const r = scanSource(
        'a.tsx',
        'const s = {\n  line: { height: StyleSheet.hairlineWidth * SCALE, backgroundColor: tk.border.light },\n}',
      )
      ok(r.single.length === 0 && r.undetermined === 1, JSON.stringify(r))
      ok(
        rn('const s = {\n  dot: { height: 1, backgroundColor: brand.cta },\n}').length === 0,
        '彩色底不判',
      )
      ok(rn('const s = {\n  box: { height: 1 },\n}').length === 0, '没写 backgroundColor 不判')
      ok(
        rn('const s = {\n  bar: { height: 4, backgroundColor: tk.border.light },\n}').length === 0,
        '粗档不判',
      )
      ok(
        rn('const s = {\n  hero: { height: "100%", backgroundColor: tk.background },\n}').length ===
          0,
        '量不到的普通高度不冒充未判定',
      )
    },
  )

  t('S70 合一牙(票 L29015 尾格·两尺互顶实证):族 7 基线必已含发丝线 ⇒ 等积清偿不抬高计数', () => {
    // 立因:旧族 7 比发丝尺窄(`bg-popover` / `h-[2px]` / `h-[2rpx]` / RN `height: 2` 都不计),
    // 把这些尺子计为存量的形状改成等积单边描边时,族 6/4 棘轮按 HEAD 基线 0 把清偿本身判成
    // "新增 1 超棘轮"⇒ 有人被迫回退。合一后每枚形状在动手前就已计入同一把棘轮:计数只降不升。
    const pairs = [
      [
        'apps/web/a.tsx',
        'export const P = () => <div className="h-px bg-popover" />\n',
        'export const P = () => <div className="border-b border-border" />\n',
      ],
      [
        'apps/web/b.tsx',
        'export const P = () => <div className="h-[2px] bg-border" />\n',
        'export const P = () => <div className="border-b border-border" />\n',
      ],
      [
        'apps/miniapp-taro/src/pages/x/index.tsx',
        'export const P = () => <View className="h-[2rpx] bg-border" />\n',
        'export const P = () => <View className="border-b border-border" />\n',
      ],
      [
        'apps/mobile-rn/src/screens/Y.tsx',
        'const s = {\n  hairline: { height: 2, backgroundColor: tk.border.light },\n}\n',
        'const s = {\n  hairline: { borderTopWidth: 2, borderTopColor: tk.border.light },\n}\n',
      ],
      [
        'apps/web/c.tsx',
        'export const P = () => <div className="h-px bg-border/50" />\n',
        'export const P = () => <div className="border-b border-border/50" />\n',
      ],
    ]
    for (const [rel, before, after] of pairs) {
      const b = countOpaqueSingles(scanSource(rel, before))
      const a = countOpaqueSingles(scanSource(rel, after))
      ok(b >= 1, `HEAD 基线必须已把这枚发丝线计入族 7:${rel}`)
      ok(a <= b, `等积清偿不得抬高计数(互顶回潮):${rel} ${b}→${a}`)
    }
  })

  t(
    'S71 面 B 词界假阳锁:模板串里的 kebab CSS(line-height:1.6 无单位数值)不是 RN 样式对象候选',
    () => {
      // 立因:`\b(height|width)` 认 '-' 后的 'height' ⇒ `<div style="font-size:16px;line-height:2;">`
      // 这类 HTML 生成串被读成 RN 发丝(2026-10-24 合一现读 diff:email-templates / design-templates /
      // certificate-download 页共 8 处)。kebab CSS 串归族 5(代码文件里只 WARN),面 B 只管 JS 对象键。
      ok(rn('const s = `<p style="font-size:16px;line-height:2;">x</p>`\n').length === 0)
      ok(
        rn(
          'const s = `<div style="max-width:400px;line-height:1.6;color:${DOC_TEXT_BODY}">y</div>`\n',
        ).length === 0,
      )
      // 正向对照:真 RN 对象形状照常命中(词界只踢 kebab,不踢对象键)
      ok(
        rn('const s = {\n  line: { height: 1, backgroundColor: tk.border.light },\n}').length === 1,
        '对象键 height 仍要判',
      )
      const spread = scanSource('a.tsx', 'const s = `<p style="line-height:1.8;margin:0">z</p>`\n')
      ok(spread.undetermined === 0, JSON.stringify(spread.undeterminedRows))
    },
  )

  t('S67 族 7 跨行:轴 token 与中性底分行写在同一 className 表达式 ⇒ 照判;结构件/彩色仍放过', () => {
    const r = scanSource(
      'apps/web/f.tsx',
      "export const P = () => (\n  <div className={cn('h-px', 'bg-border')} />\n)\n",
    )
    ok(
      countOpaqueSingles(r) === 1 && r.single[0].label === 'bg hairline divider',
      JSON.stringify(r.single),
    )
    const rail = scanSource(
      'apps/web/g.tsx',
      "export const P = () => (\n  <span className={cn('absolute top-0 bottom-0 w-px', 'bg-border')} />\n)\n",
    )
    ok(rail.single.length === 0, `跨行导引轨仍属型②\n${JSON.stringify(rail.single)}`)
    const accent = scanSource(
      'apps/web/h.tsx',
      "export const P = () => (\n  <span className={cn('h-px', 'bg-primary')} />\n)\n",
    )
    ok(accent.single.length === 0, JSON.stringify(accent.single))
    // 反向锁:轴 token 不在 className 值表达式里 ⇒ 不跨行借邻近元素的底色
    ok(
      classifyHairlineLine("  const w = 'h-px'", {
        text: "  const w = 'h-px'\n  const c = 'bg-border'",
      }) === null,
      '表达式外的底色不许被借来判红',
    )
  })

  let pass = 0
  const lines = []
  for (const c of cases) {
    try {
      c.fn()
      pass++
      lines.push(`  ✅ ${c.name}`)
    } catch (e) {
      lines.push(`  ❌ ${c.name} — ${e?.message ?? e}`)
    }
  }
  console.log(lines.join('\n'))
  const total = cases.length
  console.log(`\n分割线守门自检: ${pass}/${total} 通过`)
  if (pass !== total) {
    console.log(`${C.red}❌ 自检未过 — 判据本身坏了${C.reset}`)
    return 1
  }
  console.log(`${C.green}✅ 分割线守门自检通过${C.reset}`)
  return 0
}

if (isDirectRun) {
  try {
    const code = isSelfTest ? selfTest() : await run({ staged: isStaged, worktree: isWorktree })
    process.exit(code)
  } catch (e) {
    // 取不到输入 ⇒ exit 2 显式「未判定」,不记绿也不冒红(§0.3)
    const undetermined = e instanceof Undetermined
    console.log(
      `${undetermined ? C.yellow : C.red}${undetermined ? '⚠️  无法判定(取材失败,既不记绿也不冒红)' : '❌ 分割线守门异常'}: ${e?.message ?? e}${C.reset}`,
    )
    process.exit(2)
  }
}

export const __test__ = {
  bgNeutrality,
  bgTokensOf,
  classifyBorderToken,
  classifyDividerLine,
  classifyHairlineLine,
  cssHairlineGrade,
  enclosingBraceBlock,
  hasIndentRailPair,
  isArbitraryColor,
  isNeutralBorderColor,
  isNeutralColorRef,
  lineOfIndex,
  maskBlockComments,
  maskCssAttributeSelectors,
  interpolationBraceIndices,
  rnHairlineGrade,
  rnThinGrade,
  scanCssDeclarations,
  scanHairlineFaces,
  scanRnStyleObjects,
  scanSource,
  countOpaqueSingles,
  selfTest,
  PREFILTER_RE,
  SCAN_GLOBS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
