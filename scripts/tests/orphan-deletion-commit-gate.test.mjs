// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 孤儿删除闸(`check-orphan-deletion-refs.mjs --commit-gate`)的镜像测试(2026-11-05)。
//
// 为什么单独一个文件而不是塞进 git-guardian-orphan-audit.test.mjs:
// 那份测的是**巡检档**(warn,读 git-guardian 的审计口),本份测的是**提交前阻断档**(blocking,
// 读 judgeCommitGate + pre-commit-hook 接线)。两档共享 `auditOrphanDeletionRefs` 这一份判据,
// 但出口语义(红/绿/未判定)与射程(是否收窄到首列 D、是否查通知书)不同,混在一个用例里会让
// "谁在拦、拦的是哪一格"变得不可读 —— 事故复盘时最需要一眼看清的恰是这一格。
//
// 覆盖四型 + 装车证明:
//   A 未声明 ⇒ 红并点名(rc=1)
//   B 同一路径登记通知书 ⇒ 放行(rc=0,且打印"已声明放行"的读数)
//   C 索引删了但盘上还有未跟踪副本 ⇒ 放行(此型不拦,今日实测 7 条,硬拦即误伤)
//   D 取不到目标(仓库根不存在) ⇒ 未判定,不算绿
//   E pre-commit-hook.js 真把 `--commit-gate --quiet` 之后接上了 exit 1(不是只写在注释里)

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { judgeCommitGate } from '../check-orphan-deletion-refs.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const CHECK = join(REPO_ROOT, 'scripts', 'check-orphan-deletion-refs.mjs')
const HOOK = join(REPO_ROOT, 'scripts', 'lib', 'pre-commit-hook.js')
const NL = String.fromCharCode(10)

/** 建一个"HEAD 里有、引用方活着"的临时 git 仓;按开关把它变成不同脏型。 */
function fixture({ diskKeep = false, declared = false, unreferenced = false } = {}) {
  const dir = mkScratch('orphan-gate')
  const g = (args) => gitRaw(args, dir, { timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })
  const put = (rel, body) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), body, 'utf8')
  }
  g(['init', '-q'])
  g(['config', 'user.email', 'test@example.com'])
  g(['config', 'user.name', 'test'])
  g(['config', 'commit.gpgsign', 'false'])

  put('packages/shared/src/chat/mod.ts', 'export const a = 1' + NL)
  put(
    unreferenced ? 'apps/web/src/page.ts' : 'apps/web/src/page.ts',
    unreferenced
      ? 'export const b = 2' + NL
      : "import { a } from '../../../packages/shared/src/chat/mod.js'" +
          NL +
          'export const b = a' +
          NL,
  )
  g(['add', '-A'])
  g(['commit', '-q', '-m', 'base'])

  // 索引里删掉 + 磁盘按开关留不留 ⇒ 造出"HEAD 有 ∧ 索引无 ∧ 磁盘?"这一格
  g(['rm', '--cached', '-q', '--', 'packages/shared/src/chat/mod.ts'])
  if (!diskKeep) rmSync(join(dir, 'packages/shared/src/chat/mod.ts'), { force: true })

  if (declared) {
    const rel = 'scripts/data/intentional-file-deletions.jsonl'
    put(
      rel,
      JSON.stringify({
        path: 'packages/shared/src/chat/mod.ts',
        reason: '镜像测试：整文件有意删除，验证通知书放行',
        at: '2026-11-05T00:00:00.000Z',
      }) + NL,
    )
  }
  return dir
}

function runCli(dir, extra = []) {
  const r = spawnSync(process.execPath, [CHECK, '--commit-gate', '--root', dir, ...extra], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120_000,
  })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

