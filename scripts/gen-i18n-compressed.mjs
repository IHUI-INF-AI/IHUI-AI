// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 离线 i18n 压缩生成脚本:把非中文 4 语言包(shared + miniapp-taro)合并后
// JSON.stringify → gzip(level 9) → base64,生成 src/i18n/generated/remote-locales.gen.ts。
// 运行时经 fflate 解压还原,与源 JSON 无损等价(见 src/i18n/__tests__/i18n-compressed.test.ts)。
// 用法:node scripts/gen-i18n-compressed.mjs  (package.json: pnpm gen:i18n)
//
// 2026-10-06 主包余量治理(按需拉取改造):同一份 base64 载荷现在产出**三个消费面**,
// 全部由本生成器从同一批输入派生(单源多产物,与 record_back.png"单一源→两份产物"同规矩):
//   ① src/i18n/generated/remote-locales.gen.ts —— 离线对账真相(gzip+b64 内联),运行时
//      **不再 import 它**(否则 440KB 重新进 common.js);check-i18n-messages-exist /
//      check-tool-display-resolvable / check-word-table-resolvable / G5 钉门等守门脚本
//      仍从磁盘读它对账,格式一字不变。
//   ② src/assets/remote-locales/<locale>.b64.txt —— CDN 部署载荷(与 ① 逐字节相同),
//      由运维把该目录拷进 cdn-server.js 的 server-root(与 src/assets/remote-images/ 同一
//      部署通道),运行时经 aizhsUrl('remote-locales/<locale>.b64.txt?v=<version>') 按需拉取
//      (?v= 只做缓存击穿;cdn-server.js 用 URL(...).pathname 取文件,query 不参与路径解析)。
//      .txt 不在水印分母(watermark.mjs EXT_MAP 只映射源码扩展),载荷保持无横幅字节精确。
//   ③ src/i18n/generated/remote-locale-manifest.gen.ts —— 运行时轻量清单(version=载荷
//      sha256,bytes=载荷字节数),进主包(约 0.5KB):version 作 storage 缓存 key 与失效
//      判据,bytes 作下载完整性粗校验。真完整校验靠"b64 字符集 + gunzip + JSON.parse"
//      结构性校验(解码失败一律回落,不进缓存)。

import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// 正解 = 把本生成器搬到根 scripts/(与 sync-miniapp-tokens.mjs 同一条先例;D2 只比 rank,
// 所以只改说明符照样红),前置 = 等两台机的分叉裁决定后再搬,避免刚搬完就被并回旧路径。
// 在这之前这条边**不能撤**:守门 105 的镜像 T14 断言"门与生成器都必须引那份唯一实现",
// 撤掉即变成两处各算一遍哈希 —— 正是本仓记过两次的漂移成因。
import { renderPin, sha256Hex } from './lib/generated-input-pin.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 脚本在根 scripts/,仓库根在其上 1 级;消息源在 packages/i18n/messages
const repoRoot = resolve(__dirname, '..')
// fflate 从端内依赖面取:pnpm isolated node_modules(shamefully-hoist=false)下,根 scripts/
// 解析不到端内依赖 —— 用 createRequire 钉在 @ihui/miniapp-taro 的依赖面上,与运行时同一份包。
const { gzipSync, strToU8 } = createRequire(
  resolve(repoRoot, 'apps/miniapp-taro/package.json'),
)('fflate')
const messagesRoot = resolve(repoRoot, 'packages/i18n/messages')
const outDir = resolve(repoRoot, 'apps/miniapp-taro/src/i18n/generated')
const outFile = resolve(outDir, 'remote-locales.gen.ts')
const manifestFile = resolve(outDir, 'remote-locale-manifest.gen.ts')
// CDN 部署载荷目录:与 src/assets/remote-images/ 同一镜像约定 —— 目录名即 CDN URL 路径段,
// 运维把它整体拷进 cdn-server.js 的 server-root 后,载荷即出现在 /remote-locales/<locale>.b64.txt。
const cdnPayloadDir = resolve(repoRoot, 'apps/miniapp-taro/src/assets/remote-locales')
const GENERATOR_REL = 'apps/miniapp-taro/scripts/gen-i18n-compressed.mjs'

