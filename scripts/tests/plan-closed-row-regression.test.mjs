// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 130 新增维 F13「已勾行被捣回未勾」+ 守门 239 结论三态化 的镜像件(2026-10-27 立)。
 *
 * 立项凭据(主席 2026-10-27 16:30 实测,不是推断):
 *  ① 某席把工作树/索引里那份**滞后副本**交进提交时,已结清的登记行(`- [x]`)会变回未勾旧版。
 *     这种面在 `plan-tasks.mjs --gate --staged` 上报 `F1=0 / F4=0 / F4b=0 / F6=0`、差值棘轮全绿
 *     —— 既有各维**全在一面之内数数**,而滞后副本让该主键在面上只剩一态,结构上看不见。
 *  ② `check-plan-archive-monotonic.mjs --staged` 在两面 blob 明显不同时会印
 *     「零改动(索引 blob 与 HEAD 逐字相同)」且 RC=0 —— 把"本门没判中"说成"两面一样"(§0.3)。
 *
 * 四条夹具按票面要求齐备,并按 §22c 的纪律**成对**写(装上即翻红 / 摘掉即翻绿):
 *   1 只工作树滞后(被审面==HEAD)⇒ 不得红(§12e 防恒红门);
 *   2 索引面真回退 ⇒ 必红并点名复合主键;
 *   3 存量回退(HEAD 面自有的两态并存)⇒ 只报数不红;
 *   4 面取不到 ⇒ exit 2 显式未判定,既不记绿也不冒红。
 * 另加门 239 的措辞三态锁与 F13 判据单源锁。
 *
 * 判据一律 import 单源(`compositeKeyOf` / `stateGroupsOf` / `findClosedToOpenRegressions` /
 * `wireF13` / `conclusionOf`),本件**不写第二份正则、不复制任何常量**(守门 191)。
 * 真 CLI 跑在 `mkScratch` 临时 git 仓里(§15b;仓库树内绝不 `git init` —— 守门 208)。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  compositeKeyOf,
  findClosedToOpenRegressions,
  stateGroupsOf,
} from '../lib/plan-task-index.mjs'
import { grewViolations, probe, wireF13 } from '../plan-tasks.mjs'
import { blobShaOf, conclusionOf } from '../check-plan-archive-monotonic.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const TOOLS = join(REPO, 'scripts')
const PLAN = 'PROJECT_PLAN.md'

// ── 夹具文本(9007xx 段只在本件的临时仓里存在,不碰真台账号族)────────────────
const CLOSED_ROW = '- [x] ✅(2026-10-20) **G-900777 闭环票**:已结清的登记行正文足够长用于判据样例。'
const REGRESSED_ROW = '- [ ] **G-900777 闭环票**:已结清的登记行正文足够长用于判据样例。'
const OTHER_LIVE = '- [ ] **G-900770 另一条真活**:正文足够长用于判据样例(登记@2026-10-27)。'
const STOCK_DONE = '- [x] ✅(2026-10-19) **G-900779 存量分叉甲**:同一件事的已勾登记正文足够长。'
const STOCK_OPEN = '- [ ] **G-900779 存量分叉甲**:同一件事的已勾登记正文足够长,另有一份未勾旧副本。'
const COPY_POINTER_OPEN =
  STOCK_DONE.replace('- [x] ✅(2026-10-19) ', '- [ ] ') +
  ' 〔【归并】重复登记副本(2026-10-27):派单以主行为准,本行不再单独派单。〕'

const HEAD_PLAN = ['# 计划文档夹具', '', CLOSED_ROW, OTHER_LIVE, ''].join('\n')
const STOCK_PLAN = ['# 计划文档夹具', '', STOCK_DONE, STOCK_OPEN, CLOSED_ROW, ''].join('\n')

function gitIn(cwd, args) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
    // 台账面是 MB 级(现读 PROJECT_PLAN.md ≈3MB):默认 maxBuffer 只有 1MB,超了 Node 直接
    // 杀进程 ⇒ status=null、stderr 为空,报错信息里全是正文,看着像"git 说了别的"。
    maxBuffer: 64 << 20,
  })
  if (r.status !== 0)
    throw new Error(`git ${args.join(' ')} 失败:${String(r.stderr || r.stdout || '').trim()}`)
  return String(r.stdout ?? '').trim()
}

