// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 快捷键对账守门 — 拦"UI 上写了 chord,源码里却没有任何处理器"这一整类缺陷
// (仓库自述踩过的同型事故:use-native-shortcuts.ts 注释记录 Ctrl+Shift+J 曾"UI 明示但无监听")。
//
// 四类输出:
//   1) 已绑已声明(严格)  :处理器把三个 mod 槽位都断言了,且与声明完全一致
//   2) 已绑已声明(宽松)  :声明的 mod 都被要求按下、没有被否定,但处理器未断言其余槽位
//   3) 声明未绑(缺陷)    :找不到处理器 → exit 1(注册表事件无消费者也算)
//   4) 存疑              :同 key 有处理器但 mod 断言矛盾 → INFO,不阻塞
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
// 已知边界(刻意不做,避免假红):i18n 语言包内的 chord 文案与 `⌘⇧P` 类 Unicode 形式
// 不进声明侧;--staged 只把声明侧限制在暂存文件,绑定侧始终全量扫描。

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, relative, join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
  const add = (raw, kind) => {
    const c = raw ? normalizeChord(raw) : null
    if (c) out.push({ ...c, kind, file: rel })
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
      for (const h of next.match(DECL_RE) || []) add(h, 'kbd')
    }
    const struct =
      line.match(/shortcut\s*[:=]\s*['"]([^'"]+)['"]/) || line.match(/<kbd[^>]*>\s*([^<]+?)\s*<\/kbd>/)
    if (struct) add(struct[1], /shortcut/.test(struct[0]) ? 'field' : 'kbd')
    else if (!isComment) for (const h of line.match(DECL_RE) || []) add(h, 'text')
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

function eventHasConsumer(event, allText) {
  if (event.startsWith('__')) return true // 内置:由 hook 自身消化
  const escaped = event.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`['"\`]${escaped}['"\`]`).test(allText)
}

function reconcile(declarations, handlers, allText) {
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
  return { bound, unbound, doubtful, undeclared }
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

function git(args) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

function stagedFiles() {
  try {
    return new Set(
      git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
        .split('\n')
        .map((s) => s.trim().replace(/\\/g, '/'))
        .filter(Boolean),
    )
  } catch {
    return new Set()
  }
}

function scanSources(opts = {}) {
  const declarations = []
  const handlers = []
  let allText = ''
  for (const root of SCAN_ROOTS) {
    for (const file of walk(resolve(ROOT, root))) {
      let text
      try {
        text = readFileSync(file, 'utf8')
      } catch {
        continue
      }
      allText += text
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      handlers.push(...parseHandlers(file, text))
      if (!opts.staged || opts.staged.has(rel)) declarations.push(...collectDeclarations(file, text))
    }
  }
  return { declarations, handlers, allText }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return runSelfTest()
  const staged = argv.includes('--staged') ? stagedFiles() : null
  const { declarations, handlers, allText } = scanSources({ staged })
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
  const result = reconcile(declarations, handlers, allText)
  report(result, { json: argv.includes('--json'), staged: Boolean(staged), probed: Boolean(probeArg) })
  return result.unbound.length > 0 ? 1 : 0
}

function report(r, o) {
  const row = (d) => `${d.canonical.padEnd(18)} ${d.kind.padEnd(9)} ${d.file}:${d.line ?? ''}`
  if (o.json) {
    process.stdout.write(
      JSON.stringify(
        {
          bound: r.bound.map((d) => ({ chord: d.canonical, kind: d.kind, where: `${d.file}`, mode: d.mode, handler: `${d.via.file}:${d.via.line}` })),
          unbound: r.unbound.map((d) => ({ chord: d.canonical, kind: d.kind, where: d.file, reason: d.reason })),
          doubtful: r.doubtful.map((d) => ({ chord: d.canonical, where: d.file, reason: d.why, handler: `${d.via.file}:${d.via.line}` })),
          undeclared: r.undeclared,
        },
        null,
        2,
      ) + '\n',
    )
    return
  }
  console.log(`\n=== 快捷键对账${o.staged ? '(声明侧 = 暂存区)' : '(声明侧 = 全量)'},绑定侧全量扫描 ===`)
  console.log(`\n【已绑已声明】${r.bound.length} 项`)
  for (const d of r.bound) console.log(`  ✓ ${row(d)}  → ${d.mode} @ ${d.via.file}:${d.via.line}`)
  console.log(`\n【声明未绑 — 缺陷】${r.unbound.length} 项`)
  for (const d of r.unbound) console.log(`  ✗ ${row(d)}  → ${d.reason}`)
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
