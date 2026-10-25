#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-no-warm-border.mjs — 暖色描边禁令守门(2026-10-20 立)。
 *
 * 立因(全是当次现读,不是推测):用户拍到 RN 端搜索框聚焦时出现一圈橙描边,并指出
 * "所有位置都有这个毛病"。量出来的三条独立通道:
 *
 *  ① **Android 原生层(这才是"所有位置"的那一条)**:RN 模板遗留件
 *     `apps/mobile-rn/android/app/src/main/res/drawable/rn_edit_text_material.xml` 的 selector
 *     第二条是**无 state 限定的兜底 item**,恒指向 `abc_textfield_activated_mtrl_alpha`。
 *     于是每一个 RN TextInput 自带一圈原生 9-patch 描边,其 tint 取 `?attr/colorControlActivated`
 *     —— 主题未钉 ⇒ 回落系统强调色(HyperOS 实测 #E59700)。描边画在裸 EditText 身上、包不住
 *     整行容器,与 JS 层的容器描边叠成"框中框"。它是**主题级**缺陷:一处命中、全端所有输入框
 *     同时中招,JS 侧怎么写都盖不掉。
 *  ② web 侧 `.ai-input-shell--high-risk` 两态描边取 `--color-amber-500`,外加一枚
 *     `shadow-[0_0_0_1px_rgba(245,158,11,0.08)]`(1px 描边阴影,同一根轴的第二个载体)。
 *  ③ `local-folder-picker.tsx` 的 `focus-visible:ring-amber-500/40`。
 *
 * 为什么新开一门而不扩门 83 的 R8:R8 判"描边不得取**墨**档",射程只有 web/RN 两种书写语言;
 * 本门主犯住在 Android XML 里,R8 那张属性表结构上装不下(§0.6 禁的是同面第二份实现)。
 *
 * 判据:
 *   W1 暖色描边,两条通道:
 *      ① 聚焦态:描边轴(CSS 描边属性 / Tailwind 描边工具类 / RN 描边 style 键)取
 *      amber|orange|yellow|warning 词族、`--color-(amber|orange|yellow|warning)*`、或暖色
 *      hex/rgb,且**处在聚焦态**(CSS 选择器带 :focus* / 工具类 variant 带 focus 族 / RN 行带
 *      focus 信号)⇒ 命中。
 *      ② 输入框紧邻容器(`W1-input`):文本输入控件(`input`/`textarea`/`TextInput`,排除复选框、
 *      单选框、滑块等非文本型)向上 ≤2 行的容器开标签上带暖色描边 ⇒ 命中。**这一维与聚焦无关** ——
 *      立因是 2026-10-21 实测:`local-folder-picker` 的编辑态容器常驻 `ring-1 ring-amber-500/30`,
 *      只判聚焦态会漏掉整族"框上永远有一圈橙"。两个收窄都是为了不造假阳:只认容器开标签(不认
 *      兄弟元素),且距离 ≤2 行(checkin 页距离 6/12 行那两处暖色徽章实测无关)。
 *      刻意不判:① 底色/文字/图标/图表取暖色(合法语义档);② **非输入控件的暖色边框** —— 那是
 *      警告横幅 callout 的成套设计档(`border-amber-500/30` + `bg-amber-500/10` + `text-amber-700`),
 *      HEAD 面实测 90 处,把它们算成本门缺陷就是 §12e 禁的恒红门,而"改光它们"是重新设计
 *      不是修 bug。本门管的是用户报的那一型:**输入控件上凭空多出来的一圈橙**。
 *      暖色尺只认 R>G>B 且两级差都够宽的一族(橙/琥珀/黄);红(G≈B)、粉(B>G)、紫、深棕
 *      都不在射程 —— 本门管"橙色描边",不做色彩警察。
 *   W2 原生输入框描边件:res 目录下各 xml 引用 `textfield_(activated|default|focused|highlight)`
 *      系 9-patch ⇒ 命中(①的回潮通道)。
 *   W3 原生强调色:*AppTheme* 缺 `colorAccent` 或 `colorControlActivated`(⇒ 回落系统强调色,
 *      正是①的成因),或被它们引用的 color 值不是中性灰阶 ⇒ 命中。
 *   W4 生成源可跟踪性:`apps/mobile-rn/plugins/*.cjs` 被 .gitignore 吞掉(根 `*.cjs` 全局忽略)
 *      ⇒ 命中。这一条是立项过程中**实测撞出来的**:plugin 写完后 `git status` 一个字节都不显示,
 *      即"原生层修复根本没进仓、下次 prebuild 照旧洗回模板原件"。只在**全集档**判 —— 被忽略的
 *      文件结构上不会出现在 --staged 清单里,挂在子集档等于永不命中(§0.9)。
 *
 * 取材面(守门 118 / §0.4):全量判 HEAD blob、`--staged` 判索引 blob、`--worktree` 仅人工逃生舱;
 * 两面旗同给 exit 2;取不到 ⇒ Undetermined ⇒ exit 2「未判定」,不记绿也不冒红。
 * **被审仓根**:缺省按本脚本位置自推导(生产路径);`--root <dir>` 显式覆盖(G-929:镜像测试
 * 换仓场景)。给了解答不出的目录 ⇒ exit 2,不静默回落。
 * 射程内 0 件分两档(`judgeEmptyScope`):**staged 档 = 本枚提交不涉及 ⇒ 通过**;全量/工作树档
 * = 判据没跑到东西 ⇒ 判死。立因(2026-10-21 实测):staged 档把"无关提交"也判 exit 2 ⇒ 一枚只动
 * 小程序/脚本的提交被拦,只能跳门;这正是 §12e 的恒红门型,结局是连带废掉全部守门。
 * 本档只改"这一枚提交没有射程内文件"的结论,**不动任何在射程文件的判据强度**。
 * **判据输入与被审对象分面同批**:W3 要读 styles.xml 引用的 colors.xml。colors.xml 是输入不是被审件
 * —— 若输入固定取 HEAD 面,则"同一枚提交同时改 styles.xml + colors.xml"(本次修复正是这一型)会被
 * 判成"引用不存在的颜色"假红。故输入与被审件走**同一个面**,同批预取。
 *
 * 遮罩档(横向口径"判字面量的门只遮注释、保留字符串"):走 `code-mask.mjs` 的 `maskComments`。
 *
 * 定级与棘轮(§12e):`--staged` 走差值棘轮,锚点 = 该文件 HEAD 自身命中数 ⇒ 只拦"本次把暖色描边
 * 加回来";全量档判 HEAD 面 ⇒ 只报数。升 blocking 的前置 = 存量归零,立项时三处修复已同笔落地。
 * 出口:具名到期台账 `scripts/data/warm-border-exemptions.json`(**无行内豁免**)。
 *
 * 退出码:0 = 通过 / 1 = BLOCK 级失败 / 2 = 无法判定。
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  Undetermined,
  catBatch,
  readWorktreeFile,
  selectFace,
  gitRaw,
  FACE_LABEL,
  FACE_NOTE,
} from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'
import { describeFlagToken, flagValue } from './lib/flag-value.mjs'

const SKIP_ENV = 'HUSKY_SKIP_WARM_BORDER'
// 2026-10-21 G-929:`--root <dir>` 显式指定**被审仓根**,缺省仍按脚本位置自推导 ⇒ 生产行为一字不变。
// 立因(现读复现):旁路落地器 object-space-land.mjs 在镜像测试里把 LAND_ROOT 指到 mkScratch
// 临时仓,门体若只认自身位置,`--rev <tree>` 就在主仓里问一枚只存在于临时仓的树 ⇒
// "fatal: not a tree object" ⇒ 未判定 ⇒ 落地器 fail-closed 拒绝 ⇒ object-space-land 镜像
// 套件 26 例整批红。判据本身与仓根无关(暖色描边是内容事实),换仓不该让它失明,失明更不该
// 被当成"拒绝"。镜像用例 M16 钉这一档的三态。
// --root 取值走 G-322 单源:`--root --worktree` 这类"值被紧邻旗标顶掉"不得吞成目录名,
// 也不得按"没给"回落本仓根(那会审错树还照常出结论)。点名叫用法错并 exit 2。
const rootF = flagValue(process.argv, '--root')
if (rootF.present && !rootF.valid) {
  console.error(`用法错:--root 需要一个目录,紧邻的 token 实得:${describeFlagToken(rootF)}(不得静默回落本仓根)`)
  process.exit(2)
}
const rootArg = rootF.valid ? String(rootF.value ?? '').trim() : ''
// 单源只判"非空且不以 - 开头";空白串能过那一层,trim 后会与"没给"同形 ⇒ 静默回落本仓根。
// 这里补一道域校验,不让 `--root "   "` 变成"在主仓审过了"。
if (rootF.valid && rootArg === '') {
  console.error('用法错:--root 需要一个目录 —— 实得空白串(不得静默回落本仓根)')
  process.exit(2)
}
const root = rootArg !== '' ? resolve(rootArg) : join(dirname(fileURLToPath(import.meta.url)), '..')
const EXEMPTIONS_REL = 'scripts/data/warm-border-exemptions.json'

/** W1 射程:各端样式与组件源 */
const STYLE_SCOPES = [
  'apps/web',
  'apps/desktop',
  'apps/miniapp-taro',
  'apps/mobile-rn',
  // 浏览器扩展侧栏也是一端(它自带 globals.css/style.css 与一整套输入控件),
  // 此前不在射程内 ⇒ 它的聚焦态暖色描边没人管(覆盖漏洞)。补进来的存量实测为 0
  // (extension 的暖色只在文字/图标与非聚焦的警示 callout 上,按 W1 的"刻意不判"条款放行)。
  'apps/extension',
  'packages/ui-react',
  'packages/ui-native',
  'packages/app',
  'packages/shared',
  'packages/design-tokens',
]
const STYLE_EXT = /\.(css|scss|wxss|ts|tsx|js|jsx)$/
/** 生成物 / 测试夹具 / 派生副本不是实现,不判 W1 */
const STYLE_EXCLUDE =
  /(^|\/)(node_modules|dist|build|\.next|\.taro|\.cache|coverage|__tests__|tests?|e2e)(\/|$)/

/** W2/W3 射程:某端 Android 主资源目录下的 xml(排除 build 中间产物) */
const ANDROID_RES_RE = /^apps\/[^/]+\/android\/app\/src\/[^/]+\/res\/.*\.xml$/
const ANDROID_EXCLUDE = /(^|\/)(build|\.gradle|intermediates|merged\.dir|generated)(\/|$)/
const THEME_STYLES_RE = /values[^/]*\/styles\.xml$/
/**
 * **提交链真正能判到的原生真相在这里**:`apps/mobile-rn/.gitignore:2` 把 `/android` 整目录
 * 排除(自述"Expo prebuild 生成的原生目录"),所以 res 下的 xml **不在任何 git 面上** ——
 * 按它判,`--staged`/全量档的枚举恒为 0,那两条腿等于没装(§0.3 枚举到 0 判死,不记绿)。
 * 故 W2/W3 在提交链上判的是**生成源** `apps/mobile-rn/plugins/*.cjs`;盘上那份 res 只在
 * `--worktree` 人工档验(生成物属外部输入,按门 217 的许可条款磁盘读)。
 */
