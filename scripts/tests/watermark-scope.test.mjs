// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:水印分母集合与落地器水印预检(G-253,2026-09-27 立)。
 *
 * 被测对象:
 *  - `scripts/lib/watermark-scope.mjs` 的 `coverageFileSet` —— 两层集合(可阻塞的索引面 /
 *    只报数的未跟踪面),以及"取不到清单绝不等于空集合"的失效方向;
 *  - `scripts/object-space-land.mjs` 的 `watermarkPreflight` —— 旁路提交不跑钩子,这条是
 *    "无横幅文件进 HEAD"的唯一拦截点;
 *  - 两条**形状锁**:两个消费者必须 import 这份 lib,不得再各自 `git ls-files`
 *    (两处算同一件事必漂移,本仓记过最多次)。
 *
 * 跑法:`node --test scripts/tests/watermark-scope.test.mjs`
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { mkScratch } from '../lib/scratch-dir.mjs'
import { coverageFileSet } from '../lib/watermark-scope.mjs'
import { watermarkPreflight } from '../object-space-land.mjs'

const REPO = join(import.meta.dirname, '..', '..')
const GIT = (cwd, args) =>
  // EBUSY 根治(errno -4082):本机会话里 Node 建子进程 stdin 管道确定性失败。
  // 2026-10-03:本夹具没写 stdio ⇒ S1/S2/S3/S9 四条红在 'spawnSync git EBUSY' 上,
  // 而 S3恰恰是"空跟踪清单必须报 error"那一格 —— 命令没跑成时它测不到任何东西。
  execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** 造一个最小 git 仓:1 个已跟踪、1 个未跟踪未忽略、1 个被 .gitignore 忽略。 */
