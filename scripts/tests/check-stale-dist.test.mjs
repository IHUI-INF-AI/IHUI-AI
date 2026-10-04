// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 `scripts/check-stale-dist.mjs` 的 §22c 镜像测试(2026-09-28 整文件重写)。
 *
 * 为什么整文件重写:旧夹具靠 `spawnSync(cwd=临时目录)` 定位,而脚本自 §15 起 **ROOT 由自身
 * 位置推导、忽略 cwd** —— 于是 15 例里绝大多数其实在审真仓(守门 70 的"13/14 恒红"同型,
 * 本文件此前是"全绿但与夹具无关")。现走显式 `--root` 测试通道 + 真 git 临时仓。
 *
 * 判据函数一律 `import { __test__ } from '../check-stale-dist.mjs'` 直取源实现 ——
 * 禁止在本文件复制一份(§22c:镜像常量漂移 = 测试从防线变成缺陷的掩体)。
 *
 * 成对性纪律:每条"命中"必配一条"同形不命中"的反向对照;每条"新增判红"必配
 * 一条"存量不拦"与"取不到≠通过"的方向锁。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ } from '../check-stale-dist.mjs'

const GATE = fileURLToPath(new URL('../check-stale-dist.mjs', import.meta.url))
const RUNNER = fileURLToPath(new URL('../guardian-runner.mjs', import.meta.url))
const GIT = resolveGitBin() || 'git'
const ANSI_RE = /\x1b\[[0-9;]*m/g

const runGit = (dir, args) =>
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-C', dir, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
  })

function runGate(root, flags = []) {
  const r = spawnSync(process.execPath, [GATE, '--root', root, ...flags], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  return {
    rc: r.status,
    out: String(r.stdout || '').replace(ANSI_RE, '') + String(r.stderr || '').replace(ANSI_RE, ''),
  }
}

/** 真 git 临时仓:mkScratch(§26 落点,不往 os.tmpdir 写),init+首枚 commit ⇒ HEAD 存在。 */
function makeRepo(prefix) {
  const root = mkScratch(prefix)
  runGit(root, ['init', '-q'])
  writeFileSync(join(root, 'README.md'), 'fixture\n')
  runGit(root, ['add', '-A'])
  runGit(root, ['commit', '-q', '-m', 'base'])
  return root
}
function commitAll(root) {
  runGit(root, ['add', '-A'])
  runGit(root, ['commit', '-q', '-m', 'x'])
}
function stageAll(root) {
  runGit(root, ['add', '-A'])
}
function wf(p, text) {
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, text)
}

/**
 * 档 a 夹具包:清单 main/types 都走 dist,src/index.ts 是 wildcard(旧判据整片跳过的那一型),
 * 声明定义在 src/a.ts,产物在 dist/a.d.ts。基线状态两侧同形(0 落后)。
 */
function addDeclaredPkg(root, mutated) {
  const pkgRoot = join(root, 'packages', 'fxa')
  wf(
    join(pkgRoot, 'package.json'),
    JSON.stringify({
      name: '@ihui/fxa',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
      scripts: { build: 'tsc' },
    }),
  )
  wf(join(pkgRoot, 'src', 'index.ts'), "export * from './a.js'\n")
  wf(
    join(pkgRoot, 'src', 'a.ts'),
    mutated
      ? 'export interface Thing { a: string\n  b: number\n}\nexport const fn = 1\nexport const fn2 = 2\n'
      : 'export interface Thing { a: string\n}\nexport const fn = 1\n',
  )
  wf(join(pkgRoot, 'dist', 'index.js'), "export * from './a.js';\n")
  wf(join(pkgRoot, 'dist', 'index.d.ts'), "export * from './a.js';\n")
  wf(join(pkgRoot, 'dist', 'a.d.ts'), 'export interface Thing { a: string }\nexport declare const fn: 1;\n')
}

