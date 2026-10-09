// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/git-heal-broken-links.mjs` 的 §22c 镜像测试。
 *
 * 三条纪律:
 *  ① **判据一律 import 生产导出**,测试内不复制解析/判读逻辑(§22c:镜像常量漂移 = 假绿)。
 *  ② 端到端那两例跑在**临时 git 仓**里(经 IHUI_HEAL_ROOT 测试通道),绝不拿真仓做删对象实验。
 *  ③ "对端取不到"与"对端确认没有"必须是两例分开的断言 —— 把没问到写成没有,是本仓最高频失效型。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(SELF_DIR, '..', '..')
const TOOL = join(ROOT, 'scripts', 'git-heal-broken-links.mjs')
const GIT = process.env.IHUI_GIT_BIN || 'git'

const gate = await import(pathToFileURL(TOOL).href)
const { parseBrokenLinks, depthOf, planFetches, classifyNeeds, decideWrite, isEmptyFetch } = gate

function g(cwd, args, opts = {}) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    encoding: 'utf8',
    ...opts,
  })
}

function scratch(label) {
  const dir = mkdtempSync(join(tmpdir(), `ihui-heal-${label}-`))
  return dir
}

/**
 * 造一枚"父 tree 在、blob 被删"的临时仓:断链是真的,而不是夹具叙述。返回**目录路径**。
 * beforeBreak 在"删对象"之前拿到仓目录 —— 需要先把对象推给 origin 的用例必须走它
 * (删后 push 会被 unpacker error 拒)。
 */
function makeBrokenRepo(label, beforeBreak) {
  const dir = scratch(label)
  g(dir, ['init', '-q'])
  g(dir, ['config', 'user.email', 't@example.invalid'])
  g(dir, ['config', 'user.name', 't'])
  writeFileSync(join(dir, 'a.txt'), 'content-under-test\n')
  g(dir, ['add', 'a.txt'])
  g(dir, ['commit', '-q', '-m', 'seed'])
  const blob = g(dir, ['rev-parse', 'HEAD:a.txt']).trim()
  const short = `${blob.slice(0, 2)}/${blob.slice(2)}`
  const loose = join(dir, '.git', 'objects', short)
  assert.ok(existsSync(loose), `夹具前提:松散对象应在 ${short}`)
  if (typeof beforeBreak === 'function') beforeBreak(dir)
  rmSync(loose)
  return dir
}

test('T1 解析按 fsck 的真实缩进形态取三元组(生产导出,不复制判据)', () => {
  const out = g(ROOT, ['fsck', '--connectivity-only', '--name-objects', '--no-progress'], {
    timeout: 900000,
    maxBuffer: 512 * 1024 * 1024,
  })
  const { rows } = parseBrokenLinks(out)
  // 真仓当下应无断链;这里钉的是"解析器对真实输出形态可用",不是"仓库有没有病"。
  assert.ok(Array.isArray(rows))
  const shaped = parseBrokenLinks(
    [
      'broken link from    tree 400a5971c9a8ea890c6310f5b73f8070e5986134 (refs/tags/lost-commit/wip-batch-7736f5c:packages/i18n/messages/web/en.json)',
      '              to    blob 13ca5eab3892f3bb126bd61aa157433bd9e0306d (refs/tags/lost-commit/wip-batch-7736f5c:packages/i18n/messages/web/en.json)',
    ].join('\n'),
  )
  assert.equal(shaped.rows.length, 1)
  assert.equal(shaped.rows[0].missingOid, '13ca5eab3892f3bb126bd61aa157433bd9e0306d')
  assert.equal(shaped.rows[0].refExpr, 'refs/tags/lost-commit/wip-batch-7736f5c')
  assert.equal(shaped.rows[0].path, 'packages/i18n/messages/web/en.json')
})

test('T2 深度与基 ref:~4⇒5、^^⇒3,无归属不进计划', () => {
  assert.equal(depthOf('refs/tags/a'), 1)
  assert.equal(depthOf('refs/tags/a~4'), 5)
  assert.equal(depthOf('refs/tags/a^^'), 3)
  const plans = planFetches([{ refExpr: 'refs/tags/a~4' }, { refExpr: 'refs/tags/a~13' }, { refExpr: '' }])
  assert.equal(plans.length, 1)
  assert.equal(plans[0].depth, 14)
})

