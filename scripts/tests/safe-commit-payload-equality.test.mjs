// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/safe-commit.mjs` Step 5 载荷**相等性**判据的 §22c 镜像测试(seat-safecommit,2026-10-25 立)。
 *
 * 缺陷(实测复现,票面出处见 safe-commit Step 5 注):
 *   旧 Step 5 只判 `实到 ⊖ 预期`(多出来的文件),于是"实到 0 个"的差集为空 ⇒ 打印
 *   「commit 干净,仅包含 0 个预期文件」并 exit 0。两次实害 `c8f2750a5c` / `56227f8b33`
 *   被打成空提交:钩子链跑的 9 分钟里,暂存面被并发会话 safe-commit Step1 的
 *   `git reset HEAD` 清空,而本器 Step5 对空集判绿。同源第二型:实到 ⊂ 预期(只落地一部分)
 *   旧判据同样放行 —— 它用的是 "⊆" 不是 "=="。
 *
 * 三条判读纪律:
 *  ① 判据只有一份 —— P5 直接 `import { judgeCommitPayload }` 生产判据(§22c),P6 源码锁
 *     钉住 safe-commit 引的是同一份、且旧的 `committedUnexpected` 第二把尺子不得复活。
 *  ② 夹具走 `mkScratch`(§15b),全流程只在临时 git 仓里跑,不动真仓/共享索引/远端。
 *  ③ 变异自证(P4):把"实到为空"分支短路掉之后,**P1 的同一夹具必须变绿** ——
 *     证明牙长在新代码上,而不是别的步骤在兜。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { judgeCommitPayload } from '../lib/commit-payload-judge.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = join(HERE, '..')

const git = (dir, ...args) => {
  const r = spawnSync('git', ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:\n${r.stdout}\n${r.stderr}`)
  return (r.stdout || '').trim()
}

/** 日志带 ANSI 码 ⇒ 断言一律在剥色文本上做(与 safe-commit.test.mjs 同规)。 */
const plain = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '')
const outputOf = (r) => plain(`${r.stdout || ''}${r.stderr || ''}`)

/**
 * 夹具回收:Windows 上首删临时 git 仓常撞 EPERM(git 对象只读 + safe-commit 的 detached
 * 心跳进程尚在),重试几轮即可;清理失败不得改写判据结论(与 safe-commit.test.mjs 同规)。
 */
async function dropRepo(dir) {
  for (let i = 0; i < 10; i++) {
    try {
      rmScratch(dir)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 700))
    }
  }
  rmScratch(dir, { bestEffort: true })
}

/**
 * 造临时 git 仓,把 safe-commit 及其整条相对 import 闭包拷进去(它按脚本自身位置推导仓根),
 * 并补拷两枚按路径 spawn 的器物(git-lock / merge-live-doc)。
 */
function makeRepo(t) {
  const dir = mkScratch('safecommit-payload-')
  t.after(() => dropRepo(dir))
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  git(dir, 'init', '-q', '.')
  git(dir, 'config', 'user.name', 'fixture')
  git(dir, 'config', 'user.email', 'fixture@example.invalid')
  git(dir, 'config', 'commit.gpgsign', 'false')
  git(dir, 'config', 'core.hooksPath', join(dir, '.git', 'hooks'))
  copyScriptWithClosure(SCRIPTS, 'safe-commit.mjs', join(dir, 'scripts'), [
    'live-doc-edit.mjs',
    'lib/scratch-dir.mjs',
    'lib/commit-payload-judge.mjs',
  ])
  copyScriptWithClosure(SCRIPTS, 'git-lock.mjs', join(dir, 'scripts'))
  copyScriptWithClosure(SCRIPTS, 'merge-live-doc.mjs', join(dir, 'scripts'))
  return { dir }
}

function seed(dir, text = 'seed\n') {
  writeFileSync(join(dir, 'a.txt'), text)
  git(dir, 'add', '-A', '--', 'a.txt')
  git(dir, 'commit', '-qm', 'seed')
  return git(dir, 'rev-parse', 'HEAD')
}

/** 写一枚 pre-commit 钩子(模拟并发会话在本器钩子窗口里的动作)。 */
function writeHook(dir, body) {
  writeFileSync(join(dir, '.git', 'hooks', 'pre-commit'), `#!/bin/sh\n${body}\nexit 0\n`)
}

function runSafe(dir, files, message = 'fix: fixture') {
  return spawnSync(
    process.execPath,
    [join(dir, 'scripts', 'safe-commit.mjs'), '-m', message, '--', ...files],
    {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 240_000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        IHUI_GIT_LOCK_UNIT: '',
        AGENT_SCOPE: '',
        AGENT_NAME: '',
        AGENT_SCOPE_OVERRIDE: '',
        LIVE_SHA_ALLOW: '',
        IHUI_SKIP_LIVE_DOC_CHECK: '',
        IHUI_SAFE_COMMIT_LOCK_RETRIES: '2',
      },
    },
  )
}

