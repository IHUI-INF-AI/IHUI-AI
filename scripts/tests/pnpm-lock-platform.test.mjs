// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 「optional × 平台不匹配」判据回归测试(门 78 深扫档的豁免腿)
//
// 成因(2026-11-01 现读):门 78 --strict 报「401 条链接目标内容不成立(悬空)」,逐条对账后
// 全部是 `@napi-rs/canvas-darwin-arm64` / `fsevents` / `lightningcss-linux-x64-musl` 这类
// **原生平台变体** —— pnpm 对 lock 里标 optional 且 os/cpu/libc 不含本机的条目只建链接、
// 不物化 store 目录,所以链接在任何平台都恒指向不存在处。这道红与提交内容无关 ⇒ §12e 恒红门。
// 本测试钉住两件事:① 豁免只走「optional ∧ 平台确实不匹配」这一条形;② **反向牙** ——
// 本机该装而没装(os/cpu 命中本机)、或必需依赖(未标 optional)悬空,判据必须照旧冒红,
// 否则就把 2026-09-24 那场「store 目录被掏空 ⇒ 约 110 道守门同时废」的事故重新埋回去。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as lib } from '../lib/pnpm-lock-platform.mjs'

const LOCK_TEXT = [
  "lockfileVersion: '9.0'",
  '',
  'settings:',
  '  autoInstallPeers: true',
  '',
  'importers:',
  '  .:',
  '    dependencies:',
  "      '@ihui/api':",
  '        specifier: workspace:*',
  '',
  'packages:',
  "  '@napi-rs/canvas-darwin-arm64@1.0.6':",
  '    resolution: {integrity: sha512-AAA=}',
  "    engines: {node: '>= 10'}",
  '    cpu: [arm64]',
  '    os: [darwin]',
  '',
  '  fsevents@2.3.3:',
  '    resolution: {integrity: sha512-BBB=}',
  '    os: [darwin]',
  '',
  "  '@napi-rs/canvas-win32-x64-msvc@1.0.6':",
  '    resolution: {integrity: sha512-CCC=}',
  '    cpu: [x64]',
  '    os: [win32]',
  '',
  "  '@speedy/natives-linux-x64-musl@2.1.0':",
  '    resolution: {integrity: sha512-DDD=}',
  '    cpu: [x64]',
  '    os: [linux]',
  '    libc: [musl]',
  '',
  '  plain-optional-no-arch@1.0.0:',
  '    resolution: {integrity: sha512-EEE=}',
  '',
  'snapshots:',
  "  '@napi-rs/canvas-darwin-arm64@1.0.6':",
  '    optional: true',
  '',
  '  fsevents@2.3.3:',
  '    optional: true',
  '',
  "  '@napi-rs/canvas-win32-x64-msvc@1.0.6':",
  '    optional: true',
  '',
  "  '@speedy/natives-linux-x64-musl@2.1.0':",
  '    optional: true',
  '',
  '  plain-optional-no-arch@1.0.0:',
  '    optional: true',
  '',
  "  'not-optional@1.0.0':",
  '    dependencies:',
  '      other: 1.0.0',
  '',
].join('\n')

const WIN_HOST = { platform: 'win32', arch: 'x64', libc: null }
const LINUX_GNU_HOST = { platform: 'linux', arch: 'x64', libc: 'glibc' }

function faceOf(text = LOCK_TEXT) {
  const face = lib.parseLockPlatformFace(text)
  assert.ok(face instanceof Map, '合成 lock 必须建得出档(建不出 ⇒ 下面全部判据无从取证)')
  return face
}

test('解析面:引号键与裸键都取到键名本体(带尾冒号的键是上一版的真 bug)', () => {
  const face = faceOf()
  assert.deepEqual(face.get('@napi-rs/canvas-darwin-arm64@1.0.6').os, ['darwin'])
  assert.deepEqual(face.get('@napi-rs/canvas-darwin-arm64@1.0.6').cpu, ['arm64'])
  assert.equal(face.get('@napi-rs/canvas-darwin-arm64@1.0.6').optional, true)
  // 裸键(无引号)曾经被吃掉尾冒号 ⇒ 52 条 fsevents / lightningcss 认不出来、照旧判红
  assert.equal(face.has('fsevents@2.3.3'), true, '裸键必须按本体入档')
  assert.equal(face.has('fsevents@2.3.3:'), false, '键名不得带尾冒号')
  assert.deepEqual(face.get('fsevents@2.3.3').os, ['darwin'])
})

test('跨段并档:os/cpu 住在 packages、optional 住在 snapshots,只读一段就判不出', () => {
  const face = faceOf()
  const e = face.get('fsevents@2.3.3')
  assert.equal(e.optional, true, 'snapshots 段的 optional 必须并进来')
  assert.deepEqual(e.os, ['darwin'], 'packages 段的 os 必须并进来')
})

test('射程面:importers 块的键与四空格字段不得入档', () => {
  const face = faceOf()
  assert.equal(face.has('.'), false, 'importers 的 `.` 不是包键')
  assert.equal(face.has('specifier'), false, '四空格字段不是键')
  assert.equal(face.get('not-optional@1.0.0').optional, false)
})

