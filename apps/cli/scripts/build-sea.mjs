// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SEA 单文件二进制打包(esbuild bundle → Node SEA blob → postject 注入)。
 *
 * 产物 dist-sea/ihui.exe:无需 Node 运行时的单文件 CLI(exe 旁可随带 package.json,
 * 供版本/engines.minimumVersion 读取;缺省回退 0.0.0 哨兵,版本闸门按 UNKNOWN 放行)。
 *
 * 依赖:esbuild + postject(不在本包 devDependencies,按序探测 pnpm workspace 根、
 * WorkBuddy 隔离工作区;都没有时按提示安装后再跑)。
 *
 * 用法:node scripts/build-sea.mjs
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url))) // apps/cli
const repoRoot = dirname(dirname(pkgRoot)) // 仓库根
const outDir = join(pkgRoot, 'dist-sea')

function resolveTool(name) {
  const candidates = [
    join(repoRoot, 'node_modules', name),
    'C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/' + name,
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  console.error(`[build-sea] 缺依赖 ${name}:在 ${candidates.join(' ; ')} 均未找到。`)
  console.error('[build-sea] 安装后重试:node install esbuild postject(隔离工作区)或 pnpm add -D esbuild postject')
  process.exit(2)
}

const esbuildDir = resolveTool('esbuild')
const postjectDir = resolveTool('postject')
const require = createRequire(import.meta.url)
const nodeBin = process.execPath

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts })
}

console.log('[build-sea] 1/5 esbuild 打包(CJS 单文件)')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
const esbuildBin = join(esbuildDir, 'bin', 'esbuild')
// bin/esbuild 是无扩展名 JS shim,Windows spawnSync 无法直接执行,恒经 node 拉起
run(nodeBin, [
  esbuildBin,
  join(pkgRoot, 'src', 'index.ts'),
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--target=node22',
  `--outfile=${join(outDir, 'ihui.bundle.cjs')}`,
  '--legal-comments=none',
  // bundle 内全模块 import.meta.url 收敛到 exe 路径:入口用 banner 供其比对 argv[1],
  // 次级入口的主模块判定由 IHUI_BUNDLED=1 关闸(见 util/main-module.ts)。
  "--banner:js=const import_meta_url = require('url').pathToFileURL(__filename).href;",
  '--define:import.meta.url=import_meta_url',
  '--define:process.env.IHUI_BUNDLED="1"',
])
// SEA 主脚本不接受 shebang 首行
{
  const { readFileSync, writeFileSync: w } = await import('node:fs')
  const raw = readFileSync(join(outDir, 'ihui.bundle.cjs'), 'utf8')
  if (raw.startsWith('#!')) w(join(outDir, 'ihui.bundle.cjs'), raw.slice(raw.indexOf('\n') + 1), 'utf8')
}

console.log('[build-sea] 2/5 随 exe 携带 package.json(版本 + engines.minimumVersion 来源)')
copyFileSync(join(pkgRoot, 'package.json'), join(outDir, 'package.json'))

console.log('[build-sea] 3/5 生成 SEA blob')
writeFileSync(
  join(outDir, 'sea-config.json'),
  JSON.stringify(
    { main: 'ihui.bundle.cjs', output: 'sea-prep.blob', disableExperimentalSEAWarning: true, useCodeCache: true },
    null,
    2,
  ),
)
run(nodeBin, ['--experimental-sea-config', 'sea-config.json'], { cwd: outDir })

console.log('[build-sea] 4/5 复制 node.exe 为 ihui.exe')
copyFileSync(nodeBin, join(outDir, 'ihui.exe'))

console.log('[build-sea] 5/5 postject 注入')
run(nodeBin, [
  join(postjectDir, 'dist', 'cli.js'),
  join(outDir, 'ihui.exe'),
  'NODE_SEA_BLOB',
  join(outDir, 'sea-prep.blob'),
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
])

console.log(`[build-sea] 完成:${join(outDir, 'ihui.exe')}(自验:ihui.exe --version)`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
