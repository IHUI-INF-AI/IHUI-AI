// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门体同代自检的回归用例(2026-11-08)。
 *
 * 钉住三处历史事故的**形态**,不是钉住某一道门的名字:
 *   A. 旧门体 + 新数据:HEAD 里是新一代门体/数据,盘上却回滚成旧一代门体 ⇒ exit 2;
 *   B. 门体在被判树里不存在:仓里根本没有这道门,盘上却有未跟踪门体 ⇒ exit 2;
 *   C. 写回面与判面不一致:env 判 HEAD、argv 声明 staged ⇒ exit 2(判面冲突本身就不许作答)。
 * 每例都断言:退出码 2、stderr 自称「未判定」、且**不打印具体违规条数**(门没有资格数违规)。
 */

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  blobShaOfText,
  gateBodyClosure,
  normalizeEol,
  parseFaceFromArgv,
  resolveGateFace,
  shortSha,
} from '../lib/gate-body-provenance.mjs'
import {
  computeWorldKey,
  formatRetryReport,
  recordAndClassify,
  RETRY_RED_THRESHOLD,
} from '../lib/gate-attempt-ledger.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const LIB_URL = pathToFileURL(join(HERE, '..', 'lib', 'gate-body-provenance.mjs')).href
const GIT = 'git'

