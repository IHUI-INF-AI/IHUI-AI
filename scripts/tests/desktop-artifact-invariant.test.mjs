// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面安装包"单一产物"不变量的回归测试。
// 反例(不该被删的东西)与正例同权重 —— 判据只要误删过一次的签名/包,就是发版事故。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, readdirSync, rmSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { mkScratch, rmScratch, scratchRoot } from '../lib/scratch-dir.mjs'

import { planArtifactInvariant, judgeContentManifest } from '../lib/desktop-artifact-invariant.mjs'

const CUR = '智汇AI_0.1.44_x64-setup.exe'

test('正例:目录里只有当前包 + 签名 → 无陈旧、无违规', () => {
  const r = planArtifactInvariant([CUR, `${CUR}.sig`], CUR)
  assert.deepEqual(r.stale, [])
  assert.deepEqual(r.keep.sort(), [CUR, `${CUR}.sig`].sort())
  assert.deepEqual(r.violations, [])
})

test('正例:2026-09-22 真实污染场景(三个版本共存)→ 只留当前那一对', () => {
  const files = [
    CUR,
    `${CUR}.sig`,
    '智汇AI_0.1.45_x64-setup.exe',
    '智汇AI_0.1.45_x64-setup.exe.sig',
    '智汇AI_0.1.46_x64-setup.exe',
    '智汇AI_0.1.46_x64-setup.exe.sig',
  ]
  const r = planArtifactInvariant(files, CUR)
  assert.equal(r.stale.length, 4)
  assert.ok(!r.stale.includes(CUR), '当前包绝不能进 stale 清单')
  assert.ok(!r.stale.includes(`${CUR}.sig`), '当前签名绝不能进 stale 清单')
  assert.deepEqual(r.keep.sort(), [CUR, `${CUR}.sig`].sort())
})

test('反例:当前包字母序靠后也不能被当成陈旧(字母序选包正是本缺陷的成因)', () => {
  // 0.1.9 排在 0.1.10 之后 —— 若哪天有人按 glob[0] 取包就会拿到错的版本
  const r = planArtifactInvariant(
    ['智汇AI_0.1.10_x64-setup.exe', '智汇AI_0.1.9_x64-setup.exe'],
    '智汇AI_0.1.9_x64-setup.exe',
  )
  assert.deepEqual(r.stale, ['智汇AI_0.1.10_x64-setup.exe'])
  assert.deepEqual(r.keep, ['智汇AI_0.1.9_x64-setup.exe'])
})

test('反例:非产物文件一律不碰(日志/备份/说明不得被删)', () => {
  const decoys = [
    'README.md',
    'build.log',
    `${CUR}.bak`,
    '智汇AI_0.1.45_x64-setup.exe.tmp',
    'notes-setup.exe.txt',
  ]
  const r = planArtifactInvariant([CUR, `${CUR}.sig`, ...decoys], CUR)
  assert.deepEqual(r.stale, [], `诱饵被误判为陈旧产物: ${r.stale.join(',')}`)
  assert.deepEqual(r.keep.sort(), [CUR, `${CUR}.sig`].sort())
})

test('违规:缺当前包 → 必须报', () => {
  const r = planArtifactInvariant(['智汇AI_0.1.45_x64-setup.exe'], CUR)
  assert.ok(
    r.violations.some((v) => v.includes(CUR)),
    r.violations.join(';'),
  )
})

test('违规:缺当前签名 → 必须报(签名缺失=更新链路不可用)', () => {
  const r = planArtifactInvariant([CUR], CUR)
  assert.ok(
    r.violations.some((v) => v.includes('.sig')),
    r.violations.join(';'),
  )
})

test('护栏:exeName 传成通配/目录形态时立即抛,不给"glob 猜包"留活路', () => {
  for (const bad of [
    '',
    '*-setup.exe',
    '智汇AI_0.1.44_x64-setup',
    undefined,
    '智汇AI_0.1.44_x64-setup.exe.sig',
  ]) {
    assert.throws(() => planArtifactInvariant([CUR], bad), TypeError, `应拒绝: ${String(bad)}`)
  }
})

