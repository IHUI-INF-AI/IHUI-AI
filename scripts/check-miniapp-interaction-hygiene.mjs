#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门 290:小程序交互卫生门(blocking 只判「静态可证的死可点」,其余降 advisory)
 *
 * 立因(2026-11-03,P2 自动化缺口):
 *  小程序端与 RN 端不同 —— RN 的可点面由 `Pressable`/`Touchable` 表达,小程序 Taro 的 `View`/`Text`
 *  天生可挂 `onClick`。所以本门**不**把"View 上出现 onClick"本身判红:那样会一次造出 300+ 条
 *  「按规定就该这么写」的红点,结局只有一个 —— 全员跳门,连同其余守门一起作废(§12e)。
 *  本门把判据切成"机器证得出的死可点"与"需要人看观感的弱信号"两档:
 *
 *  A1 blocking —— 假可点(绝对零容忍):
 *     a) `onClick`/`onLongClick`/`onTap` 绑定**空实现**:`() => {}`、`() => undefined`、
 *        `() => void 0`、`() => null`、`{noop}` 且本文件/导入里该名字确为空函数;
 *     b) 可点标签的 className 同时带 `pointer-events-none` —— 点击在样式层就被关掉,
 *        挂上去的 handler 永远不会执行(设计意图另说,静态上就是死可点)。
 *     c) handler 字面量是 `undefined`/`null`。
 *     现读 HEAD 面 a/b/c 合计 **0**:本轮实测 719 文件 / 8464 标签(847 个可点)/ 0 死可点。
 *
 *  A2 blocking —— 空端口(与守门「端口等价层」同一份端口名,不造第二套):
 *      `onNavigate`/`onToast`/… 被赋值为空实现(JSX 属性或对象字面量两种写法)。
 *      端口名直接 `import` `check-host-port-equivalence.mjs` 的 `PORT_TYPE_DECLARATIONS`,
 *      表里新增端口自动进本门射程;`onPickFile` 是本票点名的端口但端口表尚未登记它,
 *      单独列 `TICKET_NAMED_PORTS` 并注明来源(不在本门另立一份"完整端口集")。
 *      现读 HEAD 面 **0**。
 *
 *  A3 advisory —— 交互反馈缺失(判据 2026-11-03 纠偏后):
 *     `View`/`Text` 挂 onClick,反馈来源按下列顺序静态取证,能证就放行:
 *       ① `hoverClass`;② `active:`/`hover:` 类变体;③ 样式表 `.cls:active` 声明 —— 但平台事实
 *          (**weapp WXSS 的 `:active` 对 View/Text 不生效**,本仓 InputArea/MaterialPopup 注释自证)
 *          下不构成有效反馈,故仍按缺陷报,并给出「声明在哪条 CSS」证据;
 *       ④ 遮罩/蒙层:`inset-0`/`style inset:0` 铺满视口的命中层直接放行,仅 mask/overlay 类名者
 *          还需 close/dismiss 语义;⑤ handler 体只有 `e.stopPropagation()` 的冒泡护栏;
 *       ⑥ 祖先链上已有反馈(weapp 触摸起点命中子树即触发祖先 hover-class);⑦ 导航意图;
 *       ⑧ className 非字面量(变量/`cn(...)`)⇒ 标 `A3-undetermined`(盲区),**不**当缺陷。
 *     2026-11-03 纠偏前后读数:**174 → 80**(真缺陷 75 Text + 2 隐形命中条 + 3 盲区)。
 *     **为什么不上 blocking**:残留多为 Text —— weapp `Text` 不支持 `hoverClass`,今日只能靠外层
 *     View 承接;这类"命中区铺满整行"的合法结构静态判不出观感,判红就是拿误报逼人写冗余代码。
 *     自查口径:`--strict` 才把它折进退出码,提交门只出 advisory。
 *
 *  A4 advisory —— `Taro.showModal` 纯提示误用:
 *     调用参数既无 `showCancel` 也无 `cancelText`/`onCancel`,也没有 `success/fail` 处理取消
 *     ⇒ 用模态框做单按钮提示。这是交互规范问题(应该走 toast),不是崩溃,故只警告。
 *
 * 判不了的(静态盲区,写在这里而不是假装看过):自定义组件内部的反馈(如 `LessonListItem`
 * 自己渲染 Pressable)、`className={变量}/cn(...)` 透传(记 `A3-undetermined`)、运行时拼出来的
 * handler 名、`Image`/图标类标签的视觉反馈。
 *
 * 集成位置: scripts/guardian-runner.mjs 第 290 项(pre-commit blocking;staged 触发面 =
 *   apps/miniapp-taro/src/ + 本门脚本 + 本门台账)。
 *
 * 口径:
 *   全量档 = 审计报告(A1/A2 现读 0;A3/A4 只报数)。
 *   --staged = 只判暂存区触及的 miniapp 文件;A1/A2 绝对零容忍,A3/A4 advisory 不进退出码。
 *   --gate = 提交门形态(与 runner 的 --staged 组合使用,本身只表示"按提交门口径")。
 *   --self-test = 判据夹具(23 例;:active/祖先反馈/遮罩/冒泡护栏/非字面量 className 各带正反例,
 *                另含 A3 挂账三态)。
 *   台账 scripts/data/miniapp-interaction-allowlist.json:每条带
 *   owner/expires/evidence(文件:行)/rationale/count —— **到期即红**;缺字段即红;
 *   A3 条目的 expires 须 ≥ 2027-01-31。blocking 认领数少于现读 ⇒ 红;A3 少于现读 ⇒
 *   advisory(逐条点名"未挂账",不折退出码);多于现读 ⇒ advisory(清单腐烂)。
 *
 * 用法:node scripts/check-miniapp-interaction-hygiene.mjs [--gate|--staged] [--json] [--strict] [--self-test]
 * 退出码:0 全绿(advisory 不折;--strict 时折) · 1 blocking 违规/账本到期 · 2 取不到输入(未判定)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskComments } from './lib/code-mask.mjs'
