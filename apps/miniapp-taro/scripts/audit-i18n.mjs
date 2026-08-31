// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * miniapp-taro i18n 审计:统计源码中使用的 key 与翻译 JSON 的缺口
 * 用法: cd G:/IHUI-AI && node apps/miniapp-taro/scripts/audit-i18n.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
const SRC = path.join(ROOT, 'apps', 'miniapp-taro', 'src')
const MSG_DIR = path.join(ROOT, 'packages', 'i18n', 'messages')

function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out.add(key)
  }
  return out
}

function loadLocale(dir, file) {
  return flatten(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')))
}

// 1. 收集源码中使用的 key: tt('k', | t('k' | tList('k'
const files = execSync(`git ls-files "${path.relative(ROOT, SRC).replace(/\\/g, '/')}"`, {
  cwd: ROOT,
  encoding: 'utf-8',
})
  .trim()
  .split('\n')
const used = new Map() // key -> [file:line]
const keyRe = /\b(?:tt|t|tList)\(\s*['"]([^'"]+)['"]/g
for (const rel of files) {
  const abs = path.join(ROOT, rel)
  const lines = fs.readFileSync(abs, 'utf-8').split('\n')
  lines.forEach((line, i) => {
    let m
    keyRe.lastIndex = 0
    while ((m = keyRe.exec(line))) {
      const key = m[1]
      // 排除纯文案兜底参数(第二个字符串参数才是 fallback)
      if (!used.has(key)) used.set(key, [])
      used.get(key).push(`${rel}:${i + 1}`)
    }
  })
}

// 过滤:排除非 i18n 的 t( 调用误匹配(如 split/replace 等不可能——t( 前是词边界)
// 2. 各 locale 缺口
const zhMini = loadLocale(path.join(MSG_DIR, 'miniapp-taro'), 'zh-CN.json')
const zhShared = loadLocale(path.join(MSG_DIR, 'shared'), 'zh-CN.json')
const zhAll = new Set([...zhMini, ...zhShared])

const usedKeys = [...used.keys()]
const missing = usedKeys.filter((k) => !zhAll.has(k))
// 疑似误匹配(不含点且不像 key 的)
const suspicious = missing.filter((k) => !k.includes('.'))

console.log(`== miniapp-taro i18n 审计 ==`)
console.log(`源码文件数: ${files.length}`)
console.log(`使用的 i18n key 总数: ${usedKeys.length}`)
console.log(`zh-CN 词典 key 总数: miniapp ${zhMini.size} + shared ${zhShared.size} = ${zhAll.size}`)
console.log(`缺失 key(使用但词典无): ${missing.length}`)
console.log(`  其中疑似误匹配(无点号): ${suspicious.length}`)
console.log(``)
console.log(`-- 缺失 key 明细(前 60,按使用次数) --`)
const sorted = missing
  .filter((k) => k.includes('.'))
  .sort((a, b) => used.get(b).length - used.get(a).length)
for (const k of sorted.slice(0, 60)) {
  console.log(`  ${k}  (${used.get(k).length} 处, 如 ${used.get(k)[0]})`)
}
console.log('')
// 3. 其他 locale 相对 zh-CN 的缺口
for (const loc of ['en', 'ja', 'ko', 'zh-TW']) {
  const mini = loadLocale(path.join(MSG_DIR, 'miniapp-taro'), `${loc}.json`)
  const shared = loadLocale(path.join(MSG_DIR, 'shared'), `${loc}.json`)
  const all = new Set([...mini, ...shared])
  const lack = [...zhAll].filter((k) => !all.has(k))
  console.log(`${loc}: 相对 zh-CN 缺 ${lack.length} 个 key${lack.length ? ' 例: ' + lack.slice(0, 5).join(', ') : ''}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
