// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/safe-commit.mjs --files-from` 的端到端测试(2026-11-02 立)。
 *
 * 为什么全部走 CLI 端到端:与 `safe-commit.test.mjs` 同因 —— safe-commit 是顶层线性
 * CLI 脚本(没有 §22d `isDirectRun` 守卫),import 它会当场跑 argv 解析并 exit 2。
 * 能证的只有"真跑它",顺带把"新增入口没有变成旁路"这件事按行为钉住:
 * 每条成功用例都断言 **HEAD 载荷恰等于 seed + 声明集合**,失败用例都断言 **HEAD 不动**。
 *
 * 覆盖面(票面六条 + 忽略态)"正常/超大(10,000)/非法(绝对 + `..`)/目录/空/重复/
 * 不存在 + 被 .gitignore 忽略/ stdin"。
 * 超大那条是本次改动的根因回归:10,000 条路径的 NUL 载荷 > 20,000 字节 ⇒ 必然走
 * `--pathspec-from-file` + `--pathspec-file-nul`,而五步法的精确校验一字未放宽
 * (若运输层把路径弄丢/串味,Step 3 的"意外/缺失"或 Step 5 的载荷判据会当场红)。
 *
 * 全程只在 `mkScratch` 的临时 git 仓里跑,不动真仓、不动共享索引、不 push。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/** safe-commit 的日志带 ANSI 颜色码;断言一律在剥色后的文本上做(同 safe-commit.test.mjs)。 */
const plain = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '')
const outputOf = (r) => plain(`${r.stdout || ''}${r.stderr || ''}`)

/**
 * 夹具回收:heartbeat 子进程持有临时仓句柄,Windows 首删常撞 EPERM ⇒ 重试几次,
 * 仍不行就交给 scratch-dir 的退出清扫兜第二次(清理失败不得改写判据结论)。
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

/** 建临时 git 仓并把 safe-commit 连同闭包拷进 `<仓>/scripts/`(同 safe-commit.test.mjs 夹具)。 */
function makeRepo(t) {
  const dir = mkScratch('safe-commit-files-from-')
  t.after(() => dropRepo(dir))
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  git(dir, 'init', '-q', '.')
  git(dir, 'config', 'user.name', 'fixture')
  git(dir, 'config', 'user.email', 'fixture@example.invalid')
  git(dir, 'config', 'commit.gpgsign', 'false')
  git(dir, 'config', 'core.hooksPath', join(dir, '.git', 'hooks'))
  copyScriptWithClosure(SCRIPTS, 'safe-commit.mjs', join(dir, 'scripts'), [
    'live-doc-edit.mjs',
    'lib/face-reader.mjs',
    'lib/stale-content-analysis.mjs',
    'lib/scratch-dir.mjs',
  ])
  // 这两个是按路径 spawn 的(不是 import),闭包推导看不见 ⇒ 各拷一次。
  copyScriptWithClosure(SCRIPTS, 'git-lock.mjs', join(dir, 'scripts'))
  copyScriptWithClosure(SCRIPTS, 'merge-live-doc.mjs', join(dir, 'scripts'))
  return dir
}

/** 零提交仓里 Step 1 的 `git reset HEAD` 必失败 ⇒ 先种一枚基线提交。 */
function seed(dir) {
  writeFileSync(join(dir, 'seed.txt'), 'seed\n')
  git(dir, 'add', '-A', '--', 'seed.txt')
  git(dir, 'commit', '-qm', 'seed')
  return git(dir, 'rev-parse', 'HEAD')
}

/** 跑一次真正的 safe-commit;`input` 有值就走 stdin(供 `--files-from -` 用)。 */
function runCli(dir, argv, { input } = {}) {
  const stdio = input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  return spawnSync(process.execPath, [join(dir, 'scripts', 'safe-commit.mjs'), ...argv], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 480_000,
    maxBuffer: 64 * 1024 * 1024,
    stdio,
    input,
    // 真仓会话环境里的开关一律清空,避免夹具结论取决于调用方此刻站着哪。
    env: {
      ...process.env,
      IHUI_GIT_LOCK_UNIT: '',
      AGENT_SCOPE: '',
      AGENT_NAME: '',
      AGENT_SCOPE_OVERRIDE: '',
      LIVE_SHA_ALLOW: '',
      IHUI_SKIP_LIVE_DOC_CHECK: '',
      IHUI_SAFE_COMMIT_SHA_INTAKE_CAP: '',
      IHUI_SAFE_COMMIT_LOCK_RETRIES: '2',
    },
  })
}

