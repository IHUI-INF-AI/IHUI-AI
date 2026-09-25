// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 快捷键对账守门 — 拦"UI 上写了 chord,源码里却没有任何处理器"这一整类缺陷
// (仓库自述踩过的同型事故:use-native-shortcuts.ts 注释记录 Ctrl+Shift+J 曾"UI 明示但无监听")。
//
// 五类输出:
//   1) 已绑已声明(严格)  :处理器把三个 mod 槽位都断言了,且与声明完全一致
//   2) 已绑已声明(宽松)  :声明的 mod 都被要求按下、没有被否定,但处理器未断言其余槽位
//   3) 声明未绑(缺陷)    :找不到处理器 → exit 1(注册表事件无消费者也算)
//   4) 声明被他功能接走(缺陷):field 声明与全局注册表同键,但声明方证不出这个键归它 → exit 1
//   5) 存疑              :同 key 有处理器但 mod 断言矛盾 → INFO,不阻塞
//      绑了未声明        :有处理器却没有任何 UI 文案宣传 → INFO
//
// 声明侧(用户能看到的 chord 字符串):
//   - use-global-shortcuts.ts DEFAULT_SHORTCUTS 的 `key`(注册表即帮助面板的唯一真相源)
//   - 任意源文件的 `shortcut: 'Ctrl+X'` 字段 / `shortcut="Ctrl+X"` JSX 属性
//   - 任意源文件的 `<kbd …>Ctrl+X</kbd>`(含 chord 写在下一行的多行 JSX 形态)
//   - `--probe=<chord>` 注入的额外声明(变异证据用:喂不存在的 chord 必须报缺陷)
// 绑定侧(处理器存在性):
//   - 注册表 key 本身即绑定,但其 `event` 必须能在源码里找到消费者
//   - 通用按键条件解析:key/code 字面量 + ①同条件内的 mod 断言 ②外层 if 块的 mod 断言
//     ③前 30 行内的早退守卫(如 `if (!isMod) return`)
//
// 已知边界(刻意不做,避免假红):i18n 语言包内的 chord 文案与 `⌘⇧P` 类 Unicode 形式不进声明侧;
// --staged 只把声明侧限制在暂存文件(注册表条目除外 —— 它是"谁接走了键位"的真相源,必须全量),
// 绑定侧始终全量扫描。"同键位被别的功能接走"的盲区已由 mislabelled 判据覆盖 —— field 声明与
// 注册表同键时须自证持有,三条证据任一即合法:①本文件出现该条目的 event 引号字面量(它就是
// 生产/消费方);②本文件有同键处理器 + stopPropagation(独占截断,RichTextEditor 的修法);
// ③本条目字面量内出现 event 的功能词元(命令面板原样镜像全局键位,按下去就是标签写的事)。
// 只认 field:kbd/text 类常用来描述**别的表面**(帮助页/设置卡片/快捷键文档)的键位,纳进来必假红。
// 残余漏判方向:① 的 event 名若以常量/模板拼接而非引号字面量出现则读不到;② 只看声明所在文件,
// 跨文件包装派发时读不到;③ 只比词元,同义词('新建'vs'create')判不出。三者都只放过真缺陷。

import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve, relative, join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 判定面取材一律走共用层(2026-09-26 迁,守门 118 的 loose 档收口)。
// 本门此前把 `apps/web` 的候选清单与正文都按磁盘读:共享工作树常年滞后 HEAD(实测扫描面里有
// 41 个脏文件 + 13 个未跟踪文件),同一份 HEAD 代码于是会在"恒红"与"假绿"之间来回跳。
// 现口径同 70/77/83/98/101/113:**全量判 HEAD blob、`--staged` 判索引 blob、`--worktree` 只作人工
// 逃生舱**;两面旗同给 ⇒ exit 2;该面取不到输入 ⇒ exit 2「无法判定」;枚举到 0 个候选 ⇒ 判死。
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const SELF = fileURLToPath(import.meta.url)
const ROOT = resolve(dirname(SELF), '..')
const SCAN_ROOTS = ['apps/web/src', 'apps/web/app']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.ihui-agent', 'test-results'])
const SLOTS = ['mod', 'shift', 'alt']

const MOD_TOKENS = {
  mod: ['ctrlkey', 'metakey', 'cmdkey', 'ctrl', 'meta', 'cmd', 'ismod'],
  shift: ['shiftkey', 'shift'],
  alt: ['altkey', 'alt', 'optionkey'],
}
// 必须至少含一个 Ctrl/Cmd/Mod 段 + 一个键段位(不允许 `Ctrl+` 这种半截匹配)
const CHORD_SRC =
  String.raw`(?:Ctrl|Cmd|Mod)(?:\+(?:Shift|Alt|Ctrl|Cmd|Meta))?\+(?:[A-Za-z0-9]|[,./;\`'=\-\[\]\\])`