import { PORT_TYPE_DECLARATIONS } from './check-host-port-equivalence.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = resolve(HERE, '..')
export const SRC_REL = 'apps/miniapp-taro/src'
export const LEDGER_REL = 'scripts/data/miniapp-interaction-allowlist.json'
export const SKIP_ENV = 'HUSKY_SKIP_MINIAPP_INTERACTION_HYGIENE'

/** 与端口等价门同一份端口名(键即运行时 prop 名)。 */
export const PORT_NAMES = Object.keys(PORT_TYPE_DECLARATIONS)
/** 本票点名、但端口表尚未登记的名字(仅作射程补充,不构成第二份端口全集)。 */
export const TICKET_NAMED_PORTS = ['onPickFile']
export const ALL_PORT_NAMES = [...new Set([...PORT_NAMES, ...TICKET_NAMED_PORTS])]

const CLICK_PROPS = ['onClick', 'onLongClick', 'onTap']
const EMPTY_BODY_RE = /^(?:undefined|null|void\s+0|\{\s*\}|\{\s*return(?:s)?\s*\}|\{\s*\})$/s
const NOOP_NAME_RE = /^(?:noop|_noop|NOOP|noOp)$/

/** 从仓库根读文件(统一换行,便于行号与指纹跨平台一致)。 */
const readText = (rel) => readFileSync(join(REPO, rel), 'utf8').replace(/\r\n/g, '\n')

/** 递归列出被审面 .ts/.tsx,跳过 rn-compat 垫片与测试文件。 */
export function listSourceFiles(rootRel = SRC_REL) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      const rel = relative(REPO, abs).replace(/\\/g, '/')
      if (statSync(abs).isDirectory()) {
        if (name === 'rn-compat' || name === '__tests__' || name === '__mocks__') continue
        walk(abs)
        continue
      }
      if (!/\.(ts|tsx)$/.test(name)) continue
      if (/\.(test|spec)\.(ts|tsx)$/.test(name)) continue
      out.push(rel)
    }
  }
  const start = join(REPO, rootRel)
  if (!existsSync(start)) return { files: [], missing: rootRel }
  walk(start)
  return { files: out.sort(), missing: null }
}

/**
 * JSX 开标签扫描(只用于静态判据,不是解析器):返回 `{tag, attrs, line}`。
 * 入参必须是 `maskComments` 之后的文本 —— 否则注释里贴的示例标签会被当真标签判。
 */
export function scanTags(src) {
  const tags = []
  let i = 0
  while ((i = src.indexOf('<', i)) >= 0) {
    const head = /^<([A-Za-z][\w.]*)/.exec(src.slice(i, i + 64))
    if (!head) {
      i += 1
      continue
    }
    let j = i + head[0].length
    let depth = 0
    let quote = null
    for (; j < src.length; j++) {
      const c = src[j]
      if (quote) {
        if (c === quote && src[j - 1] !== '\\') quote = null
        continue
      }
      if (c === '"' || c === "'") {
        quote = c
        continue
      }
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      else if (c === '>' && depth === 0) break
    }
    const line = lineAt(src, i)
    tags.push({ tag: head[1], attrs: src.slice(i + head[0].length, j), line })
    i = j + 1
  }
  return tags
}

/**
 * 带父子栈的 JSX 标签走查(与 `scanTags` 同一套引号/花括号容错),返回 `{tag, props, line, parents}`。
 * 只用于「祖先已有反馈」判据:扁平 `scanTags` 拿不到祖先链。
 */
export function scanTagTree(src) {
  const nodes = []
  const stack = []
  const headRe = /<(\/?)([A-Za-z][\w.]*)/g
  let h
  while ((h = headRe.exec(src))) {
    const isClose = h[1] === '/'
    const start = h.index
    const tag = h[2]
    let j = start + h[0].length
    let depth = 0
    let quote = null
    for (; j < src.length; j++) {
      const c = src[j]
      if (quote) {
        if (c === quote && src[j - 1] !== '\\') quote = null
        continue
      }
      if (c === '"' || c === "'") {
        quote = c
        continue
      }
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      else if (c === '>' && depth === 0) break
    }
    const inner = src.slice(start + h[0].length, j)
    const selfClosing = /\/\s*$/.test(inner)
    if (isClose) {
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].tag === tag) {
          stack.length = k
          break
        }
      }
      headRe.lastIndex = j + 1
      continue
    }
    nodes.push({
      tag,
      props: parseAttrs(inner.replace(/\/\s*$/, '')),
      line: lineAt(src, start),
      parents: stack.slice(),
    })
    if (!selfClosing) stack.push(nodes[nodes.length - 1])
    headRe.lastIndex = j + 1
  }
  return nodes
}

/** 把标签属性区拆成 `{name: 值原文}`;值保留原文(引号/花括号都在),只去首尾空白。 */
export function parseAttrs(attrsText) {
  const out = {}
  const re = /([A-Za-z_][\w.:-]*)\s*=/g
  let m
  while ((m = re.exec(attrsText))) {
    let i = re.lastIndex
    while (i < attrsText.length && /\s/.test(attrsText[i])) i += 1
    const ch = attrsText[i]
    let value = ''
    if (ch === '"' || ch === "'") {
      const end = attrsText.indexOf(ch, i + 1)
      const stop = end < 0 ? attrsText.length : end
      // 保留引号:调用方据此区分「字面量」与「表达式」(className 判据需要)
      value = attrsText.slice(i, stop + 1)
      re.lastIndex = stop + 1
    } else if (ch === '{') {
      const end = matchBrace(attrsText, i)
      const stop = end < 0 ? attrsText.length : end
      value = attrsText.slice(i + 1, stop)
      re.lastIndex = stop + 1
    } else {
      const tail = attrsText.slice(i).match(/^[^\s>]+/)
      value = tail ? tail[0] : ''
      re.lastIndex = i + value.length
    }
    out[m[1]] = value.trim()
  }
  return out
}

