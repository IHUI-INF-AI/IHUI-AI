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
 *  A3 advisory —— 交互反馈缺失:
 *     `View`/`Text` 挂 onClick,却既无 `hoverClass`(Taro 原生按压态)也无 `active:`/`hover:`
 *     类变体,且 handler 不含导航意图 ⇒ 只报数。现读 174 处。
 *     **为什么不上 blocking**:这 174 处里包含大量"外层已有点击反馈、内层只负责命中区"的合法
 *     结构(命中区铺满整行是移动端惯例),静态判不出观感;把它判红就是拿误报逼人写冗余代码。
 *     自查口径:`--strict` 才把它折进退出码,提交门只出 advisory。
 *
 *  A4 advisory —— `Taro.showModal` 纯提示误用:
 *     调用参数既无 `showCancel` 也无 `cancelText`/`onCancel`,也没有 `success/fail` 处理取消
 *     ⇒ 用模态框做单按钮提示。这是交互规范问题(应该走 toast),不是崩溃,故只警告。
 *
 * 判不了的(静态盲区,写在这里而不是假装看过):自定义组件内部的反馈(如 `LessonListItem`
 * 自己渲染 Pressable)、`hoverClass` 通过变量传入、样式表里的 `active:` 变体、运行时拼出来的
 * handler 名、`Image`/图标类标签的视觉反馈。
 *
 * 集成位置: scripts/guardian-runner.mjs 第 290 项(pre-commit blocking;staged 触发面 =
 *   apps/miniapp-taro/src/ + 本门脚本 + 本门台账)。
 *
 * 口径:
 *   全量档 = 审计报告(A1/A2 现读 0;A3/A4 只报数)。
 *   --staged = 只判暂存区触及的 miniapp 文件;A1/A2 绝对零容忍,A3/A4 advisory 不进退出码。
 *   --gate = 提交门形态(与 runner 的 --staged 组合使用,本身只表示"按提交门口径")。
 *   --self-test = 判据夹具(12 例,含变异自证)。
 *   台账 scripts/data/miniapp-interaction-allowlist.json:每条带 owner/expires/evidence/count,
 *   **到期即红**;认领数少于现读 ⇒ 红;多于现读 ⇒ advisory(清单腐烂)。
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
      value = attrsText.slice(i + 1, stop)
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