/** HEAD 树里的全部路径(git 自身已排序)。 */
const headTree = (dir) => git(dir, 'ls-tree', '-r', '--name-only', 'HEAD').split('\n').filter(Boolean)

const writeManifest = (dir, name, lines, { trailingNewline = true } = {}) =>
  writeFileSync(join(dir, name), trailingNewline ? `${lines.join('\n')}\n` : lines.join('\n'))

test('FF1 正常清单:两条路径经 --files-from 落地,载荷恰为声明集合', (t) => {
  const dir = makeRepo(t)
  const before = seed(dir)
  mkdirSync(join(dir, 'a'), { recursive: true })
  mkdirSync(join(dir, 'b'), { recursive: true })
  writeFileSync(join(dir, 'a', 'one.txt'), 'one\n')
  writeFileSync(join(dir, 'b', 'two.txt'), 'two\n')
  writeManifest(dir, 'paths.txt', ['a/one.txt', 'b/two.txt'])
  const r = runCli(dir, ['-m', 'feat: manifest normal', '--files-from', 'paths.txt'])
  const out = outputOf(r)
  assert.equal(r.status, 0, `应放行,实得 ${r.status}:\n${out}`)
  assert.match(out, /--files-from 清单读入 2 条路径/, '读入条数必须报名,不许静默')
  assert.notEqual(git(dir, 'rev-parse', 'HEAD'), before, '放行 ⇒ 必须真的落了一枚提交')
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'feat: manifest normal')
  assert.deepEqual(headTree(dir), ['a/one.txt', 'b/two.txt', 'seed.txt'], '载荷必须恰等于声明集合')
})

test('FF2 超大清单:10,000 条路径经 pathspec 文件运输落地(五次法零放宽)', (t) => {
  const dir = makeRepo(t)
  seed(dir)
  const N = 10_000
  mkdirSync(join(dir, 'bulk'), { recursive: true })
  const lines = []
  for (let i = 0; i < N; i++) {
    const rel = `bulk/f${String(i).padStart(5, '0')}.txt`
    writeFileSync(join(dir, rel), `#${i}\n`)
    lines.push(rel)
  }
  writeManifest(dir, 'paths.txt', lines)
  const r = runCli(dir, ['-m', 'feat: bulk manifest', '--files-from', 'paths.txt'])
  const out = outputOf(r)
  assert.equal(r.status, 0, `应放行,实得 ${r.status}:\n${out.slice(-2000)}`)
  assert.match(out, /--files-from 清单读入 10000 条路径/)
  assert.match(out, /暂存区精确匹配预期 10000 个文件/, 'Step 3 的精确校验必须原样跑满')
  const tracked = headTree(dir)
  assert.equal(tracked.length, N + 1, `HEAD 树应为 ${N} 条新路径 + seed`)
  assert.ok(tracked.includes('bulk/f00000.txt') && tracked.includes('bulk/f09999.txt'), '首尾路径都必须在')
  assert.equal(git(dir, 'status', '--porcelain', '--untracked-files=no'), '', '落地后不应再有未提交改动')
})

test('FF3 非法路径:绝对路径与 ".." 各报一条,拒绝提交且 HEAD 不动', (t) => {
  const dir = makeRepo(t)
  const before = seed(dir)
  writeFileSync(join(dir, 'ok.txt'), 'ok\n')
  writeManifest(dir, 'paths.txt', [join(dir, 'ok.txt'), '../escape.txt'])
  const r = runCli(dir, ['-m', 'feat: illegal', '--files-from', 'paths.txt'])
  const out = outputOf(r)
  assert.equal(r.status, 2, `应用法拒绝,实得 ${r.status}:\n${out}`)
  assert.match(out, /绝对路径/)
  assert.match(out, /含 ".." 路径段/)
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before, '清单校验失败不得留下提交')
})

