// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n 占位符一致性判据(单一真相源,2026-11-23 立)
 *
 * 立因:next-intl 在**值里有 {var} 却拿不到参数**时不抛错、不回落默认文案,
 * 而是把整条键路径(NavItem.nav.hrGroup 这种)原样画到界面上 —— 与"缺键"同一个
 * 用户可见症状,但成因不同、旧门(keys / parity / data-keys)全都在射程外。
 *
 * 本库提供三段纯判据(无 IO 副作用,门本体与自检共用):
 *   ① placeholdersOf(value)      — 一条 ICU 文案需要调用方传哪些参数
 *   ② extractCalls(src)          — 源码里的翻译调用:t('k' / t('k',{...}) / t.raw / t.rich
 *   ③ judgeCalls(calls, messages) — 每处调用的实参是否覆盖该键在那套语言里的必需参数
 */

import fs from 'node:fs'
import path from 'node:path'

/** web 端 app + src;其他端由门显式追加,未覆盖即报"未覆盖"而不是静默放绿 */
export const DEFAULT_ROOTS = ['apps/web/app', 'apps/web/src']
export const ALL_ROOTS = [
  ...DEFAULT_ROOTS,
  'apps/mobile-rn/src',
  'apps/mobile-rn/app',
  'apps/miniapp-taro/src',
  'packages/app/src',
  'packages/ui-react/src',
]
export const LOCALES = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko']

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', 'coverage', 'out'])

export function walkSources(roots, out = []) {
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    const stack = [root]
    while (stack.length) {
      const dir = stack.pop()
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) {
          if (!SKIP_DIRS.has(e.name)) stack.push(p)
        } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p)
      }
    }
  }
  return out
}

/** 点号展开取叶子串 */
export function getByPath(obj, dotted) {
  return dotted.split('.').reduce((a, b) => (a && typeof a === 'object' ? a[b] : undefined), obj)
}

const ICU_TYPE_KEYWORDS = new Set(['plural', 'select', 'selectordinal', 'number', 'date', 'time'])

/**
 * 一条 ICU 文案需要的参数名。
 * `{name}`、`{name, plural, ...}` 都算参数;`{count, plural, one{# 条} other{# 条}}`
 * 只取 count;分支里的 `#` 与类型关键字不是参数。
 */
export function placeholdersOf(value) {
  const out = new Set()
  for (const m of value.matchAll(/\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=[,}])/g)) {
    if (!ICU_TYPE_KEYWORDS.has(m[1])) out.add(m[1])
  }
  return [...out]
}

