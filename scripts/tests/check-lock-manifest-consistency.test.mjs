// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:直接 import 源脚本的 __test__,禁止在测试里复制一份实现。
// 夹具一律在 mkScratch 临时目录构造并显式 --root 传入,绝不扫真仓
// (守门 70 教训:测试靠 cwd 定位夹具而脚本忽略 cwd,14 例全在扫真仓)。
//
// 判定面(2026-09-24 收口)的本仓既有口径:--staged 判索引 blob、全量判 HEAD blob,
// 两者都**不判滞后的共享工作树**。T16~T20 就是在临时 git 仓里对"面选择本身"取证:
// 索引坏 / 盘对 ⇒ 必须红(钉假绿);索引对 / 盘是别人的半编辑态 ⇒ 必须绿(钉假红);
// 该面取不到 ⇒ 必须 exit 2 并点名路径(钉"取不到就跳过再报绿")。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-lock-manifest-consistency.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(HERE, '..', 'check-lock-manifest-consistency.mjs')

const LOCK = gate.lockWith(gate.ACCIDENT_DEPS_BLOCK)
/** 今天卡死生产构建的那一对不一致声明(manifest 写 ^0.18.5,lock 记 npm:@e965/xlsx@^0.20.3) */
const BROKEN_WEB = { dependencies: { xlsx: '^0.18.5', '@ihui/shared': 'workspace:*' } }
const WEB_PKG_REL = join('apps', 'web', 'package.json')

function fixtureWebPkg(overrides) {
  return {
    dependencies: { xlsx: 'npm:@e965/xlsx@^0.20.3', '@ihui/shared': 'workspace:*' },
    ...overrides,
  }
}

