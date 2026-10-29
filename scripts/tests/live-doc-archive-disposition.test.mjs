// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 维五(归档批次维)的镜像测试 —— 票 gb22「活文档被体积清偿压好后又被归并档原样拉回」的接线锁。
 *
 * 立因(2026-10-28 实测):11:40 主席席把 `AGENTS.md` 从 105115 字节压到 95336(守门 207 预算 96000),
 * 被摘的 30 行逐字迁进 `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`;11:51:57 `auto-commit-quiet` 派生
 * `merge-live-doc --file AGENTS.md --apply` 把盘上正文顶回 **102352**,而当时被叫到的复洁器判了个
 * `clean dropped=0` —— 因为既有四维的入口条件全带 `/^\s*- \[[ xX]\]/`,AGENTS.md 的 30 行正文子弹
 * **0/30 命中**。本文件把"这一格不再无人负责"钉成可复跑的夹具:
 *   · 正控:归并确实把迁出行插回来了(否则本测试证明不了任何事);
 *   · 修控:带 `--archive-disposition` 的复洁把插回的迁出行放回原样;
 *   · 正向对照:别人本轮真新增的行(不在任何归档批次里)必须照样留着 —— 否则等于把归并关了;
 *   · 反控:不传旗 ⇒ 行为逐字不变;处置侧文本取不到 / 同族 0 份 / 整篇复制件 ⇒ exit 2 且一个字不动;
 *     登记行形(`- [ ]`/`- [x]`)绝不由本维剔(PROJECT_PLAN 一族语义不动,红线)。
 *
 * §22c:判据全部 import 生产实现(`scrub` / `viaBucket` / `docArg` / `selectMovedOutForDisposition` /
 * `archiveDropCaps`),本文件不复制任何一条正则或阈值。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
// 被测判据的唯一来源 = 生产文件本身(§22c:不得在测试里再抄一份"什么算登记行/什么算复制件")。
import { __test__ as scrubTool } from '../scrub-declared-removals.mjs'
import {
  archiveDropCaps,
  selectMovedOut,
  selectMovedOutForDisposition,
} from '../lib/live-doc-archive-drops.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GIT = 'git'

const KEEP_A = '- 甲:文档里一直在册的一行正文,长度足够避开短行过滤,任何一维都不该碰到它'
const KEEP_B = '- 乙:另一行一直在册的正文,同样够长,用来证明维五不会连坐整篇文档'
const MOVED_1 =
  '- **迁出丙**(1):这一整行在清偿那一刻被逐字搬进 archive 的迁出批次,文档里只留指针注记'
const MOVED_2 = '- **迁出丁**(2):第二行迁出正文,搬走之后原位换成一行短指针,长度也避开短行过滤'
const XCONTROL =
  '- XCONTROL 别人本轮真新增的一行正文:不在任何归档批次里,归并必须照样补回、修后必须照样留着'
const OLD_BATCH_LINE =
  '- 旧批(2026-10-20):上一轮清偿搬走的正文,长度足够,本轮与它无关只证明同族件在位'

/**
 * 造一个三方现场:HEAD = 未压版(含两行迁出正文 + 一行别人真新增),工作树 = 压好版,
 * 迁出批次**只在盘上、不在 HEAD 面**(§1 两步走的在飞窗口,实测 11:40 写 → 11:54 入库)。
 */
