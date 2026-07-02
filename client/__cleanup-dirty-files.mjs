// Cleanup dirty i18n filename files (2026-07-02)
// Usage: node __cleanup-dirty-files.mjs
import { rmSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const targets = [
  'g:\\IHUI-AI\\client\\src\\locales\\modules\\zh-TW\\wechat首頁.json',
  'g:\\IHUI-AI\\client\\src\\locales\\modules\\ja\\wechatホーム.json',
  'g:\\IHUI-AI\\client\\src\\locales\\modules\\ko\\wechat홈.json',
  'g:\\IHUI-AI\\client\\src\\locales\\modules\\ko\\핵심 장점.json',
]

let deleted = 0
let failed = 0
for (const t of targets) {
  const p = resolve(t)
  if (!existsSync(p)) {
    console.log(`[skip] not found: ${p}`)
    continue
  }
  try {
    rmSync(p, { force: true })
    console.log(`[ok] deleted: ${p}`)
    deleted++
  } catch (e) {
    console.error(`[fail] ${p}: ${e.message}`)
    failed++
  }
}
console.log(`\nSummary: deleted=${deleted}, failed=${failed}`)
process.exit(failed > 0 ? 1 : 0)
