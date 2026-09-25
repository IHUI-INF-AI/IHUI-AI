// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync, writeFileSync } from 'node:fs'

const ZH = JSON.parse(readFileSync('.ihui-agent/tmp/plan-audit/i18n-d17/i18n-translations.json', 'utf8'))
const LANGS = ['zh-TW', 'en', 'ja', 'ko']
const FILE = (l) => (l === 'zh-CN' ? 'packages/i18n/messages/web/zh-CN.json' : `packages/i18n/messages/web/${l}.json`)

const zh = JSON.parse(readFileSync('.ihui-agent/tmp/plan-audit/i18n-d17/zh-CN.snippet.json', 'utf8'))['zh-CN.merge.json']
const flat = (obj) => Object.entries(obj)
const zhEntries = flat(zh)

const apply = (locale, entries) => {
  const path = FILE(locale)
  const raw = readFileSync(path, 'utf8')
  const obj = JSON.parse(raw)
  const roundtrip = JSON.stringify(obj, null, 2) + (raw.endsWith('\n') ? '\n' : '')
  const fmtMatch = roundtrip === raw
  let added = 0
  let touchedNav = 0
  for (const [k, v] of entries) {
    const parts = k.split('.')
    let cur = obj
    for (const seg of parts.slice(0, -1)) {
      if (typeof cur[seg] !== 'object' || cur[seg] === null) cur[seg] = {}
      cur = cur[seg]
      if (seg === 'nav') touchedNav++
    }
    const leaf = parts.at(-1)
    if (Object.prototype.hasOwnProperty.call(cur, leaf)) {
      console.log(`  跳过已存在键 ${locale}/${k}(不覆盖)`)
      continue
    }
    cur[leaf] = v
    added++
  }
  if (!fmtMatch) {
    console.log(`  ⚠ ${locale}: 文件不是 2 空格 JSON 形态,拒绝整篇重排(避免制造无关 diff)`)
    return { locale, added: 0, skipped: true }
  }
  writeFileSync(path, JSON.stringify(obj, null, 2) + (raw.endsWith('\n') ? '\n' : ''), 'utf8')
  return { locale, added, navWrites: touchedNav }
}

const res = [apply('zh-CN', zhEntries)]
for (const l of LANGS) res.push(apply(l, flat(ZH.translations[l] || {})))
console.log(res.map((r) => `${r.locale}: +${r.added}${r.skipped ? ' (SKIP 格式不符)' : ''}`).join('\n'))

// 对称性校验:五份文件里 ecosystem.* 键集必须完全一致
const sets = {}
for (const l of ['zh-CN', ...LANGS]) {
  const o = JSON.parse(readFileSync(FILE(l), 'utf8'))
  sets[l] = new Set([...Object.keys(o.ecosystem || {}), ...(o.nav && 'ecosystemHub' in o.nav ? ['nav.ecosystemHub'] : [])])
}
const base = sets['zh-CN']
let bad = 0
for (const l of LANGS) {
  const miss = [...base].filter((k) => !sets[l].has(k))
  const extra = [...sets[l]].filter((k) => !base.has(k))
  if (miss.length || extra.length) {
    bad++
    console.log(`✘ ${l} 不对称 缺=${miss.join(',')} 多=${extra.join(',')}`)
  }
}
console.log(`\n五语键集对称性: ${bad === 0 ? '✔ 一致' : `✘ ${bad} 语言不一致`} (zh-CN ${base.size} 键)`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
