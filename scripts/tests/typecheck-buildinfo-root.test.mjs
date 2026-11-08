// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 跨根 tsbuildinfo 夹具(2026-11-08):复现「复扫 122 NOT-OK 但零 error TS」的假红。
//
// 症状:多 worktree 并行、共用主区 node_modules 时,`rimraf dist` 后重建 rc=0,
//       dist 里一个产物都没有(或只剩半份 .d.ts.map),门报 `复扫 N NOT-OK`。
// 病根:tsconfig 的 tsBuildInfoFile 指到 <root>/node_modules/.cache/tsbuildinfo/,
//       而 node_modules 是主区 junction ⇒ 各根共享同一份 buildinfo。buildinfo 里
//       记录"输入未变、产物已写出",tsc 直接跳过 emit(rc=0),不校验本根 dist 是否存在。
//
// 本夹具做三件事:
//   E1 真跑 tsc 复现跨根 no-op(修前该红),再证明"重建前隔离 buildinfo"能让 tsc 真 emit;
//   E2 判据层:rc=0 + 产物为空/缺一件 ⇒ 仍必须 NOT-OK,且错误信息点名具体产物路径;
//   E3 接线检查:typecheck-full 在 runOneProject 之前调用隔离,失败时用路径点名而非只报数字。
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  inspectBuildInfo,
  isolateBuildInfoForRebuild,
  rootIdentity,
} from '../lib/buildinfo-isolation.mjs'
import { describeMissingArtifacts, judgeRebuildOutcome } from '../lib/stale-dist.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const TSC = require.resolve('typescript/bin/tsc')

const SB = mkdtempSync(join(tmpdir(), 'ihui-buildinfo-root-'))
process.on('exit', () => {
  try {
    rmSync(SB, { recursive: true, force: true })
  } catch {
    /* 忽略 */
  }
})

const SHARED_NODE_MODULES = join(SB, 'shared', 'node_modules')

function countArtifacts(dir) {
  if (!existsSync(dir)) return { total: 0, dts: 0 }
  const out = { total: 0, dts: 0 }
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      const sub = countArtifacts(p)
      out.total += sub.total
      out.dts += sub.dts
    } else {
      out.total += 1
      if (e.name.endsWith('.d.ts')) out.dts += 1
    }
  }
  return out
}

/** 造一个与真实仓同构的根:<root>/node_modules 是指向共享 node_modules 的 junction。 */
function makeRoot(label) {
  const root = join(SB, label)
  const pkg = join(root, 'packages', 'p')
  mkdirSync(join(pkg, 'src'), { recursive: true })
  symlinkSync(SHARED_NODE_MODULES, join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: '@fx/p', scripts: { build: 'tsc' } }))
  writeFileSync(
    join(pkg, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        incremental: true,
        composite: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        outDir: './dist',
        rootDir: './src',
        tsBuildInfoFile: '../../node_modules/.cache/tsbuildinfo/fx-p.tsbuildinfo',
      },
      include: ['src/**/*.ts'],
    }),
  )
  writeFileSync(join(pkg, 'src', 'a.ts'), 'export const a: number = 1\nexport interface IA { x: string }\n')
  writeFileSync(join(pkg, 'src', 'b.ts'), "export const b: string = 'x'\n")
  writeFileSync(join(pkg, 'src', 'index.ts'), "export * from './a'\nexport * from './b'\n")
  return { root, pkg, dist: join(pkg, 'dist') }
}

function runTsc(pkg) {
  execFileSync(process.execPath, [TSC, '-p', join(pkg, 'tsconfig.json')], { stdio: 'pipe' })
}

test('E1 跨根共享 buildinfo:修前 tsc rc=0 但 0 产物;隔离后同一次构建真的 emit', () => {
  mkdirSync(join(SHARED_NODE_MODULES, '.cache', 'tsbuildinfo'), { recursive: true })
  const A = makeRoot('rootA')
  runTsc(A.pkg)
  const built = countArtifacts(A.dist)
  assert.ok(built.total > 0, 'A 根首次构建必须产出产物')
  assert.ok(built.dts >= 3, `A 根必须产出 .d.ts,实际 ${built.dts}`)

  // B 根:同构但从未构建过 dist;node_modules 与 A 共享 ⇒ 读到 A 写的同一份 buildinfo。
  const B = makeRoot('rootB')
  const infoBeforeB = inspectBuildInfo({ root: B.root, pkgDir: B.pkg })
  assert.equal(infoBeforeB.exists, true, 'B 根确实看到了共享 buildinfo')
  assert.equal(infoBeforeB.foreign, true, `跨根必须被识别:B 根=${rootIdentity(B.root)} 实际=${infoBeforeB.physicalPath}`)

  // 修前现场:门已 rimraf dist,B 根跑 tsc,rc=0,dist 仍然为空。
  runTsc(B.pkg)
  assert.equal(
    countArtifacts(B.dist).total,
    0,
    '这就是假红病根:跨根 buildinfo 让 tsc 认为"产物已写出",rc=0 却一个文件都不写',
  )

  // 修后:重建前隔离 buildinfo ⇒ 同一条 tsc 命令必须真的 emit。
  const iso = isolateBuildInfoForRebuild({ root: B.root, pkgDir: B.pkg, name: '@fx/p' })
  assert.equal(iso.ok, true, iso.error)
  assert.ok(iso.movedTo && existsSync(iso.movedTo), 'buildinfo 必须被移到按根隔离目录')
  assert.equal(existsSync(infoBeforeB.tsBuildInfoFile), false, '原共享面 buildinfo 必须移走(不可再被跨根复用)')

  runTsc(B.pkg)
  const afterIso = countArtifacts(B.dist)
  assert.ok(afterIso.total > 0, `隔离后 tsc 必须真的 emit,实际 ${afterIso.total}`)
  assert.ok(afterIso.dts >= 3, `隔离后必须产出 .d.ts,实际 ${afterIso.dts}`)
  assert.equal(existsSync(join(B.dist, 'index.d.ts')), true)
})

