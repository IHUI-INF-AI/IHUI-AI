// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把 `@ihui/types` 的 V1 契约声明内联进 `dist/`,让发布出去的类型声明自包含。
 *
 * 为什么必须做:SDK 的公开签名大量引用 `V1*` 类型,而 `@ihui/types` 是 `private: true`
 * 的 workspace 包(不在 npm 上)。tsc 产出的 `dist/*.d.ts` 里会原样留下
 * `from '@ihui/types'` —— 消费者只要 `skipLibCheck: false`,就会收到一片 TS2307。
 * `scripts/check-pkg-installable.mjs` 只核运行时依赖与产物结构,看不见类型面这一维。
 *
 * 做法:取 `@ihui/types` 中两份**自包含**(没有任何 import)的声明文件,
 * 拼成 `dist/ihui-types.d.ts`,再把 `dist/*.d.ts` 里的 `@ihui/types` 说明符
 * 改写为相对路径 `./ihui-types.js`(TS 会解析到同目录的 `.d.ts`)。
 * 不复制整个 types 包(那会把无关声明一起塞进 SDK),也不改任何公开签名。
 *
 * 触发:`package.json` 的 `build` / `scripts/prepack.mjs`(tsc 之后)。
 * 零副作用:只写 `dist/`(git 忽略)。
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(pkgRoot, 'dist')
const require = createRequire(import.meta.url)

function fail(msg) {
  console.error(`❌ embed-types(@ihui-ai/sdk): ${msg}`)
  process.exit(1)
}

if (!existsSync(distDir)) fail('dist/ 不存在 —— 必须先跑 tsc')

/** @returns {string} @ihui/types 的 dist 目录 */
function typesDistDir() {
  try {
    return join(dirname(require.resolve('@ihui/types/package.json')), 'dist')
  } catch (err) {
    fail(`无法解析 @ihui/types(devDependency 未安装?):${String(err?.message ?? err)}`)
  }
}

const typesDist = typesDistDir()
// 这两份声明覆盖 SDK 引用的全部 113 个 V1 类型,且自身没有任何 import。
const SOURCES = ['v1-endpoints.d.ts', 'api-key.d.ts']
const chunks = []
for (const name of SOURCES) {
  const file = join(typesDist, name)
  if (!existsSync(file)) fail(`${file} 缺失 —— @ihui/types 的产物结构变了,内联清单需同步更新`)
  const text = readFileSync(file, 'utf8')
  if (/^\s*import\s[^;]*from\s/m.test(text)) {
    fail(`${name} 含有 import —— 内联方案只支持自包含声明,否则得连带复制其依赖图`)
  }
  chunks.push(text.trimEnd())
}

const bundled = [
  '// 本文件由 packages/sdk/scripts/embed-types.mjs 从 @ihui/types 的声明生成,请勿手改。',
  '// 内联目的:让 npm 发布物的 .d.ts 不依赖未发布的 private workspace 包。',
  '',
  ...chunks,
  '',
].join('\n')
writeFileSync(join(distDir, 'ihui-types.d.ts'), bundled)

let rewritten = 0
for (const name of readdirSync(distDir).filter((f) => f.endsWith('.d.ts') && f !== 'ihui-types.d.ts')) {
  const file = join(distDir, name)
  const before = readFileSync(file, 'utf8')
  const after = before.replace(/(from\s+['"])@ihui\/types(['"])/g, '$1./ihui-types.js$2')
  if (after !== before) {
    writeFileSync(file, after)
    rewritten += 1
  }
}

// 判据:改写后不得再有任何 import/export 指向 @ihui/*(JSDoc 示例里的字样不算)。
for (const name of readdirSync(distDir).filter((f) => f.endsWith('.d.ts'))) {
  const text = readFileSync(join(distDir, name), 'utf8')
  if (/^\s*(import|export)\b[^\n]*from\s+['"]@ihui\//m.test(text)) {
    fail(`${name} 仍以 import/export 引用 @ihui/* —— 消费者装包后类型解析必红`)
  }
}

console.log(`✅ embed-types: dist/ihui-types.d.ts 已生成,改写 ${rewritten} 个声明文件,无 @ihui/* 残留`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
