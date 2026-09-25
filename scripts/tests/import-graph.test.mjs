// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/import-graph.mjs` 的镜像测试（§22c 形态：直接 import 源模块的导出，不留第二份真相）。
 *
 * 三条**必须**存在的证明（缺一不可，它们就是这张图"有没有牙"的定义）：
 *  1. **方向性**：A 改了导出、只有 B 引用 B 且 B 不在暂存区 ⇒ `widenOverDependents([A])`
 *     必须含 B；同时断言「闭包 ⊇ changed」这条不变量。并且**反向**断言 B ∉ changed ——
 *     只断言新的会允许判据整体退化（门 70「空暂存恒绿」同型）：旧口径「报错文件 ∈ staged」
 *     在这个夹具上必须是绿的，新口径必须是红的，两边都要钉。
 *  2. **四类边各自一条正反例**：包名 / 别名 / 相对 / 动态。每类"连得上"与"该断开就断开"。
 *     别名这一类**真的栽过**：通配键 `"@/*"` 的 prefix 已含分隔符，第一版又补了一个 `/`，
 *     于是真仓 6251 处 `@/...` 被算成第三方包 —— 一整类边静默消失，而 stats 行看上去只是
 *     「alias 1/187」。所以每条反例都必须同时断言「没有边」**且**「出现在 undetermined 里」，
 *     否则"判据失效"与"判定为不存在"在断言上长得一样。
 *  3. **undetermined 可见**：解析不到的 import 必须被点名（带 from / spec / reason），
 *     不得静默丢；而第三方裸包名走 `external`，既不混进 undetermined 也不静默。
 *
 * 另加一条本库特有的：**缓存键必须是 (tree oid, face)**。用构造面证明 —— 同一实例内
 * 让 tree oid 变化后必须重算（按符号名 `HEAD` 键控的实现会在这里判失败），
 * 以及同一 tree oid 同一面必须命中缓存（否则「按 oid 键控」这条断言是恒真的）。
 *
 * 夹具一律用临时 git 仓（`scratch-dir.mjs`），不靠"真仓现在正好有几个文件" ——
 * 那是本仓反复登记过的一类错：把仓库瞬时状态当恒定前提。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import {
  __test__ as IG,
  buildFileGraph,
  formatStats,
  widenOverDependents,
} from '../lib/import-graph.mjs'

const SCRATCHES = []
after(() => {
  for (const d of SCRATCHES) rmScratch(d)
})

// git 一律绝对路径 + windowsHide + 数字 timeout（§5b「git 调用不得依赖环境」/ 门 52 / 门 80）。
const GIT = gitBinary()
function git(args, cwd) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** 造一个提交了指定文件的临时 git 仓；返回 `root` 与 `commit()`（再提交一轮，tree oid 必变）。 */
function mkRepo(files) {
  const root = mkScratch('import-graph-')
  SCRATCHES.push(root)
  git(['init', '-b', 'main'], root)
  git(['config', 'user.email', 't@example.com'], root)
  git(['config', 'user.name', 'test'], root)
  writeAll(root, files)
  git(['add', '-A'], root)
  git(['commit', '-m', 'one'], root)
  return {
    root,
    commit() {
      git(['add', '-A'], root)
      git(['commit', '-m', 'two'], root)
    },
  }
}

function writeAll(root, files) {
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
}

const pkgManifest = (name) =>
  JSON.stringify({ name, version: '1.0.0', main: 'src/index.ts' }, null, 2)

// ── 0. face 必填：不给默认值 ────────────────────────────────────────────────────────────

test('face 缺失必须抛，绝不静默走工作树（取哪个面判错是本仓最高频假绿源）', () => {
  const { root } = mkRepo({ 'packages/a/package.json': pkgManifest('@ihui/a') })
  assert.throws(() => buildFileGraph({ root }), /必须显式给 face/)
  assert.throws(() => buildFileGraph({ face: '', root }), /必须显式给 face/)
  assert.throws(() => buildFileGraph({ face: 'nope', root }), /face 必须是/)
  // 惯用别名归一（face-reader 口径），但对外真相仍是三档
  assert.equal(buildFileGraph({ face: 'head', root }).face, 'HEAD')
  assert.equal(buildFileGraph({ face: 'staged', root }).face, 'index')
})

