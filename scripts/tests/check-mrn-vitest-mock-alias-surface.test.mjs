// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/check-mrn-vitest-mock-alias-surface.test.mjs
/**
 * 观测门"mobile-rn vitest alias→mocks 替身面"的 §22c 镜像测试(2026-10-15,普查批③)。
 *
 * 跑法:node --test scripts/tests/check-mrn-vitest-mock-alias-surface.test.mjs
 *
 * 纪律(AGENTS.md §22c/§22d):本文件不复制判据实现,只 import 源脚本导出的
 * `__test__`;源脚本 main() 受 isDirectRun 守护,import 时零副作用(第 0 例钉这一点)。
 * 端到端三例用合成夹具(mkScratch 临时目录,§26 禁 os.tmpdir):
 *   ① 有替身命中(头注写明理由) ⇒ 报名,RC=0(观测档:命中也绝不红);
 *   ② exports 缺项/包缺/头注未写 ⇒ 照样只报名,RC=0(同上,定级归 owner);
 *   ③ config 取不到(判失明) ⇒ ⚠ 上报,RC=0(观测档恒 0)。
 * 另加纯函数四例:别名解析(单行+多行+尾随逗号)、落点判定、exports 判定三态、头注剥水印。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// §26:临时夹具唯一落点(不落 os.tmpdir、不落仓库树内)
import { mkScratch } from '../lib/scratch-dir.mjs'

// §22c:直接 import 源模块导出的 __test__,杜绝"源/测两份真相"漂移。
import { __test__ as src } from '../check-mrn-vitest-mock-alias-surface.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-mrn-vitest-mock-alias-surface.mjs')

function runGate(root, args = []) {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  return execFileSync(process.execPath, [SCRIPT, '--root', root, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

const WATERMARK =
  '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n' +
  '// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。\n'

function writeStub(absPath, headerLines, body) {
  writeFileSync(absPath, `${WATERMARK}${headerLines.join('\n')}\n${body}\n`)
}

/**
 * 合成夹具仓:<scratch>/wt/
 *   apps/mobile-rn/vitest.config.ts —— 4 条别名:2 条指 mocks(1 条 exports 在、1 条 exports 缺),
 *                                      1 条指真实源码(不进清单),1 条外部包指 mocks(n-a)。
 *   packages/fakepkg/package.json    —— name=@ihui/fakepkg,exports 只给 "./utils"。
 *   tests/__mocks__ 下 3 份替身:有头注 / 无头注 / 外部包替身。
 */
function makeFixtureRepo() {
  const wt = join(mkScratch('mrn-alias-'), 'wt')
  const rn = join(wt, 'apps', 'mobile-rn')
  const mocks = join(rn, 'tests', '__mocks__')
  mkdirSync(mocks, { recursive: true })
  mkdirSync(join(wt, 'packages', 'fakepkg', 'src'), { recursive: true })
  writeFileSync(
    join(rn, 'vitest.config.ts'),
    `import { resolve } from 'node:path'
export default {
  resolve: {
    alias: {
      'react-native': resolve(__dirname, 'tests/__mocks__/react-native.ts'),
      unquoted: resolve(__dirname, 'tests/__mocks__/react-native.ts'),
      '@ihui/fakepkg/utils': resolve(
        __dirname,
        'tests/__mocks__/ihui-fakepkg-utils.ts',
      ),
      '@ihui/fakepkg/missing': resolve(__dirname, 'tests/__mocks__/ihui-fakepkg-missing.ts',),
      '@ihui/fakepkg/real': resolve(__dirname, '../../packages/fakepkg/src/index.ts'),
    },
  },
}
`,
  )
  writeFileSync(
    join(wt, 'packages', 'fakepkg', 'package.json'),
    JSON.stringify({ name: '@ihui/fakepkg', exports: { '.': './src/index.ts', './utils': './src/utils.ts' } }, null, 2),
  )
  writeFileSync(join(wt, 'packages', 'fakepkg', 'src', 'index.ts'), 'export const real = 1\n')
  writeStub(
    join(mocks, 'ihui-fakepkg-utils.ts'),
    ['// Stub for @ihui/fakepkg/utils - vitest mock', '// 理由:真实 hooks 依赖 DOM API,vitest(jsdom)下解析失败,详见台账普查批③。'],
    "export const utils = 'stub'\n",
  )
  writeStub(
    join(mocks, 'ihui-fakepkg-missing.ts'),
    ['// Stub for @ihui/fakepkg/missing - vitest mock', '// 理由占位:这一份故意只留一行,验证头注非空即 ok 的口径边界。'],
    "export const missing = 'stub'\n",
  )
  writeStub(
    join(mocks, 'react-native.ts'),
    ['// Stub for react-native - vitest mock', '// 外部包:exports 核对面不在本仓,应报 n-a。'],
    "export const rn = 'stub'\n",
  )
  return wt
}

test('第 0 例:import 源门零副作用(__test__ 在、main 未跑)', () => {
  assert.equal(typeof src.parseAliasEntries, 'function')
  assert.equal(typeof src.main, 'function')
})