const DECL_RE = new RegExp(CHORD_SRC, 'g')
const KEY_TEST_RE =
  /(?:\b(?:[A-Za-z_$][\w$.]*\.)?(?:key|code)\b|\bk\b)\s*===\s*'([^']{1,12})'|\bcase\s+'([^']{1,12})'\s*:/g
const GUARD_RE = /^\s*(?:if|else if)\s*\((.{3,120}?)\)\s*(?:\{\s*)?(?:return|e\.preventDefault)/
// 具名功能键(e.key 的多字符值),长度上限 3 会把它们全部漏掉,必须显式放行
const NAMED_KEYS = /^(enter|tab|escape|esc|backspace|delete|spacebar|space|arrowup|arrowdown|arrowleft|arrowright|pageup|pagedown|home|end)$/i

// ---------------------------------------------------------------------------
// chord 归一化:Ctrl / Cmd / Meta / Mod 统一为 mod 槽位(Mac 等价语义,与 matchShortcut 一致)
// ---------------------------------------------------------------------------

function normalizeChord(raw) {
  const parts = String(raw)
    .replace(/[⌘⌃]/g, 'Ctrl+')
    .replace(/⌥/g, 'Alt+')
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const key = String(parts[parts.length - 1]).toLowerCase()
  if (!key) return null
  // 末段本身是修饰键名(`Ctrl++`、`Ctrl+Shift+Alt`)不是 chord,拒绝
  if (['ctrl', 'control', 'cmd', 'meta', 'mod', 'shift', 'alt', 'option'].includes(key)) return null
  const mods = { mod: false, shift: false, alt: false }
  for (const t of parts.slice(0, -1).map((p) => p.toLowerCase())) {
    if (t === 'ctrl' || t === 'control' || t === 'cmd' || t === 'meta' || t === 'mod') mods.mod = true
    else if (t === 'shift') mods.shift = true
    else if (t === 'alt') mods.alt = true
    else return null // 未知修饰键不猜
  }
  const required = SLOTS.filter((s) => mods[s])
  return { raw: String(raw), key, mods, required, canonical: `${required.join('+')}${required.length ? '+' : ''}${key}` }
}

// ---------------------------------------------------------------------------
// 声明侧
// ---------------------------------------------------------------------------

function collectDeclarations(file, text) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const out = []
  const add = (raw, kind, line) => {
    const c = raw ? normalizeChord(raw) : null
    if (c) out.push({ ...c, kind, file: rel, line })
  }

  if (/use-global-shortcuts\.ts$/.test(rel)) {
    const start = text.indexOf('DEFAULT_SHORTCUTS')
    if (start !== -1) {
      const block = text.slice(start, text.indexOf('// ===', start) > start ? text.indexOf('// ===', start) : text.length)
      for (const m of block.matchAll(/\{\s*key:\s*'([^']+)'\s*,\s*description:\s*'([^']*)'\s*,\s*event:\s*'([^']+)'/g)) {
        const c = normalizeChord(m[1])
        if (c) out.push({ ...c, kind: 'registry', file: rel, event: m[3], description: m[2] })
      }
    }
    return out // 注册表文件只按结构化条目采集,避免与注释里的 chord 重复
  }

  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    const isComment = /^\s*(?:\/\/|\*|\/\*)/.test(line)
    if (/<kbd[^>]*>\s*$/.test(line)) {
      const next = (lines[i + 1] || '').trim()
      for (const h of next.match(DECL_RE) || []) add(h, 'kbd', i + 2)
    }
    const struct =
      line.match(/shortcut\s*[:=]\s*['"]([^'"]+)['"]/) || line.match(/<kbd[^>]*>\s*([^<]+?)\s*<\/kbd>/)
    if (struct) add(struct[1], /shortcut/.test(struct[0]) ? 'field' : 'kbd', i + 1)
    else if (!isComment) for (const h of line.match(DECL_RE) || []) add(h, 'text', i + 1)
  })
  return out.filter((d) => d.required.length > 0) // 只收"组合键";裸 Enter/Esc/↑/F12 不属于本守门范围
}

// ---------------------------------------------------------------------------
// 绑定侧
// ---------------------------------------------------------------------------

