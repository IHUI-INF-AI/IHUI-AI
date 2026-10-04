// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/lib/plan-id-face.mjs`(计划编号占用面)。
 *
 * 与本仓其余镜像测试同取向 —— **不重抄判据**:面"宽到什么程度"由被检模块自己的纯函数与
 * `usedIdsOfPrefix` 那一份判据给,本文件只做四件事:
 *  T1 装车证明(两个取号出口必须真的吃到这份共享实现 —— 判据在而无人调用 = 没有,守门 70/76/81 同型)
 *  T2 构造面端到端(临时 git 仓:号在被搬走的那一侧 ⇒ 宽面必须看见;这是本票全部意义)
 *  T3 真仓覆盖面自证(吃到的份数必须等于该面上真实份数,漏一份就红)
 *  T4/T5 形状锁(不读磁盘、同面同轮、CLI stdout 契约、`--json` 不得吐 15 MB 正文)
 *  T6 跑一次被检模块自己的 `--self-test`(自检不跑 = 它随时可以悄悄坏掉)
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../lib/plan-id-face.mjs'
import { git } from '../lib/bypass-git.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const LIB = join(REPO, 'scripts', 'lib', 'plan-id-face.mjs')
const LIB_SRC = readFileSync(LIB, 'utf8')
const norm = (s) => s.replace(/\r\n/g, '\n')

const {
  collectIdFace,
  pickArchivePaths,
  isArchivePath,
  joinFace,
  familyMaxOn,
  resolveSource,
  LEDGER_DOC,
  ARCHIVE_DIR,
} = __test__

/** 独立算一份"该面上真实的台账归档件清单"(故意不用被检模块的筛法 —— 它需要另一个证人)。 */
function oracleArchiveList(root, source) {
  const z = git(['ls-tree', '-r', '--name-only', '-z', source, '--', ARCHIVE_DIR], {
    root,
    raw: true,
    timeout: 60_000,
  })
  return String(z)
    .split('\0')
    .map((s) => s.trim())
    .filter((s) => {
      const p = s.replace(/\\/g, '/')
      if (!p.startsWith(`${ARCHIVE_DIR}/`)) return false
      const rest = p.slice(ARCHIVE_DIR.length + 1)
      return !rest.includes('/') && /^PROJECT_PLAN.*\.md$/.test(rest)
    })
    .sort()
}