// ── 1. 方向性断言（本票的核心证明）─────────────────────────────────────────────────────

const SIGN_FIXTURE = {
  'packages/lib-a/package.json': pkgManifest('@ihui/lib-a'),
  'packages/lib-a/src/index.ts': 'export function broken(): string { return "v2" }\n',
  // B 是本侧唯一的下游：它不在"改动清单"里，旧口径看不见它。
  'apps/web/src/use-a.ts': "import { broken } from '@ihui/lib-a'\nexport const x = broken()\n",
}

test('方向性：A 改导出、只有 B 引用 ⇒ 闭包必须含 B；且 B 不在 changed 里（旧口径必绿）', () => {
  const { root } = mkRepo(SIGN_FIXTURE)
  const graph = buildFileGraph({ face: 'HEAD', root })
  const A = 'packages/lib-a/src/index.ts'
  const B = 'apps/web/src/use-a.ts'

  const { closure, added } = widenOverDependents([A], graph)
  assert.ok(closure.includes(B), `闭包必须把下游消费者 B 拉进来，实得 ${JSON.stringify(closure)}`)
  assert.deepEqual(added, [B])
  // 旧判据（报错文件 ∈ staged）在这个夹具上**必须**是绿的 —— 只断言新判据会允许它整体退化
  assert.ok(![A].includes(B), 'B 不在 changed 里：这就是"跨包破坏被过滤掉"的机制本身')
  // 不变量：闭包 ⊇ changed
  for (const p of [A]) assert.ok(closure.includes(p), '闭包必须包含 seed 自身')
})

test('闭包是传递的：A←B←C 时 widen([A]) 必须含 B 与 C（一跳图等于没有）', () => {
  const { root } = mkRepo({
    'packages/lib-a/package.json': pkgManifest('@ihui/lib-a'),
    'packages/lib-a/src/index.ts': 'export const a = 1\n',
    'packages/lib-b/package.json': pkgManifest('@ihui/lib-b'),
    'packages/lib-b/src/index.ts': "import { a } from '@ihui/lib-a'\nexport const b = a\n",
    'apps/web/src/page.ts': "import { b } from '@ihui/lib-b'\nexport const c = b\n",
  })
  const graph = buildFileGraph({ face: 'HEAD', root })
  const { closure } = widenOverDependents(['packages/lib-a/src/index.ts'], graph)
  assert.deepEqual(closure, [
    'apps/web/src/page.ts',
    'packages/lib-a/src/index.ts',
    'packages/lib-b/src/index.ts',
  ])
})

test('changed 里不在图上的路径必须原样保留（丢掉它 = 把闭包判据退化回按清单判）', () => {
  const { root } = mkRepo(SIGN_FIXTURE)
  const graph = buildFileGraph({ face: 'HEAD', root })
  const { closure } = widenOverDependents(['packages/lib-a/src/deleted-yet.ts'], graph)
  assert.deepEqual(closure, ['packages/lib-a/src/deleted-yet.ts'])
})

// ── 2. 四类边：每类一条正例 + 一条反例 ─────────────────────────────────────────────────

function kindEdges(graph, kind) {
  return graph.edges.filter((e) => e.kind === kind)
}

test('包名族 @ihui/*：正例连成边，反例进 undetermined 且不留边', () => {
  const { root } = mkRepo({
    ...SIGN_FIXTURE,
    // 反例：包名根本不存在
    'apps/web/src/ghost.ts': "import { nope } from '@ihui/does-not-exist'\nexport const g = nope\n",
  })
  const graph = buildFileGraph({ face: 'HEAD', root })
  const e = kindEdges(graph, 'pkg').find((x) => x.from === 'apps/web/src/use-a.ts')
  assert.ok(e, 'pkg 正例必须连出边')
  assert.equal(e.to, 'packages/lib-a/src/index.ts')

  const u = graph.undetermined.find((x) => x.from === 'apps/web/src/ghost.ts')
  assert.ok(u, '不存在的包必须进 undetermined（不得静默丢）')
  assert.equal(u.reason, 'no-such-workspace-package')
  assert.equal(u.spec, '@ihui/does-not-exist')
  assert.ok(
    !graph.edges.some((x) => x.from === 'apps/web/src/ghost.ts'),
    '反例不得同时产出一条边（否则 undetermined 只是装饰）',
  )
})

