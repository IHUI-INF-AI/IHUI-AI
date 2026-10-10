// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/live-doc-staleness-decision.mjs` 的常驻尺子(§22c:判据**直接 import 源文件导出的
 * `__test__`**,本文件不复制任何一份判定实现 —— 由 T0 反向锁钉住)。
 *
 * 为什么必须有端到端而不是只有构造面:该出口的全部价值是"真拿一份临时 git 仓,把行搬进归档再
 * 拿搬走前的磁盘副本来问",而构造面只能证明函数会给答案,证不了取材面(归档清单、批量 blob 读、
 * 工作区读)接得上。AGENTS 记过的同型失效:"自检恒绿是因为它手工喂档表给函数,证明的是'函数会给
 * 答案'而不是'有人问它'"。
 *
 * 夹具一律 `scripts/lib/scratch-dir.mjs` 的 mkScratch / rmScratch(§26:不写 os.tmpdir()、
 * 不在仓库树内造 git 仓)。每条判据的"错写法会翻红"方向写在各自注释里。
 */

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { gitBinary } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as S } from '../live-doc-staleness-decision.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'live-doc-staleness-decision.mjs')
const OWN_SOURCE = readFileSync(join(HERE, 'live-doc-staleness-decision.test.mjs'), 'utf8')
const SRC = readFileSync(SCRIPT, 'utf8')

const DOC_LINES = [
  '# 台账',
  '- [x] G-1 已经做完的事',
  '- [ ] G-2 还开着的活账',
  '- [x] G-3 今天被搬进归档的那一条',
]
const MOVED_LINE = '- [x] G-3 今天被搬进归档的那一条'