/** 条件文本 → 每个 mod 槽位的断言;'1'=要求按下,'0'=要求不按下,null=未断言,'X'=自相矛盾 */
function modFactsFrom(condText, invert) {
  const facts = { mod: null, shift: null, alt: null }
  const lc = String(condText).toLowerCase()
  for (const slot of SLOTS) {
    for (const tok of MOD_TOKENS[slot]) {
      // `!e.ctrlKey` / `!ctrl` / `!event.shiftKey` 都算否定断言:`!` 与被取反的属性之间
      // 可能隔着接收者(`e.`),必须一并吃掉,否则会把"要求按下"误判成"要求不按下"。
      const re = new RegExp(`(!)?\\s*(?:[A-Za-z_$][\\w$]*\\.)*\\b${tok}\\b`, 'g')
      let m
      while ((m = re.exec(lc))) {
        const negated = Boolean(m[1])
        // 普通条件 `if (ctrl && !shift)` → 直接就是断言;
        // 早退守卫 `if (!isMod) return` → 越过守卫即意味着断言取反(De Morgan 后逐项翻转)。
        const want = invert ? negated : !negated
        const v = want ? '1' : '0'
        if (facts[slot] === null) facts[slot] = v
        else if (facts[slot] !== v) facts[slot] = 'X'
      }
    }
  }
  return facts
}

/** 包含 idx 的最近 `if (cond)` 条件文本 */
function enclosingCondition(text, idx) {
  const head = text.lastIndexOf('if (', idx)
  if (head === -1) return null
  let depth = 0
  for (let i = head + 3; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') {
      depth--
      if (depth === 0) return i < idx ? null : { cond: text.slice(head + 4, i), start: head }
    }
  }
  return null
}

/** 外层块作用域的 if 头(从 idx 反向走括号深度,收集每一层 `if (cond) {`) */
function enclosingBlockHeads(text, idx) {
  const heads = []
  let depth = 0
  for (let i = idx - 1; i >= 0 && idx - i < 12000; i--) {
    const ch = text[i]
    if (ch === '}') depth++
    else if (ch === '{') {
      if (depth > 0) {
        depth--
        continue
      }
      let j = i - 1
      while (j >= 0 && /\s/.test(text[j])) j--
      if (text[j] !== ')') continue
      let d = 0
      let k = j
      for (; k >= 0; k--) {
        if (text[k] === ')') d++
        else if (text[k] === '(') {
          d--
          if (d === 0) break
        }
      }
      const before = text.slice(Math.max(0, k - 8), k)
      if (/\bif$/.test(before.trimEnd()) || /\bif\s*$/.test(before)) heads.push(text.slice(k + 1, j))
    }
  }
  return heads
}

/** 前 30 行内的早退守卫(如 `if (!isMod) return`) */
function guardFacts(text, idx) {
  const lines = text.slice(Math.max(0, idx - 6000), idx).split(/\r?\n/)
  const facts = { mod: null, shift: null, alt: null }
  for (const line of lines.slice(-30)) {
    const m = line.match(GUARD_RE)
    if (!m) continue
    if (/\bkey\b\s*===|\.code\s*===/.test(m[1])) continue
    const f = modFactsFrom(m[1], true)
    for (const slot of SLOTS) if (facts[slot] === null) facts[slot] = f[slot]
  }
  return facts
}

function mergeFacts(...list) {
  const out = { mod: null, shift: null, alt: null }
  for (const f of list) for (const slot of SLOTS) if (out[slot] === null) out[slot] = f?.[slot] ?? null
  return out
}

/** 单文件 → 处理器列表 [{ key, required:Set, forbidden:Set, undetermined, strict, file, line }] */
function parseHandlers(file, text) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  if (!/keydown|onKeyDown|attachCustomKeyEventHandler|KeyboardEvent/.test(text)) return []
  const out = []
  const lineOf = (i) => text.slice(0, i).split(/\r?\n/).length
  KEY_TEST_RE.lastIndex = 0
  let m
  while ((m = KEY_TEST_RE.exec(text))) {
    const raw = String(m[1] ?? m[2] ?? '').trim()
    if (!raw || raw.length > 12) continue
    const key = /^Key[A-Z]$/.test(raw) ? raw.slice(3).toLowerCase() : raw.toLowerCase()
    if (!key || (key.length > 3 && !NAMED_KEYS.test(raw))) continue
    const idx = m.index
    const own = enclosingCondition(text, idx)
    const facts = mergeFacts(
      own ? modFactsFrom(own.cond, false) : null,
      ...enclosingBlockHeads(text, idx).map((c) => modFactsFrom(c, false)),
      guardFacts(text, idx),
    )
    const required = SLOTS.filter((s) => facts[s] === '1')
    const forbidden = SLOTS.filter((s) => facts[s] === '0')
    const undetermined = SLOTS.filter((s) => facts[s] === null || facts[s] === 'X')
    out.push({
      key,
      required: new Set(required),
      forbidden: new Set(forbidden),
      determined: undetermined.length === 0,
      facts,
      file: rel,
      line: lineOf(idx),
      raw,
    })
  }
  return out
}