function seed({
  withHeadBatch = true,
  batchOnDisk = true,
  snapshotOnly = false,
  noArchiveDir = false,
  bypassLanding = false,
} = {}) {
  const dir = mkScratch('gb22-revive-')
  const g = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  g('init', '-q', '--initial-branch=main')
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyScriptWithClosure(join(REPO, 'scripts'), 'merge-live-doc.mjs', join(dir, 'scripts'))
  copyScriptWithClosure(join(REPO, 'scripts'), 'scrub-declared-removals.mjs', join(dir, 'scripts'))
  const write = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text, 'utf8')
  }
  if (!noArchiveDir) {
    if (snapshotOnly) {
      // 同族件里只有一份"整篇复制件"(它含处置侧大部分正文行)⇒ 不构成移出批次
      write(
        '.ihui-agent/archive/AGENTS_full-pre-compact-夹具.md',
        [KEEP_A, KEEP_B, MOVED_1].join('\n'),
      )
    } else if (withHeadBatch) {
      write('.ihui-agent/archive/AGENTS_trim-夹具旧批.md', OLD_BATCH_LINE)
    }
  }
  write('AGENTS.md', [KEEP_A, KEEP_B, MOVED_1, MOVED_2, XCONTROL].join('\n'))
  write('.gitignore', '.ihui-agent/tmp/\n')
  // bypassLanding(2026-10-29 补):旁路落地现场 —— 消重走对象空间已落 HEAD,HEAD 是压好版,
  // 而工作树仍是那份未消的滞后副本。既有 8 例走的都是 gb22 那一型(HEAD 未压/工作树已压),
  // 这里只在 option 为真时改写落盘面,原路径逐字节不动。
  if (bypassLanding) {
    write(
      'AGENTS.md',
      [KEEP_A, KEEP_B, '> 迁出批次逐字见 `.ihui-agent/archive/AGENTS_trim-夹具批次.md`'].join(
        '\n',
      ) + '\n',
    )
  }
  g('add', '-A')
  g(
    'commit',
    '-qm',
    bypassLanding
      ? 'seed: HEAD = 压好版(旁路落地已入库)'
      : 'seed: HEAD = 未压版(迁出行 + XCONTROL)',
  )
  // 摘除台账夹具:一枚不在任何文档里的登记行 ⇒ "台账非空"前置成立,四维照常跑,红/绿只由维五决定
  write(
    '.ihui-agent/state/stale-claim-strip.jsonl',
    JSON.stringify({ rowBefore: '- [ ] G-99999 夹具占位行:不在任何文档里', kind: 'fixture' }) +
      '\n',
  )
  const compressed =
    [KEEP_A, KEEP_B, '> 迁出批次逐字见 `.ihui-agent/archive/AGENTS_trim-夹具批次.md`'].join('\n') +
    '\n'
  write('AGENTS.md', compressed)
  if (batchOnDisk && !snapshotOnly && !noArchiveDir) {
    write('.ihui-agent/archive/AGENTS_trim-夹具批次.md', [MOVED_1, MOVED_2].join('\n') + '\n')
  }
  write('.ihui-agent/tmp/disposition.txt', compressed)
  if (bypassLanding) {
    // 滞后工作树 = 未压版;收编器交给复洁器的"处置侧快照"正是这份脏副本 ⇒ 单看它 0 份不成立
    const lagging = [KEEP_A, KEEP_B, MOVED_1, MOVED_2, XCONTROL].join('\n') + '\n'
    write('AGENTS.md', lagging)
    write('.ihui-agent/tmp/disposition.txt', lagging)
  }
  const run = (script, args) => {
    try {
      return {
        code: 0,
        out: execFileSync(process.execPath, [join(dir, 'scripts', script), ...args], {
          cwd: dir,
          encoding: 'utf8',
          maxBuffer: 1 << 28,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          timeout: 120000,
        }),
      }
    } catch (e) {
      return { code: e.status ?? 1, out: String(e.stdout || '') + String(e.stderr || '') }
    }
  }
  const doc = () => readFileSync(join(dir, 'AGENTS.md'), 'utf8')
  return { dir, run, doc, write, compressed }
}

