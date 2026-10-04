// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:scripts/check-migration-immutable.mjs(G-815952,已入库迁移正文不可就地改写)
 *
 * 与源脚本的关系:本文件 `import { __test__ }`(§22d isDirectRun 保证 import 无副作用),
 * **不复制判据实现** —— 两份真相是本仓登记在案的漂移源。
 *
 * 覆盖面:
 *   T1  接线一致性(本枚刻意未接提交链:头注自称未接线 ∧ runner 里确实没有它)
 *   T2  取材面形状锁(内容必须走 face-reader 的 catBatch;剥水印只许一份实现)
 *   T3  真仓逐字文本喂归一化(§22c:镜像至少一条输入逐字取自真仓)
 *   T4  阳性对照**钉出处不钉 HEAD**:把"首次入库那次提交"与"就地改写那次提交"的两个 blob
 *       按显式 SHA 从对象库现取喂同一判据 ⇒ 必红;同一 SHA 自比 ⇒ 必绿
 *   T5  真仓 HEAD 面端到端:看不见存量不算通过(默认只报数,--strict 判红)
 *   T6  临时仓正反成对(票面验收):正文加一行注释 ⇒ 必红;只改水印/空白 ⇒ 必绿
 *   T7  临时仓 --staged 双向锁:改已入库正文 ⇒ rc 1 点名;改尚未入库的新迁移 ⇒ rc 0
 *   T8  判死三态:无提交 / journal 空 entries / 面旗矛盾 / --root 没跟目录,都是 exit 2
 *   T9  decide 退出码三态(未判定 / IM2 / 存量各归各位,不得互相顶账)
 *   T10 本门未被串进 check:all 时不得谎称已串
 */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-migration-immutable.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-migration-immutable.mjs')

const runGate = (args, cwd = ROOT) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
    cwd,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** 票面钉的两枚出处 ref:首次入库 / 就地改写。它们住在对象库里,不依赖工作树。 */
const REF_FIRST = '0f94717464'
const REF_REWRITE = '215d4c1e10'
const REWRITTEN_SQL = `${gate.MIG_DIR}/20260927100000_tenant_rls_policies_batch1.sql`

/** 在临时仓里造一份最小迁移布局并可选提交。 */
function makeFixtureRepo(dir, { tags = ['0000_fixture'], body = 'CREATE TABLE fixture (id int);\n', commit = true } = {}) {
  const git = (args) =>
    spawnSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  assert.equal(git(['init', '-q']).status, 0)
  assert.equal(git(['config', 'user.email', 'gate@example.invalid']).status, 0)
  assert.equal(git(['config', 'user.name', 'gate']).status, 0)
  const migDir = join(dir, ...gate.MIG_DIR.split('/'))
  mkdirSync(join(migDir, 'meta'), { recursive: true })
  const sqlRel = `${gate.MIG_DIR}/${tags[0]}.sql`
  writeFileSync(join(dir, ...sqlRel.split('/')), body)
  writeFileSync(
    join(dir, gate.JOURNAL_REL),
    JSON.stringify({
      version: '7',
      dialect: 'postgresql',
      entries: tags.map((tag, i) => ({ idx: i + 1, tag, when: 1700000000000 + i })),
    }) + '\n',
  )
  if (commit) {
    assert.equal(git(['add', '-A']).status, 0)
    assert.equal(git(['commit', '-qm', 'land v1']).status, 0)
  }
  return { git, sqlRel, journalAbs: join(dir, gate.JOURNAL_REL) }
}

test('T1 接线一致性:本枚刻意未接提交链 ⇒ 头注自称未接线,且 runner 里确实没有它', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  // 注册面读 HEAD(磁盘那份常年滞后,拿它当"已接线"会把刚落的注册读成没有)
  const runner = catBatch(ROOT, ['HEAD:scripts/guardian-runner.mjs']).get(
    'HEAD:scripts/guardian-runner.mjs',
  )
  assert.ok(runner, '取不到 HEAD 面的 guardian-runner ⇒ 本条必须红,不得当成"没接线"放过')
  const wired = runner.includes('check-migration-immutable')
  const claimsWired = /已接\s*pre-commit|已接线|第\s*\d+\s*项/.test(src)
  if (wired) {
    assert.ok(
      claimsWired,
      'runner 里已有本门注册条目,而头注仍自称"未接线" ⇒ 文档与提交链分叉,必须同批改',
    )
  } else {
    assert.ok(!claimsWired, '尚未接进 runner 却自称已接线 = 给后人一个跑不通的出路(AGENTS 禁令)')
    assert.match(src, /刻意没接提交链|刻意未接提交链/, '头注必须写明"本枚未接提交链"')
    assert.match(src, /HUSKY_SKIP_MIGRATION_IMMUTABLE/, '头注必须给出建议的应急变量名')
    assert.match(src, /stagedTriggers=packages\/database/, '头注必须给出建议的 stagedTriggers')
  }
})