function git(cwd, args) {
  return execFileSync(GIT, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-gate-body-'))
  git(dir, ['init', '-q'])
  git(dir, ['config', 'user.email', 'gate@ihui.test'])
  git(dir, ['config', 'user.name', 'gate-body-test'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
  mkdirSync(join(dir, 'scripts', 'data'), { recursive: true })
  return dir
}

function commit(dir, message) {
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', message])
  return git(dir, ['rev-parse', 'HEAD']).trim()
}

function write(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/** 用真实 lib 的 preflight 跑一枚夹具门,返回 {status, stderr, stdout}。 */
function runPreflight(dir, { entryRel, args = [], env = {} }) {
  const r = spawnSync(process.execPath, ['--import', LIB_URL, join(dir, entryRel), ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      IHUI_GATE_BODY_PREFLIGHT: '1',
      IHUI_GATE_BODY_ENTRY: entryRel,
      ...env,
    },
  })
  return { status: r.status, stderr: String(r.stderr ?? ''), stdout: String(r.stdout ?? '') }
}

function assertUndetermined(r) {
  assert.equal(r.status, 2, `必须 exit 2,实际 ${r.status}: ${r.stderr}`)
  assert.match(r.stderr, /未判定/, 'stderr 必须自称未判定,否则会被当成刻意 exit 2 顶红')
  assert.doesNotMatch(r.stderr, /\d+\s*条/, '门体自检不许打印违规条数')
  assert.doesNotMatch(r.stderr, /violations?\s*[:=]\s*\d+/i)
}

const GATE_V1 = `console.log('gate-v1')\n`
const GATE_V2 = `console.log('gate-v2')\n`
const GATE_WITH_LIB = `import './lib/immutable-fixture.mjs'\nconsole.log('gate-lib')\n`
const LIB_V1 = `export const PROTECTED_KINDS = new Set(['feat'])\n`
const LIB_V2 = `export const PROTECTED_KINDS = new Set(['feat', 'autonomy-executor', 'autonomy-cost'])\n`

test('A. 旧门体 + 新数据:盘上回滚成旧一代门体,HEAD 是新一代 ⇒ exit 2', () => {
  const dir = makeRepo()
  try {
    write(dir, 'scripts/check-fixture-gate.mjs', GATE_V1)
    write(dir, 'scripts/data/fixture-legacy.json', '{"generation":1}\n')
    commit(dir, 'gen-1')
    write(dir, 'scripts/check-fixture-gate.mjs', GATE_V2)
    write(dir, 'scripts/data/fixture-legacy.json', '{"generation":2}\n')
    commit(dir, 'gen-2')
    // 模拟"旧门体回写":盘上退回 gen-1 的门体,而 HEAD 已是 gen-2。
    write(dir, 'scripts/check-fixture-gate.mjs', GATE_V1)

    const r = runPreflight(dir, { entryRel: 'scripts/check-fixture-gate.mjs', args: ['--head'] })
    assertUndetermined(r)
    assert.match(r.stderr, /scripts\/check-fixture-gate\.mjs/, '必须点名门体路径')
    assert.match(r.stderr, /本地正在执行的门体 blob: [0-9a-f]{7}/)
    assert.match(r.stderr, /被判修订中该路径 blob: [0-9a-f]{7}/)

    // 唯一逃生口:显式声明"按工作树门体判"⇒ 放行且留痕,不是静默跳过。
    const escaped = runPreflight(dir, {
      entryRel: 'scripts/check-fixture-gate.mjs',
      args: ['--head'],
      env: { IHUI_GATE_BODY_SOURCE: 'worktree' },
    })
    assert.equal(escaped.status, 0)
    assert.match(escaped.stderr, /IHUI_GATE_BODY_SOURCE=worktree/)
    assert.match(escaped.stdout, /gate-v1/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('A2. 门体闭包里的 lib 换代(事故①原形)⇒ exit 2 并点名 lib', () => {
  const dir = makeRepo()
  try {
    write(dir, 'scripts/check-fixture-lib-gate.mjs', GATE_WITH_LIB)
    write(dir, 'scripts/lib/immutable-fixture.mjs', LIB_V1)
    commit(dir, 'lib-gen-1')
    write(dir, 'scripts/lib/immutable-fixture.mjs', LIB_V2)
    commit(dir, 'lib-gen-2')
    write(dir, 'scripts/lib/immutable-fixture.mjs', LIB_V1)

    const r = runPreflight(dir, { entryRel: 'scripts/check-fixture-lib-gate.mjs', args: ['--head'] })
    assertUndetermined(r)
    assert.match(r.stderr, /scripts\/lib\/immutable-fixture\.mjs/, '被回写的 lib 必须被点名')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('B. 门体在被判树里不存在 ⇒ exit 2,且写"不存在"而不是编造 sha', () => {
  const dir = makeRepo()
  try {
    write(dir, 'scripts/README-fixture.md', 'base\n')
    commit(dir, 'base')
    // 未跟踪的新门体:盘上有,HEAD 里没有。
    write(dir, 'scripts/check-fixture-gate.mjs', GATE_V1)

    const r = runPreflight(dir, { entryRel: 'scripts/check-fixture-gate.mjs', args: ['--head'] })
    assertUndetermined(r)
    assert.match(r.stderr, /被判修订中该路径 blob: 不存在/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('C. 写回面与判面不一致:env=head 而 argv=--staged ⇒ exit 2', () => {
  const dir = makeRepo()
  try {
    write(dir, 'scripts/check-fixture-gate.mjs', GATE_V1)
    commit(dir, 'base')
    // 盘/HEAD 同代,唯一的问题就是两个判面声明互相打架。
    const r = runPreflight(dir, {
      entryRel: 'scripts/check-fixture-gate.mjs',
      args: ['--staged'],
      env: { IHUI_GATE_FACE: 'head' },
    })
    assertUndetermined(r)
    assert.match(r.stderr, /判面声明冲突/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('C2. 未声明判面 ⇒ exit 2(不许猜 HEAD 也不许猜工作树)', () => {
  const dir = makeRepo()
  try {
    write(dir, 'scripts/check-fixture-gate.mjs', GATE_V1)
    commit(dir, 'base')
    const r = runPreflight(dir, { entryRel: 'scripts/check-fixture-gate.mjs' })
    assertUndetermined(r)
    assert.match(r.stderr, /未声明判面/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('D. 纯函数:判面解析 / 冲突 / EOL 归一 / blob sha 短号', () => {
  assert.deepEqual(parseFaceFromArgv(['--head']), { face: 'head', source: '--head' })
  assert.deepEqual(parseFaceFromArgv(['--face=rev:abc1234']), { face: 'rev:abc1234', source: '--face' })
  assert.equal(parseFaceFromArgv([]), null)
  assert.throws(() => parseFaceFromArgv(['--staged', '--worktree']), /判面声明冲突/)
  assert.throws(() => parseFaceFromArgv(['--face=nowhere']), /不合法/)

  assert.equal(normalizeEol('a\r\nb\rc\n'), 'a\nb\nc\n')
  assert.equal(blobShaOfText('a\r\nb\n'), blobShaOfText('a\nb\n'), 'EOL 差异不应造成误判 2')
  assert.equal(shortSha('0123456789abcdef').length, 7)

  const dir = makeRepo()
  try {
    write(dir, 'scripts/check-fixture-gate.mjs', "import './lib/dep.mjs'\n")
    write(dir, 'scripts/lib/dep.mjs', "import './dep2.mjs'\n")
    write(dir, 'scripts/lib/dep2.mjs', 'export const x = 1\n')
    assert.deepEqual(gateBodyClosure(dir, 'scripts/check-fixture-gate.mjs'), [
      'scripts/check-fixture-gate.mjs',
      'scripts/lib/dep.mjs',
      'scripts/lib/dep2.mjs',
    ])
    assert.throws(
      () => resolveGateFace({ root: dir, entryRel: 'scripts/check-fixture-gate.mjs', argv: [], env: {} }),
      /未声明判面/,
    )
    // 声明表缺省 auto:无旗 ⇒ HEAD 面。
    write(
      dir,
      'scripts/data/gate-face-declarations.json',
      JSON.stringify({ entries: { 'scripts/check-fixture-gate.mjs': { face: 'auto' } } }),
    )
    assert.equal(
      resolveGateFace({ root: dir, entryRel: 'scripts/check-fixture-gate.mjs', argv: [], env: {} }).face,
      'head',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('E. 重试变绿:同指纹下先红两次后转绿 ⇒ UNDETERMINED', () => {
  const dir = makeRepo()
  try {
    write(dir, 'x.txt', '1\n')
    commit(dir, 'base')
    const world = computeWorldKey(dir)
    assert.ok(world?.key)
    const gateId = 'fixture-retry'
    recordAndClassify({ root: dir, gateId, kind: 'red', summary: 'boom-1', now: 1 })
    recordAndClassify({ root: dir, gateId, kind: 'red', summary: 'boom-2', now: 2 })
    const verdict = recordAndClassify({ root: dir, gateId, kind: 'pass', summary: 'ok', now: 3 })
    assert.equal(verdict.undetermined, true)
    assert.equal(verdict.reds.length, RETRY_RED_THRESHOLD)
    const report = formatRetryReport({ gateId, label: '夹具门', reds: verdict.reds })
    assert.match(report, /未判定/)
    assert.match(report, /第 1 次红/)
    assert.match(report, /boom-1/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('E2. 红一次就过 / 换了内容指纹 ⇒ 不判未判定', () => {
  const dir = makeRepo()
  try {
    write(dir, 'x.txt', '1\n')
    commit(dir, 'base')
    recordAndClassify({ root: dir, gateId: 'g-red-once', kind: 'red', summary: 'once', now: 1 })
    const ok = recordAndClassify({ root: dir, gateId: 'g-red-once', kind: 'pass', summary: 'ok', now: 2 })
    assert.equal(ok.undetermined, false)

    recordAndClassify({ root: dir, gateId: 'g-changed', kind: 'red', summary: 'r1', now: 1 })
    recordAndClassify({ root: dir, gateId: 'g-changed', kind: 'red', summary: 'r2', now: 2 })
    // 真的改了被判内容(进索引)⇒ 换指纹,新结论不再受旧红影响。
    write(dir, 'x.txt', '2\n')
    git(dir, ['add', 'x.txt'])
    const fresh = recordAndClassify({ root: dir, gateId: 'g-changed', kind: 'pass', summary: 'ok', now: 3, ttlMs: 0 })
    assert.equal(fresh.undetermined, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