function fixtureRepo(t) {
  const dir = mkScratch('wm-scope-')
  GIT(dir, ['init', '-b', 'main'])
  GIT(dir, ['config', 'user.email', 't@example.invalid'])
  GIT(dir, ['config', 'user.name', 'fixture'])
  mkdirSync(join(dir, 'ignored'), { recursive: true })
  writeFileSync(join(dir, '.gitignore'), 'ignored/\n')
  writeFileSync(join(dir, 'tracked.ts'), 'export const a = 1\n')
  writeFileSync(join(dir, 'untracked.ts'), 'export const b = 1\n')
  writeFileSync(join(dir, 'ignored', 'x.ts'), 'export const c = 1\n')
  GIT(dir, ['add', '.gitignore', 'tracked.ts'])
  GIT(dir, ['commit', '-m', 'init'])
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

/** 真跑一次 `watermark.mjs verify` 的 runner(供端到端用例注入)。 */
function realRun(node, args, opts) {
  try {
    execFileSync(node, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
    return { status: 0 }
  } catch (e) {
    return e
  }
}

test('S1 分母 = 已跟踪 ∪ 未跟踪未忽略;被忽略的不得进来', (t) => {
  const root = fixtureRepo(t)
  const scope = coverageFileSet({ root })
  assert.equal(scope.error, null, scope.error ?? '')
  assert.deepEqual([...scope.indexFiles].sort(), ['.gitignore', 'tracked.ts'])
  assert.deepEqual(scope.untrackedFiles, ['untracked.ts'])
  assert.ok(scope.files.includes('tracked.ts') && scope.files.includes('untracked.ts'))
  assert.equal(
    scope.files.filter((f) => f.startsWith('ignored/')).length,
    0,
    '被 .gitignore 忽略的目录不得进入分母 —— 那正是当初把"全树遍历"改成"按 git 清单"的理由',
  )
})

test('S2 未跟踪面不得混进 indexFiles(可阻塞面与只报数面必须分层)', (t) => {
  const { indexFiles, untrackedFiles } = coverageFileSet({ root: fixtureRepo(t) })
  assert.equal(indexFiles.includes('untracked.ts'), false, '未跟踪文件被判红 = 与提交无关的恒红门')
  assert.equal(untrackedFiles.includes('untracked.ts'), true)
})

test('S3 空跟踪清单 ⇒ 报 error,不按"没有缺口"放行', (t) => {
  const dir = mkScratch('wm-empty-')
  GIT(dir, ['init', '-b', 'main'])
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const scope = coverageFileSet({ root: dir })
  assert.notEqual(scope.error, null, '一个文件都没枚举到 = 判据失明,必须喊出来')
  assert.deepEqual(scope.files, [])
})

test('S4 根不可当仓库问 ⇒ error(不返回空集合冒充"全绿")', () => {
  const scope = coverageFileSet({ root: process.env.SystemRoot ?? 'C:\\Windows' })
  assert.notEqual(scope.error, null)
})

test('S5 preflight 正向:verify 退出 0 ⇒ 放行,且逐项喂路径', () => {
  const calls = []
  const res = watermarkPreflight({
    root: 'irrelevant',
    paths: ['a.ts', 'b.ts'],
    run: (node, args, opts) => {
      calls.push({ node, args, opts })
      return { status: 0 }
    },
  })
  assert.deepEqual(res, { ok: true })
  const { args, opts } = calls[0]
  assert.ok(args.some((a) => a.endsWith(join('scripts', 'watermark.mjs'))), '必须走权威入口')
  assert.ok(args.includes('verify'))
  assert.ok(args.includes(resolve('irrelevant', 'a.ts')) && args.includes(resolve('irrelevant', 'b.ts')), '声明路径逐个喂(绝对化后与 root 是否被验仓无关),不得跑全仓')
  assert.equal(opts.windowsHide, true, '派生控制台程序必须 windowsHide(§5b 弹窗事故)')
  assert.equal(typeof opts.timeout, 'number', '必须带超时(守门 80 那一族无界等待)')
})

test('S6 preflight 反向:非零退出 ⇒ 拒绝,并点名文件 + 给得出路', () => {
  const res = watermarkPreflight({
    root: 'r',
    paths: ['src/missing.ts'],
    run: () => {
      throw Object.assign(new Error('Command failed'), {
        status: 1,
        stdout: '未覆盖 1 个:\n  - src/missing.ts\n',
        stderr: '',
      })
    },
  })
  assert.equal(res.ok, false)
  assert.match(res.why, /src\/missing\.ts/, '拒绝理由必须点名是哪个文件')
  assert.match(res.why, /watermark\.mjs inject/, '要给得出路,不得只报"不通过"')
})

test('S7 preflight:取不到执行体(ENOENT)⇒ 同样拒绝,不"看不见就当通过"', () => {
  const res = watermarkPreflight({
    root: 'r',
    paths: ['a.ts'],
    run: () => {
      throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
    },
  })
  assert.equal(res.ok, false)
  assert.match(res.why, /无法判断/)
})

test('S8 形状锁:两个消费者必须 import 这份 lib,不得再各自 git ls-files', () => {
  for (const name of ['watermark.mjs', 'check-watermark-coverage.mjs']) {
    const text = readFileSync(join(REPO, 'scripts', name), 'utf8')
    assert.match(text, /from '\.\/lib\/watermark-scope\.mjs'/, `${name} 未 import 共用 lib ⇒ 口径又会各写一遍`)
  }
  const cov = readFileSync(join(REPO, 'scripts', 'check-watermark-coverage.mjs'), 'utf8')
  assert.equal(
    /'ls-files'/.test(cov),
    false,
    'check-watermark-coverage 里不得再留一份裸 `git ls-files` 枚举(两处枚举必漂移)',
  )
})

test('S9 端到端:未跟踪且无横幅的新文件必须被预检拦住', (t) => {
  const root = fixtureRepo(t)
  const res = watermarkPreflight({ root, paths: ['untracked.ts'], run: realRun })
  assert.equal(res.ok, false, '这一格正是旁路提交把无横幅文件带进 HEAD 的通道')
  assert.match(res.why, /untracked\.ts/)
  // 正向对照:同一份文件补上横幅后必须放行(否则本判据是恒红门)
  execFileSync(process.execPath, [join(REPO, 'scripts', 'watermark.mjs'), 'inject', join(root, 'untracked.ts')], {
    cwd: root,
    windowsHide: true,
    stdio: 'ignore',
  })
  const again = watermarkPreflight({ root, paths: ['untracked.ts'], run: realRun })
  assert.equal(again.ok, true, JSON.stringify(again))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
