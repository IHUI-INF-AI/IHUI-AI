#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-input-focus-feedback.mjs —— 「有描边的输入/选择控件对聚焦无反应」三端对账
 * (台账 G-1113923,2026-10-08 立;blocking 定级由主会话接线时裁定)
 *
 * 【接线状态:未接入】—— 注册表由主会话单写者接线。镜像测试按 `scripts/guardian-runner.mjs`
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
 * 开标签闭合无法确定 ⇒ 落"未判定",绝不判红(与 lib/jsx-scope、lib/box-geometry 同一条规矩)。
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
import { hasJsxShape, scanJsx } from './lib/jsx-scope.mjs'
import { objectScope } from './lib/box-geometry.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000
const SELF_SKIP = 'HUSKY_SKIP_INPUT_FOCUS_FEEDBACK'
const EXEMPT = /input-focus-exempt:\s*\S/
/** 与 lib/jsx-scope 的 `MAX_TAG_SPAN_LINES` 同值;本门只用它写措辞,不另起一份窗口实现。 */
const MAX_TAG_LINES = 40
const SCAN_ROOTS = ['apps/web/', 'apps/miniapp-taro/src/', 'apps/mobile-rn/src/', 'packages/app/src/']
const SCAN_EXT = /\.(tsx|jsx|css)$/

/** 三端各自的书写语言 ⇒ 各自的标签集合与判据分支。 */
const SINGLE_IMPL = new Set(['TextField', 'FocusField', 'FocusInput', 'FocusTextarea'])
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

  for (const el of scope.elements) {
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
    if (!chainTrusted && (el.ancestors || []).some((a) => SINGLE_IMPL.has(a))) {
      undet.push({ file: rel, line: el.line, reason: `标签栈失配(${scope.corrupt} 处)⇒ 祖先链不可信,唯一实现豁免不敢用` })
      continue
    }
    if (chainTrusted && (el.ancestors || []).some((a) => SINGLE_IMPL.has(a))) {
      const a = (el.ancestors || []).find((x) => SINGLE_IMPL.has(x))
      passed.push({ file: rel, line: el.line, tag: el.base, why, by: `祖先 ${a} 提供聚焦` })
      continue
    }
    hits.push({ file: rel, end, line: el.line, tag: el.base, why })
  }
  /**
   * 开标签在 40 行内找不到闭合(jsx-scope `truncated`)⇒ **不建元素**,本门就看不见这一枚。
   * 落到行号的做法:把"本端输入控件开标签的出现次数"与"建成元素的次数"对账,多出来的那些出现
   * 就是没建成的。只比**名字落在本端标签集**里的出现,所以泛型(`useState<Mode>`)、
   * 内联 SVG 串、比较式里的 `<` 都不会被算进来 —— 那些不是输入控件,把它们写成"未判定"
   * 只会让 44 条噪声淹没真该点名的那几条(实测本仓 truncated 大多来自这一型)。
   * 字符串区间直接取 maskFaces 的那一份(词法只有一台),串里的 `<Input` 不算开标签。
   */
  if (scope.truncated) {
    const built = new Map()
    for (const e of scope.elements) {
      const k = `${e.line}|${e.base}`
      built.set(k, (built.get(k) || 0) + 1)
    }
    const inString = (idx) => (strings || []).some((s) => idx >= s.start && idx < s.end)
    for (const base of tags) {
      const re = new RegExp(`<${base}(?![\\w.])`, 'g')
      let m
      while ((m = re.exec(kept))) {
        if (inString(m.index)) continue
        const line = kept.slice(0, m.index).split('\n').length
        const k = `${line}|${base}`
        const n = built.get(k) || 0
        if (n > 0) {
          built.set(k, n - 1) // 这一枚确实建成了元素
          continue
        }
        undet.push({
          file: rel,
          line,
          reason: `<${base} 开标签未能建成元素(闭合在 ${MAX_TAG_LINES} 行内找不到)⇒ 是否描边无法判定,不判红也不记绿`,
        })
      }
    }
  }
  return { hits, passed, undet, unresolved, scanned: true }
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
  const files = all.filter((p) => endOf(p) && SCAN_EXT.test(p))
  const contents = readFace(files, face)
  const hits = []
  const passed = []
  const undetermined = []
  const counts = new Map()
  const headCounts = new Map()
  const unreadable = []
  let unresolvedStyleRefs = 0
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
    for (const x of r.undet) undetermined.push(x)
    passed.push(...r.passed)
    if (r.hits.length) {
      counts.set(f, r.hits.length)
      hits.push(...r.hits)
    }
  }
  // 棘轮锚点:同一批文件在 **HEAD** 自身的命中数。判 head 面时两者同一次读数 ⇒ 存量恒等于本轮,
  // 这正是"全量档只报数"的语义;判 staged/worktree 面时才真读到上一枚提交。
  if (face === 'head') {
    for (const [f, n] of counts) headCounts.set(f, n)
  } else {
    const headMap = readFace(files, 'head')
    for (const f of files) {
      const t = headMap.get(f)
      if (typeof t !== 'string') continue
      headCounts.set(f, judgeText(f, t).hits.length)
    }
  }
  const red = []
  for (const [f, n] of [...counts].sort()) {
    const cap = headCounts.get(f) ?? 0
    if (n > cap) red.push({ file: f, n, cap, sites: hits.filter((h) => h.file === f) })
  }
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
    passedCount: passed.length,
    unresolvedStyleRefs,
    red,
    emptyScan,
    exit:
      unreadable.length || emptyScan || (argvStrict && undetermined.length)
        ? 2
        : red.length
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
        ? `❌ 结论:F1 新增 ${r.red.length} 个文件(超出各自 HEAD 存量)⇒ 判红`
        : `✅ 结论:F1 无新增(存量 ${r.total} 处 / ${r.filesWithHits} 文件只报数)`,
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
