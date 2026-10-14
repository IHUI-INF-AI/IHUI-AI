#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * © 2026 智汇AI · 守门 207 镜像测试(§22c 对账)
 *
 * 被测:scripts/check-agents-doc-size.mjs(AGENTS.md 体积守门,warn 起步)
 * 判据不复制:全部走 `__test__` 与 `main()`(§22c/§0"单一真相源")。
 *
 * 这一族最需要钉的是**取材口径**:门声称"全量判 HEAD blob、--staged 判索引 blob",
 * 而拿工作树冒充 HEAD 的写法永远不会被"真仓刚好超预算"这种测法发现。所以夹具刻意造出
 * **三个面各不相同**的一份文档:HEAD 小、索引大、工作树大 —— 三面各跑一次,读数必须互不相同。
 *
 * 夹具落点:mkScratch 唯一出口(§26/守门 208)—— 本测试会 `git init` 临时仓,
 * 绝不在工作区内建(那正是 2026-10-14 幻影仓事故)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { mkScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as G, main } from '../check-agents-doc-size.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-agents-doc-size.mjs')
const GIT = resolveGitBin()
const { judgeSize, measure, DOC_REL, BYTE_BUDGET } = G

/** 夹具仓:git init + 一次提交。`commitContent` 为 null 时提交里没有这份文档。 */
function makeRepo(commitContent) {
  const root = mkScratch('agents-doc-size-')
  const git = (args) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', '-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], // §12g
      windowsHide: true,
      timeout: 60_000,
    })
  git(['init', '-b', 'main'])
  if (commitContent !== null) {
    writeFileSync(join(root, DOC_REL), commitContent, 'utf8')
    git(['add', DOC_REL])
  }
  git(['-c', 'user.name=fixture', '-c', 'user.email=fixture@local', 'commit', '-m', 'fixture', '--allow-empty'])
  return { root, git }
}

const SMALL = 'x'.repeat(100) + '\n' // 预算内
const BIG = 'y'.repeat(BYTE_BUDGET + 1) + '\n' // 超预算

test('M1 三面各不相同 ⇒ 全量档必须读 HEAD blob(不是滞后工作树)', async () => {
  const { root } = makeRepo(SMALL)
  writeFileSync(join(root, DOC_REL), BIG, 'utf8') // 只改工作树,不 add
  const rc = await main(['--root', root])
  assert.equal(rc, 0, 'HEAD 面是小的 ⇒ 应在预算内(读到工作树的大值就会误报 warn)')
})

test('M2 --worktree 逃生舱读到磁盘大值 ⇒ warn(与 M1 同夹具不同读数,证明三面不是一面)', async () => {
  const { root } = makeRepo(SMALL)
  writeFileSync(join(root, DOC_REL), BIG, 'utf8')
  const rc = await main(['--root', root, '--worktree'])
  assert.equal(rc, 1)
})

test('M3 --staged 判索引 blob:git add 之后索引那份是大的 ⇒ warn(盘上随后改对不算修好)', async () => {
  const { root, git } = makeRepo(SMALL)
  writeFileSync(join(root, DOC_REL), BIG, 'utf8')
  git(['add', DOC_REL])
  const rc = await main(['--root', root, '--staged'])
  assert.equal(rc, 1)
  // 反向对照:把工作树改回小的但不 add ⇒ 索引仍是大的,仍该 warn
  writeFileSync(join(root, DOC_REL), SMALL, 'utf8')
  assert.equal(await main(['--root', root, '--staged']), 1, '索引未回小 ⇒ 不该被工作树洗白')
})

test('M4 该面没有这份文档 ⇒ exit 2 显式未判定(既不记绿也不冒红)', async () => {
  const { root } = makeRepo(null)
  const rc = await main(['--root', root])
  assert.equal(rc, 2)
})

test('M5 两面旗同给 ⇒ exit 2(取材口径互斥,不得静默挑一面)', async () => {
  const { root } = makeRepo(SMALL)
  assert.equal(await main(['--root', root, '--staged', '--worktree']), 2)
})

test('M6 判别力逐字节:预算内 / 恰等预算 / 超 1 字节 —— 三档必须各有归宿', () => {
  assert.equal(judgeSize({ bytes: BYTE_BUDGET - 1, lines: 1, headBytes: 0 }).level, 'green')
  assert.equal(judgeSize({ bytes: BYTE_BUDGET, lines: 1, headBytes: 0 }).level, 'green')
  const over = judgeSize({ bytes: BYTE_BUDGET + 1, lines: 1, headBytes: 0 })
  assert.equal(over.level, 'warn')
  assert.match(over.text, /超预算 1 B/)
})

test('M7 HEAD 取不到 ⇒ 明说不给差值(把"不知道"当 0 会写出一串假增量)', () => {
  const r = judgeSize({ bytes: 10, lines: 1, headBytes: null })
  assert.match(r.text, /不给差值/)
  assert.doesNotMatch(r.text, /\+\d+ B/)
})

test('M8 measure 口径:字节按 UTF-8 量(中文文档不能按字符数),空文档 0 行', () => {
  assert.equal(measure('中').bytes, 3)
  assert.deepEqual(measure(''), { bytes: 0, lines: 0 })
  assert.equal(measure('a\nb\nc').lines, 3)
})

test('M9 生产面必须量到:真仓取材成功(rc 只允许 0 或 1,永不允许 2)', async () => {
  const rc = await main([])
  assert.ok(rc === 0 || rc === 1, `取材失败(rc=2)意味着门在真仓上是瞎的:${rc}`)
})

test('T10 接线问责:门体在位 + runner 条目 warn/skipEnv/stagedTriggers 成套 + 文档点名(§12e 定级同值)', () => {
  const runner = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.match(runner, /script: 'check-agents-doc-size\.mjs'/)
  assert.match(runner, /id: '207'/)
  // 定级同值:注册说 warn,门体就不能自称 blocking(§0"名字承诺与实现兑现")
  assert.match(runner, /id: '207'[\s\S]{0,600}?mode: 'warn'/)
  assert.match(runner, /HUSKY_SKIP_AGENTS_DOC_SIZE/)
  assert.match(runner, /id: '207'[\s\S]{0,600}?stagedTriggers: \['AGENTS\.md'\]/)
  const doc = readFileSync(join(REPO, 'AGENTS.md'), 'utf8')
  assert.match(doc, /check-agents-doc-size\.mjs/, '门 89 R4:已接线的门文档面必须点名')
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /isDirectRun/)
  assert.match(src, /__test__/)
  assert.match(src, /warn 起步/)
})

test('T11 自检必须在调用者能读到的那一档跑绿(§0.9 判据不能只"造好没装车")', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--self-test'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 120_000,
  })
  assert.match(out, /自检 \d+ 例,失败 0/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