/** 文件里 `const x = useTranslations('ns')` / `getTranslations('ns')` 的词根表 */
export function translationStems(src) {
  const stems = []
  const re =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(['"`])([^'"`]*)\2/g
  for (const m of src.matchAll(re)) stems.push({ name: m[1], namespace: m[3] })
  return stems
}

function stripComments(s) {
  return s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

/** 剥注释但保留行结构:注释字符换空格、换行原样留 —— 行号仍以原文为准 */
function blankComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
}

/** 从调用处截取第一层参数对象;不是对象字面量返回 null */
function argObjectAt(src, from) {
  let i = from
  while (i < src.length && /\s/.test(src[i])) i += 1
  if (src[i] === ',') {
    i += 1
    while (i < src.length && /\s/.test(src[i])) i += 1
  }
  if (src[i] !== '{') return null
  let depth = 0
  const start = i
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  return null
}

/** 参数对象第一层提供的键名(支持 `k: v` 与简写 `k`);含展开时 spread=true */
export function providedKeys(objText) {
  const body = stripComments(objText.slice(1, -1))
  const pieces = []
  let depth = 0
  let buf = ''
  for (const ch of body) {
    if ('{(['.includes(ch)) depth += 1
    if ('})]'.includes(ch)) depth -= 1
    if (ch === ',' && depth === 0) {
      pieces.push(buf)
      buf = ''
    } else buf += ch
  }
  if (buf.trim()) pieces.push(buf)
  const spread = pieces.some((p) => /^\s*\.\.\./.test(p))
  const keys = pieces
    .map((p) => {
      const kv = p.match(/^\s*([A-Za-z_$][\w$]*)\s*:/)
      if (kv) return kv[1]
      const bare = p.match(/^\s*([A-Za-z_$][\w$]*)\s*$/)
      return bare ? bare[1] : null
    })
    .filter(Boolean)
  return { keys, spread }
}

/**
 * 抽取一个源码文件里的全部翻译调用(与语言无关,只解析一次)。
 * kind:
 *   none      无第二参(最可能的裸键)
 *   object    对象字面量参数(可静态判齐备性)
 *   dynamic   第二参是变量/调用,静态不可判定
 *   spread    对象里有 ...展开,静态不可判定
 * method='raw' 的调用不参与判据(raw 不插值,花括号是留给下游 fillTemplate 的模板)
 */
export function extractCalls(srcIn) {
  // 注释里的示例调用不是调用(否则说明文本会被当成违规)
  const src = blankComments(srcIn)
  const stems = translationStems(src)
  if (!stems.length) return []
  const names = stems.map((s) => s.name.replace(/[$]/g, '\\$&')).join('|')
  const re = new RegExp(
    `\\b(${names})((?:\\.(?:raw|rich|markup|has))?)\\(\\s*(['"])([^'"]+)\\3`,
    'g',
  )
  const calls = []
  for (const m of src.matchAll(re)) {
    const stem = stems.find((s) => s.name === m[1])
    if (!stem) continue
    const method = (m[2] || '').replace('.', '')
    if (method === 'has') continue
    const after = src.slice(m.index + m[0].length)
    const objText = argObjectAt(after, 0)
    const line = src.slice(0, m.index).split('\n').length
    const base = { key: `${stem.namespace}.${m[4]}`, ns: stem.namespace, method, line }
    if (!objText) {
      const tail = after.replace(/^\s+/, '')
      const none = tail.startsWith(')') || tail.startsWith('}')
      calls.push({ ...base, kind: none ? 'none' : 'dynamic', keys: [] })
    } else {
      const { keys, spread } = providedKeys(objText)
      calls.push({ ...base, kind: spread ? 'spread' : 'object', keys })
    }
  }
  return calls
}

/**
 * 逐调用判定:该键在该语言文案里需要哪些参数、调用给了哪些。
 * @returns findings 数组(kind: 'none' | 'partial' | 'spread' | 'dynamic' | 'icu-unstable')
 */
export function judgeCalls(calls, messages) {
  const out = []
  for (const c of calls) {
    if (c.method === 'raw') continue
    const value = getByPath(messages, c.key)
    // 缺键不归本门(keys / data-keys 门负责),这里只判"键在、参数不齐"
    if (typeof value !== 'string') continue
    const required = placeholdersOf(value)
    if (!required.length) continue
    if (c.kind === 'dynamic' || c.kind === 'spread') {
      out.push({ ...c, required, missing: [], kind: c.kind })
      continue
    }
    const missing = required.filter((r) => !c.keys.includes(r))
    if (missing.length)
      out.push({ ...c, required, missing, kind: c.kind === 'none' ? 'none' : 'partial' })
  }
  return out
}

export function scanSource(src, messages) {
  return judgeCalls(extractCalls(src), messages)
}

/**
 * 模板拼接键(`t(\`ns.${x}.k\`)`):候选域只有运行时才知道,静态**无法**判可达性。
 * 门对这一型不做"判对错",只做**棘轮**:数量/形态登记在基线,新增一处即红 ——
 * 新增一律改数据表字面量键(`{ titleKey: 'ns.k' }` + `t(item.titleKey)`),落进 data-keys 门射程。
 */
export function extractTemplateCalls(srcIn) {
  // 注释里写"消除 `t(`status.${var}`)` 动态拼接"的说明文本不是调用,否则门会抓自己人
  const src = blankComments(srcIn)
  const stems = translationStems(src)
  if (!stems.length) return []
  const names = stems.map((s) => s.name.replace(/[$]/g, '\\$&')).join('|')
  const re = new RegExp(
    `\\b(${names})(?:\\.(?:raw|rich|markup|has))?\\(\\s*\`([^\`]*\\$\\{[^\`]*)\``,
    'g',
  )
  const out = []
  for (const m of src.matchAll(re)) {
    const stem = stems.find((s) => s.name === m[1])
    if (!stem) continue
    out.push({ ns: stem.namespace, template: m[2], line: src.slice(0, m.index).split('\n').length })
  }
  return out
}

export function scanAll(roots = ALL_ROOTS, messages) {
  const files = walkSources(roots)
  const findings = []
  for (const f of files) {
    if (/__tests__/.test(f) || /\.test\.[tj]sx?$/.test(f)) continue
    findings.push(
      ...scanSource(fs.readFileSync(f, 'utf8'), messages).map((x) => ({ ...x, file: f })),
    )
  }
  return { files: files.length, findings }
}

export function mergeMessages(base, over) {
  const out = { ...base }
  for (const k of Object.keys(over)) {
    const v = over[k]
    const b = out[k]
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      b &&
      typeof b === 'object' &&
      !Array.isArray(b)
    )
      out[k] = mergeMessages(b, v)
    else if (v !== undefined) out[k] = v
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
