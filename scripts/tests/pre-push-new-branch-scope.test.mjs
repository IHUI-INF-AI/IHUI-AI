// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:.husky/pre-push 「新分支档 push scope」的二级推导。
 *
 * 病灶(2026-11-03 实测):新分支(`rsha` 全零)只走 `git show --name-only --format= $lsha`;
 * tip 是 merge commit 时 combined diff 恒为 0 行 ⇒ PUSH_SCOPE_FILES 为空 ⇒ 下游门(47p)
 * 退回 HEAD 全量面(实测 31224ms)。修法是补一条「相对目标分支合并基点取差集」的二级推导。
 *
 * 为什么不另写一份判据:这段逻辑住在 shell 里,测试里重抄一遍就成了第二把尺子
 * (AGENTS §0.6 单一真相源)。本器把钩子**当前那段 case 块逐字抠出来**喂真 sh 跑夹具 ⇒
 * 测的就是钩子自己会用的那条判据;抠不到即判红(钩子被改写 ⇒ 锁必须响,不能静默空转)。
 *
 * 四格断言:
 *   T1 形状锁 —— 二级推导必须仍住在钩子原文里;
 *   T2 普通提交 —— 输出与 `git show --name-only` 逐行一致(旧行为不得漂移);
 *   T3 merge tip —— `git show` 为空,二级给出**非空**且**只含本分支真实变更**的清单;
 *   T4 merge tip 且取不到 origin/main —— 输出空(下游维持「回退全量面 + 告警」,不伪造 scope)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = readFileSync(join(ROOT, '.husky', 'pre-push'), 'utf8')
const ZERO = '0'.repeat(40)

/**
 * 跑钩子块的 POSIX shell。POSIX 平台直接 `sh`;Windows 上 Node 的 PATH 未必含 Git 自带
 * sh(本机实测 ENOENT),按 `git --exec-path` 推导 `<GitRoot>/bin/sh.exe`,再退回 usr/bin。
 * 找不到 ⇒ 直接判红(不静默跳测 —— 跳过测试等于判据失效)。
 */