const RN_PLUGIN_RE = /^apps\/mobile-rn\/plugins\/.*\.cjs$/

// ══════════════════════ 纯判据(镜像测试 import 这些,禁止复制) ══════════════════════

/**
 * 暖色 = 橙 / 琥珀 / 黄:R>G>B 且两级差都够宽。
 * 刻意不判红(G≈B)、粉(B>G)、紫(R<B)、白/灰(差为 0)。
 */
export function isWarmRgb(r, g, b) {
  if (![r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) return false
  if (r < 90) return false // 太暗的暖色读成深棕,不是"橙色描边"
  return r > g + 25 && g > b + 20
}

/** #RGB / #RRGGBB / #RRGGBBAA → [r,g,b];解不出返回 null(不猜色)。 */
export function parseHexRgb(hex) {
  const h = String(hex).replace(/^#/, '')
  if (!/^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(h)) return null
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16))
}

/** 一段取值文本里是否含暖色源(词族 / 变量名 / warning 家族 / hex / rgb())。 */
export function hasWarmColor(text) {
  const s = String(text)
  if (/\b(?:amber|orange|yellow)\b/i.test(s)) return true
  if (/--color-(?:amber|orange|yellow|warning)\b/i.test(s)) return true
  if (/\bwarning\.[A-Za-z]/.test(s) || /tokens\.warning\b/.test(s)) return true
  for (const m of s.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const rgb = parseHexRgb(m[0])
    if (rgb && isWarmRgb(...rgb)) return true
  }
  for (const m of s.matchAll(/rgba?\(\s*(\d+)\s*(?:,|\s)\s*(\d+)\s*(?:,|\s)\s*(\d+)/g)) {
    if (isWarmRgb(+m[1], +m[2], +m[3])) return true
  }
  return false
}

/** CSS 描边轴属性(排除 radius/width/style/spacing 等非色属性)。 */
const CSS_BORDER_PROP_RE =
  /(?:^|[;{}\s])(border(?:-[a-z]+)*-color|border|outline|outline-color|box-shadow|-webkit-focus-ring-color|--tw-ring-color|--tw-shadow|--tw-ring-shadow|border-image(?:-source)?)\s*:\s*([^;{}\n]+)/gi

/** 描边工具类的暖色档本体(不含 variant 前缀)。 */
const TW_WARM_BORDER_CLASS =
  /^(?:border|ring|outline|divide|shadow)-(?:amber|orange|yellow)-\d{2,3}(?:\/\d{1,3})?$/
/** focus 族 variant:focus / focus-within / focus-visible / group-focus / peer-focus-*。 */
const TW_FOCUS_VARIANT = /^(?:(?:group|peer)-)?focus(?:-(?:within|visible|group))?(?:-[a-z0-9-]+)?$/

/**
 * 一个 class token 是不是「聚焦态暖色描边」。是 ⇒ 返回本体档名,否 ⇒ null。
 * 按 `:` 切段线性判定。**不得**改回一条带 `(?:…*:)*` 的正则:嵌套量词在长 class 串上灾难性
 * 回溯,实测把全量档从秒级拖到 7 分钟跑不完(判据慢到没人肯跑 = 等同于没有判据)。
 */
export function warmFocusClassOf(token) {
  const t = String(token).trim()
  if (!t.includes(':')) return null
  const parts = t.split(':')
  const base = parts.pop()
  if (!TW_WARM_BORDER_CLASS.test(base)) return null
  return parts.some((p) => TW_FOCUS_VARIANT.test(p)) ? base : null
}

/** RN / inline style 的描边键。 */
const RN_BORDER_KEY_RE =
  /\b(?:border(?:Top|Bottom|Left|Right)?Color|outlineColor|shadowColor)\s*:\s*([^,\n}]+)/g

/** 文本输入控件开标签;复选框/单选框/滑块等非文本型不算"输入框"。 */
const TEXT_INPUT_TAG_RE = /<(?:input|textarea|TextInput)\b/
const NON_TEXT_INPUT_TYPE_RE =
  /type=["'](?:checkbox|radio|range|color|file|submit|button|reset|hidden)["']/
/** 能承载"输入框外框"的容器开标签。 */
const CONTAINER_OPEN_RE =
  /^\s*<(?:div|label|View|section|form|fieldset|Pressable|TouchableOpacity|KeyboardAvoidingView)\b/
/** 不带 variant 的暖色描边档本体。 */
const BARE_WARM_BORDER_CLASS =
  /^(?:border|ring|outline|divide|shadow)-(?:amber|orange|yellow)-\d{2,3}(?:\/\d{1,3})?$/

/**
 * 输入控件所在的**紧邻容器**是否带暖色描边 —— 与聚焦态并列的第二条暖环通道。
 *
 * 立因(2026-10-21 实测):`local-folder-picker` 的编辑态容器是常驻
 * `ring-1 ring-amber-500/30`,与聚焦完全无关;只判聚焦态会漏掉整族"框上永远有一圈橙"。
 *
 * 两条收窄都是为了不造假阳:只认容器开标签,且向上最多 2 行 —— 再远就是兄弟元素
 * (checkin 页距离 6/12 行那两处暖色徽章实测无关,放宽射程当场误咬)。
 */
export function scanWarmInputChrome(cleanText) {
  const lines = String(cleanText).split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (!TEXT_INPUT_TAG_RE.test(lines[i])) continue
    // `type=` 常被 prettier 折到下一行(<input 独占一行),只看本行会把复选框误认成输入框
    if (NON_TEXT_INPUT_TYPE_RE.test(`${lines[i]}\n${lines[i + 1] ?? ''}`)) continue
    for (let k = i; k >= Math.max(0, i - 2); k--) {
      if (k !== i && !CONTAINER_OPEN_RE.test(lines[k])) continue
      for (const token of lines[k].split(/[\s"'`,;)(\]]+/)) {
        if (BARE_WARM_BORDER_CLASS.test(token))
          hits.push({ line: k + 1, rule: 'W1-input', text: token.slice(0, 120) })
      }
    }
  }
  return hits
}

/**
 * 选择器指向"文本输入控件或其包装容器"的形态:元素选择器 input/textarea/select,
 * 或类名/id 里带 input|textarea|searchbox|search-box|search-field|field 这一族。
 * 刻意不收裸 `search` —— `.search-results`/`.search-panel` 是结果区不是输入框,
 * 收进来等于把 §12e 的恒红门往自己家里搬。
 */
const CSS_INPUT_SELECTOR_RE =
  /(?:^|[\s,>+~])(?:input|textarea|select)(?![\w-])|[.#][\w-]*(?:input|textarea|searchbox|search-box|search-field|field)(?![\w-])/i

/** 聚焦态的 CSS 伪类(选择器含它 ⇒ 该块内描边属"激活态描边"这一例外位)。 */
const CSS_FOCUS_PSEUDO_RE = /:focus(?:-within|-visible)?\b/

/**
 * 找出"选择器带 :focus* 的声明块"字符区间(扁平块,够用:本仓输入壳四态就是这么写的)。
 * 返回 [[startInclusive, endExclusive), …];区间不含大括号本身。
 * **只对样式文件调用** —— 拿它扫 TS 源码会把每个 `{}` 当 CSS 块,又慢又是误判源。
 */
export function focusRuleRanges(cleanText) {
  const t = String(cleanText)
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(t)) !== null) {
    if (!CSS_FOCUS_PSEUDO_RE.test(m[1])) continue
    const bodyStart = m.index + m[1].length + 1
    out.push([bodyStart, bodyStart + m[2].length])
  }
  return out
}

/**
 * 找出"选择器命中输入控件"的声明块区间 —— 与 `focusRuleRanges` 同族,但**不要求 :focus**。
 * 立因(2026-10-21 四路审计实测):`.input`/`.bfc-input`/`textarea` 这类真实输入选择器存在,
 * 而它们的描边若写成暖色,只判聚焦态的 W1-css 结构上看不见 —— 盲区补在判据里,不等出事。
 * 现读存量 0(该审计逐条比过 7 处样式文件常驻暖描边,落点全是会员卡/按钮/色条/投影)。
 */
export function inputRuleRanges(cleanText) {
  const t = String(cleanText)
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(t)) !== null) {
    if (!CSS_INPUT_SELECTOR_RE.test(m[1])) continue
    const bodyStart = m.index + m[1].length + 1
    out.push([bodyStart, bodyStart + m[2].length])
  }
  return out
}

/** 行内是否有聚焦态信号(RN 的 `focused ? {` 三元、onFocus 记账)。 */
function hasFocusSignal(line) {
  return /\bfocus/i.test(line)
}

/** 字符偏移 → 1-based 行号(线性,不 split 全文)。 */
function lineAt(s, idx) {
  let n = 1
  for (let i = 0; i < idx; i++) if (s.charCodeAt(i) === 10) n++
  return n
}

/**
 * 对一个样式/组件源跑 W1 → [{line, rule, text}]。
 * **射程 = 聚焦态描边**:注释先遮(maskComments),字符串仍读得到。
 * @param opts.css 该文件是否样式文件 ⇒ 走 CSS 块解析;否则走 class token + RN style 解析。
 * 刻意不判非聚焦的暖色边框 —— 那是警告横幅(callout)的设计档
 * (`border-amber-500/30` + `bg-amber-500/10` + `text-amber-700` 成套),HEAD 面实测 100+ 处,
 * 把它们算成本门缺陷就是 §12e 禁的恒红门,且"改光它们"是重新设计而不是修 bug。
 */
