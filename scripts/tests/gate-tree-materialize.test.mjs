// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具:按路径集物化树(scripts/lib/tree-materialize.mjs)。
//
// 判据全部落在 mkScratch() 里的假仓库/假缓存上 —— 不碰真实 `.git`,不读写开发工作区。
// 关键几条用**真子进程**:跨进程的构建锁只有真并发才能证明"同树同集只有一份在建"。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  cleanGitEnv,
  liveEntryDirs,
  materializeTree,
  matchesSpecSet,
  normalizePathSpecs,
  pathSetKey,
  pruneTreeCache,
  sweepUntracked,
} from '../lib/tree-materialize.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const MODULE_URL = pathToFileURL(join(resolve(HERE, '..'), 'lib', 'tree-materialize.mjs')).href

function git(repo, args, { env } = {}) {
  const res = spawnSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: env ?? cleanGitEnv(),
  })
  if ((res.status ?? 1) !== 0) throw new Error(`git ${args.join(' ')} 失败: ${String(res.stderr).split('\n')[0]}`)
  return String(res.stdout).trim()
}

/** 造一个小仓库:A.txt / B.txt / dir/C.txt / dir/nested/D.txt,一次提交。 */
function fixtureRepo(t) {
  const base = mkScratch('tree-materialize-test-')
  t.after(() => rmScratch(base))
  const repo = join(base, 'repo')
  mkdirSync(join(repo, 'dir', 'nested'), { recursive: true })
  writeFileSync(join(repo, 'A.txt'), 'alpha\n', 'utf8')
  writeFileSync(join(repo, 'B.txt'), 'beta\n', 'utf8')
  writeFileSync(join(repo, 'dir', 'C.txt'), 'gamma\n', 'utf8')
  writeFileSync(join(repo, 'dir', 'nested', 'D.txt'), 'delta\n', 'utf8')
  git(repo, ['init', '--quiet'])
  // 夹具关掉宿主的 autocrlf:`git archive`(全量与子集共用)会按它做 eol 转换,
  // 开着的话断言就得跟着宿主配置跑。关掉后"archive 字节 == git 对象字节",判据才稳定。
  git(repo, ['config', 'core.autocrlf', 'false'])
  git(repo, ['add', '.'])
  git(repo, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', 'fixture'])
  const treeSha = git(repo, ['rev-parse', 'HEAD^{tree}'])
  return { base, repo, gitDir: join(repo, '.git'), treeSha, cacheRoot: join(base, 'tree-cache') }
}

test('path spec:规范化幂等、键稳定、目录=子树、文件=逐字', () => {
  const a = ['scripts/', 'knip.jsonc', 'apps/x/']
  const normalized = normalizePathSpecs(a)
  assert.equal(normalized, 'set:apps/x/|scripts/|knip.jsonc')
  // 幂等:已规范化的字符串再进 matcher 不会再被加 `set:` 前缀
  assert.equal(normalizePathSpecs(normalized), normalized)
  assert.equal(pathSetKey(a), pathSetKey([...a].reverse()))
  assert.ok(matchesSpecSet('scripts/a.mjs', a))
  assert.ok(matchesSpecSet('apps/x/y/z.ts', a))
  assert.ok(matchesSpecSet('knip.jsonc', a))
  assert.ok(!matchesSpecSet('apps/xy/z.ts', a))
  assert.ok(!matchesSpecSet('scriptsx/a.mjs', a))
  assert.ok(matchesSpecSet('anything', 'full'))
})

test('子集落盘:只出现声明路径,内容与 git 对象逐字节一致', async (t) => {
  const f = fixtureRepo(t)
  const handle = await materializeTree({ ...f, paths: ['dir/'] })
  t.after(() => handle.release())
  const root = handle.dir
  assert.ok(existsSync(join(root, 'dir', 'C.txt')))
  assert.ok(existsSync(join(root, 'dir', 'nested', 'D.txt')))
  assert.ok(!existsSync(join(root, 'A.txt')), '未声明的根文件不应被物化')
  assert.ok(!existsSync(join(root, 'B.txt')))
  assert.equal(readFileSync(join(root, 'dir', 'C.txt'), 'utf8'), 'gamma\n')
  assert.equal(readFileSync(join(root, 'dir', 'nested', 'D.txt'), 'utf8'), 'delta\n')
  // 隔离仓骨架必须与全量解包同形:HEAD 指向 gate-cache 分支、index 已 read-tree。
  // 对象来自只读 alternates —— 与门的运行环境一致(门拿到的是 handle.isoEnv),
  // 所以这里也必须带 isoEnv,而不是裸 git(裸 git 看不到 alternates)。
  assert.equal(git(root, ['rev-parse', 'HEAD^{tree}'], { env: handle.isoEnv }), f.treeSha)
  assert.ok(git(root, ['ls-files'], { env: handle.isoEnv }).includes('dir/C.txt'))
})

test('全树:全部落地,且与子集内容同源', async (t) => {
  const f = fixtureRepo(t)
  const full = await materializeTree({ ...f, paths: 'full' })
  t.after(() => full.release())
  const subset = await materializeTree({ ...f, paths: ['dir/'] })
  t.after(() => subset.release())
  const files = readdirSync(full.dir, { recursive: true })
    .map((p) => p.replace(/\\/g, '/'))
    .filter((p) => !p.startsWith('.git') && p !== 'node_modules')
    .sort()
  assert.deepEqual(files, ['A.txt', 'B.txt', 'dir', 'dir/C.txt', 'dir/nested', 'dir/nested/D.txt'])
  assert.equal(readFileSync(join(full.dir, 'A.txt'), 'utf8'), 'alpha\n')
  // 同源:同一棵树、同一个 `git archive`,全量面与子集面在被声明的路径上逐字节相同
  assert.deepEqual(readFileSync(join(full.dir, 'dir', 'C.txt')), readFileSync(join(subset.dir, 'dir', 'C.txt')))
})

test('清扫:只删未跟踪残留,跟踪文件一字节不动', async (t) => {
  const f = fixtureRepo(t)
  const h = await materializeTree({ ...f, paths: ['dir/'] })
  t.after(() => h.release())
  const before = readFileSync(join(h.dir, 'dir', 'C.txt'))
  // 门落在树里的状态文件 / 构建残留(缓存条目跨轮复用时会污染下一轮)
  writeFileSync(join(h.dir, '.ihui-agent-state.json'), '{}', 'utf8')
  mkdirSync(join(h.dir, 'dir', 'stale'))
  writeFileSync(join(h.dir, 'dir', 'stale', 'x.txt'), 'x', 'utf8')
  const swept = sweepUntracked({ repo: f.repo, treeSha: f.treeSha, dir: h.dir })
  assert.equal(swept.removedFiles, 2)
  assert.equal(swept.removedDirs, 1)
  assert.equal(existsSync(join(h.dir, '.ihui-agent-state.json')), false)
  assert.equal(existsSync(join(h.dir, 'dir', 'stale')), false)
  assert.deepEqual(readFileSync(join(h.dir, 'dir', 'C.txt')), before)
  // 幂等:再扫一遍不再删任何东西
  assert.deepEqual(sweepUntracked({ repo: f.repo, treeSha: f.treeSha, dir: h.dir }), { removedFiles: 0, removedDirs: 0 })
})

test('探针:能看到 node:fs/promises 的命名导入读取与目录枚举', async (t) => {
  const base = mkScratch('probe-test-')
  t.after(() => rmScratch(base))
  const root = join(base, 'tree')
  mkdirSync(root)
  writeFileSync(join(root, 'A.txt'), 'alpha\n', 'utf8')
  writeFileSync(join(root, 'B.txt'), 'beta\n', 'utf8')
  const probeBase = join(base, 'p')
  const code = `
import { readFile, readdir } from 'node:fs/promises'
await readFile(process.env.IHUI_READ_PROBE_ROOT + '/A.txt', 'utf8')
await readdir(process.env.IHUI_READ_PROBE_ROOT)
`
  await new Promise((res, rej) => {
    const env = { ...process.env }
    delete env.NODE_TEST_CONTEXT
    env.NODE_OPTIONS = `--import ${pathToFileURL(join(resolve(HERE, '..'), 'lib', 'gate-read-probe.mjs')).href}`
    env.IHUI_READ_PROBE_BASE = probeBase
    env.IHUI_READ_PROBE_ROOT = root
    const p = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'pipe', 'pipe'], env })
    let err = ''
    p.stderr.on('data', (d) => {
      err += d
    })
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(err))))
  })
  const files = readdirSync(base).filter((f) => f.startsWith('p.') && f.endsWith('.json'))
  assert.equal(files.length, 1)
  const data = JSON.parse(readFileSync(join(base, files[0]), 'utf8'))
  // 这是「判据强度」的地基:探针漏了 fs/promises,子集门多读的字节就看不见了。
  assert.ok(data.reads.some((p) => p.endsWith('A.txt')))
  assert.ok(data.dirs.some((p) => p.replace(/\\/g, '/').endsWith('/tree')))
})

