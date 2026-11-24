#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-mobile-tabbar-icon-data.mjs — 生成底栏图标的内联 data URI 模块(常驻工具,不在提交链)
 *
 * 立因(全是现读,不是推测):
 *  - 真机 release 包上 `<Image source={require('本地 PNG')}>` 恒渲染为空白(布局仍占位),
 *    同屏 react-native-svg 图标全部正常 —— 该结论由 `packages/types/src/app-account.ts`
 *    记录的 8a7926ead7 同格对照实验钉死;登录页的飞书图标即因此在 2026-09-29 改走 SVG。
 *  - 底栏 TabBar 的 5×2 张 tabbar_*.png 是最后一族仍走该通道的图:实测真机与模拟器
 *    (release 与 debug 两包)都不上屏,像素带 0 个彩色像素,Fresco 停在 EmptyDrawable。
 *  - 这族是位图插画(带浅紫渐变),没有等价 SVG 源,不能走登录页那条「改 SVG」的路。
 *    ⇒ 内联为 data URI:绕开本地资源取源链,图一字不改。
 *
 * 用法:
 *   node scripts/gen-mobile-tabbar-icon-data.mjs            # 生成/更新产物(写盘)
 *   node scripts/gen-mobile-tabbar-icon-data.mjs --check    # 只读比对(0 一致 / 1 漂移 / 2 未判定)
 * 退出码:0 一致或写盘成功;1 --check 判漂移;2 未判定(产物/源图取不到,不折 0 报绿)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR_REL = join('apps', 'mobile-rn', 'assets', 'images', 'tabbar')
const OUT_REL = join('apps', 'mobile-rn', 'src', 'components', 'tabbarIconData.ts')
const SRC_DIR = join(ROOT, SRC_DIR_REL)
const OUT = join(ROOT, OUT_REL)
const SIZE = 72
const PNG_PREFIX = 'data:image/png;base64,'
const MANIFEST_LINE = ' * 源图 sha256(由生成器写入,--check 据此判源图是否变化):'
const PAYLOAD_MANIFEST_LINE = ' * 产物 payload sha256(对 base64 字符串本体算,防手改;不解码):'
const USAGE = '用法:node scripts/gen-mobile-tabbar-icon-data.mjs [--check [--root <dir>]]'
const PNG_IEND_TAIL = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])

const ICONS = [
  ['AI_SHOP_INACTIVE', 'tabbar_1.png'],
  ['AI_SHOP_ACTIVE', 'tabbar_1_act.png'],
  ['PLAZA_INACTIVE', 'tabbar_2.png'],
  ['PLAZA_ACTIVE', 'tabbar_2_act.png'],
  ['HOME_INACTIVE', 'tabbar_3.png'],
  ['HOME_ACTIVE', 'tabbar_3_act.png'],
  ['NEWS_INACTIVE', 'tabbar_4.png'],
  ['NEWS_ACTIVE', 'tabbar_4_act.png'],
  ['MINE_INACTIVE', 'tabbar_5.png'],
  ['MINE_ACTIVE', 'tabbar_5_act.png'],
]

/** 源图字节指纹(只读字节,不解码;--check 用它判源图是否换过)。 */
function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

/** 产物排版(写盘与 --check 的唯一模板,两侧不得各写一份,否则必然漂移)。 */
function renderModule(entries, sourceHashes, payloadHashes) {
  // 产物形态按仓库 prettier 档位预先折行(长字符串字面量会被 prettier 拆成「键名独占一行 +
  // 缩进 4 空格的字符串」),否则 lint-staged 一跑 --fix 就与生成器互相打架。
  const lines = entries.map(([k, v]) => `  ${k}:\n    '${v}',`).join('\n')
  const manifest = sourceHashes.map(([file, hash]) => ` *   ${file}=${hash}`).join('\n')
  const payloadManifest = payloadHashes.map(([key, hash]) => ` *   ${key}=${hash}`).join('\n')
  return `// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * 底栏图标内联数据(由 scripts/gen-mobile-tabbar-icon-data.mjs 生成,勿手改)。
 *
 * 为什么不 require 本地 PNG:真机 release 包上 \`<Image source={require(本地 PNG)}>\` 恒空白
 * (钉死见 packages/types/src/app-account.ts 的 8a7926ead7 对照实验)。这族是位图插画、
 * 无等价 SVG 源,故内联为 data URI 绕开该取源链,图一字未改。
 * 尺寸取 72px(展示 24dp,覆盖 3x 屏足够)。
 *
${MANIFEST_LINE}
${manifest}
 *
${PAYLOAD_MANIFEST_LINE}
${payloadManifest}
 */
export const TABBAR_ICON_DATA = {
${lines}
} as const
`
}

