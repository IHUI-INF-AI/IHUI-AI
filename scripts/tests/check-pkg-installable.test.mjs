// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 可安装性自检的纯函数断言(§22c:不复制实现,直接 import 源脚本 __test__)
//
// 跑法: node --test scripts/tests/check-pkg-installable.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

// §22c:直接 import 源脚本导出的 __test__,不维护任何"镜像常量",杜绝源/测两份真相漂移。
// §22d:源脚本的 main() 受 isDirectRun 守护,被 import 时不得有任何副作用。
import { __test__ as src } from '../check-pkg-installable.mjs'

const {
  normalizeTarEntries,
  collectBlockers,
  findExtensionlessRelativeImports,
  collectEsmBlockers,
  collectBareImportBlockers,
  REQUIRED_ENTRIES,
} = src

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

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
  for (const key of [
    'normalizeTarEntries',
    'collectBlockers',
    'findExtensionlessRelativeImports',
    'collectEsmBlockers',
    'stripJsComments',
    'barePackageName',
    'findBareImportSpecifiers',
    'collectBareImportBlockers',
    'SECRET_PATTERNS',
    'JUNK_PATTERNS',
    'REQUIRED_ENTRIES',
  ]) {
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

/* ───────────── 判据 9:运行时裸依赖必须已声明(api-client 可发布性收口时新增) ───────────── */

test('stripJsComments: 注释里的 import 抹平,字符串里的 // 不得当注释(URL 存活)', () => {
  const fixture = [
    "// import { a } from '@pkg/line'",
    "/* import { b } from '@pkg/block' */",
    'const base = "https://api.example.com/v1" // 注释里再写 @pkg/tail',
    "import { c } from '@pkg/real'",
  ].join('\n')
  const stripped = src.stripJsComments(fixture)
  assert.ok(!stripped.includes('@pkg/line'), '行注释里的示例必须被抹掉')
  assert.ok(!stripped.includes('@pkg/block'), '块注释里的示例必须被抹掉')
  assert.ok(stripped.includes('https://api.example.com/v1'), '字符串里的 // 是内容,当注释抹掉就把 URL 吃了')
  assert.ok(!stripped.includes('@pkg/tail'), '行尾注释也必须被抹掉')
  assert.ok(stripped.includes("import { c } from '@pkg/real'"), '代码面的 import 一字不动')
})

test('barePackageName: scoped 与 subpath 都归到 Node 实际解析的包名', () => {
  assert.equal(src.barePackageName('@scope/pkg/sub'), '@scope/pkg')
  assert.equal(src.barePackageName('zod/v4'), 'zod')
  assert.equal(src.barePackageName('@hapi/hoek'), '@hapi/hoek')
})

test('findBareImportSpecifiers: 四种真会 resolve 的写法都抓到,相对/node:/注释不抓', () => {
  const fixture = [
    "import { a } from '@pkg/from-stmt'",
    "export { b } from '@pkg/re-export'",
    "const t = await import('@pkg/dynamic')",
    "import '@pkg/side-effect'",
    "import { r } from './relative.js'",
    "import { n } from 'node:fs'",
    "// import { z } from '@pkg/in-comment'",
  ].join('\n')
  assert.deepEqual(
    src.findBareImportSpecifiers(fixture).sort(),
    ['@pkg/dynamic', '@pkg/from-stmt', '@pkg/re-export', '@pkg/side-effect'],
  )
})

test('collectBareImportBlockers 放过真形态:optional peer、dependencies、自包名', () => {
  // @tarojs/taro 是 api-client 产物里唯一的裸依赖,且刻意是 optional peer —— 这条不许判红,
  // 否则本门会在一个已按约定发布的健康包上恒红(§12e 同型)。
  const files = [
    ['dist/endpoints/voice-stt.taro.js', "const Taro = (await import('@tarojs/taro')).default"],
    ['dist/client.js', "import { z } from 'zod'"],
    ['dist/index.js', "import { self } from '@ihui/api-client'"],
  ]
  const manifest = {
    name: '@ihui/api-client',
    peerDependencies: { '@tarojs/taro': '>=4.0.0' },
    dependencies: { zod: '^3.0.0' },
  }
  assert.deepEqual(collectBareImportBlockers('package', files, manifest), [])
})

/**
 * 故意做坏必须红 —— 这条是本判据存在的全部理由。
 * 场景是本次收口真实面对的危险:把 @ihui/types 从 dependencies 挪进 devDependencies,
 * 判据 5(workspace: 残留)当场归零、门一路绿灯,而产物里只要还剩一条运行时 import,
 * 外部消费者 import 即 ERR_MODULE_NOT_FOUND。devDeps 不随包发布,所以它不构成通过。
 */
test('故意做坏:产物运行时 import @ihui/types 而它只在 devDependencies → 必红并点名', () => {
  const files = [['dist/index.js', "export { isAIResponse } from '@ihui/types'"]]
  const manifest = {
    name: '@ihui/api-client',
    dependencies: {},
    devDependencies: { '@ihui/types': 'workspace:*' },
  }
  const blockers = collectBareImportBlockers('package', files, manifest)
  assert.equal(blockers.length, 1, JSON.stringify(blockers))
  assert.match(blockers[0], /@ihui\/types/, blockers[0])
  assert.match(blockers[0], /devDependencies/, blockers[0])
  // 反向对照:同一个 import 放回 dependencies 即放过(证明红的是"没声明",不是"用了外部包")
  const fixed = collectBareImportBlockers('package', files, {
    name: '@ihui/api-client',
    dependencies: { '@ihui/types': '^0.1.0' },
  })
  assert.deepEqual(fixed, [])
})

/**
 * §22c 的"输入必须逐字取自真实文件":判据的对象是**注释里的 import 形态**,
 * 那就不该全靠自造夹具。`packages/sdk/src/client.ts`(已入库、且 sdk 是本仓唯一
 * 已通过本自检出并摘了 private 的包)头注里正写着文档示例 —— 不剥注释的话,
 * 判据 9 会把这条示例当成运行时依赖,而它发不出去(SDK 自称的坐标),于是**健康包被钉红**。
 * 这里既锁"剥完不抓",也锁"这条示例确实还在文件里"(夹具失效要出声,不许静默变恒真)。
 */
test('真实文件锁:sdk 源码头注的文档示例 import 不得被判成裸依赖', () => {
  const real = readFileSync(join(REPO_ROOT, 'packages', 'sdk', 'src', 'client.ts'), 'utf8')
  assert.match(real, /^\s*\*\s+import \{ createClient \} from '@ihui\/sdk'/m, '示例已不在真实文件里 → 本锁退化为恒真,须重找载体')
  assert.deepEqual(src.findBareImportSpecifiers(real), [], '注释里的文档示例不该被算成运行时依赖')
})