test('集成:临时目录里跑完整"删+复算"流程,收尾必须只剩当前一对', () => {
  const dir = mkScratch('ihui-artifact-inv-')
  try {
    const names = [
      CUR,
      `${CUR}.sig`,
      '智汇AI_0.1.45_x64-setup.exe',
      '智汇AI_0.1.45_x64-setup.exe.sig',
      'keep-me.log',
    ]
    for (const n of names) writeFileSync(join(dir, n), 'x')
    const { stale } = planArtifactInvariant(readdirSync(dir), CUR)
    assert.deepEqual(stale.sort(), [
      '智汇AI_0.1.45_x64-setup.exe',
      '智汇AI_0.1.45_x64-setup.exe.sig',
    ])
    for (const f of stale) rmSync(join(dir, f), { force: true })
    const after = readdirSync(dir).sort()
    assert.deepEqual(after, [CUR, `${CUR}.sig`, 'keep-me.log'].sort(), '无关文件必须活下来')
    assert.deepEqual(planArtifactInvariant(after, CUR).violations, [])
  } finally {
    rmScratch(dir)
  }
})

// ── 构建期钩子 scripts/desktop-artifact-single.mjs 的行为(它比判据多做两件事:
//    真删文件,以及"这次构建压根没产 nsis 时不许动手"的自缚条款)──
const HOOK = new URL('../desktop-artifact-single.mjs', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
)
const runHook = (dir, expect) =>
  execFileSync(process.execPath, [HOOK, '--dir', dir, '--expect', expect], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
  })

/** 判红用例要看退出码与 stderr,execFileSync 会在非零时直接抛 —— 故单独一个不抛的入口。 */
const runHookResult = (dir, expect, extra = []) =>
  spawnSync(process.execPath, [HOOK, '--dir', dir, '--expect', expect, ...extra], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
  })

test('钩子正例:多版本共存 → 目录里只剩当前一对,无关文件活下来', () => {
  const dir = mkScratch('ihui-artifact-hook-')
  try {
    for (const n of [
      CUR,
      `${CUR}.sig`,
      '智汇AI_0.1.45_x64-setup.exe',
      '智汇AI_0.1.45_x64-setup.exe.sig',
      'keep-me.log',
    ]) {
      writeFileSync(join(dir, n), 'x')
    }
    const out = runHook(dir, CUR)
    assert.ok(out.includes('唯一安装包'), out)
    assert.deepEqual(readdirSync(dir).sort(), [CUR, `${CUR}.sig`, 'keep-me.log'].sort())
  } finally {
    rmScratch(dir)
  }
})

