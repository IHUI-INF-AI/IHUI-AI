// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-95:commit-with-private-index 不得写死盘符,被 import 时不得提交。
 *
 * 跑法:node --test scripts/tests/commit-with-private-index.test.mjs
 *
 * 直跑探针只给零参数(用法错误 exit 2,在 git 调用之前返回)。
 * 不传 msgFile / 路径,因此不会构造私有 index,也不会 git commit。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { __test__ as directRun } from '../check-direct-run-guard.mjs'
import { gitDirFromRepo, REPO, repoRootFromHere, __test__ as priv } from '../lib/commit-with-private-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SRC = fileURLToPath(new URL('../lib/commit-with-private-index.mjs', import.meta.url))
const SRC_TEXT = readFileSync(SRC, 'utf8')

const BANNED_ROOTS = ['D:/IHUI-AI', 'D:\\IHUI-AI']

test('仓根从脚本位置推导,源码不再写死盘符', () => {
  for (const banned of BANNED_ROOTS) {
    assert.equal(SRC_TEXT.includes(banned), false, `源码仍含写死路径 ${banned}`)
  }
  assert.equal(SRC_TEXT.includes('IHUI-AI-git-repo'), false, '源码仍写死 gitdir 目录名')
  const fromScript = resolve(dirname(SRC), '..', '..')
  assert.equal(REPO, fromScript)
  assert.equal(repoRootFromHere(pathToFileURL(SRC).href), fromScript)
  assert.equal(priv.REPO, REPO)
  assert.equal(typeof priv.repoRootFromHere, 'function')
  assert.equal(typeof priv.gitDirFromRepo, 'function')
})

test('gitdir 跟工作树 .git 现读:目录、绝对指针、相对指针', () => {
  const dir = mkScratch('cwpi-gitdir-')
  try {
    const asDir = join(dir, 'wt-dir')
    mkdirSync(join(asDir, '.git'), { recursive: true })
    writeFileSync(join(asDir, '.git', 'HEAD'), 'ref: refs/heads/main\n')
    assert.equal(gitDirFromRepo(asDir), resolve(asDir, '.git'))

    const external = join(dir, 'external-git')
    mkdirSync(external, { recursive: true })
    const asFile = join(dir, 'wt-file')
    mkdirSync(asFile, { recursive: true })
    writeFileSync(join(asFile, '.git'), `gitdir: ${external}\n`)
    assert.equal(gitDirFromRepo(asFile), resolve(external))

    const asRel = join(dir, 'wt-rel')
    mkdirSync(asRel, { recursive: true })
    writeFileSync(join(asRel, '.git'), 'gitdir: ../external-git\n')
    assert.equal(gitDirFromRepo(asRel), resolve(external))

    const missing = join(dir, 'wt-missing')
    mkdirSync(missing, { recursive: true })
    assert.equal(gitDirFromRepo(missing), resolve(missing, '.git'))
  } finally {
    rmScratch(dir)
  }
})

test('本机仓根的 gitdir 落在脚本推导出的工作树里', () => {
  const gd = gitDirFromRepo(REPO)
  assert.equal(gd, resolve(REPO, '.git'))
  assert.equal(existsSync(join(gd, 'HEAD')), true, `gitdir 里没有 HEAD: ${gd}`)
})

test('§22d:pathToFileURL 守卫,门体判放过,import 不提交,零参数直跑只报用法', () => {
  assert.match(
    SRC_TEXT,
    /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/,
  )
  assert.equal(SRC_TEXT.includes("'file:///") || SRC_TEXT.includes('"file:///'), false)
  assert.match(SRC_TEXT, /from 'node:url'/)
  const mainAt = SRC_TEXT.indexOf('async function main()')
  const guardAt = SRC_TEXT.indexOf('if (isDirectRun) {')
  const callAt = SRC_TEXT.indexOf('main().catch(')
  assert.ok(mainAt > 0 && guardAt > mainAt && callAt > guardAt)
  const body = SRC_TEXT.slice(mainAt)
  const usageAt = body.indexOf('process.exit(2)')
  const gitDirAt = body.indexOf('gitDirFromRepo(')
  const commitAt = body.indexOf("['commit'")
  assert.ok(usageAt >= 0 && usageAt < gitDirAt && gitDirAt < commitAt, '用法检查必须排在 gitdir 与 commit 之前')

  const judged = directRun.judgeSource('scripts/lib/commit-with-private-index.mjs', SRC_TEXT)
  assert.equal(judged.state, 'pass', JSON.stringify(judged))
  assert.equal(judged.hits.length, 0)

  const imp = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(SRC).href)}); console.log('IMPORTED_OK')`],
    { encoding: 'utf8', windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  assert.equal(imp.status, 0, `import 不得 process.exit\nstderr:${imp.stderr}\nstdout:${imp.stdout}`)
  assert.match(imp.stdout, /IMPORTED_OK/)
  const impOut = `${imp.stdout}\n${imp.stderr}`
  assert.equal(impOut.includes('提交结果'), false)
  assert.equal(impOut.includes('私有 index'), false)
  assert.equal(impOut.includes('COMMIT_EDITMSG'), false)

  const cli = spawnSync(process.execPath, [SRC], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(cli.status, 2, `零参数直跑应 exit 2,实得 ${cli.status}\n${cli.stdout}\n${cli.stderr}`)
  assert.match(cli.stderr, /用法/)
  const cliOut = `${cli.stdout}\n${cli.stderr}`
  assert.equal(cliOut.includes('提交结果'), false)
  assert.equal(cliOut.includes('私有 index'), false)

  const rel = spawnSync(process.execPath, ['scripts/lib/commit-with-private-index.mjs'], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(rel.status, 2, `相对路径直跑应仍识别为 CLI,实得 ${rel.status}\n${rel.stdout}\n${rel.stderr}`)
  assert.match(rel.stderr, /用法/)
  assert.equal(`${rel.stdout}\n${rel.stderr}`.includes('提交结果'), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
