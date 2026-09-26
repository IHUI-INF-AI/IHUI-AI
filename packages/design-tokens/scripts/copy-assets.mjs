// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 构建资源复制器(把 tsc 不编译的非 .ts 资源**原字节**复制进 dist)。
//
// 为什么需要这一步:`packages/design-tokens/src/` 里除 .ts 外还有四份被按路径消费的 JS
// (radius.js / geometry.js / tailwind-preset.js / tailwind-alpha-plugin.js)、两份手写
// 类型声明(radius.d.ts / geometry.d.ts)、以及 styles/ 下的 CSS。tsc 的 include 只有
// `src/**/*.ts`,所以纯 tsc 构建产出的 dist/index.js 里 `from './radius.js'` 会落空,
// dist/index.d.ts 也解析不到 RadiusStep —— 包"编译成功"却装起来就坏。
//
// 为什么是复制而**不是搬源**:`scripts/lib/design-token-blocks.mjs` + sync-*.mjs +
// 守门 36/77/93/124/128 共 60+ 处按 `packages/design-tokens/src/...` 字面路径读取这些
// 文件(见 `git grep -l "design-tokens/src/"`)。src 是唯一真相源,路径一动整片瞎;
// dist 里的副本只服务 npm 消费方,由 prepack 每次重建 ⇒ 派生态,不得手改。
//
// 退出码:0 = 全部复制并回读校验通过 / 1 = 源缺失或字节不等(不静默跳过,理由见头注)。

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(PKG_ROOT, 'src')
const DIST_DIR = join(PKG_ROOT, 'dist')

// tsc 不产出、但 exports / dist/index.* 需要的固定清单。
const FIXED_FILES = [
  'radius.js',
  'radius.d.ts',
  'geometry.js',
  'geometry.d.ts',
  'tailwind-preset.js',
  'tailwind-alpha-plugin.js',
]

/** styles/ 整目录跟着走:新增一份 CSS 不需要改这里(漏登记正是"造好没装车"那一型)。 */
function stylesFiles() {
  const dir = join(SRC_DIR, 'styles')
  return readdirSync(dir)
    .filter((name) => name.endsWith('.css'))
    .map((name) => `styles/${name}`)
}

function copyOne(rel) {
  const from = join(SRC_DIR, rel)
  const to = join(DIST_DIR, rel)
  if (!existsSync(from)) {
    console.error(`❌ 源缺失:${rel}(dist 需要它,不得静默跳过)`)
    return false
  }
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  // 原字节校验:这一步同时防"复制器自己悄悄做了转码/换行改写"——
  // 这些文件里有 CSS 与手写 .d.ts,任何重排都会让按路径读 src 的守门与按 exports 读 dist 的消费方分叉。
  if (readFileSync(from).compare(readFileSync(to)) !== 0) {
    console.error(`❌ 复制后字节不等:${rel}`)
    return false
  }
  return true
}

function main() {
  const files = [...FIXED_FILES, ...stylesFiles()]
  const failed = files.filter((rel) => !copyOne(rel))
  if (failed.length > 0) {
    console.error(`❌ 资源复制失败 ${failed.length} 项:${failed.join(', ')}`)
    process.exit(1)
  }
  console.log(`✅ 已原字节复制 ${files.length} 项非 TS 资源进 dist: ${files.join(', ')}`)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