/** 本文件里声明的空函数名(`const noop = () => {}` / `function noop() {}`)。 */
export function collectNoopNames(src) {
  const names = new Set()
  const declRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:\(\s*\)\s*=>\s*(?:\{\s*\}|undefined|null|void\s+0)|(?:async\s+)?function\s*\([^)]*\)\s*\{\s*\})/g
  let m
  while ((m = declRe.exec(src))) names.add(m[1])
  const fnRe = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*\}/g
  while ((m = fnRe.exec(src))) names.add(m[1])
  return names
}

/** 判定一个 handler 值是否为空实现;返回原因或 null。 */
export function emptyHandlerReason(value, noopNames = new Set()) {
  const v = String(value ?? '').trim()
  if (!v) return null
  if (EMPTY_BODY_RE.test(v)) return 'empty-body'
  if (NOOP_NAME_RE.test(v)) return 'noop-name'
  if (noopNames.has(v)) return 'noop-binding'
  const body = v.replace(/^\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*/, '').trim()
  if (body !== v && (EMPTY_BODY_RE.test(body) || NOOP_NAME_RE.test(body) || noopNames.has(body))) return 'empty-body'
  return null
}

/**
 * 取 className/class 的「可静态读到的文本」:
 *  - 字符串字面量 / 模板字面量 ⇒ 返回原文(模板里 `${}` 表达式保留,只做 token 提取);
 *  - 标识符 / 函数调用 / 其它表达式(`className={className}`、`cn(...)`)⇒ null(静态盲区)。
 */
export function classTextOf(props) {
  for (const key of ['className', 'class']) {
    if (!Object.hasOwn(props, key)) continue
    const v = String(props[key] ?? '').trim()
    if (!v) return ''
    if (v.startsWith("'") || v.startsWith('"') || v.startsWith('`')) return v.slice(1, -1)
    return null
  }
  return ''
}

/** 从 class 文本里提取 class token(只留字母数字/下划线/连字符,用于命中样式表选择器)。 */
export function classTokens(text) {
  return String(text || '')
    .match(/[A-Za-z_][\w-]*/g) || []
}

/**
 * 预扫被审面样式表,抽 `.cls:active` 声明 ⇒ Map<class, 证据 `file:line`>。
 * 只做「声明存在」的静态取证;是否在 weapp 真生效由 CSS_ACTIVE_SUPPORTED 决定。
 */
export function buildActiveSelectors(rootRel = SRC_REL) {
  const map = new Map()
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      if (statSync(abs).isDirectory()) {
        if (name === 'rn-compat' || name === '__tests__' || name === '__mocks__') continue
        walk(abs)
        continue
      }
      if (!name.endsWith('.css')) continue
      const rel = relative(REPO, abs).replace(/\\/g, '/')
      const text = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
      const re = /\.([A-Za-z_][\w-]*):active\b/g
      let m
      while ((m = re.exec(text))) {
        if (!map.has(m[1])) map.set(m[1], `${rel}:${text.slice(0, m.index).split('\n').length}`)
      }
    }
  }
  const start = join(REPO, rootRel)
  if (existsSync(start)) walk(start)
  return map
}

/**
 * 平台事实(2026-11-03,本仓自证):weapp 的 WXSS `:active` 伪类对 View/Text 不生效,
 * 按压态只能用 `hover-Class`。证据:components/InputArea.tsx:803/819/885/901、
 * components/MaterialPopup.tsx:82/121 的注释(原 `active:` / `:active` 写法被判为死样式后改 hoverClass)。
 * 若平台后续支持,把此常量翻 true 即可让 A3 把「有 :active 声明」判为有反馈。
 */
export const CSS_ACTIVE_SUPPORTED = false

/**
 * 标签是否带按压反馈(Taro hoverClass / tailwind active:/hover: 变体 / 样式表 :active)。
 * 返回 `{kind, evidence?}`;`kind='unknown'` 表示 className 非字面量(静态盲区,不判缺陷)。
 */
