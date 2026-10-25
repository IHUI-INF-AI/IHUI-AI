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

/**
 * ── G-04 换面(2026-10-25 补格)──────────────────────────────────────────────
 * 立因:落地器构造 blob 后(`hash-object -w`)与 verify 重读盘之间存在时间窗——
 * 别人改盘 ⇒ 验的就不是要交的那一份。62f7eb65c6 把判定面改成「将要进树的那枚 blob」
 * (cat-file 出内容 → 临时副本 → verify),但**当时一个用例都没留**(该提交只动了
 * 器物本身,"76/76 + 23/23 自检"没有触到 blobs 这一支)。换面判据若无镜像钉住,
 * 下次有人"顺手改回盘上那份"照样全绿 —— 这正是本仓 §22c 反复登记的失效型。
 *
 * 两臂互为阳性对照,摘掉换面即翻红:
 *  - 臂 A:盘上**有**横幅、待提交 blob **无**横幅 ⇒ 必须拒(读盘的旧判据会假绿放行);
 *  - 臂 B:盘上**无**横幅、待提交 blob **有**横幅 ⇒ 必须放行(读盘的旧判据会假红拦人);
 *  - 臂 C:blobs 清单里没有声明路径的 oid ⇒ 判「未判定」拒落,不回落盘上那份(§0.3)。
 */
function hashObjectWrite(cwd, text) {
  // §12g:派生 git 必须显式 stdio;带 input 的调用 stdin 必须是 pipe。
  const out = execFileSync('git', ['-c', 'safe.directory=*', 'hash-object', '-w', '--stdin'], {
    cwd,
    input: text,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  return out.trim()
}

test('S10 blobs 档判定面=将要进树的 blob 而非盘上旧副本(G-04 换面的镜像钉)', (t) => {
  const root = fixtureRepo(t)
  const bare = 'export const n = 1\n'
  writeFileSync(join(root, 'n.ts'), bare)
  execFileSync(process.execPath, [join(REPO, 'scripts', 'watermark.mjs'), 'inject', join(root, 'n.ts')], {
    cwd: root,
    windowsHide: true,
    stdio: 'ignore',
  })
  const signed = readFileSync(join(root, 'n.ts'), 'utf8')
  const oidSigned = hashObjectWrite(root, signed)
  const oidBare = hashObjectWrite(root, bare)

  // 臂 A:盘上是刚注入过的带横幅内容,待提交 blob 是无横幅的那一版。
  // 判盘(旧形态)= 放行 ⇒ 把未验证的字节写进树;判 blob 必须拒,且点名声明路径 + inject 出路。
  const resA = watermarkPreflight({
    root,
    paths: ['n.ts'],
    blobs: new Map([['n.ts', oidBare]]),
    run: realRun,
  })
  assert.equal(resA.ok, false, `无横幅的待提交 blob 必须拒落,实得 ${JSON.stringify(resA)}`)
  assert.match(resA.why, /n\.ts/, '拒绝理由必须映射回声明路径(临时副本名不得漏出)')
  assert.match(resA.why, /watermark\.mjs inject/, '必须给得出路')

  // 臂 B:盘上换成无横幅(别人的现场),待提交 blob 是带横幅的那一版 ⇒ 必须放行。
  // 这一臂防的是"换面换成一刀切拦人":只拦不放的判据同样是恒红门(§12e)。
  writeFileSync(join(root, 'n.ts'), bare)
  const resB = watermarkPreflight({
    root,
    paths: ['n.ts'],
    blobs: new Map([['n.ts', oidSigned]]),
    run: realRun,
  })
  assert.equal(resB.ok, true, `带横幅的待提交 blob 必须放行(盘上那份不该拖累它),实得 ${JSON.stringify(resB)}`)

  // 臂 C:清单问不到 = 未判定,既不记绿也不冒红地放行;绝不回落到"判盘上那份"。
  const resC = watermarkPreflight({
    root,
    paths: ['n.ts'],
    blobs: new Map([['other.ts', oidSigned]]),
    run: realRun,
  })
  assert.equal(resC.ok, false)
  assert.match(resC.why, /n\.ts.*没有该路径的 blob|没有可判定的版本/s, '未判定必须点名是哪条路径')
})

/**
 * ④ 工具产物豁免在 blobs 档必须同样生效(§5c 上游工具生成物三条判序):
 * 豁免面按 REPO_ROOT 折叠的 rel 预筛,命中即**不进 verify**——临时副本落在 scratch,
 * verify 自己按盘位置算出的 rel 早已脱离登记 root,少了这层预筛,89 枚 tauri 再生
 * 权限文件一旦经落地器就是恒红(§12e)。这里用真仓 HEAD 上真实在档的一枚做只读取证
 * (rev-parse + cat-file,零写入),断言 run **一次都没被派**。
 */
test('S11 blobs 档命中「上游工具生成物」台账 ⇒ 预筛豁免,verify 一次都不派', (t) => {
  const rel = 'apps/desktop/src-tauri/permissions/autogenerated/active_window.toml'
  const oid = execFileSync('git', ['-c', 'safe.directory=*', 'rev-parse', `HEAD:${rel}`], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  assert.match(oid, /^[0-9a-f]{40}/, '取证前提:该文件必须在 HEAD 上可解析')
  const calls = []
  const res = watermarkPreflight({
    root: REPO,
    paths: [rel],
    blobs: new Map([[rel, oid]]),
    run: (node, args, opts) => {
      calls.push(args)
      return { status: 0 }
    },
  })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(calls.length, 0, '命中豁免台账还去派 verify = 预筛没装车(造好没装车 = 没有)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
