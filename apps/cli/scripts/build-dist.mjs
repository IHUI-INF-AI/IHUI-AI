// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * dist 直跑形态构建:esbuild bundle -> apps/cli/dist/index.js(ESM 单文件)。
 *
 * 立因(2026-10-25):`tsc -p tsconfig.build.json` 只转译、不改写模块说明符,产物里的
 * `@ihui/shared` 裸导入由 Node 按 packages/shared/package.json 的 exports 解析到
 * `src/*.ts` 源码;而该源码内部使用无扩展名/目录形态的相对导入(`./auth`、
 * `./constants/storage-keys`),Node ESM 不允许目录导入与省略扩展名 ⇒
 * `node dist/index.js` 在第一条 shared 导入处即 ERR_UNSUPPORTED_DIR_IMPORT。
 * 修复面限定在 apps/cli:发布形态(build-npm / build-sea)本来就走 esbuild bundle,
 * 本脚本让"本地 dist 直跑"与发布形态同一解析口径,而不是去改 shared 的导出面。
 *
 * 三条不可省略的构建口径:
 *   1. 必须注入 IHUI_BUNDLED=1 —— bundle 后全部模块的 import.meta.url 收敛到
 *      dist/index.js,次级入口(argument-validation-report / min-version-probe)的
 *      isDirectRunMain 会误判"正在被直接执行"并在加载期抢跑 main/process.exit
 *      (见 src/util/main-module.ts 头注)。代价:dist 形态下 worker-pool 会显式拒绝
 *      并行子代理(可读报错,不静默),开发形态(tsx)与发布形态口径不变。
 *   2. ESM 输出必须带 createRequire banner:CJS 依赖(dotenv/commander 等)的动态
 *      require 需要真 require,否则 esbuild 的 __require 垫片抛
 *      "Dynamic require of ... is not supported"。
 *   3. 版本号从 package.json 现读注入,与 build-npm.mjs 同源(src/util/pkg-version.ts
 *      语义),不落 0.0.0 哨兵。
 *
 * dist 下其余 tsc 产物保留(.d.ts / worker-entry 等);入口 bundle 内的动态 import
 * 已由 esbuild 内联(实测 5 处本地动态 import 全部内联,无残留)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
const buildVersion = String(pkg.version ?? '0.0.0')
const buildMinVersion = pkg.engines?.minimumVersion ?? ''

try {
  await build({
    entryPoints: [join(pkgRoot, 'src', 'index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: join(pkgRoot, 'dist', 'index.js'),
    legalComments: 'none',
    sourcemap: 'external',
    banner: {
      js: 'import { createRequire as __ihuiCreateRequire } from "node:module"; const require = __ihuiCreateRequire(import.meta.url);',
    },
    define: {
      'process.env.IHUI_BUNDLED': '"1"',
      'process.env.IHUI_BUILD_VERSION': JSON.stringify(buildVersion),
      'process.env.IHUI_BUILD_MIN_VERSION': JSON.stringify(buildMinVersion),
    },
    logLevel: 'warning',
  })
} catch (error) {
  console.error(`[build-dist] esbuild 失败:${error?.message ?? error}`)
  process.exit(2)
}

const entry = join(pkgRoot, 'dist', 'index.js')
if (!readFileSync(entry, 'utf8').startsWith('#!')) {
  console.error(`[build-dist] 产物首行不是 shebang:${entry}`)
  process.exit(2)
}
console.log(`[build-dist] 完成:${entry}(版本 ${buildVersion})`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
