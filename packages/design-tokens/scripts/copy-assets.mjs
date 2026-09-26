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
// 退出码:0 = 全部复制并回读校验通过 / 1 = 源缺失、目标缺失或字节不等(不静默跳过,
// 理由见头注)/ 2 = 脚本自身跑不起来(读不到 src 等,不是"判据通过")。
//
// 为什么导出一整套可注入入口:`runCli` 的两条判据(缺源 / 字节不等)若只能靠"真把仓库里
// 某个文件删掉"来取证,就永远不会被取证 —— 回归锁 `tests/copy-assets.test.mjs` 因此要求
// 根目录与复制动作可注入。**生产路径不得传 opts**,默认值就是本包真实布局。

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

/**
 * styles/ 整目录跟着走:新增一份 CSS 不需要改这里(漏登记正是"造好没装车"那一型)。
 * 目录取不到**刻意不当作"零份 CSS"** —— 那会把"看不见"洗成"确信没有";让它抛出去,
 * CLI 那层按退出码 2(无法判定)收,而不是 0。
 */
export function stylesFiles(srcDir = SRC_DIR) {
  const dir = join(srcDir, 'styles')
  return readdirSync(dir)
    .filter((name) => name.endsWith('.css'))
    .sort()
    .map((name) => `styles/${name}`)
}

/** 本次要进 dist 的完整清单:固定项 + styles 下自动发现的 CSS。 */
export function planAssets(srcDir = SRC_DIR) {
  return [...FIXED_FILES, ...stylesFiles(srcDir)]
}

/**
 * 复制单个资源并回读校验字节。
 *
 * `copy` 是**测试注入点**,生产路径永远用默认值。它存在的唯一理由是让"复制后字节不等"与
 * "复制后目标缺失"两条判据可被取证:否则那两条退出码 1 的分支只在散文里成立,
 * 而一条从没被命中的判据不配叫防护(与 §22c"镜像测试只复读实现就是复读机"同型)。
 *
 * 校验为什么必须回读而不是信任 `copyFileSync`:这些文件里有 CSS 与手写 .d.ts,任何转码 /
 * 换行改写都会让"按路径读 src 的守门"与"按 exports 读 dist 的消费方"分叉。
 */
export function copyOne(rel, { srcDir = SRC_DIR, distDir = DIST_DIR, copy = copyFileSync } = {}) {
  const from = join(srcDir, rel)
  const to = join(distDir, rel)
  if (!existsSync(from)) {
    console.error(`❌ 源缺失:${rel}(dist 需要它,不得静默跳过)`)
    return false
  }
  mkdirSync(dirname(to), { recursive: true })
  copy(from, to)
  if (!existsSync(to)) {
    console.error(`❌ 复制后目标缺失:${rel}(复制动作没落地,不能算成功)`)
    return false
  }
  if (readFileSync(from).compare(readFileSync(to)) !== 0) {
    console.error(`❌ 复制后字节不等:${rel}`)
    return false
  }
  return true
}

/** 跑完整清单,返回计划文件与失败项(不改退出码,便于上层与测试各自判)。 */
export function runCopy({ srcDir = SRC_DIR, distDir = DIST_DIR, copy } = {}) {
  const files = planAssets(srcDir)
  const failed = files.filter((rel) => !copyOne(rel, { srcDir, distDir, copy }))
  return { files, failed }
}

/** CLI 主体:把"有没有失败项"映射成退出码。抽成导出函数,使退出码本身可被测。 */
export function runCli(opts = {}) {
  const { files, failed } = runCopy(opts)
  if (failed.length > 0) {
    console.error(`❌ 资源复制失败 ${failed.length} 项:${failed.join(', ')}`)
    return 1
  }
  console.log(`✅ 已原字节复制 ${files.length} 项非 TS 资源进 dist: ${files.join(', ')}`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exitCode = runCli()
  } catch (error) {
    // 1 = 判据失败,2 = 连判据都没跑起来 —— 两者不得混成一个码,否则"跑不动"会被读成"没过"。
    console.error(`❌ 复制器自身异常:${error?.message ?? error}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  PKG_ROOT,
  SRC_DIR,
  DIST_DIR,
  FIXED_FILES,
  stylesFiles,
  planAssets,
  copyOne,
  runCopy,
  runCli,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