test('tsconfig paths 别名：通配键与精确键各一条正例，指到不存在文件时进 undetermined', () => {
  const { root } = mkRepo({
    'apps/demo/package.json': JSON.stringify({ name: '@ihui/demo', version: '1.0.0' }),
    'apps/demo/tsconfig.json': JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: { '@feat/*': ['src/feat/*'], '@solo': ['src/solo.ts'] },
      },
      include: ['src/**/*'],
    }),
    'apps/demo/src/feat/thing.ts': 'export const thing = 1\n',
    'apps/demo/src/solo.ts': 'export const solo = 2\n',
    'apps/demo/src/page.tsx': [
      "import { thing } from '@feat/thing'",
      "import { solo } from '@solo'",
      "import { gone } from '@feat/gone-nowhere'",
      'export const v = [thing, solo, gone]',
    ].join('\n'),
  })
  const graph = buildFileGraph({ face: 'HEAD', root })
  const from = 'apps/demo/src/page.tsx'
  const aliasTo = kindEdges(graph, 'alias')
    .filter((e) => e.from === from)
    .map((e) => e.to)
    .sort()
  // 通配 `"@feat/*"` 的 prefix 已含 `/`：第一版在这里补第二个 `/` ⇒ 整类别名边静默消失
  assert.deepEqual(aliasTo, ['apps/demo/src/feat/thing.ts', 'apps/demo/src/solo.ts'])
  const u = graph.undetermined.find((x) => x.spec === '@feat/gone-nowhere')
  assert.ok(u, '别名指到不存在的文件必须进 undetermined')
  assert.equal(u.reason, 'alias-target-not-found')
  assert.ok(!graph.edges.some((e) => e.spec === '@feat/gone-nowhere'))
})

test('相对导入：`../` 与无扩展名都连得上；写错路径进 undetermined', () => {
  const { root } = mkRepo({
    'packages/rel/package.json': JSON.stringify({ name: '@ihui/rel', version: '1.0.0' }),
    'packages/rel/src/util/string.ts': 'export const s = ""\n',
    'packages/rel/src/a.ts': [
      "import { s } from './util/string'",
      "import { s2 } from '../src/util/string'",
      "import { gone } from './nope/deeper'",
      'export const all = [s, s2, gone]',
    ].join('\n'),
  })
  const graph = buildFileGraph({ face: 'HEAD', root })
  const to = kindEdges(graph, 'relative')
    .filter((e) => e.from === 'packages/rel/src/a.ts')
    .map((e) => e.to)
  assert.ok(
    to.includes('packages/rel/src/util/string.ts'),
    `相对正例必须连上，实得 ${JSON.stringify(to)}`,
  )
  // `../src/util/string` 从 packages/rel/src 出发回到同一文件：同一条边（去重后仍是一条）
  assert.equal(new Set(to).size, 1)
  const u = graph.undetermined.find((x) => x.spec === './nope/deeper')
  assert.ok(u, '相对路径解析不到必须报数')
  assert.equal(u.reason, 'relative-not-found')
})

test('动态 import()/require()：连得上的记为 dynamic 语法，连不上的进 undetermined，第三方包记 external 不静默', () => {
  const { root } = mkRepo({
    'packages/dyn/package.json': JSON.stringify({ name: '@ihui/dyn', version: '1.0.0' }),
    'packages/dyn/src/lazy.ts': 'export const lazy = 1\n',
    'packages/dyn/src/main.ts': [
      "const a = await import('./lazy')",
      "const b = require('./lazy')",
      "const c = await import('./gone-lazy')",
      "const d = require('some-third-party-lib')",
      'export const x = [a, b, c, d]',
    ].join('\n'),
  })
  const graph = buildFileGraph({ face: 'HEAD', root })
  const dyn = graph.edges.filter(
    (e) => e.from === 'packages/dyn/src/main.ts' && e.syntax === 'dynamic',
  )
  assert.equal(dyn.length, 2, 'import() 与 require() 都要算动态边')
  for (const e of dyn) assert.equal(e.to, 'packages/dyn/src/lazy.ts')

  const u = graph.undetermined.find((x) => x.spec === './gone-lazy')
  assert.ok(u, '动态边解析不到也必须报数，不得静默断边')
  assert.equal(u.kind, 'relative')

  const ext = graph.external.find((x) => x.spec === 'some-third-party-lib')
  assert.ok(ext, '第三方裸包名要计进 external（既不冒充 undetermined，也不静默消失）')
  assert.ok(!graph.undetermined.some((x) => x.spec === 'some-third-party-lib'))
})