/** 声明的 chord 与处理器是否相容:'严格' / '宽松' / '矛盾' / null(不是同一个 key) */
function matchHandler(d, h) {
  if (h.key !== d.key) return null
  for (const s of h.forbidden) if (d.mods[s]) return '矛盾' // 处理器明确要求不按下
  for (const s of h.required) if (!d.mods[s]) return '矛盾' // 处理器要求按下但声明没带
  return h.determined && h.required.size === SLOTS.filter((s) => d.mods[s]).length ? '严格' : '宽松'
}

function quotedLiteralRe(event) {
  const escaped = String(event).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`['"\`]${escaped}['"\`]`)
}

function eventHasConsumer(event, allText) {
  if (event.startsWith('__')) return true // 内置:由 hook 自身消化
  return quotedLiteralRe(event).test(allText)
}

/** 声明方是否真的持有这个键位(见文件头 mislabelled 判据) */
const EVENT_GENERIC_TOKENS = new Set(['global', 'shortcut', 'mode', 'type', 'open', 'toggle', 'show', 'hide', 'cycle', 'switch'])

/** event 名 → 功能词元('global-shortcut:mode-build' → ['build']),泛词不参与比对 */
function eventTokens(event) {
  const tail = String(event).slice(String(event).lastIndexOf(':') + 1)
  return tail
    .split(/[-_\s]+|(?<=[a-z0-9])(?=[A-Z])/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 3 && !EVENT_GENERIC_TOKENS.has(t))
}

function lineStart(text, line) {
  if (!Number.isInteger(line) || line < 1) return -1
  const rows = text.split(/\r?\n/)
  if (rows.length < line) return -1
  return rows.slice(0, line - 1).reduce((n, s) => n + s.length + 1, 0)
}

/** 包住 idx 的最内层 `{ … }`(数据条目字面量) */
function enclosingObjectText(text, idx) {
  if (idx < 0) return ''
  let depth = 0
  let start = -1
  for (let i = idx; i >= 0; i--) {
    if (text[i] === '}') depth++
    else if (text[i] === '{') {
      if (depth === 0) {
        start = i
        break
      }
      depth--
    }
  }
  if (start === -1) return ''
  let d = 0
  for (let i = start; i < text.length && i - start < 4000; i++) {
    if (text[i] === '{') d++
    else if (text[i] === '}' && --d === 0) return text.slice(start, i + 1)
  }
  return ''
}

function holdsChord(decl, registryEntry, fileText, handlersInFile) {
  if (registryEntry.event && quotedLiteralRe(registryEntry.event).test(fileText)) return true
  const owned = handlersInFile.some((h) => {
    const mode = matchHandler(decl, h)
    return mode !== null && mode !== '矛盾'
  })
  // 独占证据要求"同键处理器 + 截断冒泡"同时成立:只有 stopPropagation 说明它不会与
  // window 级注册表同时生效(RichTextEditor 的修法),缺一即不认。
  if (owned && fileText.includes('stopPropagation')) return true
  // ③镜像标注:该条目自身动作与注册表条目同义(命令面板把全局键位原样列出来),
  // 按下去发生的正是标签写的事,不算说谎;比对范围严格限制在本条目字面量内。
  const tokens = eventTokens(registryEntry.event)
  const entry = enclosingObjectText(fileText, lineStart(fileText, decl.line))
  return tokens.length > 0 && entry !== '' && tokens.some((t) => new RegExp(`\\b${t}\\b`, 'i').test(entry))
}

/**
 * field 声明与注册表同键 → 逐个核验持有证据,拿不出证据即"标签说谎"。
 * 只认 field:kbd/text 类常在帮助页/设置卡片里描述**别的表面**的键位,纳入必假红。
 */