test('A 未声明的孤儿删除:判红、点名路径与引用方、给出两条出路', () => {
  const dir = fixture()
  try {
    const g = judgeCommitGate(dir)
    assert.equal(g.verdict, 'blocked')
    assert.equal(g.blocked.length, 1, '应当恰好一条命中')
    assert.equal(g.blocked[0].path, 'packages/shared/src/chat/mod.ts')
    assert.ok(
      g.blocked[0].via.some((v) => v.endsWith('apps/web/src/page.ts')),
      `引用方应包含 page.ts,实际 ${JSON.stringify(g.blocked[0].via)}`,
    )
    // fixture 里根本没有台账文件 ⇒ 三态判据给 absent-ledger(与 not-declared 同结论:无保护)
    assert.equal(g.blocked[0].notice, 'absent-ledger')

    const cli = runCli(dir)
    assert.equal(cli.status, 1, '阻断档必须以 1 退出')
    assert.match(cli.stderr, /packages\/shared\/src\/chat\/mod\.ts/, '点名被删路径')
    assert.match(cli.stderr, /--declare-deletion/, '点名声明修法')
    assert.match(cli.stderr, /git checkout HEAD --/, '点名"放回工作树"修法')
  } finally {
    rmScratch(dir)
  }
})

test('B 同一路径已登记通知书:放行,并打印"已声明放行"的读数', () => {
  const dir = fixture({ declared: true })
  try {
    const g = judgeCommitGate(dir)
    assert.equal(g.verdict, 'clean')
    assert.equal(g.blocked.length, 0)
    assert.deepEqual(
      g.declared.map((d) => d.path),
      ['packages/shared/src/chat/mod.ts'],
    )

    const cli = runCli(dir)
    assert.equal(cli.status, 0, '已声明的删除必须放行')
    assert.match(cli.stdout, /已由通知书声明、本次放行/)
  } finally {
    rmScratch(dir)
  }
})

test('C 索引删了但盘上还有未跟踪副本:放行(这一型不该拦)', () => {
  const dir = fixture({ diskKeep: true })
  try {
    const g = judgeCommitGate(dir)
    assert.equal(g.verdict, 'clean')
    assert.equal(g.orphanIndex.length, 0, '磁盘上还有文件就不算孤儿删除')
    assert.equal(runCli(dir).status, 0)
  } finally {
    rmScratch(dir)
  }
})

test('D 取不到目标(仓库根不存在):未判定,不得计绿', () => {
  const g = judgeCommitGate(join(REPO_ROOT, 'no-such-repo-root-for-test'))
  assert.notEqual(g.verdict, 'clean', '判不出不等于没问题')
  assert.equal(g.verdict, 'undetermined')
  assert.ok(g.undetermined.length > 0, '必须留下未判定的原因')
})

test('E 装车证明:pre-commit-hook.js 在 --commit-gate 之后真的 exit 1', () => {
  const hook = readFileSync(HOOK, 'utf8')
  const at = hook.indexOf('check-orphan-deletion-refs.mjs --commit-gate --quiet')
  assert.ok(at > 0, '钩子里必须真实调用提交前档,不是只写在注释里')
  const tail = hook.slice(at, at + 900)
  assert.match(tail, /catch\s*\{[\s\S]*process\.exit\(1\)/, '调用失败后必须 exit 1')
  assert.ok(
    !tail.includes('HUSKY_SKIP'),
    '不设应急跳过键:登记有误时走 --declare-deletion,不给一键绕过',
  )
})

test('F 无人引用的孤儿:只报数不判红(避免把普通 git rm 全拦死)', () => {
  const dir = fixture({ unreferenced: true })
  try {
    const g = judgeCommitGate(dir)
    assert.equal(g.verdict, 'clean')
    assert.deepEqual(g.orphanIndex, ['packages/shared/src/chat/mod.ts'], '孤儿数仍要如实报出')
    assert.equal(g.blocked.length, 0)
    // 输出仍是"孤儿 1 条 / 命中 0 条",不能把孤儿读成不存在
    const r = execFileSync(process.execPath, [CHECK, '--commit-gate', '--quiet', '--root', dir], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 120_000,
    })
    assert.equal(r, '')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