test('① 正控:在飞窗口里 merge-live-doc --apply 确实把迁出行原样插回(修前实测同型)', () => {
  const { dir, run, doc, compressed } = seed()
  try {
    assert.equal(doc(), compressed, '起点=压好版')
    const m = run('merge-live-doc.mjs', ['--file', 'AGENTS.md', '--apply'])
    assert.equal(m.code, 0, `归并退出码 ${m.code}\n${m.out}`)
    const after = doc()
    assert.ok(
      after.includes(MOVED_1) && after.includes(MOVED_2),
      '正控失效:迁出行没被插回,本夹具证明不了任何事',
    )
    assert.ok(after.includes(XCONTROL), '别人真新增的行必须照样补回')
    assert.ok(after.length > compressed.length, '插回后必须变长')
    // 备份件 = 归并那一刻的盘上正文(2026-10-28 现场的 `.ihui-agent/tmp/AGENTS.md.<stamp>.pre-merge.bak`)
    const baks = readdirSync(join(dir, '.ihui-agent/tmp')).filter((f) =>
      f.endsWith('.pre-merge.bak'),
    )
    assert.equal(baks.length, 1, `应恰有一枚归并备份件,实得 ${baks.length}`)
    assert.equal(
      readFileSync(join(dir, '.ihui-agent/tmp', baks[0]), 'utf8'),
      compressed,
      '备份件必须逐字节等于压好版 —— 复洁的处置侧基准就是这一份',
    )
  } finally {
    rmScratch(dir)
  }
})

test('② 修控:带 --archive-disposition 的复洁把插回的迁出行放回原样,正向对照仍保留', () => {
  const { dir, run, doc } = seed()
  try {
    run('merge-live-doc.mjs', ['--file', 'AGENTS.md', '--apply'])
    const s = run('scrub-declared-removals.mjs', [
      'AGENTS.md',
      '--archive-disposition',
      '.ihui-agent/tmp/disposition.txt',
    ])
    const line = (s.out.match(/SCRUB-RESULT.*/) || [''])[0]
    assert.match(line, /state=dropped/)
    assert.match(line, /archive=2/, `维五应恰剔 2 行,实得:\n${s.out}`)
    assert.match(line, /verbatim=0 body=0/, '既有四维的桶不得被本维喂数')
    const after = doc()
    assert.ok(
      !after.includes(MOVED_1) && !after.includes(MOVED_2),
      '迁出行必须回到"已被处置"的形态',
    )
    assert.ok(after.includes(KEEP_A) && after.includes(KEEP_B), '在册正文一行不许少')
    assert.ok(
      after.includes(XCONTROL),
      '正向对照:别人本轮真新增的行必须照样留着(否则等于把归并关了)',
    )
    const again = run('scrub-declared-removals.mjs', [
      'AGENTS.md',
      '--archive-disposition',
      '.ihui-agent/tmp/disposition.txt',
    ])
    assert.match(again.out, /state=clean dropped=0/, '幂等:同一把尺子复判不得再剔')
    assert.ok(doc().includes(XCONTROL), '第二轮也不许吃掉正向对照')
  } finally {
    rmScratch(dir)
  }
})

test('③ 反控:不传旗 ⇒ 既有四维行为逐字不变(实测现场那句 clean dropped=0)', () => {
  const { dir, run, doc } = seed()
  try {
    run('merge-live-doc.mjs', ['--file', 'AGENTS.md', '--apply'])
    const s = run('scrub-declared-removals.mjs', ['AGENTS.md'])
    assert.match(s.out, /state=clean dropped=0/)
    assert.match(
      s.out.split('\n')[0],
      /archive=0 caps=0 archiveRequested=0/,
      '未启用本维时读数必须显式声明"没请求过"(不得留一个空档让人误读成"归档维判过了")',
    )
    const after = doc()
    assert.ok(
      after.includes(MOVED_1) && after.includes(MOVED_2),
      '不传旗时迁出行照旧留着 —— 这就是 2026-10-28 现场',
    )
  } finally {
    rmScratch(dir)
  }
})

test('④ 失效方向:处置侧文本取不到 ⇒ exit 2 未判定,文档一个字都不动', () => {
  const { dir, run, doc } = seed()
  try {
    run('merge-live-doc.mjs', ['--file', 'AGENTS.md', '--apply'])
    const before = doc()
    const s = run('scrub-declared-removals.mjs', [
      'AGENTS.md',
      '--archive-disposition',
      '.ihui-agent/tmp/没有这个文件.txt',
    ])
    assert.equal(s.code, 2, `应落未判定,实得 ${s.code}\n${s.out}`)
    assert.match(s.out, /state=undetermined.*处置侧文本/s)
    assert.equal(doc(), before, '未判定不得动文档(失效方向恒为多留一份)')
  } finally {
    rmScratch(dir)
  }
})

