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
 *
 * 2026-10-23 修第二种失效(**恒红**):旧全量档把 `git ls-files` 的全量 tracked 路径当"新增",
 * 于是 HEAD 里 25 条存量每轮全判红,与头注"存量只报数"自相矛盾(§12e)。T6–T11 用
 * 源脚本的 `evaluate(root)` 在 scratch 真仓里钉住三档退出码:全量有存量 ⇒ 0、
 * `--staged` 新增 ⇒ 1、取不到面 ⇒ 2、`--strict` 问责档 ⇒ 只有带旗才判红。
 *
 * 同日回填台账 exemptions(第四轮收敛里该特性所在路径被声明式取对侧取代,随即重落地):
 * T12/T13 钉"staged 档认 G-926 台账 —— 登记且未过期 ⇒ 放行但逐条点名、过期 ⇒ 回 red",
 * W1–W4 钉纯判据 `classifyWithLedger` 的两桶口径与目录边界前缀。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { __test__ as G } from '../check-tracked-ignored.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { classifyAdded, ignoredAmong, classifyWithLedger, evaluate } = G

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

/** 把 `n` 个 gitignored 文件 add -f 并提交进 HEAD(造"存量"现场) */
function commitIgnoredStock(dir, run, n) {
  const names = []
  for (let i = 0; i < n; i += 1) {
    const rel = `.ihui-agent/tmp/stock-${i}.md`
    writeFileSync(join(dir, '.ihui-agent', 'tmp', `stock-${i}.md`), 'x\n', 'utf8')
    run('add', '-f', rel)
    names.push(rel)
  }
  run('commit', '-qm', 'stock')
  return names
}

describe('check-tracked-ignored:全量档永不恒红(§12e)', () => {
  it('T6 HEAD 里 25 条存量 ⇒ 全量档 exit 0,打印计数与清单,一条都不判红', () => {
    const { dir, run } = scratchRepo()
    try {
      const names = commitIgnoredStock(dir, run, 25)
      const r = evaluate([], { root: dir })
      assert.equal(r.code, 0, '存量只报数:全量档必须 exit 0')
      assert.equal(r.stock.length, 25)
      assert.equal(r.bad.length, 0)
      assert.match(r.stdout[0], /存量\(只报数\)25 条/)
      const listed = r.stdout.filter((l) => l.startsWith('  · ')).map((l) => l.slice(4))
      assert.deepEqual(listed, r.stock, '清单要与存量清单同序逐条点名')
      assert.deepEqual([...r.stock].sort(), [...names].sort())
    } finally {
      rmScratch(dir)
    }
  })

  it('T7 全量档根本不取"新增"面(索引里刚 add -f 的路径只进存量清单,不判红)', () => {
    const { dir, run } = scratchRepo()
    try {
      commitIgnoredStock(dir, run, 3)
      writeFileSync(join(dir, '.ihui-agent', 'tmp', 'fresh.md'), 'x\n', 'utf8')
      run('add', '-f', '.ihui-agent/tmp/fresh.md')
      const r = evaluate([], { root: dir })
      assert.equal(r.code, 0)
      assert.equal(r.added.length, 0, '全量档不得把全量 tracked 路径当"新增"')
      assert.equal(r.stock.length, 4)
      assert.ok(r.stock.includes('.ihui-agent/tmp/fresh.md'))
    } finally {
      rmScratch(dir)
    }
  })

  it('T8 --strict 是显式问责档:存量 > 0 才 exit 1,不带旗的默认档位恒 0', () => {
    const { dir, run } = scratchRepo()
    try {
      commitIgnoredStock(dir, run, 2)
      assert.equal(evaluate([], { root: dir }).code, 0)
      const strict = evaluate(['--strict'], { root: dir })
      assert.equal(strict.code, 1)
      assert.match(strict.stdout[0], /--strict 下存量 2 条判红/)
    } finally {
      rmScratch(dir)
    }
  })
})

