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

function sharedKeys(text, constName) {
  const at = text.indexOf(`export const ${constName}`)
  if (at < 0) throw new Error(`${constName} 不在面上`)
  const body = matchBraces(text, text.indexOf('{', at))
  return splitEntries(body)
    .filter((e) => e.key)
    .map((e) => e.key)
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
const KEYS = {
  variant: sharedKeys(sharedHead, TABLE_CONST.variant),
  size: sharedKeys(sharedHead, TABLE_CONST.size),
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
  const mutated = readHead('packages/ui-react/src/components/button.tsx').replace(
    /outline: `\$\{SHARED_BUTTON_VARIANT_CLASSES\.outline\}([^`]*)`/,
    "outline: 'border border-input bg-background shadow-sm$1',",
  )
  assert.notEqual(
    mutated,
    readHead('packages/ui-react/src/components/button.tsx'),
    '夹具未命中 ⇒ 对照无效',
  )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
