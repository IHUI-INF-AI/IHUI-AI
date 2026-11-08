// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22d 单写手收口夹具(2026-11-07 票「写 README 生成块的进程不止一个」)。
 *
 * 病灶:同一段 GENERATED NUMBERS 块有多个进程各写一遍(pre-commit / post-commit /
 * safe-commit / auto-commit 链 + 人肉 `gen-doc-numbers.mjs --markdown` 粘贴),取数面还不统一。
 * 结果同一批数字以 worktree / 索引 / HEAD 三份形态并存:
 * 门 173 判索引面、DN2 判 HEAD 面,同一轮能出现「173 绿 / DN2 红」的互斥读数。
 *
 * 本夹具的四条红线(全部真跑生产入口,零复算):
 *  A. 唯一入口写成功:`sync-readme-numbers.mjs` 按索引面取数、原子落盘、自动 git add,且幂等;
 *  B. 第二个调用方被拒并报错:裸 `--markdown` / 伪写手令牌 / 活进程持锁 ⇒ exit 2,
 *     且文件一字未动(不许静默覆盖);
 *  C. 写期间被外部改动 ⇒ 判未判定(exit 3)、打印双方读数、不写盘(不许「后写者赢」);
 *  D. 同一份文件两段判定不再互斥:写手落盘并提交后,HEAD 段与 staged 段 rc / 违规条数逐项相等。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
/**
 * 旧实现自证入口:指向 HEAD 版 scripts 的独立副本。
 * 旧 sync 不认 `--root`(ROOT 由脚本位置推),所以旧实现模式要把脚本副本放进**夹具仓内**
 * (`<fixture>/scripts`),让它只在该仓里打转,绝不碰真仓。
 */
const OLD_MODE = Boolean(process.env.IHUI_DOCNUM_SCRIPTS_DIR)
const SCRIPTS_DIR = OLD_MODE ? resolve(process.env.IHUI_DOCNUM_SCRIPTS_DIR) : join(ROOT, 'scripts')
const scriptsDirFor = (dir) => (OLD_MODE ? join(dir, 'scripts') : SCRIPTS_DIR)
const genOf = (dir) => join(scriptsDirFor(dir), 'gen-doc-numbers.mjs')
const syncOf = (dir) => join(scriptsDirFor(dir), 'sync-readme-numbers.mjs')
const gateOf = (dir) => join(scriptsDirFor(dir), 'check-doc-numbers.mjs')

const BEGIN = '<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->'
const END = '<!-- END GENERATED NUMBERS -->'

/**
 * 夹具仓:新版每测一份 scratch;旧实现模式**复用 HEAD 版脚本副本所在仓**(旧 sync 的 ROOT
 * 由脚本位置推导,只认"脚本同级仓"),每测先重置该仓内容 —— 旧实现绝无机会写到真仓。
 */
const OLD_ROOT = OLD_MODE ? resolve(SCRIPTS_DIR, '..') : null
const fixtureDir = (tag) => (OLD_MODE ? OLD_ROOT : mkScratch(tag))
const dropFixture = (dir) => {
  if (!OLD_MODE) rmScratch(dir)
}
function resetOldRepo(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'scripts' || entry === '.git') continue
    rmSync(join(dir, entry), { recursive: true, force: true })
  }
  rmSync(join(dir, '.git'), { recursive: true, force: true })
}

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