describe('check-tracked-ignored:staged 档不得被削弱(本次新增仍必须红)', () => {
  it('T9 本次提交新增一条 gitignored 路径 ⇒ exit 1 并逐条点名', () => {
    const { dir, run } = scratchRepo()
    try {
      run('add', '-f', '.ihui-agent/tmp/ledger-1.md')
      const r = evaluate(['--staged'], { root: dir })
      assert.equal(r.code, 1)
      assert.deepEqual(r.bad, ['.ihui-agent/tmp/ledger-1.md'])
      assert.ok(r.stderr.join('\n').includes('.ihui-agent/tmp/ledger-1.md'))
    } finally {
      rmScratch(dir)
    }
  })

  it('T10 新增的是未忽略文件 ⇒ exit 0(否则每枚提交都被拦 = 恒红门)', () => {
    const { dir, run } = scratchRepo()
    try {
      writeFileSync(join(dir, 'src.ts'), 's\n', 'utf8')
      run('add', 'src.ts')
      const r = evaluate(['--staged'], { root: dir })
      assert.equal(r.code, 0)
      assert.deepEqual(r.added, ['src.ts'])
      assert.deepEqual(r.bad, [])
    } finally {
      rmScratch(dir)
    }
  })

  it('T12 --staged 档认 G-926 台账:登记且未过期的目录 ⇒ exit 0,逐条点名但放行', () => {
    const { dir, run } = scratchRepo()
    try {
      run('add', '-f', '.ihui-agent/tmp/ledger-1.md')
      const r = evaluate(['--staged'], {
        root: dir,
        ledger: [{ dir: '.ihui-agent/tmp', until: '2099-12-31' }],
      })
      assert.equal(r.code, 0)
      assert.deepEqual(r.bad, [], '台账内的新增不得判红(否则就是第二把尺子,§0.6)')
      assert.deepEqual(r.exempt, [
        { path: '.ihui-agent/tmp/ledger-1.md', dir: '.ihui-agent/tmp', until: '2099-12-31' },
      ])
      // 豁免不是静默通过:点名行必须在 stdout 里(台账上与日志上看得见的是同一份)
      assert.ok(r.stdout.some((l) => l.includes('按 G-926 台账放行')))
    } finally {
      rmScratch(dir)
    }
  })

  it('T13 台账到期 ⇒ 自动回到 red(登记过不等于永远免)', () => {
    const { dir, run } = scratchRepo()
    try {
      run('add', '-f', '.ihui-agent/tmp/ledger-1.md')
      const r = evaluate(['--staged'], {
        root: dir,
        ledger: [{ dir: '.ihui-agent/tmp', until: '2020-01-01' }],
      })
      assert.equal(r.code, 1)
      assert.deepEqual(r.bad, ['.ihui-agent/tmp/ledger-1.md'])
      assert.deepEqual(r.exempt, [])
    } finally {
      rmScratch(dir)
    }
  })
})

describe('check-tracked-ignored:取不到被审面 ⇒ exit 2(未判定)', () => {
  it('T11 非 git 目录 ⇒ 两档都 exit 2,既不记绿也不冒红', () => {
    const dir = mkScratch('tracked-ignored-nogit')
    const run = (...a) =>
      execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    try {
      // 前置:这个目录必须真的"不在任何仓里",否则本用例证明不了 fail-closed
      let reachable = true
      try {
        run('rev-parse', '--show-toplevel')
      } catch {
        reachable = false
      }
      assert.equal(reachable, false, '前置:scratch 落点必须是非 git 目录')
      for (const argv of [[], ['--staged']]) {
        const r = evaluate(argv, { root: dir })
        assert.equal(r.code, 2)
        assert.match(r.stderr.join('\n'), /未判定/)
        assert.equal(r.stdout.length, 0)
      }
    } finally {
      rmScratch(dir)
    }
  })
})

describe('classifyWithLedger:认 G-926 台账,不做第二把尺子', () => {
  const today = '2026-10-23'
  const ledger = [
    { dir: '.ihui-agent/archive', until: '2027-04-21' },
    { dir: 'apps/ai-service/app/skills/content_engine/articles', until: '2026-10-22' },
  ]

  it('W1 落在已登记且未过期的目录 ⇒ 放行,但**要点名**出来(不是静默通过)', () => {
    const r = classifyWithLedger(['.ihui-agent/archive/AGENTS_trim-x.md'], ledger, today)
    assert.deepEqual(r.red, [])
    assert.deepEqual(r.exempt, [
      {
        path: '.ihui-agent/archive/AGENTS_trim-x.md',
        dir: '.ihui-agent/archive',
        until: '2027-04-21',
      },
    ])
  })

  it('W2 台账到期 ⇒ 自动回到 red(登记过不等于永远免)', () => {
    const r = classifyWithLedger(
      ['apps/ai-service/app/skills/content_engine/articles/x.md'],
      ledger,
      today,
    )
    assert.equal(r.exempt.length, 0)
    assert.deepEqual(r.red, ['apps/ai-service/app/skills/content_engine/articles/x.md'])
  })

  it('W3 不在台账里的目录 ⇒ red(这正是本门存在的理由)', () => {
    const r = classifyWithLedger(['.ihui-agent/tmp/plan-pointer-purge-x-1.md'], ledger, today)
    assert.deepEqual(r.red, ['.ihui-agent/tmp/plan-pointer-purge-x-1.md'])
  })

  it('W4 前缀必须按目录边界匹配:`…/articles-old/` 不得借 `…/articles` 的豁免', () => {
    const r = classifyWithLedger(['.ihui-agent/archive-old/x.md'], ledger, today)
    assert.deepEqual(r.red, ['.ihui-agent/archive-old/x.md'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
