// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:check-bypass-landing-scope(守门 169)。
 * 直接 import 源模块与读真仓源码形状,不复制任何判据实现。
 *  - T1 方向锁:runner 已登记(脚本声称已接线必须为真,门 89 R1 的镜像)
 *  - T2 留痕日志路径单一来源:不得在门里再拼第二份 .workbuddy 台账路径
 *  - T3~T7 端到端:真脚本 + 夹具仓 + 合成留痕 ⇒ 红/绿/台账/缺失/--strict 的退出码契约
 *  - T8 装车形状:skipEnv 在门头注与 runner 条目里逐字同形
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { LEDGER_REL, BYPASS_KIND } from '../lib/commit-attestation.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const GATE = resolve(ROOT, 'scripts', 'check-bypass-landing-scope.mjs')
const GIT = 'C:/Program Files/Git/cmd/git.exe'

const gateSrc = readFileSync(GATE, 'utf8')
const runnerSrcOf = () =>
  execFileSync(GIT, ['cat-file', 'blob', 'HEAD:scripts/guardian-runner.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString()

function repo(prefix) {
  const dir = mkScratch(prefix)
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300_000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  return { dir, run }
}
const put = (dir, rel, text) => {
  const p = join(dir, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text, 'utf8')
}
const writeJournal = (dir, recs, broken = '') => {
  const p = resolve(dir, LEDGER_REL)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, broken + recs.map((o) => JSON.stringify(o)).join('\n') + '\n', 'utf8')
}
const bypassCommit = (dir, run, mutate) => {
  mutate()
  run('add', '-A')
  const tree = run('write-tree').trim()
  const head = run('rev-parse', 'HEAD').trim()
  return run('commit-tree', tree, '-p', head, '-m', 'bypass (mirror)').trim()
}
const runGate = (dir, args = []) =>
  spawnSync(process.execPath, [GATE, '--root', dir, ...args], {
    encoding: 'utf8',
    timeout: 300_000,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
const rec = (sha, declared, source = 'mirror') => ({
  ts: '2026-09-30T00:00:00Z',
  kind: BYPASS_KIND,
  landedSha: sha,
  declaredFiles: declared,
  source,
})
/** v1 → v2 → 旁路提交把 a.txt 写回 v1(声明面不含 a.txt)—— 事故的最小回放 */
function incident(dir, run) {
  put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
  put(dir, 'a.txt', 'v2\n'); run('add', '-A'); run('commit', '-qm', 'c2')
  return bypassCommit(dir, run, () => put(dir, 'a.txt', 'v1\n'))
}

test('T1 方向锁:runner 已登记 170(HEAD 面),脚本文件存在且为 blocking', () => {
  const runnerSrc = runnerSrcOf()
  assert.match(runnerSrc, /id: '170'/)
  assert.match(runnerSrc, /script: 'check-bypass-landing-scope\.mjs'/)
  const entry = runnerSrc.slice(runnerSrc.indexOf("id: '170'"), runnerSrc.indexOf("id: '170'") + 900)
  assert.match(entry, /mode: 'blocking'/)
  assert.ok(existsSync(GATE), '门脚本必须在仓里')
})

test('T8 装车形状:skipEnv 在门头注与 runner 条目逐字同形(HEAD 面;两处漂开 = 跳过通道失灵)', () => {
  const runnerSrc = runnerSrcOf()
  const env = 'HUSKY_SKIP_BYPASS_LANDING_SCOPE'
  assert.ok(gateSrc.includes(env), '门头注必须带紧急跳过名')
  const entry = runnerSrc.slice(runnerSrc.indexOf("id: '170'"), runnerSrc.indexOf("id: '170'") + 900)
  assert.ok(entry.includes(env), 'runner 条目必须带同一个紧急跳过名')
})

test('T2 留痕日志路径单一来源:判据经 lib/commit-attestation 取面,代码里不得再拼第二份路径(头注散文点名不在其列)', () => {
  assert.match(gateSrc, /from '\.\/lib\/commit-attestation\.mjs'/)
  const codeLines = gateSrc.split('\n').filter((l) => !/^\s*(\*|\/\/)/.test(l)).join('\n')
  assert.ok(!codeLines.includes('safe-commit-attestation'), '代码里出现台账文件名 = 第二份真相(应 import reader/常量)')
})

test('T3 端到端阳性:事故回放 ⇒ exit 1 并点名写回路径与祖先', () => {
  const { dir, run } = repo('bypass-mt-red-')
  try {
    const sha = incident(dir, run)
    writeJournal(dir, [rec(sha, ['declared-only.txt'])])
    const r = runGate(dir)
    assert.equal(r.status, 1, `stdout=${r.stdout}\nstderr=${r.stderr}`)
    assert.match(r.stdout + r.stderr, /a\.txt/)
    assert.match(r.stdout + r.stderr, /写回旧态/)
  } finally { rmScratch(dir) }
})

test('T4 端到端阴性:声明覆盖实际 ⇒ exit 0(不是恒红门)', () => {
  const { dir, run } = repo('bypass-mt-clean-')
  try {
    put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
    const sha = bypassCommit(dir, run, () => put(dir, 'a.txt', 'v2\n'))
    writeJournal(dir, [rec(sha, ['a.txt'])])
    const r = runGate(dir)
    assert.equal(r.status, 0, `stdout=${r.stdout}\nstderr=${r.stderr}`)
    assert.match(r.stdout, /通过/)
  } finally { rmScratch(dir) }
})

test('T5 增量台账:红只点名一次,复跑不再红(台账不是豁免,内容仍须修)', () => {
  const { dir, run } = repo('bypass-mt-once-')
  try {
    const sha = incident(dir, run)
    writeJournal(dir, [rec(sha, ['declared-only.txt'])])
    assert.equal(runGate(dir).status, 1)
    const r2 = runGate(dir)
    assert.equal(r2.status, 0, `复跑应被台账吸收:${r2.stdout}${r2.stderr}`)
    assert.match(r2.stdout, /已判过跳过 1/)
    assert.ok(existsSync(join(dir, '.workbuddy', 'bypass-landing-scope-audited.json')))
  } finally { rmScratch(dir) }
})

test('T6 留痕日志缺失 ⇒ exit 2(未判定,绝不静默绿)', () => {
  const { dir, run } = repo('bypass-mt-missing-')
  try {
    put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
    const r = runGate(dir)
    assert.equal(r.status, 2, `stdout=${r.stdout}\nstderr=${r.stderr}`)
    assert.match(r.stderr, /无法判定/)
  } finally { rmScratch(dir) }
})

test('T7 --strict:未判定记录(空声明面)⇒ exit 2;不带 --strict ⇒ exit 0 且点名', () => {
  const { dir, run } = repo('bypass-mt-strict-')
  try {
    put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
    const sha = bypassCommit(dir, run, () => put(dir, 'a.txt', 'v2\n'))
    writeJournal(dir, [{ ts: '2026-09-30T00:00:00Z', kind: BYPASS_KIND, landedSha: sha, source: 'mirror' }])
    const loose = runGate(dir)
    assert.equal(loose.status, 0, `stdout=${loose.stdout}${loose.stderr}`)
    assert.match(loose.stdout, /未判定/)
    // 松跑已把该记录写进增量台账(S6 判一次);删台账走重判路径,--strict 才能再见到未判定
    rmSync(join(dir, '.workbuddy', 'bypass-landing-scope-audited.json'))
    const strict = runGate(dir, ['--strict'])
    assert.equal(strict.status, 2)
  } finally { rmScratch(dir) }
})

test('T9 坏行不吞记录:坏行计数,其余照判', () => {
  const { dir, run } = repo('bypass-mt-badline-')
  try {
    put(dir, 'a.txt', 'v1\n'); run('add', '-A'); run('commit', '-qm', 'c1')
    const sha = bypassCommit(dir, run, () => put(dir, 'a.txt', 'v2\n'))
    writeJournal(dir, [rec(sha, ['a.txt'])], '{broken\n')
    const r = runGate(dir)
    assert.equal(r.status, 0)
    assert.match(r.stdout, /坏行 1/)
    assert.match(r.stdout, /clean 1/)
  } finally { rmScratch(dir) }
})