function runNode(script, args, cwd, extraEnv = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...extraEnv },
  })
  return { rc: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 造最小现场:HEAD = 2 张表,索引再 +1(已 add 未提交) ⇒ 索引面 3 / HEAD 面 2。 */
function makeRepo(dir) {
  if (OLD_MODE) resetOldRepo(dir)
  const schema = join(dir, 'packages', 'database', 'src', 'schema')
  mkdirSync(schema, { recursive: true })
  git(dir, ['init', '-q'])
  writeFileSync(join(schema, 'a.ts'), 'export const a1 = pgTable("a1", {})\nexport const a2 = pgTable("a2", {})\n', 'utf8')
  const stale = [
    BEGIN,
    '| 指标 | 现值 | 取数键 |',
    '| ---- | ---- | ------ |',
    '| 数据库表 | 1 | `dbTables` |',
    '| 跟踪文件 | 1 | `trackedFiles` |',
    '',
    '上表由 `node scripts/sync-readme-numbers.mjs` 生成,最后核对日期 2026-01-01。',
    END,
  ].join('\n')
  // 一条真声明(999 张表)保证门的两段都有可判的存量违规,用来证明两段不互斥
  writeFileSync(join(dir, 'README.md'), `# fixture\n\n999 张表\n\n${stale}\n\n尾注\n`, 'utf8')
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'base'])
  writeFileSync(join(schema, 'b.ts'), 'export const b1 = pgTable("b1", {})\n', 'utf8')
  git(dir, ['add', 'packages/database/src/schema/b.ts'])
  // 一个**未跟踪**的同 schema 文件:索引面 3 张表 / 工作树面 4 张表。
  // 专门钉死"按工作树面取数会多算"这半个病:旧写手按工作树面写 4,门按索引面判 3 ⇒ 互斥。
  writeFileSync(join(schema, 'c.ts'), 'export const c1 = pgTable("c1", {})\n', 'utf8')
  return dir
}

const readmeOf = (dir) => readFileSync(join(dir, 'README.md'), 'utf8')
const trackedInBlock = (text) => Number((text.match(/\| 跟踪文件 \| (\d+) \|/) ?? [])[1])
const stagedPaths = (dir) => git(dir, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean)

test('A 唯一入口写成功:按索引面落盘 + 自动 add + 幂等', () => {
  const dir = fixtureDir('docnum-writer-single')
  try {
    makeRepo(dir)
    const r = runNode(syncOf(dir), ['--root', dir], dir)
    assert.equal(r.rc, 0, r.out)
    const text = readmeOf(dir)
    assert.match(text, /\| 数据库表 \| 3 \| `dbTables` \|/, `必须按索引面取数(2 HEAD + 1 已 add):\n${text}`)
    assert.equal(trackedInBlock(text), git(dir, ['ls-files', '--cached']).split('\n').filter(Boolean).length)
    assert.ok(stagedPaths(dir).includes('README.md'), '唯一入口必须把 README 加入索引')
    assert.match(r.out, /STAGED:README\.md/)

    const before = git(dir, ['diff', '--cached', '--stat'])
    const r2 = runNode(syncOf(dir), ['--root', dir], dir)
    assert.equal(r2.rc, 0, r2.out)
    assert.match(r2.out, /数字无变化/, '第二轮必须幂等,不许造自激提交')
    assert.equal(git(dir, ['diff', '--cached', '--stat']), before, '幂等轮不得改动索引')
  } finally {
    dropFixture(dir)
  }
})

test('B 第二个调用方被拒并报错:裸 --markdown / 伪令牌 / 活锁 ⇒ exit 2 且文件不动', () => {
  const dir = fixtureDir('docnum-writer-refuse')
  try {
    makeRepo(dir)
    const original = readmeOf(dir)

    // B1 裸 --markdown(历史人肉粘贴通道)
    const raw = runNode(genOf(dir), ['--markdown', '--root', dir], dir)
    assert.equal(raw.rc, 2, `裸 --markdown 必须 fail-loud:\n${raw.out}`)
    assert.match(raw.out, /唯一写入口/)

    // B2 伪写手令牌
    const fake = runNode(genOf(dir), ['--markdown', '--root', dir], dir, { IHUI_DOCNUM_WRITER: 'another-writer' })
    assert.equal(fake.rc, 2, `伪令牌必须拒绝:\n${fake.out}`)
    assert.match(fake.out, /唯一写入口/)

    // B3 活进程持锁(模拟第二个写手在跑)
    const lockPath = join(dir, '.git', 'ihui-docnum-writer.lock')
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: 'fixture-holder' }), 'utf8')
    const blocked = runNode(syncOf(dir), ['--root', dir], dir)
    assert.equal(blocked.rc, 2, `并发写手必须 exit 2:\n${blocked.out}`)
    assert.match(blocked.out, /另一个写手/)
    assert.match(blocked.out, new RegExp(`持锁进程 pid=${process.pid}`), '必须打印持锁方 pid')
    assert.equal(readmeOf(dir), original, '被拒的写手不得留下任何字节')
    unlinkSync(lockPath)

    // B4 崩溃残留的死锁可自愈(pid 不存在),不许永久堵死提交链
    writeFileSync(lockPath, JSON.stringify({ pid: 4194303, at: 'stale' }), 'utf8')
    const healed = runNode(syncOf(dir), ['--root', dir], dir)
    assert.equal(healed.rc, 0, `死锁残留必须能自愈:\n${healed.out}`)

    // B5 门不得静默写块(判据只读)
    const beforeGate = readmeOf(dir)
    runNode(gateOf(dir), ['--staged', '--strict'], dir)
    assert.equal(readmeOf(dir), beforeGate, '门 173 不许写盘')
  } finally {
    dropFixture(dir)
  }
})