test('缓存:同树同集第二次命中,不重新解包', async (t) => {
  const f = fixtureRepo(t)
  const first = await materializeTree({ ...f, paths: ['dir/'] })
  assert.equal(first.cacheHit, false)
  const readyPath = join(f.cacheRoot, f.treeSha, `${first.key}.ready`)
  const before = statSync(readyPath).mtimeMs
  first.release()
  const second = await materializeTree({ ...f, paths: ['dir/'] })
  t.after(() => second.release())
  assert.equal(second.cacheHit, true)
  assert.equal(second.dir, first.dir)
  assert.equal(statSync(readyPath).mtimeMs, before)
})

test('跨进程:同树同集只有一个构建者,其余复用', async (t) => {
  const f = fixtureRepo(t)
  const child = `
    import { materializeTree } from ${JSON.stringify(MODULE_URL)};
    const f = ${JSON.stringify({ repo: f.repo, gitDir: f.gitDir, treeSha: f.treeSha, cacheRoot: f.cacheRoot })};
    const h = await materializeTree({ ...f, paths: ['dir/'], onProgress: (l) => console.log(l) });
    console.log('DIR ' + h.dir);
    h.release();
  `
  const run = () =>
    new Promise((res, rej) => {
      // 必须剥掉 node --test 注入的 NODE_TEST_CONTEXT:子进程会把自己当成"测试子进程"
      // 去找不存在的 IPC 通道,从而在正常收尾时非 0 退出(与被测逻辑无关)。
      const env = { ...process.env }
      delete env.NODE_TEST_CONTEXT
      const p = spawn(process.execPath, ['--input-type=module', '-e', child], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env,
      })
      let out = ''
      let err = ''
      p.stdout.on('data', (d) => {
        out += d
      })
      p.stderr.on('data', (d) => {
        err += d
      })
      p.on('close', (code) => (code === 0 ? res(out) : rej(new Error(`${out}\nSTDERR:\n${err}`))))
    })
  const [a, b] = await Promise.all([run(), run()])
  const builds = (a.match(/TREE_MATERIALIZED/g) ?? []).length + (b.match(/TREE_MATERIALIZED/g) ?? []).length
  assert.equal(builds, 1, `两次并发物化只允许一次构建:${a}\n---\n${b}`)
  const dirs = [a, b].join('\n').match(/DIR .+/g) ?? []
  assert.equal(dirs.length, 2)
  assert.equal(dirs[0], dirs[1])
  assert.ok(/TREE_CACHE_(WAIT_)?HIT/.test(a + b))
})

