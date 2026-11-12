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
 * 做法:取 `@ihui/types` 中两份声明文件(v1-endpoints.d.ts / api-key.d.ts),做**传递闭包**——
 * 它们自身可能再 `import type` 其它 `@ihui/types` 内部声明(如 api-key.d.ts 引用
 * app-shared.d.ts 的 TFunction),把这些内部相对引用也一并内联,并把引用改写到
 * `./ihui-types.js`。外部包 import(react 等)原样保留(发布物允许引用 peer dependency,
 * 判据只拦 `@ihui/*`)。拼成的 `dist/ihui-types.d.ts` 与 `dist/*.d.ts` 里的 `@ihui/types`
 * 说明符一起改写为相对路径 `./ihui-types.js`(TS 会解析到同目录的 `.d.ts`)。
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
// 这两份声明覆盖 SDK 引用的全部 113 个 V1 类型。它们自身可能再 `import type` 其它
// @ihui/types 内部声明(如 api-key.d.ts 引用 app-shared.d.ts 的 TFunction),故做传递闭包:
// 从 SOURCES 出发,把内部相对引用(./xxx.js)也一并内联,并把引用改写到 ./ihui-types.js。
// 外部包 import(如 react)原样保留 —— 发布物允许引用 peer dependency,判据只拦 @ihui/*。
// 注:闭包收集到的 app-shared.d.ts 可能再引 react 等外部包,这些不在 @ihui/* 之列,末道判据放行。
const SOURCES = ['v1-endpoints.d.ts', 'api-key.d.ts']
const bundleSet = new Set()
const queue = [...SOURCES]
while (queue.length) {
  const name = queue.shift()
  if (bundleSet.has(name)) continue
  bundleSet.add(name)
  const file = join(typesDist, name)
  if (!existsSync(file)) fail(`${file} 缺失 —— @ihui/types 的产物结构变了,内联清单需同步更新`)
  const text = readFileSync(file, 'utf8')
  // 仅追踪 @ihui/types 内部的相对引用(./app-shared.js / ../yyy.js);外部包(react 等)跳过
  const re = /(?:import|export)\b[^;\n]*?\bfrom\s+['"](\.\.?\/[^'"]+\.js)['"]/g
  let m
  while ((m = re.exec(text))) {
    const dep = m[1].replace(/^\.\//, '').replace(/\.js$/, '.d.ts')
    if (!bundleSet.has(dep)) queue.push(dep)
  }
}
const chunks = []
for (const name of bundleSet) {
  const file = join(typesDist, name)
  let text = readFileSync(file, 'utf8')
  // 把内部相对引用(./app-shared.js)改写为指向内联后的 ./ihui-types.js
  text = text.replace(/(from\s+['"])\.\/[^'"]+\.js(['"])/g, '$1./ihui-types.js$2')
  chunks.push(`// ── ${name} ──`.trimEnd())
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