/** 档 b 夹具包:清单全指 src(旧判据"从源码消费"整片跳过的那一型),dist 里有陈旧的 .d.ts。 */
function addSrcConsumedPkg(root, mutated) {
  const pkgRoot = join(root, 'packages', 'fxb')
  wf(
    join(pkgRoot, 'package.json'),
    JSON.stringify({
      name: '@ihui/fxb',
      main: './src/index.ts',
      types: './src/index.ts',
      exports: { '.': { types: './src/index.ts', import: './src/index.ts' } },
      scripts: { build: 'tsc' },
    }),
  )
  wf(
    join(pkgRoot, 'src', 'index.ts'),
    mutated
      ? 'export interface Card { title: string\n  subtitle?: string\n}\nexport const x = 1\n'
      : 'export interface Card { title: string\n}\nexport const x = 1\n',
  )
  wf(
    join(pkgRoot, 'dist', 'index.d.ts'),
    'export interface Card { title: string }\nexport declare const x: 1;\n',
  )
}

// ───────────────────────── 一、装车证明与取材纪律(反向锁)─────────────────────────

test('T1 装车证明:guardian-runner 必须真有本门条目,且 mode=blocking', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const at = src.indexOf("script: 'check-stale-dist.mjs'")
  assert.ok(at >= 0, '本门不在 guardian-runner 注册表里 ⇒ "门存在而无人调度"')
  const entry = src.slice(Math.max(0, at - 400), at + 400)
  assert.match(entry, /mode: 'blocking'/, '本门条目必须仍 blocking')
})

test('T2 反向锁:mtime 一条都不许出现在判据里(恒红门成因,§12e)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.doesNotMatch(src, /mtimeMs|\.mtime\b|statSync/, '判据不得读 mtime —— git 不保存 mtime,干净机上会全片红')
})

test('T3 反向锁:遮罩只有 lib/code-mask.mjs 一份实现,本门不得自带第二份(§22c 两处必漂移)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/, '必须 import 唯一遮罩实现')
  assert.doesNotMatch(src, /function\s+maskCommentsAndStrings/, '不得在门内复制遮罩函数')
})

test('T4 反向锁:D 维判据必须真接在 main 上(函数写了没人调 = 一路绿灯,守门 70/76/81 同型)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /const decl = runDeclarationDimension\(/, 'main() 必须调用 D 维')
  assert.match(src, /allReds = \[\.\.\.stale, \.\.\.decl\.reds\]/, 'D 维红项必须参与退出码')
  assert.match(src, /faceSel\.error/, '两面旗同给必须经 selectFace 的 error 出口判死')
})

test('T5 §22c:源 export 锚点必须齐,缺一条即"镜像漂移"', () => {
  for (const k of [
    'extractTypeDeclarations',
    'aggregateDeclarations',
    'diffDeclarations',
    'declarationLagItems',
    'subtractLagItems',
    'typesPointToDist',
    'listDistDts',
    'srcFilesForDir',
    'setRoot',
  ]) {
    assert.equal(typeof __test__[k], 'function', `__test__ 缺导出:${k}`)
  }
})

// ───────────────────────── 二、纯函数成对用例(构造面)─────────────────────────

const agg = (t) => __test__.aggregateDeclarations([{ label: 'x.ts', text: t }])

test('D1 接口字段落后:正向点名 + 反向不误伤', () => {
  const src = agg('export interface Msg { id: string; newerField: number }')
  const dist = agg('export interface Msg { id: string }')
  const items = __test__.declarationLagItems(__test__.diffDeclarations(src.agg, dist.agg))
  assert.equal(items.size, 1, '同行 `;` 分隔与换行分隔必须同判(排版差异不是落后)')
  assert.ok(items.has('Msg.newerField'))
  assert.equal(__test__.lagScore(__test__.declarationLagItems(__test__.diffDeclarations(dist.agg, dist.agg))), 0)
})

test('D2 声明名缺失 ⇒ 点名;type 别名只比名在场', () => {
  const src = agg("export interface Ghost { a: string }\nexport type Alias = { b: number }")
  const dist = agg('export interface Unrelated { c: string }')
  const items = __test__.declarationLagItems(__test__.diffDeclarations(src.agg, dist.agg))
  assert.ok(items.has('Ghost') && items.has('Alias') && !items.has('Alias.b'))
})

test('D3/D4 遮罩方向双锁:注释与字符串里的声明形态不得入账,花括号不得被打断', () => {
  const a = agg('// export interface GhostComment { b: 1 }\n/* export interface BlockGhost { c: 1 } */\nexport interface Real { d: 1 }')
  assert.ok(!a.agg.has('GhostComment') && !a.agg.has('BlockGhost') && a.agg.has('Real'))
  const b = agg('export interface S { t: string\n}\nconst noise = "} export interface StrGhost { a: 1 }"')
  assert.ok(!b.agg.has('StrGhost') && b.agg.has('S') && b.issues.length === 0)
})

