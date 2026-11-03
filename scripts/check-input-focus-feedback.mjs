#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-input-focus-feedback.mjs —— 「有描边的输入/选择控件对聚焦无反应」三端对账
 * (票 G-42 第①格,2026-10-08 立;2026-10-14 接线时裁定 blocking —— 前置实测:--self-test / 全量档 / --staged 三档均 RC 0,存量 81 处/54 文件由"该文件 HEAD 自身存量"棘轮只报数)
 *
 * 【接线状态:已接入】—— 接线点 = `scripts/guardian-runner.mjs` 注册表 id '212'(blocking,skipEnv `HUSKY_SKIP_INPUT_FOCUS_FEEDBACK`,stagedTriggers ['apps/','packages/'])。镜像测试按 `scripts/guardian-runner.mjs`
 * 现读做**双向**对账:这一行自称"已接入"而 runner 没有注册条 ⇒ 红;runner 注册了而这一行仍写
 * "未接入" ⇒ 也红。措辞不进断言,所以日后改写说明文字不会假红。
 *
 * 立因:输入框的聚焦描边是三端同一动作的同一反馈,而本仓今天的判定面是**零**——
 * 上一轮量出来的是临时探针(从未进提交链),今天没有任何门能证明"描边输入框接了聚焦态"。
 * 三端各自的唯一实现已经落地:
 *   - 小程序:`apps/miniapp-taro/src/hooks/use-field-focus.ts` + `components/FocusField.tsx`
 *     (`focusStyle: focused ? { borderColor: 'var(--color-primary)' } : undefined`)
 *   - RN/共享:`packages/app/src/components/TextField.tsx`(经 `@ihui/rn-app` 导出,`colorScheme` 必填)
 *   - web:`focus:border-*` / `focus-visible:border-*` 工具类(墨档反转由门 83 R8 管)
 * 唯一实现存在 ≠ 调用方在用它 —— 本门判的就是这一格:**写了描边却没写聚焦反馈**的控件。
 *
 * 三端各自的书写语言都要覆盖,少一端等于给那一端开空白支票:
 *   R(mobile-rn / packages/app)style 对象里的 `borderColor` / `borderBottomColor`
 *     (StyleSheet.create / createStyles / `const styles = {` 块内,深度 1)
 *   M(miniapp-taro)className 工具类(`border border-border`)与内联 `style`
 *   W(web)className 工具类 + CSS 规则里的 `border*` 声明(含 `@apply border`)
 *
 * 证据窗 = **该元素自己的属性区**(开标签起、到该开标签自己的 `>` 止,不含子节点)。
 * 这是本门唯一一条不容妥协的纪律:上一轮探针就是栽在窗户外 ——
 * `apps/miniapp-taro/src/components/ModelConfigDialog.tsx` 把十余行外**兄弟容器**的 `border-t`
 * 算给了输入框,产出一枚假阳。跨窗归属不是"多读几个数",而是**把对的判成错的**,
 * 代价是逼人把一个本来正确的样式改掉(§12e:误红门的唯一结局是人人 `--no-verify`)。
 * 开标签的窗**按 JSX 结构配平取,不按行数截**:主扫描器 lib/jsx-scope 在 40 行处放弃时是把游标
 * 推到断点,被吞掉的不是那一枚开标签而是**它之后 40 行内的全部元素**(实测 `<TextField>` 自己只
 * 跨 9 行,却因容器 `<FlatList/>` 跨 60 行而被连坐)。本门对被漏掉的输入控件**自己再配平一次**
 * (`openTagRegion`,窗口上限 `STRUCT_MAX_TAG_LINES`):配得平 ⇒ 照常判;配不平(触顶 / 深度穿负 /
 * 到文件尾)⇒ 落"未判定"并写明是**哪一层**配不平,绝不判红也**绝不把"没量到"写成"量过了"**。
 * 祖先链因此读不全的重建元素,与标签栈失配同档处置:可见祖先里有唯一实现 ⇒ 不敢用它交差 ⇒ 未判定。
 *
 * 聚焦态认什么(逐端,写死在下面三份判据里):
 *   - RN:`focused ? {…}` 条件取值 / 命中行所属样式键本身就是聚焦档(`xxxFocused: {`) / `onFocus`
 *   - 小程序 & web:`focus:` `focus-visible:` `focus-within:` 变体前缀(须落在
 *     border|ring|outline|shadow 这类**可感知描边**工具类上)/ CSS `:focus*` 伪类 /
 *     引用唯一实现(`useFieldFocus` `FocusField` `FocusInput` `FocusTextarea` `TextField`)
 *   - 遮噪方向按判据分两档,共用 lib/radius-roles.maskFaces(词法只有一份,见该文件头注):
 *     **描边证据看 kept 面**(工具类名与 `'transparent'` 这类取值本身就是字符串),
 *     **聚焦代码证据看 code 面**(串里写"focus"不算 props,注释更不算 —— 自检 S3 钉住这一条)。
 *
 * 三态分开点名,绝不并桶:命中(hit)/ 放过(passed)/ 未判定(undetermined)各报各的数;
 * `--strict` 且未判定 > 0 ⇒ **exit 2**(拒绝发合格证)。扫到 0 个候选文件判"无法判定"而非绿。
 *
 * 棘轮锚点 = **该文件在 HEAD 面自身的命中数**(与 77/83/98/102/113/131 同族):
 * 存量只报数、本次新增才判红。开工先跑全量看 HEAD 现读数,存量不为 0 时接线前必须清完,
 * 否则当场就是一台与任何提交都无关的恒红门(§12e 那条本仓最高反面教训)。
 *
 * 第四条认法 = **跨文件一跳**(2026-10-11 立):大写标签若来自 import,**必须沿说明符读到那件源码**
 * 再判 —— 件内同时给出「聚焦条件」与「可见描边」才算放过;仓内路径(相对说明符、workspace 包名
 * 及其子路径)解析不到 / 切不出声明体一律落**未判定**。立因:`@ihui/ui-native` 的 `Input` 自己就写
 * 聚焦墨档(该件 :127),调用点没有聚焦措辞是正确写法,把它记成命中就是拿假阳逼下一个人去"修"
 * 没坏的东西。**禁止**改用名字白名单解决
 * (名单必然腐烂:§4 对 `RN_ONLY_BRAND_KEYS`、守门 39 对 `WHITELIST` 各记过一次)。**锚点面必须
 * 过同一把尺子** —— 尺子变准不等于仓库新增命中。
 *
 * 第五条(2026-10-17 补,收票 G-42 的「未判定那 N 处」最后一格)= **第三方运行时包不走这一跳**:
 * 说明符既非相对路径也不在本仓 workspace 名册里(判据 = `packages/*` 与 `apps/*` 的 package.json
 * 里真读到的 name,`@ihui/` 前缀只作 --staged 稀疏名册的兜底护栏,不是主判据),那它的实现**结构上
 * 不可能在被审面上**(node_modules 不入库;`apps/mobile-rn/tsconfig.json` 的 `paths` 也只是把
 * `react-native` 指回 `./node_modules/react-native`,不是指回仓内源)。仓内没有任何一份源能藏住
 * 它的聚焦反馈 ⇒ **调用点就是本门拿得到的全部证据**,有描边而无聚焦 ⇒ 记命中并写明出处。
 * 现场取证(2026-10-17):`apps/mobile-rn/src/components/ai/QueueInteractionBar.tsx:222` 的
 * `<TextInput style={styles.editInput}>`(键体 :358-359 写 `borderWidth`+`borderColor`)此前被写成
 * "解析不到实现文件 ⇒ 未判定",那是把尺子的取材边界当被测对象的不确定性;真结论是**一处 RN 端
 * 聚焦反馈缺口**(改它 = 加 onFocus + 聚焦档描边,或迁 packages/app 的 TextField)。
 * 方向取"喊"不取"静默":认错一枚第三方组件的代价是多一次定向说明,把它写成放过才是造假。
 *
 * F2(2026-10-20 补,第二维)= **RN focusedStyle 只准覆盖颜色、不得带几何键**。
 * TextField.tsx 的文档明令:`focusedStyle` 是调用方差异需求的最后覆盖口;聚焦把描边从
 * 1px 加粗到 2px 会压缩固定高度的内容区,框内文字被顶起数设备像素(真机实测,2026-10-20
 * 已把 LoginScreen 与五处 `focusedStyle={{ borderWidth: 2 }}` 残留清零)。本维防回潮:
 *   射程 = packages/app/src 与 apps/mobile-rn/src 的生产码 .ts/.tsx(tests / __tests__ /
 *   .test. / .spec. 路径豁免 —— 测试夹具本来就要写坏形状);命中 = `focusedStyle={…}` 的值
 *   可静态看到几何键:① 内联对象字面量(`focusedStyle={{ borderWidth: 2 }}`);② 单一样式键
 *   引用(`focusedStyle={styles.inputFocused}` ⇒ 全文件找 `inputFocused: {` 声明体、取对象
 *   深度 1 的键)。几何键表:border*Width / width|height 及其 min|max 档 / padding* / margin* /
 *   top|bottom|left|right;只取**对象深度 1** 的键(`shadowOffset: { width, height }` 是取值
 *   不是聚焦几何)。取材在 **code 面**(注释与字符串都遮):引号键在 code 面被抹平,而 RN
 *   样式键本就不加引号 —— 这一格按射程外写明,不装作判过。条件三元(`focused ? a : b`)、
 *   数组、裸变量引用、声明体切不出 ⇒ 键静态不可见 ⇒ 计 `f2Unresolved` 随报告出声,不判红
 *   也不记绿(与 F1 的 unresolvedStyleRefs 同档,不进 --strict 的未判定账)。
 *   棘轮与 F1 共用同一把 ratchetRed:锚点 = 该文件 HEAD 自身 F2 数,只拦新增。
 *   引用形态不 styleKeyBody:那台只认 STYLE_BLOCK_ANCHOR 锚定块内深度 1 的键,而 LoginScreen
 *   的 createStyles 函数体跨 669 行,objectScope 的 400 行配平上限让它进不了 styleBlocks
 *   (F1 的射程外④)—— F2 的立因站点恰是它,这一格必须看得见(见 styleKeyDeclBodies 头注)。
 *
 * 取材面同 70/77/83/98/101/103/118/131:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工逃生舱、两面旗同给 exit 2、清单与内容**同面同轮**、内容取不到**不回退磁盘**
 * ⇒ exit 2 无法判定(不冒红也不记绿)。全部经 lib/face-reader 的 `catBatch`,不散写 `git show`。
 *
 * 已知射程外(写明,不装作判过):
 *  ① 描边写在**跨文件常量 / 函数返回值 / 模板串插值**里时,属性区读不到 border ⇒ 不判红,
 *     计入 `styleRefsUnresolved` 并随报告出声(常见形态:`style={modelConfigInputBoxStyle(...)}`);
 *  ② 描边画在**外层容器**上(WRAP 形态)且容器名不含输入语义词 ⇒ 本门看不见,由唯一实现的
 *     调用侧约定兜(见 use-field-focus.ts 头注用法②);
 *  ③ `<Input>` 的 `style=` 之外形态(`inputStyle=` / 组件自定义档)不在 jsx-scope 的取用契约里;
 *  ④ CSS **原生嵌套**的内层规则只按内层选择器配对聚焦对照(祖先前缀不参与基底比较),
 *     所以 `.a { .b { border } }` + `.a .b:focus {}` 会判成未配对 ⇒ 报红而不是漏报(方向是喊,不是静默)。
 *
 * 行内出口:`input-focus-exempt: <一句话原因>`(必须带原因,裸标记不生效 —— 与守门 102/131 同条)。
 * 用法:node scripts/check-input-focus-feedback.mjs [--staged|--worktree|--strict|--json|--self-test]
 * 紧急跳过:HUSKY_SKIP_INPUT_FOCUS_FEEDBACK=1
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { catBatch, readWorktreeFile, selectFace, gitRaw } from './lib/face-reader.mjs'
// 遮罩/分词只有一份:两面(注释抹掉 / 注释+串都抹掉)与串区间全部出自这一层,本门不自带词法器。
import { maskFaces } from './lib/radius-roles.mjs'
// 属性区 → 键/类名的取用一律走 jsx-scope 那一份(证据窗的语义只许有一把尺子,§0.6)
import { attrNames, hasJsxShape, scanJsx, tagBase } from './lib/jsx-scope.mjs'
import { objectScope } from './lib/box-geometry.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000
const SELF_SKIP = 'HUSKY_SKIP_INPUT_FOCUS_FEEDBACK'
const EXEMPT = /input-focus-exempt:\s*\S/
/** 与 lib/jsx-scope 的 `MAX_TAG_SPAN_LINES` 同值;本门只用它写措辞,不另起一份窗口实现。 */
const MAX_TAG_LINES = 40
/**
 * 取证窗**重建**的配平上限(行)。主扫描器在 `MAX_TAG_SPAN_LINES` 处放弃时会把游标直接推到
 * 断点,于是被吞掉的不是"这一枚开标签",而是**它之后那 40 行里的全部元素**——实测
 * `apps/mobile-rn/src/screens/TopicListScreen.tsx:194` 的 `<TextField` 自身只跨 9 行,它是被
 * 176 行那枚跨 60 行的 `<FlatList/>` 连坐吞掉的。这一档**不放宽判据**,只把"我的窗口不够长"
 * 与"这枚控件的边界确实定不下"分开:配平在触顶前回到深度 0 ⇒ 照常判;触顶/穿负/到 EOF ⇒ 仍判不出。
 * 上限取 240 的理由:HEAD 面重建成功的开标签实测最长 172 行(见 `--json` 的 rebuilt 计数),
 * 再长就不是"一个元素的属性区"而是解析器认错标签了 —— 宁可在这一格继续落未判定。
 */