function detectMislabelled(declarations, handlers, fileTexts) {
  const registryByChord = new Map()
  for (const r of declarations) {
    if (r && r.kind === 'registry' && r.event && !registryByChord.has(r.canonical)) registryByChord.set(r.canonical, r)
  }
  if (registryByChord.size === 0 || fileTexts.size === 0) return []
  const byFile = new Map()
  for (const h of handlers) {
    const list = byFile.get(h.file)
    if (list) list.push(h)
    else byFile.set(h.file, [h])
  }
  const out = []
  const seen = new Set()
  for (const d of declarations) {
    if (!d || d.kind !== 'field') continue
    const r = registryByChord.get(d.canonical)
    const fileText = r ? fileTexts.get(d.file) : undefined
    if (!r || fileText === undefined) continue
    if (holdsChord(d, r, fileText, byFile.get(d.file) || [])) continue
    const id = `${d.file}:${d.canonical}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ ...d, event: r.event, reason: `同键位实际被 ${r.event}(use-global-shortcuts 注册表)接走` })
  }
  return out
}

function reconcile(declarations, handlers, allText, fileTexts = new Map()) {
  const byChord = new Map()
  for (const d of declarations) {
    if (!d) continue
    const cur = byChord.get(d.canonical)
    if (!cur) byChord.set(d.canonical, d)
    else if (cur.kind !== 'registry' && d.kind === 'registry') byChord.set(d.canonical, { ...d, also: [cur.file] })
    else (cur.also ||= []).push(d.file)
  }
  const bound = []
  const unbound = []
  const doubtful = []
  for (const d of byChord.values()) {
    if (d.kind === 'registry') {
      // 注册表条目由 matchShortcut 泛化匹配,键位存在即已绑;真正的风险是"有键无消费者"
      if (d.event && !eventHasConsumer(d.event, allText)) unbound.push({ ...d, reason: `有键无消费者:${d.event}` })
      else bound.push({ ...d, via: { file: d.file, line: 0 }, mode: '注册表' })
      continue
    }
    let best = null
    let conflict = null
    for (const h of handlers) {
      const mode = matchHandler(d, h)
      if (mode === '矛盾') {
        conflict = conflict || h
        continue
      }
      if (!mode) continue
      if (!best || mode === '严格') best = { h, mode }
      if (best.mode === '严格') break
    }
    if (best) bound.push({ ...d, via: best.h, mode: best.mode })
    else if (conflict) doubtful.push({ ...d, via: conflict, why: '同 key 有处理器,但修饰键断言不一致' })
    else unbound.push({ ...d, reason: '源码中不存在该组合键的处理器(key 字面量亦无冲突命中)' })
  }
  const undeclared = []
  for (const h of handlers) {
    if (!h.determined || h.required.size === 0) continue
    const c = `${[...h.required].join('+')}+${h.key}`
    if (!byChord.has(c)) undeclared.push({ canonical: c, file: h.file, line: h.line })
  }
  return { bound, unbound, doubtful, undeclared, mislabelled: detectMislabelled(declarations, handlers, fileTexts) }
}

// ---------------------------------------------------------------------------
// 遍历 / git
// ---------------------------------------------------------------------------

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) yield* walk(full)
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name) && !/\.gen\.ts$/.test(name)) yield full
  }
}

const GIT_TIMEOUT = 120000
/** 结论行点名的判定面标注(口径必须在输出里如实报出,同门 113) */
const FACE_TAG = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(逃生舱)' }
/** 与 `walk()` 的收文件条件逐字同形 —— 三面必须用同一个筛选,否则"清单"本身就掺了别的口径 */
const SOURCE_FILE = (name) => /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name) && !/\.gen\.ts$/.test(name)

/**
 * 暂存清单(只用于枚举路径,不读正文)。失败仍返回空集 —— 与改法前逐字等值:
 * `--staged` 拿到空集时声明侧只剩注册表,而全量侧另有"枚举到 0 个候选 ⇒ 判死"的护栏。
 */
function stagedFiles() {
  try {
    return new Set(
      gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], ROOT, { timeout: GIT_TIMEOUT })
        .split('\n')
        .map((s) => s.trim().replace(/\\/g, '/'))
        .filter(Boolean),
    )
  } catch {
    return new Set()
  }
}

/**
 * 该面的候选文件清单(posix 相对路径)。
 * **清单与内容必须同面同轮** —— 用磁盘 glob 列清单、用 git 读内容,会造出一把自洽但基准错位的尺子。
 */
export function listSources(root = ROOT, face = 'worktree') {
  const inScope = (p) => SCAN_ROOTS.some((r) => p === r || p.startsWith(r + '/'))
  if (face === 'worktree') {
    const out = []
    for (const r of SCAN_ROOTS) for (const f of walk(resolve(root, r))) out.push(relative(root, f).replace(/\\/g, '/'))
    return out
  }
  const args =
    face === 'head' ? ['ls-tree', '-r', '--name-only', 'HEAD', '-z'] : ['ls-files', '-z']
  const listed = gitRaw(args, root, { timeout: GIT_TIMEOUT })
    .split('\0')
    .filter(Boolean)
    .filter((p) => inScope(p) && SOURCE_FILE(p.split('/').pop()) && !p.split('/').some((s) => SKIP_DIRS.has(s)))
  // 顺序按 SCAN_ROOTS 分组、组内按路径排序 —— git 的扁平路径序与原来的"逐根深度优先遍历"不同形,
  // 而 `reconcile` 对同一 chord 的多个候选处理器取**先出现者**,列表顺序会决定 `via` 指向谁。
  // 判据本身与顺序无关(集合一样),但输出逐字稳定性属交付门槛,故在此显式规定枚举序。
  return SCAN_ROOTS.flatMap((r) => listed.filter((p) => p === r || p.startsWith(r + '/')).sort())
}

/** 一次 `cat-file --batch` 预取整面;未预取的路径一律判"取不到",不在这里偷偷补一次派生。 */
export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

export function scanSources(opts = {}) {
  const root = opts.root ?? ROOT
  const face = opts.face ?? 'worktree'
  const declarations = []
  const handlers = []
  const fileTexts = new Map()
  const unread = []
  let allText = ''
  const files = listSources(root, face)
  if (files.length === 0)
    throw new Undetermined(`${FACE_TAG[face]} 面在 ${SCAN_ROOTS.join(' / ')} 下枚举到 0 个源文件 —— 判据失效不得表现为"扫 0 记绿"`)
  const texts = readFace(root, face, files)
  for (const rel of files) {
    const text = texts.get(rel)
    if (typeof text !== 'string') {
      unread.push(rel)
      continue
    }
    const file = join(root, rel)
    allText += text
    handlers.push(...parseHandlers(file, text))
    const isRegistry = /use-global-shortcuts\.ts$/.test(rel)
    // --staged 下注册表条目仍须全量:它是"键位被谁接走"的真相源,漏读会让 mislabelled 恒绿
    if (!opts.staged || opts.staged.has(rel) || isRegistry) {
      const decls = collectDeclarations(file, text)
      if (decls.length > 0) fileTexts.set(rel, text)
      declarations.push(...decls)
    }
  }
  return { declarations, handlers, allText, fileTexts, unread, fileCount: files.length }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return runSelfTest()
  // 三面各取所面(同 70/77/83/98/101/113):缺省判 HEAD blob,--staged 判索引 blob,
  // --worktree 只作人工逃生舱;两个面旗同给 ⇒ 判死(取哪一面都会让另一面成为假绿)。
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  let scanned
  try {
    assertRepoRoot(ROOT, '本门')
    scanned = scanSources({ staged: face === 'staged' ? stagedFiles() : null, face })
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : e?.message ?? String(e)
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  const { declarations, handlers, allText, fileTexts, unread } = scanned
  if (unread.length) {
    console.error(`❌ 无法判定(exit 2):${FACE_TAG[face]} 面有 ${unread.length} 个候选取不到内容 —— 少扫不是"没有缺陷":${unread.slice(0, 6).join(', ')}${unread.length > 6 ? ' …' : ''}`)
    return 2
  }
  const probeArg = argv.find((a) => a.startsWith('--probe'))
  if (probeArg) {
    const val = probeArg.includes('=') ? probeArg.split('=')[1] : argv[argv.indexOf(probeArg) + 1]
    const c = normalizeChord(val)
    if (!c) {
      console.error(`--probe 参数无法解析为 chord: ${val}`)
      return 2
    }
    declarations.push({ ...c, kind: 'probe', file: '--probe' })
  }
  const result = reconcile(declarations, handlers, allText, fileTexts)
  report(result, { json: argv.includes('--json'), staged: face === 'staged', probed: Boolean(probeArg), face })
  return result.unbound.length + result.mislabelled.length > 0 ? 1 : 0
}

function report(r, o) {
  const row = (d) => `${d.canonical.padEnd(18)} ${d.kind.padEnd(9)} ${d.file}:${d.line ?? ''}`
  if (o.json) {
    process.stdout.write(
      JSON.stringify(
        {
          bound: r.bound.map((d) => ({ chord: d.canonical, kind: d.kind, where: `${d.file}`, mode: d.mode, handler: `${d.via.file}:${d.via.line}` })),
          unbound: r.unbound.map((d) => ({ chord: d.canonical, kind: d.kind, where: d.file, reason: d.reason })),
          mislabelled: r.mislabelled.map((d) => ({
            chord: d.canonical,
            kind: d.kind,
            where: `${d.file}:${d.line ?? ''}`,
            event: d.event,
            reason: d.reason,
          })),
          doubtful: r.doubtful.map((d) => ({ chord: d.canonical, where: d.file, reason: d.why, handler: `${d.via.file}:${d.via.line}` })),
          undeclared: r.undeclared,
        },
        null,
        2,
      ) + '\n',
    )
    return
  }
  console.log(`\n=== 快捷键对账${o.staged ? '(声明侧 = 暂存区)' : '(声明侧 = 全量)'} · 判定面 ${FACE_TAG[o.face] ?? o.face},绑定侧全量扫描 ===`)
  console.log(`\n【已绑已声明】${r.bound.length} 项`)
  for (const d of r.bound) console.log(`  ✓ ${row(d)}  → ${d.mode} @ ${d.via.file}:${d.via.line}`)
  console.log(`\n【声明未绑 — 缺陷】${r.unbound.length} 项`)
  for (const d of r.unbound) console.log(`  ✗ ${row(d)}  → ${d.reason}`)
  console.log(`\n【声明被他功能接走 — 缺陷】${r.mislabelled.length} 项`)
  for (const d of r.mislabelled)
    console.log(
      `  ✗ ${row(d)}  → ${d.reason};要么删掉这个键位标签,要么在本文件加 ${d.event} 的处理/派发并 e.stopPropagation() 独占`,
    )
  console.log(`\n【存疑 — mod 断言不一致】${r.doubtful.length} 项`)
  for (const d of r.doubtful) console.log(`  ? ${row(d)}  → ${d.why}(${d.via.file}:${d.via.line})`)
  console.log(`\n【绑了未声明 — 信息】${r.undeclared.length} 项`)
  for (const d of r.undeclared) console.log(`  · ${d.canonical.padEnd(18)} ${d.file}:${d.line}`)
  console.log('')
}

// ---------------------------------------------------------------------------
// 自检(固定夹具,不依赖仓库内容)
// ---------------------------------------------------------------------------

const FIXTURE = `
const handler = (e: KeyboardEvent) => {
  const isMod = e.ctrlKey || e.metaKey
  if (!isMod) return
  if (e.shiftKey) {
    switch (key) {
      case 'u': e.preventDefault(); return
      case 'r': e.preventDefault(); return
    }
  }
  if (ctrl && !shift && !alt && key === 'd') { fire() }
  if (ctrl && !shift && !alt && key === 'q') { fire() }
  if (!ctrl && !shift && !alt && key === 'f11') { fire() }
}
`
const FIX_FILE = '/abs/apps/web/src/hooks/__fixture__.ts'

function fixtureHandlers() {
  return parseHandlers(FIX_FILE, FIXTURE)
}
function d(raw, kind = 'field') {
  return { ...normalizeChord(raw), kind, file: 'fixture' }
}

function runSelfTest() {
  const handlers = fixtureHandlers()
  const cases = []
  const check = (name, cond) => cases.push([name, Boolean(cond)])
  check('夹具解析出 5 个按键处理器', handlers.length === 5)

  const ok = reconcile([d('Ctrl+Shift+U')], handlers, '{}')
  check('正例:Ctrl+Shift+U 已绑(alt 槽位未断言 → 宽松)', ok.bound.length === 1 && ok.bound[0].mode === '宽松')
  const okStrict = reconcile([d('Ctrl+Q')], handlers, '{}')
  check('正例:Ctrl+Q 已绑(三个槽位全断言 → 严格)', okStrict.bound.length === 1 && okStrict.bound[0].mode === '严格')
  const okAlt = reconcile([{ ...d('Ctrl+D', 'registry'), event: 'global-shortcut:x' }], handlers, "y('global-shortcut:x')")
  check('正例:注册表 Ctrl+D 已绑(注册表通道,泛化匹配)', okAlt.bound.length === 1 && okAlt.bound[0].mode === '注册表')
  const defect = reconcile([d('Ctrl+Alt+Y')], handlers, '{}')
  check('缺陷:不存在的 chord → 声明未绑', defect.unbound.length === 1 && defect.unbound[0].canonical === 'mod+alt+y')
  const conflict = reconcile([d('Ctrl+Shift+Q')], handlers, '{}')
  check('存疑:!shift 矛盾 → 不判缺陷也不判已绑', conflict.doubtful.length === 1 && conflict.unbound.length === 0 && conflict.bound.length === 0)
  const noConsumer = reconcile([{ ...d('Ctrl+Shift+U'), kind: 'registry', event: 'global-shortcut:ghost' }], handlers, '{}')
  check('缺陷:注册表有键无消费者', noConsumer.unbound.length === 1 && /无消费者/.test(noConsumer.unbound[0].reason))
  const consumer = reconcile([{ ...d('Ctrl+Shift+U'), kind: 'registry', event: 'global-shortcut:real' }], handlers, "x('global-shortcut:real')")
  check('正例:注册表事件有消费者 → 已绑', consumer.bound.length === 1)
  const undeclared = reconcile([d('Ctrl+Shift+U')], handlers, '{}')
  check('信息:绑了未声明被列出(Ctrl+Q 在声明侧缺席)', undeclared.undeclared.some((x) => x.canonical === 'mod+q'))

  check('归一化:Cmd 与 Ctrl 同槽位', normalizeChord('Cmd+Shift+P').canonical === normalizeChord('Ctrl+Shift+P').canonical)
  check('归一化:未知修饰键返回 null', normalizeChord('Ctrl+Hyper+P') === null)
  const decl = collectDeclarations('/abs/apps/web/src/components/x/y.tsx', `const A = [{ shortcut: 'Ctrl+B' }]\n<Tooltip shortcut="Ctrl+," />\n<div><kbd>Ctrl+Alt+Z</kbd></div>\n// Ctrl+K 注释不算`)
  check('声明侧:shortcut 字段/属性 + kbd 命中,注释不命中', decl.length === 3 && !decl.some((x) => x.canonical === 'mod+k'))

  // ---- 判定面构造证明(2026-09-26 迁移配套,真造临时 git 仓)----------------------
  // 同一个 `apps/web/src/pane.tsx`:**HEAD** 里没有 chord,**索引**里新增了一条
  // `shortcut: 'Ctrl+Shift+Z'`(临时仓里没有该键位的处理器)。四条断言方向各异,
  // 缺任何一条,上面的"跟面走"就可能是恒真式或磁盘巧合。
  const faceRoot = mkScratch('ihui-shortcuts-face-')
  try {
    const rel = 'apps/web/src/pane.tsx'
    mkdirSync(join(faceRoot, 'apps/web/src'), { recursive: true })
    writeFileSync(join(faceRoot, rel), 'export const P = () => null\n', 'utf8')
    gitRaw(['init', '-q'], faceRoot, { timeout: GIT_TIMEOUT })
    gitRaw(['add', '-A'], faceRoot, { timeout: GIT_TIMEOUT })
    gitRaw(['-c', 'user.name=gate', '-c', 'user.email=gate@local', 'commit', '-q', '-m', 'base'], faceRoot, { timeout: GIT_TIMEOUT })
    writeFileSync(join(faceRoot, rel), "export const P = () => null\nconst items = [{ shortcut: 'Ctrl+Shift+Z', label: 'x' }]\n", 'utf8')
    gitRaw(['add', '--', rel], faceRoot, { timeout: GIT_TIMEOUT })

    const stagedScan = scanSources({ root: faceRoot, face: 'staged', staged: new Set([rel]) })
    const r1 = reconcile(stagedScan.declarations, stagedScan.handlers, stagedScan.allText, stagedScan.fileTexts)
    check('构造面①:索引内容与 HEAD 不同 ⇒ --staged 档必须跟索引走(那条 chord 被算成"声明未绑")', r1.unbound.length === 1 && r1.unbound[0].canonical === 'mod+shift+z')

    const headScan = scanSources({ root: faceRoot, face: 'head' })
    const r2 = reconcile(headScan.declarations, headScan.handlers, headScan.allText, headScan.fileTexts)
    check('构造面②:同一输入在 HEAD 档给出 HEAD 的结论(该面里没有这条声明 —— 反向对照,证明①不是恒真)', r2.unbound.length === 0 && headScan.declarations.length === 0 && stagedScan.declarations.length === 1)
    check('构造面③:清单与内容同面 —— 两面的候选都是 1 个文件,而声明侧文件集只来自被审的那一面', headScan.fileCount === 1 && stagedScan.fileCount === 1 && [...stagedScan.fileTexts.keys()].join() === rel)
    check('构造面④:该面取不到内容不得静默跳过(unread 必须为空,否则就是少扫)', stagedScan.unread.length === 0 && headScan.unread.length === 0)

    const emptyRoot = mkScratch('ihui-shortcuts-empty-')
    try {
      gitRaw(['init', '-q'], emptyRoot, { timeout: GIT_TIMEOUT })
      gitRaw(['-c', 'user.name=gate', '-c', 'user.email=gate@local', 'commit', '-q', '--allow-empty', '-m', 'base'], emptyRoot, { timeout: GIT_TIMEOUT })
      let thrown = null
      try {
        scanSources({ root: emptyRoot, face: 'head' })
      } catch (e) {
        thrown = e
      }
      check('构造面⑤:该面枚举到 0 个候选 ⇒ 抛 Undetermined(判死),绝不记成"扫 0 = 通过"', thrown instanceof Undetermined)
    } finally {
      rmScratch(emptyRoot)
    }
  } finally {
    rmScratch(faceRoot)
  }

  let fail = 0
  for (const [name, cond] of cases) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
    if (!cond) fail++
  }
  console.log(`\n${cases.length - fail}/${cases.length} 通过`)
  return fail ? 1 : 0
}

export const __test__ = {
  normalizeChord,
  collectDeclarations,
  parseHandlers,
  modFactsFrom,
  enclosingCondition,
  enclosingBlockHeads,
  guardFacts,
  matchHandler,
  eventHasConsumer,
  detectMislabelled,
  holdsChord,
  reconcile,
  scanSources,
  FIXTURE,
  FIX_FILE,
  runSelfTest,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