test('钩子反例:目录里没有"本次应产的包"时**一个文件都不许删**,且默认判红', () => {
  // 这条自缚条款是钩子唯一危险的地方:若它按"缺当前包"就清空目录,
  // 那么 `tauri build --bundles app`(不产 nsis)会把上一次 nsis 构建的包连带签名一起抹掉。
  // F-041 起缺产物不再算通过:默认 exit 1,但"一个文件都不删"这条照旧。
  const dir = mkScratch('ihui-artifact-hook2-')
  const others = ['智汇AI_0.1.45_x64-setup.exe', '智汇AI_0.1.45_x64-setup.exe.sig']
  try {
    for (const n of others) writeFileSync(join(dir, n), 'x')
    const r = runHookResult(dir, CUR)
    assert.equal(r.status, 1, `缺本次产物必须判红,实际: ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.ok(r.stderr.includes('没有产物'), r.stderr)
    assert.ok(r.stderr.includes('--no-artifact-check'), `必须给出显式跳过出路,实际: ${r.stderr}`)
    assert.deepEqual(readdirSync(dir).sort(), others.sort(), '不属于自己的目录必须原样保留')
  } finally {
    rmScratch(dir)
  }
})

test('钩子反例:显式 --no-artifact-check 才放行"不产 nsis",且仍一个文件都不删', () => {
  const dir = mkScratch('ihui-artifact-hook2-skip-')
  const others = ['智汇AI_0.1.45_x64-setup.exe', '智汇AI_0.1.45_x64-setup.exe.sig']
  try {
    for (const n of others) writeFileSync(join(dir, n), 'x')
    const r = runHookResult(dir, CUR, ['--no-artifact-check'])
    assert.equal(r.status, 0, `显式跳过应放行,实际: ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.ok(r.stdout.includes('--no-artifact-check'), `跳过必须可审计,实际: ${r.stdout}`)
    assert.deepEqual(readdirSync(dir).sort(), others.sort(), '跳过只免判据,不得动别人的产物')
  } finally {
    rmScratch(dir)
  }
})

test('钩子反例:目录压根不存在 → 默认 exit 1 报错,显式跳过才 exit 0,两种情况都不建目录', () => {
  const missing = join(scratchRoot(), `ihui-artifact-none-${Date.now()}`)
  const run = (extra = []) =>
    spawnSync(process.execPath, [HOOK, '--dir', missing, ...extra], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
    })
  const red = run()
  assert.equal(red.status, 1, `目录不存在默认必须判红,实际: ${red.status}\n${red.stdout}\n${red.stderr}`)
  assert.ok(red.stderr.includes('没有产物'), red.stderr)
  assert.equal(existsSync(missing), false, '判红时不得顺手建目录')

  const skipped = run(['--no-artifact-check'])
  assert.equal(skipped.status, 0, `显式跳过应放行,实际: ${skipped.status}\n${skipped.stdout}${skipped.stderr}`)
  assert.equal(existsSync(missing), false, '跳过时同样不得建目录')
})

const SHA = 'ab'.repeat(32)

test('路径清单不能当成内容已核验', () => {
  const verdict = judgeContentManifest({ fileCount: 1, files: ['vendor/sandbox/example.dll'] }, {})
  assert.equal(verdict.disposition, 'path-only')
  assert.equal(verdict.reason, 'paths-cannot-prove-content')
})

test('读不到的安装包是未判定,不是缺件', () => {
  const verdict = judgeContentManifest(
    { fileCount: 1, files: [{ path: CUR, sha256: SHA, bytes: 1, arch: 'x64' }] },
    { [CUR]: null },
  )
  assert.equal(verdict.disposition, 'unjudged')
  assert.equal(verdict.reason, 'content-unmeasured')
  assert.deepEqual(verdict.mismatches, [])
})

test('哈希或体积对不上就不是完整', () => {
  const verdict = judgeContentManifest(
    { fileCount: 1, files: [{ path: CUR, sha256: SHA, bytes: 1, arch: 'x64' }] },
    { [CUR]: { sha256: 'cd'.repeat(32), bytes: 1 } },
  )
  assert.equal(verdict.disposition, 'incomplete')
  assert.deepEqual(verdict.mismatches, [{ path: CUR, kind: 'content' }])
})

test('量到的哈希和体积一致才是完整', () => {
  const verdict = judgeContentManifest(
    { fileCount: 1, files: [{ path: CUR, sha256: SHA, bytes: 1, arch: 'x64' }] },
    { [CUR]: { sha256: SHA, bytes: 1 } },
  )
  assert.equal(verdict.disposition, 'intact')
})

test('钩子:安装包路径是目录时不得报内容已核验', () => {
  const dir = mkScratch('ihui-artifact-unread-')
  try {
    mkdirSync(join(dir, CUR))
    writeFileSync(join(dir, `${CUR}.sig`), 'sig')
    let failed = false
    try {
      execFileSync(process.execPath, [HOOK, '--dir', dir, '--expect', CUR], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      failed = true
      const stdout = typeof error.stdout === 'string' ? error.stdout : ''
      const stderr = typeof error.stderr === 'string' ? error.stderr : ''
      assert.equal(error.status, 2, `${stdout}\n${stderr}`)
      assert.ok(`${stdout}${stderr}`.includes('读不到'), stderr)
      assert.ok(!`${stdout}${stderr}`.includes('唯一安装包'), stdout)
    }
    assert.equal(failed, true)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