const STRUCT_MAX_TAG_LINES = 240
const SCAN_ROOTS = ['apps/web/', 'apps/miniapp-taro/src/', 'apps/mobile-rn/src/', 'packages/app/src/']
const SCAN_EXT = /\.(tsx|jsx|css)$/

/** 三端各自的书写语言 ⇒ 各自的标签集合与判据分支。 */
const SINGLE_IMPL = new Set(['TextField', 'FocusField', 'FocusInput', 'FocusTextarea'])
/** 本仓 workspace 包名形态 —— 只认 `@ihui/<pkg>`,其余一律解析不到(不猜 node_modules) */
const WS_PKG_RE = /^@ihui\/[\w-]+$/
const INPUT_TAGS = {
  rn: new Set([
    'TextInput',
    'TextField',
    'Input',
    'Textarea',
    'TextArea',
    'SearchInput',
    'SearchBar',
    'MultilineInput',
    'CodeInput',
    'Picker',
    'Select',
  ]),
  miniapp: new Set([
    'Input',
    'Textarea',
    'TextArea',
    'SearchBar',
    'Picker',
    'FocusInput',
    'FocusTextarea',
    'FocusField',
    'TextField',
    'TextInput',
  ]),
  web: new Set([
    'input',
    'select',
    'textarea',
    'Input',
    'Select',
    'Textarea',
    'TextArea',
    'SearchInput',
    'Combobox',
    'TextField',
    'DatePicker',
    'TimePicker',
  ]),
}

export function endOf(rel) {
  const p = String(rel || '')
  if (!SCAN_ROOTS.some((d) => p.startsWith(d))) return null
  if (p.startsWith('apps/web/') && /\.css$/.test(p)) return 'css'
  if (p.startsWith('apps/web/') && /\.(tsx|jsx)$/.test(p)) return 'web'
  if (p.startsWith('apps/miniapp-taro/src/') && /\.(tsx|jsx)$/.test(p)) return 'miniapp'
  if (
    (p.startsWith('apps/mobile-rn/src/') || p.startsWith('packages/app/src/')) &&
    /\.(tsx|ts)$/.test(p)
  )
    return 'rn'
  return null
}

// ─── 判据的字面规则(三份尺子都在这里,便于逐条对照头注)─────────────────────

/** Tailwind / weapp-tailwindcss 的常态描边工具类:不带变体前缀的 `border*`。 */
export function isRestingBorderToken(t) {
  const s = String(t || '')
  if (!s || s.includes(':') || s.startsWith('-')) return false
  if (!/^border(-|$)/.test(s)) return false
  // 明确"这里没有边框"的写法不是描边证据
  if (/^border(-(t|b|l|r|x|y|s|e))?-(0|none|hidden|transparent)$/.test(s)) return false
  if (/^border-\[?(0|none|transparent)\]?$/.test(s)) return false
  return true
}

/** 聚焦档工具类:`focus:` / `focus-visible:` / `group-focus:` 等前缀 + 可感知描边的一侧。 */
export function isFocusClassToken(t) {
  const s = String(t || '')
  if (!s.includes(':')) return false
  const parts = s.split(':')
  const util = parts.pop()
  if (!parts.some((p) => /focus/i.test(p))) return false
  return /^(border|ring|outline|shadow)/.test(util)
}

/** 聚焦态的**代码面**证据(props / hook / 唯一实现引用 / CSS 伪类)。只在抹掉串与注释的面上查。 */
export const FOCUS_CODE =
  /\b(?:onFocus|onFocusChange|useFieldFocus|FocusField|FocusInput|FocusTextarea|TextField|focusStyle|focusVisible)\b|\b[a-zA-Z_$][\w$]*[Ff]ocused\b|\bfocused\b|\bfocus\b|::?focus[\w-]*|\.\s*spread\b/

/** `borderColor:` / `border-width:` / `borderBottomColor=` 这类声明;`borderRadius` 不是描边。 */
export function borderDecls(text) {
  const src = String(text || '')
  const out = []
  const re = /\bborder[A-Za-z-]*/g
  let m
  while ((m = re.exec(src))) {
    const name = m[0]
    if (/radius/i.test(name)) continue
    const rest = src.slice(m.index + name.length)
    if (!/^\s*[:=]/.test(rest)) continue
    const value = (/^\s*[:=]\s*([^,;)}\n]*)/.exec(rest) || [])[1] || ''
    const v = value.trim().toLowerCase()
    // 取值不可见(0 / none / transparent)⇒ 这一枚不是常态描边;取不到值(串被抹平)按可见处理
    const visible = v === '' || !/^(0|none|transparent|hidden|0px|0%|initial|unset|inherit)$/.test(v)
    if (name.toLowerCase() === 'border-style') continue
    out.push({ name, visible })
  }
  return out
}

/** 样式键名本身是不是聚焦档(`inputFocused:` / `xxxFocus:`)—— 是则它自己就是反馈,不是常态描边。 */
export function isFocusTierKey(key) {
  return /focus/i.test(String(key || ''))
}

// ─── F2:RN focusedStyle 只准覆盖颜色(几何键禁令,TextField.tsx 文档明令)──────────

/** F2 的测试路径豁免(tests / __tests__ 段与 .test. / .spec. 文件名 —— 夹具本来就要写坏形状)。 */
export const TEST_PATH_RE = /(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.test\.|\.spec\./i

/** F2 的几何键表:聚焦差异化样式只准换色,动了这些键就是布局跳动(1px→2px 顶起文字)。 */
export function isGeometryStyleKey(key) {
  return /^(border(?:Top|Bottom|Left|Right)?Width|minWidth|maxWidth|width|minHeight|maxHeight|height|padding(?:Top|Bottom|Left|Right|Horizontal|Vertical)?|margin(?:Top|Bottom|Left|Right|Horizontal|Vertical)?|top|bottom|left|right)$/.test(
    String(key || ''),
  )
}

/**
 * 字符级花括号配平:从 `openIdx`(必须指向 `{`)取**该对象自己的**体内文本与闭括号下标。
 * 为什么不用 lib/box-geometry.objectScope:那一台按"行"开窗(回看 60 行找含 `{` 的行、
 * 向后 400 行配平),F2 的锚点(`focusedStyle={{`、与兄弟键同行的 `inputFocused: {`)常落在
 * 行中间,行级窗口会把同行的其他键并进体内。配不平(到 EOF 仍开著)⇒ null,交调用方落
 * "判不出",不猜 —— 与 objectScope 对截断的处理同一条规矩。
 */
export function braceBody(code, openIdx) {
  if (code[openIdx] !== '{') return null
  let depth = 0
  for (let i = openIdx; i < code.length; i++) {
    const c = code[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return { body: code.slice(openIdx + 1, i), close: i }
    }
  }
  return null
}

/** 对象体**深度 1** 的键名清单。值里的嵌套对象/数组自己成层,其中的键不参与(shadowOffset 同款)。 */
export function topLevelKeys(body) {
  const out = []
  let depth = 0
  let from = -1
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '{' || c === '[' || c === '(') {
      depth++
      from = -1
      continue
    }
    if (c === '}' || c === ']' || c === ')') {
      depth--
      continue
    }
    if (depth !== 0) continue
    if (/[\w$]/.test(c)) {
      if (from < 0) from = i
      continue
    }
    if (from >= 0) {
      let j = i
      while (j < body.length && /[ \t\r\n]/.test(body[j])) j++
      if (body[j] === ':') out.push(body.slice(from, i))
      from = -1
    }
  }
  return out
}

/**
 * F2 引用形态取键体:`focusedStyle={styles.inputFocused}` ⇒ 全文件找 `inputFocused: {` 声明,
 * 逐份字符级配平取体。为什么不用 styleKeyBody:见头注 F2 段(createStyles 函数体超
 * objectScope 的 400 行配平上限 ⇒ styleBlocks 收不到 ⇒ depth 1 判据对它整片失明)。声明在
 * 任意深度都认;同名键声明多份时逐份取证、任一份带几何键即命中(方向取"喊",不取"静默")。
 */