test('D5 type 别名 RHS 窗口不得吞后续声明(立项实测假阳回归,头注写明的两型之一)', () => {
  const a = agg("export type Level = 'low' | 'high'\nconst TAB = { low: 1, high: 2 }\nexport interface Tail { z: number }")
  assert.equal(a.agg.get('Level').size, 0)
  assert.ok(a.agg.has('Tail'))
})

test('D6 re-export 名单两侧同形 ⇒ 零落后;空 export {} 不产幽灵名', () => {
  const src = agg("export { type Foo } from './f'\nexport { bar as renamed } from './b'")
  const dist = agg("export { Foo } from './f.js';\nexport { renamed } from './b.js';")
  assert.equal(__test__.lagScore(__test__.declarationLagItems(__test__.diffDeclarations(src.agg, dist.agg))), 0)
  assert.equal(agg('export {};\n').agg.size, 0)
})

test('D7 class/namespace 不比成员(private 两侧不同形)、body 不 descent', () => {
  const src = agg('export class C { private secret: string\n  constructor() {} }')
  const dist = agg('export declare class C {\n    private secret;\n    constructor();\n}')
  const d = __test__.diffDeclarations(src.agg, dist.agg)
  assert.equal(__test__.lagScore(__test__.declarationLagItems(d)), 0)
  assert.equal(d.missingNames.length, 0)
  const n1 = agg('export namespace N { export interface M { a: number } }')
  const n2 = agg('export declare namespace N {\n    interface M {\n        a: number;\n    }\n}')
  assert.ok(!n1.agg.has('M') && !n2.agg.has('M') && n1.agg.has('N') && n2.agg.has('N'))
})

test('D8 清单分类三态:子路径 types→dist ⇒ a 档;全 src ⇒ b 档;pattern 单列', () => {
  const a = __test__.typesPointToDist({ types: './src/index.ts', exports: { './sub': { types: './dist/sub.d.ts' } } })
  assert.ok(a.declared && a.distPaths.length === 1)
  const b = __test__.typesPointToDist({ main: './src/index.ts', types: './src/index.ts', exports: { '.': { types: './src/index.ts' } } })
  assert.equal(b.declared, false)
  const p = __test__.typesPointToDist({ exports: { './*': { types: './dist/*.d.ts' } } })
  assert.ok(p.declared && p.patterns.length === 1 && p.distPaths.length === 0)
})

test('D10 extras 方向:dist 残留多出声明 ⇒ 不算落后,只计数', () => {
  const src = agg('export interface A { x: 1 }')
  const dist = agg('export interface A { x: 1 }\nexport interface ExtraOnly { y: 2 }')
  const d = __test__.diffDeclarations(src.agg, dist.agg)
  assert.equal(__test__.lagScore(__test__.declarationLagItems(d)), 0)
  assert.equal(d.extrasNameCount, 1)
})

test('D11 内容取不到 ≠ 没有声明:必须报名,不得静默跳过(把没判写成判过了 = 最高频失效型)', () => {
  const a = __test__.aggregateDeclarations([
    { label: 'missing.ts', text: null },
    { label: 'ok.ts', text: 'export interface K { a: 1 }' },
  ])
  assert.equal(a.issues.length, 1)
  assert.ok(a.agg.has('K'))
})

test('D12 棘轮方向锁:被审面 ⊃ 锚 ⇒ 只新增判红;被审面 == 锚 ⇒ 新增集必空', () => {
  const anchor = new Set(['Old.a', 'Old.b'])
  const audited = new Set(['Old.a', 'Old.b', 'NewField.c'])
  const pure = __test__.subtractLagItems(audited, anchor)
  assert.equal(pure.size, 1)
  assert.ok(pure.has('NewField.c'))
  assert.equal(__test__.subtractLagItems(anchor, anchor).size, 0)
})

