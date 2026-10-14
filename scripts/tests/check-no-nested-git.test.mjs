#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * © 2026 智汇AI · 守门 208 镜像测试(§22c 对账)
 *
 * 被测:scripts/check-no-nested-git.mjs(工作区嵌套 git 仓零容忍,blocking)
 * 判据复制对账:命中(.git 目录/gitfile)/ 豁免(仓库根本体)/ 剪枝(node_modules)/
 *               合法落点(.worktrees 仅顶层,§12d;含反向臂防恒绿)/
 *               不穿透(symlink)/ 有界(truncated 未判完 ⇒ 红)/ CLI 退出码 / 接线问责。
 *
 * 夹具落点:mkScratch 唯一出口(§26)—— 本测试自己**绝不**在工作区建嵌套 .git,
 * 否则就是被自己守的门拦(那正是 2026-10-14 幻影仓事故的形态)。
 *
 * provenance: 3c9e17b4a62d85f0197ea4c3b6d8f25a17c0e94b3d6a2f8c1e5b7d4a9f3c601
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { mkScratch } from '../lib/scratch-dir.mjs'
import { __test__, main as gateMain } from '../check-no-nested-git.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-no-nested-git.mjs')
const { scanForNestedGit, evaluateResult, isRepoRootGit } = __test__

/** 干净夹具根。 */
function cleanRoot() {
  const root = mkScratch('nestedgit-clean-')
  writeFileSync(join(root, 'a.txt'), 'x', 'utf8')
  return root
}

test('T1 干净目录:0 命中,evaluateResult ok', () => {
  const root = cleanRoot()
  const scan = scanForNestedGit(root)
  assert.equal(scan.hits.length, 0)
  assert.equal(scan.truncated, false)
  assert.equal(evaluateResult(scan).ok, true)
})

test('T2 嵌套 .git 目录命中(isDir=true) —— 幻影仓主形态(repo-xxx 整仓残留)', () => {
  const root = mkScratch('nestedgit-dir-')
  const fake = join(root, 'repo-abc123', '.git')
  mkdirSync(fake, { recursive: true })
  writeFileSync(join(fake, 'HEAD'), 'ref: refs/heads/main\n', 'utf8')
  const scan = scanForNestedGit(root)
  assert.equal(scan.hits.length, 1)
  assert.equal(scan.hits[0].isDir, true)
  assert.match(scan.hits[0].path, /repo-abc123/)
  assert.equal(evaluateResult(scan).ok, false)
  assert.match(evaluateResult(scan).reasons[0], /嵌套 \.git 目录/)
})

test('T3 .git gitfile 形态命中 —— worktree 挂载/clone 残留', () => {
  const root = mkScratch('nestedgit-file-')
  mkdirSync(join(root, 'clone'), { recursive: true })
  writeFileSync(join(root, 'clone', '.git'), 'gitdir: ../somewhere/objects\n', 'utf8')
  const scan = scanForNestedGit(root)
  assert.equal(scan.hits.length, 1)
  assert.equal(scan.hits[0].isDir, false)
  assert.match(evaluateResult(scan).reasons[0], /gitfile/)
})

test('T4 扫描根本体的 .git 豁免(仓库根 gitfile 不算嵌套) —— 生产面只豁免 root 自己', () => {
  const root = mkScratch('nestedgit-rootgit-')
  writeFileSync(join(root, '.git'), 'gitdir: ../real-repo\n', 'utf8')
  writeFileSync(join(root, 'sub.txt'), 'x', 'utf8')
  assert.equal(isRepoRootGit(join(root, '.git'), root), true)
  const scan = scanForNestedGit(root)
  assert.equal(scan.hits.length, 0)
  // 但子目录里的 .git 不豁免
  mkdirSync(join(root, 'sub'), { recursive: true })
  writeFileSync(join(root, 'sub', '.git'), 'gitdir: x\n', 'utf8')
  const scan2 = scanForNestedGit(root)
  assert.equal(scan2.hits.length, 1)
  assert.match(scan2.hits[0].path, /sub/)
})

test('T5 node_modules 剪枝:第三方包内 .git 不报也不计入扫描', () => {
  const root = mkScratch('nestedgit-prune-')
  const pkg = join(root, 'node_modules', '.pnpm', 'pkg@1')
  mkdirSync(join(pkg, '.git'), { recursive: true })
  writeFileSync(join(pkg, 'index.js'), 'x', 'utf8')
  const scan = scanForNestedGit(root)
  assert.equal(scan.hits.length, 0)
  assert.equal(scan.scanned, 1) // 只计 root 顶层 node_modules 入口本身,包内整枝不进预算
})

test('T6 symlink/junction 不穿透:链接目标里的 .git 不报', () => {
  const root = mkScratch('nestedgit-link-')
  const target = join(root, 'target')
  mkdirSync(join(target, '.git'), { recursive: true })
  let linked = false
  try {
    symlinkSync(target, join(root, 'link'), 'junction')
    linked = true
  } catch {
    // 无符号链接权限的环境跳过本例(Windows 无开发者模式)
  }
  if (linked) {
    const scan = scanForNestedGit(root)
    // 只看经由链接的命中;target/.git 本身是真实嵌套仓,命中属预期(不稀释判据)
    const viaLink = scan.hits.filter((h) => h.path.startsWith(join(root, 'link')))
    assert.equal(viaLink.length, 0)
    assert.ok(scan.skippedReparse >= 1)
  }
})