test('纯函数:别名解析吃下单行、多行、尾随逗号、无引号 key,并保源序', () => {
  const code = [
    "const cfg = {",
    "  'a/b': resolve(__dirname, 'tests/__mocks__/ab.ts'),",
    "  c: resolve(__dirname, 'tests/__mocks__/c.ts'),", // 无引号 key(真仓 nativewind 同形,首版漏过)
    "  'd': resolve(",
    "    __dirname,",
    "    'tests/__mocks__/d.ts',",
    "  ),",
    "  'e': resolve(__dirname, '../../real/src/index.ts',),",
    "}",
  ].join('\n')
  assert.deepEqual(src.parseAliasEntries(code), [
    { key: 'a/b', target: 'tests/__mocks__/ab.ts' },
    { key: 'c', target: 'tests/__mocks__/c.ts' },
    { key: 'd', target: 'tests/__mocks__/d.ts' },
    { key: 'e', target: '../../real/src/index.ts' },
  ])
})

test('纯函数:落点判定 —— mocks 下 yes,tests 其它目录 no,配置外 no', () => {
  const rn = '/r/apps/mobile-rn'
  assert.equal(src.isMockTarget('/r/apps/mobile-rn/tests/__mocks__/x.ts', rn), true)
  assert.equal(src.isMockTarget('/r/apps/mobile-rn/tests/fixtures/x.ts', rn), false)
  assert.equal(src.isMockTarget('/r/packages/shared/src/index.ts', rn), false)
})

test('纯函数:exports 判定三态 —— 子路径精确/通配命中 yes、缺项 no、外部包 n-a', () => {
  // scope 拆分:必须吃到第二个斜杠,否则 @ihui/fakepkg/utils 被拆成 @ihui(第一版实测咬到这条)
  assert.deepEqual(src.splitPkgAndSub('@ihui/fakepkg/utils'), ['@ihui/fakepkg', '/utils'])
  assert.deepEqual(src.splitPkgAndSub('@ihui/fakepkg'), ['@ihui/fakepkg', ''])
  assert.deepEqual(src.splitPkgAndSub('lodash/fp'), ['lodash', '/fp'])
  const pkgs = src.loadWorkspacePackages(makeFixtureRepo())
  assert.equal(src.exportsExists('@ihui/fakepkg/utils', pkgs), 'yes')
  assert.equal(src.exportsExists('@ihui/fakepkg', pkgs), 'yes')
  assert.equal(src.exportsExists('@ihui/fakepkg/missing', pkgs), 'no')
  assert.equal(src.exportsExists('@ihui/fakepkg/sub/deep', pkgs), 'no')
  assert.equal(src.exportsExists('@ihui/nobody/x', pkgs), 'pkg-missing')
  assert.equal(src.exportsExists('react-native', pkgs), null)
})

test('纯函数:头注剥水印 —— 有理由行 ok、纯水印+代码判 no', () => {
  const withReason = src.leadingReasonComment(
    `${WATERMARK}// [IHUI-AI-PROVENANCE]:x\n\n// Stub for X - vitest mock\n// 理由:真实模块拉原生依赖。\nexport const a = 1\n`,
  )
  assert.equal(withReason.lines.length, 2)
  assert.match(withReason.first, /Stub for X/)
  const noReason = src.leadingReasonComment(`${WATERMARK}// [IHUI-AI-PROVENANCE]:x\nexport const a = 1\n`)
  assert.deepEqual(noReason.lines, [])
  // 块注释跨行(真仓 tests/__mocks__/react-native.ts 同形)也必须被吃到
  const block = src.leadingReasonComment(
    `${WATERMARK}/**\n * react-native mock for vitest/jsdom\n * 防止 Flow type 语法解析失败。\n */\nimport x from 'y'\n`,
  )
  assert.equal(block.lines.length, 2)
  assert.match(block.first, /react-native mock/)
})

test('端到端①:有替身命中 + 头注写明 ⇒ 只报名,RC=0(观测档命中也绝不红)', () => {
  const wt = makeFixtureRepo()
  const out = runGate(wt)
  assert.match(out, /\[mrn 替身面\]/)
  assert.match(out, /@ihui\/fakepkg\/utils/)
  assert.match(out, /@ihui\/fakepkg\/missing/)
  assert.match(out, /react-native/)
  assert.match(out, /exports✓/)
  assert.match(out, /exports✗/) // missing 子路径 exports 表没有 ⇒ 报出来
  assert.match(out, /exports n-a/) // 外部包不判
  assert.match(out, /头注✓/)
  assert.match(out, /替身面命中 4/)
})

test('端到端②:直指真实源码的别名不进替身面清单;audit() 结构逐格核对', () => {
  const wt = makeFixtureRepo()
  const out = runGate(wt)
  assert.doesNotMatch(out, /@ihui\/fakepkg\/real/)
  const face = src.audit(wt)
  assert.equal(face.blind, null)
  assert.equal(face.totalAliases, 5)
  assert.equal(face.rows.length, 4)
  const byKey = new Map(face.rows.map((r) => [r.key, r]))
  assert.equal(byKey.get('@ihui/fakepkg/utils').exportsVerdict, 'yes')
  assert.equal(byKey.get('@ihui/fakepkg/utils').headerOk, true)
  assert.equal(byKey.get('@ihui/fakepkg/missing').exportsVerdict, 'no')
  assert.equal(byKey.get('react-native').exportsVerdict, null)
})

test('端到端③:config 取不到(判失明)⇒ ⚠ 上报,RC 仍 0', () => {
  const wt = join(mkScratch('mrn-alias-blind-'), 'wt')
  mkdirSync(join(wt, 'apps', 'mobile-rn'), { recursive: true })
  const out = runGate(wt)
  assert.match(out, /判失明/)
  assert.match(out, /vitest 配置取不到/)
})