test('T1 装车证明:两个取号出口必须真的 import 并调用这份共享实现', () => {
  const nextSrc = norm(readFileSync(join(REPO, 'scripts', 'next-plan-id.mjs'), 'utf8'))
  const ldeSrc = norm(readFileSync(join(REPO, 'scripts', 'live-doc-edit.mjs'), 'utf8'))
  assert.match(nextSrc, /from '\.\/lib\/plan-id-face\.mjs'/, 'next-plan-id 没引这份面')
  assert.match(nextSrc, /collectIdFace\(\{/, 'next-plan-id 引了却不调用(判据在而无人调 = 没有)')
  assert.match(ldeSrc, /from '\.\/lib\/plan-id-face\.mjs'/, 'live-doc-edit 没引这份面')
  assert.match(ldeSrc, /collectIdFace\(\{/, 'live-doc-edit 引了却不调用')
  // 出口一:老的那条"自己 execFileSync 读台账"的窄面通路不得回来(回来了就等于绕过归档件)
  assert.doesNotMatch(
    nextSrc,
    /\bexecFileSync\(/,
    'next-plan-id 不得再自己派生 git 取内容 —— 占用面只有一个出口(抄第二份必漂,守门 52/80 判的就是这个)',
  )
  // 出口二:宽面必须在 CAS 循环体内(提到循环外 = 把"这一轮看到的面"烘成一次性读数,N5 同型)
  const loopStart = ldeSrc.indexOf('for (let attempt = 1')
  const loopEnd = ldeSrc.indexOf("if (landed === '')")
  assert.ok(
    loopStart > 0 && loopEnd > loopStart,
    '找不到 live-doc-edit 的 CAS 循环(结构漂了,本锁失去意义)',
  )
  const body = ldeSrc.slice(loopStart, loopEnd)
  assert.match(body, /collectIdFace\(\{/, '占用面必须在 CAS 循环体内每轮现取')
  assert.match(body, /const baseContent = idFace\.text/, '喂给 usedIdsOfPrefix 的底稿必须是宽面')
  // 取号与幂等形状必须吃同一个变量:两面不同形 ⇒ 发出的号匹配不上自己编出的匹配式 ⇒ 幂等永不命中
  assert.match(body, /resolveIdTokens\(targetLines, baseContent, remote\)/)
  assert.match(body, /compileBlockMatchers\(block,\s*baseContent\)/)
})

test('T2 构造面·阳性对照:号在被搬走的那一侧 ⇒ 宽面必须看见,窄面看不见', (t) => {
  const dir = mkScratch('mirror-pidface-')
  t.after(() => rmScratch(dir))
  const put = (rel, text) => {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, { encoding: 'utf8' })
  }
  git(['init', '-q'], { root: dir })
  for (const [k, v] of [
    ['user.email', 't@e2e.local'],
    ['user.name', 'e2e'],
    ['core.autocrlf', 'false'],
  ])
    git(['config', k, v], { root: dir })
  put('PROJECT_PLAN.md', ['# 台账', '- [ ] O13 台账里还在', ''].join('\n'))
  put(
    join('.ihui-agent', 'archive', 'PROJECT_PLAN_2026-09-28_auto-archive.md'),
    ['- [x] O90 已被归档器搬走', '- [x] O91 更大号也在归档件里'].join('\n'),
  )
  put(join('.ihui-agent', 'archive', 'notes.txt'), '- [x] O9999 无关件')
  git(['add', '-A'], { root: dir })
  git(['commit', '-q', '-m', 'init'], { root: dir })

  const face = collectIdFace({ root: dir, source: 'HEAD' })
  assert.equal(face.ok, true, `面应可用:${JSON.stringify(face.undetermined)}`)
  assert.equal(face.archiveFiles.length, 1, '只该吃到那份 PROJECT_PLAN*.md(.txt 不算)')
  const narrow = familyMaxOn(face.ledgerText)
  const wide = familyMaxOn(face.text)
  assert.equal(narrow, 13, '窄面(台账)max 应为 13')
  assert.equal(wide, 91, '宽面 max 应为 91 —— 只看台账就会从 O14 起重发,正是本缺陷')
  assert.ok(wide > narrow, '宽面必须不早于窄面')
  assert.ok(!face.text.includes('O9999'), '形状筛拒掉的无关件不得混进占用面')
})

test('T3 真仓覆盖面自证:吃到的份数 == 该面上真实的台账归档件份数(漏一份就红)', () => {
  const face = collectIdFace({ root: REPO, source: 'HEAD', doc: LEDGER_DOC })
  assert.equal(
    face.ok,
    true,
    `HEAD 面判不出 ⇒ 本仓此刻连取号出口都该拒绝工作:${JSON.stringify(face.undetermined)}`,
  )
  const oracle = oracleArchiveList(REPO, 'HEAD')
  const got = face.archiveFiles.map((x) => x.path).sort()
  assert.deepEqual(got, oracle, '占用面漏掉了归档件(或把不该算的算了进来)—— 漏一份就是窄面发号')
  assert.ok(
    oracle.length >= 1,
    '真仓 HEAD 面上一份归档件都没有 ⇒ 本条退化成空扫,不算通过(覆盖面自证)',
  )
  assert.ok(face.text.startsWith(face.ledgerText), '台账必须排在最前(拼接顺序是硬要求)')
  assert.equal(face.enumeratedEmpty, false)
  assert.deepEqual(face.undetermined, [], '真仓面不得留未判定')
  // 归档件里的号真能被那一份判据认出来(不是"读到了正文"就算完)
  const narrow = familyMaxOn(face.ledgerText)
  const wide = familyMaxOn(face.text)
  assert.ok(wide >= narrow, `宽面 max(${wide}) 不得小于窄面 max(${narrow})`)
})

test('T4 形状锁·不读磁盘 + 同面同轮:一个字节都不从工作树取,清单与正文都问同一个 source', () => {
  assert.doesNotMatch(
    LIB_SRC,
    /\breadFileSync\(/,
    '占用面按磁盘读 = 工作树滞后时产出与真实改动无关的窄面',
  )
  assert.doesNotMatch(LIB_SRC, /\bexistsSync\(/, '存在性按磁盘判同样会把"没枚举到"读成"没有归档件"')
  assert.doesNotMatch(
    LIB_SRC,
    /os\.tmpdir|require\('os'\)/,
    '夹具落点由 scratch-dir 管,本层不得自派临时目录',
  )
  const tStart = LIB_SRC.indexOf('export const ID_FACE_TRANSPORT')
  const tEnd = LIB_SRC.indexOf('export function collectIdFace')
  assert.ok(tStart > 0 && tEnd > tStart, '派生层与消费层必须相邻')
  const transportSrc = LIB_SRC.slice(tStart, tEnd)
  assert.equal((transportSrc.match(/\bgit\(\[/g) || []).length, 2, '清单 + 正文各一次派生,不多不少')
  assert.equal(
    (transportSrc.match(/timeout:/g) || []).length,
    2,
    '每一次派生都必须带数字 timeout(守门 80:本仓实测过无超时挂 80 分钟)',
  )
  assert.ok(
    /source/.test(transportSrc.split('listArchives')[1] ?? ''),
    '清单必须按被审面取(source)',
  )
  assert.ok(
    /show\(\{ root, source, path \}\)/.test(transportSrc),
    '正文必须与清单同一个 source(不得一面 HEAD 一面索引/磁盘)',
  )
  assert.doesNotMatch(
    transportSrc,
    /'(fetch|update-ref|checkout|pull)'/,
    '取号占用面不得动任何工作树或 ref',
  )
})

test('T5 三态与 CLI 契约:枚举失败必须喊出来,--json 不得吐正文,--source 无效值必须点名', () => {
  const bad = collectIdFace({ root: REPO, source: 'no-such-rev-4f1a9c' })
  assert.equal(bad.ok, false, '被审面问不到而判成可用 = 恒绿的尺子')
  assert.ok(bad.undetermined.length >= 1, '判不出必须点名原因,不得只给一个 false')
  const noRoot = collectIdFace({ source: 'HEAD' })
  assert.equal(noRoot.ok, false)
  assert.equal(
    noRoot.undetermined.some((n) => n.includes('root')),
    true,
  )
  // 形状筛的三态:收 / 拒(无关件)/ 拒(整仓另一个同名文件)
  assert.equal(isArchivePath(`${ARCHIVE_DIR}/PROJECT_PLAN_x.md`), true)
  assert.equal(isArchivePath(`${ARCHIVE_DIR}/notes.txt`), false)
  assert.equal(isArchivePath('PROJECT_PLAN.md'), false)
  assert.equal(pickArchivePaths(undefined), null, '读不出 ≠ 零份')
  assert.deepEqual(pickArchivePaths(''), [], '零份要能被表达(与 null 分家)')
  // 拼接隔离:末行无换行的两份不得并成一行
  assert.equal(joinFace('a', ['b', 'c']), 'a\nb\nc')
  // 旗标:无效值退回默认但必须大声(静默退回 HEAD = 把"问的是另一个面"写成"问的就是这个面")
  assert.deepEqual(
    resolveSource([]),
    { source: 'HEAD', notice: null },
    '不带 --source 时不得多打一行(与改动前同形)',
  )
  assert.equal(resolveSource(['--source', 'origin/main']).source, 'origin/main')
  assert.equal(resolveSource(['--source', 'origin/main']).notice, null)
  for (const bad of [['--source'], ['--source', '--json'], ['--source', '']]) {
    const r = resolveSource(bad)
    assert.equal(r.source, 'HEAD', `${JSON.stringify(bad)} 必须退回默认`)
    assert.ok(r.notice && r.notice.includes('忽略'), `${JSON.stringify(bad)} 退回默认必须大声点名`)
  }
  // CLI:--json 必须是可 parse 的摘要,且**不得**内嵌 15 MB 正文
  const r = spawnSync(process.execPath, [LIB, '--json'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  })
  assert.equal(r.status, 0, `--json 应 exit 0:${String(r.stderr).slice(0, 300)}`)
  const j = JSON.parse(r.stdout)
  assert.equal(j.ok, true)
  assert.ok(
    j.text === undefined && j.ledgerText === undefined,
    '--json 不得把被审正文打出来(遥测不落内容)',
  )
  assert.ok(
    Number(j.bytes.text) > Number(j.bytes.ledger),
    '宽面应不小于窄面(真仓现读:台账只占一部分)',
  )
  assert.ok(r.stdout.length < 200_000, `--json 输出体积失控:${r.stdout.length}`)
  // CLI:坏面必须 exit 1(不是 0、不是静默给号)
  const r2 = spawnSync(process.execPath, [LIB, '--source', 'definitely-not-a-rev'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  })
  assert.equal(r2.status, 1, '面判不出的退出码必须是 1(取号出口据此拒绝发号)')
  assert.match(r2.stderr || r2.stdout, /未判定|判不出/)
  // 未知旗标 ⇒ 2(用法错,与"面判不出"分家)
  const r3 = spawnSync(process.execPath, [LIB, '--bogus-flag'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  })
  assert.equal(r3.status, 2)
})

/** 造一把带(或不带)归档件的台账仓,并跑一次真 `live-doc-edit.mjs`,返回 {status, stdout, headText}。 */
function runLiveDocEdit(t, { withArchive }) {
  const dir = mkScratch('pidface-lde-')
  const inputs = mkScratch('pidface-lde-in-')
  t.after(() => rmScratch(dir))
  t.after(() => rmScratch(inputs))
  const put = (abs, text) => {
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, { encoding: 'utf8' })
  }
  git(['init', '-q'], { root: dir })
  for (const [k, v] of [
    ['user.email', 't@e2e.local'],
    ['user.name', 'e2e'],
    ['core.autocrlf', 'false'],
  ])
    git(['config', k, v], { root: dir })
  put(
    join(dir, 'PROJECT_PLAN.md'),
    ['# 台账', '@@ANCHOR@@', '- [ ] O13 台账里还在的条目', ''].join('\n'),
  )
  if (withArchive)
    put(
      join(dir, '.ihui-agent', 'archive', 'PROJECT_PLAN_2026-09-28_auto-archive.md'),
      ['- [x] O90 已被归档器搬走,台账只剩一行 HTML 注释占位', ''].join('\n'),
    )
  put(join(inputs, 'block.txt'), '- [ ] {{NEXT_ID:O}} 本次要登记的新任务:正文')
  put(join(inputs, 'anchor.txt'), '@@ANCHOR@@')
  git(['add', '-A'], { root: dir })
  git(['commit', '-q', '-m', 'init'], { root: dir })
  const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'live-doc-edit.mjs')], {
    env: {
      ...process.env,
      LIVE_ROOT: dir,
      LIVE_DOC: 'PROJECT_PLAN.md',
      LIVE_MSG: 'docs(plan): e2e 取号占用面对账',
      LIVE_BLOCK_FILE: join(inputs, 'block.txt'),
      LIVE_ANCHOR_FILE: join(inputs, 'anchor.txt'),
    },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  })
  const headText = git(['show', 'HEAD:PROJECT_PLAN.md'], { root: dir, raw: true })
  return { status: r.status, stdout: String(r.stdout || '') + String(r.stderr || ''), headText }
}

test('T7 端到端·出口二必须真的吃到宽面:有归档件 ⇒ 落 O91;无归档件 ⇒ 落 O14(成对)', (t) => {
  const wide = runLiveDocEdit(t, { withArchive: true })
  assert.equal(wide.status, 0, `带归档件那一次应落地:\n${wide.stdout.slice(-1200)}`)
  assert.match(
    wide.headText,
    /O91 本次要登记的新任务/,
    `落地文本应是宽面算出的 O91,实得:\n${wide.headText}`,
  )
  assert.ok(
    !/O14 本次要登记/.test(wide.headText),
    '落了 O14 ⇒ 归档件那一级根本没装车(T1 的文本锁会绿而行为仍错)',
  )

  const narrow = runLiveDocEdit(t, { withArchive: false })
  assert.equal(narrow.status, 0, `无归档件那一次也应落地:\n${narrow.stdout.slice(-1200)}`)
  assert.match(
    narrow.headText,
    /O14 本次要登记的新任务/,
    '零归档件是合法面,必须按台账给 O14(不得凭空抬高也不得拒发)',
  )
  assert.ok(!/O91/.test(narrow.headText), '无归档件却发出 O91 ⇒ 有第二处号源')
})

/** 造一把台账里该族**一条都没有**、归档件里有的仓,跑真 live-doc-edit,返回 {status, out, headText}。 */
function runLiveDocEditArchivedOnlyFamily(t, { withArchive }) {
  const dir = mkScratch('pidface-w-')
  const inputs = mkScratch('pidface-w-in-')
  t.after(() => rmScratch(dir))
  t.after(() => rmScratch(inputs))
  const put = (abs, text) => {
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, { encoding: 'utf8' })
  }
  git(['init', '-q'], { root: dir })
  for (const [k, v] of [
    ['user.email', 't@e2e.local'],
    ['user.name', 'e2e'],
    ['core.autocrlf', 'false'],
  ])
    git(['config', k, v], { root: dir })
  // 台账里 W 族零成员(只有 O 族),归档件里 W1..W5 全被搬走了
  put(join(dir, 'PROJECT_PLAN.md'), ['# 台账', '@@ANCHOR@@', '- [ ] O13 别的族', ''].join('\n'))
  if (withArchive)
    put(
      join(dir, '.ihui-agent', 'archive', 'PROJECT_PLAN_2026-09-28_auto-archive.md'),
      ['- [x] W1 已归档 ✅', '- [x] W5 已归档 ✅', ''].join('\n'),
    )
  put(join(inputs, 'block.txt'), '- [ ] {{NEXT_ID:W}} 本次登记的 W 族新任务')
  put(join(inputs, 'anchor.txt'), '@@ANCHOR@@')
  git(['add', '-A'], { root: dir })
  git(['commit', '-q', '-m', 'init'], { root: dir })
  const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'live-doc-edit.mjs')], {
    env: {
      ...process.env,
      LIVE_ROOT: dir,
      LIVE_DOC: 'PROJECT_PLAN.md',
      LIVE_MSG: 'docs(plan): e2e 归档族取号',
      LIVE_BLOCK_FILE: join(inputs, 'block.txt'),
      LIVE_ANCHOR_FILE: join(inputs, 'anchor.txt'),
    },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  })
  return {
    status: r.status,
    out: String(r.stdout || '') + String(r.stderr || ''),
    headText: git(['show', 'HEAD:PROJECT_PLAN.md'], { root: dir, raw: true }),
  }
}

test('T8 端到端·"族整族被归档"这一格的行为差(成对,如实登记而非散文声称):有归档件 ⇒ 落 W6;无 ⇒ 仍 exit 2 拒发', (t) => {
  const wide = runLiveDocEditArchivedOnlyFamily(t, { withArchive: true })
  assert.equal(wide.status, 0, `归档件里有该族 ⇒ 应能取号:\n${wide.out.slice(-1200)}`)
  assert.match(
    wide.headText,
    /W6 本次登记的 W 族新任务/,
    `应落 W6(归档件里 W1..W5 已占用),实得:\n${wide.headText}`,
  )

  const narrow = runLiveDocEditArchivedOnlyFamily(t, { withArchive: false })
  assert.equal(
    narrow.status,
    2,
    `两面都零成员 ⇒ 必须仍按既有口径拒绝(不得凭空给 "W-1"):\n${narrow.out.slice(-800)}`,
  )
  assert.match(narrow.out, /no-such-family|拒绝落地/, '拒绝原因必须点名,不能只给退出码')
  assert.ok(!/^- \[ \] W\d+ 本次登记/m.test(narrow.headText), '被拒的那一次不得产生任何登记行')
})

test('T6 跑一次被检模块自己的 --self-test(自检不跑 = 它可以随时悄悄坏掉)', () => {
  const r = spawnSync(process.execPath, [LIB, '--self-test'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  })
  const out = String(r.stdout || '')
  assert.equal(
    r.status,
    0,
    `--self-test 必须全绿:\n${out.slice(-1500)}\n${String(r.stderr).slice(0, 500)}`,
  )
  assert.match(
    out,
    /\d+ 通过 \/ 0 失败/,
    `末行必须是可核对的计数,实得:${out.split('\n').filter(Boolean).pop()}`,
  )
  const m = out.match(/(\d+) 通过 \/ 0 失败/)
  assert.ok(
    m && Number(m[1]) >= 30,
    `自检条数异常(应当 ≥30,实得 ${m ? m[1] : 'n/a'})—— 条数被悄悄删减就是判据在缩`,
  )
  // 阳性对照必须在自检里(本票全部意义那一条),不能被删掉而账面仍全绿
  assert.match(out, /O91 而不是 O14/, '自检里那条"号在被搬走的一侧"正面对照不得消失')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