function resolveShell() {
  if (!spawnSync('sh', ['-c', 'exit 0'], { stdio: 'ignore' }).error) return 'sh'
  const r = spawnSync('git', ['--exec-path'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (!r.error && r.status === 0) {
    const gitRoot = dirname(dirname(dirname(r.stdout.trim().replaceAll('\\', '/'))))
    for (const rel of ['bin/sh.exe', 'usr/bin/sh.exe']) {
      const p = join(gitRoot, ...rel.split('/'))
      if (existsSync(p)) return p
    }
  }
  assert.fail('找不到可用的 POSIX sh(钩子块无法执行,判据不可判定)')
  return null
}
const SHELL = resolveShell()
const BEGIN_MARK = '# >>> push-scope-new-branch'
const END_MARK = '# <<< push-scope-new-branch'

/** 逐字抽取钩子里那段 case 块(含 `case`/`esac`),抠不到返回 null。 */
function extractBlock() {
  const lines = HOOK.split(/\r?\n/)
  const begin = lines.findIndex((l) => l.includes(BEGIN_MARK))
  const end = lines.findIndex((l) => l.includes(END_MARK))
  if (begin < 0 || end <= begin) return null
  const block = lines.slice(begin + 1, end).join('\n')
  return block.includes('case "$rsha" in') && block.trimEnd().endsWith('esac') ? block : null
}

const BLOCK = extractBlock()

/** 派生 git 调用一律显式接管 stdio(AGENTS §12g,不写稳定 EBUSY)。 */
function git(repo, args) {
  const r = spawnSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', ...args], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr}`)
  return r.stdout.trim()
}

function lines(out) {
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
}

/** 用钩子里的原文块算一次 scope(lsha/rsha 与钩子从 stdin 读到的同形)。 */
function derive(repo, { lsha, rsha }) {
  assert.ok(BLOCK, '钩子里抠不到 push-scope-new-branch 块 —— 判据被改写,锁必须响')
  const r = spawnSync(SHELL, ['-c', BLOCK], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, lsha, rsha },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `sh 跑钩子块失败:${r.stderr}`)
  return lines(r.stdout)
}

/**
 * 夹具:bare origin + 工作仓。造出「分支上先普通提交(B),main 再推进(C),分支 merge main
 * 得到 merge tip(M)」的现场 —— 这正是线上取不到 scope 的那一型。
 */
function makeFixture(t) {
  const dir = mkScratch('ihui-prepush-scope-')
  t.after(() => rmScratch(dir))
  const origin = join(dir, 'origin.git')
  const work = join(dir, 'work')
  for (const args of [
    ['init', '--bare', '-b', 'main', origin],
    ['init', '-b', 'main', work],
  ]) {
    const r = spawnSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr}`)
  }
  git(work, ['remote', 'add', 'origin', origin])
  writeFileSync(join(work, 'a.txt'), 'a\n')
  git(work, ['add', 'a.txt'])
  git(work, ['commit', '-m', 'A'])
  git(work, ['push', '-u', 'origin', 'main'])
  git(work, ['fetch', 'origin'])

  git(work, ['checkout', '-b', 'feat'])
  writeFileSync(join(work, 'b.txt'), 'b\n')
  git(work, ['add', 'b.txt'])
  git(work, ['commit', '-m', 'B'])
  const b = git(work, ['rev-parse', 'HEAD'])

  git(work, ['checkout', 'main'])
  writeFileSync(join(work, 'c.txt'), 'c\n')
  git(work, ['add', 'c.txt'])
  git(work, ['commit', '-m', 'C'])
  git(work, ['push', 'origin', 'main'])

  git(work, ['checkout', 'feat'])
  git(work, ['fetch', 'origin'])
  git(work, ['merge', 'origin/main', '--no-edit'])
  const m = git(work, ['rev-parse', 'HEAD'])
  return { work, b, m }
}

test('T1 形状锁:二级推导必须仍住在钩子原文里', () => {
  assert.ok(BLOCK, '抠不到 push-scope-new-branch 块(起止标记或 case 结构被改写)')
  assert.match(BLOCK, /git show --name-only --format= "\$lsha"/, '一级推导(commit 自身改动)被改写')
  assert.match(BLOCK, /git merge-base origin\/main "\$lsha"/, '二级推导(合并基点)被删/被换')
  assert.match(BLOCK, /git diff --name-only "\$_nb_base" "\$lsha"/, '二级差集的取法被改写')
})

test('T2 普通提交:输出与 git show --name-only 逐行一致', (t) => {
  const { work, b } = makeFixture(t)
  const shown = lines(git(work, ['show', '--name-only', '--format=', b]))
  assert.deepEqual(shown, ['b.txt'], '夹具前提:普通提交只动 b.txt')
  assert.deepEqual(derive(work, { lsha: b, rsha: ZERO }), shown, '普通提交档必须与 git show 完全一致')
})

test('T3 merge tip:git show 为空 ⇒ 二级给出非空且只含本分支真实变更', (t) => {
  const { work, m } = makeFixture(t)
  const shown = lines(git(work, ['show', '--name-only', '--format=', m]))
  assert.deepEqual(shown, [], '夹具前提:merge tip 的 combined diff 必须为空(旧逻辑取不到面的现场)')

  const derived = derive(work, { lsha: m, rsha: ZERO })
  const base = git(work, ['merge-base', 'origin/main', m])
  const expected = lines(git(work, ['diff', '--name-only', base, m]))
  assert.deepEqual(derived, expected, '二级推导必须等于「合并基点..merge tip」的差集')
  assert.deepEqual(derived, ['b.txt'], 'merge tip 下必须非空,且只含本分支真实变更')
  assert.ok(!derived.includes('c.txt'), '不得把 main 侧自带的改动混进本次 push scope')
})

test('T4 merge tip 且 origin/main 不可得 ⇒ 输出空(保回退全量面,不伪造)', (t) => {
  const { work, m } = makeFixture(t)
  git(work, ['update-ref', '-d', 'refs/remotes/origin/main'])
  assert.deepEqual(derive(work, { lsha: m, rsha: ZERO }), [], '两条推导都取不到面时必须输出空')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