test('P1 提交窗口内暂存面被清空(并发 reset 等价物)⇒ 必须拒,且不许对空集判绿', (t) => {
  const { dir } = makeRepo(t)
  const before = seed(dir)
  writeFileSync(join(dir, 'a.txt'), 'seed\nnext\n')
  // 并发会话 safe-commit Step1 的 `git reset HEAD` 在钩子窗口里的等价物
  // reset + read-tree + 短暂停顿:让"钩子窗口里索引被重写"对父 git 确定可见,
  // 不靠 mtime 采样的运气(否则偶发退化成 git 自己判 nothing to commit,夹具形态就漂了)
  writeHook(dir, 'git reset -q\ngit read-tree HEAD\nsleep 0.2')
  const r = runSafe(dir, ['a.txt'])
  const out = outputOf(r)
  // 两种合法拒绝形态:①本器判据命中(空提交已落地)②git 自己拒绝空提交(nothing to commit)。
  // 两者都必须是非零 + 点名;判绿的只有一种,必须绝迹。
  assert.equal(r.status, 1, `空提交必须非零退出,实得 ${r.status}:\n${out}`)
  const headAfter = git(dir, 'rev-parse', 'HEAD')
  if (headAfter !== before) {
    assert.match(out, /本枚提交落地了 0 个文件/, `提交已落地但载荷为空 ⇒ 必须由本器判据点名:\n${out}`)
    assert.match(out, /暂存面在提交窗口内被清空\/改动/, '必须说清成因')
    assert.match(out, /未落地的声明路径 1 个: a\.txt/, '必须点名缺失的声明路径')
    assert.match(out, /出路:原样重试本命令/, '守卫必须带出路(AGENTS §0.8)')
    assert.match(out, /不要用 `git reset HEAD~1`/, '不得给出会删掉别人提交的撤销建议')
    assert.equal(git(dir, 'show', '--pretty=format:', '--name-only', 'HEAD'), '', '本夹具产出的必须是一枚空提交')
  } else {
    // git 在钩子后自己判"nothing to commit"⇒ 没落提交,也是拒;此时判据无提交可判,不算它的牙。
    assert.match(out, /git commit 最终失败/, `未落提交时必须是 git 的拒绝,不许静默:\n${out}`)
  }
  assert.doesNotMatch(out, /commit 干净/, '零个文件绝不许渲染成"干净"')
})

test('P2 正常单文件 ⇒ 绿,且报数 1(不得把正常路径弄坏)', (t) => {
  const { dir } = makeRepo(t)
  const before = seed(dir)
  writeFileSync(join(dir, 'a.txt'), 'seed\nnext\n')
  const r = runSafe(dir, ['a.txt'])
  const out = outputOf(r)
  assert.equal(r.status, 0, `正常提交必须绿:\n${out}`)
  assert.match(out, /commit 干净,仅包含 1 个预期文件/)
  assert.notEqual(git(dir, 'rev-parse', 'HEAD'), before)
  assert.equal(git(dir, 'show', '--pretty=format:', '--name-only', 'HEAD'), 'a.txt')
})

test('P3 实到集合 ⊋ 预期集合(钩子窗口里塞进非声明文件)⇒ 必须拒', (t) => {
  const { dir } = makeRepo(t)
  seed(dir)
  writeFileSync(join(dir, 'a.txt'), 'seed\nnext\n')
  writeHook(dir, 'printf extra > extra.txt\ngit add extra.txt')
  const r = runSafe(dir, ['a.txt'])
  const out = outputOf(r)
  assert.equal(r.status, 1, `污染提交必须拒,实得 ${r.status}:\n${out}`)
  assert.match(out, /commit 包含非预期文件/)
  assert.match(out, /extra\.txt/)
})