test('⑤ 失效方向:同族归档件 0 份 ⇒ 凭据未取得,exit 2 且不动文档', () => {
  const { dir, run, doc } = seed({ batchOnDisk: false, withHeadBatch: false, noArchiveDir: true })
  try {
    run('merge-live-doc.mjs', ['--file', 'AGENTS.md', '--apply'])
    const before = doc()
    const s = run('scrub-declared-removals.mjs', [
      'AGENTS.md',
      '--archive-disposition',
      '.ihui-agent/tmp/disposition.txt',
    ])
    assert.equal(s.code, 2)
    assert.match(s.out, /state=undetermined.*凭据未取得/s)
    assert.equal(doc(), before, '取不到凭据时一条不扣')
  } finally {
    rmScratch(dir)
  }
})

test('⑥ 失效方向:同族件是整篇复制件 ⇒ 不作移出批次凭据(不得把"改稿"洗成"已归档")', () => {
  const { dir, run, doc } = seed({ snapshotOnly: true })
  try {
    run('merge-live-doc.mjs', ['--file', 'AGENTS.md', '--apply'])
    const s = run('scrub-declared-removals.mjs', [
      'AGENTS.md',
      '--archive-disposition',
      '.ihui-agent/tmp/disposition.txt',
    ])
    assert.equal(s.code, 2, `复制件不得当凭据用,实得 rc=${s.code}\n${s.out}`)
    assert.match(s.out, /整篇复制件|凭据未取得/)
    assert.ok(doc().includes(MOVED_1), '复制件档不构成凭据 ⇒ 迁出行留着交人工,绝不静默吞')
  } finally {
    rmScratch(dir)
  }
})

test('⑦ 红线:登记行形(`- [ ]`/`- [x]`)绝不由维五剔;四维口径一字不动', () => {
  const ledgerRow = '- [ ]（进行中@2026-10-18/甲） G-900 已摘除的登记行'
  const head = '- [ ] G-901 在册行'
  // 把登记行硬塞进 caps(生产 CLI 不会这样构造,这里专测本维的边界)
  const r = scrubTool.scrub(`${head}\n${ledgerRow}`, head, new Set(), new Set([ledgerRow]))
  assert.equal(r.dropped.length, 0, '登记行必须留给台账一族,本维不越界')
  const p = scrubTool.scrub(`${head}\n${ledgerRow}`, head, new Set([ledgerRow]))
  assert.equal(p.dropped.length, 1, '台账维一对登记行的口径不得因本次改动而变化')
  assert.equal(p.via.get(ledgerRow), 'verbatim')
  // 参数解析回归锁:`--archive-disposition` 不在位时,`indexOf` 返回 -1,把下标 0 的文档名一起排除
  // 过一次 —— 症状是整器走"用法错误"分支只 console.error,stdout 空,红语却报"没打印 HEAD 面"。
  assert.equal(
    scrubTool.docArg(['PROJECT_PLAN.md', '--dry-run']),
    'PROJECT_PLAN.md',
    '无该旗标时下标 0 必须是文档名',
  )
  assert.equal(
    scrubTool.docArg(['AGENTS.md', '--archive-disposition', 'x/y.txt']),
    'AGENTS.md',
    '旗标的值不得被当成文档名',
  )
  assert.equal(scrubTool.docArg(['--dry-run', 'README.md']), 'README.md')
  assert.equal(scrubTool.viaBucket('archive'), 'archive', '维五自成一桶')
  assert.equal(scrubTool.viaBucket('title'), 'verbatim', '既有桶归属不得因维五而变')
})