export function styleKeyDeclBodies(code, key) {
  const esc = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?:^|[\\n,{])\\s*${esc}\\s*:\\s*\\{`, 'g')
  const bodies = []
  let m
  while ((m = re.exec(code))) {
    const b = braceBody(code, m.index + m[0].length - 1)
    if (b) bodies.push(b.body)
  }
  return bodies
}

/**
 * F2 主判据:返回 `{sites, unresolved}`。sites 每枚 = 一处带几何键的 focusedStyle;
 * unresolved = 键静态不可见的形态(条件三元/数组/裸变量/声明体切不出/配不平),随报告出声,
 * 不判红也不记绿 —— §0.3:"没判"绝不写成"判过"。取材面 = **code**(注释与字符串都遮),
 * 与 F1 的"聚焦代码证据看 code 面"同档;遮罩由 maskFaces 的等长词法保证,行号两面对齐。
 */
export function judgeFocusedStyleGeometry(rel, code) {
  const sites = []
  const unresolved = []
  if (TEST_PATH_RE.test(String(rel || ''))) return { sites, unresolved }
  const src = String(code || '')
  const re = /focusedStyle\s*=\s*\{/g
  let m
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length
    const open = m.index + m[0].length - 1
    const container = braceBody(src, open)
    if (!container) {
      unresolved.push({ file: rel, line, reason: 'focusedStyle 的表达式容器花括号配不平 ⇒ 是否带几何键判不出,不判红也不记绿' })
      continue
    }
    // 容器内第一个非空白字符是 `{` ⇒ 内联对象字面量(键当场可见)
    let k = open + 1
    while (k < src.length && /[ \t\r\n]/.test(src[k])) k++
    if (src[k] === '{') {
      const obj = braceBody(src, k)
      if (!obj) {
        unresolved.push({ file: rel, line, reason: 'focusedStyle 内联对象字面量配不平 ⇒ 是否带几何键判不出,不判红也不记绿' })
        continue
      }
      const keys = [...new Set(topLevelKeys(obj.body).filter(isGeometryStyleKey))]
      if (keys.length) sites.push({ file: rel, end: 'rn', line, dim: 'F2', via: 'inline', keys })
      continue
    }
    // 引用形态:只认 `标识符.标识符`(styles.inputFocused)。任务口径:条件三元的样式对象
    // 是另一型、误报风险高,不扩 —— 它连键都静态不可见,落 unresolved 出声即可。
    const ref = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/.exec(container.body.trim())
    if (!ref) {
      unresolved.push({
        file: rel,
        line,
        reason: `focusedStyle 引用的是复杂表达式(数组/三元/裸变量)⇒ 键静态不可见,是否带几何键判不出,不判红也不记绿`,
      })
      continue
    }
    const bodies = styleKeyDeclBodies(src, ref[2])
    if (!bodies.length) {
      unresolved.push({ file: rel, line, reason: `引用键 ${ref[2]} 在本文件找不到声明体 ⇒ 是否带几何键判不出,不判红也不记绿` })
      continue
    }
    const keys = [...new Set(bodies.flatMap((b) => topLevelKeys(b).filter(isGeometryStyleKey)))]
    if (keys.length) sites.push({ file: rel, end: 'rn', line, dim: 'F2', via: `styles.${ref[2]}`, keys })
  }
  return { sites, unresolved }
}

/**
 * 差值棘轮共用的比较器(F1/F2 同一把尺,§0.6):锚点 = 该文件 HEAD 自身违规数,
 * 只拦"本次改动把违规加回来",存量只报数。新文件无锚点(cap=0)⇒ 新增即红。
 */
export function ratchetRed(counts, headCounts, sitesOf) {
  const red = []
  for (const [f, n] of [...counts].sort()) {
    const cap = headCounts.get(f) ?? 0
    if (n > cap) red.push({ file: f, n, cap, sites: sitesOf(f) })
  }
  return red
}

// ─── RN:StyleSheet / createStyles 块内的样式键 ──────────────────────────

const STYLE_BLOCK_ANCHOR =
  /StyleSheet\s*\.\s*create\s*\(|\b(?:createStyles|makeStyles)\s*\(|\bconst\s+[A-Za-z_$][\w$]*[sS]tyles?\s*=\s*\{/

/**
 * 一个文件里的**样式块区间**(0 基行号)。只认真读到的块,读不到就是没有块 ⇒
 * 样式键解不到 ⇒ 计入射程外计数(不猜)。括号配平走 lib/box-geometry.objectScope(一份实现)。
 */
export function styleBlocks(codeLines) {
  const blocks = []
  for (let i = 0; i < codeLines.length; i++) {
    if (!STYLE_BLOCK_ANCHOR.test(codeLines[i])) continue
    const sc = objectScope(codeLines, i)
    if (!sc) continue
    if (blocks.some((b) => b.start === sc.start)) continue
    blocks.push(sc)
  }
  return blocks
}

/** 块内深度 1 的 `key: {` 声明 ⇒ 该键自己的对象体行区间。深度判据避免同名嵌套键互相冒充。 */
export function styleKeyBody(codeLines, keptLines, blocks, key) {
  const bodies = []
  const esc = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // 键名两侧可选引号(`'input': {` 与 `input: {` 同形),闭引号**必须**可选 —— 写成必选时
  // 无引号的常态写法一条也匹配不到,整条 RN 判据静默失明(自检 S1c 第一次就红在这一条)。
  const declRe = new RegExp(`^\\s*['"\`]?${esc}['"\`]?:\\s*\\{`)
  for (const b of blocks) {
    let depth = 0
    for (let i = b.start; i <= Math.min(b.end, codeLines.length - 1); i++) {
      const l = codeLines[i] || ''
      if (depth === 1 && declRe.test(l)) {
        const sc = objectScope(codeLines, i)
        if (sc) bodies.push(keptLines.slice(sc.start, sc.end + 1).join('\n'))
      }
      for (const ch of l) {
        if (ch === '{') depth++
        else if (ch === '}') depth--
      }
    }
  }
  return bodies
}

// ─── JSX 面判定(三端共用一台结构解析器,证据窗=各自属性区)──────────────────

/**
 * 从 `start`(指向 `<`)按 JSX 结构**继续配平**,找这一枚开标签自己的 `>`。
 * 口径与 `lib/jsx-scope` 的同一段循环逐条一致(花括号深度 0 处的第一个 `>` 即闭合;串区间取自
 * `maskFaces`,串里的 `<`/`>` 不算标签;嵌套 JSX 活在 `{…}` 里 ⇒ 深度 ≥ 1 ⇒ 其 `>` 不会被误当闭合),
 * 唯一差别是**不许在 40 行处停**。三种情况一律返回 null 交调用方落未判定,不猜:
 *  ① 深度穿负 —— 已经走出本标签所属的表达式区,再往前配平就是拿别人的边界当自己的属性区;
 *  ② 标签体外换行数触顶;③ 走到 EOF 仍未闭合。
 * `attrText` 只含属性区(不含标签名,也不含其后的子节点);键/类名取用交给 `attrNames`(一份实现)。
 */
export function openTagRegion(text, strings, start, startLine, maxLines) {
  const src = String(text || '')
  const nm = /^<([A-Za-z][\w.]*)/.exec(src.slice(start, start + 120))
  if (!nm) return null
  const name = nm[1]
  const attrFrom = start + 1 + name.length
  const strEnd = new Map()
  for (const s of strings || []) strEnd.set(s.start, s.end)
  const hasStringTable = Array.isArray(strings)
  const jumpString = (i) => {
    if (strEnd.has(i)) return strEnd.get(i)
    if (hasStringTable) return i + 1 // 词法器说这里不是串起手 ⇒ 当普通字符(JSX 文本里的撇号)
    const q = src[i]
    let j = i + 1
    while (j < src.length) {
      if (src[j] === '\\') {
        j += 2
        continue
      }
      if (src[j] === q) return j + 1
      if (src[j] === '\n' && q !== '`') return j
      j++
    }
    return j
  }
  let i = attrFrom
  let brace = 0
  let crossed = 0
  while (i < src.length) {
    const d = src[i]
    if (d === '"' || d === "'" || d === '`') {
      i = jumpString(i)
      continue
    }
    if (d === '{') brace++
    else if (d === '}') {
      brace--
      if (brace < 0) return null
    } else if (d === '<' && brace === 0) {
      // 深度 0 处的 `<` 在**开标签**里结构上不可能出现(嵌套元素只活在 `{…}` 里,其 `>` 深度 ≥ 1;
      // 属性串里的 `<` 已被 jumpString 跳过)。走到这里只能是本标签压根没闭合、配平吃到了兄弟/闭合
      // 标签的 `>` —— 那种"闭合点"造出来的属性区是别人的内容,必须判不出而不是造出一个元素。
      return null
    } else if (d === '>' && brace === 0) {
      return { name, base: tagBase(name), attrText: src.slice(attrFrom, i), attrEndLine: startLine + crossed }
    } else if (d === '\n') {
      crossed++
      if (crossed > maxLines) return null
    }
    i++
  }
  return null
}

/**
 * @returns {{hits:Array,passed:Array,undet:Array,unresolved:number,scanned:boolean}}
 */
export function judgeJsx(rel, text, end) {
  const hits = []
  const passed = []
  const undet = []
  let unresolved = 0
  const { code, kept, strings } = maskFaces(text)
  if (!hasJsxShape(kept)) return { hits, passed, undet, unresolved, scanned: false }
  const scope = scanJsx(kept, { strings })
  const keptLines = kept.split('\n')
  const codeLines = code.split('\n')
  const rawLines = String(text).split('\n')
  const blocks = end === 'rn' ? styleBlocks(codeLines) : []
  const tags = INPUT_TAGS[end]
  // 标签栈失配 ⇒ 祖先链不可信(门 150 记过同一型:盲弹栈把后面的祖先整片毁掉)。
  // 此时"祖先里有唯一实现"这一条放行依据**停用**,改记未判定。
  const chainTrusted = scope.corrupt === 0

  /**
   * 取证窗重建(票 G-42「未判定那 N 处」的第一格)。
   * 主扫描器只要有一枚开标签超窗(`scope.truncated`),它就把游标推到断点,**被吞掉的是断点之前
   * 那 40 行里的所有元素** —— 于是原来那套"出现次数 vs 建成次数对账"会把邻居报成主角:
   * 点名 `<TextField`(194 行)而真正建不出来的是它的容器 `<FlatList`(176 行)。
   * 这里先按 `line|base` 多重集把已建成的一次性扣掉,剩下的每一枚**自己**去配平取窗:
   * 建得出来 ⇒ 进同一台判定(不再需要"未判定");建不出来 ⇒ 落未判定,并把原因写实(超顶/穿负)。
   * 只比**名字落在本端标签集**里的出现,所以泛型(`useState<Mode>`)、内联 SVG 串、比较式里的 `<`
   * 都不会被算进来 —— 那些不是输入控件(这条口径沿用原对账档,实测本仓 truncated 大多来自那一型)。
   * 字符串区间直接取 `maskFaces` 的那一份(词法只有一台),串里的 `<Input` 不算开标签。
   */
  const rebuilt = []
  if (scope.truncated) {
    const built = new Map()
    for (const e of scope.elements) {
      const k = `${e.line}|${e.base}`
      built.set(k, (built.get(k) || 0) + 1)
    }
    const inString = (idx) => (strings || []).some((s) => idx >= s.start && idx < s.end)
    const pending = []
    for (const base of tags) {
      const re = new RegExp(`<${base}(?![\\w.])`, 'g')
      let m
      while ((m = re.exec(kept))) {
        if (inString(m.index)) continue
        const line = kept.slice(0, m.index).split('\n').length
        const k = `${line}|${base}`
        const n = built.get(k) || 0
        if (n > 0) {
          built.set(k, n - 1) // 这一枚主扫描器已经建成 ⇒ 交给主判定,不重复取证
          continue
        }
        pending.push({ index: m.index, line, base })
      }
    }
    for (const p of pending) {
      const r = openTagRegion(kept, strings, p.index, p.line, STRUCT_MAX_TAG_LINES)
      if (!r || r.base !== p.base) {
        undet.push({
          file: rel,
          line: p.line,
          reason: `<${p.base} 开标签在主扫描器 ${MAX_TAG_LINES} 行档外放弃,结构化配平到 ${STRUCT_MAX_TAG_LINES} 行仍回不到深度 0(或深度穿负/到文件尾)⇒ 是否描边无法判定,不判红也不记绿`,
        })
        continue
      }
      const bl = scope.byLine.get(p.line)
      rebuilt.push({
        line: p.line,
        base: p.base,
        attrEndLine: r.attrEndLine,
        ...attrNames(r.attrText),
        // 祖先只能取"主扫描器看得见的那一截";看不见的容器是否提供聚焦无从证明 ⇒ 下面按不可信链处置
        ancestors: bl ? bl.ancestors : [],
        rebuilt: true,
      })
    }
  }
  const elements = rebuilt.length ? [...scope.elements, ...rebuilt].sort((a, b) => a.line - b.line) : scope.elements

  // F2(第二维):RN focusedStyle 只准覆盖颜色、不得带几何键 —— 与逐元素判定正交,按文件整扫。
  // 只在 rn 端跑;web/miniapp 没有这个 prop(现读全仓 focusedStyle 用法全部落在 RN 两目录)。
  // 需要真 JSX 面(focusedStyle= 本就是 JSX 属性形态),故放在 hasJsxShape 早退之后。
  const f2 = end === 'rn' ? judgeFocusedStyleGeometry(rel, codeLines.join('\n')) : { sites: [], unresolved: [] }

  for (const el of elements) {
    if (!tags.has(el.base)) continue
    const from = el.line - 1
    const to = el.attrEndLine
    const regionCode = codeLines.slice(from, to).join('\n')
    // 豁免**逐行**判:把整段属性区并成一次测试时,`\s*\S` 会跨过换行去下一行借"原因",
    // 于是裸标记(`input-focus-exempt:` 后面什么都没有)也放行 = 一个不需要理由的出口(自检 S9a)。
    let exempted = false
    for (let i = from; i <= to; i++) if (EXEMPT.test(rawLines[i] || '')) exempted = true
    if (exempted) continue

    const resting = []
    const focusSide = []
    for (const t of el.classes || []) {
      if (isRestingBorderToken(t)) resting.push({ kind: 'class', text: t })
      if (isFocusClassToken(t)) focusSide.push({ kind: 'class', text: t })
    }
    // 逐行分档:同一行出现聚焦措辞 ⇒ 那一行的内联 border 归"聚焦侧",否则归"常态侧"
    for (let i = from; i < to; i++) {
      const dl = borderDecls(keptLines[i] || '')
      if (!dl.length) continue
      const isFocusLine = FOCUS_CODE.test(codeLines[i] || '')
      for (const d of dl) {
        if (!d.visible) continue
        ;(isFocusLine ? focusSide : resting).push({ kind: 'inline', text: d.name })
      }
    }
    if (end === 'rn') {
      for (const key of el.keys || []) {
        const bodies = styleKeyBody(codeLines, keptLines, blocks, key)
        if (!bodies.length) {
          if (blocks.length) unresolved++
          continue
        }
        const hasBorder = bodies.some((b) => borderDecls(b).some((d) => d.visible))
        if (!hasBorder) continue
        if (isFocusTierKey(key)) focusSide.push({ kind: 'styleKey', text: `styles.${key}` })
        else resting.push({ kind: 'styleKey', text: `styles.${key}` })
      }
    }

    if (!resting.length) continue // 没有可读的常态描边 ⇒ 不在射程(见头注"已知射程外")
    const why = resting.map((r) => r.text).join(',')
    if (SINGLE_IMPL.has(el.base)) {
      passed.push({ file: rel, line: el.line, tag: el.base, why, by: `标签即唯一实现(${el.base})` })
      continue
    }
    if (focusSide.length) {
      passed.push({ file: rel, line: el.line, tag: el.base, why, by: `聚焦档:${focusSide[0].text}` })
      continue
    }
    if (FOCUS_CODE.test(regionCode)) {
      passed.push({ file: rel, line: el.line, tag: el.base, why, by: '属性区有聚焦态取值/props' })
      continue
    }
    // 重建出来的元素看不到完整祖先链(它正是被一枚建不出的容器连坐吞掉的),与标签栈失配同档处置:
    // 祖先里有唯一实现 ⇒ **不敢用它交差**(把"没看见"写成"确信没有"是本仓最高频失效型)。
    const chainComplete = chainTrusted && !el.rebuilt
    if ((el.ancestors || []).some((a) => SINGLE_IMPL.has(a))) {
      const a = (el.ancestors || []).find((x) => SINGLE_IMPL.has(x))
      if (chainComplete) {
        passed.push({ file: rel, line: el.line, tag: el.base, why, by: `祖先 ${a} 提供聚焦` })
      } else {
        undet.push({
          file: rel,
          line: el.line,
          reason: el.rebuilt
            ? `祖先链读不全(该元素位于一枚建不出的容器开标签内)⇒ 外层 ${a} 是否提供聚焦无法确认,不判红也不记绿`
            : `标签栈失配(${scope.corrupt} 处)⇒ 祖先链不可信,唯一实现豁免不敢用`,
        })
      }
      continue
    }
    hits.push({ file: rel, end, line: el.line, tag: el.base, why, rebuilt: !!el.rebuilt })
  }
  return { hits, passed, undet, unresolved, scanned: true, rebuilt: rebuilt.length, f2: f2.sites, f2Unresolved: f2.unresolved }
}

// ─── 跨文件一跳:命中若是「导入件」,先去那件内部取聚焦证据 ────────────────
/**
 * 立因(2026-10-11 实测,本门第一次对自己产出的形态失明):`apps/mobile-rn/src/components/
 * AgentRuntimePanel.tsx:142` 被记成"带描边而无聚焦反馈",而那个 `<Input>` 根本不是裸
 * `TextInput` —— 它是 `@ihui/ui-native` 的共享件,件内 `:127` 就写着
 * `focused ? { borderColor: primaryColor }`(墨档,与 TextField 取值同档)。调用点没有
 * 任何聚焦措辞是**正确写法**:反馈住在件里。按名字白名单(`SINGLE_IMPL`)加一档"Input 也算
 * 唯一实现"是本仓记过最多次的腐烂形态(§4 对 `RN_ONLY_BRAND_KEYS`、守门 39 对 `WHITELIST`),
 * 所以这一格只许**按内容证明**:沿 import 说明符解析到件 → 读该件源码 → 在该组件声明体内
 * 同时看到「聚焦条件」与「可见描边」才放过。
 * 三条不许漂的口径:① 解析不到 / 目标件不在被审面上 / 声明体切不出来 ⇒ 落 **未判定**,
 *    既不判红也不放过(把"没看见"写成"确信没有"是本仓最高频失效型);
 * ② 只在**将被记成命中**的候选上做这一跳(不是全量符号解析,成本与误报都可控);
 * ③ 小写宿主标签(`input`/`textarea`/`select`)不走这一跳 —— 它们没有"另一份实现"可言。
 */
const IMPORT_RE = /import\s+(?:type\s+)?(?:([\w$]+)\s*,\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g

/** 从 kept 面(保留字符串、遮注释)取「标识符 → 模块说明符」 */
export function parseImports(kept) {
  const map = new Map()
  IMPORT_RE.lastIndex = 0
  let m
  while ((m = IMPORT_RE.exec(kept))) {
    const spec = m[3]
    if (m[1]) map.set(m[1], spec)
    for (const raw of String(m[2] || '').split(',')) {
      const part = raw.trim()
      if (!part || part.startsWith('type ')) continue
      const bits = part.split(/\s+as\s+/)
      const name = (bits[1] || bits[0] || '').trim()
      if (/^[\w$]+$/.test(name)) map.set(name, spec)
    }
  }
  return map
}

/** barrel 里 `export { X } from './y'` → 取 './y';取不到返回 null(不猜) */
export function followBarrelExport(kept, name) {
  const re = /export\s*(?:type\s*)?\{[^}]*\}\s*from\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(kept))) {
    const inside = m[0].slice(m[0].indexOf('{') + 1, m[0].indexOf('}'))
    const names = inside
      .split(',')
      .map((s) => s.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop())
      .filter(Boolean)
    if (names.includes(name)) return m[1]
  }
  return null
}

/** 说明符的首段包名(`@scope/name` 取两段,其余取一段);相对/绝对路径返回 null */
export function pkgNameOf(spec) {
  const s = String(spec || '')
  if (!s || s.startsWith('.') || s.startsWith('/') ) return null
  const segs = s.split('/')
  return s.startsWith('@') ? segs.slice(0, 2).join('/') : segs[0]
}

/**
 * 「第三方运行时包」判据 —— 既不是相对路径,也不在本仓 workspace 的名册里。
 * 两条护栏,少一条都会造假:
 * ① `@ihui/` 前缀**永不**算第三方:本仓全部 workspace 包名都以 `@ihui/` 起头(现读自
 *     `packages/<pkg>/package.json` 与 `apps/<pkg>/package.json` 两层),而 `--staged` 面的清单
 *     **只含改动文件**,名册在那一档本来就是空的 —— 按名册判会把 `@ihui/ui-native` 读成第三方,
 *     给别人的组件凭空记一枚命中(假阳 = 逼人改没坏的东西,§12e)。前缀这一条是名册空缺时的兜底,
 *     不是主判据。
 *  ② 名册命中 ⇒ 一定走"沿说明符读到实现件"那一跳,读不到就落未判定(仓内确实有源,不能当没有)。
 */
export function isExternalPkgSpec(spec, nameToDir) {
  const pkg = pkgNameOf(spec)
  if (!pkg) return false
  if (nameToDir && nameToDir.has(pkg)) return false
  return !WS_PKG_RE.test(pkg)
}

/** 说明符 → 被审面上的相对路径;解析不出返回 null(不回落磁盘、不猜 node_modules) */
export function resolveSpecPath(spec, fromFile, nameToDir) {
  const dir = fromFile.includes('/') ? fromFile.slice(0, fromFile.lastIndexOf('/') + 1) : ''
  const cands = []
  if (spec.startsWith('.')) {
    const joined = normalizeRel(dir + spec)
    cands.push(`${joined}.tsx`, `${joined}.ts`, `${joined}/index.tsx`, `${joined}/index.ts`)
  } else {
    // 子路径说明符(`@ihui/shared/chat/queue-interactions`)同样属于本仓 workspace:首段包名在名册里
    // 就得按 `<包>/src/<子路径>` 去取件(各包 exports 的 `"./*": "./src/*.ts"` 约定)。此前这里按
    // 整串匹配 `^@ihui/[\w-]+$`,子路径一律判成"解析不到"⇒ 与第三方同形,是别名解析缺项而非面映射。
    const pkg = pkgNameOf(spec)
    const base = pkg && nameToDir.get(pkg) ? nameToDir.get(pkg) : null
    if (base) {
      const sub = spec.length > pkg.length + 1 ? spec.slice(pkg.length + 1) : 'index'
      cands.push(`${base}/src/${sub}.tsx`, `${base}/src/${sub}.ts`, `${base}/src/${sub}/index.ts`, `${base}/${sub}.tsx`)
    }
  }
  return cands
}

function normalizeRel(p) {
  const parts = p.split('/')
  const out = []
  for (const seg of parts) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}

/**
 * 组件声明体:从 `function Name(` / `const Name = (` 起,取**函数体**那个花括号配平区间。
 * 两条实测过的坑(都是我第一版自己造的):
 *  ① RN 共享件普遍写 `export function Input({ className, style, ...rest }: Props) {` ——
 *     直接取"名字后第一个 `{`"会把**参数解构对象**当函数体,于是体内永远看不到 `focused ? …`,
 *     跨文件一跳对该族全部失明(表现不是报错,是"命中仍然存在")。
 *  ② 箭头函数 `const X = (p) => {`,以及泛型 `function X<T>(...)` —— 括号/尖括号都得跳过。
 * 因此判序固定:名字之后先爬过参数区(圆括号配平,深度回到 0 才算完),再取第一个 `{` 做配平。
 * 切不出体 ⇒ 返回 null ⇒ 调用处落**未判定**,不猜。
 */
export function componentBody(code, name) {
  const m = new RegExp(`(?:function|const)\\s+${name}\\b`).exec(code)
  if (!m) return null
  let i = m.index + m[0].length
  // 爬过尖括号与参数圆括号,找到函数体的第一个 `{`
  let angle = 0
  let paren = 0
  let seenParen = false
  for (; i < code.length; i++) {
    const c = code[i]
    if (c === '<') angle++
    else if (c === '>') {
      if (angle > 0) angle--
    } else if (angle > 0) continue
    else if (c === '(') {
      paren++
      seenParen = true
    } else if (c === ')') {
      paren--
      if (paren === 0) {
        // 参数区结束,后面可能是 `): Ret {` 或 `=> {` —— 继续找第一个 `{`
        const rest = code.slice(i + 1, i + 400)
        const arrow = /^\s*(?::[^{;]+)?\s*=>/.test(rest)
        if (arrow) continue
        const brace = code.indexOf('{', i + 1)
        if (brace < 0) return null
        i = brace - 1
        break
      }
      if (paren < 0) return null
    } else if (c === '{' && !seenParen) {
      // 无参数形态(如 `function Name() {` 已被上面覆盖;这里处理 `const Name = {` 那种对象 ⇒ 不是函数体)
      return null
    }
  }
  const bodyStart = code.indexOf('{', i)
  if (bodyStart < 0) return null
  let depth = 0
  for (let j = bodyStart; j < code.length; j++) {
    if (code[j] === '{') depth++
    else if (code[j] === '}') {
      depth--
      if (depth === 0) return code.slice(m.index, j + 1)
    }
  }
  return null
}

/** 件内是否同时给出「聚焦条件」与「可见描边」——两半缺一都不算证据 */
export function bodyProvidesFocus(body) {
  if (!body) return null
  const { kept, code } = maskFaces(body)
  if (!FOCUS_CODE.test(code)) return null
  const decls = borderDecls(kept).filter((d) => d.visible)
  if (!decls.length) return null
  return decls[0].name
}

/**
 * 把「即将记成命中」的大写标签候选送去取件内证据。返回 {hits, passed, undet}。
 * 每枚候选最多两跳(barrel → 实现件),每次跳读**同面**的一个路径(候选量个位数,
 * 逐路径读比一次性预读整包更省,且不会把"没在候选里的文件"拖进射程)。
 */
/** 本仓 workspace 包目录的形态(两层:packages/<pkg> 与 apps/<pkg>,后者也是 @ihui/* 名) */
const PKG_JSON_RE = /^(?:packages|apps)\/[^/]+\/package\.json$/

export function reclassifyHits(hits, face, facePaths, baseText) {
  const cache = new Map()
  const nameToDir = new Map()
  for (const p of facePaths) {
    const m = PKG_JSON_RE.exec(p)
    if (!m) continue
    const t = readFaceOne(p, face, cache)
    if (typeof t !== 'string') continue
    try {
      const nm = JSON.parse(t).name
      if (typeof nm === 'string' && WS_PKG_RE.test(nm)) nameToDir.set(nm, m[0].replace(/\/package\.json$/, ''))
    } catch {
      /* 坏 JSON ⇒ 该包解析不到,调用处落未判定,不猜目录 */
    }
  }
  function readFaceOne(p, fc, store) {
    if (store.has(p)) return store.get(p)
    const t = readFace([p], fc).get(p) ?? null
    store.set(p, t)
    return t
  }
  const textOf = (p) => baseText.get(p) ?? readFaceOne(p, face, cache)

  const passed = []
  const undet = []
  const kept = []
  for (const h of hits) {
    if (!/^[A-Z]/.test(h.tag)) {
      kept.push(h)
      continue
    }
    const src = textOf(h.file)
    if (typeof src !== 'string') {
      undet.push({ file: h.file, line: h.line, reason: '命中所在文件内容取不到 ⇒ 跨文件一跳无法进行' })
      continue
    }
    const spec = parseImports(maskFaces(src).kept).get(h.tag)
    if (!spec) {
      // 没有 import 说明符 ⇒ 可能是本文件内自绘组件。按声明体当场取证;取不到才算未判定。
      const body = componentBody(maskFaces(src).code, h.tag)
      const ev = bodyProvidesFocus(body)
      if (ev) passed.push({ file: h.file, line: h.line, tag: h.tag, why: h.why, by: `本文件内 ${h.tag} 声明体提供聚焦(${ev})` })
      else if (body) kept.push({ ...h, by: `本文件内 ${h.tag} 声明体无聚焦条件` })
      else undet.push({ file: h.file, line: h.line, reason: `<${h.tag} 既无 import 说明符也切不出本文件声明体 ⇒ 是否由别处提供聚焦无法判定` })
      continue
    }
    const cands = resolveSpecPath(spec, h.file, nameToDir).filter((p) => facePaths.has(p))
    if (!cands.length) {
      if (isExternalPkgSpec(spec, nameToDir)) {
        // 第三方运行时包(`react-native` 这类):实现**不在被审面上**(node_modules 不入库,
        // apps/mobile-rn/tsconfig.json 的 paths 也只是把它指回 ./node_modules),仓内没有任何一份
        // 源可以藏住它的聚焦反馈 ⇒ 调用点就是本门拿得到的全部证据。方向取"喊"不取"静默":
        // 记命中并写明出处,由人裁决(与头注④同一取向;把它写成放过才是把没量到当量过了)。
        kept.push({ ...h, by: `import '${spec}' 是第三方运行时包,实现不在被审面上 ⇒ 调用点即全部证据` })
      } else {
        undet.push({ file: h.file, line: h.line, reason: `import '${spec}' 在被审面上解析不到实现文件 ⇒ 未判定(不判红也不放过)` })
      }
      continue
    }
    let verdict = null
    for (const p of cands) {
      const t = textOf(p)
      if (typeof t !== 'string') continue
      const { kept: k, code } = maskFaces(t)
      const body = componentBody(code, h.tag)
      if (body) {
        const ev = bodyProvidesFocus(body)
        verdict = ev
          ? { kind: 'passed', by: `导入件 ${p} 内 ${h.tag} 声明体提供聚焦(${ev})` }
          : { kind: 'hit', by: `导入件 ${p} 内 ${h.tag} 声明体无聚焦条件` }
        break
      }
      const sub = followBarrelExport(k, h.tag)
      if (sub) {
        const subCands = resolveSpecPath(sub, p, nameToDir).filter((q) => facePaths.has(q))
        for (const q of subCands) {
          const t2 = textOf(q)
          if (typeof t2 !== 'string') continue
          const c2 = maskFaces(t2).code
          const b2 = componentBody(c2, h.tag)
          if (!b2) continue
          const ev2 = bodyProvidesFocus(b2)
          verdict = ev2
            ? { kind: 'passed', by: `导入件 ${q}(经 barrel ${p})内 ${h.tag} 声明体提供聚焦(${ev2})` }
            : { kind: 'hit', by: `导入件 ${q}(经 barrel ${p})内 ${h.tag} 声明体无聚焦条件` }
          break
        }
        if (verdict) break
      }
    }
    if (!verdict) {
      undet.push({ file: h.file, line: h.line, reason: `import '${spec}' 解析到候选文件但切不出 ${h.tag} 声明体 ⇒ 未判定` })
      continue
    }
    if (verdict.kind === 'passed') passed.push({ file: h.file, line: h.line, tag: h.tag, why: h.why, by: verdict.by })
    else kept.push({ ...h, by: verdict.by })
  }
  return { hits: kept, passed, undet }
}

// ─── CSS 面判定(web 的另一种书写语言)─────────────────────────────────

const CSS_INPUT_SELECTOR = /(^|[\s,>+~(])(input|select|textarea)\b|\.[\w-]*(?:input|textarea|select|combobox|picker|search-box)[\w-]*/i
const CSS_FOCUS_PSEUDO = /::?focus(-visible|-within)?\b/
const CSS_EDGE_UTIL = /(^|[\s;:]|\})\s*(border|ring|outline|shadow)[\w-]*\s*[:=]|@apply[^;]*\b(border|ring|outline|shadow)\b/

/** 规则清单:`{sel, body, line}`(0 基行号)。花括号配平到 EOF 仍开着的规则 ⇒ 交调用方判未判定。 */
export function cssRules(src) {
  const text = String(src || '')
  const nl = []
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') nl.push(i)
  const lineOf = (pos) => {
    let lo = 0
    let hi = nl.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (nl[mid] < pos) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const rules = []
  const stack = []
  let buf = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '{') {
      stack.push({ sel: buf.trim(), line: lineOf(i) })
      buf = ''
    } else if (c === '}') {
      const r = stack.pop()
      if (r) rules.push({ sel: r.sel, body: buf, line: r.line })
      buf = ''
    } else buf += c
  }
  return { rules, unclosed: stack.length }
}

/** 选择器去掉聚焦伪类后的**基底**:常态规则与它的聚焦对照规则必须归到同一个基底。 */
export function cssBaseSelector(sel) {
  return String(sel || '')
    .replace(/::?focus(-visible|-within)?(?:\([^\)]*\))?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * BEM 修饰族:`.ai-input-shell--idle:focus-within` 与 `.ai-input-shell` 归到同一族 `.ai-input-shell`。
 * 为什么 CSS 侧不能只按逐字基底配对(实测 `apps/web/app/globals.css` 第一跑就为此产过两枚假阳):
 * 输入卡的描边画在基底类上,聚焦态由**互斥修饰类**承载(该文件 1035 行自己写明"分支互斥仍由 JSX
 * 决定,各态取用不同修饰类"),两串类名同时挂在同一枚元素上 ⇒ 聚焦反馈确实在位。按逐字基底判,
 * 这类"写在另一枚类名上的聚焦档"整型看不见,而门会逼人在基底类上再写一遍(重复实现=更糟)。
 * 切分只认 BEM 分隔符(`--` / `__`),所以 `.card-title:focus` **不会**替 `.card` 交差 ——
 * 放宽到普通连字符就会让子元素的聚焦规则替父元素免检(那是把红写成绿)。
 * 元素型选择器(`textarea` / `input`)没有类名 ⇒ 返回 null,只走逐字基底那条。
 */
export function cssModifierFamily(sel) {
  const toks = cssBaseSelector(sel).match(/\.[\w-]+/g)
  if (!toks || !toks.length) return null
  const last = toks[toks.length - 1].slice(1)
  const fam = last.split(/--|__/)[0]
  return fam ? `.${fam}` : null
}

export function judgeCss(rel, text) {
  const hits = []
  const passed = []
  const undet = []
  const { code } = maskFaces(text)
  const { rules, unclosed } = cssRules(code)
  if (unclosed)
    undet.push({ file: rel, reason: `花括号未配平(${unclosed} 层)⇒ 规则边界判不出,整份 CSS 不判红` })
  const focusBases = new Set()
  const focusFamilies = new Set()
  for (const r of rules) {
    if (!CSS_FOCUS_PSEUDO.test(r.sel)) continue
    if (!CSS_EDGE_UTIL.test(r.body)) continue
    focusBases.add(cssBaseSelector(r.sel))
    const fam = cssModifierFamily(r.sel)
    if (fam) focusFamilies.add(fam)
  }
  for (const r of rules) {
    const sel = r.sel
    if (!sel || sel.startsWith('@') || /^\d/.test(sel)) continue
    if (!CSS_INPUT_SELECTOR.test(sel)) continue
    // @apply 形态的工具类档:同一枚尺子(classToken)复用
    const applyTokens = [...String(r.body).matchAll(/@apply([^;]*)/g)].flatMap((m) =>
      m[1].trim().split(/\s+/),
    )
    const applyBorder = applyTokens.filter(isRestingBorderToken)
    const hasBorderDecl = borderDecls(r.body).filter((d) => d.visible).length > 0
    if (!hasBorderDecl && !applyBorder.length) continue
    if (CSS_FOCUS_PSEUDO.test(sel)) continue // 这一条自己就是聚焦档
    const base = cssBaseSelector(sel)
    const fam = cssModifierFamily(sel)
    const firstLine = (sel.split('\n').pop() || sel).trim()
    if (focusBases.has(base) || (fam && focusFamilies.has(fam))) {
      passed.push({
        file: rel,
        line: r.line + 1,
        tag: firstLine.slice(0, 60),
        by: focusBases.has(base) ? '同基底有 :focus 规则' : '同修饰族有 :focus 规则(BEM 互斥档)',
      })
      continue
    }
    hits.push({
      file: rel,
      end: 'css',
      line: r.line + 1,
      tag: firstLine.slice(0, 60),
      why: hasBorderDecl ? 'border 声明' : applyBorder.join(','),
    })
  }
  return { hits, passed, undet, unresolved: 0, scanned: rules.length > 0 }
}

export function judgeText(rel, text) {
  const end = endOf(rel)
  if (!end || typeof text !== 'string') return { end: end || null, hits: [], passed: [], undet: [], unresolved: 0, scanned: false }
  if (end === 'css') return { end, ...judgeCss(rel, text) }
  return { end, ...judgeJsx(rel, text, end) }
}

// ─── 取材:清单与内容同面同轮 ────────────────────────────────────────────

function listFacePaths(face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], ROOT, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  if (face === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], ROOT, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-files', '-z'], ROOT, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
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

export function analyze(face) {
  const all = listFacePaths(face)
  const facePaths = new Set(all)
  const files = all.filter((p) => endOf(p) && SCAN_EXT.test(p))
  const contents = readFace(files, face)
  let hits = []
  const passed = []
  const undetermined = []
  const counts = new Map()
  const headCounts = new Map()
  const f2Counts = new Map()
  const f2HeadCounts = new Map()
  const f2Sites = []
  const unreadable = []
  let unresolvedStyleRefs = 0
  let f2Unresolved = 0
  let rebuiltWindows = 0
  const perEnd = {}
  for (const f of files) {
    const text = contents.get(f)
    if (typeof text !== 'string') {
      unreadable.push(f)
      continue
    }
    const r = judgeText(f, text)
    perEnd[r.end] = (perEnd[r.end] || 0) + 1
    unresolvedStyleRefs += r.unresolved
    rebuiltWindows += r.rebuilt || 0
    f2Unresolved += (r.f2Unresolved || []).length
    for (const s of r.f2 || []) f2Sites.push(s)
    for (const x of r.undet) undetermined.push(x)
    passed.push(...r.passed)
    if (r.hits.length) {
      counts.set(f, r.hits.length)
      hits.push(...r.hits)
    }
  }
  // 跨文件一跳:大写标签的命中先看件内证据(见 reclassifyHits 头注的立因)。
  const rc = reclassifyHits(hits, face, facePaths, contents)
  hits = rc.hits
  passed.push(...rc.passed)
  undetermined.push(...rc.undet)
  counts.clear()
  for (const h of hits) counts.set(h.file, (counts.get(h.file) || 0) + 1)
  for (const s of f2Sites) f2Counts.set(s.file, (f2Counts.get(s.file) || 0) + 1)
  // 棘轮锚点:同一批文件在 **HEAD** 自身的命中数。判 head 面时两者同一次读数 ⇒ 存量恒等于本轮,
  // 这正是"全量档只报数"的语义;判 staged/worktree 面时才真读到上一枚提交。
  if (face === 'head') {
    for (const [f, n] of counts) headCounts.set(f, n)
    for (const [f, n] of f2Counts) f2HeadCounts.set(f, n)
  } else {
    const headMap = readFace(files, 'head')
    const headPaths = new Set(listFacePaths('head'))
    const headHits = []
    const headF2 = []
    for (const f of files) {
      const t = headMap.get(f)
      if (typeof t !== 'string') continue
      const hr = judgeText(f, t)
      headHits.push(...hr.hits)
      for (const s of hr.f2 || []) headF2.push(s)
    }
    // 锚点必须与本轮**同一把尺子**(含跨文件一跳),否则"尺子变准"会被读成"仓库新增命中"。
    const rcHead = reclassifyHits(headHits, 'head', headPaths, headMap)
    for (const h of rcHead.hits) headCounts.set(h.file, (headCounts.get(h.file) || 0) + 1)
    // F2 的锚点同样取 HEAD 面(f2 不走跨文件一跳:几何键就在调用点/同文件声明体里,与导入件无关)。
    for (const s of headF2) f2HeadCounts.set(s.file, (f2HeadCounts.get(s.file) || 0) + 1)
  }
  const red = ratchetRed(counts, headCounts, (f) => hits.filter((h) => h.file === f))
  const f2Red = ratchetRed(f2Counts, f2HeadCounts, (f) => f2Sites.filter((s) => s.file === f))
  const emptyScan = face === 'head' && files.length === 0
  return {
    face,
    scannedFiles: files.length,
    perEnd,
    unreadable,
    undetermined,
    total: hits.length,
    sites: hits,
    filesWithHits: counts.size,
    f2Total: f2Sites.length,
    f2Sites,
    f2FilesWithHits: f2Counts.size,
    f2Unresolved,
    f2Red,
    passedCount: passed.length,
    unresolvedStyleRefs,
    rebuiltWindows,
    red,
    emptyScan,
    exit:
      unreadable.length || emptyScan || (argvStrict && undetermined.length)
        ? 2
        : red.length || f2Red.length
          ? 1
          : 0,
  }
}

let argvStrict = false

function runSelfTest() {
  let fail = 0
  const ok = (name, cond) => {
    if (cond) console.log(`✅ ${name}`)
    else {
      fail++
      console.log(`❌ ${name}`)
    }
  }
  const J = (rel, src) => judgeText(rel, src)
  const RN = 'packages/app/src/features/probe/Probe.tsx'
  const MP = 'apps/miniapp-taro/src/components/Probe.tsx'
  const WB = 'apps/web/src/features/probe/page.tsx'
  const CS = 'apps/web/src/styles/probe.css'

  // ── S1 合规站点不得误报(三端各一枚)──
  const m1 = `<View className="wrap">
  <Input className="w-full border border-border rounded-sm" {...ff.spread} style={ff.focusStyle} />
</View>`
  ok('S1a 小程序:border + ff.spread/focusStyle ⇒ 放过', (() => { const r = J(MP, m1); return r.hits.length === 0 && r.passed.length === 1 })())
  const w1 = `<div>
  <input className="w-full border border-input focus-visible:border-primary" />
</div>`
  ok('S1b web:focus-visible 工具类档 ⇒ 放过', (() => { const r = J(WB, w1); return r.hits.length === 0 && r.passed.length === 1 })())
  const r1 = `const styles = createStyles({
  input: { borderWidth: 1, borderColor: '#DDDDDD' },
  inputFocused: { borderColor: '#000000' },
})
export function Probe() {
  const [focused, setFocused] = useState(false)
  return (
    <TextInput
      style={[styles.input, focused ? styles.inputFocused : null]}
      onFocus={() => setFocused(true)}
    />
  )
}`
  ok('S1c RN:聚焦档键 + onFocus ⇒ 放过', (() => { const r = J(RN, r1); return r.hits.length === 0 && r.passed.length === 1 })())

  // ── S2 摘掉聚焦反馈必须转红(与 S1 成对:文本只差聚焦那一处)──
  ok('S2a 小程序:摘掉 ff.* ⇒ 必须点名', (() => { const r = J(MP, m1.replace('{...ff.spread} ', '').replace(' style={ff.focusStyle}', '')); return r.hits.length === 1 && r.hits[0].line === 2 })())
  ok('S2b web:摘掉 focus-visible 档 ⇒ 必须点名', (() => { const r = J(WB, w1.replace(' focus-visible:border-primary', '')); return r.hits.length === 1 })())
  ok('S2c RN:摘掉聚焦档与 onFocus ⇒ 必须点名', (() => { const r = J(RN, r1.replace(', focused ? styles.inputFocused : null', '').replace(/\s*onFocus=\{\(\) => setFocused\(true\)\}/, '')); return r.hits.length === 1 })())
  ok('S2d RN:换成唯一实现 TextField ⇒ 放过', (() => { const r = J(RN, r1.replace('<TextInput', '<TextField').replace('/>', '/>')); return r.hits.length === 0 })())
  const m2 = `<FocusField>
  <Input className="border border-border" />
</FocusField>`
  ok('S2e 祖先即唯一实现(FocusField)⇒ 放过', (() => { const r = J(MP, m2); return r.hits.length === 0 && r.passed.length === 1 })())

  // ── S3 聚焦措辞只写在注释里 ⇒ 不算聚焦(反向锁:改成真 prop 就必须放过)──
  const m3 = `<View>
  <Input
    className="border border-border"
    /* focus:border-primary 早就接了,别担心 */
    placeholder="手机号"
  />
</View>`
  ok('S3 注释里的聚焦字样不得计入(判据不能读自己的说明)', (() => { const r = J(MP, m3); return r.hits.length === 1 })())
  ok('S3 配对:同一枚改成真 props 行必须放过', (() => { const r = J(MP, m3.replace('/* focus:border-primary 早就接了,别担心 */', 'onFocus={onFocus}')); return r.hits.length === 0 })())
  const m3b = `<View>
  {/* border border-border 只是说明,真类名里没有描边 */}
  <Input className="bg-muted" />
</View>`
  ok('S3c 注释里的**描边**字样也不得算描边证据', (() => { const r = J(MP, m3b); return r.hits.length === 0 })())
  const m3d = `<View>
  {/* border border-border 只是说明,真类名里没有描边 */}
  <Input className="border border-border" onFocus={onFocus} />
</View>`
  ok('S3d 配对:描边写进真类名 ⇒ 立刻进入射程(有聚焦故放过)', (() => { const r = J(MP, m3d); return r.hits.length === 0 && r.passed.length === 1 })())

  // ── S4 十余行外兄弟容器的描边不得算给本元素(历史假阳的反向锁)──
  const fill = Array.from({ length: 12 }, (_, i) => `    <Text key={${i}} className="row-${i}">l${i}</Text>`).join('\n')
  const m4 = `<View className="border-t border-border">
${fill}
  <Input
    className="bg-white"
    placeholder="模型名称"
  />
</View>`
  ok('S4a 兄弟容器 border-t 不得归属本输入框(= 0 命中)', (() => { const r = J(MP, m4); return r.hits.length === 0 })())
  const m4b = m4.replace('className="bg-white"', 'className="border border-border"')
  ok('S4b 反向锁:同一枚把描边移进自己的属性区 ⇒ 必须命中', (() => { const r = J(MP, m4b); return r.hits.length === 1 })())
  const r4 = `const styles = createStyles({
  card: { borderColor: '#EEEEEE', padding: 12 },
})
${fill.replace(/Text key=\{(\d+)\}/g, 'View key={$1}')}
export function Probe() {
  return (
    <ScrollView>
      <TextInput style={styles.card} />
    </ScrollView>
  )
}`
  ok('S4c RN:十余行外样式键的描边不得算给输入框(键必须被自己引用)', (() => { const r = J(RN, r4.replace('styles.card', 'styles.someOther')); return r.hits.length === 0 })())

  // ── S5 属性区闭合无法确定 ⇒ 未判定(既不红也不绿)──
  const m5 = `<View>
  <Input
    className="border border-border"
${Array.from({ length: 45 }, (_, i) => `    data-x${i}="${i}"`).join('\n')}
</View>`
  ok('S5 开标签 40 行内找不到闭合 ⇒ 未判定,且绝不判红', (() => { const r = J(MP, m5); return r.hits.length === 0 && r.undet.length >= 1 })())

  // ── S6 CSS 档(第三种书写语言)──
  const c1 = `.search-box {
  border: 1px solid #cccccc;
  border-radius: 6px;
}
.search-box:focus-visible {
  border-color: #000000;
}
textarea {
  border: 1px solid #dddddd;
}`
  ok('S6a CSS:同基底有 :focus 规则 ⇒ 放过;缺对照 ⇒ 点名', (() => { const r = J(CS, c1); return r.hits.length === 1 && r.passed.length === 1 && /textarea/.test(r.hits[0].tag) })())
  const c2 = `@layer components {
  .ui-input {
    @apply border border-input rounded-md;
  }
}`
  ok('S6b CSS:@apply 工具类形态也进入射程', (() => { const r = J(CS, c2); return r.hits.length === 1 })())
  const c3 = `.ui-input {
  border-style: none;
  border-radius: 8px;
}`
  ok('S6c border-style:none / 只有圆角 ⇒ 不是描边证据', (() => { const r = J(CS, c3); return r.hits.length === 0 })())
  const c4 = `.broken-rule {
  border: 1px solid #ccc;`
  ok('S6d 花括号配不平 ⇒ 未判定,不判红', (() => { const r = J(CS, c4); return r.hits.length === 0 && r.undet.length === 1 })())
  const c5 = `.ai-input-shell {
  border-color: var(--color-input);
}
.ai-input-shell--idle:focus-within {
  border-color: var(--color-primary);
}
.search-box-label:focus {
  border-color: #000000;
}
.search-box {
  border: 1px solid #cccccc;
}`
  ok(
    'S6e BEM 互斥修饰档承载的聚焦态算反馈;子元素聚焦规则不得替父元素免检',
    (() => {
      const r = J(CS, c5)
      return r.passed.length === 1 && r.hits.length === 1 && r.hits[0].tag === '.search-box'
    })(),
  )

  // ── S7 取值不可见的描边不算证据 ──
  ok('S7 borderColor:"transparent" 且无聚焦 ⇒ 不构成常态描边', (() => { const r = J(MP, `<Input className="border" style="border-color: transparent" onFocus={f} />`); return r.hits.length === 0 })())

  // ── S8 面:两面旗同给必须判死;内容取不到不回退磁盘 ──
  const f1 = selectFace({ staged: true, worktree: true, def: 'head' })
  ok('S8a --staged 与 --worktree 同给 ⇒ error(调用方 exit 2)', !!f1.error && f1.face === null)
  ok('S8b 默认面是 HEAD blob', selectFace({ staged: false, worktree: false, def: 'head' }).face === 'head')

  // ── S9 行内豁免必须带原因 ──
  ok('S9a 裸标记(input-focus-exempt:)不得放行', (() => { const r = J(MP, `<Input\n  // input-focus-exempt:\n  className="border border-border"\n/>`); return r.hits.length === 1 })())
  ok('S9b 带原因的豁免标记放行', (() => { const r = J(MP, `<Input\n  // input-focus-exempt: 只读展示框,永不聚焦\n  className="border border-border"\n/>`); return r.hits.length === 0 })())

  // ── 跨文件一跳(本门第一次对自己产出的形态失明的那一格)──────────────────
  // 立因是真站点的假阳:`AgentRuntimePanel.tsx:142` 的 `<Input>` 来自 `@ihui/ui-native`,
  // 件内 `:127` 就有 `focused ? { borderColor: primaryColor }`。尺子看不见 ⇒ 把正确写法判成债。
  const CALL = 'apps/mobile-rn/src/components/X.tsx'
  const IMPL = 'packages/ui-native/src/input.tsx'
  const BARREL = 'packages/ui-native/src/index.ts'
  const PKGJSON = 'packages/ui-native/package.json'
  const callText = `import { Input } from '@ihui/ui-native'\nexport const P = () => (\n  <Input className="border p-2" style={{ borderColor: tk.border.light }} />\n)\n`
  const mkImpl = (body) =>
    `function Input({\n  className,\n  style,\n  onFocus,\n}: Props) {\n  return <TextInput style={[style, ${body}]} className={className} />\n}\nexport { Input }\n`
  const okImpl = mkImpl('focused ? { borderColor: primaryColor } : null')
  const badImpl = mkImpl('null')
  const pkgJson = '{"name":"@ihui/ui-native"}'
  const barrelText = `export { Input, type InputProps } from './input'\n`
  const face4 = new Set([CALL, IMPL, BARREL, PKGJSON])
  const RC = (map) => reclassifyHits([{ file: CALL, end: 'rn', line: 3, tag: 'Input', why: 'border' }], 'head', face4, map)
  ok(
    'S10 导入件内部提供聚焦 ⇒ 命中转放过(且命中归零、放过带出处)',
    (() => {
      const r = RC(new Map([[CALL, callText], [IMPL, okImpl], [PKGJSON, pkgJson]]))
      return r.hits.length === 0 && r.passed.length === 1 && /声明体提供聚焦/.test(r.passed[0].by)
    })(),
  )
  ok(
    'S11 导入件内没有聚焦条件 ⇒ 仍记命中(看不见不等于放过)',
    (() => {
      const r = RC(new Map([[CALL, callText], [IMPL, badImpl], [PKGJSON, pkgJson]]))
      return r.hits.length === 1 && r.passed.length === 0 && /无聚焦条件/.test(r.hits[0].by)
    })(),
  )
  ok(
    'S12 说明符在被审面上解析不到 ⇒ 落未判定,既不判红也不放过',
    (() => {
      const f = new Set([CALL, PKGJSON]) // 目标件不在面上
      const r = reclassifyHits([{ file: CALL, end: 'rn', line: 3, tag: 'Input', why: 'border' }], 'head', f, new Map([[CALL, callText], [PKGJSON, pkgJson]]))
      return r.hits.length === 0 && r.undet.length === 1 && /解析不到实现文件/.test(r.undet[0].reason)
    })(),
  )
  ok(
    'S13 参数解构形态必须取到函数体(变异自证:取"名字后第一个 {"会截到参数对象)',
    (() => {
      const { code } = maskFaces(okImpl)
      const body = componentBody(code, 'Input')
      // 旧写法(body 只到参数对象闭合)必然不含 `focused ?`;新写法必须同时含参数区与返回体
      return !!body && /focused \? \{ borderColor: primaryColor \}/.test(body) && body.includes('className,')
    })(),
  )
  ok(
    'S14 无 import 的本文件自绘组件 ⇒ 按声明体取证,正反各一条',
    (() => {
      const selfDrawn = `function Input({ style }: Props) {\n  return <TextInput style={[style, focused ? { borderColor: tk.brand.DEFAULT } : null]} />\n}\n`
      const selfBad = `function Input({ style }: Props) {\n  return <TextInput style={[style, null]} />\n}\n`
      const hit = { file: CALL, end: 'rn', line: 1, tag: 'Input', why: 'border' }
      const a = reclassifyHits([hit], 'head', new Set([CALL]), new Map([[CALL, selfDrawn]]))
      const b = reclassifyHits([hit], 'head', new Set([CALL]), new Map([[CALL, selfBad]]))
      return a.hits.length === 0 && a.passed.length === 1 && b.hits.length === 1 && b.passed.length === 0
    })(),
  )
  ok(
    'S15 经 barrel 一跳也能取证(ui-native 的真实形态就是 index.ts 转发)',
    (() => {
      const r = RC(new Map([[CALL, callText], [BARREL, barrelText], [IMPL, okImpl], [PKGJSON, pkgJson]]))
      return r.hits.length === 0 && r.passed.length === 1 && /经 barrel/.test(r.passed[0].by)
    })(),
  )
  ok(
    'S16 小写宿主标签不走跨文件一跳(它没有"另一份实现"可言)',
    (() => {
      const r = reclassifyHits([{ file: 'apps/web/a.tsx', end: 'web', line: 2, tag: 'textarea', why: 'border' }], 'head', face4, new Map())
      return r.hits.length === 1 && r.undet.length === 0
    })(),
  )
  ok(
    'S17 真仓阳性对照:AgentRuntimePanel:142 必须被这一跳救成放过(钉 HEAD 面读数,不钉本文数字)',
    (() => {
      const a = analyze('head')
      const still = (a.sites || []).some((s) => s.file === 'apps/mobile-rn/src/components/AgentRuntimePanel.tsx' && s.line === 142)
      return !still
    })(),
  )

  // ── S18 F2:RN focusedStyle 只准覆盖颜色、不得带几何键(TextField.tsx 文档明令)──
  const F2RN = (prop) => `export function P() {\n  return <TextField colorScheme="light" ${prop} />\n}`
  ok('S18a focusedStyle 内联 borderWidth ⇒ F2 命中,且 F1 不咬(TextField 是唯一实现,两维不互相污染)', (() => {
    const r = J(RN, F2RN('focusedStyle={{ borderWidth: 2 }}'))
    return r.f2.length === 1 && r.f2[0].keys.includes('borderWidth') && r.f2[0].dim === 'F2' && r.hits.length === 0
  })())
  ok('S18b focusedStyle 只换色(borderColor)⇒ 不判(文档明令的合法用法)', (() => {
    const r = J(RN, F2RN(`focusedStyle={{ borderColor: '#FF0000' }}`))
    return r.f2.length === 0 && r.f2Unresolved.length === 0
  })())
  ok('S18c 注释里的 borderWidth 不得算(遮罩生效:判代码结构的面注释与字符串都遮)', (() => {
    const r = J(RN, F2RN(`focusedStyle={{ /* borderWidth: 2 */ borderColor: '#000000' }}`))
    return r.f2.length === 0
  })())
  ok('S18d 嵌套值里的 width/height 不是聚焦几何(shadowOffset: { width, height } 是取值)', (() => {
    const r = J(RN, F2RN(`focusedStyle={{ shadowOffset: { width: 0, height: 2 } }}`))
    return r.f2.length === 0
  })())
  ok('S18e 引用形态:styles.inputFocused 声明体带 borderWidth ⇒ 命中;纯色声明 ⇒ 放过', (() => {
    const mk = (body) =>
      `const styles = StyleSheet.create({\n  inputFocused: ${body},\n})\nexport function P() {\n  return <TextField colorScheme="light" focusedStyle={styles.inputFocused} />\n}`
    const red = J(RN, mk(`{ borderWidth: 2, borderColor: '#000000' }`))
    const green = J(RN, mk(`{ borderColor: '#000000' }`))
    return red.f2.length === 1 && red.f2[0].via === 'styles.inputFocused' && green.f2.length === 0
  })())
  ok('S18f tests/__tests__ 路径豁免(夹具本来就要写坏形状)', (() => {
    const a = J('packages/app/src/features/probe/__tests__/Probe.test.tsx', F2RN('focusedStyle={{ borderWidth: 2 }}'))
    const b = J('packages/app/src/features/probe/Probe.test.tsx', F2RN('focusedStyle={{ borderWidth: 2 }}'))
    return a.f2.length === 0 && b.f2.length === 0
  })())
  ok('S18g web/miniapp 不在 F2 射程(同名 prop 写法不咬)', (() => {
    const w = J(WB, `<input className="border" focusedStyle={{ borderWidth: 2 }} />`)
    const m = J(MP, `<Input className="border" focusedStyle={{ borderWidth: 2 }} />`)
    return w.f2.length === 0 && m.f2.length === 0
  })())
  ok('S18h 条件三元/裸变量 ⇒ f2Unresolved 出声,不判红也不记绿(§0.3:没判绝不写成判过)', (() => {
    const ternary = J(RN, F2RN('focusedStyle={focused ? a : b}'))
    const bare = J(RN, F2RN('focusedStyle={someVar}'))
    return (
      ternary.f2.length === 0 &&
      ternary.f2Unresolved.length === 1 &&
      bare.f2.length === 0 &&
      bare.f2Unresolved.length === 1
    )
  })())

  console.log(`--self-test: ${fail === 0 ? '全部通过' : `${fail} 条失败`}`)
  return fail
}

function main() {
  const argv = process.argv.slice(2)
  argvStrict = argv.includes('--strict')
  if (process.env[SELF_SKIP] === '1' && !argv.includes('--self-test')) {
    console.log(`⏭ 已跳过(${SELF_SKIP}=1)`)
    process.exit(0)
  }
  if (argv.includes('--self-test')) {
    process.exitCode = runSelfTest() === 0 ? 0 : 1
    return
  }
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    process.exit(2)
  }
  const r = analyze(picked.face)
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.exit
    return
  }
  console.log(
    `[input-focus-feedback] 面:${r.face} · 扫描 ${r.scannedFiles} 文件(${Object.entries(r.perEnd).map(([k, v]) => `${k}:${v}`).join(' ')})`,
  )
  if (r.unreadable.length)
    console.log(
      `❌ 无法判定:${r.unreadable.length} 个候选文件在本面取不到内容(不回退磁盘,不记绿),首个:${r.unreadable[0]}`,
    )
  if (r.emptyScan)
    console.log(
      '❌ 无法判定:head 面枚举到 **0 个**候选文件 —— 只可能是枚举面或仓库根错位,不得读成"没有描边输入框"',
    )
  if (r.unresolvedStyleRefs)
    console.log(
      `⚠️ 射程外:${r.unresolvedStyleRefs} 处 style 引用在本文件解不到样式键(跨文件常量 / 函数返回值)⇒ 是否描边无法判定,本门不猜`,
    )
  if (r.rebuiltWindows)
    console.log(
      `ℹ️ 取证窗重建:${r.rebuiltWindows} 枚输入控件的开标签主扫描器在 ${MAX_TAG_LINES} 行档内建不出来(被超窗容器连坐),已按 JSX 结构配平重新取窗并照常判定`,
    )
  if (r.red.length) {
    console.log(`❌ F1 有描边却无聚焦反馈(超出该文件 HEAD 自身存量)${r.red.length} 个文件:`)
    for (const x of r.red.slice(0, 40))
      for (const s of x.sites.slice(0, 5))
        console.log(`   ${s.file}:${s.line}  <${s.tag}>  描边:${s.why}  聚焦:无(HEAD ${x.cap} → 现 ${x.n})`)
    if (r.red.length > 40) console.log(`   …其余 ${r.red.length - 40} 个文件见 --json`)
    console.log(
      '   出路:接入本端唯一实现 —— 小程序 useFieldFocus/FocusField、RN packages/app TextField、web focus-visible:border-*;\n' +
        '         确属例外写 `input-focus-exempt: <原因>`(带原因)。',
    )
  } else if (r.total) {
    console.log(
      `✅ F1 无新增。存量 ${r.total} 处 / ${r.filesWithHits} 文件按"HEAD 自身存量"棘轮只报数 —— 存量不为 0,**接线前须先清存量,否则恒红门(§12e)**`,
    )
  } else {
    console.log(`✅ F1 命中 0 处(本面没有任何"有描边却无聚焦反馈"的控件)`)
  }
  if (r.f2Red.length) {
    console.log(`❌ F2 RN focusedStyle 带几何键(超出该文件 HEAD 自身存量)${r.f2Red.length} 个文件:`)
    for (const x of r.f2Red.slice(0, 40))
      for (const s of x.sites.slice(0, 5))
        console.log(`   ${s.file}:${s.line}  ${s.via}  几何键:${s.keys.join(',')}(HEAD ${x.cap} → 现 ${x.n})`)
    if (r.f2Red.length > 40) console.log(`   …其余 ${r.f2Red.length - 40} 个文件见 --json`)
    console.log(
      '   出路:focusedStyle 只准覆盖颜色(TextField.tsx 文档明令);宽度/内边距的占位写在常态 style 里,聚焦只换 borderColor —— 聚焦加粗会压缩固定高度的内容区、顶起文字。',
    )
  } else if (r.f2Total) {
    console.log(
      `✅ F2 无新增。存量 ${r.f2Total} 处 / ${r.f2FilesWithHits} 文件按"HEAD 自身存量"棘轮只报数`,
    )
  } else {
    console.log(`✅ F2 命中 0 处(RN focusedStyle 没有任何带几何键的站点)`)
  }
  if (r.f2Unresolved)
    console.log(
      `⚠️ F2 射程外:${r.f2Unresolved} 处 focusedStyle 引用键静态不可见(条件三元/数组/裸变量/声明体切不出)⇒ 是否带几何键判不出,本门不猜`,
    )
  console.log(
    `三态点名:命中 ${r.total} · 放过 ${r.passedCount} · 未判定 ${r.undetermined.length}${argvStrict ? '(--strict:未判定>0 即 exit 2)' : ''}`,
  )
  if (r.undetermined.length)
    console.log(
      `   未判定明细:${r.undetermined.slice(0, 10).map((u) => `${u.file}${u.line ? ':' + u.line : ''} ${u.reason}`).join(' | ')}`,
    )
  // 末行必须是**结论**,不能是明细 —— 验收要求"贴末行原文",明细当末行就把结论挤出了可核对区。
  console.log(
    r.exit === 2
      ? `❌ 结论:无法判定(exit 2)—— 未判定 ${r.undetermined.length} 处 / 取不到内容 ${r.unreadable.length} 个 / 空扫 ${r.emptyScan ? 1 : 0}`
      : r.exit === 1
        ? `❌ 结论:F1 新增 ${r.red.length} 个文件 / F2 新增 ${r.f2Red.length} 个文件(超出各自 HEAD 存量)⇒ 判红`
        : `✅ 结论:F1 无新增(存量 ${r.total} 处 / ${r.filesWithHits} 文件只报数);F2 无新增(存量 ${r.f2Total} 处 / ${r.f2FilesWithHits} 文件只报数)`,
  )
  process.exitCode = r.exit
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href
)
  main()

export const __test__ = {
  judgeText,
  judgeJsx,
  judgeCss,
  endOf,
  analyze,
  isRestingBorderToken,
  isFocusClassToken,
  isFocusTierKey,
  borderDecls,
  styleBlocks,
  styleKeyBody,
  cssRules,
  cssBaseSelector,
  cssModifierFamily,
  FOCUS_CODE,
  EXEMPT,
  SELF_SKIP,
  INPUT_TAGS,
  SINGLE_IMPL,
  SCAN_ROOTS,
  // 跨文件一跳的六个出口(镜像测试一律经这些生产入口,不得在测试里另写一份解析规则,§22c)
  reclassifyHits,
  componentBody,
  parseImports,
  followBarrelExport,
  resolveSpecPath,
  bodyProvidesFocus,
  // 取证窗重建与第三方说明符分类的出口(同上:镜像只调这些,不复制判据)
  openTagRegion,
  pkgNameOf,
  isExternalPkgSpec,
  MAX_TAG_LINES,
  STRUCT_MAX_TAG_LINES,
  // F2(RN focusedStyle 几何键禁令)的出口(镜像只调这些,不复制判据)
  judgeFocusedStyleGeometry,
  isGeometryStyleKey,
  braceBody,
  topLevelKeys,
  styleKeyDeclBodies,
  ratchetRed,
  TEST_PATH_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
