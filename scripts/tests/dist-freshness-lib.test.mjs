// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/dist-freshness.mjs` 的镜像测试(逐包同步自检:脚本启动时给可执行修复命令)。
 * 与 `dist-freshness.test.mjs`(check-dist-freshness 的镜像)分文件:两个模块不同,测试不混写(§22c)。
 * 夹具一律落 `mkScratch()`(§15b:不得 os.tmpdir()、不得落仓库树内)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { DistStaleError, assertDistFresh, distFreshnessOf } from '../lib/dist-freshness.mjs'

const MIN = 60_000
const OLD = Date.now() - 90 * MIN
const NEW = Date.now() - 10 * MIN

// ---------------------------------------------------------------------------
// scripts/lib/dist-freshness.mjs(逐包同步自检：脚本启动时给可执行修复命令)。
// 夹具同样落 mkScratch()(§15b)，不触碰仓库内任何真实产物。
// ---------------------------------------------------------------------------
function makeLibPkg(root, { withSrc = true, withDist = true, distMtime, srcMtime } = {}) {
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: '@ihui/fixture',
      type: 'module',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
      scripts: { build: 'node ../../scripts/lib/atomic-build.mjs -p tsconfig.json' },
    }),
  )
  if (withSrc) {
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'index.ts'), 'export const a = 1\n')
    writeFileSync(join(root, 'src', 'nested.ts'), 'export const b = 2\n')
    if (srcMtime) {
      const t = new Date(srcMtime)
      utimesSync(join(root, 'src', 'index.ts'), t, t)
      utimesSync(join(root, 'src', 'nested.ts'), t, t)
    }
  }
  if (withDist) {
    mkdirSync(join(root, 'dist'), { recursive: true })
    writeFileSync(join(root, 'dist', 'index.js'), 'export const a = 1\n')
    if (distMtime) {
      const t = new Date(distMtime)
      utimesSync(join(root, 'dist', 'index.js'), t, t)
    }
  }
  return root
}

test('⑥ 逐包自检:产物不存在 ⇒ missing-dist、fresh:false', () => {
  const dir = mkScratch('df-lib-')
  try {
    const pkg = makeLibPkg(dir, { withDist: false })
    const r = distFreshnessOf(pkg)
    assert.equal(r.reason, 'missing-dist')
    assert.equal(r.fresh, false)
    assert.ok(r.entryPath.endsWith('index.js'))
    assert.ok(r.rebuildHint.includes('atomic-build.mjs'))
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('⑦ 逐包自检:源文件比产物新 ⇒ stale、ageMs>0、rebuildHint 非空', () => {
  const dir = mkScratch('df-lib-')
  try {
    const pkg = makeLibPkg(dir, { distMtime: OLD, srcMtime: NEW })
    const r = distFreshnessOf(pkg)
    assert.equal(r.reason, 'stale')
    assert.equal(r.fresh, false)
    assert.ok(r.ageMs > 0)
    assert.ok(r.newestSrcPath.endsWith('.ts'))
    assert.ok(r.rebuildHint.startsWith('cd '))
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('⑧ 逐包自检:产物比源新 ⇒ fresh:true', () => {
  const dir = mkScratch('df-lib-')
  try {
    const pkg = makeLibPkg(dir, { distMtime: NEW, srcMtime: OLD })
    const r = distFreshnessOf(pkg)
    assert.equal(r.reason, 'ok')
    assert.equal(r.fresh, true)
    assert.equal(r.ageMs, 0)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('⑨ 逐包自检:无 src/ ⇒ fresh:null、no-src', () => {
  const dir = mkScratch('df-lib-')
  try {
    const r = distFreshnessOf(makeLibPkg(dir, { withSrc: false }))
    assert.equal(r.reason, 'no-src')
    assert.equal(r.fresh, null)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('⑩ 逐包自检:读不到(不存在的目录) ⇒ fresh:null、unreadable', () => {
  const dir = mkScratch('df-lib-')
  try {
    const r = distFreshnessOf(join(dir, 'does-not-exist'))
    assert.equal(r.reason, 'unreadable')
    assert.equal(r.fresh, null)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('⑪ assertDistFresh 默认只告警、failFast 才抛 DistStaleError', () => {
  const dir = mkScratch('df-lib-')
  try {
    const pkg = makeLibPkg(dir, { distMtime: OLD, srcMtime: NEW })
    const lines = []
    const logger = { warn: (msg) => lines.push(msg) }
    assert.equal(assertDistFresh(pkg, { logger }).reason, 'stale')
    assert.equal(lines.length, 1)
    assert.ok(lines[0].includes('修复'))
    assert.throws(
      () => assertDistFresh(pkg, { failFast: true, logger }),
      (err) => err instanceof DistStaleError && err.code === 'DIST_STALE' && err.detail.reason === 'stale',
    )
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