export function scanWarmBorderText(text, { css = false } = {}) {
  const clean = maskComments(String(text))
  const hits = []
  if (css) {
    const seen = new Set()
    const scanRanges = (ranges, rule) => {
      for (const [a, b] of ranges) {
        const startLine = lineAt(clean, a)
        clean
          .slice(a, b)
          .split('\n')
          .forEach((l, k) => {
            for (const m of l.matchAll(CSS_BORDER_PROP_RE)) {
              if (!hasWarmColor(m[2])) continue
              const text = m[0].trim().slice(0, 120)
              // 同一行同一声明只记一次:选择器既带 :focus 又命中输入类时两档都会抓到它
              const key = `${startLine + k}|${text}`
              if (seen.has(key)) continue
              seen.add(key)
              hits.push({ line: startLine + k, rule, text })
            }
          })
      }
    }
    scanRanges(focusRuleRanges(clean), 'W1-css')
    scanRanges(inputRuleRanges(clean), 'W1-css-input')
    return hits
  }
  clean.split('\n').forEach((line, i) => {
    for (const token of line.split(/[\s"'`,;)(\]]+/)) {
      if (warmFocusClassOf(token))
        hits.push({ line: i + 1, rule: 'W1-tw', text: token.slice(0, 120) })
    }
    if (!hasFocusSignal(line)) return
    for (const m of line.matchAll(RN_BORDER_KEY_RE)) {
      if (hasWarmColor(m[1]))
        hits.push({ line: i + 1, rule: 'W1-rn', text: m[0].trim().slice(0, 120) })
    }
  })
  hits.push(...scanWarmInputChrome(clean))
  return hits
}

const NATIVE_TEXTFIELD_RE =
  /@(?:drawable|color)\/(?:abc_)?textfield_(?:activated|default|focused|highlight)\w*/g

/**
 * 遮 XML 注释(逐字符等长 ⇒ 行号不漂)。`code-mask` 只覆盖 JS/CSS 方言,不管 xml;
 * 而本门必须遮它 —— 修复件 `rn_edit_text_material.xml` 的头注正是要写明"不得再引用
 * `abc_textfield_activated_mtrl_alpha`",不遮注释就等于自己咬自己(横向口径:注释里的举例不算实现)。
 */
export function maskXmlComments(text) {
  return String(text).replace(/<!--[\s\S]*?(?:-->|$)/g, (m) => m.replace(/[^\n]/g, ' '))
}

/** 对一份 res xml 跑 W2。 */
export function scanNativeTextfieldText(text) {
  const hits = []
  maskXmlComments(text)
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(NATIVE_TEXTFIELD_RE)) {
        hits.push({ line: i + 1, rule: 'W2', text: m[0] })
      }
    })
  return hits
}

/**
 * 判 **prebuild 生成源**(plugin 正文)—— 提交链上唯一真正能判到的原生真相。
 * 四条腿:① 不得再引用原生 textfield 9-patch;② 必须生成恒透明件;
 * ③ 两个强调色属性必须显式钉;④ 被钉的墨值必须中性,且明暗两档都得在(只写一档 ⇒ 暗档回落系统色)。
 */
export function auditPluginChromeSource(text) {
  const src = String(text)
  const hits = []
  const lineOf = (idx) => {
    let n = 1
    for (let i = 0; i < idx; i++) if (src.charCodeAt(i) === 10) n++
    return n
  }
  for (const m of src.matchAll(NATIVE_TEXTFIELD_RE)) {
    hits.push({ line: lineOf(m.index), rule: 'W2', text: `生成源里出现原生 textfield 9-patch:${m[0]}` })
  }
  if (!/@android:color\/transparent/.test(src)) {
    hits.push({ line: 1, rule: 'W2', text: '生成源未产出恒透明的输入框背景件 ⇒ 原生描边回潮' })
  }
  for (const attr of ACCENT_ATTRS) {
    if (!new RegExp(`['"\`]${attr}['"\`]`).test(src)) {
      hits.push({ line: 1, rule: 'W3', text: `生成源未钉 ${attr} ⇒ colorControlActivated 回落系统强调色` })
    }
  }
  const inkDefs = [...src.matchAll(/accent_ink\s*:\s*['"]([^'"]+)['"]/g)]
  if (inkDefs.length === 0) {
    hits.push({ line: 1, rule: 'W3', text: '生成源里找不到 accent_ink 的色值定义 ⇒ 无法证明强调色中性(不判绿)' })
  } else {
    if (inkDefs.length < 2) {
      hits.push({ line: lineOf(inkDefs[0].index), rule: 'W3', text: `accent_ink 只定义了 ${inkDefs.length} 档 ⇒ 缺明或暗其中一档会回落系统色` })
    }
    for (const d of inkDefs) {
      if (!isNeutralArgb(d[1]))
        hits.push({ line: lineOf(d.index), rule: 'W3', text: `accent_ink 取了 ${d[1]}(非中性灰阶)` })
    }
  }
  return hits
}

/**
 * 集合级判据:plugin 的 W2/W3 **不按单文件判** —— 谁负责输入框 chrome 是"责任分配"问题,
 * 不是"每个 plugin 都得写一遍"。实测把单文件判据套到全部 plugin 上,withSplash/withWechat
 * 等 5 枚无关 plugin 各挨 4 条假红(2026-10-20 首跑现读)。
 * 身份凭据取 `editTextBackground`(谁声明管这个,就判谁),不靠文件名猜。
 * @param entries [{rel, text}] 射程内全部 plugin 正文
 */
export function auditPluginChromeSet(entries) {
  const list = Array.isArray(entries) ? entries : []
  const owners = list.filter((e) => /editTextBackground|rn_edit_text_material/.test(String(e.text)))
  if (owners.length === 0) {
    return [
      {
        // 归属必须记在**集合标识**上,不能记在 list[0] 那个文件头上 ——
        // 差值棘轮按文件锚点,记错文件等于让一枚无关提交替"整块缺失"挨红。
        file: 'apps/mobile-rn/plugins(集合)',
        line: 1,
        rule: 'W2',
        text: '没有任何生成源负责输入框背景 ⇒ RN 模板那圈原生 9-patch 描边无人拦(整块缺失也是红)',
      },
    ]
  }
  const out = []
  for (const o of owners) {
    for (const h of auditPluginChromeSource(o.text)) out.push({ ...h, file: o.rel })
  }
  return out
}

/**
 * W4:plugin 源必须**可被 git 跟踪**。
 * 根 `.gitignore` 有一条全局 `*.cjs`,而 Expo plugin 就叫 `*.cjs` —— 2026-10-20 实测:
 * 写完 withNativeInputChrome.cjs 后 `git status` 一个字节都不显示,`git ls-files --others`
 * 也空。被忽略的 plugin 等于原生层修复**根本没进仓**,下次 prebuild 照旧洗回模板原件。
 * 判据只认"最终生效的那条规则是不是反向豁免(`!` 开头)",不认"文件存在就算数"。
 * @param rels 射程内 plugin 路径
 * @param ignoredMap check-ignore -v 解析出的 pathname → 生效规则串
 */
export function auditPluginTrackable(rels, ignoredMap) {
  const hits = []
  for (const rel of rels) {
    const rule = ignoredMap.get(rel)
    if (!rule) continue
    const pattern = rule.split(':').slice(2).join(':')
    if (pattern.startsWith('!')) continue
    hits.push({
      file: rel,
      line: 1,
      rule: 'W4',
      text: `被 .gitignore 的 "${pattern}" 吞掉 ⇒ 原生定制源进不了仓(修了等于没修)`,
    })
  }
  return hits
}

/** 解析 `git check-ignore -v` 输出 → Map<pathname, "source:LINE:pattern">。 */
export function parseCheckIgnoreLines(out) {
  const map = new Map()
  for (const line of String(out ?? '').split('\n')) {
    const t = line.trim()
    if (!t) continue
    const tabs = t.split('\t')
    if (tabs.length < 2) continue
    map.set(tabs[tabs.length - 1], tabs[0])
  }
  return map
}

/** 解析 values 各限定符档的 colors.xml → Map<name, value>。 */
export function parseAndroidColorsXml(text) {
  const out = new Map()
  for (const m of String(text).matchAll(/<color\s+name="([^"]+)"\s*>\s*([^<]+?)\s*<\/color>/g)) {
    out.set(m[1], m[2].trim())
  }
  return out
}

/** 中性(灰阶,含带 alpha 的灰阶/透明)⇒ 可作强调色;含色相 ⇒ 不可。 */
export function isNeutralArgb(value) {
  const v = String(value).trim()
  if (/^@(?:android:)?color\/transparent$/i.test(v)) return true
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return isNeutralArgb(`#${v.slice(3)}`) // 剥 2 位 alpha('#AARRGGBB'→'#RRGGBB')
  const rgb = parseHexRgb(v)
  if (!rgb) return false
  const [r, g, b] = rgb
  return Math.abs(r - g) <= 8 && Math.abs(g - b) <= 8
}

const ACCENT_ATTRS = ['colorAccent', 'colorControlActivated']

/**
 * 对一份 values 限定符档的 styles.xml 跑 W3。
 * @param stylesText styles.xml 正文
 * @param colorsMap  同面 colors.xml(基础档 + 该资源限定符档)合并出的 name→value
 * @param colorsAvailable colors.xml 是否真的取到了;false ⇒ 返回 W3-undetermined 条目(不判绿)
 * @returns 命中数组;文件里没有 *AppTheme* ⇒ null(不在射程)
 */
export function scanAndroidThemeText(stylesText, colorsMap, colorsAvailable = true) {
  const text = maskXmlComments(stylesText)
  const hits = []
  const styleRe = /<style\b[^>]*?name="([^"]*AppTheme[^"]*)"[^>]*?(?:\/>|>([\s\S]*?)<\/style>)/gi
  const lineOf = (idx) => text.slice(0, idx).split('\n').length
  let s
  let saw = false
  while ((s = styleRe.exec(text)) !== null) {
    saw = true
    // 自闭合的 AppTheme(`<style name="AppTheme" parent="X"/>`)是合法写法,且它**什么都没钉**
    // ⇒ 正是①的成因型,必须命中 W3;body 取空串而不是跳过整条。
    const [, name, inner] = s
    const body = inner ?? ''
    for (const attr of ACCENT_ATTRS) {
      const m = new RegExp(
        `<item\\s+name="(?:android:)?${attr}"\\s*>\\s*([^<]+?)\\s*</item>`,
        'i',
      ).exec(body)
      if (!m) {
        hits.push({
          line: lineOf(s.index),
          rule: 'W3',
          text: `${name} 未声明 ${attr} ⇒ colorControlActivated 回落系统强调色(HyperOS 实测橙)`,
        })
        continue
      }
      if (!colorsAvailable) {
        hits.push({
          line: lineOf(s.index),
          rule: 'W3-undetermined',
          text: `${name} 的 ${attr} 指向 ${m[1]},但同面取不到 colors.xml ⇒ 无法判定取值`,
        })
        continue
      }
      const ref = /^@(?:android:)?color\/([A-Za-z0-9_]+)$/.exec(m[1])
      const value = ref ? colorsMap.get(ref[1]) : m[1]
      if (value === undefined) {
        hits.push({
          line: lineOf(s.index),
          rule: 'W3',
          text: `${attr} 引用的 @color/${ref ? ref[1] : m[1]} 在同面 colors.xml 里不存在`,
        })
      } else if (!isNeutralArgb(value)) {
        hits.push({
          line: lineOf(s.index),
          rule: 'W3',
          text: `${attr} 取 ${value}(非中性灰阶)⇒ 会渗进光标/选中句柄/ripple/输入框描边`,
        })
      }
    }
  }
  return saw ? hits : null
}