/** 标签是否带按压反馈(Taro hoverClass / tailwind active:/hover: 变体)。 */
export function feedbackOf(props) {
  if (props.hoverClass || props['hover-class']) return 'hoverClass'
  for (const key of ['className', 'class']) {
    const v = props[key]
    if (typeof v === 'string' && /(?:^|[\s"'`])(?:active|hover):/.test(v)) return `${key}:variant`
  }
  return null
}

/** 导航意图:反馈缺失档对"点了就走"的入口放过(导航靠页面切换本身给反馈)。 */
export function isNavHandler(value) {
  return /navigate|goBack|switchTab|redirect|router\.|Nav(igate|igation)?\b/i.test(String(value || ''))
}

/**
 * 判据 A1/A3(纯函数):喂标签数组,返回 blocking / advisory 清单。
 * @param {Array<{tag:string, attrs:string, line:number}>} tags
 * @param {{noopNames?:Set<string>}} opts
 */
export function judgeClickable(tags, { noopNames = new Set() } = {}) {
  const blocking = []
  const advisory = []
  for (const t of tags) {
    const props = parseAttrs(t.attrs)
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
    const cls = String(props.className || props.class || '')
    if (/(?:^|\s)pointer-events-none(?:\s|$)/.test(cls)) {
      blocking.push({ rule: 'A1-pointer-events-none', tag: t.tag, line: t.line, prop: clickProp, detail: '样式层已禁用点击' })
      continue
    }
    // A3 只判 Taro 语义原生面(View/Text):Button 自带 button-hover,自定义组件的反馈住在自己身上,
    // Image/图标类标签的反馈是视觉态而不是 hoverClass —— 都列盲区,不在此判。
    if (!/^(View|Text)$/.test(t.tag)) continue
    if (feedbackOf(props)) continue
    if (isNavHandler(value)) continue
    advisory.push({ rule: 'A3-no-feedback', tag: t.tag, line: t.line, prop: clickProp, detail: '无 hoverClass/active 变体' })
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

/**
 * 台账判序(纯函数):到期即红;认领数少于现读 ⇒ 红(新增未挂账);多于现读 ⇒ advisory(腐烂)。
 * @param {Array<{rule:string,file:string}>} violations
 * @param {Array<{rule:string,file:string,count?:number,owner?:string,expires?:string,evidence?:string}>} entries
 * @param {{today:string}} opts
 */
export function judgeLedger(violations, entries, { today }) {
  const red = []
  const advisory = []
  const expired = []
  const malformed = []
  for (const e of entries) {
    const label = `${e?.file || '?'} [${e?.rule || '?'}]`
    if (typeof e?.owner !== 'string' || !e.owner.trim()) malformed.push(`条目缺 owner:${label}`)
    if (typeof e?.evidence !== 'string' || !e.evidence.trim()) malformed.push(`条目缺 evidence:${label}`)
    if (typeof e?.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.expires))
      malformed.push(`条目缺 expires(YYYY-MM-DD):${label}`)
    else if (e.expires < today) expired.push(`${label} 于 ${e.expires} 到期`)
  }
  const keyOf = (file, rule) => `${file}::${rule}`
  const counts = new Map()
  for (const v of violations) {
    const k = keyOf(v.file, v.rule)
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  const quota = new Map()
  for (const e of entries) {
    if (typeof e?.file !== 'string' || typeof e?.rule !== 'string') {
      malformed.push(`条目缺 file/rule:${JSON.stringify(e).slice(0, 80)}`)
      continue
    }
    quota.set(keyOf(e.file, e.rule), Number.isInteger(e.count) ? e.count : 1)
  }
  for (const [k, n] of counts) {
    const q = quota.get(k) || 0
    if (n > q) red.push(`${k.replace('::', ' [')}] 现读 ${n} 处,账本认领 ${q} 处`)
  }
  for (const [k, q] of quota) {
    const n = counts.get(k) || 0
    if (n < q) advisory.push(`${k.replace('::', ' [')}] 账本认领 ${q} 处,现读 ${n} 处 ⇒ 清单腐烂(复核后下调或删除)`)
    if (n === 0) advisory.push(`${k.replace('::', ' [')}] 已不再命中 ⇒ 条目可销账`)
  }
  return { red, advisory, expired, malformed }
}

/** 对单个文件跑 A1/A2/A3/A4;返回 `{blocking, advisory, tags}`(不含台账判序)。 */
export function scanSource(text, { portNames = ALL_PORT_NAMES } = {}) {
  const masked = maskComments(text)
  const noopNames = collectNoopNames(masked)
  const tags = scanTags(masked)
  const c = judgeClickable(tags, { noopNames })
  const ports = judgePortAssignments(masked, { portNames })
  const modal = judgeModalMisuse(masked)
  return { blocking: [...c.blocking, ...ports], advisory: [...c.advisory, ...modal], tags: tags.length }
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
  const scanOne = (src) => scanSource(src)

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
    const j = judgeLedger(
      v,
      [{ file: 'a.tsx', rule: 'A1-empty-handler', count: 1, owner: 'o', expires: '2099-01-01', evidence: 'e' }],
      { today: '2026-11-03' },
    )
    expect(j.red.length === 1, '认领数少于现读未判红')
    const expired = judgeLedger(
      [],
      [{ file: 'b.tsx', rule: 'A1-empty-handler', count: 0, owner: 'o', expires: '2020-01-01', evidence: 'e' }],
      { today: '2026-11-03' },
    )
    expect(expired.expired.length === 1, '到期未点名')
    const malformed = judgeLedger([], [{ file: 'c.tsx', rule: 'A1-empty-handler' }], { today: '2026-11-03' })
    expect(malformed.malformed.length === 3, `缺字段未点名(${malformed.malformed.length}/3)`)
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
  for (const rel of files) {
    const r = scanSource(readText(rel))
    tagCount += r.tags
    for (const v of r.blocking) violations.push({ ...v, file: rel })
    for (const v of r.advisory) advisories.push({ ...v, file: rel })
  }
  const entries = readLedger()
  if (entries === null) {
    console.error(`❌ 台账读不到或形状坏:${LEDGER_REL} ⇒ 未判定(不拿空表冒充"零豁免")`)
    process.exit(2)
  }
  const ledger = judgeLedger(violations, entries, { today: todayStr() })
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
  parseAttrs,
  collectNoopNames,
  emptyHandlerReason,
  feedbackOf,
  isNavHandler,
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