test('T3 内容地址一致才算取回:不符/空返回/报错三型都不得记成成功', () => {
  assert.equal(decideWrite('aaa', 'aaa\n', null).state, 'restored')
  assert.equal(decideWrite('aaa', 'bbb', null).state, 'mismatch')
  assert.equal(decideWrite('aaa', '', null).state, 'failed')
  assert.equal(decideWrite('aaa', null, new Error('boom')).state, 'failed')
})

test('T4 检出需要与只住备份标签分两桶,去重按缺失对象', () => {
  const rows = [{ missingOid: 'x', refExpr: 'refs/tags/t' }, { missingOid: 'x', refExpr: 'refs/tags/t' }, { missingOid: 'y', refExpr: 'refs/tags/t' }]
  const cls = classifyNeeds(rows, (oid) => oid === 'x')
  assert.deepEqual(cls.needed.map((r) => r.missingOid), ['x'])
  assert.deepEqual(cls.backupOnly.map((r) => r.missingOid), ['y'])
  assert.equal(cls.distinct, 2)
})

test('T5 端到端·正向:origin 在位时断链真的被补回,复测归零', () => {
  const origin = scratch('e2e-origin')
  let work = null
  try {
    g(origin, ['init', '-q', '--bare'])
    // 先把对象推给 origin、再删本地松散对象:删后 push 会被 unpacker error 拒。
    work = makeBrokenRepo('e2e-restore', (dir) => {
      g(dir, ['remote', 'add', 'origin', origin])
      g(dir, ['push', '-q', '-u', 'origin', 'HEAD'])
    })
    const res = spawnSync(process.execPath, [TOOL, '--apply'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
      env: { ...process.env, IHUI_HEAL_ROOT: work },
    })
    const out = `${res.stdout || ''}${res.stderr || ''}`
    assert.match(out, /取回落库 [1-9]/, `应报"取回落库 ≥1",实际输出:${out.slice(0, 400)}`)
    assert.match(out, /复测:断链余 0 条/, `复测应归零,实际输出:${out.slice(0, 400)}`)
    assert.equal(res.status, 0, `正向那一趟应 rc=0,实际 ${res.status}`)
    // 补回的必须逐字节可用:内容能从对象库读出且哈希一致
    const blobOid = g(work, ['rev-parse', 'HEAD:a.txt']).trim()
    assert.equal(g(work, ['cat-file', 'blob', blobOid]), 'content-under-test\n')
  } finally {
    if (work) rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

test('T6 端到端·反向:origin 取不到时只报未判定,不做任何写动作', () => {
  const work = makeBrokenRepo('e2e-noorigin')
  try {
    const res = spawnSync(process.execPath, [TOOL, '--apply'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
      env: { ...process.env, IHUI_HEAL_ROOT: work },
    })
    const out = `${res.stdout || ''}${res.stderr || ''}`
    assert.match(out, /未判定/, `应喊未判定,实际:${out.slice(0, 300)}`)
    assert.doesNotMatch(out, /取回落库 [1-9]/, `无 origin 却取回落库 = 判据说谎:${out.slice(0, 300)}`)
    assert.equal(res.status, 2, `取不到 origin 的收尾档应 rc=2,实际 ${res.status}`)
    assert.throws(() => g(work, ['cat-file', '-e', g(work, ['rev-parse', 'HEAD:a.txt']).trim()]))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})

test('T7 空取回判据:空字节+非空期望才判"没取到",空对象 oid 仍是合法目标', () => {
  // 判据来自生产导出 isEmptyFetch;第二臂的入参是 git 规范空 blob oid
  // (主脚本未导出 EMPTY_OID_BY_KIND 那张表,这里是输入值不是第二份判据)。
  const emptyBlobOid = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'
  const nonEmptyOid = '41b65ea84bd0c62f4b8e58f79eebbc83ab3e8e6f'
  assert.equal(isEmptyFetch(Buffer.alloc(0), 'blob', nonEmptyOid), true)
  assert.equal(isEmptyFetch(Buffer.alloc(0), 'blob', emptyBlobOid), false)
  assert.equal(isEmptyFetch(Buffer.from('x\n'), 'blob', nonEmptyOid), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