test('P4 变异自证:摘掉新判据调用 ⇒ P1 同一夹具变绿(牙长在新判据上)', (t) => {
  const { dir } = makeRepo(t)
  seed(dir)
  writeFileSync(join(dir, 'a.txt'), 'seed\nnext\n')
  // reset + read-tree + 短暂停顿:让"钩子窗口里索引被重写"对父 git 确定可见,
  // 不靠 mtime 采样的运气(否则偶发退化成 git 自己判 nothing to commit,夹具形态就漂了)
  writeHook(dir, 'git reset -q\ngit read-tree HEAD\nsleep 0.2')
  // 变异 = 只短路 safe-commit 里的新判据调用(等价于"这一格没装车"),其余字节不动。
  // 刻意不去只摘 lib 里的某一条腿:那条腿被摘掉后仍会走 missing 档拒 —— 那是判据的纵深,
  // 不是本条要证的事;本条要证的是"旧行为(无判据)对空提交判绿"。
  const toolPath = join(dir, 'scripts', 'safe-commit.mjs')
  const src = readFileSync(toolPath, 'utf8')
  const mutated = src.replace(
    'const payloadVerdict = judgeCommitPayload({ expected: [...expectedNorm], actual: committedFiles })',
    "const payloadVerdict = { ok: true, kind: 'exact', expected: [], actual: [], missing: [], extra: [] }",
  )
  assert.notEqual(mutated, src, '变异锚点没命中 ⇒ 本条自证失效')
  writeFileSync(toolPath, mutated)

  const r = runSafe(dir, ['a.txt'])
  const out = outputOf(r)
  assert.equal(r.status, 0, `摘掉判据后同一夹具应变绿(证明 P1 的牙来自它):\n${out}`)
  assert.match(out, /commit 干净,仅包含 0 个预期文件/, '变异后必须复现旧缺陷的原话术')
})

test('P5 判据表:直接 import 生产判据(不复制常量)', () => {
  const exact = judgeCommitPayload({ expected: ['a.txt'], actual: ['a.txt'] })
  assert.equal(exact.ok, true)
  assert.equal(exact.kind, 'exact')

  const empty = judgeCommitPayload({ expected: ['a.txt'], actual: [] })
  assert.equal(empty.ok, false)
  assert.equal(empty.kind, 'empty-commit')
  assert.deepEqual(empty.missing, ['a.txt'])

  const extra = judgeCommitPayload({ expected: ['a.txt'], actual: ['a.txt', 'b.txt'] })
  assert.equal(extra.ok, false)
  assert.equal(extra.kind, 'extra')
  assert.deepEqual(extra.extra, ['b.txt'])

  const missing = judgeCommitPayload({ expected: ['a.txt', 'b.txt'], actual: ['a.txt'] })
  assert.equal(missing.ok, false)
  assert.equal(missing.kind, 'missing')
  assert.deepEqual(missing.missing, ['b.txt'])

  const noExpected = judgeCommitPayload({ expected: [], actual: [] })
  assert.equal(noExpected.ok, false)
  assert.equal(noExpected.kind, 'no-expected', '零个预期绝不许判绿(§0.3)')
})

test('P6 源码锁:Step 5 只许引这一份判据,旧的 committedUnexpected 第二把尺子不得复活', () => {
  const src = readFileSync(join(SCRIPTS, 'safe-commit.mjs'), 'utf8')
  assert.match(
    src,
    /import \{ judgeCommitPayload \} from '\.\/lib\/commit-payload-judge\.mjs'/,
    'safe-commit 必须 import 单源判据(造好没装车 = 没有)',
  )
  assert.match(src, /judgeCommitPayload\(\{ expected: \[\.\.\.expectedNorm\], actual: committedFiles \}\)/)
  assert.doesNotMatch(src, /committedUnexpected/, '旧的"只判多出"实现不得复活(两份必漂移)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