export function feedbackOf(props, { activeSelectors = new Map(), cssActiveSupported = CSS_ACTIVE_SUPPORTED } = {}) {
  if (props.hoverClass || props['hover-class']) return { kind: 'hoverClass' }
  const text = classTextOf(props)
  if (text === null) return { kind: 'unknown' }
  if (/(?:^|[\s"'`])(?:active|hover):/.test(text)) return { kind: 'variant' }
  for (const token of classTokens(text)) {
    if (activeSelectors.has(token))
      return {
        kind: cssActiveSupported ? 'css:active' : 'css:active-dead',
        evidence: activeSelectors.get(token),
      }
  }
  return null
}

/** 导航意图:反馈缺失档对"点了就走"的入口放过(导航靠页面切换本身给反馈)。 */
export function isNavHandler(value) {
  return /navigate|goBack|switchTab|redirect|router\.|Nav(igate|igation)?\b/i.test(String(value || ''))
}

/**
 * 遮罩/蒙层:① className/style 静态可证「铺满视口」(inset-0 / inset:0)⇒ 全屏命中层,
 * 不存在按压观感需求,直接放行;② 仅命中 mask/overlay 类名 ⇒ 还需关闭/护栏语义才放行。
 */
export function isBackdrop(props, handler = '') {
  const text = classTextOf(props)
  if (text !== null && /(?:^|\s)inset-0(?:\s|$)/.test(text)) return true
  const style = String(props.style || '')
  if (/(?:^|[{;,\s])inset\s*:\s*0(?:[^0-9]|$)/.test(style)) return true
  if (text !== null && /(?:^|\s)[^\s]*(?:mask|overlay)[^\s]*(?:\s|$)/i.test(text))
    return isCloseHandler(handler) || isBubbleGuard(handler)
  return false
}

/** 关闭语义 handler:onClose/onCancel/close 系/handleMaskClick,或直接 setXxx(false/null)。 */
export function isCloseHandler(value) {
  const v = String(value || '').replace(/\s+/g, ' ')
  return (
    /\bon(?:Close|Cancel|Dismiss|RequestClose)\b/.test(v) ||
    /\bclose[A-Z]?\w*\s*\(/.test(v) ||
    /^(?:on)?(?:close|dismiss)[A-Z]?\w*$/.test(v) ||
    /\bhandleMaskClick\b/.test(v) ||
    /\b[A-Za-z_$][\w$]*\s*\(\s*(?:false|null)\s*\)/.test(v) ||
    /^(?:closePopup|close|dismiss)$/.test(v)
  )
}

/** 冒泡护栏:handler 体只有一条 `e.stopPropagation()`(面板本体,不是点击目标)。 */
export function isBubbleGuard(value) {
  const v = String(value || '').trim()
  return /^(?:\(\s*[A-Za-z_$][\w$]*\s*\)|[A-Za-z_$][\w$]*)\s*=>\s*(?:\{\s*)?[A-Za-z_$][\w$]*\s*\.\s*stopPropagation\s*\(\s*\)\s*;?\s*(?:\}\s*)?$/.test(v)
}

/**
 * 判据 A1/A3(纯函数):喂标签数组,返回 blocking / advisory 清单。
 * tags 若来自 `scanTagTree`,会带 `parents`(祖先链),用于「祖先已有反馈」放行;
 * 扁平 `scanTags` 喂入时视为无祖先(不影响 A1)。
 * @param {Array<{tag:string, attrs?:string, props?:object, line:number, parents?:Array}>} tags
 * @param {{noopNames?:Set<string>, activeSelectors?:Map<string,string>, cssActiveSupported?:boolean}} opts
 */
export function judgeClickable(
  tags,
  { noopNames = new Set(), activeSelectors = new Map(), cssActiveSupported = CSS_ACTIVE_SUPPORTED } = {},
) {
  const blocking = []
  const advisory = []
  const ctx = { activeSelectors, cssActiveSupported }
  const hasFeedback = (props) => {
    const fb = feedbackOf(props, ctx)
    return fb && (fb.kind === 'hoverClass' || fb.kind === 'variant' || fb.kind === 'css:active')
  }
  for (const t of tags) {
    const props = t.props || parseAttrs(t.attrs || '')
    const clickProp = CLICK_PROPS.find((p) => Object.hasOwn(props, p))
    if (!clickProp) continue
    const value = props[clickProp]
    if (value === 'undefined' || value === 'null') {
      blocking.push({ rule: 'A1-non-callable', tag: t.tag, line: t.line, prop: clickProp, detail: 'handler 是 undefined/null' })
      continue
    }
    const reason = emptyHandlerReason(value, noopNames)
    if (reason) {
      blocking.push({ rule: 'A1-empty-handler', tag: t.tag, line: t.line, prop: clickProp, detail: reason })
      continue
    }
    const cls = classTextOf(props) ?? ''
    if (/(?:^|\s)pointer-events-none(?:\s|$)/.test(cls)) {
      blocking.push({ rule: 'A1-pointer-events-none', tag: t.tag, line: t.line, prop: clickProp, detail: '样式层已禁用点击' })
      continue
    }
    // A3 只判 Taro 语义原生面(View/Text):Button 自带 button-hover,自定义组件的反馈住在自己身上,
    // Image/图标类标签的反馈是视觉态而不是 hoverClass —— 都列盲区,不在此判。
    if (!/^(View|Text)$/.test(t.tag)) continue
    const fb = feedbackOf(props, ctx)
    if (fb?.kind === 'hoverClass' || fb?.kind === 'variant' || fb?.kind === 'css:active') continue
    // 遮罩/蒙层:点空白关闭的命中层,不存在按压观感需求 ⇒ 判据放行(静态可证)。
    if (isBackdrop(props, value)) continue
    // 冒泡护栏:面板本体只做 stopPropagation,不是可点目标 ⇒ 放行。
    if (isBubbleGuard(value)) continue
    // 祖先已有按压反馈:weapp 触摸起点命中子树即触发祖先 hover-class ⇒ 放行。
    if ((t.parents || []).some((p) => hasFeedback(p.props || {}))) continue
    // 导航项:反馈来自页面切换本身 ⇒ 放行(既有口径,不扩大词表)。
    if (isNavHandler(value)) continue
    // className 非字面量:静态不可证,明确标 undetermined,不当缺陷。
    if (fb?.kind === 'unknown' || (!Object.hasOwn(props, 'className') && !Object.hasOwn(props, 'class') && classTextOf(props) === null)) {
      advisory.push({ rule: 'A3-undetermined', tag: t.tag, line: t.line, prop: clickProp, detail: 'className 非字面量,静态不可证' })
      continue
    }
    const deadActive = fb?.kind === 'css:active-dead' ? `CSS :active 已声明于 ${fb.evidence} 但 weapp 不生效` : ''
    advisory.push({
      rule: 'A3-no-feedback',
      tag: t.tag,
      line: t.line,
      prop: clickProp,
      detail: deadActive || '无 hoverClass/active 变体',
      ...(deadActive ? { evidence: fb.evidence } : {}),
    })
  }
  return { blocking, advisory }
}

/**
 * 判据 A2(纯函数):端口回调被赋空实现。认两种写法:
 *  JSX 属性 `<X onNavigate={() => {}} />` 与对象字面量 `{ onNavigate: () => {} }`。
 */
export function judgePortAssignments(src, { portNames = ALL_PORT_NAMES } = {}) {
  const out = []
  const noopNames = collectNoopNames(src)
  for (const tag of scanTags(src)) {
    const props = parseAttrs(tag.attrs)
    for (const port of portNames) {
      if (!Object.hasOwn(props, port)) continue
      const value = props[port]
      if (value === 'undefined' || value === 'null') {
        out.push({ rule: 'A2-empty-port', port, line: tag.line, detail: 'handler 是 undefined/null' })
        continue
      }
      const reason = emptyHandlerReason(value, noopNames)
      if (reason) out.push({ rule: 'A2-empty-port', port, line: tag.line, detail: reason })
    }
  }
  for (const port of portNames) {
    const objRe = new RegExp(`\\b${port}\\s*:\\s*(\\(\\)\\s*=>\\s*(?:\\{\\s*\\}|undefined|null|void\\s+0)|[A-Za-z_$][\\w$]*)`, 'g')
    let m
    while ((m = objRe.exec(src))) {
      const value = m[1]
      const reason = emptyHandlerReason(value, noopNames)
      if (reason) out.push({ rule: 'A2-empty-port', port, line: lineAt(src, m.index), detail: reason })
    }
  }
  return out
}

/**
 * 判据 A4(纯函数):`Taro.showModal({...})` 纯提示误用。
 * "纯提示" = 参数里既没有取消语义(`showCancel`/`cancelText`/`onCancel`),也没有
 * `success`/`fail` 去读 `res.cancel` —— 单按钮模态就是在用重交互做轻提示。
 */
export function judgeModalMisuse(src) {
  const out = []
  const re = /(?:Taro\.)?showModal\s*\(\s*\{/g
  let m
  while ((m = re.exec(src))) {
    const open = src.indexOf('{', m.index)
    const end = matchBrace(src, open)
    if (end < 0) continue
    const body = src.slice(open + 1, end)
    const hasCancel = /\bshowCancel\s*:|\bcancelText\s*:|\bonCancel\s*:/.test(body)
    const readsCancel = /\bres\s*\.\s*cancel|\bres\s*\.\s*confirm/.test(body)
    if (hasCancel || readsCancel) continue
    out.push({ rule: 'A4-modal-as-notice', line: lineAt(src, m.index), detail: 'showModal 无取消语义' })
  }
  return out
}

export function matchBrace(src, openIdx) {
  let depth = 0
  let quote = null
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === quote && src[i - 1] !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c
      continue
    }
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

const lineAt = (src, idx) => src.slice(0, idx).split('\n').length

/** A3 台账(submitted 豁免)的最短挂账期:豁免不是销账,至少挂到该日再复核。 */
export const ADVISORY_MIN_EXPIRES = '2027-01-31'

/**
 * 台账判序(纯函数):到期即红;认领数少于现读 ⇒ 红(新增未挂账);多于现读 ⇒ advisory(腐烂)。
 * A3(advisory 档)也接台账:差额不折退出码(与「A3 不进退出码」既有口径一致),但逐条点名;
 * 到期 / 缺字段 / 挂账期过短 仍红。
 * @param {Array<{rule:string,file:string}>} violations
 * @param {Array<{rule:string,file:string,count?:number,owner?:string,expires?:string,evidence?:string,rationale?:string}>} entries
 * @param {{today:string, advisories?:Array<{rule:string,file:string}>, scopeFiles?:Set<string>|null}} opts
 *        scopeFiles 非 null 时(提交门只扫暂存文件),只对射程内文件做认领配平;射程外条目只验形制与到期。
 */
export function judgeLedger(violations, entries, { today, advisories = [], scopeFiles = null }) {
  const red = []
  const advisory = []
  const expired = []
  const malformed = []
  for (const e of entries) {
    const label = `${e?.file || '?'} [${e?.rule || '?'}]`
    const isAdvisoryRule = typeof e?.rule === 'string' && /^A3/.test(e.rule)
    if (typeof e?.owner !== 'string' || !e.owner.trim()) malformed.push(`条目缺 owner:${label}`)
    if (typeof e?.evidence !== 'string' || !e.evidence.trim()) malformed.push(`条目缺 evidence:${label}`)
    if (typeof e?.rationale !== 'string' || !e.rationale.trim()) malformed.push(`条目缺 rationale:${label}`)
    if (typeof e?.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.expires))
      malformed.push(`条目缺 expires(YYYY-MM-DD):${label}`)
    else if (e.expires < today) expired.push(`${label} 于 ${e.expires} 到期`)
    else if (isAdvisoryRule && e.expires < ADVISORY_MIN_EXPIRES)
      malformed.push(`${label} 挂账期须 ≥ ${ADVISORY_MIN_EXPIRES}(现 ${e.expires})`)
  }
  const keyOf = (file, rule) => `${file}::${rule}`
  const counts = new Map()
  for (const v of violations) {
    const k = keyOf(v.file, v.rule)
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  const advCounts = new Map()
  for (const v of advisories) {
    const k = keyOf(v.file, v.rule)
    advCounts.set(k, (advCounts.get(k) || 0) + 1)
  }
  const quota = new Map()
  for (const e of entries) {
    if (typeof e?.file !== 'string' || typeof e?.rule !== 'string') {
      malformed.push(`条目缺 file/rule:${JSON.stringify(e).slice(0, 80)}`)
      continue
    }
    quota.set(keyOf(e.file, e.rule), {
      count: Number.isInteger(e.count) ? e.count : 1,
      advisory: /^A3/.test(e.rule),
    })
  }
  for (const [k, n] of counts) {
    const q = quota.get(k)
    if (q?.advisory) {
      advisory.push(`${k.replace('::', ' [')}] 规则归 advisory 档,却被登记为 blocking 条目`)
      continue
    }
    const claimed = q ? q.count : 0
    if (n > claimed) red.push(`${k.replace('::', ' [')}] 现读 ${n} 处,账本认领 ${claimed} 处`)
  }
  for (const [k, n] of advCounts) {
    const claimed = quota.get(k)?.count || 0
    if (n > claimed) advisory.push(`${k.replace('::', ' [')}] 现读 ${n} 处,账本认领 ${claimed} 处 ⇒ 未挂账`)
  }
  for (const [k, q] of quota) {
    const file = k.slice(0, k.lastIndexOf('::'))
    if (scopeFiles && !scopeFiles.has(file)) continue
    const n = (q.advisory ? advCounts.get(k) : counts.get(k)) || 0
    if (n < q.count) advisory.push(`${k.replace('::', ' [')}] 账本认领 ${q.count} 处,现读 ${n} 处 ⇒ 清单腐烂(复核后下调或删除)`)
    if (n === 0) advisory.push(`${k.replace('::', ' [')}] 已不再命中 ⇒ 条目可销账`)
  }
  return { red, advisory, expired, malformed }
}

/** 对单个文件跑 A1/A2/A3/A4;返回 `{blocking, advisory, tags}`(不含台账判序)。 */
export function scanSource(
  text,
  { portNames = ALL_PORT_NAMES, activeSelectors = new Map(), cssActiveSupported = CSS_ACTIVE_SUPPORTED } = {},
) {
  const masked = maskComments(text)
  const noopNames = collectNoopNames(masked)
  const nodes = scanTagTree(masked)
  const c = judgeClickable(nodes, { noopNames, activeSelectors, cssActiveSupported })
  const ports = judgePortAssignments(masked, { portNames })
  const modal = judgeModalMisuse(masked)
  return { blocking: [...c.blocking, ...ports], advisory: [...c.advisory, ...modal], tags: nodes.length }
}

/** 台账读取:取不到/坏形状 ⇒ null(调用方按未判定 exit 2,不拿空表冒充"没有豁免")。 */
export function readLedger(path = join(REPO, LEDGER_REL)) {
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(raw.entries) ? raw.entries : null
  } catch {
    return null
  }
}

function todayStr() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 自检:每条判据至少一正一反,外加干净样本与台账到期。 */
export function runSelfTest() {
  const cases = []
  const expect = (cond, msg) => {
    if (!cond) throw new Error(msg)
  }
  const ok = (name, fn) => {
    try {
      fn()
      cases.push(`  ✅ ${name}`)
    } catch (e) {
      cases.push(`  ❌ ${name}: ${e.message}`)
      throw e
    }
  }
  const scanOne = (src, opts) => scanSource(src, opts)

  ok('① 假可点:View 上 onClick 空实现 ⇒ 红', () => {
    const r = scanOne('const A = () => <View onClick={() => {}}>x</View>')
    expect(r.blocking.some((v) => v.rule === 'A1-empty-handler'), '空实现未被判红')
  })
  ok('② 假可点:onClick 绑 noop 名字 ⇒ 红', () => {
    const r = scanOne('const noop = () => {}\nconst A = () => <Text onClick={noop}>x</Text>')
    expect(r.blocking.some((v) => v.rule === 'A1-empty-handler'), 'noop 绑定未判红')
  })
  ok('③ 假可点:pointer-events-none + onClick ⇒ 红', () => {
    const r = scanOne('<View className="pointer-events-none" onClick={() => go(x)} />')
    expect(r.blocking.some((v) => v.rule === 'A1-pointer-events-none'), '样式层死点击未判红')
  })
  ok('④ 空端口:onNavigate 空实现 ⇒ 红', () => {
    const r = scanOne('<Shell onNavigate={() => {}} />')
    expect(r.blocking.some((v) => v.rule === 'A2-empty-port' && v.port === 'onNavigate'), '空端口未判红')
  })
  ok('⑤ 空端口:对象字面量 onToast: () => undefined ⇒ 红', () => {
    const r = scanOne('const host = { onToast: () => undefined }')
    expect(r.blocking.some((v) => v.rule === 'A2-empty-port' && v.port === 'onToast'), '对象字面量空端口未判红')
  })
  ok('⑥ 反馈缺失:View onClick 无 hoverClass ⇒ advisory(不进 blocking)', () => {
    const r = scanOne('<View onClick={() => open(id)}>x</View>')
    expect(r.blocking.length === 0, '无反馈被误判成 blocking')
    expect(r.advisory.some((v) => v.rule === 'A3-no-feedback'), '无反馈未进 advisory')
  })
  ok('⑦ 反馈存在:hoverClass ⇒ 不报', () => {
    const r = scanOne('<View hoverClass="opacity-60" onClick={() => open(id)}>x</View>')
    expect(!r.advisory.some((v) => v.rule === 'A3-no-feedback'), 'hoverClass 未生效')
  })
  ok('⑧ 导航项:无反馈但 handler 导航 ⇒ 不报', () => {
    const r = scanOne('<View onClick={() => Taro.navigateTo({url:"/p"})}>x</View>')
    expect(!r.advisory.some((v) => v.rule === 'A3-no-feedback'), '导航项被误报')
  })
  ok('⑨ modal 误用:showModal 无取消语义 ⇒ advisory', () => {
    const r = scanOne('Taro.showModal({ title: "提示", content: "ok" })')
    expect(r.advisory.some((v) => v.rule === 'A4-modal-as-notice'), 'modal 误用未报')
  })
  ok('⑩ modal 正例:带 showCancel ⇒ 不报', () => {
    const r = scanOne('Taro.showModal({ title: "确认", content: "删?", showCancel: true })')
    expect(!r.advisory.some((v) => v.rule === 'A4-modal-as-notice'), '带取消语义被误报')
  })
  ok('⑪ 干净样本:Button/自定义组件/普通 View ⇒ 全绿', () => {
    const r = scanOne(
      'const A = () => (<View>\n<Button onClick={save}>保存</Button>\n<LessonListItem onClick={pick} />\n<View className="p-4">正文</View>\n</View>)',
    )
    expect(r.blocking.length === 0 && r.advisory.length === 0, `干净样本被报:${JSON.stringify(r)}`)
  })
  ok('⑫ 台账:到期即红 + 认领差额双向点名 + 缺字段点名', () => {
    const v = [
      { file: 'a.tsx', rule: 'A1-empty-handler' },
      { file: 'a.tsx', rule: 'A1-empty-handler' },
    ]
    const base = { owner: 'o', expires: '2099-01-01', evidence: 'e', rationale: 'r' }
    const j = judgeLedger(v, [{ file: 'a.tsx', rule: 'A1-empty-handler', count: 1, ...base }], { today: '2026-11-03' })
    expect(j.red.length === 1, '认领数少于现读未判红')
    const expired = judgeLedger([], [{ file: 'b.tsx', rule: 'A1-empty-handler', count: 0, ...base, expires: '2020-01-01' }], {
      today: '2026-11-03',
    })
    expect(expired.expired.length === 1, '到期未点名')
    const malformed = judgeLedger([], [{ file: 'c.tsx', rule: 'A1-empty-handler' }], { today: '2026-11-03' })
    expect(malformed.malformed.length === 4, `缺字段未点名(${malformed.malformed.length}/4)`)
  })
  const activeCtx = { activeSelectors: new Map([['state-btn', 'components/x.css:87']]) }
  ok('⑬ :active 正例:样式表已声明 :active 且平台生效 ⇒ 不报', () => {
    const r = scanOne('<View className="state-btn" onClick={() => open(id)}>x</View>', { ...activeCtx, cssActiveSupported: true })
    expect(!r.advisory.some((v) => v.rule === 'A3-no-feedback'), 'CSS :active 未被识别为反馈')
  })
  ok('⑭ :active 反例:声明存在但 weapp 不生效 ⇒ 按缺陷报(带证据)', () => {
    const r = scanOne('<View className="state-btn" onClick={() => open(id)}>x</View>', { ...activeCtx, cssActiveSupported: false })
    const hit = r.advisory.find((v) => v.rule === 'A3-no-feedback')
    expect(hit && /weapp 不生效/.test(hit.detail), 'weapp 死 :active 未被判为缺陷')
    expect(hit.evidence === 'components/x.css:87', '缺声明证据')
  })
  ok('⑮ 祖先反馈正例:祖先 hoverClass + 子 Text 承接点击 ⇒ 不报', () => {
    const r = scanOne('<View hoverClass="opacity-60"><Text onClick={() => open(id)}>x</Text></View>')
    expect(!r.advisory.some((v) => v.rule === 'A3-no-feedback'), '祖先反馈未继承')
  })
  ok('⑯ 祖先反馈反例:祖先无反馈 ⇒ 仍报', () => {
    const r = scanOne('<View className="row"><Text onClick={() => open(id)}>x</Text></View>')
    expect(r.advisory.some((v) => v.rule === 'A3-no-feedback'), '无祖先反馈却未报')
  })
  ok('⑰ 遮罩正例:mask + 关闭语义 ⇒ 不报', () => {
    const r = scanOne('<View className="fixed inset-0 pza-mask" onClick={() => setOpen(false)}>x</View>')
    expect(!r.advisory.some((v) => v.rule === 'A3-no-feedback'), '遮罩误报未消')
  })
  ok('⑱ 遮罩反例:只命中 mask 名、未铺满视口且 handler 非关闭语义 ⇒ 仍报', () => {
    const r = scanOne('<View className="pza-mask absolute top-0 left-0" onClick={() => open(id)}>x</View>')
    expect(r.advisory.some((v) => v.rule === 'A3-no-feedback'), '非关闭语义的 mask 被放过')
  })
  ok('⑲ 冒泡护栏正例:仅 e.stopPropagation() ⇒ 不报', () => {
    const r = scanOne('<View onClick={(e) => e.stopPropagation()}>x</View>')
    expect(!r.advisory.some((v) => v.rule === 'A3-no-feedback'), '冒泡护栏被误报')
  })
  ok('⑳ 冒泡护栏反例:提及 stopPropagation 但仍做业务 ⇒ 仍报', () => {
    const r = scanOne('<Text onClick={(e) => { e.stopPropagation(); open(id) }}>x</Text>')
    expect(r.advisory.some((v) => v.rule === 'A3-no-feedback'), '带业务的 handler 被当成护栏')
  })
  ok('㉑ 非字面量 className 正例:变量/表达式 ⇒ 判 undetermined 不当缺陷', () => {
    const r = scanOne('<View className={className} onClick={() => open(id)}>x</View>')
    expect(r.advisory.some((v) => v.rule === 'A3-undetermined'), '盲区未被标 undetermined')
    expect(!r.advisory.some((v) => v.rule === 'A3-no-feedback'), '盲区被误判成缺陷')
  })
  ok('㉒ 非字面量 className 反例:字面量无反馈 ⇒ 仍判缺陷', () => {
    const r = scanOne('<View className="w-full" onClick={() => open(id)}>x</View>')
    expect(r.advisory.some((v) => v.rule === 'A3-no-feedback'), '字面量无反馈未判缺陷')
    expect(!r.advisory.some((v) => v.rule === 'A3-undetermined'), '字面量被误标盲区')
  })
  ok('㉓ A3 台账:可挂账/未挂账点名/挂账期低于 2027-01-31 ⇒ 红', () => {
    const adv = [{ file: 'a.tsx', rule: 'A3-no-feedback' }]
    const base = { file: 'a.tsx', rule: 'A3-no-feedback', count: 1, owner: 'o', expires: '2027-06-30', evidence: 'a.tsx:1', rationale: 'r' }
    const covered = judgeLedger([], [base], { today: '2026-11-03', advisories: adv })
    expect(covered.red.length === 0 && covered.advisory.length === 0, '正确挂账仍被判红/腐')
    const uncovered = judgeLedger([], [], { today: '2026-11-03', advisories: adv })
    expect(uncovered.advisory.some((s) => s.includes('未挂账')), '未登记未点名')
    const shortExpiry = judgeLedger([], [{ ...base, expires: '2026-12-31' }], { today: '2026-11-03', advisories: adv })
    expect(shortExpiry.malformed.some((s) => s.includes('≥ 2027-01-31')), '挂账期过短未红')
  })

  console.log('🧪 小程序交互卫生门自检')
  for (const line of cases) console.log(line)
  console.log(`\n✅ ${cases.length}/${cases.length} 例通过`)
  return cases.length
}

/** staged 面取文件(索引里被 touch 的 miniapp 源文件);git 不可用 ⇒ null(调用方未判定)。 */
function stagedFiles() {
  try {
    const out = execFileSync(
      'git',
      ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only', '--diff-filter=ACMR', '--', SRC_REL],
      { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((rel) => /\.(ts|tsx)$/.test(rel))
      .filter((rel) => !/\.(test|spec)\.(ts|tsx)$/.test(rel) && !rel.includes('/rn-compat/'))
  } catch {
    return null
  }
}

export async function run({ mode = 'full', json = false, strict = false } = {}) {
  const listed = listSourceFiles()
  if (listed.missing) {
    console.error(`❌ 被审面取不到:${listed.missing} ⇒ 未判定`)
    process.exit(2)
  }
  let files = listed.files
  if (mode === 'staged') {
    const st = stagedFiles()
    if (!st) {
      console.error('❌ 索引面取不到(git 不可用)⇒ 未判定')
      process.exit(2)
    }
    files = files.filter((f) => st.includes(f))
  }
  const violations = []
  const advisories = []
  let tagCount = 0
  const activeSelectors = buildActiveSelectors()
  for (const rel of files) {
    const r = scanSource(readText(rel), { activeSelectors })
    tagCount += r.tags
    for (const v of r.blocking) violations.push({ ...v, file: rel })
    for (const v of r.advisory) advisories.push({ ...v, file: rel })
  }
  const entries = readLedger()
  if (entries === null) {
    console.error(`❌ 台账读不到或形状坏:${LEDGER_REL} ⇒ 未判定(不拿空表冒充"零豁免")`)
    process.exit(2)
  }
  const ledger = judgeLedger(violations, entries, {
    today: todayStr(),
    advisories,
    // 提交门只扫暂存文件:射程外条目只验形制/到期,不参与"清单腐烂"对账(否则每次提交刷几十条假腐)
    scopeFiles: mode === 'staged' ? new Set(files) : null,
  })
  const blockingRed = [...ledger.red, ...ledger.expired, ...ledger.malformed]
  const byRule = (arr) => {
    const m = new Map()
    for (const v of arr) m.set(v.rule, (m.get(v.rule) || 0) + 1)
    return Object.fromEntries([...m.entries()].sort())
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          files: files.length,
          tags: tagCount,
          blocking: violations.length,
          blockingByRule: byRule(violations),
          advisory: advisories.length,
          advisoryByRule: byRule(advisories),
          ledger: {
            entries: entries.length,
            red: ledger.red,
            expired: ledger.expired,
            malformed: ledger.malformed,
            stale: ledger.advisory,
          },
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`🔍 小程序交互卫生门(290) 扫 ${files.length} 文件 / ${tagCount} 标签`)
    console.log(`  blocking:${violations.length}${violations.length ? ` ${JSON.stringify(byRule(violations))}` : ''}`)
    console.log(`  advisory:${advisories.length}${advisories.length ? ` ${JSON.stringify(byRule(advisories))}` : ''}(不进退出码)`)
    console.log(`  台账:${entries.length} 条;到期 ${ledger.expired.length} / 认领差额 ${ledger.red.length} / 缺字段 ${ledger.malformed.length}`)
    for (const v of violations.slice(0, 20)) console.log(`   ✗ ${v.file}:${v.line} [${v.rule}] ${v.port || v.tag || ''} ${v.detail}`)
    for (const line of blockingRed.slice(0, 20)) console.log(`   ✗ 台账:${line}`)
    for (const line of ledger.advisory.slice(0, 10)) console.log(`   ⚠ 台账:${line}`)
    for (const v of advisories.slice(0, 10)) console.log(`   ⚠ ${v.file}:${v.line} [${v.rule}] ${v.tag} ${v.detail}`)
  }

  process.exit(blockingRed.length > 0 || (strict && advisories.length > 0) ? 1 : 0)
}

const argv = process.argv.slice(2)
if (argv.includes('--self-test')) {
  try {
    runSelfTest()
    process.exit(0)
  } catch (e) {
    console.error(String(e?.message || e))
    process.exit(1)
  }
}
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  run({
    mode: argv.includes('--staged') ? 'staged' : 'full',
    json: argv.includes('--json'),
    strict: argv.includes('--strict'),
  })
}

export const __test__ = {
  listSourceFiles,
  scanTags,
  scanTagTree,
  parseAttrs,
  collectNoopNames,
  emptyHandlerReason,
  classTextOf,
  classTokens,
  buildActiveSelectors,
  CSS_ACTIVE_SUPPORTED,
  feedbackOf,
  isNavHandler,
  isBackdrop,
  isCloseHandler,
  isBubbleGuard,
  ADVISORY_MIN_EXPIRES,
  judgeClickable,
  judgePortAssignments,
  judgeModalMisuse,
  judgeLedger,
  scanSource,
  readLedger,
  runSelfTest,
  matchBrace,
  SRC_REL,
  LEDGER_REL,
  SKIP_ENV,
  PORT_NAMES,
  ALL_PORT_NAMES,
}