test('decodeStoreDirKey:pnpm 的 + 编码与纯名两形态都还原成 lock 键', () => {
  assert.deepEqual(lib.decodeStoreDirKey('@napi-rs+canvas-darwin-arm64@1.0.6'), [
    '@napi-rs/canvas-darwin-arm64@1.0.6',
  ])
  assert.deepEqual(lib.decodeStoreDirKey('fsevents@2.3.3'), ['fsevents@2.3.3'])
  // peer 后缀真形态(现读 .pnpm 目录名):`@0no-co+graphql.web@1.3.4_graphql@16.8.1` ——
  // 版本位的 @ 不是最后一个 @,而是跳过起始 @ 后的第一个;lock 键侧同一件事写成 `(peer@ver)`
  const cands = lib.decodeStoreDirKey('some-pkg@1.2.3_peer@2.0.0')
  assert.ok(cands.includes('some-pkg@1.2.3'), `应含基版键, got ${cands}`)
  assert.ok(cands.includes('some-pkg@1.2.3(peer@2.0.0)'), `应含 lock 的括号形, got ${cands}`)
  assert.ok(
    lib
      .decodeStoreDirKey('@0no-co+graphql.web@1.3.4_graphql@16.8.1')
      .includes('@0no-co/graphql.web@1.3.4'),
    'scoped + peer 两形叠加也必须给得出基版键',
  )
  assert.deepEqual(lib.decodeStoreDirKey(''), [])
  assert.deepEqual(lib.decodeStoreDirKey('no-version-at-all'), [])
})

test('豁免规则:对侧平台的 optional 变体给理由,本机该装的那一枚给 null(反向牙)', () => {
  const face = faceOf()
  const foreign = face.get('@napi-rs/canvas-darwin-arm64@1.0.6')
  const why = lib.platformMismatchReason(foreign, WIN_HOST)
  assert.match(String(why), /os=\[darwin\]/, 'os 不含本机 ⇒ 必须给得出理由')

  const native = face.get('@napi-rs/canvas-win32-x64-msvc@1.0.6')
  assert.equal(
    lib.platformMismatchReason(native, WIN_HOST),
    null,
    'os/cpu 命中本机的 optional 变体悬空 = 安装残缺,绝不能豁免(2026-09-24 事故型)',
  )

  const notOptional = face.get('not-optional@1.0.0')
  assert.equal(
    lib.platformMismatchReason({ ...notOptional, os: ['darwin'] }, WIN_HOST),
    null,
    '未标 optional 的包不享有豁免 —— 拿它豁免等于把必需依赖的缺失也放掉',
  )

  const noArch = face.get('plain-optional-no-arch@1.0.0')
  assert.equal(
    lib.platformMismatchReason(noArch, WIN_HOST),
    null,
    '既无 os 也无 cpu 字段 ⇒ 无法证明平台不匹配,不豁免(取不到证据不记绿)',
  )
})

test('libc 维:musl 变体在 glibc 主机上豁免,量不出本机 libc 时不豁免', () => {
  const face = faceOf()
  const musl = face.get('@speedy/natives-linux-x64-musl@2.1.0')
  assert.match(
    String(lib.platformMismatchReason(musl, LINUX_GNU_HOST)),
    /libc=\[musl\]/,
    'os/cpu 都命中而 libc 不符 ⇒ 仍是平台不匹配(CI 的 Ubuntu 上这类链接同样恒悬空)',
  )
  assert.equal(
    lib.platformMismatchReason(musl, { platform: 'linux', arch: 'x64', libc: null }),
    null,
    '本机 libc 量不到 ⇒ 不豁免(证据不足就不放行)',
  )
})

test('悬空链接腿:从符号链接目标反推 store 键,四条出路各按其形', () => {
  const face = faceOf()
  const link = (target) => () => target
  const thrower = () => {
    throw new Error('不是符号链接')
  }

  assert.match(
    String(
      lib.danglingLinkSkipReason(
        '/x/node_modules/.pnpm/@napi-rs+canvas@1.0.6/node_modules/@napi-rs/canvas-darwin-arm64',
        face,
        WIN_HOST,
        link(
          '../../../@napi-rs+canvas-darwin-arm64@1.0.6/node_modules/@napi-rs/canvas-darwin-arm64',
        ),
      ),
    ),
    /os=\[darwin\]/,
    '对侧平台变体 ⇒ 给得出豁免理由',
  )
  assert.equal(
    lib.danglingLinkSkipReason(
      '/x/node_modules/.pnpm/@napi-rs+canvas@1.0.6/node_modules/@napi-rs/canvas-win32-x64-msvc',
      face,
      WIN_HOST,
      link(
        '../../../@napi-rs+canvas-win32-x64-msvc@1.0.6/node_modules/@napi-rs/canvas-win32-x64-msvc',
      ),
    ),
    null,
    '本机平台的变体悬空 ⇒ 不豁免(反向牙)',
  )
  assert.equal(
    lib.danglingLinkSkipReason('/x/node_modules/fsevents', null, WIN_HOST, link('..')),
    null,
    'lock 面取不到 ⇒ 一条也不豁免,照旧判红',
  )
  assert.equal(
    lib.danglingLinkSkipReason('/x/node_modules/fsevents', face, WIN_HOST, thrower),
    null,
    '目标读不回(不是符号链接)⇒ 不豁免',
  )
  assert.equal(
    lib.danglingLinkSkipReason(
      '/x/node_modules/mystery',
      face,
      WIN_HOST,
      link('../../../mystery-else@9.9.9/node_modules/mystery-else'),
    ),
    null,
    'lock 里查无此键 ⇒ 不豁免(不靠名字形状猜平台)',
  )
})

test('loadLockPlatformFace:盘上没有 lock 时返回 null,不返回空档冒充"判过了"', () => {
  assert.equal(lib.loadLockPlatformFace('/definitely-not-a-repo-root'), null)
  const face = lib.loadLockPlatformFace('/x', () => LOCK_TEXT)
  assert.ok(face instanceof Map && face.size > 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
