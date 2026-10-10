// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端 Button 共享档位的"不许整档另写"锁(2026-09-29 O92 用户拍板:基座 + 追加,而非整档覆盖)。
// 为什么要有这一条:共享表若被任何一端用字面量整档重写,那个共享值就只约束"没重写的那一端" ——
// 而账面读起来仍是"两端同源",这正是 AGENTS §4「跨端样式同步铁律」要治的形态换了个载体回来。
// 判据输入全部由被审面自身推导(共享表的键集从 button-variants.ts 现读),不建第二份名单。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { resolveGitBin, resolveWorktree } from '../lib/gitdir.mjs'

const GIT = resolveGitBin()
const ROOT = resolveWorktree()

const SHARED_PATH = 'packages/design-tokens/src/button-variants.ts'
const ENDS = [
  ['ui-native', 'packages/ui-native/src/button.tsx'],
  ['ui-react', 'packages/ui-react/src/components/button.tsx'],
]
const TABLE_CONST = {
  variant: 'SHARED_BUTTON_VARIANT_CLASSES',
  size: 'SHARED_BUTTON_SIZE_CLASSES',
}

/** 判定面 = HEAD blob(与守门 70/77/83/98 同口径;干净检出上 HEAD 就是被审的那枚提交) */
const readHead = (path) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', 'show', `HEAD:${path}`], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })

function matchBraces(text, open) {
  if (open < 0) throw new Error('找不到对象起始大括号')
  let depth = 0
  let quote = null
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return text.slice(open + 1, i)
    }
  }
  throw new Error('大括号配平不到')
}

