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

// 1) packages/app/src/index.ts — 追加导出(去重)
let idx = fs.readFileSync(INDEX_TS, 'utf8')
for (const { m } of manifests) {
  for (const line of m.indexExports || []) {
    if (!idx.includes(line)) idx = idx.trimEnd() + '\n' + line + '\n'
  }
}
fs.writeFileSync(INDEX_TS, idx)

// 1b) packages/api-client/src/index.ts — barrel 导出(teams/tags/support 票的 apiClientIndexExports)
const AC_INDEX = path.join(ROOT, 'packages/api-client/src/index.ts')
let ac = fs.readFileSync(AC_INDEX, 'utf8')
for (const { m } of manifests) {
  const barrel = m.apiClientBarrel ? (typeof m.apiClientBarrel === 'string' ? m.apiClientBarrel : m.apiClientBarrel.line) : null
  for (const line of [...(m.apiClientIndexExports || []), ...(barrel ? [barrel] : [])]) {
    if (!ac.includes(line)) ac = ac.trimEnd() + '\n' + line + '\n'
  }
}
fs.writeFileSync(AC_INDEX, ac)

// 2) RootNavigator — 三个锚点后插入(锚=Status 行)
let nav = fs.readFileSync(NAV, 'utf8')
const anchors = {
  import: "import { StatusScreen } from '../screens/StatusScreen'",
  param: '  Status: undefined',
  screen: '<RootStack.Screen name="Status" component={StatusScreen} />',
}
for (const key of ['import', 'param', 'screen']) {
  const a = anchors[key]
  if (!nav.includes(a)) { console.error(`anchor missing: ${key}`); process.exit(2) }
  const lines = manifests.flatMap(({ m }) => m.navigator?.[key] ? (Array.isArray(m.navigator[key]) ? m.navigator[key] : [m.navigator[key]]) : [])
  const dedup = [...new Set(lines)].filter((l) => !nav.includes(l))
  if (dedup.length) nav = nav.replace(a, a + '\n' + dedup.join('\n'))
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