/**
 * 临时 git 仓 + 台账夹具。
 * @param {{headText?:string, stageText?:string|null, commit?:boolean}} o
 *   commit=false 时**不产生任何提交**(用来证"锚点面取不到")。
 */
function mkRepo(o = {}) {
  const root = mkScratch('plan-closed-row-regression')
  const headText = o.headText ?? HEAD_PLAN
  mkdirSync(join(root, 'scripts', 'lib'), { recursive: true })
  gitIn(root, ['init', '-q', '-b', 'main'])
  gitIn(root, ['config', 'user.email', 'fixture@example.invalid'])
  gitIn(root, ['config', 'user.name', 'fixture'])
  gitIn(root, ['config', 'core.autocrlf', 'false'])
  writeFileSync(join(root, PLAN), headText, 'utf8')
  if (o.commit !== false) {
    gitIn(root, ['add', PLAN])
    gitIn(root, ['commit', '-q', '-m', 'fixture: HEAD 面'])
  }
  if (typeof o.stageText === 'string') {
    writeFileSync(join(root, PLAN), o.stageText, 'utf8')
    gitIn(root, ['add', PLAN])
  }
  return { root, headText }
}

/** 取 blob 原文(**不 trim** —— 少一个换行就是另一枚 blob,拿它算 sha 会自证失败)。 */
function gitBlob(cwd, args) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
    maxBuffer: 64 << 20,
  })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败(status=${r.status})`)
  return String(r.stdout ?? '')
}

function runGate(root, extra = []) {
  const r = spawnSync(
    process.execPath,
    [join(TOOLS, 'plan-tasks.mjs'), '--gate', ...extra, '--root', root],
    {
      cwd: TOOLS,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 240000,
      maxBuffer: 64 << 20,
    },
  )
  return { rc: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

function runMonotonic(args) {
  const r = spawnSync(process.execPath, [join(TOOLS, 'check-plan-archive-monotonic.mjs'), ...args], {
    cwd: TOOLS,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 240000,
    maxBuffer: 64 << 20,
  })
  return { rc: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const f13Line = (out) => (out.match(/^ {2}F13 .*/m) || [''])[0]

// ── 夹具 1:只工作树滞后(被审面 == HEAD,磁盘上是旧短版)⇒ 不得红 ──────────────
test('夹具1 只工作树滞后(被审面==HEAD)⇒ 门 130 不得红,F13 现读"命中 0 枚"', () => {
  const repo = mkRepo({})
  try {
    // 只改磁盘副本、不 git add:这正是"滞后工作树"的现场;取材面按 §0.4 钉在索引 blob 上
    writeFileSync(join(repo.root, PLAN), HEAD_PLAN.replace(CLOSED_ROW, REGRESSED_ROW), 'utf8')
    const staged = runGate(repo.root, ['--staged'])
    assert.equal(
      staged.rc,
      0,
      `被审面==HEAD 时不得红(挡光所有人提交 = 恒红门,§12e),实测 RC=${staged.rc}\n${staged.out.slice(-1500)}`,
    )
    assert.match(f13Line(staged.out), /命中 0 枚/, `F13 必须现读 0,实测 ${JSON.stringify(f13Line(staged.out))}`)
    assert.match(
      f13Line(staged.out),
      /被审面条目行 2/,
      `候选面读数必须在场("枚举到 0"不等于"没量",§0.3),实测 ${JSON.stringify(f13Line(staged.out))}`,
    )
    const full = runGate(repo.root, [])
    assert.equal(full.rc, 0, `全量档同样不得红,实测 RC=${full.rc}\n${full.out.slice(-900)}`)
    assert.match(f13Line(full.out), /命中 0 枚/)
    assert.match(f13Line(full.out), /本档两面同源/, `全量档必须自报"算不出本次新增",实测 ${JSON.stringify(f13Line(full.out))}`)
  } finally {
    rmScratch(repo.root)
  }
})

// ── 夹具 2:索引面真回退 ⇒ 必红并点名复合主键 ────────────────────────────────
test('夹具2 索引面把已勾行捣回未勾 ⇒ 门 130 必红,并点名那枚复合主键', () => {
  const key = compositeKeyOf(CLOSED_ROW)
  assert.ok(
    key && key === compositeKeyOf(REGRESSED_ROW),
    `夹具前提:已勾行与回退行必须同主键,实测 ${JSON.stringify([key, compositeKeyOf(REGRESSED_ROW)])}`,
  )
  const repo = mkRepo({ stageText: HEAD_PLAN.replace(CLOSED_ROW, REGRESSED_ROW) })
  try {
    const run = runGate(repo.root, ['--staged'])
    assert.equal(run.rc, 1, `真回退必须红,实测 RC=${run.rc}\n${run.out.slice(-1500)}`)
    assert.match(run.out, /❌ 差值棘轮/, `必须走差值棘轮那一拦,实测 ${run.out.slice(-600)}`)
    assert.match(run.out, /F13 已勾行被捣回未勾/, `红名单必须点名 F13,实测 ${run.out.slice(-600)}`)
    assert.ok(run.out.includes(key), `必须点名复合主键 ${key},实测 ${run.out.slice(-600)}`)
    // 反向对照(装上/摘掉成对):同一仓把索引面改回 HEAD ⇒ 必须立刻翻绿
    writeFileSync(join(repo.root, PLAN), HEAD_PLAN, 'utf8')
    gitIn(repo.root, ['add', PLAN])
    const green = runGate(repo.root, ['--staged'])
    assert.equal(green.rc, 0, `摘掉回退后必须翻绿(证明红来自这一维本身),实测 RC=${green.rc}\n${green.out.slice(-900)}`)
    assert.match(f13Line(green.out), /命中 0 枚/, `摘掉后读数必须归 0,实测 ${JSON.stringify(f13Line(green.out))}`)
  } finally {
    rmScratch(repo.root)
  }
})

// ── 夹具 3:存量回退(HEAD 面自有的两态并存)⇒ 只报数不红 ─────────────────────
test('夹具3 HEAD 面自有的两态并存 = 存量 ⇒ 只报数不红;叠一枚真回退时只记新那一枚', () => {
  const stockKey = compositeKeyOf(STOCK_DONE)
  const liveKey = compositeKeyOf(CLOSED_ROW)
  const repo = mkRepo({ headText: STOCK_PLAN, stageText: STOCK_PLAN })
  try {
    const run = runGate(repo.root, ['--staged'])
    assert.equal(run.rc, 0, `存量不得拦本次提交(§12e),实测 RC=${run.rc}\n${run.out.slice(-1500)}`)
    const line = f13Line(run.out)
    assert.match(line, /命中 1 枚/, `存量必须被量到,实测 ${JSON.stringify(line)}`)
    assert.match(line, /存量 1 枚\(只报数\)/, `存量档必须点名,实测 ${JSON.stringify(line)}`)
    assert.match(line, /本次带回 0 枚/, `本次带回必须是 0,实测 ${JSON.stringify(line)}`)
    assert.ok(!/F13 回退主键/.test(run.out), `存量不该被逐枚点成"回退"(那是问责档的事),实测 ${run.out.slice(-500)}`)
    // 同仓再叠一枚真回退 ⇒ 只把**新**那一枚记在本次提交头上
    writeFileSync(join(repo.root, PLAN), STOCK_PLAN.replace(CLOSED_ROW, REGRESSED_ROW), 'utf8')
    gitIn(repo.root, ['add', PLAN])
    const red = runGate(repo.root, ['--staged'])
    assert.equal(red.rc, 1, `存量 + 新回退 ⇒ 只拦新回退那一枚,实测 RC=${red.rc}\n${red.out.slice(-1200)}`)
    assert.ok(red.out.includes(liveKey), `点名必须是新回退那枚主键,实测 ${red.out.slice(-600)}`)
    assert.ok(
      !red.out.includes(`F13 回退主键 ${stockKey}`),
      '存量主键不得被记在本次提交头上(等量换键那一型由键集差集处理,不是把存量算成本次的债)',
    )
  } finally {
    rmScratch(repo.root)
  }
})

// ── 夹具 4:面取不到 ⇒ exit 2 未判定(既不记绿也不冒红)───────────────────────
test('夹具4 面取不到 ⇒ 门 130 落 exit 2 并显式写未判定;锚点面缺位时 F13 自报未判定', () => {
  // 4a 被审面(索引 blob)根本不存在 ⇒ 取材失败 ⇒ 2
  const noFile = mkRepo({})
  try {
    gitIn(noFile.root, ['rm', '-q', '--cached', PLAN])
    const run = runGate(noFile.root, ['--staged'])
    assert.equal(run.rc, 2, `被审面取不到必须 2,实测 RC=${run.rc}\n${run.out.slice(-700)}`)
    assert.match(run.out, /无法判定/, `必须显式写无法判定,实测 ${JSON.stringify(run.out.slice(-300))}`)
    assert.ok(!/✅ 差值棘轮/.test(run.out), '未判定不得同时印出"差值棘轮通过"')
    assert.ok(!/✅ 全部/.test(run.out), '未判定不得印结论性绿行')
  } finally {
    rmScratch(noFile.root)
  }
  // 4b 锚点面不可解析(仓库还没有任何提交)⇒ 差值层判不了 ⇒ F13 必须点名未判定,不得冒充"命中 0"
  const noHead = mkRepo({ headText: HEAD_PLAN, commit: false })
  try {
    gitIn(noHead.root, ['add', PLAN])
    const run = runGate(noHead.root, ['--staged'])
    assert.match(
      run.out,
      /差值棘轮未判定/,
      `锚点面取不到时差值层必须点名未判定,实测 ${JSON.stringify(run.out.slice(-400))}`,
    )
    assert.match(
      f13Line(run.out),
      /未判定/,
      `F13 行必须自带未判定原因(§0.3),实测 ${JSON.stringify(f13Line(run.out))}`,
    )
    assert.ok(
      !/✅ 差值棘轮/.test(run.out),
      `锚点取不到时不得印"差值棘轮通过",实测 ${run.out.slice(-400)}`,
    )
  } finally {
    rmScratch(noHead.root)
  }
})

// ── 判据单源锁(§0.6 / 守门 191):F13 不许有第二套"什么算同一件事" ──────────────
test('F13 判据单源:命中主键必须全部住在 stateGroupsOf 的键集里;副本指针行不充回退证据', () => {
  const anchor = [CLOSED_ROW, STOCK_DONE, STOCK_OPEN].join('\n')
  const face = [REGRESSED_ROW, STOCK_DONE, STOCK_OPEN].join('\n')
  const res = findClosedToOpenRegressions(anchor, face)
  const groupKeys = new Set(stateGroupsOf(face).keys())
  // 跨面命中集**含存量**(锚点面已勾 ∧ 被审面未勾,G-900779 那种"面上本来就两态并存"也算一枚);
  // 判红只认"不在锚点面存量集里"的那一枚 —— 这条区分就是"存量只报数"的实现(§12e)。
  assert.deepEqual(
    res.hits.map((h) => h.key).sort(),
    [compositeKeyOf(CLOSED_ROW), compositeKeyOf(STOCK_DONE)].sort(),
    `跨面命中应是 G-900777(真回退)+ G-900779(存量)两枚,实测 ${JSON.stringify(res.hits.map((h) => h.key))}`,
  )
  for (const h of res.hits)
    assert.ok(groupKeys.has(h.key), `命中主键 ${h.key} 不在单源分组键集里 ⇒ 分组被另写了一份`)
  assert.deepEqual(
    res.anchorStockKeys,
    [compositeKeyOf(STOCK_DONE)],
    `锚点面自身存量应恰好是 G-900779 那一组(差值棘轮的锚点),实测 ${JSON.stringify(res.anchorStockKeys)}`,
  )
  assert.deepEqual(
    res.hits.map((h) => h.key).filter((k) => !res.anchorStockKeys.includes(k)),
    [compositeKeyOf(CLOSED_ROW)],
    `差集(本次带回)必须只剩 G-900777 那一枚,实测 ${JSON.stringify(res.hits.map((h) => h.key).filter((k) => !res.anchorStockKeys.includes(k)))}`,
  )
  assert.ok(
    res.anchorDoneKeys === 2 && res.anchorRows === 3 && res.faceRows === 3,
    `候选面读数必须留痕("枚举到 0 候选"不得被读成通过),实测 ${JSON.stringify([res.anchorDoneKeys, res.anchorRows, res.faceRows])}`,
  )
  // 带【归并】副本指针的行不充"又变回未做"的证据(与 findForks 的 liveOpenOf 同一把尺)
  const copyRes = findClosedToOpenRegressions(anchor, COPY_POINTER_OPEN + '\n')
  assert.equal(
    copyRes.hits.length,
    0,
    `副本指针行不得算回退,实测 ${JSON.stringify(copyRes.hits.map((h) => h.key))}`,
  )
})

test('wireF13 与 grewViolations:等量换键必须由主键差集拦下;面不在手时落未判定', () => {
  const anchorText = [CLOSED_ROW, STOCK_DONE, STOCK_OPEN].join('\n')
  const anchorObj = { counts: {}, __contentText: anchorText, __face: 'head' }
  const anchor = wireF13(anchorObj, anchorObj, { faceLabel: 'HEAD 锚点面', anchorLabel: 'HEAD 锚点面' })
  assert.equal(anchor.counts.f13Regressed, 1, `锚点面存量应为 1,实测 ${anchor.counts.f13Regressed}`)
  // 消掉一枚存量分叉 + 带回一枚新回退 ⇒ 枚数持平 ⇒ 通用"比变多"那一循环恒绿
  const swapText = [REGRESSED_ROW, STOCK_DONE].join('\n')
  const swapped = wireF13(
    { counts: {}, __contentText: swapText, __face: 'staged' },
    anchor,
    { faceLabel: '被审面(索引 blob)', anchorLabel: 'HEAD 锚点面' },
  )
  assert.equal(
    swapped.counts.f13Regressed,
    anchor.counts.f13Regressed,
    `夹具前提:两侧枚数必须持平,否则本例没量到"等量换键"(实测 ${swapped.counts.f13Regressed} vs ${anchor.counts.f13Regressed})`,
  )
  const grew = grewViolations(swapped, anchor)
  assert.ok(
    grew.some((x) => x.startsWith('F13')),
    `等量换键必须由键集差集拦下,实测 ${JSON.stringify(grew)}`,
  )
  assert.ok(
    grew.some((x) => x.includes(compositeKeyOf(CLOSED_ROW))),
    `红名单必须点名那枚新回退主键,实测 ${JSON.stringify(grew)}`,
  )
  // 两面同源(全量档)⇒ 结构上算不出新增,必须自报而不是冒充"判过"
  const selfOnly = grewViolations(anchor, anchor)
  assert.ok(!selfOnly.some((x) => x.startsWith('F13')), '两面同源不得判红(恒红门防线)')
  assert.equal(anchor.f13CrossNotMeaningful, true, '全量档必须自报"本次新增算不出"这一格')
  // 锚点面取不到 ⇒ 不判:读数留 0,同时点名原因(§0.3)
  const noAnchor = wireF13(
    { counts: {}, __contentText: swapText, __face: 'staged' },
    { counts: {} },
    { faceLabel: '被审面(索引 blob)', anchorLabel: 'HEAD 锚点面' },
  )
  assert.equal(noAnchor.counts.f13Regressed, 0, '锚点取不到时读数必须留 0(不冒红)')
  assert.match(String(noAnchor.f13Unjudged), /全文不在手/, '未判定必须点名原因(不记绿)')
  assert.equal(
    probe(noAnchor).filter(([k]) => k === 'F13').length,
    1,
    'F13 必须在 probe 维度清单里(否则差值档与报告读数清单静默不判)',
  )
})

// ── 门 239:结论三态 —— 两面不同而零命中时**不得**再出现"逐字相同" ──────────────
test('门 239 三态实测:①同一枚 blob 才说逐字相同 ②两面不同零命中点名 blob ③面取不到落 2', () => {
  // ① 把真 HEAD 面原文当候选 ⇒ 两面同一枚 blob ⇒ 有权说"逐字相同"
  const scratch = mkScratch('plan-archive-monotonic-words')
  try {
    const headPath = join(scratch, 'head-blob.md')
    const realHead = gitBlob(REPO, ['show', `HEAD:${PLAN}`])
    writeFileSync(headPath, realHead, 'utf8')
    const identical = runMonotonic(['--candidate-file', headPath])
    const headSha = blobShaOf(readFileSync(headPath, 'utf8'))
    if (identical.rc === 0 && /逐字相同/.test(identical.out)) {
      assert.ok(identical.out.includes(headSha), `①态必须带 40 位 blob 凭证,实测 ${JSON.stringify(identical.out.split('\n')[0])}`)
    } else {
      // 候选文件多一个尾随换行 ⇒ 与 HEAD 不是同一枚 blob:此时必须走 ② 那一支(且绝不提"逐字相同")
      assert.equal(identical.rc, 0, `①/② 两支都必须 RC 0,实测 ${identical.rc}\n${identical.out.slice(-500)}`)
      assert.ok(
        !/逐字相同/.test(identical.out),
        `两面 blob 不同而零命中时**不得**出现"逐字相同",实测 ${JSON.stringify(identical.out.split('\n')[0])}`,
      )
      assert.match(identical.out, /两面 blob 不同/)
    }
    // ② 候选面 = HEAD + 一条全新登记(零命中)⇒ 必须点名两面 blob 不同,且不含"逐字相同"
    const shiftedPath = join(scratch, 'shifted.md')
    writeFileSync(
      shiftedPath,
      `${realHead}\n- [ ] 夹具专用行 供镜像断言两面不同而零命中 正文足够长用于判据样例\n`,
      'utf8',
    )
    const shifted = runMonotonic(['--candidate-file', shiftedPath])
    assert.equal(shifted.rc, 0, `②态零命中应 RC 0,实测 ${shifted.rc}\n${shifted.out.slice(-500)}`)
    assert.ok(
      !/逐字相同/.test(shifted.out),
      `两面不同而零命中却印"逐字相同" = 把"没判中"说成"两面一样"(本次立修的缺陷型),实测 ${JSON.stringify(shifted.out.split('\n')[0])}`,
    )
    assert.match(shifted.out, /两面 blob 不同/, `②态必须点名两面 blob 不同,实测 ${JSON.stringify(shifted.out.split('\n')[0])}`)
    assert.ok(
      shifted.out.includes(blobShaOf(readFileSync(shiftedPath, 'utf8'))) &&
        shifted.out.includes(blobShaOf(realHead)),
      `②态必须把两面 blob 逐条报出(40 位),实测 ${JSON.stringify(shifted.out.split('\n')[0])}`,
    )
    // ③ 面取不到 ⇒ exit 2 显式未判定(旧实现在这里抛未捕获异常,落成 RC 1 的"红")
    const missing = runMonotonic(['--candidate-file', join(scratch, 'nope-does-not-exist.md')])
    assert.equal(missing.rc, 2, `面取不到必须 2 而不是 1,实测 ${missing.rc}\n${missing.out.slice(-400)}`)
    assert.match(missing.out, /无法判定/, `必须显式写无法判定,实测 ${JSON.stringify(missing.out.split('\n')[0])}`)
    // 两面旗同给 ⇒ 同样未判定
    const both = runMonotonic(['--staged', '--worktree'])
    assert.equal(both.rc, 2, `两面旗同给必须 2,实测 ${both.rc}`)
  } finally {
    rmScratch(scratch)
  }
})

test('门 239 结论纯函数:三态形状锁(摘掉分流即翻红)', () => {
  const head = ['# 计划', CLOSED_ROW, ''].join('\n')
  const same = conclusionOf('索引 blob', head, head, 0)
  const diff = conclusionOf('索引 blob', head, `${head}\n${OTHER_LIVE}`, 0)
  const hit = conclusionOf('索引 blob', head, head.replace(CLOSED_ROW, REGRESSED_ROW), 3)
  assert.equal(same.kind, 'identical')
  assert.ok(same.line.includes('逐字相同'), `①态应含"逐字相同",实测 ${same.line}`)
  assert.match(same.line, /blob [0-9a-f]{40}/, `①态必须带 40 位凭证,实测 ${same.line}`)
  assert.equal(diff.kind, 'no-hit')
  assert.ok(!diff.line.includes('逐字相同'), `②态不得出现"逐字相同",实测 ${diff.line}`)
  assert.ok(diff.line.includes('两面 blob 不同'), `②态必须点名两面不同,实测 ${diff.line}`)
  assert.notEqual(diff.headSha, diff.candSha)
  assert.equal(hit.kind, 'hits')
  assert.match(hit.line, /检出 3 条倒退/)
  // blobShaOf 必须就是 git 的 blob 内容寻址(凭证对不上就是自造标识)
  assert.equal(blobShaOf('a\n'), '78981922613b2afb6025042ff6bd878ac1994e85')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