/** 带引号状态机切条目:续行与字符串里的冒号(`hover:bg-accent`)都不会被误判成键 */
function splitEntries(bodyText) {
  const chunks = []
  let cur = ''
  let depth = 0
  let quote = null
  let lineComment = false
  let blockComment = false
  for (let i = 0; i < bodyText.length; i++) {
    const c = bodyText[i]
    const n = bodyText[i + 1]
    if (lineComment) {
      if (c === '\n') {
        lineComment = false
        cur += c
      }
      continue
    }
    if (blockComment) {
      if (c === '*' && n === '/') {
        blockComment = false
        i++
      }
      continue
    }
    if (quote) {
      cur += c
      if (c === '\\') cur += bodyText[++i] ?? ''
      else if (c === quote) quote = null
      continue
    }
    if (c === '/' && n === '/') {
      lineComment = true
      i++
      continue
    }
    if (c === '/' && n === '*') {
      blockComment = true
      i++
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      cur += c
      continue
    }
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    if (c === ',' && depth === 0) {
      chunks.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim()) chunks.push(cur)
  const out = []
  for (const raw of chunks) {
    const chunk = raw.trim()
    if (!chunk) continue
    if (chunk.startsWith('...')) {
      out.push({ spread: chunk })
      continue
    }
    const m = chunk.match(/^(['"]?)([A-Za-z][\w-]*)\1\s*:([\s\S]*)$/)
    if (!m) throw new Error(`条目解析不到键名: ${chunk.slice(0, 70)}`)
    out.push({ key: m[2], value: m[3].trim() })
  }
  return out
}

/** 共享表的现读值(键→串)—— 判据的输入只从这一份取,不得在测试里抄第二份档位值 */
function sharedTableOf(text, constName) {
  const at = text.indexOf(`export const ${constName}`)
  if (at < 0) throw new Error(`${constName} 不在面上`)
  const body = matchBraces(text, text.indexOf('{', at))
  const map = {}
  for (const e of splitEntries(body)) {
    if (!e.key) continue
    const m = e.value.match(/^['"`]([^'"`]*)['"`]$/)
    if (!m) throw new Error(`共享表 ${constName}.${e.key} 不是字符串字面量`)
    map[e.key] = m[1]
  }
  return map
}

/** Tailwind 字号族(封闭小集,是 CSS 事实不是豁免清单):text-xs 与 text-foreground 不同族 */
const TEXT_SIZES = new Set(['2xs', 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'])

/**
 * 属性族:同一族里两个不同 token = 同一属性被赋两次值,谁生效由 Tailwind 的**输出顺序**决定,
 * 不由我们决定 —— 这正是"账面同源、屏幕上分叉"的成因,所以必须判红。
 * 带伪类/变体前缀的 token(含冒号,如 hover:bg-accent)是各端的平台修饰,不参与同族比对。
 */
function familyOf(token) {
  if (token.includes(':')) return null
  if (token === 'border') return 'border-width'
  if (token === 'rounded') return 'rounded'
  const seg = token.split('-')
  switch (seg[0]) {
    case 'bg':
    case 'h':
    case 'w':
    case 'px':
    case 'py':
    case 'font':
      return seg[0]
    case 'border':
      return 'border-color'
    case 'rounded':
      return 'rounded'
    case 'text':
      return TEXT_SIZES.has(seg[1]) ? 'text-size' : 'text-color'
    default:
      return null
  }
}

const toks = (s) => s.split(/\s+/).filter(Boolean)

/**
 * 某一端在某个共享档上的**最终串**:cva 展开顺序是 `...共享表` 在前、端内显式键在后,
 * 后者整值覆盖前者;端内值里的 `${SHARED_*.key}` 与直接引用 `SHARED_*.key` 两种写法都要还原成基座串。
 */
function finalClassOf(endText, table, key, sharedMap) {
  const open = endText.indexOf(`${table}: {`)
  if (open < 0) throw new Error(`找不到 ${table} 表`)
  const body = matchBraces(endText, endText.indexOf('{', open))
  const own = splitEntries(body).find((e) => e.key === key)
  const ref = TABLE_CONST[table]
  if (!own) return sharedMap[key] ?? ''
  let v = own.value
  const bare = v.match(new RegExp(`^${ref}\\.${key}$`))
  if (bare) return sharedMap[key] ?? ''
  v = v.replace(new RegExp(`\\$\\{${ref}\\.${key}\\}`, 'g'), () => sharedMap[key] ?? '')
  v = v.replace(/^\`|\`$/g, '')
  return v
}

/** 核心判据:端内表里显式声明了某个共享键,那一行必须引用共享常量;写成字面量 = 整档另写 */
function findOverrides(endText, table, keys) {
  const open = endText.indexOf(`${table}: {`)
  if (open < 0) throw new Error(`找不到 ${table} 表`)
  const body = matchBraces(endText, endText.indexOf('{', open))
  const entries = splitEntries(body)
  const bad = []
  const seen = new Set()
  for (const e of entries) {
    if (!e.key) continue
    if (!keys.includes(e.key)) continue // 该端独占档合法
    seen.add(e.key)
    const ref = TABLE_CONST[table]
    if (!e.value.includes(`${ref}.${e.key}`))
      bad.push(`${table}.${e.key} <= ${e.value.slice(0, 60)}`)
  }
  const spreadsShared = entries.some((e) => e.spread && e.spread.includes(TABLE_CONST[table]))
  return { bad, declared: seen, spreadsShared }
}

const sharedHead = readHead(SHARED_PATH)
const SHARED = {
  variant: sharedTableOf(sharedHead, TABLE_CONST.variant),
  size: sharedTableOf(sharedHead, TABLE_CONST.size),
}
const KEYS = { variant: Object.keys(SHARED.variant), size: Object.keys(SHARED.size) }

/** 端内追加与基座的冲突表:族 → {基座 token, 端内 token}(同族不同值即分叉) */
function conflictsOf(finalStr, sharedStr) {
  const base = toks(sharedStr)
  const baseFam = new Map()
  for (const t of base) {
    const f = familyOf(t)
    if (f) baseFam.set(f, t)
  }
  const out = []
  for (const t of toks(finalStr)) {
    const f = familyOf(t)
    if (!f) continue
    const own = baseFam.get(f)
    if (own && own !== t) out.push(`${f}: 基座 ${own} vs 端内 ${t}`)
  }
  return out
}

test('T1 共享表键集非空(枚举到 0 即尺子失效,不下结论)', () => {
  assert.ok(KEYS.variant.length >= 4, `variant 键现读 ${KEYS.variant.length} 条`)
  assert.ok(KEYS.size.length >= 2, `size 键现读 ${KEYS.size.length} 条`)
})

test('T2 两端都不得把共享键整档写成字面量', () => {
  for (const [end, path] of ENDS) {
    const text = readHead(path)
    for (const table of ['variant', 'size']) {
      const r = findOverrides(text, table, KEYS[table])
      assert.deepEqual(
        r.bad,
        [],
        `${end} 把共享档整档另写(共享值将只约束另一端): ${r.bad.join(' | ')}`,
      )
    }
  }
})

test('T3 两端都真的展开了共享表(spread 在位)', () => {
  for (const [end, path] of ENDS) {
    const text = readHead(path)
    for (const table of ['variant', 'size']) {
      const r = findOverrides(text, table, KEYS[table])
      assert.ok(r.spreadsShared, `${end} 的 ${table} 表没有展开 ${TABLE_CONST[table]}`)
    }
  }
})

test('T4 阳性对照:把 outline 写成字面量的源码必须被 T2 的判据点名', () => {
  const text = readHead('packages/ui-react/src/components/button.tsx')
  // 夹具值由共享表现读值拼出 —— 在测试里硬写第二份档位串,共享表一变这条就变成"要求门红在一条不存在的账上"
  const m = text.match(/outline: `\$\{SHARED_BUTTON_VARIANT_CLASSES\.outline\}([^`]*)`/)
  assert.ok(m, '夹具未命中 ⇒ 对照无效')
  const mutated = text.replace(m[0], `outline: '${SHARED.variant.outline}${m[1]}',`)
  const r = findOverrides(mutated, 'variant', KEYS.variant)
  assert.equal(r.bad.length, 1, `应点名 1 处整档另写,实得 ${JSON.stringify(r.bad)}`)
  assert.match(r.bad[0], /^variant\.outline/, `点名的档不对: ${r.bad[0]}`)
})

test('T5 反向对照:同一键写成"基座 + 追加"不得误报', () => {
  const text = readHead('packages/ui-react/src/components/button.tsx')
  const r = findOverrides(text, 'variant', KEYS.variant)
  assert.deepEqual(r.bad, [], `现状被误报: ${r.bad.join(' | ')}`)
})

test('T6 两端不得自行再声明一份 SHARED_*(第二真相源)', () => {
  for (const [, path] of ENDS) {
    const text = readHead(path)
    for (const name of Object.values(TABLE_CONST)) {
      assert.ok(
        !new RegExp(`export (const|type) ${name}\\b`).test(text),
        `${path} 里出现了 ${name} 的本地声明(第二份真相)`,
      )
    }
    assert.match(text, /from '@ihui\/design-tokens'/, `${path} 未从 @ihui/design-tokens 取共享表`)
  }
})

// ── T7/T8:2026-10-10 机主拍板「统一网页端和手机端按钮样式」后新增的正断言 ──────────────
// 为什么 T2 不够:T2 只管"不许把共享键整档写成字面量",而**基座 + 追加**的写法在它眼里永远合规 ——
// 于是「基座给 bg-background、端内又追加 bg-transparent」这种同族双值完全不受管,账面读起来仍是
// 两端同源,屏幕上却是分叉的(这次并档之前 RN 的 outline/ghost 正是这个形态)。并档之后必须让
// "同档名同值"本身有尺子,否则下一次一端把原子加回来,只有人眼能发现。

test('T7 基座的每个原子必须在两端该档最终串里都在位(追加不得把基座换掉)', () => {
  for (const [end, path] of ENDS) {
    const text = readHead(path)
    for (const table of ['variant', 'size']) {
      for (const key of KEYS[table]) {
        const base = toks(SHARED[table][key])
        if (!base.length) continue
        const fin = toks(finalClassOf(text, table, key, SHARED[table]))
        const gone = base.filter((t) => !fin.includes(t))
        assert.deepEqual(gone, [], `${end} 的 ${table}.${key} 丢了基座原子: ${gone.join(' ')}`)
      }
    }
  }
})

test('T8 端内追加不得与基座同族取不同值(同族双值由 Tailwind 输出顺序裁决,不是由我们裁决)', () => {
  for (const [end, path] of ENDS) {
    const text = readHead(path)
    for (const table of ['variant', 'size']) {
      for (const key of KEYS[table]) {
        const bad = conflictsOf(finalClassOf(text, table, key, SHARED[table]), SHARED[table][key])
        assert.deepEqual(bad, [], `${end} 的 ${table}.${key} 同族双值: ${bad.join(' | ')}`)
      }
    }
  }
})

test('T10 共享表每档都得有值("共同集合为空"本身就是分叉的掩体,不许再用空串占位)', () => {
  const empties = []
  for (const table of ['variant', 'size']) {
    for (const key of KEYS[table]) {
      if (!toks(SHARED[table][key]).length) empties.push(`${table}.${key}`)
    }
  }
  assert.deepEqual(
    empties,
    [],
    `这些共享档两端共同持有的原子为空 ⇒ 取值并未跨端绑定: ${empties.join(' ')}`,
  )
})

test('T9 构造面双向锁:注入 h-12 px-6 必被点名两族,只加基座未涉及的原子不误报', () => {
  const base = 'h-10 px-8'
  const bad = conflictsOf(`${base} h-12 px-6`, base)
  assert.equal(bad.length, 2, `应点名 h 与 px 两族,实得 ${JSON.stringify(bad)}`)
  assert.ok(bad.some((s) => /基座 h-10 vs 端内 h-12/.test(s)), `h 族没点名: ${bad.join(' | ')}`)
  assert.ok(bad.some((s) => /基座 px-8 vs 端内 px-6/.test(s)), `px 族没点名: ${bad.join(' | ')}`)
  assert.deepEqual(conflictsOf(`${base} rounded-sm`, base), [], '新族原子被误报')
  // hover: / focus: 这类平台修饰带冒号,不参与同族比对(否则 web 的 hover:bg-accent 会被判成 bg 冲突)
  assert.deepEqual(conflictsOf(`${base} hover:bg-accent shadow-sm`, base), [], '平台修饰被误报')
})

// ── T11:并档刻意没动的三格,钉成机器可读的账 ────────────────────────────────
// 为什么钉"差异仍在"而不是钉"不许改":这三格各自都是一个**该不该统一**的开放决定(RN 无 CSS 继承、
// 文字尺寸由组件内部 Text 控制、40px 是移动端触摸目标的余量),统一任何一格都要同时结清台账
// G-1115908 与 AGENTS/README 里的「耦合边界」句。所以本锁不是禁止改进,而是**改进发生时必红一次**,
// 逼改动的人把账同步 —— 否则下一位只能从散文里猜两端到底差在哪(散文在本仓的失效形态永远是安静)。
/** 三格未统一账的检测(导出给 T11 与 T12 共用 —— 判据只能有一份,构造面也必须走它) */
function openDivergences(native, react) {
  const open = []
  // ① 圆角:web 在 lg 追加 rounded-sm(4px),而 RN 的 cva 基座整表是 rounded-md(6px)
  const rnBase = (native.match(/cva\(\s*`([^`]*)`/) ?? ['', ''])[1]
  if (
    /rounded-md/.test(rnBase) &&
    /\brounded-sm\b/.test(finalClassOf(react, 'size', 'lg', SHARED.size))
  )
    open.push('圆角:web lg=rounded-sm vs RN 基座=rounded-md')
  // ② 默认档高度:RN 独占 md=h-10(40) 对 web 的 default=h-9(36)
  const rnMd = finalClassOf(native, 'size', 'md', SHARED.size)
  const webDefault = finalClassOf(react, 'size', 'default', SHARED.size)
  if (/\bh-10\b/.test(rnMd) && /\bh-9\b/.test(webDefault))
    open.push(
      `默认档高度:RN md=${rnMd.match(/h-\d+/)?.[0] ?? '?'} vs web default=${webDefault.match(/h-\d+/)?.[0] ?? '?'}`,
    )
  // ③ 字号:web 的 sm 追加 text-xs,而 RN 的 size 档只作用在盒上(字由内部 Text 固定 text-sm)
  const webSm = finalClassOf(react, 'size', 'sm', SHARED.size)
  if (/\btext-xs\b/.test(webSm) && /className="text-sm/.test(native))
    open.push('字号:web sm=text-xs vs RN 内部 Text=text-sm')
  return open
}

test('T11 未统一的三格各仍在(某格被统一了就要红一次:同步台账 G-1115908 与活文档的三格清单)', () => {
  const open = openDivergences(
    readHead('packages/ui-native/src/button.tsx'),
    readHead('packages/ui-react/src/components/button.tsx'),
  )
  assert.equal(
    open.length,
    3,
    `三格账少了一格 ⇒ 有人已统一了它(是进展,但账必须同步)。现仍开放:${open.join('; ') || '(无)'}。` +
      ' 收敛一格的正当动作:①结清 PROJECT_PLAN 的 G-1115908 对应条;②改 AGENTS/README 那句「仍未统一的三格」;' +
      '③把本断言的期望值改成剩余格数并在旁边写明是哪格已收 —— 不得为了让本条绿去删开放项。',
  )
})

test('T12 三格账的牙:构造面把 RN 默认档改成 h-9 必须只剩两格,且缺的正是默认档那一格', () => {
  const native = readHead('packages/ui-native/src/button.tsx')
  const react = readHead('packages/ui-react/src/components/button.tsx')
  assert.equal(openDivergences(native, react).length, 3, '控制测量必须先读到 3 格')
  const mutated = native.replace("md: 'h-10 px-4'", "md: 'h-9 px-4'")
  assert.notEqual(mutated, native, '夹具未命中 ⇒ 对照无效(测的是"没跑到"而不是"已统一")')
  const after = openDivergences(mutated, react)
  assert.equal(after.length, 2, `统一默认档后应只剩两格,实得 ${after.join('; ')}`)
  assert.ok(
    !after.some((s) => s.startsWith('默认档高度')),
    '该被摘掉的"默认档高度"仍计为开放 ⇒ 检测式无牙',
  )
  // 反向:动一处与三格无关的字串,不得少格(防检测式靠"文本变短/变样"误报)
  const noise = native.replace('flex-row', 'flex-rows')
  assert.notEqual(noise, native, '噪声夹具未命中 ⇒ 这一臂没测到东西')
  assert.equal(openDivergences(noise, react).length, 3, '无关改写把账改动了 ⇒ 检测式在测文本而不是测尺寸')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