const REMOTE_LOCALES = ['en', 'ja', 'ko', 'zh-TW']

// 自述钉(G-680):产物必须能自己说清"我是从哪些输入、哪个提交算出来的"。
// 为什么不全靠 --check / 靠 mtime:本仓实录过两次「产物存在但内容是旧的」——
// 一次是离线语言包只有 release 才发现过期,一次是改 src 后产物只动时间戳(生成器读了 dist)。
// 判"真的按当前输入重生成过"的唯一办法,是让哈希落在产物里,由守门 105 现算现比。
//
// 幂等性(AGENTS §5c 同一条规矩)的两个设计点:
//   ① 哈希只吃**输入字节**,不吃时刻、不吃 HEAD —— 所以"重跑两次产物逐字节相同"在屏蔽时刻行之后成立;
//   ② 时刻行 generatedAt 留在钉里给人看,但既**不参与陈旧判据**也**不参与逐字节比对**
//      (出口 = lib 的 maskGeneratedAt())。留它的理由:"这产物什么时候生成的"与
//      "这产物是不是按当前输入生成的"是两个问题,后者才是判据,前者只是台账。
//   ③ 字节归一(剥 BOM + CRLF→LF)只在 lib 里有一份实现,生成器与门共用 —— 否则 Windows
//      检出带 CRLF 的磁盘算出的哈希,会和门在 HEAD blob(LF)上算出的永不相等,门恒红。

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

/** 读一份消息源:同时把它按「仓库根相对路径 + 原始文本」记进钉的输入清单 */
const pinInputs = []
function loadJson(...parts) {
  const file = resolve(messagesRoot, ...parts)
  const text = readFileSync(file, 'utf8')
  pinInputs.push({ rel: `packages/i18n/messages/${parts.join('/')}`, text })
  return JSON.parse(text)
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

// 运行时清单:version = 载荷 sha256(storage 缓存 key 与失效判据),bytes = 载荷字节数
// (下载完整性粗校验)。哈希一律经 lib/generated-input-pin.mjs 的 sha256Hex(唯一实现,
// 与守门 105 的自述钉同值),只在生成期算,运行时只做字符串比较,不带依赖进主包。
const REMOTE_LOCALE_MANIFEST = {}
for (const locale of REMOTE_LOCALES) {
  REMOTE_LOCALE_MANIFEST[locale] = {
    version: sha256Hex(REMOTE_LOCALE_B64[locale]),
    bytes: REMOTE_LOCALE_B64[locale].length,
  }
}

// 源版本钉里的出处行:HEAD 的 sha。取不到一律写 unknown —— 它只是给人看的台账,
// 不参与陈旧判据(判据只认 inputsSha256),所以「git 此刻不可用」绝不允许变成生成失败。
function readSourceCommit() {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', '-C', repoRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      windowsHide: true, // §5b:派生控制台程序必须带,否则弹可见窗口
      timeout: 15000, // 守门 80:钩子/守护链可达的 git 只读调用必须有界
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .trim()
      .split('\n')[0]
  } catch {
    return 'unknown'
  }
}

// 自述钉两份产物共用同一份(同批输入 + 同一时刻行 ⇒ 幂等性对两份产物同时成立)
const pinLines = renderPin({
  generator: GENERATOR_REL,
  sourceCommit: readSourceCommit(),
  inputs: pinInputs,
  generatedAt: new Date().toISOString(),
})

