// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * §22c 镜像测试:.husky/pre-push 的「tag 推送祖先判据」(2026-11-04 立)。
 *
 * 病灶:原分支对纯 tag 推送无条件 exit 0,而 release-desktop.yml / release-cli.yml 由
 * desktop-v* / cli-v* tag 触发 ⇒ `git tag desktop-v9.9.9 <--no-verify 提交>` + push tag
 * 即可绕过全部本地门并走完整条发版链。
 *
 * 为什么不另写一份判据:这段逻辑住在 shell 里,测试里重抄一遍就成了第二把尺子
 * (AGENTS §0.6 单一真相源)。本器把钩子**当前那段判据逐字抠出来**(起止标记之间),
 * 在临时仓里喂真 sh 跑夹具 ⇒ 测的就是钩子自己会用的那段代码;抠不到即判红
 * (钩子被改写 ⇒ 锁必须响,不能静默空转成"通过")。不依赖真实远端,不真 push,不打 tag
 * 到真仓(夹具仓内的 tag 是本地对象)。
 *
 * 用例:
 *   T1 形状锁 —— 判据块必须仍住在钩子原文里;
 *   T2 祖先提交上的备份 tag(lost-commit/*,非祖先提交)⇒ 过(唯一不能破的既有流程);
 *   T3 非祖先提交上的普通 tag ⇒ 拦;
 *   T4 发布 tag(desktop-v*)+ 工作树脏 ⇒ 拦;
 *   T5 分支推送 ⇒ 判据不触发(回归,既有行为不变);
 *   T6 annotated tag 解引用后仍按 commit 判祖先 ⇒ 过。
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
const BEGIN_MARK = '# >>> tag-ancestor-gate'
const END_MARK = '# <<< tag-ancestor-gate'

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

/** 逐字抽取判据块(起止标记之间,含 _ref_n/_tag_n 计算与外层 if),抠不到返回 null。 */
function extractBlock() {
  const lines = HOOK.split(/\r?\n/)
  const begin = lines.findIndex((l) => l.includes(BEGIN_MARK))
  const end = lines.findIndex((l) => l.includes(END_MARK))
  if (begin < 0 || end <= begin) return null
  const block = lines.slice(begin + 1, end).join('\n')
  return block.includes('_tag_n=') && block.includes('git merge-base --is-ancestor') ? block : null
}
const BLOCK = extractBlock()

/** 在夹具仓里跑判据块:status 0 = 放行/未触发,1 = 拦下。 */
function runGate(repo, refs) {
  assert.ok(BLOCK, '钩子里抠不到 tag-ancestor-gate 块 —— 判据被改写,锁必须响')
  const r = spawnSync(SHELL, ['-c', BLOCK], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, PUSH_REFS: refs },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.ok(r.status === 0 || r.status === 1, `sh 跑钩子块异常退出(${r.status}):${r.stderr}`)
  return { code: r.status, stderr: r.stderr }
}

/** 派生 git 调用一律显式接管 stdio(AGENTS §12g)。 */
function git(repo, args) {
  const r = spawnSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', ...args], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr}`)
  return r.stdout.trim()
}

/**
 * 夹具:bare origin + 工作仓。main=A 已推到 origin;另建 `draft` 分支出一笔未推送的 B。
 * A 是 origin/main 本身(祖先),B 不是 ⇒ 两个方向都能证。
 */
function makeFixture(t) {
  const dir = mkScratch('ihui-prepush-tag-')
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
  const a = git(work, ['rev-parse', 'HEAD'])

  git(work, ['checkout', '-b', 'draft'])
  writeFileSync(join(work, 'b.txt'), 'b\n')
  git(work, ['add', 'b.txt'])
  git(work, ['commit', '-m', 'B'])
  const b = git(work, ['rev-parse', 'HEAD'])
  git(work, ['checkout', 'main'])
  return { work, a, b }
}

test('T1 形状锁:祖先判据必须仍住在钩子原文里', () => {
  assert.ok(BLOCK, '抠不到 tag-ancestor-gate 块(起止标记或结构被改写)')
  assert.match(BLOCK, /git rev-parse --verify --quiet "refs\/tags\/\$\{_tg_name\}\^\{commit\}"/, '解引用被删/被换')
  assert.match(BLOCK, /git merge-base --is-ancestor "\$_tg_commit" origin\/main/, '祖先判据被删/被换')
  assert.match(BLOCK, /git status --porcelain/, '发布 tag 的工作树干净判据被删')
  assert.match(BLOCK, /desktop-v\*\|cli-v\*/, '发布 tag 识别被删')
  assert.match(BLOCK, /lost-commit\/\*\|backup\/\*\|backup-\*/, '§22 备份命名空间豁免被删')
})

test('T2 祖先提交上的备份 tag(非祖先提交的 lost-commit)⇒ 过', (t) => {
  const { work, a, b } = makeFixture(t)
  // 备份 tag 按定义可以指向非祖先提交:这条是唯一不能破的既有流程
  git(work, ['tag', 'lost-commit/fixture', b])
  const r = runGate(work, `refs/tags/lost-commit/fixture ${b} refs/tags/lost-commit/fixture ${ZERO}`)
  assert.equal(r.code, 0, `备份 tag 被误拦:${r.stderr}`)

  // 普通 tag 指向祖先提交(A = origin/main)也必须过
  git(work, ['tag', 'notes-ok', a])
  const r2 = runGate(work, `refs/tags/notes-ok ${a} refs/tags/notes-ok ${ZERO}`)
  assert.equal(r2.code, 0, `祖先提交上的普通 tag 被误拦:${r2.stderr}`)
})

test('T3 非祖先提交上的 tag ⇒ 拦', (t) => {
  const { work, b } = makeFixture(t)
  git(work, ['tag', 'draft-only', b])
  const r = runGate(work, `refs/tags/draft-only ${b} refs/tags/draft-only ${ZERO}`)
  assert.equal(r.code, 1, '非祖先提交上的 tag 必须被拦')
  assert.match(r.stderr, /不在 origin\/main 的祖先链上/)
})

test('T4 发布 tag + 工作树脏 ⇒ 拦', (t) => {
  const { work, a } = makeFixture(t)
  git(work, ['tag', 'desktop-v0.0.1', a])
  writeFileSync(join(work, 'draft.txt'), 'uncommitted\n')
  const r = runGate(work, `refs/tags/desktop-v0.0.1 ${a} refs/tags/desktop-v0.0.1 ${ZERO}`)
  assert.equal(r.code, 1, '发布 tag 遇脏工作树必须被拦')
  assert.match(r.stderr, /工作树不干净/)
})

test('T5 分支推送 ⇒ 判据不触发(既有行为不变)', (t) => {
  const { work, a } = makeFixture(t)
  const r = runGate(work, `refs/heads/main ${a} refs/heads/main ${ZERO}`)
  assert.equal(r.code, 0, '分支推送不得被 tag 判据改写')
  assert.ok(!r.stderr.includes('本次只推 tag'), '分支推送不得走进 tag 豁免分支')
})

test('T6 annotated tag 解引用后仍按 commit 判祖先 ⇒ 过;发布 tag 干净 ⇒ 过', (t) => {
  const { work, a } = makeFixture(t)
  git(work, ['tag', '-a', 'v-annotated', '-m', 'annotated', a])
  const tagObj = git(work, ['rev-parse', 'refs/tags/v-annotated'])
  assert.notEqual(tagObj, a, '夹具前提:annotated tag 的 ref sha 是 tag 对象自身,不是 commit')
  const r = runGate(work, `refs/tags/v-annotated ${tagObj} refs/tags/v-annotated ${ZERO}`)
  assert.equal(r.code, 0, `annotated tag 未解引用 ⇒ 祖先判据被误判:${r.stderr}`)

  git(work, ['tag', 'cli-v0.0.1', a])
  const r2 = runGate(work, `refs/tags/cli-v0.0.1 ${a} refs/tags/cli-v0.0.1 ${ZERO}`)
  assert.equal(r2.code, 0, `干净工作树 + 祖先提交的发布 tag 被误拦:${r2.stderr}`)
})