test('失败不发布:坏 tree 抛错且不留 ready / entry 残骸', async (t) => {
  const f = fixtureRepo(t)
  await assert.rejects(materializeTree({ ...f, treeSha: 'f'.repeat(40), paths: ['dir/'] }))
  const treeRoot = join(f.cacheRoot, 'f'.repeat(40))
  const leftovers = existsSync(treeRoot) ? readdirSync(treeRoot).filter((n) => !n.endsWith('.lock')) : []
  assert.deepEqual(leftovers, [])
})

test('引用计数 + 租约:在用条目 prune 不动,释放后才回收', async (t) => {
  const f = fixtureRepo(t)
  const handle = await materializeTree({ ...f, paths: ['dir/'] })
  assert.ok(liveEntryDirs().has(handle.dir))
  let report = pruneTreeCache({ cacheRoot: f.cacheRoot, maxBytes: 0 })
  assert.ok(report.skippedLive >= 1)
  assert.ok(existsSync(handle.dir), '被引用的树不许被 prune 删掉')
  handle.release()
  assert.ok(!liveEntryDirs().has(handle.dir))
  report = pruneTreeCache({ cacheRoot: f.cacheRoot, maxBytes: 0 })
  assert.ok(report.removed.some((r) => r.dir === handle.dir))
  assert.ok(!existsSync(handle.dir))
  assert.ok(!existsSync(join(f.cacheRoot, f.treeSha, `${handle.key}.ready`)))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
