// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 可安装性自检的纯函数断言(§22c:不复制实现,直接 import 源脚本 __test__)
//
// 跑法: node --test scripts/tests/check-pkg-installable.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

// §22c:直接 import 源脚本导出的 __test__,不维护任何"镜像常量",杜绝源/测两份真相漂移。
// §22d:源脚本的 main() 受 isDirectRun 守护,被 import 时不得有任何副作用。
import { __test__ as src } from '../check-pkg-installable.mjs'

const { normalizeTarEntries, collectBlockers, findExtensionlessRelativeImports, collectEsmBlockers, REQUIRED_ENTRIES } = src

const MANIFEST = {
  name: '@ihui/api-client',
  version: '0.0.0',
  dependencies: { '@ihui/types': 'workspace:*' },
}

/** 临时 manifest 留在仓库内(AGENTS.md §15 工作区卫生),不写 os.tmpdir()。 */
// 干净 checkout / CI runner 上 .ihui-agent/tmp 不存在 → mkdtempSync 直接 ENOENT;
// recursive mkdir 幂等,已存在不报错。落点不变,只补"父目录不存在就建"。
const TMP_ROOT = join(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'), '.ihui-agent', 'tmp')
mkdirSync(TMP_ROOT, { recursive: true })
const SCRATCH = mkdtempSync(join(TMP_ROOT, 'pkg-installable-test-'))
function fakeRepoManifest(obj) {
  const dir = SCRATCH
  const p = join(dir, 'package.json')
  writeFileSync(p, JSON.stringify(obj))
  return p
}

const GOOD_ENTRIES = [
  'package/package.json',
  'package/LICENSE',
  'package/NOTICE',
  'package/dist/index.js',
  'package/dist/index.d.ts',
  'package/dist/endpoints/user.js',
]

test('__test__ 导出形状齐全(§22c 锚点)', () => {
  for (const key of ['normalizeTarEntries', 'collectBlockers', 'findExtensionlessRelativeImports', 'collectEsmBlockers', 'SECRET_PATTERNS', 'JUNK_PATTERNS', 'REQUIRED_ENTRIES']) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
  assert.ok(REQUIRED_ENTRIES.includes('dist/index.js'), 'REQUIRED_ENTRIES 必须含 dist/index.js')
  assert.ok(REQUIRED_ENTRIES.includes('dist/index.d.ts'), 'REQUIRED_ENTRIES 必须含 dist/index.d.ts')
})

test('normalizeTarEntries: 去空行 / 去目录条目 / 去 ./ 前缀', () => {
  const out = normalizeTarEntries('./package/\npackage/package.json\n\npackage/dist/index.js  \n')
  assert.deepEqual(out, ['package/package.json', 'package/dist/index.js'])
})

test('干净 dist 包:无 blocker', () => {
  const blockers = collectBlockers(
    'package',
    GOOD_ENTRIES,
    { name: '@ihui/api-client', version: '0.0.0', dependencies: { zod: '^3.0.0' } },
    fakeRepoManifest({ name: '@ihui/api-client', version: '0.0.0' }),
  )
  assert.deepEqual(blockers, [])
})

test('缺 dist/index.d.ts → blocker(外部装了但无法 import)', () => {
  const entries = GOOD_ENTRIES.filter((p) => p !== 'package/dist/index.d.ts')
  const blockers = collectBlockers('package', entries, MANIFEST, fakeRepoManifest(MANIFEST))
  assert.ok(blockers.some((b) => b.includes('dist/index.d.ts')), blockers.join('\n'))
})

test('混入 src/ → blocker(exports 仍指向源码)', () => {
  const blockers = collectBlockers(
    'package',
    [...GOOD_ENTRIES, 'package/src/index.ts', 'package/src/client.ts'],
    MANIFEST,
    fakeRepoManifest(MANIFEST),
  )
  assert.ok(blockers.some((b) => b.includes('src/')), blockers.join('\n'))
})

test('混入 .env / 私钥 → blocker', () => {
  const blockers = collectBlockers(
    'package',
    [...GOOD_ENTRIES, 'package/.env', 'package/dist/id_rsa', 'package/dist/app.npmrc'],
    MANIFEST,
    fakeRepoManifest(MANIFEST),
  )
  const secretBlockers = blockers.filter((b) => b.includes('敏感文件'))
  assert.equal(secretBlockers.length, 3, blockers.join('\n'))
})

test('dependencies 里 workspace: 残留 → blocker(发出去即装不到)', () => {
  const blockers = collectBlockers('package', GOOD_ENTRIES, MANIFEST, fakeRepoManifest(MANIFEST))
  assert.ok(
    blockers.some((b) => b.includes('@ihui/types') && b.includes('workspace:')),
    `应报出 @ihui/types 的 workspace: 残留,实得:\n${blockers.join('\n')}`,
  )
})

test('构建噪音(.tsbuildinfo / node_modules)→ blocker', () => {
  const blockers = collectBlockers(
    'package',
    [...GOOD_ENTRIES, 'package/dist/.tsbuildinfo', 'package/node_modules/foo/index.js'],
    { ...MANIFEST, dependencies: {} },
    fakeRepoManifest(MANIFEST),
  )
  const noise = blockers.filter((b) => b.includes('构建噪音'))
  assert.equal(noise.length, 2, blockers.join('\n'))
})

test('packed name 与仓库 name 不一致 → blocker', () => {
  const blockers = collectBlockers(
    'package',
    GOOD_ENTRIES,
    { name: '@other/api-client', version: '0.0.0', dependencies: {} },
    fakeRepoManifest({ name: '@ihui/api-client', version: '0.0.0' }),
  )
  assert.ok(blockers.some((b) => b.includes('与仓库内 name')), blockers.join('\n'))
})

test('仓库已定版而 packed 版本不一致(prepack 坏了)→ blocker', () => {
  const repo = fakeRepoManifest({ name: '@ihui/api-client', version: '1.2.3' })
  const bad = collectBlockers('package', GOOD_ENTRIES, { name: '@ihui/api-client', version: '1.2.2' }, repo)
  assert.ok(bad.some((b) => b.includes('prepack')), bad.join('\n'))
  // 仓库仍是占位 0.0.0 时不比版本(未接发布流水线 ≠ prepack 坏)
  const placeholder = collectBlockers(
    'package',
    GOOD_ENTRIES,
    { name: '@ihui/api-client', version: '0.0.0' },
    fakeRepoManifest({ name: '@ihui/api-client', version: '0.0.0' }),
  )
  assert.deepEqual(placeholder, [])
})

test('prefix 从 tarball 推导,非硬编码 package', () => {
  const blockers = collectBlockers(
    'pkg',
    ['pkg/package.json', 'pkg/LICENSE', 'pkg/NOTICE', 'pkg/dist/index.js', 'pkg/dist/index.d.ts'],
    { name: '@ihui/api-client', version: '0.0.0', dependencies: {} },
    fakeRepoManifest({ name: '@ihui/api-client', version: '0.0.0' }),
  )
  assert.deepEqual(blockers, [])
})

/**
 * §22d:本文件顶部已静态 import 源脚本。若源脚本的 main() 没有 isDirectRun 守护,
 * import 阶段就会去跑 npm pack(甚至 process.exit),下面的用例根本跑不到。
 * 所以「用例会执行」本身就是 main() 未触发副作用的证据 —— 这里再补一条形状断言。
 */
test('源脚本被 import 时 main() 不得执行(§22d isDirectRun)', () => {
  assert.equal(typeof src.normalizeTarEntries, 'function')
  assert.equal(typeof fileURLToPath(import.meta.url), 'string')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('findExtensionlessRelativeImports: 抓无扩展名相对 import,放过带 .js 与裸包名', () => {
  const fixture = [
    "export * from './client'",
    "import { x } from '../utils'",
    "import { z } from './ok.js'",
    "import('./dyn')",
    "import { a } from '@ihui/types'",
    "import { b } from 'zod/v4'",
  ].join('\n')
  assert.deepEqual(findExtensionlessRelativeImports(fixture), ['./client', '../utils', './dyn'])
})

test('collectEsmBlockers: 聚合为一条,含文件数与样例', () => {
  const ok = collectEsmBlockers('package', [['dist/a.js', "import { x } from './b.js'"]])
  assert.deepEqual(ok, [])
  const bad = collectEsmBlockers('package', [
    ['dist/a.js', "import { x } from './b'"],
    ['dist/c.js', "import { y } from '../d'"],
  ])
  assert.equal(bad.length, 1, JSON.stringify(bad))
  assert.ok(bad[0].startsWith('2 个 '), bad[0])
  assert.ok(bad[0].includes('ERR_MODULE_NOT_FOUND'), bad[0])
})