/** 一份 styles.xml 需要哪些 colors.xml 作为输入(同面预取用)。 */
export function colorsInputsOf(stylesRel) {
  const m = /^(apps\/[^/]+\/android\/app\/src\/([^/]+)\/res)\/(values[^/]*)\/styles\.xml$/.exec(stylesRel)
  if (!m) return []
  const [, resRoot] = m
  const base = `${resRoot}/values/colors.xml`
  const qualifier = m[3]
  return qualifier === 'values' ? [base] : [base, `${resRoot}/${qualifier}/colors.xml`]
}

/** 豁免台账形状判据:坏 ⇒ error(调用方必须 exit 2,不得当"无豁免"继续)。 */
export function loadExemptions(raw) {
  if (typeof raw !== 'string') return { rows: [], error: '台账读不到' }
  let parsed
  try {
    parsed = JSON.parse(raw.replace(/^﻿/, ''))
  } catch (e) {
    return { rows: [], error: `JSON 解析失败:${e.message}` }
  }
  if (!Array.isArray(parsed?.exemptions)) return { rows: [], error: '缺 exemptions 数组' }
  return { rows: parsed.exemptions, error: null }
}

/** 命中所属判据族(W1-css/W1-tw/W1-rn 都算 W1)。 */
export function ruleFamily(rule) {
  return String(rule).startsWith('W1') ? 'W1' : String(rule)
}

/**
 * 套具名到期台账。未到期 ⇒ 摘除;到期 / until 不可解析 ⇒ 回队列并点名(§0.7"验过才免"会到期)。
 * @param hits [{file, rule, ...}]
 */
export function applyExemptions(hits, rows, now = new Date()) {
  const kept = []
  const expiredOrBroken = []
  for (const h of hits) {
    const fam = ruleFamily(h.rule)
    const row = rows.find((e) => e && e.file === h.file && (e.rule === '*' || e.rule === fam))
    if (!row) {
      kept.push(h)
      continue
    }
    const until = new Date(row.until)
    if (Number.isNaN(until.getTime())) {
      kept.push(h)
      expiredOrBroken.push({ row, reason: 'until 不可解析' })
    } else if (until < now) {
      kept.push(h)
      expiredOrBroken.push({ row, reason: `已到期 ${row.until}` })
    }
  }
  return { kept, expiredOrBroken }
}

/**
 * 差值棘轮:锚点 = 该文件 HEAD 自身命中数(§0.5)。只报"本次加回来的"那几处。
 * @param current Map<rel, hits[]> 被审面
 * @param headCounts Map<rel, number>
 */
export function ratchetDiff(current, headCounts) {
  const out = []
  for (const [rel, hits] of current) {
    const anchor = headCounts.get(rel) ?? 0
    if (hits.length > anchor) out.push({ file: rel, hits: hits.slice(anchor) })
  }
  return out
}

// ══════════════════════ 面取材 ══════════════════════

export function isInScope(rel) {
  if (RN_PLUGIN_RE.test(rel)) return true
  if (ANDROID_RES_RE.test(rel)) return !ANDROID_EXCLUDE.test(rel)
  return STYLE_EXT.test(rel) && !STYLE_EXCLUDE.test(rel) && STYLE_SCOPES.some((s) => rel.startsWith(`${s}/`))
}

/**
 * 射程内枚举到 0 件时的判定。
 * - staged:本枚提交不涉及本门射程 ⇒ `not-applicable`(通过,不是"判据没跑到东西")。
 *   缺这一档时,任何只动射程外文件的提交都被 exit 2 拦住 ⇒ §12e 恒红门。
 * - head / worktree:这两个面必然含射程内文件,枚举为 0 只可能是取材本身坏了 ⇒ `undetermined`。
 * @param {'head'|'staged'|'worktree'} face
 * @returns {'not-applicable'|'undetermined'}
 */
export function judgeEmptyScope(face) {
  return face === 'staged' ? 'not-applicable' : 'undetermined'
}

/** 盘上 android res 的 xml(生成物,不在任何 git 面;只供 --worktree 人工档验当前形态)。 */
function listGeneratedAndroidRes() {
  const out = []
  for (const appDir of ['apps/mobile-rn', 'apps/mobile-cap']) {
    const resRoot = join(root, appDir, 'android', 'app', 'src', 'main', 'res')
    if (!existsSync(resRoot)) continue
    for (const dir of readdirSync(resRoot)) {
      if (dir !== 'drawable' && !/^values/.test(dir)) continue
      const full = join(resRoot, dir)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (!st.isDirectory()) continue
      for (const f of readdirSync(full)) {
        if (f.endsWith('.xml')) out.push(`${appDir}/android/app/src/main/res/${dir}/${f}`)
      }
    }
  }
  return out
}

function listFacePaths(face, revOid = '') {
  const split = (out) => out.split('\n').map((s) => s.trim()).filter(Boolean)
  if (face === 'staged') return split(gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], root))
  if (face === 'rev') return split(gitRaw(['ls-tree', '-r', '--name-only', revOid], root))
  if (face === 'worktree') {
    // ls-files 只给已跟踪件 —— 新写的 plugin 在 git add 之前不在其中,会被判成"无人负责"假红
    // (2026-10-20 首跑实测咬到这一型)。按目录补一次未跟踪件。
    const tracked = split(gitRaw(['ls-files'], root))
    const others = split(gitRaw(['ls-files', '--others', '--exclude-standard', '--', 'apps/mobile-rn/plugins'], root))
    return [...tracked, ...others, ...listGeneratedAndroidRes()]
  }
  return split(gitRaw(['ls-tree', '-r', '--name-only', 'HEAD'], root))
}

/**
 * 按面预取「被审件 ∪ 它们的输入」→ Map<rel, text|null>。
 * 输入与被审件同面同批(见头注:否则"同时改 styles.xml + colors.xml"必假红)。
 */
function prefetch(face, only = null, revOid = '') {
  const primary = [
    ...new Set(
      listFacePaths(face, revOid)
        .filter(isInScope)
        .filter((p) => !only || only.has(p)),
    ),
  ]
  const inputs = [...new Set(primary.flatMap((p) => (THEME_STYLES_RE.test(p) ? colorsInputsOf(p) : [])))]
  const all = [...new Set([...primary, ...inputs])]
  if (all.length === 0) return { texts: new Map(), primary, inputs }
  if (face === 'worktree') {
    const texts = new Map()
    for (const rel of all) texts.set(rel, readWorktreeFile(root, rel))
    return { texts, primary, inputs }
  }
  const rev = face === 'staged' ? '' : face === 'rev' ? revOid : 'HEAD'
  const specs = all.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: 120000 })
  const texts = new Map()
  all.forEach((rel, i) => texts.set(rel, got.get(specs[i]) ?? null))
  // staged 面:本次未暂存的输入(colors.xml)回落 HEAD 那一份 —— 仍是"同一枚提交的输入",
  // 不是"回落另一个面判被审件";被审件取不到照旧 Undetermined。
  if (face === 'staged') {
    const missing = inputs.filter((p) => texts.get(p) === null)
    if (missing.length > 0) {
      const back = catBatch(root, missing.map((p) => `HEAD:${p}`), { maxBuffer: 1 << 29, timeout: 120000 })
      for (const p of missing) texts.set(p, back.get(`HEAD:${p}`) ?? null)
    }
  }
  return { texts, primary, inputs }
}

/** W5 的真相源:共享基础样式(web / extension 直接 @import,小程序走派生副本)。 */
const ACCENT_BASE_REL = 'packages/design-tokens/src/styles/base.css'
/** 会被宿主上色的原生表单控件 —— 少钉一枚,那一枚就回落系统强调色。 */
const ACCENT_CONTROL_SELECTORS = ["input[type='checkbox']", "input[type='radio']", "input[type='range']", 'progress']

/**
 * W5 原生表单控件的选中色必须钉死 —— 与 W3 同型,只是宿主从 AppCompat 换成浏览器/WebView2。
 *
 * 为什么单列一维:W1/W2/W3 判的都是"**写了**暖色",而这一族的病是**什么都没写** ——
 * `accent-color` 初值是 `auto`,由宿主决定:Chromium 在 Windows 上取「设置→个人化→配色→
 * 强调色」,那是用户机器上的任意色,完全可以是橙。2026-10-21 实测:全仓 `accent-color`
 * 声明 0 处,而裸原生 `type=checkbox|radio|range` 控件有 31 个文件在用。
 *
 * 取不到 base.css ⇒ 未判定(不判绿);缺选择器 / 块内无声明 / 取了暖色 ⇒ 命中。
 */
export function scanAccentColorRule(text) {
  if (typeof text !== 'string')
    return [{ line: 1, rule: 'W5-undetermined', text: `${ACCENT_BASE_REL} 取不到 ⇒ 无法判定(不判绿)` }]
  const clean = maskComments(String(text))
  const hits = []
  for (const sel of ACCENT_CONTROL_SELECTORS) {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = new RegExp(`${esc}[^{}]*\\{([^{}]*)\\}`, 's').exec(clean)
    if (!m) {
      hits.push({ line: 1, rule: 'W5', text: `${sel} 未钉 accent-color ⇒ 回落宿主系统强调色` })
      continue
    }
    const decl = /accent-color\s*:\s*([^;]+)/.exec(m[1])
    if (!decl) hits.push({ line: 1, rule: 'W5', text: `${sel} 的声明块里没有 accent-color 声明` })
    else if (hasWarmColor(decl[1]))
      hits.push({ line: 1, rule: 'W5', text: `${sel} 的 accent-color 取了暖色:${decl[1].trim()}` })
  }
  return hits
}

/** "未判定"档规则名(§0.3:既不记绿也不冒红)—— W3 取不到 colors.xml / W5 取不到 base.css。 */
const UNDETERMINED_RE = /^W[35]-undetermined$/

/**
 * 廉价预筛:正文里连一个暖色源 token 都没有 ⇒ W1 结构上不可能命中,跳过遮罩与三组正则。
 * (实测不加这一层,全量档要跑 5 分钟以上 —— 判据慢到没人肯跑,等同于没有判据。)
 * 只对 W1 生效:xml 的 W2/W3 判的是 drawable 名与主题属性,与暖色 token 无关。
 */
const WARM_PRESCREEN_RE = /(?:amber|orange|yellow|warning)|#[0-9a-fA-F]{3}|rgba?\(/i

/** 对单个被审件跑三条判据 → hits[](空数组 = 该件干净)。 */
export function scanOne(rel, text, texts) {
  if (typeof text !== 'string') return []
  if (RN_PLUGIN_RE.test(rel)) return [] // 交给集合级 auditPluginChromeSet(见其注释)
  if (STYLE_EXT.test(rel) && !ANDROID_RES_RE.test(rel)) {
    if (!WARM_PRESCREEN_RE.test(text)) return []
    return scanWarmBorderText(text, { css: /\.(css|scss|less|wxss)$/.test(rel) })
  }
  const hits = scanNativeTextfieldText(text)
  if (THEME_STYLES_RE.test(rel)) {
    const merged = new Map()
    let available = true
    for (const input of colorsInputsOf(rel)) {
      const t = texts.get(input)
      if (typeof t === 'string') {
        for (const [k, v] of parseAndroidColorsXml(t)) merged.set(k, v)
      } else if (input.endsWith('/values/colors.xml')) {
        available = false
      }
    }
    const r = scanAndroidThemeText(text, merged, available)
    if (r) hits.push(...r)
  }
  return hits
}