test('T7 有界枚举:entryBudget 打满 ⇒ truncated,evaluateResult 按未判完结红', () => {
  const root = cleanRoot()
  const scan = scanForNestedGit(root, { entryBudget: 0 }) // 首条即超限:没判完不能出合格证
  assert.equal(scan.truncated, true)
  const verdict = evaluateResult(scan)
  assert.equal(verdict.ok, false)
  assert.match(verdict.reasons.join('\n'), /未判完/)
})

test('T8 deep nesting 仍在射程:maxDepth 内的深层嵌套 .git 照样命中', () => {
  const root = mkScratch('nestedgit-deep-')
  const deep = join(root, 'a', 'b', 'c', 'd', 'e', '.git')
  mkdirSync(deep, { recursive: true })
  const scan = scanForNestedGit(root, { maxDepth: 10 })
  assert.equal(scan.hits.length, 1)
  // 超出 maxDepth 的不扫(有界语义)
  const scan2 = scanForNestedGit(root, { maxDepth: 3 })
  assert.equal(scan2.hits.length, 0)
})

test('T9 CLI 端到端:含嵌套仓 ⇒ exit 1 且报路径;干净 ⇒ exit 0;--help ⇒ exit 0', () => {
  const dirty = mkScratch('nestedgit-cli-dirty-')
  mkdirSync(join(dirty, 'repo-x', '.git'), { recursive: true })
  const dirtyRun = () =>
    execFileSync(process.execPath, [SCRIPT, '--root', dirty], { encoding: 'utf8' })
  assert.throws(
    () => dirtyRun(),
    (err) => err.status === 1 && /嵌套 \.git 目录/.test(err.stderr) && /repo-x/.test(err.stderr)
  )

  const clean = mkScratch('nestedgit-cli-clean-')
  const out = execFileSync(process.execPath, [SCRIPT, '--root', clean], { encoding: 'utf8' })
  assert.match(out, /嵌套 git 仓 = 0/)

  const help = execFileSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8' })
  assert.match(help, /守门 208/)
})

test('T10 接线问责:门已入库就必须已注册进 guardian-runner(blocking) —— §22d', () => {
  const src = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.match(src, /script: 'check-no-nested-git\.mjs'/)
  assert.match(src, /id: '208'/)
  assert.match(src, /mode: 'blocking'/)
  assert.match(src, /HUSKY_SKIP_NO_NESTED_GIT/)
  // §12e 恒红门防线:判工作区状态的门必须用 stagedTriggers 把射程收到"能造出该状态的那一面",
  // 否则别人在飞的夹具会让我的提交无端变红(唯一结局是逼人 --no-verify,连带废掉全部守门)。
  assert.match(src, /check-no-nested-git\.mjs[\s\S]{0,400}?stagedTriggers: \['scripts\/'\]/)
  // §22d:被测脚本自身须有 isDirectRun 守卫 + __test__ 导出
  const gateSrc = readFileSync(SCRIPT, 'utf8')
  assert.match(gateSrc, /isDirectRun/)
  assert.match(gateSrc, /__test__/)
})

test('T11 生产面全绿问责:对真仓 REPO_ROOT 跑 main() 必须 exit 0(存量 0 棘轮)', async () => {
  // main() 直接 await(import 面,不 spawn);真仓此刻干净,一旦有人在工作区建嵌套仓,
  // 本例与守门 208 同时红 —— 双向问责。
  const code = await gateMain(['--root', REPO])
  assert.equal(code, 0)
})

test('T12 §12d 合法落点:顶层 .worktrees 下的 worktree 挂载不判红,同形态落别处照旧命中(活性自证)', () => {
  const root = mkScratch('nestedgit-wt-')
  // linked worktree 的天然形态:检出目录里 .git 是 gitfile,不是目录
  mkdirSync(join(root, '.worktrees', 'wt-demo'), { recursive: true })
  writeFileSync(
    join(root, '.worktrees', 'wt-demo', '.git'),
    'gitdir: D:/IHUI-AI-git-repo/worktrees/wt-demo\n',
    'utf8'
  )
  assert.equal(scanForNestedGit(root).hits.length, 0)

  // 反向臂:同一形态落在非合法目录 ⇒ 必须命中(证明豁免不是把整片判据关掉,那会是恒绿)
  mkdirSync(join(root, '.ihui-agent', 'tmp', 'wt-copy'), { recursive: true })
  writeFileSync(join(root, '.ihui-agent', 'tmp', 'wt-copy', '.git'), 'gitdir: x\n', 'utf8')
  const dirty = scanForNestedGit(root)
  assert.equal(dirty.hits.length, 1)
  assert.match(dirty.hits[0].rel, /wt-copy/)
})

test('T13 豁免面不随深度扩散:.worktrees 只在扫根直属一层生效', () => {
  const root = mkScratch('nestedgit-wt-deep-')
  mkdirSync(join(root, 'packages', 'app', '.worktrees', 'wt-x'), { recursive: true })
  writeFileSync(join(root, 'packages', 'app', '.worktrees', 'wt-x', '.git'), 'gitdir: x\n', 'utf8')
  const scan = scanForNestedGit(root)
  assert.equal(scan.hits.length, 1)
  assert.match(scan.hits[0].rel, /\.worktrees/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
