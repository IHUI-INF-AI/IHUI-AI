// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像用例(§22c):判据 import 源脚本 `__test__`,零复算。
 *
 * 这道门最容易的失效不是"判错",而是**看不见**:`git check-ignore` 默认跳过已跟踪路径,
 * 少了 `--no-index` 时它对"刚 add -f 进来的那一条"恒报 0 命中 —— 与"没有违规"完全同形。
 * 所以 T1 用真 git 仓把这条路走一遍(不靠读源码猜),T2 再钉住"没有 --no-index 就抓不到"
 * 这个事实本身。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { __test__ as G } from '../check-tracked-ignored.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { classifyAdded, ignoredAmong } = G

/** 在 scratch 里起一个真仓:`.ihui-agent/*` 忽略,其余不忽略(与主仓同一条规则形态) */
function scratchRepo() {
  const dir = mkScratch('tracked-ignored')
  const run = (...a) =>
    execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  run('init', '-q')
  run('config', 'user.email', 't@local')
  run('config', 'user.name', 't')
  writeFileSync(join(dir, '.gitignore'), '.ihui-agent/*\n', 'utf8')
  mkdirSync(join(dir, '.ihui-agent', 'tmp'), { recursive: true })
  writeFileSync(join(dir, '.ihui-agent', 'tmp', 'ledger-1.md'), 'x\n', 'utf8')
  writeFileSync(join(dir, 'README.md'), 'r\n', 'utf8')
  run('add', 'README.md', '.gitignore')
  run('commit', '-qm', 'init')
  return { dir, run }
}

describe('check-tracked-ignored:判据面', () => {
  it('T1 被 add -f 强行塞进索引的 gitignored 文件 ⇒ 必须点名(真 git 仓,不 mock)', () => {
    const { dir, run } = scratchRepo()
    try {
      run('add', '-f', '.ihui-agent/tmp/ledger-1.md')
      const added = run('diff', '--cached', '--diff-filter=A', '--name-only', '-z')
        .split('\0')
        .filter(Boolean)
      assert.deepEqual(added, ['.ihui-agent/tmp/ledger-1.md'])
      assert.deepEqual(ignoredAmong(added, { root: dir }), ['.ihui-agent/tmp/ledger-1.md'])
    } finally {
      rmScratch(dir)
    }
  })

  it('T2 同一路径若不带 --no-index,git 会跳过已跟踪项 ⇒ 这正是"门看不见"的现场', () => {
    const { dir, run } = scratchRepo()
    try {
      run('add', '-f', '.ihui-agent/tmp/ledger-1.md')
      // 复现失效形态:不带 --no-index 时 check-ignore 对索引里的路径不输出(exit 1)
      let out = ''
      let status = 0
      try {
        out = execFileSync('git', ['check-ignore', '--stdin', '-z'], {
          cwd: dir,
          encoding: 'utf8',
          input: '.ihui-agent/tmp/ledger-1.md\0',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      } catch (e) {
        status = e.status
      }
      assert.equal(out, '')
      assert.equal(status, 1)
      // 带 --no-index 才有输出 —— 两臂对照,证明这个参数是承重的
      const withFlag = execFileSync('git', ['check-ignore', '--no-index', '--stdin', '-z'], {
        cwd: dir,
        encoding: 'utf8',
        input: '.ihui-agent/tmp/ledger-1.md\0',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      assert.ok(withFlag.includes('.ihui-agent/tmp/ledger-1.md'))
    } finally {
      rmScratch(dir)
    }
  })

  it('T3 未忽略的新增文件不得误报(否则每枚提交都被拦 = 恒红门)', () => {
    const { dir, run } = scratchRepo()
    try {
      writeFileSync(join(dir, 'src.ts'), 's\n', 'utf8')
      run('add', 'src.ts')
      assert.deepEqual(ignoredAmong(['src.ts'], { root: dir }), [])
    } finally {
      rmScratch(dir)
    }
  })

  it('T4 空清单直接返回空,不起 git 进程(也不把空集读成"全干净"的证据)', () => {
    assert.deepEqual(ignoredAmong([]), [])
  })

  it('T5 classifyAdded 保序(逐条点名要按入参顺序,否则日志顺序随实现漂)', () => {
    const ignored = new Set(['b', 'd'])
    assert.deepEqual(classifyAdded(['a', 'b', 'c', 'd'], ignored), ['b', 'd'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