test('FF4 目录:清单里给一个目录 ⇒ 点名拒绝', (t) => {
  const dir = makeRepo(t)
  const before = seed(dir)
  mkdirSync(join(dir, 'sub'), { recursive: true })
  writeFileSync(join(dir, 'sub', 'inner.txt'), 'inner\n')
  writeManifest(dir, 'paths.txt', ['sub'])
  const r = runCli(dir, ['-m', 'feat: dir', '--files-from', 'paths.txt'])
  const out = outputOf(r)
  assert.equal(r.status, 2, `应拒绝目录,实得 ${r.status}:\n${out}`)
  assert.match(out, /是目录 sub/)
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before)
})

test('FF5 空清单:明确报"清单为空",不误报成"没给文件路径"', (t) => {
  const dir = makeRepo(t)
  const before = seed(dir)
  writeFileSync(join(dir, 'paths.txt'), '')
  const r = runCli(dir, ['-m', 'feat: empty', '--files-from', 'paths.txt'])
  const out = outputOf(r)
  assert.equal(r.status, 2, `应拒绝空清单,实得 ${r.status}:\n${out}`)
  assert.match(out, /--files-from 清单为空/)
  assert.doesNotMatch(out, /必须提供至少一个文件路径/, '空清单必须走清单分支的报错')
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before)
})

test('FF6 重复项:同一路径出现两次 ⇒ 点名重复并拒绝', (t) => {
  const dir = makeRepo(t)
  const before = seed(dir)
  writeFileSync(join(dir, 'dup.txt'), 'dup\n')
  writeManifest(dir, 'paths.txt', ['dup.txt', 'dup.txt'])
  const r = runCli(dir, ['-m', 'feat: dup', '--files-from', 'paths.txt'])
  const out = outputOf(r)
  assert.equal(r.status, 2, `应拒绝重复项,实得 ${r.status}:\n${out}`)
  assert.match(out, /重复项 dup\.txt/)
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before)
})

test('FF7 不存在 + 被 .gitignore 忽略:两条都显式列出,不静默跳过', (t) => {
  const dir = makeRepo(t)
  const before = seed(dir)
  writeFileSync(join(dir, '.gitignore'), 'ignored/\n')
  mkdirSync(join(dir, 'ignored'), { recursive: true })
  writeFileSync(join(dir, 'ignored', 'gone.txt'), 'gone\n')
  writeManifest(dir, 'paths.txt', ['ignored/gone.txt', 'missing.txt'])
  const r = runCli(dir, ['-m', 'feat: ignored', '--files-from', 'paths.txt'])
  const out = outputOf(r)
  assert.equal(r.status, 2, `应拒绝,实得 ${r.status}:\n${out}`)
  assert.match(out, /被 \.gitignore 忽略 ignored\/gone\.txt/)
  assert.match(out, /不存在 missing\.txt/)
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before)
})

test('FF8 stdin:`--files-from -` 与文件形态同权,落地同一套五步法', (t) => {
  const dir = makeRepo(t)
  const before = seed(dir)
  writeFileSync(join(dir, 's1.txt'), '1\n')
  writeFileSync(join(dir, 's2.txt'), '2\n')
  const r = runCli(dir, ['-m', 'feat: stdin manifest', '--files-from', '-'], {
    input: 's1.txt\ns2.txt\n',
  })
  const out = outputOf(r)
  assert.equal(r.status, 0, `应放行,实得 ${r.status}:\n${out}`)
  assert.match(out, /--files-from 清单读入 2 条路径/)
  assert.notEqual(git(dir, 'rev-parse', 'HEAD'), before, 'stdin 不是试运行,必须真落地')
  assert.deepEqual(headTree(dir), ['s1.txt', 's2.txt', 'seed.txt'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