async function build() {
  // 只有写盘才需要解码:延迟加载 sharp,让 --check 在无 node_modules 的树里也能跑(不解码、不联网)。
  const sharp = (await import('sharp')).default
  const entries = []
  const sourceHashes = []
  const payloadHashes = []
  for (const [key, file] of ICONS) {
    const buf = readFileSync(join(SRC_DIR, file))
    sourceHashes.push([file, sha256(buf)])
    const out = await sharp(buf)
      .resize({ width: SIZE, height: SIZE, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer()
    const b64 = out.toString('base64')
    entries.push([key, `${PNG_PREFIX}${b64}`])
    // 对值里 base64 字符串本体算,任意字符改动都改哈希;不涉及像素解码。
    payloadHashes.push([key, sha256(Buffer.from(b64, 'utf8'))])
  }
  return renderModule(entries, sourceHashes, payloadHashes)
}

/** 产物 → 键值表 + 源图清单;形态认不出返回 null(调用方按「未判定」exit 2,不猜绿)。 */
function parseModule(text) {
  const head = 'export const TABBAR_ICON_DATA = {'
  const start = text.indexOf(head)
  const end = text.indexOf('\n} as const', start)
  if (start < 0 || end < 0) return null
  const body = text.slice(start + head.length, end)
  const entries = []
  for (const m of body.matchAll(/^  ([A-Za-z_][A-Za-z0-9_]*):\n    '([^']*)',$/gm)) {
    entries.push([m[1], m[2]])
  }
  // 表体必须严格由「键名独占一行 + 缩进 4 空格字符串」构成,否则说明有手改/排版漂移,判未判定。
  const rebuilt = `\n${entries.map(([k, v]) => `  ${k}:\n    '${v}',`).join('\n')}`
  if (rebuilt !== body) return null

  const si = text.indexOf(MANIFEST_LINE)
  const pi = text.indexOf(PAYLOAD_MANIFEST_LINE)
  const pend = text.indexOf('\n */', pi)
  if (si < 0 || pi < 0 || pend < 0) return null
  const parseHashes = (block) => {
    const out = []
    for (const m of block.matchAll(/^ \*   (\S+)=([0-9a-f]{64})$/gm)) out.push([m[1], m[2]])
    return out
  }
  const sources = parseHashes(text.slice(si + MANIFEST_LINE.length, pi))
  const payloads = parseHashes(text.slice(pi + PAYLOAD_MANIFEST_LINE.length, pend))
  if (!sources.length || !payloads.length) return null
  return { entries, sources, payloads }
}

/** 读 PNG IHDR 宽高(只读头部,不解像素)。 */
function pngDims(buf) {
  if (buf.length < 24) return null
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

/**
 * 只读比对:现表(含源图/产物 payload sha256 清单)vs 现读源图、现算 payload 与 ICONS 真源。
 * rc 0 一致 / 1 漂移(打印差异)/ 2 未判定(产物或源图取不到)。
 * 不解码(像素内容需 sharp 解码,只读档不做)、不联网、不读环境变量。
 */
function checkTable(root = ROOT) {
  const outAbs = join(root, OUT_REL)
  const srcDir = join(root, SRC_DIR_REL)
  let text
  try {
    text = readFileSync(outAbs, 'utf8')
  } catch (e) {
    return { code: 2, lines: [`未判定:产物读不到 ${OUT_REL}(${e?.code ?? e?.message ?? e})`] }
  }
  const parsed = parseModule(text)
  if (!parsed) return { code: 2, lines: [`未判定:产物形态认不出(缺导出表或哈希清单)${OUT_REL}`] }

  const diffs = []

  // ① 源图清单 vs 现读源文件(只算哈希,不解码)
  for (const [, file] of ICONS) {
    let hash
    try {
      hash = sha256(readFileSync(join(srcDir, file)))
    } catch (e) {
      return { code: 2, lines: [`未判定:输入面取不到 ${SRC_DIR_REL}/${file}(${e?.code ?? e?.message ?? e})`] }
    }
    const recorded = parsed.sources.find(([f]) => f === file)?.[1]
    if (!recorded) diffs.push(`${file}:产物源图清单缺此行(源图新增?重跑生成器)`)
    else if (recorded !== hash) diffs.push(`${file}:源图 sha256=${hash},产物清单=${recorded}(源图已变,产物过期)`)
  }
  for (const [file] of parsed.sources) {
    if (!ICONS.some(([, f]) => f === file)) diffs.push(`${file}:产物清单多出未登记源图`)
  }

  // ② 键序列(顺序也是生成语义:data URI 与源图按 ICONS 一一对应)
  const wantKeys = ICONS.map(([key]) => key)
  const gotKeys = parsed.entries.map(([key]) => key)
  const missing = wantKeys.filter((k) => !gotKeys.includes(k))
  const extra = gotKeys.filter((k) => !wantKeys.includes(k))
  if (missing.length) diffs.push(`产物缺键:${missing.join(', ')}`)
  if (extra.length) diffs.push(`产物多键:${extra.join(', ')}`)
  if (!missing.length && !extra.length && gotKeys.join(',') !== wantKeys.join(',')) {
    diffs.push('键顺序与 ICONS 真源不一致(需重跑生成器)')
  }

  // ③ 值面:data URI 形态 + PNG 尺寸(像素内容不在只读档射程)
  for (const [key, value] of parsed.entries) {
    if (!value.startsWith(PNG_PREFIX)) {
      diffs.push(`${key}:值不是 ${PNG_PREFIX} 数据 URI`)
      continue
    }
    const b64 = value.slice(PNG_PREFIX.length)
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
      diffs.push(`${key}:base64 段非法`)
      continue
    }
    const buf = Buffer.from(b64, 'base64')
    const dims = pngDims(buf)
    if (!dims || !buf.subarray(-8).equals(PNG_IEND_TAIL)) {
      diffs.push(`${key}:数据 URI 不是完整的 PNG`)
      continue
    }
    if (dims.width !== SIZE || dims.height !== SIZE) {
      diffs.push(`${key}:PNG 尺寸 ${dims.width}×${dims.height} ≠ ${SIZE}×${SIZE}`)
    }
  }

  // ④ 产物 payload 哈希清单 vs 现算哈希:手改 base64 哪怕仍是合法 PNG 也判红;
  //    清单只作被验对象,现算值才是真值,改清单本身同样判红(不允许清单自证)。
  for (const [key, value] of parsed.entries) {
    if (!value.startsWith(PNG_PREFIX)) continue
    const b64 = value.slice(PNG_PREFIX.length)
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) continue
    const recorded = parsed.payloads.find(([k]) => k === key)?.[1]
    const actual = sha256(Buffer.from(b64, 'utf8'))
    if (!recorded) diffs.push(`${key}:产物 payload 清单缺此行`)
    else if (recorded !== actual) diffs.push(`${key}:payload sha256=${actual},清单=${recorded}(表体被手改或清单被动过)`)
  }
  for (const [key] of parsed.payloads) {
    if (!parsed.entries.some(([k]) => k === key)) diffs.push(`${key}:payload 清单多出未登记键`)
  }

  if (diffs.length) {
    return {
      code: 1,
      lines: [`❌ 产物与数据源不一致:${OUT_REL}`, ...diffs.map((d) => `  · ${d}`), '  修法:node scripts/gen-mobile-tabbar-icon-data.mjs'],
    }
  }
  return { code: 0, lines: [`✅ 产物与数据源一致:${OUT_REL}`] }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--check')) {
    const i = argv.indexOf('--root')
    const root = i >= 0 ? argv[i + 1] : ROOT
    if (i >= 0 && (!root || root.startsWith('--'))) throw new Error(`--root 需要目录参数\n${USAGE}`)
    const r = checkTable(root)
    ;(r.code === 0 ? console.log : console.error)(r.lines.join('\n'))
    process.exitCode = r.code
    return
  }
  if (argv.length) throw new Error(`未知参数:${argv.join(' ')}\n${USAGE}`)
  const text = await build()
  writeFileSync(OUT, text)
  console.log(`✅ 已生成 ${OUT}(${Math.round(text.length / 1024)} KB)`)
  // §5c:生成器 writeFileSync 后必须紧随水印注入
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'watermark.mjs'), 'inject', OUT], {
    stdio: 'inherit',
    windowsHide: true,
  })
  if (r.status !== 0) throw new Error(`watermark inject 失败(exit ${r.status})`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