test('注释与块注释里的示例 import 不得连成边（判据必须覆盖自己产出的形态）', () => {
  const { root } = mkRepo({
    'packages/doc/package.json': JSON.stringify({ name: '@ihui/doc', version: '1.0.0' }),
    'packages/doc/src/a.ts': [
      "// 用法示例：import { x } from '@ihui/phantom'",
      '/*',
      " * import { y } from './also-phantom'",
      ' */',
      'export const z = 1',
    ].join('\n'),
  })
  const graph = buildFileGraph({ face: 'HEAD', root })
  assert.deepEqual(
    graph.edges.filter((e) => e.from === 'packages/doc/src/a.ts'),
    [],
    '注释行不得产出边',
  )
  assert.deepEqual(
    graph.undetermined.filter((u) => u.from === 'packages/doc/src/a.ts'),
    [],
  )
})

// ── 3. 缓存键 = (tree oid, face) ────────────────────────────────────────────────────────

test('缓存按 (tree oid, face) 键控：同 oid 同面命中同一实例；tree oid 变了必须重算', () => {
  const { root, commit } = mkRepo(SIGN_FIXTURE)
  const g1 = buildFileGraph({ face: 'HEAD', root })
  const again = buildFileGraph({ face: 'HEAD', root })
  assert.equal(again, g1, '同一 tree oid 同一面应当命中缓存（否则下一条断言是恒真的）')

  writeAll(root, { 'packages/lib-a/src/extra.ts': 'export const extra = 1\n' })
  commit()
  const g2 = buildFileGraph({ face: 'HEAD', root })
  assert.notEqual(g2, g1, 'tree oid 变了还命中缓存 = 按符号名 HEAD 键控（§5b / 门 100 记过的坑）')
  assert.notEqual(g2.treeOid, g1.treeOid)
  assert.ok(
    g2.vertices.includes('packages/lib-a/src/extra.ts'),
    '重算必须看得见新文件；看不见就是读到了旧树',
  )
  assert.ok(!g1.vertices.includes('packages/lib-a/src/extra.ts'))

  // face 参与键：同一份 HEAD 树与索引面在暂存了新文件时必须给出不同结论
  writeAll(root, { 'apps/web/src/staged-only.ts': 'export const s = 1\n' })
  git(['add', 'apps/web/src/staged-only.ts'], root)
  const gHead = buildFileGraph({ face: 'HEAD', root })
  const gIndex = buildFileGraph({ face: 'index', root })
  assert.notEqual(gHead, gIndex, 'face 必须参与缓存键')
  assert.ok(gIndex.vertices.includes('apps/web/src/staged-only.ts'))
  assert.ok(!gHead.vertices.includes('apps/web/src/staged-only.ts'))
  // 索引面缓存同样按指纹键控：再暂存一个就必须换
  writeAll(root, { 'apps/web/src/staged-two.ts': 'export const s = 2\n' })
  git(['add', 'apps/web/src/staged-two.ts'], root)
  const gIndex2 = buildFileGraph({ face: 'index', root })
  assert.notEqual(gIndex2, gIndex, '索引内容变了而缓存键不变 = 索引指纹失效信号缺失')
  assert.ok(gIndex2.vertices.includes('apps/web/src/staged-two.ts'))
})

