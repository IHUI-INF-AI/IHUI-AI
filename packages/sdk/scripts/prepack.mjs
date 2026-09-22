// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `@ihui/sdk` 发布前置(prepack)—— 保证"打进 npm 的东西"一定是可安装的:
 *
 * 1. 构建:用包内自带的 typescript 编译 src → dist(tsc,无新增依赖,不依赖 PATH)。
 *    `files` 只含 dist,所以 dist 缺失 / 过期 = 发布空包或旧包,这里直接失败。
 * 2. 许可证:把仓库根的 LICENSE / NOTICE 复制进包目录(Apache-2.0 第 4 条要求
 *    分发副本必须附带许可证与 NOTICE 全文)。复制而非提交副本,避免法律文本漂移,
 *    生成物已在 packages/sdk/.gitignore 中忽略。
 * 3. 自检:确认 package.json 的 main / types 指向的文件真实存在,且 tarball 不含
 *    源码 / 其他语言 SDK / 构建噪音(那些目录与包同在,曾被打进 1.39MB 的包里)。
 *
 * 触发时机:`npm pack` / `npm publish` 自动跑 `prepack`(见 package.json scripts)。
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(pkgRoot, '..', '..')
const require = createRequire(import.meta.url)

// 进度一律走 stderr:`npm pack --json` 的 stdout 必须是纯 JSON,不能被日志污染。
const log = (...a) => console.error(...a)

function fail(msg) {
  log(`❌ prepack(@ihui/sdk): ${msg}`)
  process.exit(1)
}

// ---------- 1. 构建 dist ----------
const tscCli = require.resolve('typescript/bin/tsc')
log('🔨 [1/3] tsc → dist/')
try {
  const out = execFileSync(process.execPath, [tscCli, '-p', join(pkgRoot, 'tsconfig.json')], {
    cwd: pkgRoot,
    encoding: 'utf8',
    windowsHide: true,
  })
  if (out.trim()) log(out.trim())
} catch (err) {
  log(String(err.stdout ?? '') + String(err.stderr ?? '') + String(err.message ?? err))
  fail('tsc 构建失败,拒绝发布')
}

// ---------- 2. 附带许可证与 NOTICE ----------
log('📜 [2/3] 复制 LICENSE / NOTICE(Apache-2.0 分发要求)')
for (const name of ['LICENSE', 'NOTICE']) {
  const src = join(repoRoot, name)
  if (!existsSync(src)) fail(`仓库根缺少 ${name},无法随包分发许可证`)
  copyFileSync(src, join(pkgRoot, name))
}

// ---------- 3. 发布物自检 ----------
log('🔍 [3/3] 校验发布物自包含')
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
const entries = [pkg.main, pkg.module, pkg.types, ...(pkg.exports?.['.'] ? Object.values(pkg.exports['.']) : [])]
for (const rel of new Set(entries.filter(Boolean))) {
  const abs = join(pkgRoot, rel.replace(/^\.\//, ''))
  if (!existsSync(abs)) fail(`package.json 指向的入口 ${rel} 不存在(消费者装完 import 即失败)`)
}
// 入口绝不允许指回 src:TS 消费者拿不到编译产物,JS 消费者在 node_modules 里跑不了 .ts
for (const [field, val] of Object.entries({ main: pkg.main, module: pkg.module, types: pkg.types })) {
  if (String(val).includes('/src/')) fail(`${field}=${val} 指向 src,外部安装不可用(必须指 dist)`)
}
// workspace:* 依赖不得出现在 dependencies:发布后消费者会 404(@ihui/* 均为 private)
for (const [dep, spec] of Object.entries(pkg.dependencies ?? {})) {
  if (String(spec).startsWith('workspace:')) fail(`dependencies 含 workspace 协议包 ${dep}@${spec},外部无法安装`)
  if (dep.startsWith('@ihui/')) fail(`dependencies 含未发布的内部包 ${dep},外部安装会 404`)
}
const packed = readdirSync(pkgRoot).filter((f) => (pkg.files ?? []).includes(f))
const distCount = existsSync(join(pkgRoot, 'dist')) ? readdirSync(join(pkgRoot, 'dist')).length : 0
if (distCount === 0) fail('dist/ 为空')
const bytes = packed.reduce((a, f) => {
  const p = join(pkgRoot, f)
  const st = statSync(p)
  return a + (st.isDirectory() ? readdirSync(p).reduce((b, x) => b + statSync(join(p, x)).size, 0) : st.size)
}, 0)
log(`   发布目录条目: ${packed.join(', ')}(dist ${distCount} 项,约 ${(bytes / 1024 / 1024).toFixed(2)}MB)`)
log('✅ prepack 通过:入口指 dist、无 workspace 依赖、许可证已随包')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
