// 集成方专用:把 wave1 manifest 落进共享文件(幂等,可重跑)
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const WAVE = path.join(ROOT, '.ihui-agent', process.argv[2] || 'wave1')
const INDEX_TS = path.join(ROOT, 'packages/app/src/index.ts')
const NAV = path.join(ROOT, 'apps/mobile-rn/src/navigation/RootNavigator.tsx')
const I18N = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'].map((l) => [l, path.join(ROOT, `packages/i18n/messages/mobile-rn/${l}.json`)])
const LEDGER = path.join(ROOT, 'scripts/data/web-rn-screen-map.jsonl')

const manifests = fs
  .readdirSync(WAVE)
  .filter((f) => f.endsWith('.manifest.json'))
  .map((f) => ({ file: f, m: JSON.parse(fs.readFileSync(path.join(WAVE, f), 'utf8')) }))
if (manifests.length === 0) { console.log('no manifests'); process.exit(0) }

// 去重必须比"归一化文本"而不是原文:lint-staged/prettier 会把长 export type {...} 折成多行,
// 按单行原文 includes() 会判"不存在"⇒ 合并后重放时追加出第二份(实测 TS2300 Duplicate identifier)。
// 折行形态还在 } 前留了尾逗号(`Props, } from`),所以归一必须连尾逗号一起吃掉,否则仍判不出等值。
const normAll = (t) =>
  t
    .replace(/\s+/g, ' ')
    .replace(/,\s*(?=[}\])])/g, '')
    .replace(/\s*([{}[\],()])\s*/g, '$1')
    .trim()
function hasStatement(text, line) {
  return normAll(text).includes(normAll(line))
}

// 1) packages/app/src/index.ts — 追加导出(去重,必须插在末行水印之前)
function appendLines(text, lines) {
  const arr = text.split('\n')
  let lastMark = -1
  for (let i = 0; i < arr.length; i++) if (arr[i].includes('\u2060')) lastMark = i
  if (lastMark > 0) {
    arr.splice(lastMark, 0, ...lines)
    return arr.join('\n')
  }
  return text.trimEnd() + '\n' + lines.join('\n') + '\n'
}

let idx = fs.readFileSync(INDEX_TS, 'utf8')
for (const { m } of manifests) {
  const add = (m.indexExports || []).filter((line) => !hasStatement(idx, line))
  if (add.length) idx = appendLines(idx, add)
}
fs.writeFileSync(INDEX_TS, idx)

// 1b) packages/api-client/src/index.ts — barrel 导出(teams/tags/support 票的 apiClientIndexExports)
const AC_INDEX = path.join(ROOT, 'packages/api-client/src/index.ts')
let ac = fs.readFileSync(AC_INDEX, 'utf8')
const acAdd = []
for (const { m } of manifests) {
  const barrel = m.apiClientBarrel ? (typeof m.apiClientBarrel === 'string' ? m.apiClientBarrel : m.apiClientBarrel.line) : null
  for (const line of [...(m.apiClientIndexExports || []), ...(barrel ? [barrel] : [])]) {
    if (!ac.includes(line) && !acAdd.includes(line)) acAdd.push(line)
  }
}if (acAdd.length) ac = appendLines(ac, acAdd)
fs.writeFileSync(AC_INDEX, ac)

// 2) RootNavigator — 三个锚点后插入(锚=Status 行)
// navigator 两种形态都要吃:对象形 {import:[],param:[],screen:[]} 与数组形 [{import,param,screen}]
function navigatorTriplets(m) {
  const n = m.navigator
  if (!n) return []
  const list = (x) => (Array.isArray(x) ? x : x ? [x] : [])
  if (Array.isArray(n)) return n.map((t) => ({ import: t.import, param: t.param, screen: t.screen })).filter((t) => t.import || t.param || t.screen)
  const len = Math.max(list(n.import).length, list(n.param).length, list(n.screen).length)
  return Array.from({ length: len }, (_, i) => ({ import: list(n.import)[i], param: list(n.param)[i], screen: list(n.screen)[i] }))
}

let nav = fs.readFileSync(NAV, 'utf8')
const anchors = {
  import: "import { StatusScreen } from '../screens/StatusScreen'",
  param: '  Status: undefined',
  screen: '<RootStack.Screen name="Status" component={StatusScreen} />',
}
const triplets = manifests.flatMap(({ m }) => navigatorTriplets(m))
// 席位交的 screen 行一律无前导缩进(实测 wave1/wave2/wave3 都这样),直接插进 JSX 树会变成
// 顶格行 —— 功能不断但 prettier/观感都脏。这里按 RootStack.Screen 实际所在列(12 空格)补齐。
// 去重必须按 trim 后的文本比:整行比对会让"已注册但缩进不同"的路由被再插一遍。
const indentScreen = (l) => (/^[ \t]+</.test(l) ? l : ' '.repeat(12) + l)
const have = new Set(nav.split('\n').map((l) => l.trim()))
for (const key of ['import', 'param', 'screen']) {
  const a = anchors[key]
  if (!nav.includes(a)) { console.error(`anchor missing: ${key}`); process.exit(2) }
  const raw = triplets.map((t) => t[key]).filter(Boolean)
  const lines = key === 'screen' ? raw.map(indentScreen) : raw
  const dedup = [...new Set(lines)].filter((l) => !have.has(l.trim()))
  if (dedup.length) {
    nav = nav.replace(a, a + '\n' + dedup.join('\n'))
    dedup.forEach((l) => have.add(l.trim()))
  }
}
fs.writeFileSync(NAV, nav)

// 3) i18n — 命名空间深合并
for (const [lang, file] of I18N) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const { m } of manifests) {
    const ns = m.i18n?.[lang]
    if (!ns) continue
    for (const [k, v] of Object.entries(ns)) j[k] = { ...(j[k] || {}), ...v }
  }
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n')
}

// 4) 台账 — 按 web 键整行替换(gap→aligned),无则追加
const rows = fs.readFileSync(LEDGER, 'utf8').split('\n')
const byWeb = new Map()
for (const { m } of manifests) for (const r of m.ledger || []) byWeb.set(r.web, r)
let replaced = 0, appended = 0
for (let i = 0; i < rows.length; i++) {
  const t = rows[i].trim()
  if (!t) continue
  let o
  try { o = JSON.parse(t) } catch { continue }
  if (byWeb.has(o.web)) {
    const nr = byWeb.get(o.web)
    if (o.status === 'gap') { rows[i] = JSON.stringify(nr); replaced++; byWeb.delete(o.web) }
    else { console.error(`NOT gap, skip: ${o.web} (${o.status})`); byWeb.delete(o.web) }
  }
}
const leftover = [...byWeb.keys()]
if (leftover.length) {
  const tail = rows.filter((l) => l.trim()).concat(leftover.map((k) => JSON.stringify(byWeb.get(k))))
  rows.length = 0
  rows.push(...tail, '')
  appended = leftover.length
}
fs.writeFileSync(LEDGER, rows.join('\n'))
console.log(`manifests=${manifests.length} index+ exports=${(idx.match(/\nexport/g) || []).length} ledger replaced=${replaced} appended=${appended}`)