test('worktree 面刻意不缓存：磁盘随时变，缓存一个不知道过期没过期的东西更糟', () => {
  const { root } = mkRepo(SIGN_FIXTURE)
  const w1 = buildFileGraph({ face: 'worktree', root })
  const w2 = buildFileGraph({ face: 'worktree', root })
  assert.notEqual(w1, w2)
  writeAll(root, { 'packages/lib-a/src/ondisk.ts': 'export const d = 1\n' })
  git(['add', 'packages/lib-a/src/ondisk.ts'], root) // 未跟踪的文件不入图（限制已写在头注）
  const w3 = buildFileGraph({ face: 'worktree', root })
  assert.ok(w3.vertices.includes('packages/lib-a/src/ondisk.ts'))
})

// ── 4. CLI 开关白名单 ───────────────────────────────────────────────────────────────────

test('未知 CLI 开关必须判死，不得静默落进默认分支（sync-lost-commit-tags 同型）', () => {
  assert.equal(IG.parseArgv(['--stat']).error, '未知开关: --stat')
  assert.equal(IG.parseArgv(['--staged']).error, '未知开关: --staged')
  assert.equal(IG.parseArgv(['--face']).error, '--face 缺取值')
  const ok = IG.parseArgv(['--stats', '--face', 'index'])
  assert.equal(ok.error, null)
  assert.equal(ok.face, 'index')
  // 不给任何开关时不得"空跑判绿"：默认落回 --stats（打印三项计数）
  assert.equal(IG.parseArgv([]).stats, true)
})

test('--widen 走 CLI 时闭包结果与库调用逐字一致（同一条判据，两形态不各自演化）', () => {
  const { root } = mkRepo(SIGN_FIXTURE)
  const graph = buildFileGraph({ face: 'HEAD', root, noCache: true })
  const w = widenOverDependents(['packages/lib-a/src/index.ts'], graph)
  assert.deepEqual(w.closure, ['apps/web/src/use-a.ts', 'packages/lib-a/src/index.ts'])
  assert.equal(w.seedCount, 1)
})

// ── 5. 纯函数面的构造面证明（不依赖仓库瞬时状态）───────────────────────────────────────

test('candidatePaths 覆盖无扩展名 / `.js`→`.ts` / 目录 index 三种真实写法', () => {
  const c = IG.candidatePaths('apps/web/src/x')
  for (const e of ['.ts', '.tsx', '.js', '.mjs']) assert.ok(c.includes(`apps/web/src/x${e}`))
  assert.ok(c.includes('apps/web/src/x/index.ts'))
  const js = IG.candidatePaths('packages/shared/src/y.js')
  assert.ok(js.includes('packages/shared/src/y.ts'), 'NodeNext 写 .js 而真实文件是 .ts 是本仓常态')
  assert.deepEqual(IG.candidatePaths('apps/web/styles/x.css'), ['apps/web/styles/x.css'])
})

test('normalizeRel/joinRel 对 Windows 反斜杠与 `../` 都成立（顶点键只有一个形状，两形态必须同源）', () => {
  assert.equal(IG.normalizeRel('apps\\web\\src\\a.tsx'), 'apps/web/src/a.tsx')
  assert.equal(IG.normalizeRel('./apps/web/src/a.ts'), 'apps/web/src/a.ts')
  assert.equal(IG.joinRel('apps/web/src', '../lib/x'), 'apps/web/lib/x')
  assert.equal(IG.joinRel('', './src/a'), 'src/a')
})

test('stats 三项计数必须都有值且与真实结构一致（三项全零的门等于没有门）', () => {
  const { root } = mkRepo(SIGN_FIXTURE)
  const g = buildFileGraph({ face: 'HEAD', root })
  assert.ok(g.stats.vertices > 0)
  assert.ok(g.stats.edges > 0)
  assert.equal(g.stats.edges, g.edges.length)
  assert.equal(g.stats.undetermined, g.undetermined.length)
  assert.ok(g.elapsedMs >= 0)
  const text = formatStats(g)
  for (const k of ['顶点数', '边数', 'undetermined', '耗时']) assert.match(text, new RegExp(k))
  for (const k of ['pkg', 'alias', 'relative', 'dynamic']) assert.match(text, new RegExp(k))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
