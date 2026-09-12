// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 离线 i18n 压缩生成脚本:把非中文 4 语言包(shared + miniapp-taro)合并后
// JSON.stringify → gzip(level 9) → base64,生成 src/i18n/generated/remote-locales.gen.ts。
// 运行时经 fflate 解压还原,与源 JSON 无损等价(见 src/i18n/__tests__/i18n-compressed.test.ts)。
// 用法:node scripts/gen-i18n-compressed.mjs  (package.json: pnpm gen:i18n)

import { gzipSync, strToU8 } from 'fflate'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 脚本在 apps/miniapp-taro/scripts/,仓库根在其上 3 级;消息源在 packages/i18n/messages
const repoRoot = resolve(__dirname, '../../..')
const messagesRoot = resolve(repoRoot, 'packages/i18n/messages')
const outDir = resolve(__dirname, '../src/i18n/generated')
const outFile = resolve(outDir, 'remote-locales.gen.ts')

const REMOTE_LOCALES = ['en', 'ja', 'ko', 'zh-TW']

// 与 @ihui/i18n/loader#mergeMessages 语义完全一致:
// 浅拷贝 base,遍历 override 的 key;当双方都是普通对象(非数组)时递归合并,否则 override 覆盖。
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function mergeMessages(base, override) {
  const result = { ...base }
  for (const key of Object.keys(override)) {
    const val = override[key]
    const baseVal = result[key]
    if (isPlainObject(val) && isPlainObject(baseVal)) {
      result[key] = mergeMessages(baseVal, val)
    } else if (val !== undefined) {
      result[key] = val
    }
  }
  return result
}

function loadJson(...parts) {
  const file = resolve(messagesRoot, ...parts)
  return JSON.parse(readFileSync(file, 'utf8'))
}

const REMOTE_LOCALE_B64 = {}
let totalOriginal = 0
let totalB64 = 0

for (const locale of REMOTE_LOCALES) {
  const shared = loadJson('shared', `${locale}.json`)
  const miniapp = loadJson('miniapp-taro', `${locale}.json`)
  const merged = mergeMessages(shared, miniapp)
  const json = JSON.stringify(merged) // 无缩进,与运行时 JSON.parse 对称
  // mtime:0 强制确定性(否则 fflate 默认写入当前时间戳到 gzip 头,跨进程运行产物不一致)
  const gz = gzipSync(strToU8(json), { level: 9, mtime: 0 })
  const b64 = Buffer.from(gz).toString('base64')
  REMOTE_LOCALE_B64[locale] = b64

  const originalKB = json.length / 1024
  const b64KB = b64.length / 1024
  totalOriginal += originalKB
  totalB64 += b64KB
  console.log(
    `[gen:i18n] ${locale}: ${originalKB.toFixed(1)}KB (JSON) → ${b64KB.toFixed(1)}KB (b64, gzip${(gz.length / 1024).toFixed(1)}KB)`,
  )
}

console.log(
  `[gen:i18n] 合计: 原始 ${totalOriginal.toFixed(1)}KB → b64 ${totalB64.toFixed(1)}KB (净省 ${(totalOriginal - totalB64).toFixed(1)}KB)`,
)

const lines = [
  '// GENERATED FILE — DO NOT EDIT. 由 scripts/gen-i18n-compressed.mjs 生成(pnpm gen:i18n)',
  '// 非中文语言包离线 gzip+base64 内联,运行时经 fflate 解压,数据与源 JSON 无损等价(见 __tests__/i18n-compressed.test.ts)',
  "export type RemoteLocale = 'en' | 'ja' | 'ko' | 'zh-TW'",
  'export const REMOTE_LOCALE_B64: Record<RemoteLocale, string> = {',
]
for (const locale of REMOTE_LOCALES) {
  // base64 单行字符串(很长没关系,该目录已加入 prettier/eslint 忽略)
  lines.push(`  ${locale === 'zh-TW' ? "'zh-TW'" : locale}: '${REMOTE_LOCALE_B64[locale]}',`)
}
lines.push('}')
lines.push('')

mkdirSync(outDir, { recursive: true })
writeFileSync(outFile, lines.join('\n'), 'utf8')

// 溯源水印:生成产物同样是 git 跟踪文件,受 `scripts/check-watermark-coverage.mjs` 门禁约束。
// 此前生成器不写横幅 → 该文件长期缺失水印,使 pre-commit 与 CI 的 watermark 门禁必红。
// 统一改为复用仓库水印工具(单一事实源),幂等:重复生成不产生 diff。
const watermarkScript = resolve(repoRoot, 'scripts/watermark.mjs')
try {
  execFileSync(process.execPath, [watermarkScript, 'inject', outFile], { stdio: 'inherit' })
} catch (e) {
  console.error(
    `[gen:i18n] ❌ 溯源水印注入失败,产物将导致 check-watermark-coverage 红: ${e.message || e}`,
  )
  process.exit(1)
}

console.log(`[gen:i18n] 已写入 ${outFile} (${readFileSync(outFile).length} 字节, 含溯源水印)`)
