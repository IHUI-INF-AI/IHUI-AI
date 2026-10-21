// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * npm 发布包打包(esbuild 单文件 bundle → npm-dist/ 可直接 npm publish)。
 *
 * 产物 npm-dist/:dist/index.js 单文件(语言包旁随 10 份 messages),
 * package.json 只保留发布所需字段 —— 绝不带 workspace:* 依赖,装完即跑。
 *
 * 与 build-sea.mjs 的差异:本形态依赖宿主 Node 运行时(target node20),
 * 不复制 node 二进制、不做 SEA blob 注入;banner 里同时放 shebang 与
 * import.meta.url 收敛(单文件下全模块 URL 必须落到产物自身路径)。
 *
 * 依赖:esbuild(已入本包 devDependencies;亦可经 IHUI_ESBUILD_DIR 覆盖,版本下限 0.25)。
 *
 * 用法:node scripts/build-npm.mjs
 */

import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url))) // apps/cli
const repoRoot = dirname(dirname(pkgRoot)) // 仓库根
const outDir = join(pkgRoot, 'npm-dist')
const distDir = join(outDir, 'dist')

function resolveTool(name) {
  const envOverride = process.env[`IHUI_${name.toUpperCase()}_DIR`]
  const candidates = [
    ...(envOverride ? [envOverride] : []),
    // 本包 devDependencies(pnpm add -D esbuild,CI 与本地同一来源)优先
    join(pkgRoot, 'node_modules', name),
    join(repoRoot, 'node_modules', name),
    'C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/' + name,
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) {
      // 版本下限:0.25 起 esbuild 对模板字符串 import() 的处理语义稳定,旧版响亮报错但语义漂移
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      const [major, minor] = String(pkg.version ?? '0.0.0').split('.').map(Number)
      if (major === 0 && (minor ?? 0) < 25) {
        console.error(`[build-npm] ${name} 版本过低(${pkg.version}),需 >= 0.25;可用 IHUI_${name.toUpperCase()}_DIR 指定其他安装`)
        process.exit(2)
      }
      return dir
    }
  }
  console.error(`[build-npm] 缺依赖 ${name}:在 ${candidates.join(' ; ')} 均未找到。`)
  console.error('[build-npm] 安装后重试:pnpm --filter ihui-cli add -D esbuild')
  process.exit(2)
}

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts })
}

const esbuildDir = resolveTool('esbuild')
const nodeBin = process.execPath
// 构建期版本注入(读 package.json,单一事实源):npm 包内 package.json 会被 npm 保留,
// 但 define 注入让 --version 不依赖文件探测,与 SEA 形态同一套 util/pkg-version.ts 语义。
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
const buildVersion = String(pkg.version ?? '0.0.0')
const buildMinVersion =
  pkg.engines && typeof pkg.engines.minimumVersion === 'string' ? pkg.engines.minimumVersion : ''

console.log('[build-npm] 1/4 esbuild 打包(CJS 单文件,首行 shebang)')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(distDir, { recursive: true })
const esbuildBin = join(esbuildDir, 'bin', 'esbuild')
// 入口 src/index.ts 自带 shebang 时,esbuild 会把它提升到产物首行;此时 banner 里再放一份
// 就会在第 2 行出现第二个 #!(Node 只认首行,直接 SyntaxError)。故按入口实际情况拼 banner,
// 两种情况下产物首行都保证是 #!/usr/bin/env node。
const entrySource = readFileSync(join(pkgRoot, 'src', 'index.ts'), 'utf8')
const bannerLines = []
if (!entrySource.startsWith('#!')) {
  bannerLines.push('#!/usr/bin/env node')
}
// 全模块 import.meta.url 收敛到产物路径:单文件下各模块的 __dirname/自判定必须指向同一处
bannerLines.push("const import_meta_url = require('url').pathToFileURL(__filename).href;")
// bin/esbuild 形态随平台而异:Windows 下是无扩展名 JS shim(spawnSync 无法直接执行,需 node 拉起);
// Linux/macOS 下被 @esbuild/<platform> postinstall 替换为原生可执行文件(ELF/Mach-O),
// 用 node 拉起原生二进制会报 SyntaxError。按文件头嗅探分派,两条路都稳(同 build-sea.mjs)。
function isNativeBinary(p) {
  const head = readFileSync(p).subarray(0, 4)
  const elf = head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46
  const machO64 = head[0] === 0xcf && head[1] === 0xfa && head[2] === 0xed && head[3] === 0xfe
  const machO32 = head[0] === 0xce && head[1] === 0xfa && head[2] === 0xed && head[3] === 0xfe
  const pe = head[0] === 0x4d && head[1] === 0x5a // MZ
  return elf || machO64 || machO32 || pe
}
const esbuildArgs = [
  join(pkgRoot, 'src', 'index.ts'),
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--target=node20',
  `--outfile=${join(distDir, 'index.js')}`,
  '--legal-comments=none',
  `--banner:js=${bannerLines.join('\n')}`,
  '--define:import.meta.url=import_meta_url',
  '--define:process.env.IHUI_BUNDLED="1"',
  `--define:process.env.IHUI_BUILD_VERSION="${buildVersion}"`,
  `--define:process.env.IHUI_BUILD_MIN_VERSION="${buildMinVersion}"`,
]
if (isNativeBinary(esbuildBin)) {
  run(esbuildBin, esbuildArgs)
} else {
  run(nodeBin, [esbuildBin, ...esbuildArgs])
}
const entryFile = join(distDir, 'index.js')
if (!readFileSync(entryFile, 'utf8').startsWith('#!')) {
  console.error(`[build-npm] 产物首行不是 shebang:${entryFile}`)
  process.exit(2)
}
// npm 的 bin 依赖可执行位;Windows 无 POSIX 权限位,chmod 失败静默忽略
try {
  chmodSync(entryFile, 0o755)
} catch {
  // Windows 上忽略
}

