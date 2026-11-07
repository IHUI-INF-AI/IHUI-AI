// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:doc-numbers 取数面唯一化(2026-11-07 票「doc-numbers 三面并存 ⇒ 两门互斥读数」)。
 *
 * 病灶:写手 `gen-doc-numbers.mjs` 默认按**工作树**面取数,而门 173 的 `--staged` 段按索引面、
 * 默认(全量)段按 HEAD 面判 —— 同一刻三面并存(实测 worktree testFiles=4623 / head 4341),
 * 于是"写手刚按工作树算完写进 README,提交口按索引判红、推送口按 HEAD 判绿"两门互斥。
 *
 * 红线(每条都由本器真跑生产入口,零复算):
 *  A. 写手默认面 = 索引面:**未暂存 / 未跟踪**的工作树文件不得进入默认输出;
 *  B. 默认输出与 `--face=staged` **逐字节相同**(同一面,不许各算一套);
 *  C. 门 173 的两段在同一份内容(索引 == HEAD)上给**同一结论**:rc 相等、违规条数相等。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GEN = join(ROOT, 'scripts', 'gen-doc-numbers.mjs')
const GATE = join(ROOT, 'scripts', 'check-doc-numbers.mjs')

/** 派生 git 一律显式接管 stdio(AGENTS §12g,不写稳定 EBUSY)。 */
function git(repo, args) {
  const r = spawnSync(
    'git',
    ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr}`)
  return r.stdout.trim()
}

function runNode(script, args, cwd) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return { rc: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

/**
 * 造一个"三面并存"的最小现场:
 *   HEAD/索引 = 2 张表;索引再 +1(已 add,未提交);工作树再 +5(未跟踪)。
 * ⇒ 索引面 3 / HEAD 面 2 / 工作树面 8,三个数互不相同。
 */
function makeRepo(dir) {
  const schema = join(dir, 'packages', 'database', 'src', 'schema')
  mkdirSync(schema, { recursive: true })
  git(dir, ['init', '-q'])
  writeFileSync(join(schema, 'a.ts'), 'export const a1 = pgTable("a1", {})\nexport const a2 = pgTable("a2", {})\n', 'utf8')
  // 一条真声明:让两段判定都有可判的"存量违规",用来证明两段不会互斥
  writeFileSync(join(dir, 'README.md'), '# fixture\n\n999 张表\n', 'utf8')
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'base'])
  writeFileSync(join(schema, 'b.ts'), 'export const b1 = pgTable("b1", {})\n', 'utf8')
  git(dir, ['add', 'packages/database/src/schema/b.ts'])
  // 未跟踪:只在工作树面里,默认面绝不许看见它
  writeFileSync(
    join(schema, 'c.ts'),
    ['c1', 'c2', 'c3', 'c4', 'c5'].map((n) => `export const ${n} = pgTable("${n}", {})`).join('\n') + '\n',
    'utf8',
  )
  return dir
}

test('A/B 写手默认面 = 索引面:未跟踪的工作树文件不得进入默认输出', () => {
  const dir = mkScratch('doc-numbers-single-face')
  try {
    makeRepo(dir)
    const byFace = (face) => {
      const { rc, out } = runNode(GEN, ['--root', dir, '--json', '--face', face], dir)
      assert.equal(rc, 0, out)
      return JSON.parse(out)
    }
    const staged = byFace('staged')
    const worktree = byFace('worktree')
    const byDefault = runNode(GEN, ['--root', dir, '--json'], dir)
    assert.equal(byDefault.rc, 0, byDefault.out)
    const def = JSON.parse(byDefault.out)

    assert.equal(staged.numbers.dbTables, 3, '索引面 = 2(HEAD) + 1(已 add)')
    assert.equal(worktree.numbers.dbTables, 8, '工作树面 = 3 + 5(未跟踪)')
    assert.equal(def.numbers.dbTables, 3, '默认面必须等于索引面,不许把未跟踪文件算进来')
    assert.equal(
      JSON.stringify(def),
      JSON.stringify(staged),
      '默认输出与 --face=staged 必须逐字节等值(同一面,不许各算一套)',
    )
    assert.notEqual(
      JSON.stringify(def),
      JSON.stringify(worktree),
      '对照:工作树面必须与默认面不同,否则本夹具没造出"三面并存"',
    )
  } finally {
    rmScratch(dir)
  }
})

test('C 门 173 两段同内容同结论:索引 == HEAD 时 rc 与违规条数逐项相等', () => {
  const dir = mkScratch('doc-numbers-two-segments')
  try {
    makeRepo(dir)
    // 让索引 == HEAD:把 b.ts 也提交掉(c.ts 仍未跟踪 ⇒ 工作树面仍不同)
    git(dir, ['commit', '-q', '-m', 'stage b'])
    // 问责档(--strict)= 无条件全判,绕开"本轮是否触及"的问责时机棘轮 ⇒ 两段面对同一份内容必须给同一结论
    const head = runNode(GATE, ['--strict'], dir)
    const staged = runNode(GATE, ['--staged', '--strict'], dir)
    assert.equal(head.rc, staged.rc, `两段 rc 互斥:HEAD 面 ${head.rc} / 索引面 ${staged.rc}\n--- HEAD ---\n${head.out}\n--- STAGED ---\n${staged.out}`)
    const pick = (out) => (out.match(/违规\s*(\d+)/) ?? [])[1] ?? null
    assert.equal(pick(head.out), pick(staged.out), `两段违规条数互斥:\n--- HEAD ---\n${head.out}\n--- STAGED ---\n${staged.out}`)
    // 两段都必须真的进了问责(非零),否则"相等"可能只是两段都没判
    assert.notEqual(head.rc, 0, `本夹具要求两段都进问责档,否则 C 段是假证:\n${head.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('D 写手入口默认面锁(源码级):不得把工作树面再当默认', () => {
  const src = readFileSync(GEN, 'utf8')
  assert.match(src, /parseFaceArg\(argv, \{ def: 'staged' \}\)/, "写手入口的默认面必须是 'staged'(改回 worktree 就是回到三面并存)")
  assert.doesNotMatch(src, /parseFaceArg\(argv, \{ def: 'worktree' \}\)/, '写手入口不得再把工作树面当默认')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