test('⑧ 同族表由 lib 单源决定:PROJECT_PLAN_* 里的行不构成 AGENTS 迁出行的凭据', () => {
  const caps = archiveDropCaps(
    KEEP_A,
    selectMovedOut(
      'AGENTS.md',
      [
        {
          path: '.ihui-agent/archive/PROJECT_PLAN_2026-09-28.md',
          text: [MOVED_1, MOVED_2].join('\n'),
        },
      ],
      KEEP_A,
    ),
  )
  assert.equal(caps.size, 0, '异族归档件不得进凭据集(判据 = lib 那一份 archiveOwnerFor)')
})

test('⑨ 接线锁:auto-commit-quiet 必须传处置侧快照并读 archive= 让路,且不得把该旗传给 PROJECT_PLAN', () => {
  const src = readFileSync(join(REPO, 'scripts', 'auto-commit-quiet.mjs'), 'utf8')
  // 用**逐字子串**断言,不用正则:本文件曾经用 `\(\\d+\)` 去匹配源码里的 `(\d+)`,量词 `+` 是字面量、
  // 正则里没有对应 token ⇒ 判据明明在位也报"不在位"(假红会逼后人去改生产代码,比漏锁更坏)。
  const has = (needle, msg) => assert.ok(src.includes(needle), `${msg} —— 未找到逐字片段:${needle}`)
  has('function writeDispositionSnapshot(', '处置侧快照落盘出口必须在位')
  has("file.endsWith('PROJECT_PLAN.md')) return null", 'PROJECT_PLAN 一族不得启用本维(红线)')
  has('const dispRel = writeDispositionSnapshot(f, snap)', '快照必须取在归并**之前**那一刻')
  has("...(dispRel ? ['--archive-disposition', dispRel] : []),", '复洁必须拿到处置侧快照')
  has('const ar = /archive=(\\d+)/', '必须现读复洁器回带的 archive= 读数')
  has('活文档让路(${f})', 'archive>0 必须让路,不得当成绿灯收编')
  const lib = readFileSync(join(REPO, 'scripts', 'lib', 'live-doc-archive-drops.mjs'), 'utf8')
  assert.match(
    lib,
    /export function selectMovedOutForDisposition\(/,
    '处置侧取材出口必须在 lib(§0.6 单源)',
  )
  assert.match(
    lib,
    /return selectMovedOut\(docRel, \[\.\.\.byPath\.values\(\)\], dispositionText\)/,
    '取材必须复用同一份判据,不得新写一份',
  )
  const scr = readFileSync(join(REPO, 'scripts', 'scrub-declared-removals.mjs'), 'utf8')
  assert.match(
    scr,
    /import \{ archiveDropCaps, selectMovedOutForDisposition \} from '\.\/lib\/live-doc-archive-drops\.mjs'/,
    '复洁器只 import,不开第二本账(§0.6)',
  )
  // 维五排在 `head.has(l)` 短路之前 —— 事故当时 HEAD 面就是那份未压版,排在后面结构上永远走不到
  const beforeHeadShortCircuit = scr.indexOf('if (caps.size > 0 && caps.has(l) && !isLedgerRow(l))')
  const headShort = scr.indexOf('if (head.has(l)) {')
  assert.ok(
    beforeHeadShortCircuit > 0 && headShort > 0 && beforeHeadShortCircuit < headShort,
    '维五必须在 HEAD 短路之前',
  )
})

test('⑩ 纯函数面:caps 只在"逐字命中 ∧ 处置侧 0 份 ∧ 非登记行"三条同时成立时才剔', () => {
  const root = mkScratch('gb22-unit-')
  try {
    mkdirSync(join(root, '.ihui-agent/archive'), { recursive: true })
    // 三份里只有一行仍活在本侧 ⇒ overlap=1/3 < SNAPSHOT_OVERLAP,才落在"移出批次"而非"整篇复制件"
    writeFileSync(
      join(root, '.ihui-agent/archive/AGENTS_trim-单元.md'),
      [MOVED_1, MOVED_2, KEEP_A].join('\n'),
      'utf8',
    )
    const disposition = `${KEEP_A}\n${KEEP_B}`
    const moved = selectMovedOutForDisposition(root, 'AGENTS.md', [], disposition)
    assert.equal(moved.ok, true, '同族批次应被受理')
    assert.ok(
      moved.used.some((u) => /AGENTS_trim-单元\.md$/.test(u.path)),
      '磁盘面必须进取材清单(在飞窗口的凭据恰恰只在盘上、不在任何提交面)',
    )
    const caps = archiveDropCaps(disposition, moved)
    assert.ok(caps.has(MOVED_1), '迁出行应在可扣集里')
    assert.ok(!caps.has(KEEP_A), '处置侧仍持有的一行不扣(扣了就是丢本侧自己的行)')
    // 反向对照:处置侧文本取不到(空)⇒ 一条不扣(§0.3 不猜)
    assert.equal(archiveDropCaps('', moved).size, 0, '空处置侧文本不得让整份归档都算处置过')
    // 反向对照:磁盘目录不在位 ⇒ 只用调用方那一面,不否掉它
    const noDisk = selectMovedOutForDisposition(
      join(root, '没有这个目录'),
      'AGENTS.md',
      [{ path: '.ihui-agent/archive/AGENTS_trim-单元.md', text: MOVED_2 }],
      disposition,
    )
    assert.equal(noDisk.ok, true, '面里那一份仍须成立(磁盘缺失不得把凭据整轮清零)')
    assert.ok(archiveDropCaps(disposition, noDisk).has(MOVED_2))
  } finally {
    rmScratch(root)
  }
})

test('⑪ 旁路落地型:HEAD 已消而工作树滞后 ⇒ 迁出行照样被剔,而 HEAD 0 份的普通新增行一行不许动(2026-10-29 补)', () => {
  const { dir, run, doc } = seed({ bypassLanding: true })
  try {
    const head = execFileSync(
      GIT,
      ['-c', 'safe.directory=*', '-C', dir, 'show', 'HEAD:AGENTS.md'],
      {
        encoding: 'utf8',
        maxBuffer: 1 << 28,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    assert.ok(
      !head.includes(MOVED_1) && !head.includes(MOVED_2),
      '夹具前提:HEAD 面必须已无迁出行(消重已由旁路落地入库)',
    )
    const before = doc()
    assert.ok(
      before.includes(MOVED_1) && before.includes(MOVED_2),
      '夹具前提:滞后工作树必须逐字含着那两行(否则本例没有现场)',
    )
    // 处置侧快照就是那份脏副本 ⇒ gb22 原判据的"处置侧 0 份"结构上不成立,本例测的正是并入 HEAD 那一格
    const s = run('scrub-declared-removals.mjs', [
      'AGENTS.md',
      '--archive-disposition',
      '.ihui-agent/tmp/disposition.txt',
    ])
    const line = (s.out.match(/SCRUB-RESULT.*/) || [''])[0]
    assert.match(line, /state=dropped/, '旁路落地现场必须判成 dropped,实得:' + s.out)
    assert.match(line, /archive=2/, '维五应恰剔 2 行,实得:' + s.out)
    assert.match(line, /verbatim=0 body=0/, '既有四维的桶不得被本维喂数')
    const after = doc()
    assert.ok(
      !after.includes(MOVED_1) && !after.includes(MOVED_2),
      'HEAD 已消的两行不得再从滞后副本收编回去',
    )
    assert.ok(after.includes(KEEP_A) && after.includes(KEEP_B), '在册正文一行不许少')
    // 反控:这一条钉死"并入 HEAD"没有把本维变成毁行器 —— XCONTROL 同样不在 HEAD 面,
    // 但它不在任何归档批次里(别人真新增的工作),所以必须照样留着。
    assert.ok(after.includes(XCONTROL), '反控:HEAD 0 份但不在归档批次里的行绝不得被剔')
    const again = run('scrub-declared-removals.mjs', [
      'AGENTS.md',
      '--archive-disposition',
      '.ihui-agent/tmp/disposition.txt',
    ])
    assert.match(again.out, /state=clean dropped=0/, '幂等:同一把尺子复判不得再剔')
    assert.ok(again.out.includes(XCONTROL) || doc().includes(XCONTROL), '第二轮也不许吃掉正向对照')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