test('T2 取材面形状锁:内容走 face-reader,剥水印只许一份实现', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '必须引 face-reader(守门 118 判这一格)')
  assert.match(src, /catBatch\(/, '内容必须经 catBatch 批量取')
  assert.doesNotMatch(src, /execSync\(/, '不得用 execSync 裸拼 git 命令(无 timeout 那一型)')
  assert.doesNotMatch(
    src.replace(/^.*gitRaw.*$/gm, ''),
    /'git'\s*,/,
    '除共用层外不得再裸写 git 二进制名(服务账户 PATH 与交互终端不通)',
  )
  assert.match(src, /stripWatermarkStructure/, '剥水印必须用 lib/watermark-lines.mjs 那一份实现')
  assert.ok(!/BANNER_TEXT_RE\s*=\s*\//.test(src), '本门内不得再抄一份横幅正则(两处实现必漂移)')
})

test('T3 真仓逐字文本:HEAD 面一条真迁移喂归一化,水印行被剔掉、SQL 行一行不改', () => {
  const real = catBatch(ROOT, [`HEAD:${REWRITTEN_SQL}`]).get(`HEAD:${REWRITTEN_SQL}`)
  assert.ok(real && real.length > 100, '取不到真仓迁移正文 ⇒ 本条必须红,不得当成已判')
  const n = gate.normalizeMigrationBody(real)
  assert.ok(n.removed >= 1, `真仓 .sql 的水印结构行必须被剔掉(实得 removed=${n.removed})`)
  const sqlLine = n.lines.find((l) => /CREATE|INSERT|POLICY/i.test(l))
  assert.ok(sqlLine, '归一后应仍留有 SQL 行')
  assert.ok(real.includes(sqlLine), '归一化不得改动 SQL 行的字面内容')
  // 票面两条正反成对,在真仓文本上复现
  assert.equal(gate.judgePair({ faceText: real, baseText: real }).red, false)
  assert.equal(gate.judgePair({ faceText: real + '-- 事后补的说明\n', baseText: real }).red, true)
  assert.equal(
    gate.judgePair({ faceText: real.replace(/\n/g, '\r\n') + '\n\n', baseText: real }).red,
    false,
    '只改行尾/CRLF/空行不得红',
  )
})

test('T4 阳性对照钉出处:首次入库 blob vs 就地改写 blob ⇒ 必红;同 SHA 自比 ⇒ 必绿', () => {
  const specs = [`${REF_FIRST}:${REWRITTEN_SQL}`, `${REF_REWRITE}:${REWRITTEN_SQL}`]
  const got = catBatch(ROOT, specs)
  const a = got.get(specs[0])
  const b = got.get(specs[1])
  const missing = (sha) =>
    `出处 ref ${sha} 的 blob 取不到 ⇒ 对象库被改写过,这条阳性对照必须重建,不得把断言改绿`
  assert.ok(a !== null && a !== undefined, missing(REF_FIRST))
  assert.ok(b !== null && b !== undefined, missing(REF_REWRITE))
  const diff = gate.judgePair({ faceText: b, baseText: a })
  assert.equal(diff.red, true, '把修复前的两枚出处 blob 喂同一判据必须命中(判据有牙的证明)')
  assert.ok(diff.firstDiffLine > 0, '必须点名第一条不等行')
  assert.equal(gate.judgePair({ faceText: a, baseText: a }).red, false, '同一份正文自比必须放过')
})

test('T5 真仓 HEAD 面端到端:看不见存量不算通过(默认只报数,--strict 判红)', () => {
  const plain = runGate([])
  assert.equal(
    plain.status,
    0,
    `全量档默认不得因存量判红,stdout=${plain.stdout} stderr=${plain.stderr}`,
  )
  assert.match(plain.stderr, /IM1 检出 \d+ 条/, '存量红必须被点名(只报数不等于不报)')
  assert.match(plain.stdout, /\[判定面=head\][\s\S]*可比对 30\d/)

  const strict = runGate(['--strict'])
  assert.equal(strict.status, 1, `--strict 下有存量不等必须判红,stdout=${strict.stdout}`)

  const json = runGate(['--json'])
  const parsed = JSON.parse(json.stdout)
  assert.equal(parsed.face, 'head')
  assert.equal(parsed.exit, 0)
  assert.ok(parsed.counts.compared > 300, `可比对候选须覆盖 journal 全部 tag,实得 ${parsed.counts.compared}`)
  assert.equal(parsed.counts.undetermined, 0, '真仓 HEAD 面不该有未判定;有就是判据失明')
  for (const r of parsed.stockReds) assert.match(r.base, /^[0-9a-f]{40}$/, '基线必须点名到具体提交')
})

test('T6 临时仓正反成对:正文加一行注释 ⇒ IM1 必红;只改水印/空白 ⇒ 必绿', () => {
  const dir = mkScratch('g815952-immutable-')
  try {
    const { git, sqlRel } = makeFixtureRepo(dir, { body: gate.SQL_WATERMARK_HEAD + 'CREATE TABLE fixture (id int);\n' })

    // A) 只改水印/空白(重注入形态 + 空行 + 行尾空格)⇒ IM1 必须绿
    writeFileSync(join(dir, ...sqlRel.split('/')), gate.SQL_WATERMARK_HEAD.replace('2026', '2027') + 'CREATE TABLE fixture (id int);\n\n   \n')
    assert.equal(git(['add', '-A']).status, 0)
    assert.equal(git(['commit', '-qm', 'watermark re-inject']).status, 0)
    const a = runGate(['--root', dir, '--json'])
    const pa = JSON.parse(a.stdout)
    assert.equal(a.status, 0, `A 臂只改水印/空白必须 rc 0,stderr=${a.stderr}`)
    assert.equal(pa.counts.stockReds, 0, 'A 臂不得判红(票面:只改水印/空白 ⇒ 必绿)')

    // B) 正文加一行注释 ⇒ IM1 必红(默认档只报数 ⇒ rc 0 但点名;--strict ⇒ rc 1)
    writeFileSync(join(dir, ...sqlRel.split('/')), 'CREATE TABLE fixture (id int);\n-- 事后补的说明\n')
    assert.equal(git(['add', '-A']).status, 0)
    assert.equal(git(['commit', '-qm', 'rewrite in place']).status, 0)
    const b = runGate(['--root', dir, '--json'])
    const pb = JSON.parse(b.stdout)
    assert.equal(pb.counts.stockReds, 1, `B 臂必须命中 1 条存量不等,stderr=${b.stderr}`)
    assert.equal(pb.stockReds[0].file, sqlRel)
    assert.equal(b.status, 0, 'B 臂默认档只报数(防恒红门)')
    const bs = runGate(['--root', dir, '--strict'])
    assert.equal(bs.status, 1, `--strict 必须把 B 臂的存量判红,stdout=${bs.stdout}`)
    assert.match(bs.stderr, /IM1 检出 1 条/)
  } finally {
    rmScratch(dir)
  }
})

test('T7 临时仓 --staged 双向锁:改已入库正文 ⇒ rc 1 点名;改尚未入库的新迁移 ⇒ rc 0', () => {
  const dir = mkScratch('g815952-staged-')
  try {
    const { git, sqlRel, journalAbs } = makeFixtureRepo(dir)

    // A) 索引里给已入库的迁移加一行注释 ⇒ IM2 判红并点名
    writeFileSync(join(dir, ...sqlRel.split('/')), 'CREATE TABLE fixture (id int);\n-- 顺手改一句\n')
    assert.equal(git(['add', '-A']).status, 0)
    const red = runGate(['--root', dir, '--staged'])
    assert.equal(red.status, 1, `改已入库正文必须 rc 1,stdout=${red.stdout} stderr=${red.stderr}`)
    assert.match(red.stderr, /IM2 检出 1 条/)
    assert.ok(red.stderr.includes(sqlRel), '红必须点名被改的迁移文件')

    // B) 索引恢复成 HEAD 内容 ⇒ 无 IM2 ⇒ rc 0(反向对照:拦的是"改动",不是"这条迁移存在")
    writeFileSync(join(dir, ...sqlRel.split('/')), 'CREATE TABLE fixture (id int);\n')
    assert.equal(git(['add', '-A']).status, 0)
    assert.equal(runGate(['--root', dir, '--staged']).status, 0)

    // C) 新增一条尚未入库的迁移 + journal 条目 ⇒ 不可变性还不适用 ⇒ rc 0 且点名
    const newRel = `${gate.MIG_DIR}/0001_new.sql`
    writeFileSync(join(dir, ...newRel.split('/')), 'CREATE TABLE n (id int);\n')
    writeFileSync(
      journalAbs,
      JSON.stringify({
        version: '7',
        dialect: 'postgresql',
        entries: [
          { idx: 1, tag: '0000_fixture', when: 1700000000000 },
          { idx: 2, tag: '0001_new', when: 1700000000001 },
        ],
      }) + '\n',
    )
    assert.equal(git(['add', '-A']).status, 0)
    const c = runGate(['--root', dir, '--staged', '--json'])
    const pc = JSON.parse(c.stdout)
    assert.equal(c.status, 0, `新增未入库迁移不该拦,stderr=${c.stderr}`)
    assert.deepEqual(pc.notLanded, [newRel], '新增迁移必须进 notLanded 并报出,不得静默')
    assert.equal(pc.counts.commitReds, 0)
  } finally {
    rmScratch(dir)
  }
})

test('T8 判死三态:无提交 / journal 空 entries / 面旗矛盾 / --root 没跟目录,都是 exit 2', () => {
  const dir1 = mkScratch('g815952-nocommit-')
  try {
    // A) 仓里一次提交都没有 ⇒ 面取不到 ⇒ exit 2(不得读成"没有迁移所以通过")
    const fx = makeFixtureRepo(dir1, { commit: false })
    const noCommit = runGate(['--root', dir1])
    assert.equal(
      noCommit.status,
      2,
      `无提交必须判"无法判定",stdout=${noCommit.stdout} stderr=${noCommit.stderr}`,
    )
    void fx
  } finally {
    rmScratch(dir1)
  }

  const dir2 = mkScratch('g815952-empty-')
  try {
    const { git } = makeFixtureRepo(dir2)
    void git
    // B) journal entries 为 0 ⇒ 空扫判死
    writeFileSync(join(dir2, gate.JOURNAL_REL), '{"version":"7","dialect":"postgresql","entries":[]}\n')
    spawnSync('git', ['-C', dir2, 'add', '-A'], {
      windowsHide: true,
      timeout: 60000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    spawnSync('git', ['-C', dir2, 'commit', '-qm', 'empty journal'], {
      windowsHide: true,
      timeout: 60000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const emptyJournal = runGate(['--root', dir2])
    assert.equal(emptyJournal.status, 2, `0 个候选必须判死,stdout=${emptyJournal.stdout}`)
    assert.match(emptyJournal.stderr, /空扫不记绿/)
    // C) 两面旗同给 ⇒ 判死
    assert.equal(runGate(['--root', dir2, '--staged', '--worktree']).status, 2)
    // D) --root 后面没跟目录 ⇒ 判死(不得悄悄退回真仓,那会把夹具结论换成仓库结论)
    const badRoot = runGate(['--root'])
    assert.equal(badRoot.status, 2)
    assert.match(badRoot.stderr, /--root/)
  } finally {
    rmScratch(dir2)
  }
})

test('T9 decide 三态:未判定 / IM2 / 存量各归各位,不得互相顶账', () => {
  const one = [{ file: 'x' }]
  const none = []
  assert.equal(
    gate.decide({ commitReds: one, stockReds: one, undetermined: ['u'], mode: 'staged', strict: true }).exit,
    2,
    '未判定优先于判红:结论无效时不得出合格证',
  )
  assert.equal(
    gate.decide({ commitReds: one, stockReds: none, undetermined: none, mode: 'staged', strict: false }).exit,
    1,
  )
  assert.equal(
    gate.decide({ commitReds: none, stockReds: one, undetermined: none, mode: 'head', strict: false }).exit,
    0,
    '存量红在默认档只报数 —— 与本次提交无关的红只会逼人 --no-verify(AGENTS §12e)',
  )
  assert.equal(
    gate.decide({ commitReds: none, stockReds: one, undetermined: none, mode: 'head', strict: true }).exit,
    1,
  )
  assert.equal(
    gate.decide({ commitReds: none, stockReds: none, undetermined: none, mode: 'worktree', strict: false }).exit,
    0,
  )
})

test('T10 未被串进 check:all 时,头注不得声称已串', () => {
  const pkg = catBatch(ROOT, ['HEAD:package.json']).get('HEAD:package.json')
  assert.ok(pkg, '取不到 HEAD 面 package.json ⇒ 本条必须红,不得当成"没接"放过')
  const src = readFileSync(SCRIPT, 'utf8')
  if (!pkg.includes('check-migration-immutable')) {
    assert.doesNotMatch(src, /已串进\s*check:all|pnpm check:migration-immutable/, '不得声称有跑不通的问责入口')
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