const lines = [
  '// GENERATED FILE — DO NOT EDIT. 由 scripts/gen-i18n-compressed.mjs 生成(pnpm gen:i18n)',
  '// 非中文语言包离线 gzip+base64 内联,运行时经 fflate 解压,数据与源 JSON 无损等价(见 __tests__/i18n-compressed.test.ts)',
  // 自述钉:紧贴上面两行说明之后、在任何数据行之前 —— 解析器按行取,位置不影响内容,
  // 但放在文件头才会在 `head` / PR diff 里第一眼可见(本票的动机正是"没人愿意去猜产物新不新")。
  // 2026-10-06 起运行时不再 import 本文件(载荷改 CDN 按需拉取);它仍是守门对账与 CDN 载荷的唯一真相。
  ...pinLines,
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

// 产物③:运行时轻量清单(进主包,约 0.5KB)。与 ① 同钉,保证"缓存 key/字节校验的判据"
// 与"离线真相"出自同一批输入 —— 两份产物任何一份单独重生成都会被 G5 钉门点名为陈旧。
const manifestLines = [
  '// GENERATED FILE — DO NOT EDIT. 由 scripts/gen-i18n-compressed.mjs 生成(pnpm gen:i18n)',
  '// 按需拉取语言包的运行时清单:version = 载荷 gzip+b64 的 sha256(storage 缓存 key 与失效判据),',
  '// bytes = 载荷字节数(下载完整性粗校验)。载荷真相在 generated/remote-locales.gen.ts(离线对账)',
  '// 与 src/assets/remote-locales/<locale>.b64.txt(CDN 部署),三者同批派生、同钉对账。',
  ...pinLines,
  "export type RemoteLocale = 'en' | 'ja' | 'ko' | 'zh-TW'",
  'export const REMOTE_LOCALE_MANIFEST: Record<RemoteLocale, { version: string; bytes: number }> = {',
]
for (const locale of REMOTE_LOCALES) {
  const { version, bytes } = REMOTE_LOCALE_MANIFEST[locale]
  manifestLines.push(
    `  ${locale === 'zh-TW' ? "'zh-TW'" : locale}: { version: '${version}', bytes: ${bytes} },`,
  )
}
manifestLines.push('}')
manifestLines.push('')
writeFileSync(manifestFile, manifestLines.join('\n'), 'utf8')

// 产物②:CDN 部署载荷(与 ① 的 b64 逐字节相同,无换行尾巴 —— 运行时按清单 bytes 粗校验)。
// 部署动作属运维既有通道:把本目录拷进 cdn-server.js 的 server-root(与 remote-images 同法)。
mkdirSync(cdnPayloadDir, { recursive: true })
for (const locale of REMOTE_LOCALES) {
  writeFileSync(resolve(cdnPayloadDir, `${locale}.b64.txt`), REMOTE_LOCALE_B64[locale], 'utf8')
}

// 溯源水印:生成产物同样是 git 跟踪文件,受 `scripts/check-watermark-coverage.mjs` 门禁约束。
// 此前生成器不写横幅 → 该文件长期缺失水印,使 pre-commit 与 CI 的 watermark 门禁必红。
// 统一改为复用仓库水印工具(单一事实源),幂等:重复生成不产生 diff。
// (两份 .ts 产物都要注入;.b64.txt 载荷不在水印分母,保持字节精确。)
const watermarkScript = resolve(repoRoot, 'scripts/watermark.mjs')
for (const generatedFile of [outFile, manifestFile]) {
  try {
    execFileSync(process.execPath, [watermarkScript, 'inject', generatedFile], {
      stdio: 'inherit',
      windowsHide: true, // 防 Windows 弹可见控制台窗口
    })
  } catch (e) {
    console.error(
      `[gen:i18n] ❌ 溯源水印注入失败(${generatedFile}),产物将导致 check-watermark-coverage 红: ${e.message || e}`,
    )
    process.exit(1)
  }
}

console.log(`[gen:i18n] 已写入 ${outFile} (${readFileSync(outFile).length} 字节, 含溯源水印)`)
console.log(`[gen:i18n] 已写入 ${manifestFile} (${readFileSync(manifestFile).length} 字节, 含溯源水印)`)
console.log(
  `[gen:i18n] 已写入 CDN 载荷 ${cdnPayloadDir}/{${REMOTE_LOCALES.join(',')}}.b64.txt (部署: 整目录拷入 cdn-server.js 的 server-root)`,
)