/**
 * 汇总一个面的全部命中。plugin 的 W2/W3 走集合级(见 auditPluginChromeSet 注释)。
 * @param subset 被审面是子集(--staged / HEAD 锚点)⇒ 不判"整块无人负责",
 *               因为子集证明不了全集没有(与门 218 对 RULE-2 的子集口径同取向)。
 */
function collectHits(primary, texts, { subset = false } = {}) {
  const flat = []
  for (const rel of primary) flat.push(...scanOne(rel, texts.get(rel), texts).map((h) => ({ ...h, file: rel })))
  const plugins = primary
    .filter((p) => RN_PLUGIN_RE.test(p))
    .map((rel) => ({ rel, text: texts.get(rel) ?? '' }))
  if (subset) {
    for (const o of plugins) {
      if (!/editTextBackground|rn_edit_text_material/.test(o.text)) continue
      flat.push(...auditPluginChromeSource(o.text).map((h) => ({ ...h, file: o.rel })))
    }
  } else {
    flat.push(...auditPluginChromeSet(plugins))
  }
  // W5 定向审一份真相源(与 W4 同族:"必须存在"型判据不能靠枚举被审件 —— 它缺的时候
  // 枚举到的是"什么都没有",而不是"有一个坏东西")。子集档只在本次真的动了 base.css 时判:
  // 否则一个没碰过它的提交会被它拦住,那正是 §12e 禁的恒红门。
  if (!subset || primary.includes(ACCENT_BASE_REL))
    flat.push(...scanAccentColorRule(texts.get(ACCENT_BASE_REL)).map((h) => ({ ...h, file: ACCENT_BASE_REL })))
  return flat
}

// ══════════════════════ self-test ══════════════════════