function git(repo, args) {
  return execFileSync(
    gitBinary(),
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', repo, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

function commit(repo, msg) {
  git(repo, [
    '-c',
    'user.name=fixture',
    '-c',
    'user.email=fixture@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    msg,
  ])
}

/**
 * 造一份"归档发生过"的仓:
 *   commit1 = DOC.md 含全部四行
 *   commit2 = 把 MOVED_LINE 从 DOC.md 删掉,原样搬进 .ihui-agent/archive/PROJECT_PLAN_x.md
 * 返回 { repo, preMoveDoc }:preMoveDoc 就是那份**滞台的磁盘副本**(搬走前的形态)。
 */
function makeArchivedRepo({ empty = false } = {}) {
  const repo = mkScratch('ldsd-')
  git(repo, ['init', '-b', 'main'])
  if (empty) return { repo, preMoveDoc: DOC_LINES.join('\n') + '\n' }
  writeFileSync(join(repo, 'DOC.md'), DOC_LINES.join('\n') + '\n', 'utf8')
  git(repo, ['add', 'DOC.md'])
  commit(repo, 'docs: 台账初版')
  const preMoveDoc = readFileSync(join(repo, 'DOC.md'), 'utf8')
  mkdirSync(join(repo, '.ihui-agent', 'archive'), { recursive: true })
  writeFileSync(
    join(repo, '.ihui-agent', 'archive', 'PROJECT_PLAN_2026-09-28_auto-archive.md'),
    `### G-3(已完成 ✅ 2026-09-28)\n\n${MOVED_LINE}\n`,
    'utf8',
  )
  writeFileSync(
    join(repo, 'DOC.md'),
    DOC_LINES.filter((l) => l !== MOVED_LINE).join('\n') + '\n',
    'utf8',
  )
  git(repo, ['add', '-A'])
  commit(repo, 'chore(auto): 归档 G-3')
  return { repo, preMoveDoc }
}

/** 跑一次被检出口(零副作用:它自己只判定)。 */
function runCli(repo, extra = []) {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', repo, ...extra], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return r
}

function runJson(repo, extra = []) {
  const r = runCli(repo, ['--json', ...extra])
  let payload = null
  try {
    payload = JSON.parse(r.stdout)
  } catch {
    /* 交给断言点名 */
  }
  return { ...r, payload }
}

const opened = []
function openRepo(opts) {
  const made = makeArchivedRepo(opts)
  opened.push(made.repo)
  return made
}
after(() => {
  for (const d of opened) {
    try {
      rmScratch(d)
    } catch {
      /* 残留由 §26 的每日 Temp 体检兜,不在这里改写结论 */
    }
  }
})

test('T0 反向锁:镜像测试不得复制判定实现(§22c),必须 import 源的 __test__', () => {
  assert.ok(
    /import\s*\{\s*__test__\s+as\s+S\s*\}\s*from\s*'\.\.\/live-doc-staleness-decision\.mjs'/.test(
      OWN_SOURCE,
    ),
    '测试必须直接 import 源导出的 __test__',
  )
  // 自己再写一份 normalizeLine / lineCounts / orphanLines 就是第二份真相 —— 本行就是那条反向锁。
  for (const name of ['normalizeLine', 'lineCounts', 'orphanLines', 'decidePath']) {
    assert.ok(
      !new RegExp(`function\\s+${name}\\s*\\(`).test(OWN_SOURCE),
      `测试文件里不得出现 ${name} 的第二份实现`,
    )
    assert.ok(
      typeof S[name] === 'function',
      `源文件必须把 ${name} 经 __test__ 递出来(否则本文件只能自己抄一份)`,
    )
  }
})

test('T1 装车/端到端正例:滞台副本的行都在 HEAD 或归档里有出处 ⇒ alignable、blockerSet true、exit 0', () => {
  const { repo, preMoveDoc } = openRepo()
  // 磁盘副本 = 搬走前的旧形态(HEAD 已不含 G-3,那一行只在归档件里)
  writeFileSync(join(repo, 'DOC.md'), preMoveDoc, 'utf8')
  const r = runJson(repo, ['--paths', 'DOC.md'])
  assert.equal(r.stderr.includes('Error'), false, `不得抛错:${r.stderr}`)
  assert.equal(r.status, 0, `期望 exit 0,实得 ${r.status};stdout=${r.stdout};stderr=${r.stderr}`)
  assert.ok(r.payload, '--json 输出必须可 JSON.parse')
  assert.equal(r.payload.summary.blockerSet, true, '全部 alignable 才给 blockerSet=true')
  assert.equal(r.payload.results[0].status, 'alignable')
  assert.equal(r.payload.results[0].orphans.length, 0)
  assert.equal(r.payload.archiveDocs, 1, '归档语料必须真被枚举到(否则正例只是"没找到别的出处")')
  // 出处确实来自**两处**:HEAD 缺 G-3,所以它只能从归档件拿到
  assert.ok(
    r.payload.results[0].referenceDistinctLines >= DOC_LINES.length,
    '基准 ⊔ 归档的行数应覆盖整份滞台副本',
  )
})

test('T2 反例A:磁盘副本里有一行 HEAD 与归档都没有 ⇒ needHuman 并逐字点名,blockerSet false', () => {
  const { repo, preMoveDoc } = openRepo()
  writeFileSync(
    join(repo, 'DOC.md'),
    `${preMoveDoc}- [ ] 别人今天刚登记的活账(只在磁盘上)\n`,
    'utf8',
  )
  const r = runJson(repo, ['--paths', 'DOC.md'])
  assert.equal(r.status, 1, `有独有行必须 exit 1,实得 ${r.status}`)
  assert.equal(r.payload.summary.blockerSet, false)
  const orphans = r.payload.results[0].orphans
  assert.equal(orphans.length, 1)
  assert.equal(orphans[0].line, '- [ ] 别人今天刚登记的活账(只在磁盘上)')
  assert.equal(orphans[0].reference, 0)
  // 人读面也必须把这一行喊出来(只改退出码、不点名 = 调用方无从裁决)
  const human = runCli(repo, ['--paths', 'DOC.md'])
  assert.match(human.stdout, /needHuman/)
  assert.match(human.stdout, /别人今天刚登记的活账/)
})

test('T3 反例B:同一行 WT×3 而出处合计×2 ⇒ needHuman(用集合代替多重集就翻红)', () => {
  const { repo, preMoveDoc } = openRepo()
  // preMoveDoc 里 G-3 出现 1 次;HEAD 里没有它、归档里有 1 次 ⇒ 出处合计 1。
  // 把同一行在磁盘上写 3 遍 ⇒ 集合判据会认为"有出处",多重集必须认出多出来的 2 份是独有内容。
  writeFileSync(join(repo, 'DOC.md'), `${preMoveDoc}${MOVED_LINE}\n${MOVED_LINE}\n`, 'utf8')
  const r = runJson(repo, ['--paths', 'DOC.md'])
  assert.equal(r.status, 1, '重复超出出处次数 ⇒ 不得判 alignable')
  const o = r.payload.results[0].orphans.find((x) => x.line === MOVED_LINE)
  assert.ok(
    o,
    `无出处清单必须点名被复制的那一行,实得 ${JSON.stringify(r.payload.results[0].orphans)}`,
  )
  assert.equal(o.worktree, 3)
  assert.equal(o.reference, 1)
  assert.equal(o.excess, 2)
  // 对照:同样这一行只写 1 遍(= 出处次数内)⇒ 仍然 alignable(收紧不得反过来变成误伤)
  writeFileSync(join(repo, 'DOC.md'), preMoveDoc, 'utf8')
  const ok = runJson(repo, ['--paths', 'DOC.md'])
  assert.equal(ok.status, 0, `同一行在出处次数内必须放过:${ok.stdout}`)
})

test('T4 反例C-1:工作区文件缺失 ⇒ undetermined,既不算 alignable 也不进 blockerSet', () => {
  const { repo } = openRepo()
  rmSync(join(repo, 'DOC.md'), { force: true })
  const r = runJson(repo, ['--paths', 'DOC.md'])
  assert.equal(r.status, 2, `取不到必须 exit 2,实得 ${r.status}`)
  assert.equal(r.payload.summary.alignable, 0)
  assert.equal(r.payload.summary.undetermined, 1)
  assert.equal(r.payload.summary.blockerSet, false)
  assert.match(r.payload.results[0].reason, /工作区里不存在/)
})

test('T5 反例C-2:被审面没有这个路径 ⇒ undetermined(没有基准不得被读成"可以覆盖")', () => {
  const { repo } = openRepo()
  writeFileSync(join(repo, 'NEWcomer.md'), '- [ ] 盘上有、仓里没有的一条\n', 'utf8')
  const r = runJson(repo, ['--paths', 'NEWcomer.md'])
  assert.equal(r.status, 2)
  assert.equal(r.payload.results[0].status, 'undetermined')
  assert.match(r.payload.results[0].reason, /基准 blob 取不到/)
  assert.equal(r.payload.summary.blockerSet, false)
})

test('T6 反例C-3:仓库还没有任何提交 ⇒ 整轮 undetermined 且不抛错', () => {
  const { repo } = openRepo({ empty: true })
  writeFileSync(join(repo, 'DOC.md'), DOC_LINES.join('\n') + '\n', 'utf8')
  const r = runJson(repo, ['--paths', 'DOC.md'])
  assert.equal(r.stderr.trim(), '', `不得把 git 的 fatal 漏进 stderr:${r.stderr}`)
  assert.equal(r.status, 2, `无提交 ⇒ 无法判定,实得 ${r.status}/${r.stdout}`)
  assert.equal(r.payload.results[0].status, 'undetermined')
  assert.match(r.payload.results[0].reason, /本轮整体不可判/)
})

test('T7 归一化:磁盘副本只是 CRLF + 尾随空白不同 ⇒ 必须算有出处(守门 13c 记过的同型假红)', () => {
  const { repo, preMoveDoc } = openRepo()
  const crlf = preMoveDoc.replace(/\n/g, '\r\n').replace('- [x] G-1', '- [x] G-1 ')
  writeFileSync(join(repo, 'DOC.md'), crlf, 'utf8')
  const r = runJson(repo, ['--paths', 'DOC.md'])
  assert.equal(r.status, 0, `CRLF 差异不得被读成无出处:${r.stdout}${r.stderr}`)
  assert.equal(r.payload.results[0].status, 'alignable')
})

test('T8 未判定优先于 needHuman(两种红混成一桶就会把"没判"说成"不许覆盖")', () => {
  const { repo, preMoveDoc } = openRepo()
  writeFileSync(join(repo, 'DOC.md'), `${preMoveDoc}- [ ] 只有磁盘有的行\n`, 'utf8')
  const r = runJson(repo, ['--paths', 'DOC.md', '--paths', 'AGENTS-copy.md'])
  assert.equal(r.payload.summary.needHuman, 1)
  assert.equal(r.payload.summary.undetermined, 1)
  assert.equal(r.status, 2, '有未判定时 exit 必须是 2,不得被 1 顶掉')
})

test('T9 零路径被问 ⇒ 判死而非凭空 blockerSet=true(纯函数面)', () => {
  const s = S.aggregate([])
  assert.equal(s.blockerSet, false)
  assert.equal(s.exitCode, 2)
  assert.equal(S.aggregate([{ path: 'A', status: 'alignable' }]).blockerSet, true)
})

test('T10 形状锁(源码级反向断言):取材面纪律与定根方式不得退化', () => {
  assert.ok(
    /from\s*'\.\/lib\/face-reader\.mjs'/.test(SRC),
    '必须 import 取材层(守门 118 见不到层导入就判半接线)',
  )
  assert.ok(/catBatch\s*\(/.test(SRC), '内容必须走层的 catBatch 批量读')
  assert.ok(/readWorktreeFile\s*\(/.test(SRC), '工作区副本必须走层的磁盘出口')
  // 反向:四型退化写法一律不得回来(每条各对应一次本仓记过的真实事故形态)
  assert.ok(!/process\.cwd\(\)/.test(SRC), '不得以调用方所在目录定根(扫哪棵树会随 cwd 换结论)')
  for (const bad of ["'show'", '"show"', "'cat-file'", '--batch', "'diff'"])
    assert.ok(!SRC.includes(bad), `不得自派生 git 取正文(证据:${bad})`)
  for (const bad of ['readFileSync(', 'execFileSync(', 'execSync(', 'spawnSync('])
    assert.ok(!SRC.includes(bad), `不得留自派生读取(${bad})—— 内容一律经层`)
})

test('T11 自检登记必须求值(守门 156 那一型):登记侧比 true,用例侧立即求值', () => {
  const from = SRC.indexOf('function selfTest')
  const to = SRC.indexOf('function main(')
  assert.ok(from > 0 && to > from, '自检主体必须能被定位(改名了就去改这条锁,别删)')
  const body = SRC.slice(from, to)
  const registrant = body.slice(
    body.indexOf('const t ='),
    body.indexOf('\n', body.indexOf('const t =')),
  )
  assert.match(registrant, /ok === true/, '登记必须求值到布尔')
  assert.ok(!/!!\s*cond|Boolean\(/.test(registrant), '不得退回对函数恒真的求值写法')
  assert.ok(!/\?\s*'PASS'/.test(registrant), "不得用 x ? 'PASS' : 'FAIL' 冒充判定")
  // 逐行匹配会被 prettier 打掉:名字长的调用会被折成 t(\n '…',\n (() => { 三行,
  // 而 lint-staged 每次提交都会这样重排 ⇒ 锁必须认两种书写形态,否则下一个人红在别人的排版上。
  const flat = body.replace(/\s+/g, ' ')
  const calls = flat.match(/\bt\(\s*'/g) || []
  const iife = flat.match(/\bt\(\s*'[^']*'\s*,\s*\(\(\) => \{/g) || []
  assert.ok(calls.length >= 15, `自检用例数不得被削(现读 ${calls.length})`)
  assert.equal(
    iife.length,
    calls.length,
    `每条用例都必须是 (() => {…})() 立即求值形态(iife ${iife.length} / calls ${calls.length})`,
  )
})

test('T12 自检端到端:源文件自带的 --self-test 必须 rc 0(装车证明)', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--self-test'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `自检必须全绿:${r.stdout}${r.stderr}`)
  const m = /自检:(\d+)\/(\d+) 通过/.exec(r.stdout)
  assert.ok(m, `末行必须报"N/N 通过",实得 ${JSON.stringify(r.stdout)}`)
  assert.equal(m[1], m[2], '通过数必须等于用例数')
  assert.ok(Number(m[2]) >= 15, '用例数下限(被削掉就是防线没了)')
})

test('T13 --json 面必须是纯 JSON,人读面与它不得混排', () => {
  const { repo, preMoveDoc } = openRepo()
  writeFileSync(join(repo, 'DOC.md'), preMoveDoc, 'utf8')
  const j = runJson(repo, ['--paths', 'DOC.md'])
  assert.doesNotThrow(() => JSON.parse(j.stdout))
  const h = runCli(repo, ['--paths', 'DOC.md'])
  assert.throws(() => JSON.parse(h.stdout), '人读面不得伪装成 JSON')
  assert.match(h.stdout, /blockerSet=true/)
})

test('T14 归一化键的构造面:多重集比较而非集合(纯函数,与端到端各守一层)', () => {
  const dup = '- [x] G-3 今天被搬进归档的那一条'
  const over = S.decidePath({
    rel: 'P',
    wtText: [dup, dup, dup].join('\n'),
    headText: dup,
    archiveTexts: [dup],
  })
  assert.equal(over.status, 'needHuman')
  const within = S.decidePath({
    rel: 'P',
    wtText: [dup, dup].join('\n'),
    headText: [dup, dup, dup].join('\n'),
    archiveTexts: [],
  })
  assert.equal(within.status, 'alignable')
})

// ── 2026-10-10 新增:「旧修订被取代」第二判据 + 远端面(加性)。端到端四臂,钉住承重关系 ──
const SUP_BODY = '**远端面取代测试:这条正文专门写长到能通过四十字符长度闸,不给长度判据留边界歧义**'
const OLD_LINE = `- [ ] G-42（进行中@2026-10-10/peer）${SUP_BODY}`
const NEW_LINE = `- [x] ✅(2026-10-10) G-42 ${SUP_BODY} 〔完成@2026-10-10:已入库〕`
const UNIQ_LINE =
  '- [ ] 某人今天刚写的活账:把远端面判据的边界逐条重验(这条正文足够长,且三个面里都没有这一段)'

/**
 * 造一份"旧修订的正文只在新修订里"的仓(2026-10-10 那一型的端到端夹具):
 *   HEAD(main) = '# 台账'(本地落后;两个本地面都没有旧修订的正文)
 *   headSide=false 时走 side-tmp 分支造完成态,按 remote 决定是否挂到 refs/remotes/origin/main;
 *   headSide=true 时完成态直接进 HEAD(证明 HEAD 面同权,不依赖远端面)。
 *   最后把**滞台副本**(旧修订形态)写回工作区且不提交 —— 要判的就是它。
 */
function makeSupersedeRepo({ remote = true, headSide = false } = {}) {
  const repo = mkScratch('ldsd-sup-')
  git(repo, ['init', '-b', 'main'])
  writeFileSync(join(repo, 'DOC.md'), '# 台账\n', 'utf8')
  git(repo, ['add', 'DOC.md'])
  commit(repo, 'docs: 台账初版')
  if (headSide) {
    writeFileSync(join(repo, 'DOC.md'), `# 台账\n${NEW_LINE}\n`, 'utf8')
    git(repo, ['add', 'DOC.md'])
    commit(repo, 'docs: 完成态(HEAD 侧取代)')
  } else {
    git(repo, ['checkout', '-b', 'side-tmp'])
    writeFileSync(join(repo, 'DOC.md'), `# 台账\n${NEW_LINE}\n`, 'utf8')
    git(repo, ['add', 'DOC.md'])
    commit(repo, 'docs: 完成态(远端面取代)')
    const done = git(repo, ['rev-parse', 'HEAD']).trim()
    git(repo, ['checkout', 'main'])
    if (remote) git(repo, ['update-ref', 'refs/remotes/origin/main', done])
    git(repo, ['branch', '-D', 'side-tmp'])
  }
  writeFileSync(join(repo, 'DOC.md'), `# 台账\n${OLD_LINE}\n`, 'utf8')
  return { repo }
}
function openSupersedeRepo(opts) {
  const made = makeSupersedeRepo(opts)
  opened.push(made.repo)
  return made
}

test('S1 端到端:旧修订的正文只在远端面上 ⇒ alignable(按「被取代」放过)、逐条报名、exit 0', () => {
  const { repo } = openSupersedeRepo({ remote: true })
  const j = runJson(repo, ['--paths', 'DOC.md'])
  assert.equal(j.status, 0, `应判可复原:${j.stdout}${j.stderr}`)
  const r = j.payload.results[0]
  assert.equal(r.status, 'alignable')
  assert.equal(r.supersededCount, 1)
  assert.equal(r.superseded[0], OLD_LINE, '被取代的行必须逐条点名(不许静默)')
  assert.equal(j.payload.remoteMatched, 1, '远端面必须真被读到(否则这条测的是别的路径)')
  assert.equal(j.payload.summary.blockerSet, true)
})

test('S2 反向对照:同一份副本、远端面缺席(引用不存在)⇒ needHuman,且不抛错(降级=改动前口径)', () => {
  const { repo } = openSupersedeRepo({ remote: false })
  const j = runJson(repo, ['--paths', 'DOC.md'])
  assert.equal(j.status, 1, `应判需人工:${j.stdout}${j.stderr}`)
  const r = j.payload.results[0]
  assert.equal(r.status, 'needHuman')
  assert.equal(r.supersededCount, 0)
  assert.equal(r.orphans.length, 1)
  assert.equal(j.payload.remoteMatched, 0)
})

test('S3 HEAD 侧取代即可(不依赖远端面):新修订在 HEAD 上时同样按「被取代」放过', () => {
  const { repo } = openSupersedeRepo({ remote: false, headSide: true })
  const j = runJson(repo, ['--paths', 'DOC.md'])
  assert.equal(j.status, 0, `应判可复原:${j.stdout}${j.stderr}`)
  assert.equal(j.payload.results[0].supersededCount, 1)
})

test('S4 反洗白(端到端):远端面在场时,真独有的长行仍须 needHuman,且不得出现在被取代里', () => {
  const { repo } = openSupersedeRepo({ remote: true })
  appendFileSync(join(repo, 'DOC.md'), `${UNIQ_LINE}\n`, 'utf8')
  const j = runJson(repo, ['--paths', 'DOC.md'])
  assert.equal(j.status, 1)
  const r = j.payload.results[0]
  assert.equal(r.status, 'needHuman')
  assert.equal(r.supersededCount, 1)
  assert.ok(
    r.orphans.some((o) => o.line === UNIQ_LINE),
    '真独有行必须在 orphans 里',
  )
  assert.ok(!r.superseded.includes(UNIQ_LINE), '真独有行不得被「被取代」顺走')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
