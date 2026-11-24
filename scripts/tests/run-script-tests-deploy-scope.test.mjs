// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/run-script-tests-deploy-scope.test.mjs — 本票(DEPLOYCI)的射程扩展取证。
 *
 * 锁的是"`--changed` 档必须收治 deploy/** 改动面"这一治理项,以及它的"有牙"反向对照:
 *   ① deploy 改动必须进改动面、并同构映射到 deploy/tests/*.test.mjs(正向命中 ⇒ exit 0);
 *   ② 改动面触发了作业却映射到 0 条用例 ⇒ 必须未判定且写 `map_zero=true` 交 workflow 判红,
 *      绝不冒充 success(yml 头注记过的"连续 8 晚"假绿形态,本票治的就是它)。
 *
 * 全部在 mkScratch 隔离夹具仓里端到端取证(与 run-script-tests.test.mjs 同形),
 * 不往真仓 scripts/tests/ 丢临时文件(§25);另加一条真仓 discover 正向对照证明不是空锁。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { __test__ as rt } from '../run-script-tests.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { discover, main, changedScriptsPaths, tokensForChanged } = rt

function gitAt(dir, args) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(
    r.status,
    0,
    `夹具 git ${args.join(' ')} 失败:${String(r.stderr ?? r.error?.message ?? '').slice(0, 200)}`,
  )
  return r
}

function makeRepo(prefix) {
  const dir = mkScratch(prefix)
  gitAt(dir, ['init', '-q', '-b', 'main'])
  gitAt(dir, ['config', 'user.email', 'fixture@local.test'])
  gitAt(dir, ['config', 'user.name', 'fixture'])
  gitAt(dir, ['commit', '-q', '--allow-empty', '-m', 'base'])
  return dir
}

function writeRel(root, rel, content) {
  const p = join(root, ...rel.split('/'))
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, content, 'utf8')
  return p
}

function capture(fn) {
  const orig = console.log
  const lines = []
  console.log = (...a) => lines.push(a.join(' '))
  try {
    return { rc: fn(), out: lines.join('\n') }
  } finally {
    console.log = orig
  }
}

function cleanup(dir) {
  rmScratch(dir)
  rmSync(dir, { recursive: true, force: true })
}

test('CHANGED_SCOPES 含 deploy/(本票射程扩展)且令牌映射对 deploy .ps1 同构可用', () => {
  assert.ok(
    Array.isArray(rt.CHANGED_SCOPES) && rt.CHANGED_SCOPES.includes('deploy/'),
    `射程必须含 deploy/:${JSON.stringify(rt.CHANGED_SCOPES)}`,
  )
  // deploy/win/*.ps1 的改动令牌 = basename 去扩展名,与 scripts/ 同构
  assert.deepEqual(tokensForChanged(['deploy/win/health-gate-verdict.ps1']), [
    'health-gate-verdict',
  ])
  assert.deepEqual(
    tokensForChanged(['scripts/check-x.mjs', 'deploy/win/y.ps1']),
    ['check-x', 'y'],
    '两族令牌必须合并进同一把尺',
  )
})

test('discover(真仓正向对照):deploy/ 改动令牌确实命中 deploy/tests 用例,证明不是空锁', () => {
  const hits = discover(rt.ROOT, ['health-gate-verdict']).map((f) => f.replace(/\\/g, '/'))
  assert.ok(
    hits.some((f) => f.includes('deploy/tests/health-gate-verdict.test.mjs')),
    `真仓里 deploy/win/health-gate-verdict.ps1 的改动应命中 deploy/tests/health-gate-verdict.test.mjs,实得:${hits}`,
  )
})

test('changedScriptsPaths:deploy/ 改动必须进改动面(此前被射程漏掉)', () => {
  const dir = makeRepo('ihui-rst-deploy-face-')
  try {
    writeRel(dir, 'deploy/win/foo.ps1', '# dummy deploy script\n')
    const face = changedScriptsPaths(dir)
    assert.equal(face.error, null, face.error)
    assert.ok(
      face.paths.includes('deploy/win/foo.ps1'),
      `deploy 改动必须进改动面:${JSON.stringify(face.paths)}`,
    )
  } finally {
    cleanup(dir)
  }
})

test('--changed(正向/本票):deploy/win/foo.ps1 改动 ⇒ 选中 deploy/tests/foo.test.mjs 且 exit 0', () => {
  const dir = makeRepo('ihui-rst-deploy-hit-')
  try {
    writeRel(dir, 'deploy/win/foo.ps1', '# dummy deploy script\n')
    writeRel(
      dir,
      'deploy/tests/foo.test.mjs',
      "import { test } from 'node:test'\ntest('foo deploy ok', () => {})\n",
    )
    const run = capture(() => main(['--changed', '--json'], dir))
    assert.equal(run.rc, 0, `deploy 改动命中对应测试且全绿必须 exit 0:\n${run.out}`)
    assert.ok(run.out.includes('SCRIPT-TESTS-CHANGED'), run.out)
    assert.ok(run.out.includes('files=2'), `改动面应含 foo.ps1 + foo.test.mjs:\n${run.out}`)
    assert.ok(run.out.includes('suites=1'), `应选中 1 枚 deploy/tests 用例:\n${run.out}`)
    assert.ok(!run.out.includes('map_zero'), '正向命中不得误报 0 映射')
    const json = JSON.parse(
      run.out
        .split('\n')
        .filter((l) => l.startsWith('{'))
        .pop(),
    )
    assert.equal(json.changed.suites, 1, 'deploy 用例必须被算进选中套数')
  } finally {
    cleanup(dir)
  }
})

test('--changed(有牙反向锁/本票):deploy 改动映射到 0 用例 ⇒ exit 2 且写 map_zero=true,绝不冒绿', () => {
  const dir = makeRepo('ihui-rst-deploy-zero-')
  const outFile = join(mkScratch('ihui-rst-out-'), 'gh-out.txt')
  const prev = process.env.GITHUB_OUTPUT
  process.env.GITHUB_OUTPUT = outFile
  try {
    // 只改一枚没有对应 deploy/tests 用例的部署脚本 ⇒ 触发了作业却对到 0 枚测试
    writeRel(dir, 'deploy/win/bar.ps1', '# no test for this deploy script\n')
    const run = capture(() => main(['--changed'], dir))
    assert.equal(run.rc, 2, `0 映射必须未判定 exit 2,不得冒绿:\n${run.out}`)
    assert.ok(run.out.includes('未判定'), run.out)
    assert.ok(!run.out.includes('✅'), '0 映射不得打印绿')
    assert.ok(
      !run.out.includes('SCRIPT-TESTS-CHANGED'),
      '0 映射不得输出结论计数行(那会被读成"判过了")',
    )
    // 这道是 CI 语义层有牙信号:workflow 的"映射为 0 即判红"步读它去把被 continue-on-error 吞掉的
    // exit 2 重新变红,否则又是"连续 8 晚"型假绿(一行没跑而结论 success)。
    const written = readFileSync(outFile, 'utf8')
    assert.ok(written.includes('map_zero=true'), `CI 语义层必须有牙信号,实得:${written}`)
  } finally {
    process.env.GITHUB_OUTPUT = prev
    cleanup(dir)
    rmSync(outFile, { force: true })
  }
})