function runSelfTest() {
  const fails = []
  const ok = (c, m) => {
    if (!c) fails.push(m)
  }

  // ── 组 1 暖色尺:阳性 + 反向对照同批 ──
  ok(isWarmRgb(0xf5, 0x9e, 0x0b), '#f59e0b 琥珀必须判暖')
  ok(isWarmRgb(0xff, 0xa5, 0x00), '#ffa500 橙必须判暖')
  ok(isWarmRgb(0xe5, 0x97, 0x00), '实测事故色 #E59700 必须判暖')
  ok(isWarmRgb(0xfb, 0xbf, 0x24), '#fbbf24 黄必须判暖')
  ok(!isWarmRgb(0xef, 0x44, 0x44), '红 #ef4444 不得判暖(本门只管橙系)')
  ok(!isWarmRgb(0xff, 0x40, 0x81), 'AppCompat 粉 #FF4081 不得判暖')
  ok(!isWarmRgb(0x00, 0x00, 0x00), '墨档不得判暖')
  ok(!isWarmRgb(0xff, 0xff, 0xff), '白不得判暖')
  ok(!isWarmRgb(0x3b, 0x82, 0xf6), '蓝不得判暖')
  ok(!isWarmRgb(0x6b, 0x72, 0x14), '深橄榄(R<90 之外的暗暖)不得判暖')
  ok(parseHexRgb('#abc')?.join() === '170,187,204', '#3 位 hex 必须展开')
  ok(parseHexRgb('#ff00') === null, '4 位 hex 不认(不猜色)')
  ok(parseHexRgb('#1234567') === null, '7 位 hex 不认')

  // ── 组 2 W1 三轴:**只判聚焦态**;警告横幅/底色/文字一律不判 ──
  const css = (t) => scanWarmBorderText(t, { css: true })
  ok(css('.a:focus-within{ border-color: var(--color-amber-500); }').some((x) => x.rule === 'W1-css'), '聚焦块内 border-color 取 amber 必命中')
  ok(css('.a:focus{ outline-color: #ffa500; }').some((x) => x.rule === 'W1-css'), ':focus 的 outline 取暖色必命中')
  ok(css('.a:focus-visible{ box-shadow: 0 0 0 1px rgba(245,158,11,0.08); }').some((x) => x.rule === 'W1-css'), '聚焦块内描边型 box-shadow 取暖色必命中')
  ok(css('.a{ border-color: var(--color-amber-500); }').length === 0, '非聚焦块的暖色描边不在本门射程(警告横幅档)')
  ok(css('.a{ background-color: #f59e0b; color: #ffa500; }').length === 0, '底色/文字取暖色不得命中')
  ok(css('.a{ border-radius: 8px; border-width: 1px; border-style: solid; }').length === 0, 'radius/width/style 不是描边色轴')
  ok(css('.a:focus{ border: 1px solid #ffa500; }').some((x) => x.rule === 'W1-css'), '聚焦块内 border 简写取暖色必命中')
  ok(css('.a{ box-shadow: 0 1px 2px rgba(0,0,0,0.05); }').length === 0, '中性阴影不得命中')
  ok(css('@media (min-width:1px){ .a:focus{ border-color:#ffa500 } }').some((x) => x.rule === 'W1-css'), '嵌套在 @media 里的聚焦块仍要抓到')
  ok(css('.a:focus{ border-color: var(--color-primary); }').length === 0, '聚焦墨档描边是合法例外位,不得命中')
  ok(css('textarea{ border-color: #f59e0b; }').some((x) => x.rule === 'W1-css-input'), 'textarea 元素选择器的常驻暖描边必命中(无 :focus 也判)')
  ok(css('.search-box input{ outline: 2px solid orange; }').some((x) => x.rule === 'W1-css-input'), '输入类里的 input 元素选择器必命中')
  ok(css('.bfc-input{ border: 1rpx solid var(--color-warning); }').some((x) => x.rule === 'W1-css-input'), '类名带 -input 的包装容器必命中')
  ok(css('.search-results{ border-color: #f59e0b; }').length === 0, '结果区不是输入框,不得命中(收进裸 search 就会误咬)')
  ok(css('.member-cta-outlined{ border: 2rpx solid #ffd700; }').length === 0, '按钮描边不在本维射程(实测该型 7 处全落在卡片/按钮/色条)')
  ok(scanWarmBorderText('c="focus-visible:ring-amber-500/40"').some((x) => x.rule === 'W1-tw'), 'focus-visible:ring-amber 必命中')
  ok(scanWarmBorderText('c="focus:border-orange-500 focus:shadow-amber-900"').filter((x) => x.rule === 'W1-tw').length === 2, '两个聚焦暖色档都要抓到(重数不折半)')
  ok(scanWarmBorderText('c="group-focus:ring-yellow-500 dark:focus:border-amber-200"').filter((x) => x.rule === 'W1-tw').length === 2, 'group-focus 与 dark:focus 复合 variant 都要抓到')
  // 关键反向对照:警告横幅(callout)成套暖色边框 —— 设计意图,不得判缺陷
  ok(scanWarmBorderText('<div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">警告</div>').length === 0, '警告横幅的 border-amber 不得命中(本门只管聚焦态)')
  ok(scanWarmBorderText('c="bg-amber-500 text-amber-600"').length === 0, 'bg-/text- 暖色档不得命中')
  ok(scanWarmBorderText('c="focus-visible:border-primary"').length === 0, '墨档聚焦描边是本门要保护的合法形态,不得命中')
  ok(scanWarmBorderText('c="hover:border-amber-500"').length === 0, 'hover 态暖色边框不在聚焦射程内,不得命中')
  ok(
    scanWarmBorderText('<div className="rounded-lg border ring-1 ring-amber-500/30">\n  <input className="outline-none" />\n</div>').some(
      (x) => x.rule === 'W1-input',
    ),
    '输入框紧邻容器上的常驻暖色环必命中(与聚焦无关的第二条通道)',
  )
  ok(
    scanWarmBorderText('<div className="rounded-md border border-amber-500/30">\n  <input type="checkbox" className="h-4 w-4" />\n</div>').length === 0,
    '复选框所在警示框不得命中(复选框不是输入框外框)',
  )
  ok(
    scanWarmBorderText('<div className="rounded-md border border-amber-500/30">\n  <input\n    type="checkbox"\n    className="h-4 w-4"\n  />\n</div>').length === 0,
    'type= 被 prettier 折到下一行的复选框同样不得命中',
  )
  ok(
    scanWarmBorderText(
      '<span className="border border-amber-500/40">冷却中</span>\n<span>a</span>\n<span>b</span>\n<span>c</span>\n<span>d</span>\n<span>e</span>\n<input className="h-8" />',
    ).length === 0,
    '距离 >2 行的兄弟元素暖色徽章不得算成输入框描边',
  )
  ok(scanWarmBorderText('const s = focused ? { borderColor: tk.warning.DEFAULT } : null').some((x) => x.rule === 'W1-rn'), 'RN 聚焦三元里 borderColor 取 warning 家族必命中')
  ok(scanWarmBorderText('const s = { borderColor: tk.warning.DEFAULT }').length === 0, '无聚焦信号的暖色 borderColor 不在射程(卡片边框档)')
  ok(scanWarmBorderText('const s = { borderColor: tk.border.light }').length === 0, 'RN 中性描边不得命中')

  // ── 组 2b 预筛(scanOne 那一层)不得吃掉真命中 ──
  ok(scanOne('a.css', '.a:focus{ box-shadow: 0 0 0 1px rgba(245,158,11,.08); }', new Map()).length === 1, '预筛不得吃掉只含 rgba 的暖色描边')
  ok(scanOne('a.css', '.a:focus{ border-color: #ffa500; }', new Map()).length === 1, '预筛必须放行 hex 型暖色描边')
  ok(scanOne('a.css', '.a:focus{ box-shadow: 0 1px 2px rgba(0,0,0,.05); }', new Map()).length === 0, '过了预筛的中性阴影仍判绿')
  ok(scanOne('a.css', 'export const x = 1', new Map()).length === 0, '不含任何暖色 token 的文件被预筛跳过')
  ok(scanOne('a.xml', '<item android:drawable="@drawable/textfield_activated_mtrl_alpha"/>', new Map()).length === 1, '预筛只管 W1:xml 的 W2 必须照跑(不被 token 预筛吃掉)')

  // ── 组 3 遮罩方向:注释不算实现,字符串必须仍读得到(两向都在聚焦块内测,排除射程收窄的干扰) ──
  ok(css('.a:focus{\n  /* border-color: #ffa500 */\n}').length === 0, '聚焦块内注释里的暖色描边不得判实现')
  ok(css('.a:focus{\n  // borderColor: "#ffa500" 只是举例\n}').length === 0, '行注释里的暖色描边不得判实现')
  ok(css('.a:focus{\n  border-color: #ffa500\n}').length === 1, '同位置摘掉注释必须翻红(证明遮罩没把判据一起遮死)')
  ok(scanWarmBorderText('const c = "focus:border-amber-500"\n').length > 0, '字符串里的聚焦类名必须仍读得到(阳性对照)')

  // ── 组 4 W2(含 xml 注释遮罩方向)──
  ok(scanNativeTextfieldText('<item android:drawable="@drawable/abc_textfield_activated_mtrl_alpha"/>').some((x) => x.rule === 'W2'), '引用原生 activated textfield 9-patch 必命中 W2')
  ok(scanNativeTextfieldText('<item android:drawable="@android:color/transparent"/>').length === 0, '透明件不得命中 W2(本次修复形态)')
  {
    const commented = '<!-- 不得再引用 @drawable/abc_textfield_activated_mtrl_alpha -->\n<inset><selector><item android:drawable="@android:color/transparent"/></selector></inset>\n'
    ok(scanNativeTextfieldText(commented).length === 0, '注释里点名被禁 drawable 不得算实现')
    ok(scanNativeTextfieldText(`${commented}<item android:drawable="@drawable/textfield_activated_mtrl_alpha"/>`).length === 1, '注释遮罩后真引用必须仍抓到(阳性对照)')
    ok(maskXmlComments('a\nb\n').length === 4 && maskXmlComments('<!--x\ny-->').split('\n').length === 2, '遮罩必须等长保行号')
  }

  // ── 组 5 W3 ──
  {
    const colors = parseAndroidColorsXml('<resources><color name="accent_ink">#000000</color><color name="hot">#ffa500</color></resources>')
    ok(colors.get('accent_ink') === '#000000', 'colors.xml 必须解析出 name→value')
    ok(isNeutralArgb('#000000') && isNeutralArgb('#FFFFFF'), '灰阶算中性')
    ok(isNeutralArgb('#1F000000'), '带 alpha 的黑算中性(ripple 档)')
    ok(!isNeutralArgb('#ffa500'), '橙色不得算中性')
    ok(!isNeutralArgb('red'), '认不出的写法不得算中性(不猜)')
    const unpinned = scanAndroidThemeText('<resources><style name="AppTheme" parent="T"><item name="colorPrimary">#023c69</item></style></resources>', colors)
    ok(unpinned && unpinned.filter((x) => x.rule === 'W3').length === 2, '未钉两个强调 attr 必须各命中一次')
    const pinned = scanAndroidThemeText('<resources><style name="AppTheme"><item name="colorAccent">@color/accent_ink</item><item name="android:colorControlActivated">@color/accent_ink</item></style></resources>', colors)
    ok(pinned && pinned.length === 0, '钉中性墨档必须放行(android: 前缀同认)')
    const colored = scanAndroidThemeText('<resources><style name="AppTheme"><item name="colorAccent">@color/hot</item><item name="colorControlActivated">@color/hot</item></style></resources>', colors)
    ok(colored && colored.length === 2, '强调色钉成橙色必命中')
    const dangling = scanAndroidThemeText('<resources><style name="AppTheme"><item name="colorAccent">@color/ghost</item><item name="colorControlActivated">@color/ghost</item></style></resources>', colors)
    ok(dangling && dangling.length === 2, '引用不存在的颜色必命中(不得判绿)')
    ok(scanAndroidThemeText('<resources><style name="Foo"/></resources>', colors) === null, '无 AppTheme 的文件不在射程')
    ok(scanAndroidThemeText('<style name="AppTheme" parent="T"/>', colors)?.length === 2, '自闭合的 AppTheme(什么都没钉)必须命中,不得静默不判')
    const noColors = scanAndroidThemeText('<resources><style name="AppTheme"><item name="colorAccent">@color/x</item><item name="colorControlActivated">@color/x</item></style></resources>', new Map(), false)
    ok(noColors && noColors.every((x) => x.rule === 'W3-undetermined'), 'colors.xml 取不到 ⇒ 落未判定档,不冒红也不记绿')
    // ── W5:原生表单控件的 accent-color 必须钉死(web / extension / WebView2 腿) ──
    const ACCENT_OK =
      "body{color:red}input[type='checkbox'],input[type='radio'],input[type='range'],progress{accent-color:var(--color-primary)}"
    ok(scanAccentColorRule(ACCENT_OK).length === 0, '四类原生控件全钉住中性 accent-color ⇒ 判绿')
    ok(
      scanAccentColorRule(ACCENT_OK.replace("input[type='range'],", '')).some(
        (x) => x.rule === 'W5' && /range/.test(x.text),
      ),
      '摘掉 range 一档必须当场点名(这一维的牙是"少钉一枚即红",不是"全没钉才红")',
    )
    ok(
      scanAccentColorRule(ACCENT_OK.replace('var(--color-primary)', '#f59e0b')).some(
        (x) => x.rule === 'W5' && /暖色/.test(x.text),
      ),
      'accent-color 取了暖色必命中',
    )
    ok(
      scanAccentColorRule(null).every((x) => x.rule === 'W5-undetermined'),
      'base.css 取不到 ⇒ 落未判定档,不记绿也不冒红',
    )
    ok(
      scanAccentColorRule("input[type='checkbox'],input[type='radio'],input[type='range'],progress{color:red}").filter(
        (x) => x.rule === 'W5',
      ).length === 4,
      '块里没有 accent-color 声明 ⇒ 四档各点名一次(重数不折半)',
    )
  }

  // ── 组 6 输入回落:限定符档 + 基础档都要预取 ──
  {
    const night = colorsInputsOf('apps/mobile-rn/android/app/src/main/res/values-night/styles.xml')
    ok(night.length === 2 && night[0].endsWith('values/colors.xml') && night[1].endsWith('values-night/colors.xml'), '限定符档必须同时取基础 colors 与该档 colors')
    ok(colorsInputsOf('apps/mobile-rn/android/app/src/main/res/values/styles.xml').length === 1, '基础档只取自己')
    ok(colorsInputsOf('apps/web/app/globals.css').length === 0, '非 styles.xml 无输入')
  }
  // scanOne 用构造 texts 证明"同批输入"真的被消费(摘掉合并即翻红)
  {
    const texts = new Map([
      ['apps/x/android/app/src/main/res/values/colors.xml', '<resources><color name="accent_ink">#ffffff</color></resources>'],
    ])
    const clean = scanOne(
      'apps/x/android/app/src/main/res/values-night/styles.xml',
      '<resources><style name="AppTheme"><item name="colorAccent">@color/accent_ink</item><item name="colorControlActivated">@color/accent_ink</item></style></resources>',
      texts,
    )
    ok(clean.length === 0, '基础档 colors 提供 @color/accent_ink ⇒ 夜档 styles 应判绿')
    const broken = scanOne(
      'apps/x/android/app/src/main/res/values-night/styles.xml',
      '<resources><style name="AppTheme"><item name="colorAccent">@color/accent_ink</item><item name="colorControlActivated">@color/accent_ink</item></style></resources>',
      new Map(),
    )
    ok(broken.length === 2, '摘掉输入合并 ⇒ 同一份内容必须翻红(证明合并这步有牙)')
  }

  // ── 组 7 棘轮 ──
  {
    const cur = new Map([['a.css', [{ line: 1 }, { line: 2 }, { line: 3 }]]])
    ok(ratchetDiff(cur, new Map([['a.css', 2]])).length === 1, '加回一处必判红且只报新增')
    ok(ratchetDiff(cur, new Map([['a.css', 3]])).length === 0, '存量持平不得判红(§12e)')
    ok(ratchetDiff(cur, new Map([['a.css', 5]])).length === 0, '存量比本次多 ⇒ 更不得判红')
    ok(ratchetDiff(cur, new Map()).length === 1, 'HEAD 无此文件 ⇒ 锚点 0,新文件带命中必红')
  }

  // ── 组 8 豁免 ──
  {
    const rows = [
      { file: 'a.css', rule: 'W1', until: '2099-01-01' },
      { file: 'b.css', rule: 'W1', until: '2020-01-01' },
      { file: 'c.css', rule: 'W1', until: 'not-a-date' },
      { file: 'd.css', rule: '*', until: '2099-01-01' },
    ]
    const now = new Date('2026-10-20')
    ok(applyExemptions([{ file: 'a.css', rule: 'W1-css' }], rows, now).kept.length === 0, '未到期具名豁免必须生效')
    const r2 = applyExemptions([{ file: 'b.css', rule: 'W1-css' }], rows, now)
    ok(r2.kept.length === 1 && r2.expiredOrBroken.length === 1, '已到期豁免必须回队列')
    const r3 = applyExemptions([{ file: 'c.css', rule: 'W1-tw' }], rows, now)
    ok(r3.kept.length === 1 && r3.expiredOrBroken.length === 1, 'until 不可解析 ⇒ 回队列,不静默放行')
    ok(applyExemptions([{ file: 'd.css', rule: 'W3' }], rows, now).kept.length === 0, 'rule:"*" 覆盖全族')
    ok(applyExemptions([{ file: 'e.css', rule: 'W1-css' }], rows, now).kept.length === 1, '未登记文件不得被豁免吃掉')
    ok(applyExemptions([{ file: 'a.css', rule: 'W2' }], rows, now).kept.length === 1, 'W1 豁免不得串到 W2(不串门)')
    ok(ruleFamily('W1-tw') === 'W1' && ruleFamily('W2') === 'W2', '族归一正确')
  }
  // 台账形状坏 ⇒ 拒绝判定
  ok(loadExemptions('{ not json').error !== null, '坏 JSON 必须报 error')
  ok(loadExemptions('{"foo":1}').error !== null, '缺 exemptions 数组必须报 error')
  ok(loadExemptions('{"exemptions":[]}').error === null, '空台账是合法形态')
  ok(loadExemptions(null).error !== null, '读不到台账必须报 error')

  // ── 组 10 prebuild 生成源判据(**集合级**:责任按声明认,不按文件数摊) ──
  {
    const good = [
      'const T = `<item android:drawable="@android:color/transparent" />`',
      "['android:editTextBackground', '@drawable/rn_edit_text_material'],",
      "['colorAccent', '@color/accent_ink'],",
      "['android:colorAccent', '@color/accent_ink'],",
      "['colorControlActivated', '@color/accent_ink'],",
      "['android:colorControlActivated', '@color/accent_ink'],",
      "values: { accent_ink: '#000000' },",
      "'values-night': { accent_ink: '#FFFFFF' },",
    ].join('\n')
    const E = (rel, text) => ({ rel, text })
    ok(auditPluginChromeSet([E('p/a.cjs', good)]).length === 0, '合规生成源必须判绿')
    // 首跑实测咬到的那一型:5 枚无关 plugin 各挨 4 条假红
    ok(auditPluginChromeSet([E('p/splash.cjs', 'const x = 1'), E('p/wechat.cjs', 'const y = 2'), E('p/chrome.cjs', good)]).length === 0, '无关 plugin 同场不得被误咬')
    const none = auditPluginChromeSet([E('p/splash.cjs', 'const x = 1')])
    ok(none.length === 1 && none[0].rule === 'W2', '全场没人负责输入框背景 ⇒ 必须判红(整块缺失也是红)')
    ok(none[0]?.file === 'apps/mobile-rn/plugins(集合)', '该命中必须记在集合标识上,不得记在某个真实文件头上(否则无关提交替整块缺失挨红)')
    const swapped = good.replace('@android:color/transparent', '@drawable/textfield_activated_mtrl_alpha')
    ok(auditPluginChromeSet([E('p/a.cjs', swapped)]).filter((x) => x.rule === 'W2').length === 2, '换成原生 9-patch 必须同时命中"引用禁件"与"缺透明件"')
    const stripped = good.replace(/'(?:android:)?colorControlActivated'/g, "'otherAttr'")
    ok(auditPluginChromeSet([E('p/a.cjs', stripped)]).some((x) => x.rule === 'W3'), '摘掉 colorControlActivated 两种写法必须命中 W3')
    ok(auditPluginChromeSet([E('p/a.cjs', good.replace('#FFFFFF', '#ffa500'))]).some((x) => x.rule === 'W3'), '暗档墨换成橙色必须命中 W3')
    ok(auditPluginChromeSet([E('p/a.cjs', good.replace("'values-night': { accent_ink: '#FFFFFF' },", ''))]).some((x) => x.rule === 'W3'), '只留一档墨必须命中(缺档那档会回落系统色)')
    ok(scanOne('apps/mobile-rn/plugins/x.cjs', 'const x = 1', new Map()).length === 0, '单文件层不判 plugin(交集合级,否则误咬无关 plugin)')
    ok(isInScope('apps/mobile-rn/plugins/withNativeInputChrome.cjs'), 'plugin 源必须在射程')
    ok(!isInScope('apps/mobile-rn/plugins/notes.md'), 'plugin 目录下的非 cjs 不在射程')
  }

  // ── 组 11 W4:plugin 可跟踪性(被 *.cjs 吞掉 = 修了等于没修) ──
  {
    const m = parseCheckIgnoreLines('.gitignore:238:*.cjs\tapps/mobile-rn/plugins/x.cjs\n')
    ok(m.get('apps/mobile-rn/plugins/x.cjs') === '.gitignore:238:*.cjs', 'check-ignore -v 必须解析出 pathname→生效规则')
    ok(auditPluginTrackable(['apps/mobile-rn/plugins/x.cjs'], m).length === 1, '被 *.cjs 吞掉必须判红')
    const neg = parseCheckIgnoreLines('.gitignore:244:!apps/mobile-rn/plugins/*.cjs\tapps/mobile-rn/plugins/x.cjs\n')
    ok(auditPluginTrackable(['apps/mobile-rn/plugins/x.cjs'], neg).length === 0, '反向豁免在位必须判绿')
    ok(auditPluginTrackable(['a.cjs'], new Map()).length === 0, '未被忽略 ⇒ 绿')
    ok(parseCheckIgnoreLines('').size === 0, '空输出 ⇒ 空表')
    ok(parseCheckIgnoreLines('garbage').size === 0, '无 TAB 的行不得当成命中(不猜)')
    ok(auditPluginTrackable(['a.cjs', 'b.cjs'], m).length === 0, '只对被点名的文件判,不得牵连同批其他件')
  }

  // ── 组 9 射程闸 + 面旗 ──
  {
    ok(isInScope('apps/web/app/globals.css'), 'web 样式在射程')
    ok(isInScope('packages/app/src/components/SearchInput.tsx'), '共享层组件在射程')
    ok(!isInScope('apps/web/dist/globals.css'), 'dist 生成物不在射程')
    ok(!isInScope('apps/mobile-rn/tests/a.test.tsx'), '测试夹具不在射程')
    ok(!isInScope('docs/foo.css'), '文档示例不在射程')
    ok(isInScope('apps/mobile-rn/android/app/src/main/res/values/styles.xml'), 'android res xml 在 W2/W3 射程')
    ok(!isInScope('apps/mobile-rn/android/app/build/intermediates/res/values/styles.xml'), 'build 中间产物不在射程(那是 AOSP 原件副本)')
    ok(!isInScope('README.md'), '非样式非 xml 不在射程')
    const { face: bad, error } = selectFace({ staged: true, worktree: true })
    ok(bad === null && typeof error === 'string', '--staged 与 --worktree 同给必须报错')
    ok(selectFace({}).face === 'head', '缺省面必须是 head(不许默认磁盘)')
    ok(
      judgeEmptyScope('staged') === 'not-applicable',
      'staged 档射程内 0 件 = 本枚提交不涉及(不许对无关提交 exit 2,§12e)',
    )
    ok(judgeEmptyScope('head') === 'undetermined', '全量档射程内 0 件 = 判据没跑到东西')
    ok(judgeEmptyScope('worktree') === 'undetermined', '工作树档射程内 0 件 = 判据没跑到东西')
  }

  if (fails.length > 0) {
    for (const f of fails) console.error(`[SELF-TEST FAIL] ${f}`)
    console.error(`\n❌ 自检失败 ${fails.length} 条`)
    return 1
  }
  console.log(
    '[SELF-TEST OK] 暖色描边守门判据自检通过(组:暖色尺 / W1 四轴(css·css-input·tw·rn)+ 输入容器 / 预筛 / 遮罩方向 / W2 / W3 / W5 accent-color / 生成源集合级 / 输入回落 / 棘轮 / 豁免 / 射程 / W4 可跟踪)',
  )
  return 0
}