console.log('[build-npm] 2/4 复制语言包(cli/shared × 5 locale,共 10 份)')
const messagesRoot = join(repoRoot, 'packages', 'i18n', 'messages')
const locales = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
const sides = ['cli', 'shared']
const messages = []
const missingMessages = []
for (const side of sides) {
  for (const locale of locales) {
    const src = join(messagesRoot, side, `${locale}.json`)
    if (!existsSync(src)) {
      missingMessages.push(src)
      continue
    }
    messages.push({ side, locale, src })
  }
}
if (missingMessages.length > 0) {
  for (const file of missingMessages) {
    console.error(`[build-npm] 语言包缺失:${file}`)
  }
  process.exit(2)
}
for (const { side, locale, src } of messages) {
  const dstDir = join(distDir, 'messages', side)
  mkdirSync(dstDir, { recursive: true })
  copyFileSync(src, join(dstDir, `${locale}.json`))
}

console.log('[build-npm] 3/4 复制 LICENSE / NOTICE(及 README,若存在)')
for (const name of ['LICENSE', 'NOTICE']) {
  const src = join(repoRoot, name)
  if (!existsSync(src)) {
    console.error(`[build-npm] 仓库根缺少 ${name}:${src}`)
    process.exit(2)
  }
  copyFileSync(src, join(outDir, name))
}
const readme = join(pkgRoot, 'README.md')
if (existsSync(readme)) {
  copyFileSync(readme, join(outDir, 'README.md'))
}

console.log('[build-npm] 4/4 生成发布用 package.json(无 dependencies/scripts/type)')
const published = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  license: pkg.license,
  author: pkg.author,
  homepage: pkg.homepage,
  repository: pkg.repository,
  bugs: pkg.bugs,
  engines: pkg.engines,
  // bin 路径不能以 ./ 开头:npm 会把它判为"invalid script name"静默移除,装完没有 ihui 命令
  bin: { ihui: 'dist/index.js' },
  files: ['dist', 'LICENSE', 'NOTICE', 'README.md'],
  publishConfig: { access: 'public', registry: 'https://registry.npmjs.org/' },
}
// 只写有值的字段,避免 JSON.stringify 把 undefined 静默抹成缺失后又混入空键
const compact = Object.fromEntries(
  Object.entries(published).filter(([, value]) => value !== undefined),
)
writeFileSync(join(outDir, 'package.json'), `${JSON.stringify(compact, null, 2)}\n`, 'utf8')

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(abs))
    } else {
      files.push(abs)
    }
  }
  return files
}

const files = walk(outDir).sort()
let totalBytes = 0
console.log('[build-npm] 产物清单:')
for (const file of files) {
  const size = statSync(file).size
  totalBytes += size
  const kb = (size / 1024).toFixed(1).padStart(9)
  console.log(`  ${kb} KB  ${relative(outDir, file)}`)
}
console.log(
  `[build-npm] 完成:${files.length} 个文件,合计 ${(totalBytes / 1024 / 1024).toFixed(2)} MB(自验:node npm-dist/dist/index.js --version)`,
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
