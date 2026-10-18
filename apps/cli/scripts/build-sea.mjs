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
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url))) // apps/cli
const repoRoot = dirname(dirname(pkgRoot)) // 仓库根
const outDir = join(pkgRoot, 'dist-sea')

function resolveTool(name) {
  const envOverride = process.env[`IHUI_${name.toUpperCase()}_DIR`]
  const candidates = [
    ...(envOverride ? [envOverride] : []),
    join(repoRoot, 'node_modules', name),
    'C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/' + name,
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) {
      // 版本下限:0.25 起 esbuild 对模板字符串 import() 的处理语义稳定,旧版响亮报错但语义漂移
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      const [major, minor] = String(pkg.version ?? '0.0.0').split('.').map(Number)
      if (major === 0 && (minor ?? 0) < 25) {
        console.error(`[build-sea] ${name} 版本过低(${pkg.version}),需 >= 0.25;可用 IHUI_${name.toUpperCase()}_DIR 指定其他安装`)
        process.exit(2)
      }
      return dir
    }
  }
  console.error(`[build-sea] 缺依赖 ${name}:在 ${candidates.join(' ; ')} 均未找到。`)
  console.error('[build-sea] 安装后重试:node install esbuild postject(隔离工作区)或 pnpm add -D esbuild postject')
  process.exit(2)
}

const esbuildDir = resolveTool('esbuild')
const postjectDir = resolveTool('postject')
const nodeBin = process.execPath

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts })
}

console.log('[build-sea] 1/5 esbuild 打包(CJS 单文件)')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
// 构建期版本注入(读 package.json,单一事实源):SEA 分发形态 exe 旁可能没有/误邻 package.json,
// 版本闸门与 UA 都必须拿真实版本,不能落 0.0.0 哨兵(见 util/pkg-version.ts)
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
const buildVersion = String(pkg.version ?? '0.0.0')
const buildMinVersion =
  pkg.engines && typeof pkg.engines.minimumVersion === 'string' ? pkg.engines.minimumVersion : ''
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
  `--define:process.env.IHUI_BUILD_VERSION="${buildVersion}"`,
  `--define:process.env.IHUI_BUILD_MIN_VERSION="${buildMinVersion}"`,
])
// SEA 主脚本不接受 shebang 首行
{
  const { readFileSync, writeFileSync: w } = await import('node:fs')
  const raw = readFileSync(join(outDir, 'ihui.bundle.cjs'), 'utf8')
  if (raw.startsWith('#!')) w(join(outDir, 'ihui.bundle.cjs'), raw.slice(raw.indexOf('\n') + 1), 'utf8')
}

console.log('[build-sea] 2/5 随 exe 携带 package.json(版本 + engines.minimumVersion 来源)')
copyFileSync(join(pkgRoot, 'package.json'), join(outDir, 'package.json'))

console.log('[build-sea] 3/5 生成 SEA blob(语言包 10 份以内嵌 assets 随包携带)')
const messagesRoot = join(repoRoot, 'packages', 'i18n', 'messages')
const seaConfig = {
  main: 'ihui.bundle.cjs',
  output: 'sea-prep.blob',
  disableExperimentalSEAWarning: true,
  useCodeCache: true,
  assets: {},
}
for (const locale of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']) {
  for (const side of ['cli', 'shared']) {
    const file = join(messagesRoot, side, `${locale}.json`)
    if (!existsSync(file)) {
      console.error(`[build-sea] 语言包缺失:${file} —— SEA 形态 i18n 全靠 assets,缺一不可`)
      process.exit(2)
    }
    seaConfig.assets[`${side}-${locale}.json`] = file
  }
}
writeFileSync(join(outDir, 'sea-config.json'), JSON.stringify(seaConfig, null, 2))
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