// ══════════════════════ CLI ══════════════════════

const argv = process.argv.slice(2)

function main() {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
check-no-warm-border.mjs — 暖色描边禁令守门(2026-10-20)

  W1 暖色描边,四条轴 + 一条容器维:
     W1-css        样式文件里 :focus* 声明块内的描边轴取暖色
     W1-css-input  样式文件里**输入类选择器**(input/textarea/select 元素或类名带 -input 等)
                   的常驻暖描边 —— 不要求 :focus,补"框上永远挂着一圈橙"那一型
     W1-tw         Tailwind 描边类带 focus 族 variant 且取暖色档
     W1-rn         RN/inline 描边键取暖色,且同行有聚焦信号
     W1-input      tsx 里文本输入控件向上 ≤2 行的容器开标签带暖色描边档
  W2 原生输入框描边件(res/**/*.xml 引用 textfield_* 9-patch)
  W3 原生强调色未钉 / 钉成彩色 / 引用不存在的颜色(AppCompat 会回落系统强调色)
  W4 生成源被 .gitignore 吞掉(仅全集档判)
  W5 原生表单控件的 accent-color 未钉(base.css 那份真相源;浏览器/WebView2 会回落
     Windows 个人化强调色 —— 与 W3 同一条"没设≠没色"因果律,只是宿主不同)

刻意不判:底色/文字/图标/图表取暖色;非输入控件的暖色边框(警告横幅 callout 成套档,
HEAD 面实测 90 处)—— 那是语义档,判它等于 §12e 禁的恒红门。

用法:
  node scripts/check-no-warm-border.mjs              # 全量(HEAD 面,只报数)
  node scripts/check-no-warm-border.mjs --staged     # 索引面 + 差值棘轮(提交门禁档)
  node scripts/check-no-warm-border.mjs --worktree   # 磁盘(人工逃生舱)
  node scripts/check-no-warm-border.mjs --rev <tree> --only <a;b;c>
      # 审**将要落盘的那棵树**(命中即红,不给存量豁免)—— 供 object-space-land 当涉事判据:
      # 旁路通道不跑 pre-commit,只活在提交链的门对它等于没装。
  node scripts/check-no-warm-border.mjs --rev <tree> --only <a;b;c> --root <dir>
      # 同上,但显式指定**被审仓根**(G-929:镜像测试把仓指到 mkScratch 临时仓时,
      # 缺省按脚本位置推导会在主仓里问一枚临时仓的树 ⇒ 未判定 ⇒ 落地器误拒)。
      # 不给 --root 时行为与之前逐字相同(生产路径不受影响)。
  node scripts/check-no-warm-border.mjs --self-test  # 判据自检
  node scripts/check-no-warm-border.mjs --json       # 机器可读输出

退出码:0 通过 / 1 BLOCK / 2 无法判定(取不到面、枚举到 0、台账坏 ⇒ 既不记绿也不冒红)
跳过:${SKIP_ENV}=1(不推荐)
`)
    return 0
  }
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⏭ ${SKIP_ENV}=1,跳过暖色描边守门`)
    return 0
  }
  if (argv.includes('--self-test')) return runSelfTest()

  // --root 显式给出但目录不存在 ⇒ 未判定(exit 2)。**不静默回落到自推导** ——
  // 那会把"指错了仓"读成"在主仓审过了",是 fail-open 的一种形态。
  if (rootArg !== '' && !existsSync(root)) {
    console.error(`❌ --root 指定的被审仓目录不存在 ⇒ 未判定(不猜要审哪个仓):${rootArg}`)
    return 2
  }

  // ── 审树档 `--rev <oid> [--only a;b]`:给旁路落地器当涉事判据用 ──
  // 为什么必须有这一档:旁路通道(commit-tree + CAS)**结构上不跑 pre-commit**,
  // 而本仓大量落地走的是它 —— 只活在提交链的内容门对这条通道等于没装
  // (AGENTS:防它必须在它自己的判据源头接)。这一档审的是"将要落盘的那棵树",不是历史。
  // --rev / --only 也走单源:`--rev` 被顶值/结尾无值旧写法会**静默退回 face 档**(旁路落地器
  // 以为在审"将要落盘的那棵树",实际审的是 HEAD/索引);`--only` 被顶值时旧写法把旗标当路径,
  // 收窄集变成一个不存在的路径 ⇒ 0 条 ⇒ 表头照写"只审 1 条"。两支都是"多放一次跳门"方向,判死。
  const revFlag = flagValue(argv, '--rev')
  if (revFlag.present && !revFlag.valid) {
    console.error(`❌ --rev 需要一个 oid —— 紧邻的 token 实得:${describeFlagToken(revFlag)}(不得静默改审别的面)`)
    return 2
  }
  const revOid = revFlag.valid ? String(revFlag.value).trim() : ''
  // 同 --root:空白串能过单源的"非空"层,trim 后与"没给"同形 ⇒ 静默改审 face 档。
  if (revFlag.valid && revOid === '') {
    console.error('❌ --rev 需要一个 oid —— 实得空白串(不得静默改审别的面)')
    return 2
  }
  if (revOid && (argv.includes('--staged') || argv.includes('--worktree'))) {
    console.error('❌ --rev 与 --staged/--worktree 互斥(审树档只认显式给定的那棵树)')
    return 2
  }
  if (revOid && !/^[0-9a-f]{7,40}$/.test(revOid)) {
    console.error(`❌ --rev 取值不是合法 oid ⇒ 未判定(不猜要审哪棵树):${revOid.slice(0, 40)}`)
    return 2
  }
  const onlyFlag = flagValue(argv, '--only')
  if (onlyFlag.present && !onlyFlag.valid) {
    console.error(`❌ --only 需要 a;b 路径清单 —— 紧邻的 token 实得:${describeFlagToken(onlyFlag)}(不得静默改审全树)`)
    return 2
  }
  const only = onlyFlag.valid ? new Set(onlyFlag.value.split(';').map((s) => s.trim()).filter(Boolean)) : null
  // `--only "   "` 会得到一个空集合(truthy),下游只审 0 条还按审树档报"通过" —— 与"没给"同形。
  // 给了旗标就必须给至少一条路径;空清单判用法错,不静默放行。
  if (only !== null && only.size === 0) {
    console.error('❌ --only 需要 a;b 路径清单 —— 实得空清单(不得静默改审全树/报通过)')
    return 2
  }

  let face
  let faceErr
  if (revOid) face = 'rev'
  else {
    const r = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
    face = r.face
    faceErr = r.error
  }
  if (faceErr) {
    console.error(`❌ ${faceErr}`)
    return 2
  }
  const asJson = argv.includes('--json')
  if (!asJson)
    console.log(
      `[check-no-warm-border] 暖色描边禁令守门… 内容口径:${
        face === 'rev'
          ? `落盘树 ${revOid.slice(0, 12)}(旁路落地涉事判据档${only ? ` / 只审 ${only.size} 条声明路径` : ''})`
          : `${FACE_LABEL[face]} —— ${FACE_NOTE[face]}`
      }`,
    )

  let scanned
  let exemptions
  try {
    const { texts, primary } = prefetch(face, only, revOid)
    if (primary.length === 0) {
      // 审树档的 --only 是落地器给的明确清单 ⇒ 清单里没有射程件 = 本枚不涉及,不是"没审到东西"
      if (face === 'rev' || judgeEmptyScope(face) === 'not-applicable') {
        if (!asJson) console.log('\n✅ 本次提交无射程内文件 ⇒ 本门不适用(通过)')
        return 0
      }
      console.error('❌ 无法判定(exit 2):射程内枚举到 0 个候选 ⇒ 判据没跑到东西,不记绿')
      return 2
    }
    // 被审件在该面取不到 ⇒ Undetermined(§0.4 不回落另一个面)。审树档同理:
    // 清单来自 ls-tree 却读不到 blob,说明树与清单不一致,绝不能当成"没内容=干净"。
    if (face === 'staged' || face === 'rev') {
      const label = face === 'rev' ? '落盘树 blob' : '索引 blob'
      for (const rel of primary) {
        if (texts.get(rel) === null) throw new Undetermined(`${rel}: ${label} 取不到 —— 无法判定`)
      }
    }
    const exRel = EXEMPTIONS_REL
    const exRaw = face === 'worktree' ? (existsSync(join(root, exRel)) ? readFileSync(join(root, exRel), 'utf8') : null) : texts.get(exRel) ?? (existsSync(join(root, exRel)) ? readFileSync(join(root, exRel), 'utf8') : null)
    if (exRaw === null) {
      // 台账不存在 = 没有豁免,合法;但存在而坏 ⇒ 拒绝判定
      exemptions = []
    } else {
      const r = loadExemptions(exRaw)
      if (r.error) {
        console.error(`❌ 无法判定(exit 2):豁免台账 ${r.error}`)
        return 2
      }
      exemptions = r.rows
    }
    // 审树档也按子集判:它只带落地器声明的那几条路径,证明不了"全集没有"(同 --staged 口径)。
    const flat = collectHits(primary, texts, { subset: face === 'staged' || face === 'rev' })
    // W4 只在**全集档**判:被忽略的 plugin 结构上不会出现在 --staged 清单里,
    // 在子集档判它等于永不命中(§0.9 判据必须在真跑它的那一刻才成立)。
    if (face !== 'staged') {
      const pluginRels = primary.filter((p) => RN_PLUGIN_RE.test(p))
      if (pluginRels.length > 0) {
        let ignoredMap = new Map()
        try {
          const out = gitRaw(['check-ignore', '-v', '--no-index', '--stdin'], root, {
            input: pluginRels.join('\n'),
            timeout: 60000,
          })
          ignoredMap = parseCheckIgnoreLines(out)
        } catch (e) {
          if (e?.status === 1) ignoredMap = new Map() // exit 1 = 一条都没匹配 = 全部可跟踪
          else throw e
        }
        flat.push(...auditPluginTrackable(pluginRels, ignoredMap))
      }
    }
    const { kept, expiredOrBroken } = applyExemptions(flat, exemptions)
    scanned = { kept, expiredOrBroken, candidateCount: primary.length }
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : (e?.message ?? String(e))
    console.error(`❌ 无法判定(exit 2):${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }

  const { kept, expiredOrBroken, candidateCount } = scanned
  const undetermined = kept.filter((h) => UNDETERMINED_RE.test(h.rule))
  const actionable = kept.filter((h) => !UNDETERMINED_RE.test(h.rule))
  if (!asJson)
    console.log(`  射程:${candidateCount} 件;命中 ${actionable.length} 处 / 未判定 ${undetermined.length} 处`)
  for (const e of expiredOrBroken) console.warn(`⚠️ 豁免失效回队列:${e.row.file}(${e.reason})`)
  for (const u of undetermined) console.warn(`⚠️ 未判定:${u.file}:${u.line} ${u.text}`)

  const byFile = new Map()
  for (const h of actionable) {
    if (!byFile.has(h.file)) byFile.set(h.file, [])
    byFile.get(h.file).push(h)
  }

  // 审树档:命中即拒(fail-closed),未判定也拒 —— 这一档没有"存量只报数"的语义,
  // 因为它审的就是**本枚要落盘的内容本身**,报数等于放行。
  if (face === 'rev') {
    if (asJson) console.log(JSON.stringify({ face, total: actionable.length, hits: actionable }, null, 2))
    if (undetermined.length > 0) {
      console.error(`❌ 落盘树判定不完整(${undetermined.length} 处未判定)⇒ 不记绿,拒绝落地`)
      return 2
    }
    if (actionable.length > 0) {
      console.error(`❌ 落盘树里有 ${actionable.length} 处暖色描边 ⇒ 拒绝落地:`)
      for (const [f, hits] of [...byFile].slice(0, 20))
        console.error(`    ${f}: ${hits.map((h) => `${h.rule}@${h.line} ${h.text}`).join(' | ')}`)
      return 1
    }
    if (!asJson) console.log('\n✅ 落盘树无暖色描边')
    return 0
  }

  if (face !== 'staged') {
    if (actionable.length > 0) {
      console.warn(`[WARN] 全量档存量 ${actionable.length} 处(差值棘轮只在 --staged 问责):`)
      for (const [f, hits] of [...byFile].slice(0, 20))
        console.warn(`    ${f}: ${hits.map((h) => `${h.rule}@${h.line}`).join(' ')}`)
    } else {
      console.log('[PASS] 无暖色描边存量')
    }
    console.log('\n✅ 暖色描边守门通过(全量档只报数)')
    return 0
  }

  // --staged:锚点 = 该文件 HEAD 面自身命中数(无命中 ⇒ 不必取锚点)
  if (actionable.length === 0) {
    if (asJson) console.log(JSON.stringify({ face, total: 0, added: [] }, null, 2))
    else console.log('\n✅ 暖色描边守门通过(本次暂存面无命中)')
    return 0
  }
  let headCounts
  try {
    headCounts = headAnchorCounts([...byFile.keys()])
  } catch (e) {
    console.error(`❌ 无法判定(exit 2):HEAD 锚点取不到 —— ${e?.message ?? e}`)
    return 2
  }
  const added = ratchetDiff(byFile, headCounts)
  if (asJson) console.log(JSON.stringify({ face, total: actionable.length, added }, null, 2))
  if (added.length > 0) {
    console.error(`[FAIL] 本次提交把暖色描边加回来了(${added.length} 个文件):`)
    for (const a of added.slice(0, 30)) {
      console.error(`  ${a.file}`)
      for (const h of a.hits.slice(0, 8)) console.error(`    ${h.rule} @L${h.line}  ${h.text}`)
    }
    console.error('\n出路:描边只准取中性档(border.light/medium)或聚焦态墨档;')
    console.error('      原生强调色钉 @color/accent_ink,原生输入框背景保持透明件。')
    console.error(`      确需保留 ⇒ 登记 ${EXEMPTIONS_REL}(file+rule+reason+ticket+until)。`)
    return 1
  }
  if (!asJson) console.log('\n✅ 暖色描边守门通过(--staged 差值棘轮:无新增)')
  return 0
}

/**
 * HEAD 面各文件命中数(棘轮锚点)。与 --staged 档共用 scanOne,不复制判据。
 * 只读需要锚点的那几件(ratchetDiff 只遍历被审面的 key,余下文件的锚点用不到)。
 */
function headAnchorCounts(files) {
  const { texts, primary } = prefetch('head', new Set(files))
  const out = new Map()
  const flat = collectHits(primary, texts, { subset: true })
  const exRel = EXEMPTIONS_REL
  const exRaw = texts.get(exRel) ?? (existsSync(join(root, exRel)) ? readFileSync(join(root, exRel), 'utf8') : null)
  const rows = exRaw === null ? [] : (loadExemptions(exRaw).rows ?? [])
  for (const h of applyExemptions(flat, rows).kept) {
    if (UNDETERMINED_RE.test(h.rule)) continue
    out.set(h.file, (out.get(h.file) ?? 0) + 1)
  }
  return out
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main())
}

/** §22c:镜像档一律 import 这个出口,不得复制任何常量或判定。 */
export const __test__ = {
  isWarmRgb,
  parseHexRgb,
  hasWarmColor,
  warmFocusClassOf,
  focusRuleRanges,
  inputRuleRanges,
  scanWarmInputChrome,
  scanAccentColorRule,
  ACCENT_CONTROL_SELECTORS,
  scanWarmBorderText,
  scanNativeTextfieldText,
  auditPluginChromeSource,
  auditPluginChromeSet,
  auditPluginTrackable,
  parseCheckIgnoreLines,
  maskXmlComments,
  parseAndroidColorsXml,
  isNeutralArgb,
  scanAndroidThemeText,
  colorsInputsOf,
  loadExemptions,
  ruleFamily,
  applyExemptions,
  ratchetDiff,
  isInScope,
  judgeEmptyScope,
  scanOne,
  ACCENT_ATTRS,
  STYLE_SCOPES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