test('C 写期间被外部改动 ⇒ 判未判定、打印双方读数、不写盘(不做后写者赢)', async () => {
  const dir = fixtureDir('docnum-writer-concurrent')
  makeRepo(dir)
  const writer = spawn(
    process.execPath,
    [
      '-e',
      "const fs=require('fs');let i=0;setInterval(()=>{try{fs.appendFileSync('README.md','\\n<!-- ext-writer '+(++i)+' -->\\n')}catch{}},15)",
    ],
    { cwd: dir, stdio: 'ignore' },
  )
  try {
    await sleep(150) // 让外部写手先动起来
    const r = runNode(syncOf(dir), ['--root', dir], dir)
    assert.equal(r.rc, 3, `并发写必须判未判定而不是覆盖:\n${r.out}`)
    assert.match(r.out, /未判定/)
    assert.match(r.out, /写手读数/)
    assert.match(r.out, /现场读数/)
    assert.match(r.out, /UNDETERMINED:README\.md/)
  } finally {
    writer.kill()
    await sleep(50)
  }
  try {
    assert.match(readmeOf(dir), /ext-writer/, '外部写手写下的那份才是现场,本器不得覆盖')
  } finally {
    dropFixture(dir)
  }
})

test('D 两段判定不再互斥:写手落盘并提交后,HEAD 段与 staged 段 rc / 违规条数逐项相等', () => {
  const dir = fixtureDir('docnum-writer-two-segments')
  try {
    makeRepo(dir)
    const synced = runNode(syncOf(dir), ['--root', dir], dir)
    assert.equal(synced.rc, 0, synced.out)
    // 索引 == HEAD:提交后两段判的是同一份内容
    git(dir, ['commit', '-q', '-m', 'sync block'])

    const head = runNode(gateOf(dir), ['--strict'], dir)
    const staged = runNode(gateOf(dir), ['--staged', '--strict'], dir)
    assert.equal(
      head.rc,
      staged.rc,
      `两段 rc 互斥:HEAD=${head.rc} / staged=${staged.rc}\n--- HEAD ---\n${head.out}\n--- STAGED ---\n${staged.out}`,
    )
    const pick = (out) => (out.match(/违规\s*(\d+)/) ?? [])[1] ?? null
    assert.equal(
      pick(head.out),
      pick(staged.out),
      `两段违规条数互斥:\n--- HEAD ---\n${head.out}\n--- STAGED ---\n${staged.out}`,
    )
    // 生成块里的 trackedFiles 必须等于索引清单数(写手与判据同面)
    assert.equal(
      trackedInBlock(readmeOf(dir)),
      git(dir, ['ls-files', '--cached']).split('\n').filter(Boolean).length,
      '生成块 trackedFiles 必须与索引清单同数',
    )
    // 提交后再跑一次必须幂等(否则提交后又有进程改写 ⇒ 就是旧病复发)
    const again = runNode(syncOf(dir), ['--root', dir], dir)
    assert.equal(again.rc, 0, again.out)
    assert.match(again.out, /数字无变化/)
    assert.deepEqual(stagedPaths(dir), [], '提交后重跑不得产生新的 staged 差异')
  } finally {
    dropFixture(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