test('D13 src 枚举口径:测试面不进射程;src 的 .d.ts 进;dist 目录绝不进(产物与自己比 = 恒绿)', () => {
  const rels = __test__.srcFilesForDir(
    [
      'packages/p/src/index.ts',
      'packages/p/src/a.test.ts',
      'packages/p/src/__tests__/b.ts',
      'packages/p/tests/c.ts',
      'packages/p/src/types.d.ts',
      'packages/p/src/ui.tsx',
      'packages/p/dist/index.d.ts',
    ],
    'packages/p',
  )
  assert.ok(rels.includes('packages/p/src/index.ts'))
  assert.ok(rels.includes('packages/p/src/types.d.ts'))
  assert.ok(rels.includes('packages/p/src/ui.tsx'))
  assert.ok(!rels.includes('packages/p/src/a.test.ts'))
  assert.ok(!rels.includes('packages/p/src/__tests__/b.ts'))
  assert.ok(!rels.includes('packages/p/tests/c.ts'))
  assert.ok(!rels.includes('packages/p/dist/index.d.ts'))
})

// ───────────────────────── 三、端到端(真 git 临时仓 + --root 通道)─────────────────────────

test('E1 基线:同形夹具三面全绿,且 wildcard/src-consumed 两型都有 D 维行(不再整片跳过)', () => {
  const root = makeRepo('stale-dist-e1-')
  try {
    addDeclaredPkg(root, false)
    addSrcConsumedPkg(root, false)
    commitAll(root)
    for (const flags of [[], ['--staged'], ['--worktree']]) {
      const r = runGate(root, flags)
      assert.equal(r.rc, 0, `${flags} 基线应绿:${r.out}`)
    }
    const r = runGate(root)
    assert.match(r.out, /@ihui\/fxa \[档a/)
    assert.match(r.out, /@ihui\/fxb \[档b/)
    assert.match(r.out, /✓ 所有 dist 与源码同步,无陈旧问题。/)
    // 票面点名的两条旧 skip 行都仍指向 D 维(整片跳过被收编,而非改文案)
    assert.match(r.out, /skip: wildcard re-export.*声明对账见 D 维/)
    assert.match(r.out, /从源码消费.*声明对账见 D 维/)
  } finally {
    rmScratch(root)
  }
})

test('E2 有牙证明(索引档):改 src 加字段+新 export 并 git add(不 commit)⇒ --staged 必红且点名', () => {
  const root = makeRepo('stale-dist-e2-')
  try {
    addDeclaredPkg(root, false)
    commitAll(root)
    addDeclaredPkg(root, true) // 重写 src/a.ts:Thing 加字段 b、新 export fn2
    stageAll(root)
    const r = runGate(root, ['--staged'])
    assert.equal(r.rc, 1, `staged 新增落后应红:${r.out}`)
    assert.match(r.out, /@ihui\/fxa/)
    assert.match(r.out, /Thing\.b/)
    // fn2 是 value export 名:index.ts 未改 ⇒ V 维看不见;D 维按"声明名在场"把它也点名了
    // (wildcard 包正是靠这一维补上 value 名的在场性 —— 票面第一型的实证路径)
    assert.match(r.out, /声明产物落后于源码/)
    assert.match(r.out, /fn2/)
    // 方向锁:改动只进了索引、未进 HEAD ⇒ 锚面(HEAD)必须判绿,且不得把 Thing.b 算进落后集。
    // 若这条变红,说明 D 维读错了面(把磁盘/索引当 HEAD)—— 那正是一台基准错位的尺子。
    const h = runGate(root)
    assert.equal(h.rc, 0, `HEAD 面判的是 HEAD 内容(改动未入库),应绿:${h.out}`)
    assert.ok(!h.out.includes('Thing.b'), 'HEAD 面不得把未入库的索引改动算进落后集')
  } finally {
    rmScratch(root)
  }
})

test('E3 有牙证明(磁盘档):工作树脏而未 add ⇒ --worktree 红、--staged 绿(面纪律:别人的在飞现场不顶红本次)', () => {
  const root = makeRepo('stale-dist-e3-')
  try {
    addDeclaredPkg(root, false)
    commitAll(root)
    addDeclaredPkg(root, true) // 只改磁盘,不 stage
    const w = runGate(root, ['--worktree'])
    assert.equal(w.rc, 1, `worktree 面应红:${w.out}`)
    assert.match(w.out, /Thing\.b/)
    const s = runGate(root, ['--staged'])
    assert.equal(s.rc, 0, `索引未含该改动时 staged 面不得判红(§12 在飞现场):${s.out}`)
  } finally {
    rmScratch(root)
  }
})

test('E4 棘轮:改动已入库(锚==被审面)⇒ --staged 不拦,但账面必须喊"不是同步合格证"', () => {
  const root = makeRepo('stale-dist-e4-')
  try {
    addDeclaredPkg(root, false)
    commitAll(root)
    addDeclaredPkg(root, true)
    commitAll(root) // 落后进了 HEAD ⇒ 锚里也有:存量不拦与它无关的提交(§12e)
    const s = runGate(root, ['--staged'])
    assert.equal(s.rc, 0, `存量应只报数:${s.out}`)
    assert.match(s.out, /存量/)
    assert.doesNotMatch(s.out, /✓ 所有 dist 与源码同步/, "有存量落后时不得打印'全部同步'字样冒充合格证")
  } finally {
    rmScratch(root)
  }
})

test('E5 dist 取不到 ⇒ 判"无法判定",既不冒红也不记绿;--strict 拒绝出合格证(exit 2)', () => {
  const root = makeRepo('stale-dist-e5-')
  try {
    const pkgRoot = join(root, 'packages', 'fxm')
    wf(
      join(pkgRoot, 'package.json'),
      JSON.stringify({
        name: '@ihui/fxm',
        main: './src/index.ts', // V 维跳过(从源码消费)—— 让"取不到"只由 D 维说话
        types: './dist/index.d.ts', // 而声明入口指 dist ⇒ 档 a
        scripts: { build: 'tsc' },
      }),
    )
    wf(join(pkgRoot, 'src', 'index.ts'), 'export interface M { a: string }\n')
    commitAll(root) // 没有 dist:本机从未构建 ⇒ 无从对账
    const r = runGate(root)
    assert.equal(r.rc, 0, `取不到不得冒红:${r.out}`)
    assert.match(r.out, /无法判定/)
    assert.match(r.out, /@ihui\/fxm/)
    assert.doesNotMatch(r.out, /✓ 所有 dist 与源码同步/)
    const st = runGate(root, ['--strict'])
    assert.equal(st.rc, 2, '--strict 下有未判定应 exit 2(拒绝出合格证)')
  } finally {
    rmScratch(root)
  }
})

test('E6 档 b(清单声明全指 src)有落后 ⇒ 校验、报名、给修复出口,但不判红', () => {
  const root = makeRepo('stale-dist-e6-')
  try {
    addSrcConsumedPkg(root, false)
    commitAll(root)
    // 把 src 写出 subtitle 字段而 dist/index.d.ts 停留旧形态(真仓 @ihui/shared 同型)
    wf(join(root, 'packages', 'fxb', 'src', 'index.ts'), 'export interface Card { title: string\n  subtitle?: string\n}\nexport const x = 1\n')
    commitAll(root)
    const r = runGate(root)
    assert.equal(r.rc, 0, `档 b 不判红:${r.out}`)
    assert.match(r.out, /只报数/)
    assert.match(r.out, /Card\.subtitle/)
    assert.match(r.out, /pnpm --filter @ihui\/fxb build/)
  } finally {
    rmScratch(root)
  }
})

test('E7 枚举到 0 判死(不得把"0 个包"读成"全部同步")与两面旗同给判死', () => {
  const root = makeRepo('stale-dist-e7-')
  try {
    const r = runGate(root)
    assert.equal(r.rc, 2, `空枚举必须判死:${r.out}`)
    assert.match(r.out, /枚举到 0/)
    const both = runGate(root, ['--staged', '--worktree'])
    assert.equal(both.rc, 2)
    assert.match(both.out, /不得同用|互斥/)
  } finally {
    rmScratch(root)
  }
})

test('E8 V 维原有行为不回退:value export 落后仍点名 + 修复命令', () => {
  const root = makeRepo('stale-dist-e8-')
  try {
    const pkgRoot = join(root, 'packages', 'fxv')
    wf(
      join(pkgRoot, 'package.json'),
      JSON.stringify({ name: '@ihui/fxv', main: './dist/index.js', scripts: { build: 'tsc' } }),
    )
    wf(join(pkgRoot, 'src', 'index.ts'), 'export const a = 1\nexport const b = 2\n')
    wf(join(pkgRoot, 'dist', 'index.js'), 'export const a = 1;\n')
    commitAll(root)
    const r = runGate(root)
    assert.equal(r.rc, 1)
    assert.match(r.out, /dist 缺失 export: b/)
    assert.match(r.out, /pnpm --filter @ihui\/fxv build/)
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
