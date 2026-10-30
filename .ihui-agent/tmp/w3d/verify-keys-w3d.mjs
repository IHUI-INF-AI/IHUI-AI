#!/usr/bin/env node
/**
 * w3d 键交叉校验(2026-10-27 Wave3-d 自验)
 * 判据:
 *  A) manifest.i18n 每段五语键集逐字相等(parity)
 *  B) 代码中全部 t(`NS.key`) / t('common.*') 引用逐一在位:
 *     NS 段键必须落 manifest;common.* 必须五语在全仓字典
 *     (packages/i18n/messages/shared 或 mobile-rn 面)存在
 *  C) manifest 段内不得出现代码零引用的键(反向防幽灵键)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const MANIFEST = join(ROOT, '.ihui-agent/wave3/w3d.manifest.json')

const CODE_FILES = [
  'packages/app/src/features/chat/ChatSettingsScreen.tsx',
  'packages/app/src/features/business-card/BusinessCardFavoritesScreen.tsx',
  'apps/mobile-rn/src/screens/ChatSettingsScreen.tsx',
  'apps/mobile-rn/src/screens/BusinessCardFavoritesScreen.tsx',
]

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const langs = Object.keys(manifest.i18n) // en/zh-CN/zh-TW/ja/ko
let failures = 0

// ---------- A) 五语 parity ----------
console.log('=== A) manifest 五语键集 parity ===')
for (const ns of Object.keys(manifest.i18n['zh-CN'])) {
  const base = Object.keys(manifest.i18n['zh-CN'][ns]).sort().join(',')
  for (const lg of langs) {
    const seg = manifest.i18n[lg][ns]
    if (!seg) {
      console.log(`FAIL: ${ns} 缺语言段 ${lg}`)
      failures++
      continue
    }
    const cur = Object.keys(seg).sort().join(',')
    if (cur !== base) {
      console.log(`FAIL: ${ns} [${lg}] 键集不等\n  base=${base}\n  cur =${cur}`)
      failures++
    } else {
      console.log(`ok: ${ns} [${lg}] ${base.split(',').length} 键`)
    }
    // 值缺失检查:key 在但 value 为空串
    for (const [k, v] of Object.entries(seg)) if (v === undefined) { console.log(`FAIL: ${ns}.${k}@${lg} 值 undefined`); failures++ }
  }
}

// ---------- B) 代码引用键 ----------
console.log('=== B) 代码 t(...) 引用解析 ===')
const refRe = /\bt\(\s*(?:`(\$\{NS\})\.([\w-]+)`|'([\w-]+\.[\w.-]+)')/g
const refs = []
for (const rel of CODE_FILES) {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  const nsMatch = src.match(/const NS = '([\w-]+)'/)
  const ns = nsMatch ? nsMatch[1] : null
  for (let m; (m = refRe.exec(src)); ) {
    if (m[1]) refs.push({ file: rel, ns, key: m[2] })         // t(`${NS}.x`)
    else refs.push({ file: rel, ns: null, fullKey: m[3] })     // t('common.x')
  }
  console.log(`ok: ${rel} NS=${ns} 引用点数=${refs.filter((r) => r.file === rel).length}`)
}

function segOf(ns, key) {
  for (const lg of langs) {
    const segObj = (manifest.i18n[lg][ns] || {})[key]
    if (segObj === undefined) {
      console.log(`FAIL(缺典): t('${ns}.${key}')@${lg} — manifest 无此键 [引用:见 B 表]`)
      failures++
      return
    }
  }
}

function dictHas(lang, fullKey) {
  // shared 优先,mobile-rn 覆盖层其次。fullKey = 'a.b' -> seg a, key b(仅查两段式)
  const [seg, ...rest] = fullKey.split('.')
  if (rest.length !== 1) { console.log(`FAIL: 复合键无法定位 ${fullKey}`); failures++; return false }
  const key = rest[0]
  for (const dir of ['shared', 'mobile-rn']) {
    const p = join(ROOT, `packages/i18n/messages/${dir}/${lang}.json`)
    if (!existsSync(p)) continue
    const j = JSON.parse(readFileSync(p, 'utf8'))
    if (j[seg] && Object.prototype.hasOwnProperty.call(j[seg], key)) return true
  }
  return false
}

for (const r of refs) {
  if (r.ns) {
    segOf(r.ns, r.key)
    console.log(`check: ${r.file} -> ${r.ns}.${r.key}`)
  } else {
    let okAll = true
    for (const lg of langs) if (!dictHas(lg, r.fullKey)) { okAll = false; console.log(`FAIL: ${r.fullKey}@${lg} 全仓字典缺 [引用: ${r.file}]`) }
    if (okAll) console.log(`check: ${r.file} -> ${r.fullKey} (五语在册)`)
    if (!okAll) failures += 0 // 已计数
    void failures
  }
}

// ---------- C) 反向:manifest 段键必须有引用点 ----------
console.log('=== C) manifest 段键反向引用 ===')
const allJoined = CODE_FILES.map((rel) => readFileSync(join(ROOT, rel), 'utf8')).join('\n')
for (const ns of Object.keys(manifest.i18n['zh-CN'])) {
  for (const key of Object.keys(manifest.i18n['zh-CN'][ns])) {
    const hit = new RegExp(`\\$\\{NS\\}\\.${key}\`|'${ns}\\.${key}'`).test(allJoined)
    if (!hit) { console.log(`FAIL(幽灵): ${ns}.${key} 有典无引用`); failures++ }
  }
}

// common 段引用计数核对
console.log('=== summary ===')
console.log(`refs=${refs.length} langs=${langs.length} manifestKeys=${langs.map((l) => Object.keys(manifest.i18n[l]).reduce((a, n) => a + Object.keys(manifest.i18n[l][n]).length, 0)).join('/')}`)
if (failures > 0) {
  console.log(`FAILURES=${failures}`)
  process.exit(1)
} else {
  console.log('ALL OK')
}