test('E2 判据:rc=0 但产物为空/缺件 ⇒ 必须仍判红,且错误信息点名具体产物路径', () => {
  const fakeState = (overrides = {}) => ({
    name: '@fx/p',
    dir: join(SB, 'judge', 'packages', 'p'),
    distMissing: false,
    distFileCount: 8, // 现场形态:dist 里只剩 8 个 .d.ts.map,没有 .d.ts
    artifactCount: 0,
    staleArtifacts: [],
    ...overrides,
  })
  const stale122 = Array.from({ length: 122 }, (_, i) => ({
    artifact: `mod${i}.d.ts`,
    src: `src/mod${i}.ts`,
    missing: true,
    artifactMtimeMs: -1,
    srcMtimeMs: 1,
  }))

  // 修前现场原样复刻:rc=0、dist 非空(8 个孤儿 map)、应有产物全缺 ⇒ 必须 NOT-OK。
  const red = judgeRebuildOutcome({
    rc: 0,
    after: fakeState({ staleArtifacts: stale122 }),
  })
  assert.equal(red.ok, false, 'rc=0 不得把"产物缺失"判绿')
  assert.equal(red.postFresh, false)

  // 反向对照(修后仍能红):只缺 1 个产物也必须红。
  const oneMissing = [
    {
      artifact: 'a.d.ts',
      src: 'src/a.ts',
      missing: true,
      artifactMtimeMs: -1,
      srcMtimeMs: 1,
    },
  ]
  assert.equal(judgeRebuildOutcome({ rc: 0, after: fakeState({ distFileCount: 5, staleArtifacts: oneMissing }) }).ok, false)

  // 正向对照:产物齐全、复扫零陈旧、内容复核通过 ⇒ 才能绿。
  assert.equal(
    judgeRebuildOutcome({
      rc: 0,
      after: fakeState({ distFileCount: 30, artifactCount: 30, staleArtifacts: [] }),
    }).ok,
    true,
  )

  // 错误信息必须给路径,而不是只给"复扫 122"。
  const detail = describeMissingArtifacts(fakeState({ staleArtifacts: stale122 }))
  assert.equal(detail.count, 122)
  assert.equal(detail.missing, 122)
  assert.match(detail.text, /共 122 个陈旧/)
  assert.match(detail.sample[0], /packages[\\/]p[\\/]dist[\\/]mod0\.d\.ts$/)
  assert.match(detail.text, /mod0\.d\.ts/)
  assert.match(detail.text, /其余 110 个省略/)
})

test('E3 接线:typecheck-full 必须在 runOneProject 之前隔离 buildinfo,失败信息点名产物路径', () => {
  const src = readFileSync(join(HERE, '..', 'typecheck-full.mjs'), 'utf8')
  const rebuildOne = src.slice(src.indexOf('const rebuildOne = async'), src.indexOf('const rebuildStarted'))
  const isoAt = rebuildOne.indexOf('isolateBuildInfoForRebuild(')
  const buildAt = rebuildOne.indexOf('runOneProject(')
  assert.ok(isoAt >= 0, 'rebuildOne 必须调用 isolateBuildInfoForRebuild')
  assert.ok(buildAt >= 0, 'rebuildOne 必须调用 runOneProject')
  assert.ok(isoAt < buildAt, '隔离必须发生在构建之前(否则 tsc 仍会 no-op)')
  assert.ok(
    rebuildOne.includes('describeMissingArtifacts('),
    '失败时必须以路径点名缺/旧产物,不能只报"复扫 N"',
  )
  assert.ok(src.includes('judgeRebuildOutcome('), 'ok 判据必须走 lib 的唯一判据(可被夹具直接审)')
})