/** CLI 通道:返回 {code,out},out 合流 stdout+stderr(无法判定的原因行走 stderr) */
function runCLI(args) {
  try {
    return {
      code: 0,
      out: execFileSync(process.execPath, [SCRIPT, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      }),
    }
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

/** 把夹具写成磁盘上的另一份 package.json(模拟"索引之后又改了盘") */
function overwriteWebPkg(dir, pkg) {
  rmSync(join(dir, WEB_PKG_REL), { force: true })
  gate.makeFixture(dir, { webPkg: pkg, lock: LOCK })
}

test('T1 事故形态(specifier 不一致)判红,点名 xlsx', () => {
  const s = mkScratch('lmci-t1')
  try {
    const dir = gate.makeFixture(join(s, 'p'), {
      webPkg: { dependencies: { xlsx: '^0.18.5', '@ihui/shared': 'workspace:*' } },
      lock: LOCK,
    })
    const r = gate.runCheck(dir)
    assert.equal(r.undetermined, null)
    assert.equal(r.violations.length, 1)
    assert.equal(r.violations[0].kind, 'mismatch')
    assert.equal(r.violations[0].name, 'xlsx')
    assert.equal(r.violations[0].pkg, 'apps/web')
  } finally {
    rmScratch(s)
  }
})

test('T2 反向对照:声明与 lock 逐字一致必绿', () => {
  const s = mkScratch('lmci-t2')
  try {
    const dir = gate.makeFixture(join(s, 'p'), { webPkg: fixtureWebPkg(), lock: LOCK })
    const r = gate.runCheck(dir)
    assert.equal(r.violations.length, 0)
  } finally {
    rmScratch(s)
  }
})

test('T3 声明了而 lock 缺条目判红;孤儿记账不判红但如实报数', () => {
  const s = mkScratch('lmci-t3')
  try {
    const missing = gate.makeFixture(join(s, 'm'), {
      webPkg: fixtureWebPkg({
        dependencies: {
          xlsx: 'npm:@e965/xlsx@^0.20.3',
          '@ihui/shared': 'workspace:*',
          'docx-preview': '^0.3.5',
        },
      }),
      lock: LOCK,
    })
    const rm = gate.runCheck(missing)
    assert.equal(rm.violations.length, 1)
    assert.equal(rm.violations[0].kind, 'missing')
    const orphan = gate.makeFixture(join(s, 'o'), { webPkg: fixtureWebPkg(), lock: LOCK })
    const ro = gate.runCheck(orphan)
    assert.equal(ro.violations.length, 0)
    assert.ok(ro.orphans.some((o) => o.name === 'jszip'))
  } finally {
    rmScratch(s)
  }
})

test('T4 workspace: 协议参与比对(漂移即红,一致即绿)', () => {
  const s = mkScratch('lmci-t4')
  try {
    const drift = gate.makeFixture(join(s, 'd'), {
      webPkg: { dependencies: { xlsx: 'npm:@e965/xlsx@^0.20.3', '@ihui/shared': 'workspace:^' } },
      lock: LOCK,
    })
    assert.equal(gate.runCheck(drift).violations.length, 1)
    const ok = gate.makeFixture(join(s, 'k'), { webPkg: fixtureWebPkg(), lock: LOCK })
    assert.equal(gate.runCheck(ok).violations.length, 0)
  } finally {
    rmScratch(s)
  }
})

test('T5 结构不认识 → undetermined,不产出任何"通过"结论', () => {
  const s = mkScratch('lmci-t5')
  try {
    const dir = gate.makeFixture(join(s, 'n'), {
      webPkg: fixtureWebPkg(),
      lock: "lockfileVersion: '9.0'\n\npackages:\n\n  foo@1.0.0: {}\n",
    })
    const r = gate.runCheck(dir)
    assert.ok(typeof r.undetermined === 'string' && r.undetermined.length > 0)
    assert.equal(r.packagesScanned, 0)
    assert.equal(r.violations.length, 0)
  } finally {
    rmScratch(s)
  }
})

test('T6 CLI 退出码:0 绿 / 1 违规 / 2 无法判定(--root 测试通道 + --worktree 判磁盘夹具)', () => {
  const s = mkScratch('lmci-t6')
  try {
    const green = gate.makeFixture(join(s, 'g'), { webPkg: fixtureWebPkg(), lock: LOCK })
    assert.equal(runCLI(['--all', '--worktree', '--root', green]).code, 0)
    const red = gate.makeFixture(join(s, 'r'), { webPkg: BROKEN_WEB, lock: LOCK })
    assert.equal(runCLI(['--all', '--worktree', '--root', red]).code, 1)
    const unknown = gate.makeFixture(join(s, 'u'), {
      webPkg: fixtureWebPkg(),
      lock: "lockfileVersion: '9.0'\n\npackages:\n",
    })
    const u = runCLI(['--all', '--worktree', '--root', unknown])
    assert.equal(u.code, 2)
    assert.match(u.out, /无法判定/)
  } finally {
    rmScratch(s)
  }
})

test('T7 §22c 装车锚点:源脚本必须 export __test__ 且测试必须直接 import(禁止镜像复制)', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /export const __test__ = \{/)
  for (const key of [
    'parseLockImporters',
    'compareDeclarations',
    'runCheck',
    'parseWorkspaceGlobs',
    'discoverPackages',
    // 维度 A / B 的核心函数不得只活在文件内部(§22c:测试要能直接调用)
    'parseWorkspaceOverrides',
    'splitOverrideKey',
    'matchOverrideTargets',
    'isRegistryRange',
    // 判定面本身也必须是可调用出口,否则"面选择"只能在测试里另写一份实现
    'makeFaceReader',
    'resolveFace',
    'catBatch',
    'gitifyFixture',
    'gitInFixture',
  ]) {
    assert.ok(src.includes(`${key},`) || src.includes(`${key}:`), `__test__ 缺少导出键 ${key}`)
  }
  const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(
    testSrc,
    /import\s*\{\s*__test__\s*as\s+\w+\s*\}\s*from\s*'\.\.\/check-lock-manifest-consistency\.mjs'/,
  )
  assert.match(
    src,
    /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/,
  )
  assert.match(src, /if \(isDirectRun\) \{/)
  // __test__ 的 export 必须在 isDirectRun 守卫之后(§22d 位置约束)
  assert.ok(src.indexOf('if (isDirectRun) {') < src.indexOf('export const __test__ = {'))
})

test('T8 判定面必须写在输出首行:--staged 报索引面、缺省报 HEAD 面、--worktree 才报磁盘', () => {
  const s = mkScratch('lmci-t8')
  try {
    const dir = gate.gitifyFixture(
      gate.makeFixture(join(s, 'repo'), { webPkg: fixtureWebPkg(), lock: LOCK }),
    )
    const staged = runCLI(['--staged', '--root', dir])
    assert.equal(staged.code, 0)
    assert.match(staged.out, /判定面: 索引 blob/)
    // 这正是改造前骗人的那一行:--staged 绝不得再声明"判定面: 工作树"
    assert.doesNotMatch(staged.out, /判定面: 工作树/)
    const head = runCLI(['--head', '--root', dir])
    assert.match(head.out, /判定面: HEAD blob/)
    const wt = runCLI(['--worktree', '--root', dir])
    assert.match(wt.out, /判定面: 工作树\(磁盘\)/)
    const dflt = runCLI(['--root', dir])
    assert.match(dflt.out, /判定面: HEAD blob/)
  } finally {
    rmScratch(s)
  }
})

/* ===================== 维度 A:overrides 参与比对(R4) ===================== */

test('T9 维度 A 放过真仓两种 override 键形态,并如实计入 overrideExempted', () => {
  const s = mkScratch('lmci-t9')
  try {
    const dir = gate.makeFixture(join(s, 'p'), {
      webPkg: { devDependencies: { '@types/react': '^19.0.0', postcss: '^8.4.49' } },
      lock: gate.lockFrom({ devDependencies: { '@types/react': '19.2.18', postcss: '^8.5.23' } }),
      workspace: gate.wsWithOverrides(["  '@types/react': 19.2.18", '  postcss@<=8.5.22: ^8.5.23']),
    })
    const r = gate.runCheck(dir)
    assert.equal(r.undetermined, null)
    assert.deepEqual(r.violations, [])
    assert.equal(r.overrideExempted.length, 2)
    assert.equal(r.overridesLoaded, 2)
    // 放过必须点名到具体是哪条 override key,否则无法审计
    assert.deepEqual(r.overrideExempted.map((x) => x.overrideKeys[0]).sort(), [
      '@types/react',
      'postcss@<=8.5.22',
    ])
  } finally {
    rmScratch(s)
  }
})

test('T10 反向对照(防"命中 override 就不判"的阉割):被 override 的依赖两侧都不等于目标必红', () => {
  const s = mkScratch('lmci-t10')
  const ws = gate.wsWithOverrides(['  lodash-es: 9.9.9', '  webpack: 5.99.0'])
  try {
    const third = gate.makeFixture(join(s, 'third'), {
      webPkg: { dependencies: { 'lodash-es': '^1.2.0' } },
      lock: gate.lockFrom({ dependencies: { 'lodash-es': '^7.7.7' } }),
      workspace: ws,
    })
    const rt = gate.runCheck(third)
    assert.equal(rt.violations.length, 1)
    assert.equal(rt.violations[0].kind, 'mismatch')
    assert.deepEqual(rt.violations[0].overrideTargets, ['9.9.9'])
    // lock 被手改回 manifest 原值:裸名 override 必然落进 lock,所以这也必红
    const stale = gate.makeFixture(join(s, 'stale'), {
      webPkg: { dependencies: { webpack: '^5.10.0' } },
      lock: gate.lockFrom({ dependencies: { webpack: '^5.10.0' } }),
      workspace: ws,
    })
    const rs = gate.runCheck(stale)
    assert.equal(rs.violations.length, 1)
    assert.equal(rs.violations[0].kind, 'override-not-applied')
    assert.equal(rs.violations[0].overrideValue, '5.99.0')
    // 正例:改到与 override 目标一致必绿
    const fixed = gate.makeFixture(join(s, 'fixed'), {
      webPkg: { dependencies: { webpack: '5.99.0' } },
      lock: gate.lockFrom({ dependencies: { webpack: '5.99.0' } }),
      workspace: ws,
    })
    assert.deepEqual(gate.runCheck(fixed).violations, [])
  } finally {
    rmScratch(s)
  }
})

test('T11 未被 override、非 peer 的依赖:今天的真事故形态在带 override 表的仓里仍必红/改一致必绿(CLI 退出码)', () => {
  const s = mkScratch('lmci-t11')
  const ws = gate.wsWithOverrides(["  '@types/react': 19.2.18"])
  try {
    const red = gate.makeFixture(join(s, 'red'), { webPkg: BROKEN_WEB, lock: LOCK, workspace: ws })
    const rr = runCLI(['--all', '--worktree', '--root', red])
    assert.equal(rr.code, 1)
    assert.match(rr.out, /xlsx/)
    const green = gate.makeFixture(join(s, 'green'), {
      webPkg: fixtureWebPkg(),
      lock: LOCK,
      workspace: ws,
    })
    assert.equal(runCLI(['--all', '--worktree', '--root', green]).code, 0)
  } finally {
    rmScratch(s)
  }
})

test('T12 overrides 表读不懂 → exit 2,不得退化成"当作没有 override"再产红', () => {
  const s = mkScratch('lmci-t12')
  try {
    const dir = gate.makeFixture(join(s, 'p'), {
      webPkg: fixtureWebPkg(),
      lock: LOCK,
      workspace: "packages:\n  - 'apps/*'\n\noverrides:\n  foo:\n    bar: 1.0.0\n",
    })
    const r = runCLI(['--all', '--worktree', '--root', dir])
    assert.equal(r.code, 2)
    assert.match(r.out, /overrides/)
  } finally {
    rmScratch(s)
  }
})

test('T13 splitOverrideKey:`>=` 里的 > 不是父作用域分隔符(真仓 13 条键带 >=)', () => {
  assert.equal(gate.splitOverrideKey('fast-uri@>=3.0.0 <3.1.6').parentScoped, false)
  assert.equal(gate.splitOverrideKey('fast-uri@>=3.0.0 <3.1.6').name, 'fast-uri')
  assert.equal(gate.splitOverrideKey('foo@>1.0.0').parentScoped, false)
  assert.equal(gate.splitOverrideKey('foo>bar').parentScoped, true)
  assert.equal(gate.splitOverrideKey('@scope/p>@scope/c').parentScoped, true)
  assert.equal(gate.splitOverrideKey('@types/react@^19').name, '@types/react')
  assert.equal(gate.splitOverrideKey('postcss').selector, null)
})

/* ===================== 维度 B:peer 记账形态(R5) ===================== */

test('T14 peer 记在 devDependencies 段且值不同 → 绿并计入 peerExempted;缺条目仍必红', () => {
  const s = mkScratch('lmci-t14')
  try {
    const present = gate.makeFixture(join(s, 'present'), {
      webPkg: {
        peerDependencies: { '@tarojs/taro': '>=4.0.0' },
        devDependencies: { '@tarojs/taro': '4.2.1' },
      },
      lock: gate.lockFrom({ devDependencies: { '@tarojs/taro': '4.2.1' } }),
    })
    const rp = gate.runCheck(present)
    assert.deepEqual(rp.violations, [])
    assert.equal(rp.peerExempted.length, 1)
    assert.equal(rp.peerExempted[0].lockedIn, 'devDependencies')
    const absent = gate.makeFixture(join(s, 'absent'), {
      webPkg: { peerDependencies: { 'peer-only': '^1.0.0' } },
      lock: gate.lockFrom({ dependencies: { react: '19.0.0' } }),
    })
    const ra = gate.runCheck(absent)
    assert.equal(ra.violations.length, 1)
    assert.equal(ra.violations[0].kind, 'missing')
    assert.equal(ra.violations[0].name, 'peer-only')
  } finally {
    rmScratch(s)
  }
})

test('T15 CLI 结论行必须点名两维放过条数(不许把豁免静默成"看起来全绿")', () => {
  const s = mkScratch('lmci-t15')
  try {
    const dir = gate.makeFixture(join(s, 'p'), {
      webPkg: {
        devDependencies: { '@types/react': '^19.0.0' },
        peerDependencies: { react: '>=18.0.0' },
      },
      lock: gate.lockFrom({ devDependencies: { '@types/react': '19.2.18', react: '19.2.8' } }),
      workspace: gate.wsWithOverrides(["  '@types/react': 19.2.18"]),
    })
    const out = runCLI(['--all', '--worktree', '--root', dir])
    assert.equal(out.code, 0)
    assert.match(out.out, /维度 A overrides 表 1 条/)
    assert.match(out.out, /因 override 目标值放过 1 条/)
    assert.match(out.out, /维度 B peer 只验条目在位\(不比 specifier\)1 条/)
    assert.match(out.out, /违规 0/)
  } finally {
    rmScratch(s)
  }
})

/* ===================== 判定面(面选择本身,T16~T20) ===================== */

test('T16 面旗标 → 面的映射是唯一且显式的:缺省判 HEAD,两面同给即报错', () => {
  assert.deepEqual(gate.resolveFace([]), { face: 'head', mode: '--all' })
  assert.deepEqual(gate.resolveFace(['--all']), { face: 'head', mode: '--all' })
  assert.equal(gate.resolveFace(['--staged']).face, 'staged')
  assert.equal(gate.resolveFace(['--head']).face, 'head')
  assert.equal(gate.resolveFace(['--worktree']).face, 'worktree')
  // 同时给两个面旗标 ⇒ 静默取其一会让"这次判了哪一面"从命令里读不出来
  assert.throws(() => gate.resolveFace(['--staged', '--worktree']), /冲突/)
  assert.deepEqual(gate.FACES, ['staged', 'head', 'worktree'])
  for (const f of gate.FACES)
    assert.ok(gate.FACE_LABEL[f] && gate.FACE_NOTE[f], `面 ${f} 缺标签或说明`)
  const r = runCLI(['--staged', '--worktree', '--root', process.cwd()])
  assert.equal(r.code, 2)
  assert.match(r.out, /判定面互相冲突/)
})

test('T17 假绿钉死(端到端):索引里那对不一致、盘上已改对 ⇒ --staged 必红', () => {
  const s = mkScratch('lmci-t17')
  try {
    // 先按事故形态 add + commit ⇒ 索引/HEAD 里就是那对坏内容
    const dir = gate.gitifyFixture(
      gate.makeFixture(join(s, 'repo'), { webPkg: BROKEN_WEB, lock: LOCK }),
    )
    // 随后作者只把**磁盘**文件改对(没再 git add)—— 判盘的旧实现在这里会放行坏提交
    overwriteWebPkg(dir, fixtureWebPkg())
    const staged = runCLI(['--staged', '--root', dir])
    assert.equal(staged.code, 1)
    assert.match(staged.out, /xlsx/)
    const head = runCLI(['--head', '--root', dir])
    assert.equal(head.code, 1)
    // 对照:同一目录判盘确实是绿的 —— 差的正是这一枚面
    assert.equal(runCLI(['--worktree', '--root', dir]).code, 0)
    assert.equal(gate.runCheck(dir, 'staged').violations[0].kind, 'mismatch')
  } finally {
    rmScratch(s)
  }
})

test('T18 假红钉死(端到端):索引里那对一致、盘上是别人半编辑的不一致 ⇒ --staged 必绿', () => {
  const s = mkScratch('lmci-t18')
  try {
    const dir = gate.gitifyFixture(
      gate.makeFixture(join(s, 'repo'), { webPkg: fixtureWebPkg(), lock: LOCK }),
    )
    overwriteWebPkg(dir, BROKEN_WEB) // 并行会话把磁盘改坏了,与本次提交无关
    const staged = runCLI(['--staged', '--root', dir])
    assert.equal(staged.code, 0)
    assert.match(staged.out, /specifier 全部一致/)
    assert.equal(runCLI(['--head', '--root', dir]).code, 0)
    // 反证:同一目录判盘会红 ⇒ 上面的绿不是"什么都没判"
    assert.equal(runCLI(['--worktree', '--root', dir]).code, 1)
  } finally {
    rmScratch(s)
  }
})

test('T19 该面取不到 ⇒ exit 2 并点名路径,绝不"跳过该包然后报绿"(端到端)', () => {
  const s = mkScratch('lmci-t19')
  try {
    // 只 init + add(不 commit),先把取材原语验明:该面有的给出内容、没有的给 null
    const dir = gate.gitifyFixture(
      gate.makeFixture(join(s, 'repo'), { webPkg: fixtureWebPkg(), lock: LOCK }),
      {
        commit: false,
      },
    )
    const got = gate.catBatch(dir, [':pnpm-lock.yaml', ':nope/missing.yaml'])
    assert.ok(String(got.get(':pnpm-lock.yaml')).includes('lockfileVersion'))
    assert.equal(got.get(':nope/missing.yaml'), null)
    // 把 lock 从索引里摘掉(盘上文件仍在 ⇒ 判盘会照样绿)
    gate.gitInFixture(dir, ['rm', '-q', '--cached', 'pnpm-lock.yaml'])
    const staged = runCLI(['--staged', '--root', dir])
    assert.equal(staged.code, 2)
    assert.match(staged.out, /无法判定/)
    assert.match(staged.out, /pnpm-lock\.yaml/)
    // 无提交 ⇒ head 面同样必须"无法判定",而不是"扫到 0 个包所以绿"
    const head = runCLI(['--head', '--root', dir])
    assert.equal(head.code, 2)
    assert.match(head.out, /无法判定/)
  } finally {
    rmScratch(s)
  }
})

test('T20 单一取材出口:三处判据取材全走同一个 readFace,面外不得再有直接读文件', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  const start = src.indexOf('export function makeFaceReader(')
  assert.ok(start > 0, '找不到 makeFaceReader 这个唯一取材出口')
  // 出口的边界 = 它之后第一个**顶层**函数(makeFaceReader 内部的 loadTracked 是缩进的,不算)。
  // 2026-09-25 收口前这里是门自己的 `function gitExec(`;现在 git 派生整体搬进了
  // scripts/lib/face-reader.mjs,所以边界改用同一个"下一个顶层函数"规则去取,不再点那个名字。
  const end = src.indexOf('\nfunction ', start)
  assert.ok(end > start, 'makeFaceReader 之后找不到出口边界')
  const readerBlock = src.slice(start, end)
  const outside = src.slice(0, start) + src.slice(end)
  // 形状锁一律比**空白归一化后**的文本:prettier 在 lint-staged 里会把长调用折行,
  // 而"这条语句被折成三行"与"这一维判据有没有走层"毫无关系。按原文 match 的结果是
  // 下一个碰这文件的提交(不是我)被一条与改动无关的形状红钉住 —— 那只会逼人绕钩子。
  // 刻意不跨语句:归一化只压空白,不重排 token,所以"调用存在"这一判据仍然成立。
  // ①面外不得有任何直接读文件的路径(一半读盘一半读 git = 混面假绿)
  for (const call of ['readFileSync(', 'readdirSync(']) {
    const outBlock = outside.split('\n').filter((l) => l.includes(call) && !/^import /.test(l))
    assert.deepEqual(outBlock, [], `${call} 泄漏到 makeFaceReader 之外:${outBlock.join(' | ')}`)
  }
  // ②磁盘面:本门不再自己 readFileSync,只调层里的 readWorktreeFile;listDir 仍由本门承担
  //   (层刻意不提供 —— 94 要文件清单、101 要包清单),所以 readdirSync 必须**留在**出口内。
  const anyReadFile = src
    .split('\n')
    .filter((l) => l.includes('readFileSync(') && !/^import /.test(l))
  assert.deepEqual(anyReadFile, [], '本门仍在自己 readFileSync —— 磁盘面应走层的 readWorktreeFile')
  const flat = (t) => t.replace(/\s+/g, ' ')
  assert.match(flat(readerBlock), /readWorktreeFile\(root, rel\)/, 'worktree 面未接层的 readWorktreeFile')
  assert.ok(
    readerBlock.split('\n').some((l) => l.includes('readdirSync(')),
    'readdirSync( 必须由 makeFaceReader 承担(worktree 面的 listDir)',
  )
  // 三个参与比对的文件都必须经 readFace 取,且 runCheck 显式带面参数
  assert.match(flat(src), /reader\.readFace\('pnpm-workspace\.yaml'\)/)
  assert.match(flat(src), /reader\.readFace\('pnpm-lock\.yaml'\)/)
  assert.match(flat(src), /reader\.readFace\(relPath\)/)
  assert.match(flat(src), /const reader = makeFaceReader\(face, root\)/)
  assert.match(flat(src), /export function runCheck\(root, face = 'worktree'\)/)
  // ③git 派生三件套(绝对路径 git + safe.directory + windowsHide + 数字 timeout)只允许存在一份。
  //   收口前这条判据打在**本门**的 catBatch / gitExec 上;现在打在层上,同时反向钉住
  //   "本门一次都没自己派生 git" —— 比改前更严(改前门里有两处 execFileSync)。
  assert.equal(src.includes('execFileSync('), false, '本门仍在自己派生 git,收口被绕开')
  assert.equal(
    src.includes("'safe.directory=*'"),
    false,
    'safe.directory 的字面量不得在门里再抄一遍',
  )
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '本门未 import 共用层')
  assert.match(
    flat(readerBlock),
    /gitRaw\(\['rev-parse', '--show-toplevel'\], root\)/,
    '仓库根未走层的 gitRaw',
  )
  assert.match(flat(readerBlock), /sameDir\(top, root\)/, '仓库根比较未走层的 sameDir(junction 下会误判错位)')
  assert.match(
    flat(readerBlock),
    /catBatch\(\s*root,\s*need\.map/,
    '内容未走层的 cat-file batch(逐文件派生会打满进程)',
  )
  const layer = readFileSync(resolve(HERE, '..', 'lib', 'face-reader.mjs'), 'utf8')
  assert.match(
    flat(layer),
    /resolveGitBin\(\) \|\| 'git'/,
    '层未用绝对路径 git(§5b:服务账户/GUI 宿主的 PATH 不通)',
  )
  assert.match(
    flat(layer),
    /\['-c', 'safe\.directory=\*', '-c', 'core\.quotepath=false', '-C', root, \.\.\.args\]/,
  )
  const HAS_TIMEOUT = /timeout:\s*(?:opts\.timeout\s*\?\?\s*)?[A-Z_]+\b/
  // 阳性对照:同一把尺子必须抓住"没有数字 timeout 的写法"(守门 80 那类无界挂起),
  // 否则下面这条 match 只是恒真。
  assert.equal(
    HAS_TIMEOUT.test('foo(bar, { cwd: root, windowsHide: true })'),
    false,
    '尺子连无 timeout 的样本都抓不住',
  )
  for (const name of ['gitRaw', 'catBatch']) {
    const at = layer.indexOf(`export function ${name}(`)
    assert.ok(at > 0, `层里找不到 ${name}`)
    const body = layer.slice(at, layer.indexOf('\n}', at))
    assert.match(body, /windowsHide: true/, `${name} 缺 windowsHide`)
    assert.match(body, HAS_TIMEOUT, `${name} 缺数字 timeout`)
  }
  // 层里 batch 的 stdio[0] 必须是 pipe —— 设成 'ignore' 会让 git 读到空输入,于是每个 rev 都
  // "取不到"(本门第一次真仓自验就是被这一条咬出的假 exit 2)。收口前这条写在本门的注释里,
  // 现在必须钉在它实现所在的那一处,否则教训随代码搬家一起丢。
  //
  // ⚠️ 两处修正(2026-09-25,都是"针脚必须钉在真身而不是形状"的同一族):
  // ① 定位不能用 `indexOf("'cat-file', '--batch'")` —— 它是 `'--batch-check'` 的**前缀**,
  //   那样永远落在 `catBatchCheck` 上,`catBatch` 本体(本门真正调的那个出口)根本不在视野里。
  //   改为按 `export function catBatch(` 取函数体。
  // ② maxBuffer 现在是**可配**的(`opts.maxBuffer ?? GIT_MAX_BUFFER`,层为门 98/103 那种
  //   一次读 85MB 的批量口径开的口子,默认值不变)。针脚要钉的是"默认必须吃到那个常量",
  //   不是"字面上必须等于 GIT_MAX_BUFFER" —— 钉字面会把层的合法演进判成缺陷。
  const catBatchAt = layer.indexOf('export function catBatch(')
  assert.ok(catBatchAt > 0, '层里找不到 catBatch 本体')
  const batch = layer.slice(catBatchAt, layer.indexOf('\nexport ', catBatchAt + 10))
  assert.match(batch, /stdio:\s*\[\s*'pipe',\s*'pipe',\s*'pipe'\s*\]/)
  assert.match(batch, /input:\s*Buffer\.from\(/, 'rev 清单必须由 input 喂进去')
  // 2026-09-25 层的合法演进:批次改为**按字节装箱**,读点写的是 `maxBuffer: budget`,
  // 而 budget = `Math.max(maxBuffer, 本块字节 + 1MB)`、`maxBuffer = opts.maxBuffer ?? GIT_MAX_BUFFER`
  // ⇒ 常量仍是 floor。与 `scripts/tests/face-reader.test.mjs` 同一条性质(两处各写一遍判据
  // 本来就是这层反复记过的病,这里只把针脚同步到新形状,不新发明一套要求)。
  const directRoute = /maxBuffer:\s*(?:opts\.maxBuffer\s*\?\?\s*)?GIT_MAX_BUFFER/.test(batch)
  const budgetRoute = /maxBuffer:\s*budget\b/.test(batch)
  assert.ok(
    directRoute || budgetRoute,
    'batch 的 maxBuffer 默认必须以那个常量作 floor(直写常量,或经 Math.max 抬升后传给子进程)',
  )
  if (budgetRoute) {
    assert.match(
      batch,
      /const maxBuffer = opts\.maxBuffer \?\? GIT_MAX_BUFFER/,
      'budget 路线必须以常量作默认 floor(换成别的默认值就等于把缓冲区退回 1MB)',
    )
    assert.match(
      batch,
      /const budget = Math\.max\(maxBuffer,/,
      '每块预算必须 Math.max 抬升,而不是把常量往下压',
    )
  }
  // 反向对照:把默认值改掉(哪怕仍写 opts.maxBuffer ??)也必须被本条咬住
  assert.ok(
    !/maxBuffer:\s*(?:opts\.maxBuffer\s*\?\?\s*)?(?:1 << 20|1024)\b/.test(batch),
    'batch 的默认 maxBuffer 被换成了小值 —— 真仓单文件就超 1MB',
  )
})

test('T21 同一轮只判一个面:三面各验一次 --json 的 judgedFace 与退出码', () => {
  const s = mkScratch('lmci-t21')
  try {
    const dir = gate.gitifyFixture(
      gate.makeFixture(join(s, 'repo'), { webPkg: BROKEN_WEB, lock: LOCK }),
    )
    overwriteWebPkg(dir, fixtureWebPkg())
    for (const [flag, want] of [
      ['--staged', 'staged'],
      ['--head', 'head'],
      ['--worktree', 'worktree'],
    ]) {
      const r = runCLI([flag, '--json', '--root', dir])
      const parsed = JSON.parse(r.out)
      assert.equal(parsed.judgedFace, want, `${flag} 面标记不符`)
      assert.equal(parsed.packagesScanned, 2, `${flag} 面包清单枚举数不符`)
      // 索引/HEAD 面看到的是那对坏内容(红);盘面看到的是随后改好的(绿)
      if (want === 'worktree') {
        assert.equal(r.code, 0)
        assert.deepEqual(parsed.violations, [])
      } else {
        assert.equal(r.code, 1, `${flag} 面必须对索引里那对坏内容判红`)
        assert.equal(parsed.violations.length, 1)
        assert.equal(parsed.violations[0].name, 'xlsx')
        assert.equal(parsed.violations[0].kind, 'mismatch')
      }
    }
    // 三面判据必须真的"看得见同一个仓":同一目录、同一时刻,盘面与索引面结论相反
    assert.notEqual(
      gate.runCheck(dir, 'staged').violations.length,
      gate.runCheck(dir, 'worktree').violations.length,
    )
  } finally {
    rmScratch(s)
  }
})

test('T22 面的独立性:磁盘文件被删,git 面照判(连包清单枚举也没读盘)', () => {
  const s = mkScratch('lmci-t22')
  try {
    const dir = gate.gitifyFixture(
      gate.makeFixture(join(s, 'repo'), { webPkg: BROKEN_WEB, lock: LOCK }),
    )
    rmSync(join(dir, WEB_PKG_REL), { force: true })
    rmSync(join(dir, 'pnpm-workspace.yaml'), { force: true })
    const r = gate.runCheck(dir, 'staged')
    assert.equal(r.undetermined, null, `git 面不该受磁盘缺失影响:${r.undetermined}`)
    assert.equal(r.packagesScanned, 2) // '.' + apps/web,二者都按索引枚举
    assert.equal(r.violations.length, 1)
    assert.equal(r.violations[0].name, 'xlsx')
    // 而盘面缺 workspace 文件必须如实"无法判定",不得静默按 0 个包报绿
    assert.notEqual(gate.runCheck(dir, 'worktree').undetermined, null)
  } finally {
    rmScratch(s)
  }
})

test('T23 索引处于未合并态(并行会话真跑过 merge)⇒ 取不到即 exit 2,不得按"没有这个包"报绿', () => {
  const s = mkScratch('lmci-t23')
  try {
    const dir = gate.gitifyFixture(
      gate.makeFixture(join(s, 'repo'), { webPkg: BROKEN_WEB, lock: LOCK }),
    )
    const write = (spec) => {
      overwriteWebPkg(dir, { dependencies: { xlsx: spec, '@ihui/shared': 'workspace:*' } })
      gate.gitInFixture(dir, ['add', '-A'])
    }
    write('^1.1.1')
    gate.gitInFixture(dir, ['commit', '-q', '-m', 'main 侧'])
    gate.gitInFixture(dir, ['checkout', '-q', '-b', 'other', 'HEAD~1'])
    write('^2.2.2')
    gate.gitInFixture(dir, ['commit', '-q', '-m', 'other 侧'])
    gate.gitInFixture(dir, ['checkout', '-q', 'main'])
    try {
      gate.gitInFixture(dir, ['merge', '-q', '--no-ff', '-m', '并发合流', 'other'])
    } catch {
      /* 冲突是预期的,merge 本身必然非零退出 */
    }
    const r = gate.runCheck(dir, 'staged')
    assert.notEqual(r.undetermined, null, 'unmerged 索引必须判"取不到",不得静默跳过该包')
    assert.match(r.undetermined, /apps\/web\/package\.json/)
    assert.equal(r.violations.length, 0)
    const cli = runCLI(['--staged', '--root', dir])
    assert.equal(cli.code, 2)
    assert.match(cli.out, /无法判定/)
  } finally {
    rmScratch(s)
  }
})

test('T24 --root 指到仓库子目录 ⇒ 显式"无法判定",绝不按错位基准产出混面的绿', () => {
  const s = mkScratch('lmci-t24')
  try {
    const dir = gate.gitifyFixture(
      gate.makeFixture(join(s, 'repo'), { webPkg: fixtureWebPkg(), lock: LOCK }),
    )
    const r = gate.runCheck(join(dir, 'apps'), 'staged')
    assert.notEqual(r.undetermined, null)
    assert.match(r.undetermined, /toplevel/)
    const cli = runCLI(['--staged', '--root', join(dir, 'apps')])
    assert.equal(cli.code, 2)
    // 对照:同一面在真正的仓库根上是可判定的(不是"永远无法判定"的空门)
    assert.equal(gate.runCheck(dir, 'staged').undetermined, null)
  } finally {
    rmScratch(s)
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('T25 R6 分区漂移:名字与值都对、只有依赖类型不一致 ⇒ 判红并点名两侧段(门 101 的原盲区)', () => {
  const s = mkScratch('lmci-t25')
  try {
    const drift = gate.makeFixture(join(s, 'drift'), {
      webPkg: { dependencies: { dayjs: '^1.11.0' } },
      lock: gate.lockFrom({ devDependencies: { dayjs: '^1.11.0' } }),
    })
    const rd = gate.runCheck(drift)
    assert.equal(rd.violations.length, 1)
    assert.equal(rd.violations[0].kind, 'section-drift')
    assert.equal(rd.violations[0].section, 'dependencies')
    assert.equal(rd.violations[0].lockedIn, 'devDependencies')

    const fixed = gate.makeFixture(join(s, 'fixed'), {
      webPkg: { dependencies: { dayjs: '^1.11.0' } },
      lock: gate.lockFrom({ dependencies: { dayjs: '^1.11.0' } }),
    })
    assert.deepEqual(gate.runCheck(fixed).violations, [])

    // 反向锁:R5 的 peer 豁免不得被 R6 吃回来(pnpm 把 peer 记进 dev 段是文档化行为)
    const peer = gate.makeFixture(join(s, 'peer'), {
      webPkg: { peerDependencies: { react: '>=18.0.0' } },
      lock: gate.lockFrom({ devDependencies: { react: '19.2.8' } }),
    })
    const rpeer = gate.runCheck(peer)
    assert.deepEqual(rpeer.violations, [])
    assert.equal(rpeer.peerExempted.length, 1)

    // 判据必须真挂在 compareDeclarations 上,且报告面必须能把它说清楚(否则红点无人会修)
    const src = readFileSync(SCRIPT, 'utf8')
    assert.match(src, /kind: 'section-drift'/)
    assert.match(src, /\[分区漂移\]/)
  } finally {
    rmScratch(s)
  }
})

test('T26 R6 落地前置:真仓 HEAD 面必须 0 条跨段(这条红了就说明有人把分区债带进了仓)', () => {
  const repoRoot = resolve(HERE, '..', '..')
  const r = gate.runCheck(repoRoot, 'head')
  if (r.undetermined) throw new Error(`真仓 HEAD 面判不出:${r.undetermined}`)
  const drift = r.violations.filter((v) => v.kind === 'section-drift')
  assert.deepEqual(
    drift.map((v) => `${v.pkg} ${v.name} ${v.section}→${v.lockedIn}`),
    [],
    '分区漂移存量必须为零 ⇒ 本维可零容忍;非零即新债,须先把两侧摆回同一段',
  )
})
